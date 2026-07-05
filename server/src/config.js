import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Root directory for all persistent data (SQLite DB + uploaded photos).
 *  Point DATA_DIR at a mounted volume in production. */
export const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, "../../data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "concert-chronicle.db");

export const PORT = Number(process.env.PORT || 3001);
export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PROD = NODE_ENV === "production";

/** In production, require an explicit secret; in dev, generate an ephemeral one. */
export const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (IS_PROD) {
    throw new Error("JWT_SECRET must be set in production (see .env.example).");
  }
  return crypto.randomBytes(32).toString("hex");
})();

export const TOKEN_TTL = process.env.TOKEN_TTL || "7d";
export const COOKIE_NAME = "cc_token";

/** Upload limits */
export const MAX_PHOTO_BYTES = Number(process.env.MAX_PHOTO_BYTES || 10 * 1024 * 1024); // 10 MB
export const MAX_PHOTOS_PER_REQUEST = 10;

for (const dir of [DATA_DIR, UPLOAD_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
