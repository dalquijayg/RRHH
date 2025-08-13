const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');

// ===== VARIABLES GLOBALES =====
let currentUser = null;
let allPlanillas = [];
let filteredPlanillas = [];
let userDepartments = [];
let currentView = 'list'; // 'list' o 'card'
let selectedPlanilla = null;

// ===== INICIALIZACIÓN PRINCIPAL =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Iniciando aplicación de autorización...');
    
    try {
        // Mostrar estado de carga
        showLoadingState(true);
        
        // Inicializar componentes
        mostrarFechaActual();
        await verificarUsuarioAutenticado();
        await cargarInformacionUsuario();
        await cargarDepartamentosDelUsuario();
        cargarAniosEnFiltros();
        inicializarEventListeners();
        
        // Cargar planillas pendientes
        await cargarPlanillasPendientes();
        
        console.log('Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        mostrarErrorGeneral('Error al cargar la aplicación', error.message);
    } finally {
        showLoadingState(false);
    }
});

// ===== VERIFICACIÓN Y CARGA DE USUARIO =====
async function verificarUsuarioAutenticado() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        
        if (!userData || !userData.IdPersonal) {
            await Swal.fire({
                icon: 'error',
                title: 'Sesión expirada',
                text: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.',
                confirmButtonColor: '#1e40af',
                allowOutsideClick: false
            });
            
            // Redirigir al login
            window.location.href = '../Login.html';
            return;
        }
        
        currentUser = userData;
        console.log('Usuario autenticado:', currentUser.NombreCompleto);
        
    } catch (error) {
        console.error('Error al verificar usuario:', error);
        
        await Swal.fire({
            icon: 'error',
            title: 'Error de autenticación',
            text: 'No se pudo verificar la información del usuario.',
            confirmButtonColor: '#1e40af'
        });
        
        window.location.href = '../Login.html';
    }
}

async function cargarInformacionUsuario() {
    try {
        if (!currentUser) return;
        
        // Mostrar información del usuario en el header
        mostrarInformacionUsuarioEnHeader();
        
        console.log('Información del usuario cargada en el header');
        
    } catch (error) {
        console.error('Error al cargar información del usuario:', error);
        throw error;
    }
}

function mostrarInformacionUsuarioEnHeader() {
    const headerCenter = document.querySelector('.header-center');
    
    if (!headerCenter || !currentUser) return;
    
    headerCenter.innerHTML = `
        <div class="user-info-container">
            <div class="user-main-info">
                <div class="user-name">${currentUser.NombreCompleto}</div>
            </div>
        </div>
    `;
}

// ===== CARGA DE DEPARTAMENTOS DEL USUARIO =====
async function cargarDepartamentosDelUsuario() {
    try {
        if (!currentUser || !currentUser.IdPersonal) {
            throw new Error('Usuario no válido para cargar departamentos');
        }
        
        const connection = await connectionString();
        
        // Obtener departamentos donde el usuario es encargado regional
        const result = await connection.query(`
            SELECT
                d.IdDepartamento,
                d.NombreDepartamento,
                d.IdRegion,
                r.NombreRegion
            FROM
                departamentos d
                INNER JOIN Regiones r ON d.IdRegion = r.IdRegion
            WHERE
                d.IdEncargadoRegional = ?
            ORDER BY d.NombreDepartamento
        `, [currentUser.IdPersonal]);
        
        await connection.close();
        
        if (result.length === 0) {
            throw new Error('No se encontraron departamentos asignados al usuario');
        }
        
        userDepartments = result;
        
        // Actualizar información en el header
        actualizarDepartamentosEnHeader();
        
        // Llenar filtro de departamentos
        llenarFiltroDepartamentos();
        
        console.log(`Departamentos cargados: ${userDepartments.length}`, userDepartments);
        
    } catch (error) {
        console.error('Error al cargar departamentos del usuario:', error);
        
        await Swal.fire({
            icon: 'error',
            title: 'Sin permisos de autorización',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin-bottom: 10px; color: #991b1b;">
                            <strong>❌ Sin departamentos asignados:</strong> Su usuario no tiene departamentos asignados como encargado regional.
                        </p>
                        <p style="margin: 0; color: #991b1b; font-size: 0.9rem;">
                            <strong>Contacte al administrador</strong> para solicitar los permisos necesarios.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ef4444',
            allowOutsideClick: false
        });
        
        // Redirigir a página principal o dashboard
        window.location.href = '../Dashboard.html';
    }
}

function actualizarDepartamentosEnHeader() {
    const userDepartmentsElement = document.getElementById('userDepartments');
    
    if (!userDepartmentsElement || userDepartments.length === 0) return;
    
    const departmentNames = userDepartments.map(d => d.NombreDepartamento);
    const displayText = departmentNames.length > 3 
        ? `${departmentNames.slice(0, 3).join(', ')} y ${departmentNames.length - 3} más`
        : departmentNames.join(', ');
}

function llenarFiltroDepartamentos() {
    const filterDepartment = document.getElementById('filterDepartment');
    
    if (!filterDepartment) return;
    
    // Limpiar opciones existentes (excepto "Todos")
    const defaultOption = filterDepartment.querySelector('option[value=""]');
    filterDepartment.innerHTML = '';
    filterDepartment.appendChild(defaultOption);
    
    // Agregar departamentos del usuario
    userDepartments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.IdDepartamento;
        option.textContent = dept.NombreDepartamento;
        filterDepartment.appendChild(option);
    });
}

// ===== CARGA DE PLANILLAS PENDIENTES =====
async function cargarPlanillasPendientes() {
    try {
        showLoadingState(true);
        
        if (userDepartments.length === 0) {
            throw new Error('No hay departamentos para cargar planillas');
        }
        
        const connection = await connectionString();
        
        // Obtener IDs de departamentos del usuario
        const departmentIds = userDepartments.map(d => d.IdDepartamento);
        const placeholders = departmentIds.map(() => '?').join(',');
        
        // ✅ CONSULTA ACTUALIZADA - Sin TipoPago, Mes, Anyo, IdTipoPago
        const result = await connection.query(`
            SELECT
                p.IdPlanillaParcial,
                p.IdDepartamentoSucursal,
                p.MontoPlanillaParcial,
                p.CantidadColaboradores,
                p.PeriodoPago,
                p.IdUsuario,
                p.NombreUsuario,
                p.FechaRegistro,
                p.Estado,
                d.NombreDepartamento,
                r.NombreRegion,
                e.NombreEstado
            FROM
                PagoPlanillaParcial p
                INNER JOIN departamentos d ON p.IdDepartamentoSucursal = d.IdDepartamento
                INNER JOIN Regiones r ON d.IdRegion = r.IdRegion
                INNER JOIN PagoPlanillaParcialEstados e ON p.Estado = e.IdEstadoPagoPlanillaParcial
            WHERE
                p.IdDepartamentoSucursal IN (${placeholders})
                AND p.Estado = 0
            ORDER BY p.FechaRegistro DESC
        `, departmentIds);
        
        await connection.close();
        
        allPlanillas = result.map(planilla => ({
            ...planilla,
            FechaRegistroFormatted: corregirFechaSimple(planilla.FechaRegistro).toLocaleDateString('es-GT'),
            FechaRegistroISO: planilla.FechaRegistro,
            MontoFormatted: `Q ${parseFloat(planilla.MontoPlanillaParcial).toFixed(2)}`,
            PeriodoData: parsearPeriodoDesdeBD(planilla.PeriodoPago),
            PeriodoFormatted: formatearPeriodoDesdeString(planilla.PeriodoPago),
            TipoFormatted: 'Por Período'
        }));
        
        filteredPlanillas = [...allPlanillas];
        
        // Actualizar interfaz
        actualizarContadorPendientes();
        actualizarVistaPlanillas();
        
        console.log(`Planillas pendientes cargadas: ${allPlanillas.length}`);
        
    } catch (error) {
        console.error('Error al cargar planillas pendientes:', error);
        mostrarErrorGeneral('Error al cargar planillas', error.message);
    } finally {
        showLoadingState(false);
    }
}
function formatearPeriodoDesdeString(periodoString) {
    try {
        const periodo = parsearPeriodoDesdeBD(periodoString);
        const fechaInicio = new Date(periodo.inicio + 'T00:00:00');
        const fechaFin = new Date(periodo.fin + 'T00:00:00');
        
        const formatoFecha = { day: '2-digit', month: '2-digit', year: 'numeric' };
        const inicioTexto = fechaInicio.toLocaleDateString('es-GT', formatoFecha);
        const finTexto = fechaFin.toLocaleDateString('es-GT', formatoFecha);
        
        return `${inicioTexto} a ${finTexto}`;
    } catch (error) {
        console.error('Error al formatear período:', error);
        return periodoString; // Devolver original si hay error
    }
}
function parsearPeriodoDesdeBD(periodoBD) {
    // Parsear: "2025-01-15 a 2025-01-31" -> {inicio: "2025-01-15", fin: "2025-01-31"}
    const partes = periodoBD.split(' a ');
    return {
        inicio: partes[0].trim(),
        fin: partes[1].trim()
    };
}
// ===== UTILIDADES Y HELPERS =====
function mostrarFechaActual() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    const currentDateElement = document.getElementById('currentDate');
    if (currentDateElement) {
        currentDateElement.textContent = now.toLocaleDateString('es-GT', options);
    }
}

function cargarAniosEnFiltros() {
    const filterYear = document.getElementById('filterYear');
    if (!filterYear) return;
    
    const currentYear = new Date().getFullYear();
    const defaultOption = filterYear.querySelector('option[value=""]');
    
    // Limpiar y mantener opción por defecto
    filterYear.innerHTML = '';
    filterYear.appendChild(defaultOption);
    
    // Agregar años (anterior, actual y siguiente)
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        filterYear.appendChild(option);
    }
}

function actualizarContadorPendientes() {
    const pendingCount = document.getElementById('pendingCount');
    const pendingStats = document.getElementById('pendingStats');
    const totalPlanillas = document.getElementById('totalPlanillas');
    
    if (pendingCount) {
        pendingCount.textContent = filteredPlanillas.length;
    }
    
    if (totalPlanillas) {
        totalPlanillas.textContent = filteredPlanillas.length;
    }
    
    if (pendingStats) {
        pendingStats.style.display = filteredPlanillas.length > 0 ? 'flex' : 'none';
    }
}

// ===== GESTIÓN DE ESTADOS DE VISTA =====
function showLoadingState(show) {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const listViewContent = document.getElementById('listView-content');
    const cardViewContent = document.getElementById('cardView-content');
    
    if (show) {
        if (loadingState) loadingState.style.display = 'flex';
        if (emptyState) emptyState.style.display = 'none';
        if (listViewContent) listViewContent.style.display = 'none';
        if (cardViewContent) cardViewContent.style.display = 'none';
    } else {
        if (loadingState) loadingState.style.display = 'none';
        
        // Mostrar vista apropiada
        if (filteredPlanillas.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            if (listViewContent) listViewContent.style.display = 'none';
            if (cardViewContent) cardViewContent.style.display = 'none';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            actualizarVistaPlanillas();
        }
    }
}

function actualizarVistaPlanillas() {
    const listViewContent = document.getElementById('listView-content');
    const cardViewContent = document.getElementById('cardView-content');
    
    if (currentView === 'list') {
        if (listViewContent) listViewContent.style.display = 'block';
        if (cardViewContent) cardViewContent.style.display = 'none';
        actualizarVistaLista();
    } else {
        if (listViewContent) listViewContent.style.display = 'none';
        if (cardViewContent) cardViewContent.style.display = 'block';
        actualizarVistaTarjetas();
    }
    
    actualizarContadorPendientes();
}

// ===== VISTA DE LISTA (TABLA) =====
function actualizarVistaLista() {
    const tableBody = document.getElementById('planillasTableBody');
    
    if (!tableBody) return;
    
    if (filteredPlanillas.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: var(--spacing-2xl); color: var(--gray-500);">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: var(--spacing-md); display: block;"></i>
                    No hay planillas que coincidan con los filtros seleccionados
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = filteredPlanillas.map(planilla => `
        <tr data-planilla-id="${planilla.IdPlanillaParcial}">
            <td>
                <div class="department-cell">${planilla.NombreDepartamento}</div>
                <div style="font-size: 0.75rem; color: var(--warm-gray); margin-top: 2px;">
                    ${planilla.NombreRegion}
                </div>
            </td>
            <td style="text-align: center;">
                <span class="type-badge">${planilla.TipoFormatted}</span>
            </td>
            <td style="text-align: center;">
                <div class="period-cell">${planilla.PeriodoFormatted}</div>
            </td>
            <td style="text-align: center;">
                <span class="collaborators-count">${planilla.CantidadColaboradores}</span>
            </td>
            <td style="text-align: right;">
                <span class="amount-cell">${planilla.MontoFormatted}</span>
            </td>
            <td style="text-align: center;">
                <div class="date-cell">${planilla.FechaRegistroFormatted}</div>
            </td>
            <td style="text-align: center;">
                <div class="user-cell">${planilla.NombreUsuario}</div>
            </td>
            <td style="text-align: center;">
                <div class="table-actions">
                    <button type="button" class="btn-table-action btn-view" 
                            onclick="verDetallePlanilla(${planilla.IdPlanillaParcial})" 
                            title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" class="btn-table-action btn-authorize" 
                            onclick="autorizarPlanillaDirecta(${planilla.IdPlanillaParcial})" 
                            title="Autorizar">
                        <i class="fas fa-check"></i>
                    </button>
                    <button type="button" class="btn-table-action btn-reject" 
                            onclick="rechazarPlanillaDirecta(${planilla.IdPlanillaParcial})" 
                            title="Rechazar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ===== VISTA DE TARJETAS =====
function actualizarVistaTarjetas() {
    const cardsContainer = document.getElementById('planillasCardsContainer');
    
    if (!cardsContainer) return;
    
    if (filteredPlanillas.length === 0) {
        cardsContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-2xl); color: var(--gray-500);">
                <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: var(--spacing-lg); display: block;"></i>
                <h4 style="margin-bottom: var(--spacing-md);">No hay planillas</h4>
                <p>No hay planillas que coincidan con los filtros seleccionados</p>
            </div>
        `;
        return;
    }
    
    cardsContainer.innerHTML = filteredPlanillas.map(planilla => `
        <div class="planilla-card" data-planilla-id="${planilla.IdPlanillaParcial}" onclick="verDetallePlanilla(${planilla.IdPlanillaParcial})">
            <div class="card-header">
                <div class="card-title">${planilla.NombreDepartamento}</div>
                <div class="card-type">${planilla.TipoFormatted} • ${planilla.PeriodoFormatted}</div>
            </div>
            <div class="card-body">
                <div class="card-info">
                    <div class="info-item">
                        <div class="info-label">Colaboradores</div>
                        <div class="info-value">${planilla.CantidadColaboradores}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Monto Total</div>
                        <div class="info-value amount">${planilla.MontoFormatted}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Creada por</div>
                        <div class="info-value">${planilla.NombreUsuario}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Fecha</div>
                        <div class="info-value">${planilla.FechaRegistroFormatted}</div>
                    </div>
                </div>
                <div class="card-actions">
                    <button type="button" class="btn btn-secondary full-width" 
                            onclick="event.stopPropagation(); verDetallePlanilla(${planilla.IdPlanillaParcial})">
                        <i class="fas fa-eye"></i>
                        Ver Detalle
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// ===== FILTRADO DE PLANILLAS =====
function aplicarFiltros() {
    const filterDepartment = document.getElementById('filterDepartment')?.value || '';
    
    filteredPlanillas = allPlanillas.filter(planilla => {
        // Filtro solo por departamento
        if (filterDepartment && planilla.IdDepartamentoSucursal.toString() !== filterDepartment) {
            return false;
        }
        
        return true;
    });
    
    // Actualizar vista
    actualizarVistaPlanillas();
}

function limpiarFiltros() {
    // Limpiar solo el filtro de departamento
    const filterDepartment = document.getElementById('filterDepartment');
    if (filterDepartment) filterDepartment.value = '';
    
    // Restaurar todas las planillas
    filteredPlanillas = [...allPlanillas];
    
    // Actualizar vista
    actualizarVistaPlanillas();
    
    console.log('Filtro limpiado');
}

// ===== MANEJO DE ERRORES =====
function mostrarErrorGeneral(titulo, mensaje) {
    Swal.fire({
        icon: 'error',
        title: titulo,
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                    <p style="margin-bottom: 10px; color: #991b1b;">
                        <strong>❌ Error:</strong> ${mensaje}
                    </p>
                </div>
                
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e;">
                        <strong>💡 Sugerencia:</strong> Intente actualizar la página o contacte al administrador si el problema persiste.
                    </p>
                </div>
            </div>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#ef4444',
        width: '500px'
    });
}

// ===== EVENT LISTENERS PRINCIPALES =====
function inicializarEventListeners() {
    // Solo filtro de departamento
    const filterDepartment = document.getElementById('filterDepartment');
    if (filterDepartment) {
        filterDepartment.addEventListener('change', aplicarFiltros);
    }
    // Botones de acción rápida
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await cargarPlanillasPendientes();
        });
    }
    
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', limpiarFiltros);
    }
    
    const refreshEmptyBtn = document.getElementById('refreshEmpty');
    if (refreshEmptyBtn) {
        refreshEmptyBtn.addEventListener('click', async () => {
            await cargarPlanillasPendientes();
        });
    }
    
    // Toggle de vista
    const listViewBtn = document.getElementById('listView');
    const cardViewBtn = document.getElementById('cardView');
    
    if (listViewBtn) {
        listViewBtn.addEventListener('click', () => {
            currentView = 'list';
            listViewBtn.classList.add('active');
            if (cardViewBtn) cardViewBtn.classList.remove('active');
            actualizarVistaPlanillas();
        });
    }
    
    if (cardViewBtn) {
        cardViewBtn.addEventListener('click', () => {
            currentView = 'card';
            cardViewBtn.classList.add('active');
            if (listViewBtn) listViewBtn.classList.remove('active');
            actualizarVistaPlanillas();
        });
    }
    
    console.log('Event listeners inicializados correctamente');
}
// ===== MODAL DE DETALLE DE PLANILLA =====
async function verDetallePlanilla(idPlanilla) {
    try {
        // Buscar la planilla en los datos cargados
        const planilla = allPlanillas.find(p => p.IdPlanillaParcial === idPlanilla);
        
        if (!planilla) {
            throw new Error('Planilla no encontrada');
        }
        
        selectedPlanilla = planilla;
        
        // Mostrar modal y estado de carga
        mostrarModalDetalle();
        mostrarCargandoEnModal(true);
        
        // Cargar detalle completo de la planilla
        await cargarDetallePlanilla(idPlanilla);
        
    } catch (error) {
        console.error('Error al ver detalle de planilla:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al cargar detalle',
            text: error.message || 'No se pudo cargar el detalle de la planilla',
            confirmButtonColor: '#ef4444'
        });
    }
}

function mostrarModalDetalle() {
    const modal = document.getElementById('planillaDetailModal');
    if (!modal || !selectedPlanilla) return;
    
    // Actualizar información básica del header
    const modalPlanillaBadge = document.getElementById('modalPlanillaBadge');
    const modalPlanillaPeriod = document.getElementById('modalPlanillaPeriod');
    
    if (modalPlanillaBadge) {
        modalPlanillaBadge.textContent = selectedPlanilla.TipoFormatted;
        modalPlanillaBadge.className = 'planilla-type-badge';
    }
    
    if (modalPlanillaPeriod) {
        modalPlanillaPeriod.textContent = selectedPlanilla.PeriodoFormatted;
    }
    
    // Mostrar modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function mostrarCargandoEnModal(mostrar) {
    const modalBody = document.querySelector('#planillaDetailModal .modal-body');
    
    if (!modalBody) return;
    
    if (mostrar) {
        modalBody.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--spacing-2xl); min-height: 300px;">
                <div class="loading-spinner" style="margin-bottom: var(--spacing-lg);"></div>
                <p style="color: var(--trust-blue); font-weight: 600;">Cargando detalle de la planilla...</p>
            </div>
        `;
    }
}

async function cargarDetallePlanilla(idPlanilla) {
    try {
        const connection = await connectionString();
        
        // Obtener el detalle de los colaboradores
        const detalleResult = await connection.query(`
            SELECT
                d.IdPersonal,
                d.NombrePersonal,
                d.FechaLaborada,
                d.IdTipoTurno,
                d.TipoTurno,
                d.MontoPagado
            FROM
                PagoPlanillaParcialDetalle d
            WHERE
                d.IdPlanillaParcial = ?
            ORDER BY d.NombrePersonal, d.FechaLaborada
        `, [idPlanilla]);
        
        await connection.close();
        
        // Procesar datos para el resumen
        const colaboradoresData = procesarDatosColaboradores(detalleResult);
        const resumenTurnos = calcularResumenTurnos(detalleResult);
        
        // Actualizar el modal con la información
        actualizarModalConDetalle(colaboradoresData, resumenTurnos);
        
    } catch (error) {
        console.error('Error al cargar detalle de planilla:', error);
        
        const modalBody = document.querySelector('#planillaDetailModal .modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="text-align: center; padding: var(--spacing-2xl); color: var(--danger-red);">
                    <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: var(--spacing-lg);"></i>
                    <h4>Error al cargar el detalle</h4>
                    <p>No se pudo cargar la información detallada de la planilla.</p>
                </div>
            `;
        }
        
        throw error;
    }
}

function procesarDatosColaboradores(detalleData) {
    const colaboradoresMap = new Map();
    
    detalleData.forEach(registro => {
        const { IdPersonal, NombrePersonal } = registro;
        
        if (!colaboradoresMap.has(IdPersonal)) {
            colaboradoresMap.set(IdPersonal, {
                IdPersonal,
                NombrePersonal,
                turnos: [],
                turnosMañana: 0,
                turnosMixtos: 0,
                turnos4Horas: 0,
                totalTurnos: 0,
                montoTotal: 0,
                fechasTrabajadas: []
            });
        }
        
        const colaborador = colaboradoresMap.get(IdPersonal);
        
        // Agregar turno
        colaborador.turnos.push(registro);
        colaborador.totalTurnos++;
        colaborador.montoTotal += parseFloat(registro.MontoPagado);
        colaborador.fechasTrabajadas.push({
            fecha: registro.FechaLaborada,
            tipoTurno: registro.IdTipoTurno,
            tipoNombre: registro.TipoTurno,
            monto: parseFloat(registro.MontoPagado),
            fechaCorregida: corregirFechaSimple(registro.FechaLaborada)
        });
        
        // Contar por tipo de turno
        switch (registro.IdTipoTurno) {
            case 1:
                colaborador.turnosMañana++;
                break;
            case 2:
                colaborador.turnosMixtos++;
                break;
            case 3:
                colaborador.turnos4Horas++;
                break;
        }
    });
    
    return Array.from(colaboradoresMap.values());
}

function calcularResumenTurnos(detalleData) {
    const resumen = {
        totalColaboradores: new Set(detalleData.map(d => d.IdPersonal)).size,
        totalTurnos: detalleData.length,
        turnosMañana: detalleData.filter(d => d.IdTipoTurno === 1).length,
        turnosMixtos: detalleData.filter(d => d.IdTipoTurno === 2).length,
        turnos4Horas: detalleData.filter(d => d.IdTipoTurno === 3).length,
        montoTotal: detalleData.reduce((sum, d) => sum + parseFloat(d.MontoPagado), 0)
    };
    
    return resumen;
}

function actualizarModalConDetalle(colaboradoresData, resumenTurnos) {
    if (!selectedPlanilla) return;
    
    const modalBody = document.querySelector('#planillaDetailModal .modal-body');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
        <!-- Información general de la planilla -->
        <div class="planilla-summary">
            <div class="summary-card">
                <div class="summary-icon">
                    <i class="fas fa-building"></i>
                </div>
                <div class="summary-content">
                    <div class="summary-label">Departamento</div>
                    <div class="summary-value">${selectedPlanilla.NombreDepartamento}</div>
                </div>
            </div>
            
            <div class="summary-card">
                <div class="summary-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="summary-content">
                    <div class="summary-label">Colaboradores</div>
                    <div class="summary-value">${resumenTurnos.totalColaboradores}</div>
                </div>
            </div>
            
            <div class="summary-card">
                <div class="summary-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="summary-content">
                    <div class="summary-label">Total Turnos</div>
                    <div class="summary-value">${resumenTurnos.totalTurnos}</div>
                </div>
            </div>
            
            <div class="summary-card total-card">
                <div class="summary-icon">
                    <i class="fas fa-dollar-sign"></i>
                </div>
                <div class="summary-content">
                    <div class="summary-label">Monto Total</div>
                    <div class="summary-value">Q ${resumenTurnos.montoTotal.toFixed(2)}</div>
                </div>
            </div>
        </div>

        <!-- Tabla de colaboradores detallada -->
        <div class="collaborators-detail">
            <h4><i class="fas fa-users-cog"></i> Detalle de Colaboradores</h4>
            <div class="collaborators-table-container">
                <table class="collaborators-table">
                    <thead>
                        <tr>
                            <th>Colaborador</th>
                            <th style="text-align: center;">T. Mañana</th>
                            <th style="text-align: center;">T. Mixtos</th>
                            <th style="text-align: center;">T. 4 Horas</th>
                            <th style="text-align: center;">Total</th>
                            <th style="text-align: right;">Monto</th>
                            <th style="text-align: center;">Fechas Trabajadas</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generarFilasColaboradores(colaboradoresData)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Actualizar footer con información de creación
    actualizarFooterModal();
}

function generarFilasColaboradores(colaboradoresData) {
    return colaboradoresData.map(colaborador => `
        <tr>
            <td>
                <div class="collaborator-name-detail">${colaborador.NombrePersonal}</div>
            </td>
            <td style="text-align: center;">
                <span class="shift-count-detail morning">${colaborador.turnosMañana}</span>
            </td>
            <td style="text-align: center;">
                <span class="shift-count-detail mixed">${colaborador.turnosMixtos}</span>
            </td>
            <td style="text-align: center;">
                <span class="shift-count-detail hours">${colaborador.turnos4Horas}</span>
            </td>
            <td style="text-align: center;">
                <span class="shift-count-detail total">${colaborador.totalTurnos}</span>
            </td>
            <td style="text-align: right;">
                <span class="amount-detail">Q ${colaborador.montoTotal.toFixed(2)}</span>
            </td>
            <td style="text-align: center;">
                <button type="button" class="dates-btn" 
                        onclick="verFechasTrabajadas('${colaborador.NombrePersonal}', ${JSON.stringify(colaborador.fechasTrabajadas).replace(/"/g, '&quot;')})"
                        title="Ver fechas trabajadas">
                    <i class="fas fa-calendar-alt"></i>
                    Ver Fechas
                </button>
            </td>
        </tr>
    `).join('');
}

function actualizarFooterModal() {
    if (!selectedPlanilla) return;
    
    const createdBy = document.getElementById('modalCreatedBy');
    const createdDate = document.getElementById('modalCreatedDate');
    
    if (createdBy) {
        createdBy.textContent = selectedPlanilla.NombreUsuario;
    }
    
    if (createdDate) {
        createdDate.textContent = selectedPlanilla.FechaRegistroFormatted;
    }
}

// ===== MODAL DE FECHAS TRABAJADAS =====
function verFechasTrabajadas(nombreColaborador, fechasData) {
    try {
        // Parsear datos si vienen como string
        const fechas = typeof fechasData === 'string' ? JSON.parse(fechasData) : fechasData;
        
        mostrarModalFechasTrabajadas(nombreColaborador, fechas);
        
    } catch (error) {
        console.error('Error al mostrar fechas trabajadas:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar las fechas trabajadas',
            confirmButtonColor: '#ef4444'
        });
    }
}

function mostrarModalFechasTrabajadas(nombreColaborador, fechasData) {
    const modal = document.getElementById('workDatesModal');
    const employeeName = document.getElementById('modalEmployeeName');
    const workDatesContent = document.getElementById('workDatesContent');
    
    if (!modal || !employeeName || !workDatesContent) return;
    
    // Actualizar nombre del colaborador
    employeeName.textContent = nombreColaborador;
    
    // Generar contenido de fechas
    workDatesContent.innerHTML = generarContenidoFechas(fechasData);
    
    // Mostrar modal
    modal.style.display = 'block';
}
function corregirFechaSimple(fecha) {
    // Si la fecha viene como "2025-07-10", agregar hora local
    if (typeof fecha === 'string' && fecha.includes('-')) {
        return new Date(fecha + 'T12:00:00'); // Agregar mediodía para evitar problemas de zona horaria
    }
    return new Date(fecha);
}
function generarContenidoFechas(fechasData) {
    if (!fechasData || fechasData.length === 0) {
        return `
            <div class="work-dates-empty">
                <i class="fas fa-calendar-times"></i>
                <h4>No hay fechas registradas</h4>
                <p>Este colaborador no tiene fechas de trabajo registradas en la planilla actual.</p>
            </div>
        `;
    }
    
    // Calcular estadísticas
    const totalDias = fechasData.length;
    const totalPagado = fechasData.reduce((sum, f) => sum + f.monto, 0);
    const tiposCount = {
        morning: fechasData.filter(f => f.tipoTurno === 1).length,
        mixed: fechasData.filter(f => f.tipoTurno === 2).length,
        hours: fechasData.filter(f => f.tipoTurno === 3).length
    };
    
    // Organizar fechas por mes
    const fechasPorMes = agruparFechasPorMes(fechasData);
    
    return `
        <!-- Resumen general -->
        <div class="work-dates-summary">
            <div class="work-summary-card">
                <div class="work-summary-value">${totalDias}</div>
                <div class="work-summary-label">Total Días</div>
            </div>
            <div class="work-summary-card">
                <div class="work-summary-value amount">Q ${totalPagado.toFixed(2)}</div>
                <div class="work-summary-label">Total Pagado</div>
            </div>
            <div class="work-summary-card">
                <div class="work-summary-value">${tiposCount.morning}</div>
                <div class="work-summary-label">Turnos Mañana</div>
            </div>
            <div class="work-summary-card">
                <div class="work-summary-value">${tiposCount.mixed + tiposCount.hours}</div>
                <div class="work-summary-label">Otros Turnos</div>
            </div>
        </div>
        
        <!-- Lista de fechas por mes -->
        <div class="work-dates-list">
            ${Object.entries(fechasPorMes).map(([mes, fechas]) => `
                <div class="month-section">
                    <div class="month-header">
                        <h5>
                            <i class="fas fa-calendar"></i>
                            ${mes}
                        </h5>
                        <div class="month-stats">
                            <div class="month-stat">
                                <span>${fechas.length} días</span>
                            </div>
                            <div class="month-stat">
                                <span>Q ${fechas.reduce((sum, f) => sum + f.monto, 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="dates-grid">
                        ${fechas.map(fecha => generarTarjetaFecha(fecha)).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function agruparFechasPorMes(fechasData) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const fechasPorMes = {};
    
    fechasData.forEach(fecha => {
        // Usar fecha corregida
        const fechaObj = corregirFechaSimple(fecha.fecha);
        const mesNombre = `${meses[fechaObj.getMonth()]} ${fechaObj.getFullYear()}`;
        
        if (!fechasPorMes[mesNombre]) {
            fechasPorMes[mesNombre] = [];
        }
        
        fechasPorMes[mesNombre].push({
            ...fecha,
            fechaObj,
            fechaFormateada: fechaObj.toLocaleDateString('es-GT', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            })
        });
    });
    
    // Ordenar fechas dentro de cada mes
    Object.keys(fechasPorMes).forEach(mes => {
        fechasPorMes[mes].sort((a, b) => a.fechaObj - b.fechaObj);
    });
    
    return fechasPorMes;
}

function generarTarjetaFecha(fecha) {
    const tipoClases = {
        1: { clase: 'morning', icono: '☀️', nombre: 'Mañana' },
        2: { clase: 'mixed', icono: '🌙', nombre: 'Mixto' },
        3: { clase: 'hours', icono: '🕐', nombre: '4 Horas' }
    };
    
    const tipoInfo = tipoClases[fecha.tipoTurno] || { clase: 'default', icono: '⏰', nombre: 'Turno' };
    
    // Usar fecha corregida
    const fechaObj = corregirFechaSimple(fecha.fecha);
    const nombreDia = fechaObj.toLocaleDateString('es-GT', { weekday: 'long' });
    const fechaCompleta = fechaObj.toLocaleDateString('es-GT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    
    return `
        <div class="date-work-card ${tipoInfo.clase}">
            <div class="date-card-header">
                <div class="date-info">
                    <div class="date-day-name">${nombreDia}</div>
                    <div class="date-full">${fechaCompleta}</div>
                </div>
                <div class="shift-type-badge ${tipoInfo.clase}">
                    <span class="shift-icon">${tipoInfo.icono}</span>
                    <span>${tipoInfo.nombre}</span>
                </div>
            </div>
            <div class="amount-section">
                <div class="amount-label">Monto Pagado</div>
                <div class="amount-value">Q ${fecha.monto.toFixed(2)}</div>
            </div>
        </div>
    `;
}

// ===== CERRAR MODALES =====
function cerrarModalDetalle() {
    const modal = document.getElementById('planillaDetailModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        selectedPlanilla = null;
    }
}

function cerrarModalFechas() {
    const modal = document.getElementById('workDatesModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===== EVENT LISTENERS PARA MODALES =====
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Mostrar estado de carga
        showLoadingState(true);
        mostrarFechaActual();
        await verificarUsuarioAutenticado();
        await cargarInformacionUsuario();
        await cargarDepartamentosDelUsuario();
        inicializarEventListeners();
        
        // Cargar planillas pendientes
        await cargarPlanillasPendientes();
        
        console.log('Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        mostrarErrorGeneral('Error al cargar la aplicación', error.message);
    } finally {
        showLoadingState(false);
    }
});

// ===== ACCIONES RÁPIDAS DESDE BOTONES =====
function autorizarPlanillaDirecta(idPlanilla) {
    const planilla = allPlanillas.find(p => p.IdPlanillaParcial === idPlanilla);
    
    if (!planilla) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Planilla no encontrada',
            confirmButtonColor: '#ef4444'
        });
        return;
    }
    
    // Mostrar confirmación rápida
    Swal.fire({
        title: '¿Autorizar planilla?',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <div style="background: var(--gray-50); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p><strong>📋 Planilla:</strong> ${planilla.TipoFormatted}</p>
                    <p><strong>🏢 Departamento:</strong> ${planilla.NombreDepartamento}</p>
                    <p><strong>📅 Período:</strong> ${planilla.PeriodoFormatted}</p>
                    <p><strong>💰 Monto:</strong> ${planilla.MontoFormatted}</p>
                </div>
                <div style="background: #e0f2fe; padding: 15px; border-radius: 8px; border-left: 4px solid #0891b2;">
                    <p style="margin: 0; color: #0891b2;">
                        <strong>ℹ️ La planilla será autorizada inmediatamente.</strong>
                    </p>
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '✅ Autorizar',
        cancelButtonText: '❌ Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280'
    }).then((result) => {
        if (result.isConfirmed) {
            ejecutarAutorizacion(idPlanilla);
        }
    });
}

function rechazarPlanillaDirecta(idPlanilla) {
    const planilla = allPlanillas.find(p => p.IdPlanillaParcial === idPlanilla);
    
    if (!planilla) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Planilla no encontrada',
            confirmButtonColor: '#ef4444'
        });
        return;
    }
    
    // Mostrar confirmación con campo de motivo
    Swal.fire({
        title: '¿Rechazar planilla?',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <div style="background: var(--gray-50); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p><strong>📋 Planilla:</strong> ${planilla.TipoFormatted}</p>
                    <p><strong>🏢 Departamento:</strong> ${planilla.NombreDepartamento}</p>
                    <p><strong>📅 Período:</strong> ${planilla.PeriodoFormatted}</p>
                    <p><strong>💰 Monto:</strong> ${planilla.MontoFormatted}</p>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 600; color: var(--trust-navy); margin-bottom: 8px;">Motivo del rechazo (opcional):</label>
                    <textarea id="quickRejectReason" style="width: 100%; min-height: 80px; padding: 10px; border: 2px solid var(--gray-200); border-radius: 8px; font-family: inherit;" placeholder="Describa el motivo del rechazo..."></textarea>
                </div>
                
                <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #991b1b;">
                        <strong>⚠️ La planilla será rechazada y deberá ser revisada nuevamente.</strong>
                    </p>
                </div>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '🚫 Rechazar',
        cancelButtonText: '❌ Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        preConfirm: () => {
            const motivo = document.getElementById('quickRejectReason')?.value || '';
            return { motivo };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            ejecutarRechazo(idPlanilla, result.value.motivo);
        }
    });
}
// ===== EJECUCIÓN DE AUTORIZACIÓN =====
async function ejecutarAutorizacion(idPlanilla, motivo = '') {
    try {
        // Mostrar loading
        const loadingSwal = Swal.fire({
            title: 'Autorizando planilla...',
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                    <div class="loading-spinner" style="border: 4px solid #f3f4f6; border-top: 4px solid #10b981; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
                    <p style="color: #10b981; margin: 0;">Actualizando estado de la planilla...</p>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false
        });

        const planilla = allPlanillas.find(p => p.IdPlanillaParcial === idPlanilla);
        if (!planilla) {
            throw new Error('Planilla no encontrada');
        }

        // Actualizar en base de datos
        await actualizarEstadoPlanilla(idPlanilla, 1, motivo, 'Autorizada'); // Estado 1 = Autorizado

        // Remover planilla de la lista (ya no está pendiente)
        allPlanillas = allPlanillas.filter(p => p.IdPlanillaParcial !== idPlanilla);
        filteredPlanillas = filteredPlanillas.filter(p => p.IdPlanillaParcial !== idPlanilla);

        // Cerrar loading
        Swal.close();

        // Mostrar éxito
        await Swal.fire({
            icon: 'success',
            title: '¡Planilla autorizada exitosamente!',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; border: 2px solid #10b981;">
                        <h4 style="color: #059669; margin-bottom: 15px; text-align: center;">✅ Autorización Completada</h4>
                        
                        <div style="margin-bottom: 10px;"><strong>📋 Planilla:</strong> ${planilla.TipoFormatted}</div>
                        <div style="margin-bottom: 10px;"><strong>🏢 Departamento:</strong> ${planilla.NombreDepartamento}</div>
                        <div style="margin-bottom: 10px;"><strong>📅 Período:</strong> ${planilla.PeriodoFormatted}</div>
                        <div style="margin-bottom: 10px;"><strong>💰 Monto:</strong> ${planilla.MontoFormatted}</div>
                        <div style="margin-bottom: 10px;"><strong>👥 Colaboradores:</strong> ${planilla.CantidadColaboradores}</div>
                        <div><strong>👤 Autorizada por:</strong> ${currentUser.NombreCompleto}</div>
                    </div>
                    
                    <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #3b82f6;">
                        <p style="margin: 0; color: #1e40af;">
                            <strong>ℹ️ Siguiente paso:</strong> La planilla ahora está disponible para descarga de documentos.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Perfecto',
            confirmButtonColor: '#10b981',
            width: '550px'
        });

        // Actualizar vistas
        actualizarVistaPlanillas();
        cerrarModalDetalle();

        // Log de auditoría
        console.log(`Planilla ${idPlanilla} autorizada por ${currentUser.NombreCompleto}`);

    } catch (error) {
        console.error('Error al autorizar planilla:', error);
        
        Swal.close();
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al autorizar planilla',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin-bottom: 10px; color: #991b1b;">
                            <strong>❌ No se pudo autorizar:</strong> ${error.message}
                        </p>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e;">
                            <strong>💡 Sugerencia:</strong> Verifique la conexión e intente nuevamente.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ef4444',
            width: '500px'
        });
    }
}

// ===== EJECUCIÓN DE RECHAZO =====
async function ejecutarRechazo(idPlanilla, motivo = '') {
    try {
        // Mostrar loading
        const loadingSwal = Swal.fire({
            title: 'Rechazando planilla...',
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                    <div class="loading-spinner" style="border: 4px solid #f3f4f6; border-top: 4px solid #ef4444; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
                    <p style="color: #ef4444; margin: 0;">Actualizando estado de la planilla...</p>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false
        });

        const planilla = allPlanillas.find(p => p.IdPlanillaParcial === idPlanilla);
        if (!planilla) {
            throw new Error('Planilla no encontrada');
        }

        // Actualizar en base de datos
        await actualizarEstadoPlanilla(idPlanilla, 6, motivo, 'Rechazada'); // Estado 6 = Rechazado

        // Remover planilla de la lista (ya no está pendiente)
        allPlanillas = allPlanillas.filter(p => p.IdPlanillaParcial !== idPlanilla);
        filteredPlanillas = filteredPlanillas.filter(p => p.IdPlanillaParcial !== idPlanilla);

        // Cerrar loading
        Swal.close();

        // Mostrar confirmación de rechazo
        await Swal.fire({
            icon: 'warning',
            title: 'Planilla rechazada',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border: 2px solid #ef4444;">
                        <h4 style="color: #dc2626; margin-bottom: 15px; text-align: center;">🚫 Planilla Rechazada</h4>
                        
                        <div style="margin-bottom: 10px;"><strong>📋 Planilla:</strong> ${planilla.TipoFormatted}</div>
                        <div style="margin-bottom: 10px;"><strong>🏢 Departamento:</strong> ${planilla.NombreDepartamento}</div>
                        <div style="margin-bottom: 10px;"><strong>📅 Período:</strong> ${planilla.PeriodoFormatted}</div>
                        <div style="margin-bottom: 10px;"><strong>💰 Monto:</strong> ${planilla.MontoFormatted}</div>
                        <div style="margin-bottom: 15px;"><strong>👤 Rechazada por:</strong> ${currentUser.NombreCompleto}</div>
                        
                        ${motivo ? `
                            <div style="background: #fee2e2; padding: 12px; border-radius: 6px; border-left: 4px solid #ef4444;">
                                <strong style="color: #991b1b;">📝 Motivo del rechazo:</strong><br>
                                <span style="color: #991b1b;">${motivo}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e;">
                            <strong>ℹ️ Siguiente paso:</strong> La planilla deberá ser revisada.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ef4444',
            width: '600px'
        });

        // Actualizar vistas
        actualizarVistaPlanillas();
        cerrarModalDetalle();

        // Log de auditoría
        console.log(`Planilla ${idPlanilla} rechazada por ${currentUser.NombreCompleto}. Motivo: ${motivo || 'Sin motivo especificado'}`);

    } catch (error) {
        console.error('Error al rechazar planilla:', error);
        
        Swal.close();
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al rechazar planilla',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin-bottom: 10px; color: #991b1b;">
                            <strong>❌ No se pudo rechazar:</strong> ${error.message}
                        </p>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e;">
                            <strong>💡 Sugerencia:</strong> Verifique la conexión e intente nuevamente.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ef4444',
            width: '500px'
        });
    }
}

// ===== ACTUALIZACIÓN EN BASE DE DATOS =====
async function actualizarEstadoPlanilla(idPlanilla, nuevoEstado, motivo, descripcionEstado) {
    try {
        const connection = await connectionString();

        // Verificar que la planilla existe y está en estado pendiente
        const verificacion = await connection.query(`
            SELECT IdPlanillaParcial, Estado, NombreUsuario, PeriodoPago 
            FROM PagoPlanillaParcial 
            WHERE IdPlanillaParcial = ?
        `, [idPlanilla]);

        if (verificacion.length === 0) {
            throw new Error('La planilla no existe en el sistema');
        }

        const planillaActual = verificacion[0];
        
        if (planillaActual.Estado !== 0) {
            throw new Error(`La planilla ya no está pendiente de autorización (Estado actual: ${planillaActual.Estado})`);
        }

        // Actualizar el estado de la planilla
        const updateResult = await connection.query(`
            UPDATE PagoPlanillaParcial 
            SET 
                Estado = ?,
                FechaAutorizacion = NOW(),
                FechaHoraAutorizacion = NOW(),
                IdUsuarioAutoriza = ?,
                NombreUsuarioAutoriza = ?,
                MotivoRechazo = ?
            WHERE IdPlanillaParcial = ? AND Estado = 0
        `, [
            nuevoEstado,
            currentUser.IdPersonal,
            currentUser.NombreCompleto,
            motivo || null,
            idPlanilla
        ]);

        if (updateResult.affectedRows === 0) {
            throw new Error('No se pudo actualizar la planilla. Posiblemente ya fue procesada por otro usuario.');
        }

    } catch (error) {
        console.error('Error al actualizar estado de planilla:', error);
        throw error;
    }
}

// ===== FUNCIONES DE AUTORIZACIÓN DESDE MODAL =====
function configurarEventosModalDetalle() {
    const authorizePlanillaBtn = document.getElementById('authorizePlanilla');
    const rejectPlanillaBtn = document.getElementById('rejectPlanilla');

    if (authorizePlanillaBtn) {
        authorizePlanillaBtn.addEventListener('click', () => {
            if (selectedPlanilla) {
                mostrarConfirmacionAutorizacion();
            }
        });
    }

    if (rejectPlanillaBtn) {
        rejectPlanillaBtn.addEventListener('click', () => {
            if (selectedPlanilla) {
                mostrarConfirmacionRechazo();
            }
        });
    }
}

function mostrarConfirmacionAutorizacion() {
    if (!selectedPlanilla) return;

    Swal.fire({
        title: '¿Autorizar esta planilla?',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <div style="background: var(--gray-50); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--trust-navy); margin-bottom: 15px; text-align: center;">📋 Resumen de Autorización</h4>
                    
                    <div style="margin-bottom: 10px;"><strong>📋 Tipo:</strong> ${selectedPlanilla.TipoFormatted}</div>
                    <div style="margin-bottom: 10px;"><strong>🏢 Departamento:</strong> ${selectedPlanilla.NombreDepartamento}</div>
                    <div style="margin-bottom: 10px;"><strong>📅 Período:</strong> ${selectedPlanilla.PeriodoFormatted}</div>
                    <div style="margin-bottom: 10px;"><strong>💰 Monto Total:</strong> ${selectedPlanilla.MontoFormatted}</div>
                    <div style="margin-bottom: 10px;"><strong>👥 Colaboradores:</strong> ${selectedPlanilla.CantidadColaboradores}</div>
                    <div style="margin-bottom: 10px;"><strong>👤 Creada por:</strong> ${selectedPlanilla.NombreUsuario}</div>
                    <div><strong>📅 Fecha Registro:</strong> ${selectedPlanilla.FechaRegistroFormatted}</div>
                </div>

                <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                    <p style="margin: 0; color: #059669;">
                        <strong>✅ Confirmación:</strong> Al autorizar, la planilla pasará al siguiente estado del proceso y estará disponible para descarga de documentos.
                    </p>
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '✅ Confirmar Autorización',
        cancelButtonText: '❌ Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        width: '600px'
    }).then((result) => {
        if (result.isConfirmed) {
            ejecutarAutorizacion(selectedPlanilla.IdPlanillaParcial);
        }
    });
}

function mostrarConfirmacionRechazo() {
    if (!selectedPlanilla) return;

    Swal.fire({
        title: '¿Rechazar esta planilla?',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <div style="background: var(--gray-50); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: var(--trust-navy); margin-bottom: 15px; text-align: center;">📋 Planilla a Rechazar</h4>
                    
                    <div style="margin-bottom: 10px;"><strong>📋 Tipo:</strong> ${selectedPlanilla.TipoFormatted}</div>
                    <div style="margin-bottom: 10px;"><strong>🏢 Departamento:</strong> ${selectedPlanilla.NombreDepartamento}</div>
                    <div style="margin-bottom: 10px;"><strong>📅 Período:</strong> ${selectedPlanilla.PeriodoFormatted}</div>
                    <div style="margin-bottom: 10px;"><strong>💰 Monto Total:</strong> ${selectedPlanilla.MontoFormatted}</div>
                    <div style="margin-bottom: 10px;"><strong>👥 Colaboradores:</strong> ${selectedPlanilla.CantidadColaboradores}</div>
                    <div style="margin-bottom: 10px;"><strong>👤 Creada por:</strong> ${selectedPlanilla.NombreUsuario}</div>
                    <div><strong>📅 Fecha Registro:</strong> ${selectedPlanilla.FechaRegistroFormatted}</div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-weight: 600; color: var(--trust-navy); margin-bottom: 8px;">Motivo del rechazo (opcional):</label>
                    <textarea id="modalRejectReason" style="width: 100%; min-height: 100px; padding: 12px; border: 2px solid var(--gray-200); border-radius: 8px; font-family: inherit; resize: vertical;" placeholder="Describa el motivo por el cual rechaza esta planilla...

Ejemplos:
- Discrepancias en las fechas trabajadas
- Montos incorrectos en algunos colaboradores  
- Turnos duplicados o inconsistentes
- Falta documentación de respaldo"></textarea>
                </div>

                <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #991b1b;">
                        <strong>⚠️ Advertencia:</strong> La planilla rechazada deberá ser corregida.
                    </p>
                </div>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '🚫 Confirmar Rechazo',
        cancelButtonText: '❌ Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        width: '700px',
        preConfirm: () => {
            const motivo = document.getElementById('modalRejectReason')?.value?.trim() || '';
            return { motivo };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            ejecutarRechazo(selectedPlanilla.IdPlanillaParcial, result.value.motivo);
        }
    });
}

// ===== FUNCIONES DE UTILIDAD Y AUDITORÍA =====
async function registrarAccionAuditoria(accion, detalles = {}) {
    try {
        const connection = await connectionString();
        
        await connection.query(`
            INSERT INTO AuditoriaAutorizaciones (
                IdUsuario,
                NombreUsuario,
                Accion,
                Detalles,
                DireccionIP,
                UserAgent,
                FechaAccion
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [
            currentUser.IdPersonal,
            currentUser.NombreCompleto,
            accion,
            JSON.stringify(detalles),
            obtenerDireccionIP(),
            navigator.userAgent
        ]);
        
        await connection.close();
        
    } catch (error) {
        // No es crítico si falla el log de auditoría
        console.warn('Error al registrar auditoría:', error.message);
    }
}

function obtenerDireccionIP() {
    // Esta función podría expandirse para obtener la IP real del cliente
    return 'No disponible';
}

function verificarPermisosPlanilla(planilla) {
    // Verificar que la planilla pertenece a un departamento del usuario
    return userDepartments.some(dept => dept.IdDepartamento === planilla.IdDepartamentoSucursal);
}

// ===== REFRESCO AUTOMÁTICO DE DATOS =====
let intervalRefresh = null;

function iniciarRefrescoAutomatico() {
    // Refrescar cada 5 minutos para detectar cambios
    intervalRefresh = setInterval(async () => {
        try {
            console.log('Refrescando datos automáticamente...');
            await cargarPlanillasPendientes();
        } catch (error) {
            console.error('Error en refresco automático:', error);
        }
    }, 5 * 60 * 1000); // 5 minutos
}

function detenerRefrescoAutomatico() {
    if (intervalRefresh) {
        clearInterval(intervalRefresh);
        intervalRefresh = null;
    }
}

// ===== INICIALIZACIÓN DE EVENTOS ADICIONALES =====
document.addEventListener('DOMContentLoaded', () => {
    // Configurar eventos del modal de detalle
    configurarEventosModalDetalle();
    
    // Iniciar refresco automático
    iniciarRefrescoAutomatico();
    
    // Detener refresco al cerrar la página
    window.addEventListener('beforeunload', () => {
        detenerRefrescoAutomatico();
    });
    
    // Manejar pérdida de focus de la ventana
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            detenerRefrescoAutomatico();
        } else {
            iniciarRefrescoAutomatico();
        }
    });
    const closeDetailBtn = document.getElementById('closeDetailModal');
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', cerrarModalDetalle);
    }
    
    // Cerrar modal de fechas
    const closeWorkDatesBtn = document.getElementById('closeWorkDatesModal');
    if (closeWorkDatesBtn) {
        closeWorkDatesBtn.addEventListener('click', cerrarModalFechas);
    }
    
    // Cerrar modales al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            if (e.target.id === 'planillaDetailModal') {
                cerrarModalDetalle();
            } else if (e.target.id === 'workDatesModal') {
                cerrarModalFechas();
            }
        }
    });
});

// ===== FUNCIONES DE NOTIFICACIÓN =====
function mostrarNotificacionExito(titulo, mensaje) {
    Swal.fire({
        icon: 'success',
        title: titulo,
        text: mensaje,
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
        timerProgressBar: true
    });
}

function mostrarNotificacionError(titulo, mensaje) {
    Swal.fire({
        icon: 'error',
        title: titulo,
        text: mensaje,
        timer: 4000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
        timerProgressBar: true
    });
}

function mostrarNotificacionInfo(titulo, mensaje) {
    Swal.fire({
        icon: 'info',
        title: titulo,
        text: mensaje,
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
        timerProgressBar: true
    });
}

// ===== VALIDACIONES FINALES Y SEGURIDAD =====
function validarEstadoSesion() {
    if (!currentUser || !currentUser.IdPersonal) {
        window.location.href = '../Login.html';
        return false;
    }
    return true;
}

function validarPermisosDepartamento(idDepartamento) {
    return userDepartments.some(dept => dept.IdDepartamento === idDepartamento);
}

// ===== LIMPIEZA Y CIERRE =====
window.addEventListener('beforeunload', () => {
    // Limpiar intervalos y recursos
    detenerRefrescoAutomatico();
    
    // Limpiar variables globales
    selectedPlanilla = null;
    allPlanillas = [];
    filteredPlanillas = [];
});

// ===== MANEJO DE ERRORES GLOBALES =====
window.addEventListener('error', (event) => {
    console.error('Error global capturado:', event.error);
    
    // Solo mostrar al usuario errores críticos
    if (event.error && event.error.message && event.error.message.includes('connection')) {
        mostrarNotificacionError(
            'Error de conexión',
            'Se perdió la conexión con el servidor. Por favor, recargue la página.'
        );
    }
});

window.verFechasTrabajadas = verFechasTrabajadas;
window.verDetallePlanilla = verDetallePlanilla;
window.autorizarPlanillaDirecta = autorizarPlanillaDirecta;
window.rechazarPlanillaDirecta = rechazarPlanillaDirecta;