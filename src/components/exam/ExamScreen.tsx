"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ExamRunner } from "@/components/exam/ExamRunner";
import { ExamResult } from "@/components/exam/ExamResult";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, type ExamView } from "@/lib/exam/types";

const noopSubscribe = () => () => {};

/** Sınav sayfasının iskeleti: çözme ↔ sonuç arasında geçiş yapar */
export function ExamScreen({ initial }: { initial: ExamView }) {
  const [view, setView] = useState<ExamView>(initial);
  // Taslak cevaplar localStorage'dan okunduğu için çözme ekranı yalnızca tarayıcıda çizilir
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const chips = [
    `${view.questions.length} soru`,
    view.settings ? DIFFICULTY_LABELS[view.settings.difficulty] : null,
    view.settings ? QUESTION_TYPE_LABELS[view.settings.questionType] : null,
  ].filter(Boolean) as string[];

  const verification = view.settings?.verification;
  // Sınavın kapsamı: tekrar sınavında odak konular, seçimli sınavda kaynak dosyalar
  const isReview = view.settings?.mode === "review";
  const list = (items: string[]) => (items.length > 5 ? `${items.slice(0, 5).join(", ")} +${items.length - 5}` : items.join(", "));
  const scopeText = isReview && view.settings?.focusTopics?.length
    ? `Odak konular: ${list(view.settings.focusTopics)}`
    : view.settings?.materialNames?.length
      ? `Kaynak: ${list(view.settings.materialNames)}`
      : null;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Link
            href="/"
            className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="truncate">{view.course.title}</span>
          </Link>
          <div className="w-36 shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pt-8">
        <p className="mb-1 text-xs font-medium tracking-wide text-indigo-600 uppercase dark:text-indigo-400">
          {view.status === "completed" ? "Sınav sonucu" : isReview ? "Tekrar sınavı" : "Deneme sınavı"}
          {view.status === "completed" && isReview ? " · Tekrar sınavı" : ""}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{view.title}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full bg-zinc-200/70 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {c}
            </span>
          ))}
          {verification && verification.checked > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              title={`${verification.checked} çoktan seçmeli soru, cevap anahtarı görülmeden ayrıca çözüldü. ${
                verification.rejected
                  ? `Anahtarı yanlış ya da hatalı bulunan ${verification.rejected} soru sınavdan çıkarıldı.`
                  : "Tüm anahtarlar doğrulandı."
              }`}
            >
              <ShieldCheck className="size-3.5" /> Cevap anahtarı doğrulandı
            </span>
          )}
          {verification === null && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
              title="Doğrulama modeline şu an ulaşılamadı (çoğunlukla günlük ücretsiz kota doluyor). Sorular yine de kullanılabilir; bir çözüm sana yanlış gelirse slayttan kontrol et."
            >
              <ShieldAlert className="size-3.5" /> Cevap anahtarı doğrulanamadı
            </span>
          )}
        </div>
        {scopeText && (
          <p className="mt-2 text-xs text-zinc-500" title={scopeText}>
            {scopeText}
          </p>
        )}
      </div>

      {view.status === "completed" ? (
        <ExamResult view={view} />
      ) : isClient ? (
        <ExamRunner view={view} onCompleted={setView} />
      ) : (
        <div className="grid place-items-center py-24">
          <LoaderCircle className="size-6 animate-spin text-zinc-400" />
        </div>
      )}
    </div>
  );
}
