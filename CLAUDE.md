# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClinicalGestor** (branded as "Dentu") is a full-stack dental clinic management system. All UI text is in Spanish. It supports white-label/multi-clinic deployments via environment variables.

## Repository Structure

```
ClinicalGestor/
├── frontend/          # React 19 + TypeScript (built with Craco)
├── backend/           # FastAPI + Python async (single-file: server.py)
├── tests/             # Test suite
├── backend_test.py    # API integration tests
├── memory/PRD.md      # Product Requirements Document
└── design_guidelines.json  # Design system specification
```

## Commands

### Frontend (use Yarn, not npm)
```bash
cd frontend
yarn start         # Dev server at localhost:3000
yarn build         # Production build
yarn test          # Run tests
```

### Backend
```bash
cd backend
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001  # Dev
python -m uvicorn server:app --host 0.0.0.0 --port 8001            # Prod
```

### Testing
```bash
python backend_test.py   # API integration tests (run from repo root)
```

### Linting (backend)
```bash
cd backend
black .    # Format
isort .    # Sort imports
flake8 .   # Lint
mypy .     # Type check
```

## Architecture

### Frontend

- **Entry point**: `frontend/src/App.js` — defines all routes with `ProtectedRoute`/`PublicRoute` wrappers
- **Global state**: Context API only — `AuthContext.js` (JWT auth) and `ThemeContext.js` (dark/light mode)
- **Path alias**: `@` maps to `frontend/src/` (configured in `craco.config.js` and `jsconfig.json`)
- **UI components**: Radix UI primitives live in `frontend/src/components/ui/` — prefer these over new libraries
- **Forms**: React Hook Form + Zod validation throughout
- **HTTP**: Axios with `REACT_APP_BACKEND_URL` env var (default: `http://localhost:8001`)
- **Notifications**: Sonner toast — import from `sonner`
- **Class merging**: Always use `cn()` from `@/lib/utils` (combines clsx + tailwind-merge)

Role-based navigation: admins, doctors, and receptionists see different sidebar items (handled in `Layout.js`).

### Backend

The entire backend lives in **`backend/server.py`** (single file, ~1300 lines). It contains:
- Pydantic data models
- FastAPI route handlers grouped by domain (auth, doctors, patients, appointments, clinical data, dashboard, webhooks)
- In-memory rate limiting (sliding window)
- Database initialization and index creation on startup

**Authentication**: JWT tokens (HS256, 24h expiry). Protected routes use `Depends(get_current_user)`. Admin-only routes additionally use `Depends(require_admin)`.

**Webhook endpoints** (`/api/webhook/*`) are authenticated via `WEBHOOK_API_KEY` header — intended for n8n automation integration.

### Database

MongoDB via Motor (async). Collections: `users`, `doctors`, `patients`, `appointments`, `odontograms`, `notas_clinicas`, `archivos_medicos`.

## Environment Configuration

Copy `backend/.env.example` to `backend/.env`. Key variables:
- `MONGO_URL`, `DB_NAME` — MongoDB connection
- `SECRET_KEY` — JWT signing key
- `WEBHOOK_API_KEY` — n8n webhook auth (default: `dentu-n8n-webhook-key-2024`)
- `CLINIC_NAME`, `CLINIC_LOGO`, `CLINIC_COLOR_PRIMARY` — white-label branding
- `WORK_START`, `WORK_END`, `SLOT_DURATION` — working hours config
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — bootstrap admin credentials
- `TIMEZONE` — clinic timezone

Frontend reads `REACT_APP_BACKEND_URL` from `frontend/.env`.

## Design System

See `design_guidelines.json` for the full spec. Key points:
- **Fonts**: Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (code)
- **Primary color**: Cyan `#0ea5e9`; Secondary: Emerald
- **Layout**: Fixed collapsible sidebar + bento grid cards
- **Theming**: CSS variables in `frontend/src/index.css`, toggled via `.dark` class on `<html>`

## Key Domain Concepts

- **Odontogram**: Interactive 32-tooth chart; each tooth has 5 zones, each zone can have various clinical states. Component: `frontend/src/components/Odontogram.js`
- **Calendar**: Day/Week/Month views with drag-and-drop; appointments are color-coded by doctor. Component: `frontend/src/components/CalendarWidget.js`
- **Test credentials**: `test@dentu.com` / `test123` (from `memory/PRD.md`)
