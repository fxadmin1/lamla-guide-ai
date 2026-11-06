"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Printer,
  Headphones,
  Volume2,
  RefreshCw,
} from "lucide-react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { createSpeechChunks, SpeechChunk } from "@/lib/audioEngine";
import {
  SafeEducationalImage,
  SafeSvgDiagram,
  normalizeInlineSvgBlocks,
} from "@/components/VisualMarkdown";
import FastScrollHandle from "@/components/FastScrollHandle";

interface StudyContentRendererProps {
  content: string;
  title?: string;
  badge?: string;
  badgeColor?: "blue" | "violet" | "emerald" | "amber";
  sourceType?: "summary" | "detailed_notes";
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  regenerateLabel?: string;
}

function sanitizeAcademicSummaryMarkdown(markdown: string): string {
  if (!markdown) return "";
  const rawLines = markdown.split(/\r?\n/);
  const outLines: string[] = [];
  let inCode = false;
  let tableHeaderCells: string[] | null = null;
  let inTable = false;

  const stripSlideMarkers = (text: string): string =>
    text
      .replace(/\[(?:Source:\s*)?(?:Slide|Page)s?\s*#?\s*\d+(?:\s*[-–,]\s*\d+)*\]/gi, "")
      .replace(/\((?:Source:\s*)?(?:Slide|Page)s?\s*#?\s*\d+(?:\s*[-–,]\s*\d+)*\)/gi, "")
      .replace(/\b(?:on|in|from|see)\s+(?:Slide|Page)\s*#?\s*\d+\b,?\s*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const stripped = rawLine.trim();

    if (stripped.startsWith("```")) {
      inCode = !inCode;
      inTable = false;
      tableHeaderCells = null;
      outLines.push(rawLine);
      continue;
    }

    if (inCode) {
      outLines.push(rawLine);
      continue;
    }

    // Never render Markdown tables in Academic Summary — convert any legacy saved table rows into clear concept bullets
    if (stripped.startsWith("|") && stripped.endsWith("|")) {
      const cells = stripped
        .slice(1, -1)
        .split("|")
        .map((c) => stripSlideMarkers(c.trim()));

      // Separator row like | --- | --- |
      if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) {
        inTable = true;
        continue;
      }

      if (!inTable && tableHeaderCells === null) {
        // Check if next line is a separator row
        const nextStripped = (rawLines[i + 1] || "").trim();
        if (nextStripped.startsWith("|") && /^\|[\s:-]+\|$/.test(nextStripped.replace(/\|/g, "|"))) {
          const nextCells = nextStripped
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());
          if (nextCells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) {
            tableHeaderCells = cells;
            inTable = true;
            continue;
          }
        }
      }

      inTable = true;
      const nonEmpty = cells.filter((c) => c && !/^(?:slide|page)\s*#?\s*\d+$/i.test(c));
      if (nonEmpty.length >= 2) {
        const lead = nonEmpty[0].replace(/^\*\*|\*\*$/g, "").trim();
        const rest = nonEmpty.slice(1).join(" — ").trim();
        if (lead && rest) {
          outLines.push(`- **${lead}:** ${rest}`);
        }
      } else if (nonEmpty.length === 1) {
        outLines.push(`- ${nonEmpty[0]}`);
      }
      continue;
    } else if (inTable) {
      inTable = false;
      tableHeaderCells = null;
      outLines.push("");
    }

    // Sanitize headings so "Slide 1 Summary", "Slide 2 — Topic", etc. never appear
    const headingMatch = stripped.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const hashes = headingMatch[1];
      let hText = stripSlideMarkers(headingMatch[2]);
      hText = hText
        .replace(/^(?:Slide|Page)\s*#?\s*\d+\s*(?:Summary|Overview|Notes)?\s*[:\-–—]?\s*/i, "")
        .replace(/\bSlide[-\s]+by[-\s]+Slide\b\s*/gi, "")
        .trim();
      if (!hText || /^(?:Slide|Page)\s*#?\s*\d+$/i.test(hText)) {
        continue;
      }
      // Drop superficial meta-questions like "What is on slide one?"
      if (/^what\s+(?:is|are)\s+on\s+(?:slide|page)\b/i.test(hText)) {
        continue;
      }
      outLines.push(`${hashes} ${hText}`);
      continue;
    }

    // Drop standalone "What is on slide X?" lines
    if (/^what\s+(?:is|are)\s+on\s+(?:slide|page)\b/i.test(stripped)) {
      continue;
    }

    if (stripped === "") {
      outLines.push("");
      continue;
    }

    outLines.push(stripSlideMarkers(rawLine));
  }

  return outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export default function StudyContentRenderer({
  content,
  title,
  badge = "Summary",
  sourceType = "summary",
  onRegenerate,
  isRegenerating = false,
  regenerateLabel = "Regenerate Summary",
}: StudyContentRendererProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fontSize, setFontSize] = useState<"normal" | "large" | "compact">("normal");
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const renderedContent = React.useMemo(() => {
    return sourceType === "summary" ? sanitizeAcademicSummaryMarkdown(content) : content;
  }, [content, sourceType]);

  const { playTrack, playSection, session, isPlaying, pause, getSavedBookmark } = useAudioPlayer();

  const effectiveTitle = title || (sourceType === "detailed_notes" ? "Detailed Notes" : "Summary");
  const savedBookmark = getSavedBookmark(effectiveTitle, sourceType);

  const chunks: SpeechChunk[] = React.useMemo(() => {
    return createSpeechChunks(renderedContent);
  }, [renderedContent]);

  const userScrolledRef = React.useRef(false);
  const scrollTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleUserManualScroll = () => {
    userScrolledRef.current = true;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      userScrolledRef.current = false;
    }, 4000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(renderedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handlePrint = () => {
    window.print();
  };

  const getNodeText = (node: any): string => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(getNodeText).join(" ");
    if (node.props?.children) return getNodeText(node.props.children);
    return "";
  };

  const extractSectionText = (headingText: string): string => {
    if (!headingText) return renderedContent;
    const lines = renderedContent.split("\n");
    let capturing = false;
    const captured: string[] = [];
    const cleanHeading = headingText.toLowerCase().trim();

    for (const line of lines) {
      const cleanLine = line.replace(/^[#\s*_-]+/, "").toLowerCase().trim();
      if (!capturing && cleanLine.includes(cleanHeading) && line.startsWith("#")) {
        capturing = true;
        captured.push(line);
        continue;
      }
      if (capturing) {
        if (line.startsWith("# ") || line.startsWith("## ")) {
          break;
        }
        captured.push(line);
      }
    }
    return captured.join("\n") || headingText;
  };

  const isCurrentAudioActive = isPlaying && session?.title?.includes(title || "Study Content");

  const handleToggleReadAloud = () => {
    if (isCurrentAudioActive) {
      pause();
    } else {
      playTrack(effectiveTitle, sourceType, renderedContent);
    }
  };

  const fontClass = {
    compact: "text-sm sm:text-base leading-relaxed",
    normal: "text-base sm:text-[17px] leading-[1.8]",
    large: "text-lg sm:text-[19px] leading-[1.9]",
  }[fontSize];

  return (
    <div className={`transition-all duration-200 ${isExpanded ? "max-w-6xl mx-auto" : "max-w-4xl mx-auto"}`}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header Toolbar */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
              {badge}
            </span>
            {title && (
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs sm:max-w-md hidden sm:inline-block">
                {title}
              </span>
            )}
          </div>

          {/* Reading Controls */}
          <div className="flex items-center gap-1.5 print:hidden flex-wrap">
            {onRegenerate && (
              <button
                type="button"
                disabled={isRegenerating}
                onClick={onRegenerate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                <span>{isRegenerating ? "Regenerating..." : regenerateLabel}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleReadAloud}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isCurrentAudioActive
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>{isCurrentAudioActive ? "Pause audio" : "Read aloud"}</span>
            </button>

            {savedBookmark !== null && savedBookmark > 0 && !isCurrentAudioActive && (
              <button
                type="button"
                onClick={() => playTrack(effectiveTitle, sourceType, renderedContent, { startIndex: savedBookmark })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-100/70 transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Resume ({savedBookmark + 1})</span>
              </button>
            )}

            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
              {(
                [
                  ["compact", "A-"],
                  ["normal", "A"],
                  ["large", "A+"],
                ] as const
              ).map(([sz, lbl]) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    fontSize === sz
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
              aria-label={isExpanded ? "Standard width" : "Expanded width"}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
              aria-label="Print notes"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interactive Hold-and-Drag Horizontal Scroll Scrubber */}
          <div className="w-full pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
            <FastScrollHandle
              scrollContainerRef={scrollContainerRef}
              orientation="horizontal"
              label="Summary Hold and Drag Scroll Bar"
            />
          </div>
        </div>

        {/* Content Body + Left & Right Draggable Fast-Scroll Handles */}
        <div className="relative overflow-hidden">
          <div className="absolute left-1.5 sm:left-2.5 top-1/2 -translate-y-1/2 z-30">
            <FastScrollHandle
              scrollContainerRef={scrollContainerRef}
              side="left"
              label="Summary Left Fast Scroll"
            />
          </div>

          <div className="absolute right-1.5 sm:right-2.5 top-1/2 -translate-y-1/2 z-30">
            <FastScrollHandle
              scrollContainerRef={scrollContainerRef}
              side="right"
              label="Summary Right Fast Scroll"
            />
          </div>

          <div
            ref={scrollContainerRef}
            onWheel={handleUserManualScroll}
            onTouchMove={handleUserManualScroll}
            className={`px-12 sm:px-16 py-6 sm:py-10 max-h-[78vh] overflow-y-auto text-slate-800 dark:text-slate-200 ${fontClass}`}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => {
                  const headingText = getNodeText(children);
                  return (
                    <div className="group flex items-baseline justify-between gap-3 mt-10 first:mt-0 mb-5 border-b border-slate-200 dark:border-slate-800 pb-3.5">
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {children}
                      </h1>
                      {headingText && (
                        <button
                          type="button"
                          onClick={() =>
                            playSection(
                              title || "Study Section",
                              headingText,
                              extractSectionText(headingText)
                            )
                          }
                          className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-blue-600 text-xs font-medium inline-flex items-center gap-1 shrink-0 print:hidden"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Listen</span>
                        </button>
                      )}
                    </div>
                  );
                },
                h2: ({ children }) => {
                  const headingText = getNodeText(children);
                  return (
                    <div className="group flex items-baseline justify-between gap-3 mt-10 mb-4 pt-3 border-t border-slate-100 dark:border-slate-800/70">
                      <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                        {children}
                      </h2>
                      {headingText && (
                        <button
                          type="button"
                          onClick={() =>
                            playSection(
                              title || "Study Topic",
                              headingText,
                              extractSectionText(headingText)
                            )
                          }
                          className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-blue-600 text-xs font-medium inline-flex items-center gap-1 shrink-0 print:hidden"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Listen</span>
                        </button>
                      )}
                    </div>
                  );
                },
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-7 mb-3">
                    {children}
                  </h3>
                ),
                p: ({ children }) => {
                  const pText = getNodeText(children);
                  const currentChunk =
                    isCurrentAudioActive && session && session.currentChunkIndex !== undefined && session.chunks
                      ? session.chunks[session.currentChunkIndex]
                      : null;

                  const isSpeakingThis = !!(
                    currentChunk &&
                    pText &&
                    (pText.trim().toLowerCase().includes(currentChunk.rawText.trim().toLowerCase().slice(0, 30)) ||
                      currentChunk.rawText.trim().toLowerCase().includes(pText.trim().toLowerCase().slice(0, 30)))
                  );

                  return (
                    <ParagraphItem
                      pText={pText}
                      isSpeakingThis={isSpeakingThis}
                      chunks={chunks}
                      effectiveTitle={effectiveTitle}
                      sourceType={sourceType}
                      content={renderedContent}
                      playTrack={playTrack}
                      userScrolledRef={userScrolledRef}
                    >
                      {children}
                    </ParagraphItem>
                  );
                },
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 font-medium"
                  >
                    {children}
                  </a>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-slate-950 dark:text-white">
                    {children}
                  </strong>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-outside ml-5 space-y-3.5 my-5 text-slate-700 dark:text-slate-300">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside ml-5 space-y-3.5 my-5 text-slate-700 dark:text-slate-300">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-[1.9] text-slate-700 dark:text-slate-300 pl-1.5">
                    {children}
                  </li>
                ),
                table: ({ children }) => (
                  <div
                    className="table-wrapper overflow-x-auto my-7 rounded-xl border border-slate-200 dark:border-slate-800"
                    tabIndex={0}
                    role="region"
                    aria-label="Study comparison table"
                  >
                    <table className="w-full text-left border-collapse text-sm">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    {children}
                  </thead>
                ),
                th: ({ children }) => (
                  <th scope="col" className="p-3.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="p-3.5 border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                    {children}
                  </td>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-6 border-l-3 border-blue-600 bg-slate-50 dark:bg-slate-800/60 py-3.5 px-5 rounded-r-xl text-slate-700 dark:text-slate-300">
                    {children}
                  </blockquote>
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
                    return <SafeSvgDiagram rawSvg={rawContent} />;
                  }

                  return (
                    <div className="my-6 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                      <pre className="p-4 overflow-x-auto font-mono text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                        {children}
                      </pre>
                    </div>
                  );
                },
                code: ({ children, className }: any) => {
                  const isInline = !className && typeof children === "string" && !children.includes("\n");
                  if (isInline) {
                    return (
                      <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs">
                        {children}
                      </code>
                    );
                  }
                  return <code className="font-mono text-xs sm:text-sm">{children}</code>;
                },
                img: ({ src, alt }: any) => (
                  <SafeEducationalImage src={typeof src === "string" ? src : undefined} alt={alt} />
                ),
                hr: () => <hr className="my-9 border-slate-200 dark:border-slate-800" />,
              }}
            >
              {normalizeInlineSvgBlocks(renderedContent)}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ParagraphItemProps {
  children: React.ReactNode;
  pText: string;
  isSpeakingThis: boolean;
  chunks: SpeechChunk[];
  effectiveTitle: string;
  sourceType: any;
  content: string;
  playTrack: any;
  userScrolledRef: React.RefObject<boolean>;
}

function ParagraphItem({
  children,
  pText,
  isSpeakingThis,
  chunks,
  effectiveTitle,
  sourceType,
  content,
  playTrack,
  userScrolledRef,
}: ParagraphItemProps) {
  const elRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isSpeakingThis && elRef.current && !userScrolledRef.current) {
      elRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isSpeakingThis, userScrolledRef]);

  const handleReadFromHere = () => {
    if (!pText || chunks.length === 0) {
      playTrack(effectiveTitle, sourceType, content);
      return;
    }
    const cleanP = pText.trim().toLowerCase().slice(0, 40);
    const chunkIdx = chunks.findIndex(
      (c) =>
        c.rawText.toLowerCase().includes(cleanP) ||
        cleanP.includes(c.rawText.toLowerCase().slice(0, 30))
    );
    playTrack(effectiveTitle, sourceType, content, {
      startIndex: chunkIdx >= 0 ? chunkIdx : 0,
    });
  };

  return (
    <div
      ref={elRef}
      className={`group relative my-5 transition-colors rounded-lg ${
        isSpeakingThis
          ? "bg-blue-50/80 dark:bg-blue-950/30 border-l-3 border-blue-600 pl-3.5 pr-2 py-1"
          : ""
      }`}
    >
      <p className="text-slate-800 dark:text-slate-200 leading-[1.9]">{children}</p>
      {pText && pText.trim().length > 20 && (
        <button
          type="button"
          onClick={handleReadFromHere}
          className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 -translate-y-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-blue-600 text-xs font-medium inline-flex items-center gap-1 shadow-2xs print:hidden z-10"
          title="Read aloud from this paragraph"
        >
          <Volume2 className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Read here</span>
        </button>
      )}
    </div>
  );
}
