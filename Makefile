#!make

PLATFORM = "linux/amd64"

ifneq (,$(wildcard ./.env))
	include .env
	export
endif

.PHONY: help env-init
.DEFAULT_GOAL := help
help:
	@printf "\033[33mUsage:\033[0m\n  make [target] [arg=\"val\"...]\n\n\033[33mTargets:\033[0m\n"
	@awk 'BEGIN { FS = ":.*##"; } /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

env-init: ## Initialize .env from .env.example with openssl secrets
ifeq ($(OS),Windows_NT)
	@"C:/Program Files/Git/bin/bash.exe" scripts/env-init.sh
else
	@bash scripts/env-init.sh
endif

install: ## Install all workspace dependencies
	@yarn install

build: ## Build every workspace (turbo)
	@yarn build

dev: ## Start every app/connector in watch mode (turbo)
	@yarn start:dev

dev-api: ## Start only the API (cœur OIDC)
	@yarn workspace @cartulaire/api start:dev

dev-daemon: ## Start only the daemon
	@yarn workspace @cartulaire/daemon start:dev

dev-mock: ## Start only the mock connector
	@yarn workspace @cartulaire/connector-mock start:dev

lint: ## Lint every workspace
	@yarn lint

test: ## Run every workspace test suite
	@yarn test

ncu: ## Check latest versions of all project dependencies
	@npx npm-check-updates --deep

ncu-upgrade: ## Upgrade all project dependencies to the latest versions
	@npx npm-check-updates --deep -u
