const odbc = require('odbc');
const Swal = require('sweetalert2');
const conexion = 'DSN=recursos2'; // Asegúrate de tener configurado el DSN correctamente

// Variables globales
let suspensionesData = []; // Datos obtenidos de la base de datos
let filteredData = []; // Datos después de aplicar filtros
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let currentSort = { field: 'startDate', direction: 'desc' }; // Ordenamiento por defecto

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

// Función para cargar las suspensiones
async function cargarSuspensiones() {
    mostrarCargando(true);
    
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT 
                s.IdSuspension,
                s.IdPersonal,
                s.FechaInicio,
                s.FechaFin,
                s.MotivoSuspension AS Motivo,
                s.IdUsuario,
                s.FechaGenero,
                s.FechaHoraGenero,
                p.PrimerNombre,
                p.SegundoNombre,
                p.TercerNombre,
                p.PrimerApellido,
                p.SegundoApellido,
                d.NombreDepartamento,
                CONCAT(u.PrimerNombre, ' ', u.PrimerApellido) AS UsuarioCreador,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM 
                Suspensiones s
                INNER JOIN personal p ON s.IdPersonal = p.IdPersonal
                INNER JOIN departamentos d ON p.IdSucuDepa = d.IdDepartamento
                INNER JOIN personal u ON s.IdUsuario = u.IdPersonal
                LEFT JOIN FotosPersonal ON p.IdPersonal = FotosPersonal.IdPersonal
            ORDER BY 
                s.FechaGenero DESC
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Procesar los datos
        suspensionesData = result.map(row => {
            // Calcular la duración en días
            const fechaInicio = new Date(row.FechaInicio);
            const fechaFin = new Date(row.FechaFin);
            const diferenciaTiempo = fechaFin.getTime() - fechaInicio.getTime();
            const duracionDias = Math.round(diferenciaTiempo / (1000 * 3600 * 24)) + 1;
            
            // Crear un objeto normalizado con todos los datos
            return {
                id: row.IdSuspension,
                idPersonal: row.IdPersonal,
                nombreCompleto: formatearNombre(row),
                departamento: row.NombreDepartamento,
                fechaInicio: row.FechaInicio,
                fechaFin: row.FechaFin,
                motivo: row.Motivo,
                duracion: duracionDias,
                usuarioCreador: row.UsuarioCreador,
                fechaCreacion: row.FechaGenero,
                horaCreacion: extraerHora(row.FechaHoraGenero),
                fotoBase64: row.FotoBase64 || '../Imagenes/user-default.png',
                // Determinar el estado de la suspensión (activa, inactiva, etc.)
                estado: determinarEstado(row.FechaInicio, row.FechaFin)
            };
        });
        
        // Aplicar filtros iniciales (si existen)
        aplicarFiltros();
        
        // Actualizar resumen
        actualizarResumen();
    } catch (error) {
        console.error('Error al cargar suspensiones:', error);
        mostrarError('Error al cargar datos', 'No se pudieron cargar las suspensiones. Por favor intente nuevamente.');
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

// Función para determinar el estado de una suspensión
function determinarEstado(fechaInicio, fechaFin) {
    const hoy = new Date();
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    // Ajustar las fechas para ignorar la hora
    hoy.setHours(0, 0, 0, 0);
    inicio.setHours(0, 0, 0, 0);
    fin.setHours(0, 0, 0, 0);
    
    if (hoy < inicio) {
        return { clase: 'pendiente', texto: 'Pendiente' };
    } else if (hoy > fin) {
        return { clase: 'finalizada', texto: 'Finalizada' };
    } else {
        return { clase: 'activa', texto: 'Activa' };
    }
}

// Función para aplicar filtros a los datos
function aplicarFiltros() {
    // Obtener valores de los filtros
    const busqueda = document.getElementById('employeeSearch').value.toLowerCase().trim();
    const fechaInicio = document.getElementById('startDate').value;
    const fechaFin = document.getElementById('endDate').value;
    const tipoFecha = document.querySelector('input[name="dateType"]:checked').value;
    
    // Aplicar filtros
    filteredData = suspensionesData.filter(suspension => {
        // Filtro de búsqueda por nombre o ID
        const coincideBusqueda = busqueda === '' || 
                               suspension.nombreCompleto.toLowerCase().includes(busqueda) || 
                               suspension.idPersonal.toString().includes(busqueda);
        
        // Filtro de rango de fechas
        let coincideFechas = true;
        
        if (fechaInicio && fechaFin) {
            const campoFecha = tipoFecha === 'suspension' ? 'fechaInicio' : 'fechaCreacion';
            const fechaSuspension = new Date(suspension[campoFecha]);
            const fechaInicioFiltro = new Date(fechaInicio);
            const fechaFinFiltro = new Date(fechaFin);
            
            // Ajustar las fechas para ignorar la hora
            fechaSuspension.setHours(0, 0, 0, 0);
            fechaInicioFiltro.setHours(0, 0, 0, 0);
            fechaFinFiltro.setHours(23, 59, 59, 999);
            
            coincideFechas = fechaSuspension >= fechaInicioFiltro && fechaSuspension <= fechaFinFiltro;
        }
        
        return coincideBusqueda && coincideFechas;
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
            case 'startDate':
                valorA = new Date(a.fechaInicio);
                valorB = new Date(b.fechaInicio);
                break;
            case 'endDate':
                valorA = new Date(a.fechaFin);
                valorB = new Date(b.fechaFin);
                break;
            case 'duration':
                valorA = a.duracion;
                valorB = b.duracion;
                break;
            case 'creationDate':
                valorA = new Date(a.fechaCreacion);
                valorB = new Date(b.fechaCreacion);
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
    datosVisibles.forEach(suspension => {
        const row = document.createElement('tr');
        
        // Formatear fechas
        const fechaInicio = formatearFecha(suspension.fechaInicio);
        const fechaFin = formatearFecha(suspension.fechaFin);
        const fechaCreacion = formatearFecha(suspension.fechaCreacion);
        
        // Construir la fila
        row.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden;">
                        <img src="${suspension.fotoBase64}" style="width: 100%; height: 100%; object-fit: cover;" alt="Foto">
                    </div>
                    <div>${suspension.nombreCompleto}</div>
                </div>
            </td>
            <td>${suspension.departamento}</td>
            <td>${fechaInicio}</td>
            <td>${fechaFin}</td>
            <td>${suspension.duracion} día${suspension.duracion !== 1 ? 's' : ''}</td>
            <td>
                <div class="motivo-truncado" title="${suspension.motivo}">
                    ${suspension.motivo.length > 50 ? suspension.motivo.substring(0, 50) + '...' : suspension.motivo}
                </div>
            </td>
            <td>${fechaCreacion}</td>
            <td>
                <div class="table-actions">
                    <button class="table-action-button btn-detail" data-id="${suspension.id}" title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="table-action-button btn-print" data-id="${suspension.id}" title="Imprimir">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Agregar eventos a los botones
        row.querySelector('.btn-detail').addEventListener('click', () => abrirModalDetalle(suspension));
        row.querySelector('.btn-print').addEventListener('click', () => imprimirSuspension(suspension));
        
        tbody.appendChild(row);
    });
    
    // Actualizar la paginación
    actualizarPaginacion();
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
    document.getElementById('nextPage').disabled = currentPage === totalPages;
    
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
    const colaboradoresUnicos = new Set(suspensionesData.map(s => s.idPersonal));
    document.getElementById('totalEmployees').textContent = colaboradoresUnicos.size;
    
    // Total de suspensiones
    document.getElementById('totalSuspensions').textContent = suspensionesData.length;
    
    // Promedio de duración
    const totalDias = suspensionesData.reduce((suma, suspension) => suma + suspension.duracion, 0);
    const promedioDias = suspensionesData.length > 0 ? Math.round(totalDias / suspensionesData.length) : 0;
    document.getElementById('avgDuration').textContent = promedioDias + ' días';
}

// Función para abrir el modal de detalle
function abrirModalDetalle(suspension) {
    // Actualizar los datos en el modal
    document.getElementById('modalEmployeeName').textContent = suspension.nombreCompleto;
    document.getElementById('modalEmployeeDepartment').textContent = suspension.departamento;
    document.getElementById('modalEmployeeId').textContent = suspension.idPersonal;
    document.getElementById('modalEmployeePhoto').src = suspension.fotoBase64;
    
    document.getElementById('modalStartDate').textContent = formatearFecha(suspension.fechaInicio);
    document.getElementById('modalEndDate').textContent = formatearFecha(suspension.fechaFin);
    document.getElementById('modalDuration').textContent = `${suspension.duracion} día${suspension.duracion !== 1 ? 's' : ''}`;
    
    // Estado de la suspensión
    const estadoBadge = document.getElementById('modalStatus');
    estadoBadge.innerHTML = `<span class="status-badge ${suspension.estado.clase}">${suspension.estado.texto}</span>`;
    
    document.getElementById('modalReason').textContent = suspension.motivo;
    
    document.getElementById('modalCreatedBy').textContent = suspension.usuarioCreador;
    document.getElementById('modalCreationDate').textContent = formatearFecha(suspension.fechaCreacion);
    document.getElementById('modalCreationTime').textContent = suspension.horaCreacion;
    
    // Mostrar el modal
    const modal = document.getElementById('suspensionModal');
    modal.classList.add('active');
    
    // Prevenir el scroll del body
    document.body.style.overflow = 'hidden';
}

// Función para cerrar el modal
function cerrarModal() {
    const modal = document.getElementById('suspensionModal');
    modal.classList.remove('active');
    
    // Restaurar el scroll del body
    document.body.style.overflow = '';
}
// Función para imprimir una suspensión individual
function imprimirSuspension(suspension) {
    // Crear una ventana de impresión
    const ventanaImpresion = window.open('', '_blank');
    
    // Generar el contenido HTML para imprimir
    const contenidoHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Suspensión - ${suspension.nombreCompleto}</title>
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
                    border-bottom: 2px solid #3f51b5;
                }
                .logo {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 5px;
                    color: #3f51b5;
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
                    color: #3f51b5;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                    margin-bottom: 15px;
                }
                .detail-grid {
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
                .reason-box {
                    background-color: #f9f9f9;
                    padding: 15px;
                    border-radius: 5px;
                    margin-top: 10px;
                    border: 1px solid #eee;
                }
                .status-badge {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    color: white;
                }
                .status-badge.pendiente {
                    background-color: #ff9800;
                }
                .status-badge.activa {
                    background-color: #4caf50;
                }
                .status-badge.finalizada {
                    background-color: #9e9e9e;
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
                <div class="title">Reporte de Suspensión</div>
                <div class="date">Generado el: ${new Date().toLocaleDateString('es-GT')} a las ${new Date().toLocaleTimeString('es-GT', {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
            
            <div class="employee-info">
                <div class="employee-photo">
                    <img src="${suspension.fotoBase64}" alt="Foto de colaborador">
                </div>
                <div class="employee-details">
                    <div class="employee-name">${suspension.nombreCompleto}</div>
                    <p><strong>Departamento:</strong> ${suspension.departamento}</p>
                    <p><strong>ID:</strong> ${suspension.idPersonal}</p>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Información de la Suspensión</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Fecha de Inicio</div>
                        <div>${formatearFecha(suspension.fechaInicio)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Fecha de Finalización</div>
                        <div>${formatearFecha(suspension.fechaFin)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Duración</div>
                        <div>${suspension.duracion} día${suspension.duracion !== 1 ? 's' : ''}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Estado</div>
                        <div><span class="status-badge ${suspension.estado.clase}">${suspension.estado.texto}</span></div>
                    </div>
                </div>
                
                <div class="detail-label">Motivo de la Suspensión</div>
                <div class="reason-box">
                    ${suspension.motivo}
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Información de Registro</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Registrado por</div>
                        <div>${suspension.usuarioCreador}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Fecha de Registro</div>
                        <div>${formatearFecha(suspension.fechaCreacion)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Hora de Registro</div>
                        <div>${suspension.horaCreacion}</div>
                    </div>
                </div>
            </div>
            
            <div class="footer">
                <p>Documento interno de Recursos Humanos</p>
                <p>© New Technology ${new Date().getFullYear()}</p>
            </div>
            
            <div class="no-print" style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="padding: 10px 20px; background-color: #3f51b5; color: white; border: none; border-radius: 5px; cursor: pointer;">
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

// Función para exportar a Excel
async function exportarExcel() {
    try {
        // Verificar si hay datos para exportar
        if (filteredData.length === 0) {
            mostrarError('Sin datos', 'No hay datos para exportar a Excel.');
            return;
        }
        
        mostrarCargando(true);
        
        // Crear un nuevo libro de trabajo
        const XLSX = window.XLSX;
        const workbook = XLSX.utils.book_new();
        
        // Preparar los datos para el Excel
        const datosExcel = filteredData.map(suspension => ({
            'ID': suspension.id,
            'Colaborador': suspension.nombreCompleto,
            'Departamento': suspension.departamento,
            'Fecha Inicio': formatearFecha(suspension.fechaInicio),
            'Fecha Fin': formatearFecha(suspension.fechaFin),
            'Duración (días)': suspension.duracion,
            'Motivo': suspension.motivo,
            'Estado': suspension.estado.texto,
            'Fecha de Registro': formatearFecha(suspension.fechaCreacion),
            'Hora de Registro': suspension.horaCreacion,
            'Registrado por': suspension.usuarioCreador
        }));
        
        // Crear una hoja de cálculo con los datos
        const worksheet = XLSX.utils.json_to_sheet(datosExcel);
        
        // Agregar la hoja al libro
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Suspensiones');
        
        // Configurar ancho de columnas
        const anchos = [
            { wch: 5 },  // ID
            { wch: 30 }, // Colaborador
            { wch: 20 }, // Departamento
            { wch: 12 }, // Fecha Inicio
            { wch: 12 }, // Fecha Fin
            { wch: 10 }, // Duración
            { wch: 40 }, // Motivo
            { wch: 12 }, // Estado
            { wch: 12 }, // Fecha Registro
            { wch: 10 }, // Hora Registro
            { wch: 25 }  // Registrado por
        ];
        worksheet['!cols'] = anchos;
        
        // Generar el archivo Excel
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        
        // Crear un Blob con los datos
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Crear un URL para el Blob
        const url = URL.createObjectURL(blob);
        
        // Crear un enlace para descargar el archivo
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Suspensiones_${formatearFechaArchivo(new Date())}.xlsx`;
        document.body.appendChild(a);
        a.click();
        
        // Limpiar
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            mostrarCargando(false);
        }, 100);
        
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        mostrarError('Error al exportar', 'No se pudo generar el archivo Excel.');
        mostrarCargando(false);
    }
}

// Función para exportar a PDF
async function exportarPDF() {
    try {
        // Verificar si hay datos para exportar
        if (filteredData.length === 0) {
            mostrarError('Sin datos', 'No hay datos para exportar a PDF.');
            return;
        }
        
        mostrarCargando(true);
        
        // Crear una ventana para generar el PDF
        const ventanaPDF = window.open('', '_blank');
        
        // Generar encabezados de tabla
        let filasTabla = '';
        filteredData.forEach(suspension => {
            filasTabla += `
                <tr>
                    <td>${suspension.nombreCompleto}</td>
                    <td>${suspension.departamento}</td>
                    <td>${formatearFecha(suspension.fechaInicio)}</td>
                    <td>${formatearFecha(suspension.fechaFin)}</td>
                    <td>${suspension.duracion} día${suspension.duracion !== 1 ? 's' : ''}</td>
                    <td>${suspension.motivo}</td>
                    <td>${formatearFecha(suspension.fechaCreacion)}</td>
                </tr>
            `;
        });
        
        // Generar el contenido HTML para el PDF
        const contenidoHTML = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reporte de Suspensiones</title>
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
                        border-bottom: 2px solid #3f51b5;
                    }
                    .logo {
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 5px;
                        color: #3f51b5;
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
                    .summary {
                        display: flex;
                        justify-content: space-around;
                        margin-bottom: 20px;
                        background-color: #f9f9f9;
                        padding: 15px;
                        border-radius: 5px;
                    }
                    .summary-item {
                        text-align: center;
                    }
                    .summary-value {
                        font-size: 20px;
                        font-weight: bold;
                        color: #3f51b5;
                    }
                    .summary-label {
                        font-size: 12px;
                        color: #777;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                        font-size: 12px;
                    }
                    th {
                        background-color: #f2f2f2;
                        color: #333;
                        font-weight: bold;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .footer {
                        margin-top: 40px;
                        font-size: 12px;
                        color: #777;
                        text-align: center;
                        border-top: 1px solid #eee;
                        padding-top: 15px;
                    }
                    .filters {
                        margin-bottom: 20px;
                        padding: 10px;
                        background-color: #f2f2f2;
                        border-radius: 5px;
                        font-size: 12px;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 15px;
                        }
                        button {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">RECURSOS HUMANOS</div>
                    <div class="title">Reporte de Suspensiones</div>
                    <div class="date">Generado el: ${new Date().toLocaleDateString('es-GT')} a las ${new Date().toLocaleTimeString('es-GT', {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
                
                <div class="filters">
                    <strong>Filtros aplicados:</strong><br>
                    Búsqueda: ${document.getElementById('employeeSearch').value || 'Ninguna'}<br>
                    Rango de fechas: ${document.getElementById('startDate').value || 'Sin fecha inicial'} a ${document.getElementById('endDate').value || 'Sin fecha final'}<br>
                    Tipo de fecha: ${document.querySelector('input[name="dateType"]:checked').value === 'suspension' ? 'Fecha de Suspensión' : 'Fecha de Creación'}
                </div>
                
                <div class="summary">
                    <div class="summary-item">
                        <div class="summary-value">${document.getElementById('totalEmployees').textContent}</div>
                        <div class="summary-label">Colaboradores</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${document.getElementById('totalSuspensions').textContent}</div>
                        <div class="summary-label">Suspensiones</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${document.getElementById('avgDuration').textContent}</div>
                        <div class="summary-label">Días Promedio</div>
                    </div>
                </div>
                
                <p><strong>Total de resultados:</strong> ${filteredData.length}</p>
                
                <table>
                    <thead>
                        <tr>
                            <th>Colaborador</th>
                            <th>Departamento</th>
                            <th>Fecha Inicio</th>
                            <th>Fecha Fin</th>
                            <th>Duración</th>
                            <th>Motivo</th>
                            <th>Fecha Registro</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasTabla}
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>Documento interno de Recursos Humanos</p>
                    <p>© New Technology ${new Date().getFullYear()}</p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background-color: #3f51b5; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Imprimir
                    </button>
                    <button onclick="window.close()" style="padding: 10px 20px; background-color: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 5px; margin-left: 10px; cursor: pointer;">
                        Cerrar
                    </button>
                </div>
            </body>
            </html>
        `;
        
        // Escribir el contenido HTML en la ventana PDF
        ventanaPDF.document.write(contenidoHTML);
        ventanaPDF.document.close();
        
        // Esperar a que los recursos se carguen
        ventanaPDF.onload = function() {
            mostrarCargando(false);
        };
        
    } catch (error) {
        console.error('Error al exportar a PDF:', error);
        mostrarError('Error al exportar', 'No se pudo generar el archivo PDF.');
        mostrarCargando(false);
    }
}

// Función para imprimir el reporte completo
function imprimirReporte() {
    // Similar a exportar PDF pero optimizado para impresión
    exportarPDF();
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
        confirmButtonColor: '#3f51b5'
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
    cargarSuspensiones();
    
    // Eventos para botones de exportación
    document.getElementById('exportPDF').addEventListener('click', exportarPDF);
    
    // Eventos para filtros
    document.getElementById('searchEmployee').addEventListener('click', () => {
        aplicarFiltros();
        renderizarTabla();
    });
    
    // Evento para Enter en el campo de búsqueda
    document.getElementById('employeeSearch').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById('searchEmployee').click();
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
        currentPage = 1; // Reset to first page
        renderizarTabla();
    });
    
    // Evento para ordenar
    document.getElementById('sortBy').addEventListener('change', function() {
        const value = this.value;
        
        // Configurar el campo y dirección de ordenamiento
        switch (value) {
            case 'dateDesc':
                currentSort = { field: 'startDate', direction: 'desc' };
                break;
            case 'dateAsc':
                currentSort = { field: 'startDate', direction: 'asc' };
                break;
            case 'durationDesc':
                currentSort = { field: 'duration', direction: 'desc' };
                break;
            case 'durationAsc':
                currentSort = { field: 'duration', direction: 'asc' };
                break;
            case 'nameAsc':
                currentSort = { field: 'employee', direction: 'asc' };
                break;
            case 'nameDesc':
                currentSort = { field: 'employee', direction: 'desc' };
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
        document.getElementById('suspensionDate').checked = true;
        
        // Aplicar filtros (que ahora están vacíos)
        aplicarFiltros();
        renderizarTabla();
    });
    
    // Evento para refrescar datos
    document.getElementById('refreshReport').addEventListener('click', () => {
        cargarSuspensiones();
    });
    
    // Eventos para el modal
    document.getElementById('closeModal').addEventListener('click', cerrarModal);
    document.getElementById('closeModalBtn').addEventListener('click', cerrarModal);
    
    // Evento para imprimir desde el modal
    document.getElementById('printDetail').addEventListener('click', () => {
        // Encontrar la suspensión actual en el modal
        const idPersonal = document.getElementById('modalEmployeeId').textContent;
        const suspension = filteredData.find(s => s.idPersonal.toString() === idPersonal);
        
        if (suspension) {
            imprimirSuspension(suspension);
        }
    });
    
    // Cerrar modal al hacer clic fuera de él
    document.getElementById('suspensionModal').addEventListener('click', (event) => {
        if (event.target === document.getElementById('suspensionModal')) {
            cerrarModal();
        }
    });
});