// Mock Data for Clínica Dental
// This file provides realistic simulated data for the dental clinic management app

export const TOOTH_STATES = {
  sano: { label: 'Sano', color: 'fill-white', bgColor: 'bg-white' },
  caries: { label: 'Caries', color: 'fill-rose-400', bgColor: 'bg-rose-400' },
  restaurado: { label: 'Restaurado', color: 'fill-blue-400', bgColor: 'bg-blue-400' },
  extraido: { label: 'Extraído', color: 'fill-slate-300 opacity-40', bgColor: 'bg-slate-300' },
  corona: { label: 'Corona', color: 'fill-amber-300', bgColor: 'bg-amber-300' },
  endodoncia: { label: 'Endodoncia', color: 'fill-purple-400', bgColor: 'bg-purple-400' },
};

export const APPOINTMENT_STATES = {
  confirmada: { label: 'Confirmada', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  en_sala: { label: 'En Sala', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  atendido: { label: 'Atendido', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  cancelada: { label: 'Cancelada', color: 'bg-rose-100 text-rose-700 border-rose-300' },
};

export const CLINICAL_TAGS = [
  { id: 'urgencia', label: 'Urgencia', color: 'bg-rose-500 text-white' },
  { id: 'revision', label: 'Revisión', color: 'bg-blue-500 text-white' },
  { id: 'tratamiento_conducto', label: 'Tratamiento de Conducto', color: 'bg-purple-500 text-white' },
  { id: 'limpieza', label: 'Limpieza', color: 'bg-emerald-500 text-white' },
  { id: 'ortodoncia', label: 'Ortodoncia', color: 'bg-amber-500 text-white' },
  { id: 'extraccion', label: 'Extracción', color: 'bg-slate-500 text-white' },
  { id: 'implante', label: 'Implante', color: 'bg-cyan-500 text-white' },
  { id: 'blanqueamiento', label: 'Blanqueamiento', color: 'bg-sky-500 text-white' },
];

export const mockDoctors = [
  {
    id: 'doc-001',
    nombre: 'Dra. María García',
    especialidad: 'Odontología General',
    email: 'maria.garcia@clinica.com',
    telefono: '+52 555 123 4567',
    color: '#0ea5e9',
    activo: true,
    avatar_url: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=200',
    citas_hoy: 8,
  },
  {
    id: 'doc-002',
    nombre: 'Dr. Carlos Mendoza',
    especialidad: 'Endodoncia',
    email: 'carlos.mendoza@clinica.com',
    telefono: '+52 555 234 5678',
    color: '#10b981',
    activo: true,
    avatar_url: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=200',
    citas_hoy: 6,
  },
  {
    id: 'doc-003',
    nombre: 'Dra. Ana Rodríguez',
    especialidad: 'Ortodoncia',
    email: 'ana.rodriguez@clinica.com',
    telefono: '+52 555 345 6789',
    color: '#8b5cf6',
    activo: true,
    avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
    citas_hoy: 5,
  },
  {
    id: 'doc-004',
    nombre: 'Dr. Roberto Sánchez',
    especialidad: 'Cirugía Maxilofacial',
    email: 'roberto.sanchez@clinica.com',
    telefono: '+52 555 456 7890',
    color: '#f59e0b',
    activo: false,
    avatar_url: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200',
    citas_hoy: 0,
  },
];

export const mockPatients = [
  {
    id: 'pat-001',
    nombre: 'Juan',
    apellido: 'Pérez López',
    email: 'juan.perez@email.com',
    telefono: '+52 555 111 2222',
    fecha_nacimiento: '1985-03-15',
    direccion: 'Calle Reforma 123, Col. Centro, CDMX',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    alertas_medicas: [
      { tipo: 'Alergia', descripcion: 'Alérgico a la penicilina', severidad: 'alta' },
    ],
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'pat-002',
    nombre: 'María',
    apellido: 'González Ruiz',
    email: 'maria.gonzalez@email.com',
    telefono: '+52 555 222 3333',
    fecha_nacimiento: '1990-07-22',
    direccion: 'Av. Insurgentes Sur 456, Col. Roma, CDMX',
    avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200',
    alertas_medicas: [
      { tipo: 'Condición', descripcion: 'Diabética tipo 2', severidad: 'alta' },
      { tipo: 'Medicamento', descripcion: 'Toma Metformina', severidad: 'media' },
    ],
    created_at: '2024-02-20T14:30:00Z',
  },
  {
    id: 'pat-003',
    nombre: 'Roberto',
    apellido: 'Hernández Castro',
    email: 'roberto.hernandez@email.com',
    telefono: '+52 555 333 4444',
    fecha_nacimiento: '1978-11-08',
    direccion: 'Calle Madero 789, Col. Polanco, CDMX',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    alertas_medicas: [],
    created_at: '2024-03-10T09:15:00Z',
  },
  {
    id: 'pat-004',
    nombre: 'Laura',
    apellido: 'Martínez Vega',
    email: 'laura.martinez@email.com',
    telefono: '+52 555 444 5555',
    fecha_nacimiento: '1995-05-30',
    direccion: 'Av. Universidad 321, Col. Del Valle, CDMX',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200',
    alertas_medicas: [
      { tipo: 'Alergia', descripcion: 'Alérgica al látex', severidad: 'alta' },
    ],
    created_at: '2024-03-25T16:45:00Z',
  },
  {
    id: 'pat-005',
    nombre: 'Pedro',
    apellido: 'Ramírez Flores',
    email: 'pedro.ramirez@email.com',
    telefono: '+52 555 555 6666',
    fecha_nacimiento: '1982-09-12',
    direccion: 'Calle Juárez 654, Col. Condesa, CDMX',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
    alertas_medicas: [
      { tipo: 'Condición', descripcion: 'Hipertenso', severidad: 'media' },
    ],
    created_at: '2024-04-05T11:20:00Z',
  },
];

// Generate today's date and surrounding dates
const today = new Date();
const formatDate = (date) => date.toISOString().split('T')[0];

export const mockAppointments = [
  // Today's appointments
  {
    id: 'apt-001',
    paciente_id: 'pat-001',
    doctor_id: 'doc-001',
    fecha: formatDate(today),
    hora_inicio: '09:00',
    hora_fin: '09:30',
    motivo: 'Limpieza dental',
    estado: 'atendido',
    paciente_nombre: 'Juan Pérez López',
    doctor_nombre: 'Dra. María García',
    doctor_color: '#0ea5e9',
  },
  {
    id: 'apt-002',
    paciente_id: 'pat-002',
    doctor_id: 'doc-001',
    fecha: formatDate(today),
    hora_inicio: '10:00',
    hora_fin: '11:00',
    motivo: 'Revisión de caries',
    estado: 'en_sala',
    paciente_nombre: 'María González Ruiz',
    doctor_nombre: 'Dra. María García',
    doctor_color: '#0ea5e9',
  },
  {
    id: 'apt-003',
    paciente_id: 'pat-003',
    doctor_id: 'doc-002',
    fecha: formatDate(today),
    hora_inicio: '09:30',
    hora_fin: '10:30',
    motivo: 'Tratamiento de conducto',
    estado: 'confirmada',
    paciente_nombre: 'Roberto Hernández Castro',
    doctor_nombre: 'Dr. Carlos Mendoza',
    doctor_color: '#10b981',
  },
  {
    id: 'apt-004',
    paciente_id: 'pat-004',
    doctor_id: 'doc-003',
    fecha: formatDate(today),
    hora_inicio: '11:00',
    hora_fin: '12:00',
    motivo: 'Ajuste de brackets',
    estado: 'confirmada',
    paciente_nombre: 'Laura Martínez Vega',
    doctor_nombre: 'Dra. Ana Rodríguez',
    doctor_color: '#8b5cf6',
  },
  {
    id: 'apt-005',
    paciente_id: 'pat-005',
    doctor_id: 'doc-001',
    fecha: formatDate(today),
    hora_inicio: '12:00',
    hora_fin: '12:30',
    motivo: 'Extracción de muela del juicio',
    estado: 'confirmada',
    paciente_nombre: 'Pedro Ramírez Flores',
    doctor_nombre: 'Dra. María García',
    doctor_color: '#0ea5e9',
  },
  {
    id: 'apt-006',
    paciente_id: 'pat-001',
    doctor_id: 'doc-002',
    fecha: formatDate(today),
    hora_inicio: '14:00',
    hora_fin: '15:00',
    motivo: 'Endodoncia molar inferior',
    estado: 'confirmada',
    paciente_nombre: 'Juan Pérez López',
    doctor_nombre: 'Dr. Carlos Mendoza',
    doctor_color: '#10b981',
  },
  // Tomorrow
  {
    id: 'apt-007',
    paciente_id: 'pat-002',
    doctor_id: 'doc-003',
    fecha: formatDate(new Date(today.getTime() + 86400000)),
    hora_inicio: '09:00',
    hora_fin: '10:00',
    motivo: 'Consulta ortodoncia',
    estado: 'confirmada',
    paciente_nombre: 'María González Ruiz',
    doctor_nombre: 'Dra. Ana Rodríguez',
    doctor_color: '#8b5cf6',
  },
  // Yesterday (past)
  {
    id: 'apt-008',
    paciente_id: 'pat-003',
    doctor_id: 'doc-001',
    fecha: formatDate(new Date(today.getTime() - 86400000)),
    hora_inicio: '10:00',
    hora_fin: '10:30',
    motivo: 'Revisión general',
    estado: 'atendido',
    paciente_nombre: 'Roberto Hernández Castro',
    doctor_nombre: 'Dra. María García',
    doctor_color: '#0ea5e9',
  },
  {
    id: 'apt-009',
    paciente_id: 'pat-004',
    doctor_id: 'doc-002',
    fecha: formatDate(new Date(today.getTime() - 86400000)),
    hora_inicio: '11:00',
    hora_fin: '12:00',
    motivo: 'Dolor molar',
    estado: 'cancelada',
    paciente_nombre: 'Laura Martínez Vega',
    doctor_nombre: 'Dr. Carlos Mendoza',
    doctor_color: '#10b981',
  },
];

export const mockClinicalNotes = [
  {
    id: 'note-001',
    paciente_id: 'pat-001',
    doctor_id: 'doc-001',
    doctor_nombre: 'Dra. María García',
    contenido: 'Paciente presenta inflamación en encías del cuadrante superior derecho. Se recomienda tratamiento con enjuague bucal antiséptico y cita de seguimiento en 2 semanas.',
    tags: ['revision', 'urgencia'],
    fecha: '2024-12-15T10:30:00Z',
  },
  {
    id: 'note-002',
    paciente_id: 'pat-001',
    doctor_id: 'doc-002',
    doctor_nombre: 'Dr. Carlos Mendoza',
    contenido: 'Realizada endodoncia en pieza 36. Procedimiento sin complicaciones. Se prescribe ibuprofeno 400mg cada 8 horas por 3 días.',
    tags: ['tratamiento_conducto'],
    fecha: '2024-12-10T14:15:00Z',
  },
  {
    id: 'note-003',
    paciente_id: 'pat-002',
    doctor_id: 'doc-001',
    doctor_nombre: 'Dra. María García',
    contenido: 'Control de rutina. Paciente diabética controlada. Glucosa en ayunas: 110 mg/dL. Se realiza limpieza dental profunda.',
    tags: ['limpieza', 'revision'],
    fecha: '2024-12-08T09:45:00Z',
  },
];

export const mockOdontogramData = {
  'pat-001': [
    { numero: 11, zonas: { oclusal: 'restaurado', mesial: 'sano', distal: 'sano', vestibular: 'sano', lingual: 'sano' } },
    { numero: 16, zonas: { oclusal: 'caries', mesial: 'caries', distal: 'sano', vestibular: 'sano', lingual: 'sano' } },
    { numero: 26, zonas: { oclusal: 'corona', mesial: 'corona', distal: 'corona', vestibular: 'corona', lingual: 'corona' } },
    { numero: 36, zonas: { oclusal: 'endodoncia', mesial: 'endodoncia', distal: 'sano', vestibular: 'sano', lingual: 'sano' } },
    { numero: 46, zonas: { oclusal: 'restaurado', mesial: 'sano', distal: 'restaurado', vestibular: 'sano', lingual: 'sano' } },
    { numero: 18, zonas: { oclusal: 'extraido', mesial: 'extraido', distal: 'extraido', vestibular: 'extraido', lingual: 'extraido' } },
  ],
  'pat-002': [
    { numero: 14, zonas: { oclusal: 'caries', mesial: 'sano', distal: 'sano', vestibular: 'sano', lingual: 'sano' } },
    { numero: 24, zonas: { oclusal: 'restaurado', mesial: 'restaurado', distal: 'sano', vestibular: 'sano', lingual: 'sano' } },
  ],
};

export const mockMedicalFiles = [
  {
    id: 'file-001',
    paciente_id: 'pat-001',
    nombre: 'Radiografía panorámica',
    tipo: 'radiografia',
    url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&q=80&w=800',
    fecha: '2024-12-01T10:00:00Z',
    descripcion: 'Radiografía panorámica inicial para evaluación general',
  },
  {
    id: 'file-002',
    paciente_id: 'pat-001',
    nombre: 'Periapical molar 36',
    tipo: 'radiografia',
    url: 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&q=80&w=800',
    fecha: '2024-12-10T14:00:00Z',
    descripcion: 'Radiografía periapical para endodoncia',
  },
  {
    id: 'file-003',
    paciente_id: 'pat-002',
    nombre: 'Radiografía panorámica',
    tipo: 'radiografia',
    url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&q=80&w=800',
    fecha: '2024-11-15T09:30:00Z',
    descripcion: 'Evaluación inicial paciente nuevo',
  },
];

export const mockKPIs = {
  pacientes_hoy: 12,
  ingresos_mes: 45750.00,
  citas_completadas: 156,
  citas_canceladas: 8,
  nuevos_pacientes: 23,
};

// Helper to get patient by ID
export const getPatientById = (id) => mockPatients.find(p => p.id === id);

// Helper to get doctor by ID
export const getDoctorById = (id) => mockDoctors.find(d => d.id === id);

// Helper to get appointments for a specific date
export const getAppointmentsByDate = (date) => mockAppointments.filter(a => a.fecha === date);

// Helper to get appointments for a specific doctor
export const getAppointmentsByDoctor = (doctorId) => mockAppointments.filter(a => a.doctor_id === doctorId);
