
import { GoogleGenAI } from "@google/genai";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { R2_BUCKET, r2 } from "@/lib/r2";

export const runtime = "nodejs";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function getText(value: unknown, maxLength = 500): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function getCoordinate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1000, Math.round(value)));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate the user.
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    // 2. Validate the request.
    const body = await request.json();
    const collectionId = body.collectionId;

    if (
      typeof collectionId !== "string" ||
      collectionId.length === 0
    ) {
      return NextResponse.json(
        { error: "Please select a marker collection." },
        { status: 400 }
      );
    }

    const { id: projectId } = await params;

    // 3. Only allow the owner of the project to analyze it.
    const project = await prisma.coloringProject.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      );
    }

    // 4. Verify that the user belongs to the selected collection.
    const membership = await prisma.collectionMember.findUnique({
      where: {
        userId_collectionId: {
          userId: session.user.id,
          collectionId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You do not have access to this marker collection." },
        { status: 403 }
      );
    }

    // 5. Retrieve the available markers.
    const markers = await prisma.marker.findMany({
      where: {
        collectionId,
      },
      select: {
        id: true,
        brand: true,
        name: true,
        code: true,
        hexColor: true,
      },
      orderBy: [
        { brand: "asc" },
        { name: "asc" },
      ],
    });

    if (markers.length === 0) {
      return NextResponse.json(
        { error: "This collection does not contain any markers yet." },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "The Gemini API key is not configured." },
        { status: 500 }
      );
    }

    // 6. Retrieve the original image from private R2 storage.
    const object = await r2.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: project.imageKey,
      })
    );

    if (!object.Body) {
      return NextResponse.json(
        { error: "The project image could not be found." },
        { status: 404 }
      );
    }

    const contentType = object.ContentType ?? "";

    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: "The project image has an unsupported format." },
        { status: 400 }
      );
    }

    if (
      typeof object.ContentLength === "number" &&
      object.ContentLength > MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        { error: "The project image exceeds the maximum file size." },
        { status: 413 }
      );
    }

    const imageBytes = await object.Body.transformToByteArray();

    if (
      imageBytes.byteLength === 0 ||
      imageBytes.byteLength > MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        { error: "The project image has an invalid file size." },
        { status: 400 }
      );
    }

    // 7. Prepare the available marker palette for Gemini.
    const markerPalette = markers.map((marker) => ({
      id: marker.id,
      brand: marker.brand,
      name: marker.name,
      code: marker.code,
      hexColor: marker.hexColor,
    }));

    // 8. Analyze the coloring page with Gemini.
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          inlineData: {
            mimeType: contentType,
            data: Buffer.from(imageBytes).toString("base64"),
          },
        },
        `
You are an expert coloring-page analysis assistant.

Analyze the supplied black-and-white coloring page.

Your task is to identify the main objects and the individual areas
that a person could color.

For every identified area:
- Give it a unique ID.
- Identify the object it belongs to.
- Describe the specific area that should be colored.
- Describe its approximate location in the image.
- Suggest the most suitable marker from the supplied marker palette.
- Explain briefly why that marker is suitable.
- Give a confidence score from 0 to 100.

The marker palette is the complete list of markers available to the user.
You MUST only suggest markers from this list.
Never invent marker IDs, brands, names, codes or HEX colors.

MARKER PALETTE:
${JSON.stringify(markerPalette)}

POSITION FORMAT:
Return an approximate bounding box for each area.
Coordinates must use a scale from 0 to 1000:
- x: left edge
- y: top edge
- width: bounding box width
- height: bounding box height

The origin (0, 0) is the top-left corner of the image.
These coordinates are approximate visual estimates, not pixel-perfect
segmentation boundaries.

ANALYSIS RULES:
- Preserve the original objects and their outlines.
- Identify distinct areas separately when they can reasonably receive
  different colors.
- Do not create areas that are not present in the drawing.
- Avoid splitting one continuous area unnecessarily.
- Do not assign a marker to an area if no suitable marker exists.
  In that case, use null for suggestedMarkerId.
- Do not mistake text, shadows or background artifacts for objects.
- Focus on areas that are actually intended to be colored.
- Keep descriptions concise and practical.
- Do not claim that the bounding boxes precisely follow the outlines.

CONFIDENCE:
- 90-100: Clearly identifiable area and suitable color.
- 70-89: Likely correct, with some uncertainty.
- 40-69: Ambiguous area or color choice.
- 0-39: Very uncertain.

Return ONLY valid JSON in this exact structure:

{
  "summary": "A short description of the coloring page.",
  "regions": [
    {
      "id": "region-1",
      "object": "Flower",
      "area": "Large outer petals",
      "position": {
        "x": 200,
        "y": 150,
        "width": 300,
        "height": 250
      },
      "suggestedMarkerId": "EXACT_MARKER_ID_FROM_PALETTE",
      "reasoning": "A light pink shade works well for the petals.",
      "confidence": 92
    }
  ]
}

If no suitable coloring areas can be identified, return an empty
regions array.
        `,
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const output = response.text;

    if (!output) {
      return NextResponse.json(
        { error: "Gemini did not return any analysis." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(output);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.regions)
    ) {
      return NextResponse.json(
        { error: "Gemini returned an invalid analysis." },
        { status: 502 }
      );
    }

    // 9. Only accept marker IDs that actually exist in this collection.
    const availableMarkers = new Map(
      markers.map((marker) => [marker.id, marker])
    );

    const regions = parsed.regions
      .filter((region: unknown) => {
        return (
          region !== null &&
          typeof region === "object" &&
          !Array.isArray(region)
        );
      })
      .slice(0, 100)
      .map((region: Record<string, unknown>, index: number) => {
        const position =
          region.position &&
          typeof region.position === "object" &&
          !Array.isArray(region.position)
            ? region.position as Record<string, unknown>
            : {};

        const requestedMarkerId =
          typeof region.suggestedMarkerId === "string"
            ? region.suggestedMarkerId
            : null;

        const marker = requestedMarkerId
          ? availableMarkers.get(requestedMarkerId) ?? null
          : null;

        return {
          id: getText(region.id, 80) || `region-${index + 1}`,
          object: getText(region.object, 120),
          area: getText(region.area, 200),

          position: {
            x: getCoordinate(position.x),
            y: getCoordinate(position.y),
            width: getCoordinate(position.width),
            height: getCoordinate(position.height),
          },

          suggestedMarker: marker
            ? {
                id: marker.id,
                brand: marker.brand,
                name: marker.name,
                code: marker.code,
                hexColor: marker.hexColor,
              }
            : null,

          reasoning: getText(region.reasoning, 300),
          confidence: getConfidence(region.confidence),
        };
      });

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
      },
      collection: {
        id: collectionId,
        markerCount: markers.length,
      },
      summary: getText(parsed.summary, 1000),
      regions,
    });

  } catch (error) {
    console.error("Coloring page analysis failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error while analyzing the coloring page.",
      },
      { status: 500 }
    );
  }
}
