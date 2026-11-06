"""
LAMLA Guide AI — Live Website Synchronization & Production Verification Suite
"It's Never Too Late To Study."

Verifies that the ACTUAL live deployed website (https://lamla-guide-ai.onrender.com)
is healthy, synchronized with the expected version/commit, serving the updated
Next.js frontend + Unified Python AI backend, and enforcing multi-user security.

Usage:
    python python_ai/verify_production_live.py --url https://lamla-guide-ai.onrender.com --expected-version 2.4.0
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests

ROOT_DIR = Path(__file__).resolve().parent.parent


def load_local_version() -> Dict[str, Any]:
    vf = ROOT_DIR / "VERSION.json"
    if vf.exists():
        try:
            return json.loads(vf.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"version": "2.4.0", "pwa_cache_version": "lamla-cache-v4-20261106"}


def run_live_checks(
    base_url: str,
    expected_version: str,
    expected_commit: str = "",
    expected_sw_cache: str = "lamla-cache-v4-20261106",
) -> Tuple[bool, bool, List[Tuple[str, bool, str]]]:
    """
    Returns (infrastructure_healthy, version_synchronized, detailed_results).
    """
    base = base_url.rstrip("/")
    results: List[Tuple[str, bool, str]] = []
    session = requests.Session()
    session.headers.update({"User-Agent": "LAMLA-Production-Verifier/2.4"})

    # 1. Health Endpoint (Python Unified Server)
    live_version = None
    live_commit = None
    try:
        r = session.get(f"{base}/health", timeout=25)
        ok = r.status_code == 200 and r.json().get("status") == "healthy"
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        live_version = body.get("version")
        live_commit = body.get("commit_sha")
        results.append((
            "GET /health (Unified Python Server)",
            ok,
            f"HTTP {r.status_code} | status={body.get('status')} | mode={body.get('provider_mode')} | model={body.get('active_model')} | version={live_version or 'legacy (<2.4.0)'} | commit={live_commit or 'untracked'}",
        ))
    except Exception as exc:
        results.append(("GET /health (Unified Python Server)", False, f"ERROR: {exc}"))
        return False, False, results

    # 2. Version Tracking Endpoint (/api/version)
    version_synced = False
    try:
        rv = session.get(f"{base}/api/version", timeout=20)
        if rv.status_code == 200 and rv.headers.get("content-type", "").startswith("application/json"):
            vdata = rv.json()
            live_version = vdata.get("version", live_version)
            live_commit = vdata.get("commit_sha", live_commit)
            ver_match = str(live_version) == str(expected_version)
            commit_match = True
            if expected_commit and live_commit and live_commit != "prebuilt-docker":
                short_exp = expected_commit[:7].lower()
                short_live = str(live_commit)[:7].lower()
                commit_match = short_exp == short_live
            version_synced = ver_match and commit_match
            results.append((
                "GET /api/version (Release Sync)",
                version_synced,
                f"HTTP 200 | live_version={live_version} (expected {expected_version}) | live_commit={live_commit} | next_build_id={vdata.get('next_build_id')}",
            ))
        else:
            results.append((
                "GET /api/version (Release Sync)",
                False,
                f"HTTP {rv.status_code} — Live server is still running a pre-2.4.0 container image",
            ))
    except Exception as exc:
        results.append(("GET /api/version (Release Sync)", False, f"ERROR: {exc}"))

    # 3. Frontend Landing Page & Security Headers
    try:
        r_home = session.get(f"{base}/", timeout=20)
        has_hsts = "strict-transport-security" in {k.lower() for k in r_home.headers.keys()}
        ok_home = r_home.status_code == 200 and "LAMLA" in r_home.text and has_hsts
        results.append((
            "GET / (Frontend Landing & Security Headers)",
            ok_home,
            f"HTTP {r_home.status_code} | HSTS={has_hsts} | bytes={len(r_home.text)}",
        ))
    except Exception as exc:
        results.append(("GET / (Frontend Landing & Security Headers)", False, f"ERROR: {exc}"))

    # 4. Dashboard Route & Privacy Headers
    try:
        r_dash = session.get(f"{base}/dashboard", timeout=20)
        x_robots = r_dash.headers.get("X-Robots-Tag", "")
        ok_dash = r_dash.status_code == 200
        results.append((
            "GET /dashboard (Student Workspace Shell)",
            ok_dash,
            f"HTTP {r_dash.status_code} | X-Robots-Tag='{x_robots or 'pending-deploy'}'",
        ))
    except Exception as exc:
        results.append(("GET /dashboard (Student Workspace Shell)", False, f"ERROR: {exc}"))

    # 5. Service Worker Cache Version (/sw.js)
    try:
        r_sw = session.get(f"{base}/sw.js", timeout=20)
        sw_synced = r_sw.status_code == 200 and expected_sw_cache in r_sw.text
        detected_cache = "unknown"
        for line in r_sw.text.splitlines():
            if "CACHE_NAME" in line:
                detected_cache = line.strip()
                break
        results.append((
            "GET /sw.js (PWA Cache Synchronization)",
            sw_synced,
            f"HTTP {r_sw.status_code} | {detected_cache} (expected '{expected_sw_cache}')",
        ))
        if not sw_synced:
            version_synced = False
    except Exception as exc:
        results.append(("GET /sw.js (PWA Cache Synchronization)", False, f"ERROR: {exc}"))
        version_synced = False

    # 6. Multi-User Security Gate on Python AI Backend (Unauthenticated POST must return 401)
    try:
        r_sec_py = session.post(
            f"{base}/api/generate-summary",
            json={"content": "Test unauthorized request"},
            timeout=20,
        )
        sec_py_ok = r_sec_py.status_code == 401
        results.append((
            "POST /api/generate-summary (Unauthenticated -> 401)",
            sec_py_ok,
            f"HTTP {r_sec_py.status_code} {'(Strict Auth Active)' if sec_py_ok else '(Legacy pre-cc5470c endpoint active on live server)'}",
        ))
        if not sec_py_ok:
            version_synced = False
    except Exception as exc:
        results.append(("POST /api/generate-summary (Unauthenticated -> 401)", False, f"ERROR: {exc}"))
        version_synced = False

    # 7. Multi-User Security Gate on Next.js /api/ai Gateway
    try:
        r_sec_next = session.post(
            f"{base}/api/ai",
            json={"action": "summary", "content": "Test unauthorized request"},
            timeout=20,
        )
        sec_next_ok = r_sec_next.status_code == 401
        results.append((
            "POST /api/ai (Next.js Gateway Unauthenticated -> 401)",
            sec_next_ok,
            f"HTTP {r_sec_next.status_code} {'(Strict Auth Active)' if sec_next_ok else '(Legacy pre-cc5470c gateway active on live server)'}",
        ))
        if not sec_next_ok:
            version_synced = False
    except Exception as exc:
        results.append(("POST /api/ai (Next.js Gateway Unauthenticated -> 401)", False, f"ERROR: {exc}"))
        version_synced = False

    infra_ok = results[0][1] and results[2][1] and results[3][1]
    return infra_ok, version_synced, results


def main() -> int:
    local_meta = load_local_version()
    parser = argparse.ArgumentParser(description="Verify live LAMLA Guide AI production deployment.")
    parser.add_argument("--url", default=local_meta.get("production_domain", "https://lamla-guide-ai.onrender.com"))
    parser.add_argument("--expected-version", default=local_meta.get("version", "2.4.0"))
    parser.add_argument("--expected-commit", default="")
    parser.add_argument("--wait-seconds", type=int, default=0, help="Poll until synced or timeout")
    args = parser.parse_args()

    deadline = time.monotonic() + max(0, args.wait_seconds)
    attempt = 0

    while True:
        attempt += 1
        infra_ok, synced, results = run_live_checks(
            base_url=args.url,
            expected_version=args.expected_version,
            expected_commit=args.expected_commit,
            expected_sw_cache=local_meta.get("pwa_cache_version", "lamla-cache-v4-20261106"),
        )
        if synced or time.monotonic() >= deadline:
            break
        remaining = int(deadline - time.monotonic())
        print(f"[Attempt {attempt}] Live site healthy={infra_ok}, version_synced={synced}. Waiting 30s ({remaining}s left)...")
        time.sleep(30)

    print("=" * 78)
    print(f"LAMLA GUIDE AI — LIVE PRODUCTION VERIFICATION REPORT ({args.url})")
    print("=" * 78)
    for name, passed, detail in results:
        status_str = "PASS" if passed else "MISMATCH"
        print(f"[{status_str:8s}] {name}\n           -> {detail}")
    print("-" * 78)
    if synced:
        print(f"PRODUCTION CONFIRMATION: VERIFIED LIVE (v{args.expected_version})")
        return 0
    print(
        f"PRODUCTION CONFIRMATION: INFRASTRUCTURE {'UP' if infra_ok else 'DOWN'}, "
        f"BUT LIVE CONTAINER HAS NOT UPDATED TO v{args.expected_version} YET."
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
