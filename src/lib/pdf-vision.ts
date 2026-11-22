import "server-only";
import type { Part } from "@google/generative-ai";
import { FileState, GoogleAIFileManager } from "@google/generative-ai/server";
import { generateText, getGeminiKey, visionModels } from "@/lib/gemini";

/**
 * Gemini isteği en fazla ~20 MB olabilir; base64 4/3 büyüttüğü için
 * 14 MB'a kadar PDF'ler doğrudan (inlineData), daha büyükleri Files API ile gider.
 */
const INLINE_MAX_BYTES = 14 * 1024 * 1024;

const VISION_INSTRUCTION = `Sen ders slaytlarını ve taranmış ders belgelerini okuyup eksiksiz ders notuna çeviren bir asistansın.

GÖREV: Ekteki PDF'in HER sayfasını sırayla oku ve içeriğini ders notu olarak yaz. Bu not, daha sonra bu dersten sınav sorusu üretmek için tek kaynak olarak kullanılacak; bu yüzden hiçbir bilgiyi atlama.

KURALLAR:
- Her sayfaya "--- Sayfa N ---" satırıyla başla (N = 1, 2, 3...). Hiçbir sayfayı atlama; kapak ya da boş sayfa için tek satırlık not düş.
- Sayfadaki tüm metni (başlıklar, maddeler, tanımlar, teoremler, örnekler, çözümler) eksiksiz aktar. Özetleme, kısaltma.
- Formüller: LaTeX KULLANMA. Unicode ve düz metin kullan (ör. ¬p ∧ q, p → q, ∀x ∃y P(x, y), x², √n, Σ, ⊆, ∈, ≡, O(n log n)).
- Diyagramlar, şemalar, grafikler: kelimelerle eksiksiz açıkla (ör. durum diyagramı → durumlar ve geçiş tablosu; ağaç/graf → düğümler ve kenarlar; Venn şeması → kümeler ve kesişimler). Görselde olmayan bilgi uydurma.
- Tablolar (ör. doğruluk tabloları): düz metin olarak sütunları hizalayarak yaz.
- Kod ve sözde kod: üç ters tırnaklı (\`\`\`) bloklar içinde.
- El yazısı ya da bulanık kısımda okunamayan yeri [okunamadı] diye işaretle.
- Belgenin dilini koru; çeviri yapma.
- Yalnızca notu yaz; giriş ya da kapanış cümlesi ekleme.`;

export interface VisionResult {
  text: string;
  model: string;
}

/** PDF'i Gemini'ye okutup sayfa sayfa ders notu olarak metne çevirir. */
export async function readPdfWithGemini(bytes: ArrayBuffer, fileName: string, pageCount: number): Promise<VisionResult> {
  const prompt: Part = {
    text: `Dosya: ${fileName.replace(/[\r\n]/g, " ")} (${pageCount} sayfa). Tüm sayfaları ders notu olarak yaz.`,
  };

  const parse = (raw: string) => {
    const text = raw
      .replace(/^```[a-z]*\n([\s\S]*)\n```\s*$/i, "$1") // tamamını kod bloğuna sardıysa aç
      .replace(/\u0000/g, "")
      .trim();
    if (text.length < 100) throw new Error("Görsel okuma neredeyse boş döndü");
    return text;
  };

  const common = {
    models: visionModels(),
    systemInstruction: VISION_INSTRUCTION,
    temperature: 0.1,
    maxOutputTokens: 60_000, // düşünme payı dahil; uzun slayt destesi için geniş
    timeoutMs: 240_000,
    parse,
  };

  if (bytes.byteLength <= INLINE_MAX_BYTES) {
    const pdf: Part = { inlineData: { mimeType: "application/pdf", data: Buffer.from(bytes).toString("base64") } };
    return toResult(await generateText({ ...common, parts: [pdf, prompt] }));
  }

  // Büyük dosya: Files API'ye yükle, işlenmesini bekle, kullan, sonra sil
  const files = new GoogleAIFileManager(getGeminiKey());
  const upload = await files.uploadFile(Buffer.from(bytes), { mimeType: "application/pdf", displayName: fileName.slice(0, 100) });
  try {
    let file = upload.file;
    for (let i = 0; file.state === FileState.PROCESSING && i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2_000));
      file = await files.getFile(file.name);
    }
    if (file.state !== FileState.ACTIVE) throw new Error(`Gemini dosyayı işleyemedi (durum: ${file.state})`);
    const pdf: Part = { fileData: { mimeType: "application/pdf", fileUri: file.uri } };
    return toResult(await generateText({ ...common, parts: [pdf, prompt] }));
  } finally {
    await files.deleteFile(upload.file.name).catch(() => {}); // Google tarafı 48 saatte zaten siler
  }
}

const toResult = ({ data, model }: { data: string; model: string }): VisionResult => ({ text: data, model });
