import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isDevLoginEnabled, registerDevLoginRoute } from "./_core/devLogin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("developer login", () => {
  it("is enabled only for NODE_ENV=development", () => {
    expect(isDevLoginEnabled("development")).toBe(true);
    expect(isDevLoginEnabled("production")).toBe(false);
    expect(isDevLoginEnabled("test")).toBe(false);
    expect(isDevLoginEnabled(undefined)).toBe(false);
    expect(isDevLoginEnabled("")).toBe(false);
  });

  it("does not register the route outside development", () => {
    const app = { get: vi.fn() };
    vi.stubEnv("NODE_ENV", "production");
    registerDevLoginRoute(app as never);
    expect(app.get).not.toHaveBeenCalled();

    vi.stubEnv("NODE_ENV", "development");
    registerDevLoginRoute(app as never);
    expect(app.get).toHaveBeenCalledWith(
      "/api/auth/dev-login",
      expect.any(Function)
    );
  });

  it("is wired through the guarded registrar (source guard)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "server", "_core", "index.ts"),
      "utf8"
    );
    expect(source).toContain("registerDevLoginRoute(app)");
    expect(source).not.toMatch(/app\.get\(\s*["']\/api\/auth\/dev-login/);
  });
});
