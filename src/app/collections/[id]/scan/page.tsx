import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ScanView from "./scan-view";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const membership = await prisma.collectionMember.findUnique({
    where: {
      userId_collectionId: {
        userId: session.user.id,
        collectionId: id,
      },
    },
    include: {
      collection: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!membership) {
    notFound();
  }

  if (!["OWNER", "EDITOR"].includes(membership.role)) {
    notFound();
  }

  return (
    <ScanView
      collectionId={membership.collection.id}
      collectionName={membership.collection.name}
    />
  );
}