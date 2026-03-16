"""
Conexión a MongoDB, creación de índices y seed del admin inicial.
"""
import uuid
import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from config import (
    MONGO_URL, DB_NAME,
    FIRST_ADMIN_EMAIL, FIRST_ADMIN_PASSWORD, FIRST_ADMIN_NAME,
)
from models import UserRole

logger = logging.getLogger(__name__)

client = AsyncIOMotorClient(MONGO_URL)
db     = client[DB_NAME]


async def create_indexes() -> None:
    """Crea índices para optimizar consultas frecuentes y garantizar unicidad."""
    try:
        await db.users.create_index("email", unique=True)
        await db.doctors.create_index("id",    unique=True)
        await db.doctors.create_index("activo")
        await db.doctors.create_index("email", unique=True)
        await db.patients.create_index("id",       unique=True)
        await db.patients.create_index("telefono")
        await db.appointments.create_index("id",         unique=True)
        await db.appointments.create_index("fecha")
        await db.appointments.create_index("paciente_id")
        await db.appointments.create_index("doctor_id")
        await db.appointments.create_index([("fecha", 1), ("doctor_id", 1)])
        await db.appointments.create_index([("fecha", 1), ("estado",   1)])
        await db.notas_clinicas.create_index("paciente_id")
        await db.archivos_medicos.create_index("paciente_id")
        await db.odontograms.create_index("paciente_id", unique=True)
        logger.info("Índices MongoDB creados/verificados.")
    except Exception as e:
        logger.warning(f"Advertencia al crear índices: {e}")


async def seed_first_admin() -> None:
    """
    Si FIRST_ADMIN_EMAIL y FIRST_ADMIN_PASSWORD están en .env
    y no existe ningún usuario, crea el admin inicial automáticamente.
    """
    if not FIRST_ADMIN_EMAIL or not FIRST_ADMIN_PASSWORD:
        return
    if await db.users.count_documents({}) > 0:
        return

    # Import aquí para evitar circular import (auth importa database)
    from auth import hash_password

    user_id = str(uuid.uuid4())
    now     = datetime.now(timezone.utc).isoformat()
    await db.users.insert_one({
        "id":         user_id,
        "email":      FIRST_ADMIN_EMAIL,
        "nombre":     FIRST_ADMIN_NAME,
        "rol":        UserRole.ADMIN,
        "password":   hash_password(FIRST_ADMIN_PASSWORD),
        "created_at": now,
    })
    logger.info(f"✅ Admin inicial creado: {FIRST_ADMIN_EMAIL}")
