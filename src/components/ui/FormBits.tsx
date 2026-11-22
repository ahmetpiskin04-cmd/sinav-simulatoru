"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CircleAlert, LoaderCircle, Sparkles } from "lucide-react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</p>
      {children}
    </div>
  );
}

/** Birkaç seçenekten birini seçtiren bölünmüş düğme grubu */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/70">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Uzun süren yapay zekâ işlemi sırasında gösterilen bekleme ekranı (geçen süreyle) */
export function GeneratingState({ startedAt, title, hint }: { startedAt: number; title: string; hint: string }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  return (
    <div className="flex flex-col items-center py-6 text-center" role="status">
      <div className="relative mb-5 grid size-14 place-items-center">
        <LoaderCircle className="absolute size-14 animate-spin text-indigo-500/30" strokeWidth={1.5} />
        <Sparkles className="size-6 text-indigo-600 dark:text-indigo-400" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-zinc-500">{hint}</p>
      <p className="mt-4 font-mono text-xs text-zinc-400 tabular-nums">{seconds} sn</p>
    </div>
  );
}

export function ErrorNote({ text }: { text: string }) {
  return (
    <div className="mt-4 flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmIcon,
  disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        Vazgeç
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {confirmIcon}
        {confirmLabel}
      </button>
    </div>
  );
}
