// Variables globales
const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const conexion = 'DSN=recursos2';

// Obtener datos del usuario de localStorage
const userData = JSON.parse(localStorage.getItem('userData'));

// Variables para paginación y filtros
let currentPage = 1;
let recordsPerPage = 10;
let totalRecords = 0;
let allData = [];
let filteredData = [];
let chartTipoRetiro = null;
let chartBajasPorMes = null;

// Referencias a elementos DOM
const fechaDesde = document.getElementById('fechaDesde');
const fechaHasta = document.getElementById('fechaHasta');
const tipoRetiro = document.getElementById('tipoRetiro');
const estadoRegistro = document.getElementById('estadoRegistro');
const btnBuscar = document.getElementById('btnBuscar');
const btnClearFilters = document.getElementById('btnClearFilters');
const btnExportReport = document.getElementById('btnExportReport');

// Elementos de estadísticas
const totalBajas = document.getElementById('totalBajas');
const totalDespidos = document.getElementById('totalDespidos');
const totalRenuncias = document.getElementById('totalRenuncias');
const resultsCount = document.getElementById('resultsCount');

// Elementos de vista
const tableView = document.getElementById('tableView');
const cardsView = document.getElementById('cardsView');
const bajasTableBody = document.getElementById('bajasTableBody');
const cardsContainer = document.getElementById('cardsContainer');
const noDataMessage = document.getElementById('noDataMessage');
const paginationContainer = document.getElementById('paginationContainer');
const paginationInfo = document.getElementById('paginationInfo');
const paginationControls = document.getElementById('paginationControls');

// Modal de detalles
const detailModal = document.getElementById('detailModal');
const closeDetailModal = document.getElementById('closeDetailModal');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    try {
        inicializarEventos();
        configurarFechasPorDefecto();
        cargarDatosIniciales();
    } catch (error) {
        console.error('Error al inicializar:', error);
        mostrarNotificacion('Error al inicializar la página', 'error');
    }
});

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

// Inicializar eventos
function inicializarEventos() {
    // Eventos de filtros
    btnBuscar.addEventListener('click', cargarDatosFiltrados);
    btnClearFilters.addEventListener('click', limpiarFiltros);
    btnExportReport.addEventListener('click', exportarReporte);
    
    // Eventos de vista
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            cambiarVista(this.dataset.view);
        });
    });
    
    // Eventos de modal
    closeDetailModal.addEventListener('click', cerrarModal);
    document.querySelector('.close-modal-btn').addEventListener('click', cerrarModal);
    detailModal.addEventListener('click', function(event) {
        if (event.target === detailModal) {
            cerrarModal();
        }
    });
    
    // Eventos de fechas - auto-búsqueda al cambiar
    fechaDesde.addEventListener('change', function() {
        if (fechaHasta.value && this.value > fechaHasta.value) {
            fechaHasta.value = this.value;
        }
        if (fechaDesde.value && fechaHasta.value) {
            cargarDatosFiltrados();
        }
    });
    
    fechaHasta.addEventListener('change', function() {
        if (fechaDesde.value && this.value < fechaDesde.value) {
            fechaDesde.value = this.value;
        }
        if (fechaDesde.value && fechaHasta.value) {
            cargarDatosFiltrados();
        }
    });
    
    // Auto-búsqueda al cambiar selects
    tipoRetiro.addEventListener('change', cargarDatosFiltrados);
    estadoRegistro.addEventListener('change', cargarDatosFiltrados);
    
    // Tecla Enter en campos de fecha
    [fechaDesde, fechaHasta].forEach(campo => {
        campo.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                cargarDatosFiltrados();
            }
        });
    });
}

// Configurar fechas por defecto (último mes)
function configurarFechasPorDefecto() {
    const hoy = new Date();
    const haceTresMeses = new Date();
    haceTresMeses.setMonth(haceTresMeses.getMonth() - 3);
    
    fechaHasta.value = hoy.toISOString().split('T')[0];
    fechaDesde.value = haceTresMeses.toISOString().split('T')[0];
    
    // Establecer fecha máxima como hoy
    fechaHasta.setAttribute('max', hoy.toISOString().split('T')[0]);
    fechaDesde.setAttribute('max', hoy.toISOString().split('T')[0]);
}

// Cargar datos iniciales
async function cargarDatosIniciales() {
    mostrarCargando(true, 'Cargando reporte de bajas...');
    await cargarDatosFiltrados();
    mostrarCargando(false);
}

// Cargar datos con filtros aplicados
async function cargarDatosFiltrados() {
    try {
        mostrarCargando(true, 'Aplicando filtros...');
        
        const connection = await getConnection();
        
        // Construir consulta con filtros
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
        
        // Filtro de fechas
        if (fechaDesde.value) {
            query += ` AND DATE(dr.FechaFinColaborador) >= ?`;
            params.push(fechaDesde.value);
        }
        
        if (fechaHasta.value) {
            query += ` AND DATE(dr.FechaFinColaborador) <= ?`;
            params.push(fechaHasta.value);
        }
        
        // Filtro de tipo de retiro
        if (tipoRetiro.value) {
            query += ` AND dr.IdEstadoPersonal = ?`;
            params.push(tipoRetiro.value);
        }
        
        // Filtro de estado del registro
        if (estadoRegistro.value !== '') {
            query += ` AND dr.Estado = ?`;
            params.push(estadoRegistro.value);
        }
        
        query += ` ORDER BY dr.FechaHoraRegistro DESC`;
        
        console.log('Ejecutando consulta:', query);
        console.log('Parámetros:', params);
        
        const result = await connection.query(query, params);
        await connection.close();
        
        allData = result;
        filteredData = [...allData];
        totalRecords = filteredData.length;
        
        // Actualizar estadísticas
        actualizarEstadisticas();
        
        // Actualizar gráficos
        actualizarGraficos();
        
        // Mostrar datos
        currentPage = 1;
        mostrarDatos();
        
        mostrarCargando(false);
        
        if (totalRecords === 0) {
            mostrarNotificacion('No se encontraron registros con los filtros aplicados', 'info');
        }
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar datos: ' + error.message, 'error');
    }
}

// Actualizar estadísticas
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

// Animar números en las estadísticas
function animarNumero(elemento, valorFinal) {
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

// Actualizar gráficos
function actualizarGraficos() {
    actualizarGraficoTipoRetiro();
    actualizarGraficoBajasPorMes();
}

// Actualizar gráfico de tipo de retiro
function actualizarGraficoTipoRetiro() {
    const ctx = document.getElementById('chartTipoRetiro').getContext('2d');
    
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
                    'rgba(220, 53, 69, 0.8)',
                    'rgba(255, 193, 7, 0.8)'
                ],
                borderColor: [
                    'rgba(220, 53, 69, 1)',
                    'rgba(255, 193, 7, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Actualizar gráfico de bajas por mes
function actualizarGraficoBajasPorMes() {
    const ctx = document.getElementById('chartBajasPorMes').getContext('2d');
    
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
    
    // Ordenar por fecha
    const mesesOrdenados = Object.keys(datosPorMes).sort();
    const labels = mesesOrdenados.map(mes => {
        const [anio, mesNum] = mes.split('-');
        const nombreMes = new Date(anio, mesNum - 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        return nombreMes;
    });
    
    const despidosData = mesesOrdenados.map(mes => datosPorMes[mes].despidos);
    const renunciasData = mesesOrdenados.map(mes => datosPorMes[mes].renuncias);
    
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
                    backgroundColor: 'rgba(220, 53, 69, 0.8)',
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Renuncias',
                    data: renunciasData,
                    backgroundColor: 'rgba(255, 193, 7, 0.8)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 1
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
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12,
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
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 11
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

// Mostrar datos en la vista actual
function mostrarDatos() {
    const vista = document.querySelector('.view-btn.active').dataset.view;
    
    if (vista === 'table') {
        mostrarVistaTabla();
    } else {
        mostrarVistaTarjetas();
    }
    
    actualizarPaginacion();
}

// Mostrar vista de tabla
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
        const fechaFin = item.FechaFinColaborador ? 
            new Date(item.FechaFinColaborador).toLocaleDateString('es-ES') : 'No registrada';
        
        const fechaRegistro = item.FechaHoraRegistro ? 
            new Date(item.FechaHoraRegistro).toLocaleString('es-ES') : 'No registrada';
        
        const tipoRetiroBadge = item.IdEstadoPersonal === 2 ? 
            '<span class="badge badge-despido"><i class="fas fa-user-times"></i> Despido</span>' :
            '<span class="badge badge-renuncia"><i class="fas fa-user-minus"></i> Renuncia</span>';
        
        const estadoBadge = item.Estado === 1 ? 
            '<span class="badge badge-activo"><i class="fas fa-check-circle"></i> Activo</span>' :
            '<span class="badge badge-invalidado"><i class="fas fa-ban"></i> Invalidado</span>';
        
        html += `
            <tr>
                <td data-label="Colaborador">${item.NombrePersonal}</td>
                <td data-label="Tipo de Retiro">${tipoRetiroBadge}</td>
                <td data-label="Fecha Fin Laboral">${fechaFin}</td>
                <td data-label="Fecha Registro">${fechaRegistro}</td>
                <td data-label="Registrado por">${item.NombreUsuario}</td>
                <td data-label="Estado">${estadoBadge}</td>
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

// Mostrar vista de tarjetas
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
        const fechaFin = item.FechaFinColaborador ? 
            new Date(item.FechaFinColaborador).toLocaleDateString('es-ES') : 'No registrada';
        
        const fechaRegistro = item.FechaHoraRegistro ? 
            new Date(item.FechaHoraRegistro).toLocaleString('es-ES') : 'No registrada';
        
        const tipoClass = item.IdEstadoPersonal === 2 ? 'despido' : 'renuncia';
        const tipoTexto = item.IdEstadoPersonal === 2 ? 'Despido' : 'Renuncia';
        const tipoIcon = item.IdEstadoPersonal === 2 ? 'fa-user-times' : 'fa-user-minus';
        
        const estadoIcon = item.Estado === 1 ? 'fa-check-circle' : 'fa-ban';
        const estadoTexto = item.Estado === 1 ? 'Activo' : 'Invalidado';
        const estadoClass = item.Estado === 1 ? 'badge-activo' : 'badge-invalidado';
        
        html += `
            <div class="baja-card ${tipoClass}">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${item.NombrePersonal}</h3>
                        <span class="badge badge-${tipoClass}">
                            <i class="fas ${tipoIcon}"></i> ${tipoTexto}
                        </span>
                    </div>
                    <span class="badge ${estadoClass}">
                        <i class="fas ${estadoIcon}"></i> ${estadoTexto}
                    </span>
                </div>
                
                <div class="card-info">
                    <div class="info-item">
                        <i class="fas fa-calendar"></i>
                        <span>Fecha Fin: ${fechaFin}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-clock"></i>
                        <span>Registrado: ${fechaRegistro}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-user-tie"></i>
                        <span>Por: ${item.NombreUsuario}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-comment"></i>
                        <span>${item.ObservacionRetiro ? item.ObservacionRetiro.substring(0, 50) + '...' : 'Sin observaciones'}</span>
                    </div>
                </div>
                
                <div class="card-actions">
                    <button class="btn btn-primary btn-sm" onclick="verDetalle(${item.IdDespidoRenuncia})">
                        <i class="fas fa-eye"></i> Ver Detalles
                    </button>
                </div>
            </div>
        `;
    });
    
    cardsContainer.innerHTML = html;
}

// Ver detalle de una baja
async function verDetalle(idDespidoRenuncia) {
    try {
        mostrarCargando(true, 'Cargando detalles...');
        
        const registro = filteredData.find(item => item.IdDespidoRenuncia === idDespidoRenuncia);
        
        if (!registro) {
            throw new Error('Registro no encontrado');
        }
        
        // Llenar modal con datos
        document.getElementById('detailNombre').textContent = registro.NombrePersonal;
        
        const tipoRetiroBadge = registro.IdEstadoPersonal === 2 ? 
            '<span class="badge badge-despido"><i class="fas fa-user-times"></i> Despido</span>' :
            '<span class="badge badge-renuncia"><i class="fas fa-user-minus"></i> Renuncia</span>';
        document.getElementById('detailTipoRetiro').innerHTML = tipoRetiroBadge;
        
        document.getElementById('detailFechaFin').textContent = registro.FechaFinColaborador ? 
            new Date(registro.FechaFinColaborador).toLocaleDateString('es-ES') : 'No registrada';
        
        document.getElementById('detailFechaRegistro').textContent = registro.FechaHoraRegistro ? 
            new Date(registro.FechaHoraRegistro).toLocaleString('es-ES') : 'No registrada';
        
        document.getElementById('detailObservacion').textContent = registro.ObservacionRetiro || 'Sin observaciones';
        document.getElementById('detailUsuario').textContent = registro.NombreUsuario || 'No registrado';
        
        const estadoBadge = registro.Estado === 1 ? 
            '<span class="badge badge-activo"><i class="fas fa-check-circle"></i> Activo</span>' :
            '<span class="badge badge-invalidado"><i class="fas fa-ban"></i> Invalidado</span>';
        document.getElementById('detailEstado').innerHTML = estadoBadge;
        
        
        // Mostrar modal
        detailModal.classList.add('show');
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar detalles:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al cargar detalles: ' + error.message, 'error');
    }
}

// Cerrar modal
function cerrarModal() {
    detailModal.classList.remove('show');
}

// Cambiar vista (tabla/tarjetas)
function cambiarVista(vista) {
    // Actualizar botones activos
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.view-btn[data-view="${vista}"]`).classList.add('active');
    
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

// Actualizar paginación
function actualizarPaginacion() {
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    
    // Actualizar información
    const inicio = (currentPage - 1) * recordsPerPage + 1;
    const fin = Math.min(currentPage * recordsPerPage, totalRecords);
    paginationInfo.textContent = `Mostrando ${inicio}-${fin} de ${totalRecords} registros`;
    
    // Limpiar controles
    paginationControls.innerHTML = '';
    
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'flex';
    
    // Botón anterior
    const btnPrev = document.createElement('button');
    btnPrev.className = 'page-btn';
    btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    btnPrev.disabled = currentPage === 1;
    btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            mostrarDatos();
        }
    });
    paginationControls.appendChild(btnPrev);
    
    // Números de página
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            mostrarDatos();
        });
        paginationControls.appendChild(pageBtn);
    }
    
    // Botón siguiente
    const btnNext = document.createElement('button');
    btnNext.className = 'page-btn';
    btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
    btnNext.disabled = currentPage === totalPages;
    btnNext.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            mostrarDatos();
        }
    });
    paginationControls.appendChild(btnNext);
}

// Limpiar filtros
function limpiarFiltros() {
    fechaDesde.value = '';
    fechaHasta.value = '';
    tipoRetiro.value = '';
    estadoRegistro.value = '';
    
    configurarFechasPorDefecto();
    cargarDatosFiltrados();
    
    mostrarNotificacion('Filtros limpiados', 'info');
}

// Exportar reporte
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
            'Fecha Fin Laboral': item.FechaFinColaborador ? 
                new Date(item.FechaFinColaborador).toLocaleDateString('es-ES') : 'No registrada',
            'Observación': item.ObservacionRetiro || 'Sin observaciones',
            'Registrado por': item.NombreUsuario,
            'Fecha de Registro': item.FechaHoraRegistro ? 
                new Date(item.FechaHoraRegistro).toLocaleString('es-ES') : 'No registrada',
            'Estado del Registro': item.Estado === 1 ? 'Activo' : 'Invalidado',
            'Fecha Invalidación': item.FechaInvalidacion ? 
                new Date(item.FechaInvalidacion).toLocaleString('es-ES') : ''
        }));
        
        // Crear CSV
        const headers = Object.keys(datosExport[0]);
        const csvContent = [
            headers.join(','),
            ...datosExport.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Escapar comillas y envolver en comillas si contiene coma o salto de línea
                    if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
                        return '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');
        
        // Crear y descargar archivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        
        // Nombre del archivo con fecha
        const fechaHoy = new Date().toISOString().split('T')[0];
        const nombreArchivo = `reporte_bajas_${fechaHoy}.csv`;
        link.setAttribute('download', nombreArchivo);
        
        // Disparar descarga
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        mostrarCargando(false);
        mostrarNotificacion(`Reporte exportado: ${nombreArchivo}`, 'success');
        
    } catch (error) {
        console.error('Error al exportar:', error);
        mostrarCargando(false);
        mostrarNotificacion('Error al exportar reporte: ' + error.message, 'error');
    }
}

// Mostrar/ocultar indicador de carga
function mostrarCargando(mostrar, mensaje = 'Cargando...') {
    if (mostrar) {
        const existingOverlay = document.querySelector('.loading-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner-large"></div>
            <div class="loading-text">${mensaje}</div>
        `;
        document.body.appendChild(loadingOverlay);
    } else {
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                if (loadingOverlay.parentNode) {
                    loadingOverlay.parentNode.removeChild(loadingOverlay);
                }
            }, 300);
        }
    }
}

// Sistema de notificaciones toast
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
        }, 400);
    });
    
    // Auto-cierre después de 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 400);
        }
    }, 5000);
}

// Funciones para búsqueda en tiempo real
function configurarBusquedaEnTiempoReal() {
    let searchTimeout;
    
    // Función de búsqueda con debounce
    function buscarConDebounce() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            cargarDatosFiltrados();
        }, 300);
    }
    
    // Aplicar a todos los filtros
    [fechaDesde, fechaHasta, tipoRetiro, estadoRegistro].forEach(elemento => {
        elemento.addEventListener('input', buscarConDebounce);
        elemento.addEventListener('change', buscarConDebounce);
    });
}

// Funciones de utilidad
function formatearFecha(fecha, incluirHora = false) {
    if (!fecha) return 'No registrada';
    
    const opciones = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    
    if (incluirHora) {
        opciones.hour = '2-digit';
        opciones.minute = '2-digit';
        opciones.second = '2-digit';
    }
    
    return new Date(fecha).toLocaleDateString('es-ES', opciones);
}

function truncarTexto(texto, longitud = 50) {
    if (!texto) return 'Sin información';
    return texto.length > longitud ? texto.substring(0, longitud) + '...' : texto;
}

// Función para actualizar contadores en tiempo real
function actualizarContadoresEnTiempoReal() {
    const intervalo = setInterval(() => {
        // Solo actualizar si la página está visible
        if (!document.hidden) {
            cargarDatosFiltrados();
        }
    }, 60000); // Actualizar cada minuto
    
    // Limpiar intervalo cuando se cierre la página
    window.addEventListener('beforeunload', () => {
        clearInterval(intervalo);
    });
}

// Configurar atajos de teclado
function configurarAtajosTeclado() {
    document.addEventListener('keydown', function(e) {
        // Ctrl + F para enfocar en filtros
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            fechaDesde.focus();
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
        
        // Escape para cerrar modal
        if (e.key === 'Escape') {
            cerrarModal();
        }
        
        // Teclas de navegación en paginación
        if (e.ctrlKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                mostrarDatos();
            }
        }
        
        if (e.ctrlKey && e.key === 'ArrowRight') {
            e.preventDefault();
            const totalPages = Math.ceil(totalRecords / recordsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                mostrarDatos();
            }
        }
    });
}

// Función para imprimir reporte
function imprimirReporte() {
    // Crear ventana de impresión con estilos específicos
    const printWindow = window.open('', '_blank');
    const fechaHoy = new Date().toLocaleDateString('es-ES');
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte de Bajas - ${fechaHoy}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                .filters { margin-bottom: 20px; background: #f5f5f5; padding: 15px; border-radius: 5px; }
                .stats { display: flex; justify-content: space-around; margin-bottom: 20px; }
                .stat { text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; font-weight: bold; }
                .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
                .badge-despido { background: #ffebee; color: #c62828; }
                .badge-renuncia { background: #fff8e1; color: #f57c00; }
                .badge-activo { background: #e8f5e8; color: #2e7d32; }
                .badge-invalidado { background: #f5f5f5; color: #616161; }
                .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Reporte de Bajas de Personal</h1>
                <p>Generado el ${fechaHoy} por ${userData.NombreCompleto}</p>
            </div>
            
            <div class="filters">
                <strong>Filtros aplicados:</strong><br>
                Período: ${fechaDesde.value || 'Sin límite'} - ${fechaHasta.value || 'Sin límite'}<br>
                Tipo de retiro: ${tipoRetiro.value ? tipoRetiro.options[tipoRetiro.selectedIndex].text : 'Todos'}<br>
                Estado: ${estadoRegistro.value !== '' ? estadoRegistro.options[estadoRegistro.selectedIndex].text : 'Todos'}
            </div>
            
            <div class="stats">
                <div class="stat">
                    <h3>${totalBajas.textContent}</h3>
                    <p>Total Bajas</p>
                </div>
                <div class="stat">
                    <h3>${totalDespidos.textContent}</h3>
                    <p>Despidos</p>
                </div>
                <div class="stat">
                    <h3>${totalRenuncias.textContent}</h3>
                    <p>Renuncias</p>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Colaborador</th>
                        <th>Tipo de Retiro</th>
                        <th>Fecha Fin Laboral</th>
                        <th>Fecha Registro</th>
                        <th>Registrado por</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    filteredData.forEach(item => {
        const fechaFin = item.FechaFinColaborador ? 
            new Date(item.FechaFinColaborador).toLocaleDateString('es-ES') : 'No registrada';
        const fechaRegistro = item.FechaHoraRegistro ? 
            new Date(item.FechaHoraRegistro).toLocaleString('es-ES') : 'No registrada';
        
        const tipoClass = item.IdEstadoPersonal === 2 ? 'badge-despido' : 'badge-renuncia';
        const tipoTexto = item.IdEstadoPersonal === 2 ? 'Despido' : 'Renuncia';
        
        const estadoClass = item.Estado === 1 ? 'badge-activo' : 'badge-invalidado';
        const estadoTexto = item.Estado === 1 ? 'Activo' : 'Invalidado';
        
        html += `
            <tr>
                <td>${item.NombrePersonal}</td>
                <td><span class="badge ${tipoClass}">${tipoTexto}</span></td>
                <td>${fechaFin}</td>
                <td>${fechaRegistro}</td>
                <td>${item.NombreUsuario}</td>
                <td><span class="badge ${estadoClass}">${estadoTexto}</span></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
            
            <div class="footer">
                <p>Sistema de Recursos Humanos - Reporte generado automáticamente</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Esperar a que se cargue el contenido y luego imprimir
    printWindow.onload = function() {
        printWindow.print();
        printWindow.close();
    };
}

// Registrar funciones globales para uso en HTML
window.verDetalle = verDetalle;
window.imprimirReporte = imprimirReporte;

// Inicializar funcionalidades adicionales cuando la página esté lista
document.addEventListener('DOMContentLoaded', function() {
    // Configurar búsqueda en tiempo real
    configurarBusquedaEnTiempoReal();
    
    // Configurar atajos de teclado
    configurarAtajosTeclado();
    
    // Configurar actualización automática
    actualizarContadoresEnTiempoReal();
    
    // Agregar botón de impresión
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-secondary btn-sm';
    printBtn.innerHTML = '<i class="fas fa-print"></i> Imprimir';
    printBtn.addEventListener('click', imprimirReporte);
    
    // Agregar al panel de acciones
    const panelActions = document.querySelector('.panel-actions');
    if (panelActions) {
        panelActions.insertBefore(printBtn, btnExportReport);
    }
    
    console.log('Reporte de Bajas inicializado correctamente');
});

// Manejo de errores globales
window.addEventListener('error', function(e) {
    console.error('Error global:', e.error);
    mostrarNotificacion('Ha ocurrido un error inesperado', 'error');
});

// Prevenir cierre accidental
window.addEventListener('beforeunload', function(e) {
    // Solo prevenir si hay algún proceso en curso
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        e.preventDefault();
        e.returnValue = '';
        return 'Hay un proceso en curso. ¿Está seguro que desea salir?';
    }
});