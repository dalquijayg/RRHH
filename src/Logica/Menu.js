const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const Swal = require('sweetalert2');
const Chart = require('chart.js/auto');
const conexion = 'DSN=recursos2';

// Variables para seguimiento
let currentRegionId = 0; // 0 significa todas las regiones
let currentChart = null; // Para almacenar la referencia al gráfico actual
let departamentosData = []; // Para almacenar datos de departamentos
let personalNuevoWindow = null;
let notificationsData = [];

// Obtener datos del usuario de localStorage
const userData = JSON.parse(localStorage.getItem('userData'));

// Referencias a elementos DOM
const menuItems = document.querySelectorAll('.sidebar-nav > ul > li');
const submenus = document.querySelectorAll('.submenu');
const logoutBtn = document.getElementById('logoutBtn');
const logoutModal = document.getElementById('logoutModal');
const cancelLogout = document.getElementById('cancelLogout');
const confirmLogout = document.getElementById('confirmLogout');
const closeModal = document.querySelector('.close-modal');
const personalNuevoBtn = document.getElementById('personalNuevo');
const BusquetaPBtn = document.getElementById('BusquedaP');
const departmentDetailModal = document.getElementById('departmentDetailModal');
const closeDetailModalBtn = document.getElementById('closeDetailModal');
const modalCloseBtn = departmentDetailModal.querySelector('.close-modal');
const planillaEspecialBtn = document.getElementById('planillaEspecial');
const actualizarDepartamentoBtn = document.getElementById('actualizarDepartamentoBtn');
const registroEmbargoBtn = document.getElementById('registroEmbargoBtn');
const pagoNominaBtn = document.getElementById('pagoNominaBtn');
const SuspensionesBtn = document.getElementById('reporteSuspensiones');
const DescJudiciales = document.getElementById('reporteDescuentosJudiciales');
const ReportePlanillaEspecial = document.getElementById('reportePlanillaEspeciales');
const AsignacionPermisos = document.getElementById('asignarpermisos');
const Vacaciones = document.getElementById('registrarVacacionesBtn');
const PagoVacaciones = document.getElementById('solicitarPagoVacacionesBtn');
const GestionarVacaciones = document.getElementById('gestionarVacacionesBtn');
const GestionarPagoVacaciones = document.getElementById('procesarPagosVacacionesBtn');
const GestionProcesoPagoVacaciones = document.getElementById('gestionProcesoVacacionesBtn');
const PagoBonificaciones = document.getElementById('registrarAdicionalesBtn');
const reportebajas = document.getElementById('reporteBajasBtn');
const PagoLiquidacion = document.getElementById('pagoLiquidacionesBtn');
const ReportePlanillasContables = document.getElementById('reportePlanillasContables');
const GestionDocumentosPersonales = document.getElementById('gestionDocumentosPersonalBtn');
const ConsultarArchivos = document.getElementById('consultarArchivosBtn');
const PagoPlanillaParcial = document.getElementById('planillaTiempoParcialBtn');
const AutorizarPlanillasParciales = document.getElementById('autorizarPlanillasParcialesBtn')
const AutorizarLiquidaciones = document.getElementById('autorizarLiquidacionesBtn')
// Inicializar conexión con la base de datos
async function getConnection() {
    try {
        const connection = await odbc.connect(conexion);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error de conexión:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar a la base de datos. Por favor intente nuevamente.'
        });
        throw error;
    }
}
// Cargar información del usuario
function cargarInfoUsuario() {
    if (userData) {
        document.getElementById('userName').textContent = userData.NombreCompleto || 'Usuario';
        
        // Determinar rol según el puesto
        let rol = 'Usuario';
        if (userData.Id_Puesto === 5) {
            rol = 'Administrador RRHH';
        } else if (userData.Id_Puesto === 1) {
            rol = 'Gerente';
        } else if (userData.Id_Puesto === 140) {
            rol = 'Supervisor Dashboard';
        } else if ([94, 95, 175].includes(userData.Id_Puesto)) {
            rol = 'Encargado Regional';
        } else {
            rol = 'Colaborador';
        }
        
        document.getElementById('userRole').textContent = rol;
        
        // Cargar la imagen del usuario si está disponible
        if (userData.FotoBase64) {
            document.getElementById('userImage').src = userData.FotoBase64;
        }
        
        // Actualizar el saludo según la hora
        actualizarSaludo();
        setInterval(actualizarSaludo, 3600000);
        
        // NUEVA LÓGICA: Verificar tipo de dashboard
        if (verificarPermisosEncargadoRegional()) {
            mostrarDashboardRegional();
            return;
        } else if (!verificarPermisosDashboard()) {
            ocultarDashboardCompleto();
            return;
        }
    }
}
// Función para determinar el saludo según la hora
function actualizarSaludo() {
    const hora = new Date().getHours();
    let saludo, iconoSrc;
    
    if (hora >= 5 && hora < 12) {
        saludo = "Buen Día";
        iconoSrc = "../Imagenes/Buenosdias.png";
    } else if (hora >= 12 && hora < 18) {
        saludo = "Buena Tarde";
        iconoSrc = "../Imagenes/Buenastarde.png";
    } else {
        saludo = "Buenas Noches";
        iconoSrc = "../Imagenes/buenasnoches.png";
    }
    
    // Actualizar el título con el saludo
    const headerTitle = document.querySelector('.header-title h1');
    headerTitle.innerHTML = `
        <img src="${iconoSrc}" alt="${saludo}" class="saludo-icon">
        <span>${saludo}</span> - Sistema de Recursos Humanos
    `;
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

// Funciones para cargar datos estadísticos
async function cargarEstadisticas() {
    // Verificar permisos antes de cargar
    if (!verificarPermisosDashboard()) {
        return;
    }

    try {
        const connection = await getConnection();
        
        // Consulta para personal fijo (TipoPersonal = 1)
        const personalFijo = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE TipoPersonal = 1 AND Estado = 1
        `);
        
        // Consulta para personal parcial (TipoPersonal = 2)
        const personalParcial = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE TipoPersonal = 2 AND Estado = 1
        `);
        
        // Consulta para vacacionistas (TipoPersonal = 3)
        const vacacionistas = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE TipoPersonal = 3 AND Estado = 1
        `);
        
        // Consulta para total de personal activo
        const totalPersonal = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1
        `);
        
        await connection.close();
        
        // Actualizar los contadores en la UI
        document.getElementById('personalFijoCount').textContent = Number(personalFijo[0].total);
        document.getElementById('personalParcialCount').textContent = Number(personalParcial[0].total);
        document.getElementById('vacacionistasCount').textContent = Number(vacacionistas[0].total);
        document.getElementById('totalPersonalCount').textContent = Number(totalPersonal[0].total);
        
        // Cargar regiones
        await cargarRegiones();
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar las estadísticas'
        });
    }
}

// Cargar regiones
async function cargarRegiones() {
    // Verificar permisos antes de cargar
    if (!verificarPermisosDashboard()) {
        console.log('Sin permisos para cargar regiones');
        return;
    }

    try {
        const regionGrid = document.getElementById('regionGrid');
        
        // Mostrar carga
        regionGrid.querySelector('.region-loading').style.display = 'flex';
        
        const connection = await getConnection();
        
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
        
        // Ocultar carga
        regionGrid.querySelector('.region-loading').style.display = 'none';
        
        // Agregar las regiones al grid
        regiones.forEach(region => {
            const gridItem = document.createElement('button');
            gridItem.className = 'region-grid-item';
            gridItem.dataset.region = region.IdRegion;
            
            // Determinar el icono según el nombre (esto es personalizable)
            let icono = 'fas fa-map-marker-alt';
            
            gridItem.innerHTML = `
                <i class="${icono}"></i>
                <span>${region.NombreRegion}</span>
            `;
            
            gridItem.addEventListener('click', () => {
                // Eliminar clase activa de todos los items
                document.querySelectorAll('.region-grid-item').forEach(item => item.classList.remove('active'));
                
                // Agregar clase activa a este item
                gridItem.classList.add('active');
                
                // Actualizar región actual
                currentRegionId = Number(region.IdRegion);
                
                // Actualizar indicadores de región
                document.getElementById('currentRegionName').textContent = region.NombreRegion;
                document.getElementById('currentRegionNameEstado').textContent = region.NombreRegion;
                
                // Recargar gráficos y estados según la región seleccionada
                cargarGraficoDepartamentos(currentRegionId);
                cargarEstadoDepartamentos(currentRegionId);
            });
            
            regionGrid.appendChild(gridItem);
        });
        
        // Inicializar búsqueda de regiones
        inicializarBusquedaRegiones();
        
        // Asegurarse que la opción "Todas" esté activa inicialmente
        const todasRegionesItem = document.querySelector('.region-grid-item[data-region="0"]');
        if (todasRegionesItem) {
            todasRegionesItem.classList.add('active');
        }
        
        // Inicialmente cargar datos para todas las regiones
        cargarGraficoDepartamentos(0);
        cargarEstadoDepartamentos(0);
        
    } catch (error) {
        console.error('Error al cargar regiones:', error);
        mostrarNotificacion('Error al cargar las regiones', 'error');
    }
}
// Función para inicializar la búsqueda de regiones
function inicializarBusquedaRegiones() {
    const searchInput = document.getElementById('regionSearch');
    const clearSearchBtn = document.getElementById('clearRegionSearch');
    
    // Estado actual de la búsqueda
    let searchTerm = '';
    
    // Función para aplicar el filtro
    function filtrarRegiones() {
        const items = document.querySelectorAll('.region-grid-item:not([data-region="0"])'); // Excluir "Todas"
        let resultadosVisibles = 0;
        
        // Eliminar mensaje de no resultados si existe
        const noResultsMsg = document.querySelector('.no-regions-found');
        if (noResultsMsg) {
            noResultsMsg.remove();
        }
        
        // Aplicar filtro a cada región
        items.forEach(item => {
            const nombreRegion = item.querySelector('span').textContent.toLowerCase();
            
            if (!searchTerm || nombreRegion.includes(searchTerm.toLowerCase())) {
                item.classList.remove('filtered');
                resultadosVisibles++;
            } else {
                item.classList.add('filtered');
            }
        });
        
        // Mostrar mensaje si no hay resultados
        if (resultadosVisibles === 0 && searchTerm) {
            const noResults = document.createElement('div');
            noResults.className = 'no-regions-found';
            noResults.innerHTML = '<i class="fas fa-search"></i> No se encontraron regiones';
            document.getElementById('regionGrid').appendChild(noResults);
        }
    }
    
    // Event listener para búsqueda
    searchInput.addEventListener('input', () => {
        searchTerm = searchInput.value.trim();
        
        // Mostrar/ocultar botón de limpiar
        if (searchTerm) {
            clearSearchBtn.classList.add('visible');
        } else {
            clearSearchBtn.classList.remove('visible');
        }
        
        // Aplicar filtro
        filtrarRegiones();
    });
    
    // Event listener para limpiar búsqueda
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchTerm = '';
        clearSearchBtn.classList.remove('visible');
        
        // Aplicar filtro
        filtrarRegiones();
    });
}
// Función para cargar el estado de departamentos por región
async function cargarEstadoDepartamentos(regionId = 0) {
    try {
        // Mostrar estado de carga en las tarjetas de estado
        document.getElementById('deptosCompletosCount').textContent = '...';
        document.getElementById('deptosFaltantesCount').textContent = '...';
        document.getElementById('deptosSobrantesCount').textContent = '...';
        document.getElementById('deptosSinAsignarCount').textContent = '...';
        
        // Botón de refrescar con spinner
        const refreshBtn = document.getElementById('refreshEstadoBtn');
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.add('fa-spin');
        }
        
        const connection = await getConnection();
        
        // Consulta condicional dependiendo de si se seleccionó una región
        let query = `
            SELECT 
                IdDepartamento,
                NombreDepartamento,
                CantFijos,
                CantParciales,
                CantVacacionista,
                IdRegion
            FROM 
                departamentos
        `;
        
        // Si se especificó una región, filtrar por ella
        if (regionId > 0) {
            query += ` WHERE IdRegion = ${regionId}`;
        }
        
        query += ` ORDER BY NombreDepartamento`;
        
        // 1. Consulta para obtener los departamentos con sus cantidades asignadas
        const departamentos = await connection.query(query);
        
        // 2. Consulta para obtener el conteo real por departamento y tipo
        let personalQuery = `
            SELECT 
                d.IdDepartamento,
                d.NombreDepartamento,
                SUM(CASE WHEN p.TipoPersonal = 1 THEN 1 ELSE 0 END) AS TotalFijos,
                SUM(CASE WHEN p.TipoPersonal = 2 THEN 1 ELSE 0 END) AS TotalParciales,
                SUM(CASE WHEN p.TipoPersonal = 3 THEN 1 ELSE 0 END) AS TotalVacacionistas
            FROM 
                departamentos d
                LEFT JOIN personal p ON d.IdDepartamento = p.IdSucuDepa AND p.Estado = 1
        `;
        
        // Si se especificó una región, filtrar por ella
        if (regionId > 0) {
            personalQuery += ` WHERE d.IdRegion = ${regionId}`;
        }
        
        personalQuery += `
            GROUP BY 
                d.IdDepartamento,
                d.NombreDepartamento
            ORDER BY 
                d.NombreDepartamento
        `;
        
        const personalPorDepto = await connection.query(personalQuery);
        
        await connection.close();
        
        // Combinar los resultados para el análisis
        const resultados = departamentos.map(depto => {
            // Encontrar el registro correspondiente en personalPorDepto
            const actual = personalPorDepto.find(item => Number(item.IdDepartamento) === Number(depto.IdDepartamento)) || {
                TotalFijos: 0,
                TotalParciales: 0,
                TotalVacacionistas: 0
            };
            
            // Convertir BigInt a Number para evitar problemas
            const cantFijos = Number(depto.CantFijos);
            const cantParciales = Number(depto.CantParciales);
            const cantVacacionista = Number(depto.CantVacacionista);
            
            const totalFijos = Number(actual.TotalFijos);
            const totalParciales = Number(actual.TotalParciales);
            const totalVacacionistas = Number(actual.TotalVacacionistas);
            
            // Determinar estado para cada tipo
            const estadoFijos = determinarEstado(cantFijos, totalFijos);
            const estadoParciales = determinarEstado(cantParciales, totalParciales);
            const estadoVacacionistas = determinarEstado(cantVacacionista, totalVacacionistas);
            
            // Determinar estado general
            let estadoGeneral;
            if (estadoFijos.tipo === 'no-data' && estadoParciales.tipo === 'no-data' && estadoVacacionistas.tipo === 'no-data') {
                estadoGeneral = {
                    tipo: 'no-data',
                    mensaje: 'Sin asignación de personal',
                    icon: 'info-circle'
                };
            } else if (estadoFijos.tipo === 'deficit' || estadoParciales.tipo === 'deficit' || estadoVacacionistas.tipo === 'deficit') {
                estadoGeneral = {
                    tipo: 'deficit',
                    mensaje: 'Falta personal',
                    icon: 'exclamation-circle'
                };
            } else if (estadoFijos.tipo === 'excess' || estadoParciales.tipo === 'excess' || estadoVacacionistas.tipo === 'excess') {
                estadoGeneral = {
                    tipo: 'excess',
                    mensaje: 'Excedente de personal',
                    icon: 'exclamation-triangle'
                };
            } else {
                estadoGeneral = {
                    tipo: 'complete',
                    mensaje: 'Personal completo',
                    icon: 'check-circle'
                };
            }
            
            return {
                id: depto.IdDepartamento,
                nombre: depto.NombreDepartamento,
                fijos: {
                    objetivo: cantFijos,
                    actual: totalFijos,
                    estado: estadoFijos
                },
                parciales: {
                    objetivo: cantParciales,
                    actual: totalParciales,
                    estado: estadoParciales
                },
                vacacionistas: {
                    objetivo: cantVacacionista,
                    actual: totalVacacionistas,
                    estado: estadoVacacionistas
                },
                estadoGeneral: estadoGeneral
            };
        });
        
        // Guardar los datos para uso posterior
        departamentosData = resultados;
        
        // Contar departamentos por estado
        const conteos = contarDepartamentosPorEstado(resultados);
        
        // Actualizar contadores en las tarjetas
        document.getElementById('deptosCompletosCount').textContent = conteos.complete;
        document.getElementById('deptosFaltantesCount').textContent = conteos.deficit;
        document.getElementById('deptosSobrantesCount').textContent = conteos.excess;
        document.getElementById('deptosSinAsignarCount').textContent = conteos.noData;
        
        // Detener spinner del botón de refrescar
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.remove('fa-spin');
        }
        
        // Mostrar notificación de éxito si el botón de refrescar fue presionado
        if (document.querySelector('.fa-sync-alt.fa-spin')) {
            setTimeout(() => {
                mostrarNotificacion('Datos actualizados correctamente', 'success');
            }, 500);
        }
        if (!verificarPermisosDashboard()) {
            console.log('Sin permisos para cargar estado de departamentos');
            return;
        }
        
    } catch (error) {
        console.error('Error al cargar estado de departamentos:', error);
        
        // Mostrar error en los contadores
        document.getElementById('deptosCompletosCount').textContent = '0';
        document.getElementById('deptosFaltantesCount').textContent = '0';
        document.getElementById('deptosSobrantesCount').textContent = '0';
        document.getElementById('deptosSinAsignarCount').textContent = '0';
        
        // Detener spinner del botón de refrescar
        const refreshBtn = document.getElementById('refreshEstadoBtn');
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.remove('fa-spin');
        }
        
        // Mostrar notificación de error
        mostrarNotificacion('Error al cargar los datos. Por favor, intente nuevamente.', 'error');
    }
}

// Función para contar departamentos por estado
function contarDepartamentosPorEstado(departamentos) {
    return departamentos.reduce((conteos, depto) => {
        const tipo = depto.estadoGeneral.tipo;
        
        if (tipo === 'complete') {
            conteos.complete++;
        } else if (tipo === 'deficit') {
            conteos.deficit++;
        } else if (tipo === 'excess') {
            conteos.excess++;
        } else if (tipo === 'no-data') {
            conteos.noData++;
        }
        
        return conteos;
    }, { complete: 0, deficit: 0, excess: 0, noData: 0 });
}

// Función auxiliar para determinar el estado de cada tipo de personal
function determinarEstado(objetivo, actual) {
    if (objetivo === 0) {
        return {
            tipo: 'no-data',
            mensaje: 'Sin asignación'
        };
    }
    
    if (actual === objetivo) {
        return {
            tipo: 'complete',
            mensaje: 'Completo'
        };
    } else if (actual < objetivo) {
        const faltantes = objetivo - actual;
        return {
            tipo: 'deficit',
            mensaje: `Faltan ${faltantes}`
        };
    } else {
        const sobrantes = actual - objetivo;
        return {
            tipo: 'excess',
            mensaje: `Sobrantes ${sobrantes}`
        };
    }
}

// Mostrar modal con detalles de departamentos según el tipo
function mostrarDetallesDepartamentos(tipo) {
    const modalTitle = document.getElementById('modalDepartmentType');
    const modalBody = document.getElementById('modalDepartmentList');
    
    // Ajustar título según el tipo
    let titulo = 'Departamentos';
    switch (tipo) {
        case 'complete':
            titulo = 'Departamentos Completos';
            break;
        case 'deficit':
            titulo = 'Departamentos con Faltantes';
            break;
        case 'excess':
            titulo = 'Departamentos con Excedentes';
            break;
        case 'no-data':
            titulo = 'Departamentos Sin Asignar';
            break;
    }
    
    modalTitle.textContent = titulo;
    
    // Filtrar departamentos según el tipo
    const departamentosFiltrados = departamentosData.filter(depto => depto.estadoGeneral.tipo === tipo);
    
    // Mostrar contenido en el modal
    if (departamentosFiltrados.length === 0) {
        modalBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-folder-open fa-3x"></i>
                        <p>No hay departamentos en esta categoría</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        modalBody.innerHTML = '';
        
        departamentosFiltrados.forEach((depto, index) => {
            // Crear celdas de personal
            const celdaFijos = crearCeldaPersonal(depto.fijos);
            const celdaParciales = crearCeldaPersonal(depto.parciales);
            const celdaVacacionistas = crearCeldaPersonal(depto.vacacionistas);
            
            // Crear celda de estado general
            const estadoClase = depto.estadoGeneral.tipo;
            const iconoEstado = depto.estadoGeneral.icon;
            const mensajeEstado = depto.estadoGeneral.mensaje;
            
            const celdaEstado = `
                <td>
                    <div class="estado-badge ${estadoClase}">
                        <i class="fas fa-${iconoEstado}"></i>
                        <span>${mensajeEstado}</span>
                    </div>
                </td>
            `;
            
            // Crear fila
            const tr = document.createElement('tr');
            tr.className = 'animate__animated animate__fadeIn';
            tr.style.animationDelay = `${index * 0.05}s`;
            
            tr.innerHTML = `
                <td>${depto.nombre}</td>
                ${celdaFijos}
                ${celdaParciales}
                ${celdaVacacionistas}
                ${celdaEstado}
            `;
            
            modalBody.appendChild(tr);
        });
    }
    
    // Mostrar el modal
    departmentDetailModal.classList.add('show');
}

// Función para crear celdas de personal con indicadores
function crearCeldaPersonal(datos) {
    if (datos.objetivo === 0) {
        return `
            <td>
                <div class="personal-count">
                    <span class="count-value">0</span>
                    <span class="count-indicator no-data" title="Sin asignación"></span>
                </div>
            </td>
        `;
    }
    
    const claseIndicador = datos.estado.tipo;
    const tooltipMensaje = datos.estado.mensaje;
    
    return `
        <td>
            <div class="personal-count tooltip">
                <span class="count-value">${datos.actual}</span>
                <span class="count-target">/ ${datos.objetivo}</span>
                <span class="count-indicator ${claseIndicador}"></span>
                <span class="tooltiptext">${tooltipMensaje}</span>
            </div>
        </td>
    `;
}

// Cargar gráficos
async function cargarGraficoDepartamentos(regionId = 0) {
    // Verificar permisos antes de cargar
    if (!verificarPermisosDashboard()) {
        console.log('Sin permisos para cargar gráfico de departamentos');
        return;
    }

    // ... resto del código existente de la función se mantiene igual
    try {
        // Mostrar spinner en el botón de refrescar
        const refreshBtn = document.getElementById('refreshChartBtn');
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.add('fa-spin');
        }
        
        // Mostrar carga
        document.querySelector('#deptoChart .chart-loading').style.display = 'flex';
        
        const connection = await getConnection();
        
        // Consulta para obtener personal por departamento/sucursal
        let query = `
            SELECT 
                d.NombreDepartamento, 
                COUNT(p.IdPersonal) AS total
            FROM 
                personal p
                INNER JOIN departamentos d ON p.IdSucuDepa = d.IdDepartamento
            WHERE 
                p.Estado = 1
        `;
        
        // Si se especificó una región, filtrar por ella
        if (regionId > 0) {
            query += ` AND d.IdRegion = ${regionId}`;
        }
        
        query += `
            GROUP BY 
                d.NombreDepartamento
            ORDER BY 
                total DESC
            LIMIT 7
        `;
        
        const datos = await connection.query(query);
        
        await connection.close();
        
        // Preparar datos para el gráfico
        const labels = datos.map(item => item.NombreDepartamento);
        // Convertir BigInt a Number
        const values = datos.map(item => Number(item.total));
        
        // Ocultar el loading
        document.querySelector('#deptoChart .chart-loading').style.display = 'none';
        
        // Destruir el gráfico anterior si existe
        if (currentChart) {
            currentChart.destroy();
        }
        
        // Limpiar el contenedor
        const chartContainer = document.getElementById('deptoChart');
        while (chartContainer.childElementCount > 1) { // Mantener solo el div de carga
            chartContainer.removeChild(chartContainer.lastChild);
        }
        
        // Crear el nuevo canvas
        const ctx = document.createElement('canvas');
        chartContainer.appendChild(ctx);
        
        // Crear el gráfico usando Chart.js
        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Personal por Departamento',
                    data: values,
                    backgroundColor: [
                        'rgba(255, 82, 82, 0.7)',
                        'rgba(68, 138, 255, 0.7)',
                        'rgba(76, 175, 80, 0.7)',
                        'rgba(255, 193, 7, 0.7)',
                        'rgba(255, 152, 0, 0.7)',
                        'rgba(233, 30, 99, 0.7)',
                        'rgba(103, 58, 183, 0.7)'
                    ],
                    borderColor: [
                        'rgb(255, 82, 82)',
                        'rgb(68, 138, 255)',
                        'rgb(76, 175, 80)',
                        'rgb(255, 193, 7)',
                        'rgb(255, 152, 0)',
                        'rgb(233, 30, 99)',
                        'rgb(103, 58, 183)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
        
        // Ocultar spinner en el botón de refrescar
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.remove('fa-spin');
        }
        
    } catch (error) {
        console.error('Error al cargar gráfico de departamentos:', error);
        document.querySelector('#deptoChart .chart-loading').innerHTML = 
            '<i class="fas fa-exclamation-circle"></i><span>Error al cargar el gráfico</span>';
            
        // Ocultar spinner en el botón de refrescar
        const refreshBtn = document.getElementById('refreshChartBtn');
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.remove('fa-spin');
        }
    }
}

// Funciones para el manejo del menú
function toggleSubMenu(item) {
    // Verificar si este item ya está activo
    const isActive = item.classList.contains('active');
    
    // Cerrar todos los submenús activos
    menuItems.forEach(item => {
        if (item.querySelector('.submenu')) {
            item.classList.remove('active');
        }
    });
    
    // Si el item no estaba activo, abrirlo
    if (!isActive && item.querySelector('.submenu')) {
        item.classList.add('active');
    }
}

// Event listeners para el menú
menuItems.forEach(item => {
    if (item.querySelector('.submenu')) {
        item.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            toggleSubMenu(item);
        });
    }
});

// Event listeners para modales
logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    logoutModal.classList.add('show');
});

cancelLogout.addEventListener('click', () => {
    logoutModal.classList.remove('show');
});

closeModal.addEventListener('click', () => {
    logoutModal.classList.remove('show');
});

confirmLogout.addEventListener('click', () => {
    // Limpiar datos de sesión
    localStorage.removeItem('userData');
    
    // Mostrar notificación
    mostrarNotificacion('Cerrando sesión...', 'info');
    
    // Redireccionar a la página de login después de un breve retraso
    setTimeout(() => {
        window.location.href = '../Vistas/Login.html';
    }, 1000);
});

// Event listeners para el modal de detalles de departamentos
closeDetailModalBtn.addEventListener('click', () => {
    departmentDetailModal.classList.remove('show');
});

modalCloseBtn.addEventListener('click', () => {
    departmentDetailModal.classList.remove('show');
});

// Click fuera del modal para cerrarlo
departmentDetailModal.addEventListener('click', (e) => {
    if (e.target === departmentDetailModal) {
        departmentDetailModal.classList.remove('show');
    }
});

// Click fuera del modal para cerrarlo (Logout)
logoutModal.addEventListener('click', (e) => {
    if (e.target === logoutModal) {
        logoutModal.classList.remove('show');
    }
});

// Navegación entre páginas
personalNuevoBtn.addEventListener('click', () => {
    mostrarNotificacion('Abriendo formulario de nuevo personal...', 'info');
    // Usar ipcRenderer para comunicarse con el proceso principal
    ipcRenderer.send('open_personal_nuevo');
});
BusquetaPBtn.addEventListener('click',()=>{
    ipcRenderer.send('open_personal_busqueda');
});
planillaEspecialBtn.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 104
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Planilla Especial...', 'success');
            ipcRenderer.send('open_planilla_dominical');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
actualizarDepartamentoBtn.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 105
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Actualizar Departamento...', 'success');
            ipcRenderer.send('open_actualizar_departamento');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
// Event listener para el botón de Pago Nómina
pagoNominaBtn.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual desde localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData || !userData.IdPersonal) {
            throw new Error('Datos de usuario no disponibles');
        }
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ? AND Codigo = 106
        `;
        
        const resultado = await connection.query(permisosQuery, [userData.IdPersonal]);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Pago Nómina...', 'success');
            ipcRenderer.send('open_pago_nomina');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a Pago Nómina.',
                confirmButtonColor: '#FF9800'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
        
        // Mostrar mensaje de error más detallado
        Swal.fire({
            icon: 'error',
            title: 'Error de verificación',
            text: 'No se pudieron verificar los permisos. Por favor, intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
});
registroEmbargoBtn.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 107
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Embargo Salarial...', 'success');
            ipcRenderer.send('open_embargo_Salarial');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
SuspensionesBtn.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 108
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Embargo Salarial...', 'success');
            ipcRenderer.send('open_Reporte_Suspensiones');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
DescJudiciales.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 109
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Embargo Salarial...', 'success');
            ipcRenderer.send('open_Reporte_DescuentosJudiciales');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
ReportePlanillaEspecial.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 110
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Embargo Salarial...', 'success');
            ipcRenderer.send('open_Reporte_PlanillaEspecial');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
AsignacionPermisos.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 112
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Embargo Salarial...', 'success');
            ipcRenderer.send('open_Ventana_Permisos');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
Vacaciones.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 113
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Vacaciones...', 'success');
            ipcRenderer.send('open_Ventana_Vacaciones');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
PagoVacaciones.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 114
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Pago Vacaciones...', 'success');
            ipcRenderer.send('open_Ventana_PagoVacaciones');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
GestionarVacaciones.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 115
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Vacaciones...', 'success');
            ipcRenderer.send('open_Ventana_GestionVacaciones');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
GestionarPagoVacaciones.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 116
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Pago Vacaciones...', 'success');
            ipcRenderer.send('open_Ventana_GestionPagoVacaciones');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
GestionProcesoPagoVacaciones.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 117
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Procesos Pagos...', 'success');
            ipcRenderer.send('open_Ventana_GestionPagosVacaciones');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
PagoBonificaciones.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 118
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Pagos Bonificaciones...', 'success');
            ipcRenderer.send('open_Ventana_Pagosbonis');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad.'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
reportebajas.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 119
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Reporte de Bajas...', 'success');
            ipcRenderer.send('open_Ventana_Bajas');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad. Trans.119'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
PagoLiquidacion.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 120
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Pago de Liquidación...', 'success');
            ipcRenderer.send('open_Ventana_PagoLiquidacion');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad. Trans.120'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
ReportePlanillasContables.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 122
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Reporte de Planilla Contable...', 'success');
            ipcRenderer.send('open_Ventana_ReportePlanillaContable');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad. Trans.122'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
GestionDocumentosPersonales.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 123
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Gestion de Documentos...', 'success');
            ipcRenderer.send('open_Ventana_GestionDocPersonales');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad. Trans.123'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
ConsultarArchivos.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 124
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Consultar Documentos...', 'success');
            ipcRenderer.send('open_Ventana_ConsultarDocPersonales');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad. Trans.124'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
PagoPlanillaParcial.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 125
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Pago Planilla colaboradores parciales...', 'success');
            ipcRenderer.send('open_Ventana_PagoPlanillaParciales');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad. Trans.125'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
AutorizarPlanillasParciales.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 126
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Autorización Planillas Paricales...', 'success');
            ipcRenderer.send('open_Ventana_AutorizarPagoParciales');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad. Trans.126'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
AutorizarLiquidaciones.addEventListener('click', async () => {
    try {
        // Mostrar notificación de verificación
        mostrarNotificacion('Verificando permisos...', 'info');
        
        // Obtener el ID del usuario actual
        const idPersonal = userData.IdPersonal;
        
        // Verificar permisos en la base de datos
        const connection = await getConnection();
        
        const permisosQuery = `
            SELECT COUNT(*) AS tienePermiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ${idPersonal} AND Codigo = 127
        `;
        
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        // Verificar si tiene permiso (si el conteo es mayor a 0)
        if (resultado[0].tienePermiso > 0) {
            // Tiene permiso, abrir la ventana
            mostrarNotificacion('Abriendo Autorización de Liquidaciones...', 'success');
            ipcRenderer.send('open_Ventana_AutorizarLiquidacion');
        } else {
            // No tiene permiso, mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: 'No tienes permisos para acceder a esta funcionalidad. Trans.127'
            });
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});
// Event listeners para las tarjetas de estado
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-details');
    if (btn) {
        const tipo = btn.dataset.type;
        mostrarDetallesDepartamentos(tipo);
    }
});

// Event listeners para botones de refrescar
document.getElementById('refreshRegionesBtn').addEventListener('click', () => {
    const btn = document.getElementById('refreshRegionesBtn');
    btn.querySelector('i').classList.add('fa-spin');
    
    // Limpiar el grid de regiones
    const regionGrid = document.getElementById('regionGrid');
    regionGrid.innerHTML = `
        <button class="region-grid-item active" data-region="0">
            <i class="fas fa-globe-americas"></i>
            <span>Todas</span>
        </button>
        <div class="region-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Cargando regiones...</span>
        </div>
    `;
    
    // Recargar regiones
    cargarRegiones().then(() => {
        btn.querySelector('i').classList.remove('fa-spin');
        mostrarNotificacion('Regiones actualizadas correctamente', 'success');
    });
});

document.getElementById('refreshChartBtn').addEventListener('click', () => {
    cargarGraficoDepartamentos(currentRegionId);
});

document.getElementById('refreshEstadoBtn').addEventListener('click', () => {
    cargarEstadoDepartamentos(currentRegionId);
});

// Inicializar efectos visuales
function inicializarEfectosVisuales() {
    // Agregar efecto de hover a las tarjetas de estadísticas
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        const icon = card.querySelector('.stat-icon');
        if (icon) {
            card.addEventListener('mouseenter', () => {
                icon.style.transform = 'scale(1.15) rotate(5deg)';
            });
            
            card.addEventListener('mouseleave', () => {
                icon.style.transform = 'scale(1) rotate(0)';
            });
        }
    });
    
    // Animación para los botones de refrescar
    const refreshBtns = document.querySelectorAll('.btn-card-action[title="Actualizar"]');
    refreshBtns.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            if (!btn.querySelector('i').classList.contains('fa-spin')) {
                btn.querySelector('i').style.transform = 'rotate(180deg)';
            }
        });
        
        btn.addEventListener('mouseleave', () => {
            if (!btn.querySelector('i').classList.contains('fa-spin')) {
                btn.querySelector('i').style.transform = 'rotate(0)';
            }
        });
    });
    
    // Efecto hover para tarjetas de estado
    const estadoCards = document.querySelectorAll('.estado-card');
    estadoCards.forEach(card => {
        const icon = card.querySelector('.estado-card-icon i');
        if (icon) {
            card.addEventListener('mouseenter', () => {
                icon.style.transform = 'scale(1.2)';
            });
            
            card.addEventListener('mouseleave', () => {
                icon.style.transform = 'scale(1)';
            });
        }
    });
}
function abrirVentanaPersonalNuevo() {
    // Si la ventana ya existe, la enfocamos en lugar de crear una nueva
    if (personalNuevoWindow) {
        if (personalNuevoWindow.isMinimized()) personalNuevoWindow.restore();
        personalNuevoWindow.focus();
        return;
    }
    // Usar la API de Electron para abrir una nueva ventana
    setTimeout(() => {
        // Enviar mensaje al proceso principal para crear una nueva ventana
        ipcRenderer.send('abrir-personal-nuevo');
    }, 500);
}
function abrirVentanaBusquedaP() {
    // Si la ventana ya existe, la enfocamos en lugar de crear una nueva
    if (personalNuevoWindow) {
        if (personalNuevoWindow.isMinimized()) personalNuevoWindow.restore();
        personalNuevoWindow.focus();
        return;
    }
    // Usar la API de Electron para abrir una nueva ventana
    setTimeout(() => {
        // Enviar mensaje al proceso principal para crear una nueva ventana
        ipcRenderer.send('abrir-personal-nuevo');
    }, 500);
}
async function cargarNotificaciones() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        
        // Verificar si es encargado regional
        if ([94, 95, 175].includes(userData.Id_Puesto)) {
            // Cargar notificaciones específicas para encargados regionales
            const notificacionesRegionales = await cargarNotificacionesRegionales();
            
            // Actualizar el badge de notificaciones
            actualizarBadgeNotificacionesRegionales(notificacionesRegionales);
            
            // Renderizar las notificaciones
            renderizarNotificacionesRegionales(notificacionesRegionales);
            
            return;
        }
        
        // CÓDIGO ORIGINAL para otros usuarios (ID_Puesto = 140)
        if (userData.Id_Puesto !== 140) {
            // Cargar notificaciones específicas para usuarios básicos
            const notificacionesBasicas = await cargarNotificacionesBasicas();
            
            // Actualizar el badge de notificaciones
            actualizarBadgeNotificacionesBasicas(notificacionesBasicas);
            
            // Renderizar las notificaciones
            renderizarNotificacionesBasicas(notificacionesBasicas);
            
            return;
        }
        
        // Código original para usuarios con ID_Puesto = 140
        const connection = await getConnection();
        
        // 1. Colaboradores con Tarjeta de Manipulación vencida
        const tmVencidas = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND
            TipoPersonal = 1
            AND FechaVencimientoTM IS NOT NULL 
            AND FechaVencimientoTM < CURDATE()
        `);
        
        // 2. Colaboradores con Tarjeta de Salud vencida
        const tsVencidas = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND
            TipoPersonal = 1
            AND FechaVencimientoTS IS NOT NULL 
            AND FechaVencimientoTS < CURDATE()
        `);
        
        // 3. Colaboradores sin Tarjeta de Manipulación
        const sinTM = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND
            TipoPersonal = 1
            AND FechaVencimientoTM IS NULL
        `);
        
        // 4. Colaboradores sin Tarjeta de Salud
        const sinTS = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND
            TipoPersonal = 1
            AND FechaVencimientoTS IS NULL
        `);
        
        // 5. Colaboradores sin contrato
        const sinContrato = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND
            TipoPersonal = 1
            AND Contrato = 0
        `);
        
        // 6. Colaboradores fuera de planilla
        const fueraPlanilla = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND
            TipoPersonal = 1
            AND IdPlanilla = 0
        `);
        
        // 7. Colaboradores sin número de IGSS
        const sinIGSS = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 
            AND IGSS = 0
        `);
        
        // 8. Colaboradores sin número de IRTRA
        const sinIRTRA = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 
            AND IRTRA = 0
        `);
        
        await connection.close();
        
        // Preparar los datos de notificaciones (código original)
        notificationsData = [
            {
                id: 1,
                icon: 'utensils',
                color: 'danger',
                title: 'Tarjetas de Manipulación Vencidas',
                count: Number(tmVencidas[0].total),
                description: `${tmVencidas[0].total} colaboradores con tarjeta de manipulación vencida`,
                link: '#personalTMVencida'
            },
            {
                id: 2,
                icon: 'medkit',
                color: 'danger',
                title: 'Tarjetas de Salud Vencidas',
                count: Number(tsVencidas[0].total),
                description: `${tsVencidas[0].total} colaboradores con tarjeta de salud vencida`,
                link: '#personalTSVencida'
            },
            {
                id: 3,
                icon: 'utensils',
                color: 'warning',
                title: 'Sin Tarjeta de Manipulación',
                count: Number(sinTM[0].total),
                description: `${sinTM[0].total} colaboradores sin tarjeta de manipulación`,
                link: '#personalSinTM'
            },
            {
                id: 4,
                icon: 'medkit',
                color: 'warning',
                title: 'Sin Tarjeta de Salud',
                count: Number(sinTS[0].total),
                description: `${sinTS[0].total} colaboradores sin tarjeta de salud`,
                link: '#personalSinTS'
            },
            {
                id: 5,
                icon: 'file-contract',
                color: 'info',
                title: 'Sin Contrato',
                count: Number(sinContrato[0].total),
                description: `${sinContrato[0].total} colaboradores sin contrato`,
                link: '#personalSinContrato'
            },
            {
                id: 6,
                icon: 'clipboard-list',
                color: 'info',
                title: 'Fuera de Planilla',
                count: Number(fueraPlanilla[0].total),
                description: `${fueraPlanilla[0].total} colaboradores fuera de planilla`,
                link: '#personalFueraPlanilla'
            },
            {
                id: 7,
                icon: 'hospital',
                color: 'warning',
                title: 'Sin Número de IGSS',
                count: Number(sinIGSS[0].total),
                description: `${sinIGSS[0].total} colaboradores sin número de IGSS`,
                link: '#personalSinIGSS'
            },
            {
                id: 8,
                icon: 'id-card',
                color: 'warning',
                title: 'Sin Número de IRTRA',
                count: Number(sinIRTRA[0].total),
                description: `${sinIRTRA[0].total} colaboradores sin número de IRTRA`,
                link: '#personalSinIRTRA'
            }
        ];
        
        // Actualizar el badge de notificaciones
        actualizarBadgeNotificaciones();
        
        // Renderizar las notificaciones
        renderizarNotificaciones();
        
    } catch (error) {
        console.error('Error al cargar notificaciones:', error);
        mostrarNotificacion('Error al cargar las notificaciones', 'error');
    }
}
async function cargarNotificacionesBasicas() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        const departamentoUsuario = userData.IdSucuDepa;
        
        const connection = await getConnection();
        
        // ===== CONSULTA 1: ANIVERSARIOS (esta se mantiene igual) =====
        const notificacionesQuery = `
            SELECT 
                p.IdPersonal,
                CONCAT(p.PrimerNombre, ' ', IFNULL(p.SegundoNombre, ''), ' ', p.PrimerApellido, ' ', IFNULL(p.SegundoApellido, '')) AS NombreCompleto,
                d.NombreDepartamento,
                p.FechaPlanilla,
                TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) AS AniosActuales,
                TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) + 1 AS ProximosAnios,
                DATEDIFF(
                    DATE_ADD(p.FechaPlanilla, INTERVAL (TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) + 1) YEAR),
                    CURDATE()
                ) AS DiasParaAniversario,
                DATE_ADD(p.FechaPlanilla, INTERVAL (TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) + 1) YEAR) AS FechaAniversario,
                (TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) * 15) - 
                    IFNULL((SELECT COUNT(*) FROM vacacionestomadas WHERE IdPersonal = p.IdPersonal), 0) -
                    IFNULL((SELECT SUM(CAST(DiasSolicitado AS UNSIGNED)) FROM vacacionespagadas 
                            WHERE IdPersonal = p.IdPersonal AND Estado IN (1,2,3,4)), 0)
                AS DiasVacacionesAcumulados,
                puestos.Nombre AS NombrePuesto,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN 1
                    ELSE 0 
                END AS TieneFoto
            FROM 
                personal p
                INNER JOIN departamentos d ON p.IdSucuDepa = d.IdDepartamento
                INNER JOIN Puestos puestos ON p.IdPuesto = puestos.IdPuesto
                LEFT JOIN FotosPersonal ON p.IdPersonal = FotosPersonal.IdPersonal
            WHERE 
                p.IdSucuDepa = ?
                AND p.Estado = 1
                AND p.TipoPersonal = 1
                AND p.FechaPlanilla IS NOT NULL
                AND DATEDIFF(
                    DATE_ADD(p.FechaPlanilla, INTERVAL (TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) + 1) YEAR),
                    CURDATE()
                ) BETWEEN 1 AND 90
            ORDER BY 
                DiasParaAniversario ASC, p.PrimerNombre
        `;
        
        const colaboradores = await connection.query(notificacionesQuery, [departamentoUsuario]);
        
        // ===== CONSULTA 2: PLANILLAS AUTORIZADAS (CORREGIDA) =====
        const planillasAutorizadasQuery = `
            SELECT 
                p.IdPlanillaParcial,
                p.PeriodoPago,
                p.MontoPlanillaParcial,
                p.CantidadColaboradores,
                p.FechaRegistro,
                p.FechaAutorizacion,
                p.NombreUsuario,
                d.NombreDepartamento,
                DATEDIFF(CURDATE(), DATE(p.FechaAutorizacion)) AS DiasDesdeAutorizacion
            FROM 
                PagoPlanillaParcial p
                INNER JOIN departamentos d ON p.IdDepartamentoSucursal = d.IdDepartamento
            WHERE 
                p.IdDepartamentoSucursal = ?
                AND p.Estado = 1
                AND p.FechaAutorizacion IS NOT NULL
                AND DATEDIFF(CURDATE(), DATE(p.FechaAutorizacion)) <= 7
            ORDER BY 
                p.FechaAutorizacion DESC
        `;
        
        const planillasAutorizadas = await connection.query(planillasAutorizadasQuery, [departamentoUsuario]);
        
        await connection.close();
        
        // ===== PROCESAR NOTIFICACIONES =====
        const notificaciones = [];
        
        // 1. AGREGAR NOTIFICACIONES DE PLANILLAS AUTORIZADAS (PRIORIDAD ALTA)
        if (planillasAutorizadas.length > 0) {
            // Agrupar por urgencia
            const planillasRecientes = planillasAutorizadas.filter(p => Number(p.DiasDesdeAutorizacion) <= 3);
            const planillasNormales = planillasAutorizadas.filter(p => Number(p.DiasDesdeAutorizacion) > 3);
            
            // Planillas muy recientes (últimos 3 días)
            if (planillasRecientes.length > 0) {
                notificaciones.push({
                    id: 'planillas_autorizadas_recientes',
                    icon: 'check-circle',
                    color: 'success',
                    title: 'Planillas Autorizadas Recientemente',
                    count: planillasRecientes.length,
                    description: `${planillasRecientes.length} planilla${planillasRecientes.length !== 1 ? 's' : ''} parcial${planillasRecientes.length !== 1 ? 'es' : ''} autorizada${planillasRecientes.length !== 1 ? 's' : ''} lista${planillasRecientes.length !== 1 ? 's' : ''} para descargar`,
                    data: planillasRecientes,
                    tipo: 'planillas_autorizadas',
                    urgencia: 'alta'
                });
            }
            
            // Planillas autorizadas (últimos 7 días)
            if (planillasNormales.length > 0) {
                notificaciones.push({
                    id: 'planillas_autorizadas_normales',
                    icon: 'file-check',
                    color: 'info',
                    title: 'Planillas Disponibles para Descarga',
                    count: planillasNormales.length,
                    description: `${planillasNormales.length} planilla${planillasNormales.length !== 1 ? 's' : ''} parcial${planillasNormales.length !== 1 ? 'es' : ''} autorizada${planillasNormales.length !== 1 ? 's' : ''} pendiente${planillasNormales.length !== 1 ? 's' : ''} de descarga`,
                    data: planillasNormales,
                    tipo: 'planillas_autorizadas',
                    urgencia: 'normal'
                });
            }
        }
        
        // 2. AGREGAR NOTIFICACIONES DE ANIVERSARIOS (el resto del código se mantiene igual)
        if (colaboradores.length > 0) {
            const notificacionesBasicas = {
                proximos7Dias: colaboradores.filter(c => Number(c.DiasParaAniversario) <= 7),
                proximos30Dias: colaboradores.filter(c => Number(c.DiasParaAniversario) <= 30 && Number(c.DiasParaAniversario) > 7),
                proximos60Dias: colaboradores.filter(c => Number(c.DiasParaAniversario) <= 60 && Number(c.DiasParaAniversario) > 30),
                proximos90Dias: colaboradores.filter(c => Number(c.DiasParaAniversario) <= 90 && Number(c.DiasParaAniversario) > 60)
            };
            
            // Agregar notificaciones de aniversarios por prioridad
            if (notificacionesBasicas.proximos7Dias.length > 0) {
                notificaciones.push({
                    id: 'aniversarios_dept_7_dias',
                    icon: 'calendar-exclamation',
                    color: 'danger',
                    title: 'Aniversarios esta semana',
                    count: notificacionesBasicas.proximos7Dias.length,
                    description: `${notificacionesBasicas.proximos7Dias.length} compañero${notificacionesBasicas.proximos7Dias.length !== 1 ? 's' : ''} de tu departamento cumplirá${notificacionesBasicas.proximos7Dias.length !== 1 ? 'n' : ''} años esta semana`,
                    data: notificacionesBasicas.proximos7Dias,
                    tipo: 'aniversarios',
                    periodo: '7 días'
                });
            }
            
            if (notificacionesBasicas.proximos30Dias.length > 0) {
                notificaciones.push({
                    id: 'aniversarios_dept_30_dias',
                    icon: 'calendar-plus',
                    color: 'warning',
                    title: 'Aniversarios este mes',
                    count: notificacionesBasicas.proximos30Dias.length,
                    description: `${notificacionesBasicas.proximos30Dias.length} compañero${notificacionesBasicas.proximos30Dias.length !== 1 ? 's' : ''} de tu departamento cumplirá${notificacionesBasicas.proximos30Dias.length !== 1 ? 'n' : ''} años este mes`,
                    data: notificacionesBasicas.proximos30Dias,
                    tipo: 'aniversarios',
                    periodo: '30 días'
                });
            }
            
            if (notificacionesBasicas.proximos60Dias.length > 0) {
                notificaciones.push({
                    id: 'aniversarios_dept_60_dias',
                    icon: 'calendar-day',
                    color: 'info',
                    title: 'Aniversarios próximos 2 meses',
                    count: notificacionesBasicas.proximos60Dias.length,
                    description: `${notificacionesBasicas.proximos60Dias.length} compañero${notificacionesBasicas.proximos60Dias.length !== 1 ? 's' : ''} de tu departamento cumplirá${notificacionesBasicas.proximos60Dias.length !== 1 ? 'n' : ''} años en los próximos 2 meses`,
                    data: notificacionesBasicas.proximos60Dias,
                    tipo: 'aniversarios',
                    periodo: '60 días'
                });
            }
            
            if (notificacionesBasicas.proximos90Dias.length > 0) {
                notificaciones.push({
                    id: 'aniversarios_dept_90_dias',
                    icon: 'calendar',
                    color: 'success',
                    title: 'Aniversarios próximos 3 meses',
                    count: notificacionesBasicas.proximos90Dias.length,
                    description: `${notificacionesBasicas.proximos90Dias.length} compañero${notificacionesBasicas.proximos90Dias.length !== 1 ? 's' : ''} de tu departamento cumplirá${notificacionesBasicas.proximos90Dias.length !== 1 ? 'n' : ''} años en los próximos 3 meses`,
                    data: notificacionesBasicas.proximos90Dias,
                    tipo: 'aniversarios',
                    periodo: '90 días'
                });
            }
        }
        return notificaciones;
        
    } catch (error) {
        console.error('Error al cargar notificaciones básicas:', error);
        return [];
    }
}

// Función para actualizar el badge de notificaciones básicas
function actualizarBadgeNotificacionesBasicas(notificaciones) {
    const badge = document.getElementById('notificationBadge');
    
    // Contar total de notificaciones
    const totalNotificaciones = notificaciones.length;
    
    // Actualizar el badge
    badge.textContent = totalNotificaciones;
    
    // Mostrar/ocultar el badge según si hay notificaciones
    if (totalNotificaciones > 0) {
        badge.classList.add('active');
    } else {
        badge.classList.remove('active');
    }
}

// Función para renderizar notificaciones básicas
function renderizarNotificacionesBasicas(notificaciones) {
    const container = document.getElementById('notificationsBody');
    
    // Limpiar el contenedor
    container.innerHTML = '';
    
    // Si no hay notificaciones, mostrar mensaje
    if (notificaciones.length === 0) {
        container.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No hay notificaciones pendientes para tu departamento</p>
            </div>
        `;
        return;
    }
    
    // Crear elementos para cada notificación
    notificaciones.forEach((notif, index) => {
        const notifElement = document.createElement('div');
        notifElement.className = `notification-item ${notif.color}`;
        notifElement.setAttribute('data-id', notif.id);
        notifElement.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${notif.icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notif.title}</div>
                <div class="notification-description">${notif.description}</div>
            </div>
            <button class="notification-action" data-notif-id="${notif.id}" title="Ver detalles">
                <i class="fas fa-eye"></i>
            </button>
        `;
        
        // Añadir animación con delay
        notifElement.style.animationDelay = `${index * 0.1}s`;
        
        container.appendChild(notifElement);
    });
    
    // Agregar event listeners para ver detalles
    document.querySelectorAll('.notification-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const notifId = e.currentTarget.dataset.notifId;
            const notificacion = notificaciones.find(n => n.id === notifId);
            if (notificacion) {
                // Determinar qué tipo de modal mostrar
                if (notificacion.tipo === 'planillas_autorizadas') {
                    mostrarDetallesPlanillasAutorizadas(notificacion);
                } else {
                    mostrarDetallesAniversarios(notificacion);
                }
            }
        });
    });
}
function mostrarDetallesPlanillasAutorizadas(notificacion) {
    const planillas = notificacion.data;
    
    // Calcular estadísticas
    const totalMonto = planillas.reduce((sum, p) => sum + Number(p.MontoPlanillaParcial), 0);
    const totalColaboradores = planillas.reduce((sum, p) => sum + Number(p.CantidadColaboradores), 0);
    
    // Crear contenido del modal
    const modalContent = `
        <div class="planillas-modal-header">
            <div class="modal-header-icon ${notificacion.color}">
                <i class="fas fa-${notificacion.icon}"></i>
            </div>
            <div class="modal-header-info">
                <h3>${notificacion.title}</h3>
                <p>${planillas.length} planilla${planillas.length !== 1 ? 's' : ''} lista${planillas.length !== 1 ? 's' : ''} para descarga</p>
            </div>
            <div class="modal-header-stats">
                <div class="header-stat">
                    <span class="stat-number">${planillas.length}</span>
                    <span class="stat-label">Planillas</span>
                </div>
                <div class="header-stat">
                    <span class="stat-number">Q${totalMonto.toFixed(0)}</span>
                    <span class="stat-label">Total</span>
                </div>
            </div>
        </div>
        
        <div class="planillas-content">
            <div class="planillas-summary">
                <div class="summary-stats">
                    <div class="summary-stat">
                        <i class="fas fa-check-circle"></i>
                        <span><strong>${planillas.length}</strong> planilla${planillas.length !== 1 ? 's' : ''} autorizada${planillas.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="summary-stat">
                        <i class="fas fa-users"></i>
                        <span><strong>${totalColaboradores}</strong> colaborador${totalColaboradores !== 1 ? 'es' : ''} en total</span>
                    </div>
                    <div class="summary-stat">
                        <i class="fas fa-download"></i>
                        <span>Dirigete a <strong>Pago de Planilla Parcial</strong> para descargar</span>
                    </div>
                </div>
            </div>
            
            <div class="planillas-table-container">
                <table class="planillas-table">
                    <thead>
                        <tr>
                            <th>Período de Pago</th>
                            <th>Colaboradores</th>
                            <th>Monto</th>
                            <th>Fecha Autorización</th>
                            <th>Días</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${planillas.map((planilla, index) => {
                            const diasEspera = Number(planilla.DiasEspera);
                            
                            // ✅ CORRECCIÓN DE FECHA DE REGISTRO
                            const fechaRegistro = parseFechaSinZonaHoraria(planilla.FechaRegistro);
                            
                            // Determinar urgencia por días
                            let urgenciaClass = 'normal';
                            let urgenciaIcon = 'clock';
                            if (diasEspera >= 7) {
                                urgenciaClass = 'danger';
                                urgenciaIcon = 'exclamation-triangle';
                            } else if (diasEspera >= 3) {
                                urgenciaClass = 'warning';
                                urgenciaIcon = 'exclamation-circle';
                            }
                            
                            return `
                                <tr class="planilla-row" style="animation-delay: ${index * 0.1}s">
                                    <td>
                                        <div class="sucursal-cell">
                                            <i class="fas fa-store"></i>
                                            <span>${planilla.NombreDepartamento}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="periodo-cell">
                                            <span class="periodo">${planilla.PeriodoPago || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <span class="colaboradores-count">${planilla.CantidadColaboradores}</span>
                                    </td>
                                    <td class="text-right">
                                        <span class="monto">Q${Number(planilla.MontoPlanillaParcial).toFixed(2)}</span>
                                    </td>
                                    <td class="text-center">
                                        <div class="dias-espera ${urgenciaClass}">
                                            <i class="fas fa-${urgenciaIcon}"></i>
                                            <span>${diasEspera} día${diasEspera !== 1 ? 's' : ''}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="usuario-cell">
                                            <i class="fas fa-user"></i>
                                            <span>${planilla.NombreUsuario}</span>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Mostrar modal con SweetAlert2
    Swal.fire({
        html: modalContent,
        width: '1200px',
        showCloseButton: true,
        showConfirmButton: false,
        customClass: {
            popup: 'planillas-modal-popup'
        },
        didOpen: () => {
            // Agregar animaciones a las filas
            document.querySelectorAll('.planilla-row').forEach(row => {
                row.classList.add('fade-in-row');
            });
        }
    });
}
// Función para actualizar el contador de notificaciones
function actualizarBadgeNotificaciones() {
    const badge = document.getElementById('notificationBadge');
    
    // Contar notificaciones relevantes (con count > 0)
    const totalNotificaciones = notificationsData.filter(notif => notif.count > 0).length;
    
    // Actualizar el badge
    badge.textContent = totalNotificaciones;
    
    // Mostrar/ocultar el badge según si hay notificaciones
    if (totalNotificaciones > 0) {
        badge.classList.add('active');
    } else {
        badge.classList.remove('active');
    }
}

// Función para renderizar las notificaciones en el dropdown
function renderizarNotificaciones() {
    const container = document.getElementById('notificationsBody');
    
    // Limpiar el contenedor
    container.innerHTML = '';
    
    // Filtrar notificaciones relevantes (con count > 0)
    const notificacionesRelevantes = notificationsData.filter(notif => notif.count > 0);
    
    // Si no hay notificaciones, mostrar mensaje
    if (notificacionesRelevantes.length === 0) {
        container.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-check-circle"></i>
                <p>No hay notificaciones pendientes</p>
            </div>
        `;
        return;
    }
    
    // Crear elementos para cada notificación
    notificacionesRelevantes.forEach((notif, index) => {
        const notifElement = document.createElement('div');
        notifElement.className = `notification-item ${notif.color}`;
        notifElement.setAttribute('data-id', notif.id);
        notifElement.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${notif.icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notif.title}</div>
                <div class="notification-description">${notif.description}</div>
            </div>
            <a href="${notif.link}" class="notification-action">
                <i class="fas fa-arrow-right"></i>
            </a>
        `;
        
        // Añadir animación con delay
        notifElement.style.animationDelay = `${index * 0.1}s`;
        
        container.appendChild(notifElement);
    });
}
function verificarPermisosDashboard() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    
    // Verificar si el usuario tiene el puesto ID 140
    if (!userData || userData.Id_Puesto !== 140) {
        return false;
    }
    return true;
}
function ocultarDashboardCompleto() {
    // Ocultar las tarjetas de estadísticas del dashboard principal
    const statsContainer = document.querySelector('.stats-container');
    if (statsContainer) {
        statsContainer.style.display = 'none';
    }
    
    // Ocultar las filas del dashboard principal
    const dashboardRows = document.querySelectorAll('.dashboard-row');
    dashboardRows.forEach(row => {
        row.style.display = 'none';
    });
    
    // Mostrar dashboard básico para colaboradores
    mostrarDashboardBasico();
}
function verificarPermisosEncargadoRegional() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    
    // Verificar si el usuario tiene uno de los puestos de encargado regional
    if (!userData || ![94, 95, 175].includes(userData.Id_Puesto)) {
        return false;
    }
    return true;
}
function mostrarDashboardRegional() {
    // Ocultar las tarjetas de estadísticas del dashboard principal
    const statsContainer = document.querySelector('.stats-container');
    if (statsContainer) {
        statsContainer.style.display = 'none';
    }
    
    // Ocultar las filas del dashboard principal
    const dashboardRows = document.querySelectorAll('.dashboard-row');
    dashboardRows.forEach(row => {
        row.style.display = 'none';
    });
    
    // Crear el contenedor del dashboard regional
    const mainContent = document.querySelector('.main-content');
    const contentAfterHeader = mainContent.querySelector('.content-header').nextElementSibling;
    
    const regionalDashboard = document.createElement('div');
    regionalDashboard.className = 'regional-dashboard-container';
    regionalDashboard.innerHTML = `
        <div class="regional-header-compact">
            <div class="header-left">
                <div class="header-icon">
                    <i class="fas fa-building"></i>
                </div>
                <div class="header-text">
                    <h3>Sucursales a tu Cargo</h3>
                    <p>Gestiona y supervisa las sucursales de tu región</p>
                </div>
            </div>
            <div class="header-stats">
                <div class="stat-compact">
                    <span class="stat-number" id="totalSucursales">0</span>
                    <span class="stat-text">Sucursales</span>
                </div>
                <div class="stat-compact">
                    <span class="stat-number" id="totalColaboradores">0</span>
                    <span class="stat-text">Total Personal</span>
                </div>
                <button class="btn-refresh-compact" id="refreshRegionalBtn" title="Actualizar datos">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
        </div>
        
        <div class="regional-table-card">
            <!-- resto del código de la tabla se mantiene igual -->
            <div class="regional-table-header">
                <div class="table-title">
                    <i class="fas fa-list"></i>
                    <span>Control de Personal por Sucursal</span>
                </div>
                <div class="table-legend">
                    <div class="legend-item">
                        <span class="legend-color complete"></span>
                        <span>Completo</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color deficit"></span>
                        <span>Faltante</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color excess"></span>
                        <span>Excedente</span>
                    </div>
                </div>
            </div>
            
            <div class="regional-table-container">
                <div class="regional-table-loading" id="regionalTableLoading">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <span>Cargando sucursales...</span>
                </div>
                
                <table class="regional-table" id="regionalTable">
                    <thead>
                        <tr>
                            <th class="col-sucursal">Sucursal / Región</th>
                            <th class="col-personal">Personal Fijo</th>
                            <th class="col-personal">Personal Parcial</th>
                            <th class="col-personal">Vacacionistas</th>
                            <th class="col-total">Total</th>
                            <th class="col-estado">Estado</th>
                            <th class="col-acciones">Acciones</th>
                        </tr>
                        <tr class="sub-header">
                            <th></th>
                            <th class="sub-label">Actual / Objetivo</th>
                            <th class="sub-label">Actual / Objetivo</th>
                            <th class="sub-label">Actual / Objetivo</th>
                            <th class="sub-label">Actual / Objetivo</th>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="regionalTableBody">
                        <!-- Datos se cargarán dinámicamente -->
                    </tbody>
                </table>
                
                <div class="regional-table-empty" id="regionalTableEmpty" style="display: none;">
                    <div class="empty-icon">
                        <i class="fas fa-building"></i>
                    </div>
                    <h4>No hay sucursales asignadas</h4>
                    <p>No se encontraron sucursales bajo tu supervisión</p>
                </div>
            </div>
        </div>
    `;
    
    mainContent.insertBefore(regionalDashboard, contentAfterHeader);
    
    // Cargar datos de sucursales
    cargarSucursalesRegionales();
    
    // Event listener para refresh
    document.getElementById('refreshRegionalBtn').addEventListener('click', () => {
        cargarSucursalesRegionales();
    });
}
async function cargarSucursalesRegionales() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const loadingElement = document.getElementById('regionalTableLoading');
    const tableElement = document.getElementById('regionalTable');
    const emptyElement = document.getElementById('regionalTableEmpty');
    const tableBody = document.getElementById('regionalTableBody');
    const refreshBtn = document.getElementById('refreshRegionalBtn');
    
    try {
        // Mostrar loading
        loadingElement.style.display = 'flex';
        tableElement.style.display = 'none';
        emptyElement.style.display = 'none';
        
        // Spinner en botón de refresh
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.add('fa-spin');
        }
        
        const connection = await getConnection();
        
        // Query principal para obtener sucursales con datos de personal
        const sucursales = await connection.query(`
            SELECT
                d.IdDepartamento,
                d.NombreDepartamento,
                r.NombreRegion,
                d.CantFijos,
                d.CantParciales,
                d.CantVacacionista,
                -- Contar personal actual por tipo
                SUM(CASE WHEN p.TipoPersonal = 1 AND p.Estado = 1 THEN 1 ELSE 0 END) AS ActualFijos,
                SUM(CASE WHEN p.TipoPersonal = 2 AND p.Estado = 1 THEN 1 ELSE 0 END) AS ActualParciales,
                SUM(CASE WHEN p.TipoPersonal = 3 AND p.Estado = 1 THEN 1 ELSE 0 END) AS ActualVacacionistas,
                COUNT(CASE WHEN p.Estado = 1 THEN 1 END) AS TotalActual
            FROM
                departamentos d
                INNER JOIN Regiones r ON d.IdRegion = r.IdRegion
                LEFT JOIN personal p ON d.IdDepartamento = p.IdSucuDepa
            WHERE
                d.IdEncargadoRegional = ?
            GROUP BY
                d.IdDepartamento, d.NombreDepartamento, r.NombreRegion,
                d.CantFijos, d.CantParciales, d.CantVacacionista
            ORDER BY
                r.NombreRegion, d.NombreDepartamento
        `, [userData.IdPersonal]);
        
        await connection.close();
        
        // Limpiar tabla
        tableBody.innerHTML = '';
        
        if (sucursales.length === 0) {
            // Mostrar estado vacío
            loadingElement.style.display = 'none';
            emptyElement.style.display = 'flex';
            actualizarEstadisticasHeader(0, 0);
        } else {
            // Calcular totales
            let totalSucursales = sucursales.length;
            let totalColaboradores = sucursales.reduce((sum, s) => sum + Number(s.TotalActual), 0);
            
            // Llenar tabla
            sucursales.forEach((sucursal, index) => {
                // Convertir BigInt a Number
                const cantFijos = Number(sucursal.CantFijos) || 0;
                const cantParciales = Number(sucursal.CantParciales) || 0;
                const cantVacacionista = Number(sucursal.CantVacacionista) || 0;
                const actualFijos = Number(sucursal.ActualFijos) || 0;
                const actualParciales = Number(sucursal.ActualParciales) || 0;
                const actualVacacionistas = Number(sucursal.ActualVacacionistas) || 0;
                const totalObjetivo = cantFijos + cantParciales + cantVacacionista;
                const totalActual = Number(sucursal.TotalActual) || 0;
                
                // Determinar estados por tipo de personal
                const estadoFijos = determinarEstadoPersonal(actualFijos, cantFijos);
                const estadoParciales = determinarEstadoPersonal(actualParciales, cantParciales);
                const estadoVacacionistas = determinarEstadoPersonal(actualVacacionistas, cantVacacionista);
                const estadoGeneral = determinarEstadoGeneral(totalActual, totalObjetivo);
                
                const row = document.createElement('tr');
                row.className = `regional-table-row ${estadoGeneral.clase}`;
                row.innerHTML = `
                    <td class="col-sucursal">
                        <div class="sucursal-info">
                            <div class="sucursal-icon">
                                <i class="fas fa-store"></i>
                            </div>
                            <div class="sucursal-details">
                                <span class="sucursal-name">${sucursal.NombreDepartamento}</span>
                                <span class="sucursal-region">${sucursal.NombreRegion}</span>
                            </div>
                        </div>
                    </td>
                    <td class="col-personal">
                        <div class="personal-counter ${estadoFijos.clase}">
                            <span class="actual">${actualFijos}</span>
                            <span class="separator">/</span>
                            <span class="objetivo">${cantFijos}</span>
                            <div class="status-indicator ${estadoFijos.clase}"></div>
                        </div>
                    </td>
                    <td class="col-personal">
                        <div class="personal-counter ${estadoParciales.clase}">
                            <span class="actual">${actualParciales}</span>
                            <span class="separator">/</span>
                            <span class="objetivo">${cantParciales}</span>
                            <div class="status-indicator ${estadoParciales.clase}"></div>
                        </div>
                    </td>
                    <td class="col-personal">
                        <div class="personal-counter ${estadoVacacionistas.clase}">
                            <span class="actual">${actualVacacionistas}</span>
                            <span class="separator">/</span>
                            <span class="objetivo">${cantVacacionista}</span>
                            <div class="status-indicator ${estadoVacacionistas.clase}"></div>
                        </div>
                    </td>
                    <td class="col-total">
                        <div class="total-counter ${estadoGeneral.clase}">
                            <span class="total-actual">${totalActual}</span>
                            <span class="separator">/</span>
                            <span class="total-objetivo">${totalObjetivo}</span>
                        </div>
                    </td>
                    <td class="col-estado">
                        <div class="estado-badge ${estadoGeneral.clase}">
                            <i class="fas fa-${estadoGeneral.icono}"></i>
                            <span>${estadoGeneral.texto}</span>
                        </div>
                    </td>
                    <td class="col-acciones">
                        <div class="acciones-container">
                            <button class="btn-action btn-view" data-id="${sucursal.IdDepartamento}" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                // Animación escalonada
                row.style.animationDelay = `${index * 0.1}s`;
                row.classList.add('fade-in-row');
                
                tableBody.appendChild(row);
            });
            
            // Actualizar estadísticas del header
            actualizarEstadisticasHeader(totalSucursales, totalColaboradores);
            
            // Mostrar tabla
            loadingElement.style.display = 'none';
            tableElement.style.display = 'table';
            
            // Event listeners para botones de acción
            agregarEventListenersAcciones();
        }
        
        // Detener spinner
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.remove('fa-spin');
        }
        
        // Mostrar notificación de éxito si fue un refresh manual
        if (refreshBtn && refreshBtn.querySelector('i').classList.contains('fa-spin')) {
            mostrarNotificacion('Datos actualizados correctamente', 'success');
        }
        
    } catch (error) {
        console.error('Error al cargar sucursales regionales:', error);
        
        // Mostrar error
        loadingElement.style.display = 'none';
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="error-row">
                    <div class="error-content">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>Error al cargar las sucursales</span>
                    </div>
                </td>
            </tr>
        `;
        tableElement.style.display = 'table';
        actualizarEstadisticasHeader(0, 0);
        
        // Detener spinner
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.remove('fa-spin');
        }
        
        mostrarNotificacion('Error al cargar las sucursales', 'error');
    }
}
function determinarEstadoPersonal(actual, objetivo) {
    if (objetivo === 0) {
        return { clase: 'no-data', texto: 'N/A' };
    }
    
    if (actual === objetivo) {
        return { clase: 'complete', texto: 'Completo' };
    } else if (actual < objetivo) {
        return { clase: 'deficit', texto: `Faltan ${objetivo - actual}` };
    } else {
        return { clase: 'excess', texto: `Sobran ${actual - objetivo}` };
    }
}
function determinarEstadoGeneral(totalActual, totalObjetivo) {
    if (totalObjetivo === 0) {
        return { 
            clase: 'no-data', 
            texto: 'Sin Asignar', 
            icono: 'info-circle' 
        };
    }
    
    if (totalActual === totalObjetivo) {
        return { 
            clase: 'complete', 
            texto: 'Completo', 
            icono: 'check-circle' 
        };
    } else if (totalActual < totalObjetivo) {
        return { 
            clase: 'deficit', 
            texto: 'Faltante', 
            icono: 'exclamation-circle' 
        };
    } else {
        return { 
            clase: 'excess', 
            texto: 'Excedente', 
            icono: 'exclamation-triangle' 
        };
    }
}
function actualizarEstadisticasHeader(totalSucursales, totalColaboradores) {
    const sucursalesElement = document.getElementById('totalSucursales');
    const colaboradoresElement = document.getElementById('totalColaboradores');
    
    if (sucursalesElement) {
        sucursalesElement.textContent = totalSucursales;
    }
    
    if (colaboradoresElement) {
        colaboradoresElement.textContent = totalColaboradores;
    }
}
function agregarEventListenersAcciones() {
    // Botones "Ver detalles"
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idDepartamento = e.currentTarget.dataset.id;
            const nombreDepartamento = e.currentTarget.closest('tr').querySelector('.sucursal-name').textContent;
            await mostrarDetallesColaboradores(idDepartamento, nombreDepartamento);
        });
    });
}
async function mostrarDetallesColaboradores(idDepartamento, nombreDepartamento) {
    try {
        // Mostrar loading
        const loadingSwal = Swal.fire({
            title: 'Cargando colaboradores...',
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                    <div class="spinner" style="border: 5px solid #f3f3f3; border-top: 5px solid #FF9800; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;"></div>
                    <p>Obteniendo información del personal de <strong>${nombreDepartamento}</strong></p>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false
        });

        const connection = await getConnection();
        
        const colaboradores = await connection.query(`
            SELECT
                personal.IdPersonal, 
                personal.PrimerNombre, 
                personal.SegundoNombre, 
                personal.TercerNombre, 
                personal.PrimerApellido, 
                personal.SegundoApellido, 
                Puestos.Nombre AS NombrePuesto, 
                personal.InicioLaboral, 
                TipoPersonal.TipoPersonal,
                personal.TipoPersonal AS IdTipoPersonal
            FROM
                personal
                INNER JOIN
                Puestos
                ON 
                    personal.IdPuesto = Puestos.IdPuesto
                INNER JOIN
                TipoPersonal
                ON 
                    personal.TipoPersonal = TipoPersonal.IdTipo
            WHERE
                personal.IdSucuDepa = ? AND
                personal.Estado = 1
            ORDER BY
                personal.PrimerNombre ASC 
                
        `, [idDepartamento]);
        
        await connection.close();
        
        // Cerrar loading
        loadingSwal.close();
        
        // Mostrar modal con los datos
        mostrarModalColaboradores(colaboradores, nombreDepartamento);
        
    } catch (error) {
        console.error('Error al cargar colaboradores:', error);
        
        // Cerrar loading
        if (loadingSwal) {
            loadingSwal.close();
        }
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los colaboradores de esta sucursal.',
            confirmButtonColor: '#FF9800'
        });
    }
}
function mostrarModalColaboradores(colaboradores, nombreDepartamento) {
    // Agrupar por tipo de personal (código existente)
    const colaboradoresPorTipo = {
        1: colaboradores.filter(c => c.IdTipoPersonal === 1),
        2: colaboradores.filter(c => c.IdTipoPersonal === 2),
        3: colaboradores.filter(c => c.IdTipoPersonal === 3)
    };
    
    const totalColaboradores = colaboradores.length;
    
    // Función para formatear nombre completo (código existente)
    const formatearNombre = (colaborador) => {
        const nombres = [
            colaborador.PrimerNombre,
            colaborador.SegundoNombre,
            colaborador.TercerNombre
        ].filter(n => n && n.trim()).join(' ');
        
        const apellidos = [
            colaborador.PrimerApellido,
            colaborador.SegundoApellido
        ].filter(a => a && a.trim()).join(' ');
        
        return `${nombres} ${apellidos}`.trim();
    };
    
    // Función para formatear fecha (código existente)
    const formatearFecha = (fecha) => {
        if (!fecha) return 'N/A';
        const date = new Date(fecha);
        return date.toLocaleDateString('es-GT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    // Función para calcular antigüedad (código existente)
    const calcularAntiguedad = (fechaInicio) => {
        if (!fechaInicio) return 'N/A';
        const inicio = new Date(fechaInicio);
        const hoy = new Date();
        const diffTime = Math.abs(hoy - inicio);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 30) return `${diffDays} días`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses`;
        return `${Math.floor(diffDays / 365)} años`;
    };
    
    // Crear contenido de las pestañas - VERSIÓN ACTUALIZADA CON BOTÓN DE EDICIÓN
    const crearTablaColaboradores = (colaboradoresTipo, tipoNombre) => {
        if (colaboradoresTipo.length === 0) {
            return `
                <div class="empty-colaboradores">
                    <i class="fas fa-users"></i>
                    <p>No hay ${tipoNombre.toLowerCase()} registrado</p>
                </div>
            `;
        }
        
        return `
            <div class="colaboradores-table-container">
                <table class="colaboradores-table">
                    <thead>
                        <tr>
                            <th>Colaborador</th>
                            <th>Puesto</th>
                            <th>Fecha Ingreso</th>
                            <th>Antigüedad</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${colaboradoresTipo.map((col, index) => `
                            <tr class="colaborador-row" style="animation-delay: ${index * 0.05}s">
                                <td>
                                    <div class="colaborador-info">
                                        <div class="colaborador-avatar">
                                            <i class="fas fa-user"></i>
                                        </div>
                                        <div class="colaborador-details">
                                            <span class="colaborador-name">${formatearNombre(col)}</span>
                                            <span class="colaborador-id">ID: ${col.IdPersonal}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span class="puesto-badge">${col.NombrePuesto}</span>
                                </td>
                                <td>
                                    <span class="fecha-ingreso">${formatearFecha(col.InicioLaboral)}</span>
                                </td>
                                <td>
                                    <span class="antiguedad-badge">${calcularAntiguedad(col.InicioLaboral)}</span>
                                </td>
                                <td>
                                    <div class="acciones-colaborador">
                                        <button class="btn-edit-colaborador" 
                                                data-id="${col.IdPersonal}"
                                                data-nombre="${formatearNombre(col)}"
                                                data-departamento="${nombreDepartamento}"
                                                data-puesto="${col.NombrePuesto}"
                                                title="Editar colaborador">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };
    
    // HTML del modal (código existente del header y pestañas)
    const modalHtml = `
        <div class="colaboradores-modal-header">
            <div class="modal-title-section">
                <div class="sucursal-icon-large">
                    <i class="fas fa-building"></i>
                </div>
                <div class="sucursal-info-large">
                    <h3>${nombreDepartamento}</h3>
                    <p>${totalColaboradores} colaborador${totalColaboradores !== 1 ? 'es' : ''} activo${totalColaboradores !== 1 ? 's' : ''}</p>
                </div>
            </div>
            <div class="modal-stats">
                <div class="modal-stat">
                    <span class="stat-num">${colaboradoresPorTipo[1].length}</span>
                    <span class="stat-label">Fijos</span>
                </div>
                <div class="modal-stat">
                    <span class="stat-num">${colaboradoresPorTipo[2].length}</span>
                    <span class="stat-label">Parciales</span>
                </div>
                <div class="modal-stat">
                    <span class="stat-num">${colaboradoresPorTipo[3].length}</span>
                    <span class="stat-label">Vacacionistas</span>
                </div>
            </div>
        </div>
        
        <div class="colaboradores-tabs">
            <button class="tab-btn active" data-tab="fijos">
                <i class="fas fa-user-tie"></i>
                Personal Fijo (${colaboradoresPorTipo[1].length})
            </button>
            <button class="tab-btn" data-tab="parciales">
                <i class="fas fa-user-clock"></i>
                Personal Parcial (${colaboradoresPorTipo[2].length})
            </button>
            <button class="tab-btn" data-tab="vacacionistas">
                <i class="fas fa-umbrella-beach"></i>
                Vacacionistas (${colaboradoresPorTipo[3].length})
            </button>
        </div>
        
        <div class="colaboradores-content">
            <div class="tab-content active" id="tab-fijos">
                ${crearTablaColaboradores(colaboradoresPorTipo[1], 'Personal Fijo')}
            </div>
            <div class="tab-content" id="tab-parciales">
                ${crearTablaColaboradores(colaboradoresPorTipo[2], 'Personal Parcial')}
            </div>
            <div class="tab-content" id="tab-vacacionistas">
                ${crearTablaColaboradores(colaboradoresPorTipo[3], 'Vacacionistas')}
            </div>
        </div>
    `;
    
    // Mostrar modal
    Swal.fire({
        title: '',
        html: modalHtml,
        width: '95%',
        maxWidth: '1200px',
        showCloseButton: true,
        showConfirmButton: false,
        customClass: {
            container: 'colaboradores-modal-container',
            popup: 'colaboradores-modal-popup'
        },
        didOpen: () => {
            // Activar funcionalidad de pestañas (código existente)
            activarPestanasColaboradores();
            
            // Animar filas (código existente)
            document.querySelectorAll('.colaborador-row').forEach(row => {
                row.classList.add('fade-in-colaborador');
            });
            
            // NUEVO: Agregar event listeners para los botones de edición
            document.querySelectorAll('.btn-edit-colaborador').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idPersonal = btn.dataset.id;
                    const nombreCompleto = btn.dataset.nombre;
                    const departamentoActual = btn.dataset.departamento;
                    const puestoActual = btn.dataset.puesto;
                    
                    mostrarModalEdicionColaborador(idPersonal, nombreCompleto, departamentoActual, puestoActual);
                });
            });
        }
    });
}
function activarPestanasColaboradores() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover clase active de todos los botones y contenidos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Agregar clase active al botón clickeado
            btn.classList.add('active');
            
            // Mostrar contenido correspondiente
            const tabId = btn.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
            
            // Animar filas nuevamente
            setTimeout(() => {
                document.querySelectorAll('.colaborador-row').forEach((row, index) => {
                    row.style.animationDelay = `${index * 0.05}s`;
                    row.classList.remove('fade-in-colaborador');
                    row.offsetHeight; // Trigger reflow
                    row.classList.add('fade-in-colaborador');
                });
            }, 50);
        });
    });
}
async function cargarNotificacionesRegionales() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        const idPersonal = userData.IdPersonal;
        
        // ===== EJECUTAR CONSULTAS SECUENCIALMENTE =====
        let colaboradores = [];
        let planillasPendientes = [];
        
        // QUERY 1: ANIVERSARIOS (se mantiene igual)
        try {
            const connection1 = await getConnection();
            const notificacionesQuery = `
                SELECT 
                    p.IdPersonal,
                    CONCAT(p.PrimerNombre, ' ', IFNULL(p.SegundoNombre, ''), ' ', p.PrimerApellido, ' ', IFNULL(p.SegundoApellido, '')) AS NombreCompleto,
                    d.NombreDepartamento,
                    p.FechaPlanilla,
                    TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) AS AniosActuales,
                    TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) + 1 AS ProximosAnios,
                    DATEDIFF(
                        DATE_ADD(p.FechaPlanilla, INTERVAL (TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) + 1) YEAR),
                        CURDATE()
                    ) AS DiasParaAniversario,
                    DATE_ADD(p.FechaPlanilla, INTERVAL (TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) + 1) YEAR) AS FechaAniversario,
                    (TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) * 15) - 
                        IFNULL((SELECT COUNT(*) FROM vacacionestomadas WHERE IdPersonal = p.IdPersonal), 0) -
                        IFNULL((SELECT SUM(CAST(DiasSolicitado AS UNSIGNED)) FROM vacacionespagadas 
                                WHERE IdPersonal = p.IdPersonal AND Estado IN (1,2,3,4)), 0)
                    As DiasVacacionesAcumulados,
                    puestos.Nombre AS NombrePuesto,
                    CASE 
                        WHEN FotosPersonal.Foto IS NOT NULL THEN 1
                        ELSE 0 
                    END AS TieneFoto
                FROM 
                    personal p
                    INNER JOIN departamentos d ON p.IdSucuDepa = d.IdDepartamento
                    INNER JOIN Puestos puestos ON p.IdPuesto = puestos.IdPuesto
                    LEFT JOIN FotosPersonal ON p.IdPersonal = FotosPersonal.IdPersonal
                WHERE 
                    d.IdEncargadoRegional = ? 
                    AND p.Estado = 1
                    AND p.TipoPersonal = 1
                    AND p.FechaPlanilla IS NOT NULL
                    AND DATEDIFF(
                        DATE_ADD(p.FechaPlanilla, INTERVAL (TIMESTAMPDIFF(YEAR, p.FechaPlanilla, CURDATE()) + 1) YEAR),
                        CURDATE()
                    ) BETWEEN 1 AND 90
                ORDER BY 
                    DiasParaAniversario ASC, d.NombreDepartamento, p.PrimerNombre
            `;
            
            colaboradores = await connection1.query(notificacionesQuery, [idPersonal]);
            await connection1.close();
            console.log('Aniversarios cargados:', colaboradores.length);
            
        } catch (error) {
            console.error('Error en query de aniversarios:', error);
            colaboradores = [];
        }
        
        // QUERY 2: PLANILLAS PENDIENTES (CORREGIDA)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
            const connection2 = await getConnection();
            const planillasPendientesQuery = `
                SELECT 
                    p.IdPlanillaParcial,
                    p.PeriodoPago,
                    p.MontoPlanillaParcial,
                    p.CantidadColaboradores,
                    p.FechaRegistro,
                    p.NombreUsuario,
                    d.IdDepartamento,
                    d.NombreDepartamento,
                    DATEDIFF(CURDATE(), DATE(p.FechaRegistro)) AS DiasEspera
                FROM 
                    PagoPlanillaParcial p
                    INNER JOIN departamentos d ON p.IdDepartamentoSucursal = d.IdDepartamento
                WHERE 
                    d.IdEncargadoRegional = ? 
                    AND p.Estado = 0
                ORDER BY 
                    p.FechaRegistro ASC
            `;
            
            planillasPendientes = await connection2.query(planillasPendientesQuery, [idPersonal]);
            await connection2.close();
            console.log('Planillas pendientes cargadas:', planillasPendientes.length);
            
        } catch (error) {
            console.error('Error en query de planillas pendientes:', error);
            planillasPendientes = [];
        }
        
        // ===== PROCESAR DATOS ===== (el resto del código se mantiene igual)
        const notificaciones = [];
        
        // Procesar aniversarios
        if (colaboradores.length > 0) {
            const notificacionesRegionales = {
                proximos7Dias: colaboradores.filter(c => Number(c.DiasParaAniversario) <= 7),
                proximos30Dias: colaboradores.filter(c => Number(c.DiasParaAniversario) <= 30 && Number(c.DiasParaAniversario) > 7),
                proximos60Dias: colaboradores.filter(c => Number(c.DiasParaAniversario) <= 60 && Number(c.DiasParaAniversario) > 30),
                proximos90Dias: colaboradores.filter(c => Number(c.DiasParaAniversario) <= 90 && Number(c.DiasParaAniversario) > 60)
            };
            
            // Agregar notificaciones de aniversarios (código existente)...
        }
        
        // Procesar planillas pendientes
        if (planillasPendientes.length > 0) {
            const planillasUrgentes = planillasPendientes.filter(p => Number(p.DiasEspera) >= 3);
            const planillasRecientes = planillasPendientes.filter(p => Number(p.DiasEspera) < 3);
            
            // Agregar notificaciones de planillas urgentes PRIMERO (mayor prioridad)
            if (planillasUrgentes.length > 0) {
                notificaciones.unshift({
                    id: 'planillas_urgentes',
                    icon: 'exclamation-triangle',
                    color: 'danger',
                    title: 'Planillas urgentes por autorizar',
                    count: planillasUrgentes.length,
                    description: `${planillasUrgentes.length} planilla${planillasUrgentes.length !== 1 ? 's' : ''} con más de 3 días esperando autorización`,
                    data: planillasUrgentes,
                    tipo: 'planillas',
                    urgencia: 'alta'
                });
            }
            
            // Agregar notificaciones de planillas recientes
            if (planillasRecientes.length > 0) {
                // Insertar después de urgentes pero antes de aniversarios
                const insertIndex = planillasUrgentes.length > 0 ? 1 : 0;
                notificaciones.splice(insertIndex, 0, {
                    id: 'planillas_pendientes',
                    icon: 'clock',
                    color: 'warning',
                    title: 'Planillas pendientes de autorización',
                    count: planillasRecientes.length,
                    description: `${planillasRecientes.length} planilla${planillasRecientes.length !== 1 ? 's' : ''} esperando su autorización`,
                    data: planillasRecientes,
                    tipo: 'planillas',
                    urgencia: 'normal'
                });
            }
        }
        
        console.log('Notificaciones regionales procesadas:', notificaciones.length);
        return notificaciones;
        
    } catch (error) {
        console.error('Error general al cargar notificaciones regionales:', error);
        return [];
    }
}
async function cargarFotoColaborador(idPersonal) {
    try {
        const connection = await getConnection();
        
        const fotoQuery = `
            SELECT 
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM 
                FotosPersonal
            WHERE 
                IdPersonal = ?
        `;
        
        const result = await connection.query(fotoQuery, [idPersonal]);
        await connection.close();
        
        if (result.length > 0 && result[0].FotoBase64) {
            return result[0].FotoBase64;
        }
        
        return '../Imagenes/user-default.png';
        
    } catch (error) {
        console.error('Error al cargar foto:', error);
        return '../Imagenes/user-default.png';
    }
}
function actualizarBadgeNotificacionesRegionales(notificaciones) {
    const badge = document.getElementById('notificationBadge');
    
    // Contar total de notificaciones
    const totalNotificaciones = notificaciones.length;
    
    // Actualizar el badge
    badge.textContent = totalNotificaciones;
    
    // Mostrar/ocultar el badge según si hay notificaciones
    if (totalNotificaciones > 0) {
        badge.classList.add('active');
    } else {
        badge.classList.remove('active');
    }
}
function renderizarNotificacionesRegionales(notificaciones) {
    const container = document.getElementById('notificationsBody');
    
    // Limpiar el contenedor
    container.innerHTML = '';
    
    // Si no hay notificaciones, mostrar mensaje
    if (notificaciones.length === 0) {
        container.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No hay notificaciones pendientes para sus departamentos</p>
            </div>
        `;
        return;
    }
    
    // Crear elementos para cada notificación
    notificaciones.forEach((notif, index) => {
        const notifElement = document.createElement('div');
        notifElement.className = `notification-item ${notif.color}`;
        notifElement.setAttribute('data-id', notif.id);
        notifElement.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${notif.icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notif.title}</div>
                <div class="notification-description">${notif.description}</div>
            </div>
            <button class="notification-action" data-notif-id="${notif.id}" title="Ver detalles">
                <i class="fas fa-eye"></i>
            </button>
        `;
        
        // Añadir animación con delay
        notifElement.style.animationDelay = `${index * 0.1}s`;
        
        container.appendChild(notifElement);
    });
    
    // Agregar event listeners para ver detalles
    document.querySelectorAll('.notification-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const notifId = e.currentTarget.dataset.notifId;
            const notificacion = notificaciones.find(n => n.id === notifId);
            if (notificacion) {
                // Determinar qué tipo de modal mostrar
                if (notificacion.tipo === 'planillas') {
                    mostrarDetallesPlanillasPendientes(notificacion);
                } else {
                    mostrarDetallesAniversarios(notificacion);
                }
            }
        });
    });
}
function mostrarDetallesPlanillasPendientes(notificacion) {
    const planillas = notificacion.data;
    
    // Calcular estadísticas (mismo código que antes)
    const totalMonto = planillas.reduce((sum, p) => sum + Number(p.MontoPlanillaParcial), 0);
    const totalColaboradores = planillas.reduce((sum, p) => sum + Number(p.CantidadColaboradores), 0);
    const planillasQuincenales = planillas.filter(p => p.TipoPago.includes('Quincenal')).length;
    const planillasFinMes = planillas.filter(p => p.TipoPago.includes('Fin')).length;
    
    const sucursalesConPlanillas = [...new Set(planillas.map(p => p.NombreDepartamento))];
    
    // Crear contenido del modal CON FECHAS CORREGIDAS
    const modalContent = `
        <div class="planillas-modal-header">
            <div class="modal-header-icon ${notificacion.color}">
                <i class="fas fa-${notificacion.icon}"></i>
            </div>
            <div class="modal-header-info">
                <h3>${notificacion.title}</h3>
                <p>${planillas.length} planilla${planillas.length !== 1 ? 's' : ''} esperando autorización</p>
            </div>
            <div class="modal-header-stats">
                <div class="header-stat">
                    <span class="stat-number">${planillas.length}</span>
                    <span class="stat-label">Planillas</span>
                </div>
                <div class="header-stat">
                    <span class="stat-number">Q${totalMonto.toFixed(0)}</span>
                    <span class="stat-label">Total</span>
                </div>
            </div>
        </div>
        
        <div class="planillas-content">
            <div class="planillas-summary">
                <div class="summary-stats">
                    <div class="summary-stat">
                        <i class="fas fa-building"></i>
                        <span><strong>${sucursalesConPlanillas.length}</strong> sucursales con planillas</span>
                    </div>
                    <div class="summary-stat">
                        <i class="fas fa-users"></i>
                        <span><strong>${totalColaboradores}</strong> colaboradores en total</span>
                    </div>
                    <div class="summary-stat">
                        <i class="fas fa-calendar-week"></i>
                        <span><strong>${planillasQuincenales}</strong> quincenales, <strong>${planillasFinMes}</strong> fin de mes</span>
                    </div>
                </div>
            </div>
            
            <div class="planillas-table-container">
                <table class="planillas-table">
                    <thead>
                        <tr>
                            <th>Sucursal</th>
                            <th>Tipo</th>
                            <th>Período</th>
                            <th>Colaboradores</th>
                            <th>Monto</th>
                            <th>Días Espera</th>
                            <th>Enviado por</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${planillas.map((planilla, index) => {
                            const diasEspera = Number(planilla.DiasEspera);
                            
                            // ✅ CORRECCIÓN DE FECHA DE REGISTRO
                            const fechaRegistro = parseFechaSinZonaHoraria(planilla.FechaRegistro);
                            
                            // Crear fecha para el mes/año de la planilla
                            const mesNombre = new Date(planilla.Anyo, planilla.Mes - 1)
                                .toLocaleDateString('es-GT', { month: 'short' });
                            
                            // Determinar urgencia por días
                            let urgenciaClass = 'normal';
                            let urgenciaIcon = 'clock';
                            if (diasEspera >= 7) {
                                urgenciaClass = 'danger';
                                urgenciaIcon = 'exclamation-triangle';
                            } else if (diasEspera >= 3) {
                                urgenciaClass = 'warning';
                                urgenciaIcon = 'exclamation-circle';
                            }
                            
                            return `
                                <tr class="planilla-row" style="animation-delay: ${index * 0.1}s">
                                    <td>
                                        <div class="sucursal-cell">
                                            <i class="fas fa-store"></i>
                                            <span>${planilla.NombreDepartamento}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="tipo-planilla ${planilla.TipoPago.includes('Quincenal') ? 'quincenal' : 'fin-mes'}">
                                            ${planilla.TipoPago.includes('Quincenal') ? 'Quincenal' : 'Fin de Mes'}
                                        </div>
                                    </td>
                                    <td>
                                        <div class="periodo-cell">
                                            <span class="mes">${mesNombre} ${planilla.Anyo}</span>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <span class="colaboradores-count">${planilla.CantidadColaboradores}</span>
                                    </td>
                                    <td class="text-right">
                                        <span class="monto">Q${Number(planilla.MontoPlanillaParcial).toFixed(2)}</span>
                                    </td>
                                    <td class="text-center">
                                        <div class="dias-espera ${urgenciaClass}">
                                            <i class="fas fa-${urgenciaIcon}"></i>
                                            <span>${diasEspera} día${diasEspera !== 1 ? 's' : ''}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="usuario-cell">
                                            <i class="fas fa-user"></i>
                                            <span>${planilla.NombreUsuario}</span>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Mostrar modal con SweetAlert2
    Swal.fire({
        html: modalContent,
        width: '1200px',
        showCloseButton: true,
        showConfirmButton: false,
        customClass: {
            popup: 'planillas-modal-popup'
        },
        didOpen: () => {
            // Agregar animaciones a las filas
            document.querySelectorAll('.planilla-row').forEach(row => {
                row.classList.add('fade-in-row');
            });
        }
    });
}
function mostrarDetallesAniversarios(notificacion) {
    const colaboradores = notificacion.data;
    
    // Crear encabezado del modal (mismo código que antes)
    const headerContent = `
        <div class="aniversarios-modal-header">
            <div class="modal-header-icon ${notificacion.color}">
                <i class="fas fa-${notificacion.icon}"></i>
            </div>
            <div class="modal-header-info">
                <h3>${notificacion.title}</h3>
                <p>${colaboradores.length} colaborador${colaboradores.length !== 1 ? 'es' : ''} en los próximos ${notificacion.periodo}</p>
            </div>
            <div class="modal-header-stats">
                <div class="header-stat">
                    <span class="stat-number">${colaboradores.length}</span>
                    <span class="stat-label">Total</span>
                </div>
                <div class="header-stat">
                    <span class="stat-number">${colaboradores.reduce((sum, c) => sum + Number(c.DiasVacacionesAcumulados || 0), 0)}</span>
                    <span class="stat-label">Días Acum.</span>
                </div>
            </div>
        </div>
    `;
    
    // Crear contenido de la tabla CON FECHAS CORREGIDAS
    const tableContent = `
        <div class="aniversarios-content">
            <div class="aniversarios-table-container">
                <table class="aniversarios-table">
                    <thead>
                        <tr>
                            <th>Colaborador</th>
                            <th>Departamento</th>
                            <th>Días para Aniversario</th>
                            <th>Días de Vacaciones</th>
                            <th>Fecha Aniversario</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${colaboradores.map((colaborador, index) => {
                            const diasParaAniversario = Number(colaborador.DiasParaAniversario);
                            const diasVacaciones = Number(colaborador.DiasVacacionesAcumulados || 0);
                            
                            // ✅ CORRECCIÓN DE FECHA - Usar función nueva
                            const fechaAniversario = parseFechaSinZonaHoraria(colaborador.FechaAniversario);
                            
                            const aniosActuales = Number(colaborador.AniosActuales);
                            const proximosAnios = Number(colaborador.ProximosAnios);
                            const fotoSrc = colaborador.FotoBase64 || '../Imagenes/user-default.png';
                            
                            // Determinar la urgencia para los días
                            let urgenciaClass = 'info';
                            let urgenciaText = '';
                            let urgenciaIcon = 'clock';
                            
                            if (diasParaAniversario <= 1) {
                                urgenciaClass = 'danger';
                                urgenciaText = diasParaAniversario === 0 ? '¡HOY!' : 'Mañana';
                                urgenciaIcon = 'exclamation-triangle';
                            } else if (diasParaAniversario <= 7) {
                                urgenciaClass = 'danger';
                                urgenciaText = `${diasParaAniversario} días`;
                                urgenciaIcon = 'exclamation-circle';
                            } else if (diasParaAniversario <= 30) {
                                urgenciaClass = 'warning';
                                urgenciaText = `${diasParaAniversario} días`;
                                urgenciaIcon = 'clock';
                            } else {
                                urgenciaClass = 'info';
                                urgenciaText = `${diasParaAniversario} días`;
                                urgenciaIcon = 'calendar';
                            }
                            
                            // Determinar el color para días de vacaciones
                            let vacacionesClass = 'success';
                            if (diasVacaciones <= 0) {
                                vacacionesClass = 'danger';
                            } else if (diasVacaciones < 15) {
                                vacacionesClass = 'warning';
                            } else if (diasVacaciones < 30) {
                                vacacionesClass = 'info';
                            }
                            
                            return `
                                <tr class="aniversario-row" style="animation-delay: ${index * 0.1}s">
                                    <td>
                                        <div class="colaborador-cell">
                                            <div class="colaborador-photo-container" data-employee-id="${colaborador.IdPersonal}" data-has-photo="${colaborador.TieneFoto}">
                                                <div class="photo-placeholder">
                                                    <i class="fas fa-user"></i>
                                                </div>
                                            </div>
                                            <div class="colaborador-info-cell">
                                                <div class="colaborador-name">${colaborador.NombreCompleto}</div>
                                                <div class="colaborador-puesto">${colaborador.NombrePuesto}</div>
                                                <div class="colaborador-anos">${aniosActuales} → ${proximosAnios} años de servicio</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="departamento-badge">
                                            <i class="fas fa-building"></i>
                                            ${colaborador.NombreDepartamento}
                                        </div>
                                    </td>
                                    <td>
                                        <div class="dias-aniversario ${urgenciaClass}">
                                            <i class="fas fa-${urgenciaIcon}"></i>
                                            <span class="dias-numero">${urgenciaText}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="dias-vacaciones ${vacacionesClass}">
                                            <i class="fas fa-calendar-check"></i>
                                            <span class="dias-numero">${diasVacaciones}</span>
                                            <span class="dias-label">días</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="fecha-aniversario">
                                            <div class="fecha-completa">
                                                <i class="fas fa-calendar-day"></i>
                                                ${formatFechaParaUsuario(fechaAniversario)}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="modal-summary">
                <div class="summary-item">
                    <i class="fas fa-users"></i>
                    <span><strong>${colaboradores.length}</strong> colaboradores próximos a cumplir años</span>
                </div>
                <div class="summary-item">
                    <i class="fas fa-calendar-check"></i>
                    <span><strong>${colaboradores.reduce((sum, c) => sum + Number(c.DiasVacacionesAcumulados || 0), 0)}</strong> días de vacaciones acumulados en total</span>
                </div>
                <div class="summary-item">
                    <i class="fas fa-chart-line"></i>
                    <span>Promedio: <strong>${Math.round(colaboradores.reduce((sum, c) => sum + Number(c.DiasVacacionesAcumulados || 0), 0) / colaboradores.length)}</strong> días por colaborador</span>
                </div>
            </div>
        </div>
    `;
    
    // Mostrar modal con SweetAlert2
    Swal.fire({
        html: headerContent + tableContent,
        width: '1200px',
        showCloseButton: true,
        showConfirmButton: false,
        customClass: {
            popup: 'aniversarios-modal-popup'
        },
        didOpen: () => {
            // Agregar animaciones a las filas
            document.querySelectorAll('.aniversario-row').forEach(row => {
                row.classList.add('fade-in-row');
            });
            
            // CARGAR FOTOS DE FORMA LAZY (una por una)
            cargarFotosLazy();
        }
    });
}
async function cargarFotosLazy() {
    const photoContainers = document.querySelectorAll('.colaborador-photo-container');
    
    for (const container of photoContainers) {
        const employeeId = container.dataset.employeeId;
        const hasPhoto = container.dataset.hasPhoto === '1';
        
        // Si no tiene foto, usar el placeholder
        if (!hasPhoto) {
            container.innerHTML = `
                <img src="../Imagenes/user-default.png" alt="Sin foto" class="colaborador-photo">
            `;
            continue;
        }
        
        try {
            // Cargar foto individual
            const fotoSrc = await cargarFotoColaborador(employeeId);
            
            // Reemplazar placeholder con la foto real
            container.innerHTML = `
                <img src="${fotoSrc}" alt="Foto colaborador" class="colaborador-photo">
            `;
            
        } catch (error) {
            console.error('Error al cargar foto del colaborador:', error);
            // En caso de error, usar imagen por defecto
            container.innerHTML = `
                <img src="../Imagenes/user-default.png" alt="Error cargando foto" class="colaborador-photo">
            `;
        }
        
        // Pequeña pausa para no sobrecargar la base de datos
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}
function parseFechaSinZonaHoraria(fechaString) {
    if (!fechaString) return null;
    
    // Si la fecha viene en formato YYYY-MM-DD desde MySQL
    if (typeof fechaString === 'string' && fechaString.includes('-')) {
        const partes = fechaString.split('-');
        const año = parseInt(partes[0]);
        const mes = parseInt(partes[1]) - 1; // JavaScript usa meses 0-11
        const dia = parseInt(partes[2]);
        
        // Crear fecha usando la zona horaria local, no UTC
        return new Date(año, mes, dia);
    }
    
    // Si viene como objeto Date de la base de datos
    if (fechaString instanceof Date) {
        // Obtener los componentes sin conversión UTC
        const año = fechaString.getFullYear();
        const mes = fechaString.getMonth();
        const dia = fechaString.getDate();
        
        return new Date(año, mes, dia);
    }
    
    // Fallback: intentar parsing normal
    return new Date(fechaString);
}
function formatFechaParaUsuario(fecha) {
    if (!fecha) return 'No disponible';
    
    // Asegurar que es un objeto Date
    const fechaObj = fecha instanceof Date ? fecha : parseFechaSinZonaHoraria(fecha);
    
    if (!fechaObj || isNaN(fechaObj)) return 'Fecha inválida';
    
    // Formatear usando zona horaria local
    return fechaObj.toLocaleDateString('es-GT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Guatemala' // Forzar zona horaria de Guatemala
    });
}
// Función para mostrar modal de edición de colaborador
async function mostrarModalEdicionColaborador(idPersonal, nombreCompleto, departamentoActual, puestoActual) {
    try {
        // Cargar departamentos disponibles
        const connection = await getConnection();
        
        const departamentosQuery = `
            SELECT 
                IdDepartamento,
                NombreDepartamento,
                IdRegion
            FROM 
                departamentos
            ORDER BY 
                NombreDepartamento
        `;
        
        const departamentos = await connection.query(departamentosQuery);
        await connection.close();
        
        // Crear opciones de departamentos
        const opcionesDepartamentos = departamentos.map(dept => 
            `<option value="${dept.IdDepartamento}" ${dept.NombreDepartamento === departamentoActual ? 'selected' : ''}>
                ${dept.NombreDepartamento}
            </option>`
        ).join('');
        
        // HTML del modal de edición
        const modalHtml = `
            <div class="edit-employee-modal-header">
                <div class="modal-title-section">
                    <div class="edit-icon">
                        <i class="fas fa-user-edit"></i>
                    </div>
                    <div class="modal-title-info">
                        <h3>Editar Colaborador</h3>
                        <p>${nombreCompleto}</p>
                    </div>
                </div>
            </div>
            
            <form id="editEmployeeForm" class="edit-employee-form">
                <div class="form-section">
                    <div class="form-group">
                        <label for="editDepartamento" class="form-label">
                            <i class="fas fa-building"></i>
                            Departamento
                        </label>
                        <select id="editDepartamento" name="departamento" class="form-control" required>
                            <option value="">Seleccione un departamento...</option>
                            ${opcionesDepartamentos}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="editPuesto" class="form-label">
                            <i class="fas fa-briefcase"></i>
                            Puesto
                        </label>
                        <select id="editPuesto" name="puesto" class="form-control" required>
                            <option value="">Primero seleccione un departamento...</option>
                        </select>
                        <div class="loading-puestos" style="display: none;">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Cargando puestos...</span>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="cancelarEdicion">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary" id="guardarCambios">
                        <i class="fas fa-save"></i>
                        Guardar Cambios
                    </button>
                </div>
            </form>
        `;
        
        // Mostrar modal con SweetAlert2
        const modal = await Swal.fire({
            html: modalHtml,
            width: '500px',
            showCloseButton: true,
            showConfirmButton: false,
            customClass: {
                popup: 'edit-employee-modal-popup'
            },
            didOpen: () => {
                inicializarEventosEdicion(idPersonal, puestoActual);
            }
        });
        
    } catch (error) {
        console.error('Error al mostrar modal de edición:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo abrir el formulario de edición',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para inicializar eventos del modal de edición
function inicializarEventosEdicion(idPersonal, puestoActual) {
    const selectDepartamento = document.getElementById('editDepartamento');
    const selectPuesto = document.getElementById('editPuesto');
    const loadingPuestos = document.querySelector('.loading-puestos');
    const form = document.getElementById('editEmployeeForm');
    const btnCancelar = document.getElementById('cancelarEdicion');
    
    // Cargar puestos del departamento seleccionado inicialmente
    if (selectDepartamento.value) {
        cargarPuestosPorDepartamento(selectDepartamento.value, puestoActual);
    }
    
    // Evento para cargar puestos cuando cambia el departamento
    selectDepartamento.addEventListener('change', async () => {
        const departamentoId = selectDepartamento.value;
        
        if (!departamentoId) {
            selectPuesto.innerHTML = '<option value="">Primero seleccione un departamento...</option>';
            return;
        }
        
        await cargarPuestosPorDepartamento(departamentoId);
    });
    
    // Evento para cancelar edición
    btnCancelar.addEventListener('click', () => {
        Swal.close();
    });
    
    // Evento para guardar cambios
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarCambiosColaborador(idPersonal, selectDepartamento, selectPuesto);
    });
}

// Función para cargar puestos por departamento
async function cargarPuestosPorDepartamento(departamentoId, puestoActualSeleccionar = null) {
    const selectPuesto = document.getElementById('editPuesto');
    const loadingPuestos = document.querySelector('.loading-puestos');
    
    try {
        // Mostrar loading
        loadingPuestos.style.display = 'flex';
        selectPuesto.disabled = true;
        selectPuesto.innerHTML = '<option value="">Cargando puestos...</option>';
        
        const connection = await getConnection();
        
        const puestosQuery = `
            SELECT 
                IdPuesto,
                Nombre AS NombrePuesto
            FROM 
                Puestos
            WHERE 
                IdDepartamento = ?
            ORDER BY 
                Nombre
        `;
        
        const puestos = await connection.query(puestosQuery, [departamentoId]);
        await connection.close();
        
        // Crear opciones de puestos
        let opcionesPuestos = '<option value="">Seleccione un puesto...</option>';
        
        puestos.forEach(puesto => {
            const selected = puestoActualSeleccionar && puesto.NombrePuesto === puestoActualSeleccionar ? 'selected' : '';
            opcionesPuestos += `<option value="${puesto.IdPuesto}" ${selected}>
                ${puesto.NombrePuesto}
            </option>`;
        });
        
        selectPuesto.innerHTML = opcionesPuestos;
        selectPuesto.disabled = false;
        
        // Ocultar loading
        loadingPuestos.style.display = 'none';
        
        if (puestos.length === 0) {
            selectPuesto.innerHTML = '<option value="">No hay puestos disponibles en este departamento</option>';
            selectPuesto.disabled = true;
        }
        
    } catch (error) {
        console.error('Error al cargar puestos:', error);
        selectPuesto.innerHTML = '<option value="">Error al cargar puestos</option>';
        selectPuesto.disabled = true;
        loadingPuestos.style.display = 'none';
        
        mostrarNotificacion('Error al cargar los puestos del departamento', 'error');
    }
}

// Función para guardar los cambios del colaborador
async function guardarCambiosColaborador(idPersonal, selectDepartamento, selectPuesto) {
    const btnGuardar = document.getElementById('guardarCambios');
    const originalText = btnGuardar.innerHTML;
    
    try {
        // Mostrar loading en el botón
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        const nuevoDepartamentoId = selectDepartamento.value;
        const nuevoPuestoId = selectPuesto.value;
        
        if (!nuevoDepartamentoId || !nuevoPuestoId) {
            throw new Error('Debe seleccionar tanto departamento como puesto');
        }
        
        const connection = await getConnection();
        
        // 1. Obtener datos actuales del colaborador
        const datosActualesQuery = `
            SELECT 
                p.IdPersonal,
                CONCAT(p.PrimerNombre, ' ', IFNULL(p.SegundoNombre, ''), ' ', p.PrimerApellido, ' ', IFNULL(p.SegundoApellido, '')) AS NombreCompleto,
                p.IdSucuDepa AS DepartamentoActual,
                p.IdPuesto AS PuestoActual,
                d.NombreDepartamento AS NombreDepartamentoActual,
                pu.Nombre AS NombrePuestoActual
            FROM 
                personal p
                INNER JOIN departamentos d ON p.IdSucuDepa = d.IdDepartamento
                INNER JOIN Puestos pu ON p.IdPuesto = pu.IdPuesto
            WHERE 
                p.IdPersonal = ?
        `;
        
        const datosActuales = await connection.query(datosActualesQuery, [idPersonal]);
        
        if (datosActuales.length === 0) {
            throw new Error('No se encontró el colaborador');
        }
        
        const colaborador = datosActuales[0];
        
        // 2. Obtener nombres de nuevo departamento y puesto
        const nuevosDatosQuery = `
            SELECT 
                d.NombreDepartamento,
                p.Nombre AS NombrePuesto
            FROM 
                departamentos d,
                Puestos p
            WHERE 
                d.IdDepartamento = ? AND
                p.IdPuesto = ?
        `;
        
        const nuevosDatos = await connection.query(nuevosDatosQuery, [nuevoDepartamentoId, nuevoPuestoId]);
        
        if (nuevosDatos.length === 0) {
            throw new Error('Departamento o puesto no válido');
        }
        
        const nuevosValores = nuevosDatos[0];
        
        // 3. Verificar si realmente hay cambios
        const huboChangioDepartamento = parseInt(colaborador.DepartamentoActual) !== parseInt(nuevoDepartamentoId);
        const huboCanbioPuesto = parseInt(colaborador.PuestoActual) !== parseInt(nuevoPuestoId);
        
        if (!huboChangioDepartamento && !huboCanbioPuesto) {
            mostrarNotificacion('No se detectaron cambios para guardar', 'info');
            Swal.close();
            return;
        }
        
        // 4. Iniciar transacción
        await connection.query('START TRANSACTION');
        
        try {
            // 5. Actualizar datos del colaborador
            const updateQuery = `
                UPDATE personal 
                SET 
                    IdSucuDepa = ?,
                    IdPuesto = ?
                WHERE 
                    IdPersonal = ?
            `;
            
            await connection.query(updateQuery, [nuevoDepartamentoId, nuevoPuestoId, idPersonal]);
            
            // 6. Registrar cambios en CambiosPersonal
            const userData = JSON.parse(localStorage.getItem('userData'));
            
            // Registrar cambio de departamento si aplica
            if (huboChangioDepartamento) {
                const registroDepartamentoQuery = `
                    INSERT INTO CambiosPersonal 
                    (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
                    VALUES (?, ?, 4, 'Departamento', ?, ?, ?, ?)
                `;
                
                await connection.query(registroDepartamentoQuery, [
                    idPersonal,
                    colaborador.NombreCompleto,
                    colaborador.NombreDepartamentoActual,
                    nuevosValores.NombreDepartamento,
                    userData.IdPersonal,
                    userData.NombreCompleto
                ]);
            }
            
            // Registrar cambio de puesto si aplica
            if (huboCanbioPuesto) {
                const registroPuestoQuery = `
                    INSERT INTO CambiosPersonal 
                    (IdPersonal, NombrePersonal, TipoCambio, Cambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
                    VALUES (?, ?, 4, 'Puesto', ?, ?, ?, ?)
                `;
                
                await connection.query(registroPuestoQuery, [
                    idPersonal,
                    colaborador.NombreCompleto,
                    colaborador.NombrePuestoActual,
                    nuevosValores.NombrePuesto,
                    userData.IdPersonal,
                    userData.NombreCompleto
                ]);
            }
            
            // 7. Confirmar transacción
            await connection.query('COMMIT');
            
            // Mostrar mensaje de éxito
            await Swal.fire({
                icon: 'success',
                title: '¡Cambios guardados!',
                text: `Los datos del colaborador han sido actualizados correctamente.`,
                timer: 2000,
                showConfirmButton: false
            });
            
            // Recargar la vista de sucursales
            cargarSucursalesRegionales();
            
        } catch (error) {
            // Rollback en caso de error
            await connection.query('ROLLBACK');
            throw error;
        }
        
        await connection.close();
        
    } catch (error) {
        console.error('Error al guardar cambios:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: error.message || 'No se pudieron guardar los cambios',
            confirmButtonColor: '#FF9800'
        });
    } finally {
        // Restaurar botón
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = originalText;
    }
}
// dashhboad para usuarios basicos
async function mostrarDashboardBasico() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    
    // Crear el contenedor del dashboard básico
    const mainContent = document.querySelector('.main-content');
    const contentAfterHeader = mainContent.querySelector('.content-header').nextElementSibling;
    
    const dashboardBasico = document.createElement('div');
    dashboardBasico.className = 'dashboard-basico-container';
    dashboardBasico.innerHTML = `
        <div class="stats-basico-container">
            <div class="stat-card-basico fijos">
                <div class="stat-icon-basico">
                    <i class="fas fa-user-tie"></i>
                </div>
                <div class="stat-details-basico">
                    <div class="stat-title-basico">Personal Fijo</div>
                    <div class="stat-value-basico" id="personalFijoDept">0</div>
                </div>
            </div>
            
            <div class="stat-card-basico parciales">
                <div class="stat-icon-basico">
                    <i class="fas fa-user-clock"></i>
                </div>
                <div class="stat-details-basico">
                    <div class="stat-title-basico">Personal Parcial</div>
                    <div class="stat-value-basico" id="personalParcialDept">0</div>
                </div>
            </div>
            
            <div class="stat-card-basico vacacionistas">
                <div class="stat-icon-basico">
                    <i class="fas fa-umbrella-beach"></i>
                </div>
                <div class="stat-details-basico">
                    <div class="stat-title-basico">Vacacionistas</div>
                    <div class="stat-value-basico" id="vacacionistasDept">0</div>
                </div>
            </div>
        </div>
        
        <div class="colaboradores-basico-card">
            <div class="colaboradores-basico-header">
                <div class="card-title">
                    <i class="fas fa-list"></i>
                    <span>Lista de Colaboradores</span>
                </div>
                <div class="filtros-basico">
                    <select id="filtroTipoPersonal" class="filtro-select">
                        <option value="">Todos los tipos</option>
                        <option value="1">Personal Fijo</option>
                        <option value="2">Personal Parcial</option>
                        <option value="3">Vacacionistas</option>
                    </select>
                    <input type="text" id="filtroNombre" placeholder="Buscar por nombre..." class="filtro-input">
                    <button class="btn-refresh-basico" id="refreshBasicoBtn" title="Actualizar datos">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
            </div>
            
            <div class="colaboradores-basico-container">
                <div class="colaboradores-basico-loading" id="colaboradoresBasicoLoading">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <span>Cargando colaboradores...</span>
                </div>
                
                <div class="colaboradores-basico-table-container" id="colaboradoresBasicoTableContainer" style="display: none;">
                    <table class="colaboradores-basico-table">
                        <thead>
                            <tr>
                                <th>Colaborador</th>
                                <th>Puesto</th>
                                <th>Tipo de Personal</th>
                                <th>Fecha Ingreso</th>
                            </tr>
                        </thead>
                        <tbody id="colaboradoresBasicoBody">
                            <!-- Datos se cargarán dinámicamente -->
                        </tbody>
                    </table>
                </div>
                
                <div class="colaboradores-basico-empty" id="colaboradoresBasicoEmpty" style="display: none;">
                    <div class="empty-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <h4>No hay colaboradores</h4>
                    <p>No se encontraron colaboradores en tu departamento</p>
                </div>
            </div>
        </div>
    `;
    
    mainContent.insertBefore(dashboardBasico, contentAfterHeader);
    
    // Inicializar funcionalidades
    inicializarDashboardBasico();
}
async function inicializarDashboardBasico() {
    // Cargar datos iniciales
    await cargarDatosDepartamentoBasico();
    
    // Event listeners
    document.getElementById('refreshBasicoBtn').addEventListener('click', cargarDatosDepartamentoBasico);
    document.getElementById('filtroTipoPersonal').addEventListener('change', filtrarColaboradoresBasico);
    document.getElementById('filtroNombre').addEventListener('input', filtrarColaboradoresBasico);
}
async function cargarDatosDepartamentoBasico() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const loadingElement = document.getElementById('colaboradoresBasicoLoading');
    const tableContainer = document.getElementById('colaboradoresBasicoTableContainer');
    const emptyElement = document.getElementById('colaboradoresBasicoEmpty');
    const refreshBtn = document.getElementById('refreshBasicoBtn');
    
    try {
        // Mostrar loading
        loadingElement.style.display = 'flex';
        tableContainer.style.display = 'none';
        emptyElement.style.display = 'none';
        
        // Spinner en botón de refresh
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.add('fa-spin');
        }
        
        const connection = await getConnection();
        
        // Obtener el departamento del usuario
        const departamentoUsuario = userData.IdSucuDepa;
        
        // Query para obtener colaboradores del mismo departamento
        const colaboradores = await connection.query(`
            SELECT
                p.IdPersonal,
                CONCAT(p.PrimerNombre, ' ', IFNULL(p.SegundoNombre, ''), ' ', p.PrimerApellido, ' ', IFNULL(p.SegundoApellido, '')) AS NombreCompleto,
                pu.Nombre AS NombrePuesto,
                tp.TipoPersonal AS TipoPersonalNombre,
                p.TipoPersonal AS IdTipoPersonal,
                p.InicioLaboral,
                p.FechaPlanilla
            FROM
                personal p
                INNER JOIN Puestos pu ON p.IdPuesto = pu.IdPuesto
                INNER JOIN TipoPersonal tp ON p.TipoPersonal = tp.IdTipo
            WHERE
                p.IdSucuDepa = ? AND
                p.Estado = 1
            ORDER BY
                p.PrimerNombre ASC
        `, [departamentoUsuario]);
        
        await connection.close();
        
        // Procesar datos
        const stats = {
            total: colaboradores.length,
            fijos: colaboradores.filter(c => c.IdTipoPersonal === 1).length,
            parciales: colaboradores.filter(c => c.IdTipoPersonal === 2).length,
            vacacionistas: colaboradores.filter(c => c.IdTipoPersonal === 3).length
        };
        
        // Actualizar estadísticas en las tarjetas (solo si existen los elementos)
        const personalFijoElement = document.getElementById('personalFijoDept');
        const personalParcialElement = document.getElementById('personalParcialDept');
        const vacacionistasElement = document.getElementById('vacacionistasDept');
        
        if (personalFijoElement) personalFijoElement.textContent = stats.fijos;
        if (personalParcialElement) personalParcialElement.textContent = stats.parciales;
        if (vacacionistasElement) vacacionistasElement.textContent = stats.vacacionistas;
        
        // Guardar datos para filtros
        window.colaboradoresBasicoData = colaboradores;
        
        // Mostrar tabla
        if (colaboradores.length === 0) {
            loadingElement.style.display = 'none';
            emptyElement.style.display = 'flex';
        } else {
            renderizarColaboradoresBasico(colaboradores);
            loadingElement.style.display = 'none';
            tableContainer.style.display = 'block';
        }
        
        // Detener spinner
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.remove('fa-spin');
        }
        
        // Mostrar notificación de éxito si fue un refresh manual
        if (refreshBtn && refreshBtn.querySelector('i').classList.contains('fa-spin')) {
            mostrarNotificacion('Datos actualizados correctamente', 'success');
        }
        
    } catch (error) {
        console.error('Error al cargar datos del departamento:', error);
        
        // Mostrar error
        loadingElement.style.display = 'none';
        emptyElement.style.display = 'flex';
        emptyElement.innerHTML = `
            <div class="empty-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h4>Error al cargar datos</h4>
            <p>No se pudieron cargar los datos del departamento</p>
        `;
        
        // Detener spinner
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.remove('fa-spin');
        }
        
        mostrarNotificacion('Error al cargar los datos del departamento', 'error');
    }
}
function renderizarColaboradoresBasico(colaboradores) {
    const tbody = document.getElementById('colaboradoresBasicoBody');
    tbody.innerHTML = '';
    
    colaboradores.forEach((colaborador, index) => {
        const fechaIngreso = colaborador.InicioLaboral ? 
            new Date(colaborador.InicioLaboral).toLocaleDateString('es-GT') : 'N/A';
        
        // Determinar clase de tipo de personal
        let tipoClase = 'tipo-fijo';
        if (colaborador.IdTipoPersonal === 2) tipoClase = 'tipo-parcial';
        else if (colaborador.IdTipoPersonal === 3) tipoClase = 'tipo-vacacionista';
        
        const row = document.createElement('tr');
        row.className = 'colaborador-basico-row';
        row.style.animationDelay = `${index * 0.05}s`;
        row.innerHTML = `
            <td>
                <div class="colaborador-basico-info">
                    <div class="colaborador-basico-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="colaborador-basico-details">
                        <span class="colaborador-basico-name">${colaborador.NombreCompleto}</span>
                        <span class="colaborador-basico-id">ID: ${colaborador.IdPersonal}</span>
                    </div>
                </div>
            </td>
            <td>
                <span class="puesto-basico-badge">${colaborador.NombrePuesto}</span>
            </td>
            <td>
                <span class="tipo-personal-badge ${tipoClase}">
                    ${colaborador.TipoPersonalNombre}
                </span>
            </td>
            <td>
                <span class="fecha-basico">${fechaIngreso}</span>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Agregar animación
    document.querySelectorAll('.colaborador-basico-row').forEach(row => {
        row.classList.add('fade-in-basico');
    });
}

function filtrarColaboradoresBasico() {
    const filtroTipo = document.getElementById('filtroTipoPersonal').value;
    const filtroNombre = document.getElementById('filtroNombre').value.toLowerCase().trim();
    
    if (!window.colaboradoresBasicoData) return;
    
    let colaboradoresFiltrados = window.colaboradoresBasicoData;
    
    // Filtrar por tipo
    if (filtroTipo) {
        colaboradoresFiltrados = colaboradoresFiltrados.filter(c => 
            c.IdTipoPersonal.toString() === filtroTipo
        );
    }
    
    // Filtrar por nombre
    if (filtroNombre) {
        colaboradoresFiltrados = colaboradoresFiltrados.filter(c => 
            c.NombreCompleto.toLowerCase().includes(filtroNombre)
        );
    }
    
    // Renderizar resultados filtrados
    if (colaboradoresFiltrados.length === 0) {
        document.getElementById('colaboradoresBasicoTableContainer').style.display = 'none';
        document.getElementById('colaboradoresBasicoEmpty').style.display = 'flex';
        document.getElementById('colaboradoresBasicoEmpty').innerHTML = `
            <div class="empty-icon">
                <i class="fas fa-search"></i>
            </div>
            <h4>No se encontraron resultados</h4>
            <p>Intenta ajustar los filtros de búsqueda</p>
        `;
    } else {
        document.getElementById('colaboradoresBasicoEmpty').style.display = 'none';
        document.getElementById('colaboradoresBasicoTableContainer').style.display = 'block';
        renderizarColaboradoresBasico(colaboradoresFiltrados);
    }
}
personalNuevoBtn.addEventListener('click', abrirVentanaPersonalNuevo);
BusquetaPBtn.addEventListener('click', abrirVentanaBusquedaP);
// Inicializar la página
document.addEventListener('DOMContentLoaded', () => {
    // Cargar información del usuario
    cargarInfoUsuario();
    
    // Cargar estadísticas
    cargarEstadisticas();
    
    // Inicializar efectos visuales
    inicializarEfectosVisuales();
    
    // Mostrar notificación de bienvenida después de un breve retraso
    setTimeout(() => {
        mostrarNotificacion('¡Bienvenido al Sistema de Recursos Humanos!', 'success');
    }, 1000);
    const notificationsIcon = document.getElementById('notificationsIcon');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    const refreshNotificationsBtn = document.getElementById('refreshNotifications');
    const markAllAsReadBtn = document.getElementById('markAllAsRead');
    
    // Mostrar/ocultar dropdown al hacer clic en el icono
    notificationsIcon.addEventListener('click', () => {
        notificationsDropdown.classList.toggle('show');
    });
    
    // Cerrar dropdown al hacer clic fuera de él
    document.addEventListener('click', (e) => {
        if (!notificationsIcon.contains(e.target) && !notificationsDropdown.contains(e.target)) {
            notificationsDropdown.classList.remove('show');
        }
    });
    
    // Refrescar notificaciones
    refreshNotificationsBtn.addEventListener('click', () => {
        // Mostrar spinner en el botón
        refreshNotificationsBtn.querySelector('i').classList.add('fa-spin');
        
        // Mostrar estado de carga
        document.getElementById('notificationsBody').innerHTML = `
            <div class="loading-notifications">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Actualizando notificaciones...</span>
            </div>
        `;
        
        // Cargar notificaciones con un pequeño delay para mostrar la animación
        setTimeout(() => {
            cargarNotificaciones().then(() => {
                refreshNotificationsBtn.querySelector('i').classList.remove('fa-spin');
                mostrarNotificacion('Notificaciones actualizadas', 'success');
            });
        }, 800);
    });
    
    // Marcar todas como leídas (en este caso, lo simulamos ocultando temporalmente)
    markAllAsReadBtn.addEventListener('click', () => {
        const notificationItems = document.querySelectorAll('.notification-item');
        
        // Añadir clase de desvanecimiento
        notificationItems.forEach(item => {
            item.classList.add('read');
        });
        
        // Actualizar badge
        document.getElementById('notificationBadge').textContent = '0';
        document.getElementById('notificationBadge').classList.remove('active');
        
        // Mostrar mensaje
        setTimeout(() => {
            document.getElementById('notificationsBody').innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-check-circle"></i>
                    <p>No hay notificaciones pendientes</p>
                </div>
            `;
            
            mostrarNotificacion('Todas las notificaciones han sido marcadas como leídas', 'success');
        }, 300);
    });
    
    // Cargar notificaciones iniciales
    cargarNotificaciones();
});