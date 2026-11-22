import type { NextRequest } from "next/server";
import { getSupabaseAdmin, MATERIALS_BUCKET } from "@/lib/supabase/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { tryVision } from "@/lib/material-text";
import { VISION_MAX_PAGES } from "@/lib/constants";
import { MATERIAL_SUMMARY_COLUMNS, type MaterialSummary, type UploadMaterialResponse } from "@/lib/types";

export const maxDuration = 300;

// POST /api/materials/:materialId/vision
// Daha önce yüklenmiş (görsel ağırlıklı) bir PDF'i Storage'dan alıp Gemini ile yeniden okur.
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/materials/[materialId]/vision">) {
  try {
    const { materialId } = await ctx.params;
    if (!isUuid(materialId)) return jsonError(404, "Materyal bulunamadı.", "NOT_FOUND");
    const db = getSupabaseAdmin();

    const { data: m, error } = await db
      .from("materials")
      .select("id, file_name, storage_path, page_count, extracted_text, extraction_method")
      .eq("id", materialId)
      .maybeSingle();
    if (error) throw error;
    if (!m) return jsonError(404, "Materyal bulunamadı.", "NOT_FOUND");
    if (m.extraction_method === "gemini_vision") {
      return jsonError(409, "Bu PDF zaten yapay zekâ ile okunmuş.", "CONFLICT");
    }
    if (!m.storage_path) return jsonError(400, "PDF dosyası depoda bulunamadı.", "BAD_REQUEST");
    if (!m.page_count || m.page_count > VISION_MAX_PAGES) {
      return jsonError(400, `Yapay zekâ ile okuma en fazla ${VISION_MAX_PAGES} sayfalık PDF'ler için yapılabilir.`, "BAD_REQUEST");
    }

    const { data: blob, error: dlErr } = await db.storage.from(MATERIALS_BUCKET).download(m.storage_path);
    if (dlErr || !blob) throw new Error(`PDF depodan indirilemedi: ${dlErr?.message ?? "boş yanıt"}`);

    const current = m.extracted_text?.length ?? 0;
    const attempt = await tryVision(await blob.arrayBuffer(), m.file_name, m.page_count, current);
    if (!attempt.ok) return jsonError(502, attempt.warning, "AI_ERROR");

    const { data: row, error: upErr } = await db
      .from("materials")
      .update({ extracted_text: attempt.result.text, extraction_method: attempt.result.method })
      .eq("id", materialId)
      .select(MATERIAL_SUMMARY_COLUMNS)
      .single();
    if (upErr) throw upErr;

    const material: MaterialSummary = { ...(row as unknown as Omit<MaterialSummary, "text_length">), text_length: attempt.result.text.length };
    return Response.json({ material, notice: attempt.result.notice } satisfies UploadMaterialResponse);
  } catch (err) {
    return handleRouteError(err);
  }
}
