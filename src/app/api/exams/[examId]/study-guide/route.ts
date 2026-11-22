import type { NextRequest } from "next/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { computeTopicStats, weakTopics } from "@/lib/exam/grade";
import { generateStudyGuide } from "@/lib/exam/study-guide";
import { getExamRow } from "@/lib/exam/view";
import { loadCourseSources } from "@/lib/course-sources";
import { setStudyGuide } from "@/lib/db/repo";
import type { StudyGuide } from "@/lib/exam/types";

export const maxDuration = 300;


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

    const { sources: materials } = await loadCourseSources(row.course_id);
    const guide = await generateStudyGuide({ weak, questions, graded: row.user_answers_json, materials });

    // Yalnızca rehber henüz yoksa yazılır: iki sekmeden aynı anda istenirse ilki kazanır, ikincisi onu döndürür
    if (!setStudyGuide(examId, guide)) {
      const fresh = await getExamRow(examId);
      if (fresh?.study_guide) return Response.json(fresh.study_guide satisfies StudyGuide);
    }
    return Response.json(guide satisfies StudyGuide, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
