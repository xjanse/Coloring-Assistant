
import type { ReactNode } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import {
  Palette,
  FolderHeart,
  Plus,
  ArrowRight,
} from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  // Check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Not logged in? Go to login.
  if (!session) {
    redirect("/login");
  }

  // Check whether onboarding is completed
  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      username: true,
    },
  });

  // User doesn't have a username yet? Go to onboarding.
  if (!user?.username) {
    redirect("/onboarding");
  }

  // Onboarding completed: show dashboard
  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <header className="mb-12 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-widest text-muted">
              YOUR CREATIVE SPACE
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Coloring Assistant
            </h1>
            <p className="mt-3 text-muted">
              Let's make something colorful today.
            </p>
          </div>

          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition hover:bg-secondary"
          >
            <UserRound size={18} />
          </Link>
        </header>

        {/* Dashboard cards */}
        <section className="grid gap-5 md:grid-cols-3">

          <DashboardCard
            icon={<Plus size={24} />}
            title="New coloring page"
            description="Upload a coloring page and let AI help you bring it to life."
            color="bg-primary-light text-primary"
          />

          <DashboardCard
            href="/collections"
            icon={<Palette size={24} />}
            title="My markers"
            description="Manage your alcohol marker collection and available colors."
            color="bg-secondary text-pink-700"
          />

          <DashboardCard
            href="/projects"
            icon={<FolderHeart size={24} />}
            title="My projects"
            description="Continue working on your previous coloring pages."
            color="bg-accent text-emerald-700"
          />

        </section>

        {/* Welcome section */}
        <section className="mt-16 rounded-3xl border border-border bg-card p-8 md:p-12">
          <div className="max-w-xl">
            <p className="text-sm font-medium tracking-widest text-primary">
              READY TO GET CREATIVE?
            </p>

            <h2 className="mt-3 text-3xl font-semibold">
              Your next coloring adventure starts here.
            </h2>

            <p className="mt-4 leading-relaxed text-muted">
              Upload your favorite coloring page, choose a theme
              and let your personal coloring assistant help you
              find the perfect combination of colors.
            </p>

            <button className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-white transition hover:opacity-90">
              Start coloring
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}

function DashboardCard({
  icon,
  title,
  description,
  color,
  href
}: {
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
  href?: string;
}) {
  const card = (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {description}
      </p>
      <div className="mt-6 flex items-center gap-2 text-sm font-medium text-primary">
        Explore <ArrowRight size={16} />
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
