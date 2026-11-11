
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

    if (!membership) {
      return Response.json(
        { error: "Collection not found." },
        { status: 404 }
      );
    }

    if (!["OWNER", "EDITOR"].includes(membership.role)) {
      return Response.json(
        { error: "You do not have permission to add markers." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const brand = String(body.brand ?? "").trim();
    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim();
    const hexColor = String(body.hexColor ?? "").trim().toUpperCase();

    if (
      !brand ||
      brand.length > 50 ||
      !name ||
      name.length > 80 ||
      !code ||
      code.length > 30 ||
      !/^#[0-9A-F]{6}$/.test(hexColor)
    ) {
      return Response.json(
        { error: "Please provide valid marker details and a HEX color." },
        { status: 400 }
      );
    }

    const marker = await prisma.marker.create({
      data: {
        collectionId: id,
        brand,
        name,
        code,
        hexColor,
      },
    });

    return Response.json({ marker }, { status: 201 });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "A marker with this brand and color code already exists in this collection." },
        { status: 409 }
      );
    }

    console.error("Create marker error:", error);

    return Response.json(
      { error: "Something went wrong while creating the marker." },
      { status: 500 }
    );
  }
}
