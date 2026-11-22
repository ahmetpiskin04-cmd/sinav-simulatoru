import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { computeTopicStats, weakTopics } from "@/lib/exam/grade";
import { generateStudyGuide } from "@/lib/exam/study-guide";
import { getExamRow } from "@/lib/exam/view";
import type { SourceMaterial } from "@/lib/exam/generate";
import type { StudyGuide } from "@/lib/exam/types";

export const maxDuration = 300;

const MIN_USEFUL_TEXT = 50;

// POST /api/exams/:examId/study-guide → StudyGuide
// Zayıf konular için özet + tuzaklar + flashcard üretir ve exams.study_guide'a kaydeder.
// Daha önce üretilmişse kayıtlı olanı döndürür (Gemini kotası harcanmaz).
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/exams/[examId]/study-guide">) {
  try {
    const { examId } = await ctx.params;
    if (!isUuid(examId)) return jsonError(404, "Sınav bulunamadı.", "NOT_FOUND");

    const row = await getExamRow(examId);
    if (!row) return jsonError(404, "Sınav bulunamadı.", "NOT_FOUND");
    if (row.score === null || !Array.isArray(row.user_answers_json)) {
      return jsonError(400, "Çalışma rehberi sınav bittikten sonra üretilebilir.", "BAD_REQUEST");
    }
    if (row.study_guide) return Response.json(row.study_guide satisfies StudyGuide);

    const questions = Array.isArray(row.questions_json) ? row.questions_json : [];
    const weak = weakTopics(computeTopicStats(questions, row.user_answers_json));
    if (!weak.length) return jsonError(400, "Bu sınavda zayıf konu yok; tüm konularda %70 ve üzerindesin.", "BAD_REQUEST");

    const db = getSupabaseAdmin();
    const { data: mats, error: matErr } = await db
      .from("materials")
      .select("file_name, file_type, extracted_text")
      .eq("course_id", row.course_id)
      .order("created_at");
    if (matErr) throw matErr;
    const materials: SourceMaterial[] = mats
      .filter((m) => (m.extracted_text ?? "").trim().length >= MIN_USEFUL_TEXT)
      .map((m) => ({ file_name: m.file_name, file_type: m.file_type, text: m.extracted_text!.trim() }));

    const guide = await generateStudyGuide({ weak, questions, graded: row.user_answers_json, materials });

    // "study_guide is null": iki sekmeden aynı anda istenirse ilki kazanır, ikincisi onu döndürür
    const { data: updated, error } = await db
      .from("exams")
      .update({ study_guide: guide })
      .eq("id", examId)
      .is("study_guide", null)
      .select("study_guide");
    if (error) throw error;
    if (!updated.length) {
      const fresh = await getExamRow(examId);
      if (fresh?.study_guide) return Response.json(fresh.study_guide satisfies StudyGuide);
    }
    return Response.json(guide satisfies StudyGuide, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
