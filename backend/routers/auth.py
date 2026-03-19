"""Rutas de autenticación: /api/auth/*"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from auth import (
    hash_password, verify_password, create_token,
    get_current_user, require_admin,
)
from database import db
from models import UserCreate, UserLogin, UserResponse, TokenResponse, UserRole, GoogleLoginRequest
from rate_limit import login_limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Helper compartido ─────────────────────────────────────────────────────────

async def _create_user_internal(user_data: UserCreate) -> UserResponse:
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user_id = str(uuid.uuid4())
    now     = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id":         user_id,
        "email":      user_data.email,
        "nombre":     user_data.nombre,
        "rol":        user_data.rol,
        "password":   hash_password(user_data.password),
        "created_at": now,
    }
    await db.users.insert_one(user_doc)
    logger.info(f"Usuario creado: {user_data.email} ({user_data.rol})")
    return UserResponse(
        id=user_id, email=user_data.email,
        nombre=user_data.nombre, rol=user_data.rol, created_at=now,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/bootstrap", response_model=UserResponse)
async def bootstrap_admin(user_data: UserCreate):
    """
    Crea el primer administrador del sistema.
    Solo funciona si no existe NINGÚN usuario en la base de datos.
    """
    if await db.users.count_documents({}) > 0:
        raise HTTPException(
            status_code=403,
            detail="Ya existen usuarios en el sistema. Usa /admin/usuarios para crear cuentas adicionales.",
        )
    if user_data.rol != UserRole.ADMIN:
        raise HTTPException(
            status_code=400, detail="El primer usuario creado debe tener rol 'admin'."
        )
    return await _create_user_internal(user_data)


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, _: dict = Depends(require_admin)):
    """Crear cuenta de usuario. Solo accesible por administradores."""
    return await _create_user_internal(user_data)


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    if not login_limiter.is_allowed(credentials.email):
        logger.warning(f"Rate limit excedido en login para: {credentials.email}")
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Espera un minuto antes de intentarlo de nuevo.",
        )
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        logger.warning(f"Login fallido para: {credentials.email}")
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = create_token(user["id"], user["email"], user["rol"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"], email=user["email"],
            nombre=user["nombre"], rol=user["rol"], created_at=user["created_at"],
        ),
    )


@router.post("/google", response_model=TokenResponse)
async def google_login(body: GoogleLoginRequest):
    """
    Autentica con un ID token de Google.
    El usuario debe existir previamente en el sistema (creado por un admin).
    """
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    from config import GOOGLE_CLIENT_ID

    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Sign-In no está configurado en este servidor.")
    try:
        id_info = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Token de Google inválido o expirado.")

    email = id_info.get('email')
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso al sistema. Contacta al administrador de la clínica.",
        )

    token = create_token(user["id"], user["email"], user["rol"])
    logger.info(f"Login con Google exitoso: {email}")
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"], email=user["email"],
            nombre=user["nombre"], rol=user["rol"], created_at=user["created_at"],
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """
    Renueva el JWT del usuario autenticado.
    El frontend lo llama cuando el token está cerca de expirar (< 60 min).
    """
    new_token = create_token(current_user["id"], current_user["email"], current_user["rol"])
    return TokenResponse(
        access_token=new_token,
        user=UserResponse(**current_user),
    )
