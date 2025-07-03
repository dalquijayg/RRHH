const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');
const ExcelJS = require('exceljs'); 

// Variables globales
let empleadosData = [];
let empleadosFiltrados = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentSort = { field: null, order: 'asc' };

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    inicializarEventListeners();
    cargarInformacionUsuario();
    await cargarPlanillas();
});

// Event Listeners
function inicializarEventListeners() {
    // Selector de tipo de ubicación
    const tipoUbicacion = document.getElementById('tipoUbicacion');
    if (tipoUbicacion) {
        tipoUbicacion.addEventListener('change', async (e) => {
            const planillaSelect = document.getElementById('planillaSelect');
            const generarBtn = document.getElementById('generarReporte');
            const exportarBtn = document.getElementById('exportarExcel');

            if (e.target.value === '') {
                if (planillaSelect) {
                    planillaSelect.disabled = true;
                    planillaSelect.innerHTML = '<option value="">Primero seleccione tipo de ubicación</option>';
                }
                if (generarBtn) {
                    generarBtn.disabled = true;
                }
            } else {
                await cargarPlanillas(e.target.value);
            }
            if (exportarBtn) {
                exportarBtn.addEventListener('click', exportarAExcel);
            }
        });
    }

    // Selector de planilla
    const planillaSelect = document.getElementById('planillaSelect');
    if (planillaSelect) {
        planillaSelect.addEventListener('change', (e) => {
            const generarBtn = document.getElementById('generarReporte');
            if (generarBtn) {
                generarBtn.disabled = e.target.value === '';
            }
        });
    }

    // Botón generar reporte
    const generarBtn = document.getElementById('generarReporte');
    if (generarBtn) {
        generarBtn.addEventListener('click', generarReporte);
    }

    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filtrarEmpleados);
    }

    // Modal
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', cerrarModal);
    }
    
    const employeeModal = document.getElementById('employeeModal');
    if (employeeModal) {
        employeeModal.addEventListener('click', (e) => {
            if (e.target.id === 'employeeModal') {
                cerrarModal();
            }
        });
    }
}

// Inicializar ordenamiento por headers de tabla
function inicializarOrdenamientoTabla() {
    const table = document.getElementById('employeesTable');
    if (!table) return;

    const sortableHeaders = table.querySelectorAll('th.sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortField = header.getAttribute('data-sort');
            ordenarPorColumna(sortField, header);
        });
    });
}

// Ordenar por columna clickeada
function ordenarPorColumna(field, headerElement) {
    // Determinar el orden
    if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.order = 'asc';
    }

    // Actualizar estados visuales de headers
    actualizarEstadosHeaders(headerElement);
    
    // Realizar ordenamiento
    ordenarEmpleados();
}

// Actualizar estados visuales de los headers
function actualizarEstadosHeaders(activeHeader) {
    const table = document.getElementById('employeesTable');
    if (!table) return;

    // Limpiar todos los headers
    const allHeaders = table.querySelectorAll('th.sortable');
    allHeaders.forEach(header => {
        header.classList.remove('active', 'asc', 'desc');
        const icon = header.querySelector('.sort-icon');
        if (icon) {
            icon.className = 'fas fa-sort sort-icon';
        }
    });

    // Marcar el header activo
    if (activeHeader) {
        activeHeader.classList.add('active', currentSort.order);
        const icon = activeHeader.querySelector('.sort-icon');
        if (icon) {
            if (currentSort.order === 'asc') {
                icon.className = 'fas fa-sort-up sort-icon';
            } else {
                icon.className = 'fas fa-sort-down sort-icon';
            }
        }
    }
}

// Cargar información del usuario logueado
function cargarInformacionUsuario() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData) {
            const userInfo = document.getElementById('userInfo');
            if (userInfo) {
                const userImage = userData.FotoBase64 || '../Imagenes/user-default.png';
                
                userInfo.innerHTML = `
                    <img src="${userImage}" alt="Usuario" class="user-avatar">
                    <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${userData.NombreCompleto}</div>
                        <div style="font-size: 0.8rem; color: #777;">${userData.NombreDepartamento}</div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error al cargar información del usuario:', error);
    }
}

// Cargar planillas según el tipo de ubicación
async function cargarPlanillas(esCapital = null) {
    try {
        const connection = await connectionString();
        let query = `
            SELECT
                planillas.IdPlanilla, 
                CONCAT(divisiones.Nombre, ' - ', planillas.Nombre_Planilla) AS Nombre_Planilla_Completa,
                planillas.EsCapital
            FROM
                planillas
            INNER JOIN
                divisiones
                ON planillas.Division = divisiones.IdDivision
        `;
        
        let params = [];
        if (esCapital !== null) {
            query += ' WHERE planillas.EsCapital = ?';
            params.push(esCapital);
        }
        
        query += ' ORDER BY divisiones.Nombre, planillas.Nombre_Planilla';
        
        const result = await connection.query(query, params);
        await connection.close();
        
        const planillaSelect = document.getElementById('planillaSelect');
        if (planillaSelect) {
            planillaSelect.innerHTML = '<option value="">Seleccione una planilla</option>';
            
            result.forEach(planilla => {
                const option = document.createElement('option');
                option.value = planilla.IdPlanilla;
                option.textContent = planilla.Nombre_Planilla_Completa;
                option.dataset.esCapital = planilla.EsCapital;
                planillaSelect.appendChild(option);
            });
            
            planillaSelect.disabled = false;
        }
        
    } catch (error) {
        console.error('Error al cargar planillas:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar las planillas'
        });
    }
}

// Generar reporte
async function generarReporte() {
    const planillaSelect = document.getElementById('planillaSelect');
    const planillaId = planillaSelect?.value;
    const planillaNombre = planillaSelect?.selectedOptions[0]?.textContent;
    
    if (!planillaId) {
        await Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: 'Debe seleccionar una planilla'
        });
        return;
    }
    
    mostrarCargando(true);
    
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                personal.IdPersonal, 
                CONCAT(
                    IFNULL(personal.PrimerApellido, ''), ' ',
                    IFNULL(personal.SegundoApellido, ''), ' ',
                    IFNULL(personal.PrimerNombre, ''), ' ',
                    IFNULL(personal.SegundoNombre, ''), ' ',
                    IFNULL(personal.TercerNombre, '')
                ) AS NombreCompleto,
                personal.DPI, 
                departamentos.NombreDepartamento, 
                Puestos.Nombre AS NombrePuesto, 
                personal.FechaPlanilla, 
                personal.SalarioDiario, 
                personal.SalarioQuincena, 
                personal.SalarioQuincenaFinMes, 
                personal.SalarioBase, 
                personal.Bonificacion, 
                personal.CuentaDivision1, 
                personal.CuentaDivision2, 
                personal.CuentaDivision3,
                CONCAT(
                    IFNULL(personal.CuentaDivision1, ''), ' ',
                    IFNULL(personal.CuentaDivision2, ''), ' ',
                    IFNULL(personal.CuentaDivision3, '')
                ) AS CuentaBancaria
            FROM
                personal
                INNER JOIN departamentos
                    ON personal.IdSucuDepa = departamentos.IdDepartamento
                INNER JOIN Puestos
                    ON personal.IdPuesto = Puestos.IdPuesto
            WHERE
                personal.IdPlanilla = ?
            ORDER BY personal.PrimerApellido, personal.SegundoApellido, personal.PrimerNombre
        `, [planillaId]);
        
        await connection.close();
        
        empleadosData = result.map(emp => ({
            ...emp,
            NombreCompleto: emp.NombreCompleto.replace(/\s+/g, ' ').trim()
        }));
        
        empleadosFiltrados = [...empleadosData];
        currentPage = 1;
        currentSort = { field: null, order: 'asc' }; // Reset ordenamiento
        
        mostrarResultados(planillaNombre);
        renderizarTabla();
        
        // Reinicializar listeners de ordenamiento después de cargar datos
        setTimeout(() => {
            inicializarOrdenamientoTabla();
        }, 100);
        
    } catch (error) {
        console.error('Error al generar reporte:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo generar el reporte'
        });
    } finally {
        mostrarCargando(false);
    }
}

// Mostrar/ocultar paneles optimizado
function mostrarCargando(show) {
    const loadingPanel = document.getElementById('loadingPanel');
    const dataPanel = document.getElementById('dataPanel');
    const tableControls = document.getElementById('tableControls');
    const exportarBtn = document.getElementById('exportarExcel'); // AGREGAR
    
    if (show) {
        if (loadingPanel) loadingPanel.style.display = 'flex';
        if (dataPanel) dataPanel.style.display = 'none';
        if (tableControls) tableControls.style.display = 'none';
        if (exportarBtn) exportarBtn.style.display = 'none'; // AGREGAR
    } else {
        if (loadingPanel) loadingPanel.style.display = 'none';
        if (dataPanel) dataPanel.style.display = 'flex';
        if (tableControls) tableControls.style.display = 'flex';
    }
}

// Mostrar resultados optimizado
function mostrarResultados(planillaNombre) {
    const planillaInfoCompact = document.getElementById('planillaInfoCompact');
    const tableControls = document.getElementById('tableControls');
    const exportarBtn = document.getElementById('exportarExcel'); // AGREGAR
    const totalEmpleados = empleadosData.length;
    
    if (planillaInfoCompact) {
        planillaInfoCompact.innerHTML = `
            <i class="fas fa-clipboard-list"></i> ${planillaNombre} - ${totalEmpleados} empleados
        `;
    }
    
    if (tableControls) {
        tableControls.style.display = 'flex';
    }
    
    // AGREGAR ESTAS LÍNEAS
    if (exportarBtn) {
        exportarBtn.style.display = 'flex';
        exportarBtn.disabled = false;
    }
}

// Filtrar empleados por búsqueda
function filtrarEmpleados() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) {
        console.log('Elemento searchInput no encontrado');
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase();
    
    if (searchTerm === '') {
        empleadosFiltrados = [...empleadosData];
    } else {
        empleadosFiltrados = empleadosData.filter(emp => 
            emp.NombreCompleto.toLowerCase().includes(searchTerm) ||
            emp.DPI.includes(searchTerm) ||
            (emp.CuentaBancaria && emp.CuentaBancaria.toLowerCase().includes(searchTerm)) ||
            emp.NombreDepartamento.toLowerCase().includes(searchTerm) ||
            emp.NombrePuesto.toLowerCase().includes(searchTerm)
        );
    }
    
    currentPage = 1;
    renderizarTabla();
}

// Ordenar empleados
function ordenarEmpleados() {
    if (!currentSort.field) return;

    empleadosFiltrados.sort((a, b) => {
        let valueA, valueB;
        
        switch (currentSort.field) {
            case 'numero':
                // Para el número de fila, usar el índice original
                valueA = empleadosData.indexOf(a) + 1;
                valueB = empleadosData.indexOf(b) + 1;
                break;
            case 'nombre':
                valueA = a.NombreCompleto.toLowerCase();
                valueB = b.NombreCompleto.toLowerCase();
                break;
            case 'cuenta':
                valueA = a.CuentaBancaria || '';
                valueB = b.CuentaBancaria || '';
                break;
            case 'departamento':
                valueA = a.NombreDepartamento.toLowerCase();
                valueB = b.NombreDepartamento.toLowerCase();
                break;
            case 'puesto':
                valueA = a.NombrePuesto.toLowerCase();
                valueB = b.NombrePuesto.toLowerCase();
                break;
            case 'fecha':
                valueA = new Date(a.FechaPlanilla);
                valueB = new Date(b.FechaPlanilla);
                break;
            case 'salario':
                valueA = parseFloat(a.SalarioBase) || 0;
                valueB = parseFloat(b.SalarioBase) || 0;
                break;
            case 'bonificacion':
                valueA = parseFloat(a.Bonificacion) || 0;
                valueB = parseFloat(b.Bonificacion) || 0;
                break;
            default:
                return 0;
        }
        
        if (valueA < valueB) return currentSort.order === 'asc' ? -1 : 1;
        if (valueA > valueB) return currentSort.order === 'asc' ? 1 : -1;
        return 0;
    });
    
    currentPage = 1;
    renderizarTabla();
}

// Renderizar tabla optimizada
function renderizarTabla() {
    const tbody = document.getElementById('employeesTableBody');
    
    if (!tbody) {
        console.error('No se encontró el elemento employeesTableBody');
        return;
    }
    
    const totalPages = Math.ceil(empleadosFiltrados.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const empleadosPagina = empleadosFiltrados.slice(startIndex, endIndex);
    
    tbody.innerHTML = '';
    
    empleadosPagina.forEach((empleado, index) => {
        const row = document.createElement('tr');
        const numeroFila = startIndex + index + 1;
        
        row.innerHTML = `
            <td class="text-center">${numeroFila}</td>
            <td class="font-weight-bold">${empleado.NombreCompleto}</td>
            <td class="text-center">${empleado.CuentaBancaria || 'No asignada'}</td>
            <td>${empleado.NombreDepartamento}</td>
            <td>${empleado.NombrePuesto}</td>
            <td class="text-center">${formatearFecha(empleado.FechaPlanilla)}</td>
            <td class="text-right">Q${parseFloat(empleado.SalarioBase || 0).toLocaleString('es-GT', {minimumFractionDigits: 2})}</td>
            <td class="text-right">Q${parseFloat(empleado.Bonificacion || 0).toLocaleString('es-GT', {minimumFractionDigits: 2})}</td>
            <td class="text-center">
                <button class="action-btn btn-view" onclick="verDetallesEmpleado(${empleado.IdPersonal})" title="Ver detalles">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    renderizarPaginacion(totalPages);
}

// Renderizar paginación optimizada
function renderizarPaginacion(totalPages) {
    const container = document.getElementById('paginationContainer');
    
    if (!container) {
        console.error('No se encontró el elemento paginationContainer');
        return;
    }
    
    if (totalPages <= 1) {
        container.innerHTML = `
            <span style="color: #666; font-size: 0.85rem;">
                Mostrando ${empleadosFiltrados.length} de ${empleadosData.length} empleados
            </span>
        `;
        return;
    }
    
    let html = '';
    
    // Info de páginas
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, empleadosFiltrados.length);
    
    html += `
        <span style="color: #666; font-size: 0.85rem; margin-right: 1rem;">
            ${startItem}-${endItem} de ${empleadosFiltrados.length}
        </span>
    `;
    
    // Botón anterior
    html += `
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="cambiarPagina(${currentPage - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Páginas (versión compacta)
    const maxVisible = 3;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="cambiarPagina(1)">1</button>`;
        if (startPage > 2) {
            html += `<span style="color: #666;">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="cambiarPagina(${i})">
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span style="color: #666;">...</span>`;
        }
        html += `<button class="pagination-btn" onclick="cambiarPagina(${totalPages})">${totalPages}</button>`;
    }
    
    // Botón siguiente
    html += `
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="cambiarPagina(${currentPage + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    container.innerHTML = html;
}

// Cambiar página
function cambiarPagina(page) {
    const totalPages = Math.ceil(empleadosFiltrados.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderizarTabla();
    }
}

// Ver detalles del empleado
async function verDetallesEmpleado(idPersonal) {
    const empleado = empleadosData.find(emp => emp.IdPersonal === idPersonal);
    
    if (!empleado) {
        console.error('Empleado no encontrado');
        return;
    }
    
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) {
        console.error('Modal body no encontrado');
        return;
    }
    
    modalBody.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
            <div>
                <h4 style="color: #2C3E50; margin-bottom: 1rem; border-bottom: 2px solid #3498DB; padding-bottom: 0.5rem;">
                    <i class="fas fa-user"></i> Información Personal
                </h4>
                <p><strong>Nombre:</strong> ${empleado.NombreCompleto}</p>
                <p><strong>DPI:</strong> ${empleado.DPI}</p>
                <p><strong>Cuenta Bancaria:</strong> ${empleado.CuentaBancaria || 'No asignada'}</p>
                <p><strong>Departamento:</strong> ${empleado.NombreDepartamento}</p>
                <p><strong>Puesto:</strong> ${empleado.NombrePuesto}</p>
                <p><strong>Fecha Planilla:</strong> ${formatearFecha(empleado.FechaPlanilla)}</p>
            </div>
            
            <div>
                <h4 style="color: #2C3E50; margin-bottom: 1rem; border-bottom: 2px solid #3498DB; padding-bottom: 0.5rem;">
                    <i class="fas fa-money-bill-wave"></i> Información Salarial
                </h4>
                <p><strong>Salario Diario:</strong> Q${parseFloat(empleado.SalarioDiario || 0).toLocaleString('es-GT', {minimumFractionDigits: 2})}</p>
                <p><strong>Salario Quincena:</strong> Q${parseFloat(empleado.SalarioQuincena || 0).toLocaleString('es-GT', {minimumFractionDigits: 2})}</p>
                <p><strong>Salario Fin de Mes:</strong> Q${parseFloat(empleado.SalarioQuincenaFinMes || 0).toLocaleString('es-GT', {minimumFractionDigits: 2})}</p>
                <p><strong>Salario Base:</strong> Q${parseFloat(empleado.SalarioBase || 0).toLocaleString('es-GT', {minimumFractionDigits: 2})}</p>
                <p><strong>Bonificación:</strong> Q${parseFloat(empleado.Bonificacion || 0).toLocaleString('es-GT', {minimumFractionDigits: 2})}</p>
            </div>
            
            <div style="grid-column: 1 / -1;">
                <h4 style="color: #2C3E50; margin-bottom: 1rem; border-bottom: 2px solid #3498DB; padding-bottom: 0.5rem;">
                    <i class="fas fa-building"></i> Cuentas División (Detalle)
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <p><strong>División 1:</strong> ${empleado.CuentaDivision1 || 'No asignada'}</p>
                    <p><strong>División 2:</strong> ${empleado.CuentaDivision2 || 'No asignada'}</p>
                    <p><strong>División 3:</strong> ${empleado.CuentaDivision3 || 'No asignada'}</p>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.getElementById('employeeModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Cerrar modal
function cerrarModal() {
    const modal = document.getElementById('employeeModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    
    try {
        // Crear la fecha sin problemas de zona horaria
        let date;
        
        if (typeof fecha === 'string') {
            // Si es string, crear fecha local sin conversión UTC
            const partes = fecha.split('T')[0].split('-'); // Tomar solo la parte de fecha
            if (partes.length === 3) {
                // Crear fecha local: año, mes-1 (porque los meses en JS van de 0-11), día
                date = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
            } else {
                date = new Date(fecha);
            }
        } else {
            date = new Date(fecha);
        }
        
        // Verificar si la fecha es válida
        if (isNaN(date.getTime())) {
            return 'Fecha inválida';
        }
        
        return date.toLocaleDateString('es-GT', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (error) {
        return 'Fecha inválida';
    }
}
async function exportarAExcel() {
    if (!empleadosData || empleadosData.length === 0) {
        await Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay datos para exportar'
        });
        return;
    }
    
    try {
        // Mostrar loading
        const loadingSwal = Swal.fire({
            title: 'Generando Excel...',
            html: 'Por favor espere mientras se genera el archivo',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const planillaNombre = document.getElementById('planillaSelect')?.selectedOptions[0]?.textContent || 'Planilla';
        
        // Crear el archivo Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Planilla');
        
        // Configurar información del archivo
        workbook.creator = 'Sistema de Recursos Humanos';
        workbook.created = new Date();
        
        // Título principal
        worksheet.mergeCells('A1:I2');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `REPORTE DE PLANILLA - ${planillaNombre.toUpperCase()}`;
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2C3E50' }
        };
        titleCell.font.color = { argb: 'FFFFFFFF' };
        
        // Información adicional
        worksheet.getCell('A4').value = `Total de empleados: ${empleadosData.length}`;
        worksheet.getCell('A5').value = `Fecha de generación: ${new Date().toLocaleDateString('es-GT')}`;
        
        // Headers de la tabla
        const headers = [
            '#', 'Nombre Completo', 'Cuenta Bancaria', 'Departamento', 
            'Puesto', 'Fecha Planilla', 'Salario Base', 'Bonificación', 'DPI'
        ];
        
        const headerRow = worksheet.getRow(7);
        headers.forEach((header, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF34495E' }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
        
        // Datos de los empleados
        empleadosData.forEach((empleado, index) => {
            const row = worksheet.getRow(8 + index);
            
            row.getCell(1).value = index + 1;
            row.getCell(2).value = empleado.NombreCompleto;
            row.getCell(3).value = empleado.CuentaBancaria || 'No asignada';
            row.getCell(4).value = empleado.NombreDepartamento;
            row.getCell(5).value = empleado.NombrePuesto;
            row.getCell(6).value = empleado.FechaPlanilla ? new Date(empleado.FechaPlanilla) : null;
            row.getCell(7).value = parseFloat(empleado.SalarioBase) || 0;
            row.getCell(8).value = parseFloat(empleado.Bonificacion) || 0;
            row.getCell(9).value = empleado.DPI;
            
            // Formato de moneda para salarios
            row.getCell(7).numFmt = '"Q"#,##0.00';
            row.getCell(8).numFmt = '"Q"#,##0.00';
            
            // Formato de fecha
            if (empleado.FechaPlanilla) {
                row.getCell(6).numFmt = 'dd/mm/yyyy';
            }
            
            // Bordes para todas las celdas
            for (let col = 1; col <= 9; col++) {
                row.getCell(col).border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            }
            
            // Alternar colores de filas
            if (index % 2 === 0) {
                for (let col = 1; col <= 9; col++) {
                    row.getCell(col).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF8FBFF' }
                    };
                }
            }
        });
        
        // Ajustar ancho de columnas
        const columnWidths = [5, 30, 20, 20, 25, 15, 15, 15, 15];
        columnWidths.forEach((width, index) => {
            worksheet.getColumn(index + 1).width = width;
        });
        
        // Agregar totales al final
        const totalRow = worksheet.getRow(8 + empleadosData.length + 1);
        totalRow.getCell(6).value = 'TOTALES:';
        totalRow.getCell(6).font = { bold: true };
        
        const totalSalarios = empleadosData.reduce((sum, emp) => sum + (parseFloat(emp.SalarioBase) || 0), 0);
        const totalBonificaciones = empleadosData.reduce((sum, emp) => sum + (parseFloat(emp.Bonificacion) || 0), 0);
        
        totalRow.getCell(7).value = totalSalarios;
        totalRow.getCell(7).numFmt = '"Q"#,##0.00';
        totalRow.getCell(7).font = { bold: true };
        
        totalRow.getCell(8).value = totalBonificaciones;
        totalRow.getCell(8).numFmt = '"Q"#,##0.00';
        totalRow.getCell(8).font = { bold: true };
        
        // Generar el archivo
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Crear nombre de archivo
        const fechaActual = new Date().toISOString().split('T')[0];
        const nombrePlanilla = planillaNombre.replace(/[^a-zA-Z0-9]/g, '_');
        const nombreArchivo = `Reporte_Planilla_${nombrePlanilla}_${fechaActual}.xlsx`;
        
        // Descargar el archivo
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nombreArchivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Cerrar loading
        loadingSwal.close();
        
        // Mostrar éxito
        await Swal.fire({
            icon: 'success',
            title: '¡Exportación exitosa!',
            text: `El archivo ${nombreArchivo} se ha descargado correctamente`,
            timer: 3000,
            timerProgressBar: true
        });
        
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error al exportar',
            text: 'No se pudo generar el archivo Excel'
        });
    }
}
// Exportar funciones globales para uso en HTML
window.cambiarPagina = cambiarPagina;
window.verDetallesEmpleado = verDetallesEmpleado;