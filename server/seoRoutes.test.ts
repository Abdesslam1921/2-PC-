import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { isPublicSeoPath, requestOrigin, requestPath } from "./seoRoutes";

describe("SEO route scope", () => {
  it("covers only customer-facing storefront paths", () => {
    ["/", "/store", "/store/", "/p/42", "/b/winter", "/store/category/shoes"].forEach(
      path => expect(isPublicSeoPath(path), path).toBe(true)
    );
    [
      "/dashboard",
      "/login",
      "/api/trpc",
      "/store/cart",
      "/store/checkout",
      "/store/builder",
      "/store/theme",
      "/store/editor",
      "/store/builder-legacy",
      "/random",
    ].forEach(path => expect(isPublicSeoPath(path), path).toBe(false));
  });

  it("builds a safe origin from forwarded headers", () => {
    const req = {
      headers: {
        host: "nour.abdou-store.com",
        "x-forwarded-proto": "https,http",
      },
      protocol: "http",
    } as unknown as Request;
    expect(requestOrigin(req)).toBe("https://nour.abdou-store.com");
  });

  it("ignores an invalid Host header", () => {
    const req = {
      headers: { host: "evil.example.com/<script>" },
      protocol: "https",
    } as unknown as Request;
    const origin = requestOrigin(req);
    expect(origin).toMatch(/^https:\/\/[a-z0-9.-]+$/i);
    expect(origin).not.toContain("<script>");
  });

  it("strips query/hash from the request path", () => {
    const req = {
      originalUrl: "/p/42?utm=fb#top",
      url: "/p/42?utm=fb#top",
    } as unknown as Request;
    expect(requestPath(req)).toBe("/p/42");
  });
});
