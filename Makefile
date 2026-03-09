prune:
	docker builder prune -f
	docker image prune -f
frontend:
	docker compose build frontend
	docker compose up -d frontend
backend:
	docker compose build backend
	docker compose up -d backend
up:
	docker compose up -d
down:
	docker compose down

build:
	docker compose up-d --build