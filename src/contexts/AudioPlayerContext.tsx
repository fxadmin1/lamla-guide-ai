"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  SpeechChunk,
  VoiceOption,
  createSpeechChunks,
  getAvailableVoices,
  getDefaultVoice,
  preprocessEducationalSpeech,
} from "@/lib/audioEngine";

export type AudioSourceType =
  | "summary"
  | "detailed_notes"
  | "section"
  | "tutor_answer"
  | "flashcards"
  | "drill_questions"
  | "drill";

export interface AudioSession {
  id: string;
  title: string;
  sourceType: AudioSourceType;
  chunks: SpeechChunk[];
  currentChunkIndex: number;
  status: "idle" | "loading" | "speaking" | "paused" | "completed" | "error";
  error: string | null;
  startedAt: number;
}

interface AudioPlayerContextType {
  session: AudioSession | null;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  voices: VoiceOption[];
  selectedVoice: VoiceOption | null;
  playbackSpeed: number;
  pitch: number;
  highlightSentence: boolean;
  isBarVisible: boolean;
  isBarMinimized: boolean;

  // Actions
  playTrack: (
    title: string,
    sourceType: AudioSourceType,
    rawText: string,
    options?: { startIndex?: number; sectionHeading?: string }
  ) => void;
  playSection: (
    title: string,
    sectionHeading: string,
    sectionContent: string
  ) => void;
  playTutorAnswer: (tutorAnswerText: string, title?: string) => void;
  playFlashcards: (
    title: string,
    cards: Array<{ front: string; back: string }>,
    options?: { includeAnswers?: boolean }
  ) => void;
  playDrillQuestions: (
    title: string,
    questions: Array<{
      question_text: string;
      options?: string[] | null;
      correct_answer: string;
      explanation?: string | null;
    }>
  ) => void;

  pause: () => void;
  resume: () => void;
  stop: () => void;
  nextChunk: () => void;
  prevChunk: () => void;
  seekChunk: (index: number) => void;
  replayChunk: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setPitch: (pitch: number) => void;
  setSelectedVoice: (voice: VoiceOption) => void;
  setHighlightSentence: (enabled: boolean) => void;
  testVoice: (voice: VoiceOption) => void;
  restoreDefaults: () => void;
  toggleMinimize: () => void;
  closePlayer: () => void;
  getSavedBookmark: (title: string, sourceType: AudioSourceType) => number | null;
  clearBookmark: (title: string, sourceType: AudioSourceType) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

const STORAGE_KEY_VOICE = "lamla_audio_voice_name";
const STORAGE_KEY_SPEED = "lamla_audio_speed";
const STORAGE_KEY_PITCH = "lamla_audio_pitch";
const STORAGE_KEY_HIGHLIGHT = "lamla_audio_highlight";

export function AudioPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<AudioSession | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoiceState] = useState<VoiceOption | null>(null);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);
  const [pitch, setPitchState] = useState<number>(1.0);
  const [highlightSentence, setHighlightSentenceState] = useState<boolean>(true);
  const [isBarVisible, setIsBarVisible] = useState<boolean>(false);
  const [isBarMinimized, setIsBarMinimized] = useState<boolean>(false);

  // Active utterance reference & session ID to discard stale callbacks
  const activeSessionIdRef = useRef<string | null>(null);
  const currentChunkIndexRef = useRef<number>(0);
  const currentChunksRef = useRef<SpeechChunk[]>([]);
  const keepAliveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const sessionMetaRef = useRef<{ title: string; sourceType: AudioSourceType } | null>(null);

  // ─── 1. Load Voices & Stored Preferences ───
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      const detected = getAvailableVoices();
      if (detected.length > 0) {
        setVoices(detected);

        // Restore voice preference from localStorage
        const savedVoiceName = localStorage.getItem(STORAGE_KEY_VOICE);
        if (savedVoiceName) {
          const matched = detected.find((v) => v.name === savedVoiceName);
          if (matched) {
            setSelectedVoiceState(matched);
            return;
          }
        }

        // Default to best natural voice
        const best = getDefaultVoice(detected);
        if (best) setSelectedVoiceState(best);
      }
    };

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Restore speed, pitch, highlight
    try {
      const savedSpeed = localStorage.getItem(STORAGE_KEY_SPEED);
      if (savedSpeed) setPlaybackSpeedState(parseFloat(savedSpeed));

      const savedPitch = localStorage.getItem(STORAGE_KEY_PITCH);
      if (savedPitch) setPitchState(parseFloat(savedPitch));

      const savedHighlight = localStorage.getItem(STORAGE_KEY_HIGHLIGHT);
      if (savedHighlight !== null) setHighlightSentenceState(savedHighlight === "true");
    } catch {
      // LocalStorage access restricted fallback
    }

    return () => {
      stopInternal();
    };
  }, []);

  // ─── Chromium Keepalive Watchdog ───
  // Prevents Chromium's 14-second audio pause stall bug
  const startKeepAlive = () => {
    if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
    keepAliveTimerRef.current = setInterval(() => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 8000);
  };

  const stopKeepAlive = () => {
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
  };

  // ─── Core Internal Speech Function ───
  const speakChunkInternal = useCallback(
    (
      chunkIndex: number,
      chunks: SpeechChunk[],
      sessionId: string,
      voice: VoiceOption | null,
      speed: number,
      pitchVal: number
    ) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      if (chunkIndex < 0 || chunkIndex >= chunks.length) {
        setSession((prev) =>
          prev && prev.id === sessionId ? { ...prev, status: "completed" } : prev
        );
        isSpeakingRef.current = false;
        stopKeepAlive();
        return;
      }

      // Check if session is still active
      if (activeSessionIdRef.current !== sessionId) return;

      currentChunkIndexRef.current = chunkIndex;
      const chunk = chunks[chunkIndex];

      // Cancel any ongoing utterance before queuing the new chunk
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(chunk.speechText);
      if (voice) {
        utterance.voice = voice.voice;
      }
      utterance.rate = speed;
      utterance.pitch = pitchVal;

      utterance.onstart = () => {
        if (activeSessionIdRef.current !== sessionId) return;
        isSpeakingRef.current = true;
        startKeepAlive();
        setSession((prev) =>
          prev && prev.id === sessionId
            ? { ...prev, status: "speaking", currentChunkIndex: chunkIndex }
            : prev
        );

        // Persist reading bookmark to localStorage
        if (sessionMetaRef.current && typeof window !== "undefined") {
          try {
            localStorage.setItem(
              `lamla_audio_bm_${sessionMetaRef.current.sourceType}_${sessionMetaRef.current.title}`,
              chunkIndex.toString()
            );
          } catch {}
        }
      };

      utterance.onend = () => {
        if (activeSessionIdRef.current !== sessionId) return;
        const nextIdx = chunkIndex + 1;
        if (nextIdx < chunks.length) {
          // Play next chunk automatically
          speakChunkInternal(nextIdx, chunks, sessionId, voice, speed, pitchVal);
        } else {
          isSpeakingRef.current = false;
          stopKeepAlive();
          setSession((prev) =>
            prev && prev.id === sessionId
              ? { ...prev, status: "completed", currentChunkIndex: chunkIndex }
              : prev
          );
        }
      };

      utterance.onerror = (e) => {
        // Discard error caused by deliberate cancel
        if (e.error === "canceled" || e.error === "interrupted") return;
        if (activeSessionIdRef.current !== sessionId) return;

        console.warn("SpeechSynthesis error:", e.error);
        isSpeakingRef.current = false;
        stopKeepAlive();
        setSession((prev) =>
          prev && prev.id === sessionId
            ? { ...prev, status: "error", error: `Speech playback error: ${e.error}` }
            : prev
        );
      };

      window.speechSynthesis.speak(utterance);
    },
    []
  );

  const stopInternal = () => {
    activeSessionIdRef.current = null;
    isSpeakingRef.current = false;
    stopKeepAlive();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  // ─── Track Launcher ───
  const playTrack = useCallback(
    (
      title: string,
      sourceType: AudioSourceType,
      rawText: string,
      options?: { startIndex?: number; sectionHeading?: string }
    ) => {
      stopInternal();

      const chunks = createSpeechChunks(rawText, options?.sectionHeading);
      if (chunks.length === 0) return;

      sessionMetaRef.current = { title, sourceType };

      // Restore saved bookmark if not explicitly provided
      let startIndex = 0;
      if (typeof options?.startIndex === "number" && options.startIndex >= 0 && options.startIndex < chunks.length) {
        startIndex = options.startIndex;
      } else if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(`lamla_audio_bm_${sourceType}_${title}`);
          if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= 0 && parsed < chunks.length) {
              startIndex = parsed;
            }
          }
        } catch {}
      }

      const sessionId = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      activeSessionIdRef.current = sessionId;
      currentChunksRef.current = chunks;
      currentChunkIndexRef.current = startIndex;

      const newSession: AudioSession = {
        id: sessionId,
        title,
        sourceType,
        chunks,
        currentChunkIndex: startIndex,
        status: "loading",
        error: null,
        startedAt: Date.now(),
      };

      setSession(newSession);
      setIsBarVisible(true);
      setIsBarMinimized(false);

      // Start playback
      speakChunkInternal(
        startIndex,
        chunks,
        sessionId,
        selectedVoice,
        playbackSpeed,
        pitch
      );
    },
    [selectedVoice, playbackSpeed, pitch, speakChunkInternal]
  );

  // ─── Read Specific Section ───
  const playSection = useCallback(
    (title: string, sectionHeading: string, sectionContent: string) => {
      const formatted = `Section: ${sectionHeading}.\n\n${sectionContent}`;
      playTrack(
        `${title} — ${sectionHeading}`,
        "section",
        formatted,
        { sectionHeading }
      );
    },
    [playTrack]
  );

  // ─── Read Tutor's Answer ───
  const playTutorAnswer = useCallback(
    (tutorAnswerText: string, title: string = "AI Tutor Response") => {
      playTrack(title, "tutor_answer", tutorAnswerText);
    },
    [playTrack]
  );

  // ─── Read Flashcards ───
  const playFlashcards = useCallback(
    (
      title: string,
      cards: Array<{ front: string; back: string }>,
      options?: { includeAnswers?: boolean }
    ) => {
      if (!cards || cards.length === 0) return;

      const includeAnswers = options?.includeAnswers ?? true;

      // Construct sequential revision text with clear pauses between questions and answers
      const text = cards
        .map((card, idx) => {
          if (includeAnswers) {
            return `Flashcard ${idx + 1}. Question: ${card.front}. ... Recall the answer. ... Answer: ${card.back}.`;
          }
          return `Flashcard ${idx + 1}. Question: ${card.front}.`;
        })
        .join("\n\n");

      playTrack(`${title} (Flashcard Revision)`, "flashcards", text);
    },
    [playTrack]
  );

  // ─── Listen to Drill Questions ───
  const playDrillQuestions = useCallback(
    (
      title: string,
      questions: Array<{
        question_text: string;
        options?: string[] | null;
        correct_answer: string;
        explanation?: string | null;
      }>
    ) => {
      if (!questions || questions.length === 0) return;

      const text = questions
        .map((q, idx) => {
          let segment = `Question ${idx + 1}. ${q.question_text}. `;
          if (q.options && q.options.length > 0) {
            segment += `Options: ${q.options.map((opt, optIdx) => `${String.fromCharCode(65 + optIdx)}: ${opt}`).join(", ")}. `;
          }
          segment += `... Take a moment to think of your answer. ... Correct Answer: ${q.correct_answer}. `;
          if (q.explanation) {
            segment += `Explanation: ${q.explanation}. `;
          }
          return segment;
        })
        .join("\n\n");

      playTrack(`${title} (Hands-Free Drill)`, "drill_questions", text);
    },
    [playTrack]
  );

  // ─── Playback Controls ───
  const pause = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      stopKeepAlive();
      setSession((prev) => (prev ? { ...prev, status: "paused" } : null));
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      startKeepAlive();
      setSession((prev) => (prev ? { ...prev, status: "speaking" } : null));
    }
  }, []);

  const stop = useCallback(() => {
    stopInternal();
    setSession((prev) => (prev ? { ...prev, status: "idle" } : null));
  }, []);

  const seekChunk = useCallback(
    (index: number) => {
      if (!session) return;
      const targetIndex = Math.max(0, Math.min(index, session.chunks.length - 1));
      speakChunkInternal(
        targetIndex,
        session.chunks,
        session.id,
        selectedVoice,
        playbackSpeed,
        pitch
      );
    },
    [session, selectedVoice, playbackSpeed, pitch, speakChunkInternal]
  );

  const nextChunk = useCallback(() => {
    if (!session) return;
    seekChunk(session.currentChunkIndex + 1);
  }, [session, seekChunk]);

  const prevChunk = useCallback(() => {
    if (!session) return;
    seekChunk(session.currentChunkIndex - 1);
  }, [session, seekChunk]);

  const replayChunk = useCallback(() => {
    if (!session) return;
    seekChunk(session.currentChunkIndex);
  }, [session, seekChunk]);

  // ─── Settings Updaters ───
  const setPlaybackSpeed = useCallback(
    (speed: number) => {
      setPlaybackSpeedState(speed);
      try {
        localStorage.setItem(STORAGE_KEY_SPEED, speed.toString());
      } catch {}
      // Restart current chunk with new speed if actively playing
      if (session && session.status === "speaking") {
        seekChunk(session.currentChunkIndex);
      }
    },
    [session, seekChunk]
  );

  const setPitch = useCallback(
    (pitchVal: number) => {
      setPitchState(pitchVal);
      try {
        localStorage.setItem(STORAGE_KEY_PITCH, pitchVal.toString());
      } catch {}
      if (session && session.status === "speaking") {
        seekChunk(session.currentChunkIndex);
      }
    },
    [session, seekChunk]
  );

  const setSelectedVoice = useCallback(
    (voice: VoiceOption) => {
      setSelectedVoiceState(voice);
      try {
        localStorage.setItem(STORAGE_KEY_VOICE, voice.name);
      } catch {}
      if (session && session.status === "speaking") {
        seekChunk(session.currentChunkIndex);
      }
    },
    [session, seekChunk]
  );

  const setHighlightSentence = useCallback((enabled: boolean) => {
    setHighlightSentenceState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY_HIGHLIGHT, enabled.toString());
    } catch {}
  }, []);

  const testVoice = useCallback((voice: VoiceOption) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const sampleText = preprocessEducationalSpeech(
      "Welcome to LAMLA Guide AI. It is never too late to study. Let's master your lecture slides together."
    );
    const u = new SpeechSynthesisUtterance(sampleText);
    u.voice = voice.voice;
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  }, []);

  const restoreDefaults = useCallback(() => {
    const defaultVoice = getDefaultVoice(voices);
    if (defaultVoice) setSelectedVoice(defaultVoice);
    setPlaybackSpeed(1.0);
    setPitch(1.0);
    setHighlightSentence(true);
  }, [voices, setSelectedVoice, setPlaybackSpeed, setPitch, setHighlightSentence]);

  const toggleMinimize = useCallback(() => {
    setIsBarMinimized((prev) => !prev);
  }, []);

  const closePlayer = useCallback(() => {
    stop();
    setIsBarVisible(false);
  }, [stop]);

  const getSavedBookmark = useCallback((title: string, sourceType: AudioSourceType): number | null => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(`lamla_audio_bm_${sourceType}_${title}`);
      if (saved) {
        const val = parseInt(saved, 10);
        return isNaN(val) ? null : val;
      }
    } catch {}
    return null;
  }, []);

  const clearBookmark = useCallback((title: string, sourceType: AudioSourceType) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`lamla_audio_bm_${sourceType}_${title}`);
    } catch {}
  }, []);

  const isPlaying = session?.status === "speaking";
  const isPaused = session?.status === "paused";
  const isLoading = session?.status === "loading";

  return (
    <AudioPlayerContext.Provider
      value={{
        session,
        isPlaying,
        isPaused,
        isLoading,
        voices,
        selectedVoice,
        playbackSpeed,
        pitch,
        highlightSentence,
        isBarVisible,
        isBarMinimized,
        playTrack,
        playSection,
        playTutorAnswer,
        playFlashcards,
        playDrillQuestions,
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
        getSavedBookmark,
        clearBookmark,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  }
  return context;
}
