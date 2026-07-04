"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-brand-800 mt-6 mb-3 pb-2 border-b border-brand-100">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold text-brand-700 mt-5 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-brand-600 mt-4 mb-1.5">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold text-gray-700 mt-3 mb-1">{children}</h4>,
  p:  ({ children }) => <p className="mb-3 leading-7 text-gray-700">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-gray-700 leading-6">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
  hr: () => <hr className="border-t border-brand-100 my-4" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-brand-300 pl-4 italic text-gray-600 bg-brand-50 py-2 rounded-r-lg my-3">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    return isBlock
      ? <code className="block bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-sm font-mono">{children}</code>
      : <code className="bg-gray-100 text-brand-700 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
  },
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-brand-700 text-white">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-2.5 text-left font-semibold text-white">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2 border border-gray-200 text-gray-700">{children}</td>,
  tr: ({ children }) => <tr className="even:bg-brand-50">{children}</tr>,
};

interface Props {
  content: string;
  className?: string;
}

export function MathOutput({ content, className = "" }: Props) {
  return (
    <div className={`math-output ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
