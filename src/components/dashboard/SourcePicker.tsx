"use client";

import { Presentation, ScrollText } from "lucide-react";
import type { MaterialSummary } from "@/lib/types";

/** Metni okunabilir (sınav/özet üretiminde kullanılabilir) materyaller */
export const usableMaterials = (materials: MaterialSummary[]) => materials.filter((m) => m.text_length >= 50);

interface Props {
  materials: MaterialSummary[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}

/** Hangi PDF'lerden soru/özet üretileceğini seçtiren onay kutusu listesi */
export function SourcePicker({ materials, selected, onChange, disabled }: Props) {
  const usable = usableMaterials(materials);
  // Slaytlar önce, sonra çıkmış sorular; her grupta ada göre (Lecture_1, Lecture_2…)
  const sorted = [...usable].sort(
    (a, b) =>
      (a.file_type === b.file_type ? 0 : a.file_type === "slide" ? -1 : 1) ||
      a.file_name.localeCompare(b.file_name, "tr", { numeric: true }),
  );
  const allSelected = usable.length > 0 && usable.every((m) => selected.has(m.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          Kaynaklar <span className="normal-case tabular-nums">({selected.size}/{usable.length})</span>
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(allSelected ? new Set() : new Set(usable.map((m) => m.id)))}
          className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
        >
          {allSelected ? "Hiçbirini seçme" : "Tümünü seç"}
        </button>
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 p-1.5 dark:border-zinc-700">
        {sorted.map((m) => {
          const Icon = m.file_type === "slide" ? Presentation : ScrollText;
          const checked = selected.has(m.id);
          return (
            <li key={m.id}>
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
                  checked ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                } ${disabled ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(m.id)}
                  className="size-4 shrink-0 accent-indigo-600"
                />
                <Icon className="size-3.5 shrink-0 text-zinc-400" />
                <span className="min-w-0 flex-1 truncate" title={m.file_name}>
                  {m.file_name}
                </span>
                <span className="shrink-0 text-[11px] text-zinc-500">
                  {m.file_type === "past_exam" ? "çıkmış soru" : `${m.page_count ?? "?"} sf`}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
