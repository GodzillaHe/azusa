import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageRequest } from "./image-options";

const generateMock = vi.fn();
const editMock = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function MockOpenAI(options) {
    return {
      options,
      images: {
        generate: generateMock,
        edit: editMock,
      },
    };
  }),
}));

import OpenAI from "openai";
import {
  __deleteImageJobEditImageForTests,
  __hasImageJobCredentialsForTests,
  __hasImageJobEditImageForTests,
  __resetImageJobStoreForTests,
  createImageJob,
  getImageJob,
  markImageJobFailed,
  markImageJobSucceeded,
  runImageJob,
} from "./image-job-store";

const request: ImageRequest = {
  prompt: "A neon robot painting",
  size: "1024x1024",
  count: 2,
  quality: "high",
  style: "vivid",
};

const credentials = {
  apiKey: "test-key",
  baseURL: "https://example.test/v1",
};

describe("image-job-store", () => {
  beforeEach(() => {
    __resetImageJobStoreForTests();
    vi.clearAllMocks();
  });

  it("creates and stores a running job", () => {
    const job = createImageJob(request, credentials);

    expect(job).toMatchObject({
      status: "running",
      mode: "generate",
      request,
    });
    expect(job.id).toEqual(expect.any(String));
    expect(JSON.stringify(job)).not.toContain("test-key");
    expect(__hasImageJobCredentialsForTests(job.id)).toBe(true);
    expect(getImageJob(job.id)).toEqual(job);
  });

  it("creates an edit job and stores its file outside API JSON", () => {
    const editImage = new File(["image-bytes"], "source.png", { type: "image/png" });

    const job = createImageJob(request, credentials, editImage);

    expect(job).toMatchObject({
      status: "running",
      mode: "edit",
      request,
    });
    expect(JSON.stringify(job)).not.toContain("source.png");
    expect(job).not.toHaveProperty("editImage");
    expect(__hasImageJobEditImageForTests(job.id)).toBe(true);
    expect(getImageJob(job.id)).toEqual(job);
  });

  it("stores success images", () => {
    const job = createImageJob(
      request,
      credentials,
      new File(["image-bytes"], "source.png", { type: "image/png" }),
    );
    const images = ["data:image/png;base64,one", "data:image/png;base64,two"];

    const updated = markImageJobSucceeded(job.id, images);

    expect(updated).toMatchObject({
      id: job.id,
      status: "succeeded",
      images,
    });
    expect(getImageJob(job.id)).toEqual(updated);
    expect(__hasImageJobEditImageForTests(job.id)).toBe(false);
    expect(__hasImageJobCredentialsForTests(job.id)).toBe(false);
  });

  it("stores a failure message", () => {
    const job = createImageJob(
      request,
      credentials,
      new File(["image-bytes"], "source.png", { type: "image/png" }),
    );

    const updated = markImageJobFailed(job.id, "图片生成失败，请稍后重试。");

    expect(updated).toMatchObject({
      id: job.id,
      status: "failed",
      error: "图片生成失败，请稍后重试。",
    });
    expect(getImageJob(job.id)).toEqual(updated);
    expect(__hasImageJobEditImageForTests(job.id)).toBe(false);
    expect(__hasImageJobCredentialsForTests(job.id)).toBe(false);
  });

  it("does not overwrite a succeeded job with a later failure", () => {
    const job = createImageJob(request, credentials);
    const succeeded = markImageJobSucceeded(job.id, ["data:image/png;base64,one"]);

    const updated = markImageJobFailed(job.id, "图片生成失败，请稍后重试。");

    expect(updated).toEqual(succeeded);
    expect(getImageJob(job.id)).toEqual(succeeded);
  });

  it("does not overwrite a failed job with a later success", () => {
    const job = createImageJob(request, credentials);
    const failed = markImageJobFailed(job.id, "图片生成失败，请稍后重试。");

    const updated = markImageJobSucceeded(job.id, ["data:image/png;base64,one"]);

    expect(updated).toEqual(failed);
    expect(getImageJob(job.id)).toEqual(failed);
  });

  it("clears job credentials when the test store resets", () => {
    const job = createImageJob(request, credentials);

    __resetImageJobStoreForTests();

    expect(__hasImageJobCredentialsForTests(job.id)).toBe(false);
  });

  it("runs a generate job through OpenAI and stores base64 data URLs", async () => {
    generateMock.mockResolvedValueOnce({
      data: [{ b64_json: "abc" }, { b64_json: "def" }],
    });
    const job = createImageJob(request, credentials);

    const updated = await runImageJob(job.id);

    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: "test-key",
      baseURL: "https://example.test/v1",
    });
    expect(generateMock).toHaveBeenCalledWith({
      model: "gpt-image-2",
      prompt: request.prompt,
      size: request.size,
      n: request.count,
      quality: request.quality,
      output_format: "png",
    });
    expect(generateMock.mock.calls[0][0]).not.toHaveProperty("style");
    expect(generateMock.mock.calls[0][0]).not.toHaveProperty("response_format");
    expect(editMock).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      status: "succeeded",
      images: ["data:image/png;base64,abc", "data:image/png;base64,def"],
    });
    expect(__hasImageJobCredentialsForTests(job.id)).toBe(false);
  });

  it("runs an edit job through OpenAI with the edit image", async () => {
    const editImage = new File(["image-bytes"], "source.png", { type: "image/png" });
    editMock.mockResolvedValueOnce({
      data: [{ b64_json: "edited" }],
    });
    const job = createImageJob(request, credentials, editImage);

    const updated = await runImageJob(job.id);

    expect(editMock).toHaveBeenCalledWith({
      model: "gpt-image-2",
      image: editImage,
      prompt: request.prompt,
      size: request.size,
      n: request.count,
      quality: request.quality,
      output_format: "png",
    });
    expect(editMock.mock.calls[0][0]).not.toHaveProperty("style");
    expect(editMock.mock.calls[0][0]).not.toHaveProperty("response_format");
    expect(generateMock).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      status: "succeeded",
      images: ["data:image/png;base64,edited"],
    });
    expect(__hasImageJobEditImageForTests(job.id)).toBe(false);
    expect(__hasImageJobCredentialsForTests(job.id)).toBe(false);
  });

  it("fails an edit job without calling OpenAI when the edit image is missing", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const editImage = new File(["image-bytes"], "source.png", { type: "image/png" });
    const job = createImageJob(request, credentials, editImage);
    __deleteImageJobEditImageForTests(job.id);

    const updated = await runImageJob(job.id);

    expect(OpenAI).not.toHaveBeenCalled();
    expect(generateMock).not.toHaveBeenCalled();
    expect(editMock).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      status: "failed",
      error: "图片生成失败，请稍后重试。",
    });
    expect(__hasImageJobEditImageForTests(job.id)).toBe(false);
    expect(__hasImageJobCredentialsForTests(job.id)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Image edit job is missing its uploaded image",
      job.id,
    );
    consoleErrorSpy.mockRestore();
  });

  it("marks a running job failed when OpenAI rejects", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    generateMock.mockRejectedValueOnce(new Error("quota exceeded"));
    const job = createImageJob(request, credentials);

    const updated = await runImageJob(job.id);

    expect(updated).toMatchObject({
      status: "failed",
      error: "图片生成失败，请稍后重试。",
    });
    expect(__hasImageJobEditImageForTests(job.id)).toBe(false);
    expect(__hasImageJobCredentialsForTests(job.id)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Image generation failed", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("filters invalid response items and only stores real base64 data URLs", async () => {
    generateMock.mockResolvedValueOnce({
      data: [{ b64_json: "abc" }, {}, { b64_json: undefined }, { b64_json: "def" }],
    });
    const job = createImageJob(request, credentials);

    const updated = await runImageJob(job.id);

    expect(updated).toMatchObject({
      status: "succeeded",
      images: ["data:image/png;base64,abc", "data:image/png;base64,def"],
    });
    expect(updated.images).not.toContain("data:image/png;base64,undefined");
  });

  it("marks failed with a generic message when OpenAI returns no images", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    generateMock.mockResolvedValueOnce({
      data: [{}, { b64_json: undefined }],
    });
    const job = createImageJob(request, credentials);

    const updated = await runImageJob(job.id);

    expect(updated).toMatchObject({
      status: "failed",
      error: "图片生成失败，请稍后重试。",
    });
    expect(updated.images).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Image generation returned no base64 images",
      expect.anything(),
    );
    consoleErrorSpy.mockRestore();
  });
});
