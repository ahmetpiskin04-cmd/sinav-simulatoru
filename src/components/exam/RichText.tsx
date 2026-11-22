import { Fragment } from "react";

/**
 * Soru/çözüm metnini güvenle gösterir: ``` kod blokları, `satır içi kod`
 * ve satır sonları. HTML yorumlanmaz (dangerouslySetInnerHTML yok).
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
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
            <InlineCode text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

function InlineCode({ text }: { text: string }) {
  const segments = text.split(/`([^`\n]+)`/);
  return (
    <>
      {segments.map((s, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] dark:bg-zinc-800">
            {s}
          </code>
        ) : (
          <Fragment key={i}>{s}</Fragment>
        ),
      )}
    </>
  );
}
