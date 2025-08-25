// Configuración e inicialización
const { ipcRenderer } = require('electron');
const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');
const fs = require('fs');
const path = require('path');

// Variables para seguimiento de departamentos
let userData = null;
let departmentsData = [];
let regionsData = [];
let divisionsData = [];
let currentPage = 1;
let itemsPerPage = 8;
let totalPages = 1;
let currentFilterRegion = 0;
let currentFilterDivision = 0;
let searchTerm = '';
let currentAction = 'edit'; // 'edit' o 'new'
let selectedDepartmentId = null;

// Variables para seguimiento de divisiones
let divisionsPageData = [];
let currentDivisionPage = 1;
let divisionItemsPerPage = 8;
let totalDivisionPages = 1;
let divisionSearchTerm = '';
let currentDivisionAction = 'edit'; // 'edit' o 'new'
let selectedDivisionId = null;
let currentLogoBase64 = null;

// Referencias a elementos DOM - Departamentos
const departmentsGrid = document.getElementById('departmentsGrid');
const searchInput = document.getElementById('searchDepartment');
const clearSearchBtn = document.getElementById('clearSearch');
const filterRegion = document.getElementById('filterRegion');
const filterDivision = document.getElementById('filterDivision');
const newDepartmentBtn = document.getElementById('newDepartmentBtn');
const departmentModal = document.getElementById('departmentModal');
const confirmModal = document.getElementById('confirmModal');
const modalCloseBtn = departmentModal.querySelector('.close-modal');
const confirmModalCloseBtn = confirmModal.querySelector('.close-modal');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const confirmBtn = document.getElementById('confirmBtn');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageNumbers = document.getElementById('pageNumbers');

// Referencias a elementos DOM - Divisiones
const divisionsGrid = document.getElementById('divisionsGrid');
const searchDivisionInput = document.getElementById('searchDivision');
const clearDivisionSearchBtn = document.getElementById('clearDivisionSearch');
const newDivisionBtn = document.getElementById('newDivisionBtn');
const divisionModal = document.getElementById('divisionModal');
const divisionModalCloseBtn = divisionModal.querySelector('.close-modal');
const cancelDivisionBtn = document.getElementById('cancelDivisionBtn');
const saveDivisionBtn = document.getElementById('saveDivisionBtn');
const prevDivisionPageBtn = document.getElementById('prevDivisionPage');
const nextDivisionPageBtn = document.getElementById('nextDivisionPage');
const divisionPageNumbers = document.getElementById('divisionPageNumbers');
const selectLogoBtn = document.getElementById('selectLogoBtn');
const removeLogoBtn = document.getElementById('removeLogoBtn');
const logoFileInput = document.getElementById('logoFileInput');
const logoPreview = document.getElementById('logoPreview');
const currentLogo = document.getElementById('currentLogo');
const logoBase64Input = document.getElementById('logoBase64');

// Referencias a pestañas
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Cargar información del usuario
function cargarInfoUsuario() {
    // Obtener datos del usuario de localStorage
    userData = JSON.parse(localStorage.getItem('userData'));

    if (userData) {
        document.getElementById('userName').textContent = userData.NombreCompleto || 'Usuario';
        
        // Determinar rol según el puesto (5 es RRHH)
        let rol = 'Usuario';
        if (userData.Id_Puesto === 5) {
            rol = 'Administrador RRHH';
        } else if (userData.Id_Puesto === 1) {
            rol = 'Gerente';
        } else {
            rol = 'Colaborador';
        }
        
        document.getElementById('userRole').textContent = rol;
        
        // Cargar la imagen del usuario si está disponible
        if (userData.FotoBase64) {
            document.getElementById('userImage').src = userData.FotoBase64;
        }
    }
}

// Función para mostrar notificaciones toast
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
    toast.className = `toast toast-${tipo} animate__animated animate__fadeInUp`;
    
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
        toast.classList.replace('animate__fadeInUp', 'animate__fadeOutDown');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto-cierre después de 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.replace('animate__fadeInUp', 'animate__fadeOutDown');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 300);
        }
    }, 5000);
}

// Cargar regiones para filtrado
async function cargarRegiones() {
    try {
        const connection = await connectionString();
        
        // Consulta para obtener regiones
        const regiones = await connection.query(`
            SELECT
                IdRegion, 
                NombreRegion
            FROM
                Regiones
            ORDER BY
                NombreRegion
        `);
        
        await connection.close();
        
        // Guardar datos para uso posterior
        regionsData = regiones;
        
        // Llenar selector de regiones
        filterRegion.innerHTML = '<option value="0">Todas las Regiones</option>';
        
        regiones.forEach(region => {
            const option = document.createElement('option');
            option.value = region.IdRegion;
            option.textContent = region.NombreRegion;
            filterRegion.appendChild(option);
        });
        
        // También llenar el selector del modal
        const regionSelect = document.getElementById('regionSelect');
        regionSelect.innerHTML = '<option value="">Seleccionar Región</option>';
        
        regiones.forEach(region => {
            const option = document.createElement('option');
            option.value = region.IdRegion;
            option.textContent = region.NombreRegion;
            regionSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar regiones:', error);
        mostrarNotificacion('Error al cargar las regiones', 'error');
    }
}

// Cargar divisiones para filtrado
async function cargarDivisiones() {
    try {
        const connection = await connectionString();

        // Consulta para obtener divisiones con conversión de logo a base64
        const divisiones = await connection.query(`
            SELECT
                IdDivision, 
                Nombre,
                CASE 
                    WHEN Logos IS NOT NULL THEN CONCAT('data:image/png;base64,', TO_BASE64(Logos))
                    ELSE NULL 
                END AS LogosBase64
            FROM
                divisiones
            ORDER BY
                Nombre
        `);
        
        await connection.close();
        
        // Guardar datos para uso posterior
        divisionsData = divisiones;
        
        // Llenar selector de divisiones
        filterDivision.innerHTML = '<option value="0">Todas las Divisiones</option>';
        
        divisiones.forEach(division => {
            const option = document.createElement('option');
            option.value = division.IdDivision;
            option.textContent = division.Nombre;
            filterDivision.appendChild(option);
        });
        
        // También llenar el selector del modal
        const divisionSelect = document.getElementById('divisionSelect');
        divisionSelect.innerHTML = '<option value="">Seleccionar División</option>';
        
        divisiones.forEach(division => {
            const option = document.createElement('option');
            option.value = division.IdDivision;
            option.textContent = division.Nombre;
            divisionSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar divisiones:', error);
        mostrarNotificacion('Error al cargar las divisiones', 'error');
    }
}

// Cargar datos de departamentos
async function cargarDepartamentos() {
    try {
        // Mostrar el spinner de carga
        departmentsGrid.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p>Cargando departamentos...</p>
            </div>
        `;

        const connection = await connectionString();

        // Construir la consulta con filtros
        let query = `
            SELECT
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento, 
                divisiones.Nombre AS NombreDivision, 
                departamentos.NoMaxPers, 
                departamentos.IdRegion,
                Regiones.NombreRegion, 
                departamentos.IdDivision,
                departamentos.CantFijos, 
                departamentos.CantParciales, 
                departamentos.CantVacacionista, 
                departamentos.PlanFijo, 
                departamentos.PlanParcial, 
                departamentos.PlanVacacionista
            FROM
                departamentos
                INNER JOIN divisiones ON departamentos.IdDivision = divisiones.IdDivision
                INNER JOIN Regiones ON departamentos.IdRegion = Regiones.IdRegion
            WHERE 1=1
        `;
        
        // Agregar filtros si están seleccionados
        if (currentFilterRegion > 0) {
            query += ` AND departamentos.IdRegion = ${currentFilterRegion}`;
        }
        
        if (currentFilterDivision > 0) {
            query += ` AND departamentos.IdDivision = ${currentFilterDivision}`;
        }
        
        // Agregar búsqueda si hay término
        if (searchTerm.trim()) {
            query += ` AND departamentos.NombreDepartamento LIKE '%${searchTerm.trim()}%'`;
        }
        
        query += ` ORDER BY departamentos.NombreDepartamento`;
        
        const resultados = await connection.query(query);
        
        await connection.close();
        
        // Guardar resultados
        departmentsData = resultados;
        
        // Calcular paginación
        totalPages = Math.ceil(departmentsData.length / itemsPerPage);
        
        // Renderizar departamentos y paginación
        renderizarDepartamentos();
        actualizarPaginacion();
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarNotificacion('Error al cargar los departamentos', 'error');
        
        departmentsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error al cargar datos</h3>
                <p>No se pudieron cargar los departamentos. Por favor, intente nuevamente.</p>
                <button class="btn btn-primary" onclick="cargarDepartamentos()">
                    <i class="fas fa-sync-alt"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// Renderizar departamentos en el grid
function renderizarDepartamentos() {
    // Calcular índices para la página actual
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = departmentsData.slice(startIndex, endIndex);
    
    // Verificar si hay resultados
    if (departmentsData.length === 0) {
        departmentsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>No se encontraron departamentos</h3>
                <p>No hay departamentos que coincidan con los criterios de búsqueda.</p>
                <button class="btn btn-primary" id="resetFiltersBtn">
                    <i class="fas fa-filter"></i> Limpiar filtros
                </button>
            </div>
        `;
        
        // Agregar evento al botón de limpiar filtros
        document.getElementById('resetFiltersBtn').addEventListener('click', resetearFiltros);
        return;
    }
    
    // Limpiar el grid
    departmentsGrid.innerHTML = '';
    
    // Agregar departamentos
    paginatedData.forEach((depto, index) => {
        const card = document.createElement('div');
        card.className = 'department-card';
        card.style.animationDelay = `${index * 0.05}s`;
        
        // Obtener nombres de planes
        const planFijo = obtenerNombrePlan(depto.PlanFijo);
        const planParcial = obtenerNombrePlan(depto.PlanParcial);
        const planVacacionista = obtenerNombrePlan(depto.PlanVacacionista);
        
        card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">
                <i class="fas fa-building"></i>
                ${depto.NombreDepartamento}
            </h3>
            <div class="card-actions">
                <button class="btn-card-action edit" title="Editar" data-id="${depto.IdDepartamento}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-card-action delete" title="Eliminar" data-id="${depto.IdDepartamento}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
        <div class="card-body">
            <div class="detail-group">
                <div class="detail-label">División</div>
                <div class="detail-value">${depto.NombreDivision}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Región</div>
                <div class="detail-value">${depto.NombreRegion}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Personal Máximo para vacaciones</div>
                <div class="detail-value">
                    <span class="detail-badge badge-primary">${depto.NoMaxPers}</span>
                </div>
            </div>
            
            <div class="personnel-distribution">
                <div class="distribution-column">
                    <div class="distribution-title">Fijo</div>
                    <span class="distribution-count">${depto.CantFijos}</span>
                    <div class="plan-indicator">Dom/Asueto: ${formatearPlan(depto.PlanFijo)}</div>
                </div>
                <div class="distribution-column">
                    <div class="distribution-title">Parcial</div>
                    <span class="distribution-count">${depto.CantParciales}</span>
                    <div class="plan-indicator">Dom/Asueto: ${formatearPlan(depto.PlanParcial)}</div>
                </div>
                <div class="distribution-column">
                    <div class="distribution-title">Vacacionista</div>
                    <span class="distribution-count">${depto.CantVacacionista}</span>
                    <div class="plan-indicator">Dom/Asueto: ${formatearPlan(depto.PlanVacacionista)}</div>
                </div>
            </div>
        </div>
    `;
        
        departmentsGrid.appendChild(card);
    });
    
    // Agregar event listeners a los botones
    document.querySelectorAll('.btn-card-action.edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const deptoId = btn.getAttribute('data-id');
            abrirModalEditar(deptoId);
        });
    });
    
    document.querySelectorAll('.btn-card-action.delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const deptoId = btn.getAttribute('data-id');
            abrirModalConfirmacion(deptoId);
        });
    });
}

// Cargar datos de divisiones
async function cargarDivisionesParaGrid() {
    try {
        // Mostrar el spinner de carga
        divisionsGrid.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p>Cargando divisiones...</p>
            </div>
        `;
        
        const connection = await connectionString();
        
        // Construir la consulta con filtros
        let query = `
            SELECT
                IdDivision, 
                Nombre,
                CASE 
                    WHEN Logos IS NOT NULL THEN CONCAT('data:image/png;base64,', TO_BASE64(Logos))
                    ELSE NULL 
                END AS LogosBase64
            FROM
                divisiones
            WHERE 1=1
        `;
        
        // Agregar búsqueda si hay término
        if (divisionSearchTerm.trim()) {
            query += ` AND Nombre LIKE '%${divisionSearchTerm.trim()}%'`;
        }
        
        query += ` ORDER BY Nombre`;
        
        const resultados = await connection.query(query);
        
        await connection.close();
        
        // Guardar resultados
        divisionsPageData = resultados;
        
        // Calcular paginación
        totalDivisionPages = Math.ceil(divisionsPageData.length / divisionItemsPerPage);
        
        // Renderizar divisiones y paginación
        renderizarDivisiones();
        actualizarPaginacionDivisiones();
        
    } catch (error) {
        console.error('Error al cargar divisiones:', error);
        mostrarNotificacion('Error al cargar las divisiones', 'error');
        
        divisionsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error al cargar datos</h3>
                <p>No se pudieron cargar las divisiones. Por favor, intente nuevamente.</p>
                <button class="btn btn-primary" onclick="cargarDivisionesParaGrid()">
                    <i class="fas fa-sync-alt"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// Renderizar divisiones en el grid
function renderizarDivisiones() {
    // Calcular índices para la página actual
    const startIndex = (currentDivisionPage - 1) * divisionItemsPerPage;
    const endIndex = startIndex + divisionItemsPerPage;
    const paginatedData = divisionsPageData.slice(startIndex, endIndex);
    
    // Verificar si hay resultados
    if (divisionsPageData.length === 0) {
        divisionsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-landmark"></i>
                <h3>No se encontraron divisiones</h3>
                <p>No hay divisiones que coincidan con los criterios de búsqueda.</p>
                <button class="btn btn-primary" id="resetDivisionFiltersBtn">
                    <i class="fas fa-filter"></i> Limpiar filtros
                </button>
            </div>
        `;
        
        // Agregar evento al botón de limpiar filtros
        document.getElementById('resetDivisionFiltersBtn').addEventListener('click', resetearFiltrosDivisiones);
        return;
    }
    
    // Limpiar el grid
    divisionsGrid.innerHTML = '';
    
    // Agregar divisiones
    paginatedData.forEach((division, index) => {
        const card = document.createElement('div');
        card.className = 'division-card';
        card.style.animationDelay = `${index * 0.05}s`;
        
        // Preparar contenido de logo
        let logoContent;
        if (division.LogosBase64) {
            // Si hay logo, mostrar la imagen
            logoContent = `
                <div class="division-logo">
                    <img src="${division.LogosBase64}" alt="${division.Nombre}">
                </div>
            `;
        } else {
            // Si no hay logo, mostrar indicador
            logoContent = `
                <div class="division-logo">
                    <div class="no-logo-indicator">
                        <i class="fas fa-image"></i>
                        <span>Sin logo</span>
                    </div>
                </div>
            `;
        }
        
        card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">
                <i class="fas fa-landmark"></i>
                ${division.Nombre}
            </h3>
            <div class="card-actions">
                <button class="btn-card-action edit" title="Editar" data-id="${division.IdDivision}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-card-action delete" title="Eliminar" data-id="${division.IdDivision}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
        <div class="card-body">
            ${logoContent}
            <div class="detail-group">
                <div class="detail-label">ID División</div>
                <div class="detail-value">
                    <span class="detail-badge badge-secondary">${division.IdDivision}</span>
                </div>
            </div>
        </div>
    `;
        
        divisionsGrid.appendChild(card);
    });
    
    // Agregar event listeners a los botones
    document.querySelectorAll('.division-card .btn-card-action.edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const divisionId = btn.getAttribute('data-id');
            abrirModalEditarDivision(divisionId);
        });
    });
    
    document.querySelectorAll('.division-card .btn-card-action.delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const divisionId = btn.getAttribute('data-id');
            abrirModalConfirmacionDivision(divisionId);
        });
    });
}

function formatearPlan(valor) {
    // Si es 0, mostramos "No aplica"
    // Si no, mostramos el valor numérico
    return valor == 0 ? "Sin Dato" : valor;
}

// Función para obtener el nombre de un plan según su ID
function obtenerNombrePlan(planId) {
    const planes = {
        0: 'No aplica',
        1: 'Plan A',
        2: 'Plan B',
        3: 'Plan C',
    };
    
    return planes[planId] || 'No definido';
}

// Actualizar la paginación de departamentos
function actualizarPaginacion() {
    // Actualizar botones de navegación
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    // Generar números de página
    pageNumbers.innerHTML = '';
    
    // Si no hay páginas o solo hay una, no mostrar numeración
    if (totalPages <= 1) {
        return;
    }
    
    // Determinar rango de páginas a mostrar (máximo 5)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // Ajustar el rango si estamos cerca del final
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    // Generar botones de página
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderizarDepartamentos();
            actualizarPaginacion();
        });
        
        pageNumbers.appendChild(pageBtn);
    }
}

// Actualizar la paginación de divisiones
function actualizarPaginacionDivisiones() {
    // Actualizar botones de navegación
    prevDivisionPageBtn.disabled = currentDivisionPage === 1;
    nextDivisionPageBtn.disabled = currentDivisionPage === totalDivisionPages || totalDivisionPages === 0;
    
    // Generar números de página
    divisionPageNumbers.innerHTML = '';
    
    // Si no hay páginas o solo hay una, no mostrar numeración
    if (totalDivisionPages <= 1) {
        return;
    }
    
    // Determinar rango de páginas a mostrar (máximo 5)
    let startPage = Math.max(1, currentDivisionPage - 2);
    let endPage = Math.min(totalDivisionPages, startPage + 4);
    
    // Ajustar el rango si estamos cerca del final
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    // Generar botones de página
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-number ${i === currentDivisionPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        
        pageBtn.addEventListener('click', () => {
            currentDivisionPage = i;
            renderizarDivisiones();
            actualizarPaginacionDivisiones();
        });
        
        divisionPageNumbers.appendChild(pageBtn);
    }
}

// Abrir modal para crear nuevo departamento
function abrirModalNuevo() {
    currentAction = 'new';
    selectedDepartmentId = null;
    
    // Cambiar título del modal
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus-circle"></i> <span>Nuevo Departamento</span>';
    
    // Limpiar formulario
    document.getElementById('departmentForm').reset();
    document.getElementById('departmentId').value = 0;
    
    // Mostrar modal
    departmentModal.classList.add('show');
}

// Abrir modal para crear nueva división
function abrirModalNuevaDivision() {
    currentDivisionAction = 'new';
    selectedDivisionId = null;
    currentLogoBase64 = null;
    
    // Cambiar título del modal
    document.getElementById('divisionModalTitle').innerHTML = '<i class="fas fa-plus-circle"></i> <span>Nueva División</span>';
    
    // Limpiar formulario
    document.getElementById('divisionForm').reset();
    document.getElementById('divisionId').value = 0;
    document.getElementById('logoBase64').value = '';
    
    // Reiniciar previsualización del logo
    document.getElementById('currentLogo').src = '../Imagenes/no-logo.png';
    const logoOverlay = logoPreview.querySelector('.logo-overlay');
    if (logoOverlay) {
        logoOverlay.style.opacity = '1';
    }
    
    // Mostrar modal
    divisionModal.classList.add('show');
}

// Abrir modal para editar departamento
function abrirModalEditar(deptoId) {
    currentAction = 'edit';
    selectedDepartmentId = deptoId;
    
    // Buscar el departamento en los datos
    const depto = departmentsData.find(d => Number(d.IdDepartamento) === Number(deptoId));
    
    if (!depto) {
        mostrarNotificacion('No se encontró la información del departamento', 'error');
        return;
    }
    
    // Cambiar título del modal
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> <span>Editar Departamento</span>';
    
    // Llenar formulario con datos del departamento
    document.getElementById('departmentId').value = depto.IdDepartamento;
    document.getElementById('departmentName').value = depto.NombreDepartamento;
    document.getElementById('divisionSelect').value = depto.IdDivision;
    document.getElementById('regionSelect').value = depto.IdRegion;
    document.getElementById('maxPersonnel').value = depto.NoMaxPers;
    document.getElementById('fixedCount').value = depto.CantFijos;
    document.getElementById('partialCount').value = depto.CantParciales;
    document.getElementById('vacationistCount').value = depto.CantVacacionista;
    document.getElementById('fixedPlan').value = depto.PlanFijo;
    document.getElementById('partialPlan').value = depto.PlanParcial;
    document.getElementById('vacationistPlan').value = depto.PlanVacacionista;
    
    // Mostrar modal
    departmentModal.classList.add('show');
}

// Abrir modal para editar división
function abrirModalEditarDivision(divisionId) {
    currentDivisionAction = 'edit';
    selectedDivisionId = divisionId;
    
    // Buscar la división en los datos
    const division = divisionsPageData.find(d => Number(d.IdDivision) === Number(divisionId));
    
    if (!division) {
        mostrarNotificacion('No se encontró la información de la división', 'error');
        return;
    }
    
    // Cambiar título del modal
    document.getElementById('divisionModalTitle').innerHTML = '<i class="fas fa-edit"></i> <span>Editar División</span>';
    
    // Llenar formulario con datos de la división
    document.getElementById('divisionId').value = division.IdDivision;
    document.getElementById('divisionName').value = division.Nombre;
    
    // Configurar el logo
    if (division.LogosBase64) {
        document.getElementById('currentLogo').src = division.LogosBase64;
        
        // Intentamos extraer solo la parte base64 para guardar
        const base64String = division.LogosBase64.split(',')[1];
        document.getElementById('logoBase64').value = base64String || '';
        currentLogoBase64 = base64String || null;
        
        // Ocultar el overlay "Sin logo"
        const logoOverlay = logoPreview.querySelector('.logo-overlay');
        if (logoOverlay) {
            logoOverlay.style.opacity = '0';
        }
    } else {
        document.getElementById('currentLogo').src = '../Imagenes/no-logo.png';
        document.getElementById('logoBase64').value = '';
        currentLogoBase64 = null;
        
        // Mostrar el overlay "Sin logo"
        const logoOverlay = logoPreview.querySelector('.logo-overlay');
        if (logoOverlay) {
            logoOverlay.style.opacity = '1';
        }
    }
    
    // Mostrar modal
    divisionModal.classList.add('show');
}

// Abrir modal de confirmación para eliminar departamento
function abrirModalConfirmacion(deptoId) {
    selectedDepartmentId = deptoId;
    
    // Buscar el departamento en los datos
    const depto = departmentsData.find(d => Number(d.IdDepartamento) === Number(deptoId));
    
    if (!depto) {
        mostrarNotificacion('No se encontró la información del departamento', 'error');
        return;
    }
    
    // Actualizar mensaje de confirmación
    document.getElementById('confirmMessage').textContent = 
        `¿Está seguro que desea eliminar el departamento "${depto.NombreDepartamento}"?`;
    
    // Mostrar modal
    confirmModal.classList.add('show');
}

// Abrir modal de confirmación para eliminar división
function abrirModalConfirmacionDivision(divisionId) {
    selectedDivisionId = divisionId;
    
    // Buscar la división en los datos
    const division = divisionsPageData.find(d => Number(d.IdDivision) === Number(divisionId));
    
    if (!division) {
        mostrarNotificacion('No se encontró la información de la división', 'error');
        return;
    }
    
    // Verificar si hay departamentos asociados
    verificarDepartamentosEnDivision(divisionId, division.Nombre);
}

// Verificar si hay departamentos asociados a una división antes de eliminarla
async function verificarDepartamentosEnDivision(divisionId, nombreDivision) {
    try {
        const connection = await connectionString();

        // Consulta para verificar si hay departamentos en esta división
        const query = `
            SELECT COUNT(*) AS totalDepartamentos
            FROM departamentos
            WHERE IdDivision = ${divisionId}
        `;
        
        const resultado = await connection.query(query);
        await connection.close();
        
        const totalDepartamentos = Number(resultado[0].totalDepartamentos);
        
        if (totalDepartamentos > 0) {
            // Hay departamentos, mostrar mensaje de error
            Swal.fire({
                icon: 'warning',
                title: 'No se puede eliminar',
                text: `Esta división tiene ${totalDepartamentos} departamentos asociados. Debe reasignar los departamentos antes de eliminar la división.`
            });
        } else {
            // No hay departamentos, mostrar confirmación
            document.getElementById('confirmMessage').textContent = 
                `¿Está seguro que desea eliminar la división "${nombreDivision}"?`;
            
            // Actualizar el callback del botón confirmar
            confirmBtn.setAttribute('data-action', 'eliminar-division');
            
            // Mostrar modal
            confirmModal.classList.add('show');
        }
    } catch (error) {
        console.error('Error al verificar departamentos:', error);
        mostrarNotificacion('Error al verificar los departamentos asociados', 'error');
    }
}

// Guardar departamento (crear o actualizar)
async function guardarDepartamento() {
    try {
        // Validar formulario
        const form = document.getElementById('departmentForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // Obtener datos del formulario
        const deptoId = document.getElementById('departmentId').value;
        const nombre = document.getElementById('departmentName').value.trim();
        const divisionId = document.getElementById('divisionSelect').value;
        const regionId = document.getElementById('regionSelect').value;
        const maxPersonnel = document.getElementById('maxPersonnel').value;
        const fixedCount = document.getElementById('fixedCount').value;
        const partialCount = document.getElementById('partialCount').value;
        const vacationistCount = document.getElementById('vacationistCount').value;
        const fixedPlan = document.getElementById('fixedPlan').value;
        const partialPlan = document.getElementById('partialPlan').value;
        const vacationistPlan = document.getElementById('vacationistPlan').value;
        
        // Mostrar indicador de carga en el botón
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        saveBtn.disabled = true;

        const connection = await connectionString();

        // Determinar si es inserción o actualización
        if (currentAction === 'new') {
            // Consulta para insertar nuevo departamento
            const query = `
                INSERT INTO departamentos (
                    NombreDepartamento,
                    IdDivision,
                    IdRegion,
                    NoMaxPers,
                    CantFijos,
                    CantParciales,
                    CantVacacionista,
                    PlanFijo,
                    PlanParcial,
                    PlanVacacionista
                ) VALUES (
                    '${nombre}',
                    ${divisionId},
                    ${regionId},
                    ${maxPersonnel},
                    ${fixedCount},
                    ${partialCount},
                    ${vacationistCount},
                    ${fixedPlan},
                    ${partialPlan},
                    ${vacationistPlan}
                )
            `;
            
            await connection.query(query);
            await connection.close();
            
            // Cerrar modal y mostrar notificación
            departmentModal.classList.remove('show');
            mostrarNotificacion('Departamento creado exitosamente', 'success');
            
        } else {
            // Consulta para actualizar departamento existente
            const query = `
                UPDATE departamentos
                SET
                    NombreDepartamento = '${nombre}',
                    IdDivision = ${divisionId},
                    IdRegion = ${regionId},
                    NoMaxPers = ${maxPersonnel},
                    CantFijos = ${fixedCount},
                    CantParciales = ${partialCount},
                    CantVacacionista = ${vacationistCount},
                    PlanFijo = ${fixedPlan},
                    PlanParcial = ${partialPlan},
                    PlanVacacionista = ${vacationistPlan}
                WHERE IdDepartamento = ${deptoId}
            `;
            
            await connection.query(query);
            await connection.close();
            
            // Cerrar modal y mostrar notificación
            departmentModal.classList.remove('show');
            mostrarNotificacion('Departamento actualizado exitosamente', 'success');
        }
        
        // Recargar datos
        await cargarDepartamentos();
        
    } catch (error) {
        console.error('Error al guardar departamento:', error);
        mostrarNotificacion('Error al guardar los datos. Por favor, intente nuevamente.', 'error');
    } finally {
        // Restaurar estado del botón
        saveBtn.innerHTML = 'Guardar';
        saveBtn.disabled = false;
    }
}

// Guardar división (crear o actualizar)
async function guardarDivision() {
    try {
        // Validar formulario
        const form = document.getElementById('divisionForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // Obtener datos del formulario
        const divisionId = document.getElementById('divisionId').value;
        const nombre = document.getElementById('divisionName').value.trim();
        const logoBase64 = document.getElementById('logoBase64').value;
        
        // Mostrar indicador de carga en el botón
        saveDivisionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        saveDivisionBtn.disabled = true;

        const connection = await connectionString();

        // Determinar si es inserción o actualización
        if (currentDivisionAction === 'new') {
            // Consulta para insertar nueva división
            let query;
            
            if (logoBase64) {
                // Con logo - usamos FROM_BASE64 para convertir de base64 a BLOB
                query = `
                    INSERT INTO divisiones (
                        Nombre,
                        Logos
                    ) VALUES (
                        '${nombre}',
                        FROM_BASE64('${logoBase64}')
                    )
                `;
            } else {
                // Sin logo
                query = `
                    INSERT INTO divisiones (
                        Nombre
                    ) VALUES (
                        '${nombre}'
                    )
                `;
            }
            
            await connection.query(query);
            await connection.close();
            
            // Cerrar modal y mostrar notificación
            divisionModal.classList.remove('show');
            mostrarNotificacion('División creada exitosamente', 'success');
            
        } else {
            // Construir la consulta según si hay logo o no
            let query;
            
            if (logoBase64) {
                // Actualizar con logo - usamos FROM_BASE64 para convertir de base64 a BLOB
                query = `
                    UPDATE divisiones
                    SET
                        Nombre = '${nombre}',
                        Logos = FROM_BASE64('${logoBase64}')
                    WHERE IdDivision = ${divisionId}
                `;
            } else {
                // Actualizar sin logo (establecer a NULL)
                query = `
                    UPDATE divisiones
                    SET
                        Nombre = '${nombre}',
                        Logos = NULL
                    WHERE IdDivision = ${divisionId}
                `;
            }
            
            await connection.query(query);
            await connection.close();
            
            // Cerrar modal y mostrar notificación
            divisionModal.classList.remove('show');
            mostrarNotificacion('División actualizada exitosamente', 'success');
        }
        
        // Recargar datos
        await cargarDivisiones(); // Para actualizar los selectores
        await cargarDivisionesParaGrid(); // Para actualizar el grid
        
    } catch (error) {
        console.error('Error al guardar división:', error);
        mostrarNotificacion('Error al guardar los datos. Por favor, intente nuevamente.', 'error');
    } finally {
        // Restaurar estado del botón
        saveDivisionBtn.innerHTML = 'Guardar';
        saveDivisionBtn.disabled = false;
    }
}

// Eliminar departamento
async function eliminarDepartamento() {
    try {
        if (!selectedDepartmentId) {
            mostrarNotificacion('No se ha seleccionado un departamento', 'error');
            return;
        }
        
        // Mostrar indicador de carga en el botón
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
        confirmBtn.disabled = true;

        const connection = await connectionString();

        // Verificar primero si hay personal asignado a este departamento
        const checkQuery = `
            SELECT COUNT(*) AS totalPersonal
            FROM personal
            WHERE IdSucuDepa = ${selectedDepartmentId} AND Estado = 1
        `;
        
        const checkResult = await connection.query(checkQuery);
        const totalPersonal = Number(checkResult[0].totalPersonal);
        
        if (totalPersonal > 0) {
            await connection.close();
            confirmModal.classList.remove('show');
            
            Swal.fire({
                icon: 'warning',
                title: 'No se puede eliminar',
                text: `Este departamento tiene ${totalPersonal} colaboradores asignados. Debe reasignar el personal antes de eliminar el departamento.`
            });
            
            confirmBtn.innerHTML = 'Confirmar';
            confirmBtn.disabled = false;
            return;
        }
        
        // Proceder con la eliminación si no hay personal asignado
        const query = `DELETE FROM departamentos WHERE IdDepartamento = ${selectedDepartmentId}`;
        await connection.query(query);
        await connection.close();
        
        // Cerrar modal y mostrar notificación
        confirmModal.classList.remove('show');
        mostrarNotificacion('Departamento eliminado exitosamente', 'success');
        
        // Recargar datos
        await cargarDepartamentos();
        
    } catch (error) {
        console.error('Error al eliminar departamento:', error);
        mostrarNotificacion('Error al eliminar el departamento. Por favor, intente nuevamente.', 'error');
    } finally {
        // Restaurar estado del botón
        confirmBtn.innerHTML = 'Confirmar';
        confirmBtn.disabled = false;
        // Restaurar atributo de acción
        confirmBtn.removeAttribute('data-action');
    }
}

// Eliminar división
async function eliminarDivision() {
    try {
        if (!selectedDivisionId) {
            mostrarNotificacion('No se ha seleccionado una división', 'error');
            return;
        }
        
        // Mostrar indicador de carga en el botón
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
        confirmBtn.disabled = true;

        const connection = await connectionString();

        // Proceder con la eliminación
        const query = `DELETE FROM divisiones WHERE IdDivision = ${selectedDivisionId}`;
        await connection.query(query);
        await connection.close();
        
        // Cerrar modal y mostrar notificación
        confirmModal.classList.remove('show');
        mostrarNotificacion('División eliminada exitosamente', 'success');
        
        // Recargar datos
        await cargarDivisiones(); // Para actualizar los selectores
        await cargarDivisionesParaGrid(); // Para actualizar el grid
        
    } catch (error) {
        console.error('Error al eliminar división:', error);
        mostrarNotificacion('Error al eliminar la división. Por favor, intente nuevamente.', 'error');
    } finally {
        // Restaurar estado del botón
        confirmBtn.innerHTML = 'Confirmar';
        confirmBtn.disabled = false;
        // Restaurar atributo de acción
        confirmBtn.removeAttribute('data-action');
    }
}

// Resetear todos los filtros de departamentos
function resetearFiltros() {
    // Limpiar búsqueda
    searchInput.value = '';
    searchTerm = '';
    
    // Resetear selectores de filtro
    filterRegion.value = 0;
    filterDivision.value = 0;
    currentFilterRegion = 0;
    currentFilterDivision = 0;
    
    // Resetear paginación
    currentPage = 1;
    
    // Recargar datos
    cargarDepartamentos();
}

// Resetear filtros de divisiones
function resetearFiltrosDivisiones() {
    // Limpiar búsqueda
    searchDivisionInput.value = '';
    divisionSearchTerm = '';
    
    // Resetear paginación
    currentDivisionPage = 1;
    
    // Recargar datos
    cargarDivisionesParaGrid();
}

// Cargar archivo de imagen como Base64
function cargarImagenComoBase64(file) {
    return new Promise((resolve, reject) => {
        // Verificar el tamaño del archivo (1MB)
        if (file.size > 1024 * 1024) {
            reject('El archivo es demasiado grande. El tamaño máximo es 1MB.');
            return;
        }
        
        // Verificar el tipo de archivo
        if (!file.type.match('image/(jpeg|jpg|png|gif)')) {
            reject('Formato de imagen no válido. Use JPG o PNG.');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // Obtener la cadena base64 (quitando el prefijo de tipo de datos)
            const base64String = e.target.result.split(',')[1];
            resolve(base64String);
        };
        
        reader.onerror = function() {
            reject('Error al leer el archivo.');
        };
        
        reader.readAsDataURL(file);
    });
}

// Event Listeners

// Gestión de pestañas
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Quitar la clase active de todos los botones y contenidos
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Agregar clase active al botón actual
        btn.classList.add('active');
        
        // Mostrar el contenido correspondiente
        const tabName = btn.getAttribute('data-tab');
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Cargar datos si es necesario
        if (tabName === 'divisions' && divisionsPageData.length === 0) {
            cargarDivisionesParaGrid();
        }
    });
});

// Búsqueda de departamentos
searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value;
    
    // Mostrar/ocultar botón de limpiar
    if (searchTerm) {
        clearSearchBtn.style.opacity = '1';
    } else {
        clearSearchBtn.style.opacity = '0';
    }
    
    // Resetear a primera página
    currentPage = 1;
    
    // Recargar con nuevo término de búsqueda
    cargarDepartamentos();
});

// Búsqueda de divisiones
searchDivisionInput.addEventListener('input', () => {
    divisionSearchTerm = searchDivisionInput.value;
    
    // Mostrar/ocultar botón de limpiar
    if (divisionSearchTerm) {
        clearDivisionSearchBtn.style.opacity = '1';
    } else {
        clearDivisionSearchBtn.style.opacity = '0';
    }
    
    // Resetear a primera página
    currentDivisionPage = 1;
    
    // Recargar con nuevo término de búsqueda
    cargarDivisionesParaGrid();
});

// Limpiar búsqueda de departamentos
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchTerm = '';
    clearSearchBtn.style.opacity = '0';
    
    // Resetear a primera página
    currentPage = 1;
    
    // Recargar datos
    cargarDepartamentos();
});

// Limpiar búsqueda de divisiones
clearDivisionSearchBtn.addEventListener('click', () => {
    searchDivisionInput.value = '';
    divisionSearchTerm = '';
    clearDivisionSearchBtn.style.opacity = '0';
    
    // Resetear a primera página
    currentDivisionPage = 1;
    
    // Recargar datos
    cargarDivisionesParaGrid();
});

// Filtro por región
filterRegion.addEventListener('change', () => {
    currentFilterRegion = Number(filterRegion.value);
    
    // Resetear a primera página
    currentPage = 1;
    
    // Recargar datos
    cargarDepartamentos();
});

// Filtro por división
filterDivision.addEventListener('change', () => {
    currentFilterDivision = Number(filterDivision.value);
    
    // Resetear a primera página
    currentPage = 1;
    
    // Recargar datos
    cargarDepartamentos();
});

// Botón para nuevo departamento
newDepartmentBtn.addEventListener('click', abrirModalNuevo);

// Botón para nueva división
newDivisionBtn.addEventListener('click', abrirModalNuevaDivision);

// Botones de paginación de departamentos
prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderizarDepartamentos();
        actualizarPaginacion();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderizarDepartamentos();
        actualizarPaginacion();
    }
});

// Botones de paginación de divisiones
prevDivisionPageBtn.addEventListener('click', () => {
    if (currentDivisionPage > 1) {
        currentDivisionPage--;
        renderizarDivisiones();
        actualizarPaginacionDivisiones();
    }
});

nextDivisionPageBtn.addEventListener('click', () => {
    if (currentDivisionPage < totalDivisionPages) {
        currentDivisionPage++;
        renderizarDivisiones();
        actualizarPaginacionDivisiones();
    }
});

// Modal de departamento
modalCloseBtn.addEventListener('click', () => {
    departmentModal.classList.remove('show');
});

// Clicks fuera del modal para cerrarlo
departmentModal.addEventListener('click', (e) => {
    if (e.target === departmentModal) {
        departmentModal.classList.remove('show');
    }
});

// Modal de división
divisionModalCloseBtn.addEventListener('click', () => {
    divisionModal.classList.remove('show');
});

// Clicks fuera del modal para cerrarlo
divisionModal.addEventListener('click', (e) => {
    if (e.target === divisionModal) {
        divisionModal.classList.remove('show');
    }
});

// Botones del modal de departamento
cancelBtn.addEventListener('click', () => {
    departmentModal.classList.remove('show');
});

saveBtn.addEventListener('click', guardarDepartamento);

// Botones del modal de división
cancelDivisionBtn.addEventListener('click', () => {
    divisionModal.classList.remove('show');
});

saveDivisionBtn.addEventListener('click', guardarDivision);

// Modal de confirmación
confirmModalCloseBtn.addEventListener('click', () => {
    confirmModal.classList.remove('show');
});

// Clicks fuera del modal para cerrarlo
confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        confirmModal.classList.remove('show');
    }
});

// Botones del modal de confirmación
cancelConfirmBtn.addEventListener('click', () => {
    confirmModal.classList.remove('show');
});

confirmBtn.addEventListener('click', () => {
    // Determinar qué acción realizar según el atributo data-action
    const action = confirmBtn.getAttribute('data-action');
    
    if (action === 'eliminar-division') {
        eliminarDivision();
    } else {
        eliminarDepartamento();
    }
});

// Eventos para la carga del logo
selectLogoBtn.addEventListener('click', () => {
    logoFileInput.click();
});

logoFileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        
        try {
            // Cargar la imagen como Base64
            const base64String = await cargarImagenComoBase64(file);
            
            // Actualizar la vista previa
            currentLogo.src = `data:image/png;base64,${base64String}`;
            
            // Guardar en el input oculto
            logoBase64Input.value = base64String;
            currentLogoBase64 = base64String;
            
            // Ocultar el overlay "Sin logo"
            const logoOverlay = logoPreview.querySelector('.logo-overlay');
            if (logoOverlay) {
                logoOverlay.style.opacity = '0';
            }
            
            // Limpiar el input de archivo para permitir seleccionar el mismo archivo nuevamente
            logoFileInput.value = '';
            
        } catch (error) {
            mostrarNotificacion(error, 'error');
            logoFileInput.value = '';
        }
    }
});

removeLogoBtn.addEventListener('click', () => {
    // Limpiar la imagen
    currentLogo.src = '../Imagenes/no-logo.png';
    
    // Limpiar el valor del logo
    logoBase64Input.value = '';
    currentLogoBase64 = null;
    
    // Mostrar el overlay "Sin logo"
    const logoOverlay = logoPreview.querySelector('.logo-overlay');
    if (logoOverlay) {
        logoOverlay.style.opacity = '1';
    }
    
    // Mostrar notificación
    mostrarNotificacion('Logo eliminado', 'info');
});

// Inicializar la página
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar información del usuario
    cargarInfoUsuario();
    
    // Cargar datos para los selectores
    await cargarRegiones();
    await cargarDivisiones();
    
    // Cargar departamentos
    await cargarDepartamentos();
    
    // Mostrar notificación de bienvenida después de un breve retraso
    setTimeout(() => {
        mostrarNotificacion('Bienvenido a la gestión de departamentos y divisiones', 'info');
    }, 1000);
});