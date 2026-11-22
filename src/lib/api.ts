import "server-only";
import { SupabaseNotConfiguredError } from "@/lib/supabase/server";
import { GeminiError, GeminiNotConfiguredError } from "@/lib/gemini";
import type { ApiError } from "@/lib/types";

export function jsonError(status: number, error: string, code?: ApiError["code"]) {
  return Response.json({ error, code } satisfies ApiError, { status });
}

/** Rota içinde fırlatılan hatayı kullanıcıya anlamlı bir JSON yanıta çevirir. */
export function handleRouteError(err: unknown) {
  if (err instanceof SupabaseNotConfiguredError) {
    return jsonError(503, err.message, "SUPABASE_NOT_CONFIGURED");
  }
  if (err instanceof GeminiNotConfiguredError) {
    return jsonError(503, err.message, "GEMINI_NOT_CONFIGURED");
  }
  if (err instanceof GeminiError) {
    return jsonError(err.status === 429 ? 429 : 502, err.message, "AI_ERROR");
  }

  // Supabase/PostgREST hataları { code, message } biçiminde gelir
  const pg = err as { code?: string; message?: string };
  // 42703/PGRST204: sütun yok, 42P01/PGRST205: tablo yok → bir migration çalıştırılmamış
  if (pg?.code === "42703" || pg?.code === "PGRST204" || pg?.code === "42P01" || pg?.code === "PGRST205") {
    console.error(err);
    return jsonError(
      500,
      "Veritabanı şeması güncel değil. supabase/migrations klasöründeki henüz çalıştırılmamış SQL dosyalarını Supabase SQL Editor'de çalıştırın.",
      "SCHEMA_OUTDATED",
    );
  }

  console.error(err);
  const message = typeof pg?.message === "string" && pg.message ? pg.message : "Beklenmeyen bir hata oluştu.";
  return jsonError(500, message, "SERVER_ERROR");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_RE.test(v);
