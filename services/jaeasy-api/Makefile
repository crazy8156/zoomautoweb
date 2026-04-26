.PHONY: dev migrate seed

dev:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

migrate:
	alembic upgrade head

seed:
	python scripts/seed_vocab.py

test:
	pytest tests/ -v
