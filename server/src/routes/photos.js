import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { db } from "../db.js";
import { UPLOAD_DIR, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_REQUEST } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

export const photosRouter = Router();
photosRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS_PER_REQUEST },
  fileFilter: (req, file, cb) => {
    // Content is verified again by sharp during re-encode; this is a fast pre-filter.
    const ok = /^image\/(jpeg|png|webp|heic|heif|avif|gif)$/.test(file.mimetype);
    cb(ok ? null : new Error("Only image files are supported."), ok);
  },
});

/**
 * POST /api/concerts/:concertId/photos  (multipart field name: "photos")
 * Every upload is decoded and re-encoded by sharp, which both normalizes
 * formats (HEIC from phones -> web-friendly) and prevents disguised
 * non-image files from ever being stored or served.
 */
photosRouter.post("/concerts/:concertId/photos", upload.array("photos"), async (req, res) => {
  const concert = db
    .prepare("SELECT id FROM concerts WHERE id = ? AND user_id = ?")
    .get(req.params.concertId, req.user.id);
  if (!concert) return res.status(404).json({ error: "Concert not found." });
  if (!req.files?.length) return res.status(400).json({ error: "Attach at least one photo." });

  const saved = [];
  for (const file of req.files) {
    const id = crypto.randomUUID();
    const filename = `${id}.jpg`;
    const thumbFilename = `${id}.thumb.jpg`;
    try {
      const image = sharp(file.buffer, { failOn: "error" }).rotate(); // respect EXIF orientation
      await image
        .clone()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(path.join(UPLOAD_DIR, filename));
      await image
        .clone()
        .resize({ width: 480, height: 480, fit: "cover" })
        .jpeg({ quality: 78 })
        .toFile(path.join(UPLOAD_DIR, thumbFilename));
    } catch {
      return res.status(400).json({ error: `"${file.originalname}" isn't a readable image.` });
    }

    const info = db
      .prepare(
        `INSERT INTO photos (user_id, concert_id, filename, thumb_filename, original_name)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(req.user.id, concert.id, filename, thumbFilename, file.originalname || "");
    saved.push({
      id: info.lastInsertRowid,
      originalName: file.originalname || "",
      url: `/api/photos/${info.lastInsertRowid}/file`,
      thumbUrl: `/api/photos/${info.lastInsertRowid}/thumb`,
    });
  }
  res.status(201).json({ photos: saved });
});

function servePhoto(kind) {
  return (req, res) => {
    const photo = db
      .prepare("SELECT * FROM photos WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.user.id);
    if (!photo) return res.status(404).json({ error: "Photo not found." });
    const name = kind === "thumb" ? photo.thumb_filename : photo.filename;
    const filePath = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Photo file is missing." });
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.type("image/jpeg").sendFile(filePath);
  };
}

photosRouter.get("/photos/:id/file", servePhoto("full"));
photosRouter.get("/photos/:id/thumb", servePhoto("thumb"));

photosRouter.delete("/photos/:id", (req, res) => {
  const photo = db
    .prepare("SELECT * FROM photos WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!photo) return res.status(404).json({ error: "Photo not found." });

  db.prepare("DELETE FROM photos WHERE id = ?").run(photo.id);
  for (const name of [photo.filename, photo.thumb_filename]) {
    fs.promises.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
  }
  res.json({ ok: true });
});
