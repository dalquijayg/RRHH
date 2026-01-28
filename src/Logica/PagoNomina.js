const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const { writeFile } = require('fs').promises;
const XLSX = require('xlsx');
const Swal = require('sweetalert2');

// Variables para la paginación
let currentPage = 1;
const rowsPerPage = 100;
let totalRows = 0;
let filteredData = [];

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
        
        // Consulta modificada para incluir la división
        const planillas = await connection.query(`
            SELECT 
                p.IdPlanilla, 
                CASE 
                    WHEN d.Nombre IS NOT NULL THEN CONCAT(d.Nombre, ' - ', p.Nombre_Planilla)
                    ELSE p.Nombre_Planilla
                END AS Nombre_Planilla_Completo,
                p.Nombre_Planilla,
                d.Nombre AS NombreDivision
            FROM planillas p
            LEFT JOIN divisiones d ON p.Division = d.IdDivision
            ORDER BY d.Nombre ASC, p.Nombre_Planilla ASC
        `);
        
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
            option.textContent = planilla.Nombre_Planilla_Completo;
            
            // Solo agregar las clases para el estilo, sin cambiar el texto
            if (yaGuardada) {
                option.classList.add('planilla-guardada');
                option.setAttribute('data-guardada', 'true');
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
            // Segunda quincena: del 16 al 30 (mes comercial)
            inicioQuincena = `${anio}-${mes.padStart(2, '0')}-16`;

            // Mes comercial: usar el mínimo entre 30 y el último día real (para febrero)
            const ultimoDiaReal = new Date(anio, parseInt(mes), 0).getDate();
            const diaFinComercial = Math.min(30, ultimoDiaReal);
            finQuincena = `${anio}-${mes.padStart(2, '0')}-${diaFinComercial}`;
        }
        
        // Consulta modificada para incluir tanto suspensiones como faltas
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
                AND (EsFalta = 0 OR EsFalta = 1)
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
                IdDescuentoJudicial: results[0].IdDescuentoJudicial,
                TieneDescuento: true
            };
        } else {
            // Si no hay descuentos judiciales
            return {
                DescuentoQuincenal: 0,
                DescuentoQuincenalFinMes: 0,
                NoDocumento: '',
                SaldoPendiente: 0,
                IdDescuentoJudicial: null,
                TieneDescuento: false
            };
        }
    } catch (error) {
        console.error('Error al obtener descuentos judiciales:', error);
        return {
            DescuentoQuincenal: 0,
            DescuentoQuincenalFinMes: 0,
            NoDocumento: '',
            SaldoPendiente: 0,
            IdDescuentoJudicial: null,
            TieneDescuento: false
        };
    }
}
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

        // Construir la consulta SQL para personal activo
        let queryActivos = `
            SELECT
                personal.IdPersonal,
                CONCAT(
                    personal.PrimerApellido,
                    CASE WHEN personal.SegundoApellido IS NOT NULL AND personal.SegundoApellido != ''
                         THEN CONCAT(' ', personal.SegundoApellido)
                         ELSE ''
                    END,
                    ' ',
                    personal.PrimerNombre,
                    CASE WHEN personal.SegundoNombre IS NOT NULL AND personal.SegundoNombre != ''
                         THEN CONCAT(' ', personal.SegundoNombre)
                         ELSE ''
                    END,
                    CASE WHEN personal.TercerNombre IS NOT NULL AND personal.TercerNombre != ''
                         THEN CONCAT(' ', personal.TercerNombre)
                         ELSE ''
                    END
                ) AS NombreCompleto,
                personal.IdSucuDepa,
                personal.FechaPlanilla,
                departamentos.NombreDepartamento,
                planillas.IdPlanilla,
                planillas.Nombre_Planilla,
                CASE
                    WHEN divisiones.Nombre IS NOT NULL THEN CONCAT(divisiones.Nombre, ' - ', planillas.Nombre_Planilla)
                    ELSE planillas.Nombre_Planilla
                END AS Nombre_Planilla_Completo,
                planillas.EsCapital,
                planillas.NoCentroTrabajo,
                planillas.Division,
                divisiones.Nombre AS NombreDivision,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioDiario
                    ELSE salariosbase.SalarioDiarioGuate
                END AS SalarioDiario,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioQuincena
                    ELSE salariosbase.SalarioQuincenaGuate
                END AS SalarioQuincena,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioQuincenaFin
                    ELSE salariosbase.SalarioQuincenaFinGuate
                END AS SalarioQuincenaFinMes,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioBonificacion
                    ELSE salariosbase.SalarioBonificacionGuate
                END AS Bonificacion,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioBase
                    ELSE salariosbase.SalarioBaseGuate
                END AS SalarioBase,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.ISR
                    ELSE salariosbase.ISRGuate
                END AS ISR,
                personal.CuentaDivision1,
                personal.CuentaDivision2,
                personal.CuentaDivision3,
                NULL AS FechaFinColaborador,
                NULL AS TipoBaja
            FROM
                personal
                INNER JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
                INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                INNER JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                LEFT JOIN divisiones ON planillas.Division = divisiones.IdDivision
                LEFT JOIN salariosbase ON salariosbase.Anyo = ?
            WHERE
                personal.Estado IN (1,5) AND
                personal.TipoPersonal = 1`;
        
        // Determinar fechas de inicio y fin de la quincena
        let inicioQuincena, finQuincena, inicioMes, finMes;
        
        if (tipoQuincena === 'normal') {
            // Primera quincena: del 1 al 15
            inicioQuincena = `${anio}-${mes.padStart(2, '0')}-01`;
            finQuincena = `${anio}-${mes.padStart(2, '0')}-15`;
        } else {
            // Segunda quincena: del 16 al 30 (mes comercial)
            inicioQuincena = `${anio}-${mes.padStart(2, '0')}-16`;

            // Mes comercial: usar el mínimo entre 30 y el último día real (para febrero)
            const ultimoDiaReal = new Date(anio, parseInt(mes), 0).getDate();
            const diaFinComercial = Math.min(30, ultimoDiaReal);
            finQuincena = `${anio}-${mes.padStart(2, '0')}-${diaFinComercial}`;

            // Para fin de mes, también necesitamos el rango completo del mes
            inicioMes = `${anio}-${mes.padStart(2, '0')}-01`;
            finMes = finQuincena;
        }
        
        // Construir la consulta SQL para personal con bajas en el periodo actual
        let queryBajas = `
            SELECT
                personal.IdPersonal,
                CONCAT(
                    personal.PrimerApellido,
                    CASE WHEN personal.SegundoApellido IS NOT NULL AND personal.SegundoApellido != ''
                         THEN CONCAT(' ', personal.SegundoApellido)
                         ELSE ''
                    END,
                    ' ',
                    personal.PrimerNombre,
                    CASE WHEN personal.SegundoNombre IS NOT NULL AND personal.SegundoNombre != ''
                         THEN CONCAT(' ', personal.SegundoNombre)
                         ELSE ''
                    END,
                    CASE WHEN personal.TercerNombre IS NOT NULL AND personal.TercerNombre != ''
                         THEN CONCAT(' ', personal.TercerNombre)
                         ELSE ''
                    END
                ) AS NombreCompleto,
                personal.IdSucuDepa,
                personal.FechaPlanilla,
                departamentos.NombreDepartamento,
                planillas.IdPlanilla,
                planillas.Nombre_Planilla,
                CASE
                    WHEN divisiones.Nombre IS NOT NULL THEN CONCAT(divisiones.Nombre, ' - ', planillas.Nombre_Planilla)
                    ELSE planillas.Nombre_Planilla
                END AS Nombre_Planilla_Completo,
                planillas.EsCapital,
                planillas.NoCentroTrabajo,
                planillas.Division,
                divisiones.Nombre AS NombreDivision,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioDiario
                    ELSE salariosbase.SalarioDiarioGuate
                END AS SalarioDiario,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioQuincena
                    ELSE salariosbase.SalarioQuincenaGuate
                END AS SalarioQuincena,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioQuincenaFin
                    ELSE salariosbase.SalarioQuincenaFinGuate
                END AS SalarioQuincenaFinMes,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioBonificacion
                    ELSE salariosbase.SalarioBonificacionGuate
                END AS Bonificacion,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioBase
                    ELSE salariosbase.SalarioBaseGuate
                END AS SalarioBase,
                CASE
                    WHEN planillas.EsCapital = 0 THEN salariosbase.ISR
                    ELSE salariosbase.ISRGuate
                END AS ISR,
                personal.CuentaDivision1,
                personal.CuentaDivision2,
                personal.CuentaDivision3,
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
                LEFT JOIN salariosbase ON salariosbase.Anyo = ?
                INNER JOIN DespidosRenuncias dr ON personal.IdPersonal = dr.IdPersonal
            WHERE
                personal.TipoPersonal = 1 AND
                dr.IdEstadoPersonal IN (2, 3) AND
                dr.FechaFinColaborador >= ? AND
                dr.FechaFinColaborador <= ? AND
                dr.Estado = 1`;
        
        // **NUEVA CONSULTA: Bajas de primera quincena para procesamiento en fin de mes**
        let queryBajasQuincenaAnterior = '';
        let paramsBajasQuincenaAnterior = [];
        
        if (tipoQuincena === 'finMes') {
            const inicioQuincenaAnterior = `${anio}-${mes.padStart(2, '0')}-01`;
            const finQuincenaAnterior = `${anio}-${mes.padStart(2, '0')}-15`;
            
            queryBajasQuincenaAnterior = `
                SELECT
                    personal.IdPersonal,
                    CONCAT(
                        personal.PrimerApellido,
                        CASE WHEN personal.SegundoApellido IS NOT NULL AND personal.SegundoApellido != ''
                             THEN CONCAT(' ', personal.SegundoApellido)
                             ELSE ''
                        END,
                        ' ',
                        personal.PrimerNombre,
                        CASE WHEN personal.SegundoNombre IS NOT NULL AND personal.SegundoNombre != ''
                             THEN CONCAT(' ', personal.SegundoNombre)
                             ELSE ''
                        END,
                        CASE WHEN personal.TercerNombre IS NOT NULL AND personal.TercerNombre != ''
                             THEN CONCAT(' ', personal.TercerNombre)
                             ELSE ''
                        END
                    ) AS NombreCompleto,
                    personal.IdSucuDepa,
                    personal.FechaPlanilla,
                    departamentos.NombreDepartamento,
                    planillas.IdPlanilla,
                    planillas.Nombre_Planilla,
                    CASE
                        WHEN divisiones.Nombre IS NOT NULL THEN CONCAT(divisiones.Nombre, ' - ', planillas.Nombre_Planilla)
                        ELSE planillas.Nombre_Planilla
                    END AS Nombre_Planilla_Completo,
                    planillas.EsCapital,
                    planillas.NoCentroTrabajo,
                    planillas.Division,
                    divisiones.Nombre AS NombreDivision,
                    CASE
                        WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioDiario
                        ELSE salariosbase.SalarioDiarioGuate
                    END AS SalarioDiario,
                    CASE
                        WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioQuincena
                        ELSE salariosbase.SalarioQuincenaGuate
                    END AS SalarioQuincena,
                    CASE
                        WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioQuincenaFin
                        ELSE salariosbase.SalarioQuincenaFinGuate
                    END AS SalarioQuincenaFinMes,
                    CASE
                        WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioBonificacion
                        ELSE salariosbase.SalarioBonificacionGuate
                    END AS Bonificacion,
                    CASE
                        WHEN planillas.EsCapital = 0 THEN salariosbase.SalarioBase
                        ELSE salariosbase.SalarioBaseGuate
                    END AS SalarioBase,
                    CASE
                        WHEN planillas.EsCapital = 0 THEN salariosbase.ISR
                        ELSE salariosbase.ISRGuate
                    END AS ISR,
                    personal.CuentaDivision1,
                    personal.CuentaDivision2,
                    personal.CuentaDivision3,
                    dr.FechaFinColaborador,
                    CASE
                        WHEN dr.IdEstadoPersonal = 2 THEN 'Despedido (Q1)'
                        WHEN dr.IdEstadoPersonal = 3 THEN 'Renuncia (Q1)'
                        ELSE 'Otro (Q1)'
                    END AS TipoBaja
                FROM
                    personal
                    INNER JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
                    INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                    INNER JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                    LEFT JOIN divisiones ON planillas.Division = divisiones.IdDivision
                    LEFT JOIN salariosbase ON salariosbase.Anyo = ?
                    INNER JOIN DespidosRenuncias dr ON personal.IdPersonal = dr.IdPersonal
                WHERE
                    personal.TipoPersonal = 1 AND
                    dr.IdEstadoPersonal IN (2, 3) AND
                    dr.FechaFinColaborador >= ? AND
                    dr.FechaFinColaborador <= ? AND
                    dr.Estado = 1`;
            
            paramsBajasQuincenaAnterior = [anio, inicioQuincenaAnterior, finQuincenaAnterior];
        }

        // Agregar filtros
        const params = [anio];
        const paramsBajas = [anio, inicioQuincena, finQuincena];
        
        // Filtro de planilla (si no es "todos")
        if (planillaId !== 'todos') {
            queryActivos += ' AND planillas.IdPlanilla = ?';
            queryBajas += ' AND planillas.IdPlanilla = ?';
            params.push(planillaId);
            paramsBajas.push(planillaId);

            if (tipoQuincena === 'finMes') {
                queryBajasQuincenaAnterior += ' AND planillas.IdPlanilla = ?';
                paramsBajasQuincenaAnterior.push(planillaId);
            }
        }
        
        // Ordenar los resultados
        const orderBy = ' ORDER BY divisiones.Nombre ASC, planillas.Nombre_Planilla ASC, personal.PrimerApellido ASC, personal.SegundoApellido ASC, personal.PrimerNombre ASC';
        queryActivos += orderBy;
        queryBajas += orderBy;
        if (tipoQuincena === 'finMes') {
            queryBajasQuincenaAnterior += orderBy;
        }
        
        // Ejecutar las consultas
        const connection = await connectionString();
        const resultsActivos = await connection.query(queryActivos, params);
        const resultsBajas = await connection.query(queryBajas, paramsBajas);
        
        let resultsBajasQuincenaAnterior = [];
        if (tipoQuincena === 'finMes') {
            resultsBajasQuincenaAnterior = await connection.query(queryBajasQuincenaAnterior, paramsBajasQuincenaAnterior);
        }
        
        await connection.close();
        
        // Combinar resultados
        const results = [...resultsActivos, ...resultsBajas, ...resultsBajasQuincenaAnterior];

        // Procesar cada empleado para agregar los días laborados y descuentos judiciales
        const mesStr = mes.toString().padStart(2, '0');
        const resultadosCompletos = [];
        
        // Días totales en una quincena
        const diasTotalesQuincena = 15;
        
        for (const empleado of results) {
            // **LÓGICA ESPECIAL PARA BAJAS DE QUINCENA ANTERIOR EN FIN DE MES**
            let diasLaborados = diasTotalesQuincena;
            let esBajaQuincenaAnterior = false;
            
            if (empleado.FechaFinColaborador) {
                const fechaFinColaborador = parsearFechaISO(empleado.FechaFinColaborador);
                const fechaInicioQuincena = parsearFechaISO(inicioQuincena);
                const fechaFinQuincena = parsearFechaISO(finQuincena);
                
                if (tipoQuincena === 'finMes') {
                    // Para fin de mes, verificar si la baja fue en la quincena anterior
                    const fechaInicioMes = parsearFechaISO(inicioMes);
                    const fecha15 = parsearFechaISO(`${anio}-${mes.padStart(2, '0')}-15`);
                    
                    if (fechaFinColaborador >= fechaInicioMes && fechaFinColaborador <= fecha15) {
                        // Baja en primera quincena - para fin de mes no laboró días
                        diasLaborados = 0;
                        esBajaQuincenaAnterior = true;
                    } else if (fechaFinColaborador >= fechaInicioQuincena && fechaFinColaborador <= fechaFinQuincena) {
                        // Baja en segunda quincena - calcular días trabajados
                        const diasTrabajados = Math.floor((fechaFinColaborador - fechaInicioQuincena) / (1000 * 60 * 60 * 24)) + 1;
                        diasLaborados = Math.min(diasTrabajados, diasTotalesQuincena);
                    }
                } else {
                    // Lógica normal para quincenas normales
                    if (fechaFinColaborador >= fechaInicioQuincena && fechaFinColaborador <= fechaFinQuincena) {
                        const diasTrabajados = Math.floor((fechaFinColaborador - fechaInicioQuincena) / (1000 * 60 * 60 * 24)) + 1;
                        diasLaborados = Math.min(diasTrabajados, diasTotalesQuincena);
                    }
                }
            }
            
            // Obtener días suspendidos para este empleado en la quincena actual
            // NOTA: Para bajas de quincena anterior, no aplicar suspensiones de fin de mes
            let diasSuspendidos = 0;
            if (!esBajaQuincenaAnterior) {
                diasSuspendidos = await obtenerDiasSuspendidos(
                    empleado.IdPersonal, 
                    mesStr, 
                    anio, 
                    tipoQuincena
                );
            }
            
            // Ajustar días laborados restando suspensiones
            diasLaborados = Math.max(0, diasLaborados - diasSuspendidos);
            
            // Obtener descuentos judiciales para este empleado
            const descuentosJudiciales = await obtenerDescuentosJudiciales(empleado.IdPersonal);
            
            // Determinar el salario base quincenal según el tipo de quincena
            const campoSalario = tipoQuincena === 'normal' ? 'SalarioQuincena' : 'SalarioQuincenaFinMes';
            const salarioBaseQuincenal = empleado[campoSalario];
            
            // Calcular salario proporcional según los días laborados
            const salarioProporcional = (salarioBaseQuincenal / diasTotalesQuincena) * diasLaborados;
            
            // USAR LA NUEVA FUNCIÓN PARA CALCULAR EL DESCUENTO CON INDICADORES
            const indicadoresDescuento = calcularDescuentoJudicialConIndicadores(
                descuentosJudiciales, 
                tipoQuincena, 
                diasLaborados, 
                diasTotalesQuincena
            );
            const detallesSuspensionesFaltas = await obtenerDetallesSuspensionesFaltas(
                empleado.IdPersonal, 
                mesStr, 
                anio, 
                tipoQuincena
            );
            const montoDescuentoJudicial = indicadoresDescuento.montoDescuento;
            
            // **CÁLCULO ESPECIAL PARA BAJAS DE QUINCENA ANTERIOR**
            let bonificacionCalculada = 0;
            let igssCalculado = 0;
            
            if (tipoQuincena === 'finMes') {
                // Obtener datos de quincena anterior
                const datosQ1 = await obtenerDatosQuincenaAnterior(empleado.IdPersonal, mes, anio);
                empleado.DatosQuincenaAnterior = datosQ1;
                
                if (esBajaQuincenaAnterior) {
                    // **CASO ESPECIAL: Baja en primera quincena**
                    // Calcular IGSS y bonificación solo sobre los días de la primera quincena
                    const sumaSubTotales = datosQ1.subTotalPagar; // Solo quincena anterior
                    igssCalculado = sumaSubTotales * 0.0483;
                    
                    // Bonificación solo por los días de la primera quincena
                    const bonificacionMensual = empleado.Bonificacion || 0;
                    bonificacionCalculada = (bonificacionMensual / 30) * datosQ1.diasLaborados;
                } else {
                    // Caso normal: empleado activo o baja en segunda quincena
                    const salarioCalculadoQ2 = empleado.SalarioDiario * diasLaborados;
                    const sumaSubTotales = datosQ1.subTotalPagar + salarioCalculadoQ2;
                    igssCalculado = sumaSubTotales * 0.0483;
                    
                    const bonificacionMensual = empleado.Bonificacion || 0;
                    const totalDiasAmbasQuincenas = datosQ1.diasLaborados + diasLaborados;
                    bonificacionCalculada = (bonificacionMensual / 30) * totalDiasAmbasQuincenas;
                }
            }
            
            // Calcular el salario final a pagar
            let salarioFinalAPagar;
            let isrCalculado = 0;

            if (tipoQuincena === 'normal') {
                salarioFinalAPagar = Math.max(0, salarioProporcional - montoDescuentoJudicial);
            } else {
                // Calcular ISR para fin de mes
                const isrMensual = empleado.ISR || 0;
                const fechaLimiteISR = new Date(`${anio}-01-15`);
                const fechaPlanilla = new Date(empleado.FechaPlanilla);

                // Solo aplicar ISR si ingresó ANTES del 15 de enero del año seleccionado
                if (fechaPlanilla < fechaLimiteISR) {
                    const datosQ1 = empleado.DatosQuincenaAnterior || { diasLaborados: 0 };
                    const totalDiasMes = datosQ1.diasLaborados + diasLaborados;
                    isrCalculado = (isrMensual / 30) * totalDiasMes;
                }

                if (esBajaQuincenaAnterior) {
                    // Para bajas de quincena anterior: solo bonificación - IGSS - ISR - descuento
                    salarioFinalAPagar = Math.max(0, bonificacionCalculada - igssCalculado - isrCalculado - montoDescuentoJudicial);
                } else {
                    // Caso normal de fin de mes
                    const salarioFinMes = empleado.SalarioDiario * diasLaborados;
                    const subTotalFinMes = salarioFinMes + bonificacionCalculada - igssCalculado - isrCalculado;
                    salarioFinalAPagar = Math.max(0, subTotalFinMes - montoDescuentoJudicial);
                }
            }

            empleado.ISRCalculado = isrCalculado;
            
            // Formatear fecha correctamente sin problemas de zona horaria
            if (empleado.FechaFinColaborador) {
                empleado.FechaFinColaboradorFormateada = formatearFecha(empleado.FechaFinColaborador);
            } else {
                empleado.FechaFinColaboradorFormateada = null;
            }
            
            // Agregar los campos al objeto del empleado
            empleado.DiasLaborados = diasLaborados;
            empleado.DiasSuspendidos = diasSuspendidos;
            empleado.DiasSuspension = detallesSuspensionesFaltas.diasSuspension;
            empleado.DiasFalta = detallesSuspensionesFaltas.diasFalta;
            empleado.SalarioProporcional = salarioProporcional;
            empleado.DescuentoJudicial = montoDescuentoJudicial;
            empleado.NoDocumentoJudicial = descuentosJudiciales.NoDocumento;
            empleado.SalarioFinalAPagar = salarioFinalAPagar;
            empleado.IndicadoresDescuento = indicadoresDescuento;
            empleado.BonificacionCalculada = bonificacionCalculada;
            empleado.IGSSCalculado = igssCalculado;
            empleado.EsBajaQuincenaAnterior = esBajaQuincenaAnterior; // Nueva bandera
            
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
// Función para calcular el descuento judicial y generar indicadores
function calcularDescuentoJudicialConIndicadores(descuentosJudiciales, tipoQuincena, diasLaborados, diasTotalesQuincena = 15) {
    // Inicializar resultado
    const resultado = {
        montoDescuento: 0,
        tieneDescuentoJudicial: descuentosJudiciales.TieneDescuento,
        aplicaDescuento: false,
        motivoNoAplica: '',
        numeroDocumento: descuentosJudiciales.NoDocumento || '',
        indicadorVisual: ''
    };
    
    // Si no tiene descuento judicial configurado, retornar vacío
    if (!descuentosJudiciales.TieneDescuento) {
        return resultado;
    }
    
    // Determinar el monto de descuento según el tipo de quincena
    const campoDescuento = tipoQuincena === 'normal' ? 'DescuentoQuincenal' : 'DescuentoQuincenalFinMes';
    let montoDescuentoBase = descuentosJudiciales[campoDescuento];
    
    // Si no hay descuento configurado para este tipo de quincena
    if (montoDescuentoBase <= 0) {
        resultado.motivoNoAplica = 'Sin descuento configurado para este tipo de quincena';
        resultado.indicadorVisual = '⚠️ Sin config.';
        return resultado;
    }
    
    // Verificar si el saldo pendiente es menor que el descuento establecido
    if (descuentosJudiciales.SaldoPendiente > 0 && descuentosJudiciales.SaldoPendiente < montoDescuentoBase) {
        montoDescuentoBase = descuentosJudiciales.SaldoPendiente;
    }
    
    // REGLA PRINCIPAL: Solo aplicar descuento si trabajó los días completos
    if (diasLaborados >= diasTotalesQuincena) {
        // Trabajó días completos - APLICAR DESCUENTO
        resultado.montoDescuento = montoDescuentoBase;
        resultado.aplicaDescuento = true;
        resultado.indicadorVisual = '💼 Aplicado';
    } else {
        // No trabajó días completos - NO APLICAR DESCUENTO
        resultado.montoDescuento = 0;
        resultado.aplicaDescuento = false;
        resultado.motivoNoAplica = `Días incompletos (${diasLaborados}/${diasTotalesQuincena})`;
        resultado.indicadorVisual = `🚫 No aplicado (${diasLaborados}/${diasTotalesQuincena})`;
    }
    
    return resultado;
}
// Función completa para renderizar la tabla con indicadores de suspensiones y faltas
async function renderizarTabla(datos) {
    const tbody = document.getElementById('nominaTableBody');
    const thead = document.querySelector('#nominaTable thead tr');
    const tipoQuincena = document.getElementById('tipoQuincenaFilter').value;
    
    // Limpiar tabla
    tbody.innerHTML = '';
    
    // Actualizar encabezados según el tipo de quincena
    actualizarEncabezadosTabla(thead, tipoQuincena);
    
    // Verificar si hay datos
    if (datos.length === 0) {
        document.getElementById('noData').style.display = 'block';
        actualizarPaginacion(0);
        return;
    }
    
    calcularYMostrarTotal(datos);
    document.getElementById('noData').style.display = 'none';
    
    // Calcular indices para paginación
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, datos.length);
    
    // Crear filas para la página actual
    for (let i = startIndex; i < endIndex; i++) {
        const empleado = datos[i];
        
        // Crear la fila según el tipo de quincena
        const row = document.createElement('tr');
        row.className = empleado.TipoBaja ? 'empleado-baja' : '';
        
        if (tipoQuincena === 'normal') {
            row.innerHTML = crearFilaQuincenal(empleado, startIndex + i + 1);
        } else {
            // AQUÍ ESTÁ EL CAMBIO IMPORTANTE: usar await
            row.innerHTML = await crearFilaFinMes(empleado, startIndex + i + 1);
        }
        
        tbody.appendChild(row);
    }
    
    // Actualizar información de paginación
    actualizarPaginacion(datos.length);
}
function actualizarEncabezadosTabla(thead, tipoQuincena) {
    if (tipoQuincena === 'normal') {
        thead.innerHTML = `
            <th>No.</th>
            <th>Nombre Completo</th>
            <th>Tipo</th>
            <th>Salario Diario</th>
            <th>Días Laborados</th>
            <th>Salario Proporcional</th>
            <th>Descuento Judicial</th>
            <th>Total a Pagar</th>
            <th>Cuenta</th>
        `;
    } else {
        thead.innerHTML = `
            <th>No.</th>
            <th>Nombre Completo</th>
            <th>Tipo</th>
            <th>Salario Diario</th>
            <th>Días Quincena</th>
            <th>Pagado Quincena</th>
            <th>Días Fin Mes</th>
            <th>Salario Fin Mes</th>
            <th>Total Días</th>
            <th>Bonificación</th>
            <th>IGSS</th>
            <th>ISR</th>
            <th>Desc. Judicial</th>
            <th>Total Final</th>
            <th>Cuenta</th>
        `;
    }
}
function combinarCuentasDivision(empleado) {
    const cuentas = [];
    
    if (empleado.CuentaDivision1 && empleado.CuentaDivision1.trim() !== '') {
        cuentas.push(empleado.CuentaDivision1.trim());
    }
    
    if (empleado.CuentaDivision2 && empleado.CuentaDivision2.trim() !== '') {
        cuentas.push(empleado.CuentaDivision2.trim());
    }
    
    if (empleado.CuentaDivision3 && empleado.CuentaDivision3.trim() !== '') {
        cuentas.push(empleado.CuentaDivision3.trim());
    }
    
    return cuentas.length > 0 ? cuentas.join(' | ') : '';
}
function crearFilaQuincenal(empleado, numeroConsecutivo) {
    // Formatear valores
    const salarioDiario = formatearMoneda(empleado.SalarioDiario);
    const salarioProporcional = formatearMoneda(empleado.SalarioProporcional);
    const descuentoJudicial = formatearMoneda(empleado.DescuentoJudicial);
    const salarioFinalAPagar = formatearMoneda(empleado.SalarioFinalAPagar);
    
    // Determinar clases y tooltips para días laborados
    const { claseDiasLaborados, tooltipSuspension, iconoIndicador, contenidoDiasLaborados } = 
        obtenerIndicadoresDiasLaborados(empleado);
    
    // Preparar nombre con indicador de baja si aplica
    let nombreCompleto = empleado.NombreCompleto;
    if (empleado.TipoBaja && empleado.FechaFinColaboradorFormateada) {
        nombreCompleto += ` <span class="indicador-baja" title="Fecha de baja: ${empleado.FechaFinColaboradorFormateada}">[${empleado.TipoBaja}]</span>`;
    }
    
    // Preparar tooltip y clases para descuentos judiciales
    const { claseDescuentoJudicial, tooltipDescuento, contenidoDescuento } = 
        obtenerIndicadoresDescuentoJudicial(empleado, descuentoJudicial);
    
    return `
        <td>${numeroConsecutivo}</td>
        <td class="highlight">${nombreCompleto}</td>
        <td>
            <span class="status-badge ${empleado.EsCapital ? 'capital' : 'regional'}">
                ${empleado.EsCapital ? 'Capital' : 'Regional'}
            </span>
        </td>
        <td class="currency">${salarioDiario}</td>
        <td class="${claseDiasLaborados}" ${tooltipSuspension}>${contenidoDiasLaborados}</td>
        <td class="currency">${salarioProporcional}</td>
        <td class="${claseDescuentoJudicial}" ${tooltipDescuento}>${contenidoDescuento}</td>
        <td class="currency salario-final">${salarioFinalAPagar}</td>
        <td class="cuentas-division-combinadas">${combinarCuentasDivision(empleado)}</td>
    `;
}
function crearFilaFinMes(empleado, numeroConsecutivo) {
    // Usar los datos pre-calculados
    const datosQ1 = empleado.DatosQuincenaAnterior || {
        diasLaborados: 0,
        montoPagado: 0,
        subTotalPagar: 0,
        descuentoJudicial: 0
    };
    
    // Formatear valores básicos
    const salarioDiario = formatearMoneda(empleado.SalarioDiario);
    const diasQ2 = empleado.DiasLaborados;
    
    // **MANEJO ESPECIAL PARA BAJAS DE QUINCENA ANTERIOR**
    let salarioCalculadoQ2;
    if (empleado.EsBajaQuincenaAnterior) {
        salarioCalculadoQ2 = formatearMoneda(0); // No trabajó en fin de mes
    } else {
        salarioCalculadoQ2 = formatearMoneda(parseFloat(empleado.SalarioDiario) * diasQ2);
    }
    
    const totalDiasMes = datosQ1.diasLaborados + diasQ2;
    
    // Valores calculados
    const bonificacionCalculada = empleado.BonificacionCalculada || 0;
    const igssCalculado = empleado.IGSSCalculado || 0;

    // **CÁLCULO PROPORCIONAL DE ISR**
    // ISR se calcula proporcionalmente según días laborados del mes completo (máximo 30 días)
    // REGLA: Solo aplica ISR si el empleado ingresó antes del 15 de enero del año seleccionado
    const isrMensual = empleado.ISR || 0;
    let isrCalculado = 0;

    // Obtener el año seleccionado en los filtros
    const anioSeleccionado = document.getElementById('anioFilter').value;

    // Crear fecha límite: 15 de enero del año seleccionado
    const fechaLimiteISR = new Date(`${anioSeleccionado}-01-15`);

    // Fecha de ingreso del empleado
    const fechaPlanilla = new Date(empleado.FechaPlanilla);

    // Solo aplicar ISR si ingresó ANTES del 15 de enero del año seleccionado
    if (fechaPlanilla < fechaLimiteISR) {
        // El empleado ingresó antes del 15 de enero, aplicar ISR proporcional
        isrCalculado = (isrMensual / 30) * totalDiasMes;
    }
    // Si ingresó el 15 de enero o después del año seleccionado, NO aplica ISR (isrCalculado = 0)

    const descuentoJudicial = empleado.DescuentoJudicial || 0;

    // **CÁLCULO CORRECTO DEL TOTAL FINAL**
    let totalFinal;
    if (empleado.EsBajaQuincenaAnterior) {
        // Para bajas de quincena anterior: solo bonificación - IGSS - ISR - descuento
        totalFinal = Math.max(0, bonificacionCalculada - igssCalculado - isrCalculado - descuentoJudicial);
    } else {
        // Caso normal: SubTotalPagar = Salario + Bonificación - IGSS - ISR - Descuento
        const salarioFinMesNumerico = parseFloat(empleado.SalarioDiario) * diasQ2;
        const subTotalPagar = salarioFinMesNumerico + bonificacionCalculada - igssCalculado - isrCalculado;
        totalFinal = Math.max(0, subTotalPagar - descuentoJudicial);
    }

    // Formatear valores para mostrar
    const bonificacion = formatearMoneda(bonificacionCalculada);
    const igss = formatearMoneda(igssCalculado);
    const isr = formatearMoneda(isrCalculado);
    const descuentoJudicialFormateado = formatearMoneda(descuentoJudicial);
    const totalFinalFormateado = formatearMoneda(totalFinal);
    
    // Determinar clases y tooltips para días laborados
    let claseDiasLaborados = 'diasLaborados';
    let tooltipSuspension = '';
    let iconoIndicador = '';
    
    const diasQuincenaCompleta = 15;
    
    if (empleado.EsBajaQuincenaAnterior) {
        // Caso especial para bajas de quincena anterior
        claseDiasLaborados += ' baja-quincena-anterior';
        iconoIndicador = '📋'; // Icono especial para IGSS/Bonificación
        tooltipSuspension = `data-tooltip="Baja en primera quincena. Solo se calcula IGSS y Bonificación. Días fin de mes: 0"`;
    } else if (empleado.DiasLaborados < diasQuincenaCompleta) {
        // Lógica normal para días reducidos
        const diasSuspension = empleado.DiasSuspension || 0;
        const diasFalta = empleado.DiasFalta || 0;
        
        if (diasFalta > 0 && diasSuspension > 0) {
            claseDiasLaborados += ' mixto';
            iconoIndicador = '💎';
            tooltipSuspension = `data-tooltip="Suspensiones: ${diasSuspension} día(s), Faltas: ${diasFalta} día(s). Total días trabajados: ${empleado.DiasLaborados}"`;
        } else if (diasFalta > 0) {
            claseDiasLaborados += ' falta';
            iconoIndicador = '🔴';
            tooltipSuspension = `data-tooltip="El colaborador tiene ${diasFalta} día(s) de falta. Días trabajados: ${empleado.DiasLaborados}"`;
        } else if (diasSuspension > 0) {
            claseDiasLaborados += ' suspension';
            iconoIndicador = '⚠️';
            tooltipSuspension = `data-tooltip="El colaborador tiene ${diasSuspension} día(s) de suspensión. Días trabajados: ${empleado.DiasLaborados}"`;
        } else if (empleado.TipoBaja && empleado.FechaFinColaboradorFormateada) {
            claseDiasLaborados += ' baja';
            iconoIndicador = '👤';
            tooltipSuspension = `data-tooltip="${empleado.TipoBaja} el ${empleado.FechaFinColaboradorFormateada}. Días trabajados: ${empleado.DiasLaborados}"`;
        }
        
        if (empleado.DiasLaborados === 0) {
            claseDiasLaborados += ' peligro';
        } else {
            claseDiasLaborados += ' alerta';
        }
        
        claseDiasLaborados += ' reducido';
    }
    
    // Preparar nombre con indicador de baja si aplica
    let nombreCompleto = empleado.NombreCompleto;
    if (empleado.TipoBaja && empleado.FechaFinColaboradorFormateada) {
        nombreCompleto += ` <span class="indicador-baja" title="Fecha de baja: ${empleado.FechaFinColaboradorFormateada}">[${empleado.TipoBaja}]</span>`;
    }
    
    // Preparar tooltip y clases para descuentos judiciales
    let claseDescuentoJudicial = 'currency';
    let tooltipDescuento = '';
    let contenidoDescuento = descuentoJudicialFormateado;
    
    if (empleado.IndicadoresDescuento) {
        const indicadores = empleado.IndicadoresDescuento;
        
        if (indicadores.tieneDescuentoJudicial) {
            if (indicadores.aplicaDescuento) {
                claseDescuentoJudicial += ' descuento-judicial';
                tooltipDescuento = `data-tooltip="Embargo No. ${indicadores.numeroDocumento} - ${indicadores.indicadorVisual}"`;
            } else {
                claseDescuentoJudicial += ' descuento-no-aplicado';
                tooltipDescuento = `data-tooltip="Embargo No. ${indicadores.numeroDocumento} - ${indicadores.indicadorVisual}. Motivo: ${indicadores.motivoNoAplica}"`;
                contenidoDescuento = `<span class="descuento-suspendido">${descuentoJudicialFormateado} ${indicadores.indicadorVisual}</span>`;
            }
        }
    } else if (empleado.DescuentoJudicial > 0) {
        claseDescuentoJudicial += ' descuento-judicial';
        tooltipDescuento = `data-tooltip="Embargo No. ${empleado.NoDocumentoJudicial}"`;
    }
    
    // Contenido de días laborados con indicador
    const contenidoDiasLaborados = empleado.EsBajaQuincenaAnterior || empleado.DiasLaborados < diasQuincenaCompleta 
        ? `${iconoIndicador} ${empleado.DiasLaborados}`
        : `${empleado.DiasLaborados}`
        return `
        <td>${numeroConsecutivo}</td>
        <td class="highlight">${nombreCompleto}</td>
        <td>
            <span class="status-badge ${empleado.EsCapital ? 'capital' : 'regional'}">
                ${empleado.EsCapital ? 'Capital' : 'Regional'}
            </span>
        </td>
        <td class="currency">${salarioDiario}</td>
        <td class="text-center">${datosQ1.diasLaborados}</td>
        <td class="currency">${formatearMoneda(datosQ1.montoPagado)}</td>
        <td class="${claseDiasLaborados} text-center" ${tooltipSuspension}>${contenidoDiasLaborados}</td>
        <td class="currency">${salarioCalculadoQ2}</td>
        <td class="text-center">${totalDiasMes}</td>
        <td class="currency bonificacion-calculada">${bonificacion}</td>
        <td class="currency igss-calculado">${igss}</td>
        <td class="currency isr-calculado">${isr}</td>
        <td class="${claseDescuentoJudicial}" ${tooltipDescuento}>${contenidoDescuento}</td>
        <td class="currency salario-final">${totalFinalFormateado}</td>
        <td class="cuentas-division-combinadas">${combinarCuentasDivision(empleado)}</td>
    `;
}
function obtenerIndicadoresDiasLaborados(empleado) {
    let claseDiasLaborados = 'diasLaborados';
    let tooltipSuspension = '';
    let iconoIndicador = '';
    
    const diasQuincenaCompleta = 15;
    
    if (empleado.DiasLaborados < diasQuincenaCompleta) {
        const diasSuspension = empleado.DiasSuspension || 0;
        const diasFalta = empleado.DiasFalta || 0;
        
        if (diasFalta > 0 && diasSuspension > 0) {
            claseDiasLaborados += ' mixto';
            iconoIndicador = '💎';
            tooltipSuspension = `data-tooltip="Suspensiones: ${diasSuspension} día(s), Faltas: ${diasFalta} día(s). Total días trabajados: ${empleado.DiasLaborados}"`;
        } else if (diasFalta > 0) {
            claseDiasLaborados += ' falta';
            iconoIndicador = '🔴';
            tooltipSuspension = `data-tooltip="El colaborador tiene ${diasFalta} día(s) de falta. Días trabajados: ${empleado.DiasLaborados}"`;
        } else if (diasSuspension > 0) {
            claseDiasLaborados += ' suspension';
            iconoIndicador = '⚠️';
            tooltipSuspension = `data-tooltip="El colaborador tiene ${diasSuspension} día(s) de suspensión. Días trabajados: ${empleado.DiasLaborados}"`;
        } else if (empleado.TipoBaja && empleado.FechaFinColaboradorFormateada) {
            claseDiasLaborados += ' baja';
            iconoIndicador = '👤';
            tooltipSuspension = `data-tooltip="${empleado.TipoBaja} el ${empleado.FechaFinColaboradorFormateada}. Días trabajados: ${empleado.DiasLaborados}"`;
        }
        
        if (empleado.DiasLaborados === 0) {
            claseDiasLaborados += ' peligro';
        } else {
            claseDiasLaborados += ' alerta';
        }
        
        claseDiasLaborados += ' reducido';
    }
    
    const contenidoDiasLaborados = empleado.DiasLaborados < diasQuincenaCompleta 
        ? `${iconoIndicador} ${empleado.DiasLaborados} / ${diasQuincenaCompleta}`
        : `${empleado.DiasLaborados} / ${diasQuincenaCompleta}`;
    
    return { claseDiasLaborados, tooltipSuspension, iconoIndicador, contenidoDiasLaborados };
}

function obtenerIndicadoresDescuentoJudicial(empleado, descuentoFormateado) {
    let claseDescuentoJudicial = 'currency';
    let tooltipDescuento = '';
    let contenidoDescuento = descuentoFormateado;
    
    if (empleado.IndicadoresDescuento) {
        const indicadores = empleado.IndicadoresDescuento;
        
        if (indicadores.tieneDescuentoJudicial) {
            if (indicadores.aplicaDescuento) {
                claseDescuentoJudicial += ' descuento-judicial';
                tooltipDescuento = `data-tooltip="Embargo No. ${indicadores.numeroDocumento} - ${indicadores.indicadorVisual}"`;
            } else {
                claseDescuentoJudicial += ' descuento-no-aplicado';
                tooltipDescuento = `data-tooltip="Embargo No. ${indicadores.numeroDocumento} - ${indicadores.indicadorVisual}. Motivo: ${indicadores.motivoNoAplica}"`;
                contenidoDescuento = `<span class="descuento-suspendido">${descuentoFormateado} ${indicadores.indicadorVisual}</span>`;
            }
        }
    } else if (empleado.DescuentoJudicial > 0) {
        claseDescuentoJudicial += ' descuento-judicial';
        tooltipDescuento = `data-tooltip="Embargo No. ${empleado.NoDocumentoJudicial}"`;
    }
    
    return { claseDescuentoJudicial, tooltipDescuento, contenidoDescuento };
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
    
    if (prevButton && nextButton) {
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
        
        // Obtener el valor del filtro de planilla
        const planillaFilterValue = document.getElementById('planillaFilter').value;
        
        // Obtener datos según filtros
        let datosCompletos = await obtenerDatosNomina();
        
        // Filtrar los datos para eliminar empleados de planillas ya guardadas
        if (datosCompletos && datosCompletos.length > 0) {
            // ORDENAMIENTO ADICIONAL POR APELLIDOS (por si acaso)
            datosCompletos.sort((a, b) => {
                // Primero ordenar por División
                if (a.NombreDivision !== b.NombreDivision) {
                    return (a.NombreDivision || '').localeCompare(b.NombreDivision || '');
                }
                
                // Si están en la misma División, ordenar por NoCentroTrabajo
                const centroTrabajoA = parseInt(a.NoCentroTrabajo || '0', 10);
                const centroTrabajoB = parseInt(b.NoCentroTrabajo || '0', 10);
                if (centroTrabajoA !== centroTrabajoB) {
                    return centroTrabajoA - centroTrabajoB;
                }
                
                // Finalmente, ordenar por nombre completo (que ya está en formato "Apellidos, Nombres")
                return a.NombreCompleto.localeCompare(b.NombreCompleto);
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
        
        // Asignar los datos filtrados y renderizar la tabla
        filteredData = datosCompletos;
        renderizarTabla(filteredData);
        calcularYMostrarTotal(filteredData);
    } catch (error) {
        console.error('Error al cargar datos:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error al cargar datos',
            text: 'Ocurrió un problema al obtener los datos de nómina. Detalles en la consola.'
        });
        ocultarTotal();
    } finally {
        document.getElementById('loader').style.display = 'none';
    }
}

// Función auxiliar para parsear fecha del formato ISO sin problemas de zona horaria
function parsearFechaISO(fechaISO) {
    if (!fechaISO) return null;
    
    // Si la fecha ya es un objeto Date, devolverla
    if (fechaISO instanceof Date) return fechaISO;
    
    // Si es string en formato ISO (YYYY-MM-DD) o con hora
    if (typeof fechaISO === 'string') {
        // Si viene con hora, tomar solo la parte de fecha
        const soloFecha = fechaISO.split('T')[0];
        const partes = soloFecha.split('-');
        
        if (partes.length === 3) {
            // Crear fecha usando hora del mediodía para evitar problemas de zona horaria
            const fecha = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]), 12, 0, 0);
            return fecha;
        }
    }
    return null;
}

// Función para formatear fecha sin problemas de zona horaria
function formatearFecha(fecha) {
    if (!fecha) return '';
    
    let fechaObj;
    if (fecha instanceof Date) {
        fechaObj = fecha;
    } else {
        fechaObj = parsearFechaISO(fecha);
    }
    
    if (!fechaObj) return '';
    
    // Formatear manualmente para evitar problemas de zona horaria
    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const anio = fechaObj.getFullYear();
    
    return `${dia}/${mes}/${anio}`;
}

// Funciones para obtener información adicional
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
            // Segunda quincena: del 16 al 30 (mes comercial)
            inicioQuincena = `${anio}-${mes.toString().padStart(2, '0')}-16`;

            // Mes comercial: usar el mínimo entre 30 y el último día real (para febrero)
            const ultimoDiaReal = new Date(anio, parseInt(mes), 0).getDate();
            const diaFinComercial = Math.min(30, ultimoDiaReal);
            finQuincena = `${anio}-${mes.toString().padStart(2, '0')}-${diaFinComercial}`;
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
            // Segunda quincena: del 16 al 30 (mes comercial)
            inicioQuincena = `${anio}-${mes.toString().padStart(2, '0')}-16`;

            // Mes comercial: usar el mínimo entre 30 y el último día real (para febrero)
            const ultimoDiaReal = new Date(anio, parseInt(mes), 0).getDate();
            const diaFinComercial = Math.min(30, ultimoDiaReal);
            finQuincena = `${anio}-${mes.toString().padStart(2, '0')}-${diaFinComercial}`;
        }

        // Consulta para obtener las bajas del periodo (MODIFICADA)
        const query = `
            SELECT 
                dr.IdPersonal,
                dr.IdEstadoPersonal,
                dr.FechaFinColaborador,
                CONCAT(
                    p.PrimerApellido, 
                    CASE WHEN p.SegundoApellido IS NOT NULL AND p.SegundoApellido != '' 
                         THEN CONCAT(' ', p.SegundoApellido) 
                         ELSE '' 
                    END,
                    ' ',
                    p.PrimerNombre,
                    CASE WHEN p.SegundoNombre IS NOT NULL AND p.SegundoNombre != '' 
                         THEN CONCAT(' ', p.SegundoNombre) 
                         ELSE '' 
                    END,
                    CASE WHEN p.TercerNombre IS NOT NULL AND p.TercerNombre != '' 
                         THEN CONCAT(' ', p.TercerNombre) 
                         ELSE '' 
                    END
                ) AS NombreCompleto,
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
                AND dr.FechaFinColaborador <= ? AND
                dr.Estado = 1
            ORDER BY 
                dr.FechaFinColaborador, p.PrimerApellido ASC, p.SegundoApellido ASC, p.PrimerNombre ASC
        `;
        
        const params = [inicioQuincena, finQuincena];
        const results = await connection.query(query, params);
        
        // CORRECCIÓN AQUÍ: Formatear fechas en los resultados
        const resultadosCorregidos = results.map(result => {
            if (result.FechaFinColaborador) {
                result.FechaFinColaboradorFormateada = formatearFecha(result.FechaFinColaborador);
            }
            return result;
        });
        
        await connection.close();
        return resultadosCorregidos;
        
    } catch (error) {
        console.error('Error al obtener bajas de colaboradores:', error);
        return [];
    }
}


// Función para formatear fecha y hora
function formatearFechaHora(fecha) {
    if (!fecha) return '';
    
    let fechaObj;
    if (fecha instanceof Date) {
        fechaObj = fecha;
    } else {
        fechaObj = parsearFechaISO(fecha);
    }
    
    if (!fechaObj) return '';
    
    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const anio = fechaObj.getFullYear();
    const hora = fechaObj.getHours().toString().padStart(2, '0');
    const minutos = fechaObj.getMinutes().toString().padStart(2, '0');
    
    return `${dia}/${mes}/${anio} ${hora}:${minutos}`;
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
        
        if (!datosPlanillas || datosPlanillas.length === 0) {
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
                headers = ['ID', 'Nombre', 'No. Cuenta', 'No. Autorización', 'Salario Diario', 'Días Lab.', 'Bonificación', 'IGSS', 'Monto Pagado'];
                colWidths = [15, contentWidth - 245, 40, 40, 25, 25, 35, 25, 40]; // Total = contentWidth
            } else {
                headers = ['ID', 'Nombre', 'No. Cuenta', 'No. Autorización', 'Salario Diario', 'Días Lab.', 'Monto Pagado'];
                colWidths = [15, contentWidth - 205, 40, 40, 25, 25, 40]; // Total = contentWidth
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
                    
                    // Número de Autorización (alineado al centro)
                    doc.text(empleado.NoAutorizacion || 'Sin autorización', xPositions[3] + colWidths[3] / 2, yPos + 5.5, { align: 'center' });
                    
                    // Salario Diario (alineado al centro)
                    doc.text(`Q${formatearNumero(empleado.SalarioDiario)}`, xPositions[4] + colWidths[4] / 2, yPos + 5.5, { align: 'center' });
                    
                    // Días Laborados (alineado al centro)
                    doc.text(empleado.DiasLaborados.toString(), xPositions[5] + colWidths[5] / 2, yPos + 5.5, { align: 'center' });
                    
                    if (esQuincenaFinMes) {
                        // Bonificación (alineado al centro)
                        doc.text(`Q${formatearNumero(empleado.Bonificacion || 0)}`, xPositions[6] + colWidths[6] / 2, yPos + 5.5, { align: 'center' });
                        
                        // IGSS (alineado al centro)
                        doc.text(`Q${formatearNumero(empleado.PagoIGSS || 0)}`, xPositions[7] + colWidths[7] / 2, yPos + 5.5, { align: 'center' });
                        
                        // Monto Pagado (alineado al centro)
                        doc.text(`Q${formatearNumero(empleado.MontoPagado)}`, xPositions[8] + colWidths[8] / 2, yPos + 5.5, { align: 'center' });
                    } else {
                        // Monto Pagado (alineado al centro)
                        doc.text(`Q${formatearNumero(empleado.MontoPagado)}`, xPositions[6] + colWidths[6] / 2, yPos + 5.5, { align: 'center' });
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
            
            // Agregar estado de la planilla
            let estadoTexto = planilla.Estado === 0 ? 'Estado: Pendiente de autorización' : 'Estado: Autorizado';
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text(estadoTexto, marginLeft, pageHeight - marginBottom - 5, { align: 'left' });
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
                PP.Estado,
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
            
            // 3. Obtener los detalles de cada empleado en la planilla, INCLUYENDO EL CAMPO SEXO
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
                    PPD.NoAutorizacion,
                    p.Sexo,
                    PPD.NoCuentaDivision1,
                    PPD.NoCuentaDivision2,
                    PPD.NoCuentaDivision3
                FROM PagoPlanillaDetalle PPD
                    LEFT JOIN personal p ON PPD.IdPersonal = p.IdPersonal
                WHERE 
                    PPD.IdPagoPlanilla = ?
                ORDER BY 
                    PPD.NombrePersonal ASC
            `;
            
            const detalles = await connection.query(queryDetalles, [planilla.IdPagoPlanilla]);
            
            // Agregar planilla con sus detalles, logo y nombre de división al resultado
            datosCompletos.push({
                ...planilla,
                logo: logo,
                detalles: detalles,
                Estado: planilla.Estado || 0
            });
        }
        
        await connection.close();
        return datosCompletos;
        
    } catch (error) {
        console.error('Error al obtener datos para reporte:', error);
        return [];
    }
}

// Función para obtener UltimoDiaMes
function obtenerUltimoDiaMes(mes, anio) {
    // El día 0 del mes siguiente es el último día del mes actual
    return new Date(anio, mes, 0).getDate();
}

// Función para formatear números con separador de miles y dos decimales
function formatearNumero(valor) {
    if (valor === null || valor === undefined) return '0.00';
    const numeroFormateado = parseFloat(valor).toFixed(2);
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
                    nombrePlanilla: empleado.Nombre_Planilla_Completo, // <- Cambio aquí
                    totalPagado: 0
                };
            }
            
            planillasPorId[idPlanilla].empleados.push(empleado);
            planillasPorId[idPlanilla].totalPagado += empleado.SalarioFinalAPagar;
        }
        
        // Guardar cada planilla por separado
        for (const idPlanilla in planillasPorId) {
            const planillaActual = planillasPorId[idPlanilla];
            
            // 1. Insertar cabecera en PagoPlanilla con Estado=0 (editable)
            const cabeceraPlanilla = {
                IdUsuario: userData.IdPersonal,
                NombreUsuario: userData.NombreCompleto,
                IdPlanilla: idPlanilla,
                NombrePlanilla: planillaActual.empleados[0].Nombre_Planilla_Completo,
                CantColaboradores: planillaActual.empleados.length,
                MontoPagado: planillaActual.totalPagado,
                TipoPago: tipoQuincena === 'normal' ? 'Planilla Quincena' : 'Planilla Fin de Mes',
                IdTipoPago: tipoQuincena === 'normal' ? 1 : 2,
                Mes: mes,
                Anyo: anio,
                Estado: 0  // Inicialmente se guarda con Estado 0 (editable)
            };
            
            // Insertar la cabecera en la base de datos y obtener el ID generado
            const idPagoPlanilla = await insertarCabeceraPlanilla(cabeceraPlanilla);
            
            // 2. Insertar detalles en PagoPlanillaDetalle
            for (const empleado of planillaActual.empleados) {
                
                // CAMPOS BASE (se guardan tal cual)
                const salarioQuincenal = tipoQuincena === 'normal' ? empleado.SalarioQuincena : empleado.SalarioQuincenaFinMes;
                const salarioDiario = empleado.SalarioDiario;
                const diasLaborados = empleado.DiasLaborados;
                
                // Variables para los cálculos
                let bonificacion = 0;
                let pagoIGSS = 0;
                let pagoISR = 0;
                let subTotalPagar = 0;
                let montoPagado = 0;

                if (tipoQuincena === 'normal') {
                    // **LÓGICA PARA QUINCENA NORMAL**

                    // SubTotalPagar = SueldoDiario * Días Laborados
                    subTotalPagar = salarioDiario * diasLaborados;

                    // MontoPagado = SubTotalPagar - Descuento Judicial
                    montoPagado = Math.max(0, subTotalPagar - empleado.DescuentoJudicial);

                } else {
                    // **LÓGICA PARA FIN DE MES** (CORREGIDA)

                    // 1. Obtener datos de la quincena anterior
                    const datosQuincenaAnterior = await obtenerDatosQuincenaAnterior(empleado.IdPersonal, mes, anio);

                    // 2. Calcular: SueldoDiario * Días Laborados
                    const salarioCalculado = salarioDiario * diasLaborados;

                    // 3. Sumar SubTotalPagar de quincena + este cálculo de fin de mes
                    const sumaSubTotales = datosQuincenaAnterior.subTotalPagar + salarioCalculado;

                    // 4. Calcular IGSS = Suma de SubTotales * 4.83%
                    pagoIGSS = sumaSubTotales * 0.0483;

                    // 5. Calcular Bonificación = (Bonificación Mensual / 30) * (Días Quincena + Días Fin Mes)
                    const bonificacionMensual = empleado.Bonificacion || 0;
                    const totalDiasAmbasQuincenas = datosQuincenaAnterior.diasLaborados + diasLaborados;
                    bonificacion = (bonificacionMensual / 30) * totalDiasAmbasQuincenas;

                    // 6. Calcular ISR proporcional
                    const isrMensual = empleado.ISR || 0;
                    const anioSeleccionado = anio;
                    const fechaLimiteISR = new Date(`${anioSeleccionado}-01-15`);
                    const fechaPlanilla = new Date(empleado.FechaPlanilla);

                    // Solo aplicar ISR si ingresó ANTES del 15 de enero del año seleccionado
                    if (fechaPlanilla < fechaLimiteISR) {
                        pagoISR = (isrMensual / 30) * totalDiasAmbasQuincenas;
                    }

                    // 7. SubTotalPagar = SueldoDiario * Días + Bonificación - IGSS - ISR
                    subTotalPagar = salarioCalculado + bonificacion - pagoIGSS - pagoISR;

                    // 8. MontoPagado = SubTotalPagar - Descuento Judicial
                    montoPagado = Math.max(0, subTotalPagar - empleado.DescuentoJudicial);
                }
                
                const detallePlanilla = {
                    IdPagoPlanilla: idPagoPlanilla,
                    IdPersonal: empleado.IdPersonal,
                    NombrePersonal: empleado.NombreCompleto,
                    SalarioQuincenal: salarioQuincenal,      // SE GUARDA TAL CUAL
                    SalarioDiario: salarioDiario,            // SE GUARDA TAL CUAL
                    MontoPagado: montoPagado,                // CALCULADO SEGÚN LÓGICA
                    SubTotalPagar: subTotalPagar,            // CALCULADO SEGÚN LÓGICA
                    Bonificacion: bonificacion,              // 0 para quincena, calculado para fin de mes
                    PagoIGSS: pagoIGSS,                      // 0 para quincena, calculado para fin de mes
                    PagoISR: pagoISR,                        // 0 para quincena, calculado para fin de mes
                    DiasLaborados: diasLaborados,
                    NoCuentaDivision1: empleado.CuentaDivision1 || '',
                    NoCuentaDivision2: empleado.CuentaDivision2 || '',
                    NoCuentaDivision3: empleado.CuentaDivision3 || ''
                };
                
                await insertarDetallePlanilla(detallePlanilla);
                
                // Verificar si el empleado tiene descuento judicial
                if (empleado.DescuentoJudicial > 0) {
                    await registrarDescuentoJudicial(empleado.IdPersonal, empleado.DescuentoJudicial, idPagoPlanilla);
                }
            }
        }
        
        // Cerrar el mensaje de carga
        Swal.close();
        
        // Mostrar mensaje de éxito más detallado
        await Swal.fire({
            icon: 'success',
            title: 'Planilla guardada',
            html: `
                <p>La planilla ha sido guardada exitosamente</p>
                <p>Puede modificarla desde la pestaña "Modificar Nómina".</p>
                ${tipoQuincena === 'finMes' ?
                    '<p><strong>Cálculos aplicados para Fin de Mes:</strong></p>' +
                    '<ul style="text-align: left;">' +
                    '<li>✅ SalarioDiario × Días Laborados</li>' +
                    '<li>✅ IGSS = (SubTotal Quincena + SubTotal Fin Mes) × 4.83%</li>' +
                    '<li>✅ Bonificación = (Bonificación/30) × Total Días</li>' +
                    '<li>✅ ISR = (ISR Mensual/30) × Total Días</li>' +
                    '<li>✅ SubTotalPagar = Salario + Bonificación - IGSS - ISR</li>' +
                    '<li>✅ MontoPagado = SubTotalPagar - Descuentos</li>' +
                    '</ul>'
                    :
                    '<p><strong>✅ Cálculos para Quincena Normal aplicados</strong></p>'
                }
            `,
            confirmButtonText: 'Entendido'
        });
        
        // Limpiar la pantalla después de guardar
        limpiarPantalla();
        
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

// Función para verificar planilla existente
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

// Función para eliminar planilla existente
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

// Función para limpiar la pantalla
function limpiarPantalla() {
    // Limpiar datos
    filteredData = [];
    
    // Restablecer paginación
    currentPage = 1;
    
    // Limpiar la tabla
    renderizarTabla(filteredData);
    ocultarTotal();
    // Restablecer filtros a valores predeterminados
    document.getElementById('planillaFilter').value = 'todos';
    
    // Actualizar la lista de planillas disponibles para reflejar el nuevo estado
    cargarPlanillas();
}

// Función para insertar la cabecera de la planilla
async function insertarCabeceraPlanilla(cabecera) {
    try {
        const connection = await connectionString();
        
        // Consulta SQL para insertar la cabecera con el campo Estado
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
                Anyo,
                Estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            cabecera.Anyo,
            cabecera.Estado || 0  // Establecer por defecto a 0 si no se proporciona
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

// Función actualizada para insertar el detalle de la planilla
async function insertarDetallePlanilla(detalle) {
    try {
        const connection = await connectionString();
        
        // Consulta SQL para insertar el detalle incluyendo SubTotalPagar e ISR
        const query = `
            INSERT INTO PagoPlanillaDetalle (
                IdPagoPlanilla,
                IdPersonal,
                NombrePersonal,
                SalarioQuincenal,
                SalarioDiario,
                MontoPagado,
                SubTotalPagar,
                Bonificacion,
                PagoIGSS,
                ISR,
                DiasLaborados,
                NoCuentaDivision1,
                NoCuentaDivision2,
                NoCuentaDivision3
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            detalle.IdPagoPlanilla,
            detalle.IdPersonal,
            detalle.NombrePersonal,
            detalle.SalarioQuincenal,
            detalle.SalarioDiario,
            detalle.MontoPagado,
            detalle.SubTotalPagar,
            detalle.Bonificacion || 0,
            detalle.PagoIGSS || 0,
            detalle.PagoISR || 0,
            detalle.DiasLaborados,
            detalle.NoCuentaDivision1,
            detalle.NoCuentaDivision2,
            detalle.NoCuentaDivision3
        ];
        
        // Ejecutar la consulta
        await connection.query(query, params);
        await connection.close();
        
    } catch (error) {
        console.error('Error al insertar detalle de planilla:', error);
        throw error;
    }
}

// Función para registrar descuentos judiciales
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

// Función de utilidad para agregar eventos solo si el elemento existe
function addEventIfElementExists(id, eventType, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(eventType, handler);
    }
}

// Función principal para generar Excel
async function generarExcel() {
    try {
        // Mostrar diálogo de selección de filtros
        const { value: formValues } = await Swal.fire({
            title: 'Generar reportes Excel',
            html: `
                <div style="text-align: left; margin-bottom: 20px;">
                    <p>Seleccione los parámetros para generar los reportes:</p>
                    <p style="color: #666; font-size: 14px;">Se generará un archivo Excel por cada planilla.</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 15px; text-align: left;">
                    <div>
                        <label for="excelTipoQuincena" style="display: block; margin-bottom: 5px; font-weight: bold;">Tipo de Quincena:</label>
                        <select id="excelTipoQuincena" class="swal2-input" style="width: 100%;">
                            <option value="normal">Planilla Quincenal</option>
                            <option value="finMes">Planilla Fin de Mes</option>
                        </select>
                    </div>
                    <div>
                        <label for="excelMes" style="display: block; margin-bottom: 5px; font-weight: bold;">Mes:</label>
                        <select id="excelMes" class="swal2-input" style="width: 100%;">
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
                        <label for="excelAnio" style="display: block; margin-bottom: 5px; font-weight: bold;">Año:</label>
                        <select id="excelAnio" class="swal2-input" style="width: 100%;">
                            ${generarOpcionesAnio()}
                        </select>
                    </div>
                </div>
                `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Continuar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                return {
                    tipoQuincena: document.getElementById('excelTipoQuincena').value,
                    mes: document.getElementById('excelMes').value,
                    anio: document.getElementById('excelAnio').value
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
            title: 'Obteniendo datos',
            html: 'Por favor espere mientras se obtienen las planillas...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Obtener datos para el reporte
        const datosPlanillas = await obtenerDatosPlanillasParaReporte();
        
        if (!datosPlanillas || datosPlanillas.length === 0) {
            Swal.close();
            await Swal.fire({
                icon: 'warning',
                title: 'Sin datos',
                text: 'No hay planillas guardadas para los parámetros seleccionados.'
            });
            return;
        }
        
        // Mostrar selector de carpeta
        const carpetaSeleccionada = await seleccionarCarpetaDestino();
        
        if (!carpetaSeleccionada) {
            return; // Usuario canceló la selección de carpeta
        }
        
        // Actualizar mensaje de carga
        Swal.fire({
            title: 'Generando archivos Excel',
            html: `
                <div style="margin-bottom: 15px;">
                    <p>Generando archivos en:</p>
                    <p style="font-family: monospace; background: #f5f5f5; padding: 8px; border-radius: 4px; word-break: break-all;">
                        ${carpetaSeleccionada}
                    </p>
                </div>
                <div class="progress-container" style="margin-top: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Progreso:</span>
                        <span id="progress-text">0 de ${datosPlanillas.length}</span>
                    </div>
                    <div style="width: 100%; background-color: #f0f0f0; border-radius: 10px; overflow: hidden;">
                        <div id="progress-bar" style="width: 0%; height: 20px; background-color: #FF9800; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false
        });
        
        // Generar un archivo por cada planilla
        const archivosGenerados = [];
        const nombresMeses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        
        for (let i = 0; i < datosPlanillas.length; i++) {
            const planilla = datosPlanillas[i];
            let masculinos = 0;
            let femeninos = 0;
            try {
                // Crear el libro de Excel para esta planilla
                const workbook = XLSX.utils.book_new();
                
                // Crear hoja de trabajo
                const worksheetData = await crearHojaPlanilla(planilla, formValues, nombresMeses);
                const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
                
                // Aplicar estilos
                aplicarEstilosExcel(worksheet, planilla);
                
                // Agregar la hoja al libro
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Planilla');
                
                // Generar nombre de archivo
                const mesNombre = nombresMeses[parseInt(formValues.mes) - 1];
                const tipoQuincenaTexto = formValues.tipoQuincena === 'normal' ? 'Quincenal' : 'FinMes';
                
                // Limpiar nombre de planilla para nombre de archivo
                const nombrePlanillaLimpio = limpiarNombreArchivo(planilla.NombrePlanilla);
                const nombreDivisionLimpio = limpiarNombreArchivo(planilla.NombreDivision || 'Division');
                
                const nombreArchivo = `${nombreDivisionLimpio}_${nombrePlanillaLimpio}_${tipoQuincenaTexto}_${mesNombre}_${formValues.anio}.xlsx`;
                const rutaCompleta = require('path').join(carpetaSeleccionada, nombreArchivo);
                
                // Escribir archivo
                XLSX.writeFile(workbook, rutaCompleta);
                
                archivosGenerados.push({
                    nombre: nombreArchivo,
                    planilla: planilla.NombrePlanilla,
                    division: planilla.NombreDivision
                });
                
                // Actualizar progreso
                const progreso = Math.round(((i + 1) / datosPlanillas.length) * 100);
                const progressBar = document.getElementById('progress-bar');
                const progressText = document.getElementById('progress-text');
                
                if (progressBar) progressBar.style.width = `${progreso}%`;
                if (progressText) progressText.textContent = `${i + 1} de ${datosPlanillas.length}`;
                
                // Pequeña pausa para que se vea el progreso
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Error al generar archivo para planilla ${planilla.NombrePlanilla}:`, error);
                // Continuar con las demás planillas
            }
        }
        
        Swal.close();
        
        // Mostrar resumen de archivos generados
        await mostrarResumenGeneracion(archivosGenerados, carpetaSeleccionada);
        
    } catch (error) {
        console.error('Error al generar Excel:', error);
        
        Swal.close();
        
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al generar los archivos Excel. Por favor intente nuevamente.'
        });
    }
}
async function seleccionarCarpetaDestino() {
    try {
        // Usar la API de Electron para mostrar el diálogo de selección de carpeta
        const { ipcRenderer } = require('electron');
        
        const result = await ipcRenderer.invoke('show-save-dialog', {
            title: 'Seleccionar carpeta para guardar archivos Excel',
            buttonLabel: 'Seleccionar Carpeta',
            properties: ['openDirectory', 'createDirectory']
        });
        
        if (result.canceled) {
            return null;
        }
        
        return result.filePath;
        
    } catch (error) {
        // Fallback: usar un directorio por defecto si hay problemas con el diálogo
        console.warn('No se pudo mostrar diálogo de carpeta, usando directorio por defecto:', error);
        
        const { app } = require('electron').remote || require('@electron/remote');
        const path = require('path');
        const os = require('os');
        
        // Carpeta de documentos del usuario
        const carpetaPorDefecto = path.join(os.homedir(), 'Documents', 'Reportes_Nomina');
        
        // Crear carpeta si no existe
        const fs = require('fs');
        if (!fs.existsSync(carpetaPorDefecto)) {
            fs.mkdirSync(carpetaPorDefecto, { recursive: true });
        }
        
        // Mostrar confirmación al usuario
        const { value: confirmed } = await Swal.fire({
            title: 'Carpeta de destino',
            html: `
                <p>Los archivos se guardarán en:</p>
                <p style="font-family: monospace; background: #f5f5f5; padding: 8px; border-radius: 4px; word-break: break-all;">
                    ${carpetaPorDefecto}
                </p>
                <p>¿Desea continuar?</p>
            `,
            showCancelButton: true,
            confirmButtonText: 'Continuar',
            cancelButtonText: 'Cancelar'
        });
        
        return confirmed ? carpetaPorDefecto : null;
    }
}
function limpiarNombreArchivo(nombre) {
    if (!nombre) return 'Sin_Nombre';
    
    return nombre
        .replace(/[<>:"/\\|?*]/g, '') // Remover caracteres no válidos
        .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
        .replace(/_{2,}/g, '_') // Reemplazar múltiples guiones bajos con uno solo
        .substring(0, 50); // Limitar longitud
}
async function mostrarResumenGeneracion(archivosGenerados, carpeta) {
    let html = `
        <div style="text-align: left;">
            <p><strong>Se generaron ${archivosGenerados.length} archivo(s) Excel exitosamente</strong></p>
            <p><strong>Ubicación:</strong></p>
            <p style="font-family: monospace; background: #f5f5f5; padding: 8px; border-radius: 4px; word-break: break-all; margin-bottom: 15px;">
                ${carpeta}
            </p>
            <p><strong>Archivos generados:</strong></p>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;">
    `;
    
    archivosGenerados.forEach((archivo, index) => {
        html += `
            <div style="margin-bottom: 8px; padding: 8px; background: ${index % 2 === 0 ? '#f9f9f9' : 'white'}; border-radius: 3px;">
                <div style="font-weight: bold; color: #FF9800;">${archivo.division || 'División'}</div>
                <div style="font-size: 14px;">${archivo.planilla}</div>
                <div style="font-size: 12px; color: #666; font-family: monospace;">${archivo.nombre}</div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    await Swal.fire({
        icon: 'success',
        title: 'Archivos Excel Generados',
        html: html,
        width: 600,
        confirmButtonText: 'Entendido',
        footer: `
            <div style="text-align: left; margin-top: 10px;">
                <small style="color: #666;">
                    💡 Consejo: Puede abrir la carpeta desde el explorador de archivos para acceder a los reportes.
                </small>
            </div>
        `
    });
}
async function crearHojaPlanilla(planilla, formValues, nombresMeses) {
    const data = [];
    let filaActual = 0;
    
    // Determinar si es fin de mes
    const esFinDeMes = formValues.tipoQuincena === 'finMes';
    
    // Título principal
    const tituloCompleto = planilla.NombreDivision 
        ? `${planilla.NombreDivision} - ${planilla.NombrePlanilla}`
        : planilla.NombrePlanilla;
    data[filaActual++] = [tituloCompleto, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    
    // Información de la planilla
    const tipoTexto = esFinDeMes ? 'Planilla Fin de Mes' : 'Planilla Quincenal';
    data[filaActual++] = [`Tipo de Quincena: ${tipoTexto}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    
    // Período
    const mesNombre = nombresMeses[planilla.Mes - 1];
    let periodo = '';
    if (esFinDeMes) {
        const ultimoDia = obtenerUltimoDiaMes(planilla.Mes, planilla.Anyo);
        periodo = `Del 16 al ${ultimoDia} de ${mesNombre} ${planilla.Anyo}`;
    } else {
        periodo = `Del 1 al 15 de ${mesNombre} ${planilla.Anyo}`;
    }
    data[filaActual++] = [`Período: ${periodo}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    
    data[filaActual++] = [`No. Centro de Trabajo: ${planilla.NoCentroTrabajo || 'No especificado'}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    
    // CONTAR GÉNERO CON FORMATO COMPLETO
    let masculinos = 0;
    let femeninos = 0;
    
    if (planilla.detalles && planilla.detalles.length > 0) {
        planilla.detalles.forEach(empleado => {
            if (empleado.Sexo === 'M') {
                masculinos++;
            } else if (empleado.Sexo === 'F') {
                femeninos++;
            }
        });
    }
    
    data[filaActual++] = [`Cantidad de Colaboradores: ${planilla.CantColaboradores} (Masculino: ${masculinos}, Femenino: ${femeninos})`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    
    // Encabezados de la tabla
    if (esFinDeMes) {
        data[filaActual++] = [
            'No.', 
            'Nombre Completo',
            'Salario Diario',
            'Días Quincena',
            'Desc. Judicial Quincena', 
            'Total Pagado Quincena',
            'Días Fin de Mes',
            'Total Pagado Fin de Mes',
            'Total Días',
            'Total Pagado Mes',
            'Bonificación',
            'Sueldo Total',
            'IGSS',
            'Desc. Judicial Fin de Mes',
            'Total Pagado Fin de Mes Final',
            'Cuenta División 1',
            'Cuenta División 2',
            'Cuenta División 3',
            'Observaciones'
        ];
    } else {
        data[filaActual++] = [
            'No.', 
            'Nombre Completo', 
            'Salario Diario', 
            'Días Laborados', 
            'Descuento Judicial', 
            'Total a Pagar', 
            'Cuenta División 1',
            'Cuenta División 2', 
            'Cuenta División 3',
            'Observaciones'
        ];
    }
    
    // FUNCIÓN AUXILIAR PARA FORMATEAR A 2 DECIMALES
    const formatearDecimales = (valor) => {
        return parseFloat(parseFloat(valor || 0).toFixed(2));
    };
    
    // Datos de empleados
    let totalPlanilla = 0;
    let totalBonificaciones = 0;
    let totalIGSS = 0;
    let totalDescuentosQ1 = 0;
    let totalDescuentosQ2 = 0;
    let totalDiasQ1 = 0;
    let totalDiasQ2 = 0;
    let totalPagadoQ1 = 0;
    let totalPagadoQ2 = 0;
    let totalSueldoTotal = 0;
    let totalPagadoFinalQ2 = 0;
    
    if (planilla.detalles && planilla.detalles.length > 0) {
        for (let j = 0; j < planilla.detalles.length; j++) {
            const empleado = planilla.detalles[j];
            const numeroConsecutivo = j + 1;
            
            // Obtener observaciones para este empleado
            const observaciones = await obtenerObservacionesEmpleado(
                empleado.IdPersonal, 
                planilla.Mes, 
                planilla.Anyo, 
                formValues.tipoQuincena
            );
            
            if (esFinDeMes) {
                // DATOS REORDENADOS PARA FIN DE MES
                
                const datosQ1 = await obtenerDatosQuincenaAnterior(empleado.IdPersonal, planilla.Mes, planilla.Anyo);
                
                const diasQ2 = parseInt(empleado.DiasLaborados);
                const bonificacion = formatearDecimales(empleado.Bonificacion);
                const igss = formatearDecimales(empleado.PagoIGSS);
                const montoPagadoQ2Inicial = formatearDecimales(empleado.MontoPagado);
                
                const salarioCalculadoQ2 = formatearDecimales(parseFloat(empleado.SalarioDiario) * diasQ2);
                const sueldoTotal = formatearDecimales(salarioCalculadoQ2 + bonificacion);
                
                let descuentoJudicialQ2 = 0;
                if (empleado.DescuentoJudicial && parseFloat(empleado.DescuentoJudicial) > 0) {
                    descuentoJudicialQ2 = formatearDecimales(empleado.DescuentoJudicial);
                } else {
                    const calculado = Math.max(0, sueldoTotal - igss - montoPagadoQ2Inicial);
                    descuentoJudicialQ2 = formatearDecimales(calculado > 0.01 ? calculado : 0);
                }
                
                const totalPagadoFinalQ2Empleado = formatearDecimales(Math.max(0, sueldoTotal - igss - descuentoJudicialQ2));
                const totalPagadoMes = formatearDecimales(datosQ1.montoPagado + salarioCalculadoQ2);
                const totalDiasMes = datosQ1.diasLaborados + diasQ2;
                
                // Acumular totales (también formateados)
                totalDiasQ1 += datosQ1.diasLaborados;
                totalDiasQ2 += diasQ2;
                totalBonificaciones += bonificacion;
                totalIGSS += igss;
                totalDescuentosQ1 += formatearDecimales(datosQ1.descuentoJudicial);
                totalDescuentosQ2 += descuentoJudicialQ2;
                totalPagadoQ1 += formatearDecimales(datosQ1.montoPagado);
                totalPagadoQ2 += salarioCalculadoQ2;
                totalSueldoTotal += sueldoTotal;
                totalPagadoFinalQ2 += totalPagadoFinalQ2Empleado;
                totalPlanilla += totalPagadoFinalQ2Empleado;
                
                // Crear fila con datos FORMATEADOS A 2 DECIMALES (19 columnas)
                data[filaActual++] = [
                    numeroConsecutivo,                              // No.
                    empleado.NombrePersonal,                        // Nombre Completo
                    formatearDecimales(empleado.SalarioDiario),    // Salario Diario
                    datosQ1.diasLaborados,                         // Días Quincena
                    formatearDecimales(datosQ1.descuentoJudicial), // Desc. Judicial Quincena
                    formatearDecimales(datosQ1.montoPagado),       // Total Pagado Quincena
                    diasQ2,                                        // Días Fin de Mes
                    salarioCalculadoQ2,                            // Total Pagado Fin de Mes
                    totalDiasMes,                                  // Total Días
                    totalPagadoMes,                                // Total Pagado Mes
                    bonificacion,                                  // Bonificación
                    sueldoTotal,                                   // Sueldo Total
                    igss,                                          // IGSS
                    descuentoJudicialQ2,                          // Desc. Judicial Fin de Mes
                    totalPagadoFinalQ2Empleado,                   // Total Pagado Fin de Mes Final
                    empleado.NoCuentaDivision1 || '',             // Cuenta División 1
                    empleado.NoCuentaDivision2 || '',             // Cuenta División 2
                    empleado.NoCuentaDivision3 || '',             // Cuenta División 3
                    observaciones                                  // Observaciones
                ];
            } else {
                // DATOS PARA QUINCENAL (FORMATEADOS A 2 DECIMALES) (10 columnas)
                const salarioProporcional = formatearDecimales((empleado.SalarioQuincenal / 15) * empleado.DiasLaborados);
                const descuentoJudicial = formatearDecimales(Math.max(0, salarioProporcional - empleado.MontoPagado));
                
                totalDescuentosQ1 += descuentoJudicial;
                totalPlanilla += formatearDecimales(empleado.MontoPagado);
                
                data[filaActual++] = [
                    numeroConsecutivo,
                    empleado.NombrePersonal,
                    formatearDecimales(empleado.SalarioDiario),
                    empleado.DiasLaborados,
                    descuentoJudicial,
                    formatearDecimales(empleado.MontoPagado),
                    empleado.NoCuentaDivision1 || '',             // Cuenta División 1
                    empleado.NoCuentaDivision2 || '',             // Cuenta División 2
                    empleado.NoCuentaDivision3 || '',             // Cuenta División 3
                    observaciones
                ];
            }
        }
    }
    
    // FORMATEAR TODOS LOS TOTALES A 2 DECIMALES
    totalBonificaciones = formatearDecimales(totalBonificaciones);
    totalIGSS = formatearDecimales(totalIGSS);
    totalDescuentosQ1 = formatearDecimales(totalDescuentosQ1);
    totalDescuentosQ2 = formatearDecimales(totalDescuentosQ2);
    totalPagadoQ1 = formatearDecimales(totalPagadoQ1);
    totalPagadoQ2 = formatearDecimales(totalPagadoQ2);
    totalSueldoTotal = formatearDecimales(totalSueldoTotal);
    totalPagadoFinalQ2 = formatearDecimales(totalPagadoFinalQ2);
    totalPlanilla = formatearDecimales(totalPlanilla);
    
    // =========== FILAS DE TOTALES CORREGIDAS ===========
    if (esFinDeMes) {
        // Fila vacía de separación
        data[filaActual++] = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        
        // FILA DE TOTALES ALINEADA CORRECTAMENTE PARA FIN DE MES
        data[filaActual++] = [
            '',                          // No. (vacío)
            'TOTALES:',                  // Nombre Completo
            '',                          // Salario Diario (vacío)
            totalDiasQ1,                 // Días Quincena
            totalDescuentosQ1,           // Desc. Judicial Quincena
            totalPagadoQ1,               // Total Pagado Quincena
            totalDiasQ2,                 // Días Fin de Mes
            totalPagadoQ2,               // Total Pagado Fin de Mes
            totalDiasQ1 + totalDiasQ2,   // Total Días
            totalPlanilla,               // Total Pagado Mes
            totalBonificaciones,         // Bonificación
            totalSueldoTotal,            // Sueldo Total
            totalIGSS,                   // IGSS
            totalDescuentosQ2,           // Desc. Judicial Fin de Mes
            totalPagadoFinalQ2,          // Total Pagado Fin de Mes Final
            '',                          // Cuenta División 1 (vacío)
            '',                          // Cuenta División 2 (vacío)
            '',                          // Cuenta División 3 (vacío)
            `Masculino: ${masculinos}, Femenino: ${femeninos}` // Observaciones
        ];
        
    } else {
        // Fila vacía de separación
        data[filaActual++] = ['', '', '', '', '', '', '', '', '', ''];
        
        // FILA DE TOTALES ALINEADA CORRECTAMENTE PARA QUINCENAL
        data[filaActual++] = [
            '',                          // No. (vacío)
            'TOTALES:',                  // Nombre Completo
            '',                          // Salario Diario (vacío)
            '',                          // Días Laborados (vacío)
            totalDescuentosQ1,           // Descuento Judicial
            totalPlanilla,               // Total a Pagar
            '',                          // Cuenta División 1 (vacío)
            '',                          // Cuenta División 2 (vacío)
            '',                          // Cuenta División 3 (vacío)
            `Masculino: ${masculinos}, Femenino: ${femeninos}` // Observaciones
        ];
    }
    
    return data;
}
// Función actualizada para aplicar estilos al Excel (con nuevas columnas)
function aplicarEstilosExcel(worksheet, planilla) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Determinar si es fin de mes para ajustar anchos de columna
    const esFinDeMes = planilla.TipoPago.includes('Fin de Mes');
    
    // Configurar anchos de columna según el tipo
    if (esFinDeMes) {
        // Anchos para FIN DE MES (19 columnas)
        worksheet['!cols'] = [
            { wch: 6 },   // No.
            { wch: 25 },  // Nombre Completo
            { wch: 10 },  // Salario Diario
            { wch: 8 },   // Días Quincena
            { wch: 12 },  // Desc. Judicial Quincena
            { wch: 12 },  // Total Pagado Quincena
            { wch: 8 },   // Días Fin de Mes
            { wch: 12 },  // Total Pagado Fin de Mes
            { wch: 8 },   // Total Días
            { wch: 12 },  // Total Pagado Mes
            { wch: 12 },  // Bonificación
            { wch: 12 },  // Sueldo Total
            { wch: 10 },  // IGSS
            { wch: 12 },  // Desc. Judicial Fin de Mes
            { wch: 14 },  // Total Pagado Fin de Mes Final
            { wch: 15 },  // Cuenta División 1
            { wch: 15 },  // Cuenta División 2
            { wch: 15 },  // Cuenta División 3
            { wch: 20 }   // Observaciones
        ];
    } else {
        // Anchos para QUINCENAL (10 columnas)
        worksheet['!cols'] = [
            { wch: 8 },   // No.
            { wch: 35 },  // Nombre Completo
            { wch: 15 },  // Salario Diario
            { wch: 15 },  // Días Laborados
            { wch: 18 },  // Descuento Judicial
            { wch: 15 },  // Total a Pagar
            { wch: 18 },  // Cuenta División 1
            { wch: 18 },  // Cuenta División 2
            { wch: 18 },  // Cuenta División 3
            { wch: 25 }   // Observaciones
        ];
    }
    
    // Aplicar estilos a las celdas
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            
            if (!worksheet[cellAddress]) {
                worksheet[cellAddress] = { t: 's', v: '' };
            }
            
            const cell = worksheet[cellAddress];
            
            // INFORMACIÓN DE LA PLANILLA (filas 1-4) - CENTRADO Y NEGRITA
            if (R >= 1 && R <= 4) {
                cell.s = {
                    font: {
                        name: "Calibri",
                        sz: 12,
                        bold: 1,
                        color: { rgb: "000000" }
                    },
                    alignment: {
                        horizontal: "center",
                        vertical: "center"
                    },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
            }
            // TÍTULO PRINCIPAL (fila 0)
            else if (R === 0) {
                cell.s = {
                    font: {
                        name: "Calibri",
                        sz: 14,
                        bold: 1,
                        color: { rgb: "000000" }
                    },
                    alignment: {
                        horizontal: "center",
                        vertical: "center"
                    },
                    border: {
                        top: { style: "medium", color: { rgb: "000000" } },
                        bottom: { style: "medium", color: { rgb: "000000" } },
                        left: { style: "medium", color: { rgb: "000000" } },
                        right: { style: "medium", color: { rgb: "000000" } }
                    }
                };
            }
            // ENCABEZADOS (fila 5)
            else if (R === 5) {
                // Determinar color según la sección para fin de mes
                let headerColor = "D18A47"; // Color por defecto
                
                if (esFinDeMes) {
                    if (C >= 3 && C <= 5) {
                        headerColor = "4CAF50"; // Verde para Quincena 1
                    } else if (C >= 6 && C <= 7) {
                        headerColor = "2196F3"; // Azul para Fin de Mes
                    } else if (C >= 8 && C <= 14) {
                        headerColor = "FF5722"; // Naranja para Totales y cálculos
                    } else if (C >= 15 && C <= 16) {
                        headerColor = "9C27B0"; // Púrpura para datos finales
                    }
                }
                
                cell.s = {
                    font: {
                        name: "Calibri",
                        sz: 10,
                        bold: 1,
                        color: { rgb: "FFFFFF" }
                    },
                    alignment: {
                        horizontal: "center",
                        vertical: "center"
                    },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    },
                    fill: {
                        fgColor: { rgb: headerColor }
                    }
                };
            }
            // DATOS DE EMPLEADOS Y TOTALES
            else if (R > 5) {
                const esFilaPar = (R - 6) % 2 === 0;
                const fillColor = esFilaPar ? "FFFFFF" : "FDF2E9";
                
                // Detectar filas de totales
                const esTotalRow = cell.v && (
                    cell.v.toString().includes('TOTAL') || 
                    (typeof cell.v === 'string' && cell.v.startsWith('TOTAL'))
                );
                
                if (esTotalRow) {
                    // Estilo para filas de totales
                    cell.s = {
                        font: {
                            name: "Calibri",
                            sz: 11,
                            bold: 1,
                            color: { rgb: "000000" }
                        },
                        alignment: {
                            horizontal: "center",
                            vertical: "center"
                        },
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        },
                        fill: {
                            fgColor: { rgb: "E8F5E8" }
                        }
                    };
                } else {
                    // Estilo para datos normales
                    let alignment = "center";
                    
                    // Alineación específica para ciertas columnas
                    if (esFinDeMes) {
                        if (C === 1 || C === 15 || C === 16) {
                            alignment = "left"; // Nombre, No. Cuenta, Observaciones
                        }
                    } else {
                        if (C === 1 || C === 6 || C === 7) {
                            alignment = "left"; // Nombre, No. Cuenta, Observaciones
                        }
                    }
                    
                    cell.s = {
                        font: {
                            name: "Calibri",
                            sz: 9,
                            bold: 0,
                            color: { rgb: "000000" }
                        },
                        alignment: {
                            horizontal: alignment,
                            vertical: "center"
                        },
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        },
                        fill: {
                            fgColor: { rgb: fillColor }
                        }
                    };
                    
                    // Formato numérico para columnas monetarias y numéricas
                    if (esFinDeMes) {
                        // Columnas numéricas en formato reordenado
                        if ([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(C)) {
                            cell.s.numFmt = "#,##0.00";
                        }
                    } else {
                        // Columnas numéricas en formato normal
                        if ([2, 3, 4, 5].includes(C)) {
                            cell.s.numFmt = "#,##0.00";
                        }
                    }
                }
            }
        }
    }
    
    // Combinar celdas para títulos (ajustar según número de columnas)
    const maxCol = esFinDeMes ? 16 : 7;
    worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: maxCol } }, // Título
        { s: { r: 1, c: 0 }, e: { r: 1, c: maxCol } }, // Tipo de Quincena
        { s: { r: 2, c: 0 }, e: { r: 2, c: maxCol } }, // Período
        { s: { r: 3, c: 0 }, e: { r: 3, c: maxCol } }, // Centro de Trabajo
        { s: { r: 4, c: 0 }, e: { r: 4, c: maxCol } }  // Cantidad de Colaboradores
    ];
    
    // Altura de filas
    worksheet['!rows'] = [
        { hpt: 25 }, // 0: Título
        { hpt: 22 }, // 1: Tipo de quincena
        { hpt: 22 }, // 2: Período
        { hpt: 22 }, // 3: Centro de trabajo
        { hpt: 22 }, // 4: Cantidad de colaboradores
        { hpt: 25 }  // 5: Encabezados
    ];
    
    for (let i = 6; i <= range.e.r; i++) {
        if (!worksheet['!rows'][i]) {
            worksheet['!rows'][i] = { hpt: 20 };
        }
    }
}
async function obtenerObservacionesEmpleado(idPersonal, mes, anio, tipoQuincena) {
    try {
        const connection = await connectionString();
        const observaciones = [];
        
        // Determinar fechas de inicio y fin de la quincena
        let inicioQuincena, finQuincena;
        
        if (tipoQuincena === 'normal') {
            // Primera quincena: del 1 al 15
            inicioQuincena = `${anio}-${mes.toString().padStart(2, '0')}-01`;
            finQuincena = `${anio}-${mes.toString().padStart(2, '0')}-15`;
        } else {
            // Segunda quincena: del 16 al 30 (mes comercial)
            inicioQuincena = `${anio}-${mes.toString().padStart(2, '0')}-16`;

            // Mes comercial: usar el mínimo entre 30 y el último día real (para febrero)
            const ultimoDiaReal = new Date(anio, parseInt(mes), 0).getDate();
            const diaFinComercial = Math.min(30, ultimoDiaReal);
            finQuincena = `${anio}-${mes.toString().padStart(2, '0')}-${diaFinComercial}`;
        }

        // FUNCIÓN AUXILIAR CORREGIDA PARA FORMATEAR FECHAS LOCALMENTE
        function formatearFechaLocal(fecha) {
            if (!fecha) return '';
            
            let fechaObj;
            
            // Si es string, parsearlo como fecha local
            if (typeof fecha === 'string') {
                // Tomar solo la parte de fecha (YYYY-MM-DD)
                const soloFecha = fecha.split('T')[0];
                const partes = soloFecha.split('-');
                // Crear fecha local evitando problemas de zona horaria
                fechaObj = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]), 12, 0, 0);
            } else if (fecha instanceof Date) {
                fechaObj = fecha;
            } else {
                return '';
            }
            
            const dia = fechaObj.getDate().toString().padStart(2, '0');
            const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
            const anio = fechaObj.getFullYear();
            
            return `${dia}-${mes}-${anio}`;
        }
        
        // 1. VERIFICAR BAJAS (DespidosRenuncias) - CORREGIDO
        const queryBajas = `
            SELECT 
                DATE(FechaFinColaborador) as FechaFinColaborador,
                IdEstadoPersonal
            FROM 
                DespidosRenuncias
            WHERE 
                IdPersonal = ? 
                AND DATE(FechaFinColaborador) >= ? 
                AND DATE(FechaFinColaborador) <= ? AND
                Estado = 1
        `;
        
        const bajas = await connection.query(queryBajas, [idPersonal, inicioQuincena, finQuincena]);
        
        if (bajas.length > 0) {
            const baja = bajas[0];
            const fechaFormateada = formatearFechaLocal(baja.FechaFinColaborador);
            observaciones.push(`B.${fechaFormateada}`);
        }
        
        // 2. VERIFICAR ALTAS (FechaPlanilla en tabla personal) - CORREGIDO
        const queryAltas = `
            SELECT 
                DATE(FechaPlanilla) as FechaPlanilla
            FROM 
                personal
            WHERE 
                IdPersonal = ? 
                AND DATE(FechaPlanilla) >= ? 
                AND DATE(FechaPlanilla) <= ?
        `;
        
        const altas = await connection.query(queryAltas, [idPersonal, inicioQuincena, finQuincena]);
        
        if (altas.length > 0) {
            const alta = altas[0];
            const fechaFormateada = formatearFechaLocal(alta.FechaPlanilla);
            observaciones.push(`A.${fechaFormateada}`);
        }
        
        // 3. VERIFICAR SUSPENSIONES Y FALTAS - MODIFICADO PARA DIFERENCIAR
        const querySuspensionesFaltas = `
            SELECT 
                DATE(FechaInicio) as FechaInicio,
                DATE(FechaFin) as FechaFin,
                EsFalta,
                ObservacionFalta
            FROM 
                Suspensiones
            WHERE 
                IdPersonal = ? 
                AND DATE(FechaInicio) <= ? 
                AND DATE(FechaFin) >= ?
            ORDER BY
                FechaInicio
        `;
        
        const suspensionesFaltas = await connection.query(querySuspensionesFaltas, [idPersonal, finQuincena, inicioQuincena]);
        
        if (suspensionesFaltas.length > 0) {
            suspensionesFaltas.forEach(item => {
                // Crear fechas locales evitando problemas de zona horaria
                const fechaInicioLocal = new Date(item.FechaInicio + 'T12:00:00');
                const fechaFinLocal = new Date(item.FechaFin + 'T12:00:00');
                const inicioQuincenaDate = new Date(inicioQuincena + 'T12:00:00');
                const finQuincenaDate = new Date(finQuincena + 'T12:00:00');
                
                // Calcular fechas efectivas dentro de la quincena
                const inicioEfectivo = fechaInicioLocal < inicioQuincenaDate ? inicioQuincenaDate : fechaInicioLocal;
                const finEfectivo = fechaFinLocal > finQuincenaDate ? finQuincenaDate : fechaFinLocal;
                
                const fechaInicioFormateada = formatearFechaLocal(inicioEfectivo);
                const fechaFinFormateada = formatearFechaLocal(finEfectivo);
                
                // Diferenciar entre suspensión y falta
                if (item.EsFalta === 1) {
                    // Es una falta
                    if (fechaInicioFormateada === fechaFinFormateada) {
                        // Un solo día
                        observaciones.push(`F.${fechaInicioFormateada}`);
                    } else {
                        // Rango de días
                        observaciones.push(`F.${fechaInicioFormateada} al ${fechaFinFormateada}`);
                    }
                } else {
                    // Es una suspensión (EsFalta = 0)
                    if (fechaInicioFormateada === fechaFinFormateada) {
                        // Un solo día
                        observaciones.push(`S-IGSS.${fechaInicioFormateada}`);
                    } else {
                        // Rango de días
                        observaciones.push(`S-IGSS.${fechaInicioFormateada} al ${fechaFinFormateada}`);
                    }
                }
            });
        }
        
        await connection.close();
        
        // Retornar observaciones separadas por comas o vacío si no hay
        return observaciones.length > 0 ? observaciones.join(', ') : '';
        
    } catch (error) {
        console.error('Error al obtener observaciones:', error);
        return '';
    }
}
async function obtenerDatosQuincenaAnterior(idPersonal, mes, anio) {
    try {
        const connection = await connectionString();
        
        // Consulta para obtener datos de la quincena anterior (IdTipoPago = 1)
        const query = `
            SELECT 
                ppd.DiasLaborados,
                ppd.SubTotalPagar,
                ppd.MontoPagado,
                COALESCE((
                    SELECT SUM(djd.Descuento)
                    FROM DescuentosJudicialesDetalle djd
                    INNER JOIN DescuentosJudiciales dj ON djd.IdDescuentoJudicial = dj.IdDescuentoJudicial
                    WHERE dj.IdPersonal = ppd.IdPersonal 
                    AND djd.IdPagoPlanilla = ppd.IdPagoPlanilla
                ), 0) AS DescuentoJudicial
            FROM 
                PagoPlanillaDetalle ppd
                INNER JOIN PagoPlanilla pp ON ppd.IdPagoPlanilla = pp.IdPagoPlanilla
            WHERE 
                ppd.IdPersonal = ?
                AND pp.IdTipoPago = 1
                AND pp.Mes = ?
                AND pp.Anyo = ?
        `;
        
        const resultado = await connection.query(query, [idPersonal, mes, anio]);
        await connection.close();
        
        if (resultado.length > 0) {
            return {
                diasLaborados: parseInt(resultado[0].DiasLaborados) || 0,
                subTotalPagar: parseFloat(resultado[0].SubTotalPagar) || 0,
                montoPagado: parseFloat(resultado[0].MontoPagado) || 0,
                descuentoJudicial: parseFloat(resultado[0].DescuentoJudicial) || 0
            };
        }
        
        return {
            diasLaborados: 0,
            subTotalPagar: 0,
            montoPagado: 0,
            descuentoJudicial: 0
        };
        
    } catch (error) {
        console.error('Error al obtener datos de quincena anterior:', error);
        return {
            diasLaborados: 0,
            subTotalPagar: 0,
            montoPagado: 0,
            descuentoJudicial: 0
        };
    }
}
function inicializarSistemaAyuda() {
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const closeModalHelp = document.querySelector('.close-modal-help');
    
    // Abrir modal de ayuda
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            helpModal.style.display = 'block';
        });
    }
    
    // Cerrar modal de ayuda
    [closeHelpBtn, closeModalHelp].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                helpModal.style.display = 'none';
            });
        }
    });
    
    // Cerrar al hacer clic fuera del modal
    window.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });
    
    // Navegación entre secciones de ayuda (solo 3 secciones ahora)
    const helpNavBtns = document.querySelectorAll('.help-nav-btn');
    const helpSections = document.querySelectorAll('.help-section');
    
    helpNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSection = btn.getAttribute('data-help');
            
            // Remover clases activas
            helpNavBtns.forEach(b => b.classList.remove('active'));
            helpSections.forEach(s => s.classList.remove('active'));
            
            // Activar sección seleccionada
            btn.classList.add('active');
            document.getElementById(`help-${targetSection}`).classList.add('active');
        });
    });
}
function calcularYMostrarTotal(datos) {
    const filtersSummary = document.getElementById('filtersSummary');
    const totalColaboradores = document.getElementById('totalColaboradores');
    const totalPlanillaAmount = document.getElementById('totalPlanillaAmount');

    if (!datos || datos.length === 0) {
        // Ocultar el resumen si no hay datos
        if (filtersSummary) filtersSummary.style.display = 'none';
        return;
    }

    // Calcular total de planilla
    const total = datos.reduce((sum, emp) => sum + parseFloat(emp.SalarioFinalAPagar || 0), 0);
    const totalFormateado = formatearMoneda(total);

    // Actualizar número de colaboradores
    if (totalColaboradores) {
        totalColaboradores.textContent = datos.length;
    }

    // Actualizar total de planilla
    if (totalPlanillaAmount) {
        totalPlanillaAmount.textContent = totalFormateado;
    }

    // Mostrar el resumen
    if (filtersSummary) {
        filtersSummary.style.display = 'flex';
    }
}
function ocultarTotal() {
    const totalContainer = document.getElementById('totalPlanillaContainer');
    if (totalContainer) {
        totalContainer.style.display = 'none';
    }
}
async function obtenerDetallesSuspensionesFaltas(idPersonal, mes, anio, tipoQuincena) {
    try {
        const connection = await connectionString();
        
        // Determinar fechas de inicio y fin de la quincena
        let inicioQuincena, finQuincena;
        
        if (tipoQuincena === 'normal') {
            inicioQuincena = `${anio}-${mes.padStart(2, '0')}-01`;
            finQuincena = `${anio}-${mes.padStart(2, '0')}-15`;
        } else {
            // Segunda quincena: del 16 al 30 (mes comercial)
            inicioQuincena = `${anio}-${mes.padStart(2, '0')}-16`;

            // Mes comercial: usar el mínimo entre 30 y el último día real (para febrero)
            const ultimoDiaReal = new Date(anio, parseInt(mes), 0).getDate();
            const diaFinComercial = Math.min(30, ultimoDiaReal);
            finQuincena = `${anio}-${mes.padStart(2, '0')}-${diaFinComercial}`;
        }

        // Consulta para obtener detalles separados de suspensiones y faltas
        const query = `
            SELECT 
                EsFalta,
                SUM(
                    DATEDIFF(
                        LEAST(FechaFin, ?), 
                        GREATEST(FechaInicio, ?)
                    ) + 1
                ) AS Dias
            FROM 
                Suspensiones
            WHERE 
                IdPersonal = ? 
                AND FechaInicio <= ? 
                AND FechaFin >= ?
            GROUP BY 
                EsFalta
        `;
        
        const params = [finQuincena, inicioQuincena, idPersonal, finQuincena, inicioQuincena];
        const results = await connection.query(query, params);
        await connection.close();
        
        let diasSuspension = 0;
        let diasFalta = 0;
        
        results.forEach(row => {
            if (row.EsFalta === 0) {
                diasSuspension = parseInt(row.Dias) || 0;
            } else if (row.EsFalta === 1) {
                diasFalta = parseInt(row.Dias) || 0;
            }
        });
        
        return {
            diasSuspension,
            diasFalta,
            totalDias: diasSuspension + diasFalta
        };
        
    } catch (error) {
        console.error('Error al obtener detalles de suspensiones y faltas:', error);
        return { diasSuspension: 0, diasFalta: 0, totalDias: 0 };
    }
}
function formatearMoneda(valor) {
    if (valor === null || valor === undefined) return 'Q0.00';
    const valorFormateado = parseFloat(valor).toFixed(2);
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 2
    }).format(valor);
}
// Eventos al cargar la página
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Obtener el usuario actual del localStorage
        const userData = JSON.parse(localStorage.getItem('userData')) || {};
        
        // Configurar datos del usuario en la interfaz
        if (userData) {
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = userData.NombreCompleto || 'Usuario';
            }
            
            const userRoleElement = document.getElementById('userRole');
            if (userRoleElement) {
                userRoleElement.textContent = determinarRol(userData.Id_Puesto) || 'Colaborador';
            }
            
            const userImageElement = document.getElementById('userImage');
            if (userImageElement && userData.FotoBase64) {
                userImageElement.src = userData.FotoBase64;
            }
        }
        
        // Llenar años en el filtro principal
        const anioFilter = document.getElementById('anioFilter');
        const currentYear = new Date().getFullYear();
        
        if (anioFilter) {
            for (let year = 2020; year <= currentYear + 1; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                if (year === currentYear) {
                    option.selected = true;
                }
                anioFilter.appendChild(option);
            }
        }
        
        // Establecer mes actual seleccionado por defecto
        const currentMonth = new Date().getMonth() + 1;
        const mesFilter = document.getElementById('mesFilter');
        if (mesFilter) {
            mesFilter.value = currentMonth;
        }
        
        // Cargar planillas desde la base de datos
        await cargarPlanillas();
        
        // Agregar eventos principales
        addEventIfElementExists('applyFilters', 'click', cargarDatosNomina);
        addEventIfElementExists('pdfBtn', 'click', generarPDF);
        addEventIfElementExists('exportBtn', 'click', generarExcel);
        addEventIfElementExists('saveBtn', 'click', guardarPlanilla);
        
        // Configurar switch de tema
        const themeSwitchElement = document.getElementById('themeSwitch');
        if (themeSwitchElement) {
            themeSwitchElement.addEventListener('change', function(e) {
                if (e.target.checked) {
                    document.body.classList.add('dark-theme');
                    localStorage.setItem('theme', 'dark');
                } else {
                    document.body.classList.remove('dark-theme');
                    localStorage.setItem('theme', 'light');
                }
            });
        }
        
        // Cargar preferencia de tema guardada
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
            if (themeSwitchElement) {
                themeSwitchElement.checked = true;
            }
        }
        
        inicializarSistemaAyuda();
    } catch (error) {
        console.error('Error al inicializar la página:', error);
    }
});