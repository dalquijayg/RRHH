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

// Variables para el calendario
let calendar;
let selectedStartDate = null;
let selectedEndDate = null;
let selectedDays = [];
let fechasRegistradas = []; // Array para almacenar las fechas ya registradas

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
const departmentNameEl = document.getElementById('departmentName');
const departmentManagerEl = document.getElementById('departmentManager');
const pdfGeneratorModal = document.getElementById('pdfGeneratorModal');
const generatePdfBtn = document.getElementById('generatePdfBtn');


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

// Inicializar la aplicación
async function initApp() {
    try {
        // Mostrar un indicador de carga
        const loadingSwal = mostrarCargando('Cargando datos...');
        
        // Cargar datos del usuario que inició sesión
        loadUserData();
        
        // Cargar información del departamento
        await loadDepartmentInfo();
        
        // Cargar empleados del departamento
        await loadEmployees();
        
        // Cargar días especiales
        await loadSpecialDays();
        
        // Cargar fechas de Semana Santa
        loadHolyWeekDates();
        
        // Inicializar los eventos
        initEvents();
        
        // Cerrar el indicador de carga
        loadingSwal.close();
        
        // Mostrar mensaje de bienvenida
        Swal.fire({
            icon: 'success',
            title: 'Bienvenido al Sistema de Gestión de Vacaciones',
            text: 'Los datos se han cargado correctamente.',
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
        
        departmentId = userData.IdSucuDepa;
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

// Cargar información del departamento
async function loadDepartmentInfo() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT 
                departamentos.NombreDepartamento,
                COUNT(personal.IdPersonal) AS TotalEmpleados
            FROM 
                departamentos
                LEFT JOIN personal ON departamentos.IdDepartamento = personal.IdSucuDepa
            WHERE 
                departamentos.IdDepartamento = ?
            GROUP BY 
                departamentos.NombreDepartamento`;
        
        const result = await connection.query(query, [departmentId]);
        await connection.close();
        
        if (result.length > 0) {
            const departmentInfo = result[0];
            departmentNameEl.textContent = departmentInfo.NombreDepartamento;
            departmentManagerEl.textContent = departmentInfo.TotalEmpleados || '0';
        } else {
            throw new Error('No se encontró información del departamento');
        }
    } catch (error) {
        console.error('Error al cargar información del departamento:', error);
        throw error;
    }
}

// Cargar empleados del departamento
async function loadEmployees() {
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
        
        const result = await connection.query(query, [departmentId]);
        await connection.close();
        
        if (result.length > 0) {
            employeesData = result;
            filteredData = [...employeesData];
            renderEmployeesTable();
            updatePagination();
        } else {
            employeesTable.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px;">
                        <i class="fas fa-info-circle" style="font-size: 24px; color: #FF9800; margin-bottom: 10px;"></i>
                        <p>No hay colaboradores registrados en este departamento.</p>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error al cargar empleados:', error);
        throw error;
    }
}

// Función para cargar días especiales
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
        
        const result = await connection.query(query, [departmentId]);
        await connection.close();
        
        if (result.length > 0) {
            // Almacenar los días especiales en el array global
            specialDays = result.map(day => ({
                day: parseInt(day.Dia),
                month: parseInt(day.Mes),
                departmentId: parseInt(day.IdDepartamento),
                description: day.Descripcion
            }));
            
            console.log('Días especiales cargados:', specialDays);
            
            // Si el calendario ya está inicializado, actualizarlo
            if (calendar) {
                calendar.refetchEvents();
            }
        }
    } catch (error) {
        console.error('Error al cargar días especiales:', error);
        // No lanzar error para no interrumpir el flujo
    }
}

// Función para calcular la fecha de Pascua (Domingo de Resurrección)
function calculateEaster(year) {
    // Algoritmo de Butcher para calcular Pascua
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
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0 = enero, 1 = febrero, ...
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    return new Date(year, month, day);
}

// Función para obtener todas las fechas de Semana Santa
function getHolyWeekDates(year) {
    const easterSunday = calculateEaster(year);
    const holyWeekDates = [];
    
    // Domingo de Ramos (1 semana antes del Domingo de Pascua)
    const palmSunday = new Date(easterSunday);
    palmSunday.setDate(easterSunday.getDate() - 7);
    
    // Añadir días de Semana Santa (desde Domingo de Ramos hasta Sábado Santo)
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
    
    // También cargar para el próximo año si estamos cerca del final del año
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 10) { // Noviembre o Diciembre
        const nextYearDates = getHolyWeekDates(currentYear + 1);
        holyWeekDates = [...holyWeekDates, ...nextYearDates];
    }
    
    console.log('Fechas de Semana Santa cargadas:', holyWeekDates);
}
// Función para verificar si una fecha es día especial
function isSpecialDay(date) {
    if (!date || !specialDays || specialDays.length === 0) return false;
    
    const day = date.getDate();
    const month = date.getMonth() + 1; // getMonth() devuelve 0-11
    
    return specialDays.some(specialDay => 
        specialDay.day === day && specialDay.month === month
    );
}

// Función para obtener la descripción de un día especial
function getSpecialDayDescription(date) {
    if (!date || !specialDays || specialDays.length === 0) return '';
    
    const day = date.getDate();
    const month = date.getMonth() + 1; // getMonth() devuelve 0-11
    
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
        // Obtener el nombre completo
        const fullName = getFullName(employee);
        
        // Formato de fecha
        const hireDate = formatDate(employee.FechaPlanilla);
        
        // Foto del empleado
        const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
        
        // Verificar si es el usuario actual
        const isCurrentUser = employee.IdPersonal === userData.IdPersonal;
        
        // Crear fila
        const row = document.createElement('tr');
        row.setAttribute('data-id', employee.IdPersonal);
        
        // Si es el usuario actual, agregar una clase para destacar la fila
        if (isCurrentUser) {
            row.classList.add('current-user-row');
        }
        
        // Aplicar clase de animación a cada fila con un retardo incremental
        row.classList.add('animate-in');
        row.style.animationDelay = `${(currentPageData.indexOf(employee) * 0.05)}s`;
        
        // Contenido de la celda de acciones
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
        
        // Estilo para los días disponibles según la cantidad
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
        
        // Contenido de la fila
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
    
    // Actualizar indicadores de ordenamiento
    updateSortIndicators();
}

// Actualizar paginación
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    pageIndicator.textContent = `Página ${currentPage} de ${totalPages || 1}`;
    
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// Función para filtrar los datos
function filterData() {
    const searchTerm = searchInput.value.toLowerCase();
    
    filteredData = employeesData.filter(employee => {
        // Nombre completo para búsqueda
        const fullName = getFullName(employee).toLowerCase();
        
        // Puesto para búsqueda
        const position = (employee.Nombre || '').toLowerCase();
        
        // Filtro por nombre o puesto
        return fullName.includes(searchTerm) || position.includes(searchTerm);
    });
    
    // Resetear a la primera página
    currentPage = 1;
    
    // Aplicar ordenamiento actual si existe
    if (currentSort.column) {
        sortData(currentSort.column, false); // No cambiar dirección
    } else {
        // Renderizar tabla y actualizar paginación
        renderEmployeesTable();
        updatePagination();
    }
}

// Agregar función para ordenar datos
function sortData(column, toggleDirection = true) {
    if (toggleDirection && currentSort.column === column) {
        // Cambiar dirección si ya estamos ordenando por esta columna
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // Nueva columna, establecer dirección predeterminada
        currentSort.column = column;
        if (toggleDirection || !currentSort.direction) {
            currentSort.direction = 'asc';
        }
    }
    
    // Ordenar los datos según la columna y dirección
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
        
        // Aplicar dirección de ordenamiento
        const sortFactor = currentSort.direction === 'asc' ? 1 : -1;
        
        if (valueA < valueB) return -1 * sortFactor;
        if (valueA > valueB) return 1 * sortFactor;
        return 0;
    });
    
    // Actualizamos los indicadores visuales en el encabezado
    updateSortIndicators();
    
    // Renderizar tabla con nuevos datos ordenados
    renderEmployeesTable();
    updatePagination();
}

// Actualizar indicadores visuales de ordenamiento en el encabezado
function updateSortIndicators() {
    // Eliminar todas las clases de ordenamiento
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    // Agregar clase según ordenamiento actual
    if (currentSort.column) {
        const th = document.querySelector(`th[data-sort="${currentSort.column}"]`);
        if (th) {
            th.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }
}

// Formatear fecha para la base de datos (YYYY-MM-DD) - versión mejorada
function formatFechaBaseDatos(fecha) {
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
    
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Función para limpiar el modal de elementos duplicados
function clearVacationModal() {
    // Eliminar elementos que podrían duplicarse
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

// Función para obtener las fechas de vacaciones ya registradas para un empleado
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
        
        // Transformar los resultados en un array de fechas
        const fechasRegistradas = result.map(row => row.FechaFormateada);
        
        console.log('Fechas registradas obtenidas:', fechasRegistradas); // Para depuración
        
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
    // Convertir la fecha de planilla a un objeto Date
    const fechaInicioPlanilla = new Date(fechaPlanilla);
    
    // Ajustar la fecha para el inicio del período (siguiente día después de la fecha de planilla)
    const fechaInicioPrimerPeriodo = new Date(fechaInicioPlanilla);
    fechaInicioPrimerPeriodo.setDate(fechaInicioPrimerPeriodo.getDate() + 1);
    
    // Calcular el inicio del período solicitado (avanzando los años indicados en offsetAnios)
    const fechaInicioPeriodo = new Date(fechaInicioPrimerPeriodo);
    fechaInicioPeriodo.setFullYear(fechaInicioPrimerPeriodo.getFullYear() + offsetAnios);
    
    // Calcular el fin del período (un año menos un día después del inicio)
    const fechaFinPeriodo = new Date(fechaInicioPeriodo);
    fechaFinPeriodo.setFullYear(fechaFinPeriodo.getFullYear() + 1);
    fechaFinPeriodo.setDate(fechaFinPeriodo.getDate() - 1);
    
    // Formatear las fechas como YYYY-MM-DD
    const formatoInicio = formatFechaBaseDatos(fechaInicioPeriodo);
    const formatoFin = formatFechaBaseDatos(fechaFinPeriodo);
    
    // Retornar el período formateado como texto
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
        
        // Iterar a través de todos los períodos posibles, empezando por el más antiguo
        for (let i = 0; i <= aniosCumplidos; i++) {
            const periodo = calcularPeriodo(fechaPlanilla, i);
            
            // Obtener días utilizados (tomados)
            const queryDiasTomados = `
                SELECT COUNT(*) as DiasUtilizados
                FROM vacacionestomadas
                WHERE IdPersonal = ? AND Periodo = ?
            `;
            const resultDiasTomados = await connection.query(queryDiasTomados, [empleado.IdPersonal, periodo]);
            
            // Obtener días pagados
            const queryDiasPagados = `
                SELECT IFNULL(SUM(CAST(DiasSolicitado AS UNSIGNED)), 0) as DiasPagados
                FROM vacacionespagadas
                WHERE IdPersonal = ? AND Periodo = ? AND Estado IN (1,2,3,4)
            `;
            const resultDiasPagados = await connection.query(queryDiasPagados, [empleado.IdPersonal, periodo]);
            
            // Convertir valores
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
            
            // Calcular días disponibles considerando tanto tomados como pagados
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
        
        // Si no hay períodos con días disponibles, crear uno nuevo para el siguiente año
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


// Abrir modal de solicitud de vacaciones (corregido para evitar duplicación)
async function openVacationModal(employeeId) {
    // Verificar si es el usuario actual
    if (employeeId === userData.IdPersonal) {
        Swal.fire({
            icon: 'error',
            title: 'Operación no permitida',
            text: 'No puede solicitar vacaciones para usted mismo.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }

    // Buscar empleado por ID
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
    
    // Mostrar indicador de carga
    const loadingSwal = mostrarCargando('Verificando información...');
    
    try {
        // Obtener información detallada de todos los períodos disponibles
        const periodosInfo = await obtenerPeriodosDisponibles(employee);
        
        // Obtener el total de días disponibles
        const totalDiasDisponibles = periodosInfo.totalDiasDisponibles;
        
        // También obtener el total de días acumulados según el cálculo de la tabla principal
        const totalDiasAcumulados = parseInt(employee.DiasVacaciones || 0);
        
        // Obtener las fechas ya registradas para este empleado
        fechasRegistradas = await obtenerFechasRegistradas(employeeId);
        
        loadingSwal.close();
        
        // Si no hay días disponibles, notificar al usuario
        if (totalDiasDisponibles <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin días disponibles',
                html: `<p>El colaborador no tiene días de vacaciones disponibles.</p>`,
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Limpiar el modal de cualquier contenido previo
        clearVacationModal();
        
        // Obtener el nombre completo
        const fullName = getFullName(employee);
        
        // Actualizar datos en el modal
        document.getElementById('modalEmployeeName').textContent = fullName;
        document.getElementById('modalEmployeePosition').textContent = employee.Nombre || 'Sin puesto asignado';
        
        // Usar el total de días acumulados
        document.getElementById('modalAvailableDays').textContent = totalDiasAcumulados;
        
        // Foto del empleado
        const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
        document.getElementById('modalEmployeePhoto').src = photoSrc;
        
        // Crear contenedor para la información adicional
        const infoContainer = document.createElement('div');
        infoContainer.className = 'vacation-info-container';
        
        // Mostrar el mínimo de días requeridos si es mayor que cero
        const diasMinimos = parseInt(employee.DiasMinVacaciones || 0);
        if (diasMinimos > 0) {
            const minDaysInfo = document.createElement('div');
            minDaysInfo.className = 'min-days-info';
            minDaysInfo.innerHTML = `<i class="fas fa-info-circle"></i> Mínimo: ${diasMinimos} días por solicitud`;
            
            // Si los días disponibles son menos que el mínimo, mostrar una nota
            if (totalDiasDisponibles < diasMinimos) {
                minDaysInfo.innerHTML += `<div class="min-days-note">Tiene menos días disponibles que el mínimo requerido. Se le permitirá tomar los ${totalDiasDisponibles} días restantes.</div>`;
            }
            
            infoContainer.appendChild(minDaysInfo);
        }
        
        // Si hay períodos con días disponibles, mostrar información sobre ellos
        if (periodosInfo.periodos.length > 0) {
            // Crear el contenedor de información de períodos
            const periodosContainer = document.createElement('div');
            periodosContainer.className = 'periodos-container';
            
            // Mostrar información detallada de cada período
            periodosInfo.periodos.forEach(periodo => {
                const periodoInfo = document.createElement('div');
                periodoInfo.className = 'periodo-info-item';
                
                periodosContainer.appendChild(periodoInfo);
            });
            
            infoContainer.appendChild(periodosContainer);
        }
        
        // Añadir el contenedor de información después del badge de días disponibles
        const infoPlaceholder = document.querySelector('.employee-info');
        if (infoPlaceholder) {
            infoPlaceholder.appendChild(infoContainer);
        }
        
        // Resetear selección de fechas
        selectedStartDate = null;
        selectedEndDate = null;
        selectedDays = [];
        document.getElementById('selectedStartDate').textContent = "No seleccionado";
        document.getElementById('selectedEndDate').textContent = "No seleccionado";
        document.getElementById('selectedDays').textContent = "0 días";
        
        // Limpiar visualización de días
        document.getElementById('daysVisual').innerHTML = '';
        
        // Guardar el ID del empleado y período en el formulario
        document.getElementById('vacationForm').setAttribute('data-employee-id', employeeId);
        
        // Guardar el primer período disponible (el más antiguo) para referencias
        if (periodosInfo.periodos.length > 0) {
            document.getElementById('vacationForm').setAttribute('data-periodo', periodosInfo.periodos[0].periodo);
        }
        
        // Mostrar el modal con animación
        vacationModal.style.display = 'block';
        setTimeout(() => {
            vacationModal.classList.add('show');
            
            // Inicializar el calendario
            initCalendar();
            
            // Forzar redibujado del calendario
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

// Inicializar el calendario (actualizado)
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
        fixedWeekCount: false, // Mostrar solo las semanas del mes actual
        showNonCurrentDates: true, // Mostrar días de meses adyacentes
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: ''
        },
        dateClick: function(info) {
            // Verificar si la fecha está ya registrada
            const fechaSeleccionada = formatFechaBaseDatos(info.date);
            if (fechasRegistradas.includes(fechaSeleccionada)) {
                // Mostrar mensaje de advertencia
                Swal.fire({
                    icon: 'warning',
                    title: 'Fecha no disponible',
                    text: 'Esta fecha ya ha sido registrada como vacaciones para este colaborador.',
                    confirmButtonColor: '#FF9800'
                });
                return;
            }

            // Para selección de un solo clic si la fecha es válida
            const clickedDate = info.date;
            handleDateSelection(clickedDate, clickedDate);
        },
        select: function(info) {
            // Para selección por arrastre, verificar que ninguna fecha seleccionada esté ya registrada
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
                // Mostrar mensaje con las fechas no disponibles
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
                calendar.unselect(); // Deshacer la selección
                return;
            }
            
            // Si todas las fechas están disponibles, proceder con la selección
            handleDateSelection(info.start, info.end);
        },
        selectAllow: function(selectInfo) {
            // Solo permitir selección de fechas futuras
            return selectInfo.start >= new Date();
        },
        dayCellClassNames: function(arg) {
            // Añadir clases a días específicos
            const date = arg.date;
            const day = date.getDay();
            const dateStr = formatFechaBaseDatos(date);
            const classes = [];
            
            // Fines de semana
            if (day === 0 || day === 6) {
                classes.push('weekend-day');
            }
            
            // Días especiales
            if (isSpecialDay(date)) {
                classes.push('special-day');
            }
            
            // Días de Semana Santa
            if (isHolyWeekDay(date)) {
                classes.push('holy-week-day');
            }
            
            // Días ya registrados como vacaciones
            if (fechasRegistradas.includes(dateStr)) {
                classes.push('registered-vacation-day');
            }
            
            return classes;
        }
    });
    
    calendar.render();
    
    // Añadir clase especial para mejorar la visualización del calendario
    const calendarContainer = document.querySelector('.calendar-container');
    calendarContainer.classList.add('full-calendar-view');
    
    // Asegurar que el calendario se ajuste correctamente
    setTimeout(() => {
        calendar.updateSize();
    }, 100);
}

// Manejar la selección de fechas con validación adicional
function handleDateSelection(start, end) {
    // Verificar que ninguna fecha en el rango esté ya registrada
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
        // Notificar al usuario y cancelar la selección
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
    
    // Para selección de un solo día (cuando se hace clic en una fecha)
    // Si start y end son iguales o end es el día siguiente (como hace FullCalendar), tratarlo como un solo día
    let adjustedEnd;
    
    if (start.getTime() === end.getTime() || 
        (end.getTime() - start.getTime() === 86400000 && start.getDate() === end.getDate() - 1)) {
        // Es una selección de un solo día
        adjustedEnd = new Date(start);
    } else {
        // Es una selección por arrastre, ajustar la fecha final
        adjustedEnd = new Date(end);
        adjustedEnd.setDate(adjustedEnd.getDate() - 1);
    }
    
    selectedStartDate = new Date(start);
    selectedEndDate = new Date(adjustedEnd);
    
    // Formatear fechas para mostrar
    const startFormatted = formatDate(selectedStartDate);
    const endFormatted = formatDate(selectedEndDate);
    
    // Actualizar texto de fechas seleccionadas
    document.getElementById('selectedStartDate').textContent = startFormatted;
    document.getElementById('selectedEndDate').textContent = endFormatted;
    
    // Calcular días hábiles
    calculateWorkingDays();
    
    // Mostrar visualización de días
    renderDaysVisualization();
    
    // Verificar días mínimos requeridos si se ha seleccionado algún día
    verificarDiasMinimos();
}

// Calcular días hábiles excluyendo también las fechas ya registradas
function calculateWorkingDays() {
    if (!selectedStartDate || !selectedEndDate) {
        document.getElementById('selectedDays').textContent = "0 días";
        return;
    }
    
    selectedDays = [];
    let currentDate = new Date(selectedStartDate);
    
    while (currentDate <= selectedEndDate) {
        const dayOfWeek = currentDate.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6); // 0 = domingo, 6 = sábado
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
    
    // Contar días hábiles (no fines de semana, no días especiales, no días ya registrados)
    const workingDays = selectedDays.filter(day => 
        !day.isWeekend && !day.isSpecial && !day.isHolyWeek && !day.isRegistered).length;
    
    // Actualizar el contador
    document.getElementById('selectedDays').textContent = `${workingDays} días`;
}

// Función para verificar si se cumple el mínimo de días requeridos (adaptada al nuevo enfoque)
function verificarDiasMinimos() {
    // Obtener el ID del empleado del formulario
    const employeeId = parseInt(document.getElementById('vacationForm').getAttribute('data-employee-id'));
    
    // Buscar el empleado
    const employee = employeesData.find(emp => emp.IdPersonal === employeeId);
    if (!employee) return;
    
    // Obtener el mínimo de días requeridos
    const diasMinimos = parseInt(employee.DiasMinVacaciones || 0);
    if (diasMinimos <= 0) return; // No hay mínimo requerido
    
    // Obtener los días seleccionados (solo días hábiles)
    const workingDays = selectedDays.filter(day => 
        !day.isWeekend && !day.isSpecial && !day.isHolyWeek && !day.isRegistered).length;
    
    // Obtener el elemento que muestra el total de días
    const totalDaysElement = document.getElementById('selectedDays');
    
    // Determinar los días disponibles (del badge que ya se mostró)
    const diasDisponibles = parseInt(document.getElementById('modalAvailableDays').textContent || 0);
    
    // Verificar todos los casos posibles
    if (workingDays === 0) {
        // No ha seleccionado días aún
        totalDaysElement.classList.remove('days-warning', 'days-success');
        totalDaysElement.removeAttribute('data-tooltip');
    } else if (workingDays < diasMinimos && diasDisponibles >= diasMinimos) {
        // Caso 1: Seleccionó menos del mínimo y hay más días disponibles
        totalDaysElement.classList.add('days-warning');
        totalDaysElement.classList.remove('days-success');
        totalDaysElement.setAttribute('data-tooltip', `Debe seleccionar al menos ${diasMinimos} días`);
    } else if (workingDays < diasMinimos && diasDisponibles < diasMinimos && workingDays === diasDisponibles) {
        // Caso 2: Seleccionó todos los días disponibles cuando hay menos que el mínimo
        totalDaysElement.classList.remove('days-warning');
        totalDaysElement.classList.add('days-success');
        totalDaysElement.setAttribute('data-tooltip', `Tomando todos los días disponibles`);
    } else if (workingDays < diasMinimos && diasDisponibles < diasMinimos && workingDays < diasDisponibles) {
        // Caso 3: Seleccionó menos del mínimo y también menos que los disponibles
        totalDaysElement.classList.add('days-warning');
        totalDaysElement.classList.remove('days-success');
        totalDaysElement.setAttribute('data-tooltip', `Debe tomar todos los ${diasDisponibles} días disponibles`);
    } else {
        // Cumple con el mínimo requerido
        totalDaysElement.classList.remove('days-warning');
        totalDaysElement.classList.add('days-success');
        totalDaysElement.setAttribute('data-tooltip', `Cumple con el mínimo requerido`);
    }
}

// Crear visualización de días seleccionados (con indicador de días ya registrados)
function renderDaysVisualization() {
    const daysVisualEl = document.getElementById('daysVisual');
    daysVisualEl.innerHTML = '';
    
    if (selectedDays.length === 0) {
        daysVisualEl.innerHTML = '<p class="no-days">No hay días seleccionados.</p>';
        return;
    }
    
    // Versión más compacta para ahorrar espacio
    const workingDays = selectedDays.filter(day => 
        !day.isWeekend && !day.isSpecial && !day.isHolyWeek && !day.isRegistered);
    const weekendDays = selectedDays.filter(day => day.isWeekend);
    const specialDays = selectedDays.filter(day => day.isSpecial);
    const holyWeekDays = selectedDays.filter(day => day.isHolyWeek);
    const registeredDays = selectedDays.filter(day => day.isRegistered);
    
    // Mostrar días válidos de forma más compacta
    if (workingDays.length > 0) {
        const workdaysContainer = document.createElement('div');
        workdaysContainer.className = 'mini-days-container';
        
        workingDays.forEach((day, index) => {
            const dayBox = document.createElement('div');
            dayBox.className = 'day-box vacation';
            dayBox.textContent = day.date.getDate();
            
            // Añadir solo los primeros 10 días para ahorrar espacio
            if (index < 10) {
                workdaysContainer.appendChild(dayBox);
            }
        });
        
        // Si hay más de 10 días, mostrar indicador
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
    
    // Añadir resumen ultra compacto
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
        ${specialDays.length > 0 ? `
        <div class="mini-summary-item">
            <i class="fas fa-calendar-day"></i> ${specialDays.length} especiales
        </div>
        ` : ''}
        ${holyWeekDays.length > 0 ? `
        <div class="mini-summary-item">
            <i class="fas fa-church"></i> ${holyWeekDays.length} Semana Santa
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

// Guardar los días de vacaciones en la base de datos, distribuyendo entre períodos
async function guardarDiasVacaciones(empleado, diasSeleccionados, periodosDisponibles) {
    try {
        const connection = await connectionString();
        
        // Nombre completo del empleado
        const nombreCompleto = getFullName(empleado);
        
        // Información del usuario que registra
        const idUsuario = userData.IdPersonal;
        const nombreUsuario = userData.NombreCompleto;
        
        // Preparar consulta de inserción
        const query = `
            INSERT INTO vacacionestomadas 
            (IdPersonal, NombrePersonal, Periodo, IdPlanilla, IdDepartamento, FechasTomadas, IdUsuario, NombreUsuario)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        // Filtrar solo los días válidos para vacaciones
        const diasValidos = diasSeleccionados.filter(day => day.isVacation);
        
        // Si no hay días válidos, retornar
        if (diasValidos.length === 0) {
            return true;
        }
        
        // Obtener períodos ordenados por antigüedad
        const periodos = periodosDisponibles.periodos;
        
        // Contador para llevar el control de cuántos días hemos asignado
        let diasAsignados = 0;
        let periodoActual = 0;
        
        // Distribuir los días entre los períodos disponibles
        while (diasAsignados < diasValidos.length && periodoActual < periodos.length) {
            const periodoInfo = periodos[periodoActual];
            const diasDisponiblesEnPeriodo = periodoInfo.diasDisponibles;
            
            // Calcular cuántos días vamos a asignar a este período
            const diasAAsignar = Math.min(diasDisponiblesEnPeriodo, diasValidos.length - diasAsignados);
            
            // Asignar los días a este período
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
            
            // Actualizar el contador de días asignados
            diasAsignados += diasAAsignar;
            
            // Pasar al siguiente período
            periodoActual++;
        }
        
        await connection.close();
        for (const periodo of periodosDisponibles.periodos) {
            const estaCompleto = await verificarPeriodoCompleto(empleado, periodo.periodo);
            
            if (estaCompleto) {
                // Generar PDF automáticamente
                await generarPDFPeriodoCompleto(empleado, periodo.periodo);
                
                // Notificar al usuario
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
        // Actualizar los días disponibles del empleado en la interfaz
        await actualizarDiasDisponibles(empleado.IdPersonal);
        
        return true;
        
    } catch (error) {
        console.error('Error al guardar días de vacaciones:', error);
        throw error;
    }
}
// Modificar la función guardarSolicitudVacaciones para usar la distribución entre períodos
async function guardarSolicitudVacaciones(event) {
    event.preventDefault();
    
    const employeeId = parseInt(document.getElementById('vacationForm').getAttribute('data-employee-id'));
    
    // Verificar si es el usuario actual (como medida de seguridad adicional)
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
    
    // Contar días hábiles (excluyendo fines de semana, días especiales y Semana Santa)
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
    
    // Buscar empleado por ID
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
    
    // Determinar los períodos disponibles y el total de días
    try {
        // Obtener información detallada de todos los períodos disponibles
        const periodosInfo = await obtenerPeriodosDisponibles(employee);
        
        // Verificar que haya días disponibles suficientes en total
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
        
        // Comprobar si se distribuirán los días en varios períodos
        let distribucionPeriodos = "";
        let diasRestantes = workingDays;
        let periodoDistribucion = [];
        
        // Calcular cómo se distribuirán los días entre períodos
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
        
        // Si hay más de un período involucrado, mostrar la distribución
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
        
        // Verificar el mínimo de días requeridos
        const diasMinimos = parseInt(employee.DiasMinVacaciones || 0);
        
        // Validación del mínimo de días
        if (diasMinimos > 0) {
            // Caso 1: Si seleccionó menos del mínimo y hay más días disponibles que el mínimo
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
            
            // Caso 2: Si seleccionó menos del mínimo y hay menos días disponibles que el mínimo
            // pero está tomando EXACTAMENTE todos los días disponibles, sí permitirlo
            if (workingDays < diasMinimos && periodosInfo.totalDiasDisponibles < diasMinimos && workingDays === periodosInfo.totalDiasDisponibles) {
                // Este caso es válido - está tomando todos los días disponibles cuando son menos que el mínimo
                console.log('Permitiendo solicitud con menos del mínimo porque son todos los días disponibles');
            }
            
            // Caso 3: Si seleccionó menos del mínimo y hay menos días disponibles que el mínimo
            // pero NO está tomando todos los días disponibles, no permitirlo
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
        
        // Confirmar solicitud
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
            // Mostrar carga
            const loadingSwal = mostrarCargando('Guardando solicitud...');
            
            try {
                // Obtener solo los días hábiles de trabajo
                const diasHabiles = selectedDays.filter(day => 
                    !day.isWeekend && !day.isSpecial && !day.isHolyWeek && !day.isRegistered);
                
                // Guardar cada día hábil como un registro separado, distribuyendo entre períodos
                await guardarDiasVacaciones(employee, diasHabiles, periodosInfo);
                
                loadingSwal.close();
                
                // Notificar éxito
                await Swal.fire({
                    icon: 'success',
                    title: 'Vacaciones guardadas',
                    text: 'La solicitud de vacaciones ha sido registrada correctamente.',
                    confirmButtonColor: '#4CAF50'
                });
                
                // Cerrar modal y actualizar datos
                vacationModal.classList.remove('show');
                
                // Actualizar los datos inmediatamente
                await loadEmployees();
                
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

// Función para actualizar los días disponibles de un empleado específico
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
            // Actualizar el valor en el array de empleados
            const index = employeesData.findIndex(emp => emp.IdPersonal === idPersonal);
            if (index !== -1) {
                employeesData[index].DiasVacaciones = result[0].DiasVacaciones;
                
                // También actualizar en los datos filtrados
                const filteredIndex = filteredData.findIndex(emp => emp.IdPersonal === idPersonal);
                if (filteredIndex !== -1) {
                    filteredData[filteredIndex].DiasVacaciones = result[0].DiasVacaciones;
                }
                
                // Volver a renderizar la tabla
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
    
    // Buscar empleado por ID
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
    
    // Obtener el nombre completo
    const fullName = getFullName(employee);
    
    // Actualizar datos en el modal
    document.getElementById('infoEmployeeName').textContent = fullName;
    document.getElementById('infoEmployeePosition').textContent = employee.Nombre || 'Sin puesto asignado';
    document.getElementById('infoHireDate').textContent = formatDate(employee.FechaPlanilla);
    document.getElementById('infoYearsService').textContent = `${employee.AniosCumplidos} años`;
    document.getElementById('infoAvailableDays').textContent = `${employee.DiasVacaciones} días`;
    document.getElementById('infoEmployeeId').textContent = employee.IdPersonal;
    
    // Foto del empleado
    const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
    document.getElementById('infoEmployeePhoto').src = photoSrc;
    
    // Mostrar el modal
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
    
    // Obtener día con ceros a la izquierda
    const day = String(date.getDate()).padStart(2, '0');
    // Obtener mes con ceros a la izquierda (los meses en JS son 0-11)
    const month = String(date.getMonth() + 1).padStart(2, '0');
    // Obtener año completo
    const year = date.getFullYear();
    
    // Formato día/mes/año
    return `${day}/${month}/${year}`;
}

// Inicializar eventos
function initEvents() {
    // Búsqueda
    searchInput.addEventListener('input', filterData);
    
    // Paginación
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderEmployeesTable();
            updatePagination();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderEmployeesTable();
            updatePagination();
        }
    });
    
    // Agregar evento de ordenación a los encabezados
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            sortData(column);
        });
    });
    
    // Botón de actualizar
    refreshBtn.addEventListener('click', async () => {
        const loadingSwal = mostrarCargando('Actualizando datos...');
        try {
            await loadEmployees();
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
    
    // Botón de exportar
    exportBtn.addEventListener('click', exportToExcel);
    
    // Cerrar modales
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            vacationModal.classList.remove('show');
            infoModal.classList.remove('show');
            setTimeout(() => {
                vacationModal.style.display = 'none';
                infoModal.style.display = 'none';
            }, 300);
        });
    });
    
    // Cerrar modales al hacer clic fuera de ellos
    window.addEventListener('click', (event) => {
        if (event.target === vacationModal) {
            vacationModal.classList.remove('show');
            setTimeout(() => {
                vacationModal.style.display = 'none';
            }, 300);
        }
        if (event.target === infoModal) {
            infoModal.classList.remove('show');
            setTimeout(() => {
                infoModal.style.display = 'none';
            }, 300);
        }
    });
    
    // Formulario de solicitud de vacaciones
    const vacationForm = document.getElementById('vacationForm');
    vacationForm.addEventListener('submit', guardarSolicitudVacaciones);
    
    // También actualizar el botón de enviar solicitud
    document.getElementById('submitVacationBtn').addEventListener('click', function(e) {
        e.preventDefault();
        vacationForm.dispatchEvent(new Event('submit'));
    });
    
    // Botón solicitar vacaciones desde modal de información
    if (document.getElementById('infoRequestVacationBtn')) {
        document.getElementById('infoRequestVacationBtn').addEventListener('click', () => {
            const employeeId = document.getElementById('infoEmployeeId').textContent;
            infoModal.classList.remove('show');
            setTimeout(() => {
                infoModal.style.display = 'none';
                openVacationModal(parseInt(employeeId));
            }, 300);
        });
    }
    
    // Teclas de atajo
    document.addEventListener('keydown', (e) => {
        // Escape para cerrar modales
        if (e.key === 'Escape') {
            if (vacationModal.classList.contains('show')) {
                vacationModal.classList.remove('show');
                setTimeout(() => {
                    vacationModal.style.display = 'none';
                }, 300);
            }
            if (infoModal.classList.contains('show')) {
                infoModal.classList.remove('show');
                setTimeout(() => {
                    infoModal.style.display = 'none';
                }, 300);
            }
        }
        
        // Ctrl+F para enfocar la búsqueda
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
    });
    generatePdfBtn.addEventListener('click', openPdfGeneratorModal);
    
    // Selección de empleado
    document.getElementById('pdfEmployeeSelect').addEventListener('change', handleEmployeeSelection);
    
    // Selección de período
    document.getElementById('pdfPeriodSelect').addEventListener('change', handlePeriodSelection);
    
    // Botón para generar PDF seleccionado
    document.getElementById('generateSelectedPdfBtn').addEventListener('click', generateSelectedPdf);
    
    // Botón cancelar
    document.getElementById('cancelPdfBtn').addEventListener('click', () => {
        pdfGeneratorModal.classList.remove('show');
        setTimeout(() => {
            pdfGeneratorModal.style.display = 'none';
        }, 300);
    });
    
    // Cerrar modal con X
    pdfGeneratorModal.querySelector('.close-modal').addEventListener('click', () => {
        pdfGeneratorModal.classList.remove('show');
        setTimeout(() => {
            pdfGeneratorModal.style.display = 'none';
        }, 300);
    });
}

// Exportar a Excel
async function exportToExcel() {
    try {
        // Mostrar indicador de carga
        const loadingSwal = mostrarCargando('Generando reporte...');
        
        // Crear un nuevo libro de Excel
        const workbook = new ExcelJS.Workbook();
        
        // Añadir propiedades del documento
        workbook.creator = userData.NombreCompleto;
        workbook.created = new Date();
        workbook.modified = new Date();
        
        // Crear una hoja
        const worksheet = workbook.addWorksheet('Vacaciones');
        
        // Estilo del encabezado
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
        
        // Estilo para filas alternas
        const evenRowStyle = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } }
        };
        
        // Definir columnas
        worksheet.columns = [
            { header: 'ID', key: 'idPersonal', width: 10 },
            { header: 'Nombre Completo', key: 'nombreCompleto', width: 30 },
            { header: 'Fecha de Ingreso', key: 'fechaIngreso', width: 15 },
            { header: 'Años de Servicio', key: 'aniosServicio', width: 15 },
            { header: 'Días Disponibles', key: 'diasDisponibles', width: 15 },
            { header: 'Puesto', key: 'puesto', width: 20 }
        ];
        
        // Aplicar estilo al encabezado
        worksheet.getRow(1).eachCell((cell) => {
            cell.style = headerStyle;
        });
        
        // Agregar datos
        filteredData.forEach((employee, index) => {
            // Nombre completo
            const fullName = getFullName(employee);
            
            // Fechas
            const hireDate = formatDate(employee.FechaPlanilla);
            
            // Agregar fila
            const row = worksheet.addRow({
                idPersonal: employee.IdPersonal,
                nombreCompleto: fullName,
                fechaIngreso: hireDate,
                aniosServicio: `${employee.AniosCumplidos} años`,
                diasDisponibles: `${employee.DiasVacaciones} días`,
                puesto: employee.Nombre || 'Sin puesto'
            });
            
            // Alternar colores de fila
            if (index % 2 !== 0) {
                row.eachCell((cell) => {
                    cell.style = evenRowStyle;
                });
            }
        });
        
        // Título del reporte
        worksheet.spliceRows(1, 0, []);
        worksheet.spliceRows(1, 0, [`REPORTE DE VACACIONES - ${departmentNameEl.textContent.toUpperCase()}`]);
        worksheet.spliceRows(2, 0, [`Fecha de generación: ${new Date().toLocaleDateString('es-GT')} ${new Date().toLocaleTimeString('es-GT')}`]);
        worksheet.spliceRows(3, 0, []);
        
        // Estilo del título
        worksheet.mergeCells('A1:F1');
        worksheet.mergeCells('A2:F2');
        
        const titleCell = worksheet.getCell('A1');
        titleCell.font = { bold: true, size: 16, color: { argb: 'FF654321' } };
        titleCell.alignment = { horizontal: 'center' };
        
        const dateCell = worksheet.getCell('A2');
        dateCell.font = { italic: true, size: 12, color: { argb: 'FF777777' } };
        dateCell.alignment = { horizontal: 'center' };
        
        // Agregar pie de página con información del usuario que generó el reporte
        const lastRow = worksheet.lastRow.number + 2;
        worksheet.addRow([`Generado por: ${userData.NombreCompleto}`]);
        const footerCell = worksheet.getCell(`A${lastRow}`);
        footerCell.font = { italic: true, color: { argb: 'FF777777' } };
        
        // Generar el archivo
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Cerrar indicador de carga
        loadingSwal.close();
        
        // Crear un Blob con el contenido del Excel
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Crear un enlace para descargar el archivo
        const a = document.createElement('a');
        const url = window.URL.createObjectURL(blob);
        
        // Construir nombre de archivo con fecha
        const date = new Date();
        const formattedDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
        const fileName = `Vacaciones_${departmentNameEl.textContent.replace(/\s+/g, '_')}_${formattedDate}.xlsx`;
        
        a.href = url;
        a.download = fileName;
        a.click();
        
        // Limpiar el objeto URL
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 0);
        
        // Notificar éxito
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

// Función para mostrar una animación de carga
function  mostrarCargando(mensaje = "Cargando...") {
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
// Función para verificar si un período está completo (15 días tomados/pagados)
async function verificarPeriodoCompleto(empleado, periodo) {
    try {
        const connection = await connectionString();
        
        // Verificar días tomados
        const queryDiasTomados = `
            SELECT COUNT(*) as DiasUtilizados
            FROM vacacionestomadas
            WHERE IdPersonal = ? AND Periodo = ?
        `;
        const resultDiasTomados = await connection.query(queryDiasTomados, [empleado.IdPersonal, periodo]);
        
        // Verificar días pagados
        const queryDiasPagados = `
            SELECT IFNULL(SUM(CAST(DiasSolicitado AS UNSIGNED)), 0) as DiasPagados
            FROM vacacionespagadas
            WHERE IdPersonal = ? AND Periodo = ? AND Estado IN (1,2,3,4)
        `;
        const resultDiasPagados = await connection.query(queryDiasPagados, [empleado.IdPersonal, periodo]);
        
        const diasTomados = parseInt(resultDiasTomados[0].DiasUtilizados) || 0;
        const diasPagados = parseInt(resultDiasPagados[0].DiasPagados) || 0;
        
        await connection.close();
        
        // Si los días tomados + pagados = 15, el período está completo
        return (diasTomados + diasPagados) === 15;
        
    } catch (error) {
        console.error('Error al verificar período completo:', error);
        return false;
    }
}
// Función para obtener los detalles del período para el PDF
async function obtenerDetallesPeriodo(empleado, periodo) {
    console.log('=== INICIO obtenerDetallesPeriodo ===');
    console.log('Empleado:', empleado);
    console.log('Período:', periodo);
    
    try {
        const connection = await connectionString();
        
        // Obtener fechas tomadas
        const queryFechasTomadas = `
            SELECT FechasTomadas
            FROM vacacionestomadas
            WHERE IdPersonal = ? AND Periodo = ?
            ORDER BY FechasTomadas
        `;
        
        const fechasTomadas = await connection.query(queryFechasTomadas, [empleado.IdPersonal, periodo]);
        
        // Obtener días pagados
        const queryDiasPagados = `
            SELECT DiasSolicitado, FechaRegistro
            FROM vacacionespagadas
            WHERE IdPersonal = ? AND Periodo = ? AND Estado IN (1,2,3,4)
        `;
        
        const diasPagados = await connection.query(queryDiasPagados, [empleado.IdPersonal, periodo]);
        
        // Obtener información de la planilla y división
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
        console.error('Stack:', error.stack);
        throw error;
    }
}
// Función para generar el PDF del período completado
// Función para generar el PDF del período completado
async function generarPDFPeriodoCompleto(empleado, periodo) {
    try {
        // Obtener los detalles necesarios
        const detalles = await obtenerDetallesPeriodo(empleado, periodo);
        
        // Importar jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración inicial
        const pageWidth = doc.internal.pageSize.width;
        let y = 20;
        
        // Agregar logo si existe
        if (detalles.infoPlanilla.LogoBase64) {
            try {
                doc.addImage(detalles.infoPlanilla.LogoBase64, 'JPEG', 10, 10, 30, 30);
            } catch (error) {
                console.error('Error al agregar logo:', error);
            }
        }
        
        // Título de la división
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(detalles.infoPlanilla.NombreDivision, pageWidth / 2, y, { align: 'center' });
        y += 10;
        
        // Nombre de la planilla
        doc.setFontSize(14);
        doc.text(detalles.infoPlanilla.Nombre_Planilla, pageWidth / 2, y, { align: 'center' });
        y += 15;
        
        // Departamento de RRHH
        doc.setFont(undefined, 'normal');
        doc.setFontSize(12);
        doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', pageWidth / 2, y, { align: 'center' });
        y += 10;
        
        // Título principal
        doc.setFont(undefined, 'bold');
        doc.setFontSize(14);
        doc.text('FICHA DE CONTROL DE PERÍODO DE VACACIONES', pageWidth / 2, y, { align: 'center' });
        y += 20;
        
        // Información del empleado
        doc.setFont(undefined, 'normal');
        doc.setFontSize(11);
        
        // Nombre del colaborador
        const nombreCompleto = getFullName(empleado);
        doc.setFont(undefined, 'bold');
        doc.text('Nombre del Colaborador:', 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(nombreCompleto, 70, y);
        y += 8;
        
        // DPI
        doc.setFont(undefined, 'bold');
        doc.text('DPI:', 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(empleado.DPI || 'No registrado', 70, y);
        y += 8;
        
        // Período
        const periodoFormateado = formatearPeriodoParaPDF(periodo);
        doc.setFont(undefined, 'bold');
        doc.text('Período:', 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(periodoFormateado, 70, y);
        y += 20;
        
        // Configuración de la tabla
        const col1X = 20;  // NO.
        const col2X = 60;  // FECHA DESCANSO
        const col3X = 120; // FIRMA COLABORADOR
        const tableWidth = 170;
        
        // Anchos de columnas para centrado
        const col1Width = 40;
        const col2Width = 60;
        const col3Width = 70;
        
        // Encabezados de la tabla
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('NO.', col1X + (col1Width / 2), y, { align: 'center' });
        doc.text('FECHA DESCANSO', col2X + (col2Width / 2), y, { align: 'center' });
        doc.text('FIRMA COLABORADOR', col3X + (col3Width / 2), y, { align: 'center' });
        y += 3;
        
        // Línea bajo los encabezados
        doc.setLineWidth(0.5);
        doc.line(col1X, y, col1X + tableWidth, y);
        y += 7;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        let contador = 1;
        
        // Calcular total de días pagados
        let totalDiasPagados = 0;
        detalles.diasPagados.forEach(pago => {
            totalDiasPagados += parseInt(pago.DiasSolicitado);
        });
        
        // Solo mostrar las fechas tomadas (sin filas vacías)
        detalles.fechasTomadas.forEach(fecha => {
            // Número de fila
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            doc.text(contador.toString(), col1X + (col1Width / 2), y, { align: 'center' });
            
            // FECHA - en negrita, más grande y centrada
            doc.setFont(undefined, 'bold');
            doc.setFontSize(12);
            doc.text(formatDate(fecha.FechasTomadas), col2X + (col2Width / 2), y, { align: 'center' });
            
            // Línea debajo de la fila
            y += 5;
            doc.setLineWidth(0.3);
            doc.line(col1X, y, col1X + tableWidth, y);
            y += 5;
            
            contador++;
        });
        
        // Si hay días pagados, agregar una fila resumen para ellos
        if (totalDiasPagados > 0) {
            // Espacio antes de la información de días pagados
            y += 5;
            
            // Fila para días pagados
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            doc.text(contador.toString(), col1X + (col1Width / 2), y, { align: 'center' });
            
            // Texto de días pagados - también en negrita y más grande
            doc.setFont(undefined, 'bold');
            doc.setFontSize(12);
            doc.text(`Días pagados: ${totalDiasPagados}`, col2X + (col2Width / 2), y, { align: 'center' });
            
            // Línea debajo de la fila
            y += 5;
            doc.setLineWidth(0.3);
            doc.line(col1X, y, col1X + tableWidth, y);
            y += 5;
        }
        
        // Información adicional al final
        y += 15;
        
        const totalDias = detalles.fechasTomadas.length + totalDiasPagados;
        doc.setFont(undefined, 'bold');
        doc.text(`Total de días utilizados del período: ${totalDias} / 15`, 20, y);
        
        // Pie de página con fecha de generación
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-GT')}`, 20, 270);
        doc.text(`Página 1 de 1`, pageWidth - 40, 270);
        
        // Guardar el PDF
        const fileName = `Periodo_Completo_${nombreCompleto.replace(/\s+/g, '_')}_${periodo.replace(/\s+/g, '_')}.pdf`;
        doc.save(fileName);
        
        return true;
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        throw error;
    }
}
// Función para formatear el período para el PDF
function formatearPeriodoParaPDF(periodo) {
    // Convertir de "2023-11-01 al 2024-10-31" a "01-11-2023 al 31-10-2024"
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
async function obtenerPeriodosCompletados(empleado) {
    try {
        const connection = await connectionString();
        
        // Obtener todos los períodos del empleado
        const aniosCumplidos = parseInt(empleado.AniosCumplidos) || 0;
        const periodosCompletados = [];
        
        for (let i = 0; i <= aniosCumplidos; i++) {
            const periodo = calcularPeriodo(empleado.FechaPlanilla, i);
            
            // Verificar días tomados
            const queryDiasTomados = `
                SELECT COUNT(*) as DiasUtilizados
                FROM vacacionestomadas
                WHERE IdPersonal = ? AND Periodo = ?
            `;
            const resultDiasTomados = await connection.query(queryDiasTomados, [empleado.IdPersonal, periodo]);
            
            // Verificar días pagados
            const queryDiasPagados = `
                SELECT IFNULL(SUM(CAST(DiasSolicitado AS UNSIGNED)), 0) as DiasPagados
                FROM vacacionespagadas
                WHERE IdPersonal = ? AND Periodo = ? AND Estado IN (1,2,3,4)
            `;
            const resultDiasPagados = await connection.query(queryDiasPagados, [empleado.IdPersonal, periodo]);
            
            const diasTomados = parseInt(resultDiasTomados[0].DiasUtilizados) || 0;
            const diasPagados = parseInt(resultDiasPagados[0].DiasPagados) || 0;
            const totalDias = diasTomados + diasPagados;
            
            // Si el período está completo (15 días), agregarlo a la lista
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
    // Limpiar selecciones previas
    document.getElementById('pdfEmployeeSelect').value = '';
    document.getElementById('pdfPeriodSelect').value = '';
    document.getElementById('pdfPeriodSelect').disabled = true;
    document.getElementById('generateSelectedPdfBtn').disabled = true;
    document.getElementById('periodInfo').style.display = 'none';
    
    // Llenar la lista de colaboradores
    const employeeSelect = document.getElementById('pdfEmployeeSelect');
    employeeSelect.innerHTML = '<option value="">-- Seleccione un colaborador --</option>';
    
    employeesData.forEach(employee => {
        const option = document.createElement('option');
        option.value = employee.IdPersonal;
        option.textContent = getFullName(employee);
        // No permitir seleccionar al usuario actual
        if (employee.IdPersonal === userData.IdPersonal) {
            option.disabled = true;
            option.textContent += ' (Usted)';
        }
        employeeSelect.appendChild(option);
    });
    
    // Mostrar el modal
    pdfGeneratorModal.style.display = 'block';
    setTimeout(() => {
        pdfGeneratorModal.classList.add('show');
    }, 10);
}

// Manejar cambio de empleado seleccionado
async function handleEmployeeSelection() {
    const employeeId = parseInt(document.getElementById('pdfEmployeeSelect').value);
    const periodSelect = document.getElementById('pdfPeriodSelect');
    
    if (!employeeId) {
        periodSelect.disabled = true;
        periodSelect.innerHTML = '<option value="">-- Primero seleccione un colaborador --</option>';
        document.getElementById('periodInfo').style.display = 'none';
        document.getElementById('generateSelectedPdfBtn').disabled = true;
        return;
    }
    
    // Mostrar indicador de carga
    const loadingSwal = mostrarCargando('Buscando períodos completados...');
    
    try {
        const employee = employeesData.find(emp => emp.IdPersonal === employeeId);
        
        // Obtener períodos completados
        const periodosCompletados = await obtenerPeriodosCompletados(employee);
        
        loadingSwal.close();
        
        if (periodosCompletados.length === 0) {
            periodSelect.innerHTML = '<option value="">No hay períodos completados</option>';
            periodSelect.disabled = true;
            document.getElementById('generateSelectedPdfBtn').disabled = true;
            
            Swal.fire({
                icon: 'info',
                title: 'Sin períodos completados',
                text: 'Este colaborador no tiene períodos de 15 días completados.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Habilitar selección de período
        periodSelect.disabled = false;
        periodSelect.innerHTML = '<option value="">-- Seleccione un período --</option>';
        
        periodosCompletados.forEach((periodo, index) => {
            const option = document.createElement('option');
            option.value = JSON.stringify(periodo);
            option.textContent = formatPeriodoUsuario(periodo.periodo);
            periodSelect.appendChild(option);
        });
        
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

// Manejar cambio de período seleccionado
function handlePeriodSelection() {
    const periodValue = document.getElementById('pdfPeriodSelect').value;
    
    if (!periodValue) {
        document.getElementById('periodInfo').style.display = 'none';
        document.getElementById('generateSelectedPdfBtn').disabled = true;
        return;
    }
    
    try {
        const periodoInfo = JSON.parse(periodValue);
        
        // Mostrar información del período
        document.getElementById('selectedPeriod').textContent = formatPeriodoUsuario(periodoInfo.periodo);
        document.getElementById('daysTaken').textContent = periodoInfo.diasTomados;
        document.getElementById('daysPaid').textContent = periodoInfo.diasPagados;
        document.getElementById('totalDays').textContent = periodoInfo.totalDias;
        
        document.getElementById('periodInfo').style.display = 'block';
        document.getElementById('generateSelectedPdfBtn').disabled = false;
        
    } catch (error) {
        console.error('Error al procesar período:', error);
    }
}

// Generar PDF del período seleccionado
async function generateSelectedPdf() {
    const employeeId = parseInt(document.getElementById('pdfEmployeeSelect').value);
    const periodValue = document.getElementById('pdfPeriodSelect').value;
    
    if (!employeeId || !periodValue) {
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
        const periodoInfo = JSON.parse(periodValue);
        
        // Cerrar el modal
        pdfGeneratorModal.classList.remove('show');
        setTimeout(() => {
            pdfGeneratorModal.style.display = 'none';
        }, 300);
        
        // Mostrar indicador de carga
        const loadingSwal = mostrarCargando('Generando PDF...');
        
        // Generar el PDF
        await generarPDFPeriodoCompleto(employee, periodoInfo.periodo);
        
        loadingSwal.close();
        
        Swal.fire({
            icon: 'success',
            title: 'PDF Generado',
            text: 'El PDF del período completado se ha generado correctamente.',
            confirmButtonColor: '#4CAF50'
        });
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo generar el PDF. Por favor intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}
// Agregar funciones al contexto global para poder llamarlas desde HTML
window.openVacationModal = openVacationModal;
window.openInfoModal = openInfoModal;

// Detectar cierre de la aplicación
window.addEventListener('beforeunload', function(e) {
    // Aquí se podrían realizar operaciones de limpieza si fuera necesario
});

// Iniciar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', initApp);