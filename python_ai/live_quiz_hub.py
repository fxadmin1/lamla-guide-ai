"""
LAMLA Guide AI - High-Scale Study Groups & Synchronized Live/Scheduled Quiz Hub
"It's Never Too Late To Study."

Capabilities:
- High-capacity Study Groups (up to 1,000 concurrent students per class, owner + up to 2 assistant admins)
- Shareable Invite Links & Invite-Code Preview (/api/study-groups/invite/{invite_code})
- Up to 50 non-repeating slide questions per live round
- Automatic Host/Admin Participation alongside all students
- Scheduled Quizzes (/api/live-quiz/{circle_id}/schedule) that auto-start on the exact scheduled second
- Server-authoritative countdown & Independent Auto-Marking for every participant when time expires
- Cumulative Group Standings + Automatic Supabase `profiles.points` XP sync influencing the Global Leaderboard
- O(N) precomputed concurrent WebSocket fanout (`asyncio.gather`) + debounced progress updates for smooth scale
"""

import os
import json
import time
import uuid
import random
import asyncio
import threading
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel

router = APIRouter()

MAX_GROUP_MEMBERS = 1000
MAX_QUIZ_QUESTIONS = 50

DATA_DIR = Path(
    os.environ.get(
        "LAMLA_DATA_DIR",
        Path(__file__).resolve().parent.parent / ".cache" / "lamla_data",
    )
)
DATA_DIR.mkdir(parents=True, exist_ok=True)
GROUPS_FILE = DATA_DIR / "study_groups.json"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ───────────────────────── Supabase Global Leaderboard XP Sync ─────────────────────────

def _award_supabase_xp_background(awards: List[Dict[str, Any]]):
    """
    Awards live group quiz XP directly to each participant's Supabase `profiles.points`
    so class quiz standings immediately influence the main LAMLA Leaderboard.
    """
    supa_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supa_url or not service_key or "placeholder" in supa_url:
        return

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    for item in awards:
        uid = str(item.get("userId") or "").strip()
        xp = int(item.get("xpEarned") or 0)
        mins = max(1, int(item.get("minutesSpent") or 1))
        if not uid or xp <= 0 or len(uid) < 20:
            continue
        try:
            # Fetch current points & total_study_minutes
            get_url = f"{supa_url}/rest/v1/profiles?id=eq.{urllib.parse.quote(uid)}&select=points,total_study_minutes"
            req_get = urllib.request.Request(get_url, headers=headers, method="GET")
            with urllib.request.urlopen(req_get, timeout=5) as resp:
                rows = json.loads(resp.read().decode("utf-8"))
            if not rows:
                continue
            curr_pts = int(rows[0].get("points") or 0)
            curr_mins = int(rows[0].get("total_study_minutes") or 0)

            patch_url = f"{supa_url}/rest/v1/profiles?id=eq.{urllib.parse.quote(uid)}"
            body = json.dumps({
                "points": curr_pts + xp,
                "total_study_minutes": curr_mins + mins,
                "updated_at": _now_iso(),
            }).encode("utf-8")
            req_patch = urllib.request.Request(patch_url, data=body, headers=headers, method="PATCH")
            with urllib.request.urlopen(req_patch, timeout=5):
                pass
        except Exception as e:
            print(f"[LiveQuizHub] Supabase XP sync warning for {uid}: {e}")


# ───────────────────────── Persistent Group Store ─────────────────────────

class GroupStore:
    def __init__(self, path: Path):
        self.path = path
        self.groups: Dict[str, Dict[str, Any]] = {}
        self._save_lock = threading.Lock()
        self._load()

    def _load(self):
        if self.path.exists():
            try:
                raw = json.loads(self.path.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    self.groups = raw
            except Exception as e:
                print(f"[LiveQuizHub] Could not read {self.path}: {e}")

    def save(self):
        with self._save_lock:
            try:
                tmp = self.path.with_suffix(".tmp")
                tmp.write_text(json.dumps(self.groups, indent=2), encoding="utf-8")
                tmp.replace(self.path)
            except Exception as e:
                print(f"[LiveQuizHub] Could not save {self.path}: {e}")

    def save_async(self):
        threading.Thread(target=self.save, daemon=True).start()

    def list_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        result = []
        for g in self.groups.values():
            members = g.get("members", [])
            if g.get("created_by") == user_id or any(m.get("user_id") == user_id for m in members):
                result.append(self._summary(g))
        result.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return result

    def _summary(self, g: Dict[str, Any]) -> Dict[str, Any]:
        room = LIVE_ROOMS.get(g["id"])
        phase = room["phase"] if room else ("scheduled" if g.get("scheduled_quiz") else "idle")
        sched_at = None
        if room and room.get("scheduled"):
            sched_at = room["scheduled"].get("scheduledStartAt")
        elif g.get("scheduled_quiz"):
            sched_at = g["scheduled_quiz"].get("scheduledStartAt")
        return {
            "id": g["id"],
            "name": g["name"],
            "course_code": g["course_code"],
            "institution": g.get("institution", ""),
            "description": g.get("description", ""),
            "invite_code": g["invite_code"],
            "created_by": g["created_by"],
            "member_count": len(g.get("members", [])),
            "max_members": MAX_GROUP_MEMBERS,
            "created_at": g.get("created_at", ""),
            "active_quiz_phase": phase,
            "scheduled_start_at": sched_at,
        }

    def get(self, circle_id: str) -> Optional[Dict[str, Any]]:
        return self.groups.get(circle_id)

    def find_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        cleaned = code.strip().upper()
        for g in self.groups.values():
            if g.get("invite_code", "").upper() == cleaned:
                return g
        return None

    def is_admin(self, circle_id: str, user_id: str) -> bool:
        g = self.groups.get(circle_id)
        if not g or not user_id:
            return False
        if g.get("created_by") == user_id:
            return True
        for m in g.get("members", []):
            if m.get("user_id") == user_id and m.get("role") in ("owner", "assistant_admin"):
                return True
        return False


STORE = GroupStore(GROUPS_FILE)

LIVE_ROOMS: Dict[str, Dict[str, Any]] = {}
WS_CONNECTIONS: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}  # circle_id -> user_id -> [{ws, name}]
TIMER_TASKS: Dict[str, asyncio.Task] = {}
SCHEDULE_TASKS: Dict[str, asyncio.Task] = {}
DEBOUNCE_TASKS: Dict[str, asyncio.Task] = {}


def _get_or_create_room(circle_id: str) -> Dict[str, Any]:
    if circle_id not in LIVE_ROOMS:
        LIVE_ROOMS[circle_id] = {
            "phase": "idle",        # "idle" | "lobby" | "scheduled" | "running" | "finished"
            "lobby": None,
            "scheduled": None,      # {id, hostId, hostName, title, count, durationSec, scheduledStartAt, publicQuestions}
            "round": None,          # {id, hostId, hostName, title, questions, durationSec, startAt, endsAt}
            "secret_key": [],       # [{correct: int, explanation: str, sourceRef: str}]
            "submissions": {},      # user_id -> {name, answers: {int_str: int}, submitted: bool, submitted_at: int}
            "results": None,        # graded leaderboard when finished
        }
        # Hydrate persisted scheduled quiz if present
        g = STORE.get(circle_id)
        if g and g.get("scheduled_quiz"):
            sq = g["scheduled_quiz"]
            LIVE_ROOMS[circle_id]["phase"] = "scheduled"
            LIVE_ROOMS[circle_id]["scheduled"] = {
                "id": sq["id"],
                "hostId": sq["hostId"],
                "hostName": sq["hostName"],
                "title": sq["title"],
                "count": len(sq.get("publicQuestions", [])),
                "durationSec": sq["durationSec"],
                "scheduledStartAt": sq["scheduledStartAt"],
                "publicQuestions": sq.get("publicQuestions", []),
            }
            LIVE_ROOMS[circle_id]["secret_key"] = sq.get("secretKey", [])
    return LIVE_ROOMS[circle_id]


def _online_members(circle_id: str) -> List[Dict[str, str]]:
    conns = WS_CONNECTIONS.get(circle_id, {})
    out = []
    for uid, entries in conns.items():
        if entries:
            out.append({"user_id": uid, "name": entries[-1]["name"]})
    return out


def _compute_sorted_standings(g: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not g:
        return []
    raw_map = g.get("group_standings") or {}
    rows = list(raw_map.values())
    rows.sort(
        key=lambda r: (
            -int(r.get("totalXpEarned", 0)),
            -int(r.get("totalScore", 0)),
            -int(r.get("wins", 0)),
            str(r.get("name", "")).lower(),
        )
    )
    for idx, r in enumerate(rows, 1):
        r["rank"] = idx
    return rows


def _build_shared_room_snapshot(circle_id: str) -> Dict[str, Any]:
    """Precomputes all shared O(N) room arrays ONCE per broadcast for high-concurrency scaling."""
    room = _get_or_create_room(circle_id)
    g = STORE.get(circle_id)
    phase = room["phase"]

    progress = [
        {
            "userId": uid,
            "name": sub["name"],
            "answered": len(sub.get("answers", {})),
            "submitted": bool(sub.get("submitted", False)),
        }
        for uid, sub in room["submissions"].items()
    ]

    return {
        "circleId": circle_id,
        "phase": phase,
        "serverNow": _now_ms(),
        "lobby": room["lobby"],
        "scheduled": room["scheduled"],
        "round": room["round"],
        "online": _online_members(circle_id),
        "progress": progress,
        "results": room["results"] if phase == "finished" else None,
        "answerKey": room["secret_key"] if phase == "finished" else None,
        "history": (g.get("quiz_history", [])[:20] if g else []),
        "standings": _compute_sorted_standings(g)[:100],
    }


def _build_client_state(circle_id: str, viewer_id: str = "", shared: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    room = _get_or_create_room(circle_id)
    base = dict(shared) if shared is not None else _build_shared_room_snapshot(circle_id)
    my_sub = room["submissions"].get(viewer_id) if viewer_id else None
    base["myAnswers"] = my_sub.get("answers", {}) if my_sub else {}
    base["mySubmitted"] = bool(my_sub.get("submitted", False)) if my_sub else False
    return base


async def _broadcast_room(circle_id: str):
    """High-throughput concurrent WebSocket broadcast (handles hundreds of students simultaneously)."""
    conns = WS_CONNECTIONS.get(circle_id, {})
    if not conns:
        return

    shared_snapshot = _build_shared_room_snapshot(circle_id)
    send_jobs = []
    job_meta = []

    for uid, entries in list(conns.items()):
        payload = {"type": "room_state", "state": _build_client_state(circle_id, viewer_id=uid, shared=shared_snapshot)}
        for entry in list(entries):
            send_jobs.append(asyncio.wait_for(entry["ws"].send_json(payload), timeout=2.5))
            job_meta.append((uid, entry))

    if not send_jobs:
        return

    outcomes = await asyncio.gather(*send_jobs, return_exceptions=True)
    for (uid, entry), outcome in zip(job_meta, outcomes):
        if isinstance(outcome, Exception):
            lst = conns.get(uid, [])
            if entry in lst:
                lst.remove(entry)
            if not lst:
                conns.pop(uid, None)


def _schedule_debounced_broadcast(circle_id: str, delay_sec: float = 0.12):
    """Coalesces bursts of simultaneous answer clicks from large classes into smooth 8Hz updates."""
    existing = DEBOUNCE_TASKS.get(circle_id)
    if existing and not existing.done():
        return

    async def _runner():
        try:
            await asyncio.sleep(delay_sec)
            await _broadcast_room(circle_id)
        finally:
            DEBOUNCE_TASKS.pop(circle_id, None)

    DEBOUNCE_TASKS[circle_id] = asyncio.create_task(_runner())


def _seed_participants_on_start(circle_id: str, room: Dict[str, Any], host_id: str, host_name: str):
    """
    Ensures the admin/host AND every currently connected classmate are automatically registered
    as quiz participants so everyone is marked independently when time expires.
    """
    subs = room["submissions"]
    if host_id and host_id not in subs:
        subs[host_id] = {
            "name": host_name or "Admin",
            "answers": {},
            "submitted": False,
            "submitted_at": None,
        }
    for m in _online_members(circle_id):
        uid = m["user_id"]
        if uid and uid not in subs:
            subs[uid] = {
                "name": m["name"] or "Student",
                "answers": {},
                "submitted": False,
                "submitted_at": None,
            }


def _launch_running_round(
    circle_id: str,
    host_id: str,
    host_name: str,
    title: str,
    public_questions: List[Dict[str, Any]],
    secret_key: List[Dict[str, Any]],
    duration_sec: int,
    countdown_ms: int = 5000,
):
    room = _get_or_create_room(circle_id)
    now_ms = _now_ms()
    start_at = now_ms + max(0, countdown_ms)
    ends_at = start_at + int(duration_sec) * 1000
    round_id = f"rnd_{uuid.uuid4().hex[:10]}"

    room["round"] = {
        "id": round_id,
        "hostId": host_id,
        "hostName": host_name,
        "title": title,
        "questions": public_questions,
        "durationSec": duration_sec,
        "startAt": start_at,
        "endsAt": ends_at,
    }
    room["secret_key"] = secret_key
    room["phase"] = "running"
    room["lobby"] = None
    room["scheduled"] = None
    room["submissions"] = {}
    room["results"] = None

    _seed_participants_on_start(circle_id, room, host_id, host_name)

    g = STORE.get(circle_id)
    if g and "scheduled_quiz" in g:
        g.pop("scheduled_quiz", None)
        STORE.save_async()

    old_sched = SCHEDULE_TASKS.pop(circle_id, None)
    if old_sched and not old_sched.done() and old_sched is not asyncio.current_task():
        old_sched.cancel()

    old_timer = TIMER_TASKS.pop(circle_id, None)
    if old_timer and not old_timer.done():
        old_timer.cancel()
    TIMER_TASKS[circle_id] = asyncio.create_task(_auto_end_timer(circle_id, round_id, ends_at))


def _finalize_round(circle_id: str) -> bool:
    """
    Marks every participant's answers independently when time expires (or when all submit),
    updates cumulative Group Standings, and awards XP to the Global Supabase Leaderboard.
    """
    room = _get_or_create_room(circle_id)
    if room["phase"] != "running" or not room["round"]:
        return False

    cancel_task = TIMER_TASKS.pop(circle_id, None)
    if cancel_task and not cancel_task.done() and cancel_task is not asyncio.current_task():
        cancel_task.cancel()

    # Ensure anyone still online in the room during the quiz is included in independent marking
    _seed_participants_on_start(
        circle_id,
        room,
        room["round"].get("hostId", ""),
        room["round"].get("hostName", "Admin"),
    )

    key = room["secret_key"]
    total = len(key)
    rows = []
    started_at = room["round"].get("startAt", _now_ms())
    duration_sec = int(room["round"].get("durationSec", 60))

    for uid, sub in room["submissions"].items():
        ans = sub.get("answers", {})
        score = 0
        for idx, k in enumerate(key):
            picked = ans.get(str(idx))
            if picked is not None and int(picked) == int(k["correct"]):
                score += 1
        finished_ms = sub.get("submitted_at") or _now_ms()
        time_taken_sec = max(1, min(duration_sec, round((finished_ms - started_at) / 1000)))
        pct = round((score / total) * 100) if total > 0 else 0
        rows.append({
            "userId": uid,
            "name": sub.get("name", "Scholar"),
            "score": score,
            "total": total,
            "percentage": pct,
            "answered": len(ans),
            "submitted": bool(sub.get("submitted", False)),
            "timeTakenSec": time_taken_sec,
            "xpEarned": 0,
            "_sort_ts": finished_ms,
        })

    rows.sort(key=lambda r: (-r["score"], r["_sort_ts"], r["name"].lower()))

    podium_bonuses = {0: 20, 1: 12, 2: 8} if len(rows) >= 2 else {0: 10}
    xp_awards_for_supabase = []

    for idx, r in enumerate(rows):
        r.pop("_sort_ts", None)
        r["rank"] = idx + 1
        base_xp = int(r["score"]) * 3
        pass_bonus = 15 if r["percentage"] >= 70 else (5 if r["answered"] > 0 else 0)
        podium = podium_bonuses.get(idx, 0) if r["score"] > 0 else 0
        total_xp = base_xp + pass_bonus + podium
        r["xpEarned"] = total_xp
        if total_xp > 0:
            xp_awards_for_supabase.append({
                "userId": r["userId"],
                "xpEarned": total_xp,
                "minutesSpent": max(1, round(r["timeTakenSec"] / 60)),
            })

    room["results"] = rows
    room["phase"] = "finished"

    g = STORE.get(circle_id)
    if g is not None:
        now_iso = _now_iso()
        # Update Cumulative Group Standings
        standings_map: Dict[str, Dict[str, Any]] = g.setdefault("group_standings", {})
        for r in rows:
            uid = r["userId"]
            entry = standings_map.get(uid) or {
                "userId": uid,
                "name": r["name"],
                "quizzesTaken": 0,
                "totalScore": 0,
                "totalQuestions": 0,
                "totalXpEarned": 0,
                "wins": 0,
                "bestPct": 0,
                "lastPlayedAt": now_iso,
            }
            entry["name"] = r["name"] or entry["name"]
            entry["quizzesTaken"] = int(entry.get("quizzesTaken", 0)) + 1
            entry["totalScore"] = int(entry.get("totalScore", 0)) + int(r["score"])
            entry["totalQuestions"] = int(entry.get("totalQuestions", 0)) + int(total)
            entry["totalXpEarned"] = int(entry.get("totalXpEarned", 0)) + int(r["xpEarned"])
            if r["rank"] == 1 and r["score"] > 0:
                entry["wins"] = int(entry.get("wins", 0)) + 1
            entry["bestPct"] = max(int(entry.get("bestPct", 0)), int(r["percentage"]))
            entry["averagePct"] = (
                round((entry["totalScore"] / entry["totalQuestions"]) * 100)
                if entry["totalQuestions"] > 0
                else 0
            )
            entry["lastPlayedAt"] = now_iso
            standings_map[uid] = entry

        hist = g.setdefault("quiz_history", [])
        hist.insert(0, {
            "id": room["round"]["id"],
            "title": room["round"]["title"],
            "questionCount": total,
            "durationSec": room["round"]["durationSec"],
            "completedAt": now_iso,
            "participantCount": len(rows),
            "results": rows[:50],
        })
        g["quiz_history"] = hist[:30]
        STORE.save_async()

    if xp_awards_for_supabase:
        threading.Thread(
            target=_award_supabase_xp_background,
            args=(xp_awards_for_supabase,),
            daemon=True,
        ).start()

    return True


async def _auto_end_timer(circle_id: str, round_id: str, ends_at_ms: int):
    try:
        delay_sec = max(0.0, (ends_at_ms - _now_ms()) / 1000.0) + 0.6
        await asyncio.sleep(delay_sec)
        room = LIVE_ROOMS.get(circle_id)
        if room and room["phase"] == "running" and room.get("round", {}).get("id") == round_id:
            if _finalize_round(circle_id):
                await _broadcast_room(circle_id)
    except asyncio.CancelledError:
        pass


async def _auto_start_scheduled_timer(circle_id: str, schedule_id: str, scheduled_start_ms: int):
    """Automatically starts a scheduled class quiz when the exact scheduled timestamp arrives."""
    try:
        delay_sec = max(0.0, (scheduled_start_ms - _now_ms()) / 1000.0)
        if delay_sec > 0:
            await asyncio.sleep(delay_sec)

        room = _get_or_create_room(circle_id)
        g = STORE.get(circle_id)
        sched = room.get("scheduled")
        if room["phase"] == "scheduled" and sched and sched.get("id") == schedule_id:
            secret_key = room.get("secret_key") or (g.get("scheduled_quiz", {}).get("secretKey", []) if g else [])
            _launch_running_round(
                circle_id=circle_id,
                host_id=sched["hostId"],
                host_name=sched["hostName"],
                title=sched["title"],
                public_questions=sched["publicQuestions"],
                secret_key=secret_key,
                duration_sec=sched["durationSec"],
                countdown_ms=3000,
            )
            await _broadcast_room(circle_id)
    except asyncio.CancelledError:
        pass


def ensure_scheduled_timers_started():
    """Ensures all persisted scheduled quizzes have an active asyncio auto-start timer."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return

    for cid, g in STORE.groups.items():
        sq = g.get("scheduled_quiz")
        if not sq:
            continue
        room = _get_or_create_room(cid)
        if room["phase"] == "scheduled" and room.get("scheduled"):
            existing_task = SCHEDULE_TASKS.get(cid)
            if not existing_task or existing_task.done():
                SCHEDULE_TASKS[cid] = loop.create_task(
                    _auto_start_scheduled_timer(cid, sq["id"], int(sq["scheduledStartAt"]))
                )


# ───────────────────────── Request Schemas ─────────────────────────

class CreateGroupRequest(BaseModel):
    name: str
    course_code: str
    institution: Optional[str] = ""
    description: Optional[str] = ""
    user_id: str
    display_name: str
    user_email: Optional[str] = ""


class JoinGroupRequest(BaseModel):
    invite_code: str
    user_id: str
    display_name: str
    user_email: Optional[str] = ""


class UpdateRoleRequest(BaseModel):
    actor_user_id: str
    target_user_id: str
    role: str  # "assistant_admin" | "member" | "remove"


class QuizQuestionInput(BaseModel):
    question: str
    options: List[str]
    correct: int
    explanation: Optional[str] = ""
    sourceRef: Optional[str] = ""


class OpenLobbyRequest(BaseModel):
    user_id: str
    host_name: str
    title: str
    duration_sec: int
    questions: List[QuizQuestionInput]


class ScheduleQuizRequest(BaseModel):
    user_id: str
    host_name: str
    title: str
    duration_sec: int
    scheduled_start_at: int  # Unix epoch milliseconds
    questions: List[QuizQuestionInput]


class HostActionRequest(BaseModel):
    user_id: str


class SubmitAnswerRequest(BaseModel):
    user_id: str
    name: str
    answers: Dict[str, int]
    submitted: bool = False


# ───────────────────────── Study Group Endpoints ─────────────────────────

@router.on_event("startup")
async def _on_hub_startup():
    ensure_scheduled_timers_started()


@router.get("/api/study-groups")
async def list_study_groups(user_id: str = Query(...)):
    ensure_scheduled_timers_started()
    return {"success": True, "groups": STORE.list_for_user(user_id)}


@router.get("/api/study-groups/invite/{invite_code}")
async def preview_group_invite(invite_code: str):
    """Public invite preview so shareable links can show group details before login/signup."""
    ensure_scheduled_timers_started()
    group = STORE.find_by_code(invite_code)
    if not group:
        raise HTTPException(status_code=404, detail="Invalid or expired class invite link.")
    summary = STORE._summary(group)
    room = _get_or_create_room(group["id"])
    quiz_title = None
    if room.get("round"):
        quiz_title = room["round"].get("title")
    elif room.get("scheduled"):
        quiz_title = room["scheduled"].get("title")
    elif room.get("lobby"):
        quiz_title = room["lobby"].get("title")
    return {
        "success": True,
        "invite": {
            "id": summary["id"],
            "name": summary["name"],
            "course_code": summary["course_code"],
            "description": summary["description"],
            "invite_code": summary["invite_code"],
            "member_count": summary["member_count"],
            "max_members": MAX_GROUP_MEMBERS,
            "active_quiz_phase": summary["active_quiz_phase"],
            "scheduled_start_at": summary["scheduled_start_at"],
            "quiz_title": quiz_title,
        },
    }


@router.post("/api/study-groups/create")
async def create_study_group(req: CreateGroupRequest):
    name = req.name.strip()
    code_prefix = "".join(ch for ch in req.course_code.upper() if ch.isalnum())[:10] or "QUIZ"
    if not name:
        raise HTTPException(status_code=400, detail="Group name is required.")

    invite_code = f"{code_prefix}-{random.randint(1000, 9999)}"
    while STORE.find_by_code(invite_code) is not None:
        invite_code = f"{code_prefix}-{random.randint(1000, 9999)}"

    circle_id = f"grp_{uuid.uuid4().hex[:12]}"
    now = _now_iso()
    group = {
        "id": circle_id,
        "name": name,
        "course_code": req.course_code.strip().upper() or code_prefix,
        "institution": (req.institution or "").strip(),
        "description": (req.description or "").strip() or "Live synchronized quiz study group.",
        "invite_code": invite_code,
        "created_by": req.user_id,
        "created_at": now,
        "members": [
            {
                "id": f"mem_{uuid.uuid4().hex[:8]}",
                "circle_id": circle_id,
                "user_id": req.user_id,
                "role": "owner",
                "display_name": req.display_name.strip() or "Group Admin",
                "user_email": req.user_email or "",
                "joined_at": now,
            }
        ],
        "quiz_history": [],
        "group_standings": {},
    }
    STORE.groups[circle_id] = group
    STORE.save()
    return {"success": True, "group": STORE._summary(group), "members": group["members"]}


@router.post("/api/study-groups/join")
async def join_study_group(req: JoinGroupRequest):
    ensure_scheduled_timers_started()
    group = STORE.find_by_code(req.invite_code)
    if not group:
        raise HTTPException(
            status_code=404,
            detail="No study group found with that invite code. Check the code and try again.",
        )

    members = group.setdefault("members", [])
    existing = next((m for m in members if m.get("user_id") == req.user_id), None)
    if existing:
        if req.display_name.strip():
            existing["display_name"] = req.display_name.strip()
        STORE.save_async()
        return {"success": True, "group": STORE._summary(group), "members": members, "already_member": True}

    if len(members) >= MAX_GROUP_MEMBERS:
        raise HTTPException(
            status_code=400,
            detail=f"This study group has reached the maximum capacity of {MAX_GROUP_MEMBERS} students.",
        )

    members.append({
        "id": f"mem_{uuid.uuid4().hex[:8]}",
        "circle_id": group["id"],
        "user_id": req.user_id,
        "role": "member",
        "display_name": req.display_name.strip() or "Member",
        "user_email": req.user_email or "",
        "joined_at": _now_iso(),
    })
    STORE.save_async()

    # If a quiz is actively running right now, register the joining student so they get marked on completion
    room = _get_or_create_room(group["id"])
    if room["phase"] == "running" and req.user_id not in room["submissions"]:
        room["submissions"][req.user_id] = {
            "name": req.display_name.strip() or "Member",
            "answers": {},
            "submitted": False,
            "submitted_at": None,
        }

    await _broadcast_room(group["id"])
    return {"success": True, "group": STORE._summary(group), "members": members}


@router.get("/api/study-groups/{circle_id}")
async def get_study_group_detail(circle_id: str, user_id: str = Query("")):
    ensure_scheduled_timers_started()
    group = STORE.get(circle_id)
    if not group:
        raise HTTPException(status_code=404, detail="Study group not found.")
    return {
        "success": True,
        "group": STORE._summary(group),
        "members": group.get("members", []),
        "standings": _compute_sorted_standings(group)[:100],
        "quiz_state": _build_client_state(circle_id, viewer_id=user_id),
    }


@router.post("/api/study-groups/{circle_id}/role")
async def update_member_role(circle_id: str, req: UpdateRoleRequest):
    group = STORE.get(circle_id)
    if not group:
        raise HTTPException(status_code=404, detail="Study group not found.")
    if group.get("created_by") != req.actor_user_id:
        raise HTTPException(status_code=403, detail="Only the group creator can manage assistant admins.")
    if req.target_user_id == group.get("created_by"):
        raise HTTPException(status_code=400, detail="Cannot change the group creator's role.")

    members = group.get("members", [])
    target = next((m for m in members if m.get("user_id") == req.target_user_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Member not found.")

    if req.role == "remove":
        group["members"] = [m for m in members if m.get("user_id") != req.target_user_id]
    elif req.role == "assistant_admin":
        current_assistants = [
            m for m in members
            if m.get("role") == "assistant_admin" and m.get("user_id") != req.target_user_id
        ]
        if len(current_assistants) >= 2:
            raise HTTPException(status_code=400, detail="A study group can have at most 2 assistant admins.")
        target["role"] = "assistant_admin"
    elif req.role == "member":
        target["role"] = "member"
    else:
        raise HTTPException(status_code=400, detail="Invalid role action.")

    STORE.save()
    await _broadcast_room(circle_id)
    return {"success": True, "members": group["members"]}


@router.delete("/api/study-groups/{circle_id}")
async def delete_study_group(circle_id: str, user_id: str = Query(...)):
    group = STORE.get(circle_id)
    if not group:
        raise HTTPException(status_code=404, detail="Study group not found.")
    if group.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Only the group creator can delete this study group.")

    for task_map in (TIMER_TASKS, SCHEDULE_TASKS, DEBOUNCE_TASKS):
        t = task_map.pop(circle_id, None)
        if t and not t.done():
            t.cancel()
    LIVE_ROOMS.pop(circle_id, None)
    STORE.groups.pop(circle_id, None)
    STORE.save()
    return {"success": True, "deleted": circle_id}


# ───────────────────────── Live & Scheduled Quiz Endpoints ─────────────────────────

def _require_admin(circle_id: str, user_id: str):
    if not STORE.get(circle_id):
        raise HTTPException(status_code=404, detail="Study group not found.")
    if not STORE.is_admin(circle_id, user_id):
        raise HTTPException(status_code=403, detail="Only the group admin or an assistant admin can control live quizzes.")


@router.get("/api/live-quiz/{circle_id}/state")
async def get_live_quiz_state(circle_id: str, user_id: str = Query("")):
    ensure_scheduled_timers_started()
    if not STORE.get(circle_id):
        raise HTTPException(status_code=404, detail="Study group not found.")
    room = _get_or_create_room(circle_id)
    now_ms = _now_ms()
    if room["phase"] == "scheduled" and room.get("scheduled") and now_ms >= int(room["scheduled"]["scheduledStartAt"]):
        sched = room["scheduled"]
        _launch_running_round(
            circle_id=circle_id,
            host_id=sched["hostId"],
            host_name=sched["hostName"],
            title=sched["title"],
            public_questions=sched["publicQuestions"],
            secret_key=room["secret_key"],
            duration_sec=sched["durationSec"],
            countdown_ms=2000,
        )
        await _broadcast_room(circle_id)
    elif room["phase"] == "running" and room.get("round") and now_ms > room["round"]["endsAt"] + 1000:
        if _finalize_round(circle_id):
            await _broadcast_room(circle_id)
    return {"success": True, "state": _build_client_state(circle_id, viewer_id=user_id)}


@router.post("/api/live-quiz/{circle_id}/lobby")
async def open_live_quiz_lobby(circle_id: str, req: OpenLobbyRequest):
    _require_admin(circle_id, req.user_id)
    if not req.questions or len(req.questions) < 1:
        raise HTTPException(status_code=400, detail="At least 1 question is required to open a quiz lobby.")
    if len(req.questions) > MAX_QUIZ_QUESTIONS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_QUIZ_QUESTIONS} questions allowed per slide quiz.")

    duration_sec = max(30, min(180 * 60, int(req.duration_sec)))
    for task_map in (TIMER_TASKS, SCHEDULE_TASKS):
        t = task_map.pop(circle_id, None)
        if t and not t.done():
            t.cancel()

    public_qs = [
        {"question": q.question, "options": q.options, "sourceRef": q.sourceRef or ""}
        for q in req.questions
    ]
    secret_key = [
        {"correct": int(q.correct), "explanation": q.explanation or "", "sourceRef": q.sourceRef or ""}
        for q in req.questions
    ]

    room = _get_or_create_room(circle_id)
    room["phase"] = "lobby"
    room["lobby"] = {
        "hostId": req.user_id,
        "hostName": req.host_name.strip() or "Admin",
        "title": req.title.strip() or "Live Session Quiz",
        "count": len(public_qs),
        "durationSec": duration_sec,
        "publicQuestions": public_qs,
    }
    room["scheduled"] = None
    room["round"] = None
    room["secret_key"] = secret_key
    room["submissions"] = {}
    room["results"] = None

    g = STORE.get(circle_id)
    if g and "scheduled_quiz" in g:
        g.pop("scheduled_quiz", None)
        STORE.save_async()

    await _broadcast_room(circle_id)
    return {"success": True, "state": _build_client_state(circle_id, viewer_id=req.user_id)}


@router.post("/api/live-quiz/{circle_id}/schedule")
async def schedule_live_quiz(circle_id: str, req: ScheduleQuizRequest):
    """Schedules a class quiz for a future timestamp; automatically starts when the scheduled time arrives."""
    _require_admin(circle_id, req.user_id)
    if not req.questions or len(req.questions) < 1:
        raise HTTPException(status_code=400, detail="At least 1 question is required to schedule a quiz.")
    if len(req.questions) > MAX_QUIZ_QUESTIONS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_QUIZ_QUESTIONS} questions allowed per slide quiz.")

    now_ms = _now_ms()
    scheduled_ms = int(req.scheduled_start_at)
    if scheduled_ms < now_ms + 5000:
        raise HTTPException(status_code=400, detail="Scheduled start time must be in the future.")

    duration_sec = max(30, min(180 * 60, int(req.duration_sec)))
    for task_map in (TIMER_TASKS, SCHEDULE_TASKS):
        t = task_map.pop(circle_id, None)
        if t and not t.done():
            t.cancel()

    public_qs = [
        {"question": q.question, "options": q.options, "sourceRef": q.sourceRef or ""}
        for q in req.questions
    ]
    secret_key = [
        {"correct": int(q.correct), "explanation": q.explanation or "", "sourceRef": q.sourceRef or ""}
        for q in req.questions
    ]
    sched_id = f"sch_{uuid.uuid4().hex[:10]}"
    host_name = req.host_name.strip() or "Admin"
    title = req.title.strip() or "Scheduled Class Quiz"

    room = _get_or_create_room(circle_id)
    room["phase"] = "scheduled"
    room["lobby"] = None
    room["round"] = None
    room["results"] = None
    room["submissions"] = {}
    room["secret_key"] = secret_key
    room["scheduled"] = {
        "id": sched_id,
        "hostId": req.user_id,
        "hostName": host_name,
        "title": title,
        "count": len(public_qs),
        "durationSec": duration_sec,
        "scheduledStartAt": scheduled_ms,
        "publicQuestions": public_qs,
    }

    g = STORE.get(circle_id)
    if g is not None:
        g["scheduled_quiz"] = {
            "id": sched_id,
            "hostId": req.user_id,
            "hostName": host_name,
            "title": title,
            "durationSec": duration_sec,
            "scheduledStartAt": scheduled_ms,
            "publicQuestions": public_qs,
            "secretKey": secret_key,
        }
        STORE.save()

    SCHEDULE_TASKS[circle_id] = asyncio.create_task(
        _auto_start_scheduled_timer(circle_id, sched_id, scheduled_ms)
    )

    await _broadcast_room(circle_id)
    return {"success": True, "state": _build_client_state(circle_id, viewer_id=req.user_id)}


@router.post("/api/live-quiz/{circle_id}/start")
async def start_live_quiz(circle_id: str, req: HostActionRequest):
    _require_admin(circle_id, req.user_id)
    room = _get_or_create_room(circle_id)

    if room["phase"] == "lobby" and room.get("lobby"):
        src = room["lobby"]
    elif room["phase"] == "scheduled" and room.get("scheduled"):
        src = room["scheduled"]
    else:
        raise HTTPException(status_code=400, detail="Open a quiz lobby or schedule a quiz before starting.")

    _launch_running_round(
        circle_id=circle_id,
        host_id=src["hostId"],
        host_name=src["hostName"],
        title=src["title"],
        public_questions=src["publicQuestions"],
        secret_key=room["secret_key"],
        duration_sec=src["durationSec"],
        countdown_ms=5000,
    )

    await _broadcast_room(circle_id)
    return {"success": True, "state": _build_client_state(circle_id, viewer_id=req.user_id)}


@router.post("/api/live-quiz/{circle_id}/answer")
async def submit_live_quiz_answer(circle_id: str, req: SubmitAnswerRequest):
    if not STORE.get(circle_id):
        raise HTTPException(status_code=404, detail="Study group not found.")
    room = _get_or_create_room(circle_id)
    if room["phase"] != "running" or not room.get("round"):
        raise HTTPException(status_code=400, detail="No active quiz is currently running.")

    now_ms = _now_ms()
    if now_ms > room["round"]["endsAt"] + 2500:
        _finalize_round(circle_id)
        await _broadcast_room(circle_id)
        return {"success": True, "state": _build_client_state(circle_id, viewer_id=req.user_id)}

    prev = room["submissions"].get(req.user_id)
    already_submitted = bool(prev and prev.get("submitted"))
    if not already_submitted:
        clean_answers = {str(k): int(v) for k, v in (req.answers or {}).items()}
        is_submitting = bool(req.submitted)
        room["submissions"][req.user_id] = {
            "name": req.name.strip() or (prev.get("name") if prev else "Participant"),
            "answers": clean_answers,
            "submitted": is_submitting,
            "submitted_at": now_ms if is_submitting else (prev.get("submitted_at") if prev else None),
        }

    # Include ALL online participants (including the host, since the host also takes the quiz!)
    online_ids = {m["user_id"] for m in _online_members(circle_id)}
    active_ids = online_ids | set(room["submissions"].keys())
    round_finished = False
    if len(active_ids) >= 2 and all(room["submissions"].get(uid, {}).get("submitted") for uid in active_ids):
        round_finished = _finalize_round(circle_id)

    if round_finished or req.submitted:
        await _broadcast_room(circle_id)
    else:
        _schedule_debounced_broadcast(circle_id, delay_sec=0.12)

    return {"success": True, "state": _build_client_state(circle_id, viewer_id=req.user_id)}


@router.post("/api/live-quiz/{circle_id}/end")
async def end_live_quiz_now(circle_id: str, req: HostActionRequest):
    _require_admin(circle_id, req.user_id)
    _finalize_round(circle_id)
    await _broadcast_room(circle_id)
    return {"success": True, "state": _build_client_state(circle_id, viewer_id=req.user_id)}


@router.post("/api/live-quiz/{circle_id}/reset")
async def reset_live_quiz(circle_id: str, req: HostActionRequest):
    _require_admin(circle_id, req.user_id)
    for task_map in (TIMER_TASKS, SCHEDULE_TASKS):
        t = task_map.pop(circle_id, None)
        if t and not t.done():
            t.cancel()
    room = _get_or_create_room(circle_id)
    room["phase"] = "idle"
    room["lobby"] = None
    room["scheduled"] = None
    room["round"] = None
    room["secret_key"] = []
    room["submissions"] = {}
    room["results"] = None

    g = STORE.get(circle_id)
    if g and "scheduled_quiz" in g:
        g.pop("scheduled_quiz", None)
        STORE.save_async()

    await _broadcast_room(circle_id)
    return {"success": True, "state": _build_client_state(circle_id, viewer_id=req.user_id)}


# ───────────────────────── Real-Time WebSocket ─────────────────────────

@router.websocket("/ws/live-quiz/{circle_id}")
async def live_quiz_websocket(
    websocket: WebSocket,
    circle_id: str,
    user_id: str = Query(...),
    name: str = Query("Participant"),
):
    await websocket.accept()
    ensure_scheduled_timers_started()
    circle_conns = WS_CONNECTIONS.setdefault(circle_id, {})
    user_entries = circle_conns.setdefault(user_id, [])
    entry = {"ws": websocket, "name": name}
    user_entries.append(entry)

    # Register late-joining connected students in active running round so time-expiry auto-marks them too
    room = _get_or_create_room(circle_id)
    if room["phase"] == "running" and user_id not in room["submissions"]:
        room["submissions"][user_id] = {
            "name": name or "Participant",
            "answers": {},
            "submitted": False,
            "submitted_at": None,
        }

    await _broadcast_room(circle_id)

    try:
        while True:
            msg = await websocket.receive_text()
            try:
                data = json.loads(msg)
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong", "serverNow": _now_ms()})
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        lst = circle_conns.get(user_id, [])
        if entry in lst:
            lst.remove(entry)
        if not lst:
            circle_conns.pop(user_id, None)
        _schedule_debounced_broadcast(circle_id, delay_sec=0.15)
