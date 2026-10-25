import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getState, setState, listChatMessages, addChatMessage, clearChatMessages, addMeal, listMeals, deleteMeal } from "./db.js";
import { buildContext, askCoach } from "./coach.js";
import { analyzeMeal } from "./food.js";
import { reviewSession } from "./review.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const TOKEN = process.env.APP_TOKEN;
if (!TOKEN) {
  throw new Error("Missing APP_TOKEN env var. Pick any secret string and set it (see server/.env.example).");
}

const app = express();
app.use(express.json({ limit: "8mb" }));

function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (given !== TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
}

app.get("/api/state", requireAuth, async (req, res) => {
  try {
    const data = await getState();
    res.json(data ? JSON.parse(data) : { sessions: [], weights: [], measures: [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to read state" });
  }
});

app.put("/api/state", requireAuth, async (req, res) => {
  try {
    await setState(JSON.stringify(req.body || {}));
    res.json({ ok: true });
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

    const rawState = await getState();
    const state = rawState ? JSON.parse(rawState) : { sessions: [], weights: [], measures: [] };
    const context = buildContext(state);

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
    const { session, history, program, week, rampWeeks } = req.body || {};
    if (!session || !session.ex || !program) return res.status(400).json({ error: "session and program required" });
    const review = await reviewSession({ session, history, program, week, rampWeeks });
    res.json(review);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "analyse impossible" });
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

app.post("/api/meals", requireAuth, async (req, res) => {
  try {
    const image = (req.body && req.body.image) || "";
    const note = ((req.body && req.body.note) || "").trim();
    if (!image) return res.status(400).json({ error: "image required" });

    const analysis = await analyzeMeal(image, note);
    const id = await addMeal({
      image_data: image,
      note,
      items: analysis.items,
      calories: analysis.calories,
      protein_g: analysis.protein_g,
      carbs_g: analysis.carbs_g,
      fat_g: analysis.fat_g,
      confidence: analysis.confidence,
      analysis_note: analysis.note,
    });

    res.json({ id, ...analysis });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "analyse impossible" });
  }
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

// Never serve the server's own source or any dotfiles (env secrets live here).
app.use((req, res, next) => {
  if (req.path.startsWith("/server/")) return res.status(404).end();
  next();
});

app.use(express.static(ROOT));

app.get("*", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Carnet server listening on port ${PORT}`));
