# Super Clipboard

Super Clipboard focuses on cloud-hosted text and file relay. With expiring links, device binding, and access credentials, it makes cross-device content transfer effortless.

Try it now: [https://clip.pixia.eu.org/](https://clip.pixia.eu.org/) (Demo site; data is periodically cleared. Do not upload private content. No data responsibility or SLA guarantee.)

## Core Capabilities

- **Cloud text snippets**: Quickly type or import from the system clipboard, generate either a 5-character short code or a persistent token (seven or more characters), and retrieve snippets even in locked-down environments.
- **Cloud file relay**: Upload files up to 50 MB, authorize with the short code or token, and append `/raw` to the URL to stream the original content—ideal for VNC, SSH, and similar workflows.
- **Persistent environment settings**: Configure a persistent token in the Settings panel; new snippets reuse it automatically to simplify backend authentication and auditing.
- **Self-destruct mechanism**: Pick a lifetime between 1–120 hours and optionally 1–500 visits; once either threshold is hit, the resource is destroyed and the list updates immediately.

## Tech Stack

- **Build tooling**: Vite 5 with TypeScript 5
- **Front-end framework**: React 18 (function components with Hooks)
- **State management**: Zustand with custom composite data structures for the clipboard and local cache
- **Backend service**: FastAPI with SQLite (includes automated cleanup tasks and download limit enforcement)

## Getting Started

```bash
# Install dependencies
npm install

# Local development (http://localhost:5173 by default)
npm run dev

# Production build and preview
npm run build
npm run preview

# Code quality checks
npm run lint
npm run typecheck
```

1. **Configure the environment**: Open **Environment Settings**, create or paste a persistent token, and save it for global reuse. Tokens expire automatically if unused for 720 hours.
2. **Create a cloud clipboard**: Choose text or file (≤50 MB), configure the auto-expiration time (1–120 hours) and visit limit (1–500), then authorize with either the short code or persistent token.
3. **Import and share**: Text entries can pull directly from the system clipboard, and their credentials are available via quick-copy badges. File entries support direct download with visit tracking.

## Backend Quickstart (FastAPI)

```bash
# Create the environment with Miniconda
conda env create -f environment.yml
conda activate super-clipboard

# During development expose the backend on 5174 (avoids Vite conflicts)
export SUPER_CLIPBOARD_APP_PORT=5174   # On Windows use `set`
python -m backend

# Run backend regression tests
pytest backend/tests
```

> For production, run `npm run build` to generate the `dist/` static assets, then start the backend (default listener `0.0.0.0:5173`). You only need to expose port 5173 to serve both the frontend and backend. If you keep the Vite dev server running, start it with `BACKEND_PORT=5174 npm run dev` so the proxy targets the new backend port.

### 🔐 Enable Captcha Validation

Require a captcha before creating a cloud clipboard. Google reCAPTCHA and Cloudflare Turnstile are supported. Configure both backend and frontend:

- Backend env vars  
  - `SUPER_CLIPBOARD_CAPTCHA_PROVIDER=turnstile` or `recaptcha`  
  - `SUPER_CLIPBOARD_CAPTCHA_SECRET=<provider secret>`  
  - Optional: `SUPER_CLIPBOARD_CAPTCHA_BYPASS_TOKEN=<testing-only bypass token>` (avoid enabling in production)
- Frontend env vars (`./.env` or runtime flags)  
  - `VITE_CAPTCHA_PROVIDER=turnstile` or `recaptcha`  
  - `VITE_CAPTCHA_SITE_KEY=<site key>`  

After configuration, users must complete the captcha to create a clipboard; requests without a valid token are rejected.

## Docker Deployment

```bash
# Pull and run the official image (persist storage in the clipboard-data volume)
docker run -d --name super-clipboard \
  -p 5173:5173 \
  -v clipboard-data:/app/backend/storage \
  pixia1234/super-clipboard:latest

# Or use Docker Compose (defaults to port 5173)
docker compose pull
docker compose up -d
```
