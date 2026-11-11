
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Palette,
  AlertCircle,
  ImagePlus,
  WandSparkles,
} from "lucide-react";

type MarkerCollection = {
  id: string;
  name: string;
  markerCount: number;
};

type SuggestedMarker = {
  id: string;
  brand: string;
  name: string;
  code: string;
  hexColor: string;
};

type ColoringRegion = {
  id: string;
  object: string;
  area: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  suggestedMarker: SuggestedMarker | null;
  reasoning: string;
  confidence: number;
};

type AnalysisResult = {
  success: boolean;
  project: {
    id: string;
    title: string;
  };
  collection: {
    id: string;
    markerCount: number;
  };
  summary: string;
  regions: ColoringRegion[];
};

type ColoringStyle =
  | "anime"
  | "watercolor"
  | "realistic"
  | "cute-pastel"
  | "fantasy"
  | "comic";

type Props = {
  projectId: string;
  collections: MarkerCollection[];
  initialGeneratedStyle: string | null;
  initialCustomInstructions: string | null;
  initialGeneratedAt: string | null;
};

const STYLES: {
  id: ColoringStyle;
  name: string;
  description: string;
}[] = [
  {
    id: "anime",
    name: "Anime",
    description: "Expressive colors, crisp highlights and cel-shading.",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    description: "Soft pigment layers, gradients and paper texture.",
  },
  {
    id: "realistic",
    name: "Realistic",
    description: "Natural lighting, detailed shadows and material textures.",
  },
  {
    id: "cute-pastel",
    name: "Cute / Pastel",
    description: "Soft colors, gentle shading and a dreamy appearance.",
  },
  {
    id: "fantasy",
    name: "Fantasy",
    description: "Rich colors, dramatic lighting and magical details.",
  },
  {
    id: "comic",
    name: "Comic",
    description: "Bold colors, graphic shadows and halftone textures.",
  },
];

function isColoringStyle(value: string | null): value is ColoringStyle {
  return STYLES.some((style) => style.id === value);
}

export default function ProjectAnalysis({
  projectId,
  collections,
  initialGeneratedStyle,
  initialCustomInstructions,
  initialGeneratedAt,
}: Props) {
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    collections[0]?.id ?? ""
  );

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const [selectedStyle, setSelectedStyle] = useState<ColoringStyle>(
    isColoringStyle(initialGeneratedStyle)
      ? initialGeneratedStyle
      : "realistic"
  );

  const [customInstructions, setCustomInstructions] = useState(
    initialCustomInstructions ?? ""
  );

  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationError, setGenerationError] = useState("");

  const generatedImageUrl = generatedAt
    ? `/api/projects/${projectId}/generated-image?v=${encodeURIComponent(generatedAt)}`
    : null;

  async function handleAnalyze() {
    if (!selectedCollectionId || analysisLoading) {
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysis(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            collectionId: selectedCollectionId,
          }),
        }
      );

      const responseText = await response.text();

      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `The server returned an invalid response (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Could not analyze the coloring page."
        );
      }

      setAnalysis(data as AnalysisResult);
    } catch (err) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : "Something went wrong during analysis."
      );
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedCollectionId || generationLoading) {
      return;
    }

    setGenerationLoading(true);
    setGenerationError("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            collectionId: selectedCollectionId,
            style: selectedStyle,
            customInstructions: customInstructions.trim(),
          }),
        }
      );

      const responseText = await response.text();

      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `The server returned an invalid response (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Could not generate the colored image."
        );
      }

      if (!data.generatedAt) {
        throw new Error(
          "The image was generated, but the server did not return its creation date. Refresh the project to check the result."
        );
      }

      setGeneratedAt(data.generatedAt);
    } catch (err) {
      setGenerationError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the image."
      );
    } finally {
      setGenerationLoading(false);
    }
  }

  return (
    <section className="mt-10 space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Sparkles size={22} className="text-primary" />
          </div>

          <div>
            <h2 className="text-xl font-semibold">
              AI coloring assistant
            </h2>

            <p className="text-sm text-muted-foreground">
              Analyze your coloring page and create a colored version
              using your own marker collection.
            </p>
          </div>
        </div>

        {collections.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-5">
            <p className="text-sm text-muted-foreground">
              You don't have access to any marker collections yet.
              Create a collection or ask someone to share one with you.
            </p>

            <Link
              href="/collections"
              className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              View marker collections
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <label
                htmlFor="markerCollection"
                className="mb-2 block text-sm font-medium"
              >
                Marker collection
              </label>

              <select
                id="markerCollection"
                value={selectedCollectionId}
                onChange={(event) => {
                  setSelectedCollectionId(event.target.value);
                  setAnalysis(null);
                  setAnalysisError("");
                  setGenerationError("");
                }}
                disabled={analysisLoading || generationLoading}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              >
                {collections.map((collection) => (
                  <option
                    key={collection.id}
                    value={collection.id}
                  >
                    {collection.name} ({collection.markerCount} markers)
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-8 border-t border-border pt-6">
              <div className="flex items-center gap-2">
                <Palette size={19} className="text-primary" />
                <h3 className="font-semibold">
                  Coloring style
                </h3>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Choose how the AI should color your page.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {STYLES.map((style) => {
                  const selected = selectedStyle === style.id;

                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedStyle(style.id)}
                      disabled={generationLoading}
                      aria-pressed={selected}
                      className={`rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/40"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span className="font-medium">
                        {style.name}
                      </span>

                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {style.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6">
                <label
                  htmlFor="customInstructions"
                  className="mb-2 block text-sm font-medium"
                >
                  Your own coloring idea
                  <span className="ml-2 font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>

                <textarea
                  id="customInstructions"
                  value={customInstructions}
                  onChange={(event) =>
                    setCustomInstructions(event.target.value.slice(0, 1000))
                  }
                  disabled={generationLoading}
                  maxLength={1000}
                  rows={4}
                  placeholder="For example: Give the flowers different shades of pink, use a warm sunset palette and add realistic shadows to the objects..."
                  className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-60"
                />

                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {customInstructions.length}/1000
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={
                  generationLoading ||
                  analysisLoading ||
                  !selectedCollectionId
                }
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {generationLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Coloring your page...
                  </>
                ) : (
                  <>
                    <WandSparkles size={18} />
                    {generatedAt ? "Generate new version" : "Generate colored image"}
                  </>
                )}
              </button>

              {generationLoading && (
                <p className="mt-4 text-sm text-muted-foreground">
                  The AI is coloring your page with detailed shadows,
                  highlights and textures. This can take a little while.
                </p>
              )}

              {generationError && (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>{generationError}</p>
                </div>
              )}
            </div>

            <div className="mt-8 border-t border-border pt-6">
              <h3 className="font-semibold">
                Coloring analysis
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Get individual color suggestions for the areas in your
                coloring page.
              </p>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={
                  analysisLoading ||
                  generationLoading ||
                  !selectedCollectionId
                }
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 font-medium transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {analysisLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing coloring page...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Analyze coloring page
                  </>
                )}
              </button>

              {analysisLoading && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Gemini is examining your coloring page and matching
                  its areas with your available markers. This can take
                  a little while.
                </p>
              )}

              {analysisError && (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>{analysisError}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {generatedImageUrl && (
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <ImagePlus size={22} className="text-primary" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                Your colored coloring page
              </h2>

              <p className="text-sm text-muted-foreground">
                Generated using the {STYLES.find(
                  (style) => style.id === selectedStyle
                )?.name ?? "selected"} style.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-medium">
                Original coloring page
              </h3>

              <div className="flex min-h-48 items-center justify-center rounded-xl border border-border bg-muted/20 p-3">
                <img
                  src={`/api/projects/${projectId}/image`}
                  alt="Original coloring page"
                  className="max-h-[650px] max-w-full rounded-lg object-contain"
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium">
                AI colored version
              </h3>

              <div className="flex min-h-48 items-center justify-center rounded-xl border border-border bg-muted/20 p-3">
                <img
                  key={generatedImageUrl}
                  src={generatedImageUrl}
                  alt="AI generated colored coloring page"
                  className="max-h-[650px] max-w-full rounded-lg object-contain"
                />
              </div>
            </div>
          </div>

          {generatedAt && (
            <p className="mt-4 text-xs text-muted-foreground">
              Last generated:{" "}
              {new Date(generatedAt).toLocaleString("en-GB")}
            </p>
          )}
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Palette size={20} className="text-primary" />

              <h2 className="text-xl font-semibold">
                Coloring analysis
              </h2>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {analysis.summary || "No summary was provided."}
            </p>

            <p className="mt-3 text-xs text-muted-foreground">
              Analyzed using {analysis.collection.markerCount} available
              markers. Found {analysis.regions.length} coloring areas.
            </p>
          </div>

          {analysis.regions.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-muted-foreground">
                No coloring areas could be identified. Try another image
                or a clearer scan.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                Suggested coloring areas
              </h3>

              {analysis.regions.map((region, index) => (
                <article
                  key={region.id}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Area {index + 1}
                      </p>

                      <h4 className="mt-1 font-semibold">
                        {region.object}
                      </h4>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {region.area}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">
                        Confidence:{" "}
                      </span>
                      <span className="font-medium">
                        {region.confidence}%
                      </span>
                    </div>
                  </div>

                  {region.suggestedMarker ? (
                    <div className="mt-5 flex items-center gap-3 rounded-xl border border-border p-3">
                      <div
                        className="h-11 w-11 shrink-0 rounded-lg border border-black/10"
                        style={{
                          backgroundColor: region.suggestedMarker.hexColor,
                        }}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {region.suggestedMarker.brand}{" "}
                          {region.suggestedMarker.name}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          Code: {region.suggestedMarker.code}
                          {" · "}
                          {region.suggestedMarker.hexColor}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-dashed border-border p-3">
                      <p className="text-sm text-muted-foreground">
                        No suitable marker was found in this collection.
                      </p>
                    </div>
                  )}

                  {region.reasoning && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {region.reasoning}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
