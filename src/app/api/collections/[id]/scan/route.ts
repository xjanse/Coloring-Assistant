
import { GoogleGenAI } from "@google/genai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session) {
            return Response.json(
                { error: "You must be logged in." },
                { status: 401 }
            );
        }

        const { id } = await params;

        const membership = await prisma.collectionMember.findUnique({
            where: {
                userId_collectionId: {
                    userId: session.user.id,
                    collectionId: id,
                },
            },
        });

        if (
            !membership ||
            !["OWNER", "EDITOR"].includes(membership.role)
        ) {
            return Response.json(
                { error: "You do not have permission to scan this collection." },
                { status: 403 }
            );
        }

        const formData = await request.formData();
        const file = formData.get("image");

        if (!(file instanceof File)) {
            return Response.json(
                { error: "Please upload an image." },
                { status: 400 }
            );
        }

        if (!allowedTypes.includes(file.type)) {
            return Response.json(
                { error: "Only JPEG, PNG and WebP images are supported." },
                { status: 400 }
            );
        }

        if (file.size > 10 * 1024 * 1024) {
            return Response.json(
                { error: "The image must be smaller than 10 MB." },
                { status: 400 }
            );
        }

        if (file.size === 0) {
            return Response.json(
                { error: "The uploaded image is empty." },
                { status: 400 }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return Response.json(
                { error: "The Gemini API key is not configured." },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
        });

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [
                {
                    inlineData: {
                        mimeType: file.type,
                        data: base64,
                    },
                },
                `
You are an assistant that identifies alcohol markers from photographs.

Examine the image and identify every individual alcohol marker that
is clearly visible.

For each marker, extract:
- brand: the marker manufacturer
- name: the color name, only if clearly visible or confidently identifiable
- code: the printed color code on the marker
- hexColor: an estimated HEX color based on the visible marker color,
  in the format #RRGGBB. Use null if it cannot be estimated reliably.

Also provide a confidence score from 0 to 100 for EACH field:
- brandConfidence
- nameConfidence
- codeConfidence
- hexColorConfidence

Confidence guidelines:
- 90-100: Clearly readable or highly certain.
- 70-89: Probably correct, but some uncertainty.
- 40-69: Partially readable or estimated.
- 0-39: Unclear, guessed or not identifiable.

Do not give high confidence to information that is guessed.
If a field is empty or null, its confidence must be 0.
HEX confidence should reflect how accurately the actual marker color
can be estimated from the photograph.

Important rules:
- Do not invent marker codes or brands.
- Do not guess text that is unreadable.
- Ignore objects that are not alcohol markers.
- Do not list the same marker twice.
- If a field cannot be identified, use an empty string.
- If no markers can be identified, return an empty array.

Return a JSON object in this exact format:

{
  "markers": [
    {
      "brand": "Copic",
      "name": "Cherry",
      "code": "R215",
      "hexColor": "#AABBCC",
      "brandConfidence": 98,
      "nameConfidence": 95,
      "codeConfidence": 72,
      "hexColorConfidence": 55
    }
  ]
}
        `,
            ],
            config: {
                responseMimeType: "application/json",
            },
        });

        const output = response.text;

        if (!output) {
            return Response.json(
                { error: "Gemini did not return any results." },
                { status: 502 }
            );
        }

        const parsed = JSON.parse(output);

        if (!parsed || !Array.isArray(parsed.markers)) {
            return Response.json(
                { error: "Gemini returned an invalid marker list." },
                { status: 502 }
            );
        }

        function getConfidence(value: unknown): number {
            if (typeof value !== "number" || !Number.isFinite(value)) {
                return 0;
            }

            return Math.max(0, Math.min(100, Math.round(value)));
        }

        const markers = parsed.markers
            .filter((marker: unknown) => {
                return (
                    marker !== null &&
                    typeof marker === "object" &&
                    !Array.isArray(marker)
                );
            })
            .map((marker: Record<string, unknown>) => {
                const hexColor =
                    typeof marker.hexColor === "string" &&
                        /^#[0-9A-Fa-f]{6}$/.test(marker.hexColor)
                        ? marker.hexColor.toUpperCase()
                        : null;

                return {
                    brand: typeof marker.brand === "string" ? marker.brand : "",
                    name: typeof marker.name === "string" ? marker.name : "",
                    code: typeof marker.code === "string" ? marker.code : "",
                    hexColor,

                    confidence: {
                        brand: getConfidence(marker.brandConfidence),
                        name: getConfidence(marker.nameConfidence),
                        code: getConfidence(marker.codeConfidence),
                        hexColor: getConfidence(marker.hexColorConfidence),
                    },
                };
            });

        return Response.json({ markers });
    } catch (error) {
        console.error("Marker scan error:", error);

        return Response.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown error while scanning the image.",
            },
            { status: 500 }
        );
    }
}
