import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
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

    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return Response.json(
        {
          error:
            "Username must be 3–20 characters and contain only letters, numbers and underscores.",
        },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser && existingUser.id !== session.user.id) {
      return Response.json(
        { error: "This username is already taken." },
        { status: 409 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { username },
    });

    return Response.json({ success: true });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "This username is already taken." },
        { status: 409 }
      );
    }

    console.error("Profile update error:", error);

    return Response.json(
      { error: "Something went wrong while updating your profile." },
      { status: 500 }
    );
  }
}