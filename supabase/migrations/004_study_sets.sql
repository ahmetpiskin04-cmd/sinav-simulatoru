-- Sınavdan bağımsız çalışma setleri: konu özetleri + flashcard destesi
-- Supabase SQL Editor'de bir kez çalıştırın (tekrar çalıştırmak zararsızdır).
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
