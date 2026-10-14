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
