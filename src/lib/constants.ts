// Hem sunucu hem tarayıcı tarafında kullanılan sabitler
export const MAX_PDF_MB = 25; // supabase/schema.sql'deki kova sınırıyla aynı tutun
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

export const MATERIAL_TYPE_LABELS = {
  slide: "Ders Slaytı",
  past_exam: "Çıkmış Soru",
} as const;

// ---- Görsel ağırlıklı PDF tespiti (Gemini Vision ile okunur) ----
/** Toplam metin bundan azsa PDF görsel ağırlıklı sayılır */
export const VISION_MIN_TOTAL_CHARS = 500;
/** ...ya da sayfa başına ortalama metin bundan azsa (ör. 27 sayfa / 501 karakter) */
export const VISION_MIN_CHARS_PER_PAGE = 100;
/** Bundan uzun belgeler otomatik okunmaz (süre ve kota için) */
export const VISION_MAX_PAGES = 40;

/** unpdf'in çıkardığı metin, PDF'in görsel ağırlıklı olduğunu gösteriyor mu? */
export function isVisualPdf(textLength: number, pageCount: number | null): boolean {
  if (!pageCount || pageCount > VISION_MAX_PAGES) return false;
  return textLength < VISION_MIN_TOTAL_CHARS || textLength / pageCount < VISION_MIN_CHARS_PER_PAGE;
}
