"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  UploadCloud, 
  FileText, 
  HelpCircle, 
  Timer, 
  BrainCircuit, 
  TrendingUp, 
  Zap, 
  BookOpen, 
  Layers, 
  Award, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ExternalLink, 
  ChevronRight, 
  ShieldCheck, 
  Search, 
  Sparkles, 
  Lock, 
  LogOut, 
  Settings, 
  Send, 
  Trash2, 
  Play, 
  RotateCcw, 
  ArrowLeft, 
  Check, 
  Eye, 
  ListFilter,
  GraduationCap,
  Calendar,
  FileCheck,
  ChevronLeft,
  Info,
  Trophy,
  Medal,
  MessageSquare,
  Flame,
  Flag,
  CheckSquare,
  BarChart2,
  Filter,
  CheckCircle,
  XCircle,
  Pause,
  RefreshCw,
  Compass,
  Headphones,
  Volume2,
  Mic,
  MicOff,
  VolumeX,
  Settings2,
  Sun,
  Moon,
  Users,
  Target,
  LayoutDashboard,
  Home,
  Download,
  Tv,
  Bell,
  QrCode,
  X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { APP_CONFIG } from "@/lib/constants";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { parseDocumentSlides, SlideSegment } from "@/lib/utils";
import { tryFastClientExtraction } from "@/lib/fastClientExtractor";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import StudyContentRenderer from "@/components/StudyContentRenderer";
import SourceGroundedNotesWorkspace from "@/components/SourceGroundedNotesWorkspace";
import EducationalVideoCuration from "@/components/EducationalVideoCuration";
import { StudyRoutinesWorkspace } from "@/components/StudyRoutinesWorkspace";
import ExamTrackerWorkspace from "@/components/ExamTrackerWorkspace";
import ClassCirclesWorkspace from "@/components/ClassCirclesWorkspace";
import { DashboardStudyTimerBadge } from "@/components/DashboardStudyTimerBadge";
import SettingsModal from "@/components/SettingsModal";
import ExplainThreeWaysModal from "@/components/ExplainThreeWaysModal";
import ActiveRecallCoachModal from "@/components/ActiveRecallCoachModal";
import UpgradePaywallModal from "@/components/UpgradePaywallModal";
import WhatsAppPaymentModal from "@/components/WhatsAppPaymentModal";
import VisualMarkdown from "@/components/VisualMarkdown";
import { requestBrowserNotificationPermission, triggerStudyNotification } from "@/lib/studyScheduler";

type StudyMode = "summarize" | "flashcards" | "quiz";
type SessionTab = 
  | "overview" 
  | "materials" 
  | "summary" 
  | "notes"
  | "smart_drill" 
  | "tutor" 
  | "flashcards" 
  | "quizzes" 
  | "notebook" 
  | "progress";

async function getAiFetchHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {}
  return headers;
}

export default function StudentDashboardPage() {
  // Authentication & Profile State
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);

  // All Sessions Library State
  const [sessions, setSessions] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [studyNotes, setStudyNotes] = useState<any[]>([]); // holds notes, teach_zero & explanations
  const [flashcardDecks, setFlashcardDecks] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<any[]>([]);

  // Active Isolated Study Session (null = Library Overview)
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<SessionTab>("overview");
  // Top-Level Scope Switcher for Independent Platforms & Cross-Session Tools
  const [dashboardScope, setDashboardScope] = useState<"home" | "sessions" | "groups" | "exam_tracker" | "planner" | "leaderboard">("home");

  // Global Audio Player Hook for Educational Text-to-Speech
  const { playTutorAnswer, playFlashcards, playDrillQuestions, playTrack, stop } = useAudioPlayer();

  // ─── INTERACTIVE PERSONAL AI TUTOR STATE ───
  const [tutorMessages, setTutorMessages] = useState<Array<{ role: "user" | "assistant"; content: string; actionType?: string }>>([
    {
      role: "assistant",
      content: "Hello! I am your 24/7 Personal AI Tutor. I can explain your lecture slides, answer any general questions beyond the slides, research deeper concepts from the internet, and draw labeled concept diagrams.\n\nAsk me anything, or tap any prompt chip below!",
    }
  ]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);

  // ─── STAGE 3: SOCRATIC TUTOR MULTI-MODAL STATE (INDEPENDENT SETTINGS) ───
  const speechRec = useSpeechRecognition();
  const [tutorInputMode, setTutorInputMode] = useState<"both" | "text" | "voice">("both");
  const [tutorResponseMode, setTutorResponseMode] = useState<"both" | "written" | "spoken">("both");
  const [tutorTeachingMode, setTutorTeachingMode] = useState<"socratic" | "guided_hints" | "step_by_step" | "direct">("socratic");
  const [showTutorSettings, setShowTutorSettings] = useState(false);

  // Sync recognized voice transcription into tutorInput
  useEffect(() => {
    if (speechRec.transcript) {
      setTutorInput(speechRec.transcript);
    }
  }, [speechRec.transcript]);

  // Socratic AI Conversation Smart Scroll Tracking
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const userScrolledUpRef = React.useRef(false);

  // Auto-scroll chat to latest question/answer unless student scrolled up to read previous messages
  useEffect(() => {
    if (!userScrolledUpRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [tutorMessages, tutorLoading]);

  const handleMessagesScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
    userScrolledUpRef.current = !isNearBottom;
  };

  // ─── SMART STUDY: EXHAUSTIVE NON-STOP SLIDE DRILL STATE ───
  const [drillIndex, setDrillIndex] = useState(0);
  const [drillSelected, setDrillSelected] = useState<string | null>(null);
  const [drillStreak, setDrillStreak] = useState(0);
  const [drillAnsweredMap, setDrillAnsweredMap] = useState<Record<number, { selected: string; isCorrect: boolean }>>({});
  const [drillFlaggedMap, setDrillFlaggedMap] = useState<Record<number, boolean>>({});
  const [drillGeneratingMore, setDrillGeneratingMore] = useState(false);
  const [drillContinuousRunning, setDrillContinuousRunning] = useState(false);
  const [drillContinuousProgress, setDrillContinuousProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [drillFilter, setDrillFilter] = useState<"all" | "mastered" | "needs_review">("all");
  const [drillPracticeMode, setDrillPracticeMode] = useState<"rapid" | "exam_simulation">("rapid");
  const [drillAudioInteractive, setDrillAudioInteractive] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examScoreReport, setExamScoreReport] = useState<{ score: number; total: number; percentage: number; passed: boolean } | null>(null);
  const [drillExhausted, setDrillExhausted] = useState(false);
  const [drillExhaustionReport, setDrillExhaustionReport] = useState<{
    totalQuestions: number;
    coveredFacts: number;
    totalSlides: number;
    isTrueExhaustion: boolean;
    reason: string;
  } | null>(null);
  const [slideSearchQuery, setSlideSearchQuery] = useState("");
  const [slideViewMode, setSlideViewMode] = useState<"deck" | "document">("deck");

  // 1-Click Theme Switcher State
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [pwaPromptEvent, setPwaPromptEvent] = useState<any>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("lamla_theme") === "dark";
      setCurrentTheme(isDark ? "dark" : "light");

      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone === true;

      const handleBeforeInstall = (e: any) => {
        e.preventDefault();
        setPwaPromptEvent(e);
        setCanInstallPwa(!isStandalone);
      };

      const handleInstalled = () => {
        setCanInstallPwa(false);
        setPwaPromptEvent(null);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      window.addEventListener("appinstalled", handleInstalled);

      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = (params.get("join") || "").trim().toUpperCase();
      let effectiveCode = codeFromUrl;
      if (!effectiveCode) {
        try {
          effectiveCode = (localStorage.getItem("lamla_pending_join_code") || "").trim().toUpperCase();
        } catch {}
      }

      if (effectiveCode) {
        setPendingJoinCode(effectiveCode);
        setDashboardScope("groups");
        setActiveSession(null);
        try {
          localStorage.removeItem("lamla_pending_join_code");
        } catch {}
        if (codeFromUrl && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        const urlScope = params.get("scope");
        if (urlScope && ["groups", "planner", "exam_tracker", "leaderboard"].includes(urlScope)) {
          setDashboardScope(urlScope as any);
        }
      }

      try {
        if (
          localStorage.getItem("lamla_prompt_notifications") === "1" &&
          "Notification" in window &&
          Notification.permission === "default"
        ) {
          setShowNotifBanner(true);
        }
      } catch {}

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("appinstalled", handleInstalled);
      };
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    setCurrentTheme(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("lamla_theme", nextTheme);
      if (nextTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  // Window Visibility & Session Timer Fairness (Stops accumulating when user leaves browser)
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  // New Session Modal State
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<any | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<StudyMode>("summarize");
  const [sessionTitle, setSessionTitle] = useState("");
  const [materialsText, setMaterialsText] = useState("");
  const [initialQuizCount, setInitialQuizCount] = useState(5);
  const [initialQuizType, setInitialQuizType] = useState<
    "mcq" | "multiple_select" | "true_false" | "short_answer" | "assertion_reasoning" | "matching" | "fill_in_the_blank" | "application" | "mixed"
  >("mcq");
  const [initialQuizDifficulty, setInitialQuizDifficulty] = useState("intermediate");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [extractedFileName, setExtractedFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");

  // User Subscription Plan & Quota Tracking (Basic: 5, Standard: 25, Premium: UNLIMITED, Admin: UNLIMITED)
  const userRole = profile?.role || user?.user_metadata?.role || "student";
  const currentPlan = profile?.plan_id || "Free";
  const isAdmin = userRole === "admin";
  const isFreePlan = false;
  const isStandardPlan = true;
  const isPremiumPlan = true;
  const isUnlimitedPlan = true;
  const planLimit = 999999;
  const isQuotaReached = false;
  const canAccessFlashcards = true;
  const maxQuestionsAllowed = 200;

  // Generate Additional Resource Loading State (for active session)
  const [generatingResource, setGeneratingResource] = useState<string | null>(null);

  // New Quiz Modal (for active session)
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizQuestionCount, setQuizQuestionCount] = useState(5);
  const [quizQuestionType, setQuizQuestionType] = useState<
    "mcq" | "multiple_select" | "true_false" | "short_answer" | "assertion_reasoning" | "matching" | "fill_in_the_blank" | "application" | "mixed"
  >("mcq");
  const [quizDifficulty, setQuizDifficulty] = useState("intermediate");
  const [quizRevealMode, setQuizRevealMode] = useState<"immediate" | "on_submit">("immediate");
  const [quizModalLoading, setQuizModalLoading] = useState(false);

  // Active Quiz Runner State
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [revealedQuestions, setRevealedQuestions] = useState<Record<number, boolean>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizReviewMode, setQuizReviewMode] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  // Timed Quiz & Learning Hours Tracking State
  const [quizTimeLimitMinutes, setQuizTimeLimitMinutes] = useState(15);
  const [quizTimeLeft, setQuizTimeLeft] = useState<number | null>(null);
  const [quizTimerActive, setQuizTimerActive] = useState(false);
  const [quizTimeSpentSeconds, setQuizTimeSpentSeconds] = useState(0);
  const [quizTimeExpired, setQuizTimeExpired] = useState(false);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Active Flashcard Viewer State & Auto-Advancement
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardGenerateCount, setFlashcardGenerateCount] = useState(20);
  const [flashcardSearchQuery, setFlashcardSearchQuery] = useState("");
  const [deckCompleted, setDeckCompleted] = useState(false);
  const [cardReviewHistory, setCardReviewHistory] = useState<Record<string, "again" | "hard" | "good" | "easy">>({});

  // Flashcards Index Persistence
  useEffect(() => {
    if (activeSession) {
      try {
        const key = `lamla_flashcard_idx_${activeSession.id}`;
        localStorage.setItem(key, currentCardIndex.toString());
      } catch {}
    }
  }, [activeSession, currentCardIndex]);

  useEffect(() => {
    if (activeSession) {
      try {
        const key = `lamla_flashcard_idx_${activeSession.id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const idx = parseInt(saved, 10);
          if (!isNaN(idx) && idx >= 0) {
            setCurrentCardIndex(idx);
          }
        }
      } catch {}
    }
  }, [activeSession]);

  // ─── SMART STUDY DRILL EXACT POSITION RESUMPTION & AUTOSAVE ───
  useEffect(() => {
    if (activeSession?.id) {
      try {
        const key = `lamla_drill_state_${activeSession.id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.index === "number" && parsed.index >= 0) {
            setDrillIndex(parsed.index);
          }
          if (parsed.answeredMap) {
            setDrillAnsweredMap(parsed.answeredMap);
          }
          if (typeof parsed.streak === "number") {
            setDrillStreak(parsed.streak);
          }
        }
      } catch {}
    }
  }, [activeSession?.id]);

  useEffect(() => {
    if (activeSession?.id) {
      try {
        const key = `lamla_drill_state_${activeSession.id}`;
        localStorage.setItem(
          key,
          JSON.stringify({
            index: drillIndex,
            answeredMap: drillAnsweredMap,
            streak: drillStreak,
          })
        );
      } catch {}
    }
  }, [activeSession?.id, drillIndex, drillAnsweredMap, drillStreak]);

  // ─── PERSISTENT MULTI-TURN PERSONAL AI TUTOR CHAT HISTORY ───
  useEffect(() => {
    if (activeSession?.id) {
      const loadSessionTutorMessages = async () => {
        try {
          // Attempt loading from Supabase session_tutor_messages
          if (user?.id) {
            const { data, error } = await supabase
              .from("session_tutor_messages")
              .select("*")
              .eq("session_id", activeSession.id)
              .order("created_at", { ascending: true });
            if (!error && data && data.length > 0) {
              setTutorMessages(
                data.map((d: any) => ({
                  role: d.role,
                  content: d.content,
                  actionType: d.action_type || undefined,
                }))
              );
              return;
            }
          }
        } catch {}

        // Fallback: localStorage
        try {
          const savedTutor = localStorage.getItem(`lamla_tutor_${activeSession.id}`);
          if (savedTutor) {
            const parsed = JSON.parse(savedTutor);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTutorMessages(parsed);
              return;
            }
          }
        } catch {}

        // Clean initial greeting
        setTutorMessages([
          {
            role: "assistant",
            content: `Hello! I am your 24/7 Personal Socratic AI Tutor for this study session. I am grounded strictly in your uploaded slides for "${activeSession.title}".\n\nAsk me anything about these materials, or tap any of the quick action chips below to get started!`,
          },
        ]);
      };

      loadSessionTutorMessages();
    }
  }, [activeSession?.id, user?.id]);

  // Active Quiz Progress Persistence
  useEffect(() => {
    if (activeQuiz && activeSession && !quizSubmitted) {
      try {
        const key = `lamla_quiz_prog_${activeSession.id}_${activeQuiz.id}`;
        localStorage.setItem(
          key,
          JSON.stringify({
            currentQuestionIndex,
            selectedAnswers,
            revealedQuestions,
          })
        );
      } catch {}
    }
  }, [activeQuiz, activeSession, currentQuestionIndex, selectedAnswers, revealedQuestions, quizSubmitted]);

  // Mistake Notebook & Retest State
  const [notebookFilter, setNotebookFilter] = useState<"session" | "all">("session");
  const [notebookSearch, setNotebookSearch] = useState("");
  const [retestAnswers, setRetestAnswers] = useState<Record<string, string>>({});
  const [retestRevealed, setRetestRevealed] = useState<Record<string, boolean>>({});

  // Leaderboard & Daily Goal State
  const [leaderboardProfiles, setLeaderboardProfiles] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<"all" | "month" | "week">("all");
  const [dailyGoalTarget, setDailyGoalTarget] = useState(10);

  // Interactive Pedagogical Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showThreeWaysModal, setShowThreeWaysModal] = useState(false);
  const [threeWaysConcept, setThreeWaysConcept] = useState("");
  const [showActiveRecallModal, setShowActiveRecallModal] = useState(false);
  const [activeRecallQuestion, setActiveRecallQuestion] = useState("");

  // Window Focus & Visibility Listener for Fair Session Tracking
  useEffect(() => {
    const handleVisibility = () => {
      setIsWindowFocused(!document.hidden);
    };
    const handleBlur = () => setIsWindowFocused(false);
    const handleFocus = () => setIsWindowFocused(true);

    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("blur", handleBlur);
      window.addEventListener("focus", handleFocus);

      const savedGoal = localStorage.getItem("lamla_pref_daily_goal");
      if (savedGoal) setDailyGoalTarget(Number(savedGoal));
    }

    return () => {
      if (typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("blur", handleBlur);
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, []);

  // Derived mistakes from quiz attempts across sessions
  const allMistakes = useMemo(() => {
    const list: any[] = [];
    const seenKeys = new Set<string>();

    quizAttempts.forEach((attempt) => {
      const parentQuiz = quizzes.find((q) => q.id === attempt.quiz_id);
      if (!parentQuiz || !parentQuiz.quiz_questions) return;

      const answers = attempt.answers_submitted || {};
      parentQuiz.quiz_questions.forEach((q: any, qIdx: number) => {
        const selected = answers[qIdx] || answers[String(qIdx)];
        if (!selected) return;

        const ca = String(q.correct_answer || "").trim().toLowerCase();
        const sel = String(selected || "").trim().toLowerCase();
        const selLetter = sel.match(/^[a-e]/i)?.[0]?.toLowerCase() || sel;
        const caLetter = ca.match(/^[a-e]/i)?.[0]?.toLowerCase() || ca;

        const isCorrect = (
          sel === ca ||
          selLetter === caLetter ||
          ca.startsWith(sel + ".") ||
          ca.startsWith(sel + ")") ||
          ca.startsWith(sel + " ")
        );

        const key = `${attempt.quiz_id}_${qIdx}`;
        if (!isCorrect && !seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: key,
            questionId: q.id || key,
            quizId: attempt.quiz_id,
            quizTitle: parentQuiz.title,
            documentId: parentQuiz.document_id,
            questionText: q.question_text || q.question,
            questionType: q.question_type || "mcq",
            options: q.options || [],
            userAnswer: selected,
            correctAnswer: q.correct_answer,
            explanation: q.explanation,
            misconception: q.misconception || "",
            sourceRef: q.source_reference || q.sourceRef || "",
            attemptDate: attempt.completed_at,
          });
        }
      });
    });
    return list;
  }, [quizAttempts, quizzes]);

  const currentSessionMistakes = useMemo(() => {
    if (!activeSession) return allMistakes;
    return allMistakes.filter((m) => m.documentId === activeSession.id);
  }, [allMistakes, activeSession]);

  const getScholarLevel = (xp: number) => {
    if (xp >= 1500) return { level: 5, name: "Grand Scholar", color: "from-amber-500 to-yellow-600", text: "text-amber-700 bg-amber-50 border-amber-200" };
    if (xp >= 700) return { level: 4, name: "Subject Master", color: "from-purple-600 to-indigo-600", text: "text-purple-700 bg-purple-50 border-purple-200" };
    if (xp >= 300) return { level: 3, name: "Academic Achiever", color: "from-blue-600 to-cyan-600", text: "text-blue-700 bg-blue-50 border-blue-200" };
    if (xp >= 100) return { level: 2, name: "Diligent Learner", color: "from-emerald-600 to-teal-600", text: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    return { level: 1, name: "Novice Scholar", color: "from-slate-600 to-slate-700", text: "text-slate-700 bg-slate-50 border-slate-200" };
  };

  const formatScholarName = (p: any, currentUserId: string) => {
    if (p.id === currentUserId) return `${p.full_name || "You"} (You)`;
    if (!p.full_name) {
      const emailPrefix = p.email ? p.email.split("@")[0] : "Scholar";
      return `${emailPrefix.slice(0, 3)}*** (Scholar)`;
    }
    const parts = p.full_name.trim().split(" ");
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const loadWorkspaceData = async () => {
    setLoading(true);
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);

    if (!configured) {
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);

        // Fetch all workspace data in parallel (< 0.3s mobile roundtrip instead of 9 sequential queries)
        const [
          { data: profileData },
          { data: docs },
          { data: sums },
          { data: notes },
          { data: decks },
          { data: cards },
          { data: qz },
          { data: attempts },
          { data: lb },
        ] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", session.user.id).single(),
          supabase
            .from("documents")
            .select("*")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false }),
          supabase.from("summaries").select("*").eq("user_id", session.user.id),
          supabase.from("study_notes").select("*").eq("user_id", session.user.id),
          supabase.from("flashcard_decks").select("*").eq("user_id", session.user.id),
          supabase
            .from("flashcards")
            .select("*, flashcard_decks!inner(document_id, user_id)")
            .eq("flashcard_decks.user_id", session.user.id),
          supabase
            .from("quizzes")
            .select("*, quiz_questions(*)")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("quiz_attempts")
            .select("*")
            .eq("user_id", session.user.id)
            .order("completed_at", { ascending: false }),
          supabase
            .from("profiles")
            .select("id, full_name, email, educational_level, streak_days, total_study_minutes, points")
            .order("points", { ascending: false })
            .limit(200),
        ]);

        if (profileData) {
          const now = new Date();
          const lastActive = profileData.updated_at ? new Date(profileData.updated_at) : null;
          let currentStreak = profileData.streak_days || 0;

          if (lastActive && currentStreak > 0) {
            const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 1) {
              currentStreak = 0;
              supabase.from("profiles").update({ streak_days: 0 }).eq("id", session.user.id).then();
              profileData.streak_days = 0;
            }
          }

          setProfile(profileData);
        } else {
          setProfile({
            full_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0],
            educational_level: session.user.user_metadata?.educational_level || "shs",
            plan_id: "free",
            role: session.user.user_metadata?.role || "student",
            streak_days: 0,
            total_study_minutes: 0,
            points: 0,
          });
        }

        if (docs) setSessions(docs);
        if (sums) setSummaries(sums);
        if (notes) setStudyNotes(notes);
        if (decks) setFlashcardDecks(decks);
        if (cards) setFlashcards(cards);
        if (qz) setQuizzes(qz);
        if (attempts) setQuizAttempts(attempts);
        if (lb) setLeaderboardProfiles(lb);
      }
    } catch (err) {
      console.error("Workspace load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─── LEARNING HOURS & STREAK TRACKING ───
  const updateStudyStats = async (minutesToAdd: number, pointsToAdd: number = 0) => {
    if (!profile) return;
    const currentMinutes = profile.total_study_minutes || 0;
    const currentPoints = profile.points || 0;
    const newMinutes = currentMinutes + minutesToAdd;
    const newPoints = currentPoints + pointsToAdd;

    const now = new Date();
    const lastActive = profile.updated_at ? new Date(profile.updated_at) : null;
    let newStreak = profile.streak_days || 0;

    if (lastActive) {
      const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1 || newStreak === 0) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const updatedProfile = {
      ...profile,
      total_study_minutes: newMinutes,
      points: newPoints,
      streak_days: newStreak,
      updated_at: now.toISOString(),
    };
    setProfile(updatedProfile);

    if (isConfigured && user) {
      try {
        await supabase.from("profiles").update({
          total_study_minutes: newMinutes,
          points: newPoints,
          streak_days: newStreak,
          updated_at: now.toISOString(),
        }).eq("id", user.id);
      } catch (err) {
        console.error("Failed to update profile stats:", err);
      }
    }
  };

  // Active Quiz Countdown Timer Effect (Fair: pauses if user leaves tab)
  useEffect(() => {
    let interval: any = null;
    if (quizTimerActive && !quizSubmitted && quizTimeLeft !== null && isWindowFocused) {
      interval = setInterval(() => {
        setQuizTimeSpentSeconds((prev) => prev + 1);
        setQuizTimeLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(interval);
            setQuizTimerActive(false);
            setQuizTimeExpired(true);
            handleSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [quizTimerActive, quizSubmitted, quizTimeLeft, isWindowFocused]);

  // High-performance study time logger callback (isolated from top-level tick re-renders)
  const handleMinuteCompleted = React.useCallback(
    (minutes: number) => {
      updateStudyStats(minutes, 0);
    },
    [profile, user, isConfigured]
  );

  const handleSignOut = async () => {
    if (isConfigured) {
      await supabase.auth.signOut();
      window.location.href = "/auth/login";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (up to 1.5 GB for large lecture slide decks & PDFs)
    const MAX_SIZE = 1536 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setModalError("File size exceeds 1.5 GB limit. Please select a file under 1.5 GB.");
      return;
    }

    setSelectedFile(file);
    setExtractedFileName(file.name);
    setModalError(null);
    if (!sessionTitle.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setSessionTitle(cleanName);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. CREATE NEW STUDY SESSION (ONE UPLOAD GROUP = ONE SESSION)
  // Extracts PPTX/DOCX/TXT/MD in < 0.3s right on the device or streams up to 1.5 GB
  // ─────────────────────────────────────────────────────────────
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isQuotaReached) {
      setModalError(`You have reached the ${currentPlan} plan limit of ${planLimit} study sessions. Upgrade to Premium for Unlimited study sessions.`);
      setUpgradeReason(`You have used all ${planLimit} study sessions on your ${currentPlan} Plan. Upgrade to Premium for Unlimited study sessions.`);
      setShowUpgradeModal(true);
      return;
    }

    if (selectedMode === "flashcards" && !canAccessFlashcards) {
      setModalError("Flashcards are an exclusive feature for Standard, Premium, and Admin scholars. Upgrade to Standard or Premium to unlock interactive flip decks.");
      setUpgradeReason("Flashcards with Spaced Repetition (Active Recall) are reserved for Standard, Premium, and Admin scholars. Upgrade to Standard or Premium to unlock interactive flashcard decks.");
      setShowUpgradeModal(true);
      return;
    }

    if (!selectedFile && !materialsText.trim()) {
      setModalError("Please select a study material file (PDF, PowerPoint, Word, Image up to 1.5 GB) or paste your lecture notes.");
      return;
    }

    if (!sessionTitle.trim() && !selectedFile) {
      setModalError("Please provide a session title.");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    setUploadProgress(5);
    setProcessingStage("Preparing study session...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const formData = new FormData();
      if (selectedFile) {
        setProcessingStage("Instantly reading slides & text on your device...");
        setUploadProgress(20);
        const fastRes = await tryFastClientExtraction(selectedFile);
        if (fastRes?.handledOnClient && fastRes.extractedText) {
          setUploadProgress(80);
          setProcessingStage("Generating study resources with AI core...");
          formData.append("text", fastRes.extractedText);
          formData.append("fileName", selectedFile.name);
          formData.append("fileSize", String(selectedFile.size));
          formData.append("pageCount", String(fastRes.pageCount || 1));
        } else {
          // Stream PDF/binary directly to Python disk-streaming endpoint first (supports 1 GB+ without Node RAM buffering)
          let directExtractedText = "";
          let directPageCount = 1;
          try {
            const directParse: any = await new Promise((resolveDirect, rejectDirect) => {
              const pyXhr = new XMLHttpRequest();
              pyXhr.open("POST", "/api/upload-and-parse");
              pyXhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable) {
                  const pct = Math.min(85, Math.round((ev.loaded / ev.total) * 80));
                  setUploadProgress(pct);
                  setProcessingStage(`Streaming ${selectedFile.name} (${pct}%)...`);
                }
              };
              pyXhr.onload = () => {
                try {
                  const parsed = JSON.parse(pyXhr.responseText);
                  if (pyXhr.status >= 200 && pyXhr.status < 300 && parsed?.data?.full_text) {
                    resolveDirect(parsed.data);
                  } else {
                    rejectDirect(new Error("Fallback to process route"));
                  }
                } catch {
                  rejectDirect(new Error("Fallback to process route"));
                }
              };
              pyXhr.onerror = () => rejectDirect(new Error("Fallback to process route"));
              pyXhr.ontimeout = () => rejectDirect(new Error("Fallback to process route"));
              pyXhr.timeout = 600000;
              const pyFd = new FormData();
              pyFd.append("file", selectedFile, selectedFile.name);
              pyXhr.send(pyFd);
            });
            if (directParse?.full_text) {
              directExtractedText = directParse.full_text;
              directPageCount = directParse.total_slides || directParse.total_pages || 1;
            }
          } catch {}

          if (directExtractedText) {
            setUploadProgress(90);
            setProcessingStage("Synthesizing slides, notes & exam questions...");
            formData.append("text", directExtractedText);
            formData.append("fileName", selectedFile.name);
            formData.append("fileSize", String(selectedFile.size));
            formData.append("pageCount", String(directPageCount));
          } else {
            formData.append("file", selectedFile);
          }
        }
      } else if (materialsText.trim()) {
        formData.append("text", materialsText.trim());
      }
      formData.append("title", sessionTitle.trim());
      formData.append("mode", selectedMode);
      formData.append("educationalLevel", profile?.educational_level || "Senior High School (SHS) & University");
      formData.append("quizCount", String(initialQuizCount));
      formData.append("quizTimeLimit", String(quizTimeLimitMinutes));
      formData.append("quizType", initialQuizType);
      formData.append("quizDifficulty", initialQuizDifficulty);

      // Perform upload with accurate XMLHttpRequest progress tracking
      const result: any = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/documents/process");
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(pct);
            if (pct < 100) {
              setProcessingStage(`Uploading study materials (${pct}%)...`);
            } else {
              setProcessingStage("Synthesizing slides, notes & exam questions...");
            }
          }
        };

        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(json);
            } else {
              const err: any = new Error(json.error || `Server returned error (${xhr.status})`);
              err.code = json.code;
              err.plan = json.plan;
              err.limit = json.limit;
              reject(err);
            }
          } catch {
            reject(new Error(`Server returned unexpected response (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error("Network connection error during upload. Please check your internet connection."));
        xhr.ontimeout = () => reject(new Error("Upload connection timed out. Please check your internet connection and try again."));
        xhr.timeout = 600000; // 10 minutes timeout for 1GB+ files

        xhr.send(formData);
      });

      if (!result.success || !result.document) {
        throw new Error(result.error || "Failed to process study materials.");
      }

      const newDoc = result.document;
      setSessions((prev) => [newDoc, ...prev]);
      setActiveSession(newDoc);

      if (result.summary) {
        setSummaries((prev) => [result.summary, ...prev]);
      }
      if (result.explanation) {
        setStudyNotes((prev) => [result.explanation, ...prev]);
      }
      if (result.notes) {
        setStudyNotes((prev) => [result.notes, ...prev]);
      }
      if (result.cards && result.cards.length > 0) {
        const deck = {
          id: result.cards[0]?.deck_id || `deck-${Date.now()}`,
          document_id: newDoc.id,
          title: `${newDoc.title} - Flashcards`,
          card_count: result.cards.length,
        };
        setFlashcardDecks((prev) => [deck, ...prev]);
        setFlashcards((prev) => [...result.cards, ...prev]);
      }
      if (result.quiz) {
        setQuizzes((prev) => [result.quiz, ...prev]);
      }

      // Reset modal inputs
      setSelectedFile(null);
      setExtractedFileName(null);
      setSessionTitle("");
      setMaterialsText("");
      setShowNewSessionModal(false);

      // Record real study activity - zero free XP on creation
      updateStudyStats(0, 0);

      // Navigate to the generated tab
      if (selectedMode === "summarize") setActiveTab("summary");
      else if (selectedMode === "flashcards") setActiveTab("flashcards");
      else if (selectedMode === "quiz") setActiveTab("quizzes");
    } catch (err: any) {
      console.error("Session creation error:", err);
      if (err?.code === "UPGRADE_REQUIRED" || String(err?.message || "").toLowerCase().includes("limit reached")) {
        setUpgradeReason(err.message || `Your ${currentPlan} Plan limit of ${planLimit} study sessions has been reached.`);
        setShowUpgradeModal(true);
      }
      setModalError(err?.message || "Failed to process materials.");
    } finally {
      setModalLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 2. GENERATE ADDITIONAL RESOURCE FOR ACTIVE SESSION
  // (Without having to re-upload materials!)
  // ─────────────────────────────────────────────────────────────
  const handleGenerateAdditionalResource = async (
    resourceType: "summary" | "flashcards" | "notes",
    customCount?: number
  ) => {
    if (!activeSession) return;
    setGeneratingResource(resourceType);

    try {
      const educationalLevel = profile?.educational_level || "Senior High School (SHS) & University";
      const sourceText =
        (activeSession.extracted_text && activeSession.extracted_text.trim()) ||
        activeSlides.map((s) => `--- Slide ${s.slideNumber}: ${s.title} ---\n${s.content}`).join("\n\n") ||
        activeSession.title ||
        "Core Academic Study Material";

      const aiHeaders = await getAiFetchHeaders();

      if (resourceType === "summary") {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: aiHeaders,
          body: JSON.stringify({
            action: "summary",
            content: sourceText,
            options: { style: "Exam-Oriented", educationalLevel },
          }),
        });
        const data = await res.json();
        if (!data.summary) throw new Error(data.error || "Failed to generate summary.");

        const existingSum = summaries.find((s) => s.document_id === activeSession.id);
        let savedSummary: any = null;
        if (user) {
          if (existingSum && !String(existingSum.id).startsWith("local-")) {
            const { data: s } = await supabase
              .from("summaries")
              .update({ content: data.summary })
              .eq("id", existingSum.id)
              .select()
              .single();
            savedSummary = s;
          } else {
            const { data: s } = await supabase
              .from("summaries")
              .insert({
                document_id: activeSession.id,
                user_id: user.id,
                title: `${activeSession.title} - Summary`,
                content: data.summary,
                style: "Exam-Oriented",
              })
              .select()
              .single();
            savedSummary = s;
          }
        }
        const summaryObj = savedSummary || {
          id: existingSum?.id || `local-sum-${Date.now()}`,
          document_id: activeSession.id,
          user_id: user?.id || "local",
          title: `${activeSession.title} - Summary`,
          content: data.summary,
          style: "Exam-Oriented",
          created_at: new Date().toISOString(),
        };
        setSummaries((prev) => [
          summaryObj,
          ...prev.filter((s) => s.document_id !== activeSession.id),
        ]);
        setActiveTab("summary");
      } else if (resourceType === "flashcards") {
        const countToGenerate = customCount || flashcardGenerateCount || 20;
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: aiHeaders,
          body: JSON.stringify({
            action: "flashcards",
            content: sourceText,
            options: { count: countToGenerate },
          }),
        });
        const data = await res.json();
        if (!data.flashcards || data.flashcards.length === 0) {
          throw new Error(data.error || "No flashcards could be generated from this session.");
        }

        let deckObj: any = null;
        if (user) {
          const { data: deck } = await supabase
            .from("flashcard_decks")
            .insert({
              document_id: activeSession.id,
              user_id: user.id,
              title: `${activeSession.title} - Flashcards`,
              card_count: data.flashcards.length,
            })
            .select()
            .single();
          deckObj = deck;
        }

        if (!deckObj) {
          deckObj = {
            id: `local-deck-${Date.now()}`,
            document_id: activeSession.id,
            user_id: user?.id || "local",
            title: `${activeSession.title} - Flashcards`,
            card_count: data.flashcards.length,
            created_at: new Date().toISOString(),
          };
        }

        const formattedFull = data.flashcards.map((c: any, idx: number) => ({
          id: `local-card-${Date.now()}-${idx}`,
          deck_id: deckObj.id,
          front: c.front || c.question || `Concept ${idx + 1}`,
          back: c.back || c.answer || "",
          slide_reference: "",
          mastery_level: 0,
          next_review_at: new Date().toISOString(),
        }));

        let savedCards: any[] | null = null;
        if (user && !String(deckObj.id).startsWith("local-")) {
          const fullPayload = formattedFull.map(({ id, ...rest }: any) => rest);
          const { data: insertedFull, error: cardsErr } = await supabase
            .from("flashcards")
            .insert(fullPayload)
            .select();

          if (!cardsErr && insertedFull && insertedFull.length > 0) {
            savedCards = insertedFull;
          } else {
            // Fallback to minimal schema columns (deck_id, front, back)
            const minimalPayload = formattedFull.map((c: any) => ({
              deck_id: deckObj.id,
              front: c.front,
              back: c.back,
            }));
            const { data: insertedMin } = await supabase
              .from("flashcards")
              .insert(minimalPayload)
              .select();
            if (insertedMin && insertedMin.length > 0) {
              savedCards = insertedMin;
            }
          }
        }

        setFlashcardDecks((prev) => [deckObj, ...prev]);
        setFlashcards((prev) => [...(savedCards || formattedFull), ...prev]);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setDeckCompleted(false);
        setActiveTab("flashcards");
      } else if (resourceType === "notes") {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: aiHeaders,
          body: JSON.stringify({
            action: "notes",
            content: sourceText,
            options: { subject: activeSession.title, educationalLevel },
          }),
        });
        const data = await res.json();
        if (!data.notes) throw new Error(data.error || "Failed to generate detailed notes.");

        const existingNote = studyNotes.find(
          (n) => n.document_id === activeSession.id && (n.subject === "exam_notes" || n.subject === "notes")
        );
        let savedNote: any = null;
        if (user) {
          if (existingNote && !String(existingNote.id).startsWith("local-")) {
            const { data: noteRow } = await supabase
              .from("study_notes")
              .update({ content: data.notes })
              .eq("id", existingNote.id)
              .select()
              .single();
            savedNote = noteRow;
          } else {
            const { data: noteRow } = await supabase
              .from("study_notes")
              .insert({
                document_id: activeSession.id,
                user_id: user.id,
                title: `${activeSession.title} - Detailed Notes`,
                content: data.notes,
                subject: "exam_notes",
              })
              .select()
              .single();
            savedNote = noteRow;
          }
        }
        const noteObj = savedNote || {
          id: existingNote?.id || `local-note-${Date.now()}`,
          document_id: activeSession.id,
          user_id: user?.id || "local",
          title: `${activeSession.title} - Detailed Notes`,
          content: data.notes,
          subject: "exam_notes",
          created_at: new Date().toISOString(),
        };
        setStudyNotes((prev) => [
          noteObj,
          ...prev.filter(
            (n) => !(n.document_id === activeSession.id && (n.subject === "exam_notes" || n.subject === "notes"))
          ),
        ]);
        setActiveTab("notes");
      }
    } catch (err: any) {
      alert("Failed to generate resource: " + (err.message || err));
    } finally {
      setGeneratingResource(null);
    }
  };

  // ─── 2b. INTERACTIVE PERSONAL AI TUTOR MESSAGING (STAGE 3 MULTI-MODAL) ───
  const handleSendTutorMessage = async (queryText?: string, actionType?: string) => {
    if (speechRec.isListening) {
      speechRec.stopListening();
    }
    const textToSend = (queryText || tutorInput).trim();
    if (!textToSend || tutorLoading) return;

    const newMessages = [
      ...tutorMessages,
      { role: "user" as const, content: textToSend, actionType }
    ];
    setTutorMessages(newMessages);
    if (activeSession?.id) {
      try {
        localStorage.setItem(`lamla_tutor_${activeSession.id}`, JSON.stringify(newMessages));
        if (user?.id) {
          supabase.from("session_tutor_messages").insert({
            session_id: activeSession.id,
            user_id: user.id,
            role: "user",
            content: textToSend,
            action_type: actionType || null,
          }).then();
        }
      } catch {}
    }
    userScrolledUpRef.current = false;
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 50);

    if (!queryText) {
      setTutorInput("");
      speechRec.resetTranscript();
    }
    setTutorLoading(true);

    try {
      const aiHeaders = await getAiFetchHeaders();
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({
          action: "tutor",
          content: textToSend,
          question: textToSend,
          options: {
            contextDocument: activeSession?.extracted_text || "",
            educationalLevel: profile?.educational_level || "University / SHS",
            actionType: actionType || null,
            chatHistory: newMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
            teachingMode: tutorTeachingMode,
          }
        })
      });
      const data = await res.json();
      if (data.answer) {
        const updatedWithAssistant = [
          ...newMessages,
          { role: "assistant" as const, content: data.answer, actionType }
        ];
        setTutorMessages(updatedWithAssistant);
        if (activeSession?.id) {
          try {
            localStorage.setItem(`lamla_tutor_${activeSession.id}`, JSON.stringify(updatedWithAssistant));
            if (user?.id) {
              supabase.from("session_tutor_messages").insert({
                session_id: activeSession.id,
                user_id: user.id,
                role: "assistant",
                content: data.answer,
                action_type: actionType || null,
              }).then();
            }
          } catch {}
        }
      } else {
        setTutorMessages((prev) => [
          ...prev,
          { role: "assistant" as const, content: "I could not generate an answer right now. Please try again." }
        ]);
      }
    } catch (err: any) {
      setTutorMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: "Network error communicating with the AI Tutor: " + (err.message || err) }
      ]);
    } finally {
      setTutorLoading(false);
      setTimeout(() => {
        if (!userScrolledUpRef.current && messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 50);
    }
  };

  // ─── 2c. SMART STUDY: GENERATE EXHAUSTIVE SLIDE DRILL QUESTIONS (BATCH OR UNTIL EXHAUSTED) ───
  const handleGenerateDrillQuestions = async (targetSlidesOverride?: SlideSegment[], countToGenerate = 15) => {
    if (!activeSession || !user) return;
    setDrillGeneratingMore(true);
    try {
      // Determine which slides to process
      let slidesToProcess: SlideSegment[] = [];
      if (targetSlidesOverride && targetSlidesOverride.length > 0) {
        slidesToProcess = targetSlidesOverride;
      } else {
        const uncovered = activeSlides.filter((s) => !drillCoverageMetrics.coveredSlideNums.has(s.slideNumber));
        if (uncovered.length > 0) {
          slidesToProcess = uncovered.slice(0, 4);
        } else {
          slidesToProcess = activeSlides.slice(0, 4);
        }
      }

      const slideRangeTitle = slidesToProcess.map((s) => `Slide ${s.slideNumber}`).join(", ");
      const contentSlice = slidesToProcess.map((s) => `--- Slide ${s.slideNumber}: ${s.title} ---\n${s.content}`).join("\n\n");

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quiz",
          content: contentSlice || activeSession.extracted_text,
          options: {
            count: countToGenerate,
            type: "exhaustive", // Exhaustive direct slide testing
            difficulty: "intermediate",
            educationalLevel: profile?.educational_level || "Senior High School (SHS)"
          }
        })
      });
      const data = await res.json();
      if (!data.questions || data.questions.length === 0) {
        throw new Error(data.error || "Could not generate additional slide drill questions.");
      }

      // Deduplication: prevent duplicate or near-duplicate questions from appearing in the session
      const existingNormalized = new Set<string>();
      sessionDrillQuestions.forEach((q) => {
        const text = String(q.question_text || q.question || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (text) existingNormalized.add(text);
      });

      const distinctQuestions = (data.questions || []).filter((q: any) => {
        const text = String(q.question || q.question_text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!text || existingNormalized.has(text)) return false;
        existingNormalized.add(text);
        return true;
      });

      if (distinctQuestions.length === 0) {
        // No new distinct questions could be extracted from this material
        const totalSlides = drillCoverageMetrics.totalSlides;
        const coveredCount = drillCoverageMetrics.coveredCount;
        const isTrueExhaustion = coveredCount >= Math.max(1, totalSlides - 1) || drillCoverageMetrics.coveragePct >= 75;
        setDrillExhausted(true);
        setDrillExhaustionReport({
          totalQuestions: sessionDrillQuestions.length,
          coveredFacts: drillCoverageMetrics.coveredCount,
          totalSlides,
          isTrueExhaustion,
          reason: isTrueExhaustion
            ? "Every examinable concept, definition, mechanism, and process across all slides has been thoroughly tested without duplicate questions."
            : "The uploaded slide deck contains brief notes or limited extractable text. All available examinable statements have been tested."
        });
        setDrillContinuousRunning(false);
        return null;
      }

      const { data: newQuiz, error: qErr } = await supabase.from("quizzes").insert({
        document_id: activeSession.id,
        user_id: user.id,
        title: `[DRILL] ${activeSession.title} - ${slideRangeTitle}`,
        total_questions: distinctQuestions.length,
        difficulty: "intermediate",
      }).select().single();
      if (qErr) throw qErr;

      if (newQuiz) {
        const formatted = distinctQuestions.map((q: any, i: number) => {
          const insight = q.examiner_insight || q.misconception_tip || q.misconception || "";
          const testedFact = q.testedFact || q.tested_fact || "";
          let fullExp = q.explanation || "";
          if (testedFact) fullExp += `\n\n🎯 Tested Fact: ${testedFact}`;
          if (insight) fullExp += `\n\n💡 Examiner Insight: ${insight}`;

          const qType = q.type || (q.options?.length === 2 ? "true_false" : q.options?.length === 5 ? "assertion_reasoning" : "mcq");

          return {
            quiz_id: newQuiz.id,
            question_text: q.question,
            question_type: qType,
            options: q.options || [],
            correct_answer: q.correctAnswer || "",
            explanation: fullExp.trim(),
            examiner_insight: insight,
            slide_reference: "",
            assertion: q.assertion || "",
            reason: q.reason || "",
            order_index: i,
          };
        });

        // Supabase DB columns only: quiz_id, question_text, question_type, options, correct_answer, explanation, order_index
        const dbPayload = formatted.map(({ examiner_insight, slide_reference, assertion, reason, ...rest }: any) => rest);
        const { data: insertedQs, error: insErr } = await supabase.from("quiz_questions").insert(dbPayload).select();
        if (insErr) {
          console.warn("Quiz questions insert warning:", insErr);
        }

        const fullQuiz = { 
          ...newQuiz, 
          quiz_questions: (insertedQs || dbPayload).map((iq: any, idx: number) => ({
            ...iq,
            examiner_insight: formatted[idx]?.examiner_insight || "",
            slide_reference: formatted[idx]?.slide_reference || "",
            assertion: formatted[idx]?.assertion || "",
            reason: formatted[idx]?.reason || "",
          }))
        };
        setQuizzes((prev) => [fullQuiz, ...prev]);
        return fullQuiz;
      }
    } catch (err: any) {
      alert("Drill generation error: " + (err.message || err));
      return null;
    } finally {
      setDrillGeneratingMore(false);
    }
  };

  // Continuous auto-generation until all slides in the deck are exhaustively covered
  const handleContinuousExhaustiveDrill = async () => {
    if (!activeSession || !user || drillContinuousRunning) return;
    setDrillContinuousRunning(true);

    try {
      const uncovered = activeSlides.filter((s) => !drillCoverageMetrics.coveredSlideNums.has(s.slideNumber));
      const slidesQueue = uncovered.length > 0 ? uncovered : activeSlides;

      const chunkSize = 3;
      const chunks: SlideSegment[][] = [];
      for (let i = 0; i < slidesQueue.length; i += chunkSize) {
        chunks.push(slidesQueue.slice(i, i + chunkSize));
      }

      for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
        const chunk = chunks[cIdx];
        const rangeLabel = chunk.map((s) => `Slide ${s.slideNumber}`).join(", ");
        setDrillContinuousProgress({
          current: cIdx + 1,
          total: chunks.length,
          label: `Processing ${rangeLabel} (${Math.round(((cIdx + 1) / chunks.length) * 100)}% complete)...`
        });

        const genRes = await handleGenerateDrillQuestions(chunk, 12);
        if (!genRes || drillExhausted) {
          break;
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch (err: any) {
      console.error("Continuous generation stopped:", err);
    } finally {
      setDrillContinuousRunning(false);
      setDrillContinuousProgress(null);
    }
  };

  // Grade Exam Simulation
  const handleGradeExamSimulation = () => {
    if (sessionDrillQuestions.length === 0) return;
    let correctCount = 0;
    sessionDrillQuestions.forEach((q, idx) => {
      const answerState = drillAnsweredMap[idx];
      if (answerState?.isCorrect) {
        correctCount++;
      }
    });

    const total = sessionDrillQuestions.length;
    const pct = Math.round((correctCount / total) * 100);
    setExamScoreReport({
      score: correctCount,
      total,
      percentage: pct,
      passed: pct >= 70,
    });
    setExamSubmitted(true);
    updateStudyStats(Math.round(total * 0.5), correctCount * 3);
  };

  // Spaced Repetition (SRS) Flashcard Rating with Immediate Auto-Advance
  const handleRateFlashcard = async (cardId: string, rating: "again" | "hard" | "good" | "easy", totalCardsInView: number) => {
    const intervals: Record<string, { level: number; addMinutes: number }> = {
      again: { level: 0, addMinutes: 1 },
      hard: { level: 1, addMinutes: 10 },
      good: { level: 2, addMinutes: 1440 },
      easy: { level: 3, addMinutes: 5760 },
    };

    const config = intervals[rating];
    const nextReview = new Date(Date.now() + config.addMinutes * 60 * 1000).toISOString();

    setCardReviewHistory((prev) => ({ ...prev, [cardId]: rating }));

    setFlashcards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, mastery_level: config.level, next_review_at: nextReview } : c))
    );

    try {
      await supabase
        .from("flashcards")
        .update({ mastery_level: config.level, next_review_at: nextReview })
        .eq("id", cardId);
    } catch {
      // offline/silent fallback
    }

    // Auto-advance immediately without requiring extra click!
    if (currentCardIndex < totalCardsInView - 1) {
      setCurrentCardIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setDeckCompleted(true);
      setIsFlipped(false);
      // Award +5 XP strictly when complete deck of flashcards is finished
      updateStudyStats(0, 5);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 3. GENERATE SESSION-SPECIFIC QUIZ
  // ─────────────────────────────────────────────────────────────
  const handleGenerateSessionQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    if (!user) {
      alert("Please sign in to generate and save practice quizzes.");
      return;
    }

    setQuizModalLoading(true);
    try {
      const aiHeaders = await getAiFetchHeaders();
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({
          action: "quiz",
          content: activeSession.extracted_text, // STRICTLY THIS SESSION ALONE!
          options: {
            count: quizQuestionCount,
            type: quizQuestionType,
            difficulty: quizDifficulty,
            educationalLevel: profile?.educational_level || "Senior High School (SHS) & University",
          },
        }),
      });

      const data = await res.json();
      const rawReturned: any[] = Array.isArray(data.questions) ? data.questions : [];
      if (rawReturned.length === 0) {
        throw new Error(data.error || "Could not generate questions for this session's materials.");
      }

      // Deduplicate questions by normalized stem and correct answer so questions/answers never repeat
      const seenStems = new Set<string>();
      const uniqueQuestions: any[] = [];
      for (const q of rawReturned) {
        let qText = String(q.question || q.question_text || "").trim();
        if ((q.type === "assertion_reasoning" || quizQuestionType === "assertion_reasoning") && q.assertion && q.reason && !qText.includes("Reason")) {
          qText = `Assertion (A): ${q.assertion}\nReason (R): ${q.reason}`;
        }
        const normKey = `${q.type || quizQuestionType}:${qText.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        if (!qText || seenStems.has(normKey)) continue;
        seenStems.add(normKey);
        uniqueQuestions.push({ ...q, question: qText });
      }

      const finalQuestions = uniqueQuestions.length > 0 ? uniqueQuestions : rawReturned;

      const { data: newQuiz, error: qErr } = await supabase.from("quizzes").insert({
        document_id: activeSession.id,
        user_id: user.id,
        title: `${activeSession.title} - ${quizQuestionType.toUpperCase()} Quiz (${finalQuestions.length} Qs)`,
        total_questions: finalQuestions.length,
        difficulty: quizDifficulty,
        time_limit_minutes: quizTimeLimitMinutes,
        passing_score: 70,
      }).select().single();

      if (qErr || !newQuiz) throw new Error(qErr?.message || "Failed to save quiz.");

      const formatted = finalQuestions.map((q: any, i: number) => {
        let exp = q.explanation || "";
        if (q.markingGuide) exp += `\n\nMarking Guide: ${q.markingGuide}`;
        if (q.misconception) exp += `\n\nCommon Pitfall: ${q.misconception}`;

        return {
          quiz_id: newQuiz.id,
          question_text: q.question,
          question_type: q.type || quizQuestionType,
          options: q.options || [],
          correct_answer: q.correctAnswer || "",
          explanation: exp.trim(),
          order_index: i,
        };
      });

      const { error: insErr } = await supabase.from("quiz_questions").insert(formatted);
      if (insErr) throw insErr;
      newQuiz.quiz_questions = formatted;

      setQuizzes((prev) => [newQuiz, ...prev]);
      startQuizRunner(newQuiz);
      setShowQuizModal(false);
      setActiveTab("quizzes");
    } catch (err: any) {
      alert("Quiz generation error: " + (err.message || err));
    } finally {
      setQuizModalLoading(false);
    }
  };

  const startQuizRunner = (quiz: any) => {
    setActiveQuiz(quiz);

    let startIdx = 0;
    let savedAnswers: Record<number, string> = {};
    let savedRevealed: Record<number, boolean> = {};

    if (activeSession) {
      try {
        const key = `lamla_quiz_prog_${activeSession.id}_${quiz.id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.currentQuestionIndex === "number") {
            startIdx = parsed.currentQuestionIndex;
            savedAnswers = parsed.selectedAnswers || {};
            savedRevealed = parsed.revealedQuestions || {};
          }
        }
      } catch {}
    }

    setCurrentQuestionIndex(startIdx);
    setSelectedAnswers(savedAnswers);
    setRevealedQuestions(savedRevealed);
    setQuizSubmitted(false);
    setQuizReviewMode(false);
    setQuizScore(null);
    setQuizTimeExpired(false);
    setQuizTimeSpentSeconds(0);

    const limit = quiz.time_limit_minutes || quizTimeLimitMinutes || 15;
    if (limit > 0) {
      setQuizTimeLeft(limit * 60);
      setQuizTimerActive(true);
    } else {
      setQuizTimeLeft(null);
      setQuizTimerActive(false);
    }
  };

  // Submit Active Quiz
  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    setQuizTimerActive(false);

    const questions = activeQuiz.quiz_questions || [];
    let correctCount = 0;

    questions.forEach((q: any, i: number) => {
      const selected = (selectedAnswers[i] || "").trim().toLowerCase();
      const actual = String(q.correct_answer || "").trim().toLowerCase();
      const selectedLetter = selected.match(/^[a-e]/i)?.[0]?.toLowerCase() || selected;
      const actualLetter = actual.match(/^[a-e]/i)?.[0]?.toLowerCase() || actual;

      if (selected && actual && (
        selected === actual || 
        selectedLetter === actualLetter || 
        actual.startsWith(selected + ".") || 
        actual.startsWith(selected + ")") ||
        actual.startsWith(selected + " ")
      )) {
        correctCount += 1;
      }
    });

    const scorePct = Math.round((correctCount / questions.length) * 100);
    setQuizScore(scorePct);
    setQuizSubmitted(true);

    // Award XP strictly for completed tasks: +2 XP per correct question, +10 XP if passed (>= 70%)
    const minutesSpent = Math.max(1, Math.round(quizTimeSpentSeconds / 60));
    const pointsAwarded = (correctCount * 2) + (scorePct >= 70 ? 10 : 0);
    updateStudyStats(minutesSpent, pointsAwarded);

    if (isConfigured && user) {
      try {
        const { data: attempt } = await supabase.from("quiz_attempts").insert({
          quiz_id: activeQuiz.id,
          user_id: user.id,
          score_percentage: scorePct,
          total_questions: questions.length,
          correct_count: correctCount,
          answers_submitted: selectedAnswers,
          time_taken_seconds: quizTimeSpentSeconds,
          passed: scorePct >= 70,
        }).select().single();
        if (attempt) setQuizAttempts((prev) => [attempt, ...prev]);
      } catch (err) {
        console.error("Failed to save attempt:", err);
      }
    }
  };

  // Delete an entire session and permanently purge all child records to free database space
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this study session and all its generated summaries, flashcards, and quizzes? This will permanently erase everything to free up database space.")) {
      return;
    }

    if (isConfigured && user) {
      try {
        // 1. Cascade delete quiz attempts & questions
        const { data: sQuizzes } = await supabase.from("quizzes").select("id").eq("document_id", sessionId);
        const quizIds = (sQuizzes || []).map((q) => q.id);
        if (quizIds.length > 0) {
          await supabase.from("quiz_attempts").delete().in("quiz_id", quizIds);
          await supabase.from("quiz_questions").delete().in("quiz_id", quizIds);
          await supabase.from("quizzes").delete().eq("document_id", sessionId);
        }

        // 2. Cascade delete flashcards & decks
        const { data: sDecks } = await supabase.from("flashcard_decks").select("id").eq("document_id", sessionId);
        const deckIds = (sDecks || []).map((d) => d.id);
        if (deckIds.length > 0) {
          await supabase.from("flashcards").delete().in("deck_id", deckIds);
          await supabase.from("flashcard_decks").delete().eq("document_id", sessionId);
        }

        // 3. Cascade delete summaries & notes
        await supabase.from("summaries").delete().eq("document_id", sessionId);
        await supabase.from("study_notes").delete().eq("document_id", sessionId);

        // 4. Delete parent document
        await supabase.from("documents").delete().eq("id", sessionId);
      } catch (delErr) {
        console.error("Cascade deletion error:", delErr);
      }
    }

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setSummaries((prev) => prev.filter((s) => s.document_id !== sessionId));
    setStudyNotes((prev) => prev.filter((n) => n.document_id !== sessionId));
    setQuizzes((prev) => prev.filter((q) => q.document_id !== sessionId));
    setFlashcardDecks((prev) => prev.filter((d) => d.document_id !== sessionId));
    setFlashcards((prev) => prev.filter((c) => !c.deck_id || !flashcardDecks.some((d) => d.id === c.deck_id && d.document_id === sessionId)));
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
    }
  };

  // Filter items specifically for the active session
  const sessionSummary = summaries.find((s) => s.document_id === activeSession?.id);
  const sessionExplanation = studyNotes.find((n) => n.document_id === activeSession?.id && n.subject === "explanation");
  const sessionNotes = studyNotes.find((n) => n.document_id === activeSession?.id && (n.subject === "exam_notes" || n.subject === "notes"));
  const sessionDecks = flashcardDecks.filter((d) => d.document_id === activeSession?.id);
  const sessionCards = flashcards.filter((c) => sessionDecks.some((d) => d.id === c.deck_id));
  // Formal practice quizzes only (excluding non-stop drill questions)
  const sessionQuizzes = quizzes.filter((q) => q.document_id === activeSession?.id && !q.title?.includes("[DRILL]"));
  // Dedicated Special Non-Stop Drill question batches
  const sessionDrillQuizzes = quizzes.filter((q) => q.document_id === activeSession?.id && q.title?.includes("[DRILL]"));
  const sessionAttempts = quizAttempts.filter((a) => sessionQuizzes.some((q) => q.id === a.quiz_id));
  const sessionAllQuestions = useMemo(() => {
    return sessionQuizzes.flatMap((q) => q.quiz_questions || []);
  }, [sessionQuizzes]);
  const sessionDrillQuestions = useMemo(() => {
    return sessionDrillQuizzes.flatMap((q) => q.quiz_questions || []);
  }, [sessionDrillQuizzes]);

  // Active slide breakdown from extracted text
  const activeSlides = useMemo(() => {
    return parseDocumentSlides(activeSession?.extracted_text || "");
  }, [activeSession?.extracted_text]);

  // Exhaustive Content Coverage Map calculations
  const drillCoverageMetrics = useMemo(() => {
    const totalSlides = Math.max(1, activeSlides.length);
    const coveredSlideNums = new Set<number>();

    sessionDrillQuestions.forEach((q: any) => {
      const ref = String(q.slide_reference || q.slideRef || q.sourceRef || q.explanation || "");
      const match = ref.match(/(?:Slide|Page|Section)\s*(\d+)/i);
      if (match) {
        coveredSlideNums.add(parseInt(match[1], 10));
      } else {
        coveredSlideNums.add(1);
      }
    });

    const coveredCount = coveredSlideNums.size;
    const coveragePct = Math.min(100, Math.round((coveredCount / totalSlides) * 100));

    const totalQuestions = sessionDrillQuestions.length;
    let masteredCount = 0;
    let needsReviewCount = 0;

    sessionDrillQuestions.forEach((_, idx) => {
      const state = drillAnsweredMap[idx];
      if (state) {
        if (state.isCorrect) masteredCount++;
        else needsReviewCount++;
      }
    });

    const answeredCount = masteredCount + needsReviewCount;

    return {
      totalSlides,
      coveredCount,
      coveragePct,
      coveredSlideNums,
      totalQuestions,
      masteredCount,
      needsReviewCount,
      answeredCount,
    };
  }, [activeSlides, sessionDrillQuestions, drillAnsweredMap]);

  // Filtered questions based on selected status filter
  const filteredDrillQuestions = useMemo(() => {
    if (drillFilter === "all") return sessionDrillQuestions;
    if (drillFilter === "mastered") {
      return sessionDrillQuestions.filter((_, idx) => drillAnsweredMap[idx]?.isCorrect === true);
    }
    if (drillFilter === "needs_review") {
      return sessionDrillQuestions.filter((_, idx) => drillAnsweredMap[idx]?.isCorrect === false);
    }
    return sessionDrillQuestions;
  }, [sessionDrillQuestions, drillFilter, drillAnsweredMap]);

  // ─────────────────────────────────────────────────────────────
  // LOADING & AUTH GATEWAY
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[70vh] bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (isConfigured && !user) {
    const loginUrl = pendingJoinCode ? `/auth/login?join=${encodeURIComponent(pendingJoinCode)}` : "/auth/login";
    const signupUrl = pendingJoinCode ? `/auth/signup?join=${encodeURIComponent(pendingJoinCode)}` : "/auth/signup";

    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-140px)] bg-slate-50/60 dark:bg-slate-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-8 text-center space-y-5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            {pendingJoinCode ? <Users className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {pendingJoinCode ? `Join Class Group (${pendingJoinCode})` : "Sign in to your workspace"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {pendingJoinCode
                ? "Sign in or create a free account to join this live quiz study group with your classmates."
                : "Your uploaded slides, notes, flashcards, and practice quizzes are saved privately to your account."}
            </p>
          </div>
          <div className="space-y-2.5 pt-1">
            <Link
              href={loginUrl}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              <span>Sign in</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href={signupUrl}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors"
            >
              <span>Create account</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Student";

  return (
    <div className="flex-1 w-full max-w-[100vw] overflow-x-hidden bg-white dark:bg-slate-950 pb-20 transition-colors">
      
      {/* ─────────────────────────────────────────────────────────
          TOP HEADER - MOBILE-FIRST FULL-VIEWPORT WORKSPACE BAR
      ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Always-Visible LAMLA Guide Logo & Brand Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveSession(null);
                setDashboardScope("home");
              }}
              className="flex items-center gap-2 shrink-0 text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                  LAMLA Guide
                </span>
                <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  AI Study Companion
                </span>
              </div>
            </button>

            {activeSession && (
              <>
                <span className="text-slate-300 dark:text-slate-700 hidden md:inline">/</span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate max-w-[200px] lg:max-w-md hidden md:inline">
                  {activeSession.title}
                </span>
              </>
            )}
          </div>

          {/* Right: Clean Action Controls (Never Crowds Logo on Phone) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Desktop Timer Badge */}
            <div className="hidden md:block">
              <DashboardStudyTimerBadge
                activeSessionId={activeSession?.id}
                userId={user?.id}
                isWindowFocused={isWindowFocused}
                totalStudyMinutes={profile?.total_study_minutes || 0}
                onMinuteCompleted={handleMinuteCompleted}
              />
            </div>

            <Link
              href="/"
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
              title="View Main Website"
            >
              <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Main Site</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-colors"
              title="Show Class QR Code"
              aria-label="Show Class QR Code"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">QR Code</span>
            </button>

            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="capitalize">{currentPlan}</span>
              {!isUnlimitedPlan && (
                <span className="text-slate-400">({sessions.length}/{planLimit})</span>
              )}
            </div>

            {!isUnlimitedPlan && (
              <button
                type="button"
                onClick={() => {
                  setUpgradeReason(`You are currently on the ${currentPlan} plan (${sessions.length}/${planLimit} sessions used). Upgrade for additional sessions and full flashcards.`);
                  setShowUpgradeModal(true);
                }}
                className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-colors"
              >
                Upgrade
              </button>
            )}

            {isAdmin && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold items-center gap-1.5 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden md:inline">Admin</span>
              </Link>
            )}

            {canInstallPwa && (
              <button
                type="button"
                onClick={async () => {
                  if (pwaPromptEvent) {
                    try {
                      await pwaPromptEvent.prompt();
                      const res = await pwaPromptEvent.userChoice;
                      if (res?.outcome === "accepted") {
                        setCanInstallPwa(false);
                        setPwaPromptEvent(null);
                      }
                    } catch {}
                  }
                }}
                className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold items-center gap-1.5 transition-colors shadow-sm"
                title="Install LAMLA Guide App"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Install App</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleTheme}
              className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
              title={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
              aria-label="Toggle color theme"
            >
              {currentTheme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
              title="Settings"
              aria-label="Open settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Secondary Quick-Access Bar (Shows Main Website Link, Timer, Plan, Admin & Install App cleanly on phones) */}
        <div className="md:hidden border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 shrink-0"
            >
              <Home className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>Main Website</span>
            </Link>

            <DashboardStudyTimerBadge
              activeSessionId={activeSession?.id}
              userId={user?.id}
              isWindowFocused={isWindowFocused}
              totalStudyMinutes={profile?.total_study_minutes || 0}
              onMinuteCompleted={handleMinuteCompleted}
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 capitalize">
              {currentPlan}{!isUnlimitedPlan ? ` (${sessions.length}/${planLimit})` : ""}
            </span>

            {!isUnlimitedPlan && (
              <button
                type="button"
                onClick={() => {
                  setUpgradeReason(`You are currently on the ${currentPlan} plan (${sessions.length}/${planLimit} sessions used). Upgrade for additional sessions and full flashcards.`);
                  setShowUpgradeModal(true);
                }}
                className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[11px] font-semibold"
              >
                Upgrade
              </button>
            )}

            {isAdmin && (
              <Link
                href="/admin"
                className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-semibold flex items-center gap-1"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>Admin</span>
              </Link>
            )}

            {canInstallPwa && (
              <button
                type="button"
                onClick={async () => {
                  if (pwaPromptEvent) {
                    try {
                      await pwaPromptEvent.prompt();
                      const res = await pwaPromptEvent.userChoice;
                      if (res?.outcome === "accepted") {
                        setCanInstallPwa(false);
                        setPwaPromptEvent(null);
                      }
                    } catch {}
                  }
                }}
                className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-semibold flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">

        {/* Post-Registration Browser Notification Request Banner */}
        {showNotifBanner && (
          <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Enable Study & Quiz Reminders
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Get notified when live group quizzes begin and when your daily study routines are due.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("lamla_prompt_notifications");
                  } catch {}
                  setShowNotifBanner(false);
                }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Later
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if ("Notification" in window) {
                      await Notification.requestPermission();
                    }
                    localStorage.removeItem("lamla_prompt_notifications");
                  } catch {}
                  setShowNotifBanner(false);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                Enable Notifications
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────
            VIEW A: ACTIVE INDEPENDENT STUDY SESSION WORKSPACE
        ─────────────────────────────────────────────────────────── */}
        {activeSession ? (
          <div className="space-y-6">
            
            {/* Clean White Session Header */}
            <div className="pb-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveSession(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>All sessions</span>
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  {activeSession.title}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeSlides.length} {activeSlides.length === 1 ? "slide" : "slides"} &bull; Created {new Date(activeSession.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowQuizModal(true)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                >
                  <Timer className="w-4 h-4" />
                  <span>New quiz</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSession(activeSession.id)}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  title="Delete session"
                  aria-label="Delete session"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2-Column Study Workspace Layout */}
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
              {/* Left Navigation Sidebar */}
              <aside className="w-full lg:w-60 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 lg:sticky lg:top-22 transition-colors">
                <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible no-scrollbar" aria-label="Session tools">
                  {[
                    { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" /> },
                    { id: "tutor", label: "AI Tutor", icon: <MessageSquare className="w-4 h-4" /> },
                    { id: "smart_drill", label: "Slide Drill", icon: <Zap className="w-4 h-4" />, count: sessionDrillQuestions.length || undefined },
                    { id: "summary", label: "Summary", icon: <FileText className="w-4 h-4" /> },
                    { id: "notes", label: "Detailed Notes", icon: <BookOpen className="w-4 h-4" /> },
                    {
                      id: "flashcards",
                      label: "Flashcards",
                      icon: <Layers className="w-4 h-4" />,
                      count: canAccessFlashcards && sessionCards.length > 0 ? sessionCards.length : undefined,
                      isLocked: !canAccessFlashcards,
                    },
                    { id: "quizzes", label: "Practice Quizzes", icon: <Timer className="w-4 h-4" />, count: sessionQuizzes.length || undefined },
                    { id: "notebook", label: "Mistakes", icon: <AlertCircle className="w-4 h-4" />, count: currentSessionMistakes.length || undefined },
                    { id: "materials", label: "Source Slides", icon: <UploadCloud className="w-4 h-4" />, count: activeSlides.length || undefined },
                    { id: "progress", label: "Progress", icon: <BarChart2 className="w-4 h-4" /> },
                  ].map((tab: any) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          if (tab.id === "flashcards" && !canAccessFlashcards) {
                            setUpgradeReason("Flashcards with spaced repetition are available on Standard and Premium plans.");
                            setShowUpgradeModal(true);
                            return;
                          }
                          setActiveTab(tab.id as SessionTab);
                        }}
                        className={`shrink-0 lg:w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs sm:text-sm transition-colors ${
                          isActive
                            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white font-medium"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className={isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}>
                            {tab.icon}
                          </span>
                          <span className="truncate">{tab.label}</span>
                          {tab.isLocked && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        </span>
                        {tab.count !== undefined && (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            isActive
                              ? "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </aside>

              {/* Main Tab Content Area */}
              <div className="flex-1 min-w-0 w-full space-y-6">

                {/* ─── TAB 1: OVERVIEW ─── */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="bg-slate-50/70 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Format</span>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{activeSession.file_type || "Slides"}</p>
                        <span className="text-xs text-slate-500">{activeSlides.length} slides</span>
                      </div>

                      <div className="bg-slate-50/70 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Summary</span>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{sessionSummary ? "Ready" : "Not created"}</p>
                        <span className="text-xs text-slate-500">{sessionNotes ? "Notes ready" : "Notes optional"}</span>
                      </div>

                      <div className="bg-slate-50/70 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Quizzes</span>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{sessionQuizzes.length}</p>
                        <span className="text-xs text-slate-500">{sessionAttempts.length} attempts</span>
                      </div>

                      <div className="bg-slate-50/70 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Flashcards</span>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{sessionCards.length}</p>
                        <span className="text-xs text-slate-500">{sessionCards.length > 0 ? "Deck ready" : "Not created"}</span>
                      </div>
                    </div>

                    {/* Study Tools for This Session */}
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Study tools</h2>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          Everything below is generated strictly from your uploaded material.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Quick Summary */}
                        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 bg-white dark:bg-slate-900">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs font-medium text-slate-500">
                                {sessionSummary ? "Ready" : "Not generated"}
                              </span>
                            </div>
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm pt-1">Summary</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Concise key points, diagrams, and topic video recommendations.
                            </p>
                          </div>
                          {sessionSummary ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab("summary")}
                              className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              Open summary
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={generatingResource === "summary"}
                              onClick={() => handleGenerateAdditionalResource("summary")}
                              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
                            >
                              {generatingResource === "summary" ? "Generating..." : "Generate summary"}
                            </button>
                          )}
                        </div>

                        {/* Detailed Notes */}
                        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 bg-white dark:bg-slate-900">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs font-medium text-slate-500">
                                {sessionNotes ? "Ready" : "Not generated"}
                              </span>
                            </div>
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm pt-1">Detailed Notes</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Full slide-by-slide breakdown with source citations.
                            </p>
                          </div>
                          {sessionNotes ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab("notes")}
                              className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              Open notes
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={generatingResource === "notes"}
                              onClick={() => handleGenerateAdditionalResource("notes")}
                              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
                            >
                              {generatingResource === "notes" ? "Generating..." : "Generate notes"}
                            </button>
                          )}
                        </div>

                        {/* Personal AI Tutor */}
                        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 bg-white dark:bg-slate-900">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs font-medium text-slate-500">Interactive</span>
                            </div>
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm pt-1">AI Tutor</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Ask questions by text or voice grounded directly in these slides.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab("tutor")}
                            className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors"
                          >
                            Open tutor
                          </button>
                        </div>

                        {/* Slide Drill */}
                        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 bg-white dark:bg-slate-900">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs font-medium text-slate-500">
                                {sessionAllQuestions.length} questions
                              </span>
                            </div>
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm pt-1">Slide Drill</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Continuous active-recall questions with immediate explanations.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab("smart_drill")}
                            className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            Start drill
                          </button>
                        </div>

                        {/* Flashcards */}
                        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 bg-white dark:bg-slate-900">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs font-medium text-slate-500">
                                {!canAccessFlashcards ? "Standard+" : sessionCards.length > 0 ? `${sessionCards.length} cards` : "Not generated"}
                              </span>
                            </div>
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm pt-1 flex items-center gap-1.5">
                              <span>Flashcards</span>
                              {!canAccessFlashcards && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Flip cards with spaced-repetition intervals for memory retention.
                            </p>
                          </div>
                          {!canAccessFlashcards ? (
                            <button
                              type="button"
                              onClick={() => {
                                setUpgradeReason("Flashcards with spaced repetition are available on Standard and Premium plans.");
                                setShowUpgradeModal(true);
                              }}
                              className="w-full py-2 px-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Unlock flashcards</span>
                            </button>
                          ) : sessionCards.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab("flashcards")}
                              className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              Review cards
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={generatingResource === "flashcards"}
                              onClick={() => handleGenerateAdditionalResource("flashcards")}
                              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
                            >
                              {generatingResource === "flashcards" ? "Generating..." : "Generate flashcards"}
                            </button>
                          )}
                        </div>

                        {/* Practice Quizzes */}
                        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 bg-white dark:bg-slate-900">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Timer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs font-medium text-slate-500">
                                {sessionQuizzes.length > 0 ? `${sessionQuizzes.length} saved` : "None yet"}
                              </span>
                            </div>
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm pt-1">Practice Quizzes</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Timed exam-style tests with grading and detailed answer reviews.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (sessionQuizzes.length > 0) setActiveTab("quizzes");
                              else setShowQuizModal(true);
                            }}
                            className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            {sessionQuizzes.length > 0 ? "Open quizzes" : "Create quiz"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── TAB 2: SOURCE SLIDES & EXTRACTED MATERIALS ─── */}
                {activeTab === "materials" && (
                  <div className="space-y-5">
                    {/* Source Slides Toolbar */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                              Source Slides
                            </h2>
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {activeSlides.length} {activeSlides.length === 1 ? "slide" : "slides"}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Extracted verbatim from your uploaded material.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center text-xs">
                            <button
                              type="button"
                              onClick={() => setSlideViewMode("deck")}
                              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                                slideViewMode === "deck"
                                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                              }`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Slides</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSlideViewMode("document")}
                              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                                slideViewMode === "document"
                                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Full text</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              playTrack(
                                `${activeSession.title} — Source Material`,
                                "summary",
                                activeSession.extracted_text
                              );
                            }}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Listen to source material"
                            aria-label="Listen to source material"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="search"
                            aria-label="Search slides"
                            value={slideSearchQuery}
                            onChange={(e) => setSlideSearchQuery(e.target.value)}
                            placeholder="Search slides..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                          />
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {activeSession.extracted_text.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                        </div>
                      </div>

                      {slideViewMode === "deck" && activeSlides.length > 1 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                          <span className="text-xs font-medium text-slate-400 shrink-0 mr-1">
                            Jump to:
                          </span>
                          {activeSlides.map((s) => (
                            <a
                              key={s.slideNumber}
                              href={`#slide-${s.slideNumber}`}
                              className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-300 text-slate-600 dark:text-slate-300 text-xs font-medium shrink-0 transition-colors"
                            >
                              {s.slideNumber}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {slideViewMode === "deck" ? (
                      (() => {
                        const filtered = activeSlides.filter((s) => {
                          if (!slideSearchQuery.trim()) return true;
                          const q = slideSearchQuery.toLowerCase();
                          return s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q);
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
                              <Search className="w-6 h-6 text-slate-400 mx-auto" />
                              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">No matching slides</h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Try another keyword.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            {filtered.map((slide) => (
                              <div
                                key={slide.slideNumber}
                                id={`slide-${slide.slideNumber}`}
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800 font-semibold text-xs shrink-0">
                                      Slide {slide.slideNumber}
                                    </span>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                      {slide.title}
                                    </h3>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleGenerateDrillQuestions([slide], 6);
                                        setActiveTab("smart_drill");
                                      }}
                                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                                    >
                                      <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                      <span>Drill slide</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTutorInput(`Please explain Slide ${slide.slideNumber}: ${slide.title} in detail.`);
                                        setActiveTab("tutor");
                                      }}
                                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                      <span>Ask tutor</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        playTrack(`Slide ${slide.slideNumber}: ${slide.title}`, "summary", slide.content);
                                      }}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                      title="Read slide aloud"
                                      aria-label={`Read Slide ${slide.slideNumber} aloud`}
                                    >
                                      <Volume2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap selection:bg-blue-100 dark:selection:bg-blue-900">
                                  {slide.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">Full text transcript</h3>
                          <span className="text-xs text-slate-500">{activeSession.extracted_text.length.toLocaleString()} characters</span>
                        </div>
                        <div className="p-5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                          {activeSession.extracted_text}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB 3: SUMMARY ─── */}
                {activeTab === "summary" && (
                  <div className="space-y-6">
                    {sessionSummary ? (
                      <div className="space-y-4">
                        <StudyContentRenderer
                          content={sessionSummary.content}
                          title={activeSession.title}
                          badge="Summary"
                          badgeColor="blue"
                          sourceType="summary"
                        />
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="button"
                            disabled={generatingResource === "summary"}
                            onClick={() => handleGenerateAdditionalResource("summary")}
                            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${generatingResource === "summary" ? "animate-spin" : ""}`} />
                            <span>
                              {generatingResource === "summary" ? "Regenerating Summary..." : "Regenerate Full Summary"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setThreeWaysConcept(activeSession.title);
                              setShowThreeWaysModal(true);
                            }}
                            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Explain core concept in 3 ways</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
                        <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">No summary yet</h3>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                          Generate a clear, structured summary from your uploaded slides.
                        </p>
                        <button
                          type="button"
                          disabled={generatingResource === "summary"}
                          onClick={() => handleGenerateAdditionalResource("summary")}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors"
                        >
                          {generatingResource === "summary" ? "Generating..." : "Generate summary"}
                        </button>
                      </div>
                    )}

                    {/* Topic Educational Videos at the End of Every Summary */}
                    <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                      <EducationalVideoCuration
                        documentTitle={activeSession.title}
                        extractedText={activeSession.extracted_text}
                        sessionId={activeSession.id}
                        onAskTutorAboutVideo={(videoTitle, channel, topic) => {
                          setActiveTab("tutor");
                          setTutorInput(`I watched the video '${videoTitle}' by ${channel} explaining ${topic}. Can you explain how this connects with our lecture slides?`);
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* ─── TAB: DETAILED NOTES ─── */}
                {activeTab === "notes" && (
                  <div className="space-y-4">
                    {sessionNotes && (
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 rounded-xl px-4 py-2.5">
                        <span className="text-xs text-slate-700 dark:text-slate-300">
                          Want freshly expanded slide-by-slide notes explaining every concept on every slide with internet context?
                        </span>
                        <button
                          type="button"
                          disabled={generatingResource === "notes"}
                          onClick={() => handleGenerateAdditionalResource("notes")}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${generatingResource === "notes" ? "animate-spin" : ""}`} />
                          <span>
                            {generatingResource === "notes"
                              ? "Generating Ultra-Detailed Notes..."
                              : "Regenerate Ultra-Detailed Notes"}
                          </span>
                        </button>
                      </div>
                    )}
                    {sessionNotes ? (
                      <SourceGroundedNotesWorkspace
                        content={sessionNotes.content}
                        title={`${activeSession.title} — Detailed Notes`}
                        slides={activeSlides}
                        sessionId={activeSession.id}
                        noteId={sessionNotes.id}
                        onUpdateContent={async (newContent) => {
                          try {
                            await supabase
                              .from("study_notes")
                              .update({ content: newContent })
                              .eq("id", sessionNotes.id);
                            setStudyNotes((prev) =>
                              prev.map((n) => (n.id === sessionNotes.id ? { ...n, content: newContent } : n))
                            );
                          } catch (e) {
                            console.error("Failed to persist updated note:", e);
                          }
                        }}
                        onJumpToSlide={(slideNum) => {
                          setActiveTab("materials");
                          setSlideViewMode("deck");
                          setTimeout(() => {
                            const el = document.getElementById(`slide-${slideNum}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 200);
                        }}
                        onAskTutorAboutSlide={(slideNum, slideTitle) => {
                          setActiveTab("tutor");
                          setTutorInput(`Can you explain the key concepts on Slide ${slideNum} (${slideTitle}) in simple terms?`);
                        }}
                      />
                    ) : (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
                        <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">No detailed notes yet</h3>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                          Generate comprehensive notes covering concepts, definitions, mechanisms, and slide citations.
                        </p>
                        <button
                          type="button"
                          disabled={generatingResource === "notes"}
                          onClick={() => handleGenerateAdditionalResource("notes")}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors"
                        >
                          {generatingResource === "notes" ? "Generating..." : "Generate detailed notes"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB: PERSONAL AI TUTOR (CENTERED CHAT WORKSPACE) ─── */}
                {activeTab === "tutor" && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[calc(100vh-12.5rem)] min-h-[480px] max-h-[680px] overflow-hidden transition-colors">
                    {/* Clean White Tutor Header */}
                    <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-bold text-sm text-slate-900 dark:text-white">AI Tutor</h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            Grounded in {activeSession.title}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowTutorSettings(!showTutorSettings)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                            showTutorSettings
                              ? "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          <span>Voice &amp; output</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (speechRec.isListening) speechRec.stopListening();
                            speechRec.resetTranscript();
                            setTutorMessages([{
                              role: "assistant",
                              content: "Ask me any question about your uploaded slides, or pick a prompt below to begin.",
                            }]);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>
                      </div>
                    </div>

                    {/* Optional Voice & Output Settings */}
                    {showTutorSettings && (
                      <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs shrink-0">
                        <div className="space-y-1">
                          <label htmlFor="tutor-input-mode" className="font-semibold text-slate-700 dark:text-slate-200 block">
                            Input mode
                          </label>
                          <select
                            id="tutor-input-mode"
                            value={tutorInputMode}
                            onChange={(e) => setTutorInputMode(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="both">Text and microphone</option>
                            <option value="text">Text only</option>
                            <option value="voice">Microphone only</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="tutor-response-mode" className="font-semibold text-slate-700 dark:text-slate-200 block">
                            Response mode
                          </label>
                          <select
                            id="tutor-response-mode"
                            value={tutorResponseMode}
                            onChange={(e) => setTutorResponseMode(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="both">Written and spoken</option>
                            <option value="written">Written only</option>
                            <option value="spoken">Auto-read aloud</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Suggested Prompts */}
                    <div className="px-5 py-2.5 bg-slate-50/60 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar shrink-0">
                      {[
                        { label: "Explain simply", query: "Please explain the core concepts of these lecture slides simply without jargon, using an intuitive everyday analogy.", actionType: "explain_simply" },
                        { label: "Draw & visualize", query: "Please draw and visualize a detailed labeled concept diagram for this topic with explanations.", actionType: "draw_visualize" },
                        { label: "Step by step", query: "Please break down the primary mechanism or process in these slides step by step.", actionType: "step_by_step" },
                        { label: "Real-world example", query: "Can you provide concrete, real-world examples (with Ghanaian context where suitable) of how this works?", actionType: "give_example" },
                        { label: "Compare concepts", query: "What are the most crucial differences and comparisons between key concepts in these slides?", actionType: "compare_concepts" },
                        { label: "Test my understanding", query: "Ask me 2 interactive Socratic check questions based directly on the slides to test my understanding.", actionType: "test_understanding" },
                        { label: "Practice questions", query: "Create 3 high-yield exam-style practice questions with model answers and slide citations.", actionType: "create_questions" },
                      ].map((chip) => (
                        <button
                          key={chip.actionType}
                          type="button"
                          disabled={tutorLoading}
                          onClick={() => handleSendTutorMessage(chip.query, chip.actionType)}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-slate-200 dark:border-slate-700 hover:border-blue-200 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>

                    {/* Messages Transcript */}
                    <div 
                      ref={messagesContainerRef}
                      onScroll={handleMessagesScroll}
                      className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-4 bg-white dark:bg-slate-950/40"
                    >
                      {tutorMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {msg.role === "assistant" && (
                            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                              AI
                            </div>
                          )}
                          <div
                            className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                              msg.role === "user"
                                ? "bg-blue-600 text-white"
                                : "bg-slate-50/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {msg.role === "assistant" ? (
                              <div>
                                <div className="prose prose-sm max-w-none prose-slate dark:prose-invert">
                                  <VisualMarkdown content={msg.content} />
                                </div>
                                <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/80 flex items-center">
                                  <button
                                    type="button"
                                    onClick={() => playTutorAnswer(msg.content, `AI Tutor Answer (#${idx + 1})`)}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                                    title="Read response aloud"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                    <span>Listen</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                          </div>
                        </div>
                      ))}

                      {speechRec.isListening && (
                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
                            <span className="font-semibold shrink-0">Listening:</span>
                            <span className="truncate text-blue-700 dark:text-blue-300">
                              {speechRec.transcript || speechRec.interimTranscript || "Speak now..."}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => speechRec.stopListening()}
                            className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shrink-0 ml-2"
                          >
                            Done
                          </button>
                        </div>
                      )}

                      {speechRec.error && (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>{speechRec.error}</span>
                          <button
                            type="button"
                            onClick={() => speechRec.resetTranscript()}
                            className="font-semibold underline ml-2"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}

                      {tutorLoading && (
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 text-xs font-bold">
                            AI
                          </div>
                          <div className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                            Thinking...
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} className="h-1" />
                    </div>

                    {/* Tutor Input Bar */}
                    <div className="shrink-0 p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      {tutorInputMode !== "text" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (speechRec.isListening) {
                              speechRec.stopListening();
                            } else {
                              speechRec.resetTranscript();
                              speechRec.startListening();
                            }
                          }}
                          disabled={!speechRec.isSupported || tutorLoading}
                          aria-label={speechRec.isListening ? "Stop voice input" : "Start voice input"}
                          className={`p-2.5 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                            speechRec.isListening
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                          } disabled:opacity-40`}
                          title={
                            !speechRec.isSupported
                              ? "Voice input requires Chrome, Edge, or Safari"
                              : speechRec.isListening
                              ? "Stop voice input"
                              : "Speak your question"
                          }
                        >
                          {speechRec.isListening ? (
                            <MicOff className="w-4 h-4" />
                          ) : (
                            <Mic className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <input
                        type="text"
                        aria-label="Ask AI Tutor"
                        value={tutorInput}
                        onChange={(e) => setTutorInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendTutorMessage();
                          }
                        }}
                        placeholder={
                          speechRec.isListening
                            ? "Listening..."
                            : tutorInputMode === "voice"
                            ? "Tap the microphone to ask a question..."
                            : "Ask a question about your slides..."
                        }
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors placeholder:text-slate-400"
                      />

                      <button
                        type="button"
                        disabled={!tutorInput.trim() || tutorLoading}
                        onClick={() => handleSendTutorMessage()}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors shrink-0"
                      >
                        <Send className="w-4 h-4" />
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── TAB: SLIDE DRILL ─── */}
                {activeTab === "smart_drill" && (
                  <div className="space-y-5 max-w-4xl mx-auto">
                    {(() => {
                      const multiplier = drillStreak >= 10 ? 5 : drillStreak >= 5 ? 2.5 : drillStreak >= 3 ? 1.5 : 1;
                      const nextXP = Math.round(2 * multiplier);

                      return (
                        <>
                          {/* Drill Header & Progress */}
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2.5">
                                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Slide Drill
                                  </h2>
                                  {drillStreak > 0 && (
                                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800">
                                      {drillStreak} in a row
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {sessionDrillQuestions.length} questions across {activeSlides.length} slides
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                                {[
                                  { id: "all", label: `All (${sessionDrillQuestions.length})` },
                                  { id: "mastered", label: `Mastered (${drillCoverageMetrics.masteredCount})` },
                                  { id: "needs_review", label: `Needs review (${drillCoverageMetrics.needsReviewCount})` },
                                ].map((f) => (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => {
                                      setDrillFilter(f.id as any);
                                      setDrillIndex(0);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                      drillFilter === f.id
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    }`}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {filteredDrillQuestions.length > 0 && (
                              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                  <span>
                                    Question {(drillIndex % filteredDrillQuestions.length) + 1} of {filteredDrillQuestions.length}
                                  </span>
                                  <span>
                                    {Math.round((Object.keys(drillAnsweredMap).length / Math.max(1, filteredDrillQuestions.length)) * 100)}% answered
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                                    style={{
                                      width: `${Math.min(100, Math.round((Object.keys(drillAnsweredMap).length / Math.max(1, filteredDrillQuestions.length)) * 100))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Drill Question Card */}
                          {filteredDrillQuestions.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
                              <Zap className="w-8 h-8 text-slate-400 mx-auto" />
                              <div className="space-y-1">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                  {drillFilter === "needs_review"
                                    ? "No questions need review"
                                    : "No drill questions yet"}
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                  {drillFilter === "needs_review"
                                    ? "You have answered all reviewed questions accurately."
                                    : "Generate active-recall questions directly from your uploaded slides."}
                                </p>
                              </div>
                              <div className="flex items-center justify-center gap-2.5 pt-2">
                                <button
                                  type="button"
                                  disabled={drillGeneratingMore}
                                  onClick={() => handleGenerateDrillQuestions()}
                                  className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>{drillGeneratingMore ? "Generating..." : "Generate 15 questions"}</span>
                                </button>
                                {drillFilter !== "all" && (
                                  <button
                                    type="button"
                                    onClick={() => setDrillFilter("all")}
                                    className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-colors"
                                  >
                                    Show all
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            (() => {
                              const activeQList = filteredDrillQuestions;
                              const currentQ = activeQList[drillIndex % activeQList.length];
                              const actualQuestionGlobalIndex = sessionDrillQuestions.findIndex(q => (q.id && q.id === currentQ.id) || q.question_text === currentQ.question_text);
                              const targetIndexForState = actualQuestionGlobalIndex >= 0 ? actualQuestionGlobalIndex : drillIndex;

                              const stateForQ = drillAnsweredMap[targetIndexForState];
                              const isAnswered = !!stateForQ || !!drillSelected;
                              const selectedOpt = stateForQ?.selected || drillSelected;

                              const ca = String(currentQ.correct_answer || currentQ.correctAnswer || "").trim().toLowerCase();
                              const caLetter = ca.match(/^[a-e]/i)?.[0]?.toLowerCase() || ca;

                              const isTrueFalse =
                                currentQ.question_type === "true_false" ||
                                (currentQ.options?.length === 2 && currentQ.options.some((o: string) => o.toLowerCase() === "true" || o.toLowerCase() === "false"));

                              const optionsToRender: string[] = isTrueFalse
                                ? ["True", "False"]
                                : (currentQ.options || []);

                              const checkIsCorrect = (optText: string, optIdx: number) => {
                                const normOpt = optText.toLowerCase().trim();
                                if (ca === normOpt) return true;
                                if (normOpt === "true" && (ca === "true" || ca === "t" || caLetter === "a")) return true;
                                if (normOpt === "false" && (ca === "false" || ca === "f" || caLetter === "b")) return true;
                                const optLetter = optText.match(/^[a-e]/i)?.[0]?.toLowerCase() || String.fromCharCode(97 + optIdx);
                                if (caLetter === optLetter) return true;
                                return false;
                              };

                              const speakDrillQuestionPrompt = (q: any, qNum: number) => {
                                setDrillAudioInteractive(true);
                                const qText = q.question_text || q.question || "";
                                let textToRead = `Question ${qNum}. ${qText}. `;
                                const isTf =
                                  q.question_type === "true_false" ||
                                  (q.options?.length === 2 &&
                                    q.options.some((o: string) => o.toLowerCase() === "true" || o.toLowerCase() === "false"));
                                if (isTf) {
                                  textToRead += "Is this statement True, or False?";
                                } else if (q.options && q.options.length > 0) {
                                  textToRead +=
                                    "The options are: " +
                                    q.options
                                      .map((opt: string, i: number) => `Option ${String.fromCharCode(65 + i)}: ${opt}`)
                                      .join(". ") +
                                    ". What is your answer?";
                                } else {
                                  textToRead += "What is your answer?";
                                }
                                playTrack(`Drill Question ${qNum}`, "drill", textToRead);
                              };

                              const onSelectAnswer = (optText: string, optIdx: number) => {
                                if (isAnswered) return;
                                const correct = checkIsCorrect(optText, optIdx);
                                setDrillSelected(optText);
                                setDrillAnsweredMap((prev) => ({
                                  ...prev,
                                  [targetIndexForState]: { selected: optText, isCorrect: correct }
                                }));

                                if (correct) {
                                  const nextStreak = drillStreak + 1;
                                  setDrillStreak(nextStreak);
                                  const mult = nextStreak >= 10 ? 5 : nextStreak >= 5 ? 2.5 : nextStreak >= 3 ? 1.5 : 1;
                                  const gained = Math.round(2 * mult);
                                  updateStudyStats(0, gained);
                                } else {
                                  setDrillStreak(0);
                                }
                              };

                              const formatQuestionTypeLabel = (type: string) => {
                                if (isTrueFalse) return "True / False";
                                if (type === "assertion_reasoning") return "Assertion & Reason";
                                if (type === "fill_in_the_blank") return "Fill in the blank";
                                if (type === "direct_recall") return "Direct recall";
                                if (type === "list_enumeration") return "Enumeration";
                                if (type === "sequence_ordering") return "Ordering";
                                if (type === "comparison") return "Comparison";
                                return "Multiple choice";
                              };

                              const showFeedback = isAnswered;

                              return (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
                                  {/* Question Meta Header */}
                                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                        {formatQuestionTypeLabel(currentQ.question_type)}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        speakDrillQuestionPrompt(currentQ, (drillIndex % activeQList.length) + 1);
                                      }}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                                      title="Listen to question"
                                    >
                                      <Volume2 className="w-3.5 h-3.5" />
                                      <span>Listen</span>
                                    </button>
                                  </div>

                                  {/* Question Prompt */}
                                  {currentQ.question_type === "assertion_reasoning" ? (
                                    <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                      <div className="flex items-start gap-2.5">
                                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs shrink-0">Assertion</span>
                                        <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                                          {String(currentQ.assertion || (currentQ.question_text?.includes("Assertion (A):") ? currentQ.question_text.split(/\nReason \(R\):/i)[0]?.replace(/^Assertion \(A\):\s*/i, "").trim() : currentQ.question_text || currentQ.question) || "").replace(/\s*\((?:Slide|Page)\s*#?\s*\d+[^)]*\)/gi, "")}
                                        </p>
                                      </div>
                                      <div className="flex items-start gap-2.5">
                                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs shrink-0">Reason</span>
                                        <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                                          {String(currentQ.reason || (currentQ.question_text?.includes("Reason (R):") ? currentQ.question_text.split(/\nReason \(R\):/i)[1]?.trim() : "") || "").replace(/\s*\((?:Slide|Page)\s*#?\s*\d+[^)]*\)/gi, "")}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                                      {String(currentQ.question_text || currentQ.question || "").replace(/\s*\((?:Slide|Page)\s*#?\s*\d+[^)]*\)/gi, "").replace(/\b(?:on|in|from|according to)\s+(?:Slide|Page)\s*#?\s*\d+\b,?\s*/gi, "")}
                                    </h3>
                                  )}

                                  {/* Answer Options */}
                                  {isTrueFalse ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {optionsToRender.map((optText, optIdx) => {
                                        const isSelected = selectedOpt?.toLowerCase() === optText.toLowerCase();
                                        const isCorrect = checkIsCorrect(optText, optIdx);

                                        let btnStyle = "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white";
                                        if (showFeedback) {
                                          if (isCorrect) {
                                            btnStyle = "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-100";
                                          } else if (isSelected && !isCorrect) {
                                            btnStyle = "bg-red-50 dark:bg-red-950/60 border-red-400 text-red-900 dark:text-red-100";
                                          } else {
                                            btnStyle = "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60";
                                          }
                                        }

                                        return (
                                          <button
                                            key={optText}
                                            type="button"
                                            disabled={showFeedback}
                                            onClick={() => onSelectAnswer(optText, optIdx)}
                                            className={`p-5 rounded-xl border text-center transition-colors flex flex-col items-center justify-center gap-1.5 ${btnStyle}`}
                                          >
                                            <span className="text-base font-bold">{optText}</span>
                                            {showFeedback && isCorrect && (
                                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                Correct {multiplier > 1 ? `(+${nextXP} XP)` : "(+2 XP)"}
                                              </span>
                                            )}
                                            {showFeedback && isSelected && !isCorrect && (
                                              <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                                                Incorrect
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="space-y-2.5">
                                      {optionsToRender.map((opt: string, optIdx: number) => {
                                        const optText = String(opt).trim();
                                        const optLetter = optText.match(/^[a-e]/i)?.[0]?.toLowerCase() || String.fromCharCode(97 + optIdx);
                                        const isSelected = selectedOpt?.toLowerCase().startsWith(optLetter) || selectedOpt === optText;
                                        const isCorrect = checkIsCorrect(optText, optIdx);

                                        let btnStyle = "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100";
                                        if (showFeedback) {
                                          if (isCorrect) {
                                            btnStyle = "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-100 font-semibold";
                                          } else if (isSelected && !isCorrect) {
                                            btnStyle = "bg-red-50 dark:bg-red-950/60 border-red-400 text-red-900 dark:text-red-100 font-semibold";
                                          } else {
                                            btnStyle = "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-60";
                                          }
                                        }

                                        return (
                                          <button
                                            key={optIdx}
                                            type="button"
                                            disabled={showFeedback}
                                            onClick={() => onSelectAnswer(optText, optIdx)}
                                            className={`w-full text-left p-3.5 sm:p-4 rounded-xl border text-sm sm:text-base transition-colors flex items-center justify-between gap-3 ${btnStyle}`}
                                          >
                                            <div className="flex items-center gap-3">
                                              <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center shrink-0">
                                                {String.fromCharCode(65 + optIdx)}
                                              </span>
                                              <span className="leading-relaxed">{optText}</span>
                                            </div>
                                            {showFeedback && isCorrect && (
                                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                                                Correct
                                              </span>
                                            )}
                                            {showFeedback && isSelected && !isCorrect && (
                                              <span className="text-xs font-semibold text-red-700 dark:text-red-300 shrink-0">
                                                Incorrect
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Explanation & Tutor Link */}
                                  {showFeedback && (
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                                      <div className="space-y-1">
                                        <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                                          Explanation
                                        </span>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                          {currentQ.explanation || "Review the corresponding slide in your study notes to reinforce this concept."}
                                        </p>
                                      </div>
                                      {(currentQ.examiner_insight || currentQ.misconception_tip) && (
                                        <p className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                                          <strong className="text-slate-800 dark:text-slate-100">Note:</strong> {currentQ.examiner_insight || currentQ.misconception_tip}
                                        </p>
                                      )}
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const qText = currentQ.question_text || currentQ.question;
                                            const ansText = currentQ.correct_answer || currentQ.correctAnswer || "";
                                            const prompt = `Please explain this slide question in detail and guide me through the concept step-by-step:\n\nQuestion: "${qText}"\nCorrect Answer: "${ansText}"\n${currentQ.explanation ? `Explanation: "${currentQ.explanation}"` : ""}`;
                                            setActiveTab("tutor");
                                            handleSendTutorMessage(prompt, "drill_clarification");
                                          }}
                                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700"
                                        >
                                          <MessageSquare className="w-3.5 h-3.5" />
                                          <span>Ask AI Tutor for a deeper explanation</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Navigation */}
                                  <div className="flex items-center justify-between pt-2">
                                    <button
                                      type="button"
                                      disabled={drillIndex === 0}
                                      onClick={() => {
                                        setDrillIndex((idx) => Math.max(0, idx - 1));
                                        setDrillSelected(null);
                                      }}
                                      className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
                                    >
                                      <ChevronLeft className="w-4 h-4" />
                                      <span>Previous</span>
                                    </button>

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={drillGeneratingMore}
                                        onClick={() => handleGenerateDrillQuestions()}
                                        className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>{drillGeneratingMore ? "Adding..." : "More questions"}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDrillIndex((idx) => idx + 1);
                                          setDrillSelected(null);
                                        }}
                                        className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors inline-flex items-center gap-1.5"
                                      >
                                        <span>Next</span>
                                        <ChevronRight className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* ─── TAB: FLASHCARDS ─── */}
            {activeTab === "flashcards" && (
              <div className="space-y-5 max-w-2xl mx-auto">
                {!canAccessFlashcards ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-10 text-center space-y-4">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                        Flashcards are available on Standard &amp; Premium
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                        Upgrade your plan to unlock active-recall flip decks with spaced repetition.
                      </p>
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUpgradeReason("Flashcards with spaced repetition are available on Standard and Premium plans.");
                          setShowUpgradeModal(true);
                        }}
                        className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>View plans</span>
                      </button>
                    </div>
                  </div>
                ) : (() => {
                  const filteredCards = sessionCards.filter(
                    (c) =>
                      !flashcardSearchQuery.trim() ||
                      c.front?.toLowerCase().includes(flashcardSearchQuery.toLowerCase()) ||
                      c.back?.toLowerCase().includes(flashcardSearchQuery.toLowerCase())
                  );
                  const activeCard = filteredCards[currentCardIndex] || filteredCards[0];

                  return sessionCards.length > 0 ? (
                    deckCompleted ? (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-10 text-center space-y-6">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            Deck complete
                          </h2>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            You reviewed {filteredCards.length} flashcards (+{filteredCards.length * 3} XP).
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
                          {[
                            { key: "again", label: "Again (1m)" },
                            { key: "hard", label: "Hard (10m)" },
                            { key: "good", label: "Good (1d)" },
                            { key: "easy", label: "Easy (4d)" },
                          ].map((stat) => (
                            <div key={stat.key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                              <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {Object.values(cardReviewHistory).filter((r) => r === stat.key).length}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</div>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setDeckCompleted(false);
                              setCurrentCardIndex(0);
                              setIsFlipped(false);
                            }}
                            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-colors"
                          >
                            Review again
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("quizzes")}
                            className="px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-colors"
                          >
                            Take a practice quiz
                          </button>
                        </div>
                      </div>
                    ) : (
                    <div className="space-y-4">
                      {/* Search & Deck Controls */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="relative w-full sm:w-64">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="search"
                            aria-label="Search flashcards"
                            value={flashcardSearchQuery}
                            onChange={(e) => {
                              setFlashcardSearchQuery(e.target.value);
                              setCurrentCardIndex(0);
                            }}
                            placeholder="Search cards..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                          />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                          {filteredCards.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                playFlashcards(
                                  `${activeSession.title} Flashcards`,
                                  filteredCards.map((c) => ({ front: c.front, back: c.back }))
                                )
                              }
                              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              title="Listen to flashcards aloud"
                            >
                              <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Listen</span>
                            </button>
                          )}
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {filteredCards.length > 0 ? `${currentCardIndex + 1} / ${filteredCards.length}` : "No matches"}
                          </span>
                          <button
                            type="button"
                            disabled={generatingResource === "flashcards"}
                            onClick={() => handleGenerateAdditionalResource("flashcards", flashcardGenerateCount)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                            title="Generate more flashcards"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add {flashcardGenerateCount}</span>
                          </button>
                        </div>
                      </div>

                      {filteredCards.length > 0 && activeCard ? (
                        <>
                          {/* Interactive Flip Card */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setIsFlipped(!isFlipped)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsFlipped(!isFlipped); }}
                            className={`bg-white dark:bg-slate-900 rounded-2xl border p-8 sm:p-10 min-h-[260px] flex flex-col justify-between items-center text-center cursor-pointer transition-colors select-none ${
                              isFlipped
                                ? "border-blue-400 dark:border-blue-500 bg-blue-50/20 dark:bg-blue-950/20"
                                : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700"
                            }`}
                          >
                            <div className="w-full flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                {isFlipped ? "Answer" : "Prompt"}
                              </span>
                              <div className="flex items-center gap-2">
                                <span>{activeCard.slide_reference || "Slide concept"}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playFlashcards("Active Flashcard", [
                                      { front: activeCard.front, back: activeCard.back },
                                    ]);
                                  }}
                                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                  title="Read card aloud"
                                  aria-label="Read card aloud"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="my-auto py-6 w-full">
                              <VisualMarkdown
                                content={isFlipped ? activeCard.back : activeCard.front}
                                compact={true}
                                centeredText={!isFlipped}
                              />
                            </div>

                            <div className="text-xs text-slate-400 dark:text-slate-500">
                              {isFlipped ? "Click to show prompt" : "Click to reveal answer"}
                            </div>
                          </div>

                          {/* Spaced Repetition Ratings */}
                          {isFlipped && (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-medium">How well did you recall this?</span>
                                <span>Next review</span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {[
                                  { rating: "again" as const, label: "Again", interval: "1 min" },
                                  { rating: "hard" as const, label: "Hard", interval: "10 min" },
                                  { rating: "good" as const, label: "Good", interval: "1 day" },
                                  { rating: "easy" as const, label: "Easy", interval: "4 days" },
                                ].map((item) => (
                                  <button
                                    key={item.rating}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRateFlashcard(activeCard.id, item.rating, filteredCards.length);
                                    }}
                                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-slate-800 dark:text-slate-100 text-xs font-semibold text-center transition-colors"
                                  >
                                    <div>{item.label}</div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">{item.interval}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Navigation & Helpers */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={currentCardIndex === 0}
                                onClick={() => { setCurrentCardIndex((prev) => prev - 1); setIsFlipped(false); }}
                                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs disabled:opacity-40 transition-colors"
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                disabled={currentCardIndex >= filteredCards.length - 1}
                                onClick={() => { setCurrentCardIndex((prev) => prev + 1); setIsFlipped(false); }}
                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
                              >
                                Next
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setThreeWaysConcept(activeCard.front);
                                  setShowThreeWaysModal(true);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                              >
                                Explain in 3 ways
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRecallQuestion(activeCard.front);
                                  setShowActiveRecallModal(true);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                              >
                                Self-drill
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-8 text-center text-xs sm:text-sm text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                          No flashcards matched &ldquo;{flashcardSearchQuery}&rdquo;.
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-4">
                      <Layers className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="space-y-1">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">No flashcards yet</h2>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          Create active-recall flip cards from your uploaded slides.
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-2.5 py-1">
                        <label htmlFor="flashcard-deck-size" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Deck size:
                        </label>
                        <select
                          id="flashcard-deck-size"
                          value={flashcardGenerateCount}
                          onChange={(e) => setFlashcardGenerateCount(Number(e.target.value))}
                          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value={10}>10 cards</option>
                          <option value={20}>20 cards</option>
                          <option value={30}>30 cards</option>
                          <option value={50}>50 cards</option>
                          <option value={100}>100 cards</option>
                          <option value={150}>150 cards</option>
                          <option value={200}>200 cards</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        disabled={generatingResource === "flashcards"}
                        onClick={() => handleGenerateAdditionalResource("flashcards", flashcardGenerateCount)}
                        className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors"
                      >
                        {generatingResource === "flashcards" ? "Generating..." : `Generate ${flashcardGenerateCount} flashcards`}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ─── TAB 7: PRACTICE QUIZZES ─── */}
            {activeTab === "quizzes" && (
              <div className="space-y-6">
                {activeQuiz ? (
                  /* Live Quiz Runner */
                  <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6 max-w-2xl mx-auto">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {activeQuiz.time_limit_minutes > 0 ? `Timed (${activeQuiz.time_limit_minutes} min)` : "Practice quiz"}
                        </p>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{activeQuiz.title}</h2>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {quizTimeLeft !== null && !quizSubmitted && (
                          <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-mono flex items-center gap-1.5 ${
                            quizTimeLeft <= 120 
                              ? "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" 
                              : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                          }`}>
                            <Timer className="w-3.5 h-3.5" />
                            <span>{formatTime(quizTimeLeft)}</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveQuiz(null)}
                          className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          Exit
                        </button>
                      </div>
                    </div>

                    {quizTimeExpired && (
                      <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Time expired. Your answers were submitted automatically.</span>
                      </div>
                    )}

                    {quizSubmitted && !quizReviewMode ? (
                      /* Quiz Results Screen */
                      <div className="space-y-6 text-center py-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                          {(quizScore ?? 0) >= 70 ? <Trophy className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                        </div>

                        <div className="space-y-1">
                          <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                            {quizScore}%
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            {(() => {
                              const qs = activeQuiz.quiz_questions || [];
                              let c = 0;
                              qs.forEach((q: any, i: number) => {
                                const selected = (selectedAnswers[i] || "").trim().toLowerCase();
                                const actual = String(q.correct_answer || "").trim().toLowerCase();
                                const selLetter = selected.match(/^[a-e]/i)?.[0]?.toLowerCase() || selected;
                                const actLetter = actual.match(/^[a-e]/i)?.[0]?.toLowerCase() || actual;
                                if (
                                  selected &&
                                  actual &&
                                  (selected === actual ||
                                    selLetter === actLetter ||
                                    actual.startsWith(selected + ".") ||
                                    actual.startsWith(selected + ")") ||
                                    actual.startsWith(selected + " "))
                                ) {
                                  c += 1;
                                }
                              });
                              return `${c} of ${qs.length} correct`;
                            })()}{" "}
                            &bull; {formatTime(quizTimeSpentSeconds)}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-xs text-slate-500 dark:text-slate-400 block">Accuracy</span>
                            <span className="text-base font-bold text-slate-900 dark:text-white">{quizScore}%</span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-xs text-slate-500 dark:text-slate-400 block">XP earned</span>
                            <span className="text-base font-bold text-slate-900 dark:text-white">
                              +{(() => {
                                const qs = activeQuiz.quiz_questions || [];
                                let c = 0;
                                qs.forEach((q: any, i: number) => {
                                  const selected = (selectedAnswers[i] || "").trim().toLowerCase();
                                  const actual = String(q.correct_answer || "").trim().toLowerCase();
                                  const selLetter = selected.match(/^[a-e]/i)?.[0]?.toLowerCase() || selected;
                                  const actLetter = actual.match(/^[a-e]/i)?.[0]?.toLowerCase() || actual;
                                  if (
                                    selected &&
                                    actual &&
                                    (selected === actual ||
                                      selLetter === actLetter ||
                                      actual.startsWith(selected + ".") ||
                                      actual.startsWith(selected + ")") ||
                                      actual.startsWith(selected + " "))
                                  ) {
                                    c += 1;
                                  }
                                });
                                return c * 10 + ((quizScore ?? 0) >= 70 ? 50 : 15);
                              })()}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-xs text-slate-500 dark:text-slate-400 block">Time</span>
                            <span className="text-base font-bold text-slate-900 dark:text-white">{formatTime(quizTimeSpentSeconds)}</span>
                          </div>
                        </div>

                        <div className="space-y-2.5 max-w-md mx-auto pt-1">
                          {(() => {
                            const qs = activeQuiz.quiz_questions || [];
                            let wrongCount = 0;
                            qs.forEach((q: any, i: number) => {
                              const selected = (selectedAnswers[i] || "").trim().toLowerCase();
                              const actual = String(q.correct_answer || "").trim().toLowerCase();
                              const selLetter = selected.match(/^[a-e]/i)?.[0]?.toLowerCase() || selected;
                              const actLetter = actual.match(/^[a-e]/i)?.[0]?.toLowerCase() || actual;
                              if (
                                !selected ||
                                !(
                                  selected === actual ||
                                  selLetter === actLetter ||
                                  actual.startsWith(selected + ".") ||
                                  actual.startsWith(selected + ")") ||
                                  actual.startsWith(selected + " ")
                                )
                              ) {
                                wrongCount += 1;
                              }
                            });

                            return wrongCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab("notebook");
                                  setActiveQuiz(null);
                                }}
                                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
                              >
                                <span>Review {wrongCount} missed {wrongCount === 1 ? "question" : "questions"}</span>
                              </button>
                            ) : (
                              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
                                Every question answered accurately.
                              </div>
                            );
                          })()}

                          <button
                            type="button"
                            onClick={() => {
                              setQuizReviewMode(true);
                              setCurrentQuestionIndex(0);
                            }}
                            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect all answers &amp; explanations</span>
                          </button>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startQuizRunner(activeQuiz)}
                              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Retake</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveQuiz(null)}
                              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : activeQuiz.quiz_questions && activeQuiz.quiz_questions.length > 0 ? (
                      <div className="space-y-6">
                        {quizReviewMode && (
                          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs flex items-center justify-between font-medium">
                            <span className="flex items-center gap-1.5">
                              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span>Reviewing answers</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setQuizReviewMode(false)}
                              className="font-semibold underline text-blue-700 dark:text-blue-300"
                            >
                              Back to score
                            </button>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              Question {currentQuestionIndex + 1} of {activeQuiz.quiz_questions.length}
                            </span>
                            <span>{Object.keys(selectedAnswers).length}/{activeQuiz.quiz_questions.length} answered</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-300"
                              style={{ width: `${((currentQuestionIndex + 1) / activeQuiz.quiz_questions.length) * 100}%` }}
                            />
                          </div>
                        </div>

                        {(() => {
                          const q = activeQuiz.quiz_questions[currentQuestionIndex];
                          const isShortAnswer = q.question_type === "short_answer";
                          const isTrueFalse = q.question_type === "true_false";
                          const isQuestionAnswered = selectedAnswers[currentQuestionIndex] !== undefined;
                          const isQuestionRevealed = quizSubmitted || isQuestionAnswered || revealedQuestions[currentQuestionIndex];

                          return (
                            <div className="space-y-5">
                              <div className="space-y-2">
                                {(q.question_type === "assertion_reasoning" || q.type === "assertion_reasoning") ? (
                                  (() => {
                                    const rawQ = String(q.question_text || q.question || "").trim();
                                    const mAr = rawQ.match(/(?:Assertion\s*(?:\(A\))?\s*[:\-]\s*)([\s\S]+?)\s*(?:\n+|\s+)(?:Reason\s*(?:\(R\))?\s*[:\-]\s*)([\s\S]+)/i);
                                    const parsedA = String(q.assertion || (mAr ? mAr[1].trim() : rawQ)).replace(/\s*\((?:Slide|Page)\s*#?\s*\d+[^)]*\)/gi, "");
                                    const parsedR = String(q.reason || (mAr ? mAr[2].trim() : "")).replace(/\s*\((?:Slide|Page)\s*#?\s*\d+[^)]*\)/gi, "");
                                    return (
                                      <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                                          Assertion &amp; Reasoning Examination Item
                                        </p>
                                        <div className="flex items-start gap-2.5">
                                          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 font-bold text-xs shrink-0">
                                            Assertion (A)
                                          </span>
                                          <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                                            {parsedA}
                                          </p>
                                        </div>
                                        {parsedR && (
                                          <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                                            <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 font-bold text-xs shrink-0">
                                              Reason (R)
                                            </span>
                                            <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                                              {parsedR}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug whitespace-pre-line">
                                    {String(q.question_text || q.question || "").replace(/\s*\((?:Slide|Page)\s*#?\s*\d+[^)]*\)/gi, "").replace(/\b(?:on|in|from|according to)\s+(?:Slide|Page)\s*#?\s*\d+\b,?\s*/gi, "")}
                                  </p>
                                )}
                              </div>

                              {isShortAnswer ? (
                                <div className="space-y-3">
                                  <textarea
                                    rows={3}
                                    aria-label="Your answer"
                                    disabled={quizSubmitted || isQuestionAnswered}
                                    value={selectedAnswers[currentQuestionIndex] || ""}
                                    onChange={(e) => setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIndex]: e.target.value }))}
                                    placeholder="Write your answer..."
                                    className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                                  />
                                  {!isQuestionRevealed && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!selectedAnswers[currentQuestionIndex]) {
                                          setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIndex]: "(Submitted for marking)" }));
                                        }
                                        setRevealedQuestions((prev) => ({ ...prev, [currentQuestionIndex]: true }));
                                      }}
                                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      Reveal model answer &amp; marking guide
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-2.5">
                                  {(q.options || []).map((opt: string, optIdx: number) => {
                                    const optLetter = ["a", "b", "c", "d", "e"][optIdx] || "";
                                    const extractedLetter = opt.match(/^[a-e]/i)?.[0]?.toUpperCase();
                                    const optKey = isTrueFalse ? opt : (extractedLetter || optLetter.toUpperCase());
                                    const isSelected = selectedAnswers[currentQuestionIndex] === optKey;

                                    const ca = String(q.correct_answer || "").trim().toLowerCase();
                                    const optClean = opt.trim().toLowerCase();
                                    const isCorrect = (
                                      ca === optLetter ||
                                      ca === optClean ||
                                      ca.startsWith(optLetter + ".") ||
                                      ca.startsWith(optLetter + ")") ||
                                      ca.startsWith(optLetter + " ") ||
                                      (ca.match(/^[a-e]/i)?.[0]?.toLowerCase() === optLetter)
                                    );

                                    let optClass = "border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100";
                                    if (isSelected) optClass = "border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100 font-semibold";

                                    if (isQuestionRevealed) {
                                      if (isCorrect) {
                                        optClass = "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 font-semibold";
                                      } else if (isSelected && !isCorrect) {
                                        optClass = "border-red-400 bg-red-50 dark:bg-red-950/50 text-red-950 dark:text-red-100 font-semibold";
                                      } else {
                                        optClass = "border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50/40 dark:bg-slate-800/40 opacity-70";
                                      }
                                    }

                                    return (
                                      <button
                                        key={optIdx}
                                        type="button"
                                        disabled={quizSubmitted || isQuestionAnswered}
                                        onClick={() => {
                                          setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIndex]: optKey }));
                                          setRevealedQuestions((prev) => ({ ...prev, [currentQuestionIndex]: true }));
                                        }}
                                        className={`w-full text-left p-3.5 rounded-xl border text-sm transition-colors flex items-center justify-between gap-3 ${optClass}`}
                                      >
                                        <span>{opt}</span>
                                        {isQuestionRevealed && (
                                          isCorrect ? (
                                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                                              Correct
                                            </span>
                                          ) : isSelected && !isCorrect ? (
                                            <span className="text-xs font-semibold text-red-700 dark:text-red-300 shrink-0">
                                              Your answer
                                            </span>
                                          ) : null
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {isQuestionRevealed && (
                                <div className="space-y-2.5 pt-1">
                                  {q.explanation && (
                                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 space-y-1">
                                      <span className="font-semibold text-slate-900 dark:text-white block">
                                        Explanation
                                      </span>
                                      <p className="leading-relaxed">{q.explanation}</p>
                                    </div>
                                  )}

                                  {q.misconception && (
                                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 space-y-1">
                                      <span className="font-semibold text-slate-900 dark:text-white block">
                                        Common pitfall
                                      </span>
                                      <p className="leading-relaxed">{q.misconception}</p>
                                    </div>
                                  )}

                                  {q.marking_guide && isShortAnswer && (
                                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 space-y-1">
                                      <span className="font-semibold text-slate-900 dark:text-white block">Marking guide</span>
                                      <p>{q.marking_guide}</p>
                                    </div>
                                  )}
                                  {q.correct_answer && isShortAnswer && (
                                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm text-emerald-950 dark:text-emerald-100 space-y-1">
                                      <span className="font-semibold block">Model answer</span>
                                      <p>{q.correct_answer}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                  type="button"
                                  disabled={currentQuestionIndex === 0}
                                  onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                                >
                                  Previous
                                </button>

                                {currentQuestionIndex < activeQuiz.quiz_questions.length - 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                                    className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                  >
                                    Next
                                  </button>
                                ) : !quizSubmitted ? (
                                  <button
                                    type="button"
                                    onClick={handleSubmitQuiz}
                                    className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                  >
                                    Submit quiz
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setQuizReviewMode(false)}
                                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  >
                                    Back to score
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-4">No questions in this quiz.</p>
                    )}
                  </div>
                ) : sessionQuizzes.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3 max-w-xl mx-auto">
                    <Timer className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">No practice quizzes yet</h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        Create a timed or untimed quiz grounded in your uploaded slides.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQuizModal(true)}
                      className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-colors"
                    >
                      New quiz
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Practice Quizzes</h2>
                      <button
                        type="button"
                        onClick={() => setShowQuizModal(true)}
                        className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New quiz</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sessionQuizzes.map((q) => (
                        <div key={q.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                              <span className="capitalize font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {(q.difficulty || "Intermediate").toLowerCase()}
                              </span>
                              <span className="uppercase text-[11px] font-medium">
                                {q.quiz_questions?.[0]?.question_type || q.question_type || "MCQ"}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white pt-1">{q.title}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {q.total_questions || 5} questions &bull; {q.time_limit_minutes ? `${q.time_limit_minutes} min` : "Untimed"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startQuizRunner(q)}
                            className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Start quiz</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 7B: MISTAKES ─── */}
            {activeTab === "notebook" && (
              <div className="space-y-5">
                {/* Clean White Mistakes Header */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Mistakes</h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Review missed quiz questions and re-test yourself until you master them.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab("quizzes")}
                      className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                    >
                      <Timer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Practice quizzes</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start">
                      <button
                        type="button"
                        onClick={() => setNotebookFilter("session")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          notebookFilter === "session"
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        This session ({currentSessionMistakes.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotebookFilter("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          notebookFilter === "all"
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        All sessions ({allMistakes.length})
                      </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="search"
                        aria-label="Search mistakes"
                        value={notebookSearch}
                        onChange={(e) => setNotebookSearch(e.target.value)}
                        placeholder="Search mistakes..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Mistakes List */}
                {(() => {
                  const baseList = notebookFilter === "session" ? currentSessionMistakes : allMistakes;
                  const filtered = baseList.filter((m) => {
                    if (!notebookSearch.trim()) return true;
                    const q = notebookSearch.toLowerCase();
                    return (
                      m.questionText?.toLowerCase().includes(q) ||
                      m.quizTitle?.toLowerCase().includes(q) ||
                      m.sourceRef?.toLowerCase().includes(q) ||
                      m.explanation?.toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3 max-w-lg mx-auto">
                        <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto" />
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {notebookSearch.trim() ? "No matching mistakes" : "No mistakes recorded"}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            {notebookSearch.trim()
                              ? `No questions matched "${notebookSearch}".`
                              : notebookFilter === "session"
                              ? "Missed questions from your practice quizzes in this session will appear here."
                              : "You have no recorded mistakes across your sessions."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (notebookSearch.trim()) setNotebookSearch("");
                            else setActiveTab("quizzes");
                          }}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-colors"
                        >
                          {notebookSearch.trim() ? "Clear search" : "Open practice quizzes"}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {filtered.map((m) => {
                        const isRetested = !!retestAnswers[m.id];
                        const selectedRetest = retestAnswers[m.id];

                        return (
                          <div
                            key={m.id}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2 flex-wrap text-xs">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {m.quizTitle}
                                </span>
                                <span className="text-slate-400">
                                  &bull; {new Date(m.attemptDate).toLocaleDateString()}
                                </span>
                              </div>

                              {m.sourceRef && (
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md self-start sm:self-auto">
                                  {m.sourceRef}
                                </span>
                              )}
                            </div>

                            {m.questionType === "assertion_reasoning" ? (
                              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-start gap-2.5">
                                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs shrink-0">Assertion</span>
                                  <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                                    {m.assertion || (m.questionText?.includes("Assertion (A):") ? m.questionText.split(/\nReason \(R\):/i)[0]?.replace(/^Assertion \(A\):\s*/i, "").trim() : m.questionText)}
                                  </p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs shrink-0">Reason</span>
                                  <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                                    {m.reason || (m.questionText?.includes("Reason (R):") ? m.questionText.split(/\nReason \(R\):/i)[1]?.trim() : "")}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                                {m.questionText}
                              </p>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div className="p-3 rounded-xl bg-red-50/60 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs">
                                <span className="font-semibold text-red-700 dark:text-red-300 block">
                                  Your answer
                                </span>
                                <p className="font-medium text-red-950 dark:text-red-100 mt-0.5">{m.userAnswer || "(No answer)"}</p>
                              </div>
                              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs">
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300 block">
                                  Correct answer
                                </span>
                                <p className="font-medium text-emerald-950 dark:text-emerald-100 mt-0.5">{m.correctAnswer}</p>
                              </div>
                            </div>

                            {(m.explanation || m.misconception) && (
                              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 space-y-2">
                                {m.explanation && (
                                  <div>
                                    <span className="font-semibold text-slate-900 dark:text-white block">Explanation</span>
                                    <p className="leading-relaxed mt-0.5">{m.explanation}</p>
                                  </div>
                                )}
                                {m.misconception && (
                                  <div className={m.explanation ? "pt-2 border-t border-slate-200 dark:border-slate-700" : ""}>
                                    <span className="font-semibold text-slate-900 dark:text-white block">Common pitfall</span>
                                    <p className="leading-relaxed mt-0.5">{m.misconception}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {m.options && m.options.length > 0 && (
                              <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
                                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                                  Quick re-test
                                </span>

                                <div className="space-y-2">
                                  {m.options.map((opt: string, optIdx: number) => {
                                    const optLetter = ["a", "b", "c", "d", "e"][optIdx] || "";
                                    const extractedLetter = opt.match(/^[a-e]/i)?.[0]?.toUpperCase();
                                    const optKey = m.questionType === "true_false" ? opt : (extractedLetter || optLetter.toUpperCase());
                                    const isSelected = selectedRetest === optKey;

                                    const ca = String(m.correctAnswer || "").trim().toLowerCase();
                                    const optClean = opt.trim().toLowerCase();
                                    const isCorrect = (
                                      ca === optLetter ||
                                      ca === optClean ||
                                      ca.startsWith(optLetter + ".") ||
                                      ca.startsWith(optLetter + ")") ||
                                      ca.startsWith(optLetter + " ") ||
                                      (ca.match(/^[a-e]/i)?.[0]?.toLowerCase() === optLetter)
                                    );

                                    let btnClass = "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 text-slate-800 dark:text-slate-100";
                                    if (isRetested) {
                                      if (isCorrect) {
                                        btnClass = "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 font-semibold";
                                      } else if (isSelected && !isCorrect) {
                                        btnClass = "border-red-400 bg-red-50 dark:bg-red-950/50 text-red-950 dark:text-red-100 font-semibold";
                                      } else {
                                        btnClass = "border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 opacity-60";
                                      }
                                    }

                                    return (
                                      <button
                                        key={optIdx}
                                        type="button"
                                        disabled={isRetested}
                                        onClick={() => {
                                          if (isRetested) return;
                                          setRetestAnswers((prev) => ({ ...prev, [m.id]: optKey }));
                                          setRetestRevealed((prev) => ({ ...prev, [m.id]: true }));
                                          if (isCorrect) {
                                            updateStudyStats(0, 3);
                                          }
                                        }}
                                        className={`w-full text-left p-3 rounded-lg border text-xs sm:text-sm transition-colors flex items-center justify-between gap-2 ${btnClass}`}
                                      >
                                        <span>{opt}</span>
                                        {isRetested && (
                                          isCorrect ? (
                                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                                              Correct (+3 XP)
                                            </span>
                                          ) : isSelected && !isCorrect ? (
                                            <span className="text-xs font-semibold text-red-700 dark:text-red-300 shrink-0">
                                              Incorrect
                                            </span>
                                          ) : null
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ─── TAB 7: PROGRESS ─── */}
            {activeTab === "progress" && (
              <div className="space-y-6">
                {(() => {
                  const topicStats: Record<string, { total: number; correct: number }> = {};

                  sessionQuizzes.forEach((qz) => {
                    (qz.quiz_questions || []).forEach((q: any) => {
                      const t = q.topic || "Core Syllabus";
                      if (!topicStats[t]) topicStats[t] = { total: 0, correct: 0 };
                      topicStats[t].total += 1;
                      if (selectedAnswers[q.order_index ?? 0] === q.correct_answer) {
                        topicStats[t].correct += 1;
                      }
                    });
                  });

                  const topicsList = Object.entries(topicStats).map(([name, stat]) => ({
                    name,
                    accuracy: Math.round((stat.correct / Math.max(stat.total, 1)) * 100),
                    total: stat.total,
                  }));

                  return (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Topic Accuracy</h2>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Identify which topics in this session need extra practice.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowQuizModal(true)}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New quiz</span>
                        </button>
                      </div>

                      {topicsList.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                          {topicsList.map((top) => (
                            <div
                              key={top.name}
                              className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-semibold gap-2">
                                  <span className="text-slate-900 dark:text-white truncate">{top.name}</span>
                                  <span className="text-slate-600 dark:text-slate-300 shrink-0">
                                    {top.accuracy}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-600 rounded-full"
                                    style={{ width: `${top.accuracy}%` }}
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setThreeWaysConcept(top.name);
                                  setShowThreeWaysModal(true);
                                }}
                                className="w-full py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                              >
                                Explain in 3 ways
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center">
                          Complete a practice quiz to see topic-level accuracy.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Score Progress Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Quiz Attempt History</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">All attempts recorded for this study session.</p>
                  </div>

                  {sessionAttempts.length === 0 ? (
                    <p className="text-xs sm:text-sm text-slate-500 py-6 text-center">No quiz attempts recorded yet.</p>
                  ) : (
                    <div
                      className="table-wrapper overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"
                      tabIndex={0}
                      role="region"
                      aria-label="Quiz attempt history"
                    >
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold">
                            <th scope="col" className="py-2.5 px-3.5">Date</th>
                            <th scope="col" className="py-2.5 px-3.5">Questions</th>
                            <th scope="col" className="py-2.5 px-3.5">Correct</th>
                            <th scope="col" className="py-2.5 px-3.5">Score</th>
                            <th scope="col" className="py-2.5 px-3.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {sessionAttempts.map((att) => (
                            <tr key={att.id}>
                              <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(att.completed_at).toLocaleString()}</td>
                              <td className="py-3 px-3.5 font-medium text-slate-900 dark:text-white">{att.total_questions}</td>
                              <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300">{att.correct_count}</td>
                              <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white">{att.score_percentage}%</td>
                              <td className="py-3 px-3.5">
                                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                                  att.passed
                                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}>
                                  {att.passed ? "Passed" : "Review"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

              </div>
            </div>
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────
              VIEW B: TOP-LEVEL WORKSPACE & SESSIONS LIBRARY
          ─────────────────────────────────────────────────────────── */
          <div className="space-y-6">
            {/* Top-Level Workspace Navigation */}
            <nav
              aria-label="Workspace sections"
              className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800"
            >
              {[
                { id: "home", label: "Overview", icon: Home },
                { id: "sessions", label: `Sessions (${sessions.length})`, icon: BookOpen },
                { id: "groups", label: "Study Groups", icon: Users },
                { id: "exam_tracker", label: "Exams", icon: Calendar },
                { id: "planner", label: "Planner", icon: Target },
                { id: "leaderboard", label: "Leaderboard", icon: Trophy },
              ].map((item) => {
                const Icon = item.icon;
                const active = dashboardScope === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDashboardScope(item.id as any)}
                    className={`px-3.5 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 shrink-0 border-b-2 -mb-px ${
                      active
                        ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                        : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* ─── SCOPE 0: DASHBOARD OVERVIEW ─── */}
            {dashboardScope === "home" && (
              <div className="space-y-8">
                {/* Welcome & Metrics Summary */}
                <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                        Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
                      </h1>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Upload course materials, practice active recall, or join a live group quiz.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowNewSessionModal(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        <span>New session</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDashboardScope("exam_tracker")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors"
                      >
                        <Calendar className="w-4 h-4 text-slate-500" aria-hidden="true" />
                        <span>Exams</span>
                      </button>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                        Sessions
                      </span>
                      <div className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                        {sessions.length}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                        Daily streak
                      </span>
                      <div className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                        {profile?.streak_days || 0} <span className="text-xs font-normal text-slate-500">days</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                        Quizzes completed
                      </span>
                      <div className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                        {quizAttempts.length}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                        Study time
                      </span>
                      <div className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                        {Math.round((profile?.total_study_minutes || 0) / 60)}{" "}
                        <span className="text-xs font-normal text-slate-500">hrs</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 Focused Workspaces */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      scope: "sessions" as const,
                      title: "Study Sessions",
                      desc: "Summaries, grounded notes, flashcards, quizzes, and AI tutoring.",
                      cta: `Open sessions (${sessions.length})`,
                      icon: BookOpen,
                    },
                    {
                      scope: "groups" as const,
                      title: "Study Groups",
                      desc: "Upload slides as admin and run synchronized timed quizzes with classmates.",
                      cta: "Open groups",
                      icon: Users,
                    },
                    {
                      scope: "exam_tracker" as const,
                      title: "Exam Tracker",
                      desc: "Live exam countdowns and syllabus readiness checklists.",
                      cta: "View exams",
                      icon: Calendar,
                    },
                    {
                      scope: "planner" as const,
                      title: "Study Planner",
                      desc: "Daily practice targets and spaced repetition schedules.",
                      cta: "Open planner",
                      icon: Target,
                    },
                  ].map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.scope}
                        type="button"
                        onClick={() => setDashboardScope(card.scope)}
                        className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors text-left group flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-2.5">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 dark:group-hover:bg-blue-950/60 dark:group-hover:text-blue-400 flex items-center justify-center transition-colors">
                            <Icon className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <h2 className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {card.title}
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            {card.desc}
                          </p>
                        </div>
                        <div className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <span>{card.cta}</span>
                          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Recent Study Sessions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Recent sessions
                    </h2>

                    {sessions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDashboardScope("sessions")}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>View all ({sessions.length})</span>
                        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {sessions.length === 0 ? (
                    <div className="p-8 sm:p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto">
                        <UploadCloud className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          No study sessions yet
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                          Upload lecture slides, PDFs, or notes to generate summaries, flashcards, and practice quizzes.
                        </p>
                      </div>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowNewSessionModal(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Upload material</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sessions.slice(0, 3).map((sess) => {
                        const sessionQCount = quizzes.filter((q) => q.document_id === sess.id).length;
                        return (
                          <div
                            key={sess.id}
                            className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex flex-col justify-between gap-4"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>{new Date(sess.created_at).toLocaleDateString()}</span>
                                <span>
                                  {sessionQCount} {sessionQCount === 1 ? "quiz" : "quizzes"}
                                </span>
                              </div>

                              <h3 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2">
                                {sess.title}
                              </h3>

                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                {sess.extracted_text || "Uploaded study material"}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveSession(sess);
                                setActiveTab("overview");
                              }}
                              className="w-full py-2 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                            >
                              <span>Open session</span>
                              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── SCOPE 1: STUDY SESSIONS LIBRARY ─── */}
            {dashboardScope === "sessions" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                      Study Sessions
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Each session keeps its own uploaded materials, notes, flashcards, and quizzes.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNewSessionModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors self-start"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>New session</span>
                  </button>
                </div>

                {sessions.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center max-w-lg mx-auto space-y-4">
                    <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto">
                      <UploadCloud className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                        No study sessions yet
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Upload your lecture slides or notes to create your first session.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewSessionModal(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>New session</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sessions.map((sess) => {
                      const hasSum = summaries.some((s) => s.document_id === sess.id);
                      const hasExp = studyNotes.some((n) => n.document_id === sess.id && n.subject === "explanation");
                      const hasNot = studyNotes.some((n) => n.document_id === sess.id && (n.subject === "exam_notes" || n.subject === "notes"));
                      const sessionQCount = quizzes.filter((q) => q.document_id === sess.id).length;

                      return (
                        <div
                          key={sess.id}
                          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex flex-col justify-between gap-4"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                              <span>{new Date(sess.created_at).toLocaleDateString()}</span>
                              <span>
                                {sessionQCount} {sessionQCount === 1 ? "quiz" : "quizzes"}
                              </span>
                            </div>

                            <h2 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2">
                              {sess.title}
                            </h2>

                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {sess.extracted_text}
                            </p>

                            {(hasSum || hasExp || hasNot) && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                {hasSum && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                    Summary
                                  </span>
                                )}
                                {hasExp && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                    Explanation
                                  </span>
                                )}
                                {hasNot && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                    Notes
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSession(sess);
                                setActiveTab("overview");
                              }}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                            >
                              <span>Open</span>
                              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSession(sess.id)}
                              aria-label={`Delete ${sess.title}`}
                              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ─── SCOPE 2: STUDY GROUPS (LIVE TIMED QUIZZES) ─── */}
            {dashboardScope === "groups" && (
              <ClassCirclesWorkspace
                sessions={sessions}
                user={user}
                profile={profile}
                initialJoinCode={pendingJoinCode}
                onClearJoinCode={() => setPendingJoinCode(null)}
                onOpenSession={(sess, tab) => {
                  setActiveSession(sess);
                  if (tab) setActiveTab(tab as SessionTab);
                }}
              />
            )}

            {/* ─── SCOPE 3: EXAMINATION TRACKER ─── */}
            {dashboardScope === "exam_tracker" && (
              <ExamTrackerWorkspace
                user={user}
                sessions={sessions}
                quizzes={quizzes}
                quizAttempts={quizAttempts}
                onOpenSession={(sess, tab) => {
                  setActiveSession(sess);
                  if (tab) setActiveTab(tab as SessionTab);
                }}
              />
            )}

            {/* ─── SCOPE 4: STUDY PLANNER & SPACED REPETITION ─── */}
            {dashboardScope === "planner" && (
              <StudyRoutinesWorkspace
                user={user}
                profile={profile}
                sessions={sessions}
                onOpenSession={(sess, defaultTab) => {
                  setActiveSession(sess);
                  if (defaultTab) setActiveTab(defaultTab as SessionTab);
                }}
                onUpdateDailyGoal={(newTarget) => {
                  setDailyGoalTarget(newTarget);
                  if (isConfigured && user) {
                    supabase
                      .from("study_routines")
                      .upsert({ user_id: user.id, daily_question_target: newTarget })
                      .then();
                  }
                }}
              />
            )}

            {/* ─── SCOPE 5: LEADERBOARD ─── */}
            {dashboardScope === "leaderboard" && (
              <div className="space-y-6">
                {/* Clean White Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                      Leaderboard
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Points update automatically from completed quizzes, flashcard decks, and review drills.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                    {(["all", "month", "week"] as const).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setLeaderboardTimeframe(tf)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          leaderboardTimeframe === tf
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {tf === "all" ? "All time" : tf === "month" ? "This month" : "This week"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personal Progress Summary */}
                {(() => {
                  const userPoints = profile?.points || 0;
                  const currentLevel = getScholarLevel(userPoints);
                  const nextLevelPoints =
                    currentLevel.level === 5
                      ? 2000
                      : currentLevel.level === 4
                      ? 1500
                      : currentLevel.level === 3
                      ? 700
                      : currentLevel.level === 2
                      ? 300
                      : 100;
                  const progressPct = Math.min(100, Math.round((userPoints / nextLevelPoints) * 100));

                  const userRankIndex = leaderboardProfiles.findIndex((p) => p.id === user?.id);
                  const rankDisplay = userRankIndex >= 0 ? `#${userRankIndex + 1}` : "#1";

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Rank & Level */}
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Your rank &amp; level
                          </span>
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                            {rankDisplay}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-semibold text-base">
                            {currentLevel.level}
                          </div>
                          <div>
                            <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                              {currentLevel.name}
                            </h2>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {userPoints} XP
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>Level {currentLevel.level}</span>
                            <span>
                              {progressPct}% to Level {Math.min(5, currentLevel.level + 1)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Daily Practice Goal */}
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Daily practice goal
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowSettingsModal(true)}
                            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Edit goal
                          </button>
                        </div>

                        {(() => {
                          const today = new Date().toDateString();
                          const todayAttempts = quizAttempts.filter(
                            (a) => new Date(a.completed_at).toDateString() === today
                          );
                          const answeredToday = todayAttempts.reduce(
                            (acc, a) => acc + (a.total_questions || 0),
                            0
                          );
                          const goalPct = Math.min(
                            100,
                            Math.round((answeredToday / Math.max(1, dailyGoalTarget)) * 100)
                          );

                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xl font-semibold text-slate-900 dark:text-white">
                                    {answeredToday}{" "}
                                    <span className="text-xs font-normal text-slate-500">
                                      / {dailyGoalTarget} questions
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Answered today
                                  </p>
                                </div>
                                <span
                                  className={`text-xs font-medium px-2.5 py-1 rounded-md border ${
                                    goalPct >= 100
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                                      : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                  }`}
                                >
                                  {goalPct >= 100
                                    ? "Goal met"
                                    : `${Math.max(0, dailyGoalTarget - answeredToday)} left`}
                                </span>
                              </div>

                              <div className="space-y-1 pt-1">
                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      goalPct >= 100 ? "bg-emerald-600" : "bg-blue-600"
                                    }`}
                                    style={{ width: `${goalPct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400 block text-right">
                                  {goalPct}%
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Consistency & Study Time */}
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                          Consistency &amp; focus time
                        </span>

                        <div className="grid grid-cols-2 gap-3 pt-0.5">
                          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                            <span className="text-xs text-slate-500 dark:text-slate-400 block">
                              Streak
                            </span>
                            <span className="text-lg font-semibold text-slate-900 dark:text-white mt-0.5 block">
                              {profile?.streak_days || 0}{" "}
                              <span className="text-xs font-normal text-slate-500">days</span>
                            </span>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                            <span className="text-xs text-slate-500 dark:text-slate-400 block">
                              Focus time
                            </span>
                            <span className="text-lg font-semibold text-slate-900 dark:text-white mt-0.5 block">
                              {Math.round((profile?.total_study_minutes || 0) / 60)}{" "}
                              <span className="text-xs font-normal text-slate-500">hrs</span>
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Study timer pauses automatically when you leave the tab.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Rankings Table */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                  <div>
                    <h2
                      id="leaderboard-table-heading"
                      className="text-base font-semibold text-slate-900 dark:text-white"
                    >
                      Student rankings
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Names respect each student&apos;s display preferences in Settings.
                    </p>
                  </div>

                  <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby="leaderboard-table-heading"
                    className="table-wrapper"
                  >
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium bg-white dark:bg-slate-900">
                          <th scope="col" className="py-3 px-3">Rank</th>
                          <th scope="col" className="py-3 px-3">Student</th>
                          <th scope="col" className="py-3 px-3">School / Level</th>
                          <th scope="col" className="py-3 px-3 text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {leaderboardProfiles.map((p, idx) => {
                          const isCurrentUser = p.id === user?.id;
                          const schoolOrLevel =
                            p.school_name ||
                            p.school ||
                            (p.educational_level === "shs"
                              ? "Senior High School"
                              : p.educational_level === "university"
                              ? "University / Tertiary"
                              : p.educational_level === "jhs"
                              ? "Junior High School"
                              : p.educational_level || "Student");

                          return (
                            <tr
                              key={p.id || idx}
                              className={`transition-colors ${
                                isCurrentUser
                                  ? "bg-blue-50/70 dark:bg-blue-950/40"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-flex items-center justify-center min-w-7 h-6 px-1.5 rounded text-xs font-semibold ${
                                    idx === 0
                                      ? "bg-blue-600 text-white"
                                      : idx < 3
                                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                      : "text-slate-500 dark:text-slate-400"
                                  }`}
                                >
                                  #{idx + 1}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-900 dark:text-white">
                                    {formatScholarName(p, user?.id)}
                                  </span>
                                  {isCurrentUser && (
                                    <span className="text-[11px] font-medium bg-blue-600 text-white px-1.5 py-0.5 rounded">
                                      You
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400">
                                {schoolOrLevel}
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-white text-sm">
                                {p.points || 0} XP
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ─────────────────────────────────────────────────────────
          MODAL A: NEW STUDY SESSION
      ─────────────────────────────────────────────────────────── */}
      {showNewSessionModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-session-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5 shadow-lg relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2
                id="new-session-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                New study session
              </h2>
              <button
                type="button"
                onClick={() => setShowNewSessionModal(false)}
                aria-label="Close modal"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{modalError}</span>
              </div>
            )}

            {isQuotaReached && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-2.5">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                  <span>
                    Plan limit reached ({sessions.length}/{planLimit} sessions used)
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Upgrade to Standard or Premium to upload more study sessions.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSessionModal(false);
                    setUpgradeReason(
                      `You've used all ${planLimit} free study sessions. Upgrade to continue uploading lecture materials.`
                    );
                    setShowUpgradeModal(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Upgrade plan</span>
                </button>
              </div>
            )}

            <form onSubmit={handleCreateSession} className="space-y-4">
              {/* Starting study mode */}
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Start with
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "summarize", label: "Summary", desc: "Key concepts & videos", icon: FileText },
                    { id: "flashcards", label: "Flashcards", desc: "Active recall cards", icon: Layers },
                    { id: "quiz", label: "Practice quiz", desc: "Questions from slides", icon: Timer },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const isLocked = mode.id === "flashcards" && !canAccessFlashcards;
                    const selected = selectedMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          if (isLocked) {
                            setUpgradeReason(
                              "Flashcards with Spaced Repetition are available on Standard and Premium plans."
                            );
                            setShowUpgradeModal(true);
                            return;
                          }
                          setSelectedMode(mode.id as StudyMode);
                        }}
                        className={`p-3 rounded-lg border text-left transition-colors flex items-start gap-2.5 ${
                          selected
                            ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100"
                            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            selected ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold">{mode.label}</p>
                            {isLocked && (
                              <Lock className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                            {mode.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Session Title */}
              <div>
                <label
                  htmlFor="new-session-title"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Session title
                </label>
                <input
                  id="new-session-title"
                  type="text"
                  required
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="e.g. Cardiovascular System — Lecture 3"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* Material Source: File Upload vs Paste */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Study material
                  </span>
                  <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setInputMode("file")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        inputMode === "file"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Upload file
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode("paste")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        inputMode === "paste"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Paste text
                    </button>
                  </div>
                </div>

                {inputMode === "file" ? (
                  <div>
                    {selectedFile ? (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-semibold text-xs uppercase shrink-0">
                            {selectedFile.name.split(".").pop()?.slice(0, 4) || "FILE"}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {selectedFile.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setExtractedFileName(null);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md transition-colors shrink-0"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="new-session-file-input"
                        className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50/30"
                      >
                        <UploadCloud className="w-6 h-6 text-slate-400 mb-2" aria-hidden="true" />
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          Choose a PDF, PowerPoint, Word document, or image
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Up to 1.5 GB &bull; Instant slide &amp; text extraction
                        </p>
                        <input
                          id="new-session-file-input"
                          type="file"
                          accept=".txt,.md,.pdf,.pptx,.docx,image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <div>
                    <label htmlFor="new-session-paste-input" className="sr-only">
                      Paste study notes
                    </label>
                    <textarea
                      id="new-session-paste-input"
                      rows={5}
                      value={materialsText}
                      onChange={(e) => setMaterialsText(e.target.value)}
                      placeholder="Paste text from your slides, lecture notes, or handouts..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                )}

                {/* Upload & Extraction Progress */}
                {modalLoading && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-200">
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                        <span>{processingStage || "Processing study material..."}</span>
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                        style={{ width: `${Math.max(uploadProgress, 5)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Initial Quiz Options */}
              {selectedMode === "quiz" && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Quiz options
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label
                        htmlFor="initial-quiz-type"
                        className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Format
                      </label>
                      <select
                        id="initial-quiz-type"
                        value={initialQuizType}
                        onChange={(e: any) => setInitialQuizType(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="mcq">Single-Best-Answer MCQ</option>
                        <option value="multiple_select">Multiple-Select (Roman I–IV)</option>
                        <option value="assertion_reasoning">Assertion &amp; Reasoning</option>
                        <option value="true_false">True / False</option>
                        <option value="application">Clinical / Scenario Application</option>
                        <option value="matching">Matching</option>
                        <option value="fill_in_the_blank">Fill-in-the-Gap</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="mixed">Mixed Exam Format (All 8 Types)</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="initial-quiz-count"
                        className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Questions (max {maxQuestionsAllowed})
                      </label>
                      <select
                        id="initial-quiz-count"
                        value={initialQuizCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (val > maxQuestionsAllowed) {
                            setUpgradeReason(
                              `Your ${currentPlan} plan supports up to ${maxQuestionsAllowed} questions. Upgrade to set more questions.`
                            );
                            setShowUpgradeModal(true);
                            return;
                          }
                          setInitialQuizCount(val);
                        }}
                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        {[5, 10, 15, 25, 50, 75, 100, 150].map((cnt) => {
                          const locked = cnt > maxQuestionsAllowed;
                          return (
                            <option key={cnt} value={cnt} disabled={locked}>
                              {cnt} questions{locked ? ` (${cnt > 100 ? "Premium" : "Standard"})` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="initial-quiz-timer"
                        className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Timer
                      </label>
                      <select
                        id="initial-quiz-timer"
                        value={quizTimeLimitMinutes}
                        onChange={(e) => setQuizTimeLimitMinutes(parseInt(e.target.value, 10))}
                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value={5}>5 min</option>
                        <option value={10}>10 min</option>
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                        <option value={90}>90 min</option>
                        <option value={120}>120 min</option>
                        <option value={150}>150 min</option>
                        <option value={0}>Untimed</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                {isQuotaReached ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewSessionModal(false);
                      setUpgradeReason(
                        `You've used all ${planLimit} free study sessions. Upgrade to continue uploading lecture materials.`
                      );
                      setShowUpgradeModal(true);
                    }}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                  >
                    Upgrade plan
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
                  >
                    {modalLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <span>Create session</span>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          MODAL B: GENERATE QUIZ FOR ACTIVE SESSION
      ─────────────────────────────────────────────────────────── */}
      {showQuizModal && activeSession && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quiz-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5 shadow-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2
                  id="quiz-modal-title"
                  className="text-base font-semibold text-slate-900 dark:text-white"
                >
                  New practice quiz
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                  Source: {activeSession.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuizModal(false)}
                aria-label="Close modal"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateSessionQuiz} className="space-y-4">
              {/* Question Type */}
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Question format
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "mcq", label: "Single-Best MCQ" },
                    { id: "multiple_select", label: "Multiple-Select" },
                    { id: "assertion_reasoning", label: "Assertion–Reason" },
                    { id: "true_false", label: "True / False" },
                    { id: "application", label: "Scenario / Clinical" },
                    { id: "matching", label: "Matching" },
                    { id: "fill_in_the_blank", label: "Fill-in-the-Gap" },
                    { id: "short_answer", label: "Short Answer" },
                    { id: "mixed", label: "Mixed Exam (All 8)" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setQuizQuestionType(t.id as any)}
                      className={`py-2 px-2 text-center rounded-lg border text-xs font-medium transition-colors ${
                        quizQuestionType === t.id
                          ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Count */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Number of questions (up to {maxQuestionsAllowed})
                  </span>
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {quizQuestionCount} selected
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mb-2">
                  {[5, 10, 15, 25, 50, 75, 100, 150].map((cnt) => {
                    const isLocked = cnt > maxQuestionsAllowed;
                    return (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          if (isLocked) {
                            setUpgradeReason(
                              `Your ${currentPlan} plan supports up to ${maxQuestionsAllowed} questions. Upgrade to ${
                                cnt > 100 ? "Premium" : "Standard"
                              } to generate ${cnt} questions.`
                            );
                            setShowUpgradeModal(true);
                            return;
                          }
                          setQuizQuestionCount(cnt);
                        }}
                        className={`py-1.5 rounded-lg border text-xs font-medium transition-colors text-center ${
                          quizQuestionCount === cnt
                            ? "border-blue-600 bg-blue-600 text-white"
                            : isLocked
                            ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400"
                            : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        {cnt}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <label
                    htmlFor="custom-quiz-count"
                    className="text-slate-500 dark:text-slate-400 shrink-0"
                  >
                    Custom:
                  </label>
                  <input
                    id="custom-quiz-count"
                    type="number"
                    min={1}
                    max={maxQuestionsAllowed}
                    value={quizQuestionCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        if (val > maxQuestionsAllowed) {
                          setUpgradeReason(
                            `Your ${currentPlan} plan supports up to ${maxQuestionsAllowed} questions. Upgrade to set more questions.`
                          );
                          setShowUpgradeModal(true);
                          setQuizQuestionCount(maxQuestionsAllowed);
                        } else {
                          setQuizQuestionCount(Math.max(1, val));
                        }
                      }
                    }}
                    className="w-20 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Time Limit */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Time limit
                  </span>
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {quizTimeLimitMinutes === 0 ? "Untimed" : `${quizTimeLimitMinutes} min`}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {[
                    { label: "5m", val: 5 },
                    { label: "10m", val: 10 },
                    { label: "15m", val: 15 },
                    { label: "30m", val: 30 },
                    { label: "45m", val: 45 },
                    { label: "60m", val: 60 },
                    { label: "90m", val: 90 },
                    { label: "120m", val: 120 },
                    { label: "150m", val: 150 },
                    { label: "Untimed", val: 0 },
                  ].map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setQuizTimeLimitMinutes(t.val)}
                      className={`py-1.5 rounded-lg border text-xs font-medium transition-colors text-center ${
                        quizTimeLimitMinutes === t.val
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <label
                    htmlFor="custom-quiz-minutes"
                    className="text-slate-500 dark:text-slate-400 shrink-0"
                  >
                    Custom minutes:
                  </label>
                  <input
                    id="custom-quiz-minutes"
                    type="number"
                    min={1}
                    max={300}
                    value={quizTimeLimitMinutes === 0 ? "" : quizTimeLimitMinutes}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) setQuizTimeLimitMinutes(Math.min(300, val));
                      else if (e.target.value === "") setQuizTimeLimitMinutes(0);
                    }}
                    placeholder="Untimed"
                    className="w-24 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Difficulty
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "easy", label: "Easy" },
                    { id: "intermediate", label: "Standard" },
                    { id: "difficult", label: "Challenging" },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setQuizDifficulty(d.id)}
                      className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                        quizDifficulty === d.id
                          ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Answer Feedback */}
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Show answers
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "on_submit", label: "After submitting" },
                    { id: "immediate", label: "After each question" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setQuizRevealMode(m.id as any)}
                      className={`py-2 px-2 text-center rounded-lg border text-xs font-medium transition-colors ${
                        quizRevealMode === m.id
                          ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuizModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quizModalLoading}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
                >
                  {quizModalLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Start quiz</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings & AI Provider Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        user={user}
        profile={profile}
        onProfileUpdated={(updated) => setProfile(updated)}
      />

      {/* Explain Three Ways Modal */}
      <ExplainThreeWaysModal
        isOpen={showThreeWaysModal}
        onClose={() => setShowThreeWaysModal(false)}
        initialConcept={threeWaysConcept}
        contextText={activeSession?.extracted_text || ""}
      />

      {/* Active Recall Coach Modal */}
      <ActiveRecallCoachModal
        isOpen={showActiveRecallModal}
        onClose={() => setShowActiveRecallModal(false)}
        questionText={activeRecallQuestion}
        referenceText={activeSession?.extracted_text || ""}
      />

      {/* Upgrade Paywall Modal (Enforces 5-session basic limit) */}
      <UpgradePaywallModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeReason}
        currentCount={sessions.length}
        maxLimit={planLimit}
        onSelectPlan={(plan) => {
          setSelectedPlanForPayment(plan);
          setShowUpgradeModal(false);
        }}
      />

      {/* WhatsApp / MoMo Activation Modal */}
      {selectedPlanForPayment && (
        <WhatsAppPaymentModal
          plan={selectedPlanForPayment}
          onClose={() => setSelectedPlanForPayment(null)}
          userEmail={user?.email || profile?.email || ""}
        />
      )}

      {/* QR Code Share Modal inside Dashboard */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
              aria-label="Close QR Modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-3">
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan to Join LAMLA Guide AI</span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Instant Phone &amp; Laptop Access
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              Point any phone camera at this QR code to open the study platform immediately.
            </p>

            <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block shadow-xs">
              <img
                src="/lamla_guide_ai_qr_code.png"
                alt="LAMLA Guide AI QR Code"
                className="w-52 h-52 object-contain mx-auto"
              />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <a
                href="/lamla_guide_ai_qr_poster.png"
                download="LAMLA_Guide_AI_QR_Poster.png"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download Printable Class Poster</span>
              </a>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 break-all">
                https://lamla-guide-ai.onrender.com
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
