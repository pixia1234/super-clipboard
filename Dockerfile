# -----------------------------------------------------------------------------
# Stage 1: Frontend build (React + Vite)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install dependencies with cache-friendly layer ordering
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build static assets
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Backend runtime (FastAPI + Uvicorn)
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS backend-runtime
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

# System dependencies (sqlite already included in slim image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install -r backend/requirements.txt

# Copy backend source and built frontend assets
COPY backend ./backend
COPY --from=frontend-builder /app/dist ./dist

# Prepare storage directories (can be overridden via volumes)
RUN mkdir -p backend/storage/files

EXPOSE 5173
ENV SUPER_CLIPBOARD_APP_HOST=0.0.0.0 \
    SUPER_CLIPBOARD_APP_PORT=5173

CMD ["python", "-m", "backend"]
