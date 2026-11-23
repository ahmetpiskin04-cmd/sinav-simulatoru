import "server-only";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { scheduleBackups } from "@/lib/db/backup";

/**
 * Yerel veri deposu: tek bir SQLite dosyası + PDF klasörü.
 * Varsayılan konum OneDrive DIŞINDA (~/.sinav-simulatoru): OneDrive senkronizasyonu açık bir
 * veritabanı dosyasını kilitleyip bozabilir. DATA_DIR ile değiştirilebilir.
 */
export const DATA_DIR = process.env.DATA_DIR?.trim() || path.join(os.homedir(), ".sinav-simulatoru");
export const DB_PATH = path.join(DATA_DIR, "data.db");
export const PDF_DIR = path.join(DATA_DIR, "pdfs");

/** Sırayla uygulanan şema adımları; PRAGMA user_version hangisinde kaldığımızı tutar. */
const MIGRATIONS: string[] = [
  // 1: ilk şema (Kasım 2026'da Supabase'den taşındı) + süreli sınav, hatalı soru, sohbet alanları
  `
  create table courses (
    id          text primary key,
    title       text not null check (length(trim(title)) between 1 and 120),
    created_at  text not null
  );

  create table materials (
    id                 text primary key,
    course_id          text not null references courses (id) on delete cascade,
    file_name          text not null,
    file_type          text not null check (file_type in ('slide', 'past_exam')),
    extracted_text     text,
    storage_path       text,
    page_count         integer,
    extraction_method  text check (extraction_method is null or extraction_method in ('text', 'gemini_vision')),
    created_at         text not null
  );
  create index materials_course_idx on materials (course_id);

  create table exams (
    id                 text primary key,
    course_id          text not null references courses (id) on delete cascade,
    title              text,
    settings           text,                          -- JSON: ExamSettings
    questions_json     text not null default '[]',    -- JSON: ExamQuestion[]
    user_answers_json  text,                          -- JSON: GradedAnswer[]
    score              real,
    feedback_summary   text,
    submitted_at       text,
    study_guide        text,                          -- JSON: StudyGuide
    started_at         text,                          -- süreli sınav: ilk açılış
    timing_json        text,                          -- JSON: soru başına süre (ms)
    flagged_json       text,                          -- JSON: "hatalı" işaretlenen soru id'leri
    created_at         text not null
  );
  create index exams_course_idx on exams (course_id);

  create table study_sets (
    id            text primary key,
    course_id     text not null references courses (id) on delete cascade,
    title         text not null,
    source_names  text not null default '[]',       -- JSON: string[]
    content       text not null,                    -- JSON: { topics, flashcards }
    card_status   text not null default '{}',       -- JSON: { "<kart sırası>": "known" | "unknown" }
    model         text,
    created_at    text not null
  );
  create index study_sets_course_idx on study_sets (course_id);

  create table chat_messages (
    id          text primary key,
    course_id   text not null references courses (id) on delete cascade,
    role        text not null check (role in ('user', 'assistant')),
    content     text not null,
    model       text,
    created_at  text not null
  );
  create index chat_messages_course_idx on chat_messages (course_id, created_at);
  `,
];

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(PDF_DIR, { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec("pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 5000;");
  migrate(conn);
  db = conn;
  scheduleBackups(conn);
  return conn;
}

function migrate(conn: DatabaseSync) {
  const { user_version: current } = conn.prepare("pragma user_version").get() as { user_version: number };
  for (let v = current; v < MIGRATIONS.length; v++) {
    conn.exec("begin");
    try {
      conn.exec(MIGRATIONS[v]);
      conn.exec(`pragma user_version = ${v + 1}`);
      conn.exec("commit");
    } catch (err) {
      conn.exec("rollback");
      throw err;
    }
  }
}

/** Fonksiyonu tek bir işlem (transaction) içinde çalıştırır */
export function transaction<T>(fn: () => T): T {
  const conn = getDb();
  conn.exec("begin");
  try {
    const result = fn();
    conn.exec("commit");
    return result;
  } catch (err) {
    conn.exec("rollback");
    throw err;
  }
}

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
