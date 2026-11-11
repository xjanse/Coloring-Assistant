
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { R2_BUCKET, r2 } from "@/lib/r2";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Only allow the owner of the project to retrieve its image.
    const project = await prisma.coloringProject.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      );
    }

    const object = await r2.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: project.imageKey,
      })
    );

    if (!object.Body) {
      return NextResponse.json(
        { error: "Image not found." },
        { status: 404 }
      );
    }

    const imageBytes = await object.Body.transformToByteArray();

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    const contentType = allowedTypes.includes(
      object.ContentType ?? ""
    )
      ? object.ContentType!
      : "application/octet-stream";

    return new NextResponse(Buffer.from(imageBytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(imageBytes.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });

  } catch (error) {
    console.error("Project image retrieval failed:", error);

    return NextResponse.json(
      { error: "Could not retrieve project image." },
      { status: 500 }
    );
  }
}
