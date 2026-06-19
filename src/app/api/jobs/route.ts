import { NextResponse } from "next/server";

import { createImageJob, runImageJob } from "@/lib/image-job-store";
import { validateImageRequest } from "@/lib/validate-image-request";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_IMAGE_FILE_SIZE = 50 * 1024 * 1024;

function isMultipartRequest(request: Request): boolean {
  return request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data") ?? false;
}

function getStringField(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);

  return typeof value === "string" ? value : undefined;
}

function getMultipartPayload(formData: FormData): Record<string, unknown> {
  const count = getStringField(formData, "count");

  return {
    prompt: getStringField(formData, "prompt"),
    size: getStringField(formData, "size"),
    count: count === undefined ? undefined : Number(count),
    quality: getStringField(formData, "quality"),
    style: getStringField(formData, "style"),
  };
}

function validateMultipartImage(image: FormDataEntryValue | null): File | NextResponse {
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "请上传需要编辑的图片文件。" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return NextResponse.json(
      { error: "图片格式不支持，请上传 PNG、JPEG、JPG 或 WebP 格式的图片。" },
      { status: 400 },
    );
  }

  if (image.size > MAX_IMAGE_FILE_SIZE) {
    return NextResponse.json({ error: "图片文件不能超过 50 MB，请压缩后重试。" }, { status: 400 });
  }

  return image;
}

export async function POST(request: Request) {
  let payload: unknown;
  let imageFile: File | undefined;

  if (isMultipartRequest(request)) {
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "表单数据格式不正确，请检查后重试。" }, { status: 400 });
    }

    const imageValidation = validateMultipartImage(formData.get("image"));
    if (imageValidation instanceof NextResponse) {
      return imageValidation;
    }

    imageFile = imageValidation;
    payload = getMultipartPayload(formData);
  } else {
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
  }

  const validation = validateImageRequest(payload);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "服务器尚未配置 OPENAI_API_KEY，暂时无法生成图片。请联系管理员。" },
      { status: 500 },
    );
  }

  const job = createImageJob(validation.data, imageFile);

  void runImageJob(job.id).catch((error) => {
    console.error("Unexpected image job error", error);
  });

  return NextResponse.json({ jobId: job.id, status: "running" });
}
