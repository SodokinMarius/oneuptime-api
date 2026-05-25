"""Settings de développement."""
from .base import *  #

DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '*']

# Logs verbeux en dev
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {name} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'django.db.backends': {'level': 'WARNING'},
        'apps': {'level': 'DEBUG'},
        'core': {'level': 'DEBUG'},
    },
}