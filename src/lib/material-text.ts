import "server-only";
import { extractPdfText } from "@/lib/pdf";
import { readPdfWithGemini } from "@/lib/pdf-vision";
import { isVisualPdf, VISION_MAX_PAGES } from "@/lib/constants";
import type { ExtractionMethod } from "@/lib/types";

export interface MaterialText {
  text: string;
  pageCount: number;
  method: ExtractionMethod;
  /** Bilgi notu (ör. "yapay zekâ ile okundu") */
  notice?: string;
  /** Kullanıcının bilmesi gereken sorun (ör. görsel okuma başarısız) */
  warning?: string;
}

/**
 * PDF'in metnini çıkarır. Önce PDF'in kendi metni (unpdf) okunur; belge görsel
 * ağırlıklıysa (taranmış/el yazısı/diyagram slayt) sayfalar Gemini'ye okutulur.
 * Görsel okuma başarısız olursa yükleme yine tamamlanır, yalnızca uyarı döner.
 *
 * @throws PDF hiç açılamazsa (bozuk/şifreli) — çağıran 400'e çevirmeli
 */
export async function extractMaterialText(bytes: ArrayBuffer, fileName: string): Promise<MaterialText> {
  // pdf.js tamponu devralabildiği için kopyasını veriyoruz
  const plain = await extractPdfText(bytes.slice(0));
  const base: MaterialText = { text: plain.text, pageCount: plain.pageCount, method: "text" };

  if (isVisualPdf(plain.text.length, plain.pageCount)) {
    const vision = await tryVision(bytes, fileName, plain.pageCount, plain.text.length);
    return vision.ok ? { ...base, ...vision.result } : { ...base, warning: vision.warning };
  }
  if (plain.text.length < 50) {
    return {
      ...base,
      warning: `PDF'ten neredeyse hiç metin çıkmadı ve belge ${VISION_MAX_PAGES} sayfadan uzun olduğu için yapay zekâ ile okunmadı. Daha kısa parçalara bölüp yükleyebilirsin.`,
    };
  }
  return base;
}

type VisionAttempt =
  | { ok: true; result: Pick<MaterialText, "text" | "method" | "notice"> }
  | { ok: false; warning: string };

/** Görsel okuma dener; PDF'in kendi metninden daha zengin sonuç çıkmazsa başarısız sayar. */
export async function tryVision(
  bytes: ArrayBuffer,
  fileName: string,
  pageCount: number,
  currentLength: number,
): Promise<VisionAttempt> {
  try {
    const t0 = Date.now();
    const { text, model } = await readPdfWithGemini(bytes, fileName, pageCount);
    console.info(`[vision] ${fileName}: ${pageCount} sayfa, ${currentLength} → ${text.length} karakter, ${model}, ${Date.now() - t0} ms`);
    if (text.length <= currentLength) {
      return { ok: false, warning: "Yapay zekâ bu PDF'ten mevcut metinden fazlasını çıkaramadı." };
    }
    return {
      ok: true,
      result: { text, method: "gemini_vision", notice: `Görsel ağırlıklı PDF: ${pageCount} sayfa yapay zekâ ile okundu.` },
    };
  } catch (err) {
    console.warn(`[vision] ${fileName} okunamadı:`, err);
    const reason = err instanceof Error ? err.message : "bilinmeyen hata";
    return {
      ok: false,
      warning: `Görsel ağırlıklı PDF yapay zekâ ile okunamadı (${reason}). Listeden "Yapay zekâ ile oku" ile tekrar deneyebilirsin.`,
    };
  }
}
