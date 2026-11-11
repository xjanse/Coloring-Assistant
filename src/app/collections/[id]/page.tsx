
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CollectionView from "./collection-view";

export default async function CollectionPage({
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
        include: {
          markers: {
            orderBy: [
              { brand: "asc" },
              { name: "asc" },
            ],
          },
        },
      },
    },
  });

  if (!membership) {
    notFound();
  }

  const { collection } = membership;

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/collections"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to collections
        </Link>

        <CollectionView
          collection={{
            id: collection.id,
            name: collection.name,
            description: collection.description,
            markers: collection.markers.map((marker) => ({
              id: marker.id,
              brand: marker.brand,
              name: marker.name,
              code: marker.code,
              hexColor: marker.hexColor,
            })),
          }}
          role={membership.role}
        />
      </div>
    </main>
  );
}
