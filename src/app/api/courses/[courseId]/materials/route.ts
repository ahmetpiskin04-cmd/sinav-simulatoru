import type { NextRequest } from "next/server";
import { getSupabaseAdmin, MATERIALS_BUCKET } from "@/lib/supabase/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { extractMaterialText } from "@/lib/material-text";
import { MATERIAL_SUMMARY_COLUMNS, type MaterialSummary, type MaterialType, type UploadMaterialResponse } from "@/lib/types";

import { MAX_PDF_BYTES, MAX_PDF_MB } from "@/lib/constants";

// Görsel ağırlıklı PDF'ler Gemini ile okunur; uzun sürebilir
export const maxDuration = 300;

// POST /api/courses/:courseId/materials  (multipart/form-data: file, file_type)
export async function POST(request: NextRequest, ctx: RouteContext<"/api/courses/[courseId]/materials">) {
  try {
    const { courseId } = await ctx.params;
    if (!isUuid(courseId)) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const fileType = form?.get("file_type");

    if (!(file instanceof File)) return jsonError(400, "PDF dosyası seçilmedi.", "BAD_REQUEST");
    if (fileType !== "slide" && fileType !== "past_exam") {
      return jsonError(400, "Materyal türü 'slide' veya 'past_exam' olmalı.", "BAD_REQUEST");
    }
    if (file.size === 0) return jsonError(400, "Dosya boş.", "BAD_REQUEST");
    if (file.size > MAX_PDF_BYTES) return jsonError(400, `Dosya ${MAX_PDF_MB} MB'tan büyük olamaz.`, "BAD_REQUEST");

    const bytes = await file.arrayBuffer();
    // Uzantıya değil içeriğe bak: PDF'ler "%PDF-" ile başlar
    const head = new TextDecoder().decode(new Uint8Array(bytes, 0, Math.min(5, bytes.byteLength)));
    if (head !== "%PDF-") return jsonError(400, "Yalnızca PDF dosyaları yüklenebilir.", "BAD_REQUEST");

    const db = getSupabaseAdmin();
    const { data: course, error: courseErr } = await db.from("courses").select("id").eq("id", courseId).maybeSingle();
    if (courseErr) throw courseErr;
    if (!course) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");

    let extracted;
    try {
      extracted = await extractMaterialText(bytes, file.name);
    } catch {
      return jsonError(400, "PDF okunamadı. Dosya bozuk ya da şifreli olabilir.", "BAD_REQUEST");
    }

    const storagePath = `${courseId}/${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await db.storage
      .from(MATERIALS_BUCKET)
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(`Dosya depolamaya yüklenemedi: ${upErr.message}`);

    const { data: row, error: insErr } = await db
      .from("materials")
      .insert({
        course_id: courseId,
        file_name: file.name.slice(0, 255),
        file_type: fileType satisfies MaterialType,
        extracted_text: extracted.text,
        storage_path: storagePath,
        page_count: extracted.pageCount,
        extraction_method: extracted.method,
      })
      .select(MATERIAL_SUMMARY_COLUMNS)
      .single();
    if (insErr) {
      await db.storage.from(MATERIALS_BUCKET).remove([storagePath]); // yetim dosya bırakma
      throw insErr;
    }

    const summary: MaterialSummary = { ...row, text_length: extracted.text.length };
    return Response.json(
      { material: summary, notice: extracted.notice, warning: extracted.warning } satisfies UploadMaterialResponse,
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
