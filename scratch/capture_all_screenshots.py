"""
LAMLA Guide AI - Live Page Screenshot Capture
Captures high-resolution 1920x1080 Full HD screenshots of all main website pages.
"""
import os
import subprocess
import time
from pathlib import Path

CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUTPUT_DIR = Path(r"C:\Users\dell\.gemini\antigravity\scratch\lamla-guide-web\scratch\video_frames")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PAGES = [
    ("scene_01_landing.png", "http://localhost:3001/"),
    ("scene_02_how_it_works.png", "http://localhost:3001/how-it-works"),
    ("scene_03_features.png", "http://localhost:3001/features"),
    ("scene_04_signup.png", "http://localhost:3001/auth/signup"),
    ("scene_05_login.png", "http://localhost:3001/auth/login"),
    ("scene_06_dashboard.png", "http://localhost:3001/dashboard"),
    ("scene_07_pricing.png", "http://localhost:3001/pricing"),
]

def capture_page(name: str, url: str):
    out_path = OUTPUT_DIR / name
    args = [
        CHROME_EXE,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--window-size=1920,1080",
        "--hide-scrollbars",
        f"--screenshot={str(out_path)}",
        url
    ]
    print(f"Capturing {url} -> {name}...")
    subprocess.run(args, check=True)
    if out_path.exists():
        print(f"  Captured successfully: {out_path.stat().st_size // 1024} KB")
    else:
        print(f"  Warning: {name} not found after capture")

def main():
    print("Starting automated full HD page capture for video production...")
    for name, url in PAGES:
        try:
            capture_page(name, url)
        except Exception as e:
            print(f"Error capturing {name}: {e}")
    print("Capture complete!")

if __name__ == "__main__":
    main()
