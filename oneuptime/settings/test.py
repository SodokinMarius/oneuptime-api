"""Settings de tests."""
from .base import *  # noqa: F401, F403

DEBUG = False

# Postgres en mémoire ou utilise la DB de dev
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']  # tests + rapides

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'