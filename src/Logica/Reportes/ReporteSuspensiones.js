const { connectionString } = require('../Conexion/Conexion');
const XLSX = require('xlsx');
const path = require('path');
const Swal = require('sweetalert2');

// Variables globales
let datosReporte = [];
let columnasOrdenamiento = {};
let tipoFiltroActual = 'todos';

// Inicialización del DOM
document.addEventListener('DOMContentLoaded', function() {
    inicializarEventos();
    configurarFechasIniciales();
    mostrarEstadoVacio();
});

function inicializarEventos() {
    // Eventos de formulario
    document.getElementById('filtrosForm').addEventListener('submit', generarReporte);
    document.getElementById('limpiarFiltros').addEventListener('click', limpiarFiltros);
    document.getElementById('exportarExcel').addEventListener('click', exportarExcel);

    // Evento de colapsar/expandir filtros
    document.getElementById('toggleFilters').addEventListener('click', toggleFiltros);
    
    // Evento de cambio de tipo de filtro
    document.getElementById('tipoFiltro').addEventListener('change', manejarCambioTipo);
    
    // Validación de fechas
    document.getElementById('fechaInicio').addEventListener('change', validarFechas);
    document.getElementById('fechaFin').addEventListener('change', validarFechas);
}

function configurarFechasIniciales() {
    const hoy = new Date();
    const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    // Configurar fecha inicio como primer día del mes actual
    document.getElementById('fechaInicio').value = formatearFechaParaInput(primerDiaDelMes);
    
    // Configurar fecha fin como hoy
    document.getElementById('fechaFin').value = formatearFechaParaInput(hoy);
}

function formatearFechaParaInput(fecha) {
    return fecha.toISOString().split('T')[0];
}

// ====================================================================
// MANEJO DE FILTROS
// ====================================================================

function toggleFiltros() {
    const filtersContent = document.getElementById('filtersContent');
    const toggleButton = document.getElementById('toggleFilters');
    const icon = toggleButton.querySelector('i');
    
    filtersContent.classList.toggle('collapsed');
    toggleButton.classList.toggle('collapsed');
    
    if (filtersContent.classList.contains('collapsed')) {
        icon.className = 'fas fa-chevron-down';
    } else {
        icon.className = 'fas fa-chevron-up';
    }
}

function manejarCambioTipo() {
    const tipoSeleccionado = document.getElementById('tipoFiltro').value;
    tipoFiltroActual = tipoSeleccionado;
    
    // Si hay datos cargados, actualizar la tabla
    if (datosReporte.length > 0) {
        mostrarTabla(datosReporte);
    }
}

function validarFechas() {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    const botonGenerar = document.querySelector('.btn-primary');
    
    if (fechaInicio && fechaFin) {
        if (new Date(fechaInicio) > new Date(fechaFin)) {
            mostrarError('La fecha de inicio no puede ser mayor que la fecha fin');
            botonGenerar.disabled = true;
            return false;
        } else {
            botonGenerar.disabled = false;
            return true;
        }
    }
    
    botonGenerar.disabled = !(fechaInicio && fechaFin);
    return fechaInicio && fechaFin;
}

function limpiarFiltros() {
    // Limpiar formulario
    document.getElementById('filtrosForm').reset();
    
    // Reconfigurar fechas iniciales
    configurarFechasIniciales();
    
    // Reiniciar tipo de filtro
    tipoFiltroActual = 'todos';
    document.getElementById('tipoFiltro').value = 'todos';
    
    // Limpiar datos y mostrar estado vacío
    datosReporte = [];
    columnasOrdenamiento = {};
    mostrarEstadoVacio();
    
    // Deshabilitar botón de exportar
    document.getElementById('exportarExcel').disabled = true;
    
    // Validar fechas
    validarFechas();
}

// ====================================================================
// GENERACIÓN DE REPORTE
// ====================================================================

async function generarReporte(event) {
    event.preventDefault();
    
    if (!validarFechas()) {
        return;
    }
    
    const formData = new FormData(event.target);
    const fechaInicio = formData.get('fechaInicio');
    const fechaFin = formData.get('fechaFin');
    const tipoFiltro = formData.get('tipoFiltro');
    
    try {
        mostrarEstadoCarga();
        
        const datos = await consultarDatos(fechaInicio, fechaFin, tipoFiltro);
        
        if (datos && datos.length > 0) {
            datosReporte = datos;
            mostrarTabla(datos);
            document.getElementById('exportarExcel').disabled = false;
        } else {
            mostrarSinResultados();
            document.getElementById('exportarExcel').disabled = true;
        }
        
    } catch (error) {
        console.error('Error al generar reporte:', error);
        mostrarErrorReporte(error.message);
        document.getElementById('exportarExcel').disabled = true;
    }
}

async function consultarDatos(fechaInicio, fechaFin, tipoFiltro) {
    try {
        const connection = await connectionString();
        
        let query = `
            SELECT
                CONCAT(
                    p.PrimerNombre, ' ',
                    COALESCE(p.SegundoNombre, ''), ' ',
                    COALESCE(p.TercerNombre, ''), ' ',
                    p.PrimerApellido, ' ',
                    COALESCE(p.SegundoApellido, '')
                ) AS NombreEmpleado,
                s.FechaInicio, 
                s.FechaFin, 
                ts.TipoSuspensiones, 
                s.MotivoSuspension, 
                CONCAT(
                    u.PrimerNombre, ' ',
                    COALESCE(u.SegundoNombre, ''), ' ',
                    COALESCE(u.TercerNombre, ''), ' ',
                    u.PrimerApellido, ' ',
                    COALESCE(u.SegundoApellido, '')
                ) AS UsuarioRegistro,
                s.fechahoragenero, 
                s.EsFalta, 
                s.ObservacionFalta,
                s.TipoSuspension
            FROM Suspensiones s
            INNER JOIN personal p ON s.IdPersonal = p.IdPersonal
            INNER JOIN TipoSuspensiones ts ON ts.IdTipoSuspension = s.TipoSuspension
            INNER JOIN personal u ON s.IdUsuario = u.IdPersonal
            WHERE s.fechahoragenero BETWEEN ? AND ?
        `;
        
        const parametros = [fechaInicio + ' 00:00:00', fechaFin + ' 23:59:59'];
        
        // Agregar filtro por tipo según TipoSuspension
        if (tipoFiltro === 'suspensiones') {
            // Para suspensiones: TipoSuspension debe ser diferente de 0
            query += ' AND s.TipoSuspension != 0';
        } else if (tipoFiltro === 'faltas') {
            // Para faltas: TipoSuspension debe ser igual a 0
            query += ' AND s.TipoSuspension = 0';
        }
        // Si es 'todos', no agregamos filtro adicional
        
        query += ' ORDER BY s.fechahoragenero ASC';
        
        const result = await connection.query(query, parametros);
        await connection.close();
        
        return result;
        
    } catch (error) {
        console.error('Error en consulta:', error);
        throw new Error('Error al consultar la base de datos: ' + error.message);
    }
}

// ====================================================================
// RENDERIZADO DE TABLA
// ====================================================================

function mostrarTabla(datos) {
    const tabla = document.getElementById('tablaResultados');
    const tbody = document.getElementById('tablaBody');
    
    // Configurar visibilidad de columnas según tipo de filtro
    configurarColumnas(tipoFiltroActual);
    
    // Limpiar tbody
    tbody.innerHTML = '';
    
    // Generar filas
    datos.forEach((registro, index) => {
        const fila = crearFilaTabla(registro, index);
        tbody.appendChild(fila);
    });
    
    // Mostrar elementos
    document.getElementById('tableContainer').style.display = 'block';
    document.getElementById('resultsHeader').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('loadingState').style.display = 'none';
    
    // Configurar eventos de ordenamiento
    configurarOrdenamiento();
}

function crearFilaTabla(registro, index) {
    const fila = document.createElement('tr');
    fila.style.animationDelay = `${index * 0.05}s`;
    
    // Limpiar espacios extra en nombres
    const nombreEmpleado = limpiarNombre(registro.NombreEmpleado);
    const usuarioRegistro = limpiarNombre(registro.UsuarioRegistro);
    
    // Formatear fechas
    const fechaInicio = formatearFecha(registro.FechaInicio);
    const fechaFin = formatearFecha(registro.FechaFin);
    const fechaRegistro = formatearFechaHora(registro.fechahoragenero);
    
    // Determinar qué datos mostrar según el TipoSuspension
    const esFalta = registro.TipoSuspension == 0; // Si TipoSuspension es 0, es falta
    const tipoSuspension = esFalta ? '-' : (registro.TipoSuspensiones || '-');
    const motivoSuspension = esFalta ? '-' : (registro.MotivoSuspension || '-');
    const observacionFalta = esFalta ? (registro.ObservacionFalta || '-') : '-';
    
    fila.innerHTML = `
        <td title="${nombreEmpleado}">${nombreEmpleado}</td>
        <td>${fechaInicio}</td>
        <td>${fechaFin}</td>
        <td class="tipo-suspension">${tipoSuspension}</td>
        <td class="motivo-suspension">${motivoSuspension}</td>
        <td class="observacion-falta">${observacionFalta}</td>
        <td title="${usuarioRegistro}">${usuarioRegistro}</td>
        <td>${fechaRegistro}</td>
    `;
    
    return fila;
}

function configurarColumnas(tipoFiltro) {
    const tabla = document.getElementById('tablaResultados');
    
    // Remover clases previas
    tabla.classList.remove('hide-tipo-suspension', 'hide-motivo-suspension', 'hide-observacion-falta');
    
    // Agregar clases según el filtro
    if (tipoFiltro === 'suspensiones') {
        tabla.classList.add('hide-observacion-falta');
    } else if (tipoFiltro === 'faltas') {
        tabla.classList.add('hide-tipo-suspension', 'hide-motivo-suspension');
    }
}

// ====================================================================
// ORDENAMIENTO DE TABLA
// ====================================================================

function configurarOrdenamiento() {
    const columnasOrdenables = document.querySelectorAll('.sortable');
    
    columnasOrdenables.forEach(columna => {
        columna.addEventListener('click', function() {
            const campo = this.dataset.column;
            ordenarTabla(campo);
        });
    });
}

function ordenarTabla(campo) {
    if (!datosReporte.length) return;
    
    // Determinar dirección del ordenamiento
    let direccion = 'asc';
    if (columnasOrdenamiento[campo] === 'asc') {
        direccion = 'desc';
    }
    
    // Limpiar iconos de ordenamiento previos
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
    });
    
    // Aplicar nuevo ordenamiento
    const columnaActual = document.querySelector(`[data-column="${campo}"]`);
    columnaActual.classList.add(direccion);
    columnasOrdenamiento = { [campo]: direccion };
    
    // Ordenar datos
    datosReporte.sort((a, b) => {
        let valorA, valorB;
        
        switch(campo) {
            case 'empleado':
                valorA = limpiarNombre(a.NombreEmpleado);
                valorB = limpiarNombre(b.NombreEmpleado);
                break;
            case 'fechaInicio':
                valorA = new Date(a.FechaInicio);
                valorB = new Date(b.FechaInicio);
                break;
            case 'fechaFin':
                valorA = new Date(a.FechaFin);
                valorB = new Date(b.FechaFin);
                break;
            case 'tipo':
                valorA = a.TipoSuspensiones || '';
                valorB = b.TipoSuspensiones || '';
                break;
            case 'usuario':
                valorA = limpiarNombre(a.UsuarioRegistro);
                valorB = limpiarNombre(b.UsuarioRegistro);
                break;
            case 'fechaRegistro':
                valorA = new Date(a.fechahoragenero);
                valorB = new Date(b.fechahoragenero);
                break;
            default:
                return 0;
        }
        
        if (valorA < valorB) {
            return direccion === 'asc' ? -1 : 1;
        }
        if (valorA > valorB) {
            return direccion === 'asc' ? 1 : -1;
        }
        return 0;
    });
    
    // Volver a renderizar tabla
    mostrarTabla(datosReporte);
}

// ====================================================================
// ESTADOS DE LA INTERFAZ
// ====================================================================

function mostrarEstadoVacio() {
    document.getElementById('tableContainer').style.display = 'none';
    document.getElementById('resultsHeader').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('loadingState').style.display = 'none';
}

function mostrarEstadoCarga() {
    document.getElementById('tableContainer').style.display = 'none';
    document.getElementById('resultsHeader').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('loadingState').style.display = 'block';
}

function mostrarSinResultados() {
    document.getElementById('tableContainer').style.display = 'none';
    document.getElementById('resultsHeader').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('noResults').style.display = 'block';
    document.getElementById('loadingState').style.display = 'none';
}

// ====================================================================
// EXPORTACIÓN Y IMPRESIÓN
// ====================================================================

async function exportarExcel() {
    if (!datosReporte.length) {
        mostrarError('No hay datos para exportar');
        return;
    }
    
    try {
        mostrarCargando('Generando archivo Excel...');
        
        // Preparar datos para exportar
        const datosExport = prepararDatosExportacion();
        
        // Crear libro de trabajo
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExport);
        
        // Configurar ancho de columnas
        const columnWidths = [
            { wch: 30 }, // Empleado
            { wch: 12 }, // Fecha Inicio
            { wch: 12 }, // Fecha Fin
            { wch: 20 }, // Tipo Suspensión
            { wch: 30 }, // Motivo
            { wch: 30 }, // Observación Falta
            { wch: 25 }, // Usuario
            { wch: 20 }  // Fecha Registro
        ];
        ws['!cols'] = columnWidths;
        
        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte Suspensiones');
        
        // Generar nombre de archivo sugerido
        const fechaActual = new Date().toISOString().split('T')[0];
        const tipoTexto = obtenerTextoTipo(tipoFiltroActual).replace(/\s+/g, '_');
        const nombreArchivo = `Reporte_Suspensiones_${tipoTexto}_${fechaActual}.xlsx`;
        
        // Convertir a blob
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        Swal.close();
        
        // Verificar si el navegador soporta la API de File System Access
        if ('showSaveFilePicker' in window) {
            try {
                // Usar la API moderna para elegir ubicación
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: nombreArchivo,
                    types: [{
                        description: 'Archivos Excel',
                        accept: {
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                        }
                    }]
                });
                
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                
                await Swal.fire({
                    icon: 'success',
                    title: '¡Exportación exitosa!',
                    html: `
                        <div style="text-align: center;">
                            <p>El reporte se ha guardado correctamente en la ubicación seleccionada.</p>
                            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                <p style="color: #2e7d32; margin: 0;">
                                    <strong>Registros exportados:</strong> ${datosReporte.length}<br>
                                    <strong>Tipo:</strong> ${obtenerTextoTipo(tipoFiltroActual)}
                                </p>
                            </div>
                        </div>
                    `,
                    confirmButtonColor: '#4CAF50',
                    timer: 3000,
                    timerProgressBar: true
                });
                
            } catch (error) {
                if (error.name !== 'AbortError') {
                    // Si no fue cancelado por el usuario, usar método de descarga
                    console.warn('Error con showSaveFilePicker, usando descarga automática:', error);
                    descargarArchivoAutomatico(blob, nombreArchivo);
                }
                // Si fue AbortError (usuario canceló), no hacer nada
            }
        } else {
            // Fallback para navegadores que no soportan la API
            descargarArchivoAutomatico(blob, nombreArchivo);
        }
        
    } catch (error) {
        console.error('Error al exportar:', error);
        Swal.close();
        mostrarError('Error al generar el archivo Excel: ' + error.message);
    }
}

// Función auxiliar para descarga automática (fallback)
function descargarArchivoAutomatico(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Limpiar URL del objeto
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    Swal.fire({
        icon: 'success',
        title: '¡Exportación exitosa!',
        html: `
            <div style="text-align: center;">
                <p>El reporte se ha descargado correctamente.</p>
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="color: #2e7d32; margin: 0;">
                        <strong>Archivo:</strong> ${nombreArchivo}<br>
                        <strong>Registros:</strong> ${datosReporte.length}
                    </p>
                </div>
                <div style="background: #fff3cd; padding: 10px; border-radius: 6px; margin-top: 10px;">
                    <p style="color: #856404; font-size: 0.8rem; margin: 0;">
                        <strong>💡 Tip:</strong> Revisa tu carpeta de descargas predeterminada
                    </p>
                </div>
            </div>
        `,
        confirmButtonColor: '#4CAF50',
        timer: 4000,
        timerProgressBar: true
    });
}

function prepararDatosExportacion() {
    return datosReporte.map(registro => {
        const esFalta = registro.TipoSuspension == 0; // Si TipoSuspension es 0, es falta
        const datos = {
            'Empleado': limpiarNombre(registro.NombreEmpleado),
            'Fecha Inicio': formatearFecha(registro.FechaInicio),
            'Fecha Fin': formatearFecha(registro.FechaFin),
            'Usuario Registro': limpiarNombre(registro.UsuarioRegistro),
            'Fecha Registro': formatearFechaHora(registro.fechahoragenero)
        };
        
        // Agregar campos específicos según el tipo
        if (tipoFiltroActual === 'todos') {
            datos['Tipo'] = esFalta ? 'Falta' : 'Suspensión';
            if (esFalta) {
                datos['Observación Falta'] = registro.ObservacionFalta || '';
            } else {
                datos['Tipo Suspensión'] = registro.TipoSuspensiones || '';
                datos['Motivo Suspensión'] = registro.MotivoSuspension || '';
            }
        } else if (tipoFiltroActual === 'suspensiones') {
            datos['Tipo Suspensión'] = registro.TipoSuspensiones || '';
            datos['Motivo Suspensión'] = registro.MotivoSuspension || '';
        } else if (tipoFiltroActual === 'faltas') {
            datos['Observación Falta'] = registro.ObservacionFalta || '';
        }
        
        return datos;
    });
}
function limpiarNombre(nombre) {
    if (!nombre) return '';
    return nombre.replace(/\s+/g, ' ').trim();
}

function formatearFecha(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-GT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatearFechaHora(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleString('es-GT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatearFechaLegible(fecha) {
    if (!fecha) return '';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-GT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function obtenerTextoTipo(tipo) {
    switch(tipo) {
        case 'suspensiones': return 'Solo Suspensiones';
        case 'faltas': return 'Solo Faltas';
        case 'todos': 
        default: return 'Todos los registros';
    }
}

function mostrarCargando(mensaje = 'Procesando...') {
    return Swal.fire({
        title: mensaje,
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                <div class="spinner" style="border: 5px solid #f3f3f3; border-top: 5px solid #FF9800; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;"></div>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false
    });
}

function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        confirmButtonColor: '#FF9800'
    });
}

function mostrarErrorReporte(mensaje) {
    document.getElementById('tableContainer').style.display = 'none';
    document.getElementById('resultsHeader').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('loadingState').style.display = 'none';
    
    Swal.fire({
        icon: 'error',
        title: 'Error al generar reporte',
        html: `
            <div>
                <p>${mensaje}</p>
                <div style="background: #ffebee; padding: 12px; border-radius: 8px; margin: 15px 0; text-align: left;">
                    <h4 style="color: #c62828; margin-bottom: 8px; font-size: 0.9rem;">💡 Posibles soluciones:</h4>
                    <ul style="color: #424242; font-size: 0.8rem; margin: 0; padding-left: 18px; line-height: 1.4;">
                        <li>Verifica tu conexión a la base de datos</li>
                        <li>Asegúrate de que las fechas sean válidas</li>
                        <li>Verifica que tengas permisos para consultar los datos</li>
                        <li>Intenta con un rango de fechas más pequeño</li>
                    </ul>
                </div>
            </div>
        `,
        confirmButtonColor: '#FF9800',
        width: '480px'
    });
}