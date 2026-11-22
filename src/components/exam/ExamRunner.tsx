"use client";

import { useEffect, useState } from "react";
import { CircleAlert, LoaderCircle, Send } from "lucide-react";
import { RichText } from "@/components/exam/RichText";
import { api } from "@/lib/client-api";
import { MC_LETTERS, type AnswerMap, type CompletedExamView, type InProgressExamView } from "@/lib/exam/types";

interface Props {
  view: InProgressExamView;
  onCompleted: (v: CompletedExamView) => void;
}

const draftKey = (examId: string) => `exam-draft:${examId}`;

function readDraft(examId: string): AnswerMap {
  try {
    const raw = localStorage.getItem(draftKey(examId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as AnswerMap) : {};
  } catch {
    return {};
  }
}

export function ExamRunner({ view, onCompleted }: Props) {
  // Yalnızca tarayıcıda çizildiği için (bkz. ExamScreen) localStorage'ı doğrudan okuyabiliriz
  const [answers, setAnswers] = useState<AnswerMap>(() => readDraft(view.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sayfa yenilense ya da sekme kapansa bile cevaplar kaybolmasın
  useEffect(() => {
    try {
      localStorage.setItem(draftKey(view.id), JSON.stringify(answers));
    } catch {}
  }, [answers, view.id]);

  const answeredCount = view.questions.filter((q) => (answers[String(q.id)] ?? "").trim()).length;
  const total = view.questions.length;
  const hasOpenEnded = view.questions.some((q) => q.type === "open_ended");

  function setAnswer(id: number, value: string) {
    setAnswers((prev) => ({ ...prev, [String(id)]: value }));
  }

  async function submit() {
    const blank = total - answeredCount;
    if (blank > 0 && !window.confirm(`${blank} soru boş. Yine de sınavı bitirmek istiyor musun?`)) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.submitExam(view.id, answers);
      try {
        localStorage.removeItem(draftKey(view.id));
      } catch {}
      window.scrollTo({ top: 0 });
      onCompleted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sınav gönderilemedi.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <ol className="mx-auto max-w-3xl space-y-5 px-5 pt-8 pb-36">
        {view.questions.map((q, index) => {
          const value = answers[String(q.id)] ?? "";
          return (
            <li
              key={q.id}
              id={`q-${q.id}`}
              className="rounded-2xl border border-zinc-200 bg-white p-5 md:p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Soru {index + 1}</span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {q.topic}
                </span>
                <span className="text-zinc-500">{q.type === "multiple_choice" ? "Çoktan seçmeli" : "Açık uçlu"}</span>
              </div>

              <RichText text={q.question_text} className="mb-4 text-[15px]" />

              {q.type === "multiple_choice" ? (
                <fieldset className="space-y-2" disabled={submitting}>
                  <legend className="sr-only">Soru {index + 1} şıkları</legend>
                  {q.options.map((opt, i) => {
                    const letter = MC_LETTERS[i];
                    const selected = value === letter;
                    return (
                      <label
                        key={letter}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20 dark:bg-indigo-500/10"
                            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={letter}
                          checked={selected}
                          onChange={() => setAnswer(q.id, letter)}
                          className="sr-only"
                        />
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                            selected
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-zinc-300 text-zinc-500 dark:border-zinc-600"
                          }`}
                        >
                          {letter}
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <RichText text={opt.replace(/^[A-D]\)\s*/, "")} />
                        </div>
                      </label>
                    );
                  })}
                </fieldset>
              ) : (
                <textarea
                  value={value}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  disabled={submitting}
                  rows={5}
                  maxLength={5000}
                  placeholder="Cevabını buraya yaz…"
                  className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950"
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Alt çubuk: ilerleme + bitir */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto max-w-3xl px-5 py-3">
          {error && (
            <div className="mb-2 flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{error} Cevapların kayıtlı, tekrar deneyebilirsin.</span>
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-xs text-zinc-500">
                <span className="font-medium text-zinc-900 tabular-nums dark:text-zinc-100">
                  {answeredCount} / {total}
                </span>{" "}
                cevaplandı
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
              {submitting ? (hasOpenEnded ? "Değerlendiriliyor…" : "Gönderiliyor…") : "Sınavı Bitir"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
