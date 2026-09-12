import { describe, expect, it } from "vitest";
import {
  MEDIA_BUYING_SYSTEM_PROMPT,
  META_KNOWLEDGE_CONTEXT,
} from "./mediaBuyingAi";

describe("AI Media Buying contract", () => {
  it("requires evidence-based analysis and explicit execution boundaries", () => {
    expect(MEDIA_BUYING_SYSTEM_PROMPT).toContain("لا تخترع بيانات");
    expect(MEDIA_BUYING_SYSTEM_PROMPT).toContain("لا تعد بإنشاء أو نشر حملة");
    expect(MEDIA_BUYING_SYSTEM_PROMPT).toContain("Reach");
    expect(MEDIA_BUYING_SYSTEM_PROMPT).toContain("Clicks (all)");
    expect(MEDIA_BUYING_SYSTEM_PROMPT).toContain("Link clicks");
  });
  it("exposes the discovered MCP write tools behind approval", async () => {
    const source = await import("./mediaBuyingAi");
    expect(source.MEDIA_BUYING_SYSTEM_PROMPT).toContain("بوابة الموافقة");
    expect(source.MEDIA_BUYING_SYSTEM_PROMPT).toContain("مسودة");
  });
  it("includes dated official Meta knowledge context", () => {
    expect(META_KNOWLEDGE_CONTEXT).toContain("2026-08-27");
    expect(META_KNOWLEDGE_CONTEXT).toContain("developers.facebook.com");
  });
});
