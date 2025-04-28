// Importaciones requeridas
const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const Swal = require('sweetalert2');

// Configuración de la conexión
const conexion = 'DSN=recursos2';
const currentUser = JSON.parse(localStorage.getItem('userData'));
let selectedEmployee = null;

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
        const connection = await odbc.connect(conexion);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error de conexión:', error);
        mostrarNotificacion('Error de conexión a la base de datos', 'error');
        throw error;
    }
}

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
    toast.className = `toast toast-${tipo}`;
    
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
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    });
    
    // Auto-cierre después de 5 segundos
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
        
        // Limpiar opciones actuales manteniendo la opción por defecto
        departamentoSelect.innerHTML = '<option value="">Todos los departamentos</option>';
        
        // Agregar cada departamento
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
        
        // Construir la consulta según los filtros
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
        
        // Agregar filtros según los valores ingresados
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
        
        // Ordenar por departamento y nombre
        query += ` ORDER BY departamentos.NombreDepartamento, personal.PrimerNombre`;
        
        const result = await connection.query(query, queryParams);
        await connection.close();
        
        // Actualizar interfaz
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
    // Limpiar lista actual
    resultsList.innerHTML = '';
    
    // Actualizar contador
    const count = colaboradores ? colaboradores.length : 0;
    resultCount.textContent = count;
    
    // Mostrar mensaje vacío o tabla según corresponda
    if (!colaboradores || colaboradores.length === 0) {
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `
            <i class="fas fa-user-slash"></i>
            <p>No se encontraron colaboradores con los filtros aplicados</p>
        `;
        resultsContainer.style.display = 'none';
        return;
    }
    
    // Mostrar tabla de resultados
    emptyState.style.display = 'none';
    resultsContainer.style.display = 'block';
    
    // Agregar cada colaborador a la tabla
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
        
        // Almacenar datos completos en la fila para acceso posterior
        row.dataset.colaborador = JSON.stringify(colaborador);
        
        resultsList.appendChild(row);
    });
    
    // Configurar eventos para los botones de selección
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
    
    // Actualizar la interfaz con los datos del colaborador
    selectedEmployeeName.textContent = colaborador.NombreCompleto;
    selectedEmployeePosition.textContent = `${colaborador.NombrePuesto || 'Sin puesto'} - ${colaborador.NombreDepartamento || 'Sin departamento'}`;
    selectedEmployeeId.textContent = colaborador.IdPersonal;
    selectedEmployeePhoto.src = colaborador.FotoBase64 || '../Imagenes/user-default.png';
    
    // Cargar los permisos disponibles
    cargarPermisos();
    
    // Mostrar la sección de permisos
    permissionsSection.style.display = 'block';
    
    // Hacer scroll a la sección de permisos
    permissionsSection.scrollIntoView({ behavior: 'smooth' });
}

// Cargar los permisos disponibles
// Función cargarPermisos modificada para mostrar un listado simple
async function cargarPermisos() {
    try {
        mostrarCargando(true);
        
        const connection = await getConnection();
        
        // Consulta para obtener todos los permisos
        const permisosQuery = `
            SELECT
                TiposTransaccionesRRHH.Descripcion, 
                TiposTransaccionesRRHH.Codigo
            FROM
                TiposTransaccionesRRHH
            ORDER BY
                TiposTransaccionesRRHH.Descripcion
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
        
        // Crear un array de códigos asignados para facilitar la verificación
        const codigosAsignados = permisosAsignadosResult.map(p => p.Codigo);
        
        // Limpiar lista actual y elementos previos
        permissionsList.innerHTML = '';
        
        // Eliminar elementos previos si existen
        const prevSearch = document.querySelector('.permissions-search');
        if (prevSearch) prevSearch.remove();
        
        const prevActions = document.querySelector('.permissions-select-actions');
        if (prevActions) prevActions.remove();
        
        // Crear un contenedor para las acciones
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'permissions-controls';
        
        // Agregar botones de selección
        const selectActions = document.createElement('div');
        selectActions.className = 'permissions-select-actions';
        
        const btnSelectAll = document.createElement('button');
        btnSelectAll.className = 'btn btn-select-all';
        btnSelectAll.innerHTML = '<i class="fas fa-check-square"></i> Seleccionar Todos';
        btnSelectAll.addEventListener('click', seleccionarTodosPermisos);
        
        const btnDeselectAll = document.createElement('button');
        btnDeselectAll.className = 'btn btn-deselect-all';
        btnDeselectAll.innerHTML = '<i class="fas fa-square"></i> Deseleccionar Todos';
        btnDeselectAll.addEventListener('click', deseleccionarTodosPermisos);
        
        selectActions.appendChild(btnSelectAll);
        selectActions.appendChild(btnDeselectAll);
        
        // Agregar barra de búsqueda
        const searchBar = document.createElement('div');
        searchBar.className = 'permissions-search';
        searchBar.innerHTML = `
            <div class="input-with-icon">
                <i class="fas fa-filter"></i>
                <input type="text" id="permissionsSearch" placeholder="Filtrar permisos...">
            </div>
        `;
        
        // Agregar todo al contenedor principal
        actionsContainer.appendChild(selectActions);
        actionsContainer.appendChild(searchBar);
        
        // Insertar antes de la lista de permisos
        permissionsList.parentNode.insertBefore(actionsContainer, permissionsList);
        
        // Crear contenedor para el listado de permisos
        const permisosContainer = document.createElement('div');
        permisosContainer.className = 'permissions-list-container';
        
        // Ordenar los permisos por código
        permisosResult.sort((a, b) => {
            // Primero por código numérico
            const numA = parseInt(a.Codigo);
            const numB = parseInt(b.Codigo);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            // Si no son numéricos, ordenar por texto
            return a.Codigo.localeCompare(b.Codigo);
        });
        
        // Crear un elemento para cada permiso
        permisosResult.forEach(permiso => {
            const isAssigned = codigosAsignados.includes(permiso.Codigo);
            
            const permissionItem = document.createElement('div');
            permissionItem.className = 'permission-item';
            
            permissionItem.innerHTML = `
                <input type="checkbox" id="perm${permiso.Codigo}" 
                    class="permission-checkbox" 
                    data-codigo="${permiso.Codigo}" 
                    data-descripcion="${permiso.Descripcion}"
                    ${isAssigned ? 'checked' : ''}>
                <label for="perm${permiso.Codigo}" class="permission-label">
                    ${permiso.Descripcion}
                </label>
                <span class="permission-code">${permiso.Codigo}</span>
            `;
            
            permisosContainer.appendChild(permissionItem);
        });
        
        // Agregar contenedor al DOM
        permissionsList.appendChild(permisosContainer);
        
        // Configurar el evento de búsqueda
        const permissionsSearch = document.getElementById('permissionsSearch');
        if (permissionsSearch) {
            permissionsSearch.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const permissionItems = document.querySelectorAll('.permission-item');
                
                // Restablecer la visualización
                permissionItems.forEach(item => {
                    item.classList.remove('match');
                    item.style.display = 'flex';
                });
                
                // No hay término de búsqueda, mostrar todo
                if (!searchTerm) {
                    return;
                }
                
                let itemsVisibles = 0;
                
                // Filtrar los permisos
                permissionItems.forEach(item => {
                    const permissionText = item.querySelector('.permission-label').textContent.toLowerCase();
                    const permissionCode = item.querySelector('.permission-code').textContent.toLowerCase();
                    
                    if (permissionText.includes(searchTerm) || permissionCode.includes(searchTerm)) {
                        item.style.display = 'flex';
                        item.classList.add('match');
                        itemsVisibles++;
                    } else {
                        item.style.display = 'none';
                    }
                });
                
                // Mostrar mensaje si no hay resultados
                if (itemsVisibles === 0) {
                    let noResults = document.querySelector('.no-search-results');
                    if (!noResults) {
                        noResults = document.createElement('div');
                        noResults.className = 'no-search-results';
                        noResults.innerHTML = `
                            <i class="fas fa-search"></i>
                            <p>No se encontraron permisos con el término "${searchTerm}"</p>
                        `;
                        permissionsList.appendChild(noResults);
                    }
                } else {
                    const noResults = document.querySelector('.no-search-results');
                    if (noResults) {
                        noResults.remove();
                    }
                }
            });
        }
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar permisos:', error);
        mostrarNotificacion('Error al cargar la lista de permisos', 'error');
        mostrarCargando(false);
    }
}

// Confirmar asignación de permisos
function confirmarAsignacion() {
    // Obtener los permisos seleccionados
    const permisosSeleccionados = [];
    const checkboxes = permissionsList.querySelectorAll('input[type="checkbox"]:checked');
    
    checkboxes.forEach(checkbox => {
        permisosSeleccionados.push({
            codigo: checkbox.dataset.codigo,
            descripcion: checkbox.dataset.descripcion
        });
    });
    
    if (permisosSeleccionados.length === 0) {
        mostrarNotificacion('Debe seleccionar al menos un permiso para asignar', 'warning');
        return;
    }
    
    // Llenar el resumen de permisos en el modal
    permissionsSummary.innerHTML = '';
    
    permisosSeleccionados.forEach(permiso => {
        const summaryItem = document.createElement('div');
        summaryItem.className = 'summary-item';
        summaryItem.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${permiso.descripcion}</span>
            <span class="summary-code">${permiso.codigo}</span>
        `;
        
        permissionsSummary.appendChild(summaryItem);
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
    // Ocultar sección de permisos
    permissionsSection.style.display = 'none';
    // Limpiar selección
    selectedEmployee = null;
    
    // Hacer scroll a la sección de resultados
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

// Manejar evento Enter en el campo de búsqueda
function manejarEventoEnter(event) {
    if (event.key === 'Enter') {
        buscarColaboradores();
    }
}

// Configurar eventos
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
    
    // Seleccionar todo/ninguno
    const btnSelectAll = document.createElement('button');
    btnSelectAll.className = 'btn btn-select-all';
    btnSelectAll.innerHTML = '<i class="fas fa-check-square"></i> Seleccionar Todos';
    btnSelectAll.addEventListener('click', seleccionarTodosPermisos);
    
    const btnDeselectAll = document.createElement('button');
    btnDeselectAll.className = 'btn btn-deselect-all';
    btnDeselectAll.innerHTML = '<i class="fas fa-square"></i> Deseleccionar Todos';
    btnDeselectAll.addEventListener('click', deseleccionarTodosPermisos);
    
    // Agregar botones antes de la lista de permisos
    const btnsContainer = document.createElement('div');
    btnsContainer.className = 'permissions-select-actions';
    btnsContainer.appendChild(btnSelectAll);
    btnsContainer.appendChild(btnDeselectAll);
    
    // Insertar antes de la lista de permisos
    permissionsList.parentNode.insertBefore(btnsContainer, permissionsList);
}

// Seleccionar todos los permisos
function seleccionarTodosPermisos() {
    const checkboxes = permissionsList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
    });
}

// Deseleccionar todos los permisos
function deseleccionarTodosPermisos() {
    const checkboxes = permissionsList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
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

// Filtrar permisos por búsqueda
function configurarBusquedaPermisos() {
    const searchBar = document.createElement('div');
    searchBar.className = 'permissions-search';
    searchBar.innerHTML = `
        <div class="input-with-icon">
            <i class="fas fa-filter"></i>
            <input type="text" id="permissionsSearch" placeholder="Buscar permisos...">
        </div>
    `;
    
    // Insertar antes de la lista de permisos
    permissionsList.parentNode.insertBefore(searchBar, permissionsList);
    
    // Configurar el evento de búsqueda
    const permissionsSearch = document.getElementById('permissionsSearch');
    permissionsSearch.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const permissionItems = permissionsList.querySelectorAll('.permission-item');
        
        permissionItems.forEach(item => {
            const permissionText = item.querySelector('.permission-label').textContent.toLowerCase();
            const permissionCode = item.querySelector('.permission-code').textContent.toLowerCase();
            
            if (permissionText.includes(searchTerm) || permissionCode.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

// Añadir estilos para la búsqueda de permisos y botones adicionales
function agregarEstilosAdicionales() {
    const style = document.createElement('style');
    style.textContent = `
        .permissions-select-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .btn-select-all, .btn-deselect-all {
            background-color: var(--color-light);
            color: var(--color-dark);
            border: 1px solid rgba(0, 0, 0, 0.1);
            padding: 8px 12px;
            font-size: 0.9rem;
        }
        
        .btn-select-all:hover, .btn-deselect-all:hover {
            background-color: rgba(78, 119, 229, 0.1);
        }
        
        .permissions-search {
            margin-bottom: 15px;
        }
        
        .permissions-search input {
            width: 100%;
            padding: 10px 10px 10px 35px;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: var(--border-radius);
            font-size: 0.95rem;
        }
        
        .highlight-animation {
            animation: pulse 1s ease-in-out;
        }
        
        .permission-item.match {
            background-color: rgba(255, 184, 69, 0.2);
        }
    `;
    
    document.head.appendChild(style);
}

// Mejorar el módulo para mostrar los permisos en categorías
function organizarPermisosPorCategoria() {
    // Configurar y agregar al inicializar
    document.addEventListener('DOMContentLoaded', function() {
        agregarEstilosAdicionales();
        setTimeout(() => {
            configurarBusquedaPermisos();
        }, 500);
    });
}

// Escuchar por cambios en el DOM para configurar búsqueda cuando el permissionsList cambie
function observarCambiosDOM() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && 
                mutation.target.id === 'permissionsList' && 
                mutation.addedNodes.length > 0 &&
                !document.getElementById('permissionsSearch')) {
                
                setTimeout(() => {
                    configurarBusquedaPermisos();
                }, 100);
            }
        });
    });
    
    // Iniciar la observación del DOM
    if (permissionsList) {
        observer.observe(permissionsList.parentNode, { childList: true, subtree: true });
    }
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    inicializar();
    observarCambiosDOM();
    organizarPermisosPorCategoria();
});