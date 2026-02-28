import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

export const StreamingText = ({ content }: Props) => {
  return (
    <div className="flex justify-start animate-fade-in" role="status" aria-label="AI応答生成中">
      <div
        className="max-w-[85%] rounded-2xl border px-5 py-4 text-sm shadow-lg break-words
                   bg-gradient-to-br from-[#e6f7f8] via-white to-[#fff8f0]
                   dark:from-[#0f1820] dark:via-[#141d28] dark:to-[#1a1410]
                   border-[#0d7377]/20 dark:border-[#32bac0]/25
                   backdrop-blur-sm
                   transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
        style={{
          boxShadow: '0 4px 12px rgba(13, 115, 119, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
        }}
      >
        <div className="flex items-start gap-3">
          {/* アニメーション付きストリーミングインジケータ */}
          <div className="flex items-center gap-1 mt-1 flex-shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f59e0b] dark:bg-[#fbbf24] animate-[pulse_1.4s_ease-in-out_infinite]"></span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f59e0b] dark:bg-[#fbbf24] animate-[pulse_1.4s_ease-in-out_0.2s_infinite]"></span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f59e0b] dark:bg-[#fbbf24] animate-[pulse_1.4s_ease-in-out_0.4s_infinite]"></span>
          </div>

          {/* ストリーミングテキストコンテンツ */}
          <div
            className="prose-chat flex-1 min-w-0 text-[#1a2332] dark:text-[#e4e9f0]
                       animate-[fadeInUp_0.5s_cubic-bezier(0.22,1,0.36,1)]"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};
