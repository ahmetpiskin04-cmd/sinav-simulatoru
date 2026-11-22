import { Fragment, type ReactNode } from "react";

/**
 * Soru/çözüm metnini güvenle gösterir: ``` kod blokları, `satır içi kod`
 * ve satır sonları. HTML yorumlanmaz (dangerouslySetInnerHTML yok).
 *
 * `chat` açıkken sohbet cevapları için hafif Markdown da işlenir:
 * **kalın**, "### başlık" satırları ve [Dosya.pdf, s. 5] kaynak etiketleri.
 */
export function RichText({ text, className = "", chat = false }: { text: string; className?: string; chat?: boolean }) {
  const parts = text.split(/```/);
  return (
    <div className={`space-y-2 ${className}`}>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          // İlk satır dil etiketi olabilir (```python)
          const code = part.replace(/^[a-zA-Z0-9+#-]*\n/, "").replace(/\n$/, "");
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-3 font-mono text-[13px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <code>{code}</code>
            </pre>
          );
        }
        const trimmed = part.replace(/^\n+|\n+$/g, "");
        if (!trimmed) return null;
        return (
          <p key={i} className="leading-relaxed whitespace-pre-wrap">
            <Inline text={chat ? trimmed.replace(/^#{1,6}\s+(.+)$/gm, "**$1**") : trimmed} chat={chat} />
          </p>
        );
      })}
    </div>
  );
}

const CITATION = /(\[[^[\]\n]{1,100}?\.pdf(?:\s*,\s*(?:s\.|sayfa|p\.)\s*[\d\s,–-]+)?\])/gi;

function Inline({ text, chat }: { text: string; chat: boolean }) {
  const segments = text.split(/`([^`\n]+)`/);
  return (
    <>
      {segments.map((s, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] dark:bg-zinc-800">
            {s}
          </code>
        ) : (
          <Fragment key={i}>{chat ? formatChat(s) : s}</Fragment>
        ),
      )}
    </>
  );
}

/** **kalın** ve [kaynak] etiketleri */
function formatChat(text: string): ReactNode[] {
  return text.split(/\*\*([^*\n]+)\*\*/).flatMap((chunk, i) => {
    const cited = chunk.split(CITATION).map((c, j) =>
      j % 2 === 1 ? (
        <span
          key={`${i}-${j}`}
          className="mx-0.5 inline-block rounded-md bg-indigo-50 px-1.5 py-px align-baseline text-[0.78em] font-medium whitespace-nowrap text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
          title="Kaynak"
        >
          {c.slice(1, -1)}
        </span>
      ) : (
        <Fragment key={`${i}-${j}`}>{c}</Fragment>
      ),
    );
    return i % 2 === 1 ? [<strong key={i}>{cited}</strong>] : cited;
  });
}
