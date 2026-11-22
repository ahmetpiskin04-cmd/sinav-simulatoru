import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function ExamNotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <FileQuestion className="mx-auto mb-3 size-8 text-zinc-400" />
        <h1 className="text-lg font-semibold">Sınav bulunamadı</h1>
        <p className="mt-1.5 text-sm text-zinc-500">Bu sınav silinmiş ya da bağlantı hatalı olabilir.</p>
        <Link href="/" className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Panele dön
        </Link>
      </div>
    </div>
  );
}
