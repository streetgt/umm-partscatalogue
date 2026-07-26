import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { catalogueRouter } from "./catalogue.js";

const app = express();
app.use("/api", catalogueRouter);

describe("GET /api/brands", () => {
  it("returns brands with their models", async () => {
    const res = await request(app).get("/api/brands");
    expect(res.status).toBe(200);
    const alter = res.body.find((b: { slug: string }) => b.slug === "alter");
    expect(alter).toBeDefined();
    expect(alter.models.some((m: { slug: string }) => m.slug === "2000")).toBe(true);
  });
});

describe("GET /api/brands/:brandSlug/models/:modelSlug/groups", () => {
  it("returns 18 groups for alter/2000", async () => {
    const res = await request(app).get("/api/brands/alter/models/2000/groups");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(18);
  });

  it("returns 404 for an unknown model", async () => {
    const res = await request(app).get("/api/brands/alter/models/nope/groups");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/brands/:brandSlug/models/:modelSlug/groups/:code", () => {
  it("returns the group with its parts in sort_order", async () => {
    const res = await request(app).get("/api/brands/alter/models/2000/groups/03.1.D");
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("03.1.D");
    expect(res.body.parts[5].itemNumber).toBe("8");
  });
});

describe("GET /api/search", () => {
  it("matches by designacao substring", async () => {
    const res = await request(app).get("/api/search").query({ q: "RADIADOR" });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("groupCode");
  });

  it("matches by cod_ckd or cod_sobres", async () => {
    const res = await request(app).get("/api/search").query({ q: "1224300" });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
