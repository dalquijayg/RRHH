const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');

// Referencias a elementos del DOM
let fechaInicio, fechaFin, btnBuscar, tablaPlanillasBody, totalRegistros, cantidadPlanillas, montoTotal, totalTurnos;
let btnVistaDetalle, btnVistaResumen, headerDetalle, headerResumen;

// Variable para guardar los datos actuales
let datosActuales = [];
let vistaActual = 'detalle';

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    inicializarElementos();
    configurarEventos();
    establecerFechasPorDefecto();
});

// Inicializar referencias a elementos del DOM
function inicializarElementos() {
    fechaInicio = document.getElementById('fechaInicio');
    fechaFin = document.getElementById('fechaFin');
    btnBuscar = document.getElementById('btnBuscar');
    tablaPlanillasBody = document.getElementById('tablaPlanillasBody');
    totalRegistros = document.getElementById('totalRegistros');
    cantidadPlanillas = document.getElementById('cantidadPlanillas');
    montoTotal = document.getElementById('montoTotal');
    totalTurnos = document.getElementById('totalTurnos');

    // Botones de vista
    btnVistaDetalle = document.getElementById('btnVistaDetalle');
    btnVistaResumen = document.getElementById('btnVistaResumen');
    headerDetalle = document.getElementById('headerDetalle');
    headerResumen = document.getElementById('headerResumen');
}

// Configurar eventos
function configurarEventos() {
    btnBuscar.addEventListener('click', buscarPlanillas);

    // Permitir buscar con Enter en los campos de fecha
    fechaInicio.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') buscarPlanillas();
    });

    fechaFin.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') buscarPlanillas();
    });

    // Eventos de cambio de vista
    btnVistaDetalle.addEventListener('click', () => cambiarVista('detalle'));
    btnVistaResumen.addEventListener('click', () => cambiarVista('resumen'));
}

// Establecer fechas por defecto (mes actual)
function establecerFechasPorDefecto() {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    fechaInicio.value = formatearFechaInput(primerDiaMes);
    fechaFin.value = formatearFechaInput(hoy);
}

// Formatear fecha para input type="date" (YYYY-MM-DD)
function formatearFechaInput(fecha) {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
}

// Validar fechas antes de buscar
function validarFechas() {
    if (!fechaInicio.value || !fechaFin.value) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos requeridos',
            text: 'Por favor, seleccione ambas fechas (inicio y fin)',
            confirmButtonColor: '#4CAF50'
        });
        return false;
    }

    const inicio = new Date(fechaInicio.value);
    const fin = new Date(fechaFin.value);

    if (inicio > fin) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas inválidas',
            text: 'La fecha de inicio no puede ser mayor a la fecha fin',
            confirmButtonColor: '#4CAF50'
        });
        return false;
    }

    return true;
}

// Buscar planillas parciales
async function buscarPlanillas() {
    if (!validarFechas()) return;

    // Mostrar loading
    btnBuscar.disabled = true;
    btnBuscar.textContent = 'Buscando...';

    let connection;

    try {
        // Obtener conexión usando tu módulo de conexión
        connection = await connectionString();

        const query = `
            SELECT
                PagoPlanillaParcialDetalle.IdPlanillaParcialDetalle,
                departamentos.NombreDepartamento,
                PagoPlanillaParcial.MontoPlanillaParcial,
                PagoPlanillaParcial.CantidadColaboradores,
                PagoPlanillaParcial.PeriodoPago,
                PagoPlanillaParcial.NombreUsuario,
                PagoPlanillaParcial.FechaHoraRegistro,
                PagoPlanillaParcialEstados.NombreEstado,
                PagoPlanillaParcial.NombreUsuarioAutoriza,
                PagoPlanillaParcial.FechaHoraAutorizacion,
                PagoPlanillaParcialDetalle.NombrePersonal,
                PagoPlanillaParcialDetalle.FechaLaborada,
                PagoPlanillaParcialDetalle.IdTipoTurno,
                PagoPlanillaParcialDetalle.TipoTurno,
                PagoPlanillaParcialDetalle.MontoPagado
            FROM
                PagoPlanillaParcial
                INNER JOIN departamentos ON PagoPlanillaParcial.IdDepartamentoSucursal = departamentos.IdDepartamento
                INNER JOIN PagoPlanillaParcialEstados ON PagoPlanillaParcial.Estado = PagoPlanillaParcialEstados.IdEstadoPagoPlanillaParcial
                INNER JOIN PagoPlanillaParcialDetalle ON PagoPlanillaParcialDetalle.IdPlanillaParcial = PagoPlanillaParcial.IdPlanillaParcial
            WHERE
                PagoPlanillaParcialDetalle.FechaLaborada BETWEEN ? AND ?
            ORDER BY
                PagoPlanillaParcialDetalle.FechaLaborada DESC,
                PagoPlanillaParcialDetalle.IdPlanillaParcialDetalle DESC
        `;

        // Ejecutar query con parámetros (MySQL usa ? en lugar de @parameter)
        const resultado = await connection.query(query, [fechaInicio.value, fechaFin.value]);

        // Guardar datos y mostrar
        datosActuales = resultado;
        vistaActual = 'detalle';
        actualizarBotonesVista();
        mostrarResultados(datosActuales);

    } catch (error) {
        console.error('Error al buscar planillas:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al buscar las planillas: ' + error.message,
            confirmButtonColor: '#4CAF50'
        });
    } finally {
        // Cerrar conexión
        if (connection) {
            await connection.close();
        }
        btnBuscar.disabled = false;
        btnBuscar.textContent = 'Buscar';
    }
}

// Mostrar resultados en la tabla
function mostrarResultados(datos) {
    tablaPlanillasBody.innerHTML = '';

    if (datos.length === 0) {
        tablaPlanillasBody.innerHTML = `
            <tr class="fila-vacia">
                <td colspan="9">No se encontraron registros para el rango de fechas seleccionado</td>
            </tr>
        `;
        totalRegistros.textContent = '0';
        cantidadPlanillas.textContent = '0';
        totalTurnos.textContent = '0';
        montoTotal.textContent = 'Q 0.00';
        return;
    }

    // Variables para calcular totales
    let sumaMontos = 0;
    const planillasUnicas = new Set();

    datos.forEach(planilla => {
        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>${planilla.NombreDepartamento || ''}</td>
            <td>${formatearMoneda(planilla.MontoPlanillaParcial)}</td>
            <td>${planilla.CantidadColaboradores || '0'}</td>
            <td>${planilla.PeriodoPago || ''}</td>
            <td>${planilla.NombreUsuario || ''}</td>
            <td>${formatearFechaHora(planilla.FechaHoraRegistro)}</td>
            <td>${planilla.NombreEstado || ''}</td>
            <td>${planilla.NombreUsuarioAutoriza || 'N/A'}</td>
            <td>${formatearFechaHora(planilla.FechaHoraAutorizacion)}</td>
        `;

        tablaPlanillasBody.appendChild(fila);

        // Acumular montos
        const monto = parseFloat(planilla.MontoPlanillaParcial) || 0;
        sumaMontos += monto;

        // Identificar planillas únicas (por IdPlanillaParcialDetalle o combinación de campos)
        const planillaKey = `${planilla.NombreDepartamento}-${planilla.PeriodoPago}-${planilla.FechaHoraRegistro}`;
        planillasUnicas.add(planillaKey);
    });

    // Actualizar información de los totales
    totalRegistros.textContent = datos.length;
    cantidadPlanillas.textContent = planillasUnicas.size;
    totalTurnos.textContent = datos.length; // Total de turnos = total de registros
    montoTotal.textContent = formatearMoneda(sumaMontos);
}

// Formatear moneda
function formatearMoneda(monto) {
    if (monto === null || monto === undefined) return 'Q 0.00';
    return 'Q ' + parseFloat(monto).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Formatear fecha y hora
function formatearFechaHora(fechaHora) {
    if (!fechaHora) return 'N/A';
    const f = new Date(fechaHora);
    const dia = String(f.getDate()).padStart(2, '0');
    const mes = String(f.getMonth() + 1).padStart(2, '0');
    const año = f.getFullYear();
    const horas = String(f.getHours()).padStart(2, '0');
    const minutos = String(f.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${año} ${horas}:${minutos}`;
}

// Cambiar entre vista detalle y resumen
async function cambiarVista(vista) {
    if (datosActuales.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin datos',
            text: 'Primero realiza una búsqueda para ver los resultados',
            confirmButtonColor: '#4CAF50'
        });
        return;
    }

    vistaActual = vista;
    actualizarBotonesVista();

    if (vista === 'detalle') {
        // Mostrar vista detalle
        headerDetalle.style.display = '';
        headerResumen.style.display = 'none';
        mostrarResultados(datosActuales);
    } else {
        // Mostrar vista resumen
        headerDetalle.style.display = 'none';
        headerResumen.style.display = '';
        await cargarResumenDepartamentos();
    }
}

// Cargar resumen agrupado por departamentos
async function cargarResumenDepartamentos() {
    tablaPlanillasBody.innerHTML = '<tr class="fila-vacia"><td colspan="7">Cargando resumen...</td></tr>';

    let connection;

    try {
        connection = await connectionString();

        const query = `
            SELECT
                departamentos.NombreDepartamento,
                SUM(PagoPlanillaParcial.MontoPlanillaParcial) AS TotalMonto,
                SUM(PagoPlanillaParcial.CantidadColaboradores) AS TotalColaboradores,
                COUNT(DISTINCT PagoPlanillaParcial.IdPlanillaParcial) AS CantidadPlanillas,
                SUM(CASE WHEN PagoPlanillaParcialDetalle.IdTipoTurno = 1 THEN 1 ELSE 0 END) AS TurnosMañana,
                SUM(CASE WHEN PagoPlanillaParcialDetalle.IdTipoTurno = 2 THEN 1 ELSE 0 END) AS TurnosMixto,
                SUM(CASE WHEN PagoPlanillaParcialDetalle.IdTipoTurno = 3 THEN 1 ELSE 0 END) AS Turnos4Horas
            FROM
                PagoPlanillaParcial
                INNER JOIN departamentos
                    ON PagoPlanillaParcial.IdDepartamentoSucursal = departamentos.IdDepartamento
                INNER JOIN PagoPlanillaParcialEstados
                    ON PagoPlanillaParcial.Estado = PagoPlanillaParcialEstados.IdEstadoPagoPlanillaParcial
                INNER JOIN PagoPlanillaParcialDetalle
                    ON PagoPlanillaParcialDetalle.IdPlanillaParcial = PagoPlanillaParcial.IdPlanillaParcial
            WHERE
                PagoPlanillaParcialDetalle.FechaLaborada BETWEEN ? AND ?
            GROUP BY
                departamentos.IdDepartamento,
                departamentos.NombreDepartamento
            ORDER BY
                TotalMonto DESC
        `;

        const resultado = await connection.query(query, [fechaInicio.value, fechaFin.value]);
        await connection.close();

        mostrarResumenDepartamentos(resultado);

    } catch (error) {
        console.error('Error al cargar resumen:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al cargar el resumen: ' + error.message,
            confirmButtonColor: '#4CAF50'
        });
        tablaPlanillasBody.innerHTML = '<tr class="fila-vacia"><td colspan="7">Error al cargar el resumen</td></tr>';
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

// Mostrar resumen por departamentos
function mostrarResumenDepartamentos(datos) {
    tablaPlanillasBody.innerHTML = '';

    if (datos.length === 0) {
        tablaPlanillasBody.innerHTML = `
            <tr class="fila-vacia">
                <td colspan="7">No se encontraron datos para el rango de fechas seleccionado</td>
            </tr>
        `;
        return;
    }

    // Variables para calcular totales
    let sumaMontos = 0;
    let sumaColaboradores = 0;
    let sumaPlanillas = 0;
    let sumaTurnos = 0;

    datos.forEach(departamento => {
        const fila = document.createElement('tr');
        fila.classList.add('fila-resumen');

        const turnosMañana = parseInt(departamento.TurnosMañana) || 0;
        const turnosMixto = parseInt(departamento.TurnosMixto) || 0;
        const turnos4Horas = parseInt(departamento.Turnos4Horas) || 0;

        fila.innerHTML = `
            <td><strong>${departamento.NombreDepartamento || ''}</strong></td>
            <td>${formatearMoneda(departamento.TotalMonto)}</td>
            <td>${departamento.TotalColaboradores || '0'}</td>
            <td>${departamento.CantidadPlanillas || '0'}</td>
            <td>${turnosMañana}</td>
            <td>${turnosMixto}</td>
            <td>${turnos4Horas}</td>
        `;

        tablaPlanillasBody.appendChild(fila);

        // Acumular totales
        sumaMontos += parseFloat(departamento.TotalMonto) || 0;
        sumaColaboradores += parseInt(departamento.TotalColaboradores) || 0;
        sumaPlanillas += parseInt(departamento.CantidadPlanillas) || 0;
        sumaTurnos += turnosMañana + turnosMixto + turnos4Horas;
    });

    // Actualizar información de los totales
    totalRegistros.textContent = datosActuales.length; // Total de registros originales
    cantidadPlanillas.textContent = sumaPlanillas; // Total de planillas
    totalTurnos.textContent = sumaTurnos; // Total de turnos
    montoTotal.textContent = formatearMoneda(sumaMontos);
}

// Actualizar estado visual de los botones de vista
function actualizarBotonesVista() {
    // Remover clase activo de todos
    btnVistaDetalle.classList.remove('activo');
    btnVistaResumen.classList.remove('activo');

    // Agregar clase activo al botón seleccionado
    if (vistaActual === 'detalle') {
        btnVistaDetalle.classList.add('activo');
    } else {
        btnVistaResumen.classList.add('activo');
    }
}
