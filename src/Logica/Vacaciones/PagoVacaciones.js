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
let currentPaymentData = {};
let statusData = [];

// Variables para ordenación
let currentSort = {
    column: null,
    direction: 'asc'
};

// Estados disponibles
const ESTADOS = {
    1: { nombre: 'Por Autorizar', color: '#FF9800', icono: 'clock' },
    2: { nombre: 'En Trámite', color: '#2196F3', icono: 'spinner' },
    3: { nombre: 'Pendiente de Cobro', color: '#9C27B0', icono: 'hand-holding-usd' },
    4: { nombre: 'Pagado', color: '#4CAF50', icono: 'check-circle' },
    5: { nombre: 'Anulado', color: '#F44336', icono: 'times-circle' }
};

// Elementos DOM
const employeesTable = document.getElementById('employeesTable');
const searchInput = document.getElementById('searchInput');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageIndicator = document.getElementById('pageIndicator');
const refreshBtn = document.getElementById('refreshBtn');
const statusBtn = document.getElementById('statusBtn');
const paymentModal = document.getElementById('paymentModal');
const infoModal = document.getElementById('infoModal');
const statusModal = document.getElementById('statusModal');
const departmentNameEl = document.getElementById('departmentName');
const departmentTotalEl = document.getElementById('departmentTotal');

// Establecer conexión a la base de datos
async function connectionString() {
    try {
        const connection = await odbc.connect(conexion, {
            binaryAsString: true,
            bigint: 'number' // Cambiar de 'string' a 'number' para manejar mejor los BigInt
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
        
        // Inicializar los eventos
        initEvents();
        
        // Cerrar el indicador de carga
        loadingSwal.close();
        
        // Mostrar mensaje de bienvenida
        Swal.fire({
            icon: 'success',
            title: 'Bienvenido al Sistema de Pago de Vacaciones',
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
            departmentTotalEl.textContent = departmentInfo.TotalEmpleados || '0';
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
                DATE_FORMAT(personal.FechaPlanilla, '%Y-%m-%d') AS FechaPlanilla,
                personal.IdSucuDepa,
                personal.IdPlanilla,
                personal.DiasMinVacaciones,
                personal.diasMiniPagoVacaciones,
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
            actionsCell = `
                <div class="user-actions-disabled">
                    <span class="user-actions-message tooltip">
                        <i class="fas fa-user-lock"></i> No disponible
                        <span class="tooltip-text">No puede solicitar pagos para usted mismo</span>
                    </span>
                </div>
            `;
        } else {
            actionsCell = `
                <div class="action-buttons">
                    <button class="btn-action btn-request" title="Solicitar pago" onclick="openPaymentModal(${employee.IdPersonal})">
                        <i class="fas fa-money-check-alt"></i>
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
        } else if (employee.DiasVacaciones < 15) {
            diasDisponiblesStyle = `<div class="days-count" style="background-color: #FF9800;">${employee.DiasVacaciones} días</div>`;
        } else if (employee.DiasVacaciones < 30) {
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

// Función para obtener información de los períodos con días disponibles
async function obtenerPeriodosConDiasDisponibles(empleado) {
    try {
        const connection = await connectionString();
        
        // Obtener la fecha actual sin problemas de zona horaria
        const fechaActual = new Date();
        fechaActual.setHours(0, 0, 0, 0);
        
        // Parsear fecha de planilla correctamente
        let fechaPlanilla;
        if (typeof empleado.FechaPlanilla === 'string') {
            const parts = empleado.FechaPlanilla.split('T')[0].split('-');
            fechaPlanilla = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            fechaPlanilla = new Date(empleado.FechaPlanilla);
        }
        
        const aniosCumplidos = parseInt(empleado.AniosCumplidos) || 0;
        let periodosDisponibles = [];
        
        // Iterar por cada año desde el ingreso
        for (let i = 0; i <= aniosCumplidos; i++) {
            // Calcular fecha de inicio del período (mismo día de ingreso)
            const fechaInicioPeriodo = new Date(fechaPlanilla);
            fechaInicioPeriodo.setFullYear(fechaPlanilla.getFullYear() + i);
            
            // Calcular fecha de fin del período
            const fechaFinPeriodo = new Date(fechaInicioPeriodo);
            fechaFinPeriodo.setFullYear(fechaFinPeriodo.getFullYear() + 1);
            fechaFinPeriodo.setDate(fechaFinPeriodo.getDate() - 1);
            
            // Solo considerar períodos que ya hayan iniciado
            if (fechaInicioPeriodo <= fechaActual) {
                const periodo = calcularPeriodo(empleado.FechaPlanilla, i);
                
                // Verificar días utilizados en vacaciones tomadas
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
                
                // Convertir valores
                let diasUtilizados = 0;
                if (resultDiasTomados && resultDiasTomados.length > 0 && resultDiasTomados[0].DiasUtilizados) {
                    const valor = resultDiasTomados[0].DiasUtilizados;
                    diasUtilizados = typeof valor === 'bigint' ? Number(valor) : parseInt(valor) || 0;
                }
                
                let diasPagados = 0;
                if (resultDiasPagados && resultDiasPagados.length > 0 && resultDiasPagados[0].DiasPagados) {
                    const valor = resultDiasPagados[0].DiasPagados;
                    diasPagados = typeof valor === 'bigint' ? Number(valor) : parseInt(valor) || 0;
                }
                
                // Calcular días disponibles
                const diasDisponibles = Math.max(0, 15 - diasUtilizados - diasPagados);
                
                // Solo agregar si hay días disponibles
                if (diasDisponibles > 0) {
                    periodosDisponibles.push({
                        periodo: periodo,
                        diasDisponibles: diasDisponibles,
                        diasUtilizados: diasUtilizados,
                        diasPagados: diasPagados,
                        totalDiasPeriodo: 15,
                        esPeriodoCompleto: fechaFinPeriodo <= fechaActual,
                        fechaInicio: fechaInicioPeriodo,
                        fechaFin: fechaFinPeriodo
                    });
                }
            }
        }
        
        await connection.close();
        
        return periodosDisponibles;
    } catch (error) {
        console.error('Error al obtener períodos:', error);
        throw error;
    }
}
// Función para calcular el período
function calcularPeriodo(fechaPlanilla, offsetAnios = 0) {
    // Convertir la fecha de planilla a un objeto Date manejando UTC
    let fechaInicioPlanilla;
    
    if (typeof fechaPlanilla === 'string') {
        // Crear fecha desde string evitando ajuste de zona horaria
        const parts = fechaPlanilla.split('T')[0].split('-');
        fechaInicioPlanilla = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
        fechaInicioPlanilla = new Date(fechaPlanilla);
    }
    
    // El período inicia el mismo día de ingreso
    const fechaInicioPeriodo = new Date(fechaInicioPlanilla);
    fechaInicioPeriodo.setFullYear(fechaInicioPlanilla.getFullYear() + offsetAnios);
    
    // El período termina un día antes del siguiente año
    const fechaFinPeriodo = new Date(fechaInicioPeriodo);
    fechaFinPeriodo.setFullYear(fechaFinPeriodo.getFullYear() + 1);
    fechaFinPeriodo.setDate(fechaFinPeriodo.getDate() - 1);
    
    // Formatear las fechas
    const formatoInicio = formatFechaBaseDatos(fechaInicioPeriodo);
    const formatoFin = formatFechaBaseDatos(fechaFinPeriodo);
    
    return `${formatoInicio} al ${formatoFin}`;
}

// Abrir modal de pago
async function openPaymentModal(employeeId) {
    // Verificar si es el usuario actual
    if (employeeId === userData.IdPersonal) {
        Swal.fire({
            icon: 'error',
            title: 'Operación no permitida',
            text: 'No puede solicitar pagos para usted mismo.',
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
        // Obtener períodos con días disponibles
        const periodosDisponibles = await obtenerPeriodosConDiasDisponibles(employee);
        
        loadingSwal.close();
        
        if (periodosDisponibles.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin días disponibles',
                text: 'El colaborador no tiene días de vacaciones disponibles para pago.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Limpiar datos actuales
        currentPaymentData = {
            employeeId: employeeId,
            employee: employee,
            periodos: periodosDisponibles,
            diasSolicitados: {},
            diasMinimoPago: parseInt(employee.diasMiniPagoVacaciones || 0)
        };
        
        // Actualizar datos en el modal
        const fullName = getFullName(employee);
        document.getElementById('modalEmployeeName').textContent = fullName;
        document.getElementById('modalEmployeePosition').textContent = employee.Nombre || 'Sin puesto asignado';
        document.getElementById('modalEmployeeHireDate').textContent = formatDate(employee.FechaPlanilla);
        document.getElementById('modalEmployeeYears').textContent = employee.AniosCumplidos;
        
        const photoSrc = employee.FotoBase64 || '../Imagenes/user-default.png';
        document.getElementById('modalEmployeePhoto').src = photoSrc;
        
        // Calcular total de días disponibles
        const totalDiasDisponibles = periodosDisponibles.reduce((sum, periodo) => sum + periodo.diasDisponibles, 0);
        document.getElementById('totalAvailableDays').textContent = totalDiasDisponibles;
        
        // Renderizar períodos disponibles
        renderPeriodos(periodosDisponibles);
        
        // Si hay días mínimos, mostrar la información
        if (currentPaymentData.diasMinimoPago > 0) {
            mostrarInfoDiasMinimos(currentPaymentData.diasMinimoPago);
        }
        
        // Resetear formulario
        updatePaymentSummary();
        
        // Mostrar el modal
        paymentModal.style.display = 'block';
        setTimeout(() => {
            paymentModal.classList.add('show');
        }, 10);
        
    } catch (error) {
        console.error('Error al abrir modal de pago:', error);
        loadingSwal.close();
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al verificar la información del colaborador. Por favor intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Renderizar períodos en el modal
function renderPeriodos(periodos) {
    const periodsContainer = document.getElementById('periodsContainer');
    periodsContainer.innerHTML = '';
    
    periodos.forEach((periodo, index) => {
        const periodItem = document.createElement('div');
        periodItem.className = 'period-item';
        
        // Si el período está en curso, agregar clase disabled
        if (!periodo.esPeriodoCompleto) {
            periodItem.classList.add('period-disabled');
        }
        
        const periodoFormateado = formatPeriodoUsuario(periodo.periodo);
        
        // Agregar indicador si el período está en curso
        let estadoPeriodo = '';
        if (!periodo.esPeriodoCompleto) {
            const fechaActual = new Date();
            const diasRestantes = Math.ceil((periodo.fechaFin - fechaActual) / (1000 * 60 * 60 * 24));
            estadoPeriodo = `<span class="period-status en-curso">En curso (faltan ${diasRestantes} días)</span>`;
        } else {
            estadoPeriodo = `<span class="period-status completo">Completado</span>`;
        }
        
        // Crear tooltip con desglose
        let desglose = '';
        if (periodo.diasUtilizados > 0 || periodo.diasPagados > 0 || !periodo.esPeriodoCompleto) {
            desglose = `
                <div class="period-breakdown">
                    <i class="fas fa-info-circle"></i>
                    <div class="breakdown-tooltip">
                        <ul class="breakdown-list">
                            <li>Total del período: ${periodo.totalDiasPeriodo} días</li>
                            <li>Días tomados: ${periodo.diasUtilizados}</li>
                            <li>Días pagados: ${periodo.diasPagados}</li>
                            <li>Disponibles: ${periodo.diasDisponibles}</li>
                            <li>Estado: ${periodo.esPeriodoCompleto ? 'Completado' : 'En curso'}</li>
                            ${!periodo.esPeriodoCompleto ? '<li><strong>No se puede solicitar pago hasta completar el período</strong></li>' : ''}
                        </ul>
                    </div>
                </div>
            `;
        }
        
        periodItem.innerHTML = `
            <div class="period-header">
                <div class="period-range">
                    <i class="fas fa-calendar-alt"></i>
                    ${periodoFormateado}
                    ${estadoPeriodo}
                    ${desglose}
                </div>
                <div class="period-available">
                    ${periodo.diasDisponibles} días disponibles
                </div>
            </div>
            <div class="period-input-group">
                <label for="dias-${index}">Días a pagar:</label>
                <input 
                    type="number" 
                    id="dias-${index}" 
                    class="period-input" 
                    min="0" 
                    max="${periodo.diasDisponibles}" 
                    value="0"
                    data-periodo="${periodo.periodo}"
                    data-index="${index}"
                    ${!periodo.esPeriodoCompleto ? 'disabled' : ''}
                >
                <span class="period-max">
                    ${!periodo.esPeriodoCompleto 
                        ? '(Período no completado)' 
                        : `(máximo: ${periodo.diasDisponibles})`
                    }
                </span>
            </div>
            ${!periodo.esPeriodoCompleto 
                ? '<div class="period-warning">Este período debe completarse antes de solicitar pago</div>' 
                : '<div class="period-error" id="error-' + index + '"></div>'
            }
        `;
        
        periodsContainer.appendChild(periodItem);
    });
    
    // Agregar eventos a los inputs (solo para los habilitados)
    document.querySelectorAll('.period-input:not(:disabled)').forEach(input => {
        input.addEventListener('input', handlePeriodInputChange);
        input.addEventListener('blur', validatePeriodInput);
    });
}

// Mostrar información de días mínimos
function mostrarInfoDiasMinimos(diasMinimos) {
    // Verificar si ya existe el elemento
    let minDaysInfo = document.querySelector('.min-days-info-payment');
    
    if (!minDaysInfo) {
        // Crear el elemento si no existe
        minDaysInfo = document.createElement('div');
        minDaysInfo.className = 'min-days-info-payment';
        
        // Insertar después del header de períodos
        const periodsColumn = document.querySelector('.periods-column');
        const sectionHeader = periodsColumn.querySelector('.section-header-compact');
        sectionHeader.insertAdjacentElement('afterend', minDaysInfo);
    }
    
    minDaysInfo.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <span>Mínimo requerido: ${diasMinimos} días</span>
    `;
}

// Manejar cambios en los inputs de períodos
function handlePeriodInputChange(event) {
    const input = event.target;
    const periodo = input.getAttribute('data-periodo');
    const value = parseInt(input.value) || 0;
    
    // Actualizar datos
    if (value > 0) {
        currentPaymentData.diasSolicitados[periodo] = value;
    } else {
        delete currentPaymentData.diasSolicitados[periodo];
    }
    
    // Actualizar resumen
    updatePaymentSummary();
}

// Validar input de período
function validatePeriodInput(event) {
    const input = event.target;
    const index = input.getAttribute('data-index');
    const max = parseInt(input.getAttribute('max'));
    const value = parseInt(input.value) || 0;
    const errorEl = document.getElementById(`error-${index}`);
    
    errorEl.classList.remove('show');
    input.classList.remove('invalid');
    
    if (value < 0) {
        errorEl.textContent = 'El valor no puede ser negativo';
        errorEl.classList.add('show');
        input.classList.add('invalid');
        input.value = 0;
    } else if (value > max) {
        errorEl.textContent = `El máximo permitido es ${max} días`;
        errorEl.classList.add('show');
        input.classList.add('invalid');
        input.value = max;
    } else if (value > 0) {
        input.classList.add('valid');
    }
}

// Actualizar resumen del pago
function updatePaymentSummary() {
    let totalDias = 0;
    
    // Calcular total de días solicitados
    for (const periodo in currentPaymentData.diasSolicitados) {
        totalDias += currentPaymentData.diasSolicitados[periodo];
    }
    
    document.getElementById('totalRequestedDays').textContent = totalDias;
    
    // Verificar si cumple con el mínimo
    const diasMinimos = currentPaymentData.diasMinimoPago;
    const totalDaysElement = document.getElementById('totalRequestedDays');
    
    if (diasMinimos > 0) {
        if (totalDias < diasMinimos) {
            totalDaysElement.classList.add('invalid-amount');
            totalDaysElement.classList.remove('valid-amount');
        } else {
            totalDaysElement.classList.add('valid-amount');
            totalDaysElement.classList.remove('invalid-amount');
        }
    }
    
    // Calcular monto estimado
    const montoEstimado = calcularMontoEstimado(currentPaymentData.employee, totalDias);
    document.getElementById('estimatedAmount').textContent = `Q ${montoEstimado.toFixed(2)}`;
}

// Calcular monto estimado (función de ejemplo)
function calcularMontoEstimado(empleado, dias) {
    // Esta es una función de ejemplo. Deberás implementar la lógica real
    // basada en las políticas de tu empresa
    const salarioDiario = 300; // Ejemplo: Q300 por día
    return dias * salarioDiario;
}

// Guardar solicitud de pago
async function guardarSolicitudPago() {
    const totalDias = Object.values(currentPaymentData.diasSolicitados).reduce((sum, dias) => sum + dias, 0);
    
    if (totalDias === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin días seleccionados',
            text: 'Debe seleccionar al menos un día para pagar.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Validar días mínimos
    const diasMinimos = currentPaymentData.diasMinimoPago;
    if (diasMinimos > 0 && totalDias < diasMinimos) {
        Swal.fire({
            icon: 'warning',
            title: 'Días insuficientes',
            html: `
                <p>Este colaborador requiere solicitar como mínimo <strong>${diasMinimos}</strong> días para pago de vacaciones.</p>
                <p>Actualmente ha seleccionado solo <strong>${totalDias}</strong> días.</p>
                <p>Por favor ajuste la cantidad.</p>
            `,
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Construir detalle de períodos para mostrar
    let detallesPeriodos = '<ul style="text-align: left; margin-top: 10px;">';
    for (const periodo in currentPaymentData.diasSolicitados) {
        if (currentPaymentData.diasSolicitados[periodo] > 0) {
            detallesPeriodos += `<li><strong>${formatPeriodoUsuario(periodo)}:</strong> ${currentPaymentData.diasSolicitados[periodo]} días</li>`;
        }
    }
    detallesPeriodos += '</ul>';
    
    // Confirmar solicitud
    const result = await Swal.fire({
        icon: 'question',
        title: '¿Confirmar solicitud de pago?',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>Empleado:</strong> ${getFullName(currentPaymentData.employee)}</p>
                <p><strong>Total de días:</strong> ${totalDias}</p>
                ${diasMinimos > 0 ? `<p><strong>Mínimo requerido:</strong> ${diasMinimos} días ✓</p>` : ''}
                <p><strong>Monto estimado:</strong> Q ${calcularMontoEstimado(currentPaymentData.employee, totalDias).toFixed(2)}</p>
                <p><strong>Desglose por período:</strong></p>
                ${detallesPeriodos}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#FF5252'
    });
    
    if (result.isConfirmed) {
        const loadingSwal = mostrarCargando('Guardando solicitud...');
        
        try {
            // Guardar en la base de datos
            await guardarPagoEnBD();
            
            loadingSwal.close();
            
            await Swal.fire({
                icon: 'success',
                title: 'Solicitud guardada',
                text: 'La solicitud de pago de vacaciones ha sido registrada correctamente.',
                confirmButtonColor: '#4CAF50'
            });
            
            // Cerrar modal y actualizar datos
            paymentModal.classList.remove('show');
            await loadEmployees();
            
            setTimeout(() => {
                paymentModal.style.display = 'none';
            }, 300);
            
        } catch (error) {
            console.error('Error al guardar solicitud:', error);
            loadingSwal.close();
            
            Swal.fire({
                icon: 'error',
                title: 'Error al guardar',
                text: 'Hubo un problema al guardar la solicitud. Por favor intente nuevamente.',
                confirmButtonColor: '#FF9800'
            });
        }
    }
}

// Guardar pago en la base de datos (sin Estado y FechaRegistro)
async function guardarPagoEnBD() {
    try {
        const connection = await connectionString();
        
        // Obtener nombre completo del colaborador
        const nombreColaborador = getFullName(currentPaymentData.employee);
        
        // Obtener nombre del usuario que está haciendo la solicitud
        const nombreUsuario = userData.NombreCompleto || getFullName(userData);
        
        // Query para insertar en vacacionespagadas
        const query = `
            INSERT INTO vacacionespagadas 
            (IdPersonal, NombreColaborador, DiasSolicitado, Periodo, IdPlanilla, 
             IdDepartamento, IdUsuario, NombreUsuario)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        // Guardar cada período con días solicitados
        const promises = [];
        
        for (const periodo in currentPaymentData.diasSolicitados) {
            const diasSolicitados = currentPaymentData.diasSolicitados[periodo];
            
            // Solo guardar si hay días solicitados mayores a 0
            if (diasSolicitados > 0) {
                promises.push(
                    connection.query(query, [
                        currentPaymentData.employeeId,                    // IdPersonal
                        nombreColaborador,                                // NombreColaborador
                        diasSolicitados.toString(),                       // DiasSolicitado (varchar)
                        periodo,                                          // Periodo
                        currentPaymentData.employee.IdPlanilla,           // IdPlanilla
                        currentPaymentData.employee.IdSucuDepa,           // IdDepartamento
                        userData.IdPersonal,                              // IdUsuario
                        nombreUsuario                                     // NombreUsuario
                    ])
                );
            }
        }
        
        // Ejecutar todas las inserciones
        await Promise.all(promises);
        
        await connection.close();
        
        return true;
    } catch (error) {
        console.error('Error al guardar en BD:', error);
        throw error;
    }
}

// Abrir modal de información
function openInfoModal(employeeId) {
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
    document.getElementById('infoHireDate').textContent = formatDate(employee.FechaPlanilla);
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

// Abrir modal de estados
async function openStatusModal() {
    const loadingSwal = mostrarCargando('Cargando estados...');
    
    try {
        await loadStatusData();
        
        loadingSwal.close();
        
        statusModal.style.display = 'block';
        setTimeout(() => {
            statusModal.classList.add('show');
        }, 10);
        
    } catch (error) {
        console.error('Error al cargar estados:', error);
        loadingSwal.close();
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los estados. Por favor intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Cargar datos de estados
async function loadStatusData(filters = {}) {
    try {
        const connection = await connectionString();
        
        // Query para obtener solicitudes activas (estados 1, 2, 3)
        let query = `
            SELECT 
                vp.*,
                p.PrimerNombre,
                p.SegundoNombre,
                p.PrimerApellido,
                p.SegundoApellido,
                ep.Estado as NombreEstado,
                DATEDIFF(CURDATE(), vp.FechaRegistro) as DiasEnEstado
            FROM 
                vacacionespagadas vp
                INNER JOIN personal p ON vp.IdPersonal = p.IdPersonal
                INNER JOIN EstadopagoVacas ep ON vp.Estado = ep.IdEstado
            WHERE 
                vp.IdDepartamento = ?
                AND vp.Estado IN (1, 2, 3)
        `;
        
        const params = [departmentId];
        
        // Aplicar filtros
        if (filters.estado && filters.estado !== 'all') {
            query += " AND vp.Estado = ?";
            params.push(filters.estado);
        }
        
        if (filters.empleado) {
            query += " AND CONCAT(p.PrimerNombre, ' ', p.PrimerApellido) LIKE ?";
            params.push(`%${filters.empleado}%`);
        }
        
        query += " ORDER BY vp.FechaRegistro DESC";
        
        const result = await connection.query(query, params);
        await connection.close();
        
        statusData = result;
        renderStatusTable();
        
    } catch (error) {
        console.error('Error al cargar datos de estados:', error);
        throw error;
    }
}

// Renderizar tabla de estados
function renderStatusTable() {
    const tbody = document.querySelector('#statusTable tbody');
    tbody.innerHTML = '';
    
    if (statusData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px;">
                    <i class="fas fa-check-circle" style="font-size: 24px; color: #4CAF50; margin-bottom: 10px;"></i>
                    <p>No hay solicitudes pendientes en este momento.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    statusData.forEach(solicitud => {
        const row = document.createElement('tr');
        
        const nombreCompleto = `${solicitud.PrimerNombre} ${solicitud.PrimerApellido}`;
        const fechaSolicitud = formatDate(solicitud.FechaRegistro);
        const estado = ESTADOS[solicitud.Estado];
        
        // Calcular tiempo en el estado actual
        let tiempoEstado = '';
        if (solicitud.DiasEnEstado === 0) {
            tiempoEstado = 'Hoy';
        } else if (solicitud.DiasEnEstado === 1) {
            tiempoEstado = '1 día';
        } else {
            tiempoEstado = `${solicitud.DiasEnEstado} días`;
        }
        
        // Indicador visual si lleva mucho tiempo
        let tiempoClase = '';
        if (solicitud.DiasEnEstado > 7) {
            tiempoClase = 'tiempo-alto';
        } else if (solicitud.DiasEnEstado > 3) {
            tiempoClase = 'tiempo-medio';
        }
        
        row.innerHTML = `
            <td>${fechaSolicitud}</td>
            <td>${nombreCompleto}</td>
            <td>${formatPeriodoUsuario(solicitud.Periodo)}</td>
            <td>${solicitud.DiasSolicitado}</td>
            <td>
                <span class="status-badge" style="background-color: ${estado.color}20; color: ${estado.color}">
                    <i class="fas fa-${estado.icono}"></i> ${estado.nombre}
                </span>
            </td>
            <td>${solicitud.NombreUsuario}</td>
            <td>
                <span class="tiempo-estado ${tiempoClase}">
                    ${tiempoEstado}
                </span>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Aplicar filtros de estados
function applyStatusFilters() {
    const filters = {
        estado: document.getElementById('statusFilter').value,
        empleado: document.getElementById('statusEmployeeFilter').value
    };
    
    const loadingSwal = mostrarCargando('Aplicando filtros...');
    
    loadStatusData(filters).then(() => {
        loadingSwal.close();
    }).catch(error => {
        loadingSwal.close();
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al aplicar filtros. Por favor intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    });
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

// Actualizar indicadores de ordenamiento
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

// Funciones auxiliares
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

function formatFechaBaseDatos(fecha) {
    if (!fecha) return '';
    
    // Si es string, crear fecha sin ajuste de zona horaria
    if (typeof fecha === 'string') {
        fecha = new Date(fecha);
        // Ajustar para UTC
        const utcDate = new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
        fecha = utcDate;
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
    
    // Ordenación
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            sortData(column);
        });
    });
    
    // Botones principales
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
    
    // Botón de ver estados
    statusBtn.addEventListener('click', openStatusModal);
    
    // Cerrar modales
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            paymentModal.classList.remove('show');
            infoModal.classList.remove('show');
            statusModal.classList.remove('show');
            setTimeout(() => {
                paymentModal.style.display = 'none';
                infoModal.style.display = 'none';
                statusModal.style.display = 'none';
            }, 300);
        });
    });
    
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', (event) => {
        if (event.target === paymentModal) {
            paymentModal.classList.remove('show');
            setTimeout(() => {
                paymentModal.style.display = 'none';
            }, 300);
        }
        if (event.target === infoModal) {
            infoModal.classList.remove('show');
            setTimeout(() => {
                infoModal.style.display = 'none';
            }, 300);
        }
        if (event.target === statusModal) {
            statusModal.classList.remove('show');
            setTimeout(() => {
                statusModal.style.display = 'none';
            }, 300);
        }
    });
    
    // Botones de acción
    document.getElementById('submitPaymentBtn').addEventListener('click', guardarSolicitudPago);
    document.getElementById('cancelBtn').addEventListener('click', () => {
        paymentModal.classList.remove('show');
        setTimeout(() => {
            paymentModal.style.display = 'none';
        }, 300);
    });
    
    // Botón solicitar pago desde modal de información
    if (document.getElementById('infoRequestPaymentBtn')) {
        document.getElementById('infoRequestPaymentBtn').addEventListener('click', () => {
            const employeeId = document.getElementById('infoEmployeeId').textContent;
            infoModal.classList.remove('show');
            setTimeout(() => {
                infoModal.style.display = 'none';
                openPaymentModal(parseInt(employeeId));
            }, 300);
        });
    }
    
    // Filtros de estados
    document.getElementById('applyStatusFilters').addEventListener('click', applyStatusFilters);
    
    // También permitir filtrar cuando se cambia el select
    document.getElementById('statusFilter').addEventListener('change', applyStatusFilters);
    
    // Teclas de atajo
    document.addEventListener('keydown', (e) => {
        // Escape para cerrar modales
        if (e.key === 'Escape') {
            if (paymentModal.classList.contains('show')) {
                paymentModal.classList.remove('show');
                setTimeout(() => {
                    paymentModal.style.display = 'none';
                }, 300);
            }
            if (infoModal.classList.contains('show')) {
                infoModal.classList.remove('show');
                setTimeout(() => {
                    infoModal.style.display = 'none';
                }, 300);
            }
            if (statusModal.classList.contains('show')) {
                statusModal.classList.remove('show');
                setTimeout(() => {
                    statusModal.style.display = 'none';
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

// Agregar funciones al contexto global
window.openPaymentModal = openPaymentModal;
window.openInfoModal = openInfoModal;

// Iniciar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', initApp);

// Detectar cierre de la aplicación
window.addEventListener('beforeunload', function(e) {
    // Aquí se podrían realizar operaciones de limpieza si fuera necesario
});

// Agregar estilo CSS para el spinner de carga dinámicamente
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);