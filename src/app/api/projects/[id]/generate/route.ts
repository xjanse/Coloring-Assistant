
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
  } from "@aws-sdk/client-s3";
  import { randomUUID } from "crypto";
  import { NextResponse } from "next/server";
  
  import { auth } from "@/lib/auth";
  import { prisma } from "@/lib/prisma";
  import { R2_BUCKET, r2 } from "@/lib/r2";
  
  export const runtime = "nodejs";
  
  const MAX_STORAGE = 8n * 1024n * 1024n * 1024n;
  const MAX_GENERATED_IMAGE_SIZE = 10 * 1024 * 1024;
  const MAX_DAILY_GENERATIONS = 3;
  
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  
  const CLOUDFLARE_MODEL =
    "@cf/runwayml/stable-diffusion-v1-5-img2img";
  
  const STYLES = {
    anime: `
  Anime illustration style:
  Use expressive colors, carefully controlled cel shading,
  layered shadows, bright highlights and clean color transitions.
  Add small details that give the objects depth.
  `,
    watercolor: `
  Watercolor illustration style:
  Use layered transparent pigments, natural color variation,
  soft gradients, subtle paper texture and delicate shadows.
  Keep the original drawing recognizable.
  `,
    realistic: `
  Detailed realistic coloring style:
  Use natural lighting, dimensional shadows, reflected light,
  fine material textures and realistic color variation.
  Make every object feel three-dimensional.
  `,
    "cute-pastel": `
  Cute pastel illustration style:
  Use a harmonious pastel palette, soft gradients,
  gentle shadows, delicate highlights and subtle textures.
  Keep the result detailed rather than flat or simplistic.
  `,
    fantasy: `
  Rich fantasy storybook illustration style:
  Use atmospheric lighting, rich color combinations,
  dramatic shadows, luminous highlights and intricate textures.
  Add visual depth while preserving the original drawing.
  `,
    comic: `
  Detailed comic illustration style:
  Use bold but controlled colors, strong cel shading,
  dramatic highlights, graphic shadows and subtle halftone textures.
  Preserve the original ink outlines.
  `,
  } as const;
  
  type Style = keyof typeof STYLES;
  
  function isNotFoundError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }
  
    const value = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
  
    return (
      value.name === "NotFound" ||
      value.name === "NoSuchKey" ||
      value.$metadata?.httpStatusCode === 404
    );
  }
  
  async function getCloudflareError(response: Response): Promise<string> {
    const text = await response.text();
  
    try {
      const data = JSON.parse(text);
  
      const messages = [
        ...(Array.isArray(data.errors)
          ? data.errors.map((item: { message?: string }) => item.message)
          : []),
        ...(Array.isArray(data.messages)
          ? data.messages.map((item: { message?: string }) => item.message)
          : []),
      ].filter(Boolean);
  
      return messages.join(" ") || `Cloudflare returned HTTP ${response.status}.`;
    } catch {
      return text.slice(0, 500) || `Cloudflare returned HTTP ${response.status}.`;
    }
  }
  
  export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    let reservationActive = false;
    let generationCommitted = false;
    let uploadedKey: string | null = null;
    let reservedBytes = 0n;
  
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
      const style = body.style;
  
      const customInstructions =
        typeof body.customInstructions === "string"
          ? body.customInstructions.trim()
          : "";
  
      if (typeof collectionId !== "string" || !collectionId) {
        return NextResponse.json(
          { error: "Please select a marker collection." },
          { status: 400 }
        );
      }
  
      if (
        typeof style !== "string" ||
        !Object.hasOwn(STYLES, style)
      ) {
        return NextResponse.json(
          { error: "Please select a valid coloring style." },
          { status: 400 }
        );
      }
  
      if (customInstructions.length > 1000) {
        return NextResponse.json(
          { error: "Custom instructions cannot exceed 1000 characters." },
          { status: 400 }
        );
      }
  
      const selectedStyle = style as Style;
      const { id: projectId } = await params;
  
      // 3. Verify project ownership.
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
  
      // 4. Verify collection membership.
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
          { error: "Your selected collection contains no markers." },
          { status: 400 }
        );
      }
  
      // 6. Verify Cloudflare configuration.
      const accountId = process.env.R2_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  
      if (!accountId || !apiToken) {
        return NextResponse.json(
          { error: "Cloudflare Workers AI is not configured." },
          { status: 500 }
        );
      }
  
      // 7. Check the daily generation limit before inference.
      // This check does not increment the counter.
      const today = new Date().toISOString().slice(0, 10);
  
      const currentQuota = await prisma.storageQuota.findUnique({
        where: {
          id: "global",
        },
        select: {
          aiGenerationsToday: true,
          aiUsageDate: true,
        },
      });
  
      if (
        currentQuota?.aiUsageDate === today &&
        currentQuota.aiGenerationsToday >= MAX_DAILY_GENERATIONS
      ) {
        throw new Error("DAILY_AI_LIMIT_REACHED");
      }
  
      // 8. Retrieve the original image from R2.
      const originalObject = await r2.send(
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: project.imageKey,
        })
      );
  
      if (!originalObject.Body) {
        return NextResponse.json(
          { error: "The original coloring page could not be found." },
          { status: 404 }
        );
      }
  
      const originalContentType = originalObject.ContentType ?? "";
  
      if (!ALLOWED_TYPES.includes(originalContentType)) {
        return NextResponse.json(
          { error: "The original image has an unsupported format." },
          { status: 400 }
        );
      }
  
      if (
        typeof originalObject.ContentLength === "number" &&
        originalObject.ContentLength > MAX_GENERATED_IMAGE_SIZE
      ) {
        return NextResponse.json(
          { error: "The original image is too large." },
          { status: 413 }
        );
      }
  
      const originalBytes =
        await originalObject.Body.transformToByteArray();
  
      if (
        originalBytes.byteLength === 0 ||
        originalBytes.byteLength > MAX_GENERATED_IMAGE_SIZE
      ) {
        return NextResponse.json(
          { error: "The original image has an invalid size." },
          { status: 400 }
        );
      }
  
      // 9. Check the size of the previous generated image.
      let previousImageSize = 0n;
  
      if (project.generatedImageKey) {
        try {
          const previousObject = await r2.send(
            new HeadObjectCommand({
              Bucket: R2_BUCKET,
              Key: project.generatedImageKey,
            })
          );
  
          previousImageSize = BigInt(
            previousObject.ContentLength ?? 0
          );
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
        }
      }
  
      // 10. Reserve only the additional storage needed.
      reservedBytes = BigInt(
        Math.max(
          0,
          MAX_GENERATED_IMAGE_SIZE -
            Number(
              previousImageSize > BigInt(MAX_GENERATED_IMAGE_SIZE)
                ? BigInt(MAX_GENERATED_IMAGE_SIZE)
                : previousImageSize
            )
        )
      );
  
      await prisma.$transaction(async (tx) => {
        await tx.storageQuota.upsert({
          where: { id: "global" },
          create: {
            id: "global",
            usedBytes: 0n,
            reservedBytes: 0n,
          },
          update: {},
        });
  
        const result = await tx.$executeRaw`
          UPDATE "StorageQuota"
          SET
            "reservedBytes" = "reservedBytes" + ${reservedBytes},
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE
            "id" = 'global'
            AND "usedBytes" + "reservedBytes" + ${reservedBytes}
                <= ${MAX_STORAGE}
        `;
  
        if (result !== 1) {
          throw new Error("STORAGE_QUOTA_EXCEEDED");
        }
      });
  
      reservationActive = true;
  
      // 11. Build the coloring prompt.
      const markerPalette = markers.map((marker) => ({
        brand: marker.brand,
        name: marker.name,
        code: marker.code,
        hexColor: marker.hexColor,
      }));
  
      const prompt = `
  You are an expert coloring artist and professional illustration colorist.
  
  COLOR THE PROVIDED ORIGINAL COLORING PAGE.
  This is an image-to-image editing task, not a request to create a new drawing.
  
  SELECTED ART STYLE:
  ${STYLES[selectedStyle]}
  
  AVAILABLE ALCOHOL MARKERS:
  ${JSON.stringify(markerPalette)}
  
  ${customInstructions
    ? `USER'S PERSONAL CREATIVE INSTRUCTIONS:\n${customInstructions}\n`
    : ""}
  
  COLORING REQUIREMENTS:
  
  1. Preserve the original drawing's composition, objects, proportions,
     perspective and recognizable details.
  
  2. Preserve the original black ink outlines.
     Keep them clear, sharp and visible.
  
  3. Fill the enclosed coloring areas with suitable colors.
     Do not leave the illustration mostly uncolored.
  
  4. Avoid flat, plain, single-color fills.
     Use layered colors, dimensional shadows, highlights,
     reflected light and fine details.
  
  5. Add appropriate material textures:
     - Fur: individual strands and natural color variation.
     - Leaves: veins and subtle tonal variation.
     - Flowers: petal gradients and detailed centers.
     - Wood: grain and natural shading.
     - Metal: reflections and highlights.
     - Fabric: folds and soft shadows.
  
  6. Use colors inspired by the supplied marker palette.
     Prefer the supplied marker colors as the basis for the illustration.
     Blend and layer colors to create shadows and highlights.
  
  7. Apply the selected art style consistently throughout the illustration.
  
  8. Keep the original background and page composition.
     Do not add unrelated objects, text, watermarks or signatures.
  
  9. The result should look like a carefully colored coloring-book
     illustration with substantial detail, shading and depth.
  
  10. Do not redesign or replace the original drawing.
      Preserve its recognizable line art.
  `;
  
      const negativePrompt = `
  different drawing, changed composition, altered objects,
  missing objects, distorted proportions, blurry outlines,
  lost line art, illegible details, text, watermark, signature,
  unfinished coloring, mostly white image, flat colors,
  low detail, excessive noise, artifacts
  `;
  
      // 12. Generate the image using Cloudflare Workers AI.
      // Failed requests do not increment the daily generation counter.
      const cloudflareResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CLOUDFLARE_MODEL}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            negative_prompt: negativePrompt,
            image_b64: Buffer.from(originalBytes).toString("base64"),
            num_steps: 20,
            strength: 0.65,
            guidance: 7.5,
          }),
        }
      );
  
      if (!cloudflareResponse.ok) {
        const cloudflareError =
          await getCloudflareError(cloudflareResponse);
  
        console.error(
          "Cloudflare Workers AI error:",
          cloudflareResponse.status,
          cloudflareError
        );
  
        if (cloudflareResponse.status === 401) {
          throw new Error("CLOUDFLARE_AUTH_ERROR");
        }
  
        if (cloudflareResponse.status === 403) {
          throw new Error("CLOUDFLARE_PERMISSION_ERROR");
        }
  
        if (
          cloudflareResponse.status === 429 ||
          cloudflareResponse.status === 402
        ) {
          throw new Error("CLOUDFLARE_LIMIT_REACHED");
        }
  
        throw new Error(
          `CLOUDFLARE_GENERATION_FAILED: ${cloudflareError}`
        );
      }
  
      const generatedContentType =
        cloudflareResponse.headers
          .get("content-type")
          ?.split(";")[0]
          .trim() ?? "";
  
      if (!ALLOWED_TYPES.includes(generatedContentType)) {
        throw new Error(
          `Cloudflare returned an unsupported image format: ${generatedContentType || "unknown"}.`
        );
      }
  
      const generatedBytes = Buffer.from(
        await cloudflareResponse.arrayBuffer()
      );
  
      if (
        generatedBytes.length === 0 ||
        generatedBytes.length > MAX_GENERATED_IMAGE_SIZE
      ) {
        throw new Error(
          "The generated image is empty or exceeds the 10 MB limit."
        );
      }
  
      // 13. Upload the new image under a unique key.
      const generatedKey =
        `generated/${session.user.id}/${project.id}/${randomUUID()}`;
  
      uploadedKey = generatedKey;
  
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: generatedKey,
          Body: generatedBytes,
          ContentType: generatedContentType,
          Metadata: {
            userid: session.user.id,
            projectid: project.id,
          },
        })
      );
  
      // 14. Atomically replace the project image,
      // update storage accounting and count the successful generation.
      const generatedAt = new Date();
  
      await prisma.$transaction(async (tx) => {
        const projectUpdate = await tx.coloringProject.updateMany({
          where: {
            id: project.id,
            userId: session.user.id,
            generatedImageKey: project.generatedImageKey,
          },
          data: {
            generatedImageKey: generatedKey,
            generatedStyle: selectedStyle,
            customInstructions: customInstructions || null,
            generatedAt,
          },
        });
  
        if (projectUpdate.count !== 1) {
          throw new Error("GENERATION_CONFLICT");
        }
  
        const quotaUpdate = await tx.$executeRaw`
          UPDATE "StorageQuota"
          SET
            "usedBytes" =
              "usedBytes" - ${previousImageSize} + ${BigInt(generatedBytes.length)},
            "reservedBytes" =
              "reservedBytes" - ${reservedBytes},
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE
            "id" = 'global'
            AND "usedBytes" >= ${previousImageSize}
            AND "reservedBytes" >= ${reservedBytes}
        `;
  
        if (quotaUpdate !== 1) {
          throw new Error("STORAGE_ACCOUNTING_ERROR");
        }
  
        // Count only successfully committed generations.
        // This conditional update also protects against concurrent requests.
        const dailyLimitUpdate = await tx.$executeRaw`
          UPDATE "StorageQuota"
          SET
            "aiGenerationsToday" = CASE
              WHEN "aiUsageDate" = ${today}
                THEN "aiGenerationsToday" + 1
              ELSE 1
            END,
            "aiUsageDate" = ${today},
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE
            "id" = 'global'
            AND (
              COALESCE("aiUsageDate", '') != ${today}
              OR "aiGenerationsToday" < ${MAX_DAILY_GENERATIONS}
            )
        `;
  
        if (dailyLimitUpdate !== 1) {
          throw new Error("DAILY_AI_LIMIT_REACHED");
        }
      });
  
      reservationActive = false;
      generationCommitted = true;
  
      // 15. Delete the previous generated image after successful replacement.
      if (project.generatedImageKey) {
        try {
          await r2.send(
            new DeleteObjectCommand({
              Bucket: R2_BUCKET,
              Key: project.generatedImageKey,
            })
          );
        } catch (error) {
          console.error(
            "Could not delete previous generated image:",
            error
          );
  
          // Keep the old image accounted for if deletion failed.
          await prisma.storageQuota.update({
            where: { id: "global" },
            data: {
              usedBytes: {
                increment: previousImageSize,
              },
            },
          });
        }
      }
  
      return NextResponse.json({
        success: true,
        projectId: project.id,
        generatedStyle: selectedStyle,
        generatedAt: generatedAt.toISOString(),
        imageUrl: `/api/projects/${project.id}/generated-image`,
      });
  
    } catch (error) {
      console.error("Coloring image generation failed:", error);
  
      // Remove an uploaded image if the database replacement failed.
      if (uploadedKey && !generationCommitted) {
        try {
          await r2.send(
            new DeleteObjectCommand({
              Bucket: R2_BUCKET,
              Key: uploadedKey,
            })
          );
        } catch (cleanupError) {
          console.error(
            "Could not clean up failed generated image:",
            cleanupError
          );
        }
      }
  
      // Release reserved storage if generation did not complete.
      if (reservationActive && !generationCommitted) {
        try {
          await prisma.$executeRaw`
            UPDATE "StorageQuota"
            SET
              "reservedBytes" = "reservedBytes" - ${reservedBytes},
              "updatedAt" = CURRENT_TIMESTAMP
            WHERE
              "id" = 'global'
              AND "reservedBytes" >= ${reservedBytes}
          `;
        } catch (quotaError) {
          console.error(
            "Could not release storage reservation:",
            quotaError
          );
        }
      }
  
      if (error instanceof Error) {
        if (error.message === "STORAGE_QUOTA_EXCEEDED") {
          return NextResponse.json(
            { error: "The shared 8 GB storage limit has been reached." },
            { status: 413 }
          );
        }
  
        if (error.message === "DAILY_AI_LIMIT_REACHED") {
          return NextResponse.json(
            {
              error: "You have reached the daily limit of 3 coloring generations. Please try again tomorrow.",
            },
            { status: 429 }
          );
        }
  
        if (error.message === "CLOUDFLARE_AUTH_ERROR") {
          return NextResponse.json(
            { error: "Cloudflare rejected the API token. Check your token." },
            { status: 401 }
          );
        }
  
        if (error.message === "CLOUDFLARE_PERMISSION_ERROR") {
          return NextResponse.json(
            { error: "The Cloudflare API token does not have the required Workers AI permissions." },
            { status: 403 }
          );
        }
  
        if (error.message === "CLOUDFLARE_LIMIT_REACHED") {
          return NextResponse.json(
            {
              error: "Cloudflare's Workers AI usage limit has been reached. Please try again after the daily reset.",
            },
            { status: 429 }
          );
        }
  
        if (error.message.startsWith("CLOUDFLARE_GENERATION_FAILED:")) {
          return NextResponse.json(
            { error: error.message.replace("CLOUDFLARE_GENERATION_FAILED: ", "") },
            { status: 502 }
          );
        }
  
        if (error.message === "GENERATION_CONFLICT") {
          return NextResponse.json(
            { error: "Another generation replaced this image. Please try again." },
            { status: 409 }
          );
        }
  
        if (error.message === "STORAGE_ACCOUNTING_ERROR") {
          return NextResponse.json(
            { error: "Storage accounting failed. The previous image was not replaced." },
            { status: 500 }
          );
        }
      }
  
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unknown error while generating the coloring image.",
        },
        { status: 500 }
      );
    }
  }
  