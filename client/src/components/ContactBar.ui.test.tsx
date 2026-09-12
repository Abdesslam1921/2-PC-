/* @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());
import { ContactBar } from "./ContactBar";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    contactBar: {
      publicForProduct: {
        useQuery: () => ({
          data: {
            enabled: true,
            phoneEnabled: true,
            phoneNumber: "0540248226",
            phoneSticky: true,
            whatsappEnabled: true,
            whatsappNumber: "0662774443",
            whatsappSticky: true,
            showOnStore: true,
            showOnProduct: true,
            showOnLanding: true,
          },
        }),
      },
    },
  },
}));

describe("ContactBar", () => {
  it("renders enabled phone and WhatsApp actions with safe links", () => {
    render(<ContactBar productId={7} surface="product" />);
    expect(screen.getByRole("region", { name: "طرق التواصل" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "الاتصال بالمتجر" }).getAttribute("href")
    ).toBe("tel:+213540248226");
    expect(
      screen
        .getByRole("link", { name: "التواصل عبر WhatsApp" })
        .getAttribute("href")
    ).toBe("https://wa.me/213662774443");
  });

  it("can be dismissed without changing saved settings", () => {
    render(<ContactBar productId={7} surface="store" />);
    fireEvent.click(screen.getByRole("button", { name: "إخفاء شريط الاتصال" }));
    expect(screen.queryByRole("region", { name: "طرق التواصل" })).toBeNull();
  });
});
