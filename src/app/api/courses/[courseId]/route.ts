import type { NextRequest } from "next/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { deleteCourse, getCourse, listExams, listMaterials, listStudySets, toMaterialSummary } from "@/lib/db/repo";
import { collectMissed, summarizeMissed } from "@/lib/exam/review";
import { toSummary } from "@/lib/study/view";
import type { CourseDetail, ExamSummary } from "@/lib/types";

// GET /api/courses/:courseId — ders + materyal, sınav ve çalışma seti özetleri
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/courses/[courseId]">) {
  try {
    const { courseId } = await ctx.params;
    if (!isUuid(courseId)) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");
    const course = getCourse(courseId);
    if (!course) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");

    const exams = listExams(courseId);
    const examSummaries: ExamSummary[] = exams.map((e) => ({
      id: e.id,
      title: e.title,
      settings: e.settings,
      created_at: e.created_at,
      score: e.score,
      question_count: e.questions_json.length,
    }));

    return Response.json({
      course,
      // Metnin kendisini tarayıcıya taşımıyoruz, yalnızca uzunluğunu
      materials: listMaterials(courseId).map(toMaterialSummary),
      exams: examSummaries,
      // "Yanlışlarımı tekrar et" için: hangi konularda kaç yanlış var
      review: summarizeMissed(collectMissed(exams)),
      study_sets: listStudySets(courseId).map(toSummary),
    } satisfies CourseDetail);
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/courses/:courseId — ders, materyalleri, sınavları, setleri ve PDF dosyaları
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/courses/[courseId]">) {
  try {
    const { courseId } = await ctx.params;
    if (!isUuid(courseId) || !deleteCourse(courseId)) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
