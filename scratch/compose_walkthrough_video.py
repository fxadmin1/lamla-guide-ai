"""
LAMLA Guide AI - Master Video Compositor & Producer
Creates a professional, high-definition 1080p (1920x1080) walkthrough video
with studio English narration, synchronized subtitles, UI callouts, and clean transitions.
"""
import os
import sys
import time
import glob
import wave
import shutil
import subprocess

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Paths
BASE_DIR = Path(r"C:\Users\dell\.gemini\antigravity\scratch\lamla-guide-web")
SCRATCH_DIR = BASE_DIR / "scratch"
FRAMES_DIR = SCRATCH_DIR / "video_frames"
AUDIO_DIR = SCRATCH_DIR / "audio"
CLIPS_DIR = SCRATCH_DIR / "video_clips"
CLIPS_DIR.mkdir(parents=True, exist_ok=True)
SLIDES_DIR = SCRATCH_DIR / "master_slides"
SLIDES_DIR.mkdir(parents=True, exist_ok=True)

ARTIFACT_DIR = Path(r"C:\Users\dell\.gemini\antigravity\brain\5a00c07e-8495-4602-91d7-f4451c9b870e")
PUBLIC_DIR = BASE_DIR / "public"

FINAL_VIDEO = BASE_DIR / "public" / "lamla_guide_ai_walkthrough_1080p.mp4"
ARTIFACT_VIDEO = ARTIFACT_DIR / "lamla_guide_ai_walkthrough_1080p.mp4"

# FFmpeg
import imageio_ffmpeg
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# Font helper
def get_font(size: int, bold: bool = False):
    font_path = "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"
    if not os.path.exists(font_path):
        font_path = "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"
    try:
        return ImageFont.truetype(font_path, size)
    except Exception:
        return ImageFont.load_default()

FONT_TITLE = get_font(38, bold=True)
FONT_HEADING = get_font(30, bold=True)
FONT_SUBTITLE = get_font(22, bold=False)
FONT_BADGE = get_font(18, bold=True)
FONT_BULLET = get_font(21, bold=False)
FONT_TRANSCRIPT = get_font(20, bold=False)
FONT_TRANSCRIPT_BOLD = get_font(21, bold=True)
FONT_SMALL = get_font(16, bold=False)

SCENES = [
    {
        "id": "scene_01",
        "chapter": "01",
        "title": "Welcome to LAMLA Guide AI",
        "category": "PLATFORM OVERVIEW & MISSION",
        "badge": "Next-Gen AI Learning",
        "badge_color": (37, 99, 235),
        "bullets": [
            "Tailored for Senior High School, University & Independent Learners",
            "Unified ecosystem: slide parsing, AI tutor, live class quizzes & planner",
            "Foundational Principle: 'It\\'s Never Too Late To Study.'",
            "Zero Cloud Storage Waste: Scalable stream processing for millions of students"
        ],
        "image_type": "title_card",
        "image_file": str(FRAMES_DIR / "scene_01_landing.png"),
        "audio_file": str(AUDIO_DIR / "scene_01.wav"),
        "transcript": "Welcome to LAMLA Guide AI, the intelligent, all-in-one educational platform engineered for Senior High School, University students, and independent learners. In this comprehensive walkthrough, we will explore every part of the platform, show what each section does, and demonstrate how LAMLA Guide AI empowers your daily learning."
    },
    {
        "id": "scene_02",
        "chapter": "02",
        "title": "Modern, Distraction-Free Landing Experience",
        "category": "CLEAN UI/UX & NAVIGATION",
        "badge": "Predominantly White Design",
        "badge_color": (16, 185, 129),
        "bullets": [
            "Clean, spacious layout with subtle blue accents and zero visual clutter",
            "One-click navigation to Dashboard, Practice, Live Class, Planner & Flashcards",
            "Consistent typography and natural spacing designed by experienced UI/UX standards",
            "Fully responsive across smartphones, tablets, and widescreen desktop monitors"
        ],
        "image_type": "browser_shot",
        "image_file": str(FRAMES_DIR / "scene_01_landing.png"),
        "audio_file": str(AUDIO_DIR / "scene_02.wav"),
        "transcript": "The home page provides a clean, modern, and predominantly white design with subtle blue accents and zero visual clutter. The top navigation bar gives students instant access to the personal dashboard, practice quizzes, live class circles, flashcards, and the study planner, ensuring effortless navigation on both desktop and mobile devices."
    },
    {
        "id": "scene_03",
        "chapter": "03",
        "title": "The 4-Step Academic Mastery Workflow",
        "category": "HOW IT WORKS & METHODOLOGY",
        "badge": "Proven Pedagogy",
        "badge_color": (79, 70, 229),
        "bullets": [
            "Step 1: Upload multi-format lecture slides, notes & PDFs with zero storage waste",
            "Step 2: Instant multimodal indexing extracts key concepts, formulas & definitions",
            "Step 3: Conversational Socratic inquiry guides deep understanding",
            "Step 4: Timed exams & automated weakness targeting solidify long-term retention"
        ],
        "image_type": "browser_shot",
        "image_file": str(FRAMES_DIR / "scene_02_how_it_works.png"),
        "audio_file": str(AUDIO_DIR / "scene_03.wav"),
        "transcript": "The How It Works section details our core pedagogical methodology. In just three simple steps, students upload their lecture materials, receive comprehensive multi-slide analysis, interact with a conversational Socratic AI tutor, and practice with automated exam-style assessments."
    },
    {
        "id": "scene_04",
        "chapter": "04",
        "title": "Student Registration & Notification Onboarding",
        "category": "AUTHENTICATION & ONBOARDING",
        "badge": "Anti-Brute-Force Protected",
        "badge_color": (217, 119, 6),
        "bullets": [
            "Seamless institution selection across Ghanaian & global universities/SHS",
            "Automatic study notification request upon signup to schedule revision alerts",
            "Protected by rate limiting: Max 20 auth attempts/min prevents brute force",
            "OWASP compliant password hashing and secure session credentials"
        ],
        "image_type": "browser_shot",
        "image_file": str(FRAMES_DIR / "scene_04_signup.png"),
        "audio_file": str(AUDIO_DIR / "scene_04.wav"),
        "transcript": "Student registration is streamlined and secure. When creating an account, learners choose their institution and study level. Right after signing up, the platform prompts the student to enable notifications, ensuring they never miss upcoming study sessions, spaced revision alerts, or live class quizzes."
    },
    {
        "id": "scene_05",
        "chapter": "05",
        "title": "Personal Study Dashboard & Focus Tracker",
        "category": "STUDENT DASHBOARD & TIME TRACKING",
        "badge": "Foreground Focus Only",
        "badge_color": (16, 185, 129),
        "bullets": [
            "Real-time central cockpit tracking total study time and mastery progress",
            "Foreground-only focus tracker: Counts time exclusively while actively on the tab",
            "Automatic pausing on tab switch or browser exit eliminates fake study hours",
            "Decoupled memoized badge architecture ensures zero UI lag during active ticks"
        ],
        "image_type": "split_card",
        "image_file": str(ARTIFACT_DIR / "04_Personal_Study_Dashboard_status.png"),
        "audio_file": str(AUDIO_DIR / "scene_05.wav"),
        "transcript": "The personal dashboard is the student's central learning cockpit. At the top right, notice the foreground study timer. Unlike ordinary apps that allow passive background timing, our focus tracker measures your genuine revision exclusively while you are actively on the platform, automatically pausing when you switch away."
    },
    {
        "id": "scene_06",
        "chapter": "06",
        "title": "Smart Slide Ingestion with Zero Storage Waste",
        "category": "DOCUMENT PROCESSING ENGINE",
        "badge": "Zero Cloud Storage Waste",
        "badge_color": (37, 99, 235),
        "bullets": [
            "Universal support: PowerPoint (.pptx), PDF documents, Word (.docx) & images",
            "Streaming in-memory extraction enables millions of students with 0 storage cost",
            "Slide-by-slide concept breakdown, glossary generation & key term extraction",
            "Strict 60 MB file upload limit with extension whitelisting and path safety"
        ],
        "image_type": "split_card",
        "image_file": str(ARTIFACT_DIR / "feat_01_slide_ingestion_portrait.png"),
        "audio_file": str(AUDIO_DIR / "scene_06.wav"),
        "transcript": "Uploading your lecture slides is instant and cost-effective. Supporting PowerPoint, PDF, Word documents, and textbook photos, our zero-storage ingestion engine streams and indexes content on the fly, allowing millions of students to upload massive lecture decks without wasting server storage."
    },
    {
        "id": "scene_07",
        "chapter": "07",
        "title": "Unrestricted Socratic AI Tutor & SVG Drawing",
        "category": "CONVERSATIONAL SOCRATIC TUTOR",
        "badge": "Dynamic Vector SVG Drawing",
        "badge_color": (147, 51, 234),
        "bullets": [
            "Open-domain academic intelligence answers syllabus questions beyond slides",
            "Socratic teaching method guides students step-by-step to arrive at answers",
            "Draw & Visualize: Generates interactive, labeled vector SVG diagrams in real-time",
            "Contextual web enrichment learns background details for crystal-clear explanations"
        ],
        "image_type": "split_card",
        "image_file": str(ARTIFACT_DIR / "05_AI_Tutor_and_SVG_Concept_Drawing_status.png"),
        "audio_file": str(AUDIO_DIR / "scene_07.wav"),
        "transcript": "Meet your personal AI Tutor. Unlike basic chatbots restricted only to slide text, our tutor is backed by open-domain academic knowledge and web enrichment. When students ask to visualize or draw a concept, the AI generates fully labeled, interactive vector SVG diagrams directly inside the chat interface."
    },
    {
        "id": "scene_08",
        "chapter": "08",
        "title": "Zero-Repeat Practice Quizzes & Exam Mastery",
        "category": "EXAM PREPARATION & RECALL",
        "badge": "Up to 50 Qs / Slide",
        "badge_color": (225, 29, 72),
        "bullets": [
            "Generate up to 50 questions per slide with guaranteed zero duplicate questions",
            "Comprehensive coverage ensures questions are pulled from every single slide page",
            "Independent evaluation on submission with step-by-step reasoning & answers",
            "Schema cache safe: Fixed misconception column bug for bulletproof reliability"
        ],
        "image_type": "split_card",
        "image_file": str(ARTIFACT_DIR / "06_Timed_Practice_Quizzes_status.png"),
        "audio_file": str(AUDIO_DIR / "scene_08.wav"),
        "transcript": "The practice quiz section enables students to generate up to fifty questions per slide, with guaranteed zero repeated questions across tests. When time expires or when you submit, each question is evaluated independently with step-by-step reasoning and misconception alerts."
    },
    {
        "id": "scene_09",
        "chapter": "09",
        "title": "Live Class Circles & Real-Time Multiplayer Quizzes",
        "category": "COLLABORATIVE CLASSROOM LEARNING",
        "badge": "WebSocket Synchronized",
        "badge_color": (37, 99, 235),
        "bullets": [
            "Multiplayer quiz rooms powered by high-concurrency Python WebSockets",
            "Synchronized question timer: All students answer simultaneously in lockstep",
            "Independent scoring reveals personalized results and common class mistakes",
            "Dynamic podium standings directly influence the group and global leaderboard"
        ],
        "image_type": "split_card",
        "image_file": str(ARTIFACT_DIR / "07_Live_Class_Circles_and_Synced_Quizzes_status.png"),
        "audio_file": str(AUDIO_DIR / "scene_09.wav"),
        "transcript": "For collaborative learning, Live Class Circles connect entire classrooms in real time over WebSockets. Study groups compete in synchronized multiplayer quizzes where everyone receives questions simultaneously, timers count down together, and live scores update the circle leaderboard."
    },
    {
        "id": "scene_10",
        "chapter": "10",
        "title": "Scheduled Live Quizzes & Instant Class Invites",
        "category": "SCHEDULED LIVE COMPETITIONS",
        "badge": "Live Countdown Clock",
        "badge_color": (16, 185, 129),
        "bullets": [
            "Host scheduling: Set exam title, question count, and exact start time in advance",
            "Public invite preview: Non-members can view class details and register with one tap",
            "Synchronized countdown ticker launches the quiz the moment the clock strikes",
            "Full group lifecycle: Leaders can delete or manage circles with zero orphaned state"
        ],
        "image_type": "split_card",
        "image_file": str(ARTIFACT_DIR / "feat_06_scheduled_quizzes_portrait.png"),
        "audio_file": str(AUDIO_DIR / "scene_10.wav"),
        "transcript": "Group leaders can schedule quizzes in advance with an exact launch date and time. Sharing a class invite link allows fellow classmates to preview the circle and join with one click. When the scheduled start time arrives, the live quiz launches automatically for all connected students."
    },
    {
        "id": "scene_11",
        "chapter": "11",
        "title": "Study Routines & Comprehensive Exam Analytics",
        "category": "ANALYTICS & EXAM READINESS",
        "badge": "Actionable Insights",
        "badge_color": (79, 70, 229),
        "bullets": [
            "Visual tracking of genuine focused study hours across days, weeks, and months",
            "Readiness scoring identifies weak topics before actual exams take place",
            "Spaced repetition revision prompts ensure continuous long-term retention",
            "Tailored study routines optimize daily revision blocks without student burnout"
        ],
        "image_type": "split_card",
        "image_file": str(ARTIFACT_DIR / "08_Study_Routines_and_Focus_Tracker_status.png"),
        "audio_file": str(AUDIO_DIR / "scene_11.wav"),
        "transcript": "The study analytics section provides deep insights into mastery progress, subject strengths, and exam readiness. Students can track total focused hours, review confidence scores, and establish structured daily study routines tailored to their academic goals."
    },
    {
        "id": "scene_12",
        "chapter": "12",
        "title": "Progressive Web App (PWA) Mobile Installation",
        "category": "MOBILE INSTALLATION & OFFLINE",
        "badge": "Add to Home Screen",
        "badge_color": (14, 165, 233),
        "bullets": [
            "One-tap 'Add to Home Screen' installation on iPhone (Safari), Android & PC",
            "Modern service worker caches core assets for instant loading and offline review",
            "Eliminates 100MB+ app store downloads: Feather-light, instant updates",
            "Full responsive mobile navigation bar with smooth touch interactions"
        ],
        "image_type": "split_card",
        "image_file": str(ARTIFACT_DIR / "10_Progressive_Web_App_Mobile_Install_status.png"),
        "audio_file": str(AUDIO_DIR / "scene_12.wav"),
        "transcript": "LAMLA Guide AI is a full Progressive Web App. With a single tap, students can install it to their iPhone, Android, or PC home screen. It operates smoothly, caches offline resources with modern service workers, and provides an effortless native mobile experience."
    },
    {
        "id": "scene_13",
        "chapter": "13",
        "title": "Enterprise-Grade Security & Ready for Cloud",
        "category": "SECURITY, PERFORMANCE & SUMMARY",
        "badge": "OWASP Top 10 Secured",
        "badge_color": (16, 185, 129),
        "bullets": [
            "OWASP Top 10 Hardened: CSP, HSTS, frame-ancestors, cloaked server headers",
            "Anti-DDoS Sliding Window Rate Limiting & Stored XSS Script Stripping",
            "Eliminated client re-render bottlenecks: Smooth 60fps high-concurrency UI",
            "It\\'s Never Too Late To Study. Start learning with LAMLA Guide AI today!"
        ],
        "image_type": "browser_shot",
        "image_file": str(FRAMES_DIR / "scene_03_features.png"),
        "audio_file": str(AUDIO_DIR / "scene_13.wav"),
        "transcript": "Protected by enterprise-grade OWASP security, rate limiting, and zero-lag performance optimizations, LAMLA Guide AI is completely ready for students and schools worldwide. Visit our website today to start learning smarter. Because at LAMLA Guide AI, It's Never Too Late To Study."
    }
]

def draw_rounded_rect(draw, bbox, radius, fill, outline=None, width=1):
    x0, y0, x1, y1 = bbox
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def wrap_text(text: str, max_chars: int = 70) -> list[str]:
    words = text.split()
    lines = []
    cur = []
    cur_len = 0
    for w in words:
        if cur_len + len(w) + 1 > max_chars:
            lines.append(" ".join(cur))
            cur = [w]
            cur_len = len(w)
        else:
            cur.append(w)
            cur_len += len(w) + 1
    if cur:
        lines.append(" ".join(cur))
    return lines

def create_slide(scene: dict) -> Path:
    W, H = 1920, 1080
    im = Image.new("RGB", (W, H), (248, 250, 252))
    draw = ImageDraw.Draw(im)

    # Subtle modern background gradient effect
    for y in range(H):
        ratio = y / H
        r = int(248 - ratio * 8)
        g = int(250 - ratio * 6)
        b = int(252 - ratio * 4)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Top Header Bar (Height: 80px)
    draw.rectangle([0, 0, W, 80], fill=(255, 255, 255))
    draw.line([(0, 80), (W, 80)], fill=(226, 232, 240), width=1)

    # Logo & Brand
    draw_rounded_rect(draw, (40, 16, 88, 64), radius=12, fill=(37, 99, 235))
    draw.text((54, 24), "L", fill=(255, 255, 255), font=FONT_TITLE)
    draw.text((104, 20), "LAMLA GUIDE AI", fill=(15, 23, 42), font=FONT_HEADING)
    draw.text((104, 52), "It's Never Too Late To Study", fill=(100, 116, 139), font=FONT_SMALL)

    # Center Chapter Pill
    chap_text = f"CHAPTER {scene['chapter']} • {scene['category']}"
    tb = draw.textbbox((0, 0), chap_text, font=FONT_BADGE)
    tw = tb[2] - tb[0]
    cx = W // 2
    draw_rounded_rect(draw, (cx - tw//2 - 20, 22, cx + tw//2 + 20, 58), radius=18, fill=(241, 245, 249), outline=(203, 213, 225), width=1)
    draw.text((cx - tw//2, 28), chap_text, fill=(51, 65, 85), font=FONT_BADGE)

    # Right Badge
    badge_color = scene["badge_color"]
    badge_text = scene["badge"]
    tb2 = draw.textbbox((0, 0), badge_text, font=FONT_BADGE)
    bw = tb2[2] - tb2[0]
    rx = W - 40 - bw - 32
    draw_rounded_rect(draw, (rx, 22, W - 40, 58), radius=18, fill=badge_color)
    draw.text((rx + 16, 28), badge_text, fill=(255, 255, 255), font=FONT_BADGE)

    # Lower-third Narration Subtitle Banner (Height: 140px, y: 920 to 1060)
    draw_rounded_rect(draw, (40, 920, W - 40, 1060), radius=16, fill=(15, 23, 42))
    draw_rounded_rect(draw, (60, 936, 170, 968), radius=8, fill=(37, 99, 235))
    draw.text((72, 940), f"SCENE {scene['chapter']}", fill=(255, 255, 255), font=FONT_SMALL)

    # Subtitle Text (2 wrapped lines)
    sub_lines = wrap_text(scene["transcript"], max_chars=118)[:2]
    sy = 976
    for sl in sub_lines:
        draw.text((64, sy), sl, fill=(241, 245, 249), font=FONT_TRANSCRIPT)
        sy += 30

    # Middle Content Stage (y: 100 to 900)
    image_type = scene["image_type"]
    img_path = scene["image_file"]

    if image_type == "browser_shot" and os.path.exists(img_path):
        # Full-width browser window mockup
        bx, by, bw_frame, bh_frame = 60, 105, 1800, 795
        # Drop shadow simulation
        draw_rounded_rect(draw, (bx+4, by+6, bx+bw_frame+4, by+bh_frame+6), radius=16, fill=(226, 232, 240))
        # Window frame
        draw_rounded_rect(draw, (bx, by, bx+bw_frame, by+bh_frame), radius=16, fill=(255, 255, 255), outline=(203, 213, 225), width=1)
        # Browser top bar
        draw_rounded_rect(draw, (bx, by, bx+bw_frame, by+44), radius=16, fill=(248, 250, 252))
        draw.rectangle([bx, by+30, bx+bw_frame, by+44], fill=(248, 250, 252))
        draw.line([(bx, by+44), (bx+bw_frame, by+44)], fill=(226, 232, 240), width=1)
        # Dots
        draw.ellipse([bx+16, by+16, bx+28, by+28], fill=(239, 68, 68))
        draw.ellipse([bx+36, by+16, bx+48, by+28], fill=(245, 158, 11))
        draw.ellipse([bx+56, by+16, bx+68, by+28], fill=(16, 185, 129))
        # Address bar
        draw_rounded_rect(draw, (bx+90, by+10, bx+bw_frame-200, by+34), radius=6, fill=(255, 255, 255), outline=(226, 232, 240))
        draw.text((bx+104, by+14), f"https://lamlaguide.ai/{scene['id'].replace('scene_0', '')}", fill=(100, 116, 139), font=FONT_SMALL)

        # Content image
        try:
            content_img = Image.open(img_path).convert("RGB")
            # Scale to fit inner window
            target_w = bw_frame - 2
            target_h = bh_frame - 46
            scaled = content_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
            im.paste(scaled, (bx+1, by+45))
        except Exception as e:
            print(f"Error loading {img_path}: {e}")

    elif image_type == "split_card" and os.path.exists(img_path):
        # Left side: Mobile device mockup frame
        mx, my, mw, mh = 80, 105, 460, 795
        # Frame shadow
        draw_rounded_rect(draw, (mx+6, my+8, mx+mw+6, my+mh+8), radius=28, fill=(226, 232, 240))
        # Phone body
        draw_rounded_rect(draw, (mx, my, mx+mw, my+mh), radius=28, fill=(15, 23, 42))
        # Screen area
        sx, sy, sw, sh = mx+8, my+8, mw-16, mh-16
        try:
            card_img = Image.open(img_path).convert("RGB")
            scaled_card = card_img.resize((sw, sh), Image.Resampling.LANCZOS)
            im.paste(scaled_card, (sx, sy))
        except Exception as e:
            print(f"Error loading {img_path}: {e}")

        # Right side: Rich Feature Detail Card (Width: 1240px)
        rx, ry, rw, rh = 580, 105, 1260, 795
        draw_rounded_rect(draw, (rx+4, ry+6, rx+rw+4, ry+rh+6), radius=20, fill=(226, 232, 240))
        draw_rounded_rect(draw, (rx, ry, rx+rw, ry+rh), radius=20, fill=(255, 255, 255), outline=(226, 232, 240), width=1)

        # Card Title
        draw.text((rx+48, ry+44), scene["title"], fill=(15, 23, 42), font=FONT_TITLE)
        draw.text((rx+48, ry+92), f"System Architecture & Functionality Overview • Chapter {scene['chapter']}", fill=(100, 116, 139), font=FONT_SUBTITLE)
        draw.line([(rx+48, ry+135), (rx+rw-48, ry+135)], fill=(241, 245, 249), width=2)

        # 4 Core Highlights
        by_pos = ry + 160
        for b in scene["bullets"]:
            # Blue check icon badge
            draw_rounded_rect(draw, (rx+48, by_pos+2, rx+76, by_pos+30), radius=14, fill=(239, 246, 255), outline=(191, 219, 254), width=1)
            draw.text((rx+56, by_pos+4), "✓", fill=(37, 99, 235), font=FONT_BADGE)
            # Bullet text
            draw.text((rx+92, by_pos+3), b, fill=(30, 41, 59), font=FONT_BULLET)
            by_pos += 68

        # Lower Box: Operational Mechanism Summary
        box_y = ry + 460
        draw_rounded_rect(draw, (rx+48, box_y, rx+rw-48, ry+rh-48), radius=16, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
        draw.text((rx+72, box_y+24), "WHY THIS MATTERS FOR STUDENTS", fill=(15, 23, 42), font=FONT_HEADING)
        
        # Summary description text
        summary_text = (
            f"LAMLA Guide AI is engineered specifically to eliminate common friction points in education. "
            f"By delivering {scene['badge'].lower()}, students experience reliable, fast, and structured revision "
            f"without server slowdowns, fake metrics, or information overload."
        )
        sum_lines = wrap_text(summary_text, max_chars=78)
        s_text_y = box_y + 70
        for sl in sum_lines:
            draw.text((rx+72, s_text_y), sl, fill=(71, 85, 105), font=FONT_SUBTITLE)
            s_text_y += 34

    else:
        # Title Card (Scene 1)
        cx, cy, cw, ch = 100, 120, 1720, 760
        draw_rounded_rect(draw, (cx+6, cy+8, cx+cw+6, cy+ch+8), radius=24, fill=(226, 232, 240))
        draw_rounded_rect(draw, (cx, cy, cx+cw, cy+ch), radius=24, fill=(255, 255, 255), outline=(226, 232, 240), width=1)

        # Huge Brand Emblem
        draw_rounded_rect(draw, (cx+80, cy+80, cx+180, cy+180), radius=24, fill=(37, 99, 235))
        draw.text((cx+115, cy+95), "L", fill=(255, 255, 255), font=get_font(68, bold=True))

        draw.text((cx+210, cy+85), "LAMLA GUIDE AI", fill=(15, 23, 42), font=get_font(48, bold=True))
        draw.text((cx+210, cy+145), "Complete Platform Architecture & Feature Walkthrough", fill=(100, 116, 139), font=FONT_TITLE)

        draw.line([(cx+80, cy+220), (cx+cw-80, cy+220)], fill=(241, 245, 249), width=2)

        # 3 Pillar Cards in grid
        card_w = (cw - 160 - 40) // 3
        pillars = [
            ("Socratic AI Intelligence", "Open-domain academic reasoning, multi-slide parsing & dynamic vector concept drawings."),
            ("Live Classroom Sync", "High-concurrency WebSockets for synchronized quizzes, countdowns & live leaderboards."),
            ("Zero Storage & Focus", "Zero cloud storage waste streaming and foreground-only study time tracking.")
        ]
        for idx, (p_title, p_desc) in enumerate(pillars):
            px = cx + 80 + idx * (card_w + 20)
            py = cy + 260
            draw_rounded_rect(draw, (px, py, px+card_w, py+240), radius=16, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
            draw_rounded_rect(draw, (px+24, py+24, px+64, py+64), radius=12, fill=(239, 246, 255))
            draw.text((px+36, py+30), str(idx+1), fill=(37, 99, 235), font=FONT_HEADING)
            draw.text((px+24, py+84), p_title, fill=(15, 23, 42), font=FONT_HEADING)
            p_lines = wrap_text(p_desc, max_chars=32)
            ply = py + 130
            for pl in p_lines:
                draw.text((px+24, ply), pl, fill=(100, 116, 139), font=FONT_BULLET)
                ply += 28

        # Slogan Banner
        slog_y = cy + 540
        draw_rounded_rect(draw, (cx+80, slog_y, cx+cw-80, cy+ch-60), radius=16, fill=(239, 246, 255), outline=(191, 219, 254), width=1)
        draw.text((cx+120, slog_y+36), "PLATFORM MOTTO:", fill=(37, 99, 235), font=FONT_BADGE)
        draw.text((cx+300, slog_y+30), "\"It's Never Too Late To Study.\"", fill=(15, 23, 42), font=get_font(34, bold=True))

    out_file = SLIDES_DIR / f"{scene['id']}_slide.png"
    im.save(out_file, "PNG", quality=95)
    return out_file

def main():
    print("=" * 65)
    print("    LAMLA GUIDE AI — MASTER VIDEO PRODUCTION SUITE")
    print("=" * 65)

    print(f"[STAGE 1] Rendering 13 Broadcast-Ready 1080p Master Slides...")
    slide_files = []
    for s in SCENES:
        sf = create_slide(s)
        slide_files.append((s, sf))
        print(f"  [OK] Rendered {s['id']}_slide.png")

    print("\n[STAGE 2] Encoding Synchronized 1080p Video Clips...")
    clip_paths = []
    for s, sf in slide_files:
        audio_path = s["audio_file"]
        if not os.path.exists(audio_path):
            print(f"  Warning: Audio {audio_path} not found, skipping...")
            continue

        w = wave.open(audio_path, 'rb')
        dur = round(w.getnframes() / w.getframerate(), 3)
        w.close()

        clip_out = CLIPS_DIR / f"{s['id']}_clip.mp4"
        cmd = [
            FFMPEG, "-y",
            "-loop", "1", "-i", str(sf),
            "-i", audio_path,
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-shortest",
            str(clip_out)
        ]
        t0 = time.time()
        res = subprocess.run(cmd, capture_output=True, text=True)
        t_el = round(time.time() - t0, 2)
        if clip_out.exists():
            size_kb = clip_out.stat().st_size // 1024
            print(f"  [OK] Encoded {s['id']} ({dur}s, {size_kb} KB) in {t_el}s")
            clip_paths.append(str(clip_out))
        else:
            print(f"  [X] Failed to encode {s['id']}: {res.stderr[-300:]}")

    print(f"\n[STAGE 3] Concatenating {len(clip_paths)} Scenes into Final Master Video...")
    # Write concat manifest
    concat_txt = SCRATCH_DIR / "clips_manifest.txt"
    with open(concat_txt, "w", encoding="utf-8") as f:
        for cp in clip_paths:
            f.write(f"file '{cp}'\n")

    cmd_concat = [
        FFMPEG, "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_txt),
        "-c", "copy",
        str(FINAL_VIDEO)
    ]
    res_concat = subprocess.run(cmd_concat, capture_output=True, text=True)
    if FINAL_VIDEO.exists():
        final_size_mb = round(FINAL_VIDEO.stat().st_size / (1024 * 1024), 2)
        print(f"  [OK] Master Walkthrough Video Created Successfully: {FINAL_VIDEO}")
        print(f"    Size: {final_size_mb} MB")

        # Copy to Artifact directory so user can directly download and access
        shutil.copy2(FINAL_VIDEO, ARTIFACT_VIDEO)
        print(f"  [OK] Copied to Artifacts: {ARTIFACT_VIDEO}")
    else:
        print(f"  [X] Concatenation failed: {res_concat.stderr[-400:]}")

    print("\n" + "=" * 65)
    print("           VIDEO PRODUCTION COMPLETED!")
    print("=" * 65)

if __name__ == "__main__":
    main()
