const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');

// Variables globales
let planillasData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 50;
let userData = null;

// Estados de planilla
const ESTADOS = {
    0: { nombre: 'En espera por Autorización', clase: 'estado-0' },
    1: { nombre: 'Autorizado', clase: 'estado-1' },
    2: { nombre: 'Pendiente por Subir Comprobante', clase: 'estado-2' },
    3: { nombre: 'Completado', clase: 'estado-3' },
    4: { nombre: 'Anulado', clase: 'estado-4' }
};
function establecerFechasPorDefecto() {
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);
    
    // Formatear fechas para input type="date"
    const formatoFecha = (fecha) => {
        return fecha.toISOString().split('T')[0];
    };
    
    // Opcional: establecer rango por defecto (últimos 30 días)
    // document.getElementById('filtro-fecha-inicio').value = formatoFecha(hace30Dias);
    // document.getElementById('filtro-fecha-fin').value = formatoFecha(hoy);
}

// Función auxiliar para validar rango de fechas
function validarRangoFechas() {
    const fechaInicio = document.getElementById('filtro-fecha-inicio').value;
    const fechaFin = document.getElementById('filtro-fecha-fin').value;
    
    if (fechaInicio && fechaFin) {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        
        if (inicio > fin) {
            mostrarError('La fecha de inicio no puede ser mayor que la fecha fin');
            document.getElementById('filtro-fecha-fin').value = '';
            return false;
        }
    }
    
    return true;
}
// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verificar usuario logueado
        userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData) {
            window.location.href = 'Login.html';
            return;
        }

        // Inicializar componentes
        initializeEventListeners();
        establecerFechasPorDefecto(); // Opcional
        
        // Agregar validación de fechas
        document.getElementById('filtro-fecha-inicio').addEventListener('change', validarRangoFechas);
        document.getElementById('filtro-fecha-fin').addEventListener('change', validarRangoFechas);
        
        await cargarDepartamentos();
        mostrarEstadoInicial();
        // Ocultar loading inicial
        document.getElementById('loadingState').style.display = 'none';
        
    } catch (error) {
        console.error('Error al inicializar:', error);
        mostrarError('Error al cargar la aplicación');
    }
});
function mostrarEstadoInicial() {
    // Limpiar datos
    planillasData = [];
    filteredData = [];
    currentPage = 1;
    
    // Actualizar estadísticas a cero
    document.getElementById('totalPlanillas').textContent = '0';
    document.getElementById('planillasPendientes').textContent = '0';
    document.getElementById('planillasAutorizadas').textContent = '0';
    document.getElementById('planillasCompletadas').textContent = '0';
    
    // Limpiar tabla
    document.getElementById('planillasTableBody').innerHTML = '';
    
    // Mostrar mensaje inicial en lugar de empty state
    const emptyState = document.getElementById('emptyState');
    emptyState.style.display = 'block';
    emptyState.innerHTML = `
        <div class="empty-icon">
            <i class="fas fa-search"></i>
        </div>
        <h4>Listo para buscar</h4>
        <p>Selecciona tus filtros y haz clic en "Buscar" para ver las planillas</p>
    `;
    
    // Actualizar paginación
    document.getElementById('paginationInfo').textContent = 'Mostrando 0 - 0 de 0 resultados';
    document.getElementById('btnPrevious').disabled = true;
    document.getElementById('btnNext').disabled = true;
    document.getElementById('pageNumbers').innerHTML = '';
}
// Event Listeners
function initializeEventListeners() {
    // Filtros - SOLO el botón buscar
    document.getElementById('btnBuscar').addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);
    document.getElementById('btnExportar').addEventListener('click', exportarDatos);
    document.getElementById('btnRefresh').addEventListener('click', aplicarFiltros); // Cambiar para que use la misma lógica
    
    // Toggle filtros
    document.getElementById('toggleFilters').addEventListener('click', toggleFiltros);
    
    // Modal
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('btnCerrarDetalle').addEventListener('click', cerrarModal);
    document.getElementById('btnImprimirDetalle').addEventListener('click', imprimirDetalle);
    
    // Cerrar modal al hacer click fuera
    document.getElementById('modalDetalle').addEventListener('click', (e) => {
        if (e.target.id === 'modalDetalle') {
            cerrarModal();
        }
    });
    
    // Paginación
    document.getElementById('btnPrevious').addEventListener('click', () => cambiarPagina(currentPage - 1));
    document.getElementById('btnNext').addEventListener('click', () => cambiarPagina(currentPage + 1));
    
    // OPCIONAL: Agregar búsqueda con Enter en los campos
    document.getElementById('filtro-departamento').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') aplicarFiltros();
    });
    document.getElementById('filtro-estado').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') aplicarFiltros();
    });
}

// Cargar departamentos para el filtro
async function cargarDepartamentos() {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT DISTINCT 
                departamentos.IdDepartamento,
                departamentos.NombreDepartamento
            FROM departamentos 
            INNER JOIN PagoPlanillaParcial ON departamentos.IdDepartamento = PagoPlanillaParcial.IdDepartamentoSucursal
            ORDER BY departamentos.NombreDepartamento
        `);
        await connection.close();
        
        const select = document.getElementById('filtro-departamento');
        select.innerHTML = '<option value="">Todos los departamentos</option>';
        
        result.forEach(depto => {
            const option = document.createElement('option');
            option.value = depto.IdDepartamento;
            option.textContent = depto.NombreDepartamento;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarError('Error al cargar los departamentos');
    }
}

// Cargar planillas desde la base de datos
async function cargarPlanillas() {
    try {
        mostrarCargando(true);
        
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                PagoPlanillaParcial.IdPlanillaParcial, 
                departamentos.IdDepartamento,
                departamentos.NombreDepartamento, 
                PagoPlanillaParcial.CantidadColaboradores, 
                PagoPlanillaParcial.PeriodoPago, 
                PagoPlanillaParcial.NombreUsuario, 
                PagoPlanillaParcial.FechaHoraRegistro, 
                PagoPlanillaParcialEstados.NombreEstado, 
                PagoPlanillaParcial.Estado,
                PagoPlanillaParcial.NombreUsuarioAutoriza, 
                PagoPlanillaParcial.FechaHoraAutorizacion, 
                PagoPlanillaParcial.MotivoRechazo
            FROM
                PagoPlanillaParcial
                INNER JOIN departamentos ON PagoPlanillaParcial.IdDepartamentoSucursal = departamentos.IdDepartamento
                INNER JOIN PagoPlanillaParcialEstados ON PagoPlanillaParcial.Estado = PagoPlanillaParcialEstados.IdEstadoPagoPlanillaParcial
            ORDER BY PagoPlanillaParcial.FechaHoraRegistro DESC
        `);
        await connection.close();
        
        planillasData = result;
        filteredData = [...planillasData];
        
        actualizarEstadisticas();
        actualizarTabla();
        actualizarPaginacion();
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar planillas:', error);
        mostrarError('Error al cargar las planillas');
        mostrarCargando(false);
    }
}

// Aplicar filtros
async function aplicarFiltros() {
    try {
        // Mostrar loading
        mostrarCargando(true);
        
        // Cargar planillas desde la base de datos
        await cargarPlanillasConFiltros();
        
        // Ocultar loading
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al aplicar filtros:', error);
        mostrarError('Error al buscar planillas');
        mostrarCargando(false);
    }
}

// Limpiar filtros
function limpiarFiltros() {
    document.getElementById('filtro-departamento').value = '';
    document.getElementById('filtro-estado').value = '';
    document.getElementById('filtro-fecha-inicio').value = '';
    document.getElementById('filtro-fecha-fin').value = '';
    
    // Volver al estado inicial en lugar de mostrar todos los datos
    mostrarEstadoInicial();
}
async function cargarPlanillasConFiltros() {
    try {
        const departamento = document.getElementById('filtro-departamento').value;
        const estado = document.getElementById('filtro-estado').value;
        const fechaInicio = document.getElementById('filtro-fecha-inicio').value;
        const fechaFin = document.getElementById('filtro-fecha-fin').value;
        
        // Construir consulta con filtros
        let whereClause = '';
        let params = [];
        
        if (departamento) {
            whereClause += ' AND PagoPlanillaParcial.IdDepartamentoSucursal = ?';
            params.push(departamento);
        }
        
        if (estado !== '') {
            whereClause += ' AND PagoPlanillaParcial.Estado = ?';
            params.push(estado);
        }
        
        if (fechaInicio) {
            whereClause += ' AND PagoPlanillaParcial.FechaHoraRegistro >= ?';
            params.push(fechaInicio + ' 00:00:00');
        }
        
        if (fechaFin) {
            whereClause += ' AND PagoPlanillaParcial.FechaHoraRegistro <= ?';
            params.push(fechaFin + ' 23:59:59');
        }
        
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                PagoPlanillaParcial.IdPlanillaParcial, 
                departamentos.IdDepartamento,
                departamentos.NombreDepartamento, 
                PagoPlanillaParcial.CantidadColaboradores, 
                PagoPlanillaParcial.PeriodoPago, 
                PagoPlanillaParcial.NombreUsuario, 
                PagoPlanillaParcial.FechaHoraRegistro, 
                PagoPlanillaParcialEstados.NombreEstado, 
                PagoPlanillaParcial.Estado,
                PagoPlanillaParcial.NombreUsuarioAutoriza, 
                PagoPlanillaParcial.FechaHoraAutorizacion, 
                PagoPlanillaParcial.MotivoRechazo
            FROM
                PagoPlanillaParcial
                INNER JOIN departamentos ON PagoPlanillaParcial.IdDepartamentoSucursal = departamentos.IdDepartamento
                INNER JOIN PagoPlanillaParcialEstados ON PagoPlanillaParcial.Estado = PagoPlanillaParcialEstados.IdEstadoPagoPlanillaParcial
            WHERE 1=1 ${whereClause}
            ORDER BY PagoPlanillaParcial.FechaHoraRegistro DESC
        `, params);
        await connection.close();
        
        // Actualizar datos
        planillasData = result;
        filteredData = [...planillasData];
        currentPage = 1;
        
        // Actualizar interfaz
        actualizarEstadisticas();
        actualizarTabla();
        actualizarPaginacion();
        
    } catch (error) {
        console.error('Error al cargar planillas con filtros:', error);
        throw error;
    }
}
// Actualizar estadísticas
function actualizarEstadisticas() {
    const total = filteredData.length;
    const pendientes = filteredData.filter(p => p.Estado == 0).length;
    const autorizadas = filteredData.filter(p => p.Estado == 1).length;
    const completadas = filteredData.filter(p => p.Estado == 3).length;
    
    document.getElementById('totalPlanillas').textContent = total;
    document.getElementById('planillasPendientes').textContent = pendientes;
    document.getElementById('planillasAutorizadas').textContent = autorizadas;
    document.getElementById('planillasCompletadas').textContent = completadas;
}

// Actualizar tabla
function actualizarTabla() {
    const tbody = document.getElementById('planillasTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    
    tbody.innerHTML = paginatedData.map(planilla => `
        <tr>
            <td><strong>#${planilla.IdPlanillaParcial}</strong></td>
            <td>${planilla.NombreDepartamento}</td>
            <td>
                <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-weight: 500;">
                    ${planilla.CantidadColaboradores}
                </span>
            </td>
            <td>${planilla.PeriodoPago}</td>
            <td>
                <span class="estado-badge ${ESTADOS[planilla.Estado].clase}">
                    ${ESTADOS[planilla.Estado].nombre}
                </span>
            </td>
            <td>${planilla.NombreUsuario}</td>
            <td>${formatearFecha(planilla.FechaHoraRegistro)}</td>
            <td>${planilla.NombreUsuarioAutoriza || '-'}</td>
            <td>${planilla.FechaHoraAutorizacion ? formatearFecha(planilla.FechaHoraAutorizacion) : '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-detalle" onclick="verDetalle(${planilla.IdPlanillaParcial})">
                        <i class="fas fa-eye"></i> Ver Detalle
                    </button>
                    ${planilla.Estado == 3 ? `
                        <button class="btn btn-pdf" onclick="verPDF(${planilla.IdPlanillaParcial})">
                            <i class="fas fa-file-pdf"></i> Ver PDF
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}
async function verPDF(idPlanilla) {
    try {
        // Mostrar loading
        Swal.fire({
            title: 'Cargando...',
            text: 'Buscando documento PDF',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Consultar documento PDF
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                DocumentosPlanillasParciales.NombreArchivo, 
                DocumentosPlanillasParciales.DocumentoPDF, 
                DocumentosPlanillasParciales.FechaSubida, 
                DocumentosPlanillasParciales.NombreUsuario
            FROM
                DocumentosPlanillasParciales
            WHERE
                DocumentosPlanillasParciales.IdPlanillaParcial = ?
        `, [idPlanilla]);
        await connection.close();
        
        if (result.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Documento no encontrado',
                text: 'No se encontró ningún documento PDF para esta planilla.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        const documento = result[0];
        
        // Cerrar loading
        Swal.close();
        
        // Mostrar opciones al usuario
        const resultado = await Swal.fire({
            title: 'Documento PDF encontrado',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>Nombre del archivo:</strong> ${documento.NombreArchivo}</p>
                    <p><strong>Fecha de subida:</strong> ${formatearFecha(documento.FechaSubida)}</p>
                    <p><strong>Subido por:</strong> ${documento.NombreUsuario}</p>
                </div>
            `,
            icon: 'info',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '<i class="fas fa-eye"></i> Ver PDF',
            denyButtonText: '<i class="fas fa-download"></i> Descargar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#448AFF',
            denyButtonColor: '#4CAF50',
            cancelButtonColor: '#6c757d'
        });
        
        if (resultado.isConfirmed) {
            // Ver PDF en nueva ventana
            mostrarPDFEnVentana(documento.DocumentoPDF, documento.NombreArchivo);
        } else if (resultado.isDenied) {
            // Descargar PDF
            descargarPDF(documento.DocumentoPDF, documento.NombreArchivo);
        }
        
    } catch (error) {
        console.error('Error al cargar PDF:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al cargar el documento PDF',
            confirmButtonColor: '#FF9800'
        });
    }
}
function mostrarPDFEnVentana(documentoPDF, nombreArchivo) {
    try {
        // Crear URL del blob
        const byteCharacters = atob(documentoPDF);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Abrir en nueva ventana
        const ventana = window.open(url, '_blank');
        if (!ventana) {
            // Si el popup fue bloqueado, mostrar alternativa
            Swal.fire({
                icon: 'warning',
                title: 'Popup bloqueado',
                text: 'Tu navegador bloqueó la ventana emergente. Haz clic en "Descargar" para obtener el archivo.',
                showCancelButton: true,
                confirmButtonText: 'Descargar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#4CAF50'
            }).then((result) => {
                if (result.isConfirmed) {
                    descargarPDF(documentoPDF, nombreArchivo);
                }
            });
        } else {
            // Limpiar la URL después de un tiempo
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 60000); // 1 minuto
        }
        
    } catch (error) {
        console.error('Error al mostrar PDF:', error);
        mostrarError('Error al mostrar el PDF. Intenta descargarlo.');
    }
}
function descargarPDF(documentoPDF, nombreArchivo) {
    try {
        // Crear URL del blob
        const byteCharacters = atob(documentoPDF);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Crear enlace temporal para descarga
        const link = document.createElement('a');
        link.href = url;
        link.download = nombreArchivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Limpiar la URL
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
        
        mostrarExito('Descarga iniciada');
        
    } catch (error) {
        console.error('Error al descargar PDF:', error);
        mostrarError('Error al descargar el PDF');
    }
}
// Ver detalle de planilla
async function verDetalle(idPlanilla) {
    try {
        mostrarCargandoModal(true);
        
        // Obtener información general de la planilla
        const planilla = filteredData.find(p => p.IdPlanillaParcial == idPlanilla);
        if (!planilla) {
            mostrarError('Planilla no encontrada');
            return;
        }
        
        // Debug: Verificar que el modal existe
        const modal = document.getElementById('modalDetalle');
        if (!modal) {
            console.error('Modal no encontrado');
            mostrarError('Error en la interfaz del modal');
            return;
        }
        
        // Obtener detalle de colaboradores
        const connection = await connectionString();
        const detalle = await connection.query(`
            SELECT 
                PagoPlanillaParcialDetalle.NombrePersonal, 
                PagoPlanillaParcialDetalle.FechaLaborada, 
                PagoPlanillaParcialDetalle.TipoTurno, 
                PagoPlanillaParcialDetalle.MontoPagado
            FROM PagoPlanillaParcialDetalle
            WHERE PagoPlanillaParcialDetalle.IdPlanillaParcial = ?
            ORDER BY PagoPlanillaParcialDetalle.NombrePersonal
        `, [idPlanilla]);
        await connection.close();
        
        // Restaurar el contenido completo del modal ANTES de llenar los datos
        const modalContent = document.querySelector('#modalDetalle .modal-content');
        modalContent.innerHTML = `
            <!-- Información general de la planilla -->
            <div class="planilla-info">
                <div class="info-row">
                    <div class="info-group">
                        <label>ID Planilla:</label>
                        <span id="detalleIdPlanilla">-</span>
                    </div>
                    <div class="info-group">
                        <label>Departamento:</label>
                        <span id="detalleDepartamento">-</span>
                    </div>
                    <div class="info-group">
                        <label>Período:</label>
                        <span id="detallePeriodo">-</span>
                    </div>
                    <div class="info-group">
                        <label>Estado:</label>
                        <span class="estado-badge" id="detalleEstado">-</span>
                    </div>
                </div>
                
                <div class="info-row">
                    <div class="info-group">
                        <label>Registrado por:</label>
                        <span id="detalleRegistradoPor">-</span>
                    </div>
                    <div class="info-group">
                        <label>Fecha Registro:</label>
                        <span id="detalleFechaRegistro">-</span>
                    </div>
                    <div class="info-group">
                        <label>Autorizado por:</label>
                        <span id="detalleAutorizadoPor">-</span>
                    </div>
                    <div class="info-group">
                        <label>Fecha Autorización:</label>
                        <span id="detalleFechaAutorizacion">-</span>
                    </div>
                </div>
                
                <div class="info-row" id="motivoRechazoRow" style="display: none;">
                    <div class="info-group full-width">
                        <label>Motivo de Rechazo:</label>
                        <span id="detalleMotivoRechazo" class="motivo-rechazo">-</span>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de detalle de colaboradores -->
            <div class="detalle-colaboradores">
                <h4><i class="fas fa-users"></i> Detalle de Colaboradores</h4>
                <div class="detalle-table-wrapper">
                    <table class="detalle-table">
                        <thead>
                            <tr>
                                <th>Colaborador</th>
                                <th>Fecha Laborada</th>
                                <th>Tipo Turno</th>
                                <th>Monto Pagado</th>
                            </tr>
                        </thead>
                        <tbody id="detalleColaboradoresBody">
                            <!-- Los datos se cargarán dinámicamente -->
                        </tbody>
                    </table>
                </div>
                
                <!-- Resumen del detalle -->
                <div class="detalle-resumen">
                    <div class="resumen-item">
                        <span class="resumen-label">Total Colaboradores:</span>
                        <span class="resumen-value" id="totalColaboradores">0</span>
                    </div>
                    <div class="resumen-item">
                        <span class="resumen-label">Monto Total:</span>
                        <span class="resumen-value" id="montoTotal">Q 0.00</span>
                    </div>
                </div>
            </div>
        `;
        
        // AHORA sí llenar información general (después de crear los elementos)
        document.getElementById('detalleIdPlanilla').textContent = planilla.IdPlanillaParcial;
        document.getElementById('detalleDepartamento').textContent = planilla.NombreDepartamento;
        document.getElementById('detallePeriodo').textContent = planilla.PeriodoPago;
        
        const estadoElement = document.getElementById('detalleEstado');
        estadoElement.textContent = ESTADOS[planilla.Estado].nombre;
        estadoElement.className = `estado-badge ${ESTADOS[planilla.Estado].clase}`;
        
        document.getElementById('detalleRegistradoPor').textContent = planilla.NombreUsuario;
        document.getElementById('detalleFechaRegistro').textContent = formatearFecha(planilla.FechaHoraRegistro);
        document.getElementById('detalleAutorizadoPor').textContent = planilla.NombreUsuarioAutoriza || '-';
        document.getElementById('detalleFechaAutorizacion').textContent = 
            planilla.FechaHoraAutorizacion ? formatearFecha(planilla.FechaHoraAutorizacion) : '-';
        
        // Mostrar motivo de rechazo si existe
        const motivoRow = document.getElementById('motivoRechazoRow');
        if (planilla.MotivoRechazo && planilla.Estado == 4) {
            document.getElementById('detalleMotivoRechazo').textContent = planilla.MotivoRechazo;
            motivoRow.style.display = 'block';
        } else {
            motivoRow.style.display = 'none';
        }
        
        // Llenar tabla de colaboradores
        const tbody = document.getElementById('detalleColaboradoresBody');
        let montoTotal = 0;
        
        tbody.innerHTML = detalle.map(item => {
            montoTotal += parseFloat(item.MontoPagado) || 0;
            return `
                <tr>
                    <td>${item.NombrePersonal}</td>
                    <td>${formatearSoloFecha(item.FechaLaborada)}</td>
                    <td>
                        <span style="background: #fff3e0; color: #f57c00; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                            ${item.TipoTurno}
                        </span>
                    </td>
                    <td>
                        <strong style="color: #2e7d32;">Q ${parseFloat(item.MontoPagado).toFixed(2)}</strong>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Actualizar resumen
        document.getElementById('totalColaboradores').textContent = detalle.length;
        document.getElementById('montoTotal').textContent = `Q ${montoTotal.toFixed(2)}`;
        
        // El modal ya está visible desde mostrarCargandoModal(true)
        
    } catch (error) {
        console.error('Error al cargar detalle:', error);
        mostrarError('Error al cargar el detalle de la planilla');
        // Cerrar el modal en caso de error
        document.getElementById('modalDetalle').classList.remove('show');
    }
}

// Paginación
function actualizarPaginacion() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);
    
    // Actualizar información
    document.getElementById('paginationInfo').textContent = 
        `Mostrando ${startItem} - ${endItem} de ${filteredData.length} resultados`;
    
    // Actualizar botones
    document.getElementById('btnPrevious').disabled = currentPage <= 1;
    document.getElementById('btnNext').disabled = currentPage >= totalPages;
    
    // Generar números de página
    const pageNumbers = document.getElementById('pageNumbers');
    pageNumbers.innerHTML = '';
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `btn page-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => cambiarPagina(i);
        pageNumbers.appendChild(pageBtn);
    }
}

function cambiarPagina(page) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        actualizarTabla();
        actualizarPaginacion();
    }
}

// Toggle filtros
function toggleFiltros() {
    const content = document.getElementById('filtersContent');
    const button = document.getElementById('toggleFilters');
    const icon = button.querySelector('i');
    
    content.classList.toggle('collapsed');
    
    if (content.classList.contains('collapsed')) {
        icon.className = 'fas fa-chevron-down';
    } else {
        icon.className = 'fas fa-chevron-up';
    }
}

// Exportar datos
async function exportarDatos() {
    try {
        if (filteredData.length === 0) {
            mostrarError('No hay datos para exportar');
            return;
        }
        
        const result = await Swal.fire({
            title: 'Exportar Datos',
            text: `¿Deseas exportar ${filteredData.length} registros a Excel?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Exportar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#448AFF'
        });
        
        if (result.isConfirmed) {
            // Aquí implementarías la lógica de exportación
            // Por ejemplo, usando una librería como xlsx
            mostrarExito('Función de exportación en desarrollo');
        }
        
    } catch (error) {
        console.error('Error al exportar:', error);
        mostrarError('Error al exportar los datos');
    }
}

// Imprimir detalle
function imprimirDetalle() {
    const modalContent = document.querySelector('.modal-content').cloneNode(true);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Detalle de Planilla</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
                .planilla-info { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; }
                .info-row { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 10px; }
                .info-group { flex: 1; min-width: 200px; }
                .info-group label { font-weight: bold; display: block; margin-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; font-weight: bold; }
                .detalle-resumen { text-align: right; margin-top: 10px; font-weight: bold; }
                .estado-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; }
                .estado-0 { background: #fff3cd; color: #856404; }
                .estado-1 { background: #d4edda; color: #155724; }
                .estado-2 { background: #cce5ff; color: #004085; }
                .estado-3 { background: #d1ecf1; color: #0c5460; }
                .estado-4 { background: #f8d7da; color: #721c24; }
            </style>
        </head>
        <body>
            <h2>Detalle de Planilla</h2>
            ${modalContent.innerHTML}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
}

// Cerrar modal
function cerrarModal() {
    document.getElementById('modalDetalle').classList.remove('show');
}

// Utilidades
function formatearFecha(fecha) {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-GT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatearSoloFecha(fecha) {
    if (!fecha) return '-';
    
    // Parsear la fecha manualmente para evitar problemas de zona horaria
    let fechaObj;
    
    if (typeof fecha === 'string') {
        // Si viene como string, parsearlo correctamente
        if (fecha.includes('T')) {
            // Formato ISO: "2025-09-13T00:00:00.000Z"
            fechaObj = new Date(fecha + 'T00:00:00.000Z');
        } else if (fecha.includes('-')) {
            // Formato: "2025-09-13" o "2025-09-13 00:00:00"
            const parts = fecha.split(' ')[0].split('-');
            fechaObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            fechaObj = new Date(fecha);
        }
    } else {
        fechaObj = new Date(fecha);
    }
    
    // Formatear manualmente para evitar problemas de zona horaria
    const day = fechaObj.getDate().toString().padStart(2, '0');
    const month = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const year = fechaObj.getFullYear();
    
    return `${day}/${month}/${year}`;
}

function mostrarCargando(show) {
    const loading = document.getElementById('loadingState');
    const table = document.querySelector('.table-wrapper table');
    
    if (show) {
        loading.style.display = 'block';
        if (table) table.style.opacity = '0.5';
    } else {
        loading.style.display = 'none';
        if (table) table.style.opacity = '1';
    }
}

function mostrarCargandoModal(show) {
    const modal = document.getElementById('modalDetalle');
    if (show) {
        modal.classList.add('show');
        modal.querySelector('.modal-content').innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div class="spinner" style="margin: 0 auto 20px; border: 4px solid #f3f3f3; border-top: 4px solid #448AFF; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
                <p>Cargando detalle...</p>
            </div>
        `;
    }
}

function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        confirmButtonColor: '#FF9800'
    });
}

function mostrarExito(mensaje) {
    Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: mensaje,
        confirmButtonColor: '#4CAF50',
        timer: 2000,
        timerProgressBar: true
    });
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