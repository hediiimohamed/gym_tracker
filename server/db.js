import { createClient } from "@libsql/client";

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error(
    "Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN. Create a free database at turso.tech and set both env vars (see server/.env.example)."
  );
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

await db.execute(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

export async function getState() {
  const r = await db.execute("SELECT data FROM app_state WHERE id = 1");
  return r.rows.length ? r.rows[0].data : null;
}

export async function setState(json) {
  await db.execute({
    sql: `INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    args: [json, new Date().toISOString()],
  });
}

export async function listChatMessages(limit = 40) {
  const r = await db.execute({
    sql: "SELECT role, content, created_at FROM chat_messages ORDER BY id DESC LIMIT ?",
    args: [limit],
  });
  return r.rows.reverse().map(row => ({ role: row.role, content: row.content, date: row.created_at }));
}

export async function addChatMessage(role, content) {
  await db.execute({
    sql: "INSERT INTO chat_messages (role, content, created_at) VALUES (?, ?, ?)",
    args: [role, content, new Date().toISOString()],
  });
}

export async function clearChatMessages() {
  await db.execute("DELETE FROM chat_messages");
}

await db.execute(`
  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_data TEXT NOT NULL,
    note TEXT,
    items TEXT NOT NULL,
    calories INTEGER,
    protein_g INTEGER,
    carbs_g INTEGER,
    fat_g INTEGER,
    confidence TEXT,
    analysis_note TEXT,
    created_at TEXT NOT NULL
  )
`);

export async function addMeal(m) {
  const r = await db.execute({
    sql: `INSERT INTO meals (image_data, note, items, calories, protein_g, carbs_g, fat_g, confidence, analysis_note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [m.image_data, m.note || null, JSON.stringify(m.items || []), m.calories, m.protein_g, m.carbs_g, m.fat_g, m.confidence, m.analysis_note || "", new Date().toISOString()],
  });
  return Number(r.lastInsertRowid);
}

export async function listMeals(limit = 30) {
  const r = await db.execute({
    sql: `SELECT id, image_data, note, items, calories, protein_g, carbs_g, fat_g, confidence, analysis_note, created_at
          FROM meals ORDER BY id DESC LIMIT ?`,
    args: [limit],
  });
  return r.rows.map(row => ({
    id: row.id,
    image: row.image_data,
    note: row.note,
    items: JSON.parse(row.items || "[]"),
    calories: row.calories,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    confidence: row.confidence,
    analysisNote: row.analysis_note,
    date: row.created_at,
  }));
}

export async function deleteMeal(id) {
  await db.execute({ sql: "DELETE FROM meals WHERE id = ?", args: [id] });
}
