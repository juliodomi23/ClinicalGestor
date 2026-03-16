"""Rutas de administración de usuarios: /api/admin/*"""
import logging
from typing import List

from fastapi import APIRouter, HTTPException, Depends

from auth import hash_password, require_admin
from database import db
from models import UserCreate, UserResponse, MessageResponse
from routers.auth import _create_user_internal

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/usuarios", response_model=List[UserResponse])
async def list_users(_: dict = Depends(require_admin)):
    """Lista todos los usuarios del sistema."""
    return await db.users.find({}, {"_id": 0, "password": 0}).to_list(200)


@router.post("/usuarios", response_model=UserResponse)
async def create_user(user_data: UserCreate, _: dict = Depends(require_admin)):
    """Crea un nuevo usuario (empleado de la clínica). Solo admins."""
    return await _create_user_internal(user_data)


@router.put("/usuarios/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserCreate,
    current_admin: dict = Depends(require_admin),
):
    """Actualiza datos de un usuario (incluyendo contraseña). Solo admins."""
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(404, "Usuario no encontrado")
    updates = {
        "email":    user_data.email,
        "nombre":   user_data.nombre,
        "rol":      user_data.rol,
        "password": hash_password(user_data.password),
    }
    await db.users.update_one({"id": user_id}, {"$set": updates})
    return UserResponse(
        id=user_id, email=user_data.email,
        nombre=user_data.nombre, rol=user_data.rol,
        created_at=existing["created_at"],
    )


@router.delete("/usuarios/{user_id}", response_model=MessageResponse)
async def delete_user(user_id: str, current_admin: dict = Depends(require_admin)):
    """Elimina un usuario. No puedes eliminarte a ti mismo."""
    if current_admin["id"] == user_id:
        raise HTTPException(400, "No puedes eliminar tu propia cuenta")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Usuario no encontrado")
    logger.info(f"Usuario {user_id} eliminado por admin {current_admin['email']}")
    return MessageResponse(message="Usuario eliminado correctamente")
