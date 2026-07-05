import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { db, transaction } from "../db.js";
import { UPLOAD_DIR } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

export const concertsRouter = Router();
concertsRouter.use(requireAuth);

function validateBody(req) {
  const date = String(req.body?.date || "").trim();
  const venueId = Number(req.body?.venueId);
  const artistIds = Array.isArray(req.body?.artistIds)
    ? req.body.artistIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const notes = String(req.body?.notes || "").slice(0, 5000);
  const ratingRaw = req.body?.rating;
  const rating =
    ratingRaw === null || ratingRaw === undefined || ratingRaw === ""
      ? null
      : Number(ratingRaw);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Enter the show date as YYYY-MM-DD." };
  if (!Number.isInteger(venueId) || venueId <= 0) return { error: "Pick a venue." };
  if (artistIds.length === 0) return { error: "Add at least one artist." };
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5))
    return { error: "Rating must be 1 to 5." };
  return { date, venueId, artistIds: [...new Set(artistIds)], notes, rating };
}

function assertOwnedRefs(userId, venueId, artistIds) {
  const venue = db
    .prepare("SELECT id FROM venues WHERE id = ? AND user_id = ?")
    .get(venueId, userId);
  if (!venue) return "That venue doesn't exist.";
  const placeholders = artistIds.map(() => "?").join(",");
  const count = db
    .prepare(`SELECT COUNT(*) AS n FROM artists WHERE user_id = ? AND id IN (${placeholders})`)
    .get(userId, ...artistIds).n;
  if (count !== artistIds.length) return "One of the artists doesn't exist.";
  return null;
}

function concertShape(row) {
  const artists = db
    .prepare(
      `SELECT a.id, a.name, ca.slot FROM concert_artists ca
       JOIN artists a ON a.id = ca.artist_id
       WHERE ca.concert_id = ? ORDER BY ca.slot`
    )
    .all(row.id);
  const photos = db
    .prepare("SELECT id, original_name, created_at FROM photos WHERE concert_id = ? ORDER BY id")
    .all(row.id);
  return {
    id: row.id,
    date: row.date,
    notes: row.notes,
    rating: row.rating,
    venue: {
      id: row.venue_id,
      name: row.venue_name,
      city: row.venue_city,
      region: row.venue_region,
      country: row.venue_country,
    },
    artists: artists.map((a) => ({ id: a.id, name: a.name, slot: a.slot })),
    photos: photos.map((p) => ({
      id: p.id,
      originalName: p.original_name,
      url: `/api/photos/${p.id}/file`,
      thumbUrl: `/api/photos/${p.id}/thumb`,
    })),
  };
}

const SELECT_CONCERT = `
  SELECT c.*, v.name AS venue_name, v.city AS venue_city,
         v.region AS venue_region, v.country AS venue_country
  FROM concerts c JOIN venues v ON v.id = c.venue_id`;

concertsRouter.get("/", (req, res) => {
  const rows = db
    .prepare(`${SELECT_CONCERT} WHERE c.user_id = ? ORDER BY c.date DESC, c.id DESC`)
    .all(req.user.id);
  res.json({ concerts: rows.map(concertShape) });
});

concertsRouter.get("/:id", (req, res) => {
  const row = db
    .prepare(`${SELECT_CONCERT} WHERE c.id = ? AND c.user_id = ?`)
    .get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Concert not found." });
  res.json({ concert: concertShape(row) });
});

concertsRouter.post("/", (req, res) => {
  const body = validateBody(req);
  if (body.error) return res.status(400).json({ error: body.error });
  const refError = assertOwnedRefs(req.user.id, body.venueId, body.artistIds);
  if (refError) return res.status(400).json({ error: refError });

  const create = () => transaction(() => {
    const info = db
      .prepare(
        "INSERT INTO concerts (user_id, venue_id, date, notes, rating) VALUES (?, ?, ?, ?, ?)"
      )
      .run(req.user.id, body.venueId, body.date, body.notes, body.rating);
    const insertArtist = db.prepare(
      "INSERT INTO concert_artists (concert_id, artist_id, slot) VALUES (?, ?, ?)"
    );
    body.artistIds.forEach((artistId, slot) =>
      insertArtist.run(info.lastInsertRowid, artistId, slot)
    );
    return info.lastInsertRowid;
  });

  const id = create();
  const row = db.prepare(`${SELECT_CONCERT} WHERE c.id = ?`).get(id);
  res.status(201).json({ concert: concertShape(row) });
});

concertsRouter.put("/:id", (req, res) => {
  const existing = db
    .prepare("SELECT id FROM concerts WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Concert not found." });

  const body = validateBody(req);
  if (body.error) return res.status(400).json({ error: body.error });
  const refError = assertOwnedRefs(req.user.id, body.venueId, body.artistIds);
  if (refError) return res.status(400).json({ error: refError });

  const update = () => transaction(() => {
    db.prepare(
      "UPDATE concerts SET venue_id = ?, date = ?, notes = ?, rating = ? WHERE id = ?"
    ).run(body.venueId, body.date, body.notes, body.rating, existing.id);
    db.prepare("DELETE FROM concert_artists WHERE concert_id = ?").run(existing.id);
    const insertArtist = db.prepare(
      "INSERT INTO concert_artists (concert_id, artist_id, slot) VALUES (?, ?, ?)"
    );
    body.artistIds.forEach((artistId, slot) => insertArtist.run(existing.id, artistId, slot));
  });
  update();

  const row = db.prepare(`${SELECT_CONCERT} WHERE c.id = ?`).get(existing.id);
  res.json({ concert: concertShape(row) });
});

concertsRouter.delete("/:id", (req, res) => {
  const files = db
    .prepare(
      `SELECT p.filename, p.thumb_filename FROM photos p
       JOIN concerts c ON c.id = p.concert_id
       WHERE c.id = ? AND c.user_id = ?`
    )
    .all(req.params.id, req.user.id);

  const info = db
    .prepare("DELETE FROM concerts WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: "Concert not found." });

  for (const f of files) {
    for (const name of [f.filename, f.thumb_filename]) {
      fs.promises.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
    }
  }
  res.json({ ok: true });
});
