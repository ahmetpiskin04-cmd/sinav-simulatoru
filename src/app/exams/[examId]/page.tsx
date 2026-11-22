import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { ExamScreen } from "@/components/exam/ExamScreen";
import { isUuid } from "@/lib/api";
import { getExamRow, toExamView } from "@/lib/exam/view";

export const metadata: Metadata = { title: "Sınav · Sınav Simülatörü" };

// cacheComponents açık: params çalışma anında bilinir, bu yüzden Suspense içinde okunur
export default function ExamPage({ params }: PageProps<"/exams/[examId]">) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center">
          <LoaderCircle className="size-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <ExamLoader params={params} />
    </Suspense>
  );
}

async function ExamLoader({ params }: { params: PageProps<"/exams/[examId]">["params"] }) {
  const { examId } = await params;
  if (!isUuid(examId)) notFound();

  let row;
  try {
    row = await getExamRow(examId);
  } catch (err) {
    console.error(err);
    const msg = (err as { message?: string })?.message ?? "";
    return (
      <ErrorState
        text={
          /column|42703/.test(msg)
            ? "Veritabanı şeması güncel değil. supabase/migrations/002_exam_fields.sql dosyasını Supabase SQL Editor'de çalıştırın."
            : "Sınav yüklenirken bir hata oluştu. Supabase bağlantısını kontrol edin."
        }
      />
    );
  }
  if (!row) notFound();

  return <ExamScreen initial={toExamView(row)} />;
}

function ErrorState({ text }: { text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <CircleAlert className="mx-auto mb-3 size-8 text-red-500" />
        <h1 className="text-lg font-semibold">Sınav açılamadı</h1>
        <p className="mt-1.5 text-sm text-zinc-500">{text}</p>
        <Link href="/" className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Panele dön
        </Link>
      </div>
    </div>
  );
}
