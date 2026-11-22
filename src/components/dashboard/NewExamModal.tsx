"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ErrorNote, Field, GeneratingState, ModalActions, Segmented } from "@/components/ui/FormBits";
import { SourcePicker, usableMaterials } from "@/components/dashboard/SourcePicker";
import { api } from "@/lib/client-api";
import {
  DIFFICULTY_LABELS,
  QUESTION_COUNTS,
  QUESTION_TYPE_LABELS,
  type Difficulty,
  type ExamMode,
  type QuestionTypeSetting,
} from "@/lib/exam/types";
import type { ReviewSummary } from "@/lib/exam/review";
import type { MaterialSummary } from "@/lib/types";

interface Props {
  /** normal: seçilen kaynaklardan; review: önceki yanlışlardan */
  mode: ExamMode;
  courseId: string;
  courseTitle: string;
  materials: MaterialSummary[];
  review: ReviewSummary;
  onClose: () => void;
}

/** Açıkken çizilir (kapanınca kaldırılır), böylece her açılışta seçimler sıfırlanır. */
export function NewExamModal({ mode, courseId, courseTitle, materials, review, onClose }: Props) {
  const router = useRouter();
  const isReview = mode === "review";
  const usable = usableMaterials(materials);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(usable.map((m) => m.id)));
  const [questionCount, setQuestionCount] = useState<number>(isReview ? 5 : 10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questionType, setQuestionType] = useState<QuestionTypeSetting>("mixed");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = startedAt !== null;

  const allSelected = selected.size === usable.length;
  const hasPastExam = usable.some((m) => m.file_type === "past_exam" && selected.has(m.id));

  async function start() {
    setStartedAt(Date.now());
    setError(null);
    try {
      const { examId } = await api.generateExam(courseId, {
        questionCount,
        difficulty,
        questionType,
        mode,
        // Hepsi seçiliyse göndermeye gerek yok: sunucu tümünü kullanır
        materialIds: isReview || allSelected ? undefined : [...selected],
      });
      // Yönlendirme ve pencerenin kapanması tek geçişte: sınav sayfası hazır olana kadar
      // "hazırlanıyor" görünür, sonra ikisi birlikte uygulanır.
      startTransition(() => {
        router.push(`/exams/${examId}`);
        onClose();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sınav oluşturulamadı.");
      setStartedAt(null);
    }
  }

  function close() {
    if (!busy) onClose();
  }

  return (
    <Modal open title={isReview ? "Yanlışlarımı Tekrar Et" : "Yeni Sınav Oluştur"} onClose={close} locked={busy}>
      {busy ? (
        <GeneratingState
          startedAt={startedAt}
          title={isReview ? `${questionCount} soruluk tekrar sınavın hazırlanıyor…` : `${questionCount} soruluk sınavın hazırlanıyor…`}
          hint="Yapay zekâ soruları ve çözümleri yazıyor, ardından cevap anahtarını ayrıca çözerek kontrol ediyor. Bu genellikle 1-2 dakika sürer."
        />
      ) : (
        <>
          {isReview ? (
            <div className="-mt-3 mb-5">
              <p className="mb-3 text-sm text-zinc-500">
                Önceki sınavlarındaki <span className="font-medium text-zinc-700 dark:text-zinc-300">{review.total_wrong} yanlış</span>{" "}
                ya da boş sorudan, aynı kavramları farklı açılardan soran yeni bir sınav hazırlanır. Sorular aynen tekrar edilmez.
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {review.topics.map((t) => (
                  <li
                    key={t.topic}
                    className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300"
                  >
                    {t.topic} <span className="tabular-nums opacity-70">· {t.wrong}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <p className="-mt-3 mb-4 text-sm text-zinc-500">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{courseTitle}</span> için hangi dosyalardan soru
                sorulacağını seç. {hasPastExam ? "Sorular seçili çıkmış sınavların tarzına benzetilecek." : ""}
              </p>
              <div className="mb-4">
                <SourcePicker materials={materials} selected={selected} onChange={setSelected} />
              </div>
            </>
          )}

          <Field label="Soru sayısı">
            <Segmented
              value={questionCount}
              onChange={setQuestionCount}
              options={QUESTION_COUNTS.map((n) => ({ value: n, label: String(n) }))}
            />
          </Field>
          <Field label="Zorluk">
            <Segmented
              value={difficulty}
              onChange={setDifficulty}
              options={(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))}
            />
          </Field>
          <Field label="Soru tipi">
            <Segmented
              value={questionType}
              onChange={setQuestionType}
              options={(Object.keys(QUESTION_TYPE_LABELS) as QuestionTypeSetting[]).map((t) => ({
                value: t,
                label: QUESTION_TYPE_LABELS[t],
              }))}
            />
          </Field>

          {error && <ErrorNote text={error} />}

          <ModalActions
            onCancel={close}
            onConfirm={start}
            disabled={!isReview && selected.size === 0}
            confirmIcon={isReview ? <RotateCcw className="size-4" /> : <Sparkles className="size-4" />}
            confirmLabel={error ? "Tekrar dene" : isReview ? "Tekrar Sınavını Başlat" : "Sınavı Başlat"}
          />
        </>
      )}
    </Modal>
  );
}
