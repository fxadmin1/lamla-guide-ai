"use client";

import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, Maximize2, Minimize2 } from "lucide-react";

/**
 * Strips any active/executable constructs from an SVG string and returns a
 * script-inert `data:image/svg+xml;charset=utf-8,...` URI.
 * Browsers guarantee scripts and external fetches cannot execute inside `<img>` SVGs.
 */
export function buildSafeSvgDataUri(rawSvg: string): string | null {
  const trimmed = (rawSvg || "").trim();
  const match = trimmed.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return null;

  let clean = match[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");

  if (!/\sxmlns\s*=/i.test(clean)) {
    clean = clean.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
}

/**
 * Wraps any raw unfenced `<svg ...>...</svg>` blocks in ```svg fences so
 * ReactMarkdown renders them as structured visual diagrams instead of stripping HTML.
 */
export function normalizeInlineSvgBlocks(markdown: string): string {
  if (!markdown || !/<svg[\s>]/i.test(markdown)) return markdown || "";
  const segments = markdown.split(/(```[\s\S]*?```)/g);
  return segments
    .map((seg) => {
      if (seg.startsWith("```")) return seg;
      return seg.replace(/<svg[\s\S]*?<\/svg>/gi, (svgBlock) => `\n\`\`\`svg\n${svgBlock.trim()}\n\`\`\`\n`);
    })
    .join("");
}

export function SafeSvgDiagram({
  rawSvg,
  compact = false,
}: {
  rawSvg: string;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const dataUri = useMemo(() => buildSafeSvgDataUri(rawSvg), [rawSvg]);

  if (!dataUri) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const a = document.createElement("a");
      a.href = dataUri;
      a.download = "lamla-concept-diagram.svg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {}
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`${
        compact ? "my-3" : "my-4"
      } rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-left`}
    >
      <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
        <span className="font-medium">Labeled concept diagram</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-colors"
            title={expanded ? "Standard size" : "Enlarge diagram"}
          >
            {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            <span>{expanded ? "Shrink" : "Expand"}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-colors"
            title="Download SVG diagram"
          >
            <Download className="w-3 h-3" />
            <span>SVG</span>
          </button>
        </div>
      </div>
      <div className="p-3 sm:p-5 flex items-center justify-center bg-white dark:bg-slate-950 overflow-x-auto">
        <img
          src={dataUri}
          alt="Labeled concept diagram"
          className={`w-full h-auto object-contain ${expanded ? "max-w-4xl max-h-[640px]" : compact ? "max-w-xl max-h-[280px]" : "max-w-2xl max-h-[420px]"}`}
        />
      </div>
    </div>
  );
}

export function SafeEducationalImage({
  src,
  alt,
  compact = false,
}: {
  src?: string;
  alt?: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!src || failed) return null;

  return (
    <figure
      onClick={(e) => e.stopPropagation()}
      className={`${
        compact ? "my-3" : "my-4"
      } rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-left`}
    >
      <div className="relative bg-slate-50/70 dark:bg-slate-950 p-2 sm:p-3 flex items-center justify-center">
        <img
          src={src}
          alt={alt || "Educational visual reference"}
          loading="lazy"
          onError={() => setFailed(true)}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className={`w-full h-auto object-contain mx-auto rounded-lg cursor-zoom-in ${
            expanded ? "max-h-[620px]" : compact ? "max-h-[250px]" : "max-h-[380px]"
          }`}
        />
      </div>
      {alt && (
        <figcaption className="px-3.5 py-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <span className="truncate">{alt}</span>
          <span className="text-[11px] text-slate-400 shrink-0">Click image to {expanded ? "shrink" : "enlarge"}</span>
        </figcaption>
      )}
    </figure>
  );
}

interface VisualMarkdownProps {
  content: string;
  compact?: boolean;
  centeredText?: boolean;
}

export default function VisualMarkdown({
  content,
  compact = false,
  centeredText = false,
}: VisualMarkdownProps) {
  const normalized = useMemo(() => normalizeInlineSvgBlocks(content), [content]);

  return (
    <div className={`space-y-2.5 ${centeredText ? "text-center" : "text-left"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-3 first:mt-0">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white mt-3 first:mt-0">
              {children}
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2.5 first:mt-0">
              {children}
            </h5>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed text-slate-800 dark:text-slate-100">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-950 dark:text-white">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-5 space-y-1.5 text-left text-slate-800 dark:text-slate-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-5 space-y-1.5 text-left text-slate-800 dark:text-slate-200">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 border-l-2 border-blue-600 bg-white dark:bg-slate-900 py-2 px-3.5 rounded-r-lg text-xs sm:text-sm text-slate-700 dark:text-slate-300 text-left">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-slate-200 dark:border-slate-700 text-left">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100/80 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th scope="col" className="p-2.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="p-2.5 border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              {children}
            </td>
          ),
          pre: ({ children }: any) => {
            const childElem = React.isValidElement(children) ? children : null;
            const childProps = (childElem?.props as any) || {};
            const className = String(childProps.className || "");
            const rawContent = String(childProps.children || "").trim();

            const isSvg =
              className.includes("language-svg") ||
              (rawContent.startsWith("<svg") && rawContent.includes("</svg>"));

            if (isSvg) {
              return <SafeSvgDiagram rawSvg={rawContent} compact={compact} />;
            }

            return (
              <div className="my-3 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-left">
                <pre className="p-3 overflow-x-auto font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                  {children}
                </pre>
              </div>
            );
          },
          code: ({ children, className }: any) => {
            const isInline = !className && typeof children === "string" && !children.includes("\n");
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs">
                  {children}
                </code>
              );
            }
            return <code className="font-mono text-xs">{children}</code>;
          },
          img: ({ src, alt }: any) => (
            <SafeEducationalImage src={typeof src === "string" ? src : undefined} alt={alt} compact={compact} />
          ),
          a: ({ href, children }: any) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700"
            >
              {children}
            </a>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
