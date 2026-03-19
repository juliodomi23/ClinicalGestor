"""Rutas clínicas: notas y archivos médicos por paciente."""
import uuid
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth import get_current_user
from database import db
from models import (
    NotaClinica, NotaClinicaCreate,
    ArchivoMedico, ArchivoMedicoCreate,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Notas", "Archivos"])


# ── Notas clínicas ────────────────────────────────────────────────────────────

@router.get("/patients/{patient_id}/notas", response_model=List[NotaClinica])
async def get_patient_notes(patient_id: str, current_user: dict = Depends(get_current_user)):
    notas = await db.notas_clinicas.find(
        {"paciente_id": patient_id}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)

    # Carga doctores en 1 query (evita N+1)
    doctor_ids = list({n.get("doctor_id") for n in notas if n.get("doctor_id")})
    doctors = {
        d["id"]: d["nombre"]
        for d in await db.doctors.find(
            {"id": {"$in": doctor_ids}}, {"_id": 0}
        ).to_list(None)
    }
    for nota in notas:
        nota["doctor_nombre"] = doctors.get(nota.get("doctor_id"), "Desconocido")
    return notas


@router.post("/patients/{patient_id}/notas", response_model=NotaClinica)
async def create_patient_note(
    patient_id: str,
    nota_data: NotaClinicaCreate,
    current_user: dict = Depends(get_current_user),
):
    nota_doc = {
        "id":          str(uuid.uuid4()),
        "paciente_id": patient_id,
        "doctor_id":   current_user["id"],
        "contenido":   nota_data.contenido,
        "tags":        nota_data.tags,
        "fecha":       datetime.now(timezone.utc).isoformat(),
    }
    await db.notas_clinicas.insert_one(nota_doc)
    nota_doc["doctor_nombre"] = current_user["nombre"]
    return NotaClinica(**nota_doc)


# ── Archivos médicos ──────────────────────────────────────────────────────────

@router.get("/patients/{patient_id}/archivos", response_model=List[ArchivoMedico])
async def get_patient_files(patient_id: str, current_user: dict = Depends(get_current_user)):
    return await db.archivos_medicos.find(
        {"paciente_id": patient_id}, {"_id": 0}
    ).to_list(100)


@router.post("/patients/{patient_id}/archivos", response_model=ArchivoMedico)
async def create_patient_file(
    patient_id: str,
    archivo_data: ArchivoMedicoCreate,
    current_user: dict = Depends(get_current_user),
):
    archivo_doc = {
        "id":          str(uuid.uuid4()),
        "paciente_id": patient_id,
        "nombre":      archivo_data.nombre,
        "tipo":        archivo_data.tipo,
        "url":         archivo_data.url,
        "descripcion": archivo_data.descripcion,
        "fecha":       datetime.now(timezone.utc).isoformat(),
    }
    await db.archivos_medicos.insert_one(archivo_doc)
    return ArchivoMedico(**archivo_doc)


@router.post("/patients/{patient_id}/archivos/upload", response_model=ArchivoMedico)
async def upload_archivo_to_drive(
    patient_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Recibe un archivo del dispositivo, lo sube a Google Drive y lo vincula al paciente."""
    from drive import upload_to_drive
    from config import GOOGLE_DRIVE_FOLDER_ID

    content = await file.read()
    mimetype = file.content_type or 'application/octet-stream'
    try:
        drive_file = await upload_to_drive(
            content, file.filename or 'archivo', mimetype,
            GOOGLE_DRIVE_FOLDER_ID or None,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    tipo = (
        'imagen' if mimetype.startswith('image/') else
        'pdf'    if mimetype == 'application/pdf' else
        'documento'
    )
    archivo_doc = {
        "id":          str(uuid.uuid4()),
        "paciente_id": patient_id,
        "nombre":      drive_file['name'],
        "tipo":        tipo,
        "url":         drive_file['url'],
        "descripcion": None,
        "fecha":       datetime.now(timezone.utc).isoformat(),
    }
    await db.archivos_medicos.insert_one(archivo_doc)
    logger.info(f"Archivo '{drive_file['name']}' subido a Drive para paciente {patient_id}")
    return ArchivoMedico(**archivo_doc)


@router.delete("/patients/{patient_id}/archivos/{archivo_id}")
async def delete_patient_file(
    patient_id: str,
    archivo_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = await db.archivos_medicos.delete_one(
        {"id": archivo_id, "paciente_id": patient_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Archivo no encontrado")
    return {"mensaje": "Archivo eliminado"}
