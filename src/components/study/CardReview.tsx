"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CircleAlert, Play, RotateCcw, Shuffle, X } from "lucide-react";
import { api } from "@/lib/client-api";
import type { Flashcard } from "@/lib/exam/types";
import type { CardStatusMap } from "@/lib/study/types";

interface Props {
  setId: string;
  cards: Flashcard[];
  initialStatus: CardStatusMap;
}

type Session = { queue: number[]; pos: number; flipped: boolean; known: number[]; unknown: number[] };

function shuffled<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Kartları tek tek çalıştırır: çevir → "Bildim" / "Bilemedim". Durumlar sunucuya
 * kaydedilir; sonraki sefer "yalnızca bilemediklerim" ile tekrar edilebilir.
 * Klavye: Boşluk/Enter çevir, ← ya da 1 bilemedim, → ya da 2 bildim.
 */
export function CardReview({ setId, cards, initialStatus }: Props) {
  const [status, setStatus] = useState<CardStatusMap>(initialStatus);
  const [session, setSession] = useState<Session | null>(null);
  const [shuffle, setShuffle] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  const all = cards.map((_, i) => i);
  const knownIdx = all.filter((i) => status[String(i)] === "known");
  const unknownIdx = all.filter((i) => status[String(i)] === "unknown");
  const newIdx = all.filter((i) => !status[String(i)]);
  const notKnownIdx = all.filter((i) => status[String(i)] !== "known");

  function start(indices: number[]) {
    setSession({ queue: shuffle ? shuffled(indices) : indices, pos: 0, flipped: false, known: [], unknown: [] });
  }

  const answer = useCallback(
    (knew: boolean) => {
      if (!session || !session.flipped) return;
      const idx = session.queue[session.pos];
      const next: CardStatusMap = { ...status, [String(idx)]: knew ? "known" : "unknown" };
      setStatus(next);
      setSession({
        ...session,
        pos: session.pos + 1,
        flipped: false,
        known: knew ? [...session.known, idx] : session.known,
        unknown: knew ? session.unknown : [...session.unknown, idx],
      });
      // İyimser kayıt: arayüz beklemez, hata olursa küçük bir uyarı gösterir
      api.saveCardStatus(setId, next).then(
        () => setSaveError(null),
        () => setSaveError("İlerleme kaydedilemedi; bağlantını kontrol et. Çalışmaya devam edebilirsin."),
      );
    },
    [session, status, setId],
  );

  const flip = useCallback(() => {
    setSession((s) => (s && s.pos < s.queue.length ? { ...s, flipped: !s.flipped } : s));
  }, []);

  useEffect(() => {
    if (!session || session.pos >= session.queue.length) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "BUTTON"].includes(e.target.tagName) && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      } else if (e.key === "ArrowLeft" || e.key === "1") answer(false);
      else if (e.key === "ArrowRight" || e.key === "2") answer(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, flip, answer]);

  // --- Başlangıç ekranı ---
  if (!session) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Bildiğin" value={knownIdx.length} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Bilemediğin" value={unknownIdx.length} tone="text-red-600 dark:text-red-400" />
          <Stat label="Yeni" value={newIdx.length} tone="text-zinc-700 dark:text-zinc-300" />
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {notKnownIdx.length > 0 && notKnownIdx.length < cards.length && (
            <button
              type="button"
              onClick={() => start(notKnownIdx)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
            >
              <RotateCcw className="size-4" />
              Bilmediklerimi çalış ({notKnownIdx.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => start(all)}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              notKnownIdx.length > 0 && notKnownIdx.length < cards.length
                ? "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                : "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500"
            }`}
          >
            <Play className="size-4" />
            Tüm kartları çalış ({cards.length})
          </button>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="size-4 accent-indigo-600" />
          <Shuffle className="size-3.5" /> Kartları karıştır
        </label>
        {knownIdx.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Tüm kartların durumu sıfırlansın mı?")) return;
              setStatus({});
              api.saveCardStatus(setId, {}).catch(() => setSaveError("Sıfırlama kaydedilemedi."));
            }}
            className="mt-3 text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
          >
            İlerlemeyi sıfırla
          </button>
        )}
        {saveError && <SaveError text={saveError} />}
      </div>
    );
  }

  // --- Tur bitti ---
  if (session.pos >= session.queue.length) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-lg font-semibold">Tur bitti!</p>
        <p className="mt-1 text-sm text-zinc-500">
          {session.queue.length} karttan <span className="font-medium text-emerald-600 dark:text-emerald-400">{session.known.length} bildin</span>
          {session.unknown.length > 0 && (
            <>
              , <span className="font-medium text-red-600 dark:text-red-400">{session.unknown.length} bilemedin</span>
            </>
          )}
          .
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          {session.unknown.length > 0 && (
            <button
              type="button"
              onClick={() => start(session.unknown)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
            >
              <RotateCcw className="size-4" />
              Bilemediklerimi tekrar et ({session.unknown.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setSession(null)}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Bitir
          </button>
        </div>
        {saveError && <SaveError text={saveError} />}
      </div>
    );
  }

  // --- Kart ---
  const idx = session.queue[session.pos];
  const card = cards[idx];
  const progress = (session.pos / session.queue.length) * 100;
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-xs text-zinc-500">
        <span className="tabular-nums">
          {session.pos + 1} / {session.queue.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <button type="button" onClick={() => setSession(null)} className="hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">
          Çık
        </button>
      </div>

      <button
        type="button"
        onClick={flip}
        aria-label={session.flipped ? "Soruya dön" : "Cevabı göster"}
        className="block w-full rounded-3xl text-left [perspective:1400px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
      >
        <span
          className={`grid transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none ${
            session.flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <span
            className="flex min-h-64 flex-col rounded-3xl border border-zinc-200 bg-white p-7 [grid-area:1/1] [backface-visibility:hidden] [-webkit-backface-visibility:hidden] dark:border-zinc-800 dark:bg-zinc-900"
            aria-hidden={session.flipped}
          >
            <span className="mb-3 text-xs font-medium text-zinc-500">{card.topic}</span>
            <span className="flex flex-1 items-center text-lg leading-relaxed font-medium whitespace-pre-wrap md:text-xl">{card.front}</span>
            <span className="mt-4 text-xs text-indigo-600 dark:text-indigo-400">Cevabı görmek için tıkla ya da Boşluk tuşuna bas ↻</span>
          </span>
          <span
            className="flex min-h-64 flex-col rounded-3xl border border-indigo-300 bg-indigo-50 p-7 [grid-area:1/1] [transform:rotateY(180deg)] [backface-visibility:hidden] [-webkit-backface-visibility:hidden] dark:border-indigo-500/40 dark:bg-indigo-950"
            aria-hidden={!session.flipped}
          >
            <span className="mb-3 text-xs font-semibold tracking-wide text-indigo-700 uppercase dark:text-indigo-300">Cevap</span>
            <span className="flex flex-1 items-center text-base leading-relaxed whitespace-pre-wrap text-indigo-950 md:text-lg dark:text-indigo-50">
              {card.back}
            </span>
          </span>
        </span>
      </button>

      <div className={`mt-4 grid grid-cols-2 gap-3 transition ${session.flipped ? "" : "pointer-events-none opacity-40"}`}>
        <button
          type="button"
          onClick={() => answer(false)}
          disabled={!session.flipped}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
        >
          <X className="size-4" /> Bilemedim <kbd className="ml-1 hidden text-[11px] opacity-60 sm:inline">←</kbd>
        </button>
        <button
          type="button"
          onClick={() => answer(true)}
          disabled={!session.flipped}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
        >
          <Check className="size-4" /> Bildim <kbd className="ml-1 hidden text-[11px] opacity-60 sm:inline">→</kbd>
        </button>
      </div>
      {!session.flipped && <p className="mt-2 text-center text-xs text-zinc-500">Önce cevabı kendin düşün, sonra kartı çevir.</p>}
      {saveError && <SaveError text={saveError} />}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 py-3 dark:bg-zinc-800/50">
      <p className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function SaveError({ text }: { text: string }) {
  return (
    <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <CircleAlert className="size-3.5" /> {text}
    </p>
  );
}
