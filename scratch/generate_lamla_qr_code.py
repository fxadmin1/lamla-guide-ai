"""
Generate Official High-Resolution Scannable QR Code & Share Poster
for LAMLA Guide AI: https://lamla-guide-ai.onrender.com
"""

import shutil
import subprocess
import sys
from pathlib import Path

try:
    import qrcode
    from qrcode.constants import ERROR_CORRECT_H
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "qrcode[pil]"])
    import qrcode
    from qrcode.constants import ERROR_CORRECT_H

from PIL import Image, ImageDraw, ImageFont

TARGET_URL = "https://lamla-guide-ai.onrender.com"

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT_DIR / "public"
ARTIFACT_DIR = Path(r"C:\Users\dell\.gemini\antigravity\brain\5a00c07e-8495-4602-91d7-f4451c9b870e")


def load_font(size: int, bold: bool = False):
    candidates = (
        ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/calibrib.ttf"]
        if bold
        else ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/calibri.ttf"]
    )
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def build_qr_image(url: str, size: int = 900) -> Image.Image:
    qr = qrcode.QRCode(
        version=4,
        error_correction=ERROR_CORRECT_H,
        box_size=20,
        border=3,
    )
    qr.add_data(url)
    qr.make(fit=True)

    qr_img = qr.make_image(fill_color="#0f172a", back_color="#ffffff").convert("RGBA")
    qr_img = qr_img.resize((size, size), Image.Resampling.NEAREST)

    # Add a clean rounded center badge ("LAMLA") within H error-correction budget (<16% area)
    draw = ImageDraw.Draw(qr_img)
    badge_w = int(size * 0.20)
    cx, cy = size // 2, size // 2
    x0, y0 = cx - badge_w // 2, cy - badge_w // 2
    x1, y1 = cx + badge_w // 2, cy + badge_w // 2

    draw.rounded_rectangle([x0 - 8, y0 - 8, x1 + 8, y1 + 8], radius=28, fill="#ffffff")
    draw.rounded_rectangle([x0, y0, x1, y1], radius=22, fill="#2563eb")

    badge_font_big = load_font(int(badge_w * 0.26), bold=True)
    badge_font_sub = load_font(int(badge_w * 0.14), bold=True)

    t1 = "LAMLA"
    b1 = draw.textbbox((0, 0), t1, font=badge_font_big)
    draw.text((cx - (b1[2] - b1[0]) / 2, cy - badge_w * 0.22), t1, fill="#ffffff", font=badge_font_big)

    t2 = "GUIDE AI"
    b2 = draw.textbbox((0, 0), t2, font=badge_font_sub)
    draw.text((cx - (b2[2] - b2[0]) / 2, cy + badge_w * 0.10), t2, fill="#bfdbfe", font=badge_font_sub)

    return qr_img


def build_poster(qr_img: Image.Image) -> Image.Image:
    W, H = 1080, 1350
    poster = Image.new("RGB", (W, H), "#0b1120")
    draw = ImageDraw.Draw(poster)

    # Subtle gradient background bands
    for y in range(H):
        ratio = y / H
        r = int(11 + 14 * (1 - ratio))
        g = int(19 + 28 * (1 - ratio))
        b = int(38 + 65 * (1 - ratio))
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Top glowing pill badge
    pill_font = load_font(24, bold=True)
    pill_text = "SCAN TO JOIN  •  24/7 LIVE AI STUDY PLATFORM"
    pb = draw.textbbox((0, 0), pill_text, font=pill_font)
    pw = pb[2] - pb[0] + 64
    px0 = (W - pw) // 2
    draw.rounded_rectangle([px0, 58, px0 + pw, 112], radius=27, fill="#1e3a8a", outline="#3b82f6", width=2)
    draw.text(((W - (pb[2] - pb[0])) / 2, 70), pill_text, fill="#93c5fd", font=pill_font)

    # Title & Slogan
    title_font = load_font(68, bold=True)
    title_text = "LAMLA Guide AI"
    tb = draw.textbbox((0, 0), title_text, font=title_font)
    draw.text(((W - (tb[2] - tb[0])) / 2, 134), title_text, fill="#ffffff", font=title_font)

    slogan_font = load_font(30, bold=False)
    slogan_text = "\"It's Never Too Late To Study.\""
    sb = draw.textbbox((0, 0), slogan_text, font=slogan_font)
    draw.text(((W - (sb[2] - sb[0])) / 2, 222), slogan_text, fill="#93c5fd", font=slogan_font)

    # White Card Frame for QR Code
    card_w, card_h = 740, 740
    cx0 = (W - card_w) // 2
    cy0 = 290
    # Outer glow border
    draw.rounded_rectangle(
        [cx0 - 10, cy0 - 10, cx0 + card_w + 10, cy0 + card_h + 10],
        radius=48,
        fill="#1d4ed8",
    )
    draw.rounded_rectangle(
        [cx0, cy0, cx0 + card_w, cy0 + card_h],
        radius=40,
        fill="#ffffff",
    )

    qr_resized = qr_img.resize((660, 660), Image.Resampling.NEAREST)
    poster.paste(qr_resized.convert("RGB"), (cx0 + 40, cy0 + 40))

    # Instructions Row
    inst_font = load_font(28, bold=True)
    inst_text = "Point your phone camera at the QR code to open instantly"
    ib = draw.textbbox((0, 0), inst_text, font=inst_font)
    draw.text(((W - (ib[2] - ib[0])) / 2, 1068), inst_text, fill="#e2e8f0", font=inst_font)

    # Feature tags
    tag_font = load_font(22, bold=True)
    features = ["AI Socratic Tutor", "Slide & Past Question Analysis", "Live Class Quizzes", "Exam Readiness"]
    tag_y = 1132
    total_w = 0
    tag_boxes = []
    for f in features:
        fb = draw.textbbox((0, 0), f, font=tag_font)
        tw = (fb[2] - fb[0]) + 34
        tag_boxes.append((f, tw, fb[2] - fb[0]))
        total_w += tw
    total_w += 16 * (len(features) - 1)
    cur_x = (W - total_w) // 2
    for f, tw, text_w in tag_boxes:
        draw.rounded_rectangle([cur_x, tag_y, cur_x + tw, tag_y + 46], radius=23, fill="#1e293b", outline="#334155", width=2)
        draw.text((cur_x + (tw - text_w) / 2, tag_y + 9), f, fill="#cbd5e1", font=tag_font)
        cur_x += tw + 16

    # Direct URL Footer Box
    url_font = load_font(30, bold=True)
    ub = draw.textbbox((0, 0), TARGET_URL, font=url_font)
    uw = (ub[2] - ub[0]) + 80
    ux0 = (W - uw) // 2
    uy0 = 1212
    draw.rounded_rectangle([ux0, uy0, ux0 + uw, uy0 + 68], radius=34, fill="#2563eb")
    draw.text(((W - (ub[2] - ub[0])) / 2, uy0 + 14), TARGET_URL, fill="#ffffff", font=url_font)

    return poster


def main():
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    qr_clean = build_qr_image(TARGET_URL, size=1000)
    poster = build_poster(qr_clean)

    clean_pub = PUBLIC_DIR / "lamla_guide_ai_qr_code.png"
    poster_pub = PUBLIC_DIR / "lamla_guide_ai_qr_poster.png"
    qr_clean.convert("RGB").save(clean_pub, format="PNG", optimize=True)
    poster.save(poster_pub, format="PNG", optimize=True)

    shutil.copy2(clean_pub, ARTIFACT_DIR / "lamla_guide_ai_qr_code.png")
    shutil.copy2(poster_pub, ARTIFACT_DIR / "lamla_guide_ai_qr_poster.png")
    print(f"[OK] Saved QR code to {clean_pub}")
    print(f"[OK] Saved QR poster to {poster_pub}")


if __name__ == "__main__":
    main()
