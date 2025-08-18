const odbc = require('odbc');
const Swal = require('sweetalert2');
const conexion = 'DSN=recursos2'; // Asegúrate de tener configurado el DSN correctamente

// Variable para almacenar el empleado seleccionado para descuentos
let selectedEmployee = null;
// Variable para almacenar el empleado seleccionado para suspensiones
let selectedEmployeeSuspension = null;

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
function manejarCambioTipo() {
    const esFaltaToggle = document.getElementById('esFaltaToggle');
    const esFalta = esFaltaToggle.checked;
    
    // Elementos de la interfaz
    const formTypeTitle = document.getElementById('formTypeTitle');
    const toggleText = document.getElementById('toggleText');
    const toggleTextRight = document.querySelector('.toggle-text-right');
    const saveButtonText = document.getElementById('saveButtonText');
    
    // Contenedores de campos
    const tipoSuspensionContainer = document.getElementById('tipoSuspensionContainer');
    const motivoSuspensionContainer = document.getElementById('motivoSuspensionContainer');
    const observacionFaltaContainer = document.getElementById('observacionFaltaContainer');
    
    // Campos de entrada
    const tipoSuspensionSelect = document.getElementById('tipoSuspension');
    const motivoSuspensionTextarea = document.getElementById('motivoSuspension');
    const observacionFaltaTextarea = document.getElementById('observacionFalta');
    
    if (esFalta) {
        // Configurar para FALTA
        formTypeTitle.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Datos de la Falta';
        saveButtonText.textContent = 'Guardar Falta';
        
        // Actualizar estilos del toggle
        toggleText.className = 'toggle-text toggle-inactive';
        toggleTextRight.className = 'toggle-text-right toggle-active';
        
        // Mostrar campos de falta y ocultar de suspensión
        tipoSuspensionContainer.style.display = 'none';
        motivoSuspensionContainer.style.display = 'none';
        observacionFaltaContainer.style.display = 'block';
        observacionFaltaContainer.classList.add('field-fade-in');
        
        // Limpiar y quitar required de campos de suspensión
        tipoSuspensionSelect.value = '';
        tipoSuspensionSelect.removeAttribute('required');
        motivoSuspensionTextarea.value = '';
        motivoSuspensionTextarea.removeAttribute('required');
        
        // Agregar required al campo de falta
        observacionFaltaTextarea.setAttribute('required', 'required');
        
    } else {
        // Configurar para SUSPENSIÓN
        formTypeTitle.innerHTML = '<i class="fas fa-calendar-times"></i> Datos de la Suspensión';
        saveButtonText.textContent = 'Guardar Suspensión';
        
        // Actualizar estilos del toggle
        toggleText.className = 'toggle-text toggle-active';
        toggleTextRight.className = 'toggle-text-right toggle-inactive';
        
        // Mostrar campos de suspensión y ocultar de falta
        tipoSuspensionContainer.style.display = 'block';
        tipoSuspensionContainer.classList.add('field-fade-in');
        motivoSuspensionContainer.style.display = 'block';
        motivoSuspensionContainer.classList.add('field-fade-in');
        observacionFaltaContainer.style.display = 'none';
        
        // Limpiar y quitar required del campo de falta
        observacionFaltaTextarea.value = '';
        observacionFaltaTextarea.removeAttribute('required');
        
        // Agregar required a campos de suspensión
        tipoSuspensionSelect.setAttribute('required', 'required');
        motivoSuspensionTextarea.setAttribute('required', 'required');
    }
    
    // Limpiar contador de caracteres
    document.getElementById('charCount').textContent = '0';
    document.getElementById('charCountFalta').textContent = '0';
}
// Función para buscar colaboradores
async function buscarColaboradores(termino) {
    try {
        const connection = await connectionString();
        
        // Limpiar y preparar el término de búsqueda
        const terminoLimpio = termino.trim().toLowerCase();
        
        // Query más robusta con múltiples formas de búsqueda
        const query = `
            SELECT 
                personal.IdPersonal, 
                TRIM(CONCAT(
                    COALESCE(personal.PrimerNombre, ''), ' ', 
                    COALESCE(personal.SegundoNombre, ''), ' ', 
                    COALESCE(personal.TercerNombre, ''), ' ', 
                    COALESCE(personal.PrimerApellido, ''), ' ', 
                    COALESCE(personal.SegundoApellido, '')
                )) AS NombreCompleto,
                COALESCE(departamentos.NombreDepartamento, 'Sin Departamento') AS NombreDepartamento,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64,
                CASE
                    WHEN planillas.EsCapital = 1 THEN COALESCE(salariosbase.SalarioBaseGuate, 0)
                    ELSE COALESCE(salariosbase.SalarioBase, 0)
                END AS SalarioBase,
                personal.DPI,
                personal.Estado,
                personal.PrimerNombre,
                personal.PrimerApellido
            FROM
                personal
                LEFT JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
                LEFT JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                LEFT JOIN FotosPersonal ON personal.IdPersonal = FotosPersonal.IdPersonal
                LEFT JOIN salariosbase ON salariosbase.Anyo = YEAR(CURDATE())
            WHERE
                personal.Estado IN (1, 5) AND
                (
                    -- Búsqueda por DPI (exacta y parcial)
                    REPLACE(COALESCE(personal.DPI, ''), ' ', '') LIKE ? OR
                    REPLACE(COALESCE(personal.DPI, ''), '-', '') LIKE ? OR
                    
                    -- Búsqueda por nombre completo
                    LOWER(TRIM(CONCAT(
                        COALESCE(personal.PrimerNombre, ''), ' ', 
                        COALESCE(personal.SegundoNombre, ''), ' ', 
                        COALESCE(personal.TercerNombre, ''), ' ', 
                        COALESCE(personal.PrimerApellido, ''), ' ', 
                        COALESCE(personal.SegundoApellido, '')
                    ))) LIKE ? OR
                    
                    -- Búsqueda por primer nombre
                    LOWER(COALESCE(personal.PrimerNombre, '')) LIKE ? OR
                    
                    -- Búsqueda por primer apellido
                    LOWER(COALESCE(personal.PrimerApellido, '')) LIKE ? OR
                    
                    -- Búsqueda por cualquier parte del nombre
                    LOWER(COALESCE(personal.PrimerNombre, '')) LIKE ? OR
                    LOWER(COALESCE(personal.SegundoNombre, '')) LIKE ? OR
                    LOWER(COALESCE(personal.TercerNombre, '')) LIKE ? OR
                    LOWER(COALESCE(personal.PrimerApellido, '')) LIKE ? OR
                    LOWER(COALESCE(personal.SegundoApellido, '')) LIKE ?
                )
            ORDER BY 
                -- Priorizar coincidencias exactas
                CASE 
                    WHEN LOWER(COALESCE(personal.PrimerNombre, '')) = ? THEN 1
                    WHEN LOWER(COALESCE(personal.PrimerApellido, '')) = ? THEN 2
                    WHEN REPLACE(COALESCE(personal.DPI, ''), ' ', '') = ? THEN 3
                    ELSE 4
                END,
                personal.PrimerNombre, 
                personal.PrimerApellido
            LIMIT 15
        `;
        
        // Preparar los términos de búsqueda
        const searchTermDPI = `%${terminoLimpio.replace(/\s+/g, '').replace(/-/g, '')}%`;
        const searchTermName = `%${terminoLimpio}%`;
        const searchTermExact = terminoLimpio;
        const searchTermDPIExact = terminoLimpio.replace(/\s+/g, '').replace(/-/g, '');
        
        console.log('Término de búsqueda:', terminoLimpio);
        console.log('Query ejecutándose...');
        
        const result = await connection.query(query, [
            searchTermDPI,      // DPI con espacios
            searchTermDPI,      // DPI con guiones
            searchTermName,     // Nombre completo
            searchTermName,     // Primer nombre
            searchTermName,     // Primer apellido
            searchTermName,     // Primer nombre (repetido para LIKE)
            searchTermName,     // Segundo nombre
            searchTermName,     // Tercer nombre
            searchTermName,     // Primer apellido (repetido para LIKE)
            searchTermName,     // Segundo apellido
            searchTermExact,    // Para ORDER BY - primer nombre exacto
            searchTermExact,    // Para ORDER BY - primer apellido exacto
            searchTermDPIExact  // Para ORDER BY - DPI exacto
        ]);
        
        await connection.close();
        
        console.log(`Resultados encontrados: ${result.length}`);
        if (result.length > 0) {
            console.log('Primer resultado:', result[0]);
        }
        
        return result;
    } catch (error) {
        console.error('Error detallado en búsqueda:', error);
        mostrarError('Error al buscar colaboradores', `Error: ${error.message}`);
        return [];
    }
}

// Función para guardar el descuento judicial
async function guardarDescuentoJudicial(datos, archivo) {
    try {
        // Primero preparamos el archivo para enviarlo
        const formData = new FormData();
        if (archivo) {
            formData.append('scaner', archivo);
        }
        
        // Añadimos todos los campos a FormData
        Object.keys(datos).forEach(key => {
            formData.append(key, datos[key]);
        });
        
        // Obtenemos el ID del usuario actual
        const usuarioActual = obtenerUsuarioActual();
        formData.append('idUsuario', usuarioActual.id);
        
        const connection = await connectionString();
        
        // Guardamos los datos básicos
        const query = `
            INSERT INTO DescuentosJudiciales 
            (IdPersonal, NoDocumento, MontoEmbargo, LiquidacionProcesales, MontoLiquidacionProcesal, 
             MontoTotal, DescuentoQuincenal, DescuentoQuincenalFinMes, SaldoPendiente, IdUsuario, Scaner)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        // Preparar el archivo para guardarlo en la base de datos
        let scanerBlob = null;
        if (archivo) {
            // Convertir el archivo a ArrayBuffer
            const buffer = await archivo.arrayBuffer();
            scanerBlob = Buffer.from(buffer);
        }
        
        await connection.query(query, [
            datos.idPersonal,
            datos.noDocumento,
            datos.montoEmbargo,
            datos.porcentajeLiquidacion,
            datos.montoLiquidacion,
            datos.montoTotal,
            datos.montoQuincenaMedio,
            datos.montoQuincenaFin,
            datos.montoTotal,
            usuarioActual.id,
            scanerBlob
        ]);
        
        await connection.close();
        return true;
    } catch (error) {
        console.error('Error al guardar descuento judicial:', error);
        mostrarError('Error al guardar', 'No se pudo guardar el descuento judicial. Por favor intente nuevamente.');
        return false;
    }
}

// Función para guardar la suspensión
async function guardarSuspension(datos) {
    try {
        const usuarioActual = obtenerUsuarioActual();
        const connection = await connectionString();
        
        let query, params;
        
        if (datos.esFalta) {
            // Guardar como FALTA
            query = `
                INSERT INTO Suspensiones 
                (IdPersonal, FechaInicio, FechaFin, TipoSuspension, MotivoSuspension, 
                 EsFalta, ObservacionFalta, IdUsuario)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            params = [
                datos.idPersonal,
                datos.fechaInicio,
                datos.fechaFin,
                0,  // TipoSuspension = 0 para faltas
                '', // MotivoSuspension vacío para faltas
                1,  // EsFalta = 1
                datos.observacionFalta,
                usuarioActual.id
            ];
        } else {
            // Guardar como SUSPENSIÓN
            query = `
                INSERT INTO Suspensiones 
                (IdPersonal, FechaInicio, FechaFin, TipoSuspension, MotivoSuspension, 
                 EsFalta, ObservacionFalta, IdUsuario)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            params = [
                datos.idPersonal,
                datos.fechaInicio,
                datos.fechaFin,
                datos.tipoSuspension,
                datos.motivo,
                0,  // EsFalta = 0
                '', // ObservacionFalta vacío para suspensiones
                usuarioActual.id
            ];
        }
        
        await connection.query(query, params);
        await connection.close();
        return true;
        
    } catch (error) {
        console.error('Error al guardar:', error);
        mostrarError('Error al guardar', 'No se pudo guardar el registro. Por favor intente nuevamente.');
        return false;
    }
}

function obtenerUsuarioActual() {
    // Ejemplo: obtener el usuario desde localStorage
    const userData = JSON.parse(localStorage.getItem('userData')) || {};
    return {
        id: userData.IdPersonal || 0, // Valor por defecto en caso de no encontrar usuario
        nombre: userData.NombreCompleto || 'Usuario'
    };
}

// Función para mostrar un mensaje de error
function mostrarError(titulo, mensaje) {
    Swal.fire({
        icon: 'error',
        title: titulo,
        text: mensaje,
        confirmButtonColor: '#FF9800'
    });
}

// Función para mostrar un mensaje de éxito
function mostrarExito(titulo, mensaje) {
    return Swal.fire({
        icon: 'success',
        title: titulo,
        text: mensaje,
        confirmButtonColor: '#4CAF50',
        timer: 3000,
        timerProgressBar: true
    });
}

// Función para mostrar cargando
function mostrarCargando(mensaje) {
    return Swal.fire({
        title: mensaje,
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                <div class="spinner"></div>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}
// Función para aplicar el porcentaje de descuento sobre el salario base
function aplicarPorcentajeSalario() {
    if (!selectedEmployee || !selectedEmployee.SalarioBase) {
        mostrarError('Error', 'No hay un colaborador seleccionado o no se encontró su salario base');
        return;
    }
    
    // Obtener el porcentaje ingresado (usar 35% si no hay valor)
    const porcentaje = parseFloat(document.getElementById('porcentajeDescuento').value) || 35;
    
    if (porcentaje <= 0 || porcentaje > 100) {
        mostrarError('Porcentaje inválido', 'El porcentaje debe estar entre 0 y 100');
        return;
    }
    
    // Calcular el monto de descuento basado en el porcentaje del salario
    const montoDescuento = selectedEmployee.SalarioBase * (porcentaje / 100);
    
    // Distribuir equitativamente en las dos quincenas
    const montoPorQuincena = montoDescuento / 2;
    
    // Actualizar los campos
    document.getElementById('montoQuincenaMedio').value = montoPorQuincena.toFixed(2);
    document.getElementById('montoQuincenaFin').value = montoPorQuincena.toFixed(2);
    
    // Mostrar mensaje informativo
    const verificacionElement = document.getElementById('verificacionTotal');
    verificacionElement.innerHTML = `<i class="fas fa-info-circle"></i> Se ha aplicado el ${porcentaje}% del salario base (${formatearMoneda(selectedEmployee.SalarioBase)})`;
    verificacionElement.className = 'verification-status info';
    
    // Animar el botón
    const boton = document.getElementById('aplicarPorcentaje');
    boton.classList.add('active');
    setTimeout(() => {
        boton.classList.remove('active');
    }, 300);
}

// Función para calcular días entre dos fechas (para suspensiones)
function calcularDuracionSuspension() {
    const fechaInicio = new Date(document.getElementById('fechaInicio').value);
    const fechaFin = new Date(document.getElementById('fechaFin').value);
    
    // Validar que las fechas sean válidas
    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
        document.getElementById('duracionSuspension').textContent = '0 días';
        return;
    }
    
    // Validar que la fecha de fin no sea anterior a la de inicio
    if (fechaFin < fechaInicio) {
        document.getElementById('duracionSuspension').textContent = 'Fecha inválida';
        document.getElementById('duracionSuspension').classList.add('invalid');
        return;
    }
    
    // Calcular la diferencia en días
    const diferenciaTiempo = fechaFin.getTime() - fechaInicio.getTime();
    const diferenciaDias = Math.round(diferenciaTiempo / (1000 * 3600 * 24)) + 1; // +1 para incluir el día final
    
    // Actualizar el elemento con la duración
    document.getElementById('duracionSuspension').textContent = `${diferenciaDias} día${diferenciaDias !== 1 ? 's' : ''}`;
    document.getElementById('duracionSuspension').classList.remove('invalid');
    
    // Añadir animación al cambiar el valor
    document.getElementById('duracionSuspension').classList.add('pulse');
    setTimeout(() => {
        document.getElementById('duracionSuspension').classList.remove('pulse');
    }, 500);
}

// Función para limpiar el formulario de descuentos
function limpiarFormularioDescuentos() {
    document.getElementById('employeeInfo').style.display = 'none';
    document.getElementById('discountForm').style.display = 'none';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('noDocumento').value = '';
    document.getElementById('montoEmbargo').value = '';
    document.getElementById('porcentajeLiquidacion').value = '';
    document.getElementById('montoLiquidacion').innerText = 'Q 0.00';
    document.getElementById('montoTotal').innerText = 'Q 0.00';
    document.getElementById('porcentajeDescuento').value = '';
    document.getElementById('montoQuincenaMedio').value = '';
    document.getElementById('montoQuincenaFin').value = '';
    
    // Restablecer verificación de distribución
    const verificacionElement = document.getElementById('verificacionTotal');
    verificacionElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> La suma de las quincenas debe ser igual al monto total';
    verificacionElement.className = 'verification-status';
    
    // Eliminar el empleado seleccionado
    selectedEmployee = null;
}

// Función para limpiar el formulario de suspensiones
function limpiarFormularioSuspensiones() {
    document.getElementById('employeeInfoSuspension').style.display = 'none';
    document.getElementById('suspensionForm').style.display = 'none';
    document.getElementById('searchInputSuspension').value = '';
    document.getElementById('searchResultsSuspension').style.display = 'none';
    document.getElementById('searchResultsSuspension').innerHTML = '';
    document.getElementById('fechaInicio').value = '';
    document.getElementById('fechaFin').value = '';
    document.getElementById('tipoSuspension').value = '';
    document.getElementById('motivoSuspension').value = '';
    document.getElementById('observacionFalta').value = '';
    document.getElementById('esFaltaToggle').checked = false;
    document.getElementById('duracionSuspension').textContent = '0 días';
    document.getElementById('charCount').textContent = '0';
    document.getElementById('charCountFalta').textContent = '0';
    
    // Resetear la vista a suspensión por defecto
    manejarCambioTipo();
    
    selectedEmployeeSuspension = null;
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

// Función para seleccionar un empleado para descuentos
function seleccionarEmpleado(empleado) {
    selectedEmployee = empleado;
    
    // Actualizar la información del empleado
    document.getElementById('employeeName').textContent = empleado.NombreCompleto;
    document.getElementById('employeeDepartment').textContent = empleado.NombreDepartamento;
    document.getElementById('employeeId').textContent = empleado.IdPersonal;
    
    // Actualizar la foto del empleado
    const photoElement = document.getElementById('employeePhoto');
    if (empleado.FotoBase64) {
        photoElement.src = empleado.FotoBase64;
    } else {
        photoElement.src = '../Imagenes/user-default.png';
    }
    
    // Mostrar la información del empleado y el formulario de descuentos
    document.getElementById('employeeInfo').style.display = 'block';
    document.getElementById('discountForm').style.display = 'block';
    
    // Ocultar los resultados de búsqueda
    document.getElementById('searchResults').style.display = 'none';
    
    // Agregar clase de seleccionado
    const items = document.querySelectorAll('.search-result-item');
    items.forEach(item => {
        if (item.dataset.id === empleado.IdPersonal) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    // Si hay salario base, calcular el 35% por límite de embargo
    if (empleado.SalarioBase) {
        // Calcular el 35% del salario base
        const limiteEmbargo = empleado.SalarioBase * 0.35;
        
        // Dividir en dos partes para las quincenas
        const montoPorQuincena = limiteEmbargo / 2;
        
        // Mostrar sugerencia de límite como tooltip
        const montoEmbargoInput = document.getElementById('montoEmbargo');
        montoEmbargoInput.setAttribute('data-tooltip', `Límite sugerido (35% del salario): ${formatearMoneda(limiteEmbargo)}`);
        
        // Pre-llenar el campo de porcentaje con 35%
        document.getElementById('porcentajeDescuento').value = "35";
        
        // Pre-llenar los campos de quincenas con la mitad del límite
        document.getElementById('montoQuincenaMedio').value = montoPorQuincena.toFixed(2);
        document.getElementById('montoQuincenaFin').value = montoPorQuincena.toFixed(2);
        
        // Agregar aviso sobre el límite de embargo
        const verificacionElement = document.getElementById('verificacionTotal');
        verificacionElement.innerHTML = `<i class="fas fa-info-circle"></i> Límite sugerido de descuento: ${formatearMoneda(limiteEmbargo)} (35% del salario base)`;
        verificacionElement.className = 'verification-status info';
    }
    
    // Enfocar el primer campo del formulario
    document.getElementById('noDocumento').focus();
    
    // Animación suave para desplazarse al formulario
    document.getElementById('discountForm').scrollIntoView({ behavior: 'smooth' });
}

// Función para seleccionar un empleado para suspensiones
function seleccionarEmpleadoSuspension(empleado) {
    selectedEmployeeSuspension = empleado;
    
    // Actualizar la información del empleado
    document.getElementById('employeeNameSuspension').textContent = empleado.NombreCompleto;
    document.getElementById('employeeDepartmentSuspension').textContent = empleado.NombreDepartamento;
    document.getElementById('employeeIdSuspension').textContent = empleado.IdPersonal;
    
    // Actualizar la foto del empleado
    const photoElement = document.getElementById('employeePhotoSuspension');
    if (empleado.FotoBase64) {
        photoElement.src = empleado.FotoBase64;
    } else {
        photoElement.src = '../Imagenes/user-default.png';
    }
    
    // Mostrar la información del empleado y el formulario de suspensiones
    document.getElementById('employeeInfoSuspension').style.display = 'block';
    document.getElementById('suspensionForm').style.display = 'block';
    
    // Ocultar los resultados de búsqueda
    document.getElementById('searchResultsSuspension').style.display = 'none';
    
    // Agregar clase de seleccionado
    const items = document.querySelectorAll('#searchResultsSuspension .search-result-item');
    items.forEach(item => {
        if (item.dataset.id === empleado.IdPersonal) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    // Establecer fecha actual como predeterminada si no hay fechas seleccionadas
    if (!document.getElementById('fechaInicio').value) {
        const hoy = new Date();
        const fechaHoyStr = hoy.toISOString().split('T')[0];
        document.getElementById('fechaInicio').value = fechaHoyStr;
    }
    
    // Enfocar el primer campo del formulario
    document.getElementById('fechaInicio').focus();
    
    // Animación suave para desplazarse al formulario
    document.getElementById('suspensionForm').scrollIntoView({ behavior: 'smooth' });
}

// Función para calcular el monto de liquidación
function calcularMontoLiquidacion() {
    const montoEmbargo = parseFloat(document.getElementById('montoEmbargo').value) || 0;
    const porcentajeLiquidacion = parseFloat(document.getElementById('porcentajeLiquidacion').value) || 0;
    
    const montoLiquidacion = (montoEmbargo * porcentajeLiquidacion) / 100;
    const montoTotal = montoEmbargo + montoLiquidacion;
    
    // Actualizar elementos en la interfaz
    document.getElementById('montoLiquidacion').innerText = formatearMoneda(montoLiquidacion);
    document.getElementById('montoTotal').innerText = formatearMoneda(montoTotal);
    
    // Verificar si el monto total supera el límite de embargo (35% del salario)
    if (selectedEmployee && selectedEmployee.SalarioBase) {
        const limiteEmbargo = selectedEmployee.SalarioBase * 0.35;
        
        if (montoTotal > limiteEmbargo) {
            // Mostrar advertencia de que excede el límite legal
            const verificacionElement = document.getElementById('verificacionTotal');
            verificacionElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ¡Advertencia! El monto total ${formatearMoneda(montoTotal)} excede el límite legal de ${formatearMoneda(limiteEmbargo)} (35% del salario)`;
            verificacionElement.className = 'verification-status warning';
        }
    }
    
    // Sugerir distribución equitativa en las quincenas
    const mitadMonto = montoTotal / 2;
    document.getElementById('montoQuincenaMedio').value = mitadMonto.toFixed(2);
    document.getElementById('montoQuincenaFin').value = mitadMonto.toFixed(2);
    
    // Agregar una animación temporal a los resultados
    const animarElemento = (id) => {
        const elemento = document.getElementById(id);
        elemento.classList.add('highlight');
        setTimeout(() => {
            elemento.classList.remove('highlight');
        }, 300);
    };
    
    animarElemento('montoLiquidacion');
    animarElemento('montoTotal');
    
    return montoLiquidacion;
}
// Función para cargar los resultados de búsqueda para descuentos y suspensiones
function cargarResultadosBusqueda(resultados, contenedor, tipo) {
    const container = document.getElementById(contenedor);
    container.innerHTML = '';
    
    if (resultados.length === 0) {
        container.innerHTML = '<div class="no-results">No se encontraron resultados</div>';
        container.style.display = 'block';
        return;
    }
    
    const template = document.getElementById('searchResultTemplate');
    
    resultados.forEach(resultado => {
        const clone = template.content.cloneNode(true);
        const item = clone.querySelector('.search-result-item');
        
        item.dataset.id = resultado.IdPersonal;
        item.querySelector('.result-name').textContent = resultado.NombreCompleto;
        item.querySelector('.result-id').textContent = `ID: ${resultado.IdPersonal} - ${resultado.NombreDepartamento}`;
        
        // Agregar evento de clic al botón de selección según el tipo
        const selectButton = item.querySelector('.select-button');
        if (tipo === 'descuentos') {
            selectButton.addEventListener('click', () => seleccionarEmpleado(resultado));
            // Agregar evento de clic al elemento completo
            item.addEventListener('click', () => seleccionarEmpleado(resultado));
        } else {
            selectButton.addEventListener('click', () => seleccionarEmpleadoSuspension(resultado));
            // Agregar evento de clic al elemento completo
            item.addEventListener('click', () => seleccionarEmpleadoSuspension(resultado));
        }
        
        container.appendChild(item);
    });
    
    container.style.display = 'block';
}

// Función para manejar la visualización de archivos
function manejarVistaPrevia(fileInput, previewContainer) {
    const filePreview = document.getElementById(previewContainer);

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Mostrar información del archivo
        filePreview.innerHTML = `
            <div class="file-info">
                <i class="file-icon fas ${file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-image'}"></i>
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
                <i class="remove-file fas fa-times-circle" id="remove${previewContainer}"></i>
            </div>
        `;
        filePreview.classList.add('has-file');
        
        // Botón para eliminar el archivo
        document.getElementById(`remove${previewContainer}`).addEventListener('click', function(e) {
            e.stopPropagation();
            fileInput.value = '';
            filePreview.innerHTML = '';
            filePreview.classList.remove('has-file');
        });
    } else {
        filePreview.innerHTML = '';
        filePreview.classList.remove('has-file');
    }
}

// Función para formatear el tamaño del archivo
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Función para cambiar entre pestañas
function cambiarPestana(tabId) {
    // Ocultar todos los formularios
    document.querySelectorAll('.form-container').forEach(form => {
        form.classList.remove('active');
    });
    
    // Mostrar el formulario seleccionado
    document.getElementById(`${tabId}Form`).classList.add('active');
    
    // Actualizar los botones de pestaña
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Activar el botón seleccionado
    document.querySelector(`.tab-button[data-form="${tabId}"]`).classList.add('active');
    
    // Mover el slider de pestaña
    const activeTab = document.querySelector(`.tab-button[data-form="${tabId}"]`);
    const tabSlider = document.querySelector('.tab-slider');
    const tabIndex = Array.from(document.querySelectorAll('.tab-button')).indexOf(activeTab);
    const sliderWidth = 100 / document.querySelectorAll('.tab-button').length;
    
    tabSlider.style.left = `${tabIndex * sliderWidth}%`;
    tabSlider.style.width = `${sliderWidth}%`;
    
    // Cambiar el ícono del header dependiendo de la pestaña
    const iconWrapper = document.querySelector('.icon-wrapper i');
    if (tabId === 'descuentos') {
        iconWrapper.className = 'fas fa-gavel';
        document.getElementById('formTitle').textContent = 'Descuentos Judiciales';
    } else {
        iconWrapper.className = 'fas fa-calendar-times';
        document.getElementById('formTitle').textContent = 'Suspensiones & Faltas';
    }
}

// Mostrar ayuda contextual
function mostrarAyuda() {
    // Determinar qué pestaña está activa
    const tabActiva = document.querySelector('.tab-button.active').dataset.form;
    
    let contenidoAyuda = '';
    
    if (tabActiva === 'descuentos') {
        contenidoAyuda = `
            <div class="help-content" style="text-align: left; max-height: 70vh; overflow-y: auto; padding: 15px;">
                <div class="help-section">
                    <h3 style="color: #FF9800; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">¿Qué son los Descuentos Judiciales?</h3>
                    <p>Los descuentos judiciales son retenciones ordenadas por un juez que se aplican al salario de un colaborador para pagar deudas, pensiones alimenticias u otras obligaciones legales.</p>
                </div>
                
                <div class="help-section" style="margin-top: 20px;">
                    <h3 style="color: #FF9800; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">Cómo usar esta pantalla</h3>
                    <ol style="padding-left: 20px;">
                        <li style="margin-bottom: 10px;"><b>Buscar Colaborador:</b> Ingrese el nombre o DPI del colaborador al que se le aplicará el descuento.</li>
                        <li style="margin-bottom: 10px;"><b>Datos del Embargo:</b> Ingrese el número de documento judicial, el monto del embargo y el porcentaje de liquidación procesal.</li>
                        <li style="margin-bottom: 10px;"><b>Distribución:</b> Indique cómo se distribuirá el descuento entre las quincenas.</li>
                        <li style="margin-bottom: 10px;"><b>Porcentaje sobre Salario:</b> También puede aplicar un porcentaje específico del salario base (Por ley, no debe exceder el 35%).</li>
                        <li style="margin-bottom: 10px;"><b>Guardar:</b> Una vez completados los datos, guarde la información.</li>
                    </ol>
                </div>
                
                <div class="help-section" style="margin-top: 20px;">
                    <h3 style="color: #FF9800; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">Consideraciones Importantes</h3>
                    <ul style="padding-left: 20px;">
                        <li style="margin-bottom: 10px;"><b>Límite Legal:</b> Por ley, los descuentos judiciales no deben exceder el 35% del salario base del colaborador.</li>
                        <li style="margin-bottom: 10px;"><b>Distribución en Quincenas:</b> Puede distribuir el monto total en dos partes, una para cada quincena del mes.</li>
                        <li style="margin-bottom: 10px;"><b>Monto de Liquidación:</b> Es un porcentaje adicional que se calcula sobre el monto del embargo, determinado por el juzgado.</li>
                    </ul>
                </div>
            </div>
        `;
    } else {
        contenidoAyuda = `
            <div class="help-content" style="text-align: left; max-height: 70vh; overflow-y: auto; padding: 15px;">
                <div class="help-section">
                    <h3 style="color: #FF9800; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">¿Qué son las Suspensiones?</h3>
                    <p>Las suspensiones son períodos en los que un colaborador no asiste al trabajo por diferentes motivos como enfermedad, permisos especiales o decisiones administrativas, afectando su relación laboral temporalmente.</p>
                </div>
                
                <div class="help-section" style="margin-top: 20px;">
                    <h3 style="color: #FF9800; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">Cómo usar esta pantalla</h3>
                    <ol style="padding-left: 20px;">
                        <li style="margin-bottom: 10px;"><b>Buscar Colaborador:</b> Ingrese el nombre o DPI del colaborador al que se le registrará la suspensión.</li>
                        <li style="margin-bottom: 10px;"><b>Fechas:</b> Seleccione la fecha de inicio y finalización de la suspensión.</li>
                        <li style="margin-bottom: 10px;"><b>Motivo:</b> Explique brevemente la razón de la suspensión (máximo 255 caracteres).</li>
                        <li style="margin-bottom: 10px;"><b>Documento de respaldo:</b> Puede adjuntar un documento que justifique la suspensión.</li>
                        <li style="margin-bottom: 10px;"><b>Guardar:</b> Una vez completados los datos, guarde la información.</li>
                    </ol>
                </div>
                
                <div class="help-section" style="margin-top: 20px;">
                    <h3 style="color: #FF9800; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">Consideraciones Importantes</h3>
                    <ul style="padding-left: 20px;">
                        <li style="margin-bottom: 10px;"><b>Fechas válidas:</b> La fecha de finalización no debe ser anterior a la fecha de inicio.</li>
                        <li style="margin-bottom: 10px;"><b>Duración:</b> El sistema calculará automáticamente la duración en días de la suspensión.</li>
                        <li style="margin-bottom: 10px;"><b>Documentación:</b> Es recomendable adjuntar un documento que respalde la suspensión para mantener un registro adecuado.</li>
                    </ul>
                </div>
            </div>
        `;
    }
    
    Swal.fire({
        title: `Ayuda - ${tabActiva === 'descuentos' ? 'Descuentos Judiciales' : 'Suspensiones'}`,
        html: contenidoAyuda,
        width: '600px',
        confirmButtonColor: '#FF9800',
        confirmButtonText: 'Entendido'
    });
}
async function cargarTiposSuspension() {
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT 
                TipoSuspensiones.IdTipoSuspension, 
                TipoSuspensiones.TipoSuspensiones
            FROM 
                TipoSuspensiones
            ORDER BY TipoSuspensiones.TipoSuspensiones ASC
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Llenar el select
        const selectElement = document.getElementById('tipoSuspension');
        
        // Limpiar opciones existentes (mantener la primera opción)
        selectElement.innerHTML = '<option value="">Seleccione un tipo de suspensión</option>';
        
        // Agregar las opciones de la base de datos
        result.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.IdTipoSuspension;
            option.textContent = tipo.TipoSuspensiones;
            selectElement.appendChild(option);
        });
        
        console.log(`Cargados ${result.length} tipos de suspensión`);
        
    } catch (error) {
        console.error('Error al cargar tipos de suspensión:', error);
        mostrarError('Error', 'No se pudieron cargar los tipos de suspensión');
    }
}
// Eventos al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
    // Configuración general de la interfaz
    document.querySelector('.container').style.overflowY = 'auto';
    document.querySelector('.container').style.maxHeight = '100vh';
    document.querySelector('.form-card').style.overflow = 'visible';
    document.querySelector('body').style.overflow = 'auto';
    
    // Eventos para las pestañas
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            cambiarPestana(button.dataset.form);
        });
    });
    
    // Iniciar con la pestaña de descuentos activa
    cambiarPestana('suspensiones');
    cargarTiposSuspension();
    // Evento para el botón de ayuda
    document.getElementById('helpButton').addEventListener('click', mostrarAyuda);

    // Evento para el botón de búsqueda de descuentos
    document.getElementById('searchButton').addEventListener('click', async () => {
        const termino = document.getElementById('searchInput').value.trim();
        
        if (termino.length < 3) {
            mostrarError('Búsqueda inválida', 'Ingrese al menos 3 caracteres para buscar');
            return;
        }
        
        // Mostrar indicador de carga
        document.getElementById('searchButton').classList.add('loading');
        
        try {
            const resultados = await buscarColaboradores(termino);
            cargarResultadosBusqueda(resultados, 'searchResults', 'descuentos');
        } finally {
            document.getElementById('searchButton').classList.remove('loading');
        }
    });
    
    // Evento para la tecla Enter en el campo de búsqueda de descuentos
    document.getElementById('searchInput').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById('searchButton').click();
        }
    });
    document.getElementById('esFaltaToggle').addEventListener('change', manejarCambioTipo);
    
    // Contador de caracteres para observación de falta
    document.getElementById('observacionFalta').addEventListener('input', function() {
        const contador = document.getElementById('charCountFalta');
        contador.textContent = this.value.length;
        
        if (this.value.length > 230) {
            contador.style.color = '#FF9800';
        } else if (this.value.length > 200) {
            contador.style.color = '';
        }
    })
    // Eventos para calcular el monto de liquidación automáticamente
    document.getElementById('montoEmbargo').addEventListener('input', calcularMontoLiquidacion);
    document.getElementById('porcentajeLiquidacion').addEventListener('input', calcularMontoLiquidacion);
    
    // Evento para el botón de aplicar porcentaje
    document.getElementById('aplicarPorcentaje').addEventListener('click', aplicarPorcentajeSalario);
    
    // Evento para Enter en el campo de porcentaje de descuento
    document.getElementById('porcentajeDescuento').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            aplicarPorcentajeSalario();
        }
    });
    
    // Evento para el botón de cancelar en descuentos
    document.getElementById('cancelButton').addEventListener('click', () => {
        Swal.fire({
            title: '¿Está seguro?',
            text: 'Se perderán los datos ingresados',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#FF9800',
            cancelButtonColor: '#999',
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No, continuar'
        }).then((result) => {
            if (result.isConfirmed) {
                limpiarFormularioDescuentos();
            }
        });
    });
    
    // Evento para el formulario de descuentos
    document.getElementById('descuentosForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        
        if (!selectedEmployee) {
            mostrarError('Error', 'Debe seleccionar un colaborador');
            return;
        }
        
        const noDocumento = document.getElementById('noDocumento').value.trim();
        const montoEmbargo = parseFloat(document.getElementById('montoEmbargo').value) || 0;
        const porcentajeLiquidacion = parseFloat(document.getElementById('porcentajeLiquidacion').value) || 0;
        
        // Validaciones
        if (!noDocumento) {
            mostrarError('Datos incompletos', 'Debe ingresar el número de documento');
            return;
        }
        
        if (montoEmbargo <= 0) {
            mostrarError('Datos inválidos', 'El monto del embargo debe ser mayor a cero');
            return;
        }
        
        if (porcentajeLiquidacion < 0 || porcentajeLiquidacion > 100) {
            mostrarError('Datos inválidos', 'El porcentaje de liquidación debe estar entre 0 y 100');
            return;
        }
        
        const montoQuincenaMedio = parseFloat(document.getElementById('montoQuincenaMedio').value) || 0;
        const montoQuincenaFin = parseFloat(document.getElementById('montoQuincenaFin').value) || 0;
        
        // Obtener el archivo escaneado
        const archivoInput = document.getElementById('fileScaner');
        const archivo = archivoInput.files.length > 0 ? archivoInput.files[0] : null;
        
        // Validar el tamaño del archivo (máximo 14MB)
        if (archivo && archivo.size > 14 * 1024 * 1024) {
            mostrarError('Archivo muy grande', 'El archivo escaneado no debe superar los 14MB');
            return;
        }
        
        // Calcular el monto de liquidación
        const montoLiquidacion = (montoEmbargo * porcentajeLiquidacion) / 100;
        
        // Calcular el monto total
        const montoTotal = montoEmbargo + montoLiquidacion;
        
        // Preparar los datos
        const datos = {
            idPersonal: selectedEmployee.IdPersonal,
            noDocumento: noDocumento,
            montoEmbargo: montoEmbargo,
            porcentajeLiquidacion: porcentajeLiquidacion,
            montoLiquidacion: montoLiquidacion,
            montoTotal: montoTotal,
            montoQuincenaMedio: montoQuincenaMedio,
            montoQuincenaFin: montoQuincenaFin
        };
        
        // Mostrar cargando
        const loadingSwal = mostrarCargando('Guardando descuento judicial...');
        
        try {
            const resultado = await guardarDescuentoJudicial(datos, archivo);
            
            loadingSwal.close();
            
            if (resultado) {
                await mostrarExito(
                    '¡Guardado exitoso!', 
                    `El descuento judicial para ${selectedEmployee.NombreCompleto} ha sido registrado correctamente.`
                );
                
                limpiarFormularioDescuentos();
            }
        } catch (error) {
            loadingSwal.close();
            console.error('Error en el proceso:', error);
        }
    });
    
    // Evento para vista previa de archivo de descuento
    document.getElementById('fileScaner').addEventListener('change', function() {
        manejarVistaPrevia(this, 'filePreview');
    });
    // Evento para el botón de búsqueda de suspensiones
    document.getElementById('searchButtonSuspension').addEventListener('click', async () => {
        const termino = document.getElementById('searchInputSuspension').value.trim();
        
        if (termino.length < 3) {
            mostrarError('Búsqueda inválida', 'Ingrese al menos 3 caracteres para buscar');
            return;
        }
        
        // Mostrar indicador de carga
        document.getElementById('searchButtonSuspension').classList.add('loading');
        
        try {
            const resultados = await buscarColaboradores(termino);
            cargarResultadosBusqueda(resultados, 'searchResultsSuspension', 'suspensiones');
        } finally {
            document.getElementById('searchButtonSuspension').classList.remove('loading');
        }
    });
    
    // Evento para la tecla Enter en el campo de búsqueda de suspensiones
    document.getElementById('searchInputSuspension').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById('searchButtonSuspension').click();
        }
    });
    
    // Eventos para calcular duración de la suspensión cuando cambian las fechas
    document.getElementById('fechaInicio').addEventListener('change', calcularDuracionSuspension);
    document.getElementById('fechaFin').addEventListener('change', calcularDuracionSuspension);
    
    // Evento para contar caracteres en el campo de motivo
    document.getElementById('motivoSuspension').addEventListener('input', function() {
        const contador = document.getElementById('charCount');
        contador.textContent = this.value.length;
        
        // Cambiar color si se acerca al límite
        if (this.value.length > 230) {
            contador.style.color = '#FF9800';
        } else if (this.value.length > 200) {
            contador.style.color = '';
        }
    });
    
    // Evento para el botón de cancelar en suspensiones
    document.getElementById('cancelButtonSuspension').addEventListener('click', () => {
        Swal.fire({
            title: '¿Está seguro?',
            text: 'Se perderán los datos ingresados',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#FF9800',
            cancelButtonColor: '#999',
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No, continuar'
        }).then((result) => {
            if (result.isConfirmed) {
                limpiarFormularioSuspensiones();
            }
        });
    });
    
    
    // Evento para el formulario de suspensiones
    document.getElementById('suspensionesForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        
        if (!selectedEmployeeSuspension) {
            mostrarError('Error', 'Debe seleccionar un colaborador');
            return;
        }
        
        const fechaInicio = document.getElementById('fechaInicio').value;
        const fechaFin = document.getElementById('fechaFin').value;
        const esFalta = document.getElementById('esFaltaToggle').checked;
        
        // Validaciones básicas
        if (!fechaInicio || !fechaFin) {
            mostrarError('Datos incompletos', 'Debe seleccionar las fechas de inicio y fin');
            return;
        }
        
        if (new Date(fechaFin) < new Date(fechaInicio)) {
            mostrarError('Fechas inválidas', 'La fecha de finalización no puede ser anterior a la fecha de inicio');
            return;
        }
        
        let datos = {
            idPersonal: selectedEmployeeSuspension.IdPersonal,
            fechaInicio: fechaInicio,
            fechaFin: fechaFin,
            esFalta: esFalta
        };
        
        if (esFalta) {
            // Validaciones para FALTA
            const observacionFalta = document.getElementById('observacionFalta').value.trim();
            if (!observacionFalta) {
                mostrarError('Datos incompletos', 'Debe ingresar la observación de la falta');
                return;
            }
            datos.observacionFalta = observacionFalta;
            
        } else {
            // Validaciones para SUSPENSIÓN
            const tipoSuspension = document.getElementById('tipoSuspension').value;
            const motivo = document.getElementById('motivoSuspension').value.trim();
            
            if (!tipoSuspension) {
                mostrarError('Datos incompletos', 'Debe seleccionar el tipo de suspensión');
                return;
            }
            
            if (!motivo) {
                mostrarError('Datos incompletos', 'Debe ingresar el motivo de la suspensión');
                return;
            }
            
            datos.tipoSuspension = tipoSuspension;
            datos.motivo = motivo;
        }
        
        // Mostrar cargando
        const loadingSwal = mostrarCargando(`Guardando ${esFalta ? 'falta' : 'suspensión'}...`);
        
        try {
            const resultado = await guardarSuspension(datos);
            
            loadingSwal.close();
            
            if (resultado) {
                await mostrarExito(
                    '¡Guardado exitoso!', 
                    `${esFalta ? 'La falta' : 'La suspensión'} para ${selectedEmployeeSuspension.NombreCompleto} ha sido registrada correctamente.`
                );
                
                limpiarFormularioSuspensiones();
            }
        } catch (error) {
            loadingSwal.close();
            console.error('Error en el proceso:', error);
        }
    });
    
    // Agregar estilos para la animación de carga y otros efectos
    document.head.insertAdjacentHTML('beforeend', `
        <style>
            .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #FF9800;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .highlight {
                animation: highlight 0.3s;
            }
            
            @keyframes highlight {
                0% { background-color: #f0f8f0; }
                50% { background-color: #e8f5e9; }
                100% { background-color: #f0f8f0; }
            }
            
            .no-results {
                padding: 15px;
                text-align: center;
                color: #777;
                font-style: italic;
            }
            
            .loading::after {
                content: '';
                position: absolute;
                width: 20px;
                height: 20px;
                top: calc(50% - 10px);
                left: calc(50% - 10px);
                border: 2px solid #fff;
                border-radius: 50%;
                border-top-color: transparent;
                animation: spin 0.8s linear infinite;
            }
        </style>
    `);
});
