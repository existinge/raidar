import { describe, it, expect } from "vitest";
import { validateSignalItem } from "./contracts.js";
import { SignalItem } from "./types.js";

describe("Signal Item Validation Contracts", () => {
  it("should pass for a fully compliant signal item", () => {
    const item: SignalItem = {
      id: "valid-id",
      name: "Valid Tool",
      description: "A very helpful AI tool.",
      type: "Repository",
      source: "GitHub",
      url: "https://github.com/example/valid-tool",
      tags: ["ai", "tool"],
      workspaceFit: 0,
      score: 0
    };

    const result = validateSignalItem(item);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation if name, description, or source is missing", () => {
    const item: Partial<SignalItem> = {
      id: "test-id",
      url: "https://github.com/example/tool",
      tags: []
    };

    const result = validateSignalItem(item as SignalItem);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing item name.");
    expect(result.errors).toContain("Missing item description.");
    expect(result.errors).toContain("Missing source citation (source name must be specified).");
  });

  it("should fail validation if URL is missing, malformed, or has non-HTTP/HTTPS protocol", () => {
    const baseItem: SignalItem = {
      id: "test-id",
      name: "Test Name",
      description: "Test Desc",
      type: "Repository",
      source: "Manual",
      url: "",
      tags: [],
      workspaceFit: 0,
      score: 0
    };

    // Missing URL
    let result = validateSignalItem(baseItem);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing source URL citation.");

    // Malformed URL
    baseItem.url = "not-a-url";
    result = validateSignalItem(baseItem);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Invalid source URL format");

    // Invalid protocol
    baseItem.url = "ftp://github.com/example/tool";
    result = validateSignalItem(baseItem);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Invalid source URL protocol: ftp:");
  });
});
