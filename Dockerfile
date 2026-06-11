# =============================================================================
# OneUptime API — Python/Django
# =============================================================================
FROM python:3.10-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps for psycopg
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        libxmlsec1-dev \
        libxmlsec1-openssl \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# Application code
COPY manage.py .
COPY oneuptime/ oneuptime/
COPY apps/ apps/
COPY core/ core/
COPY templates/ templates/
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
# Overridden in docker-compose-dev (runserver) or prod (gunicorn)
CMD ["gunicorn", "oneuptime.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
