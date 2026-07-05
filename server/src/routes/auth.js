import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { JWT_SECRET, TOKEN_TTL, COOKIE_NAME, IS_PROD } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: IS_PROD,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

function publicUser(row) {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

authRouter.post("/register", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.displayName || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (!displayName)
    return res.status(400).json({ error: "Enter a display name." });

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "An account with that email already exists." });

  const hash = await bcrypt.hash(password, 12);
  const info = db
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)")
    .run(email, hash, displayName);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);

  issueSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) return res.status(401).json({ error: "Email or password is incorrect." });

  issueSession(res, user);
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: publicUser(user) });
});
