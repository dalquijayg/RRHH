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
const PagoBonificaciones = document.getElementById('registrarAdicionalesBtn');

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

// Función para obtener el nombre del puesto
async function obtenerNombrePuesto(idPuesto) {
    try {
        const connection = await getConnection();
        const result = await connection.query(`
            SELECT 
                pg.Nombre AS NombrePuesto
            FROM 
                Puestos p
                INNER JOIN PuestosGenerales pg ON p.Id_PuestoGeneral = pg.Id_Puesto
            WHERE 
                p.IdPuesto = ?
        `, [idPuesto]);
        
        await connection.close();
        
        if (result.length > 0) {
            return result[0].NombrePuesto;
        } else {
            return 'Puesto no encontrado';
        }
    } catch (error) {
        console.error('Error al obtener nombre del puesto:', error);
        return 'Error al cargar puesto';
    }
}

// ================================
// FUNCIONALIDAD PARA GERENTES REGIONALES
// IDs de puestos: 94, 95, 175
// ================================

// Función para verificar si el usuario es Gerente Regional
function esGerenteRegional(idPuesto) {
    const gerentesRegionales = [94, 95, 175];
    return gerentesRegionales.includes(Number(idPuesto));
}

// Función para ocultar secciones no necesarias para Gerentes Regionales
function ocultarSeccionesParaGerentesRegionales() {
    // Ocultar toda la fila del dashboard que contiene regiones y gráficos
    const dashboardRows = document.querySelectorAll('.dashboard-row');
    dashboardRows.forEach(row => {
        row.style.display = 'none';
    });
    
    // También ocultar el selector de regiones específicamente
    const regionSelectorCard = document.querySelector('.region-selector-card');
    if (regionSelectorCard) {
        regionSelectorCard.style.display = 'none';
    }
    
    // Ocultar gráficos
    const chartCard = document.querySelector('.chart-card');
    if (chartCard) {
        chartCard.style.display = 'none';
    }
    
    // Ocultar estado de departamentos
    const estadoResumenCard = document.querySelector('.estado-resumen-card');
    if (estadoResumenCard) {
        estadoResumenCard.style.display = 'none';
    }
}

// Función para obtener las tiendas a cargo del gerente
async function obtenerTiendasACargo(idPersonal) {
    try {
        const connection = await getConnection();
        
        // Consulta para obtener departamentos/tiendas donde el usuario es encargado regional
        const query = `
            SELECT 
                d.IdDepartamento,
                d.NombreDepartamento,
                d.CantFijos,
                d.CantParciales,
                d.CantVacacionista,
                r.NombreRegion,
                -- Contar personal actual por tipo
                SUM(CASE WHEN p.TipoPersonal = 1 AND p.Estado = 1 THEN 1 ELSE 0 END) AS PersonalFijoActual,
                SUM(CASE WHEN p.TipoPersonal = 2 AND p.Estado = 1 THEN 1 ELSE 0 END) AS PersonalParcialActual,
                SUM(CASE WHEN p.TipoPersonal = 3 AND p.Estado = 1 THEN 1 ELSE 0 END) AS VacacionistasActual,
                COUNT(CASE WHEN p.Estado = 1 THEN p.IdPersonal END) AS TotalPersonalActual
            FROM 
                departamentos d
                LEFT JOIN Regiones r ON d.IdRegion = r.IdRegion
                LEFT JOIN personal p ON d.IdDepartamento = p.IdSucuDepa AND p.Estado = 1
            WHERE 
                d.IdEncargadoRegional = ?
            GROUP BY 
                d.IdDepartamento, d.NombreDepartamento, d.CantFijos, d.CantParciales, 
                d.CantVacacionista, r.NombreRegion
            ORDER BY 
                d.NombreDepartamento
        `;
        
        const resultado = await connection.query(query, [idPersonal]);
        await connection.close();
        
        return resultado || [];
    } catch (error) {
        console.error('Error al obtener tiendas a cargo:', error);
        return [];
    }
}

// Función para obtener personal de una tienda específica
async function obtenerPersonalTienda(tiendaId) {
    try {
        const connection = await getConnection();
        
        const query = `
            SELECT 
                p.IdPersonal,
                CONCAT(p.PrimerNombre, ' ', IFNULL(p.SegundoNombre, ''), ' ', IFNULL(p.TercerNombre, ''), ' ', p.PrimerApellido, ' ', IFNULL(p.SegundoApellido, '')) AS NombreCompleto,
                p.DPI,
                pg.Nombre AS NombrePuesto,
                CASE p.TipoPersonal 
                    WHEN 1 THEN 'Fijo'
                    WHEN 2 THEN 'Parcial'
                    WHEN 3 THEN 'Vacacionista'
                    ELSE 'No definido'
                END AS TipoPersonal,
                p.InicioLaboral,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM 
                personal p
                INNER JOIN Puestos pu ON p.IdPuesto = pu.IdPuesto
                INNER JOIN PuestosGenerales pg ON pu.Id_PuestoGeneral = pg.Id_Puesto
                LEFT JOIN FotosPersonal ON p.IdPersonal = FotosPersonal.IdPersonal
            WHERE 
                p.IdSucuDepa = ? AND p.Estado = 1
            ORDER BY 
                p.PrimerApellido, p.PrimerNombre
        `;
        
        const resultado = await connection.query(query, [tiendaId]);
        await connection.close();
        
        return resultado || [];
    } catch (error) {
        console.error('Error al obtener personal de tienda:', error);
        return [];
    }
}

// Configuración específica para Gerentes Regionales
async function configurarDashboardGerenteRegional(idPersonal) {
    try {
        // Cambiar el título del dashboard
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            pageTitle.innerHTML = 'Dashboard Gerencial <span class="gerente-regional-badge">Gerente Regional</span>';
        }

        // Obtener las tiendas a cargo
        const tiendasACargo = await obtenerTiendasACargo(idPersonal);
        
        if (tiendasACargo.length > 0) {
            // Ocultar secciones que no son relevantes para gerentes regionales
            ocultarSeccionesParaGerentesRegionales();
            
            // Reemplazar las tarjetas de estadísticas con las tiendas
            await mostrarDashboardTiendas(tiendasACargo);
            
            // Agregar estilos específicos
            agregarEstilosGerenteRegional();
            
            // Mostrar notificación especial
            setTimeout(() => {
                mostrarNotificacion(`¡Bienvenido Gerente Regional! Tienes ${tiendasACargo.length} tiendas a tu cargo.`, 'info');
            }, 1500);
        } else {
            mostrarNotificacion('No se encontraron tiendas asignadas a tu cargo.', 'warning');
        }
        
    } catch (error) {
        console.error('Error en configuración Gerente Regional:', error);
        mostrarNotificacion('Error al cargar información de tiendas', 'error');
    }
}

// Función para mostrar el dashboard de tiendas
async function mostrarDashboardTiendas(tiendas) {
    try {
        // Reemplazar el contenido de las tarjetas de estadísticas
        const statsContainer = document.querySelector('.stats-container');
        if (!statsContainer) return;

        // Crear el nuevo contenido para tiendas
        let contenidoTiendas = '';
        
        // Agregar resumen general primero
        const resumenGeneral = calcularResumenGeneral(tiendas);
        contenidoTiendas += crearTarjetaResumenGeneral(resumenGeneral);
        
        // Crear tarjetas para cada tienda
        tiendas.forEach((tienda, index) => {
            contenidoTiendas += crearTarjetaTienda(tienda, index);
        });

        statsContainer.innerHTML = contenidoTiendas;
        
        // Agregar event listeners para las tarjetas de tiendas
        agregarEventListenersTiendas();
        
        // Animar las tarjetas
        animarTarjetasTiendas();
        
    } catch (error) {
        console.error('Error al mostrar dashboard de tiendas:', error);
    }
}

// Función para calcular resumen general
function calcularResumenGeneral(tiendas) {
    return tiendas.reduce((resumen, tienda) => {
        resumen.totalTiendas++;
        resumen.totalPersonal += Number(tienda.TotalPersonalActual) || 0;
        resumen.totalFijos += Number(tienda.PersonalFijoActual) || 0;
        resumen.totalParciales += Number(tienda.PersonalParcialActual) || 0;
        resumen.totalVacacionistas += Number(tienda.VacacionistasActual) || 0;
        
        // Calcular estado de la tienda
        const estado = determinarEstadoTienda(tienda);
        if (estado === 'completo') resumen.tiendasCompletas++;
        else if (estado === 'deficit') resumen.tiendasConDeficit++;
        else if (estado === 'excedente') resumen.tiendasConExcedente++;
        
        return resumen;
    }, {
        totalTiendas: 0,
        totalPersonal: 0,
        totalFijos: 0,
        totalParciales: 0,
        totalVacacionistas: 0,
        tiendasCompletas: 0,
        tiendasConDeficit: 0,
        tiendasConExcedente: 0
    });
}

// Función para crear tarjeta de resumen general
function crearTarjetaResumenGeneral(resumen) {
    return `
        <div class="tienda-card resumen-general animate__animated animate__fadeInUp" style="--delay: 0.1s">
            <div class="tienda-header">
                <div class="tienda-icon resumen">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="tienda-info">
                    <h3>Resumen General</h3>
                    <p class="tienda-region">Todas las Tiendas</p>
                </div>
                <div class="tienda-status">
                    <span class="status-badge total">${resumen.totalTiendas} Tiendas</span>
                </div>
            </div>
            <div class="tienda-stats">
                <div class="stat-item">
                    <i class="fas fa-users"></i>
                    <span class="stat-label">Total Personal</span>
                    <span class="stat-value">${resumen.totalPersonal}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-user-tie"></i>
                    <span class="stat-label">Fijos</span>
                    <span class="stat-value">${resumen.totalFijos}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-user-clock"></i>
                    <span class="stat-label">Parciales</span>
                    <span class="stat-value">${resumen.totalParciales}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-umbrella-beach"></i>
                    <span class="stat-label">Vacacionistas</span>
                    <span class="stat-value">${resumen.totalVacacionistas}</span>
                </div>
            </div>
            <div class="tienda-status-summary">
                <div class="status-item completo">
                    <i class="fas fa-check-circle"></i>
                    <span>${resumen.tiendasCompletas} Completas</span>
                </div>
                <div class="status-item deficit">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${resumen.tiendasConDeficit} Con Déficit</span>
                </div>
                <div class="status-item excedente">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>${resumen.tiendasConExcedente} Con Excedente</span>
                </div>
            </div>
        </div>
    `;
}

// Función para crear tarjeta de tienda individual
function crearTarjetaTienda(tienda, index) {
    const estado = determinarEstadoTienda(tienda);
    const porcentajeOcupacion = calcularPorcentajeOcupacion(tienda);
    const delay = 0.2 + (index * 0.1);
    
    return `
        <div class="tienda-card animate__animated animate__fadeInUp" style="--delay: ${delay}s" data-tienda-id="${tienda.IdDepartamento}">
            <div class="tienda-header">
                <div class="tienda-icon ${estado}">
                    <i class="fas fa-store"></i>
                </div>
                <div class="tienda-info">
                    <h3>${tienda.NombreDepartamento}</h3>
                    <p class="tienda-region">${tienda.NombreRegion || 'Sin región'}</p>
                </div>
                <div class="tienda-status">
                    <span class="status-badge ${estado}">${obtenerTextoEstado(estado)}</span>
                </div>
            </div>
            
            <div class="tienda-ocupacion">
                <div class="ocupacion-info">
                    <span>Ocupación: ${porcentajeOcupacion}%</span>
                    <span class="ocupacion-numero">${tienda.TotalPersonalActual}/${calcularCapacidadTotal(tienda)}</span>
                </div>
                <div class="ocupacion-bar">
                    <div class="ocupacion-fill ${estado}" style="width: ${Math.min(porcentajeOcupacion, 100)}%"></div>
                </div>
            </div>
            
            <div class="tienda-stats">
                <div class="stat-item">
                    <i class="fas fa-user-tie"></i>
                    <span class="stat-label">Fijos</span>
                    <span class="stat-value">${tienda.PersonalFijoActual}/${tienda.CantFijos}</span>
                    <span class="stat-indicator ${determinarEstadoIndividual(tienda.CantFijos, tienda.PersonalFijoActual)}"></span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-user-clock"></i>
                    <span class="stat-label">Parciales</span>
                    <span class="stat-value">${tienda.PersonalParcialActual}/${tienda.CantParciales}</span>
                    <span class="stat-indicator ${determinarEstadoIndividual(tienda.CantParciales, tienda.PersonalParcialActual)}"></span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-umbrella-beach"></i>
                    <span class="stat-label">Vacacionistas</span>
                    <span class="stat-value">${tienda.VacacionistasActual}/${tienda.CantVacacionista}</span>
                    <span class="stat-indicator ${determinarEstadoIndividual(tienda.CantVacacionista, tienda.VacacionistasActual)}"></span>
                </div>
            </div>
            
            <div class="tienda-actions">
                <button class="btn-tienda-detalle" data-tienda-id="${tienda.IdDepartamento}">
                    <i class="fas fa-eye"></i> Ver Detalles
                </button>
                <button class="btn-tienda-personal" data-tienda-id="${tienda.IdDepartamento}">
                    <i class="fas fa-users"></i> Personal
                </button>
            </div>
        </div>
    `;
}

// Funciones auxiliares para cálculos de tiendas
function determinarEstadoTienda(tienda) {
    const totalRequerido = Number(tienda.CantFijos) + Number(tienda.CantParciales) + Number(tienda.CantVacacionista);
    const totalActual = Number(tienda.TotalPersonalActual);
    
    if (totalRequerido === 0) return 'sin-datos';
    if (totalActual === totalRequerido) return 'completo';
    if (totalActual < totalRequerido) return 'deficit';
    return 'excedente';
}

function calcularPorcentajeOcupacion(tienda) {
    const totalRequerido = calcularCapacidadTotal(tienda);
    const totalActual = Number(tienda.TotalPersonalActual);
    
    if (totalRequerido === 0) return 0;
    return Math.round((totalActual / totalRequerido) * 100);
}

function calcularCapacidadTotal(tienda) {
    return Number(tienda.CantFijos) + Number(tienda.CantParciales) + Number(tienda.CantVacacionista);
}

function determinarEstadoIndividual(requerido, actual) {
    if (Number(requerido) === 0) return 'sin-datos';
    if (Number(actual) === Number(requerido)) return 'completo';
    if (Number(actual) < Number(requerido)) return 'deficit';
    return 'excedente';
}

function obtenerTextoEstado(estado) {
    const textos = {
        completo: 'Completo',
        deficit: 'Déficit',
        excedente: 'Excedente',
        'sin-datos': 'Sin Datos'
    };
    return textos[estado] || 'Desconocido';
}
// Cargar información del usuario (ACTUALIZADA)
async function cargarInfoUsuario() {
    if (userData) {
        document.getElementById('userName').textContent = userData.NombreCompleto || 'Usuario';
        
        // Determinar rol según el puesto (MEJORADO)
        let rol = 'Usuario';
        
        // Verificar si es puesto especial ID 140
        if (userData.Id_Puesto === 140) {
            try {
                // Obtener el nombre real del puesto para ID 140
                const nombrePuesto = await obtenerNombrePuesto(userData.IdPuesto);
                rol = nombrePuesto;
            } catch (error) {
                console.error('Error al obtener nombre del puesto:', error);
                rol = 'Colaborador Especializado';
            }
        } else if (userData.Id_Puesto === 5) {
            rol = 'Administrador RRHH';
        } else if (userData.Id_Puesto === 1) {
            rol = 'Gerente';
        } else if (esGerenteRegional(userData.Id_Puesto)) {
            // Para Gerentes Regionales, obtener el nombre del puesto
            try {
                const nombrePuesto = await obtenerNombrePuesto(userData.IdPuesto);
                rol = nombrePuesto;
            } catch (error) {
                console.error('Error al obtener nombre del puesto:', error);
                rol = 'Gerente Regional';
            }
        } else {
            // Para otros puestos, también obtener el nombre real
            try {
                const nombrePuesto = await obtenerNombrePuesto(userData.IdPuesto);
                rol = nombrePuesto;
            } catch (error) {
                console.error('Error al obtener nombre del puesto:', error);
                rol = 'Colaborador';
            }
        }
        
        document.getElementById('userRole').textContent = rol;
        
        // Cargar la imagen del usuario si está disponible
        if (userData.FotoBase64) {
            document.getElementById('userImage').src = userData.FotoBase64;
        }
        
        // Actualizar el saludo según la hora
        actualizarSaludo();
        setInterval(actualizarSaludo, 3600000);
        
        // Personalizar dashboard según el puesto (ACTUALIZADO)
        await personalizarDashboardSegunPuesto(userData.Id_Puesto, userData.IdPersonal);
    }
}

// Nueva función para personalizar el dashboard según el puesto (ACTUALIZADA)
async function personalizarDashboardSegunPuesto(idPuesto, idPersonal) {
    try {
        // Si es puesto ID 140, aplicar configuraciones especiales
        if (idPuesto === 140) {
            await configurarDashboardPuesto140();
        }
        // NUEVO: Si es Gerente Regional (94, 95, 175)
        else if (esGerenteRegional(idPuesto)) {
            await configurarDashboardGerenteRegional(idPersonal);
        }
        
        // Aquí puedes agregar más personalizaciones para otros puestos
        
    } catch (error) {
        console.error('Error al personalizar dashboard:', error);
    }
}

// Configuración específica para puesto ID 140
async function configurarDashboardPuesto140() {
    try {
        // Agregar indicador visual especial
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            pageTitle.innerHTML += ' <span class="puesto-140-badge">Dashboard Especializado</span>';
        }
        
        // Personalizar mensaje de bienvenida
        setTimeout(() => {
            mostrarNotificacion('¡Bienvenido! Dashboard configurado para tu puesto especializado.', 'info');
        }, 1500);
        
        // Agregar estilos específicos para el puesto 140
        agregarEstilosPuesto140();
        
    } catch (error) {
        console.error('Error en configuración puesto 140:', error);
    }
}

// Agregar estilos específicos para puesto 140
function agregarEstilosPuesto140() {
    const style = document.createElement('style');
    style.textContent = `
        .puesto-140-badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 0.7rem;
            font-weight: 500;
            margin-left: 10px;
            display: inline-block;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            animation: specialBadgeGlow 3s infinite alternate;
        }
        
        @keyframes specialBadgeGlow {
            0% { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            100% { box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3); }
        }
        
        /* Destacar el perfil del usuario con puesto 140 */
        .user-profile {
            position: relative;
        }
        
        .user-profile::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(45deg, #667eea, #764ba2, #667eea);
            background-size: 200% 200%;
            border-radius: 8px;
            z-index: -1;
            animation: gradientShift 3s ease infinite;
            opacity: 0.3;
        }
        
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
    `;
    document.head.appendChild(style);
}

// Función para agregar event listeners a las tarjetas de tiendas
function agregarEventListenersTiendas() {
    // Event listeners para botones de detalles
    document.querySelectorAll('.btn-tienda-detalle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tiendaId = e.target.closest('.btn-tienda-detalle').dataset.tiendaId;
            mostrarDetalleTienda(tiendaId);
        });
    });
    
    // Event listeners para botones de personal
    document.querySelectorAll('.btn-tienda-personal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tiendaId = e.target.closest('.btn-tienda-personal').dataset.tiendaId;
            mostrarPersonalTienda(tiendaId);
        });
    });
    
    // Hover effects para las tarjetas
    document.querySelectorAll('.tienda-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '';
        });
    });
}

// Función para animar las tarjetas
function animarTarjetasTiendas() {
    // Animar barras de ocupación
    setTimeout(() => {
        document.querySelectorAll('.ocupacion-fill').forEach(fill => {
            const width = fill.style.width;
            fill.style.width = '0%';
            setTimeout(() => {
                fill.style.transition = 'width 1.5s ease-out';
                fill.style.width = width;
            }, 100);
        });
    }, 500);
}

// Función MEJORADA para mostrar detalles de una tienda específica
async function mostrarDetalleTienda(tiendaId) {
    try {
        mostrarNotificacion('Cargando detalles de la tienda...', 'info');
        
        // Obtener información detallada de la tienda
        const connection = await getConnection();
        const tiendaInfo = await connection.query(`
            SELECT 
                d.IdDepartamento,
                d.NombreDepartamento,
                d.CantFijos,
                d.CantParciales,
                d.CantVacacionista,
                r.NombreRegion,
                SUM(CASE WHEN p.TipoPersonal = 1 AND p.Estado = 1 THEN 1 ELSE 0 END) AS PersonalFijoActual,
                SUM(CASE WHEN p.TipoPersonal = 2 AND p.Estado = 1 THEN 1 ELSE 0 END) AS PersonalParcialActual,
                SUM(CASE WHEN p.TipoPersonal = 3 AND p.Estado = 1 THEN 1 ELSE 0 END) AS VacacionistasActual,
                COUNT(CASE WHEN p.Estado = 1 THEN p.IdPersonal END) AS TotalPersonalActual
            FROM 
                departamentos d
                LEFT JOIN Regiones r ON d.IdRegion = r.IdRegion
                LEFT JOIN personal p ON d.IdDepartamento = p.IdSucuDepa AND p.Estado = 1
            WHERE 
                d.IdDepartamento = ?
            GROUP BY 
                d.IdDepartamento
        `, [tiendaId]);
        
        await connection.close();
        
        if (tiendaInfo.length === 0) {
            mostrarNotificacion('No se encontró información de la tienda', 'error');
            return;
        }
        
        const tienda = tiendaInfo[0];
        const estado = determinarEstadoTienda(tienda);
        const porcentajeOcupacion = calcularPorcentajeOcupacion(tienda);
        
        // Crear contenido del modal con diseño atractivo
        const modalContent = `
            <div class="detalle-tienda-container">
                <div class="detalle-header">
                    <div class="detalle-tienda-icon ${estado}">
                        <i class="fas fa-store"></i>
                    </div>
                    <div class="detalle-info">
                        <h2>${tienda.NombreDepartamento}</h2>
                        <p class="detalle-region">${tienda.NombreRegion || 'Sin región'}</p>
                        <span class="detalle-status-badge ${estado}">${obtenerTextoEstado(estado)}</span>
                    </div>
                </div>
                
                <div class="detalle-ocupacion-section">
                    <h3><i class="fas fa-chart-pie"></i> Ocupación General</h3>
                    <div class="detalle-ocupacion-visual">
                        <div class="ocupacion-circular">
                            <div class="circular-progress" data-percentage="${porcentajeOcupacion}">
                                <span class="percentage">${porcentajeOcupacion}%</span>
                            </div>
                        </div>
                        <div class="ocupacion-info-detalle">
                            <div class="info-item">
                                <span class="label">Personal Actual:</span>
                                <span class="value">${tienda.TotalPersonalActual}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Capacidad Total:</span>
                                <span class="value">${calcularCapacidadTotal(tienda)}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Estado:</span>
                                <span class="value ${estado}">${obtenerTextoEstado(estado)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="detalle-distribucion">
                    <h3><i class="fas fa-users"></i> Distribución por Tipo de Personal</h3>
                    <div class="distribucion-grid">
                        <div class="distribucion-item fijos">
                            <div class="dist-icon">
                                <i class="fas fa-user-tie"></i>
                            </div>
                            <div class="dist-info">
                                <h4>Personal Fijo</h4>
                                <div class="dist-numbers">
                                    <span class="actual">${tienda.PersonalFijoActual}</span>
                                    <span class="separator">/</span>
                                    <span class="objetivo">${tienda.CantFijos}</span>
                                </div>
                                <div class="dist-bar">
                                    <div class="dist-fill ${determinarEstadoIndividual(tienda.CantFijos, tienda.PersonalFijoActual)}" 
                                         style="width: ${tienda.CantFijos ? (tienda.PersonalFijoActual / tienda.CantFijos * 100) : 0}%"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="distribucion-item parciales">
                            <div class="dist-icon">
                                <i class="fas fa-user-clock"></i>
                            </div>
                            <div class="dist-info">
                                <h4>Personal Parcial</h4>
                                <div class="dist-numbers">
                                    <span class="actual">${tienda.PersonalParcialActual}</span>
                                    <span class="separator">/</span>
                                    <span class="objetivo">${tienda.CantParciales}</span>
                                </div>
                                <div class="dist-bar">
                                    <div class="dist-fill ${determinarEstadoIndividual(tienda.CantParciales, tienda.PersonalParcialActual)}" 
                                         style="width: ${tienda.CantParciales ? (tienda.PersonalParcialActual / tienda.CantParciales * 100) : 0}%"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="distribucion-item vacacionistas">
                            <div class="dist-icon">
                                <i class="fas fa-umbrella-beach"></i>
                            </div>
                            <div class="dist-info">
                                <h4>Vacacionistas</h4>
                                <div class="dist-numbers">
                                    <span class="actual">${tienda.VacacionistasActual}</span>
                                    <span class="separator">/</span>
                                    <span class="objetivo">${tienda.CantVacacionista}</span>
                                </div>
                                <div class="dist-bar">
                                    <div class="dist-fill ${determinarEstadoIndividual(tienda.CantVacacionista, tienda.VacacionistasActual)}" 
                                         style="width: ${tienda.CantVacacionista ? (tienda.VacacionistasActual / tienda.CantVacacionista * 100) : 0}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="detalle-acciones">
                    <button class="btn-detalle-accion ver-personal" onclick="cerrarDetalleYAbrirPersonal(${tiendaId})">
                        <i class="fas fa-users"></i>
                        Ver Personal de esta Tienda
                    </button>
                </div>
            </div>
        `;
        
        // Mostrar el modal con el contenido personalizado
        Swal.fire({
            title: '',
            html: modalContent,
            width: '800px',
            showConfirmButton: true,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#FF9800',
            didOpen: () => {
                // Animar la barra circular
                animarBarraCircular();
            }
        });
        
    } catch (error) {
        console.error('Error al mostrar detalles:', error);
        mostrarNotificacion('Error al cargar detalles de la tienda', 'error');
    }
}

// Función MEJORADA para mostrar personal de una tienda específica
async function mostrarPersonalTienda(tiendaId) {
    try {
        mostrarNotificacion('Cargando personal de la tienda...', 'info');
        
        // Obtener el personal de la tienda
        const personalData = await obtenerPersonalTienda(tiendaId);
        
        // Obtener información de la tienda
        const connection = await getConnection();
        const tiendaInfo = await connection.query(`
            SELECT NombreDepartamento, r.NombreRegion 
            FROM departamentos d 
            LEFT JOIN Regiones r ON d.IdRegion = r.IdRegion 
            WHERE d.IdDepartamento = ?
        `, [tiendaId]);
        await connection.close();
        
        const nombreTienda = tiendaInfo.length > 0 ? tiendaInfo[0].NombreDepartamento : 'Tienda';
        const regionTienda = tiendaInfo.length > 0 ? tiendaInfo[0].NombreRegion : '';
        
        // Crear contenido del modal
        let modalContent = `
            <div class="personal-tienda-container">
                <div class="personal-header">
                    <div class="personal-tienda-info">
                        <h2><i class="fas fa-store"></i> ${nombreTienda}</h2>
                        ${regionTienda ? `<p class="personal-region">${regionTienda}</p>` : ''}
                        <div class="personal-stats">
                            <span class="stat-badge">
                                <i class="fas fa-users"></i>
                                ${personalData.length} Colaboradores
                            </span>
                        </div>
                    </div>
                </div>
        `;
        
        if (personalData.length === 0) {
            modalContent += `
                <div class="personal-empty">
                    <i class="fas fa-user-slash fa-3x"></i>
                    <h3>No hay personal asignado</h3>
                    <p>Esta tienda no tiene colaboradores asignados actualmente.</p>
                </div>
            `;
        } else {
            // Agrupar por tipo de personal
            const personalPorTipo = {
                'Fijo': personalData.filter(p => p.TipoPersonal === 'Fijo'),
                'Parcial': personalData.filter(p => p.TipoPersonal === 'Parcial'),
                'Vacacionista': personalData.filter(p => p.TipoPersonal === 'Vacacionista')
            };
            
            modalContent += '<div class="personal-sections">';
            
            Object.keys(personalPorTipo).forEach(tipo => {
                if (personalPorTipo[tipo].length > 0) {
                    const iconMap = {
                        'Fijo': 'user-tie',
                        'Parcial': 'user-clock',
                        'Vacacionista': 'umbrella-beach'
                    };
                    
                    modalContent += `
                        <div class="personal-section">
                            <h3 class="section-title">
                                <i class="fas fa-${iconMap[tipo]}"></i>
                                Personal ${tipo} (${personalPorTipo[tipo].length})
                            </h3>
                            <div class="personal-grid">
                    `;
                    
                    personalPorTipo[tipo].forEach(persona => {
                        const fotoSrc = persona.FotoBase64 || '../Imagenes/user-default.png';
                        const fechaIngreso = persona.InicioLaboral ? new Date(persona.InicioLaboral).toLocaleDateString('es-GT') : 'No registrada';
                        
                        modalContent += `
                            <div class="personal-card">
                                <div class="personal-avatar">
                                    <img src="${fotoSrc}" alt="${persona.NombreCompleto}" />
                                    <div class="personal-type-badge ${tipo.toLowerCase()}">
                                        <i class="fas fa-${iconMap[tipo]}"></i>
                                    </div>
                                </div>
                                <div class="personal-info">
                                    <h4 class="personal-name">${persona.NombreCompleto}</h4>
                                    <p class="personal-puesto">${persona.NombrePuesto}</p>
                                    <div class="personal-details">
                                        <div class="detail-item">
                                            <i class="fas fa-id-card"></i>
                                            <span>${persona.DPI}</span>
                                        </div>
                                        <div class="detail-item">
                                            <i class="fas fa-calendar-alt"></i>
                                            <span>${fechaIngreso}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    
                    modalContent += '</div></div>';
                }
            });
            
            modalContent += '</div>';
        }
        
        modalContent += '</div>';
        
        // Mostrar el modal
        Swal.fire({
            title: '',
            html: modalContent,
            width: '900px',
            showConfirmButton: true,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#FF9800',
            customClass: {
                container: 'personal-modal-container'
            }
        });
        
    } catch (error) {
        console.error('Error al mostrar personal:', error);
        mostrarNotificacion('Error al cargar personal de la tienda', 'error');
    }
}

// Función auxiliar para cerrar detalles y abrir personal
function cerrarDetalleYAbrirPersonal(tiendaId) {
    Swal.close();
    setTimeout(() => {
        mostrarPersonalTienda(tiendaId);
    }, 300);
}

// Función para animar la barra circular
function animarBarraCircular() {
    const circularProgress = document.querySelector('.circular-progress');
    if (circularProgress) {
        const percentage = circularProgress.getAttribute('data-percentage');
        const circumference = 2 * Math.PI * 45; // radio de 45px
        
        // Crear el elemento SVG
        const svg = `
            <svg class="progress-ring" width="100" height="100">
                <circle class="progress-ring-background" cx="50" cy="50" r="45" />
                <circle class="progress-ring-progress" cx="50" cy="50" r="45" 
                        style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${circumference - (percentage / 100) * circumference};" />
            </svg>
        `;
        
        circularProgress.innerHTML = svg + circularProgress.innerHTML;
    }
}
// Función para agregar estilos específicos para Gerentes Regionales (ACTUALIZADA CON MODALES)
function agregarEstilosGerenteRegional() {
    const style = document.createElement('style');
    style.textContent = `
        .gerente-regional-badge {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 0.7rem;
            font-weight: 500;
            margin-left: 10px;
            display: inline-block;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            animation: managerBadgeGlow 3s infinite alternate;
        }
        
        @keyframes managerBadgeGlow {
            0% { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            100% { box-shadow: 0 4px 8px rgba(231, 76, 60, 0.3); }
        }
        
        .tienda-card {
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            border-left: 4px solid transparent;
        }
        
        .tienda-card.resumen-general {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-left: 4px solid #fff;
        }
        
        .tienda-card.resumen-general .stat-value,
        .tienda-card.resumen-general .stat-label {
            color: white !important;
        }
        
        .tienda-header {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .tienda-icon {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-size: 1.5rem;
            transition: transform 0.3s ease;
        }
        
        .tienda-icon.completo {
            background: rgba(76, 175, 80, 0.1);
            color: #4CAF50;
        }
        
        .tienda-icon.deficit {
            background: rgba(255, 82, 82, 0.1);
            color: #FF5252;
        }
        
        .tienda-icon.excedente {
            background: rgba(255, 193, 7, 0.1);
            color: #FFC107;
        }
        
        .tienda-icon.resumen {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        
        .tienda-info h3 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .tienda-card.resumen-general .tienda-info h3 {
            color: white;
        }
        
        .tienda-region {
            margin: 2px 0 0 0;
            color: #7f8c8d;
            font-size: 0.85rem;
        }
        
        .tienda-card.resumen-general .tienda-region {
            color: rgba(255, 255, 255, 0.8);
        }
        
        .status-badge {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 500;
            margin-left: auto;
        }
        
        .status-badge.completo {
            background: rgba(76, 175, 80, 0.1);
            color: #4CAF50;
        }
        
        .status-badge.deficit {
            background: rgba(255, 82, 82, 0.1);
            color: #FF5252;
        }
        
        .status-badge.excedente {
            background: rgba(255, 193, 7, 0.1);
            color: #FFC107;
        }
        
        .status-badge.total {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        
        .tienda-ocupacion {
            margin-bottom: 15px;
        }
        
        .ocupacion-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 0.9rem;
            font-weight: 500;
        }
        
        .ocupacion-bar {
            height: 8px;
            background: rgba(0,0,0,0.1);
            border-radius: 4px;
            overflow: hidden;
        }
        
        .ocupacion-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s ease;
        }
        
        .ocupacion-fill.completo {
            background: linear-gradient(90deg, #4CAF50, #66BB6A);
        }
        
        .ocupacion-fill.deficit {
            background: linear-gradient(90deg, #FF5252, #FF7043);
        }
        
        .ocupacion-fill.excedente {
            background: linear-gradient(90deg, #FFC107, #FFD54F);
        }
        
        .tienda-stats {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .stat-item {
            display: flex;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        
        .stat-item:last-child {
            border-bottom: none;
        }
        
        .stat-item i {
            width: 20px;
            margin-right: 10px;
            color: #7f8c8d;
        }
        
        .stat-label {
            flex: 1;
            font-size: 0.9rem;
            color: #5a6c7d;
        }
        
        .stat-value {
            font-weight: 600;
            color: #2c3e50;
            margin-right: 8px;
        }
        
        .stat-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        
        .stat-indicator.completo {
            background: #4CAF50;
        }
        
        .stat-indicator.deficit {
            background: #FF5252;
        }
        
        .stat-indicator.excedente {
            background: #FFC107;
        }
        
        .stat-indicator.sin-datos {
            background: #9E9E9E;
        }
        
        .tienda-status-summary {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid rgba(255,255,255,0.2);
        }
        
        .status-item {
            display: flex;
            align-items: center;
            font-size: 0.85rem;
            color: rgba(255, 255, 255, 0.9);
        }
        
        .status-item i {
            margin-right: 5px;
        }
        
        .tienda-actions {
            display: flex;
            gap: 8px;
        }
        
        .btn-tienda-detalle,
        .btn-tienda-personal {
            flex: 1;
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }
        
        .btn-tienda-detalle {
            background: #3498db;
            color: white;
        }
        
        .btn-tienda-detalle:hover {
            background: #2980b9;
            transform: translateY(-1px);
        }
        
        .btn-tienda-personal {
            background: #2ecc71;
            color: white;
        }
        
        .btn-tienda-personal:hover {
            background: #27ae60;
            transform: translateY(-1px);
        }
        
        /* ESTILOS PARA MODALES DE TIENDAS */
        .detalle-tienda-container {
            text-align: left;
            max-width: 100%;
        }
        
        .detalle-header {
            display: flex;
            align-items: center;
            margin-bottom: 25px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            color: white;
        }
        
        .detalle-tienda-icon {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 20px;
            font-size: 2rem;
            background: rgba(255, 255, 255, 0.2);
        }
        
        .detalle-info h2 {
            margin: 0 0 5px 0;
            font-size: 1.5rem;
        }
        
        .detalle-region {
            margin: 0 0 10px 0;
            opacity: 0.9;
        }
        
        .detalle-status-badge {
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 500;
            background: rgba(255, 255, 255, 0.2);
        }
        
        .detalle-ocupacion-section {
            margin-bottom: 25px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        
        .detalle-ocupacion-section h3 {
            margin: 0 0 15px 0;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .detalle-ocupacion-visual {
            display: flex;
            align-items: center;
            gap: 30px;
        }
        
        .ocupacion-circular {
            position: relative;
            width: 100px;
            height: 100px;
        }
        
        .circular-progress {
            position: relative;
            width: 100px;
            height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .progress-ring {
            transform: rotate(-90deg);
        }
        
        .progress-ring-background {
            fill: none;
            stroke: #e9ecef;
            stroke-width: 8;
        }
        
        .progress-ring-progress {
            fill: none;
            stroke: #4CAF50;
            stroke-width: 8;
            stroke-linecap: round;
            transition: stroke-dashoffset 1s ease-in-out;
        }
        
        .percentage {
            position: absolute;
            font-size: 1.2rem;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .ocupacion-info-detalle {
            flex: 1;
        }
        
        .info-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
        }
        
        .info-item:last-child {
            border-bottom: none;
        }
        
        .info-item .label {
            font-weight: 500;
            color: #6c757d;
        }
        
        .info-item .value {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .info-item .value.completo {
            color: #4CAF50;
        }
        
        .info-item .value.deficit {
            color: #FF5252;
        }
        
        .info-item .value.excedente {
            color: #FFC107;
        }
        
        .detalle-distribucion {
            margin-bottom: 25px;
        }
        
        .detalle-distribucion h3 {
            margin: 0 0 15px 0;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .distribucion-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .distribucion-item {
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid;
        }
        
        .distribucion-item.fijos {
            background: rgba(76, 175, 80, 0.05);
            border-left-color: #4CAF50;
        }
        
        .distribucion-item.parciales {
            background: rgba(52, 152, 219, 0.05);
            border-left-color: #3498db;
        }
        
        .distribucion-item.vacacionistas {
            background: rgba(255, 193, 7, 0.05);
            border-left-color: #FFC107;
        }
        
        .dist-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
            font-size: 1.2rem;
        }
        
        .distribucion-item.fijos .dist-icon {
            background: rgba(76, 175, 80, 0.1);
            color: #4CAF50;
        }
        
        .distribucion-item.parciales .dist-icon {
            background: rgba(52, 152, 219, 0.1);
            color: #3498db;
        }
        
        .distribucion-item.vacacionistas .dist-icon {
            background: rgba(255, 193, 7, 0.1);
            color: #FFC107;
        }
        
        .dist-info h4 {
            margin: 0 0 8px 0;
            font-size: 1rem;
            color: #2c3e50;
        }
        
        .dist-numbers {
            margin-bottom: 8px;
            font-size: 1.1rem;
        }
        
        .dist-numbers .actual {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .dist-numbers .separator {
            margin: 0 5px;
            color: #6c757d;
        }
        
        .dist-numbers .objetivo {
            color: #6c757d;
        }
        
        .dist-bar {
            height: 6px;
            background: rgba(0,0,0,0.1);
            border-radius: 3px;
            overflow: hidden;
        }
        
        .dist-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 1s ease-out;
        }
        
        .dist-fill.completo {
            background: #4CAF50;
        }
        
        .dist-fill.deficit {
            background: #FF5252;
        }
        
        .dist-fill.excedente {
            background: #FFC107;
        }
        
        .detalle-acciones {
            text-align: center;
        }
        
        .btn-detalle-accion {
            padding: 12px 25px;
            border: none;
            border-radius: 25px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn-detalle-accion:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        /* ESTILOS PARA MODAL DE PERSONAL */
        .personal-tienda-container {
            text-align: left;
            max-width: 100%;
        }
        
        .personal-header {
            margin-bottom: 25px;
            padding: 20px;
            background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
            border-radius: 10px;
            color: white;
        }
        
        .personal-tienda-info h2 {
            margin: 0 0 5px 0;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .personal-region {
            margin: 0 0 15px 0;
            opacity: 0.9;
        }
        
        .personal-stats {
            display: flex;
            gap: 10px;
        }
        
        .stat-badge {
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 500;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .personal-empty {
            text-align: center;
            padding: 40px 20px;
            color: #6c757d;
        }
        
        .personal-empty i {
            margin-bottom: 15px;
            opacity: 0.5;
        }
        
        .personal-empty h3 {
            margin: 0 0 10px 0;
            color: #2c3e50;
        }
        
        .personal-sections {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .personal-section {
            margin-bottom: 25px;
        }
        
        .section-title {
            margin: 0 0 15px 0;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 8px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e9ecef;
        }
        
        .personal-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 15px;
        }
        
        .personal-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 10px;
            padding: 15px;
            transition: all 0.3s ease;
            position: relative;
        }
        
        .personal-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .personal-avatar {
            position: relative;
            width: 60px;
            height: 60px;
            margin-bottom: 12px;
        }
        
        .personal-avatar img {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #e9ecef;
        }
        
        .personal-type-badge {
            position: absolute;
            bottom: -5px;
            right: -5px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            border: 2px solid white;
        }
        
        .personal-type-badge.fijo {
            background: #4CAF50;
            color: white;
        }
        
        .personal-type-badge.parcial {
            background: #3498db;
            color: white;
        }
        
        .personal-type-badge.vacacionista {
            background: #FFC107;
            color: white;
        }
        
        .personal-name {
            margin: 0 0 5px 0;
            font-size: 1rem;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .personal-puesto {
            margin: 0 0 12px 0;
            color: #6c757d;
            font-size: 0.9rem;
        }
        
        .personal-details {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .detail-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.8rem;
            color: #6c757d;
        }
        
        .detail-item i {
            width: 14px;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .tienda-stats {
                grid-template-columns: 1fr;
            }
            
            .tienda-actions {
                flex-direction: column;
            }
            
            .detalle-ocupacion-visual {
                flex-direction: column;
                gap: 20px;
            }
            
            .distribucion-grid {
                grid-template-columns: 1fr;
            }
            
            .personal-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
    document.head.appendChild(style);
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

// Función para determinar el rol basado en el ID del puesto (ACTUALIZADA)
async function determinarRol(idPuesto) {
    if (idPuesto == 5) {
        return 'Administrador RRHH';
    } else if (idPuesto == 1) {
        return 'Gerente';
    } else if (idPuesto == 140) {
        try {
            const nombrePuesto = await obtenerNombrePuesto(userData.IdPuesto);
            return nombrePuesto;
        } catch (error) {
            return 'Colaborador Especializado';
        }
    } else if (esGerenteRegional(idPuesto)) {
        try {
            const nombrePuesto = await obtenerNombrePuesto(userData.IdPuesto);
            return nombrePuesto;
        } catch (error) {
            return 'Gerente Regional';
        }
    } else {
        try {
            const nombrePuesto = await obtenerNombrePuesto(userData.IdPuesto);
            return nombrePuesto;
        } catch (error) {
            return 'Colaborador';
        }
    }
}

// Funciones para cargar datos estadísticos (SOLO PARA NO-GERENTES REGIONALES)
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

// Cargar regiones (SOLO PARA NO-GERENTES REGIONALES)
async function cargarRegiones() {
    try {
        const regionGrid = document.getElementById('regionGrid');
        if (!regionGrid) return; // Si no existe el elemento, no hacer nada
        
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
                const currentRegionName = document.getElementById('currentRegionName');
                const currentRegionNameEstado = document.getElementById('currentRegionNameEstado');
                if (currentRegionName) currentRegionName.textContent = region.NombreRegion;
                if (currentRegionNameEstado) currentRegionNameEstado.textContent = region.NombreRegion;
                
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

// Función para inicializar la búsqueda de regiones (SOLO PARA NO-GERENTES REGIONALES)
function inicializarBusquedaRegiones() {
    const searchInput = document.getElementById('regionSearch');
    const clearSearchBtn = document.getElementById('clearRegionSearch');
    
    if (!searchInput || !clearSearchBtn) return; // Si no existen los elementos, no hacer nada
    
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
if (closeDetailModalBtn) {
    closeDetailModalBtn.addEventListener('click', () => {
        departmentDetailModal.classList.remove('show');
    });
}

if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
        departmentDetailModal.classList.remove('show');
    });
}

// Click fuera del modal para cerrarlo
if (departmentDetailModal) {
    departmentDetailModal.addEventListener('click', (e) => {
        if (e.target === departmentDetailModal) {
            departmentDetailModal.classList.remove('show');
        }
    });
}

// Click fuera del modal para cerrarlo (Logout)
logoutModal.addEventListener('click', (e) => {
    if (e.target === logoutModal) {
        logoutModal.classList.remove('show');
    }
});

// Navegación entre páginas
personalNuevoBtn.addEventListener('click', () => {
    mostrarNotificacion('Abriendo formulario de nuevo personal...', 'info');
    ipcRenderer.send('open_personal_nuevo');
});

BusquetaPBtn.addEventListener('click',()=>{
    ipcRenderer.send('open_personal_busqueda');
});

// TODOS LOS EVENT LISTENERS DE PERMISOS
planillaEspecialBtn.addEventListener('click', async () => {
    try {
        mostrarNotificacion('Verificando permisos...', 'info');
        const idPersonal = userData.IdPersonal;
        const connection = await getConnection();
        const permisosQuery = `SELECT COUNT(*) AS tienePermiso FROM TransaccionesRRHH WHERE IdPersonal = ${idPersonal} AND Codigo = 104`;
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        if (resultado[0].tienePermiso > 0) {
            mostrarNotificacion('Abriendo Planilla Especial...', 'success');
            ipcRenderer.send('open_planilla_dominical');
        } else {
            Swal.fire({icon: 'error', title: 'Acceso denegado', text: 'No tienes permisos para acceder a esta funcionalidad.'});
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});

actualizarDepartamentoBtn.addEventListener('click', async () => {
    try {
        mostrarNotificacion('Verificando permisos...', 'info');
        const idPersonal = userData.IdPersonal;
        const connection = await getConnection();
        const permisosQuery = `SELECT COUNT(*) AS tienePermiso FROM TransaccionesRRHH WHERE IdPersonal = ${idPersonal} AND Codigo = 105`;
        const resultado = await connection.query(permisosQuery);
        await connection.close();
        
        if (resultado[0].tienePermiso > 0) {
            mostrarNotificacion('Abriendo Actualizar Departamento...', 'success');
            ipcRenderer.send('open_actualizar_departamento');
        } else {
            Swal.fire({icon: 'error', title: 'Acceso denegado', text: 'No tienes permisos para acceder a esta funcionalidad.'});
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
    }
});

pagoNominaBtn.addEventListener('click', async () => {
    try {
        mostrarNotificacion('Verificando permisos...', 'info');
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData || !userData.IdPersonal) {
            throw new Error('Datos de usuario no disponibles');
        }
        
        const connection = await getConnection();
        const permisosQuery = `SELECT COUNT(*) AS tienePermiso FROM TransaccionesRRHH WHERE IdPersonal = ? AND Codigo = 106`;
        const resultado = await connection.query(permisosQuery, [userData.IdPersonal]);
        await connection.close();
        
        if (resultado[0].tienePermiso > 0) {
            mostrarNotificacion('Abriendo Pago Nómina...', 'success');
            ipcRenderer.send('open_pago_nomina');
        } else {
            Swal.fire({icon: 'error', title: 'Acceso denegado', text: 'No tienes permisos para acceder a Pago Nómina.', confirmButtonColor: '#FF9800'});
        }
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos', 'error');
        Swal.fire({icon: 'error', title: 'Error de verificación', text: 'No se pudieron verificar los permisos. Por favor, intente nuevamente.', confirmButtonColor: '#FF9800'});
    }
});

// Continuar con todos los demás event listeners de permisos...
[registroEmbargoBtn, SuspensionesBtn, DescJudiciales, ReportePlanillaEspecial, AsignacionPermisos, 
 Vacaciones, PagoVacaciones, GestionarVacaciones, GestionarPagoVacaciones, GestionProcesoPagoVacaciones, PagoBonificaciones].forEach((btn, index) => {
    const codigos = [107, 108, 109, 110, 112, 113, 114, 115, 116, 117, 118];
    const nombres = ['Embargo Salarial', 'Reporte Suspensiones', 'Descuentos Judiciales', 'Reporte Planilla Especial', 
                    'Gestión de Usuarios', 'Vacaciones', 'Pago Vacaciones', 'Gestión Vacaciones', 'Gestión Pago Vacaciones', 
                    'Gestión Procesos Pagos', 'Pagos Bonificaciones'];
    const ipcCommands = ['open_embargo_Salarial', 'open_Reporte_Suspensiones', 'open_Reporte_DescuentosJudiciales', 
                        'open_Reporte_PlanillaEspecial', 'open_Ventana_Permisos', 'open_Ventana_Vacaciones', 
                        'open_Ventana_PagoVacaciones', 'open_Ventana_GestionVacaciones', 'open_Ventana_GestionPagoVacaciones', 
                        'open_Ventana_GestionPagosVacaciones', 'open_Ventana_Pagosbonis'];
    
    if (btn) {
        btn.addEventListener('click', async () => {
            try {
                mostrarNotificacion('Verificando permisos...', 'info');
                const idPersonal = userData.IdPersonal;
                const connection = await getConnection();
                const permisosQuery = `SELECT COUNT(*) AS tienePermiso FROM TransaccionesRRHH WHERE IdPersonal = ${idPersonal} AND Codigo = ${codigos[index]}`;
                const resultado = await connection.query(permisosQuery);
                await connection.close();
                
                if (resultado[0].tienePermiso > 0) {
                    mostrarNotificacion(`Abriendo ${nombres[index]}...`, 'success');
                    ipcRenderer.send(ipcCommands[index]);
                } else {
                    Swal.fire({icon: 'error', title: 'Acceso denegado', text: 'No tienes permisos para acceder a esta funcionalidad.'});
                }
            } catch (error) {
                console.error('Error al verificar permisos:', error);
                mostrarNotificacion('Error al verificar permisos', 'error');
            }
        });
    }
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

// Cargar notificaciones del sistema
async function cargarNotificaciones() {
    try {
        const connection = await getConnection();
        
        // 1. Colaboradores con Tarjeta de Manipulación vencida
        const tmVencidas = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND TipoPersonal = 1
            AND FechaVencimientoTM IS NOT NULL 
            AND FechaVencimientoTM < CURDATE()
        `);
        
        // 2. Colaboradores con Tarjeta de Salud vencida
        const tsVencidas = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND TipoPersonal = 1
            AND FechaVencimientoTS IS NOT NULL 
            AND FechaVencimientoTS < CURDATE()
        `);
        
        // 3. Colaboradores sin Tarjeta de Manipulación
        const sinTM = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND TipoPersonal = 1
            AND FechaVencimientoTM IS NULL
        `);
        
        // 4. Colaboradores sin Tarjeta de Salud
        const sinTS = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND TipoPersonal = 1
            AND FechaVencimientoTS IS NULL
        `);
        
        // 5. Colaboradores sin contrato
        const sinContrato = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND TipoPersonal = 1
            AND Contrato = 0
        `);
        
        // 6. Colaboradores fuera de planilla
        const fueraPlanilla = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND TipoPersonal = 1
            AND IdPlanilla = 0
        `);
        
        // 7. Colaboradores sin número de IGSS
        const sinIGSS = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND IGSS = 0
        `);
        
        // 8. Colaboradores sin número de IRTRA
        const sinIRTRA = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM personal 
            WHERE Estado = 1 AND IRTRA = 0
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
    if (!badge) return;
    
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
    if (!container) return;
    
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

// Inicializar la página (ACTUALIZADO FINAL)
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar información del usuario (ahora es async)
    await cargarInfoUsuario();
    
    // Solo cargar estadísticas si NO es Gerente Regional
    // (porque los Gerentes Regionales tienen su propio dashboard de tiendas)
    if (!esGerenteRegional(userData.Id_Puesto)) {
        cargarEstadisticas();
    }
    
    // Inicializar efectos visuales
    inicializarEfectosVisuales();
    
    // Mostrar notificación de bienvenida después de un breve retraso
    setTimeout(() => {
        mostrarNotificacion('¡Bienvenido al Sistema de Recursos Humanos!', 'success');
    }, 1000);
    
    // Inicializar sistema de notificaciones
    const notificationsIcon = document.getElementById('notificationsIcon');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    const refreshNotificationsBtn = document.getElementById('refreshNotifications');
    const markAllAsReadBtn = document.getElementById('markAllAsRead');
    
    // Mostrar/ocultar dropdown al hacer clic en el icono
    if (notificationsIcon) {
        notificationsIcon.addEventListener('click', () => {
            notificationsDropdown.classList.toggle('show');
        });
    }
    
    // Cerrar dropdown al hacer clic fuera de él
    document.addEventListener('click', (e) => {
        if (notificationsIcon && !notificationsIcon.contains(e.target) && !notificationsDropdown.contains(e.target)) {
            notificationsDropdown.classList.remove('show');
        }
    });
    
    // Refrescar notificaciones
    if (refreshNotificationsBtn) {
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
    }
    
    // Marcar todas como leídas
    if (markAllAsReadBtn) {
        markAllAsReadBtn.addEventListener('click', () => {
            const notificationItems = document.querySelectorAll('.notification-item');
            
            // Añadir clase de desvanecimiento
            notificationItems.forEach(item => {
                item.classList.add('read');
            });
            
            // Actualizar badge
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                badge.textContent = '0';
                badge.classList.remove('active');
            }
            
            // Mostrar mensaje
            setTimeout(() => {
                const body = document.getElementById('notificationsBody');
                if (body) {
                    body.innerHTML = `
                        <div class="empty-notifications">
                            <i class="fas fa-check-circle"></i>
                            <p>No hay notificaciones pendientes</p>
                        </div>
                    `;
                }
                
                mostrarNotificacion('Todas las notificaciones han sido marcadas como leídas', 'success');
            }, 300);
        });
    }
    
    // Event listeners para botones de refrescar (SOLO SI EXISTEN)
    const refreshRegionesBtn = document.getElementById('refreshRegionesBtn');
    if (refreshRegionesBtn) {
        refreshRegionesBtn.addEventListener('click', () => {
            refreshRegionesBtn.querySelector('i').classList.add('fa-spin');
            
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
                refreshRegionesBtn.querySelector('i').classList.remove('fa-spin');
                mostrarNotificacion('Regiones actualizadas correctamente', 'success');
            });
        });
    }
    
    // Cargar notificaciones iniciales
    cargarNotificaciones();
});