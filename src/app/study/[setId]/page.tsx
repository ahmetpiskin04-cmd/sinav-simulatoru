import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { StudySetScreen } from "@/components/study/StudySetScreen";
import { isUuid } from "@/lib/api";
import { getStudySet } from "@/lib/study/view";

export const metadata: Metadata = { title: "Çalışma Seti · Sınav Simülatörü" };

// cacheComponents açık: params çalışma anında bilinir, bu yüzden Suspense içinde okunur
export default function StudySetPage({ params }: PageProps<"/study/[setId]">) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center">
          <LoaderCircle className="size-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <StudySetLoader params={params} />
    </Suspense>
  );
}

async function StudySetLoader({ params }: { params: PageProps<"/study/[setId]">["params"] }) {
  const { setId } = await params;
  if (!isUuid(setId)) notFound();

  let set;
  try {
    set = await getStudySet(setId);
  } catch (err) {
    console.error(err);
    const code = (err as { code?: string })?.code ?? "";
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-md text-center">
          <CircleAlert className="mx-auto mb-3 size-8 text-red-500" />
          <h1 className="text-lg font-semibold">Çalışma seti açılamadı</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            {/42P01|PGRST205|42703/.test(code)
              ? "Veritabanı şeması güncel değil. supabase/migrations/004_study_sets.sql dosyasını Supabase SQL Editor'de çalıştırın."
              : "Yüklenirken bir hata oluştu. Supabase bağlantısını kontrol edin."}
          </p>
          <Link href="/" className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Panele dön
          </Link>
        </div>
      </div>
    );
  }
  if (!set) notFound();
  return <StudySetScreen initial={set} />;
}
