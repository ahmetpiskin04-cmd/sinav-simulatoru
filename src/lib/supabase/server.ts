import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const MATERIALS_BUCKET = "materials";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase bağlantısı yapılandırılmamış. .env.local dosyasına NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ekleyin.",
    );
    this.name = "SupabaseNotConfiguredError";
  }
}

let cached: SupabaseClient | null = null;

/**
 * Yalnızca sunucuda (API rotalarında) kullanılan Supabase istemcisi.
 * service_role anahtarı RLS'yi atlar; bu yüzden bu dosya "server-only"
 * ile korunur ve istemci bileşenlerine asla import edilemez.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new SupabaseNotConfiguredError();

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
