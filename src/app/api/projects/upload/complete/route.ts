
import {
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { R2_BUCKET, r2 } from "@/lib/r2";

const MAX_STORAGE = 8n * 1024n * 1024n * 1024n;

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

    // 2. Validate request
    const body = await request.json();

    const reservationId = body.reservationId;
    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "Untitled project";

    if (
      typeof reservationId !== "string" ||
      !reservationId ||
      title.length > 100
    ) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    // 3. Find reservation
    const reservation = await prisma.uploadReservation.findFirst({
      where: {
        id: reservationId,
        userId: session.user.id,
        status: "PENDING",
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Upload reservation not found." },
        { status: 404 }
      );
    }

    if (reservation.expiresAt <= new Date()) {
      return NextResponse.json(
        { error: "Upload reservation has expired." },
        { status: 410 }
      );
    }

    // 4. Verify actual R2 object
    let object;

    try {
      object = await r2.send(
        new HeadObjectCommand({
          Bucket: R2_BUCKET,
          Key: reservation.objectKey,
        })
      );
    } catch (error) {
      console.error("R2 HEAD failed:", error);

      return NextResponse.json(
        { error: "Uploaded file could not be found." },
        { status: 409 }
      );
    }

    
const metadata = object.Metadata ?? {};

const validation = {
  actualSize: object.ContentLength,
  expectedSize: Number(reservation.expectedBytes),

  actualUserId: metadata.userid,
  expectedUserId: session.user.id,

  actualReservationId: metadata.reservationid,
  expectedReservationId: reservation.id,

  receivedMetadata: metadata,
};

console.log(
  "UPLOAD VALIDATION:",
  JSON.stringify(validation, null, 2)
);

const isValid =
  object.ContentLength === Number(reservation.expectedBytes) &&
  metadata.userid === session.user.id &&
  metadata.reservationid === reservation.id;

if (!isValid) {
  return NextResponse.json(
    {
      error: "Uploaded file failed validation.",
      validation,
    },
    { status: 400 }
  );
}


    // 5. Complete reservation and create project atomically
    const project = await prisma.$transaction(async (tx) => {
      const result = await tx.uploadReservation.updateMany({
        where: {
          id: reservation.id,
          userId: session.user.id,
          status: "PENDING",
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          status: "COMPLETED",
        },
      });

      if (result.count !== 1) {
        throw new Error("RESERVATION_ALREADY_USED");
      }

      const quota = await tx.storageQuota.findUnique({
        where: { id: "global" },
      });

      if (!quota) {
        throw new Error("STORAGE_QUOTA_NOT_FOUND");
      }

      if (
        quota.usedBytes + reservation.expectedBytes >
        MAX_STORAGE
      ) {
        throw new Error("STORAGE_QUOTA_EXCEEDED");
      }

      await tx.storageQuota.update({
        where: { id: "global" },
        data: {
          usedBytes: {
            increment: reservation.expectedBytes,
          },
          reservedBytes: {
            decrement: reservation.expectedBytes,
          },
        },
      });

      return tx.coloringProject.create({
        data: {
          title,
          userId: session.user.id,
          imageKey: reservation.objectKey,
        },
      });
    });

    return NextResponse.json({
      success: true,
      project,
      uploadedBytes: reservation.expectedBytes.toString(),
    });

  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RESERVATION_ALREADY_USED"
    ) {
      return NextResponse.json(
        { error: "This upload has already been completed." },
        { status: 409 }
      );
    }

    console.error("Upload completion failed:", error);

    return NextResponse.json(
      { error: "Could not complete upload." },
      { status: 500 }
    );
  }
}
