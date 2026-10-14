import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getState, setState } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const TOKEN = process.env.APP_TOKEN;
if (!TOKEN) {
  throw new Error("Missing APP_TOKEN env var. Pick any secret string and set it (see server/.env.example).");
}

const app = express();
app.use(express.json({ limit: "2mb" }));

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
