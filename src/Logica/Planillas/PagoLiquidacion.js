// Liquidacion.js - PARTE 1
const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');

let colaboradorSeleccionado = null;
let timeoutBusqueda = null;
let liquidacionesAutorizadas = [];
let liquidacionesAutorizadasFiltradas = [];
let timeoutBusquedaAutorizadas = null;
let liquidacionesAutorizadasManager;

// Función para verificar despido/renuncia del colaborador
async function verificarDespidoRenuncia(idPersonal) {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT 
                FechaFinColaborador,
                IdEstadoPersonal,
                Estado
            FROM DespidosRenuncias
            WHERE IdPersonal = ? AND Estado = 1
            ORDER BY FechaFinColaborador DESC
            LIMIT 1
        `, [idPersonal]);
        
        await connection.close();
        
        if (result.length > 0) {
            return {
                tieneRegistro: true,
                fechaFin: result[0].FechaFinColaborador,
                tipoSalida: result[0].IdEstadoPersonal === 2 ? 'Despedido' : result[0].IdEstadoPersonal === 3 ? 'Renunció' : 'Otro',
                idEstado: result[0].IdEstadoPersonal
            };
        } else {
            return {
                tieneRegistro: false,
                fechaFin: null,
                tipoSalida: 'Activo',
                idEstado: null
            };
        }
    } catch (error) {
        console.error('Error al verificar despido/renuncia:', error);
        throw error;
    }
}

// Función para buscar colaboradores
async function buscarColaboradores(termino) {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT 
                personal.IdPersonal,
                CONCAT(
                    personal.PrimerNombre, ' ', 
                    IFNULL(personal.SegundoNombre, ''), ' ', 
                    IFNULL(personal.TercerNombre, ''), ' ', 
                    personal.PrimerApellido, ' ', 
                    IFNULL(personal.SegundoApellido, '')
                ) AS NombreCompleto,
                personal.IdSucuDepa,
                personal.IdPlanilla,
                personal.FechaPlanilla,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64,
                departamentos.NombreDepartamento
            FROM personal
            LEFT JOIN FotosPersonal ON personal.IdPersonal = FotosPersonal.IdPersonal
            INNER JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
            WHERE CONCAT(
                personal.PrimerNombre, ' ', 
                IFNULL(personal.SegundoNombre, ''), ' ', 
                IFNULL(personal.TercerNombre, ''), ' ', 
                personal.PrimerApellido, ' ', 
                IFNULL(personal.SegundoApellido, '')
            ) LIKE ?
            AND personal.FechaPlanilla IS NOT NULL
            ORDER BY personal.PrimerNombre, personal.PrimerApellido
            LIMIT 20
        `, [`%${termino}%`]);
        
        await connection.close();
        return result;
    } catch (error) {
        console.error('Error al buscar colaboradores:', error);
        throw error;
    }
}

// Función para obtener información completa del colaborador
async function obtenerInfoCompleta(idPersonal) {
    try {
        const connection = await connectionString();
        
        // Consulta principal del colaborador
        const colaborador = await connection.query(`
            SELECT 
                personal.IdPersonal,
                CONCAT(
                    personal.PrimerNombre, ' ', 
                    IFNULL(personal.SegundoNombre, ''), ' ', 
                    IFNULL(personal.TercerNombre, ''), ' ', 
                    personal.PrimerApellido, ' ', 
                    IFNULL(personal.SegundoApellido, '')
                ) AS NombreCompleto,
                personal.IdSucuDepa,
                personal.IdPlanilla,
                personal.FechaPlanilla,
                IFNULL(personal.SalarioBase, 0) AS SalarioBase,
                personal.DPI,
                personal.IdDepartamentoOrigen,
                personal.IdMunicipioOrigen,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM personal
            LEFT JOIN FotosPersonal ON personal.IdPersonal = FotosPersonal.IdPersonal
            WHERE personal.IdPersonal = ?
        `, [idPersonal]);
        
        if (colaborador.length === 0) {
            throw new Error('Colaborador no encontrado');
        }
        
        const datosColaborador = colaborador[0];
        
        // Asegurar que SalarioBase sea un número válido
        datosColaborador.SalarioBase = parseFloat(datosColaborador.SalarioBase) || 0;
        
        // Verificar si tiene despido/renuncia
        const estadoSalida = await verificarDespidoRenuncia(idPersonal);
        
        // Obtener información del departamento
        const departamento = await connection.query(`
            SELECT NombreDepartamento
            FROM departamentos
            WHERE IdDepartamento = ?
        `, [datosColaborador.IdSucuDepa]);
        
        // Obtener información de la planilla y división
        let planillaInfo = { Nombre_Planilla: 'Sin planilla', Division: null, NombreDivision: 'Sin división' };
        
        if (datosColaborador.IdPlanilla) {
            const planilla = await connection.query(`
                SELECT Nombre_Planilla, Division
                FROM planillas
                WHERE IdPlanilla = ?
            `, [datosColaborador.IdPlanilla]);
            
            if (planilla.length > 0) {
                planillaInfo.Nombre_Planilla = planilla[0].Nombre_Planilla;
                planillaInfo.Division = planilla[0].Division;
                
                // Obtener información de la división
                if (planilla[0].Division) {
                    const division = await connection.query(`
                        SELECT Nombre
                        FROM divisiones
                        WHERE IdDivision = ?
                    `, [planilla[0].Division]);
                    
                    if (division.length > 0) {
                        planillaInfo.NombreDivision = division[0].Nombre;
                    }
                }
            }
        }
        
        await connection.close();
        
        return {
            ...datosColaborador,
            NombreDepartamento: departamento.length > 0 ? departamento[0].NombreDepartamento : 'Sin departamento',
            PlanillaCompleta: `${planillaInfo.NombreDivision} - ${planillaInfo.Nombre_Planilla}`,
            NombreDivision: planillaInfo.NombreDivision,
            NombrePlanilla: planillaInfo.Nombre_Planilla,
            // Información de salida
            EstadoSalida: estadoSalida
        };
        
    } catch (error) {
        console.error('Error al obtener información completa:', error);
        throw error;
    }
}

// Función para obtener información completa del colaborador para liquidación
async function obtenerInfoCompletaLiquidacion(idPersonal) {
    try {
        const connection = await connectionString();
        
        // Consulta completa con todos los datos necesarios
        const result = await connection.query(`
            SELECT 
                personal.IdPersonal,
                CONCAT(
                    personal.PrimerNombre, ' ', 
                    IFNULL(personal.SegundoNombre, ''), ' ', 
                    IFNULL(personal.TercerNombre, ''), ' ', 
                    personal.PrimerApellido, ' ', 
                    IFNULL(personal.SegundoApellido, '')
                ) AS NombreCompleto,
                personal.DPI,
                personal.IdDepartamentoOrigen,
                personal.IdMunicipioOrigen,
                personal.IdPlanilla,
                departamentosguatemala.NombreDepartamento AS DepartamentoOrigen,
                municipios.NombreMunicipio AS MunicipioOrigen,
                planillas.Division,
                divisiones.Nombre AS NombreDivision,
                CASE 
                    WHEN divisiones.Logos IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(divisiones.Logos))
                    ELSE NULL 
                END AS LogoDivision
            FROM personal
            LEFT JOIN departamentosguatemala ON personal.IdDepartamentoOrigen = departamentosguatemala.IdDepartamentoG
            LEFT JOIN municipios ON personal.IdMunicipioOrigen = municipios.IdMunicipio
            LEFT JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
            LEFT JOIN divisiones ON planillas.Division = divisiones.IdDivision
            WHERE personal.IdPersonal = ?
        `, [idPersonal]);
        
        await connection.close();
        
        if (result.length > 0) {
            return result[0];
        } else {
            throw new Error('No se pudo obtener la información completa del colaborador');
        }
    } catch (error) {
        console.error('Error al obtener información completa:', error);
        throw error;
    }
}

// Función para calcular el tiempo laborado (CORREGIDA para incluir el día inicial)
function calcularTiempoLaborado(fechaPlanilla, estadoSalida = null) {
    if (!fechaPlanilla) return 'No disponible';
    
    // Crear fecha sin problemas de zona horaria
    const fechaString = fechaPlanilla.split('T')[0];
    const [añoInicio, mesInicio, diaInicio] = fechaString.split('-').map(Number);
    
    // Determinar fecha final (fecha de salida o fecha actual)
    let añoFinal, mesFinal, diaFinal;
    
    if (estadoSalida && estadoSalida.tieneRegistro && estadoSalida.fechaFin) {
        // Usar fecha de salida
        const fechaFinString = estadoSalida.fechaFin.split('T')[0];
        [añoFinal, mesFinal, diaFinal] = fechaFinString.split('-').map(Number);
    } else {
        // Usar fecha actual
        const fechaActual = new Date();
        añoFinal = fechaActual.getFullYear();
        mesFinal = fechaActual.getMonth() + 1;
        diaFinal = fechaActual.getDate();
    }
    
    // Calcular usando año comercial
    const fechaInicio = { año: añoInicio, mes: mesInicio, dia: diaInicio };
    const fechaFin = { año: añoFinal, mes: mesFinal, dia: diaFinal };
    
    const diferencia = calcularDiferenciasComerciales(fechaInicio, fechaFin);
    
    let resultado = '';
    
    if (diferencia.años > 0) {
        resultado += `${diferencia.años} año${diferencia.años > 1 ? 's' : ''}`;
    }
    
    if (diferencia.meses > 0) {
        if (resultado) resultado += ', ';
        resultado += `${diferencia.meses} mes${diferencia.meses > 1 ? 'es' : ''}`;
    }
    
    if (diferencia.dias > 0) {
        if (resultado) resultado += ', ';
        resultado += `${diferencia.dias} día${diferencia.dias > 1 ? 's' : ''}`;
    }
    
    if (!resultado) {
        resultado = 'Menos de 1 día';
    }
    
    resultado += ` (${diferencia.diasTotales} días laborales)`;
    
    // Agregar información sobre el tipo de cálculo
    if (estadoSalida && estadoSalida.tieneRegistro) {
        resultado += ` - ${estadoSalida.tipoSalida}`;
    }
    
    return resultado;
}

// Función para formatear fecha (corregida para zona horaria)
function formatearFecha(fecha) {
    if (!fecha) return 'No disponible';

    const fechaString = fecha.split('T')[0]; // Formato: "2022-02-01"
    const [año, mes, dia] = fechaString.split('-').map(Number);
    
    const fechaObj = new Date(año, mes - 1, dia); // mes - 1 porque JavaScript cuenta los meses desde 0
    
    const opciones = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'America/Guatemala' // Especificar zona horaria de Guatemala
    };
    
    return fechaObj.toLocaleDateString('es-ES', opciones);
}
function formatearFechaPDF(fecha) {
    if (!fecha) return 'No disponible';
    
    const fechaString = fecha.split('T')[0]; // Formato: "2022-02-01"
    const [año, mes, dia] = fechaString.split('-').map(Number);
    
    // Crear fecha usando componentes individuales
    const fechaObj = new Date(año, mes - 1, dia);
    
    return fechaObj.toLocaleDateString('es-ES', {
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit'
    });
}
// Función auxiliar para obtener nombre del mes
function obtenerNombreMes(numeroMes) {
    const meses = [
        '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    return meses[numeroMes];
}

// Función para calcular días de aguinaldo usando año comercial (30 días por mes)
function calcularDiasAguinaldo(fechaPlanilla, estadoSalida = null) {
    if (!fechaPlanilla) return { dias: 0, periodo: 'No disponible' };
    
    // Determinar fecha final (fecha de salida o fecha actual)
    let añoFinal, mesFinal, diaFinal;
    
    if (estadoSalida && estadoSalida.tieneRegistro && estadoSalida.fechaFin) {
        const fechaFinString = estadoSalida.fechaFin.split('T')[0];
        [añoFinal, mesFinal, diaFinal] = fechaFinString.split('-').map(Number);
    } else {
        const fechaActual = new Date();
        añoFinal = fechaActual.getFullYear();
        mesFinal = fechaActual.getMonth() + 1;
        diaFinal = fechaActual.getDate();
    }
    
    // Fecha de inicio de aguinaldo: 1 de diciembre del año anterior
    const añoInicioAguinaldo = añoFinal - 1;
    const mesInicioAguinaldo = 12;
    const diaInicioAguinaldo = 1;
    
    // Fecha de ingreso del colaborador
    const fechaString = fechaPlanilla.split('T')[0];
    const [añoIngreso, mesIngreso, diaIngreso] = fechaString.split('-').map(Number);
    
    // Determinar fecha de inicio real (la más tardía)
    let fechaInicioReal, fechaFinalReal;
    
    if (añoIngreso > añoInicioAguinaldo || 
        (añoIngreso === añoInicioAguinaldo && mesIngreso > mesInicioAguinaldo) ||
        (añoIngreso === añoInicioAguinaldo && mesIngreso === mesInicioAguinaldo && diaIngreso > diaInicioAguinaldo)) {
        fechaInicioReal = { año: añoIngreso, mes: mesIngreso, dia: diaIngreso };
    } else {
        fechaInicioReal = { año: añoInicioAguinaldo, mes: mesInicioAguinaldo, dia: diaInicioAguinaldo };
    }
    
    fechaFinalReal = { año: añoFinal, mes: mesFinal, dia: diaFinal };
    
    // Calcular usando año comercial
    const diferencia = calcularDiferenciasComerciales(fechaInicioReal, fechaFinalReal);
    
    // Máximo 360 días para aguinaldo
    const diasFinales = Math.min(diferencia.diasTotales, 360);
    
    // Formatear periodo
    const fechaInicioTexto = `${fechaInicioReal.dia} de ${obtenerNombreMes(fechaInicioReal.mes)} de ${fechaInicioReal.año}`;
    const fechaFinalTexto = `${fechaFinalReal.dia} de ${obtenerNombreMes(fechaFinalReal.mes)} de ${fechaFinalReal.año}`;
    const periodo = `${fechaInicioTexto} al ${fechaFinalTexto}`;
    
    return {
        dias: diasFinales,
        periodo: periodo,
        fechaInicio: fechaInicioReal,
        fechaFin: fechaFinalReal
    };
}

// Función para calcular días de vacaciones usando año comercial (desde aniversario hasta fecha salida/actual)
function calcularDiasVacaciones(fechaPlanilla, estadoSalida = null) {
    if (!fechaPlanilla) return { dias: 0, periodo: 'No disponible' };
    
    // Determinar fecha final
    let añoFinal, mesFinal, diaFinal;
    
    if (estadoSalida && estadoSalida.tieneRegistro && estadoSalida.fechaFin) {
        const fechaFinString = estadoSalida.fechaFin.split('T')[0];
        [añoFinal, mesFinal, diaFinal] = fechaFinString.split('-').map(Number);
    } else {
        const fechaActual = new Date();
        añoFinal = fechaActual.getFullYear();
        mesFinal = fechaActual.getMonth() + 1;
        diaFinal = fechaActual.getDate();
    }
    
    // Fecha de ingreso
    const fechaString = fechaPlanilla.split('T')[0];
    const [añoIngreso, mesIngreso, diaIngreso] = fechaString.split('-').map(Number);
    
    // Calcular la fecha del último aniversario
    let añoAniversario = añoFinal;
    if (mesFinal < mesIngreso || (mesFinal === mesIngreso && diaFinal < diaIngreso)) {
        añoAniversario = añoFinal - 1;
    }
    
    const fechaInicioVacaciones = { año: añoAniversario, mes: mesIngreso, dia: diaIngreso };
    const fechaFinalVacaciones = { año: añoFinal, mes: mesFinal, dia: diaFinal };
    
    // Calcular usando año comercial
    const diferencia = calcularDiferenciasComerciales(fechaInicioVacaciones, fechaFinalVacaciones);
    
    // Máximo 360 días para vacaciones
    const diasFinales = Math.min(diferencia.diasTotales, 360);
    
    // Formatear periodo
    const fechaInicioTexto = `${fechaInicioVacaciones.dia} de ${obtenerNombreMes(fechaInicioVacaciones.mes)} de ${fechaInicioVacaciones.año}`;
    const fechaFinalTexto = `${fechaFinalVacaciones.dia} de ${obtenerNombreMes(fechaFinalVacaciones.mes)} de ${fechaFinalVacaciones.año}`;
    const periodo = `${fechaInicioTexto} al ${fechaFinalTexto}`;
    
    return {
        dias: diasFinales,
        periodo: periodo,
        fechaInicio: fechaInicioVacaciones,
        fechaFin: fechaFinalVacaciones
    };
}

// Función para calcular días de Bono 14 usando año comercial (1 julio año anterior hasta fecha salida/actual)
function calcularDiasBono14(fechaPlanilla, estadoSalida = null) {
    if (!fechaPlanilla) return { dias: 0, periodo: 'No disponible' };
    
    // Determinar fecha final
    let añoFinal, mesFinal, diaFinal;
    
    if (estadoSalida && estadoSalida.tieneRegistro && estadoSalida.fechaFin) {
        const fechaFinString = estadoSalida.fechaFin.split('T')[0];
        [añoFinal, mesFinal, diaFinal] = fechaFinString.split('-').map(Number);
    } else {
        const fechaActual = new Date();
        añoFinal = fechaActual.getFullYear();
        mesFinal = fechaActual.getMonth() + 1;
        diaFinal = fechaActual.getDate();
    }
    
    // Determinar el período de Bono 14 aplicable
    let añoInicioBono14, añoFinBono14;
    
    if (mesFinal >= 7) {
        // Período actual: 1 julio año actual → 30 junio año siguiente
        añoInicioBono14 = añoFinal;
        añoFinBono14 = añoFinal + 1;
    } else {
        // Período anterior: 1 julio año anterior → 30 junio año actual
        añoInicioBono14 = añoFinal - 1;
        añoFinBono14 = añoFinal;
    }
    
    // Fechas del período de Bono 14
    const fechaInicioPeriodo = { año: añoInicioBono14, mes: 7, dia: 1 };
    const fechaFinPeriodo = { año: añoFinBono14, mes: 6, dia: 30 };
    
    // Fecha de ingreso del colaborador
    const fechaString = fechaPlanilla.split('T')[0];
    const [añoIngreso, mesIngreso, diaIngreso] = fechaString.split('-').map(Number);
    
    // Determinar fecha de inicio real (la más tardía)
    let fechaInicioReal;
    const fechaIngresoComparable = añoIngreso * 10000 + mesIngreso * 100 + diaIngreso;
    const fechaInicioPeriodoComparable = fechaInicioPeriodo.año * 10000 + fechaInicioPeriodo.mes * 100 + fechaInicioPeriodo.dia;
    
    if (fechaIngresoComparable > fechaInicioPeriodoComparable) {
        fechaInicioReal = { año: añoIngreso, mes: mesIngreso, dia: diaIngreso };
    } else {
        fechaInicioReal = fechaInicioPeriodo;
    }
    
    // Determinar fecha final real (la más temprana entre salida y fin del período)
    let fechaFinalReal;
    const fechaFinalComparable = añoFinal * 10000 + mesFinal * 100 + diaFinal;
    const fechaFinPeriodoComparable = fechaFinPeriodo.año * 10000 + fechaFinPeriodo.mes * 100 + fechaFinPeriodo.dia;
    
    if (fechaFinalComparable <= fechaFinPeriodoComparable) {
        fechaFinalReal = { año: añoFinal, mes: mesFinal, dia: diaFinal };
    } else {
        fechaFinalReal = fechaFinPeriodo;
    }
    
    // Verificar que hay días trabajados
    const fechaInicioRealComparable = fechaInicioReal.año * 10000 + fechaInicioReal.mes * 100 + fechaInicioReal.dia;
    const fechaFinalRealComparable = fechaFinalReal.año * 10000 + fechaFinalReal.mes * 100 + fechaFinalReal.dia;
    
    if (fechaInicioRealComparable > fechaFinalRealComparable) {
        return {
            dias: 0,
            periodo: `Sin días trabajados en el período del Bono 14`,
            fechaInicio: fechaInicioPeriodo,
            fechaFin: fechaFinPeriodo
        };
    }
    
    // Calcular usando año comercial
    const diferencia = calcularDiferenciasComerciales(fechaInicioReal, fechaFinalReal);
    
    // Máximo 360 días para Bono 14
    const diasFinales = Math.min(diferencia.diasTotales, 360);
    
    // Formatear periodo
    const fechaInicioTexto = `${fechaInicioReal.dia} de ${obtenerNombreMes(fechaInicioReal.mes)} de ${fechaInicioReal.año}`;
    const fechaFinalTexto = `${fechaFinalReal.dia} de ${obtenerNombreMes(fechaFinalReal.mes)} de ${fechaFinalReal.año}`;
    const periodo = `${fechaInicioTexto} al ${fechaFinalTexto}`;
    
    const periodoOficial = `Período oficial: 1 de julio de ${fechaInicioPeriodo.año} al 30 de junio de ${fechaFinPeriodo.año}`;
    
    return {
        dias: diasFinales,
        periodo: periodo,
        periodoOficial: periodoOficial,
        fechaInicio: fechaInicioReal,
        fechaFin: fechaFinalReal,
        fechaInicioPeriodo: fechaInicioPeriodo,
        fechaFinPeriodo: fechaFinPeriodo
    };
}
function normalizarFechaComercial(año, mes, dia) {
    // En año comercial, todos los meses tienen 30 días máximo
    const diaComercial = Math.min(dia, 30);
    
    return {
        año: año,
        mes: mes,
        dia: diaComercial
    };
}
function calcularDiferenciasComerciales(fechaInicio, fechaFin) {
    // Normalizar ambas fechas al año comercial
    const inicio = normalizarFechaComercial(fechaInicio.año, fechaInicio.mes, fechaInicio.dia);
    const fin = normalizarFechaComercial(fechaFin.año, fechaFin.mes, fechaFin.dia);
    
    // Calcular diferencia
    let años = fin.año - inicio.año;
    let meses = fin.mes - inicio.mes;
    let dias = fin.dia - inicio.dia + 1; // +1 para incluir el día inicial
    
    // Ajustar si los días son negativos
    if (dias <= 0) {
        meses--;
        dias += 30;
    }
    
    // Ajustar si los meses son negativos
    if (meses < 0) {
        años--;
        meses += 12;
    }
    
    // Si los días pasan de 30, ajustar al siguiente mes
    if (dias > 30) {
        meses += Math.floor(dias / 30);
        dias = dias % 30;
        if (dias === 0) {
            dias = 30;
            meses--;
        }
    }
    
    // Si los meses pasan de 12, ajustar al siguiente año
    if (meses >= 12) {
        años += Math.floor(meses / 12);
        meses = meses % 12;
    }
    
    // Calcular días totales usando año comercial
    const diasTotales = (años * 360) + (meses * 30) + dias;
    
    return {
        años: años,
        meses: meses,
        dias: dias,
        diasTotales: diasTotales
    };
}
function redondearDosDecimales(numero) {
    return Math.round((numero + Number.EPSILON) * 100) / 100;
}

// Función para formatear moneda (ACTUALIZADA)
function formatearMoneda(valor) {
    if (!valor || isNaN(valor)) return 'Q 0.00';
    
    // Redondear a 2 decimales antes de formatear
    const valorRedondeado = redondearDosDecimales(valor);
    
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valorRedondeado);
}

// Función para calcular la liquidación completa
// Función auxiliar para redondear correctamente a 2 decimales
function redondearDosDecimales(numero) {
    return Math.round((numero + Number.EPSILON) * 100) / 100;
}

// Función para formatear moneda (ACTUALIZADA)
function formatearMoneda(valor) {
    if (!valor || isNaN(valor)) return 'Q 0.00';
    
    // Redondear a 2 decimales antes de formatear
    const valorRedondeado = redondearDosDecimales(valor);
    
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valorRedondeado);
}

// Función para calcular la liquidación completa (CORREGIDA)
function calcularLiquidacion(colaborador, descuentos = null, indemnizacionActiva = true, observaciones = '') {
    const salarioBase = parseFloat(colaborador.SalarioBase) || 0;
    const estadoSalida = colaborador.EstadoSalida;
    const tiempoLaborado = calcularTiempoLaborado(colaborador.FechaPlanilla, estadoSalida);
    
    // Obtener información de prestaciones
    const aguinaldoInfo = calcularDiasAguinaldo(colaborador.FechaPlanilla, estadoSalida);
    const vacacionesInfo = calcularDiasVacaciones(colaborador.FechaPlanilla, estadoSalida);
    const bono14Info = calcularDiasBono14(colaborador.FechaPlanilla, estadoSalida);
    
    // Extraer días laborados totales del tiempo laborado
    const diasLaboradosText = tiempoLaborado.match(/\((\d+) días laborales\)/);
    const diasLaboradosTotales = diasLaboradosText ? parseInt(diasLaboradosText[1]) : 0;
    
    let liquidacion = {
        salarioBase: redondearDosDecimales(salarioBase),
        indemnizacion: 0,
        indemnizacionCalculada: 0, // Nuevo campo para mostrar el cálculo siempre
        indemnizacionActiva: indemnizacionActiva, // Nuevo campo para saber si está activa
        observaciones: observaciones, // Nuevo campo para observaciones
        aguinaldo: 0,
        vacaciones: 0,
        bono14: 0,
        subtotal: 0,
        descuentoVale: 0,
        numeroVale: '',
        total: 0,
        diasLaborados: diasLaboradosTotales,
        diasAguinaldo: aguinaldoInfo.dias,
        diasVacaciones: vacacionesInfo.dias,
        diasBono14: bono14Info.dias,
        esDespido: estadoSalida.tieneRegistro && estadoSalida.idEstado === 2,
        esRenuncia: estadoSalida.tieneRegistro && estadoSalida.idEstado === 3
    };
    
    // Calcular indemnización (SIEMPRE calcular para mostrar)
    if (liquidacion.esDespido) {
        // Despido: ((SalarioBase / 6) + SalarioBase) / 360 * días laborados
        const salarioBaseSexta = salarioBase / 6;
        const sumaSalarios = salarioBaseSexta + salarioBase;
        liquidacion.indemnizacionCalculada = redondearDosDecimales((sumaSalarios / 360) * diasLaboradosTotales);
    } else {
        // Renuncia o cualquier otro caso: SalarioBase / 360 * días laborados
        liquidacion.indemnizacionCalculada = redondearDosDecimales((salarioBase / 360) * diasLaboradosTotales);
    }
    
    // Aplicar indemnización solo si está activa
    liquidacion.indemnizacion = indemnizacionActiva ? liquidacion.indemnizacionCalculada : 0;
    
    // Calcular aguinaldo = SalarioBase / 360 * días de aguinaldo
    liquidacion.aguinaldo = redondearDosDecimales((salarioBase / 360) * aguinaldoInfo.dias);
    
    // Calcular vacaciones = (SalarioBase / 360 * días de vacaciones) / 2
    liquidacion.vacaciones = redondearDosDecimales(((salarioBase / 360) * vacacionesInfo.dias) / 2);
    
    // Calcular Bono 14 = SalarioBase / 360 * días de Bono 14
    liquidacion.bono14 = redondearDosDecimales((salarioBase / 360) * bono14Info.dias);
    
    // Calcular subtotal (con o sin indemnización según esté activa)
    liquidacion.subtotal = redondearDosDecimales(
        liquidacion.indemnizacion + 
        liquidacion.aguinaldo + 
        liquidacion.vacaciones + 
        liquidacion.bono14
    );
    
    // Aplicar descuentos si existen
    if (descuentos && descuentos.monto > 0) {
        liquidacion.descuentoVale = redondearDosDecimales(parseFloat(descuentos.monto));
        liquidacion.numeroVale = descuentos.numeroVale || '';
    }
    
    // Calcular total final (redondeando también el total)
    liquidacion.total = redondearDosDecimales(liquidacion.subtotal - liquidacion.descuentoVale);
    
    return liquidacion;
}

// Función para guardar liquidación en base de datos
async function guardarLiquidacion(colaborador, liquidacion) {
    try {
        // Obtener datos del usuario actual (simulado por ahora)
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const idUsuario = userData.IdPersonal || 1;
        const nombreUsuario = userData.NombreCompleto || 'Usuario Sistema';
        
        const connection = await connectionString();
        
        const result = await connection.query(`
            INSERT INTO Liquidaciones (
                IdPersonal, 
                NombrePersonal, 
                FechaPlanilla, 
                MontoIndemnizacion, 
                MontoAguinaldo, 
                MontoVacaciones, 
                MontoBono14, 
                NoVale,
                DescuentoInterno,
                IndemnizacionSiNo,
                Observaciones,
                IdUsuario, 
                NombreUsuario
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            colaborador.IdPersonal,
            colaborador.NombreCompleto,
            colaborador.FechaPlanilla,
            redondearDosDecimales(liquidacion.indemnizacion),
            redondearDosDecimales(liquidacion.aguinaldo),
            redondearDosDecimales(liquidacion.vacaciones),
            redondearDosDecimales(liquidacion.bono14),
            liquidacion.numeroVale || null,
            redondearDosDecimales(liquidacion.descuentoVale),
            liquidacion.indemnizacionActiva ? 1 : 0,
            liquidacion.observaciones || null, // Nuevo campo
            idUsuario,
            nombreUsuario
        ]);
        
        await connection.close();
        return result.insertId;
        
    } catch (error) {
        console.error('Error al guardar liquidación:', error);
        throw error;
    }
}

// Función para generar PDF de liquidación usando jsPDF
async function generarPDFLiquidacion(colaborador, liquidacion, infoCompleta) {
    try {
        // Importar jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración inicial
        let yPosition = 15;
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);
        
        // Paleta de grises elegante (sin colores)
        const grisOscuro = [52, 52, 52];      // Gris muy oscuro para headers
        const grisHeader = [88, 88, 88];      // Gris medio para elementos importantes
        const grisTitulo = [68, 68, 68];      // Gris oscuro para títulos
        const grisTexto = [85, 85, 85];       // Gris texto normal
        const grisClaro = [128, 128, 128];    // Gris claro para detalles
        const verdeTotal = [72, 72, 72];      // Gris oscuro para totales (en lugar de verde)
        
        // Función para texto centrado
        const centrarTexto = (texto, y, fontSize = 12, color = grisTexto, style = 'normal') => {
            doc.setFontSize(fontSize);
            doc.setFont(undefined, style);
            doc.setTextColor(color[0], color[1], color[2]);
            const textWidth = doc.getTextWidth(texto);
            const x = (pageWidth - textWidth) / 2;
            doc.text(texto, x, y);
            return y + (fontSize * 0.6);
        };
        
        // Función para texto izquierda
        const textoIzq = (texto, x, y, fontSize = 10, color = grisTexto, style = 'normal') => {
            doc.setFontSize(fontSize);
            doc.setFont(undefined, style);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(texto, x, y);
        };
        
        // Función para texto derecha
        const textoDer = (texto, x, y, fontSize = 10, color = grisTexto, style = 'normal') => {
            doc.setFontSize(fontSize);
            doc.setFont(undefined, style);
            doc.setTextColor(color[0], color[1], color[2]);
            const textWidth = doc.getTextWidth(texto);
            doc.text(texto, x - textWidth, y);
        };
        
        // === HEADER SIN FONDO ===
        // Logo en header (optimizado para reducir peso)
        if (infoCompleta.LogoDivision) {
            try {
                // Agregar logo directamente sin optimización compleja
                doc.addImage(infoCompleta.LogoDivision, 'JPEG', margin, yPosition, 40, 20, undefined, 'MEDIUM');
            } catch (e) {
                console.log('Logo no disponible:', e);
                // Crear logo de texto como alternativa
                textoIzq('LOGO', margin, yPosition + 12, 10, grisTexto, 'bold');
            }
        } else {
            // Si no hay logo, mostrar texto
            textoIzq('LOGO', margin, yPosition + 12, 10, grisTexto, 'bold');
        }
        
        // Texto del header (solo una vez)
        doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        textoDer(infoCompleta.NombreDivision || 'Surtidora de Mercados, S.A.', pageWidth - margin, yPosition + 12);
        
        yPosition = 40;
        
        // === TÍTULO PRINCIPAL (ELEGANTE EN GRIS) ===
        doc.setFillColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
        doc.rect(margin, yPosition, contentWidth, 12, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        centrarTexto('LIQUIDACIÓN LABORAL', yPosition + 8, 11, [255, 255, 255], 'bold');
        
        yPosition += 18; // Reducido de 25 a 18
        
        // === INFORMACIÓN DEL COLABORADOR ===
        const fechaInicio = formatearFechaPDF(colaborador.FechaPlanilla);
        const fechaFin = colaborador.EstadoSalida.tieneRegistro ? 
            formatearFechaPDF(colaborador.EstadoSalida.fechaFin) : 
            new Date().toLocaleDateString('es-ES', {
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit'
            });
        
        const tiempoLaboradoTexto = calcularTiempoLaborado(colaborador.FechaPlanilla, colaborador.EstadoSalida);
        const diasLaboradosMatch = tiempoLaboradoTexto.match(/\((\d+) días laborales\)/);
        const diasLaborados = diasLaboradosMatch ? diasLaboradosMatch[1] : liquidacion.diasLaborados;
        const salarioDiario = (colaborador.SalarioDiario && colaborador.SalarioDiario > 0) ? 
            parseFloat(colaborador.SalarioDiario).toFixed(2) : 
            (liquidacion.salarioBase / 30).toFixed(2);
        
        // Caja gris para información (más compacta y optimizada)
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.5);
        doc.rect(margin, yPosition, contentWidth, 26, 'FD');
        
        yPosition += 6;
        textoIzq('LIQUIDACIÓN LABORAL DE:', margin + 3, yPosition, 8, grisTitulo, 'bold');
        textoIzq(colaborador.NombreCompleto.toUpperCase(), margin + 65, yPosition, 9, grisHeader, 'bold');
        
        yPosition += 7;
        textoIzq('INICIO:', margin + 3, yPosition, 8, grisTitulo, 'bold');
        textoIzq(fechaInicio, margin + 25, yPosition, 8, grisTexto);
        
        textoIzq('FINALIZÓ:', margin + 75, yPosition, 8, grisTitulo, 'bold');
        textoIzq(fechaFin, margin + 105, yPosition, 8, grisTexto);
        
        yPosition += 7;
        textoIzq('TIEMPO LABORADO:', margin + 3, yPosition, 8, grisTitulo, 'bold');
        textoIzq(`${diasLaborados} DÍAS`, margin + 55, yPosition, 8, grisTexto);
        
        textoIzq('SUELDO PROM. DIARIO:', margin + 95, yPosition, 8, grisTitulo, 'bold');
        textoIzq(`Q ${salarioDiario}`, margin + 155, yPosition, 8, grisTexto);
        
        yPosition += 14; // Reducido de 18 a 14
        
        // === CONCEPTOS DE LIQUIDACIÓN (ELEGANTE EN GRIS) ===
        doc.setFillColor(grisHeader[0], grisHeader[1], grisHeader[2]);
        doc.rect(margin, yPosition, contentWidth, 10, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        textoIzq('CONCEPTOS DE LIQUIDACIÓN', margin + 5, yPosition + 7, 9, [255, 255, 255], 'bold');
        
        yPosition += 14; // Reducido de 18 a 14
        
        // Función para mostrar cada cálculo (aún más compacto con títulos)
        const mostrarCalculo = (concepto, monto, dias, divisorExtra, resultado, colorFondo, yPos) => {
            // Fondo de color (más delgado)
            doc.setFillColor(colorFondo[0], colorFondo[1], colorFondo[2]);
            doc.rect(margin, yPos, contentWidth, 16, 'F'); // Aumentado de 12 a 16 para los títulos
            
            // Concepto
            textoIzq(concepto + ':', margin + 5, yPos + 10, 9, grisTitulo, 'bold');
            
            // Cálculo: monto ÷ 360 × días con títulos
            let x = margin + 65;
            const espaciado = 7;
            
            // === SALARIO BASE ===
            // Título arriba
            textoIzq('Salario', x, yPos + 4, 6, grisTexto);
            textoIzq('Base', x, yPos + 6.5, 6, grisTexto);
            // Monto abajo
            textoIzq(monto.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2}), x, yPos + 12, 8, grisTexto);
            x += Math.max(doc.getTextWidth(monto.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})), doc.getTextWidth('Salario')) + espaciado;
            
            // ÷
            textoIzq('÷', x, yPos + 10, 9, grisOscuro, 'bold');
            x += 12;
            
            // === 360 DÍAS ===
            // Título arriba
            textoIzq('Días', x, yPos + 4, 6, grisClaro);
            textoIzq('Comerc.', x, yPos + 6.5, 6, grisClaro);
            // Número abajo
            textoIzq('360', x, yPos + 12, 8, grisTexto, 'bold');
            x += Math.max(doc.getTextWidth('360'), doc.getTextWidth('Comerc.')) + espaciado;
            
            // ×
            textoIzq('×', x, yPos + 10, 9, grisOscuro, 'bold');
            x += 12;
            
            // === DÍAS TRABAJADOS ===
            // Título arriba
            textoIzq('Días', x, yPos + 4, 6, grisClaro);
            textoIzq('Trabaj.', x, yPos + 6.5, 6, grisClaro);
            // Días abajo
            textoIzq(dias.toString(), x, yPos + 12, 8, grisTexto, 'bold');
            x += Math.max(doc.getTextWidth(dias.toString()), doc.getTextWidth('Trabaj.')) + espaciado;
            
            // Divisor extra si existe (÷ 2 para vacaciones)
            if (divisorExtra) {
                // ÷
                textoIzq('÷', x, yPos + 10, 9, grisOscuro, 'bold');
                x += 12;
                
                // === DIVISOR EXTRA ===
                // Título arriba
                textoIzq('Mitad', x, yPos + 6.5, 6, grisClaro);
                // Número abajo
                textoIzq(divisorExtra.toString(), x, yPos + 12, 8, grisTexto, 'bold');
                x += Math.max(doc.getTextWidth(divisorExtra.toString()), doc.getTextWidth('Mitad')) + espaciado;
            }
            
            // === RESULTADO ===
            // Título arriba
            textoDer('Total', pageWidth - margin - 5, yPos + 6.5, 6, grisClaro);
            // Resultado abajo (FORZAR 2 DECIMALES)
            const montoFormateado = 'Q ' + Number(resultado).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            textoDer(montoFormateado, pageWidth - margin - 5, yPos + 12, 9, grisTitulo, 'bold');
            
            return yPos + 16;
        };
        // INDEMNIZACIÓN
        let salarioIndem = liquidacion.salarioBase;
        if (liquidacion.esDespido) {
            salarioIndem = liquidacion.salarioBase + (liquidacion.salarioBase / 6);
        }
        yPosition = mostrarCalculo('INDEMNIZACIÓN', salarioIndem, liquidacion.diasLaborados, null, liquidacion.indemnizacion, [255, 245, 245], yPosition);
        
        // AGUINALDO
        yPosition = mostrarCalculo('AGUINALDO', liquidacion.salarioBase, liquidacion.diasAguinaldo, null, liquidacion.aguinaldo, [245, 255, 245], yPosition);
        
        // VACACIONES
        yPosition = mostrarCalculo('VACACIONES', liquidacion.salarioBase, liquidacion.diasVacaciones, 2, liquidacion.vacaciones, [245, 250, 255], yPosition);
        
        // BONO 14
        yPosition = mostrarCalculo('BONO 14', liquidacion.salarioBase, liquidacion.diasBono14, null, liquidacion.bono14, [255, 250, 240], yPosition);
        
        yPosition += 2; // Reducido de 4 a 2
        
        // === TOTAL LIQUIDACIÓN (MÁS COMPACTO) ===
        doc.setFillColor(245, 255, 245);
        doc.rect(margin, yPosition, contentWidth, 13, 'F');
        
        textoIzq('TOTAL LIQUIDACIÓN', margin + 5, yPosition + 9, 11, verdeTotal, 'bold');
        
        // Línea de puntos
        let puntoX = margin + 85;
        while (puntoX < pageWidth - 80) {
            doc.setFillColor(verdeTotal[0], verdeTotal[1], verdeTotal[2]);
            doc.circle(puntoX, yPosition + 6, 0.5, 'F');
            puntoX += 4;
        }
        
        const totalFormateado = 'Q ' + liquidacion.total.toLocaleString('es-GT', {minimumFractionDigits: 2});
        textoDer(totalFormateado, pageWidth - margin - 5, yPosition + 9, 11, verdeTotal, 'bold');
        
        yPosition += 15; // Reducido de 17 a 15
        
        // === OTROS CONCEPTOS (MÁS COMPACTOS) ===
        textoIzq(`SUELDO ORDINARIO DE DÍAS:`, margin, yPosition, 8, grisTexto);
        textoDer('Q0.00', pageWidth - margin, yPosition, 8, grisTexto);
        
        yPosition += 8; // Reducido de 9 a 8
        textoIzq(`BONIFICACIÓN INCENTIVO 37-2001 DE DÍAS:`, margin, yPosition, 8, grisTexto);
        textoDer('Q0.00', pageWidth - margin, yPosition, 8, grisTexto);
        
        yPosition += 8; // Reducido de 10 a 8
        
        // === LÍNEA DE PUNTOS PARA LÍQUIDO ===
        let puntoFinalX = margin;
        while (puntoFinalX < pageWidth - margin) {
            doc.setFillColor(grisTitulo[0], grisTitulo[1], grisTitulo[2]);
            doc.circle(puntoFinalX, yPosition, 0.3, 'F');
            puntoFinalX += 3;
        }
        yPosition += 4; // Reducido de 5 a 4
        
        // === LÍQUIDO A PAGAR (MÁS COMPACTO) ===
        doc.setFillColor(240, 255, 240);
        doc.rect(margin, yPosition, contentWidth, 14, 'F');
        
        textoIzq('LÍQUIDO A PAGAR', margin + 5, yPosition + 10, 13, verdeTotal, 'bold');
        
        // Línea de puntos para líquido
        puntoX = margin + 80;
        while (puntoX < pageWidth - 100) {
            doc.setFillColor(verdeTotal[0], verdeTotal[1], verdeTotal[2]);
            doc.circle(puntoX, yPosition + 7, 0.7, 'F');
            puntoX += 5;
        }
        
        textoDer(totalFormateado, pageWidth - margin - 5, yPosition + 10, 13, verdeTotal, 'bold');
        
        yPosition += 16; // Reducido de 18 a 16
        
        // === TEXTO LEGAL (JUSTIFICADO CON MENOS ESPACIADO) ===
        const municipio = (infoCompleta.MunicipioOrigen || 'SANTA CRUZ DEL QUICHÉ').toUpperCase();
        const departamento = (infoCompleta.DepartamentoOrigen || 'QUICHÉ').toUpperCase();
        const empresa = (infoCompleta.NombreDivision || 'SURTIDORA DE MERCADOS, S.A.').toUpperCase();
        
        // Generar fecha dinámica para el texto legal
        const fechaParaTexto = colaborador.EstadoSalida.tieneRegistro ? 
            colaborador.EstadoSalida.fechaFin : 
            new Date().toISOString().split('T')[0];

        const fechaFormateadaTexto = convertirFechaATextoLegal(fechaParaTexto);

        const textoLegal = `YO ${colaborador.NombreCompleto.toUpperCase()} VECINO DEL MUNICIPIO DE ${municipio} DEL DEPARTAMENTO DE ${departamento} POR ESTE MEDIO HAGO CONSTAR QUE, RECIBÍ A MI ENTERA SATISFACCIÓN LAS PRESTACIONES LABORALES A QUE TENGO DERECHO POR PARTE DE ${empresa}, POR LO QUE EXTIENDO MI MAS AMPLIO Y ENTERO FINIQUITO A LA CITADA ${empresa} NO TENIENDO NINGUN RECLAMO PRESENTE NI FUTURO, DADO EN LA ANTIGUA GUATEMALA ${fechaFormateadaTexto}.`;
        // Función para justificar texto con espaciado reducido
        const justificarTexto = (texto, anchoLinea, x, y, tamanoFuente) => {
            const palabras = texto.split(' ');
            let linea = '';
            let yActual = y;
            
            // Configurar el tamaño de fuente antes de medir
            doc.setFontSize(tamanoFuente);
            
            for (let i = 0; i < palabras.length; i++) {
                const palabraActual = palabras[i];
                const testLinea = linea === '' ? palabraActual : linea + ' ' + palabraActual;
                const anchoTest = doc.getTextWidth(testLinea);
                
                // Verificar si la línea de prueba cabe en el ancho disponible
                if (anchoTest > anchoLinea && linea !== '') {
                    // La línea actual está completa, imprimirla justificada
                    const palabrasLinea = linea.trim().split(' ');
                    
                    if (palabrasLinea.length > 1) {
                        // Justificar la línea (distribuyendo el espacio extra)
                        const espaciosNecesarios = palabrasLinea.length - 1;
                        const anchoTextoSinEspacios = palabrasLinea.reduce((sum, palabra) => {
                            return sum + doc.getTextWidth(palabra);
                        }, 0);
                        const espacioTotalDisponible = anchoLinea - anchoTextoSinEspacios;
                        const espacioEntrePalabras = espacioTotalDisponible / espaciosNecesarios;
                        
                        let xActual = x;
                        for (let j = 0; j < palabrasLinea.length; j++) {
                            textoIzq(palabrasLinea[j], xActual, yActual, tamanoFuente, grisTexto);
                            if (j < palabrasLinea.length - 1) { // No agregar espacio después de la última palabra
                                xActual += doc.getTextWidth(palabrasLinea[j]) + espacioEntrePalabras;
                            }
                        }
                    } else {
                        // Solo una palabra, no justificar
                        textoIzq(linea.trim(), x, yActual, tamanoFuente, grisTexto);
                    }
                    
                    // Pasar a la siguiente línea
                    linea = palabraActual + ' ';
                    yActual += 3.6;
                } else {
                    // La palabra cabe, agregarla a la línea actual
                    linea = testLinea + ' ';
                }
            }
            
            // Imprimir la última línea (no justificada, solo alineada a la izquierda)
            if (linea.trim()) {
                textoIzq(linea.trim(), x, yActual, tamanoFuente, grisTexto);
                yActual += 3.6;
            }
            
            return yActual;
        };
        
        // Aplicar justificación al texto legal con espaciado mínimo (TEXTO AÚN MÁS GRANDE)
        yPosition = justificarTexto(textoLegal, contentWidth - 10, margin + 5, yPosition, 9) + 2; // Aumentado de 8 a 9
        yPosition += 25; // Aumentado de 20 a 25 para bajar más la firma
        
        // === LÍNEA DE FIRMA ===
        const anchoFirma = 80;
        const xCentro = pageWidth / 2;
        
        doc.setLineWidth(1);
        doc.setDrawColor(grisTitulo[0], grisTitulo[1], grisTitulo[2]);
        doc.line(xCentro - anchoFirma/2, yPosition, xCentro + anchoFirma/2, yPosition);
        yPosition += 8; // Reducido de 12 a 8
        
        // === NOMBRE Y DPI ===
        centrarTexto(colaborador.NombreCompleto.toUpperCase(), yPosition, 9, grisTitulo, 'bold');
        yPosition += 5; // Reducido de 8 a 5
        centrarTexto(`CUI No. ${infoCompleta.DPI || 'N/A'}`, yPosition, 8, grisTexto);
        
        // === PIE DE PÁGINA (AÚN MÁS ABAJO) ===
        yPosition = pageHeight - 5; // Movido más abajo de 8 a 6
        doc.setLineWidth(0.3);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition - 3, pageWidth - margin, yPosition - 3); // Reducido de 4 a 3
        
        centrarTexto('Sistema de Recursos Humanos - Liquidaciones', yPosition, 7, grisTexto);
        centrarTexto(`© ${empresa} ${new Date().getFullYear()}`, yPosition + 3, 6, grisTexto); // Reducido de 4 a 3
        
        // Generar y abrir PDF
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
        
        return true;
        
    } catch (error) {
        console.error('Error al generar PDF completo:', error);
        throw error;
    }
}
// Liquidacion.js - PARTE 2 FINAL (Continuación)

// Función para mostrar resultados de búsqueda
function mostrarResultados(colaboradores) {
    const contenedor = document.getElementById('resultadosBusqueda');
    
    if (colaboradores.length === 0) {
        contenedor.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No se encontraron colaboradores</div>';
        contenedor.style.display = 'block';
        return;
    }
    
    let html = '';
    colaboradores.forEach(colaborador => {
        const fotoSrc = colaborador.FotoBase64 || '../Imagenes/user-default.png';
        html += `
            <div class="search-result-item" onclick="seleccionarColaborador(${colaborador.IdPersonal})">
                <img src="${fotoSrc}" alt="Foto" class="result-foto" onerror="this.src='../Imagenes/user-default.png'">
                <div class="result-info">
                    <h4>${colaborador.NombreCompleto}</h4>
                    <p>${colaborador.NombreDepartamento}</p>
                </div>
            </div>
        `;
    });
    
    contenedor.innerHTML = html;
    contenedor.style.display = 'block';
}

// Función para seleccionar colaborador
async function seleccionarColaborador(idPersonal) {
    try {
        // Mostrar indicador de carga
        Swal.fire({
            title: 'Cargando información...',
            html: '<div class="spinner" style="border: 5px solid #f3f3f3; border-top: 5px solid #FF9800; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto;"></div>',
            showConfirmButton: false,
            allowOutsideClick: false
        });
        
        // Obtener información completa
        colaboradorSeleccionado = await obtenerInfoCompleta(idPersonal);
        
        // Cerrar indicador de carga
        Swal.close();
        
        // Mostrar información del colaborador
        mostrarInfoColaborador(colaboradorSeleccionado);
        
        // Ocultar resultados de búsqueda
        document.getElementById('resultadosBusqueda').style.display = 'none';
        
    } catch (error) {
        Swal.close();
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información del colaborador: ' + error.message,
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para mostrar información del colaborador (ACTUALIZADA)
async function mostrarInfoColaborador(colaborador) {
    const contenedor = document.getElementById('infoColaborador');
    
    // Actualizar foto
    const foto = document.getElementById('fotoColaborador');
    foto.src = colaborador.FotoBase64 || '../Imagenes/user-default.png';
    foto.onerror = function() { this.src = '../Imagenes/user-default.png'; };
    
    // Actualizar información básica
    document.getElementById('nombreColaborador').textContent = colaborador.NombreCompleto;
    document.getElementById('departamentoColaborador').textContent = colaborador.NombreDepartamento;
    
    // Actualizar salario base
    const salarioBase = parseFloat(colaborador.SalarioBase) || 0;
    document.getElementById('salarioBase').textContent = formatearMoneda(salarioBase);
    
    // Actualizar planilla con estado de salida
    const planillaElement = document.getElementById('planillaInfo');
    let planillaTexto = colaborador.PlanillaCompleta;
    
    if (colaborador.EstadoSalida.tieneRegistro) {
        planillaTexto += ` - ${colaborador.EstadoSalida.tipoSalida}`;
        planillaElement.className = 'badge badge-warning';
    } else {
        planillaElement.className = 'badge badge-primary';
    }
    
    planillaElement.textContent = planillaTexto;
    
    // Actualizar fecha de planilla
    document.getElementById('fechaPlanilla').textContent = formatearFecha(colaborador.FechaPlanilla);
    
    // Actualizar tiempo laborado
    document.getElementById('tiempoLaborado').textContent = calcularTiempoLaborado(colaborador.FechaPlanilla, colaborador.EstadoSalida);
    
    // Calcular y mostrar días de aguinaldo
    const aguinaldoInfo = calcularDiasAguinaldo(colaborador.FechaPlanilla, colaborador.EstadoSalida);
    document.getElementById('diasAguinaldo').textContent = `${aguinaldoInfo.dias} días`;
    document.getElementById('periodoAguinaldo').textContent = aguinaldoInfo.periodo;
    
    // Calcular y mostrar días de vacaciones para liquidación
    const vacacionesInfo = calcularDiasVacaciones(colaborador.FechaPlanilla, colaborador.EstadoSalida);
    document.getElementById('diasVacaciones').textContent = `${vacacionesInfo.dias} días`;
    document.getElementById('periodoVacaciones').textContent = vacacionesInfo.periodo;
    
    // Calcular y mostrar días de Bono 14
    const bono14Info = calcularDiasBono14(colaborador.FechaPlanilla, colaborador.EstadoSalida);
    document.getElementById('diasBono14').textContent = `${bono14Info.dias} días`;
    document.getElementById('periodoBono14').textContent = bono14Info.periodo;
    
    // Calcular y mostrar días de vacaciones disponibles (CORREGIDO)
    try {
        const vacacionesDisponibles = await calcularDiasVacacionesDisponibles(colaborador);
        document.getElementById('diasVacacionesDisponibles').textContent = `${vacacionesDisponibles.totalDisponibles} días`;
        
        // Crear texto solo para períodos con días disponibles
        let periodoTexto = '';
        if (vacacionesDisponibles.cantidadPeriodos > 0) {
            periodoTexto = `${vacacionesDisponibles.cantidadPeriodos} período${vacacionesDisponibles.cantidadPeriodos > 1 ? 's' : ''} con días disponibles`;
            
            // Agregar desglose resumido solo de períodos con días
            const periodosTexto = vacacionesDisponibles.periodosConDias.map(item => 
                `${item.disponibles} días (${item.periodo.split(' al ')[0].split('/').reverse().join('/')}-${item.periodo.split(' al ')[1].split('/').reverse().join('/')})`
            ).join(', ');
            
            if (periodosTexto.length < 50) { // Solo mostrar si no es muy largo
                periodoTexto = periodosTexto;
            }
        } else {
            periodoTexto = 'Sin días disponibles';
        }
        
        document.getElementById('periodoVacacionesDisponibles').textContent = periodoTexto;
        
        // Actualizar estilo según disponibilidad
        const vacacionesCard = document.querySelector('.vacaciones-disponibles-card');
        if (vacacionesDisponibles.totalDisponibles === 0) {
            vacacionesCard.style.borderColor = '#FF5252';
            vacacionesCard.style.background = 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)';
        } else if (vacacionesDisponibles.totalDisponibles < 15) {
            vacacionesCard.style.borderColor = '#FF9800';
            vacacionesCard.style.background = 'linear-gradient(135deg, #fff8e1 0%, #ffffff 100%)';
        } else {
            vacacionesCard.style.borderColor = '#00BCD4';
            vacacionesCard.style.background = 'linear-gradient(135deg, #f0fdff 0%, #ffffff 100%)';
        }
        
    } catch (error) {
        console.error('Error al calcular vacaciones disponibles:', error);
        document.getElementById('diasVacacionesDisponibles').textContent = 'Error';
        document.getElementById('periodoVacacionesDisponibles').textContent = 'No se pudo calcular';
    }
    
    // Actualizar división y departamento
    document.getElementById('divisionInfo').textContent = colaborador.NombreDivision;
    document.getElementById('departamentoInfo').textContent = colaborador.NombreDepartamento;
    
    // Agregar información de fecha de salida si existe
    agregarInfoFechaSalida(colaborador.EstadoSalida);
    
    // Mostrar el contenedor
    contenedor.style.display = 'block';
    
    // Ocultar el buscador
    document.querySelector('.search-container').style.display = 'none';
    
    // Animar la aparición
    contenedor.classList.add('animate-in');
}

// Función para agregar información de fecha de salida (ACTUALIZADA para grid compacto)
function agregarInfoFechaSalida(estadoSalida) {
    const infoGrid = document.querySelector('.info-grid-compact');
    
    // Remover tarjeta de fecha de salida existente si la hay
    const tarjetaExistente = document.getElementById('tarjetaFechaSalida');
    if (tarjetaExistente) {
        tarjetaExistente.remove();
    }
    
    // Solo agregar si tiene registro de salida
    if (estadoSalida.tieneRegistro && estadoSalida.fechaFin) {
        const nuevaTarjeta = document.createElement('div');
        nuevaTarjeta.className = 'info-card-small';
        nuevaTarjeta.id = 'tarjetaFechaSalida';
        
        const iconoColor = estadoSalida.idEstado === 2 ? '#FF5252' : '#FF9800'; // Rojo para despido, naranja para renuncia
        const icono = estadoSalida.idEstado === 2 ? 'fas fa-user-times' : 'fas fa-sign-out-alt';
        
        nuevaTarjeta.innerHTML = `
            <div class="card-icon-small" style="background: linear-gradient(135deg, ${iconoColor}, ${iconoColor}CC);">
                <i class="${icono}"></i>
            </div>
            <div class="card-content-small">
                <label>Fecha Salida</label>
                <span>${formatearFecha(estadoSalida.fechaFin)}</span>
            </div>
        `;
        
        infoGrid.appendChild(nuevaTarjeta);
    }
}

// Función para mostrar el modal de liquidación
function mostrarModalLiquidacion(liquidacion, colaborador) {
    const isRenuncia = colaborador.EstadoSalida.tieneRegistro && colaborador.EstadoSalida.idEstado === 3;
    const isDespido = liquidacion.esDespido;
    const estadoTexto = isDespido ? 'Despido' : isRenuncia ? 'Renuncia' : 'Activo';
    
    // Determinar el tipo de indemnización y su fórmula
    let indemnizacionTipo, indemnizacionFormula;
    if (isDespido) {
        indemnizacionTipo = '🚫 Indemnización (Despido)';
        indemnizacionFormula = `((${formatearMoneda(liquidacion.salarioBase)} ÷ 6) + ${formatearMoneda(liquidacion.salarioBase)}) ÷ 360 × ${liquidacion.diasLaborados} días`;
    } else {
        indemnizacionTipo = '💼 Indemnización (Renuncia)';
        indemnizacionFormula = `${formatearMoneda(liquidacion.salarioBase)} ÷ 360 × ${liquidacion.diasLaborados} días`;
    }
    
    const html = `
        <div style="text-align: left; max-width: 600px;">
            <div style="display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e9ecef;">
                <div style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden; margin-right: 15px; border: 3px solid #FF9800;">
                    <img src="${colaborador.FotoBase64 || '../Imagenes/user-default.png'}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div>
                    <h3 style="margin: 0; color: #654321; font-size: 1.2rem;">${colaborador.NombreCompleto}</h3>
                    <p style="margin: 2px 0 0 0; color: #666; font-size: 0.9rem;">${colaborador.NombreDepartamento}</p>
                    <span style="background: ${isDespido ? '#FF5252' : isRenuncia ? '#FF9800' : '#4CAF50'}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; margin-top: 5px; display: inline-block;">
                        ${estadoTexto}
                    </span>
                </div>
                <div style="margin-left: auto; text-align: center;">
                    <div style="font-size: 0.8rem; color: #666; margin-bottom: 2px;">Salario Base</div>
                    <div style="font-size: 1.1rem; font-weight: bold; color: #FF9800;">${formatearMoneda(liquidacion.salarioBase)}</div>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #654321; font-size: 1rem;">📊 Resumen de Días</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; font-size: 0.85rem;">
                    <div><strong>Laborados:</strong> ${liquidacion.diasLaborados} días</div>
                    <div><strong>Aguinaldo:</strong> ${liquidacion.diasAguinaldo} días</div>
                    <div><strong>Vacaciones:</strong> ${liquidacion.diasVacaciones} días</div>
                    <div><strong>Bono 14:</strong> ${liquidacion.diasBono14} días</div>
                </div>
            </div>
            
            <!-- Formulario de descuentos -->
            <div style="background: #fff3cd; border: 1px solid #ffeeba; border-radius: 10px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 15px 0; color: #856404; font-size: 1rem;">💳 Descuento Interno</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-size: 0.9rem; color: #856404; font-weight: 600;">No. de Vale:</label>
                        <input type="text" id="numeroVale" placeholder="Ej: V-2025-001" style="width: 100%; padding: 8px 12px; border: 1px solid #ffeeba; border-radius: 5px; font-size: 0.9rem;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-size: 0.9rem; color: #856404; font-weight: 600;">Descuento Interno:</label>
                        <input type="number" id="montoDescuento" placeholder="0.00" step="0.01" min="0" style="width: 100%; padding: 8px 12px; border: 1px solid #ffeeba; border-radius: 5px; font-size: 0.9rem;">
                    </div>
                </div>
                <button type="button" id="btnAplicarDescuento" style="margin-top: 10px; background: #ffc107; color: #212529; border: none; padding: 8px 16px; border-radius: 5px; font-size: 0.9rem; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-calculator"></i> Recalcular con Descuento
                </button>
            </div>
            
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 10px; overflow: hidden;">
                <div style="background: #FF9800; color: white; padding: 10px; text-align: center;">
                    <h4 style="margin: 0; font-size: 1rem;">💰 Cálculo de Liquidación</h4>
                </div>
                
                <div style="padding: 15px;" id="calculosLiquidacion">
                    <!-- Indemnización con toggle -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; background: ${liquidacion.indemnizacionActiva ? '#fff' : '#f8f9fa'}; margin: 0 -15px; padding-left: 15px; padding-right: 15px;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <strong style="color: ${isDespido ? '#FF5252' : '#6c757d'};">${indemnizacionTipo}</strong>
                                <button type="button" id="btnToggleIndemnizacion" style="background: ${liquidacion.indemnizacionActiva ? '#dc3545' : '#28a745'}; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: 600;">
                                    ${liquidacion.indemnizacionActiva ? '✕ Quitar' : '✓ Agregar'}
                                </button>
                            </div>
                            <div style="font-size: 0.8rem; color: #666; margin-top: 2px;">
                                ${indemnizacionFormula}
                            </div>
                            ${!liquidacion.indemnizacionActiva ? '<div style="font-size: 0.75rem; color: #dc3545; margin-top: 2px; font-style: italic;"></div>' : ''}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: bold; color: ${isDespido ? '#FF5252' : '#6c757d'}; font-size: 1.1rem;" id="indemnizacionMonto">
                                ${formatearMoneda(liquidacion.indemnizacion)}
                            </div>
                            ${!liquidacion.indemnizacionActiva ? `<div style="font-size: 0.8rem; color: #666; text-decoration: line-through;">Calculado: ${formatearMoneda(liquidacion.indemnizacionCalculada)}</div>` : ''}
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
                        <div>
                            <strong style="color: #4CAF50;">🎁 Aguinaldo</strong>
                            <div style="font-size: 0.8rem; color: #666; margin-top: 2px;">
                                ${formatearMoneda(liquidacion.salarioBase)} ÷ 360 × ${liquidacion.diasAguinaldo} días
                            </div>
                        </div>
                        <div style="font-weight: bold; color: #4CAF50; font-size: 1.1rem;">
                            ${formatearMoneda(liquidacion.aguinaldo)}
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
                        <div>
                            <strong style="color: #2196F3;">🏖️ Vacaciones</strong>
                            <div style="font-size: 0.8rem; color: #666; margin-top: 2px;">
                                (${formatearMoneda(liquidacion.salarioBase)} ÷ 360 × ${liquidacion.diasVacaciones} días) ÷ 2
                            </div>
                        </div>
                        <div style="font-weight: bold; color: #2196F3; font-size: 1.1rem;">
                            ${formatearMoneda(liquidacion.vacaciones)}
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 2px solid #FF9800;">
                        <div>
                            <strong style="color: #FF9800;">💰 Bono 14</strong>
                            <div style="font-size: 0.8rem; color: #666; margin-top: 2px;">
                                ${formatearMoneda(liquidacion.salarioBase)} ÷ 360 × ${liquidacion.diasBono14} días
                            </div>
                        </div>
                        <div style="font-weight: bold; color: #FF9800; font-size: 1.1rem;">
                            ${formatearMoneda(liquidacion.bono14)}
                        </div>
                    </div>
                    
                    <!-- Subtotal -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; background: #f8f9fa; margin: 10px -15px 0 -15px; padding-left: 15px; padding-right: 15px;">
                        <div>
                            <strong style="color: #6c757d; font-size: 1.1rem;">💵 SUBTOTAL</strong>
                        </div>
                        <div style="font-weight: bold; color: #6c757d; font-size: 1.2rem;" id="subtotalMonto">
                            ${formatearMoneda(liquidacion.subtotal)}
                        </div>
                    </div>
                    
                    <!-- Descuento (solo si hay) -->
                    <div id="descuentoSection" style="display: ${liquidacion.descuentoVale > 0 ? 'flex' : 'none'}; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 2px solid #dc3545; background: #fff5f5; margin: 0 -15px; padding-left: 15px; padding-right: 15px;">
                        <div>
                            <strong style="color: #dc3545; font-size: 1.1rem;">💳 Descuento Interno</strong>
                            <div style="font-size: 0.8rem; color: #666; margin-top: 2px;" id="numeroValeDisplay">
                                Vale No: ${liquidacion.numeroVale}
                            </div>
                        </div>
                        <div style="font-weight: bold; color: #dc3545; font-size: 1.2rem;" id="descuentoMonto">
                            -${formatearMoneda(liquidacion.descuentoVale)}
                        </div>
                    </div>
                    
                    <!-- Total final -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0; background: linear-gradient(135deg, #f8f9fa, #e9ecef); margin: 10px -15px -15px -15px; padding-left: 15px; padding-right: 15px;">
                        <div>
                            <strong style="color: #654321; font-size: 1.2rem;">💵 TOTAL A PAGAR</strong>
                        </div>
                        <div style="font-weight: bold; color: #654321; font-size: 1.4rem; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);" id="totalFinalMonto">
                            ${formatearMoneda(liquidacion.total)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    Swal.fire({
        title: 'Cálculo de Liquidación',
        html: html,
        width: 700,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> Guardar Liquidación',
        cancelButtonText: '<i class="fas fa-times"></i> Cerrar',
        confirmButtonColor: '#FF9800',
        cancelButtonColor: '#6c757d',
        customClass: {
            popup: 'liquidacion-modal'
        },
        didOpen: () => {
            // Event listener para toggle de indemnización
            document.getElementById('btnToggleIndemnizacion').addEventListener('click', function() {
                // Cambiar estado de indemnización
                liquidacion.indemnizacionActiva = !liquidacion.indemnizacionActiva;
                
                // Obtener observaciones actuales si existen
                const observacionesInput = document.getElementById('observacionesIndemnizacion');
                const observacionesActuales = observacionesInput ? observacionesInput.value : '';
                
                // Recalcular liquidación
                const numeroVale = document.getElementById('numeroVale').value.trim();
                const montoDescuento = parseFloat(document.getElementById('montoDescuento').value) || 0;
                
                const descuentos = montoDescuento > 0 ? {
                    numeroVale: numeroVale,
                    monto: montoDescuento
                } : null;
                
                const liquidacionActualizada = calcularLiquidacion(colaborador, descuentos, liquidacion.indemnizacionActiva, observacionesActuales);
                Object.assign(liquidacion, liquidacionActualizada);
                
                // Reconstruir completamente la sección de indemnización
                const indemnizacionRow = this.closest('div[style*="border-bottom"]');
                
                // Determinar el tipo de indemnización
                const isDespido = liquidacion.esDespido;
                const indemnizacionTipo = isDespido ? '🚫 Indemnización (Despido)' : '💼 Indemnización (Renuncia)';
                const indemnizacionFormula = isDespido ? 
                    `((${formatearMoneda(liquidacion.salarioBase)} ÷ 6) + ${formatearMoneda(liquidacion.salarioBase)}) ÷ 360 × ${liquidacion.diasLaborados} días` :
                    `${formatearMoneda(liquidacion.salarioBase)} ÷ 360 × ${liquidacion.diasLaborados} días`;
                
                // Reconstruir HTML completo con campo de observaciones
                indemnizacionRow.innerHTML = `
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <strong style="color: ${isDespido ? '#FF5252' : '#6c757d'};">${indemnizacionTipo}</strong>
                            <button type="button" id="btnToggleIndemnizacion" style="background: ${liquidacion.indemnizacionActiva ? '#dc3545' : '#28a745'}; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: 600;">
                                ${liquidacion.indemnizacionActiva ? '✕ Quitar' : '✓ Agregar'}
                            </button>
                        </div>
                        <div style="font-size: 0.8rem; color: #666; margin-top: 2px;">
                            ${indemnizacionFormula}
                        </div>
                        ${!liquidacion.indemnizacionActiva ? `
                            <div style="font-size: 0.75rem; color: #dc3545; margin-top: 2px; font-style: italic;"></div>
                            <div style="margin-top: 8px;">
                                <label style="display: block; font-size: 0.75rem; color: #856404; font-weight: 600; margin-bottom: 4px;">
                                    Observación (máx. 255 caracteres):
                                </label>
                                <textarea 
                                    id="observacionesIndemnizacion" 
                                    placeholder="Motivo por el cual se excluye la indemnización..."
                                    maxlength="255"
                                    style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.8rem; resize: vertical; min-height: 50px; max-height: 80px;"
                                >${liquidacion.observaciones}</textarea>
                                <div style="text-align: right; font-size: 0.7rem; color: #666; margin-top: 2px;">
                                    <span id="contadorCaracteres">${liquidacion.observaciones.length}</span>/255 caracteres
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: ${isDespido ? '#FF5252' : '#6c757d'}; font-size: 1.1rem;" id="indemnizacionMonto">
                            ${formatearMoneda(liquidacion.indemnizacion)}
                        </div>
                        ${!liquidacion.indemnizacionActiva ? `<div style="font-size: 0.8rem; color: #666; text-decoration: line-through;">Calculado: ${formatearMoneda(liquidacion.indemnizacionCalculada)}</div>` : ''}
                    </div>
                `;
                
                // Actualizar el fondo
                indemnizacionRow.style.background = liquidacion.indemnizacionActiva ? '#fff' : '#f8f9fa';
                
                // Re-asignar el event listener al nuevo botón
                indemnizacionRow.querySelector('#btnToggleIndemnizacion').addEventListener('click', arguments.callee);
                
                // Agregar event listener para el contador de caracteres si el campo existe
                const observacionesTextarea = document.getElementById('observacionesIndemnizacion');
                if (observacionesTextarea) {
                    observacionesTextarea.addEventListener('input', function() {
                        const contador = document.getElementById('contadorCaracteres');
                        const caracteresActuales = this.value.length;
                        contador.textContent = caracteresActuales;
                        
                        // Cambiar color si se acerca al límite
                        if (caracteresActuales > 240) {
                            contador.style.color = '#dc3545';
                        } else if (caracteresActuales > 200) {
                            contador.style.color = '#ffc107';
                        } else {
                            contador.style.color = '#666';
                        }
                        
                        // Actualizar observaciones en la liquidación
                        liquidacion.observaciones = this.value;
                    });
                    
                    // Enfocar el textarea si se acaba de quitar la indemnización
                    if (!liquidacion.indemnizacionActiva) {
                        setTimeout(() => observacionesTextarea.focus(), 100);
                    }
                }
                
                // Actualizar totales
                document.getElementById('subtotalMonto').textContent = formatearMoneda(liquidacion.subtotal);
                document.getElementById('totalFinalMonto').textContent = formatearMoneda(liquidacion.total);
            });
            
            // Event listener para recalcular con descuento
            document.getElementById('btnAplicarDescuento').addEventListener('click', function() {
                const numeroVale = document.getElementById('numeroVale').value.trim();
                const montoDescuento = parseFloat(document.getElementById('montoDescuento').value) || 0;
                
                if (montoDescuento < 0) {
                    Swal.showValidationMessage('El monto del descuento no puede ser negativo');
                    return;
                }
                
                // Obtener observaciones actuales si existen
                const observacionesInput = document.getElementById('observacionesIndemnizacion');
                const observacionesActuales = observacionesInput ? observacionesInput.value : liquidacion.observaciones;
                
                // Recalcular liquidación con descuento
                const descuentos = {
                    numeroVale: numeroVale,
                    monto: montoDescuento
                };
                
                const liquidacionActualizada = calcularLiquidacion(colaborador, descuentos, liquidacion.indemnizacionActiva, observacionesActuales);
                
                // Actualizar los montos en el modal
                document.getElementById('subtotalMonto').textContent = formatearMoneda(liquidacionActualizada.subtotal);
                
                const descuentoSection = document.getElementById('descuentoSection');
                const numeroValeDisplay = document.getElementById('numeroValeDisplay');
                const descuentoMonto = document.getElementById('descuentoMonto');
                const totalFinalMonto = document.getElementById('totalFinalMonto');
                
                if (liquidacionActualizada.descuentoVale > 0) {
                    descuentoSection.style.display = 'flex';
                    numeroValeDisplay.textContent = `Vale No: ${liquidacionActualizada.numeroVale}`;
                    descuentoMonto.textContent = `-${formatearMoneda(liquidacionActualizada.descuentoVale)}`;
                } else {
                    descuentoSection.style.display = 'none';
                }
                
                totalFinalMonto.textContent = formatearMoneda(liquidacionActualizada.total);
                
                // Actualizar la variable liquidacion para el guardado
                Object.assign(liquidacion, liquidacionActualizada);
                
                Swal.showValidationMessage('Liquidación recalculada correctamente');
                setTimeout(() => Swal.resetValidationMessage(), 2000);
            });
        }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    // Mostrar indicador de carga
                    Swal.fire({
                        title: 'Guardando...',
                        html: 'Guardando información de liquidación...',
                        showConfirmButton: false,
                        allowOutsideClick: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });

                    // Guardar en base de datos
                    const idLiquidacion = await guardarLiquidacion(colaborador, liquidacion);

                    // Guardar vacaciones pagadas si aplica
                    let idVacacionesPagadas = null;
                    if (liquidacion.diasVacaciones > 0) {
                        try {
                            idVacacionesPagadas = await guardarVacacionesPagadas(colaborador, liquidacion, idLiquidacion);
                        } catch (vacacionesError) {
                            console.warn('Error al guardar vacaciones pagadas:', vacacionesError);
                            // Continúa sin fallar, solo registra el warning
                        }
                    }
                    
                    // Mostrar éxito
                    Swal.fire({
                        icon: 'success',
                        title: '¡Liquidación Guardada!',
                        html: `
                            <div style="text-align: center;">
                                <p><strong>Liquidación guardada exitosamente</strong></p>
                                <p>ID de registro: <span style="color: #FF9800; font-weight: bold;">#${idLiquidacion}</span></p>
                                <p style="color: #666; font-size: 0.9rem;">La información queda pendiente para generar el documento posteriormente</p>
                                ${liquidacion.diasVacaciones > 0 && idVacacionesPagadas ? `<p style="color: #4CAF50; font-size: 0.9rem;">✓ Vacaciones registradas como pagadas (${liquidacion.diasVacaciones} días)</p>` : ''}
                                ${!liquidacion.indemnizacionActiva ? `<p><span style="color: #dc3545; font-weight: bold;">⚠️ Sin indemnización</span></p>` : ''}
                                ${liquidacion.observaciones ? `<p><small style="color: #666;">Observación: ${liquidacion.observaciones.substring(0, 50)}${liquidacion.observaciones.length > 50 ? '...' : ''}</small></p>` : ''}
                                ${liquidacion.descuentoVale > 0 ? `<p>Descuento aplicado: <span style="color: #dc3545; font-weight: bold;">${formatearMoneda(liquidacion.descuentoVale)}</span></p>` : ''}
                            </div>
                        `,
                        confirmButtonColor: '#FF9800',
                        confirmButtonText: 'Entendido'
                    });
                    
                } catch (error) {
                    console.error('Error al guardar liquidación:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error al Guardar',
                        text: 'Hubo un problema al guardar la liquidación: ' + error.message,
                        confirmButtonColor: '#FF9800'
                    });
                }
            }
        });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    const inputBusqueda = document.getElementById('buscarColaborador');
    const resultadosContainer = document.getElementById('resultadosBusqueda');
    
    // Evento de búsqueda
    inputBusqueda.addEventListener('input', function() {
        const termino = this.value.trim();
        
        // Limpiar timeout anterior
        if (timeoutBusqueda) {
            clearTimeout(timeoutBusqueda);
        }
        
        if (termino.length < 2) {
            resultadosContainer.style.display = 'none';
            return;
        }
        
        // Agregar clase de carga
        this.parentElement.classList.add('loading');
        
        // Debounce de 500ms
        timeoutBusqueda = setTimeout(async () => {
            try {
                const colaboradores = await buscarColaboradores(termino);
                mostrarResultados(colaboradores);
            } catch (error) {
                console.error('Error en búsqueda:', error);
                resultadosContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #FF5252;">Error al buscar colaboradores</div>';
                resultadosContainer.style.display = 'block';
            } finally {
                inputBusqueda.parentElement.classList.remove('loading');
            }
        }, 500);
    });
    
    // Cerrar resultados al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-container')) {
            resultadosContainer.style.display = 'none';
        }
    });
    
    // Botón de nueva búsqueda
    document.getElementById('btnNuevaBusqueda').addEventListener('click', function() {
        // Mostrar el buscador
        document.querySelector('.search-container').style.display = 'block';
        
        // Ocultar información del colaborador
        document.getElementById('infoColaborador').style.display = 'none';
        
        // Limpiar búsqueda
        inputBusqueda.value = '';
        resultadosContainer.style.display = 'none';
        
        // Limpiar colaborador seleccionado
        colaboradorSeleccionado = null;
        
        // Enfocar en el input
        inputBusqueda.focus();
    });
    
    // Botón de calcular liquidación
    document.getElementById('btnCalcularLiquidacion').addEventListener('click', function() {
        if (!colaboradorSeleccionado) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Debe seleccionar un colaborador primero.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Calcular liquidación inicial (con indemnización activa por defecto)
        const liquidacion = calcularLiquidacion(colaboradorSeleccionado, null, true);
        
        // Mostrar modal con resultados
        mostrarModalLiquidacion(liquidacion, colaboradorSeleccionado);
    });
    
    // Agregar estilos de animación
    const styles = `
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .animate-in {
                animation: slideInUp 0.5s ease-out;
            }
            
            @keyframes slideInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', styles);
    if (document.getElementById('btnVerAutorizadas')) {
        liquidacionesAutorizadasManager = new LiquidacionesAutorizadas();
    }
    // Enfocar en el input al cargar
    inputBusqueda.focus();
});
//Vacaciones 
async function obtenerPeriodosConDiasDisponibles(empleado) {
    try {
        const connection = await connectionString();
        
        // Obtener la fecha actual sin problemas de zona horaria
        const fechaActual = new Date();
        fechaActual.setHours(0, 0, 0, 0);
        
        // Parsear fecha de planilla correctamente
        let fechaPlanilla;
        if (typeof empleado.FechaPlanilla === 'string') {
            const parts = empleado.FechaPlanilla.split('T')[0].split('-');
            fechaPlanilla = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            fechaPlanilla = new Date(empleado.FechaPlanilla);
        }
        
        const aniosCumplidos = Math.floor((fechaActual - fechaPlanilla) / (365.25 * 24 * 60 * 60 * 1000));
        let periodosDisponibles = [];
        
        // Iterar por cada año desde el ingreso
        for (let i = 0; i <= aniosCumplidos; i++) {
            // Calcular fecha de inicio del período (mismo día de ingreso)
            const fechaInicioPeriodo = new Date(fechaPlanilla);
            fechaInicioPeriodo.setFullYear(fechaPlanilla.getFullYear() + i);
            
            // Calcular fecha de fin del período
            const fechaFinPeriodo = new Date(fechaInicioPeriodo);
            fechaFinPeriodo.setFullYear(fechaFinPeriodo.getFullYear() + 1);
            fechaFinPeriodo.setDate(fechaFinPeriodo.getDate() - 1);
            
            // Solo considerar períodos que ya hayan iniciado
            if (fechaInicioPeriodo <= fechaActual) {
                const periodo = calcularPeriodoVacaciones(empleado.FechaPlanilla, i);
                
                // Verificar días utilizados en vacaciones tomadas
                const queryDiasTomados = `
                    SELECT COUNT(*) as DiasUtilizados
                    FROM vacacionestomadas
                    WHERE IdPersonal = ? AND Periodo = ?
                `;
                
                const resultDiasTomados = await connection.query(queryDiasTomados, [empleado.IdPersonal, periodo]);
                
                // Verificar días pagados
                const queryDiasPagados = `
                    SELECT IFNULL(SUM(CAST(DiasSolicitado AS UNSIGNED)), 0) as DiasPagados
                    FROM vacacionespagadas
                    WHERE IdPersonal = ? AND Periodo = ? AND Estado IN (1,2,3,4)
                `;
                
                const resultDiasPagados = await connection.query(queryDiasPagados, [empleado.IdPersonal, periodo]);
                
                // Convertir valores de manera segura
                let diasUtilizados = 0;
                if (resultDiasTomados && resultDiasTomados.length > 0) {
                    const valor = resultDiasTomados[0].DiasUtilizados;
                    if (valor !== null && valor !== undefined) {
                        diasUtilizados = typeof valor === 'bigint' ? Number(valor) : parseInt(valor) || 0;
                    }
                }
                
                let diasPagados = 0;
                if (resultDiasPagados && resultDiasPagados.length > 0) {
                    const valor = resultDiasPagados[0].DiasPagados;
                    if (valor !== null && valor !== undefined) {
                        diasPagados = typeof valor === 'bigint' ? Number(valor) : parseInt(valor) || 0;
                    }
                }
                
                // Calcular días disponibles
                const diasDisponibles = Math.max(0, 15 - diasUtilizados - diasPagados);
                
                // Solo agregar períodos completados
                if (fechaFinPeriodo <= fechaActual) {
                    periodosDisponibles.push({
                        periodo: periodo,
                        diasDisponibles: diasDisponibles,
                        diasUtilizados: diasUtilizados,
                        diasPagados: diasPagados,
                        totalDiasPeriodo: 15,
                        esPeriodoCompleto: true,
                        fechaInicio: fechaInicioPeriodo,
                        fechaFin: fechaFinPeriodo
                    });
                }
            }
        }
        
        await connection.close();
        return periodosDisponibles;
    } catch (error) {
        console.error('Error al obtener períodos:', error);
        return [];
    }
}
function calcularPeriodoVacaciones(fechaPlanilla, offsetAnios = 0) {
    // Convertir la fecha de planilla a un objeto Date manejando UTC
    let fechaInicioPlanilla;
    
    if (typeof fechaPlanilla === 'string') {
        // Crear fecha desde string evitando ajuste de zona horaria
        const parts = fechaPlanilla.split('T')[0].split('-');
        fechaInicioPlanilla = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
        fechaInicioPlanilla = new Date(fechaPlanilla);
    }
    
    // El período inicia el mismo día de ingreso
    const fechaInicioPeriodo = new Date(fechaInicioPlanilla);
    fechaInicioPeriodo.setFullYear(fechaInicioPlanilla.getFullYear() + offsetAnios);
    
    // El período termina un día antes del siguiente año
    const fechaFinPeriodo = new Date(fechaInicioPeriodo);
    fechaFinPeriodo.setFullYear(fechaFinPeriodo.getFullYear() + 1);
    fechaFinPeriodo.setDate(fechaFinPeriodo.getDate() - 1);
    
    // Formatear las fechas
    const formatoInicio = formatFechaBaseDatos(fechaInicioPeriodo);
    const formatoFin = formatFechaBaseDatos(fechaFinPeriodo);
    
    return `${formatoInicio} al ${formatoFin}`;
}
function formatFechaBaseDatos(fecha) {
    if (!fecha) return '';
    
    // Si es string, crear fecha sin ajuste de zona horaria
    if (typeof fecha === 'string') {
        fecha = new Date(fecha);
        // Ajustar para UTC
        const utcDate = new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
        fecha = utcDate;
    }
    
    if (!(fecha instanceof Date) || isNaN(fecha)) {
        console.error('Fecha inválida:', fecha);
        return '';
    }
    
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
async function calcularDiasVacacionesDisponibles(empleado) {
    try {
        const periodos = await obtenerPeriodosConDiasDisponibles(empleado);
        
        let totalDisponibles = 0;
        let periodosConDias = [];
        
        // Solo agregar períodos que tienen días disponibles
        periodos.forEach(periodo => {
            if (periodo.diasDisponibles > 0) {
                totalDisponibles += periodo.diasDisponibles;
                periodosConDias.push({
                    periodo: formatPeriodoUsuario(periodo.periodo),
                    disponibles: periodo.diasDisponibles,
                    esPeriodoCompleto: periodo.esPeriodoCompleto
                });
            }
        });
        
        return {
            totalDisponibles: totalDisponibles,
            periodosConDias: periodosConDias,
            cantidadPeriodos: periodosConDias.length
        };
    } catch (error) {
        console.error('Error al calcular días de vacaciones:', error);
        return {
            totalDisponibles: 0,
            periodosConDias: [],
            cantidadPeriodos: 0
        };
    }
}
function formatPeriodoUsuario(periodo) {
    if (!periodo) return '';
    
    // Si ya está en formato "YYYY-MM-DD al YYYY-MM-DD", devolverlo tal como está
    if (periodo.includes(' al ') && periodo.match(/\d{4}-\d{2}-\d{2}/)) {
        return periodo; // Devolver "2024-04-01 al 2025-03-31"
    }
    
    return periodo;
}
// Función para guardar vacaciones pagadas
async function guardarVacacionesPagadas(colaborador, liquidacion, idLiquidacion) {
    try {
        // Solo guardar si hay días de vacaciones en la liquidación
        if (liquidacion.diasVacaciones <= 0) {
            return null;
        }

        // Obtener datos del usuario actual
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const idUsuario = userData.IdPersonal || 1;
        const nombreUsuario = userData.NombreCompleto || 'Usuario Sistema';
        
        const connection = await connectionString();
        
        // Obtener el período de vacaciones disponibles (no el de liquidación)
        const vacacionesDisponibles = await calcularDiasVacacionesDisponibles(colaborador);
        
        // Si tiene períodos con días disponibles, tomar el primero (el más reciente con días)
        let periodoParaBD = '';
        if (vacacionesDisponibles.periodosConDias && vacacionesDisponibles.periodosConDias.length > 0) {
            // Tomar el primer período que tiene días disponibles
            const primerPeriodo = vacacionesDisponibles.periodosConDias[0].periodo;
            // Convertir formato "1 de abril de 2024 al 31 de marzo de 2025" a "2024-04-01 al 2025-03-31"
            periodoParaBD = convertirPeriodoAFormatoBD(primerPeriodo);
        } else {
            // Si no hay períodos disponibles, calcular el período actual del año laboral
            const fechaIngreso = colaborador.FechaPlanilla.split('T')[0].split('-');
            const añoIngreso = parseInt(fechaIngreso[0]);
            const mesIngreso = parseInt(fechaIngreso[1]);
            const diaIngreso = parseInt(fechaIngreso[2]);
            
            const fechaActual = new Date();
            const añoActual = fechaActual.getFullYear();
            
            // Calcular el año laboral actual
            let añoLaboralInicio = añoActual;
            if (fechaActual.getMonth() + 1 < mesIngreso || 
                (fechaActual.getMonth() + 1 === mesIngreso && fechaActual.getDate() < diaIngreso)) {
                añoLaboralInicio = añoActual - 1;
            }
            
            const fechaInicio = `${añoLaboralInicio}-${mesIngreso.toString().padStart(2, '0')}-${diaIngreso.toString().padStart(2, '0')}`;
            const fechaFin = `${añoLaboralInicio + 1}-${mesIngreso.toString().padStart(2, '0')}-${(diaIngreso - 1).toString().padStart(2, '0')}`;
            
            periodoParaBD = `${fechaInicio} al ${fechaFin}`;
        }
        
        // Asegurar que los días solicitados no excedan 15
        const diasASolicitar = Math.min(liquidacion.diasVacaciones, 15);
        
        const result = await connection.query(`
            INSERT INTO vacacionespagadas (
                IdPersonal, 
                NombreColaborador, 
                DiasSolicitado, 
                Periodo, 
                IdPlanilla, 
                IdDepartamento, 
                IdUsuario, 
                NombreUsuario,
                IdLiquidacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            colaborador.IdPersonal,
            colaborador.NombreCompleto,
            diasASolicitar.toString(),
            periodoParaBD, // Formato: 2024-04-01 al 2025-03-31
            colaborador.IdPlanilla || null,
            colaborador.IdSucuDepa || null,
            idUsuario,
            nombreUsuario,
            idLiquidacion
        ]);
        
        await connection.close();
        return result.insertId;
        
    } catch (error) {
        console.error('Error al guardar vacaciones pagadas:', error);
        throw error;
    }
}
function convertirPeriodoAFormatoBD(periodoTexto) {
    try {
        // Ejemplo de entrada: "1 de abril de 2024 al 31 de marzo de 2025"
        const partes = periodoTexto.split(' al ');
        if (partes.length !== 2) return periodoTexto;
        
        const fechaInicio = partes[0].trim();
        const fechaFin = partes[1].trim();
        
        // Convertir cada fecha
        const fechaInicioBD = convertirFechaTextoABD(fechaInicio);
        const fechaFinBD = convertirFechaTextoABD(fechaFin);
        
        return `${fechaInicioBD} al ${fechaFinBD}`;
    } catch (error) {
        console.error('Error al convertir período:', error);
        return periodoTexto; // Devolver original si falla
    }
}

// Función auxiliar para convertir fecha de texto a formato BD
function convertirFechaTextoABD(fechaTexto) {
    try {
        // Ejemplo: "1 de abril de 2024" -> "2024-04-01"
        const meses = {
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
            'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
            'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        };
        
        const partes = fechaTexto.split(' de ');
        if (partes.length !== 3) return fechaTexto;
        
        const dia = partes[0].trim().padStart(2, '0');
        const mes = meses[partes[1].trim().toLowerCase()];
        const año = partes[2].trim();
        
        return `${año}-${mes}-${dia}`;
    } catch (error) {
        console.error('Error al convertir fecha:', error);
        return fechaTexto;
    }
}
class LiquidacionesAutorizadas {
    constructor() {
        this.modal = document.getElementById('modalAutorizadas');
        this.tabla = document.getElementById('tablaAutorizadas');
        this.tbody = document.getElementById('tablaAutorizadasBody');
        this.loadingIndicator = document.getElementById('loadingAutorizadas');
        this.sinResultados = document.getElementById('sinAutorizadas');
        this.contador = document.getElementById('contadorAutorizadas');
        this.searchInput = document.getElementById('buscarAutorizadas');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Abrir modal
        document.getElementById('btnVerAutorizadas').addEventListener('click', () => {
            this.abrirModal();
        });
        
        // Cerrar modal
        document.getElementById('cerrarModalAutorizadas').addEventListener('click', () => {
            this.cerrarModal();
        });
        
        // Cerrar al hacer clic fuera
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.cerrarModal();
            }
        });
        
        // Búsqueda
        this.searchInput.addEventListener('input', (e) => {
            this.filtrarLiquidaciones(e.target.value);
        });
        
        // Escape para cerrar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.cerrarModal();
            }
        });
    }
    
    async abrirModal() {
        this.modal.style.display = 'block';
        setTimeout(() => {
            this.modal.classList.add('show');
        }, 10);
        
        await this.cargarLiquidacionesAutorizadas();
    }
    
    cerrarModal() {
        this.modal.classList.remove('show');
        setTimeout(() => {
            this.modal.style.display = 'none';
            this.limpiarBusqueda();
        }, 300);
    }
    
    limpiarBusqueda() {
        this.searchInput.value = '';
        liquidacionesAutorizadasFiltradas = [...liquidacionesAutorizadas];
        this.actualizarContador();
    }
    
    async cargarLiquidacionesAutorizadas() {
        try {
            this.mostrarCarga(true);
            
            const liquidaciones = await this.obtenerLiquidacionesAutorizadas();
            liquidacionesAutorizadas = liquidaciones;
            liquidacionesAutorizadasFiltradas = [...liquidaciones];
            
            this.renderizarTabla();
            this.actualizarContador();
            
        } catch (error) {
            console.error('Error al cargar liquidaciones autorizadas:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Error al cargar datos',
                text: 'No se pudieron cargar las liquidaciones autorizadas: ' + error.message,
                confirmButtonColor: '#FF9800'
            });
        } finally {
            this.mostrarCarga(false);
        }
    }
    
    async obtenerLiquidacionesAutorizadas() {
        try {
            const connection = await connectionString();
            
            const result = await connection.query(`
                SELECT
                    l.IdLiquidacion, 
                    l.IdPersonal,
                    l.NombrePersonal, 
                    l.FechaPlanilla, 
                    l.MontoIndemnizacion, 
                    l.MontoAguinaldo, 
                    l.MontoVacaciones, 
                    l.MontoBono14, 
                    l.NombreUsuario, 
                    l.FechaHoraRegistro, 
                    l.Observaciones, 
                    l.NoVale, 
                    l.DescuentoInterno,
                    l.IndemnizacionSiNo,
                    l.NombreUsuarioAutoriza,
                    l.FechaHoraAutoriza,
                    l.Estado,
                    -- Información adicional del colaborador
                    p.DPI,
                    p.SalarioBase,
                    p.IdDepartamentoOrigen,
                    p.IdMunicipioOrigen,
                    p.IdPlanilla,
                    p.IdSucuDepa,
                    p.SalarioDiario,
                    dpto.NombreDepartamento,
                    puestos.Nombre as NombrePuesto,
                    planillas.Nombre_Planilla,
                    planillas.Division,
                    divisiones.Nombre as NombreDivision,
                    CASE 
                        WHEN divisiones.Logos IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(divisiones.Logos))
                        ELSE NULL 
                    END AS LogoDivision,
                    deptoOrigen.NombreDepartamento AS DepartamentoOrigen,
                    municipios.NombreMunicipio AS MunicipioOrigen
                FROM
                    Liquidaciones l
                    LEFT JOIN personal p ON l.IdPersonal = p.IdPersonal
                    LEFT JOIN FotosPersonal ON p.IdPersonal = FotosPersonal.IdPersonal
                    LEFT JOIN departamentos dpto ON p.IdSucuDepa = dpto.IdDepartamento
                    LEFT JOIN planillas ON p.IdPlanilla = planillas.IdPlanilla
                    LEFT JOIN Puestos puestos ON p.IdPuesto = puestos.IdPuesto
                    LEFT JOIN divisiones ON planillas.Division = divisiones.IdDivision
                    LEFT JOIN departamentosguatemala deptoOrigen ON p.IdDepartamentoOrigen = deptoOrigen.IdDepartamentoG
                    LEFT JOIN municipios ON p.IdMunicipioOrigen = municipios.IdMunicipio
                WHERE
                    l.Estado = 1
                ORDER BY 
                    l.FechaHoraAutoriza DESC
            `);
            
            await connection.close();
            
            // Calcular total para cada liquidación
            return result.map(liquidacion => ({
                ...liquidacion,
                Total: this.calcularTotalAutorizada(liquidacion)
            }));
            
        } catch (error) {
            console.error('Error al obtener liquidaciones autorizadas:', error);
            throw error;
        }
    }
    
    calcularTotalAutorizada(liquidacion) {
        const indemnizacion = parseFloat(liquidacion.MontoIndemnizacion) || 0;
        const aguinaldo = parseFloat(liquidacion.MontoAguinaldo) || 0;
        const vacaciones = parseFloat(liquidacion.MontoVacaciones) || 0;
        const bono14 = parseFloat(liquidacion.MontoBono14) || 0;
        // No restar el descuento del total
        
        return indemnizacion + aguinaldo + vacaciones + bono14;
    }
    
    filtrarLiquidaciones(termino) {
        if (timeoutBusquedaAutorizadas) {
            clearTimeout(timeoutBusquedaAutorizadas);
        }
        
        timeoutBusquedaAutorizadas = setTimeout(() => {
            if (!termino.trim()) {
                liquidacionesAutorizadasFiltradas = [...liquidacionesAutorizadas];
            } else {
                const terminoLower = termino.toLowerCase();
                liquidacionesAutorizadasFiltradas = liquidacionesAutorizadas.filter(liquidacion => {
                    return (
                        liquidacion.IdLiquidacion.toString().includes(terminoLower) ||
                        liquidacion.NombrePersonal.toLowerCase().includes(terminoLower) ||
                        liquidacion.NombreUsuario.toLowerCase().includes(terminoLower) ||
                        liquidacion.NombreUsuarioAutoriza.toLowerCase().includes(terminoLower) ||
                        this.formatearMoneda(liquidacion.Total).toLowerCase().includes(terminoLower)
                    );
                });
            }
            
            this.renderizarTabla();
            this.actualizarContador();
        }, 300);
    }
    
    renderizarTabla() {
        if (liquidacionesAutorizadasFiltradas.length === 0) {
            this.mostrarSinResultados(true);
            return;
        }
        
        this.mostrarSinResultados(false);
        
        let html = '';
        liquidacionesAutorizadasFiltradas.forEach(liquidacion => {
            html += this.crearFilaAutorizada(liquidacion);
        });
        
        this.tbody.innerHTML = html;
    }
    
    crearFilaAutorizada(liquidacion) {
        const fechaIngreso = this.formatearFecha(liquidacion.FechaPlanilla);
        const fechaAutoriza = this.formatearFechaHora(liquidacion.FechaHoraAutoriza);
        
        return `
            <tr data-id="${liquidacion.IdLiquidacion}">
                <td class="font-weight-bold">#${liquidacion.IdLiquidacion}</td>
                <td class="text-truncate" title="${liquidacion.NombrePersonal}">
                    <strong>${liquidacion.NombrePersonal}</strong>
                </td>
                <td>${fechaIngreso}</td>
                <td class="text-right">
                    <span class="monto total">${this.formatearMoneda(liquidacion.Total)}</span>
                    ${liquidacion.DescuentoInterno > 0 ? 
                        `<br><small class="text-muted" style="font-style: italic;">Descuento: ${this.formatearMoneda(liquidacion.DescuentoInterno)} (info)</small>` 
                        : ''
                    }
                </td>
                <td class="text-truncate" title="${liquidacion.NombreUsuarioAutoriza}">
                    ${liquidacion.NombreUsuarioAutoriza}
                </td>
                <td>${fechaAutoriza}</td>
                <td>
                    <span class="estado-autorizado">
                        <i class="fas fa-check"></i>
                        Autorizada
                    </span>
                </td>
                <td class="text-center">
                    <button type="button" class="btn-pdf" 
                            onclick="generarPDFAutorizada(${liquidacion.IdLiquidacion})" 
                            title="Generar PDF">
                        <i class="fas fa-file-pdf"></i>
                        PDF
                    </button>
                </td>
            </tr>
        `;
    }
    
    mostrarCarga(mostrar) {
        if (mostrar) {
            this.loadingIndicator.style.display = 'flex';
            this.tabla.style.display = 'none';
            this.sinResultados.style.display = 'none';
        } else {
            this.loadingIndicator.style.display = 'none';
        }
    }
    
    mostrarSinResultados(mostrar) {
        if (mostrar) {
            this.sinResultados.style.display = 'flex';
            this.tabla.style.display = 'none';
        } else {
            this.sinResultados.style.display = 'none';
            this.tabla.style.display = 'table';
        }
    }
    
    actualizarContador() {
        const total = liquidacionesAutorizadas.length;
        const filtrados = liquidacionesAutorizadasFiltradas.length;
        
        if (total === 0) {
            this.contador.textContent = 'Sin liquidaciones autorizadas';
        } else if (filtrados === total) {
            this.contador.textContent = `${total} liquidación${total > 1 ? 'es' : ''} autorizada${total > 1 ? 's' : ''}`;
        } else {
            this.contador.textContent = `${filtrados} de ${total} liquidaciones`;
        }
    }
    
    formatearMoneda(valor) {
        if (!valor || isNaN(valor)) return 'Q 0.00';
        
        const numero = parseFloat(valor);
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: 'GTQ',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numero);
    }
    
    formatearFecha(fecha) {
        if (!fecha) return 'N/A';
        
        try {
            const fechaObj = new Date(fecha);
            return fechaObj.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Fecha inválida';
        }
    }
    
    formatearFechaHora(fechaHora) {
        if (!fechaHora) return 'N/A';
        
        try {
            const fechaObj = new Date(fechaHora);
            return fechaObj.toLocaleString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Fecha inválida';
        }
    }
}
async function generarPDFAutorizada(idLiquidacion) {
    try {
        // Mostrar indicador de carga
        Swal.fire({
            title: 'Validando...',
            html: 'Verificando estado de vacaciones pagadas...',
            showConfirmButton: false,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Validar vacaciones pagadas primero
        const validacionVacaciones = await validarVacacionesPagadas(idLiquidacion);
        
        if (!validacionVacaciones.puedeGenerar) {
            Swal.close();
            await Swal.fire({
                icon: 'warning',
                title: 'No se puede generar PDF',
                text: validacionVacaciones.mensaje,
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Actualizar mensaje de carga
        Swal.update({
            title: 'Generando PDFs...',
            html: 'Preparando documentos de liquidación...'
        });
        
        // Buscar la liquidación en los datos cargados
        const liquidacion = liquidacionesAutorizadas.find(l => l.IdLiquidacion === idLiquidacion);
        
        if (!liquidacion) {
            throw new Error('Liquidación no encontrada');
        }
        
        // Preparar datos (código existente...)
        const estadoSalidaReal = await verificarDespidoRenuncia(liquidacion.IdPersonal);

        const colaboradorData = {
            IdPersonal: liquidacion.IdPersonal,
            NombreCompleto: liquidacion.NombrePersonal,
            FechaPlanilla: liquidacion.FechaPlanilla,
            SalarioBase: parseFloat(liquidacion.SalarioBase) || calcularSalarioBase(liquidacion),
            SalarioDiario: parseFloat(liquidacion.SalarioDiario) || 0,
            FotoBase64: liquidacion.FotoBase64,
            EstadoSalida: estadoSalidaReal // Usar el estado real en lugar del forzado
        };
        
        const salarioBaseReal = parseFloat(liquidacion.SalarioBase) || calcularSalarioBase(liquidacion);
        const montoIndemnizacion = parseFloat(liquidacion.MontoIndemnizacion) || 0;

        // Si la indemnización es mayor que el salario base simple, probablemente es despido
        const indemnizacionSimple = (salarioBaseReal / 360) * calcularDiasLaboradosFromDB(liquidacion);
        const indemnizacionDespido = ((salarioBaseReal + (salarioBaseReal / 6)) / 360) * calcularDiasLaboradosFromDB(liquidacion);

        const esDespidoCalculado = Math.abs(montoIndemnizacion - indemnizacionDespido) < Math.abs(montoIndemnizacion - indemnizacionSimple);

        const liquidacionData = {
            salarioBase: salarioBaseReal,
            indemnizacion: montoIndemnizacion,
            indemnizacionActiva: liquidacion.IndemnizacionSiNo === 1,
            aguinaldo: parseFloat(liquidacion.MontoAguinaldo) || 0,
            vacaciones: parseFloat(liquidacion.MontoVacaciones) || 0,
            bono14: parseFloat(liquidacion.MontoBono14) || 0,
            subtotal: liquidacion.Total,
            descuentoVale: parseFloat(liquidacion.DescuentoInterno) || 0,
            numeroVale: liquidacion.NoVale || '',
            total: liquidacion.Total,
            diasLaborados: calcularDiasLaboradosFromDB(liquidacion),
            diasAguinaldo: calcularDiasFromMonto(liquidacion.MontoAguinaldo, salarioBaseReal),
            diasVacaciones: calcularDiasVacacionesFromMonto(liquidacion.MontoVacaciones, salarioBaseReal),
            diasBono14: calcularDiasFromMonto(liquidacion.MontoBono14, salarioBaseReal),
            esDespido: esDespidoCalculado,  // CALCULADO DINÁMICAMENTE
            esRenuncia: !esDespidoCalculado,
            observaciones: liquidacion.Observaciones || ''
        };
        
        const infoCompleta = {
            DPI: liquidacion.DPI,
            NombreDivision: liquidacion.NombreDivision || 'Surtidora de Mercados, S.A.',
            LogoDivision: liquidacion.LogoDivision,
            DepartamentoOrigen: liquidacion.DepartamentoOrigen,
            MunicipioOrigen: liquidacion.MunicipioOrigen,
            NombreDepartamento: liquidacion.NombreDepartamento,
            NombrePuesto: liquidacion.NombrePuesto,  
            Nombre_Planilla: liquidacion.Nombre_Planilla,
            NombreUsuarioAutoriza: liquidacion.NombreUsuarioAutoriza
        };
        
        // Generar PDF de liquidación
        await generarPDFLiquidacion(colaboradorData, liquidacionData, infoCompleta);
        
        // Esperar un momento y generar resumen
        setTimeout(async () => {
            try {
                // Solicitar nombres de las firmas
                const firmasInfo = await solicitarNombresFirmas();
                
                if (!firmasInfo) {
                    // Usuario canceló
                    Swal.close();
                    await Swal.fire({
                        icon: 'info',
                        title: 'Operación cancelada',
                        text: 'Se generó la liquidación pero se canceló la generación del resumen.',
                        confirmButtonColor: '#FF9800'
                    });
                    return;
                }
                
                // Generar resumen con las firmas
                await generarPDFResumen(colaboradorData, liquidacionData, infoCompleta, validacionVacaciones, firmasInfo);
                
                Swal.close();
                await Swal.fire({
                    icon: 'success',
                    title: '¡PDFs Generados!',
                    html: `
                        <div style="text-align: center;">
                            <p><strong>Se han generado los siguientes documentos:</strong></p>
                            <p>✓ Liquidación laboral detallada</p>
                            <p>✓ Resumen de liquidación</p>
                            ${validacionVacaciones.tieneVacaciones ? '<p>✓ Incluye pago de vacaciones autorizadas</p>' : ''}
                        </div>
                    `,
                    confirmButtonColor: '#FF9800'
                });
            } catch (resumenError) {
                console.error('Error al generar resumen:', resumenError);
                await Swal.fire({
                    icon: 'warning',
                    title: 'Liquidación generada',
                    text: 'La liquidación se generó correctamente, pero hubo un error al generar el resumen.',
                    confirmButtonColor: '#FF9800'
                });
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        Swal.close();
        await Swal.fire({
            icon: 'error',
            title: 'Error al generar PDF',
            text: 'No se pudo generar el PDF: ' + error.message,
            confirmButtonColor: '#FF9800'
        });
    }
}
function calcularSalarioBase(liquidacion) {
    // PRIMERO: Intentar obtener el salario base real de la tabla personal
    if (liquidacion.SalarioBase && liquidacion.SalarioBase > 0) {
        return parseFloat(liquidacion.SalarioBase);
    }
    
    // SEGUNDO: Si no está disponible, calcular desde los montos guardados
    const aguinaldo = parseFloat(liquidacion.MontoAguinaldo) || 0;
    const diasAguinaldo = calcularDiasFromMonto(aguinaldo, 1); // Calcular días aproximados
    
    if (aguinaldo > 0 && diasAguinaldo > 0) {
        return (aguinaldo * 360) / diasAguinaldo;
    }
    
    // ÚLTIMO RECURSO: usar una estimación básica
    const total = liquidacion.Total || 0;
    return total * 0.25; // Estimación más conservadora
}

function calcularDiasLaboradosFromDB(liquidacion) {
    if (!liquidacion.FechaPlanilla) {
        console.log('No hay fecha de planilla, retornando 360');
        return 360;
    }
    
    try {
        // Método 1: Calcular desde fecha
        const fechaString = liquidacion.FechaPlanilla.split('T')[0];
        const [añoInicio, mesInicio, diaInicio] = fechaString.split('-').map(Number);
        
        const fechaActual = new Date();
        const añoFinal = fechaActual.getFullYear();
        const mesFinal = fechaActual.getMonth() + 1;
        const diaFinal = fechaActual.getDate();
        
        console.log('Fecha inicio:', { año: añoInicio, mes: mesInicio, dia: diaInicio });
        console.log('Fecha actual:', { año: añoFinal, mes: mesFinal, dia: diaFinal });
        
        const fechaInicio = { año: añoInicio, mes: mesInicio, dia: diaInicio };
        const fechaFin = { año: añoFinal, mes: mesFinal, dia: diaFinal };
        
        const diferencia = calcularDiferenciasComerciales(fechaInicio, fechaFin);
        
        const diasPorFecha = Math.min(diferencia.diasTotales, 360 * 10);
        
        // Método 2: Calcular desde indemnización
        const salarioBase = parseFloat(liquidacion.SalarioBase) || 0;
        const montoIndemnizacion = parseFloat(liquidacion.MontoIndemnizacion) || 0;
        
        if (salarioBase > 0 && montoIndemnizacion > 0) {
            const esDespido = liquidacion.IndemnizacionSiNo === 1;
            let diasPorIndemnizacion;
            
            if (esDespido) {
                const salarioConSexta = salarioBase + (salarioBase / 6);
                diasPorIndemnizacion = Math.round((montoIndemnizacion * 360) / salarioConSexta);
            } else {
                diasPorIndemnizacion = Math.round((montoIndemnizacion * 360) / salarioBase);
            }
            
            console.log('Días por indemnización:', diasPorIndemnizacion);
            
            // Usar el método más razonable
            if (diasPorIndemnizacion > 0 && diasPorIndemnizacion <= 3600) {
                return diasPorIndemnizacion;
            }
        }
        return diasPorFecha;
        
    } catch (error) {
        console.error('Error al calcular días laborados:', error);
        return 360;
    }
}

function calcularDiasFromMonto(monto, salarioBase) {
    if (!monto || !salarioBase || salarioBase === 0) return 0;
    
    // Fórmula inversa: días = (monto * 360) / salarioBase
    const dias = Math.round((parseFloat(monto) * 360) / salarioBase);
    return Math.min(Math.max(dias, 0), 360); // Entre 0 y 360 días
}

function calcularDiasVacacionesFromMonto(monto, salarioBase) {
    if (!monto || !salarioBase || salarioBase === 0) return 0;
    
    // Para vacaciones: monto = (SalarioBase / 360 * días) / 2
    // Entonces: días = (monto * 2 * 360) / salarioBase
    const dias = Math.round((parseFloat(monto) * 2 * 360) / salarioBase);
    return Math.min(Math.max(dias, 0), 360);
}
//validaciones antes de generar documentos ya con resumen
async function validarVacacionesPagadas(idLiquidacion) {
    try {
        const connection = await connectionString();
        
        // Verificar si hay vacaciones pagadas asociadas
        const vacacionesPagadas = await connection.query(`
            SELECT
                vacacionespagadas.Idpagovacas, 
                vacacionespagadas.NombreColaborador, 
                vacacionespagadas.DiasSolicitado, 
                vacacionespagadas.Periodo, 
                planillas.Nombre_Planilla, 
                departamentos.NombreDepartamento, 
                vacacionespagadas.TotalaRecibir,
                vacacionespagadas.Estado
            FROM
                vacacionespagadas
                INNER JOIN planillas ON vacacionespagadas.IdPlanilla = planillas.IdPlanilla
                INNER JOIN departamentos ON vacacionespagadas.IdDepartamento = departamentos.IdDepartamento
            WHERE
                vacacionespagadas.IdLiquidacion = ?
        `, [idLiquidacion]);
        
        await connection.close();
        
        if (vacacionesPagadas.length === 0) {
            // No hay vacaciones pagadas asociadas - OK para proceder
            return {
                puedeGenerar: true,
                tieneVacaciones: false,
                vacaciones: null,
                mensaje: 'Sin vacaciones pagadas asociadas'
            };
        }
        
        const vacacion = vacacionesPagadas[0];
        
        // Verificar si está autorizada (Estado 2, 3 o 4)
        if ([2, 3, 4].includes(vacacion.Estado)) {
            return {
                puedeGenerar: true,
                tieneVacaciones: true,
                vacaciones: vacacion,
                mensaje: 'Vacaciones autorizadas - puede proceder'
            };
        } else {
            return {
                puedeGenerar: false,
                tieneVacaciones: true,
                vacaciones: vacacion,
                mensaje: 'Las vacaciones pagadas aún no están autorizadas'
            };
        }
        
    } catch (error) {
        console.error('Error al validar vacaciones pagadas:', error);
        throw error;
    }
}
async function generarPDFResumen(colaborador, liquidacion, infoCompleta, vacacionesInfo = null, firmasInfo = null) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración inicial
        let yPosition = 20;
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        
        // Colores
        const grisOscuro = [52, 52, 52];
        const grisTexto = [85, 85, 85];
        const grisTitulo = [68, 68, 68];
        const azulHeader = [41, 128, 185];
        
        // Función para texto centrado
        const centrarTexto = (texto, y, fontSize = 12, color = grisTexto, style = 'normal') => {
            doc.setFontSize(fontSize);
            doc.setFont(undefined, style);
            doc.setTextColor(color[0], color[1], color[2]);
            const textWidth = doc.getTextWidth(texto);
            const x = (pageWidth - textWidth) / 2;
            doc.text(texto, x, y);
            return y + (fontSize * 0.6);
        };
        
        // Función para texto izquierda
        const textoIzq = (texto, x, y, fontSize = 10, color = grisTexto, style = 'normal') => {
            doc.setFontSize(fontSize);
            doc.setFont(undefined, style);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(texto, x, y);
        };
        
        // Función para texto derecha
        const textoDer = (texto, x, y, fontSize = 10, color = grisTexto, style = 'normal') => {
            doc.setFontSize(fontSize);
            doc.setFont(undefined, style);
            doc.setTextColor(color[0], color[1], color[2]);
            const textWidth = doc.getTextWidth(texto);
            doc.text(texto, x - textWidth, y);
        };
        
        // === HEADER ===
        if (infoCompleta.LogoDivision) {
            try {
                doc.addImage(infoCompleta.LogoDivision, 'JPEG', margin, yPosition, 35, 18, undefined, 'MEDIUM');
            } catch (e) {
                textoIzq('LOGO', margin, yPosition + 10, 10, grisTexto, 'bold');
            }
        }
        
        textoDer(infoCompleta.NombreDivision || 'Surtidora de Mercados, S.A.', pageWidth - margin, yPosition + 12, 11, grisTexto, 'bold');
        
        yPosition = 45;
        
        // === TÍTULO ===
        doc.setFillColor(azulHeader[0], azulHeader[1], azulHeader[2]);
        doc.rect(margin, yPosition, contentWidth, 12, 'F');
        centrarTexto('RESUMEN DE LIQUIDACIÓN', yPosition + 8, 12, [255, 255, 255], 'bold');
        yPosition += 20;
        
        // === INFORMACIÓN DEL COLABORADOR ===
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPosition, contentWidth, 35, 'F');
        
        yPosition += 8;
        textoIzq('COLABORADOR:', margin + 5, yPosition, 10, grisTitulo, 'bold');
        textoIzq(colaborador.NombreCompleto.toUpperCase(), margin + 65, yPosition, 11, grisOscuro, 'bold');
        
        yPosition += 8;
        textoIzq('PUESTO:', margin + 5, yPosition, 10, grisTitulo, 'bold');
        textoIzq(infoCompleta.NombrePuesto || 'No especificado', margin + 65, yPosition, 10, grisTexto);
        
        yPosition += 8;
        textoIzq('PLANILLA:', margin + 5, yPosition, 10, grisTitulo, 'bold');
        textoIzq(infoCompleta.Nombre_Planilla || 'No especificada', margin + 65, yPosition, 10, grisTexto);
        
        yPosition += 8;
        textoIzq('FECHA:', margin + 5, yPosition, 10, grisTitulo, 'bold');
        textoIzq(new Date().toLocaleDateString('es-ES'), margin + 65, yPosition, 10, grisTexto);

        yPosition += 8;
        textoIzq('AUTORIZADO POR:', margin + 5, yPosition, 10, grisTitulo, 'bold');
        const nombreAutoriza = liquidacion.NombreUsuarioAutoriza || 
                            infoCompleta.NombreUsuarioAutoriza || 
                            'N/A';
        textoIzq(nombreAutoriza, margin + 65, yPosition, 10, grisTexto);

        yPosition += 20;
        
        // === CONCEPTOS DE PAGO ===
        doc.setFillColor(azulHeader[0], azulHeader[1], azulHeader[2]);
        doc.rect(margin, yPosition, contentWidth, 10, 'F');
        textoIzq('CONCEPTOS DE PAGO', margin + 5, yPosition + 7, 10, [255, 255, 255], 'bold');
        yPosition += 15;
        
        // Línea de encabezado
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 8;
        
        // LIQUIDACIÓN
        textoIzq('LIQUIDACIÓN LABORAL', margin + 5, yPosition, 11, grisTitulo, 'bold');
        textoDer(formatearMoneda(liquidacion.total), pageWidth - margin - 5, yPosition, 11, grisOscuro, 'bold');
        yPosition += 10;
        
        // VACACIONES (si existen)
        if (vacacionesInfo && vacacionesInfo.tieneVacaciones) {
            textoIzq('PAGO DE VACACIONES', margin + 5, yPosition, 11, grisTitulo, 'bold');
            const montoVacaciones = parseFloat(vacacionesInfo.vacaciones.TotalaRecibir) || 0;
            textoDer(formatearMoneda(montoVacaciones), pageWidth - margin - 5, yPosition, 11, grisOscuro, 'bold');
            yPosition += 6;
            textoIzq(`Días: ${vacacionesInfo.vacaciones.DiasSolicitado} - Período: ${vacacionesInfo.vacaciones.Periodo}`, margin + 10, yPosition, 8, grisTexto);
            yPosition += 12;
        }
        
        // DESCUENTO (si existe)
        if (liquidacion.descuentoVale > 0) {
            textoIzq('DESCUENTO INTERNO', margin + 5, yPosition, 11, grisTitulo, 'bold');
            textoDer(`-${formatearMoneda(liquidacion.descuentoVale)}`, pageWidth - margin - 5, yPosition, 11, [220, 53, 69], 'bold');
            yPosition += 6;
            textoIzq(`Vale No: ${liquidacion.numeroVale || 'N/A'}`, margin + 10, yPosition, 8, grisTexto);
            yPosition += 12;
        }
        
        // Línea separadora
        doc.setDrawColor(azulHeader[0], azulHeader[1], azulHeader[2]);
        doc.setLineWidth(1);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;
        
        // === TOTAL ===
        doc.setFillColor(230, 245, 255);
        doc.rect(margin, yPosition, contentWidth, 15, 'F');
        
        textoIzq('LÍQUIDO A RECIBIR', margin + 5, yPosition + 10, 14, azulHeader, 'bold');
        
        // Calcular total final
        const montoLiquidacion = liquidacion.total;
        const montoVacaciones = (vacacionesInfo && vacacionesInfo.tieneVacaciones) ? 
            parseFloat(vacacionesInfo.vacaciones.TotalaRecibir) || 0 : 0;
        const descuento = liquidacion.descuentoVale || 0;
        const totalFinal = montoLiquidacion + montoVacaciones - descuento;
        
        textoDer(formatearMoneda(totalFinal), pageWidth - margin - 5, yPosition + 10, 14, azulHeader, 'bold');
        yPosition += 25;
        yPosition += 15; // Reducido de 30 a 15

        // Líneas de firma
        const anchoFirma = 60;
        const espacioEntreFirmas = 15;
        const xPrimera = margin + 20;
        const xSegunda = pageWidth - margin - 20 - anchoFirma;

        doc.setLineWidth(0.5);
        doc.setDrawColor(grisTitulo[0], grisTitulo[1], grisTitulo[2]);
        doc.line(xPrimera, yPosition, xPrimera + anchoFirma, yPosition);
        doc.line(xSegunda, yPosition, xSegunda + anchoFirma, yPosition);

        yPosition += 8;

        // Nombres de las firmas (usando los parámetros recibidos)
        const nombreFirma1 = (firmasInfo && firmasInfo.firma1) ? firmasInfo.firma1.toUpperCase() : 'FIRMA 1';
        const cargoFirma1 = (firmasInfo && firmasInfo.cargo1) ? firmasInfo.cargo1.toUpperCase() : 'CARGO 1';
        const nombreFirma2 = (firmasInfo && firmasInfo.firma2) ? firmasInfo.firma2.toUpperCase() : 'FIRMA 2';
        const cargoFirma2 = (firmasInfo && firmasInfo.cargo2) ? firmasInfo.cargo2.toUpperCase() : 'CARGO 2';

        // Ajustar texto para que quepa en el espacio
        const fontSize1 = nombreFirma1.length > 25 ? 7 : 8;
        const fontSize2 = nombreFirma2.length > 25 ? 7 : 8;

        // Función para centrar texto en un área específica
        const centrarTextoEnArea = (texto, xInicio, anchoArea, y, fontSize, color, style = 'normal') => {
            doc.setFontSize(fontSize);
            doc.setFont(undefined, style);
            doc.setTextColor(color[0], color[1], color[2]);
            const textWidth = doc.getTextWidth(texto);
            const xCentrado = xInicio + (anchoArea - textWidth) / 2;
            doc.text(texto, xCentrado, y);
        };

        // Centrar nombres de las firmas
        centrarTextoEnArea(nombreFirma1, xPrimera, anchoFirma, yPosition, fontSize1, grisTitulo, 'bold');
        centrarTextoEnArea(nombreFirma2, xSegunda, anchoFirma, yPosition, fontSize2, grisTitulo, 'bold');

        yPosition += 6;

        // Centrar cargos de las firmas
        centrarTextoEnArea(cargoFirma1, xPrimera, anchoFirma, yPosition, 7, grisTexto);
        centrarTextoEnArea(cargoFirma2, xSegunda, anchoFirma, yPosition, 7, grisTexto);

        yPosition += 15; // Espacio después de las firmas
        if (yPosition > pageHeight - 40) {
            yPosition = pageHeight - 25; // Si no hay espacio, ponerlo en posición fija
        }
        doc.setLineWidth(0.3);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        
        centrarTexto('Sistema de Recursos Humanos - Resumen de Liquidación', yPosition + 8, 8, grisTexto);
        centrarTexto(`© ${infoCompleta.NombreDivision || 'New Technology'} ${new Date().getFullYear()}`, yPosition + 12, 7, grisTexto);
        
        // Generar y abrir PDF
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
        
        return true;
        
    } catch (error) {
        console.error('Error al generar PDF de resumen:', error);
        throw error;
    }
}
async function solicitarNombresFirmas() {
    const { value: formValues } = await Swal.fire({
        title: 'Firmas para el Resumen',
        html: `
            <div style="text-align: left; padding: 10px;">
                <div style="margin-bottom: 15px;">
                    <label for="firma1" style="display: block; margin-bottom: 5px; font-weight: 600; color: #654321;">
                        Primera Firma:
                    </label>
                    <input id="firma1" class="swal2-input" placeholder="Nombre completo de quien firma" 
                           style="margin: 0; width: 100%; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label for="cargo1" style="display: block; margin-bottom: 5px; font-weight: 600; color: #654321;">
                        Cargo de la primera firma:
                    </label>
                    <input id="cargo1" class="swal2-input" placeholder="Ej: Gerente de Recursos Humanos" 
                           style="margin: 0; width: 100%; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label for="firma2" style="display: block; margin-bottom: 5px; font-weight: 600; color: #654321;">
                        Segunda Firma:
                    </label>
                    <input id="firma2" class="swal2-input" placeholder="Nombre completo de quien firma" 
                           style="margin: 0; width: 100%; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 10px;">
                    <label for="cargo2" style="display: block; margin-bottom: 5px; font-weight: 600; color: #654321;">
                        Cargo de la segunda firma:
                    </label>
                    <input id="cargo2" class="swal2-input" placeholder="Ej: Jefe de Planillas" 
                           style="margin: 0; width: 100%; box-sizing: border-box;">
                </div>
                
                <div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #FF9800;">
                    <small style="color: #666;">
                        <i class="fas fa-info-circle"></i> 
                        Estos nombres aparecerán en las líneas de firma del resumen
                    </small>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#FF9800',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-check"></i> Continuar',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
        width: '500px',
        preConfirm: () => {
            const firma1 = document.getElementById('firma1').value.trim();
            const cargo1 = document.getElementById('cargo1').value.trim();
            const firma2 = document.getElementById('firma2').value.trim();
            const cargo2 = document.getElementById('cargo2').value.trim();
            
            if (!firma1) {
                Swal.showValidationMessage('Por favor ingrese el nombre de la primera firma');
                return false;
            }
            
            if (!cargo1) {
                Swal.showValidationMessage('Por favor ingrese el cargo de la primera firma');
                return false;
            }
            
            if (!firma2) {
                Swal.showValidationMessage('Por favor ingrese el nombre de la segunda firma');
                return false;
            }
            
            if (!cargo2) {
                Swal.showValidationMessage('Por favor ingrese el cargo de la segunda firma');
                return false;
            }
            
            return {
                firma1: firma1,
                cargo1: cargo1,
                firma2: firma2,
                cargo2: cargo2
            };
        }
    });
    
    return formValues;
}
function convertirFechaATextoLegal(fecha) {
    if (!fecha) {
        const hoy = new Date();
        fecha = hoy.toISOString().split('T')[0];
    }
    
    // Parsear la fecha
    const fechaString = fecha.split('T')[0];
    const [año, mes, dia] = fechaString.split('-').map(Number);
    
    // Arrays para conversión
    const mesesTexto = [
        '', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    
    const numerosTexto = {
        1: 'UNO', 2: 'DOS', 3: 'TRES', 4: 'CUATRO', 5: 'CINCO',
        6: 'SEIS', 7: 'SIETE', 8: 'OCHO', 9: 'NUEVE', 10: 'DIEZ',
        11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
        16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE', 20: 'VEINTE',
        21: 'VEINTIUNO', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO', 25: 'VEINTICINCO',
        26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE', 30: 'TREINTA',
        31: 'TREINTA Y UNO'
    };
    
    // Convertir año a texto
    function añoATexto(año) {
        const miles = Math.floor(año / 1000);
        const resto = año % 1000;
        
        if (año === 2025) return 'DOS MIL VEINTICINCO';
        if (año === 2024) return 'DOS MIL VEINTICUATRO';
        if (año === 2026) return 'DOS MIL VEINTISÉIS';
        
        // Para otros años, construir dinámicamente
        let textoAño = 'DOS MIL';
        if (resto > 0) {
            if (resto <= 31) {
                textoAño += ' ' + numerosTexto[resto];
            } else {
                // Para números más complejos
                textoAño += ' ' + resto.toString();
            }
        }
        return textoAño;
    }
    
    const diaTexto = numerosTexto[dia] || dia.toString();
    const mesTexto = mesesTexto[mes];
    const añoTexto = añoATexto(año);
    
    return `A LOS ${diaTexto} DÍAS DEL MES DE ${mesTexto} DEL AÑO ${añoTexto}`;
}
// Función global para ser llamada desde el HTML
window.seleccionarColaborador = seleccionarColaborador;
window.generarPDFAutorizada = generarPDFAutorizada;