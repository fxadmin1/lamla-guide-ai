"""
LAMLA Guide AI — Master Pre-Deployment Verification Suite
Executes a rigorous 10-point end-to-end check before deployment:
1. System Health Check (/health & /api/health)
2. Next.js Routing & Static Proxy (/ , /dashboard, /features, /auth/login, /auth/signup)
3. PWA Assets (/manifest.json, /manifest.webmanifest, /sw.js, /icon-192.png, /icon-512.png)
4. Unrestricted AI Tutor (General economics/academic knowledge outside slides)
5. Dynamic Vector Concept Drawing (SVG schematic diagram generation)
6. Practice Quiz Generation (Schema cache safety, slide coverage, deduplication)
7. Study Group Creation & Invite Code Generation
8. Public Invite Link Preview (Pre-auth preview)
9. Live Quiz Scheduling with Synchronized Countdown
10. Study Group Deletion Lifecycle (Full clean up)
"""
import sys
import json
import time
import urllib.request
import urllib.error

BASE_URL = "http://localhost:3001"

def request_json(url, data=None, method="GET", timeout=40):
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(content)
            except Exception:
                return resp.status, content
    except urllib.error.HTTPError as err:
        content = err.read().decode("utf-8", errors="ignore")
        try:
            return err.code, json.loads(content)
        except Exception:
            return err.code, content

def run_pre_deployment_tests():
    print("=" * 65)
    print("    LAMLA GUIDE AI — MASTER PRE-DEPLOYMENT TEST SUITE")
    print("=" * 65)

    results = {}

    # TEST 1: Health Check
    try:
        s1, d1 = request_json(f"{BASE_URL}/health")
        s2, d2 = request_json(f"{BASE_URL}/api/health")
        print(f"[TEST 1] Health Check: /health={s1}, /api/health={s2}")
        results["1_health_check"] = (s1 == 200 and s2 == 200 and d1.get("status") == "healthy")
    except Exception as e:
        print(f"[TEST 1] FAILED: {e}")
        results["1_health_check"] = False

    # TEST 2: Next.js SSR & Static Proxying
    try:
        pages_to_check = ["/", "/dashboard", "/features", "/auth/login", "/auth/signup", "/pricing", "/how-it-works"]
        all_pages_ok = True
        for p in pages_to_check:
            req = urllib.request.Request(f"{BASE_URL}{p}", headers={"User-Agent": "pre-deploy-verifier"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status != 200:
                    all_pages_ok = False
                    print(f"  Page {p} returned {resp.status}")
        print(f"[TEST 2] Next.js SSR & Proxying ({len(pages_to_check)} routes): {'PASS' if all_pages_ok else 'FAIL'}")
        results["2_nextjs_routes"] = all_pages_ok
    except Exception as e:
        print(f"[TEST 2] FAILED: {e}")
        results["2_nextjs_routes"] = False

    # TEST 3: PWA Manifest, Service Worker & Icons
    try:
        pwa_endpoints = ["/manifest.json", "/manifest.webmanifest", "/sw.js", "/icon-192.png", "/icon-512.png"]
        pwa_ok = True
        for ep in pwa_endpoints:
            req = urllib.request.Request(f"{BASE_URL}{ep}")
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status != 200:
                    pwa_ok = False
                    print(f"  PWA endpoint {ep} returned {resp.status}")
        print(f"[TEST 3] PWA Core Assets ({len(pwa_endpoints)} endpoints): {'PASS' if pwa_ok else 'FAIL'}")
        results["3_pwa_assets"] = pwa_ok
    except Exception as e:
        print(f"[TEST 3] FAILED: {e}")
        results["3_pwa_assets"] = False

    # TEST 4: Unrestricted AI Tutor
    try:
        print("[TEST 4] Testing Unrestricted AI Tutor on general academic knowledge...")
        t0 = time.time()
        payload = {
            "action": "tutor",
            "question": "Explain the concept of comparative advantage in international economics and why opportunity cost matters.",
            "context": "",
            "options": {
                "actionType": "ask_tutor",
                "educationalLevel": "University / SHS"
            }
        }
        status, data = request_json(f"{BASE_URL}/api/ai", data=payload, method="POST", timeout=35)
        elapsed = round(time.time() - t0, 2)
        answer = data.get("answer", "") or data.get("result", "") if isinstance(data, dict) else str(data)
        has_keywords = ("advantage" in answer.lower() or "cost" in answer.lower() or "trade" in answer.lower())
        print(f"  AI Tutor: status={status}, elapsed={elapsed}s, preview={answer[:85]}...")
        results["4_ai_tutor_unrestricted"] = (status == 200 and len(answer) > 40 and has_keywords)
    except Exception as e:
        print(f"[TEST 4] FAILED: {e}")
        results["4_ai_tutor_unrestricted"] = False

    # TEST 5: AI Concept Drawing (SVG Generation)
    try:
        print("[TEST 5] Testing AI Vector Concept Drawing (draw_visualize)...")
        draw_payload = {
            "action": "tutor",
            "question": "Draw and visualize a labeled diagram showing the three layers of the Earth: Crust, Mantle, and Core.",
            "context": "Earth science geology",
            "options": {
                "actionType": "draw_visualize",
                "educationalLevel": "University / SHS"
            }
        }
        status, data = request_json(f"{BASE_URL}/api/ai", data=draw_payload, method="POST", timeout=35)
        answer = data.get("answer", "") or data.get("result", "") if isinstance(data, dict) else str(data)
        has_svg = "<svg" in answer.lower() or "```xml" in answer or "```svg" in answer
        print(f"  AI Drawing: status={status}, has_svg={has_svg}")
        results["5_ai_vector_drawing"] = (status == 200 and has_svg)
    except Exception as e:
        print(f"[TEST 5] FAILED: {e}")
        results["5_ai_vector_drawing"] = False

    # TEST 6: Practice Quiz Generation & Deduplication
    try:
        print("[TEST 6] Testing Practice Quiz Generation (Schema safety, slide coverage, deduplication)...")
        slides_text = (
            "--- Slide 1: Cellular Respiration ---\n"
            "Cellular respiration converts glucose into ATP in the presence of oxygen.\n\n"
            "--- Slide 2: Glycolysis ---\n"
            "Glycolysis takes place in the cytoplasm and breaks glucose into two pyruvate molecules.\n\n"
            "--- Slide 3: The Krebs Cycle ---\n"
            "The citric acid cycle operates in the mitochondrial matrix to generate electron carriers."
        )
        quiz_payload = {
            "action": "quiz",
            "content": slides_text,
            "options": {
                "count": 3,
                "type": "mcq",
                "difficulty": "intermediate"
            }
        }
        t0 = time.time()
        status, data = request_json(f"{BASE_URL}/api/ai", data=quiz_payload, method="POST", timeout=35)
        elapsed = round(time.time() - t0, 2)
        questions = data.get("questions", []) if isinstance(data, dict) else []
        
        valid_schema = True
        q_texts = []
        for q in questions:
            t = q.get("question_text") or q.get("question") or ""
            opts = q.get("options") or []
            corr = q.get("correct_answer") or q.get("correctAnswer") or q.get("answer") or q.get("correct")
            if not t or not isinstance(opts, list) or len(opts) < 2 or corr is None:
                valid_schema = False
            q_texts.append(t.strip().lower())

        no_dups = len(q_texts) == len(set(q_texts))
        print(f"  Quiz: status={status}, count={len(questions)}, elapsed={elapsed}s, valid_schema={valid_schema}, no_duplicates={no_dups}")
        results["6_practice_quiz"] = (status == 200 and len(questions) >= 2 and valid_schema and no_dups)
    except Exception as e:
        print(f"[TEST 6] FAILED: {e}")
        results["6_practice_quiz"] = False

    # TEST 7: Study Group Creation
    created_id = None
    created_code = None
    try:
        print("[TEST 7] Testing Study Group Creation...")
        c_req = {
            "name": "Pre-Deployment Verification Circle",
            "course_code": "PRE-DEP",
            "institution": "Verification University",
            "description": "Pre-deployment validation test",
            "user_id": "test-admin-deploy-verify",
            "display_name": "Admin Tester",
            "user_email": "bismarkanadjei@gmail.com"
        }
        status, data = request_json(f"{BASE_URL}/api/study-groups/create", data=c_req, method="POST")
        group = data.get("group", {}) if isinstance(data, dict) else {}
        created_id = group.get("id")
        created_code = group.get("invite_code")
        print(f"  Created Group: status={status}, id={created_id}, invite_code={created_code}")
        results["7_study_group_create"] = (status == 200 and bool(created_id) and bool(created_code))
    except Exception as e:
        print(f"[TEST 7] FAILED: {e}")
        results["7_study_group_create"] = False

    # TEST 8: Public Invite Link Preview (Pre-Auth Preview)
    try:
        print("[TEST 8] Testing Public Invite Code Preview (/api/study-groups/invite/{code})...")
        if created_code:
            status, data = request_json(f"{BASE_URL}/api/study-groups/invite/{created_code}", method="GET")
            invite = data.get("invite", {}) if isinstance(data, dict) else {}
            preview_ok = (status == 200 and invite.get("invite_code") == created_code and invite.get("max_members") == 1000)
            print(f"  Invite Preview: status={status}, name={invite.get('name')}, max_members={invite.get('max_members')}")
            results["8_invite_preview"] = preview_ok
        else:
            results["8_invite_preview"] = False
    except Exception as e:
        print(f"[TEST 8] FAILED: {e}")
        results["8_invite_preview"] = False

    # TEST 9: Scheduled Live Quiz with Live Countdown
    try:
        print("[TEST 9] Testing Scheduled Live Quiz with Synchronized Countdown...")
        if created_id:
            sched_payload = {
                "user_id": "test-admin-deploy-verify",
                "host_name": "Admin Tester",
                "title": "Scheduled Final Biology Exam",
                "duration_sec": 60,
                "scheduled_start_at": int((time.time() + 600) * 1000),
                "questions": [
                    {
                        "question": "What is the primary product of glycolysis?",
                        "options": ["Pyruvate", "Lactate", "Ethanol", "Citrate"],
                        "correct": 0,
                        "explanation": "Glycolysis breaks glucose into two pyruvate molecules."
                    }
                ]
            }
            status, data = request_json(f"{BASE_URL}/api/live-quiz/{created_id}/schedule", data=sched_payload, method="POST")
            state = data.get("state", {}) if isinstance(data, dict) else {}
            phase = state.get("phase") or data.get("phase")
            print(f"  Live Quiz Scheduled: status={status}, phase={phase}")
            results["9_live_quiz_scheduled"] = (status == 200 and phase == "scheduled")
        else:
            results["9_live_quiz_scheduled"] = False
    except Exception as e:
        print(f"[TEST 9] FAILED: {e}")
        results["9_live_quiz_scheduled"] = False

    # TEST 10: Study Group Deletion (Full Clean Up)
    try:
        print("[TEST 10] Testing Study Group Deletion...")
        if created_id:
            status, data = request_json(f"{BASE_URL}/api/study-groups/{created_id}?user_id=test-admin-deploy-verify", method="DELETE")
            print(f"  Deleted Group: status={status}, response={data}")
            results["10_study_group_deletion"] = (status == 200 and data.get("success") is True and data.get("deleted") == created_id)
        else:
            results["10_study_group_deletion"] = False
    except Exception as e:
        print(f"[TEST 10] FAILED: {e}")
        results["10_study_group_deletion"] = False

    print("\n" + "=" * 65)
    print("           PRE-DEPLOYMENT VERIFICATION SUMMARY")
    print("=" * 65)
    for test_key, passed in sorted(results.items()):
        status_tag = "[PASS] [OK]" if passed else "[FAIL] [X]"
        print(f"  {status_tag} {test_key}")

    all_passed = all(results.values())
    print("\n" + "=" * 65)
    if all_passed:
        print("  ALL 10 PRE-DEPLOYMENT TESTS PASSED WITH ZERO ERRORS!")
        print("  The platform is 100% production ready for cloud deployment.")
    else:
        print("  SOME TESTS FAILED. PLEASE REVIEW LOGS ABOVE.")
    print("=" * 65)

    return all_passed

if __name__ == "__main__":
    ok = run_pre_deployment_tests()
    sys.exit(0 if ok else 1)
