
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  LoaderCircle,
  X,
  Plus,
  Trash2,
  Check,
} from "lucide-react";

type DetectedMarker = {
    brand: string;
    name: string;
    code: string;
    hexColor: string | null;
    confidence: {
      brand: number;
      name: number;
      code: number;
      hexColor: number;
    };
  };

export default function ScanView({
  collectionId,
  collectionName,
}: {
  collectionId: string;
  collectionName: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [markers, setMarkers] = useState<DetectedMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleFileChange(selectedFile?: File) {
    if (!selectedFile) return;

    setError("");
    setSuccess("");
    setMarkers([]);

    if (!["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)) {
      setError("Please select a JPEG, PNG or WebP image.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("The image must be smaller than 10 MB.");
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(selectedFile);
  }

  function clearImage() {
    setFile(null);
    setPreview("");
    setMarkers([]);
    setError("");
    setSuccess("");
  }

  async function scanMarkers() {
    if (!file) return;

    setLoading(true);
    setError("");
    setSuccess("");
    setMarkers([]);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(
        `/api/collections/${collectionId}/scan`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not scan the image.");
      }

      setMarkers(data.markers);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while scanning."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateMarker(
    index: number,
    field: keyof DetectedMarker,
    value: string
  ) {
    setMarkers((current) =>
      current.map((marker, markerIndex) =>
        markerIndex === index
          ? { ...marker, [field]: value }
          : marker
      )
    );

    setSuccess("");
  }

  function addMarker() {
    setMarkers((current) => [
      ...current,
      {
        brand: "",
        name: "",
        code: "",
        hexColor: null,
        confidence: {
          brand: 100,
          name: 100,
          code: 100,
          hexColor: 100,
        },
      },
    ]);
  
    setSuccess("");
  }

  function getConfidenceLabel(score: number) {
    if (score >= 90) return "High confidence";
    if (score >= 70) return "Medium confidence";
    return "Needs review";
  }

  function confidenceIndicator(score: number) {
    const color =
      score >= 90
        ? "text-green-700"
        : score >= 70
          ? "text-amber-700"
          : "text-red-600";
  
    return (
      <p className={`mt-1.5 text-xs ${color}`}>
        {getConfidenceLabel(score)} · {score}%
      </p>
    );
  }

  function removeMarker(index: number) {
    setMarkers((current) =>
      current.filter((_, markerIndex) => markerIndex !== index)
    );

    setSuccess("");
  }

  const invalidMarkers = markers.filter((marker) => {
    return (
      !marker.brand.trim() ||
      !marker.name.trim() ||
      !marker.code.trim() ||
      !marker.hexColor ||
      !/^#[0-9A-Fa-f]{6}$/.test(marker.hexColor)
    );
  });

  async function importMarkers() {
    if (markers.length === 0 || invalidMarkers.length > 0) {
      setError("Please complete all marker fields before importing.");
      return;
    }

    setImporting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/collections/${collectionId}/markers/bulk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ markers }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not import the markers.");
      }

      setSuccess(
        `Successfully imported ${data.imported} markers. ${
          data.skipped > 0
            ? `${data.skipped} duplicate markers were skipped.`
            : ""
        }`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while importing."
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/collections/${collectionId}`}
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to {collectionName}
        </Link>

        <header className="mb-10">
          <p className="text-sm font-medium tracking-widest text-primary">
            MARKER SCANNER
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Scan your markers
          </h1>

          <p className="mt-3 text-muted">
            Upload a photo, review the detected markers and add them to your
            collection.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
          {!preview ? (
            <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-background p-8 text-center transition hover:border-primary">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
                <ImagePlus size={28} />
              </div>

              <h2 className="text-lg font-semibold">
                Upload a photo of your markers
              </h2>

              <p className="mt-2 text-sm text-muted">
                Select a photo or take one with your camera.
              </p>

              <span className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white">
                Choose photo
              </span>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0])
                }
              />
            </label>
          ) : (
            <div>
              <div className="relative overflow-hidden rounded-2xl bg-background">
                <img
                  src={preview}
                  alt="Selected marker photo"
                  className="max-h-[480px] w-full object-contain"
                />

                <button
                  onClick={clearImage}
                  aria-label="Remove selected image"
                  className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-white hover:bg-black"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="mt-3 text-sm text-muted">{file?.name}</p>

              <button
                onClick={scanMarkers}
                disabled={loading}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Scanning markers...
                  </>
                ) : (
                  <>
                    <Camera size={18} />
                    Scan photo
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>

        {markers.length > 0 && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Review detected markers
                </h2>

                <p className="mt-2 text-sm text-muted">
                  {markers.length} markers detected. Check and edit the
                  information before importing.
                </p>
              </div>

              <button
                onClick={addMarker}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium transition hover:bg-secondary"
              >
                <Plus size={16} />
                Add marker
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {markers.map((marker, index) => {
                const invalid = invalidMarkers.includes(marker);

                return (
                  <div
                    key={index}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-medium text-muted">
                        Marker {index + 1}
                      </p>

                      <button
                        onClick={() => removeMarker(index)}
                        aria-label={`Remove marker ${index + 1}`}
                        className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          Brand
                        </span>
                        <input
                          value={marker.brand}
                          onChange={(event) =>
                            updateMarker(index, "brand", event.target.value)
                          }
                          placeholder="e.g. Copic"
                          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                        />
                      </label>
                      {confidenceIndicator(marker.confidence.brand)}

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          Color name
                        </span>
                        <input
                          value={marker.name}
                          onChange={(event) =>
                            updateMarker(index, "name", event.target.value)
                          }
                          placeholder="e.g. Cherry"
                          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                        />
                      </label>
                      {confidenceIndicator(marker.confidence.name)}
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          Color code
                        </span>
                        <input
                          value={marker.code}
                          onChange={(event) =>
                            updateMarker(index, "code", event.target.value)
                          }
                          placeholder="e.g. R215"
                          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                        />
                      </label>
                      {confidenceIndicator(marker.confidence.code)}
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          HEX color
                        </span>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={
                              marker.hexColor &&
                              /^#[0-9A-Fa-f]{6}$/.test(marker.hexColor)
                                ? marker.hexColor
                                : "#808080"
                            }
                            onChange={(event) =>
                              updateMarker(
                                index,
                                "hexColor",
                                event.target.value.toUpperCase()
                              )
                            }
                            className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-card p-1"
                          />

                          <input
                            value={marker.hexColor ?? ""}
                            onChange={(event) =>
                              updateMarker(
                                index,
                                "hexColor",
                                event.target.value.toUpperCase()
                              )
                            }
                            placeholder="#RRGGBB"
                            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                          />
                        </div>
                      </label>
                      {confidenceIndicator(marker.confidence.hexColor)}
                    </div>

                    {invalid && (
                      <p className="mt-3 text-xs text-red-600">
                        Complete all fields and enter a valid HEX color.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-border pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted">
                  {invalidMarkers.length > 0 ? (
                    <span>
                      {invalidMarkers.length} markers need attention.
                    </span>
                  ) : (
                    <span>
                      All markers are ready to import.
                    </span>
                  )}
                </div>

                <button
                  onClick={importMarkers}
                  disabled={
                    importing ||
                    markers.length === 0 ||
                    invalidMarkers.length > 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <LoaderCircle size={18} className="animate-spin" />
                      Importing markers...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Import {markers.length} markers
                    </>
                  )}
                </button>
              </div>

              {success && (
                <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
                  <p>{success}</p>
                  <Link
                    href={`/collections/${collectionId}`}
                    className="mt-2 inline-flex font-medium underline"
                  >
                    View collection
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
