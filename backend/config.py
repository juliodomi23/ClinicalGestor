"""
Configuración central de la aplicación.
Todas las variables de entorno se leen aquí — una sola fuente de verdad.
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)


def _require_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(
            f"Variable de entorno requerida '{key}' no está definida. "
            f"Revisa tu archivo .env"
        )
    return value


# ── Requeridas (la app no arranca sin estas) ─────────────────────────────────
MONGO_URL       = _require_env('MONGO_URL')
DB_NAME         = _require_env('DB_NAME')
JWT_SECRET      = _require_env('JWT_SECRET')
WEBHOOK_API_KEY = _require_env('WEBHOOK_API_KEY')

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_ALGORITHM        = "HS256"
JWT_EXPIRATION_HOURS = 24

# ── White-label: cada clínica personaliza su .env ────────────────────────────
CLINIC_NAME          = os.environ.get('CLINIC_NAME',          'Clínica Dental')
CLINIC_LOGO_URL      = os.environ.get('CLINIC_LOGO_URL',      '')
CLINIC_PRIMARY_COLOR = os.environ.get('CLINIC_PRIMARY_COLOR', '#0ea5e9')
CLINIC_PHONE         = os.environ.get('CLINIC_PHONE',         '')
CLINIC_ADDRESS       = os.environ.get('CLINIC_ADDRESS',       '')
CLINIC_TIMEZONE      = os.environ.get('CLINIC_TIMEZONE',      'America/Mexico_City')

# ── Horario laboral configurable ─────────────────────────────────────────────
WORK_START        = int(os.environ.get('WORK_START',        '8'))     # hora inicio (0-23)
WORK_END          = int(os.environ.get('WORK_END',          '19'))    # hora fin exclusivo
SLOT_DURATION     = int(os.environ.get('SLOT_DURATION',     '30'))    # minutos por slot
APPOINTMENT_PRICE = float(os.environ.get('APPOINTMENT_PRICE', '150.0'))  # precio base por cita

# ── Admin inicial (bootstrap automático) ─────────────────────────────────────
FIRST_ADMIN_EMAIL    = os.environ.get('FIRST_ADMIN_EMAIL')
FIRST_ADMIN_PASSWORD = os.environ.get('FIRST_ADMIN_PASSWORD')
FIRST_ADMIN_NAME     = os.environ.get('FIRST_ADMIN_NAME', 'Administrador')

# ── Notificaciones (n8n trigger) ─────────────────────────────────────────────
# URL del workflow de n8n que envía WhatsApp/email al paciente.
# Si está vacía, las notificaciones quedan desactivadas.
NOTIFICATION_WEBHOOK_URL = os.environ.get('NOTIFICATION_WEBHOOK_URL', '')

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
    if o.strip()
]
