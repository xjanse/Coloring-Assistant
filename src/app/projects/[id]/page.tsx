
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProjectAnalysis from "./project-analysis";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const project = await prisma.coloringProject.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!project) {
    notFound();
  }

  const memberships = await prisma.collectionMember.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      collection: {
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              markers: true,
            },
          },
        },
      },
    },
    orderBy: {
      joinedAt: "asc",
    },
  });

  const collections = memberships.map((membership) => ({
    id: membership.collection.id,
    name: membership.collection.name,
    markerCount: membership.collection._count.markers,
  }));

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/projects"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to projects
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-semibold">
            {project.title}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Created{" "}
            {project.createdAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </header>

        <div className="overflow-hidden rounded-2xl border border-border bg-muted/20 p-4 md:p-8">
          <img
            src={`/api/projects/${project.id}/image`}
            alt={project.title}
            className="mx-auto max-h-[800px] max-w-full rounded-lg object-contain"
          />
        </div>

        <ProjectAnalysis
          projectId={project.id}
          collections={collections}
          initialGeneratedStyle={project.generatedStyle}
          initialCustomInstructions={project.customInstructions}
          initialGeneratedAt={
            project.generatedAt?.toISOString() ?? null
          }
        />
      </div>
    </main>
  );
}
