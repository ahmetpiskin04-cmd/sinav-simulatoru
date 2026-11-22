-- Aşama 2: sınavlara başlık, ayar ve bitiş zamanı alanları
-- Supabase SQL Editor'de bir kez çalıştırın (tekrar çalıştırmak zararsızdır).
alter table public.exams add column if not exists title        text;
alter table public.exams add column if not exists settings     jsonb;  -- { questionCount, difficulty, questionType, model }
alter table public.exams add column if not exists submitted_at timestamptz;
