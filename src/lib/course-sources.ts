import "server-only";
import { listMaterials } from "@/lib/db/repo";
import { isUuid } from "@/lib/api";
import type { SourceMaterial } from "@/lib/exam/generate";

/** PDF'ten neredeyse hiç metin çıkmadıysa (taranmış ve okunmamış belge) kaynak sayılmaz */
export const MIN_USEFUL_TEXT = 50;

export interface LoadedSources {
  sources: (SourceMaterial & { id: string })[];
  /** Dersin hiç materyali var mı (hata mesajını seçmek için) */
  courseHasMaterials: boolean;
}

/**
 * Dersin metni okunabilir materyallerini yükler. `materialIds` verilirse yalnızca
 * onlar (bu derse ait olmayan ya da metinsiz olanlar sessizce elenir).
 */
export async function loadCourseSources(courseId: string, materialIds?: string[]): Promise<LoadedSources> {
  const data = listMaterials(courseId, "old");

  const wanted = materialIds?.length ? new Set(materialIds) : null;
  const sources = data
    .filter((m) => (!wanted || wanted.has(m.id)) && (m.extracted_text ?? "").trim().length >= MIN_USEFUL_TEXT)
    .map((m) => ({ id: m.id, file_name: m.file_name, file_type: m.file_type, text: m.extracted_text!.trim() }));
  return { sources, courseHasMaterials: data.length > 0 };
}

/** İstek gövdesindeki materialIds alanını doğrular: yok → undefined (tümü), geçersiz → hata metni */
export function parseMaterialIds(raw: unknown): string[] | undefined | string {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || !raw.every((x) => typeof x === "string" && isUuid(x))) {
    return "materialIds bir materyal kimliği listesi olmalı.";
  }
  if (raw.length === 0) return "En az bir kaynak dosya seçmelisin.";
  return [...new Set(raw as string[])];
}

export function noSourcesMessage(courseHasMaterials: boolean, filtered: boolean) {
  if (filtered) return "Seçtiğin dosyalardan okunabilir metin çıkmadı. Başka dosyalar seç ya da önce \"Yapay zekâ ile oku\" ile okut.";
  return courseHasMaterials
    ? "Bu dersin PDF'lerinden okunabilir metin çıkmadı (taranmış belge olabilir). Önce \"Yapay zekâ ile oku\" ile okut ya da metin içeren bir PDF yükle."
    : "Bu derse henüz materyal yüklenmemiş. Önce en az bir slayt ya da çıkmış soru PDF'i yükleyin.";
}
