// Önceki sınavlarla tekrar eden soruları yakalamak için basit metin benzerliği (saf fonksiyonlar).
//
// Kelime kümelerinin Jaccard benzerliği; rakamlar ve noktalama yok sayılır, böylece
// "aynı soru kalıbı, farklı sayılar" da yakalanır. Ayrık Matematik dersindeki 30+ soruyla
// ölçüldü: birbiriyle ilgisiz soru çiftlerinde medyan 0,08 ve %97'lik dilim 0,38;
// gerçek tekrarlar 0,50-0,89 arası (aynı ters fonksiyon sorusu 0,89).
export const DUPLICATE_THRESHOLD = 0.5;
/** Karşılaştırmada sorunun ilk bu kadar karakteri kullanılır (kalıp genelde başta) */
export const SIMILARITY_PREFIX = 300;

export type TokenSet = Set<string>;

export function tokens(text: string): TokenSet {
  return new Set(
    text
      .slice(0, SIMILARITY_PREFIX)
      .toLowerCase()
      .replace(/[0-9]+/g, " ")
      .replace(/[^\p{L}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

export function jaccard(a: TokenSet, b: TokenSet): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Metnin, önceki sorular içindeki en yüksek benzerliği (0-1) */
export function maxSimilarity(text: string, previous: TokenSet[]): number {
  const t = tokens(text);
  let best = 0;
  for (const p of previous) best = Math.max(best, jaccard(t, p));
  return best;
}

/**
 * Adaylardan `wanted` tanesini seçer: önce önceki sorulara benzemeyenler, yetmezse
 * en az benzeyen tekrarlar. Seçilenler orijinal sırasını korur.
 */
export function pickFresh<T extends { question_text: string }>(
  candidates: T[],
  previousTexts: string[],
  wanted: number,
): { picked: T[]; duplicatesSkipped: number; duplicatesKept: number } {
  const previous = previousTexts.map(tokens);
  const scored = candidates.map((q, idx) => ({ q, idx, sim: previous.length ? maxSimilarity(q.question_text, previous) : 0 }));
  const fresh = scored.filter((s) => s.sim < DUPLICATE_THRESHOLD);
  const dupes = scored.filter((s) => s.sim >= DUPLICATE_THRESHOLD).sort((a, b) => a.sim - b.sim);
  const chosen = [...fresh, ...dupes].slice(0, wanted).sort((a, b) => a.idx - b.idx);
  const duplicatesKept = chosen.filter((s) => s.sim >= DUPLICATE_THRESHOLD).length;
  return { picked: chosen.map((s) => s.q), duplicatesSkipped: dupes.length - duplicatesKept, duplicatesKept };
}
