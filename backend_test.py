#!/usr/bin/env python3
"""
Backend API Testing for Clínica Dental Management System
Tests authentication, CRUD operations, and core functionality
"""

import requests
import sys
import json
from datetime import datetime
import time

class ClinicAPITester:
    def __init__(self, base_url="https://clinic-flow-42.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")

    def make_request(self, method, endpoint, data=None, expected_status=None):
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)
            
            # Check expected status if provided
            if expected_status and response.status_code != expected_status:
                return False, f"Expected {expected_status}, got {response.status_code}", None
            
            try:
                return True, response.status_code, response.json()
            except:
                return True, response.status_code, response.text
                
        except Exception as e:
            return False, str(e), None

    def test_root_endpoint(self):
        """Test API root endpoint"""
        success, status, data = self.make_request('GET', '', expected_status=200)
        self.log_test("API Root Endpoint", success and status == 200, f"Status: {status}")
        return success

    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(time.time())
        user_data = {
            "email": f"admin2@clinica.com",
            "password": "password123",
            "nombre": "Admin Usuario",
            "rol": "admin"
        }
        
        success, status, data = self.make_request('POST', 'auth/register', user_data)
        
        if success and status == 200 and data and 'access_token' in data:
            self.token = data['access_token']
            self.user_id = data['user']['id']
            self.log_test("User Registration", True)
            return True
        elif success and status == 400:
            # User might already exist, try login
            self.log_test("User Registration", True, "User already exists (expected)")
            return self.test_user_login()
        else:
            self.log_test("User Registration", False, f"Status: {status}, Data: {data}")
            return False

    def test_user_login(self):
        """Test user login with provided credentials"""
        login_data = {
            "email": "admin2@clinica.com",
            "password": "password123"
        }
        
        success, status, data = self.make_request('POST', 'auth/login', login_data, 200)
        
        if success and status == 200 and data and 'access_token' in data:
            self.token = data['access_token']
            self.user_id = data['user']['id']
            self.log_test("User Login", True)
            return True
        else:
            self.log_test("User Login", False, f"Status: {status}, Data: {data}")
            return False

    def test_protected_route(self):
        """Test protected route with JWT token"""
        if not self.token:
            self.log_test("Protected Route (/auth/me)", False, "No token available")
            return False
        
        success, status, data = self.make_request('GET', 'auth/me', expected_status=200)
        
        if success and status == 200 and data and 'email' in data:
            self.log_test("Protected Route (/auth/me)", True)
            return True
        else:
            self.log_test("Protected Route (/auth/me)", False, f"Status: {status}")
            return False

    def test_doctors_endpoints(self):
        """Test doctors CRUD operations"""
        # Get all doctors
        success, status, data = self.make_request('GET', 'doctors', expected_status=200)
        
        if success and status == 200:
            self.log_test("Get All Doctors", True, f"Found {len(data) if isinstance(data, list) else 0} doctors")
        else:
            self.log_test("Get All Doctors", False, f"Status: {status}")
            return False
        
        # Get active doctors
        success, status, data = self.make_request('GET', 'doctors/active/today', expected_status=200)
        
        if success and status == 200:
            self.log_test("Get Active Doctors", True)
        else:
            self.log_test("Get Active Doctors", False, f"Status: {status}")
        
        return True

    def test_patients_endpoints(self):
        """Test patients CRUD operations"""
        # Get all patients
        success, status, data = self.make_request('GET', 'patients', expected_status=200)
        
        if success and status == 200:
            self.log_test("Get All Patients", True, f"Found {len(data) if isinstance(data, list) else 0} patients")
            return True
        else:
            self.log_test("Get All Patients", False, f"Status: {status}")
            return False

    def test_appointments_endpoints(self):
        """Test appointments CRUD operations"""
        # Get all appointments
        success, status, data = self.make_request('GET', 'appointments', expected_status=200)
        
        if success and status == 200:
            self.log_test("Get All Appointments", True, f"Found {len(data) if isinstance(data, list) else 0} appointments")
        else:
            self.log_test("Get All Appointments", False, f"Status: {status}")
            return False
        
        # Get today's appointments
        today = datetime.now().strftime('%Y-%m-%d')
        success, status, data = self.make_request('GET', f'appointments?fecha={today}', expected_status=200)
        
        if success and status == 200:
            self.log_test("Get Today's Appointments", True)
            return True
        else:
            self.log_test("Get Today's Appointments", False, f"Status: {status}")
            return False

    def test_kpi_dashboard(self):
        """Test dashboard KPI endpoints"""
        success, status, data = self.make_request('GET', 'dashboard/kpis', expected_status=200)
        
        if success and status == 200 and data:
            expected_fields = ['pacientes_hoy', 'ingresos_mes', 'citas_completadas', 'citas_canceladas', 'nuevos_pacientes']
            has_all_fields = all(field in data for field in expected_fields)
            
            self.log_test("Dashboard KPIs", has_all_fields, f"KPI data: {data}" if has_all_fields else "Missing KPI fields")
            return has_all_fields
        else:
            self.log_test("Dashboard KPIs", False, f"Status: {status}")
            return False

    def test_webhook_endpoints(self):
        """Test n8n webhook CRUD endpoints (auth via X-API-Key header)"""
        WEBHOOK_KEY = "dentu-n8n-webhook-key-2024"
        wh = {"X-API-Key": WEBHOOK_KEY}
        test_date = datetime.now().strftime("%Y-%m-%d")

        # ── Doctores ──────────────────────────────────────────────────────────
        url = f"{self.base_url}/webhook/doctores"
        r = self.session.get(url, headers=wh)
        ok = r.status_code == 200 and "doctores" in r.json()
        self.log_test("Webhook GET /doctores", ok, f"status={r.status_code}")
        if not ok:
            return False
        doctors = r.json()["doctores"]

        # ── Disponibilidad ────────────────────────────────────────────────────
        url = f"{self.base_url}/webhook/citas/disponibilidad?fecha={test_date}"
        r = self.session.get(url, headers=wh)
        ok = r.status_code == 200 and "disponibilidad" in r.json()
        self.log_test("Webhook GET /citas/disponibilidad", ok, f"slots={r.json().get('slots_disponibles', '?')}")

        # ── Buscar paciente (puede no haber ninguno) ───────────────────────────
        url = f"{self.base_url}/webhook/pacientes/buscar?nombre=test"
        r = self.session.get(url, headers=wh)
        self.log_test("Webhook GET /pacientes/buscar", r.status_code == 200, f"status={r.status_code}")

        # ── Registrar paciente ────────────────────────────────────────────────
        test_phone = f"+521{int(datetime.now().timestamp()) % 10**10:010d}"
        url = f"{self.base_url}/webhook/pacientes/registrar"
        payload = {
            "nombre": "Test", "apellido": "Webhook",
            "telefono": test_phone, "fecha_nacimiento": "1990-01-01",
        }
        r = self.session.post(url, json=payload, headers=wh)
        ok = r.status_code == 200 and "paciente" in r.json()
        self.log_test("Webhook POST /pacientes/registrar", ok, f"status={r.status_code}")
        if not ok or not doctors:
            return True  # no hay doctores con qué agendar, tests básicos OK

        patient_id = r.json()["paciente"]["id"]
        doctor_id  = doctors[0]["id"]

        # ── Agendar cita ──────────────────────────────────────────────────────
        url = f"{self.base_url}/webhook/citas/agendar"
        payload = {
            "paciente_id": patient_id,
            "doctor_id": doctor_id,
            "fecha": test_date,
            "hora_inicio": "07:00",
            "hora_fin": "07:30",
            "motivo": "Test webhook",
            "notas": "",
        }
        r = self.session.post(url, json=payload, headers=wh)
        ok = r.status_code in (200, 409)  # 409 si hay conflicto (test idempotente)
        self.log_test("Webhook POST /citas/agendar", ok, f"status={r.status_code}")
        if r.status_code != 200:
            return True

        cita_id = r.json()["cita_id"]

        # ── Obtener cita ──────────────────────────────────────────────────────
        url = f"{self.base_url}/webhook/citas/{cita_id}"
        r = self.session.get(url, headers=wh)
        self.log_test("Webhook GET /citas/{id}", r.status_code == 200, f"status={r.status_code}")

        # ── Consultar citas ───────────────────────────────────────────────────
        url = f"{self.base_url}/webhook/citas/consultar?fecha={test_date}&doctor_id={doctor_id}"
        r = self.session.get(url, headers=wh)
        ok = r.status_code == 200 and "citas" in r.json()
        self.log_test("Webhook GET /citas/consultar", ok, f"total={r.json().get('total','?')}")

        # ── Actualizar estado ─────────────────────────────────────────────────
        url = f"{self.base_url}/webhook/citas/{cita_id}/estado?estado=en_sala"
        r = self.session.put(url, headers=wh)
        self.log_test("Webhook PUT /citas/{id}/estado", r.status_code == 200, f"status={r.status_code}")

        # ── Reagendar ─────────────────────────────────────────────────────────
        url = f"{self.base_url}/webhook/citas/{cita_id}/reagendar?nueva_fecha={test_date}&nueva_hora=07:00"
        r = self.session.put(url, headers=wh)
        self.log_test("Webhook PUT /citas/{id}/reagendar", r.status_code in (200, 409), f"status={r.status_code}")

        # ── Cancelar ──────────────────────────────────────────────────────────
        url = f"{self.base_url}/webhook/citas/{cita_id}/cancelar"
        r = self.session.put(url, headers=wh)
        self.log_test("Webhook PUT /citas/{id}/cancelar", r.status_code == 200, f"status={r.status_code}")

        # Verificar idempotencia: cancelar de nuevo no debe fallar
        r2 = self.session.put(url, headers=wh)
        self.log_test("Webhook cancelar idempotente", r2.status_code == 200, f"status={r2.status_code}")

        return True
    
    def test_patient_detail_flow(self):
        """Test patient detail related endpoints"""
        # First get a patient ID
        success, status, patients = self.make_request('GET', 'patients', expected_status=200)
        
        if not success or not patients or len(patients) == 0:
            self.log_test("Patient Detail Flow", False, "No patients available for testing")
            return False
        
        patient_id = patients[0]['id']
        
        # Test odontogram
        success, status, data = self.make_request('GET', f'patients/{patient_id}/odontogram', expected_status=200)
        odontogram_success = success and status == 200
        self.log_test("Patient Odontogram", odontogram_success, f"Patient ID: {patient_id}")
        
        # Test clinical notes
        success, status, data = self.make_request('GET', f'patients/{patient_id}/notas', expected_status=200)
        notes_success = success and status == 200
        self.log_test("Patient Clinical Notes", notes_success)
        
        # Test medical files
        success, status, data = self.make_request('GET', f'patients/{patient_id}/archivos', expected_status=200)
        files_success = success and status == 200
        self.log_test("Patient Medical Files", files_success)
        
        return odontogram_success and notes_success and files_success

    def run_all_tests(self):
        """Run comprehensive backend tests"""
        print("🏥 Starting Clínica Dental Backend API Tests")
        print("=" * 50)
        
        # Test sequence
        tests = [
            self.test_root_endpoint,
            self.test_user_registration,
            self.test_protected_route,
            self.test_doctors_endpoints,
            self.test_patients_endpoints,
            self.test_appointments_endpoints,
            self.test_kpi_dashboard,
            self.test_webhook_endpoints,
            self.test_patient_detail_flow,
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"❌ {test.__name__} - Exception: {str(e)}")
                self.tests_run += 1
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Backend Tests Summary:")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        return self.tests_passed, self.tests_run

def main():
    """Main test execution"""
    tester = ClinicAPITester()
    passed, total = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())