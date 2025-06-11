// ===== VARIABLES GLOBALES =====
const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const conexion = 'DSN=recursos2';

// Datos del usuario
const userData = JSON.parse(localStorage.getItem('userData'));

// Variables de estado
let currentPage = 1;
let recordsPerPage = 15;
let totalRecords = 0;
let allData = [];
let filteredData = [];
let searchTimeout = null;

// Variables de gráficos
let chartTipoRetiro = null;
let chartBajasPorMes = null;

// Referencias DOM - Filtros
const fechaDesde = document.getElementById('fechaDesde');
const fechaHasta = document.getElementById('fechaHasta');
const tipoRetiro = document.getElementById('tipoRetiro');
const estadoRegistro = document.getElementById('estadoRegistro');
const searchCollaborator = document.getElementById('searchCollaborator');

// Referencias DOM - Botones
const btnClearFilters = document.getElementById('btnClearFilters');
const btnExportReport = document.getElementById('btnExportReport');
const btnToggleCharts = document.getElementById('btnToggleCharts');
const btnCollapseSidebar = document.getElementById('btnCollapseSidebar');

// Referencias DOM - Estadísticas
const totalBajas = document.getElementById('totalBajas');
const totalDespidos = document.getElementById('totalDespidos');
const totalRenuncias = document.getElementById('totalRenuncias');
const resultsCount = document.getElementById('resultsCount');

// Referencias DOM - Vistas
const tableView = document.getElementById('tableView');
const cardsView = document.getElementById('cardsView');
const bajasTableBody = document.getElementById('bajasTableBody');
const cardsContainer = document.getElementById('cardsContainer');
const noDataMessage = document.getElementById('noDataMessage');

// Referencias DOM - Paginación
const paginationContainer = document.getElementById('paginationContainer');
const paginationInfo = document.getElementById('paginationInfo');
const paginationControls = document.getElementById('paginationControls');

// Referencias DOM - Modal
const detailModal = document.getElementById('detailModal');
const closeDetailModal = document.getElementById('closeDetailModal');

// Referencias DOM - Sidebar
const chartsSidebar = document.getElementById('chartsSidebar');

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    try {
        console.log('🚀 Inicializando Reporte de Bajas...');
        
        // Configurar eventos
        inicializarEventos();
        
        // Configurar fechas por defecto
        configurarFechasPorDefecto();
        
        // Cargar datos iniciales
        cargarDatosIniciales();
        
        // Configurar funcionalidades adicionales
        configurarFuncionalidadesAdicionales();
        
        console.log('✅ Reporte de Bajas inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error al inicializar:', error);
        mostrarNotificacion('Error al inicializar la aplicación', 'error');
    }
});

// ===== CONEXIÓN BASE DE DATOS =====
async function getConnection() {
    try {
        const connection = await odbc.connect(conexion);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        mostrarNotificacion('Error de conexión a la base de datos', 'error');
        throw error;
    }
}

// ===== CONFIGURACIÓN DE EVENTOS =====
function inicializarEventos() {
    // Eventos de filtros
    btnClearFilters?.addEventListener('click', limpiarFiltros);
    btnExportReport?.addEventListener('click', exportarReporte);
    btnToggleCharts?.addEventListener('click', toggleCharts);
    btnCollapseSidebar?.addEventListener('click', toggleSidebar);
    
    // Eventos de fechas con auto-búsqueda
    fechaDesde?.addEventListener('change', handleFechaChange);
    fechaHasta?.addEventListener('change', handleFechaChange);
    
    // Eventos de selects con auto-búsqueda
    tipoRetiro?.addEventListener('change', () => {
        currentPage = 1;
        cargarDatosFiltrados();
    });
    
    estadoRegistro?.addEventListener('change', () => {
        currentPage = 1;
        cargarDatosFiltrados();
    });
    
    // Búsqueda en tiempo real
    searchCollaborator?.addEventListener('input', handleSearch);
    
    // Eventos de vista
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            cambiarVista(this.dataset.view);
        });
    });
    
    // Eventos de modal
    closeDetailModal?.addEventListener('click', cerrarModal);
    document.querySelector('.close-modal-btn')?.addEventListener('click', cerrarModal);
    
    detailModal?.addEventListener('click', function(event) {
        if (event.target === detailModal) {
            cerrarModal();
        }
    });
    
    // Eventos de tabs del modal
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            cambiarTab(this.dataset.tab);
        });
    });
    
    // Teclas de acceso rápido
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    console.log('📋 Eventos inicializados');
}

// ===== MANEJADORES DE EVENTOS =====
function handleFechaChange() {
    // Validar rango de fechas
    if (fechaDesde.value && fechaHasta.value) {
        if (fechaDesde.value > fechaHasta.value) {
            const fechaTemp = fechaHasta.value;
            fechaHasta.value = fechaDesde.value;
            fechaDesde.value = fechaTemp;
            mostrarNotificacion('Fechas corregidas automáticamente', 'info');
        }
        currentPage = 1;
        cargarDatosFiltrados();
    }
}

function handleSearch(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        filtrarDatosPorBusqueda(e.target.value);
    }, 300);
}

function handleKeyboardShortcuts(e) {
    // Esc para cerrar modal
    if (e.key === 'Escape') {
        cerrarModal();
    }
    
    // Ctrl + F para enfocar búsqueda
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchCollaborator?.focus();
    }
    
    // Ctrl + E para exportar
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        exportarReporte();
    }
    
    // Ctrl + R para actualizar
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        cargarDatosFiltrados();
    }
    
    // Navegación con flechas en paginación
    if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            mostrarDatos();
        }
    }
    
    if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault();
        const totalPages = Math.ceil(filteredData.length / recordsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            mostrarDatos();
        }
    }
}

// ===== CONFIGURACIÓN INICIAL =====
function configurarFechasPorDefecto() {
    const hoy = new Date();
    const haceTresMeses = new Date();
    haceTresMeses.setMonth(haceTresMeses.getMonth() - 3);
    
    fechaHasta.value = hoy.toISOString().split('T')[0];
    fechaDesde.value = haceTresMeses.toISOString().split('T')[0];
    
    // Establecer fecha máxima como hoy
    const maxDate = hoy.toISOString().split('T')[0];
    fechaHasta.setAttribute('max', maxDate);
    fechaDesde.setAttribute('max', maxDate);
}

async function cargarDatosIniciales() {
    mostrarCargando(true, 'Cargando datos iniciales...');
    await cargarDatosFiltrados();
    mostrarCargando(false);
}

function configurarFuncionalidadesAdicionales() {
    // Configurar tooltips
    configurarTooltips();
    
    // Configurar actualización automática cada 5 minutos
    setInterval(() => {
        if (!document.hidden) {
            cargarDatosFiltrados();
        }
    }, 300000);
    
    // Configurar manejo de visibilidad de página
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            cargarDatosFiltrados();
        }
    });
}

function configurarTooltips() {
    // Implementar tooltips simples
    document.querySelectorAll('[title]').forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
}

// ===== CARGA Y FILTRADO DE DATOS =====
async function cargarDatosFiltrados() {
    try {
        mostrarCargando(true, 'Aplicando filtros...');
        
        const connection = await getConnection();
        
        // Construir consulta SQL
        let query = `
            SELECT 
                dr.IdDespidoRenuncia,
                dr.IdPersonal,
                dr.NombrePersonal,
                dr.IdEstadoPersonal,
                dr.EstadoPersonal,
                dr.FechaFinColaborador,
                dr.ObservacionRetiro,
                dr.IdUsuario,
                dr.NombreUsuario,
                dr.FechaRegistro,
                dr.FechaHoraRegistro,
                dr.Estado
            FROM 
                DespidosRenuncias dr
            WHERE 1=1
        `;
        
        const params = [];
        
        // Aplicar filtros
        if (fechaDesde.value) {
            query += ` AND DATE(dr.FechaFinColaborador) >= ?`;
            params.push(fechaDesde.value);
        }
        
        if (fechaHasta.value) {
            query += ` AND DATE(dr.FechaFinColaborador) <= ?`;
            params.push(fechaHasta.value);
        }
        
        if (tipoRetiro.value) {
            query += ` AND dr.IdEstadoPersonal = ?`;
            params.push(tipoRetiro.value);
        }
        
        if (estadoRegistro.value !== '') {
            query += ` AND dr.Estado = ?`;
            params.push(estadoRegistro.value);
        }
        
        query += ` ORDER BY dr.FechaHoraRegistro DESC`;
        
        const result = await connection.query(query, params);
        await connection.close();
        
        allData = result || [];
        filteredData = [...allData];
        totalRecords = filteredData.length;
        
        // Aplicar búsqueda de texto si existe
        if (searchCollaborator?.value) {
            filtrarDatosPorBusqueda(searchCollaborator.value);
        }
        
        // Actualizar interfaz
        actualizarEstadisticas();
        actualizarGraficos();
        actualizarMetricas();
        
        currentPage = 1;
        mostrarDatos();
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('❌ Error al cargar datos:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar datos: ' + error.message, 'error');
    }
}

function filtrarDatosPorBusqueda(termino) {
    if (!termino.trim()) {
        filteredData = [...allData];
    } else {
        const terminoLower = termino.toLowerCase().trim();
        filteredData = allData.filter(item => 
            item.NombrePersonal?.toLowerCase().includes(terminoLower) ||
            item.EstadoPersonal?.toLowerCase().includes(terminoLower) ||
            item.NombreUsuario?.toLowerCase().includes(terminoLower) ||
            item.ObservacionRetiro?.toLowerCase().includes(terminoLower)
        );
    }
    
    totalRecords = filteredData.length;
    currentPage = 1;
    
    actualizarEstadisticas();
    mostrarDatos();
}

// ===== ESTADÍSTICAS Y MÉTRICAS =====
function actualizarEstadisticas() {
    const stats = {
        total: filteredData.length,
        despidos: filteredData.filter(item => item.IdEstadoPersonal === 2).length,
        renuncias: filteredData.filter(item => item.IdEstadoPersonal === 3).length
    };
    
    // Animar números
    animarNumero(totalBajas, stats.total);
    animarNumero(totalDespidos, stats.despidos);
    animarNumero(totalRenuncias, stats.renuncias);
    
    // Actualizar contador de resultados
    resultsCount.textContent = `(${stats.total} registros)`;
}

function animarNumero(elemento, valorFinal) {
    if (!elemento) return;
    
    const valorInicial = parseInt(elemento.textContent) || 0;
    const duracion = 1000;
    const pasos = 30;
    const incremento = (valorFinal - valorInicial) / pasos;
    
    let contador = 0;
    const interval = setInterval(() => {
        contador++;
        const valorActual = Math.round(valorInicial + (incremento * contador));
        elemento.textContent = valorActual;
        
        if (contador >= pasos) {
            clearInterval(interval);
            elemento.textContent = valorFinal;
        }
    }, duracion / pasos);
}

function actualizarMetricas() {
    // Calcular métricas adicionales
    const promedioMensual = document.getElementById('promedioMensual');
    const mesMasBajas = document.getElementById('mesMasBajas');
    
    if (filteredData.length > 0) {
        // Agrupar por mes
        const datosPorMes = {};
        filteredData.forEach(item => {
            if (item.FechaFinColaborador) {
                const fecha = new Date(item.FechaFinColaborador);
                const mesAnio = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
                datosPorMes[mesAnio] = (datosPorMes[mesAnio] || 0) + 1;
            }
        });
        
        const meses = Object.keys(datosPorMes);
        if (meses.length > 0) {
            // Promedio mensual
            const totalBajasMes = Object.values(datosPorMes).reduce((a, b) => a + b, 0);
            const promedio = Math.round(totalBajasMes / meses.length);
            if (promedioMensual) promedioMensual.textContent = promedio;
            
            // Mes con más bajas
            const mesMaxBajas = Object.keys(datosPorMes).reduce((a, b) => 
                datosPorMes[a] > datosPorMes[b] ? a : b
            );
            
            if (mesMasBajas && mesMaxBajas) {
                const [anio, mes] = mesMaxBajas.split('-');
                const nombreMes = new Date(anio, mes - 1).toLocaleDateString('es-ES', { 
                    month: 'short', 
                    year: '2-digit' 
                });
                mesMasBajas.textContent = nombreMes;
            }
        }
    } else {
        if (promedioMensual) promedioMensual.textContent = '0';
        if (mesMasBajas) mesMasBajas.textContent = '-';
    }
}

// ===== GRÁFICOS =====
function actualizarGraficos() {
    actualizarGraficoTipoRetiro();
    actualizarGraficoBajasPorMes();
}

function actualizarGraficoTipoRetiro() {
    const canvas = document.getElementById('chartTipoRetiro');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const despidos = filteredData.filter(item => item.IdEstadoPersonal === 2).length;
    const renuncias = filteredData.filter(item => item.IdEstadoPersonal === 3).length;
    
    if (chartTipoRetiro) {
        chartTipoRetiro.destroy();
    }
    
    chartTipoRetiro = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Despidos', 'Renuncias'],
            datasets: [{
                data: [despidos, renuncias],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ],
                borderColor: [
                    'rgba(239, 68, 68, 1)',
                    'rgba(245, 158, 11, 1)'
                ],
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

function actualizarGraficoBajasPorMes() {
    const canvas = document.getElementById('chartBajasPorMes');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Agrupar datos por mes
    const datosPorMes = {};
    filteredData.forEach(item => {
        if (item.FechaFinColaborador) {
            const fecha = new Date(item.FechaFinColaborador);
            const mesAnio = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
            
            if (!datosPorMes[mesAnio]) {
                datosPorMes[mesAnio] = { despidos: 0, renuncias: 0 };
            }
            
            if (item.IdEstadoPersonal === 2) {
                datosPorMes[mesAnio].despidos++;
            } else if (item.IdEstadoPersonal === 3) {
                datosPorMes[mesAnio].renuncias++;
            }
        }
    });
    
    // Ordenar por fecha y tomar últimos 6 meses
    const mesesOrdenados = Object.keys(datosPorMes).sort().slice(-6);
    const labels = mesesOrdenados.map(mes => {
        const [anio, mesNum] = mes.split('-');
        return new Date(anio, mesNum - 1).toLocaleDateString('es-ES', { 
            month: 'short', 
            year: '2-digit' 
        });
    });
    
    const despidosData = mesesOrdenados.map(mes => datosPorMes[mes]?.despidos || 0);
    const renunciasData = mesesOrdenados.map(mes => datosPorMes[mes]?.renuncias || 0);
    
    if (chartBajasPorMes) {
        chartBajasPorMes.destroy();
    }
    
    chartBajasPorMes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Despidos',
                    data: despidosData,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Renuncias',
                    data: renunciasData,
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 10
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

// ===== VISUALIZACIÓN DE DATOS =====
function mostrarDatos() {
    const vista = document.querySelector('.view-btn.active')?.dataset.view || 'table';
    
    if (vista === 'table') {
        mostrarVistaTabla();
    } else {
        mostrarVistaTarjetas();
    }
    
    actualizarPaginacion();
}

function mostrarVistaTabla() {
    if (filteredData.length === 0) {
        bajasTableBody.innerHTML = '';
        noDataMessage.style.display = 'flex';
        return;
    }
    
    noDataMessage.style.display = 'none';
    
    const inicio = (currentPage - 1) * recordsPerPage;
    const fin = inicio + recordsPerPage;
    const datosPage = filteredData.slice(inicio, fin);
    
    let html = '';
    
    datosPage.forEach(item => {
        const fechaFin = formatearFecha(item.FechaFinColaborador);
        const fechaRegistro = formatearFecha(item.FechaHoraRegistro, true);
        
        const tipoRetiroBadge = item.IdEstadoPersonal === 2 ? 
            '<span class="badge badge-despido"><i class="fas fa-user-times"></i> Despido</span>' :
            '<span class="badge badge-renuncia"><i class="fas fa-user-minus"></i> Renuncia</span>';
        
        const estadoBadge = item.Estado === 1 ? 
            '<span class="badge badge-activo"><i class="fas fa-check-circle"></i> Activo</span>' :
            '<span class="badge badge-invalidado"><i class="fas fa-ban"></i> Invalidado</span>';
        
        // Generar iniciales para avatar
        const iniciales = generarIniciales(item.NombrePersonal);
        
        html += `
            <tr>
                <td data-label="Avatar">
                    <div class="collaborator-avatar" title="${item.NombrePersonal}">
                        ${iniciales}
                    </div>
                </td>
                <td data-label="Colaborador" class="col-name">${item.NombrePersonal}</td>
                <td data-label="Tipo">${tipoRetiroBadge}</td>
                <td data-label="Fecha Fin">${fechaFin}</td>
                <td data-label="Estado">${estadoBadge}</td>
                <td data-label="Registrado por">${item.NombreUsuario || 'No especificado'}</td>
                <td data-label="Acciones">
                    <div class="action-buttons">
                        <button class="action-btn btn-view" onclick="verDetalle(${item.IdDespidoRenuncia})" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    bajasTableBody.innerHTML = html;
}

function mostrarVistaTarjetas() {
    if (filteredData.length === 0) {
        cardsContainer.innerHTML = '';
        noDataMessage.style.display = 'flex';
        return;
    }
    
    noDataMessage.style.display = 'none';
    
    const inicio = (currentPage - 1) * recordsPerPage;
    const fin = inicio + recordsPerPage;
    const datosPage = filteredData.slice(inicio, fin);
    
    let html = '';
    
    datosPage.forEach(item => {
        const fechaFin = formatearFecha(item.FechaFinColaborador);
        const fechaRegistro = formatearFecha(item.FechaHoraRegistro, true);
        
        const tipoClass = item.IdEstadoPersonal === 2 ? 'despido' : 'renuncia';
        const tipoTexto = item.IdEstadoPersonal === 2 ? 'Despido' : 'Renuncia';
        const tipoIcon = item.IdEstadoPersonal === 2 ? 'fa-user-times' : 'fa-user-minus';
        
        const estadoIcon = item.Estado === 1 ? 'fa-check-circle' : 'fa-ban';
        const estadoTexto = item.Estado === 1 ? 'Activo' : 'Invalidado';
        const estadoClass = item.Estado === 1 ? 'badge-activo' : 'badge-invalidado';
        
        const iniciales = generarIniciales(item.NombrePersonal);
        
        html += `
            <div class="collaborator-card ${tipoClass}">
                <div class="card-header">
                    <div>
                        <div class="card-avatar">${iniciales}</div>
                        <h3 class="card-name">${item.NombrePersonal}</h3>
                        <span class="badge badge-${tipoClass}">
                            <i class="fas ${tipoIcon}"></i> ${tipoTexto}
                        </span>
                    </div>
                    <span class="badge ${estadoClass}">
                        <i class="fas ${estadoIcon}"></i> ${estadoTexto}
                    </span>
                </div>
                
                <div class="card-info">
                    <div class="info-row">
                        <i class="fas fa-calendar"></i>
                        <span>Fecha Fin: ${fechaFin}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-clock"></i>
                        <span>Registrado: ${fechaRegistro}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-user-tie"></i>
                        <span>Por: ${item.NombreUsuario || 'No especificado'}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-comment"></i>
                        <span>${truncarTexto(item.ObservacionRetiro, 60)}</span>
                    </div>
                </div>
                
                <div class="card-actions">
                    <button class="btn-card" onclick="verDetalle(${item.IdDespidoRenuncia})">
                        <i class="fas fa-eye"></i> Ver Detalles
                    </button>
                </div>
            </div>
        `;
    });
    
    cardsContainer.innerHTML = html;
}

// ===== MODAL DE DETALLES =====
async function verDetalle(idDespidoRenuncia) {
    try {
        mostrarCargando(true, 'Cargando detalles...');
        
        const registro = filteredData.find(item => item.IdDespidoRenuncia === idDespidoRenuncia);
        
        if (!registro) {
            throw new Error('Registro no encontrado');
        }
        
        // Llenar datos generales
        document.getElementById('detailNombre').textContent = registro.NombrePersonal;
        
        const tipoRetiroBadge = registro.IdEstadoPersonal === 2 ? 
            '<span class="badge badge-despido"><i class="fas fa-user-times"></i> Despido</span>' :
            '<span class="badge badge-renuncia"><i class="fas fa-user-minus"></i> Renuncia</span>';
        document.getElementById('detailTipoRetiro').innerHTML = tipoRetiroBadge;
        
        const estadoBadge = registro.Estado === 1 ? 
            '<span class="badge badge-activo"><i class="fas fa-check-circle"></i> Activo</span>' :
            '<span class="badge badge-invalidado"><i class="fas fa-ban"></i> Invalidado</span>';
        document.getElementById('detailEstado').innerHTML = estadoBadge;
        
        // Llenar datos de fechas
        document.getElementById('detailFechaFin').textContent = formatearFecha(registro.FechaFinColaborador);
        document.getElementById('detailFechaRegistro').textContent = formatearFecha(registro.FechaHoraRegistro, true);
        document.getElementById('detailUsuario').textContent = registro.NombreUsuario || 'No especificado';
        
        // Llenar observaciones
        document.getElementById('detailObservacion').textContent = registro.ObservacionRetiro || 'Sin observaciones registradas';
        
        // Mostrar modal
        detailModal.classList.add('show');
        
        // Ir a la primera tab
        cambiarTab('general');
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('❌ Error al cargar detalles:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar detalles: ' + error.message, 'error');
    }
}

function cambiarTab(tabName) {
    // Desactivar todas las tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activar la tab seleccionada
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.querySelector(`.tab-content[data-tab="${tabName}"]`).classList.add('active');
}

function cerrarModal() {
    detailModal?.classList.remove('show');
}

// ===== CAMBIO DE VISTA =====
function cambiarVista(vista) {
    // Actualizar botones activos
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.view-btn[data-view="${vista}"]`)?.classList.add('active');
    
    // Mostrar/ocultar vistas
    if (vista === 'table') {
        tableView.style.display = 'block';
        cardsView.style.display = 'none';
    } else {
        tableView.style.display = 'none';
        cardsView.style.display = 'block';
    }
    
    // Reiniciar página y mostrar datos
    currentPage = 1;
    mostrarDatos();
}

// ===== PAGINACIÓN =====
function actualizarPaginacion() {
    const totalPages = Math.ceil(filteredData.length / recordsPerPage);
    
    // Actualizar información
    const inicio = Math.min((currentPage - 1) * recordsPerPage + 1, filteredData.length);
    const fin = Math.min(currentPage * recordsPerPage, filteredData.length);
    paginationInfo.textContent = `Mostrando ${inicio}-${fin} de ${filteredData.length} colaboradores`;
    
    // Limpiar controles
    paginationControls.innerHTML = '';
    
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'flex';
    
    // Botón anterior
    const btnPrev = createPageButton('<i class="fas fa-chevron-left"></i>', currentPage - 1, currentPage === 1);
    paginationControls.appendChild(btnPrev);
    
    // Números de página
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    // Primera página si no está visible
    if (startPage > 1) {
        paginationControls.appendChild(createPageButton('1', 1));
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'page-ellipsis';
            paginationControls.appendChild(ellipsis);
        }
    }
    
    // Páginas visibles
    for (let i = startPage; i <= endPage; i++) {
        paginationControls.appendChild(createPageButton(i.toString(), i, false, i === currentPage));
    }
    
    // Última página si no está visible
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'page-ellipsis';
            paginationControls.appendChild(ellipsis);
        }
        paginationControls.appendChild(createPageButton(totalPages.toString(), totalPages));
    }
    
    // Botón siguiente
    const btnNext = createPageButton('<i class="fas fa-chevron-right"></i>', currentPage + 1, currentPage === totalPages);
    paginationControls.appendChild(btnNext);
}

function createPageButton(text, page, disabled = false, active = false) {
    const button = document.createElement('button');
    button.className = `page-btn ${active ? 'active' : ''}`;
    button.innerHTML = text;
    button.disabled = disabled;
    
    if (!disabled) {
        button.addEventListener('click', () => {
            currentPage = page;
            mostrarDatos();
            // Scroll suave al inicio de la tabla
            document.querySelector('.collaborators-panel').scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        });
    }
    
    return button;
}

// ===== FUNCIONES DE CONTROL =====
function limpiarFiltros() {
    fechaDesde.value = '';
    fechaHasta.value = '';
    tipoRetiro.value = '';
    estadoRegistro.value = '';
    searchCollaborator.value = '';
    
    configurarFechasPorDefecto();
    currentPage = 1;
    cargarDatosFiltrados();
    
    mostrarNotificacion('Filtros limpiados correctamente', 'success');
}

function toggleCharts() {
    const sidebar = document.getElementById('chartsSidebar');
    const mainContainer = document.querySelector('.main-container');
    
    if (sidebar.style.display === 'none') {
        sidebar.style.display = 'flex';
        mainContainer.style.gridTemplateColumns = '1fr 350px';
        btnToggleCharts.innerHTML = '<i class="fas fa-chart-pie"></i>';
        btnToggleCharts.title = 'Ocultar gráficos';
    } else {
        sidebar.style.display = 'none';
        mainContainer.style.gridTemplateColumns = '1fr';
        btnToggleCharts.innerHTML = '<i class="fas fa-chart-pie"></i>';
        btnToggleCharts.title = 'Mostrar gráficos';
    }
}

function toggleSidebar() {
    const sidebar = chartsSidebar;
    const icon = btnCollapseSidebar.querySelector('i');
    
    if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        icon.className = 'fas fa-chevron-right';
    } else {
        sidebar.classList.add('collapsed');
        icon.className = 'fas fa-chevron-left';
    }
}

// ===== EXPORTACIÓN =====
async function exportarReporte() {
    try {
        if (filteredData.length === 0) {
            mostrarNotificacion('No hay datos para exportar', 'warning');
            return;
        }
        
        mostrarCargando(true, 'Generando reporte...');
        
        // Preparar datos para exportar
        const datosExport = filteredData.map(item => ({
            'ID': item.IdDespidoRenuncia,
            'Colaborador': item.NombrePersonal,
            'Tipo de Retiro': item.EstadoPersonal,
            'Fecha Fin Laboral': formatearFecha(item.FechaFinColaborador),
            'Observación': item.ObservacionRetiro || 'Sin observaciones',
            'Registrado por': item.NombreUsuario || 'No especificado',
            'Fecha de Registro': formatearFecha(item.FechaHoraRegistro, true),
            'Estado del Registro': item.Estado === 1 ? 'Activo' : 'Invalidado'
        }));
        
        // Crear CSV
        const headers = Object.keys(datosExport[0]);
        const csvContent = [
            headers.join(','),
            ...datosExport.map(row => 
                headers.map(header => {
                    let value = row[header];
                    // Limpiar y escapar el valor
                    if (typeof value === 'string') {
                        value = value.replace(/"/g, '""');
                        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                            value = '"' + value + '"';
                        }
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');
        
        // Crear blob con BOM para UTF-8
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // Crear y descargar archivo
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        
        // Nombre del archivo con fecha y hora
        const ahora = new Date();
        const timestamp = ahora.toISOString().slice(0, 19).replace(/:/g, '-');
        const nombreArchivo = `reporte_bajas_${timestamp}.csv`;
        link.setAttribute('download', nombreArchivo);
        
        // Disparar descarga
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Liberar URL
        URL.revokeObjectURL(url);
        
        mostrarCargando(false);
        mostrarNotificacion(`Reporte exportado: ${nombreArchivo}`, 'success');
        
    } catch (error) {
        console.error('❌ Error al exportar:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al exportar reporte: ' + error.message, 'error');
    }
}

// ===== FUNCIONES DE UTILIDAD =====
function formatearFecha(fecha, incluirHora = false) {
    if (!fecha) return 'No registrada';
    
    try {
        const fechaObj = new Date(fecha);
        const opciones = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };
        
        if (incluirHora) {
            opciones.hour = '2-digit';
            opciones.minute = '2-digit';
            opciones.hour12 = false;
        }
        
        return fechaObj.toLocaleDateString('es-ES', opciones);
    } catch (error) {
        return 'Fecha inválida';
    }
}

function truncarTexto(texto, longitud = 50) {
    if (!texto) return 'Sin información';
    return texto.length > longitud ? texto.substring(0, longitud) + '...' : texto;
}

function generarIniciales(nombreCompleto) {
    if (!nombreCompleto) return '??';
    
    const palabras = nombreCompleto.trim().split(' ');
    if (palabras.length === 1) {
        return palabras[0].substring(0, 2).toUpperCase();
    }
    
    return (palabras[0].charAt(0) + palabras[palabras.length - 1].charAt(0)).toUpperCase();
}

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

// ===== INDICADOR DE CARGA =====
function mostrarCargando(mostrar, mensaje = 'Cargando...') {
    const existingOverlay = document.querySelector('.loading-overlay');
    
    if (mostrar) {
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${mensaje}</div>
        `;
        
        // Estilos inline para el overlay
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(5px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            gap: 1rem;
        `;
        
        loadingOverlay.querySelector('.loading-spinner').style.cssText = `
            width: 40px;
            height: 40px;
            border: 4px solid #e5e7eb;
            border-top: 4px solid #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        `;
        
        loadingOverlay.querySelector('.loading-text').style.cssText = `
            color: #374151;
            font-size: 1rem;
            font-weight: 500;
        `;
        
        // Agregar keyframes para la animación
        if (!document.getElementById('loading-styles')) {
            const style = document.createElement('style');
            style.id = 'loading-styles';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(loadingOverlay);
    } else {
        if (existingOverlay) {
            existingOverlay.style.opacity = '0';
            setTimeout(() => {
                if (existingOverlay.parentNode) {
                    existingOverlay.parentNode.removeChild(existingOverlay);
                }
            }, 300);
        }
    }
}

// ===== SISTEMA DE NOTIFICACIONES =====
function mostrarNotificacion(mensaje, tipo = 'info', duracion = 5000) {
    let toastContainer = document.querySelector('.toast-container-modern');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container-modern';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-modern toast-${tipo}`;
    
    const iconMap = {
        success: 'check-circle',
        error: 'times-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-icon-modern">
            <i class="fas fa-${iconMap[tipo]}"></i>
        </div>
        <div class="toast-content-modern">${mensaje}</div>
        <button class="toast-close-modern">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Manejar cierre manual
    const closeBtn = toast.querySelector('.toast-close-modern');
    closeBtn.addEventListener('click', () => {
        cerrarToast(toast);
    });
    
    // Auto-cierre
    setTimeout(() => {
        if (toast.parentElement) {
            cerrarToast(toast);
        }
    }, duracion);
    
    // Efecto de entrada
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 10);
}

function cerrarToast(toast) {
    toast.classList.add('hiding');
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 300);
}

// ===== FUNCIONES ADICIONALES =====
function imprimirReporte() {
    const printWindow = window.open('', '_blank');
    const fechaHoy = new Date().toLocaleDateString('es-ES');
    
    let filtrosTexto = '';
    if (fechaDesde.value || fechaHasta.value) {
        filtrosTexto += `Período: ${fechaDesde.value || 'Sin límite'} - ${fechaHasta.value || 'Sin límite'}<br>`;
    }
    if (tipoRetiro.value) {
        filtrosTexto += `Tipo: ${tipoRetiro.options[tipoRetiro.selectedIndex].text}<br>`;
    }
    if (estadoRegistro.value !== '') {
        filtrosTexto += `Estado: ${estadoRegistro.options[estadoRegistro.selectedIndex].text}<br>`;
    }
    if (searchCollaborator.value) {
        filtrosTexto += `Búsqueda: "${searchCollaborator.value}"<br>`;
    }
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte de Bajas - ${fechaHoy}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                .filters { margin-bottom: 20px; background: #f5f5f5; padding: 15px; border-radius: 5px; }
                .stats { display: flex; justify-content: space-around; margin-bottom: 20px; }
                .stat { text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                th { background-color: #f5f5f5; font-weight: bold; }
                .badge { padding: 2px 6px; border-radius: 10px; font-size: 10px; }
                .badge-despido { background: #ffebee; color: #c62828; }
                .badge-renuncia { background: #fff8e1; color: #f57c00; }
                .badge-activo { background: #e8f5e8; color: #2e7d32; }
                .badge-invalidado { background: #f5f5f5; color: #616161; }
                .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Reporte de Bajas de Personal</h1>
                <p>Generado el ${fechaHoy} por ${userData?.NombreCompleto || 'Sistema'}</p>
            </div>
            
            ${filtrosTexto ? `<div class="filters"><strong>Filtros aplicados:</strong><br>${filtrosTexto}</div>` : ''}
            
            <div class="stats">
                <div class="stat">
                    <h3>${totalBajas?.textContent || '0'}</h3>
                    <p>Total Bajas</p>
                </div>
                <div class="stat">
                    <h3>${totalDespidos?.textContent || '0'}</h3>
                    <p>Despidos</p>
                </div>
                <div class="stat">
                    <h3>${totalRenuncias?.textContent || '0'}</h3>
                    <p>Renuncias</p>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Colaborador</th>
                        <th>Tipo</th>
                        <th>Fecha Fin</th>
                        <th>Registrado por</th>
                        <th>Fecha Registro</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    filteredData.forEach(item => {
        const fechaFin = formatearFecha(item.FechaFinColaborador);
        const fechaRegistro = formatearFecha(item.FechaHoraRegistro, true);
        
        const tipoClass = item.IdEstadoPersonal === 2 ? 'badge-despido' : 'badge-renuncia';
        const tipoTexto = item.IdEstadoPersonal === 2 ? 'Despido' : 'Renuncia';
        
        const estadoClass = item.Estado === 1 ? 'badge-activo' : 'badge-invalidado';
        const estadoTexto = item.Estado === 1 ? 'Activo' : 'Invalidado';
        
        html += `
            <tr>
                <td>${item.NombrePersonal}</td>
                <td><span class="badge ${tipoClass}">${tipoTexto}</span></td>
                <td>${fechaFin}</td>
                <td>${item.NombreUsuario || 'No especificado'}</td>
                <td>${fechaRegistro}</td>
                <td><span class="badge ${estadoClass}">${estadoTexto}</span></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
            
            <div class="footer">
                <p>Sistema de Recursos Humanos - Reporte generado automáticamente</p>
                <p>Total de registros: ${filteredData.length}</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = function() {
        printWindow.print();
        printWindow.close();
    };
}

function showTooltip(event) {
    // Implementación simple de tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = event.target.getAttribute('title');
    tooltip.style.cssText = `
        position: absolute;
        background: #333;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
    
    event.target._tooltip = tooltip;
}

function hideTooltip(event) {
    if (event.target._tooltip) {
        event.target._tooltip.remove();
        delete event.target._tooltip;
    }
}

// ===== REGISTRO DE FUNCIONES GLOBALES =====
window.verDetalle = verDetalle;
window.imprimirReporte = imprimirReporte;
window.limpiarFiltros = limpiarFiltros;

// ===== MANEJO DE ERRORES GLOBALES =====
window.addEventListener('error', function(e) {
    console.error('❌ Error global:', e.error);
    mostrarNotificacion('Ha ocurrido un error inesperado', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('❌ Promise rechazada:', e.reason);
    mostrarNotificacion('Error en operación asíncrona', 'error');
});

// ===== PREVENIR CIERRE ACCIDENTAL =====
window.addEventListener('beforeunload', function(e) {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        e.preventDefault();
        e.returnValue = 'Hay una operación en curso. ¿Está seguro que desea salir?';
        return e.returnValue;
    }
});