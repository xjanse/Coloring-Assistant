
"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { Camera } from "lucide-react";

type Marker = {
    id: string;
    brand: string;
    name: string;
    code: string;
    hexColor: string;
};

type Collection = {
    id: string;
    name: string;
    description: string | null;
    markers: Marker[];
};

export default function CollectionView({
    collection,
    role,
}: {
    collection: Collection;
    role: string;
}) {
    const [markers, setMarkers] = useState(collection.markers);
    const [search, setSearch] = useState("");
    const [editingMarker, setEditingMarker] = useState<Marker | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [sortBy, setSortBy] = useState("brand");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    const canEdit = role === "OWNER" || role === "EDITOR";

    const filteredMarkers = useMemo(() => {
        const query = search.toLowerCase().trim();

        const filtered = markers.filter((marker) =>
            [
                marker.brand,
                marker.name,
                marker.code,
                marker.hexColor,
            ].some((value) => value.toLowerCase().includes(query))
        );

        return filtered.sort((a, b) => {
            let comparison = 0;

            if (sortBy === "color") {
                comparison = a.hexColor.localeCompare(b.hexColor);
            } else {
                const valueA = a[sortBy as "brand" | "name" | "code"];
                const valueB = b[sortBy as "brand" | "name" | "code"];

                comparison = valueA.localeCompare(valueB, undefined, {
                    numeric: true,
                    sensitivity: "base",
                });
            }

            return sortDirection === "asc" ? comparison : -comparison;
        });
    }, [markers, search, sortBy, sortDirection]);

    function openAddForm() {
        setEditingMarker(null);
        setMessage("");
        setShowForm(true);
    }

    function openEditForm(marker: Marker) {
        setEditingMarker(marker);
        setMessage("");
        setShowForm(true);
    }

    async function handleSave(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setMessage("");

        const formData = new FormData(event.currentTarget);

        const markerData = {
            brand: String(formData.get("brand") ?? ""),
            name: String(formData.get("name") ?? ""),
            code: String(formData.get("code") ?? ""),
            hexColor: String(formData.get("hexColor") ?? ""),
        };

        try {
            const response = await fetch(
                editingMarker
                    ? `/api/markers/${editingMarker.id}`
                    : `/api/collections/${collection.id}/markers`,
                {
                    method: editingMarker ? "PATCH" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(markerData),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setMessage(data.error ?? "Could not save marker.");
                return;
            }

            if (editingMarker) {
                setMarkers((current) =>
                    current.map((marker) =>
                        marker.id === data.marker.id ? data.marker : marker
                    )
                );
            } else {
                setMarkers((current) => [...current, data.marker]);
            }

            setShowForm(false);
            setEditingMarker(null);
        } catch {
            setMessage("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(marker: Marker) {
        if (!window.confirm(`Delete ${marker.brand} ${marker.code}?`)) {
            return;
        }

        setMessage("");

        try {
            const response = await fetch(`/api/markers/${marker.id}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (!response.ok) {
                setMessage(data.error ?? "Could not delete marker.");
                return;
            }

            setMarkers((current) =>
                current.filter((item) => item.id !== marker.id)
            );
        } catch {
            setMessage("Something went wrong. Please try again.");
        }
    }

    return (
        <>
            <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-sm font-medium tracking-widest text-primary">
                        MARKER COLLECTION
                    </p>

                    <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                        {collection.name}
                    </h1>

                    <p className="mt-3 text-muted">
                        {collection.description || "Manage your marker collection."}
                    </p>

                    <p className="mt-3 text-sm text-muted">
                        {markers.length} {markers.length === 1 ? "marker" : "markers"}
                        {" · "}
                        {role.charAt(0) + role.slice(1).toLowerCase()}
                    </p>
                </div>

                {canEdit && (
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href={`/collections/${collection.id}/scan`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 font-medium transition hover:bg-secondary"
                        >
                            <Camera size={18} />
                            Scan markers
                        </Link>

                        <button
                            onClick={openAddForm}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-white transition hover:opacity-90"
                        >
                            <Plus size={18} />
                            Add marker
                        </button>
                    </div>
                )}
            </header>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <span className="text-sm font-medium text-muted">
                    Sort collection:
                </span>

                <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
                >
                    <option value="brand">Brand</option>
                    <option value="name">Name</option>
                    <option value="code">Color code</option>
                    <option value="color">Color</option>
                </select>

                <button
                    type="button"
                    onClick={() =>
                        setSortDirection((current) =>
                            current === "asc" ? "desc" : "asc"
                        )
                    }
                    className="rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-secondary"
                >
                    {sortDirection === "asc" ? "Ascending ↑" : "Descending ↓"}
                </button>
            </div>
            {message && !showForm && (
                <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                    {message}
                </p>
            )}

            {showForm && (
                <section className="mb-8 rounded-2xl border border-border bg-card p-6">
                    <div className="mb-6 flex items-center justify-between">

                        <h2 className="text-xl font-semibold">
                            {editingMarker ? "Edit marker" : "Add marker"}
                        </h2>

                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            aria-label="Close form"
                            className="rounded-lg p-2 hover:bg-secondary"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium">Brand</label>
                            <input
                                name="brand"
                                defaultValue={editingMarker?.brand ?? ""}
                                required
                                maxLength={50}
                                placeholder="e.g. Ohuhu"
                                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">Marker name</label>
                            <input
                                name="name"
                                defaultValue={editingMarker?.name ?? ""}
                                required
                                maxLength={80}
                                placeholder="e.g. Pale Pink"
                                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">Color code</label>
                            <input
                                name="code"
                                defaultValue={editingMarker?.code ?? ""}
                                required
                                maxLength={30}
                                placeholder="e.g. R18"
                                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">HEX color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    name="hexColor"
                                    defaultValue={editingMarker?.hexColor ?? "#E8A6C8"}
                                    className="h-12 w-14 cursor-pointer rounded-lg border border-border bg-background p-1"
                                />
                                <span className="flex items-center text-sm text-muted">
                                    Choose the marker's representative color.
                                </span>
                            </div>
                        </div>

                        {message && (
                            <p className="text-sm text-red-600 sm:col-span-2">
                                {message}
                            </p>
                        )}

                        <div className="flex gap-3 sm:col-span-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="rounded-xl bg-primary px-5 py-3 font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                                {loading ? "Saving..." : "Save marker"}
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="rounded-xl border border-border px-5 py-3 font-medium hover:bg-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <div className="mb-6">
                <div className="relative">
                    <Search
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                    />

                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by brand, name or color code..."
                        className="w-full rounded-xl border border-border bg-card py-3 pl-11 pr-4 outline-none focus:border-primary"
                    />
                </div>
            </div>

            {filteredMarkers.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-10 text-center">
                    <Search size={32} className="mx-auto text-muted" />

                    <h2 className="mt-4 text-xl font-semibold">
                        {markers.length === 0
                            ? "Your collection is empty"
                            : "No markers found"}
                    </h2>

                    <p className="mt-2 text-sm text-muted">
                        {markers.length === 0
                            ? canEdit
                                ? "Add your first marker to get started."
                                : "There are no markers in this collection yet."
                            : "Try searching with another term."}
                    </p>
                </div>
            ) : (
                <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {filteredMarkers.map((marker) => (
                        <article
                            key={marker.id}
                            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                        >
                            <div
                                className="h-28 w-full"
                                style={{ backgroundColor: marker.hexColor }}
                            />

                            <div className="p-4">
                                <p className="truncate text-xs font-medium text-muted">
                                    {marker.brand}
                                </p>

                                <h3 className="mt-1 truncate font-semibold">
                                    {marker.name}
                                </h3>

                                <div className="mt-3 flex items-center justify-between gap-2">
                                    <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium">
                                        {marker.code}
                                    </span>

                                    <span className="text-xs text-muted">
                                        {marker.hexColor.toUpperCase()}
                                    </span>
                                </div>

                                {canEdit && (
                                    <div className="mt-4 flex gap-2 border-t border-border pt-3">
                                        <button
                                            onClick={() => openEditForm(marker)}
                                            aria-label={`Edit ${marker.code}`}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary py-2 text-sm hover:opacity-80"
                                        >
                                            <Pencil size={15} />
                                            Edit
                                        </button>

                                        <button
                                            onClick={() => handleDelete(marker)}
                                            aria-label={`Delete ${marker.code}`}
                                            className="flex items-center justify-center rounded-lg px-3 text-red-500 hover:bg-red-50"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </article>
                    ))}
                </section>
            )}
        </>
    );
}
