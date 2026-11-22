import "server-only";
import { GeminiError, GeminiNotConfiguredError } from "@/lib/gemini";
import type { ApiError } from "@/lib/types";

export function jsonError(status: number, error: string, code?: ApiError["code"]) {
  return Response.json({ error, code } satisfies ApiError, { status });
}

/** Rota içinde fırlatılan hatayı kullanıcıya anlamlı bir JSON yanıta çevirir. */
export function handleRouteError(err: unknown) {
  if (err instanceof GeminiNotConfiguredError) {
    return jsonError(503, err.message, "GEMINI_NOT_CONFIGURED");
  }
  if (err instanceof GeminiError) {
    return jsonError(err.status === 429 ? 429 : 502, err.message, "AI_ERROR");
  }
  console.error(err);
  const message = err instanceof Error && err.message ? err.message : "Beklenmeyen bir hata oluştu.";
  return jsonError(500, message, "SERVER_ERROR");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_RE.test(v);
