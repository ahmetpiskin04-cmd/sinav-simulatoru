import "server-only";
import { getExam, type ExamRow } from "@/lib/db/repo";
import { computeTopicStats } from "@/lib/exam/grade";
import type { ExamView } from "@/lib/exam/types";

export type { ExamRow };

export async function getExamRow(examId: string): Promise<ExamRow | null> {
  return getExam(examId);
}

/**
 * Tarayıcıya gidecek görünüm. Sınav bitmediyse doğru cevaplar ve
 * çözümler ÇIKARILIR; böylece geliştirici araçlarından görülemez.
 */
export function toExamView(row: ExamRow): ExamView {
  const base = {
    id: row.id,
    title: row.title ?? "Deneme Sınavı",
    course: row.courses ?? { id: row.course_id, title: "Ders" },
    settings: row.settings,
    created_at: row.created_at,
    started_at: row.started_at,
  };
  const questions = Array.isArray(row.questions_json) ? row.questions_json : [];

  if (row.score === null || !Array.isArray(row.user_answers_json)) {
    return {
      ...base,
      status: "in_progress",
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        topic: q.topic,
        question_text: q.question_text,
        options: q.options,
      })),
    };
  }

  const graded = row.user_answers_json;
  const flagged = row.flagged_json ?? [];
  const skip = new Set(flagged);
  return {
    ...base,
    status: "completed",
    questions,
    graded,
    // Konu analizi "hatalı" işaretli sorular hariç (puan zaten işaretleme anında yeniden hesaplanıp kaydedilir)
    topics: computeTopicStats(
      questions.filter((q) => !skip.has(q.id)),
      graded.filter((g) => !skip.has(g.question_id)),
    ),
    score: Number(row.score),
    feedback_summary: row.feedback_summary ?? "",
    submitted_at: row.submitted_at,
    study_guide: row.study_guide ?? null,
    timing: row.timing_json ?? null,
    flagged,
  };
}
