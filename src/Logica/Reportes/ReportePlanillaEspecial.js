const odbc = require('odbc');
const Swal = require('sweetalert2');
const conexion = 'DSN=recursos2'; // Asegúrate de tener configurado el DSN correctamente
const XLSX = require('xlsx');
// Variables globales
let planillasData = []; // Datos obtenidos de la base de datos
let filteredData = []; // Datos después de aplicar filtros
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let currentSort = { field: 'fechaCreacion', direction: 'desc' }; // Ordenamiento por defecto
let departamentosLista = []; // Lista de departamentos para el selector

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

// Función para cargar los departamentos
async function cargarDepartamentos() {
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento
            FROM
                departamentos
            ORDER BY
                departamentos.NombreDepartamento ASC
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        departamentosLista = result;
        
        // Llenar el selector de departamentos
        const departmentFilter = document.getElementById('departmentFilter');
        departmentFilter.innerHTML = '<option value="all">Todos los departamentos</option>';
        
        result.forEach(depto => {
            const option = document.createElement('option');
            option.value = depto.IdDepartamento;
            option.textContent = depto.NombreDepartamento;
            departmentFilter.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarError('Error al cargar datos', 'No se pudieron cargar los departamentos. Por favor intente nuevamente.');
    }
}

// Función para cargar las planillas especiales
async function cargarPlanillasEspeciales() {
    mostrarCargando(true);
    
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT
                PlanillasEspeciales.IdPlanillaEspecial, 
                PlanillasEspeciales.NombreUsuario, 
                PlanillasEspeciales.IdDepartamento, 
                PlanillasEspeciales.NombreDepartamento, 
                PlanillasEspeciales.CantColaboradores, 
                PlanillasEspeciales.MontoTotalGasto, 
                PlanillasEspeciales.FechaLaboral, 
                PlanillasEspeciales.DescripcionLaboral, 
                PlanillasEspeciales.FechaCreacion, 
                PlanillasEspeciales.FechaHoraCreacion
            FROM
                PlanillasEspeciales
            ORDER BY
                PlanillasEspeciales.FechaCreacion DESC,
                PlanillasEspeciales.FechaHoraCreacion DESC
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Procesar los datos
        planillasData = result.map(row => {
            return {
                id: row.IdPlanillaEspecial,
                nombreUsuario: row.NombreUsuario,
                idDepartamento: row.IdDepartamento,
                nombreDepartamento: row.NombreDepartamento,
                cantColaboradores: row.CantColaboradores,
                montoTotal: parseFloat(row.MontoTotalGasto || 0),
                fechaLaboral: row.FechaLaboral,
                descripcionLaboral: row.DescripcionLaboral,
                fechaCreacion: row.FechaCreación,
                horaCreacion: extraerHora(row.FechaHoraCreacion)
            };
        });
        
        // Aplicar filtros iniciales
        aplicarFiltros();
        
        // Actualizar resumen
        actualizarResumen();
    } catch (error) {
        console.error('Error al cargar planillas:', error);
        mostrarError('Error al cargar datos', 'No se pudieron cargar las planillas especiales. Por favor intente nuevamente.');
        filteredData = [];
    } finally {
        mostrarCargando(false);
        renderizarTabla();
    }
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
    const busqueda = document.getElementById('userSearch').value.toLowerCase().trim();
    const departamento = document.getElementById('departmentFilter').value;
    const fechaInicio = document.getElementById('startDate').value;
    const fechaFin = document.getElementById('endDate').value;
    const tipoFecha = document.querySelector('input[name="dateType"]:checked').value;
    
    // Aplicar filtros
    filteredData = planillasData.filter(planilla => {
        // Filtro de búsqueda por nombre de usuario
        const coincideBusqueda = busqueda === '' || 
                               planilla.nombreUsuario.toLowerCase().includes(busqueda);
        
        // Filtro de departamento
        const coincideDepartamento = departamento === 'all' || 
                                   planilla.idDepartamento.toString() === departamento;
        
        // Filtro de rango de fechas
        let coincideFechas = true;
        
        if (fechaInicio && fechaFin) {
            let fechaPlanilla;
            
            if (tipoFecha === 'creation') {
                // Usar fecha de creación
                fechaPlanilla = new Date(planilla.fechaCreacion);
            } else {
                // Usar fecha laboral
                fechaPlanilla = new Date(planilla.fechaLaboral);
            }
            
            const fechaInicioFiltro = new Date(fechaInicio);
            const fechaFinFiltro = new Date(fechaFin);
            
            // Ajustar las fechas para ignorar la hora
            fechaPlanilla.setHours(0, 0, 0, 0);
            fechaInicioFiltro.setHours(0, 0, 0, 0);
            fechaFinFiltro.setHours(23, 59, 59, 999);
            
            coincideFechas = fechaPlanilla >= fechaInicioFiltro && fechaPlanilla <= fechaFinFiltro;
        }
        
        return coincideBusqueda && coincideDepartamento && coincideFechas;
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
            case 'id':
                valorA = a.id;
                valorB = b.id;
                break;
            case 'usuario':
                valorA = a.nombreUsuario;
                valorB = b.nombreUsuario;
                break;
            case 'departamento':
                valorA = a.nombreDepartamento;
                valorB = b.nombreDepartamento;
                break;
            case 'colaboradores':
                valorA = a.cantColaboradores;
                valorB = b.cantColaboradores;
                break;
            case 'montoTotal':
                valorA = a.montoTotal;
                valorB = b.montoTotal;
                break;
            case 'fechaLaboral':
                valorA = new Date(a.fechaLaboral);
                valorB = new Date(b.fechaLaboral);
                break;
            case 'fechaCreacion':
                valorA = new Date(a.fechaCreacion + ' ' + a.horaCreacion);
                valorB = new Date(b.fechaCreacion + ' ' + b.horaCreacion);
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
    datosVisibles.forEach((planilla, index) => {
        const row = document.createElement('tr');
        row.style.setProperty('--row-index', index);
        
        // Formatear valores monetarios
        const montoTotalStr = formatearMoneda(planilla.montoTotal);
        
        // Formatear fechas
        const fechaLaboral = formatearFecha(planilla.fechaLaboral);
        const fechaCreacion = formatearFecha(planilla.fechaCreacion);
        
        // Truncar descripción
        const descripcionCorta = planilla.descripcionLaboral && planilla.descripcionLaboral.length > 50 
            ? planilla.descripcionLaboral.substring(0, 50) + '...' 
            : planilla.descripcionLaboral || 'Sin descripción';
        
        // Construir la fila
        row.innerHTML = `
            <td>${planilla.id}</td>
            <td>${planilla.nombreUsuario}</td>
            <td>${planilla.nombreDepartamento}</td>
            <td>${planilla.cantColaboradores}</td>
            <td>${montoTotalStr}</td>
            <td>${fechaLaboral}</td>
            <td>${fechaCreacion}</td>
            <td title="${planilla.descripcionLaboral || 'Sin descripción'}">${descripcionCorta}</td>
            <td>
                <div class="table-actions">
                    <button class="table-action-button btn-detail" data-id="${planilla.id}" title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="table-action-button btn-print" data-id="${planilla.id}" title="Imprimir">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Agregar eventos a los botones
        row.querySelector('.btn-detail').addEventListener('click', () => abrirModalDetalle(planilla.id));
        
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
    // Total de planillas
    document.getElementById('totalPlanillas').textContent = planillasData.length;
    
    // Total de colaboradores
    const totalColaboradores = planillasData.reduce((sum, planilla) => sum + planilla.cantColaboradores, 0);
    document.getElementById('totalColaboradores').textContent = totalColaboradores;
    
    // Total de departamentos (únicos)
    const departamentosUnicos = new Set(planillasData.map(p => p.idDepartamento));
    document.getElementById('totalDepartamentos').textContent = departamentosUnicos.size;
    
    // Monto total
    const montoTotal = planillasData.reduce((sum, planilla) => sum + planilla.montoTotal, 0);
    document.getElementById('montoTotal').textContent = formatearMoneda(montoTotal);
}

// Función para abrir el modal de detalle de planilla
async function abrirModalDetalle(idPlanilla) {
    try {
        mostrarCargando(true);
        
        // Buscar primero en los datos ya cargados
        const planilla = planillasData.find(p => p.id === idPlanilla);
        
        if (!planilla) {
            throw new Error('No se encontró la planilla especificada');
        }
        
        // Actualizar información general en el modal
        document.getElementById('modalPlanillaId').textContent = planilla.id;
        document.getElementById('modalUsuario').textContent = planilla.nombreUsuario;
        document.getElementById('modalDepartamento').textContent = planilla.nombreDepartamento;
        document.getElementById('modalFechaLaboral').textContent = formatearFecha(planilla.fechaLaboral);
        document.getElementById('modalFechaCreacion').textContent = formatearFecha(planilla.fechaCreacion);
        document.getElementById('modalHoraCreacion').textContent = planilla.horaCreacion;
        
        // Descripción
        document.getElementById('modalDescripcion').textContent = planilla.descripcionLaboral || 'No hay descripción disponible';
        
        // Resumen
        document.getElementById('modalTotalColaboradores').textContent = planilla.cantColaboradores;
        document.getElementById('modalMontoTotal').textContent = formatearMoneda(planilla.montoTotal);
        
        // Cargar detalle de colaboradores
        await cargarDetalleColaboradores(idPlanilla);
        
        // Mostrar el modal
        const modal = document.getElementById('planillaModal');
        modal.classList.add('active');
        
        // Prevenir el scroll del body
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error al abrir detalle:', error);
        mostrarError('Error al cargar detalles', 'No se pudo cargar el detalle de la planilla. Por favor intente nuevamente.');
    } finally {
        mostrarCargando(false);
    }
}

// Función para cargar el detalle de colaboradores de una planilla
async function cargarDetalleColaboradores(idPlanilla) {
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT
                DetallePlanillaEspecial.IdPersonal, 
                DetallePlanillaEspecial.NombreColaborador, 
                DetallePlanillaEspecial.Monto, 
                DetallePlanillaEspecial.IdPuesto,
                DetallePlanillaEspecial.NombrePuesto
            FROM
                DetallePlanillaEspecial
            WHERE
                DetallePlanillaEspecial.IdPlanillaEspecial = ?
            ORDER BY
                DetallePlanillaEspecial.NombreColaborador ASC
        `;
        
        const result = await connection.query(query, [idPlanilla]);
        await connection.close();
        
        const tbody = document.getElementById('modalDetailData');
        tbody.innerHTML = '';
        
        if (result.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="4" style="text-align: center;">No hay colaboradores registrados en esta planilla</td>`;
            tbody.appendChild(row);
            return;
        }
        
        // Renderizar filas para cada colaborador
        result.forEach(colaborador => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${colaborador.IdPersonal}</td>
                <td>${colaborador.NombreColaborador || 'Sin nombre'}</td>
                <td>${colaborador.NombrePuesto || 'Sin puesto'}</td>
                <td>${formatearMoneda(parseFloat(colaborador.Monto || 0))}</td>
            `;
            
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error al cargar detalle de colaboradores:', error);
        throw error;
    }
}

// Función para cerrar el modal
function cerrarModal() {
    const modal = document.getElementById('planillaModal');
    modal.classList.remove('active');
    
    // Restaurar el scroll del body
    document.body.style.overflow = '';
}
// Función para exportar detalle a Excel
async function exportarDetalleExcel() {
    try {
        // Obtener ID de la planilla actual
        const idPlanilla = document.getElementById('modalPlanillaId').textContent;
        
        if (!idPlanilla) {
            mostrarError('Error', 'No se pudo identificar la planilla actual');
            return;
        }
        
        mostrarCargando(true);
        
        // Buscar la planilla en los datos ya cargados
        const planilla = planillasData.find(p => p.id.toString() === idPlanilla.toString());
        
        if (!planilla) {
            throw new Error('No se encontró la planilla especificada');
        }
        
        // Obtener detalle de colaboradores
        const connection = await connectionString();
        const query = `
            SELECT
                DetallePlanillaEspecial.IdPersonal, 
                DetallePlanillaEspecial.NombreColaborador, 
                DetallePlanillaEspecial.Monto, 
                DetallePlanillaEspecial.IdPuesto,
                DetallePlanillaEspecial.NombrePuesto
            FROM
                DetallePlanillaEspecial
            WHERE
                DetallePlanillaEspecial.IdPlanillaEspecial = ?
            ORDER BY
                DetallePlanillaEspecial.NombreColaborador ASC
        `;
        
        const colaboradores = await connection.query(query, [idPlanilla]);
        await connection.close();
        
        // Crear un nuevo libro de trabajo
        const workbook = XLSX.utils.book_new();
        
        // Preparar los datos para el Excel - Info general
        const infoGeneral = [{
            'ID Planilla': planilla.id,
            'Usuario': planilla.nombreUsuario,
            'Departamento': planilla.nombreDepartamento,
            'Colaboradores': planilla.cantColaboradores,
            'Monto Total': planilla.montoTotal,
            'Fecha Laboral': formatearFecha(planilla.fechaLaboral),
            'Fecha Creación': formatearFecha(planilla.fechaCreacion),
            'Hora Creación': planilla.horaCreacion,
            'Descripción': planilla.descripcionLaboral || ''
        }];
        
        // Preparar los datos para el Excel - Colaboradores
        const datosColaboradores = colaboradores.map(colaborador => ({
            'ID': colaborador.IdPersonal,
            'Colaborador': colaborador.NombreColaborador || 'Sin nombre',
            'Puesto': colaborador.NombrePuesto || 'Sin puesto',
            'Monto': parseFloat(colaborador.Monto || 0)
        }));
        
        // Crear las hojas de cálculo
        const worksheetInfo = XLSX.utils.json_to_sheet(infoGeneral);
        const worksheetColaboradores = XLSX.utils.json_to_sheet(datosColaboradores);
        
        // Agregar las hojas al libro
        XLSX.utils.book_append_sheet(workbook, worksheetInfo, 'Información');
        XLSX.utils.book_append_sheet(workbook, worksheetColaboradores, 'Colaboradores');
        
        // Configurar ancho de columnas
        const anchosInfo = [
            { wch: 15 }, // ID Planilla
            { wch: 25 }, // Usuario
            { wch: 25 }, // Departamento
            { wch: 15 }, // Colaboradores
            { wch: 15 }, // Monto Total
            { wch: 15 }, // Fecha Laboral
            { wch: 15 }, // Fecha Creación
            { wch: 15 }, // Hora Creación
            { wch: 50 }  // Descripción
        ];
        
        const anchosColaboradores = [
            { wch: 10 }, // ID
            { wch: 30 }, // Colaborador
            { wch: 30 }, // Puesto
            { wch: 15 }  // Monto
        ];
        
        worksheetInfo['!cols'] = anchosInfo;
        worksheetColaboradores['!cols'] = anchosColaboradores;
        
        // Generar el archivo Excel
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        
        // Determinar si estamos en un entorno web o Node.js
        if (typeof window !== 'undefined') {
            // Estamos en un navegador
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `Planilla_Especial_${idPlanilla}_${formatearFechaArchivo(new Date())}.xlsx`;
            document.body.appendChild(a);
            a.click();
            
            // Limpiar
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                mostrarCargando(false);
            }, 100);
        } else {
            // Estamos en Node.js
            const fs = require('fs');
            const filename = `Planilla_Especial_${idPlanilla}_${formatearFechaArchivo(new Date())}.xlsx`;
            fs.writeFileSync(filename, excelBuffer);
            console.log(`Archivo guardado como ${filename}`);
            mostrarCargando(false);
        }
        
    } catch (error) {
        console.error('Error al exportar detalle a Excel:', error);
        mostrarError('Error al exportar', 'No se pudo generar el archivo Excel de detalle.');
        mostrarCargando(false);
    }
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
        confirmButtonColor: '#ff7b00'
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
    cargarDepartamentos().then(() => {
        cargarPlanillasEspeciales();
    });
    
    // Eventos para filtros
    document.getElementById('searchButton').addEventListener('click', () => {
        aplicarFiltros();
        renderizarTabla();
    });
    
    // Evento para Enter en el campo de búsqueda
    document.getElementById('userSearch').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById('searchButton').click();
        }
    });
    
    // Evento para cambio en el selector de departamento
    document.getElementById('departmentFilter').addEventListener('change', () => {
        aplicarFiltros();
        renderizarTabla();
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
    
    // Evento para ordenar
    document.getElementById('sortBy').addEventListener('change', function() {
        const value = this.value;
        
        // Configurar el campo y dirección de ordenamiento
        switch (value) {
            case 'dateDesc':
                currentSort = { field: 'fechaCreacion', direction: 'desc' };
                break;
            case 'dateAsc':
                currentSort = { field: 'fechaCreacion', direction: 'asc' };
                break;
            case 'amountDesc':
                currentSort = { field: 'montoTotal', direction: 'desc' };
                break;
            case 'amountAsc':
                currentSort = { field: 'montoTotal', direction: 'asc' };
                break;
            case 'employeesDesc':
                currentSort = { field: 'colaboradores', direction: 'desc' };
                break;
            case 'employeesAsc':
                currentSort = { field: 'colaboradores', direction: 'asc' };
                break;
            case 'departmentAsc':
                currentSort = { field: 'departamento', direction: 'asc' };
                break;
            case 'departmentDesc':
                currentSort = { field: 'departamento', direction: 'desc' };
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
        document.getElementById('userSearch').value = '';
        
        // Resetear selector de departamento
        document.getElementById('departmentFilter').value = 'all';
        
        // Limpiar fechas
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        
        // Restaurar tipo de fecha
        document.getElementById('creationDate').checked = true;
        
        // Aplicar filtros (que ahora están vacíos)
        aplicarFiltros();
        renderizarTabla();
    });
    
    // Evento para refrescar datos
    document.getElementById('refreshReport').addEventListener('click', () => {
        cargarPlanillasEspeciales();
    });
    
    // Eventos para el modal
    document.getElementById('closeModal').addEventListener('click', cerrarModal);
    document.getElementById('closeModalBtn').addEventListener('click', cerrarModal);
    
    // Evento para exportar detalle a Excel desde el modal
    document.getElementById('exportDetailExcel').addEventListener('click', exportarDetalleExcel);
    
    // Cerrar modal al hacer clic fuera de él
    document.getElementById('planillaModal').addEventListener('click', (event) => {
        if (event.target === document.getElementById('planillaModal')) {
            cerrarModal();
        }
    });
});