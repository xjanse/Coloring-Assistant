import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./profile-form";

export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      displayName: true,
      username: true,
      email: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <header className="mb-10">
          <p className="text-sm font-medium tracking-widest text-primary">
            ACCOUNT SETTINGS
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Your profile
          </h1>
          <p className="mt-3 text-muted">
            Manage your personal account details.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h2 className="text-xl font-semibold">Personal details</h2>
          <p className="mt-1 text-sm text-muted">
            Your account information and username.
          </p>

          <div className="mt-8 space-y-6">
            <div>
              <p className="text-sm text-muted">Display name</p>
              <p className="mt-1 font-medium">
                {user.displayName ?? user.name}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted">Email address</p>
              <p className="mt-1 font-medium">{user.email}</p>
            </div>

            <div>
              <p className="text-sm text-muted">Member since</p>
              <p className="mt-1 font-medium">
                {user.createdAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="border-t border-border pt-6">
              <ProfileForm initialUsername={user.username ?? ""} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}