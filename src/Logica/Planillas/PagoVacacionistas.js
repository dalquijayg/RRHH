const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');
const odbc = require('odbc');

// Variables globales
let userData = null;
let departamentoData = null;
let montoPorDia = 0;
let fechaInicio = null;
let fechaFin = null;
let diasPeriodo = 0;
let personalData = [];
let planillaAutorizadaActual = null;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos del usuario desde localStorage
    const userDataString = localStorage.getItem('userData');
    if (userDataString) {
        userData = JSON.parse(userDataString);
        console.log('Usuario cargado:', userData);
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Error de sesión',
            text: 'No se encontraron datos del usuario. Por favor, inicie sesión nuevamente.',
            confirmButtonColor: '#FF9800'
        }).then(() => {
            window.location.href = 'Login.html';
        });
        return;
    }

    inicializarEventos();
    verificarPlanillaAutorizada();
});

// ============================================
// EVENTOS
// ============================================
function inicializarEventos() {
    // Eventos de la vista de período
    document.getElementById('tipoQuincena').addEventListener('change', calcularPeriodoAutomatico);
    document.getElementById('mesAnio').addEventListener('change', calcularPeriodoAutomatico);
    document.getElementById('periodoForm').addEventListener('submit', handlePeriodoSubmit);
    document.getElementById('btnGenerarPDF').addEventListener('click', handleGenerarPDF);
    document.getElementById('btnCargarComprobante').addEventListener('click', handleCargarComprobante);

    // Eventos de la vista de personal
    document.getElementById('btnVolver').addEventListener('click', volverAPeriodo);
    document.getElementById('searchInput').addEventListener('input', filtrarPersonal);
    document.getElementById('checkAll').addEventListener('change', handleCheckAll);
    document.getElementById('btnSeleccionarTodos').addEventListener('click', seleccionarTodos);
    document.getElementById('btnDeseleccionarTodos').addEventListener('click', deseleccionarTodos);
    document.getElementById('btnGenerarPlanilla').addEventListener('click', generarPlanilla);
}

// ============================================
// VERIFICAR PLANILLA AUTORIZADA AL INICIO
// ============================================
async function verificarPlanillaAutorizada() {
    try {
        // Cargar información del departamento
        await cargarInformacionDepartamento();

        if (!departamentoData) {
            console.log('No se pudo cargar información del departamento');
            return;
        }

        const connection = await connectionString();

        // Buscar planilla autorizada (Estado = 1) o generada (Estado = 2) para este departamento
        const result = await connection.query(`
            SELECT
                IdPagoPlanillaVacacionista,
                PeriodoPago,
                MontoPlanilla,
                CantidadColaboradores,
                Estado
            FROM
                VacacionistaPagoPlanilla
            WHERE
                IdDeptoSucursal = ? AND
                (Estado = 1 OR Estado = 2)
            ORDER BY
                FechaHoraRegistro DESC
            LIMIT 1
        `, [departamentoData.IdDepartamento]);

        await connection.close();

        if (result.length > 0) {
            // Hay una planilla autorizada o generada
            planillaAutorizadaActual = result[0];
            mostrarBotonSegunEstado(planillaAutorizadaActual);
        }
    } catch (error) {
        console.error('Error al verificar planilla autorizada:', error);
    }
}

function mostrarBotonSegunEstado(planilla) {
    const btnContinuar = document.getElementById('btnContinuar');
    const btnGenerarPDF = document.getElementById('btnGenerarPDF');
    const btnCargarComprobante = document.getElementById('btnCargarComprobante');
    const periodoInfo = document.getElementById('periodoInfo');
    const infoCard = document.getElementById('infoCardPeriodo');

    // Ocultar banner informativo
    if (infoCard) {
        infoCard.style.display = 'none';
    }

    // Ocultar botón Continuar
    btnContinuar.style.display = 'none';

    // Determinar qué botón mostrar según el estado
    if (planilla.Estado === 1) {
        // Estado 1: Autorizada - Mostrar botón Generar PDF
        btnGenerarPDF.style.display = 'inline-flex';
        btnCargarComprobante.style.display = 'none';
    } else if (planilla.Estado === 2) {
        // Estado 2: PDF Generado - Mostrar botón Cargar Comprobante
        btnGenerarPDF.style.display = 'none';
        btnCargarComprobante.style.display = 'inline-flex';
    }

    // Actualizar información del período con los datos de la planilla
    const estadoTexto = planilla.Estado === 1 ? 'Planilla Autorizada Disponible' : 'Planilla Generada - Pendiente Comprobante';
    const estadoColor = planilla.Estado === 1 ? '#4CAF50' : '#2196F3';
    const estadoBgColor = planilla.Estado === 1 ? '#e8f5e9' : '#e3f2fd';

    periodoInfo.innerHTML = `
        <div class="info-row" style="background: ${estadoBgColor}; padding: 15px; border-radius: 8px; border-left: 4px solid ${estadoColor};">
            <div style="flex: 1;">
                <div style="font-size: 0.9rem; color: #666; margin-bottom: 5px;">
                    <i class="fas fa-check-circle" style="color: ${estadoColor};"></i> ${estadoTexto}
                </div>
                <div style="font-weight: 600; color: #654321; font-size: 1.05rem;">
                    ${planilla.PeriodoPago}
                </div>
                <div style="margin-top: 8px; font-size: 0.85rem; color: #555;">
                    <strong>Colaboradores:</strong> ${planilla.CantidadColaboradores} •
                    <strong>Monto:</strong> ${formatearMoneda(planilla.MontoPlanilla)}
                </div>
            </div>
        </div>
    `;

    // Deshabilitar inputs de tipo de quincena y mes
    document.getElementById('tipoQuincena').disabled = true;
    document.getElementById('mesAnio').disabled = true;
}

function handleGenerarPDF() {
    if (planillaAutorizadaActual) {
        generarPDFPlanilla(planillaAutorizadaActual.IdPagoPlanillaVacacionista);
    }
}

async function handleCargarComprobante() {
    if (!planillaAutorizadaActual) {
        return;
    }

    // Variable para almacenar el archivo seleccionado
    let archivoSeleccionado = null;

    // Mostrar diálogo de SweetAlert2 con input de archivo
    const { value: file } = await Swal.fire({
        title: 'Cargar Comprobante de Planilla',
        html: `
            <div style="text-align: left; padding: 15px;">
                <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #FF9800;">
                    <div style="font-size: 0.9rem; color: #666; margin-bottom: 8px;">
                        <i class="fas fa-file-invoice-dollar" style="color: #FF9800;"></i> Información de la Planilla
                    </div>
                    <div style="font-size: 0.95rem; color: #555;">
                        <strong>Planilla:</strong> ${planillaAutorizadaActual.PeriodoPago}<br>
                        <strong>Monto:</strong> ${formatearMoneda(planillaAutorizadaActual.MontoPlanilla)}
                    </div>
                </div>
                <div style="text-align: center; padding: 20px; border: 2px dashed #4CAF50; border-radius: 12px; background: #f9fff9; transition: all 0.3s;" id="dropZone">
                    <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: #4CAF50; margin-bottom: 15px;"></i>
                    <p style="font-size: 1rem; color: #555; margin-bottom: 10px; font-weight: 500;">
                        Seleccione el comprobante de pago
                    </p>
                    <label for="fileComprobante" style="display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; border-radius: 25px; cursor: pointer; transition: all 0.3s; font-size: 0.9rem;">
                        <i class="fas fa-folder-open"></i> Buscar archivo
                    </label>
                    <input type="file" id="fileComprobante" accept="image/*,.pdf" style="display: none;">
                    <div id="fileName" style="margin-top: 15px; font-size: 0.9rem; color: #666; min-height: 20px;"></div>
                </div>
                <div style="margin-top: 15px; padding: 12px; background: #e3f2fd; border-radius: 8px; border-left: 3px solid #2196F3;">
                    <p style="margin: 0; font-size: 0.85rem; color: #555;">
                        <i class="fas fa-info-circle" style="color: #2196F3;"></i>
                        <strong>Formatos permitidos:</strong> JPG, PNG, PDF<br>
                        <strong>Tamaño máximo:</strong> 10 MB
                    </p>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#757575',
        confirmButtonText: '<i class="fas fa-upload"></i> Cargar Documento',
        width: '600px',
        didOpen: () => {
            const fileInput = document.getElementById('fileComprobante');
            const dropZone = document.getElementById('dropZone');

            const handleFileChange = function() {
                if (this.files && this.files[0]) {
                    const file = this.files[0];

                    // Guardar el archivo en la variable externa
                    archivoSeleccionado = file;

                    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

                    dropZone.innerHTML = '<i class="fas fa-check-circle" style="font-size: 3rem; color: #4CAF50; margin-bottom: 15px;"></i>' +
                        '<p style="font-size: 1.1rem; color: #4CAF50; margin-bottom: 10px; font-weight: 600;">¡Archivo seleccionado!</p>' +
                        '<div style="background: white; padding: 12px 20px; border-radius: 8px; margin: 10px auto; max-width: 90%; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">' +
                        '<p style="margin: 5px 0; color: #555;"><i class="fas fa-file-alt" style="color: #4CAF50;"></i> <strong style="color: #333;">' + file.name + '</strong></p>' +
                        '<p style="margin: 5px 0; font-size: 0.85rem; color: #777;"><i class="fas fa-weight-hanging" style="color: #FF9800;"></i> Tamaño: ' + sizeInMB + ' MB</p>' +
                        '</div>' +
                        '<label for="fileComprobante" style="display: inline-block; padding: 8px 18px; background: #2196F3; color: white; border-radius: 25px; cursor: pointer; transition: all 0.3s; font-size: 0.85rem; margin-top: 10px;">' +
                        '<i class="fas fa-sync-alt"></i> Cambiar archivo</label>' +
                        '<input type="file" id="fileComprobante" accept="image/*,.pdf" style="display: none;">';

                    dropZone.style.borderColor = '#4CAF50';
                    dropZone.style.borderStyle = 'solid';
                    dropZone.style.background = '#e8f5e9';

                    // Re-agregar el event listener al nuevo input
                    const newFileInput = document.getElementById('fileComprobante');
                    if (newFileInput) {
                        newFileInput.addEventListener('change', handleFileChange);
                    }
                }
            };

            fileInput.addEventListener('change', handleFileChange);
        },
        preConfirm: () => {
            // Usar el archivo almacenado en la variable en lugar de leerlo del DOM
            if (!archivoSeleccionado) {
                Swal.showValidationMessage('Debe seleccionar un archivo');
                return false;
            }

            // Validar tamaño (máximo 10MB)
            if (archivoSeleccionado.size > 10 * 1024 * 1024) {
                Swal.showValidationMessage('El archivo no debe superar 10MB');
                return false;
            }

            // Validar tipo
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
            if (!validTypes.includes(archivoSeleccionado.type)) {
                Swal.showValidationMessage('Tipo de archivo no permitido. Use JPG, PNG o PDF');
                return false;
            }

            return archivoSeleccionado;
        }
    });

    if (file) {
        // Mostrar loading
        Swal.fire({
            title: 'Cargando comprobante...',
            html: 'Por favor espere',
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            await guardarComprobante(file);
        } catch (error) {
            console.error('Error al cargar comprobante:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Ocurrió un error al cargar el comprobante. Por favor, intente nuevamente.',
                confirmButtonColor: '#FF9800'
            });
        }
    }
}

// Guardar comprobante en la base de datos
async function guardarComprobante(file) {
    try {
        // Convertir el archivo a Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const connection = await connectionString();

        // Obtener fecha actual en formato YYYY-MM-DD
        const fechaActual = new Date().toISOString().split('T')[0];

        // Insertar documento en la tabla DocumentosPlanillasVacacionistas
        await connection.query(`
            INSERT INTO DocumentosPlanillasVacacionistas (
                IdPagoPlanillaVacacionista,
                NombreDocumento,
                ArchivoCargado,
                FechaCargado,
                IdUsuarioCargo,
                NombreUsuarioCargo
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            planillaAutorizadaActual.IdPagoPlanillaVacacionista,
            file.name,
            buffer,
            fechaActual,
            userData.IdPersonal,
            userData.NombreCompleto || 'Usuario Desconocido'
        ]);

        // Actualizar el estado de la planilla a 3 (Comprobante Cargado)
        await connection.query(`
            UPDATE VacacionistaPagoPlanilla
            SET Estado = 3
            WHERE IdPagoPlanillaVacacionista = ?
        `, [planillaAutorizadaActual.IdPagoPlanillaVacacionista]);

        await connection.close();

        // Mostrar mensaje de éxito
        await Swal.fire({
            icon: 'success',
            title: '¡Comprobante cargado exitosamente!',
            html: `
                <div style="text-align: center;">
                    <p style="font-size: 1rem; margin-bottom: 15px;">El comprobante de pago ha sido registrado correctamente.</p>
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>Archivo:</strong> ${file.name}</p>
                        <p style="margin: 5px 0;"><strong>Tamaño:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
                        <p style="margin: 5px 0;"><strong>Planilla:</strong> #${planillaAutorizadaActual.IdPagoPlanillaVacacionista}</p>
                    </div>
                    <p style="color: #4CAF50; font-weight: 600; margin-top: 15px;">
                        <i class="fas fa-check-circle"></i> Estado actualizado: Comprobante Cargado
                    </p>
                </div>
            `,
            confirmButtonColor: '#4CAF50',
            confirmButtonText: 'Aceptar'
        });

        // Recargar la página para actualizar el estado
        window.location.reload();

    } catch (error) {
        console.error('Error al guardar comprobante:', error);
        throw error;
    }
}

// ============================================
// FUNCIONES DE VISTA DE PERÍODO
// ============================================

// Calcular período automáticamente según tipo de quincena y mes
function calcularPeriodoAutomatico() {
    const tipoQuincena = document.getElementById('tipoQuincena').value;
    const mesAnio = document.getElementById('mesAnio').value;
    const btnContinuar = document.getElementById('btnContinuar');
    const periodoCalculado = document.getElementById('periodoCalculado');
    const totalDiasPeriodoElement = document.getElementById('totalDiasPeriodo');

    if (tipoQuincena && mesAnio) {
        // Parsear el mes y año seleccionado (formato: YYYY-MM)
        const [anio, mes] = mesAnio.split('-');
        const mesNumero = parseInt(mes);
        const anioNumero = parseInt(anio);

        // Calcular fechas según el tipo de quincena
        let fechaInicioCalculada, fechaFinCalculada, diasCalculados;

        if (tipoQuincena === 'primera') {
            // Primera quincena: día 1 al 15
            fechaInicioCalculada = new Date(anioNumero, mesNumero - 1, 1);
            fechaFinCalculada = new Date(anioNumero, mesNumero - 1, 15);
            diasCalculados = 15;
        } else if (tipoQuincena === 'segunda') {
            // Segunda quincena: día 16 al último día del mes
            fechaInicioCalculada = new Date(anioNumero, mesNumero - 1, 16);
            // Obtener el último día del mes
            const ultimoDia = new Date(anioNumero, mesNumero, 0).getDate();
            fechaFinCalculada = new Date(anioNumero, mesNumero - 1, ultimoDia);
            diasCalculados = 15; // Siempre 15 días comerciales para fin de mes
        }

        // Formatear fechas para guardar (YYYY-MM-DD)
        const formatoISO = (fecha) => {
            const año = fecha.getFullYear();
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const dia = String(fecha.getDate()).padStart(2, '0');
            return `${año}-${mes}-${dia}`;
        };

        // Formatear fechas para mostrar (DD/MM/YYYY)
        const formatoMostrar = (fecha) => {
            const dia = String(fecha.getDate()).padStart(2, '0');
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const año = fecha.getFullYear();
            return `${dia}/${mes}/${año}`;
        };

        // Guardar en variables globales
        fechaInicio = formatoISO(fechaInicioCalculada);
        fechaFin = formatoISO(fechaFinCalculada);
        diasPeriodo = diasCalculados;

        // Mostrar período calculado
        const periodoTexto = `${formatoMostrar(fechaInicioCalculada)} al ${formatoMostrar(fechaFinCalculada)}`;
        periodoCalculado.textContent = periodoTexto;
        totalDiasPeriodoElement.textContent = diasCalculados;

        // Habilitar botón continuar
        btnContinuar.disabled = false;
    } else {
        // Si falta algún campo, resetear
        periodoCalculado.textContent = 'Seleccione tipo y mes';
        totalDiasPeriodoElement.textContent = '0';
        btnContinuar.disabled = true;
        fechaInicio = null;
        fechaFin = null;
        diasPeriodo = 0;
    }
}

// Validar que no exista un período que se solape con las fechas seleccionadas
async function validarPeriodoNoExistente(fechaInicioParam, fechaFinParam, idDepartamento) {
    try {
        const connection = await connectionString();

        // Buscar períodos que se solapen con el período ingresado
        // IMPORTANTE: Solo se considera traslape si el estado NO es 4 (anulada/cancelada)
        const result = await connection.query(`
            SELECT
                IdPagoPlanillaVacacionista,
                PeriodoPago,
                MontoPlanilla,
                CantidadColaboradores,
                Estado
            FROM
                VacacionistaPagoPlanilla
            WHERE
                IdDeptoSucursal = ? AND
                Estado != 4 AND
                (
                    -- Caso 1: La fecha de inicio del nuevo período está dentro de un período existente
                    (STR_TO_DATE(SUBSTRING_INDEX(PeriodoPago, ' al ', 1), '%d/%m/%Y') <= ?
                     AND STR_TO_DATE(SUBSTRING_INDEX(PeriodoPago, ' al ', -1), '%d/%m/%Y') >= ?)
                    OR
                    -- Caso 2: La fecha de fin del nuevo período está dentro de un período existente
                    (STR_TO_DATE(SUBSTRING_INDEX(PeriodoPago, ' al ', 1), '%d/%m/%Y') <= ?
                     AND STR_TO_DATE(SUBSTRING_INDEX(PeriodoPago, ' al ', -1), '%d/%m/%Y') >= ?)
                    OR
                    -- Caso 3: El nuevo período contiene completamente un período existente
                    (STR_TO_DATE(SUBSTRING_INDEX(PeriodoPago, ' al ', 1), '%d/%m/%Y') >= ?
                     AND STR_TO_DATE(SUBSTRING_INDEX(PeriodoPago, ' al ', -1), '%d/%m/%Y') <= ?)
                )
        `, [
            idDepartamento,
            fechaInicioParam, fechaInicioParam,  // Caso 1
            fechaFinParam, fechaFinParam,        // Caso 2
            fechaInicioParam, fechaFinParam      // Caso 3
        ]);

        await connection.close();

        return {
            existe: result.length > 0,
            periodos: result
        };
    } catch (error) {
        console.error('Error al validar período:', error);
        throw error;
    }
}

// Manejar submit del formulario de período
async function handlePeriodoSubmit(event) {
    event.preventDefault();

    // Si ya hay una planilla autorizada mostrada, no hacer nada
    if (planillaAutorizadaActual) {
        return;
    }

    if (!fechaInicio || !fechaFin || diasPeriodo === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Datos incompletos',
            text: 'Por favor, seleccione ambas fechas correctamente.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }

    // Mostrar loading
    Swal.fire({
        title: 'Validando período...',
        html: 'Por favor espere',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // Primero obtener información del departamento para la validación
        await cargarInformacionDepartamento();

        // Validar que no exista un período que se solape
        const validacion = await validarPeriodoNoExistente(fechaInicio, fechaFin, departamentoData.IdDepartamento);

        if (validacion.existe) {
            Swal.close();

            // Verificar si alguna planilla está autorizada (Estado = 1)
            const planillaAutorizada = validacion.periodos.find(p => p.Estado === 1);

            if (planillaAutorizada) {
                // Si hay una planilla autorizada, mostrar opción de ver PDF
                await Swal.fire({
                    icon: 'info',
                    title: 'Planilla Autorizada Encontrada',
                    html: `
                        <div style="text-align: left;">
                            <p style="margin-bottom: 15px;">Se encontró una planilla autorizada para este período:</p>
                            <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 3px solid #4CAF50;">
                                <strong>Período:</strong> ${planillaAutorizada.PeriodoPago}<br>
                                <strong>Monto:</strong> Q ${parseFloat(planillaAutorizada.MontoPlanilla).toFixed(2)}<br>
                                <strong>Colaboradores:</strong> ${planillaAutorizada.CantidadColaboradores || 'N/A'}<br>
                                <span style="color: #4CAF50; font-weight: 600;">✓ Estado: Autorizada</span>
                            </div>
                            <p style="margin-top: 15px; font-size: 0.95rem; color: #555;">Puede generar el PDF de esta planilla haciendo clic en el botón a continuación.</p>
                        </div>
                    `,
                    confirmButtonColor: '#DC143C',
                    confirmButtonText: '<i class="fas fa-file-pdf"></i> Generar PDF',
                    showCancelButton: true,
                    cancelButtonText: 'Cerrar',
                    cancelButtonColor: '#9E9E9E',
                    width: '500px'
                }).then((result) => {
                    if (result.isConfirmed) {
                        generarPDFPlanilla(planillaAutorizada.IdPagoPlanillaVacacionista);
                    }
                });
                return;
            }

            // Si no hay planillas autorizadas, mostrar error normal
            const periodosHTML = validacion.periodos.map((p, index) =>
                `<div style="background: #fff3e0; padding: 10px; border-radius: 6px; margin: 8px 0; border-left: 3px solid #FF9800;">
                    <strong>Período ${index + 1}:</strong> ${p.PeriodoPago}<br>
                    <span style="color: #666; font-size: 0.9rem;">Monto: Q ${parseFloat(p.MontoPlanilla).toFixed(2)}</span>
                </div>`
            ).join('');

            await Swal.fire({
                icon: 'error',
                title: 'Período ya existe',
                html: `
                    <div style="text-align: left;">
                        <p style="margin-bottom: 15px;">El período seleccionado coincide con uno o más períodos ya registrados para este departamento:</p>
                        ${periodosHTML}
                        <div style="background: #ffebee; padding: 12px; border-radius: 6px; margin-top: 15px;">
                            <p style="color: #c62828; font-size: 0.9rem; margin: 0;">
                                <strong>⚠️ No se permiten períodos duplicados o que se traslapen.</strong><br>
                                Por favor, seleccione un período diferente.
                            </p>
                        </div>
                    </div>
                `,
                confirmButtonColor: '#FF9800',
                confirmButtonText: 'Entendido',
                width: '500px'
            });
            return;
        }

        // Si no existe, continuar con el proceso normal
        Swal.update({
            title: 'Cargando información...',
            html: 'Por favor espere'
        });

        // Obtener monto por día según si es capital o no
        await cargarMontoPorDia();

        // Obtener personal del departamento
        await cargarPersonal();

        // Mostrar vista de personal
        mostrarVistaPersonal();

        Swal.close();
    } catch (error) {
        console.error('Error al cargar información:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al cargar la información. Por favor, intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Cargar información del departamento
async function cargarInformacionDepartamento() {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                departamentos.IdDepartamento,
                departamentos.NombreDepartamento, 
                departamentos.IdRegion, 
                Regiones.NombreRegion
            FROM
                departamentos
                INNER JOIN
                Regiones
                ON 
                    departamentos.IdRegion = Regiones.IdRegion
            WHERE
                departamentos.IdDepartamento = ?
        `, [userData.IdSucuDepa]);

        await connection.close();

        if (result.length > 0) {
            departamentoData = result[0];
            console.log('Departamento cargado:', departamentoData);
        } else {
            throw new Error('No se encontró información del departamento');
        }
    } catch (error) {
        console.error('Error al cargar departamento:', error);
        throw error;
    }
}

// Cargar monto por día según región
async function cargarMontoPorDia() {
    try {
        const anioActual = new Date().getFullYear();
        const esCapital = departamentoData.IdRegion === '3' || departamentoData.IdRegion === 3 ? 1 : 0;

        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                SalarioVacacionista.Monto
            FROM
                SalarioVacacionista
            WHERE
                SalarioVacacionista.Anio = ? AND
                SalarioVacacionista.EsCapital = ?
        `, [anioActual, esCapital]);

        await connection.close();

        if (result.length > 0) {
            montoPorDia = parseFloat(result[0].Monto);
            console.log('Monto por día:', montoPorDia, 'Es Capital:', esCapital);
        } else {
            throw new Error('No se encontró el monto configurado para el año actual');
        }
    } catch (error) {
        console.error('Error al cargar monto por día:', error);
        throw error;
    }
}

// Cargar personal del departamento
async function cargarPersonal() {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT 
                personal.IdPersonal,  
                personal.PrimerNombre,  
                personal.SegundoNombre,  
                personal.TercerNombre,  
                personal.PrimerApellido,  
                personal.SegundoApellido,  
                Puestos.Nombre as NombrePuesto
            FROM 
                personal 
                INNER JOIN 
                Puestos 
                ON  
                    personal.IdPuesto = Puestos.IdPuesto 
            WHERE 
                personal.IdSucuDepa = ? AND 
                personal.Estado = 1 AND
                personal.TipoPersonal = 3
            ORDER BY
                personal.PrimerNombre, personal.PrimerApellido
        `, [userData.IdSucuDepa]);

        await connection.close();

        personalData = result.map(p => ({
            IdPersonal: p.IdPersonal,
            NombreCompleto: construirNombreCompleto(p),
            NombrePuesto: p.NombrePuesto,
            Dias: diasPeriodo,
            Total: diasPeriodo * montoPorDia,
            Seleccionado: false
        }));

        console.log('Personal cargado:', personalData.length, 'empleados');
    } catch (error) {
        console.error('Error al cargar personal:', error);
        throw error;
    }
}

// Construir nombre completo
function construirNombreCompleto(persona) {
    let nombre = persona.PrimerNombre;
    if (persona.SegundoNombre) nombre += ' ' + persona.SegundoNombre;
    if (persona.TercerNombre) nombre += ' ' + persona.TercerNombre;
    nombre += ' ' + persona.PrimerApellido;
    if (persona.SegundoApellido) nombre += ' ' + persona.SegundoApellido;
    return nombre.trim();
}

// ============================================
// FUNCIONES DE VISTA DE PERSONAL
// ============================================

// Mostrar vista de personal
function mostrarVistaPersonal() {
    // Ocultar vista de período y mostrar vista de personal
    document.getElementById('periodoView').classList.add('hidden');
    document.getElementById('personalView').classList.remove('hidden');

    // Actualizar información del banner
    const formatoFecha = { year: 'numeric', month: 'long', day: 'numeric' };
    const fechaInicioFormato = new Date(fechaInicio + 'T00:00:00').toLocaleDateString('es-GT', formatoFecha);
    const fechaFinFormato = new Date(fechaFin + 'T00:00:00').toLocaleDateString('es-GT', formatoFecha);
    
    document.getElementById('periodoSeleccionado').textContent = `${fechaInicioFormato} - ${fechaFinFormato}`;
    document.getElementById('diasPeriodo').textContent = diasPeriodo + ' días';
    document.getElementById('nombreDepartamento').textContent = departamentoData.NombreDepartamento;
    document.getElementById('nombreRegion').textContent = departamentoData.NombreRegion;
    document.getElementById('montoDiario').textContent = formatearMoneda(montoPorDia);

    // Renderizar tabla
    renderizarTablaPersonal();
    actualizarContadores();
}

// Renderizar tabla de personal
function renderizarTablaPersonal(filtro = '') {
    const tbody = document.getElementById('personalTableBody');
    tbody.innerHTML = '';

    let personalFiltrado = personalData;

    // Aplicar filtro de búsqueda
    if (filtro) {
        const filtroLower = filtro.toLowerCase();
        personalFiltrado = personalData.filter(p => 
            p.NombreCompleto.toLowerCase().includes(filtroLower) ||
            p.NombrePuesto.toLowerCase().includes(filtroLower)
        );
    }

    // Renderizar cada fila
    personalFiltrado.forEach((persona, index) => {
        const tr = document.createElement('tr');
        if (persona.Seleccionado) {
            tr.classList.add('selected');
        }

        tr.innerHTML = `
            <td class="col-check">
                <input type="checkbox" 
                       class="checkbox-personal" 
                       data-id="${persona.IdPersonal}" 
                       ${persona.Seleccionado ? 'checked' : ''}>
            </td>
            <td class="col-id">${persona.IdPersonal}</td>
            <td class="col-nombre">${persona.NombreCompleto}</td>
            <td class="col-puesto">${persona.NombrePuesto}</td>
            <td class="col-dias">
                <input type="number" 
                       class="dias-input" 
                       data-id="${persona.IdPersonal}" 
                       value="${persona.Dias}" 
                       min="0" 
                       max="${diasPeriodo}"
                       ${!persona.Seleccionado ? 'disabled' : ''}>
            </td>
            <td class="col-total">${formatearMoneda(persona.Total)}</td>
        `;

        tbody.appendChild(tr);
    });

    // Agregar eventos a los checkboxes
    document.querySelectorAll('.checkbox-personal').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    // Agregar eventos a los inputs de días
    document.querySelectorAll('.dias-input').forEach(input => {
        input.addEventListener('input', handleDiasChange);
    });

    // Actualizar estado del checkbox "seleccionar todos"
    actualizarCheckAll();
}

// Manejar cambio en checkbox individual
function handleCheckboxChange(event) {
    const idPersonal = parseInt(event.target.dataset.id);
    const persona = personalData.find(p => p.IdPersonal === idPersonal);
    
    if (persona) {
        persona.Seleccionado = event.target.checked;
        
        // Habilitar/deshabilitar input de días
        const diasInput = document.querySelector(`.dias-input[data-id="${idPersonal}"]`);
        if (diasInput) {
            diasInput.disabled = !persona.Seleccionado;
            if (!persona.Seleccionado) {
                diasInput.value = diasPeriodo;
                persona.Dias = diasPeriodo;
                persona.Total = diasPeriodo * montoPorDia;
            }
        }

        // Actualizar clase de la fila
        const row = event.target.closest('tr');
        if (persona.Seleccionado) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }

        actualizarContadores();
        actualizarCheckAll();
    }
}

// Manejar cambio en input de días
function handleDiasChange(event) {
    const idPersonal = parseInt(event.target.dataset.id);
    let dias = parseInt(event.target.value) || 0;

    // Validar que no exceda el período
    if (dias > diasPeriodo) {
        dias = diasPeriodo;
        event.target.value = dias;
    }

    if (dias < 0) {
        dias = 0;
        event.target.value = 0;
    }

    const persona = personalData.find(p => p.IdPersonal === idPersonal);
    if (persona && persona.Seleccionado) {
        persona.Dias = dias;
        persona.Total = dias * montoPorDia;

        // Actualizar columna de total
        const row = event.target.closest('tr');
        const totalCell = row.querySelector('.col-total');
        totalCell.textContent = formatearMoneda(persona.Total);

        actualizarContadores();
    }
}

// Manejar checkbox "seleccionar todos"
function handleCheckAll(event) {
    const checked = event.target.checked;
    
    if (checked) {
        seleccionarTodos();
    } else {
        deseleccionarTodos();
    }
}

// Seleccionar todos
function seleccionarTodos() {
    personalData.forEach(p => {
        p.Seleccionado = true;
    });

    document.querySelectorAll('.checkbox-personal').forEach(checkbox => {
        checkbox.checked = true;
    });

    document.querySelectorAll('.dias-input').forEach(input => {
        input.disabled = false;
    });

    document.querySelectorAll('#personalTableBody tr').forEach(row => {
        row.classList.add('selected');
    });

    document.getElementById('checkAll').checked = true;
    actualizarContadores();
}

// Deseleccionar todos
function deseleccionarTodos() {
    personalData.forEach(p => {
        p.Seleccionado = false;
        p.Dias = diasPeriodo;
        p.Total = diasPeriodo * montoPorDia;
    });

    document.querySelectorAll('.checkbox-personal').forEach(checkbox => {
        checkbox.checked = false;
    });

    document.querySelectorAll('.dias-input').forEach(input => {
        input.disabled = true;
        input.value = diasPeriodo;
    });

    document.querySelectorAll('#personalTableBody tr').forEach(row => {
        row.classList.remove('selected');
    });

    document.getElementById('checkAll').checked = false;
    actualizarContadores();
}

// Actualizar estado del checkbox "seleccionar todos"
function actualizarCheckAll() {
    const todosSeleccionados = personalData.every(p => p.Seleccionado);
    const algunoSeleccionado = personalData.some(p => p.Seleccionado);
    
    const checkAll = document.getElementById('checkAll');
    checkAll.checked = todosSeleccionados;
    checkAll.indeterminate = algunoSeleccionado && !todosSeleccionados;
}

// Filtrar personal por búsqueda
function filtrarPersonal(event) {
    const filtro = event.target.value;
    renderizarTablaPersonal(filtro);
}

// Actualizar contadores y totales
function actualizarContadores() {
    const seleccionados = personalData.filter(p => p.Seleccionado);
    const totalDiasSeleccionados = seleccionados.reduce((sum, p) => sum + p.Dias, 0);
    const totalPagar = seleccionados.reduce((sum, p) => sum + p.Total, 0);

    document.getElementById('totalEmpleados').textContent = personalData.length;
    document.getElementById('totalSeleccionados').textContent = seleccionados.length;
    document.getElementById('selectedCount').textContent = seleccionados.length;
    document.getElementById('totalDias').textContent = totalDiasSeleccionados;
    document.getElementById('totalPagar').textContent = formatearMoneda(totalPagar);

    // Habilitar/deshabilitar botón de generar planilla
    const btnGenerar = document.getElementById('btnGenerarPlanilla');
    btnGenerar.disabled = seleccionados.length === 0;
}

// Volver a vista de período
function volverAPeriodo() {
    Swal.fire({
        title: '¿Volver a selección de período?',
        text: 'Se perderán las selecciones realizadas',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#FF9800',
        cancelButtonColor: '#757575',
        confirmButtonText: 'Sí, volver'
    }).then((result) => {
        if (result.isConfirmed) {
            // Limpiar datos
            personalData = [];
            departamentoData = null;
            montoPorDia = 0;
            
            // Mostrar vista de período
            document.getElementById('personalView').classList.add('hidden');
            document.getElementById('periodoView').classList.remove('hidden');
            
            // Limpiar formulario
            document.getElementById('periodoForm').reset();
            document.getElementById('totalDiasPeriodo').textContent = '0';
            document.getElementById('btnContinuar').disabled = true;
        }
    });
}

// ============================================
// GUARDAR PLANILLA EN BASE DE DATOS
// ============================================
async function guardarPlanillaEnBD(periodoPago, montoTotal, empleados) {
    try {
        const connection = await connectionString();

        // Obtener el tipo de quincena seleccionado
        const tipoQuincenaValue = document.getElementById('tipoQuincena').value;
        let idTipoQuincena, tipoQuincenaTexto;

        if (tipoQuincenaValue === 'primera') {
            idTipoQuincena = 1;
            tipoQuincenaTexto = 'Quincena';
        } else if (tipoQuincenaValue === 'segunda') {
            idTipoQuincena = 2;
            tipoQuincenaTexto = 'Quincena Fin de Mes';
        }

        // Obtener el mes y año seleccionados
        const mesAnioValue = document.getElementById('mesAnio').value; // Formato: YYYY-MM
        const [anio, mes] = mesAnioValue.split('-');
        const mesNumero = parseInt(mes); // 1-12
        const anioNumero = parseInt(anio); // 2025, 2026, etc.

        // 1. Insertar en la tabla principal VacacionistaPagoPlanilla
        const resultPlanilla = await connection.query(`
            INSERT INTO VacacionistaPagoPlanilla (
                IdUsuarioGenera,
                NombreUsuarioGenera,
                PeriodoPago,
                IdDeptoSucursal,
                NombreDeptoSucursal,
                CantidadColaboradores,
                MontoPlanilla,
                IdTipoQuincena,
                TipoQuincena,
                Mes,
                Anio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userData.IdPersonal,
            userData.NombreCompleto || 'Usuario Desconocido',
            periodoPago,
            departamentoData.IdDepartamento,
            departamentoData.NombreDepartamento,
            empleados.length,
            montoTotal,
            idTipoQuincena,
            tipoQuincenaTexto,
            mesNumero,
            anioNumero
        ]);

        // Obtener el ID generado
        const idPlanillaGenerada = resultPlanilla.insertId;

        // 2. Insertar los detalles en VacacionistaDetallePagoPlanilla
        for (const empleado of empleados) {
            await connection.query(`
                INSERT INTO VacacionistaDetallePagoPlanilla (
                    IdPagoPlanillaVacacionista,
                    IdPersonal,
                    NombreColaborador,
                    CantidadDiasLaborados,
                    MontoDia,
                    SubTotal
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                idPlanillaGenerada,
                empleado.IdPersonal,
                empleado.NombreCompleto,
                empleado.Dias,
                montoPorDia,
                empleado.Total
            ]);
        }

        await connection.close();

        console.log('Planilla guardada exitosamente con ID:', idPlanillaGenerada);
        return idPlanillaGenerada;

    } catch (error) {
        console.error('Error al guardar planilla en BD:', error);
        throw error;
    }
}

// ============================================
// GENERAR PDF DE PLANILLA AUTORIZADA
// ============================================
async function generarPDFPlanilla(idPlanilla) {
    try {
        // Mostrar loading
        Swal.fire({
            title: 'Generando PDF...',
            html: 'Por favor espere',
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });

        const connection = await connectionString();

        // Obtener información de la planilla con todos los detalles
        const result = await connection.query(`
            SELECT
                VacacionistaPagoPlanilla.IdPagoPlanillaVacacionista,
                VacacionistaPagoPlanilla.NombreUsuarioGenera,
                VacacionistaPagoPlanilla.PeriodoPago,
                VacacionistaPagoPlanilla.NombreDeptoSucursal,
                VacacionistaPagoPlanilla.CantidadColaboradores,
                VacacionistaPagoPlanilla.MontoPlanilla,
                VacacionistaPagoPlanilla.NombreUsuarioAutorizaAnula,
                VacacionistaPagoPlanilla.FechaHoraRegistro,
                VacacionistaPagoPlanilla.FechaHoraAutorizo,
                VacacionistaDetallePagoPlanilla.NombreColaborador,
                VacacionistaDetallePagoPlanilla.CantidadDiasLaborados,
                VacacionistaDetallePagoPlanilla.MontoDia,
                VacacionistaDetallePagoPlanilla.SubTotal
            FROM
                VacacionistaPagoPlanilla
                INNER JOIN
                VacacionistaDetallePagoPlanilla
                ON
                    VacacionistaPagoPlanilla.IdPagoPlanillaVacacionista = VacacionistaDetallePagoPlanilla.IdPagoPlanillaVacacionista
            WHERE
                VacacionistaPagoPlanilla.IdPagoPlanillaVacacionista = ?
            ORDER BY
                VacacionistaDetallePagoPlanilla.NombreColaborador
        `, [idPlanilla]);

        if (result.length === 0) {
            throw new Error('No se encontró la planilla');
        }

        // La primera fila tiene la información de la planilla
        const planilla = result[0];

        // Debug: verificar si el logo está llegando
        console.log('Logo recibido:', planilla.Logos ? 'Sí tiene logo' : 'No tiene logo');
        if (planilla.Logos) {
            console.log('Tipo de logo:', typeof planilla.Logos);
            console.log('Es Buffer?:', planilla.Logos instanceof Buffer);
            if (typeof planilla.Logos === 'object') {
                console.log('Propiedades del logo:', Object.keys(planilla.Logos));
            }
        }

        // Todos los registros son los detalles de colaboradores
        const detallesResult = result;

        await connection.close();

        // Generar PDF con jsPDF (ahora es async)
        await generarPDFConJsPDF(planilla, detallesResult);

        // Cerrar el loading
        Swal.close();

    } catch (error) {
        console.error('Error al generar PDF:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al generar el PDF. Por favor, intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

async function generarPDFConJsPDF(planilla, detalles) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Configuración
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // Agregar logo optimizado para reducir tamaño del PDF
    try {
        if (planilla.Logos) {
            // Verificar si el logo ya tiene el formato data:image, si no, agregarlo
            let logoSrc = planilla.Logos;
            if (!logoSrc.startsWith('data:image')) {
                // Si es un Buffer o string de bytes, convertirlo a base64
                if (typeof logoSrc === 'object' && logoSrc.type === 'Buffer') {
                    const base64String = Buffer.from(logoSrc.data).toString('base64');
                    logoSrc = `data:image/png;base64,${base64String}`;
                } else if (typeof logoSrc === 'string' && !logoSrc.startsWith('data:')) {
                    // Si es un string sin prefijo, asumimos que es base64
                    logoSrc = `data:image/png;base64,${logoSrc}`;
                }
            }

            // Crear imagen temporal para cargar el logo original
            const tempImg = new Image();
            tempImg.src = logoSrc;

            // Esperar a que cargue
            await new Promise((resolve) => {
                tempImg.onload = resolve;
            });

            // Crear canvas para redimensionar y comprimir
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            // Tamaño objetivo: 200px de ancho (suficiente para impresión de calidad)
            const targetWidth = 200;
            const targetHeight = (tempImg.height / tempImg.width) * targetWidth;

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            // Rellenar con BLANCO antes de dibujar (para evitar fondo negro en JPEG)
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, targetWidth, targetHeight);

            // Dibujar imagen redimensionada encima del fondo blanco
            context.drawImage(tempImg, 0, 0, targetWidth, targetHeight);

            // Convertir a JPEG con compresión del 85%
            const logoOptimizado = canvas.toDataURL('image/jpeg', 0.85);

            // Calcular dimensiones en el PDF (en mm)
            const imgWidth = 30;
            const imgHeight = (targetHeight / targetWidth) * imgWidth;

            // Agregar logo optimizado al PDF
            doc.addImage(logoOptimizado, 'JPEG', 15, 10, imgWidth, imgHeight);
        }
    } catch (e) {
        console.log('No se pudo cargar el logo:', e);
    }

    // Título
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(101, 67, 33);
    doc.text('PLANILLA DE PAGO VACACIONISTAS', pageWidth / 2, yPos + 8, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 152, 0);
    doc.text(`ID: ${planilla.IdPagoPlanillaVacacionista} - ${planilla.NombreDeptoSucursal}`, pageWidth / 2, yPos + 15, { align: 'center' });

    // Línea separadora
    doc.setDrawColor(255, 152, 0);
    doc.setLineWidth(0.5);
    doc.line(15, yPos + 20, pageWidth - 15, yPos + 20);

    yPos += 28;

    // Información de la planilla
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    // Formatear fechas correctamente
    const formatearFechaParaPDF = (fecha) => {
        if (!fecha) return 'N/A';
        try {
            const fechaObj = new Date(fecha);
            if (isNaN(fechaObj.getTime())) return 'N/A';

            const dia = String(fechaObj.getDate()).padStart(2, '0');
            const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anio = fechaObj.getFullYear();
            return `${dia}/${mes}/${anio}`;
        } catch (e) {
            return 'N/A';
        }
    };

    const info = [
        [`Período de Pago:`, planilla.PeriodoPago],
        [`Tienda/Departamento:`, planilla.NombreDeptoSucursal],
        [`Generado por:`, planilla.NombreUsuarioGenera],
        [`Fecha Registro:`, formatearFechaParaPDF(planilla.FechaHoraRegistro)],
        [`Total Colaboradores:`, String(planilla.CantidadColaboradores)],
        [`Autorizado por:`, planilla.NombreUsuarioAutorizaAnula || 'N/A'],
        [`Fecha Autorización:`, formatearFechaParaPDF(planilla.FechaHoraAutorizo)]
    ];

    let col = 0;
    info.forEach((item, index) => {
        const xPos = col === 0 ? 15 : pageWidth / 2 + 5;
        doc.setFont('helvetica', 'bold');
        doc.text(item[0], xPos, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(item[1], xPos + 45, yPos);

        if (col === 1) {
            yPos += 6;
            col = 0;
        } else {
            col = 1;
        }
    });

    yPos += 5;

    // Tabla de colaboradores con columna de Firma
    const tableData = detalles.map((detalle, index) => [
        index + 1,
        detalle.NombreColaborador,
        detalle.CantidadDiasLaborados,
        formatearMoneda(detalle.MontoDia),
        formatearMoneda(detalle.SubTotal),
        '' // Columna vacía para Firma de Recibido
    ]);

    doc.autoTable({
        startY: yPos,
        head: [['#', 'Nombre del Colaborador', 'Días', 'Monto/Día', 'Subtotal', 'Firma de Recibido']],
        body: tableData,
        foot: [['', '', '', 'TOTAL A PAGAR:', formatearMoneda(planilla.MontoPlanilla), '']],
        theme: 'grid',
        headStyles: {
            fillColor: [255, 152, 0],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
        },
        footStyles: {
            fillColor: [255, 224, 178],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'right',
            fontSize: 9
        },
        styles: {
            fontSize: 8,
            cellPadding: 3,
            minCellHeight: 12
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'left', cellWidth: 60 },
            2: { halign: 'center', cellWidth: 15 },
            3: { halign: 'right', cellWidth: 25 },
            4: { halign: 'right', cellWidth: 25 },
            5: { halign: 'center', cellWidth: 45 }
        }
    });

    // Footer (después de la tabla)
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    const fecha = new Date().toLocaleString('es-GT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    doc.text(`Documento generado el ${fecha}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('Sistema de Recursos Humanos - © New Technology 2025', pageWidth / 2, pageHeight - 5, { align: 'center' });

    // Guardar PDF
    doc.save(`Planilla_Vacacionistas_${planilla.PeriodoPago.replace(/\//g, '-')}.pdf`);

    // Actualizar el estado de la planilla a 2 (Generada)
    try {
        const connection = await connectionString();
        await connection.query(`
            UPDATE VacacionistaPagoPlanilla
            SET Estado = 2
            WHERE IdPagoPlanillaVacacionista = ?
        `, [planilla.IdPagoPlanillaVacacionista]);
        await connection.close();
        console.log('Estado de la planilla actualizado a 2');
    } catch (error) {
        console.error('Error al actualizar el estado de la planilla:', error);
    }
}

// ============================================
// GENERAR PLANILLA
// ============================================
async function generarPlanilla() {
    const seleccionados = personalData.filter(p => p.Seleccionado);

    if (seleccionados.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin selección',
            text: 'Debe seleccionar al menos un empleado para generar la planilla.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }

    // Confirmar generación
    const result = await Swal.fire({
        title: 'Confirmar generación de planilla',
        html: `
            <div style="text-align: left;">
                <p><strong>Período:</strong> ${document.getElementById('periodoSeleccionado').textContent}</p>
                <p><strong>Departamento:</strong> ${departamentoData.NombreDepartamento}</p>
                <p><strong>Empleados seleccionados:</strong> ${seleccionados.length}</p>
                <p><strong>Total a pagar:</strong> ${document.getElementById('totalPagar').textContent}</p>
                <hr>
                <p style="color: #666; font-size: 0.9rem;">¿Desea generar la planilla de vacacionistas?</p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#757575',
        confirmButtonText: '<i class="fas fa-check"></i> Sí, generar'
    });

    if (!result.isConfirmed) {
        return;
    }

    // Mostrar loading
    Swal.fire({
        title: 'Generando planilla...',
        html: 'Por favor espere',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // Calcular totales
        const totalDiasSeleccionados = seleccionados.reduce((sum, p) => sum + p.Dias, 0);
        const totalPagar = seleccionados.reduce((sum, p) => sum + p.Total, 0);

        // Formatear período para guardar
        const fechaInicioFormato = new Date(fechaInicio + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const fechaFinFormato = new Date(fechaFin + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const periodoPago = `${fechaInicioFormato} al ${fechaFinFormato}`;

        // Guardar en la base de datos
        const idPlanillaGenerada = await guardarPlanillaEnBD(periodoPago, totalPagar, seleccionados);

        Swal.fire({
            icon: 'success',
            title: '¡Planilla generada exitosamente!',
            html: `
                <div style="text-align: center;">
                    <p style="font-size: 1.1rem; margin-bottom: 20px;">La planilla de vacacionistas ha sido registrada en el sistema.</p>
                    <div style="background: #e8f5e9; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <p style="margin: 8px 0; font-size: 1.05rem;"><strong>N° de Planilla:</strong> <span style="color: #FF9800; font-size: 1.3rem; font-weight: bold;">#${idPlanillaGenerada}</span></p>
                        <hr style="border: none; border-top: 2px solid #c8e6c9; margin: 15px 0;">
                        <p style="margin: 8px 0;"><strong>Período:</strong> ${periodoPago}</p>
                        <p style="margin: 8px 0;"><strong>Departamento:</strong> ${departamentoData.NombreDepartamento}</p>
                        <p style="margin: 8px 0;"><strong>Empleados:</strong> ${seleccionados.length}</p>
                        <p style="margin: 8px 0;"><strong>Total días:</strong> ${totalDiasSeleccionados}</p>
                        <p style="margin: 8px 0; font-size: 1.15rem;"><strong>Total a pagar:</strong> <span style="color: #4CAF50; font-weight: bold;">${formatearMoneda(totalPagar)}</span></p>
                    </div>
                </div>
            `,
            confirmButtonColor: '#4CAF50',
            confirmButtonText: '<i class="fas fa-check"></i> Aceptar',
            allowOutsideClick: false
        }).then(() => {
            // Limpiar todos los datos
            personalData = [];
            departamentoData = null;
            montoPorDia = 0;
            fechaInicio = null;
            fechaFin = null;
            diasPeriodo = 0;
            planillaAutorizadaActual = null;

            // Ocultar vista de personal y mostrar vista de período
            document.getElementById('personalView').classList.add('hidden');
            document.getElementById('periodoView').classList.remove('hidden');

            // Limpiar formulario de período
            document.getElementById('periodoForm').reset();
            document.getElementById('totalDiasPeriodo').textContent = '0';
            document.getElementById('btnContinuar').disabled = true;

            // Habilitar inputs de tipo de quincena y mes
            document.getElementById('tipoQuincena').disabled = false;
            document.getElementById('mesAnio').disabled = false;

            // Ocultar botones de PDF y cargar comprobante
            document.getElementById('btnGenerarPDF').style.display = 'none';
            document.getElementById('btnCargarComprobante').style.display = 'none';

            // Mostrar banner informativo nuevamente si estaba oculto
            const infoCard = document.getElementById('infoCardPeriodo');
            if (infoCard) {
                infoCard.style.display = 'flex';
            }

            // Limpiar el periodoInfo
            const periodoInfo = document.getElementById('periodoInfo');
            if (periodoInfo) {
                periodoInfo.innerHTML = `
                    <div class="info-row">
                        <span class="info-label">
                            <i class="fas fa-calendar-alt"></i> Período:
                        </span>
                        <span class="info-value" id="periodoCalculado">Seleccione tipo y mes</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">
                            <i class="fas fa-clock"></i> Total de días:
                        </span>
                        <span class="info-value" id="totalDiasPeriodo">0</span>
                    </div>
                `;
            }

            // Verificar si hay nuevas planillas autorizadas
            verificarPlanillaAutorizada();
        });

    } catch (error) {
        console.error('Error al generar planilla:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al generar la planilla. Por favor, intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

// Formatear moneda
function formatearMoneda(valor) {
    return 'Q ' + parseFloat(valor).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Formatear fecha
function formatearFecha(fecha) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-GT', options);
}