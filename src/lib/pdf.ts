import "server-only";
import { extractText } from "unpdf";

export interface ExtractedPdf {
  text: string;
  pageCount: number;
}

/**
 * PDF'ten düz metin çıkarır. Taranmış (resim) PDF'lerde metin boş gelir;
 * bu durumda çağıran taraf kullanıcıyı uyarmalıdır (OCR Aşama 1'de yok).
 */
export async function extractPdfText(data: ArrayBuffer): Promise<ExtractedPdf> {
  const { totalPages, text } = await extractText(new Uint8Array(data), { mergePages: false });
  const pages = text.map((page, i) => `--- Sayfa ${i + 1} ---\n${clean(page)}`);
  return { text: pages.join("\n\n").trim(), pageCount: totalPages };
}

function clean(s: string) {
  return (
    s
      // PostgreSQL text alanı NUL karakterini kabul etmez
      .replace(/\u0000/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
