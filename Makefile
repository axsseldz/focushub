SHELL := /bin/bash

.PHONY: check check-frontend check-backend frontend-install backend-venv backend-install

define step
	@printf "\n\033[1;34m==> %s\033[0m\n" "$(1)"
endef

define ok
	@printf "\033[1;32m%s\033[0m\n" "$(1)"
endef

check: check-frontend check-backend
	$(call ok,All checks passed.)

frontend-install:
	$(call step,Frontend: install dependencies)
	@cd frontend && npm install

check-frontend: frontend-install
	$(call step,Frontend: lint)
	@cd frontend && npm run lint
	$(call step,Frontend: type check)
	@cd frontend && rm -rf .next && npm run type-check
	$(call step,Frontend: tests)
	@cd frontend && if find . \( -path './node_modules' -o -path './.next' \) -prune -o -type f \( -name '*.test.*' -o -name '*.spec.*' \) -print | grep -q .; then \
		if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.test ? 0 : 1)"; then \
			npm test; \
		else \
			printf "\033[1;31mFrontend tests found, but no test script is defined.\033[0m\n"; \
			exit 1; \
		fi; \
	else \
		printf "\033[1;33mNo frontend tests found. Skipping.\033[0m\n"; \
	fi
	$(call step,Frontend: build)
	@cd frontend && npm run build
	$(call ok,Frontend checks passed.)

backend-venv:
	$(call step,Backend: create virtual environment)
	@cd backend && python3 -m venv .venv

backend-install: backend-venv
	$(call step,Backend: install dependencies)
	@cd backend && source .venv/bin/activate && python -m pip install --upgrade pip && if [ -f requirements.txt ]; then pip install -r requirements.txt; else pip install fastapi pytest uvicorn; fi

check-backend: backend-install
	$(call step,Backend: lint)
	@cd backend && source .venv/bin/activate && if python -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('ruff') else 1)"; then python -m ruff check .; elif python -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('flake8') else 1)"; then python -m flake8 .; else printf "\033[1;33mNo backend linter installed. Skipping.\033[0m\n"; fi
	$(call step,Backend: tests)
	@cd backend && source .venv/bin/activate && if [ -d tests ] && find tests -type f \( -name 'test_*.py' -o -name '*_test.py' \) -print | grep -q .; then pytest; else printf "\033[1;33mNo backend tests found. Skipping.\033[0m\n"; fi
	$(call step,Backend: import check)
	@cd backend && source .venv/bin/activate && python -c "from main import app; assert app is not None"
	$(call ok,Backend checks passed.)
