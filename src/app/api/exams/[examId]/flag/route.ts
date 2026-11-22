import type { NextRequest } from "next/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { getExam, updateExamFlags } from "@/lib/db/repo";
import { scoreExcludingFlagged } from "@/lib/exam/grade";
import { toExamView } from "@/lib/exam/view";

// POST /api/exams/:examId/flag  { questionId: number, flagged: boolean } → güncel tamamlanmış ExamView
// "Bu soru hatalı": soru puana, konu analizine ve "Yanlışlarımı Tekrar Et"e dahil edilmez.
// İşaret kaldırılabilir; puan ve özet her seferinde yeniden hesaplanır.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/exams/[examId]/flag">) {
  try {
    const { examId } = await ctx.params;
    if (!isUuid(examId)) return jsonError(404, "Sınav bulunamadı.", "NOT_FOUND");

    const body = (await request.json().catch(() => null)) as { questionId?: unknown; flagged?: unknown } | null;
    const questionId = Number(body?.questionId);
    if (!Number.isInteger(questionId) || typeof body?.flagged !== "boolean") {
      return jsonError(400, "{ questionId: sayı, flagged: true/false } gönderilmeli.", "BAD_REQUEST");
    }

    const row = getExam(examId);
    if (!row) return jsonError(404, "Sınav bulunamadı.", "NOT_FOUND");
    if (row.score === null || !row.user_answers_json) {
      return jsonError(400, "Soru ancak sınav bittikten sonra hatalı olarak işaretlenebilir.", "BAD_REQUEST");
    }
    if (!row.questions_json.some((q) => q.id === questionId)) return jsonError(404, "Soru bulunamadı.", "NOT_FOUND");

    const set = new Set(row.flagged_json);
    if (body.flagged) set.add(questionId);
    else set.delete(questionId);
    const flagged = [...set].sort((a, b) => a - b);

    const { score, feedback } = scoreExcludingFlagged(row.questions_json, row.user_answers_json, flagged);
    updateExamFlags(examId, flagged, score, feedback);
    return Response.json(toExamView({ ...row, flagged_json: flagged, score, feedback_summary: feedback }));
  } catch (err) {
    return handleRouteError(err);
  }
}
