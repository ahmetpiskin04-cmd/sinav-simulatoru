import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { computeTopicStats } from "@/lib/exam/grade";
import type { ExamQuestion, ExamSettings, ExamView, GradedAnswer, StudyGuide } from "@/lib/exam/types";

export interface ExamRow {
  id: string;
  course_id: string;
  title: string | null;
  settings: ExamSettings | null;
  questions_json: ExamQuestion[];
  user_answers_json: GradedAnswer[] | null;
  score: number | string | null;
  feedback_summary: string | null;
  submitted_at: string | null;
  study_guide: StudyGuide | null;
  created_at: string;
  courses: { id: string; title: string } | null;
}

export async function getExamRow(examId: string): Promise<ExamRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("exams")
    .select(
      "id, course_id, title, settings, questions_json, user_answers_json, score, feedback_summary, submitted_at, study_guide, created_at, courses(id, title)",
    )
    .eq("id", examId)
    .maybeSingle();
  if (error) throw error;
  return data as ExamRow | null;
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
  return {
    ...base,
    status: "completed",
    questions,
    graded,
    topics: computeTopicStats(questions, graded),
    score: Number(row.score),
    feedback_summary: row.feedback_summary ?? "",
    submitted_at: row.submitted_at,
    study_guide: row.study_guide ?? null,
  };
}
