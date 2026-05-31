# =============================================================================
# OneUptime - Makefile
# =============================================================================
# Usage: make <target>
# Run `make help` to see all available targets.
# =============================================================================

# Shell to use
SHELL := /bin/bash

# Docker Compose files
COMPOSE_DEV  := docker compose --env-file .env -f docker/docker-compose-dev.yml
COMPOSE_PROD := docker compose --env-file .env -f docker/docker-compose.yml

# Read DB credentials from .env (used in some targets)
POSTGRES_USER := $(shell grep -E '^POSTGRES_USER=' .env 2>/dev/null | cut -d= -f2)
POSTGRES_DB   := $(shell grep -E '^POSTGRES_DB=' .env 2>/dev/null | cut -d= -f2)

# Backup directory
BACKUP_DIR := backups
TIMESTAMP  := $(shell date +%Y%m%d_%H%M%S)

# Default target
.DEFAULT_GOAL := help

# All targets are phony (none produce a file with the target name)
.PHONY: help \
        install install-dev freeze \
        db-up db-down db-restart db-logs db-shell db-status db-reset db-backup db-restore \
        migrate makemigrations migrations-show migrations-empty migrations-reset \
        run shell superuser collectstatic check \
        startapp \
        seed seed-demo seed-clean \
        test test-cov test-watch test-app \
        lint format type-check \
        openapi docs \
        clean clean-pyc clean-all \
        docker-build docker-up docker-down docker-logs docker-shell \
        deploy-vps \
        doctor audit-verify run-checks run-scheduler scheduler-logs \
        env env-check git-init

# =============================================================================
# HELP
# =============================================================================

help: ## Show this help message
	@echo ""
	@echo "OneUptime PoC — Available commands:"
	@echo ""
	@echo "  📦 Setup & Install"
	@grep -E '^(install|install-dev|freeze|env|env-check|git-init):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  🗄️  Database (Docker)"
	@grep -E '^(db-up|db-down|db-restart|db-logs|db-shell|db-status|db-reset|db-backup|db-restore):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  🔄 Migrations"
	@grep -E '^(migrate|makemigrations|migrations-show|migrations-empty|migrations-reset):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  🚀 Django"
	@grep -E '^(run|shell|superuser|collectstatic|check|startapp):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  🌱 Data Seeding"
	@grep -E '^(seed|seed-demo|seed-clean):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  ✅ Tests & Quality"
	@grep -E '^(test|test-cov|test-watch|test-app|lint|format|type-check):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  📖 Documentation"
	@grep -E '^(openapi|docs):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  🐋 Docker (full stack)"
	@grep -E '^(docker-build|docker-up|docker-down|docker-logs|docker-shell):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  🔧 Tools"
	@grep -E '^(doctor|audit-verify|run-checks|run-scheduler|scheduler-logs|deploy-vps):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  🧹 Cleanup"
	@grep -E '^(clean|clean-pyc|clean-all):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# SETUP & INSTALL
# =============================================================================

install: ## Install python3 dependencies (production)
	pip install -r requirements.txt

install-dev: ## Install dev dependencies (tests, lint)
	pip install -r requirements.txt
	pip install pre-commit
	@echo "✅ Dev dependencies installed."

freeze: ## Freeze current pip packages to requirements.txt
	pip freeze | grep -v '^-e' > requirements.txt
	@echo "✅ requirements.txt updated."

env: ## Copy .env.example to .env if .env doesn't exist
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ .env created from .env.example."; \
		echo "⚠️  Remember to set DJANGO_SECRET_KEY (run: python3 -c \"import secrets; print(secrets.token_urlsafe(50))\")"; \
	else \
		echo "ℹ️  .env already exists, skipping."; \
	fi

env-check: ## Verify required env variables are set
	@echo "Checking .env..."
	@for var in DJANGO_SECRET_KEY DATABASE_URL POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD; do \
		if ! grep -q "^$$var=" .env 2>/dev/null; then \
			echo "❌ Missing: $$var"; \
		else \
			echo "✅ Found: $$var"; \
		fi; \
	done

git-init: ## Initialize git repository with first commit
	@if [ ! -d .git ]; then \
		git init; \
		git add .; \
		git commit -m "feat: initial project setup"; \
		echo "✅ Git repository initialized."; \
	else \
		echo "ℹ️  Git repository already initialized."; \
	fi

# =============================================================================
# DATABASE (Docker)
# =============================================================================

db-up: ## Start PostgreSQL + web app containers (dev)
	$(COMPOSE_DEV) up -d --build
	@echo "⏳ Waiting for services..."
	@sleep 5
	@$(COMPOSE_DEV) exec -T db pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1 && echo "✅ Database is ready." || echo "⚠️  Database may not be ready yet."
	@echo "✅ Web API: http://localhost:$${WEB_PORT:-8000}"

db-down: ## Stop PostgreSQL container
	$(COMPOSE_DEV) down

db-restart: ## Restart PostgreSQL container
	$(COMPOSE_DEV) restart

db-logs: ## Show PostgreSQL logs (follow)
	$(COMPOSE_DEV) logs -f db

db-shell: ## Open psql shell in PostgreSQL container
	$(COMPOSE_DEV) exec db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

db-status: ## Show database container status
	$(COMPOSE_DEV) ps

db-reset: ## ⚠️  DESTROY and recreate the database (loses all data)
	@echo "⚠️  This will DESTROY all data in the development database."
	@read -p "Are you sure? Type 'yes' to confirm: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		$(COMPOSE_DEV) down -v; \
		$(COMPOSE_DEV) up -d; \
		sleep 3; \
		echo "✅ Database reset. Run 'make migrate' to recreate tables."; \
	else \
		echo "❌ Cancelled."; \
	fi

db-backup: ## Backup database to backups/db_YYYYMMDD_HHMMSS.sql.gz
	@mkdir -p $(BACKUP_DIR)
	$(COMPOSE_DEV) exec -T db pg_dump -U $(POSTGRES_USER) $(POSTGRES_DB) | gzip > $(BACKUP_DIR)/db_$(TIMESTAMP).sql.gz
	@echo "✅ Backup saved: $(BACKUP_DIR)/db_$(TIMESTAMP).sql.gz"

db-restore: ## Restore latest backup (set FILE=path to restore specific file)
	@if [ -z "$(FILE)" ]; then \
		FILE=$$(ls -t $(BACKUP_DIR)/db_*.sql.gz 2>/dev/null | head -1); \
		if [ -z "$$FILE" ]; then echo "❌ No backup found in $(BACKUP_DIR)/"; exit 1; fi; \
		echo "ℹ️  Restoring latest: $$FILE"; \
		gunzip -c $$FILE | $(COMPOSE_DEV) exec -T db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB); \
	else \
		echo "ℹ️  Restoring: $(FILE)"; \
		gunzip -c $(FILE) | $(COMPOSE_DEV) exec -T db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB); \
	fi
	@echo "✅ Restore complete."

# =============================================================================
# MIGRATIONS
# =============================================================================

migrate: ## Apply all pending migrations
	python3 manage.py migrate

makemigrations: ## Create migrations for all apps (use APP=appname for one app)
	@if [ -z "$(APP)" ]; then \
		python3 manage.py makemigrations; \
	else \
		python3 manage.py makemigrations $(APP); \
	fi

migrations-show: ## Show migration status for all apps
	python3 manage.py showmigrations

migrations-empty: ## Create empty migration (use APP=appname required)
	@if [ -z "$(APP)" ]; then \
		echo "❌ Usage: make migrations-empty APP=appname"; \
		exit 1; \
	fi
	python3 manage.py makemigrations $(APP) --empty

migrations-reset: ## ⚠️  Delete all migrations files and recreate (use only before first commit)
	@echo "⚠️  This will DELETE all migration files (except __init__.py)."
	@read -p "Are you sure? Type 'yes' to confirm: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		find apps/*/migrations -type f -name "*.py" ! -name "__init__.py" -delete; \
		find apps/*/migrations -type d -name "__pycache__" -exec rm -rf {} +; \
		echo "✅ Migrations deleted. Run 'make makemigrations' to recreate."; \
	else \
		echo "❌ Cancelled."; \
	fi

# =============================================================================
# DJANGO
# =============================================================================

run: ## Run development server locally on http://localhost:8000
	python3 manage.py runserver

docker-dev: db-up ## Alias: start full dev stack in Docker (db + web)

shell: ## Open Django shell (with auto-imports via shell_plus if available)
	@python3 manage.py shell_plus 2>/dev/null || python3 manage.py shell

superuser: ## Create a Django superuser
	python3 manage.py createsuperuser

collectstatic: ## Collect static files (for production)
	python3 manage.py collectstatic --noinput

check: ## Run Django's system check
	python3 manage.py check

test-email: ## Send a test HTML email (EMAIL=addr optional)
	python3 manage.py send_test_email $(EMAIL)

startapp: ## Create a new app under apps/ (use NAME=appname)
	@if [ -z "$(NAME)" ]; then \
		echo "❌ Usage: make startapp NAME=appname"; \
		exit 1; \
	fi
	mkdir -p apps/$(NAME)
	python3 manage.py startapp $(NAME) apps/$(NAME)
	@echo "✅ App created at apps/$(NAME)/"
	@echo "⚠️  Don't forget to add 'apps.$(NAME)' to LOCAL_APPS in config/settings/base.py"

# =============================================================================
# DATA SEEDING
# =============================================================================

seed: seed-demo ## Alias for seed-demo

seed-demo: ## Populate the database with demo data
	python3 manage.py seed_demo

seed-clean: ## Remove all demo data (preserves migrations)
	python3 manage.py seed_demo --clean

# =============================================================================
# TESTS & QUALITY
# =============================================================================

test: ## Run all tests
	pytest

test-cov: ## Run tests with coverage report
	pytest --cov=apps --cov=core --cov-report=term-missing --cov-report=html
	@echo "📊 Coverage HTML report: htmlcov/index.html"

test-watch: ## Run tests in watch mode (requires pytest-watch: pip install pytest-watch)
	ptw

test-app: ## Run tests for a specific app (use APP=appname)
	@if [ -z "$(APP)" ]; then \
		echo "❌ Usage: make test-app APP=appname"; \
		exit 1; \
	fi
	pytest apps/$(APP)/

lint: ## Run ruff and black --check
	ruff check .
	black --check .

format: ## Auto-format code with ruff and black
	ruff check . --fix
	black .
	@echo "✅ Code formatted."

type-check: ## Run mypy type checking (if installed)
	@command -v mypy >/dev/null 2>&1 && mypy . || echo "⚠️  mypy not installed. Run: pip install mypy django-stubs"

# =============================================================================
# DOCUMENTATION
# =============================================================================

openapi: ## Generate OpenAPI schema to docs/openapi.json
	python3 manage.py spectacular --color --file docs/openapi.json
	@echo "OpenAPI schema written to docs/openapi.json"

docs: ## Open Swagger UI in browser (server must be running)
	@command -v xdg-open >/dev/null 2>&1 && xdg-open http://localhost:8000/api/v1/docs || \
	command -v open >/dev/null 2>&1 && open http://localhost:8000/api/v1/docs || \
	echo "Open http://localhost:8000/api/v1/docs in your browser"

# =============================================================================
# DOCKER (full stack — prod-like)
# =============================================================================

docker-build: ## Build production Docker image
	$(COMPOSE_PROD) build

docker-up: ## Start full stack (web + db + nginx) in production mode
	$(COMPOSE_PROD) up -d

docker-down: ## Stop full stack
	$(COMPOSE_PROD) down

docker-logs: ## Show logs from all containers (follow)
	$(COMPOSE_PROD) logs -f

docker-shell: ## Open shell in web container
	$(COMPOSE_PROD) exec web /bin/bash

# =============================================================================
# TOOLS
# =============================================================================

doctor: ## Run health checks on the local deployment
	@python3 -m cli.doctor check 2>/dev/null || echo "CLI doctor not yet implemented (Day 10)"

audit-verify: ## Verify the integrity of the audit log hash chain
	python3 manage.py verify_audit_chain

run-checks: ## Run pending monitor checks (manual trigger)
	python3 manage.py run_checks

run-scheduler: ## Run background scheduler locally (checks, maintenance, webhooks, purge)
	python3 manage.py run_scheduler

scheduler-logs: ## Follow scheduler container logs (Docker dev stack)
	$(COMPOSE_DEV) logs -f scheduler

deploy-vps: ## Deploy to VPS (set VPS_HOST in .env)
	@if [ -z "$$(grep VPS_HOST .env 2>/dev/null | cut -d= -f2)" ]; then \
		echo "VPS_HOST not set in .env"; \
		exit 1; \
	fi
	@echo "Deploying to VPS..."
	@bash scripts/deploy.sh

# =============================================================================
# CLEANUP
# =============================================================================

clean: clean-pyc ## Clean python3 cache files
	@echo "Cleaned python3 cache."

clean-pyc: ## Remove .pyc files and __pycache__ directories
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true

clean-all: clean-pyc ## Full cleanup: cache + venv + db volume (full reset)
	@echo "This will remove venv, all cached files, and the database volume."
	@read -p "Are you sure? Type 'yes' to confirm: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		rm -rf venv .pytest_cache .coverage htmlcov staticfiles; \
		$(COMPOSE_DEV) down -v 2>/dev/null || true; \
		echo "Full cleanup done. Run 'python3 -m venv venv && source venv/bin/activate && make install' to restart."; \
	else \
		echo "Cancelled."; \
	fi

# =============================================================================
# COMPOSITE TARGETS (shortcuts for common workflows)
# =============================================================================

.PHONY: setup fresh-start dev-start

setup: env db-up ## Full setup: create .env + start DB
	@sleep 2
	@echo ""
	@echo "Setup complete. Next steps:"
	@echo "   1. Edit .env (set DJANGO_SECRET_KEY)"
	@echo "   2. Run: make migrate"
	@echo "   3. Run: make superuser"
	@echo "   4. Run: make run"

fresh-start: db-reset migrate seed-demo ## Reset DB and reseed (loses data)
	@echo "Fresh start complete. Database recreated and seeded."

dev-start: db-up ## Start development environment (DB + Django runserver)
	@echo "Starting development server..."
	@$(MAKE) run