
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FolderHeart, Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CollectionsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const memberships = await prisma.collectionMember.findMany({
        where: {
            userId: session.user.id,
        },
        include: {
            collection: {
                include: {
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

    return (
        <main className="min-h-screen p-6 md:p-12">
            <div className="mx-auto max-w-6xl">
                <Link
                    href="/"
                    className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
                >
                    <ArrowLeft size={16} />
                    Back to dashboard
                </Link>

                <header className="mb-10 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium tracking-widest text-primary">
                            YOUR MARKERS
                        </p>
                        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                            My collections
                        </h1>
                        <p className="mt-3 text-muted">
                            Manage your marker collections and shared colors.
                        </p>
                    </div>

                    <button
                        disabled
                        title="Coming soon"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white opacity-50"
                    >
                        <Plus size={20} />
                    </button>
                </header>

                {memberships.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-10 text-center">
                        <FolderHeart size={36} className="mx-auto text-muted" />
                        <h2 className="mt-4 text-xl font-semibold">
                            No collections yet
                        </h2>
                        <p className="mt-2 text-sm text-muted">
                            Your marker collections will appear here.
                        </p>
                    </div>
                ) : (
                    <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {memberships.map((membership) => {
                            const collection = membership.collection;
                            const role =
                                membership.role.charAt(0) +
                                membership.role.slice(1).toLowerCase();

                            return (
                                <Link
                                    key={membership.id}
                                    href={`/collections/${collection.id}`}
                                    className="block rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
                                            <FolderHeart size={24} />
                                        </div>

                                        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                                            {role}
                                        </span>
                                    </div>

                                    <h2 className="mt-5 text-lg font-semibold">
                                        {collection.name}
                                    </h2>

                                    <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted">
                                        {collection.description || "No description"}
                                    </p>

                                    <div className="mt-5 border-t border-border pt-4">
                                        <p className="text-sm text-muted">
                                            {collection._count.markers}{" "}
                                            {collection._count.markers === 1
                                                ? "marker"
                                                : "markers"}
                                        </p>
                                    </div>
                                </Link>
                            );
                        })}
                    </section>
                )}
            </div>
        </main>
    );
}
