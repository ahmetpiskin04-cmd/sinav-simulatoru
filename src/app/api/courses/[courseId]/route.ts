import type { NextRequest } from "next/server";
import { getSupabaseAdmin, MATERIALS_BUCKET } from "@/lib/supabase/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { MATERIAL_SUMMARY_COLUMNS, type Course, type CourseDetail, type ExamSummary, type MaterialSummary } from "@/lib/types";
import { collectMissed, summarizeMissed, type ExamResultRow } from "@/lib/exam/review";
import { toSummary } from "@/lib/study/view";

// GET /api/courses/:courseId — ders + materyal ve sınav özetleri
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/courses/[courseId]">) {
  try {
    const { courseId } = await ctx.params;
    if (!isUuid(courseId)) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");
    const db = getSupabaseAdmin();

    const [courseRes, materialsRes, examsRes, setsRes] = await Promise.all([
      db.from("courses").select("*").eq("id", courseId).maybeSingle(),
      db
        .from("materials")
        .select(`${MATERIAL_SUMMARY_COLUMNS}, extracted_text`)
        .eq("course_id", courseId)
        .order("created_at", { ascending: false }),
      db
        .from("exams")
        .select("id, title, settings, score, created_at, questions_json, user_answers_json")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false }),
      db
        .from("study_sets")
        .select("id, title, created_at, source_names, content, card_status")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false }),
    ]);
    if (courseRes.error) throw courseRes.error;
    if (materialsRes.error) throw materialsRes.error;
    if (examsRes.error) throw examsRes.error;
    if (setsRes.error) throw setsRes.error;
    if (!courseRes.data) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");

    // Metnin kendisini tarayıcıya taşımıyoruz, yalnızca uzunluğunu
    const materials: MaterialSummary[] = materialsRes.data.map(({ extracted_text, ...m }) => ({
      ...m,
      text_length: extracted_text?.length ?? 0,
    }));
    const exams: ExamSummary[] = examsRes.data.map(({ id, title, settings, created_at, score, questions_json }) => ({
      id,
      title,
      settings,
      created_at,
      score: score === null ? null : Number(score), // numeric sütun metin olarak gelebilir
      question_count: Array.isArray(questions_json) ? questions_json.length : 0,
    }));
    // "Yanlışlarımı tekrar et" için: hangi konularda kaç yanlış var
    const review = summarizeMissed(collectMissed(examsRes.data as ExamResultRow[]));
    const study_sets = setsRes.data.map((s) => toSummary(s as Parameters<typeof toSummary>[0]));

    return Response.json({ course: courseRes.data as Course, materials, exams, review, study_sets } satisfies CourseDetail);
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/courses/:courseId — ders, materyalleri, sınavları ve PDF dosyaları
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/courses/[courseId]">) {
  try {
    const { courseId } = await ctx.params;
    if (!isUuid(courseId)) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");
    const db = getSupabaseAdmin();

    const { data: files, error: listErr } = await db
      .from("materials")
      .select("storage_path")
      .eq("course_id", courseId);
    if (listErr) throw listErr;

    const paths = files.map((f) => f.storage_path).filter((p): p is string => !!p);
    if (paths.length) {
      const { error: rmErr } = await db.storage.from(MATERIALS_BUCKET).remove(paths);
      if (rmErr) console.warn("Storage dosyaları silinemedi:", rmErr.message);
    }

    // materials ve exams satırları "on delete cascade" ile birlikte silinir
    const { error } = await db.from("courses").delete().eq("id", courseId);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
