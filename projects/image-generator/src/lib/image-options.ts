export const IMAGE_SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;
export const IMAGE_COUNTS = [1, 2, 3, 4] as const;
export const IMAGE_QUALITIES = ["auto", "low", "medium", "high"] as const;
export const IMAGE_STYLES = ["auto", "natural", "vivid"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];
export type ImageCount = (typeof IMAGE_COUNTS)[number];
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export type ImageRequest = {
  prompt: string;
  size: ImageSize;
  count: ImageCount;
  quality: ImageQuality;
  style: ImageStyle;
};
