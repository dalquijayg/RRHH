const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const { writeFile } = require('fs').promises;
const XLSX = require('xlsx');
const Swal = require('sweetalert2');

// Variables para la paginación
let currentPage = 1;
const rowsPerPage = 10;
let totalRows = 0;
let filteredData = [];

// Variables para la sección de modificación
let planillasModificables = [];
let selectedPlanillaId = null;
let detallesPlanillaSeleccionada = [];
let cambiosRealizados = {};

// Variables para la sección de autorización
let planillasAutorizables = [];
let planillasSeleccionadas = new Set();
let datosAutorizacion = null;
let mapaAutorizaciones = new Map(); // NoCuenta -> NoAutorizacion
let detallesColaboradoresMap = new Map(); // IdPagoPlanilla -> [detalles de colaboradores]


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
            
            // Marcar visualmente las planillas ya guardadas
            if (yaGuardada) {
                option.textContent = `${planilla.Nombre_Planilla_Completo} (✓ Guardada)`;
                option.classList.add('planilla-guardada');
                option.setAttribute('data-guardada', 'true');
            } else {
                option.textContent = planilla.Nombre_Planilla_Completo;
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
        
        console.log('Filtros aplicados:', { planillaId, tipoQuincena, mes, anio });
        
        // Construir la consulta SQL para personal activo (MODIFICADA)
        let queryActivos = `
            SELECT
                personal.IdPersonal, 
                CONCAT(
                    personal.PrimerApellido, 
                    CASE WHEN personal.SegundoApellido IS NOT NULL AND personal.SegundoApellido != '' 
                         THEN CONCAT(' ', personal.SegundoApellido) 
                         ELSE '' 
                    END,
                    ', ',
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
                personal.SalarioDiario, 
                personal.SalarioQuincena, 
                personal.SalarioQuincenaFinMes,
                personal.Bonificacion,
                personal.SalarioBase,
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
        
        // Construir la consulta SQL para personal con bajas en el periodo (MODIFICADA)
        let queryBajas = `
            SELECT
                personal.IdPersonal, 
                CONCAT(
                    personal.PrimerApellido, 
                    CASE WHEN personal.SegundoApellido IS NOT NULL AND personal.SegundoApellido != '' 
                         THEN CONCAT(' ', personal.SegundoApellido) 
                         ELSE '' 
                    END,
                    ', ',
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
                personal.SalarioDiario, 
                personal.SalarioQuincena, 
                personal.SalarioQuincenaFinMes,
                personal.Bonificacion,
                personal.SalarioBase,
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
                INNER JOIN DespidosRenuncias dr ON personal.IdPersonal = dr.IdPersonal
            WHERE
                personal.TipoPersonal = 1 AND
                dr.IdEstadoPersonal IN (2, 3) AND
                dr.FechaFinColaborador >= ? AND
                dr.FechaFinColaborador <= ? AND
                dr.Estado = 1`;
        
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
        
        // Ordenar los resultados (MODIFICADO - ordenar por apellidos)
        queryActivos += ' ORDER BY divisiones.Nombre ASC, planillas.Nombre_Planilla ASC, personal.PrimerApellido ASC, personal.SegundoApellido ASC, personal.PrimerNombre ASC';
        queryBajas += ' ORDER BY divisiones.Nombre ASC, planillas.Nombre_Planilla ASC, personal.PrimerApellido ASC, personal.SegundoApellido ASC, personal.PrimerNombre ASC';
        
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
                // CORRECCIÓN AQUÍ: Usar la función auxiliar para evitar problemas de zona horaria
                const fechaFinColaborador = parsearFechaISO(empleado.FechaFinColaborador);
                const fechaInicioQuincena = parsearFechaISO(inicioQuincena);
                const fechaFinQuincena = parsearFechaISO(finQuincena);
                
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
            
            // USAR LA NUEVA FUNCIÓN PARA CALCULAR EL DESCUENTO CON INDICADORES
            const indicadoresDescuento = calcularDescuentoJudicialConIndicadores(
                descuentosJudiciales, 
                tipoQuincena, 
                diasLaborados, 
                diasTotalesQuincena
            );
            
            const montoDescuentoJudicial = indicadoresDescuento.montoDescuento;
            
            // Calcular el salario final a pagar (salario proporcional - descuento judicial)
            const salarioFinalAPagar = Math.max(0, salarioProporcional - montoDescuentoJudicial);
            
            // CORRECCIÓN AQUÍ: Formatear fecha correctamente sin problemas de zona horaria
            if (empleado.FechaFinColaborador) {
                empleado.FechaFinColaboradorFormateada = formatearFecha(empleado.FechaFinColaborador);
            } else {
                empleado.FechaFinColaboradorFormateada = null;
            }
            
            // Agregar los nuevos campos al objeto del empleado
            empleado.DiasLaborados = diasLaborados;
            empleado.DiasSuspendidos = diasSuspendidos;
            empleado.SalarioProporcional = salarioProporcional;
            empleado.DescuentoJudicial = montoDescuentoJudicial;
            empleado.NoDocumentoJudicial = descuentosJudiciales.NoDocumento;
            empleado.SalarioFinalAPagar = salarioFinalAPagar;
            empleado.IndicadoresDescuento = indicadoresDescuento;
            
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
// Función actualizada para renderizar la tabla con indicadores de bajas
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

// Función actualizada para renderizar la tabla con indicadores de descuentos
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
            
            // CORRECCIÓN AQUÍ: Agregar información específica al tooltip con fecha corregida
            if (empleado.TipoBaja && empleado.FechaFinColaboradorFormateada) {
                tooltipSuspension = `data-tooltip="${empleado.TipoBaja} el ${empleado.FechaFinColaboradorFormateada}. Días trabajados: ${empleado.DiasLaborados}"`;
            } else if (empleado.DiasSuspendidos > 0) {
                tooltipSuspension = `data-tooltip="El colaborador tiene ${empleado.DiasSuspendidos} día(s) suspendido(s)"`;
            }
        }
        
        // Determinar si el salario es reducido
        const claseSalario = empleado.DiasLaborados < diasQuincenaCompleta ? 'currency salario-reducido' : 'currency';
        
        // Preparar el tooltip y clases para descuentos judiciales
        let claseDescuentoJudicial = 'currency';
        let tooltipDescuento = '';
        let contenidoDescuento = descuentoJudicial;
        
        // Usar los nuevos indicadores de descuento judicial
        if (empleado.IndicadoresDescuento) {
            const indicadores = empleado.IndicadoresDescuento;
            
            if (indicadores.tieneDescuentoJudicial) {
                if (indicadores.aplicaDescuento) {
                    // Descuento aplicado normalmente
                    claseDescuentoJudicial += ' descuento-judicial';
                    tooltipDescuento = `data-tooltip="Embargo No. ${indicadores.numeroDocumento} - ${indicadores.indicadorVisual}"`;
                } else {
                    // Tiene descuento pero no se aplicó
                    claseDescuentoJudicial += ' descuento-no-aplicado';
                    tooltipDescuento = `data-tooltip="Embargo No. ${indicadores.numeroDocumento} - ${indicadores.indicadorVisual}. Motivo: ${indicadores.motivoNoAplica}"`;
                    contenidoDescuento = `<span class="descuento-suspendido">${descuentoJudicial} ${indicadores.indicadorVisual}</span>`;
                }
            }
        } else if (empleado.DescuentoJudicial > 0) {
            // Fallback para compatibilidad
            claseDescuentoJudicial += ' descuento-judicial';
            tooltipDescuento = `data-tooltip="Embargo No. ${empleado.NoDocumentoJudicial}"`;
        }
        
        // Clase adicional para filas de bajas
        let clasesFila = '';
        if (empleado.TipoBaja) {
            clasesFila = 'empleado-baja';
        }
        
        // CORRECCIÓN AQUÍ: Agregar indicador de tipo de baja en el nombre con fecha corregida
        let nombreCompleto = empleado.NombreCompleto;
        if (empleado.TipoBaja && empleado.FechaFinColaboradorFormateada) {
            nombreCompleto += ` <span class="indicador-baja" title="Fecha de baja: ${empleado.FechaFinColaboradorFormateada}">[${empleado.TipoBaja}]</span>`;
        }
        
        // Crear la fila
        const row = document.createElement('tr');
        row.className = clasesFila;
        row.innerHTML = `
            <td>${empleado.IdPersonal}</td>
            <td class="highlight">${nombreCompleto}</td>
            <td>${empleado.NombreDepartamento}</td>
            <td>${empleado.Nombre_Planilla_Completo}</td>
            <td>
                <span class="status-badge ${empleado.EsCapital ? 'capital' : 'regional'}">
                    ${empleado.EsCapital ? 'Capital' : 'Regional'}
                </span>
            </td>
            <td class="currency">${salarioDiario}</td>
            <td class="currency">${salarioQuincenal}</td>
            <td class="${claseDiasLaborados}" ${tooltipSuspension}>${empleado.DiasLaborados} / ${diasQuincenaCompleta}</td>
            <td class="${claseSalario}">${salarioProporcional}</td>
            <td class="${claseDescuentoJudicial}" ${tooltipDescuento}>${contenidoDescuento}</td>
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
    const valorFormateado = parseFloat(valor).toFixed(2);
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
        console.log("Planillas ya guardadas:", planillasGuardadas);
        
        // Obtener el valor del filtro de planilla
        const planillaFilterValue = document.getElementById('planillaFilter').value;
        
        // Obtener datos según filtros
        let datosCompletos = await obtenerDatosNomina();
        
        console.log(`Datos obtenidos inicialmente: ${datosCompletos ? datosCompletos.length : 0} registros`);
        
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
                    ', ',
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

// FUNCIONES PARA EL MANEJO DE PESTAÑAS Y ACORDEÓN

// Función para inicializar pestañas
function inicializarPestanas() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Desactivar todas las pestañas
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Activar la pestaña seleccionada
            const tabId = button.getAttribute('data-tab');
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            // Acciones específicas según la pestaña
            if (tabId === 'modificar-nomina') {
                reiniciarEstadoModificacion();
                // Copiar los filtros de la otra pestaña para facilitar la búsqueda
                copiarFiltros('tipoQuincenaFilter', 'modTipoQuincenaFilter');
                copiarFiltros('mesFilter', 'modMesFilter');
                copiarFiltros('anioFilter', 'modAnioFilter');
            } else if (tabId === 'autorizar-nomina') {
                reiniciarEstadoAutorizacion();
                // Copiar los filtros de la pestaña principal
                copiarFiltros('tipoQuincenaFilter', 'authTipoQuincenaFilter');
                copiarFiltros('mesFilter', 'authMesFilter');
                copiarFiltros('anioFilter', 'authAnioFilter');
            }
        });
    });
}

// Función para copiar valores entre filtros
function copiarFiltros(sourceId, targetId) {
    if (document.getElementById(sourceId) && document.getElementById(targetId)) {
        document.getElementById(targetId).value = document.getElementById(sourceId).value;
    }
}

// Función para reiniciar el estado de la pestaña de modificación
function reiniciarEstadoModificacion() {
    // Limpiar la tabla de planillas disponibles
    const tbody = document.getElementById('planillasTableBody');
    if (tbody) {
        tbody.innerHTML = '';
    }
    
    // Mostrar mensaje de que no hay datos
    const noDataElement = document.getElementById('modNoData');
    if (noDataElement) {
        noDataElement.style.display = 'block';
    }
    
    // Cerrar todas las filas de acordeón que estén abiertas
    document.querySelectorAll('tr.accordion-row.active').forEach(row => {
        row.classList.remove('active');
        const detailRow = document.querySelector(`tr.detail-row[data-parent="${row.dataset.id}"]`);
        if (detailRow) {
            detailRow.classList.remove('active');
        }
    });
    
    // Resetear variables de estado
    selectedPlanillaId = null;
    detallesPlanillaSeleccionada = [];
    cambiosRealizados = {};
}

// Función para reiniciar el estado de la pestaña de autorización
function reiniciarEstadoAutorizacion() {
    // Limpiar la tabla de planillas autorizables
    const tbody = document.getElementById('authPlanillasTableBody');
    if (tbody) {
        tbody.innerHTML = '';
    }
    
    // Mostrar mensaje de que no hay datos
    const noDataElement = document.getElementById('authNoData');
    if (noDataElement) {
        noDataElement.style.display = 'block';
    }
    
    // Ocultar el resumen de carga de archivo
    const uploadSummary = document.getElementById('uploadSummary');
    if (uploadSummary) {
        uploadSummary.style.display = 'none';
    }
    
    // Ocultar la información del archivo
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        fileInfo.style.display = 'none';
    }
    
    // Mostrar el área de carga
    const dropArea = document.getElementById('dropArea');
    if (dropArea) {
        dropArea.style.display = 'block';
    }
    
    // Ocultar el progreso de carga
    const uploadProgress = document.getElementById('uploadProgress');
    if (uploadProgress) {
        uploadProgress.style.display = 'none';
    }
    
    // Deshabilitar botón de procesar autorizaciones
    const processAuthBtn = document.getElementById('processAuthBtn');
    if (processAuthBtn) {
        processAuthBtn.disabled = true;
    }
    
    // Deshabilitar botón de autorizar planillas
    const authorizePlanillasBtn = document.getElementById('authorizePlanillasBtn');
    if (authorizePlanillasBtn) {
        authorizePlanillasBtn.disabled = true;
    }
    
    // Resetear contadores
    actualizarContadoresAutorizacion(0, 0, 0);
    
    // Resetear variables de estado
    planillasAutorizables = [];
    planillasSeleccionadas = new Set();
    datosAutorizacion = null;
    mapaAutorizaciones = new Map();
    detallesColaboradoresMap = new Map();
}

// Función para buscar planillas guardadas con Estado=0 (modificables)
async function buscarPlanillasModificables() {
    try {
        // Mostrar loader
        const loaderElement = document.getElementById('modLoader');
        if (loaderElement) {
            loaderElement.style.display = 'block';
        }
        
        const noDataElement = document.getElementById('modNoData');
        if (noDataElement) {
            noDataElement.style.display = 'none';
        }
        
        // Obtener valores de los filtros
        const tipoQuincena = document.getElementById('modTipoQuincenaFilter').value;
        const idTipoPago = tipoQuincena === 'normal' ? 1 : 2;
        const mes = document.getElementById('modMesFilter').value;
        const anio = document.getElementById('modAnioFilter').value;
        
        const connection = await connectionString();
        
        // Consulta para obtener las planillas guardadas con Estado=0
        const query = `
            SELECT 
                p.IdPagoPlanilla,
                p.IdPlanilla,
                p.NombrePlanilla,
                p.CantColaboradores,
                p.MontoPagado,
                p.TipoPago,
                p.Mes,
                p.Anyo,
                p.Estado,
                p.FechaRegistro,
                pl.NoCentroTrabajo,
                pl.Division,
                d.Nombre AS NombreDivision
            FROM 
                PagoPlanilla p
                INNER JOIN planillas pl ON p.IdPlanilla = pl.IdPlanilla
                LEFT JOIN divisiones d ON pl.Division = d.IdDivision
            WHERE 
                p.IdTipoPago = ? 
                AND p.Mes = ? 
                AND p.Anyo = ?
                AND p.Estado = 0
            ORDER BY 
                d.Nombre ASC,
                CAST(pl.NoCentroTrabajo AS UNSIGNED) ASC,
                p.NombrePlanilla ASC
        `;
        
        const planillas = await connection.query(query, [idTipoPago, mes, anio]);
        await connection.close();
        
        // Guardar resultados en variable global
        planillasModificables = planillas;
        
        // Renderizar la tabla de planillas
        renderizarTablaPlanillas(planillas);
        
    } catch (error) {
        console.error('Error al buscar planillas modificables:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al buscar las planillas modificables.'
        });
        
        // Mostrar mensaje de que no hay datos disponibles
        const noDataElement = document.getElementById('modNoData');
        if (noDataElement) {
            noDataElement.style.display = 'block';
        }
        
        const tbody = document.getElementById('planillasTableBody');
        if (tbody) {
            tbody.innerHTML = '';
        }
        
    } finally {
        // Ocultar loader
        const loaderElement = document.getElementById('modLoader');
        if (loaderElement) {
            loaderElement.style.display = 'none';
        }
    }
}

// Función para renderizar la tabla de planillas modificables con acordeón
function renderizarTablaPlanillas(planillas) {
    const tbody = document.getElementById('planillasTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Verificar si hay planillas
    if (!planillas || planillas.length === 0) {
        const noDataElement = document.getElementById('modNoData');
        if (noDataElement) {
            noDataElement.style.display = 'block';
        }
        return;
    }
    
    const noDataElement = document.getElementById('modNoData');
    if (noDataElement) {
        noDataElement.style.display = 'none';
    }
    
    // Crear filas para cada planilla con su acordeón
    planillas.forEach(planilla => {
        // Crear la fila principal (acordeón)
        const row = document.createElement('tr');
        row.className = 'accordion-row';
        row.dataset.id = planilla.IdPagoPlanilla;
        
        // Formatear la fecha de registro
        const fechaRegistro = new Date(planilla.FechaRegistro);
        const fechaFormateada = `${fechaRegistro.getDate().toString().padStart(2, '0')}/${(fechaRegistro.getMonth() + 1).toString().padStart(2, '0')}/${fechaRegistro.getFullYear()} ${fechaRegistro.getHours().toString().padStart(2, '0')}:${fechaRegistro.getMinutes().toString().padStart(2, '0')}`;
        
        // Determinar el nombre del mes
        const nombresMeses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const nombreMes = nombresMeses[parseInt(planilla.Mes) - 1];
        
        // Crear el contenido de la fila
        row.innerHTML = `
            <td>${planilla.IdPagoPlanilla}</td>
            <td class="highlight">
                <span class="toggle-icon"><i class="fas fa-chevron-right"></i></span>
                ${planilla.NombreDivision ? `${planilla.NombreDivision} - ` : ''}${planilla.NombrePlanilla}
                ${planilla.NoCentroTrabajo ? `<br><small>(Centro: ${planilla.NoCentroTrabajo})</small>` : ''}
            </td>
            <td>${planilla.TipoPago}</td>
            <td>${nombreMes} ${planilla.Anyo}</td>
            <td>${fechaFormateada}</td>
            <td class="text-center">${planilla.CantColaboradores}</td>
            <td class="currency">${formatearMoneda(planilla.MontoPagado)}</td>
            <td>
                <div class="action-buttons-cell">
                    <button class="action-btn edit-btn" title="Expandir/Contraer" data-id="${planilla.IdPagoPlanilla}">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Agregar la fila al tbody
        tbody.appendChild(row);
        
        // Crear la fila de detalle (inicialmente oculta)
        const detailRow = document.createElement('tr');
        detailRow.className = 'detail-row';
        detailRow.dataset.parent = planilla.IdPagoPlanilla;
        
        // Crear una celda que abarque todas las columnas
        const detailCell = document.createElement('td');
        detailCell.colSpan = 8; // El número de columnas en la tabla
        detailCell.className = 'accordion-detail-container';
        
        // Inicialmente solo muestra un loader
        detailCell.innerHTML = `
            <div class="detail-loader">
                <div class="loader-spinner"></div>
                <div class="loader-text">Cargando detalles...</div>
            </div>
        `;
        
        detailRow.appendChild(detailCell);
        tbody.appendChild(detailRow);
        
        // Agregar evento click a la fila principal
        row.addEventListener('click', async function() {
            // Si ya está activa, cerrarla
            if (this.classList.contains('active')) {
                this.classList.remove('active');
                detailRow.classList.remove('active');
            } else {
                // Cerrar cualquier otra fila activa
                document.querySelectorAll('tr.accordion-row.active').forEach(activeRow => {
                    activeRow.classList.remove('active');
                    const activeDetailRow = document.querySelector(`tr.detail-row[data-parent="${activeRow.dataset.id}"]`);
                    if (activeDetailRow) {
                        activeDetailRow.classList.remove('active');
                    }
                });
                
                // Abrir esta fila
                this.classList.add('active');
                detailRow.classList.add('active');
                
                // Cargar los detalles si aún no se han cargado
                await cargarDetallesAccordeon(planilla.IdPagoPlanilla, detailCell);
            }
        });
        
        // También agregar evento al botón de editar
        const editBtn = row.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', async function(e) {
                e.stopPropagation(); // Evitar que se propague al evento de la fila
                
                // Invertir estado de la fila
                const isActive = row.classList.contains('active');
                
                // Cerrar todas las filas activas
                document.querySelectorAll('tr.accordion-row.active').forEach(activeRow => {
                    activeRow.classList.remove('active');
                    const activeDetailRow = document.querySelector(`tr.detail-row[data-parent="${activeRow.dataset.id}"]`);
                    if (activeDetailRow) {
                        activeDetailRow.classList.remove('active');
                    }
                });
                
                // Si no estaba activa, activarla y cargar detalles
                if (!isActive) {
                    row.classList.add('active');
                    detailRow.classList.add('active');
                    await cargarDetallesAccordeon(planilla.IdPagoPlanilla, detailCell);
                }
            });
        }
    });
}

// Función para cargar los detalles en la celda de acordeón
async function cargarDetallesAccordeon(idPagoPlanilla, detailCell) {
    try {
        // Si ya hemos cargado los detalles, no volver a cargarlos
        if (detailCell.querySelector('.detail-content')) {
            return;
        }
        
        // Mostrar loader mientras cargamos
        detailCell.innerHTML = `
            <div class="detail-loader">
                <div class="loader-spinner"></div>
                <div class="loader-text">Cargando detalles...</div>
            </div>
        `;
        
        // Buscar la información de la planilla seleccionada
        const planillaSeleccionada = planillasModificables.find(p => p.IdPagoPlanilla == idPagoPlanilla);
        if (!planillaSeleccionada) {
            throw new Error('Planilla no encontrada');
        }
        
        // Guardar el ID de la planilla seleccionada
        selectedPlanillaId = idPagoPlanilla;
        
        // Resetear los cambios realizados
        cambiosRealizados = {};
        
        const connection = await connectionString();
        
        // Consulta para obtener los detalles de la planilla (MODIFICADA)
        const query = `
            SELECT 
                ppd.IdDetallePagoPlanilla,
                ppd.IdPagoPlanilla,
                ppd.IdPersonal,
                ppd.NombrePersonal,
                ppd.SalarioQuincenal,
                ppd.SalarioDiario,
                ppd.DiasLaborados,
                ppd.Bonificacion,
                ppd.PagoIGSS,
                ppd.MontoPagado,
                ppd.NoCuentaDivision1,
                ppd.NoCuentaDivision2,
                ppd.NoCuentaDivision3
            FROM PagoPlanillaDetalle ppd
            WHERE 
                ppd.IdPagoPlanilla = ?
            ORDER BY 
                ppd.NombrePersonal ASC
        `;
        
        const detalles = await connection.query(query, [idPagoPlanilla]);
        await connection.close();
        
        // Guardar detalles en variable global
        detallesPlanillaSeleccionada = detalles;
        
        // Verificar si es planilla de fin de mes 
        const esFinDeMes = planillaSeleccionada.TipoPago.toLowerCase().includes('fin de mes');
        
        // Crear el contenido HTML para los detalles
        let detalleHtml = `
        <div class="detail-content">
            <div class="detail-header">
                <h3>${planillaSeleccionada.NombrePlanilla} - ${planillaSeleccionada.TipoPago}</h3>
                <div class="badge badge-active">Estado: Activo (Editable)</div>
            </div>
            
            <div class="detail-info">
                <div class="detail-info-item">
                    <div class="detail-info-label">Colaboradores</div>
                    <div class="detail-info-value">${planillaSeleccionada.CantColaboradores}</div>
                </div>
                <div class="detail-info-item">
                    <div class="detail-info-label">Monto Total</div>
                    <div class="detail-info-value">${formatearMoneda(planillaSeleccionada.MontoPagado)}</div>
                </div>
                <div class="detail-info-item">
                    <div class="detail-info-label">Periodo</div>
                    <div class="detail-info-value">${planillaSeleccionada.Mes}/${planillaSeleccionada.Anyo}</div>
                </div>
            </div>
            
            <div class="detail-table-container">
                <table class="detail-table" id="editDetalleTable-${idPagoPlanilla}">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre Completo</th>
                            <th>Salario Diario</th>
                            <th>Salario Quincenal</th>
                            <th>Días Laborados</th>
                            <th>Salario Proporcional</th>
                            ${esFinDeMes ? '<th>Bonificación</th>' : ''}
                            ${esFinDeMes ? '<th>IGSS</th>' : ''}
                            <th>Descuento Judicial</th>
                            <th>Salario a Pagar</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Agregar filas para cada colaborador
        detalles.forEach(detalle => {
            // Calcular el salario proporcional
            const salarioProporcional = (detalle.SalarioQuincenal / 15) * detalle.DiasLaborados;
            
            // Calcular el descuento judicial (monto pagado menos salario proporcional)
            // Asumiendo que cualquier diferencia entre el monto pagado y el salario proporcional es por descuentos judiciales
            let descuentoJudicial = 0;
            
            if (esFinDeMes) {
                // Si es fin de mes, el descuento judicial es:
                // Salario proporcional + Bonificación - IGSS - Monto pagado
                descuentoJudicial = Math.max(0, (salarioProporcional + (detalle.Bonificacion || 0) - (detalle.PagoIGSS || 0) - detalle.MontoPagado));
            } else {
                // Si es quincena normal, el descuento judicial es:
                // Salario proporcional - Monto pagado
                descuentoJudicial = Math.max(0, salarioProporcional - detalle.MontoPagado);
            }
            
            // Crear el HTML para la fila
            detalleHtml += `
                <tr data-id="${detalle.IdDetallePagoPlanilla}">
                    <td>${detalle.IdPersonal}</td>
                    <td class="highlight">${detalle.NombrePersonal}</td>
                    <td class="currency">${formatearMoneda(detalle.SalarioDiario)}</td>
                    <td class="currency">${formatearMoneda(detalle.SalarioQuincenal)}</td>
                    <td class="editable dias-laborados" data-original="${detalle.DiasLaborados}" data-field="DiasLaborados">${detalle.DiasLaborados}</td>
                    <td class="currency salario-proporcional">${formatearMoneda(salarioProporcional)}</td>
            `;
            
            // Agregar columnas específicas para fin de mes
            if (esFinDeMes) {
                detalleHtml += `
                    <td class="editable bonificacion currency" data-original="${detalle.Bonificacion || 0}" data-field="Bonificacion">${formatearMoneda(detalle.Bonificacion || 0)}</td>
                    <td class="editable igss currency" data-original="${detalle.PagoIGSS || 0}" data-field="PagoIGSS">${formatearMoneda(detalle.PagoIGSS || 0)}</td>
                `;
            }
            
            // Finalizar la fila con las columnas comunes
            detalleHtml += `
                    <td class="editable descuento-judicial currency" data-original="${descuentoJudicial}" data-field="DescuentoJudicial">${formatearMoneda(descuentoJudicial)}</td>
                    <td class="editable monto-pagado currency" data-original="${detalle.MontoPagado}" data-field="MontoPagado">${formatearMoneda(detalle.MontoPagado)}</td>
                </tr>
            `;
        });
        
        // Cerrar la tabla y agregar los botones de acción
        detalleHtml += `
                    </tbody>
                </table>
            </div>
            
            <div class="detail-row-actions">
                <button id="verHistorialBtn-${idPagoPlanilla}" class="info-btn">
                    <i class="fas fa-history"></i> Ver Historial de Cambios
                </button>
                <button id="cancelChangesBtn-${idPagoPlanilla}" class="cancel-btn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button id="saveDetailChangesBtn-${idPagoPlanilla}" class="save-btn">
                    <i class="fas fa-save"></i> Guardar Cambios
                </button>
            </div>
        </div>`;
        
        // Actualizar el contenido de la celda
        detailCell.innerHTML = detalleHtml;
        
        // Agregar eventos de edición a los campos editables
        const camposEditables = detailCell.querySelectorAll('.editable');
        camposEditables.forEach(campo => {
            campo.addEventListener('click', function() {
                habilitarEdicion(this, esFinDeMes);
            });
        });
        
        const verHistorialBtn = document.getElementById(`verHistorialBtn-${idPagoPlanilla}`);
        if (verHistorialBtn) {
            verHistorialBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Evitar que el clic cierre el acordeón
                mostrarHistorialCambios(idPagoPlanilla);
            });
        }
        
        // Agregar eventos a los botones
        const cancelChangesBtn = document.getElementById(`cancelChangesBtn-${idPagoPlanilla}`);
        if (cancelChangesBtn) {
            cancelChangesBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Evitar que el clic cierre el acordeón
                
                if (Object.keys(cambiosRealizados).length > 0) {
                    // Hay cambios sin guardar, pedir confirmación
                    Swal.fire({
                        icon: 'question',
                        title: '¿Descartar cambios?',
                        text: 'Hay cambios sin guardar. ¿Está seguro de querer descartarlos?',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, descartar',
                        cancelButtonText: 'No, volver a la edición'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            // Cerrar el acordeón y resetear cambios
                            const accordionRow = document.querySelector(`tr.accordion-row[data-id="${idPagoPlanilla}"]`);
                            if (accordionRow) {
                                accordionRow.classList.remove('active');
                            }
                            detailCell.parentElement.classList.remove('active');
                            cambiosRealizados = {};
                        }
                    });
                } else {
                    // No hay cambios, solo cerrar
                    const accordionRow = document.querySelector(`tr.accordion-row[data-id="${idPagoPlanilla}"]`);
                    if (accordionRow) {
                        accordionRow.classList.remove('active');
                    }
                    detailCell.parentElement.classList.remove('active');
                }
            });
        }
        
        const saveDetailChangesBtn = document.getElementById(`saveDetailChangesBtn-${idPagoPlanilla}`);
        if (saveDetailChangesBtn) {
            saveDetailChangesBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Evitar que el clic cierre el acordeón
                guardarCambiosPlanilla();
            });
        }
        
    } catch (error) {
        console.error('Error al cargar detalles del acordeón:', error);
        detailCell.innerHTML = `
            <div class="detail-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error al cargar los detalles. Por favor, intente nuevamente.</p>
            </div>
        `;
    }
}

// Función para habilitar la edición de un campo
function habilitarEdicion(celda, esFinDeMes) {
    // Si ya está en modo edición, salir
    if (celda.querySelector('input')) return;
    
    // Guardar el valor original
    const valorOriginal = celda.dataset.original;
    const esCampoMonetario = celda.classList.contains('currency');
    
    // Crear input para edición
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'editable-input';
    
    // Asignar el valor formateado según el tipo de campo
    if (esCampoMonetario) {
        input.value = parseFloat(valorOriginal).toFixed(2);
    } else {
        input.value = valorOriginal;
    }
    
    // Limpiar y agregar el input
    celda.innerHTML = '';
    celda.appendChild(input);
    
    // Seleccionar todo el texto
    input.select();
    
    // Evento al perder el foco
    input.addEventListener('blur', function() {
        finalizarEdicion(celda, this.value, esFinDeMes);
    });
    
    // Evento al presionar Enter
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            this.blur();
        }
    });
}

// Función para finalizar la edición de un campo
function finalizarEdicion(celda, nuevoValor, esFinDeMes) {
    // Obtener datos de la celda
    const idDetalle = celda.closest('tr').dataset.id;
    const campo = celda.dataset.field;
    const valorOriginal = parseFloat(celda.dataset.original);
    
    // Validar que sea un número válido
    let valorNumerico = parseFloat(nuevoValor.replace(/[^\d.-]/g, ''));
    if (isNaN(valorNumerico)) {
        valorNumerico = valorOriginal;
    }
    
    // Validaciones específicas por campo
    if (campo === 'DiasLaborados') {
        // Los días laborados deben estar entre 0 y 15
        valorNumerico = Math.max(0, Math.min(15, Math.round(valorNumerico)));
    } else if (campo === 'DescuentoJudicial' || campo === 'Bonificacion' || campo === 'PagoIGSS') {
        // Estos campos no pueden ser negativos
        valorNumerico = Math.max(0, valorNumerico);
    }
    
    // Actualizar la celda con el nuevo valor
    celda.dataset.original = valorNumerico;
    
    // Formatear según el tipo de campo
    if (celda.classList.contains('currency')) {
        celda.textContent = formatearMoneda(valorNumerico);
    } else {
        celda.textContent = valorNumerico;
    }
    
    // Si el valor cambió, marcar la celda como modificada
    if (valorOriginal !== valorNumerico) {
        celda.classList.add('cell-modified');
        
        // Registrar el cambio
        if (!cambiosRealizados[idDetalle]) {
            cambiosRealizados[idDetalle] = {};
        }
        cambiosRealizados[idDetalle][campo] = valorNumerico;
        
        // Actualizar cálculos en la fila
        actualizarCalculosFila(celda.closest('tr'), esFinDeMes);
    }
}

// Función para actualizar los cálculos en una fila después de una edición
function actualizarCalculosFila(fila, esFinDeMes) {
    const idDetalle = fila.dataset.id;
    const detalle = detallesPlanillaSeleccionada.find(d => d.IdDetallePagoPlanilla == idDetalle);
    
    // Obtener los valores actuales
    const diasLaborados = parseFloat(fila.querySelector('.dias-laborados').dataset.original);
    const salarioQuincenal = detalle.SalarioQuincenal;
    
    // Calcular el salario proporcional
    const salarioProporcional = (salarioQuincenal / 15) * diasLaborados;
    
    // Actualizar el campo de salario proporcional
    const celdaSalarioProporcional = fila.querySelector('.salario-proporcional');
    if (celdaSalarioProporcional) {
        celdaSalarioProporcional.textContent = formatearMoneda(salarioProporcional);
    }
    
    // Valores para el cálculo final
    let bonificacion = 0;
    let igss = 0;
    let descuentoJudicial = 0;
    
    // Obtener valor de descuento judicial
    const celdaDescuentoJudicial = fila.querySelector('.descuento-judicial');
    if (celdaDescuentoJudicial) {
        descuentoJudicial = parseFloat(celdaDescuentoJudicial.dataset.original || 0);
    }
    
    // Si es fin de mes, considerar bonificación e IGSS
    if (esFinDeMes) {
        const celdaBonificacion = fila.querySelector('.bonificacion');
        if (celdaBonificacion) {
            bonificacion = parseFloat(celdaBonificacion.dataset.original || 0);
        }
        
        const celdaIGSS = fila.querySelector('.igss');
        if (celdaIGSS) {
            igss = parseFloat(celdaIGSS.dataset.original || 0);
        }
    }
    
    // Calcular el monto a pagar
    let montoPagar = salarioProporcional + bonificacion - igss - descuentoJudicial;
    montoPagar = Math.max(0, montoPagar); // No puede ser negativo
    
    // Si hay un monto a pagar diferente al calculado, usar ese valor (edición manual)
    const celdaMontoPagado = fila.querySelector('.monto-pagado');
    
    // Solo actualizar si no ha sido editado manualmente
    if (celdaMontoPagado && (!cambiosRealizados[idDetalle] || !cambiosRealizados[idDetalle]['MontoPagado'])) {
        celdaMontoPagado.textContent = formatearMoneda(montoPagar);
        celdaMontoPagado.dataset.original = montoPagar;
        
        // Registrar el cambio
        if (!cambiosRealizados[idDetalle]) {
            cambiosRealizados[idDetalle] = {};
        }
        cambiosRealizados[idDetalle]['MontoPagado'] = montoPagar;
        
        // Marcar como modificado
        celdaMontoPagado.classList.add('cell-modified');
    }
}

// Función para registrar cambios en el historial
async function registrarHistorialCambios(idPagoPlanilla, idPersonal, nombrePersonal, campo, valorAnterior, valorNuevo, idUsuario, nombreUsuario) {
    try {
        const connection = await connectionString();
        
        // Consulta SQL para insertar el registro en el historial de cambios
        const query = `
            INSERT INTO PagoPlanillaHistorialCambios (
                IdPagoPlanilla,
                IdPersonal,
                NombrePersonal,
                Campo,
                ValorAnterior,
                ValorNuevo,
                IdUsuario,
                NombreUsuario
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            idPagoPlanilla,
            idPersonal,
            nombrePersonal,
            campo,
            valorAnterior ? valorAnterior.toString() : '',
            valorNuevo ? valorNuevo.toString() : '',
            idUsuario,
            nombreUsuario
        ];
        
        // Ejecutar la consulta
        await connection.query(query, params);
        await connection.close();
        
        console.log(`Cambio registrado: ${campo} de ${valorAnterior} a ${valorNuevo} para ${nombrePersonal}`);
        
    } catch (error) {
        console.error('Error al registrar historial de cambios:', error);
        // No interrumpir el flujo principal si falla el registro del historial
    }
}

async function guardarCambiosPlanilla() {
    try {
        // Verificar si hay cambios para guardar
        const totalCambios = Object.keys(cambiosRealizados).length;
        if (totalCambios === 0) {
            await Swal.fire({
                icon: 'info',
                title: 'Sin cambios',
                text: 'No se han realizado cambios en la planilla.'
            });
            return;
        }
        
        // Pedir confirmación al usuario
        const confirmacion = await Swal.fire({
            icon: 'question',
            title: 'Confirmar cambios',
            html: `Está a punto de guardar cambios en ${totalCambios} registro(s).<br>¿Desea continuar?`,
            showCancelButton: true,
            confirmButtonText: 'Sí, guardar cambios',
            cancelButtonText: 'Cancelar'
        });
        
        if (!confirmacion.isConfirmed) {
            return;
        }
        
        // Mostrar loader
        Swal.fire({
            title: 'Guardando cambios',
            text: 'Por favor espere...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const connection = await connectionString();
        
        // Obtener el usuario actual del localStorage
        const userData = JSON.parse(localStorage.getItem('userData')) || {};
        const idUsuario = userData.IdPersonal || 0;
        const nombreUsuario = userData.NombreCompleto || 'Usuario Desconocido';
        
        // Procesar cada cambio
        for (const idDetalle in cambiosRealizados) {
            const cambios = cambiosRealizados[idDetalle];
            
            // Obtener datos del empleado para el registro de historial
            const detalleEmpleado = detallesPlanillaSeleccionada.find(d => d.IdDetallePagoPlanilla == idDetalle);
            if (!detalleEmpleado) continue;
            
            const idPersonal = detalleEmpleado.IdPersonal;
            const nombrePersonal = detalleEmpleado.NombrePersonal;
            
            // Construir la consulta de actualización
            let setClause = [];
            const params = [];
            
            // Mapear los nombres de campos del objeto a los nombres en la base de datos
            const mapaCampos = {
                'DiasLaborados': 'DiasLaborados',
                'Bonificacion': 'Bonificacion',
                'PagoIGSS': 'PagoIGSS',
                'DescuentoJudicial': 'DescuentoJudicial',
                'MontoPagado': 'MontoPagado'
            };
            
            // Nombres para mostrar en el historial (más amigables)
            const nombresAmigables = {
                'DiasLaborados': 'Días Laborados',
                'Bonificacion': 'Bonificación',
                'PagoIGSS': 'Pago IGSS',
                'DescuentoJudicial': 'Descuento Judicial',
                'MontoPagado': 'Monto a Pagar'
            };
            
            // Agregar cada campo modificado a la consulta
            for (const campo in cambios) {
                // Ignorar campos que no existen en la BD
                if (campo === 'DescuentoJudicial') {
                    // Registrar en historial aunque no se actualice en la BD
                    await registrarHistorialCambios(
                        selectedPlanillaId,
                        idPersonal,
                        nombrePersonal,
                        nombresAmigables[campo] || campo,
                        detalleEmpleado[campo] || 0,
                        cambios[campo],
                        idUsuario,
                        nombreUsuario
                    );
                    continue;
                }
                
                if (mapaCampos[campo]) {
                    // Guardar valor anterior para el historial
                    const valorAnterior = detalleEmpleado[campo];
                    const valorNuevo = cambios[campo];
                    
                    // Registrar en el historial
                    await registrarHistorialCambios(
                        selectedPlanillaId,
                        idPersonal,
                        nombrePersonal,
                        nombresAmigables[campo] || campo,
                        valorAnterior,
                        valorNuevo,
                        idUsuario,
                        nombreUsuario
                    );
                    
                    // Agregar a la consulta de actualización
                    setClause.push(`${mapaCampos[campo]} = ?`);
                    params.push(cambios[campo]);
                }
            }
            
            // Si no hay campos para actualizar, continuar con el siguiente
            if (setClause.length === 0) continue;
            
            // Completar la consulta
            params.push(idDetalle); // Agregar el ID como último parámetro
            
            const query = `
                UPDATE PagoPlanillaDetalle 
                SET ${setClause.join(', ')}
                WHERE IdDetallePagoPlanilla = ?
            `;
            
            // Ejecutar la consulta
            await connection.query(query, params);
        }
        
        // Actualizar el monto total de la planilla
        // Primero, obtener la suma de todos los montos pagados
        const querySuma = `
            SELECT SUM(MontoPagado) AS TotalPagado
            FROM PagoPlanillaDetalle
            WHERE IdPagoPlanilla = ?
        `;
        
        const resultadoSuma = await connection.query(querySuma, [selectedPlanillaId]);
        const nuevoMontoTotal = parseFloat(resultadoSuma[0].TotalPagado || 0);
        
        // Actualizar el monto total en la cabecera sin generar registro de historial adicional
        // ya que cada cambio individual ya fue registrado
        const queryUpdateCabecera = `
            UPDATE PagoPlanilla
            SET MontoPagado = ?
            WHERE IdPagoPlanilla = ?
        `;
        
        await connection.query(queryUpdateCabecera, [nuevoMontoTotal, selectedPlanillaId]);
        
        await connection.close();
        
        // Mostrar mensaje de éxito
        await Swal.fire({
            icon: 'success',
            title: 'Cambios guardados',
            text: `Los cambios se han guardado correctamente. Monto total actualizado: ${formatearMoneda(nuevoMontoTotal)}`,
            timer: 3000,
            timerProgressBar: true
        });
        
        // Actualizar la información de la planilla y cerrar el acordeón
        await buscarPlanillasModificables();
        
        // Resetear los cambios realizados
        cambiosRealizados = {};
        
    } catch (error) {
        console.error('Error al guardar cambios:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al guardar los cambios. Por favor intente nuevamente.'
        });
    }
}

// Función para mostrar el historial de cambios de una planilla
async function mostrarHistorialCambios(idPagoPlanilla) {
    try {
        Swal.fire({
            title: 'Cargando historial',
            text: 'Obteniendo los registros de cambios...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const connection = await connectionString();
        
        // Consulta para obtener el historial de cambios de la planilla
        const query = `
            SELECT 
                IdPersonal,
                NombrePersonal,
                Campo,
                ValorAnterior,
                ValorNuevo,
                NombreUsuario,
                DATE_FORMAT(FechaHoraCambio, '%d/%m/%Y %H:%i:%s') AS FechaFormateada
            FROM 
                PagoPlanillaHistorialCambios
            WHERE 
                IdPagoPlanilla = ?
            ORDER BY 
                FechaHoraCambio DESC
        `;
        
        const historial = await connection.query(query, [idPagoPlanilla]);
        await connection.close();
        
        Swal.close();
        
        if (historial.length === 0) {
            await Swal.fire({
                icon: 'info',
                title: 'Sin historial',
                text: 'No se encontraron registros de cambios para esta planilla.'
            });
            return;
        }
        
        // Preparar datos para mostrar en la tabla
        let contenidoHTML = `
            <div style="max-height: 400px; overflow-y: auto;">
                <table class="swal2-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Empleado</th>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Campo</th>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Valor Anterior</th>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Valor Nuevo</th>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Usuario</th>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Fecha/Hora</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        historial.forEach((cambio, index) => {
            const colorFila = index % 2 === 0 ? '#f9f9f9' : 'white';
            
            // Para campos monetarios, formatear los valores
            let valorAnterior = cambio.ValorAnterior;
            let valorNuevo = cambio.ValorNuevo;
            
            // Si el campo contiene palabras como "Monto", "Salario", "Pago", formatear como moneda
            if (cambio.Campo.includes('Monto') || 
                cambio.Campo.includes('Salario') || 
                cambio.Campo.includes('Pago') || 
                cambio.Campo.includes('Bonificación') || 
                cambio.Campo.includes('Descuento')) {
                
                valorAnterior = formatearMoneda(parseFloat(valorAnterior) || 0);
                valorNuevo = formatearMoneda(parseFloat(valorNuevo) || 0);
            }
            
            contenidoHTML += `
                <tr style="background-color: ${colorFila};">
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cambio.NombrePersonal}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cambio.Campo}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${valorAnterior}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${valorNuevo}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cambio.NombreUsuario}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cambio.FechaFormateada}</td>
                </tr>
            `;
        });
        
        contenidoHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Mostrar el historial en un modal
        await Swal.fire({
            title: 'Historial de Cambios',
            html: contenidoHTML,
            width: 900,
            confirmButtonText: 'Cerrar'
        });
        
    } catch (error) {
        console.error('Error al obtener historial de cambios:', error);
        Swal.close();
        
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al obtener el historial de cambios.'
        });
    }
}

// NUEVAS FUNCIONES PARA LA PESTAÑA DE AUTORIZACIÓN

// Función para buscar planillas pendientes de autorización (Estado=0)
async function buscarPlanillasAutorizables() {
    try {
        // Mostrar loader
        const loaderElement = document.getElementById('authLoader');
        if (loaderElement) {
            loaderElement.style.display = 'block';
        }
        
        const noDataElement = document.getElementById('authNoData');
        if (noDataElement) {
            noDataElement.style.display = 'none';
        }
        
        // Obtener valores de los filtros
        const tipoQuincena = document.getElementById('authTipoQuincenaFilter').value;
        const idTipoPago = tipoQuincena === 'normal' ? 1 : 2;
        const mes = document.getElementById('authMesFilter').value;
        const anio = document.getElementById('authAnioFilter').value;
        
        const connection = await connectionString();
        
        // Consulta para obtener las planillas en Estado=0
        const query = `
            SELECT 
                p.IdPagoPlanilla,
                p.IdPlanilla,
                p.NombrePlanilla,
                p.CantColaboradores,
                p.MontoPagado,
                p.TipoPago,
                p.Mes,
                p.Anyo,
                p.Estado,
                p.FechaRegistro,
                pl.NoCentroTrabajo,
                pl.Division,
                d.Nombre AS NombreDivision,
                (
                    SELECT COUNT(*) 
                    FROM PagoPlanillaDetalle ppd 
                    WHERE ppd.IdPagoPlanilla = p.IdPagoPlanilla
                    AND ppd.NoAutorizacion IS NOT NULL
                    AND ppd.NoAutorizacion != ''
                ) AS ColaboradoresAutorizados
            FROM 
                PagoPlanilla p
                INNER JOIN planillas pl ON p.IdPlanilla = pl.IdPlanilla
                LEFT JOIN divisiones d ON pl.Division = d.IdDivision
            WHERE 
                p.IdTipoPago = ? 
                AND p.Mes = ? 
                AND p.Anyo = ?
                AND p.Estado = 0
            ORDER BY 
                d.Nombre ASC,
                CAST(pl.NoCentroTrabajo AS UNSIGNED) ASC,
                p.NombrePlanilla ASC
        `;
        
        const planillas = await connection.query(query, [idTipoPago, mes, anio]);
        await connection.close();
        
        // IMPORTANTE: Convertir todos los BigInt a String para evitar problemas de tipo
        for (let i = 0; i < planillas.length; i++) {
            if (typeof planillas[i].IdPagoPlanilla === 'bigint') {
                planillas[i].IdPagoPlanilla = planillas[i].IdPagoPlanilla.toString();
            }
            if (typeof planillas[i].IdPlanilla === 'bigint') {
                planillas[i].IdPlanilla = planillas[i].IdPlanilla.toString();
            }
        }
        
        // Resetear selecciones anteriores y guardar resultados
        planillasAutorizables = planillas;
        planillasSeleccionadas = new Set();
        
        // Renderizar tabla
        renderizarTablaPlanillasAutorizables(planillas);
        
        // Actualizar contadores
        actualizarContadoresAutorizacion();
        
    } catch (error) {
        console.error('Error al buscar planillas para autorizar:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al buscar las planillas pendientes de autorización.'
        });
        
        const noDataElement = document.getElementById('authNoData');
        if (noDataElement) {
            noDataElement.style.display = 'block';
        }
        
        const tbody = document.getElementById('authPlanillasTableBody');
        if (tbody) {
            tbody.innerHTML = '';
        }
        
    } finally {
        const loaderElement = document.getElementById('authLoader');
        if (loaderElement) {
            loaderElement.style.display = 'none';
        }
    }
}


// Función corregida para renderizar la tabla de planillas autorizables
function renderizarTablaPlanillasAutorizables(planillas) {
    const tbody = document.getElementById('authPlanillasTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Verificar si hay planillas
    if (!planillas || planillas.length === 0) {
        const noDataElement = document.getElementById('authNoData');
        if (noDataElement) {
            noDataElement.style.display = 'block';
        }
        return;
    }
    
    const noDataElement = document.getElementById('authNoData');
    if (noDataElement) {
        noDataElement.style.display = 'none';
    }
    
    // Crear filas para cada planilla
    for (let i = 0; i < planillas.length; i++) {
        const planilla = planillas[i];
        
        // Asegurarse de que el ID sea string
        const idPlanilla = String(planilla.IdPagoPlanilla);
        
        // Determinar nombre del mes
        const nombresMeses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const nombreMes = nombresMeses[parseInt(planilla.Mes) - 1];
        
        // Calcular estado de autorización
        const totalColaboradores = parseInt(planilla.CantColaboradores) || 0;
        const autorizados = parseInt(planilla.ColaboradoresAutorizados) || 0;
        const pendientes = totalColaboradores - autorizados;
        
        let claseEstado = '';
        
        if (autorizados === 0) {
            claseEstado = 'auth-indicator-none';
        } else if (autorizados < totalColaboradores) {
            claseEstado = 'auth-indicator-partial';
        } else {
            claseEstado = 'auth-indicator-complete';
        }
        
        // Formatear fecha de registro
        const fechaRegistro = formatearFechaHora(planilla.FechaRegistro);
        
        // Crear la fila
        const row = document.createElement('tr');
        row.setAttribute('data-id', idPlanilla);
        
        // Verificar si está seleccionada
        const isChecked = planillasSeleccionadas.has(idPlanilla) ? 'checked' : '';
        
        row.innerHTML = `
            <td>
                <div class="checkbox-container">
                    <input type="checkbox" id="planilla-${idPlanilla}" 
                        class="custom-checkbox planilla-checkbox" 
                        data-id="${idPlanilla}" 
                        ${isChecked}>
                    <label for="planilla-${idPlanilla}"></label>
                </div>
            </td>
            <td>${idPlanilla}</td>
            <td class="highlight">
                ${planilla.NombreDivision ? `${planilla.NombreDivision} - ` : ''}${planilla.NombrePlanilla}
                ${planilla.NoCentroTrabajo ? `<br><small>(Centro: ${planilla.NoCentroTrabajo})</small>` : ''}
            </td>
            <td>${planilla.TipoPago}</td>
            <td>${nombreMes} ${planilla.Anyo}</td>
            <td>${fechaRegistro}</td>
            <td class="text-center">${totalColaboradores}</td>
            <td class="text-center">
                <span class="auth-indicator ${claseEstado}">${autorizados}</span>
            </td>
            <td class="text-center">
                <span class="auth-indicator ${pendientes > 0 ? 'auth-indicator-partial' : 'auth-indicator-complete'}">${pendientes}</span>
            </td>
            <td>
                <div class="action-buttons-cell">
                    <button class="action-btn view-details-btn" title="Ver Detalles" data-id="${idPlanilla}">
                        <i class="fas fa-list-alt"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    }
    
    // Agregar eventos después de crear todas las filas
    const checkboxes = tbody.querySelectorAll('.planilla-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const idPlanilla = this.getAttribute('data-id');
            
            if (this.checked) {
                planillasSeleccionadas.add(idPlanilla);
            } else {
                planillasSeleccionadas.delete(idPlanilla);
            }
            
            // Actualizar contador de planillas seleccionadas
            document.getElementById('planillasSeleccionadas').textContent = planillasSeleccionadas.size;
            
            // Actualizar contadores
            actualizarContadoresAutorizacion();
            
            // Actualizar estado del botón de autorizar
            actualizarEstadoBotonAutorizar();
        });
    });
    
    const detailButtons = tbody.querySelectorAll('.view-details-btn');
    detailButtons.forEach(button => {
        button.addEventListener('click', function() {
            const idPlanilla = this.getAttribute('data-id');
            mostrarDetallesPlanilla(idPlanilla);
        });
    });
    
    // Agregar evento al checkbox de seleccionar todos
    const selectAllCheckbox = document.getElementById('selectAllPlanillas');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false; // Resetear al cargar nuevos datos
        
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.planilla-checkbox');
            
            checkboxes.forEach(cb => {
                cb.checked = this.checked;
                
                const idPlanilla = cb.getAttribute('data-id');
                if (this.checked) {
                    planillasSeleccionadas.add(idPlanilla);
                } else {
                    planillasSeleccionadas.delete(idPlanilla);
                }
            });
            
            // Actualizar contador de planillas seleccionadas
            document.getElementById('planillasSeleccionadas').textContent = planillasSeleccionadas.size;
            
            // Actualizar contadores
            actualizarContadoresAutorizacion();
            
            // Actualizar estado del botón de autorizar
            actualizarEstadoBotonAutorizar();
        });
    }
}

// Función para actualizar contadores de autorización
function actualizarContadoresAutorizacion() {
    let totalColaboradores = 0;
    let totalAutorizados = 0;
    
    // Convertir todos los IDs a strings para comparación
    const idsSeleccionados = Array.from(planillasSeleccionadas).map(id => String(id));
    
    // Recorrer planillas seleccionadas
    for (let i = 0; i < planillasAutorizables.length; i++) {
        const planilla = planillasAutorizables[i];
        const idPlanilla = String(planilla.IdPagoPlanilla);
        
        if (idsSeleccionados.includes(idPlanilla)) {
            totalColaboradores += parseInt(planilla.CantColaboradores) || 0;
            totalAutorizados += parseInt(planilla.ColaboradoresAutorizados) || 0;
        }
    }
    
    const totalPendientes = totalColaboradores - totalAutorizados;
    
    // Actualizar valores en la interfaz
    document.getElementById('totalColaboradores').textContent = totalColaboradores;
    document.getElementById('totalAutorizados').textContent = totalAutorizados;
    document.getElementById('totalPendientes').textContent = totalPendientes;
    
    // Actualizar la cantidad de planillas seleccionadas
    document.getElementById('planillasSeleccionadas').textContent = planillasSeleccionadas.size;
}

// Función para actualizar estado del botón de autorizar
function actualizarEstadoBotonAutorizar() {
    const btnAutorizar = document.getElementById('authorizePlanillasBtn');
    if (!btnAutorizar) return;
    
    // Habilitar el botón solo si hay planillas seleccionadas
    btnAutorizar.disabled = planillasSeleccionadas.size === 0;
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


// Función para mostrar detalles de una planilla
async function mostrarDetallesPlanilla(idPlanilla) {
    try {
        // Asegurarse de que el ID sea string
        idPlanilla = String(idPlanilla);
        
        // Mostrar loader
        Swal.fire({
            title: 'Cargando detalles',
            text: 'Obteniendo información de los colaboradores...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Si ya tenemos los detalles cargados, usarlos
        if (detallesColaboradoresMap.has(idPlanilla)) {
            const detalles = detallesColaboradoresMap.get(idPlanilla);
            mostrarModalDetalles(idPlanilla, detalles);
            Swal.close();
            return;
        }
        
        // Si no, cargarlos desde la base de datos
        const connection = await connectionString();
        
        // Consulta para obtener los detalles de la planilla (MODIFICADA)
        const query = `
            SELECT 
                ppd.IdDetallePagoPlanilla,
                ppd.IdPagoPlanilla,
                ppd.IdPersonal,
                ppd.NombrePersonal,
                ppd.MontoPagado,
                ppd.NoCuentaDivision1,
                ppd.NoCuentaDivision2,
                ppd.NoCuentaDivision3,
                ppd.NoAutorizacion
            FROM PagoPlanillaDetalle ppd
            WHERE 
                ppd.IdPagoPlanilla = ?
            ORDER BY 
                ppd.NombrePersonal ASC
        `;
        
        const detalles = await connection.query(query, [idPlanilla]);
        await connection.close();
        
        // Convertir IDs a strings
        for (let i = 0; i < detalles.length; i++) {
            if (typeof detalles[i].IdDetallePagoPlanilla === 'bigint') {
                detalles[i].IdDetallePagoPlanilla = detalles[i].IdDetallePagoPlanilla.toString();
            }
            if (typeof detalles[i].IdPagoPlanilla === 'bigint') {
                detalles[i].IdPagoPlanilla = detalles[i].IdPagoPlanilla.toString();
            }
            if (typeof detalles[i].IdPersonal === 'bigint') {
                detalles[i].IdPersonal = detalles[i].IdPersonal.toString();
            }
        }
        
        // Guardar en el mapa para uso futuro
        detallesColaboradoresMap.set(idPlanilla, detalles);
        
        // Cerrar loader
        Swal.close();
        
        // Mostrar el modal con los detalles
        mostrarModalDetalles(idPlanilla, detalles);
        
    } catch (error) {
        console.error('Error al obtener detalles de planilla:', error);
        Swal.close();
        
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al obtener los detalles de la planilla.'
        });
    }
}

// Función para mostrar el modal con detalles de una planilla
function mostrarModalDetalles(idPlanilla, detalles) {
    // Asegurarse de que el ID sea string
    idPlanilla = String(idPlanilla);
    
    // Obtener información de la planilla
    const planillaIndex = planillasAutorizables.findIndex(p => String(p.IdPagoPlanilla) === idPlanilla);
    if (planillaIndex === -1) return;
    
    const planilla = planillasAutorizables[planillaIndex];
    
    // Actualizar título del modal
    const modalTitle = document.getElementById('detailsModalTitle');
    if (modalTitle) {
        modalTitle.textContent = `Detalles de Planilla: ${planilla.NombrePlanilla}`;
    }
    
    // Llenar tabla de detalles
    const tbody = document.getElementById('detailsTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        
        // Crear filas para cada colaborador
        for (let i = 0; i < detalles.length; i++) {
            const detalle = detalles[i];
            
            // Determinar estado de autorización
            const tieneAutorizacion = detalle.NoAutorizacion && detalle.NoAutorizacion.trim() !== '';
            const estadoClase = tieneAutorizacion ? 'status-badge-authorized' : 'status-badge-pending';
            const estadoTexto = tieneAutorizacion ? 'Autorizado' : 'Pendiente';
            
            // Verificar si el número de cuenta existe
            let noCuentaCell = '';
            const cuentas = [
                detalle.NoCuentaDivision1 || '',
                detalle.NoCuentaDivision2 || '',
                detalle.NoCuentaDivision3 || ''
            ].filter(cuenta => cuenta.trim() !== '');

            if (cuentas.length > 0) {
                noCuentaCell = cuentas.join(' | ');
            } else {
                noCuentaCell = '<span class="warning-text">Sin cuenta</span>';
            }
            
            const row = document.createElement('tr');
            
            // Asegurarse de que los IDs sean strings
            const idDetalle = String(detalle.IdDetallePagoPlanilla);
            
            row.innerHTML = `
                <td>${detalle.IdPersonal}</td>
                <td class="highlight">${detalle.NombrePersonal}</td>
                <td>${noCuentaCell}</td>
                <td class="currency">${formatearMoneda(detalle.MontoPagado)}</td>
                <td class="authorization-field" data-id="${idDetalle}" data-id-planilla="${idPlanilla}">
                    ${detalle.NoAutorizacion || ''}
                    <i class="fas fa-pen edit-icon" title="Editar"></i>
                </td>
                <td><span class="status-badge-auth ${estadoClase}">${estadoTexto}</span></td>
            `;
            
            tbody.appendChild(row);
        }
        
        // Agregar eventos después de crear todas las filas
        const authFields = tbody.querySelectorAll('.authorization-field');
        authFields.forEach(field => {
            const editIcon = field.querySelector('.edit-icon');
            
            editIcon.addEventListener('click', function(e) {
                e.stopPropagation();
                habilitarEdicionAutorizacion(field);
            });
            
            // También permitir editar al hacer clic en el campo
            field.addEventListener('click', function() {
                habilitarEdicionAutorizacion(this);
            });
        });
    }
    
    // Actualizar contadores del modal
    const totalColaboradores = detalles.length;
    const conAutorizacion = detalles.filter(d => d.NoAutorizacion && d.NoAutorizacion.trim() !== '').length;
    const sinAutorizacion = totalColaboradores - conAutorizacion;
    
    document.getElementById('detailsTotalColaboradores').textContent = totalColaboradores;
    document.getElementById('detailsConAutorizacion').textContent = conAutorizacion;
    document.getElementById('detailsSinAutorizacion').textContent = sinAutorizacion;
    
    // Activar campo de búsqueda
    const searchInput = document.getElementById('searchColaborador');
    if (searchInput) {
        searchInput.value = '';
        searchInput.addEventListener('input', function() {
            buscarColaborador(this.value);
        });
    }
    
    // Asignar evento para cerrar el modal
    const closeBtn = document.querySelector('.close-modal-details');
    if (closeBtn) {
        closeBtn.addEventListener('click', cerrarModalDetalles);
    }
    
    const closeDetailsBtn = document.getElementById('closeDetailsBtn');
    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', cerrarModalDetalles);
    }
    
    // Mostrar el modal
    const modal = document.getElementById('detailsModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Función para cerrar el modal de detalles
function cerrarModalDetalles() {
    const modal = document.getElementById('detailsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Función para buscar colaborador en el modal de detalles
function buscarColaborador(texto) {
    const filas = document.querySelectorAll('#detailsTableBody tr');
    
    if (!filas.length) return;
    
    const terminoBusqueda = texto.toLowerCase().trim();
    
    // Si está vacío, mostrar todas las filas
    if (terminoBusqueda === '') {
        filas.forEach(fila => {
            fila.style.display = '';
        });
        return;
    }
    
    // Filtrar filas según coincidencia
    filas.forEach(fila => {
        const nombre = fila.querySelector('td:nth-child(2)').textContent.toLowerCase();
        const idPersonal = fila.querySelector('td:nth-child(1)').textContent.toLowerCase();
        const noCuenta = fila.querySelector('td:nth-child(3)').textContent.toLowerCase();
        
        // La búsqueda funciona tanto con apellidos como con nombres
        // gracias al formato "Apellidos, Nombres"
        if (nombre.includes(terminoBusqueda) || 
            idPersonal.includes(terminoBusqueda) || 
            noCuenta.includes(terminoBusqueda)) {
            fila.style.display = '';
        } else {
            fila.style.display = 'none';
        }
    });
}

// Función para habilitar edición del número de autorización
function habilitarEdicionAutorizacion(campo) {
    // Si ya está en modo edición, salir
    if (campo.querySelector('input')) return;
    
    // Obtener el valor actual
    const valorActual = campo.textContent.trim();
    
    // Guardar referencias para usar después
    const idDetalle = campo.getAttribute('data-id');
    const idPlanilla = campo.getAttribute('data-id-planilla');
    
    // Crear input para edición
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'authorization-input';
    input.value = valorActual;
    input.maxLength = 50; // Limitar la longitud del número de autorización
    
    // Si hay valor en el mapa de autorizaciones para el NoCuenta correspondiente, usarlo
    const detalles = detallesColaboradoresMap.get(idPlanilla);
    if (detalles && mapaAutorizaciones.size > 0) {
        const detalle = detalles.find(d => d.IdDetallePagoPlanilla == idDetalle);
        if (detalle && detalle.NoCuenta) {
            const noCuenta = detalle.NoCuenta.trim();
            if (noCuenta !== '' && mapaAutorizaciones.has(noCuenta)) {
                input.value = mapaAutorizaciones.get(noCuenta);
            }
        }
    }
    
    // Limpiar contenido actual y agregar el input
    const iconEdit = campo.querySelector('.edit-icon');
    campo.innerHTML = '';
    campo.appendChild(input);
    campo.appendChild(iconEdit);
    
    // Enfocar el input
    input.focus();
    
    // Evento al perder el foco
    input.addEventListener('blur', function() {
        const nuevoValor = this.value.trim();
        guardarNoAutorizacion(idDetalle, idPlanilla, nuevoValor);
    });
    
    // Evento al presionar Enter
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            this.blur();
        }
    });
}

// Función para guardar el número de autorización
async function guardarNoAutorizacion(idDetalle, idPlanilla, nuevoValor) {
    try {
        const connection = await connectionString();
        
        // Actualizar en la base de datos
        const query = `
            UPDATE PagoPlanillaDetalle
            SET NoAutorizacion = ?
            WHERE IdDetallePagoPlanilla = ?
        `;
        
        await connection.query(query, [nuevoValor, idDetalle]);
        
        // Actualizar el contador de autorizaciones en la planilla
        const queryCount = `
            SELECT COUNT(*) as Total
            FROM PagoPlanillaDetalle
            WHERE IdPagoPlanilla = ?
            AND NoAutorizacion IS NOT NULL
            AND NoAutorizacion != ''
        `;
        
        const result = await connection.query(queryCount, [idPlanilla]);
        await connection.close();
        
        const totalAutorizados = result[0].Total;
        
        // Actualizar en el mapa de detalles
        if (detallesColaboradoresMap.has(idPlanilla)) {
            const detalles = detallesColaboradoresMap.get(idPlanilla);
            const detalle = detalles.find(d => d.IdDetallePagoPlanilla == idDetalle);
            if (detalle) {
                detalle.NoAutorizacion = nuevoValor;
            }
        }
        
        // Actualizar en la tabla de planillas autorizables
        const planilla = planillasAutorizables.find(p => p.IdPagoPlanilla == idPlanilla);
        if (planilla) {
            planilla.ColaboradoresAutorizados = totalAutorizados;
        }
        
        // Volver a renderizar la tabla
        renderizarTablaPlanillasAutorizables(planillasAutorizables);
        
        // Actualizar contadores
        actualizarContadoresAutorizacion();
        
        // Volver a mostrar los detalles actualizados en el modal
        if (document.getElementById('detailsModal').style.display === 'block') {
            const detalles = detallesColaboradoresMap.get(idPlanilla);
            mostrarModalDetalles(idPlanilla, detalles);
        }
        
    } catch (error) {
        console.error('Error al guardar número de autorización:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al guardar el número de autorización.'
        });
        
        // Cerrar el modal
        cerrarModalDetalles();
    }
}

// Función para procesar el archivo Excel con autorizaciones
async function procesarArchivoAutorizaciones() {
    const fileInput = document.getElementById('excelFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        await Swal.fire({
            icon: 'warning',
            title: 'Sin archivo',
            text: 'Por favor, seleccione un archivo Excel con los números de autorización.'
        });
        return;
    }
    
    try {
        // Mostrar progreso
        const uploadProgress = document.getElementById('uploadProgress');
        if (uploadProgress) {
            uploadProgress.style.display = 'block';
        }
        
        const progressBarFill = document.getElementById('progressBarFill');
        if (progressBarFill) {
            progressBarFill.style.width = '0%';
        }
        
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = 'Leyendo archivo...';
        }
        
        // Leer el archivo
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                progressText.textContent = 'Procesando datos...';
                progressBarFill.style.width = '50%';
                
                // Parsear el archivo Excel
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Verificar que haya al menos una hoja
                if (workbook.SheetNames.length === 0) {
                    throw new Error('El archivo Excel no contiene hojas.');
                }
                
                // Usar la primera hoja
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Convertir a JSON
                const excelData = XLSX.utils.sheet_to_json(worksheet, { raw: true });
                
                if (excelData.length === 0) {
                    throw new Error('No se encontraron datos en el archivo Excel.');
                }
                
                // Verificar que tenga las columnas necesarias
                const primeraFila = excelData[0];
                let campoNoCuenta = '';
                let campoNoAutorizacion = '';
                
                // Buscar los nombres de columnas (ignorando mayúsculas/minúsculas y espacios)
                for (const campo in primeraFila) {
                    const nombreCampo = campo.toLowerCase().replace(/\s+/g, '');
                    if (nombreCampo.includes('cuenta') || nombreCampo === 'nocuenta' || nombreCampo === 'cuenta') {
                        campoNoCuenta = campo;
                    } else if (nombreCampo.includes('autorizacion') || nombreCampo === 'noautorizacion' || nombreCampo === 'autorizacion') {
                        campoNoAutorizacion = campo;
                    }
                }
                
                if (!campoNoCuenta || !campoNoAutorizacion) {
                    throw new Error('El archivo debe contener columnas para NoCuenta y NoAutorizacion.');
                }
                
                progressBarFill.style.width = '75%';
                
                // Crear un mapa de NoCuenta -> NoAutorizacion
                mapaAutorizaciones = new Map();
                
                excelData.forEach(row => {
                    const noCuenta = String(row[campoNoCuenta]).trim();
                    const noAutorizacion = String(row[campoNoAutorizacion]).trim();
                    
                    // Solo agregar si ambos valores son válidos
                    if (noCuenta && noAutorizacion) {
                        mapaAutorizaciones.set(noCuenta, noAutorizacion);
                    }
                });
                
                progressBarFill.style.width = '100%';
                progressText.textContent = 'Procesamiento completado';
                
                // Almacenar información para mostrar resumen
                datosAutorizacion = {
                    totalRegistros: excelData.length,
                    totalValidos: mapaAutorizaciones.size
                };
                
                // Mostrar resumen
                mostrarResumenCargaAutorizaciones(datosAutorizacion);
                
                // Habilitar botón de procesar
                const processAuthBtn = document.getElementById('processAuthBtn');
                if (processAuthBtn) {
                    processAuthBtn.disabled = false;
                }
                
            } catch (error) {
                console.error('Error al procesar archivo Excel:', error);
                await Swal.fire({
                    icon: 'error',
                    title: 'Error de procesamiento',
                    text: `Error al procesar el archivo: ${error.message}`
                });
                
                // Ocultar progreso
                uploadProgress.style.display = 'none';
            }
        };
        
        reader.onerror = function() {
            Swal.fire({
                icon: 'error',
                title: 'Error de lectura',
                text: 'No se pudo leer el archivo.'
            });
            
            // Ocultar progreso
            uploadProgress.style.display = 'none';
        };
        
        // Iniciar la lectura del archivo
        reader.readAsArrayBuffer(file);
        
    } catch (error) {
        console.error('Error al procesar archivo:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al procesar el archivo.'
        });
    }
}

// Función para mostrar resumen de carga de autorizaciones
function mostrarResumenCargaAutorizaciones(datos) {
    const uploadSummary = document.getElementById('uploadSummary');
    if (!uploadSummary) return;
    
    // Actualizar los contadores
    document.getElementById('totalRegistros').textContent = datos.totalRegistros;
    document.getElementById('totalCoincidencias').textContent = datos.totalValidos;
    document.getElementById('totalSinCoincidencia').textContent = datos.totalRegistros - datos.totalValidos;
    
    // Mostrar el resumen
    uploadSummary.style.display = 'block';
}

// Función para aplicar las autorizaciones del archivo Excel a las planillas seleccionadas
async function aplicarAutorizacionesASeleccionadas() {
    try {
        // Verificar que haya planillas seleccionadas
        if (planillasSeleccionadas.size === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Sin selección',
                text: 'Debe seleccionar al menos una planilla para aplicar las autorizaciones.'
            });
            return;
        }
        
        // Verificar que se haya cargado un archivo
        if (!mapaAutorizaciones || mapaAutorizaciones.size === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Sin datos de autorización',
                text: 'Debe cargar un archivo con números de autorización primero.'
            });
            return;
        }
        
        // Mostrar loader
        Swal.fire({
            title: 'Procesando autorizaciones',
            html: 'Aplicando números de autorización a los colaboradores...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const connection = await connectionString();
        
        // Contador para estadísticas
        let totalActualizados = 0;
        let totalColaboradores = 0;
        
        // Recorrer cada planilla seleccionada
        for (const idPlanilla of planillasSeleccionadas) {
            // Asegurarse de que el ID sea string
            const planillaId = String(idPlanilla);
            
            // Obtener los detalles de la planilla si no los tenemos
            if (!detallesColaboradoresMap.has(planillaId)) {
                const query = `
                    SELECT 
                        ppd.IdDetallePagoPlanilla,
                        ppd.IdPagoPlanilla,
                        ppd.IdPersonal,
                        ppd.NombrePersonal,
                        ppd.MontoPagado,
                        ppd.NoCuenta,
                        ppd.NoAutorizacion
                    FROM 
                        PagoPlanillaDetalle ppd
                    WHERE 
                        ppd.IdPagoPlanilla = ?
                `;
                
                const detalles = await connection.query(query, [planillaId]);
                
                // Convertir IDs a strings
                for (let i = 0; i < detalles.length; i++) {
                    if (typeof detalles[i].IdDetallePagoPlanilla === 'bigint') {
                        detalles[i].IdDetallePagoPlanilla = detalles[i].IdDetallePagoPlanilla.toString();
                    }
                    if (typeof detalles[i].IdPagoPlanilla === 'bigint') {
                        detalles[i].IdPagoPlanilla = detalles[i].IdPagoPlanilla.toString();
                    }
                    if (typeof detalles[i].IdPersonal === 'bigint') {
                        detalles[i].IdPersonal = detalles[i].IdPersonal.toString();
                    }
                }
                
                detallesColaboradoresMap.set(planillaId, detalles);
            }
            
            const detalles = detallesColaboradoresMap.get(planillaId);
            totalColaboradores += detalles.length;
            
            // Procesar cada colaborador
            for (const detalle of detalles) {
                // Verificar si tiene número de cuenta y aún no tiene número de autorización
                if (detalle.NoCuenta && detalle.NoCuenta.trim() !== '' && 
                    (!detalle.NoAutorizacion || detalle.NoAutorizacion.trim() === '')) {
                    
                    const noCuenta = detalle.NoCuenta.trim();
                    
                    // Verificar si hay autorización para esta cuenta
                    if (mapaAutorizaciones.has(noCuenta)) {
                        const noAutorizacion = mapaAutorizaciones.get(noCuenta);
                        
                        // Actualizar en la base de datos
                        const queryUpdate = `
                            UPDATE PagoPlanillaDetalle
                            SET NoAutorizacion = ?
                            WHERE IdDetallePagoPlanilla = ?
                        `;
                        
                        await connection.query(queryUpdate, [noAutorizacion, detalle.IdDetallePagoPlanilla]);
                        
                        // Actualizar también en el objeto de memoria
                        detalle.NoAutorizacion = noAutorizacion;
                        
                        totalActualizados++;
                    }
                }
            }
            
            // Actualizar el contador de autorizaciones para esta planilla
            const queryCount = `
                SELECT COUNT(*) as Total
                FROM PagoPlanillaDetalle
                WHERE IdPagoPlanilla = ?
                AND NoAutorizacion IS NOT NULL
                AND NoAutorizacion != ''
            `;
            
            const result = await connection.query(queryCount, [planillaId]);
            const totalAutorizados = result[0].Total;
            
            // Actualizar en la lista de planillas
            const planillaIndex = planillasAutorizables.findIndex(p => String(p.IdPagoPlanilla) === planillaId);
            if (planillaIndex !== -1) {
                planillasAutorizables[planillaIndex].ColaboradoresAutorizados = totalAutorizados;
            }
        }
        
        await connection.close();
        
        // Actualizar la tabla con los nuevos datos
        renderizarTablaPlanillasAutorizables(planillasAutorizables);
        
        // Actualizar contadores generales de la interfaz
        actualizarContadoresAutorizacion();
        
        // Actualizar el estado del botón de autorizar
        actualizarEstadoBotonAutorizar();
        
        // Mostrar mensaje de éxito
        await Swal.fire({
            icon: 'success',
            title: 'Proceso completado',
            html: `
                <p>Se actualizaron <strong>${totalActualizados}</strong> colaboradores de un total de <strong>${totalColaboradores}</strong>.</p>
                <p>Las planillas han sido actualizadas con los números de autorización.</p>
                <p>Estado actual:</p>
                <ul style="text-align: left;">
                    <li>Colaboradores: <strong>${document.getElementById('totalColaboradores').textContent}</strong></li>
                    <li>Autorizados: <strong>${document.getElementById('totalAutorizados').textContent}</strong></li>
                    <li>Pendientes: <strong>${document.getElementById('totalPendientes').textContent}</strong></li>
                </ul>
            `
        });
        
        // Si el modal de detalles está abierto, actualizarlo también
        const detailsModal = document.getElementById('detailsModal');
        if (detailsModal && detailsModal.style.display === 'block') {
            // Determinar qué planilla está mostrándose
            const titulo = document.getElementById('detailsModalTitle');
            if (titulo) {
                // Buscar en planillasAutorizables la que corresponde al título
                const planilla = planillasAutorizables.find(p => titulo.textContent.includes(p.NombrePlanilla));
                if (planilla) {
                    // Volver a cargar los detalles para esta planilla
                    mostrarDetallesPlanilla(String(planilla.IdPagoPlanilla));
                }
            }
        }
        
    } catch (error) {
        console.error('Error al aplicar autorizaciones:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al aplicar las autorizaciones.'
        });
    }
}
function actualizarEstadoBotonAutorizar() {
    const btnAutorizar = document.getElementById('authorizePlanillasBtn');
    if (!btnAutorizar) return;
    
    const totalPendientes = parseInt(document.getElementById('totalPendientes').textContent) || 0;
    const totalSeleccionadas = planillasSeleccionadas.size;
    
    // Habilitar el botón solo si hay planillas seleccionadas
    btnAutorizar.disabled = totalSeleccionadas === 0;
    
    // Cambiar el estilo según si hay pendientes o no
    if (totalPendientes > 0 && totalSeleccionadas > 0) {
        btnAutorizar.classList.add('has-pending');
        btnAutorizar.title = "Hay colaboradores sin autorización. Se recomienda completar las autorizaciones primero.";
    } else {
        btnAutorizar.classList.remove('has-pending');
        btnAutorizar.title = "Autorizar las planillas seleccionadas";
    }
}
// Función para autorizar planillas (cambiar Estado de 0 a 1)
async function autorizarPlanillas() {
    try {
        // Verificar que haya planillas seleccionadas
        if (planillasSeleccionadas.size === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Sin selección',
                text: 'Debe seleccionar al menos una planilla para autorizar.'
            });
            return;
        }
        
        // Obtener contadores
        const totalColaboradores = parseInt(document.getElementById('totalColaboradores').textContent);
        const totalAutorizados = parseInt(document.getElementById('totalAutorizados').textContent);
        const totalPendientes = parseInt(document.getElementById('totalPendientes').textContent);
        
        // Mostrar modal de confirmación
        const modalPlanillasSeleccionadas = document.getElementById('modalPlanillasSeleccionadas');
        const modalTotalColaboradores = document.getElementById('modalTotalColaboradores');
        const modalColaboradoresAutorizados = document.getElementById('modalColaboradoresAutorizados');
        const modalColaboradoresPendientes = document.getElementById('modalColaboradoresPendientes');
        const authWarning = document.getElementById('authWarning');
        
        if (modalPlanillasSeleccionadas) modalPlanillasSeleccionadas.textContent = planillasSeleccionadas.size;
        if (modalTotalColaboradores) modalTotalColaboradores.textContent = totalColaboradores;
        if (modalColaboradoresAutorizados) modalColaboradoresAutorizados.textContent = totalAutorizados;
        if (modalColaboradoresPendientes) modalColaboradoresPendientes.textContent = totalPendientes;
        
        // Mostrar advertencia si hay colaboradores sin autorización
        if (authWarning) {
            if (totalPendientes > 0) {
                authWarning.style.display = 'block';
            } else {
                authWarning.style.display = 'none';
            }
        }
        
        // Mostrar modal de confirmación
        const modal = document.getElementById('authorizeModal');
        if (modal) {
            modal.style.display = 'block';
        }
        
        // Asignar eventos
        const closeModalBtn = document.querySelector('.close-modal-auth');
        if (closeModalBtn) {
            closeModalBtn.onclick = function() {
                modal.style.display = 'none';
            };
        }
        
        const cancelAuthorizeBtn = document.getElementById('cancelAuthorizeBtn');
        if (cancelAuthorizeBtn) {
            cancelAuthorizeBtn.onclick = function() {
                modal.style.display = 'none';
            };
        }
        
        const confirmAuthorizeBtn = document.getElementById('confirmAuthorizeBtn');
        if (confirmAuthorizeBtn) {
            confirmAuthorizeBtn.onclick = async function() {
                modal.style.display = 'none';
                await actualizarEstadoPlanillas();
            };
        }
        
    } catch (error) {
        console.error('Error al preparar autorización:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al preparar la autorización de planillas.'
        });
    }
}

// Función para actualizar el estado de las planillas seleccionadas
async function actualizarEstadoPlanillas() {
    try {
        // Mostrar loader
        Swal.fire({
            title: 'Autorizando planillas',
            html: 'Actualizando estado de las planillas seleccionadas...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const connection = await connectionString();
        
        // Obtener el usuario actual del localStorage
        const userData = JSON.parse(localStorage.getItem('userData')) || {};
        const idUsuario = userData.IdPersonal || 0;
        const nombreUsuario = userData.NombreCompleto || 'Usuario Desconocido';
        
        // Array para almacenar planillas actualizadas
        const planillasActualizadas = [];
        
        // Actualizar cada planilla seleccionada
        for (const idPlanilla of planillasSeleccionadas) {
            // Actualizar el estado de la planilla a 1 (Autorizado)
            const query = `
                UPDATE PagoPlanilla
                SET Estado = 1, 
                    FechaAutorizacion = NOW(),
                    IdUsuarioAutorizacion = ?,
                    NombreUsuarioAutorizacion = ?
                WHERE IdPagoPlanilla = ?
            `;
            
            await connection.query(query, [idUsuario, nombreUsuario, idPlanilla]);
            
            // Guardar referencia a la planilla actualizada
            const planilla = planillasAutorizables.find(p => p.IdPagoPlanilla === idPlanilla);
            if (planilla) {
                planillasActualizadas.push({
                    id: planilla.IdPagoPlanilla,
                    nombre: planilla.NombrePlanilla,
                    colaboradores: planilla.CantColaboradores,
                    autorizados: planilla.ColaboradoresAutorizados || 0
                });
            }
        }
        
        await connection.close();
        
        // Mostrar mensaje de éxito
        const plural = planillasActualizadas.length > 1 ? 's' : '';
        
        await Swal.fire({
            icon: 'success',
            title: 'Planillas autorizadas',
            html: `
                <p>Se ha${plural} autorizado ${planillasActualizadas.length} planilla${plural} exitosamente.</p>
                <p>Las planillas han sido marcadas como autorizadas (Estado = 1).</p>
            `
        });
        
        // Volver a cargar planillas autorizables
        await buscarPlanillasAutorizables();
        
    } catch (error) {
        console.error('Error al autorizar planillas:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al autorizar las planillas.'
        });
    }
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

// Función para formatear nombre con apellido primero
function formatearNombreApellidoPrimero(nombreCompleto) {
    // Como ya viene formateado desde la BD con el formato "Apellidos, Nombres", 
    // solo lo retornamos tal como está
    return nombreCompleto;
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
            
            // 1. Insertar cabecera en PagoPlanilla con Estado=0 (editable)
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
                    
                    // 6. SubTotalPagar = SueldoDiario * Días + Bonificación - IGSS
                    subTotalPagar = salarioCalculado + bonificacion - pagoIGSS;
                    
                    // 7. MontoPagado = SubTotalPagar - Descuento Judicial
                    montoPagado = Math.max(0, subTotalPagar - empleado.DescuentoJudicial);
                }
                
                const detallePlanilla = {
                    IdPagoPlanilla: idPagoPlanilla,
                    IdPersonal: empleado.IdPersonal,
                    NombrePersonal: formatearNombreApellidoPrimero(empleado.NombreCompleto),
                    SalarioQuincenal: salarioQuincenal,      // SE GUARDA TAL CUAL
                    SalarioDiario: salarioDiario,            // SE GUARDA TAL CUAL
                    MontoPagado: montoPagado,                // CALCULADO SEGÚN LÓGICA
                    SubTotalPagar: subTotalPagar,            // CALCULADO SEGÚN LÓGICA
                    Bonificacion: bonificacion,              // 0 para quincena, calculado para fin de mes
                    PagoIGSS: pagoIGSS,                      // 0 para quincena, calculado para fin de mes
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
                    '<li>✅ SubTotalPagar = Salario + Bonificación - IGSS</li>' +
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
        
        // Consulta SQL para insertar el detalle incluyendo SubTotalPagar
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
                DiasLaborados,
                NoCuentaDivision1,
                NoCuentaDivision2,
                NoCuentaDivision3
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

// Inicialización de la interfaz de carga de archivos
function inicializarCargaArchivos() {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('excelFileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const processAuthBtn = document.getElementById('processAuthBtn');
    
    if (!dropArea || !fileInput) return;
    
    // Eventos para arrastrar y soltar
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('dragover');
        }, false);
    });
    
    // Evento al soltar archivo
    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            mostrarInfoArchivo(files[0]);
        }
    }, false);
    
    // Evento al seleccionar archivo
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            mostrarInfoArchivo(fileInput.files[0]);
        }
    });
    
    // Evento para eliminar archivo
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            fileInput.value = '';
            fileInfo.style.display = 'none';
            dropArea.style.display = 'block';
            document.getElementById('uploadSummary').style.display = 'none';
            
            // Deshabilitar botón de procesar
            if (processAuthBtn) {
                processAuthBtn.disabled = true;
            }
            
            // Limpiar datos de autorizaciones
            mapaAutorizaciones = new Map();
            datosAutorizacion = null;
        });
    }
    
    // Evento al hacer clic en el botón de procesar
    if (processAuthBtn) {
        processAuthBtn.addEventListener('click', aplicarAutorizacionesASeleccionadas);
    }
    
    // Función para mostrar información del archivo
    function mostrarInfoArchivo(file) {
        // Verificar que sea un archivo Excel
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            Swal.fire({
                icon: 'error',
                title: 'Tipo de archivo incorrecto',
                text: 'Solo se permiten archivos Excel (.xlsx, .xls)'
            });
            return;
        }
        
        // Mostrar información del archivo
        fileName.textContent = file.name;
        fileSize.textContent = formatearTamanoArchivo(file.size);
        
        // Mostrar el bloque de información y ocultar el área de carga
        fileInfo.style.display = 'flex';
        dropArea.style.display = 'none';
        
        // Procesar el archivo
        procesarArchivoAutorizaciones();
    }
    
    // Función para formatear el tamaño del archivo
    function formatearTamanoArchivo(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
                totalPlanilla += totalPagadoMes;
                
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
            // Segunda quincena: del 16 al último día del mes
            inicioQuincena = `${anio}-${mes.toString().padStart(2, '0')}-16`;
            const ultimoDia = new Date(anio, parseInt(mes), 0).getDate();
            finQuincena = `${anio}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;
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
        
        // 3. VERIFICAR SUSPENSIONES - CORREGIDO
        const querySuspensiones = `
            SELECT 
                DATE(FechaInicio) as FechaInicio,
                DATE(FechaFin) as FechaFin
            FROM 
                Suspensiones
            WHERE 
                IdPersonal = ? 
                AND DATE(FechaInicio) <= ? 
                AND DATE(FechaFin) >= ?
            ORDER BY
                FechaInicio
        `;
        
        const suspensiones = await connection.query(querySuspensiones, [idPersonal, finQuincena, inicioQuincena]);
        
        if (suspensiones.length > 0) {
            suspensiones.forEach(suspension => {
                // Crear fechas locales evitando problemas de zona horaria
                const fechaInicioLocal = new Date(suspension.FechaInicio + 'T12:00:00');
                const fechaFinLocal = new Date(suspension.FechaFin + 'T12:00:00');
                const inicioQuincenaDate = new Date(inicioQuincena + 'T12:00:00');
                const finQuincenaDate = new Date(finQuincena + 'T12:00:00');
                
                // Calcular fechas efectivas dentro de la quincena
                const inicioEfectivo = fechaInicioLocal < inicioQuincenaDate ? inicioQuincenaDate : fechaInicioLocal;
                const finEfectivo = fechaFinLocal > finQuincenaDate ? finQuincenaDate : fechaFinLocal;
                
                const fechaInicioFormateada = formatearFechaLocal(inicioEfectivo);
                const fechaFinFormateada = formatearFechaLocal(finEfectivo);
                
                observaciones.push(`S-IGSS.${fechaInicioFormateada} al ${fechaFinFormateada}`);
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
            
            // Configurar imagen de usuario si existe
            const userImageElement = document.getElementById('userImage');
            if (userImageElement && userData.FotoBase64) {
                userImageElement.src = userData.FotoBase64;
            }
        }
        
        // Inicializar las pestañas
        inicializarPestanas();
        
        // Llenar años en los filtros (desde 2020 hasta año actual + 1)
        const anioFilter = document.getElementById('anioFilter');
        const modAnioFilter = document.getElementById('modAnioFilter');
        const authAnioFilter = document.getElementById('authAnioFilter');
        const currentYear = new Date().getFullYear();
        
        if (anioFilter) {
            for (let year = 2020; year <= currentYear + 1; year++) {
                const option1 = document.createElement('option');
                option1.value = year;
                option1.textContent = year;
                if (year === currentYear) {
                    option1.selected = true;
                }
                anioFilter.appendChild(option1);
            }
        }
        
        if (modAnioFilter) {
            for (let year = 2020; year <= currentYear + 1; year++) {
                const option2 = document.createElement('option');
                option2.value = year;
                option2.textContent = year;
                if (year === currentYear) {
                    option2.selected = true;
                }
                modAnioFilter.appendChild(option2);
            }
        }
        
        if (authAnioFilter) {
            for (let year = 2020; year <= currentYear + 1; year++) {
                const option3 = document.createElement('option');
                option3.value = year;
                option3.textContent = year;
                if (year === currentYear) {
                    option3.selected = true;
                }
                authAnioFilter.appendChild(option3);
            }
        }
        
        // Establecer mes actual seleccionado por defecto
        const currentMonth = new Date().getMonth() + 1; // getMonth() es 0-indexed
        
        const mesFilter = document.getElementById('mesFilter');
        if (mesFilter) {
            mesFilter.value = currentMonth;
        }
        
        const modMesFilter = document.getElementById('modMesFilter');
        if (modMesFilter) {
            modMesFilter.value = currentMonth;
        }
        
        const authMesFilter = document.getElementById('authMesFilter');
        if (authMesFilter) {
            authMesFilter.value = currentMonth;
        }
        
        // Cargar planillas desde la base de datos
        await cargarPlanillas();
        
        // Inicializar interfaz de carga de archivos
        inicializarCargaArchivos();
        
        // Agregar eventos de forma segura
        addEventIfElementExists('applyFilters', 'click', cargarDatosNomina);
        addEventIfElementExists('buscarPlanillasBtn', 'click', buscarPlanillasModificables);
        addEventIfElementExists('buscarPlanillasAuthBtn', 'click', buscarPlanillasAutorizables);
        addEventIfElementExists('pdfBtn', 'click', generarPDF);
        addEventIfElementExists('exportBtn', 'click', generarExcel);
        addEventIfElementExists('saveBtn', 'click', guardarPlanilla);
        addEventIfElementExists('authorizePlanillasBtn', 'click', autorizarPlanillas);
        
        // Manejar eventos para modales
        const modalFunctions = {
            'approveModal': {
                close: '.close-modal',
                cancel: 'cancelApproveBtn'
            },
            'authorizeModal': {
                close: '.close-modal-auth',
                cancel: 'cancelAuthorizeBtn'
            },
            'detailsModal': {
                close: '.close-modal-details',
                cancel: 'closeDetailsBtn'
            }
        };
        
        Object.entries(modalFunctions).forEach(([modalId, buttons]) => {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            
            // Eventos para cerrar modal
            const closeBtn = modal.querySelector(buttons.close);
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            // Eventos para botón cancelar
            const cancelBtn = document.getElementById(buttons.cancel);
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            // Cerrar al hacer clic fuera del modal
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
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
    } catch (error) {
        console.error('Error al inicializar la página:', error);
    }
});