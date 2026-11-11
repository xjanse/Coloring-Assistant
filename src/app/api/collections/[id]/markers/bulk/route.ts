
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return Response.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    const { id } = await params;

    const membership = await prisma.collectionMember.findUnique({
      where: {
        userId_collectionId: {
          userId: session.user.id,
          collectionId: id,
        },
      },
    });

    if (
      !membership ||
      !["OWNER", "EDITOR"].includes(membership.role)
    ) {
      return Response.json(
        { error: "You do not have permission to edit this collection." },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (
      !body ||
      !Array.isArray(body.markers) ||
      body.markers.length === 0
    ) {
      return Response.json(
        { error: "Please provide at least one marker." },
        { status: 400 }
      );
    }

    if (body.markers.length > 300) {
      return Response.json(
        { error: "You can import a maximum of 300 markers at once." },
        { status: 400 }
      );
    }

    const markers = body.markers.map((marker: unknown) => {
      if (
        marker === null ||
        typeof marker !== "object" ||
        Array.isArray(marker)
      ) {
        throw new Error("Invalid marker data.");
      }

      const item = marker as Record<string, unknown>;

      const brand =
        typeof item.brand === "string" ? item.brand.trim() : "";
      const name =
        typeof item.name === "string" ? item.name.trim() : "";
      const code =
        typeof item.code === "string" ? item.code.trim() : "";
      const hexColor =
        typeof item.hexColor === "string"
          ? item.hexColor.trim().toUpperCase()
          : "";

      if (
        !brand ||
        !name ||
        !code ||
        !/^#[0-9A-F]{6}$/.test(hexColor)
      ) {
        throw new Error(
          "Every marker needs a brand, color name, color code and valid HEX color."
        );
      }

      if (
        brand.length > 50 ||
        name.length > 80 ||
        code.length > 30
      ) {
        throw new Error("One or more marker fields are too long.");
      }

      return {
        brand,
        name,
        code,
        hexColor,
      };
    });

    const result = await prisma.$transaction(async (tx) => {
      let imported = 0;
      let skipped = 0;

      for (const marker of markers) {
        const existing = await tx.marker.findUnique({
          where: {
            collectionId_brand_code: {
              collectionId: id,
              brand: marker.brand,
              code: marker.code,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await tx.marker.create({
          data: {
            collectionId: id,
            ...marker,
          },
        });

        imported++;
      }

      return { imported, skipped };
    });

    return Response.json(result);
  } catch (error) {
    console.error("Bulk marker import error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while importing markers.",
      },
      { status: 500 }
    );
  }
}
