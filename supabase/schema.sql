-- =====================================================================
-- Sınav Simülatörü — Aşama 1 veritabanı şeması
-- Supabase Dashboard > SQL Editor'e yapıştırıp "Run" deyin.
-- Tekrar çalıştırılabilir (idempotent): var olan nesneleri bozmaz.
-- =====================================================================

-- gen_random_uuid() için (Supabase'de genelde zaten açıktır)
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) DERSLER
-- ---------------------------------------------------------------------
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  -- Giriş sistemi Aşama 1'de yok; o yüzden şimdilik boş bırakılabilir.
  -- Supabase Auth eklendiğinde her ders, sahibinin auth.users kaydına bağlanır.
  user_id     uuid references auth.users (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 120),
  created_at  timestamptz not null default now()
);

create index if not exists courses_user_id_idx on public.courses (user_id);

-- ---------------------------------------------------------------------
-- 2) MATERYALLER (slaytlar ve çıkmış sorular)
-- ---------------------------------------------------------------------
create table if not exists public.materials (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses (id) on delete cascade,
  file_name       text not null,
  file_type       text not null check (file_type in ('slide', 'past_exam')),
  extracted_text  text,
  -- Ek alanlar: PDF'in Storage'daki yeri ve sayfa sayısı
  storage_path    text,
  page_count      integer check (page_count is null or page_count >= 0),
  created_at      timestamptz not null default now()
);

create index if not exists materials_course_id_idx on public.materials (course_id);

-- ---------------------------------------------------------------------
-- 3) SINAVLAR
-- ---------------------------------------------------------------------
create table if not exists public.exams (
  id                 uuid primary key default gen_random_uuid(),
  course_id          uuid not null references public.courses (id) on delete cascade,
  title              text,                        -- Gemini'nin verdiği sınav başlığı
  settings           jsonb,                       -- { questionCount, difficulty, questionType, model }
  questions_json     jsonb not null default '[]'::jsonb,
  user_answers_json  jsonb,                       -- puanlanmış cevaplar; sınav bitene kadar boş
  score              numeric(5, 2) check (score is null or (score >= 0 and score <= 100)),
  feedback_summary   text,
  submitted_at       timestamptz,
  created_at         timestamptz not null default now()
);

-- Aşama 1'de oluşturulmuş tablolar için (migrations/002_exam_fields.sql ile aynı)
alter table public.exams add column if not exists title        text;
alter table public.exams add column if not exists settings     jsonb;
alter table public.exams add column if not exists submitted_at timestamptz;

-- Aşama 3 (migrations/003_vision_and_study_guide.sql ile aynı)
alter table public.materials add column if not exists extraction_method text;
alter table public.materials drop constraint if exists materials_extraction_method_check;
alter table public.materials add constraint materials_extraction_method_check
  check (extraction_method is null or extraction_method in ('text', 'gemini_vision'));
alter table public.exams add column if not exists study_guide jsonb;

create index if not exists exams_course_id_idx on public.exams (course_id);

-- ---------------------------------------------------------------------
-- 4) SATIR DÜZEYİ GÜVENLİK (RLS)
-- Uygulama Aşama 1'de veritabanına yalnızca sunucudan, service_role
-- anahtarıyla erişir; o anahtar RLS'yi atlar. Bu politikalar, ileride
-- tarayıcıdan giriş yapmış kullanıcıyla erişildiğinde herkesin yalnızca
-- kendi verisini görmesini sağlar. Şimdiden açık olması, anon anahtarla
-- kimsenin tabloları okuyamaması demektir.
-- ---------------------------------------------------------------------
alter table public.courses   enable row level security;
alter table public.materials enable row level security;
alter table public.exams     enable row level security;

drop policy if exists "courses: sahibi her şeyi yapar" on public.courses;
create policy "courses: sahibi her şeyi yapar"
  on public.courses for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "materials: ders sahibi her şeyi yapar" on public.materials;
create policy "materials: ders sahibi her şeyi yapar"
  on public.materials for all
  to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));

drop policy if exists "exams: ders sahibi her şeyi yapar" on public.exams;
create policy "exams: ders sahibi her şeyi yapar"
  on public.exams for all
  to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- 4b) API ERİŞİM İZİNLERİ
-- Yeni Supabase projeleri public şemadaki tablolara Data API izni
-- otomatik vermiyor ("permission denied for table ..." hatası).
-- service_role: sunucumuz. authenticated: ileride giriş yapan kullanıcı
-- (RLS politikaları yine geçerli). anon (girişsiz) hiçbir izin almaz.
-- ---------------------------------------------------------------------
grant usage on schema public to service_role, authenticated;
grant select, insert, update, delete on public.courses, public.materials, public.exams
  to service_role, authenticated;

-- ---------------------------------------------------------------------
-- 4c) ÇALIŞMA SETLERİ (migrations/004_study_sets.sql ile aynı)
-- ---------------------------------------------------------------------
create table if not exists public.study_sets (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  title         text not null,
  source_names  text[] not null default '{}',              -- üretimde kullanılan PDF adları (bilgi amaçlı)
  content       jsonb not null,                            -- { topics: [...], flashcards: [...] }
  card_status   jsonb not null default '{}'::jsonb,        -- { "<kart sırası>": "known" | "unknown" }
  model         text,
  created_at    timestamptz not null default now()
);

create index if not exists study_sets_course_id_idx on public.study_sets (course_id);

alter table public.study_sets enable row level security;

drop policy if exists "study_sets: ders sahibi her şeyi yapar" on public.study_sets;
create policy "study_sets: ders sahibi her şeyi yapar"
  on public.study_sets for all
  to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));

grant select, insert, update, delete on public.study_sets to service_role, authenticated;

-- ---------------------------------------------------------------------
-- 5) STORAGE: PDF'lerin saklanacağı özel (public olmayan) kova
-- Dosya yolu düzeni: <course_id>/<rastgele-uuid>.pdf
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 26214400, array['application/pdf'])  -- 25 MB
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
