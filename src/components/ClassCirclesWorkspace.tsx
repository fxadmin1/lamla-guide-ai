"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Users,
  Plus,
  Copy,
  Hash,
  X,
  ShieldCheck,
  Clock,
  Trophy,
  Loader2,
  Trash2,
  Share2,
  Check,
  Award,
} from "lucide-react";
import LiveQuizRoom, {
  GroupStandingRow,
  QuizHistoryItem,
  RoomState,
} from "@/components/LiveQuizRoom";

export interface ClassCircle {
  id: string;
  name: string;
  course_code: string;
  institution: string;
  description: string;
  invite_code: string;
  created_by: string;
  member_count: number;
  active_quiz_phase?: "idle" | "lobby" | "scheduled" | "running" | "finished";
  created_at: string;
}

export interface CircleMember {
  id: string;
  circle_id: string;
  user_id: string;
  role: "owner" | "assistant_admin" | "member";
  user_email?: string;
  display_name?: string;
  joined_at: string;
}

interface ClassCirclesWorkspaceProps {
  sessions: any[];
  user: any;
  profile: any;
  onOpenSession: (session: any, defaultTab?: string) => void;
  initialJoinCode?: string | null;
  onClearJoinCode?: () => void;
}

export default function ClassCirclesWorkspace({
  sessions,
  user,
  profile,
  initialJoinCode,
  onClearJoinCode,
}: ClassCirclesWorkspaceProps) {
  const userId: string = user?.id || "";
  const displayName: string =
    profile?.full_name || user?.email?.split("@")[0] || "Student";

  const [circles, setCircles] = useState<ClassCircle[]>([]);
  const [activeCircleId, setActiveCircleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"live_quiz" | "standings" | "history" | "members">("live_quiz");
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState<CircleMember[]>([]);
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [groupStandings, setGroupStandings] = useState<GroupStandingRow[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newCircleName, setNewCircleName] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [modalError, setModalError] = useState("");
  const [submittingModal, setSubmittingModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareLinkSuccess, setShareLinkSuccess] = useState(false);

  /* ── Load User's Study Groups from Unified Backend ── */
  const loadCircles = useCallback(async () => {
    if (!userId) {
      setCircles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/study-groups?user_id=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const list: ClassCircle[] = json.groups || [];
        setCircles(list);
        setActiveCircleId((prev) => (prev && list.some((g) => g.id === prev) ? prev : list[0]?.id || null));
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadCircleDetails = useCallback(
    async (circleId: string) => {
      if (!circleId) return;
      try {
        const res = await fetch(
          `/api/study-groups/${encodeURIComponent(circleId)}?user_id=${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const json = await res.json();
          if (json.members) setMembers(json.members);
          if (json.quiz_state?.history) setHistory(json.quiz_state.history);
          if (Array.isArray(json.group_standings)) {
            setGroupStandings(json.group_standings);
          }
          if (json.group) {
            setCircles((prev) => prev.map((c) => (c.id === circleId ? { ...c, ...json.group } : c)));
          }
        }
      } catch {}
    },
    [userId]
  );

  useEffect(() => {
    loadCircles();
  }, [loadCircles]);

  useEffect(() => {
    if (activeCircleId) {
      loadCircleDetails(activeCircleId);
    }
  }, [activeCircleId, loadCircleDetails]);

  /* ── Auto-join from URL invite link (`?join=CODE`) ── */
  useEffect(() => {
    if (!initialJoinCode || !userId) return;
    const code = initialJoinCode.trim().toUpperCase();
    if (!code) return;

    const autoJoin = async () => {
      try {
        const res = await fetch("/api/study-groups/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invite_code: code,
            user_id: userId,
            display_name: displayName,
            user_email: user?.email || "",
          }),
        });
        const json = await res.json();
        if (res.ok && json.group) {
          setCircles((prev) => {
            const filtered = prev.filter((g) => g.id !== json.group.id);
            return [json.group, ...filtered];
          });
          setActiveCircleId(json.group.id);
          setActiveTab("live_quiz");
        }
      } catch {
      } finally {
        onClearJoinCode?.();
      }
    };

    autoJoin();
  }, [initialJoinCode, userId, displayName, user?.email, onClearJoinCode]);

  const activeCircle = circles.find((c) => c.id === activeCircleId) || null;
  const currentMember = members.find((m) => m.user_id === userId);
  const isOwner = Boolean(activeCircle && (activeCircle.created_by === userId || currentMember?.role === "owner"));
  const isAssistantAdmin = currentMember?.role === "assistant_admin";
  const hasAdminPrivilege = isOwner || isAssistantAdmin;
  const assistantAdminCount = members.filter((m) => m.role === "assistant_admin").length;

  /* ── Create / Join Handlers ── */
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCircleName.trim() || !newCourseCode.trim()) return;
    setModalError("");
    setSubmittingModal(true);
    try {
      const res = await fetch("/api/study-groups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCircleName.trim(),
          course_code: newCourseCode.trim().toUpperCase(),
          institution: profile?.institution || "",
          description: newDescription.trim() || "Live synchronized quiz study group.",
          user_id: userId,
          display_name: displayName,
          user_email: user?.email || "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Could not create study group.");
      setCircles((prev) => [json.group, ...prev]);
      setActiveCircleId(json.group.id);
      setMembers(json.members || []);
      setActiveTab("live_quiz");
      setNewCircleName("");
      setNewCourseCode("");
      setNewDescription("");
      setShowCreateModal(false);
    } catch (err: any) {
      setModalError(err?.message || "Could not create group.");
    } finally {
      setSubmittingModal(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setModalError("");
    setSubmittingModal(true);
    try {
      const res = await fetch("/api/study-groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invite_code: joinCodeInput.trim().toUpperCase(),
          user_id: userId,
          display_name: displayName,
          user_email: user?.email || "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Invalid invite code.");
      setCircles((prev) => {
        const filtered = prev.filter((g) => g.id !== json.group.id);
        return [json.group, ...filtered];
      });
      setActiveCircleId(json.group.id);
      setMembers(json.members || []);
      setActiveTab("live_quiz");
      setJoinCodeInput("");
      setShowJoinModal(false);
    } catch (err: any) {
      setModalError(err?.message || "Could not join group.");
    } finally {
      setSubmittingModal(false);
    }
  };

  const handleUpdateRole = async (targetUserId: string, role: "assistant_admin" | "member" | "remove") => {
    if (!activeCircleId || !isOwner) return;
    try {
      const res = await fetch(`/api/study-groups/${encodeURIComponent(activeCircleId)}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor_user_id: userId,
          target_user_id: targetUserId,
          role,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.detail || "Could not update member role.");
        return;
      }
      setMembers(json.members || []);
      setCircles((prev) =>
        prev.map((c) => (c.id === activeCircleId ? { ...c, member_count: (json.members || []).length } : c))
      );
    } catch {}
  };

  const handleRoomStateSync = useCallback((state: RoomState) => {
    setOnlineIds(new Set((state.online || []).map((m) => m.user_id)));
    if (Array.isArray(state.history)) {
      setHistory(state.history);
    }
    if (Array.isArray(state.groupStandings)) {
      setGroupStandings(state.groupStandings);
    }
    setCircles((prev) =>
      prev.map((c) => (c.id === state.circleId ? { ...c, active_quiz_phase: state.phase } : c))
    );
  }, []);

  const handleCopyShareLink = () => {
    if (!activeCircle) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const joinUrl = `${origin}/dashboard?join=${encodeURIComponent(activeCircle.invite_code)}`;
    navigator.clipboard.writeText(joinUrl);
    setShareLinkSuccess(true);
    setTimeout(() => setShareLinkSuccess(false), 2000);
  };

  if (!userId) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center bg-white dark:bg-slate-900">
        <Users className="w-8 h-8 mx-auto text-slate-400 mb-2" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Sign In to Join Live Quiz Study Groups
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Create or join a course group with an invite code or share link to take live timed quizzes together with your classmates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Live Quiz Study Groups
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Admins upload a lecture slide and set a timer — all students (including admin) take the quiz synchronized together.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setModalError("");
              setShowJoinModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Hash className="w-4 h-4" />
            <span>Join with Code</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setModalError("");
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading your study groups...</span>
        </div>
      ) : circles.length === 0 ? (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center bg-white dark:bg-slate-900 space-y-4">
          <Clock className="w-9 h-9 mx-auto text-blue-600" />
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              No Study Groups Joined Yet
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Create a group for your class (capacity up to 1,000 participants) to host live synchronized quizzes, or enter an invite code / share link from your classmates.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Join Group
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
            >
              Create Group
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Column: Group List */}
          <aside className="w-full lg:w-72 shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-2 block">
                Your Groups ({circles.length})
              </span>
              <div className="space-y-1 max-h-[520px] overflow-y-auto">
                {circles.map((c) => {
                  const isLive = c.active_quiz_phase === "lobby" || c.active_quiz_phase === "running";
                  const isScheduled = c.active_quiz_phase === "scheduled";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveCircleId(c.id);
                        setActiveTab("live_quiz");
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-colors cursor-pointer ${
                        activeCircleId === c.id
                          ? "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {c.course_code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isLive && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              Live
                            </span>
                          )}
                          {isScheduled && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                              Scheduled
                            </span>
                          )}
                          <span className="text-xs text-slate-500">{c.member_count}/1000</span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {c.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Right Column: Active Study Group */}
          {activeCircle && (
            <main className="flex-1 min-w-0 w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6">
              {/* Group Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {activeCircle.course_code}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {activeCircle.name}
                    </h3>
                    {hasAdminPrivilege && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {isOwner ? "Group Admin" : "Assistant Admin"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {activeCircle.description}
                  </p>
                </div>

                {/* Shareable Link & Invite Code Buttons */}
                <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                    title="Copy shareable link so anyone can join with 1 click"
                  >
                    {shareLinkSuccess ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{shareLinkSuccess ? "Link copied!" : "Share join link"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeCircle.invite_code);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title="Copy invite code"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Code: {copySuccess ? "Copied!" : activeCircle.invite_code}</span>
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2 text-sm font-medium overflow-x-auto">
                {[
                  { id: "live_quiz", label: "Live Quiz", icon: <Clock className="w-4 h-4" /> },
                  { id: "standings", label: "Group Standings", icon: <Award className="w-4 h-4" /> },
                  {
                    id: "history",
                    label: `Past Quizzes (${history.length})`,
                    icon: <Trophy className="w-4 h-4" />,
                  },
                  {
                    id: "members",
                    label: `Members (${members.length}/1,000)`,
                    icon: <Users className="w-4 h-4" />,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === tab.id
                        ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* TAB 1: LIVE SYNCHRONIZED QUIZ */}
              <div className={activeTab === "live_quiz" ? "block" : "hidden"}>
                <LiveQuizRoom
                  circleId={activeCircle.id}
                  circleName={activeCircle.name}
                  user={user}
                  profile={profile}
                  hasAdminPrivilege={hasAdminPrivilege}
                  sessions={sessions}
                  onStateSync={handleRoomStateSync}
                />
              </div>

              {/* TAB 2: CUMULATIVE GROUP STANDINGS (Influences Global Leaderboard) */}
              {activeTab === "standings" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                        Group Standings &amp; XP
                      </h4>
                      <p className="text-xs text-slate-500">
                        Points earned from class quizzes automatically update each student&apos;s rank on the global Leaderboard.
                      </p>
                    </div>
                  </div>

                  {groupStandings.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/40">
                      No live quizzes completed yet in this group. Take your first live quiz to start the group standings!
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-3 px-4">Rank</th>
                            <th className="py-3 px-4">Student</th>
                            <th className="py-3 px-4 text-center">Quizzes</th>
                            <th className="py-3 px-4 text-center">Score</th>
                            <th className="py-3 px-4 text-center">Accuracy</th>
                            <th className="py-3 px-4 text-center">Wins 🏆</th>
                            <th className="py-3 px-4 text-right">XP Earned</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                          {groupStandings.map((s, idx) => {
                            const isMe = s.userId === userId;
                            return (
                              <tr
                                key={s.userId}
                                className={isMe ? "bg-blue-50/50 dark:bg-blue-950/30 font-semibold" : "hover:bg-slate-50/60 dark:hover:bg-slate-800/50"}
                              >
                                <td className="py-3 px-4">
                                  {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : `${idx + 1}`}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-slate-900 dark:text-white">
                                    {s.name} {isMe ? "(you)" : ""}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300">
                                  {s.quizzesTaken}
                                </td>
                                <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300 tabular-nums">
                                  {s.totalScore} / {s.totalPossible}
                                </td>
                                <td className="py-3 px-4 text-center tabular-nums">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                                    {s.accuracyPct}%
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center text-amber-600 font-semibold tabular-nums">
                                  {s.wins}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                                  +{s.totalXp} XP
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PAST QUIZ ROUNDS */}
              {activeTab === "history" && (
                <div className="space-y-4">
                  {history.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/40">
                      Completed live quizzes and group leaderboards will appear here.
                    </div>
                  ) : (
                    history.map((item) => (
                      <div
                        key={item.id}
                        className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 bg-white dark:bg-slate-900"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {item.title}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {item.questionCount} questions · {Math.round(item.durationSec / 60)} min ·{" "}
                              {new Date(item.completedAt).toLocaleString()}
                            </p>
                          </div>
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {item.participantCount}{" "}
                            {item.participantCount === 1 ? "participant" : "participants"}
                          </span>
                        </div>
                        {item.results && item.results.length > 0 && (
                          <ol className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                            {item.results.slice(0, 10).map((r, idx) => (
                              <li key={r.userId} className="py-1.5 flex items-center justify-between">
                                <span className="text-slate-800 dark:text-slate-200">
                                  {idx + 1}. {r.name}
                                  {r.userId === userId ? " (you)" : ""}
                                </span>
                                <span className="tabular-nums text-slate-600 dark:text-slate-400">
                                  {r.score} / {r.total} (
                                  {r.total ? Math.round((r.score / r.total) * 100) : 0}%)
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: MEMBERS & ADMIN ROLES */}
              {activeTab === "members" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
                    <p className="text-slate-600 dark:text-slate-400">
                      Capacity: <strong>{members.length} / 1,000</strong> members · Assistant Admins:{" "}
                      <strong>{assistantAdminCount} / 2</strong>
                    </p>
                    {isOwner && (
                      <p className="text-xs text-slate-500">
                        You can appoint up to 2 Assistant Admins to upload slides and host live quizzes.
                      </p>
                    )}
                  </div>

                  <ul className="divide-y divide-slate-200 dark:border-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {members.map((m) => {
                      const isOnline = onlineIds.has(m.user_id) || m.user_id === userId;
                      return (
                        <li
                          key={m.id}
                          className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap text-sm bg-white dark:bg-slate-900"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOnline ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                              }`}
                              title={isOnline ? "Online now" : "Offline"}
                            />
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {m.display_name || "Member"}
                              {m.user_id === userId ? " (you)" : ""}
                            </span>
                            {m.role === "owner" && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                <ShieldCheck className="w-3 h-3" />
                                Admin
                              </span>
                            )}
                            {m.role === "assistant_admin" && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                Assistant Admin
                              </span>
                            )}
                          </div>

                          {isOwner && m.user_id !== userId && m.role !== "owner" && (
                            <div className="flex items-center gap-2">
                              {m.role === "member" ? (
                                <button
                                  type="button"
                                  disabled={assistantAdminCount >= 2}
                                  onClick={() => handleUpdateRole(m.user_id, "assistant_admin")}
                                  className="text-xs font-medium px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                                >
                                  Make Assistant Admin
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateRole(m.user_id, "member")}
                                  className="text-xs font-medium px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  Remove Admin Role
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleUpdateRole(m.user_id, "remove")}
                                className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                                title="Remove from group"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </main>
          )}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-group-title"
        >
          <form
            onSubmit={handleCreateGroup}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 id="create-group-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Create a study group
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="cg-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Group name
                </label>
                <input
                  id="cg-name"
                  required
                  value={newCircleName}
                  onChange={(e) => setNewCircleName(e.target.value)}
                  placeholder="e.g. Microeconomics Exam Prep"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="cg-code" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Course code
                </label>
                <input
                  id="cg-code"
                  required
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  placeholder="e.g. ECON 201"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="cg-desc" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Short description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  id="cg-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Weekly timed slide quizzes"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {modalError && <p className="text-sm text-red-600">{modalError}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingModal}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium cursor-pointer"
              >
                {submittingModal ? "Creating..." : "Create group"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-group-title"
        >
          <form
            onSubmit={handleJoinGroup}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 id="join-group-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Join study group
              </h3>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label htmlFor="jg-code" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Invite code
              </label>
              <input
                id="jg-code"
                required
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. ECON201-4821"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            {modalError && <p className="text-sm text-red-600">{modalError}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingModal}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium cursor-pointer"
              >
                {submittingModal ? "Joining..." : "Join group"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
