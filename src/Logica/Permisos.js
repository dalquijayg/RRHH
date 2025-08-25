// Importaciones requeridas
const { ipcRenderer } = require('electron');
const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');

const currentUser = JSON.parse(localStorage.getItem('userData'));
let selectedEmployee = null;

// Mapeo de módulos
const MODULOS = {
    1: {
        nombre: 'Gestión de Personal',
        icono: 'fas fa-users',
        color: '#4E77E5',
        descripcion: 'Administración de empleados, puestos y departamentos'
    },
    2: {
        nombre: 'Nómina y Planillas',
        icono: 'fas fa-calculator',
        color: '#28a745',
        descripcion: 'Cálculos salariales, deducciones y planillas'
    },
    3: {
        nombre: 'Vacaciones',
        icono: 'fas fa-calendar-alt',
        color: '#17a2b8',
        descripcion: 'Gestión de solicitudes y períodos vacacionales'
    },
    4: {
        nombre: 'Archivos',
        icono: 'fas fa-folder',
        color: '#6f42c1',
        descripcion: 'Documentos y expedientes del personal'
    },
    5: {
        nombre: 'Adicionales',
        icono: 'fas fa-plus-circle',
        color: '#fd7e14',
        descripcion: 'Bonificaciones, horas extra y pagos adicionales'
    },
    6: {
        nombre: 'Reportes',
        icono: 'fas fa-chart-bar',
        color: '#e83e8c',
        descripcion: 'Informes y estadísticas del sistema'
    },
    7: {
        nombre: 'Administración',
        icono: 'fas fa-cogs',
        color: '#6c757d',
        descripcion: 'Configuración del sistema y permisos'
    }
};

// Referencias a elementos DOM
const loadingIndicator = document.getElementById('loadingIndicator');
const btnVolver = document.getElementById('btnVolver');
const btnBuscar = document.getElementById('btnBuscar');
const searchNombre = document.getElementById('searchNombre');
const departamentoSelect = document.getElementById('departamento');
const resultsList = document.getElementById('resultsList');
const resultCount = document.getElementById('resultCount');
const emptyState = document.getElementById('emptyState');
const resultsContainer = document.getElementById('resultsContainer');
const permissionsSection = document.getElementById('permissionsSection');
const permissionsList = document.getElementById('permissionsList');
const btnCancelarAsignacion = document.getElementById('btnCancelarAsignacion');
const btnAsignarPermisos = document.getElementById('btnAsignarPermisos');
const selectedEmployeeName = document.getElementById('selectedEmployeeName');
const selectedEmployeePosition = document.getElementById('selectedEmployeePosition');
const selectedEmployeeId = document.getElementById('selectedEmployeeId');
const selectedEmployeePhoto = document.getElementById('selectedEmployeePhoto');
const confirmModal = document.getElementById('confirmModal');
const permissionsSummary = document.getElementById('permissionsSummary');
const confirmAssignBtn = document.getElementById('confirmAssignBtn');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const closeConfirmModal = document.getElementById('closeConfirmModal');

// Funciones de utilidad
async function getConnection() {
    try {
        const connection = await connectionString();
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error de conexión:', error);
        mostrarNotificacion('Error de conexión a la base de datos', 'error');
        throw error;
    }
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    
    const iconMap = {
        success: 'check-circle',
        error: 'times-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${iconMap[tipo]}"></i>
        </div>
        <div class="toast-content">${mensaje}</div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    });
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 300);
        }
    }, 5000);
}

function mostrarCargando(mostrar) {
    if (mostrar) {
        loadingIndicator.classList.add('visible');
    } else {
        loadingIndicator.classList.remove('visible');
    }
}

// Cargar departamentos para el filtro
async function cargarDepartamentos() {
    try {
        mostrarCargando(true);
        
        const connection = await getConnection();
        const query = `
            SELECT IdDepartamento, NombreDepartamento
            FROM departamentos
            ORDER BY NombreDepartamento
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        departamentoSelect.innerHTML = '<option value="">Todos los departamentos</option>';
        
        result.forEach(depto => {
            const option = document.createElement('option');
            option.value = depto.IdDepartamento;
            option.textContent = depto.NombreDepartamento;
            departamentoSelect.appendChild(option);
        });
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarNotificacion('Error al cargar departamentos', 'error');
        mostrarCargando(false);
    }
}

// Buscar colaboradores según los filtros
async function buscarColaboradores() {
    try {
        const nombreBusqueda = searchNombre.value.trim();
        const departamentoId = departamentoSelect.value;
        
        if (!nombreBusqueda && !departamentoId) {
            mostrarNotificacion('Por favor ingrese un nombre o seleccione un departamento', 'warning');
            return;
        }
        
        mostrarCargando(true);
        
        const connection = await getConnection();
        
        let query = `
            SELECT 
                personal.IdPersonal,
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto,
                departamentos.NombreDepartamento,
                PuestosGenerales.Nombre AS NombrePuesto,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM
                personal
                LEFT JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                LEFT JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                LEFT JOIN PuestosGenerales ON Puestos.Id_PuestoGeneral = PuestosGenerales.Id_Puesto
                LEFT JOIN FotosPersonal ON personal.IdPersonal = FotosPersonal.IdPersonal
            WHERE
                personal.Estado = 1 
        `;
        
        const queryParams = [];
        
        if (nombreBusqueda) {
            query += `
                AND (
                    personal.PrimerNombre LIKE ? OR
                    personal.SegundoNombre LIKE ? OR
                    personal.PrimerApellido LIKE ? OR
                    personal.SegundoApellido LIKE ?
                )
            `;
            const searchTerm = `%${nombreBusqueda}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        if (departamentoId) {
            query += ` AND personal.IdSucuDepa = ?`;
            queryParams.push(departamentoId);
        }
        
        query += ` ORDER BY departamentos.NombreDepartamento, personal.PrimerNombre`;
        
        const result = await connection.query(query, queryParams);
        await connection.close();
        
        mostrarResultados(result);
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al buscar colaboradores:', error);
        mostrarNotificacion('Error al buscar colaboradores', 'error');
        mostrarCargando(false);
    }
}

// Mostrar resultados de búsqueda
function mostrarResultados(colaboradores) {
    resultsList.innerHTML = '';
    
    const count = colaboradores ? colaboradores.length : 0;
    resultCount.textContent = count;
    
    if (!colaboradores || colaboradores.length === 0) {
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `
            <i class="fas fa-user-slash"></i>
            <p>No se encontraron colaboradores con los filtros aplicados</p>
        `;
        resultsContainer.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    resultsContainer.style.display = 'block';
    
    colaboradores.forEach(colaborador => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${colaborador.IdPersonal}</td>
            <td>${colaborador.NombreCompleto}</td>
            <td>${colaborador.NombreDepartamento || 'Sin departamento'}</td>
            <td>${colaborador.NombrePuesto || 'Sin puesto asignado'}</td>
            <td>
                <button class="btn-select" data-id="${colaborador.IdPersonal}">
                    <i class="fas fa-key"></i> Seleccionar
                </button>
            </td>
        `;
        
        row.dataset.colaborador = JSON.stringify(colaborador);
        resultsList.appendChild(row);
    });
    
    document.querySelectorAll('.btn-select').forEach(btn => {
        btn.addEventListener('click', function() {
            const colaboradorData = JSON.parse(this.closest('tr').dataset.colaborador);
            seleccionarColaborador(colaboradorData);
        });
    });
}

// Seleccionar un colaborador para asignar permisos
function seleccionarColaborador(colaborador) {
    selectedEmployee = colaborador;
    
    selectedEmployeeName.textContent = colaborador.NombreCompleto;
    selectedEmployeePosition.textContent = `${colaborador.NombrePuesto || 'Sin puesto'} - ${colaborador.NombreDepartamento || 'Sin departamento'}`;
    selectedEmployeeId.textContent = colaborador.IdPersonal;
    selectedEmployeePhoto.src = colaborador.FotoBase64 || '../Imagenes/user-default.png';
    
    cargarPermisosPorModulos();
    
    permissionsSection.style.display = 'block';
    permissionsSection.scrollIntoView({ behavior: 'smooth' });
}

// Nueva función para cargar permisos organizados por módulos
async function cargarPermisosPorModulos() {
    try {
        mostrarCargando(true);
        
        const connection = await getConnection();
        
        // Consulta actualizada para incluir el campo Modulo
        const permisosQuery = `
            SELECT
                TiposTransaccionesRRHH.Descripcion, 
                TiposTransaccionesRRHH.Codigo,
                IFNULL(TiposTransaccionesRRHH.Modulo, 7) AS Modulo
            FROM
                TiposTransaccionesRRHH
            ORDER BY
                TiposTransaccionesRRHH.Modulo, TiposTransaccionesRRHH.Descripcion
        `;
        
        const permisosResult = await connection.query(permisosQuery);
        
        // Consulta para obtener los permisos asignados al colaborador
        const permisosAsignadosQuery = `
            SELECT Codigo
            FROM TransaccionesRRHH
            WHERE IdPersonal = ? AND Activo = 1
        `;
        
        const permisosAsignadosResult = await connection.query(permisosAsignadosQuery, [selectedEmployee.IdPersonal]);
        await connection.close();
        
        // Crear array de códigos asignados
        const codigosAsignados = permisosAsignadosResult.map(p => p.Codigo);
        
        // Organizar permisos por módulo
        const permisosPorModulo = {};
        permisosResult.forEach(permiso => {
            const moduloId = permiso.Modulo || 7; // Si no tiene módulo, va a Administración
            if (!permisosPorModulo[moduloId]) {
                permisosPorModulo[moduloId] = [];
            }
            permisosPorModulo[moduloId].push({
                ...permiso,
                isAssigned: codigosAsignados.includes(permiso.Codigo)
            });
        });
        
        // Limpiar contenedor
        permissionsList.innerHTML = '';
        
        // Crear controles superiores
        crearControlesPermisos();
        
        // Crear contenedor principal
        const modulosContainer = document.createElement('div');
        modulosContainer.className = 'modulos-container';
        
        // Crear cada módulo
        Object.keys(permisosPorModulo).forEach(moduloId => {
            const modulo = MODULOS[moduloId];
            const permisos = permisosPorModulo[moduloId];
            
            if (permisos.length > 0) {
                const moduloElement = crearModuloElement(modulo, permisos, moduloId);
                modulosContainer.appendChild(moduloElement);
            }
        });
        
        permissionsList.appendChild(modulosContainer);
        
        // Actualizar contador
        actualizarContadorPermisos();
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar permisos:', error);
        mostrarNotificacion('Error al cargar la lista de permisos', 'error');
        mostrarCargando(false);
    }
}

// Crear elemento de módulo
function crearModuloElement(modulo, permisos, moduloId) {
    const moduloDiv = document.createElement('div');
    moduloDiv.className = 'modulo-card';
    
    const permisosAsignados = permisos.filter(p => p.isAssigned).length;
    const totalPermisos = permisos.length;
    
    moduloDiv.innerHTML = `
        <div class="modulo-header" data-modulo="${moduloId}">
            <div class="modulo-info">
                <div class="modulo-icon" style="background-color: ${modulo.color}">
                    <i class="${modulo.icono}"></i>
                </div>
                <div class="modulo-details">
                    <h3 class="modulo-title">${modulo.nombre}</h3>
                    <p class="modulo-description">${modulo.descripcion}</p>
                    <div class="modulo-stats">
                        <span class="permisos-count">${permisosAsignados}/${totalPermisos} permisos asignados</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(permisosAsignados/totalPermisos)*100}%; background-color: ${modulo.color}"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modulo-actions">
                <button class="btn-modulo-toggle" type="button">
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </button>
                <button class="btn-select-all-modulo" type="button" data-modulo="${moduloId}">
                    <i class="fas fa-check-square"></i> Todo
                </button>
                <button class="btn-deselect-all-modulo" type="button" data-modulo="${moduloId}">
                    <i class="fas fa-square"></i> Ninguno
                </button>
            </div>
        </div>
        <div class="modulo-content">
            <div class="permisos-grid">
                ${permisos.map(permiso => `
                    <div class="permission-item ${permiso.isAssigned ? 'assigned' : ''}">
                        <input type="checkbox" 
                               id="perm${permiso.Codigo}" 
                               class="permission-checkbox" 
                               data-codigo="${permiso.Codigo}" 
                               data-descripcion="${permiso.Descripcion}"
                               data-modulo="${moduloId}"
                               ${permiso.isAssigned ? 'checked' : ''}>
                        <label for="perm${permiso.Codigo}" class="permission-label">
                            ${permiso.Descripcion}
                        </label>
                        <span class="permission-code">${permiso.Codigo}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Configurar eventos del módulo
    configurarEventosModulo(moduloDiv, moduloId);
    
    return moduloDiv;
}

// Configurar eventos de cada módulo
function configurarEventosModulo(moduloDiv, moduloId) {
    const header = moduloDiv.querySelector('.modulo-header');
    const content = moduloDiv.querySelector('.modulo-content');
    const toggleBtn = moduloDiv.querySelector('.btn-modulo-toggle');
    const selectAllBtn = moduloDiv.querySelector('.btn-select-all-modulo');
    const deselectAllBtn = moduloDiv.querySelector('.btn-deselect-all-modulo');
    
    // Toggle del módulo
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moduloDiv.classList.toggle('expanded');
    });
    
    // Header también hace toggle
    header.addEventListener('click', (e) => {
        if (!e.target.closest('.modulo-actions')) {
            moduloDiv.classList.toggle('expanded');
        }
    });
    
    // Seleccionar todos los permisos del módulo
    selectAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const checkboxes = moduloDiv.querySelectorAll('.permission-checkbox');
        checkboxes.forEach(cb => cb.checked = true);
        actualizarEstadoModulo(moduloDiv, moduloId);
        actualizarContadorPermisos();
    });
    
    // Deseleccionar todos los permisos del módulo
    deselectAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const checkboxes = moduloDiv.querySelectorAll('.permission-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        actualizarEstadoModulo(moduloDiv, moduloId);
        actualizarContadorPermisos();
    });
    
    // Eventos de checkboxes individuales
    const checkboxes = moduloDiv.querySelectorAll('.permission-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            actualizarEstadoModulo(moduloDiv, moduloId);
            actualizarContadorPermisos();
        });
    });
    
    // Expandir por defecto si tiene permisos asignados
    const permisosAsignados = moduloDiv.querySelectorAll('.permission-checkbox:checked').length;
    if (permisosAsignados > 0) {
        moduloDiv.classList.add('expanded');
    }
}

// Actualizar estado visual del módulo
function actualizarEstadoModulo(moduloDiv, moduloId) {
    const checkboxes = moduloDiv.querySelectorAll('.permission-checkbox');
    const checkedBoxes = moduloDiv.querySelectorAll('.permission-checkbox:checked');
    const totalPermisos = checkboxes.length;
    const permisosAsignados = checkedBoxes.length;
    
    // Actualizar contador
    const countElement = moduloDiv.querySelector('.permisos-count');
    countElement.textContent = `${permisosAsignados}/${totalPermisos} permisos asignados`;
    
    // Actualizar barra de progreso
    const progressFill = moduloDiv.querySelector('.progress-fill');
    const porcentaje = totalPermisos > 0 ? (permisosAsignados / totalPermisos) * 100 : 0;
    progressFill.style.width = `${porcentaje}%`;
    
    // Actualizar clases de estado
    moduloDiv.classList.remove('all-selected', 'partial-selected', 'none-selected');
    if (permisosAsignados === totalPermisos && totalPermisos > 0) {
        moduloDiv.classList.add('all-selected');
    } else if (permisosAsignados > 0) {
        moduloDiv.classList.add('partial-selected');
    } else {
        moduloDiv.classList.add('none-selected');
    }
}

// Crear controles superiores de permisos
function crearControlesPermisos() {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'permissions-controls';
    
    controlsContainer.innerHTML = `
        <div class="permissions-search">
            <div class="input-with-icon">
                <i class="fas fa-search"></i>
                <input type="text" id="permissionsSearch" placeholder="Buscar permisos en todos los módulos...">
            </div>
        </div>
        <div class="permissions-actions">
            <div class="permissions-counter">
                <span id="selectedCount">0</span> permisos seleccionados
            </div>
            <div class="permissions-buttons">
                <button class="btn btn-select-all-global" id="btnSelectAllGlobal">
                    <i class="fas fa-check-double"></i> Seleccionar Todo
                </button>
                <button class="btn btn-deselect-all-global" id="btnDeselectAllGlobal">
                    <i class="fas fa-times"></i> Deseleccionar Todo
                </button>
                <button class="btn btn-expand-all" id="btnExpandAll">
                    <i class="fas fa-expand"></i> Expandir Todo
                </button>
                <button class="btn btn-collapse-all" id="btnCollapseAll">
                    <i class="fas fa-compress"></i> Contraer Todo
                </button>
            </div>
        </div>
    `;
    
    permissionsList.appendChild(controlsContainer);
    
    // Configurar eventos de controles
    configurarEventosControles();
}

// Configurar eventos de controles globales
function configurarEventosControles() {
    // Búsqueda
    const searchInput = document.getElementById('permissionsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filtrarPermisos(this.value);
        });
    }
    
    // Seleccionar todo globalmente
    const btnSelectAllGlobal = document.getElementById('btnSelectAllGlobal');
    if (btnSelectAllGlobal) {
        btnSelectAllGlobal.addEventListener('click', () => {
            const checkboxes = permissionsList.querySelectorAll('.permission-checkbox');
            checkboxes.forEach(cb => cb.checked = true);
            actualizarTodosLosModulos();
            actualizarContadorPermisos();
        });
    }
    
    // Deseleccionar todo globalmente
    const btnDeselectAllGlobal = document.getElementById('btnDeselectAllGlobal');
    if (btnDeselectAllGlobal) {
        btnDeselectAllGlobal.addEventListener('click', () => {
            const checkboxes = permissionsList.querySelectorAll('.permission-checkbox');
            checkboxes.forEach(cb => cb.checked = false);
            actualizarTodosLosModulos();
            actualizarContadorPermisos();
        });
    }
    
    // Expandir todo
    const btnExpandAll = document.getElementById('btnExpandAll');
    if (btnExpandAll) {
        btnExpandAll.addEventListener('click', () => {
            const modulos = permissionsList.querySelectorAll('.modulo-card');
            modulos.forEach(modulo => modulo.classList.add('expanded'));
        });
    }
    
    // Contraer todo
    const btnCollapseAll = document.getElementById('btnCollapseAll');
    if (btnCollapseAll) {
        btnCollapseAll.addEventListener('click', () => {
            const modulos = permissionsList.querySelectorAll('.modulo-card');
            modulos.forEach(modulo => modulo.classList.remove('expanded'));
        });
    }
}

// Filtrar permisos por búsqueda
function filtrarPermisos(termino) {
    const terminoLower = termino.toLowerCase();
    const modulos = permissionsList.querySelectorAll('.modulo-card');
    
    modulos.forEach(modulo => {
        const permisoItems = modulo.querySelectorAll('.permission-item');
        let tieneCoincidencias = false;
        
        permisoItems.forEach(item => {
            const label = item.querySelector('.permission-label').textContent.toLowerCase();
            const code = item.querySelector('.permission-code').textContent.toLowerCase();
            const coincide = label.includes(terminoLower) || code.includes(terminoLower);
            
            if (coincide || !termino) {
                item.style.display = 'flex';
                item.classList.toggle('highlighted', !!termino && coincide);
                if (coincide) tieneCoincidencias = true;
            } else {
                item.style.display = 'none';
                item.classList.remove('highlighted');
            }
        });
        
        // Expandir módulo si tiene coincidencias
        if (tieneCoincidencias && termino) {
            modulo.classList.add('expanded');
        }
        
        // Mostrar/ocultar módulo completo si no hay coincidencias
        modulo.style.display = (tieneCoincidencias || !termino) ? 'block' : 'none';
    });
}

// Actualizar contador de permisos seleccionados
function actualizarContadorPermisos() {
    const selectedCount = permissionsList.querySelectorAll('.permission-checkbox:checked').length;
    const selectedCountElement = document.getElementById('selectedCount');
    if (selectedCountElement) {
        selectedCountElement.textContent = selectedCount;
    }
}

// Actualizar todos los módulos
function actualizarTodosLosModulos() {
    const modulos = permissionsList.querySelectorAll('.modulo-card');
    modulos.forEach(modulo => {
        const moduloId = modulo.querySelector('.modulo-header').dataset.modulo;
        actualizarEstadoModulo(modulo, moduloId);
    });
}

// Confirmar asignación de permisos
function confirmarAsignacion() {
    const permisosSeleccionados = [];
    const checkboxes = permissionsList.querySelectorAll('input[type="checkbox"]:checked');
    
    checkboxes.forEach(checkbox => {
        const moduloId = checkbox.dataset.modulo;
        const modulo = MODULOS[moduloId];
        
        permisosSeleccionados.push({
            codigo: checkbox.dataset.codigo,
            descripcion: checkbox.dataset.descripcion,
            modulo: modulo ? modulo.nombre : 'Sin módulo',
            moduloColor: modulo ? modulo.color : '#6c757d'
        });
    });
    
    if (permisosSeleccionados.length === 0) {
        mostrarNotificacion('Debe seleccionar al menos un permiso para asignar', 'warning');
        return;
    }
    
    // Agrupar permisos por módulo para el resumen
    const permisosPorModulo = {};
    permisosSeleccionados.forEach(permiso => {
        if (!permisosPorModulo[permiso.modulo]) {
            permisosPorModulo[permiso.modulo] = {
                color: permiso.moduloColor,
                permisos: []
            };
        }
        permisosPorModulo[permiso.modulo].permisos.push(permiso);
    });
    
    // Llenar el resumen de permisos en el modal
    permissionsSummary.innerHTML = '';
    
    Object.keys(permisosPorModulo).forEach(nombreModulo => {
        const moduloData = permisosPorModulo[nombreModulo];
        
        const moduloSummary = document.createElement('div');
        moduloSummary.className = 'summary-module';
        moduloSummary.innerHTML = `
            <div class="summary-module-header" style="border-left-color: ${moduloData.color}">
                <h4>${nombreModulo}</h4>
                <span class="summary-module-count">${moduloData.permisos.length} permisos</span>
            </div>
            <div class="summary-module-items">
                ${moduloData.permisos.map(permiso => `
                    <div class="summary-item">
                        <i class="fas fa-check-circle"></i>
                        <span>${permiso.descripcion}</span>
                        <span class="summary-code">${permiso.codigo}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        permissionsSummary.appendChild(moduloSummary);
    });
    
    // Mostrar modal de confirmación
    confirmModal.classList.add('active');
}

// Función actualizada para guardar permisos y actualizar IngresoSistema
async function guardarPermisos() {
    try {
        mostrarCargando(true);
        
        const connection = await getConnection();
        
        // Primero, desactivar todos los permisos actuales
        const desactivarQuery = `
            UPDATE TransaccionesRRHH
            SET Activo = 0
            WHERE IdPersonal = ?
        `;
        
        await connection.query(desactivarQuery, [selectedEmployee.IdPersonal]);
        
        // Obtener los permisos seleccionados
        const checkboxes = permissionsList.querySelectorAll('input[type="checkbox"]:checked');
        const permisos = Array.from(checkboxes).map(cb => cb.dataset.codigo);
        
        // Insertar los nuevos permisos
        for (const codigo of permisos) {
            const checkExistingQuery = `
                SELECT COUNT(*) as count
                FROM TransaccionesRRHH
                WHERE IdPersonal = ? AND Codigo = ?
            `;
            
            const existingResult = await connection.query(checkExistingQuery, [
                selectedEmployee.IdPersonal,
                codigo
            ]);
            
            if (existingResult[0].count > 0) {
                // Actualizar el registro existente
                const updateQuery = `
                    UPDATE TransaccionesRRHH
                    SET Activo = 1,
                        IdUsuarioAsigno = ?,
                        NombreUsuarioAsigno = ?
                    WHERE IdPersonal = ? AND Codigo = ?
                `;
                
                await connection.query(updateQuery, [
                    currentUser.IdPersonal,
                    currentUser.NombreCompleto || `${currentUser.PrimerNombre} ${currentUser.PrimerApellido}`,
                    selectedEmployee.IdPersonal,
                    codigo
                ]);
            } else {
                // Insertar nuevo registro
                const insertQuery = `
                    INSERT INTO TransaccionesRRHH
                    (IdPersonal, NombrePersonal, Codigo, Activo, IdUsuarioAsigno, NombreUsuarioAsigno)
                    VALUES (?, ?, ?, 1, ?, ?)
                `;
                
                await connection.query(insertQuery, [
                    selectedEmployee.IdPersonal,
                    selectedEmployee.NombreCompleto,
                    codigo,
                    currentUser.IdPersonal,
                    currentUser.NombreCompleto || `${currentUser.PrimerNombre} ${currentUser.PrimerApellido}`
                ]);
            }
        }
        
        // Actualizar el campo IngresoSistema en la tabla personal
        const updateIngresoSistemaQuery = `
            UPDATE personal
            SET IngresoSistema = 1
            WHERE IdPersonal = ?
        `;
        
        await connection.query(updateIngresoSistemaQuery, [selectedEmployee.IdPersonal]);
        
        // Verificar que se actualizó correctamente
        const verificacionQuery = `
            SELECT IngresoSistema 
            FROM personal 
            WHERE IdPersonal = ?
        `;
        
        const verificacionResult = await connection.query(verificacionQuery, [selectedEmployee.IdPersonal]);
        const actualizacionExitosa = verificacionResult.length > 0 && verificacionResult[0].IngresoSistema === 1;
        
        await connection.close();
        
        // Ocultar modal y sección de permisos
        confirmModal.classList.remove('active');
        permissionsSection.style.display = 'none';
        
        // Mostrar notificación de éxito
        let mensaje = `Permisos asignados correctamente a ${selectedEmployee.NombreCompleto}`;
        if (actualizacionExitosa) {
            mensaje += " y se ha habilitado su ingreso al sistema";
        }
        
        mostrarNotificacion(mensaje, 'success');
        
        // Limpiar selección
        selectedEmployee = null;
        
        mostrarCargando(false);
        
        // Volver a cargar la búsqueda
        buscarColaboradores();
        
    } catch (error) {
        console.error('Error al guardar permisos:', error);
        mostrarNotificacion('Error al guardar los permisos asignados', 'error');
        mostrarCargando(false);
    }
}

// Cancelar asignación de permisos
function cancelarAsignacion() {
    permissionsSection.style.display = 'none';
    selectedEmployee = null;
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

// Manejar evento Enter en el campo de búsqueda
function manejarEventoEnter(event) {
    if (event.key === 'Enter') {
        buscarColaboradores();
    }
}

// Configurar eventos principales
function configurarEventos() {
    // Botón buscar
    btnBuscar.addEventListener('click', buscarColaboradores);
    
    // Campo de búsqueda - evento Enter
    searchNombre.addEventListener('keypress', manejarEventoEnter);
    
    // Botón cancelar asignación
    btnCancelarAsignacion.addEventListener('click', cancelarAsignacion);
    
    // Botón asignar permisos
    btnAsignarPermisos.addEventListener('click', confirmarAsignacion);
    
    // Botones del modal de confirmación
    confirmAssignBtn.addEventListener('click', guardarPermisos);
    
    cancelConfirmBtn.addEventListener('click', function() {
        confirmModal.classList.remove('active');
    });
    
    closeConfirmModal.addEventListener('click', function() {
        confirmModal.classList.remove('active');
    });
    
    // Cerrar modal al hacer clic fuera
    confirmModal.addEventListener('click', function(event) {
        if (event.target === confirmModal) {
            confirmModal.classList.remove('active');
        }
    });
}

// Inicializar aplicación
async function inicializar() {
    try {
        // Verificar si el usuario tiene sesión activa
        if (!currentUser || !currentUser.IdPersonal) {
            mostrarNotificacion('Su sesión ha expirado. Por favor inicie sesión nuevamente.', 'error');
            setTimeout(() => {
                window.location.href = 'Login.html';
            }, 2000);
            return;
        }
        
        // Cargar departamentos
        await cargarDepartamentos();
        
        // Configurar eventos
        configurarEventos();
        
        // Ocultar inicialmente la sección de permisos
        permissionsSection.style.display = 'none';
        
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        mostrarNotificacion('Error al inicializar la aplicación', 'error');
    }
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    inicializar();
});