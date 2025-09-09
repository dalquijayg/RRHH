const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const Swal = require('sweetalert2');
const { ipcRenderer } = require('electron');

// Variables globales
let datosCompletos = [];
let datosFiltrados = [];
let ordenActual = { columna: null, direccion: 'asc' };
let paginaActual = 1;
let registrosPorPagina = 10;
let totalPaginas = 0;

// Inicialización cuando se carga el DOM
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarPagina();
    configurarEventListeners();
    establecerFechaActual();
});

// Función principal de inicialización
async function inicializarPagina() {
    try {
        // Cargar información del usuario desde localStorage
        cargarInfoUsuario();
        
        // Cargar departamentos
        await cargarDepartamentos();
        
        // Configurar fecha por defecto (hoy)
        establecerFechaActual();
        
    } catch (error) {
        console.error('Error en inicialización:', error);
        mostrarError('Error al inicializar la página');
    }
}

// Cargar información del usuario logueado
function cargarInfoUsuario() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData) {
            const userAvatar = document.getElementById('userAvatar');
            const userName = document.getElementById('userName');
            const userRole = document.getElementById('userRole');
            
            if (userData.FotoBase64) {
                userAvatar.src = userData.FotoBase64;
            }
            userName.textContent = userData.NombreCompleto;
            userRole.textContent = determinarRol(userData.Id_Puesto);
        }
    } catch (error) {
        console.error('Error al cargar info del usuario:', error);
    }
}

// Determinar rol del usuario
function determinarRol(idPuesto) {
    if (idPuesto == 5) return 'Administrador RRHH';
    if (idPuesto == 1) return 'Gerente';
    return 'Colaborador';
}

// Establecer fecha actual en el input
function establecerFechaActual() {
    const fechaInput = document.getElementById('fechaLaboral');
    const hoy = new Date();
    const fechaFormateada = hoy.toISOString().split('T')[0];
    fechaInput.value = fechaFormateada;
}

// Cargar departamentos desde la base de datos
async function cargarDepartamentos() {
    try {
        const connection = await connectionString();
        const departamentos = await connection.query(`
            SELECT 
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento
            FROM departamentos
            ORDER BY departamentos.NombreDepartamento
        `);
        await connection.close();
        
        const selectDepartamento = document.getElementById('departamento');
        selectDepartamento.innerHTML = '<option value="">Todos los departamentos</option>';
        
        departamentos.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.IdDepartamento;
            option.textContent = dept.NombreDepartamento;
            selectDepartamento.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarError('Error al cargar los departamentos');
    }
}

// Configurar todos los event listeners
function configurarEventListeners() {
    // Botones principales
    document.getElementById('btnBuscar').addEventListener('click', buscarPlanillas);
    document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);
    
    // Modal
    document.getElementById('modalClose').addEventListener('click', cerrarModal);
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('modalOverlay').addEventListener('click', cerrarModal);
    
    // Enter en campos de búsqueda
    document.getElementById('fechaLaboral').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarPlanillas();
    });
    
    // Ordenamiento de tabla
    configurarOrdenamiento();
}

// Función principal de búsqueda
async function buscarPlanillas() {
    const fechaLaboral = document.getElementById('fechaLaboral').value;
    const departamentoId = document.getElementById('departamento').value;
    
    // Validación
    if (!fechaLaboral) {
        mostrarError('Por favor selecciona una fecha laboral');
        return;
    }
    
    try {
        mostrarEstadoCarga();
        
        // Construir consulta SQL MODIFICADA para incluir Estado
        let query = `
            SELECT
                PlanillasEspeciales.IdPlanillaEspecial, 
                PlanillasEspeciales.NombreUsuario, 
                PlanillasEspeciales.IdDepartamento, 
                PlanillasEspeciales.NombreDepartamento, 
                PlanillasEspeciales.CantColaboradores, 
                PlanillasEspeciales.MontoTotalGasto, 
                PlanillasEspeciales.FechaLaboral, 
                PlanillasEspeciales.TipoPlanilla, 
                PlanillasEspeciales.DescripcionLaboral, 
                PlanillasEspeciales.FechaHoraCreacion, 
                PlanillasEspeciales.ContieneExternos, 
                PlanillasEspeciales.Correlativo,
                PlanillasEspeciales.Estado,
                DetallePlanillaEspecial.IdPersonal, 
                DetallePlanillaEspecial.NombreColaborador, 
                DetallePlanillaEspecial.Monto, 
                DetallePlanillaEspecial.NombrePuesto
            FROM
                PlanillasEspeciales
                INNER JOIN
                DetallePlanillaEspecial
                ON 
                    PlanillasEspeciales.IdPlanillaEspecial = DetallePlanillaEspecial.IdPlanillaEspecial
            WHERE
                PlanillasEspeciales.FechaLaboral = ?
        `;
        
        const parametros = [fechaLaboral];
        
        // Agregar filtro de departamento si se seleccionó uno
        if (departamentoId) {
            query += ' AND PlanillasEspeciales.IdDepartamento = ?';
            parametros.push(departamentoId);
        }
        
        query += ' ORDER BY PlanillasEspeciales.Correlativo, DetallePlanillaEspecial.NombreColaborador';
        
        const connection = await connectionString();
        const resultados = await connection.query(query, parametros);
        await connection.close();
        
        // Procesar resultados
        procesarResultados(resultados);
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        mostrarError('Error al buscar las planillas');
        mostrarEstadoSinResultados();
    }
}

// Procesar y mostrar resultados
function procesarResultados(resultados) {
    if (resultados.length === 0) {
        mostrarEstadoSinResultados();
        return;
    }
    
    // Resetear paginación
    paginaActual = 1;
    
    // Agrupar datos por planilla
    const planillasAgrupadas = agruparPorPlanilla(resultados);
    
    // Guardar datos globalmente
    datosCompletos = planillasAgrupadas;
    datosFiltrados = [...planillasAgrupadas];
    
    // Mostrar resumen
    mostrarResumen(planillasAgrupadas, resultados);
    
    // Mostrar tabla con paginación
    mostrarTabla(planillasAgrupadas);
    
    // Mostrar panel de resultados
    document.getElementById('resultsSummary').style.display = 'block';
    document.getElementById('tableWrapper').style.display = 'block';
    ocultarEstados();
}

// Agrupar resultados por planilla
function agruparPorPlanilla(resultados) {
    const planillasMap = new Map();
    
    resultados.forEach(row => {
        const idPlanilla = row.IdPlanillaEspecial;
        
        if (!planillasMap.has(idPlanilla)) {
            planillasMap.set(idPlanilla, {
                IdPlanillaEspecial: row.IdPlanillaEspecial,
                NombreUsuario: row.NombreUsuario,
                IdDepartamento: row.IdDepartamento,
                NombreDepartamento: row.NombreDepartamento,
                CantColaboradores: row.CantColaboradores,
                MontoTotalGasto: row.MontoTotalGasto,
                FechaLaboral: row.FechaLaboral,
                TipoPlanilla: row.TipoPlanilla,
                DescripcionLaboral: row.DescripcionLaboral,
                FechaHoraCreacion: row.FechaHoraCreacion,
                ContieneExternos: row.ContieneExternos,
                Correlativo: row.Correlativo,
                Estado: row.Estado, // Agregar el campo Estado
                colaboradores: []
            });
        }
        
        // Agregar colaborador
        planillasMap.get(idPlanilla).colaboradores.push({
            IdPersonal: row.IdPersonal,
            NombreColaborador: row.NombreColaborador,
            Monto: row.Monto,
            NombrePuesto: row.NombrePuesto
        });
    });
    
    return Array.from(planillasMap.values());
}

// Mostrar resumen estadístico
function mostrarResumen(planillas, todosLosColaboradores) {
    const totalPlanillas = planillas.length;
    const totalColaboradores = todosLosColaboradores.length;
    const montoTotal = planillas.reduce((sum, p) => sum + parseFloat(p.MontoTotalGasto || 0), 0);
    
    // Actualizar tarjetas originales (aunque estén ocultas)
    document.getElementById('totalPlanillas').textContent = totalPlanillas;
    document.getElementById('totalColaboradores').textContent = totalColaboradores;
    document.getElementById('montoTotal').textContent = formatearMoneda(montoTotal);
    
    // Actualizar tarjetas en línea en el header
    document.getElementById('totalPlanillasInline').textContent = totalPlanillas;
    document.getElementById('totalColaboradoresInline').textContent = totalColaboradores;
    document.getElementById('montoTotalInline').textContent = formatearMoneda(montoTotal);
    
    // Mostrar las tarjetas en línea
    document.getElementById('summaryCardsInline').style.display = 'flex';
}

// Mostrar tabla de resultados
function mostrarTabla(planillas) {
    // Calcular paginación
    totalPaginas = Math.ceil(planillas.length / registrosPorPagina);
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const planillasPagina = planillas.slice(inicio, fin);
    
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    planillasPagina.forEach(planilla => {
        // Determinar el estado del documento
        const estadoDocumento = planilla.Estado === 1 || planilla.Estado === '1';
        const estadoTexto = estadoDocumento ? 'Documento Subido' : 'Pendiente Documento';
        const estadoClase = estadoDocumento ? 'badge-success' : 'badge-warning';
        const estadoIcono = estadoDocumento ? 'fas fa-check-circle' : 'fas fa-clock';
        
        // Botones de acción - agregar botón PDF si tiene documento
        let botonesAccion = `
            <button class="action-btn action-btn-view" onclick="verDetalle(${planilla.IdPlanillaEspecial})">
                <i class="fas fa-eye"></i> Ver
            </button>
        `;
        
        if (estadoDocumento) {
            botonesAccion += `
                <button class="action-btn action-btn-pdf" onclick="verPDF(${planilla.IdPlanillaEspecial})" title="Ver PDF">
                    <i class="fas fa-file-pdf"></i> PDF
                </button>
            `;
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">
                <span class="badge badge-primary">${planilla.Correlativo || 'N/A'}</span>
            </td>
            <td>${planilla.NombreDepartamento}</td>
            <td>
                <span class="badge badge-info" title="${planilla.DescripcionLaboral || 'Sin descripción'}">${truncarTexto(planilla.DescripcionLaboral, 25)}</span>
            </td>
            <td class="text-center">
                <span class="badge ${estadoClase}" title="${estadoTexto}">
                    <i class="${estadoIcono}"></i> ${estadoTexto}
                </span>
            </td>
            <td class="text-center">${planilla.CantColaboradores}</td>
            <td class="text-right amount">${formatearMoneda(planilla.MontoTotalGasto)}</td>
            <td class="text-center">${formatearFecha(planilla.FechaHoraCreacion)}</td>
            <td class="text-center">
                ${botonesAccion}
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Mostrar controles de paginación
    mostrarPaginacion();
    
    // Mostrar información de registros
    mostrarInfoRegistros(planillas.length);
}
function mostrarInfoRegistros(totalRegistros) {
    const infoDiv = document.getElementById('infoRegistros');
    if (!infoDiv) return;
    
    const inicio = (paginaActual - 1) * registrosPorPagina + 1;
    const fin = Math.min(paginaActual * registrosPorPagina, totalRegistros);
    
    infoDiv.innerHTML = `
        <span class="info-registros">
            Mostrando ${inicio} a ${fin} de ${totalRegistros} registros
        </span>
        <div class="registros-por-pagina">
            <label for="selectRegistrosPorPagina">Mostrar:</label>
            <select id="selectRegistrosPorPagina" onchange="cambiarRegistrosPorPagina(this.value)">
                <option value="10" ${registrosPorPagina === 10 ? 'selected' : ''}>10</option>
                <option value="25" ${registrosPorPagina === 25 ? 'selected' : ''}>25</option>
                <option value="50" ${registrosPorPagina === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${registrosPorPagina === 100 ? 'selected' : ''}>100</option>
            </select>
            <span>registros por página</span>
        </div>
    `;
}
function cambiarRegistrosPorPagina(nuevaCantidad) {
    registrosPorPagina = parseInt(nuevaCantidad);
    paginaActual = 1; // Resetear a primera página
    mostrarTabla(datosFiltrados);
}
function mostrarPaginacion() {
    const paginacionDiv = document.getElementById('paginacion');
    if (!paginacionDiv) return;
    
    if (totalPaginas <= 1) {
        paginacionDiv.style.display = 'none';
        return;
    }
    
    paginacionDiv.style.display = 'flex';
    paginacionDiv.innerHTML = '';
    
    // Botón anterior
    const btnAnterior = document.createElement('button');
    btnAnterior.className = `pagination-btn ${paginaActual === 1 ? 'disabled' : ''}`;
    btnAnterior.innerHTML = '<i class="fas fa-chevron-left"></i>';
    btnAnterior.disabled = paginaActual === 1;
    btnAnterior.onclick = () => cambiarPagina(paginaActual - 1);
    paginacionDiv.appendChild(btnAnterior);
    
    // Calcular rango de páginas a mostrar
    let inicio = Math.max(1, paginaActual - 2);
    let fin = Math.min(totalPaginas, paginaActual + 2);
    
    // Ajustar si estamos cerca del inicio o fin
    if (fin - inicio < 4) {
        if (inicio === 1) {
            fin = Math.min(totalPaginas, inicio + 4);
        } else if (fin === totalPaginas) {
            inicio = Math.max(1, fin - 4);
        }
    }
    
    // Primera página si no está visible
    if (inicio > 1) {
        const btn1 = document.createElement('button');
        btn1.className = 'pagination-btn';
        btn1.textContent = '1';
        btn1.onclick = () => cambiarPagina(1);
        paginacionDiv.appendChild(btn1);
        
        if (inicio > 2) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            paginacionDiv.appendChild(dots);
        }
    }
    
    // Páginas del rango
    for (let i = inicio; i <= fin; i++) {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${i === paginaActual ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => cambiarPagina(i);
        paginacionDiv.appendChild(btn);
    }
    
    // Última página si no está visible
    if (fin < totalPaginas) {
        if (fin < totalPaginas - 1) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            paginacionDiv.appendChild(dots);
        }
        
        const btnUltima = document.createElement('button');
        btnUltima.className = 'pagination-btn';
        btnUltima.textContent = totalPaginas;
        btnUltima.onclick = () => cambiarPagina(totalPaginas);
        paginacionDiv.appendChild(btnUltima);
    }
    
    // Botón siguiente
    const btnSiguiente = document.createElement('button');
    btnSiguiente.className = `pagination-btn ${paginaActual === totalPaginas ? 'disabled' : ''}`;
    btnSiguiente.innerHTML = '<i class="fas fa-chevron-right"></i>';
    btnSiguiente.disabled = paginaActual === totalPaginas;
    btnSiguiente.onclick = () => cambiarPagina(paginaActual + 1);
    paginacionDiv.appendChild(btnSiguiente);
}
function cambiarPagina(nuevaPagina) {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
    
    paginaActual = nuevaPagina;
    mostrarTabla(datosFiltrados);
    
    // Scroll hacia arriba de la tabla
    document.getElementById('tableWrapper').scrollTop = 0;
}
function truncarTexto(texto, maxLength = 30) {
    if (!texto) return 'Sin descripción';
    return texto.length > maxLength ? texto.substring(0, maxLength) + '...' : texto;
}
// Ver detalle de planilla en modal
async function verDetalle(idPlanilla) {
    const planilla = datosCompletos.find(p => p.IdPlanillaEspecial === idPlanilla);
    if (!planilla) return;
    
    // Llenar información general
    document.getElementById('detalle-correlativo').textContent = planilla.Correlativo || 'N/A';
    document.getElementById('detalle-departamento').textContent = planilla.NombreDepartamento;
    document.getElementById('detalle-tipo').textContent = planilla.DescripcionLaboral || 'Sin descripción';
    document.getElementById('detalle-fecha').textContent = formatearFecha(planilla.FechaLaboral, true);
    document.getElementById('detalle-monto').textContent = formatearMoneda(planilla.MontoTotalGasto);
    document.getElementById('detalle-externos').textContent = planilla.ContieneExternos ? 'Sí' : 'No';
    document.getElementById('detalle-descripcion').textContent = planilla.DescripcionLaboral || 'Sin descripción';
    
    // Cargar información del documento si existe
    const estadoDocumento = planilla.Estado === 1 || planilla.Estado === '1';
    const infoDocumentoDiv = document.getElementById('detalle-documento-info');
    
    if (estadoDocumento) {
        try {
            const connection = await connectionString();
            const documentoInfo = await connection.query(`
                SELECT 
                    NombreArchivo,
                    FechaSubida,
                    NombreUsuarioSubida
                FROM DocumentosPlanillasEspeciales 
                WHERE IdPlanillaEspecial = ?
            `, [idPlanilla]);
            await connection.close();
            
            if (documentoInfo.length > 0) {
                const doc = documentoInfo[0];
                infoDocumentoDiv.innerHTML = `
                    <div class="documento-info">
                        <h5><i class="fas fa-file-pdf text-danger"></i> Información del Documento</h5>
                        <div class="info-grid-small">
                            <div class="info-item-small">
                                <strong>Archivo:</strong> ${doc.NombreArchivo || 'Sin nombre'}
                            </div>
                            <div class="info-item-small">
                                <strong>Fecha subida:</strong> ${formatearFecha(doc.FechaSubida)}
                            </div>
                            <div class="info-item-small">
                                <strong>Subido por:</strong> ${doc.NombreUsuarioSubida || 'No especificado'}
                            </div>
                        </div>
                        <div style="text-align: center; margin-top: 15px;">
                            <button class="btn btn-info" onclick="verPDF(${idPlanilla})">
                                <i class="fas fa-file-pdf"></i> Ver PDF
                            </button>
                        </div>
                    </div>
                `;
                infoDocumentoDiv.style.display = 'block';
            } else {
                infoDocumentoDiv.style.display = 'none';
            }
        } catch (error) {
            console.error('Error al cargar info del documento:', error);
            infoDocumentoDiv.style.display = 'none';
        }
    } else {
        infoDocumentoDiv.innerHTML = `
            <div class="documento-info">
                <h5><i class="fas fa-exclamation-triangle text-warning"></i> Estado del Documento</h5>
                <p class="text-center" style="color: #856404; background: #fff3cd; padding: 15px; border-radius: 8px; margin: 0;">
                    <i class="fas fa-clock"></i> Pendiente de subir documento
                </p>
            </div>
        `;
        infoDocumentoDiv.style.display = 'block';
    }
    
    // Llenar tabla de colaboradores
    const tbodyColaboradores = document.getElementById('detalleColaboradores');
    tbodyColaboradores.innerHTML = '';
    
    planilla.colaboradores.forEach(colaborador => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${colaborador.NombreColaborador}</td>
            <td>${colaborador.NombrePuesto}</td>
            <td class="text-right amount">${formatearMoneda(colaborador.Monto)}</td>
        `;
        tbodyColaboradores.appendChild(tr);
    });
    
    // Mostrar modal
    document.getElementById('modalDetalle').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';
}

// Configurar ordenamiento de tabla
function configurarOrdenamiento() {
    const headers = document.querySelectorAll('.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const columna = header.getAttribute('data-column');
            ordenarTabla(columna);
        });
    });
}

// Ordenar tabla por columna
function ordenarTabla(columna) {
    // Cambiar dirección de orden
    if (ordenActual.columna === columna) {
        ordenActual.direccion = ordenActual.direccion === 'asc' ? 'desc' : 'asc';
    } else {
        ordenActual.columna = columna;
        ordenActual.direccion = 'asc';
    }
    
    // Actualizar iconos
    actualizarIconosOrden();
    
    // Ordenar datos
    datosFiltrados.sort((a, b) => {
        let valorA = obtenerValorColumna(a, columna);
        let valorB = obtenerValorColumna(b, columna);
        
        // Manejar valores numéricos
        if (columna === 'cantColaboradores' || columna === 'montoTotalGasto') {
            valorA = parseFloat(valorA) || 0;
            valorB = parseFloat(valorB) || 0;
        }
        
        // Manejar fechas
        if (columna === 'fechaHoraCreacion') {
            valorA = new Date(valorA);
            valorB = new Date(valorB);
        }
        
        if (valorA < valorB) return ordenActual.direccion === 'asc' ? -1 : 1;
        if (valorA > valorB) return ordenActual.direccion === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Resetear a primera página y volver a mostrar tabla
    paginaActual = 1;
    mostrarTabla(datosFiltrados);
}

// Obtener valor de columna para ordenamiento
function obtenerValorColumna(planilla, columna) {
    const mapeo = {
        'correlativo': planilla.Correlativo,
        'nombreDepartamento': planilla.NombreDepartamento,
        'descripcionLaboral': planilla.DescripcionLaboral,
        'estado': planilla.Estado, // Nueva columna para ordenamiento
        'cantColaboradores': planilla.CantColaboradores,
        'montoTotalGasto': planilla.MontoTotalGasto,
        'fechaHoraCreacion': planilla.FechaHoraCreacion
    };
    return mapeo[columna] || '';
}

// Actualizar iconos de ordenamiento
function actualizarIconosOrden() {
    const headers = document.querySelectorAll('.sortable');
    headers.forEach(header => {
        header.classList.remove('asc', 'desc');
        if (header.getAttribute('data-column') === ordenActual.columna) {
            header.classList.add(ordenActual.direccion);
        }
    });
}

// Estados de la interfaz
function mostrarEstadoCarga() {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('noResultsState').style.display = 'none';
    document.getElementById('loadingState').style.display = 'flex';
    document.getElementById('tableWrapper').style.display = 'none';
    document.getElementById('resultsSummary').style.display = 'none';
    
    // Ocultar tarjetas mientras carga
    document.getElementById('summaryCardsInline').style.display = 'none';
}

function mostrarEstadoSinResultados() {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('noResultsState').style.display = 'flex';
    document.getElementById('tableWrapper').style.display = 'none';
    document.getElementById('resultsSummary').style.display = 'none';
    
    // Ocultar tarjetas si no hay resultados
    document.getElementById('summaryCardsInline').style.display = 'none';
}

function ocultarEstados() {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('noResultsState').style.display = 'none';
}

// Funciones de utilidad
function formatearMoneda(monto) {
    const numero = parseFloat(monto) || 0;
    
    // Formatear con separadores de miles pero sin símbolo de moneda automático
    const numeroFormateado = new Intl.NumberFormat('es-GT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numero);
    
    // Agregar el símbolo Q manualmente al inicio
    return `Q ${numeroFormateado}`;
}

function formatearFecha(fecha, soloFecha = false) {
    if (!fecha) return 'N/A';
    const opciones = soloFecha 
        ? { year: 'numeric', month: '2-digit', day: '2-digit' }
        : { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit', 
            minute: '2-digit' 
          };
    
    return new Date(fecha).toLocaleDateString('es-GT', opciones);
}

// Limpiar filtros
function limpiarFiltros() {
    document.getElementById('fechaLaboral').value = '';
    document.getElementById('departamento').value = '';
    
    // Limpiar resultados y resetear paginación
    datosCompletos = [];
    datosFiltrados = [];
    paginaActual = 1;
    totalPaginas = 0;
    
    // Ocultar tarjetas en línea
    document.getElementById('summaryCardsInline').style.display = 'none';
    
    // Ocultar controles de paginación
    const paginacionDiv = document.getElementById('paginacion');
    if (paginacionDiv) paginacionDiv.style.display = 'none';
    
    const infoDiv = document.getElementById('infoRegistros');
    if (infoDiv) infoDiv.innerHTML = '';
    
    // Mostrar estado inicial
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('noResultsState').style.display = 'none';
    document.getElementById('tableWrapper').style.display = 'none';
    document.getElementById('resultsSummary').style.display = 'none';
}

// Exportar funciones globales
window.cambiarPagina = cambiarPagina;
window.cambiarRegistrosPorPagina = cambiarRegistrosPorPagina;

// Cerrar modal
function cerrarModal() {
    document.getElementById('modalDetalle').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
}

// Mostrar errores
function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        confirmButtonColor: '#FF9800'
    });
}

// Mostrar éxito
function mostrarExito(mensaje) {
    Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: mensaje,
        timer: 2000,
        confirmButtonColor: '#FF9800'
    });
}
async function verPDF(idPlanilla) {
    try {
        // Mostrar loading
        Swal.fire({
            title: 'Cargando documento...',
            html: '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>',
            showConfirmButton: false,
            allowOutsideClick: false
        });
        
        // Consultar información del documento
        const connection = await connectionString();
        const resultado = await connection.query(`
            SELECT 
                NombreArchivo,
                DocumentoPDF,
                FechaSubida,
                NombreUsuarioSubida
            FROM DocumentosPlanillasEspeciales 
            WHERE IdPlanillaEspecial = ?
        `, [idPlanilla]);
        await connection.close();
        
        if (resultado.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Documento no encontrado',
                text: 'No se encontró el documento PDF para esta planilla.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        const documento = resultado[0];
        
        // Cerrar loading
        Swal.close();
        
        // Mostrar modal con información del PDF
        await mostrarModalPDF(documento, idPlanilla);
        
    } catch (error) {
        console.error('Error al cargar PDF:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el documento PDF.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para mostrar modal con información del PDF
async function mostrarModalPDF(documento, idPlanilla) {
    const result = await Swal.fire({
        title: 'Documento PDF',
        html: `
            <div style="text-align: left; padding: 20px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #654321; margin-bottom: 15px; text-align: center;">
                        <i class="fas fa-file-pdf" style="color: #dc3545;"></i> 
                        Información del Documento
                    </h4>
                    
                    <div style="display: grid; gap: 10px;">
                        <div>
                            <strong>Archivo:</strong> ${documento.NombreArchivo || 'Sin nombre'}
                        </div>
                        <div>
                            <strong>Fecha de subida:</strong> ${formatearFecha(documento.FechaSubida)}
                        </div>
                        <div>
                            <strong>Subido por:</strong> ${documento.NombreUsuarioSubida || 'No especificado'}
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <p style="color: #666; font-size: 0.9rem;">
                        ¿Qué deseas hacer con el documento?
                    </p>
                </div>
            </div>
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fas fa-eye"></i> Ver PDF',
        denyButtonText: '<i class="fas fa-download"></i> Descargar',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#17a2b8',
        denyButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        width: '500px'
    });
    
    if (result.isConfirmed) {
        // Ver PDF en nueva ventana
        abrirPDFViewer(documento);
    } else if (result.isDenied) {
        // Descargar PDF
        descargarPDF(documento);
    }
}

// Función para abrir PDF en nueva ventana
function abrirPDFViewer(documento) {
    try {
        // Convertir buffer a blob si es necesario
        const pdfBlob = new Blob([documento.DocumentoPDF], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Abrir en nueva ventana
        const nuevaVentana = window.open('', '_blank');
        nuevaVentana.document.write(`
            <html>
                <head>
                    <title>${documento.NombreArchivo}</title>
                    <style>
                        body { margin: 0; padding: 0; }
                        iframe { width: 100%; height: 100vh; border: none; }
                    </style>
                </head>
                <body>
                    <iframe src="${pdfUrl}" type="application/pdf"></iframe>
                </body>
            </html>
        `);
        nuevaVentana.document.close();
        
    } catch (error) {
        console.error('Error al abrir PDF:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo abrir el documento PDF.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para descargar PDF
function descargarPDF(documento) {
    try {
        // Crear blob del PDF
        const pdfBlob = new Blob([documento.DocumentoPDF], { type: 'application/pdf' });
        
        // Crear enlace de descarga
        const enlaceDescarga = document.createElement('a');
        enlaceDescarga.href = URL.createObjectURL(pdfBlob);
        enlaceDescarga.download = documento.NombreArchivo || 'documento.pdf';
        
        // Simular clic para descargar
        document.body.appendChild(enlaceDescarga);
        enlaceDescarga.click();
        document.body.removeChild(enlaceDescarga);
        
        // Limpiar URL del objeto
        URL.revokeObjectURL(enlaceDescarga.href);
        
        mostrarExito('Descarga iniciada correctamente');
        
    } catch (error) {
        console.error('Error al descargar PDF:', error);
        mostrarError('No se pudo descargar el documento PDF');
    }
}

// Exportar función para uso global
window.verPDF = verPDF;
// Manejo de errores globales
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
});

// Manejo de promesas rechazadas
window.addEventListener('unhandledrejection', (event) => {
    console.error('Promesa rechazada:', event.reason);
});

// Exportar funciones para uso global
window.verDetalle = verDetalle;