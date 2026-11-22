"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ClipboardList,
  FileText,
  Layers,
  LoaderCircle,
  Presentation,
  RotateCcw,
  ScanEye,
  ScrollText,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, formatDate } from "@/lib/client-api";
import { isVisualPdf } from "@/lib/constants";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from "@/lib/exam/types";
import type { CourseDetail, ExamSummary, MaterialSummary } from "@/lib/types";
import type { StudySetSummary } from "@/lib/study/types";

interface Props {
  detail: CourseDetail;
  onUploadClick: () => void;
  onCreateExamClick: () => void;
  onReviewClick: () => void;
  onStudySetClick: () => void;
  onDelete: () => void;
  /** Bir PDF yeniden okunduğunda ya da silindiğinde (listeyi yenile + bildirim göster) */
  onMaterialChange: (message: string, ok: boolean) => void;
}

export function CourseView({
  detail,
  onUploadClick,
  onCreateExamClick,
  onReviewClick,
  onStudySetClick,
  onDelete,
  onMaterialChange,
}: Props) {
  const { course, materials, exams, review, study_sets: studySets } = detail;
  const slides = materials.filter((m) => m.file_type === "slide");
  const pastExams = materials.filter((m) => m.file_type === "past_exam");
  // Taranmış (metinsiz) PDF'ler sınav üretiminde işe yaramaz
  const canCreateExam = materials.some((m) => m.text_length >= 50);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-10 md:py-10">
      {/* Başlık */}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium tracking-wide text-indigo-600 uppercase dark:text-indigo-400">Ders</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">{course.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{formatDate(course.created_at)} tarihinde eklendi</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          title="Dersi sil"
          aria-label="Dersi sil"
        >
          <Trash2 className="size-4" />
        </button>
      </header>

      {/* Ana eylemler */}
      <section className="mb-10 grid gap-4 sm:grid-cols-2">
        <ActionCard
          icon={<Upload className="size-5" />}
          title="Materyal Yükle"
          description="Ders slaytlarını veya çıkmış soruları PDF olarak ekle."
          onClick={onUploadClick}
          tone="neutral"
        />
        <ActionCard
          icon={<Sparkles className="size-5" />}
          title="Yeni Sınav Oluştur"
          description={
            canCreateExam
              ? "Tüm dosyalardan ya da seçtiğin slaytlardan sana özel deneme sınavı hazırla."
              : materials.length
                ? "Yüklenen PDF'lerden metin çıkmadı; metin içeren bir PDF yükle."
                : "Önce en az bir materyal yükle."
          }
          onClick={onCreateExamClick}
          disabled={!canCreateExam}
          tone="primary"
        />
        <ActionCard
          icon={<Layers className="size-5" />}
          title="Özet & Kartlar"
          description={
            canCreateExam
              ? "Sınava girmeden çalış: konu özetleri ve bildim/bilemedim kart destesi."
              : "Önce metni okunabilen bir materyal yükle."
          }
          onClick={onStudySetClick}
          disabled={!canCreateExam}
          tone="neutral"
        />
        <ActionCard
          icon={<RotateCcw className="size-5" />}
          title="Yanlışlarımı Tekrar Et"
          description={
            review.total_wrong > 0
              ? `${review.total_wrong} yanlışından (${review.topics.length} konu) aynı kavramları farklı açıdan soran mini sınav.`
              : "Bir deneme sınavı çözdükten sonra yanlışların burada tekrar sorulur."
          }
          onClick={onReviewClick}
          disabled={review.total_wrong === 0 || !canCreateExam}
          tone="neutral"
        />
      </section>

      {/* Materyaller */}
      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        <MaterialList title="Ders Slaytları" icon={<Presentation className="size-4" />} items={slides} onChange={onMaterialChange} />
        <MaterialList title="Çıkmış Sorular" icon={<ScrollText className="size-4" />} items={pastExams} onChange={onMaterialChange} />
      </section>

      {/* Çalışma setleri */}
      <section className="mb-10">
        <SectionTitle icon={<Layers className="size-4" />} title="Çalışma Setlerim" count={studySets.length} />
        {studySets.length === 0 ? (
          <EmptyBox text="Henüz çalışma seti yok. “Özet & Kartlar” ile seçtiğin dosyalardan özet ve kart destesi oluşturabilirsin." />
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {studySets.map((set) => (
              <StudySetRow key={set.id} set={set} onChange={onMaterialChange} />
            ))}
          </ul>
        )}
      </section>

      {/* Sınavlar */}
      <section>
        <SectionTitle icon={<ClipboardList className="size-4" />} title="Deneme Sınavlarım" count={exams.length} />
        {exams.length === 0 ? (
          <EmptyBox text="Henüz sınav yok. Oluşturduğun deneme sınavları ve puanların burada listelenecek." />
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {exams.map((e) => (
              <ExamRow key={e.id} exam={e} onChange={onMaterialChange} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
  disabled,
  tone,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "primary" | "neutral";
}) {
  const primary = tone === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-start gap-4 rounded-2xl border p-5 text-left transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 ${
        primary
          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 disabled:hover:bg-indigo-600"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      }`}
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${
          primary ? "bg-white/15" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
        }`}
      >
        {icon}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className={`mt-0.5 block text-sm ${primary ? "text-indigo-100" : "text-zinc-500"}`}>{description}</span>
      </span>
    </button>
  );
}

function SectionTitle({ icon, title, count }: { icon: ReactNode; title: string; count: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
      <span className="text-zinc-400">{icon}</span>
      {title}
      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-400">
        {count}
      </span>
    </h2>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
      {text}
    </p>
  );
}

function MaterialList({
  title,
  icon,
  items,
  onChange,
}: {
  title: string;
  icon: ReactNode;
  items: MaterialSummary[];
  onChange: MaterialRowProps["onChange"];
}) {
  return (
    <div>
      <SectionTitle icon={icon} title={title} count={items.length} />
      {items.length === 0 ? (
        <EmptyBox text="Henüz dosya yok." />
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {items.map((m) => (
            <MaterialRow key={m.id} material={m} onChange={onChange} />
          ))}
        </ul>
      )}
    </div>
  );
}

interface MaterialRowProps {
  material: MaterialSummary;
  /** Okuma ya da silme bitince (başarılı ya da değil) kullanıcıya gösterilecek mesajla çağrılır */
  onChange: (message: string, ok: boolean) => void;
}

function MaterialRow({ material: m, onChange }: MaterialRowProps) {
  const [reading, setReading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const byVision = m.extraction_method === "gemini_vision";
  const canRead = !byVision && isVisualPdf(m.text_length, m.page_count);

  async function read() {
    setReading(true);
    try {
      const res = await api.readMaterialWithVision(m.id);
      onChange(res.notice ?? "PDF yapay zekâ ile okundu.", true);
    } catch (err) {
      onChange(err instanceof Error ? err.message : "PDF okunamadı.", false);
    } finally {
      setReading(false);
    }
  }

  async function remove() {
    if (!window.confirm(`"${m.file_name}" silinsin mi? Daha önce oluşturduğun sınavlar etkilenmez.`)) return;
    setDeleting(true);
    try {
      await api.deleteMaterial(m.id);
      onChange(`"${m.file_name}" silindi.`, true);
    } catch (err) {
      onChange(err instanceof Error ? err.message : "Dosya silinemedi.", false);
      setDeleting(false);
    }
  }

  return (
    <li className={`flex items-center gap-3 py-3 pr-2 pl-4 transition ${deleting ? "opacity-50" : ""}`}>
      <FileText className="size-4 shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={m.file_name}>
          {m.file_name}
        </p>
        <p className="text-xs text-zinc-500">
          {m.page_count ?? "?"} sayfa · {m.text_length.toLocaleString("tr-TR")} karakter · {formatDate(m.created_at)}
        </p>
      </div>
      {byVision && (
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
          title="Sayfalar Gemini ile görsel olarak okundu (diyagramlar ve formüller dahil)"
        >
          <ScanEye className="size-3" /> AI ile okundu
        </span>
      )}
      {canRead && (
        <button
          type="button"
          onClick={read}
          disabled={reading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-70 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
          title="Bu PDF görsel ağırlıklı; metni çok az. Sayfaları yapay zekâ ile okut."
        >
          {reading ? <LoaderCircle className="size-3 animate-spin" /> : <ScanEye className="size-3" />}
          {reading ? "Okunuyor… (1-2 dk)" : "Yapay zekâ ile oku"}
        </button>
      )}
      {!byVision && !canRead && m.text_length < 50 && (
        <span
          className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          title="PDF'ten metin çıkmadı ve otomatik okuma için çok uzun"
        >
          Metin yok
        </span>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={deleting || reading}
        className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        title="Dosyayı sil"
        aria-label={`${m.file_name} dosyasını sil`}
      >
        {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}
      </button>
    </li>
  );
}

function StudySetRow({ set, onChange }: { set: StudySetSummary; onChange: (message: string, ok: boolean) => void }) {
  const [deleting, setDeleting] = useState(false);
  const pct = set.card_count ? Math.round((set.known_count / set.card_count) * 100) : 0;

  async function remove() {
    if (!window.confirm(`"${set.title}" çalışma seti silinsin mi?`)) return;
    setDeleting(true);
    try {
      await api.deleteStudySet(set.id);
      onChange("Çalışma seti silindi.", true);
    } catch (err) {
      onChange(err instanceof Error ? err.message : "Çalışma seti silinemedi.", false);
      setDeleting(false);
    }
  }

  return (
    <li className={`flex items-center gap-2 pr-2 transition ${deleting ? "opacity-50" : ""}`}>
      <Link
        href={`/study/${set.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{set.title}</p>
          <p className="text-xs text-zinc-500">
            {formatDate(set.created_at)} · {set.topic_count} konu · {set.card_count} kart · {set.source_count} dosya
          </p>
        </div>
        <span className="hidden shrink-0 items-center gap-2 text-xs text-zinc-500 sm:flex" title="Bildiğin kartlar">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </span>
          <span className="tabular-nums">
            {set.known_count}/{set.card_count}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-zinc-400" />
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        title="Çalışma setini sil"
        aria-label={`${set.title} çalışma setini sil`}
      >
        {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}
      </button>
    </li>
  );
}

function ExamRow({ exam, onChange }: { exam: ExamSummary; onChange: (message: string, ok: boolean) => void }) {
  const [deleting, setDeleting] = useState(false);
  const done = exam.score !== null;

  async function remove() {
    const what = done ? "Sınav, puanın ve çalışma rehberiyle birlikte" : "Çözülmemiş sınav";
    if (!window.confirm(`"${exam.title ?? "Deneme Sınavı"}" silinsin mi? ${what} kalıcı olarak silinir.`)) return;
    setDeleting(true);
    try {
      await api.deleteExam(exam.id);
      onChange("Sınav silindi.", true);
    } catch (err) {
      onChange(err instanceof Error ? err.message : "Sınav silinemedi.", false);
      setDeleting(false);
    }
  }
  const tone =
    exam.score === null
      ? ""
      : exam.score >= 70
        ? "text-emerald-600 dark:text-emerald-400"
        : exam.score >= 50
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";
  const meta = [
    exam.settings?.mode === "review" ? "Tekrar sınavı" : null,
    formatDate(exam.created_at),
    `${exam.question_count} soru`,
    exam.settings ? DIFFICULTY_LABELS[exam.settings.difficulty] : null,
    exam.settings ? QUESTION_TYPE_LABELS[exam.settings.questionType] : null,
  ].filter(Boolean);

  return (
    <li className={`flex items-center gap-2 pr-2 transition ${deleting ? "opacity-50" : ""}`}>
      <Link
        href={`/exams/${exam.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{exam.title ?? "Deneme Sınavı"}</p>
          <p className="text-xs text-zinc-500">{meta.join(" · ")}</p>
        </div>
        {done ? (
          <span className={`text-sm font-semibold tabular-nums ${tone}`}>%{Math.round(exam.score!)}</span>
        ) : (
          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            Devam et
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-zinc-400" />
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        title="Sınavı sil"
        aria-label={`${exam.title ?? "Deneme Sınavı"} sınavını sil`}
      >
        {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}
      </button>
    </li>
  );
}
