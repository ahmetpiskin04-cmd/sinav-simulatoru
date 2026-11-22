import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { isUuid } from "@/lib/api";
import { getCourse, listChat, listMaterials } from "@/lib/db/repo";

export const metadata: Metadata = { title: "Derse Soru Sor · Sınav Simülatörü" };

// cacheComponents açık: params çalışma anında bilinir, bu yüzden Suspense içinde okunur
export default function ChatPage({ params }: PageProps<"/chat/[courseId]">) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center">
          <LoaderCircle className="size-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <ChatLoader params={params} />
    </Suspense>
  );
}

async function ChatLoader({ params }: { params: PageProps<"/chat/[courseId]">["params"] }) {
  const { courseId } = await params;
  if (!isUuid(courseId)) notFound();
  const course = getCourse(courseId);
  if (!course) notFound();
  const sourceNames = listMaterials(courseId, "old")
    .filter((m) => (m.extracted_text ?? "").trim().length >= 50)
    .map((m) => m.file_name);
  return <ChatScreen course={course} initial={listChat(courseId)} sourceNames={sourceNames} />;
}
