/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PublishedHealthBanner } from "./PublishedHealthBanner";

afterEach(cleanup);

describe("PublishedHealthBanner", () => {
  it("warns the merchant and names the served fallback version", () => {
    render(
      <PublishedHealthBanner
        health={{ ok: false, latestVersionNumber: 7, servedVersionNumber: 5 }}
      />
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("النسخة المنشورة فاسدة");
    expect(alert.textContent).toContain("v5");
  });

  it("mentions the Modern fallback when no earlier version is valid", () => {
    render(
      <PublishedHealthBanner
        health={{ ok: false, latestVersionNumber: 7, servedVersionNumber: null }}
      />
    );
    expect(screen.getByRole("alert").textContent).toContain("Modern");
  });

  it("shows nothing when the published version is healthy", () => {
    render(
      <PublishedHealthBanner
        health={{ ok: true, latestVersionNumber: 7, servedVersionNumber: 7 }}
      />
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows nothing when there is no published history", () => {
    render(<PublishedHealthBanner health={undefined} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
