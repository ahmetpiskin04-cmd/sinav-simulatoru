"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, CircleAlert, LoaderCircle, Send, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { RichText } from "@/components/exam/RichText";
import type { ChatMessage } from "@/lib/db/repo";
import type { Course } from "@/lib/types";

const SUGGESTIONS = [
  "Bu dersin ana konularını kısaca özetle.",
  "Sınavda en çok hangi konulardan soru gelir?",
  "En önemli tanımları ve formülleri listele.",
];

interface Props {
  course: Course;
  initial: ChatMessage[];
  sourceNames: string[];
}

export function ChatScreen({ course, initial, sourceNames }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setPending(message);
    setDraft("");
    setError(null);
    try {
      const res = await fetch(`/api/courses/${course.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `İstek başarısız (${res.status})`);
      setMessages((prev) => [...prev, ...(body.messages as ChatMessage[])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cevap alınamadı.");
      setDraft(message); // yazdığını kaybetme
    } finally {
      setPending(null);
    }
  }

  async function clear() {
    if (!window.confirm("Bu dersin sohbet geçmişi silinsin mi?")) return;
    await fetch(`/api/courses/${course.id}/chat`, { method: "DELETE" });
    setMessages([]);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Link
            href="/"
            className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="truncate">{course.title}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                title="Sohbeti temizle"
                aria-label="Sohbeti temizle"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <div className="w-36">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-5 py-6">
          {messages.length === 0 && !pending && (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                <Bot className="size-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h1 className="text-lg font-semibold">Derse soru sor</h1>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-500">
                Cevaplar yalnızca {sourceNames.length ? `${sourceNames.length} dosyadaki` : "yüklediğin"} materyallerden gelir ve
                kaynağı belirtilir.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    disabled={sourceNames.length === 0}
                    className="rounded-full border border-zinc-300 px-3.5 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} text={m.content} />
          ))}
          {pending && (
            <>
              <Bubble role="user" text={pending} />
              <div className="flex items-center gap-2 text-sm text-zinc-500" role="status">
                <LoaderCircle className="size-4 animate-spin" /> Materyallerine bakıyorum…
              </div>
            </>
          )}
          {error && (
            <div className="flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <form onSubmit={onSubmit} className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-3xl items-end gap-2 px-5 py-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={sourceNames.length ? "Sorunu yaz… (Enter gönderir, Shift+Enter satır atlar)" : "Önce materyal yüklemelisin"}
            disabled={sourceNames.length === 0}
            className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!draft.trim() || !!pending}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-50"
            aria-label="Gönder"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm whitespace-pre-wrap text-white">{text}</p>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-indigo-50 dark:bg-indigo-500/10">
        <Bot className="size-4 text-indigo-600 dark:text-indigo-400" />
      </span>
      <div className="min-w-0 max-w-[92%] rounded-2xl rounded-tl-md border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <RichText text={text} chat />
      </div>
    </div>
  );
}
