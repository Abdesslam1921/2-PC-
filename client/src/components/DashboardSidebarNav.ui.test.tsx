/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The sidebar keeps each section's sub-navigation collapsed until its main tab
 * is opened: the sub-tabs appear only for the section you are on. This guards
 * that accordion behaviour.
 */
const mocks = vi.hoisted(() => ({ location: "/orders" }));

vi.mock("wouter", () => ({
  useLocation: () => [mocks.location, vi.fn()],
  useSearch: () => "",
}));

vi.mock("@/lib/trpc", () => ({
  trpc: new Proxy(
    {},
    { get: () => new Proxy({}, { get: () => () => ({}) }) }
  ),
}));

import { NavigationLinks } from "./DashboardLayout";

const ORDERS = ["الطلبات العامة", "طلباتي", "الطلبات المتروكة"];
const PRODUCTS = [
  "المنتجات العامة",
  "المنتجات المادية",
  "المنتجات الرقمية",
  "إنشاء منتج مادي",
  "إنشاء منتج رقمي",
];
const OFFERS = ["العروض العامة", "الباقات", "خصم الكمية", "Upsell"];

function renderAt(location: string) {
  mocks.location = location;
  cleanup();
  render(<NavigationLinks />);
}

describe("Dashboard sidebar sub-navigation (accordion)", () => {
  afterEach(() => cleanup());

  it("shows the Orders sub-tabs only on the orders section", () => {
    renderAt("/orders");
    for (const label of ORDERS) expect(screen.getByText(label)).toBeTruthy();
    for (const label of PRODUCTS) expect(screen.queryByText(label)).toBeNull();
    expect(screen.queryByText("الباقات")).toBeNull();
  });

  it("reveals the Products sub-tabs when the Products tab is open", () => {
    renderAt("/products");
    for (const label of PRODUCTS) expect(screen.getByText(label)).toBeTruthy();
    for (const label of ORDERS) expect(screen.queryByText(label)).toBeNull();
    expect(screen.queryByText("الباقات")).toBeNull();
  });

  it("keeps the Products sub-tabs open on the create page", () => {
    renderAt("/products/create");
    expect(screen.getByText("إنشاء منتج رقمي")).toBeTruthy();
  });

  it("reveals the Offers sub-tabs only on the offers section", () => {
    renderAt("/offers");
    for (const label of OFFERS) expect(screen.getByText(label)).toBeTruthy();
    for (const label of ORDERS) expect(screen.queryByText(label)).toBeNull();
  });
});
