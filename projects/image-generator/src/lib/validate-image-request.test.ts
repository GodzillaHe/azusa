import { describe, expect, it } from "vitest";
import { validateImageRequest } from "./validate-image-request";

describe("validateImageRequest", () => {
  it("accepts a valid payload", () => {
    expect(
      validateImageRequest({
        prompt: "A futuristic city skyline",
        size: "1024x1536",
        count: 2,
        quality: "high",
        style: "vivid",
      }),
    ).toEqual({
      ok: true,
      data: {
        prompt: "A futuristic city skyline",
        size: "1024x1536",
        count: 2,
        quality: "high",
        style: "vivid",
      },
    });
  });

  it("rejects an empty prompt", () => {
    expect(validateImageRequest({ prompt: "   " })).toEqual({
      ok: false,
      error: "Prompt is required.",
    });
  });

  it("applies defaults", () => {
    expect(validateImageRequest({ prompt: "A watercolor mountain" })).toEqual({
      ok: true,
      data: {
        prompt: "A watercolor mountain",
        size: "1024x1024",
        count: 1,
        quality: "auto",
        style: "auto",
      },
    });
  });

  it("rejects an invalid explicit count", () => {
    expect(validateImageRequest({ prompt: "A robot", count: 5 })).toEqual({
      ok: false,
      error: "Number of images must be between 1 and 4.",
    });
  });
});
