"""
LAMLA Guide AI - Study Scheduler & Spaced Repetition Engine (Python Engine)
Slogan: "It's Never Too Late To Study."
Deterministic educational scheduling based on Ebbinghaus forgetting curves,
Leitner box intervals, and structured exam countdown planning.
"""

from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional


SPACED_INTERVALS = {
    1: 1,   # Stage 1: Review after 1 day
    2: 3,   # Stage 2: Review after 3 days
    3: 7,   # Stage 3: Review after 7 days
    4: 14,  # Stage 4: Review after 14 days
    5: 30,  # Stage 5: Review after 30 days
}


def calculate_spaced_repetition(stage: int, base_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Calculates next revision date based on current Leitner interval stage.
    """
    if base_date:
        try:
            start = datetime.fromisoformat(base_date.split("T")[0]).date()
        except Exception:
            start = date.today()
    else:
        start = date.today()

    interval_days = SPACED_INTERVALS.get(stage, 30)
    next_date = start + timedelta(days=interval_days)

    retention_curves = {
        1: "Estimated Retention: 58% if unreviewed (Review recommended within 24h)",
        2: "Estimated Retention: 72% (Solidifying memory traces)",
        3: "Estimated Retention: 85% (Transitioning to long-term memory)",
        4: "Estimated Retention: 92% (High automaticity reached)",
        5: "Estimated Retention: 97% (Mastery consolidated)",
    }

    return {
        "current_stage": stage,
        "next_stage": min(stage + 1, 5),
        "interval_days": interval_days,
        "next_revision_date": next_date.isoformat(),
        "retention_estimate": retention_curves.get(stage, "Consolidated retention"),
        "is_mastered": stage >= 5,
    }


def generate_exam_study_plan(
    exam_subject: str,
    exam_date_str: str,
    topics: Optional[List[str]] = None,
    current_date_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generates a spaced revision roadmap leading up to an exam deadline.
    """
    try:
        exam_date = datetime.fromisoformat(exam_date_str.split("T")[0]).date()
    except Exception:
        exam_date = date.today() + timedelta(days=14)

    if current_date_str:
        try:
            today = datetime.fromisoformat(current_date_str.split("T")[0]).date()
        except Exception:
            today = date.today()
    else:
        today = date.today()

    days_remaining = (exam_date - today).days

    if days_remaining <= 0:
        return {
            "exam_subject": exam_subject,
            "exam_date": exam_date.isoformat(),
            "days_remaining": 0,
            "status": "Exam day is here or passed",
            "recommended_daily_questions": 15,
            "milestones": [
                {
                    "title": "Final Confidence Review",
                    "target_date": today.isoformat(),
                    "focus": "Review high-yield formula sheets and summary notes. Get 8 hours of sleep.",
                    "completed": False
                }
            ]
        }

    # Recommended daily questions based on urgency
    if days_remaining <= 7:
        daily_target = 25
        intensity = "High Intensity (Exam Sprint)"
    elif days_remaining <= 21:
        daily_target = 15
        intensity = "Focused Consistency (Ramp Up)"
    else:
        daily_target = 10
        intensity = "Sustainable Spaced Learning"

    # Default topics if none provided
    if not topics or len(topics) == 0:
        topics = [
            f"{exam_subject} Core Fundamentals & Definitions",
            f"{exam_subject} Governing Laws & Mechanism Analysis",
            f"{exam_subject} Calculation & Problem-Solving Drills",
            f"{exam_subject} High-Yield Exam Traps & Mock Questions",
        ]

    # Distribute topics across 3 educational phases
    milestones = []
    num_topics = len(topics)

    # Phase 1: Core comprehension (0% - 40% of time)
    phase1_days = max(1, int(days_remaining * 0.4))
    # Phase 2: Active recall drills (40% - 80% of time)
    phase2_days = max(1, int(days_remaining * 0.4))
    # Phase 3: Mock exams & revision (last 20% of time)
    phase3_days = max(1, days_remaining - phase1_days - phase2_days)

    for i, t in enumerate(topics):
        offset = int((i / max(1, num_topics - 1)) * (days_remaining - phase3_days))
        m_date = today + timedelta(days=offset)
        milestones.append({
            "stage": f"Milestone {i + 1}",
            "title": t,
            "target_date": m_date.isoformat(),
            "days_until": (m_date - today).days,
            "recommended_technique": "Detailed Notes & Teach Me From Zero" if i < num_topics // 2 else "Timed Examination Drills",
            "completed": False
        })

    # Add final mock exam milestone
    mock_date = exam_date - timedelta(days=max(1, int(days_remaining * 0.1)))
    milestones.append({
        "stage": f"Milestone {len(topics) + 1}",
        "title": f"Full {exam_subject} Timed Mock Exam",
        "target_date": mock_date.isoformat(),
        "days_until": (mock_date - today).days,
        "recommended_technique": "Assertion-Reason & Standard MCQ under exam clock",
        "completed": False
    })

    return {
        "exam_subject": exam_subject,
        "exam_date": exam_date.isoformat(),
        "days_remaining": days_remaining,
        "intensity": intensity,
        "recommended_daily_questions": daily_target,
        "milestones": milestones,
    }


def evaluate_streak_health(
    last_active_date_str: Optional[str],
    current_streak: int,
    streak_freezes_left: int = 2,
    today_date_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates streak state using sustainable habits:
    - Same day: already counted
    - 1 day elapsed: streak maintained, ready to extend
    - 2 days elapsed: streak shield triggered if freeze credit available
    - >2 days: encouraging reset (never punishing)
    """
    if today_date_str:
        try:
            today = datetime.fromisoformat(today_date_str.split("T")[0]).date()
        except Exception:
            today = date.today()
    else:
        today = date.today()

    if not last_active_date_str:
        return {
            "status": "ready_to_start",
            "current_streak": 0,
            "shield_applied": False,
            "freezes_left": streak_freezes_left,
            "message": "Begin your streak today! Study for 10 minutes or answer 5 questions.",
            "next_milestone": 3
        }

    try:
        last_date = datetime.fromisoformat(last_active_date_str.split("T")[0]).date()
    except Exception:
        last_date = today

    days_elapsed = (today - last_date).days

    if days_elapsed == 0:
        return {
            "status": "active_today",
            "current_streak": current_streak,
            "shield_applied": False,
            "freezes_left": streak_freezes_left,
            "message": f"🔥 {current_streak}-day streak locked in for today! Great dedication.",
            "next_milestone": 7 if current_streak < 7 else (14 if current_streak < 14 else 30)
        }
    elif days_elapsed == 1:
        return {
            "status": "pending_today",
            "current_streak": current_streak,
            "shield_applied": False,
            "freezes_left": streak_freezes_left,
            "message": f"Your {current_streak}-day streak is waiting! Complete today's session to reach day {current_streak + 1}.",
            "next_milestone": 7 if current_streak < 7 else 14
        }
    elif days_elapsed == 2 and streak_freezes_left > 0:
        return {
            "status": "shield_protected",
            "current_streak": current_streak,
            "shield_applied": True,
            "freezes_left": streak_freezes_left - 1,
            "message": f"🛡️ Streak Shield Activated! You missed yesterday, but your {current_streak}-day streak is protected.",
            "next_milestone": 7 if current_streak < 7 else 14
        }
    else:
        return {
            "status": "reset_encouraging",
            "current_streak": 0,
            "shield_applied": False,
            "freezes_left": streak_freezes_left,
            "message": "“It's Never Too Late To Study.” A fresh streak begins today — let's aim for 3 days in a row!",
            "next_milestone": 3
        }
