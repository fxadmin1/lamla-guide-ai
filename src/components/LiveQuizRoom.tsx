"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Timer,
  Users,
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Trophy,
  Eye,
  PenLine,
  Calendar,
  Share2,
  Check,
  Award,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ───────────────────────── Types ───────────────────────── */

interface DraftQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  sourceRef?: string;
}

interface PublicQuestion {
  question: string;
  options: string[];
  sourceRef?: string;
}

interface RoundInfo {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  questions: PublicQuestion[];
  durationSec: number;
  startAt: number;
  endsAt: number;
}

interface LobbyInfo {
  hostId: string;
  hostName: string;
  title: string;
  count: number;
  durationSec: number;
}

export interface ScheduledInfo {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  count: number;
  durationSec: number;
  scheduledStartAt: number;
}

interface ProgressRow {
  userId: string;
  name: string;
  answered: number;
  submitted: boolean;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  score: number;
  total: number;
  answered: number;
  submitted: boolean;
  timeTakenSec?: number;
}

interface AnswerKeyItem {
  correct: number;
  explanation: string;
  sourceRef?: string;
}

export interface QuizHistoryItem {
  id: string;
  title: string;
  questionCount: number;
  durationSec: number;
  completedAt: string;
  participantCount: number;
  results: LeaderboardRow[];
}

export interface GroupStandingRow {
  userId: string;
  name: string;
  quizzesTaken: number;
  totalScore: number;
  totalPossible: number;
  accuracyPct: number;
  wins: number;
  totalXp: number;
}

export interface RoomState {
  circleId: string;
  phase: "idle" | "lobby" | "scheduled" | "running" | "finished";
  serverNow: number;
  lobby: LobbyInfo | null;
  scheduled?: ScheduledInfo | null;
  round: RoundInfo | null;
  online: Array<{ user_id: string; name: string }>;
  progress: ProgressRow[];
  myAnswers: Record<string, number>;
  mySubmitted: boolean;
  results: LeaderboardRow[] | null;
  answerKey: AnswerKeyItem[] | null;
  history: QuizHistoryItem[];
  groupStandings?: GroupStandingRow[];
}

interface LiveQuizRoomProps {
  circleId: string;
  circleName: string;
  user: any;
  profile: any;
  hasAdminPrivilege: boolean;
  sessions: any[];
  onStateSync?: (state: RoomState) => void;
}

/* ───────────────────────── Helpers ───────────────────────── */

const stripLetter = (s: string) => s.replace(/^\s*[A-Da-d][.):\-]\s*/, "").trim();

function normalizeQuestion(q: any): DraftQuestion | null {
  const raw: any[] = Array.isArray(q?.options) ? q.options : [];
  const options = raw
    .map((o) => (typeof o === "string" ? o : o?.text ?? o?.label ?? String(o)))
    .map(stripLetter)
    .filter(Boolean);
  const ca = q?.correctAnswer ?? q?.correct_answer ?? q?.answer;
  let correct = -1;
  if (typeof ca === "number") {
    correct = ca;
  } else if (typeof ca === "string") {
    const t = ca.trim();
    if (/^[A-Da-d]$/.test(t)) {
      correct = t.toUpperCase().charCodeAt(0) - 65;
    } else {
      correct = options.findIndex((o) => o.toLowerCase() === stripLetter(t).toLowerCase());
    }
  }
  if (!q?.question || options.length < 2 || correct < 0 || correct >= options.length) return null;
  return {
    question: String(q.question).trim(),
    options,
    correct,
    explanation: String(q.explanation || "").trim(),
    sourceRef: String(q.sourceRef || q.slide_reference || "").trim(),
  };
}

const formatClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const TIMER_PRESETS = [3, 5, 10, 15, 20, 30, 45];
const QUESTION_COUNT_PRESETS = [5, 10, 15, 20, 30, 40, 50];

/* ───────────────────────── Component ───────────────────────── */

export default function LiveQuizRoom({
  circleId,
  circleName,
  user,
  profile,
  hasAdminPrivilege,
  sessions,
  onStateSync,
}: LiveQuizRoomProps) {
  const userId: string = user?.id || "";
  const myName: string = profile?.full_name || user?.email?.split("@")[0] || "Participant";

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [clockOffset, setClockOffset] = useState(0); // local Date.now() - serverNow
  const [now, setNow] = useState(Date.now());
  const [wsConnected, setWsConnected] = useState(false);

  // Local quiz-taking state — admin participates by default (hostTakesQuiz = true)
  const [localAnswers, setLocalAnswers] = useState<Record<number, number>>({});
  const [localSubmitted, setLocalSubmitted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [hostTakesQuiz, setHostTakesQuiz] = useState(true);

  // Admin quiz builder state
  const [sourceMode, setSourceMode] = useState<"upload" | "session" | "paste">("upload");
  const [sessionId, setSessionId] = useState<string>(sessions[0]?.id || "");
  const [pastedText, setPastedText] = useState("");
  const [uploadedText, setUploadedText] = useState("");
  const [uploadedName, setUploadedName] = useState("");
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(15);
  const [minutes, setMinutes] = useState(10);
  const [draft, setDraft] = useState<DraftQuestion[]>([]);
  const [busy, setBusy] = useState<"" | "upload" | "generate" | "action">("");
  const [error, setError] = useState("");

  // Scheduling state
  const [showScheduleInput, setShowScheduleInput] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [copyLinkDone, setCopyLinkDone] = useState(false);

  const activeRoundIdRef = useRef<string | null>(null);
  const autoSubmitSentRef = useRef<string | null>(null);
  const onStateSyncRef = useRef(onStateSync);
  useEffect(() => {
    onStateSyncRef.current = onStateSync;
  }, [onStateSync]);

  useEffect(() => {
    if (!sessionId && sessions.length > 0) {
      setSessionId(sessions[0].id);
    }
  }, [sessions, sessionId]);

  const applyServerState = useCallback((state: RoomState) => {
    if (!state) return;
    if (typeof state.serverNow === "number") {
      setClockOffset(Date.now() - state.serverNow);
    }
    setRoomState(state);
    onStateSyncRef.current?.(state);

    const incomingRoundId = state.round?.id || null;
    if (incomingRoundId && incomingRoundId !== activeRoundIdRef.current) {
      activeRoundIdRef.current = incomingRoundId;
      setCurrentQ(0);
      setHostTakesQuiz(true); // Host automatically participates in the quiz round
      const restored: Record<number, number> = {};
      Object.entries(state.myAnswers || {}).forEach(([k, v]) => {
        restored[Number(k)] = Number(v);
      });
      setLocalAnswers(restored);
      setLocalSubmitted(Boolean(state.mySubmitted));
    } else if (incomingRoundId) {
      if (state.mySubmitted) setLocalSubmitted(true);
      if (state.myAnswers && Object.keys(state.myAnswers).length > 0) {
        setLocalAnswers((prev) => {
          const merged = { ...prev };
          Object.entries(state.myAnswers).forEach(([k, v]) => {
            if (merged[Number(k)] === undefined) merged[Number(k)] = Number(v);
          });
          return merged;
        });
      }
    } else {
      activeRoundIdRef.current = null;
      setLocalAnswers({});
      setLocalSubmitted(false);
    }
  }, []);

  /* ── Fetch state over HTTP (initial load & fallback) ── */
  const fetchRoomState = useCallback(async () => {
    if (!circleId || !userId) return;
    try {
      const res = await fetch(
        `/api/live-quiz/${encodeURIComponent(circleId)}/state?user_id=${encodeURIComponent(userId)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.state) applyServerState(json.state);
      }
    } catch {
      // Handled silently
    }
  }, [circleId, userId, applyServerState]);

  /* ── Same-Origin WebSocket + Resilient Reconnect ── */
  useEffect(() => {
    if (!circleId || !userId) return;
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    fetchRoomState();

    const connect = () => {
      if (closed || typeof window === "undefined") return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${proto}//${window.location.host}/ws/live-quiz/${encodeURIComponent(
        circleId
      )}?user_id=${encodeURIComponent(userId)}&name=${encodeURIComponent(myName)}`;

      try {
        ws = new WebSocket(wsUrl);
      } catch {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 2500);
        return;
      }

      ws.onopen = () => {
        if (closed) return;
        setWsConnected(true);
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 15000);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "room_state" && msg.state) {
            applyServerState(msg.state);
          } else if (msg.type === "pong" && typeof msg.serverNow === "number") {
            setClockOffset(Date.now() - msg.serverNow);
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (pingTimer) clearInterval(pingTimer);
        if (!closed) {
          reconnectTimer = setTimeout(connect, 2500);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      try {
        ws?.close();
      } catch {}
    };
  }, [circleId, userId, myName, fetchRoomState, applyServerState]);

  /* ── Synchronized Timing Calculations ── */
  const phase = roomState?.phase || "idle";
  const lobby = roomState?.lobby || null;
  const scheduled = roomState?.scheduled || null;
  const round = roomState?.round || null;

  /* ── HTTP fallback polling (relaxed while WebSockets are live) ── */
  useEffect(() => {
    if (!circleId || !userId) return;
    const intervalMs = wsConnected ? 30000 : 2500;
    const t = setInterval(fetchRoomState, intervalMs);
    return () => clearInterval(t);
  }, [circleId, userId, wsConnected, fetchRoomState]);

  /* ── High-efficiency clock tick (1000ms, only when timer active) ── */
  useEffect(() => {
    const isCounting = phase === "running" || phase === "scheduled";
    if (!isCounting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const startLocal = round ? round.startAt + clockOffset : 0;
  const endLocal = round ? round.endsAt + clockOffset : 0;
  const countdownLeft = round ? (startLocal - now) / 1000 : 0;
  const timeLeft = round ? (endLocal - now) / 1000 : 0;
  const inCountdown = phase === "running" && countdownLeft > 0;
  const timerExpired = phase === "running" && !inCountdown && timeLeft <= 0;

  // Scheduled countdown
  const scheduledStartLocal = scheduled ? scheduled.scheduledStartAt + clockOffset : 0;
  const scheduledSecLeft = scheduled ? (scheduledStartLocal - now) / 1000 : 0;

  /* ── Send Answer / Submit to Unified Python Server ── */
  const pushAnswersToServer = useCallback(
    async (nextAnswers: Record<number, number>, submitFinal: boolean) => {
      if (!circleId || !userId) return;
      try {
        const res = await fetch(`/api/live-quiz/${encodeURIComponent(circleId)}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            name: myName,
            answers: nextAnswers,
            submitted: submitFinal,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.state) applyServerState(json.state);
        }
      } catch {}
    },
    [circleId, userId, myName, applyServerState]
  );

  // Auto-submit participant's answers when timer hits 00:00 (everyone is auto-marked)
  useEffect(() => {
    if (
      phase === "running" &&
      round &&
      timerExpired &&
      !localSubmitted &&
      autoSubmitSentRef.current !== round.id
    ) {
      autoSubmitSentRef.current = round.id;
      setLocalSubmitted(true);
      pushAnswersToServer(localAnswers, true);
    }
  }, [phase, round, timerExpired, localSubmitted, localAnswers, pushAnswersToServer]);

  const pickOption = (qIdx: number, optIdx: number) => {
    if (localSubmitted || inCountdown || timerExpired || !round) return;
    const updated = { ...localAnswers, [qIdx]: optIdx };
    setLocalAnswers(updated);
    pushAnswersToServer(updated, false);
  };

  const handleManualSubmit = () => {
    if (localSubmitted || !round) return;
    const answeredCount = Object.keys(localAnswers).length;
    if (
      answeredCount < round.questions.length &&
      !window.confirm(
        `You have answered ${answeredCount} of ${round.questions.length} questions. Submit your quiz now?`
      )
    ) {
      return;
    }
    setLocalSubmitted(true);
    pushAnswersToServer(localAnswers, true);
  };

  /* ── Admin: Upload Slide & Generate Quiz ── */
  const handleSlideUpload = async (file: File | null) => {
    if (!file) return;
    setError("");
    setBusy("upload");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || "";
      let extracted = "";
      let derivedTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

      if (token) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/documents/extract", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const json = await res.json();
        if (res.ok && json.text) {
          extracted = json.text;
          derivedTitle = json.title || derivedTitle;
        }
      }

      if (!extracted) {
        const pyFd = new FormData();
        pyFd.append("file", file);
        const pyRes = await fetch("/api/upload-and-parse", { method: "POST", body: pyFd });
        const pyJson = await pyRes.json();
        if (!pyRes.ok || !pyJson?.data?.full_text) {
          throw new Error(pyJson?.detail || "Could not extract text from that file.");
        }
        extracted = pyJson.data.full_text;
      }

      setUploadedText(extracted);
      setUploadedName(file.name);
      if (!title.trim()) setTitle(derivedTitle);

      // Auto-suggest up to 50 questions covering every single slide
      const slideMatches = (extracted.match(/--- Slide \d+:/gi) || []).length;
      if (slideMatches > 0) {
        setCount(Math.min(50, Math.max(10, slideMatches)));
      }
    } catch (e: any) {
      setError(e?.message || "Failed to read slide file.");
    } finally {
      setBusy("");
    }
  };

  const getSelectedMaterialText = () => {
    if (sourceMode === "upload") return uploadedText;
    if (sourceMode === "session") return sessions.find((s) => s.id === sessionId)?.extracted_text || "";
    return pastedText;
  };

  const handleGenerateQuestions = async () => {
    setError("");
    const text = getSelectedMaterialText();
    if (text.trim().length < 50) {
      setError("Upload a slide deck/document, select a study session, or paste lecture notes first.");
      return;
    }
    setBusy("generate");
    try {
      // Send the entire text without truncating at 35,000 characters so every slide is represented
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quiz",
          content: text,
          options: {
            count: Math.min(50, Math.max(3, count)),
            type: "mcq",
            difficulty: "intermediate",
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate quiz questions.");
      const normalized = (json.questions || []).map(normalizeQuestion).filter(Boolean) as DraftQuestion[];
      if (normalized.length === 0) {
        throw new Error("Could not build questions from this material. Please try again.");
      }
      setDraft(normalized);
      if (!title.trim()) {
        const fallbackTitle =
          sourceMode === "session"
            ? sessions.find((s) => s.id === sessionId)?.title
            : uploadedName.replace(/\.[^/.]+$/, "");
        setTitle(fallbackTitle || "Live Class Quiz");
      }
    } catch (e: any) {
      setError(e?.message || "Question generation failed.");
    } finally {
      setBusy("");
    }
  };

  const handleOpenLobby = async () => {
    if (draft.length === 0) return;
    setError("");
    setBusy("action");
    try {
      const res = await fetch(`/api/live-quiz/${encodeURIComponent(circleId)}/lobby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          host_name: myName,
          title: title.trim() || "Live Session Quiz",
          duration_sec: Math.max(1, minutes) * 60,
          questions: draft,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Could not open lobby.");
      applyServerState(json.state);
    } catch (e: any) {
      setError(e?.message || "Could not open lobby.");
    } finally {
      setBusy("");
    }
  };

  const handleScheduleQuizSubmit = async () => {
    if (draft.length === 0 || !scheduleDate) return;
    const epochMs = Date.parse(scheduleDate);
    if (isNaN(epochMs) || epochMs < Date.now() + 5000) {
      setError("Please pick a future start date and time for this quiz.");
      return;
    }
    setError("");
    setBusy("action");
    try {
      const res = await fetch(`/api/live-quiz/${encodeURIComponent(circleId)}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          host_name: myName,
          title: title.trim() || "Scheduled Class Quiz",
          duration_sec: Math.max(1, minutes) * 60,
          scheduled_start_at: epochMs,
          questions: draft,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Could not schedule quiz.");
      setShowScheduleInput(false);
      applyServerState(json.state);
    } catch (e: any) {
      setError(e?.message || "Could not schedule quiz.");
    } finally {
      setBusy("");
    }
  };

  const handleHostAction = async (endpoint: "start" | "end" | "reset") => {
    setError("");
    setBusy("action");
    try {
      const res = await fetch(`/api/live-quiz/${encodeURIComponent(circleId)}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || `Failed to ${endpoint} quiz.`);
      if (endpoint === "reset") {
        setDraft([]);
      }
      applyServerState(json.state);
    } catch (e: any) {
      setError(e?.message || "Action failed.");
    } finally {
      setBusy("");
    }
  };

  const onlineMembers = useMemo(() => roomState?.online || [], [roomState?.online]);
  const results = roomState?.results || null;
  const answerKey = roomState?.answerKey || null;
  const myResult = results?.find((r) => r.userId === userId);
  const groupStandings = roomState?.groupStandings || [];

  const copyShareLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/dashboard?join=${encodeURIComponent(circleId)}`;
    navigator.clipboard.writeText(url);
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  };

  if (!userId) {
    return (
      <div className="py-12 text-center text-sm text-slate-600 dark:text-slate-400">
        Sign in to join synchronized live quizzes with your study group.
      </div>
    );
  }

  /* ───────────────────────── Shared Styles ───────────────────────── */

  const box = "border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-900";
  const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";
  const inputCls =
    "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600";
  const primaryBtn =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer";
  const secondaryBtn =
    "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer";

  const presenceBadge = (
    <div className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">
      <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
      <span>
        {onlineMembers.length || 1} online in <strong>{circleName}</strong>
      </span>
    </div>
  );

  /* ───────────────────────── PHASE 1: IDLE ───────────────────────── */
  if (phase === "idle") {
    if (!hasAdminPrivilege) {
      return (
        <div className="py-12 px-4 text-center space-y-3 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40">
          <Timer className="w-8 h-8 mx-auto text-slate-400" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Waiting for the Group Admin to Start or Schedule a Live Quiz
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Stay on this page. As soon as the admin opens the quiz lobby or the scheduled start time arrives, your screen will sync automatically so everyone takes the quiz together.
          </p>
          <div className="pt-2 flex justify-center">{presenceBadge}</div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Set Up a Live or Scheduled Class Quiz
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Upload a slide deck (up to 50 questions covering every single slide) and set a timer. You participate automatically alongside your students!
            </p>
          </div>
          {presenceBadge}
        </div>

        {draft.length === 0 ? (
          <div className={`${box} space-y-5`}>
            {/* 1. Material Selection */}
            <div>
              <span className={labelCls}>1. Select Slide or Lecture Material</span>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(
                  [
                    ["upload", "Upload Slide / File"],
                    ["session", "From Study Sessions"],
                    ["paste", "Paste Notes"],
                  ] as const
                ).map(([id, text]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSourceMode(id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      sourceMode === id
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>

              {sourceMode === "upload" && (
                <label className="flex items-center justify-between gap-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-4 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3 text-sm">
                    {busy === "upload" ? (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                    ) : (
                      <Upload className="w-5 h-5 text-slate-500 shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {busy === "upload"
                          ? "Extracting slide content..."
                          : uploadedName
                          ? `${uploadedName} (ready — click to change)`
                          : "Click to upload a slide deck or document"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Supports PowerPoint (.pptx), PDF (.pdf), Word (.docx), or plain text (up to 1 GB)
                      </p>
                    </div>
                  </div>
                  {uploadedText && (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded">
                      Loaded
                    </span>
                  )}
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.pptx,.docx,.txt,.md,image/*"
                    onChange={(e) => handleSlideUpload(e.target.files?.[0] || null)}
                  />
                </label>
              )}

              {sourceMode === "session" &&
                (sessions.length > 0 ? (
                  <select
                    className={inputCls}
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    aria-label="Choose a study session"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title || "Untitled Study Session"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-500">
                    No saved study sessions yet. Switch to &ldquo;Upload Slide / File&rdquo; above to upload directly.
                  </p>
                ))}

              {sourceMode === "paste" && (
                <textarea
                  className={`${inputCls} min-h-[130px]`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste the slide text or topic notes for this class quiz..."
                />
              )}
            </div>

            {/* 2. Quiz Title, Count (up to 50) & Timer */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls} htmlFor="lq-title">
                  2. Quiz Title
                </label>
                <input
                  id="lq-title"
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lecture 4 Class Quiz"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="lq-count">
                  3. Questions (Max 50)
                </label>
                <input
                  id="lq-count"
                  type="number"
                  min={3}
                  max={50}
                  className={inputCls}
                  value={count}
                  onChange={(e) => setCount(Math.min(50, Math.max(3, Number(e.target.value) || 10)))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="lq-minutes">
                  4. Countdown Timer (Minutes)
                </label>
                <input
                  id="lq-minutes"
                  type="number"
                  min={1}
                  max={180}
                  className={inputCls}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.min(180, Math.max(1, Number(e.target.value) || 10)))}
                />
              </div>
            </div>

            {/* Question Count Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Quick question count:</span>
              {QUESTION_COUNT_PRESETS.map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setCount(cnt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${
                    count === cnt
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {cnt} Qs
                </button>
              ))}
            </div>

            {/* Quick Timer Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Quick timer:</span>
              {TIMER_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${
                    minutes === m
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="button"
              className={primaryBtn}
              onClick={handleGenerateQuestions}
              disabled={busy !== ""}
            >
              {busy === "generate" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating {count} Unique Slide Questions...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Prepare Live Class Quiz ({count} Qs)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`${box} flex items-center justify-between gap-3 flex-wrap`}>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {title || "Live Group Quiz"}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {draft.length} questions · {minutes} minute timer · Review questions below before launching.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" className={secondaryBtn} onClick={() => setDraft([])}>
                  Change Material
                </button>
                <button
                  type="button"
                  className={secondaryBtn}
                  onClick={() => setShowScheduleInput((v) => !v)}
                >
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Schedule for Later</span>
                </button>
                <button
                  type="button"
                  className={primaryBtn}
                  onClick={handleOpenLobby}
                  disabled={busy === "action"}
                >
                  {busy === "action" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  <span>Open Lobby for Class</span>
                </button>
              </div>
            </div>

            {/* Schedule picker drawer */}
            {showScheduleInput && (
              <div className={`${box} space-y-3 bg-blue-50/40 border-blue-200`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-900">
                    Schedule Quiz Start Time
                  </span>
                  <span className="text-xs text-slate-500">
                    Students will see a live countdown and quiz will start automatically
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleScheduleQuizSubmit}
                    disabled={!scheduleDate || busy === "action"}
                    className={primaryBtn}
                  >
                    Confirm Schedule
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <ol className="space-y-3">
              {draft.map((q, i) => (
                <li key={i} className={box}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {i + 1}. {q.question}
                    </p>
                    {draft.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDraft(draft.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-red-600 shrink-0 cursor-pointer"
                        title="Remove question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {q.sourceRef && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 block">
                      {q.sourceRef}
                    </span>
                  )}
                  <ul className="mt-2.5 space-y-1 text-sm">
                    {q.options.map((opt, oi) => (
                      <li
                        key={oi}
                        className={
                          oi === q.correct
                            ? "text-emerald-700 dark:text-emerald-400 font-medium"
                            : "text-slate-600 dark:text-slate-400"
                        }
                      >
                        {String.fromCharCode(65 + oi)}. {opt}
                        {oi === q.correct ? " ✓" : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }

  /* ───────────────────────── PHASE: SCHEDULED ───────────────────────── */
  if (phase === "scheduled" && scheduled) {
    const canControl = hasAdminPrivilege;
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className={`${box} text-center space-y-3`}>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 px-3 py-1 rounded-full">
            <Calendar className="w-3.5 h-3.5" />
            <span>Scheduled Class Quiz</span>
          </div>

          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {scheduled.title}
          </h3>

          <p className="text-sm text-slate-600 dark:text-slate-400">
            {scheduled.count} questions · {Math.round(scheduled.durationSec / 60)} minute timer · Hosted by {scheduled.hostName}
          </p>

          {/* Live Countdown */}
          <div className="py-4">
            <span className="text-xs text-slate-500 block mb-1">Starts automatically in:</span>
            <div className="text-4xl sm:text-5xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {formatClock(scheduledSecLeft)}
            </div>
            <span className="text-xs text-slate-500 mt-2 block">
              Scheduled start: {new Date(scheduled.scheduledStartAt).toLocaleString()}
            </span>
          </div>

          <div className="pt-2 flex justify-center gap-2">
            <button
              type="button"
              onClick={copyShareLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copyLinkDone ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copyLinkDone ? "Link copied" : "Share class link"}</span>
            </button>
          </div>
        </div>

        <div className={box}>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Classmates Waiting in Room ({onlineMembers.length || 1})</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onlineMembers.length === 0 ? (
              <span className="text-sm text-slate-500">{myName} (you)</span>
            ) : (
              onlineMembers.map((m) => (
                <span
                  key={m.user_id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {m.name}
                  {m.user_id === userId ? " (you)" : ""}
                </span>
              ))
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {canControl && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              className={primaryBtn}
              onClick={() => handleHostAction("start")}
              disabled={busy === "action"}
            >
              {busy === "action" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>Start Quiz Immediately</span>
            </button>
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => handleHostAction("reset")}
              disabled={busy === "action"}
            >
              Cancel Schedule
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ───────────────────────── PHASE 2: LOBBY ───────────────────────── */
  if (phase === "lobby" && lobby) {
    const canControl = hasAdminPrivilege;
    return (
      <div className="space-y-4 max-w-2xl">
        <div className={box}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Live Quiz Lobby — Ready to Sync
            </span>
            {presenceBadge}
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-2">
            {lobby.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {lobby.count} questions · {Math.round(lobby.durationSec / 60)} minute timer · Hosted by{" "}
            {lobby.hostId === userId ? "you" : lobby.hostName}
          </p>
        </div>

        <div className={box}>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Participants Connected ({onlineMembers.length || 1})</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onlineMembers.length === 0 ? (
              <span className="text-sm text-slate-500">{myName} (you)</span>
            ) : (
              onlineMembers.map((m) => (
                <span
                  key={m.user_id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {m.name}
                  {m.user_id === userId ? " (you)" : ""}
                </span>
              ))
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {canControl ? (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              className={primaryBtn}
              onClick={() => handleHostAction("start")}
              disabled={busy === "action"}
            >
              {busy === "action" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>Start Quiz Now for Everyone</span>
            </button>
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => handleHostAction("reset")}
              disabled={busy === "action"}
            >
              Cancel Lobby
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
            Get ready — the quiz will launch automatically on your screen the moment {lobby.hostName} presses Start.
          </p>
        )}
      </div>
    );
  }

  /* ───────────────────────── PHASE 3: RUNNING ───────────────────────── */
  if (phase === "running" && round) {
    if (inCountdown) {
      return (
        <div className={`${box} py-16 text-center space-y-2`} aria-live="assertive">
          <p className="text-sm font-medium text-slate-500">All participants starting together in</p>
          <p className="text-6xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
            {Math.max(1, Math.ceil(countdownLeft))}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 pt-1">{round.title}</p>
        </div>
      );
    }

    const showMonitor = hasAdminPrivilege && !hostTakesQuiz;

    const adminModeBar = hasAdminPrivilege ? (
      <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setHostTakesQuiz(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              hostTakesQuiz
                ? "bg-white dark:bg-slate-800 text-blue-600 shadow-2xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Answer Quiz Questions</span>
          </button>
          <button
            type="button"
            onClick={() => setHostTakesQuiz(false)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              !hostTakesQuiz
                ? "bg-white dark:bg-slate-800 text-blue-600 shadow-2xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Monitor Class ({roomState?.progress.length || 0})</span>
          </button>
        </div>

        <button
          type="button"
          className={secondaryBtn}
          onClick={() => handleHostAction("end")}
          disabled={busy === "action"}
        >
          <Square className="w-3.5 h-3.5 text-red-600" />
          <span>End Quiz &amp; Grade Everyone</span>
        </button>
      </div>
    ) : null;

    if (showMonitor) {
      const progressMap = new Map((roomState?.progress || []).map((p) => [p.userId, p]));
      const participantRows = onlineMembers.map((m) => ({
        userId: m.user_id,
        name: m.name,
        answered: progressMap.get(m.user_id)?.answered || 0,
        submitted: progressMap.get(m.user_id)?.submitted || false,
      }));
      (roomState?.progress || []).forEach((p) => {
        if (!participantRows.some((r) => r.userId === p.userId)) {
          participantRows.push(p);
        }
      });

      return (
        <div className="space-y-4">
          {adminModeBar}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{round.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Live synchronized timer · {round.questions.length} questions
              </p>
            </div>
            <div
              className={`text-3xl font-bold tabular-nums px-3.5 py-1.5 rounded-xl border ${
                timeLeft < 60
                  ? "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900"
                  : "text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
              }`}
              role="timer"
            >
              {formatClock(timeLeft)}
            </div>
          </div>

          <div className={box}>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
              Live Participant Progress ({participantRows.length})
            </p>
            {participantRows.length === 0 ? (
              <p className="text-sm text-slate-500">Waiting for participants to answer...</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {participantRows.map((p) => (
                  <li key={p.userId} className="py-2.5 flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {p.name}
                      {p.userId === userId ? " (you)" : ""}
                    </span>
                    <span
                      className={
                        p.submitted
                          ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                          : "text-slate-600 dark:text-slate-400"
                      }
                    >
                      {p.submitted ? "Submitted ✓" : `${p.answered} / ${round.questions.length} answered`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      );
    }

    const q = round.questions[currentQ] || round.questions[0];
    const answeredCount = Object.keys(localAnswers).length;

    if (localSubmitted) {
      return (
        <div className="space-y-4">
          {adminModeBar}
          <div className={`${box} py-12 text-center space-y-2`} aria-live="polite">
            <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Your Answers Are Locked In
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your personalized graded scorecard and explanations will appear automatically as soon as the timer ends ({formatClock(timeLeft)} remaining) or everyone submits.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5 max-w-3xl">
        {adminModeBar}

        <div className="flex items-center justify-between gap-3 sticky top-0 bg-white/95 dark:bg-slate-900/95 py-2.5 z-10 border-b border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium text-slate-500">{round.title}</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Question {currentQ + 1} of {round.questions.length} · {answeredCount} answered
            </p>
          </div>
          <div
            className={`text-2xl font-bold tabular-nums px-3 py-1 rounded-lg border ${
              timeLeft < 60
                ? "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/40"
                : "text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700"
            }`}
            role="timer"
          >
            {formatClock(timeLeft)}
          </div>
        </div>

        <div className={box}>
          <p className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
            {currentQ + 1}. {q.question}
          </p>
          {q.sourceRef && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 block">
              {q.sourceRef}
            </span>
          )}
          <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="Answer choices">
            {q.options.map((opt, oi) => {
              const selected = localAnswers[currentQ] === oi;
              return (
                <button
                  key={oi}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => pickOption(currentQ, oi)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm sm:text-base transition-colors cursor-pointer ${
                    selected
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-slate-900 dark:text-slate-100 font-medium"
                      : "border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
              disabled={currentQ === 0}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => setCurrentQ(Math.min(round.questions.length - 1, currentQ + 1))}
              disabled={currentQ === round.questions.length - 1}
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button type="button" className={primaryBtn} onClick={handleManualSubmit}>
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit Quiz</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Jump to question">
          {round.questions.map((_, i) => {
            const answered = localAnswers[i] !== undefined;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentQ(i)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold border cursor-pointer ${
                  i === currentQ
                    ? "border-blue-600 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600"
                    : answered
                    ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                    : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ───────────────────────── PHASE 4: FINISHED ───────────────────────── */
  if (phase === "finished" && results) {
    const pct = (r: LeaderboardRow) => (r.total ? Math.round((r.score / r.total) * 100) : 0);

    return (
      <div className="space-y-6 max-w-3xl">
        {/* Header & Restart Button */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>{round?.title || "Live Quiz"} — Results &amp; Review</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Every participant is graded independently. Earned XP is synced to your global profile.
            </p>
          </div>
          {hasAdminPrivilege && (
            <button
              type="button"
              className={primaryBtn}
              onClick={() => handleHostAction("reset")}
              disabled={busy === "action"}
            >
              Start Another Live Quiz
            </button>
          )}
        </div>

        {/* Individual Scorecard Banner */}
        {myResult && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-200 text-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                Your Individual Result
              </span>
              <div className="text-2xl font-bold flex items-baseline gap-2">
                <span>{myResult.score} / {myResult.total}</span>
                <span className="text-base font-medium text-slate-600">({pct(myResult)}%)</span>
              </div>
              <p className="text-xs text-slate-600">
                {myResult.submitted
                  ? "Answers submitted successfully."
                  : "Auto-marked on timer expiration."}
              </p>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-bold shrink-0 text-center">
              +{myResult.score * 2 + (pct(myResult) >= 70 ? 10 : 0)} XP Earned
            </div>
          </div>
        )}

        {/* Round Leaderboard */}
        <div className={box}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Round Standings ({results.length} {results.length === 1 ? "student" : "students"})</span>
          </p>
          {results.length === 0 ? (
            <p className="text-sm text-slate-500">No answers were submitted in this round.</p>
          ) : (
            <ol className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {results.map((r, idx) => (
                <li
                  key={r.userId}
                  className={`py-2.5 flex items-center justify-between gap-3 ${
                    r.userId === userId ? "font-semibold text-blue-700 dark:text-blue-300" : ""
                  }`}
                >
                  <span>
                    {idx === 0 ? "🥇 " : idx === 1 ? "🥈 " : idx === 2 ? "🥉 " : `${idx + 1}. `}
                    {r.name}
                    {r.userId === userId ? " (you)" : ""}
                  </span>
                  <span className="tabular-nums text-slate-700 dark:text-slate-300">
                    {r.score} / {r.total} ({pct(r)}%)
                    {typeof r.timeTakenSec === "number" ? ` · ${r.timeTakenSec}s` : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Cumulative Group Standings */}
        {groupStandings.length > 0 && (
          <div className={box}>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600" />
              <span>Cumulative Class Standings (All Live Quizzes)</span>
            </p>
            <ol className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {groupStandings.slice(0, 10).map((s, idx) => (
                <li
                  key={s.userId}
                  className={`py-2 flex items-center justify-between gap-2 text-xs sm:text-sm ${
                    s.userId === userId ? "font-semibold text-blue-700 dark:text-blue-300" : ""
                  }`}
                >
                  <span>
                    {idx + 1}. {s.name} {s.userId === userId ? "(you)" : ""}
                  </span>
                  <span className="tabular-nums text-slate-600 dark:text-slate-400">
                    {s.quizzesTaken} quizzes · {s.accuracyPct}% accuracy · +{s.totalXp} XP
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Independent Answer Key & Explanations */}
        {answerKey && round && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Individual Question Review &amp; Explanations
            </h4>
            {round.questions.map((q, i) => {
              const keyItem = answerKey[i];
              if (!keyItem) return null;
              const picked = localAnswers[i];
              const hadAnswer = picked !== undefined;
              const isCorrect = picked === keyItem.correct;

              return (
                <div key={i} className={box}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-start gap-2">
                      {isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <span>
                        {i + 1}. {q.question}
                      </span>
                    </p>
                    {keyItem.sourceRef && (
                      <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded shrink-0">
                        {keyItem.sourceRef}
                      </span>
                    )}
                  </div>

                  <p className="text-sm mt-2 text-emerald-700 dark:text-emerald-400 font-medium">
                    Correct Answer: {String.fromCharCode(65 + keyItem.correct)}.{" "}
                    {q.options[keyItem.correct]}
                  </p>

                  {!isCorrect && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
                      {hadAnswer
                        ? `Your Answer: ${String.fromCharCode(65 + picked)}. ${q.options[picked]}`
                        : "You did not select an answer in time."}
                    </p>
                  )}

                  {keyItem.explanation && (
                    <p className="text-sm mt-1.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                      {keyItem.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}
