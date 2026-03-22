###############################################################################
# RGDGC Monorepo — Development Makefile
#
# Quick start:
#   make setup    # First time: install deps, start DB, migrate, seed
#   make dev      # Start all dev servers (backend + mobile + admin)
#   make stop     # Stop everything
#   make test     # Run all tests
#   make health   # Check service health
#
# Ports (offset to avoid MadWorld conflicts):
#   PostgreSQL: 5433   Redis: 6381   Backend API: 8001
#   Admin Dashboard: 5173   Expo: 8081
###############################################################################

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Detect Python — prefer python3
PYTHON := $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null)
VENV := backend/venv
ACTIVATE := source $(VENV)/bin/activate

.PHONY: help setup install install-backend install-mobile install-admin install-contracts \
        db-start db-stop db-reset migrate seed \
        dev dev-backend dev-mobile dev-admin dev-worker dev-beat stop \
        test test-backend test-contracts lint clean deploy-backend health

# ── Help ─────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "RGDGC Development Commands"
	@echo "=========================="
	@echo ""
	@echo "  make setup          Full first-time setup (install + db + migrate + seed)"
	@echo "  make install        Install all project dependencies"
	@echo "  make dev            Start all dev servers in parallel"
	@echo "  make dev-worker     Start Celery worker"
	@echo "  make dev-beat       Start Celery beat scheduler"
	@echo "  make stop           Stop all services and containers"
	@echo ""
	@echo "  make db-start       Start PostgreSQL + Redis containers"
	@echo "  make db-stop        Stop containers (preserve data)"
	@echo "  make db-reset       Destroy containers + volumes, start fresh"
	@echo "  make migrate        Run Alembic migrations"
	@echo "  make seed           Seed development data"
	@echo ""
	@echo "  make test           Run all tests"
	@echo "  make test-backend   Run backend tests only"
	@echo "  make test-contracts Run contract tests only"
	@echo "  make lint           Lint all projects"
	@echo ""
	@echo "  make clean          Remove all deps, containers, and volumes"
	@echo "  make health         Run health checks"
	@echo "  make deploy-backend Deploy backend via Railway (git push)"
	@echo ""

# ── Setup ────────────────────────────────────────────────────────────────────

setup: install db-start migrate seed
	@echo ""
	@echo "============================================"
	@echo "  RGDGC is ready! Run 'make dev' to start."
	@echo "============================================"
	@echo ""

# ── Install ──────────────────────────────────────────────────────────────────

install: install-backend install-mobile install-admin install-contracts
	@echo "All dependencies installed."

install-backend:
	@echo "Installing backend dependencies..."
	@test -d $(VENV) || $(PYTHON) -m venv $(VENV)
	@$(ACTIVATE) && pip install --upgrade pip -q && pip install -r backend/requirements.txt -q
	@echo "  Backend ready."

install-mobile:
	@echo "Installing mobile dependencies..."
	@cd mobile && npm install --silent
	@echo "  Mobile ready."

install-admin:
	@echo "Installing admin dashboard dependencies..."
	@cd admin-dashboard && npm install --silent
	@echo "  Admin dashboard ready."

install-contracts:
	@echo "Installing contract dependencies..."
	@cd contracts && npm install --silent
	@echo "  Contracts ready."

# ── Database ─────────────────────────────────────────────────────────────────

db-start:
	@echo "Starting PostgreSQL and Redis..."
	@docker compose up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		docker exec rgdgc-db pg_isready -U rgdgc -q 2>/dev/null && break; \
		sleep 1; \
	done
	@echo "  Database containers running."

db-stop:
	@docker compose down
	@echo "  Database containers stopped."

db-reset: db-stop
	@echo "Destroying volumes and starting fresh..."
	@docker compose down -v
	@$(MAKE) db-start migrate seed
	@echo "  Database reset complete."

migrate:
	@echo "Running Alembic migrations..."
	@$(ACTIVATE) && cd backend && alembic upgrade head
	@echo "  Migrations applied."

seed:
	@echo "Seeding development data..."
	@$(ACTIVATE) && cd backend && $(PYTHON) scripts/seed_data.py
	@echo "  Seed data loaded."

# ── Development Servers ──────────────────────────────────────────────────────

dev:
	@echo ""
	@echo "Starting RGDGC dev environment..."
	@echo "  Backend API:      http://localhost:8001"
	@echo "  Backend docs:     http://localhost:8001/docs"
	@echo "  Admin dashboard:  http://localhost:5173"
	@echo "  Expo (mobile):    http://localhost:8081"
	@echo ""
	@echo "Press Ctrl+C to stop all services."
	@echo ""
	@trap 'kill 0; exit 0' INT TERM; \
	$(MAKE) dev-backend & \
	$(MAKE) dev-mobile & \
	$(MAKE) dev-admin & \
	wait

dev-backend:
	@$(ACTIVATE) && cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

dev-mobile:
	@cd mobile && npx expo start --port 8081

dev-admin:
	@cd admin-dashboard && npm run dev

dev-worker:
	@$(ACTIVATE) && cd backend && celery -A app.worker worker --loglevel=info

dev-beat:
	@$(ACTIVATE) && cd backend && celery -A app.worker beat --loglevel=info

# ── Stop ─────────────────────────────────────────────────────────────────────

stop: db-stop
	@-pkill -f "uvicorn app.main" 2>/dev/null
	@-pkill -f "expo start" 2>/dev/null
	@-pkill -f "vite" 2>/dev/null
	@-pkill -f "celery" 2>/dev/null
	@echo "All services stopped."

# ── Testing ──────────────────────────────────────────────────────────────────

test: test-backend test-contracts
	@echo "All tests complete."

test-backend:
	@echo "Running backend tests..."
	@$(ACTIVATE) && cd backend && pytest -v

test-contracts:
	@echo "Running contract tests..."
	@cd contracts && npx hardhat test

# ── Linting ──────────────────────────────────────────────────────────────────

lint:
	@echo "Linting backend..."
	@$(ACTIVATE) && cd backend && ruff check .
	@echo "Linting mobile..."
	@cd mobile && npx tsc --noEmit
	@echo "Linting admin dashboard..."
	@cd admin-dashboard && npx tsc --noEmit
	@echo "All linting passed."

# ── Clean ────────────────────────────────────────────────────────────────────

clean:
	@echo "Cleaning everything..."
	@docker compose down -v 2>/dev/null || true
	@rm -rf $(VENV)
	@rm -rf mobile/node_modules
	@rm -rf admin-dashboard/node_modules
	@rm -rf contracts/node_modules
	@echo "Clean complete. Run 'make setup' to rebuild."

# ── Deploy ───────────────────────────────────────────────────────────────────

deploy-backend:
	@echo "Deploying backend via Railway (git push to main)..."
	git push origin main

# ── Health ───────────────────────────────────────────────────────────────────

health:
	@./scripts/health-check.sh
