/**
 * LAMLA Guide AI - Study Scheduler & Habit Planner Client Library
 * Slogan: "It's Never Too Late To Study."
 */

export interface ExamStudyPlan {
  exam_subject: string;
  exam_date: string;
  days_remaining: number;
  intensity: string;
  recommended_daily_questions: number;
  milestones: {
    stage: string;
    title: string;
    target_date: string;
    days_until: number;
    recommended_technique: string;
    completed: boolean;
  }[];
}

export interface SpacedRepetitionItem {
  id?: string;
  session_id: string;
  session_title: string;
  interval_stage: number; // 1 to 5
  next_revision_date: string;
  retention_estimate?: string;
  status: "pending" | "completed" | "skipped";
}

export interface StreakHealth {
  status: "ready_to_start" | "active_today" | "pending_today" | "shield_protected" | "reset_encouraging";
  current_streak: number;
  shield_applied: boolean;
  freezes_left: number;
  message: string;
  next_milestone: number;
}

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: "study_reminder" | "streak_shield" | "exam_countdown" | "milestone";
  action_url?: string;
  read: boolean;
  created_at: string;
}

export interface DailyStudyLog {
  study_date: string;
  questions_answered: number;
  minutes_spent: number;
  sessions_reviewed: string[];
}

/**
 * Calculates spaced repetition interval locally as a fallback
 */
export function calculateLocalSpacedRepetition(stage: number, baseDateStr?: string): {
  interval_days: number;
  next_revision_date: string;
  retention_estimate: string;
  next_stage: number;
} {
  const intervals: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
  const intervalDays = intervals[stage] || 30;
  
  const base = baseDateStr ? new Date(baseDateStr) : new Date();
  const nextDate = new Date(base.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  const retentionCurves: Record<number, string> = {
    1: "Estimated Retention: 58% (Review recommended within 24h)",
    2: "Estimated Retention: 72% (Solidifying memory traces)",
    3: "Estimated Retention: 85% (Consolidating long-term memory)",
    4: "Estimated Retention: 92% (High automaticity reached)",
    5: "Estimated Retention: 97% (Mastery achieved)",
  };

  return {
    interval_days: intervalDays,
    next_revision_date: nextDate.toISOString().split("T")[0],
    retention_estimate: retentionCurves[stage] || "Consolidated retention",
    next_stage: Math.min(stage + 1, 5),
  };
}

/**
 * Calculates local exam plan as fallback
 */
export function generateLocalExamPlan(
  examSubject: string,
  examDateStr: string,
  topics?: string[]
): ExamStudyPlan {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(examDateStr);
  exam.setHours(0, 0, 0, 0);

  const diffTime = exam.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  let dailyTarget = 10;
  let intensity = "Sustainable Spaced Learning";
  if (daysRemaining <= 7) {
    dailyTarget = 25;
    intensity = "High Intensity (Exam Sprint)";
  } else if (daysRemaining <= 21) {
    dailyTarget = 15;
    intensity = "Focused Consistency (Ramp Up)";
  }

  const topicList = topics && topics.length > 0 ? topics : [
    `${examSubject} Core Fundamentals & Definitions`,
    `${examSubject} Governing Principles & Case Studies`,
    `${examSubject} High-Yield Problem Sets & Calculations`,
    `${examSubject} Timed Mock Examination & Traps`,
  ];

  const milestones = topicList.map((t, idx) => {
    const fraction = (idx / Math.max(1, topicList.length - 1)) * 0.8;
    const offset = Math.floor(fraction * daysRemaining);
    const mDate = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);
    return {
      stage: `Milestone ${idx + 1}`,
      title: t,
      target_date: mDate.toISOString().split("T")[0],
      days_until: Math.max(0, offset),
      recommended_technique: idx < 2 ? "Detailed Notes & Teach Me From Zero" : "Active Recall & Timed MCQ",
      completed: false,
    };
  });

  return {
    exam_subject: examSubject,
    exam_date: examDateStr,
    days_remaining: daysRemaining,
    intensity,
    recommended_daily_questions: dailyTarget,
    milestones,
  };
}

/**
 * Requests browser notification permission if supported
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const perm = await Notification.requestPermission();
    return perm === "granted";
  }
  return false;
}

/**
 * Shows browser notification if permitted
 */
export function triggerStudyNotification(title: string, body: string, actionUrl?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
      });
      if (actionUrl) {
        notif.onclick = () => {
          window.focus();
          window.location.href = actionUrl;
        };
      }
    } catch (e) {
      console.warn("Could not dispatch browser notification:", e);
    }
  }
}
