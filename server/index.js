import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { getState, setState, listChatMessages, addChatMessage, clearChatMessages, addMeal, listMeals, deleteMeal, mealTotals, updateMealRows, getMealImage, listFavorites, addFavorite, deleteFavorite } from "./db.js";
import { buildContext, askCoach } from "./coach.js";
import { analyzeMeal, totalsOf } from "./food.js";
import { reviewSession } from "./review.js";
import { planSession } from "./plan.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const TOKEN = process.env.APP_TOKEN;
if (!TOKEN) throw new Error("APP_TOKEN must be set (the Render URL is public).");

const app = express();
app.set("trust proxy", 1); // Render est derrière un proxy : req.ip = vraie IP du client
app.use(express.json({ limit: "8mb" }));

// Comparaison à temps constant (on compare des empreintes de même longueur).
const digest = s => crypto.createHash("sha256").update(s).digest();
const TOKEN_DIGEST = digest(TOKEN);
function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!crypto.timingSafeEqual(digest(given), TOKEN_DIGEST)) return res.status(401).json({ error: "unauthorized" });
  next();
}

// Limite de débit par IP, fenêtre glissante d'une minute. L'URL est publique et
// chaque appel à Claude coûte : plafond plus bas pour ces routes.
function rateLimit(max) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter(t => now - t < 60000);
    if (recent.length >= max) {
      res.set("Retry-After", String(Math.ceil((60000 - (now - recent[0])) / 1000)));
      return res.status(429).json({ error: "too many requests" });
    }
    recent.push(now);
    hits.set(req.ip, recent);
    if (hits.size > 1000) for (const [k, v] of hits) if (now - v[v.length - 1] > 60000) hits.delete(k);
    next();
  };
}
app.use("/api", rateLimit(60));
const claudeLimit = rateLimit(10);
app.post(["/api/plan", "/api/review", "/api/chat", "/api/meals"], claudeLimit);

app.get("/api/state", requireAuth, async (req, res) => {
  try {
    const { data, version } = await getState();
    res.json({ data: data ? JSON.parse(data) : { sessions: [], weights: [], measures: [], deleted: [] }, version });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to read state" });
  }
});

app.put("/api/state", requireAuth, async (req, res) => {
  try {
    const { data, baseVersion } = req.body || {};
    // Un ancien client (sans baseVersion) écraserait le serveur avec une copie
    // potentiellement périmée : on refuse, il doit recharger la page.
    if (!Number.isInteger(baseVersion) || !data || !Array.isArray(data.sessions)) {
      return res.status(400).json({ error: "data and integer baseVersion required — reload the app" });
    }
    const r = await setState(JSON.stringify(data), baseVersion);
    if (!r.ok) return res.status(409).json({ data: r.data ? JSON.parse(r.data) : null, version: r.version });
    res.json({ ok: true, version: r.version });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to save state" });
  }
});

app.get("/api/chat", requireAuth, async (req, res) => {
  try {
    const messages = await listChatMessages();
    res.json({ messages });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to load chat" });
  }
});

app.post("/api/chat", requireAuth, async (req, res) => {
  try {
    const userText = ((req.body && req.body.message) || "").trim();
    if (!userText) return res.status(400).json({ error: "message required" });

    await addChatMessage("user", userText);
    const history = (await listChatMessages()).map(m => ({ role: m.role, content: m.content }));

    const { data: rawState } = await getState();
    const state = rawState ? JSON.parse(rawState) : { sessions: [], weights: [], measures: [] };
    const { names, days } = req.body;
    const meals = days ? {
      today: await mealTotals(days.today[0], days.today[1]),
      yesterday: await mealTotals(days.yesterday[0], days.yesterday[1]),
    } : {};
    const context = buildContext(state, { names, meals });

    const reply = await askCoach(history, context);
    await addChatMessage("assistant", reply);

    res.json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "coach unavailable" });
  }
});

app.delete("/api/chat", requireAuth, async (req, res) => {
  try {
    await clearChatMessages();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to clear chat" });
  }
});

app.post("/api/review", requireAuth, async (req, res) => {
  try {
    const { session, history, program, reprise, daysSinceLast, seenLoads } = req.body || {};
    if (!session || !session.ex || !program) return res.status(400).json({ error: "session and program required" });
    const review = await reviewSession({ session, history, program, reprise, daysSinceLast, seenLoads });
    res.json(review);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "analyse impossible" });
  }
});

app.post("/api/plan", requireAuth, async (req, res) => {
  try {
    const { program, history, daysSinceLast, reprise, seenLoads, today, bodyweight } = req.body || {};
    if (!program || !Array.isArray(program.ex)) return res.status(400).json({ error: "program required" });
    const mealsToday = today ? await mealTotals(today[0], today[1]) : null;
    const plan = await planSession({ program, history, daysSinceLast, reprise, seenLoads, mealsToday, bodyweight });
    res.json(plan);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "plan impossible" });
  }
});

app.get("/api/meals", requireAuth, async (req, res) => {
  try {
    const meals = await listMeals();
    res.json({ meals });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to load meals" });
  }
});

// Trois façons d'ajouter un repas : description pesée (+ photo optionnelle)
// analysée par Claude, ou lignes déjà calculées (favori) enregistrées telles quelles.
app.post("/api/meals", requireAuth, async (req, res) => {
  try {
    const { image = "", text = "", rows: given } = req.body || {};
    const description = String(text).trim();
    let result;
    if (Array.isArray(given) && given.length) {
      const rows = given.map(r => ({ ...r, kcal: Number(r.kcal) || 0, protein_g: Number(r.protein_g) || 0, carbs_g: Number(r.carbs_g) || 0, fat_g: Number(r.fat_g) || 0 }));
      result = { rows, totals: totalsOf(rows), missing: [], note: "" };
    } else {
      if (!image && !description) return res.status(400).json({ error: "text or image required" });
      result = await analyzeMeal({ text: description, image });
    }
    const id = await addMeal({
      image_data: image, description: description || null,
      items: result.rows.map(r => r.name), rows: result.rows, missing: result.missing,
      calories: result.totals.kcal, protein_g: result.totals.protein_g,
      carbs_g: result.totals.carbs_g, fat_g: result.totals.fat_g, analysis_note: result.note,
    });
    res.json({ id, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "analyse impossible" });
  }
});

// Correction des grammes : on reçoit les lignes recalculées, on refait les totaux ici.
app.patch("/api/meals/:id", requireAuth, async (req, res) => {
  try {
    const { rows, missing } = req.body || {};
    if (!Array.isArray(rows)) return res.status(400).json({ error: "rows required" });
    const totals = totalsOf(rows);
    await updateMealRows(req.params.id, rows, totals, Array.isArray(missing) ? missing : null);
    res.json({ ok: true, totals });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to update meal" });
  }
});

app.get("/api/meals/:id/image", requireAuth, async (req, res) => {
  try {
    const b64 = await getMealImage(req.params.id);
    if (!b64) return res.status(404).end();
    res.set("Cache-Control", "private, max-age=86400").type("image/jpeg").send(Buffer.from(b64, "base64"));
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.get("/api/favorites", requireAuth, async (req, res) => {
  try { res.json({ favorites: await listFavorites() }); }
  catch (e) { console.error(e); res.status(500).json({ error: "failed to load favorites" }); }
});

app.post("/api/favorites", requireAuth, async (req, res) => {
  try {
    const { name, description, rows } = req.body || {};
    if (!name || !Array.isArray(rows) || !rows.length) return res.status(400).json({ error: "name and rows required" });
    res.json({ id: await addFavorite({ name: String(name).trim(), description, rows }) });
  } catch (e) { console.error(e); res.status(500).json({ error: "failed to save favorite" }); }
});

app.delete("/api/favorites/:id", requireAuth, async (req, res) => {
  try { await deleteFavorite(req.params.id); res.json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ error: "failed to delete favorite" }); }
});

app.delete("/api/meals/:id", requireAuth, async (req, res) => {
  try {
    await deleteMeal(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to delete meal" });
  }
});

// Seuls les fichiers de l'appli sont publics : jamais le code serveur, la doc ou les dotfiles.
app.use("/icons", express.static(path.join(ROOT, "icons"), { dotfiles: "deny" }));
app.get("/manifest.json", (req, res) => res.sendFile(path.join(ROOT, "manifest.json")));
app.use("/api", (req, res) => res.status(404).json({ error: "not found" }));
app.get("*", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Carnet server listening on port ${PORT}`));
