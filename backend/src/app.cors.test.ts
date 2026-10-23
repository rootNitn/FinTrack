jest.mock("./modules/router", () => ({ apiRouter: require("express").Router() }));
import request from "supertest";
import { createApp } from "./app";
import { env } from "./config/env";

describe("Android spike CORS", () => {
  const originalMode = env.NODE_ENV;
  const originalOrigin = env.CORS_ORIGIN;
  afterEach(() => { env.NODE_ENV = originalMode; env.CORS_ORIGIN = originalOrigin; });
  test("allows the packaged localhost origin only in development", async () => {
    env.NODE_ENV = "development";
    env.CORS_ORIGIN = "http://localhost:4200";
    const response = await request(createApp()).get("/health").set("Origin", "http://localhost");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost");
  });
  test("allows a private-LAN Angular dev-server origin in development", async () => {
    env.NODE_ENV = "development";
    env.CORS_ORIGIN = "http://localhost:4200";
    const response = await request(createApp()).get("/health").set("Origin", "http://192.168.29.202:4200");
    expect(response.headers["access-control-allow-origin"]).toBe("http://192.168.29.202:4200");
  });
  test("keeps the configured production allowlist", async () => {
    env.NODE_ENV = "production";
    env.CORS_ORIGIN = "https://lifetrack.example";
    const blocked = await request(createApp()).get("/health").set("Origin", "http://localhost");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
    const allowed = await request(createApp()).get("/health").set("Origin", "https://lifetrack.example");
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://lifetrack.example");
  });

  test("allows the external resources required by the web app", async () => {
    const response = await request(createApp()).get("/health");
    const policy = response.headers["content-security-policy"] as string;
    expect(policy).toContain("https://accounts.google.com");
    expect(policy).toContain("https://fonts.googleapis.com");
    expect(policy).toContain("https://fonts.gstatic.com");
  });
});