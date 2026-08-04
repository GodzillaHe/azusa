import OpenAI from "openai";
import { NextResponse } from "next/server";

import { parseOpenAICredentials } from "@/lib/openai-credentials";
import { validateImageRequest } from "@/lib/validate-image-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const validation = validateImageRequest(payload);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const credentials = parseOpenAICredentials(request.headers);
  if (!credentials.ok) {
    return NextResponse.json({ error: credentials.error }, { status: 400 });
  }

  const { prompt, size, count, quality } = validation.data;
  const openai = new OpenAI(credentials.data);

  try {
    const response = await openai.images.generate({
      model: "gpt-image-2",
      prompt,
      size,
      n: count,
      quality,
      output_format: "png",
    });

    const images = response.data
      ?.map((image) => image.b64_json)
      .filter((image): image is string => Boolean(image))
      .map((image) => ({ dataUrl: `data:image/png;base64,${image}` }));

    if (!images?.length) {
      return NextResponse.json(
        { error: "OpenAI did not return any generated images." },
        { status: 502 },
      );
    }

    return NextResponse.json({ images });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI error.";
    console.error("OpenAI image generation failed:", message);

    return NextResponse.json(
      { error: "OpenAI image generation failed." },
      { status: 502 },
    );
  }
}
