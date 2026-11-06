# ==============================================================================
# LAMLA Guide AI — Unified All-In-One Container (Python AI + Website as ONE)
# Works out of the box on Render (Free Docker), Hugging Face Spaces, Koyeb,
# Railway, or any Linux container host.
# ==============================================================================
FROM node:20-bookworm-slim AS node_base

FROM python:3.11-slim-bookworm

# Copy Node.js 20 runtime & npm into Python 3.11 image so everything runs as ONE
COPY --from=node_base /usr/local/bin/node /usr/local/bin/node
COPY --from=node_base /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

WORKDIR /app

# 1. Install Python AI & WebSocket dependencies
COPY python_ai/requirements.txt ./python_ai/requirements.txt
RUN pip install --no-cache-dir -r python_ai/requirements.txt

# 2. Install Website Node dependencies
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# 3. Copy unified application source
COPY . .

# Public build-time environment variables ONLY (server secrets such as
# SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY are injected strictly at runtime
# via Render / host environment variables and NEVER baked into the image).
ARG RENDER_GIT_COMMIT=""
ARG NEXT_PUBLIC_SUPABASE_URL=https://lsisntjpiscwnwdqbebo.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzaXNudGpwaXNjd253ZHFiZWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTAyMzksImV4cCI6MjEwNzEyNjIzOX0.CAHFOOexNM3yci3r6UmIOvgm1fwafzYcG2M34ktcY6g
ARG NEXT_PUBLIC_ADMIN_SUPPORT_EMAIL=bismarkanadjei@gmail.com
ARG NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER=233539337142
ARG NEXT_PUBLIC_ADMIN_WHATSAPP_DISPLAY=0539337142

ENV GIT_COMMIT_SHA=$RENDER_GIT_COMMIT \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_ADMIN_SUPPORT_EMAIL=$NEXT_PUBLIC_ADMIN_SUPPORT_EMAIL \
    NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER=$NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER \
    NEXT_PUBLIC_ADMIN_WHATSAPP_DISPLAY=$NEXT_PUBLIC_ADMIN_WHATSAPP_DISPLAY \
    NEXT_TELEMETRY_DISABLED=1 \
    LAMLA_LOW_MEM_BUILD=1 \
    NODE_ENV=production \
    LAMLA_ENV=production \
    PYTHONUNBUFFERED=1

# 4. Pre-build Next.js production bundle with bounded V8 heap & single-worker mode
#    so cloud Docker builders never hit cgroup OOM kills
RUN NODE_OPTIONS="--max-old-space-size=1536" npm run build \
 && mkdir -p /app/.cache/lamla_data \
 && chmod -R 777 /app/.cache

# Runtime memory tuning for 512 MB cloud containers (Python + Next.js child server)
ENV LAMLA_PREBUILT=1 \
    NODE_OPTIONS="--max-old-space-size=256" \
    PORT=7860
EXPOSE 7860

# 5. Launch the unified Python + Website server on $PORT
CMD ["python", "app.py"]
