const odbc = require('odbc');
const Swal = require('sweetalert2');
const conexion = 'DSN=recursos2'; // Asegúrate de tener configurado el DSN correctamente

// Variables globales
let descuentosData = []; // Datos obtenidos de la base de datos
let filteredData = []; // Datos después de aplicar filtros
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let currentSort = { field: 'registerDate', direction: 'desc' }; // Ordenamiento por defecto
let zoomLevel = 1; // Para la visualización de documentos

// Función para obtener la conexión a la base de datos
async function connectionString() {
    try {
        const connection = await odbc.connect(conexion, {
            binaryAsString: true,
            bigint: 'string'
        });
        
        // Configuración adicional de la conexión
        await connection.query('SET NAMES utf8mb4');
        await connection.query('SET character_set_results = utf8mb4');
        
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

// Función para cargar los descuentos judiciales
async function cargarDescuentosJudiciales() {
    mostrarCargando(true);
    
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT 
                d.IdDescuentoJudicial,
                d.IdPersonal,
                d.NoDocumento,
                d.MontoEmbargo,
                d.LiquidacionProcesales,
                d.MontoLiquidacionProcesal,
                d.MontoTotal,
                d.DescuentoQuincenal,
                d.DescuentoQuincenalFinMes,
                d.SaldoPendiente,
                d.FechaRegistro,
                d.FechaHoraRegistro,
                d.IdUsuario,
                d.Estado,
                CASE 
                    WHEN d.Scaner IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(d.Scaner))
                    ELSE NULL 
                END AS Scaner,
                p.PrimerNombre,
                p.SegundoNombre,
                p.TercerNombre,
                p.PrimerApellido,
                p.SegundoApellido,
                dep.NombreDepartamento,
                CONCAT(u.PrimerNombre, ' ', u.PrimerApellido) AS UsuarioCreador,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM 
                DescuentosJudiciales d
                INNER JOIN personal p ON d.IdPersonal = p.IdPersonal
                INNER JOIN departamentos dep ON p.IdSucuDepa = dep.IdDepartamento
                INNER JOIN personal u ON d.IdUsuario = u.IdPersonal
                LEFT JOIN FotosPersonal ON p.IdPersonal = FotosPersonal.IdPersonal
            ORDER BY 
                d.FechaRegistro DESC, d.FechaHoraRegistro DESC
        `;
        
        const result = await connection.query(query);
        
        // Cargar información de pagos para cada descuento
        for (const descuento of result) {
            const pagosQuery = `
                SELECT 
                    dd.IdDetalleDescuentoJudicial,
                    dd.Descuento,
                    dd.SaldoAnterior,
                    dd.SaldoActual,
                    dd.FechaDescuento,
                    dd.FechaHoraDescuento,
                    dd.IdPagoPlanilla
                FROM 
                    DescuentosJudicialesDetalle dd
                WHERE 
                    dd.IdDescuentoJudicial = ?
                ORDER BY 
                    dd.FechaDescuento DESC, dd.FechaHoraDescuento DESC
            `;
            
            descuento.pagos = await connection.query(pagosQuery, [descuento.IdDescuentoJudicial]);
        }
        
        await connection.close();
        
        // Procesar los datos
        descuentosData = result.map(row => {
            // Calcular monto total pagado
            const totalPagado = row.pagos && row.pagos.length > 0 
                ? row.pagos.reduce((sum, pago) => sum + parseFloat(pago.Descuento || 0), 0)
                : 0;
            
            // Calcular porcentaje de progreso
            const porcentajePagado = row.MontoTotal > 0 
                ? Math.min(100, Math.round((totalPagado / parseFloat(row.MontoTotal)) * 100))
                : 0;
                
            // Determinar si está completado
            const estaCompletado = row.SaldoPendiente <= 0 || porcentajePagado >= 100;
            
            // Determinar estado
            let estado;
            if (row.Estado === 1) {
                estado = { clase: 'completed', texto: 'Finalizado' };
            } else if (porcentajePagado > 0) {
                estado = { clase: 'active', texto: 'En Proceso' };
            } else {
                estado = { clase: 'pending', texto: 'Pendiente' };
            }
            
            // Convertir la imagen del escáner si existe
            const scanerBase64 = row.Scaner || null;
            
            // Crear un objeto normalizado con todos los datos
            return {
                id: row.IdDescuentoJudicial,
                idPersonal: row.IdPersonal,
                nombreCompleto: formatearNombre(row),
                departamento: row.NombreDepartamento,
                noDocumento: row.NoDocumento,
                montoEmbargo: parseFloat(row.MontoEmbargo || 0),
                liquidacionProcesales: parseFloat(row.LiquidacionProcesales || 0),
                montoLiquidacionProcesal: parseFloat(row.MontoLiquidacionProcesal || 0),
                montoTotal: parseFloat(row.MontoTotal || 0),
                descuentoQuincenal: parseFloat(row.DescuentoQuincenal || 0),
                descuentoQuincenalFinMes: parseFloat(row.DescuentoQuincenalFinMes || 0),
                saldoPendiente: parseFloat(row.SaldoPendiente || 0),
                fechaRegistro: row.FechaRegistro,
                horaRegistro: extraerHora(row.FechaHoraRegistro),
                usuarioCreador: row.UsuarioCreador,
                fotoBase64: row.FotoBase64 || '../Imagenes/user-default.png',
                scaner: scanerBase64,
                pagos: row.pagos || [],
                totalPagado: totalPagado,
                porcentajePagado: porcentajePagado,
                estado: estado
            };
        });
        
        // Aplicar filtros iniciales
        aplicarFiltros();
        
        // Actualizar resumen
        actualizarResumen();
    } catch (error) {
        console.error('Error al cargar descuentos judiciales:', error);
        mostrarError('Error al cargar datos', 'No se pudieron cargar los descuentos judiciales. Por favor intente nuevamente.');
        filteredData = [];
    } finally {
        mostrarCargando(false);
        renderizarTabla();
    }
}

// Función para formatear el nombre completo
function formatearNombre(persona) {
    return [
        persona.PrimerNombre,
        persona.SegundoNombre || '',
        persona.TercerNombre || '',
        persona.PrimerApellido,
        persona.SegundoApellido || ''
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

// Función para extraer la hora de un timestamp
function extraerHora(timestamp) {
    if (!timestamp) return '';
    
    // Si es una cadena de fecha/hora
    if (typeof timestamp === 'string') {
        const partes = timestamp.split(' ');
        if (partes.length > 1) {
            return partes[1].substring(0, 5); // Obtener solo HH:MM
        }
    }
    
    // Si es un objeto Date
    if (timestamp instanceof Date) {
        return timestamp.toTimeString().substring(0, 5);
    }
    
    return '';
}

// Función para aplicar filtros a los datos
function aplicarFiltros() {
    // Obtener valores de los filtros
    const busqueda = document.getElementById('employeeSearch').value.toLowerCase().trim();
    const fechaInicio = document.getElementById('startDate').value;
    const fechaFin = document.getElementById('endDate').value;
    const tipoFecha = document.querySelector('input[name="dateType"]:checked').value;
    const estadoFiltro = document.getElementById('statusFilter').value;
    
    // Aplicar filtros
    filteredData = descuentosData.filter(descuento => {
        // Filtro de búsqueda por nombre o ID o número de documento
        const coincideBusqueda = busqueda === '' || 
                                 descuento.nombreCompleto.toLowerCase().includes(busqueda) || 
                                 descuento.idPersonal.toString().includes(busqueda) ||
                                 descuento.noDocumento.toLowerCase().includes(busqueda);
        
        // Filtro de rango de fechas
        let coincideFechas = true;
        
        if (fechaInicio && fechaFin) {
            let fechaDescuento;
            
            if (tipoFecha === 'register') {
                // Usar fecha de registro
                fechaDescuento = new Date(descuento.fechaRegistro);
            } else {
                // Usar fecha del último pago si existe
                if (descuento.pagos && descuento.pagos.length > 0) {
                    fechaDescuento = new Date(descuento.pagos[0].FechaDescuento);
                } else {
                    // No hay pagos, no coincide con filtro de pagos
                    return false;
                }
            }
            
            const fechaInicioFiltro = new Date(fechaInicio);
            const fechaFinFiltro = new Date(fechaFin);
            
            // Ajustar las fechas para ignorar la hora
            fechaDescuento.setHours(0, 0, 0, 0);
            fechaInicioFiltro.setHours(0, 0, 0, 0);
            fechaFinFiltro.setHours(23, 59, 59, 999);
            
            coincideFechas = fechaDescuento >= fechaInicioFiltro && fechaDescuento <= fechaFinFiltro;
        }
        
        // Filtro de estado
        let coincideEstado = true;
        
        if (estadoFiltro !== 'all') {
            if (estadoFiltro === 'active') {
                coincideEstado = descuento.estado.clase === 'active' || descuento.estado.clase === 'pending';
            } else if (estadoFiltro === 'completed') {
                coincideEstado = descuento.estado.clase === 'completed';
            }
        }
        
        return coincideBusqueda && coincideFechas && coincideEstado;
    });
    
    // Aplicar ordenamiento
    ordenarDatos();
    
    // Reiniciar paginación
    currentPage = 1;
    totalPages = Math.ceil(filteredData.length / pageSize);
    
    // Actualizar contador de resultados
    document.getElementById('resultCount').textContent = filteredData.length;
    
    // Mostrar estado vacío si no hay resultados
    if (filteredData.length === 0) {
        document.getElementById('emptyState').style.display = 'flex';
    } else {
        document.getElementById('emptyState').style.display = 'none';
    }
}

// Función para ordenar los datos
function ordenarDatos() {
    filteredData.sort((a, b) => {
        let valorA, valorB;
        
        // Obtener los valores a comparar según el campo
        switch (currentSort.field) {
            case 'employee':
                valorA = a.nombreCompleto;
                valorB = b.nombreCompleto;
                break;
            case 'department':
                valorA = a.departamento;
                valorB = b.departamento;
                break;
            case 'document':
                valorA = a.noDocumento;
                valorB = b.noDocumento;
                break;
            case 'amount':
                valorA = a.montoEmbargo;
                valorB = b.montoEmbargo;
                break;
            case 'liquidation':
                valorA = a.liquidacionProcesales;
                valorB = b.liquidacionProcesales;
                break;
            case 'totalAmount':
                valorA = a.montoTotal;
                valorB = b.montoTotal;
                break;
            case 'balance':
                valorA = a.saldoPendiente;
                valorB = b.saldoPendiente;
                break;
            case 'status':
                valorA = a.estado.texto;
                valorB = b.estado.texto;
                break;
            case 'registerDate':
                valorA = new Date(a.fechaRegistro + ' ' + a.horaRegistro);
                valorB = new Date(b.fechaRegistro + ' ' + b.horaRegistro);
                break;
            default:
                valorA = a[currentSort.field];
                valorB = b[currentSort.field];
        }
        
        // Realizar la comparación
        let resultado;
        if (typeof valorA === 'string' && typeof valorB === 'string') {
            resultado = valorA.localeCompare(valorB);
        } else {
            resultado = valorA > valorB ? 1 : valorA < valorB ? -1 : 0;
        }
        
        // Aplicar dirección del ordenamiento
        return currentSort.direction === 'asc' ? resultado : -resultado;
    });
}

// Función para renderizar la tabla con los datos filtrados y ordenados
function renderizarTabla() {
    const tbody = document.getElementById('reportData');
    tbody.innerHTML = '';
    
    // Calcular el rango de elementos a mostrar
    const inicio = (currentPage - 1) * pageSize;
    const fin = Math.min(inicio + pageSize, filteredData.length);
    const datosVisibles = filteredData.slice(inicio, fin);
    
    if (datosVisibles.length === 0) {
        // No hay datos que mostrar
        return;
    }
    
    // Crear las filas
    datosVisibles.forEach(descuento => {
        const row = document.createElement('tr');
        
        // Formatear valores monetarios
        const montoEmbargoStr = formatearMoneda(descuento.montoEmbargo);
        const liquidacionStr = `${descuento.liquidacionProcesales}%`;
        const montoTotalStr = formatearMoneda(descuento.montoTotal);
        const saldoPendienteStr = formatearMoneda(descuento.saldoPendiente);
        
        // Formatear fechas
        const fechaRegistro = formatearFecha(descuento.fechaRegistro);
        
        // Construir la fila
        row.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden;">
                        <img src="${descuento.fotoBase64}" style="width: 100%; height: 100%; object-fit: cover;" alt="Foto">
                    </div>
                    <div>${descuento.nombreCompleto}</div>
                </div>
            </td>
            <td>${descuento.departamento}</td>
            <td>${descuento.noDocumento}</td>
            <td>${montoEmbargoStr}</td>
            <td>${liquidacionStr}</td>
            <td>${montoTotalStr}</td>
            <td>${saldoPendienteStr}</td>
            <td>
                <span class="status-badge ${descuento.estado.clase}" style="display: inline-block; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: 600; color: white;">
                    ${descuento.estado.texto}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="table-action-button btn-detail" data-id="${descuento.id}" title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="table-action-button btn-print" data-id="${descuento.id}" title="Imprimir">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Agregar eventos a los botones
        row.querySelector('.btn-detail').addEventListener('click', () => abrirModalDetalle(descuento));
        row.querySelector('.btn-print').addEventListener('click', () => imprimirDescuento(descuento));
        
        tbody.appendChild(row);
    });
    
    // Actualizar la paginación
    actualizarPaginacion();
}
// Función para formatear moneda
function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-GT', { 
        style: 'currency', 
        currency: 'GTQ',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
    }).format(valor);
}

// Función para formatear fecha
function formatearFecha(fechaStr) {
    if (!fechaStr) return '';
    
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-GT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Función para actualizar la paginación
function actualizarPaginacion() {
    const paginationContainer = document.getElementById('pageNumbers');
    paginationContainer.innerHTML = '';
    
    // Botones de página anterior y siguiente
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
    
    // Si no hay páginas, no mostrar nada
    if (totalPages === 0) {
        return;
    }
    
    // Determinar qué números de página mostrar
    let startPage = Math.max(currentPage - 2, 1);
    let endPage = Math.min(startPage + 4, totalPages);
    
    // Ajustar si estamos cerca del final
    if (endPage === totalPages) {
        startPage = Math.max(endPage - 4, 1);
    }
    
    // Página 1
    if (startPage > 1) {
        const pageNumber = document.createElement('span');
        pageNumber.className = 'page-number';
        pageNumber.textContent = '1';
        pageNumber.addEventListener('click', () => cambiarPagina(1));
        paginationContainer.appendChild(pageNumber);
        
        // Elipsis si hay un salto
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            paginationContainer.appendChild(ellipsis);
        }
    }
    
    // Páginas intermedias
    for (let i = startPage; i <= endPage; i++) {
        const pageNumber = document.createElement('span');
        pageNumber.className = 'page-number' + (i === currentPage ? ' active' : '');
        pageNumber.textContent = i;
        pageNumber.addEventListener('click', () => cambiarPagina(i));
        paginationContainer.appendChild(pageNumber);
    }
    
    // Última página
    if (endPage < totalPages) {
        // Elipsis si hay un salto
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            paginationContainer.appendChild(ellipsis);
        }
        
        const pageNumber = document.createElement('span');
        pageNumber.className = 'page-number';
        pageNumber.textContent = totalPages;
        pageNumber.addEventListener('click', () => cambiarPagina(totalPages));
        paginationContainer.appendChild(pageNumber);
    }
}

// Función para cambiar de página
function cambiarPagina(nuevaPagina) {
    currentPage = nuevaPagina;
    renderizarTabla();
    
    // Desplazarse suavemente al inicio de la tabla
    document.querySelector('.report-content').scrollIntoView({ behavior: 'smooth' });
}

// Función para actualizar el resumen de datos
function actualizarResumen() {
    // Total de colaboradores (únicos)
    const colaboradoresUnicos = new Set(descuentosData.map(d => d.idPersonal));
    document.getElementById('totalEmployees').textContent = colaboradoresUnicos.size;
    
    // Total de descuentos
    document.getElementById('totalDiscounts').textContent = descuentosData.length;
    
    // Monto total
    const montoTotal = descuentosData.reduce((suma, descuento) => suma + descuento.montoTotal, 0);
    document.getElementById('totalAmount').textContent = formatearMoneda(montoTotal);
    
    // Saldo pendiente
    const saldoPendiente = descuentosData.reduce((suma, descuento) => suma + descuento.saldoPendiente, 0);
    document.getElementById('pendingAmount').textContent = formatearMoneda(saldoPendiente);
}

// Función para abrir el modal de detalle
function abrirModalDetalle(descuento) {
    // Activar la primera pestaña
    cambiarTab('info');
    
    // Actualizar los datos en el modal - Información general
    document.getElementById('modalEmployeeName').textContent = descuento.nombreCompleto;
    document.getElementById('modalEmployeeDepartment').textContent = descuento.departamento;
    document.getElementById('modalEmployeeId').textContent = descuento.idPersonal;
    document.getElementById('modalEmployeePhoto').src = descuento.fotoBase64;
    
    document.getElementById('modalDocumentNo').textContent = descuento.noDocumento;
    document.getElementById('modalRegisterDate').textContent = formatearFecha(descuento.fechaRegistro);
    document.getElementById('modalCreatedBy').textContent = descuento.usuarioCreador;
    
    // Estado del descuento
    const estadoBadge = document.getElementById('modalStatus');
    estadoBadge.innerHTML = `<span class="status-badge ${descuento.estado.clase}">${descuento.estado.texto}</span>`;
    
    // Valores del descuento
    document.getElementById('modalEmbargoAmount').textContent = formatearMoneda(descuento.montoEmbargo);
    document.getElementById('modalLiquidationPercent').textContent = `${descuento.liquidacionProcesales}%`;
    document.getElementById('modalLiquidationAmount').textContent = formatearMoneda(descuento.montoLiquidacionProcesal);
    document.getElementById('modalTotalAmount').textContent = formatearMoneda(descuento.montoTotal);
    
    // Distribución de pagos
    document.getElementById('modalMidMonthAmount').textContent = formatearMoneda(descuento.descuentoQuincenal);
    document.getElementById('modalEndMonthAmount').textContent = formatearMoneda(descuento.descuentoQuincenalFinMes);
    
    // Progreso de pago
    document.getElementById('modalPaymentPercentage').textContent = `${descuento.porcentajePagado}%`;
    document.getElementById('modalProgressFill').style.width = `${descuento.porcentajePagado}%`;
    document.getElementById('modalProgressTotal').textContent = formatearMoneda(descuento.montoTotal);
    document.getElementById('modalProgressPaid').textContent = formatearMoneda(descuento.totalPagado);
    document.getElementById('modalProgressPending').textContent = formatearMoneda(descuento.saldoPendiente);
    
    // Pestaña de pagos
    const pagosContainer = document.getElementById('paymentsHistoryData');
    pagosContainer.innerHTML = '';
    
    if (descuento.pagos && descuento.pagos.length > 0) {
        document.getElementById('totalPayments').textContent = descuento.pagos.length;
        document.getElementById('emptyPayments').style.display = 'none';
        
        descuento.pagos.forEach(pago => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${formatearFecha(pago.FechaDescuento)}</td>
                <td>${formatearMoneda(pago.Descuento)}</td>
                <td>${formatearMoneda(pago.SaldoAnterior)}</td>
                <td>${formatearMoneda(pago.SaldoActual)}</td>
                <td>${pago.IdPagoPlanilla}</td>
            `;
            
            pagosContainer.appendChild(row);
        });
    } else {
        document.getElementById('totalPayments').textContent = '0';
        document.getElementById('emptyPayments').style.display = 'flex';
    }
    
    // Pestaña de documento
    const documentContainer = document.getElementById('documentContainer');
    const noDocument = document.getElementById('noDocument');

    if (descuento.scaner) {
        // Mostrar la imagen directamente, sin intentar procesar más el base64
        documentContainer.innerHTML = `<img src="${descuento.scaner}" alt="Documento escaneado" id="scanerImage" style="transform: scale(${zoomLevel});">`;
        documentContainer.style.display = 'flex';
        noDocument.style.display = 'none';
        
        // Restablecer nivel de zoom
        zoomLevel = 1;
        
        // Para debugging
        console.log("Mostrando imagen del escáner:", descuento.scaner.substring(0, 100) + "...");
    } else {
        documentContainer.innerHTML = '';
        documentContainer.style.display = 'none';
        noDocument.style.display = 'flex';
        console.log("No hay imagen del escáner disponible");
    }
    
    // Mostrar el modal
    const modal = document.getElementById('discountModal');
    modal.classList.add('active');
    
    // Prevenir el scroll del body
    document.body.style.overflow = 'hidden';
}

// Función para cambiar entre tabs del modal
function cambiarTab(tabId) {
    // Actualizar botones de pestaña
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
    
    // Actualizar contenido
    document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabId}-tab`).classList.add('active');
}

// Función para cerrar el modal
function cerrarModal() {
    const modal = document.getElementById('discountModal');
    modal.classList.remove('active');
    
    // Restaurar el scroll del body
    document.body.style.overflow = '';
}

// Funciones para controlar el zoom del documento
function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 0.1, 3);
    aplicarZoom();
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
    aplicarZoom();
}

function aplicarZoom() {
    const imagen = document.getElementById('scanerImage');
    if (imagen) {
        imagen.style.transform = `scale(${zoomLevel})`;
    }
}

// Función para descargar el documento
function descargarDocumento() {
    const imagen = document.getElementById('scanerImage');
    if (!imagen || !imagen.src) {
        mostrarError('Error', 'No hay documento para descargar');
        return;
    }
    
    // Crear un enlace de descarga
    const enlace = document.createElement('a');
    enlace.href = imagen.src;
    enlace.download = `Documento_${Date.now()}.jpg`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
}

// Función para imprimir un descuento individual
function imprimirDescuento(descuento) {
    // Crear una ventana de impresión
    const ventanaImpresion = window.open('', '_blank');
    
    // Generar el contenido HTML para imprimir
    const contenidoHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Descuento Judicial - ${descuento.nombreCompleto}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    color: #333;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #5c6bc0;
                }
                .logo {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 5px;
                    color: #5c6bc0;
                }
                .title {
                    font-size: 18px;
                    color: #555;
                }
                .date {
                    font-size: 12px;
                    color: #777;
                    margin-top: 5px;
                }
                .employee-info {
                    display: flex;
                    margin-bottom: 20px;
                    border: 1px solid #eee;
                    padding: 15px;
                    border-radius: 5px;
                }
                .employee-photo {
                    width: 100px;
                    margin-right: 20px;
                }
                .employee-photo img {
                    width: 100%;
                    border-radius: 5px;
                }
                .employee-details {
                    flex: 1;
                }
                .employee-name {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .detail-section {
                    margin-bottom: 20px;
                }
                h3 {
                    color: #5c6bc0;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                    margin-bottom: 15px;
                }
                .grid-container {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                }
                .detail-item {
                    margin-bottom: 10px;
                }
                .detail-label {
                    font-weight: bold;
                    color: #555;
                    font-size: 14px;
                    margin-bottom: 3px;
                }
                .status-badge {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    color: white;
                }
                .status-badge.active {
                    background-color: #4caf50;
                }
                .status-badge.completed {
                    background-color: #00bfa5;
                }
                .status-badge.pending {
                    background-color: #ff9800;
                }
                .payment-cards {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-top: 15px;
                }
                .payment-card {
                    border: 1px solid #eee;
                    border-radius: 5px;
                    padding: 15px;
                    background-color: #f9f9f9;
                }
                .payment-title {
                    font-size: 14px;
                    color: #777;
                    margin-bottom: 8px;
                }
                .payment-amount {
                    font-size: 18px;
                    font-weight: 600;
                }
                .progress-container {
                    margin-top: 30px;
                    padding: 15px;
                    background-color: #f5f5f5;
                    border-radius: 5px;
                }
                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                .progress-bar {
                    height: 15px;
                    background-color: #e0e0e0;
                    border-radius: 8px;
                    overflow: hidden;
                    margin-bottom: 15px;
                }
                .progress-fill {
                    height: 100%;
                    background-color: #4caf50;
                    width: ${descuento.porcentajePagado}%;
                }
                .progress-info {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 10px;
                }
                .progress-data {
                    text-align: center;
                    flex: 1;
                }
                .progress-label {
                    font-size: 12px;
                    color: #777;
                    margin-bottom: 5px;
                }
                .progress-value {
                    font-size: 16px;
                    font-weight: 600;
                }
                .payments-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                .payments-table th {
                    background-color: #f2f2f2;
                    text-align: left;
                    padding: 8px;
                    font-size: 14px;
                    border-bottom: 2px solid #ddd;
                }
                .payments-table td {
                    padding: 8px;
                    border-bottom: 1px solid #ddd;
                    font-size: 14px;
                }
                .payments-table tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                .no-payments {
                    text-align: center;
                    padding: 20px;
                    color: #777;
                    font-style: italic;
                }
                .footer {
                    margin-top: 40px;
                    font-size: 12px;
                    color: #777;
                    text-align: center;
                    border-top: 1px solid #eee;
                    padding-top: 15px;
                }
                @media print {
                    body {
                        margin: 0;
                        padding: 15px;
                    }
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">RECURSOS HUMANOS</div>
                <div class="title">Reporte de Descuento Judicial</div>
                <div class="date">Generado el: ${new Date().toLocaleDateString('es-GT')} a las ${new Date().toLocaleTimeString('es-GT', {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
            
            <div class="employee-info">
                <div class="employee-photo">
                    <img src="${descuento.fotoBase64}" alt="Foto de colaborador">
                </div>
                <div class="employee-details">
                    <div class="employee-name">${descuento.nombreCompleto}</div>
                    <p><strong>Departamento:</strong> ${descuento.departamento}</p>
                    <p><strong>ID:</strong> ${descuento.idPersonal}</p>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Información del Descuento Judicial</h3>
                <div class="grid-container">
                    <div class="detail-item">
                        <div class="detail-label">No. de Documento</div>
                        <div>${descuento.noDocumento}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Fecha de Registro</div>
                        <div>${formatearFecha(descuento.fechaRegistro)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Estado</div>
                        <div><span class="status-badge ${descuento.estado.clase}">${descuento.estado.texto}</span></div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Registrado por</div>
                        <div>${descuento.usuarioCreador}</div>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Montos del Descuento</h3>
                <div class="grid-container">
                    <div class="detail-item">
                        <div class="detail-label">Monto del Embargo</div>
                        <div>${formatearMoneda(descuento.montoEmbargo)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Porcentaje de Liquidación</div>
                        <div>${descuento.liquidacionProcesales}%</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Monto de Liquidación Procesal</div>
                        <div>${formatearMoneda(descuento.montoLiquidacionProcesal)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Monto Total</div>
                        <div><strong>${formatearMoneda(descuento.montoTotal)}</strong></div>
                    </div>
                </div>
                
                <div class="payment-cards">
                    <div class="payment-card">
                        <div class="payment-title">Descuento Quincena Medio Mes</div>
                        <div class="payment-amount">${formatearMoneda(descuento.descuentoQuincenal)}</div>
                    </div>
                    <div class="payment-card">
                        <div class="payment-title">Descuento Quincena Fin de Mes</div>
                        <div class="payment-amount">${formatearMoneda(descuento.descuentoQuincenalFinMes)}</div>
                    </div>
                </div>
            </div>
            
            <div class="progress-container">
                <div class="progress-header">
                    <strong>Progreso del Pago</strong>
                    <div>${descuento.porcentajePagado}%</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <div class="progress-info">
                    <div class="progress-data">
                        <div class="progress-label">Monto Total</div>
                        <div class="progress-value">${formatearMoneda(descuento.montoTotal)}</div>
                    </div>
                    <div class="progress-data">
                        <div class="progress-label">Pagado</div>
                        <div class="progress-value">${formatearMoneda(descuento.totalPagado)}</div>
                    </div>
                    <div class="progress-data">
                        <div class="progress-label">Saldo Pendiente</div>
                        <div class="progress-value">${formatearMoneda(descuento.saldoPendiente)}</div>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Historial de Pagos</h3>
                ${descuento.pagos.length > 0 ? `
                    <table class="payments-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Monto</th>
                                <th>Saldo Anterior</th>
                                <th>Saldo Actual</th>
                                <th>Planilla</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${descuento.pagos.map(pago => `
                                <tr>
                                    <td>${formatearFecha(pago.FechaDescuento)}</td>
                                    <td>${formatearMoneda(pago.Descuento)}</td>
                                    <td>${formatearMoneda(pago.SaldoAnterior)}</td>
                                    <td>${formatearMoneda(pago.SaldoActual)}</td>
                                    <td>${pago.IdPagoPlanilla}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : `
                    <div class="no-payments">
                        Aún no hay pagos registrados para este descuento judicial
                    </div>
                `}
            </div>
            
            <div class="footer">
                <p>Documento interno de Recursos Humanos</p>
                <p>© New Technology ${new Date().getFullYear()}</p>
            </div>
            
            <div class="no-print" style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="padding: 10px 20px; background-color: #5c6bc0; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Imprimir
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; background-color: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 5px; margin-left: 10px; cursor: pointer;">
                    Cerrar
                </button>
            </div>
        </body>
        </html>
    `;
    
    // Escribir el contenido HTML en la ventana de impresión
    ventanaImpresion.document.write(contenidoHTML);
    ventanaImpresion.document.close();
    
    // Esperar a que los recursos se carguen y luego imprimir
    ventanaImpresion.onload = function() {
        // Imprimir automáticamente (opcional)
        // ventanaImpresion.print();
    };
}

// Función para formatear fecha para nombres de archivo
function formatearFechaArchivo(fecha) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const hours = String(fecha.getHours()).padStart(2, '0');
    const minutes = String(fecha.getMinutes()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}`;
}

// Función para mostrar u ocultar el indicador de carga
function mostrarCargando(mostrar) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = mostrar ? 'flex' : 'none';
}

// Función para mostrar un mensaje de error
function mostrarError(titulo, mensaje) {
    Swal.fire({
        icon: 'error',
        title: titulo,
        text: mensaje,
        confirmButtonColor: '#5c6bc0'
    });
}

// Función para mostrar un mensaje de éxito
function mostrarExito(titulo, mensaje) {
    Swal.fire({
        icon: 'success',
        title: titulo,
        text: mensaje,
        confirmButtonColor: '#4CAF50',
        timer: 3000,
        timerProgressBar: true
    });
}

// Eventos
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos iniciales
    cargarDescuentosJudiciales();
    
    // Eventos para filtros
    document.getElementById('searchButton').addEventListener('click', () => {
        aplicarFiltros();
        renderizarTabla();
    });
    
    // Evento para Enter en el campo de búsqueda
    document.getElementById('employeeSearch').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById('searchButton').click();
        }
    });
    
    // Evento para aplicar filtro de fechas
    document.getElementById('applyDateFilter').addEventListener('click', () => {
        aplicarFiltros();
        renderizarTabla();
    });
    
    // Eventos para cambio de tipo de fecha
    document.querySelectorAll('input[name="dateType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (document.getElementById('startDate').value && document.getElementById('endDate').value) {
                aplicarFiltros();
                renderizarTabla();
            }
        });
    });
    
    // Evento para toggle de filtros avanzados
    document.getElementById('toggleAdvanced').addEventListener('click', function() {
        const advancedOptions = document.querySelector('.advanced-options');
        const displayStyle = advancedOptions.style.display;
        
        advancedOptions.style.display = displayStyle === 'none' ? 'block' : 'none';
        this.classList.toggle('active');
        
        // Animar el ícono
        const icon = this.querySelector('i');
        icon.style.transform = displayStyle === 'none' ? 'rotate(180deg)' : 'rotate(0deg)';
    });
    
    // Evento para cambiar tamaño de página
    document.getElementById('pageSize').addEventListener('change', function() {
        pageSize = parseInt(this.value);
        totalPages = Math.ceil(filteredData.length / pageSize);
        currentPage = 1; // Reset a primera página
        renderizarTabla();
    });
    
    // Evento para filtro de estado
    document.getElementById('statusFilter').addEventListener('change', function() {
        aplicarFiltros();
        renderizarTabla();
    });
    
    // Evento para ordenar
    document.getElementById('sortBy').addEventListener('change', function() {
        const value = this.value;
        
        // Configurar el campo y dirección de ordenamiento
        switch (value) {
            case 'dateDesc':
                currentSort = { field: 'registerDate', direction: 'desc' };
                break;
            case 'dateAsc':
                currentSort = { field: 'registerDate', direction: 'asc' };
                break;
            case 'amountDesc':
                currentSort = { field: 'totalAmount', direction: 'desc' };
                break;
            case 'amountAsc':
                currentSort = { field: 'totalAmount', direction: 'asc' };
                break;
            case 'nameAsc':
                currentSort = { field: 'employee', direction: 'asc' };
                break;
            case 'nameDesc':
                currentSort = { field: 'employee', direction: 'desc' };
                break;
            case 'balanceDesc':
                currentSort = { field: 'balance', direction: 'desc' };
                break;
            case 'balanceAsc':
                currentSort = { field: 'balance', direction: 'asc' };
                break;
        }
        
        ordenarDatos();
        renderizarTabla();
    });
    
    // Evento para botones de ordenación en encabezados de tabla
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const campo = this.dataset.sort;
            
            // Cambiar dirección si es el mismo campo
            if (currentSort.field === campo) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.field = campo;
                currentSort.direction = 'asc';
            }
            
            // Actualizar clases de ordenamiento
            document.querySelectorAll('th.sortable').forEach(header => {
                header.classList.remove('sorted-asc', 'sorted-desc');
            });
            
            this.classList.add(`sorted-${currentSort.direction}`);
            
            ordenarDatos();
            renderizarTabla();
        });
    });
    
    // Evento para botones de paginación
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            cambiarPagina(currentPage - 1);
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        if (currentPage < totalPages) {
            cambiarPagina(currentPage + 1);
        }
    });
    
    // Evento para limpiar filtros
    document.getElementById('clearFilters').addEventListener('click', () => {
        // Limpiar campo de búsqueda
        document.getElementById('employeeSearch').value = '';
        
        // Limpiar fechas
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        
        // Restaurar tipo de fecha
        document.getElementById('registerDate').checked = true;
        
        // Restaurar filtro de estado
        document.getElementById('statusFilter').value = 'all';
        
        // Aplicar filtros (que ahora están vacíos)
        aplicarFiltros();
        renderizarTabla();
    });
    
    // Evento para refrescar datos
    document.getElementById('refreshReport').addEventListener('click', () => {
        cargarDescuentosJudiciales();
    });
    
    // Eventos para el modal
    document.getElementById('closeModal').addEventListener('click', cerrarModal);
    document.getElementById('closeModalBtn').addEventListener('click', cerrarModal);
    
    // Evento para cambiar de tab en el modal
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => cambiarTab(button.dataset.tab));
    });
    
    // Eventos para el visor de documentos
    document.getElementById('zoomIn').addEventListener('click', zoomIn);
    document.getElementById('zoomOut').addEventListener('click', zoomOut);
    document.getElementById('downloadDocument').addEventListener('click', descargarDocumento);
    
    // Evento para imprimir desde el modal
    document.getElementById('printDetail').addEventListener('click', () => {
        // Encontrar el descuento actual en el modal
        const idPersonal = document.getElementById('modalEmployeeId').textContent;
        const descuento = filteredData.find(d => d.idPersonal.toString() === idPersonal);
        
        if (descuento) {
            imprimirDescuento(descuento);
        }
    });
    
    // Cerrar modal al hacer clic fuera de él
    document.getElementById('discountModal').addEventListener('click', (event) => {
        if (event.target === document.getElementById('discountModal')) {
            cerrarModal();
        }
    });
});