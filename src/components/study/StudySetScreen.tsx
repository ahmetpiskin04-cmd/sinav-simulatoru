"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Layers } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TopicSummaryList } from "@/components/exam/StudyGuidePanel";
import { CardReview } from "@/components/study/CardReview";
import { formatDate } from "@/lib/client-api";
import type { StudySetView } from "@/lib/study/types";

type Tab = "cards" | "summary";

export function StudySetScreen({ initial }: { initial: StudySetView }) {
  const [tab, setTab] = useState<Tab>("cards");
  const set = initial;
  const sources = set.source_names;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Link
            href="/"
            className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="truncate">{set.course.title}</span>
          </Link>
          <div className="w-36 shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pt-8 pb-20">
        <p className="mb-1 text-xs font-medium tracking-wide text-indigo-600 uppercase dark:text-indigo-400">Çalışma seti</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{set.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {formatDate(set.created_at)} · {set.content.topics.length} konu · {set.content.flashcards.length} kart
        </p>
        {sources.length > 0 && (
          <p className="mt-1 text-xs text-zinc-500" title={sources.join(", ")}>
            Kaynak: {sources.length > 4 ? `${sources.slice(0, 4).join(", ")} +${sources.length - 4}` : sources.join(", ")}
          </p>
        )}

        <div role="tablist" className="mt-6 mb-6 inline-flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/70">
          <TabButton active={tab === "cards"} onClick={() => setTab("cards")} icon={<Layers className="size-4" />}>
            Kartlar
          </TabButton>
          <TabButton active={tab === "summary"} onClick={() => setTab("summary")} icon={<BookOpen className="size-4" />}>
            Konu özetleri
          </TabButton>
        </div>

        {/* Kart çalışması sekme değişince sıfırlanmasın diye gizlenir, kaldırılmaz */}
        <div hidden={tab !== "cards"}>
          <CardReview setId={set.id} cards={set.content.flashcards} initialStatus={set.card_status} />
        </div>
        {tab === "summary" && <TopicSummaryList topics={set.content.topics} />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition ${
        active
          ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
