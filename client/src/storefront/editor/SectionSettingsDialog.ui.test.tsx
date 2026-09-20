/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { SectionSettingsDialog } from "./SectionSettingsDialog";
import { ContentPanel } from "./ContentPanel";
import {
  DEFAULT_MODERN_CONFIG,
  type StorefrontConfig,
} from "@shared/storefront/storefrontConfig";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    storefront: {
      uploadAsset: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(cleanup);

// jsdom has no layout: stub the scroll used when focusing a clicked field.
Element.prototype.scrollIntoView = vi.fn();

const config = (): StorefrontConfig =>
  JSON.parse(JSON.stringify(DEFAULT_MODERN_CONFIG)) as StorefrontConfig;

describe("SectionSettingsDialog", () => {
  it("renders the section content fields and the grouped overrides", () => {
    const cfg = config();
    const announcement = cfg.sections.find(s => s.type === "announcement")!;
    render(
      <SectionSettingsDialog
        config={cfg}
        onChange={() => {}}
        sectionId={announcement.id}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("إعدادات القسم")).toBeTruthy();
    expect(screen.getByText("نص الإعلان")).toBeTruthy();
    expect(screen.getByText("خلفية القسم")).toBeTruthy();
    expect(screen.getByText("النص والخط")).toBeTruthy();
    expect(screen.getByText("الحدود والحواف")).toBeTruthy();
    expect(screen.getByText("الحشوة")).toBeTruthy();
  });

  it("focuses the exact field that was clicked in the preview", async () => {
    const cfg = config();
    const announcement = cfg.sections.find(s => s.type === "announcement")!;
    const { container } = render(
      <SectionSettingsDialog
        config={cfg}
        onChange={() => {}}
        sectionId={announcement.id}
        focusField={{ sectionId: announcement.id, key: "text", nonce: 1 }}
        onClose={() => {}}
      />
    );
    const input = container.querySelector("input[type=text]") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
  });

  it("edits a section through the dialog (no inline settings in the panel)", () => {
    function Harness() {
      const [cfg, setCfg] = useState(config());
      const [openId, setOpenId] = useState<string | null>(null);
      return (
        <>
          <ContentPanel
            config={cfg}
            onChange={setCfg}
            selectedSectionId={openId}
            onSelectSection={setOpenId}
            onEditSection={setOpenId}
          />
          {openId ? (
            <SectionSettingsDialog
              config={cfg}
              onChange={setCfg}
              sectionId={openId}
              onClose={() => setOpenId(null)}
            />
          ) : null}
        </>
      );
    }
    render(<Harness />);
    // no inline settings before editing
    expect(screen.queryByText("إعدادات القسم")).toBeNull();

    const row = screen.getByText("الإعلان").closest("[role=button]") as HTMLElement;
    fireEvent.click(row);
    expect(screen.getByText("إعدادات القسم")).toBeTruthy();

    // The first text input is the section's own content field.
    const textInput = document.querySelector(
      'section[role="dialog"] input[type="text"]'
    ) as HTMLInputElement;
    expect(textInput).toBeTruthy();
    fireEvent.change(textInput, { target: { value: "نص جديد" } });
    expect(textInput.value).toBe("نص جديد");

    fireEvent.click(screen.getByText("تم"));
    expect(screen.queryByText("إعدادات القسم")).toBeNull();
  });

  it("drops the stored background when the type returns to the template default", () => {
    function Harness() {
      const [cfg, setCfg] = useState(config());
      return (
        <SectionSettingsDialog
          config={cfg}
          onChange={setCfg}
          sectionId={cfg.sections[0].id}
          onClose={() => {}}
        />
      );
    }
    const { container } = render(<Harness />);

    const modeSelect = (Array.from(container.querySelectorAll("select")) as HTMLSelectElement[]).find(
      el => Array.from(el.options).some(option => option.value === "solid")
    )!;
    expect(modeSelect).toBeTruthy();

    // pick "لون صلب" then a color (the first ltr text input is the background)
    fireEvent.change(modeSelect, { target: { value: "solid" } });
    const colorInputs = Array.from(
      container.querySelectorAll('input[type="text"][dir="ltr"]')
    ) as HTMLInputElement[];
    const bgInput = colorInputs[0];
    expect(bgInput).toBeTruthy();
    fireEvent.change(bgInput, { target: { value: "#101010" } });
    const valuesAfterPick = Array.from(container.querySelectorAll("input")).map(
      input => (input as HTMLInputElement).value.toLowerCase()
    );
    expect(valuesAfterPick).toContain("#101010");

    // back to "افتراضي القالب" → the stored color must be gone, not just hidden
    fireEvent.change(modeSelect, { target: { value: "" } });
    const valuesAfterReset = Array.from(container.querySelectorAll("input")).map(
      input => (input as HTMLInputElement).value.toLowerCase()
    );
    expect(valuesAfterReset).not.toContain("#101010");
  });
});
