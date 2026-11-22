import type { NextRequest } from "next/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { tryVision } from "@/lib/material-text";
import { VISION_MAX_PAGES } from "@/lib/constants";
import { getMaterial, toMaterialSummary, updateMaterialText } from "@/lib/db/repo";
import { readPdf } from "@/lib/db/files";
import type { UploadMaterialResponse } from "@/lib/types";

export const maxDuration = 300;

// POST /api/materials/:materialId/vision
// Daha önce yüklenmiş (görsel ağırlıklı) bir PDF'i diskten alıp Gemini ile yeniden okur.
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/materials/[materialId]/vision">) {
  try {
    const { materialId } = await ctx.params;
    if (!isUuid(materialId)) return jsonError(404, "Materyal bulunamadı.", "NOT_FOUND");
    const m = getMaterial(materialId);
    if (!m) return jsonError(404, "Materyal bulunamadı.", "NOT_FOUND");
    if (m.extraction_method === "gemini_vision") {
      return jsonError(409, "Bu PDF zaten yapay zekâ ile okunmuş.", "CONFLICT");
    }
    if (!m.storage_path) return jsonError(400, "PDF dosyası bulunamadı.", "BAD_REQUEST");
    if (!m.page_count || m.page_count > VISION_MAX_PAGES) {
      return jsonError(400, `Yapay zekâ ile okuma en fazla ${VISION_MAX_PAGES} sayfalık PDF'ler için yapılabilir.`, "BAD_REQUEST");
    }

    let bytes: Buffer;
    try {
      bytes = readPdf(m.storage_path);
    } catch {
      return jsonError(404, "PDF dosyası diskte bulunamadı.", "NOT_FOUND");
    }

    const current = m.extracted_text?.length ?? 0;
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const attempt = await tryVision(buffer, m.file_name, m.page_count, current);
    if (!attempt.ok) return jsonError(502, attempt.warning, "AI_ERROR");

    const updated = updateMaterialText(materialId, attempt.result.text, attempt.result.method);
    if (!updated) return jsonError(404, "Materyal bulunamadı.", "NOT_FOUND");
    return Response.json({ material: toMaterialSummary(updated), notice: attempt.result.notice } satisfies UploadMaterialResponse);
  } catch (err) {
    return handleRouteError(err);
  }
}
