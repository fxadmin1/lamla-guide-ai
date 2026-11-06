"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  ExternalLink,
  RefreshCw,
  Search,
  X,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { EducationalVideo, CuratedVideoResponse } from "@/lib/videoCurator";
import { supabase } from "@/lib/supabase";

interface EducationalVideoCurationProps {
  documentTitle: string;
  extractedText: string;
  sessionId: string;
  cachedVideos?: EducationalVideo[];
  onAskTutorAboutVideo?: (videoTitle: string, channel: string, topic: string) => void;
}

export default function EducationalVideoCuration({
  documentTitle,
  extractedText,
  sessionId,
  cachedVideos,
  onAskTutorAboutVideo,
}: EducationalVideoCurationProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CuratedVideoResponse | null>(null);
  const [activeVideoModal, setActiveVideoModal] = useState<EducationalVideo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "curate_videos",
          title: documentTitle,
          content: extractedText.slice(0, 14000),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setData({
          mainTopic: json.mainTopic || documentTitle,
          subtopics: json.subtopics || [],
          visualConcepts: json.visualConcepts || [],
          discipline: "Higher Education & University",
          verificationStatus: json.verificationStatus || (json.videos?.length ? "verified" : "unverified_or_offline"),
          statusMessage: json.statusMessage || "",
          videos: json.videos || [],
          searchShortcuts: json.searchShortcuts || [],
        });
      } else {
        setError(json.error || "Unable to load related videos right now.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to video recommendation service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cachedVideos && cachedVideos.length > 0) {
      setData({
        mainTopic: documentTitle,
        discipline: "Higher Education & University",
        verificationStatus: "verified",
        videos: cachedVideos,
        searchShortcuts: [
          {
            label: `${documentTitle} — University Lecture`,
            query: `${documentTitle} mechanism university lecture`,
            searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
              documentTitle + " mechanism university lecture"
            )}`,
          },
          {
            label: `${documentTitle} (Ninja Nerd / Khan Academy)`,
            query: `${documentTitle} Ninja Nerd Khan Academy`,
            searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
              documentTitle + " Ninja Nerd Khan Academy"
            )}`,
          },
        ],
      });
    } else {
      fetchVideos();
    }
  }, [sessionId, documentTitle]);

  const videos = data?.videos || [];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Section Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Intelligent YouTube Video Recommendations
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {data?.mainTopic
                ? `Topic-verified educational video explanations for: ${data.mainTopic}`
                : "Supplementary video lessons matched to the specific academic concepts in your uploaded lecture."}
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={fetchVideos}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Analyzing lecture topics..." : "Refresh recommendations"}</span>
          </button>
        </div>

        {/* Detected Lecture Subtopics Badge Strip */}
        {data?.subtopics && data.subtopics.length > 0 && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 mr-1 inline-flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Lecture Topics Analyzed:</span>
            </span>
            {data.subtopics.slice(0, 5).map((sub, idx) => (
              <span
                key={`${sub}-${idx}`}
                className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/60 text-xs font-medium"
              >
                {sub}
              </span>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-10 text-center space-y-2.5 mt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Analyzing lecture concepts and verifying relevant YouTube explanations...
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="mt-4 p-5 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-center space-y-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 mx-auto" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            <button
              type="button"
              onClick={fetchVideos}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs"
            >
              Try again
            </button>
          </div>
        )}

        {/* Honest Verification Notice when No Live Verified Video is Returned */}
        {!loading && !error && videos.length === 0 && data && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Strict Verification & Academic Honesty Policy
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {data.statusMessage ||
                    `Live YouTube video verification could not be completed for "${data.mainTopic}" right now. Rather than inventing or showing unrelated videos, use the targeted concept search links below to open verified lectures directly on YouTube.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Verified Video Cards (Displays all 5 mandatory details) */}
        {!loading && !error && videos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            {videos.map((video) => {
              const lectureTopicLabel = video.relevantLectureTopic || video.topic;
              const learningExplanation = video.whatYouWillLearn || video.relevanceReason;
              return (
                <div
                  key={video.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => setActiveVideoModal(video)}
                      className="relative aspect-video w-full bg-slate-100 dark:bg-slate-950 overflow-hidden block text-left"
                    >
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-slate-900/25 group-hover:bg-slate-900/35 transition-colors flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-sm">
                          <Play className="w-4 h-4 ml-0.5 fill-current" />
                        </div>
                      </div>
                    </button>

                    <div className="p-4 space-y-2">
                      {/* 1. Channel Name + Verified Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 truncate">
                          {video.channelTitle}
                        </span>
                        {video.verified && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        )}
                      </div>

                      {/* 2. Video Title */}
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2 leading-snug">
                        {video.title}
                      </h4>

                      {/* 3. Relevant Topic From Uploaded Lecture */}
                      <div className="pt-0.5">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 line-clamp-1">
                          Lecture Topic: {lectureTopicLabel}
                        </span>
                      </div>

                      {/* 4. Short Explanation of What the Student Will Learn */}
                      <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          What you will learn:{" "}
                        </span>
                        <span className="line-clamp-3">{learningExplanation}</span>
                      </div>
                    </div>
                  </div>

                  {/* 5. Direct YouTube Link + Embedded Watch + AI Tutor Integration */}
                  <div className="p-4 pt-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveVideoModal(video)}
                        className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Watch Lesson</span>
                      </button>

                      <a
                        href={video.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors inline-flex items-center gap-1"
                        aria-label={`Open ${video.title} on YouTube`}
                      >
                        <span>YouTube</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {onAskTutorAboutVideo && (
                      <button
                        type="button"
                        onClick={() =>
                          onAskTutorAboutVideo(video.title, video.channelTitle, lectureTopicLabel)
                        }
                        className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                        <span>Ask AI Tutor about this concept</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Specific Concept Search Shortcuts */}
        {data?.searchShortcuts && data.searchShortcuts.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 inline-flex items-center gap-1.5 mr-1">
              <Search className="w-3.5 h-3.5" />
              <span>Targeted YouTube Concept Searches:</span>
            </span>
            {data.searchShortcuts.map((sc) => (
              <a
                key={sc.label}
                href={sc.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
              >
                <span>{sc.label}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {activeVideoModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={activeVideoModal.title}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {activeVideoModal.channelTitle} •{" "}
                  {activeVideoModal.relevantLectureTopic || activeVideoModal.topic}
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {activeVideoModal.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors shrink-0"
                aria-label="Close video player"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video bg-black w-full">
              <iframe
                src={`${activeVideoModal.embedUrl}?autoplay=1&rel=0`}
                title={activeVideoModal.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400 max-w-md line-clamp-2">
                {activeVideoModal.whatYouWillLearn || activeVideoModal.relevanceReason}
              </p>

              <div className="flex items-center gap-2">
                {onAskTutorAboutVideo && (
                  <button
                    type="button"
                    onClick={() => {
                      const v = activeVideoModal;
                      setActiveVideoModal(null);
                      onAskTutorAboutVideo(
                        v.title,
                        v.channelTitle,
                        v.relevantLectureTopic || v.topic
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ask AI Tutor</span>
                  </button>
                )}

                <a
                  href={activeVideoModal.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open on YouTube</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
