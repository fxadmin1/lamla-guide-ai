"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Search,
  Volume2,
  Copy,
  Check,
  Printer,
  Download,
  ExternalLink,
  RefreshCw,
  Layers,
  X,
  MessageSquare,
} from "lucide-react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { SlideSegment } from "@/lib/utils";
import FastScrollHandle from "@/components/FastScrollHandle";
import { supabase } from "@/lib/supabase";

interface HeadingItem {
  id: string;
  level: number;
  title: string;
  lineIndex: number;
  slideRefs: number[];
}

interface SourceGroundedNotesWorkspaceProps {
  content: string;
  title: string;
  slides: SlideSegment[];
  sessionId: string;
  noteId?: string;
  onUpdateContent?: (newContent: string) => Promise<void> | void;
  onJumpToSlide?: (slideNumber: number) => void;
  onAskTutorAboutSlide?: (slideNumber: number, slideTitle: string) => void;
}

export default function SourceGroundedNotesWorkspace({
  content,
  title,
  slides,
  onUpdateContent,
  onJumpToSlide,
  onAskTutorAboutSlide,
}: SourceGroundedNotesWorkspaceProps) {
  const [fontSize, setFontSize] = useState<"compact" | "comfortable" | "large">("comfortable");
  const [searchQuery, setSearchQuery] = useState("");
  const [tocFilter, setTocFilter] = useState("");
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");
  const [readProgress, setReadProgress] = useState(0);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const [selectedSlideForInspect, setSelectedSlideForInspect] = useState<SlideSegment | null>(null);

  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null);
  const [activeRegenMenuHeading, setActiveRegenMenuHeading] = useState<string | null>(null);
  const [localContent, setLocalContent] = useState(content);

  const { playTrack, playSection } = useAudioPlayer();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const headings = useMemo(() => {
    const lines = localContent.split("\n");
    const list: HeadingItem[] = [];

    lines.forEach((line, idx) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const rawTitle = match[2].trim();
        const cleanTitle = rawTitle.replace(/[*_`]/g, "").trim();
        const id = `heading-${idx}-${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

        const nearbyText = lines.slice(idx, idx + 25).join(" ");
        const slideMatches = [...nearbyText.matchAll(/(?:Slide|Page)\s*(\d+)/gi)];
        const slideRefs = Array.from(new Set(slideMatches.map((m) => parseInt(m[1], 10)))).slice(0, 4);

        list.push({
          id,
          level,
          title: cleanTitle,
          lineIndex: idx,
          slideRefs,
        });
      }
    });

    return list;
  }, [localContent]);

  const metrics = useMemo(() => {
    const words = localContent.split(/\s+/).filter(Boolean).length;
    const estMinutes = Math.max(1, Math.round(words / 200));
    const citedSlides = new Set<number>();
    const matches = [...localContent.matchAll(/(?:Slide|Page)\s*(\d+)/gi)];
    matches.forEach((m) => citedSlides.add(parseInt(m[1], 10)));

    return {
      wordCount: words,
      readMinutes: estMinutes,
      citedSlideCount: citedSlides.size,
    };
  }, [localContent]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight - el.clientHeight;
    if (scrollHeight > 0) {
      setReadProgress(Math.min(100, Math.round((scrollTop / scrollHeight) * 100)));
    }

    for (let i = headings.length - 1; i >= 0; i--) {
      const h = headings[i];
      const domEl = document.getElementById(h.id);
      if (domEl) {
        const rect = domEl.getBoundingClientRect();
        if (rect.top <= 200) {
          setActiveHeadingId(h.id);
          break;
        }
      }
    }
  };

  const scrollToHeading = (id: string) => {
    const target = document.getElementById(id);
    const container = containerRef.current;
    if (target && container && container.scrollHeight > container.clientHeight + 16) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - 24;
      container.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
      setActiveHeadingId(id);
      return;
    }
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveHeadingId(id);
    }
  };

  const handleInspectSlideNum = (slideNum: number) => {
    const found = slides.find((s) => s.slideNumber === slideNum);
    if (found) {
      setSelectedSlideForInspect(found);
    } else {
      setSelectedSlideForInspect({
        slideNumber: slideNum,
        title: `Slide ${slideNum}`,
        content: `Extracted content for Slide ${slideNum} is available in the Slides tab.`,
        fullReference: `Slide ${slideNum}`,
      });
    }
  };

  const getSectionContent = (headingText: string): { startLine: number; endLine: number; text: string } => {
    const lines = localContent.split("\n");
    let startLine = -1;
    let endLine = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (startLine === -1) {
        if (line.includes(headingText) && line.startsWith("#")) {
          startLine = i;
        }
      } else {
        if (line.startsWith("#") && !line.startsWith("###")) {
          endLine = i;
          break;
        }
      }
    }

    if (startLine === -1) {
      return { startLine: 0, endLine: lines.length, text: localContent };
    }

    return {
      startLine,
      endLine,
      text: lines.slice(startLine, endLine).join("\n"),
    };
  };

  const handleRegenerateSection = async (
    headingText: string,
    instruction: "standard_refresh" | "deeper_rigor" | "simpler_analogy"
  ) => {
    setActiveRegenMenuHeading(null);
    setRegeneratingSectionId(headingText);

    try {
      const sectionInfo = getSectionContent(headingText);
      const slideContext = slides
        .map((s) => `--- Slide ${s.slideNumber}: ${s.title} ---\n${s.content}`)
        .join("\n\n");

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "regenerate_notes_section",
          section_title: headingText,
          current_section_content: sectionInfo.text,
          slide_context: slideContext,
          instruction,
          educationalLevel: "University & Senior High School (SHS)",
        }),
      });

      const data = await res.json();
      if (!data.success || !data.content) {
        throw new Error(data.error || "Failed to regenerate section");
      }

      const lines = localContent.split("\n");
      const before = lines.slice(0, sectionInfo.startLine);
      const after = lines.slice(sectionInfo.endLine);
      const updatedMarkdown = [...before, data.content.trim(), ...after].join("\n");

      setLocalContent(updatedMarkdown);
      if (onUpdateContent) {
        await onUpdateContent(updatedMarkdown);
      }
    } catch (err: any) {
      alert("Section regeneration failed: " + (err.message || err));
    } finally {
      setRegeneratingSectionId(null);
    }
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(localContent);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {}
  };

  const handleCopySection = async (headingText: string) => {
    try {
      const sectionInfo = getSectionContent(headingText);
      await navigator.clipboard.writeText(sectionInfo.text);
      setCopiedSection(headingText);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {}
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([localContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Notes.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const fontClass =
    fontSize === "compact"
      ? "text-sm sm:text-base leading-relaxed"
      : fontSize === "large"
      ? "text-lg sm:text-[19px] leading-[1.9]"
      : "text-base sm:text-[17px] leading-[1.8]";

  const filteredHeadings = headings.filter((h) =>
    tocFilter.trim() === "" ? true : h.title.toLowerCase().includes(tocFilter.toLowerCase())
  );

  // Filter paragraphs if user enters searchQuery
  const displayedContent = useMemo(() => {
    if (!searchQuery.trim()) return localContent;
    const q = searchQuery.toLowerCase();
    return localContent
      .split(/\n{2,}/)
      .filter((block) => block.startsWith("#") || block.toLowerCase().includes(q))
      .join("\n\n");
  }, [localContent, searchQuery]);

  const renderGroundedTextWithCitations = (text: string) => {
    const citationRegex = /\[(?:Source:\s*)?(?:Slide|Page)\s*(\d+)\]|\[External Reference:\s*([^\]]+)\]/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      if (match[1]) {
        const slideNum = parseInt(match[1], 10);
        parts.push(
          <button
            key={`cit-${match.index}-${slideNum}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleInspectSlideNum(slideNum);
            }}
            className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium text-xs hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer align-baseline"
            title={`View original Slide ${slideNum}`}
          >
            <span>Slide {slideNum}</span>
          </button>
        );
      } else if (match[2]) {
        const refName = match[2].trim();
        parts.push(
          <span
            key={`ext-${match.index}`}
            className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs"
          >
            <span>{refName}</span>
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500">
              ~{metrics.readMinutes} min read &bull; {metrics.wordCount.toLocaleString()} words &bull;{" "}
              {metrics.citedSlideCount} slides referenced (click any <span className="text-blue-600 font-medium">Slide</span> tag to inspect source text)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => playTrack(title, "detailed_notes", localContent)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs inline-flex items-center gap-1.5 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Listen</span>
            </button>

            <div className="p-0.5 rounded-lg bg-white dark:bg-slate-800 flex items-center border border-slate-200 dark:border-slate-700 text-xs">
              {(
                [
                  ["compact", "A-"],
                  ["comfortable", "A"],
                  ["large", "A+"],
                ] as const
              ).map(([sz, lbl]) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
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
              onClick={handleCopyAll}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors inline-flex items-center gap-1.5"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? "Copied" : "Copy"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-colors"
              aria-label="Download Markdown"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-colors"
              aria-label="Print notes"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              aria-label="Search within notes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts or terms..."
              className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="w-full sm:w-72">
            <FastScrollHandle
              scrollContainerRef={containerRef}
              orientation="horizontal"
              label="Top Notes Hold and Drag Scroll Bar"
              onProgressChange={setReadProgress}
            />
          </div>
        </div>
      </div>

      {/* 2-Column Workspace: TOC + Main Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Outline */}
        <aside className="lg:col-span-4 xl:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sticky top-4 space-y-3 max-h-[82vh] overflow-y-auto">
          <div className="space-y-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Contents
              </span>
              <span className="text-xs text-slate-500">
                {headings.length} sections
              </span>
            </div>

            <FastScrollHandle
              scrollContainerRef={containerRef}
              orientation="horizontal"
              label="Left Contents Hold and Drag Scroll Bar"
              onProgressChange={setReadProgress}
            />

            {headings.length > 6 && (
              <input
                type="search"
                aria-label="Filter sections"
                value={tocFilter}
                onChange={(e) => setTocFilter(e.target.value)}
                placeholder="Filter sections..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            )}
          </div>

          <nav className="space-y-0.5">
            {filteredHeadings.length === 0 ? (
              <p className="text-xs text-slate-400 p-2">No matching sections.</p>
            ) : (
              filteredHeadings.map((h) => {
                const isActive = activeHeadingId === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => scrollToHeading(h.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors block ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    } ${h.level === 3 ? "pl-5" : ""}`}
                  >
                    <span className="leading-snug">{h.title}</span>
                  </button>
                );
              })
            )}
          </nav>
        </aside>

        {/* Main Content + Left & Right Draggable Fast-Scroll Handles */}
        <div className="lg:col-span-8 xl:col-span-9 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
          <div className="absolute left-1.5 sm:left-2.5 top-1/2 -translate-y-1/2 z-30">
            <FastScrollHandle
              scrollContainerRef={containerRef}
              side="left"
              label="Detailed Notes Left Fast Scroll"
              onProgressChange={setReadProgress}
            />
          </div>

          <div className="absolute right-1.5 sm:right-2.5 top-1/2 -translate-y-1/2 z-30">
            <FastScrollHandle
              scrollContainerRef={containerRef}
              side="right"
              label="Detailed Notes Right Fast Scroll"
              onProgressChange={setReadProgress}
            />
          </div>

          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="px-12 sm:px-16 py-6 sm:py-10 max-h-[82vh] overflow-y-auto"
          >
            <div className={`text-slate-800 dark:text-slate-200 ${fontClass}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => {
                    const headingText = typeof children === "string" ? children : String(children);
                    const clean = headingText.replace(/[*_`]/g, "").trim();
                    const targetH = headings.find((h) => h.title.includes(clean) || clean.includes(h.title));
                    const id = targetH?.id || `heading-${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

                    return (
                      <div id={id} className="group mt-10 first:mt-0 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {children}
                          </h1>
                          <button
                            type="button"
                            onClick={() => playSection(title, clean, getSectionContent(clean).text)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-blue-600 text-xs font-medium inline-flex items-center gap-1.5 self-start shrink-0"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Listen</span>
                          </button>
                        </div>
                      </div>
                    );
                  },

                  h2: ({ children }) => {
                    const headingText = typeof children === "string" ? children : String(children);
                    const clean = headingText.replace(/[*_`]/g, "").trim();
                    const targetH = headings.find((h) => h.title.includes(clean) || clean.includes(h.title));
                    const id = targetH?.id || `heading-${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                    const isRegenerating = regeneratingSectionId === clean;

                    return (
                      <div id={id} className="group mt-12 mb-5 pt-6 border-t-2 border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {children}
                          </h2>

                          <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={() => playSection(title, clean, getSectionContent(clean).text)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 hover:text-blue-600 text-xs transition-colors"
                              aria-label="Listen to section"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopySection(clean)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 text-xs transition-colors"
                              aria-label="Copy section"
                            >
                              {copiedSection === clean ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <div className="relative">
                              <button
                                type="button"
                                disabled={isRegenerating}
                                onClick={() =>
                                  setActiveRegenMenuHeading(activeRegenMenuHeading === clean ? null : clean)
                                }
                                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                <RefreshCw className={`w-3 h-3 ${isRegenerating ? "animate-spin" : ""}`} />
                                <span>{isRegenerating ? "Updating..." : "Rewrite"}</span>
                              </button>

                              {activeRegenMenuHeading === clean && (
                                <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg p-1.5 z-30 space-y-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleRegenerateSection(clean, "standard_refresh")}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                                  >
                                    <span className="block font-medium">Clearer examples</span>
                                    <span className="text-slate-500">Refresh structure and examples</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRegenerateSection(clean, "deeper_rigor")}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                                  >
                                    <span className="block font-medium">More exam detail</span>
                                    <span className="text-slate-500">Deeper definitions and pitfalls</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRegenerateSection(clean, "simpler_analogy")}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                                  >
                                    <span className="block font-medium">Simpler explanation</span>
                                    <span className="text-slate-500">Plain language and everyday analogy</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  },

                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-8 mb-3.5">
                      {children}
                    </h3>
                  ),

                  p: ({ children }) => {
                    if (typeof children === "string") {
                      return <p className="my-5 leading-[1.95]">{renderGroundedTextWithCitations(children)}</p>;
                    }
                    return <div className="my-5 leading-[1.95]">{children}</div>;
                  },

                  li: ({ children }) => {
                    if (typeof children === "string") {
                      return <li className="my-2.5 leading-[1.95] pl-1">{renderGroundedTextWithCitations(children)}</li>;
                    }
                    return <li className="my-2.5 leading-[1.95] pl-1">{children}</li>;
                  },

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

                  table: ({ children }) => (
                    <div
                      className="table-wrapper overflow-x-auto my-7 rounded-xl border border-slate-200 dark:border-slate-800"
                      tabIndex={0}
                      role="region"
                      aria-label="Notes table"
                    >
                      <table className="w-full text-left border-collapse text-sm">
                        {children}
                      </table>
                    </div>
                  ),

                  thead: ({ children }) => (
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
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
                    <blockquote className="my-6 border-l-3 border-blue-600 bg-slate-50 dark:bg-slate-800/60 py-4 px-5 rounded-r-xl text-slate-700 dark:text-slate-300">
                      {children}
                    </blockquote>
                  ),

                  strong: ({ children }) => (
                    <strong className="font-semibold text-slate-950 dark:text-white">
                      {children}
                    </strong>
                  ),

                  hr: () => <hr className="my-10 border-slate-200 dark:border-slate-800" />,
                }}
              >
                {displayedContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Single-Surface Slide Citation Modal */}
      {selectedSlideForInspect && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="slide-verify-title"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full shadow-lg overflow-hidden flex flex-col max-h-[82vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2.5 min-w-0">
                <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">
                    Slide {selectedSlideForInspect.slideNumber} of {slides.length || selectedSlideForInspect.slideNumber}
                  </div>
                  <h4 id="slide-verify-title" className="text-base font-semibold text-slate-900 dark:text-white truncate">
                    {selectedSlideForInspect.title}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlideForInspect(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Close slide preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              <div className="text-xs font-medium text-slate-500">
                Extracted text from your uploaded file
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {selectedSlideForInspect.content || "No text was extracted on this slide."}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedSlideForInspect(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-50 transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {onAskTutorAboutSlide && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = selectedSlideForInspect;
                      setSelectedSlideForInspect(null);
                      onAskTutorAboutSlide(s.slideNumber, s.title);
                    }}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ask AI Tutor</span>
                  </button>
                )}

                {onJumpToSlide && (
                  <button
                    type="button"
                    onClick={() => {
                      const slideNum = selectedSlideForInspect.slideNumber;
                      setSelectedSlideForInspect(null);
                      onJumpToSlide(slideNum);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Slides tab</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
