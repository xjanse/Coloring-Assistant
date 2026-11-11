import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    // Check whether the user is authenticated
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return Response.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const username = String(body.username ?? "")
      .trim()
      .toLowerCase();

    const displayName = String(body.displayName ?? "").trim();

    // Validate username
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return Response.json(
        {
          error:
            "Username must be 3–20 characters and contain only letters, numbers and underscores.",
        },
        { status: 400 }
      );
    }

    if (displayName.length < 2 || displayName.length > 40) {
      return Response.json(
        { error: "Display name must be between 2 and 40 characters." },
        { status: 400 }
      );
    }

    // Check if onboarding is already completed
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!currentUser) {
      return Response.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    if (currentUser.username) {
      return Response.json(
        { error: "Onboarding has already been completed." },
        { status: 409 }
      );
    }

    // Check username availability
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return Response.json(
        { error: "This username is already taken." },
        { status: 409 }
      );
    }

    // Save user and create their personal collection
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          username,
          displayName,
          name: displayName,
        },
      });

      const collection = await tx.markerCollection.create({
        data: {
          name: `${displayName}'s Markers`,
          description: "Personal marker collection",
        },
      });

      await tx.collectionMember.create({
        data: {
          userId: session.user.id,
          collectionId: collection.id,
          role: "OWNER",
        },
      });
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);

    return Response.json(
      { error: "Something went wrong during onboarding." },
      { status: 500 }
    );
  }
}