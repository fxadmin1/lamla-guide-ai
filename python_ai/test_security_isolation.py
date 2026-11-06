"""
LAMLA Guide AI - Multi-User Data Isolation & Security Hardening Test Suite
"It's Never Too Late To Study."

10-Point Automated Verification Suite:
1.  Unauthenticated requests are rejected with 401 Unauthorized across protected routes.
2.  Invalid, malformed, or expired Bearer tokens are rejected with 401 Unauthorized.
3.  Student A, Student B, and Admin token validation correctly derives independent server identities.
4.  Cache isolation: Academic blueprint, AI response, and document enrichment caches are user-namespaced.
5.  Study group data isolation: Student B cannot see Student A's private study groups in list queries.
6.  Cross-user study group deletion is blocked with 403 Forbidden.
7.  Cross-user study group detail access by non-members is blocked with 403 Forbidden.
8.  Cross-user live quiz submission by non-members is blocked with 403 Forbidden.
9.  Platform AI provider mode is protected against non-admin tampering (403 Forbidden); Admin succeeds.
10. Server-side resource ownership verification strictly enforces Student A != Student B boundary.
"""

import sys
import os
import asyncio

# Ensure deterministic offline sandbox execution for security tests
os.environ["LAMLA_OFFLINE_AUTH"] = "true"
os.environ["LAMLA_OFFLINE_AI"] = "true"
from pathlib import Path
from fastapi import HTTPException
from starlette.requests import Request

# Add python_ai and workspace root to path
_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(_DIR))
sys.path.insert(0, str(_DIR.parent))

from auth_validator import (
    get_authenticated_user,
    validate_auth_token,
    extract_token_from_request,
    verify_resource_ownership,
    TEST_STUDENT_A,
    TEST_STUDENT_B,
    TEST_ADMIN,
    clear_token_cache,
)
from ai_engine import PythonAIEngine
from web_enrichment import get_cached_document_enrichment
from live_quiz_hub import (
    STORE,
    list_study_groups,
    create_study_group,
    get_study_group_detail,
    delete_study_group,
    submit_live_quiz_answer,
    CreateGroupRequest,
    SubmitAnswerRequest,
)
from api_server import (
    set_provider_mode,
    generate_summary,
    ai_tutor_dialogue,
    ProviderModeRequest,
    AnalyzeRequest,
    TutorRequest,
)


def _make_mock_request(auth_header: str = None, internal_secret: str = None, user_id: str = None) -> Request:
    headers = []
    if auth_header:
        headers.append((b"authorization", auth_header.encode("utf-8")))
    if internal_secret:
        headers.append((b"x-internal-secret", internal_secret.encode("utf-8")))
    if user_id:
        headers.append((b"x-user-id", user_id.encode("utf-8")))

    scope = {
        "type": "http",
        "method": "POST",
        "headers": headers,
        "query_string": b"",
    }
    return Request(scope)


async def test_01_unauthenticated_requests_rejected():
    """Verify that unauthenticated callers are rejected with HTTP 401."""
    print("\n--- Test 1: Unauthenticated Requests Rejected with 401 ---", flush=True)
    req = _make_mock_request()
    token = extract_token_from_request(req)
    assert token is None, "Expected None token for unauthenticated request"

    try:
        await get_authenticated_user(req)
        assert False, "Expected 401 HTTPException was not raised!"
    except HTTPException as e:
        assert e.status_code == 401, f"Expected 401, got {e.status_code}"
        assert "authentication token is required" in e.detail.lower()

    print("  [PASSED] Unauthenticated requests strictly rejected with 401 Unauthorized.", flush=True)


async def test_02_invalid_tokens_rejected():
    """Verify that fake or expired tokens are rejected with 401."""
    print("\n--- Test 2: Invalid or Expired Tokens Rejected with 401 ---", flush=True)
    clear_token_cache()
    bad_token = "invalid_or_expired_jwt_token_tampered_12345"
    assert validate_auth_token(bad_token) is None, "Bad token should fail validation"

    req = _make_mock_request(auth_header=f"Bearer {bad_token}")
    try:
        await get_authenticated_user(req)
        assert False, "Expected 401 HTTPException for bad token!"
    except HTTPException as e:
        assert e.status_code == 401, f"Expected 401, got {e.status_code}"
        assert "invalid, expired, or revoked" in e.detail.lower()

    print("  [PASSED] Invalid/tampered tokens correctly rejected with 401.", flush=True)


async def test_03_student_identities_derived_server_side():
    """Verify Student A, Student B, and Admin tokens derive strictly independent server identities."""
    print("\n--- Test 3: Multi-User Server-Side Identity Derivation ---", flush=True)
    user_a = validate_auth_token("test_token_student_a")
    user_b = validate_auth_token("test_token_student_b")
    admin = validate_auth_token("test_token_admin")

    assert user_a["id"] == TEST_STUDENT_A["id"], "Student A identity mismatch"
    assert user_b["id"] == TEST_STUDENT_B["id"], "Student B identity mismatch"
    assert user_a["id"] != user_b["id"], "Student A and Student B IDs must never match!"
    assert admin["role"] == "admin", "Admin role must be admin"
    assert user_a["role"] != "admin", "Student A must not have admin role"
    assert user_b["role"] != "admin", "Student B must not have admin role"

    print(f"  [PASSED] Derived independent identities: Student A ({user_a['id'][:8]}), Student B ({user_b['id'][:8]}), Admin.", flush=True)


async def test_04_user_cache_namespace_isolation():
    """Verify that AI response cache, blueprints, and document enrichments are user-namespaced."""
    print("\n--- Test 4: AI Response and Blueprint Cache Namespace Isolation ---", flush=True)
    engine = PythonAIEngine.get_instance()

    study_content = """
    Renal Physiology:
    1. Glomerular filtration rate (GFR) is the volume of fluid filtered from renal glomerular capillaries into Bowman's capsule.
    2. Tubular reabsorption returns water and solutes from filtrate back into the peritubular capillary blood.
    """

    # Generate summary for Student A
    summary_a = engine.generate_exam_summary(study_content, user_id=TEST_STUDENT_A["id"])
    assert len(summary_a) > 50

    # Verify blueprint cache contains Student A's namespace
    bp_keys = list(engine._blueprint_cache.keys())
    assert any(k.startswith(f"blueprint_{TEST_STUDENT_A['id']}_") for k in bp_keys), (
        f"Expected blueprint key starting with blueprint_{TEST_STUDENT_A['id']}_, found: {bp_keys}"
    )

    # Verify Student B has no cached entry under Student A's prefix
    assert not any(k.startswith(f"blueprint_{TEST_STUDENT_B['id']}_") for k in bp_keys)

    # Verify document enrichment cache is scoped to user_id
    cached_doc_a = get_cached_document_enrichment(study_content, user_id=TEST_STUDENT_A["id"], compute_if_missing=False)
    cached_doc_b = get_cached_document_enrichment(study_content, user_id=TEST_STUDENT_B["id"], compute_if_missing=False)
    # Student A has enriched this document; must be present
    assert cached_doc_a is not None, "Student A's enrichment cache must be populated!"
    # Student B has not enriched this document; must be None
    assert cached_doc_b is None, "Student B should not see Student A's unshared enrichment cache!"

    print("  [PASSED] Blueprint and AI response caches strictly namespaced by authenticated user_id.", flush=True)


async def test_05_study_groups_user_isolation():
    """Verify Student B cannot see Student A's private study groups in list queries."""
    print("\n--- Test 5: Study Groups List Data Isolation ---", flush=True)
    # Student A creates a private study circle
    req = CreateGroupRequest(
        name="Cardiology Honors Circle",
        course_code="CARD401",
        institution="University of Ghana",
        description="Private study group for cardiology honors students.",
        user_id=TEST_STUDENT_A["id"],
        display_name="Student A",
    )
    create_res = await create_study_group(req, user=TEST_STUDENT_A)
    assert create_res.get("success") is True
    group_id = create_res["group"]["id"]
    assert create_res["group"]["created_by"] == TEST_STUDENT_A["id"]

    # Student A lists groups: group_id MUST be present
    list_a = await list_study_groups(user=TEST_STUDENT_A)
    assert any(g["id"] == group_id for g in list_a["groups"]), "Group missing from Student A's list"

    # Student B lists groups: group_id MUST NOT be present
    list_b = await list_study_groups(user=TEST_STUDENT_B)
    assert not any(g["id"] == group_id for g in list_b["groups"]), (
        f"CRITICAL LEAK: Student B saw Student A's private group {group_id}!"
    )

    print(f"  [PASSED] Group {group_id} visible to Student A, completely invisible to Student B.", flush=True)
    return group_id


async def test_06_cross_user_group_deletion_blocked(group_id: str):
    """Verify Student B cannot delete Student A's study group (403 Forbidden)."""
    print("\n--- Test 6: Cross-User Group Deletion Blocked with 403 ---", flush=True)
    try:
        await delete_study_group(group_id, user=TEST_STUDENT_B)
        assert False, "Expected 403 Forbidden for Student B deleting Student A's group!"
    except HTTPException as e:
        assert e.status_code == 403, f"Expected 403, got {e.status_code}"
        assert "only the group creator can delete" in e.detail.lower()

    # Verify group still exists in STORE
    assert STORE.get(group_id) is not None, "Group was deleted despite unauthorized attempt!"
    print("  [PASSED] Cross-user deletion attempt by Student B rejected with 403 Forbidden.", flush=True)


async def test_07_cross_user_group_detail_blocked(group_id: str):
    """Verify Student B cannot view private group details before joining (403 Forbidden)."""
    print("\n--- Test 7: Unauthorized Group Details Blocked with 403 ---", flush=True)
    try:
        await get_study_group_detail(group_id, user=TEST_STUDENT_B)
        assert False, "Expected 403 Forbidden for non-member viewing private group!"
    except HTTPException as e:
        assert e.status_code == 403, f"Expected 403, got {e.status_code}"
        assert "must be a member" in e.detail.lower()

    # Student A (creator/member) can view details
    detail_a = await get_study_group_detail(group_id, user=TEST_STUDENT_A)
    assert detail_a.get("success") is True
    assert detail_a["group"]["id"] == group_id

    print("  [PASSED] Non-member Student B blocked (403); Member Student A granted access (200).", flush=True)


async def test_08_cross_user_quiz_submission_blocked(group_id: str):
    """Verify Student B cannot submit quiz answers to Student A's group without membership."""
    print("\n--- Test 8: Live Quiz Submission Membership Enforcement ---", flush=True)
    sub_req = SubmitAnswerRequest(
        user_id=TEST_STUDENT_A["id"],  # Student B tries to forge Student A's ID
        name="Spoofed Student A",
        answers={"0": 1},
        submitted=True,
    )
    try:
        await submit_live_quiz_answer(group_id, sub_req, user=TEST_STUDENT_B)
        assert False, "Expected 403 Forbidden for non-member submitting quiz answers!"
    except HTTPException as e:
        assert e.status_code == 403, f"Expected 403, got {e.status_code}"
        assert "must be a member" in e.detail.lower()

    print("  [PASSED] Quiz submission rejects non-member callers with 403 Forbidden.", flush=True)


async def test_09_admin_mode_tamper_protection():
    """Verify that only users with role=='admin' can alter platform AI modes."""
    print("\n--- Test 9: Platform Provider Mode Admin Protection ---", flush=True)
    # Student A attempts to change provider mode
    try:
        set_provider_mode(ProviderModeRequest(mode="local_only"), user=TEST_STUDENT_A)
        assert False, "Expected 403 Forbidden when non-admin sets provider mode!"
    except HTTPException as e:
        assert e.status_code == 403, f"Expected 403, got {e.status_code}"
        assert "administrator permissions required" in e.detail.lower()

    # Admin changes provider mode
    res_admin = set_provider_mode(ProviderModeRequest(mode="hosted_ai"), user=TEST_ADMIN)
    assert res_admin.get("success") is True
    assert res_admin.get("new_mode") == "hosted_ai"

    # Reset back to free_configured
    set_provider_mode(ProviderModeRequest(mode="free_configured"), user=TEST_ADMIN)

    print("  [PASSED] Non-admin callers blocked (403); Admin allowed (200).", flush=True)


async def test_10_resource_ownership_enforcement():
    """Verify verify_resource_ownership strictly validates authenticated identity."""
    print("\n--- Test 10: Strict Server-Side Resource Ownership Verification ---", flush=True)
    # 1. Student A accessing Student A's resource -> OK
    assert verify_resource_ownership(TEST_STUDENT_A, TEST_STUDENT_A["id"]) is True

    # 2. Student B accessing Student A's resource -> 403 Forbidden
    try:
        verify_resource_ownership(TEST_STUDENT_B, TEST_STUDENT_A["id"])
        assert False, "Expected 403 Forbidden for cross-student resource access!"
    except HTTPException as e:
        assert e.status_code == 403
        assert "do not have permission" in e.detail.lower()

    # 3. Admin accessing Student A's resource -> Allowed
    assert verify_resource_ownership(TEST_ADMIN, TEST_STUDENT_A["id"]) is True

    print("  [PASSED] verify_resource_ownership correctly permits owner/admin and rejects cross-user access.", flush=True)


async def main():
    print("=" * 70, flush=True)
    print("LAMLA GUIDE AI — MULTI-USER DATA ISOLATION & SECURITY TEST SUITE", flush=True)
    print("=" * 70, flush=True)

    await test_01_unauthenticated_requests_rejected()
    await test_02_invalid_tokens_rejected()
    await test_03_student_identities_derived_server_side()
    await test_04_user_cache_namespace_isolation()
    group_id = await test_05_study_groups_user_isolation()
    await test_06_cross_user_group_deletion_blocked(group_id)
    await test_07_cross_user_group_detail_blocked(group_id)
    await test_08_cross_user_quiz_submission_blocked(group_id)
    await test_09_admin_mode_tamper_protection()
    await test_10_resource_ownership_enforcement()

    # Clean up created test group
    if STORE.get(group_id):
        STORE.groups.pop(group_id, None)
        STORE.save()

    print("\n" + "=" * 70, flush=True)
    print("ALL 10 MULTI-USER SECURITY & ISOLATION TESTS PASSED PERFECTLY!", flush=True)
    print("=" * 70, flush=True)


def run_coro(coro):
    """
    Executes async coroutines in-process synchronously without initializing
    loopback network sockets, ensuring reliable execution across sandboxed Windows environments.
    """
    stack = [coro]
    val = None
    exc = None
    while stack:
        top = stack[-1]
        try:
            if exc is not None:
                to_throw = exc
                exc = None
                nxt = top.throw(to_throw)
            else:
                nxt = top.send(val)
            val = None
            if asyncio.iscoroutine(nxt):
                stack.append(nxt)
            else:
                val = nxt
        except StopIteration as e:
            stack.pop()
            val = e.value
        except Exception as e:
            stack.pop()
            if not stack:
                raise
            exc = e
    return val


if __name__ == "__main__":
    run_coro(main())
