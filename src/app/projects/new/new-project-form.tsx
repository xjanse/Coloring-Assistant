
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Upload,
  X,
} from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

async function readJsonResponse(
    response: Response,
    step: string
  ) {
    const responseText = await response.text();
  
    let data;
  
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(`[${step}] Non-JSON response:`, {
        status: response.status,
        contentType: response.headers.get("content-type"),
        body: responseText.slice(0, 1000),
      });
  
      throw new Error(
        `${step}: server returned an invalid response (HTTP ${response.status}). Check the terminal for details.`
      );
    }
  
    if (!response.ok) {
      throw new Error(
        data.error || `${step} failed (HTTP ${response.status}).`
      );
    }
  
    return data;
  }
  

export default function NewProjectForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFileChange(
    selectedFile: File | undefined
  ) {
    setError("");
    setSuccess(false);

    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError("Choose a JPG, PNG or WEBP image.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("The image cannot be larger than 10 MB.");
      return;
    }

    setFile(selectedFile);

    if (!title.trim()) {
      setTitle(
        selectedFile.name.replace(/\.[^/.]+$/, "")
      );
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!file) {
      setError("Please select an image first.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a project name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Reserve storage and request upload token
      const reservationResponse = await fetch(
        "/api/projects/upload",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contentType: file.type,
            size: file.size,
          }),
        }
      );

      const reservation = await readJsonResponse(
        reservationResponse,
        "Storage reservation"
      );

      // 2. Upload directly to Cloudflare R2 through Worker
      const uploadResponse = await fetch(
        reservation.uploadUrl,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${reservation.token}`,
            "Content-Type": file.type,
          },
          body: file,
        }
      );

      const uploadResult = await readJsonResponse(
        uploadResponse,
        "Cloudflare upload"
      );

      // 3. Verify upload and create project
      const completeResponse = await fetch(
        "/api/projects/upload/complete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reservationId: reservation.reservationId,
            title: title.trim(),
          }),
        }
      );

      const completion = await readJsonResponse(
        completeResponse,
        "Project completion"
      );

      setSuccess(true);
      setFile(null);
      setTitle("");

    } catch (err) {
      console.error("Project upload failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-2xl">

        <button
          type="button"
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold">
            New coloring project
          </h1>

          <p className="mt-2 text-muted-foreground">
            Upload a coloring page to start a new project.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          <div>
            <label className="mb-2 block text-sm font-medium">
              Project name
            </label>

            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="My coloring project"
              maxLength={100}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Coloring page
            </label>

            {!preview ? (
              <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 p-8 text-center transition hover:border-primary">
                <ImagePlus
                  size={36}
                  className="mb-4 text-muted-foreground"
                />

                <span className="font-medium">
                  Choose an image
                </span>

                <span className="mt-2 text-sm text-muted-foreground">
                  JPG, PNG or WEBP · Maximum 10 MB
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0])
                  }
                />
              </label>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/20 p-4">
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="absolute right-6 top-6 z-10 rounded-full bg-background p-2 shadow"
                  aria-label="Remove image"
                >
                  <X size={18} />
                </button>

                <img
                  src={preview}
                  alt="Coloring page preview"
                  className="mx-auto max-h-[500px] max-w-full rounded-lg object-contain"
                />

                <p className="mt-3 text-center text-sm text-muted-foreground">
                  {file?.name}
                </p>

                <label className="mt-3 block cursor-pointer text-center text-sm text-primary hover:underline">
                  Choose another image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) =>
                      handleFileChange(event.target.files?.[0])
                    }
                  />
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700">
              Your coloring project was successfully created!
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !file || !title.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Create project
              </>
            )}
          </button>

        </form>
      </div>
    </main>
  );
}
