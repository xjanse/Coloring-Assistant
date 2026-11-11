
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { r2, R2_BUCKET } from "@/lib/r2";

export const runtime = "nodejs";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Only allow the owner of the project to access its generated image
    const project = await prisma.coloringProject.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        generatedImageKey: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      );
    }

    if (!project.generatedImageKey) {
      return NextResponse.json(
        { error: "No generated image exists for this project." },
        { status: 404 }
      );
    }

    // Retrieve generated image from R2
    const result = await r2.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: project.generatedImageKey,
      })
    );

    if (!result.Body) {
      return NextResponse.json(
        { error: "Generated image not found." },
        { status: 404 }
      );
    }

    const contentType = result.ContentType ?? "application/octet-stream";

    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: "Invalid image type." },
        { status: 415 }
      );
    }

    const imageBytes = await result.Body.transformToByteArray();

    // Convert Uint8Array into a standard ArrayBuffer
    const imageBuffer = new ArrayBuffer(imageBytes.byteLength);
    new Uint8Array(imageBuffer).set(imageBytes);

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": imageBytes.byteLength.toString(),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Generated image retrieval error:", error);

    return NextResponse.json(
      { error: "Failed to retrieve generated image." },
      { status: 500 }
    );
  }
}
