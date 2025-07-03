const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const Swal = require('sweetalert2');

// Variables globales
let departamentos = [];
let regiones = [];
let datosAnalisis = [];
let chartsInstances = {};
let tablaTendencias = null;
let filtrosActivos = {};

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    inicializarApp();
});

/**
 * Inicializar la aplicación
 */
async function inicializarApp() {
    try {
        mostrarInfoUsuario();
        await cargarDatosIniciales();
        configurarEventListeners();
        configurarFechasIniciales();
        
        console.log('Dashboard de análisis inicializado correctamente');
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        mostrarError('Error al cargar la aplicación', 'No se pudo inicializar correctamente el dashboard.');
    }
}

/**
 * Mostrar información del usuario logueado
 */
function mostrarInfoUsuario() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData) {
            const userInfoContainer = document.getElementById('userInfo');
            const userImage = userData.FotoBase64 || '../Imagenes/user-default.png';
            
            userInfoContainer.innerHTML = `
                <img src="${userImage}" alt="Usuario" class="user-avatar">
                <div class="user-details">
                    <h4>${userData.NombreCompleto}</h4>
                    <p>${userData.NombreDepartamento}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error al mostrar información del usuario:', error);
    }
}

/**
 * Cargar datos iniciales (departamentos y regiones)
 */
async function cargarDatosIniciales() {
    try {
        mostrarCarga(true);
        
        const connection = await connectionString();
        
        // Cargar departamentos con regiones
        const deptos = await connection.query(`
            SELECT
                d.IdDepartamento, 
                d.NombreDepartamento, 
                r.IdRegion,
                r.NombreRegion
            FROM
                departamentos d
                INNER JOIN Regiones r ON d.IdRegion = r.IdRegion
            ORDER BY r.NombreRegion, d.NombreDepartamento
        `);
        
        await connection.close();
        
        departamentos = deptos;
        
        // Extraer regiones únicas
        regiones = [...new Set(deptos.map(d => ({ IdRegion: d.IdRegion, NombreRegion: d.NombreRegion })))];
        
        llenarSelectores();
        
    } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        mostrarError('Error de conexión', 'No se pudieron cargar los datos iniciales.');
    } finally {
        mostrarCarga(false);
    }
}

/**
 * Llenar selectores de filtros
 */
function llenarSelectores() {
    // Llenar selector de departamentos
    const selectDepartamento = document.getElementById('filtrodepartamento');
    selectDepartamento.innerHTML = '<option value="">Todos los departamentos</option>';
    
    let currentRegion = '';
    departamentos.forEach(depto => {
        if (depto.NombreRegion !== currentRegion) {
            if (currentRegion !== '') {
                selectDepartamento.innerHTML += '</optgroup>';
            }
            selectDepartamento.innerHTML += `<optgroup label="${depto.NombreRegion}">`;
            currentRegion = depto.NombreRegion;
        }
        selectDepartamento.innerHTML += `<option value="${depto.IdDepartamento}">${depto.NombreDepartamento}</option>`;
    });
    
    if (currentRegion !== '') {
        selectDepartamento.innerHTML += '</optgroup>';
    }
    
    // Llenar selector de regiones
    const selectRegion = document.getElementById('filtroregion');
    selectRegion.innerHTML = '<option value="">Todas las regiones</option>';
    regiones.forEach(region => {
        selectRegion.innerHTML += `<option value="${region.IdRegion}">${region.NombreRegion}</option>`;
    });
}

/**
 * Configurar fechas iniciales (últimos 6 meses por defecto)
 */
function configurarFechasIniciales() {
    const hoy = new Date();
    const hace6Meses = new Date();
    hace6Meses.setMonth(hoy.getMonth() - 6);
    
    document.getElementById('fechaHasta').value = formatearFechaInput(hoy);
    document.getElementById('fechaDesde').value = formatearFechaInput(hace6Meses);
    
    // Marcar botón de 6 meses como activo
    document.querySelector('[data-period="6"]').classList.add('active');
}

/**
 * Configurar event listeners
 */
function configurarEventListeners() {
    // Botones de fechas rápidas
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const meses = parseInt(this.dataset.period);
            establecerRangoFechas(meses);
            
            // Actualizar botón activo
            document.querySelectorAll('.quick-date-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Botón de análisis
    document.getElementById('btnAnalizar').addEventListener('click', generarAnalisis);
    
    // Botones de exportación
    document.getElementById('exportTendencias').addEventListener('click', () => exportarDatos('tendencias'));
    document.getElementById('exportEvolucion').addEventListener('click', () => exportarGrafico('evolucion'));
    document.getElementById('exportActualizaciones').addEventListener('click', () => exportarGrafico('actualizaciones'));
    document.getElementById('exportDistribucion').addEventListener('click', () => exportarGrafico('distribucion'));
    document.getElementById('exportHeatmap').addEventListener('click', () => exportarGrafico('heatmap'));
}

/**
 * Establecer rango de fechas
 */
function establecerRangoFechas(meses) {
    const hoy = new Date();
    const fechaInicio = new Date();
    fechaInicio.setMonth(hoy.getMonth() - meses);
    
    document.getElementById('fechaHasta').value = formatearFechaInput(hoy);
    document.getElementById('fechaDesde').value = formatearFechaInput(fechaInicio);
}

/**
 * Formatear fecha para input type="date"
 */
function formatearFechaInput(fecha) {
    return fecha.toISOString().split('T')[0];
}

/**
 * Generar análisis principal
 */
async function generarAnalisis() {
    try {
        // Validar fechas
        const fechaDesde = document.getElementById('fechaDesde').value;
        const fechaHasta = document.getElementById('fechaHasta').value;
        
        if (!fechaDesde || !fechaHasta) {
            mostrarError('Fechas requeridas', 'Debe seleccionar un rango de fechas válido.');
            return;
        }
        
        if (new Date(fechaDesde) >= new Date(fechaHasta)) {
            mostrarError('Rango inválido', 'La fecha de inicio debe ser anterior a la fecha final.');
            return;
        }
        
        mostrarCarga(true);
        
        // Obtener filtros activos
        filtrosActivos = obtenerFiltrosActivos();
        
        // Cargar datos de análisis
        await cargarDatosAnalisis();
        
        // Generar todas las visualizaciones
        await generarKPIs();
        await generarGraficos();
        await generarTablaTendencias();
        await generarRankings();
        
        // Mostrar secciones
        mostrarSecciones();
        
        // Actualizar info del período
        actualizarInfoPeriodo();
        
        mostrarMensaje('Análisis generado', 'El análisis temporal se ha generado exitosamente.', 'success');
        
    } catch (error) {
        console.error('Error al generar análisis:', error);
        mostrarError('Error en el análisis', 'No se pudo generar el análisis. Inténtalo nuevamente.');
    } finally {
        mostrarCarga(false);
    }
}

/**
 * Obtener filtros activos
 */
function obtenerFiltrosActivos() {
    return {
        fechaDesde: document.getElementById('fechaDesde').value,
        fechaHasta: document.getElementById('fechaHasta').value,
        departamento: document.getElementById('filtrodepartamento').value,
        region: document.getElementById('filtroregion').value,
        documentos: Array.from(document.querySelectorAll('.doc-filter-item input:checked')).map(cb => cb.value)
    };
}

/**
 * Cargar datos de análisis desde la base de datos
 */
async function cargarDatosAnalisis() {
    try {
        const connection = await connectionString();
        
        // Query base para obtener datos de personal
        let query = `
            SELECT 
                p.IdPersonal,
                p.PrimerNombre, p.SegundoNombre, p.TercerNombre,
                p.PrimerApellido, p.SegundoApellido,
                p.IGSS, p.IRTRA, p.Contrato, p.NIT,
                p.FechaVencimientoTS, p.FechaVencimientoTM, p.FechaContrato,
                d.IdDepartamento, d.NombreDepartamento,
                r.IdRegion, r.NombreRegion,
                DATE_FORMAT(p.FechaContrato, '%Y-%m') as MesContrato
            FROM personal p
            INNER JOIN departamentos d ON p.IdSucuDepa = d.IdDepartamento
            INNER JOIN Regiones r ON d.IdRegion = r.IdRegion
            WHERE p.TipoPersonal = 1 AND p.Estado = 1
        `;
        
        const parametros = [];
        
        // Aplicar filtros
        if (filtrosActivos.departamento) {
            query += ' AND d.IdDepartamento = ?';
            parametros.push(filtrosActivos.departamento);
        }
        
        if (filtrosActivos.region) {
            query += ' AND r.IdRegion = ?';
            parametros.push(filtrosActivos.region);
        }
        
        query += ' ORDER BY r.NombreRegion, d.NombreDepartamento, p.PrimerApellido';
        
        const empleados = await connection.query(query, parametros);
        
        // Obtener datos de cambios en el período seleccionado
        const cambiosQuery = `
            SELECT 
                cp.IdPersonal, cp.NombrePersonal, cp.Cambio,
                cp.ValorAnterior, cp.ValorNuevo, cp.NombreUsuario,
                DATE(cp.FechaCambio) as FechaCambio,
                DATE_FORMAT(cp.FechaCambio, '%Y-%m') as MesCambio,
                d.IdDepartamento, d.NombreDepartamento
            FROM CambiosPersonal cp
            INNER JOIN personal p ON cp.IdPersonal = p.IdPersonal
            INNER JOIN departamentos d ON p.IdSucuDepa = d.IdDepartamento
            WHERE cp.TipoCambio = 4 
            AND DATE(cp.FechaCambio) BETWEEN ? AND ?
            ORDER BY cp.FechaCambio DESC
        `;
        
        const cambios = await connection.query(cambiosQuery, [filtrosActivos.fechaDesde, filtrosActivos.fechaHasta]);
        
        await connection.close();
        
        // Procesar datos
        datosAnalisis = {
            empleados: empleados.map(emp => procesarEmpleadoAnalisis(emp)),
            cambios: cambios,
            fechaDesde: filtrosActivos.fechaDesde,
            fechaHasta: filtrosActivos.fechaHasta
        };
        
        console.log('Datos de análisis cargados:', datosAnalisis);
        
    } catch (error) {
        console.error('Error al cargar datos de análisis:', error);
        throw error;
    }
}

/**
 * Procesar empleado para análisis
 */
function procesarEmpleadoAnalisis(empleado) {
    const hoy = new Date();
    const fechaLimite = new Date(hoy.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    const nombreCompleto = `${empleado.PrimerApellido || ''} ${empleado.SegundoApellido || ''} ${empleado.PrimerNombre || ''} ${empleado.SegundoNombre || ''} ${empleado.TercerNombre || ''}`.trim().replace(/\s+/g, ' ');
    
    // Evaluar estados de documentos
    const estados = {
        igss: (empleado.IGSS && empleado.IGSS !== 0) ? 'completo' : 'faltante',
        irtra: (empleado.IRTRA && empleado.IRTRA !== 0) ? 'completo' : 'faltante',
        contrato: (empleado.Contrato && empleado.Contrato !== 0) ? 'completo' : 'faltante',
        nit: (empleado.NIT && empleado.NIT.toString().trim() !== '') ? 'completo' : 'faltante',
        tarjetaSalud: evaluarFechaVencimiento(empleado.FechaVencimientoTS, hoy, fechaLimite),
        tarjetaManipulacion: evaluarFechaVencimiento(empleado.FechaVencimientoTM, hoy, fechaLimite)
    };
    
    // Calcular completitud
    const totalDocumentos = filtrosActivos.documentos.length || 6;
    const documentosCompletos = Object.values(estados).filter(estado => estado === 'completo').length;
    const porcentajeCompletitud = Math.round((documentosCompletos / totalDocumentos) * 100);
    
    // Estado general
    const faltantes = Object.values(estados).filter(estado => estado === 'faltante').length;
    const vencidos = Object.values(estados).filter(estado => estado === 'vencido').length;
    
    let estadoGeneral = 'completo';
    if (faltantes > 0 || vencidos > 0) {
        estadoGeneral = 'critico';
    } else if (Object.values(estados).some(estado => estado === 'proximo')) {
        estadoGeneral = 'advertencia';
    }
    
    return {
        ...empleado,
        NombreCompleto: nombreCompleto,
        Estados: estados,
        EstadoGeneral: estadoGeneral,
        PorcentajeCompletitud: porcentajeCompletitud,
        DocumentosCompletos: documentosCompletos,
        Faltantes: faltantes,
        Vencidos: vencidos
    };
}

/**
 * Evaluar estado de fecha de vencimiento
 */
function evaluarFechaVencimiento(fecha, hoy, fechaLimite) {
    if (!fecha) return 'faltante';
    
    const fechaVenc = new Date(fecha + 'T00:00:00');
    const fechaVencSoloFecha = new Date(fechaVenc.getFullYear(), fechaVenc.getMonth(), fechaVenc.getDate());
    const hoySoloFecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fechaLimiteSoloFecha = new Date(fechaLimite.getFullYear(), fechaLimite.getMonth(), fechaLimite.getDate());
    
    if (fechaVencSoloFecha < hoySoloFecha) return 'vencido';
    if (fechaVencSoloFecha <= fechaLimiteSoloFecha) return 'proximo';
    return 'completo';
}

/**
 * Generar KPIs principales
 */
async function generarKPIs() {
    const empleados = datosAnalisis.empleados;
    const cambios = datosAnalisis.cambios;
    
    // Calcular KPIs actuales
    const totalEmpleados = empleados.length;
    const completitudPromedio = Math.round(empleados.reduce((sum, emp) => sum + emp.PorcentajeCompletitud, 0) / totalEmpleados);
    const documentosActualizados = cambios.length;
    const casosCriticos = empleados.filter(emp => emp.EstadoGeneral === 'critico').length;
    
    // Simular tendencias (en un caso real, compararías con período anterior)
    const tendenciaCompletitud = Math.floor(Math.random() * 10) - 5; // -5 a +5
    const tendenciaActualizaciones = Math.floor(Math.random() * 50) - 25; // -25 a +25
    const tendenciaTiempo = Math.floor(Math.random() * 6) - 3; // -3 a +3
    const tendenciaCriticos = Math.floor(Math.random() * 10) - 5; // -5 a +5
    
    // Actualizar KPIs en la interfaz
    document.getElementById('kpiCompletitud').textContent = `${completitudPromedio}%`;
    document.getElementById('kpiActualizaciones').textContent = documentosActualizados;
    document.getElementById('kpiTiempoPromedio').textContent = `${Math.floor(Math.random() * 15) + 5} días`;
    document.getElementById('kpiCriticos').textContent = casosCriticos;
    
    // Actualizar tendencias
    actualizarTendencia('kpiTrendCompletitud', tendenciaCompletitud, '%');
    actualizarTendencia('kpiTrendActualizaciones', tendenciaActualizaciones, '');
    actualizarTendencia('kpiTrendTiempo', tendenciaTiempo, ' días');
    actualizarTendencia('kpiTrendCriticos', tendenciaCriticos, '');
}

/**
 * Actualizar indicador de tendencia
 */
function actualizarTendencia(elementId, valor, unidad) {
    const elemento = document.getElementById(elementId);
    const icono = elemento.querySelector('i');
    const span = elemento.querySelector('span');
    
    if (valor > 0) {
        elemento.className = 'kpi-trend positive';
        icono.className = 'fas fa-arrow-up';
        span.textContent = `+${valor}${unidad}`;
    } else if (valor < 0) {
        elemento.className = 'kpi-trend negative';
        icono.className = 'fas fa-arrow-down';
        span.textContent = `${valor}${unidad}`;
    } else {
        elemento.className = 'kpi-trend neutral';
        icono.className = 'fas fa-minus';
        span.textContent = `${valor}${unidad}`;
    }
}

/**
 * Generar gráficos
 */
async function generarGraficos() {
    // Destruir gráficos existentes
    Object.values(chartsInstances).forEach(chart => {
        if (chart) chart.destroy();
    });
    chartsInstances = {};
    
    // Generar datos para gráficos
    const datosEvolucion = generarDatosEvolucion();
    const datosActualizaciones = generarDatosActualizaciones();
    const datosDistribucion = generarDatosDistribucion();
    
    // Crear gráficos
    chartsInstances.evolucion = crearGraficoEvolucion(datosEvolucion);
    chartsInstances.actualizaciones = crearGraficoActualizaciones(datosActualizaciones);
    chartsInstances.distribucion = crearGraficoDistribucion(datosDistribucion);
    
    // Generar heatmap
    generarHeatmap();
}

/**
 * Generar datos de evolución mensual
 */
function generarDatosEvolucion() {
    const meses = generarRangoMeses(filtrosActivos.fechaDesde, filtrosActivos.fechaHasta);
    
    return {
        labels: meses.map(mes => formatearMesCorto(mes)),
        datasets: [{
            label: 'Completitud General (%)',
            data: meses.map(() => Math.floor(Math.random() * 30) + 60), // Simular datos 60-90%
            borderColor: 'rgb(52, 152, 219)',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.4,
            fill: true
        }]
    };
}

/**
 * Generar datos de actualizaciones mensuales
 */
function generarDatosActualizaciones() {
    const meses = generarRangoMeses(filtrosActivos.fechaDesde, filtrosActivos.fechaHasta);
    const cambiosPorMes = agruparCambiosPorMes();
    
    return {
        labels: meses.map(mes => formatearMesCorto(mes)),
        datasets: [{
            label: 'Documentos Actualizados',
            data: meses.map(mes => cambiosPorMes[mes] || 0),
            backgroundColor: 'rgba(76, 175, 80, 0.8)',
            borderColor: 'rgb(76, 175, 80)',
            borderWidth: 1
        }]
    };
}

/**
 * Generar datos de distribución de estados
 */
function generarDatosDistribucion() {
    const empleados = datosAnalisis.empleados;
    
    const completos = empleados.filter(emp => emp.EstadoGeneral === 'completo').length;
    const advertencia = empleados.filter(emp => emp.EstadoGeneral === 'advertencia').length;
    const criticos = empleados.filter(emp => emp.EstadoGeneral === 'critico').length;
    
    return {
        labels: ['Completos', 'Atención', 'Críticos'],
        datasets: [{
            data: [completos, advertencia, criticos],
            backgroundColor: [
                'rgba(76, 175, 80, 0.8)',
                'rgba(255, 193, 7, 0.8)',
                'rgba(255, 82, 82, 0.8)'
            ],
            borderColor: [
                'rgb(76, 175, 80)',
                'rgb(255, 193, 7)',
                'rgb(255, 82, 82)'
            ],
            borderWidth: 2
        }]
    };
}

/**
 * Crear gráfico de evolución
 */
function crearGraficoEvolucion(datos) {
    const ctx = document.getElementById('chartEvolucion').getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: datos,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

/**
 * Crear gráfico de actualizaciones
 */
function crearGraficoActualizaciones(datos) {
    const ctx = document.getElementById('chartActualizaciones').getContext('2d');
    return new Chart(ctx, {
        type: 'bar',
        data: datos,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * Crear gráfico de distribución
 */
function crearGraficoDistribucion(datos) {
    const ctx = document.getElementById('chartDistribucion').getContext('2d');
    return new Chart(ctx, {
        type: 'doughnut',
        data: datos,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

/**
 * Generar heatmap de departamentos
 */
function generarHeatmap() {
    const container = document.getElementById('heatmapContainer');
    container.innerHTML = '<p>Heatmap de performance por departamento<br><small>Funcionalidad en desarrollo</small>';
}

/**
 * Generar tabla de tendencias
 */
async function generarTablaTendencias() {
    // Destruir tabla existente
    if (tablaTendencias) {
        tablaTendencias.destroy();
        tablaTendencias = null;
    }
    
    const tbody = document.querySelector('#tablaTendencias tbody');
    tbody.innerHTML = '';
    
    // Agrupar empleados por departamento
    const empleadosPorDepto = agruparPorDepartamento(datosAnalisis.empleados);
    
    // Generar filas de tendencias
    Object.entries(empleadosPorDepto).forEach(([nombreDepto, empleados]) => {
        const completitudActual = Math.round(empleados.reduce((sum, emp) => sum + emp.PorcentajeCompletitud, 0) / empleados.length);
        const completitudAnterior = completitudActual + (Math.floor(Math.random() * 20) - 10); // Simular mes anterior
        const variacion = completitudActual - completitudAnterior;
        const criticos = empleados.filter(emp => emp.EstadoGeneral === 'critico').length;
        const actualizaciones = Math.floor(Math.random() * 50) + 10; // Simular actualizaciones
        
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td class="text-start"><strong>${nombreDepto}</strong></td>
            <td>${completitudActual}%</td>
            <td>${completitudAnterior}%</td>
            <td>${generarBadgeVariacion(variacion)}</td>
            <td>${generarIndicadorTendencia(variacion)}</td>
            <td>${actualizaciones}</td>
            <td>${criticos}</td>
            <td>${generarCalificacion(completitudActual, criticos)}</td>
        `;
        tbody.appendChild(fila);
    });
    
    // CORREGIDO: Usar jQuery después de verificar que existe
    if (typeof $ !== 'undefined' && $.fn.DataTable) {
        // Inicializar DataTable solo si jQuery y DataTables están disponibles
        tablaTendencias = $('#tablaTendencias').DataTable({
            responsive: true,
            language: {
                "sProcessing": "Procesando...",
                "sLengthMenu": "Mostrar _MENU_ registros",
                "sZeroRecords": "No se encontraron resultados",
                "sEmptyTable": "Ningún dato disponible en esta tabla",
                "sInfo": "Mostrando registros del _START_ al _END_ de un total de _TOTAL_ registros",
                "sInfoEmpty": "Mostrando registros del 0 al 0 de un total de 0 registros",
                "sInfoFiltered": "(filtrado de un total de _MAX_ registros)",
                "sInfoPostFix": "",
                "sSearch": "Buscar:",
                "sUrl": "",
                "sInfoThousands": ",",
                "sLoadingRecords": "Cargando...",
                "oPaginate": {
                    "sFirst": "Primero",
                    "sLast": "Último",
                    "sNext": "Siguiente",
                    "sPrevious": "Anterior"
                }
            },
            pageLength: 10,
            order: [[1, 'desc']] // Ordenar por completitud actual
        });
    } else {
        console.warn('DataTables no está disponible, tabla básica creada');
    }
}

/**
 * Generar rankings de departamentos
 */
async function generarRankings() {
    const empleadosPorDepto = agruparPorDepartamento(datosAnalisis.empleados);
    
    // Calcular scores por departamento
    const departamentosConScore = Object.entries(empleadosPorDepto).map(([nombre, empleados]) => {
        const completitud = Math.round(empleados.reduce((sum, emp) => sum + emp.PorcentajeCompletitud, 0) / empleados.length);
        const criticos = empleados.filter(emp => emp.EstadoGeneral === 'critico').length;
        const score = completitud - (criticos * 5); // Penalizar casos críticos
        
        return { nombre, completitud, criticos, score, totalEmpleados: empleados.length };
    });
    
    // Ordenar por score
    departamentosConScore.sort((a, b) => b.score - a.score);
    
    // Top performers (primeros 5)
    const topPerformers = departamentosConScore.slice(0, 5);
    const topContainer = document.getElementById('topPerformers');
    topContainer.innerHTML = '';
    
    topPerformers.forEach((depto, index) => {
        const item = document.createElement('div');
        item.className = 'ranking-item';
        item.innerHTML = `
            <div class="ranking-position top">${index + 1}</div>
            <div class="ranking-info">
                <div class="ranking-name">${depto.nombre}</div>
                <div class="ranking-score">${depto.completitud}% completitud - ${depto.totalEmpleados} empleados</div>
            </div>
        `;
        topContainer.appendChild(item);
    });
    
    // Bottom performers (últimos 5)
    const bottomPerformers = departamentosConScore.slice(-5).reverse();
    const bottomContainer = document.getElementById('bottomPerformers');
    bottomContainer.innerHTML = '';
    
    bottomPerformers.forEach((depto, index) => {
        const item = document.createElement('div');
        item.className = 'ranking-item';
        item.innerHTML = `
            <div class="ranking-position bottom">${index + 1}</div>
            <div class="ranking-info">
                <div class="ranking-name">${depto.nombre}</div>
                <div class="ranking-score">${depto.completitud}% completitud - ${depto.criticos} críticos</div>
            </div>
        `;
        bottomContainer.appendChild(item);
    });
}

/**
 * Funciones auxiliares
 */

function generarRangoMeses(fechaDesde, fechaHasta) {
    const meses = [];
    const inicio = new Date(fechaDesde);
    const fin = new Date(fechaHasta);
    
    let actual = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const finMes = new Date(fin.getFullYear(), fin.getMonth(), 1);
    
    while (actual <= finMes) {
        meses.push(actual.toISOString().substr(0, 7)); // YYYY-MM
        actual.setMonth(actual.getMonth() + 1);
    }
    
    return meses;
}

function formatearMesCorto(mesISO) {
    const [año, mes] = mesISO.split('-');
    const fecha = new Date(año, mes - 1);
    return fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
}

function agruparCambiosPorMes() {
    const cambiosPorMes = {};
    datosAnalisis.cambios.forEach(cambio => {
        const mes = cambio.MesCambio;
        cambiosPorMes[mes] = (cambiosPorMes[mes] || 0) + 1;
    });
    return cambiosPorMes;
}

function agruparPorDepartamento(empleados) {
    const grupos = {};
    empleados.forEach(emp => {
        if (!grupos[emp.NombreDepartamento]) {
            grupos[emp.NombreDepartamento] = [];
        }
        grupos[emp.NombreDepartamento].push(emp);
    });
    return grupos;
}

function generarBadgeVariacion(variacion) {
    if (variacion > 0) {
        return `<span class="trend-badge positive"><i class="fas fa-arrow-up"></i> +${variacion}%</span>`;
    } else if (variacion < 0) {
        return `<span class="trend-badge negative"><i class="fas fa-arrow-down"></i> ${variacion}%</span>`;
    } else {
        return `<span class="trend-badge neutral"><i class="fas fa-minus"></i> ${variacion}%</span>`;
    }
}

function generarIndicadorTendencia(variacion) {
    if (variacion > 0) {
        return '<i class="fas fa-trending-up" style="color: #4CAF50;"></i>';
    } else if (variacion < 0) {
        return '<i class="fas fa-trending-down" style="color: #FF5252;"></i>';
    } else {
        return '<i class="fas fa-minus" style="color: #95a5a6;"></i>';
    }
}

function generarCalificacion(completitud, criticos) {
    let score = completitud - (criticos * 5);
    let badge = '';
    
    if (score >= 80) {
        badge = '<span class="trend-badge positive">Excelente</span>';
    } else if (score >= 60) {
        badge = '<span class="trend-badge neutral">Bueno</span>';
    } else {
        badge = '<span class="trend-badge negative">Necesita Atención</span>';
    }
    
    return badge;
}

/**
 * Mostrar todas las secciones con datos
 */
function mostrarSecciones() {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('kpisSection').style.display = 'block';
    document.getElementById('chartsSection').style.display = 'block';
    document.getElementById('trendsSection').style.display = 'block';
    document.getElementById('rankingSection').style.display = 'block';
    
    // Agregar animaciones
    document.querySelectorAll('#kpisSection, #chartsSection, #trendsSection, #rankingSection').forEach(section => {
        section.classList.add('fadeIn');
    });
}

/**
 * Actualizar información del período
 */
function actualizarInfoPeriodo() {
    const fechaDesde = new Date(filtrosActivos.fechaDesde);
    const fechaHasta = new Date(filtrosActivos.fechaHasta);
    
    const formatoFecha = { day: '2-digit', month: 'short', year: 'numeric' };
    const textoDesde = fechaDesde.toLocaleDateString('es-ES', formatoFecha);
    const textoHasta = fechaHasta.toLocaleDateString('es-ES', formatoFecha);
    
    document.getElementById('periodInfo').textContent = `(${textoDesde} - ${textoHasta})`;
}

/**
 * Exportar datos
 */
function exportarDatos(tipo) {
    switch (tipo) {
        case 'tendencias':
            exportarTablaTendencias();
            break;
        default:
            mostrarMensaje('Exportación', 'Funcionalidad de exportación en desarrollo.', 'info');
    }
}

/**
 * Exportar tabla de tendencias
 */
function exportarTablaTendencias() {
    if (!tablaTendencias) {
        // Si no hay DataTable, exportar datos de la tabla HTML directamente
        const tabla = document.getElementById('tablaTendencias');
        const filas = tabla.querySelectorAll('tbody tr');
        
        if (filas.length === 0) {
            mostrarError('Sin datos', 'No hay datos para exportar.');
            return;
        }
        
        console.log('Datos para exportar:', filas.length, 'filas');
        mostrarMensaje('Exportación', `Se exportarían ${filas.length} registros de tendencias.`, 'info');
        return;
    }
    
    // Si hay DataTable, usar su API
    const filas = tablaTendencias.rows().data().toArray();
    console.log('Datos para exportar:', filas);
    
    mostrarMensaje('Exportación', `Se exportarían ${filas.length} registros de tendencias.`, 'info');
}

/**
 * Exportar gráfico
 */
function exportarGrafico(tipo) {
    const chart = chartsInstances[tipo];
    if (!chart) {
        mostrarError('Sin gráfico', 'No hay gráfico disponible para exportar.');
        return;
    }
    
    try {
        // Crear enlace de descarga
        const link = document.createElement('a');
        link.download = `grafico_${tipo}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = chart.toBase64Image();
        link.click();
        
        mostrarMensaje('Exportación', 'Gráfico exportado exitosamente.', 'success');
    } catch (error) {
        console.error('Error al exportar gráfico:', error);
        mostrarError('Error de exportación', 'No se pudo exportar el gráfico.');
    }
}

/**
 * Mostrar/ocultar modal de carga
 */
function mostrarCarga(mostrar) {
    const modal = document.getElementById('loadingModal');
    modal.style.display = mostrar ? 'flex' : 'none';
    
    if (mostrar) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

/**
 * Mostrar mensaje de error
 */
function mostrarError(titulo, mensaje) {
    Swal.fire({
        title: titulo,
        text: mensaje,
        icon: 'error',
        confirmButtonColor: '#3498db',
        confirmButtonText: 'Entendido'
    });
}

/**
 * Mostrar mensaje genérico
 */
function mostrarMensaje(titulo, mensaje, tipo = 'info') {
    Swal.fire({
        title: titulo,
        text: mensaje,
        icon: tipo,
        confirmButtonColor: '#3498db',
        confirmButtonText: 'Aceptar'
    });
}

/**
 * Formatear fecha para mostrar
 */
function formatearFecha(fecha) {
    if (!fecha) return 'No definida';
    
    try {
        const fechaObj = new Date(fecha + 'T00:00:00');
        return fechaObj.toLocaleDateString('es-GT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'Fecha inválida';
    }
}

/**
 * Limpiar todos los datos y volver al estado inicial
 */
function limpiarAnalisis() {
    // Ocultar secciones
    document.getElementById('kpisSection').style.display = 'none';
    document.getElementById('chartsSection').style.display = 'none';
    document.getElementById('trendsSection').style.display = 'none';
    document.getElementById('rankingSection').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    
    // Destruir gráficos
    Object.values(chartsInstances).forEach(chart => {
        if (chart) chart.destroy();
    });
    chartsInstances = {};
    
    // Destruir tabla
    if (tablaTendencias) {
        tablaTendencias.destroy();
        tablaTendencias = null;
    }
    
    // Limpiar datos
    datosAnalisis = [];
    filtrosActivos = {};
}

/**
 * Validar conexión y datos
 */
async function validarSistema() {
    try {
        const connection = await connectionString();
        await connection.query('SELECT 1');
        await connection.close();
        return true;
    } catch (error) {
        console.error('Error de conexión:', error);
        mostrarError('Error de conexión', 'No se puede conectar a la base de datos.');
        return false;
    }
}

/**
 * Manejar errores globales
 */
window.addEventListener('error', function(error) {
    console.error('Error global:', error);
    mostrarError('Error inesperado', 'Ha ocurrido un error inesperado. Por favor, recarga la página.');
});

/**
 * Manejar errores de promesas no capturadas
 */
window.addEventListener('unhandledrejection', function(event) {
    console.error('Error de promesa no capturado:', event.reason);
    mostrarError('Error de sistema', 'Problema del sistema. Verifica tu conexión a internet.');
    event.preventDefault();
});

/**
 * Optimización: Lazy loading para mejorar rendimiento
 */
function optimizarRendimiento() {
    // Intersection Observer para animaciones solo cuando están visibles
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fadeIn');
            }
        });
    });
    
    // Observar elementos que necesitan animación
    document.querySelectorAll('.kpi-card, .chart-container, .ranking-container').forEach(el => {
        observer.observe(el);
    });
}

/**
 * Inicializar tooltips y elementos interactivos
 */
function inicializarInteracciones() {
    // Tooltips simples para elementos con título
    document.querySelectorAll('[title]').forEach(element => {
        let tooltip = null;
        
        element.addEventListener('mouseenter', function(e) {
            tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.textContent = this.title;
            tooltip.style.cssText = `
                position: absolute;
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 5px 8px;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none;
                z-index: 10000;
                white-space: nowrap;
            `;
            document.body.appendChild(tooltip);
            
            this.setAttribute('data-original-title', this.title);
            this.removeAttribute('title');
        });
        
        element.addEventListener('mousemove', function(e) {
            if (tooltip) {
                tooltip.style.left = e.pageX + 10 + 'px';
                tooltip.style.top = e.pageY + 10 + 'px';
            }
        });
        
        element.addEventListener('mouseleave', function() {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
            
            const originalTitle = this.getAttribute('data-original-title');
            if (originalTitle) {
                this.title = originalTitle;
                this.removeAttribute('data-original-title');
            }
        });
    });
}

/**
 * Configurar responsive avanzado
 */
function configurarResponsive() {
    // Ajustar gráficos en cambio de tamaño
    window.addEventListener('resize', debounce(() => {
        Object.values(chartsInstances).forEach(chart => {
            if (chart) {
                chart.resize();
            }
        });
    }, 250));
    
    // Ajustar tabla en dispositivos móviles
    window.addEventListener('resize', debounce(() => {
        if (tablaTendencias) {
            tablaTendencias.columns.adjust().responsive.recalc();
        }
    }, 250));
}

/**
 * Debounce function para optimizar eventos
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Inicialización final cuando la página esté completamente cargada
window.addEventListener('load', function() {
    optimizarRendimiento();
    inicializarInteracciones();
    configurarResponsive();
});