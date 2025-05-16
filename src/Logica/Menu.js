// Configuración e inicialización
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
        
        // Actualizar el saludo según la hora
        actualizarSaludo();
        setInterval(actualizarSaludo, 3600000);
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
        
        // Preparar los datos de notificaciones
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
function inicializarNotificaciones() {
    // Efecto hover para el icono de notificaciones
    const notifIcon = document.getElementById('notificationsIcon');
    if (notifIcon) {
        notifIcon.addEventListener('mouseenter', () => {
            const icon = notifIcon.querySelector('i');
            icon.classList.add('fa-shake');
            setTimeout(() => {
                icon.classList.remove('fa-shake');
            }, 500);
        });
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