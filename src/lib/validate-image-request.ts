import {
  IMAGE_COUNTS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  IMAGE_STYLES,
  type ImageCount,
  type ImageQuality,
  type ImageRequest,
  type ImageSize,
  type ImageStyle,
} from "./image-options";

type ValidationResult =
  | { ok: true; data: ImageRequest }
  | { ok: false; error: string };

const DEFAULT_SIZE: ImageSize = "1024x1024";
const DEFAULT_COUNT: ImageCount = 1;
const DEFAULT_QUALITY: ImageQuality = "auto";
const DEFAULT_STYLE: ImageStyle = "auto";

function isObject(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload);
}

function includesValue<T extends readonly unknown[]>(values: T, value: unknown): value is T[number] {
  return values.includes(value);
}

export function validateImageRequest(payload: unknown): ValidationResult {
  if (!isObject(payload)) {
    return { ok: false, error: "Request body must be an object." };
  }

  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  if (!prompt) {
    return { ok: false, error: "Prompt is required." };
  }

  const count = payload.count ?? DEFAULT_COUNT;
  if (!includesValue(IMAGE_COUNTS, count)) {
    return { ok: false, error: "Number of images must be between 1 and 4." };
  }

  const size = payload.size ?? DEFAULT_SIZE;
  if (!includesValue(IMAGE_SIZES, size)) {
    return { ok: false, error: "Invalid image size." };
  }

  const quality = payload.quality ?? DEFAULT_QUALITY;
  if (!includesValue(IMAGE_QUALITIES, quality)) {
    return { ok: false, error: "Invalid image quality." };
  }

  const style = payload.style ?? DEFAULT_STYLE;
  if (!includesValue(IMAGE_STYLES, style)) {
    return { ok: false, error: "Invalid image style." };
  }

  return {
    ok: true,
    data: {
      prompt,
      size,
      count,
      quality,
      style,
    },
  };
}
