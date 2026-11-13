"""
Django settings for setmystay_backend project.
"""

from pathlib import Path
from datetime import timedelta
import os
from google.oauth2 import service_account
from dotenv import load_dotenv
import dj_database_url

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# --- RAZORPAY CONFIGURATION ---
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET')
RAZORPAY_WEBHOOK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET')

# --- JWT CONFIGURATION ---
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

# --- SECURITY & HOSTS ---
SECRET_KEY = os.environ.get(
    'SECRET_KEY', 
    'django-insecure-jr+%8z9b0e=+$8!&(bk=%34&_3_ly1qg$m$5g&e!h)s$$h8*y&'
)

DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# --- ROOMMATE MATCH PLANS (must match ROOMMATE_PLANS in the frontend src/lib/matching.ts) ---
ROOMMATE_PLANS = {
    'free': {'price': 0, 'daily_swipes': 15, 'chat_limit': 3},
    'basic': {'price': 99, 'daily_swipes': 60, 'chat_limit': None},
    'premium': {'price': 249, 'daily_swipes': None, 'chat_limit': None},
}

# Allow Render domain, localhost, and any custom domains
ALLOWED_HOSTS = ['*']

# Trust HTTPS headers coming from Render's load balancer
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Prevent 403 CSRF blocks on POST requests from Vercel and Render
CSRF_TRUSTED_ORIGINS = [
    'https://setmystay-backend.onrender.com',
    'https://set-my-stay-frontend-xwgp.vercel.app',
    'https://*.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]

# --- APPLICATION DEFINITION ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'django_filters',
    'users',
    'listings',
    'management',
    'interactions',
    'matching',
    'storages',
]

# --- REST FRAMEWORK CONFIGURATION ---
REST_FRAMEWORK = {
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend'
    ],
    # Clients may ask for bigger pages with ?page_size= (max 500). The frontend follows `next` links.
    'DEFAULT_PAGINATION_CLASS': 'setmystay_backend.pagination.FlexiblePagination',
    'PAGE_SIZE': 50,
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'admin_login': '10/hour',
        'staff_login': '20/hour',
    },
}

# --- MIDDLEWARE ---
# CorsMiddleware must be first; WhiteNoiseMiddleware must be right under SecurityMiddleware
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'setmystay_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'setmystay_backend.wsgi.application'

# --- DATABASE ---
# Uses PostgreSQL on Render (via DATABASE_URL) and falls back to SQLite locally
DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600
    )
}

# --- PASSWORD VALIDATION ---
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --- INTERNATIONALIZATION ---
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# --- STATIC FILES ---
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# --- CORS CONFIGURATION ---
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# --- GOOGLE CLOUD STORAGE & STORAGES (Django 5.2+) ---
# --- GOOGLE CLOUD STORAGE & STORAGES (SAFE FALLBACK) ---
GS_BUCKET_NAME = 'setmystay-media-bucket-2026'
GS_DEFAULT_ACL = None

LOCAL_GCS_PATH = os.path.join(BASE_DIR, 'gcs-keys.json')
RENDER_GCS_PATH = '/etc/secrets/gcs-keys.json'

if os.path.exists(LOCAL_GCS_PATH):
    GS_CREDENTIALS = service_account.Credentials.from_service_account_file(LOCAL_GCS_PATH)
elif os.path.exists(RENDER_GCS_PATH):
    GS_CREDENTIALS = service_account.Credentials.from_service_account_file(RENDER_GCS_PATH)
else:
    GS_CREDENTIALS = None

if GS_CREDENTIALS:
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
    MEDIA_URL = f'https://storage.googleapis.com/{GS_BUCKET_NAME}/'
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
    MEDIA_URL = '/media/'
    MEDIA_ROOT = os.path.join(BASE_DIR, 'media')