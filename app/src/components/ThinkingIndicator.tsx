/**
 * 思考中インジケーター
 *
 * AI が考えている間に表示される。内心（通常のClaude出力）は見えないが、
 * 考えていることだけはわかる。speak が呼ばれなければ静かに消える。
 */

export const ThinkingIndicator = () => {
  return (
    <div className="flex justify-start animate-fade-in" role="status" aria-label="思考中">
      <div
        className="rounded-2xl border px-5 py-4
                   bg-gradient-to-br from-[var(--background-elevated)] via-[var(--background-secondary)] to-[var(--background-elevated)]
                   border-[var(--border-color)]
                   shadow-[var(--shadow-sm)]
                   transition-all duration-500"
      >
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full opacity-60"
            style={{ backgroundColor: "var(--foreground-muted)" }}
          >
            <span className="block w-full h-full rounded-full animate-[pulse_1.4s_ease-in-out_infinite]" style={{ backgroundColor: "var(--foreground-muted)" }} />
          </span>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full opacity-60"
            style={{ backgroundColor: "var(--foreground-muted)" }}
          >
            <span className="block w-full h-full rounded-full animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" style={{ backgroundColor: "var(--foreground-muted)" }} />
          </span>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full opacity-60"
            style={{ backgroundColor: "var(--foreground-muted)" }}
          >
            <span className="block w-full h-full rounded-full animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" style={{ backgroundColor: "var(--foreground-muted)" }} />
          </span>
        </div>
      </div>
    </div>
  );
};
