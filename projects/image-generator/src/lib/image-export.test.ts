import { describe, expect, it } from "vitest";
import { clampCropRect, createAspectCrop, createCenteredCrop, resizeCropRect } from "./image-export";

describe("clampCropRect", () => {
  it("keeps a crop that fits inside the source image", () => {
    expect(clampCropRect({ x: 10, y: 20, width: 100, height: 80 }, 200, 150)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 80,
    });
  });

  it("moves an overflowing crop back inside the source image", () => {
    expect(clampCropRect({ x: 150, y: 125, width: 80, height: 50 }, 200, 150)).toEqual({
      x: 120,
      y: 100,
      width: 80,
      height: 50,
    });
  });

  it("limits oversized crops to the source dimensions", () => {
    expect(clampCropRect({ x: -20, y: -10, width: 250, height: 200 }, 200, 150)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 150,
    });
  });

  it("prevents negative crop dimensions", () => {
    expect(clampCropRect({ x: 10, y: 10, width: -40, height: -30 }, 200, 150)).toEqual({
      x: 10,
      y: 10,
      width: 0,
      height: 0,
    });
  });

  it("returns an empty crop when source dimensions are zero", () => {
    expect(clampCropRect({ x: 10, y: 10, width: 40, height: 30 }, 0, 0)).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });
});

describe("createCenteredCrop", () => {
  it("creates a centered square crop from a landscape source", () => {
    expect(createCenteredCrop(400, 200)).toEqual({
      x: 100,
      y: 0,
      width: 200,
      height: 200,
    });
  });

  it("creates a centered square crop from a portrait source", () => {
    expect(createCenteredCrop(200, 400)).toEqual({
      x: 0,
      y: 100,
      width: 200,
      height: 200,
    });
  });
});

describe("createAspectCrop", () => {
  it("uses full width when the source is narrower than the requested aspect ratio", () => {
    expect(createAspectCrop(400, 400, 16 / 9)).toEqual({
      x: 0,
      y: 87.5,
      width: 400,
      height: 225,
    });
  });

  it("uses full height when the source is wider than the requested aspect ratio", () => {
    expect(createAspectCrop(400, 200, 1)).toEqual({
      x: 100,
      y: 0,
      width: 200,
      height: 200,
    });
  });

  it("returns an empty crop for invalid dimensions or aspect ratios", () => {
    expect(createAspectCrop(0, 200, 1)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(createAspectCrop(200, 200, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("resizeCropRect", () => {
  const crop = { x: 50, y: 40, width: 100, height: 80 };

  it("resizes from the east handle", () => {
    expect(
      resizeCropRect({ crop, handle: "e", deltaX: 25, deltaY: 0, imageWidth: 300, imageHeight: 200, minSize: 20, preserveAspect: false }),
    ).toEqual({ x: 50, y: 40, width: 125, height: 80 });
  });

  it("resizes from the west handle", () => {
    expect(
      resizeCropRect({ crop, handle: "w", deltaX: -20, deltaY: 0, imageWidth: 300, imageHeight: 200, minSize: 20, preserveAspect: false }),
    ).toEqual({ x: 30, y: 40, width: 120, height: 80 });
  });

  it("resizes from the north handle", () => {
    expect(
      resizeCropRect({ crop, handle: "n", deltaX: 0, deltaY: -15, imageWidth: 300, imageHeight: 200, minSize: 20, preserveAspect: false }),
    ).toEqual({ x: 50, y: 25, width: 100, height: 95 });
  });

  it("resizes from the south handle", () => {
    expect(
      resizeCropRect({ crop, handle: "s", deltaX: 0, deltaY: 30, imageWidth: 300, imageHeight: 200, minSize: 20, preserveAspect: false }),
    ).toEqual({ x: 50, y: 40, width: 100, height: 110 });
  });

  it("resizes from a corner handle", () => {
    expect(
      resizeCropRect({ crop, handle: "se", deltaX: 30, deltaY: 25, imageWidth: 300, imageHeight: 200, minSize: 20, preserveAspect: false }),
    ).toEqual({ x: 50, y: 40, width: 130, height: 105 });
  });

  it("keeps resized crops inside image bounds", () => {
    expect(
      resizeCropRect({ crop, handle: "se", deltaX: 500, deltaY: 500, imageWidth: 180, imageHeight: 130, minSize: 20, preserveAspect: false }),
    ).toEqual({ x: 50, y: 40, width: 130, height: 90 });
  });

  it("does not resize below the minimum size", () => {
    expect(
      resizeCropRect({ crop, handle: "nw", deltaX: 200, deltaY: 200, imageWidth: 300, imageHeight: 200, minSize: 40, preserveAspect: false }),
    ).toEqual({ x: 110, y: 80, width: 40, height: 40 });
  });

  it("preserves aspect ratio when resizing from a corner", () => {
    const resized = resizeCropRect({ crop, handle: "se", deltaX: 50, deltaY: 10, imageWidth: 300, imageHeight: 200, minSize: 20, preserveAspect: true });

    expect(resized).toEqual({ x: 50, y: 40, width: 150, height: 120 });
    expect(resized.width / resized.height).toBe(crop.width / crop.height);
  });

  it("preserves aspect ratio from an edge handle by resizing around center where possible", () => {
    const resized = resizeCropRect({ crop, handle: "e", deltaX: 50, deltaY: 0, imageWidth: 300, imageHeight: 200, minSize: 20, preserveAspect: true });

    expect(resized).toEqual({ x: 50, y: 20, width: 150, height: 120 });
    expect(resized.width / resized.height).toBe(crop.width / crop.height);
  });
});
