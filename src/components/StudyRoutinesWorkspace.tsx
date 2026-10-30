"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Bell } from "lucide-react";
import {
  requestBrowserNotificationPermission,
  triggerStudyNotification,
} from "@/lib/studyScheduler";

interface StudyRoutinesWorkspaceProps {
  user: any;
  profile: any;
  sessions: any[];
  onOpenSession: (session: any, defaultTab?: string) => void;
  onUpdateDailyGoal: (newTarget: number) => void;
}

export const StudyRoutinesWorkspace: React.FC<StudyRoutinesWorkspaceProps> = ({
  profile,
  sessions,
  onUpdateDailyGoal,
}) => {
  const [dailyTarget, setDailyTarget] = useState<number>(10);
  const [questionsToday] = useState<number>(0);
  const [streakFreezes] = useState<number>(2);
  const [reminderTime, setReminderTime] = useState<string>("19:00");
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState<boolean>(false);

  const [weeklyActivity, setWeeklyActivity] = useState<
    { dayName: string; dateStr: string; questions: number; minutes: number; completed: boolean }[]
  >([]);

  useEffect(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isToday = i === 0;
      const answered = isToday ? questionsToday || 0 : 0;
      const mins = isToday ? Math.round((profile?.total_study_minutes || 0) % 60) : 0;
      week.push({
        dayName: days[d.getDay()],
        dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        questions: answered,
        minutes: mins,
        completed: answered >= dailyTarget,
      });
    }
    setWeeklyActivity(week);

    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserNotifEnabled(Notification.permission === "granted");
    }
  }, [sessions, dailyTarget, profile, questionsToday]);

  const handleSelectTarget = (target: number) => {
    setDailyTarget(target);
    onUpdateDailyGoal(target);
  };

  const handleToggleBrowserNotif = async () => {
    if (!browserNotifEnabled) {
      const granted = await requestBrowserNotificationPermission();
      setBrowserNotifEnabled(granted);
      if (granted) {
        triggerStudyNotification(
          "Study reminders enabled",
          "We will remind you at your scheduled study time and when live class quizzes begin."
        );
      }
    }
  };

  const progressPercent = Math.min(100, Math.round((questionsToday / dailyTarget) * 100));

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Clean White Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Study Planner
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Set your daily practice goal, track your active study hours, and manage browser reminders.
        </p>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Daily Target */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Today&apos;s practice goal</span>
            <span>{progressPercent}%</span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{questionsToday}</span>
            <span className="text-sm text-slate-500">/ {dailyTarget} questions</span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-xs text-slate-500 block">Daily target:</span>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 25].map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => handleSelectTarget(target)}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    dailyTarget === target
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {target}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Study Streak */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Current streak</span>
              <span>{streakFreezes} freeze credits left</span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {profile?.streak_days || 0}
              </span>
              <span className="text-sm text-slate-500">consecutive days</span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Streak freeze credits automatically protect your streak if you miss up to 2 days in a month.
            </p>
          </div>
        </div>

        {/* Total Study Time */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Logged study time</span>
              <span>
                {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {((profile?.total_study_minutes || 0) / 60).toFixed(1)}
              </span>
              <span className="text-sm text-slate-500">hours</span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Counted automatically only while LAMLA Guide is open and visible; pauses when you exit and resumes when you return.
            </p>
          </div>
        </div>
      </div>

      {/* 7-Day Consistency Grid */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Last 7 days
            </h3>
            <p className="text-xs text-slate-500">
              Daily practice activity from {weeklyActivity[0]?.dateStr} to today
            </p>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {weeklyActivity.map((day, idx) => {
            const isToday = idx === weeklyActivity.length - 1;
            return (
              <div
                key={day.dayName + idx}
                className={`p-3 rounded-xl border text-center ${
                  day.completed
                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                    : isToday
                    ? "bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800"
                    : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                }`}
              >
                <span className="text-xs font-medium text-slate-500 block">{day.dayName}</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-2">
                  {day.dateStr}
                </span>

                <div className="flex justify-center my-1">
                  {day.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <span
                      className={`w-2.5 h-2.5 rounded-full my-1 ${
                        isToday ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    />
                  )}
                </div>

                <span className="text-[11px] text-slate-500 block mt-1.5">
                  {day.questions}q &bull; {day.minutes}m
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Study Reminders */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-500" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Reminders
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <label htmlFor="reminder-time" className="text-sm font-medium text-slate-900 dark:text-white block">
                Preferred study time
              </label>
              <span className="text-xs text-slate-500">Daily reminder hour</span>
            </div>
            <input
              id="reminder-time"
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-slate-900 dark:text-white block">
                Browser notifications
              </span>
              <span className="text-xs text-slate-500">
                {browserNotifEnabled ? "Enabled in this browser" : "Get alerts when scheduled quizzes start"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleBrowserNotif}
              disabled={browserNotifEnabled}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                browserNotifEnabled
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {browserNotifEnabled ? "Enabled" : "Enable"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
