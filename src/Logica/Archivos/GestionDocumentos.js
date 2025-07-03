const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const Swal = require('sweetalert2');

// Variables globales
let datosEmpleados = [];
let tablaEmpleados = null;
let departamentoSeleccionado = null;
let empleadoEditando = null;
let datosOriginales = {};

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    inicializarApp();
});

/**
 * Inicializar la aplicación
 */
async function inicializarApp() {
    try {
        mostrarInfoUsuario();
        await cargarDepartamentos();
        configurarEventListeners();
        configurarResponsive();
        
        console.log('Aplicación inicializada correctamente');
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        mostrarError('Error al cargar la aplicación', 'No se pudo inicializar correctamente el sistema.');
    }
}

/**
 * Mostrar información del usuario logueado
 */
function mostrarInfoUsuario() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData) {
            const userInfoContainer = document.getElementById('userInfo');
            const userImage = userData.FotoBase64 || '../Imagenes/user-default.png';
            
            userInfoContainer.innerHTML = `
                <img src="${userImage}" alt="Usuario" class="user-avatar">
                <div class="user-details">
                    <h4>${userData.NombreCompleto}</h4>
                    <p>${userData.NombreDepartamento}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error al mostrar información del usuario:', error);
    }
}

/**
 * Cargar departamentos en el select
 */
async function cargarDepartamentos() {
    try {
        mostrarCarga(true);
        
        const connection = await connectionString();
        const departamentos = await connection.query(`
            SELECT
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento, 
                Regiones.NombreRegion
            FROM
                departamentos
                INNER JOIN
                Regiones
                ON 
                    departamentos.IdRegion = Regiones.IdRegion
            ORDER BY Regiones.NombreRegion, departamentos.NombreDepartamento
        `);
        await connection.close();
        
        const select = document.getElementById('departamentoSelect');
        select.innerHTML = '<option value="">Seleccione un departamento...</option>';
        
        let currentRegion = '';
        departamentos.forEach(depto => {
            if (depto.NombreRegion !== currentRegion) {
                if (currentRegion !== '') {
                    select.innerHTML += '</optgroup>';
                }
                select.innerHTML += `<optgroup label="${depto.NombreRegion}">`;
                currentRegion = depto.NombreRegion;
            }
            select.innerHTML += `<option value="${depto.IdDepartamento}">${depto.NombreDepartamento}</option>`;
        });
        
        if (currentRegion !== '') {
            select.innerHTML += '</optgroup>';
        }
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarError('Error de conexión', 'No se pudieron cargar los departamentos.');
    } finally {
        mostrarCarga(false);
    }
}

/**
 * Configurar event listeners
 */
function configurarEventListeners() {
    // Cambio en selector de departamento
    document.getElementById('departamentoSelect').addEventListener('change', function() {
        const btnBuscar = document.getElementById('btnBuscar');
        btnBuscar.disabled = !this.value;
        
        if (!this.value) {
            limpiarResultados();
        }
    });
    
    // Botón buscar
    document.getElementById('btnBuscar').addEventListener('click', buscarDocumentos);
    
    // Botón refrescar
    document.getElementById('btnRefrescar').addEventListener('click', function() {
        if (departamentoSeleccionado) {
            buscarDocumentos();
        }
    });
    
    // Botón exportar
    document.getElementById('btnExportar').addEventListener('click', exportarDatos);
    
    // Toggle sidebar en móvil
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    
    // Cerrar sidebar al hacer clic en overlay
    document.getElementById('sidebarOverlay').addEventListener('click', function() {
        toggleSidebar();
    });
    
    // Cerrar sidebar con tecla Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.querySelector('.sidebar').classList.contains('open')) {
            toggleSidebar();
        }
    });
}

/**
 * Configurar responsividad
 */
function configurarResponsive() {
    // Escuchar cambios de tamaño de ventana
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            document.querySelector('.sidebar').classList.remove('open');
            document.querySelector('.sidebar-overlay').classList.remove('show');
        }
    });
}

/**
 * Toggle sidebar en móvil
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
}

/**
 * Buscar documentos del departamento seleccionado
 */
async function buscarDocumentos() {
    try {
        const selectDepartamento = document.getElementById('departamentoSelect');
        const departamentoId = selectDepartamento.value;
        
        if (!departamentoId) {
            mostrarError('Selección requerida', 'Debe seleccionar un departamento.');
            return;
        }
        
        departamentoSeleccionado = {
            id: departamentoId,
            nombre: selectDepartamento.options[selectDepartamento.selectedIndex].text
        };
        
        mostrarCarga(true);
        
        const connection = await connectionString();
        const empleados = await connection.query(`
            SELECT
                personal.IdPersonal, 
                personal.PrimerApellido, 
                personal.SegundoApellido, 
                personal.PrimerNombre, 
                personal.SegundoNombre, 
                personal.TercerNombre, 
                personal.Contrato, 
                personal.NIT, 
                personal.FechaVencimientoTS, 
                personal.FechaVencimientoTM, 
                personal.FechaContrato, 
                personal.IGSS, 
                personal.IRTRA
            FROM
                personal
            WHERE
                personal.IdSucuDepa = ? AND
                personal.TipoPersonal = 1 AND
                personal.Estado = 1
            ORDER BY personal.PrimerApellido, personal.PrimerNombre
        `, [departamentoId]);
        await connection.close();
        
        datosEmpleados = empleados.map(emp => procesarEmpleado(emp));
        
        actualizarResumen();
        actualizarTabla();
        mostrarSecciones();
        
        // Cerrar sidebar en móvil después de buscar
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
        
        // Mostrar notificación de éxito
        mostrarNotificacionExito(`Se cargaron ${datosEmpleados.length} empleados de ${departamentoSeleccionado.nombre}`);
        
    } catch (error) {
        console.error('Error al buscar documentos:', error);
        mostrarError('Error de búsqueda', 'No se pudieron cargar los datos del departamento.');
    } finally {
        mostrarCarga(false);
    }
}

/**
 * Procesar datos de empleado para agregar estados de documentos
 */
function procesarEmpleado(empleado) {
    const hoy = new Date();
    const fechaLimite = new Date(hoy.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 días
    
    const nombreCompleto = `${empleado.PrimerApellido || ''} ${empleado.SegundoApellido || ''} ${empleado.PrimerNombre || ''} ${empleado.SegundoNombre || ''} ${empleado.TercerNombre || ''}`.trim().replace(/\s+/g, ' ');
    
    // Evaluar estados - CORREGIDO: verificar que NO sea 0, null, undefined o vacío
    const estados = {
        igss: (empleado.IGSS && empleado.IGSS !== 0 && empleado.IGSS !== '0') ? 'completo' : 'faltante',
        irtra: (empleado.IRTRA && empleado.IRTRA !== 0 && empleado.IRTRA !== '0') ? 'completo' : 'faltante',
        contrato: (empleado.Contrato && empleado.Contrato !== 0 && empleado.Contrato !== '0') ? 'completo' : 'faltante',
        nit: (empleado.NIT && empleado.NIT.toString().trim() !== '') ? 'completo' : 'faltante',
        tarjetaSalud: evaluarFechaVencimiento(empleado.FechaVencimientoTS, hoy, fechaLimite),
        tarjetaManipulacion: evaluarFechaVencimiento(empleado.FechaVencimientoTM, hoy, fechaLimite)
    };
    
    // CORREGIDO: Calcular estado general más preciso
    const faltantes = Object.values(estados).filter(estado => estado === 'faltante').length;
    const vencidos = Object.values(estados).filter(estado => estado === 'vencido').length;
    const proximosVencer = Object.values(estados).filter(estado => estado === 'proximo').length;
    const completos = Object.values(estados).filter(estado => estado === 'completo').length;
    
    let estadoGeneral = 'completo';
    
    // Si tiene documentos faltantes o vencidos = CRÍTICO
    if (faltantes > 0 || vencidos > 0) {
        estadoGeneral = 'critico';
    } 
    // Si tiene documentos próximos a vencer = ADVERTENCIA
    else if (proximosVencer > 0) {
        estadoGeneral = 'advertencia';
    }
    // Si todos están completos = COMPLETO
    else if (completos === 6) { // 6 documentos: IGSS, IRTRA, Contrato, NIT, TS, TM
        estadoGeneral = 'completo';
    }
    
    return {
        ...empleado,
        NombreCompleto: nombreCompleto,
        Estados: estados,
        EstadoGeneral: estadoGeneral,
        Faltantes: faltantes,
        Vencidos: vencidos,
        ProximosVencer: proximosVencer,
        Completos: completos
    };
}

/**
 * Evaluar estado de fecha de vencimiento
 */
function evaluarFechaVencimiento(fecha, hoy, fechaLimite) {
    if (!fecha) return 'faltante';
    
    // CORREGIDO: Crear fecha sin problemas de zona horaria
    let fechaVenc;
    if (typeof fecha === 'string') {
        fechaVenc = new Date(fecha + 'T00:00:00');
    } else {
        fechaVenc = new Date(fecha);
    }
    
    // Comparar solo las fechas sin tiempo
    const fechaVencSoloFecha = new Date(fechaVenc.getFullYear(), fechaVenc.getMonth(), fechaVenc.getDate());
    const hoySoloFecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fechaLimiteSoloFecha = new Date(fechaLimite.getFullYear(), fechaLimite.getMonth(), fechaLimite.getDate());
    
    if (fechaVencSoloFecha < hoySoloFecha) return 'vencido';
    if (fechaVencSoloFecha <= fechaLimiteSoloFecha) return 'proximo';
    return 'completo';
}

/**
 * Actualizar cards de resumen en sidebar
 */
function actualizarResumen() {
    const stats = calcularEstadisticas();
    
    // Actualizar título en tabla
    document.getElementById('departamentoNombreTabla').textContent = departamentoSeleccionado.nombre;
    
    // Actualizar título en sidebar
    document.getElementById('departamentoNombreSidebar').textContent = departamentoSeleccionado.nombre;
    
    // Actualizar números en sidebar
    document.getElementById('totalEmpleadosSidebar').textContent = stats.total;
    document.getElementById('documentosCompletosSidebar').textContent = stats.completos;
    document.getElementById('sinContratoSidebar').textContent = stats.sinContrato;
    
    // CORREGIDO: Solo documentos realmente vencidos (con fechas pasadas)
    const documentosVencidos = stats.tsVencida + stats.tmVencida;
    document.getElementById('tarjetasVencidasSidebar').textContent = documentosVencidos;
    
    // CORREGIDO: Solo documentos faltantes (sin registrar)
    const documentosFaltantes = stats.sinIGSS + stats.sinIRTRA + stats.sinNIT + stats.tsFaltante + stats.tmFaltante;
    document.getElementById('documentosFaltantesSidebar').textContent = documentosFaltantes;
    
    // Mostrar sección de estadísticas en sidebar
    document.getElementById('sidebarStats').style.display = 'block';
}

/**
 * Calcular estadísticas de documentos
 */
function calcularEstadisticas() {
    return {
        total: datosEmpleados.length,
        sinIGSS: datosEmpleados.filter(emp => emp.Estados.igss === 'faltante').length,
        sinIRTRA: datosEmpleados.filter(emp => emp.Estados.irtra === 'faltante').length,
        sinContrato: datosEmpleados.filter(emp => emp.Estados.contrato === 'faltante').length,
        sinNIT: datosEmpleados.filter(emp => emp.Estados.nit === 'faltante').length,
        
        // CORREGIDO: Separar vencidos de faltantes
        tsVencida: datosEmpleados.filter(emp => emp.Estados.tarjetaSalud === 'vencido').length,
        tmVencida: datosEmpleados.filter(emp => emp.Estados.tarjetaManipulacion === 'vencido').length,
        tsFaltante: datosEmpleados.filter(emp => emp.Estados.tarjetaSalud === 'faltante').length,
        tmFaltante: datosEmpleados.filter(emp => emp.Estados.tarjetaManipulacion === 'faltante').length,
        
        completos: datosEmpleados.filter(emp => emp.EstadoGeneral === 'completo').length
    };
}

/**
 * Actualizar tabla de empleados
 */
function actualizarTabla() {
    // Destruir tabla existente si existe
    if (tablaEmpleados) {
        tablaEmpleados.destroy();
        tablaEmpleados = null;
    }
    
    const tbody = document.querySelector('#tablaEmpleados tbody');
    tbody.innerHTML = '';
    
    datosEmpleados.forEach(empleado => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${empleado.IdPersonal}</td>
            <td class="text-start">
                <strong>${empleado.NombreCompleto}</strong>
            </td>
            <td>${generarBadgeEstado(empleado.Estados.igss, 'IGSS')}</td>
            <td>${generarBadgeEstado(empleado.Estados.irtra, 'IRTRA')}</td>
            <td>${generarBadgeEstado(empleado.Estados.contrato, 'Contrato')}</td>
            <td>${generarBadgeEstado(empleado.Estados.nit, 'NIT')}</td>
            <td>${generarBadgeEstado(empleado.Estados.tarjetaSalud, 'T.Salud', empleado.FechaVencimientoTS)}</td>
            <td>${generarBadgeEstado(empleado.Estados.tarjetaManipulacion, 'T.Manipulación', empleado.FechaVencimientoTM)}</td>
            <td>${generarBadgeEstadoGeneral(empleado.EstadoGeneral)}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="verDetalleEmpleado(${empleado.IdPersonal})" title="Ver detalle">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    });
    
    // Inicializar DataTable
    try {
        tablaEmpleados = $('#tablaEmpleados').DataTable({
            responsive: true,
            language: {
                "sProcessing": "Procesando...",
                "sLengthMenu": "Mostrar _MENU_ registros",
                "sZeroRecords": "No se encontraron resultados",
                "sEmptyTable": "Ningún dato disponible en esta tabla",
                "sInfo": "Mostrando registros del _START_ al _END_ de un total de _TOTAL_ registros",
                "sInfoEmpty": "Mostrando registros del 0 al 0 de un total de 0 registros",
                "sInfoFiltered": "(filtrado de un total de _MAX_ registros)",
                "sInfoPostFix": "",
                "sSearch": "Buscar:",
                "sUrl": "",
                "sInfoThousands": ",",
                "sLoadingRecords": "Cargando...",
                "oPaginate": {
                    "sFirst": "Primero",
                    "sLast": "Último",
                    "sNext": "Siguiente",
                    "sPrevious": "Anterior"
                },
                "oAria": {
                    "sSortAscending": ": Activar para ordenar la columna de manera ascendente",
                    "sSortDescending": ": Activar para ordenar la columna de manera descendente"
                }
            },
            pageLength: 25,
            order: [[8, 'desc'], [1, 'asc']], // Ordenar por estado general y nombre
            columnDefs: [
                { orderable: false, targets: [9] }, // Columna de acciones no ordenable
                { className: 'text-center', targets: [0, 2, 3, 4, 5, 6, 7, 8, 9] },
                { className: 'text-start', targets: [1] }
            ],
            dom: '<"top"lf>rt<"bottom"ip><"clear">',
            scrollX: true,
            autoWidth: false
        });
        
        console.log('DataTable inicializado correctamente');
    } catch (error) {
        console.error('Error al inicializar DataTable:', error);
        mostrarError('Error de tabla', 'No se pudo inicializar la tabla de datos.');
    }
}

/**
 * Generar badge de estado para documentos
 */
function generarBadgeEstado(estado, tipo, fecha = null) {
    let badge = '';
    let tooltip = '';
    
    switch (estado) {
        case 'completo':
            badge = '<span class="badge badge-success"><i class="fas fa-check"></i> Completo</span>';
            if (fecha) {
                tooltip = `Vence: ${formatearFecha(fecha)}`;
            }
            break;
        case 'faltante':
            badge = '<span class="badge badge-danger"><i class="fas fa-times"></i> Faltante</span>';
            tooltip = `${tipo} no registrado`;
            break;
        case 'vencido':
            badge = '<span class="badge badge-danger"><i class="fas fa-exclamation-triangle"></i> Vencido</span>';
            tooltip = `Venció: ${formatearFecha(fecha)}`;
            break;
        case 'proximo':
            badge = '<span class="badge badge-warning"><i class="fas fa-clock"></i> Próximo</span>';
            tooltip = `Vence: ${formatearFecha(fecha)}`;
            break;
    }
    
    return tooltip ? `<span title="${tooltip}">${badge}</span>` : badge;
}

/**
 * Generar badge de estado general
 */
function generarBadgeEstadoGeneral(estado) {
    switch (estado) {
        case 'completo':
            return '<span class="badge badge-success"><i class="fas fa-check-circle"></i> Completo</span>';
        case 'advertencia':
            return '<span class="badge badge-warning"><i class="fas fa-exclamation-triangle"></i> Atención</span>';
        case 'critico':
            return '<span class="badge badge-danger"><i class="fas fa-times-circle"></i> Crítico</span>';
        default:
            return '<span class="badge badge-secondary">Desconocido</span>';
    }
}
/**
 * Ver detalle de empleado
 */
function verDetalleEmpleado(idPersonal) {
    const empleado = datosEmpleados.find(emp => emp.IdPersonal === idPersonal);
    if (!empleado) return;
    
    const problemas = [];
    const proximosVencer = [];
    
    if (empleado.Estados.igss === 'faltante') problemas.push('• IGSS no registrado');
    if (empleado.Estados.irtra === 'faltante') problemas.push('• IRTRA no registrado');
    if (empleado.Estados.contrato === 'faltante') problemas.push('• Contrato no registrado');
    if (empleado.Estados.nit === 'faltante') problemas.push('• NIT no registrado');
    if (empleado.Estados.tarjetaSalud === 'faltante') problemas.push('• Tarjeta de Salud no registrada');
    if (empleado.Estados.tarjetaSalud === 'vencido') problemas.push('• Tarjeta de Salud vencida');
    if (empleado.Estados.tarjetaManipulacion === 'faltante') problemas.push('• Tarjeta de Manipulación no registrada');
    if (empleado.Estados.tarjetaManipulacion === 'vencido') problemas.push('• Tarjeta de Manipulación vencida');
    
    if (empleado.Estados.tarjetaSalud === 'proximo') proximosVencer.push(`• Tarjeta de Salud vence: ${formatearFecha(empleado.FechaVencimientoTS)}`);
    if (empleado.Estados.tarjetaManipulacion === 'proximo') proximosVencer.push(`• Tarjeta de Manipulación vence: ${formatearFecha(empleado.FechaVencimientoTM)}`);
    
    let contenido = '';
    
    if (problemas.length > 0) {
        contenido += `<div class="text-start" style="margin-bottom: 15px;"><strong style="color: #FF5252;">Documentos pendientes:</strong><br>${problemas.join('<br>')}</div>`;
    }
    
    if (proximosVencer.length > 0) {
        contenido += `<div class="text-start" style="margin-bottom: 15px;"><strong style="color: #FFC107;">Próximos a vencer:</strong><br>${proximosVencer.join('<br>')}</div>`;
    }
    
    if (problemas.length === 0 && proximosVencer.length === 0) {
        contenido = '<div class="text-center"><i class="fas fa-check-circle" style="font-size: 2rem; color: #4CAF50; margin-bottom: 10px;"></i><br><strong>Todos los documentos están completos y vigentes</strong></div>';
    }
    
    Swal.fire({
        title: empleado.NombreCompleto,
        html: contenido,
        icon: problemas.length > 0 ? 'warning' : (proximosVencer.length > 0 ? 'info' : 'success'),
        showCancelButton: true,
        confirmButtonColor: '#FF9800',
        cancelButtonColor: '#3498db',
        confirmButtonText: '<i class="fas fa-edit"></i> Editar Empleado',
        cancelButtonText: 'Cerrar',
        width: '500px'
    }).then((result) => {
        if (result.isConfirmed) {
            abrirPanelEdicion(idPersonal);
        }
    });
}

/**
 * Exportar datos a Excel
 */
function exportarDatos() {
    if (!datosEmpleados.length) {
        mostrarError('Sin datos', 'No hay datos para exportar.');
        return;
    }
    
    // Crear datos para exportar
    const datosExportar = datosEmpleados.map(emp => ({
        'ID': emp.IdPersonal,
        'Nombre Completo': emp.NombreCompleto,
        'IGSS': emp.Estados.igss === 'completo' ? 'Completo' : 'Faltante',
        'IRTRA': emp.Estados.irtra === 'completo' ? 'Completo' : 'Faltante',
        'Contrato': emp.Estados.contrato === 'completo' ? 'Completo' : 'Faltante',
        'NIT': emp.Estados.nit === 'completo' ? 'Completo' : 'Faltante',
        'Tarjeta Salud': emp.Estados.tarjetaSalud === 'completo' ? 'Completo' : 
                        emp.Estados.tarjetaSalud === 'vencido' ? 'Vencido' : 
                        emp.Estados.tarjetaSalud === 'proximo' ? 'Próximo a vencer' : 'Faltante',
        'Tarjeta Manipulación': emp.Estados.tarjetaManipulacion === 'completo' ? 'Completo' : 
                               emp.Estados.tarjetaManipulacion === 'vencido' ? 'Vencido' : 
                               emp.Estados.tarjetaManipulacion === 'proximo' ? 'Próximo a vencer' : 'Faltante',
        'Estado General': emp.EstadoGeneral === 'completo' ? 'Completo' : 
                         emp.EstadoGeneral === 'advertencia' ? 'Atención' : 'Crítico',
        'Fecha TS': emp.FechaVencimientoTS ? formatearFecha(emp.FechaVencimientoTS) : 'No registrada',
        'Fecha TM': emp.FechaVencimientoTM ? formatearFecha(emp.FechaVencimientoTM) : 'No registrada'
    }));
    
    // Simular exportación (aquí puedes implementar la exportación real)
    console.log('Datos para exportar:', datosExportar);
    
    mostrarMensaje('Exportación', `Se prepararía la exportación de ${datosExportar.length} registros del departamento ${departamentoSeleccionado.nombre}.`, 'info');
}

/**
 * Mostrar secciones con datos
 */
function mostrarSecciones() {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('tableSection').style.display = 'block';
    
    // Agregar animación
    document.getElementById('tableSection').classList.add('fadeIn');
}

/**
 * Limpiar resultados
 */
function limpiarResultados() {
    document.getElementById('tableSection').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('sidebarStats').style.display = 'none';
    
    datosEmpleados = [];
    departamentoSeleccionado = null;
    
    if (tablaEmpleados) {
        tablaEmpleados.destroy();
        tablaEmpleados = null;
    }
}
/**
 * Mostrar notificación de éxito
 */
function mostrarNotificacionExito(mensaje) {
    Swal.fire({
        title: '✅ Datos Cargados',
        text: mensaje,
        icon: 'success',
        confirmButtonColor: '#FF9800',
        timer: 3000,
        timerProgressBar: true,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
    });
}

/**
 * Mostrar/ocultar modal de carga
 */
function mostrarCarga(mostrar) {
    const modal = document.getElementById('loadingModal');
    modal.style.display = mostrar ? 'flex' : 'none';
    
    if (mostrar) {
        // Prevenir scroll del body cuando está cargando
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

/**
 * Mostrar mensaje de error
 */
function mostrarError(titulo, mensaje) {
    Swal.fire({
        title: titulo,
        text: mensaje,
        icon: 'error',
        confirmButtonColor: '#FF9800',
        confirmButtonText: 'Entendido'
    });
}

/**
 * Mostrar mensaje genérico
 */
function mostrarMensaje(titulo, mensaje, tipo = 'info') {
    Swal.fire({
        title: titulo,
        text: mensaje,
        icon: tipo,
        confirmButtonColor: '#FF9800',
        confirmButtonText: 'Aceptar'
    });
}

/**
 * Formatear fecha para mostrar
 */
function formatearFecha(fecha) {
    if (!fecha) return 'No definida';
    
    try {
        // CORREGIDO: Crear fecha sin conversión de zona horaria
        const fechaObj = new Date(fecha + 'T00:00:00'); // Agregar tiempo para evitar UTC
        
        return fechaObj.toLocaleDateString('es-GT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'Fecha inválida';
    }
}

/**
 * Buscar empleado por ID
 */
function buscarEmpleadoPorId(id) {
    return datosEmpleados.find(emp => emp.IdPersonal === id);
}
/**
 * Validar datos antes de procesar
 */
function validarDatos(empleados) {
    if (!Array.isArray(empleados)) {
        throw new Error('Los datos de empleados deben ser un array');
    }
    
    empleados.forEach((emp, index) => {
        if (!emp.IdPersonal) {
            console.warn(`Empleado en índice ${index} no tiene ID válido:`, emp);
        }
        if (!emp.PrimerNombre && !emp.PrimerApellido) {
            console.warn(`Empleado en índice ${index} no tiene nombre válido:`, emp);
        }
    });
    
    return empleados.filter(emp => emp.IdPersonal); // Filtrar empleados sin ID válido
}

/**
 * Debounce function para optimizar búsquedas
 */
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

/**
 * Obtener resumen textual del departamento
 */
function obtenerResumenDepartamento() {
    if (!departamentoSeleccionado || !datosEmpleados.length) {
        return 'No hay datos disponibles';
    }
    
    const stats = calcularEstadisticas();
    const porcentajeCompletos = Math.round((stats.completos / stats.total) * 100);
    
    let resumen = `Departamento: ${departamentoSeleccionado.nombre}\n`;
    resumen += `Total empleados: ${stats.total}\n`;
    resumen += `Documentos completos: ${stats.completos} (${porcentajeCompletos}%)\n`;
    
    if (stats.sinContrato > 0) resumen += `Sin contrato: ${stats.sinContrato}\n`;
    if (stats.sinIGSS > 0) resumen += `Sin IGSS: ${stats.sinIGSS}\n`;
    if (stats.sinIRTRA > 0) resumen += `Sin IRTRA: ${stats.sinIRTRA}\n`;
    if (stats.sinNIT > 0) resumen += `Sin NIT: ${stats.sinNIT}\n`;
    if (stats.tsVencida > 0) resumen += `T.S. vencida/faltante: ${stats.tsVencida}\n`;
    if (stats.tmVencida > 0) resumen += `T.M. vencida/faltante: ${stats.tmVencida}\n`;
    
    return resumen;
}

/**
 * Manejar errores globales
 */
window.addEventListener('error', function(error) {
    console.error('Error global:', error);
    
    // Solo mostrar al usuario si es un error crítico
    if (error.message && error.message.includes('connection') || error.message.includes('network')) {
        mostrarError('Error de conexión', 'Problema de conectividad. Verifica tu conexión a internet.');
    }
});

/**
 * Manejar errores de promesas no capturadas
 */
window.addEventListener('unhandledrejection', function(event) {
    console.error('Error de promesa no capturado:', event.reason);
    
    // Solo mostrar al usuario si es un error de conexión
    if (event.reason && (event.reason.message?.includes('connection') || event.reason.message?.includes('network'))) {
        mostrarError('Error de conexión', 'Problema de conectividad. Verifica tu conexión a internet.');
    }
    
    // Prevenir que el error se muestre en la consola del navegador
    event.preventDefault();
});

/**
 * Limpiar recursos al cerrar la página
 */
window.addEventListener('beforeunload', function() {
    if (tablaEmpleados) {
        try {
            tablaEmpleados.destroy();
        } catch (error) {
            console.warn('Error al destruir tabla:', error);
        }
    }
});

/**
 * Inicializar tooltips simples
 */
function inicializarTooltips() {
    // Implementación simple de tooltips sin dependencias
    document.querySelectorAll('[title]').forEach(element => {
        let tooltip = null;
        
        element.addEventListener('mouseenter', function(e) {
            tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.textContent = this.title;
            tooltip.style.cssText = `
                position: absolute;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 5px 8px;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none;
                z-index: 10000;
                white-space: nowrap;
            `;
            document.body.appendChild(tooltip);
            
            this.setAttribute('data-original-title', this.title);
            this.removeAttribute('title');
        });
        
        element.addEventListener('mousemove', function(e) {
            if (tooltip) {
                tooltip.style.left = e.pageX + 10 + 'px';
                tooltip.style.top = e.pageY + 10 + 'px';
            }
        });
        
        element.addEventListener('mouseleave', function() {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
            
            const originalTitle = this.getAttribute('data-original-title');
            if (originalTitle) {
                this.title = originalTitle;
                this.removeAttribute('data-original-title');
            }
        });
    });
}

/**
 * Función para actualizar la tabla después de cambios
 */
function refrescarTabla() {
    if (tablaEmpleados && departamentoSeleccionado) {
        actualizarTabla();
        actualizarResumen();
        actualizarContadoresFiltros();
    }
}

/**
 * Exportar funciones que pueden ser llamadas desde HTML
 */
window.verDetalleEmpleado = verDetalleEmpleado;
window.refrescarTabla = refrescarTabla;
window.obtenerResumenDepartamento = obtenerResumenDepartamento;

// Inicializar tooltips cuando la página esté lista
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(inicializarTooltips, 1000);
});

/**
 * Optimización: Lazy loading para mejorar rendimiento
 */
function optimizarRendimiento() {
    // Intersection Observer para animaciones solo cuando están visibles
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fadeIn');
            }
        });
    });
    
    // Observar elementos que necesitan animación
    document.querySelectorAll('.summary-card, .table-section').forEach(el => {
        observer.observe(el);
    });
}
/**
 * Abrir panel de edición para un empleado
 */
function abrirPanelEdicion(idPersonal) {
    empleadoEditando = datosEmpleados.find(emp => emp.IdPersonal === idPersonal);
    if (!empleadoEditando) return;
    
    // Guardar datos originales para comparar cambios
    datosOriginales = { ...empleadoEditando };
    
    // Llenar formulario con datos actuales
    llenarFormularioEdicion(empleadoEditando);
    
    // Mostrar panel
    document.getElementById('editPanel').classList.add('open');
    document.getElementById('editPanelOverlay').classList.add('show');
    
    // Configurar event listeners
    configurarEventosEdicion();
}

/**
 * Llenar formulario con datos del empleado
 */
function llenarFormularioEdicion(empleado) {
    document.getElementById('editPrimerNombre').value = empleado.PrimerNombre || '';
    document.getElementById('editSegundoNombre').value = empleado.SegundoNombre || '';
    document.getElementById('editTercerNombre').value = empleado.TercerNombre || '';
    document.getElementById('editPrimerApellido').value = empleado.PrimerApellido || '';
    document.getElementById('editSegundoApellido').value = empleado.SegundoApellido || '';
    
    document.getElementById('editIGSS').value = empleado.IGSS || 0;
    document.getElementById('editIRTRA').value = empleado.IRTRA || 0;
    // REMOVIDO: editContrato
    document.getElementById('editNIT').value = empleado.NIT || '';
    
    document.getElementById('editFechaContrato').value = formatearFechaInput(empleado.FechaContrato);
    document.getElementById('editFechaVencimientoTS').value = formatearFechaInput(empleado.FechaVencimientoTS);
    document.getElementById('editFechaVencimientoTM').value = formatearFechaInput(empleado.FechaVencimientoTM);
}
function calcularValorContrato(fechaContrato) {
    // Si hay fecha de contrato = 1, si no hay = 0
    return fechaContrato && fechaContrato.trim() !== '' ? 1 : 0;
}
function formatearFechaInput(fecha) {
    if (!fecha) return '';
    try {
        const fechaObj = new Date(fecha + 'T00:00:00');
        return fechaObj.toISOString().split('T')[0];
    } catch (error) {
        return '';
    }
}
/**
 * Configurar eventos del panel de edición
 */
function configurarEventosEdicion() {
    // Cerrar panel
    document.getElementById('closeEditPanel').onclick = cerrarPanelEdicion;
    document.getElementById('cancelEdit').onclick = cerrarPanelEdicion;
    document.getElementById('editPanelOverlay').onclick = cerrarPanelEdicion;
    
    // Detectar cambios en campos
    document.querySelectorAll('#editForm input').forEach(input => {
        input.addEventListener('input', marcarCambio);
    });
    
    // Envío de formulario
    document.getElementById('editForm').onsubmit = confirmarGuardarCambios;
}

/**
 * Marcar campo como cambiado
 */
function marcarCambio(event) {
    const field = event.target.closest('.edit-field');
    const fieldName = event.target.name;
    const newValue = event.target.value;
    const originalValue = datosOriginales[fieldName];
    
    if (newValue != originalValue) {
        field.classList.add('changed');
    } else {
        field.classList.remove('changed');
    }
}

/**
 * Cerrar panel de edición
 */
function cerrarPanelEdicion() {
    // Verificar si hay cambios sin guardar
    const camposConCambios = document.querySelectorAll('.edit-field.changed');
    
    if (camposConCambios.length > 0) {
        Swal.fire({
            title: '¿Salir sin guardar?',
            text: 'Tienes cambios sin guardar que se perderán.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#FF9800',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, salir',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                ejecutarCerrarPanel();
            }
        });
    } else {
        ejecutarCerrarPanel();
    }
}
/**
 * Ejecutar cierre del panel
 */
function ejecutarCerrarPanel() {
    document.getElementById('editPanel').classList.remove('open');
    document.getElementById('editPanelOverlay').classList.remove('show');
    
    // Limpiar
    empleadoEditando = null;
    datosOriginales = {};
    document.querySelectorAll('.edit-field.changed').forEach(field => {
        field.classList.remove('changed');
    });
}

/**
 * Confirmar y guardar cambios
 */
async function confirmarGuardarCambios(event) {
    event.preventDefault();
    
    const cambios = obtenerCambios();
    if (cambios.length === 0) {
        mostrarMensaje('Sin cambios', 'No se detectaron cambios para guardar.', 'info');
        return;
    }
    
    // Mostrar confirmación con resumen de cambios
    const listaCambios = cambios.map(c => `• ${c.campo}: ${c.valorAnterior} → ${c.valorNuevo}`).join('<br>');
    
    const result = await Swal.fire({
        title: 'Confirmar Cambios',
        html: `
            <strong>Empleado:</strong> ${empleadoEditando.NombreCompleto}<br><br>
            <strong>Cambios a realizar:</strong><br>
            ${listaCambios}
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#FF9800',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
        await guardarCambiosEmpleado(cambios);
    }
}

/**
 * Obtener lista de cambios realizados
 */
function obtenerCambios() {
    const cambios = [];
    const formData = new FormData(document.getElementById('editForm'));
    
    const mapeoNombres = {
        'PrimerNombre': 'Primer Nombre',
        'SegundoNombre': 'Segundo Nombre', 
        'TercerNombre': 'Tercer Nombre',
        'PrimerApellido': 'Primer Apellido',
        'SegundoApellido': 'Segundo Apellido',
        'IGSS': 'IGSS',
        'IRTRA': 'IRTRA',
        'Contrato': 'Contrato', // Se maneja automáticamente
        'NIT': 'NIT',
        'FechaContrato': 'Fecha de Contrato',
        'FechaVencimientoTS': 'Fecha Vencimiento TS',
        'FechaVencimientoTM': 'Fecha Vencimiento TM'
    };
    
    // Procesar campos del formulario
    for (let [campo, valor] of formData.entries()) {
        const valorOriginal = datosOriginales[campo];
        const valorNuevo = valor;
        
        // Normalizar valores para comparación
        let valorOriginalNorm = valorOriginal;
        let valorNuevoNorm = valorNuevo;
        
        // Para campos numéricos, normalizar 0 vs null vs undefined
        if (['IGSS', 'IRTRA'].includes(campo)) {
            valorOriginalNorm = valorOriginal || 0;
            valorNuevoNorm = valorNuevo || 0;
        }
        
        // Para NIT, normalizar null vs undefined vs vacío
        if (campo === 'NIT') {
            valorOriginalNorm = valorOriginal || '';
            valorNuevoNorm = valorNuevo || '';
        }
        
        // Para fechas, normalizar null vs undefined vs vacío
        if (['FechaContrato', 'FechaVencimientoTS', 'FechaVencimientoTM'].includes(campo)) {
            valorOriginalNorm = valorOriginal || '';
            valorNuevoNorm = valorNuevo || '';
        }
        
        if (valorNuevoNorm != valorOriginalNorm) {
            cambios.push({
                campo: mapeoNombres[campo] || campo,
                campoReal: campo,
                valorAnterior: valorOriginalNorm || 'Sin datos',
                valorNuevo: valorNuevoNorm || 'Sin datos'
            });
        }
    }
    
    // NUEVO: Verificar si cambió la fecha de contrato para actualizar campo Contrato automáticamente
    const fechaContratoNueva = formData.get('FechaContrato');
    const contratoNuevo = calcularValorContrato(fechaContratoNueva);
    const contratoOriginal = datosOriginales.Contrato || 0;
    
    if (contratoNuevo != contratoOriginal) {
        // Solo agregar si no está ya en la lista de cambios
        const yaEstaContrato = cambios.find(c => c.campoReal === 'Contrato');
        if (!yaEstaContrato) {
            cambios.push({
                campo: 'Contrato',
                campoReal: 'Contrato',
                valorAnterior: contratoOriginal,
                valorNuevo: contratoNuevo
            });
        }
    }
    
    return cambios;
}

/**
 * Guardar cambios en base de datos
 */
async function guardarCambiosEmpleado(cambios) {
    try {
        mostrarCarga(true);
        
        const connection = await connectionString();
        const userData = JSON.parse(localStorage.getItem('userData'));
        
        // CORREGIDO: Procesar valores antes de enviar a BD
        const camposUpdate = [];
        const valoresUpdate = [];
        
        cambios.forEach(cambio => {
            camposUpdate.push(`${cambio.campoReal} = ?`);
            
            // Convertir valores según el tipo de campo
            let valorParaBD = cambio.valorNuevo;
            
            // Campos de fecha - convertir vacío a NULL
            if (['FechaContrato', 'FechaVencimientoTS', 'FechaVencimientoTM'].includes(cambio.campoReal)) {
                valorParaBD = cambio.valorNuevo && cambio.valorNuevo.trim() !== '' ? cambio.valorNuevo : null;
            }
            
            // Campos numéricos - convertir vacío a 0
            if (['IGSS', 'IRTRA', 'Contrato'].includes(cambio.campoReal)) {
                valorParaBD = cambio.valorNuevo && cambio.valorNuevo.toString().trim() !== '' ? parseInt(cambio.valorNuevo) : 0;
            }
            
            // Campo NIT - convertir vacío a NULL
            if (cambio.campoReal === 'NIT') {
                valorParaBD = cambio.valorNuevo && cambio.valorNuevo.trim() !== '' ? cambio.valorNuevo : null;
            }
            
            valoresUpdate.push(valorParaBD);
        });
        
        // Actualizar empleado
        await connection.query(
            `UPDATE personal SET ${camposUpdate.join(', ')} WHERE IdPersonal = ?`,
            [...valoresUpdate, empleadoEditando.IdPersonal]
        );
        
        // Registrar cambios en log (con valores originales para el historial)
        for (const cambio of cambios) {
            await connection.query(`
                INSERT INTO CambiosPersonal (
                    IdPersonal, NombrePersonal, TipoCambio, Cambio, 
                    ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario
                ) VALUES (?, ?, 4, ?, ?, ?, ?, ?)
            `, [
                empleadoEditando.IdPersonal,
                empleadoEditando.NombreCompleto,
                cambio.campo,
                cambio.valorAnterior,
                cambio.valorNuevo,
                userData.IdPersonal,
                userData.NombreCompleto
            ]);
        }
        
        await connection.close();
        
        // CORREGIDO: Actualizar datos en memoria con valores procesados
        cambios.forEach((cambio, index) => {
            empleadoEditando[cambio.campoReal] = valoresUpdate[index];
        });
        
        // Recalcular estados
        const empleadoActualizado = procesarEmpleado(empleadoEditando);
        const index = datosEmpleados.findIndex(emp => emp.IdPersonal === empleadoEditando.IdPersonal);
        datosEmpleados[index] = empleadoActualizado;
        
        // Actualizar interfaz
        actualizarTabla();
        actualizarResumen();
        
        mostrarMensaje('Cambios Guardados', 'Los datos del empleado se actualizaron correctamente.', 'success');
        ejecutarCerrarPanel();
        
    } catch (error) {
        console.error('Error al guardar cambios:', error);
        mostrarError('Error al guardar', 'No se pudieron guardar los cambios. Inténtalo nuevamente.');
    } finally {
        mostrarCarga(false);
    }
}
// Llamar optimización cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', optimizarRendimiento);
} else {
    optimizarRendimiento();
}