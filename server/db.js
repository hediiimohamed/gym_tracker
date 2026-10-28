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

// Versioning : chaque écriture réussie incrémente `version`. Un client doit
// envoyer la version sur laquelle il s'est basé ; si elle a bougé entre-temps
// (autre appareil), l'écriture est refusée et le client fusionne.
const cols = await db.execute("PRAGMA table_info(app_state)");
if (!cols.rows.some(c => c.name === "version")) {
  await db.execute("ALTER TABLE app_state ADD COLUMN version INTEGER NOT NULL DEFAULT 0");
}

await db.execute(`
  CREATE TABLE IF NOT EXISTS state_backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )
`);

const KEEP_BACKUPS = 5;

export async function getState() {
  const r = await db.execute("SELECT data, version FROM app_state WHERE id = 1");
  return r.rows.length ? { data: r.rows[0].data, version: Number(r.rows[0].version) } : { data: null, version: 0 };
}

// Retourne { ok: true, version } ou { ok: false, data, version } si baseVersion est périmée.
export async function setState(json, baseVersion) {
  const tx = await db.transaction("write");
  try {
    const cur = await tx.execute("SELECT data, version FROM app_state WHERE id = 1");
    const curVersion = cur.rows.length ? Number(cur.rows[0].version) : 0;
    if (baseVersion !== curVersion) {
      await tx.rollback();
      return { ok: false, data: cur.rows.length ? cur.rows[0].data : null, version: curVersion };
    }
    const now = new Date().toISOString();
    if (cur.rows.length) {
      await tx.execute({
        sql: "INSERT INTO state_backups (data, version, created_at) VALUES (?, ?, ?)",
        args: [cur.rows[0].data, curVersion, now],
      });
      await tx.execute({
        sql: `DELETE FROM state_backups WHERE id NOT IN
              (SELECT id FROM state_backups ORDER BY id DESC LIMIT ${KEEP_BACKUPS})`,
        args: [],
      });
    }
    await tx.execute({
      sql: `INSERT INTO app_state (id, data, updated_at, version) VALUES (1, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, version = excluded.version`,
      args: [json, now, curVersion + 1],
    });
    await tx.commit();
    return { ok: true, version: curVersion + 1 };
  } finally {
    tx.close();
  }
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

// Repas v3 : description pesée, une ligne par aliment (avec valeurs pour 100 g
// pour recalculer quand on corrige les grammes), questions sur ce qui manque.
// calories / protein_g / carbs_g / fat_g restent les totaux du repas.
const mealCols = (await db.execute("PRAGMA table_info(meals)")).rows.map(c => c.name);
for (const [col, type] of [["description", "TEXT"], ["rows", "TEXT"], ["missing", "TEXT"]]) {
  if (!mealCols.includes(col)) await db.execute(`ALTER TABLE meals ADD COLUMN ${col} ${type}`);
}

await db.execute(`
  CREATE TABLE IF NOT EXISTS meal_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    rows TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

export async function addMeal(m) {
  const r = await db.execute({
    sql: `INSERT INTO meals (image_data, note, items, calories, protein_g, carbs_g, fat_g, confidence, analysis_note, created_at, description, rows, missing)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [m.image_data || "", m.note || null, JSON.stringify(m.items || []), m.calories, m.protein_g, m.carbs_g, m.fat_g,
           m.confidence || null, m.analysis_note || "", new Date().toISOString(),
           m.description || null, JSON.stringify(m.rows || []), JSON.stringify(m.missing || [])],
  });
  return Number(r.lastInsertRowid);
}

export async function updateMealRows(id, rows, totals, missing) {
  await db.execute({
    sql: "UPDATE meals SET rows = ?, missing = COALESCE(?, missing), calories = ?, protein_g = ?, carbs_g = ?, fat_g = ? WHERE id = ?",
    args: [JSON.stringify(rows), missing ? JSON.stringify(missing) : null, totals.kcal, totals.protein_g, totals.carbs_g, totals.fat_g, id],
  });
}

// La liste ne renvoie plus les photos (lourdes) : elles se chargent une par une.
export async function listMeals(limit = 30) {
  const r = await db.execute({
    sql: `SELECT id, length(image_data) > 0 AS has_image, note, items, calories, protein_g, carbs_g, fat_g, confidence,
                 analysis_note, created_at, description, rows, missing
          FROM meals ORDER BY id DESC LIMIT ?`,
    args: [limit],
  });
  return r.rows.map(row => ({
    id: Number(row.id),
    hasImage: Boolean(row.has_image),
    note: row.note,
    description: row.description,
    items: JSON.parse(row.items || "[]"),
    rows: JSON.parse(row.rows || "[]"),
    missing: JSON.parse(row.missing || "[]"),
    calories: row.calories,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    confidence: row.confidence,
    analysisNote: row.analysis_note,
    date: row.created_at,
  }));
}

export async function getMealImage(id) {
  const r = await db.execute({ sql: "SELECT image_data FROM meals WHERE id = ?", args: [id] });
  return r.rows.length && r.rows[0].image_data ? r.rows[0].image_data : null;
}

export async function listFavorites() {
  const r = await db.execute("SELECT id, name, description, rows FROM meal_favorites ORDER BY name");
  return r.rows.map(row => ({ id: Number(row.id), name: row.name, description: row.description, rows: JSON.parse(row.rows) }));
}

export async function addFavorite(f) {
  const r = await db.execute({
    sql: "INSERT INTO meal_favorites (name, description, rows, created_at) VALUES (?, ?, ?, ?)",
    args: [f.name, f.description || null, JSON.stringify(f.rows), new Date().toISOString()],
  });
  return Number(r.lastInsertRowid);
}

export async function deleteFavorite(id) {
  await db.execute({ sql: "DELETE FROM meal_favorites WHERE id = ?", args: [id] });
}

export async function deleteMeal(id) {
  await db.execute({ sql: "DELETE FROM meals WHERE id = ?", args: [id] });
}

// Totaux des repas entre deux instants (bornes du jour local du client).
export async function mealTotals(startIso, endIso) {
  const r = await db.execute({
    sql: `SELECT COUNT(*) AS n, SUM(calories) AS kcal, SUM(protein_g) AS p, SUM(carbs_g) AS c, SUM(fat_g) AS f
          FROM meals WHERE created_at >= ? AND created_at < ?`,
    args: [startIso, endIso],
  });
  const row = r.rows[0];
  if (!row || !Number(row.n)) return null;
  return { count: Number(row.n), kcal: Number(row.kcal) || 0, protein_g: Number(row.p) || 0, carbs_g: Number(row.c) || 0, fat_g: Number(row.f) || 0 };
}
