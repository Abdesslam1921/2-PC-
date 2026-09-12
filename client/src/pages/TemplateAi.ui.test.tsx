// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TemplateAi from "./TemplateAi";

const mutate = vi.fn();
const saveMutate = vi.fn();

vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/templates">{children}</a>
  ),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    templates: {
      save: { useMutation: () => ({ mutate: saveMutate, isPending: false }) },
      generate: {
        useMutation: ({
          onSuccess,
        }: {
          onSuccess: (value: unknown) => void;
        }) => ({
          mutate: (input: unknown) => {
            mutate(input);
            onSuccess({
              name: "قالب العناية",
              description: "هوية دافئة لمتجر العناية الطبيعية.",
              primaryColor: "#55724c",
              accentColor: "#f4ead7",
              fontFamily: "Cairo",
              sections: ["hero", "categories", "featured_products"],
              previewOnly: true,
            });
          },
          isPending: false,
          error: null,
        }),
      },
    },
  },
}));

describe("TemplateAi", () => {
  it("submits a prompt and renders a structured preview", () => {
    render(<TemplateAi />);
    const input = screen.getByPlaceholderText(/متجر جزائري/);
    fireEvent.change(input, {
      target: { value: "متجر جزائري للعناية الطبيعية بألوان زيتونية وذهبية" },
    });
    fireEvent.click(screen.getByRole("button", { name: /توليد التصور/ }));
    expect(mutate).toHaveBeenCalledWith({
      prompt: "متجر جزائري للعناية الطبيعية بألوان زيتونية وذهبية",
    });
    expect(screen.getByText("قالب العناية")).toBeTruthy();
    expect(screen.getByText("معاينة فقط")).toBeTruthy();
    expect(screen.getByText("المنتجات المميزة")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /حفظ وتفعيل القالب/ }));
    expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        customization: expect.objectContaining({
          primaryColor: "#55724c",
          showTrustBadges: false,
        }),
      })
    );
  });
});
