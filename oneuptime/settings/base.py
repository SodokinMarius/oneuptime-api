"""
Settings de base pour OneUptime.
Hérité par dev.py, prod.py, test.py.
"""
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------
SECRET_KEY = config('DJANGO_SECRET_KEY')
DEBUG = config('DJANGO_DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', default='', cast=Csv())

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'drf_spectacular',
    'corsheaders',
]

LOCAL_APPS = [
    'apps.scheduler',
    'apps.accounts',
    'apps.tenancy',
    'apps.rbac',
    'apps.monitoring',
    'apps.incidents',
    'apps.status_pages',
    'apps.maintenance',
    'apps.webhooks',
    'apps.audit',
    'apps.admin_api',
    'apps.sso',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.TenantMiddleware',
    'core.middleware.ProjectMiddleware',
    'core.middleware.RateLimitMiddleware',
]

ROOT_URLCONF = 'oneuptime.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'oneuptime.wsgi.application'
ASGI_APPLICATION = 'oneuptime.asgi.application'

# ---------------------------------------------------------------------------
# Cache — Redis si REDIS_URL défini, sinon LocMemCache (dev uniquement)
# ---------------------------------------------------------------------------
_REDIS_URL = config('REDIS_URL', default='')

if _REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': _REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'SOCKET_CONNECT_TIMEOUT': 5,
                'SOCKET_TIMEOUT': 5,
                'IGNORE_EXCEPTIONS': True,  # dégrade gracieusement si Redis est down
            },
            'KEY_PREFIX': 'oneuptime',
            'TIMEOUT': 300,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'oneuptime-dev',
        }
    }

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
import dj_database_url  

# Note : dj_database_url n'est pas dans requirements.txt par défaut.
# On va l'ajouter. Pour le moment, parse manuel :
def _parse_db_url(url):
    """Parser minimal pour postgres://user:pass@host:port/db"""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': parsed.path.lstrip('/'),
        'USER': parsed.username,
        'PASSWORD': parsed.password,
        'HOST': parsed.hostname,
        'PORT': parsed.port or 5432,
    }


DATABASES = {
    'default': _parse_db_url(config('DATABASE_URL')),
}

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------------------------
# DRF
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.accounts.authentication.UnifiedTokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.CreatedAtCursorPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.AnonRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user': '1000/min',
        'anon': '60/min',
    },
    'EXCEPTION_HANDLER': 'core.exceptions.rfc7807_handler',
}

# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(
        minutes=config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=15, cast=int)
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)
    ),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ---------------------------------------------------------------------------
# OpenAPI / Swagger
# ---------------------------------------------------------------------------
SPECTACULAR_SETTINGS = {
    'TITLE': 'OneUptime API',
    'DESCRIPTION': (
        'OneUptime Enterprise Features — Python/Django PoC.\n\n'
        'Inspired by the OneUptime Enterprise Implementation Guide v1.0.\n\n'
        '**Authentification :** cliquez sur **Authorize**, puis renseignez :\n'
        '- `bearerAuth` → votre access token JWT\n'
        '- `tenantId` → l\'UUID du tenant (`tenant.id` retourné par `/auth/me`)\n'
        '- `projectId` → l\'UUID du projet (`default_project.id` retourné par `/auth/me`)'
    ),
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'AUTHENTICATION_WHITELIST': [
        'apps.accounts.authentication.UnifiedTokenAuthentication',
    ],
    'SECURITY': [
        {'bearerAuth': [], 'tenantId': [], 'projectId': []},
    ],
    'APPEND_COMPONENTS': {
        'securitySchemes': {
            'bearerAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
                'description': 'Token JWT obtenu via POST /auth/login',
            },
            'tenantId': {
                'type': 'apiKey',
                'in': 'header',
                'name': 'X-Tenant-Id',
                'description': 'UUID du tenant — récupéré via GET /auth/me → tenant.id',
            },
            'projectId': {
                'type': 'apiKey',
                'in': 'header',
                'name': 'X-Project-Id',
                'description': 'UUID du projet — récupéré via GET /auth/me → default_project.id',
            },
        },
    },
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'displayOperationId': True,
        'persistAuthorization': True,
    },
    'TAGS': [
        {'name': 'Auth', 'description': 'Authentication and account management'},
        # {'name': 'Tenants', 'description': 'Tenant and project management'},
        # {'name': 'RBAC', 'description': 'Roles, teams, API keys'},
        # {'name': 'Monitoring', 'description': 'Monitors and probes'},
        # {'name': 'Incidents', 'description': 'Incident management'},
        # {'name': 'Status Pages', 'description': 'Public status pages'},
        # {'name': 'On-Call', 'description': 'On-call schedules and alerts'},
        # {'name': 'Telemetry', 'description': 'Logs, metrics, traces'},
        # {'name': 'Workflows', 'description': 'Workflows and scheduled maintenance'},
        # {'name': 'Webhooks', 'description': 'Outbound webhooks'},
        # {'name': 'Audit', 'description': 'Audit log'},
        # {'name': 'Compliance', 'description': 'GDPR and compliance endpoints'},
        # {'name': 'Admin', 'description': 'Super-admin endpoints'},
    ],
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='', cast=Csv())

# ---------------------------------------------------------------------------
# Email (SMTP)
# ---------------------------------------------------------------------------
EMAIL_BACKEND = config(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.smtp.EmailBackend',
)
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_USE_SSL = config('EMAIL_USE_SSL', default=False, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_TIMEOUT = config('EMAIL_TIMEOUT', default=10, cast=int)
EMAIL_FROM_NAME = config('EMAIL_FROM_NAME', default='OneUptime')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default=EMAIL_HOST_USER)
SERVER_EMAIL = config('SERVER_EMAIL', default=DEFAULT_FROM_EMAIL)

# ---------------------------------------------------------------------------
# OTP / MFA / Activation
# ---------------------------------------------------------------------------
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')

# Optional SMS (Twilio) for maintenance / escalation alerts
TWILIO_ACCOUNT_SID = config('TWILIO_ACCOUNT_SID', default='')
TWILIO_AUTH_TOKEN = config('TWILIO_AUTH_TOKEN', default='')
TWILIO_FROM_NUMBER = config('TWILIO_FROM_NUMBER', default='')
API_BASE_URL = config('API_BASE_URL', default='http://localhost:8000')

# SAML Service Provider key pair (PEM). Generate with:
#   openssl req -x509 -newkey rsa:2048 -keyout sp.key -out sp.crt -days 3650 -nodes -subj "/CN=oneuptime-sp"
SSO_SP_PRIVATE_KEY = config('SSO_SP_PRIVATE_KEY', default='')
SSO_SP_CERT = config('SSO_SP_CERT', default='')
OTP_LENGTH = config('OTP_LENGTH', default=6, cast=int)
OTP_EXPIRY_MINUTES = config('OTP_EXPIRY_MINUTES', default=15, cast=int)
OTP_MAX_ATTEMPTS = config('OTP_MAX_ATTEMPTS', default=5, cast=int)
MFA_ISSUER_NAME = config('MFA_ISSUER_NAME', default='OneUptime')
MFA_LOGIN_SESSION_MINUTES = config('MFA_LOGIN_SESSION_MINUTES', default=5, cast=int)

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------
WEBHOOK_DEFAULT_TIMEOUT_SECONDS = config('WEBHOOK_DEFAULT_TIMEOUT_SECONDS', default=5, cast=int)
WEBHOOK_MAX_RETRIES = config('WEBHOOK_MAX_RETRIES', default=3, cast=int)
