const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const fs = require('fs');
const { ipcRenderer } = require('electron');

// Variables globales
let datosPlanillas = [];
let planillaActual = null;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    inicializarAnios();
    configurarEventListeners();
    cargarUsuarioActual();
});

// Configurar event listeners
function configurarEventListeners() {
    document.getElementById('btnBuscar').addEventListener('click', buscarPlanillas);
    document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);
    
    // Permitir buscar con Enter en los filtros
    document.getElementById('tipoQuincena').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarPlanillas();
    });
    document.getElementById('mes').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarPlanillas();
    });
    document.getElementById('anio').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarPlanillas();
    });
}

// Cargar usuario actual del localStorage
function cargarUsuarioActual() {
    try {
        const userDataString = localStorage.getItem('userData');
        if (userDataString) {
            const userData = JSON.parse(userDataString);
        }
    } catch (error) {
        console.error('Error al cargar usuario:', error);
    }
}

// Inicializar años en el select (últimos 5 años)
function inicializarAnios() {
    const selectAnio = document.getElementById('anio');
    const anioActual = new Date().getFullYear();
    
    selectAnio.innerHTML = '<option value="">Todos</option>';
    
    for (let i = 0; i < 5; i++) {
        const anio = anioActual - i;
        const option = document.createElement('option');
        option.value = anio;
        option.textContent = anio;
        if (i === 0) option.selected = true; // Seleccionar año actual
        selectAnio.appendChild(option);
    }
}

// Limpiar filtros
function limpiarFiltros() {
    document.getElementById('tipoQuincena').value = '';
    document.getElementById('mes').value = '';
    document.getElementById('anio').selectedIndex = 1; // Año actual
    
    // Limpiar tabla
    datosPlanillas = [];
    renderizarTabla([]);
    
    Swal.fire({
        icon: 'info',
        title: 'Filtros limpiados',
        text: 'Los filtros han sido restablecidos',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

// Buscar planillas según filtros
async function buscarPlanillas() {
    const tipoQuincena = document.getElementById('tipoQuincena').value;
    const mes = document.getElementById('mes').value;
    const anio = document.getElementById('anio').value;
    
    // Validar que al menos un filtro esté seleccionado
    if (!tipoQuincena && !mes && !anio) {
        await Swal.fire({
            icon: 'warning',
            title: 'Selecciona al menos un filtro',
            text: 'Debes seleccionar al menos un criterio de búsqueda',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    mostrarLoading(true);
    
    try {
        const connection = await connectionString();
        
        // Construir query dinámicamente según filtros
        let query = `
            SELECT DISTINCT
                VacacionistaPagoPlanilla.IdPagoPlanillaVacacionista, 
                VacacionistaPagoPlanilla.NombreUsuarioGenera, 
                VacacionistaPagoPlanilla.PeriodoPago, 
                VacacionistaPagoPlanilla.IdDeptoSucursal, 
                VacacionistaPagoPlanilla.NombreDeptoSucursal, 
                VacacionistaPagoPlanilla.CantidadColaboradores, 
                VacacionistaPagoPlanilla.MontoPlanilla, 
                VacacionistaPagoPlanillaEstados.NombreEstado, 
                VacacionistaPagoPlanilla.FechaHoraRegistro, 
                VacacionistaPagoPlanilla.NombreUsuarioAutorizaAnula, 
                VacacionistaPagoPlanilla.FechaHoraAutorizo, 
                VacacionistaPagoPlanilla.MotivoAnulacion, 
                VacacionistaPagoPlanilla.IdTipoQuincena, 
                VacacionistaPagoPlanilla.TipoQuincena,
                VacacionistaPagoPlanilla.Estado,
                VacacionistaPagoPlanilla.Mes,
                VacacionistaPagoPlanilla.Anio
            FROM
                VacacionistaPagoPlanilla
                INNER JOIN
                VacacionistaPagoPlanillaEstados
                ON 
                    VacacionistaPagoPlanilla.Estado = VacacionistaPagoPlanillaEstados.IdEstadoPagoPlanillaVacacionista
            WHERE 1=1
        `;
        
        const params = [];
        
        // Agregar filtros según lo seleccionado
        if (tipoQuincena) {
            query += ' AND VacacionistaPagoPlanilla.IdTipoQuincena = ?';
            params.push(tipoQuincena);
        }
        
        if (mes) {
            query += ' AND VacacionistaPagoPlanilla.Mes = ?';
            params.push(parseInt(mes));
        }
        
        if (anio) {
            query += ' AND VacacionistaPagoPlanilla.Anio = ?';
            params.push(parseInt(anio));
        }
        
        query += ' ORDER BY VacacionistaPagoPlanilla.FechaHoraRegistro DESC';
        
        const resultado = await connection.query(query, params);
        await connection.close();
        
        datosPlanillas = resultado;
        renderizarTabla(resultado);
        
        // Mostrar notificación de éxito
        if (resultado.length > 0) {
            Swal.fire({
                icon: 'success',
                title: 'Búsqueda completada',
                text: `Se encontraron ${resultado.length} registro(s)`,
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: 'No se encontraron planillas con los filtros seleccionados',
                confirmButtonColor: '#FF9800'
            });
        }
        
    } catch (error) {
        console.error('Error al buscar planillas:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error en la búsqueda',
            text: 'Ocurrió un error al buscar las planillas. Por favor, intenta nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    } finally {
        mostrarLoading(false);
    }
}

// Renderizar tabla con los datos
function renderizarTabla(datos) {
    const tbody = document.getElementById('tablaPlanillasBody');
    const totalRegistros = document.getElementById('totalRegistros');
    const totalMonto = document.getElementById('totalMonto');

    totalRegistros.textContent = `${datos.length} registro(s) encontrado(s)`;

    // Calcular monto total
    let montoTotal = 0;
    datos.forEach(planilla => {
        montoTotal += parseFloat(planilla.MontoPlanilla || 0);
    });

    totalMonto.textContent = `Monto Total: ${formatearMoneda(montoTotal)}`;

    if (datos.length === 0) {
        totalMonto.textContent = 'Monto Total: Q 0.00';
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="10">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No hay datos para mostrar</p>
                        <span>Utiliza los filtros para buscar planillas</span>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';

    datos.forEach((planilla, index) => {
        const tr = document.createElement('tr');
        tr.style.animationDelay = `${index * 0.05}s`;
        
        // Determinar clase del badge según el estado
        const estadoClase = obtenerClaseEstado(planilla.Estado);
        
        // Determinar botones según el estado
        let botonesAccion = `
            <button class="btn-action btn-detail" onclick="verDetalle(${planilla.IdPagoPlanillaVacacionista})">
                <i class="fas fa-eye"></i> Ver
            </button>
        `;
        
        // Si el estado es "Completado" (3), agregar botón de documento
        if (planilla.Estado === 3) {
            botonesAccion += `
                <button class="btn-action btn-document" onclick="verDocumento(${planilla.IdPagoPlanillaVacacionista})">
                    <i class="fas fa-file-pdf"></i> Doc
                </button>
            `;
        }
        
        tr.innerHTML = `
            <td>${planilla.IdPagoPlanillaVacacionista}</td>
            <td>${planilla.NombreUsuarioGenera}</td>
            <td>${planilla.PeriodoPago}</td>
            <td><span class="badge badge-${obtenerClaseTipoQuincena(planilla.IdTipoQuincena)}">${planilla.TipoQuincena}</span></td>
            <td>${planilla.NombreDeptoSucursal}</td>
            <td class="th-center">${planilla.CantidadColaboradores}</td>
            <td class="th-money">${formatearMoneda(planilla.MontoPlanilla)}</td>
            <td class="th-center">
                <span class="badge badge-${estadoClase}">${planilla.NombreEstado}</span>
            </td>
            <td>${formatearFechaHora(planilla.FechaHoraRegistro)}</td>
            <td class="th-actions">
                <div class="action-buttons">
                    ${botonesAccion}
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Obtener clase CSS según el tipo de quincena
function obtenerClaseTipoQuincena(idTipoQuincena) {
    const tipos = {
        1: 'autorizado',  // Quincenal - azul
        2: 'pendiente-comprobante'   // Fin de mes - morado
    };
    return tipos[idTipoQuincena] || 'pendiente';
}

// Obtener clase CSS según el estado
function obtenerClaseEstado(estado) {
    const estados = {
        0: 'pendiente',           // Pendiente por Autorizar
        1: 'autorizado',          // Autorizado
        2: 'pendiente-comprobante', // Pendiente por subir comprobante
        3: 'completado',          // Completado
        4: 'anulado'              // Anulado
    };
    return estados[estado] || 'pendiente';
}

// Ver detalle de planilla
async function verDetalle(idPlanilla) {
    mostrarLoading(true);
    
    try {
        const connection = await connectionString();
        
        // Obtener datos de la planilla y sus detalles
        const query = `
            SELECT
                VacacionistaPagoPlanilla.IdPagoPlanillaVacacionista, 
                VacacionistaPagoPlanilla.NombreUsuarioGenera, 
                VacacionistaPagoPlanilla.PeriodoPago, 
                VacacionistaPagoPlanilla.IdDeptoSucursal, 
                VacacionistaPagoPlanilla.NombreDeptoSucursal, 
                VacacionistaPagoPlanilla.CantidadColaboradores, 
                VacacionistaPagoPlanilla.MontoPlanilla, 
                VacacionistaPagoPlanillaEstados.NombreEstado, 
                VacacionistaPagoPlanilla.FechaHoraRegistro, 
                VacacionistaPagoPlanilla.NombreUsuarioAutorizaAnula, 
                VacacionistaPagoPlanilla.FechaHoraAutorizo, 
                VacacionistaPagoPlanilla.MotivoAnulacion, 
                VacacionistaDetallePagoPlanilla.NombreColaborador, 
                VacacionistaDetallePagoPlanilla.CantidadDiasLaborados, 
                VacacionistaDetallePagoPlanilla.MontoDia, 
                VacacionistaDetallePagoPlanilla.SubTotal, 
                VacacionistaPagoPlanilla.IdTipoQuincena, 
                VacacionistaPagoPlanilla.TipoQuincena,
                VacacionistaPagoPlanilla.Estado
            FROM
                VacacionistaPagoPlanilla
                INNER JOIN
                VacacionistaPagoPlanillaEstados
                ON 
                    VacacionistaPagoPlanilla.Estado = VacacionistaPagoPlanillaEstados.IdEstadoPagoPlanillaVacacionista
                INNER JOIN
                VacacionistaDetallePagoPlanilla
                ON 
                    VacacionistaPagoPlanilla.IdPagoPlanillaVacacionista = VacacionistaDetallePagoPlanilla.IdPagoPlanillaVacacionista
            WHERE
                VacacionistaPagoPlanilla.IdPagoPlanillaVacacionista = ?
            ORDER BY VacacionistaDetallePagoPlanilla.NombreColaborador ASC
        `;
        
        const resultado = await connection.query(query, [idPlanilla]);
        await connection.close();
        
        if (resultado.length === 0) {
            throw new Error('No se encontró información de la planilla');
        }
        
        mostrarLoading(false);
        
        // Guardar planilla actual
        planillaActual = resultado[0];
        
        // Llenar información general
        document.getElementById('detalleIdPlanilla').textContent = resultado[0].IdPagoPlanillaVacacionista;
        document.getElementById('detallePeriodo').textContent = resultado[0].PeriodoPago + ' - ' + resultado[0].TipoQuincena;
        document.getElementById('detalleDepto').textContent = resultado[0].NombreDeptoSucursal;
        document.getElementById('detalleCantidad').textContent = resultado[0].CantidadColaboradores;
        document.getElementById('detalleMonto').textContent = formatearMoneda(resultado[0].MontoPlanilla);

        const estadoBadge = document.getElementById('detalleEstado');
        estadoBadge.textContent = resultado[0].NombreEstado;
        estadoBadge.className = 'badge badge-' + obtenerClaseEstado(resultado[0].Estado);

        // Mostrar información de autorización/anulación si existe
        const infoAutorizacionCard = document.getElementById('infoAutorizacionAnulacion');
        const rowMotivoAnulacion = document.getElementById('rowMotivoAnulacion');

        // Estados: 0=Pendiente, 1=Autorizado, 2=Pendiente comprobante, 3=Completado, 4=Anulado
        // Mostrar info si está autorizado (1), pendiente comprobante (2), completado (3) o anulado (4)
        if (resultado[0].Estado >= 1) {
            if (resultado[0].NombreUsuarioAutorizaAnula && resultado[0].NombreUsuarioAutorizaAnula.trim() !== '') {
                infoAutorizacionCard.style.display = 'block';
                document.getElementById('detalleUsuarioAutorizo').textContent = resultado[0].NombreUsuarioAutorizaAnula;
                document.getElementById('detalleFechaAutorizo').textContent = formatearFechaHora(resultado[0].FechaHoraAutorizo);

                // Mostrar motivo de anulación solo si está anulado
                if (resultado[0].Estado === 4) {
                    infoAutorizacionCard.classList.add('anulado');
                    if (resultado[0].MotivoAnulacion && resultado[0].MotivoAnulacion.trim() !== '') {
                        rowMotivoAnulacion.style.display = 'flex';
                        document.getElementById('detalleMotivoAnulacion').textContent = resultado[0].MotivoAnulacion;
                    } else {
                        rowMotivoAnulacion.style.display = 'flex';
                        document.getElementById('detalleMotivoAnulacion').textContent = 'No se especificó motivo';
                    }
                } else {
                    infoAutorizacionCard.classList.remove('anulado');
                    rowMotivoAnulacion.style.display = 'none';
                }
            } else {
                infoAutorizacionCard.style.display = 'none';
            }
        } else {
            infoAutorizacionCard.style.display = 'none';
        }
        
        // Llenar tabla de colaboradores
        const tbody = document.getElementById('detalleColaboradoresBody');
        tbody.innerHTML = '';
        
        let totalPlanilla = 0;
        
        resultado.forEach((detalle, index) => {
            const tr = document.createElement('tr');
            tr.style.animation = `fadeIn 0.5s ease-out ${index * 0.05}s backwards`;
            
            tr.innerHTML = `
                <td>${detalle.NombreColaborador}</td>
                <td class="th-center">${detalle.CantidadDiasLaborados}</td>
                <td class="th-money">${formatearMoneda(detalle.MontoDia)}</td>
                <td class="th-money">${formatearMoneda(detalle.SubTotal)}</td>
            `;
            
            tbody.appendChild(tr);
            totalPlanilla += parseFloat(detalle.SubTotal);
        });
        
        // Actualizar total
        document.getElementById('totalPlanillaDetalle').textContent = formatearMoneda(totalPlanilla);
        
        // Mostrar modal
        document.getElementById('modalDetalle').classList.add('active');
        
    } catch (error) {
        console.error('Error al obtener detalle:', error);
        mostrarLoading(false);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el detalle de la planilla',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Cerrar modal de detalle
function cerrarModalDetalle() {
    document.getElementById('modalDetalle').classList.remove('active');
    planillaActual = null;
}

// Ver documento de la planilla
async function verDocumento(idPlanilla) {
    mostrarLoading(true);
    
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT
                DocumentosPlanillasVacacionistas.IdDocPagpVacacionista, 
                DocumentosPlanillasVacacionistas.NombreDocumento, 
                DocumentosPlanillasVacacionistas.ArchivoCargado, 
                DocumentosPlanillasVacacionistas.FechaCargado, 
                DocumentosPlanillasVacacionistas.NombreUsuarioCargo
            FROM
                DocumentosPlanillasVacacionistas
            WHERE
                DocumentosPlanillasVacacionistas.IdPagoPlanillaVacacionista = ?
            ORDER BY DocumentosPlanillasVacacionistas.FechaCargado DESC
            LIMIT 1
        `;
        
        const resultado = await connection.query(query, [idPlanilla]);
        await connection.close();
        
        mostrarLoading(false);
        
        if (resultado.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Sin documento',
                text: 'No se encontró ningún documento asociado a esta planilla',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        const documento = resultado[0];
        
        // Llenar información del documento
        document.getElementById('docNombre').textContent = documento.NombreDocumento;
        document.getElementById('docUsuario').textContent = documento.NombreUsuarioCargo;
        document.getElementById('docFecha').textContent = formatearFechaHora(documento.FechaCargado);
        
        // Convertir el archivo a blob y mostrarlo en el iframe
        if (documento.ArchivoCargado) {
            try {
                let blob;
                
                // Verificar el tipo de dato del archivo
                if (Buffer.isBuffer(documento.ArchivoCargado)) {
                    blob = new Blob([documento.ArchivoCargado], { type: 'application/pdf' });
                } else if (typeof documento.ArchivoCargado === 'string') {
                    let base64Data = documento.ArchivoCargado;
                    
                    // Limpiar el base64 si tiene el prefijo
                    if (base64Data.includes(',')) {
                        base64Data = base64Data.split(',')[1];
                    }
                    
                    // Convertir base64 a blob
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    blob = new Blob([bytes], { type: 'application/pdf' });
                } else {
                    throw new Error('Formato de archivo no reconocido');
                }
                
                const blobUrl = URL.createObjectURL(blob);
                
                // Mostrar en el iframe
                document.getElementById('pdfViewer').src = blobUrl;
                
                // Configurar botón de descarga
                const btnDescargar = document.getElementById('btnDescargarDoc');
                btnDescargar.onclick = () => {
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = documento.NombreDocumento || 'Comprobante_Planilla.pdf';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Descarga iniciada',
                        text: 'El documento se está descargando',
                        timer: 2000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                };
                
                // Mostrar modal
                document.getElementById('modalDocumento').classList.add('active');
                
            } catch (error) {
                console.error('Error al procesar el PDF:', error);
                throw new Error('Error al procesar el documento PDF: ' + error.message);
            }
        } else {
            throw new Error('No hay archivo disponible');
        }
        
    } catch (error) {
        console.error('Error al obtener documento:', error);
        mostrarLoading(false);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo cargar el documento',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Cerrar modal de documento
function cerrarModalDocumento() {
    document.getElementById('modalDocumento').classList.remove('active');
    // Limpiar el iframe
    document.getElementById('pdfViewer').src = '';
}

// Cerrar modales al hacer clic fuera de ellos
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'modalDetalle') {
            cerrarModalDetalle();
        } else if (e.target.id === 'modalDocumento') {
            cerrarModalDocumento();
        }
    }
});

// Cerrar modales con tecla ESC
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('modalDetalle').classList.contains('active')) {
            cerrarModalDetalle();
        }
        if (document.getElementById('modalDocumento').classList.contains('active')) {
            cerrarModalDocumento();
        }
    }
});

// Mostrar/ocultar loading overlay
function mostrarLoading(mostrar) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (mostrar) {
        loadingOverlay.classList.add('active');
    } else {
        loadingOverlay.classList.remove('active');
    }
}

// Funciones de formato
function formatearMoneda(valor) {
    if (!valor) return 'Q 0.00';
    const numero = parseFloat(valor);
    return 'Q ' + numero.toLocaleString('es-GT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatearFecha(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    const opciones = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'UTC'
    };
    return date.toLocaleDateString('es-GT', opciones);
}

function formatearFechaHora(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    const opciones = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleString('es-GT', opciones);
}

// Hacer funciones globales para que puedan ser llamadas desde el HTML
window.verDetalle = verDetalle;
window.verDocumento = verDocumento;
window.cerrarModalDetalle = cerrarModalDetalle;
window.cerrarModalDocumento = cerrarModalDocumento;