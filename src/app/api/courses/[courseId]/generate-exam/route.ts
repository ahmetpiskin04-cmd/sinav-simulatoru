import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { handleRouteError, isUuid, jsonError } from "@/lib/api";
import { generateExam, type ReviewFocus } from "@/lib/exam/generate";
import { collectMissed, renderMistakes, summarizeMissed, type ExamResultRow } from "@/lib/exam/review";
import { loadCourseSources, noSourcesMessage, parseMaterialIds } from "@/lib/course-sources";
import { SIMILARITY_PREFIX } from "@/lib/exam/similarity";
import {
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  type Difficulty,
  type ExamMode,
  type ExamSettings,
  type QuestionTypeSetting,
} from "@/lib/exam/types";

// Sınav üretimi uzun sürebilir (büyük model + çok materyal)
export const maxDuration = 300;

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const TYPES: QuestionTypeSetting[] = ["multiple_choice", "open_ended", "mixed"];

// POST /api/courses/:courseId/generate-exam
// { questionCount?, difficulty?, questionType?, mode?: "normal" | "review", materialIds?: string[] } → { examId }
// - materialIds: yalnızca seçilen PDF'lerden sor (yoksa tümü)
// - mode "review": önceki sınavlarda yanlış yapılan konulardan yeni sorular
export async function POST(request: NextRequest, ctx: RouteContext<"/api/courses/[courseId]/generate-exam">) {
  try {
    const { courseId } = await ctx.params;
    if (!isUuid(courseId)) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");

    const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const settings = parseSettings(body);
    if (typeof settings === "string") return jsonError(400, settings, "BAD_REQUEST");
    const materialIds = parseMaterialIds(body.materialIds);
    if (typeof materialIds === "string") return jsonError(400, materialIds, "BAD_REQUEST");

    const db = getSupabaseAdmin();
    const { data: course, error: courseErr } = await db.from("courses").select("id").eq("id", courseId).maybeSingle();
    if (courseErr) throw courseErr;
    if (!course) return jsonError(404, "Ders bulunamadı.", "NOT_FOUND");

    // Bu dersin önceki sınavları: tekrar önleme ve (tekrar sınavında) yanlışlar için
    const { data: pastExams, error: pastErr } = await db
      .from("exams")
      .select("created_at, questions_json, user_answers_json, score")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (pastErr) throw pastErr;
    const previousQuestions = (pastExams as ExamResultRow[]).flatMap((e) =>
      (Array.isArray(e.questions_json) ? e.questions_json : []).map((q) =>
        q.question_text.replace(/\s+/g, " ").slice(0, SIMILARITY_PREFIX),
      ),
    );

    // Tekrar sınavı: önceki sınavlardaki yanlışlar
    let focus: ReviewFocus | undefined;
    if (settings.mode === "review") {
      const finished = (pastExams as (ExamResultRow & { score: unknown })[]).filter((e) => e.score !== null);
      const missed = collectMissed(finished);
      if (!missed.length) {
        return jsonError(400, "Tekrar edilecek yanlışın yok. Önce bir deneme sınavı çözmelisin.", "BAD_REQUEST");
      }
      const summary = summarizeMissed(missed);
      focus = { topics: summary.topics, mistakes: renderMistakes(missed) };
      settings.focusTopics = summary.topics.map((t) => t.topic);
    }

    // Tekrar sınavında kavramlar tüm materyallerden aranır; normal sınavda seçime uyulur
    const { sources, courseHasMaterials } = await loadCourseSources(courseId, focus ? undefined : materialIds);
    if (!sources.length) {
      return jsonError(400, noSourcesMessage(courseHasMaterials, Boolean(materialIds && !focus)), "BAD_REQUEST");
    }
    if (materialIds && !focus) {
      settings.materialIds = sources.map((s) => s.id);
      settings.materialNames = sources.map((s) => s.file_name);
    }

    const exam = await generateExam(sources, settings, { focus, previousQuestions });

    const { data: row, error } = await db
      .from("exams")
      .insert({
        course_id: courseId,
        title: exam.exam_title,
        settings: { ...settings, questionCount: exam.questions.length, model: exam.model, verification: exam.verification } satisfies ExamSettings,
        questions_json: exam.questions,
      })
      .select("id")
      .single();
    if (error) throw error;

    return Response.json({ examId: row.id, questionCount: exam.questions.length }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

function parseSettings(body: Record<string, unknown>): ExamSettings | string {
  const questionCount = body.questionCount === undefined ? 10 : Number(body.questionCount);
  if (!Number.isInteger(questionCount) || questionCount < MIN_QUESTIONS || questionCount > MAX_QUESTIONS) {
    return `Soru sayısı ${MIN_QUESTIONS}-${MAX_QUESTIONS} arasında bir tam sayı olmalı.`;
  }
  const difficulty = (body.difficulty ?? "medium") as Difficulty;
  if (!DIFFICULTIES.includes(difficulty)) return "Zorluk 'easy', 'medium' ya da 'hard' olmalı.";
  const questionType = (body.questionType ?? "mixed") as QuestionTypeSetting;
  if (!TYPES.includes(questionType)) return "Soru tipi 'multiple_choice', 'open_ended' ya da 'mixed' olmalı.";
  const mode = (body.mode ?? "normal") as ExamMode;
  if (mode !== "normal" && mode !== "review") return "Mod 'normal' ya da 'review' olmalı.";
  return { questionCount, difficulty, questionType, mode };
}
