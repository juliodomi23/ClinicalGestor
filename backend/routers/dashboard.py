"""Rutas de dashboard, KPIs y config pública: /api/dashboard/* y /api/config"""
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from auth import get_current_user
from database import db
from models import KPIResponse
from config import (
    CLINIC_NAME, CLINIC_LOGO_URL, CLINIC_PRIMARY_COLOR,
    CLINIC_PHONE, CLINIC_ADDRESS, CLINIC_TIMEZONE,
    WORK_START, WORK_END, SLOT_DURATION, APPOINTMENT_PRICE,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Dashboard", "Sistema"])


@router.get("/dashboard/kpis", response_model=KPIResponse)
async def get_dashboard_kpis(current_user: dict = Depends(get_current_user)):
    today       = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month_start = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")

    pacientes_hoy, citas_completadas, citas_canceladas, nuevos_pacientes = await asyncio.gather(
        db.appointments.count_documents({"fecha": today}),
        db.appointments.count_documents({"fecha": {"$gte": month_start}, "estado": "atendido"}),
        db.appointments.count_documents({"fecha": {"$gte": month_start}, "estado": "cancelada"}),
        db.patients.count_documents({"created_at": {"$gte": month_start}}),
    )
    return KPIResponse(
        pacientes_hoy=pacientes_hoy,
        ingresos_mes=citas_completadas * APPOINTMENT_PRICE,
        citas_completadas=citas_completadas,
        citas_canceladas=citas_canceladas,
        nuevos_pacientes=nuevos_pacientes,
    )


@router.get("/")
async def root():
    return {"message": "Dentu API v1.0", "status": "ok"}


@router.get("/config")
async def get_clinic_config():
    """
    Endpoint público — devuelve la configuración de la clínica.
    El frontend lo usa al arrancar para mostrar nombre, logo y horarios.
    """
    return {
        "clinic_name":          CLINIC_NAME,
        "clinic_logo_url":      CLINIC_LOGO_URL,
        "clinic_primary_color": CLINIC_PRIMARY_COLOR,
        "clinic_phone":         CLINIC_PHONE,
        "clinic_address":       CLINIC_ADDRESS,
        "clinic_timezone":      CLINIC_TIMEZONE,
        "work_start":           WORK_START,
        "work_end":             WORK_END,
        "slot_duration":        SLOT_DURATION,
    }
