// Importaciones y conexiones
const { connectionString } = require('../Conexion/Conexion');
const ExcelJS = require('exceljs');

// Variables globales
let userData;
let allEmployees = [];
let filteredEmployees = [];
let allDepartments = [];
let currentPage = 1;
const itemsPerPage = 15;
let searchTimeout;
let currentSort = {
    column: null,
    direction: 'asc'
};

// Variables para el modal PDF
let selectedEmployee = null;
let employeePeriods = [];
let isGeneratingPDF = false;

// Elementos DOM
const departmentFilter = document.getElementById('departmentFilter');
const employeeSearch = document.getElementById('employeeSearch');
const clearSearch = document.getElementById('clearSearch');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');
const employeesTable = document.getElementById('employeesTable');
const resultsCount = document.getElementById('resultsCount');
const paginationInfo = document.getElementById('paginationInfo');
const pageIndicator = document.getElementById('pageIndicator');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pdfModal = document.getElementById('pdfModal');
const closePdfModal = document.getElementById('closePdfModal');
const cancelPdfBtn = document.getElementById('cancelPdfBtn');
const generatePdfBtn = document.getElementById('generatePdfBtn');
const loadingOverlay = document.getElementById('loadingOverlay');

// Inicialización de la aplicación
async function initApp() {
    try {
        showLoading('Inicializando aplicación...');
        
        // Cargar datos del usuario
        loadUserData();
        
        // Cargar departamentos
        await loadDepartments();
        
        // Cargar todos los empleados inicialmente
        await loadAllEmployees();
        
        // Inicializar eventos
        initEvents();
        
        hideLoading();
        
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        hideLoading();
        showAlert('Error al inicializar la aplicación. Por favor recargue la página.', 'error');
    }
}

// Cargar datos del usuario desde localStorage
function loadUserData() {
    try {
        userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData) {
            showAlert('No se encontraron datos de sesión. Redirigiendo al login...', 'error');
            setTimeout(() => {
                window.location.href = 'Login.html';
            }, 2000);
            return;
        }
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
        showAlert('Error al cargar los datos de sesión. Redirigiendo al login...', 'error');
        setTimeout(() => {
            window.location.href = 'Login.html';
        }, 2000);
    }
}

// Cargar departamentos
async function loadDepartments() {
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
        
        allDepartments = result || [];
        populateDepartmentFilter();
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        throw error;
    }
}

// Llenar el filtro de departamentos
function populateDepartmentFilter() {
    departmentFilter.innerHTML = '<option value="">-- Todos los departamentos --</option>';
    
    allDepartments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.IdDepartamento;
        option.textContent = dept.NombreDepartamento;
        departmentFilter.appendChild(option);
    });
}

// Cargar todos los empleados
async function loadAllEmployees() {
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
                personal.FechaPlanilla,
                personal.IdSucuDepa,
                personal.IdPlanilla,
                departamentos.NombreDepartamento,
                Puestos.Nombre as NombrePuesto,
                planillas.Nombre_Planilla
            FROM
                personal
                INNER JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                INNER JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
            WHERE
                personal.Estado IN (1, 5) AND
                personal.TipoPersonal = 1
            ORDER BY 
                personal.PrimerNombre, personal.PrimerApellido`;
        
        const result = await connection.query(query);
        await connection.close();
        
        allEmployees = result || [];
        filteredEmployees = [...allEmployees];
        
        renderTable();
        updatePagination();
        updateResultsCount();
        
    } catch (error) {
        console.error('Error al cargar empleados:', error);
        throw error;
    }
}

// Filtrar empleados
function filterEmployees() {
    const departmentId = departmentFilter.value;
    const searchTerm = employeeSearch.value.toLowerCase().trim();
    
    filteredEmployees = allEmployees.filter(employee => {
        // Filtro por departamento
        const matchesDepartment = !departmentId || employee.IdSucuDepa.toString() === departmentId;
        
        // Filtro por búsqueda
        const fullName = getFullName(employee).toLowerCase();
        const matchesSearch = !searchTerm || fullName.includes(searchTerm);
        
        return matchesDepartment && matchesSearch;
    });
    
    currentPage = 1;
    renderTable();
    updatePagination();
    updateResultsCount();
}

// Obtener nombre completo del empleado
function getFullName(employee) {
    if (!employee) {
        console.error('Employee is null or undefined in getFullName');
        return 'Nombre no disponible';
    }
    
    const names = [
        employee.PrimerNombre,
        employee.SegundoNombre,
        employee.TercerNombre,
        employee.PrimerApellido,
        employee.SegundoApellido
    ].filter(name => name && name.trim() !== '');
    
    return names.length > 0 ? names.join(' ') : 'Nombre no disponible';
}

// Renderizar tabla
function renderTable() {
    const tbody = employeesTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (filteredEmployees.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="5" class="empty-state">
                <i class="fas fa-users-slash"></i>
                <h3>No se encontraron colaboradores</h3>
                <p>Intente ajustar los filtros de búsqueda</p>
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const currentPageEmployees = filteredEmployees.slice(start, end);
    
    currentPageEmployees.forEach((employee, index) => {
        const row = document.createElement('tr');
        row.style.animationDelay = `${index * 0.05}s`;
        row.classList.add('animate-in');
        
        row.innerHTML = `
            <td>${getFullName(employee)}</td>
            <td>${employee.NombreDepartamento}</td>
            <td>${employee.NombrePuesto || 'Sin asignar'}</td>
            <td>${employee.Nombre_Planilla || 'Sin asignar'}</td>
            <td class="action-cell">
                <button class="btn-pdf" onclick="openPdfModal(${employee.IdPersonal})">
                    <i class="fas fa-file-pdf"></i>
                    Generar PDF
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Actualizar conteo de resultados
function updateResultsCount() {
    resultsCount.textContent = filteredEmployees.length;
    
    const start = filteredEmployees.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredEmployees.length);
    
    paginationInfo.textContent = `Mostrando ${start} - ${end} de ${filteredEmployees.length} colaboradores`;
}

// Actualizar paginación
function updatePagination() {
    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage) || 1;
    
    pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || filteredEmployees.length === 0;
}

// Abrir modal de PDF
async function openPdfModal(employeeId) {
    try {
        showLoading('Cargando información del empleado...');
        
        selectedEmployee = allEmployees.find(emp => emp.IdPersonal === employeeId);
        if (!selectedEmployee) {
            throw new Error('Empleado no encontrado');
        }
        
        // Cargar períodos del empleado
        await loadEmployeePeriods(employeeId);
        
        // Llenar información en el modal
        populateEmployeeInfo();
        populatePeriodSelect();
        
        hideLoading();
        showModal();
        
    } catch (error) {
        console.error('Error al abrir modal PDF:', error);
        hideLoading();
        showAlert('Error al cargar la información del empleado', 'error');
    }
}

// Cargar períodos del empleado
async function loadEmployeePeriods(employeeId) {
    try {
        const employee = allEmployees.find(emp => emp.IdPersonal === employeeId);
        const fechaPlanilla = employee.FechaPlanilla;
        const aniosCumplidos = Math.floor((new Date() - new Date(fechaPlanilla)) / (365.25 * 24 * 60 * 60 * 1000));
        
        employeePeriods = [];
        const connection = await connectionString();
        
        // Generar todos los períodos posibles (incluyendo incompletos)
        for (let i = 0; i <= aniosCumplidos; i++) {
            const periodo = calcularPeriodo(fechaPlanilla, i);
            
            // Obtener días tomados
            const queryDiasTomados = `
                SELECT COUNT(*) as DiasUtilizados
                FROM vacacionestomadas
                WHERE IdPersonal = ? AND Periodo = ?
            `;
            const resultDiasTomados = await connection.query(queryDiasTomados, [employeeId, periodo]);
            
            // Obtener días pagados
            const queryDiasPagados = `
                SELECT IFNULL(SUM(CAST(DiasSolicitado AS UNSIGNED)), 0) as DiasPagados
                FROM vacacionespagadas
                WHERE IdPersonal = ? AND Periodo = ? AND Estado IN (1,2,3,4)
            `;
            const resultDiasPagados = await connection.query(queryDiasPagados, [employeeId, periodo]);
            
            const diasTomados = parseInt(resultDiasTomados[0]?.DiasUtilizados) || 0;
            const diasPagados = parseInt(resultDiasPagados[0]?.DiasPagados) || 0;
            const totalDias = diasTomados + diasPagados;
            
            // Incluir todos los períodos que tengan al menos 1 día utilizado
            if (totalDias > 0) {
                employeePeriods.push({
                    periodo: periodo,
                    diasTomados: diasTomados,
                    diasPagados: diasPagados,
                    totalDias: totalDias,
                    completo: totalDias === 15
                });
            }
        }
        
        await connection.close();
        
    } catch (error) {
        console.error('Error al cargar períodos del empleado:', error);
        throw error;
    }
}

// Calcular período basado en fecha de planilla
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

// Formatear fecha para base de datos
function formatFechaBaseDatos(fecha) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Llenar información del empleado en el modal
function populateEmployeeInfo() {
    document.getElementById('modalEmployeeName').textContent = getFullName(selectedEmployee);
    document.getElementById('modalEmployeeDept').textContent = selectedEmployee.NombreDepartamento;
    document.getElementById('modalEmployeePosition').textContent = selectedEmployee.NombrePuesto || 'Sin asignar';
    document.getElementById('modalEmployeeDPI').textContent = selectedEmployee.DPI || 'No registrado';
}

// Llenar selector de períodos
function populatePeriodSelect() {
    const periodSelect = document.getElementById('periodSelect');
    periodSelect.innerHTML = '<option value="">-- Seleccione un período --</option>';
    
    if (employeePeriods.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay períodos con días utilizados';
        option.disabled = true;
        periodSelect.appendChild(option);
        return;
    }
    
    employeePeriods.forEach((periodoInfo, index) => {
        const option = document.createElement('option');
        option.value = index;
        
        const estadoPeriodo = periodoInfo.completo ? '✓ Completo' : '⚠ Incompleto';
        const fechaFormateada = formatPeriodoUsuario(periodoInfo.periodo);
        
        option.textContent = `${fechaFormateada} - ${periodoInfo.totalDias}/15 días ${estadoPeriodo}`;
        periodSelect.appendChild(option);
    });
}

// Formatear período para mostrar al usuario
function formatPeriodoUsuario(periodo) {
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

// Manejar selección de período
function handlePeriodSelection() {
    const periodSelect = document.getElementById('periodSelect');
    const periodDetails = document.getElementById('periodDetails');
    const generateBtn = document.getElementById('generatePdfBtn');
    
    if (!periodSelect.value) {
        periodDetails.style.display = 'none';
        generateBtn.disabled = true;
        return;
    }
    
    const selectedPeriodIndex = parseInt(periodSelect.value);
    const selectedPeriodData = employeePeriods[selectedPeriodIndex];
    
    // Actualizar valores en las cards
    document.getElementById('daysTaken').textContent = selectedPeriodData.diasTomados;
    document.getElementById('daysPaid').textContent = selectedPeriodData.diasPagados;
    document.getElementById('totalDays').textContent = selectedPeriodData.totalDias;
    
    // Mostrar detalles con animación
    periodDetails.style.display = 'block';
    
    // Habilitar botón de generar
    generateBtn.disabled = false;
}

// Generar PDF
async function generatePDF() {
    const periodSelect = document.getElementById('periodSelect');
    const includeIncomplete = document.getElementById('includeIncomplete');
    
    if (!periodSelect.value) {
        showAlert('Por favor seleccione un período', 'warning');
        return;
    }
    
    if (!selectedEmployee) {
        showAlert('Error: No se ha seleccionado un empleado', 'error');
        return;
    }
    
    const selectedPeriodIndex = parseInt(periodSelect.value);
    const selectedPeriodData = employeePeriods[selectedPeriodIndex];
    
    // Verificar si el período está incompleto y si está permitido
    if (!selectedPeriodData.completo && !includeIncomplete.checked) {
        showAlert('El período seleccionado está incompleto. Marque la opción para generar PDFs incompletos.', 'warning');
        return;
    }
    
    try {
        isGeneratingPDF = true;
        
        // Crear una copia del empleado antes de cerrar el modal
        const employeeCopy = { ...selectedEmployee };
        const periodDataCopy = { ...selectedPeriodData };
        
        closeModal();
        showLoadingOverlay();
        
        // Obtener detalles del período para el PDF
        const detallesPeriodo = await obtenerDetallesPeriodo(employeeCopy, periodDataCopy.periodo);
        
        // Generar el PDF
        await generarPDFDocument(employeeCopy, periodDataCopy, detallesPeriodo);
        
        hideLoadingOverlay();
        showAlert('PDF generado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        hideLoadingOverlay();
        showAlert('Error al generar el PDF: ' + error.message, 'error');
    } finally {
        isGeneratingPDF = false;
    }
}

// Obtener detalles del período para PDF
async function obtenerDetallesPeriodo(empleado, periodo) {
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
        
        // Obtener información de planilla
        const queryPlanilla = `
            SELECT 
                p.Nombre_Planilla,
                p.Division,
                d.Nombre as NombreDivision
            FROM 
                personal per
                INNER JOIN planillas p ON per.IdPlanilla = p.IdPlanilla
                INNER JOIN divisiones d ON p.Division = d.IdDivision
            WHERE 
                per.IdPersonal = ?
        `;
        const infoPlanilla = await connection.query(queryPlanilla, [empleado.IdPersonal]);
        
        await connection.close();
        
        return {
            fechasTomadas: fechasTomadas || [],
            diasPagados: diasPagados || [],
            infoPlanilla: infoPlanilla[0] || {},
            periodo: periodo
        };
        
    } catch (error) {
        console.error('Error al obtener detalles del período:', error);
        throw error;
    }
}

// Generar documento PDF
async function generarPDFDocument(empleado, periodoData, detalles) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;
    
    // Header del documento
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(detalles.infoPlanilla.NombreDivision || 'EMPRESA', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(14);
    doc.text(detalles.infoPlanilla.Nombre_Planilla || 'PLANILLA', pageWidth / 2, y, { align: 'center' });
    y += 15;
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    doc.text('FICHA DE CONTROL DE VACACIONES', pageWidth / 2, y, { align: 'center' });
    
    y += 20;
    
    // Información del empleado
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
    
    doc.setFont(undefined, 'bold');
    doc.text('Departamento:', 20, y);
    doc.setFont(undefined, 'normal');
    doc.text(empleado.NombreDepartamento, 70, y);
    y += 8;
    
    const periodoFormateado = formatPeriodoUsuario(detalles.periodo);
    doc.setFont(undefined, 'bold');
    doc.text('Período:', 20, y);
    doc.setFont(undefined, 'normal');
    doc.text(periodoFormateado, 70, y);
    y += 20;
    
    // Tabla de días tomados
    if (detalles.fechasTomadas.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text('DÍAS DE VACACIONES TOMADOS:', 20, y);
        y += 10;
        
        // Headers de la tabla
        const col1X = 20;
        const col2X = 60;
        const col3X = 120;
        const tableWidth = 170;
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text('NO.', col1X, y);
        doc.text('FECHA', col2X, y);
        doc.text('FIRMA COLABORADOR', col3X, y);
        y += 5;
        
        doc.setLineWidth(0.5);
        doc.line(col1X, y, col1X + tableWidth, y);
        y += 7;
        
        // Contenido de la tabla
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        detalles.fechasTomadas.forEach((fecha, index) => {
            doc.text((index + 1).toString(), col1X, y);
            doc.text(formatDate(fecha.FechasTomadas), col2X, y);
            
            y += 7;
            doc.setLineWidth(0.3);
            doc.line(col1X, y, col1X + tableWidth, y);
            y += 3;
        });
        
        y += 10;
    }
    
    // Días pagados si los hay
    if (detalles.diasPagados.length > 0) {
        const totalDiasPagados = detalles.diasPagados.reduce((sum, pago) => sum + parseInt(pago.DiasSolicitado), 0);
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text(`Días pagados en efectivo: ${totalDiasPagados}`, 20, y);
        y += 15;
    }
    
    // Resumen
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text(`Total días utilizados: ${periodoData.totalDias} / 15`, 20, y);
    
    if (!periodoData.completo) {
        y += 10;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(255, 0, 0);
        doc.setTextColor(0, 0, 0);
    }
    
    // Footer
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-GT')} a las ${new Date().toLocaleTimeString('es-GT')}`, 20, 270);
    doc.text(`Por: ${userData.NombreCompleto}`, 20, 275);
    doc.text('Página 1 de 1', pageWidth - 40, 270);
    
    // Guardar PDF
    const fileName = `Vacaciones_${nombreCompleto.replace(/\s+/g, '_')}_${periodoFormateado.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
}

// Formatear fecha para mostrar
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-GT');
}

// Exportar a Excel
async function exportToExcel() {
    try {
        showLoading('Generando reporte Excel...');
        
        const workbook = new ExcelJS.Workbook();
        workbook.creator = userData.NombreCompleto;
        workbook.created = new Date();
        
        const worksheet = workbook.addWorksheet('Documentación Vacaciones');
        
        // Configurar columnas
        worksheet.columns = [
            { header: 'Nombre Completo', key: 'nombre', width: 35 },
            { header: 'DPI', key: 'dpi', width: 15 },
            { header: 'Departamento', key: 'departamento', width: 25 },
            { header: 'Puesto', key: 'puesto', width: 25 },
            { header: 'Planilla', key: 'planilla', width: 20 },
            { header: 'Fecha Ingreso', key: 'fechaIngreso', width: 15 }
        ];
        
        // Estilo del header
        worksheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF654321' } };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Agregar datos
        filteredEmployees.forEach((employee, index) => {
            const row = worksheet.addRow({
                nombre: getFullName(employee),
                dpi: employee.DPI || 'No registrado',
                departamento: employee.NombreDepartamento,
                puesto: employee.NombrePuesto || 'Sin asignar',
                planilla: employee.Nombre_Planilla || 'Sin asignar',
                fechaIngreso: formatDate(employee.FechaPlanilla)
            });
            
            // Estilo alternado para las filas
            if (index % 2 !== 0) {
                row.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
                });
            }
        });
        
        // Agregar título y footer
        worksheet.spliceRows(1, 0, ['DOCUMENTACIÓN DE COLABORADORES - VACACIONES']);
        worksheet.spliceRows(2, 0, [`Fecha: ${new Date().toLocaleDateString('es-GT')} - Total: ${filteredEmployees.length} colaboradores`]);
        worksheet.spliceRows(3, 0, []);
        
        worksheet.mergeCells('A1:F1');
        worksheet.mergeCells('A2:F2');
        
        // Estilo del título
        const titleCell = worksheet.getCell('A1');
        titleCell.font = { bold: true, size: 14, color: { argb: 'FF654321' } };
        titleCell.alignment = { horizontal: 'center' };
        
        const dateCell = worksheet.getCell('A2');
        dateCell.font = { italic: true, size: 11, color: { argb: 'FF777777' } };
        dateCell.alignment = { horizontal: 'center' };
        
        // Generar archivo
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        // Descargar archivo
        const a = document.createElement('a');
        const url = window.URL.createObjectURL(blob);
        const date = new Date();
        const formattedDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
        const fileName = `Documentacion_Vacaciones_${formattedDate}.xlsx`;
        
        a.href = url;
        a.download = fileName;
        a.click();
        
        setTimeout(() => window.URL.revokeObjectURL(url), 0);
        
        hideLoading();
        showAlert('Reporte Excel generado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error al exportar Excel:', error);
        hideLoading();
        showAlert('Error al generar el reporte Excel', 'error');
    }
}

// Ordenar datos
function sortData(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    filteredEmployees.sort((a, b) => {
        let valueA, valueB;
        
        switch (column) {
            case 'name':
                valueA = getFullName(a).toLowerCase();
                valueB = getFullName(b).toLowerCase();
                break;
            case 'department':
                valueA = a.NombreDepartamento.toLowerCase();
                valueB = b.NombreDepartamento.toLowerCase();
                break;
            case 'position':
                valueA = (a.NombrePuesto || '').toLowerCase();
                valueB = (b.NombrePuesto || '').toLowerCase();
                break;
            case 'payroll':
                valueA = (a.Nombre_Planilla || '').toLowerCase();
                valueB = (b.Nombre_Planilla || '').toLowerCase();
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
    renderTable();
    updatePagination();
}

// Actualizar indicadores de ordenamiento
function updateSortIndicators() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const icon = th.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-sort';
        }
    });
    
    if (currentSort.column) {
        const th = document.querySelector(`th[data-sort="${currentSort.column}"]`);
        if (th) {
            th.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
            const icon = th.querySelector('i');
            if (icon) {
                icon.className = currentSort.direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
            }
        }
    }
}

// Funciones de UI
function showModal() {
    pdfModal.classList.add('show');
    pdfModal.style.display = 'flex';
}

function closeModal() {
    pdfModal.classList.remove('show');
    setTimeout(() => {
        pdfModal.style.display = 'none';
        resetModal();
    }, 300);
}

function resetModal() {
    selectedEmployee = null;
    employeePeriods = [];
    document.getElementById('periodSelect').value = '';
    document.getElementById('periodDetails').style.display = 'none';
    document.getElementById('generatePdfBtn').disabled = true;
    document.getElementById('includeIncomplete').checked = true;
}

function showLoading(message = 'Cargando...') {
    // Crear o actualizar el loading en la tabla
    const tbody = employeesTable.querySelector('tbody');
    tbody.innerHTML = `
        <tr class="loading-row">
            <td colspan="5" class="loading-cell">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>${message}</span>
                </div>
            </td>
        </tr>
    `;
}

function hideLoading() {
    // El loading se ocultará automáticamente cuando se rendere la tabla
}

function showLoadingOverlay() {
    loadingOverlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    loadingOverlay.style.display = 'none';
}

function showAlert(message, type = 'info') {
    // Usar SweetAlert2 si está disponible, sino usar alert nativo
    if (typeof Swal !== 'undefined') {
        let icon = 'info';
        let color = '#FF9800';
        
        switch (type) {
            case 'success':
                icon = 'success';
                color = '#4CAF50';
                break;
            case 'error':
                icon = 'error';
                color = '#FF5252';
                break;
            case 'warning':
                icon = 'warning';
                color = '#FF9800';
                break;
        }
        
        Swal.fire({
            icon: icon,
            title: type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : 'Aviso',
            text: message,
            confirmButtonColor: color,
            timer: type === 'success' ? 3000 : undefined,
            timerProgressBar: type === 'success'
        });
    } else {
        alert(message);
    }
}

// Inicializar eventos
function initEvents() {
    // Filtro de departamento
    if (departmentFilter) {
        departmentFilter.addEventListener('change', filterEmployees);
    }
    
    // Búsqueda de empleado
    if (employeeSearch) {
        employeeSearch.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            
            // Mostrar/ocultar botón de limpiar
            if (clearSearch) {
                clearSearch.style.display = query ? 'block' : 'none';
            }
            
            // Búsqueda con debounce
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterEmployees();
            }, 300);
        });
        
        employeeSearch.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                this.value = '';
                if (clearSearch) clearSearch.style.display = 'none';
                filterEmployees();
            }
        });
    }
    
    // Botón limpiar búsqueda
    if (clearSearch) {
        clearSearch.addEventListener('click', function() {
            employeeSearch.value = '';
            this.style.display = 'none';
            filterEmployees();
            employeeSearch.focus();
        });
    }
    
    // Botón actualizar
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            try {
                showLoading('Actualizando datos...');
                await loadAllEmployees();
                showAlert('Datos actualizados correctamente', 'success');
            } catch (error) {
                console.error('Error al actualizar:', error);
                showAlert('Error al actualizar los datos', 'error');
            }
        });
    }
    
    // Botón exportar
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToExcel);
    }
    
    // Headers ordenables de la tabla
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const column = this.getAttribute('data-sort');
            if (column) {
                sortData(column);
            }
        });
    });
    
    // Paginación
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
                updatePagination();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
                updatePagination();
            }
        });
    }
    
    // Modal de PDF
    if (closePdfModal) {
        closePdfModal.addEventListener('click', closeModal);
    }
    
    if (cancelPdfBtn) {
        cancelPdfBtn.addEventListener('click', closeModal);
    }
    
    if (generatePdfBtn) {
        generatePdfBtn.addEventListener('click', generatePDF);
    }
    
    // Selector de período en el modal
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
        periodSelect.addEventListener('change', handlePeriodSelection);
    }
    
    // Cerrar modal al hacer clic fuera
    if (pdfModal) {
        pdfModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
    
    // Atajos de teclado
    document.addEventListener('keydown', function(e) {
        // Escape para cerrar modal
        if (e.key === 'Escape') {
            if (pdfModal.classList.contains('show')) {
                closeModal();
            }
        }
        
        // Ctrl+F para enfocar búsqueda
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            if (employeeSearch) {
                employeeSearch.focus();
            }
        }
        
        // Ctrl+R para actualizar (prevenir recarga y hacer refresh de datos)
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            if (refreshBtn) {
                refreshBtn.click();
            }
        }
        
        // Ctrl+E para exportar
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            if (exportBtn) {
                exportBtn.click();
            }
        }
    });
}

// Funciones globales para el HTML
window.openPdfModal = openPdfModal;

// Detectar cierre de aplicación
window.addEventListener('beforeunload', function(e) {
    if (isGeneratingPDF) {
        e.preventDefault();
        e.returnValue = 'Se está generando un PDF. ¿Está seguro de salir?';
        return e.returnValue;
    }
});

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', function() {
    // Verificar dependencias
    if (typeof connectionString === 'undefined') {
        console.error('Error: No se encontró la función connectionString');
        showAlert('Error de configuración: No se puede conectar a la base de datos', 'error');
        return;
    }
    
    if (typeof ExcelJS === 'undefined') {
        console.error('Error: ExcelJS no está cargado');
        showAlert('Error: No se puede exportar a Excel (biblioteca no cargada)', 'error');
    }
    
    if (typeof jsPDF === 'undefined' && !window.jspdf) {
        console.error('Error: jsPDF no está cargado');
        showAlert('Error: No se puede generar PDF (biblioteca no cargada)', 'error');
    }
    
    // Inicializar aplicación
    initApp();
});

// Manejo de errores globales
window.addEventListener('error', function(e) {
    console.error('Error global:', e.error);
    if (!isGeneratingPDF) {
        showAlert('Se produjo un error inesperado. Por favor recargue la página.', 'error');
    }
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rechazada:', e.reason);
    if (!isGeneratingPDF) {
        showAlert('Error de conexión. Verifique su conexión a internet.', 'error');
    }
});