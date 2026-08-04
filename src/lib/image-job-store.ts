import OpenAI from "openai";
import type { ImageRequest } from "./image-options";
import type { OpenAICredentials } from "./openai-credentials";

export type ImageJobStatus = "running" | "succeeded" | "failed";

export type ImageJob = {
  id: string;
  status: ImageJobStatus;
  mode: "generate" | "edit";
  request: ImageRequest;
  images?: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const imageJobs = new Map<string, ImageJob>();
const imageJobEditImages = new Map<string, File>();
const imageJobCredentials = new Map<string, OpenAICredentials>();
const GENERIC_IMAGE_ERROR = "图片生成失败，请稍后重试。";

function requireImageJob(id: string): ImageJob {
  const job = imageJobs.get(id);

  if (!job) {
    throw new Error("Image job not found.");
  }

  return job;
}

function isTerminalJob(job: ImageJob): boolean {
  return job.status === "succeeded" || job.status === "failed";
}

function isB64Image(image: unknown): image is { b64_json: string } {
  return (
    typeof image === "object" &&
    image !== null &&
    "b64_json" in image &&
    typeof image.b64_json === "string" &&
    image.b64_json.length > 0
  );
}

function toDataImageUrls(images: unknown[]): string[] {
  return images
    .filter(isB64Image)
    .map((image) => `data:image/png;base64,${image.b64_json}`);
}

export function createImageJob(
  request: ImageRequest,
  credentials: OpenAICredentials,
  editImage?: File,
): ImageJob {
  const now = new Date().toISOString();
  const job: ImageJob = {
    id: crypto.randomUUID(),
    status: "running",
    mode: editImage ? "edit" : "generate",
    request,
    createdAt: now,
    updatedAt: now,
  };

  imageJobs.set(job.id, job);
  imageJobCredentials.set(job.id, credentials);

  if (editImage) {
    imageJobEditImages.set(job.id, editImage);
  }

  return job;
}

export function getImageJob(id: string): ImageJob | undefined {
  return imageJobs.get(id);
}

export function markImageJobSucceeded(id: string, images: string[]): ImageJob {
  const job = requireImageJob(id);

  if (isTerminalJob(job)) {
    return job;
  }

  const updated: ImageJob = {
    ...job,
    status: "succeeded",
    images,
    error: undefined,
    updatedAt: new Date().toISOString(),
  };

  imageJobs.set(id, updated);
  imageJobEditImages.delete(id);
  imageJobCredentials.delete(id);

  return updated;
}

export function markImageJobFailed(id: string, error: string): ImageJob {
  const job = requireImageJob(id);

  if (isTerminalJob(job)) {
    return job;
  }

  const updated: ImageJob = {
    ...job,
    status: "failed",
    error,
    updatedAt: new Date().toISOString(),
  };

  imageJobs.set(id, updated);
  imageJobEditImages.delete(id);
  imageJobCredentials.delete(id);

  return updated;
}

export function __resetImageJobStoreForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("__resetImageJobStoreForTests is only available in tests.");
  }

  imageJobs.clear();
  imageJobEditImages.clear();
  imageJobCredentials.clear();
}

export function __hasImageJobEditImageForTests(id: string): boolean {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("__hasImageJobEditImageForTests is only available in tests.");
  }

  return imageJobEditImages.has(id);
}

export function __hasImageJobCredentialsForTests(id: string): boolean {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("__hasImageJobCredentialsForTests is only available in tests.");
  }

  return imageJobCredentials.has(id);
}

export function __deleteImageJobEditImageForTests(id: string): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("__deleteImageJobEditImageForTests is only available in tests.");
  }

  imageJobEditImages.delete(id);
}

export async function runImageJob(id: string): Promise<ImageJob> {
  const job = requireImageJob(id);
  const credentials = imageJobCredentials.get(id);

  if (!credentials) {
    console.error("Image job is missing its OpenAI credentials", id);

    return markImageJobFailed(id, GENERIC_IMAGE_ERROR);
  }

  const clientOptions: ConstructorParameters<typeof OpenAI>[0] = credentials;

  try {
    const imageParameters = {
      model: "gpt-image-2" as const,
      prompt: job.request.prompt,
      size: job.request.size,
      n: job.request.count,
      quality: job.request.quality,
      output_format: "png" as const,
    };

    const response = await (async () => {
      if (job.mode === "edit") {
        const editImage = imageJobEditImages.get(id);

        if (!editImage) {
          console.error("Image edit job is missing its uploaded image", id);

          return undefined;
        }

        const client = new OpenAI(clientOptions);
        return client.images.edit({
          ...imageParameters,
          image: editImage,
        });
      }

      const client = new OpenAI(clientOptions);
      return client.images.generate(imageParameters);
    })();

    if (!response) {
      return markImageJobFailed(id, GENERIC_IMAGE_ERROR);
    }

    const images = toDataImageUrls(response.data ?? []);

    if (images.length === 0) {
      console.error("Image generation returned no base64 images", response.data);

      return markImageJobFailed(id, GENERIC_IMAGE_ERROR);
    }

    return markImageJobSucceeded(id, images);
  } catch (error) {
    console.error("Image generation failed", error);

    return markImageJobFailed(id, GENERIC_IMAGE_ERROR);
  }
}
