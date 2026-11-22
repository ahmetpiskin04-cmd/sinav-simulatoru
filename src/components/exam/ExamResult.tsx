"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Bot, CircleCheck, CircleDashed, CircleMinus, CircleX, Flag, Lightbulb, LoaderCircle, Timer } from "lucide-react";
import { RichText } from "@/components/exam/RichText";
import { StudyGuidePanel } from "@/components/exam/StudyGuidePanel";
import { api, formatDuration } from "@/lib/client-api";
import { MC_LETTERS, WEAK_TOPIC_THRESHOLD, type CompletedExamView, type ExamQuestion, type GradedAnswer } from "@/lib/exam/types";

/** Puan rengi: ≥70 iyi, 50-69 orta, <50 zayıf */
function tone(score: number) {
  if (score >= 70) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (score >= 50) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" };
  return { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" };
}

/**
 * Soru başına yaklaşık süre: her soruya son dokunuş anları sıralanır, ardışık farklar o soruya yazılır.
 * Öğrenci soruları sırayla çözmeyebileceği için "yaklaşık" gösterilir.
 */
function perQuestionTimes(timing: Record<string, number> | null): Map<number, number> {
  const out = new Map<number, number>();
  if (!timing) return out;
  const touches = Object.entries(timing)
    .map(([id, ms]) => [Number(id), ms] as const)
    .sort((a, b) => a[1] - b[1]);
  let prev = 0;
  for (const [id, ms] of touches) {
    out.set(id, ms - prev);
    prev = ms;
  }
  return out;
}

export function ExamResult({ view, onChange }: { view: CompletedExamView; onChange: (v: CompletedExamView) => void }) {
  const [flagBusy, setFlagBusy] = useState<number | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);
  const gradedById = new Map(view.graded.map((g) => [g.question_id, g]));
  const flagged = new Set(view.flagged);
  const counted = view.graded.filter((g) => !flagged.has(g.question_id));
  const correct = counted.filter((g) => g.is_correct).length;
  const t = tone(view.score);

  const limitMs = (view.settings?.timeLimitMinutes ?? 0) * 60_000;
  const totalMs =
    view.started_at && view.submitted_at ? Date.parse(view.submitted_at) - Date.parse(view.started_at) : null;
  const questionTimes = perQuestionTimes(view.timing);

  async function toggleFlag(questionId: number) {
    const next = !flagged.has(questionId);
    if (next && !window.confirm("Bu soru hatalı olarak işaretlensin mi? Puana, konu analizine ve tekrar sınavlarına dahil edilmez. İstersen sonra geri alabilirsin.")) return;
    setFlagBusy(questionId);
    setFlagError(null);
    try {
      onChange(await api.flagQuestion(view.id, questionId, next));
    } catch (err) {
      setFlagError(err instanceof Error ? err.message : "İşaret kaydedilemedi.");
    } finally {
      setFlagBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pt-8 pb-20">
      {/* Özet */}
      <section className="mb-8 grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white px-8 py-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Puan</p>
          <p className={`mt-1 text-5xl font-semibold tracking-tight tabular-nums ${t.text}`}>{Math.round(view.score)}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {counted.length} sorudan {correct} doğru
          </p>
          {flagged.size > 0 && (
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{flagged.size} soru hatalı işaretli, sayılmadı</p>
          )}
          {totalMs !== null && totalMs >= 0 && (
            <p
              className={`mt-2 inline-flex items-center gap-1 text-xs ${limitMs && totalMs >= limitMs ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}
              title={limitMs && totalMs >= limitMs ? "Süre doldu, sınav otomatik teslim edildi" : "Sınavda geçen süre"}
            >
              <Timer className="size-3.5" />
              {formatDuration(totalMs)}
              {limitMs ? ` / ${formatDuration(limitMs)}` : ""}
              {limitMs && totalMs >= limitMs ? " · süre doldu" : ""}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">Konu bazlı başarı</p>
          <ul className="space-y-2.5">
            {view.topics.map((topic) => {
              const tt = tone(topic.score);
              return (
                <li key={topic.topic}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate" title={topic.topic}>
                      {topic.topic}
                      <span className="ml-1.5 text-xs text-zinc-400">{topic.question_count} soru</span>
                    </span>
                    <span className={`shrink-0 font-medium tabular-nums ${tt.text}`}>%{topic.score}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className={`h-full rounded-full ${tt.bar}`} style={{ width: `${Math.max(topic.score, 2)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <StudyGuidePanel
        examId={view.id}
        summary={view.feedback_summary}
        weak={view.topics.filter((tp) => tp.score < WEAK_TOPIC_THRESHOLD)}
        initial={view.study_guide}
      />

      {/* Sorular */}
      <h2 className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Soru soru inceleme</h2>
      <p className="mb-4 text-xs text-zinc-500">
        Cevap anahtarı yanlış ya da soru hatalıysa &quot;Bu soru hatalı&quot; ile işaretle; puanın yeniden hesaplanır.
      </p>
      {flagError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{flagError}</p>}
      <ol className="space-y-5">
        {view.questions.map((q, i) => (
          <QuestionReview
            key={q.id}
            index={i}
            question={q}
            graded={gradedById.get(q.id)}
            flagged={flagged.has(q.id)}
            flagBusy={flagBusy === q.id}
            onToggleFlag={() => toggleFlag(q.id)}
            approxMs={questionTimes.get(q.id)}
          />
        ))}
      </ol>

      <div className="mt-10 flex justify-center">
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
        >
          Panele dön
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ graded, open }: { graded?: GradedAnswer; open: boolean }) {
  if (!graded || !graded.answer) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
        <CircleDashed className="size-4" /> Boş
      </span>
    );
  }
  if (open && graded.score > 0 && graded.score < 100) {
    const t = tone(graded.score);
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${t.text}`}>
        {graded.is_correct ? <CircleCheck className="size-4" /> : <CircleMinus className="size-4" />}
        {graded.score} / 100
      </span>
    );
  }
  return graded.is_correct ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <CircleCheck className="size-4" /> Doğru{open ? ` · ${graded.score}/100` : ""}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
      <CircleX className="size-4" /> Yanlış{open ? ` · ${graded.score}/100` : ""}
    </span>
  );
}

function QuestionReview({
  index,
  question: q,
  graded,
  flagged,
  flagBusy,
  onToggleFlag,
  approxMs,
}: {
  index: number;
  question: ExamQuestion;
  graded?: GradedAnswer;
  flagged: boolean;
  flagBusy: boolean;
  onToggleFlag: () => void;
  approxMs?: number;
}) {
  const open = q.type === "open_ended";
  return (
    <li
      className={`rounded-2xl border bg-white p-5 md:p-6 dark:bg-zinc-900 ${
        flagged ? "border-amber-300 dark:border-amber-500/40" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {flagged && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <Flag className="size-3.5" /> Hatalı olarak işaretlendi — puana ve konu analizine dahil değil.
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Soru {index + 1}</span>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {q.topic}
        </span>
        {approxMs !== undefined && (
          <span className="inline-flex items-center gap-1 text-zinc-500" title="Bu soruya ayırdığın yaklaşık süre">
            <Timer className="size-3.5" /> ≈ {formatDuration(approxMs)}
          </span>
        )}
        <span className={`ml-auto ${flagged ? "opacity-50" : ""}`}>
          <StatusBadge graded={graded} open={open} />
        </span>
      </div>

      <RichText text={q.question_text} className="mb-4 text-[15px]" />

      {open ? (
        <div className="space-y-3 text-sm">
          <AnswerBox label="Senin cevabın" muted={!graded?.answer}>
            {graded?.answer ? <p className="whitespace-pre-wrap">{graded.answer}</p> : <p>Boş bırakıldı.</p>}
          </AnswerBox>
          <AnswerBox label="Beklenen cevap" accent>
            <RichText text={q.correct_answer} />
          </AnswerBox>
          {graded?.feedback && graded.answer && (
            <div className="flex gap-2 rounded-xl bg-zinc-50 px-3.5 py-3 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
              <Bot className="mt-0.5 size-4 shrink-0 text-indigo-500" />
              <p>{graded.feedback}</p>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {q.options.map((opt, i) => {
            const letter = MC_LETTERS[i];
            const isCorrect = letter === q.correct_answer;
            const isChosen = letter === graded?.answer;
            const style = isCorrect
              ? "border-emerald-500/60 bg-emerald-50 dark:bg-emerald-500/10"
              : isChosen
                ? "border-red-500/60 bg-red-50 dark:bg-red-500/10"
                : "border-zinc-200 dark:border-zinc-800";
            return (
              <li key={letter} className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm ${style}`}>
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                    isCorrect
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : isChosen
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-zinc-300 text-zinc-500 dark:border-zinc-600"
                  }`}
                >
                  {letter}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <RichText text={opt.replace(/^[A-D]\)\s*/, "")} />
                </div>
                {(isCorrect || isChosen) && (
                  <span
                    className={`shrink-0 pt-0.5 text-xs font-medium ${isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
                  >
                    {isCorrect ? (isChosen ? "Senin cevabın ✓" : "Doğru cevap") : "Senin cevabın"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          <Lightbulb className="size-3.5" /> Çözüm
        </p>
        <RichText text={q.explanation} className="text-sm text-zinc-700 dark:text-zinc-300" />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onToggleFlag}
            disabled={flagBusy}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition disabled:opacity-60 ${
              flagged
                ? "text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {flagBusy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Flag className="size-3.5" />}
            {flagged ? "İşareti kaldır" : "Bu soru hatalı"}
          </button>
        </div>
      </div>
    </li>
  );
}

function AnswerBox({
  label,
  children,
  accent,
  muted,
}: {
  label: string;
  children: ReactNode;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 ${
        accent ? "border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-500/5" : "border-zinc-200 dark:border-zinc-800"
      } ${muted ? "text-zinc-500" : ""}`}
    >
      <p className="mb-1.5 text-xs font-medium text-zinc-500">{label}</p>
      {children}
    </div>
  );
}
