import jwt from "jsonwebtoken";
import { JWT_SECRET, COOKIE_NAME } from "../config.js";

/** Attaches req.user = { id, email } or responds 401. */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not signed in." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Sign in again." });
  }
}
