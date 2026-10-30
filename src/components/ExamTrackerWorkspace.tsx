"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface ExamTrackerItem {
  id: string;
  user_id?: string;
  course_code: string;
  exam_title: string;
  exam_datetime: string;
  target_grade: string;
  weight_percentage: number;
  topics: string[];
  completed_topics: string[];
  session_id?: string;
  session_title?: string;
  created_at?: string;
}

interface ExamTrackerWorkspaceProps {
  user: any;
  sessions: any[];
  quizzes: any[];
  quizAttempts: any[];
  onOpenSession: (session: any, defaultTab?: string) => void;
}

export default function ExamTrackerWorkspace({
  user,
  sessions,
  quizAttempts,
  onOpenSession,
}: ExamTrackerWorkspaceProps) {
  const [exams, setExams] = useState<ExamTrackerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  const [courseCode, setCourseCode] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("09:00");
  const [targetGrade, setTargetGrade] = useState("A");
  const [weightPercentage, setWeightPercentage] = useState(50);
  const [topicsInput, setTopicsInput] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadExams();
  }, [user]);

  const loadExams = async () => {
    setLoading(true);
    let loaded: ExamTrackerItem[] = [];

    if (user?.id) {
      try {
        const { data, error } = await supabase
          .from("exam_trackers")
          .select("*")
          .eq("user_id", user.id)
          .order("exam_datetime", { ascending: true });

        if (!error && data && data.length > 0) {
          loaded = data.map((d: any) => ({
            ...d,
            topics: d.topics || [],
            completed_topics: d.completed_topics || [],
          }));
        }
      } catch (e) {
        console.warn("Could not load exams from Supabase, checking local storage:", e);
      }
    }

    if (loaded.length === 0) {
      try {
        const saved = localStorage.getItem("lamla_real_exams");
        if (saved) {
          loaded = JSON.parse(saved);
        }
      } catch {}
    }

    setExams(loaded);
    setLoading(false);
  };

  const saveExamsState = async (updated: ExamTrackerItem[]) => {
    setExams(updated);
    try {
      localStorage.setItem("lamla_real_exams", JSON.stringify(updated));
    } catch {}
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !examTitle.trim() || !examDate) return;

    const fullDateTime = new Date(`${examDate}T${examTime}:00`);
    const parsedTopics = topicsInput
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const linkedSession = sessions.find((s) => s.id === selectedSessionId);

    const newExam: ExamTrackerItem = {
      id: "exam_" + Date.now(),
      user_id: user?.id,
      course_code: courseCode.trim().toUpperCase(),
      exam_title: examTitle.trim(),
      exam_datetime: fullDateTime.toISOString(),
      target_grade: targetGrade,
      weight_percentage: Number(weightPercentage) || 40,
      topics: parsedTopics,
      completed_topics: [],
      session_id: selectedSessionId || undefined,
      session_title: linkedSession?.title || undefined,
      created_at: new Date().toISOString(),
    };

    if (user?.id) {
      try {
        const { data, error } = await supabase
          .from("exam_trackers")
          .insert({
            user_id: user.id,
            course_code: newExam.course_code,
            exam_title: newExam.exam_title,
            exam_datetime: newExam.exam_datetime,
            target_grade: newExam.target_grade,
            weight_percentage: newExam.weight_percentage,
            topics: newExam.topics,
            completed_topics: newExam.completed_topics,
            session_id: newExam.session_id,
          })
          .select()
          .single();

        if (!error && data) {
          newExam.id = data.id;
        }
      } catch (e) {
        console.warn("Could not save to Supabase, saved locally:", e);
      }
    }

    const updated = [...exams, newExam].sort(
      (a, b) => new Date(a.exam_datetime).getTime() - new Date(b.exam_datetime).getTime()
    );
    await saveExamsState(updated);

    setCourseCode("");
    setExamTitle("");
    setExamDate("");
    setExamTime("09:00");
    setTargetGrade("A");
    setWeightPercentage(50);
    setTopicsInput("");
    setSelectedSessionId("");
    setShowAddModal(false);
  };

  const handleDeleteExam = async (id: string) => {
    if (user?.id) {
      try {
        await supabase.from("exam_trackers").delete().eq("id", id);
      } catch {}
    }
    const updated = exams.filter((e) => e.id !== id);
    await saveExamsState(updated);
  };

  const handleToggleTopic = async (examId: string, topic: string) => {
    const target = exams.find((e) => e.id === examId);
    if (!target) return;

    const isCompleted = target.completed_topics.includes(topic);
    const updatedCompleted = isCompleted
      ? target.completed_topics.filter((t) => t !== topic)
      : [...target.completed_topics, topic];

    const updatedExams = exams.map((e) =>
      e.id === examId ? { ...e, completed_topics: updatedCompleted } : e
    );

    if (user?.id) {
      try {
        await supabase
          .from("exam_trackers")
          .update({ completed_topics: updatedCompleted })
          .eq("id", examId);
      } catch {}
    }

    await saveExamsState(updatedExams);
  };

  const getCountdown = (targetIso: string) => {
    const target = new Date(targetIso).getTime();
    const current = now.getTime();
    const diff = target - current;

    if (diff <= 0) {
      return { isOverdue: true, days: 0, hours: 0, minutes: 0, seconds: 0, badge: "Concluded" };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let badge = "";
    if (days === 0 && hours < 12) badge = "Today";
    else if (days === 0) badge = "Within 24h";
    else if (days === 1) badge = "Tomorrow";
    else if (days <= 7) badge = `In ${days} days`;
    else badge = `In ${Math.ceil(days / 7)} weeks`;

    return { isOverdue: false, days, hours, minutes, seconds, badge };
  };

  const getReadinessScore = (exam: ExamTrackerItem) => {
    const topicScore =
      exam.topics.length > 0
        ? Math.round((exam.completed_topics.length / exam.topics.length) * 60)
        : 30;

    let practiceScore = 0;
    if (exam.session_id) {
      const sessionAttempts = quizAttempts.filter((a) => a.document_id === exam.session_id);
      if (sessionAttempts.length > 0) {
        const avgScore =
          sessionAttempts.reduce((acc, a) => acc + (a.score_percentage || 0), 0) /
          sessionAttempts.length;
        practiceScore = Math.round((avgScore / 100) * 40);
      } else {
        practiceScore = 10;
      }
    } else {
      practiceScore = 20;
    }

    return Math.min(100, topicScore + practiceScore);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Exam Countdowns
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Add your real examination dates to track live countdowns and syllabus completion.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add exam</span>
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">
          Loading exams...
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center max-w-md mx-auto space-y-4">
          <Calendar className="w-8 h-8 text-blue-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
              No exams scheduled yet
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Add your upcoming mid-semester, final, or WASSCE dates to see a live countdown and topic checklist.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add your first exam</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exams.map((exam) => {
            const countdown = getCountdown(exam.exam_datetime);
            const readiness = getReadinessScore(exam);
            const examDateObj = new Date(exam.exam_datetime);
            const linkedSession = sessions.find((s) => s.id === exam.session_id);

            return (
              <div
                key={exam.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {exam.course_code}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                            countdown.isOverdue
                              ? "bg-slate-100 text-slate-600"
                              : "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {countdown.badge}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                        {exam.exam_title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteExam(exam.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                      aria-label="Remove exam"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Live Countdown */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200/70 dark:border-slate-800">
                    {countdown.isOverdue ? (
                      <div className="text-center py-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                        Exam date has passed
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { val: countdown.days, lbl: "Days", highlight: false },
                          { val: countdown.hours, lbl: "Hours", highlight: false },
                          { val: countdown.minutes, lbl: "Mins", highlight: false },
                          { val: countdown.seconds, lbl: "Secs", highlight: true },
                        ].map((unit) => (
                          <div
                            key={unit.lbl}
                            className="bg-white dark:bg-slate-900 rounded-lg py-2 border border-slate-200/80 dark:border-slate-700/60"
                          >
                            <span
                              className={`text-lg font-bold tabular-nums block leading-tight ${
                                unit.highlight
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-slate-900 dark:text-slate-100"
                              }`}
                            >
                              {unit.val}
                            </span>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              {unit.lbl}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-center text-xs text-slate-500 mt-2.5 flex items-center justify-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {examDateObj.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        at{" "}
                        {examDateObj.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Readiness Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">
                        Preparation progress
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {readiness}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${readiness}%` }}
                      />
                    </div>
                  </div>

                  {/* Topics Checklist */}
                  {exam.topics.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-medium text-slate-500 block">
                        Topics ({exam.completed_topics.length}/{exam.topics.length})
                      </span>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {exam.topics.map((t, idx) => {
                          const isDone = exam.completed_topics.includes(t);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleToggleTopic(exam.id, t)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                                isDone
                                  ? "bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 line-through"
                                  : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <span className="truncate">{t}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Target: <strong className="text-slate-700 dark:text-slate-300">Grade {exam.target_grade}</strong> ({exam.weight_percentage}% weight)
                  </span>

                  {linkedSession ? (
                    <button
                      type="button"
                      onClick={() => onOpenSession(linkedSession, "smart_drill")}
                      className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>Open session</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-slate-400">No linked session</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Examination Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-exam-title"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 id="add-exam-title" className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                Add examination
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="exam-code" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Course code
                  </label>
                  <input
                    id="exam-code"
                    type="text"
                    required
                    placeholder="e.g. ECON 201"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="exam-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Exam title
                  </label>
                  <input
                    id="exam-title"
                    type="text"
                    required
                    placeholder="e.g. Mid-Semester Exam"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="exam-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date
                  </label>
                  <input
                    id="exam-date"
                    type="date"
                    required
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="exam-time" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start time
                  </label>
                  <input
                    id="exam-time"
                    type="time"
                    required
                    value={examTime}
                    onChange={(e) => setExamTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="exam-grade" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target grade
                  </label>
                  <select
                    id="exam-grade"
                    value={targetGrade}
                    onChange={(e) => setTargetGrade(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  >
                    <option value="A">Grade A (80-100%)</option>
                    <option value="B+">Grade B+ (75-79%)</option>
                    <option value="B">Grade B (70-74%)</option>
                    <option value="C+">Grade C+ (65-69%)</option>
                    <option value="C">Grade C (60-64%)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="exam-weight" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Weight (%)
                  </label>
                  <input
                    id="exam-weight"
                    type="number"
                    min="10"
                    max="100"
                    value={weightPercentage}
                    onChange={(e) => setWeightPercentage(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="exam-topics" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Topics checklist <span className="text-slate-400 font-normal">(comma-separated, optional)</span>
                </label>
                <textarea
                  id="exam-topics"
                  rows={2}
                  placeholder="e.g. Price Elasticity, Market Structures, Consumer Theory"
                  value={topicsInput}
                  onChange={(e) => setTopicsInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label htmlFor="exam-session" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Link study session <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <select
                  id="exam-session"
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                >
                  <option value="">None</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  Save exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
