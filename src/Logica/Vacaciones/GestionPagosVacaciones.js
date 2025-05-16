// Importaciones necesarias
const odbc = require('odbc');
const path = require('path');
const fs = require('fs');
const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');
const ExcelJS = require('exceljs');

// Conexión a la base de datos
const conexion = 'DSN=recursos2';

// Variables globales
let userData;
let allDepartments = [];
let selectedDepartmentId = null;
let reportData = [];
const reportPagination = { currentPage: 1, filteredData: [] };

// Datos para las diferentes pestañas
let pendingRequests = [];
let processingRequests = [];
let collectingRequests = [];

// Variables de paginación
const itemsPerPage = 10;
const paginationState = {
    pendientes: { currentPage: 1, filteredData: [] },
    tramite: { currentPage: 1, filteredData: [] },
    cobrar: { currentPage: 1, filteredData: [] }
};

// Estados disponibles
const ESTADOS = {
    1: { nombre: 'Por Autorizar', color: '#FF9800', icono: 'clock' },
    2: { nombre: 'En Trámite', color: '#2196F3', icono: 'spinner' },
    3: { nombre: 'Pendiente de Cobro', color: '#9C27B0', icono: 'hand-holding-usd' },
    4: { nombre: 'Pagado', color: '#4CAF50', icono: 'check-circle' },
    5: { nombre: 'Anulado', color: '#F44336', icono: 'times-circle' }
};

// Establecer conexión a la base de datos
async function connectionString() {
    try {
        const connection = await odbc.connect(conexion, {
            binaryAsString: true,
            bigint: 'number'
        });
        
        // Configuración adicional de la conexión
        await connection.query('SET NAMES utf8mb4');
        await connection.query('SET character_set_results = utf8mb4');
        
        return connection;
    } catch (error) {
        console.error('Error de conexión:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar a la base de datos. Por favor intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
        throw error;
    }
}

// Inicializar la aplicación
async function initApp() {
    try {
        // Mostrar un indicador de carga
        const loadingSwal = mostrarCargando('Cargando datos...');
        
        // Cargar datos del usuario que inició sesión
        loadUserData();
        
        // Cargar todos los departamentos disponibles
        await loadAllDepartments();
        
        // Inicializar las pestañas
        initTabs();
        
        // Inicializar los eventos
        initEvents();
        initReports();
        // Cargar contadores iniciales (resumen de solicitudes)
        await loadCounters();
        
        // Cerrar el indicador de carga
        loadingSwal.close();
        
        // Mostrar mensaje de bienvenida
        Swal.fire({
            icon: 'success',
            title: 'Sistema de Proceso de Pago de Vacaciones',
            text: 'Seleccione un departamento para ver las solicitudes pendientes.',
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al inicializar',
            text: 'Hubo un problema al cargar los datos. Por favor recargue la página o contacte al administrador.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Cargar datos del usuario desde localStorage
function loadUserData() {
    try {
        userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData) {
            Swal.fire({
                icon: 'error',
                title: 'Error de sesión',
                text: 'No se encontraron datos de sesión. Por favor inicie sesión nuevamente.',
                confirmButtonColor: '#FF9800'
            }).then(() => {
                window.location.href = 'Login.html';
            });
            return;
        }
        
        console.log('Datos de usuario cargados:', userData);
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de sesión',
            text: 'Hubo un problema al cargar sus datos. Por favor inicie sesión nuevamente.',
            confirmButtonColor: '#FF9800'
        }).then(() => {
            window.location.href = 'Login.html';
        });
    }
}

// Nueva función para cargar todos los departamentos
async function loadAllDepartments() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT 
                IdDepartamento,
                NombreDepartamento
            FROM 
                departamentos
            ORDER BY 
                NombreDepartamento`;
        
        const result = await connection.query(query);
        await connection.close();
        
        if (result.length > 0) {
            allDepartments = result;
            populateDepartmentSelector();
            populateReportDepartments();
        }
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        throw error;
    }
}

// Función para llenar el selector de departamentos
function populateDepartmentSelector() {
    const selector = document.getElementById('departmentSelector');
    
    // Limpiar opciones existentes
    selector.innerHTML = '<option value="">-- Todos los departamentos --</option>';
    
    // Agregar departamentos
    allDepartments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.IdDepartamento;
        option.textContent = dept.NombreDepartamento;
        selector.appendChild(option);
    });
}

// Función para llenar el selector de departamentos en reportes
function populateReportDepartments() {
    const selector = document.getElementById('reportDepartment');
    
    // Limpiar opciones existentes
    selector.innerHTML = '<option value="">Todos los departamentos</option>';
    
    // Agregar departamentos
    allDepartments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.IdDepartamento;
        option.textContent = dept.NombreDepartamento;
        selector.appendChild(option);
    });
}

// Función para cargar contadores de solicitudes
async function loadCounters() {
    try {
        const connection = await connectionString();
        
        // Contador para solicitudes pendientes (Estado = 1)
        const pendingQuery = `
            SELECT COUNT(*) as Total
            FROM vacacionespagadas
            WHERE Estado = 1`;
        
        // Contador para solicitudes en trámite (Estado = 2)
        const processingQuery = `
            SELECT COUNT(*) as Total
            FROM vacacionespagadas
            WHERE Estado = 2`;
        
        // Contador para solicitudes pendientes de cobro (Estado = 3)
        const collectingQuery = `
            SELECT COUNT(*) as Total
            FROM vacacionespagadas
            WHERE Estado = 3`;
        
        const pendingResult = await connection.query(pendingQuery);
        const processingResult = await connection.query(processingQuery);
        const collectingResult = await connection.query(collectingQuery);
        
        await connection.close();
        
        // Actualizar contadores en pestañas
        document.getElementById('countPendientes').textContent = pendingResult[0].Total || '0';
        document.getElementById('countTramite').textContent = processingResult[0].Total || '0';
        document.getElementById('countCobrar').textContent = collectingResult[0].Total || '0';
        
        // Actualizar estadísticas
        document.getElementById('pendientesStat').textContent = pendingResult[0].Total || '0';
        document.getElementById('tramiteStat').textContent = processingResult[0].Total || '0';
        document.getElementById('cobrarStat').textContent = collectingResult[0].Total || '0';
        
    } catch (error) {
        console.error('Error al cargar contadores:', error);
        throw error;
    }
}

// Inicializar pestañas
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (tabBtns.length === 0 || tabContents.length === 0) {
        console.warn('No se encontraron elementos de pestañas en el DOM');
        return;
    }
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover clase activa de todos los botones y contenidos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Agregar clase activa al botón actual
            btn.classList.add('active');
            
            // Mostrar contenido correspondiente
            const tabId = btn.getAttribute('data-tab');
            const tabContent = document.getElementById(`${tabId}-tab`);
            if (tabContent) {
                tabContent.classList.add('active');
            }
            
            // Cargar datos según la pestaña seleccionada
            if (tabId === 'pendientes') {
                loadPendingRequests(selectedDepartmentId);
            } else if (tabId === 'tramite') {
                loadProcessingRequests();
            } else if (tabId === 'cobrar') {
                loadCollectingRequests();
            }
        });
    });
}

// Cargar solicitudes pendientes por departamento
async function loadPendingRequests(deptId = null) {
    try {
        const connection = await connectionString();
        
        // Construir la consulta base
        let query = `
            SELECT 
                vp.Idpagovacas,
                vp.IdPersonal,
                vp.NombreColaborador,
                vp.DiasSolicitado,
                vp.Periodo,
                vp.IdPlanilla,
                vp.IdDepartamento,
                vp.IdUsuario,
                vp.NombreUsuario,
                DATE_FORMAT(vp.FechaRegistro, '%Y-%m-%d') AS FechaRegistro,
                vp.Estado,
                d.NombreDepartamento,
                DATEDIFF(CURDATE(), vp.FechaRegistro) as DiasEnEstado,
                p.PrimerNombre,
                p.SegundoNombre,
                p.PrimerApellido,
                p.SegundoApellido,
                p.IdPlanilla,
                planillas.Nombre_Planilla,
                planillas.EsCapital,
                Puestos.Nombre as NombrePuesto,
                DATE_FORMAT(p.FechaPlanilla, '%Y-%m-%d') AS FechaPlanilla,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM 
                vacacionespagadas vp
                INNER JOIN departamentos d ON vp.IdDepartamento = d.IdDepartamento
                INNER JOIN personal p ON vp.IdPersonal = p.IdPersonal
                INNER JOIN planillas ON p.IdPlanilla = planillas.IdPlanilla
                INNER JOIN Puestos ON p.IdPuesto = Puestos.IdPuesto
                LEFT JOIN FotosPersonal ON p.IdPersonal = FotosPersonal.IdPersonal
            WHERE 
                vp.Estado = 1`;
                
        const params = [];
        
        // Agregar filtro de departamento si se especifica
        if (deptId) {
            query += ` AND vp.IdDepartamento = ?`;
            params.push(deptId);
        }
        
        // Ordenar por fecha más reciente
        query += ` ORDER BY vp.FechaRegistro DESC`;
        
        const result = await connection.query(query, params);
        
        await connection.close();
        
        pendingRequests = result;
        paginationState.pendientes.filteredData = [...pendingRequests];
        paginationState.pendientes.currentPage = 1;
        
        renderPendingTable();
        updatePagination('pendientes');
        
    } catch (error) {
        console.error('Error al cargar solicitudes pendientes:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar las solicitudes pendientes.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Cargar solicitudes en trámite
async function loadProcessingRequests() {
    try {
        const connection = await connectionString();
        
        // Consulta para solicitudes en trámite (Estado = 2)
        const query = `
            SELECT 
                vp.Idpagovacas,
                vp.IdPersonal,
                vp.NombreColaborador,
                vp.DiasSolicitado,
                vp.Periodo,
                vp.IdPlanilla,
                vp.IdDepartamento,
                vp.IdUsuario,
                vp.NombreUsuario,
                vp.TotalaRecibir,
                vp.NoCheque,
                vp.NoRecibo,
                DATE_FORMAT(vp.FechaRegistro, '%Y-%m-%d') AS FechaRegistro,
                vp.Estado,
                d.NombreDepartamento,
                DATEDIFF(CURDATE(), vp.FechaRegistro) as DiasEnEstado,
                p.PrimerNombre,
                p.SegundoNombre,
                p.PrimerApellido,
                p.SegundoApellido,
                planillas.Nombre_Planilla,
                Puestos.Nombre as NombrePuesto,
                DATE_FORMAT(p.FechaPlanilla, '%Y-%m-%d') AS FechaPlanilla,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM 
                vacacionespagadas vp
                INNER JOIN departamentos d ON vp.IdDepartamento = d.IdDepartamento
                INNER JOIN personal p ON vp.IdPersonal = p.IdPersonal
                INNER JOIN planillas ON vp.IdPlanilla = planillas.IdPlanilla
                INNER JOIN Puestos ON p.IdPuesto = Puestos.IdPuesto
                LEFT JOIN FotosPersonal ON p.IdPersonal = FotosPersonal.IdPersonal
            WHERE 
                vp.Estado = 2
            ORDER BY 
                vp.FechaRegistro DESC`;
        
        const result = await connection.query(query);
        
        await connection.close();
        
        processingRequests = result;
        paginationState.tramite.filteredData = [...processingRequests];
        paginationState.tramite.currentPage = 1;
        
        renderProcessingTable();
        updatePagination('tramite');
        
    } catch (error) {
        console.error('Error al cargar solicitudes en trámite:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar las solicitudes en trámite.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Cargar solicitudes pendientes de cobro
async function loadCollectingRequests() {
    try {
        const connection = await connectionString();
        
        // Consulta para solicitudes pendientes de cobro (Estado = 3)
        const query = `
            SELECT 
                vp.Idpagovacas,
                vp.IdPersonal,
                vp.NombreColaborador,
                vp.DiasSolicitado,
                vp.Periodo,
                vp.IdPlanilla,
                vp.IdDepartamento,
                vp.IdUsuario,
                vp.NombreUsuario,
                DATE_FORMAT(vp.FechaRegistro, '%Y-%m-%d') AS FechaRegistro,
                vp.Estado,
                d.NombreDepartamento,
                DATEDIFF(CURDATE(), vp.FechaRegistro) as DiasEnEstado,
                p.PrimerNombre,
                p.SegundoNombre,
                p.PrimerApellido,
                p.SegundoApellido,
                planillas.Nombre_Planilla,
                Puestos.Nombre as NombrePuesto,
                DATE_FORMAT(p.FechaPlanilla, '%Y-%m-%d') AS FechaPlanilla,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM 
                vacacionespagadas vp
                INNER JOIN departamentos d ON vp.IdDepartamento = d.IdDepartamento
                INNER JOIN personal p ON vp.IdPersonal = p.IdPersonal
                INNER JOIN planillas ON vp.IdPlanilla = planillas.IdPlanilla
                INNER JOIN Puestos ON p.IdPuesto = Puestos.IdPuesto
                LEFT JOIN FotosPersonal ON p.IdPersonal = FotosPersonal.IdPersonal
            WHERE 
                vp.Estado = 3
            ORDER BY 
                vp.FechaRegistro DESC`;
        
        const result = await connection.query(query);
        
        await connection.close();
        
        collectingRequests = result;
        paginationState.cobrar.filteredData = [...collectingRequests];
        paginationState.cobrar.currentPage = 1;
        
        renderCollectingTable();
        updatePagination('cobrar');
        
    } catch (error) {
        console.error('Error al cargar solicitudes pendientes de cobro:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar las solicitudes pendientes de cobro.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para renderizar la tabla de solicitudes pendientes
async function renderPendingTable() {
    const tbody = document.querySelector('#pendientesTable tbody');
    tbody.innerHTML = '';
    
    const data = paginationState.pendientes.filteredData;
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="loading-message">
                    <div class="empty-state">
                        <i class="fas fa-check-circle"></i>
                        <h3>No hay solicitudes pendientes</h3>
                        <p>No hay solicitudes de pago pendientes por autorizar.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const start = (paginationState.pendientes.currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedData = data.slice(start, end);
    
    // Mostrar indicador de carga
    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="loading-message">
                <div class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <h3>Calculando montos</h3>
                    <p>Por favor espere mientras se calculan los montos...</p>
                </div>
            </td>
        </tr>
    `;
    
    // Procesar cada solicitud
    const rows = [];
    
    for (const request of paginatedData) {
        const row = document.createElement('tr');
        
        // Calcular monto estimado con la nueva función
        const diasSolicitados = parseInt(request.DiasSolicitado) || 0;
        let montoEstimado;
        try {
            montoEstimado = await calcularMontoEstimado(request.IdPersonal, diasSolicitados, request.Periodo);
        } catch (error) {
            console.error('Error al calcular monto para solicitud:', request.Idpagovacas, error);
            montoEstimado = 0;
        }
        
        // Obtener tiempo en estado
        const tiempoEstado = obtenerTiempoEstado(request.DiasEnEstado);
        
        row.innerHTML = `
            <td>${formatDate(request.FechaRegistro)}</td>
            <td>${request.NombreColaborador}</td>
            <td>${request.NombreDepartamento}</td>
            <td>${formatPeriodoUsuario(request.Periodo)}</td>
            <td>${request.DiasSolicitado}</td>
            <td>Q ${montoEstimado.toFixed(2)}</td>
            <td>${request.NombreUsuario}</td>
            <td>
                <span class="${obtenerClaseTiempo(request.DiasEnEstado)}">
                    ${tiempoEstado}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-action btn-approve" onclick="autorizarSolicitud(${request.Idpagovacas})" title="Autorizar">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-table-action btn-reject" onclick="anularSolicitud(${request.Idpagovacas})" title="Anular">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        `;
        
        rows.push(row);
    }
    
    // Limpiar la tabla y agregar filas
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}
// Función para renderizar la tabla de solicitudes en trámite
function renderProcessingTable() {
    const tbody = document.querySelector('#tramiteTable tbody');
    tbody.innerHTML = '';
    
    const data = paginationState.tramite.filteredData;
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="loading-message">
                    <div class="empty-state">
                        <i class="fas fa-check-circle"></i>
                        <h3>No hay solicitudes en trámite</h3>
                        <p>No hay solicitudes de pago en trámite actualmente.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Modificar las columnas del encabezado para incluir No. Cheque y No. Recibo
    const thead = document.querySelector('#tramiteTable thead tr');
    if (thead) {
        thead.innerHTML = `
            <th>Fecha Solicitud</th>
            <th>Colaborador</th>
            <th>Departamento</th>
            <th>Período</th>
            <th>Días</th>
            <th>Monto Est.</th>
            <th>Autorizado por</th>
            <th>No. Cheque</th>
            <th>No. Recibo</th>
            <th>Tiempo en Estado</th>
            <th>Acciones</th>
        `;
    }
    
    const start = (paginationState.tramite.currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedData = data.slice(start, end);
    
    paginatedData.forEach(async (request) => {
        const row = document.createElement('tr');
        
        // Calcular monto estimado correctamente con los tres parámetros necesarios
        const diasSolicitados = parseInt(request.DiasSolicitado) || 0;
        let montoEstimado;
        
        try {
            // Usar TotalaRecibir si ya está guardado (para no tener que recalcular)
            if (request.TotalaRecibir) {
                montoEstimado = parseFloat(request.TotalaRecibir);
            } else {
                montoEstimado = await calcularMontoEstimado(request.IdPersonal, diasSolicitados, request.Periodo);
            }
        } catch (error) {
            console.error('Error al calcular monto para solicitud:', request.Idpagovacas, error);
            montoEstimado = 0;
        }
        
        // Convertir a número para asegurar que toFixed funcione
        montoEstimado = parseFloat(montoEstimado) || 0;
        
        // Obtener tiempo en estado
        const tiempoEstado = obtenerTiempoEstado(request.DiasEnEstado);
        
        // Valores anteriores de No. Cheque y No. Recibo (si existen)
        const noChequeValue = request.NoCheque || '';
        const noReciboValue = request.NoRecibo || '';
        
        row.innerHTML = `
            <td>${formatDate(request.FechaRegistro)}</td>
            <td>${request.NombreColaborador}</td>
            <td>${request.NombreDepartamento}</td>
            <td>${formatPeriodoUsuario(request.Periodo)}</td>
            <td>${request.DiasSolicitado}</td>
            <td>Q ${montoEstimado.toFixed(2)}</td>
            <td>${request.NombreUsuario}</td>
            <td>
                <input type="text" class="form-control-sm input-table" id="noCheque_${request.Idpagovacas}" 
                       value="${noChequeValue}" placeholder="No. Cheque">
            </td>
            <td>
                <input type="text" class="form-control-sm input-table" id="noRecibo_${request.Idpagovacas}" 
                       value="${noReciboValue}" placeholder="No. Recibo">
            </td>
            <td>
                <span class="${obtenerClaseTiempo(request.DiasEnEstado)}">
                    ${tiempoEstado}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-action btn-complete" onclick="registrarPago(${request.Idpagovacas})" title="Registrar pago">
                        <i class="fas fa-money-check"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Función para renderizar la tabla de solicitudes pendientes de cobro
function renderCollectingTable() {
    const tbody = document.querySelector('#cobrarTable tbody');
    tbody.innerHTML = '';
    
    const data = paginationState.cobrar.filteredData;
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="loading-message">
                    <div class="empty-state">
                        <i class="fas fa-check-circle"></i>
                        <h3>No hay solicitudes pendientes por cobrar</h3>
                        <p>No hay solicitudes de pago pendientes de cobro actualmente.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const start = (paginationState.cobrar.currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedData = data.slice(start, end);
    
    paginatedData.forEach(async (request) => {
        const row = document.createElement('tr');
        
        // Calcular monto final (usar TotalaRecibir si está disponible)
        const diasSolicitados = parseInt(request.DiasSolicitado) || 0;
        let montoFinal;
        
        try {
            // Usar TotalaRecibir si ya está guardado (para no tener que recalcular)
            if (request.TotalaRecibir) {
                montoFinal = parseFloat(request.TotalaRecibir);
            } else {
                montoFinal = await calcularMontoEstimado(request.IdPersonal, diasSolicitados, request.Periodo);
            }
        } catch (error) {
            console.error('Error al calcular monto para solicitud:', request.Idpagovacas, error);
            montoFinal = 0;
        }
        
        // Convertir a número para asegurar que toFixed funcione
        montoFinal = parseFloat(montoFinal) || 0;
        
        // Obtener tiempo en estado
        const tiempoEstado = obtenerTiempoEstado(request.DiasEnEstado);
        
        // Fecha de pago (simulada, deberías obtenerla de tu BD)
        const fechaPago = 'Pendiente';
        
        row.innerHTML = `
            <td>${formatDate(request.FechaRegistro)}</td>
            <td>${request.NombreColaborador}</td>
            <td>${request.NombreDepartamento}</td>
            <td>${formatPeriodoUsuario(request.Periodo)}</td>
            <td>${request.DiasSolicitado}</td>
            <td>Q ${montoFinal.toFixed(2)}</td>
            <td>${fechaPago}</td>
            <td>
                <span class="${obtenerClaseTiempo(request.DiasEnEstado)}">
                    ${tiempoEstado}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-action btn-complete" onclick="marcarCobrado(${request.Idpagovacas})" title="Marcar como cobrado">
                        <i class="fas fa-hand-holding-usd"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Función para actualizar la paginación
function updatePagination(tabName) {
    const state = paginationState[tabName];
    const data = state.filteredData;
    const totalPages = Math.ceil(data.length / itemsPerPage) || 1;
    
    document.getElementById(`pageIndicator${capitalizeFirstLetter(tabName)}`).textContent = `Página ${state.currentPage} de ${totalPages}`;
    
    const prevButton = document.getElementById(`prevPage${capitalizeFirstLetter(tabName)}`);
    const nextButton = document.getElementById(`nextPage${capitalizeFirstLetter(tabName)}`);
    
    prevButton.disabled = state.currentPage === 1;
    nextButton.disabled = state.currentPage === totalPages;
}

// Función para capitalizar primera letra
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Función para filtrar solicitudes pendientes
function filterPendientes() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        paginationState.pendientes.filteredData = [...pendingRequests];
    } else {
        paginationState.pendientes.filteredData = pendingRequests.filter(request => {
            return request.NombreColaborador.toLowerCase().includes(searchTerm);
        });
    }
    
    paginationState.pendientes.currentPage = 1;
    renderPendingTable();
    updatePagination('pendientes');
}

// Función para filtrar solicitudes en trámite
function filterTramite() {
    const searchTerm = document.getElementById('searchTramiteInput').value.toLowerCase();
    
    if (!searchTerm) {
        paginationState.tramite.filteredData = [...processingRequests];
    } else {
        paginationState.tramite.filteredData = processingRequests.filter(request => {
            return request.NombreColaborador.toLowerCase().includes(searchTerm);
        });
    }
    
    paginationState.tramite.currentPage = 1;
    renderProcessingTable();
    updatePagination('tramite');
}

// Función para filtrar solicitudes pendientes de cobro
function filterCobrar() {
    const searchTerm = document.getElementById('searchCobrarInput').value.toLowerCase();
    
    if (!searchTerm) {
        paginationState.cobrar.filteredData = [...collectingRequests];
    } else {
        paginationState.cobrar.filteredData = collectingRequests.filter(request => {
            return request.NombreColaborador.toLowerCase().includes(searchTerm);
        });
    }
    
    paginationState.cobrar.currentPage = 1;
    renderCollectingTable();
    updatePagination('cobrar');
}

// Función modificada para autorizar solicitud
async function autorizarSolicitud(requestId) {
    const confirmResult = await Swal.fire({
        title: '¿Autorizar solicitud?',
        text: 'La solicitud pasará a estado "En Trámite"',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2196F3',
        cancelButtonColor: '#F44336',
        confirmButtonText: 'Sí, autorizar',
        cancelButtonText: 'Cancelar'
    });
    
    if (confirmResult.isConfirmed) {
        try {
            // Mostrar indicador de carga
            const loadingSwal = mostrarCargando('Procesando autorización...');
            
            // Primero obtenemos los datos de la solicitud para calcular el monto
            const connection = await connectionString();
            
            // Obtener datos de la solicitud
            const queryGetRequest = `
                SELECT 
                    IdPersonal, 
                    DiasSolicitado, 
                    Periodo,
                    Estado
                FROM 
                    vacacionespagadas
                WHERE 
                    Idpagovacas = ?
            `;
            
            const requestData = await connection.query(queryGetRequest, [requestId]);
            
            if (!requestData || requestData.length === 0) {
                await connection.close();
                loadingSwal.close();
                Swal.fire({
                    title: 'Error',
                    text: 'No se encontró la solicitud',
                    icon: 'error',
                    confirmButtonColor: '#FF9800'
                });
                return;
            }
            
            // Calcular el monto total a recibir
            const idPersonal = requestData[0].IdPersonal;
            const diasSolicitados = parseInt(requestData[0].DiasSolicitado) || 0;
            const periodo = requestData[0].Periodo;
            const estadoAnterior = requestData[0].Estado;
            
            let montoTotal;
            try {
                montoTotal = await calcularMontoEstimado(idPersonal, diasSolicitados, periodo);
            } catch (error) {
                console.error('Error al calcular monto:', error);
                await connection.close();
                loadingSwal.close();
                Swal.fire({
                    title: 'Error',
                    text: 'No se pudo calcular el monto total a recibir',
                    icon: 'error',
                    confirmButtonColor: '#FF9800'
                });
                return;
            }
            
            // Actualizar estado de la solicitud a 2 (En Trámite) y establecer TotalaRecibir
            const queryUpdateRequest = `
                UPDATE vacacionespagadas
                SET 
                    Estado = 2,
                    TotalaRecibir = ?
                WHERE 
                    Idpagovacas = ?
            `;
            
            await connection.query(queryUpdateRequest, [montoTotal, requestId]);
            
            // Registrar el cambio en la tabla de historial
            const queryInsertHistory = `
                INSERT INTO HistorialEstadoPagoVacaciones (
                    IdPagoVacaciones,
                    EstadoAnterior,
                    EstadoNuevo,
                    IdUsuario,
                    NombreUsuario
                ) VALUES (?, ?, ?, ?, ?)
            `;
            
            await connection.query(queryInsertHistory, [
                requestId,
                estadoAnterior,
                2, // Nuevo estado: En Trámite
                userData.IdPersonal,
                userData.NombreCompleto
            ]);
            
            await connection.close();
            loadingSwal.close();
            
            Swal.fire({
                title: 'Solicitud autorizada',
                text: 'La solicitud ha sido autorizada exitosamente',
                icon: 'success',
                confirmButtonColor: '#4CAF50'
            }).then(() => {
                // Recargar datos inmediatamente para reflejar los cambios
                loadPendingRequests(selectedDepartmentId);
                loadProcessingRequests();
                loadCounters();
            });
            
        } catch (error) {
            console.error('Error al autorizar solicitud:', error);
            Swal.fire({
                title: 'Error',
                text: 'No se pudo autorizar la solicitud. Por favor intente nuevamente.',
                icon: 'error',
                confirmButtonColor: '#FF9800'
            });
        }
    }
}

// Función modificada para anular solicitud
async function anularSolicitud(requestId) {
    const { value: comentario } = await Swal.fire({
        title: 'Anular solicitud',
        confirmButtonText: 'Anular solicitud',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value) {
                return 'Debe ingresar un motivo para anular la solicitud';
            }
        }
    });
    
    if (comentario) {
        try {
            // Mostrar indicador de carga
            const loadingSwal = mostrarCargando('Procesando anulación...');
            
            const connection = await connectionString();
            
            // Primero obtenemos el estado actual para guardarlo en el historial
            const queryGetState = `
                SELECT Estado
                FROM vacacionespagadas
                WHERE Idpagovacas = ?
            `;
            
            const stateResult = await connection.query(queryGetState, [requestId]);
            
            if (!stateResult || stateResult.length === 0) {
                await connection.close();
                loadingSwal.close();
                Swal.fire({
                    title: 'Error',
                    text: 'No se encontró la solicitud',
                    icon: 'error',
                    confirmButtonColor: '#FF9800'
                });
                return;
            }
            
            const estadoAnterior = stateResult[0].Estado;
            
            // Actualizar estado de la solicitud a 5 (Anulado)
            const queryUpdateRequest = `
                UPDATE vacacionespagadas
                SET Estado = 5
                WHERE Idpagovacas = ?
            `;
            
            await connection.query(queryUpdateRequest, [requestId]);
            
            // Registrar el cambio en la tabla de historial
            const queryInsertHistory = `
                INSERT INTO HistorialEstadoPagoVacaciones (
                    IdPagoVacaciones,
                    EstadoAnterior,
                    EstadoNuevo,
                    IdUsuario,
                    NombreUsuario
                ) VALUES (?, ?, ?, ?, ?)
            `;
            
            await connection.query(queryInsertHistory, [
                requestId,
                estadoAnterior,
                5, // Nuevo estado: Anulado
                userData.IdPersonal,
                userData.NombreCompleto
            ]);
            
            await connection.close();
            loadingSwal.close();
            
            Swal.fire({
                title: 'Solicitud anulada',
                text: 'La solicitud ha sido anulada exitosamente',
                icon: 'success',
                confirmButtonColor: '#4CAF50'
            }).then(() => {
                // Recargar datos inmediatamente para reflejar los cambios
                loadPendingRequests(selectedDepartmentId);
                loadCounters();
            });
            
        } catch (error) {
            console.error('Error al anular solicitud:', error);
            Swal.fire({
                title: 'Error',
                text: 'No se pudo anular la solicitud. Por favor intente nuevamente.',
                icon: 'error',
                confirmButtonColor: '#FF9800'
            });
        }
    }
}

// Función para registrar pago
async function registrarPago(requestId) {
    // Obtener los valores de No. Cheque y No. Recibo
    const noChequeInput = document.getElementById(`noCheque_${requestId}`);
    const noReciboInput = document.getElementById(`noRecibo_${requestId}`);
    
    const noCheque = noChequeInput ? noChequeInput.value.trim() : '';
    const noRecibo = noReciboInput ? noReciboInput.value.trim() : '';
    
    // Validar que se ingresaron los datos requeridos
    if (!noCheque || !noRecibo) {
        Swal.fire({
            title: 'Datos requeridos',
            text: 'Debe ingresar el No. Cheque y No. Recibo para continuar',
            icon: 'warning',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    const confirmResult = await Swal.fire({
        title: 'Registrar pago',
        text: '¿Está seguro de registrar el pago? La solicitud pasará a estado "Pendiente de Cobro"',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#9C27B0',
        cancelButtonColor: '#999',
        confirmButtonText: 'Sí, registrar pago',
        cancelButtonText: 'Cancelar'
    });
    
    if (confirmResult.isConfirmed) {
        try {
            const loadingSwal = mostrarCargando('Registrando pago...');
            
            const connection = await connectionString();
            
            // Obtener estado actual para el historial
            const queryGetState = `
                SELECT Estado
                FROM vacacionespagadas
                WHERE Idpagovacas = ?
            `;
            
            const stateResult = await connection.query(queryGetState, [requestId]);
            
            if (!stateResult || stateResult.length === 0) {
                await connection.close();
                loadingSwal.close();
                Swal.fire({
                    title: 'Error',
                    text: 'No se encontró la solicitud',
                    icon: 'error',
                    confirmButtonColor: '#FF9800'
                });
                return;
            }
            
            const estadoAnterior = stateResult[0].Estado;
            
            // Actualizar estado de la solicitud a 3 (Pendiente de Cobro) y guardar NoCheque y NoRecibo
            const queryUpdateRequest = `
                UPDATE vacacionespagadas
                SET 
                    Estado = 3,
                    NoCheque = ?,
                    NoRecibo = ?
                WHERE Idpagovacas = ?
            `;
            
            await connection.query(queryUpdateRequest, [noCheque, noRecibo, requestId]);
            
            // Registrar el cambio en la tabla de historial
            const queryInsertHistory = `
                INSERT INTO HistorialEstadoPagoVacaciones (
                    IdPagoVacaciones,
                    EstadoAnterior,
                    EstadoNuevo,
                    IdUsuario,
                    NombreUsuario
                ) VALUES (?, ?, ?, ?, ?)
            `;
            
            await connection.query(queryInsertHistory, [
                requestId,
                estadoAnterior,
                3, // Nuevo estado: Pendiente de Cobro
                userData.IdPersonal,
                userData.NombreCompleto
            ]);
            
            await connection.close();
            loadingSwal.close();
            
            Swal.fire({
                title: 'Pago registrado',
                text: 'El pago ha sido registrado exitosamente',
                icon: 'success',
                confirmButtonColor: '#4CAF50'
            }).then(() => {
                // Recargar datos
                loadProcessingRequests();
                loadCollectingRequests();
                loadCounters();
            });
            
        } catch (error) {
            console.error('Error al registrar pago:', error);
            Swal.fire({
                title: 'Error',
                text: 'No se pudo registrar el pago. Por favor intente nuevamente.',
                icon: 'error',
                confirmButtonColor: '#FF9800'
            });
        }
    }
}

// Función para marcar como cobrado
async function marcarCobrado(requestId) {
    const confirmResult = await Swal.fire({
        title: 'Marcar como cobrado',
        text: '¿Está seguro de marcar como cobrado? La solicitud pasará a estado "Pagado"',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#999',
        confirmButtonText: 'Sí, marcar como cobrado',
        cancelButtonText: 'Cancelar'
    });
    
    if (confirmResult.isConfirmed) {
        try {
            const loadingSwal = mostrarCargando('Procesando...');
            
            const connection = await connectionString();
            
            // Obtener estado actual para el historial
            const queryGetState = `
                SELECT Estado
                FROM vacacionespagadas
                WHERE Idpagovacas = ?
            `;
            
            const stateResult = await connection.query(queryGetState, [requestId]);
            
            if (!stateResult || stateResult.length === 0) {
                await connection.close();
                loadingSwal.close();
                Swal.fire({
                    title: 'Error',
                    text: 'No se encontró la solicitud',
                    icon: 'error',
                    confirmButtonColor: '#FF9800'
                });
                return;
            }
            
            const estadoAnterior = stateResult[0].Estado;
            
            // Actualizar estado de la solicitud a 4 (Pagado)
            const queryUpdateRequest = `
                UPDATE vacacionespagadas
                SET Estado = 4
                WHERE Idpagovacas = ?
            `;
            
            await connection.query(queryUpdateRequest, [requestId]);
            
            // Registrar el cambio en la tabla de historial
            const queryInsertHistory = `
                INSERT INTO HistorialEstadoPagoVacaciones (
                    IdPagoVacaciones,
                    EstadoAnterior,
                    EstadoNuevo,
                    IdUsuario,
                    NombreUsuario
                ) VALUES (?, ?, ?, ?, ?)
            `;
            
            await connection.query(queryInsertHistory, [
                requestId,
                estadoAnterior,
                4, // Nuevo estado: Pagado
                userData.IdPersonal,
                userData.NombreCompleto
            ]);
            
            await connection.close();
            loadingSwal.close();
            
            Swal.fire({
                title: 'Cobro registrado',
                text: 'El cobro ha sido registrado exitosamente',
                icon: 'success',
                confirmButtonColor: '#4CAF50'
            }).then(() => {
                // Recargar datos
                loadCollectingRequests();
                loadCounters();
            });
            
        } catch (error) {
            console.error('Error al marcar como cobrado:', error);
            Swal.fire({
                title: 'Error',
                text: 'No se pudo marcar como cobrado. Por favor intente nuevamente.',
                icon: 'error',
                confirmButtonColor: '#FF9800'
            });
        }
    }
}

// Funciones para manejo de reportes
function openReportModal(reportType) {
    const modal = document.getElementById('reportModal');
    const title = document.getElementById('reportModalTitle');
    
    // Configurar el modal según el tipo de reporte
    switch (reportType) {
        case 'dept':
            title.textContent = 'Generar Reporte por Departamento';
            document.getElementById('departmentFilterGroup').style.display = 'block';
            document.getElementById('employeeFilterGroup').style.display = 'none';
            break;
        case 'history':
            title.textContent = 'Generar Historial de Pagos';
            document.getElementById('departmentFilterGroup').style.display = 'block';
            document.getElementById('employeeFilterGroup').style.display = 'none';
            break;
        case 'employee':
            title.textContent = 'Generar Reporte por Colaborador';
            document.getElementById('departmentFilterGroup').style.display = 'block';
            document.getElementById('employeeFilterGroup').style.display = 'block';
            break;
        case 'stats':
            title.textContent = 'Generar Informe de Estadísticas';
            document.getElementById('departmentFilterGroup').style.display = 'block';
            document.getElementById('employeeFilterGroup').style.display = 'none';
            break;
    }
    
    // Guardar el tipo de reporte para generarlo después
    document.getElementById('reportModal').setAttribute('data-report-type', reportType);
    
    // Mostrar el modal
    modal.classList.add('show');
}

// Función para generar reporte según el tipo
async function generateReport() {
    const reportType = document.getElementById('reportModal').getAttribute('data-report-type');
    const dateFrom = document.getElementById('reportDateFrom').value;
    const dateTo = document.getElementById('reportDateTo').value;
    const department = document.getElementById('reportDepartment').value;
    const employeeId = document.getElementById('reportEmployeeId').value;
    const format = document.getElementById('reportFormat').value;
    
    if (!dateFrom || !dateTo) {
        Swal.fire({
            title: 'Fechas requeridas',
            text: 'Por favor seleccione las fechas para generar el reporte',
            icon: 'warning',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Validar formato de fechas
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    
    if (fromDate > toDate) {
        Swal.fire({
            title: 'Rango de fechas inválido',
            text: 'La fecha inicial debe ser anterior a la fecha final',
            icon: 'warning',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Validar selección de empleado si es reporte por colaborador
    if (reportType === 'employee' && !employeeId) {
        Swal.fire({
            title: 'Selección requerida',
            text: 'Por favor seleccione un colaborador para generar el reporte',
            icon: 'warning',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Mostrar indicador de carga
    const loadingSwal = mostrarCargando('Generando reporte...');
    
    try {
        // Aquí iría la lógica para generar el reporte según el tipo
        // Por ahora, simulamos un tiempo de espera
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        loadingSwal.close();
        
        // Cerrar el modal de reportes
        document.getElementById('reportModal').classList.remove('show');
        
        // Mostrar mensaje de éxito
        Swal.fire({
            title: 'Reporte generado',
            text: `El reporte ha sido generado en formato ${format.toUpperCase()}`,
            icon: 'success',
            confirmButtonColor: '#4CAF50'
        });
        
    } catch (error) {
        console.error('Error al generar reporte:', error);
        loadingSwal.close();
        
        Swal.fire({
            title: 'Error',
            text: 'No se pudo generar el reporte. Por favor intente nuevamente.',
            icon: 'error',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para calcular monto estimado basado en el IdPlanilla y el período
async function calcularMontoEstimado(idPersonal, diasSolicitados, periodo) {
    if (!diasSolicitados || diasSolicitados <= 0) return 0;
    
    try {
        // 1. Obtener información de la planilla para verificar EsCapital
        const connection = await connectionString();
        const queryPlanilla = `
            SELECT 
                p.IdPlanilla,
                pl.EsCapital
            FROM 
                personal p
                INNER JOIN planillas pl ON p.IdPlanilla = pl.IdPlanilla
            WHERE 
                p.IdPersonal = ?
        `;
        
        const resultPlanilla = await connection.query(queryPlanilla, [idPersonal]);
        
        if (!resultPlanilla || resultPlanilla.length === 0) {
            console.error('No se encontró información de la planilla para el empleado');
            await connection.close();
            return 0;
        }
        
        const esCapital = resultPlanilla[0].EsCapital;
        
        // 2. Extraer el año del período (después del "al")
        const anioPeriodo = extraerAnioPeriodo(periodo);
        if (!anioPeriodo) {
            console.error('No se pudo extraer el año del período');
            await connection.close();
            return 0;
        }
        
        // 3. Obtener el salario diario correspondiente según EsCapital
        const querySalario = `
            SELECT 
                ${esCapital === 1 ? 'SalarioDiarioGuate' : 'SalarioDiario'} AS SalarioDiarioAplicado
            FROM 
                salariosbase
            WHERE 
                Anyo = ?
        `;
        
        const resultSalario = await connection.query(querySalario, [anioPeriodo]);
        await connection.close();
        
        if (!resultSalario || resultSalario.length === 0) {
            console.error(`No se encontró información de salario para el año ${anioPeriodo}`);
            return 0;
        }
        
        // 4. Calcular el monto total
        const salarioDiario = parseFloat(resultSalario[0].SalarioDiarioAplicado) || 0;
        const montoTotal = diasSolicitados * salarioDiario;
        
        return montoTotal;
        
    } catch (error) {
        console.error('Error al calcular monto estimado:', error);
        return 0;
    }
}

// Función auxiliar para extraer el año del período
function extraerAnioPeriodo(periodo) {
    if (!periodo) return null;
    
    // El formato del período es: "2022-06-01 al 2023-05-31"
    // Necesitamos extraer el año después del "al", en este caso 2023
    const partes = periodo.split(' al ');
    if (partes.length !== 2) return null;
    
    const fechaFin = partes[1]; // "2023-05-31"
    
    // Extraer el año (primeros 4 caracteres de la fecha)
    const anio = fechaFin.substring(0, 4);
    
    // Verificar que sea un número válido
    if (isNaN(parseInt(anio))) return null;
    
    return anio;
}

// Función para obtener tiempo en estado
function obtenerTiempoEstado(dias) {
    if (dias === 0) {
        return 'Hoy';
    } else if (dias === 1) {
        return '1 día';
    } else {
        return `${dias} días`;
    }
}

// Función para obtener clase CSS según tiempo en estado
function obtenerClaseTiempo(dias) {
    if (dias > 7) {
        return 'tiempo-estado tiempo-alto';
    } else if (dias > 3) {
        return 'tiempo-estado tiempo-medio';
    } else {
        return 'tiempo-estado';
    }
}

// Función para formatear fecha
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    // Crear la fecha sin ajuste de zona horaria
    const date = new Date(dateString);
    
    // Verificar si la fecha es válida
    if (isNaN(date)) return 'N/A';
    
    // Si la fecha viene de la base de datos, ajustar para evitar problemas de zona horaria
    // Obtener los componentes de la fecha original
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    
    // Crear una nueva fecha con los componentes UTC
    const localDate = new Date(year, month, day);
    
    // Formatear la fecha
    const dayFormatted = String(localDate.getDate()).padStart(2, '0');
    const monthFormatted = String(localDate.getMonth() + 1).padStart(2, '0');
    const yearFormatted = localDate.getFullYear();
    
    return `${dayFormatted}/${monthFormatted}/${yearFormatted}`;
}

// Función para formatear período
function formatPeriodoUsuario(periodo) {
    if (!periodo) return '';
    
    const partes = periodo.split(' al ');
    if (partes.length === 2) {
        try {
            const fechaInicio = new Date(partes[0]);
            const fechaFin = new Date(partes[1]);
            
            if (!isNaN(fechaInicio) && !isNaN(fechaFin)) {
                return `${formatDate(fechaInicio)} al ${formatDate(fechaFin)}`;
            }
        } catch (error) {
            console.error('Error al formatear período:', error);
        }
    }
    
    return periodo;
}

// Función para mostrar animación de carga
function mostrarCargando(mensaje = "Cargando...") {
    return Swal.fire({
        title: mensaje,
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                <div class="spinner" style="border: 5px solid #f3f3f3; border-top: 5px solid #FF9800; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;"></div>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false
    });
}
function initReports() {
    // Cargar departamentos en el filtro
    const deptSelect = document.getElementById('reportFilterDept');
    if (deptSelect) {
        deptSelect.innerHTML = '<option value="">Todos los departamentos</option>';
        
        allDepartments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.IdDepartamento;
            option.textContent = dept.NombreDepartamento;
            deptSelect.appendChild(option);
        });
    }
    
    // Configurar eventos
    const searchReportBtn = document.getElementById('searchReportBtn');
    if (searchReportBtn) {
        searchReportBtn.addEventListener('click', searchReport);
    }
    
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetReportFilters);
    }
    
    const reportSearchInput = document.getElementById('reportSearchName');
    const clearReportSearch = document.getElementById('clearReportSearch');
    
    if (reportSearchInput && clearReportSearch) {
        reportSearchInput.addEventListener('input', function() {
            clearReportSearch.style.display = this.value ? 'block' : 'none';
        });
        
        clearReportSearch.addEventListener('click', function() {
            reportSearchInput.value = '';
            this.style.display = 'none';
        });
    }
    
    // Configurar eventos de paginación
    const prevPageReport = document.getElementById('prevPageReport');
    if (prevPageReport) {
        prevPageReport.addEventListener('click', function() {
            if (reportPagination.currentPage > 1) {
                reportPagination.currentPage--;
                renderReportTable();
                updateReportPagination();
            }
        });
    }
    
    const nextPageReport = document.getElementById('nextPageReport');
    if (nextPageReport) {
        nextPageReport.addEventListener('click', function() {
            const totalPages = Math.ceil(reportPagination.filteredData.length / itemsPerPage);
            if (reportPagination.currentPage < totalPages) {
                reportPagination.currentPage++;
                renderReportTable();
                updateReportPagination();
            }
        });
    }
    
    // Configurar evento de exportación
    const exportReportBtn = document.getElementById('exportReportBtn');
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', exportReport);
    }
    
    // Establecer fecha actual como fecha hasta por defecto
    const dateToInput = document.getElementById('reportDateTo');
    if (dateToInput) {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        dateToInput.value = formattedDate;
    }
    
    // Establecer fecha hace un mes como fecha desde por defecto
    const dateFromInput = document.getElementById('reportDateFrom');
    if (dateFromInput) {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const formattedDate = oneMonthAgo.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        dateFromInput.value = formattedDate;
    }
}
function resetReportFilters() {
    // Resetear departamento
    document.getElementById('reportFilterDept').value = '';
    
    // Resetear estado
    document.getElementById('reportFilterStatus').value = '';
    
    // Resetear fechas a valores por defecto (último mes)
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const formattedOneMonthAgo = oneMonthAgo.toISOString().split('T')[0];
    
    document.getElementById('reportDateFrom').value = formattedOneMonthAgo;
    document.getElementById('reportDateTo').value = formattedToday;
    
    // Resetear búsqueda por nombre
    const searchInput = document.getElementById('reportSearchName');
    searchInput.value = '';
    
    // Ocultar botón de limpiar búsqueda
    document.getElementById('clearReportSearch').style.display = 'none';
    
    // Resetear tabla
    const tbody = document.querySelector('#reportTable tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="loading-message">
                <div class="empty-state">
                    <i class="fas fa-filter"></i>
                    <h3>Configure los filtros</h3>
                    <p>Seleccione los filtros deseados y haga clic en "Buscar" para generar el reporte.</p>
                </div>
            </td>
        </tr>
    `;
    
    // Resetear paginación
    reportData = [];
    reportPagination.filteredData = [];
    reportPagination.currentPage = 1;
    updateReportPagination();
}

// Función para exportar reporte
async function exportReport() {
    if (reportPagination.filteredData.length === 0) {
        Swal.fire({
            title: 'Sin datos para exportar',
            text: 'Primero debe generar un reporte con datos para poder exportarlo.',
            icon: 'warning',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    const format = document.getElementById('exportFormat').value;
    const loadingSwal = mostrarCargando(`Exportando reporte en formato ${format.toUpperCase()}...`);
    
    try {
        // Simulación de exportación (aquí implementarías la lógica real)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        loadingSwal.close();
        
        Swal.fire({
            title: 'Exportación completada',
            text: `El reporte ha sido exportado exitosamente en formato ${format.toUpperCase()}.`,
            icon: 'success',
            confirmButtonColor: '#4CAF50'
        });
        
    } catch (error) {
        console.error('Error al exportar reporte:', error);
        loadingSwal.close();
        
        Swal.fire({
            title: 'Error',
            text: 'No se pudo exportar el reporte. Por favor intente nuevamente.',
            icon: 'error',
            confirmButtonColor: '#FF9800'
        });
    }
}
// Función para buscar reportes según los filtros aplicados
async function searchReport() {
    const departmentId = document.getElementById('reportFilterDept').value;
    const statusId = document.getElementById('reportFilterStatus').value;
    const dateFrom = document.getElementById('reportDateFrom').value;
    const dateTo = document.getElementById('reportDateTo').value;
    const searchName = document.getElementById('reportSearchName').value.trim().toLowerCase();
    
    // Validar fechas
    if (dateFrom && dateTo) {
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        
        if (fromDate > toDate) {
            Swal.fire({
                title: 'Rango de fechas inválido',
                text: 'La fecha inicial debe ser anterior a la fecha final',
                icon: 'warning',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
    }
    
    // Mostrar indicador de carga
    const loadingSwal = mostrarCargando('Generando reporte...');
    
    try {
        const connection = await connectionString();
        
        // Construir la consulta base para los pagos
        let query = `
            SELECT 
                vp.Idpagovacas,
                vp.IdPersonal,
                vp.NombreColaborador,
                vp.DiasSolicitado,
                vp.Periodo,
                vp.TotalaRecibir,
                vp.NoCheque,
                vp.NoRecibo,
                vp.IdDepartamento,
                DATE_FORMAT(vp.FechaRegistro, '%Y-%m-%d') AS FechaRegistro,
                vp.Estado,
                d.NombreDepartamento
            FROM 
                vacacionespagadas vp
                INNER JOIN departamentos d ON vp.IdDepartamento = d.IdDepartamento
            WHERE 1=1`;
        
        const params = [];
        
        // Añadir filtros según los parámetros seleccionados
        if (departmentId) {
            query += ` AND vp.IdDepartamento = ?`;
            params.push(departmentId);
        }
        
        if (statusId) {
            query += ` AND vp.Estado = ?`;
            params.push(statusId);
        }
        
        if (dateFrom) {
            query += ` AND vp.FechaRegistro >= ?`;
            params.push(dateFrom);
        }
        
        if (dateTo) {
            query += ` AND vp.FechaRegistro <= ?`;
            params.push(dateTo + ' 23:59:59'); // Incluir todo el día
        }
        
        if (searchName) {
            query += ` AND vp.NombreColaborador LIKE ?`;
            params.push(`%${searchName}%`);
        }
        
        // Ordenar por fecha más reciente
        query += ` ORDER BY vp.FechaRegistro DESC`;
        
        const pagoResult = await connection.query(query, params);
        
        // Ahora, para cada pago, obtener su historial de cambios
        const reportDataWithHistory = [];
        
        for (const pago of pagoResult) {
            // Consulta para obtener el historial de este pago
            const historyQuery = `
                SELECT 
                    h.IdPagoVacaciones,
                    h.EstadoAnterior,
                    h.EstadoNuevo,
                    h.IdUsuario,
                    h.NombreUsuario,
                    DATE_FORMAT(h.FechaCambio, '%Y-%m-%d') AS FechaCambio,
                    TIME_FORMAT(h.FechaHoraCambio, '%H:%i:%s') AS HoraCambio
                FROM 
                    HistorialEstadoPagoVacaciones h
                WHERE 
                    h.IdPagoVacaciones = ?
                ORDER BY 
                    h.FechaHoraCambio ASC`;
            
            const historyResult = await connection.query(historyQuery, [pago.Idpagovacas]);
            
            // Añadir el historial al objeto de pago
            const pagoWithHistory = {
                ...pago,
                historial: historyResult || []
            };
            
            reportDataWithHistory.push(pagoWithHistory);
        }
        
        await connection.close();
        
        // Actualizar los datos del reporte
        reportData = reportDataWithHistory;
        reportPagination.filteredData = [...reportData];
        reportPagination.currentPage = 1;
        
        // Renderizar la tabla de resultados
        renderReportTable();
        updateReportPagination();
        
        loadingSwal.close();
        
    } catch (error) {
        console.error('Error al generar reporte:', error);
        loadingSwal.close();
        
        Swal.fire({
            title: 'Error',
            text: 'No se pudo generar el reporte. Por favor intente nuevamente.',
            icon: 'error',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para renderizar la tabla de resultados del reporte
function renderReportTable() {
    const tbody = document.querySelector('#reportTable tbody');
    tbody.innerHTML = '';
    
    const data = reportPagination.filteredData;
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="loading-message">
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h3>No se encontraron resultados</h3>
                        <p>Intente con diferentes filtros o un rango de fechas más amplio.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const start = (reportPagination.currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedData = data.slice(start, end);
    
    paginatedData.forEach(item => {
        // Crear fila principal para el pago
        const row = document.createElement('tr');
        row.className = 'main-row';
        row.setAttribute('data-id', item.Idpagovacas);
        
        // Formatear monto
        const monto = parseFloat(item.TotalaRecibir) || 0;
        
        // Obtener el nombre del estado
        const estadoNombre = ESTADOS[item.Estado]?.nombre || 'Desconocido';
        
        // Determinar si tiene historial para mostrar el toggle
        const tieneHistorial = item.historial && item.historial.length > 0;
        
        row.innerHTML = `
            <td>${formatDate(item.FechaRegistro)}</td>
            <td>${item.NombreColaborador}</td>
            <td>${item.NombreDepartamento}</td>
            <td>${formatPeriodoUsuario(item.Periodo)}</td>
            <td>${item.DiasSolicitado}</td>
            <td>Q ${monto.toFixed(2)}</td>
            <td>
                <span class="status-cell status-${item.Estado}">
                    ${estadoNombre}
                </span>
            </td>
            <td>${item.NoCheque || '-'}</td>
            <td>${item.NoRecibo || '-'}</td>
            <td class="actions-column">
                ${tieneHistorial ? 
                    `<button class="btn-toggle-history" data-id="${item.Idpagovacas}" title="Ver historial de cambios">
                        <i class="fas fa-history"></i>
                    </button>` : 
                    '-'}
            </td>
        `;
        
        tbody.appendChild(row);
        
        // Si tiene historial, crear una fila para mostrar el historial (inicialmente oculta)
        if (tieneHistorial) {
            const historyRow = document.createElement('tr');
            historyRow.className = 'history-row';
            historyRow.id = `history_${item.Idpagovacas}`;
            historyRow.style.display = 'none'; // Inicialmente oculto
            
            // Crear tabla de historial
            let historyHTML = `
                <td colspan="10" class="history-content">
                    <div class="history-title">
                        <i class="fas fa-exchange-alt"></i> Historial de Cambios
                    </div>
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Hora</th>
                                <th>Usuario</th>
                                <th>Estado Anterior</th>
                                <th>Estado Nuevo</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            // Agregar cada entrada del historial
            item.historial.forEach(cambio => {
                const estadoAnteriorNombre = ESTADOS[cambio.EstadoAnterior]?.nombre || 'Desconocido';
                const estadoNuevoNombre = ESTADOS[cambio.EstadoNuevo]?.nombre || 'Desconocido';
                
                historyHTML += `
                    <tr>
                        <td>${formatDate(cambio.FechaCambio)}</td>
                        <td>${cambio.HoraCambio}</td>
                        <td>${cambio.NombreUsuario}</td>
                        <td>
                            <span class="status-cell status-${cambio.EstadoAnterior}">
                                ${estadoAnteriorNombre}
                            </span>
                        </td>
                        <td>
                            <span class="status-cell status-${cambio.EstadoNuevo}">
                                ${estadoNuevoNombre}
                            </span>
                        </td>
                    </tr>
                `;
            });
            
            historyHTML += `
                        </tbody>
                    </table>
                </td>
            `;
            
            historyRow.innerHTML = historyHTML;
            tbody.appendChild(historyRow);
        }
    });
    
    // Agregar eventos para mostrar/ocultar historial
    const toggleButtons = document.querySelectorAll('.btn-toggle-history');
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const historyRow = document.getElementById(`history_${id}`);
            
            if (historyRow) {
                // Toggle visibilidad
                const isVisible = historyRow.style.display !== 'none';
                historyRow.style.display = isVisible ? 'none' : 'table-row';
                
                // Cambiar el ícono
                const icon = this.querySelector('i');
                if (icon) {
                    if (isVisible) {
                        icon.className = 'fas fa-history';
                        this.title = 'Ver historial de cambios';
                    } else {
                        icon.className = 'fas fa-times-circle';
                        this.title = 'Ocultar historial';
                    }
                }
            }
        });
    });
}

// Función para actualizar la paginación del reporte
function updateReportPagination() {
    const data = reportPagination.filteredData;
    const totalPages = Math.ceil(data.length / itemsPerPage) || 1;
    
    document.getElementById('pageIndicatorReport').textContent = `Página ${reportPagination.currentPage} de ${totalPages}`;
    
    const prevButton = document.getElementById('prevPageReport');
    const nextButton = document.getElementById('nextPageReport');
    
    prevButton.disabled = reportPagination.currentPage === 1;
    nextButton.disabled = reportPagination.currentPage === totalPages;
}
// Inicializar eventos
function initEvents() {
    // Eventos para pestañas ya están inicializados en initTabs()
    
    // Evento para el selector de departamento
    const searchDepartmentBtn = document.getElementById('searchDepartmentBtn');
    if (searchDepartmentBtn) {
        searchDepartmentBtn.addEventListener('click', function() {
            const deptId = document.getElementById('departmentSelector')?.value;
            selectedDepartmentId = deptId ? parseInt(deptId) : null;
            loadPendingRequests(selectedDepartmentId);
        });
    }
    
    // Eventos de búsqueda
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterPendientes);
    }
    
    const searchTramiteInput = document.getElementById('searchTramiteInput');
    if (searchTramiteInput) {
        searchTramiteInput.addEventListener('input', filterTramite);
    }
    
    const searchCobrarInput = document.getElementById('searchCobrarInput');
    if (searchCobrarInput) {
        searchCobrarInput.addEventListener('input', filterCobrar);
    }
    
    // Eventos de limpieza de búsqueda
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
                filterPendientes();
            }
        });
    }
    
    const clearTramiteSearchBtn = document.getElementById('clearTramiteSearchBtn');
    if (clearTramiteSearchBtn) {
        clearTramiteSearchBtn.addEventListener('click', function() {
            const searchTramiteInput = document.getElementById('searchTramiteInput');
            if (searchTramiteInput) {
                searchTramiteInput.value = '';
                filterTramite();
            }
        });
    }
    
    const clearCobrarSearchBtn = document.getElementById('clearCobrarSearchBtn');
    if (clearCobrarSearchBtn) {
        clearCobrarSearchBtn.addEventListener('click', function() {
            const searchCobrarInput = document.getElementById('searchCobrarInput');
            if (searchCobrarInput) {
                searchCobrarInput.value = '';
                filterCobrar();
            }
        });
    }
    
    // Mostrar/ocultar botones de limpieza según contenido
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
                clearBtn.style.display = this.value ? 'block' : 'none';
            }
        });
    }
    
    if (searchTramiteInput) {
        searchTramiteInput.addEventListener('input', function() {
            const clearBtn = document.getElementById('clearTramiteSearchBtn');
            if (clearBtn) {
                clearBtn.style.display = this.value ? 'block' : 'none';
            }
        });
    }
    
    if (searchCobrarInput) {
        searchCobrarInput.addEventListener('input', function() {
            const clearBtn = document.getElementById('clearCobrarSearchBtn');
            if (clearBtn) {
                clearBtn.style.display = this.value ? 'block' : 'none';
            }
        });
    }
    
    // Eventos de paginación
    const prevPagePendientes = document.getElementById('prevPagePendientes');
    if (prevPagePendientes) {
        prevPagePendientes.addEventListener('click', function() {
            if (paginationState.pendientes.currentPage > 1) {
                paginationState.pendientes.currentPage--;
                renderPendingTable();
                updatePagination('pendientes');
            }
        });
    }
    
    const nextPagePendientes = document.getElementById('nextPagePendientes');
    if (nextPagePendientes) {
        nextPagePendientes.addEventListener('click', function() {
            const totalPages = Math.ceil(paginationState.pendientes.filteredData.length / itemsPerPage);
            if (paginationState.pendientes.currentPage < totalPages) {
                paginationState.pendientes.currentPage++;
                renderPendingTable();
                updatePagination('pendientes');
            }
        });
    }
    
    const prevPageTramite = document.getElementById('prevPageTramite');
    if (prevPageTramite) {
        prevPageTramite.addEventListener('click', function() {
            if (paginationState.tramite.currentPage > 1) {
                paginationState.tramite.currentPage--;
                renderProcessingTable();
                updatePagination('tramite');
            }
        });
    }
    
    const nextPageTramite = document.getElementById('nextPageTramite');
    if (nextPageTramite) {
        nextPageTramite.addEventListener('click', function() {
            const totalPages = Math.ceil(paginationState.tramite.filteredData.length / itemsPerPage);
            if (paginationState.tramite.currentPage < totalPages) {
                paginationState.tramite.currentPage++;
                renderProcessingTable();
                updatePagination('tramite');
            }
        });
    }
    
    const prevPageCobrar = document.getElementById('prevPageCobrar');
    if (prevPageCobrar) {
        prevPageCobrar.addEventListener('click', function() {
            if (paginationState.cobrar.currentPage > 1) {
                paginationState.cobrar.currentPage--;
                renderCollectingTable();
                updatePagination('cobrar');
            }
        });
    }
    
    const nextPageCobrar = document.getElementById('nextPageCobrar');
    if (nextPageCobrar) {
        nextPageCobrar.addEventListener('click', function() {
            const totalPages = Math.ceil(paginationState.cobrar.filteredData.length / itemsPerPage);
            if (paginationState.cobrar.currentPage < totalPages) {
                paginationState.cobrar.currentPage++;
                renderCollectingTable();
                updatePagination('cobrar');
            }
        });
    }
    
    // Eventos para refrescar datos
    const refreshTramiteBtn = document.getElementById('refreshTramiteBtn');
    if (refreshTramiteBtn) {
        refreshTramiteBtn.addEventListener('click', function() {
            loadProcessingRequests();
        });
    }
    
    const refreshCobrarBtn = document.getElementById('refreshCobrarBtn');
    if (refreshCobrarBtn) {
        refreshCobrarBtn.addEventListener('click', function() {
            loadCollectingRequests();
        });
    }
    
    // Eventos para modales de reportes
    const closeModalButtons = document.querySelectorAll('.close-modal');
    if (closeModalButtons.length > 0) {
        closeModalButtons.forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                // Obtener el modal padre
                const modal = this.closest('.modal');
                if (modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
        }
    });
    
    // Eventos para botones de reportes
    const reportDeptBtn = document.getElementById('reportDeptBtn');
    if (reportDeptBtn) {
        reportDeptBtn.addEventListener('click', function() {
            openReportModal('dept');
        });
    }
    
    const reportHistoryBtn = document.getElementById('reportHistoryBtn');
    if (reportHistoryBtn) {
        reportHistoryBtn.addEventListener('click', function() {
            openReportModal('history');
        });
    }
    
    const reportEmployeeBtn = document.getElementById('reportEmployeeBtn');
    if (reportEmployeeBtn) {
        reportEmployeeBtn.addEventListener('click', function() {
            openReportModal('employee');
        });
    }
    
    const reportStatsBtn = document.getElementById('reportStatsBtn');
    if (reportStatsBtn) {
        reportStatsBtn.addEventListener('click', function() {
            openReportModal('stats');
        });
    }
    
    // Cancelar reporte
    const cancelReportBtn = document.getElementById('cancelReportBtn');
    if (cancelReportBtn) {
        cancelReportBtn.addEventListener('click', function() {
            const reportModal = document.getElementById('reportModal');
            if (reportModal) {
                reportModal.classList.remove('show');
            }
        });
    }
    
    // Generar reporte
    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }
}

// Funciones para controlar las acciones desde botones en la tabla
window.autorizarSolicitud = autorizarSolicitud;
window.anularSolicitud = anularSolicitud;
window.registrarPago = registrarPago;
window.marcarCobrado = marcarCobrado;

// Iniciar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', initApp);