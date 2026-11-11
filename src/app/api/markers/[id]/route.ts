
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getEditableMarker(
  markerId: string,
  userId: string
) {
  const marker = await prisma.marker.findUnique({
    where: { id: markerId },
  });

  if (!marker) {
    return null;
  }

  const membership = await prisma.collectionMember.findUnique({
    where: {
      userId_collectionId: {
        userId,
        collectionId: marker.collectionId,
      },
    },
  });

  if (
    !membership ||
    !["OWNER", "EDITOR"].includes(membership.role)
  ) {
    return null;
  }

  return marker;
}

export async function PATCH(
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

    const existingMarker = await getEditableMarker(
      id,
      session.user.id
    );

    if (!existingMarker) {
      return Response.json(
        { error: "Marker not found or you do not have permission." },
        { status: 404 }
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

    const marker = await prisma.marker.update({
      where: { id },
      data: {
        brand,
        name,
        code,
        hexColor,
      },
    });

    return Response.json({ marker });
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

    console.error("Update marker error:", error);

    return Response.json(
      { error: "Something went wrong while updating the marker." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const marker = await getEditableMarker(
      id,
      session.user.id
    );

    if (!marker) {
      return Response.json(
        { error: "Marker not found or you do not have permission." },
        { status: 404 }
      );
    }

    await prisma.marker.delete({
      where: { id },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete marker error:", error);

    return Response.json(
      { error: "Something went wrong while deleting the marker." },
      { status: 500 }
    );
  }
}
