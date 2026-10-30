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
} from "lucide-react";
import { EducationalVideo, CuratedVideoResponse } from "@/lib/videoCurator";

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
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "curate_videos",
          title: documentTitle,
          content: extractedText.slice(0, 10000),
        }),
      });

      const json = await res.json();
      if (json.success && json.videos) {
        setData({
          mainTopic: json.mainTopic || documentTitle,
          discipline: "Higher Education & Senior High School",
          videos: json.videos,
          searchShortcuts: json.searchShortcuts || [],
        });
      } else {
        setError(json.error || "Unable to load related videos right now.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to video service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cachedVideos && cachedVideos.length > 0) {
      setData({
        mainTopic: documentTitle,
        discipline: "Higher Education & Senior High School",
        videos: cachedVideos,
        searchShortcuts: [
          {
            label: "Khan Academy",
            query: `${documentTitle} Khan Academy`,
            searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
              documentTitle + " Khan Academy"
            )}`,
          },
          {
            label: "CrashCourse",
            query: `${documentTitle} CrashCourse`,
            searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
              documentTitle + " CrashCourse"
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
              Related video lessons
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {data?.mainTopic
                ? `Selected YouTube explanations for ${data.mainTopic}`
                : "Supplementary video lessons matched to the main topic of your uploaded file."}
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={fetchVideos}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Refreshing..." : "Refresh videos"}</span>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-10 text-center space-y-2.5 mt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-300">Finding relevant video lessons...</p>
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

        {/* Video Cards */}
        {!loading && !error && videos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            {videos.map((video) => (
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

                  <div className="p-4 space-y-1.5">
                    <div className="text-xs font-medium text-slate-500 truncate">
                      {video.channelTitle}
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2 leading-snug">
                      {video.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {video.relevanceReason}
                    </p>
                  </div>
                </div>

                <div className="p-4 pt-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveVideoModal(video)}
                      className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Watch</span>
                    </button>

                    <a
                      href={video.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      aria-label="Open on YouTube"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {onAskTutorAboutVideo && (
                    <button
                      type="button"
                      onClick={() => onAskTutorAboutVideo(video.title, video.channelTitle, video.topic)}
                      className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ask AI Tutor</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Shortcuts */}
        {data?.searchShortcuts && data.searchShortcuts.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 inline-flex items-center gap-1.5 mr-1">
              <Search className="w-3.5 h-3.5" />
              <span>More on YouTube:</span>
            </span>
            {data.searchShortcuts.map((sc) => (
              <a
                key={sc.label}
                href={sc.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
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
                <div className="text-xs text-slate-500">
                  {activeVideoModal.channelTitle}
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
                {activeVideoModal.relevanceReason}
              </p>

              <div className="flex items-center gap-2">
                {onAskTutorAboutVideo && (
                  <button
                    type="button"
                    onClick={() => {
                      const v = activeVideoModal;
                      setActiveVideoModal(null);
                      onAskTutorAboutVideo(v.title, v.channelTitle, v.topic);
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
