"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 style={{ color: "#f1f5f9", borderBottom: "1px solid rgba(34,211,238,0.20)" }}
      className="text-2xl font-bold mt-6 mb-3 pb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ color: "#22d3ee" }} className="text-xl font-bold mt-6 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ color: "#a78bfa" }} className="text-base font-semibold mt-4 mb-1.5">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ color: "#94a3b8" }} className="text-sm font-semibold mt-3 mb-1">{children}</h4>
  ),
  p:  ({ children }) => <p style={{ color: "#cbd5e1" }} className="mb-3 leading-7">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
  li: ({ children }) => <li style={{ color: "#cbd5e1" }} className="leading-6">{children}</li>,
  strong: ({ children }) => <strong style={{ color: "#f1f5f9" }} className="font-semibold">{children}</strong>,
  em: ({ children }) => <em style={{ color: "#94a3b8" }} className="italic">{children}</em>,
  hr: () => <hr style={{ borderColor: "rgba(255,255,255,0.08)" }} className="my-5" />,
  blockquote: ({ children }) => (
    <blockquote
      className="border-l-4 pl-4 italic py-2 rounded-r-lg my-3"
      style={{ borderColor: "#a78bfa", background: "rgba(167,139,250,0.07)", color: "#94a3b8" }}>
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    return isBlock
      ? <code className="block p-4 rounded-xl overflow-x-auto text-sm font-mono"
          style={{ background: "rgba(0,0,0,0.50)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0" }}>
          {children}
        </code>
      : <code className="px-1.5 py-0.5 rounded text-sm font-mono"
          style={{ background: "rgba(34,211,238,0.10)", color: "#22d3ee" }}>
          {children}
        </code>;
  },
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: "rgba(34,211,238,0.10)", borderBottom: "1px solid rgba(34,211,238,0.25)" }}>
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left font-semibold" style={{ color: "#22d3ee" }}>{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 border-b" style={{ color: "#cbd5e1", borderColor: "rgba(255,255,255,0.07)" }}>{children}</td>
  ),
};

interface Props {
  markdown?: string;
  content?: string;   // alias for markdown
  className?: string;
}

export function MathOutput({ markdown: markdownProp, content: contentProp, className }: Props) {
  const markdown = markdownProp ?? contentProp;
  if (!markdown) return null;
  return (
    <div className={`prose-math max-w-none mt-4${className ? " " + className : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
