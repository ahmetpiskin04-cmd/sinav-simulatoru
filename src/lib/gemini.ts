import "server-only";
import { GoogleGenerativeAI, type ModelParams, type Part, type ResponseSchema } from "@google/generative-ai";
import { prepareModelJson } from "@/lib/latex";

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("Gemini API anahtarı yok. .env.local dosyasına GEMINI_API_KEY ekleyip sunucuyu yeniden başlatın.");
    this.name = "GeminiNotConfiguredError";
  }
}

/** Kullanıcıya gösterilebilecek, anlamlı yapay zekâ hatası */
export class GeminiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

// ---------------------------------------------------------------------------
// Model zincirleri
// İlk model denenir; kullanılamaz / aşırı yoğun / kota dolu ise sıradakine geçilir.
// "nvidia:" önekli adlar NVIDIA'nın ücretsiz API'sine (build.nvidia.com) gider.
// .env.local'de virgülle ayrılmış liste vererek değiştirilebilir.
//
// Ücretsiz katman gerçekleri (21 Kasım 2026'da ölçüldü):
// - gemini-3.5-flash: günde 20 istek. 3.8-flash / 3.7-flash'ın kotası ayrı; çalışıyorlar ama sık sık "aşırı yoğun".
// - gemini-4-hydrogen: erişim var, ölçüm boyunca hep "aşırı yoğun". Pro ve gemini-4 diğerleri: kota 0.
// - Lite modeller: kota bol ama soru yazarken daha çok hata ve tekrar (13 sorudan 2 hata).
// - NVIDIA nemotron-3-ultra: yalnızca "düşünme" açıkken doğru, yavaş (80-120 sn); kalite lite düzeyinde. Mistral/super-vl matematik
//   sembollerini içerik filtresine takıyor (422), kullanılamaz.
// ---------------------------------------------------------------------------
const STRONG_GEMINI = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-4-hydrogen"];
const LITE_GEMINI = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
export const NVIDIA_PREFIX = "nvidia:";
const NVIDIA_STRONG = `${NVIDIA_PREFIX}nvidia/nemotron-3-ultra-550b-a55b`;

const DEFAULT_EXAM_MODELS = [...STRONG_GEMINI, ...LITE_GEMINI];
const DEFAULT_GRADING_MODELS = [...LITE_GEMINI, ...STRONG_GEMINI];
// PDF görsel okuma: yalnızca Gemini (NVIDIA tarafında PDF girdisi yok)
const DEFAULT_VISION_MODELS = [...STRONG_GEMINI, ...LITE_GEMINI];
// Cevap anahtarı doğrulaması. Tek başına "lite" çözücü tuzaklı ama doğru soruları yanlış çözüp
// eliyordu (ölçüldü); bu yüzden uyuşmazlıklar hakeme gider (verify.ts). Hakemli akışta 3.1-flash-lite
// hem kasıtlı testte hem gerçek bir sınavda yanlış anahtarı doğru yakaladı. Güçlü modellerin kıt
// kotası soru üretimine saklansın diye doğrulama önce lite modelle yapılır.
const DEFAULT_VERIFY_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", ...STRONG_GEMINI];

const modelList = (env: string | undefined, fallback: string[]) =>
  env?.split(",").map((m) => m.trim()).filter(Boolean) ?? fallback;

/** NVIDIA anahtarı varsa NVIDIA modelini, Gemini'nin güçlü modelleri ile lite'lar arasına ekler */
function withNvidia(chain: string[], position: "beforeLite" | "end") {
  if (!process.env.NVIDIA_API_KEY?.trim() || chain.some((m) => m.startsWith(NVIDIA_PREFIX))) return chain;
  if (position === "end") return [...chain, NVIDIA_STRONG];
  const i = chain.findIndex((m) => LITE_GEMINI.includes(m));
  return i < 0 ? [...chain, NVIDIA_STRONG] : [...chain.slice(0, i), NVIDIA_STRONG, ...chain.slice(i)];
}

export const examModels = () => withNvidia(modelList(process.env.GEMINI_MODEL, DEFAULT_EXAM_MODELS), nvidiaPosition());
export const gradingModels = () => withNvidia(modelList(process.env.GEMINI_GRADING_MODEL, DEFAULT_GRADING_MODELS), "end");
export const visionModels = () => modelList(process.env.GEMINI_VISION_MODEL, DEFAULT_VISION_MODELS);
export const verifyModels = () => withNvidia(modelList(process.env.GEMINI_VERIFY_MODEL, DEFAULT_VERIFY_MODELS), "end");
// Derse soru sor: çok mesaj atılabildiği için lite önce (güçlü modelin günlük kotası sınavlara kalsın).
// Materyalden cevap bulma ve açıklama, lite modellerin iyi yaptığı bir iş. NVIDIA yok (generateText).
const DEFAULT_CHAT_MODELS = [...LITE_GEMINI, ...STRONG_GEMINI];
export const chatModels = () => modelList(process.env.GEMINI_CHAT_MODEL, DEFAULT_CHAT_MODELS);

/**
 * NVIDIA varsayılan olarak zincirin EN SONUNDA: 15 soruluk ölçümde 1 yanlış anahtar + 1 hatalı +
 * 1 tartışmalı soru çıkardı (lite Gemini ile aynı düzey: 13'te 2) ama ~5 kat yavaş (80-120 sn).
 * Değeri, Gemini'nin tamamı kotada/yoğunken bile çalışabilmesi. NVIDIA_POSITION=beforeLite ile öne alınabilir.
 */
function nvidiaPosition(): "beforeLite" | "end" {
  return process.env.NVIDIA_POSITION === "beforeLite" ? "beforeLite" : "end";
}

let client: GoogleGenerativeAI | null = null;
export function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new GeminiNotConfiguredError();
  return key;
}
function getClient() {
  client ??= new GoogleGenerativeAI(getGeminiKey());
  return client;
}

interface BaseRequest {
  models: string[];
  systemInstruction: string;
  temperature?: number;
  timeoutMs?: number;
}

interface JsonRequest<T> extends BaseRequest {
  prompt: string;
  schema: ResponseSchema;
  /** Ayrıştırılan JSON'u doğrular/normalleştirir; geçersizse Error fırlatmalı (aynı model bir kez daha denenir) */
  parse: (raw: unknown) => T;
}

interface TextRequest<T> extends BaseRequest {
  /** Metin ve/veya dosya parçaları (ör. PDF için inlineData / fileData) */
  parts: Part[];
  maxOutputTokens?: number;
  /** Düz metin çıktısını doğrular; geçersizse Error fırlatmalı */
  parse: (text: string) => T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const statusOf = (err: unknown) => (err as { status?: number })?.status;
const isNvidia = (model: string) => model.startsWith(NVIDIA_PREFIX);

/** Yapılandırılmış JSON üretir (Gemini: responseSchema; NVIDIA: şema talimatı + doğrulama). */
export function generateJson<T>(req: JsonRequest<T>): Promise<{ data: T; model: string }> {
  return run({
    models: req.models,
    call: (model) =>
      isNvidia(model)
        ? nvidiaChat(
            model,
            `${req.systemInstruction}\n\nÇIKTI BİÇİMİ: Yalnızca aşağıdaki JSON şemasına uyan TEK bir JSON nesnesi döndür. Açıklama, kod bloğu ya da başka metin yazma. Matematik için LaTeX ve ters ayraç karakteri KULLANMA; Unicode semboller yaz (¬ ∧ ∨ → ∀ ∃ ∈ ⊆ ∪ ∩ ∅ ℝ ≤ ≥).\n${JSON.stringify(req.schema)}`,
            req.prompt,
            req.temperature ?? 0.7,
            Math.max(req.timeoutMs ?? 120_000, 240_000),
          ).then(extractJson)
        : geminiCall(
            {
              model,
              systemInstruction: req.systemInstruction,
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: req.schema,
                temperature: req.temperature ?? 0.7,
              },
            },
            req.prompt,
            req.timeoutMs,
          ),
    // LaTeX → Unicode + geçersiz kaçış onarımı (bkz. latex.ts); her iki sağlayıcıda da gerekli
    parse: (text) => req.parse(JSON.parse(prepareModelJson(text))),
  });
}

/** Düz metin üretir; PDF gibi dosyaları da girdi olarak alabilir (yalnızca Gemini). */
export function generateText<T>(req: TextRequest<T>): Promise<{ data: T; model: string }> {
  return run({
    models: req.models.filter((m) => !isNvidia(m)),
    call: (model) =>
      geminiCall(
        {
          model,
          systemInstruction: req.systemInstruction,
          generationConfig: { temperature: req.temperature ?? 0.2, maxOutputTokens: req.maxOutputTokens },
        },
        req.parts,
        req.timeoutMs,
      ),
    parse: req.parse,
  });
}

async function geminiCall(params: ModelParams, contents: string | Part[], timeoutMs?: number): Promise<string> {
  const model = getClient().getGenerativeModel(params, { timeout: timeoutMs ?? 120_000 });
  const result = await model.generateContent(contents);
  return result.response.text();
}

/**
 * NVIDIA (OpenAI uyumlu) sohbet çağrısı. Nemotron Ultra'da "düşünme" açık bırakılır:
 * kapalıyken tuzaklı bir küme sorusunu yanlış cevapladı, açıkken doğru (ölçüldü).
 */
async function nvidiaChat(model: string, system: string, user: string, temperature: number, timeoutMs: number): Promise<string> {
  const key = process.env.NVIDIA_API_KEY?.trim();
  if (!key) throw Object.assign(new Error("NVIDIA_API_KEY yok"), { status: 404 });
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model.slice(NVIDIA_PREFIX.length),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: 32_000,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw Object.assign(new Error(`NVIDIA HTTP ${res.status}: ${body}`), { status: res.status });
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw Object.assign(new Error("NVIDIA boş yanıt döndü"), { status: 502 });
  return text;
}

/**
 * Modelin metninden JSON nesnesini çıkarır (```json bloklarını ve öncesindeki/sonrasındaki metni atar).
 * LaTeX ve geçersiz kaçış onarımı ayrıştırmadan hemen önce prepareModelJson ile yapılır.
 */
function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

/**
 * Model zinciri + yeniden deneme:
 * - 404 (model yok) / 429 (kota) / zaman aşımı → sıradaki model
 * - 500/503 (aşırı yük) → zincirin İLK modeliyse kısa beklemeyle bir kez daha; yedeklerde hemen sıradaki
 *   (yedek modeller sık sık yoğun; her birini beklemek süreyi gereksiz uzatıyordu)
 * - Geçersiz çıktı (parse hatası) → aynı modeli bir kez daha
 * - Gemini 400/401/403 (anahtar/istek hatası) → hemen hata; NVIDIA'nın her hatası → sıradaki model
 */
async function run<T>(opts: {
  models: string[];
  call: (model: string) => Promise<string>;
  parse: (text: string) => T;
}): Promise<{ data: T; model: string }> {
  getGeminiKey(); // anahtar hiç yoksa anlamlı hata
  let lastError: unknown;

  for (const [index, modelName] of opts.models.entries()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let text: string;
      try {
        text = await opts.call(modelName);
      } catch (err) {
        lastError = err;
        const status = statusOf(err);
        console.warn(`[yz] ${modelName} deneme ${attempt}: HTTP ${status ?? "-"}`, errMessage(err));
        if (isNvidia(modelName)) break;
        if (status === 400 || status === 401 || status === 403) {
          throw new GeminiError(friendlyMessage(err), status);
        }
        if (!status || status === 404 || status === 429) break;
        if (index > 0) break; // yoğun yedek modeli bekleme
        if (attempt < 2) await sleep(2_000);
        continue;
      }

      try {
        return { data: opts.parse(text), model: modelName };
      } catch (err) {
        lastError = new InvalidOutputError(errMessage(err));
        console.warn(`[yz] ${modelName} deneme ${attempt}: geçersiz çıktı:`, errMessage(err));
      }
    }
  }
  throw new GeminiError(friendlyMessage(lastError), statusOf(lastError));
}

function errMessage(err: unknown) {
  return err instanceof Error ? err.message.slice(0, 300) : String(err);
}

class InvalidOutputError extends Error {}

function friendlyMessage(err: unknown): string {
  if (err instanceof InvalidOutputError) return "Yapay zekâ geçerli bir çıktı üretemedi. Tekrar deneyin.";
  const status = statusOf(err);
  const msg = errMessage(err);
  if (status === 400 && /API key/i.test(msg)) return "Gemini API anahtarı geçersiz. .env.local'deki GEMINI_API_KEY değerini kontrol edin.";
  if (status === 401 || status === 403) return "Gemini API anahtarı reddedildi (yetki yok).";
  if (status === 429) return "Yapay zekâ modellerinin günlük ücretsiz kotası doldu. Kota Türkiye saatiyle sabah 11 civarı sıfırlanır.";
  if (status === 503 || status === 500 || status === 502) return "Yapay zekâ modelleri şu an aşırı yoğun. Biraz sonra tekrar deneyin.";
  if (status === 404) return "Ayarlı yapay zekâ modellerinin hiçbiri kullanılamıyor. GEMINI_MODEL ayarını güncelleyin.";
  if (!status) return "Yapay zekâya ulaşılamadı ya da yanıt çok uzun sürdü. Tekrar deneyin.";
  return `Yapay zekâ hatası (${status}).`;
}
