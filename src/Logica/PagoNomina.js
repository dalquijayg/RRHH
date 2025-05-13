const odbc = require('odbc');
const path = require('path');
const { writeFile } = require('fs').promises;
const XLSX = require('xlsx');
const Swal = require('sweetalert2');

// Configuración de conexión a la base de datos
const conexion = 'DSN=recursos2';

// Variables para la paginación
let currentPage = 1;
const rowsPerPage = 10;
let totalRows = 0;
let filteredData = [];

// Función para establecer conexión a la base de datos
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
        await Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar a la base de datos. Por favor intente nuevamente.'
        });
        throw error;
    }
}
// Función para verificar qué planillas ya están guardadas
async function obtenerPlanillasGuardadas() {
    try {
        // Obtener valores de los filtros
        const tipoQuincena = document.getElementById('tipoQuincenaFilter').value;
        const idTipoPago = tipoQuincena === 'normal' ? 1 : 2;
        const mes = document.getElementById('mesFilter').value;
        const anio = document.getElementById('anioFilter').value;
        
        const connection = await connectionString();
        
        // Consulta para obtener las planillas ya guardadas
        const query = `
            SELECT DISTINCT IdPlanilla 
            FROM PagoPlanilla 
            WHERE IdTipoPago = ? 
            AND Mes = ? 
            AND Anyo = ?
        `;
        
        const planillas = await connection.query(query, [idTipoPago, mes, anio]);
        await connection.close();
        
        // Devolver un array con los IDs de planillas ya guardadas
        return planillas.map(p => p.IdPlanilla.toString());
        
    } catch (error) {
        console.error('Error al obtener planillas guardadas:', error);
        return [];
    }
}
// Función para cargar las planillas disponibles
async function cargarPlanillas() {
    try {
        const connection = await connectionString();
        const planillas = await connection.query('SELECT IdPlanilla, Nombre_Planilla FROM planillas ORDER BY Nombre_Planilla');
        await connection.close();
        
        // Obtener las planillas ya guardadas
        const planillasGuardadas = await obtenerPlanillasGuardadas();
        
        const planillaSelect = document.getElementById('planillaFilter');
        
        // Mantener la opción de todas las planillas
        const defaultOption = planillaSelect.options[0];
        
        // Limpiar opciones actuales excepto la primera
        planillaSelect.innerHTML = '';
        planillaSelect.appendChild(defaultOption);
        
        // Agregar opciones de planillas
        planillas.forEach(planilla => {
            // Verificar si esta planilla ya está guardada
            const yaGuardada = planillasGuardadas.includes(planilla.IdPlanilla.toString());
            
            const option = document.createElement('option');
            option.value = planilla.IdPlanilla;
            
            // Marcar visualmente las planillas ya guardadas
            if (yaGuardada) {
                option.textContent = `${planilla.Nombre_Planilla} (✓ Guardada)`;
                option.classList.add('planilla-guardada');
                option.setAttribute('data-guardada', 'true');
            } else {
                option.textContent = planilla.Nombre_Planilla;
            }
            
            planillaSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar planillas:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar las planillas. Por favor intente nuevamente.'
        });
    }
}

// Función para calcular los días suspendidos en el periodo de la quincena
async function obtenerDiasSuspendidos(idPersonal, mes, anio, tipoQuincena) {
    try {
        const connection = await connectionString();
        
        // Determinar fechas de inicio y fin de la quincena
        let inicioQuincena, finQuincena;
        
        if (tipoQuincena === 'normal') {
            // Primera quincena: del 1 al 15
            inicioQuincena = `${anio}-${mes.padStart(2, '0')}-01`;
            finQuincena = `${anio}-${mes.padStart(2, '0')}-15`;
        } else {
            // Segunda quincena: del 16 al último día del mes
            inicioQuincena = `${anio}-${mes.padStart(2, '0')}-16`;
            
            // Obtener el último día del mes
            const ultimoDia = new Date(anio, parseInt(mes), 0).getDate();
            finQuincena = `${anio}-${mes.padStart(2, '0')}-${ultimoDia}`;
        }
        
        // Consulta para contar días suspendidos que se sobreponen con la quincena
        const query = `
            SELECT 
                IdPersonal,
                SUM(
                    DATEDIFF(
                        LEAST(FechaFin, ?), 
                        GREATEST(FechaInicio, ?)
                    ) + 1
                ) AS DiasSuspendidos
            FROM 
                Suspensiones
            WHERE 
                IdPersonal = ? 
                AND FechaInicio <= ? 
                AND FechaFin >= ?
            GROUP BY 
                IdPersonal
        `;
        
        const params = [
            finQuincena,      // LEAST(FechaFin, ?)
            inicioQuincena,   // GREATEST(FechaInicio, ?)
            idPersonal,       // IdPersonal = ?
            finQuincena,      // FechaInicio <= ?
            inicioQuincena    // FechaFin >= ?
        ];
        
        const results = await connection.query(query, params);
        await connection.close();
        
        // Si hay resultados, devolver los días suspendidos, sino devolver 0
        return results.length > 0 ? parseInt(results[0].DiasSuspendidos) : 0;
    } catch (error) {
        console.error('Error al obtener días suspendidos:', error);
        return 0; // En caso de error, asumir 0 días suspendidos
    }
}

// Función para obtener descuentos judiciales del empleado
async function obtenerDescuentosJudiciales(idPersonal) {
    try {
        const connection = await connectionString();
        
        // Consulta para obtener los descuentos judiciales del empleado
        const query = `
            SELECT 
                IdPersonal,
                DescuentoQuincenal,
                DescuentoQuincenalFinMes,
                NoDocumento,
                SaldoPendiente,
                IdDescuentoJudicial
            FROM 
                DescuentosJudiciales
            WHERE 
                IdPersonal = ? AND Estado = 0
        `;
        
        const results = await connection.query(query, [idPersonal]);
        await connection.close();
        
        // Si hay resultados, devolver la información de descuentos
        if (results.length > 0) {
            return {
                DescuentoQuincenal: parseFloat(results[0].DescuentoQuincenal) || 0,
                DescuentoQuincenalFinMes: parseFloat(results[0].DescuentoQuincenalFinMes) || 0,
                NoDocumento: results[0].NoDocumento || '',
                SaldoPendiente: parseFloat(results[0].SaldoPendiente) || 0,
                IdDescuentoJudicial: results[0].IdDescuentoJudicial
            };
        } else {
            // Si no hay descuentos judiciales
            return {
                DescuentoQuincenal: 0,
                DescuentoQuincenalFinMes: 0,
                NoDocumento: '',
                SaldoPendiente: 0,
                IdDescuentoJudicial: null
            };
        }
    } catch (error) {
        console.error('Error al obtener descuentos judiciales:', error);
        return {
            DescuentoQuincenal: 0,
            DescuentoQuincenalFinMes: 0,
            NoDocumento: '',
            SaldoPendiente: 0,
            IdDescuentoJudicial: null
        };
    }
}

// Función modificada para obtener todos los datos de nómina incluyendo bajas
async function obtenerDatosNomina() {
    try {
        // Mostrar loader
        document.getElementById('loader').style.display = 'block';
        document.getElementById('noData').style.display = 'none';
        
        // Obtener valores de los filtros
        const planillaId = document.getElementById('planillaFilter').value;
        const tipoQuincena = document.getElementById('tipoQuincenaFilter').value;
        const mes = document.getElementById('mesFilter').value;
        const anio = document.getElementById('anioFilter').value;
        
        console.log('Filtros aplicados:', { planillaId, tipoQuincena, mes, anio });
        
        // Construir la consulta SQL para personal activo
        let queryActivos = `
            SELECT
                personal.IdPersonal, 
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto, 
                personal.IdSucuDepa, 
                personal.FechaPlanilla, 
                departamentos.NombreDepartamento, 
                planillas.IdPlanilla, 
                planillas.Nombre_Planilla, 
                planillas.EsCapital, 
                planillas.NoCentroTrabajo,
                planillas.Division,
                divisiones.Nombre AS NombreDivision,
                personal.SalarioDiario, 
                personal.SalarioQuincena, 
                personal.SalarioQuincenaFinMes,
                personal.Bonificacion,
                personal.SalarioBase,
                personal.NoCuenta,
                NULL AS FechaFinColaborador,
                NULL AS TipoBaja
            FROM
                personal
                INNER JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
                INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                INNER JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                LEFT JOIN divisiones ON planillas.Division = divisiones.IdDivision
            WHERE
                personal.Estado IN (1,5) AND
                personal.TipoPersonal = 1`;
        
        // Determinar fechas de inicio y fin de la quincena
        let inicioQuincena, finQuincena;
        
        if (tipoQuincena === 'normal') {
            // Primera quincena: del 1 al 15
            inicioQuincena = `${anio}-${mes.padStart(2, '0')}-01`;
            finQuincena = `${anio}-${mes.padStart(2, '0')}-15`;
        } else {
            // Segunda quincena: del 16 al último día del mes
            inicioQuincena = `${anio}-${mes.padStart(2, '0')}-16`;
            const ultimoDia = new Date(anio, parseInt(mes), 0).getDate();
            finQuincena = `${anio}-${mes.padStart(2, '0')}-${ultimoDia}`;
        }
        
        // Construir la consulta SQL para personal con bajas en el periodo
        let queryBajas = `
            SELECT
                personal.IdPersonal, 
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto, 
                personal.IdSucuDepa, 
                personal.FechaPlanilla, 
                departamentos.NombreDepartamento, 
                planillas.IdPlanilla, 
                planillas.Nombre_Planilla, 
                planillas.EsCapital, 
                planillas.NoCentroTrabajo,
                planillas.Division,
                divisiones.Nombre AS NombreDivision,
                personal.SalarioDiario, 
                personal.SalarioQuincena, 
                personal.SalarioQuincenaFinMes,
                personal.Bonificacion,
                personal.SalarioBase,
                personal.NoCuenta,
                dr.FechaFinColaborador,
                CASE 
                    WHEN dr.IdEstadoPersonal = 2 THEN 'Despedido'
                    WHEN dr.IdEstadoPersonal = 3 THEN 'Renuncia'
                    ELSE 'Otro'
                END AS TipoBaja
            FROM
                personal
                INNER JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
                INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                INNER JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                LEFT JOIN divisiones ON planillas.Division = divisiones.IdDivision
                INNER JOIN DespidosRenuncias dr ON personal.IdPersonal = dr.IdPersonal
            WHERE
                personal.TipoPersonal = 1 AND
                dr.IdEstadoPersonal IN (2, 3) AND
                dr.FechaFinColaborador >= ? AND
                dr.FechaFinColaborador <= ?`;
        
        // Agregar filtros
        const params = [];
        const paramsBajas = [inicioQuincena, finQuincena];
        
        // Filtro de planilla (si no es "todos")
        if (planillaId !== 'todos') {
            queryActivos += ' AND planillas.IdPlanilla = ?';
            queryBajas += ' AND planillas.IdPlanilla = ?';
            params.push(planillaId);
            paramsBajas.push(planillaId);
        }
        
        // Ordenar los resultados
        queryActivos += ' ORDER BY planillas.Nombre_Planilla ASC, NombreCompleto ASC';
        queryBajas += ' ORDER BY planillas.Nombre_Planilla ASC, NombreCompleto ASC';
        
        // Ejecutar las consultas
        const connection = await connectionString();
        const resultsActivos = await connection.query(queryActivos, params);
        const resultsBajas = await connection.query(queryBajas, paramsBajas);
        await connection.close();
        
        // Combinar resultados
        const results = [...resultsActivos, ...resultsBajas];
        
        console.log(`Resultados obtenidos: ${resultsActivos.length} activos, ${resultsBajas.length} bajas`);
        
        // Procesar cada empleado para agregar los días laborados y descuentos judiciales
        const mesStr = mes.toString().padStart(2, '0');
        const resultadosCompletos = [];
        
        // Días totales en una quincena
        const diasTotalesQuincena = 15;
        
        for (const empleado of results) {
            // Calcular días laborados para empleados con baja
            let diasLaborados = diasTotalesQuincena;
            
            if (empleado.FechaFinColaborador) {
                // El empleado tiene baja, calcular días trabajados hasta su fecha de fin
                const fechaFinColaborador = new Date(empleado.FechaFinColaborador);
                const fechaInicioQuincena = new Date(inicioQuincena);
                const fechaFinQuincena = new Date(finQuincena);
                
                if (fechaFinColaborador >= fechaInicioQuincena && fechaFinColaborador <= fechaFinQuincena) {
                    // Calcular días trabajados desde el inicio de la quincena hasta la fecha de baja
                    const diasTrabajados = Math.floor((fechaFinColaborador - fechaInicioQuincena) / (1000 * 60 * 60 * 24)) + 1;
                    diasLaborados = Math.min(diasTrabajados, diasTotalesQuincena);
                }
            }
            
            // Obtener días suspendidos para este empleado en la quincena actual
            const diasSuspendidos = await obtenerDiasSuspendidos(
                empleado.IdPersonal, 
                mesStr, 
                anio, 
                tipoQuincena
            );
            
            // Ajustar días laborados restando suspensiones
            diasLaborados = Math.max(0, diasLaborados - diasSuspendidos);
            
            // Obtener descuentos judiciales para este empleado
            const descuentosJudiciales = await obtenerDescuentosJudiciales(empleado.IdPersonal);
            
            // Determinar el salario base quincenal según el tipo de quincena
            const campoSalario = tipoQuincena === 'normal' ? 'SalarioQuincena' : 'SalarioQuincenaFinMes';
            const salarioBaseQuincenal = empleado[campoSalario];
            
            // Calcular salario proporcional según los días laborados
            const salarioProporcional = (salarioBaseQuincenal / diasTotalesQuincena) * diasLaborados;
            
            // Determinar el monto de descuento judicial según el tipo de quincena
            const campoDescuento = tipoQuincena === 'normal' ? 'DescuentoQuincenal' : 'DescuentoQuincenalFinMes';
            let montoDescuentoJudicial = descuentosJudiciales[campoDescuento];

            // Verificar si el saldo pendiente es menor que el descuento establecido
            if (descuentosJudiciales.SaldoPendiente > 0 && descuentosJudiciales.SaldoPendiente < montoDescuentoJudicial) {
                // Si el saldo pendiente es menor, solo descontar ese monto
                montoDescuentoJudicial = descuentosJudiciales.SaldoPendiente;
            }
            
            // Si el empleado trabajó menos días, ajustar el descuento judicial proporcionalmente
            if (diasLaborados < diasTotalesQuincena && montoDescuentoJudicial > 0) {
                montoDescuentoJudicial = (montoDescuentoJudicial / diasTotalesQuincena) * diasLaborados;
            }

            // Calcular el salario final a pagar (salario proporcional - descuento judicial)
            const salarioFinalAPagar = Math.max(0, salarioProporcional - montoDescuentoJudicial);
            
            // Agregar los nuevos campos al objeto del empleado
            empleado.DiasLaborados = diasLaborados;
            empleado.DiasSuspendidos = diasSuspendidos;
            empleado.SalarioProporcional = salarioProporcional;
            empleado.DescuentoJudicial = montoDescuentoJudicial;
            empleado.NoDocumentoJudicial = descuentosJudiciales.NoDocumento;
            empleado.SalarioFinalAPagar = salarioFinalAPagar;
            empleado.FechaFinColaboradorFormateada = empleado.FechaFinColaborador ? 
                new Date(empleado.FechaFinColaborador).toLocaleDateString('es-GT') : null;
            
            resultadosCompletos.push(empleado);
        }
        
        return resultadosCompletos;
    } catch (error) {
        console.error('Error al obtener datos de nómina:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los datos de nómina. Por favor intente nuevamente.'
        });
        return [];
    } finally {
        // Ocultar loader
        document.getElementById('loader').style.display = 'none';
    }
}
// Función actualizada para renderizar la tabla con indicadores de bajas
function renderizarTabla(datos) {
    const tbody = document.getElementById('nominaTableBody');
    const tipoQuincena = document.getElementById('tipoQuincenaFilter').value;
    
    // Limpiar tabla
    tbody.innerHTML = '';
    
    // Verificar si hay datos
    if (datos.length === 0) {
        document.getElementById('noData').style.display = 'block';
        actualizarPaginacion(0);
        return;
    }
    
    document.getElementById('noData').style.display = 'none';
    
    // Calcular indices para paginación
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, datos.length);
    
    // Variable para determinar qué salario mostrar según el tipo de quincena
    const campoSalario = tipoQuincena === 'normal' ? 'SalarioQuincena' : 'SalarioQuincenaFinMes';
    
    // Crear filas para la página actual
    for (let i = startIndex; i < endIndex; i++) {
        const empleado = datos[i];
        
        // Formatear valores para la visualización
        const salarioDiario = formatearMoneda(empleado.SalarioDiario);
        const salarioQuincenal = formatearMoneda(empleado[campoSalario]);
        const salarioProporcional = formatearMoneda(empleado.SalarioProporcional);
        const descuentoJudicial = formatearMoneda(empleado.DescuentoJudicial);
        const salarioFinalAPagar = formatearMoneda(empleado.SalarioFinalAPagar);
        
        // Determinar la clase para los días laborados
        let claseDiasLaborados = 'diasLaborados';
        let tooltipSuspension = '';
        
        // Días completos de una quincena
        const diasQuincenaCompleta = 15;
        
        if (empleado.DiasLaborados < diasQuincenaCompleta) {
            // Si hay días suspendidos, agregar clase y tooltip
            if (empleado.DiasLaborados === 0) {
                claseDiasLaborados += ' peligro';
            } else {
                claseDiasLaborados += ' alerta';
            }
            
            claseDiasLaborados += ' reducido';
            
            // Agregar información específica al tooltip
            if (empleado.TipoBaja) {
                tooltipSuspension = `data-tooltip="${empleado.TipoBaja} el ${empleado.FechaFinColaboradorFormateada}. Días trabajados: ${empleado.DiasLaborados}"`;
            } else if (empleado.DiasSuspendidos > 0) {
                tooltipSuspension = `data-tooltip="El colaborador tiene ${empleado.DiasSuspendidos} día(s) suspendido(s)"`;
            }
        }
        
        // Determinar si el salario es reducido
        const claseSalario = empleado.DiasLaborados < diasQuincenaCompleta ? 'currency salario-reducido' : 'currency';
        
        // Preparar el tooltip para descuentos judiciales
        let claseDescuentoJudicial = 'currency';
        let tooltipDescuento = '';
        
        if (empleado.DescuentoJudicial > 0) {
            claseDescuentoJudicial += ' descuento-judicial';
            tooltipDescuento = `data-tooltip="Embargo No. ${empleado.NoDocumentoJudicial}"`;
        }
        
        // Clase adicional para filas de bajas
        let clasesFila = '';
        if (empleado.TipoBaja) {
            clasesFila = 'empleado-baja';
        }
        
        // Agregar indicador de tipo de baja en el nombre
        let nombreCompleto = empleado.NombreCompleto;
        if (empleado.TipoBaja) {
            nombreCompleto += ` <span class="indicador-baja">[${empleado.TipoBaja}]</span>`;
        }
        
        // Crear la fila
        const row = document.createElement('tr');
        row.className = clasesFila;
        row.innerHTML = `
            <td>${empleado.IdPersonal}</td>
            <td class="highlight">${nombreCompleto}</td>
            <td>${empleado.NombreDepartamento}</td>
            <td>${empleado.Nombre_Planilla}</td>
            <td>
                <span class="status-badge ${empleado.EsCapital ? 'capital' : 'regional'}">
                    ${empleado.EsCapital ? 'Capital' : 'Regional'}
                </span>
            </td>
            <td class="currency">${salarioDiario}</td>
            <td class="currency">${salarioQuincenal}</td>
            <td class="${claseDiasLaborados}" ${tooltipSuspension}>${empleado.DiasLaborados} / ${diasQuincenaCompleta}</td>
            <td class="${claseSalario}">${salarioProporcional}</td>
            <td class="${claseDescuentoJudicial}" ${tooltipDescuento}>${descuentoJudicial}</td>
            <td class="currency salario-final">${salarioFinalAPagar}</td>
        `;
        
        tbody.appendChild(row);
    }
    
    // Actualizar información de paginación
    actualizarPaginacion(datos.length);
}

// Función para formatear moneda a quetzales (Q)
function formatearMoneda(valor) {
    if (valor === null || valor === undefined) return 'Q0.00';
    
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 2
    }).format(valor);
}

// Función para actualizar la información de paginación
function actualizarPaginacion(totalItems) {
    totalRows = totalItems;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    
    // Actualizar información de registros mostrados
    const startIndex = totalItems > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
    const endIndex = Math.min(startIndex + rowsPerPage - 1, totalItems);
    
    document.getElementById('paginationInfo').textContent = 
        `Mostrando ${startIndex}-${endIndex} de ${totalItems} registros`;
    
    // Generar botones de paginación
    const paginationButtons = document.getElementById('paginationButtons');
    paginationButtons.innerHTML = '';
    
    // Límite de botones a mostrar
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    // Ajustar si estamos cerca del final
    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    // Agregar botones numerados
    for (let i = startPage; i <= endPage; i++) {
        const button = document.createElement('button');
        button.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        button.textContent = i;
        button.dataset.page = i;
        button.addEventListener('click', () => {
            currentPage = parseInt(button.dataset.page);
            renderizarTabla(filteredData);
        });
        
        paginationButtons.appendChild(button);
    }
    
    // Habilitar/deshabilitar botones de anterior/siguiente
    const prevButton = document.querySelector('.pagination-btn[data-page="prev"]');
    const nextButton = document.querySelector('.pagination-btn[data-page="next"]');
    
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages || totalPages === 0;
    
    // Agregar eventos a botones anterior/siguiente
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderizarTabla(filteredData);
        }
    };
    
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderizarTabla(filteredData);
        }
    };
}

// Función principal para cargar datos de nómina
async function cargarDatosNomina() {
    try {
        // Mostrar mensaje de carga
        document.getElementById('loader').style.display = 'block';
        
        // Restablecer paginación
        currentPage = 1;
        
        // Obtener planillas ya guardadas según los filtros actuales
        const planillasGuardadas = await obtenerPlanillasGuardadas();
        console.log("Planillas ya guardadas:", planillasGuardadas);
        
        // Obtener el valor del filtro de planilla
        const planillaFilterValue = document.getElementById('planillaFilter').value;
        
        // Obtener datos según filtros
        let datosCompletos = await obtenerDatosNomina();
        
        console.log(`Datos obtenidos inicialmente: ${datosCompletos ? datosCompletos.length : 0} registros`);
        
        // Filtrar los datos para eliminar empleados de planillas ya guardadas
        if (datosCompletos && datosCompletos.length > 0) {
            datosCompletos.sort((a, b) => {
                // Primero ordenar por División
                if (a.NombreDivision !== b.NombreDivision) {
                    return (a.NombreDivision || '').localeCompare(b.NombreDivision || '');
                }
                
                // Si están en la misma División, ordenar por NoCentroTrabajo
                const centroTrabajoA = parseInt(a.NoCentroTrabajo || '0', 10);
                const centroTrabajoB = parseInt(b.NoCentroTrabajo || '0', 10);
                return centroTrabajoA - centroTrabajoB;
            });
            // Si se seleccionó una planilla específica
            if (planillaFilterValue !== 'todos') {
                // Verificar si esa planilla ya está guardada
                if (planillasGuardadas.includes(planillaFilterValue)) {
                    await Swal.fire({
                        icon: 'warning',
                        title: 'Planilla ya guardada',
                        text: 'La planilla seleccionada ya ha sido guardada para este período. No hay datos para mostrar.',
                        confirmButtonText: 'Entendido'
                    });
                    
                    // No mostrar datos, limpiar la tabla
                    filteredData = [];
                    renderizarTabla(filteredData);
                    document.getElementById('loader').style.display = 'none';
                    return;
                }
            } else {
                // Si se seleccionó "Todas las planillas", filtrar solo las que no están guardadas
                datosCompletos = datosCompletos.filter(empleado => 
                    !planillasGuardadas.includes(empleado.IdPlanilla.toString())
                );
                
                // Si después de filtrar no hay datos, mostrar mensaje
                if (datosCompletos.length === 0) {
                    await Swal.fire({
                        icon: 'info',
                        title: 'Sin datos disponibles',
                        text: 'Todas las planillas para este período ya han sido guardadas. No hay datos para mostrar.',
                        confirmButtonText: 'Entendido'
                    });
                }
            }
        }
        
        console.log(`Datos después de filtrar planillas guardadas: ${datosCompletos ? datosCompletos.length : 0} registros`);
        
        // Asignar los datos filtrados y renderizar la tabla
        filteredData = datosCompletos;
        renderizarTabla(filteredData);
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error al cargar datos',
            text: 'Ocurrió un problema al obtener los datos de nómina. Detalles en la consola.'
        });
    } finally {
        document.getElementById('loader').style.display = 'none';
    }
}

// Función auxiliar para parsear fecha del formato ISO sin problemas de zona horaria
function parsearFechaISO(fechaISO) {
    if (!fechaISO) return null;
    // Si la fecha ya es un objeto Date, devolverla
    if (fechaISO instanceof Date) return fechaISO;
    
    // Si es string en formato ISO (YYYY-MM-DD)
    if (typeof fechaISO === 'string') {
        const partes = fechaISO.split('-');
        // Crear fecha usando los componentes locales para evitar problemas de zona horaria
        return new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    }
    return null;
}

// Función para formatear fecha sin problemas de zona horaria
function formatearFecha(fecha) {
    if (!fecha) return '';
    const d = fecha instanceof Date ? fecha : parsearFechaISO(fecha);
    if (!d) return '';
    
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    const anio = d.getFullYear();
    
    return `${dia}/${mes}/${anio}`;
}

// Función de exportar a Excel con altas y bajas
// Función actualizada de exportar a Excel con etiquetas de suspensiones
async function exportarExcel() {
    try {
        if (filteredData.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Sin datos',
                text: 'No hay datos para exportar.'
            });
            return;
        }
        
        // Mostrar mensaje de carga
        Swal.fire({
            title: 'Generando Excel',
            html: 'Por favor espere mientras se genera el archivo...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Obtener valores de filtros
        const tipoQuincena = document.getElementById('tipoQuincenaFilter').value === 'normal' 
            ? 'Planilla_Quincela' 
            : 'Planilla_Fin_Mes';
        
        const mes = parseInt(document.getElementById('mesFilter').value);
        const mesNombre = document.getElementById('mesFilter').options[document.getElementById('mesFilter').selectedIndex].text;
        const anio = parseInt(document.getElementById('anioFilter').value);
        
        // Crear un nuevo libro de Excel
        const wb = XLSX.utils.book_new();
        
        // Determinar fechas de inicio y fin de la quincena
        let fechaInicio, fechaFin;
        
        if (document.getElementById('tipoQuincenaFilter').value === 'normal') {
            // Primera quincena: del 1 al 15
            fechaInicio = new Date(anio, mes - 1, 1);
            fechaFin = new Date(anio, mes - 1, 15);
        } else {
            // Segunda quincena: del 16 al último día del mes
            fechaInicio = new Date(anio, mes - 1, 16);
            const ultimoDiaMes = new Date(anio, mes, 0).getDate();
            fechaFin = new Date(anio, mes - 1, ultimoDiaMes);
        }
        
        // Filtrar colaboradores que son altas
        const colaboradoresAltas = filteredData.filter(row => {
            if (row.FechaPlanilla) {
                const fechaPlanilla = parsearFechaISO(row.FechaPlanilla);
                return fechaPlanilla >= fechaInicio && fechaPlanilla <= fechaFin;
            }
            return false;
        });
        
        // Obtener bajas del periodo
        const colaboradoresBajas = await obtenerBajasColaboradores(
            mes.toString(),
            anio.toString(),
            document.getElementById('tipoQuincenaFilter').value
        );
        
        console.log(`Altas: ${colaboradoresAltas.length}, Bajas: ${colaboradoresBajas.length}`);
        
        const tipoQuincenaField = document.getElementById('tipoQuincenaFilter').value;
        const campoSalario = tipoQuincenaField === 'normal' ? 'SalarioQuincena' : 'SalarioQuincenaFinMes';
        
        // Obtener información de suspensiones para cada empleado
        const datosConSuspensiones = [];
        
        for (const empleado of filteredData) {
            // Obtener detalles de las suspensiones del empleado
            const suspensiones = await obtenerDetallesSuspensiones(
                empleado.IdPersonal, 
                mes, 
                anio, 
                tipoQuincenaField
            );
            
            // Crear etiqueta de suspensiones si las hay
            let etiquetaSuspension = '';
            if (suspensiones.length > 0) {
                etiquetaSuspension = 'Suspensión:\n';
                suspensiones.forEach(susp => {
                    etiquetaSuspension += `Suspendido del\n${formatearFecha(susp.FechaInicio)} al\n${formatearFecha(susp.FechaFin)}.\n`;
                });
            }
            
            // Crear etiqueta de baja si aplica
            let etiquetaBaja = '';
            if (empleado.TipoBaja) {
                etiquetaBaja = `${empleado.TipoBaja}:\n${formatearFecha(empleado.FechaFinColaborador)}`;
            }
            
            datosConSuspensiones.push({
                ...empleado,
                etiquetaSuspension,
                etiquetaBaja
            });
        }
        
        // Ordenar datos
        const datosOrdenados = [...datosConSuspensiones].sort((a, b) => {
            // Primero ordenar por División
            if (a.NombreDivision !== b.NombreDivision) {
                return (a.NombreDivision || '').localeCompare(b.NombreDivision || '');
            }
            
            // Si están en la misma División, ordenar por NoCentroTrabajo
            const centroTrabajoA = parseInt(a.NoCentroTrabajo || '0', 10);
            const centroTrabajoB = parseInt(b.NoCentroTrabajo || '0', 10);
            return centroTrabajoA - centroTrabajoB;
        });
        
        // Preparar datos generales para la primera hoja con etiquetas
        const excelData = datosOrdenados.map(row => ({
            'ID': row.IdPersonal,
            'Nombre Completo': row.NombreCompleto,
            'Departamento': row.NombreDepartamento,
            'Planilla': `${row.NombreDivision || ''} - ${row.Nombre_Planilla}`,
            'Centro Trabajo': row.NoCentroTrabajo || '',
            'Tipo': row.EsCapital ? 'Capital' : 'Regional',
            'Salario Diario': row.SalarioDiario,
            'Salario Quincenal': row[campoSalario],
            'Días Laborados': row.DiasLaborados,
            'Días Suspendidos': row.DiasSuspendidos,
            'Salario Proporcional': row.SalarioProporcional,
            'Descuento Judicial': row.DescuentoJudicial,
            'No. Documento': row.NoDocumentoJudicial,
            'No. Cuenta': row.NoCuenta || '',
            'Salario a Pagar': row.SalarioFinalAPagar,
            'Fecha Planilla': formatearFecha(row.FechaPlanilla),
            'Observaciones': (row.etiquetaSuspension || '') + (row.etiquetaBaja || '')
        }));
        
        // Preparar datos de altas para la segunda hoja
        const altasData = colaboradoresAltas.map(row => ({
            'ID': row.IdPersonal,
            'Nombre Completo': row.NombreCompleto,
            'Departamento': row.NombreDepartamento,
            'Planilla': `${row.NombreDivision || ''} - ${row.Nombre_Planilla}`,
            'Fecha de Alta': formatearFecha(row.FechaPlanilla),
            'Salario Base': row.SalarioBase || 0,
            'Salario Quincenal': row[campoSalario],
            'Tipo': row.EsCapital ? 'Capital' : 'Regional',
            'No. Cuenta': row.NoCuenta || ''
        }));
        
        // Preparar datos de bajas para la tercera hoja
        const bajasData = colaboradoresBajas.map(row => ({
            'ID': row.IdPersonal,
            'Nombre Completo': row.NombreCompleto,
            'Departamento': row.NombreDepartamento,
            'Planilla': row.Nombre_Planilla || '',
            'Tipo de Baja': row.TipoBaja,
            'Fecha Fin': formatearFecha(row.FechaFinColaborador),
            'Salario Base': row.SalarioBase || 0,
            'Tipo': row.EsCapital ? 'Capital' : 'Regional',
            'No. Cuenta': row.NoCuenta || ''
        }));
        
        // Crear hojas de cálculo
        const wsGeneral = XLSX.utils.json_to_sheet(excelData);
        const wsAltas = XLSX.utils.json_to_sheet(altasData.length > 0 ? altasData : [{ 'Sin altas en el periodo': '' }]);
        const wsBajas = XLSX.utils.json_to_sheet(bajasData.length > 0 ? bajasData : [{ 'Sin bajas en el periodo': '' }]);
        
        // Aplicar estilo de altura de fila para las celdas con etiquetas
        const range = XLSX.utils.decode_range(wsGeneral['!ref']);
        wsGeneral['!rows'] = [];
        
        for (let rowNum = 1; rowNum <= range.e.r; rowNum++) {
            const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: 16 }); // Columna 'Observaciones'
            if (wsGeneral[cellAddress] && wsGeneral[cellAddress].v && wsGeneral[cellAddress].v.length > 0) {
                // Contar líneas en el texto
                const lineCount = (wsGeneral[cellAddress].v.match(/\n/g) || []).length + 1;
                wsGeneral['!rows'][rowNum] = { hpt: lineCount * 15 }; // 15 puntos por línea
            }
        }
        
        // Establecer ancho de columnas
        const colWidths = [
            { wch: 8 },   // ID
            { wch: 30 },  // Nombre Completo
            { wch: 20 },  // Departamento
            { wch: 25 },  // Planilla
            { wch: 12 },  // Centro Trabajo
            { wch: 10 },  // Tipo
            { wch: 12 },  // Salario Diario
            { wch: 14 },  // Salario Quincenal
            { wch: 12 },  // Días Laborados
            { wch: 14 },  // Días Suspendidos
            { wch: 16 },  // Salario Proporcional
            { wch: 16 },  // Descuento Judicial
            { wch: 15 },  // No. Documento
            { wch: 15 },  // No. Cuenta
            { wch: 14 },  // Salario a Pagar
            { wch: 14 },  // Fecha Planilla
            { wch: 30 }   // Observaciones
        ];
        wsGeneral['!cols'] = colWidths;
        
        // Agregar las hojas al libro
        XLSX.utils.book_append_sheet(wb, wsGeneral, 'Nómina General');
        XLSX.utils.book_append_sheet(wb, wsAltas, 'Altas del Periodo');
        XLSX.utils.book_append_sheet(wb, wsBajas, 'Bajas del Periodo');
        
        // Crear hoja de resumen
        const resumenData = [{
            'Concepto': 'Total de Colaboradores',
            'Cantidad': filteredData.length
        }, {
            'Concepto': 'Altas en el Periodo',
            'Cantidad': colaboradoresAltas.length
        }, {
            'Concepto': 'Bajas en el Periodo',
            'Cantidad': colaboradoresBajas.length
        }, {
            'Concepto': 'Despidos',
            'Cantidad': colaboradoresBajas.filter(b => b.IdEstadoPersonal === 2).length
        }, {
            'Concepto': 'Renuncias',
            'Cantidad': colaboradoresBajas.filter(b => b.IdEstadoPersonal === 3).length
        }, {
            'Concepto': 'Periodo',
            'Cantidad': document.getElementById('tipoQuincenaFilter').value === 'normal' 
                ? `1 al 15 de ${mesNombre} ${anio}` 
                : `16 al ${fechaFin.getDate()} de ${mesNombre} ${anio}`
        }];
        
        const wsResumen = XLSX.utils.json_to_sheet(resumenData);
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
        
        // Generar buffer
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        
        // Crear nombre de archivo
        const fileName = `Nomina_${tipoQuincena}_${mesNombre}_${anio}_con_altas_bajas.xlsx`;
        
        try {
            // Guardar archivo en disco
            const desktopPath = path.join(require('os').homedir(), 'Desktop');
            const filePath = path.join(desktopPath, fileName);
            
            await writeFile(filePath, excelBuffer);
            
            Swal.fire({
                icon: 'success',
                title: 'Excel Generado',
                text: `El archivo ha sido guardado en tu escritorio como ${fileName}`,
                html: `<p>El archivo contiene:</p>
                       <ul style="text-align: left;">
                         <li>Hoja de Nómina General con observaciones</li>
                         <li>Hoja de Altas del Periodo (${colaboradoresAltas.length} altas)</li>
                         <li>Hoja de Bajas del Periodo (${colaboradoresBajas.length} bajas)</li>
                         <li>Hoja de Resumen con estadísticas</li>
                       </ul>`
            });
        } catch (saveError) {
            console.error('Error al guardar el archivo:', saveError);
            
            // Si falla, ofrecer descarga directa
            Swal.fire({
                icon: 'warning',
                title: 'No se pudo guardar automáticamente',
                text: 'Se iniciará la descarga del archivo.'
            });
            
            // Código para descargar
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
        }
        
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al generar el archivo Excel.'
        });
    }
}

// Nueva función para obtener detalles de suspensiones
async function obtenerDetallesSuspensiones(idPersonal, mes, anio, tipoQuincena) {
    try {
        const connection = await connectionString();
        
        // Determinar fechas de inicio y fin de la quincena
        let inicioQuincena, finQuincena;
        
        if (tipoQuincena === 'normal') {
            // Primera quincena: del 1 al 15
            inicioQuincena = `${anio}-${mes.toString().padStart(2, '0')}-01`;
            finQuincena = `${anio}-${mes.toString().padStart(2, '0')}-15`;
        } else {
            // Segunda quincena: del 16 al último día del mes
            inicioQuincena = `${anio}-${mes.toString().padStart(2, '0')}-16`;
            
            // Obtener el último día del mes
            const ultimoDia = new Date(anio, parseInt(mes), 0).getDate();
            finQuincena = `${anio}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;
        }
        
        // Consulta para obtener las suspensiones del empleado en el periodo
        const query = `
            SELECT 
                FechaInicio,
                FechaFin
            FROM 
                Suspensiones
            WHERE 
                IdPersonal = ? 
                AND FechaInicio <= ? 
                AND FechaFin >= ?
            ORDER BY
                FechaInicio
        `;
        
        const params = [
            idPersonal,
            finQuincena,      // FechaInicio <= finQuincena
            inicioQuincena    // FechaFin >= inicioQuincena
        ];
        
        const results = await connection.query(query, params);
        await connection.close();
        
        return results;
    } catch (error) {
        console.error('Error al obtener detalles de suspensiones:', error);
        return [];
    }
}
async function obtenerBajasColaboradores(mes, anio, tipoQuincena) {
    try {
        const connection = await connectionString();
        
        // Determinar fechas de inicio y fin de la quincena
        let inicioQuincena, finQuincena;
        
        if (tipoQuincena === 'normal') {
            // Primera quincena: del 1 al 15
            inicioQuincena = `${anio}-${mes.toString().padStart(2, '0')}-01`;
            finQuincena = `${anio}-${mes.toString().padStart(2, '0')}-15`;
        } else {
            // Segunda quincena: del 16 al último día del mes
            inicioQuincena = `${anio}-${mes.toString().padStart(2, '0')}-16`;
            
            // Obtener el último día del mes
            const ultimoDia = new Date(anio, parseInt(mes), 0).getDate();
            finQuincena = `${anio}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;
        }
        
        // Consulta para obtener las bajas del periodo
        const query = `
            SELECT 
                dr.IdPersonal,
                dr.IdEstadoPersonal,
                dr.FechaFinColaborador,
                CONCAT(p.PrimerNombre, ' ', IFNULL(p.SegundoNombre, ''), ' ', IFNULL(p.TercerNombre, ''), ' ', p.PrimerApellido, ' ', IFNULL(p.SegundoApellido, '')) AS NombreCompleto,
                p.IdPlanilla,
                p.IdSucuDepa,
                p.SalarioBase,
                p.NoCuenta,
                d.NombreDepartamento,
                pl.Nombre_Planilla,
                pl.EsCapital,
                CASE 
                    WHEN dr.IdEstadoPersonal = 2 THEN 'Despedido'
                    WHEN dr.IdEstadoPersonal = 3 THEN 'Renuncia'
                    ELSE 'Otro'
                END AS TipoBaja
            FROM 
                DespidosRenuncias dr
                INNER JOIN personal p ON dr.IdPersonal = p.IdPersonal
                LEFT JOIN departamentos d ON p.IdSucuDepa = d.IdDepartamento
                LEFT JOIN planillas pl ON p.IdPlanilla = pl.IdPlanilla
            WHERE 
                dr.IdEstadoPersonal IN (2, 3)
                AND dr.FechaFinColaborador >= ?
                AND dr.FechaFinColaborador <= ?
            ORDER BY 
                dr.FechaFinColaborador, NombreCompleto
        `;
        
        const params = [inicioQuincena, finQuincena];
        const results = await connection.query(query, params);
        
        await connection.close();
        return results;
        
    } catch (error) {
        console.error('Error al obtener bajas de colaboradores:', error);
        return [];
    }
}
// Eventos al cargar la página
document.addEventListener('DOMContentLoaded', async function() {
    // Obtener el usuario actual del localStorage
    const userData = JSON.parse(localStorage.getItem('userData')) || {};
    
    // Configurar datos del usuario en la interfaz
    if (userData) {
        document.getElementById('userName').textContent = userData.NombreCompleto || 'Usuario';
        document.getElementById('userRole').textContent = determinarRol(userData.Id_Puesto) || 'Colaborador';
        
        // Configurar imagen de usuario si existe
        if (userData.FotoBase64) {
            document.getElementById('userImage').src = userData.FotoBase64;
        }
    }
    
    // Llenar años en el filtro (desde 2020 hasta año actual + 1)
    const anioFilter = document.getElementById('anioFilter');
    const currentYear = new Date().getFullYear();
    for (let year = 2020; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        anioFilter.appendChild(option);
    }
    
    // Establecer mes actual seleccionado por defecto
    const currentMonth = new Date().getMonth() + 1; // getMonth() es 0-indexed
    document.getElementById('mesFilter').value = currentMonth;
    
    // Cargar planillas desde la base de datos
    await cargarPlanillas();
    
    // Configurar evento para aplicar filtros
    document.getElementById('applyFilters').addEventListener('click', cargarDatosNomina);
    
    // Configurar evento para exportar a Excel
    document.getElementById('exportBtn').addEventListener('click', exportarExcel);
    document.getElementById('pdfBtn').addEventListener('click', generarPDF);
    // Configurar switch de tema
    document.getElementById('themeSwitch').addEventListener('change', function(e) {
        if (e.target.checked) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    });
    document.getElementById('saveBtn').addEventListener('click', async function() {
        try {
            // Verificar que haya datos para guardar
            if (!filteredData || filteredData.length === 0) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Sin datos',
                    text: 'No hay datos para guardar. Aplique los filtros para visualizar la información.'
                });
                return;
            }
            
            // Obtener información de las planillas a guardar para mostrar en el mensaje
            const planillas = {};
            filteredData.forEach(empleado => {
                if (!planillas[empleado.IdPlanilla]) {
                    planillas[empleado.IdPlanilla] = {
                        nombre: empleado.Nombre_Planilla,
                        empleados: 0
                    };
                }
                planillas[empleado.IdPlanilla].empleados++;
            });
            
            // Construir mensaje de confirmación
            let mensaje = 'Está a punto de guardar la información:<br>';
            mensaje += '¿Está seguro de continuar?';
            
            // Mostrar confirmación al usuario
            const confirmacion = await Swal.fire({
                icon: 'question',
                title: 'Confirmar guardado',
                html: mensaje,
                showCancelButton: true,
                confirmButtonText: 'Sí, guardar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#4CAF50',
                cancelButtonColor: '#FF5252'
            });
            
            // Si el usuario confirma, proceder con el guardado
            if (confirmacion.isConfirmed) {
                // Verificar si ya existe una planilla guardada con los mismos datos
                const existePlanilla = await verificarPlanillaExistente();
                
                if (existePlanilla) {
                    // Preguntar al usuario si desea sobrescribir la planilla existente
                    const confirmacionSobrescribir = await Swal.fire({
                        icon: 'warning',
                        title: 'Planilla existente',
                        text: 'Ya existe una planilla guardada con los mismos parámetros. ¿Desea sobrescribirla?',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, sobrescribir',
                        cancelButtonText: 'No, cancelar'
                    });
                    
                    if (!confirmacionSobrescribir.isConfirmed) {
                        return;
                    }
                    
                    // Si el usuario confirma, eliminar la planilla existente antes de guardar
                    await eliminarPlanillaExistente();
                }
                
                // Guardar la planilla
                await guardarPlanilla();
                
                // Después de guardar exitosamente, limpiar la pantalla
                limpiarPantalla();
            }
            
        } catch (error) {
            console.error('Error al procesar guardado de planilla:', error);
            
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Ocurrió un error al procesar la solicitud.'
            });
        }
    });
    // Cargar preferencia de tema guardada
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('themeSwitch').checked = true;
    }
});
function limpiarPantalla() {
    // Limpiar datos
    filteredData = [];
    
    // Restablecer paginación
    currentPage = 1;
    
    // Limpiar la tabla
    renderizarTabla(filteredData);
    
    // Restablecer filtros a valores predeterminados
    document.getElementById('planillaFilter').value = 'todos';
    
    // Actualizar la lista de planillas disponibles para reflejar el nuevo estado
    cargarPlanillas();
    
    // Mostrar mensaje de éxito con más detalles
    Swal.fire({
        icon: 'success',
        title: 'Planilla guardada',
        text: 'La información ha sido guardada exitosamente y la pantalla ha sido limpiada.',
        confirmButtonText: 'Continuar'
    });
}
// Función para eliminar una planilla existente
async function eliminarPlanillaExistente() {
    try {
        // Obtener valores de los filtros
        const planillaId = document.getElementById('planillaFilter').value;
        const tipoQuincena = document.getElementById('tipoQuincenaFilter').value;
        const idTipoPago = tipoQuincena === 'normal' ? 1 : 2;
        const mes = document.getElementById('mesFilter').value;
        const anio = document.getElementById('anioFilter').value;
        
        const connection = await connectionString();
        
        // Primero obtener los IDs de las planillas a eliminar
        const querySelect = `
            SELECT IdPagoPlanilla 
            FROM PagoPlanilla 
            WHERE IdPlanilla = ? 
            AND IdTipoPago = ? 
            AND Mes = ? 
            AND Anyo = ?
        `;
        
        const planillas = await connection.query(querySelect, [planillaId, idTipoPago, mes, anio]);
        
        // Para cada planilla, eliminar primero los detalles y luego la cabecera
        for (const planilla of planillas) {
            // Eliminar detalles
            await connection.query(
                'DELETE FROM PagoPlanillaDetalle WHERE IdPagoPlanilla = ?', 
                [planilla.IdPagoPlanilla]
            );
            
            // Eliminar cabecera
            await connection.query(
                'DELETE FROM PagoPlanilla WHERE IdPagoPlanilla = ?', 
                [planilla.IdPagoPlanilla]
            );
        }
        
        await connection.close();
        
    } catch (error) {
        console.error('Error al eliminar planilla existente:', error);
        throw error;
    }
}
// Función para guardar la planilla
async function guardarPlanilla() {
    try {
        // Mostrar modal de carga
        Swal.fire({
            title: 'Guardando planilla',
            html: 'Por favor espere mientras se guarda la información...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Verificar si hay datos para guardar
        if (!filteredData || filteredData.length === 0) {
            Swal.close();
            await Swal.fire({
                icon: 'warning',
                title: 'Sin datos',
                text: 'No hay datos para guardar. Aplique los filtros para visualizar la información.'
            });
            return;
        }

        // Obtener los valores de los filtros seleccionados
        const planillaId = document.getElementById('planillaFilter').value;
        const tipoQuincena = document.getElementById('tipoQuincenaFilter').value;
        const mes = document.getElementById('mesFilter').value;
        const anio = document.getElementById('anioFilter').value;
        
        // Obtener el usuario actual del localStorage
        const userData = JSON.parse(localStorage.getItem('userData')) || {};
        
        // Verificar si el usuario está autenticado
        if (!userData.IdPersonal) {
            Swal.close();
            await Swal.fire({
                icon: 'error',
                title: 'Error de autenticación',
                text: 'No se pudo obtener la información del usuario. Por favor inicie sesión nuevamente.'
            });
            return;
        }

        // Agrupar los datos por planilla para guardar cada planilla por separado
        const planillasPorId = {};
        
        for (const empleado of filteredData) {
            const idPlanilla = empleado.IdPlanilla;
            
            if (!planillasPorId[idPlanilla]) {
                planillasPorId[idPlanilla] = {
                    empleados: [],
                    nombrePlanilla: empleado.Nombre_Planilla,
                    totalPagado: 0
                };
            }
            
            planillasPorId[idPlanilla].empleados.push(empleado);
            planillasPorId[idPlanilla].totalPagado += empleado.SalarioFinalAPagar;
        }
        
        // Guardar cada planilla por separado
        for (const idPlanilla in planillasPorId) {
            const planillaActual = planillasPorId[idPlanilla];
            
            // 1. Insertar cabecera en PagoPlanilla
            const cabeceraPlanilla = {
                IdUsuario: userData.IdPersonal,
                NombreUsuario: userData.NombreCompleto,
                IdPlanilla: idPlanilla,
                NombrePlanilla: planillaActual.nombrePlanilla,
                CantColaboradores: planillaActual.empleados.length,
                MontoPagado: planillaActual.totalPagado,
                TipoPago: tipoQuincena === 'normal' ? 'Planilla Quincena' : 'Planilla Fin de Mes',
                IdTipoPago: tipoQuincena === 'normal' ? 1 : 2,
                Mes: mes,
                Anyo: anio
            };
            
            // Insertar la cabecera en la base de datos y obtener el ID generado
            const idPagoPlanilla = await insertarCabeceraPlanilla(cabeceraPlanilla);
            
            // 2. Insertar detalles en PagoPlanillaDetalle
            for (const empleado of planillaActual.empleados) {
                const campoSalario = tipoQuincena === 'normal' ? 'SalarioQuincena' : 'SalarioQuincenaFinMes';
                
                // Calcular el pago de IGSS (4.83% del salario base) solo para quincena fin de mes
                let pagoIGSS = 0;
                if (tipoQuincena === 'finMes' && empleado.SalarioBase) {
                    pagoIGSS = empleado.SalarioBase * 0.0483;
                }
                
                const detallePlanilla = {
                    IdPagoPlanilla: idPagoPlanilla,
                    IdPersonal: empleado.IdPersonal,
                    NombrePersonal: formatearNombreApellidoPrimero(empleado.NombreCompleto),
                    SalarioQuincenal: empleado[campoSalario],
                    SalarioDiario: empleado.SalarioDiario,
                    MontoPagado: empleado.SalarioFinalAPagar,
                    Bonificacion: empleado.Bonificacion || 0,
                    PagoIGSS: pagoIGSS,
                    DiasLaborados: empleado.DiasLaborados,
                    NoCuenta: empleado.NoCuenta || ''
                };
                
                await insertarDetallePlanilla(detallePlanilla);
                
                // Verificar si el empleado tiene descuento judicial
                if (empleado.DescuentoJudicial > 0) {
                    await registrarDescuentoJudicial(empleado.IdPersonal, empleado.DescuentoJudicial, idPagoPlanilla);
                }
            }
        }
        
        // Cerrar el mensaje de carga (no mostramos el mensaje de éxito aquí)
        Swal.close();
        
    } catch (error) {
        console.error('Error al guardar la planilla:', error);
        
        Swal.close();
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: 'Ocurrió un error al guardar la planilla. Por favor intente nuevamente.'
        });
    }
}
function obtenerUltimoDiaMes(mes, anio) {
    // El día 0 del mes siguiente es el último día del mes actual
    return new Date(anio, mes, 0).getDate();
}
// Función para insertar la cabecera de la planilla
async function insertarCabeceraPlanilla(cabecera) {
    try {
        const connection = await connectionString();
        
        // Consulta SQL para insertar la cabecera
        const query = `
            INSERT INTO PagoPlanilla (
                IdUsuario, 
                NombreUsuario, 
                IdPlanilla, 
                NombrePlanilla, 
                CantColaboradores, 
                MontoPagado, 
                TipoPago, 
                IdTipoPago, 
                Mes, 
                Anyo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            cabecera.IdUsuario,
            cabecera.NombreUsuario,
            cabecera.IdPlanilla,
            cabecera.NombrePlanilla,
            cabecera.CantColaboradores,
            cabecera.MontoPagado,
            cabecera.TipoPago,
            cabecera.IdTipoPago,
            cabecera.Mes,
            cabecera.Anyo
        ];
        
        // Ejecutar la consulta
        const result = await connection.query(query, params);
        
        // Obtener el ID generado
        const idQuery = "SELECT LAST_INSERT_ID() as Id";
        const idResult = await connection.query(idQuery);
        
        await connection.close();
        
        // Devolver el ID generado
        return idResult[0].Id;
        
    } catch (error) {
        console.error('Error al insertar cabecera de planilla:', error);
        throw error;
    }
}

// Función para insertar el detalle de la planilla
async function insertarDetallePlanilla(detalle) {
    try {
        const connection = await connectionString();
        
        // Determinar si se incluye el campo bonificación y pago IGSS según el tipo de quincena
        const tipoQuincena = document.getElementById('tipoQuincenaFilter').value;
        const incluirBonificacionIGSS = tipoQuincena === 'finMes';
        
        // Consulta SQL para insertar el detalle
        let query;
        let params;
        
        if (incluirBonificacionIGSS) {
            query = `
                INSERT INTO PagoPlanillaDetalle (
                    IdPagoPlanilla,
                    IdPersonal,
                    NombrePersonal,
                    SalarioQuincenal,
                    SalarioDiario,
                    MontoPagado,
                    Bonificacion,
                    PagoIGSS,
                    DiasLaborados,
                    NoCuenta
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            params = [
                detalle.IdPagoPlanilla,
                detalle.IdPersonal,
                detalle.NombrePersonal,
                detalle.SalarioQuincenal,
                detalle.SalarioDiario,
                detalle.MontoPagado,
                detalle.Bonificacion,
                detalle.PagoIGSS,
                detalle.DiasLaborados,
                detalle.NoCuenta
            ];
        } else {
            query = `
                INSERT INTO PagoPlanillaDetalle (
                    IdPagoPlanilla,
                    IdPersonal,
                    NombrePersonal,
                    SalarioQuincenal,
                    SalarioDiario,
                    MontoPagado,
                    DiasLaborados,
                    NoCuenta
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            params = [
                detalle.IdPagoPlanilla,
                detalle.IdPersonal,
                detalle.NombrePersonal,
                detalle.SalarioQuincenal,
                detalle.SalarioDiario,
                detalle.MontoPagado,
                detalle.DiasLaborados,
                detalle.NoCuenta
            ];
        }
        
        // Ejecutar la consulta
        await connection.query(query, params);
        
        await connection.close();
        
    } catch (error) {
        console.error('Error al insertar detalle de planilla:', error);
        throw error;
    }
}

// Verificar si ya existe una planilla guardada con los mismos datos
async function verificarPlanillaExistente() {
    try {
        // Obtener valores de los filtros
        const planillaId = document.getElementById('planillaFilter').value;
        const tipoQuincena = document.getElementById('tipoQuincenaFilter').value;
        const idTipoPago = tipoQuincena === 'normal' ? 1 : 2;
        const mes = document.getElementById('mesFilter').value;
        const anio = document.getElementById('anioFilter').value;
        
        // Si se seleccionó "todas las planillas", no podemos verificar una específica
        if (planillaId === 'todos') {
            return false;
        }
        
        const connection = await connectionString();
        
        // Consulta para verificar si ya existe una planilla con los mismos datos
        const query = `
            SELECT COUNT(*) as Total 
            FROM PagoPlanilla 
            WHERE IdPlanilla = ? 
            AND IdTipoPago = ? 
            AND Mes = ? 
            AND Anyo = ?
        `;
        
        const result = await connection.query(query, [planillaId, idTipoPago, mes, anio]);
        
        await connection.close();
        
        // Si hay resultados mayores a 0, significa que ya existe
        return result[0].Total > 0;
        
    } catch (error) {
        console.error('Error al verificar planilla existente:', error);
        return false;
    }
}
async function registrarDescuentoJudicial(idPersonal, montoDescuento, idPagoPlanilla) {
    try {
        const connection = await connectionString();
        
        // 1. Obtener el descuento judicial activo del empleado (Estado = 0)
        const queryDescuento = `
            SELECT 
                IdDescuentoJudicial,
                SaldoPendiente
            FROM 
                DescuentosJudiciales
            WHERE 
                IdPersonal = ? AND Estado = 0
        `;
        
        const descuentosJudiciales = await connection.query(queryDescuento, [idPersonal]);
        
        // Si no tiene descuentos judiciales activos, terminar
        if (descuentosJudiciales.length === 0) {
            await connection.close();
            return;
        }
        
        const descuentoJudicial = descuentosJudiciales[0];
        const idDescuentoJudicial = descuentoJudicial.IdDescuentoJudicial;
        const saldoAnterior = parseFloat(descuentoJudicial.SaldoPendiente);
        
        // Verificar si el saldo pendiente es menor que el descuento a aplicar
        let descuentoAplicado = montoDescuento;
        if (saldoAnterior < montoDescuento) {
            descuentoAplicado = saldoAnterior;
        }
        
        // Calcular el nuevo saldo
        const saldoActual = Math.max(0, saldoAnterior - descuentoAplicado);
        
        // 2. Insertar el registro de descuento judicial en la tabla DescjuntosJudicialesDetalle
        const queryInsert = `
            INSERT INTO DescuentosJudicialesDetalle (
                IdDescuentoJudicial,
                Descuento,
                SaldoAnterior,
                SaldoActual,
                IdPagoPlanilla
            ) VALUES (?, ?, ?, ?, ?)
        `;
        
        const paramsInsert = [
            idDescuentoJudicial,
            descuentoAplicado,
            saldoAnterior,
            saldoActual,
            idPagoPlanilla
        ];
        
        await connection.query(queryInsert, paramsInsert);
        
        // 3. Actualizar el saldo pendiente en la tabla DescuentosJudiciales
        const queryUpdate = `
            UPDATE DescuentosJudiciales
            SET SaldoPendiente = ?
            WHERE IdDescuentoJudicial = ?
        `;
        
        const paramsUpdate = [saldoActual, idDescuentoJudicial];
        
        await connection.query(queryUpdate, paramsUpdate);
        
        // 4. Si el saldo llega a 0, actualizar el estado del descuento judicial a completado (Estado = 1)
        if (saldoActual === 0) {
            const queryCompletado = `
                UPDATE DescuentosJudiciales
                SET Estado = 1
                WHERE IdDescuentoJudicial = ?
            `;
            
            await connection.query(queryCompletado, [idDescuentoJudicial]);
        }
        
        await connection.close();
        
    } catch (error) {
        console.error('Error al registrar descuento judicial:', error);
        throw error;
    }
}
// Función para obtener los datos de planillas guardadas para el reporte
async function obtenerDatosPlanillasParaReporte() {
    try {
        // Obtener valores de los filtros
        const tipoQuincena = document.getElementById('tipoQuincenaFilter').value;
        const idTipoPago = tipoQuincena === 'normal' ? 1 : 2;
        const mes = document.getElementById('mesFilter').value;
        const anio = document.getElementById('anioFilter').value;
        
        const connection = await connectionString();
        
        // 1. Obtener todas las planillas guardadas para el período
        // Modificamos la consulta para obtener directamente la información de Division
        const queryPlanillas = `
            SELECT 
                PP.IdPagoPlanilla,
                PP.IdPlanilla,
                PP.NombrePlanilla,
                PP.CantColaboradores,
                PP.MontoPagado,
                PP.TipoPago,
                PP.Mes,
                PP.Anyo,
                P.Division,
                D.Nombre AS NombreDivision,
                P.NoCentroTrabajo
            FROM 
                PagoPlanilla PP
                INNER JOIN planillas P ON PP.IdPlanilla = P.IdPlanilla
                LEFT JOIN divisiones D ON P.Division = D.IdDivision
            WHERE 
                PP.IdTipoPago = ? 
                AND PP.Mes = ? 
                AND PP.Anyo = ?
            ORDER BY 
                D.Nombre ASC,
                CAST(P.NoCentroTrabajo AS UNSIGNED) ASC
        `;
        
        const planillas = await connection.query(queryPlanillas, [idTipoPago, mes, anio]);
        
        // Si no hay planillas guardadas, retornar array vacío
        if (planillas.length === 0) {
            await connection.close();
            return [];
        }
        
        // 2. Para cada planilla, obtener logo de la división correspondiente
        const datosCompletos = [];
        
        for (const planilla of planillas) {
            // Verificar que tenemos un valor de Division antes de buscar el logo
            let logo = null;
            
            if (planilla.Division) {
                // Obtener el logo de la división usando la División específica de esta planilla
                const queryLogo = `
                    SELECT CASE 
                                WHEN divisiones.Logos IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(divisiones.Logos))
                                ELSE NULL 
                            END AS Logos
                    FROM divisiones
                    WHERE IdDivision = ?
                `;
                
                const resultadoLogo = await connection.query(queryLogo, [planilla.Division]);
                if (resultadoLogo.length > 0) {
                    logo = resultadoLogo[0].Logos;
                }
            }
            
            // 3. Obtener los detalles de cada empleado en la planilla, incluyendo el NoCuenta
            const queryDetalles = `
                SELECT 
                    PPD.IdPersonal,
                    PPD.NombrePersonal,
                    PPD.SalarioDiario,
                    PPD.SalarioQuincenal,
                    PPD.MontoPagado,
                    PPD.DiasLaborados,
                    PPD.Bonificacion,
                    PPD.PagoIGSS,
                    p.Sexo,
                    COALESCE(PPD.NoCuenta, p.NoCuenta) AS NoCuenta
                FROM 
                    PagoPlanillaDetalle PPD
                    LEFT JOIN personal p ON PPD.IdPersonal = p.IdPersonal
                WHERE 
                    PPD.IdPagoPlanilla = ?
                ORDER BY 
                    PPD.NombrePersonal
            `;
            
            const detalles = await connection.query(queryDetalles, [planilla.IdPagoPlanilla]);
            
            // Agregar planilla con sus detalles, logo y nombre de división al resultado
            datosCompletos.push({
                ...planilla,
                logo: logo,
                detalles: detalles
            });
        }
        
        await connection.close();
        return datosCompletos;
        
    } catch (error) {
        console.error('Error al obtener datos para reporte:', error);
        return [];
    }
}
function formatearNombreApellidoPrimero(nombreCompleto) {
    // Esto es solo un ejemplo, habría que adaptarlo según cómo estén estructurados tus datos
    const partes = nombreCompleto.split(' ');
    if (partes.length <= 2) return nombreCompleto; // No hay suficientes partes para reorganizar
    
    // Asumiendo formato: [PrimerNombre] [SegundoNombre] [PrimerApellido] [SegundoApellido]
    // Convertir a: [PrimerApellido] [SegundoApellido], [PrimerNombre] [SegundoNombre]
    const nombres = partes.slice(0, partes.length-2).join(' ');
    const apellidos = partes.slice(partes.length-2).join(' ');
    
    return `${apellidos}, ${nombres}`;
}
// Función para generar el PDF
async function generarPDF() {
    try {
        // Mostrar diálogo de selección de filtros
        const { value: formValues } = await Swal.fire({
            title: 'Generar reporte PDF',
            html: `
                <div style="text-align: left; margin-bottom: 20px;">
                    <p>Seleccione los parámetros para el reporte:</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 15px; text-align: left;">
                    <div>
                        <label for="pdfTipoQuincena" style="display: block; margin-bottom: 5px; font-weight: bold;">Tipo de Quincena:</label>
                        <select id="pdfTipoQuincena" class="swal2-input" style="width: 100%;">
                            <option value="normal">Planilla Quincenal</option>
                            <option value="finMes">Planilla Fin de Mes</option>
                        </select>
                    </div>
                    <div>
                        <label for="pdfMes" style="display: block; margin-bottom: 5px; font-weight: bold;">Mes:</label>
                        <select id="pdfMes" class="swal2-input" style="width: 100%;">
                            <option value="1">Enero</option>
                            <option value="2">Febrero</option>
                            <option value="3">Marzo</option>
                            <option value="4">Abril</option>
                            <option value="5">Mayo</option>
                            <option value="6">Junio</option>
                            <option value="7">Julio</option>
                            <option value="8">Agosto</option>
                            <option value="9">Septiembre</option>
                            <option value="10">Octubre</option>
                            <option value="11">Noviembre</option>
                            <option value="12">Diciembre</option>
                        </select>
                    </div>
                    <div>
                        <label for="pdfAnio" style="display: block; margin-bottom: 5px; font-weight: bold;">Año:</label>
                        <select id="pdfAnio" class="swal2-input" style="width: 100%;">
                            ${generarOpcionesAnio()}
                        </select>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Generar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                return {
                    tipoQuincena: document.getElementById('pdfTipoQuincena').value,
                    mes: document.getElementById('pdfMes').value,
                    anio: document.getElementById('pdfAnio').value
                };
            }
        });
        
        if (!formValues) {
            return; // Usuario canceló
        }
        
        // Guardar los valores seleccionados en los filtros de la pantalla principal
        document.getElementById('tipoQuincenaFilter').value = formValues.tipoQuincena;
        document.getElementById('mesFilter').value = formValues.mes;
        document.getElementById('anioFilter').value = formValues.anio;
        
        // Mostrar mensaje de carga
        Swal.fire({
            title: 'Generando PDF',
            html: 'Por favor espere mientras se genera el reporte...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Obtener datos para el reporte
        const datosPlanillas = await obtenerDatosPlanillasParaReporte();
        
        if (datosPlanillas.length === 0) {
            Swal.close();
            await Swal.fire({
                icon: 'warning',
                title: 'Sin datos',
                text: 'No hay planillas guardadas para los parámetros seleccionados.'
            });
            return;
        }
        
        // Crear instancia de jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        
        // Obtener dimensiones de la página
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // Obtener nombres de meses para el título
        const nombresMeses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        
        // Definir márgenes
        const marginLeft = 15;
        const marginRight = 15;
        const marginTop = 15;
        const marginBottom = 15;
        const contentWidth = pageWidth - marginLeft - marginRight;
        
        // Definir colores
        const headerColor = [44, 62, 80]; // Color azul oscuro para encabezados
        const rowAlternateColor = [240, 240, 240]; // Color para filas alternas
        const borderColor = [200, 200, 200]; // Color para bordes
        
        // Para cada planilla, crear una página en el PDF
        for (let i = 0; i < datosPlanillas.length; i++) {
            const planilla = datosPlanillas[i];
            
            // Contar colaboradores por género
            let masculinos = 0;
            let femeninos = 0;

            // Si hay detalles disponibles, contamos por género
            if (planilla.detalles && planilla.detalles.length > 0) {
                planilla.detalles.forEach(empleado => {
                    if (empleado.Sexo === 'M') {
                        masculinos++;
                    } else if (empleado.Sexo === 'F') {
                        femeninos++;
                    }
                });
            }
            
            // Si no es la primera página, agregar una nueva
            if (i > 0) {
                doc.addPage();
            }
            
            // Establecer color de texto por defecto
            doc.setTextColor(0, 0, 0);
            
            // ----- Sección de encabezado -----
            let yPos = marginTop;
            
            // Agregar logo si existe
            if (planilla.logo) {
                try {
                    // Añadir el logo con un tamaño adecuado
                    doc.addImage(planilla.logo, 'JPEG', marginLeft, yPos, 40, 20);
                } catch (imgError) {
                    console.error('Error al agregar logo:', imgError);
                }
            }
            
            // Nombre de la División (texto grande y prominente)
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text(planilla.NombreDivision || 'División no especificada', pageWidth / 2, yPos + 10, { align: 'center' });

            // Nombre de la Planilla (texto más pequeño debajo)
            doc.setFontSize(14);
            doc.setFont(undefined, 'normal');
            doc.text(planilla.NombrePlanilla, pageWidth / 2, yPos + 18, { align: 'center' });

            // Subtítulos centrados (tipo de quincena y periodo)
            doc.setFontSize(11);
            const mesNombre = nombresMeses[planilla.Mes - 1];
            doc.text(`Tipo de Pago: ${planilla.TipoPago}`, pageWidth / 2, yPos + 26, { align: 'center' });

            // Formato de período según tipo de quincena
            let textoPeríodo = '';
            // Verificamos por el texto del tipo de pago en lugar de IdTipoPago
            if (planilla.TipoPago.includes('Quincenal') || planilla.TipoPago.includes('Quincena')) {
                textoPeríodo = `Periodo: 1 al 15 de ${mesNombre} ${planilla.Anyo}`;
            } else {
                // Para quincena fin de mes
                const ultimoDia = obtenerUltimoDiaMes(planilla.Mes, planilla.Anyo);
                textoPeríodo = `Periodo: 16 al ${ultimoDia} de ${mesNombre} ${planilla.Anyo}`;
            }
            doc.text(textoPeríodo, pageWidth / 2, yPos + 33, { align: 'center' });
                        
            // Avanzar posición Y después del encabezado y logo
            yPos += 35;
            
            // ----- Información de resumen -----
            // Dibujar un recuadro para la información
            doc.setDrawColor(...borderColor);
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(marginLeft, yPos, contentWidth, 20, 2, 2, 'FD');
            
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(`ID de Planilla: ${planilla.IdPagoPlanilla}`, marginLeft + 5, yPos + 7);
            const centroTrabajo = planilla.NoCentroTrabajo || 'No especificado';
            doc.text(`Centro de trabajo: ${centroTrabajo}`, marginLeft + contentWidth - 80, yPos + 7);
            doc.text(`Colaboradores: ${planilla.CantColaboradores} (Masculino: ${masculinos}, Femenino: ${femeninos})`, marginLeft + 5, yPos + 14);
            
            // Avanzar posición Y después de la información de resumen
            yPos += 25;
            
            // ----- Tabla de datos -----
            // Determinar columnas según tipo de quincena
            const esQuincenaFinMes = planilla.TipoPago.includes('Fin de Mes');
            
            let headers = [];
            let colWidths = [];

            if (esQuincenaFinMes) {
                headers = ['ID', 'Nombre', 'No. Cuenta', 'Salario Diario', 'Días Lab.', 'Bonificación', 'IGSS', 'Monto Pagado'];
                colWidths = [15, contentWidth - 205, 40, 25, 25, 35, 25, 40]; // Total = contentWidth
            } else {
                headers = ['ID', 'Nombre', 'No. Cuenta', 'Salario Diario', 'Días Lab.', 'Monto Pagado'];
                colWidths = [15, contentWidth - 165, 40, 25, 25, 40]; // Total = contentWidth
            }
            
            // Dibujar encabezado de la tabla
            doc.setFillColor(...headerColor);
            doc.rect(marginLeft, yPos, contentWidth, 10, 'F');
            
            // Texto del encabezado
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            
            // Posiciones X para cada columna
            let xPositions = [marginLeft];
            for (let j = 0; j < colWidths.length - 1; j++) {
                xPositions.push(xPositions[j] + colWidths[j]);
            }
            
            // Dibujar textos de encabezado
            for (let j = 0; j < headers.length; j++) {
                const xPos = xPositions[j] + (j <= 1 ? 3 : colWidths[j] / 2); // Ajustar posición para alineación
                const align = j <= 1 ? 'left' : 'center';
                doc.text(headers[j], xPos, yPos + 6.5, { align });
            }
            
            // Avanzar a la primera fila de datos
            yPos += 10;
            
            // Restaurar color de texto para los datos
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
            
            // Dibujar filas de datos
            const rowHeight = 8;
            
            // Comprobar si hay datos
            if (planilla.detalles && planilla.detalles.length > 0) {
                for (let j = 0; j < planilla.detalles.length; j++) {
                    const empleado = planilla.detalles[j];
                    
                    // Alternar color de fondo para las filas
                    if (j % 2 === 1) {
                        doc.setFillColor(...rowAlternateColor);
                        doc.rect(marginLeft, yPos, contentWidth, rowHeight, 'F');
                    }
                    
                    // Dibujar líneas horizontales para cada fila
                    doc.setDrawColor(...borderColor);
                    doc.line(marginLeft, yPos, marginLeft + contentWidth, yPos);
                    
                    // Datos del empleado
                    doc.setFontSize(8);
                    
                    // ID (alineado a la izquierda)
                    doc.text(empleado.IdPersonal.toString(), xPositions[0] + 3, yPos + 5.5, { align: 'left' });
                    
                    // Nombre (alineado a la izquierda)
                    doc.text(empleado.NombrePersonal, xPositions[1] + 3, yPos + 5.5, { align: 'left' });
                    
                    // Número de Cuenta (alineado al centro)
                    doc.text(empleado.NoCuenta || 'No disponible', xPositions[2] + colWidths[2] / 2, yPos + 5.5, { align: 'center' });
                    
                    // Salario Diario (alineado al centro)
                    doc.text(`Q${formatearNumero(empleado.SalarioDiario)}`, xPositions[3] + colWidths[3] / 2, yPos + 5.5, { align: 'center' });
                    
                    // Días Laborados (alineado al centro)
                    doc.text(empleado.DiasLaborados.toString(), xPositions[4] + colWidths[4] / 2, yPos + 5.5, { align: 'center' });
                    
                    if (esQuincenaFinMes) {
                        // Bonificación (alineado al centro)
                        doc.text(`Q${formatearNumero(empleado.Bonificacion || 0)}`, xPositions[5] + colWidths[5] / 2, yPos + 5.5, { align: 'center' });
                        
                        // IGSS (alineado al centro)
                        doc.text(`Q${formatearNumero(empleado.PagoIGSS || 0)}`, xPositions[6] + colWidths[6] / 2, yPos + 5.5, { align: 'center' });
                        
                        // Monto Pagado (alineado al centro)
                        doc.text(`Q${formatearNumero(empleado.MontoPagado)}`, xPositions[7] + colWidths[7] / 2, yPos + 5.5, { align: 'center' });
                    } else {
                        // Monto Pagado (alineado al centro)
                        doc.text(`Q${formatearNumero(empleado.MontoPagado)}`, xPositions[5] + colWidths[5] / 2, yPos + 5.5, { align: 'center' });
                    }
                    
                    // Avanzar a la siguiente fila
                    yPos += rowHeight;
                    
                    // Verificar si se necesita una nueva página
                    if (yPos + rowHeight > pageHeight - marginBottom - 15) {
                        // Dibujar línea final de la tabla actual
                        doc.line(marginLeft, yPos, marginLeft + contentWidth, yPos);
                        
                        // Añadir pie de página
                        doc.setFontSize(8);
                        doc.text('Continúa en la siguiente página...', pageWidth / 2, pageHeight - marginBottom, { align: 'center' });
                        
                        // Nueva página
                        doc.addPage();
                        
                        // Reiniciar posición Y
                        yPos = marginTop + 10;
                        
                        // Añadir encabezado continuación
                        doc.setFontSize(12);
                        doc.setFont(undefined, 'bold');
                        doc.text(`${planilla.NombrePlanilla} (continuación)`, pageWidth / 2, marginTop, { align: 'center' });
                        
                        // Repetir encabezado de tabla
                        doc.setFillColor(...headerColor);
                        doc.rect(marginLeft, yPos, contentWidth, 10, 'F');
                        
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(9);
                        doc.setFont(undefined, 'bold');
                        
                        for (let k = 0; k < headers.length; k++) {
                            const xPos = xPositions[k] + (k <= 1 ? 3 : colWidths[k] / 2);
                            const align = k <= 1 ? 'left' : 'center';
                            doc.text(headers[k], xPos, yPos + 6.5, { align });
                        }
                        
                        yPos += 10;
                        doc.setTextColor(0, 0, 0);
                        doc.setFont(undefined, 'normal');
                    }
                }
            } else {
                // Si no hay detalles, mostrar mensaje
                doc.setFontSize(10);
                doc.text('No hay datos disponibles para esta planilla.', pageWidth / 2, yPos + 10, { align: 'center' });
                yPos += 20;
            }
            
            // Dibujar línea final de la tabla
            doc.setDrawColor(...borderColor);
            doc.line(marginLeft, yPos, marginLeft + contentWidth, yPos);
            
            // Líneas verticales para separar columnas
            for (let j = 0; j <= xPositions.length; j++) {
                const x = j < xPositions.length ? xPositions[j] : marginLeft + contentWidth;
                doc.line(x, yPos - (planilla.detalles.length * rowHeight), x, yPos);
            }
            
            // Añadir total
            yPos += 10;
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(`Total: Q${formatearNumero(planilla.MontoPagado)}`, marginLeft + contentWidth, yPos, { align: 'right' });
            
            // ----- Pie de página -----
            const currentDate = new Date();
            const fechaGeneracion = `Generado el: ${currentDate.toLocaleDateString()} a las ${currentDate.toLocaleTimeString()}`;
            
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(fechaGeneracion, pageWidth - marginRight, pageHeight - marginBottom, { align: 'right' });
            doc.text(`Página ${i + 1} de ${datosPlanillas.length}`, marginLeft, pageHeight - marginBottom, { align: 'left' });
        }
        
        // Finalizar generación y descargar PDF
        Swal.close();
        
        // Configurar nombre del archivo
        const nombreArchivo = `Reporte_Nomina_${formValues.tipoQuincena === 'normal' ? 'Quincenal' : 'FinMes'}_${nombresMeses[parseInt(formValues.mes) - 1]}_${formValues.anio}.pdf`;
        
        // Guardar el PDF
        doc.save(nombreArchivo);
        
        // Mostrar confirmación
        await Swal.fire({
            icon: 'success',
            title: 'PDF Generado',
            text: `El reporte ha sido generado exitosamente como "${nombreArchivo}".`
        });
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        
        Swal.close();
        
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al generar el PDF. Por favor intente nuevamente.'
        });
    }
}

// Función auxiliar para generar opciones de años
function generarOpcionesAnio() {
    const currentYear = new Date().getFullYear();
    let options = '';
    
    for (let year = 2020; year <= currentYear + 1; year++) {
        const selected = year === currentYear ? 'selected' : '';
        options += `<option value="${year}" ${selected}>${year}</option>`;
    }
    
    return options;
}

// Función para formatear números con separador de miles y dos decimales
function formatearNumero(valor) {
    if (valor === null || valor === undefined) return '0.00';
    
    return parseFloat(valor).toLocaleString('es-GT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
// Función para determinar el rol basado en el ID del puesto
function determinarRol(idPuesto) {
    if (idPuesto == 5) {
        return 'Administrador RRHH';
    } else if (idPuesto == 1) {
        return 'Gerente';
    } else {
        return 'Colaborador';
    }
}