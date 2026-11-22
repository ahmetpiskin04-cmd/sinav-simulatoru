"use client";

import { useRef, useState, type DragEvent } from "react";
import { CircleAlert, CircleCheck, FileText, LoaderCircle, Presentation, ScanEye, ScrollText, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/client-api";
import { MAX_PDF_BYTES, MAX_PDF_MB } from "@/lib/constants";
import type { MaterialType } from "@/lib/types";

interface Props {
  open: boolean;
  courseId: string;
  courseTitle: string;
  onClose: () => void;
  onUploaded: () => void;
}

type ItemStatus = {
  file: File;
  state: "waiting" | "uploading" | "done" | "error";
  message?: string;
  /** info: bilgi (ör. yapay zekâ ile okundu), warn: dikkat, error: hata */
  tone?: "info" | "warn" | "error";
};

const TYPES: { value: MaterialType; label: string; hint: string; icon: typeof Presentation }[] = [
  { value: "slide", label: "Ders Slaytı", hint: "Konu anlatımı, sunumlar", icon: Presentation },
  { value: "past_exam", label: "Çıkmış Soru", hint: "Geçmiş vize/final kâğıtları", icon: ScrollText },
];

export function UploadMaterialModal({ open, courseId, courseTitle, onClose, onUploaded }: Props) {
  const [fileType, setFileType] = useState<MaterialType>("slide");
  const [items, setItems] = useState<ItemStatus[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = items.some((i) => i.state === "uploading");
  const pending = items.filter((i) => i.state === "waiting");
  const finished = items.length > 0 && items.every((i) => i.state === "done" || i.state === "error");

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: ItemStatus[] = Array.from(list).map((file) => {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) return { file, state: "error", tone: "error", message: "PDF değil" };
      if (file.size > MAX_PDF_BYTES) return { file, state: "error", tone: "error", message: `${MAX_PDF_MB} MB sınırını aşıyor` };
      return { file, state: "waiting" };
    });
    // Tamamlanmış bir turdan sonra yeni dosya seçilirse listeyi temizle
    setItems((prev) => (prev.every((i) => i.state !== "waiting") ? next : [...prev, ...next]));
  }

  function setItem(index: number, patch: Partial<ItemStatus>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function uploadAll() {
    let anySuccess = false;
    // Sırayla yükle: sunucuda PDF ayrıştırma bellek yoğun, paralel yüklemek gereksiz yük
    for (let i = 0; i < items.length; i++) {
      if (items[i].state !== "waiting") continue;
      setItem(i, { state: "uploading" });
      try {
        const res = await api.uploadMaterial(courseId, items[i].file, fileType);
        setItem(i, {
          state: "done",
          message: res.warning ?? res.notice,
          tone: res.warning ? "warn" : "info",
        });
        anySuccess = true;
      } catch (err) {
        setItem(i, { state: "error", tone: "error", message: err instanceof Error ? err.message : "Yüklenemedi" });
      }
    }
    if (anySuccess) onUploaded();
  }

  function close() {
    if (busy) return;
    setItems([]);
    setDragging(false);
    onClose();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!busy) addFiles(e.dataTransfer.files);
  }

  return (
    <Modal open={open} title="Materyal Yükle" onClose={close} locked={busy}>
      <p className="-mt-3 mb-5 text-sm text-zinc-500">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{courseTitle}</span> dersine PDF ekle. Metin
        otomatik çıkarılır ve sınav üretiminde kullanılır.
      </p>

      {/* Tür seçimi */}
      <fieldset className="mb-4 grid grid-cols-2 gap-2" disabled={busy}>
        <legend className="sr-only">Materyal türü</legend>
        {TYPES.map((t) => {
          const active = fileType === t.value;
          const Icon = t.icon;
          return (
            <label
              key={t.value}
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                active
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-500/10"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name="file_type"
                value={t.value}
                checked={active}
                onChange={() => setFileType(t.value)}
                className="sr-only"
              />
              <Icon className={`mt-0.5 size-4 shrink-0 ${active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500"}`} />
              <span>
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="block text-xs text-zinc-500">{t.hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {/* Bırakma alanı */}
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition disabled:opacity-50 ${
          dragging
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
            : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50"
        }`}
      >
        <UploadCloud className="size-8 text-zinc-400" />
        <span className="text-sm font-medium">PDF&apos;leri sürükle bırak veya seç</span>
        <span className="text-xs text-zinc-500">Birden fazla dosya seçebilirsin · dosya başına en fazla {MAX_PDF_MB} MB</span>
        <span className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
          <ScanEye className="size-3.5" />
          Taranmış / görsel ağırlıklı PDF&apos;ler yapay zekâ ile okunur (dosya başına 1-2 dk sürebilir)
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = ""; // aynı dosyayı tekrar seçebilmek için
        }}
      />

      {/* Dosya listesi */}
      {items.length > 0 && (
        <ul className="mt-4 max-h-52 space-y-1.5 overflow-y-auto">
          {items.map((it, i) => (
            <li
              key={`${it.file.name}-${i}`}
              className="flex items-center gap-2.5 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60"
            >
              <StatusIcon state={it.state} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{it.file.name}</span>
                {it.state === "uploading" && (
                  <span className="block text-xs text-zinc-500">Yükleniyor ve okunuyor…</span>
                )}
                {it.message && (
                  <span
                    className={`block text-xs ${
                      it.tone === "error"
                        ? "text-red-600 dark:text-red-400"
                        : it.tone === "warn"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-indigo-600 dark:text-indigo-400"
                    }`}
                  >
                    {it.message}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">{(it.file.size / 1024 / 1024).toFixed(1)} MB</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={close}
          disabled={busy}
          className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {finished ? "Kapat" : "Vazgeç"}
        </button>
        <button
          type="button"
          onClick={uploadAll}
          disabled={busy || pending.length === 0}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {busy ? "Yükleniyor…" : pending.length > 1 ? `${pending.length} dosyayı yükle` : "Yükle"}
        </button>
      </div>
    </Modal>
  );
}

function StatusIcon({ state }: { state: ItemStatus["state"] }) {
  if (state === "uploading") return <LoaderCircle className="size-4 shrink-0 animate-spin text-indigo-500" />;
  if (state === "done") return <CircleCheck className="size-4 shrink-0 text-emerald-500" />;
  if (state === "error") return <CircleAlert className="size-4 shrink-0 text-red-500" />;
  return <FileText className="size-4 shrink-0 text-zinc-400" />;
}
