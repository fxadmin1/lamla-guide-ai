"""
LAMLA Guide AI — Dedicated Feature Showcase Graphics Generator
Generates high-definition, professional feature showcase slides for every key feature:
1. 1080x1920 Vertical Mobile Status Images (WhatsApp Status / Instagram Stories)
2. 1920x1080 Landscape Presentation Cards (LinkedIn / Twitter / Desktop)
"""
import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
BASE_URL = "http://localhost:3001"
ROOT_DIR = r"C:\Users\dell\.gemini\antigravity\scratch\lamla-guide-web"
FEATURE_PORTRAIT_DIR = os.path.join(ROOT_DIR, "public", "feature_showcase_portrait")
FEATURE_LANDSCAPE_DIR = os.path.join(ROOT_DIR, "public", "feature_showcase_landscape")
RAW_DIR = os.path.join(ROOT_DIR, "public", "screenshots")

os.makedirs(FEATURE_PORTRAIT_DIR, exist_ok=True)
os.makedirs(FEATURE_LANDSCAPE_DIR, exist_ok=True)
os.makedirs(RAW_DIR, exist_ok=True)

FEATURES = [
    {
        "id": "feat_01_slide_ingestion",
        "num": "FEATURE 01",
        "category": "DOCUMENT INTELLIGENCE",
        "title": "1 GB Multi-Format Slide Ingestion",
        "subtitle": "Zero storage bloat with in-memory parsing and instant slide notes.",
        "url": f"{BASE_URL}/features",
        "highlights": [
            ("1 GB Upload Limit", "Handles massive 200+ slide presentations, medical PDFs & Word files."),
            ("Every Single Slide Covered", "Guaranteed notes for every page so students never miss key formulas."),
            ("Zero Disk Bloat", "Ephemeral buffers are immediately unlinked, keeping cloud storage free."),
            ("Multi-Format Support", "Accepts .pptx, .pdf, .docx, images, and plain text effortlessly.")
        ],
        "badge_color": (37, 99, 235), # Blue
    },
    {
        "id": "feat_02_ai_socratic_tutor",
        "num": "FEATURE 02",
        "category": "UNRESTRICTED LEARNING",
        "title": "Personal AI Socratic Tutor",
        "subtitle": "Ask anything! Enriched with real-time web facts & step-by-step guidance.",
        "url": f"{BASE_URL}/features",
        "highlights": [
            ("Unrestricted Academic Knowledge", "Answers questions inside your slides or completely outside them."),
            ("Live Web Research", "Queries Wikipedia & DuckDuckGo to explain real-world context."),
            ("Socratic Active Recall", "Prompts students to think deeply rather than just giving raw answers."),
            ("Voice Input & Speech", "Ask questions with your voice and listen to explanations hands-free.")
        ],
        "badge_color": (147, 51, 234), # Purple
    },
    {
        "id": "feat_03_svg_concept_drawing",
        "num": "FEATURE 03",
        "category": "VISUAL CONCEPT MENTOR",
        "title": "AI Vector Concept Drawing & Schematics",
        "subtitle": "Generates clean, labeled SVG diagrams for complex biological & physical systems.",
        "url": f"{BASE_URL}/features",
        "highlights": [
            ("Dynamic Vector Graphics", "Draws responsive, labeled SVG diagrams directly in your chat stream."),
            ("Complex Science Made Visual", "Effortlessly maps cell structures, Earth's layers & economic circuits."),
            ("Script-Inert Sandboxing", "Safe, clean data-URIs with full-screen zoom and 1-click download."),
            ("Audio-Sanitized", "Speech engine automatically skips raw SVG code so voice stays natural.")
        ],
        "badge_color": (13, 148, 136), # Teal
    },
    {
        "id": "feat_04_zero_repeat_quizzes",
        "num": "FEATURE 04",
        "category": "EXAM PREPARATION",
        "title": "High-Yield Quizzes with Zero Repeats",
        "subtitle": "Up to 50 questions per deck with Jaccard deduplication and verified explanations.",
        "url": f"{BASE_URL}/features",
        "highlights": [
            ("Zero Duplicate Questions", "Jaccard token similarity prevents identical or near-duplicate queries."),
            ("Up to 50 Questions per Deck", "Configure practice quizzes from 5 up to 50 questions with one slider."),
            ("Deep Misconception Explanations", "Every option explains why it's right or why it was a tricky trap."),
            ("Flexible Question Styles", "Multiple-choice (MCQ), True/False, and Short Answer formats.")
        ],
        "badge_color": (225, 29, 72), # Rose
    },
    {
        "id": "feat_05_live_synced_class_quizzes",
        "num": "FEATURE 05",
        "category": "SYNCHRONIZED CIRCLES",
        "title": "Live Synchronized Quizzes (1,000 Students)",
        "subtitle": "Whole lecture halls compete together with real-time timers and independent auto-marking.",
        "url": f"{BASE_URL}/dashboard?scope=groups",
        "highlights": [
            ("1,000 Participant Capacity", "Low-latency WebSocket broadcasts scale to massive university classes."),
            ("Host Auto-Participation", "Teachers and group admins take the quiz alongside their students."),
            ("Independent Auto-Marking", "When time expires, every student's score and rank are revealed."),
            ("1-Click Shareable Links", "Invite classmates with https://lamlaguide.com/dashboard?join=CODE.")
        ],
        "badge_color": (217, 119, 6), # Amber
    },
    {
        "id": "feat_06_scheduled_quizzes",
        "num": "FEATURE 06",
        "category": "TIMED EXAM SIMULATION",
        "title": "Scheduled Quizzes with Live Countdown",
        "subtitle": "Plan upcoming tests in advance. The room auto-starts when time arrives.",
        "url": f"{BASE_URL}/dashboard?scope=groups",
        "highlights": [
            ("Future Date & Time Picker", "Schedule a quiz for tonight at 8 PM or next Monday at 10 AM."),
            ("Synchronized Waiting Room", "Students entering early see a live real-time countdown clock."),
            ("Zero Host Stress", "The server automatically opens the quiz the moment the clock hits 00:00."),
            ("Notification Reminders", "Students with browser notifications receive an alert when round begins.")
        ],
        "badge_color": (79, 70, 229), # Indigo
    },
    {
        "id": "feat_07_foreground_study_tracker",
        "num": "FEATURE 07",
        "category": "ANTI-CHEATING DISCIPLINE",
        "title": "True Foreground Focus Study Tracker",
        "subtitle": "Measures true learning hours via Page Visibility API. Pauses on tab exit.",
        "url": f"{BASE_URL}/dashboard?scope=planner",
        "highlights": [
            ("Page Visibility Engine", "Only counts seconds while the student is actively reading on the screen."),
            ("Auto-Pauses on Exit", "Minimizing the window, switching tabs, or locking phone freezes the timer."),
            ("Unbroken Daily Streaks", "Track 7-day study consistency with flame streaks and streak shields."),
            ("Global Leaderboard XP", "Earned study minutes feed directly into platform-wide student rankings.")
        ],
        "badge_color": (16, 185, 129), # Emerald
    },
    {
        "id": "feat_08_pwa_mobile_app",
        "num": "FEATURE 08",
        "category": "PROGRESSIVE WEB APP",
        "title": "1-Tap Mobile App (Android & iPhone)",
        "subtitle": "Install directly from browser to home screen with full-screen standalone study.",
        "url": f"{BASE_URL}/features",
        "highlights": [
            ("Zero App Store Friction", "Add to Home Screen in 1 tap on Android, iPhone, Windows, and Mac."),
            ("Full-Screen Standalone UI", "Hides URL bars and behaves like a native, fast mobile application."),
            ("Offline Shell Caching", "Review slide notes and study routines even when internet connectivity drops."),
            ("Push Notification Ready", "Direct alerts for study group live quizzes and revision milestones.")
        ],
        "badge_color": (2, 132, 199), # Sky
    },
]

def get_font(name: str, size: int):
    try:
        path = f"C:\\Windows\\Fonts\\{name}"
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    except Exception:
        pass
    return ImageFont.load_default()

def draw_mockup_window(draw, card, shot_path, x, y, w, h, display_url):
    draw.rounded_rectangle([(x - 4, y - 4), (x + w + 4, y + h + 8)], radius=20, fill=(226, 232, 240, 255))
    draw.rounded_rectangle([(x, y), (x + w, y + h)], radius=18, fill=(255, 255, 255, 255), outline=(203, 213, 225, 255), width=2)

    titlebar_h = 42
    draw.rounded_rectangle([(x, y), (x + w, y + titlebar_h)], radius=18, fill=(241, 245, 249, 255))
    draw.rectangle([(x, y + titlebar_h - 10), (x + w, y + titlebar_h)], fill=(241, 245, 249, 255))

    draw.ellipse([(x + 16, y + 14), (x + 28, y + 26)], fill=(239, 68, 68, 255))
    draw.ellipse([(x + 36, y + 14), (x + 48, y + 26)], fill=(245, 158, 11, 255))
    draw.ellipse([(x + 56, y + 14), (x + 68, y + 26)], fill=(16, 185, 129, 255))

    url_w = min(420, w - 200)
    url_x = x + (w - url_w) // 2
    draw.rounded_rectangle([(url_x, y + 7), (url_x + url_w, y + 35)], radius=7, fill=(255, 255, 255, 255), outline=(226, 232, 240, 255))
    draw.text((url_x + 12, y + 10), display_url[:44], font=get_font("segoeui.ttf", 14), fill=(100, 116, 139, 255))

    if os.path.exists(shot_path):
        try:
            raw_shot = Image.open(shot_path)
            shot_w = w - 4
            shot_h = h - titlebar_h - 2
            resized = raw_shot.resize((shot_w, shot_h), Image.Resampling.LANCZOS)
            card.paste(resized, (x + 2, y + titlebar_h))
        except Exception as e:
            print(f"Error pasting shot: {e}")

def create_feature_portrait(feat: dict, shot_path: str, output_path: str):
    """1080x1920 Vertical Mobile Status Showcase Card."""
    W, H = 1080, 1920
    card = Image.new("RGBA", (W, H), (248, 250, 252, 255))
    draw = ImageDraw.Draw(card)

    # Top Brand Bar
    header_h = 330
    c_r, c_g, c_b = feat["badge_color"]
    for y in range(header_h):
        r = int(c_r * 0.8 + (c_r - c_r * 0.8) * (y / header_h))
        g = int(c_g * 0.8 + (c_g - c_g * 0.8) * (y / header_h))
        b = int(c_b * 0.8 + (c_b - c_b * 0.8) * (y / header_h))
        draw.line([(0, y), (W, y)], fill=(r, g, b, 255))

    f_brand = get_font("segoeuib.ttf", 34)
    f_slogan = get_font("segoeui.ttf", 22)
    f_badge = get_font("segoeuib.ttf", 24)
    f_title = get_font("segoeuib.ttf", 46)
    f_sub = get_font("segoeui.ttf", 26)
    f_h_title = get_font("segoeuib.ttf", 26)
    f_h_desc = get_font("segoeui.ttf", 22)
    f_footer = get_font("segoeui.ttf", 22)

    # Brand Title
    draw.text((60, 44), "LAMLA GUIDE AI", font=f_brand, fill=(255, 255, 255, 255))
    draw.text((60, 88), "“It's Never Too Late To Study.”", font=f_slogan, fill=(224, 231, 255, 255))

    # Number + Category Badge
    badge_label = f"{feat['num']} • {feat['category']}"
    bbox = f_badge.getbbox(badge_label)
    bw = bbox[2] - bbox[0] + 36
    bx = W - 60 - bw
    draw.rounded_rectangle([(bx, 48), (W - 60, 96)], radius=24, fill=(255, 255, 255, 40), outline=(255, 255, 255, 120), width=2)
    draw.text((bx + 18, 58), badge_label, font=f_badge, fill=(255, 255, 255, 255))

    # Feature Title & Subtitle
    draw.text((60, 150), feat["title"], font=f_title, fill=(255, 255, 255, 255))
    draw.text((60, 216), feat["subtitle"], font=f_sub, fill=(224, 231, 255, 255))

    # Center Browser Window
    mock_x, mock_y, mock_w, mock_h = 54, 350, 972, 700
    display_url = feat["url"].replace(BASE_URL, "https://lamla-guide-ai.onrender.com")
    draw_mockup_window(draw, card, shot_path, mock_x, mock_y, mock_w, mock_h, display_url)

    # Bottom Detailed Capabilities Box
    box_y = 1075
    box_h = 780
    draw.rounded_rectangle([(mock_x, box_y), (mock_x + mock_w, box_y + box_h)], radius=24, fill=(255, 255, 255, 255), outline=(226, 232, 240, 255), width=2)

    draw.text((mock_x + 40, box_y + 36), "KEY CAPABILITIES & BREAKDOWN", font=get_font("segoeuib.ttf", 22), fill=(c_r, c_g, c_b, 255))
    draw.line([(mock_x + 40, box_y + 70), (mock_x + mock_w - 40, box_y + 70)], fill=(241, 245, 249, 255), width=2)

    item_y = box_y + 90
    for h_title, h_desc in feat["highlights"]:
        # Icon circle
        draw.ellipse([(mock_x + 40, item_y + 4), (mock_x + 76, item_y + 40)], fill=(239, 246, 255, 255), outline=(191, 219, 254, 255), width=2)
        draw.text((mock_x + 50, item_y + 6), "★", font=get_font("segoeuib.ttf", 20), fill=(c_r, c_g, c_b, 255))

        # Title & Description
        draw.text((mock_x + 94, item_y + 2), h_title, font=f_h_title, fill=(15, 23, 42, 255))
        draw.text((mock_x + 94, item_y + 36), h_desc, font=f_h_desc, fill=(71, 85, 105, 255))
        item_y += 88

    # Bottom Footer
    draw.line([(mock_x + 40, item_y + 10), (mock_x + mock_w - 40, item_y + 10)], fill=(241, 245, 249, 255), width=1)
    draw.text((mock_x + 40, item_y + 24), "Official LAMLA Guide AI • https://lamla-guide-ai.onrender.com", font=f_footer, fill=(100, 116, 139, 255))
    draw.text((mock_x + mock_w - 270, item_y + 24), "WhatsApp: 0539337142", font=f_footer, fill=(37, 99, 235, 255))

    card.save(output_path, "PNG", quality=95)

def create_feature_landscape(feat: dict, shot_path: str, output_path: str):
    """1920x1080 Landscape Showcase Card (Desktop / Presentations / LinkedIn)."""
    W, H = 1920, 1080
    card = Image.new("RGBA", (W, H), (248, 250, 252, 255))
    draw = ImageDraw.Draw(card)

    left_w = 820
    for x in range(left_w):
        draw.line([(x, 0), (x, H)], fill=(255, 255, 255, 255))
    draw.line([(left_w, 0), (left_w, H)], fill=(226, 232, 240, 255), width=2)

    c_r, c_g, c_b = feat["badge_color"]
    f_brand = get_font("segoeuib.ttf", 30)
    f_badge = get_font("segoeuib.ttf", 20)
    f_title = get_font("segoeuib.ttf", 40)
    f_sub = get_font("segoeui.ttf", 24)
    f_h_title = get_font("segoeuib.ttf", 22)
    f_h_desc = get_font("segoeui.ttf", 19)
    f_footer = get_font("segoeui.ttf", 20)

    draw.text((60, 48), "LAMLA GUIDE AI", font=f_brand, fill=(c_r, c_g, c_b, 255))
    draw.text((60, 90), "“It's Never Too Late To Study.”", font=get_font("segoeui.ttf", 20), fill=(100, 116, 139, 255))

    badge_label = f"{feat['num']} • {feat['category']}"
    bbox = f_badge.getbbox(badge_label)
    bw = bbox[2] - bbox[0] + 28
    draw.rounded_rectangle([(60, 134), (60 + bw, 172)], radius=18, fill=(239, 246, 255, 255), outline=(191, 219, 254, 255), width=2)
    draw.text((74, 142), badge_label, font=f_badge, fill=(c_r, c_g, c_b, 255))

    draw.text((60, 196), feat["title"], font=f_title, fill=(15, 23, 42, 255))
    draw.text((60, 252), feat["subtitle"], font=f_sub, fill=(71, 85, 105, 255))
    draw.line([(60, 304), (left_w - 60, 304)], fill=(241, 245, 249, 255), width=2)

    draw.text((60, 324), "FEATURE BREAKDOWN", font=get_font("segoeuib.ttf", 19), fill=(c_r, c_g, c_b, 255))

    item_y = 360
    for h_title, h_desc in feat["highlights"]:
        draw.ellipse([(60, item_y + 2), (86, item_y + 28)], fill=(239, 246, 255, 255), outline=(191, 219, 254, 255), width=2)
        draw.text((68, item_y + 3), "★", font=get_font("segoeuib.ttf", 16), fill=(c_r, c_g, c_b, 255))
        draw.text((100, item_y), h_title, font=f_h_title, fill=(15, 23, 42, 255))
        draw.text((100, item_y + 30), h_desc, font=f_h_desc, fill=(71, 85, 105, 255))
        item_y += 76

    draw.text((60, H - 64), "https://lamla-guide-ai.onrender.com • WhatsApp: 0539337142", font=f_footer, fill=(100, 116, 139, 255))

    # Right side browser window
    mock_x = left_w + 40
    mock_y = 60
    mock_w = W - mock_x - 50
    mock_h = H - 120
    display_url = feat["url"].replace(BASE_URL, "https://lamla-guide-ai.onrender.com")
    draw_mockup_window(draw, card, shot_path, mock_x, mock_y, mock_w, mock_h, display_url)

    card.save(output_path, "PNG", quality=95)

def main():
    print(f"Generating feature showcase graphics for {len(FEATURES)} core features...")
    for idx, f in enumerate(FEATURES, 1):
        raw_shot_path = os.path.join(RAW_DIR, f"{f['id']}.png")
        portrait_path = os.path.join(FEATURE_PORTRAIT_DIR, f"{f['id']}_portrait.png")
        landscape_path = os.path.join(FEATURE_LANDSCAPE_DIR, f"{f['id']}_landscape.png")

        print(f"[{idx}/{len(FEATURES)}] Capturing {f['id']} -> {f['url']}...")
        args = [
            CHROME_PATH,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--window-size=1280,820",
            "--virtual-time-budget=4000",
            "--hide-scrollbars",
            f"--screenshot={raw_shot_path}",
            f['url']
        ]
        try:
            subprocess.run(args, capture_output=True, text=True, timeout=25)
        except Exception as e:
            print(f"Capture error: {e}")

        create_feature_portrait(f, raw_shot_path, portrait_path)
        create_feature_landscape(f, raw_shot_path, landscape_path)
        print(f"Created: {portrait_path} and {landscape_path}")

    print("\nSUCCESS: All 8 feature showcase graphics generated in portrait and landscape!")

if __name__ == "__main__":
    main()
