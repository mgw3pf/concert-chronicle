import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PORT, IS_PROD } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { concertsRouter } from "./routes/concerts.js";
import { photosRouter } from "./routes/photos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Baseline security headers (no extra dependency needed for these).
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api", catalogRouter);
  app.use("/api/concerts", concertsRouter);
  app.use("/api", photosRouter);

  // In production the built client is served by this same process, which keeps
  // hosting to a single cheap container. In development, Vite proxies /api here.
  const clientDist = path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/).*/, (req, res) =>
      res.sendFile(path.join(clientDist, "index.html"))
    );
  }

  app.use((req, res) => res.status(404).json({ error: "Not found." }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.name === "MulterError") {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "That photo is larger than the 10 MB limit."
          : "Upload failed. Check the files and try again.";
      return res.status(400).json({ error: message });
    }
    if (err?.message === "Only image files are supported.")
      return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });

  return app;
}

// Only listen when run directly (tests import createApp instead).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(
      `Concert Chronicle API listening on http://localhost:${PORT} (${IS_PROD ? "production" : "development"})`
    );
  });
}
