# ==============================================================================
# LAMLA Guide AI — Unified All-In-One Container (Python AI + Website as ONE)
# Works out of the box on Hugging Face Spaces (Free Docker), Render (Free Docker),
# Koyeb (Free Docker), Railway, or any VPS.
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

# Public build-time environment variables for Next.js client bundle
ARG NEXT_PUBLIC_SUPABASE_URL=https://lsisntjpiscwnwdqbebo.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzaXNudGpwaXNjd253ZHFiZWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTAyMzksImV4cCI6MjEwNzEyNjIzOX0.CAHFOOexNM3yci3r6UmIOvgm1fwafzYcG2M34ktcY6g
ARG NEXT_PUBLIC_ADMIN_SUPPORT_EMAIL=bismarkanadjei@gmail.com
ARG NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER=233539337142
ARG NEXT_PUBLIC_ADMIN_WHATSAPP_DISPLAY=0539337142

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_ADMIN_SUPPORT_EMAIL=$NEXT_PUBLIC_ADMIN_SUPPORT_EMAIL \
    NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER=$NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER \
    NEXT_PUBLIC_ADMIN_WHATSAPP_DISPLAY=$NEXT_PUBLIC_ADMIN_WHATSAPP_DISPLAY \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PORT=7860

# 4. Pre-build Next.js production bundle & prepare writable data directory
RUN npm run build \
 && mkdir -p /app/.cache/lamla_data \
 && chmod -R 777 /app/.cache

EXPOSE 7860

# 5. Launch the unified Python + Website server on $PORT
CMD ["python", "app.py"]
