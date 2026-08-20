export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExportFormat = "image/png" | "image/jpeg" | "image/webp";

export type ExportFit = "contain" | "cover";

export type CropResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export type ExportImageDataUrlOptions = {
  sourceDataUrl: string;
  crop: CropRect;
  outputWidth: number;
  outputHeight: number;
  format: ExportFormat;
  quality?: number;
  fit: ExportFit;
  backgroundColor?: string;
};

export type ResizeCropRectOptions = {
  crop: CropRect;
  handle: CropResizeHandle;
  deltaX: number;
  deltaY: number;
  imageWidth: number;
  imageHeight: number;
  minSize: number;
  preserveAspect: boolean;
};

const DEFAULT_JPEG_BACKGROUND = "#ffffff";
const DEFAULT_TRANSPARENT_BACKGROUND = "rgba(0, 0, 0, 0)";

export function clampCropRect(crop: CropRect, sourceWidth: number, sourceHeight: number): CropRect {
  const safeSourceWidth = Math.max(0, sourceWidth);
  const safeSourceHeight = Math.max(0, sourceHeight);
  const width = Math.min(Math.max(0, crop.width), safeSourceWidth);
  const height = Math.min(Math.max(0, crop.height), safeSourceHeight);
  const x = Math.min(Math.max(0, crop.x), Math.max(0, safeSourceWidth - width));
  const y = Math.min(Math.max(0, crop.y), Math.max(0, safeSourceHeight - height));

  return { x, y, width, height };
}

export function createCenteredCrop(sourceWidth: number, sourceHeight: number): CropRect {
  return createAspectCrop(sourceWidth, sourceHeight, 1);
}

export function createAspectCrop(sourceWidth: number, sourceHeight: number, aspectRatio: number): CropRect {
  const safeSourceWidth = Math.max(0, sourceWidth);
  const safeSourceHeight = Math.max(0, sourceHeight);

  if (safeSourceWidth === 0 || safeSourceHeight === 0 || aspectRatio <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const sourceAspectRatio = safeSourceWidth / safeSourceHeight;
  const width = sourceAspectRatio > aspectRatio ? safeSourceHeight * aspectRatio : safeSourceWidth;
  const height = sourceAspectRatio > aspectRatio ? safeSourceHeight : safeSourceWidth / aspectRatio;

  return {
    x: (safeSourceWidth - width) / 2,
    y: (safeSourceHeight - height) / 2,
    width,
    height,
  };
}

export function resizeCropRect({
  crop,
  handle,
  deltaX,
  deltaY,
  imageWidth,
  imageHeight,
  minSize,
  preserveAspect,
}: ResizeCropRectOptions): CropRect {
  const safeImageWidth = Math.max(0, imageWidth);
  const safeImageHeight = Math.max(0, imageHeight);
  const safeMinSize = Math.max(0, minSize);
  const clampedCrop = clampCropRect(crop, safeImageWidth, safeImageHeight);
  const minimumWidth = Math.min(safeMinSize, safeImageWidth);
  const minimumHeight = Math.min(safeMinSize, safeImageHeight);

  if (safeImageWidth === 0 || safeImageHeight === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  if (!preserveAspect || clampedCrop.width <= 0 || clampedCrop.height <= 0) {
    return resizeCropRectFreely(clampedCrop, handle, deltaX, deltaY, safeImageWidth, safeImageHeight, minimumWidth, minimumHeight);
  }

  return resizeCropRectWithAspect(
    clampedCrop,
    handle,
    deltaX,
    deltaY,
    safeImageWidth,
    safeImageHeight,
    minimumWidth,
    minimumHeight,
  );
}

export async function exportImageDataUrl({
  sourceDataUrl,
  crop,
  outputWidth,
  outputHeight,
  format,
  quality,
  fit,
  backgroundColor,
}: ExportImageDataUrlOptions): Promise<string> {
  if (!isPositiveFiniteNumber(outputWidth) || !isPositiveFiniteNumber(outputHeight)) {
    throw new Error("Output dimensions must be greater than zero.");
  }

  const image = await loadImage(sourceDataUrl);
  const clampedCrop = clampCropRect(crop, image.naturalWidth || image.width, image.naturalHeight || image.height);

  if (!isPositiveFiniteNumber(clampedCrop.width) || !isPositiveFiniteNumber(clampedCrop.height)) {
    throw new Error("Crop dimensions must be greater than zero.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create image export canvas context.");
  }

  const background = backgroundColor ?? (format === "image/jpeg" ? DEFAULT_JPEG_BACKGROUND : DEFAULT_TRANSPARENT_BACKGROUND);

  context.fillStyle = background;
  context.fillRect(0, 0, outputWidth, outputHeight);

  const scale = fit === "contain"
    ? Math.min(outputWidth / clampedCrop.width, outputHeight / clampedCrop.height)
    : Math.max(outputWidth / clampedCrop.width, outputHeight / clampedCrop.height);
  const destinationWidth = clampedCrop.width * scale;
  const destinationHeight = clampedCrop.height * scale;
  const destinationX = (outputWidth - destinationWidth) / 2;
  const destinationY = (outputHeight - destinationHeight) / 2;

  context.drawImage(
    image,
    clampedCrop.x,
    clampedCrop.y,
    clampedCrop.width,
    clampedCrop.height,
    destinationX,
    destinationY,
    destinationWidth,
    destinationHeight,
  );

  return canvas.toDataURL(format, quality);
}

function isPositiveFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function resizeCropRectFreely(
  crop: CropRect,
  handle: CropResizeHandle,
  deltaX: number,
  deltaY: number,
  imageWidth: number,
  imageHeight: number,
  minWidth: number,
  minHeight: number,
): CropRect {
  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.width;
  let bottom = crop.y + crop.height;

  if (handle.includes("e")) {
    right = clamp(right + deltaX, left + minWidth, imageWidth);
  }
  if (handle.includes("w")) {
    left = clamp(left + deltaX, 0, right - minWidth);
  }
  if (handle.includes("s")) {
    bottom = clamp(bottom + deltaY, top + minHeight, imageHeight);
  }
  if (handle.includes("n")) {
    top = clamp(top + deltaY, 0, bottom - minHeight);
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function resizeCropRectWithAspect(
  crop: CropRect,
  handle: CropResizeHandle,
  deltaX: number,
  deltaY: number,
  imageWidth: number,
  imageHeight: number,
  minWidth: number,
  minHeight: number,
): CropRect {
  const aspectRatio = crop.width / crop.height;
  const minAspectWidth = Math.max(minWidth, minHeight * aspectRatio);
  const minAspectHeight = Math.max(minHeight, minWidth / aspectRatio);

  if (handle === "e" || handle === "w") {
    const horizontalDirection = handle === "e" ? 1 : -1;
    const requestedWidth = crop.width + deltaX * horizontalDirection;
    const maxWidth = maxCenteredAspectWidth(crop, imageWidth, imageHeight, aspectRatio);
    const width = clamp(requestedWidth, Math.min(minAspectWidth, maxWidth), maxWidth);
    const height = width / aspectRatio;
    const centerY = crop.y + crop.height / 2;
    const y = clamp(centerY - height / 2, 0, imageHeight - height);
    const x = handle === "e" ? crop.x : crop.x + crop.width - width;

    return { x: clamp(x, 0, imageWidth - width), y, width, height };
  }

  if (handle === "n" || handle === "s") {
    const verticalDirection = handle === "s" ? 1 : -1;
    const requestedHeight = crop.height + deltaY * verticalDirection;
    const maxHeight = maxCenteredAspectHeight(crop, imageWidth, imageHeight, aspectRatio);
    const height = clamp(requestedHeight, Math.min(minAspectHeight, maxHeight), maxHeight);
    const width = height * aspectRatio;
    const centerX = crop.x + crop.width / 2;
    const x = clamp(centerX - width / 2, 0, imageWidth - width);
    const y = handle === "s" ? crop.y : crop.y + crop.height - height;

    return { x, y: clamp(y, 0, imageHeight - height), width, height };
  }

  const horizontalDirection = handle.includes("e") ? 1 : -1;
  const verticalDirection = handle.includes("s") ? 1 : -1;
  const requestedWidth = crop.width + deltaX * horizontalDirection;
  const requestedHeight = crop.height + deltaY * verticalDirection;
  const widthFromHeight = requestedHeight * aspectRatio;
  const requestedSize = Math.abs(requestedWidth - crop.width) >= Math.abs(widthFromHeight - crop.width)
    ? requestedWidth
    : widthFromHeight;
  const maxWidth = maxCornerAspectWidth(crop, handle, imageWidth, imageHeight, aspectRatio);
  const width = clamp(requestedSize, Math.min(minAspectWidth, maxWidth), maxWidth);
  const height = width / aspectRatio;
  const x = handle.includes("e") ? crop.x : crop.x + crop.width - width;
  const y = handle.includes("s") ? crop.y : crop.y + crop.height - height;

  return { x: clamp(x, 0, imageWidth - width), y: clamp(y, 0, imageHeight - height), width, height };
}

function maxCenteredAspectWidth(crop: CropRect, imageWidth: number, imageHeight: number, aspectRatio: number): number {
  const centerY = crop.y + crop.height / 2;
  const maxHeight = Math.min(centerY * 2, (imageHeight - centerY) * 2, imageHeight);

  return Math.min(imageWidth, maxHeight * aspectRatio);
}

function maxCenteredAspectHeight(crop: CropRect, imageWidth: number, imageHeight: number, aspectRatio: number): number {
  const centerX = crop.x + crop.width / 2;
  const maxWidth = Math.min(centerX * 2, (imageWidth - centerX) * 2, imageWidth);

  return Math.min(imageHeight, maxWidth / aspectRatio);
}

function maxCornerAspectWidth(
  crop: CropRect,
  handle: CropResizeHandle,
  imageWidth: number,
  imageHeight: number,
  aspectRatio: number,
): number {
  const maxWidth = handle.includes("e") ? imageWidth - crop.x : crop.x + crop.width;
  const maxHeight = handle.includes("s") ? imageHeight - crop.y : crop.y + crop.height;

  return Math.min(maxWidth, maxHeight * aspectRatio);
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return max;
  }

  return Math.min(Math.max(value, min), max);
}

function loadImage(sourceDataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load source image."));
    image.src = sourceDataUrl;
  });
}
