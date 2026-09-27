SHELL := /bin/bash
ENV_FILE := .env
TF_DIR := terraform

export AWS_ACCESS_KEY_ID ?= test
export AWS_SECRET_ACCESS_KEY ?= test
export AWS_DEFAULT_REGION ?= us-east-1

up:
	docker compose up -d
	@echo "Waiting for LocalStack health..."
	@docker compose exec -T localstack bash -lc 'until curl -fsS http://localhost:4566/_localstack/health | grep -q running; do sleep 1; done'
	@echo "LocalStack ready on http://localhost:4566"

down:
	docker compose down

logs:
	docker compose logs -f localstack

restart: down up

init:
	cd $(TF_DIR) && terraform init

plan:
	cd $(TF_DIR) && terraform plan

apply:
	cd $(TF_DIR) && terraform apply -auto-approve

destroy:
	cd $(TF_DIR) && terraform destroy -auto-approve

bootstrap-sqs:
	./scripts/bootstrap-sqs.sh

smoke:
	./scripts/smoke.sh

shell:
	docker compose exec -T localstack bash
