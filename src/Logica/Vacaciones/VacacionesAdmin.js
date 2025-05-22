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
let employeesData = [];
let currentPage = 1;
let itemsPerPage = 10;
let filteredData = [];
let departmentId = null;
let specialDays = [];
let holyWeekDates = [];
let searchTimeout;
let currentSearchResults = [];
let isGeneratingPDF = false;
let isClosingModal = false;

// Variables para el selector de departamentos
let allDepartments = [];
let selectedDepartmentId = null;

// Variables para el calendario
let calendar;
let selectedStartDate = null;
let selectedEndDate = null;
let selectedDays = [];
let fechasRegistradas = [];

// Variables para ordenación
let currentSort = {
    column: null,
    direction: 'asc'
};

// Elementos DOM
const employeesTable = document.getElementById('employeesTable');
const searchInput = document.getElementById('searchInput');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageIndicator = document.getElementById('pageIndicator');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');
const vacationModal = document.getElementById('vacationModal');
const infoModal = document.getElementById('infoModal');
const departmentTotalEl = document.getElementById('departmentTotal');
const pdfGeneratorModal = document.getElementById('pdfGeneratorModal');
const generatePdfBtn = document.getElementById('generatePdfBtn');
const departmentSelector = document.getElementById('departmentSelector');
const searchDepartmentBtn = document.getElementById('searchDepartmentBtn');

// Establecer conexión a la base de datos
async function connectionString() {
    try {
        const connection = await odbc.connect(conexion, {
            binaryAsString: true,
            bigint: 'string'
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

// Inicializar la aplicación (actualizada)
async function initApp() {
    try {
        const loadingSwal = mostrarCargando('Cargando datos...');
        
        // Cargar datos del usuario que inició sesión
        loadUserData();
        
        // Cargar todos los departamentos disponibles
        await loadAllDepartments();
        
        // Cargar fechas de Semana Santa
        loadHolyWeekDates();
        
        // Inicializar los eventos
        initEvents();
        
        // Mostrar mensaje inicial
        showInitialMessage();
        
        loadingSwal.close();
        
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
    selector.innerHTML = '<option value="">-- Seleccione un departamento --</option>';
    
    // Agregar departamentos
    allDepartments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.IdDepartamento;
        option.textContent = dept.NombreDepartamento;
        selector.appendChild(option);
    });
}

// Función para mostrar mensaje inicial
function showInitialMessage() {
    const tbody = document.querySelector('#employeesTable tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="no-department-message">
                <div class="empty-state">
                    <i class="fas fa-building"></i>
                    <h3>Seleccione un departamento</h3>
                    <p>Por favor seleccione un departamento para ver sus colaboradores</p>
                </div>
            </td>
        </tr>
    `;
    
    // Deshabilitar controles hasta que se seleccione un departamento
    disableControls();
}

// Función para habilitar controles
function enableControls() {
    document.getElementById('searchInput').disabled = false;
    document.getElementById('refreshBtn').disabled = false;
    document.getElementById('exportBtn').disabled = false;
    document.getElementById('generatePdfBtn').disabled = false;
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    if (prevPageBtn) prevPageBtn.disabled = false;
    if (nextPageBtn) nextPageBtn.disabled = false;
}

// Función para deshabilitar controles
function disableControls() {
    document.getElementById('searchInput').disabled = true;
    document.getElementById('refreshBtn').disabled = true;
    document.getElementById('exportBtn').disabled = true;
    document.getElementById('generatePdfBtn').disabled = true;
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;
}

// Cargar información del departamento (modificada)
async function loadDepartmentInfo(deptId) {
    try {
        const connection = await connectionString();
        const query = `
            SELECT 
                departamentos.NombreDepartamento,
                COUNT(personal.IdPersonal) AS TotalEmpleados
            FROM 
                departamentos
                LEFT JOIN personal ON departamentos.IdDepartamento = personal.IdSucuDepa
                    AND personal.Estado IN (1, 5) 
                    AND personal.TipoPersonal = 1
            WHERE 
                departamentos.IdDepartamento = ?
            GROUP BY 
                departamentos.NombreDepartamento`;
        
        const result = await connection.query(query, [deptId]);
        await connection.close();
        
        if (result.length > 0) {
            const departmentInfo = result[0];
            document.getElementById('departmentTotal').textContent = departmentInfo.TotalEmpleados || '0';
            
            // Mostrar la información del departamento con animación
            const infoSection = document.getElementById('departmentInfoSection');
            infoSection.style.display = 'block';
            
            // Habilitar controles
            enableControls();
        } else {
            document.getElementById('departmentTotal').textContent = '0';
        }
    } catch (error) {
        console.error('Error al cargar información del departamento:', error);
        throw error;
    }
}

// Cargar empleados del departamento (modificada)
async function loadEmployees(deptId) {
    try {
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
                DATE_FORMAT(personal.FechaPlanilla, '%Y-%m-%d') AS FechaPlanilla,
                personal.IdSucuDepa,
                personal.IdPlanilla,
                personal.DiasMinVacaciones,
                TIMESTAMPDIFF(YEAR, personal.FechaPlanilla, CURDATE()) AS AniosCumplidos,
                (TIMESTAMPDIFF(YEAR, personal.FechaPlanilla, CURDATE()) * 15) - 
                    IFNULL((SELECT COUNT(*) FROM vacacionestomadas WHERE IdPersonal = personal.IdPersonal), 0) -
                    IFNULL((SELECT SUM(CAST(DiasSolicitado AS UNSIGNED)) FROM vacacionespagadas 
                            WHERE IdPersonal = personal.IdPersonal AND Estado IN (1,2,3,4)), 0)
                AS DiasVacaciones,
                Puestos.Nombre,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM
                personal
                INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                LEFT JOIN FotosPersonal ON personal.IdPersonal = FotosPersonal.IdPersonal
            WHERE
                personal.IdSucuDepa = ? AND
                personal.Estado IN (1, 5) AND
                personal.TipoPersonal = 1
            ORDER BY 
                personal.PrimerNombre, personal.PrimerApellido`;
        
        const result = await connection.query(query, [deptId]);
        await connection.close();
        
        if (result.length > 0) {
            employeesData = result;
            filteredData = [...employeesData];
            
            // Resetear a la primera página
            currentPage = 1;
            
            renderEmployeesTable();
            updatePagination();
        } else {
            employeesData = [];
            filteredData = [];
            document.querySelector('#employeesTable tbody').innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px;">
                        <i class="fas fa-info-circle" style="font-size: 24px; color: #FF9800; margin-bottom: 10px;"></i>
                        <p>No hay colaboradores registrados en este departamento.</p>
                    </td>
                </tr>
            `;
            updatePagination();
        }
    } catch (error) {
        console.error('Error al cargar empleados:', error);
        throw error;
    }
}

// Función para cargar días especiales (modificada)
async function loadSpecialDays() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT 
                Dia, 
                Mes, 
                IdDepartamento, 
                Descripcion 
            FROM 
                DiasEspeciales 
            WHERE 
                IdDepartamento = 0 OR IdDepartamento = ?
        `;
        
        // Usar el departamento seleccionado
        const result = await connection.query(query, [selectedDepartmentId]);
        await connection.close();
        
        if (result.length > 0) {
            specialDays = result.map(day => ({
                day: parseInt(day.Dia),
                month: parseInt(day.Mes),
                departmentId: parseInt(day.IdDepartamento),
                description: day.Descripcion
            }));
            
            if (calendar) {
                calendar.refetchEvents();
            }
        }
    } catch (error) {
        console.error('Error al cargar días especiales:', error);
    }
}

// Función para calcular la fecha de Pascua (Domingo de Resurrección)
function calculateEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    return new Date(year, month, day);
}

// Función para obtener todas las fechas de Semana Santa
function getHolyWeekDates(year) {
    const easterSunday = calculateEaster(year);
    const holyWeekDates = [];
    
    const palmSunday = new Date(easterSunday);
    palmSunday.setDate(easterSunday.getDate() - 7);
    
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(palmSunday);
        currentDate.setDate(palmSunday.getDate() + i);
        holyWeekDates.push({
            date: currentDate,
            description: getHolyWeekDayName(i)
        });
    }
    
    return holyWeekDates;
}

// Función para obtener el nombre del día de Semana Santa
function getHolyWeekDayName(dayIndex) {
    const dayNames = [
        "Domingo de Ramos",
        "Lunes Santo",
        "Martes Santo",
        "Miércoles Santo",
        "Jueves Santo",
        "Viernes Santo",
        "Sábado Santo"
    ];
    
    return dayNames[dayIndex] || "Semana Santa";
}

// Función para cargar las fechas de Semana Santa del año actual
function loadHolyWeekDates() {
    const currentYear = new Date().getFullYear();
    holyWeekDates = getHolyWeekDates(currentYear);
    
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 10) {
        const nextYearDates = getHolyWeekDates(currentYear + 1);
        holyWeekDates = [...holyWeekDates, ...nextYearDates];
    }
}

// Función para verificar si una fecha es día especial
function isSpecialDay(date) {
    if (!date || !specialDays || specialDays.length === 0) return false;
    
    const day = date.getDate();
    const month = date.getMonth() + 1;
    
    return specialDays.some(specialDay => 
        specialDay.day === day && specialDay.month === month
    );
}

// Función para obtener la descripción de un día especial
function getSpecialDayDescription(date) {
    if (!date || !specialDays || specialDays.length === 0) return '';
    
    const day = date.getDate();
    const month = date.getMonth() + 1;
    
    const specialDay = specialDays.find(sd => 
        sd.day === day && sd.month === month
    );
    
    return specialDay ? specialDay.description : '';
}

// Función para verificar si una fecha es día de Semana Santa
function isHolyWeekDay(date) {
    if (!date || !holyWeekDates || holyWeekDates.length === 0) return false;
    
    return holyWeekDates.some(holyDate => 
        holyDate.date.getDate() === date.getDate() && 
        holyDate.date.getMonth() === date.getMonth() && 
        holyDate.date.getFullYear() === date.getFullYear()
    );
}

// Función para obtener la descripción de un día de Semana Santa
function getHolyWeekDescription(date) {
    if (!date || !holyWeekDates || holyWeekDates.length === 0) return '';
    
    const holyDate = holyWeekDates.find(hd => 
        hd.date.getDate() === date.getDate() && 
        hd.date.getMonth() === date.getMonth() && 
        hd.date.getFullYear() === date.getFullYear()
    );
    
    return holyDate ? holyDate.description : '';
}

// Renderizar tabla de empleados
function renderEmployeesTable() {
    const tbody = document.querySelector('#employeesTable tbody');
    tbody.innerHTML = '';
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const currentPageData = filteredData.slice(start, end);
    
    if (currentPageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px;">
                    <i class="fas fa-search" style="font-size: 24px; color: #FF9800; margin-bottom: 10px;"></i>
                    <p>No se encontraron colaboradores que coincidan con su búsqueda.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    currentPageData.forEach(employee => {
        const fullName = getFullName(employee);
        const hireDate = formatDate(employee.FechaPlanilla);
        const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
        const isCurrentUser = employee.IdPersonal === userData.IdPersonal;
        
        const row = document.createElement('tr');
        row.setAttribute('data-id', employee.IdPersonal);
        
        if (isCurrentUser) {
            row.classList.add('current-user-row');
        }
        
        row.classList.add('animate-in');
        row.style.animationDelay = `${(currentPageData.indexOf(employee) * 0.05)}s`;

        let actionsCell = '';
                
        if (isCurrentUser) {
            // Para el usuario actual, mostrar un mensaje indicando que no puede solicitar vacaciones para sí mismo
            actionsCell = `
                <div class="user-actions-disabled">
                    <span class="user-actions-message tooltip">
                        <i class="fas fa-user-lock"></i> No disponible
                        <span class="tooltip-text">No puede solicitar vacaciones para usted mismo</span>
                    </span>
                </div>
            `;
        } else {
            // Para otros usuarios, mostrar los botones de acción normales
            actionsCell = `
                <div class="action-buttons">
                    <button class="btn-action btn-request" title="Solicitar vacaciones" onclick="openVacationModal(${employee.IdPersonal})">
                        <i class="fas fa-calendar-plus"></i>
                    </button>
                    <button class="btn-action btn-info" title="Ver información" onclick="openInfoModal(${employee.IdPersonal})">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            `;
        }
        
        let diasDisponiblesStyle = '';
        
        if (employee.DiasVacaciones === null || employee.DiasVacaciones <= 0) {
            diasDisponiblesStyle = `<div class="days-count" style="background-color: #FF5252;">0 días</div>`;
        } else if (employee.DiasVacaciones < 30) {
            diasDisponiblesStyle = `<div class="days-count" style="background-color: #FF9800;">${employee.DiasVacaciones} días</div>`;
        } else if (employee.DiasVacaciones < 60) {
            diasDisponiblesStyle = `<div class="days-count" style="background-color: #FFC107;">${employee.DiasVacaciones} días</div>`;
        } else {
            diasDisponiblesStyle = `<div class="days-count" style="background-color: #4CAF50;">${employee.DiasVacaciones} días</div>`;
        }
        
        row.innerHTML = `
            <td>
                <div class="employee-photo-cell">
                    <img src="${photoSrc}" alt="${fullName}" loading="lazy">
                </div>
            </td>
            <td>${fullName}${isCurrentUser ? ' <span class="current-user-badge">Usted</span>' : ''}</td>
            <td>${hireDate}</td>
            <td>${employee.AniosCumplidos} años</td>
            <td style="text-align: center;">${diasDisponiblesStyle}</td>
            <td>${employee.Nombre || 'Sin puesto'}</td>
            <td>${actionsCell}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    updateSortIndicators();
}

// Actualizar paginación
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    
    if (prevButton) {
        prevButton.disabled = currentPage === 1 || filteredData.length === 0;
    }
    
    if (nextButton) {
        nextButton.disabled = currentPage === totalPages || filteredData.length === 0;
    }
}

// Función para filtrar los datos
function filterData() {
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    
    filteredData = employeesData.filter(employee => {
        const fullName = getFullName(employee).toLowerCase();
        const position = (employee.Nombre || '').toLowerCase();
        
        return fullName.includes(searchTerm) || position.includes(searchTerm);
    });
    
    currentPage = 1;
    
    if (currentSort.column) {
        sortData(currentSort.column, false);
    } else {
        renderEmployeesTable();
        updatePagination();
    }
}
// Función para ordenar datos
function sortData(column, toggleDirection = true) {
    if (toggleDirection && currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        if (toggleDirection || !currentSort.direction) {
            currentSort.direction = 'asc';
        }
    }
    
    filteredData.sort((a, b) => {
        let valueA, valueB;
        
        switch (column) {
            case 'name':
                valueA = getFullName(a).toLowerCase();
                valueB = getFullName(b).toLowerCase();
                break;
            case 'hireDate':
                valueA = new Date(a.FechaPlanilla || 0).getTime();
                valueB = new Date(b.FechaPlanilla || 0).getTime();
                break;
            case 'years':
                valueA = parseInt(a.AniosCumplidos || 0);
                valueB = parseInt(b.AniosCumplidos || 0);
                break;
            case 'days':
                valueA = parseInt(a.DiasVacaciones || 0);
                valueB = parseInt(b.DiasVacaciones || 0);
                break;
            case 'position':
                valueA = (a.Nombre || '').toLowerCase();
                valueB = (b.Nombre || '').toLowerCase();
                break;
            default:
                return 0;
        }
        
        const sortFactor = currentSort.direction === 'asc' ? 1 : -1;
        
        if (valueA < valueB) return -1 * sortFactor;
        if (valueA > valueB) return 1 * sortFactor;
        return 0;
    });
    
    updateSortIndicators();
    renderEmployeesTable();
    updatePagination();
}

// Actualizar indicadores visuales de ordenamiento
function updateSortIndicators() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    if (currentSort.column) {
        const th = document.querySelector(`th[data-sort="${currentSort.column}"]`);
        if (th) {
            th.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }
}

// Formatear fecha para la base de datos (YYYY-MM-DD)
function formatFechaBaseDatos(fecha) {
    if (!fecha) return '';
    
    if (typeof fecha === 'string') {
        fecha = new Date(fecha);
    }
    
    if (!(fecha instanceof Date) || isNaN(fecha)) {
        console.error('Fecha inválida:', fecha);
        return '';
    }
    
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Función para limpiar el modal de elementos duplicados
function clearVacationModal() {
    const elementsToRemove = [
        '.min-days-info',
        '.periodos-container',
        '.days-note-container',
        '.vacation-info-container'
    ];
    
    elementsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
    });
}

// Función para obtener las fechas de vacaciones ya registradas
async function obtenerFechasRegistradas(idPersonal) {
    try {
        const connection = await connectionString();
        const query = `
            SELECT DATE_FORMAT(FechasTomadas, '%Y-%m-%d') as FechaFormateada
            FROM vacacionestomadas 
            WHERE IdPersonal = ?
        `;
        
        const result = await connection.query(query, [idPersonal]);
        await connection.close();
        
        const fechasRegistradas = result.map(row => row.FechaFormateada);
        
        return fechasRegistradas;
    } catch (error) {
        console.error('Error al obtener fechas registradas:', error);
        throw error;
    }
}

// Función para verificar cuántos días de vacaciones se han tomado en un período
async function verificarDiasUtilizados(idPersonal, periodo) {
    try {
        const connection = await connectionString();
        const query = `
            SELECT COUNT(*) as DiasUtilizados
            FROM vacacionestomadas
            WHERE IdPersonal = ? AND Periodo = ?
        `;
        
        const result = await connection.query(query, [idPersonal, periodo]);
        await connection.close();
        
        if (result.length > 0) {
            return parseInt(result[0].DiasUtilizados) || 0;
        }
        
        return 0;
    } catch (error) {
        console.error('Error al verificar días utilizados:', error);
        throw error;
    }
}

// Función para calcular el período basado en la fecha de planilla
function calcularPeriodo(fechaPlanilla, offsetAnios = 0) {
    const fechaInicioPlanilla = new Date(fechaPlanilla);
    const fechaInicioPrimerPeriodo = new Date(fechaInicioPlanilla);
    fechaInicioPrimerPeriodo.setDate(fechaInicioPrimerPeriodo.getDate() + 1);
    
    const fechaInicioPeriodo = new Date(fechaInicioPrimerPeriodo);
    fechaInicioPeriodo.setFullYear(fechaInicioPrimerPeriodo.getFullYear() + offsetAnios);
    
    const fechaFinPeriodo = new Date(fechaInicioPeriodo);
    fechaFinPeriodo.setFullYear(fechaFinPeriodo.getFullYear() + 1);
    fechaFinPeriodo.setDate(fechaFinPeriodo.getDate() - 1);
    
    const formatoInicio = formatFechaBaseDatos(fechaInicioPeriodo);
    const formatoFin = formatFechaBaseDatos(fechaFinPeriodo);
    
    return `${formatoInicio} al ${formatoFin}`;
}

// Función actualizada para obtener información detallada de todos los períodos disponibles
async function obtenerPeriodosDisponibles(empleado) {
    const fechaPlanilla = empleado.FechaPlanilla;
    const aniosCumplidos = parseInt(empleado.AniosCumplidos);
    
    let periodos = [];
    let totalDiasDisponibles = 0;
    
    try {
        const connection = await connectionString();
        
        for (let i = 0; i <= aniosCumplidos; i++) {
            const periodo = calcularPeriodo(fechaPlanilla, i);
            
            const queryDiasTomados = `
                SELECT COUNT(*) as DiasUtilizados
                FROM vacacionestomadas
                WHERE IdPersonal = ? AND Periodo = ?
            `;
            const resultDiasTomados = await connection.query(queryDiasTomados, [empleado.IdPersonal, periodo]);
            
            const queryDiasPagados = `
                SELECT IFNULL(SUM(CAST(DiasSolicitado AS UNSIGNED)), 0) as DiasPagados
                FROM vacacionespagadas
                WHERE IdPersonal = ? AND Periodo = ? AND Estado IN (1,2,3,4)
            `;
            const resultDiasPagados = await connection.query(queryDiasPagados, [empleado.IdPersonal, periodo]);
            
            let diasUtilizados = 0;
            if (resultDiasTomados && resultDiasTomados[0].DiasUtilizados) {
                const valor = resultDiasTomados[0].DiasUtilizados;
                diasUtilizados = typeof valor === 'bigint' ? Number(valor) : parseInt(valor) || 0;
            }
            
            let diasPagados = 0;
            if (resultDiasPagados && resultDiasPagados[0].DiasPagados) {
                const valor = resultDiasPagados[0].DiasPagados;
                diasPagados = typeof valor === 'bigint' ? Number(valor) : parseInt(valor) || 0;
            }
            
            const diasDisponiblesPeriodo = Math.max(0, 15 - diasUtilizados - diasPagados);
            
            if (diasDisponiblesPeriodo > 0) {
                periodos.push({
                    periodo: periodo,
                    diasDisponibles: diasDisponiblesPeriodo,
                    diasUtilizados: diasUtilizados,
                    diasPagados: diasPagados
                });
            }
            
            totalDiasDisponibles += diasDisponiblesPeriodo;
        }
        
        await connection.close();
        
        if (periodos.length === 0) {
            const siguientePeriodo = calcularPeriodo(fechaPlanilla, aniosCumplidos + 1);
            periodos.push({
                periodo: siguientePeriodo,
                diasDisponibles: 15,
                diasUtilizados: 0,
                diasPagados: 0
            });
            totalDiasDisponibles = 15;
        }
        
        return {
            periodos: periodos,
            totalDiasDisponibles: totalDiasDisponibles
        };
    } catch (error) {
        console.error('Error al obtener períodos disponibles:', error);
        throw error;
    }
}

// Función auxiliar para formatear el período para mostrar al usuario
function formatPeriodoUsuario(periodo) {
    if (!periodo) return '';
    
    const partes = periodo.split(' al ');
    if (partes.length === 2) {
        try {
            // Parsear las fechas manualmente para evitar problemas de zona horaria
            const fechaInicio = partes[0]; // formato: YYYY-MM-DD
            const fechaFin = partes[1];    // formato: YYYY-MM-DD
            
            // Extraer componentes de fechaInicio
            const [anioInicio, mesInicio, diaInicio] = fechaInicio.split('-').map(num => String(num).padStart(2, '0'));
            
            // Extraer componentes de fechaFin
            const [anioFin, mesFin, diaFin] = fechaFin.split('-').map(num => String(num).padStart(2, '0'));
            
            // Formatear como DD-MM-YYYY al DD-MM-YYYY
            return `${diaInicio}-${mesInicio}-${anioInicio} al ${diaFin}-${mesFin}-${anioFin}`;
        } catch (error) {
            console.error('Error al formatear período:', error);
        }
    }
    
    return periodo;
}

// Abrir modal de solicitud de vacaciones
async function openVacationModal(employeeId) {
    if (employeeId === userData.IdPersonal) {
        Swal.fire({
            icon: 'error',
            title: 'Operación no permitida',
            text: 'No puede solicitar vacaciones para usted mismo.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }

    const employee = employeesData.find(emp => emp.IdPersonal === employeeId);
    
    if (!employee) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró información del colaborador.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    const loadingSwal = mostrarCargando('Verificando información...');
    
    try {
        const periodosInfo = await obtenerPeriodosDisponibles(employee);
        const totalDiasDisponibles = periodosInfo.totalDiasDisponibles;
        const totalDiasAcumulados = parseInt(employee.DiasVacaciones || 0);
        
        fechasRegistradas = await obtenerFechasRegistradas(employeeId);
        
        loadingSwal.close();
        
        if (totalDiasDisponibles <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin días disponibles',
                html: `<p>El colaborador no tiene días de vacaciones disponibles.</p>`,
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        clearVacationModal();
        
        const fullName = getFullName(employee);
        
        document.getElementById('modalEmployeeName').textContent = fullName;
        document.getElementById('modalEmployeePosition').textContent = employee.Nombre || 'Sin puesto asignado';
        document.getElementById('modalAvailableDays').textContent = totalDiasAcumulados;
        
        const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
        document.getElementById('modalEmployeePhoto').src = photoSrc;
        
        const infoContainer = document.createElement('div');
        infoContainer.className = 'vacation-info-container';
        
        const diasMinimos = parseInt(employee.DiasMinVacaciones || 0);
        if (diasMinimos > 0) {
            const minDaysInfo = document.createElement('div');
            minDaysInfo.className = 'min-days-info';
            minDaysInfo.innerHTML = `<i class="fas fa-info-circle"></i> Mínimo: ${diasMinimos} días por solicitud`;
            
            if (totalDiasDisponibles < diasMinimos) {
                minDaysInfo.innerHTML += `<div class="min-days-note">Tiene menos días disponibles que el mínimo requerido. Se le permitirá tomar los ${totalDiasDisponibles} días restantes.</div>`;
            }
            
            infoContainer.appendChild(minDaysInfo);
        }
        
        if (periodosInfo.periodos.length > 0) {
            const periodosContainer = document.createElement('div');
            periodosContainer.className = 'periodos-container';
            
            periodosInfo.periodos.forEach(periodo => {
                const periodoInfo = document.createElement('div');
                periodoInfo.className = 'periodo-info-item';
                periodosContainer.appendChild(periodoInfo);
            });
            
            infoContainer.appendChild(periodosContainer);
        }
        
        const infoPlaceholder = document.querySelector('.employee-info');
        if (infoPlaceholder) {
            infoPlaceholder.appendChild(infoContainer);
        }
        
        selectedStartDate = null;
        selectedEndDate = null;
        selectedDays = [];
        document.getElementById('selectedStartDate').textContent = "No seleccionado";
        document.getElementById('selectedEndDate').textContent = "No seleccionado";
        document.getElementById('selectedDays').textContent = "0 días";
        
        document.getElementById('daysVisual').innerHTML = '';
        
        document.getElementById('vacationForm').setAttribute('data-employee-id', employeeId);
        
        if (periodosInfo.periodos.length > 0) {
            document.getElementById('vacationForm').setAttribute('data-periodo', periodosInfo.periodos[0].periodo);
        }
        
        vacationModal.style.display = 'block';
        setTimeout(() => {
            vacationModal.classList.add('show');
            initCalendar();
            
            if (calendar) {
                calendar.updateSize();
            }
        }, 10);
        
    } catch (error) {
        console.error('Error al abrir modal de vacaciones:', error);
        loadingSwal.close();
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al verificar la información del colaborador. Por favor intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Inicializar el calendario
function initCalendar() {
    const calendarEl = document.getElementById('vacationCalendar');
    
    if (calendar) {
        calendar.destroy();
    }
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        selectable: true,
        locale: 'es',
        height: 'auto',
        contentHeight: 'auto',
        fixedWeekCount: false,
        showNonCurrentDates: true,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: ''
        },
        dateClick: function(info) {
            const fechaSeleccionada = formatFechaBaseDatos(info.date);
            if (fechasRegistradas.includes(fechaSeleccionada)) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Fecha no disponible',
                    text: 'Esta fecha ya ha sido registrada como vacaciones para este colaborador.',
                    confirmButtonColor: '#FF9800'
                });
                return;
            }

            const clickedDate = info.date;
            handleDateSelection(clickedDate, clickedDate);
        },
        select: function(info) {
            let fechasNoDisponibles = [];
            let currentDate = new Date(info.start);
            
            while (currentDate < info.end) {
                const fechaStr = formatFechaBaseDatos(currentDate);
                if (fechasRegistradas.includes(fechaStr)) {
                    fechasNoDisponibles.push(formatDate(currentDate));
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            if (fechasNoDisponibles.length > 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Fechas no disponibles',
                    html: `
                        <p>Las siguientes fechas ya están registradas como vacaciones:</p>
                        <ul style="text-align: left; margin-top: 10px;">
                            ${fechasNoDisponibles.map(fecha => `<li>${fecha}</li>`).join('')}
                        </ul>
                        <p style="margin-top: 10px;">Por favor seleccione un rango diferente.</p>
                    `,
                    confirmButtonColor: '#FF9800'
                });
                calendar.unselect();
                return;
            }
            
            handleDateSelection(info.start, info.end);
        },
        selectAllow: function(selectInfo) {
            return selectInfo.start >= new Date();
        },
        dayCellClassNames: function(arg) {
            const date = arg.date;
            const day = date.getDay();
            const dateStr = formatFechaBaseDatos(date);
            const classes = [];
            
            if (day === 0 || day === 6) {
                classes.push('weekend-day');
            }
            
            if (isSpecialDay(date)) {
                classes.push('special-day');
            }
            
            if (isHolyWeekDay(date)) {
                classes.push('holy-week-day');
            }
            
            if (fechasRegistradas.includes(dateStr)) {
                classes.push('registered-vacation-day');
            }
            
            return classes;
        }
    });
    
    calendar.render();
    
    const calendarContainer = document.querySelector('.calendar-container');
    calendarContainer.classList.add('full-calendar-view');
    
    setTimeout(() => {
        calendar.updateSize();
    }, 100);
}

// Manejar la selección de fechas con validación
function handleDateSelection(start, end) {
    let currentDate = new Date(start);
    let fechasInvalidas = [];
    
    while (currentDate <= end) {
        const fechaStr = formatFechaBaseDatos(currentDate);
        if (fechasRegistradas.includes(fechaStr)) {
            fechasInvalidas.push(formatDate(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (fechasInvalidas.length > 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Selección no válida',
            html: `
                <p>Su selección incluye fechas que ya están registradas:</p>
                <ul style="text-align: left; margin-top: 10px;">
                    ${fechasInvalidas.map(fecha => `<li>${fecha}</li>`).join('')}
                </ul>
                <p style="margin-top: 10px;">Por favor seleccione un rango diferente.</p>
            `,
            confirmButtonColor: '#FF9800'
        });
        calendar.unselect();
        return;
    }
    
    let adjustedEnd;
    
    if (start.getTime() === end.getTime() || 
        (end.getTime() - start.getTime() === 86400000 && start.getDate() === end.getDate() - 1)) {
        adjustedEnd = new Date(start);
    } else {
        adjustedEnd = new Date(end);
        adjustedEnd.setDate(adjustedEnd.getDate() - 1);
    }
    
    selectedStartDate = new Date(start);
    selectedEndDate = new Date(adjustedEnd);
    
    const startFormatted = formatDate(selectedStartDate);
    const endFormatted = formatDate(selectedEndDate);
    
    document.getElementById('selectedStartDate').textContent = startFormatted;
    document.getElementById('selectedEndDate').textContent = endFormatted;
    
    calculateWorkingDays();
    renderDaysVisualization();
    verificarDiasMinimos();
}

// Calcular días hábiles
function calculateWorkingDays() {
    if (!selectedStartDate || !selectedEndDate) {
        document.getElementById('selectedDays').textContent = "0 días";
        return;
    }
    
    selectedDays = [];
    let currentDate = new Date(selectedStartDate);
    
    while (currentDate <= selectedEndDate) {
        const dayOfWeek = currentDate.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isSpecialDayFlag = isSpecialDay(currentDate);
        const isHolyWeekDayFlag = isHolyWeekDay(currentDate);
        const fechaStr = formatFechaBaseDatos(currentDate);
        const isRegistered = fechasRegistradas.includes(fechaStr);
        
        selectedDays.push({
            date: new Date(currentDate),
            isWeekend: isWeekend,
            isSpecial: isSpecialDayFlag,
            isHolyWeek: isHolyWeekDayFlag,
            isRegistered: isRegistered,
            isVacation: !isWeekend && !isSpecialDayFlag && !isHolyWeekDayFlag && !isRegistered
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const workingDays = selectedDays.filter(day => 
        !day.isWeekend && !day.isSpecial && !day.isHolyWeek && !day.isRegistered).length;
    
    document.getElementById('selectedDays').textContent = `${workingDays} días`;
}

// Función para verificar si se cumple el mínimo de días requeridos
function verificarDiasMinimos() {
    const employeeId = parseInt(document.getElementById('vacationForm').getAttribute('data-employee-id'));
    
    const employee = employeesData.find(emp => emp.IdPersonal === employeeId);
    if (!employee) return;
    
    const diasMinimos = parseInt(employee.DiasMinVacaciones || 0);
    if (diasMinimos <= 0) return;
    
    const workingDays = selectedDays.filter(day => 
        !day.isWeekend && !day.isSpecial && !day.isHolyWeek && !day.isRegistered).length;
    
    const totalDaysElement = document.getElementById('selectedDays');
    
    const diasDisponibles = parseInt(document.getElementById('modalAvailableDays').textContent || 0);
    
    if (workingDays === 0) {
        totalDaysElement.classList.remove('days-warning', 'days-success');
        totalDaysElement.removeAttribute('data-tooltip');
    } else if (workingDays < diasMinimos && diasDisponibles >= diasMinimos) {
        totalDaysElement.classList.add('days-warning');
        totalDaysElement.classList.remove('days-success');
        totalDaysElement.setAttribute('data-tooltip', `Debe seleccionar al menos ${diasMinimos} días`);
    } else if (workingDays < diasMinimos && diasDisponibles < diasMinimos && workingDays === diasDisponibles) {
        totalDaysElement.classList.remove('days-warning');
        totalDaysElement.classList.add('days-success');
        totalDaysElement.setAttribute('data-tooltip', `Tomando todos los días disponibles`);
    } else if (workingDays < diasMinimos && diasDisponibles < diasMinimos && workingDays < diasDisponibles) {
        totalDaysElement.classList.add('days-warning');
        totalDaysElement.classList.remove('days-success');
        totalDaysElement.setAttribute('data-tooltip', `Debe tomar todos los ${diasDisponibles} días disponibles`);
    } else {
        totalDaysElement.classList.remove('days-warning');
        totalDaysElement.classList.add('days-success');
        totalDaysElement.setAttribute('data-tooltip', `Cumple con el mínimo requerido`);
    }
}
// Crear visualización de días seleccionados
function renderDaysVisualization() {
    const daysVisualEl = document.getElementById('daysVisual');
    daysVisualEl.innerHTML = '';
    
    if (selectedDays.length === 0) {
        daysVisualEl.innerHTML = '<p class="no-days">No hay días seleccionados.</p>';
        return;
    }
    
    const workingDays = selectedDays.filter(day => 
        !day.isWeekend && !day.isSpecial && !day.isHolyWeek && !day.isRegistered);
    const weekendDays = selectedDays.filter(day => day.isWeekend);
    const specialDaysFiltered = selectedDays.filter(day => day.isSpecial);
    const holyWeekDaysFiltered = selectedDays.filter(day => day.isHolyWeek);
    const registeredDays = selectedDays.filter(day => day.isRegistered);
    
    if (workingDays.length > 0) {
        const workdaysContainer = document.createElement('div');
        workdaysContainer.className = 'mini-days-container';
        
        workingDays.forEach((day, index) => {
            const dayBox = document.createElement('div');
            dayBox.className = 'day-box vacation';
            dayBox.textContent = day.date.getDate();
            
            if (index < 10) {
                workdaysContainer.appendChild(dayBox);
            }
        });
        
        if (workingDays.length > 10) {
            const moreIndicator = document.createElement('div');
            moreIndicator.className = 'day-box more-indicator';
            moreIndicator.textContent = '+' + (workingDays.length - 10);
            workdaysContainer.appendChild(moreIndicator);
        }
        
        daysVisualEl.appendChild(workdaysContainer);
    } else {
        daysVisualEl.innerHTML = '<p class="no-days">No hay días hábiles seleccionados.</p>';
    }
    
    const summaryContainer = document.createElement('div');
    summaryContainer.className = 'mini-summary';
    summaryContainer.innerHTML = `
        <div class="mini-summary-item">
            <i class="fas fa-calendar-check"></i> ${workingDays.length} hábiles
        </div>
        ${weekendDays.length > 0 ? `
        <div class="mini-summary-item">
            <i class="fas fa-calendar-times"></i> ${weekendDays.length} fin de semana
        </div>
        ` : ''}
        ${specialDaysFiltered.length > 0 ? `
        <div class="mini-summary-item">
            <i class="fas fa-calendar-day"></i> ${specialDaysFiltered.length} especiales
        </div>
        ` : ''}
        ${holyWeekDaysFiltered.length > 0 ? `
        <div class="mini-summary-item">
            <i class="fas fa-church"></i> ${holyWeekDaysFiltered.length} Semana Santa
        </div>
        ` : ''}
        ${registeredDays.length > 0 ? `
        <div class="mini-summary-item registered-item">
            <i class="fas fa-check-circle"></i> ${registeredDays.length} ya registrados
        </div>
        ` : ''}
    `;
    
    daysVisualEl.appendChild(summaryContainer);
}

// Guardar los días de vacaciones en la base de datos
async function guardarDiasVacaciones(empleado, diasSeleccionados, periodosDisponibles) {
    try {
        const connection = await connectionString();
        
        const nombreCompleto = getFullName(empleado);
        const idUsuario = userData.IdPersonal;
        const nombreUsuario = userData.NombreCompleto;
        
        const query = `
            INSERT INTO vacacionestomadas 
            (IdPersonal, NombrePersonal, Periodo, IdPlanilla, IdDepartamento, FechasTomadas, IdUsuario, NombreUsuario)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const diasValidos = diasSeleccionados.filter(day => day.isVacation);
        
        if (diasValidos.length === 0) {
            return true;
        }
        
        const periodos = periodosDisponibles.periodos;
        
        let diasAsignados = 0;
        let periodoActual = 0;
        
        while (diasAsignados < diasValidos.length && periodoActual < periodos.length) {
            const periodoInfo = periodos[periodoActual];
            const diasDisponiblesEnPeriodo = periodoInfo.diasDisponibles;
            
            const diasAAsignar = Math.min(diasDisponiblesEnPeriodo, diasValidos.length - diasAsignados);
            
            for (let i = 0; i < diasAAsignar; i++) {
                const diaSeleccionado = diasValidos[diasAsignados + i];
                const fechaFormateada = formatFechaBaseDatos(diaSeleccionado.date);
                
                await connection.query(query, [
                    empleado.IdPersonal,
                    nombreCompleto,
                    periodoInfo.periodo,
                    empleado.IdPlanilla,
                    empleado.IdSucuDepa,
                    fechaFormateada,
                    idUsuario,
                    nombreUsuario
                ]);
            }
            
            diasAsignados += diasAAsignar;
            periodoActual++;
        }
        
        await connection.close();
        
        // Verificar si algún período se completó
        for (const periodo of periodosDisponibles.periodos) {
            const estaCompleto = await verificarPeriodoCompleto(empleado, periodo.periodo);
            
            if (estaCompleto) {
                await generarPDFPeriodoCompleto(empleado, periodo.periodo);
                
                await Swal.fire({
                    icon: 'info',
                    title: 'Período Completado',
                    html: `
                        <p>El período ${formatPeriodoUsuario(periodo.periodo)} ha sido completado.</p>
                        <p>Se ha generado automáticamente la ficha de control.</p>
                    `,
                    confirmButtonColor: '#4CAF50'
                });
            }
        }
        
        await actualizarDiasDisponibles(empleado.IdPersonal);
        
        return true;
        
    } catch (error) {
        console.error('Error al guardar días de vacaciones:', error);
        throw error;
    }
}

// Función para guardar solicitud de vacaciones
async function guardarSolicitudVacaciones(event) {
    event.preventDefault();
    
    const employeeId = parseInt(document.getElementById('vacationForm').getAttribute('data-employee-id'));
    
    if (employeeId === userData.IdPersonal) {
        Swal.fire({
            icon: 'error',
            title: 'Operación no permitida',
            text: 'No puede solicitar vacaciones para usted mismo.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }

    if (!selectedStartDate || !selectedEndDate) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas no seleccionadas',
            text: 'Por favor seleccione las fechas de vacaciones en el calendario.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    const workingDays = selectedDays.filter(day => 
        !day.isWeekend && !day.isSpecial && !day.isHolyWeek && !day.isRegistered).length;
    
    if (workingDays === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin días hábiles',
            text: 'El periodo seleccionado no contiene días hábiles disponibles para vacaciones.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    const employee = employeesData.find(emp => emp.IdPersonal === employeeId);
    if (!employee) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró información del colaborador.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    try {
        const periodosInfo = await obtenerPeriodosDisponibles(employee);
        
        if (periodosInfo.totalDiasDisponibles < workingDays) {
            Swal.fire({
                icon: 'error',
                title: 'Días insuficientes',
                html: `
                    <p>El colaborador solo tiene <strong>${periodosInfo.totalDiasDisponibles}</strong> días disponibles en total.</p>
                `,
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        let distribucionPeriodos = "";
        let diasRestantes = workingDays;
        let periodoDistribucion = [];
        
        for (const periodoInfo of periodosInfo.periodos) {
            if (diasRestantes <= 0) break;
            
            const diasAAsignar = Math.min(periodoInfo.diasDisponibles, diasRestantes);
            if (diasAAsignar > 0) {
                periodoDistribucion.push({
                    periodo: periodoInfo.periodo,
                    dias: diasAAsignar
                });
                diasRestantes -= diasAAsignar;
            }
        }
        
        if (periodoDistribucion.length > 1) {
            distribucionPeriodos = `
                <div class="distribucion-periodos">
                    <p>Los días seleccionados se distribuirán de la siguiente manera:</p>
                    <ul>
                        ${periodoDistribucion.map(pd => `
                            <li><strong>${formatPeriodoUsuario(pd.periodo)}:</strong> ${pd.dias} días</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        
        const diasMinimos = parseInt(employee.DiasMinVacaciones || 0);
        
        if (diasMinimos > 0) {
            if (workingDays < diasMinimos && periodosInfo.totalDiasDisponibles >= diasMinimos) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Días insuficientes',
                    html: `
                        <p>Este colaborador requiere tomar como mínimo <strong>${diasMinimos}</strong> días de vacaciones por solicitud.</p>
                        <p>Actualmente solo ha seleccionado <strong>${workingDays}</strong> días.</p>
                        <p>Por favor amplíe su selección.</p>
                    `,
                    confirmButtonColor: '#FF9800'
                });
                return;
            }
            
            if (workingDays < diasMinimos && periodosInfo.totalDiasDisponibles < diasMinimos && workingDays < periodosInfo.totalDiasDisponibles) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Días insuficientes',
                    html: `
                        <p>Aunque el mínimo requerido es de <strong>${diasMinimos}</strong> días, solo tiene <strong>${periodosInfo.totalDiasDisponibles}</strong> días disponibles.</p>
                        <p>Debe tomar todos los <strong>${periodosInfo.totalDiasDisponibles}</strong> días disponibles en esta solicitud.</p>
                        <p>Actualmente solo ha seleccionado <strong>${workingDays}</strong> días.</p>
                    `,
                    confirmButtonColor: '#FF9800'
                });
                return;
            }
        }
        
        const result = await Swal.fire({
            icon: 'question',
            title: '¿Enviar solicitud?',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>Empleado:</strong> ${getFullName(employee)}</p>
                    <p><strong>Periodo:</strong> ${formatDate(selectedStartDate)} al ${formatDate(selectedEndDate)}</p>
                    <p><strong>Días para vacaciones:</strong> ${workingDays} días</p>
                    ${distribucionPeriodos}
                    ${diasMinimos > 0 ? `<p><strong>Mínimo requerido:</strong> ${diasMinimos} días por solicitud</p>` : ''}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#FF5252'
        });
        
        if (result.isConfirmed) {
            const loadingSwal = mostrarCargando('Guardando solicitud...');
            
            try {
                const diasHabiles = selectedDays.filter(day => 
                    !day.isWeekend && !day.isSpecial && !day.isHolyWeek && !day.isRegistered);
                
                await guardarDiasVacaciones(employee, diasHabiles, periodosInfo);
                
                loadingSwal.close();
                
                await Swal.fire({
                    icon: 'success',
                    title: 'Vacaciones guardadas',
                    text: 'La solicitud de vacaciones ha sido registrada correctamente.',
                    confirmButtonColor: '#4CAF50'
                });
                
                vacationModal.classList.remove('show');
                
                await loadEmployees(selectedDepartmentId);
                
                setTimeout(() => {
                    vacationModal.style.display = 'none';
                }, 300);
                
            } catch (error) {
                console.error('Error al guardar vacaciones:', error);
                loadingSwal.close();
                
                Swal.fire({
                    icon: 'error',
                    title: 'Error al guardar',
                    text: 'Hubo un problema al guardar la solicitud. Por favor intente nuevamente.',
                    confirmButtonColor: '#FF9800'
                });
            }
        }
        
    } catch (error) {
        console.error('Error al procesar la solicitud:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al procesar la solicitud. Por favor intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para actualizar los días disponibles de un empleado
async function actualizarDiasDisponibles(idPersonal) {
    try {
        const connection = await connectionString();
        const query = `
            SELECT
                (TIMESTAMPDIFF(YEAR, personal.FechaPlanilla, CURDATE()) * 15) - 
                    IFNULL((SELECT COUNT(*) FROM vacacionestomadas WHERE IdPersonal = personal.IdPersonal), 0) -
                    IFNULL((SELECT SUM(CAST(DiasSolicitado AS UNSIGNED)) FROM vacacionespagadas 
                            WHERE IdPersonal = personal.IdPersonal AND Estado IN (1,2,3,4)), 0)
                AS DiasVacaciones
            FROM
                personal
            WHERE
                personal.IdPersonal = ?
        `;
        
        const result = await connection.query(query, [idPersonal]);
        await connection.close();
        
        if (result.length > 0) {
            const index = employeesData.findIndex(emp => emp.IdPersonal === idPersonal);
            if (index !== -1) {
                employeesData[index].DiasVacaciones = result[0].DiasVacaciones;
                
                const filteredIndex = filteredData.findIndex(emp => emp.IdPersonal === idPersonal);
                if (filteredIndex !== -1) {
                    filteredData[filteredIndex].DiasVacaciones = result[0].DiasVacaciones;
                }
                
                renderEmployeesTable();
            }
        }
        
        return result[0]?.DiasVacaciones || 0;
    } catch (error) {
        console.error('Error al actualizar días disponibles:', error);
        return 0;
    }
}

// Abrir modal de información del empleado
function openInfoModal(employeeId) {
    if (employeeId === userData.IdPersonal) {
        Swal.fire({
            icon: 'info',
            title: 'Información',
            text: 'Esta es su información personal. No puede solicitar vacaciones para usted mismo.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    const employee = employeesData.find(emp => emp.IdPersonal === employeeId);
    
    if (!employee) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró información del colaborador.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    const fullName = getFullName(employee);
    
    document.getElementById('infoEmployeeName').textContent = fullName;
    document.getElementById('infoEmployeePosition').textContent = employee.Nombre || 'Sin puesto asignado';
    document.getElementById('infoYearsService').textContent = `${employee.AniosCumplidos} años`;
    document.getElementById('infoAvailableDays').textContent = `${employee.DiasVacaciones} días`;
    document.getElementById('infoEmployeeId').textContent = employee.IdPersonal;
    
    const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
    document.getElementById('infoEmployeePhoto').src = photoSrc;
    
    infoModal.style.display = 'block';
    setTimeout(() => {
        infoModal.classList.add('show');
    }, 10);
}

// Función para obtener el nombre completo
function getFullName(employee) {
    if (!employee) return 'N/A';
    
    const firstName = employee.PrimerNombre || '';
    const secondName = employee.SegundoNombre || '';
    const thirdName = employee.TercerNombre || '';
    const firstLastName = employee.PrimerApellido || '';
    const secondLastName = employee.SegundoApellido || '';
    
    return [firstName, secondName, thirdName, firstLastName, secondLastName]
        .filter(name => name.trim() !== '')
        .join(' ');
}

// Función para formatear fecha
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (isNaN(date)) return 'N/A';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}

// Inicializar eventos
function initEvents() {
    // Evento para el selector de departamento
    if (departmentSelector) {
        departmentSelector.addEventListener('change', function() {
            const searchBtn = document.getElementById('searchDepartmentBtn');
            searchBtn.disabled = !this.value;
            
            if (!this.value) {
                document.getElementById('departmentInfoSection').style.display = 'none';
                disableControls();
                showInitialMessage();
            }
        });
    }
    
    // Evento para el botón de buscar departamento
    if (searchDepartmentBtn) {
        searchDepartmentBtn.addEventListener('click', async function() {
            const departmentId = document.getElementById('departmentSelector').value;
            
            if (!departmentId) return;
            
            selectedDepartmentId = parseInt(departmentId);
            
            const loadingSwal = mostrarCargando('Cargando colaboradores...');
            
            try {
                await loadDepartmentInfo(selectedDepartmentId);
                await loadEmployees(selectedDepartmentId);
                await loadSpecialDays();
                
                loadingSwal.close();
                
            } catch (error) {
                console.error('Error al cargar departamento:', error);
                loadingSwal.close();
                
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudo cargar la información del departamento.',
                    confirmButtonColor: '#FF9800'
                });
            }
        });
    }
    
    // Búsqueda
    if (searchInput) {
        searchInput.addEventListener('input', filterData);
    }
    
    // Paginación
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderEmployeesTable();
                updatePagination();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderEmployeesTable();
                updatePagination();
            }
        });
    }
    
    // Ordenación de columnas
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            sortData(column);
        });
    });
    
    // Botón de actualizar
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            if (!selectedDepartmentId) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Departamento no seleccionado',
                    text: 'Por favor seleccione un departamento primero.',
                    confirmButtonColor: '#FF9800'
                });
                return;
            }
            
            const loadingSwal = mostrarCargando('Actualizando datos...');
            try {
                await loadEmployees(selectedDepartmentId);
                Swal.fire({
                    icon: 'success',
                    title: 'Datos actualizados',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error al actualizar',
                    text: 'No se pudieron actualizar los datos. Intente nuevamente.',
                    confirmButtonColor: '#FF9800'
                });
            } finally {
                loadingSwal.close();
            }
        });
    }
    
    // Botón de exportar
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToExcel);
    }
    
    // Cerrar modales
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            isClosingModal = true;
            const vacationModal = document.getElementById('vacationModal');
            const infoModal = document.getElementById('infoModal');
            const pdfGeneratorModal = document.getElementById('pdfGeneratorModal');
            
            if (vacationModal) {
                vacationModal.classList.remove('show');
                setTimeout(() => {
                    vacationModal.style.display = 'none';
                    isClosingModal = false;
                }, 300);
            }
            if (infoModal) {
                infoModal.classList.remove('show');
                setTimeout(() => {
                    infoModal.style.display = 'none';
                    isClosingModal = false;
                }, 300);
            }
            if (pdfGeneratorModal) {
                pdfGeneratorModal.classList.remove('show');
                setTimeout(() => {
                    pdfGeneratorModal.style.display = 'none';
                    isClosingModal = false;
                }, 300);
            }
        });
    });
    
    // Clic fuera del modal
    window.addEventListener('click', (event) => {
        isClosingModal = true;
        const vacationModal = document.getElementById('vacationModal');
        const infoModal = document.getElementById('infoModal');
        const pdfGeneratorModal = document.getElementById('pdfGeneratorModal');
        
        if (event.target === vacationModal) {
            vacationModal.classList.remove('show');
            setTimeout(() => {
                vacationModal.style.display = 'none';
                isClosingModal = false;
            }, 300);
        }
        if (event.target === infoModal) {
            infoModal.classList.remove('show');
            setTimeout(() => {
                infoModal.style.display = 'none';
                isClosingModal = false;
            }, 300);
        }
        if (event.target === pdfGeneratorModal) {
            pdfGeneratorModal.classList.remove('show');
            setTimeout(() => {
                pdfGeneratorModal.style.display = 'none';
                isClosingModal = false;
            }, 300);
        }
    });
    
    // Formulario de vacaciones
    const vacationForm = document.getElementById('vacationForm');
    if (vacationForm) {
        vacationForm.addEventListener('submit', guardarSolicitudVacaciones);
    }
    
    // Botón de enviar solicitud
    const submitVacationBtn = document.getElementById('submitVacationBtn');
    if (submitVacationBtn) {
        submitVacationBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const form = document.getElementById('vacationForm');
            if (form) {
                form.dispatchEvent(new Event('submit'));
            }
        });
    }
    
    // NUEVO: Agregar evento al botón de filtrar fechas en el modal de información
    const filterDatesBtn = document.getElementById('filterDatesBtn');
    if (filterDatesBtn) {
        // Eliminar eventos previos para evitar duplicados
        const newBtn = filterDatesBtn.cloneNode(true);
        filterDatesBtn.parentNode.replaceChild(newBtn, filterDatesBtn);
        
        newBtn.addEventListener('click', function() {
            const employeeId = parseInt(document.getElementById('infoEmployeeId').textContent);
            const fechaInicio = document.getElementById('dateFilterStart').value;
            const fechaFin = document.getElementById('dateFilterEnd').value;
            
            filtrarHistorialPorFechas(employeeId, fechaInicio, fechaFin);
        });
    }
    
    // NUEVO: Agregar evento al botón de buscar empleado en el modal de información
    const searchEmployeeBtn = document.getElementById('searchEmployeeBtn');
    if (searchEmployeeBtn) {
        // Eliminar eventos previos para evitar duplicados
        const newBtn = searchEmployeeBtn.cloneNode(true);
        searchEmployeeBtn.parentNode.replaceChild(newBtn, searchEmployeeBtn);
        
        newBtn.addEventListener('click', mostrarBuscadorEmpleados);
    }
    
    // Botón generar PDF
    if (generatePdfBtn) {
        generatePdfBtn.addEventListener('click', openPdfGeneratorModal);
    }
    
    const generateSelectedPdfBtn = document.getElementById('generateSelectedPdfBtn');
    if (generateSelectedPdfBtn) {
        generateSelectedPdfBtn.addEventListener('click', generateSelectedPdf);
    }
    
    // Teclas de atajo
    document.addEventListener('keydown', (e) => {
        // Escape para cerrar modales
        if (e.key === 'Escape') {
            const vacationModal = document.getElementById('vacationModal');
            const infoModal = document.getElementById('infoModal');
            const pdfGeneratorModal = document.getElementById('pdfGeneratorModal');
            
            if (vacationModal && vacationModal.classList.contains('show')) {
                vacationModal.classList.remove('show');
                setTimeout(() => {
                    vacationModal.style.display = 'none';
                }, 300);
            }
            if (infoModal && infoModal.classList.contains('show')) {
                infoModal.classList.remove('show');
                setTimeout(() => {
                    infoModal.style.display = 'none';
                }, 300);
            }
            if (pdfGeneratorModal && pdfGeneratorModal.classList.contains('show')) {
                pdfGeneratorModal.classList.remove('show');
                setTimeout(() => {
                    pdfGeneratorModal.style.display = 'none';
                }, 300);
            }
        }
        
        // Ctrl+F para enfocar la búsqueda
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput && !searchInput.disabled) {
                searchInput.focus();
            }
        }
    });
}
// Exportar a Excel (actualizada)
async function exportToExcel() {
    if (!selectedDepartmentId) {
        Swal.fire({
            icon: 'warning',
            title: 'Departamento no seleccionado',
            text: 'Por favor seleccione un departamento antes de exportar.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    try {
        const loadingSwal = mostrarCargando('Generando reporte...');
        
        const workbook = new ExcelJS.Workbook();
        
        workbook.creator = userData.NombreCompleto;
        workbook.created = new Date();
        workbook.modified = new Date();
        
        const worksheet = workbook.addWorksheet('Vacaciones');
        
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF654321' } },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        
        const evenRowStyle = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } }
        };
        
        worksheet.columns = [
            { header: 'ID', key: 'idPersonal', width: 10 },
            { header: 'Nombre Completo', key: 'nombreCompleto', width: 30 },
            { header: 'Fecha de Ingreso', key: 'fechaIngreso', width: 15 },
            { header: 'Años de Servicio', key: 'aniosServicio', width: 15 },
            { header: 'Días Disponibles', key: 'diasDisponibles', width: 15 },
            { header: 'Puesto', key: 'puesto', width: 20 }
        ];
        
        worksheet.getRow(1).eachCell((cell) => {
            cell.style = headerStyle;
        });
        
        filteredData.forEach((employee, index) => {
            const fullName = getFullName(employee);
            const hireDate = formatDate(employee.FechaPlanilla);
            
            const row = worksheet.addRow({
                idPersonal: employee.IdPersonal,
                nombreCompleto: fullName,
                fechaIngreso: hireDate,
                aniosServicio: `${employee.AniosCumplidos} años`,
                diasDisponibles: `${employee.DiasVacaciones} días`,
                puesto: employee.Nombre || 'Sin puesto'
            });
            
            if (index % 2 !== 0) {
                row.eachCell((cell) => {
                    cell.style = evenRowStyle;
                });
            }
        });
        
        
        worksheet.spliceRows(1, 0, []);
        worksheet.spliceRows(1, 0, [`REPORTE DE VACACIONES - ${selectedDeptName.toUpperCase()}`]);
        worksheet.spliceRows(2, 0, [`Fecha de generación: ${new Date().toLocaleDateString('es-GT')} ${new Date().toLocaleTimeString('es-GT')}`]);
        worksheet.spliceRows(3, 0, []);
        
        worksheet.mergeCells('A1:F1');
        worksheet.mergeCells('A2:F2');
        
        const titleCell = worksheet.getCell('A1');
        titleCell.font = { bold: true, size: 16, color: { argb: 'FF654321' } };
        titleCell.alignment = { horizontal: 'center' };
        
        const dateCell = worksheet.getCell('A2');
        dateCell.font = { italic: true, size: 12, color: { argb: 'FF777777' } };
        dateCell.alignment = { horizontal: 'center' };
        
        const lastRow = worksheet.lastRow.number + 2;
        worksheet.addRow([`Generado por: ${userData.NombreCompleto}`]);
        const footerCell = worksheet.getCell(`A${lastRow}`);
        footerCell.font = { italic: true, color: { argb: 'FF777777' } };
        
        const buffer = await workbook.xlsx.writeBuffer();
        
        loadingSwal.close();
        
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const a = document.createElement('a');
        const url = window.URL.createObjectURL(blob);
        
        const date = new Date();
        const formattedDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
        const fileName = `Vacaciones_${selectedDeptName.replace(/\s+/g, '_')}_${formattedDate}.xlsx`;
        
        a.href = url;
        a.download = fileName;
        a.click();
        
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 0);
        
        Swal.fire({
            icon: 'success',
            title: 'Reporte generado',
            text: `El reporte "${fileName}" ha sido descargado correctamente.`,
            confirmButtonColor: '#4CAF50'
        });
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo generar el reporte. Intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para mostrar animación de carga
function mostrarCargando(mensaje = "Cargando...") {
    return Swal.fire({
        title: mensaje,
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                <div class="spinner"></div>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false
    });
}

// Función para verificar si un período está completo
async function verificarPeriodoCompleto(empleado, periodo) {
    try {
        const connection = await connectionString();
        
        const queryDiasTomados = `
            SELECT COUNT(*) as DiasUtilizados
            FROM vacacionestomadas
            WHERE IdPersonal = ? AND Periodo = ?
        `;
        const resultDiasTomados = await connection.query(queryDiasTomados, [empleado.IdPersonal, periodo]);
        
        const queryDiasPagados = `
            SELECT IFNULL(SUM(CAST(DiasSolicitado AS UNSIGNED)), 0) as DiasPagados
            FROM vacacionespagadas
            WHERE IdPersonal = ? AND Periodo = ? AND Estado IN (1,2,3,4)
        `;
        const resultDiasPagados = await connection.query(queryDiasPagados, [empleado.IdPersonal, periodo]);
        
        const diasTomados = parseInt(resultDiasTomados[0].DiasUtilizados) || 0;
        const diasPagados = parseInt(resultDiasPagados[0].DiasPagados) || 0;
        
        await connection.close();
        
        return (diasTomados + diasPagados) === 15;
        
    } catch (error) {
        console.error('Error al verificar período completo:', error);
        return false;
    }
}

// Función para obtener los detalles del período para el PDF
async function obtenerDetallesPeriodo(empleado, periodo) {
    try {
        const connection = await connectionString();
        
        const queryFechasTomadas = `
            SELECT FechasTomadas
            FROM vacacionestomadas
            WHERE IdPersonal = ? AND Periodo = ?
            ORDER BY FechasTomadas
        `;
        
        const fechasTomadas = await connection.query(queryFechasTomadas, [empleado.IdPersonal, periodo]);
        
        const queryDiasPagados = `
            SELECT DiasSolicitado, FechaRegistro
            FROM vacacionespagadas
            WHERE IdPersonal = ? AND Periodo = ? AND Estado IN (1,2,3,4)
        `;
        
        const diasPagados = await connection.query(queryDiasPagados, [empleado.IdPersonal, periodo]);
        
        const queryPlanilla = `
            SELECT 
                p.Nombre_Planilla,
                p.Division,
                d.Nombre as NombreDivision,
                CASE 
                    WHEN d.Logos IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(d.Logos))
                    ELSE NULL 
                END AS LogoBase64
            FROM 
                personal per
                INNER JOIN planillas p ON per.IdPlanilla = p.IdPlanilla
                INNER JOIN divisiones d ON p.Division = d.IdDivision
            WHERE 
                per.IdPersonal = ?
        `;
        
        const infoPlanilla = await connection.query(queryPlanilla, [empleado.IdPersonal]);
        
        await connection.close();
        
        const resultado = {
            fechasTomadas: fechasTomadas,
            diasPagados: diasPagados,
            infoPlanilla: infoPlanilla[0],
            periodo: periodo
        };
        
        return resultado;
        
    } catch (error) {
        console.error('Error detallado en obtenerDetallesPeriodo:', error);
        throw error;
    }
}

// Función para generar el PDF del período completado
async function generarPDFPeriodoCompleto(empleado, periodo) {
    try {
        isGeneratingPDF = true;
        const detalles = await obtenerDetallesPeriodo(empleado, periodo);
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const pageWidth = doc.internal.pageSize.width;
        let y = 20;
        
        if (detalles.infoPlanilla.LogoBase64) {
            try {
                doc.addImage(detalles.infoPlanilla.LogoBase64, 'JPEG', 10, 10, 30, 30);
            } catch (error) {
                console.error('Error al agregar logo:', error);
            }
        }
        
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(detalles.infoPlanilla.NombreDivision, pageWidth / 2, y, { align: 'center' });
        y += 10;
        
        doc.setFontSize(14);
        doc.text(detalles.infoPlanilla.Nombre_Planilla, pageWidth / 2, y, { align: 'center' });
        y += 15;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(12);
        doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', pageWidth / 2, y, { align: 'center' });
        y += 10;
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(14);
        doc.text('FICHA DE CONTROL DE PERÍODO DE VACACIONES', pageWidth / 2, y, { align: 'center' });
        y += 20;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(11);
        
        const nombreCompleto = getFullName(empleado);
        doc.setFont(undefined, 'bold');
        doc.text('Nombre del Colaborador:', 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(nombreCompleto, 70, y);
        y += 8;
        
        doc.setFont(undefined, 'bold');
        doc.text('DPI:', 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(empleado.DPI || 'No registrado', 70, y);
        y += 8;
        
        const periodoFormateado = formatearPeriodoParaPDF(periodo);
        doc.setFont(undefined, 'bold');
        doc.text('Período:', 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(periodoFormateado, 70, y);
        y += 20;
        
        const col1X = 20;
        const col2X = 60;
        const col3X = 120;
        const tableWidth = 170;
        
        const col1Width = 40;
        const col2Width = 60;
        const col3Width = 70;
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('NO.', col1X + (col1Width / 2), y, { align: 'center' });
        doc.text('FECHA DESCANSO', col2X + (col2Width / 2), y, { align: 'center' });
        doc.text('FIRMA COLABORADOR', col3X + (col3Width / 2), y, { align: 'center' });
        y += 3;
        
        doc.setLineWidth(0.5);
        doc.line(col1X, y, col1X + tableWidth, y);
        y += 7;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        let contador = 1;
        
        let totalDiasPagados = 0;
        detalles.diasPagados.forEach(pago => {
            totalDiasPagados += parseInt(pago.DiasSolicitado);
        });
        
        detalles.fechasTomadas.forEach(fecha => {
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            doc.text(contador.toString(), col1X + (col1Width / 2), y, { align: 'center' });
            
            doc.setFont(undefined, 'bold');
            doc.setFontSize(12);
            doc.text(formatDate(fecha.FechasTomadas), col2X + (col2Width / 2), y, { align: 'center' });
            
            y += 5;
            doc.setLineWidth(0.3);
            doc.line(col1X, y, col1X + tableWidth, y);
            y += 5;
            
            contador++;
        });
        
        if (totalDiasPagados > 0) {
            y += 5;
            
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            doc.text(contador.toString(), col1X + (col1Width / 2), y, { align: 'center' });
            
            doc.setFont(undefined, 'bold');
            doc.setFontSize(12);
            doc.text(`Días pagados: ${totalDiasPagados}`, col2X + (col2Width / 2), y, { align: 'center' });
            
            y += 5;
            doc.setLineWidth(0.3);
            doc.line(col1X, y, col1X + tableWidth, y);
            y += 5;
        }
        
        y += 15;
        
        const totalDias = detalles.fechasTomadas.length + totalDiasPagados;
        doc.setFont(undefined, 'bold');
        doc.text(`Total de días utilizados del período: ${totalDias} / 15`, 20, y);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-GT')}`, 20, 270);
        doc.text(`Página 1 de 1`, pageWidth - 40, 270);
        
        const fileName = `Periodo_Completo_${nombreCompleto.replace(/\s+/g, '_')}_${periodo.replace(/\s+/g, '_')}.pdf`;
        setTimeout(() => {
            doc.save(fileName);
            setTimeout(() => {
                isGeneratingPDF = false;
            }, 500);
        }, 100);
        
        return true;
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        throw error;
    }
}

// Función para formatear el período para el PDF
function formatearPeriodoParaPDF(periodo) {
    if (!periodo) return '';
    
    const partes = periodo.split(' al ');
    if (partes.length === 2) {
        const fechaInicio = partes[0].split('-');
        const fechaFin = partes[1].split('-');
        
        const inicioFormateado = `${fechaInicio[2]}-${fechaInicio[1]}-${fechaInicio[0]}`;
        const finFormateado = `${fechaFin[2]}-${fechaFin[1]}-${fechaFin[0]}`;
        
        return `${inicioFormateado} al ${finFormateado}`;
    }
    
    return periodo;
}

// Obtener períodos completados
async function obtenerPeriodosCompletados(empleado) {
    try {
        const connection = await connectionString();
        
        const aniosCumplidos = parseInt(empleado.AniosCumplidos) || 0;
        const periodosCompletados = [];
        
        for (let i = 0; i <= aniosCumplidos; i++) {
            const periodo = calcularPeriodo(empleado.FechaPlanilla, i);
            
            const queryDiasTomados = `
                SELECT COUNT(*) as DiasUtilizados
                FROM vacacionestomadas
                WHERE IdPersonal = ? AND Periodo = ?
            `;
            const resultDiasTomados = await connection.query(queryDiasTomados, [empleado.IdPersonal, periodo]);
            
            const queryDiasPagados = `
                SELECT IFNULL(SUM(CAST(DiasSolicitado AS UNSIGNED)), 0) as DiasPagados
                FROM vacacionespagadas
                WHERE IdPersonal = ? AND Periodo = ? AND Estado IN (1,2,3,4)
            `;
            const resultDiasPagados = await connection.query(queryDiasPagados, [empleado.IdPersonal, periodo]);
            
            const diasTomados = parseInt(resultDiasTomados[0].DiasUtilizados) || 0;
            const diasPagados = parseInt(resultDiasPagados[0].DiasPagados) || 0;
            const totalDias = diasTomados + diasPagados;
            
            if (totalDias === 15) {
                periodosCompletados.push({
                    periodo: periodo,
                    diasTomados: diasTomados,
                    diasPagados: diasPagados,
                    totalDias: totalDias
                });
            }
        }
        
        await connection.close();
        return periodosCompletados;
        
    } catch (error) {
        console.error('Error al obtener períodos completados:', error);
        throw error;
    }
}

// Abrir modal de generador de PDF
function openPdfGeneratorModal() {
    const modal = document.getElementById('pdfGeneratorModal');
    if (!modal) {
        console.error('No se encontró el modal de PDF');
        return;
    }
    
    const searchInput = document.getElementById('pdfEmployeeSearch');
    const selectedEmployeeId = document.getElementById('selectedEmployeeId');
    const searchResults = document.getElementById('searchResults');
    const selectedEmployeeDisplay = document.getElementById('selectedEmployeeDisplay');
    const periodSelect = document.getElementById('pdfPeriodSelect');
    const generateBtn = document.getElementById('generateSelectedPdfBtn');
    const periodInfo = document.getElementById('periodInfo');
    
    if (searchInput) searchInput.value = '';
    if (selectedEmployeeId) selectedEmployeeId.value = '';
    if (searchResults) searchResults.style.display = 'none';
    if (selectedEmployeeDisplay) selectedEmployeeDisplay.style.display = 'none';
    if (periodSelect) {
        periodSelect.addEventListener('change', handlePeriodSelection);
    }
    if (generateBtn) generateBtn.disabled = true;
    if (periodInfo) periodInfo.style.display = 'none';
    
    const generatePdfBtn = document.getElementById('generateSelectedPdfBtn');
    if (generatePdfBtn) {
        const newBtn = generatePdfBtn.cloneNode(true);
        generatePdfBtn.parentNode.replaceChild(newBtn, generatePdfBtn);
        
        newBtn.addEventListener('click', generateSelectedPdf);
    }
    
    initializeSearchEvents();
    
    modal.style.display = 'block';
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Función para inicializar eventos del buscador en el modal PDF
function initializeSearchEvents() {
    const searchInput = document.getElementById('pdfEmployeeSearch');
    const clearBtn = document.querySelector('.clear-search');
    const changeBtn = document.querySelector('.change-selection');
    
    if (!searchInput) return;
    
    // Remover eventos anteriores para evitar duplicados
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    // Evento de búsqueda mientras escribe
    newSearchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        if (clearBtn) {
            clearBtn.style.display = query ? 'block' : 'none';
        }
        
        clearTimeout(searchTimeout);
        
        if (query.length >= 2) {
            searchTimeout = setTimeout(() => {
                searchEmployees(query);
            }, 300);
        } else {
            const results = document.getElementById('searchResults');
            if (results) results.style.display = 'none';
        }
    });
    
    // Limpiar búsqueda
    if (clearBtn) {
        const newClearBtn = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
        
        newClearBtn.addEventListener('click', function() {
            const searchInputEl = document.getElementById('pdfEmployeeSearch');
            if (searchInputEl) {
                searchInputEl.value = '';
                this.style.display = 'none';
                const results = document.getElementById('searchResults');
                if (results) results.style.display = 'none';
                searchInputEl.focus();
            }
        });
    }
    
    // Cambiar selección
    if (changeBtn) {
        const newChangeBtn = changeBtn.cloneNode(true);
        changeBtn.parentNode.replaceChild(newChangeBtn, changeBtn);
        
        newChangeBtn.addEventListener('click', function() {
            const selectedDisplay = document.getElementById('selectedEmployeeDisplay');
            const selectedId = document.getElementById('selectedEmployeeId');
            const searchInputEl = document.getElementById('pdfEmployeeSearch');
            const periodSelect = document.getElementById('pdfPeriodSelect');
            const periodInfo = document.getElementById('periodInfo');
            const generateBtn = document.getElementById('generateSelectedPdfBtn');
            
            if (selectedDisplay) selectedDisplay.style.display = 'none';
            if (selectedId) selectedId.value = '';
            if (searchInputEl) {
                searchInputEl.value = '';
                searchInputEl.focus();
            }
            
            if (periodSelect) {
                periodSelect.value = '';
                periodSelect.disabled = true;
            }
            if (periodInfo) periodInfo.style.display = 'none';
            if (generateBtn) generateBtn.disabled = true;
        });
    }
    
    // Navegación con teclado
    const searchInputForKeyboard = document.getElementById('pdfEmployeeSearch');
    if (searchInputForKeyboard) {
        searchInputForKeyboard.addEventListener('keydown', function(e) {
            const results = document.querySelectorAll('.search-result-item');
            const current = document.querySelector('.search-result-item.selected');
            let index = -1;
            
            if (current) {
                index = Array.from(results).indexOf(current);
            }
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (index < results.length - 1) {
                    if (current) current.classList.remove('selected');
                    results[index + 1].classList.add('selected');
                    results[index + 1].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (index > 0) {
                    if (current) current.classList.remove('selected');
                    results[index - 1].classList.add('selected');
                    results[index - 1].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (current) {
                    const currentEmployeeId = parseInt(current.dataset.id);
                    selectEmployee(currentEmployeeId);
                }
            }
        });
    }
}

// Función para buscar empleados
function searchEmployees(query) {
    const resultsContainer = document.getElementById('searchResults');
    
    // Mostrar estado de carga
    resultsContainer.innerHTML = `
        <div class="search-loading">
            <div class="spinner"></div>
            <p>Buscando...</p>
        </div>
    `;
    resultsContainer.style.display = 'block';
    
    // Filtrar empleados
    const searchLower = query.toLowerCase();
    currentSearchResults = employeesData.filter(employee => {
        // No incluir al usuario actual
        if (employee.IdPersonal === userData.IdPersonal) return false;
        
        const fullName = getFullName(employee).toLowerCase();
        const position = (employee.Nombre || '').toLowerCase();
        const dpi = (employee.DPI || '').toLowerCase();
        
        return fullName.includes(searchLower) || 
               position.includes(searchLower) || 
               dpi.includes(searchLower);
    });
    
    // Ordenar resultados por relevancia
    currentSearchResults.sort((a, b) => {
        const aName = getFullName(a).toLowerCase();
        const bName = getFullName(b).toLowerCase();
        
        // Priorizar coincidencias al inicio del nombre
        if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
        if (!aName.startsWith(searchLower) && bName.startsWith(searchLower)) return 1;
        
        return aName.localeCompare(bName);
    });
    
    // Mostrar resultados
    displaySearchResults(currentSearchResults, query);
}

// Función para mostrar resultados de búsqueda
function displaySearchResults(results, query) {
    const resultsContainer = document.getElementById('searchResults');
    
    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No se encontraron colaboradores</p>
            </div>
        `;
        return;
    }
    
    // Generar HTML de resultados
    const resultsHTML = results.slice(0, 10).map(employee => {
        const fullName = getFullName(employee);
        const position = employee.Nombre || 'Sin puesto';
        const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
        
        // Destacar coincidencias
        const highlightedName = highlightMatch(fullName, query);
        const highlightedPosition = highlightMatch(position, query);
        
        return `
            <div class="search-result-item" data-id="${employee.IdPersonal}">
                <img src="${photoSrc}" alt="${fullName}" class="result-photo">
                <div class="result-info">
                    <div class="result-name">${highlightedName}</div>
                    <div class="result-position">${highlightedPosition}</div>
                </div>
            </div>
        `;
    }).join('');
    
    resultsContainer.innerHTML = resultsHTML;
    
    // Agregar eventos a los resultados
    document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', function() {
            const itemEmployeeId = parseInt(this.dataset.id);
            selectEmployee(itemEmployeeId);
        });
    });
}

// Función para resaltar coincidencias
function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// Función para seleccionar empleado
function selectEmployee(selectedEmployeeId) {
    const employee = employeesData.find(emp => emp.IdPersonal === selectedEmployeeId);
    if (!employee) return;
    
    // Guardar ID seleccionado
    const hiddenInput = document.getElementById('selectedEmployeeId');
    if (hiddenInput) {
        hiddenInput.value = selectedEmployeeId;
    }
    
    // Mostrar empleado seleccionado
    const selectedDisplay = document.getElementById('selectedEmployeeDisplay');
    if (selectedDisplay) {
        const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
        
        const photoElement = selectedDisplay.querySelector('.selected-employee-photo');
        const nameElement = selectedDisplay.querySelector('.selected-employee-name');
        const positionElement = selectedDisplay.querySelector('.selected-employee-position');
        
        if (photoElement) photoElement.src = photoSrc;
        if (nameElement) nameElement.textContent = getFullName(employee);
        if (positionElement) positionElement.textContent = employee.Nombre || 'Sin puesto';
        
        selectedDisplay.style.display = 'flex';
    }
    
    // Ocultar resultados de búsqueda
    const searchResults = document.getElementById('searchResults');
    if (searchResults) searchResults.style.display = 'none';
    
    const searchInput = document.getElementById('pdfEmployeeSearch');
    if (searchInput) searchInput.value = '';
    
    const clearBtn = document.querySelector('.clear-search');
    if (clearBtn) clearBtn.style.display = 'none';
    
    // Cargar períodos del empleado seleccionado
    handleEmployeeSelection(selectedEmployeeId);
}

// Función para manejar la selección de empleado
async function handleEmployeeSelection(employeeIdParam = null) {
    let employeeId;
    
    if (employeeIdParam !== null) {
        employeeId = employeeIdParam;
    } else {
        employeeId = parseInt(document.getElementById('selectedEmployeeId').value);
    }
    
    const periodSelect = document.getElementById('pdfPeriodSelect');
    
    if (!employeeId) {
        periodSelect.disabled = true;
        periodSelect.innerHTML = '<option value="">-- Primero seleccione un colaborador --</option>';
        document.getElementById('periodInfo').style.display = 'none';
        document.getElementById('generateSelectedPdfBtn').disabled = true;
        return;
    }
    
    // Mostrar indicador de carga
    const loadingSwal = Swal.fire({
        title: 'Cargando períodos...',
        html: `
            <div class="loading-animation">
                <div class="spinner"></div>
                <p>Buscando períodos completados</p>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false,
        customClass: {
            popup: 'loading-popup'
        }
    });
    
    try {
        const employee = employeesData.find(emp => emp.IdPersonal === employeeId);
        
        if (!employee) {
            throw new Error('Empleado no encontrado');
        }
        
        // Simular una pequeña demora para mejorar la UX
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const periodosCompletados = await obtenerPeriodosCompletados(employee);
        
        loadingSwal.close();
        
        if (periodosCompletados.length === 0) {
            periodSelect.innerHTML = '<option value="">❌ No hay períodos completados</option>';
            periodSelect.disabled = true;
            
            Swal.fire({
                icon: 'info',
                title: 'Sin períodos completados',
                html: `
                    <p>${getFullName(employee)} no tiene períodos de 15 días completados.</p>
                    <p class="text-muted">Los períodos se completan automáticamente cuando se utilizan los 15 días disponibles.</p>
                `,
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Habilitar selección con animación
        periodSelect.disabled = false;
        if (periodSelect.parentElement) {
            const arrow = periodSelect.parentElement.querySelector('.select-arrow');
            if (arrow) arrow.classList.remove('disabled');
        }
        
        periodSelect.innerHTML = '<option value="">-- Seleccione un período --</option>';
        
        // Agregar opciones con mejor formato
        periodosCompletados.forEach((periodo, index) => {
            const option = document.createElement('option');
            option.value = JSON.stringify(periodo);
            option.innerHTML = `
                ${formatPeriodoUsuario(periodo.periodo)} 
                (${periodo.diasTomados} tomados + ${periodo.diasPagados} pagados)
            `;
            periodSelect.appendChild(option);
        });
        
        // Animar la aparición del select
        if (periodSelect.parentElement) {
            periodSelect.parentElement.style.animation = 'fadeIn 0.3s ease-out';
        }
        
    } catch (error) {
        console.error('Error al cargar períodos:', error);
        loadingSwal.close();
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los períodos completados.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para manejar la selección de período
function handlePeriodSelection() {
    const periodValue = document.getElementById('pdfPeriodSelect').value;
    const periodInfoDiv = document.getElementById('periodInfo');
    const generateBtn = document.getElementById('generateSelectedPdfBtn');
    
    if (!periodValue || periodValue === '') {
        // Ocultar información y deshabilitar botón
        if (periodInfoDiv) {
            periodInfoDiv.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                periodInfoDiv.style.display = 'none';
            }, 300);
        }
        if (generateBtn) {
            generateBtn.disabled = true;
        }
        return;
    }
    
    try {
        const periodoInfo = JSON.parse(periodValue);
        
        // Actualizar valores con animación
        const selectedPeriodEl = document.getElementById('selectedPeriod');
        if (selectedPeriodEl) {
            selectedPeriodEl.textContent = formatPeriodoUsuario(periodoInfo.periodo);
        }
        
        // Animar los números
        animateValue('daysTaken', 0, periodoInfo.diasTomados, 500);
        animateValue('daysPaid', 0, periodoInfo.diasPagados, 500);
        animateValue('totalDays', 0, periodoInfo.totalDias, 500);
        
        // Mostrar con animación
        if (periodInfoDiv) {
            periodInfoDiv.style.display = 'block';
            periodInfoDiv.style.animation = 'slideIn 0.3s ease-out';
        }
        
        // IMPORTANTE: Habilitar el botón de generar PDF
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.classList.add('pulse');
            setTimeout(() => generateBtn.classList.remove('pulse'), 1000);
        }
        
    } catch (error) {
        console.error('Error al procesar período:', error);
        if (generateBtn) {
            generateBtn.disabled = true;
        }
    }
}

// Función para animar valores
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Función para generar el PDF del período seleccionado
async function generateSelectedPdf() {
    isGeneratingPDF = true;
    
    const employeeId = parseInt(document.getElementById('selectedEmployeeId').value);
    const periodValue = document.getElementById('pdfPeriodSelect').value;
    
    if (!employeeId || !periodValue) {
        isGeneratingPDF = false;
        Swal.fire({
            icon: 'warning',
            title: 'Selección incompleta',
            text: 'Por favor seleccione un colaborador y un período.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    try {
        const employee = employeesData.find(emp => emp.IdPersonal === employeeId);
        if (!employee) {
            isGeneratingPDF = false;
            throw new Error('Empleado no encontrado');
        }
        
        const periodoInfo = JSON.parse(periodValue);
        
        // Cerrar el modal antes de generar el PDF
        isClosingModal = true;
        const pdfGeneratorModal = document.getElementById('pdfGeneratorModal');
        if (pdfGeneratorModal) {
            pdfGeneratorModal.classList.remove('show');
            setTimeout(() => {
                pdfGeneratorModal.style.display = 'none';
                isClosingModal = false;
            }, 300);
        }
        
        const loadingSwal = mostrarCargando('Generando PDF...');
        
        try {
            // Generar el PDF
            await generarPDFPeriodoCompleto(employee, periodoInfo.periodo);
            
            loadingSwal.close();
            
            // Resetear la variable después de un pequeño delay
            setTimeout(() => {
                isGeneratingPDF = false;
            }, 1000);
            
            Swal.fire({
                icon: 'success',
                title: 'PDF Generado',
                text: 'La ficha de control se ha generado correctamente.',
                confirmButtonColor: '#4CAF50',
                timer: 3000,
                timerProgressBar: true
            });
            
        } catch (pdfError) {
            console.error('Error al generar PDF:', pdfError);
            loadingSwal.close();
            isGeneratingPDF = false;
            
            Swal.fire({
                icon: 'error',
                title: 'Error al generar PDF',
                text: 'No se pudo generar el PDF. Por favor intente nuevamente.',
                confirmButtonColor: '#FF9800'
            });
        }
        
    } catch (error) {
        console.error('Error en generateSelectedPdf:', error);
        isGeneratingPDF = false;
        isClosingModal = false;
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al procesar la solicitud.',
            confirmButtonColor: '#FF9800'
        });
    }
}
// Función para obtener el historial de vacaciones (asegúrate de que esté implementada correctamente)
async function obtenerHistorialVacaciones(employeeId, fechaInicio = null, fechaFin = null) {
    try {
        const connection = await connectionString();
        
        let query = `
            SELECT 
                DATE_FORMAT(FechasTomadas, '%Y-%m-%d') as Fecha,
                Periodo,
                NombreUsuario as RegistradoPor,
                DATE_FORMAT(FechahoraRegistro, '%Y-%m-%d %H:%i') as FechaRegistro
            FROM 
                vacacionestomadas
            WHERE 
                IdPersonal = ?
        `;
        
        const params = [employeeId];
        
        // Añadir filtros de fecha si se proporcionan
        if (fechaInicio && fechaFin) {
            // Asegurarnos que fechaFin incluya todo el día
            const fechaFinCompleta = `${fechaFin} 23:59:59`;
            
            // Filtrar por FechaRegistro (no por FechasTomadas)
            query += ` AND DATE(FechaRegistro) BETWEEN ? AND DATE(?)`;
            params.push(fechaInicio, fechaFinCompleta);
        }
        
        // Ordenar por fecha de registro más reciente primero
        query += ` ORDER BY FechaRegistro DESC`;
        
        const result = await connection.query(query, params);
        await connection.close();
        
        return result;
    } catch (error) {
        console.error('Error al obtener historial de vacaciones:', error);
        throw error;
    }
}

// Función para filtrar historial por fechas
async function filtrarHistorialPorFechas(employeeId, fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas incompletas',
            text: 'Por favor seleccione ambas fechas para filtrar.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Validar que la fecha de inicio no sea posterior a la fecha de fin
    if (new Date(fechaInicio) > new Date(fechaFin)) {
        Swal.fire({
            icon: 'warning',
            title: 'Rango de fechas inválido',
            text: 'La fecha de inicio debe ser anterior o igual a la fecha de fin.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    try {
        // Mostrar indicador de carga
        const loadingSwal = mostrarCargando('Filtrando datos...');
        
        if (!verificarFormatoFecha(fechaInicio) || !verificarFormatoFecha(fechaFin)) {
            Swal.fire({
                icon: 'error',
                title: 'Formato de fecha incorrecto',
                text: 'Las fechas deben tener formato YYYY-MM-DD',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Modificamos la función para pasar explícitamente que queremos filtrar por FechaRegistro
        const historialFiltrado = await obtenerHistorialVacaciones(employeeId, fechaInicio, fechaFin);
        
        // Si no hay resultados, mostrar mensaje
        if (historialFiltrado.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: 'No se encontraron registros en el rango de fechas seleccionado.',
                confirmButtonColor: '#FF9800'
            });
        }
        
        // Actualizar la tabla
        actualizarTablaHistorial(historialFiltrado);
        
        loadingSwal.close();
        
    } catch (error) {
        console.error('Error al filtrar historial:', error);
        loadingSwal.close();
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al aplicar el filtro. Intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Verificar formato de fecha
function verificarFormatoFecha(fechaStr) {
    // Verificar si tiene formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        console.error('Formato de fecha incorrecto:', fechaStr);
        return false;
    }
    return true;
}

// Función para mostrar buscador de empleados
function mostrarBuscadorEmpleados() {
    // Crear el contenido del modal de búsqueda
    const modalContent = `
        <div class="search-employee-modal">
            <div class="search-header">
                <h3>Buscar Colaborador</h3>
                <button class="close-search-modal" id="closeSearchModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="search-input-container">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="modalEmployeeSearch" placeholder="Buscar por nombre, puesto o DPI..." autofocus>
                <i class="fas fa-times clear-modal-search" id="clearModalSearch" style="display: none;"></i>
            </div>
            
            <div class="modal-search-results" id="modalSearchResults"></div>
        </div>
    `;
    
    // Crear el elemento del modal
    const searchModalElement = document.createElement('div');
    searchModalElement.className = 'search-modal-overlay';
    searchModalElement.id = 'searchEmployeeModal';
    searchModalElement.innerHTML = modalContent;
    
    // Añadir al body
    document.body.appendChild(searchModalElement);
    
    // Mostrar con animación
    setTimeout(() => {
        searchModalElement.classList.add('show');
        document.getElementById('modalEmployeeSearch').focus();
    }, 10);
    
    // Configurar eventos
    const searchInput = document.getElementById('modalEmployeeSearch');
    const clearBtn = document.getElementById('clearModalSearch');
    const closeBtn = document.getElementById('closeSearchModal');
    
    // Evento de búsqueda
    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();
        clearBtn.style.display = query ? 'block' : 'none';
        
        clearTimeout(searchTimeout);
        
        if (query.length >= 2) {
            searchTimeout = setTimeout(() => {
                buscarEmpleadosModal(query);
            }, 300);
        } else {
            document.getElementById('modalSearchResults').innerHTML = '';
        }
    });
    
    // Evento limpiar búsqueda
    clearBtn.addEventListener('click', function() {
        searchInput.value = '';
        this.style.display = 'none';
        document.getElementById('modalSearchResults').innerHTML = '';
        searchInput.focus();
    });
    
    // Evento cerrar modal
    closeBtn.addEventListener('click', cerrarBuscadorEmpleados);
    
    // Cerrar al hacer clic fuera
    searchModalElement.addEventListener('click', function(e) {
        if (e.target === this) {
            cerrarBuscadorEmpleados();
        }
    });
    
    // Navegación con teclado
    searchInput.addEventListener('keydown', function(e) {
        const results = document.querySelectorAll('.modal-search-item');
        const current = document.querySelector('.modal-search-item.selected');
        let index = -1;
        
        if (current) {
            index = Array.from(results).indexOf(current);
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (index < results.length - 1) {
                if (current) current.classList.remove('selected');
                results[index + 1].classList.add('selected');
                results[index + 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (index > 0) {
                if (current) current.classList.remove('selected');
                results[index - 1].classList.add('selected');
                results[index - 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (current) {
                const employeeId = parseInt(current.dataset.id);
                cerrarBuscadorEmpleados();
                openInfoModal(employeeId);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cerrarBuscadorEmpleados();
        }
    });
}

// Buscar empleados en el modal
function buscarEmpleadosModal(query) {
    const resultsContainer = document.getElementById('modalSearchResults');
    
    // Mostrar estado de carga
    resultsContainer.innerHTML = `
        <div class="modal-search-loading">
            <div class="spinner small"></div>
            <p>Buscando...</p>
        </div>
    `;
    
    // Filtrar empleados
    const searchLower = query.toLowerCase();
    const resultados = employeesData.filter(employee => {
        // Excluir al usuario actual
        if (employee.IdPersonal === userData.IdPersonal) return false;
        
        const fullName = getFullName(employee).toLowerCase();
        const position = (employee.Nombre || '').toLowerCase();
        const dpi = (employee.DPI || '').toLowerCase();
        
        return fullName.includes(searchLower) || 
               position.includes(searchLower) || 
               dpi.includes(searchLower);
    });
    
    // Ordenar resultados por relevancia
    resultados.sort((a, b) => {
        const aName = getFullName(a).toLowerCase();
        const bName = getFullName(b).toLowerCase();
        
        // Priorizar coincidencias al inicio del nombre
        if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
        if (!aName.startsWith(searchLower) && bName.startsWith(searchLower)) return 1;
        
        return aName.localeCompare(bName);
    });
    
    // Mostrar resultados
    if (resultados.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-modal-results">
                <i class="fas fa-search"></i>
                <p>No se encontraron colaboradores que coincidan con su búsqueda</p>
            </div>
        `;
        return;
    }
    
    // Generar HTML de resultados (limitar a 8 resultados para mejor rendimiento)
    const resultsHTML = resultados.slice(0, 8).map(employee => {
        const fullName = getFullName(employee);
        const position = employee.Nombre || 'Sin puesto';
        const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
        
        // Destacar coincidencias
        const highlightedName = highlightMatch(fullName, query);
        const highlightedPosition = highlightMatch(position, query);
        
        return `
            <div class="modal-search-item" data-id="${employee.IdPersonal}">
                <img src="${photoSrc}" alt="${fullName}" class="search-result-photo">
                <div class="search-result-info">
                    <div class="search-result-name">${highlightedName}</div>
                    <div class="search-result-position">${highlightedPosition}</div>
                    <div class="search-result-days">
                        <i class="fas fa-calendar-day"></i> ${employee.DiasVacaciones} días disponibles
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    resultsContainer.innerHTML = resultsHTML;
    
    // Agregar eventos a los resultados
    document.querySelectorAll('.modal-search-item').forEach(item => {
        item.addEventListener('click', function() {
            const employeeId = parseInt(this.dataset.id);
            cerrarBuscadorEmpleados();
            openInfoModal(employeeId);
        });
    });
}

// Cerrar buscador de empleados
function cerrarBuscadorEmpleados() {
    const searchModal = document.getElementById('searchEmployeeModal');
    if (searchModal) {
        searchModal.classList.remove('show');
        setTimeout(() => {
            searchModal.remove();
        }, 300);
    }
}

// Función para actualizar la tabla de historial
function actualizarTablaHistorial(historial) {
    const historialTable = document.getElementById('vacationHistoryTable');
    
    if (!historialTable) return;
    
    // Limpiar tabla
    const tbody = historialTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (historial.length === 0) {
        // Mostrar mensaje si no hay datos
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="no-data">
                    <i class="fas fa-calendar-xmark"></i>
                    <p>No hay registros de vacaciones para este colaborador</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Agrupar por año para mejor visualización
    const historialPorAnio = {};
    
    historial.forEach(item => {
        const fecha = new Date(item.Fecha);
        const anio = fecha.getFullYear();
        
        if (!historialPorAnio[anio]) {
            historialPorAnio[anio] = [];
        }
        
        historialPorAnio[anio].push(item);
    });
    
    // Ordenar años de más reciente a más antiguo
    const aniosOrdenados = Object.keys(historialPorAnio).sort((a, b) => b - a);
    
    // Crear filas para cada registro, agrupadas por año
    aniosOrdenados.forEach(anio => {
        // Crear fila de encabezado de año
        const yearRow = document.createElement('tr');
        yearRow.className = 'year-header';
        yearRow.innerHTML = `
            <td colspan="4">
                <div class="year-badge">
                    <i class="fas fa-calendar-year"></i>
                    <span>${anio}</span>
                </div>
            </td>
        `;
        tbody.appendChild(yearRow);
        
        // Añadir cada registro de este año
        historialPorAnio[anio].forEach(item => {
            const row = document.createElement('tr');
            row.className = 'history-item';
            
            // Usar el nuevo formato de fecha con día de la semana
            row.innerHTML = `
                <td>${formatDateWithDay(item.Fecha)}</td>
                <td>${formatPeriodoUsuario(item.Periodo)}</td>
                <td>${item.RegistradoPor}</td>
                <td>${item.FechaRegistro}</td>
            `;
            
            tbody.appendChild(row);
        });
    });
    
    // Actualizar el contador
    const countElement = document.getElementById('vacationHistoryCount');
    if (countElement) {
        countElement.textContent = historial.length;
    }
}

// Función para formatear fecha con día de la semana
function formatDateWithDay(dateString) {
    if (!dateString) return 'N/A';
    
    // Para evitar problemas de zona horaria, parseamos la fecha manualmente
    const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
    // Crear fecha usando UTC para evitar ajustes automáticos de zona horaria
    // Importante: month - 1 porque en JS los meses van de 0-11
    const date = new Date(Date.UTC(year, month - 1, day));
    
    if (isNaN(date)) return 'N/A';
    
    // Arreglo con los nombres de los días de la semana en español
    const daysOfWeek = [
        'domingo', 'lunes', 'martes', 'miércoles', 
        'jueves', 'viernes', 'sábado'
    ];
    
    // Obtener el día de la semana (0-6, donde 0 es domingo)
    const dayOfWeek = daysOfWeek[date.getUTCDay()];
    
    // Formatear la fecha como "lunes 12-05-2025"
    // IMPORTANTE: usar getUTCDate() en lugar de getDate() para evitar ajustes de zona horaria
    const formattedDay = String(date.getUTCDate()).padStart(2, '0');
    const formattedMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const formattedYear = date.getUTCFullYear();
    
    return `${dayOfWeek} ${formattedDay}-${formattedMonth}-${formattedYear}`;
}

// Función para resaltar coincidencias en búsqueda
function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// Modificar la función openInfoModal para incluir toda la funcionalidad necesaria
async function openInfoModal(employeeId) {
    // Verificar si es el usuario actual
    if (employeeId === userData.IdPersonal) {
        Swal.fire({
            icon: 'info',
            title: 'Información',
            text: 'Esta es su información personal. No puede solicitar vacaciones para usted mismo.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Mostrar indicador de carga
    const loadingSwal = mostrarCargando('Cargando información...');
    
    // Buscar empleado por ID
    const employee = employeesData.find(emp => emp.IdPersonal === employeeId);
    
    if (!employee) {
        loadingSwal.close();
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró información del colaborador.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    try {
        // Obtener el historial de vacaciones del empleado
        const historialVacaciones = await obtenerHistorialVacaciones(employeeId);
        
        // Cerrar el loading
        loadingSwal.close();
        
        // Obtener el nombre completo
        const fullName = getFullName(employee);
        
        // Actualizar datos en el modal
        document.getElementById('infoEmployeeName').textContent = fullName;
        document.getElementById('infoEmployeePosition').textContent = employee.Nombre || 'Sin puesto asignado';
        document.getElementById('infoAvailableDays').textContent = `${employee.DiasVacaciones} días`;
        document.getElementById('infoEmployeeId').textContent = employee.IdPersonal;
        
        // Foto del empleado
        const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
        document.getElementById('infoEmployeePhoto').src = photoSrc;
        
        // Actualizar la tabla de historial con los datos obtenidos
        actualizarTablaHistorial(historialVacaciones);
        
        // Inicializar selectores de fecha con valores predeterminados
        const fechaInicio = document.getElementById('dateFilterStart');
        const fechaFin = document.getElementById('dateFilterEnd');
        
        if (fechaInicio && fechaFin) {
            // Establecer fechas por defecto (6 meses atrás hasta hoy)
            const hoy = new Date();
            const seisMesesAtras = new Date();
            seisMesesAtras.setMonth(hoy.getMonth() - 6);
            
            fechaInicio.value = formatFechaBaseDatosUTC(seisMesesAtras);
            fechaFin.value = formatFechaBaseDatosUTC(hoy);
        }
        
        // Agregar evento al botón de búsqueda de empleados
        const searchEmployeeBtn = document.getElementById('searchEmployeeBtn');
        if (searchEmployeeBtn) {
            // Eliminar eventos previos para evitar duplicados
            const newBtn = searchEmployeeBtn.cloneNode(true);
            searchEmployeeBtn.parentNode.replaceChild(newBtn, searchEmployeeBtn);
            
            newBtn.addEventListener('click', mostrarBuscadorEmpleados);
        }
        
        // Agregar evento al botón de filtrar fechas
        const filterDatesBtn = document.getElementById('filterDatesBtn');
        if (filterDatesBtn) {
            // Eliminar eventos previos para evitar duplicados
            const newBtn = filterDatesBtn.cloneNode(true);
            filterDatesBtn.parentNode.replaceChild(newBtn, filterDatesBtn);
            
            newBtn.addEventListener('click', function() {
                const employeeId = parseInt(document.getElementById('infoEmployeeId').textContent);
                const fechaInicio = document.getElementById('dateFilterStart').value;
                const fechaFin = document.getElementById('dateFilterEnd').value;
                
                filtrarHistorialPorFechas(employeeId, fechaInicio, fechaFin);
            });
        }
        
        // Mostrar el modal
        infoModal.style.display = 'block';
        setTimeout(() => {
            infoModal.classList.add('show');
        }, 10);
        
    } catch (error) {
        console.error('Error al cargar información del empleado:', error);
        loadingSwal.close();
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al cargar la información. Intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para formatear fecha para base de datos con UTC
function formatFechaBaseDatosUTC(fecha) {
    if (!fecha) return '';
    
    // Si es string, intentar convertir a Date
    if (typeof fecha === 'string') {
        fecha = new Date(fecha);
    }
    
    // Verificar que sea una fecha válida
    if (!(fecha instanceof Date) || isNaN(fecha)) {
        console.error('Fecha inválida:', fecha);
        return '';
    }
    
    // Usar la fecha UTC para evitar problemas de zona horaria
    const year = fecha.getUTCFullYear();
    const month = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const day = String(fecha.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}
// Funciones auxiliares finales
window.openVacationModal = openVacationModal;
window.openInfoModal = openInfoModal;

// Detectar cierre de la aplicación
window.addEventListener('beforeunload', function(e) {
    if (isGeneratingPDF || isClosingModal) {
        return;
    }
});

// Iniciar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', initApp);