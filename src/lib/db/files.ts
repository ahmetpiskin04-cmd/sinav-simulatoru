import "server-only";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { newId, PDF_DIR } from "@/lib/db";

// PDF'ler: <DATA_DIR>/pdfs/<ders id>/<rastgele id>.pdf  (veritabanında göreli yol tutulur)
const REL_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i;
const COURSE_ID = /^[0-9a-f-]{36}$/i;

function absolute(rel: string) {
  if (!REL_PATH.test(rel)) throw new Error(`Geçersiz dosya yolu: ${rel}`);
  return path.join(PDF_DIR, rel);
}

/** PDF'i kaydeder, göreli yolunu döndürür */
export function savePdf(courseId: string, bytes: ArrayBuffer | Uint8Array): string {
  if (!COURSE_ID.test(courseId)) throw new Error("Geçersiz ders kimliği");
  const rel = `${courseId}/${newId()}.pdf`;
  mkdirSync(path.join(PDF_DIR, courseId), { recursive: true });
  writeFileSync(absolute(rel), bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return rel;
}

export function readPdf(rel: string): Buffer {
  return readFileSync(absolute(rel));
}

/** Dosya yoksa sessizce geçer (kayıt silindiyse yetim dosya kalmasın diye çağrılır) */
export function deletePdf(rel: string | null | undefined) {
  if (!rel) return;
  try {
    rmSync(absolute(rel), { force: true });
  } catch (err) {
    console.warn("PDF silinemedi:", rel, err);
  }
}

export function deleteCourseFiles(courseId: string) {
  if (!COURSE_ID.test(courseId)) return;
  rmSync(path.join(PDF_DIR, courseId), { recursive: true, force: true });
}
