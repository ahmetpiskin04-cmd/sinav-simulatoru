-- Aşama 3: PDF görsel okuma bilgisi + kayıtlı çalışma rehberi
-- Supabase SQL Editor'de bir kez çalıştırın (tekrar çalıştırmak zararsızdır).

-- Metnin nasıl çıkarıldığı: 'text' (PDF'in kendi metni) ya da 'gemini_vision' (Gemini sayfaları okudu)
alter table public.materials add column if not exists extraction_method text;
alter table public.materials drop constraint if exists materials_extraction_method_check;
alter table public.materials add constraint materials_extraction_method_check
  check (extraction_method is null or extraction_method in ('text', 'gemini_vision'));

-- Zayıf konular için üretilen özet + flashcard'lar (yenilemede yeniden üretilmesin diye saklanır)
alter table public.exams add column if not exists study_guide jsonb;
