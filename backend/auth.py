"""
Utilidades de autenticación: JWT, bcrypt y dependencias de FastAPI.
"""
import hmac
import logging
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, WEBHOOK_API_KEY
from models import UserRole
from rate_limit import webhook_limiter

logger   = logging.getLogger(__name__)
security = HTTPBearer()


# ── Contraseñas ───────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_token(user_id: str, email: str, rol: str) -> str:
    payload = {
        "sub":   user_id,
        "email": email,
        "rol":   rol,
        "exp":   datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    from database import db  # import local para evitar circular import en startup

    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("rol") != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Se requieren permisos de administrador"
        )
    return current_user


# ── Webhook API key ───────────────────────────────────────────────────────────

def _verify_key_safe(api_key: str) -> bool:
    """Comparación en tiempo constante para evitar timing attacks."""
    return hmac.compare_digest(api_key.encode(), WEBHOOK_API_KEY.encode())


def verify_webhook_key(api_key: str = Query(..., alias="api_key")) -> bool:
    if not _verify_key_safe(api_key):
        logger.warning("Intento de acceso webhook con API key inválida")
        raise HTTPException(status_code=401, detail="API key inválida")
    if not webhook_limiter.is_allowed(api_key):
        raise HTTPException(
            status_code=429, detail="Límite de peticiones excedido. Intenta en un minuto."
        )
    return True
