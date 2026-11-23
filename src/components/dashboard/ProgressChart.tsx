import { TrendingDown, TrendingUp } from "lucide-react";
import { formatDate } from "@/lib/client-api";
import type { ExamSummary } from "@/lib/types";

/** Çözülmüş sınavların puanlarını zaman içinde gösteren küçük çubuk grafik (bağımlılık yok) */
export function ProgressChart({ exams }: { exams: ExamSummary[] }) {
  const done = exams
    .filter((e) => e.score !== null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-12);
  if (done.length < 2) return null;

  const first = done[0].score!;
  const last = done[done.length - 1].score!;
  const diff = Math.round(last - first);
  const avg = Math.round(done.reduce((n, e) => n + e.score!, 0) / done.length);
  const color = (s: number) => (s >= 70 ? "bg-emerald-500" : s >= 50 ? "bg-amber-500" : "bg-red-500");

  return (
    <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Sınav ilerlemen</h2>
        <p className="flex items-center gap-3 text-xs text-zinc-500">
          <span>Ortalama %{avg}</span>
          <span
            className={`inline-flex items-center gap-1 font-medium ${diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          >
            {diff >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {diff >= 0 ? "+" : ""}
            {diff} puan (ilk sınava göre)
          </span>
        </p>
      </div>
      <ul className="flex h-32 items-end gap-2 border-b border-zinc-200 dark:border-zinc-700" aria-label="Sınav puanları">
        {done.map((e) => (
          <li key={e.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${e.title ?? "Sınav"} · ${formatDate(e.created_at)} · %${Math.round(e.score!)}`}>
            <span className="text-[11px] font-medium text-zinc-600 tabular-nums dark:text-zinc-400">{Math.round(e.score!)}</span>
            <div className={`w-full max-w-10 rounded-t-md ${color(e.score!)}`} style={{ height: `${Math.max(e.score!, 3) * 0.85}%` }} />
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
        <span>{formatDate(done[0].created_at)}</span>
        <span>{formatDate(done[done.length - 1].created_at)}</span>
      </div>
    </section>
  );
}
