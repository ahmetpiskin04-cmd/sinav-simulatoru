import "server-only";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "@/lib/db";

/**
 * Günlük veritabanı yedeği. PDF'ler yedeklenmez: asıl dosyalar kullanıcının ders klasöründe
 * duruyor ve metinleri veritabanında. `VACUUM INTO`, açık bir veritabanından bile tutarlı
 * (yarım yazılmamış) bir kopya üretir.
 *
 * Konum: BACKUP_DIR, yoksa ~/OneDrive/sinav-simulatoru-yedek (OneDrive buluta yükler; kopya tek
 * seferde yazılan bir dosya olduğu için senkronizasyon sorun çıkarmaz), OneDrive yoksa DATA_DIR/yedek.
 */
const KEEP = 7;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export function backupDir() {
  const env = process.env.BACKUP_DIR?.trim();
  if (env) return env;
  const oneDrive = path.join(os.homedir(), "OneDrive");
  return existsSync(oneDrive) ? path.join(oneDrive, "sinav-simulatoru-yedek") : path.join(DATA_DIR, "yedek");
}

const today = () => new Date().toISOString().slice(0, 10);

export function backupIfNeeded(db: DatabaseSync): string | null {
  try {
    const dir = backupDir();
    mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `data-${today()}.db`);
    if (existsSync(target)) return null;
    db.exec(`vacuum into '${target.replace(/'/g, "''")}'`);
    // Yalnızca bizim adlandırdığımız dosyalar; en yeni KEEP tanesi kalır
    const mine = readdirSync(dir).filter((f) => /^data-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
    for (const old of mine.slice(0, Math.max(0, mine.length - KEEP))) rmSync(path.join(dir, old), { force: true });
    console.info(`[yedek] ${target}`);
    return target;
  } catch (err) {
    console.warn("[yedek] alınamadı:", err);
    return null;
  }
}

/** Açılışta bir kez, sonra sunucu açık kaldıkça birkaç saatte bir kontrol eder (gün değiştiyse yeni yedek) */
export function scheduleBackups(db: DatabaseSync) {
  backupIfNeeded(db);
  setInterval(() => backupIfNeeded(db), CHECK_EVERY_MS).unref();
}
