"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenCheck, CircleAlert, GraduationCap, Layers, LoaderCircle, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { api } from "@/lib/client-api";
import { STUDY_GUIDE_FLASHCARDS, type Flashcard, type StudyGuide, type StudyTopic, type TopicStat } from "@/lib/exam/types";

interface Props {
  examId: string;
  /** Sınav sonucu özeti (feedback_summary) */
  summary: string;
  weak: TopicStat[];
  initial: StudyGuide | null;
}

/**
 * Zayıf konular için çalışma rehberi. Rehber bir kez üretilir ve sınav kaydında
 * saklanır; sayfa yenilendiğinde sunucudan hazır gelir (Gemini çağrılmaz).
 */
export function StudyGuidePanel({ examId, summary, weak, initial }: Props) {
  const [guide, setGuide] = useState<StudyGuide | null>(initial);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  async function generate() {
    setStartedAt(Date.now());
    setError(null);
    try {
      const g = await api.generateStudyGuide(examId);
      setGuide(g);
      requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Çalışma rehberi üretilemedi.");
    } finally {
      setStartedAt(null);
    }
  }

  return (
    <>
      <section className="mb-10 flex gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm leading-relaxed text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100">
        <BookOpenCheck className="mt-0.5 size-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <div className="min-w-0 flex-1">
          <p>{summary}</p>

          {weak.length > 0 && !guide && (
            <div className="mt-4 border-t border-indigo-200/70 pt-4 dark:border-indigo-500/20">
              {startedAt !== null ? (
                <Generating startedAt={startedAt} topicCount={weak.length} />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={generate}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
                  >
                    <Sparkles className="size-4" />
                    Eksik Konuları Çalış (Özet &amp; Kartlar Üret)
                  </button>
                  <p className="mt-2 text-xs text-indigo-900/60 dark:text-indigo-200/60">
                    {weak.length} zayıf konu için hap özet, sık yapılan hatalar ve {STUDY_GUIDE_FLASHCARDS} flashcard hazırlanır.
                  </p>
                  {error && (
                    <p className="mt-3 flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-500/10 dark:text-red-300">
                      <CircleAlert className="mt-0.5 size-4 shrink-0" />
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {guide && (
            <button
              type="button"
              onClick={() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300"
            >
              <GraduationCap className="size-3.5" /> Çalışma rehberine git ↓
            </button>
          )}
        </div>
      </section>

      {guide && (
        <section ref={sectionRef} className="mb-12 scroll-mt-6">
          <StudyGuideContent guide={guide} />
        </section>
      )}
    </>
  );
}

function Generating({ startedAt, topicCount }: { startedAt: number; topicCount: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-3" role="status">
      <LoaderCircle className="size-5 animate-spin text-indigo-600 dark:text-indigo-400" />
      <div>
        <p className="font-medium">{topicCount} konu için çalışma rehberi hazırlanıyor…</p>
        <p className="text-xs text-indigo-900/60 tabular-nums dark:text-indigo-200/60">
          {Math.max(0, Math.floor((now - startedAt) / 1000))} sn · genellikle 20-60 saniye sürer
        </p>
      </div>
    </div>
  );
}

function StudyGuideContent({ guide }: { guide: StudyGuide }) {
  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        <GraduationCap className="size-4 text-indigo-500" />
        Çalışma rehberin
      </h2>

      <TopicSummaryList topics={guide.topics} />

      <Flashcards cards={guide.flashcards} />
    </div>
  );
}

/** Konu konu hap özet + tuzaklar kartları (sınav rehberi ve çalışma setleri ortak) */
export function TopicSummaryList({ topics }: { topics: (StudyTopic & { score?: number })[] }) {
  return (
    <div className="space-y-4">
      {topics.map((t) => (
        <article key={t.topic} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">{t.topic}</h3>
            {t.score !== undefined && (
              <span className="shrink-0 text-xs font-medium text-red-600 tabular-nums dark:text-red-400">Sınavda %{t.score}</span>
            )}
          </header>
          <ul className="space-y-2 text-sm leading-relaxed">
            {t.summary.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span className="whitespace-pre-wrap">{s}</span>
              </li>
            ))}
          </ul>
          {t.pitfalls.length > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
                <TriangleAlert className="size-3.5" /> Tuzaklar ve ipuçları
              </p>
              <ul className="space-y-1.5 text-sm leading-relaxed text-amber-950 dark:text-amber-100">
                {t.pitfalls.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-amber-500">!</span>
                    <span className="whitespace-pre-wrap">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function Flashcards({ cards }: { cards: Flashcard[] }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          <Layers className="size-4 text-indigo-500" />
          Hızlı tekrar kartları
          <span className="font-normal text-zinc-500 tabular-nums">
            {flipped.size}/{cards.length} çevrildi
          </span>
        </h3>
        {flipped.size > 0 && (
          <button
            type="button"
            onClick={() => setFlipped(new Set())}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <RotateCcw className="size-3" /> Sıfırla
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-500">Önce cevabı kendin düşün, sonra karta tıklayıp çevir.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((c, i) => (
          <li key={i}>
            <FlipCard card={c} index={i} flipped={flipped.has(i)} onToggle={() => toggle(i)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlipCard({
  card,
  index,
  flipped,
  onToggle,
}: {
  card: Flashcard;
  index: number;
  flipped: boolean;
  onToggle: () => void;
}) {
  const face =
    "[grid-area:1/1] flex min-h-40 flex-col rounded-2xl border p-5 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={flipped}
      aria-label={`Kart ${index + 1}: ${flipped ? "cevabı gizle" : "cevabı göster"}`}
      className="block w-full rounded-2xl text-left [perspective:1200px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
    >
      <span
        className={`grid transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Ön yüz: soru */}
        <span
          className={`${face} border-zinc-200 bg-white hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500/50`}
          aria-hidden={flipped}
        >
          <span className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-zinc-500">
            <span className="truncate">{card.topic}</span>
            <span className="shrink-0 tabular-nums">{index + 1}</span>
          </span>
          <span className="flex-1 text-[15px] leading-relaxed font-medium whitespace-pre-wrap">{card.front}</span>
          <span className="mt-3 text-xs text-indigo-600 dark:text-indigo-400">Cevabı görmek için tıkla ↻</span>
        </span>
        {/* Arka yüz: cevap */}
        <span
          className={`${face} [transform:rotateY(180deg)] border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-950`}
          aria-hidden={!flipped}
        >
          <span className="mb-2 text-[11px] font-semibold tracking-wide text-indigo-700 uppercase dark:text-indigo-300">Cevap</span>
          <span className="flex-1 text-sm leading-relaxed whitespace-pre-wrap text-indigo-950 dark:text-indigo-50">{card.back}</span>
        </span>
      </span>
    </button>
  );
}
