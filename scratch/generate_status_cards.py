"""
LAMLA Guide AI — High-Definition Status Cards & Website Screenshot Generator
Produces:
1. 1080x1920 Vertical Smartphone Status Cards (for WhatsApp Status & Instagram Stories)
2. 1920x1080 Landscape Presentation Cards (for LinkedIn, Twitter/X, & Facebook)
3. Raw 1280x820 Uncropped Screenshots
"""
import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
BASE_URL = "http://localhost:3001"
ROOT_DIR = r"C:\Users\dell\.gemini\antigravity\scratch\lamla-guide-web"
STATUS_PORTRAIT_DIR = os.path.join(ROOT_DIR, "public", "status_images")
STATUS_LANDSCAPE_DIR = os.path.join(ROOT_DIR, "public", "status_images_landscape")
RAW_DIR = os.path.join(ROOT_DIR, "public", "screenshots")

os.makedirs(STATUS_PORTRAIT_DIR, exist_ok=True)
os.makedirs(STATUS_LANDSCAPE_DIR, exist_ok=True)
os.makedirs(RAW_DIR, exist_ok=True)

PAGES = [
    {
        "id": "01_Landing_Page_Overview",
        "url": f"{BASE_URL}/",
        "badge": "PLATFORM OVERVIEW",
        "title": "Welcome to LAMLA Guide AI",
        "subtitle": "Turn lecture slides, PDFs & textbooks into exam mastery.",
        "bullets": [
            "Upload any lecture presentation (.pptx), PDF, or Word doc up to 1 GB.",
            "Instant exam-oriented summaries and slide-by-slide notes without omissions.",
            "Built with zero-credit fallback architecture: free for all students.",
        ],
        "tip": "Works on web and installs as a standalone app on Android, iPhone & Mac.",
    },
    {
        "id": "02_Student_Login_Portal",
        "url": f"{BASE_URL}/auth/login",
        "badge": "FAST SECURE ACCESS",
        "title": "Student & Educator Login",
        "subtitle": "Seamless access with email, password, or Google sign-in.",
        "bullets": [
            "Direct authentication powered by Supabase with Row Level Security.",
            "Instant class circle preview when joining via an invite link.",
            "Saved study history, quiz scorecards, and personal streaks.",
        ],
        "tip": "Forgot your password? 1-click secure reset email available.",
    },
    {
        "id": "03_Student_Registration_Notifications",
        "url": f"{BASE_URL}/auth/signup",
        "badge": "JOIN IN 30 SECONDS",
        "title": "Instant Student Registration",
        "subtitle": "Create your account and unlock your personal AI study workspace.",
        "bullets": [
            "Prompts for browser notification permissions right after registration.",
            "Never miss a scheduled live class quiz or daily study reminder.",
            "Automatic enrollment into your class study group when using an invite code.",
        ],
        "tip": "Zero credit exhaustion: study as much as you want without paying.",
    },
    {
        "id": "04_Personal_Study_Dashboard",
        "url": f"{BASE_URL}/dashboard",
        "badge": "MAIN STUDY WORKSPACE",
        "title": "Personal Study Dashboard",
        "subtitle": "Upload slides, generate quizzes, and master examinable concepts.",
        "bullets": [
            "Upload lecture slides (.pptx), PDFs, Word docs, and photos.",
            "Notes generated for at least every single slide without skipping facts.",
            "True Foreground Focus Tracker pauses when you leave and resumes on return.",
        ],
        "tip": "Click 'Install App' in the top header to add LAMLA Guide to your home screen.",
    },
    {
        "id": "05_AI_Tutor_and_SVG_Concept_Drawing",
        "url": f"{BASE_URL}/features",
        "badge": "PERSONAL AI TUTOR",
        "title": "AI Tutor & Visual Concept Mentor",
        "subtitle": "Ask anything! Enriched with real-time web facts & vector drawings.",
        "bullets": [
            "Answers questions grounded in your slides OR completely outside your course.",
            "Live web research integration pulls facts from Wikipedia & DuckDuckGo.",
            "Dynamic concept drawing: writes clean, labeled SVG diagrams on demand.",
        ],
        "tip": "Features multi-modal text-to-speech and microphone voice input.",
    },
    {
        "id": "06_Timed_Practice_Quizzes",
        "url": f"{BASE_URL}/faq",
        "badge": "EXAM PREPARATION",
        "title": "Timed Practice Quizzes & Drills",
        "subtitle": "High-yield exam questions with zero duplicates and verified answers.",
        "bullets": [
            "Generates up to 50 questions per slide deck (MCQ, True/False, Short Answer).",
            "Jaccard token deduplication ensures zero repeated questions.",
            "Step-by-step explanations and common misconception callouts for every question.",
        ],
        "tip": "Turn any slide deck into rapid interactive flashcard review decks.",
    },
    {
        "id": "07_Live_Class_Circles_and_Synced_Quizzes",
        "url": f"{BASE_URL}/dashboard?scope=groups",
        "badge": "SYNCHRONIZED CLASS CIRCLES",
        "title": "Live Synchronized Group Quizzes",
        "subtitle": "Compete with classmates and study circles in real-time timed exams.",
        "bullets": [
            "Supports up to 1,000 students connected live in a single study circle.",
            "Host/Admin automatically participates in the quiz alongside students.",
            "Automatic independent marking on timer expiry reveals your rank and score.",
        ],
        "tip": "Schedule quizzes in advance with a live synchronized start countdown.",
    },
    {
        "id": "08_Study_Routines_and_Focus_Tracker",
        "url": f"{BASE_URL}/dashboard?scope=planner",
        "badge": "DAILY DISCIPLINE",
        "title": "Focus Time & Routine Tracker",
        "subtitle": "Build unbroken study streaks and measure true learning hours.",
        "bullets": [
            "Measures foreground study time using modern visibility performance entries.",
            "Customizable daily question targets and 7-day consistency calendar.",
            "Streak freeze shield protects your momentum when life gets busy.",
        ],
        "tip": "Points earned here directly influence your position on the Leaderboard.",
    },
    {
        "id": "09_Exam_Readiness_and_Analytics",
        "url": f"{BASE_URL}/dashboard?scope=exam_tracker",
        "badge": "PERFORMANCE ANALYTICS",
        "title": "Exam Readiness & Scorecards",
        "subtitle": "Track your progress across every course and identify weak topics.",
        "bullets": [
            "Historical breakdown of all completed quizzes and score percentages.",
            "Highlights mastered topics versus concepts needing active recall drills.",
            "Prepares students thoroughly for WASSCE, midterms, and university finals.",
        ],
        "tip": "Filter by course or difficulty to focus on challenging areas.",
    },
    {
        "id": "10_Progressive_Web_App_Mobile_Install",
        "url": f"{BASE_URL}/how-it-works",
        "badge": "PROGRESSIVE WEB APP",
        "title": "1-Tap Mobile App Experience",
        "subtitle": "Install LAMLA Guide directly on your phone with zero app store delays.",
        "bullets": [
            "Add to Home Screen on Android, iPhone, Windows, and macOS.",
            "Full-screen standalone display looks and feels like a native mobile app.",
            "Service worker shell provides offline access when internet is unstable.",
        ],
        "tip": "Tap 'Install' or use Safari's 'Add to Home Screen' to start.",
    },
]

def capture_screenshot(url: str, output_path: str) -> bool:
    """Takes a clean headless Chrome screenshot after 4s virtual time for complete hydration."""
    args = [
        CHROME_PATH,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--window-size=1280,820",
        "--virtual-time-budget=4000",
        "--hide-scrollbars",
        f"--screenshot={output_path}",
        url
    ]
    try:
        res = subprocess.run(args, capture_output=True, text=True, timeout=25)
        return res.returncode == 0 and os.path.exists(output_path)
    except Exception as e:
        print(f"Error capturing {url}: {e}")
        return False

def get_font(name: str, size: int):
    try:
        path = f"C:\\Windows\\Fonts\\{name}"
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    except Exception:
        pass
    return ImageFont.load_default()

def draw_window_mockup(draw, card, shot_path, x, y, w, h, display_url):
    # Outer frame shadow
    draw.rounded_rectangle([(x - 4, y - 4), (x + w + 4, y + h + 8)], radius=22, fill=(226, 232, 240, 255))
    draw.rounded_rectangle([(x, y), (x + w, y + h)], radius=20, fill=(255, 255, 255, 255), outline=(203, 213, 225, 255), width=2)

    # Titlebar
    titlebar_h = 44
    draw.rounded_rectangle([(x, y), (x + w, y + titlebar_h)], radius=20, fill=(241, 245, 249, 255))
    draw.rectangle([(x, y + titlebar_h - 10), (x + w, y + titlebar_h)], fill=(241, 245, 249, 255))

    # Traffic light dots
    draw.ellipse([(x + 18, y + 14), (x + 32, y + 28)], fill=(239, 68, 68, 255))
    draw.ellipse([(x + 40, y + 14), (x + 54, y + 28)], fill=(245, 158, 11, 255))
    draw.ellipse([(x + 62, y + 14), (x + 76, y + 28)], fill=(16, 185, 129, 255))

    # URL box
    url_box_w = min(480, w - 240)
    url_box_x = x + (w - url_box_w) // 2
    draw.rounded_rectangle([(url_box_x, y + 8), (url_box_x + url_box_w, y + 36)], radius=8, fill=(255, 255, 255, 255), outline=(226, 232, 240, 255))
    draw.text((url_box_x + 14, y + 11), display_url[:48], font=get_font("segoeui.ttf", 15), fill=(100, 116, 139, 255))

    # Paste screenshot
    if os.path.exists(shot_path):
        try:
            raw_shot = Image.open(shot_path)
            shot_w = w - 4
            shot_h = h - titlebar_h - 2
            resized = raw_shot.resize((shot_w, shot_h), Image.Resampling.LANCZOS)
            card.paste(resized, (x + 2, y + titlebar_h))
        except Exception as e:
            print(f"Error pasting shot: {e}")

def create_portrait_card(page_info: dict, shot_path: str, output_path: str):
    """1080x1920 Vertical Smartphone Status Card."""
    W, H = 1080, 1920
    card = Image.new("RGBA", (W, H), (248, 250, 252, 255))
    draw = ImageDraw.Draw(card)

    header_h = 320
    for y in range(header_h):
        r = int(30 + (37 - 30) * (y / header_h))
        g = int(64 + (99 - 64) * (y / header_h))
        b = int(175 + (235 - 175) * (y / header_h))
        draw.line([(0, y), (W, y)], fill=(r, g, b, 255))

    # Fonts
    f_badge = get_font("segoeuib.ttf", 26)
    f_brand = get_font("segoeuib.ttf", 36)
    f_slogan = get_font("segoeui.ttf", 24)
    f_title = get_font("segoeuib.ttf", 50)
    f_sub = get_font("segoeui.ttf", 28)
    f_bullet = get_font("segoeui.ttf", 28)
    f_tip = get_font("segoeuib.ttf", 24)
    f_footer = get_font("segoeui.ttf", 22)

    # Header branding
    draw.text((60, 48), "LAMLA GUIDE AI", font=f_brand, fill=(255, 255, 255, 255))
    draw.text((60, 94), "“It's Never Too Late To Study.”", font=f_slogan, fill=(224, 231, 255, 255))

    # Badge pill
    badge = page_info["badge"]
    bbox = f_badge.getbbox(badge)
    bw = bbox[2] - bbox[0] + 36
    bx = W - 60 - bw
    draw.rounded_rectangle([(bx, 52), (W - 60, 102)], radius=25, fill=(255, 255, 255, 40), outline=(255, 255, 255, 120), width=2)
    draw.text((bx + 18, 62), badge, font=f_badge, fill=(255, 255, 255, 255))

    # Title & Subtitle
    draw.text((60, 154), page_info["title"], font=f_title, fill=(255, 255, 255, 255))
    draw.text((60, 224), page_info["subtitle"], font=f_sub, fill=(219, 234, 254, 255))

    # Browser Mockup
    mock_x, mock_y, mock_w, mock_h = 54, 340, 972, 730
    clean_url = page_info["url"].replace(BASE_URL, "https://lamla-guide-ai.onrender.com")
    draw_window_mockup(draw, card, shot_path, mock_x, mock_y, mock_w, mock_h, clean_url)

    # Details Card
    info_y = 1100
    info_h = 750
    draw.rounded_rectangle([(mock_x, info_y), (mock_x + mock_w, info_y + info_h)], radius=24, fill=(255, 255, 255, 255), outline=(226, 232, 240, 255), width=2)

    draw.text((mock_x + 40, info_y + 36), "WHAT THIS PAGE DOES", font=get_font("segoeuib.ttf", 22), fill=(37, 99, 235, 255))
    draw.line([(mock_x + 40, info_y + 70), (mock_x + mock_w - 40, info_y + 70)], fill=(241, 245, 249, 255), width=2)

    by = info_y + 94
    for b in page_info["bullets"]:
        draw.ellipse([(mock_x + 40, by + 4), (mock_x + 68, by + 32)], fill=(239, 246, 255, 255), outline=(191, 219, 254, 255), width=2)
        draw.text((mock_x + 48, by + 6), "✓", font=get_font("segoeuib.ttf", 20), fill=(37, 99, 235, 255))
        draw.text((mock_x + 84, by + 4), b, font=f_bullet, fill=(30, 41, 59, 255))
        by += 74

    tip_y = by + 20
    draw.rounded_rectangle([(mock_x + 40, tip_y), (mock_x + mock_w - 40, tip_y + 104)], radius=16, fill=(240, 253, 244, 255), outline=(187, 247, 208, 255), width=2)
    draw.text((mock_x + 60, tip_y + 18), "💡 PRO-TIP FOR STUDENTS & TEACHERS", font=get_font("segoeuib.ttf", 18), fill=(22, 101, 52, 255))
    draw.text((mock_x + 60, tip_y + 48), page_info["tip"], font=f_tip, fill=(21, 128, 61, 255))

    cta_y = tip_y + 104 + 30
    draw.line([(mock_x + 40, cta_y), (mock_x + mock_w - 40, cta_y)], fill=(241, 245, 249, 255), width=1)
    draw.text((mock_x + 40, cta_y + 16), "Official LAMLA Guide AI • https://lamla-guide-ai.onrender.com", font=f_footer, fill=(100, 116, 139, 255))
    draw.text((mock_x + mock_w - 270, cta_y + 16), "WhatsApp: 0539337142", font=f_footer, fill=(37, 99, 235, 255))

    card.save(output_path, "PNG", quality=95)

def create_landscape_card(page_info: dict, shot_path: str, output_path: str):
    """1920x1080 Landscape Presentation Card (LinkedIn / Twitter / Desktop)."""
    W, H = 1920, 1080
    card = Image.new("RGBA", (W, H), (248, 250, 252, 255))
    draw = ImageDraw.Draw(card)

    # Left Panel: Text & Bullets (width: 780)
    # Right Panel: Screenshot Mockup (width: 1040)
    left_w = 780
    for x in range(left_w):
        draw.line([(x, 0), (x, H)], fill=(255, 255, 255, 255))
    draw.line([(left_w, 0), (left_w, H)], fill=(226, 232, 240, 255), width=2)

    f_brand = get_font("segoeuib.ttf", 32)
    f_badge = get_font("segoeuib.ttf", 20)
    f_title = get_font("segoeuib.ttf", 44)
    f_sub = get_font("segoeui.ttf", 26)
    f_bullet = get_font("segoeui.ttf", 24)
    f_tip = get_font("segoeuib.ttf", 20)
    f_footer = get_font("segoeui.ttf", 20)

    # Left header
    draw.text((60, 50), "LAMLA GUIDE AI", font=f_brand, fill=(37, 99, 235, 255))
    draw.text((60, 92), "“It's Never Too Late To Study.”", font=get_font("segoeui.ttf", 22), fill=(100, 116, 139, 255))

    badge = page_info["badge"]
    bbox = f_badge.getbbox(badge)
    bw = bbox[2] - bbox[0] + 28
    draw.rounded_rectangle([(60, 140), (60 + bw, 176)], radius=18, fill=(239, 246, 255, 255), outline=(191, 219, 254, 255), width=2)
    draw.text((74, 148), badge, font=f_badge, fill=(37, 99, 235, 255))

    draw.text((60, 200), page_info["title"], font=f_title, fill=(15, 23, 42, 255))
    draw.text((60, 260), page_info["subtitle"], font=f_sub, fill=(71, 85, 105, 255))
    draw.line([(60, 316), (left_w - 60, 316)], fill=(241, 245, 249, 255), width=2)

    draw.text((60, 340), "WHAT THIS PAGE DOES", font=get_font("segoeuib.ttf", 20), fill=(37, 99, 235, 255))
    by = 380
    for b in page_info["bullets"]:
        draw.ellipse([(60, by + 4), (84, by + 28)], fill=(239, 246, 255, 255), outline=(191, 219, 254, 255), width=2)
        draw.text((67, by + 5), "✓", font=get_font("segoeuib.ttf", 16), fill=(37, 99, 235, 255))
        draw.text((98, by + 2), b, font=f_bullet, fill=(30, 41, 59, 255))
        by += 64

    tip_y = by + 20
    draw.rounded_rectangle([(60, tip_y), (left_w - 60, tip_y + 90)], radius=14, fill=(240, 253, 244, 255), outline=(187, 247, 208, 255), width=2)
    draw.text((76, tip_y + 14), "💡 PRO-TIP FOR STUDENTS", font=get_font("segoeuib.ttf", 16), fill=(22, 101, 52, 255))
    draw.text((76, tip_y + 40), page_info["tip"], font=f_tip, fill=(21, 128, 61, 255))

    draw.text((60, H - 70), "https://lamla-guide-ai.onrender.com • WhatsApp: 0539337142", font=f_footer, fill=(100, 116, 139, 255))

    # Right side: Window Mockup
    rw = 1040
    mock_x = left_w + 40
    mock_y = 60
    mock_w = W - mock_x - 50
    mock_h = H - 120
    clean_url = page_info["url"].replace(BASE_URL, "https://lamla-guide-ai.onrender.com")
    draw_window_mockup(draw, card, shot_path, mock_x, mock_y, mock_w, mock_h, clean_url)

    card.save(output_path, "PNG", quality=95)

def main():
    print(f"Generating full visual suite for {len(PAGES)} sections...")
    for idx, p in enumerate(PAGES, 1):
        raw_shot_path = os.path.join(RAW_DIR, f"{p['id']}.png")
        portrait_path = os.path.join(STATUS_PORTRAIT_DIR, f"{p['id']}_status.png")
        landscape_path = os.path.join(STATUS_LANDSCAPE_DIR, f"{p['id']}_landscape.png")

        print(f"[{idx}/{len(PAGES)}] Capturing {p['id']} -> {p['url']}...")
        capture_screenshot(p["url"], raw_shot_path)
        create_portrait_card(p, raw_shot_path, portrait_path)
        create_landscape_card(p, raw_shot_path, landscape_path)

    print("\nSUCCESS: All portrait status cards, landscape presentation cards, and raw screenshots generated!")

if __name__ == "__main__":
    main()
