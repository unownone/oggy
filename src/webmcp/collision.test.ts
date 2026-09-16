import { describe, it, expect } from "vitest";
import { uniqueToolName } from "@/webmcp";

describe("uniqueToolName", () => {
  it("returns the desired name when no collision", () => {
    expect(uniqueToolName("search", ["add_todo", "delete_item"])).toBe("search");
  });

  it("suffixes _oggy on first collision", () => {
    expect(uniqueToolName("search", ["search"])).toBe("search_oggy");
  });

  it("suffixes _oggy_2 when _oggy is also taken", () => {
    expect(uniqueToolName("search", ["search", "search_oggy"])).toBe("search_oggy_2");
  });

  it("increments counter when multiple collisions", () => {
    expect(
      uniqueToolName("search", ["search", "search_oggy", "search_oggy_2"]),
    ).toBe("search_oggy_3");
  });

  it("handles empty existing array", () => {
    expect(uniqueToolName("my_tool", [])).toBe("my_tool");
  });
});
