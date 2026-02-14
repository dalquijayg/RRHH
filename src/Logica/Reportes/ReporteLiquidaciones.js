// ===== VARIABLES GLOBALES =====
const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const conexion = 'DSN=recursos2';

// Datos del usuario
const userData = JSON.parse(localStorage.getItem('userData'));

// Variables de estado
let currentPage = 1;
let recordsPerPage = 100;
let allData = [];
let filteredData = [];
let searchTimeout = null;
let datosCargados = false;

// Variables de ordenamiento
let currentSortColumn = 'FechaHoraRegistro';
let currentSortDirection = 'desc';

// Referencias DOM - Filtros
const fechaDesde = document.getElementById('fechaDesde');
const fechaHasta = document.getElementById('fechaHasta');
const tipoLiquidacion = document.getElementById('tipoLiquidacion');
const estadoLiquidacion = document.getElementById('estadoLiquidacion');
const searchInput = document.getElementById('searchInput');

// Referencias DOM - Botones
const btnBuscar = document.getElementById('btnBuscar');
const btnClearFilters = document.getElementById('btnClearFilters');

// Referencias DOM - Estadisticas
const totalLiquidacionesEl = document.getElementById('totalLiquidaciones');
const totalParcialesEl = document.getElementById('totalParciales');
const totalDespidosEl = document.getElementById('totalDespidos');
const totalRenunciasEl = document.getElementById('totalRenuncias');
const resultsCount = document.getElementById('resultsCount');

// Referencias DOM - Tabla
const liquidacionesTableBody = document.getElementById('liquidacionesTableBody');
const emptyState = document.getElementById('emptyState');
const noDataMessage = document.getElementById('noDataMessage');

// Referencias DOM - Paginacion
const paginationContainer = document.getElementById('paginationContainer');
const paginationInfo = document.getElementById('paginationInfo');
const paginationControls = document.getElementById('paginationControls');

// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', function() {
    try {
        console.log('Inicializando Reporte de Liquidaciones...');
        inicializarEventos();
        configurarFechasPorDefecto();
        console.log('Reporte de Liquidaciones inicializado correctamente');
    } catch (error) {
        console.error('Error al inicializar:', error);
        mostrarNotificacion('Error al inicializar la aplicacion', 'error');
    }
});

// ===== CONEXION BASE DE DATOS =====
async function getConnection() {
    try {
        const connection = await odbc.connect(conexion);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error de conexion:', error);
        mostrarNotificacion('Error de conexion a la base de datos', 'error');
        throw error;
    }
}

// ===== CONFIGURACION DE EVENTOS =====
function inicializarEventos() {
    // Boton buscar
    btnBuscar?.addEventListener('click', () => {
        currentPage = 1;
        cargarDatosFiltrados();
    });

    // Limpiar y exportar
    btnClearFilters?.addEventListener('click', limpiarFiltros);

    // Busqueda en tiempo real (solo filtra datos ya cargados)
    searchInput?.addEventListener('input', handleSearch);

    // Eventos de ordenamiento en encabezados de tabla
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', function() {
            if (!datosCargados) return;
            const column = this.dataset.column;
            const type = this.dataset.type;
            handleSort(column, type, this);
        });
    });

    // Teclas de acceso rapido
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ===== MANEJADORES DE EVENTOS =====
function handleSearch(e) {
    if (!datosCargados) return;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        filtrarDatosPorBusqueda(e.target.value);
    }, 300);
}

function handleKeyboardShortcuts(e) {
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInput?.focus();
    }

    if (e.key === 'Enter' && !datosCargados) {
        cargarDatosFiltrados();
    }

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

// ===== ORDENAMIENTO =====
function handleSort(column, type, thElement) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    // Actualizar clases visuales
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.className = 'fas fa-sort sort-icon';
    });

    thElement.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    const sortIcon = thElement.querySelector('.sort-icon');
    if (sortIcon) {
        sortIcon.className = currentSortDirection === 'asc'
            ? 'fas fa-sort-up sort-icon'
            : 'fas fa-sort-down sort-icon';
    }

    // Ordenar datos
    filteredData.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        if (valA == null && valB == null) return 0;
        if (valA == null) return currentSortDirection === 'asc' ? -1 : 1;
        if (valB == null) return currentSortDirection === 'asc' ? 1 : -1;

        if (type === 'number') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        } else if (type === 'date') {
            valA = new Date(valA).getTime() || 0;
            valB = new Date(valB).getTime() || 0;
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        }
    });

    currentPage = 1;
    mostrarDatos();
}

// ===== CONFIGURACION INICIAL =====
function configurarFechasPorDefecto() {
    const hoy = new Date();
    const haceTresMeses = new Date();
    haceTresMeses.setMonth(haceTresMeses.getMonth() - 3);

    fechaHasta.value = hoy.toISOString().split('T')[0];
    fechaDesde.value = haceTresMeses.toISOString().split('T')[0];

    const maxDate = hoy.toISOString().split('T')[0];
    fechaHasta.setAttribute('max', maxDate);
    fechaDesde.setAttribute('max', maxDate);
}

// ===== CARGA Y FILTRADO DE DATOS =====
async function cargarDatosFiltrados() {
    try {
        // Validar fechas
        if (fechaDesde.value && fechaHasta.value && fechaDesde.value > fechaHasta.value) {
            const fechaTemp = fechaHasta.value;
            fechaHasta.value = fechaDesde.value;
            fechaDesde.value = fechaTemp;
            mostrarNotificacion('Fechas corregidas automaticamente', 'info');
        }

        mostrarCargando(true, 'Buscando liquidaciones...');

        const connection = await getConnection();

        let query = `
            SELECT
                Liquidaciones.IdLiquidacion,
                Liquidaciones.NombrePersonal,
                Liquidaciones.FechaPlanilla,
                Liquidaciones.FechaFin,
                Liquidaciones.SalarioDiario,
                Liquidaciones.SalarioBase,
                Liquidaciones.DiasIndemnizacion,
                Liquidaciones.MontoIndemnizacion,
                Liquidaciones.DiasAguinaldo,
                Liquidaciones.MontoAguinaldo,
                Liquidaciones.DiasVacaciones,
                Liquidaciones.MontoVacaciones,
                Liquidaciones.DiasBono14,
                Liquidaciones.MontoBono14,
                Liquidaciones.NombreUsuario,
                Liquidaciones.FechaHoraRegistro,
                Liquidaciones.Observaciones,
                Liquidaciones.NoVale,
                Liquidaciones.DescuentoInterno,
                Liquidaciones.NombreUsuarioAutoriza,
                Liquidaciones.FechaHoraAutoriza,
                Liquidaciones.MotivoRechazo,
                Liquidaciones.Estado,
                Liquidaciones.TipoLiquidacion AS IdTipoLiquidacion,
                EstadoLiquidacion.EstadoLiquidacion,
                TipoLiquidacion.TipoLiquidacion,
                CASE
                    WHEN Liquidaciones.IndemnizacionSiNo = 1 THEN 'Si aplica'
                    WHEN Liquidaciones.IndemnizacionSiNo = 0 THEN 'No aplica'
                    ELSE 'No definido'
                END AS IndemnizacionAplica
            FROM
                Liquidaciones
                INNER JOIN EstadoLiquidacion
                    ON Liquidaciones.Estado = EstadoLiquidacion.IdEstadoLiquidacion
                INNER JOIN TipoLiquidacion
                    ON Liquidaciones.TipoLiquidacion = TipoLiquidacion.IdTipoLiquidacion
            WHERE 1=1
        `;

        const params = [];

        if (fechaDesde.value) {
            query += ` AND DATE(Liquidaciones.FechaHoraRegistro) >= ?`;
            params.push(fechaDesde.value);
        }

        if (fechaHasta.value) {
            query += ` AND DATE(Liquidaciones.FechaHoraRegistro) <= ?`;
            params.push(fechaHasta.value);
        }

        if (tipoLiquidacion.value) {
            query += ` AND Liquidaciones.TipoLiquidacion = ?`;
            params.push(tipoLiquidacion.value);
        }

        if (estadoLiquidacion.value !== '') {
            query += ` AND Liquidaciones.Estado = ?`;
            params.push(estadoLiquidacion.value);
        }

        query += ` ORDER BY Liquidaciones.FechaHoraRegistro DESC`;

        const result = await connection.query(query, params);
        await connection.close();

        allData = result || [];
        filteredData = [...allData];
        datosCargados = true;

        // Aplicar busqueda de texto si existe
        if (searchInput?.value) {
            filtrarDatosPorBusqueda(searchInput.value);
        }

        // Ocultar estado inicial
        emptyState.style.display = 'none';

        actualizarEstadisticas();
        currentPage = 1;
        mostrarDatos();

        mostrarCargando(false);

        if (filteredData.length > 0) {
            mostrarNotificacion(`Se encontraron ${filteredData.length} registros`, 'success');
        }

    } catch (error) {
        console.error('Error al cargar datos:', error);
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
            item.NombreUsuario?.toLowerCase().includes(terminoLower) ||
            item.TipoLiquidacion?.toLowerCase().includes(terminoLower) ||
            item.EstadoLiquidacion?.toLowerCase().includes(terminoLower) ||
            item.Observaciones?.toLowerCase().includes(terminoLower) ||
            item.NombreUsuarioAutoriza?.toLowerCase().includes(terminoLower) ||
            String(item.IdLiquidacion).includes(terminoLower)
        );
    }

    currentPage = 1;
    actualizarEstadisticas();
    mostrarDatos();
}

// ===== ESTADISTICAS =====
function actualizarEstadisticas() {
    const stats = {
        total: filteredData.length,
        parciales: filteredData.filter(item => item.IdTipoLiquidacion == 1).length,
        despidos: filteredData.filter(item => item.IdTipoLiquidacion == 2).length,
        renuncias: filteredData.filter(item => item.IdTipoLiquidacion == 3).length
    };

    animarNumero(totalLiquidacionesEl, stats.total);
    animarNumero(totalParcialesEl, stats.parciales);
    animarNumero(totalDespidosEl, stats.despidos);
    animarNumero(totalRenunciasEl, stats.renuncias);

    resultsCount.textContent = `(${stats.total} registros)`;
}

function animarNumero(elemento, valorFinal) {
    if (!elemento) return;

    const valorInicial = parseInt(elemento.textContent) || 0;
    const duracion = 800;
    const pasos = 25;
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

// ===== VISUALIZACION DE DATOS =====
function mostrarDatos() {
    mostrarVistaTabla();
    actualizarPaginacion();
}

function mostrarVistaTabla() {
    if (filteredData.length === 0) {
        liquidacionesTableBody.innerHTML = '';
        if (datosCargados) {
            noDataMessage.style.display = 'flex';
        }
        return;
    }

    noDataMessage.style.display = 'none';

    const inicio = (currentPage - 1) * recordsPerPage;
    const fin = inicio + recordsPerPage;
    const datosPage = filteredData.slice(inicio, fin);

    let html = '';

    datosPage.forEach(item => {
        const tipoBadge = obtenerBadgeTipo(item.IdTipoLiquidacion, item.TipoLiquidacion);
        const estadoBadge = obtenerBadgeEstado(item.Estado, item.EstadoLiquidacion);

        html += `
            <tr>
                <td data-label="ID" style="text-align:center; font-weight:600; color:var(--gray-500);">${item.IdLiquidacion}</td>
                <td data-label="Colaborador" class="col-nombre">${item.NombrePersonal || '-'}</td>
                <td data-label="Tipo">${tipoBadge}</td>
                <td data-label="Estado">${estadoBadge}</td>
                <td data-label="Fecha Planilla">${formatearFecha(item.FechaPlanilla)}</td>
                <td data-label="Fecha Fin">${formatearFecha(item.FechaFin)}</td>
                <td data-label="Salario Base" style="text-align:right;">${formatearMonto(item.SalarioBase)}</td>
                <td data-label="Indemnizacion">
                    <span class="badge ${item.IndemnizacionAplica === 'Si aplica' ? 'badge-autorizada' : 'badge-anulado'}">
                        ${item.IndemnizacionAplica}
                    </span>
                </td>
                <td data-label="Monto Indem." style="text-align:right;">${formatearMonto(item.MontoIndemnizacion)}</td>
                <td data-label="Aguinaldo" style="text-align:right;">${formatearMonto(item.MontoAguinaldo)}</td>
                <td data-label="Vacaciones" style="text-align:right;">${formatearMonto(item.MontoVacaciones)}</td>
                <td data-label="Bono 14" style="text-align:right;">${formatearMonto(item.MontoBono14)}</td>
                <td data-label="Descuento" style="text-align:right;">${formatearMonto(item.DescuentoInterno)}</td>
                <td data-label="No. Vale">${item.NoVale || '-'}</td>
                <td data-label="Registrado por">${item.NombreUsuario || '-'}</td>
                <td data-label="Fecha Registro">${formatearFecha(item.FechaHoraRegistro, true)}</td>
                <td data-label="Autorizado por">${item.NombreUsuarioAutoriza || '-'}</td>
            </tr>
        `;
    });

    liquidacionesTableBody.innerHTML = html;
}

function obtenerBadgeTipo(idTipo, textoTipo) {
    const clases = {
        1: 'badge-parcial',
        2: 'badge-despido',
        3: 'badge-renuncia'
    };
    const iconos = {
        1: 'fa-file-invoice',
        2: 'fa-user-times',
        3: 'fa-user-minus'
    };
    const clase = clases[idTipo] || 'badge-parcial';
    const icono = iconos[idTipo] || 'fa-file';
    return `<span class="badge ${clase}"><i class="fas ${icono}"></i> ${textoTipo || 'N/A'}</span>`;
}

function obtenerBadgeEstado(idEstado, textoEstado) {
    const clases = {
        0: 'badge-por-autorizar',
        1: 'badge-autorizada',
        2: 'badge-anulado',
        3: 'badge-doc-generado'
    };
    const iconos = {
        0: 'fa-clock',
        1: 'fa-check-circle',
        2: 'fa-ban',
        3: 'fa-file-pdf'
    };
    const clase = clases[idEstado] || 'badge-por-autorizar';
    const icono = iconos[idEstado] || 'fa-question-circle';
    return `<span class="badge ${clase}"><i class="fas ${icono}"></i> ${textoEstado || 'N/A'}</span>`;
}

// ===== PAGINACION =====
function actualizarPaginacion() {
    const totalPages = Math.ceil(filteredData.length / recordsPerPage);

    const inicio = Math.min((currentPage - 1) * recordsPerPage + 1, filteredData.length);
    const fin = Math.min(currentPage * recordsPerPage, filteredData.length);
    paginationInfo.textContent = `Mostrando ${filteredData.length === 0 ? 0 : inicio}-${fin} de ${filteredData.length} registros`;

    paginationControls.innerHTML = '';

    if (totalPages <= 1) {
        paginationContainer.style.display = filteredData.length > 0 ? 'flex' : 'none';
        return;
    }

    paginationContainer.style.display = 'flex';

    const btnPrev = createPageButton('<i class="fas fa-chevron-left"></i>', currentPage - 1, currentPage === 1);
    paginationControls.appendChild(btnPrev);

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        paginationControls.appendChild(createPageButton('1', 1));
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'page-ellipsis';
            paginationControls.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationControls.appendChild(createPageButton(i.toString(), i, false, i === currentPage));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'page-ellipsis';
            paginationControls.appendChild(ellipsis);
        }
        paginationControls.appendChild(createPageButton(totalPages.toString(), totalPages));
    }

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
        });
    }

    return button;
}

// ===== FUNCIONES DE CONTROL =====
function limpiarFiltros() {
    fechaDesde.value = '';
    fechaHasta.value = '';
    tipoLiquidacion.value = '';
    estadoLiquidacion.value = '';
    searchInput.value = '';

    // Resetear ordenamiento visual
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.className = 'fas fa-sort sort-icon';
    });
    currentSortColumn = 'FechaHoraRegistro';
    currentSortDirection = 'desc';

    // Resetear datos y volver al estado inicial
    allData = [];
    filteredData = [];
    datosCargados = false;
    liquidacionesTableBody.innerHTML = '';
    noDataMessage.style.display = 'none';
    emptyState.style.display = 'flex';
    paginationContainer.style.display = 'none';

    // Resetear estadisticas
    if (totalLiquidacionesEl) totalLiquidacionesEl.textContent = '0';
    if (totalParcialesEl) totalParcialesEl.textContent = '0';
    if (totalDespidosEl) totalDespidosEl.textContent = '0';
    if (totalRenunciasEl) totalRenunciasEl.textContent = '0';
    resultsCount.textContent = '(0 registros)';

    configurarFechasPorDefecto();

    mostrarNotificacion('Filtros limpiados correctamente', 'success');
}

// ===== FUNCIONES DE UTILIDAD =====
function formatearFecha(fecha, incluirHora = false) {
    if (!fecha) return '-';

    try {
        const fechaStr = String(fecha);
        const fechaObj = new Date(fecha);
        if (isNaN(fechaObj.getTime())) return '-';

        // Para fechas con hora (datetime), usar hora local como estaba
        if (incluirHora) {
            const dia = String(fechaObj.getDate()).padStart(2, '0');
            const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anio = fechaObj.getFullYear();
            const hora = String(fechaObj.getHours()).padStart(2, '0');
            const minuto = String(fechaObj.getMinutes()).padStart(2, '0');
            return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
        }

        // Para fechas sin hora, extraer directamente del string si es formato ISO
        if (fechaStr.includes('-') && fechaStr.length >= 10) {
            const partes = fechaStr.substring(0, 10).split('-');
            if (partes.length === 3) {
                return `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
        }

        // Fallback: usar UTC
        const dia = String(fechaObj.getUTCDate()).padStart(2, '0');
        const mes = String(fechaObj.getUTCMonth() + 1).padStart(2, '0');
        const anio = fechaObj.getUTCFullYear();
        return `${dia}/${mes}/${anio}`;
    } catch (error) {
        return '-';
    }
}

function formatearMonto(monto) {
    if (monto == null || monto === '') return 'Q 0.00';

    const numero = parseFloat(monto);
    if (isNaN(numero)) return 'Q 0.00';

    const formatted = numero.toLocaleString('es-GT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    if (numero > 0) {
        return `<span class="monto-positivo">Q ${formatted}</span>`;
    } else if (numero < 0) {
        return `<span class="monto-negativo">Q ${formatted}</span>`;
    }
    return `<span class="monto-cero">Q ${formatted}</span>`;
}

// ===== INDICADOR DE CARGA =====
function mostrarCargando(mostrar, mensaje = 'Cargando...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');

    if (mostrar) {
        if (text) text.textContent = mensaje;
        if (overlay) overlay.style.display = 'flex';
    } else {
        if (overlay) overlay.style.display = 'none';
    }
}

// ===== NOTIFICACIONES TOAST =====
function mostrarNotificacion(mensaje, tipo = 'info') {
    const container = document.querySelector('.toast-container-modern');
    if (!container) return;

    const iconos = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast-modern toast-${tipo}`;
    toast.innerHTML = `
        <div class="toast-icon-modern">
            <i class="fas ${iconos[tipo] || iconos.info}"></i>
        </div>
        <div class="toast-content-modern">${mensaje}</div>
        <button class="toast-close-modern" onclick="this.parentElement.classList.add('hiding'); setTimeout(() => this.parentElement.remove(), 300);">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}
