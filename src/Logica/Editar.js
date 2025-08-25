const { connectionString } = require('../Conexion/Conexion');
const { ipcRenderer } = require('electron');
let empleadoActual = null;
let datosOriginales = {};
let camposModificados = {};
let estaGuardando = false;

// Obtener datos del usuario de localStorage
const userData = JSON.parse(localStorage.getItem('userData'));
const retiroModal = document.getElementById('retiroModal');
const retiroModalTitle = document.getElementById('retiroModalTitle');
const retiroEmployeeName = document.getElementById('retiroEmployeeName');
const fechaFinColaborador = document.getElementById('fechaFinColaborador');
const observacionRetiro = document.getElementById('observacionRetiro');
const btnSaveRetiro = document.getElementById('btnSaveRetiro');
const btnCancelRetiro = document.getElementById('btnCancelRetiro');
const closeRetiroModal = document.getElementById('closeRetiroModal');
// Referencias a elementos DOM
const employeePhoto = document.getElementById('employeePhoto');
const employeeName = document.getElementById('employeeName');
const employeePosition = document.getElementById('employeePosition');
const employeeDepartment = document.getElementById('employeeDepartment');
const employeeStatus = document.getElementById('employeeStatus');
const employeeId = document.getElementById('employeeId');
const changePhotoBtn = document.getElementById('changePhotoBtn');

// Campos del formulario de datos personales
const primerNombre = document.getElementById('primerNombre');
const segundoNombre = document.getElementById('segundoNombre');
const tercerNombre = document.getElementById('tercerNombre');
const primerApellido = document.getElementById('primerApellido');
const segundoApellido = document.getElementById('segundoApellido');
const dpi = document.getElementById('dpi');
const fechaNacimiento = document.getElementById('fechaNacimiento');
const estadoCivil = document.getElementById('estadoCivil');
const hijos = document.getElementById('hijos');

// Botones
const btnSavePersonal = document.getElementById('btnSavePersonal');
const btnCancelPersonal = document.getElementById('btnCancelPersonal');
const btnHistoryPersonal = document.getElementById('btnHistoryPersonal');

// Indicadores de cambio
const indicadores = {
    primerNombre: document.getElementById('indicator-primerNombre'),
    segundoNombre: document.getElementById('indicator-segundoNombre'),
    tercerNombre: document.getElementById('indicator-tercerNombre'),
    primerApellido: document.getElementById('indicator-primerApellido'),
    segundoApellido: document.getElementById('indicator-segundoApellido'),
    dpi: document.getElementById('indicator-dpi'),
    fechaNacimiento: document.getElementById('indicator-fechaNacimiento'),
    estadoCivil: document.getElementById('indicator-estadoCivil'),
    hijos: document.getElementById('indicator-hijos')
};

// Mensajes de sistema
const successMessage = document.getElementById('successMessage');
const warningMessage = document.getElementById('warningMessage');
const infoMessage = document.getElementById('infoMessage');

// Modal de historial
const historyModal = document.getElementById('historyModal');
const historyTimeline = document.getElementById('historyTimeline');
const historyDateFrom = document.getElementById('historyDateFrom');
const historyDateTo = document.getElementById('historyDateTo');
const btnFilterHistory = document.getElementById('btnFilterHistory');
// Variables adicionales para ubicación
let datosOriginalesUbicacion = {};
let camposModificadosUbicacion = {};

// Referencias a elementos DOM de ubicación
const locationSection = document.getElementById('location-section');
const departamentoOrigen = document.getElementById('departamentoOrigen');
const municipioOrigen = document.getElementById('municipioOrigen');
const direccionResidencia = document.getElementById('direccionResidencia');
const departamentoResidencia = document.getElementById('departamentoResidencia');
const municipioResidencia = document.getElementById('municipioResidencia');

// Botones
const btnSaveLocation = document.getElementById('btnSaveLocation');
const btnCancelLocation = document.getElementById('btnCancelLocation');
const btnHistoryLocation = document.getElementById('btnHistoryLocation');

// Indicadores de cambio para ubicación
const indicadoresUbicacion = {
    departamentoOrigen: document.getElementById('indicator-departamentoOrigen'),
    municipioOrigen: document.getElementById('indicator-municipioOrigen'),
    direccionResidencia: document.getElementById('indicator-direccionResidencia'),
    departamentoResidencia: document.getElementById('indicator-departamentoResidencia'),
    municipioResidencia: document.getElementById('indicator-municipioResidencia')
};
// Variables adicionales para contacto
let datosOriginalesContacto = {};
let camposModificadosContacto = {};

// Referencias a elementos DOM de contacto
const contactSection = document.getElementById('contact-section');
const telefono1 = document.getElementById('telefono1');
const telefono2 = document.getElementById('telefono2');
const correoElectronico = document.getElementById('correoElectronico');
const nombreContactoEmergencia = document.getElementById('nombreContactoEmergencia');
const telefonoContactoEmergencia = document.getElementById('telefonoContactoEmergencia');
const parentesco = document.getElementById('parentesco');

// Botones
const btnSaveContact = document.getElementById('btnSaveContact');
const btnCancelContact = document.getElementById('btnCancelContact');
const btnHistoryContact = document.getElementById('btnHistoryContact');
const indicadoresContacto = {
    telefono1: document.getElementById('indicator-telefono1'),
    telefono2: document.getElementById('indicator-telefono2'),
    correoElectronico: document.getElementById('indicator-correoElectronico'),
    nombreContactoEmergencia: document.getElementById('indicator-nombreContactoEmergencia'),
    telefonoContactoEmergencia: document.getElementById('indicator-telefonoContactoEmergencia'),
    parentesco: document.getElementById('indicator-parentesco')
};
let datosOriginalesLaboral = {};
let camposModificadosLaboral = {};

// Referencias a elementos DOM de información laboral
const workSection = document.getElementById('work-section');
const departamento = document.getElementById('departamento');
const puesto = document.getElementById('puesto');
const tipoPersonal = document.getElementById('tipoPersonal');
const planilla = document.getElementById('planilla');
const inicioLaboral = document.getElementById('inicioLaboral');
const fechaContrato = document.getElementById('fechaContrato');
const fechaPlanilla = document.getElementById('fechaPlanilla');
const estadoLaboral = document.getElementById('estadoLaboral');

// Botones
const btnSaveWork = document.getElementById('btnSaveWork');
const btnCancelWork = document.getElementById('btnCancelWork');
const btnHistoryWork = document.getElementById('btnHistoryWork');

// Indicadores de cambio para información laboral
const indicadoresLaboral = {
    departamento: document.getElementById('indicator-departamento'),
    puesto: document.getElementById('indicator-puesto'),
    tipoPersonal: document.getElementById('indicator-tipoPersonal'),
    planilla: document.getElementById('indicator-planilla'),
    inicioLaboral: document.getElementById('indicator-inicioLaboral'),
    fechaContrato: document.getElementById('indicator-fechaContrato'),
    fechaPlanilla: document.getElementById('indicator-fechaPlanilla'),
    estadoLaboral: document.getElementById('indicator-estadoLaboral')
};
const salarioBase = document.getElementById('salarioBase');
const bonificacion = document.getElementById('bonificacion');
const salarioDiario = document.getElementById('salarioDiario');
const salarioQuincena = document.getElementById('salarioQuincena');
const salarioQuincenaFinMes = document.getElementById('salarioQuincenaFinMes');
const igss = document.getElementById('igss');
const irtra = document.getElementById('irtra');
const noCuenta = document.getElementById('noCuenta');

// Indicadores de cambio adicionales
const indicadoresAdicionales = {
    salarioBase: document.getElementById('indicator-salarioBase'),
    bonificacion: document.getElementById('indicator-bonificacion'),
    salarioDiario: document.getElementById('indicator-salarioDiario'),
    salarioQuincena: document.getElementById('indicator-salarioQuincena'),
    salarioQuincenaFinMes: document.getElementById('indicator-salarioQuincenaFinMes'),
    igss: document.getElementById('indicator-igss'),
    irtra: document.getElementById('indicator-irtra'),
    noCuenta: document.getElementById('indicator-noCuenta')
};

// Fusionar con indicadores existentes
Object.assign(indicadoresLaboral, indicadoresAdicionales);
let datosOriginalesAcademicos = {};
let camposModificadosAcademicos = {};
let infoAcademicaId = null; // Para guardar el ID de la información académica

// Referencias a elementos DOM de información académica
const academicSection = document.getElementById('academic-section');
const estadoPrimaria = document.getElementById('estadoPrimaria');
const planEstudioPrimaria = document.getElementById('planEstudioPrimaria');
const nivelAcademicoPrimaria = document.getElementById('nivelAcademicoPrimaria');
const estadoBasico = document.getElementById('estadoBasico');
const planEstudioBasico = document.getElementById('planEstudioBasico');
const nivelAcademicoBasico = document.getElementById('nivelAcademicoBasico');
const estadoDiversificado = document.getElementById('estadoDiversificado');
const planEstudioDiversificado = document.getElementById('planEstudioDiversificado');
const nivelAcademicoDiversificado = document.getElementById('nivelAcademicoDiversificado');
const carreraDiversificado = document.getElementById('carreraDiversificado');
const estadoUniversidad = document.getElementById('estadoUniversidad');
const planEstudioUniversitario = document.getElementById('planEstudioUniversitario');
const nivelAcademicoUnivesitario = document.getElementById('nivelAcademicoUnivesitario');
const universidad = document.getElementById('universidad');
const carreraUniversitaria = document.getElementById('carreraUniversitaria');
const estadoMaestria = document.getElementById('estadoMaestria');
const planEstudio = document.getElementById('planEstudio');
const nivelAcademicoMaestria = document.getElementById('nivelAcademicoMaestria');
const universidadMaestria = document.getElementById('universidadMaestria');
const maestria = document.getElementById('maestria');

// Botones
const btnSaveAcademic = document.getElementById('btnSaveAcademic');
const btnCancelAcademic = document.getElementById('btnCancelAcademic');
const btnHistoryAcademic = document.getElementById('btnHistoryAcademic');

// Indicadores de cambio para información académica
const indicadoresAcademicos = {
    estadoPrimaria: document.getElementById('indicator-estadoPrimaria'),
    planEstudioPrimaria: document.getElementById('indicator-planEstudioPrimaria'),
    nivelAcademicoPrimaria: document.getElementById('indicator-nivelAcademicoPrimaria'),
    estadoBasico: document.getElementById('indicator-estadoBasico'),
    planEstudioBasico: document.getElementById('indicator-planEstudioBasico'),
    nivelAcademicoBasico: document.getElementById('indicator-nivelAcademicoBasico'),
    estadoDiversificado: document.getElementById('indicator-estadoDiversificado'),
    planEstudioDiversificado: document.getElementById('indicator-planEstudioDiversificado'),
    nivelAcademicoDiversificado: document.getElementById('indicator-nivelAcademicoDiversificado'),
    carreraDiversificado: document.getElementById('indicator-carreraDiversificado'),
    estadoUniversidad: document.getElementById('indicator-estadoUniversidad'),
    planEstudioUniversitario: document.getElementById('indicator-planEstudioUniversitario'),
    nivelAcademicoUnivesitario: document.getElementById('indicator-nivelAcademicoUnivesitario'),
    universidad: document.getElementById('indicator-universidad'),
    carreraUniversitaria: document.getElementById('indicator-carreraUniversitaria'),
    estadoMaestria: document.getElementById('indicator-estadoMaestria'),
    planEstudio: document.getElementById('indicator-planEstudio'),
    nivelAcademicoMaestria: document.getElementById('indicator-nivelAcademicoMaestria'),
    universidadMaestria: document.getElementById('indicator-universidadMaestria'),
    maestria: document.getElementById('indicator-maestria')
};
let datosOriginalesDocumentos = {};
let camposModificadosDocumentos = {};

// Referencias a elementos DOM de documentación
const documentsSection = document.getElementById('documents-section');
const nit = document.getElementById('nit');
const idLicencia = document.getElementById('idLicencia');
const fechaVencimientoTS = document.getElementById('fechaVencimientoTS');
const fechaVencimientoTM = document.getElementById('fechaVencimientoTM');

// Botones
const btnSaveDocuments = document.getElementById('btnSaveDocuments');
const btnCancelDocuments = document.getElementById('btnCancelDocuments');
const btnHistoryDocuments = document.getElementById('btnHistoryDocuments');

// Indicadores de cambio para documentación
const indicadoresDocumentos = {
    nit: document.getElementById('indicator-nit'),
    idLicencia: document.getElementById('indicator-idLicencia'),
    fechaVencimientoTS: document.getElementById('indicator-fechaVencimientoTS'),
    fechaVencimientoTM: document.getElementById('indicator-fechaVencimientoTM')
};
let pmaChartInstance = null;
let currentPMAId = null;
let isEditingPMA = false;

// Referencias a elementos DOM de PMA
const pmaSection = document.getElementById('pma-section');
const pmaResultsContainer = document.getElementById('pmaResultsContainer');
const pmaResultsTableBody = document.getElementById('pmaResultsTableBody');
const noPMAResults = document.getElementById('noPMAResults');
const pmaForm = document.getElementById('pmaForm');
const pmaFormTitle = document.getElementById('pmaFormTitle');
const pmaDetailView = document.getElementById('pmaDetailView');

// Campos del formulario PMA
const fechaEvaluacionPMA = document.getElementById('fechaEvaluacionPMA');
const factorV = document.getElementById('factorV');
const factorE = document.getElementById('factorE');
const factorR = document.getElementById('factorR');
const factorN = document.getElementById('factorN');
const factorF = document.getElementById('factorF');

// Elementos del detalle PMA
const pmaDetailDate = document.getElementById('pmaDetailDate');
const pmaDetailEvaluator = document.getElementById('pmaDetailEvaluator');
const pmaDetailV = document.getElementById('pmaDetailV');
const pmaDetailE = document.getElementById('pmaDetailE');
const pmaDetailR = document.getElementById('pmaDetailR');
const pmaDetailN = document.getElementById('pmaDetailN');
const pmaDetailF = document.getElementById('pmaDetailF');
const pmaDetailAvg = document.getElementById('pmaDetailAvg');
const pmaDetailVinterp = document.getElementById('pmaDetailVinterp');
const pmaDetailEinterp = document.getElementById('pmaDetailEinterp');
const pmaDetailRinterp = document.getElementById('pmaDetailRinterp');
const pmaDetailNinterp = document.getElementById('pmaDetailNinterp');
const pmaDetailFinterp = document.getElementById('pmaDetailFinterp');
const pmaDetailAvgInterp = document.getElementById('pmaDetailAvgInterp');

// Botones
const btnAddPMA = document.getElementById('btnAddPMA');
const btnSavePMA = document.getElementById('btnSavePMA');
const btnCancelPMA = document.getElementById('btnCancelPMA');
const btnHistoryPMA = document.getElementById('btnHistoryPMA');
const btnBackToPMAList = document.getElementById('btnBackToPMAList');

let selectedFile = null;

// Referencias a elementos DOM para cambio de foto
const photoModal = document.getElementById('photoModal');
const currentPhoto = document.getElementById('currentPhoto');
const newPhoto = document.getElementById('newPhoto');
const newPhotoPreview = document.getElementById('newPhotoPreview');
const photoInput = document.getElementById('photoInput');
const btnSavePhoto = document.getElementById('btnSavePhoto');
const btnCancelPhoto = document.getElementById('btnCancelPhoto');
const closePhotoModal = document.getElementById('closePhotoModal');
// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        
        // Inicializar fecha de hoy como tope para fechas de nacimiento
        const today = new Date().toISOString().split('T')[0];
        fechaNacimiento.setAttribute('max', today);
        
        // Mostrar mensaje informativo al iniciar
        mostrarMensajeSistema(infoMessage, 'Los campos marcados con * son obligatorios');
        
        // Obtener ID del empleado desde URL
        const urlParams = new URLSearchParams(window.location.search);
        const idEmpleado = urlParams.get('id');
        
        if (!idEmpleado) {
            mostrarNotificacion('ID de empleado no especificado', 'error');
            setTimeout(() => {
                window.location.href = 'BusquedaP.html';
            }, 2000);
            return;
        }
        
        // Cargar datos del empleado
        await cargarDatosEmpleado(idEmpleado);
        
        // Cargar datos de estados civiles
        await cargarEstadosCiviles();
        
        // Inicializar eventos para las diferentes secciones
        inicializarEventos(); // Datos personales
        inicializarEventosUbicacion(); // Ubicación
        inicializarEventosContacto(); // Contacto
        inicializarEventosLaboral(); //Laboral
        inicializarEventosAcademicos();
        inicializarEventosDocumentos();
        inicializarEventosPMA();
        inicializarEventosFoto();
        // Mostrar sección personal por defecto
        mostrarSeccion('personal');
        
    } catch (error) {
        console.error('Error al inicializar la página:', error);
        mostrarNotificacion('Error al inicializar la página: ' + error.message, 'error');
    }
});

// Cargar datos del empleado
async function cargarDatosEmpleado(idEmpleado) {
    try {
        mostrarCargando(true, 'Cargando datos del colaborador...');
        
        const connection = await connectionString();
        const query = `
            SELECT 
                personal.IdPersonal,
                personal.PrimerNombre, 
                personal.SegundoNombre,
                personal.TercerNombre,
                personal.PrimerApellido,
                personal.SegundoApellido,
                personal.DPI,
                personal.FechaNacimiento,
                personal.IdEstadoCivil,
                personal.Hijos,
                departamentos.NombreDepartamento, 
                PuestosGenerales.Nombre AS Puesto,
                EstadoPersonal.EstadoPersonal,
                personal.Estado as EstadoId,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM
                personal 
                LEFT JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                LEFT JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                LEFT JOIN PuestosGenerales ON Puestos.Id_PuestoGeneral = PuestosGenerales.Id_Puesto
                LEFT JOIN EstadoPersonal ON personal.Estado = EstadoPersonal.IdEstado
                LEFT JOIN FotosPersonal ON personal.IdPersonal = FotosPersonal.IdPersonal
            WHERE 
                personal.IdPersonal = ?
        `;
        
        const result = await connection.query(query, [idEmpleado]);
        await connection.close();
        
        if (result.length === 0) {
            throw new Error('Empleado no encontrado');
        }
        
        empleadoActual = result[0];
        
        // Guardar datos originales para detectar cambios
        datosOriginales = {
            primerNombre: empleadoActual.PrimerNombre || '',
            segundoNombre: empleadoActual.SegundoNombre || '',
            tercerNombre: empleadoActual.TercerNombre || '',
            primerApellido: empleadoActual.PrimerApellido || '',
            segundoApellido: empleadoActual.SegundoApellido || '',
            dpi: empleadoActual.DPI || '',
            fechaNacimiento: empleadoActual.FechaNacimiento ? new Date(empleadoActual.FechaNacimiento).toISOString().split('T')[0] : '',
            estadoCivil: empleadoActual.IdEstadoCivil || '',
            hijos: empleadoActual.Hijos || 0
        };
        
        // Mostrar información del empleado en el encabezado
        employeePhoto.src = empleadoActual.FotoBase64 || '../Imagenes/user-default.png';
        employeeName.textContent = `${empleadoActual.PrimerNombre} ${empleadoActual.PrimerApellido}`;
        employeePosition.textContent = empleadoActual.Puesto || 'No asignado';
        employeeDepartment.textContent = empleadoActual.NombreDepartamento || 'No asignado';
        employeeStatus.textContent = empleadoActual.EstadoPersonal;
        employeeId.textContent = empleadoActual.IdPersonal;
        
        // Asignar la clase correspondiente al badge de estado
        if (empleadoActual.EstadoId !== 1) {
            employeeStatus.classList.add('inactive');
        }
        
        // Rellenar el formulario con los datos
        primerNombre.value = datosOriginales.primerNombre;
        segundoNombre.value = datosOriginales.segundoNombre;
        tercerNombre.value = datosOriginales.tercerNombre;
        primerApellido.value = datosOriginales.primerApellido;
        segundoApellido.value = datosOriginales.segundoApellido;
        dpi.value = datosOriginales.dpi;
        fechaNacimiento.value = datosOriginales.fechaNacimiento;
        hijos.value = datosOriginales.hijos;
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar datos del empleado:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar datos: ' + error.message, 'error');
        setTimeout(() => {
            window.location.href = 'BusquedaP.html';
        }, 2000);
    }
}

// Cargar estados civiles
async function cargarEstadosCiviles() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdCivil, EstadoCivil
            FROM estadocivil
            ORDER BY IdCivil
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        estadoCivil.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar opciones al select
        result.forEach(estado => {
            const option = document.createElement('option');
            option.value = estado.IdCivil;
            option.textContent = estado.EstadoCivil;
            estadoCivil.appendChild(option);
        });
        
        // Seleccionar el estado civil actual
        estadoCivil.value = datosOriginales.estadoCivil;
        
    } catch (error) {
        console.error('Error al cargar estados civiles:', error);
        mostrarNotificacion('Error al cargar estados civiles', 'error');
    }
}

// Inicializar eventos
function inicializarEventos() {
    // Evento para campos de texto - detectar cambios
    [primerNombre, segundoNombre, tercerNombre, primerApellido, segundoApellido, dpi].forEach(campo => {
        campo.addEventListener('input', function() {
            verificarCambioEnCampo(campo.id);
        });
    });
    
    // Evento para campos de número
    hijos.addEventListener('input', function() {
        verificarCambioEnCampo(hijos.id);
    });
    
    // Eventos para campos de fecha y select
    fechaNacimiento.addEventListener('change', function() {
        verificarCambioEnCampo(fechaNacimiento.id);
    });
    
    estadoCivil.addEventListener('change', function() {
        verificarCambioEnCampo(estadoCivil.id);
    });
    
    // Botón guardar
    btnSavePersonal.addEventListener('click', guardarCambiosPersonales);
    
    // Botón cancelar
    btnCancelPersonal.addEventListener('click', cancelarCambios);
    
    // Botón de historial
    btnHistoryPersonal.addEventListener('click', mostrarHistorialCambios);
    
    // Cerrar modal de historial
    document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', cerrarModalHistorial);
    });
    
    // Cerrar el modal al hacer clic fuera de él
    historyModal.addEventListener('click', event => {
        if (event.target === historyModal) {
            cerrarModalHistorial();
        }
    });
    
    // Cerrar mensajes de sistema
    document.querySelectorAll('.close-message').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.system-message').style.display = 'none';
        });
    });
    
    // Filtrar historial
    btnFilterHistory.addEventListener('click', function() {
        cargarHistorialCambios();
    });
    
    // Cambiar foto
    changePhotoBtn.addEventListener('click', cambiarFoto);
    
    // Manejar navegación entre secciones
    document.querySelectorAll('.progress-step').forEach(step => {
        step.addEventListener('click', function() {
            // Aquí manejaríamos la navegación entre secciones
            // Por ahora solo mostramos un mensaje
            const seccion = this.dataset.section;
            if (seccion !== 'personal') {
                mostrarNotificacion(`La sección "${seccion}" estará disponible próximamente`, 'info');
            }
        });
    });
}

// Verificar cambio en un campo
function verificarCambioEnCampo(idCampo) {
    const campo = document.getElementById(idCampo);
    const valorOriginal = datosOriginales[idCampo];
    const valorActual = campo.value;
    
    // Para campos numéricos, convertir a número para comparación
    let hayMosificdados = false;
    if (idCampo === 'hijos' || idCampo === 'estadoCivil') {
        const valorOriginalNum = Number(valorOriginal);
        const valorActualNum = Number(valorActual);
        hayMosificdados = valorOriginalNum !== valorActualNum;
    } else {
        hayMosificdados = valorOriginal !== valorActual;
    }
    
    // Si hay cambios, mostrar indicador y agregar a lista de modificados
    if (hayMosificdados) {
        campo.classList.add('modified');
        indicadores[idCampo].style.opacity = '1';
        camposModificados[idCampo] = true;
    } else {
        campo.classList.remove('modified');
        indicadores[idCampo].style.opacity = '0';
        delete camposModificados[idCampo];
    }
    
    // Habilitar o deshabilitar botón guardar
    btnSavePersonal.disabled = Object.keys(camposModificados).length === 0;
}

// Guardar cambios en datos personales
async function guardarCambiosPersonales() {
    try {
        // Verificar si hay cambios
        if (Object.keys(camposModificados).length === 0) {
            mostrarNotificacion('No hay cambios para guardar', 'info');
            return;
        }
        
        // Validar campos requeridos
        if (!primerNombre.value.trim() || !primerApellido.value.trim() || !dpi.value.trim() || !fechaNacimiento.value || !estadoCivil.value) {
            mostrarMensajeSistema(warningMessage, 'Por favor complete todos los campos obligatorios');
            return;
        }
        
        // Evitar múltiples envíos
        if (estaGuardando) return;
        estaGuardando = true;
        
        // Mostrar indicador de carga
        btnSavePersonal.innerHTML = '<span class="loading-spinner"></span> Guardando...';
        btnSavePersonal.disabled = true;
        
        // Preparar datos para actualizar
        const datosActualizados = {
            PrimerNombre: primerNombre.value.trim(),
            SegundoNombre: segundoNombre.value.trim() || null,
            TercerNombre: tercerNombre.value.trim() || null,
            PrimerApellido: primerApellido.value.trim(),
            SegundoApellido: segundoApellido.value.trim() || null,
            DPI: dpi.value.trim(),
            FechaNacimiento: fechaNacimiento.value,
            IdEstadoCivil: estadoCivil.value,
            Hijos: hijos.value
        };
        
        // Conectar a la base de datos
        const connection = await connectionString();
        
        try {
            // 1. Actualizar tabla personal
            let updateQuery = `
                UPDATE personal SET
                    PrimerNombre = ?,
                    SegundoNombre = ?,
                    TercerNombre = ?,
                    PrimerApellido = ?,
                    SegundoApellido = ?,
                    DPI = ?,
                    FechaNacimiento = ?,
                    IdEstadoCivil = ?,
                    Hijos = ?
                WHERE IdPersonal = ?
            `;
            
            await connection.query(updateQuery, [
                datosActualizados.PrimerNombre,
                datosActualizados.SegundoNombre,
                datosActualizados.TercerNombre,
                datosActualizados.PrimerApellido,
                datosActualizados.SegundoApellido,
                datosActualizados.DPI,
                datosActualizados.FechaNacimiento,
                datosActualizados.IdEstadoCivil,
                datosActualizados.Hijos,
                empleadoActual.IdPersonal
            ]);
            
            // 2. Registrar cambios en historial
            for (const campo in camposModificados) {
                let nombreCampo, valorAnterior, valorNuevo, tipoCambio = 1; // TipoCambio 1 = Datos Personales
                
                // Mapear el ID del campo a un nombre más amigable
                switch(campo) {
                    case 'primerNombre':
                        nombreCampo = 'Primer Nombre';
                        valorAnterior = datosOriginales.primerNombre;
                        valorNuevo = datosActualizados.PrimerNombre;
                        break;
                    case 'segundoNombre':
                        nombreCampo = 'Segundo Nombre';
                        valorAnterior = datosOriginales.segundoNombre || '';
                        valorNuevo = datosActualizados.SegundoNombre || '';
                        break;
                    case 'tercerNombre':
                        nombreCampo = 'Tercer Nombre';
                        valorAnterior = datosOriginales.tercerNombre || '';
                        valorNuevo = datosActualizados.TercerNombre || '';
                        break;
                    case 'primerApellido':
                        nombreCampo = 'Primer Apellido';
                        valorAnterior = datosOriginales.primerApellido;
                        valorNuevo = datosActualizados.PrimerApellido;
                        break;
                    case 'segundoApellido':
                        nombreCampo = 'Segundo Apellido';
                        valorAnterior = datosOriginales.segundoApellido || '';
                        valorNuevo = datosActualizados.SegundoApellido || '';
                        break;
                    case 'dpi':
                        nombreCampo = 'DPI';
                        valorAnterior = datosOriginales.dpi;
                        valorNuevo = datosActualizados.DPI;
                        break;
                    case 'fechaNacimiento':
                        nombreCampo = 'Fecha de Nacimiento';
                        valorAnterior = datosOriginales.fechaNacimiento;
                        valorNuevo = datosActualizados.FechaNacimiento;
                        break;
                    case 'estadoCivil':
                        nombreCampo = 'Estado Civil';
                        // Para estado civil, obtener el texto en lugar del ID
                        const optionAnterior = estadoCivil.querySelector(`option[value="${datosOriginales.estadoCivil}"]`);
                        const optionNuevo = estadoCivil.querySelector(`option[value="${datosActualizados.IdEstadoCivil}"]`);
                        valorAnterior = optionAnterior ? optionAnterior.textContent : '';
                        valorNuevo = optionNuevo ? optionNuevo.textContent : '';
                        break;
                    case 'hijos':
                        nombreCampo = 'Número de Hijos';
                        valorAnterior = datosOriginales.hijos.toString();
                        valorNuevo = datosActualizados.Hijos.toString();
                        break;
                }
                
                // Insertar en historial
                const historialQuery = `
                    INSERT INTO CambiosPersonal 
                    (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const nombreCompleto = [
                    empleadoActual.PrimerNombre,
                    empleadoActual.SegundoNombre,
                    empleadoActual.TercerNombre,
                    empleadoActual.PrimerApellido,
                    empleadoActual.SegundoApellido
                ].filter(Boolean).join(' '); 
                await connection.query(historialQuery, [
                    empleadoActual.IdPersonal,
                    nombreCompleto, // Ahora guardamos el nombre completo
                    tipoCambio,
                    nombreCampo,
                    valorAnterior,
                    valorNuevo,
                    userData.IdPersonal,
                    userData.NombreCompleto 
                ]);
            }
            
            // Actualizar datos originales
            datosOriginales = {
                primerNombre: datosActualizados.PrimerNombre,
                segundoNombre: datosActualizados.SegundoNombre || '',
                tercerNombre: datosActualizados.TercerNombre || '',
                primerApellido: datosActualizados.PrimerApellido,
                segundoApellido: datosActualizados.SegundoApellido || '',
                dpi: datosActualizados.DPI,
                fechaNacimiento: datosActualizados.FechaNacimiento,
                estadoCivil: datosActualizados.IdEstadoCivil,
                hijos: datosActualizados.Hijos
            };
            
            // Actualizar el nombre en el encabezado
            employeeName.textContent = `${datosActualizados.PrimerNombre} ${datosActualizados.PrimerApellido}`;
            
            // Mostrar mensaje de éxito
            mostrarMensajeSistema(successMessage, 'Cambios guardados correctamente');
            mostrarNotificacion('Datos personales actualizados correctamente', 'success');
            
            // Limpiar lista de campos modificados
            Object.keys(camposModificados).forEach(campo => {
                const element = document.getElementById(campo);
                element.classList.remove('modified');
                element.classList.add('saved');
                indicadores[campo].style.opacity = '0';
                
                // Quitar clase saved después de un tiempo
                setTimeout(() => {
                    element.classList.remove('saved');
                }, 3000);
            });
            
            camposModificados = {};
            
        } catch (error) {
            throw error;
        } finally {
            // Cerrar conexión
            await connection.close();
            
            // Restaurar botón guardar
            btnSavePersonal.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            btnSavePersonal.disabled = true;
            estaGuardando = false;
        }
        
    } catch (error) {
        console.error('Error al guardar cambios:', error);
        mostrarNotificacion('Error al guardar cambios: ' + error.message, 'error');
        
        // Restaurar botón guardar
        btnSavePersonal.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        btnSavePersonal.disabled = false;
        estaGuardando = false;
    }
}

// Cancelar cambios
function cancelarCambios() {
    // Preguntar si hay cambios sin guardar
    if (Object.keys(camposModificados).length > 0) {
        if (!confirm('¿Está seguro que desea cancelar los cambios?')) {
            return;
        }
    }
    
    // Restaurar valores originales
    primerNombre.value = datosOriginales.primerNombre;
    segundoNombre.value = datosOriginales.segundoNombre;
    tercerNombre.value = datosOriginales.tercerNombre;
    primerApellido.value = datosOriginales.primerApellido;
    segundoApellido.value = datosOriginales.segundoApellido;
    dpi.value = datosOriginales.dpi;
    fechaNacimiento.value = datosOriginales.fechaNacimiento;
    estadoCivil.value = datosOriginales.estadoCivil;
    hijos.value = datosOriginales.hijos;
    
    // Limpiar indicadores y estilos
    Object.keys(indicadores).forEach(campo => {
        indicadores[campo].style.opacity = '0';
        const element = document.getElementById(campo);
        element.classList.remove('modified');
    });
    
    // Limpiar lista de campos modificados
    camposModificados = {};
    
    // Deshabilitar botón guardar
    btnSavePersonal.disabled = true;
    
    mostrarNotificacion('Cambios cancelados', 'info');
}

// Mostrar historial de cambios
async function mostrarHistorialCambios() {
    // Mostrar modal
    historyModal.classList.add('show');
    
    // Establecer fechas por defecto (último mes)
    const hoy = new Date();
    const haceMes = new Date();
    haceMes.setMonth(haceMes.getMonth() - 1);
    
    historyDateTo.value = hoy.toISOString().split('T')[0];
    historyDateFrom.value = haceMes.toISOString().split('T')[0];
    
    // Cargar historial
    await cargarHistorialCambios();
}

// Cargar historial de cambios
async function cargarHistorialCambios() {
    try {
        // Validar datos
        if (!empleadoActual || !empleadoActual.IdPersonal) {
            throw new Error('No se ha cargado un empleado');
        }
        
        // Obtener fechas de filtro
        const fechaDesde = historyDateFrom.value || '1900-01-01';
        const fechaHasta = historyDateTo.value || new Date().toISOString().split('T')[0];
        
        // Obtener historial de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT 
                IdPersonal,
                NombrePersonal,
                TipoCambio,
                Cambio,
                ValorAnterior,
                ValorNuevo,
                IdUsuario,
                NombreUsuario,
                FechaCambio,
                FechaHoraCambio
            FROM 
                CambiosPersonal
            WHERE 
                IdPersonal = ? 
                AND TipoCambio = 1
                AND DATE(FechaCambio) BETWEEN ? AND ?
            ORDER BY 
                FechaHoraCambio DESC
        `;
        
        const result = await connection.query(query, [
            empleadoActual.IdPersonal,
            fechaDesde,
            fechaHasta
        ]);
        await connection.close();
        
        // Mostrar resultados
        mostrarResultadosHistorial(result);
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        mostrarNotificacion('Error al cargar historial: ' + error.message, 'error');
    }
}

// Mostrar resultados del historial
function mostrarResultadosHistorial(historial) {
    // Limpiar contenedor
    historyTimeline.innerHTML = '';
    
    // Verificar si hay resultados
    if (historial.length === 0) {
        historyTimeline.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-calendar-times"></i>
                <p>No hay registros de cambios en el período seleccionado</p>
                <small>Pruebe con un rango de fechas diferente</small>
            </div>
        `;
        return;
    }
    
    // Agrupar por fecha
    const historialPorFecha = {};
    
    historial.forEach(item => {
        const fecha = new Date(item.FechaCambio).toLocaleDateString();
        if (!historialPorFecha[fecha]) {
            historialPorFecha[fecha] = [];
        }
        historialPorFecha[fecha].push(item);
    });
    
    // Crear HTML para cada grupo de fecha
    for (const fecha in historialPorFecha) {
        const items = historialPorFecha[fecha];
        
        items.forEach(item => {
            const fechaHoraObj = new Date(item.FechaHoraCambio);
            const hora = fechaHoraObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div class="history-time">
                    <span class="history-date">${new Date(item.FechaCambio).toLocaleDateString()}</span>
                    <span class="history-hour">${hora}</span>
                </div>
                <div class="history-content">
                    <div class="history-header">
                        <span class="history-type">Datos Personales</span>
                        <span class="history-user">
                            <i class="fas fa-user"></i> ${item.NombreUsuario}
                        </span>
                    </div>
                    <div class="history-details">
                        <span class="history-field">${item.Cambio}</span>
                        <div class="history-change">
                            <div class="history-old">
                                <i class="fas fa-minus-circle"></i> ${item.ValorAnterior || 'No registrado'}
                            </div>
                            <div class="history-new">
                                <i class="fas fa-plus-circle"></i> ${item.ValorNuevo || 'No registrado'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            historyTimeline.appendChild(historyItem);
        });
    }
}

// Cerrar modal de historial
function cerrarModalHistorial() {
    historyModal.classList.remove('show');
}

// Cambiar foto de perfil
function cambiarFoto() {
    // Esta función se implementará en una versión futura
    mostrarNotificacion('La funcionalidad de cambio de foto estará disponible próximamente', 'info');
}

// Mostrar mensajes de sistema
function mostrarMensajeSistema(elemento, mensaje) {
    // Actualizar el mensaje
    elemento.querySelector('span').textContent = mensaje;
    
    // Mostrar el elemento
    elemento.style.display = 'flex';
    
    // Ocultar automáticamente después de un tiempo (excepto para mensajes info)
    if (elemento !== infoMessage) {
        setTimeout(() => {
            elemento.style.display = 'none';
        }, 5000);
    }
}

// Mostrar/ocultar indicador de carga
function mostrarCargando(mostrar, mensaje = 'Cargando...') {
    if (mostrar) {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner-large"></div>
                <p>${mensaje}</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    } else {
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('fade-out');
            setTimeout(() => {
                if (loadingOverlay.parentNode) {
                    loadingOverlay.parentNode.removeChild(loadingOverlay);
                }
            }, 300);
        }
    }
}

// NOTIFICACIONES TOAST
function mostrarNotificacion(mensaje, tipo = 'info') {
    // Verificar si ya existe el contenedor de toast
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Crear el toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    
    // Definir iconos según el tipo
    const iconMap = {
        success: 'check-circle',
        error: 'times-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    // Crear contenido del toast
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${iconMap[tipo]}"></i>
        </div>
        <div class="toast-content">${mensaje}</div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Agregar al contenedor
    toastContainer.appendChild(toast);
    
    // Manejar el cierre del toast
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    });
    
    // Auto-cierre después de 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 300);
        }
    }, 5000);
}
function inicializarEventosUbicacion() {
    // Eventos para los selects de departamentos (para cargar municipios)
    departamentoOrigen.addEventListener('change', function() {
        cargarMunicipios(this.value, municipioOrigen);
        verificarCambioEnCampoUbicacion('departamentoOrigen');
    });
    
    departamentoResidencia.addEventListener('change', function() {
        cargarMunicipios(this.value, municipioResidencia);
        verificarCambioEnCampoUbicacion('departamentoResidencia');
    });
    
    // Eventos para municipios
    municipioOrigen.addEventListener('change', function() {
        verificarCambioEnCampoUbicacion('municipioOrigen');
    });
    
    municipioResidencia.addEventListener('change', function() {
        verificarCambioEnCampoUbicacion('municipioResidencia');
    });
    
    // Evento para dirección
    direccionResidencia.addEventListener('input', function() {
        verificarCambioEnCampoUbicacion('direccionResidencia');
    });
    
    // Botones
    btnSaveLocation.addEventListener('click', guardarCambiosUbicacion);
    btnCancelLocation.addEventListener('click', cancelarCambiosUbicacion);
    btnHistoryLocation.addEventListener('click', function() {
        mostrarHistorialCambiosUbicacion();
    });
    
    // Eventos de navegación
    document.querySelector('.progress-step[data-section="location"]').addEventListener('click', function() {
        mostrarSeccion('location');
    });
}
async function cargarDatosUbicacion() {
    try {
        if (!empleadoActual || !empleadoActual.IdPersonal) return;
        
        mostrarCargando(true, 'Cargando datos de ubicación...');
        
        // Cargar departamentos
        await cargarDepartamentos();
        
        // Obtener datos actuales de ubicación
        const connection = await connectionString();
        const query = `
            SELECT 
                personal.IdDepartamentoOrigen,
                personal.IdMunicipioOrigen,
                personal.DireccionRecidencia,
                personal.IdDepartamentoG,
                personal.IdMunicipioG
            FROM
                personal 
            WHERE 
                personal.IdPersonal = ?
        `;
        
        const result = await connection.query(query, [empleadoActual.IdPersonal]);
        await connection.close();
        
        if (result.length === 0) {
            throw new Error('No se encontraron datos de ubicación');
        }
        
        const datosUbicacion = result[0];
        
        // Guardar datos originales
        datosOriginalesUbicacion = {
            departamentoOrigen: datosUbicacion.IdDepartamentoOrigen || '',
            municipioOrigen: datosUbicacion.IdMunicipioOrigen || '',
            direccionResidencia: datosUbicacion.DireccionRecidencia || '',
            departamentoResidencia: datosUbicacion.IdDepartamentoG || '',
            municipioResidencia: datosUbicacion.IdMunicipioG || ''
        };
        
        // Asignar valores a los campos
        departamentoOrigen.value = datosOriginalesUbicacion.departamentoOrigen;
        departamentoResidencia.value = datosOriginalesUbicacion.departamentoResidencia;
        direccionResidencia.value = datosOriginalesUbicacion.direccionResidencia;
        
        // Cargar municipios correspondientes
        if (datosOriginalesUbicacion.departamentoOrigen) {
            await cargarMunicipios(datosOriginalesUbicacion.departamentoOrigen, municipioOrigen);
            municipioOrigen.value = datosOriginalesUbicacion.municipioOrigen;
        }
        
        if (datosOriginalesUbicacion.departamentoResidencia) {
            await cargarMunicipios(datosOriginalesUbicacion.departamentoResidencia, municipioResidencia);
            municipioResidencia.value = datosOriginalesUbicacion.municipioResidencia;
        }
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar datos de ubicación:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar datos de ubicación: ' + error.message, 'error');
    }
}

// Cargar departamentos
async function cargarDepartamentos() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdDepartamentoG, NombreDepartamento
            FROM departamentosguatemala
            ORDER BY NombreDepartamento
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales en ambos selects
        departamentoOrigen.innerHTML = '<option value="">Seleccione...</option>';
        departamentoResidencia.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar opciones a los selects
        result.forEach(depto => {
            // Para origen
            const optionOrigen = document.createElement('option');
            optionOrigen.value = depto.IdDepartamentoG;
            optionOrigen.textContent = depto.NombreDepartamento;
            departamentoOrigen.appendChild(optionOrigen);
            
            // Para residencia
            const optionResidencia = document.createElement('option');
            optionResidencia.value = depto.IdDepartamentoG;
            optionResidencia.textContent = depto.NombreDepartamento;
            departamentoResidencia.appendChild(optionResidencia);
        });
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarNotificacion('Error al cargar departamentos', 'error');
        throw error;
    }
}

// Cargar municipios según el departamento seleccionado
async function cargarMunicipios(idDepartamento, selectMunicipio) {
    try {
        if (!idDepartamento) {
            selectMunicipio.innerHTML = '<option value="">Primero seleccione un departamento</option>';
            return;
        }

        const connection = await connectionString();
        const query = `
            SELECT IdMunicipio, NombreMunicipio
            FROM municipios
            WHERE IdDepartamentoG = ?
            ORDER BY NombreMunicipio
        `;
        
        const result = await connection.query(query, [idDepartamento]);
        await connection.close();
        
        // Limpiar opciones actuales
        selectMunicipio.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar opciones al select
        result.forEach(muni => {
            const option = document.createElement('option');
            option.value = muni.IdMunicipio;
            option.textContent = muni.NombreMunicipio;
            selectMunicipio.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar municipios:', error);
        mostrarNotificacion('Error al cargar municipios', 'error');
    }
}
function verificarCambioEnCampoUbicacion(idCampo) {
    const campo = document.getElementById(idCampo);
    const valorOriginal = datosOriginalesUbicacion[idCampo];
    const valorActual = campo.value;
    
    // Comparar valores
    const hayModificados = valorOriginal !== valorActual;
    
    // Si hay cambios, mostrar indicador y agregar a lista de modificados
    if (hayModificados) {
        campo.classList.add('modified');
        indicadoresUbicacion[idCampo].style.opacity = '1';
        camposModificadosUbicacion[idCampo] = true;
    } else {
        campo.classList.remove('modified');
        indicadoresUbicacion[idCampo].style.opacity = '0';
        delete camposModificadosUbicacion[idCampo];
    }
    
    // Habilitar o deshabilitar botón guardar
    btnSaveLocation.disabled = Object.keys(camposModificadosUbicacion).length === 0;
}

// Guardar cambios en ubicación
async function guardarCambiosUbicacion() {
    try {
        // Verificar si hay cambios
        if (Object.keys(camposModificadosUbicacion).length === 0) {
            mostrarNotificacion('No hay cambios para guardar', 'info');
            return;
        }
        
        // Validar campos requeridos
        if (!departamentoOrigen.value || !municipioOrigen.value || 
            !direccionResidencia.value.trim() || 
            !departamentoResidencia.value || !municipioResidencia.value) {
            mostrarMensajeSistema(warningMessage, 'Por favor complete todos los campos obligatorios');
            return;
        }
        
        // Evitar múltiples envíos
        btnSaveLocation.innerHTML = '<span class="loading-spinner"></span> Guardando...';
        btnSaveLocation.disabled = true;
        
        // Preparar datos para actualizar
        const datosActualizados = {
            IdDepartamentoOrigen: departamentoOrigen.value,
            IdMunicipioOrigen: municipioOrigen.value,
            DireccionRecidencia: direccionResidencia.value.trim(),
            IdDepartamentoG: departamentoResidencia.value,
            IdMunicipioG: municipioResidencia.value
        };
        
        // Formar el nombre completo
        const nombreCompleto = [
            empleadoActual.PrimerNombre,
            empleadoActual.SegundoNombre,
            empleadoActual.TercerNombre,
            empleadoActual.PrimerApellido,
            empleadoActual.SegundoApellido
        ].filter(Boolean).join(' ');
        
        // Conectar a la base de datos
        const connection = await connectionString();

        // Primero: Obtener nombres actuales de departamentos y municipios para el historial
        const nombresOriginales = {};
        
        // Obtener nombre de departamento de origen
        if (datosOriginalesUbicacion.departamentoOrigen) {
            const deptoQuery = `
                SELECT NombreDepartamento FROM departamentosguatemala 
                WHERE IdDepartamentoG = ?
            `;
            const deptoResult = await connection.query(deptoQuery, [datosOriginalesUbicacion.departamentoOrigen]);
            nombresOriginales.departamentoOrigen = deptoResult.length > 0 ? 
                deptoResult[0].NombreDepartamento : 'No registrado';
        } else {
            nombresOriginales.departamentoOrigen = 'No registrado';
        }
        
        // Obtener nombre de municipio de origen
        if (datosOriginalesUbicacion.municipioOrigen) {
            const muniQuery = `
                SELECT NombreMunicipio FROM municipios 
                WHERE IdMunicipio = ?
            `;
            const muniResult = await connection.query(muniQuery, [datosOriginalesUbicacion.municipioOrigen]);
            nombresOriginales.municipioOrigen = muniResult.length > 0 ? 
                muniResult[0].NombreMunicipio : 'No registrado';
        } else {
            nombresOriginales.municipioOrigen = 'No registrado';
        }
        
        // Obtener nombre de departamento de residencia
        if (datosOriginalesUbicacion.departamentoResidencia) {
            const deptoQuery = `
                SELECT NombreDepartamento FROM departamentosguatemala 
                WHERE IdDepartamentoG = ?
            `;
            const deptoResult = await connection.query(deptoQuery, [datosOriginalesUbicacion.departamentoResidencia]);
            nombresOriginales.departamentoResidencia = deptoResult.length > 0 ? 
                deptoResult[0].NombreDepartamento : 'No registrado';
        } else {
            nombresOriginales.departamentoResidencia = 'No registrado';
        }
        
        // Obtener nombre de municipio de residencia
        if (datosOriginalesUbicacion.municipioResidencia) {
            const muniQuery = `
                SELECT NombreMunicipio FROM municipios 
                WHERE IdMunicipio = ?
            `;
            const muniResult = await connection.query(muniQuery, [datosOriginalesUbicacion.municipioResidencia]);
            nombresOriginales.municipioResidencia = muniResult.length > 0 ? 
                muniResult[0].NombreMunicipio : 'No registrado';
        } else {
            nombresOriginales.municipioResidencia = 'No registrado';
        }
        
        // Iniciar transacción
        await connection.beginTransaction();
        
        try {
            // 1. Actualizar tabla personal
            let updateQuery = `
                UPDATE personal SET
                    IdDepartamentoOrigen = ?,
                    IdMunicipioOrigen = ?,
                    DireccionRecidencia = ?,
                    IdDepartamentoG = ?,
                    IdMunicipioG = ?
                WHERE IdPersonal = ?
            `;
            
            await connection.query(updateQuery, [
                datosActualizados.IdDepartamentoOrigen,
                datosActualizados.IdMunicipioOrigen,
                datosActualizados.DireccionRecidencia,
                datosActualizados.IdDepartamentoG,
                datosActualizados.IdMunicipioG,
                empleadoActual.IdPersonal
            ]);
            
            // 2. Registrar cambios en historial
            for (const campo in camposModificadosUbicacion) {
                let nombreCampo, valorAnterior, valorNuevo, tipoCambio = 2; // TipoCambio 2 = Ubicación
                
                // Mapear el ID del campo a un nombre más amigable
                switch(campo) {
                    case 'departamentoOrigen':
                        nombreCampo = 'Departamento de Origen';
                        valorAnterior = nombresOriginales.departamentoOrigen;
                        valorNuevo = departamentoOrigen.querySelector(`option[value="${datosActualizados.IdDepartamentoOrigen}"]`)?.textContent || 'No registrado';
                        break;
                    case 'municipioOrigen':
                        nombreCampo = 'Municipio de Origen';
                        valorAnterior = nombresOriginales.municipioOrigen;
                        valorNuevo = municipioOrigen.querySelector(`option[value="${datosActualizados.IdMunicipioOrigen}"]`)?.textContent || 'No registrado';
                        break;
                    case 'direccionResidencia':
                        nombreCampo = 'Dirección de Residencia';
                        valorAnterior = datosOriginalesUbicacion.direccionResidencia || 'No registrado';
                        valorNuevo = datosActualizados.DireccionRecidencia;
                        break;
                    case 'departamentoResidencia':
                        nombreCampo = 'Departamento de Residencia';
                        valorAnterior = nombresOriginales.departamentoResidencia;
                        valorNuevo = departamentoResidencia.querySelector(`option[value="${datosActualizados.IdDepartamentoG}"]`)?.textContent || 'No registrado';
                        break;
                    case 'municipioResidencia':
                        nombreCampo = 'Municipio de Residencia';
                        valorAnterior = nombresOriginales.municipioResidencia;
                        valorNuevo = municipioResidencia.querySelector(`option[value="${datosActualizados.IdMunicipioG}"]`)?.textContent || 'No registrado';
                        break;
                }
                
                // Insertar en historial
                const historialQuery = `
                    INSERT INTO CambiosPersonal 
                    (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                await connection.query(historialQuery, [
                    empleadoActual.IdPersonal,
                    nombreCompleto,
                    tipoCambio,
                    nombreCampo,
                    valorAnterior,
                    valorNuevo,
                    userData.IdPersonal,
                    userData.NombreCompleto
                ]);
            }
            
            // Confirmar transacción
            await connection.commit();
            
            // Actualizar datos originales
            datosOriginalesUbicacion = {
                departamentoOrigen: datosActualizados.IdDepartamentoOrigen,
                municipioOrigen: datosActualizados.IdMunicipioOrigen,
                direccionResidencia: datosActualizados.DireccionRecidencia,
                departamentoResidencia: datosActualizados.IdDepartamentoG,
                municipioResidencia: datosActualizados.IdMunicipioG
            };
            
            // Mostrar mensaje de éxito
            mostrarMensajeSistema(successMessage, 'Datos de ubicación actualizados correctamente');
            mostrarNotificacion('Ubicación actualizada correctamente', 'success');
            
            // Limpiar lista de campos modificados
            Object.keys(camposModificadosUbicacion).forEach(campo => {
                const element = document.getElementById(campo);
                element.classList.remove('modified');
                element.classList.add('saved');
                indicadoresUbicacion[campo].style.opacity = '0';
                
                // Quitar clase saved después de un tiempo
                setTimeout(() => {
                    element.classList.remove('saved');
                }, 3000);
            });
            
            camposModificadosUbicacion = {};
            
        } catch (error) {
            // Revertir transacción en caso de error
            await connection.rollback();
            throw error;
        } finally {
            // Cerrar conexión
            await connection.close();
            
            // Restaurar botón guardar
            btnSaveLocation.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            btnSaveLocation.disabled = true;
        }
        
    } catch (error) {
        console.error('Error al guardar cambios de ubicación:', error);
        mostrarNotificacion('Error al guardar: ' + error.message, 'error');
        
        // Restaurar botón guardar
        btnSaveLocation.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        btnSaveLocation.disabled = false;
    }
}

// Función auxiliar para buscar nombre de municipio por ID
async function buscarNombreMunicipio(idMunicipio) {
    if (!idMunicipio) return null;
    
    try {
        const connection = await connectionString();
        const query = `
            SELECT NombreMunicipio
            FROM municipios
            WHERE IdMunicipio = ?
        `;
        
        const result = await connection.query(query, [idMunicipio]);
        await connection.close();
        
        return result.length > 0 ? result[0].NombreMunicipio : null;
    } catch (error) {
        console.error('Error al buscar municipio:', error);
        return null;
    }
}

// Cancelar cambios de ubicación
function cancelarCambiosUbicacion() {
    // Preguntar si hay cambios sin guardar
    if (Object.keys(camposModificadosUbicacion).length > 0) {
        if (!confirm('¿Está seguro que desea cancelar los cambios?')) {
            return;
        }
    }
    
    // Restaurar valores originales
    departamentoOrigen.value = datosOriginalesUbicacion.departamentoOrigen;
    cargarMunicipios(datosOriginalesUbicacion.departamentoOrigen, municipioOrigen).then(() => {
        municipioOrigen.value = datosOriginalesUbicacion.municipioOrigen;
    });
    
    direccionResidencia.value = datosOriginalesUbicacion.direccionResidencia;
    
    departamentoResidencia.value = datosOriginalesUbicacion.departamentoResidencia;
    cargarMunicipios(datosOriginalesUbicacion.departamentoResidencia, municipioResidencia).then(() => {
        municipioResidencia.value = datosOriginalesUbicacion.municipioResidencia;
    });
    
    // Limpiar indicadores y estilos
    Object.keys(indicadoresUbicacion).forEach(campo => {
        indicadoresUbicacion[campo].style.opacity = '0';
        const element = document.getElementById(campo);
        element.classList.remove('modified');
    });
    
    // Limpiar lista de campos modificados
    camposModificadosUbicacion = {};
    
    // Deshabilitar botón guardar
    btnSaveLocation.disabled = true;
    
    mostrarNotificacion('Cambios cancelados', 'info');
}

// Mostrar historial de cambios de ubicación
async function mostrarHistorialCambiosUbicacion() {
    // Mostrar modal
    historyModal.classList.add('show');
    
    // Establecer fechas por defecto (último mes)
    const hoy = new Date();
    const haceMes = new Date();
    haceMes.setMonth(haceMes.getMonth() - 1);
    
    historyDateTo.value = hoy.toISOString().split('T')[0];
    historyDateFrom.value = haceMes.toISOString().split('T')[0];
    
    // Cargar historial
    await cargarHistorialCambiosUbicacion();
}

// Cargar historial de cambios de ubicación
async function cargarHistorialCambiosUbicacion() {
    try {
        // Validar datos
        if (!empleadoActual || !empleadoActual.IdPersonal) {
            throw new Error('No se ha cargado un empleado');
        }
        
        // Obtener fechas de filtro
        const fechaDesde = historyDateFrom.value || '1900-01-01';
        const fechaHasta = historyDateTo.value || new Date().toISOString().split('T')[0];
        
        // Obtener historial de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT 
                IdPersonal,
                NombrePersonal,
                TipoCambio,
                Cambio,
                ValorAnterior,
                ValorNuevo,
                IdUsuario,
                NombreUsuario,
                FechaCambio,
                FechaHoraCambio
            FROM 
                CambiosPersonal
            WHERE 
                IdPersonal = ? 
                AND TipoCambio = 2
                AND DATE(FechaCambio) BETWEEN ? AND ?
            ORDER BY 
                FechaHoraCambio DESC
        `;
        
        const result = await connection.query(query, [
            empleadoActual.IdPersonal,
            fechaDesde,
            fechaHasta
        ]);
        await connection.close();
        
        // Mostrar resultados
        mostrarResultadosHistorial(result);
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        mostrarNotificacion('Error al cargar historial: ' + error.message, 'error');
    }
}
function inicializarEventosContacto() {
    // Eventos para campos de texto
    [telefono1, telefono2, correoElectronico, nombreContactoEmergencia, telefonoContactoEmergencia].forEach(campo => {
        campo.addEventListener('input', function() {
            verificarCambioEnCampoContacto(campo.id);
        });
    });
    
    // Evento para select de parentesco
    parentesco.addEventListener('change', function() {
        verificarCambioEnCampoContacto('parentesco');
    });
    
    // Botones
    btnSaveContact.addEventListener('click', guardarCambiosContacto);
    btnCancelContact.addEventListener('click', cancelarCambiosContacto);
    btnHistoryContact.addEventListener('click', function() {
        mostrarHistorialCambiosContacto();
    });
    
    // Eventos de navegación
    document.querySelector('.progress-step[data-section="contact"]').addEventListener('click', function() {
        mostrarSeccion('contact');
    });
    
    // Validación de formatos de teléfono
    [telefono1, telefono2, telefonoContactoEmergencia].forEach(campo => {
        campo.addEventListener('blur', function() {
            formatearTelefono(this);
        });
    });
    
    // Validación de correo electrónico
    correoElectronico.addEventListener('blur', function() {
        validarCorreoElectronico(this);
    });
}

// Formatear teléfono
function formatearTelefono(input) {
    let telefono = input.value.replace(/\D/g, ''); // Eliminar caracteres no numéricos
    
    if (telefono.length === 8) {
        // Formatear como ####-####
        telefono = telefono.replace(/(\d{4})(\d{4})/, '$1-$2');
        input.value = telefono;
        input.classList.remove('invalid');
    } else if (telefono.length > 0) {
        // Marcar como inválido si no tiene 8 dígitos
        input.classList.add('invalid');
    }
}

// Validar correo electrónico
function validarCorreoElectronico(input) {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (input.value && !regex.test(input.value)) {
        input.classList.add('invalid');
    } else {
        input.classList.remove('invalid');
    }
}
// Cargar datos de contacto del empleado
async function cargarDatosContacto() {
    try {
        if (!empleadoActual || !empleadoActual.IdPersonal) return;
        
        mostrarCargando(true, 'Cargando datos de contacto...');
        
        // Cargar parentescos
        await cargarParentescos();
        
        // Obtener datos actuales de contacto
        const connection = await connectionString();
        const query = `
            SELECT 
                personal.Telefono1,
                personal.Telefono2,
                personal.CorreoElectronico,
                personal.NombreContactoEmergencia,
                personal.TelefonoContactoEmergencia,
                personal.IdParentesco
            FROM
                personal 
            WHERE 
                personal.IdPersonal = ?
        `;
        
        const result = await connection.query(query, [empleadoActual.IdPersonal]);
        await connection.close();
        
        if (result.length === 0) {
            throw new Error('No se encontraron datos de contacto');
        }
        
        const datosContacto = result[0];
        
        // Guardar datos originales sin formato (para comparaciones futuras)
        datosOriginalesContacto = {
            telefono1: datosContacto.Telefono1 ? datosContacto.Telefono1.toString() : '',
            telefono2: datosContacto.Telefono2 ? datosContacto.Telefono2.toString() : '',
            correoElectronico: datosContacto.CorreoElectronico || '',
            nombreContactoEmergencia: datosContacto.NombreContactoEmergencia || '',
            telefonoContactoEmergencia: datosContacto.TelefonoContactoEmergencia ? datosContacto.TelefonoContactoEmergencia.toString() : '',
            parentesco: datosContacto.IdParentesco || ''
        };
        
        // Asignar valores formateados a los campos
        telefono1.value = formatearNumeroTelefono(datosContacto.Telefono1);
        telefono2.value = formatearNumeroTelefono(datosContacto.Telefono2);
        correoElectronico.value = datosOriginalesContacto.correoElectronico;
        nombreContactoEmergencia.value = datosOriginalesContacto.nombreContactoEmergencia;
        telefonoContactoEmergencia.value = formatearNumeroTelefono(datosContacto.TelefonoContactoEmergencia);
        parentesco.value = datosOriginalesContacto.parentesco;
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar datos de contacto:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar datos de contacto: ' + error.message, 'error');
    }
}

// Cargar parentescos
async function cargarParentescos() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdParentesco, Parentesco
            FROM parentesco
            ORDER BY Parentesco
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        parentesco.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar opciones al select
        result.forEach(item => {
            const option = document.createElement('option');
            option.value = item.IdParentesco;
            option.textContent = item.Parentesco;
            parentesco.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar parentescos:', error);
        mostrarNotificacion('Error al cargar parentescos', 'error');
        throw error;
    }
}

// Verificar cambio en un campo de contacto
function verificarCambioEnCampoContacto(idCampo) {
    const campo = document.getElementById(idCampo);
    const valorOriginal = datosOriginalesContacto[idCampo];
    const valorActual = campo.value;
    
    // Comparar valores
    const hayModificados = valorOriginal !== valorActual;
    
    // Si hay cambios, mostrar indicador y agregar a lista de modificados
    if (hayModificados) {
        campo.classList.add('modified');
        indicadoresContacto[idCampo].style.opacity = '1';
        camposModificadosContacto[idCampo] = true;
    } else {
        campo.classList.remove('modified');
        indicadoresContacto[idCampo].style.opacity = '0';
        delete camposModificadosContacto[idCampo];
    }
    
    // Habilitar o deshabilitar botón guardar
    btnSaveContact.disabled = Object.keys(camposModificadosContacto).length === 0;
}

// Función modificada para guardar cambios en contacto
async function guardarCambiosContacto() {
    try {
        // Verificar si hay cambios
        if (Object.keys(camposModificadosContacto).length === 0) {
            mostrarNotificacion('No hay cambios para guardar', 'info');
            return;
        }
        
        // Validar campos requeridos y formatos
        let hayErrores = false;
        
        if (!telefono1.value.trim()) {
            telefono1.classList.add('invalid');
            hayErrores = true;
        }
        
        if (!correoElectronico.value.trim()) {
            correoElectronico.classList.add('invalid');
            hayErrores = true;
        } else {
            // Validar formato de correo
            const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!regex.test(correoElectronico.value)) {
                correoElectronico.classList.add('invalid');
                hayErrores = true;
            }
        }
        
        if (!nombreContactoEmergencia.value.trim()) {
            nombreContactoEmergencia.classList.add('invalid');
            hayErrores = true;
        }
        
        if (!telefonoContactoEmergencia.value.trim()) {
            telefonoContactoEmergencia.classList.add('invalid');
            hayErrores = true;
        }
        
        if (!parentesco.value) {
            parentesco.classList.add('invalid');
            hayErrores = true;
        }
        
        if (hayErrores) {
            mostrarMensajeSistema(warningMessage, 'Por favor complete todos los campos obligatorios correctamente');
            return;
        }
        
        // Evitar múltiples envíos
        btnSaveContact.innerHTML = '<span class="loading-spinner"></span> Guardando...';
        btnSaveContact.disabled = true;
        
        // Preparar datos para actualizar (eliminando caracteres no numéricos en teléfonos)
        const datosActualizados = {
            Telefono1: telefono1.value.trim().replace(/\D/g, ''), // Solo dígitos
            Telefono2: telefono2.value.trim() ? telefono2.value.trim().replace(/\D/g, '') : null, // Solo dígitos si existe
            CorreoElectronico: correoElectronico.value.trim(),
            NombreContactoEmergencia: nombreContactoEmergencia.value.trim(),
            TelefonoContactoEmergencia: telefonoContactoEmergencia.value.trim().replace(/\D/g, ''), // Solo dígitos
            IdParentesco: parentesco.value
        };
        
        // Formar el nombre completo
        const nombreCompleto = [
            empleadoActual.PrimerNombre,
            empleadoActual.SegundoNombre,
            empleadoActual.TercerNombre,
            empleadoActual.PrimerApellido,
            empleadoActual.SegundoApellido
        ].filter(Boolean).join(' ');
        
        // Conectar a la base de datos
        const connection = await connectionString();

        // Iniciar transacción
        await connection.beginTransaction();
        
        try {
            // 1. Actualizar tabla personal
            let updateQuery = `
                UPDATE personal SET
                    Telefono1 = ?,
                    Telefono2 = ?,
                    CorreoElectronico = ?,
                    NombreContactoEmergencia = ?,
                    TelefonoContactoEmergencia = ?,
                    IdParentesco = ?
                WHERE IdPersonal = ?
            `;
            
            await connection.query(updateQuery, [
                datosActualizados.Telefono1,
                datosActualizados.Telefono2,
                datosActualizados.CorreoElectronico,
                datosActualizados.NombreContactoEmergencia,
                datosActualizados.TelefonoContactoEmergencia,
                datosActualizados.IdParentesco,
                empleadoActual.IdPersonal
            ]);
            
            // Obtener nombre de parentesco
            let nombreParentescoAnterior = 'No registrado';
            let nombreParentescoNuevo = 'No registrado';
            
            if (datosOriginalesContacto.parentesco) {
                const parentescoQuery = `
                    SELECT Parentesco FROM parentesco 
                    WHERE IdParentesco = ?
                `;
                const parentescoResult = await connection.query(parentescoQuery, [datosOriginalesContacto.parentesco]);
                if (parentescoResult.length > 0) {
                    nombreParentescoAnterior = parentescoResult[0].Parentesco;
                }
            }
            
            if (datosActualizados.IdParentesco) {
                const parentescoQuery = `
                    SELECT Parentesco FROM parentesco 
                    WHERE IdParentesco = ?
                `;
                const parentescoResult = await connection.query(parentescoQuery, [datosActualizados.IdParentesco]);
                if (parentescoResult.length > 0) {
                    nombreParentescoNuevo = parentescoResult[0].Parentesco;
                }
            }
            
            // 2. Registrar cambios en historial
            for (const campo in camposModificadosContacto) {
                let nombreCampo, valorAnterior, valorNuevo, tipoCambio = 3; // TipoCambio 3 = Contacto
                
                // Mapear el ID del campo a un nombre más amigable
                switch(campo) {
                    case 'telefono1':
                        nombreCampo = 'Teléfono Principal';
                        // Mostrar el formato con guiones en el historial para mejor legibilidad
                        const telOrigFormatted = datosOriginalesContacto.telefono1 ? 
                            formatearNumeroTelefono(datosOriginalesContacto.telefono1) : 'No registrado';
                        const telNuevoFormatted = formatearNumeroTelefono(datosActualizados.Telefono1);
                        valorAnterior = telOrigFormatted;
                        valorNuevo = telNuevoFormatted;
                        break;
                    case 'telefono2':
                        nombreCampo = 'Teléfono Secundario';
                        const tel2OrigFormatted = datosOriginalesContacto.telefono2 ? 
                            formatearNumeroTelefono(datosOriginalesContacto.telefono2) : 'No registrado';
                        const tel2NuevoFormatted = datosActualizados.Telefono2 ? 
                            formatearNumeroTelefono(datosActualizados.Telefono2) : 'No registrado';
                        valorAnterior = tel2OrigFormatted;
                        valorNuevo = tel2NuevoFormatted;
                        break;
                    case 'correoElectronico':
                        nombreCampo = 'Correo Electrónico';
                        valorAnterior = datosOriginalesContacto.correoElectronico || 'No registrado';
                        valorNuevo = datosActualizados.CorreoElectronico;
                        break;
                    case 'nombreContactoEmergencia':
                        nombreCampo = 'Nombre de Contacto de Emergencia';
                        valorAnterior = datosOriginalesContacto.nombreContactoEmergencia || 'No registrado';
                        valorNuevo = datosActualizados.NombreContactoEmergencia;
                        break;
                    case 'telefonoContactoEmergencia':
                        nombreCampo = 'Teléfono de Contacto de Emergencia';
                        const telEmergOrigFormatted = datosOriginalesContacto.telefonoContactoEmergencia ? 
                            formatearNumeroTelefono(datosOriginalesContacto.telefonoContactoEmergencia) : 'No registrado';
                        const telEmergNuevoFormatted = formatearNumeroTelefono(datosActualizados.TelefonoContactoEmergencia);
                        valorAnterior = telEmergOrigFormatted;
                        valorNuevo = telEmergNuevoFormatted;
                        break;
                    case 'parentesco':
                        nombreCampo = 'Parentesco del Contacto de Emergencia';
                        valorAnterior = nombreParentescoAnterior;
                        valorNuevo = nombreParentescoNuevo;
                        break;
                }
                
                // Insertar en historial
                const historialQuery = `
                    INSERT INTO CambiosPersonal 
                    (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                await connection.query(historialQuery, [
                    empleadoActual.IdPersonal,
                    nombreCompleto,
                    tipoCambio,
                    nombreCampo,
                    valorAnterior,
                    valorNuevo,
                    userData.IdPersonal,
                    userData.NombreCompleto
                ]);
            }
            
            // Confirmar transacción
            await connection.commit();
            
            // Actualizar datos originales (guardamos los valores sin formato para compararlos después)
            datosOriginalesContacto = {
                telefono1: datosActualizados.Telefono1,
                telefono2: datosActualizados.Telefono2 || '',
                correoElectronico: datosActualizados.CorreoElectronico,
                nombreContactoEmergencia: datosActualizados.NombreContactoEmergencia,
                telefonoContactoEmergencia: datosActualizados.TelefonoContactoEmergencia,
                parentesco: datosActualizados.IdParentesco
            };
            
            // Actualizar los campos con formato para la visualización
            telefono1.value = formatearNumeroTelefono(datosActualizados.Telefono1);
            telefono2.value = datosActualizados.Telefono2 ? formatearNumeroTelefono(datosActualizados.Telefono2) : '';
            telefonoContactoEmergencia.value = formatearNumeroTelefono(datosActualizados.TelefonoContactoEmergencia);
            
            // Mostrar mensaje de éxito
            mostrarMensajeSistema(successMessage, 'Datos de contacto actualizados correctamente');
            mostrarNotificacion('Información de contacto actualizada correctamente', 'success');
            
            // Limpiar lista de campos modificados
            Object.keys(camposModificadosContacto).forEach(campo => {
                const element = document.getElementById(campo);
                element.classList.remove('modified');
                element.classList.add('saved');
                indicadoresContacto[campo].style.opacity = '0';
                
                // Quitar clase saved después de un tiempo
                setTimeout(() => {
                    element.classList.remove('saved');
                }, 3000);
            });
            
            camposModificadosContacto = {};
            
        } catch (error) {
            // Revertir transacción en caso de error
            await connection.rollback();
            throw error;
        } finally {
            // Cerrar conexión
            await connection.close();
            
            // Restaurar botón guardar
            btnSaveContact.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            btnSaveContact.disabled = true;
        }
        
    } catch (error) {
        console.error('Error al guardar cambios de contacto:', error);
        mostrarNotificacion('Error al guardar: ' + error.message, 'error');
        
        // Restaurar botón guardar
        btnSaveContact.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        btnSaveContact.disabled = false;
    }
}

// Función auxiliar para formatear números de teléfono
function formatearNumeroTelefono(numero) {
    if (!numero) return '';
    
    // Asegurarse de que sea string
    const numStr = numero.toString();
    
    // Si tiene 8 dígitos, formatear como ####-####
    if (numStr.length === 8) {
        return numStr.replace(/(\d{4})(\d{4})/, '$1-$2');
    }
    
    return numStr; // Devolver el número sin formatear si no tiene 8 dígitos
}

// Cancelar cambios de contacto
function cancelarCambiosContacto() {
    // Preguntar si hay cambios sin guardar
    if (Object.keys(camposModificadosContacto).length > 0) {
        if (!confirm('¿Está seguro que desea cancelar los cambios?')) {
            return;
        }
    }
    
    // Restaurar valores originales
    telefono1.value = datosOriginalesContacto.telefono1;
    telefono2.value = datosOriginalesContacto.telefono2;
    correoElectronico.value = datosOriginalesContacto.correoElectronico;
    nombreContactoEmergencia.value = datosOriginalesContacto.nombreContactoEmergencia;
    telefonoContactoEmergencia.value = datosOriginalesContacto.telefonoContactoEmergencia;
    parentesco.value = datosOriginalesContacto.parentesco;
    
    // Limpiar indicadores y estilos
    Object.keys(indicadoresContacto).forEach(campo => {
        indicadoresContacto[campo].style.opacity = '0';
        const element = document.getElementById(campo);
        element.classList.remove('modified');
        element.classList.remove('invalid');
    });
    
    // Limpiar lista de campos modificados
    camposModificadosContacto = {};
    
    // Deshabilitar botón guardar
    btnSaveContact.disabled = true;
    
    mostrarNotificacion('Cambios cancelados', 'info');
}

// Mostrar historial de cambios de contacto
async function mostrarHistorialCambiosContacto() {
    // Mostrar modal
    historyModal.classList.add('show');
    
    // Establecer fechas por defecto (último mes)
    const hoy = new Date();
    const haceMes = new Date();
    haceMes.setMonth(haceMes.getMonth() - 1);
    
    historyDateTo.value = hoy.toISOString().split('T')[0];
    historyDateFrom.value = haceMes.toISOString().split('T')[0];
    
    // Cargar historial
    await cargarHistorialCambiosContacto();
}

// Cargar historial de cambios de contacto
async function cargarHistorialCambiosContacto() {
    try {
        // Validar datos
        if (!empleadoActual || !empleadoActual.IdPersonal) {
            throw new Error('No se ha cargado un empleado');
        }
        
        // Obtener fechas de filtro
        const fechaDesde = historyDateFrom.value || '1900-01-01';
        const fechaHasta = historyDateTo.value || new Date().toISOString().split('T')[0];
        
        // Obtener historial de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT 
                IdPersonal,
                NombrePersonal,
                TipoCambio,
                Cambio,
                ValorAnterior,
                ValorNuevo,
                IdUsuario,
                NombreUsuario,
                FechaCambio,
                FechaHoraCambio
            FROM 
                CambiosPersonal
            WHERE 
                IdPersonal = ? 
                AND TipoCambio = 3
                AND DATE(FechaCambio) BETWEEN ? AND ?
            ORDER BY 
                FechaHoraCambio DESC
        `;
        
        const result = await connection.query(query, [
            empleadoActual.IdPersonal,
            fechaDesde,
            fechaHasta
        ]);
        await connection.close();
        
        // Mostrar resultados
        mostrarResultadosHistorial(result);
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        mostrarNotificacion('Error al cargar historial: ' + error.message, 'error');
    }
}
// Añadir a la función inicializarEventos
function inicializarEventosLaboral() {
    // Eventos para selects
    departamento.addEventListener('change', function() {
        cargarPuestos(this.value);
        verificarCambioEnCampoLaboral('departamento');
    });
    
    // Eventos para otros campos select
    [puesto, tipoPersonal, planilla, estadoLaboral].forEach(campo => {
        campo.addEventListener('change', function() {
            verificarCambioEnCampoLaboral(campo.id);
        });
    });
    
    // Eventos para campos de fecha
    [inicioLaboral, fechaContrato, fechaPlanilla].forEach(campo => {
        campo.addEventListener('change', function() {
            verificarCambioEnCampoLaboral(campo.id);
        });
    });
    
    // Botones
    btnSaveWork.addEventListener('click', guardarCambiosLaboral);
    btnCancelWork.addEventListener('click', cancelarCambiosLaboral);
    btnHistoryWork.addEventListener('click', function() {
        mostrarHistorialCambiosLaboral();
    });
    
    // Eventos de navegación
    document.querySelector('.progress-step[data-section="work"]').addEventListener('click', function() {
        mostrarSeccion('work');
    });
    
    // Restricciones para fechas laborales
    const today = new Date().toISOString().split('T')[0];
    inicioLaboral.setAttribute('max', today);
    fechaContrato.setAttribute('max', today);
    fechaPlanilla.setAttribute('max', today);
    
    // Evento para verificar coherencia de fechas
    inicioLaboral.addEventListener('change', function() {
        // La fecha de contrato y planilla no pueden ser anteriores al inicio laboral
        if (this.value) {
            fechaContrato.setAttribute('min', this.value);
            fechaPlanilla.setAttribute('min', this.value);
            
            // Validar fechas existentes
            if (fechaContrato.value && fechaContrato.value < this.value) {
                fechaContrato.value = this.value;
                verificarCambioEnCampoLaboral('fechaContrato');
            }
            
            if (fechaPlanilla.value && fechaPlanilla.value < this.value) {
                fechaPlanilla.value = this.value;
                verificarCambioEnCampoLaboral('fechaPlanilla');
            }
        }
    });
    [salarioBase, bonificacion, salarioDiario, salarioQuincena, salarioQuincenaFinMes].forEach(campo => {
        campo.addEventListener('input', function() {
            verificarCambioEnCampoLaboral(campo.id);
        });
        
        // Formatear a dos decimales al perder el foco
        campo.addEventListener('blur', function() {
            if (this.value) {
                this.value = parseFloat(this.value).toFixed(2);
            }
        });
    });
    
    // Eventos para campos de texto adicionales
    [igss, irtra, noCuenta].forEach(campo => {
        campo.addEventListener('input', function() {
            verificarCambioEnCampoLaboral(campo.id);
        });
    });
}
// Cargar datos laborales del empleado
async function cargarDatosLaborales() {
    try {
        if (!empleadoActual || !empleadoActual.IdPersonal) return;
        
        mostrarCargando(true, 'Cargando información laboral...');
        
        // Cargar catálogos
        await Promise.all([
            cargarDepartamentosLaborales(),
            cargarTiposPersonal(),
            cargarPlanillas(),
            cargarEstadosLaborales()
        ]);
        
        // Obtener datos actuales laborales
        const connection = await connectionString();
        const query = `
            SELECT 
                personal.IdSucuDepa,
                personal.IdPuesto,
                personal.TipoPersonal,
                personal.IdPlanilla,
                personal.InicioLaboral,
                personal.FechaContrato,
                personal.FechaPlanilla,
                personal.Estado,
                personal.IGSS,
                personal.IRTRA,
                personal.NoCuenta,
                personal.SalarioDiario,
                personal.SalarioQuincena,
                personal.SalarioQuincenaFinMes,
                personal.SalarioBase,
                personal.Bonificacion
            FROM
                personal 
            WHERE 
                personal.IdPersonal = ?
        `;
        
        const result = await connection.query(query, [empleadoActual.IdPersonal]);
        await connection.close();
        
        if (result.length === 0) {
            throw new Error('No se encontraron datos laborales');
        }
        
        const datosLaborales = result[0];
        
        // Función auxiliar para formatear fechas de manera segura
        const formatearFecha = (fecha) => {
            if (!fecha) return '';
            try {
                // Intentar convertir a fecha
                const fechaObj = new Date(fecha);
                // Verificar si es una fecha válida
                if (isNaN(fechaObj.getTime())) return '';
                // Formato YYYY-MM-DD para input type="date"
                return fechaObj.toISOString().split('T')[0];
            } catch (error) {
                console.warn('Error al formatear fecha:', fecha, error);
                return '';
            }
        };
        
        // Guardar datos originales
        datosOriginalesLaboral = {
            departamento: datosLaborales.IdSucuDepa || '',
            puesto: datosLaborales.IdPuesto || '',
            tipoPersonal: datosLaborales.TipoPersonal || '',
            planilla: datosLaborales.IdPlanilla || '',
            inicioLaboral: formatearFecha(datosLaborales.InicioLaboral),
            fechaContrato: formatearFecha(datosLaborales.FechaContrato),
            fechaPlanilla: formatearFecha(datosLaborales.FechaPlanilla),
            estadoLaboral: datosLaborales.Estado || '',
            // Campos adicionales
            igss: datosLaborales.IGSS || '',
            irtra: datosLaborales.IRTRA || '',
            noCuenta: datosLaborales.NoCuenta || '',
            salarioDiario: datosLaborales.SalarioDiario || '',
            salarioQuincena: datosLaborales.SalarioQuincena || '',
            salarioQuincenaFinMes: datosLaborales.SalarioQuincenaFinMes || '',
            salarioBase: datosLaborales.SalarioBase || '',
            bonificacion: datosLaborales.Bonificacion || ''
        };
        
        // Asignar valores a los campos
        departamento.value = datosOriginalesLaboral.departamento;
        
        // Cargar puestos según el departamento seleccionado
        if (datosOriginalesLaboral.departamento) {
            await cargarPuestos(datosOriginalesLaboral.departamento);
            puesto.value = datosOriginalesLaboral.puesto;
        }
        
        tipoPersonal.value = datosOriginalesLaboral.tipoPersonal;
        planilla.value = datosOriginalesLaboral.planilla;
        inicioLaboral.value = datosOriginalesLaboral.inicioLaboral;
        fechaContrato.value = datosOriginalesLaboral.fechaContrato;
        fechaPlanilla.value = datosOriginalesLaboral.fechaPlanilla;
        estadoLaboral.value = datosOriginalesLaboral.estadoLaboral;
        
        // Asignar valores a los campos nuevos
        igss.value = datosOriginalesLaboral.igss;
        irtra.value = datosOriginalesLaboral.irtra;
        noCuenta.value = datosOriginalesLaboral.noCuenta;
        
        // Formatear valores numéricos con dos decimales
        salarioDiario.value = datosOriginalesLaboral.salarioDiario ? parseFloat(datosOriginalesLaboral.salarioDiario).toFixed(2) : '';
        salarioQuincena.value = datosOriginalesLaboral.salarioQuincena ? parseFloat(datosOriginalesLaboral.salarioQuincena).toFixed(2) : '';
        salarioQuincenaFinMes.value = datosOriginalesLaboral.salarioQuincenaFinMes ? parseFloat(datosOriginalesLaboral.salarioQuincenaFinMes).toFixed(2) : '';
        salarioBase.value = datosOriginalesLaboral.salarioBase ? parseFloat(datosOriginalesLaboral.salarioBase).toFixed(2) : '';
        bonificacion.value = datosOriginalesLaboral.bonificacion ? parseFloat(datosOriginalesLaboral.bonificacion).toFixed(2) : '';
        
        // Configurar restricciones de fechas
        if (datosOriginalesLaboral.inicioLaboral) {
            fechaContrato.setAttribute('min', datosOriginalesLaboral.inicioLaboral);
            fechaPlanilla.setAttribute('min', datosOriginalesLaboral.inicioLaboral);
        }
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar datos laborales:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar datos laborales: ' + error.message, 'error');
    }
}

// Cargar departamentos laborales
async function cargarDepartamentosLaborales() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdDepartamento, NombreDepartamento
            FROM departamentos
            ORDER BY NombreDepartamento
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        departamento.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar opciones al select
        result.forEach(depto => {
            const option = document.createElement('option');
            option.value = depto.IdDepartamento;
            option.textContent = depto.NombreDepartamento;
            departamento.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar departamentos laborales:', error);
        mostrarNotificacion('Error al cargar departamentos', 'error');
        throw error;
    }
}

// Cargar puestos según el departamento
async function cargarPuestos(idDepartamento) {
    try {
        // Limpiar opciones actuales
        puesto.innerHTML = '<option value="">Seleccione un puesto</option>';
        
        if (!idDepartamento) {
            return;
        }

        const connection = await connectionString();
        const query = `
            SELECT p.IdPuesto, p.Nombre
            FROM Puestos p
            WHERE p.IdDepartamento = ?
            ORDER BY p.Nombre
        `;
        
        const result = await connection.query(query, [idDepartamento]);
        await connection.close();
        
        // Agregar opciones al select
        result.forEach(item => {
            const option = document.createElement('option');
            option.value = item.IdPuesto;
            option.textContent = item.Nombre;
            puesto.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar puestos:', error);
        mostrarNotificacion('Error al cargar puestos', 'error');
    }
}

// Cargar tipos de personal
async function cargarTiposPersonal() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdTipo, TipoPersonal
            FROM TipoPersonal
            ORDER BY IdTipo
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        tipoPersonal.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar opciones al select
        result.forEach(item => {
            const option = document.createElement('option');
            option.value = item.IdTipo;
            option.textContent = item.TipoPersonal;
            tipoPersonal.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar tipos de personal:', error);
        mostrarNotificacion('Error al cargar tipos de personal', 'error');
        throw error;
    }
}

// Cargar planillas
async function cargarPlanillas() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT 
                p.IdPlanilla, 
                p.Nombre_Planilla,
                CONCAT(IFNULL(d.Nombre, ''), ' - ', p.Nombre_Planilla) AS PlanillaCompleta
            FROM planillas p
            LEFT JOIN divisiones d ON p.Division = d.IdDivision
            ORDER BY d.Nombre, p.Nombre_Planilla
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        planilla.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar opciones al select
        result.forEach(item => {
            const option = document.createElement('option');
            option.value = item.IdPlanilla;
            option.textContent = item.PlanillaCompleta;
            planilla.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar planillas:', error);
        mostrarNotificacion('Error al cargar planillas', 'error');
        throw error;
    }
}

// Cargar estados laborales
async function cargarEstadosLaborales() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdEstado, EstadoPersonal
            FROM EstadoPersonal
            ORDER BY IdEstado
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        estadoLaboral.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar opciones al select
        result.forEach(item => {
            const option = document.createElement('option');
            option.value = item.IdEstado;
            option.textContent = item.EstadoPersonal;
            estadoLaboral.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar estados laborales:', error);
        mostrarNotificacion('Error al cargar estados laborales', 'error');
        throw error;
    }
}

// Verificar cambio en un campo laboral
function verificarCambioEnCampoLaboral(idCampo) {
    const campo = document.getElementById(idCampo);
    const valorOriginal = datosOriginalesLaboral[idCampo];
    const valorActual = campo.value;
    
    // Comparar valores
    const hayModificados = valorOriginal !== valorActual;
    
    // Si hay cambios, mostrar indicador y agregar a lista de modificados
    if (hayModificados) {
        campo.classList.add('modified');
        indicadoresLaboral[idCampo].style.opacity = '1';
        camposModificadosLaboral[idCampo] = true;
    } else {
        campo.classList.remove('modified');
        indicadoresLaboral[idCampo].style.opacity = '0';
        delete camposModificadosLaboral[idCampo];
    }
    
    // Habilitar o deshabilitar botón guardar
    btnSaveWork.disabled = Object.keys(camposModificadosLaboral).length === 0;
}
// Guardar cambios en información laboral (versión con debug)
async function guardarCambiosLaboral() {
    try {
        // Verificar si hay cambios
        if (Object.keys(camposModificadosLaboral).length === 0) {
            mostrarNotificacion('No hay cambios para guardar', 'info');
            return;
        }
        
        // Validar campos requeridos
        let hayErrores = false;
        
        if (!departamento.value) {
            departamento.classList.add('invalid');
            hayErrores = true;
        }
        
        if (!puesto.value) {
            puesto.classList.add('invalid');
            hayErrores = true;
        }
        
        if (!tipoPersonal.value) {
            tipoPersonal.classList.add('invalid');
            hayErrores = true;
        }
        
        if (!inicioLaboral.value) {
            inicioLaboral.classList.add('invalid');
            hayErrores = true;
        }
        
        if (!estadoLaboral.value) {
            estadoLaboral.classList.add('invalid');
            hayErrores = true;
        }

        if (hayErrores) {
            mostrarMensajeSistema(warningMessage, 'Por favor complete todos los campos obligatorios');
            return;
        }
        
        // Validación adicional para estados de retiro (Despedido o Renunció)
        const nuevoEstado = parseInt(estadoLaboral.value);
        const estadoOriginal = parseInt(datosOriginalesLaboral.estadoLaboral);
        const esRetiro = (nuevoEstado === 2 || nuevoEstado === 3); // Despedido o Renunció
        const cambioARetiro = esRetiro && nuevoEstado !== estadoOriginal;
        
        // Si cambia a estado de retiro (Despedido o Renunció) y no se ha completado la información de retiro
        if (cambioARetiro && (!fechaFinColaborador.value || !observacionRetiro.value.trim())) {
            // Mostrar modal de retiro para capturar información
            const estadoTexto = estadoLaboral.options[estadoLaboral.selectedIndex].text;
            mostrarModalRetiro(nuevoEstado, estadoTexto);
            return; // Detener el proceso hasta que se complete la información
        }
        
        // Evitar múltiples envíos
        btnSaveWork.innerHTML = '<span class="loading-spinner"></span> Guardando...';
        btnSaveWork.disabled = true;
        
        // Preparar datos para actualizar
        const datosActualizados = {
            IdSucuDepa: departamento.value,
            IdPuesto: puesto.value,
            TipoPersonal: tipoPersonal.value,
            IdPlanilla: planilla.value || null, // Permitir NULL
            InicioLaboral: inicioLaboral.value,
            FechaContrato: fechaContrato.value || null,
            FechaPlanilla: fechaPlanilla.value || null,
            Estado: estadoLaboral.value,
            IGSS: igss.value.trim() || null,
            IRTRA: irtra.value.trim() || null,
            NoCuenta: noCuenta.value.trim() || null,
            SalarioDiario: salarioDiario.value ? parseFloat(salarioDiario.value) : null,
            SalarioQuincena: salarioQuincena.value ? parseFloat(salarioQuincena.value) : null,
            SalarioQuincenaFinMes: salarioQuincenaFinMes.value ? parseFloat(salarioQuincenaFinMes.value) : null,
            SalarioBase: salarioBase.value ? parseFloat(salarioBase.value) : null, // Permitir NULL
            Bonificacion: bonificacion.value ? parseFloat(bonificacion.value) : null // Permitir NULL
        };
        
        // Formar el nombre completo
        const nombreCompleto = [
            empleadoActual.PrimerNombre,
            empleadoActual.SegundoNombre,
            empleadoActual.TercerNombre,
            empleadoActual.PrimerApellido,
            empleadoActual.SegundoApellido
        ].filter(Boolean).join(' ');
        
        // Conectar a la base de datos
        const connection = await connectionString();

        // Obtener nombres para el historial
        const nombresOriginales = {};
        const nombresActualizados = {};
        
        // Obtener nombre de departamento
        if (datosOriginalesLaboral.departamento) {
            const deptoQuery = `
                SELECT NombreDepartamento FROM departamentos 
                WHERE IdDepartamento = ?
            `;
            const deptoResult = await connection.query(deptoQuery, [datosOriginalesLaboral.departamento]);
            nombresOriginales.departamento = deptoResult.length > 0 ? 
                deptoResult[0].NombreDepartamento : 'No registrado';
        } else {
            nombresOriginales.departamento = 'No registrado';
        }
        
        if (datosActualizados.IdSucuDepa) {
            const deptoQuery = `
                SELECT NombreDepartamento FROM departamentos 
                WHERE IdDepartamento = ?
            `;
            const deptoResult = await connection.query(deptoQuery, [datosActualizados.IdSucuDepa]);
            nombresActualizados.departamento = deptoResult.length > 0 ? 
                deptoResult[0].NombreDepartamento : 'No registrado';
        } else {
            nombresActualizados.departamento = 'No registrado';
        }
        
        // Obtener nombre de puesto
        if (datosOriginalesLaboral.puesto) {
            const puestoQuery = `
                SELECT pg.Nombre FROM Puestos p
                JOIN PuestosGenerales pg ON p.Id_PuestoGeneral = pg.Id_Puesto
                WHERE p.IdPuesto = ?
            `;
            const puestoResult = await connection.query(puestoQuery, [datosOriginalesLaboral.puesto]);
            nombresOriginales.puesto = puestoResult.length > 0 ? 
                puestoResult[0].Nombre : 'No registrado';
        } else {
            nombresOriginales.puesto = 'No registrado';
        }
        
        if (datosActualizados.IdPuesto) {
            const puestoQuery = `
                SELECT pg.Nombre FROM Puestos p
                JOIN PuestosGenerales pg ON p.Id_PuestoGeneral = pg.Id_Puesto
                WHERE p.IdPuesto = ?
            `;
            const puestoResult = await connection.query(puestoQuery, [datosActualizados.IdPuesto]);
            nombresActualizados.puesto = puestoResult.length > 0 ? 
                puestoResult[0].Nombre : 'No registrado';
        } else {
            nombresActualizados.puesto = 'No registrado';
        }
        
        // Obtener nombre de tipo personal
        if (datosOriginalesLaboral.tipoPersonal) {
            const tipoQuery = `
                SELECT TipoPersonal FROM TipoPersonal 
                WHERE IdTipo = ?
            `;
            const tipoResult = await connection.query(tipoQuery, [datosOriginalesLaboral.tipoPersonal]);
            nombresOriginales.tipoPersonal = tipoResult.length > 0 ? 
                tipoResult[0].TipoPersonal : 'No registrado';
        } else {
            nombresOriginales.tipoPersonal = 'No registrado';
        }
        
        if (datosActualizados.TipoPersonal) {
            const tipoQuery = `
                SELECT TipoPersonal FROM TipoPersonal 
                WHERE IdTipo = ?
            `;
            const tipoResult = await connection.query(tipoQuery, [datosActualizados.TipoPersonal]);
            nombresActualizados.tipoPersonal = tipoResult.length > 0 ? 
                tipoResult[0].TipoPersonal : 'No registrado';
        } else {
            nombresActualizados.tipoPersonal = 'No registrado';
        }
        
        // DEBUG: Obtener y mostrar nombre de planilla
        console.log('=== DEBUG PLANILLA ===');
        if (datosOriginalesLaboral.planilla) {
            console.log('Buscando planilla original con ID:', datosOriginalesLaboral.planilla);
            const planillaQuery = `
                SELECT 
                    CONCAT(IFNULL(d.Nombre, ''), ' - ', p.Nombre_Planilla) AS PlanillaCompleta
                FROM planillas p
                LEFT JOIN divisiones d ON p.Division = d.IdDivision
                WHERE p.IdPlanilla = ?
            `;
            try {
                const planillaResult = await connection.query(planillaQuery, [datosOriginalesLaboral.planilla]);
                console.log('Resultado query planilla original:', planillaResult);
                nombresOriginales.planilla = planillaResult.length > 0 ? 
                    planillaResult[0].PlanillaCompleta : 'No registrado';
            } catch (error) {
                console.error('Error al buscar planilla original:', error);
                nombresOriginales.planilla = 'Error al obtener';
            }
        } else {
            nombresOriginales.planilla = 'No registrado';
        }
        
        if (datosActualizados.IdPlanilla) {
            console.log('Buscando planilla nueva con ID:', datosActualizados.IdPlanilla);
            const planillaQuery = `
                SELECT 
                    CONCAT(IFNULL(d.Nombre, ''), ' - ', p.Nombre_Planilla) AS PlanillaCompleta
                FROM planillas p
                LEFT JOIN divisiones d ON p.Division = d.IdDivision
                WHERE p.IdPlanilla = ?
            `;
            try {
                const planillaResult = await connection.query(planillaQuery, [datosActualizados.IdPlanilla]);
                console.log('Resultado query planilla nueva:', planillaResult);
                nombresActualizados.planilla = planillaResult.length > 0 ? 
                    planillaResult[0].PlanillaCompleta : 'No registrado';
            } catch (error) {
                console.error('Error al buscar planilla nueva:', error);
                nombresActualizados.planilla = 'Error al obtener';
            }
        } else {
            nombresActualizados.planilla = 'No registrado';
        }
        
        // Obtener nombre de estado laboral
        if (datosOriginalesLaboral.estadoLaboral) {
            const estadoQuery = `
                SELECT EstadoPersonal FROM EstadoPersonal 
                WHERE IdEstado = ?
            `;
            const estadoResult = await connection.query(estadoQuery, [datosOriginalesLaboral.estadoLaboral]);
            nombresOriginales.estadoLaboral = estadoResult.length > 0 ? 
                estadoResult[0].EstadoPersonal : 'No registrado';
        } else {
            nombresOriginales.estadoLaboral = 'No registrado';
        }
        
        if (datosActualizados.Estado) {
            const estadoQuery = `
                SELECT EstadoPersonal FROM EstadoPersonal 
                WHERE IdEstado = ?
            `;
            const estadoResult = await connection.query(estadoQuery, [datosActualizados.Estado]);
            nombresActualizados.estadoLaboral = estadoResult.length > 0 ? 
                estadoResult[0].EstadoPersonal : 'No registrado';
        } else {
            nombresActualizados.estadoLaboral = 'No registrado';
        }
        
        // Iniciar transacción
        await connection.beginTransaction();
        
        try {
            // DEBUG: Mostrar query y parámetros antes de ejecutar
            console.log('=== DEBUG QUERY UPDATE ===');
            let updateQuery = `
                UPDATE personal SET
                    IdSucuDepa = ?,
                    IdPuesto = ?,
                    TipoPersonal = ?,
                    IdPlanilla = ?,
                    InicioLaboral = ?,
                    FechaContrato = ?,
                    FechaPlanilla = ?,
                    Estado = ?,
                    IGSS = ?,
                    IRTRA = ?,
                    NoCuenta = ?,
                    SalarioDiario = ?,
                    SalarioQuincena = ?,
                    SalarioQuincenaFinMes = ?,
                    SalarioBase = ?,
                    Bonificacion = ?
                WHERE IdPersonal = ?
            `;
            
            const updateParams = [
                datosActualizados.IdSucuDepa,
                datosActualizados.IdPuesto,
                datosActualizados.TipoPersonal,
                datosActualizados.IdPlanilla,
                datosActualizados.InicioLaboral,
                datosActualizados.FechaContrato,
                datosActualizados.FechaPlanilla,
                datosActualizados.Estado,
                datosActualizados.IGSS,
                datosActualizados.IRTRA,
                datosActualizados.NoCuenta,
                datosActualizados.SalarioDiario,
                datosActualizados.SalarioQuincena,
                datosActualizados.SalarioQuincenaFinMes,
                datosActualizados.SalarioBase,
                datosActualizados.Bonificacion,
                empleadoActual.IdPersonal
            ];
            updateParams.forEach((param, index) => {
                console.log(`  [${index}]: ${param} (${typeof param}) ${param === null ? '- ES NULL' : ''}`);
            });
            
            // 1. Actualizar tabla personal
            await connection.query(updateQuery, updateParams);

            // 2. NUEVA FUNCIONALIDAD: Verificar reactivación de colaborador
            const esReactivacion = (estadoOriginal === 2 || estadoOriginal === 3) && parseInt(datosActualizados.Estado) === 1;
            
            if (esReactivacion) {
                // Buscar y invalidar registros activos en DespidosRenuncias
                const verificarRetiroQuery = `
                    SELECT IdDespidoRenuncia, EstadoPersonal 
                    FROM DespidosRenuncias 
                    WHERE IdPersonal = ? AND Estado = 1
                    ORDER BY FechaRegistro DESC 
                    LIMIT 1
                `;
                
                const registrosRetiro = await connection.query(verificarRetiroQuery, [empleadoActual.IdPersonal]);
                
                if (registrosRetiro.length > 0) {
                    // Invalidar el registro de retiro más reciente
                    const invalidarRetiroQuery = `
                        UPDATE DespidosRenuncias 
                        SET Estado = 0
                        WHERE IdDespidoRenuncia = ?
                    `;
                    
                    const observacionInvalidacion = `Colaborador reactivado - Estado cambiado de ${registrosRetiro[0].EstadoPersonal} a Activo por ${userData.NombreCompleto}`;
                    
                    await connection.query(invalidarRetiroQuery, [
                        registrosRetiro[0].IdDespidoRenuncia
                    ]);
                    
                    console.log(`Registro de retiro invalidado para colaborador ID: ${empleadoActual.IdPersonal}`);
                    
                    // Registrar en historial la reactivación
                    const historialReactivacionQuery = `
                        INSERT INTO CambiosPersonal 
                        (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    await connection.query(historialReactivacionQuery, [
                        empleadoActual.IdPersonal,
                        nombreCompleto,
                        4, // TipoCambio 4 = Información Laboral
                        'Reactivación de Colaborador',
                        `Registro de ${registrosRetiro[0].EstadoPersonal} invalidado`,
                        'Colaborador reactivado exitosamente',
                        userData.IdPersonal,
                        userData.NombreCompleto
                    ]);
                }
            }
            
            // 3. Si es cambio a estado de Despedido o Renunció, registrar en la tabla DespidosRenuncias
            if (cambioARetiro) {
                const retiroQuery = `
                    INSERT INTO DespidosRenuncias 
                    (IdPersonal, NombrePersonal, IdEstadoPersonal, EstadoPersonal, 
                    FechaFinColaborador, ObservacionRetiro, IdUsuario, NombreUsuario, Estado)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                `;
                
                await connection.query(retiroQuery, [
                    empleadoActual.IdPersonal,
                    nombreCompleto,
                    nuevoEstado,
                    nombresActualizados.estadoLaboral,
                    fechaFinColaborador.value,
                    observacionRetiro.value.trim(),
                    userData.IdPersonal,
                    userData.NombreCompleto
                ]);
            }
            for (const campo in camposModificadosLaboral) {
                let nombreCampo, valorAnterior, valorNuevo, tipoCambio = 4; // TipoCambio 4 = Información Laboral
                
                // Mapear el ID del campo a un nombre más amigable
                switch(campo) {
                    case 'departamento':
                        nombreCampo = 'Departamento';
                        valorAnterior = nombresOriginales.departamento;
                        valorNuevo = nombresActualizados.departamento;
                        break;
                    case 'puesto':
                        nombreCampo = 'Puesto';
                        valorAnterior = nombresOriginales.puesto;
                        valorNuevo = nombresActualizados.puesto;
                        break;
                    case 'tipoPersonal':
                        nombreCampo = 'Tipo de Personal';
                        valorAnterior = nombresOriginales.tipoPersonal;
                        valorNuevo = nombresActualizados.tipoPersonal;
                        break;
                    case 'planilla':
                        nombreCampo = 'Planilla';
                        valorAnterior = nombresOriginales.planilla;
                        valorNuevo = nombresActualizados.planilla;
                        break;
                    case 'inicioLaboral':
                        nombreCampo = 'Fecha de Inicio Laboral';
                        valorAnterior = datosOriginalesLaboral.inicioLaboral || 'No registrado';
                        valorNuevo = datosActualizados.InicioLaboral;
                        break;
                    case 'fechaContrato':
                        nombreCampo = 'Fecha de Contrato';
                        valorAnterior = datosOriginalesLaboral.fechaContrato || 'No registrado';
                        valorNuevo = datosActualizados.FechaContrato || 'No registrado';
                        break;
                    case 'fechaPlanilla':
                        nombreCampo = 'Fecha de Planilla';
                        valorAnterior = datosOriginalesLaboral.fechaPlanilla || 'No registrado';
                        valorNuevo = datosActualizados.FechaPlanilla || 'No registrado';
                        break;
                    case 'estadoLaboral':
                        nombreCampo = 'Estado Laboral';
                        valorAnterior = nombresOriginales.estadoLaboral;
                        valorNuevo = nombresActualizados.estadoLaboral;
                        break;
                    case 'igss':
                        nombreCampo = 'IGSS';
                        valorAnterior = datosOriginalesLaboral.igss || 'No registrado';
                        valorNuevo = datosActualizados.IGSS || 'No registrado';
                        break;
                    case 'irtra':
                        nombreCampo = 'IRTRA';
                        valorAnterior = datosOriginalesLaboral.irtra || 'No registrado';
                        valorNuevo = datosActualizados.IRTRA || 'No registrado';
                        break;
                    case 'noCuenta':
                        nombreCampo = 'Número de Cuenta';
                        valorAnterior = datosOriginalesLaboral.noCuenta || 'No registrado';
                        valorNuevo = datosActualizados.NoCuenta || 'No registrado';
                        break;
                    case 'salarioDiario':
                        nombreCampo = 'Salario Diario';
                        valorAnterior = datosOriginalesLaboral.salarioDiario ? `Q ${parseFloat(datosOriginalesLaboral.salarioDiario).toFixed(2)}` : 'No registrado';
                        valorNuevo = datosActualizados.SalarioDiario ? `Q ${parseFloat(datosActualizados.SalarioDiario).toFixed(2)}` : 'No registrado';
                        break;
                    case 'salarioQuincena':
                        nombreCampo = 'Salario Quincena';
                        valorAnterior = datosOriginalesLaboral.salarioQuincena ? `Q ${parseFloat(datosOriginalesLaboral.salarioQuincena).toFixed(2)}` : 'No registrado';
                        valorNuevo = datosActualizados.SalarioQuincena ? `Q ${parseFloat(datosActualizados.SalarioQuincena).toFixed(2)}` : 'No registrado';
                        break;
                    case 'salarioQuincenaFinMes':
                        nombreCampo = 'Salario Quincena Fin Mes';
                        valorAnterior = datosOriginalesLaboral.salarioQuincenaFinMes ? `Q ${parseFloat(datosOriginalesLaboral.salarioQuincenaFinMes).toFixed(2)}` : 'No registrado';
                        valorNuevo = datosActualizados.SalarioQuincenaFinMes ? `Q ${parseFloat(datosActualizados.SalarioQuincenaFinMes).toFixed(2)}` : 'No registrado';
                        break;
                    case 'salarioBase':
                        nombreCampo = 'Salario Base';
                        valorAnterior = datosOriginalesLaboral.salarioBase ? `Q ${parseFloat(datosOriginalesLaboral.salarioBase).toFixed(2)}` : 'No registrado';
                        valorNuevo = `Q ${parseFloat(datosActualizados.SalarioBase).toFixed(2)}`;
                        break;
                    case 'bonificacion':
                        nombreCampo = 'Bonificación';
                        valorAnterior = datosOriginalesLaboral.bonificacion ? `Q ${parseFloat(datosOriginalesLaboral.bonificacion).toFixed(2)}` : 'No registrado';
                        valorNuevo = `Q ${parseFloat(datosActualizados.Bonificacion).toFixed(2)}`;
                        break;
                }
                
                console.log(`Registrando cambio para ${campo}:`, {
                    nombreCampo,
                    valorAnterior,
                    valorNuevo
                });
                
                // Insertar en historial
                const historialQuery = `
                    INSERT INTO CambiosPersonal 
                    (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                const historialParams = [
                    empleadoActual.IdPersonal,
                    nombreCompleto,
                    tipoCambio,
                    nombreCampo,
                    valorAnterior,
                    valorNuevo,
                    userData.IdPersonal,
                    userData.NombreCompleto
                ];
                await connection.query(historialQuery, historialParams);
            }
            
            // Confirmar transacción
            await connection.commit();
            
            // Actualizar datos originales
            datosOriginalesLaboral = {
                departamento: datosActualizados.IdSucuDepa,
                puesto: datosActualizados.IdPuesto,
                tipoPersonal: datosActualizados.TipoPersonal,
                planilla: datosActualizados.IdPlanilla,
                inicioLaboral: datosActualizados.InicioLaboral,
                fechaContrato: datosActualizados.FechaContrato || '',
                fechaPlanilla: datosActualizados.FechaPlanilla || '',
                estadoLaboral: datosActualizados.Estado,
                igss: datosActualizados.IGSS || '',
                irtra: datosActualizados.IRTRA || '',
                noCuenta: datosActualizados.NoCuenta || '',
                salarioDiario: datosActualizados.SalarioDiario || '',
                salarioQuincena: datosActualizados.SalarioQuincena || '',
                salarioQuincenaFinMes: datosActualizados.SalarioQuincenaFinMes || '',
                salarioBase: datosActualizados.SalarioBase || '',
                bonificacion: datosActualizados.Bonificacion || ''
            };
            
            // Actualizar encabezado del empleado
            if (camposModificadosLaboral.departamento || camposModificadosLaboral.puesto) {
                employeePosition.textContent = nombresActualizados.puesto || 'No asignado';
                employeeDepartment.textContent = nombresActualizados.departamento || 'No asignado';
            }
            
            if (camposModificadosLaboral.estadoLaboral) {
                employeeStatus.textContent = nombresActualizados.estadoLaboral;
                
                if (datosActualizados.Estado === '1') {
                    employeeStatus.classList.remove('inactive');
                } else {
                    employeeStatus.classList.add('inactive');
                }
            }
            
            // Limpiar datos del formulario de retiro si se usó
            if (cambioARetiro) {
                fechaFinColaborador.value = '';
                observacionRetiro.value = '';
            }
            
            // Mostrar mensaje de éxito específico según el tipo de operación
            if (esReactivacion) {
                mostrarMensajeSistema(successMessage, 'Colaborador reactivado correctamente - Registro de retiro invalidado');
                mostrarNotificacion('Colaborador reactivado exitosamente', 'success');
            } else if (cambioARetiro) {
                mostrarMensajeSistema(successMessage, 'Retiro del colaborador registrado correctamente');
                mostrarNotificacion('Retiro registrado y datos laborales actualizados', 'success');
            } else {
                mostrarMensajeSistema(successMessage, 'Información laboral actualizada correctamente');
                mostrarNotificacion('Información laboral actualizada correctamente', 'success');
            }
            
            // Limpiar lista de campos modificados
            Object.keys(camposModificadosLaboral).forEach(campo => {
                const element = document.getElementById(campo);
                element.classList.remove('modified');
                element.classList.remove('invalid');
                element.classList.add('saved');
                indicadoresLaboral[campo].style.opacity = '0';
                
                // Quitar clase saved después de un tiempo
                setTimeout(() => {
                    element.classList.remove('saved');
                }, 3000);
            });
            
            camposModificadosLaboral = {};
            
        } catch (error) {
            console.error('Error en la transacción:', error);
            // Revertir transacción en caso de error
            await connection.rollback();
            throw error;
        } finally {
            // Cerrar conexión
            await connection.close();
            
            // Restaurar botón guardar
            btnSaveWork.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            btnSaveWork.disabled = true;
        }
        
    } catch (error) {
        console.error('Error al guardar información laboral:', error);
        mostrarNotificacion('Error al guardar: ' + error.message, 'error');
        
        // Restaurar botón guardar
        btnSaveWork.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        btnSaveWork.disabled = false;
    }
}

// Cancelar cambios de información laboral
function cancelarCambiosLaboral() {
    // Preguntar si hay cambios sin guardar
    if (Object.keys(camposModificadosLaboral).length > 0) {
        if (!confirm('¿Está seguro que desea cancelar los cambios?')) {
            return;
        }
    }
    
    // Restaurar valores originales
    departamento.value = datosOriginalesLaboral.departamento;
    
    // Recargar puestos y restaurar valor original
    cargarPuestos(datosOriginalesLaboral.departamento).then(() => {
        puesto.value = datosOriginalesLaboral.puesto;
    });
    
    tipoPersonal.value = datosOriginalesLaboral.tipoPersonal;
    planilla.value = datosOriginalesLaboral.planilla;
    inicioLaboral.value = datosOriginalesLaboral.inicioLaboral;
    fechaContrato.value = datosOriginalesLaboral.fechaContrato;
    fechaPlanilla.value = datosOriginalesLaboral.fechaPlanilla;
    estadoLaboral.value = datosOriginalesLaboral.estadoLaboral;
    
    // Restaurar valores de los campos adicionales
    igss.value = datosOriginalesLaboral.igss;
    irtra.value = datosOriginalesLaboral.irtra;
    noCuenta.value = datosOriginalesLaboral.noCuenta;
    salarioDiario.value = datosOriginalesLaboral.salarioDiario;
    salarioQuincena.value = datosOriginalesLaboral.salarioQuincena;
    salarioQuincenaFinMes.value = datosOriginalesLaboral.salarioQuincenaFinMes;
    salarioBase.value = datosOriginalesLaboral.salarioBase;
    bonificacion.value = datosOriginalesLaboral.bonificacion;
    
    // Si estaba en proceso de retiro, limpiar datos del modal de retiro
    fechaFinColaborador.value = '';
    observacionRetiro.value = '';
    
    // Limpiar indicadores y estilos
    Object.keys(indicadoresLaboral).forEach(campo => {
        if (indicadoresLaboral[campo]) {
            indicadoresLaboral[campo].style.opacity = '0';
        }
        
        const element = document.getElementById(campo);
        if (element) {
            element.classList.remove('modified');
            element.classList.remove('invalid');
        }
    });
    
    // Limpiar lista de campos modificados
    camposModificadosLaboral = {};
    
    // Deshabilitar botón guardar
    btnSaveWork.disabled = true;
    
    mostrarNotificacion('Cambios cancelados', 'info');
}

// Mostrar historial de cambios de información laboral
async function mostrarHistorialCambiosLaboral() {
    // Mostrar modal
    historyModal.classList.add('show');
    
    // Establecer fechas por defecto (último mes)
    const hoy = new Date();
    const haceMes = new Date();
    haceMes.setMonth(haceMes.getMonth() - 1);
    
    historyDateTo.value = hoy.toISOString().split('T')[0];
    historyDateFrom.value = haceMes.toISOString().split('T')[0];
    
    // Cargar historial
    await cargarHistorialCambiosLaboral();
}

// Cargar historial de cambios de información laboral
async function cargarHistorialCambiosLaboral() {
    try {
        // Validar datos
        if (!empleadoActual || !empleadoActual.IdPersonal) {
            throw new Error('No se ha cargado un empleado');
        }
        
        // Obtener fechas de filtro
        const fechaDesde = historyDateFrom.value || '1900-01-01';
        const fechaHasta = historyDateTo.value || new Date().toISOString().split('T')[0];
        
        // Obtener historial de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT 
                IdPersonal,
                NombrePersonal,
                TipoCambio,
                Cambio,
                ValorAnterior,
                ValorNuevo,
                IdUsuario,
                NombreUsuario,
                FechaCambio,
                FechaHoraCambio
            FROM 
                CambiosPersonal
            WHERE 
                IdPersonal = ? 
                AND TipoCambio = 4
                AND DATE(FechaCambio) BETWEEN ? AND ?
            ORDER BY 
                FechaHoraCambio DESC
        `;
        
        const result = await connection.query(query, [
            empleadoActual.IdPersonal,
            fechaDesde,
            fechaHasta
        ]);
        await connection.close();
        
        // Mostrar resultados
        mostrarResultadosHistorial(result);
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        mostrarNotificacion('Error al cargar historial: ' + error.message, 'error');
    }
}
estadoLaboral.addEventListener('change', function() {
    const estadoId = parseInt(this.value);
    
    // Si el estado es Despedido (2) o Renunció (3), mostrar modal de retiro
    if (estadoId === 2 || estadoId === 3) {
        const estadoTexto = this.options[this.selectedIndex].text;
        mostrarModalRetiro(estadoId, estadoTexto);
    }
    
    verificarCambioEnCampoLaboral('estadoLaboral');
});
// Función para mostrar el modal de retiro
function mostrarModalRetiro(estadoId, estadoTexto) {
    // Establecer título según el tipo de retiro
    retiroModalTitle.textContent = estadoId === 2 ? 
        'Registrar Despido de Colaborador' : 
        'Registrar Renuncia de Colaborador';
    
    // Mostrar nombre del empleado
    retiroEmployeeName.textContent = `${empleadoActual.PrimerNombre} ${empleadoActual.PrimerApellido}`;
    
    // Inicializar fecha con la fecha actual
    const today = new Date().toISOString().split('T')[0];
    fechaFinColaborador.value = today;
    
    // Quitar restricción de fecha máxima para permitir fechas futuras
    fechaFinColaborador.removeAttribute('max'); // Quitamos el máximo para permitir fechas futuras
    
    // Si hay fecha de inicio laboral, establecer como fecha mínima
    if (inicioLaboral.value) {
        fechaFinColaborador.setAttribute('min', inicioLaboral.value);
    }
    
    // Limpiar campo de observación
    observacionRetiro.value = '';
    
    // Limpiar clases de validación
    fechaFinColaborador.classList.remove('invalid');
    observacionRetiro.classList.remove('invalid');
    
    // Mostrar modal
    retiroModal.classList.add('show');
}

// Función para cerrar el modal de retiro y cancelar el cambio de estado
function cerrarModalRetiroCancelar() {
    // Restaurar el estado original
    estadoLaboral.value = datosOriginalesLaboral.estadoLaboral;
    
    // Verificar cambio en campo
    verificarCambioEnCampoLaboral('estadoLaboral');
    
    // Cerrar modal
    retiroModal.classList.remove('show');
    
    // Mostrar notificación
    mostrarNotificacion('Cambio de estado cancelado', 'info');
}

// Eventos para botones del modal
btnCancelRetiro.addEventListener('click', cerrarModalRetiroCancelar);
closeRetiroModal.addEventListener('click', cerrarModalRetiroCancelar);

// Si hace clic fuera del modal, cancelar
retiroModal.addEventListener('click', event => {
    if (event.target === retiroModal) {
        cerrarModalRetiroCancelar();
    }
});

// Guardar información de retiro
btnSaveRetiro.addEventListener('click', function() {
    // Validar campos
    if (!fechaFinColaborador.value) {
        fechaFinColaborador.classList.add('invalid');
        mostrarNotificacion('Debe especificar la fecha de finalización', 'warning');
        return;
    }
    
    if (!observacionRetiro.value.trim()) {
        observacionRetiro.classList.add('invalid');
        mostrarNotificacion('Debe especificar el motivo u observación del retiro', 'warning');
        return;
    }
    
    // Ocultar modal y continuar
    retiroModal.classList.remove('show');
    
    // La información del retiro se guardará junto con los demás cambios laborales
    // El estado se queda seleccionado y el botón Guardar Cambios se activa
});
function inicializarEventosAcademicos() {
    // Eventos para campos de selección
    const selects = [
        estadoPrimaria, planEstudioPrimaria, nivelAcademicoPrimaria,
        estadoBasico, planEstudioBasico, nivelAcademicoBasico,
        estadoDiversificado, planEstudioDiversificado, nivelAcademicoDiversificado, carreraDiversificado,
        estadoUniversidad, planEstudioUniversitario, nivelAcademicoUnivesitario, universidad, carreraUniversitaria,
        estadoMaestria, planEstudio, nivelAcademicoMaestria, universidadMaestria, maestria
    ];
    
    selects.forEach(select => {
        select.addEventListener('change', function() {
            verificarCambioEnCampoAcademico(select.id);
        });
    });
    
    // Botones
    btnSaveAcademic.addEventListener('click', guardarCambiosAcademicos);
    btnCancelAcademic.addEventListener('click', cancelarCambiosAcademicos);
    btnHistoryAcademic.addEventListener('click', mostrarHistorialCambiosAcademicos);
    
    // Eventos de navegación
    document.querySelector('.progress-step[data-section="academic"]').addEventListener('click', function() {
        mostrarSeccion('academic');
    });
}
async function cargarEstadosEducacion() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdEstadoEducacion, DescripcionEstado
            FROM EstadosEducacion
            ORDER BY IdEstadoEducacion
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Agregar opciones a cada select de estado
        const estados = [estadoPrimaria, estadoBasico, estadoDiversificado, estadoUniversidad, estadoMaestria];
        
        estados.forEach(select => {
            // Limpiar opciones actuales
            select.innerHTML = '<option value="">Seleccione...</option>';
            
            // Agregar nuevas opciones
            result.forEach(estado => {
                const option = document.createElement('option');
                option.value = estado.IdEstadoEducacion;
                option.textContent = estado.DescripcionEstado;
                select.appendChild(option);
            });
        });
    } catch (error) {
        console.error('Error al cargar estados de educación:', error);
        mostrarNotificacion('Error al cargar estados de educación', 'error');
    }
}

// Cargar planes de estudio
async function cargarPlanesEstudio() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdPlanEstudio, Plan
            FROM planestudios
            ORDER BY Plan
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Agregar opciones a cada select de plan de estudio
        const planes = [planEstudioPrimaria, planEstudioBasico, planEstudioDiversificado, planEstudioUniversitario, planEstudio];
        
        planes.forEach(select => {
            // Limpiar opciones actuales
            select.innerHTML = '<option value="">Seleccione...</option>';
            
            // Agregar nuevas opciones
            result.forEach(plan => {
                const option = document.createElement('option');
                option.value = plan.IdPlanEstudio;
                option.textContent = plan.Plan;
                select.appendChild(option);
            });
        });
    } catch (error) {
        console.error('Error al cargar planes de estudio:', error);
        mostrarNotificacion('Error al cargar planes de estudio', 'error');
    }
}

// Cargar semestres
async function cargarSemestres() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT Id_semestre, Semestre
            FROM semestres
            ORDER BY Id_semestre
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Agregar opciones a cada select de semestre
        const semestres = [nivelAcademicoPrimaria, nivelAcademicoBasico, nivelAcademicoDiversificado, nivelAcademicoUnivesitario];
        
        semestres.forEach(select => {
            // Limpiar opciones actuales
            select.innerHTML = '<option value="">Seleccione...</option>';
            
            // Agregar nuevas opciones
            result.forEach(semestre => {
                const option = document.createElement('option');
                option.value = semestre.Id_semestre;
                option.textContent = semestre.Semestre;
                select.appendChild(option);
            });
        });
    } catch (error) {
        console.error('Error al cargar semestres:', error);
        mostrarNotificacion('Error al cargar semestres', 'error');
    }
}

// Cargar trimestres
async function cargarTrimestres() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdTrimestre, Trimestre
            FROM Trimestres
            ORDER BY IdTrimestre
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        nivelAcademicoMaestria.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar nuevas opciones
        result.forEach(trimestre => {
            const option = document.createElement('option');
            option.value = trimestre.IdTrimestre;
            option.textContent = trimestre.Trimestre;
            nivelAcademicoMaestria.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar trimestres:', error);
        mostrarNotificacion('Error al cargar trimestres', 'error');
    }
}

// Cargar grados académicos
async function cargarGradosAcademicos() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdGrado, GradoAcademico
            FROM GradosAcademicos
            ORDER BY GradoAcademico
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        carreraDiversificado.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar nuevas opciones
        result.forEach(grado => {
            const option = document.createElement('option');
            option.value = grado.IdGrado;
            option.textContent = grado.GradoAcademico;
            carreraDiversificado.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar grados académicos:', error);
        mostrarNotificacion('Error al cargar grados académicos', 'error');
    }
}

// Cargar universidades
async function cargarUniversidades() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdUniversidad, NombreUniversidad
            FROM Universidades
            ORDER BY NombreUniversidad
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Agregar opciones a cada select de universidad
        const universidades = [universidad, universidadMaestria];
        
        universidades.forEach(select => {
            // Limpiar opciones actuales
            select.innerHTML = '<option value="">Seleccione...</option>';
            
            // Agregar nuevas opciones
            result.forEach(uni => {
                const option = document.createElement('option');
                option.value = uni.IdUniversidad;
                option.textContent = uni.NombreUniversidad;
                select.appendChild(option);
            });
        });
    } catch (error) {
        console.error('Error al cargar universidades:', error);
        mostrarNotificacion('Error al cargar universidades', 'error');
    }
}

// Cargar carreras universitarias
async function cargarCarrerasUniversitarias() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdCarreraUniversitaria, NombreCarrera
            FROM CarrerasUniversitarias
            ORDER BY NombreCarrera
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        carreraUniversitaria.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar nuevas opciones
        result.forEach(carrera => {
            const option = document.createElement('option');
            option.value = carrera.IdCarreraUniversitaria;
            option.textContent = carrera.NombreCarrera;
            carreraUniversitaria.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar carreras universitarias:', error);
        mostrarNotificacion('Error al cargar carreras universitarias', 'error');
    }
}

// Cargar maestrías
async function cargarMaestrias() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdMaestria, NombreMaestria
            FROM Maestrias
            ORDER BY NombreMaestria
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        maestria.innerHTML = '<option value="">Seleccione...</option>';
        
        // Agregar nuevas opciones
        result.forEach(item => {
            const option = document.createElement('option');
            option.value = item.IdMaestria;
            option.textContent = item.NombreMaestria;
            maestria.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar maestrías:', error);
        mostrarNotificacion('Error al cargar maestrías', 'error');
    }
}

// Verificar cambio en un campo académico
function verificarCambioEnCampoAcademico(idCampo) {
    const campo = document.getElementById(idCampo);
    const valorOriginal = datosOriginalesAcademicos[idCampo];
    const valorActual = campo.value;
    
    // Comparar valores
    const hayModificados = valorOriginal !== valorActual;
    
    // Si hay cambios, mostrar indicador y agregar a lista de modificados
    if (hayModificados) {
        campo.classList.add('modified');
        indicadoresAcademicos[idCampo].style.opacity = '1';
        camposModificadosAcademicos[idCampo] = true;
    } else {
        campo.classList.remove('modified');
        indicadoresAcademicos[idCampo].style.opacity = '0';
        delete camposModificadosAcademicos[idCampo];
    }
    
    // Habilitar o deshabilitar botón guardar
    btnSaveAcademic.disabled = Object.keys(camposModificadosAcademicos).length === 0;
}

// Guardar cambios en información académica
async function guardarCambiosAcademicos() {
    try {
        // Verificar si hay cambios
        if (Object.keys(camposModificadosAcademicos).length === 0) {
            mostrarNotificacion('No hay cambios para guardar', 'info');
            return;
        }
        
        // Mostrar indicador de carga
        btnSaveAcademic.innerHTML = '<span class="loading-spinner"></span> Guardando...';
        btnSaveAcademic.disabled = true;
        
        // Preparar datos para actualizar
        const datosActualizados = {
            EstadoPrimaria: estadoPrimaria.value || null,
            IdPlanEstudioPrimaria: planEstudioPrimaria.value || null,
            IdNivelAcademicoPrimaria: nivelAcademicoPrimaria.value || null,
            EstadoBasico: estadoBasico.value || null,
            IdPlanEstudioBasico: planEstudioBasico.value || null,
            IdNivelAcademicoBasico: nivelAcademicoBasico.value || null,
            EstadoDiversificado: estadoDiversificado.value || null,
            IdPlanEstudioDiversificado: planEstudioDiversificado.value || null,
            IdNivelAcademicoDiversificado: nivelAcademicoDiversificado.value || null,
            IdCarreraDiversificado: carreraDiversificado.value || null,
            EstadoUniversidad: estadoUniversidad.value || null,
            IdPlanEstudioUniversitario: planEstudioUniversitario.value || null,
            IdNivelAcademicoUnivesitario: nivelAcademicoUnivesitario.value || null,
            IdUniversidad: universidad.value || null,
            IdCarreraUniversitaria: carreraUniversitaria.value || null,
            EstadoMaestria: estadoMaestria.value || null,
            IdPlanEstudio: planEstudio.value || null,
            IdNivelAcademicoMaestria: nivelAcademicoMaestria.value || null,
            IdUniversidadMaestria: universidadMaestria.value || null,
            IdMaestria: maestria.value || null
        };
        
        // Formar el nombre completo
        const nombreCompleto = [
            empleadoActual.PrimerNombre,
            empleadoActual.SegundoNombre,
            empleadoActual.TercerNombre,
            empleadoActual.PrimerApellido,
            empleadoActual.SegundoApellido
        ].filter(Boolean).join(' ');
        
        // Conectar a la base de datos
        const connection = await connectionString();

        // Obtener nombres originales y actualizados para el historial
        const nombresOriginales = {};
        const nombresActualizados = {};
        
        // Obtener nombres de estados de educación
        const estadosEducacion = {};
        const estadosQuery = `SELECT IdEstadoEducacion, DescripcionEstado FROM EstadosEducacion`;
        const estadosResult = await connection.query(estadosQuery);
        estadosResult.forEach(estado => {
            estadosEducacion[estado.IdEstadoEducacion] = estado.DescripcionEstado;
        });
        
        // Obtener nombres de planes de estudio
        const planesEstudio = {};
        const planesQuery = `SELECT IdPlanEstudio, Plan FROM planestudios`;
        const planesResult = await connection.query(planesQuery);
        planesResult.forEach(plan => {
            planesEstudio[plan.IdPlanEstudio] = plan.Plan;
        });
        
        // Obtener nombres de semestres
        const semestres = {};
        const semestresQuery = `SELECT Id_semestre, Semestre FROM semestres`;
        const semestresResult = await connection.query(semestresQuery);
        semestresResult.forEach(semestre => {
            semestres[semestre.Id_semestre] = semestre.Semestre;
        });
        
        // Obtener nombres de trimestres
        const trimestres = {};
        const trimestresQuery = `SELECT IdTrimestre, Trimestre FROM Trimestres`;
        const trimestresResult = await connection.query(trimestresQuery);
        trimestresResult.forEach(trimestre => {
            trimestres[trimestre.IdTrimestre] = trimestre.Trimestre;
        });
        
        // Obtener nombres de grados académicos
        const grados = {};
        const gradosQuery = `SELECT IdGrado, GradoAcademico FROM GradosAcademicos`;
        const gradosResult = await connection.query(gradosQuery);
        gradosResult.forEach(grado => {
            grados[grado.IdGrado] = grado.GradoAcademico;
        });
        
        // Obtener nombres de universidades
        const universidades = {};
        const universidadesQuery = `SELECT IdUniversidad, NombreUniversidad FROM Universidades`;
        const universidadesResult = await connection.query(universidadesQuery);
        universidadesResult.forEach(uni => {
            universidades[uni.IdUniversidad] = uni.NombreUniversidad;
        });
        
        // Obtener nombres de carreras universitarias
        const carreras = {};
        const carrerasQuery = `SELECT IdCarreraUniversitaria, NombreCarrera FROM CarrerasUniversitarias`;
        const carrerasResult = await connection.query(carrerasQuery);
        carrerasResult.forEach(carrera => {
            carreras[carrera.IdCarreraUniversitaria] = carrera.NombreCarrera;
        });
        
        // Obtener nombres de maestrías
        const maestrias = {};
        const maestriasQuery = `SELECT IdMaestria, NombreMaestria FROM Maestrias`;
        const maestriasResult = await connection.query(maestriasQuery);
        maestriasResult.forEach(item => {
            maestrias[item.IdMaestria] = item.NombreMaestria;
        });
        
        // Iniciar transacción
        await connection.beginTransaction();
        
        try {
            // 1. Actualizar tabla InfoAcademica
            let updateQuery = `
                UPDATE InfoAcademica SET
                    EstadoPrimaria = ?,
                    IdPlanEstudioPrimaria = ?,
                    IdNivelAcademicoPrimaria = ?,
                    EstadoBasico = ?,
                    IdPlanEstudioBasico = ?,
                    IdNivelAcademicoBasico = ?,
                    EstadoDiversificado = ?,
                    IdPlanEstudioDiversificado = ?,
                    IdNivelAcademicoDiversificado = ?,
                    IdCarreraDiversificado = ?,
                    EstadoUniversidad = ?,
                    IdPlanEstudioUniversitario = ?,
                    IdNivelAcademicoUnivesitario = ?,
                    IdUniversidad = ?,
                    IdCarreraUniversitaria = ?,
                    EstadoMaestria = ?,
                    IdPlanEstudio = ?,
                    IdNivelAcademicoMaestria = ?,
                    IdUniversidadMaestria = ?,
                    IdMaestria = ?
                WHERE IdEstudio = ?
            `;
            
            await connection.query(updateQuery, [
                datosActualizados.EstadoPrimaria,
                datosActualizados.IdPlanEstudioPrimaria,
                datosActualizados.IdNivelAcademicoPrimaria,
                datosActualizados.EstadoBasico,
                datosActualizados.IdPlanEstudioBasico,
                datosActualizados.IdNivelAcademicoBasico,
                datosActualizados.EstadoDiversificado,
                datosActualizados.IdPlanEstudioDiversificado,
                datosActualizados.IdNivelAcademicoDiversificado,
                datosActualizados.IdCarreraDiversificado,
                datosActualizados.EstadoUniversidad,
                datosActualizados.IdPlanEstudioUniversitario,
                datosActualizados.IdNivelAcademicoUnivesitario,
                datosActualizados.IdUniversidad,
                datosActualizados.IdCarreraUniversitaria,
                datosActualizados.EstadoMaestria,
                datosActualizados.IdPlanEstudio,
                datosActualizados.IdNivelAcademicoMaestria,
                datosActualizados.IdUniversidadMaestria,
                datosActualizados.IdMaestria,
                infoAcademicaId
            ]);
            
            // 2. Registrar cambios en historial
            for (const campo in camposModificadosAcademicos) {
                let nombreCampo, valorAnterior, valorNuevo, tipoCambio = 5; // TipoCambio 5 = Información Académica
                
                // Mapear el ID del campo a un nombre más amigable
                switch(campo) {
                    case 'estadoPrimaria':
                        nombreCampo = 'Estado de Primaria';
                        valorAnterior = datosOriginalesAcademicos.estadoPrimaria ? estadosEducacion[datosOriginalesAcademicos.estadoPrimaria] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.EstadoPrimaria ? estadosEducacion[datosActualizados.EstadoPrimaria] || 'No registrado' : 'No registrado';
                        break;
                    case 'planEstudioPrimaria':
                        nombreCampo = 'Plan de Estudio de Primaria';
                        valorAnterior = datosOriginalesAcademicos.planEstudioPrimaria ? planesEstudio[datosOriginalesAcademicos.planEstudioPrimaria] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdPlanEstudioPrimaria ? planesEstudio[datosActualizados.IdPlanEstudioPrimaria] || 'No registrado' : 'No registrado';
                        break;
                    case 'nivelAcademicoPrimaria':
                        nombreCampo = 'Nivel Académico de Primaria';
                        valorAnterior = datosOriginalesAcademicos.nivelAcademicoPrimaria ? semestres[datosOriginalesAcademicos.nivelAcademicoPrimaria] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdNivelAcademicoPrimaria ? semestres[datosActualizados.IdNivelAcademicoPrimaria] || 'No registrado' : 'No registrado';
                        break;
                    case 'estadoBasico':
                        nombreCampo = 'Estado de Básico';
                        valorAnterior = datosOriginalesAcademicos.estadoBasico ? estadosEducacion[datosOriginalesAcademicos.estadoBasico] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.EstadoBasico ? estadosEducacion[datosActualizados.EstadoBasico] || 'No registrado' : 'No registrado';
                        break;
                    case 'planEstudioBasico':
                        nombreCampo = 'Plan de Estudio de Básico';
                        valorAnterior = datosOriginalesAcademicos.planEstudioBasico ? planesEstudio[datosOriginalesAcademicos.planEstudioBasico] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdPlanEstudioBasico ? planesEstudio[datosActualizados.IdPlanEstudioBasico] || 'No registrado' : 'No registrado';
                        break;
                    case 'nivelAcademicoBasico':
                        nombreCampo = 'Nivel Académico de Básico';
                        valorAnterior = datosOriginalesAcademicos.nivelAcademicoBasico ? semestres[datosOriginalesAcademicos.nivelAcademicoBasico] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdNivelAcademicoBasico ? semestres[datosActualizados.IdNivelAcademicoBasico] || 'No registrado' : 'No registrado';
                        break;
                    case 'estadoDiversificado':
                        nombreCampo = 'Estado de Diversificado';
                        valorAnterior = datosOriginalesAcademicos.estadoDiversificado ? estadosEducacion[datosOriginalesAcademicos.estadoDiversificado] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.EstadoDiversificado ? estadosEducacion[datosActualizados.EstadoDiversificado] || 'No registrado' : 'No registrado';
                        break;
                    case 'planEstudioDiversificado':
                        nombreCampo = 'Plan de Estudio de Diversificado';
                        valorAnterior = datosOriginalesAcademicos.planEstudioDiversificado ? planesEstudio[datosOriginalesAcademicos.planEstudioDiversificado] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdPlanEstudioDiversificado ? planesEstudio[datosActualizados.IdPlanEstudioDiversificado] || 'No registrado' : 'No registrado';
                        break;
                    case 'nivelAcademicoDiversificado':
                        nombreCampo = 'Nivel Académico de Diversificado';
                        valorAnterior = datosOriginalesAcademicos.nivelAcademicoDiversificado ? semestres[datosOriginalesAcademicos.nivelAcademicoDiversificado] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdNivelAcademicoDiversificado ? semestres[datosActualizados.IdNivelAcademicoDiversificado] || 'No registrado' : 'No registrado';
                        break;
                    case 'carreraDiversificado':
                        nombreCampo = 'Grado Académico de Diversificado';
                        valorAnterior = datosOriginalesAcademicos.carreraDiversificado ? grados[datosOriginalesAcademicos.carreraDiversificado] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdCarreraDiversificado ? grados[datosActualizados.IdCarreraDiversificado] || 'No registrado' : 'No registrado';
                        break;
                    case 'estadoUniversidad':
                        nombreCampo = 'Estado de Universidad';
                        valorAnterior = datosOriginalesAcademicos.estadoUniversidad ? estadosEducacion[datosOriginalesAcademicos.estadoUniversidad] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.EstadoUniversidad ? estadosEducacion[datosActualizados.EstadoUniversidad] || 'No registrado' : 'No registrado';
                        break;
                    case 'planEstudioUniversitario':
                        nombreCampo = 'Plan de Estudio Universitario';
                        valorAnterior = datosOriginalesAcademicos.planEstudioUniversitario ? planesEstudio[datosOriginalesAcademicos.planEstudioUniversitario] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdPlanEstudioUniversitario ? planesEstudio[datosActualizados.IdPlanEstudioUniversitario] || 'No registrado' : 'No registrado';
                        break;
                    case 'nivelAcademicoUnivesitario':
                        nombreCampo = 'Nivel Académico Universitario';
                        valorAnterior = datosOriginalesAcademicos.nivelAcademicoUnivesitario ? semestres[datosOriginalesAcademicos.nivelAcademicoUnivesitario] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdNivelAcademicoUnivesitario ? semestres[datosActualizados.IdNivelAcademicoUnivesitario] || 'No registrado' : 'No registrado';
                        break;
                    case 'universidad':
                        nombreCampo = 'Universidad';
                        valorAnterior = datosOriginalesAcademicos.universidad ? universidades[datosOriginalesAcademicos.universidad] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdUniversidad ? universidades[datosActualizados.IdUniversidad] || 'No registrado' : 'No registrado';
                        break;
                    case 'carreraUniversitaria':
                        nombreCampo = 'Carrera Universitaria';
                        valorAnterior = datosOriginalesAcademicos.carreraUniversitaria ? carreras[datosOriginalesAcademicos.carreraUniversitaria] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdCarreraUniversitaria ? carreras[datosActualizados.IdCarreraUniversitaria] || 'No registrado' : 'No registrado';
                        break;
                    case 'estadoMaestria':
                        nombreCampo = 'Estado de Maestría';
                        valorAnterior = datosOriginalesAcademicos.estadoMaestria ? estadosEducacion[datosOriginalesAcademicos.estadoMaestria] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.EstadoMaestria ? estadosEducacion[datosActualizados.EstadoMaestria] || 'No registrado' : 'No registrado';
                        break;
                    case 'planEstudio':
                        nombreCampo = 'Plan de Estudio de Maestría';
                        valorAnterior = datosOriginalesAcademicos.planEstudio ? planesEstudio[datosOriginalesAcademicos.planEstudio] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdPlanEstudio ? planesEstudio[datosActualizados.IdPlanEstudio] || 'No registrado' : 'No registrado';
                        break;
                    case 'nivelAcademicoMaestria':
                        nombreCampo = 'Nivel Académico de Maestría';
                        valorAnterior = datosOriginalesAcademicos.nivelAcademicoMaestria ? trimestres[datosOriginalesAcademicos.nivelAcademicoMaestria] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdNivelAcademicoMaestria ? trimestres[datosActualizados.IdNivelAcademicoMaestria] || 'No registrado' : 'No registrado';
                        break;
                    case 'universidadMaestria':
                        nombreCampo = 'Universidad de Maestría';
                        valorAnterior = datosOriginalesAcademicos.universidadMaestria ? universidades[datosOriginalesAcademicos.universidadMaestria] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdUniversidadMaestria ? universidades[datosActualizados.IdUniversidadMaestria] || 'No registrado' : 'No registrado';
                        break;
                        case 'maestria':
                        nombreCampo = 'Maestría';
                        valorAnterior = datosOriginalesAcademicos.maestria ? maestrias[datosOriginalesAcademicos.maestria] || 'No registrado' : 'No registrado';
                        valorNuevo = datosActualizados.IdMaestria ? maestrias[datosActualizados.IdMaestria] || 'No registrado' : 'No registrado';
                        break;
                }
                
                // Insertar en historial
                const historialQuery = `
                    INSERT INTO CambiosPersonal 
                    (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                await connection.query(historialQuery, [
                    empleadoActual.IdPersonal,
                    nombreCompleto,
                    tipoCambio,
                    nombreCampo,
                    valorAnterior,
                    valorNuevo,
                    userData.IdPersonal,
                    userData.NombreCompleto
                ]);
            }
            
            // Confirmar transacción
            await connection.commit();
            
            // Actualizar datos originales
            datosOriginalesAcademicos = {
                estadoPrimaria: datosActualizados.EstadoPrimaria || '',
                planEstudioPrimaria: datosActualizados.IdPlanEstudioPrimaria || '',
                nivelAcademicoPrimaria: datosActualizados.IdNivelAcademicoPrimaria || '',
                estadoBasico: datosActualizados.EstadoBasico || '',
                planEstudioBasico: datosActualizados.IdPlanEstudioBasico || '',
                nivelAcademicoBasico: datosActualizados.IdNivelAcademicoBasico || '',
                estadoDiversificado: datosActualizados.EstadoDiversificado || '',
                planEstudioDiversificado: datosActualizados.IdPlanEstudioDiversificado || '',
                nivelAcademicoDiversificado: datosActualizados.IdNivelAcademicoDiversificado || '',
                carreraDiversificado: datosActualizados.IdCarreraDiversificado || '',
                estadoUniversidad: datosActualizados.EstadoUniversidad || '',
                planEstudioUniversitario: datosActualizados.IdPlanEstudioUniversitario || '',
                nivelAcademicoUnivesitario: datosActualizados.IdNivelAcademicoUnivesitario || '',
                universidad: datosActualizados.IdUniversidad || '',
                carreraUniversitaria: datosActualizados.IdCarreraUniversitaria || '',
                estadoMaestria: datosActualizados.EstadoMaestria || '',
                planEstudio: datosActualizados.IdPlanEstudio || '',
                nivelAcademicoMaestria: datosActualizados.IdNivelAcademicoMaestria || '',
                universidadMaestria: datosActualizados.IdUniversidadMaestria || '',
                maestria: datosActualizados.IdMaestria || ''
            };
            
            // Mostrar mensaje de éxito
            mostrarMensajeSistema(successMessage, 'Información académica actualizada correctamente');
            mostrarNotificacion('Información académica actualizada correctamente', 'success');
            
            // Limpiar lista de campos modificados
            Object.keys(camposModificadosAcademicos).forEach(campo => {
                const element = document.getElementById(campo);
                element.classList.remove('modified');
                element.classList.add('saved');
                indicadoresAcademicos[campo].style.opacity = '0';
                
                // Quitar clase saved después de un tiempo
                setTimeout(() => {
                    element.classList.remove('saved');
                }, 3000);
            });
            
            camposModificadosAcademicos = {};
            
        } catch (error) {
            // Revertir transacción en caso de error
            await connection.rollback();
            throw error;
        } finally {
            // Cerrar conexión
            await connection.close();
            
            // Restaurar botón guardar
            btnSaveAcademic.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            btnSaveAcademic.disabled = true;
        }
        
    } catch (error) {
        console.error('Error al guardar información académica:', error);
        mostrarNotificacion('Error al guardar: ' + error.message, 'error');
        
        // Restaurar botón guardar
        btnSaveAcademic.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        btnSaveAcademic.disabled = false;
    }
}

// Cancelar cambios de información académica
function cancelarCambiosAcademicos() {
    // Preguntar si hay cambios sin guardar
    if (Object.keys(camposModificadosAcademicos).length > 0) {
        if (!confirm('¿Está seguro que desea cancelar los cambios?')) {
            return;
        }
    }
    
    // Restaurar valores originales
    estadoPrimaria.value = datosOriginalesAcademicos.estadoPrimaria;
    planEstudioPrimaria.value = datosOriginalesAcademicos.planEstudioPrimaria;
    nivelAcademicoPrimaria.value = datosOriginalesAcademicos.nivelAcademicoPrimaria;
    estadoBasico.value = datosOriginalesAcademicos.estadoBasico;
    planEstudioBasico.value = datosOriginalesAcademicos.planEstudioBasico;
    nivelAcademicoBasico.value = datosOriginalesAcademicos.nivelAcademicoBasico;
    estadoDiversificado.value = datosOriginalesAcademicos.estadoDiversificado;
    planEstudioDiversificado.value = datosOriginalesAcademicos.planEstudioDiversificado;
    nivelAcademicoDiversificado.value = datosOriginalesAcademicos.nivelAcademicoDiversificado;
    carreraDiversificado.value = datosOriginalesAcademicos.carreraDiversificado;
    estadoUniversidad.value = datosOriginalesAcademicos.estadoUniversidad;
    planEstudioUniversitario.value = datosOriginalesAcademicos.planEstudioUniversitario;
    nivelAcademicoUnivesitario.value = datosOriginalesAcademicos.nivelAcademicoUnivesitario;
    universidad.value = datosOriginalesAcademicos.universidad;
    carreraUniversitaria.value = datosOriginalesAcademicos.carreraUniversitaria;
    estadoMaestria.value = datosOriginalesAcademicos.estadoMaestria;
    planEstudio.value = datosOriginalesAcademicos.planEstudio;
    nivelAcademicoMaestria.value = datosOriginalesAcademicos.nivelAcademicoMaestria;
    universidadMaestria.value = datosOriginalesAcademicos.universidadMaestria;
    maestria.value = datosOriginalesAcademicos.maestria;
    
    // Limpiar indicadores y estilos
    Object.keys(indicadoresAcademicos).forEach(campo => {
        indicadoresAcademicos[campo].style.opacity = '0';
        const element = document.getElementById(campo);
        element.classList.remove('modified');
    });
    
    // Limpiar lista de campos modificados
    camposModificadosAcademicos = {};
    
    // Deshabilitar botón guardar
    btnSaveAcademic.disabled = true;
    
    mostrarNotificacion('Cambios cancelados', 'info');
}

// Mostrar historial de cambios académicos
async function mostrarHistorialCambiosAcademicos() {
    // Mostrar modal
    historyModal.classList.add('show');
    
    // Establecer fechas por defecto (último mes)
    const hoy = new Date();
    const haceMes = new Date();
    haceMes.setMonth(haceMes.getMonth() - 1);
    
    historyDateTo.value = hoy.toISOString().split('T')[0];
    historyDateFrom.value = haceMes.toISOString().split('T')[0];
    
    // Cargar historial
    await cargarHistorialCambiosAcademicos();
}

// Cargar historial de cambios académicos
async function cargarHistorialCambiosAcademicos() {
    try {
        // Validar datos
        if (!empleadoActual || !empleadoActual.IdPersonal) {
            throw new Error('No se ha cargado un empleado');
        }
        
        // Obtener fechas de filtro
        const fechaDesde = historyDateFrom.value || '1900-01-01';
        const fechaHasta = historyDateTo.value || new Date().toISOString().split('T')[0];
        
        // Obtener historial de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT 
                IdPersonal,
                NombrePersonal,
                TipoCambio,
                Cambio,
                ValorAnterior,
                ValorNuevo,
                IdUsuario,
                NombreUsuario,
                FechaCambio,
                FechaHoraCambio
            FROM 
                CambiosPersonal
            WHERE 
                IdPersonal = ? 
                AND TipoCambio = 5
                AND DATE(FechaCambio) BETWEEN ? AND ?
            ORDER BY 
                FechaHoraCambio DESC
        `;
        
        const result = await connection.query(query, [
            empleadoActual.IdPersonal,
            fechaDesde,
            fechaHasta
        ]);
        await connection.close();
        
        // Mostrar resultados
        mostrarResultadosHistorial(result);
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        mostrarNotificacion('Error al cargar historial: ' + error.message, 'error');
    }
}
// Cargar datos académicos del empleado
async function cargarDatosAcademicos() {
    try {
        if (!empleadoActual || !empleadoActual.IdPersonal) return;
        
        mostrarCargando(true, 'Cargando información académica...');
        
        // Cargar todos los catálogos necesarios
        await Promise.all([
            cargarEstadosEducacion(),
            cargarPlanesEstudio(),
            cargarSemestres(),
            cargarTrimestres(),
            cargarGradosAcademicos(),
            cargarUniversidades(),
            cargarCarrerasUniversitarias(),
            cargarMaestrias()
        ]);
        
        // Verificar si ya existe información académica para el empleado
        const connection = await connectionString();
        const queryVerificar = `
            SELECT IdEstudio
            FROM InfoAcademica
            WHERE IdPersonal = ?
        `;
        
        let resultVerificar = await connection.query(queryVerificar, [empleadoActual.IdPersonal]);
        
        let datosAcademicos = null;
        
        if (resultVerificar.length === 0) {
            // No existe información académica, crear registro vacío
            const queryInsertar = `
                INSERT INTO InfoAcademica (IdPersonal)
                VALUES (?)
            `;
            
            await connection.query(queryInsertar, [empleadoActual.IdPersonal]);
            
            // Obtener el ID del nuevo registro
            resultVerificar = await connection.query(queryVerificar, [empleadoActual.IdPersonal]);
            infoAcademicaId = resultVerificar[0].IdEstudio;
            
            // Inicializar datos académicos vacíos
            datosAcademicos = {
                EstadoPrimaria: null,
                IdPlanEstudioPrimaria: null,
                IdNivelAcademicoPrimaria: null,
                EstadoBasico: null,
                IdPlanEstudioBasico: null,
                IdNivelAcademicoBasico: null,
                EstadoDiversificado: null,
                IdPlanEstudioDiversificado: null,
                IdNivelAcademicoDiversificado: null,
                IdCarreraDiversificado: null,
                EstadoUniversidad: null,
                IdPlanEstudioUniversitario: null,
                IdNivelAcademicoUnivesitario: null,
                IdUniversidad: null,
                IdCarreraUniversitaria: null,
                EstadoMaestria: null,
                IdPlanEstudio: null,
                IdNivelAcademicoMaestria: null,
                IdUniversidadMaestria: null,
                IdMaestria: null
            };
        } else {
            // Ya existe información académica, obtener datos
            infoAcademicaId = resultVerificar[0].IdEstudio;
            
            const queryDatos = `
                SELECT 
                    EstadoPrimaria,
                    IdPlanEstudioPrimaria,
                    IdNivelAcademicoPrimaria,
                    EstadoBasico,
                    IdPlanEstudioBasico,
                    IdNivelAcademicoBasico,
                    EstadoDiversificado,
                    IdPlanEstudioDiversificado,
                    IdNivelAcademicoDiversificado,
                    IdCarreraDiversificado,
                    EstadoUniversidad,
                    IdPlanEstudioUniversitario,
                    IdNivelAcademicoUnivesitario,
                    IdUniversidad,
                    IdCarreraUniversitaria,
                    EstadoMaestria,
                    IdPlanEstudio,
                    IdNivelAcademicoMaestria,
                    IdUniversidadMaestria,
                    IdMaestria
                FROM 
                    InfoAcademica
                WHERE 
                    IdEstudio = ?
            `;
            
            const result = await connection.query(queryDatos, [infoAcademicaId]);
            datosAcademicos = result[0];
        }
        
        await connection.close();
        
        // Guardar datos originales
        datosOriginalesAcademicos = {
            estadoPrimaria: datosAcademicos.EstadoPrimaria || '',
            planEstudioPrimaria: datosAcademicos.IdPlanEstudioPrimaria || '',
            nivelAcademicoPrimaria: datosAcademicos.IdNivelAcademicoPrimaria || '',
            estadoBasico: datosAcademicos.EstadoBasico || '',
            planEstudioBasico: datosAcademicos.IdPlanEstudioBasico || '',
            nivelAcademicoBasico: datosAcademicos.IdNivelAcademicoBasico || '',
            estadoDiversificado: datosAcademicos.EstadoDiversificado || '',
            planEstudioDiversificado: datosAcademicos.IdPlanEstudioDiversificado || '',
            nivelAcademicoDiversificado: datosAcademicos.IdNivelAcademicoDiversificado || '',
            carreraDiversificado: datosAcademicos.IdCarreraDiversificado || '',
            estadoUniversidad: datosAcademicos.EstadoUniversidad || '',
            planEstudioUniversitario: datosAcademicos.IdPlanEstudioUniversitario || '',
            nivelAcademicoUnivesitario: datosAcademicos.IdNivelAcademicoUnivesitario || '',
            universidad: datosAcademicos.IdUniversidad || '',
            carreraUniversitaria: datosAcademicos.IdCarreraUniversitaria || '',
            estadoMaestria: datosAcademicos.EstadoMaestria || '',
            planEstudio: datosAcademicos.IdPlanEstudio || '',
            nivelAcademicoMaestria: datosAcademicos.IdNivelAcademicoMaestria || '',
            universidadMaestria: datosAcademicos.IdUniversidadMaestria || '',
            maestria: datosAcademicos.IdMaestria || ''
        };
        
        // Asignar valores a los campos
        estadoPrimaria.value = datosOriginalesAcademicos.estadoPrimaria;
        planEstudioPrimaria.value = datosOriginalesAcademicos.planEstudioPrimaria;
        nivelAcademicoPrimaria.value = datosOriginalesAcademicos.nivelAcademicoPrimaria;
        estadoBasico.value = datosOriginalesAcademicos.estadoBasico;
        planEstudioBasico.value = datosOriginalesAcademicos.planEstudioBasico;
        nivelAcademicoBasico.value = datosOriginalesAcademicos.nivelAcademicoBasico;
        estadoDiversificado.value = datosOriginalesAcademicos.estadoDiversificado;
        planEstudioDiversificado.value = datosOriginalesAcademicos.planEstudioDiversificado;
        nivelAcademicoDiversificado.value = datosOriginalesAcademicos.nivelAcademicoDiversificado;
        carreraDiversificado.value = datosOriginalesAcademicos.carreraDiversificado;
        estadoUniversidad.value = datosOriginalesAcademicos.estadoUniversidad;
        planEstudioUniversitario.value = datosOriginalesAcademicos.planEstudioUniversitario;
        nivelAcademicoUnivesitario.value = datosOriginalesAcademicos.nivelAcademicoUnivesitario;
        universidad.value = datosOriginalesAcademicos.universidad;
        carreraUniversitaria.value = datosOriginalesAcademicos.carreraUniversitaria;
        estadoMaestria.value = datosOriginalesAcademicos.estadoMaestria;
        planEstudio.value = datosOriginalesAcademicos.planEstudio;
        nivelAcademicoMaestria.value = datosOriginalesAcademicos.nivelAcademicoMaestria;
        universidadMaestria.value = datosOriginalesAcademicos.universidadMaestria;
        maestria.value = datosOriginalesAcademicos.maestria;
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar datos académicos:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar datos académicos: ' + error.message, 'error');
    }
}
function inicializarEventosDocumentos() {
    // Eventos para campo de texto
    nit.addEventListener('input', function() {
        verificarCambioEnCampoDocumentos('nit');
    });
    
    // Eventos para el select
    idLicencia.addEventListener('change', function() {
        verificarCambioEnCampoDocumentos('idLicencia');
    });
    
    // Eventos para campos de fecha
    fechaVencimientoTS.addEventListener('change', function() {
        verificarCambioEnCampoDocumentos('fechaVencimientoTS');
    });
    
    fechaVencimientoTM.addEventListener('change', function() {
        verificarCambioEnCampoDocumentos('fechaVencimientoTM');
    });
    
    // Botones
    btnSaveDocuments.addEventListener('click', guardarCambiosDocumentos);
    btnCancelDocuments.addEventListener('click', cancelarCambiosDocumentos);
    btnHistoryDocuments.addEventListener('click', function() {
        mostrarHistorialCambiosDocumentos();
    });
    
    // Eventos de navegación
    document.querySelector('.progress-step[data-section="documents"]').addEventListener('click', function() {
        mostrarSeccion('documents');
    });
    
    // Dar formato al NIT
    nit.addEventListener('blur', function() {
        formatearNIT(this);
    });
}

// Función para formatear el NIT
function formatearNIT(input) {
    let nit = input.value.replace(/[^\dK-]/g, ''); // Solo permitir números, K y guion
    
    if (nit) {
        // Si termina en K, mantenerla al final
        const terminaEnK = nit.toUpperCase().endsWith('K');
        if (terminaEnK) {
            nit = nit.slice(0, -1).replace(/\D/g, '') + 'K';
        } else {
            nit = nit.replace(/\D/g, '');
        }
        
        // Asegurarse de que haya al menos un dígito antes de la K
        if (terminaEnK && nit.length === 1) {
            nit = '';
        }
        
        input.value = nit;
    }
}

// Cargar tipos de licencia
async function cargarTiposLicencia() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT IdLicencia, TipoLicencia
            FROM tipolicencias
            ORDER BY IdLicencia
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Limpiar opciones actuales
        idLicencia.innerHTML = '<option value="">No tiene licencia</option>';
        
        // Agregar opciones al select
        result.forEach(item => {
            const option = document.createElement('option');
            option.value = item.IdLicencia;
            option.textContent = item.TipoLicencia;
            idLicencia.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar tipos de licencia:', error);
        mostrarNotificacion('Error al cargar tipos de licencia', 'error');
        throw error;
    }
}

// Cargar datos de documentación del empleado
async function cargarDatosDocumentos() {
    try {
        if (!empleadoActual || !empleadoActual.IdPersonal) return;
        
        mostrarCargando(true, 'Cargando datos de documentación...');
        
        // Cargar catálogos
        await cargarTiposLicencia();
        
        // Obtener datos actuales de documentación
        const connection = await connectionString();
        const query = `
            SELECT 
                personal.IdLicencia,
                personal.NIT,
                personal.FechaVencimientoTS,
                personal.FechaVencimientoTM
            FROM
                personal 
            WHERE 
                personal.IdPersonal = ?
        `;
        
        const result = await connection.query(query, [empleadoActual.IdPersonal]);
        await connection.close();
        
        if (result.length === 0) {
            throw new Error('No se encontraron datos de documentación');
        }
        
        const datosDocumentos = result[0];
        
        // Función auxiliar para formatear fechas de manera segura
        const formatearFecha = (fecha) => {
            if (!fecha) return '';
            try {
                // Intentar convertir a fecha
                const fechaObj = new Date(fecha);
                // Verificar si es una fecha válida
                if (isNaN(fechaObj.getTime())) return '';
                // Formato YYYY-MM-DD para input type="date"
                return fechaObj.toISOString().split('T')[0];
            } catch (error) {
                console.warn('Error al formatear fecha:', fecha, error);
                return '';
            }
        };
        
        // Guardar datos originales
        datosOriginalesDocumentos = {
            idLicencia: datosDocumentos.IdLicencia || '',
            nit: datosDocumentos.NIT || '',
            fechaVencimientoTS: formatearFecha(datosDocumentos.FechaVencimientoTS),
            fechaVencimientoTM: formatearFecha(datosDocumentos.FechaVencimientoTM)
        };
        
        // Asignar valores a los campos
        idLicencia.value = datosOriginalesDocumentos.idLicencia;
        nit.value = datosOriginalesDocumentos.nit;
        fechaVencimientoTS.value = datosOriginalesDocumentos.fechaVencimientoTS;
        fechaVencimientoTM.value = datosOriginalesDocumentos.fechaVencimientoTM;
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar datos de documentación:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar datos de documentación: ' + error.message, 'error');
    }
}

// Verificar cambio en un campo de documentación
function verificarCambioEnCampoDocumentos(idCampo) {
    const campo = document.getElementById(idCampo);
    const valorOriginal = datosOriginalesDocumentos[idCampo];
    const valorActual = campo.value;
    
    // Comparar valores
    const hayModificados = valorOriginal !== valorActual;
    
    // Si hay cambios, mostrar indicador y agregar a lista de modificados
    if (hayModificados) {
        campo.classList.add('modified');
        indicadoresDocumentos[idCampo].style.opacity = '1';
        camposModificadosDocumentos[idCampo] = true;
    } else {
        campo.classList.remove('modified');
        indicadoresDocumentos[idCampo].style.opacity = '0';
        delete camposModificadosDocumentos[idCampo];
    }
    
    // Habilitar o deshabilitar botón guardar
    btnSaveDocuments.disabled = Object.keys(camposModificadosDocumentos).length === 0;
}

// Guardar cambios en documentación
async function guardarCambiosDocumentos() {
    try {
        // Verificar si hay cambios
        if (Object.keys(camposModificadosDocumentos).length === 0) {
            mostrarNotificacion('No hay cambios para guardar', 'info');
            return;
        }
        
        // Evitar múltiples envíos
        btnSaveDocuments.innerHTML = '<span class="loading-spinner"></span> Guardando...';
        btnSaveDocuments.disabled = true;
        
        // Preparar datos para actualizar
        const datosActualizados = {
            IdLicencia: idLicencia.value || null,
            NIT: nit.value.trim() || null,
            FechaVencimientoTS: fechaVencimientoTS.value || null,
            FechaVencimientoTM: fechaVencimientoTM.value || null
        };
        
        // Formar el nombre completo
        const nombreCompleto = [
            empleadoActual.PrimerNombre,
            empleadoActual.SegundoNombre,
            empleadoActual.TercerNombre,
            empleadoActual.PrimerApellido,
            empleadoActual.SegundoApellido
        ].filter(Boolean).join(' ');
        
        // Conectar a la base de datos
        const connection = await connectionString();

        // Obtener nombres para el historial
        const nombresOriginales = {};
        const nombresActualizados = {};
        
        // Obtener nombre del tipo de licencia
        if (datosOriginalesDocumentos.idLicencia) {
            const licenciaQuery = `
                SELECT TipoLicencia FROM tipolicencias 
                WHERE IdLicencia = ?
            `;
            const licenciaResult = await connection.query(licenciaQuery, [datosOriginalesDocumentos.idLicencia]);
            nombresOriginales.idLicencia = licenciaResult.length > 0 ? 
                licenciaResult[0].TipoLicencia : 'No registrado';
        } else {
            nombresOriginales.idLicencia = 'No tiene licencia';
        }
        
        if (datosActualizados.IdLicencia) {
            const licenciaQuery = `
                SELECT TipoLicencia FROM tipolicencias 
                WHERE IdLicencia = ?
            `;
            const licenciaResult = await connection.query(licenciaQuery, [datosActualizados.IdLicencia]);
            nombresActualizados.idLicencia = licenciaResult.length > 0 ? 
                licenciaResult[0].TipoLicencia : 'No registrado';
        } else {
            nombresActualizados.idLicencia = 'No tiene licencia';
        }
        
        // Iniciar transacción
        await connection.beginTransaction();
        
        try {
            // 1. Actualizar tabla personal
            let updateQuery = `
                UPDATE personal SET
                    IdLicencia = ?,
                    NIT = ?,
                    FechaVencimientoTS = ?,
                    FechaVencimientoTM = ?
                WHERE IdPersonal = ?
            `;
            
            await connection.query(updateQuery, [
                datosActualizados.IdLicencia,
                datosActualizados.NIT,
                datosActualizados.FechaVencimientoTS,
                datosActualizados.FechaVencimientoTM,
                empleadoActual.IdPersonal
            ]);
            
            // 2. Registrar cambios en historial
            for (const campo in camposModificadosDocumentos) {
                let nombreCampo, valorAnterior, valorNuevo, tipoCambio = 6; // TipoCambio 5 = Documentación
                
                // Mapear el ID del campo a un nombre más amigable
                switch(campo) {
                    case 'idLicencia':
                        nombreCampo = 'Tipo de Licencia';
                        valorAnterior = nombresOriginales.idLicencia;
                        valorNuevo = nombresActualizados.idLicencia;
                        break;
                    case 'nit':
                        nombreCampo = 'NIT';
                        valorAnterior = datosOriginalesDocumentos.nit || 'No registrado';
                        valorNuevo = datosActualizados.NIT || 'No registrado';
                        break;
                    case 'fechaVencimientoTS':
                        nombreCampo = 'Fecha Vencimiento TS';
                        valorAnterior = datosOriginalesDocumentos.fechaVencimientoTS || 'No registrado';
                        valorNuevo = datosActualizados.FechaVencimientoTS || 'No registrado';
                        break;
                    case 'fechaVencimientoTM':
                        nombreCampo = 'Fecha Vencimiento TM';
                        valorAnterior = datosOriginalesDocumentos.fechaVencimientoTM || 'No registrado';
                        valorNuevo = datosActualizados.FechaVencimientoTM || 'No registrado';
                        break;
                }
                
                // Insertar en historial
                const historialQuery = `
                    INSERT INTO CambiosPersonal 
                    (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                await connection.query(historialQuery, [
                    empleadoActual.IdPersonal,
                    nombreCompleto,
                    tipoCambio,
                    nombreCampo,
                    valorAnterior,
                    valorNuevo,
                    userData.IdPersonal,
                    userData.NombreCompleto
                ]);
            }
            
            // Confirmar transacción
            await connection.commit();
            
            // Actualizar datos originales
            datosOriginalesDocumentos = {
                idLicencia: datosActualizados.IdLicencia || '',
                nit: datosActualizados.NIT || '',
                fechaVencimientoTS: datosActualizados.FechaVencimientoTS || '',
                fechaVencimientoTM: datosActualizados.FechaVencimientoTM || ''
            };
            
            // Mostrar mensaje de éxito
            mostrarMensajeSistema(successMessage, 'Información de documentación actualizada correctamente');
            mostrarNotificacion('Documentación actualizada correctamente', 'success');
            
            // Limpiar lista de campos modificados
            Object.keys(camposModificadosDocumentos).forEach(campo => {
                const element = document.getElementById(campo);
                element.classList.remove('modified');
                element.classList.remove('invalid');
                element.classList.add('saved');
                indicadoresDocumentos[campo].style.opacity = '0';
                
                // Quitar clase saved después de un tiempo
                setTimeout(() => {
                    element.classList.remove('saved');
                }, 3000);
            });
            
            camposModificadosDocumentos = {};
            
        } catch (error) {
            // Revertir transacción en caso de error
            await connection.rollback();
            throw error;
        } finally {
            // Cerrar conexión
            await connection.close();
            
            // Restaurar botón guardar
            btnSaveDocuments.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            btnSaveDocuments.disabled = true;
        }
        
    } catch (error) {
        console.error('Error al guardar documentación:', error);
        mostrarNotificacion('Error al guardar: ' + error.message, 'error');
        
        // Restaurar botón guardar
        btnSaveDocuments.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        btnSaveDocuments.disabled = false;
    }
}

// Cancelar cambios de documentación
function cancelarCambiosDocumentos() {
    // Preguntar si hay cambios sin guardar
    if (Object.keys(camposModificadosDocumentos).length > 0) {
        if (!confirm('¿Está seguro que desea cancelar los cambios?')) {
            return;
        }
    }
    
    // Restaurar valores originales
    idLicencia.value = datosOriginalesDocumentos.idLicencia;
    nit.value = datosOriginalesDocumentos.nit;
    fechaVencimientoTS.value = datosOriginalesDocumentos.fechaVencimientoTS;
    fechaVencimientoTM.value = datosOriginalesDocumentos.fechaVencimientoTM;
    
    // Limpiar indicadores y estilos
    Object.keys(indicadoresDocumentos).forEach(campo => {
        indicadoresDocumentos[campo].style.opacity = '0';
        const element = document.getElementById(campo);
        element.classList.remove('modified');
        element.classList.remove('invalid');
    });
    
    // Limpiar lista de campos modificados
    camposModificadosDocumentos = {};
    
    // Deshabilitar botón guardar
    btnSaveDocuments.disabled = true;
    
    mostrarNotificacion('Cambios cancelados', 'info');
}

// Mostrar historial de cambios de documentación
async function mostrarHistorialCambiosDocumentos() {
    // Mostrar modal
    historyModal.classList.add('show');
    
    // Establecer fechas por defecto (último mes)
    const hoy = new Date();
    const haceMes = new Date();
    haceMes.setMonth(haceMes.getMonth() - 1);
    
    historyDateTo.value = hoy.toISOString().split('T')[0];
    historyDateFrom.value = haceMes.toISOString().split('T')[0];
    
    // Cargar historial
    await cargarHistorialCambiosDocumentos();
}

// Cargar historial de cambios de documentación
async function cargarHistorialCambiosDocumentos() {
    try {
        // Validar datos
        if (!empleadoActual || !empleadoActual.IdPersonal) {
            throw new Error('No se ha cargado un empleado');
        }
        
        // Obtener fechas de filtro
        const fechaDesde = historyDateFrom.value || '1900-01-01';
        const fechaHasta = historyDateTo.value || new Date().toISOString().split('T')[0];
        
        // Obtener historial de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT 
                IdPersonal,
                NombrePersonal,
                TipoCambio,
                Cambio,
                ValorAnterior,
                ValorNuevo,
                IdUsuario,
                NombreUsuario,
                FechaCambio,
                FechaHoraCambio
            FROM 
                CambiosPersonal
            WHERE 
                IdPersonal = ? 
                AND TipoCambio = 6
                AND DATE(FechaCambio) BETWEEN ? AND ?
            ORDER BY 
                FechaHoraCambio DESC
        `;
        
        const result = await connection.query(query, [
            empleadoActual.IdPersonal,
            fechaDesde,
            fechaHasta
        ]);
        await connection.close();
        
        // Mostrar resultados
        mostrarResultadosHistorial(result);
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        mostrarNotificacion('Error al cargar historial: ' + error.message, 'error');
    }
}
function inicializarEventosPMA() {
    // Evento para mostrar el formulario de nueva evaluación
    btnAddPMA.addEventListener('click', function() {
        mostrarFormularioPMA();
    });
    
    // Evento para guardar evaluación
    btnSavePMA.addEventListener('click', guardarEvaluacionPMA);
    
    // Evento para cancelar formulario
    btnCancelPMA.addEventListener('click', function() {
        ocultarFormularioPMA();
    });
    
    // Evento para ver historial
    btnHistoryPMA.addEventListener('click', function() {
        mostrarHistorialCambiosPMA();
    });
    
    // Evento para volver a la lista desde el detalle
    btnBackToPMAList.addEventListener('click', function() {
        ocultarDetallePMA();
    });
    
    // Eventos de navegación
    document.querySelector('.progress-step[data-section="pma"]').addEventListener('click', function() {
        mostrarSeccion('pma');
    });
    
    // Campos numéricos: validar rango y formatear
    [factorV, factorE, factorR, factorN, factorF].forEach(campo => {
        campo.addEventListener('input', function() {
            // Limitar a valores entre 0 y 100
            if (this.value > 100) this.value = 100;
            if (this.value < 0) this.value = 0;
        });
    });
    
    // Inicializar fecha de evaluación con la fecha actual
    const today = new Date().toISOString().split('T')[0];
    fechaEvaluacionPMA.value = today;
    fechaEvaluacionPMA.setAttribute('max', today);
}

// Cargar resultados PMA del empleado
async function cargarResultadosPMA() {
    try {
        if (!empleadoActual || !empleadoActual.IdPersonal) return;
        
        mostrarCargando(true, 'Cargando evaluaciones PMA...');
        
        // Obtener resultados PMA
        const connection = await connectionString();
        const query = `
            SELECT
                ResultadosPMA.IdPMA,
                ResultadosPMA.FactorV, 
                ResultadosPMA.FactorE, 
                ResultadosPMA.FactorR, 
                ResultadosPMA.FactorN, 
                ResultadosPMA.FactorF, 
                ResultadosPMA.FechaEvaluacion,
                ResultadosPMA.IdUsuarioEvaluo,
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', 
                IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', 
                IFNULL(personal.SegundoApellido, '')) AS NombreEvaluador
            FROM
                ResultadosPMA
                LEFT JOIN personal ON ResultadosPMA.IdUsuarioEvaluo = personal.IdPersonal
            WHERE
                ResultadosPMA.IdPersonal = ?
            ORDER BY
                ResultadosPMA.FechaEvaluacion DESC
        `;
        
        const result = await connection.query(query, [empleadoActual.IdPersonal]);
        await connection.close();
        
        // Mostrar resultados
        renderizarResultadosPMA(result);
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar resultados PMA:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar evaluaciones PMA: ' + error.message, 'error');
    }
}

// Renderizar resultados PMA en la tabla
function renderizarResultadosPMA(resultados) {
    // Verificar si hay resultados
    if (!resultados || resultados.length === 0) {
        pmaResultsTableBody.innerHTML = '';
        noPMAResults.style.display = 'flex';
        return;
    }
    
    // Ocultar mensaje de no resultados
    noPMAResults.style.display = 'none';
    
    // Generar filas de la tabla
    let html = '';
    
    resultados.forEach(resultado => {
        // Calcular promedio
        const factores = [
            resultado.FactorV, 
            resultado.FactorE, 
            resultado.FactorR, 
            resultado.FactorN, 
            resultado.FactorF
        ].filter(f => f !== null).map(f => parseFloat(f));
        
        const promedio = factores.length > 0 ? 
            (factores.reduce((a, b) => a + b, 0) / factores.length).toFixed(1) : '-';
        
        // Formatear fecha
        const fecha = resultado.FechaEvaluacion ? 
            new Date(resultado.FechaEvaluacion).toLocaleDateString() : 'No registrada';
        
        html += `
            <tr data-pma-id="${resultado.IdPMA}">
                <td>${fecha}</td>
                <td>${resultado.FactorV !== null ? resultado.FactorV : '-'}</td>
                <td>${resultado.FactorE !== null ? resultado.FactorE : '-'}</td>
                <td>${resultado.FactorR !== null ? resultado.FactorR : '-'}</td>
                <td>${resultado.FactorN !== null ? resultado.FactorN : '-'}</td>
                <td>${resultado.FactorF !== null ? resultado.FactorF : '-'}</td>
                <td><strong>${promedio}</strong></td>
                <td>${resultado.NombreEvaluador || 'No registrado'}</td>
                <td>
                    <div class="table-actions">
                        <button class="table-btn view-btn" title="Ver detalle" onclick="verDetallePMA(${resultado.IdPMA})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="table-btn edit-btn" title="Editar evaluación" onclick="editarPMA(${resultado.IdPMA})">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    // Actualizar la tabla
    pmaResultsTableBody.innerHTML = html;
}

// Mostrar formulario para agregar/editar evaluación PMA
function mostrarFormularioPMA() {
    // Ocultar otras vistas
    pmaResultsContainer.style.display = 'none';
    pmaDetailView.style.display = 'none';
    
    // Configurar formulario para nueva evaluación
    pmaFormTitle.textContent = 'Nueva Evaluación PMA';
    
    // Limpiar campos
    factorV.value = '';
    factorE.value = '';
    factorR.value = '';
    factorN.value = '';
    factorF.value = '';
    
    // Inicializar fecha de evaluación con la fecha actual
    const today = new Date().toISOString().split('T')[0];
    fechaEvaluacionPMA.value = today;
    
    // Mostrar formulario
    pmaForm.style.display = 'block';
    isEditingPMA = false;
    currentPMAId = null;
}

// Ocultar formulario PMA
function ocultarFormularioPMA() {
    pmaForm.style.display = 'none';
    pmaResultsContainer.style.display = 'block';
}

// Editar evaluación PMA existente
async function editarPMA(idPMA) {
    try {
        mostrarCargando(true, 'Cargando datos de evaluación...');
        
        // Obtener datos de la evaluación
        const connection = await connectionString();
        const query = `
            SELECT
                ResultadosPMA.IdPMA,
                ResultadosPMA.FactorV, 
                ResultadosPMA.FactorE, 
                ResultadosPMA.FactorR, 
                ResultadosPMA.FactorN, 
                ResultadosPMA.FactorF, 
                ResultadosPMA.FechaEvaluacion
            FROM
                ResultadosPMA
            WHERE
                ResultadosPMA.IdPMA = ?
        `;
        
        const result = await connection.query(query, [idPMA]);
        await connection.close();
        
        if (result.length === 0) {
            throw new Error('No se encontró la evaluación PMA');
        }
        
        const evaluacion = result[0];
        
        // Configurar formulario para edición
        pmaFormTitle.textContent = 'Editar Evaluación PMA';
        
        // Asignar valores a los campos
        factorV.value = evaluacion.FactorV !== null ? evaluacion.FactorV : '';
        factorE.value = evaluacion.FactorE !== null ? evaluacion.FactorE : '';
        factorR.value = evaluacion.FactorR !== null ? evaluacion.FactorR : '';
        factorN.value = evaluacion.FactorN !== null ? evaluacion.FactorN : '';
        factorF.value = evaluacion.FactorF !== null ? evaluacion.FactorF : '';
        
        // Formatear fecha
        const fecha = evaluacion.FechaEvaluacion ? 
            new Date(evaluacion.FechaEvaluacion).toISOString().split('T')[0] : '';
        fechaEvaluacionPMA.value = fecha;
        
        // Ocultar otras vistas
        pmaResultsContainer.style.display = 'none';
        pmaDetailView.style.display = 'none';
        
        // Mostrar formulario
        pmaForm.style.display = 'block';
        isEditingPMA = true;
        currentPMAId = idPMA;
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar evaluación para editar:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar evaluación: ' + error.message, 'error');
    }
}

// Guardar evaluación PMA
async function guardarEvaluacionPMA() {
    try {
        // Validar campos requeridos
        if (!fechaEvaluacionPMA.value || 
            !factorV.value || 
            !factorE.value || 
            !factorR.value || 
            !factorN.value || 
            !factorF.value) {
            mostrarNotificacion('Por favor complete todos los campos obligatorios', 'warning');
            return;
        }
        
        // Evitar múltiples envíos
        btnSavePMA.innerHTML = '<span class="loading-spinner"></span> Guardando...';
        btnSavePMA.disabled = true;
        
        // Preparar datos para guardar
        const datosEvaluacion = {
            IdPersonal: empleadoActual.IdPersonal,
            FactorV: parseInt(factorV.value),
            FactorE: parseInt(factorE.value),
            FactorR: parseInt(factorR.value),
            FactorN: parseInt(factorN.value),
            FactorF: parseInt(factorF.value),
            FechaEvaluacion: fechaEvaluacionPMA.value,
            IdUsuarioEvaluo: userData.IdPersonal
        };
        
        // Conectar a la base de datos
        const connection = await connectionString();

        // Si estamos editando, obtener los valores originales para guardar el historial
        let datosOriginalesPMA = null;
        
        if (isEditingPMA) {
            const queryOriginal = `
                SELECT 
                    FactorV, FactorE, FactorR, FactorN, FactorF, FechaEvaluacion
                FROM 
                    ResultadosPMA 
                WHERE 
                    IdPMA = ?
            `;
            const resultOriginal = await connection.query(queryOriginal, [currentPMAId]);
            
            if (resultOriginal.length > 0) {
                datosOriginalesPMA = resultOriginal[0];
            }
        }
        
        // Iniciar transacción
        await connection.beginTransaction();
        
        try {
            let query, params;
            
            if (isEditingPMA) {
                // Actualizar evaluación existente
                query = `
                    UPDATE ResultadosPMA SET
                        FactorV = ?,
                        FactorE = ?,
                        FactorR = ?,
                        FactorN = ?,
                        FactorF = ?,
                        FechaEvaluacion = ?
                    WHERE IdPMA = ?
                `;
                
                params = [
                    datosEvaluacion.FactorV,
                    datosEvaluacion.FactorE,
                    datosEvaluacion.FactorR,
                    datosEvaluacion.FactorN,
                    datosEvaluacion.FactorF,
                    datosEvaluacion.FechaEvaluacion,
                    currentPMAId
                ];
                
                // Guardar en historial si estamos editando
                if (datosOriginalesPMA) {
                    // Formar el nombre completo
                    const nombreCompleto = [
                        empleadoActual.PrimerNombre,
                        empleadoActual.SegundoNombre,
                        empleadoActual.TercerNombre,
                        empleadoActual.PrimerApellido,
                        empleadoActual.SegundoApellido
                    ].filter(Boolean).join(' ');
                    
                    // Verificar cambios y guardar en historial
                    const campos = [
                        { nombre: 'Factor V', original: datosOriginalesPMA.FactorV, nuevo: datosEvaluacion.FactorV },
                        { nombre: 'Factor E', original: datosOriginalesPMA.FactorE, nuevo: datosEvaluacion.FactorE },
                        { nombre: 'Factor R', original: datosOriginalesPMA.FactorR, nuevo: datosEvaluacion.FactorR },
                        { nombre: 'Factor N', original: datosOriginalesPMA.FactorN, nuevo: datosEvaluacion.FactorN },
                        { nombre: 'Factor F', original: datosOriginalesPMA.FactorF, nuevo: datosEvaluacion.FactorF },
                        { 
                            nombre: 'Fecha de Evaluación', 
                            original: datosOriginalesPMA.FechaEvaluacion ? 
                                new Date(datosOriginalesPMA.FechaEvaluacion).toISOString().split('T')[0] : null, 
                            nuevo: datosEvaluacion.FechaEvaluacion 
                        }
                    ];
                    
                    // Historial de cambios
                    const historialQuery = `
                        INSERT INTO CambiosPersonal 
                        (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    // Verificar cada campo y guardar historial si hay cambios
                    for (const campo of campos) {
                        if (String(campo.original) !== String(campo.nuevo)) {
                            await connection.query(historialQuery, [
                                empleadoActual.IdPersonal,
                                nombreCompleto,
                                7, // TipoCambio 6 = Evaluación PMA
                                campo.nombre,
                                campo.original !== null ? String(campo.original) : 'No registrado',
                                campo.nuevo !== null ? String(campo.nuevo) : 'No registrado',
                                userData.IdPersonal,
                                userData.NombreCompleto
                            ]);
                        }
                    }
                }
            } else {
                // Insertar nueva evaluación
                query = `
                    INSERT INTO ResultadosPMA
                    (IdPersonal, FactorV, FactorE, FactorR, FactorN, FactorF, FechaEvaluacion, IdUsuarioEvaluo)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                params = [
                    datosEvaluacion.IdPersonal,
                    datosEvaluacion.FactorV,
                    datosEvaluacion.FactorE,
                    datosEvaluacion.FactorR,
                    datosEvaluacion.FactorN,
                    datosEvaluacion.FactorF,
                    datosEvaluacion.FechaEvaluacion,
                    datosEvaluacion.IdUsuarioEvaluo
                ];
            }
            
            await connection.query(query, params);
            
            // Confirmar transacción
            await connection.commit();
            
            // Mostrar mensaje de éxito
            mostrarNotificacion(
                isEditingPMA ? 'Evaluación PMA actualizada correctamente' : 'Nueva evaluación PMA registrada correctamente', 
                'success'
            );
            
            // Recargar resultados
            await cargarResultadosPMA();
            
            // Ocultar formulario
            ocultarFormularioPMA();
            
        } catch (error) {
            // Revertir transacción en caso de error
            await connection.rollback();
            throw error;
        } finally {
            // Cerrar conexión
            await connection.close();
            
            // Restaurar botón guardar
            btnSavePMA.innerHTML = '<i class="fas fa-save"></i> Guardar Evaluación';
            btnSavePMA.disabled = false;
        }
        
    } catch (error) {
        console.error('Error al guardar evaluación PMA:', error);
        mostrarNotificacion('Error al guardar: ' + error.message, 'error');
        
        // Restaurar botón guardar
        btnSavePMA.innerHTML = '<i class="fas fa-save"></i> Guardar Evaluación';
        btnSavePMA.disabled = false;
    }
}
async function verDetallePMA(idPMA) {
    try {
        mostrarCargando(true, 'Cargando detalles de evaluación...');
        
        // Obtener datos de la evaluación
        const connection = await connectionString();
        const query = `
            SELECT
                ResultadosPMA.IdPMA,
                ResultadosPMA.FactorV, 
                ResultadosPMA.FactorE, 
                ResultadosPMA.FactorR, 
                ResultadosPMA.FactorN, 
                ResultadosPMA.FactorF, 
                ResultadosPMA.FechaEvaluacion,
                ResultadosPMA.IdUsuarioEvaluo,
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', 
                IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', 
                IFNULL(personal.SegundoApellido, '')) AS NombreEvaluador
            FROM
                ResultadosPMA
                LEFT JOIN personal ON ResultadosPMA.IdUsuarioEvaluo = personal.IdPersonal
            WHERE
                ResultadosPMA.IdPMA = ?
        `;
        
        const result = await connection.query(query, [idPMA]);
        await connection.close();
        
        if (result.length === 0) {
            throw new Error('No se encontró la evaluación PMA');
        }
        
        const evaluacion = result[0];
        
        // Asignar valores a los elementos de detalle
        pmaDetailDate.textContent = evaluacion.FechaEvaluacion ? 
            new Date(evaluacion.FechaEvaluacion).toLocaleDateString() : 'No registrada';
        pmaDetailEvaluator.textContent = evaluacion.NombreEvaluador || 'No registrado';
        
        // Valores de factores
        pmaDetailV.textContent = evaluacion.FactorV !== null ? evaluacion.FactorV : '-';
        pmaDetailE.textContent = evaluacion.FactorE !== null ? evaluacion.FactorE : '-';
        pmaDetailR.textContent = evaluacion.FactorR !== null ? evaluacion.FactorR : '-';
        pmaDetailN.textContent = evaluacion.FactorN !== null ? evaluacion.FactorN : '-';
        pmaDetailF.textContent = evaluacion.FactorF !== null ? evaluacion.FactorF : '-';
        
        // Calcular promedio
        const factores = [
            evaluacion.FactorV, 
            evaluacion.FactorE, 
            evaluacion.FactorR, 
            evaluacion.FactorN, 
            evaluacion.FactorF
        ].filter(f => f !== null).map(f => parseFloat(f));
        
        const promedio = factores.length > 0 ? 
            (factores.reduce((a, b) => a + b, 0) / factores.length).toFixed(1) : '-';
        
        pmaDetailAvg.textContent = promedio;
        
        // Interpretaciones
        pmaDetailVinterp.textContent = interpretarPuntuacionPMA(evaluacion.FactorV);
        pmaDetailEinterp.textContent = interpretarPuntuacionPMA(evaluacion.FactorE);
        pmaDetailRinterp.textContent = interpretarPuntuacionPMA(evaluacion.FactorR);
        pmaDetailNinterp.textContent = interpretarPuntuacionPMA(evaluacion.FactorN);
        pmaDetailFinterp.textContent = interpretarPuntuacionPMA(evaluacion.FactorF);
        pmaDetailAvgInterp.textContent = interpretarPuntuacionPMA(promedio);
        
        // Crear gráfico de radar
        crearGraficoPMA(evaluacion);
        
        // Ocultar otras vistas
        pmaResultsContainer.style.display = 'none';
        pmaForm.style.display = 'none';
        
        // Mostrar vista de detalle
        pmaDetailView.style.display = 'block';
        currentPMAId = idPMA;
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar detalle de evaluación PMA:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar detalles: ' + error.message, 'error');
    }
}

// Ocultar detalle y volver a la lista
function ocultarDetallePMA() {
    // Destruir gráfico si existe
    if (pmaChartInstance) {
        pmaChartInstance.destroy();
        pmaChartInstance = null;
    }
    
    // Ocultar detalle
    pmaDetailView.style.display = 'none';
    
    // Mostrar lista
    pmaResultsContainer.style.display = 'block';
}

// Crear gráfico de radar para visualizar resultados PMA
function crearGraficoPMA(evaluacion) {
    // Destruir gráfico existente si hay uno
    if (pmaChartInstance) {
        pmaChartInstance.destroy();
    }
    
    // Obtener contexto del canvas
    const ctx = document.getElementById('pmaDetailChart').getContext('2d');
    
    // Convertir valores a números para el gráfico (usar 0 si no hay valor)
    const valoresGrafico = [
        evaluacion.FactorV !== null ? parseFloat(evaluacion.FactorV) : 0,
        evaluacion.FactorE !== null ? parseFloat(evaluacion.FactorE) : 0,
        evaluacion.FactorR !== null ? parseFloat(evaluacion.FactorR) : 0,
        evaluacion.FactorN !== null ? parseFloat(evaluacion.FactorN) : 0,
        evaluacion.FactorF !== null ? parseFloat(evaluacion.FactorF) : 0
    ];
    
    // Crear nuevo gráfico
    pmaChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Comprensión Verbal (V)', 'Concepción Espacial (E)', 'Razonamiento (R)', 'Cálculo Numérico (N)', 'Fluidez Verbal (F)'],
            datasets: [{
                label: 'Puntuación PMA',
                data: valoresGrafico,
                backgroundColor: 'rgba(255, 127, 39, 0.2)',
                borderColor: 'rgba(255, 127, 39, 0.8)',
                pointBackgroundColor: 'rgba(255, 127, 39, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(255, 127, 39, 1)',
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Perfil de Aptitudes Mentales',
                    color: '#2C3E50',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            return `Puntuación: ${value}`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    angleLines: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: {
                        stepSize: 20,
                        color: '#666',
                        backdropColor: 'transparent'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    pointLabels: {
                        font: {
                            size: 11
                        },
                        color: '#2C3E50'
                    }
                }
            }
        }
    });
}

// Función para interpretar puntuación PMA
function interpretarPuntuacionPMA(puntuacion) {
    if (puntuacion === null || puntuacion === undefined || puntuacion === '-') return 'No disponible';
    
    // Convertir a número si es string
    const valor = typeof puntuacion === 'string' ? parseFloat(puntuacion) : puntuacion;
    
    if (isNaN(valor)) return 'No disponible';
    
    // Escala ajustada para puntajes sobre 100
    if (valor >= 90) return 'Muy Superior';
    if (valor >= 80) return 'Superior';
    if (valor >= 70) return 'Medio-Alto';
    if (valor >= 60) return 'Medio';
    if (valor >= 50) return 'Medio-Bajo';
    if (valor >= 40) return 'Bajo';
    return 'Muy Bajo';
}

// Mostrar historial de cambios de PMA
async function mostrarHistorialCambiosPMA() {
    // Mostrar modal
    historyModal.classList.add('show');
    
    // Establecer fechas por defecto (último mes)
    const hoy = new Date();
    const haceMes = new Date();
    haceMes.setMonth(haceMes.getMonth() - 1);
    
    historyDateTo.value = hoy.toISOString().split('T')[0];
    historyDateFrom.value = haceMes.toISOString().split('T')[0];
    
    // Cargar historial
    await cargarHistorialCambiosPMA();
}

// Cargar historial de cambios de PMA
async function cargarHistorialCambiosPMA() {
    try {
        // Validar datos
        if (!empleadoActual || !empleadoActual.IdPersonal) {
            throw new Error('No se ha cargado un empleado');
        }
        
        // Obtener fechas de filtro
        const fechaDesde = historyDateFrom.value || '1900-01-01';
        const fechaHasta = historyDateTo.value || new Date().toISOString().split('T')[0];
        
        // Obtener historial de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT 
                IdPersonal,
                NombrePersonal,
                TipoCambio,
                Cambio,
                ValorAnterior,
                ValorNuevo,
                IdUsuario,
                NombreUsuario,
                FechaCambio,
                FechaHoraCambio
            FROM 
                CambiosPersonal
            WHERE 
                IdPersonal = ? 
                AND TipoCambio = 7
                AND DATE(FechaCambio) BETWEEN ? AND ?
            ORDER BY 
                FechaHoraCambio DESC
        `;
        
        const result = await connection.query(query, [
            empleadoActual.IdPersonal,
            fechaDesde,
            fechaHasta
        ]);
        await connection.close();
        
        // Mostrar resultados
        mostrarResultadosHistorial(result);
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        mostrarNotificacion('Error al cargar historial: ' + error.message, 'error');
    }
}

// Registrar en navegación global
window.verDetallePMA = verDetallePMA;
window.editarPMA = editarPMA;
// Función para mostrar/ocultar secciones
function mostrarSeccion(seccion) {
    // Ocultar todas las secciones
    document.querySelectorAll('.edit-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Desactivar todos los steps
    document.querySelectorAll('.progress-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Mostrar sección seleccionada
    const seccionElement = document.getElementById(`${seccion}-section`);
    if (seccionElement) {
        seccionElement.style.display = 'flex';
    }
    
    // Activar step correspondiente
    const stepElement = document.querySelector(`.progress-step[data-section="${seccion}"]`);
    if (stepElement) {
        stepElement.classList.add('active');
    }
    
    // Cargar datos específicos de la sección
    if (seccion === 'location' && !Object.keys(datosOriginalesUbicacion).length) {
        cargarDatosUbicacion();
    }
    
    // Cargar datos de contacto si es necesario
    if (seccion === 'contact' && !Object.keys(datosOriginalesContacto).length) {
        cargarDatosContacto();
    }
    
    // Cargar datos laborales si es necesario
    if (seccion === 'work' && !Object.keys(datosOriginalesLaboral).length) {
        cargarDatosLaborales();
    }
    
    // Cargar datos académicos si es necesario
    if (seccion === 'academic' && !Object.keys(datosOriginalesAcademicos).length) {
        cargarDatosAcademicos();
    }
    if (seccion === 'documents' && !Object.keys(datosOriginalesDocumentos).length) {
        cargarDatosDocumentos();
    }
    if (seccion === 'pma') {
        cargarResultadosPMA();
    }
}
function inicializarEventosFoto() {
    // Evento para mostrar el modal de cambio de foto
    changePhotoBtn.addEventListener('click', function() {
        mostrarModalFoto();
    });
    
    // Evento para seleccionar una nueva foto
    photoInput.addEventListener('change', function(event) {
        manejarSeleccionFoto(event);
    });
    
    // Evento de clic en el área de preview para abrir el selector de archivos
    newPhotoPreview.addEventListener('click', function() {
        photoInput.click();
    });
    
    // Eventos para cerrar el modal
    closePhotoModal.addEventListener('click', cerrarModalFoto);
    btnCancelPhoto.addEventListener('click', cerrarModalFoto);
    
    // Evento para guardar la nueva foto
    btnSavePhoto.addEventListener('click', guardarNuevaFoto);
    
    // Si hace clic fuera del modal, cerrar
    photoModal.addEventListener('click', function(event) {
        if (event.target === photoModal) {
            cerrarModalFoto();
        }
    });
}

// Mostrar el modal de cambio de foto
function mostrarModalFoto() {
    // Mostrar la foto actual del empleado
    currentPhoto.src = employeePhoto.src;
    
    // Restablecer la imagen de selección para nueva foto
    newPhoto.src = '../Imagenes/user-default.png';
    
    // Limpiar archivo seleccionado
    selectedFile = null;
    photoInput.value = '';
    
    // Deshabilitar botón guardar
    btnSavePhoto.disabled = true;
    
    // Mostrar modal
    photoModal.classList.add('show');
}

// Cerrar el modal de cambio de foto
function cerrarModalFoto() {
    photoModal.classList.remove('show');
}

// Manejar la selección de un archivo de imagen
function manejarSeleccionFoto(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    // Verificar tipo de archivo
    const tiposValidos = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!tiposValidos.includes(file.type)) {
        mostrarNotificacion('Formato de imagen no válido. Sólo se permiten formatos JPG y PNG.', 'warning');
        return;
    }
    
    // Verificar tamaño del archivo (máximo 2MB)
    const tamanoMaximo = 2 * 1024 * 1024; // 2MB en bytes
    if (file.size > tamanoMaximo) {
        mostrarNotificacion('La imagen es demasiado grande. El tamaño máximo es 2MB.', 'warning');
        return;
    }
    
    // Guardar el archivo seleccionado
    selectedFile = file;
    
    // Mostrar vista previa
    const reader = new FileReader();
    reader.onload = function(e) {
        newPhoto.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    // Habilitar botón guardar
    btnSavePhoto.disabled = false;
}

// Guardar la nueva foto
async function guardarNuevaFoto() {
    try {
        if (!selectedFile) {
            mostrarNotificacion('Por favor seleccione una imagen', 'warning');
            return;
        }
        
        // Mostrar indicador de carga
        btnSavePhoto.innerHTML = '<span class="loading-spinner"></span> Guardando...';
        btnSavePhoto.disabled = true;
        
        // Leer el archivo como array buffer
        const arrayBuffer = await readFileAsArrayBuffer(selectedFile);
        
        // Conectar a la base de datos
        const connection = await connectionString();
        
        // Verificar si ya existe una foto para este empleado
        const checkQuery = `
            SELECT IdPersonal FROM FotosPersonal 
            WHERE IdPersonal = ?
        `;
        
        const existingPhoto = await connection.query(checkQuery, [empleadoActual.IdPersonal]);
        
        let query, params;
        
        if (existingPhoto.length > 0) {
            // Actualizar foto existente
            query = `
                UPDATE FotosPersonal 
                SET Foto = ? 
                WHERE IdPersonal = ?
            `;
            params = [arrayBuffer, empleadoActual.IdPersonal];
        } else {
            // Insertar nueva foto
            query = `
                INSERT INTO FotosPersonal 
                (IdPersonal, Foto) 
                VALUES (?, ?)
            `;
            params = [empleadoActual.IdPersonal, arrayBuffer];
        }
        
        // Ejecutar la consulta
        await connection.query(query, params);
        await connection.close();
        
        // Actualizar la foto en la interfaz
        employeePhoto.src = newPhoto.src;
        
        // Cerrar modal
        cerrarModalFoto();
        
        // Mostrar notificación de éxito
        mostrarNotificacion('Foto actualizada correctamente', 'success');
        
    } catch (error) {
        console.error('Error al guardar foto:', error);
        mostrarNotificacion('Error al guardar la foto: ' + error.message, 'error');
        
        // Restaurar botón
        btnSavePhoto.innerHTML = '<i class="fas fa-save"></i> Guardar Foto';
        btnSavePhoto.disabled = false;
    } finally {
        // Restaurar botón en caso de éxito
        btnSavePhoto.innerHTML = '<i class="fas fa-save"></i> Guardar Foto';
    }
}

// Función para leer un archivo como ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            resolve(e.target.result);
        };
        reader.onerror = function(error) {
            reject(error);
        };
        reader.readAsArrayBuffer(file);
    });
}
// Agregar estilos CSS para el overlay de carga
const style = document.createElement('style');
style.innerHTML = `
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        backdrop-filter: blur(3px);
    }
    
    .loading-content {
        background-color: white;
        padding: 30px;
        border-radius: 10px;
        text-align: center;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
    }
    
    .loading-spinner-large {
        width: 50px;
        height: 50px;
        border: 5px solid rgba(255, 127, 39, 0.1);
        border-top: 5px solid var(--color-primary);
        border-radius: 50%;
        margin: 0 auto 20px;
        animation: spin 1s linear infinite;
    }
    
    .fade-out {
        animation: fadeOut 0.3s forwards;
    }
`;
document.head.appendChild(style);

// Verificar si se debe redirigir a BusquedaP.html al presionar ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && !historyModal.classList.contains('show')) {
        // Preguntar si hay cambios sin guardar
        if (Object.keys(camposModificados).length > 0) {
            if (confirm('Hay cambios sin guardar. ¿Está seguro que desea salir?')) {
                window.location.href = 'BusquedaP.html';
            }
        } else {
            window.location.href = 'BusquedaP.html';
        }
    }
});

// Prevenir cierre accidental de la página si hay cambios sin guardar
window.addEventListener('beforeunload', function(event) {
    if (Object.keys(camposModificados).length > 0) {
        event.preventDefault();
        event.returnValue = ''; // Esto es necesario para algunos navegadores
        return ''; // Algunos navegadores mostrarán este mensaje
    }
});