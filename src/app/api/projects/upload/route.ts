
import { NextResponse } from "next/server";
import { createHmac, randomUUID } from "crypto";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_STORAGE = 8n * 1024n * 1024n * 1024n;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    // 2. Validate upload request
    const body = await request.json();

    const contentType = body.contentType;
    const size = body.size;

    if (
      typeof contentType !== "string" ||
      !ALLOWED_TYPES.includes(contentType) ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        { error: "Invalid file type or size." },
        { status: 400 }
      );
    }

    // 3. Check environment variables
    const secret = process.env.UPLOAD_SIGNING_SECRET;
    const workerUrl = process.env.R2_WORKER_URL;

    if (!secret || !workerUrl) {
      throw new Error("Missing upload configuration.");
    }

    // 4. Create unique upload details
    const reservationId = randomUUID();

    const objectKey =
      `projects/${session.user.id}/${randomUUID()}`;

    const expectedBytes = BigInt(size);

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    const tokenExpiresAt = Math.floor(
      Date.now() / 1000
    ) + 5 * 60;

    const payload = {
      key: objectKey,
      userId: session.user.id,
      size,
      contentType,
      exp: tokenExpiresAt,
      reservationId,
    };

    const encodedPayload = Buffer.from(
      JSON.stringify(payload)
    ).toString("base64url");

    const signature = createHmac("sha256", secret)
      .update(encodedPayload)
      .digest("base64url");

    const token = `${encodedPayload}.${signature}`;

    // 5. Reserve storage atomically
    await prisma.$transaction(async (tx) => {
      await tx.storageQuota.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          usedBytes: 0n,
          reservedBytes: 0n,
        },
        update: {},
      });

      const result = await tx.$executeRaw`
        UPDATE "StorageQuota"
        SET
          "reservedBytes" = "reservedBytes" + ${expectedBytes},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "id" = 'global'
          AND "usedBytes" + "reservedBytes" + ${expectedBytes}
              <= ${MAX_STORAGE}
      `;

      if (result !== 1) {
        throw new Error("STORAGE_QUOTA_EXCEEDED");
      }

      await tx.uploadReservation.create({
        data: {
          id: reservationId,
          userId: session.user.id,
          objectKey,
          expectedBytes,
          expiresAt,
          status: "PENDING",
        },
      });
    });

    // 6. Return upload information
    return NextResponse.json({
      success: true,
      uploadUrl: `${workerUrl.replace(/\/$/, "")}/upload`,
      token,
      reservationId,
      objectKey,
      headers: {
        "Content-Type": contentType,
      },
      expiresIn: 300,
    });

  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "STORAGE_QUOTA_EXCEEDED"
    ) {
      return NextResponse.json(
        { error: "The shared 8 GB storage limit has been reached." },
        { status: 413 }
      );
    }

    console.error("Upload reservation failed:", error);

    return NextResponse.json(
      { error: "Could not reserve storage." },
      { status: 500 }
    );
  }
}
