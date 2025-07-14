// Configuración e inicialización
const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const Swal = require('sweetalert2');
const conexion = 'DSN=recursos2';
const XLSX = require('xlsx');
const fotoCache = new Map();
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
        
        // CONSULTA OPTIMIZADA - SIN FOTOS INICIALMENTE
        let query = `
            SELECT
                personal.IdPersonal, 
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto, 
                departamentos.NombreDepartamento, 
                Puestos.Nombre AS Puesto,
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
                personal.IdUsuario,
                personal.Fechahoraregistro,
                CONCAT(usuarioRegistro.PrimerNombre, ' ', IFNULL(usuarioRegistro.SegundoNombre, ''), ' ', IFNULL(usuarioRegistro.TercerNombre, ''), ' ', usuarioRegistro.PrimerApellido, ' ', IFNULL(usuarioRegistro.SegundoApellido, '')) AS UsuarioRegistro,
                -- INDICADOR DE SI TIENE FOTO (sin cargar la foto)
                CASE WHEN FotosPersonal.Foto IS NOT NULL THEN 1 ELSE 0 END AS TieneFoto
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
                LEFT JOIN personal usuarioRegistro ON personal.IdUsuario = usuarioRegistro.IdPersonal
            WHERE 1=1
        `;
        
        // Resto de la consulta igual...
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
        
        // Procesar resultados SIN cargar fotos
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
            
            const formatearFechaSinZonaHoraria = (fecha) => {
                if (!fecha) return 'No registrado';
                const fechaObj = new Date(fecha);
                if (isNaN(fechaObj.getTime())) return 'No registrado';
                const dia = fechaObj.getUTCDate().toString().padStart(2, '0');
                const mes = (fechaObj.getUTCMonth() + 1).toString().padStart(2, '0');
                const año = fechaObj.getUTCFullYear();
                return `${dia}/${mes}/${año}`;
            };
            
            const formatearFechaHora = (fechaHora) => {
                if (!fechaHora) return 'No registrado';
                const fecha = new Date(fechaHora);
                if (isNaN(fecha.getTime())) return 'No registrado';
                const dia = fecha.getUTCDate().toString().padStart(2, '0');
                const mes = (fecha.getUTCMonth() + 1).toString().padStart(2, '0');
                const año = fecha.getUTCFullYear();
                const horas = fecha.getUTCHours().toString().padStart(2, '0');
                const minutos = fecha.getUTCMinutes().toString().padStart(2, '0');
                return `${dia}/${mes}/${año} ${horas}:${minutos}`;
            };
            
            return {
                id: employee.IdPersonal,
                nombre: employee.NombreCompleto,
                departamento: employee.NombreDepartamento,
                puesto: employee.Puesto,
                estadoCivil: employee.EstadoCivil,
                tipoPersonal: employee.TipoPersonal,
                planilla: employee.Nombre_Planilla,
                fechaContrato: employee.FechaContrato === 'No asignado' ? 
                    'No asignado' : formatearFechaSinZonaHoraria(employee.FechaContrato),
                fechaPlanilla: employee.FechaPlanilla === 'No asignado' ? 
                    'No asignado' : formatearFechaSinZonaHoraria(employee.FechaPlanilla),
                inicioLaboral: employee.InicioLaboral === 'No asignado' ? 
                    'No registrado' : formatearFechaSinZonaHoraria(employee.InicioLaboral),
                tiempoTrabajado: tiempoTrabajado,
                estado: employee.EstadoPersonal,
                estadoId: employee.EstadoId,
                dpi: employee.DPI || 'No registrado',
                fechaNacimiento: employee.FechaNacimiento ? 
                    formatearFechaSinZonaHoraria(employee.FechaNacimiento) : 'No registrado',
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
                // FOTO SE CARGA DINÁMICAMENTE
                foto: '../Imagenes/user-default.png', // Imagen por defecto
                tieneFoto: employee.TieneFoto === 1,
                fotoReal: null, // Se cargará bajo demanda
                idUsuarioRegistro: employee.IdUsuario || null,
                usuarioRegistro: employee.UsuarioRegistro || 'No registrado',
                fechaHoraRegistro: formatearFechaHora(employee.Fechahoraregistro)
            };
        });
        
        filteredEmployees = [...allEmployees];
        
        actualizarResumenFiltros(searchTermValue, departamentoValue, tipoPersonalValue, estadoValue);
        
        if (window.innerWidth < 768) {
            colapsarFiltros(true);
        }
        
        actualizarResultados();
        mostrarCargando(false);
        
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
function mostrarCargando(mostrar, mensaje = 'Cargando personal...') {
    if (mostrar) {
        loadingIndicator.style.display = 'flex';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner"></div>
            <p>${mensaje}</p>
        `;
        
        // Si es exportación, añadir clase especial
        if (mensaje.includes('Excel')) {
            loadingIndicator.querySelector('p').classList.add('export-loading');
        }
        
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
async function cargarFotoEmpleado(idPersonal) {
    // Si ya está en cache, devolverla
    if (fotoCache.has(idPersonal)) {
        return fotoCache.get(idPersonal);
    }
    
    try {
        const connection = await getConnection();
        const result = await connection.query(`
            SELECT CASE 
                WHEN Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(Foto))
                ELSE NULL 
            END AS FotoBase64
            FROM FotosPersonal 
            WHERE IdPersonal = ?
        `, [idPersonal]);
        await connection.close();
        
        const fotoUrl = result.length > 0 && result[0].FotoBase64 ? 
            result[0].FotoBase64 : '../Imagenes/user-default.png';
        
        // Guardar en cache
        fotoCache.set(idPersonal, fotoUrl);
        
        return fotoUrl;
    } catch (error) {
        console.error('Error al cargar foto:', error);
        return '../Imagenes/user-default.png';
    }
}
// Renderizar vista de tarjetas (MODIFICADA PARA INCLUIR INFO DE REGISTRO)
function renderizarGridView(empleados) {
    let html = '';
    
    empleados.forEach(empleado => {
        html += `
            <div class="employee-card" data-id="${empleado.id}">
                <div class="card-status ${empleado.estadoId === 1 ? 'status-active' : 'status-inactive'}">
                    ${empleado.estado}
                </div>
                <div class="card-photo">
                    <img src="${empleado.foto}" alt="${empleado.nombre}" 
                         data-id="${empleado.id}" 
                         data-tiene-foto="${empleado.tieneFoto}"
                         class="lazy-foto"
                         onerror="this.src='../Imagenes/user-default.png'">
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
                        <div class="card-detail-item">
                            <span class="detail-label">Registrado por:</span>
                            <span class="detail-value" title="${empleado.usuarioRegistro}">${empleado.usuarioRegistro.length > 15 ? empleado.usuarioRegistro.substring(0, 15) + '...' : empleado.usuarioRegistro}</span>
                        </div>
                        <div class="card-detail-item">
                            <span class="detail-label">Fecha registro:</span>
                            <span class="detail-value">${empleado.fechaHoraRegistro}</span>
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
    
    // CARGAR FOTOS DE FORMA LAZY (solo las visibles)
    cargarFotosLazy();
    
    // Eventos para el visor de fotos
    document.querySelectorAll('.card-photo img').forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', async function() {
            const empleadoCard = this.closest('.employee-card');
            const id = parseInt(empleadoCard.dataset.id);
            const empleado = filteredEmployees.find(emp => emp.id === id);
            
            if (empleado) {
                // Cargar foto real si no está cargada
                if (empleado.tieneFoto && !empleado.fotoReal) {
                    const fotoReal = await cargarFotoEmpleado(id);
                    empleado.fotoReal = fotoReal;
                }
                abrirVisorFoto(empleado.fotoReal || empleado.foto, empleado.nombre);
            }
        });
    });
}
function cargarFotosLazy() {
    const imagenes = document.querySelectorAll('.lazy-foto');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(async (entry) => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const idPersonal = parseInt(img.dataset.id);
                const tieneFoto = img.dataset.tieneFoto === 'true';
                
                if (tieneFoto) {
                    try {
                        // Mostrar indicador de carga
                        img.style.opacity = '0.5';
                        
                        // Cargar foto real
                        const fotoReal = await cargarFotoEmpleado(idPersonal);
                        
                        // Actualizar empleado en el array
                        const empleado = filteredEmployees.find(emp => emp.id === idPersonal);
                        if (empleado) {
                            empleado.fotoReal = fotoReal;
                        }
                        
                        // Cambiar src de la imagen
                        img.src = fotoReal;
                        img.style.opacity = '1';
                        
                    } catch (error) {
                        console.error('Error cargando foto:', error);
                        img.style.opacity = '1';
                    }
                }
                
                // Dejar de observar esta imagen
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px' // Cargar cuando esté a 50px de ser visible
    });
    
    imagenes.forEach(img => imageObserver.observe(img));
}
// Renderizar vista de tabla (MODIFICADA PARA INCLUIR INFO DE REGISTRO)
function renderizarTableView(empleados) {
    let html = '';
    
    empleados.forEach(empleado => {
        html += `
            <tr data-id="${empleado.id}">
                <td>
                    <img src="${empleado.foto}" alt="${empleado.nombre}" 
                         data-id="${empleado.id}" 
                         data-tiene-foto="${empleado.tieneFoto}"
                         class="table-img lazy-foto"
                         onerror="this.src='../Imagenes/user-default.png'">
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
                <td title="${empleado.usuarioRegistro}">${empleado.usuarioRegistro.length > 20 ? empleado.usuarioRegistro.substring(0, 20) + '...' : empleado.usuarioRegistro}</td>
                <td>${empleado.fechaHoraRegistro}</td>
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
    
    // CARGAR FOTOS LAZY PARA TABLA TAMBIÉN
    cargarFotosLazy();
    
    // Eventos para el visor de fotos
    document.querySelectorAll('.table-img').forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', async function() {
            const row = this.closest('tr');
            const id = parseInt(row.dataset.id);
            const empleado = filteredEmployees.find(emp => emp.id === id);
            
            if (empleado) {
                if (empleado.tieneFoto && !empleado.fotoReal) {
                    const fotoReal = await cargarFotoEmpleado(id);
                    empleado.fotoReal = fotoReal;
                }
                abrirVisorFoto(empleado.fotoReal || empleado.foto, empleado.nombre);
            }
        });
    });
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

// Mostrar detalles de un empleado (MODIFICADA PARA INCLUIR INFO DE REGISTRO)
async function mostrarDetallesEmpleado(id) {
    // Encuentra el empleado en la lista
    const empleado = filteredEmployees.find(emp => emp.id === id);
    
    if (!empleado) {
        mostrarNotificacion('Empleado no encontrado', 'error');
        return;
    }
    
    // Actualizar el modal con los datos del empleado
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
    
    // Corrección para la fecha de nacimiento
    if (empleado.fechaNacimiento && empleado.fechaNacimiento !== 'No registrado') {
        const fechaNacPartes = empleado.fechaNacimiento.split('/');
        if (fechaNacPartes.length === 3) {
            const fechaCorrecta = `${fechaNacPartes[0]}/${fechaNacPartes[1]}/${fechaNacPartes[2]}`;
            document.getElementById('modalEmployeeBirthdate').textContent = fechaCorrecta;
        } else {
            document.getElementById('modalEmployeeBirthdate').textContent = empleado.fechaNacimiento;
        }
    } else {
        document.getElementById('modalEmployeeBirthdate').textContent = 'No registrado';
    }
    
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
    
    // Corrección para la fecha de inicio laboral
    if (empleado.inicioLaboral && empleado.inicioLaboral !== 'No registrado') {
        const fechaInicioPartes = empleado.inicioLaboral.split('/');
        if (fechaInicioPartes.length === 3) {
            const fechaCorrecta = `${fechaInicioPartes[0]}/${fechaInicioPartes[1]}/${fechaInicioPartes[2]}`;
            document.getElementById('modalEmployeeStartDate').textContent = fechaCorrecta;
        } else {
            document.getElementById('modalEmployeeStartDate').textContent = empleado.inicioLaboral;
        }
    } else {
        document.getElementById('modalEmployeeStartDate').textContent = 'No registrado';
    }
    
    document.getElementById('modalEmployeeWorkTime').textContent = empleado.tiempoTrabajado;
    document.getElementById('modalEmployeeContractDate').textContent = empleado.fechaContrato;
    document.getElementById('modalEmployeePayrollDate').textContent = empleado.fechaPlanilla;
    
    // NUEVA SECCIÓN: Información de Registro
    document.getElementById('modalUsuarioRegistro').textContent = empleado.usuarioRegistro;
    document.getElementById('modalFechaHoraRegistro').textContent = empleado.fechaHoraRegistro;
    document.getElementById('modalIdUsuarioRegistro').textContent = empleado.idUsuarioRegistro || 'No registrado';
    
    // Cargar información académica
    try {
        const datosAcademicos = await cargarInfoAcademica(empleado.id);
        mostrarDatosAcademicos(datosAcademicos);
    } catch (error) {
        console.error('Error al cargar datos académicos:', error);
    }
    
    // Cargar resultados PMA
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

// Cerrar modal
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
async function editarEmpleado(id) {
    try {
        // Mostrar cargando
        mostrarCargando(true, 'Verificando permisos...');
        
        // Obtener datos del usuario desde localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        
        if (!userData || !userData.IdPersonal) {
            mostrarNotificacion('No se puede identificar al usuario. Inicie sesión nuevamente.', 'error');
            mostrarCargando(false);
            return;
        }
        
        // Verificar si el usuario tiene la transacción 103 activa
        const connection = await getConnection();
        const query = `
            SELECT Activo 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ? AND Codigo = 103 AND Activo = 1
        `;
        
        const result = await connection.query(query, [userData.IdPersonal]);
        await connection.close();
        
        if (result.length === 0 || result[0].Activo !== 1) {
            // El usuario no tiene permisos
            mostrarCargando(false);
            mostrarNotificacion('No tiene permisos para editar colaboradores. Se requiere la transacción 103 activa.', 'warning');
            return;
        }
        
        // Si tiene permisos, redirigir a la página de edición
        mostrarCargando(false);
        window.location.href = `Editar.html?id=${id}`;
        
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al verificar permisos de edición', 'error');
    }
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
                ResultadosPMA.FechaEvaluacion,
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', 
                IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', 
                IFNULL(personal.SegundoApellido, '')) AS NombreEvaluador
            FROM
                ResultadosPMA
                LEFT JOIN personal ON ResultadosPMA.IdUsuarioEvaluo = personal.IdPersonal
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

// Variable para almacenar la instancia del gráfico PMA
let pmaChart = null;

// Función para mostrar resultados PMA
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
    
    // Reconstruir completamente el contenido del contenedor PMA
    seccionPMA.innerHTML = `
        <h4><i class="fas fa-brain"></i> Resultados Evaluación PMA</h4>
        <div class="details-grid pma-grid">
            <div class="detail-item">
                <label>Fecha de Evaluación:</label>
                <span id="modalPmaFecha">No registrado</span>
            </div>
            <div class="detail-item">
                <label>Evaluador:</label>
                <span id="modalPmaEvaluador">No registrado</span>
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
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>V</strong></td>
                        <td>Comprensión Verbal</td>
                        <td id="modalPmaV">-</td>
                    </tr>
                    <tr>
                        <td><strong>E</strong></td>
                        <td>Concepción Espacial</td>
                        <td id="modalPmaE">-</td>
                    </tr>
                    <tr>
                        <td><strong>R</strong></td>
                        <td>Razonamiento</td>
                        <td id="modalPmaR">-</td>
                    </tr>
                    <tr>
                        <td><strong>N</strong></td>
                        <td>Cálculo Numérico</td>
                        <td id="modalPmaN">-</td>
                    </tr>
                    <tr>
                        <td><strong>F</strong></td>
                        <td>Fluidez Verbal</td>
                        <td id="modalPmaF">-</td>
                    </tr>
                    <tr class="pma-average-row">
                        <td colspan="2"><strong>PROMEDIO</strong></td>
                        <td id="modalPmaPromedio">-</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    
    // Ahora que los elementos DOM existen, podemos establecer su contenido
    // Formatear fecha
    const fechaEvaluacion = datosPMA.FechaEvaluacion ? new Date(datosPMA.FechaEvaluacion).toLocaleDateString() : 'No registrado';
    document.getElementById('modalPmaFecha').textContent = fechaEvaluacion;
    
    // Mostrar el nombre del evaluador
    const nombreEvaluador = datosPMA.NombreEvaluador || 'No registrado';
    document.getElementById('modalPmaEvaluador').textContent = nombreEvaluador;
    
    // Mostrar factores individuales
    document.getElementById('modalPmaV').textContent = factorV;
    document.getElementById('modalPmaE').textContent = factorE;
    document.getElementById('modalPmaR').textContent = factorR;
    document.getElementById('modalPmaN').textContent = factorN;
    document.getElementById('modalPmaF').textContent = factorF;
    
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
                            return `Puntuación: ${value}`;
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

// Función para calcular promedio PMA
function calcularPromedioPMA(pma) {
    if (!pma) return 'No registrado';
    
    const valores = [
        pma.FactorV ? parseFloat(pma.FactorV) : null,
        pma.FactorE ? parseFloat(pma.FactorE) : null,
        pma.FactorR ? parseFloat(pma.FactorR) : null,
        pma.FactorN ? parseFloat(pma.FactorN) : null,
        pma.FactorF ? parseFloat(pma.FactorF) : null
    ].filter(v => v !== null);
    
    if (valores.length === 0) return 'No registrado';
    
    const suma = valores.reduce((a, b) => a + b, 0);
    return (suma / valores.length).toFixed(1);
}

// Función para obtener datos completos de empleados
async function obtenerDatosCompletosEmpleados() {
    // Copia profunda de los empleados filtrados
    const empleadosCompletos = JSON.parse(JSON.stringify(filteredEmployees));
    
    // Para cada empleado, obtener datos académicos y PMA
    for (const empleado of empleadosCompletos) {
        try {
            // Obtener datos académicos
            const datosAcademicos = await cargarInfoAcademica(empleado.id);
            empleado.datosAcademicos = datosAcademicos;
            
            // Obtener resultados PMA
            const datosPMA = await cargarResultadosPMA(empleado.id);
            empleado.datosPMA = datosPMA;
        } catch (error) {
            console.error(`Error al obtener datos completos para empleado ID ${empleado.id}:`, error);
        }
    }
    
    return empleadosCompletos;
}

// Función de exportación a Excel (MODIFICADA PARA INCLUIR INFO DE REGISTRO)
async function exportarAExcel() {
    try {
        // Mostrar indicador de carga
        mostrarNotificacion('Preparando exportación a Excel...', 'info');
        mostrarCargando(true);
        
        // Verificar si hay datos para exportar
        if (filteredEmployees.length === 0) {
            mostrarNotificacion('No hay datos para exportar', 'warning');
            mostrarCargando(false);
            return;
        }
        
        // Obtener todos los datos con detalles académicos y PMA
        const datosCompletos = await obtenerDatosCompletosEmpleados();
        
        // Estructurar los datos para Excel (una hoja principal y hojas adicionales)
        const workbook = XLSX.utils.book_new();
        
        // Hoja 1: Información General
        const datosGenerales = datosCompletos.map(empleado => ({
            'ID': empleado.id,
            'Nombre Completo': empleado.nombre,
            'DPI': empleado.dpi,
            'Departamento': empleado.departamento,
            'Puesto': empleado.puesto,
            'Estado': empleado.estado,
            'Tipo Personal': empleado.tipoPersonal,
            'Planilla': empleado.planilla,
            'Fecha Contrato': empleado.fechaContrato,
            'Fecha Planilla': empleado.fechaPlanilla,
            'Inicio Laboral': empleado.inicioLaboral,
            'Tiempo Trabajado': empleado.tiempoTrabajado,
            'Estado Civil': empleado.estadoCivil,
            'Fecha Nacimiento': empleado.fechaNacimiento,
            'Edad': empleado.edad,
            'Hijos': empleado.hijos
        }));
        
        const worksheetGeneral = XLSX.utils.json_to_sheet(datosGenerales);
        XLSX.utils.book_append_sheet(workbook, worksheetGeneral, 'Información General');
        
        // Hoja 2: Ubicación y Contacto
        const datosUbicacion = datosCompletos.map(empleado => ({
            'ID': empleado.id,
            'Nombre Completo': empleado.nombre,
            'Depto. Origen': empleado.departamentoOrigen,
            'Municipio Origen': empleado.municipioOrigen,
            'Dirección Residencia': empleado.direccionResidencia,
            'Depto. Residencia': empleado.departamentoResidencia,
            'Municipio Residencia': empleado.municipioResidencia,
            'Teléfono 1': empleado.telefono1,
            'Teléfono 2': empleado.telefono2,
            'Correo Electrónico': empleado.correoElectronico,
            'Contacto Emergencia': empleado.nombreContactoEmergencia,
            'Teléfono Emergencia': empleado.telefonoContactoEmergencia,
            'Parentesco': empleado.parentescoEmergencia
        }));
        
        const worksheetUbicacion = XLSX.utils.json_to_sheet(datosUbicacion);
        XLSX.utils.book_append_sheet(workbook, worksheetUbicacion, 'Ubicación y Contacto');
        
        // Hoja 3: Información Académica
        const datosAcademicos = datosCompletos.map(empleado => {
            const academica = empleado.datosAcademicos || {};
            return {
                'ID': empleado.id,
                'Nombre Completo': empleado.nombre,
                // Primaria
                'Estado Primaria': academica.EstadoPrimaria || 'No registrado',
                'Plan Primaria': academica.PlanPrimaria || 'No registrado',
                'Nivel Primaria': academica.NivelPrimaria || 'No registrado',
                // Básico
                'Estado Básico': academica.EstadoBasico || 'No registrado',
                'Plan Básico': academica.PlanBasico || 'No registrado',
                'Nivel Básico': academica.NivelBasico || 'No registrado',
                // Diversificado
                'Estado Diversificado': academica.EstadoDiversificado || 'No registrado',
                'Plan Diversificado': academica.PlanDiversificado || 'No registrado',
                'Nivel Diversificado': academica.NivelDiversificado || 'No registrado',
                'Grado Académico': academica.GradoAcademico || 'No registrado',
                // Universidad
                'Estado Universidad': academica.EstadoUniversidad || 'No registrado',
                'Plan Universitario': academica.PlanUniversitario || 'No registrado',
                'Nivel Universidad': academica.NivelUniversidad || 'No registrado',
                'Universidad': academica.Universidad || 'No registrado',
                'Carrera': academica.CarrerasUniversitarias || 'No registrado',
                // Maestría
                'Estado Maestría': academica.EstadoMaestria || 'No registrado',
                'Plan Maestría': academica.NivelMaestria || 'No registrado',
                'Trimestre Maestría': academica.Trimestrecursando || 'No registrado',
                'Universidad Maestría': academica.UniversidadMaestria || 'No registrado',
                'Nombre Maestría': academica.Maestria || 'No registrado'
            };
        });
        
        const worksheetAcademica = XLSX.utils.json_to_sheet(datosAcademicos);
        XLSX.utils.book_append_sheet(workbook, worksheetAcademica, 'Información Académica');
        
        // Hoja 4: Evaluación PMA
        const datosPMA = datosCompletos.map(empleado => {
            const pma = empleado.datosPMA || {};
            return {
                'ID': empleado.id,
                'Nombre Completo': empleado.nombre,
                'Fecha Evaluación': pma.FechaEvaluacion ? new Date(pma.FechaEvaluacion).toLocaleDateString() : 'No registrado',
                'Evaluador': pma.NombreEvaluador || 'No registrado',
                'Factor V (Comprensión Verbal)': pma.FactorV || 'No registrado',
                'Factor E (Concepción Espacial)': pma.FactorE || 'No registrado',
                'Factor R (Razonamiento)': pma.FactorR || 'No registrado',
                'Factor N (Cálculo Numérico)': pma.FactorN || 'No registrado',
                'Factor F (Fluidez Verbal)': pma.FactorF || 'No registrado',
                'Promedio': calcularPromedioPMA(pma)
            };
        });
        
        const worksheetPMA = XLSX.utils.json_to_sheet(datosPMA);
        XLSX.utils.book_append_sheet(workbook, worksheetPMA, 'Evaluación PMA');
        
        // Hoja 5: Información Laboral
        const datosLaborales = datosCompletos.map(empleado => ({
            'ID': empleado.id,
            'Nombre Completo': empleado.nombre,
            'Departamento': empleado.departamento,
            'Puesto': empleado.puesto,
            'Tipo Personal': empleado.tipoPersonal,
            'Planilla': empleado.planilla,
            'Estado': empleado.estado,
            'Fecha Contrato': empleado.fechaContrato,
            'Fecha Planilla': empleado.fechaPlanilla,
            'Inicio Laboral': empleado.inicioLaboral,
            'Tiempo Trabajado': empleado.tiempoTrabajado
        }));

        const worksheetLaboral = XLSX.utils.json_to_sheet(datosLaborales);
        XLSX.utils.book_append_sheet(workbook, worksheetLaboral, 'Información Laboral');
        
        // Hoja 6: Información de Registro (NUEVA)
        const datosRegistro = datosCompletos.map(empleado => ({
            'ID': empleado.id,
            'Nombre Completo': empleado.nombre,
            'Registrado por': empleado.usuarioRegistro,
            'Fecha y Hora de Registro': empleado.fechaHoraRegistro,
            'ID Usuario Registro': empleado.idUsuarioRegistro || 'No registrado'
        }));

        const worksheetRegistro = XLSX.utils.json_to_sheet(datosRegistro);
        XLSX.utils.book_append_sheet(workbook, worksheetRegistro, 'Información de Registro');
        
        // Generar el archivo y descargarlo
        // Crear nombre de archivo con fecha actual
        const fecha = new Date();
        const fechaStr = `${fecha.getDate()}-${fecha.getMonth() + 1}-${fecha.getFullYear()}_${fecha.getHours()}-${fecha.getMinutes()}`;
        const fileName = `Personal_Filtrado_${fechaStr}.xlsx`;
        
        // Convertir a ArrayBuffer
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        
        // Crear un Blob a partir del ArrayBuffer
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Crear un enlace temporal para descargar
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Limpiar
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Ocultar cargando y mostrar notificación
        mostrarCargando(false);
        mostrarNotificacion(`Exportación exitosa: ${fileName}`, 'success');
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al exportar a Excel: ' + error.message, 'error');
    }
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
    
    // Event listener para exportar a Excel
    document.getElementById('exportToExcel').addEventListener('click', () => {
        if (filteredEmployees.length > 0) {
            exportarAExcel();
        } else {
            mostrarNotificacion('No hay datos para exportar', 'warning');
        }
    });
});

// Event listeners para el visor de fotos
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

// Hacer funciones disponibles globalmente
window.abrirVisorFoto = abrirVisorFoto;
window.cerrarVisorFoto = cerrarVisorFoto;
window.mostrarDetallesEmpleado = mostrarDetallesEmpleado;
window.editarEmpleado = editarEmpleado;
window.exportarAExcel = exportarAExcel;