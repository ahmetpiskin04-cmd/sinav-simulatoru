import type { NextRequest } from "next/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { buildFeedbackSummary, computeTopicStats, gradeExam, MAX_ANSWER_CHARS, overallScore } from "@/lib/exam/grade";
import { getExamRow, toExamView } from "@/lib/exam/view";
import { submitExamResult } from "@/lib/db/repo";
import type { AnswerMap } from "@/lib/exam/types";

export const maxDuration = 120;

const MAX_TIMING_MS = 24 * 60 * 60 * 1000;

// POST /api/exams/:examId/submit
// { answers: { [soruId]: cevap }, timing?: { [soruId]: sınav başından itibaren son dokunuş (ms) } }
// → tamamlanmış ExamView
export async function POST(request: NextRequest, ctx: RouteContext<"/api/exams/[examId]/submit">) {
  try {
    const { examId } = await ctx.params;
    if (!isUuid(examId)) return jsonError(404, "Sınav bulunamadı.", "NOT_FOUND");

    const body = (await request.json().catch(() => null)) as { answers?: unknown; timing?: unknown } | null;
    const answers = parseAnswers(body?.answers);
    if (!answers) return jsonError(400, "Cevaplar { soruId: cevap } biçiminde gönderilmeli.", "BAD_REQUEST");

    const row = await getExamRow(examId);
    if (!row) return jsonError(404, "Sınav bulunamadı.", "NOT_FOUND");
    if (row.score !== null) return jsonError(409, "Bu sınav zaten tamamlanmış.", "CONFLICT");

    const questions = row.questions_json;
    const timing = parseTiming(body?.timing, new Set(questions.map((q) => String(q.id))));
    const graded = await gradeExam(questions, answers);
    const score = overallScore(graded);
    const feedback = buildFeedbackSummary(score, graded, computeTopicStats(questions, graded));
    const submittedAt = new Date().toISOString();

    // Yalnızca puanlanmamışsa yazılır: iki sekmeden aynı anda gönderilirse yalnızca ilki geçer
    if (!submitExamResult(examId, { graded, score, feedback, submittedAt, timing })) {
      return jsonError(409, "Bu sınav zaten tamamlanmış.", "CONFLICT");
    }

    return Response.json(
      toExamView({
        ...row,
        user_answers_json: graded,
        score,
        feedback_summary: feedback,
        submitted_at: submittedAt,
        timing_json: timing,
        study_guide: null,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

function parseAnswers(raw: unknown): AnswerMap | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: AnswerMap = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string") continue;
    out[k] = v.slice(0, MAX_ANSWER_CHARS);
  }
  return out;
}

/** Yalnızca bu sınavın soru id'leri ve makul süreler kabul edilir; hiç yoksa null */
function parseTiming(raw: unknown, ids: Set<string>): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const ms = Number(v);
    if (ids.has(k) && Number.isFinite(ms) && ms >= 0 && ms <= MAX_TIMING_MS) out[k] = Math.round(ms);
  }
  return Object.keys(out).length ? out : null;
}
