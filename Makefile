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
	docker compose up -d --build

.PHONY: wheels
wheels:
	uv pip compile pyproject.toml -o requirements.txt
	pip download -d wheels setuptools wheel pip --python-version 3.14 --only-binary=:all:
	pip download \
	-d wheels \
	-r requirements.txt \
	--python-version 3.14 \
	--only-binary=:all:
		
.PHONY: clean-wheels
clean-wheels:
	Remove-Item -Recurse -Force wheels

.PHONY: wheels311
wheels311:
	uv pip compile pyproject.toml -o requirements311.txt --python-version 3.11
	pip download -d wheels311 setuptools wheel pip --python-version 3.11 --only-binary=:all:
	pip download \
	-r requirements311.txt \
	-d wheels311 \
	--python-version 3.11 \
	--only-binary=:all:
		
.PHONY: clean-wheels
clean-wheels:
	Remove-Item -Recurse -Force wheels