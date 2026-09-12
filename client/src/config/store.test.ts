import { describe, expect, it } from "vitest";
import { storeConfig } from "./store";

describe("store presentation configuration", () => {
  it("keeps the editable brand configuration available", () => {
    expect(storeConfig.name).toBe("عبدو ستور");
    expect(storeConfig.shortName).toBe("ع");
  });
});
