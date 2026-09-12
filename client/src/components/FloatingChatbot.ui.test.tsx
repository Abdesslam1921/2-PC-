// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FloatingChatbot from "./FloatingChatbot";

const sent = vi.fn();
const sentOwner = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    chatbot: {
      owner: {
        useMutation: (options: { onSuccess: (content: string) => void }) => ({
          mutate: (input: unknown) => {
            sentOwner(input);
            options.onSuccess("بيانات الربحية متاحة من لوحة المتجر.");
          },
          isPending: false,
        }),
      },
      buyer: {
        useMutation: (options: { onSuccess: (content: string) => void }) => ({
          mutate: (input: unknown) => {
            sent(input);
            options.onSuccess("يمكنني مساعدتك في معرفة المنتجات المتوفرة.");
          },
          isPending: false,
        }),
      },
    },
  },
}));

describe("FloatingChatbot", () => {
  it("opens the buyer assistant and sends a conversation message", () => {
    render(<FloatingChatbot audience="buyer" />);
    fireEvent.click(screen.getByRole("button", { name: "فتح الشاتبوت" }));
    expect(screen.getByText("مساعد التسوق")).toBeTruthy();
    const input = screen.getByPlaceholderText("اكتب سؤالك عن المنتجات...");
    fireEvent.change(input, { target: { value: "هل يوجد منتج متوفر؟" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(sent).toHaveBeenCalledWith({
      messages: expect.arrayContaining([
        { role: "user", content: "هل يوجد منتج متوفر؟" },
      ]),
    });
    expect(
      screen.getByText("يمكنني مساعدتك في معرفة المنتجات المتوفرة.")
    ).toBeTruthy();
  });

  it("opens the owner assistant with the management context", () => {
    render(<FloatingChatbot audience="owner" />);
    fireEvent.click(screen.getByRole("button", { name: "فتح الشاتبوت" }));
    expect(screen.getByText("مساعد صاحب المتجر")).toBeTruthy();
    const input = screen.getByPlaceholderText("اسأل عن إدارة متجرك...");
    fireEvent.change(input, { target: { value: "ما حالة الربحية؟" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(sentOwner).toHaveBeenCalledWith({
      messages: expect.arrayContaining([
        { role: "user", content: "ما حالة الربحية؟" },
      ]),
    });
    expect(
      screen.getByText("بيانات الربحية متاحة من لوحة المتجر.")
    ).toBeTruthy();
  });
});
