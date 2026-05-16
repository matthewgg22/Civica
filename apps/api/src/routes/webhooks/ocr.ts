import { Hono } from "hono";
import { prisma } from "@civica/db";
import { OcrWebhookPayloadSchema } from "@civica/types";
import { timingSafeEqual } from "node:crypto";

export const ocrWebhookRouter = new Hono();

ocrWebhookRouter.post("/api/v1/webhooks/ocr", async (c) => {
  const secret = process.env["OCR_WEBHOOK_SECRET"] ?? "";
  const sig = c.req.header("X-Civica-Signature") ?? "";

  if (secret) {
    const expected = Buffer.from(secret);
    const received = Buffer.from(sig);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return c.json({ code: "forbidden", message: "Invalid webhook signature" }, 403);
    }
  }

  const body = OcrWebhookPayloadSchema.parse(await c.req.json());

  if (!body.success || !body.fields?.length) {
    await prisma.ocrJob.updateMany({
      where: { document_id: body.document_id },
      data: { status: "failed", last_error: body.error ?? "unknown", updated_at: new Date() },
    });
    await prisma.document.update({
      where: { id: body.document_id },
      data: { status: "failed", updated_at: new Date() },
    });
    return c.json({ ok: true });
  }

  type BboxLike = { left?: unknown; top?: unknown; width?: unknown; height?: unknown; page?: unknown };

  await prisma.$transaction([
    prisma.extractionField.createMany({
      data: body.fields.map((f) => {
        const bbox = f.bbox as BboxLike | undefined;
        return {
          document_id: body.document_id,
          name: f.name,
          value: f.value,
          confidence: f.confidence,
          bbox_left: bbox ? Number(bbox.left) : null,
          bbox_top: bbox ? Number(bbox.top) : null,
          bbox_width: bbox ? Number(bbox.width) : null,
          bbox_height: bbox ? Number(bbox.height) : null,
          bbox_page: bbox ? Number(bbox.page) : null,
          provider: f.provider,
        };
      }),
      skipDuplicates: true,
    }),
    prisma.document.update({
      where: { id: body.document_id },
      data: { status: "extracted", updated_at: new Date() },
    }),
    prisma.ocrJob.updateMany({
      where: { document_id: body.document_id, status: "running" },
      data: { status: "done", updated_at: new Date() },
    }),
  ]);

  return c.json({ ok: true });
});
