import { NextResponse } from "next/server";

import { getImageJob } from "@/lib/image-job-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId?: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;

  if (!jobId) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const job = getImageJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    images: job.images,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
