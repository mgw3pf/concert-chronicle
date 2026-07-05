import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate each test run in a throwaway data directory.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cc-test-"));
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/index.js");
const request = (await import("supertest")).default;

const app = createApp();
const agent = request.agent(app);

test("health check responds", async () => {
  const res = await agent.get("/api/health");
  assert.equal(res.status, 200);
});

test("rejects weak registration input", async () => {
  const res = await agent
    .post("/api/auth/register")
    .send({ email: "bad", password: "short", displayName: "" });
  assert.equal(res.status, 400);
});

test("registers a user and starts a session", async () => {
  const res = await agent
    .post("/api/auth/register")
    .send({ email: "mike@example.com", password: "correct-horse-1", displayName: "Mike" });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.displayName, "Mike");

  const me = await agent.get("/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, "mike@example.com");
});

test("requires auth for concert routes", async () => {
  const res = await request(app).get("/api/concerts");
  assert.equal(res.status, 401);
});

let venueId, artistId, concertId;

test("creates venues and artists (create-or-get)", async () => {
  const v1 = await agent
    .post("/api/venues")
    .send({ name: "9:30 Club", city: "Washington", region: "DC", country: "USA" });
  assert.equal(v1.status, 201);
  venueId = v1.body.venue.id;

  const v2 = await agent
    .post("/api/venues")
    .send({ name: "9:30 club", city: "washington" });
  assert.equal(v2.status, 200);
  assert.equal(v2.body.venue.id, venueId, "duplicate venue should return the existing row");

  const a1 = await agent.post("/api/artists").send({ name: "The National" });
  assert.equal(a1.status, 201);
  artistId = a1.body.artist.id;
});

test("creates, reads, updates, deletes a concert", async () => {
  const created = await agent.post("/api/concerts").send({
    date: "2026-06-12",
    venueId,
    artistIds: [artistId],
    notes: "Great encore.",
    rating: 5,
  });
  assert.equal(created.status, 201);
  concertId = created.body.concert.id;
  assert.equal(created.body.concert.venue.name, "9:30 Club");
  assert.equal(created.body.concert.artists[0].name, "The National");

  const list = await agent.get("/api/concerts");
  assert.equal(list.body.concerts.length, 1);

  const updated = await agent.put(`/api/concerts/${concertId}`).send({
    date: "2026-06-13",
    venueId,
    artistIds: [artistId],
    notes: "Corrected date.",
    rating: 4,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.concert.date, "2026-06-13");

  const deleted = await agent.delete(`/api/concerts/${concertId}`);
  assert.equal(deleted.status, 200);
  const after = await agent.get(`/api/concerts/${concertId}`);
  assert.equal(after.status, 404);
});

test("uploads and serves a photo", async () => {
  // Recreate a concert to attach photos to.
  const created = await agent.post("/api/concerts").send({
    date: "2026-07-01",
    venueId,
    artistIds: [artistId],
  });
  const id = created.body.concert.id;

  // Generate a real image in-memory with sharp so the pipeline is fully exercised.
  const sharp = (await import("sharp")).default;
  const png = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 40, b: 60 } },
  })
    .png()
    .toBuffer();

  const uploaded = await agent
    .post(`/api/concerts/${id}/photos`)
    .attach("photos", png, "stage.png");
  assert.equal(uploaded.status, 201);
  const photo = uploaded.body.photos[0];

  const full = await agent.get(photo.url);
  assert.equal(full.status, 200);
  assert.equal(full.headers["content-type"], "image/jpeg");

  const thumb = await agent.get(photo.thumbUrl);
  assert.equal(thumb.status, 200);

  const gone = await agent.delete(`/api/photos/${photo.id}`);
  assert.equal(gone.status, 200);
});

test("rejects non-image uploads", async () => {
  const created = await agent.post("/api/concerts").send({
    date: "2026-07-02",
    venueId,
    artistIds: [artistId],
  });
  const res = await agent
    .post(`/api/concerts/${created.body.concert.id}/photos`)
    .attach("photos", Buffer.from("definitely not an image"), {
      filename: "malware.exe",
      contentType: "application/octet-stream",
    });
  assert.equal(res.status, 400);
});
