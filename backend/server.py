"""
Punto de entrada de la aplicación Dentu API.
Solo registra routers, configura CORS y gestiona el lifespan.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, CLINIC_NAME
from database import client, create_indexes, seed_first_admin, seed_specialties
from routers import auth, admin, doctors, patients, appointments, odontogram, clinical, dashboard, webhooks, especialidades

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Iniciando {CLINIC_NAME} API...")
    await create_indexes()
    await seed_first_admin()
    await seed_specialties()
    logger.info("API lista en puerto 8001.")
    yield
    client.close()
    logger.info("Conexión MongoDB cerrada.")


app = FastAPI(
    title=f"{CLINIC_NAME} API",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = "/api"

app.include_router(auth.router,         prefix=PREFIX)
app.include_router(admin.router,        prefix=PREFIX)
app.include_router(doctors.router,      prefix=PREFIX)
app.include_router(patients.router,     prefix=PREFIX)
app.include_router(appointments.router, prefix=PREFIX)
app.include_router(odontogram.router,   prefix=PREFIX)
app.include_router(clinical.router,     prefix=PREFIX)
app.include_router(dashboard.router,    prefix=PREFIX)
app.include_router(webhooks.router,     prefix=PREFIX)
app.include_router(especialidades.router, prefix=PREFIX)
