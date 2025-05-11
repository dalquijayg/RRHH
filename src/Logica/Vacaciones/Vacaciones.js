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
const employeeCountEl = document.getElementById('employeeCount');

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
                personal.FechaPlanilla,
                TIMESTAMPDIFF(YEAR, personal.FechaPlanilla, CURDATE()) AS AniosCumplidos,
                TIMESTAMPDIFF(YEAR, personal.FechaPlanilla, CURDATE()) * 15 AS DiasVacaciones,
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
            employeeCountEl.textContent = `${result.length}`;
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
        
        if (employee.DiasVacaciones === null || employee.DiasVacaciones === 0) {
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
    vacationForm.addEventListener('submit', simulateVacationRequest);
    
    // Botón cancelar solicitud
    document.getElementById('cancelVacationBtn').addEventListener('click', () => {
        vacationModal.classList.remove('show');
        setTimeout(() => {
            vacationModal.style.display = 'none';
        }, 300);
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
}
// Abrir modal de solicitud de vacaciones mejorado (nuevo diseño)
function openVacationModal(employeeId) {
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
    
    // Obtener el nombre completo
    const fullName = getFullName(employee);
    
    // Actualizar datos en el modal
    document.getElementById('modalEmployeeName').textContent = fullName;
    document.getElementById('modalEmployeePosition').textContent = employee.Nombre || 'Sin puesto asignado';
    document.getElementById('modalYearsOfService').textContent = employee.AniosCumplidos;
    document.getElementById('modalAvailableDays').textContent = employee.DiasVacaciones;
    
    // Foto del empleado
    const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
    document.getElementById('modalEmployeePhoto').src = photoSrc;
    
    // Resetear selección de fechas
    selectedStartDate = null;
    selectedEndDate = null;
    selectedDays = [];
    document.getElementById('selectedStartDate').textContent = "No seleccionado";
    document.getElementById('selectedEndDate').textContent = "No seleccionado";
    document.getElementById('selectedDays').textContent = "0 días";
    
    // Limpiar visualización de días
    document.getElementById('daysVisual').innerHTML = '';
    
    // Guardar el ID del empleado en el formulario
    document.getElementById('vacationForm').setAttribute('data-employee-id', employeeId);
    
    // Resetear el formulario
    document.getElementById('vacationForm').reset();
    
    // Inicializar el calendario
    initCalendar();
    
    // Mostrar el modal con animación
    vacationModal.style.display = 'block';
    setTimeout(() => {
        vacationModal.classList.add('show');
        // Forzar redibujado del calendario
        if (calendar) {
            calendar.updateSize();
        }
    }, 10);
}

// Inicializar el calendario (ajustado para el nuevo diseño)
function initCalendar() {
    const calendarEl = document.getElementById('vacationCalendar');
    
    if (calendar) {
        calendar.destroy();
    }
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        selectable: true,
        locale: 'es',
        height: 'auto', // Ajuste automático de altura
        contentHeight: 'auto', // Altura de contenido automática
        fixedWeekCount: false, // Mostrar solo las semanas del mes actual
        showNonCurrentDates: false, // Ocultar días de meses adyacentes
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: '' // Quitar botones innecesarios para ahorrar espacio
        },
        dateClick: function(info) {
            // Para selección de un solo clic
            const clickedDate = info.date;
            handleDateSelection(clickedDate, clickedDate);
        },
        select: function(info) {
            // Para selección por arrastre
            handleDateSelection(info.start, info.end);
        },
        unselect: function() {
            // Al hacer clic fuera de la selección
        },
        selectAllow: function(selectInfo) {
            // Solo permitir selección de fechas futuras
            return selectInfo.start >= new Date();
        },
        dayCellClassNames: function(arg) {
            // Añadir clases a días específicos
            const date = arg.date;
            const day = date.getDay();
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
            
            return classes;
        },
        // Personalizar el tamaño de las celdas
        viewDidMount: function() {
            // Forzar a FullCalendar a recalcular las dimensiones
            setTimeout(() => {
                calendar.updateSize();
            }, 50);
        }
    });
    
    calendar.render();
    
    // Añadir clase especial para mejorar la visualización del calendario
    const calendarContainer = document.querySelector('.calendar-container');
    calendarContainer.classList.add('full-calendar-view');
    
    // Asegurarse de que el calendario se ajuste correctamente
    setTimeout(() => {
        calendar.updateSize();
    }, 100);
}

// Manejar la selección de fechas (optimizado para el nuevo diseño)
function handleDateSelection(start, end) {
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
}

// Calcular días hábiles (excluyendo fines de semana, días especiales y Semana Santa)
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
        
        selectedDays.push({
            date: new Date(currentDate),
            isWeekend: isWeekend,
            isSpecial: isSpecialDayFlag,
            isHolyWeek: isHolyWeekDayFlag,
            isVacation: !isWeekend && !isSpecialDayFlag && !isHolyWeekDayFlag
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Contar días hábiles (no fines de semana y no días especiales)
    const workingDays = selectedDays.filter(day => !day.isWeekend && !day.isSpecial && !day.isHolyWeek).length;
    
    // Actualizar el contador
    document.getElementById('selectedDays').textContent = `${workingDays} días`;
}

// Crear visualización de días seleccionados (optimizada para modo mini)
function renderDaysVisualization() {
    const daysVisualEl = document.getElementById('daysVisual');
    daysVisualEl.innerHTML = '';
    
    if (selectedDays.length === 0) {
        daysVisualEl.innerHTML = '<p class="no-days">No hay días seleccionados.</p>';
        return;
    }
    
    // Versión más compacta para ahorrar espacio
    const workingDays = selectedDays.filter(day => !day.isWeekend && !day.isSpecial && !day.isHolyWeek);
    const weekendDays = selectedDays.filter(day => day.isWeekend);
    const specialDays = selectedDays.filter(day => day.isSpecial);
    const holyWeekDays = selectedDays.filter(day => day.isHolyWeek);
    
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
    `;
    
    daysVisualEl.appendChild(summaryContainer);
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

// Simular envío de solicitud de vacaciones con la nueva interfaz (sin campo de motivo)
async function simulateVacationRequest(event) {
    event.preventDefault();
    
    const employeeId = parseInt(this.getAttribute('data-employee-id'));
    
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
        !day.isWeekend && !day.isSpecial && !day.isHolyWeek).length;
    
    if (workingDays === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin días hábiles',
            text: 'El periodo seleccionado no contiene días hábiles disponibles para vacaciones.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Verificar si hay días especiales o de Semana Santa en el rango
    const specialDaysInRange = selectedDays.filter(day => day.isSpecial);
    const holyWeekDaysInRange = selectedDays.filter(day => day.isHolyWeek);
    
    let notificationMessage = '';
    
    if (specialDaysInRange.length > 0 || holyWeekDaysInRange.length > 0) {
        notificationMessage = '<div style="margin-top: 15px; padding: 10px; background-color: #FFF9C4; border-radius: 5px; text-align: left;">';
        
        if (specialDaysInRange.length > 0) {
            notificationMessage += `
                <p style="color: #FF5252; margin: 0 0 8px 0;">
                    <i class="fas fa-info-circle"></i> 
                    El rango incluye ${specialDaysInRange.length} día(s) especial(es) que no se contarán como vacaciones.
                </p>
            `;
        }
        
        if (holyWeekDaysInRange.length > 0) {
            notificationMessage += `
                <p style="color: #9C27B0; margin: 0;">
                    <i class="fas fa-info-circle"></i> 
                    El rango incluye ${holyWeekDaysInRange.length} día(s) de Semana Santa que no se contarán como vacaciones.
                </p>
            `;
        }
        
        notificationMessage += '</div>';
    }
    
    // Validar que el empleado tenga días disponibles
    const employee = employeesData.find(emp => emp.IdPersonal === employeeId);
    if (workingDays > parseInt(employee.DiasVacaciones)) {
        Swal.fire({
            icon: 'error',
            title: 'Días insuficientes',
            text: `El colaborador solo tiene ${employee.DiasVacaciones} días disponibles.`,
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Confirmar solicitud
    const result = await Swal.fire({
        icon: 'question',
        title: '¿Enviar solicitud?',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>Empleado:</strong> ${getFullName(employee)}</p>
                <p><strong>Periodo:</strong> ${formatDate(selectedStartDate)} al ${formatDate(selectedEndDate)}</p>
                <p><strong>Días válidos para vacaciones:</strong> ${workingDays} días</p>
                <p><strong>Total días seleccionados:</strong> ${selectedDays.length} días</p>
                ${notificationMessage}
                <div style="margin-top: 15px; padding: 10px; background-color: #FFF3E0; border-radius: 5px;">
                    <p style="color: #FF9800; margin: 0;">
                        <i class="fas fa-info-circle"></i> 
                        Nota: Esta acción es simulada ya que no existe una tabla de vacaciones.
                    </p>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Simular envío',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#FF5252'
    });
    
    if (result.isConfirmed) {
        // Mostrar carga
        const loadingSwal = mostrarCargando('Simulando envío...');
        
        // Simular tiempo de procesamiento
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        loadingSwal.close();
        
        // Notificar éxito simulado
        await Swal.fire({
            icon: 'success',
            title: 'Simulación completada',
            html: `
                <p>La solicitud de vacaciones ha sido simulada correctamente.</p>
                <div style="margin-top: 15px; padding: 10px; background-color: #E8F5E9; border-radius: 5px;">
                    <p style="color: #4CAF50; margin: 0;">
                        <i class="fas fa-check-circle"></i>
                        Para implementar completamente esta funcionalidad, será necesario crear la tabla de Vacaciones en la base de datos.
                    </p>
                </div>
            `,
            confirmButtonColor: '#4CAF50'
        });
        
        // Cerrar modal
        vacationModal.classList.remove('show');
        setTimeout(() => {
            vacationModal.style.display = 'none';
        }, 300);
    }
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

// Función para manejar errores en consola
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Error JS:', message, 'at', source, lineno, colno);
    
    // Mostrar mensaje de error solo si es crítico
    if (error && error.stack && !error.handled) {
        Swal.fire({
            icon: 'error',
            title: 'Error en la aplicación',
            text: 'Ha ocurrido un error inesperado. Por favor recargue la página.',
            confirmButtonColor: '#FF9800',
            confirmButtonText: 'Recargar',
            allowOutsideClick: false
        }).then((result) => {
            if (result.isConfirmed) {
                location.reload();
            }
        });
        
        error.handled = true;
    }
    
    return true; // Prevenir el diálogo de error predeterminado del navegador
};

// Agregar funciones al contexto global para poder llamarlas desde HTML
window.openVacationModal = openVacationModal;
window.openInfoModal = openInfoModal;

// Detectar cierre de la aplicación
window.addEventListener('beforeunload', function(e) {
    // Aquí se podrían realizar operaciones de limpieza si fuera necesario
});

// Añadir estilos adicionales para el nuevo diseño del modal
document.head.insertAdjacentHTML('beforeend', `
    <style>
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .mini-days-container {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            margin-bottom: 6px;
        }
        
        .full-calendar-view {
            height: 100% !important;
        }
        
        .day-box.more-indicator {
            background-color: #f0f0f0;
            color: #666;
            font-weight: bold;
        }
        
        .mini-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            font-size: 11px;
            color: #666;
        }
        
        .mini-summary-item {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 3px;
            white-space: nowrap;
        }
        
        .mini-summary-item i {
            color: #FF9800;
            font-size: 10px;
        }
        
        .fc-day-today.fc-day-selected {
            background-color: rgba(76, 175, 80, 0.3) !important;
        }
        
        .fc-daygrid-day.fc-day-selected {
            background-color: rgba(76, 175, 80, 0.2) !important;
            position: relative;
            box-shadow: inset 0 0 3px rgba(76, 175, 80, 0.5);
        }
        
        /* Estilos para mejorar la visualización en el navegador */
        .fc-theme-standard td, .fc-theme-standard th {
            border: 1px solid #ddd !important;
        }
        
        .fc .fc-daygrid-day.fc-day-today {
            background-color: rgba(255, 152, 0, 0.1) !important;
        }
        
        /* Mejorar la visibilidad de las fechas seleccionadas */
        .modal-compact .date-value {
            font-size: 13px;
        }
        
        /* Ajustar altura de filas del calendario */
        .fc-daygrid-day-frame {
            min-height: 45px !important;
        }
    </style>
`);

// Iniciar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', initApp);