"""CRUD de especialidades médicas."""
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user, require_admin
from database import db
from models import Especialidad, EspecialidadCreate

router = APIRouter(tags=["Especialidades"])

DEFAULT_SPECIALTIES = [
    'Odontología General', 'Endodoncia', 'Ortodoncia',
    'Cirugía Maxilofacial', 'Periodoncia', 'Odontopediatría',
    'Prostodoncia', 'Implantología',
]


@router.get("/especialidades", response_model=List[Especialidad])
async def get_especialidades(current_user: dict = Depends(get_current_user)):
    return await db.especialidades.find({}, {"_id": 0}).sort("nombre", 1).to_list(None)


@router.post("/especialidades", response_model=Especialidad)
async def create_especialidad(
    data: EspecialidadCreate,
    current_user: dict = Depends(require_admin),
):
    nombre = data.nombre.strip()
    if not nombre:
        raise HTTPException(422, "El nombre no puede estar vacío")
    if await db.especialidades.find_one({"nombre": nombre}):
        raise HTTPException(409, "La especialidad ya existe")
    doc = {"id": str(uuid.uuid4()), "nombre": nombre}
    await db.especialidades.insert_one(doc)
    return Especialidad(**doc)


@router.delete("/especialidades/{especialidad_id}")
async def delete_especialidad(
    especialidad_id: str,
    current_user: dict = Depends(require_admin),
):
    result = await db.especialidades.delete_one({"id": especialidad_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Especialidad no encontrada")
    return {"mensaje": "Especialidad eliminada"}
