import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Artists and venues form the user's personal catalog. Both endpoints support
 * `?q=` type-ahead search, and POST is create-or-get so the client can safely
 * submit a name that may already exist.
 */
export const catalogRouter = Router();
catalogRouter.use(requireAuth);

// ---------- Artists ----------

catalogRouter.get("/artists", (req, res) => {
  const q = String(req.query.q || "").trim();
  const rows = q
    ? db
        .prepare(
          `SELECT a.id, a.name, COUNT(ca.concert_id) AS show_count
           FROM artists a
           LEFT JOIN concert_artists ca ON ca.artist_id = a.id
           WHERE a.user_id = ? AND a.name LIKE ? ESCAPE '\\'
           GROUP BY a.id ORDER BY show_count DESC, a.name LIMIT 20`
        )
        .all(req.user.id, `%${escapeLike(q)}%`)
    : db
        .prepare(
          `SELECT a.id, a.name, COUNT(ca.concert_id) AS show_count
           FROM artists a
           LEFT JOIN concert_artists ca ON ca.artist_id = a.id
           WHERE a.user_id = ?
           GROUP BY a.id ORDER BY show_count DESC, a.name LIMIT 50`
        )
        .all(req.user.id);
  res.json({ artists: rows.map((r) => ({ id: r.id, name: r.name, showCount: r.show_count })) });
});

catalogRouter.post("/artists", (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Enter an artist name." });
  if (name.length > 200) return res.status(400).json({ error: "Artist name is too long." });

  const existing = db
    .prepare("SELECT id, name FROM artists WHERE user_id = ? AND name = ? COLLATE NOCASE")
    .get(req.user.id, name);
  if (existing) return res.json({ artist: existing, created: false });

  const info = db
    .prepare("INSERT INTO artists (user_id, name) VALUES (?, ?)")
    .run(req.user.id, name);
  res.status(201).json({ artist: { id: info.lastInsertRowid, name }, created: true });
});

// ---------- Venues ----------

catalogRouter.get("/venues", (req, res) => {
  const q = String(req.query.q || "").trim();
  const base = `
    SELECT v.id, v.name, v.city, v.region, v.country, COUNT(c.id) AS show_count
    FROM venues v
    LEFT JOIN concerts c ON c.venue_id = v.id
    WHERE v.user_id = ?`;
  const rows = q
    ? db
        .prepare(
          `${base} AND (v.name LIKE ? ESCAPE '\\' OR v.city LIKE ? ESCAPE '\\')
           GROUP BY v.id ORDER BY show_count DESC, v.name LIMIT 20`
        )
        .all(req.user.id, `%${escapeLike(q)}%`, `%${escapeLike(q)}%`)
    : db
        .prepare(`${base} GROUP BY v.id ORDER BY show_count DESC, v.name LIMIT 50`)
        .all(req.user.id);
  res.json({ venues: rows.map(venueShape) });
});

catalogRouter.post("/venues", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const city = String(req.body?.city || "").trim();
  const region = String(req.body?.region || "").trim();
  const country = String(req.body?.country || "").trim();
  if (!name) return res.status(400).json({ error: "Enter a venue name." });
  if ([name, city, region, country].some((s) => s.length > 200))
    return res.status(400).json({ error: "One of the venue fields is too long." });

  const existing = db
    .prepare(
      "SELECT * FROM venues WHERE user_id = ? AND name = ? COLLATE NOCASE AND city = ? COLLATE NOCASE"
    )
    .get(req.user.id, name, city);
  if (existing) return res.json({ venue: venueShape(existing), created: false });

  const info = db
    .prepare("INSERT INTO venues (user_id, name, city, region, country) VALUES (?, ?, ?, ?, ?)")
    .run(req.user.id, name, city, region, country);
  const venue = db.prepare("SELECT * FROM venues WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ venue: venueShape(venue), created: true });
});

function venueShape(v) {
  return {
    id: v.id,
    name: v.name,
    city: v.city,
    region: v.region,
    country: v.country,
    showCount: v.show_count ?? undefined,
  };
}

function escapeLike(s) {
  return s.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
