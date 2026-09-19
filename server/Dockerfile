# Fleetwrit dev server (FastAPI + SQLite). Build context is the repo root so the
# sibling SDK (fleetwrit-python) can be installed for the shared fingerprint.
FROM python:3.12-slim

WORKDIR /app
COPY fleetwrit-python /app/fleetwrit-python
COPY server /app/server
RUN pip install --no-cache-dir ./fleetwrit-python ./server \
    && mkdir -p /data

ENV FLEETWRIT_DB=/data/fleetwrit-dev.db \
    FLEETWRIT_SEED=1
EXPOSE 4100

CMD ["uvicorn", "fleetwrit_server.app:app", "--host", "0.0.0.0", "--port", "4100"]
