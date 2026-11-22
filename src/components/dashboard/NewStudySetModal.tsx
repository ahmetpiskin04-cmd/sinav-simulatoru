"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ErrorNote, Field, GeneratingState, ModalActions, Segmented } from "@/components/ui/FormBits";
import { SourcePicker, usableMaterials } from "@/components/dashboard/SourcePicker";
import { api } from "@/lib/client-api";
import { STUDY_CARD_COUNTS } from "@/lib/study/types";
import type { MaterialSummary } from "@/lib/types";

interface Props {
  courseId: string;
  courseTitle: string;
  materials: MaterialSummary[];
  onClose: () => void;
}

/** Sınavsız çalışma: seçilen dosyalardan konu özetleri + flashcard destesi */
export function NewStudySetModal({ courseId, courseTitle, materials, onClose }: Props) {
  const router = useRouter();
  const usable = usableMaterials(materials);
  // Varsayılan: yalnızca slaytlar (özetin asıl kaynağı); çıkmış sorular istenirse eklenir
  const [selected, setSelected] = useState<Set<string>>(() => {
    const slides = usable.filter((m) => m.file_type === "slide");
    return new Set((slides.length ? slides : usable).map((m) => m.id));
  });
  const [cardCount, setCardCount] = useState<number>(20);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = startedAt !== null;

  async function start() {
    setStartedAt(Date.now());
    setError(null);
    try {
      const allSelected = selected.size === usable.length;
      const { setId } = await api.createStudySet(courseId, {
        cardCount,
        materialIds: allSelected ? undefined : [...selected],
      });
      startTransition(() => {
        router.push(`/study/${setId}`);
        onClose();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Çalışma seti oluşturulamadı.");
      setStartedAt(null);
    }
  }

  function close() {
    if (!busy) onClose();
  }

  return (
    <Modal open title="Özet & Kartlar" onClose={close} locked={busy}>
      {busy ? (
        <GeneratingState
          startedAt={startedAt}
          title={`Konu özetleri ve ${cardCount} kart hazırlanıyor…`}
          hint="Yapay zekâ seçtiğin dosyaları konu konu özetliyor. Bu genellikle 30-90 saniye sürer."
        />
      ) : (
        <>
          <p className="-mt-3 mb-4 text-sm text-zinc-500">
            Sınava girmeden çalış: <span className="font-medium text-zinc-700 dark:text-zinc-300">{courseTitle}</span> için
            seçtiğin dosyalardan konu konu hap özetler, sık yapılan hatalar ve &quot;bildim / bilemedim&quot; diye
            çalışabileceğin bir kart destesi hazırlanır.
          </p>
          <div className="mb-4">
            <SourcePicker materials={materials} selected={selected} onChange={setSelected} />
          </div>
          <Field label="Kart sayısı">
            <Segmented
              value={cardCount}
              onChange={setCardCount}
              options={STUDY_CARD_COUNTS.map((n) => ({ value: n, label: String(n) }))}
            />
          </Field>

          {error && <ErrorNote text={error} />}

          <ModalActions
            onCancel={close}
            onConfirm={start}
            disabled={selected.size === 0}
            confirmIcon={<Layers className="size-4" />}
            confirmLabel={error ? "Tekrar dene" : "Özet & Kartları Üret"}
          />
        </>
      )}
    </Modal>
  );
}
