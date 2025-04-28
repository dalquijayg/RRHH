// Configuración e inicialización
const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const Swal = require('sweetalert2');
const conexion = 'DSN=recursos2';

// Variables globales
let currentPage = 1;
let totalPages = 1;
let itemsPerPage = 12;
let currentView = 'grid';
let allEmployees = [];
let filteredEmployees = [];
let filtersCollapsed = false;

// Obtener datos del usuario de localStorage
const userData = JSON.parse(localStorage.getItem('userData'));

// Referencias a elementos DOM
const searchText = document.getElementById('searchText');
const departamentoFilter = document.getElementById('departamentoFilter');
const tipoPersonalFilter = document.getElementById('tipoPersonalFilter');
const estadoFilter = document.getElementById('estadoFilter');
const searchButton = document.getElementById('searchButton');
const resetFiltersButton = document.getElementById('resetFilters');
const clearSearchButton = document.getElementById('clearSearch');
const resultsCount = document.getElementById('resultsCount');
const gridView = document.getElementById('gridView');
const tableView = document.getElementById('tableView');
const tableResults = document.getElementById('tableResults');
const loadingIndicator = document.getElementById('loadingIndicator');
const noResults = document.getElementById('noResults');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');
const employeeModal = document.getElementById('employeeModal');
const btnBack = document.getElementById('btnVolver');
const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
const filtersToggle = document.getElementById('filtersToggle');
const filtersContainer = document.getElementById('filtersContainer');
const filtersSummary = document.getElementById('filtersSummary');
const photoViewer = document.getElementById('photoViewer');
const photoViewerImage = document.getElementById('photoViewerImage');
const photoViewerName = document.getElementById('photoViewerName');
const closePhotoViewer = document.getElementById('closePhotoViewer');

// Inicializar conexión con la base de datos
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
function abrirVisorFoto(src, nombre) {
    photoViewerImage.src = src;
    photoViewerName.textContent = nombre;
    photoViewer.classList.add('show');
    
    // Evitar que se desplace la página mientras el visor está abierto
    document.body.style.overflow = 'hidden';
}

// Función para cerrar el visor de fotos
function cerrarVisorFoto() {
    photoViewer.classList.remove('show');
    
    // Restaurar el desplazamiento de la página
    document.body.style.overflow = '';
}
// Cargar datos de departamentos
async function cargarDepartamentos() {
    try {
        const connection = await getConnection();
        const result = await connection.query(`
            SELECT IdDepartamento, NombreDepartamento
            FROM departamentos
            ORDER BY NombreDepartamento
        `);
        await connection.close();
        
        // Agregar opciones al select
        let options = '<option value="0">Todos</option>';
        result.forEach(depto => {
            options += `<option value="${depto.IdDepartamento}">${depto.NombreDepartamento}</option>`;
        });
        
        departamentoFilter.innerHTML = options;
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarNotificacion('Error al cargar departamentos', 'error');
    }
}

// Cargar tipos de personal
async function cargarTiposPersonal() {
    try {
        const connection = await getConnection();
        const result = await connection.query(`
            SELECT IdTipo, TipoPersonal
            FROM TipoPersonal
            ORDER BY IdTipo
        `);
        await connection.close();
        
        // Agregar opciones al select
        let options = '<option value="0">Todos</option>';
        result.forEach(tipo => {
            options += `<option value="${tipo.IdTipo}">${tipo.TipoPersonal}</option>`;
        });
        
        tipoPersonalFilter.innerHTML = options;
    } catch (error) {
        console.error('Error al cargar tipos de personal:', error);
        mostrarNotificacion('Error al cargar tipos de personal', 'error');
    }
}
async function cargarEstadosPersonal() {
    try {
        const connection = await getConnection();
        const result = await connection.query(`
            SELECT IdEstado, EstadoPersonal
            FROM EstadoPersonal
            ORDER BY IdEstado
        `);
        await connection.close();
        
        // Agregar opciones al select
        let options = '<option value="0">Todos</option>';
        result.forEach(estado => {
            // Valor por defecto: si es IdEstado=1 (asumiendo que es "Activo"), seleccionarlo
            const selected = estado.IdEstado === 1 ? 'selected' : '';
            options += `<option value="${estado.IdEstado}" ${selected}>${estado.EstadoPersonal}</option>`;
        });
        
        estadoFilter.innerHTML = options;
    } catch (error) {
        console.error('Error al cargar estados de personal:', error);
        mostrarNotificacion('Error al cargar estados de personal', 'error');
    }
}
// Función para realizar la búsqueda
async function buscarPersonal() {
    mostrarCargando(true);
    
    try {
        const connection = await getConnection();
        
        // Obtener los valores de los filtros
        const searchTermValue = searchText.value.trim();
        const departamentoValue = departamentoFilter.value;
        const tipoPersonalValue = tipoPersonalFilter.value;
        const estadoValue = estadoFilter.value;
        
        // Construir la consulta SQL base
        let query = `
                    SELECT
                        personal.IdPersonal, 
                        CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto, 
                        departamentos.NombreDepartamento, 
                        PuestosGenerales.Nombre AS Puesto,
                        estadocivil.EstadoCivil, 
                        TipoPersonal.TipoPersonal, 
                        IFNULL(planillas.Nombre_Planilla, 'Sin Planilla') AS Nombre_Planilla,
                        IFNULL(personal.FechaContrato, 'No asignado') AS FechaContrato, 
                        IFNULL(personal.FechaPlanilla, 'No asignado') AS FechaPlanilla,
                        IFNULL(personal.InicioLaboral, 'No asignado') AS InicioLaboral,
                        EstadoPersonal.EstadoPersonal,
                        personal.Estado as EstadoId,
                        personal.DPI,
                        personal.FechaNacimiento,
                        personal.IdDepartamentoOrigen,
                        personal.IdMunicipioOrigen,
                        personal.Hijos,
                        personal.DireccionRecidencia,
                        personal.IdDepartamentoG,
                        personal.IdMunicipioG,
                        personal.Telefono1,
                        personal.Telefono2,
                        personal.CorreoElectronico,
                        personal.NombreContactoEmergencia,
                        personal.TelefonoContactoEmergencia,
                        personal.IdParentesco,
                        parentesco.Parentesco AS ParentescoEmergencia,
                        deptoOrigen.NombreDepartamento AS DepartamentoOrigen,
                        muniOrigen.NombreMunicipio AS MunicipioOrigen,
                        deptoResidencia.NombreDepartamento AS DepartamentoResidencia,
                        muniResidencia.NombreMunicipio AS MunicipioResidencia,
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
                        LEFT JOIN estadocivil ON personal.IdEstadoCivil = estadocivil.IdCivil
                        LEFT JOIN TipoPersonal ON personal.TipoPersonal = TipoPersonal.IdTipo
                        LEFT JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
                        INNER JOIN EstadoPersonal ON personal.Estado = EstadoPersonal.IdEstado
                        LEFT JOIN departamentosguatemala deptoOrigen ON personal.IdDepartamentoOrigen = deptoOrigen.IdDepartamentoG
                        LEFT JOIN municipios muniOrigen ON personal.IdMunicipioOrigen = muniOrigen.IdMunicipio
                        LEFT JOIN departamentosguatemala deptoResidencia ON personal.IdDepartamentoG = deptoResidencia.IdDepartamentoG
                        LEFT JOIN municipios muniResidencia ON personal.IdMunicipioG = muniResidencia.IdMunicipio
                        LEFT JOIN parentesco ON personal.IdParentesco = parentesco.IdParentesco
                    WHERE 1=1
        `;
        
        // Añadir condiciones según los filtros
        const params = [];
        
        if (estadoValue != 0) {
            query += " AND personal.Estado = ?";
            params.push(Number(estadoValue));
        }
        
        if (tipoPersonalValue != 0) {
            query += " AND personal.TipoPersonal = ?";
            params.push(Number(tipoPersonalValue));
        }
        
        if (departamentoValue != 0) {
            query += " AND personal.IdSucuDepa = ?";
            params.push(Number(departamentoValue));
        }
        
        if (searchTermValue) {
            query += " AND (CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) LIKE ? OR personal.DPI LIKE ?)";
            params.push(`%${searchTermValue}%`, `%${searchTermValue}%`);
        }
        
        query += " ORDER BY NombreCompleto";
        
        const result = await connection.query(query, params);
        await connection.close();
        
        // Procesar los resultados
        allEmployees = result.map(employee => {
            // Calcular edad
            let edad = 'No registrada';
            if (employee.FechaNacimiento) {
                const fechaNac = new Date(employee.FechaNacimiento);
                const hoy = new Date();
                edad = hoy.getFullYear() - fechaNac.getFullYear();
                const m = hoy.getMonth() - fechaNac.getMonth();
                if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
                    edad--;
                }
                edad = `${edad} años`;
            }
            
            // Calcular tiempo trabajado
            let tiempoTrabajado = 'No registrado';
            if (employee.InicioLaboral) {
                const fechaInicio = new Date(employee.InicioLaboral);
                const hoy = new Date();
                let años = hoy.getFullYear() - fechaInicio.getFullYear();
                const m = hoy.getMonth() - fechaInicio.getMonth();
                if (m < 0 || (m === 0 && hoy.getDate() < fechaInicio.getDate())) {
                    años--;
                }
                
                // Si es menos de un año, mostrar en meses
                if (años < 1) {
                    let meses = hoy.getMonth() - fechaInicio.getMonth();
                    if (meses < 0) meses += 12;
                    if (hoy.getDate() < fechaInicio.getDate()) {
                        meses--;
                    }
                    tiempoTrabajado = `${meses} meses`;
                } else {
                    tiempoTrabajado = `${años} años`;
                }
            }
            
            return {
                id: employee.IdPersonal,
                nombre: employee.NombreCompleto,
                departamento: employee.NombreDepartamento,
                puesto: employee.Puesto,
                estadoCivil: employee.EstadoCivil,
                tipoPersonal: employee.TipoPersonal,
                planilla: employee.Nombre_Planilla,
                fechaContrato: employee.FechaContrato,
                fechaPlanilla: employee.FechaPlanilla,
                inicioLaboral: employee.InicioLaboral ? new Date(employee.InicioLaboral).toLocaleDateString() : 'No registrado',
                tiempoTrabajado: tiempoTrabajado,
                estado: employee.EstadoPersonal,
                estadoId: employee.EstadoId,
                dpi: employee.DPI || 'No registrado',
                fechaNacimiento: employee.FechaNacimiento ? new Date(employee.FechaNacimiento).toLocaleDateString() : 'No registrado',
                edad: edad,
                departamentoOrigen: employee.DepartamentoOrigen || 'No especificado',
                municipioOrigen: employee.MunicipioOrigen || 'No especificado',
                hijos: employee.Hijos > 0 ? employee.Hijos : 'No tiene',
                direccionResidencia: employee.DireccionRecidencia || 'No registrada',
                departamentoResidencia: employee.DepartamentoResidencia || 'No especificado',
                municipioResidencia: employee.MunicipioResidencia || 'No especificado',
                telefono1: employee.Telefono1 || 'No registrado',
                telefono2: employee.Telefono2 || 'No registrado',
                correoElectronico: employee.CorreoElectronico || 'No registrado',
                nombreContactoEmergencia: employee.NombreContactoEmergencia || 'No registrado',
                telefonoContactoEmergencia: employee.TelefonoContactoEmergencia || 'No registrado',
                parentescoEmergencia: employee.ParentescoEmergencia || 'No especificado',
                foto: employee.FotoBase64 || '../Imagenes/user-default.png'
            };
        });
        
        // Actualizar la UI
        filteredEmployees = [...allEmployees];
        
        // Crear resumen de filtros aplicados para mostrar cuando el acordeón esté colapsado
        actualizarResumenFiltros(searchTermValue, departamentoValue, tipoPersonalValue, estadoValue);
        
        // Colapsar los filtros después de buscar (en pantallas pequeñas)
        if (window.innerWidth < 768) {
            colapsarFiltros(true);
        }
        
        actualizarResultados();
        mostrarCargando(false);
        
        // Mostrar notificación
        mostrarNotificacion(`Se encontraron ${allEmployees.length} empleados`, 'success');
        
    } catch (error) {
        console.error('Error al buscar personal:', error);
        mostrarNotificacion('Error al buscar personal', 'error');
        mostrarCargando(false);
    }
}

// Actualiza el resumen de filtros para mostrar cuando el acordeón está colapsado
function actualizarResumenFiltros(searchTerm, departamento, tipoPersonal, estado) {
    const tags = [];
    
    if (searchTerm) {
        tags.push(`<span class="filter-tag">Buscar: <b>${searchTerm}</b></span>`);
    }
    
    if (departamento != 0) {
        const deptoText = departamentoFilter.options[departamentoFilter.selectedIndex].text;
        tags.push(`<span class="filter-tag">Depto: <b>${deptoText}</b></span>`);
    }
    
    if (tipoPersonal != 0) {
        const tipoText = tipoPersonalFilter.options[tipoPersonalFilter.selectedIndex].text;
        tags.push(`<span class="filter-tag">Tipo: <b>${tipoText}</b></span>`);
    }
    
    if (estado != 0) {
        const estadoText = estadoFilter.options[estadoFilter.selectedIndex].text;
        tags.push(`<span class="filter-tag">Estado: <b>${estadoText}</b></span>`);
    }
    
    if (tags.length > 0) {
        filtersSummary.innerHTML = tags.join('');
        filtersSummary.style.display = 'flex';
    } else {
        filtersSummary.style.display = 'none';
    }
}

// Función para colapsar/expandir los filtros
function colapsarFiltros(colapsar) {
    const searchFilters = document.querySelector('.search-filters');
    
    if (colapsar) {
        searchFilters.classList.add('collapsed');
        filtersCollapsed = true;
    } else {
        searchFilters.classList.remove('collapsed');
        filtersCollapsed = false;
    }
}

// Función para mostrar/ocultar el indicador de carga
function mostrarCargando(mostrar) {
    if (mostrar) {
        loadingIndicator.style.display = 'flex';
        gridView.style.display = 'none';
        tableView.style.display = 'none';
        noResults.style.display = 'none';
    } else {
        loadingIndicator.style.display = 'none';
    }
}

// Actualizar resultados según los filtros actuales
function actualizarResultados() {
    // Actualizar contadores
    resultsCount.textContent = filteredEmployees.length;
    
    // Calcular paginación
    totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
    if (currentPage > totalPages) {
        currentPage = 1;
    }
    
    // Actualizar información de paginación
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
    
    // Habilitar/deshabilitar botones de paginación
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    // Obtener elementos para la página actual
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredEmployees.length);
    const currentItems = filteredEmployees.slice(startIndex, endIndex);
    
    // Mostrar resultados según la vista actual
    if (filteredEmployees.length === 0) {
        noResults.style.display = 'flex';
        gridView.style.display = 'none';
        tableView.style.display = 'none';
    } else {
        noResults.style.display = 'none';
        
        if (currentView === 'grid') {
            renderizarGridView(currentItems);
            gridView.style.display = 'grid';
            tableView.style.display = 'none';
        } else {
            renderizarTableView(currentItems);
            gridView.style.display = 'none';
            tableView.style.display = 'block';
        }
    }
}

// Renderizar vista de tarjetas
function renderizarGridView(empleados) {
    let html = '';
    
    empleados.forEach(empleado => {
        html += `
            <div class="employee-card" data-id="${empleado.id}">
                <div class="card-status ${empleado.estadoId === 1 ? 'status-active' : 'status-inactive'}">
                    ${empleado.estado}
                </div>
                <div class="card-photo">
                    <img src="${empleado.foto}" alt="${empleado.nombre}" onerror="this.src='../Imagenes/user-default.png'">
                </div>
                <div class="card-info">
                    <h3 class="card-name">${empleado.nombre}</h3>
                    <div class="card-position">${empleado.puesto} - ${empleado.departamento}</div>
                    <div class="card-details">
                        <div class="card-detail-item">
                            <span class="detail-label">Tipo:</span>
                            <span class="detail-value">${empleado.tipoPersonal}</span>
                        </div>
                        <div class="card-detail-item">
                            <span class="detail-label">Planilla:</span>
                            <span class="detail-value">${empleado.planilla}</span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="card-btn view-btn" title="Ver detalles" onclick="mostrarDetallesEmpleado(${empleado.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="card-btn edit-btn" title="Editar empleado" onclick="editarEmpleado(${empleado.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    gridView.innerHTML = html;
}

// Renderizar vista de tabla
function renderizarTableView(empleados) {
    let html = '';
    
    empleados.forEach(empleado => {
        html += `
            <tr data-id="${empleado.id}">
                <td>
                    <img src="${empleado.foto}" alt="${empleado.nombre}" class="table-img" onerror="this.src='../Imagenes/user-default.png'">
                </td>
                <td>
                    <div class="table-name">${empleado.nombre}</div>
                </td>
                <td>${empleado.departamento}</td>
                <td>${empleado.puesto}</td>
                <td>${empleado.tipoPersonal}</td>
                <td>${empleado.planilla}</td>
                <td>
                    <span class="table-status ${empleado.estadoId === 1 ? 'status-active' : 'status-inactive'}">
                        ${empleado.estado}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="table-btn view-btn" title="Ver detalles" onclick="mostrarDetallesEmpleado(${empleado.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="table-btn edit-btn" title="Editar empleado" onclick="editarEmpleado(${empleado.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableResults.innerHTML = html;
}
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Desactivar todas las pestañas
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Activar la pestaña seleccionada
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}
// Mostrar detalles de un empleado
async function mostrarDetallesEmpleado(id) {
    // Encuentra el empleado en la lista (código existente)
    const empleado = filteredEmployees.find(emp => emp.id === id);
    
    if (!empleado) {
        mostrarNotificacion('Empleado no encontrado', 'error');
        return;
    }
    
    // Actualizar el modal con los datos del empleado (código existente)
    document.getElementById('modalEmployeePhoto').src = empleado.foto;
    document.getElementById('modalEmployeeName').textContent = empleado.nombre;
    document.getElementById('modalEmployeePosition').textContent = empleado.puesto;
    document.getElementById('modalEmployeeDepartment').textContent = empleado.departamento;
    
    const statusBadge = document.getElementById('modalEmployeeStatus');
    statusBadge.textContent = empleado.estado;
    statusBadge.className = `status-badge ${empleado.estadoId === 1 ? '' : 'inactive'}`;
    
    // Información Personal
    document.getElementById('modalEmployeeId').textContent = empleado.id;
    document.getElementById('modalEmployeeDpi').textContent = empleado.dpi;
    document.getElementById('modalEmployeeCivilStatus').textContent = empleado.estadoCivil;
    document.getElementById('modalEmployeeBirthdate').textContent = empleado.fechaNacimiento;
    document.getElementById('modalEmployeeAge').textContent = empleado.edad;
    document.getElementById('modalEmployeeChildren').textContent = empleado.hijos;
    
    // Lugar de Origen
    document.getElementById('modalEmployeeOriginDept').textContent = empleado.departamentoOrigen;
    document.getElementById('modalEmployeeOriginMuni').textContent = empleado.municipioOrigen;
    
    // Residencia Actual
    document.getElementById('modalEmployeeAddress').textContent = empleado.direccionResidencia;
    document.getElementById('modalEmployeeResidenceDept').textContent = empleado.departamentoResidencia;
    document.getElementById('modalEmployeeResidenceMuni').textContent = empleado.municipioResidencia;
    
    // Información de Contacto
    document.getElementById('modalEmployeePhone1').textContent = empleado.telefono1;
    document.getElementById('modalEmployeePhone2').textContent = empleado.telefono2;
    document.getElementById('modalEmployeeEmail').textContent = empleado.correoElectronico;
    
    // Contacto de Emergencia
    document.getElementById('modalEmergencyContact').textContent = empleado.nombreContactoEmergencia;
    document.getElementById('modalEmergencyPhone').textContent = empleado.telefonoContactoEmergencia;
    document.getElementById('modalEmergencyRelationship').textContent = empleado.parentescoEmergencia;
    
    // Información Laboral
    document.getElementById('modalEmployeeType').textContent = empleado.tipoPersonal;
    document.getElementById('modalEmployeePayroll').textContent = empleado.planilla;
    document.getElementById('modalEmployeeStartDate').textContent = empleado.inicioLaboral;
    document.getElementById('modalEmployeeWorkTime').textContent = empleado.tiempoTrabajado;
    document.getElementById('modalEmployeeContractDate').textContent = empleado.fechaContrato;
    document.getElementById('modalEmployeePayrollDate').textContent = empleado.fechaPlanilla;
    
    // NUEVO: Cargar información académica
    try {
        const datosAcademicos = await cargarInfoAcademica(empleado.id);
        mostrarDatosAcademicos(datosAcademicos);
    } catch (error) {
        console.error('Error al cargar datos académicos:', error);
    }
    
    // NUEVO: Cargar resultados PMA
    try {
        const datosPMA = await cargarResultadosPMA(empleado.id);
        mostrarResultadosPMA(datosPMA);
    } catch (error) {
        console.error('Error al cargar resultados PMA:', error);
    }
    
    // Mostrar el modal
    employeeModal.classList.add('show');
    initTabs();
}
document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        employeeModal.classList.remove('show');
    });
});

// Si el usuario hace clic fuera del modal, cerrar el modal
employeeModal.addEventListener('click', event => {
    if (event.target === employeeModal) {
        employeeModal.classList.remove('show');
    }
});
document.getElementById('modalEmployeePhoto').addEventListener('click', function() {
    const fotoSrc = this.src;
    const nombreEmpleado = document.getElementById('modalEmployeeName').textContent;
    abrirVisorFoto(fotoSrc, nombreEmpleado);
});
// Editar empleado
function editarEmpleado(id) {
    // Esto se implementará más adelante o puede redirigir a otra pantalla
    window.location.href = `Editar.html?id=${id}`;
}

// Función para mostrar notificaciones
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

// Resetear filtros
function resetearFiltros() {
    searchText.value = '';
    departamentoFilter.value = '0';
    tipoPersonalFilter.value = '0';
    estadoFilter.value = '1'; // Por defecto, filtrar por empleados activos
    
    // Si los filtros estaban colapsados, expandirlos
    if (filtersCollapsed) {
        colapsarFiltros(false);
    }
    
    // En su lugar, mostrar instrucciones
    mostrarInstruccionesBusqueda();
    
    // Mostrar notificación
    mostrarNotificacion('Filtros restablecidos', 'info');
}

// Limpiar campo de búsqueda
function limpiarBusqueda() {
    searchText.value = '';
    searchText.focus();
}
// Función para cargar la información académica
async function cargarInfoAcademica(idPersonal) {
    try {
        const connection = await getConnection();
        const query = `
            SELECT
                -- Información de Primaria
                ee1.DescripcionEstado AS EstadoPrimaria, 
                pe1.Plan AS PlanPrimaria, 
                s1.Semestre AS NivelPrimaria,

                -- Información de Básico
                ee2.DescripcionEstado AS EstadoBasico, 
                pe2.Plan AS PlanBasico, 
                s2.Semestre AS NivelBasico,
                    
                -- Información de Diversificado
                ee3.DescripcionEstado AS EstadoDiversificado,
                pe3.Plan AS PlanDiversificado,
                s3.Semestre AS NivelDiversificado,
                ga3.GradoAcademico AS GradoAcademico,
                
                -- Información de Universidad
                ee4.DescripcionEstado as EstadoUniversidad,
                pe4.Plan AS PlanUniversitario,
                s4.Semestre AS NivelUniversidad,
                cu4.NombreCarrera as CarrerasUniversitarias,
                u4.NombreUniversidad AS Universidad,
                
                -- Información de Maestría
                ee5.DescripcionEstado AS EstadoMaestria,
                pe5.Plan AS NivelMaestria,
                t5.Trimestre AS Trimestrecursando,
                m5.NombreMaestria AS Maestria,
                u5.NombreUniversidad AS UniversidadMaestria
            FROM
                InfoAcademica
                -- Relacionando datos de Primaria
                LEFT JOIN EstadosEducacion ee1 ON InfoAcademica.EstadoPrimaria = ee1.IdEstadoEducacion
                LEFT JOIN planestudios pe1 ON InfoAcademica.IdPlanEstudioPrimaria = pe1.IdPlanEstudio
                LEFT JOIN semestres s1 ON InfoAcademica.IdNivelAcademicoPrimaria = s1.Id_semestre

                -- Relacionando datos de Básico
                LEFT JOIN EstadosEducacion ee2 ON InfoAcademica.EstadoBasico = ee2.IdEstadoEducacion
                LEFT JOIN planestudios pe2 ON InfoAcademica.IdPlanEstudioBasico = pe2.IdPlanEstudio
                LEFT JOIN semestres s2 ON InfoAcademica.IdNivelAcademicoBasico = s2.Id_semestre
                
                -- Relacionando datos de Diversificado
                LEFT JOIN EstadosEducacion ee3 ON InfoAcademica.EstadoDiversificado = ee3.IdEstadoEducacion
                LEFT JOIN planestudios pe3 ON InfoAcademica.IdPlanEstudioDiversificado = pe3.IdPlanEstudio
                LEFT JOIN semestres s3 ON InfoAcademica.IdNivelAcademicoDiversificado = s3.Id_semestre
                LEFT JOIN GradosAcademicos ga3 ON InfoAcademica.IdCarreraDiversificado = ga3.IdGrado
                
                -- Relacionando datos de Universidades
                LEFT JOIN EstadosEducacion ee4 ON InfoAcademica.EstadoUniversidad = ee4.IdEstadoEducacion
                LEFT JOIN planestudios pe4 ON InfoAcademica.IdPlanEstudioUniversitario = pe4.IdPlanEstudio
                LEFT JOIN semestres s4 ON InfoAcademica.IdNivelAcademicoUnivesitario = s4.Id_semestre
                LEFT JOIN CarrerasUniversitarias cu4 ON InfoAcademica.IdCarreraUniversitaria = cu4.IdCarreraUniversitaria
                LEFT JOIN Universidades u4 ON InfoAcademica.IdUniversidad = u4.IdUniversidad
                
                -- Relacionando datos de Maestrías
                LEFT JOIN EstadosEducacion ee5 ON InfoAcademica.EstadoMaestria = ee5.IdEstadoEducacion
                LEFT JOIN planestudios pe5 ON InfoAcademica.IdPlanEstudio = pe5.IdPlanEstudio
                LEFT JOIN Trimestres t5 ON InfoAcademica.IdNivelAcademicoMaestria = t5.IdTrimestre
                LEFT JOIN Maestrias m5 ON InfoAcademica.IdMaestria = m5.IdMaestria
                LEFT JOIN Universidades u5 ON InfoAcademica.IdUniversidadMaestria = u5.IdUniversidad
                    
            WHERE
                InfoAcademica.IdPersonal = ?
        `;
        
        const result = await connection.query(query, [idPersonal]);
        await connection.close();
        
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        console.error('Error al cargar información académica:', error);
        mostrarNotificacion('Error al cargar información académica', 'error');
        return null;
    }
}

// Función para cargar resultados PMA
async function cargarResultadosPMA(idPersonal) {
    try {
        const connection = await getConnection();
        const query = `
            SELECT
                ResultadosPMA.FactorV, 
                ResultadosPMA.FactorE, 
                ResultadosPMA.FactorR, 
                ResultadosPMA.FactorN, 
                ResultadosPMA.FactorF, 
                ResultadosPMA.FechaEvaluacion
            FROM
                ResultadosPMA
            WHERE
                ResultadosPMA.IdPersonal = ?
            ORDER BY
                ResultadosPMA.FechaEvaluacion DESC
            LIMIT 1
        `;
        
        const result = await connection.query(query, [idPersonal]);
        await connection.close();
        
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        console.error('Error al cargar resultados PMA:', error);
        mostrarNotificacion('Error al cargar resultados PMA', 'error');
        return null;
    }
}

// Función para verificar si una sección tiene datos
function seccionTieneDatos(datos, prefijo) {
    const campos = Object.keys(datos).filter(key => key.startsWith(prefijo));
    return campos.some(campo => datos[campo] !== null && datos[campo] !== undefined);
}

// Función para mostrar datos académicos en el modal
function mostrarDatosAcademicos(datosAcademicos) {
    if (!datosAcademicos) {
        console.log('No hay datos académicos disponibles');
        // Ocultar todas las secciones académicas si no hay datos
        document.querySelectorAll('#tab-academic .details-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // Mostrar mensaje de no hay datos
        const noDataMsg = document.createElement('div');
        noDataMsg.className = 'no-data-message';
        noDataMsg.innerHTML = '<i class="fas fa-info-circle"></i> No hay información académica registrada para este colaborador.';
        document.querySelector('#tab-academic').appendChild(noDataMsg);
        return;
    }
    
    // Primaria - Verificar si hay datos
    const primariaTieneDatos = datosAcademicos.EstadoPrimaria || datosAcademicos.PlanPrimaria || datosAcademicos.NivelPrimaria;
    const seccionPrimaria = document.querySelector('#tab-academic .details-section:nth-child(1)');
    
    if (primariaTieneDatos) {
        seccionPrimaria.style.display = 'block';
        document.getElementById('modalPrimariaEstado').textContent = datosAcademicos.EstadoPrimaria || 'No registrado';
        document.getElementById('modalPrimariaPlan').textContent = datosAcademicos.PlanPrimaria || 'No registrado';
        document.getElementById('modalPrimariaNivel').textContent = datosAcademicos.NivelPrimaria || 'No registrado';
    } else {
        seccionPrimaria.style.display = 'none';
    }
    
    // Básico
    const basicoTieneDatos = datosAcademicos.EstadoBasico || datosAcademicos.PlanBasico || datosAcademicos.NivelBasico;
    const seccionBasico = document.querySelector('#tab-academic .details-section:nth-child(2)');
    
    if (basicoTieneDatos) {
        seccionBasico.style.display = 'block';
        document.getElementById('modalBasicoEstado').textContent = datosAcademicos.EstadoBasico || 'No registrado';
        document.getElementById('modalBasicoPlan').textContent = datosAcademicos.PlanBasico || 'No registrado';
        document.getElementById('modalBasicoNivel').textContent = datosAcademicos.NivelBasico || 'No registrado';
    } else {
        seccionBasico.style.display = 'none';
    }
    
    // Diversificado
    const diversificadoTieneDatos = datosAcademicos.EstadoDiversificado || datosAcademicos.PlanDiversificado || 
                                  datosAcademicos.NivelDiversificado || datosAcademicos.GradoAcademico;
    const seccionDiversificado = document.querySelector('#tab-academic .details-section:nth-child(3)');
    
    if (diversificadoTieneDatos) {
        seccionDiversificado.style.display = 'block';
        document.getElementById('modalDiversificadoEstado').textContent = datosAcademicos.EstadoDiversificado || 'No registrado';
        document.getElementById('modalDiversificadoPlan').textContent = datosAcademicos.PlanDiversificado || 'No registrado';
        document.getElementById('modalDiversificadoNivel').textContent = datosAcademicos.NivelDiversificado || 'No registrado';
        document.getElementById('modalDiversificadoGrado').textContent = datosAcademicos.GradoAcademico || 'No registrado';
    } else {
        seccionDiversificado.style.display = 'none';
    }
    
    // Universidad
    const universidadTieneDatos = datosAcademicos.EstadoUniversidad || datosAcademicos.PlanUniversitario || 
                                datosAcademicos.NivelUniversidad || datosAcademicos.Universidad || 
                                datosAcademicos.CarrerasUniversitarias;
    const seccionUniversidad = document.querySelector('#tab-academic .details-section:nth-child(4)');
    
    if (universidadTieneDatos) {
        seccionUniversidad.style.display = 'block';
        document.getElementById('modalUniversidadEstado').textContent = datosAcademicos.EstadoUniversidad || 'No registrado';
        document.getElementById('modalUniversidadPlan').textContent = datosAcademicos.PlanUniversitario || 'No registrado';
        document.getElementById('modalUniversidadNivel').textContent = datosAcademicos.NivelUniversidad || 'No registrado';
        document.getElementById('modalUniversidadNombre').textContent = datosAcademicos.Universidad || 'No registrado';
        document.getElementById('modalUniversidadCarrera').textContent = datosAcademicos.CarrerasUniversitarias || 'No registrado';
    } else {
        seccionUniversidad.style.display = 'none';
    }
    
    // Maestría
    const maestriaTieneDatos = datosAcademicos.EstadoMaestria || datosAcademicos.NivelMaestria || 
                             datosAcademicos.Trimestrecursando || datosAcademicos.UniversidadMaestria || 
                             datosAcademicos.Maestria;
    const seccionMaestria = document.querySelector('#tab-academic .details-section:nth-child(5)');
    
    if (maestriaTieneDatos) {
        seccionMaestria.style.display = 'block';
        document.getElementById('modalMaestriaEstado').textContent = datosAcademicos.EstadoMaestria || 'No registrado';
        document.getElementById('modalMaestriaPlan').textContent = datosAcademicos.NivelMaestria || 'No registrado';
        document.getElementById('modalMaestriaTrimestre').textContent = datosAcademicos.Trimestrecursando || 'No registrado';
        document.getElementById('modalMaestriaUniversidad').textContent = datosAcademicos.UniversidadMaestria || 'No registrado';
        document.getElementById('modalMaestriaNombre').textContent = datosAcademicos.Maestria || 'No registrado';
    } else {
        seccionMaestria.style.display = 'none';
    }
    
    // Verificar si no hay datos en ninguna sección
    const hayDatosAcademicos = primariaTieneDatos || basicoTieneDatos || diversificadoTieneDatos || 
                              universidadTieneDatos || maestriaTieneDatos;
    
    if (!hayDatosAcademicos) {
        // Mostrar mensaje de no hay datos
        const noDataMsg = document.createElement('div');
        noDataMsg.className = 'no-data-message';
        noDataMsg.innerHTML = '<i class="fas fa-info-circle"></i> No hay información académica registrada para este colaborador.';
        document.querySelector('#tab-academic').appendChild(noDataMsg);
    } else {
        // Eliminar mensaje de no hay datos si existe
        const noDataMsg = document.querySelector('#tab-academic .no-data-message');
        if (noDataMsg) {
            noDataMsg.remove();
        }
    }
}

// Función para interpretar puntuación PMA
function interpretarPuntuacionPMA(puntuacion) {
    if (puntuacion === null || puntuacion === undefined || puntuacion === '-') return 'No disponible';
    
    // Convertir a número si es string
    const valor = typeof puntuacion === 'string' ? parseFloat(puntuacion) : puntuacion;
    
    if (isNaN(valor)) return 'No disponible';
    
    // Escala ajustada para puntajes sobre 50
    if (valor >= 45) return 'Muy Superior';
    if (valor >= 40) return 'Superior';
    if (valor >= 35) return 'Medio-Alto';
    if (valor >= 30) return 'Medio';
    if (valor >= 25) return 'Medio-Bajo';
    if (valor >= 20) return 'Bajo';
    return 'Muy Bajo';
}

// Función para colorear puntuación PMA
function colorPuntuacionPMA(puntuacion) {
    if (puntuacion === null || puntuacion === undefined || puntuacion === '-') return '#ccc';
    
    // Convertir a número si es string
    const valor = typeof puntuacion === 'string' ? parseFloat(puntuacion) : puntuacion;
    
    if (isNaN(valor)) return '#ccc';
    
    if (valor >= 90) return '#1e7e34'; // Verde oscuro
    if (valor >= 80) return '#28a745'; // Verde
    if (valor >= 70) return '#8bc34a'; // Verde claro
    if (valor >= 60) return '#17a2b8'; // Azul
    if (valor >= 50) return '#ffc107'; // Amarillo
    if (valor >= 40) return '#fd7e14'; // Naranja
    return '#dc3545'; // Rojo
}

// Variable para almacenar la instancia del gráfico PMA
let pmaChart = null;

// Función para mostrar resultados PMA en el modal
function mostrarResultadosPMA(datosPMA) {
    const seccionPMA = document.querySelector('#tab-pma .details-section');
    
    if (!datosPMA) {
        console.log('No hay datos PMA disponibles');
        
        // Mostrar mensaje de no hay datos
        seccionPMA.innerHTML = `
            <div class="no-data-message">
                <i class="fas fa-info-circle"></i> No hay resultados de evaluación PMA registrados para este colaborador.
            </div>
        `;
        return;
    }
    
    // Verificar si hay datos válidos en los factores
    const factorV = datosPMA.FactorV !== null ? datosPMA.FactorV : '-';
    const factorE = datosPMA.FactorE !== null ? datosPMA.FactorE : '-';
    const factorR = datosPMA.FactorR !== null ? datosPMA.FactorR : '-';
    const factorN = datosPMA.FactorN !== null ? datosPMA.FactorN : '-';
    const factorF = datosPMA.FactorF !== null ? datosPMA.FactorF : '-';
    
    const hayDatosPMA = [factorV, factorE, factorR, factorN, factorF].some(factor => factor !== '-');
    
    if (!hayDatosPMA) {
        seccionPMA.innerHTML = `
            <div class="no-data-message">
                <i class="fas fa-info-circle"></i> No hay resultados de evaluación PMA válidos para este colaborador.
            </div>
        `;
        return;
    }
    
    // Restaurar contenido original si fue reemplazado
    if (!document.getElementById('modalPmaFecha')) {
        seccionPMA.innerHTML = `
            <h4><i class="fas fa-brain"></i> Resultados Evaluación PMA</h4>
            <div class="details-grid pma-grid">
                <div class="detail-item">
                    <label>Fecha de Evaluación:</label>
                    <span id="modalPmaFecha">No registrado</span>
                </div>
            </div>
            
            <!-- Gráfico de radar para visualizar resultados PMA -->
            <div class="pma-chart-container">
                <canvas id="pmaRadarChart" height="250"></canvas>
            </div>
            
            <!-- Tabla de resultados detallados -->
            <div class="pma-table-container">
                <table class="pma-table">
                    <thead>
                        <tr>
                            <th>Factor</th>
                            <th>Descripción</th>
                            <th>Puntuación</th>
                            <th>Interpretación</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>V</strong></td>
                            <td>Comprensión Verbal</td>
                            <td id="modalPmaV">-</td>
                            <td id="modalPmaVDesc">No registrado</td>
                        </tr>
                        <tr>
                            <td><strong>E</strong></td>
                            <td>Concepción Espacial</td>
                            <td id="modalPmaE">-</td>
                            <td id="modalPmaEDesc">No registrado</td>
                        </tr>
                        <tr>
                            <td><strong>R</strong></td>
                            <td>Razonamiento</td>
                            <td id="modalPmaR">-</td>
                            <td id="modalPmaRDesc">No registrado</td>
                        </tr>
                        <tr>
                            <td><strong>N</strong></td>
                            <td>Cálculo Numérico</td>
                            <td id="modalPmaN">-</td>
                            <td id="modalPmaNDesc">No registrado</td>
                        </tr>
                        <tr>
                            <td><strong>F</strong></td>
                            <td>Fluidez Verbal</td>
                            <td id="modalPmaF">-</td>
                            <td id="modalPmaFDesc">No registrado</td>
                        </tr>
                        <tr class="pma-average-row">
                            <td colspan="2"><strong>PROMEDIO</strong></td>
                            <td id="modalPmaPromedio">-</td>
                            <td id="modalPmaPromedioDesc">No registrado</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // Formatear fecha
    const fechaEvaluacion = datosPMA.FechaEvaluacion ? new Date(datosPMA.FechaEvaluacion).toLocaleDateString() : 'No registrado';
    document.getElementById('modalPmaFecha').textContent = fechaEvaluacion;
    
    // Mostrar factores individuales
    document.getElementById('modalPmaV').textContent = factorV;
    document.getElementById('modalPmaE').textContent = factorE;
    document.getElementById('modalPmaR').textContent = factorR;
    document.getElementById('modalPmaN').textContent = factorN;
    document.getElementById('modalPmaF').textContent = factorF;
    
    // Mostrar interpretaciones
    document.getElementById('modalPmaVDesc').textContent = interpretarPuntuacionPMA(factorV);
    document.getElementById('modalPmaEDesc').textContent = interpretarPuntuacionPMA(factorE);
    document.getElementById('modalPmaRDesc').textContent = interpretarPuntuacionPMA(factorR);
    document.getElementById('modalPmaNDesc').textContent = interpretarPuntuacionPMA(factorN);
    document.getElementById('modalPmaFDesc').textContent = interpretarPuntuacionPMA(factorF);
    
    // Calcular promedio
    const valoresValidos = [factorV, factorE, factorR, factorN, factorF].filter(valor => 
        valor !== '-' && valor !== null && valor !== undefined && !isNaN(parseFloat(valor))
    ).map(valor => parseFloat(valor));
    
    let promedio = '-';
    
    if (valoresValidos.length > 0) {
        const suma = valoresValidos.reduce((total, valor) => total + valor, 0);
        promedio = (suma / valoresValidos.length).toFixed(1);
    }
    
    document.getElementById('modalPmaPromedio').textContent = promedio;
    document.getElementById('modalPmaPromedioDesc').textContent = interpretarPuntuacionPMA(promedio);
    
    // Crear gráfico de radar
    const ctx = document.getElementById('pmaRadarChart').getContext('2d');
    
    // Destruir gráfico previo si existe
    if (pmaChart) {
        pmaChart.destroy();
    }
    
    // Convertir valores a números para el gráfico (usar 0 si no hay valor)
    const valoresGrafico = [
        factorV !== '-' ? parseFloat(factorV) : 0,
        factorE !== '-' ? parseFloat(factorE) : 0,
        factorR !== '-' ? parseFloat(factorR) : 0,
        factorN !== '-' ? parseFloat(factorN) : 0,
        factorF !== '-' ? parseFloat(factorF) : 0
    ];
    
    // Crear nuevo gráfico
    pmaChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Comprensión Verbal (V)', 'Concepción Espacial (E)', 'Razonamiento (R)', 'Cálculo Numérico (N)', 'Fluidez Verbal (F)'],
            datasets: [{
                label: 'Puntuación PMA',
                data: valoresGrafico,
                backgroundColor: 'rgba(255, 127, 39, 0.2)',
                borderColor: 'rgba(255, 127, 39, 0.8)',
                pointBackgroundColor: 'rgba(255, 127, 39, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(255, 127, 39, 1)',
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Perfil de Aptitudes Mentales',
                    color: '#2C3E50',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            return `Puntuación: ${value} - ${interpretarPuntuacionPMA(value)}`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    angleLines: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: {
                        stepSize: 20,
                        color: '#666',
                        backdropColor: 'transparent'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    pointLabels: {
                        font: {
                            size: 11
                        },
                        color: '#2C3E50'
                    }
                }
            }
        }
    });
}
function mostrarInstruccionesBusqueda() {
    // Ocultar indicador de carga
    loadingIndicator.style.display = 'none';
    
    // Ocultar otras vistas
    gridView.style.display = 'none';
    tableView.style.display = 'none';
    
    // Actualizar contador de resultados
    resultsCount.textContent = '0';
    currentPageSpan.textContent = '1';
    totalPagesSpan.textContent = '1';
    
    // Deshabilitar botones de paginación
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    
    // Mostrar mensaje de selección de filtros
    noResults.style.display = 'flex';
    noResults.innerHTML = `
        <div class="no-results-icon">
            <i class="fas fa-search"></i>
        </div>
        <h3>Seleccione filtros para buscar</h3>
        <p>Utilice los filtros de búsqueda y haga clic en "Buscar" para ver resultados</p>
    `;
}
// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    
    // Cargar datos iniciales para los filtros
    cargarDepartamentos();
    cargarTiposPersonal();
    cargarEstadosPersonal();
    mostrarInstruccionesBusqueda();
    // Event listeners para filtros
    searchButton.addEventListener('click', buscarPersonal);
    resetFiltersButton.addEventListener('click', resetearFiltros);
    clearSearchButton.addEventListener('click', limpiarBusqueda);
    
    // Event listener para alternar los filtros
    filtersToggle.addEventListener('click', () => {
        colapsarFiltros(!filtersCollapsed);
    });
    
    // Event listeners para paginación
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            actualizarResultados();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            actualizarResultados();
        }
    });
    
    // Event listener para cambiar vista
    viewToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            
            // Actualizar botones
            viewToggleBtns.forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            // Cambiar vista
            currentView = view;
            actualizarResultados();
        });
    });
    
    // Event listener para cerrar modal
    document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            employeeModal.classList.remove('show');
        });
    });
    
    // Event listener para volver atrás
    btnBack.addEventListener('click', () => {
        window.location.href = 'Menu.html';
    });
    
    // Event listener para cerrar modal al hacer clic fuera de él
    employeeModal.addEventListener('click', event => {
        if (event.target === employeeModal) {
            employeeModal.classList.remove('show');
        }
    });
    
    // Event listener para tecla Enter en campo de búsqueda
    searchText.addEventListener('keypress', event => {
        if (event.key === 'Enter') {
            buscarPersonal();
        }
    });
});
closePhotoViewer.addEventListener('click', cerrarVisorFoto);
photoViewer.addEventListener('click', event => {
    if (event.target === photoViewer) {
        cerrarVisorFoto();
    }
});

// Cerrar el visor con la tecla Escape
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && photoViewer.classList.contains('show')) {
        cerrarVisorFoto();
    }
});

// También agrega el visor a las fotos en las tarjetas de empleados
// Modifica la función renderizarGridView para incluir el evento click en las imágenes
// Al final de la función renderizarGridView, agrega este código:

window.renderizarGridViewOriginal = window.renderizarGridView; // Guardar la función original

window.renderizarGridView = function(empleados) {
    // Llamar a la función original
    window.renderizarGridViewOriginal(empleados);
    
    // Añadir eventos a las imágenes de las tarjetas
    document.querySelectorAll('.card-photo img').forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', function() {
            const empleadoCard = this.closest('.employee-card');
            const id = empleadoCard.dataset.id;
            const empleado = filteredEmployees.find(emp => emp.id === parseInt(id));
            
            if (empleado) {
                abrirVisorFoto(empleado.foto, empleado.nombre);
            }
        });
    });
};

// Hacer lo mismo para la vista de tabla
window.renderizarTableViewOriginal = window.renderizarTableView; // Guardar la función original

window.renderizarTableView = function(empleados) {
    // Llamar a la función original
    window.renderizarTableViewOriginal(empleados);
    
    // Añadir eventos a las imágenes de la tabla
    document.querySelectorAll('.table-img').forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', function() {
            const row = this.closest('tr');
            const id = row.dataset.id;
            const empleado = filteredEmployees.find(emp => emp.id === parseInt(id));
            
            if (empleado) {
                abrirVisorFoto(empleado.foto, empleado.nombre);
            }
        });
    });
};

// Asegúrate de hacer globales las funciones del visor
window.abrirVisorFoto = abrirVisorFoto;
window.cerrarVisorFoto = cerrarVisorFoto;
// Hacer funciones disponibles globalmente
window.mostrarDetallesEmpleado = mostrarDetallesEmpleado;
window.editarEmpleado = editarEmpleado;