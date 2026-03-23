FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg2, PostGIS, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN useradd --create-home appuser

# Copy application
COPY --chown=appuser:appuser . .

USER appuser

# Railway sets $PORT dynamically; default to 8000 for local Docker
ENV PORT=8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
    CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\",8000)}/health')"

EXPOSE ${PORT}

# Start server (table creation handled by app lifespan)
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --log-level info"]
