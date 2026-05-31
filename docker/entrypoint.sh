#!/bin/sh
set -e

echo "Waiting for database..."
python <<'PY'
import os
import sys
import time

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.environ.get(
    "DJANGO_SETTINGS_MODULE", "oneuptime.settings.dev"
))
django.setup()

from django.db import connection  # noqa: E402

for attempt in range(30):
    try:
        connection.ensure_connection()
        print("Database is ready.")
        break
    except Exception:
        if attempt == 29:
            print("Database connection failed.", file=sys.stderr)
            sys.exit(1)
        time.sleep(1)
PY

echo "Running migrations..."
python manage.py migrate --noinput

# collectstatic uniquement en production (DEBUG=False)
if [ "${DJANGO_SETTINGS_MODULE}" = "oneuptime.settings.prod" ]; then
    echo "Collecting static files..."
    python manage.py collectstatic --noinput --clear
fi

echo "Starting application..."
exec "$@"
