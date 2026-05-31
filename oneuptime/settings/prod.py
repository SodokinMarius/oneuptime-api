"""Settings de production."""
from django.core.exceptions import ImproperlyConfigured
from .base import *
from decouple import config

DEBUG = False

# Sécurité
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Redis obligatoire en prod — lève une erreur claire au démarrage si absent
_redis_url = config('REDIS_URL', default='')
if not _redis_url:
    raise ImproperlyConfigured(
        "REDIS_URL est requis en production. "
        "Ajoutez REDIS_URL=redis://redis:6379/0 dans votre .env"
    )

# Gunicorn — nombre de workers via env (défaut : 2*CPU+1 géré par gunicorn lui-même)
GUNICORN_WORKERS = config('GUNICORN_WORKERS', default=3, cast=int)
GUNICORN_TIMEOUT = config('GUNICORN_TIMEOUT', default=30, cast=int)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            'format': '{"level":"%(levelname)s","time":"%(asctime)s","logger":"%(name)s","msg":"%(message)s"}',
        },
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'json'},
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
}