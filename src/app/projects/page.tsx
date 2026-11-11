
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Plus, FolderOpen, ImageIcon } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const projects = await prisma.coloringProject.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-6xl">

        <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/"
              className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to dashboard
            </Link>

            <h1 className="text-3xl font-semibold">
              My coloring projects
            </h1>

            <p className="mt-2 text-muted-foreground">
              Your saved coloring pages in one place.
            </p>
          </div>

          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus size={18} />
            New project
          </Link>
        </header>

        {projects.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <FolderOpen
              size={42}
              className="mb-4 text-muted-foreground"
            />

            <h2 className="text-lg font-medium">
              No projects yet
            </h2>

            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Upload your first coloring page to start creating a project.
            </p>

            <Link
              href="/projects/new"
              className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/30">
                  <img
                    src={`/api/projects/${project.id}/image`}
                    alt={project.title}
                    className="h-full w-full object-contain p-3 transition group-hover:scale-[1.02]"
                  />
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon
                      size={16}
                      className="shrink-0 text-muted-foreground"
                    />

                    <h2 className="truncate font-medium">
                      {project.title}
                    </h2>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    Created{" "}
                    {project.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
