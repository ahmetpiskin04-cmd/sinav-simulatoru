"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, GraduationCap, LoaderCircle, Plus, X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { Course } from "@/lib/types";

interface SidebarProps {
  courses: Course[] | null; // null = yükleniyor
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (title: string) => Promise<void>;
  disabled?: boolean; // Supabase yapılandırılmamışsa
  onCloseMobile?: () => void;
}

export function Sidebar({ courses, selectedId, onSelect, onCreate, disabled, onCloseMobile }: SidebarProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate(t);
      setTitle("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ders eklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-100/60 dark:border-zinc-800 dark:bg-zinc-900/60">
      {/* Logo */}
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <GraduationCap className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="font-semibold">Sınav Simülatörü</p>
            <p className="text-xs text-zinc-500">Kişisel deneme sınavları</p>
          </div>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 md:hidden dark:hover:bg-zinc-800"
            aria-label="Menüyü kapat"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Başlık + yeni ders */}
      <div className="flex items-center justify-between px-5 pt-2 pb-2">
        <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Derslerim</span>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setError(null);
          }}
          disabled={disabled}
          className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Yeni ders ekle"
          title="Yeni ders ekle"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} className="px-3 pb-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            placeholder="Örn. Operating Systems"
            maxLength={120}
            disabled={saving}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          />
          {error && <p className="mt-1.5 px-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving && <LoaderCircle className="size-3.5 animate-spin" />}
              Ekle
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}

      {/* Ders listesi */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {courses === null ? (
          <div className="space-y-1.5 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <p className="px-2 pt-2 text-sm text-zinc-500">
            {disabled ? "Bağlantı kurulunca dersler burada görünecek." : "Henüz ders yok. + ile ilk dersini ekle."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {courses.map((c) => {
              const active = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-700"
                        : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                    }`}
                  >
                    <BookOpen className={`size-4 shrink-0 ${active ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <ThemeToggle />
      </div>
    </aside>
  );
}
