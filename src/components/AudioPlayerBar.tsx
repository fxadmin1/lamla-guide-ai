"use client";

import React, { useState } from "react";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  X,
  Check,
  Sliders,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useAudioPlayer, AudioSourceType } from "@/contexts/AudioPlayerContext";

const SOURCE_LABELS: Record<AudioSourceType, string> = {
  summary: "Summary",
  detailed_notes: "Notes",
  section: "Section",
  tutor_answer: "AI Tutor",
  flashcards: "Flashcards",
  drill_questions: "Slide Drill",
  drill: "Slide Drill",
};

export default function AudioPlayerBar() {
  const {
    session,
    isPlaying,
    voices,
    selectedVoice,
    playbackSpeed,
    pitch,
    highlightSentence,
    isBarVisible,
    isBarMinimized,
    pause,
    resume,
    stop,
    nextChunk,
    prevChunk,
    seekChunk,
    replayChunk,
    setPlaybackSpeed,
    setPitch,
    setSelectedVoice,
    setHighlightSentence,
    testVoice,
    restoreDefaults,
    toggleMinimize,
    closePlayer,
  } = useAudioPlayer();

  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  if (!isBarVisible || !session) return null;

  const currentChunk = session.chunks[session.currentChunkIndex] || session.chunks[0];
  const totalChunks = session.chunks.length;
  const currentChunkNum = session.currentChunkIndex + 1;
  const progressPct = totalChunks > 0 ? (currentChunkNum / totalChunks) * 100 : 0;

  const remainingWords = session.chunks
    .slice(session.currentChunkIndex)
    .reduce((acc, c) => acc + c.wordCount, 0);
  const wordsPerMinute = 140 * playbackSpeed;
  const minutesRemaining = Math.max(1, Math.ceil(remainingWords / wordsPerMinute));

  const sourceLabel = SOURCE_LABELS[session.sourceType] || "Audio";

  // Minimized Floating Pill
  if (isBarMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-lg">
        <div
          className="flex items-end gap-0.5 h-3.5 px-1"
          title={isPlaying ? "Speaking..." : "Paused"}
        >
          <span className={`w-0.5 rounded-full bg-blue-600 transition-all ${isPlaying ? "h-2.5 animate-pulse" : "h-1"}`} />
          <span className={`w-0.5 rounded-full bg-blue-600 transition-all ${isPlaying ? "h-3.5 animate-bounce" : "h-1.5"}`} />
          <span className={`w-0.5 rounded-full bg-blue-600 transition-all ${isPlaying ? "h-2 animate-pulse" : "h-1"}`} />
        </div>

        <span className="text-xs font-medium max-w-[140px] sm:max-w-[180px] truncate">
          {session.title}
        </span>

        <span className="text-xs text-slate-400 font-mono shrink-0">
          {currentChunkNum}/{totalChunks}
        </span>

        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
          {isPlaying ? (
            <button
              type="button"
              onClick={pause}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              aria-label="Pause playback"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={resume}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 transition-colors"
              aria-label="Resume playback"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleMinimize}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
            aria-label="Expand audio player"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={closePlayer}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close audio player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 w-84 sm:w-96 max-w-[calc(100vw-2rem)] rounded-2xl shadow-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
              {sourceLabel}
            </span>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {session.title}
            </h4>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleMinimize}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
              aria-label="Minimize player"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={closePlayer}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
              aria-label="Close player"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Info */}
        <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
          <span>
            Sentence <strong className="text-slate-800 dark:text-slate-200">{currentChunkNum}</strong> of {totalChunks}
          </span>
          <span>~{minutesRemaining} min left</span>
        </div>

        {/* Spoken Sentence */}
        <div className="px-4 py-3 bg-white dark:bg-slate-900 min-h-[52px] max-h-[96px] overflow-y-auto flex items-center">
          {currentChunk ? (
            <div className="w-full">
              {currentChunk.sectionHeading && (
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-0.5">
                  {currentChunk.sectionHeading}
                </div>
              )}
              <p
                className={`text-xs leading-relaxed ${
                  highlightSentence
                    ? "text-slate-900 dark:text-slate-100 bg-blue-50/70 dark:bg-blue-950/30 px-2.5 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900/40"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {currentChunk.rawText}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Preparing audio...</p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="px-4 pt-1">
          <div className="relative w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden cursor-pointer">
            <div
              className="absolute left-0 top-0 bottom-0 bg-blue-600 rounded-full transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(0, totalChunks - 1)}
              value={session.currentChunkIndex}
              onChange={(e) => seekChunk(parseInt(e.target.value, 10))}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="Audio scrubber"
            />
          </div>
        </div>

        {/* Controls */}
        <div className="p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={session.currentChunkIndex <= 0}
              onClick={prevChunk}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              aria-label="Previous sentence"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={replayChunk}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Replay sentence"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {isPlaying ? (
              <button
                type="button"
                onClick={pause}
                className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
                aria-label="Pause"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={resume}
                className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
                aria-label="Play"
              >
                <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
              </button>
            )}

            <button
              type="button"
              disabled={session.currentChunkIndex >= totalChunks - 1}
              onClick={nextChunk}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              aria-label="Next sentence"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={stop}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Stop playback"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              {[0.75, 1.0, 1.25, 1.5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-1.5 py-0.5 text-[11px] font-medium rounded transition-colors ${
                    playbackSpeed === s
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowVoiceModal(true)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-colors"
              aria-label="Select voice"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-colors"
              aria-label="Audio preferences"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Voice Selector Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full max-h-[80vh] flex flex-col shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Speech voice
              </h3>
              <button
                type="button"
                onClick={() => setShowVoiceModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                aria-label="Close voice dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 my-4 pr-1">
              {voices.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  Loading available browser voices...
                </div>
              ) : (
                voices.map((v) => {
                  const isSelected = selectedVoice?.name === v.name;
                  return (
                    <div
                      key={v.name}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                        isSelected
                          ? "bg-blue-50/70 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVoice(v);
                          setShowVoiceModal(false);
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium truncate">{v.displayName}</p>
                          {v.isNatural && (
                            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Natural
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{v.lang}</p>
                      </button>

                      <div className="flex items-center gap-2 pl-2">
                        <button
                          type="button"
                          onClick={() => testVoice(v)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                        >
                          Sample
                        </button>
                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-500">{voices.length} voices available</span>
              <button
                type="button"
                onClick={() => setShowVoiceModal(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Preferences Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Audio preferences
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                aria-label="Close preferences"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
                <span>Voice pitch</span>
                <span>{pitch.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Highlight spoken sentence
                </p>
                <p className="text-xs text-slate-500">
                  Outline the active sentence during playback
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={highlightSentence}
                onClick={() => setHighlightSentence(!highlightSentence)}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  highlightSentence ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    highlightSentence ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={restoreDefaults}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                Reset defaults
              </button>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
