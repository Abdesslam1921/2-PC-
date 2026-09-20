/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SectionShell } from "./SectionShell";

afterEach(cleanup);

const settings = {
  eyebrow: "جديد",
  title: "أناقة عملية",
  subtitle: "تشكيلة مختارة بعناية.",
  ctaLabel: "تسوق الآن",
};

function setup(onSelect = vi.fn()) {
  const view = render(
    <SectionShell id="hero" label="الواجهة" settings={settings} onSelect={onSelect}>
      <section>
        <span>{settings.eyebrow}</span>
        <h1>{settings.title}</h1>
        <p>{settings.subtitle}</p>
        <a href="#grid">{settings.ctaLabel}</a>
        <img alt="hero" src="/hero.jpg" />
      </section>
    </SectionShell>
  );
  return { view, onSelect };
}

describe("SectionShell field targeting", () => {
  it("resolves a clicked heading to the matching setting key", () => {
    const { view, onSelect } = setup();
    fireEvent.click(view.getByRole("heading", { level: 1 }));
    expect(onSelect).toHaveBeenCalledWith("hero", "title");
  });

  it("resolves a clicked paragraph and CTA label", () => {
    const { view, onSelect } = setup();
    fireEvent.click(view.getByText(settings.subtitle));
    expect(onSelect).toHaveBeenLastCalledWith("hero", "subtitle");
    fireEvent.click(view.getByText(settings.ctaLabel));
    expect(onSelect).toHaveBeenLastCalledWith("hero", "ctaLabel");
  });

  it("resolves a clicked image to the section image field", () => {
    const { view, onSelect } = setup();
    fireEvent.click(view.getByAltText("hero"));
    expect(onSelect).toHaveBeenLastCalledWith("hero", "imageUrl");
  });

  it("resolves a click on the section itself to its background override", () => {
    const { view, onSelect } = setup();
    fireEvent.click(view.container.querySelector("section") as HTMLElement);
    expect(onSelect).toHaveBeenLastCalledWith("hero", "styleBg");
  });

  it("selects the section without a field for content that maps to no setting", () => {
    const onSelect = vi.fn();
    const view = render(
      <SectionShell id="footer" label="التذييل" settings={{}} onSelect={onSelect}>
        <footer>
          <div>
            <span>حقوق محفوظة</span>
          </div>
        </footer>
      </SectionShell>
    );
    fireEvent.click(view.getByText("حقوق محفوظة").parentElement as HTMLElement);
    expect(onSelect).toHaveBeenLastCalledWith("footer", null);
  });

  it("never resolves a key that is not part of the section settings", () => {
    const onSelect = vi.fn();
    const view = render(
      <SectionShell
        id="footer"
        label="التذييل"
        settings={{ title: "تابعنا" }}
        onSelect={onSelect}
      >
        <footer>
          <span>حقوق محفوظة</span>
        </footer>
      </SectionShell>
    );
    fireEvent.click(view.getByText("حقوق محفوظة"));
    expect(onSelect).toHaveBeenLastCalledWith("footer", null);
  });
});
