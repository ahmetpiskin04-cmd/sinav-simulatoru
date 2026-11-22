// Önceki sınavlardaki yanlışları toplar (tekrar sınavı için). Saf fonksiyonlar: sunucu ve test ortak.
import { MC_LETTERS, type ExamQuestion, type GradedAnswer } from "@/lib/exam/types";

export interface ExamResultRow {
  created_at: string;
  questions_json: ExamQuestion[] | null;
  user_answers_json: GradedAnswer[] | null;
  /** "Hatalı" işaretlenen sorular tekrar sınavına alınmaz */
  flagged_json?: number[] | null;
}

export interface MissedQuestion {
  question: ExamQuestion;
  graded: GradedAnswer;
  examDate: string;
}

export interface ReviewSummary {
  /** Toplam yanlış/boş soru sayısı */
  total_wrong: number;
  /** Konu → yanlış sayısı, çoktan aza */
  topics: { topic: string; wrong: number }[];
}

/** Tekrar sınavına alınacak en fazla yanlış sayısı (en yeniler önce) */
const MAX_MISSED = 40;

/** Tamamlanmış sınavlardaki yanlış ya da boş bırakılan soruları en yeniden eskiye döndürür. */
export function collectMissed(exams: ExamResultRow[]): MissedQuestion[] {
  const out: MissedQuestion[] = [];
  const sorted = [...exams].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const exam of sorted) {
    if (!Array.isArray(exam.user_answers_json) || !Array.isArray(exam.questions_json)) continue;
    const byId = new Map(exam.questions_json.map((q) => [q.id, q]));
    const flagged = new Set(exam.flagged_json ?? []);
    for (const g of exam.user_answers_json) {
      if (flagged.has(g.question_id)) continue;
      const q = byId.get(g.question_id);
      if (q && !g.is_correct) out.push({ question: q, graded: g, examDate: exam.created_at });
    }
  }
  return out.slice(0, MAX_MISSED);
}

export function summarizeMissed(missed: MissedQuestion[]): ReviewSummary {
  const counts = new Map<string, number>();
  for (const m of missed) counts.set(m.question.topic, (counts.get(m.question.topic) ?? 0) + 1);
  const topics = [...counts.entries()]
    .map(([topic, wrong]) => ({ topic, wrong }))
    .sort((a, b) => b.wrong - a.wrong || a.topic.localeCompare(b.topic));
  return { total_wrong: missed.length, topics };
}

const optionText = (q: ExamQuestion, letter: string) => q.options[MC_LETTERS.indexOf(letter as (typeof MC_LETTERS)[number])] ?? letter;

/** Gemini'ye verilecek <mistake> blokları */
export function renderMistakes(missed: MissedQuestion[]): string[] {
  return missed.map(({ question: q, graded: g }) => {
    const student = !g.answer ? "(boş bıraktı)" : q.type === "multiple_choice" ? optionText(q, g.answer) : g.answer.slice(0, 600);
    const correct = q.type === "multiple_choice" ? optionText(q, q.correct_answer) : q.correct_answer.slice(0, 600);
    return `<mistake topic="${q.topic.replace(/"/g, "'")}">\nSoru: ${q.question_text}\nÖğrencinin cevabı: ${student}\nDoğru cevap: ${correct}\n</mistake>`;
  });
}
