const { connectionString } = require('../Conexion/Conexion');
const XLSX = require('xlsx');
const path = require('path');
const Swal = require('sweetalert2');

// Variables globales
let datosReporte = [];
let columnasOrdenamiento = {};
let departamentoFiltroActual = 'todos';
let estadoVacacionesFiltro = 'todos';
let busquedaColaborador = '';

// Inicialización del DOM
document.addEventListener('DOMContentLoaded', function() {
    inicializarEventos();
    cargarDepartamentos();
    mostrarEstadoVacio();
});

// ====================================================================
// CONFIGURACIÓN INICIAL
// ====================================================================

function inicializarEventos() {
    // Eventos de formulario
    document.getElementById('filtrosForm').addEventListener('submit', generarReporte);
    document.getElementById('limpiarFiltros').addEventListener('click', limpiarFiltros);
    document.getElementById('exportarExcel').addEventListener('click', exportarExcel);
    
    // Evento de colapsar/expandir filtros
    document.getElementById('toggleFilters').addEventListener('click', toggleFiltros);
    
    // Eventos de cambio de filtros
    document.getElementById('departamento').addEventListener('change', manejarCambioDepartamento);
    document.getElementById('estadoVacaciones').addEventListener('change', manejarCambioEstado);
    document.getElementById('buscarColaborador').addEventListener('input', manejarBusquedaColaborador);
}

async function cargarDepartamentos() {
    try {
        const connection = await connectionString();
        const departamentos = await connection.query(`
            SELECT DISTINCT 
                departamentos.IdDepartamento,
                departamentos.NombreDepartamento
            FROM departamentos
            INNER JOIN personal ON departamentos.IdDepartamento = personal.IdSucuDepa
            WHERE personal.Estado IN (1,5) AND personal.TipoPersonal = 1
            ORDER BY departamentos.NombreDepartamento ASC
        `);
        await connection.close();
        
        const selectDepartamento = document.getElementById('departamento');
        
        // Limpiar opciones existentes excepto la primera
        selectDepartamento.innerHTML = '<option value="todos">Todos los departamentos</option>';
        
        // Agregar departamentos
        departamentos.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.IdDepartamento;
            option.textContent = dept.NombreDepartamento;
            selectDepartamento.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarError('Error al cargar la lista de departamentos');
    }
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

function manejarCambioDepartamento() {
    departamentoFiltroActual = document.getElementById('departamento').value;
    
    // Si hay datos cargados, aplicar filtros
    if (datosReporte.length > 0) {
        aplicarFiltrosLocales();
    }
}

function manejarCambioEstado() {
    estadoVacacionesFiltro = document.getElementById('estadoVacaciones').value;
    
    // Si hay datos cargados, aplicar filtros
    if (datosReporte.length > 0) {
        aplicarFiltrosLocales();
    }
}

function manejarBusquedaColaborador() {
    busquedaColaborador = document.getElementById('buscarColaborador').value.toLowerCase().trim();
    
    // Si hay datos cargados, aplicar filtros
    if (datosReporte.length > 0) {
        aplicarFiltrosLocales();
    }
}

function aplicarFiltrosLocales() {
    let datosFiltrados = [...datosReporte];
    
    // Aplicar filtros
    if (departamentoFiltroActual !== 'todos') {
        datosFiltrados = datosFiltrados.filter(registro => 
            registro.IdDepartamento == departamentoFiltroActual
        );
    }
    
    if (estadoVacacionesFiltro !== 'todos') {
        datosFiltrados = datosFiltrados.filter(registro => {
            const diasDisponibles = parseInt(registro.DiasDisponibles) || 0;
            switch (estadoVacacionesFiltro) {
                case 'disponibles':
                    return diasDisponibles > 0;
                case 'agotados':
                    return diasDisponibles <= 0;
                case 'criticos':
                    return diasDisponibles > 0 && diasDisponibles <= 5;
                default:
                    return true;
            }
        });
    }
    
    if (busquedaColaborador) {
        datosFiltrados = datosFiltrados.filter(registro => 
            (registro.NombreColaborador || '').toLowerCase().includes(busquedaColaborador)
        );
    }
    
    // Resetear ordenamiento cuando se aplican filtros
    resetearOrdenamiento();
    
    // Mostrar resultados filtrados
    if (datosFiltrados.length > 0) {
        mostrarTabla(datosFiltrados);
        actualizarEstadisticas(datosFiltrados);
    } else {
        mostrarSinResultados();
    }
}

function limpiarFiltros() {
    // Limpiar formulario
    document.getElementById('filtrosForm').reset();
    
    // Reiniciar variables de filtro
    departamentoFiltroActual = 'todos';
    estadoVacacionesFiltro = 'todos';
    busquedaColaborador = '';
    
    // Limpiar datos y mostrar estado vacío
    datosReporte = [];
    columnasOrdenamiento = {};
    mostrarEstadoVacio();
    
    // Deshabilitar botón de exportar
    document.getElementById('exportarExcel').disabled = true;
}

// ====================================================================
// GENERACIÓN DE REPORTE
// ====================================================================

async function generarReporte(event) {
    event.preventDefault();
    
    try {
        mostrarEstadoCarga();
        
        const datos = await consultarDatos();
        
        if (datos && datos.length > 0) {
            datosReporte = datos;
            aplicarFiltrosLocales(); // Aplicar filtros después de cargar datos
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

async function consultarDatos() {
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT
                DATE_FORMAT(personal.FechaPlanilla, '%Y-%m-%d') AS FechaPlanilla,
                CONCAT(
                    personal.PrimerNombre, ' ',
                    COALESCE(personal.SegundoNombre, ''), ' ',
                    COALESCE(personal.TercerNombre, ''), ' ',
                    personal.PrimerApellido, ' ',
                    COALESCE(personal.SegundoApellido, '')
                ) AS NombreColaborador, 
                TIMESTAMPDIFF(YEAR, personal.FechaPlanilla, CURDATE()) AS AniosCumplidos, 
                (TIMESTAMPDIFF(YEAR, personal.FechaPlanilla, CURDATE()) * 15) - 
                IFNULL((SELECT COUNT(*) FROM vacacionestomadas WHERE IdPersonal = personal.IdPersonal), 0) -
                IFNULL((SELECT SUM(CAST(DiasSolicitado AS UNSIGNED)) FROM vacacionespagadas 
                        WHERE IdPersonal = personal.IdPersonal AND Estado IN (1,2,3,4)), 0) AS DiasDisponibles, 
                Puestos.Nombre AS NombrePuesto, 
                departamentos.NombreDepartamento,
                departamentos.IdDepartamento,
                personal.IdPersonal
            FROM personal
            INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
            INNER JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
            WHERE personal.Estado IN (1,5) AND personal.TipoPersonal = 1
            ORDER BY DiasDisponibles DESC
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        return result;
        
    } catch (error) {
        console.error('Error en consulta:', error);
        throw new Error('Error al consultar la base de datos: ' + error.message);
    }
}

function mostrarTabla(datos) {
    // Mostrar elementos
    document.getElementById('tableContainer').style.display = 'block';
    document.getElementById('resultsHeader').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('loadingState').style.display = 'none';
    
    // Renderizar tabla
    renderizarSoloTabla(datos);
    
    // Configurar eventos de ordenamiento (solo si no están configurados)
    configurarOrdenamiento();
    
    // Actualizar estadísticas
    actualizarEstadisticas(datos);
}
function resetearOrdenamiento() {
    columnasOrdenamiento = {};
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) {
            icon.className = 'fas fa-sort sort-icon';
        }
    });
}

function crearFilaTabla(registro, index) {
    const fila = document.createElement('tr');
    fila.style.animationDelay = `${index * 0.03}s`;
    
    // Limpiar espacios extra en nombres
    const nombreColaborador = limpiarNombre(registro.NombreColaborador);
    
    // Formatear fechas
    const fechaPlanilla = formatearFecha(registro.FechaPlanilla);
    
    // Determinar estado y colores de días disponibles
    const diasDisponibles = parseInt(registro.DiasDisponibles) || 0;
    const estadoInfo = determinarEstadoVacaciones(diasDisponibles);
    
    fila.innerHTML = `
        <td title="${nombreColaborador}">${nombreColaborador}</td>
        <td>${fechaPlanilla}</td>
        <td style="text-align: center;">${registro.AniosCumplidos}</td>
        <td style="text-align: center;">
            <span class="dias-disponibles-valor ${estadoInfo.claseCSS}">${diasDisponibles}</span>
        </td>
        <td title="${registro.NombrePuesto}">${registro.NombrePuesto}</td>
        <td title="${registro.NombreDepartamento}">${registro.NombreDepartamento}</td>
        <td style="text-align: center;">
            <span class="estado-badge ${estadoInfo.estadoClase}" data-tooltip="${estadoInfo.tooltip}">
                <i class="${estadoInfo.icono}"></i>
                ${estadoInfo.texto}
            </span>
        </td>
    `;
    
    return fila;
}

function determinarEstadoVacaciones(diasDisponibles) {
    if (diasDisponibles <= 0) {
        return {
            claseCSS: 'dias-bajo',
            estadoClase: 'estado-agotado',
            icono: 'fas fa-times-circle',
            texto: 'Agotado',
            tooltip: 'No tiene días de vacaciones disponibles'
        };
    } else if (diasDisponibles <= 5) {
        return {
            claseCSS: 'dias-medio',
            estadoClase: 'estado-critico',
            icono: 'fas fa-exclamation-triangle',
            texto: 'Pocas',
            tooltip: `Solo ${diasDisponibles} días disponibles`
        };
    } else {
        return {
            claseCSS: 'dias-alto',
            estadoClase: 'estado-disponible',
            icono: 'fas fa-check-circle',
            texto: 'Disponible',
            tooltip: `${diasDisponibles} días disponibles`
        };
    }
}

function actualizarEstadisticas(datos) {
    const total = datos.length;
    const disponibles = datos.filter(r => parseInt(r.DiasDisponibles) > 5).length;
    const criticos = datos.filter(r => {
        const dias = parseInt(r.DiasDisponibles);
        return dias > 0 && dias <= 5;
    }).length;
    const agotados = datos.filter(r => parseInt(r.DiasDisponibles) <= 0).length;
}
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
    
    // Limpiar TODOS los iconos de ordenamiento previos
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) {
            icon.className = 'fas fa-sort sort-icon';
        }
    });
    
    // Determinar dirección del ordenamiento
    let direccion = 'asc';
    if (columnasOrdenamiento[campo] === 'asc') {
        direccion = 'desc';
    }
    
    // Aplicar nuevo ordenamiento visual
    const columnaActual = document.querySelector(`[data-column="${campo}"]`);
    columnaActual.classList.add(direccion);
    
    // Actualizar icono
    const icon = columnaActual.querySelector('.sort-icon');
    if (icon) {
        if (direccion === 'asc') {
            icon.className = 'fas fa-sort-up sort-icon';
        } else {
            icon.className = 'fas fa-sort-down sort-icon';
        }
    }
    
    // Guardar estado de ordenamiento (limpiar otros y solo mantener el actual)
    columnasOrdenamiento = { [campo]: direccion };
    
    // Obtener datos filtrados actuales
    let datosParaOrdenar = obtenerDatosFiltrados();
    
    // Crear una copia para no modificar los datos originales
    datosParaOrdenar = [...datosParaOrdenar];
    
    // Ordenar datos
    datosParaOrdenar.sort((a, b) => {
        let valorA, valorB;
        
        switch(campo) {
            case 'colaborador':
                valorA = limpiarNombre(a.NombreColaborador || '').toLowerCase();
                valorB = limpiarNombre(b.NombreColaborador || '').toLowerCase();
                break;
            case 'fechaPlanilla':
                valorA = new Date(a.FechaPlanilla || '1900-01-01');
                valorB = new Date(b.FechaPlanilla || '1900-01-01');
                break;
            case 'aniosCumplidos':
                valorA = parseInt(a.AniosCumplidos) || 0;
                valorB = parseInt(b.AniosCumplidos) || 0;
                break;
            case 'diasDisponibles':
                valorA = parseInt(a.DiasDisponibles) || 0;
                valorB = parseInt(b.DiasDisponibles) || 0;
                break;
            case 'puesto':
                valorA = (a.NombrePuesto || '').toLowerCase();
                valorB = (b.NombrePuesto || '').toLowerCase();
                break;
            case 'departamento':
                valorA = (a.NombreDepartamento || '').toLowerCase();
                valorB = (b.NombreDepartamento || '').toLowerCase();
                break;
            default:
                return 0;
        }
        
        // Manejar valores undefined o null
        if (valorA == null && valorB == null) return 0;
        if (valorA == null) return direccion === 'asc' ? 1 : -1;
        if (valorB == null) return direccion === 'asc' ? -1 : 1;
        
        // Comparación
        if (valorA < valorB) {
            return direccion === 'asc' ? -1 : 1;
        }
        if (valorA > valorB) {
            return direccion === 'asc' ? 1 : -1;
        }
        return 0;
    });
    
    // Debug para verificar el ordenamiento
    console.log(`Ordenando por ${campo} en dirección ${direccion}:`, datosParaOrdenar.length, 'registros');
    
    // Volver a renderizar tabla con datos ordenados
    renderizarSoloTabla(datosParaOrdenar);
}
function renderizarSoloTabla(datos) {
    const tbody = document.getElementById('tablaBody');
    
    // Limpiar tbody
    tbody.innerHTML = '';
    
    // Generar filas
    datos.forEach((registro, index) => {
        const fila = crearFilaTabla(registro, index);
        tbody.appendChild(fila);
    });
    
    // Asegurar que la tabla sea visible
    document.getElementById('tableContainer').style.display = 'block';
}
function obtenerDatosFiltrados() {
    let datosFiltrados = [...datosReporte];
    
    // Aplicar filtros
    if (departamentoFiltroActual !== 'todos') {
        datosFiltrados = datosFiltrados.filter(registro => 
            registro.IdDepartamento == departamentoFiltroActual
        );
    }
    
    if (estadoVacacionesFiltro !== 'todos') {
        datosFiltrados = datosFiltrados.filter(registro => {
            const diasDisponibles = parseInt(registro.DiasDisponibles) || 0;
            switch (estadoVacacionesFiltro) {
                case 'disponibles':
                    return diasDisponibles > 0;
                case 'agotados':
                    return diasDisponibles <= 0;
                case 'criticos':
                    return diasDisponibles > 0 && diasDisponibles <= 5;
                default:
                    return true;
            }
        });
    }
    
    if (busquedaColaborador) {
        datosFiltrados = datosFiltrados.filter(registro => 
            (registro.NombreColaborador || '').toLowerCase().includes(busquedaColaborador)
        );
    }
    
    return datosFiltrados;
}

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
        
        // Obtener datos filtrados para exportar
        const datosParaExportar = obtenerDatosFiltrados();
        const datosExport = prepararDatosExportacion(datosParaExportar);
        
        // Crear libro de trabajo
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExport);
        
        // Configurar ancho de columnas
        const columnWidths = [
            { wch: 35 }, // Colaborador
            { wch: 15 }, // Fecha Planilla
            { wch: 12 }, // Años Cumplidos
            { wch: 15 }, // Días Disponibles
            { wch: 25 }, // Puesto
            { wch: 25 }, // Departamento
            { wch: 12 }  // Estado
        ];
        ws['!cols'] = columnWidths;
        
        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte Días Vacaciones');
        
        // Generar nombre de archivo sugerido
        const fechaActual = new Date().toISOString().split('T')[0];
        const filtroTexto = obtenerTextoFiltros();
        const nombreArchivo = `Reporte_Dias_Vacaciones_${filtroTexto}_${fechaActual}.xlsx`;
        
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
                                    <strong>Colaboradores exportados:</strong> ${datosParaExportar.length}<br>
                                    <strong>Filtros aplicados:</strong> ${filtroTexto}
                                </p>
                            </div>
                        </div>
                    `,
                    confirmButtonColor: '#00BCD4',
                    timer: 3000,
                    timerProgressBar: true
                });
                
            } catch (error) {
                if (error.name !== 'AbortError') {
                    // Si no fue cancelado por el usuario, usar método de descarga
                    console.warn('Error con showSaveFilePicker, usando descarga automática:', error);
                    descargarArchivoAutomatico(blob, nombreArchivo, datosParaExportar.length);
                }
                // Si fue AbortError (usuario canceló), no hacer nada
            }
        } else {
            // Fallback para navegadores que no soportan la API
            descargarArchivoAutomatico(blob, nombreArchivo, datosParaExportar.length);
        }
        
    } catch (error) {
        console.error('Error al exportar:', error);
        Swal.close();
        mostrarError('Error al generar el archivo Excel: ' + error.message);
    }
}

// Función auxiliar para descarga automática (fallback)
function descargarArchivoAutomatico(blob, nombreArchivo, totalRegistros) {
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
                        <strong>Colaboradores:</strong> ${totalRegistros}
                    </p>
                </div>
                <div style="background: #fff3cd; padding: 10px; border-radius: 6px; margin-top: 10px;">
                    <p style="color: #856404; font-size: 0.8rem; margin: 0;">
                        <strong>💡 Tip:</strong> Revisa tu carpeta de descargas predeterminada
                    </p>
                </div>
            </div>
        `,
        confirmButtonColor: '#00BCD4',
        timer: 4000,
        timerProgressBar: true
    });
}

function prepararDatosExportacion(datos) {
    return datos.map(registro => {
        const diasDisponibles = parseInt(registro.DiasDisponibles) || 0;
        const estadoInfo = determinarEstadoVacaciones(diasDisponibles);
        
        return {
            'Colaborador': limpiarNombre(registro.NombreColaborador),
            'Fecha Planilla': formatearFecha(registro.FechaPlanilla),
            'Años Cumplidos': registro.AniosCumplidos,
            'Días Disponibles': diasDisponibles,
            'Puesto': registro.NombrePuesto,
            'Departamento': registro.NombreDepartamento,
            'Estado': estadoInfo.texto
        };
    });
}

function obtenerTextoFiltros() {
    let filtros = [];
    
    if (departamentoFiltroActual !== 'todos') {
        const deptSelect = document.getElementById('departamento');
        const deptTexto = deptSelect.options[deptSelect.selectedIndex].text;
        filtros.push(deptTexto.replace(/\s+/g, '_'));
    }
    
    if (estadoVacacionesFiltro !== 'todos') {
        filtros.push(estadoVacacionesFiltro);
    }
    
    if (busquedaColaborador) {
        filtros.push('busqueda');
    }
    
    return filtros.length > 0 ? filtros.join('_') : 'todos';
}
function limpiarNombre(nombre) {
    if (!nombre) return '';
    return nombre.replace(/\s+/g, ' ').trim();
}

function formatearFecha(fecha) {
    if (!fecha) return '-';
    
    // Si la fecha ya viene en formato DD/MM/YYYY, devolverla como está
    if (typeof fecha === 'string' && fecha.includes('/')) {
        return fecha;
    }
    
    try {
        let fechaObj;
        
        // Si la fecha viene como string (YYYY-MM-DD o similar)
        if (typeof fecha === 'string') {
            // Crear la fecha manualmente para evitar problemas de zona horaria
            const partes = fecha.split(/[-/]/);
            
            if (partes.length === 3) {
                // Determinar el formato (YYYY-MM-DD o DD-MM-YYYY)
                let year, month, day;
                
                if (partes[0].length === 4) {
                    // Formato YYYY-MM-DD
                    year = parseInt(partes[0]);
                    month = parseInt(partes[1]) - 1; // Los meses en JS van de 0-11
                    day = parseInt(partes[2]);
                } else {
                    // Formato DD-MM-YYYY
                    day = parseInt(partes[0]);
                    month = parseInt(partes[1]) - 1; // Los meses en JS van de 0-11
                    year = parseInt(partes[2]);
                }
                
                // Crear fecha local (sin conversión de zona horaria)
                fechaObj = new Date(year, month, day);
            } else {
                // Fallback para otros formatos
                fechaObj = new Date(fecha);
            }
        } else if (fecha instanceof Date) {
            fechaObj = fecha;
        } else {
            // Intentar convertir cualquier otro tipo
            fechaObj = new Date(fecha);
        }
        
        // Verificar que la fecha sea válida
        if (isNaN(fechaObj.getTime())) {
            console.warn('Fecha inválida:', fecha);
            return '-';
        }
        
        // Formatear la fecha en formato DD/MM/YYYY
        const day = fechaObj.getDate().toString().padStart(2, '0');
        const month = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
        const year = fechaObj.getFullYear();
        
        return `${day}/${month}/${year}`;
        
    } catch (error) {
        console.error('Error al formatear fecha:', fecha, error);
        return '-';
    }
}

function mostrarCargando(mensaje = 'Procesando...') {
    return Swal.fire({
        title: mensaje,
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                <div class="spinner" style="border: 5px solid #B2EBF2; border-top: 5px solid #00BCD4; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;"></div>
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
        confirmButtonColor: '#00BCD4'
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
                        <li>Asegúrate de que existan colaboradores activos</li>
                        <li>Verifica que tengas permisos para consultar los datos</li>
                        <li>Revisa la configuración de vacaciones en el sistema</li>
                        <li>Contacta al administrador del sistema si el problema persiste</li>
                    </ul>
                </div>
            </div>
        `,
        confirmButtonColor: '#00BCD4',
        width: '480px'
    });
}

// ====================================================================
// FUNCIONES ADICIONALES DE UTILIDAD
// ====================================================================

// Función para calcular estadísticas avanzadas
function calcularEstadisticasAvanzadas(datos) {
    const estadisticas = {
        totalColaboradores: datos.length,
        totalDiasAcumulados: 0,
        promedioDiasPorColaborador: 0,
        colaboradoresConMasDias: [],
        colaboradoresEnRiesgo: [],
        departamentoConMasDias: null,
        departamentoConMenosDias: null
    };

    if (datos.length === 0) return estadisticas;

    // Calcular totales y promedios
    const totalDias = datos.reduce((sum, colaborador) => {
        return sum + (parseInt(colaborador.DiasDisponibles) || 0);
    }, 0);

    estadisticas.totalDiasAcumulados = totalDias;
    estadisticas.promedioDiasPorColaborador = Math.round(totalDias / datos.length);

    // Colaboradores con más días (top 5)
    estadisticas.colaboradoresConMasDias = [...datos]
        .sort((a, b) => (parseInt(b.DiasDisponibles) || 0) - (parseInt(a.DiasDisponibles) || 0))
        .slice(0, 5)
        .map(c => ({
            nombre: limpiarNombre(c.NombreColaborador),
            dias: parseInt(c.DiasDisponibles) || 0
        }));

    // Colaboradores en riesgo (≤ 5 días)
    estadisticas.colaboradoresEnRiesgo = datos
        .filter(c => {
            const dias = parseInt(c.DiasDisponibles) || 0;
            return dias > 0 && dias <= 5;
        })
        .map(c => ({
            nombre: limpiarNombre(c.NombreColaborador),
            dias: parseInt(c.DiasDisponibles) || 0,
            departamento: c.NombreDepartamento
        }));

    // Estadísticas por departamento
    const departamentos = {};
    datos.forEach(colaborador => {
        const dept = colaborador.NombreDepartamento;
        const dias = parseInt(colaborador.DiasDisponibles) || 0;
        
        if (!departamentos[dept]) {
            departamentos[dept] = {
                nombre: dept,
                totalColaboradores: 0,
                totalDias: 0,
                promedio: 0
            };
        }
        
        departamentos[dept].totalColaboradores++;
        departamentos[dept].totalDias += dias;
    });

    // Calcular promedios por departamento
    Object.keys(departamentos).forEach(dept => {
        departamentos[dept].promedio = Math.round(
            departamentos[dept].totalDias / departamentos[dept].totalColaboradores
        );
    });

    // Encontrar departamentos con más y menos días promedio
    const deptArray = Object.values(departamentos);
    if (deptArray.length > 0) {
        estadisticas.departamentoConMasDias = deptArray.reduce((max, dept) => 
            dept.promedio > max.promedio ? dept : max
        );
        
        estadisticas.departamentoConMenosDias = deptArray.reduce((min, dept) => 
            dept.promedio < min.promedio ? dept : min
        );
    }

    return estadisticas;
}

// Función para mostrar estadísticas detalladas (opcional)
function mostrarEstadisticasDetalladas() {
    if (!datosReporte.length) {
        mostrarError('No hay datos para mostrar estadísticas');
        return;
    }

    const datosFiltrados = obtenerDatosFiltrados();
    const stats = calcularEstadisticasAvanzadas(datosFiltrados);

    Swal.fire({
        title: 'Estadísticas Detalladas',
        html: `
            <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #00BCD4; margin-bottom: 10px;">📊 Resumen General</h4>
                    <p><strong>Total colaboradores:</strong> ${stats.totalColaboradores}</p>
                    <p><strong>Días acumulados:</strong> ${stats.totalDiasAcumulados}</p>
                    <p><strong>Promedio por colaborador:</strong> ${stats.promedioDiasPorColaborador} días</p>
                </div>

                ${stats.colaboradoresEnRiesgo.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #FFC107; margin-bottom: 10px;">⚠️ Colaboradores en Riesgo</h4>
                    ${stats.colaboradoresEnRiesgo.map(c => 
                        `<p style="margin: 5px 0;">• ${c.nombre}: ${c.dias} días (${c.departamento})</p>`
                    ).join('')}
                </div>
                ` : ''}

                <div style="margin-bottom: 20px;">
                    <h4 style="color: #4CAF50; margin-bottom: 10px;">🏆 Top Colaboradores</h4>
                    ${stats.colaboradoresConMasDias.map((c, index) => 
                        `<p style="margin: 5px 0;">${index + 1}. ${c.nombre}: ${c.dias} días</p>`
                    ).join('')}
                </div>

                ${stats.departamentoConMasDias ? `
                <div>
                    <h4 style="color: #FF9800; margin-bottom: 10px;">🏢 Por Departamentos</h4>
                    <p><strong>Mayor promedio:</strong> ${stats.departamentoConMasDias.nombre} (${stats.departamentoConMasDias.promedio} días)</p>
                    <p><strong>Menor promedio:</strong> ${stats.departamentoConMenosDias.nombre} (${stats.departamentoConMenosDias.promedio} días)</p>
                </div>
                ` : ''}
            </div>
        `,
        confirmButtonColor: '#00BCD4',
        confirmButtonText: 'Cerrar',
        width: '600px'
    });
}

// Función para detectar colaboradores que necesitan tomar vacaciones
function detectarColaboradoresQueNecesitanVacaciones() {
    const umbralAlto = 20; // Más de 20 días acumulados
    const colaboradoresConMuchosDias = datosReporte.filter(c => 
        parseInt(c.DiasDisponibles) >= umbralAlto
    );

    if (colaboradoresConMuchosDias.length > 0) {
        return {
            cantidad: colaboradoresConMuchosDias.length,
            colaboradores: colaboradoresConMuchosDias.map(c => ({
                nombre: limpiarNombre(c.NombreColaborador),
                dias: parseInt(c.DiasDisponibles),
                departamento: c.NombreDepartamento
            }))
        };
    }
    
    return null;
}

// Función para formatear números con separadores de miles
function formatearNumero(numero) {
    return numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Función para validar datos antes de procesar
function validarDatos(datos) {
    if (!Array.isArray(datos)) {
        throw new Error('Los datos deben ser un array');
    }

    const camposRequeridos = [
        'NombreColaborador', 
        'FechaPlanilla', 
        'AniosCumplidos', 
        'DiasDisponibles', 
        'NombrePuesto', 
        'NombreDepartamento'
    ];

    for (const registro of datos) {
        for (const campo of camposRequeridos) {
            if (!(campo in registro)) {
                throw new Error(`Campo requerido '${campo}' no encontrado en los datos`);
            }
        }
    }

    return true;
}

// Función para limpiar y normalizar datos
function limpiarDatos(datos) {
    return datos.map(registro => ({
        ...registro,
        NombreColaborador: limpiarNombre(registro.NombreColaborador),
        DiasDisponibles: Math.max(0, parseInt(registro.DiasDisponibles) || 0),
        AniosCumplidos: Math.max(0, parseInt(registro.AniosCumplidos) || 0),
        NombrePuesto: (registro.NombrePuesto || '').trim(),
        NombreDepartamento: (registro.NombreDepartamento || '').trim()
    }));
}

// Función para detectar anomalías en los datos
function detectarAnomalias(datos) {
    const anomalias = [];
    
    datos.forEach((registro, index) => {
        const dias = parseInt(registro.DiasDisponibles) || 0;
        const anos = parseInt(registro.AniosCumplidos) || 0;
        
        // Detectar casos donde los días son negativos
        if (dias < 0) {
            anomalias.push({
                tipo: 'dias_negativos',
                registro: index,
                colaborador: registro.NombreColaborador,
                valor: dias,
                mensaje: 'Días disponibles negativos'
            });
        }
        
        // Detectar casos donde hay más días que los teóricamente posibles
        const diasTeoricos = anos * 15;
        if (dias > diasTeoricos + 15) { // Margen de 15 días adicionales
            anomalias.push({
                tipo: 'dias_excesivos',
                registro: index,
                colaborador: registro.NombreColaborador,
                valor: dias,
                teorico: diasTeoricos,
                mensaje: 'Días disponibles exceden lo teóricamente posible'
            });
        }
        
        // Detectar colaboradores con muchos años pero pocos días (posible error)
        if (anos >= 5 && dias === 0) {
            anomalias.push({
                tipo: 'veterano_sin_dias',
                registro: index,
                colaborador: registro.NombreColaborador,
                anos: anos,
                mensaje: 'Colaborador veterano sin días disponibles'
            });
        }
    });
    
    return anomalias;
}

// Función para generar reporte de anomalías
function generarReporteAnomalias() {
    if (!datosReporte.length) {
        mostrarError('No hay datos para analizar');
        return;
    }

    const anomalias = detectarAnomalias(datosReporte);
    
    if (anomalias.length === 0) {
        Swal.fire({
            icon: 'success',
            title: 'Sin Anomalías Detectadas',
            text: 'Los datos de vacaciones se ven consistentes y sin problemas.',
            confirmButtonColor: '#00BCD4'
        });
        return;
    }

    Swal.fire({
        icon: 'warning',
        title: `Anomalías Detectadas (${anomalias.length})`,
        html: `
            <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                ${anomalias.map(anomalia => `
                    <div style="background: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #FFC107;">
                        <strong>${anomalia.colaborador}</strong><br>
                        <small style="color: #856404;">${anomalia.mensaje}</small>
                        ${anomalia.valor !== undefined ? `<br><small>Valor: ${anomalia.valor}</small>` : ''}
                        ${anomalia.teorico !== undefined ? `<br><small>Esperado: ~${anomalia.teorico}</small>` : ''}
                    </div>
                `).join('')}
            </div>
        `,
        confirmButtonColor: '#00BCD4',
        confirmButtonText: 'Entendido',
        width: '600px'
    });
}

// Añadir event listeners adicionales para funcionalidades extra
document.addEventListener('DOMContentLoaded', function() {
    // Detectar teclas de acceso rápido
    document.addEventListener('keydown', function(event) {
        // Ctrl/Cmd + R para generar reporte
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            document.getElementById('filtrosForm').dispatchEvent(new Event('submit'));
        }
        
        // Ctrl/Cmd + E para exportar
        if ((event.ctrlKey || event.metaKey) && event.key === 'e' && !document.getElementById('exportarExcel').disabled) {
            event.preventDefault();
            exportarExcel();
        }
        
        // Ctrl/Cmd + L para limpiar
        if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
            event.preventDefault();
            limpiarFiltros();
        }
    });
});

// ====================================================================
// FUNCIONES DE DESARROLLO Y DEBUG (Opcional - remover en producción)
// ====================================================================

// Función para logging avanzado (solo en desarrollo)
function log(mensaje, tipo = 'info', datos = null) {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${tipo.toUpperCase()}]`;
        
        switch (tipo) {
            case 'error':
                console.error(prefix, mensaje, datos);
                break;
            case 'warn':
                console.warn(prefix, mensaje, datos);
                break;
            case 'debug':
                console.debug(prefix, mensaje, datos);
                break;
            default:
                console.log(prefix, mensaje, datos);
        }
    }
}

// Función para medir rendimiento
function medirRendimiento(nombre, funcion) {
    return async function(...args) {
        const inicio = performance.now();
        const resultado = await funcion.apply(this, args);
        const fin = performance.now();
        const duracion = fin - inicio;
        
        log(`Rendimiento de ${nombre}`, 'debug', {
            duracion: `${duracion.toFixed(2)}ms`,
            argumentos: args.length
        });
        
        return resultado;
    };
}