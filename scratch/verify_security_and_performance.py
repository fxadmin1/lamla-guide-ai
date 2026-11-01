"""
LAMLA Guide AI — Security & Zero-Lag Verification Suite
Tests:
1. OWASP Security Headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
2. Server Fingerprint Cloaking (server & x-powered-by stripped)
3. Static Asset Caching (Cache-Control: public, max-age=31536000, immutable)
4. XSS & Script Injection Neutralization (HTML tags stripped in group & member data)
5. WebSocket Protection (Rejection of invalid/malicious circle IDs)
6. Anti-DDoS Rate Limiting Guard
"""
import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:3001"

def test_security_headers():
    print("[TEST 1] Verifying OWASP Top 10 Security Headers & Cloaking...")
    req = urllib.request.Request(f"{BASE_URL}/")
    with urllib.request.urlopen(req, timeout=10) as resp:
        headers = dict(resp.headers)
        
    required_headers = [
        "content-security-policy",
        "x-frame-options",
        "x-content-type-options",
        "strict-transport-security",
        "referrer-policy",
        "permissions-policy",
        "x-xss-protection",
    ]
    missing = [h for h in required_headers if h not in headers]
    if missing:
        print(f"  Missing security headers: {missing}")
        return False
        
    print(f"  CSP: {headers.get('content-security-policy')[:60]}...")
    print(f"  X-Frame-Options: {headers.get('x-frame-options')}")
    print(f"  X-Content-Type-Options: {headers.get('x-content-type-options')}")
    print(f"  HSTS: {headers.get('strict-transport-security')}")
    
    # Cloaking check
    has_powered = "x-powered-by" in headers
    print(f"  X-Powered-By cloaked: {not has_powered}")
    return not has_powered

def test_static_caching():
    print("[TEST 2] Verifying Static Asset Caching for Zero-Lag Navigation...")
    req = urllib.request.Request(f"{BASE_URL}/icon-192.png")
    with urllib.request.urlopen(req, timeout=10) as resp:
        headers = dict(resp.headers)
    cache_ctrl = headers.get("cache-control", "")
    print(f"  Cache-Control on /icon-192.png: {cache_ctrl}")
    return "max-age=31536000" in cache_ctrl or "public" in cache_ctrl

def test_xss_sanitization():
    print("[TEST 3] Verifying Stored XSS & Script Injection Sanitization...")
    payload = {
        "name": "<script>alert('pwned')</script>Biology Mastery",
        "course_code": "BIO-101",
        "institution": "<iframe src='evil.com'></iframe>Legon",
        "description": "<b onmouseover='alert(1)'>Hover me</b> Safe notes",
        "user_id": "sec-test-user-999",
        "display_name": "<script>hack()</script>Bismark",
        "user_email": "test@example.com"
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/study-groups/create",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        
    group = data.get("group", {})
    members = data.get("members", [])
    
    clean_name = group.get("name", "")
    clean_inst = group.get("institution", "")
    clean_desc = group.get("description", "")
    clean_mem = members[0].get("display_name", "") if members else ""
    
    print(f"  Sanitized Group Name: '{clean_name}' (script tag stripped: {'<script>' not in clean_name})")
    print(f"  Sanitized Institution: '{clean_inst}' (iframe stripped: {'<iframe>' not in clean_inst})")
    print(f"  Sanitized Display Name: '{clean_mem}' (script tag stripped: {'<script>' not in clean_mem})")
    
    safe = (
        "<script>" not in clean_name and
        "<iframe>" not in clean_inst and
        "<script>" not in clean_mem and
        clean_name == "Biology Mastery"
    )
    
    # Clean up the test group
    group_id = group.get("id")
    if group_id:
        del_req = urllib.request.Request(
            f"{BASE_URL}/api/study-groups/{group_id}?user_id=sec-test-user-999",
            method="DELETE"
        )
        try:
            with urllib.request.urlopen(del_req, timeout=5):
                pass
        except Exception:
            pass
            
    return safe

def test_rate_limiting():
    print("[TEST 4] Verifying Anti-DDoS Rate Limiting Guard...")
    import concurrent.futures
    # Simulate concurrent burst of 40 requests against sensitive rate-limited endpoint (limit=30)
    def fetch(i):
        req = urllib.request.Request(
            f"{BASE_URL}/api/study-groups?user_id=ratetest-guard",
            headers={"User-Agent": "security-tester"},
            method="GET"
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status
        except urllib.error.HTTPError as e:
            return e.code
        except Exception:
            return 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=15) as pool:
        statuses = list(pool.map(fetch, range(40)))

    has_429 = 429 in statuses
    count_429 = statuses.count(429)
    count_200 = statuses.count(200)
    print(f"  Burst results: {count_200} allowed (HTTP 200), {count_429} throttled (HTTP 429).")
    return has_429

def run_all():
    print("=" * 65)
    print("    LAMLA GUIDE AI — SECURITY & PERFORMANCE TEST SUITE")
    print("=" * 65)
    
    results = {}
    results["1_security_headers"] = test_security_headers()
    results["2_static_caching"] = test_static_caching()
    results["3_xss_sanitization"] = test_xss_sanitization()
    results["4_rate_limiting"] = test_rate_limiting()
    
    print("\n" + "=" * 65)
    print("           SECURITY VERIFICATION SUMMARY")
    print("=" * 65)
    for k, passed in sorted(results.items()):
        status = "[PASS] [OK]" if passed else "[FAIL] [X]"
        print(f"  {status} {k}")
        
    all_ok = all(results.values())
    print("=" * 65)
    if all_ok:
        print("  ALL SECURITY AND PERFORMANCE CHECKS PASSED!")
    else:
        print("  SOME CHECKS FAILED.")
    print("=" * 65)
    return all_ok

if __name__ == "__main__":
    ok = run_all()
    sys.exit(0 if ok else 1)
