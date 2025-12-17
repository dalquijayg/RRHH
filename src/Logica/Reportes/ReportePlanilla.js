const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');
const ExcelJS = require('exceljs'); 

// Variables globales
let empleadosData = [];
let empleadosFiltrados = [];
let currentPage = 1;
const itemsPerPage = 50;
let currentSort = { field: null, order: 'asc' };
let empleadoEditando = null;

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

    // NUEVO: Checkbox filtro sin cuenta bancaria
    const filtroSinCuenta = document.getElementById('filtroSinCuenta');
    if (filtroSinCuenta) {
        filtroSinCuenta.addEventListener('change', aplicarFiltroSinCuenta);
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

    // Modal handlers...
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
    inicializarEventListenersEdicion();
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

            // AGREGAR OPCIÓN "TODAS LAS PLANILLAS"
            const todasOption = document.createElement('option');
            todasOption.value = 'TODAS';
            todasOption.textContent = '📋 TODAS LAS PLANILLAS';
            todasOption.dataset.esCapital = esCapital !== null ? esCapital : 'todas';
            todasOption.selected = true; // SELECCIONAR POR DEFECTO
            planillaSelect.appendChild(todasOption);

            result.forEach(planilla => {
                const option = document.createElement('option');
                option.value = planilla.IdPlanilla;
                option.textContent = planilla.Nombre_Planilla_Completa;
                option.dataset.esCapital = planilla.EsCapital;
                planillaSelect.appendChild(option);
            });

            planillaSelect.disabled = false;

            // HABILITAR EL BOTÓN DE GENERAR REPORTE AUTOMÁTICAMENTE
            const generarBtn = document.getElementById('generarReporte');
            if (generarBtn) {
                generarBtn.disabled = false;
            }
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
    const tipoUbicacion = document.getElementById('tipoUbicacion').value;
    
    if (!planillaId) {
        await Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: 'Debe seleccionar una planilla'
        });
        return;
    }
    
    mostrarCargando(true);
    
    // RESETEAR FILTROS AL GENERAR NUEVO REPORTE
    const filtroSinCuenta = document.getElementById('filtroSinCuenta');
    const searchInput = document.getElementById('searchInput');
    
    if (filtroSinCuenta) {
        filtroSinCuenta.checked = false;
    }
    if (searchInput) {
        searchInput.value = '';
    }
    
    try {
        const connection = await connectionString();
        
        let query = `
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
                ) AS CuentaBancaria,
                planillas.Nombre_Planilla,
                divisiones.Nombre AS NombreDivision
            FROM
                personal
                INNER JOIN departamentos
                    ON personal.IdSucuDepa = departamentos.IdDepartamento
                INNER JOIN Puestos
                    ON personal.IdPuesto = Puestos.IdPuesto
                INNER JOIN planillas
                    ON personal.IdPlanilla = planillas.IdPlanilla
                INNER JOIN divisiones
                    ON planillas.Division = divisiones.IdDivision
            WHERE personal.Estado IN ('1', '5')
        `;

        let params = [];

        if (planillaId === 'TODAS') {
            if (tipoUbicacion !== '') {
                query += ' AND planillas.EsCapital = ?';
                params.push(tipoUbicacion);
            }
        } else {
            query += ' AND personal.IdPlanilla = ?';
            params.push(planillaId);
        }
        
        query += ' ORDER BY divisiones.Nombre, planillas.Nombre_Planilla, personal.PrimerApellido, personal.SegundoApellido, personal.PrimerNombre';
        
        const result = await connection.query(query, params);
        await connection.close();
        
        empleadosData = result.map(emp => ({
            ...emp,
            NombreCompleto: emp.NombreCompleto.replace(/\s+/g, ' ').trim()
        }));
        
        empleadosFiltrados = [...empleadosData];
        currentPage = 1;
        currentSort = { field: null, order: 'asc' };
        
        let nombreMostrar = planillaNombre;
        if (planillaId === 'TODAS') {
            const tipoTexto = tipoUbicacion === '1' ? 'Capital' : 
                             tipoUbicacion === '0' ? 'Regional' : 
                             'Capital y Regional';
            nombreMostrar = `📋 TODAS LAS PLANILLAS (${tipoTexto})`;
        }
        
        mostrarResultados(nombreMostrar);
        renderizarTabla();
        
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
    const filtroSinCuenta = document.getElementById('filtroSinCuenta');
    
    if (!searchInput) {
        console.log('Elemento searchInput no encontrado');
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase();
    
    // Primero aplicar filtro de cuenta bancaria si está activo
    let datosBase = empleadosData;
    if (filtroSinCuenta && filtroSinCuenta.checked) {
        datosBase = empleadosData.filter(emp => {
            const sinCuenta1 = !emp.CuentaDivision1 || emp.CuentaDivision1.trim() === '';
            const sinCuenta2 = !emp.CuentaDivision2 || emp.CuentaDivision2.trim() === '';
            const sinCuenta3 = !emp.CuentaDivision3 || emp.CuentaDivision3.trim() === '';
            return sinCuenta1 && sinCuenta2 && sinCuenta3;
        });
    }
    
    // Luego aplicar búsqueda de texto
    if (searchTerm === '') {
        empleadosFiltrados = [...datosBase];
    } else {
        empleadosFiltrados = datosBase.filter(emp => 
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
    const planillaSelect = document.getElementById('planillaSelect');
    const mostrarPlanilla = planillaSelect?.value === 'TODAS';
    const filtroSinCuenta = document.getElementById('filtroSinCuenta');
    const filtroActivo = filtroSinCuenta?.checked || false;
    
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
        
        // Verificar si el empleado no tiene cuenta bancaria
        const sinCuentaBancaria = (!empleado.CuentaDivision1 || empleado.CuentaDivision1.trim() === '') &&
                                 (!empleado.CuentaDivision2 || empleado.CuentaDivision2.trim() === '') &&
                                 (!empleado.CuentaDivision3 || empleado.CuentaDivision3.trim() === '');
        
        // Agregar clase CSS si no tiene cuenta
        if (sinCuentaBancaria) {
            row.classList.add('empleado-sin-cuenta');
        }
        
        const planillaColumn = mostrarPlanilla ? 
            `<td class="text-center planilla-cell" style="font-size: 0.8rem; color: #666;">
                ${empleado.NombreDivision} - ${empleado.Nombre_Planilla}
            </td>` : '';
        
        // Destacar la celda de cuenta bancaria cuando está vacía
        const cuentaBancariaClass = sinCuentaBancaria ? 'cuenta-vacia' : '';
        const cuentaBancariaTexto = sinCuentaBancaria ? 
            '<span style="color: #e74c3c; font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> No asignada</span>' :
            empleado.CuentaBancaria;
        
        row.innerHTML = `
            <td class="text-center">${numeroFila}</td>
            <td class="font-weight-bold">${empleado.NombreCompleto}</td>
            <td class="text-center ${cuentaBancariaClass}">
                <span class="bank-account-clickable" onclick="editarCuentaBancaria(${empleado.IdPersonal})" title="Click para editar">
                    ${cuentaBancariaTexto}
                </span>
            </td>
            <td>${empleado.NombreDepartamento}</td>
            <td>${empleado.NombrePuesto}</td>
            ${planillaColumn}
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
    actualizarHeadersTabla(mostrarPlanilla);
}
function actualizarHeadersTabla(mostrarPlanilla) {
    const table = document.getElementById('employeesTable');
    if (!table) return;
    
    const thead = table.querySelector('thead tr');
    if (!thead) return;
    
    // Verificar si ya tiene la columna de planilla
    const planillaHeader = thead.querySelector('.planilla-header');
    
    if (mostrarPlanilla && !planillaHeader) {
        // Agregar header de planilla después de "Puesto"
        const puestoHeader = thead.querySelector('[data-sort="puesto"]');
        if (puestoHeader) {
            const planillaHeaderElement = document.createElement('th');
            planillaHeaderElement.className = 'sortable planilla-header';
            planillaHeaderElement.setAttribute('data-sort', 'planilla');
            planillaHeaderElement.innerHTML = `
                Planilla
                <i class="fas fa-sort sort-icon"></i>
            `;
            puestoHeader.insertAdjacentElement('afterend', planillaHeaderElement);
        }
    } else if (!mostrarPlanilla && planillaHeader) {
        // Remover header de planilla
        planillaHeader.remove();
    }
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
        const loadingSwal = Swal.fire({
            title: 'Generando Excel...',
            html: 'Por favor espere mientras se genera el archivo',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const planillaSelect = document.getElementById('planillaSelect');
        const planillaNombre = planillaSelect?.selectedOptions[0]?.textContent || 'Planilla';
        const mostrarPlanilla = planillaSelect?.value === 'TODAS';
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Planilla');
        
        workbook.creator = 'Sistema de Recursos Humanos';
        workbook.created = new Date();
        
        // Título principal
        const titleRange = mostrarPlanilla ? 'A1:J2' : 'A1:I2';
        worksheet.mergeCells(titleRange);
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
        
        worksheet.getCell('A4').value = `Total de empleados: ${empleadosData.length}`;
        worksheet.getCell('A5').value = `Fecha de generación: ${new Date().toLocaleDateString('es-GT')}`;
        
        // Headers de la tabla - MODIFICAR PARA INCLUIR PLANILLA SI ES NECESARIO
        const headers = [
            '#', 'Nombre Completo', 'Cuenta Bancaria', 'Departamento', 'Puesto'
        ];
        
        if (mostrarPlanilla) {
            headers.push('Planilla');
        }
        
        headers.push('Fecha Planilla', 'Salario Base', 'Bonificación', 'DPI');
        
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
        
        // Datos de los empleados - MODIFICAR PARA INCLUIR PLANILLA
        empleadosData.forEach((empleado, index) => {
            const row = worksheet.getRow(8 + index);
            let colIndex = 1;
            
            row.getCell(colIndex++).value = index + 1;
            row.getCell(colIndex++).value = empleado.NombreCompleto;
            row.getCell(colIndex++).value = empleado.CuentaBancaria || 'No asignada';
            row.getCell(colIndex++).value = empleado.NombreDepartamento;
            row.getCell(colIndex++).value = empleado.NombrePuesto;
            
            if (mostrarPlanilla) {
                row.getCell(colIndex++).value = `${empleado.NombreDivision} - ${empleado.Nombre_Planilla}`;
            }
            
            row.getCell(colIndex++).value = empleado.FechaPlanilla ? new Date(empleado.FechaPlanilla) : null;
            row.getCell(colIndex++).value = parseFloat(empleado.SalarioBase) || 0;
            row.getCell(colIndex++).value = parseFloat(empleado.Bonificacion) || 0;
            row.getCell(colIndex++).value = empleado.DPI;
            
            // Formato de moneda para salarios
            const salarioCol = mostrarPlanilla ? 7 : 6;
            const bonificacionCol = mostrarPlanilla ? 8 : 7;
            
            row.getCell(salarioCol).numFmt = '"Q"#,##0.00';
            row.getCell(bonificacionCol).numFmt = '"Q"#,##0.00';
            
            // Formato de fecha
            if (empleado.FechaPlanilla) {
                const fechaCol = mostrarPlanilla ? 6 : 5;
                row.getCell(fechaCol + 1).numFmt = 'dd/mm/yyyy';
            }
            
            // Bordes para todas las celdas
            const totalCols = mostrarPlanilla ? 10 : 9;
            for (let col = 1; col <= totalCols; col++) {
                row.getCell(col).border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            }
            
            // Alternar colores de filas
            if (index % 2 === 0) {
                for (let col = 1; col <= totalCols; col++) {
                    row.getCell(col).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF8FBFF' }
                    };
                }
            }
        });
        
        // Ajustar ancho de columnas
        const columnWidths = mostrarPlanilla ? 
            [5, 30, 20, 20, 25, 25, 15, 15, 15, 15] : 
            [5, 30, 20, 20, 25, 15, 15, 15, 15];
            
        columnWidths.forEach((width, index) => {
            worksheet.getColumn(index + 1).width = width;
        });
        
        // Totales al final
        const totalRow = worksheet.getRow(8 + empleadosData.length + 1);
        const totalLabelCol = mostrarPlanilla ? 6 : 5;
        const totalSalarioCol = mostrarPlanilla ? 7 : 6;
        const totalBonificacionCol = mostrarPlanilla ? 8 : 7;
        
        totalRow.getCell(totalLabelCol + 1).value = 'TOTALES:';
        totalRow.getCell(totalLabelCol + 1).font = { bold: true };
        
        const totalSalarios = empleadosData.reduce((sum, emp) => sum + (parseFloat(emp.SalarioBase) || 0), 0);
        const totalBonificaciones = empleadosData.reduce((sum, emp) => sum + (parseFloat(emp.Bonificacion) || 0), 0);
        
        totalRow.getCell(totalSalarioCol + 1).value = totalSalarios;
        totalRow.getCell(totalSalarioCol + 1).numFmt = '"Q"#,##0.00';
        totalRow.getCell(totalSalarioCol + 1).font = { bold: true };
        
        totalRow.getCell(totalBonificacionCol + 1).value = totalBonificaciones;
        totalRow.getCell(totalBonificacionCol + 1).numFmt = '"Q"#,##0.00';
        totalRow.getCell(totalBonificacionCol + 1).font = { bold: true };
        
        // Generar y descargar archivo
        const buffer = await workbook.xlsx.writeBuffer();
        
        const fechaActual = new Date().toISOString().split('T')[0];
        const nombrePlanilla = planillaNombre.replace(/[^a-zA-Z0-9]/g, '_');
        const nombreArchivo = `Reporte_Planilla_${nombrePlanilla}_${fechaActual}.xlsx`;
        
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
        
        loadingSwal.close();
        
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
// Editar Cuenta Bancaria
async function editarCuentaBancaria(idPersonal) {
    const empleado = empleadosData.find(emp => emp.IdPersonal === idPersonal);
    
    if (!empleado) {
        console.error('Empleado no encontrado');
        return;
    }
    
    empleadoEditando = empleado;
    
    // Llenar información del empleado
    document.getElementById('editEmployeeName').textContent = empleado.NombreCompleto;
    document.getElementById('editEmployeeDepartment').textContent = empleado.NombreDepartamento;
    document.getElementById('editEmployeePosition').textContent = empleado.NombrePuesto;
    
    // Llenar campos actuales
    document.getElementById('cuentaDivision1').value = empleado.CuentaDivision1 || '';
    document.getElementById('cuentaDivision2').value = empleado.CuentaDivision2 || '';
    document.getElementById('cuentaDivision3').value = empleado.CuentaDivision3 || '';
    
    // Mostrar modal
    const modal = document.getElementById('editBankModal');
    if (modal) {
        modal.style.display = 'block';
    }
}
// Función para cerrar modal de edición (AGREGAR)
function cerrarModalEdicion() {
    const modal = document.getElementById('editBankModal');
    if (modal) {
        modal.style.display = 'none';
    }
    empleadoEditando = null;
}

// Función para guardar cambios de cuenta bancaria (AGREGAR)
async function guardarCambiosCuentaBancaria(event) {
    event.preventDefault();
    
    if (!empleadoEditando) {
        console.error('No hay empleado seleccionado para editar');
        return;
    }
    
    const cuentaDivision1 = document.getElementById('cuentaDivision1').value.trim();
    const cuentaDivision2 = document.getElementById('cuentaDivision2').value.trim();
    const cuentaDivision3 = document.getElementById('cuentaDivision3').value.trim();
    
    // Validar que al menos un campo tenga contenido
    if (!cuentaDivision1 && !cuentaDivision2 && !cuentaDivision3) {
        await Swal.fire({
            icon: 'warning',
            title: 'Campos vacíos',
            text: 'Debe llenar al menos una división de cuenta bancaria'
        });
        return;
    }
    
    // Mostrar confirmación
    const confirmResult = await Swal.fire({
        title: '¿Confirmar cambios?',
        html: `
            <div style="text-align: left; margin: 1rem 0;">
                <p><strong>Empleado:</strong> ${empleadoEditando.NombreCompleto}</p>
                <hr style="margin: 0.5rem 0;">
                <p><strong>División 1:</strong> ${cuentaDivision1 || 'Sin asignar'}</p>
                <p><strong>División 2:</strong> ${cuentaDivision2 || 'Sin asignar'}</p>
                <p><strong>División 3:</strong> ${cuentaDivision3 || 'Sin asignar'}</p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#FF9800',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, actualizar',
        cancelButtonText: 'Cancelar'
    });
    
    if (!confirmResult.isConfirmed) {
        return;
    }
    
    try {
        // Obtener datos del usuario actual
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        const connection = await connectionString();
        
        // Obtener valores anteriores para el historial
        const valoresAnteriores = {
            CuentaDivision1: empleadoEditando.CuentaDivision1 || '',
            CuentaDivision2: empleadoEditando.CuentaDivision2 || '',
            CuentaDivision3: empleadoEditando.CuentaDivision3 || ''
        };
        
        // Actualizar personal
        await connection.query(`
            UPDATE personal 
            SET CuentaDivision1 = ?, CuentaDivision2 = ?, CuentaDivision3 = ? 
            WHERE IdPersonal = ?
        `, [
            cuentaDivision1 || null, 
            cuentaDivision2 || null, 
            cuentaDivision3 || null, 
            empleadoEditando.IdPersonal
        ]);
        
        // Registrar cambios en el historial para cada división que cambió
        const cambios = [
            {
                division: 1,
                valorAnterior: valoresAnteriores.CuentaDivision1,
                valorNuevo: cuentaDivision1
            },
            {
                division: 2,
                valorAnterior: valoresAnteriores.CuentaDivision2,
                valorNuevo: cuentaDivision2
            },
            {
                division: 3,
                valorAnterior: valoresAnteriores.CuentaDivision3,
                valorNuevo: cuentaDivision3
            }
        ];
        
        for (const cambio of cambios) {
            if (cambio.valorAnterior !== cambio.valorNuevo) {
                await connection.query(`
                    INSERT INTO CambiosPersonal 
                    (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    empleadoEditando.IdPersonal,
                    empleadoEditando.NombreCompleto,
                    4, // TipoCambio = 4 para cuenta bancaria
                    `Cuenta Bancaria División ${cambio.division}`,
                    cambio.valorAnterior || 'Sin asignar',
                    cambio.valorNuevo || 'Sin asignar',
                    userData.IdPersonal || null,
                    userData.NombreCompleto || 'Usuario desconocido'
                ]);
            }
        }
        
        await connection.close();
        
        // Actualizar datos locales
        const empleadoIndex = empleadosData.findIndex(emp => emp.IdPersonal === empleadoEditando.IdPersonal);
        if (empleadoIndex !== -1) {
            empleadosData[empleadoIndex].CuentaDivision1 = cuentaDivision1;
            empleadosData[empleadoIndex].CuentaDivision2 = cuentaDivision2;
            empleadosData[empleadoIndex].CuentaDivision3 = cuentaDivision3;
            empleadosData[empleadoIndex].CuentaBancaria = [cuentaDivision1, cuentaDivision2, cuentaDivision3]
                .filter(cuenta => cuenta)
                .join(' ');
        }
        
        // Actualizar datos filtrados
        const empleadoFiltradoIndex = empleadosFiltrados.findIndex(emp => emp.IdPersonal === empleadoEditando.IdPersonal);
        if (empleadoFiltradoIndex !== -1) {
            empleadosFiltrados[empleadoFiltradoIndex] = { ...empleadosData[empleadoIndex] };
        }
        
        // Cerrar modal
        cerrarModalEdicion();
        
        // Regenerar tabla
        renderizarTabla();
        
        // Mostrar éxito
        await Swal.fire({
            icon: 'success',
            title: '¡Actualización exitosa!',
            text: 'La cuenta bancaria ha sido actualizada correctamente',
            timer: 2000,
            timerProgressBar: true
        });
        
    } catch (error) {
        console.error('Error al actualizar cuenta bancaria:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar la cuenta bancaria'
        });
    }
}

// Event listeners para el modal de edición (AGREGAR al final de inicializarEventListeners)
function inicializarEventListenersEdicion() {
    // Modal de edición - cerrar
    const editBankModalClose = document.getElementById('editBankModalClose');
    if (editBankModalClose) {
        editBankModalClose.addEventListener('click', cerrarModalEdicion);
    }
    
    const cancelBankEdit = document.getElementById('cancelBankEdit');
    if (cancelBankEdit) {
        cancelBankEdit.addEventListener('click', cerrarModalEdicion);
    }
    
    const editBankModal = document.getElementById('editBankModal');
    if (editBankModal) {
        editBankModal.addEventListener('click', (e) => {
            if (e.target.id === 'editBankModal') {
                cerrarModalEdicion();
            }
        });
    }
    
    // Formulario de edición
    const bankAccountForm = document.getElementById('bankAccountForm');
    if (bankAccountForm) {
        bankAccountForm.addEventListener('submit', guardarCambiosCuentaBancaria);
    }
}
function aplicarFiltroSinCuenta() {
    if (!empleadosData || empleadosData.length === 0) {
        return; // No hay datos cargados aún
    }
    
    const filtroSinCuenta = document.getElementById('filtroSinCuenta');
    const searchInput = document.getElementById('searchInput');
    
    // Resetear búsqueda si hay texto
    if (searchInput && searchInput.value.trim() !== '') {
        searchInput.value = '';
    }
    
    if (filtroSinCuenta && filtroSinCuenta.checked) {
        // Filtrar solo empleados sin cuenta bancaria
        empleadosFiltrados = empleadosData.filter(emp => {
            const sinCuenta1 = !emp.CuentaDivision1 || emp.CuentaDivision1.trim() === '';
            const sinCuenta2 = !emp.CuentaDivision2 || emp.CuentaDivision2.trim() === '';
            const sinCuenta3 = !emp.CuentaDivision3 || emp.CuentaDivision3.trim() === '';
            
            // Empleado sin cuenta si NO tiene ninguna de las 3 divisiones
            return sinCuenta1 && sinCuenta2 && sinCuenta3;
        });
    } else {
        // Mostrar todos los empleados
        empleadosFiltrados = [...empleadosData];
    }
    
    currentPage = 1;
    renderizarTabla();
    actualizarContadorEmpleados();
}
function actualizarContadorEmpleados() {
    const planillaInfoCompact = document.getElementById('planillaInfoCompact');
    if (!planillaInfoCompact) return;
    
    const filtroSinCuenta = document.getElementById('filtroSinCuenta');
    const planillaSelect = document.getElementById('planillaSelect');
    const planillaNombre = planillaSelect?.selectedOptions[0]?.textContent || 'Planilla';
    
    let textoContador = `${planillaNombre} - `;
    
    if (filtroSinCuenta && filtroSinCuenta.checked) {
        textoContador += `${empleadosFiltrados.length} empleados SIN cuenta bancaria (de ${empleadosData.length} total)`;
    } else {
        textoContador += `${empleadosData.length} empleados`;
    }
    
    planillaInfoCompact.innerHTML = `
        <i class="fas fa-clipboard-list"></i> ${textoContador}
    `;
}
// Exportar funciones globales para uso en HTML
window.cambiarPagina = cambiarPagina;
window.verDetallesEmpleado = verDetallesEmpleado;
window.editarCuentaBancaria = editarCuentaBancaria;