"""
LAMLA Guide AI — Unified Single-Server Application (Python AI + Website as ONE)
"It's Never Too Late To Study."

Run everything (Python AI Engine + Live Synced Group Quiz WebSockets + Next.js Website)
as ONE unified server on ONE port with a single command:

    python app.py

Flags / Environment:
  - PORT (default 3001 locally, or automatically set by Render / Hugging Face Spaces / Railway)
  - --dev   : Run Next.js in hot-reload development mode instead of production mode
  - --build : Force a fresh Next.js production build before starting
"""

import os
import sys
import time
import atexit
import shutil
import signal
import asyncio
import subprocess
from pathlib import Path
from contextlib import asynccontextmanager

import httpx
import uvicorn
from fastapi import Request, Response
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from starlette.background import BackgroundTask
from starlette.middleware.base import BaseHTTPMiddleware

ROOT_DIR = Path(__file__).resolve().parent
os.chdir(ROOT_DIR)
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def load_env_files():
    """Load .env and .env.local into os.environ without overriding explicit host env vars."""
    file_vars = {}
    for name in (".env", ".env.local"):
        path = ROOT_DIR / name
        if path.exists():
            for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k:
                    file_vars[k] = v
    for k, v in file_vars.items():
        if k not in os.environ:
            os.environ[k] = v


load_env_files()

DEV_MODE = "--dev" in sys.argv or os.environ.get("LAMLA_DEV") == "1"
FORCE_BUILD = "--build" in sys.argv

PUBLIC_PORT = int(os.environ.get("PORT", "3001"))
NEXT_INTERNAL_PORT = int(
    os.environ.get("NEXT_INTERNAL_PORT", "3002" if PUBLIC_PORT != 3002 else "3003")
)

# Point Next.js API routes directly back into THIS unified Python server
os.environ["PYTHON_AI_URL"] = f"http://127.0.0.1:{PUBLIC_PORT}"

# Import the FastAPI app (with AI endpoints & Live Quiz Hub already mounted)
from python_ai.api_server import app as unified_app  # noqa: E402

_next_proc: subprocess.Popen | None = None
_http_client: httpx.AsyncClient | None = None

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-encoding",
    "content-length",
}


def _find_node() -> str:
    node_path = shutil.which("node")
    if not node_path:
        raise RuntimeError("Node.js ('node') was not found on PATH. Install Node.js 20+ to run the website.")
    return node_path


def _is_build_stale(build_id_path: Path) -> bool:
    """Return True if any source file in src/ or next.config.ts is newer than .next/BUILD_ID."""
    try:
        build_mtime = build_id_path.stat().st_mtime
        cfg_file = ROOT_DIR / "next.config.ts"
        if cfg_file.exists() and cfg_file.stat().st_mtime > build_mtime:
            return True
        src_dir = ROOT_DIR / "src"
        if src_dir.exists():
            for p in src_dir.rglob("*"):
                if p.is_file() and p.stat().st_mtime > build_mtime:
                    return True
    except OSError:
        return True
    return False


def ensure_nextjs_build():
    """Ensure .next production build exists and is up to date before launching next start."""
    if DEV_MODE:
        return
    build_id = ROOT_DIR / ".next" / "BUILD_ID"
    if build_id.exists() and not FORCE_BUILD and not _is_build_stale(build_id):
        return

    node_bin = _find_node()
    next_cli = ROOT_DIR / "node_modules" / "next" / "dist" / "bin" / "next"
    print("[LAMLA Unified] Building Next.js production bundle...")
    env = os.environ.copy()
    env["NEXT_TELEMETRY_DISABLED"] = "1"
    res = subprocess.run([node_bin, str(next_cli), "build", "--webpack"], cwd=str(ROOT_DIR), env=env)
    if res.returncode != 0:
        # Retry once automatically if Next.js printed a one-time notice
        res = subprocess.run([node_bin, str(next_cli), "build", "--webpack"], cwd=str(ROOT_DIR), env=env)
        if res.returncode != 0:
            raise RuntimeError(f"Next.js production build failed with exit code {res.returncode}")


async def _wait_for_port(host: str, port: int, timeout_sec: float = 30.0):
    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        if _next_proc is not None and _next_proc.poll() is not None:
            raise RuntimeError(f"Internal Next.js process exited unexpectedly with code {_next_proc.returncode}")
        try:
            _, writer = await asyncio.open_connection(host, port)
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            return
        except OSError:
            await asyncio.sleep(0.2)
    raise TimeoutError(f"Timed out waiting for internal Next.js server on {host}:{port}")


def _stop_next_process():
    global _next_proc
    if _next_proc is None:
        return
    if _next_proc.poll() is None:
        try:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(_next_proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                _next_proc.terminate()
                _next_proc.wait(timeout=5)
        except Exception:
            try:
                _next_proc.kill()
            except Exception:
                pass
    _next_proc = None


atexit.register(_stop_next_process)

_watchdog_task: asyncio.Task | None = None


def _spawn_next_process() -> subprocess.Popen:
    node_bin = _find_node()
    next_cli = ROOT_DIR / "node_modules" / "next" / "dist" / "bin" / "next"

    child_env = os.environ.copy()
    child_env["PORT"] = str(NEXT_INTERNAL_PORT)
    child_env["PUBLIC_PORT"] = str(PUBLIC_PORT)
    child_env["HOSTNAME"] = "127.0.0.1"
    child_env["PYTHON_AI_URL"] = f"http://127.0.0.1:{PUBLIC_PORT}"
    child_env["NEXT_TELEMETRY_DISABLED"] = "1"

    if DEV_MODE:
        cmd = [node_bin, str(next_cli), "dev", "--webpack", "-p", str(NEXT_INTERNAL_PORT), "-H", "127.0.0.1"]
        mode_label = "DEVELOPMENT"
    else:
        cmd = [node_bin, str(next_cli), "start", "-p", str(NEXT_INTERNAL_PORT), "-H", "127.0.0.1"]
        mode_label = "PRODUCTION"

    print(f"[LAMLA Unified] Starting internal Next.js ({mode_label}) on 127.0.0.1:{NEXT_INTERNAL_PORT}...")
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    return subprocess.Popen(cmd, cwd=str(ROOT_DIR), env=child_env, creationflags=creationflags)


async def _watchdog_and_keepalive_loop():
    """
    24/7 Uninterrupted Uptime Guardian:
      1. Monitors internal Next.js child process every 15s and auto-restarts it if it ever exits.
      2. Pings the external public URL (/health) every 8 minutes when deployed on Render/cloud
         so the container stays warm 24/7 alongside UptimeRobot.
    """
    global _next_proc
    last_external_ping = time.monotonic()
    while True:
        try:
            await asyncio.sleep(15.0)
            # 1. Self-healing process check
            if _next_proc is not None and _next_proc.poll() is not None:
                print(
                    f"[LAMLA 24/7 Watchdog] Internal Next.js exited (code {_next_proc.returncode}). "
                    "Auto-restarting immediately..."
                )
                _next_proc = _spawn_next_process()
                await _wait_for_port("127.0.0.1", NEXT_INTERNAL_PORT, timeout_sec=30.0)
                print("[LAMLA 24/7 Watchdog] Internal Next.js recovered and healthy.")

            # 2. External keep-alive ping every 8 minutes (480s) if public URL is configured
            now = time.monotonic()
            if now - last_external_ping >= 480.0:
                last_external_ping = now
                public_url = (
                    os.environ.get("PUBLIC_APP_URL")
                    or os.environ.get("RENDER_EXTERNAL_URL")
                    or (f"https://{os.environ['SPACE_HOST']}" if os.environ.get("SPACE_HOST") else "")
                ).strip().rstrip("/")
                if public_url and public_url.startswith("http"):
                    async with httpx.AsyncClient(timeout=10.0) as ping_client:
                        await ping_client.get(f"{public_url}/health", headers={"User-Agent": "LAMLA-24x7-KeepAlive/1.0"})
        except asyncio.CancelledError:
            break
        except Exception:
            pass


@asynccontextmanager
async def _unified_lifespan(app_instance):
    global _next_proc, _http_client, _watchdog_task

    ensure_nextjs_build()
    _next_proc = _spawn_next_process()

    await _wait_for_port("127.0.0.1", NEXT_INTERNAL_PORT, timeout_sec=45.0 if DEV_MODE else 25.0)

    _http_client = httpx.AsyncClient(
        base_url=f"http://127.0.0.1:{NEXT_INTERNAL_PORT}",
        follow_redirects=False,
        timeout=httpx.Timeout(300.0, connect=15.0),
        limits=httpx.Limits(max_connections=500, max_keepalive_connections=120),
    )
    try:
        from python_ai.live_quiz_hub import ensure_scheduled_timers_started
        ensure_scheduled_timers_started()
    except Exception:
        pass

    _watchdog_task = asyncio.create_task(_watchdog_and_keepalive_loop())
    print(f"[LAMLA Unified] ALL-IN-ONE SERVER READY (24/7 Watchdog Active) -> http://localhost:{PUBLIC_PORT}")

    try:
        yield
    finally:
        if _watchdog_task is not None:
            _watchdog_task.cancel()
            _watchdog_task = None
        if _http_client is not None:
            await _http_client.aclose()
            _http_client = None
        _stop_next_process()


unified_app.router.lifespan_context = _unified_lifespan


@unified_app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    include_in_schema=False,
)
async def proxy_website_to_nextjs(request: Request, full_path: str):
    """Stream all Website UI, static asset, and Next.js API traffic seamlessly through Python."""
    # Fast direct delivery for static public files (videos, images, downloads)
    local_public_file = ROOT_DIR / "public" / full_path
    if request.method in ("GET", "HEAD") and ".." not in full_path and local_public_file.is_file():
        return FileResponse(str(local_public_file))

    if _http_client is None:
        return Response("Website engine is initializing...", status_code=503)

    target_url = f"/{full_path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    fwd_headers = {}
    for k, v in request.headers.items():
        kl = k.lower()
        if kl in ("host", "connection", "content-length", "transfer-encoding"):
            continue
        fwd_headers[k] = v
    # Request uncompressed bytes over localhost loopback to avoid double gzip/gunzip
    fwd_headers["accept-encoding"] = "identity"
    fwd_headers["x-forwarded-host"] = request.headers.get("host", f"localhost:{PUBLIC_PORT}")

    async def body_stream():
        async for chunk in request.stream():
            yield chunk

    has_body = request.method not in ("GET", "HEAD", "OPTIONS")
    content_len = 0
    try:
        content_len = int(request.headers.get("content-length") or 0)
    except ValueError:
        content_len = 0

    if not has_body:
        req_content = None
    elif content_len < 10_000_000:
        req_content = await request.body()
    else:
        req_content = body_stream()

    upstream_req = _http_client.build_request(
        method=request.method,
        url=target_url,
        headers=fwd_headers,
        content=req_content,
    )
    upstream_resp = await _http_client.send(upstream_req, stream=True)

    response = StreamingResponse(
        upstream_resp.aiter_raw(),
        status_code=upstream_resp.status_code,
        background=BackgroundTask(upstream_resp.aclose),
    )
    for k, v in upstream_resp.headers.multi_items():
        if k.lower() not in HOP_BY_HOP_HEADERS:
            response.headers.append(k, v)
    return response


app = unified_app

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=PUBLIC_PORT, log_level="info")
