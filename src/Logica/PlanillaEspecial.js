// Importaciones y configuración inicial
const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const Swal = require('sweetalert2');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { saveAs } = require('file-saver');

// Configuración de conexión a la base de datos
const conexion = 'DSN=recursos2';

// Variables globales para manejo de datos
let departamentosData = [];
let tiposPersonalData = [];
let personalData = [];
let pagoAplicable = 'dominical'; // 'dominical' o 'especial'
let esDiaEspecial = false;
let esDomingo = false;
let filtersApplied = false;
let currentPage = 1;
let itemsPerPage = 10;
let totalPages = 0;
let personalSeleccionado = [];
let logoDivisionActual = null;

// Variables globales para el manejo de colaboradores externos
let externalPersonalData = [];
let externalPersonalSelected = [];
let currentDepartmentLimits = { planFijo: 0, planParcial: 0, planVacacionista: 0 };
let currentPersonalCounts = { fijo: 0, parcial: 0, vacacionista: 0 };

// Elementos DOM
const departamentoSelect = document.getElementById('departamento');
const tipoPersonalSelect = document.getElementById('tipoPersonal');
const fechaInput = document.getElementById('fecha');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const refreshFiltersBtn = document.getElementById('refreshFiltersBtn');
const refreshListBtn = document.getElementById('refreshListBtn');
const personalTableBody = document.getElementById('personalTableBody');
const searchPersonalInput = document.getElementById('searchPersonal');
const selectAllCheckbox = document.getElementById('selectAll');
const generatePlanillaBtn = document.getElementById('generatePlanillaBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const helpBtn = document.getElementById('helpBtn');

// Elementos de Paginación
const firstPageBtn = document.getElementById('firstPageBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const lastPageBtn = document.getElementById('lastPageBtn');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');

// Elementos para modales
const confirmModal = document.getElementById('confirmModal');
const helpModal = document.getElementById('helpModal');
const processModal = document.getElementById('processModal');
const closeModalBtns = document.querySelectorAll('.close-modal');
const cancelGenerateBtn = document.getElementById('cancelGenerateBtn');
const confirmGenerateBtn = document.getElementById('confirmGenerateBtn');
const closeHelpBtn = document.getElementById('closeHelpBtn');

// Elementos de información de estado
const tipoFechaElement = document.getElementById('tipoFecha');
const tipoPagoElement = document.getElementById('tipoPago');
const totalPersonalElement = document.getElementById('totalPersonal');
const totalPagoElement = document.getElementById('totalPago');

// Elementos DOM para el modal de colaboradores externos
const externalModal = document.getElementById('externalModal');
const externalDepartamentoSelect = document.getElementById('externalDepartamento');
const searchExternalPersonalInput = document.getElementById('searchExternalPersonal');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const externalPersonalTableBody = document.getElementById('externalPersonalTableBody');
const selectAllExternalCheckbox = document.getElementById('selectAllExternal');
const selectedExternalCountSpan = document.getElementById('selectedExternalCount');
const confirmExternalBtn = document.getElementById('confirmExternalBtn');
const cancelExternalBtn = document.getElementById('cancelExternalBtn');
const addExternalBtn = document.getElementById('addExternalBtn');

// Elementos para contadores
const countFijoSpan = document.getElementById('countFijo');
const countParcialSpan = document.getElementById('countParcial');
const countVacacionistaSpan = document.getElementById('countVacacionista');
const maxFijoSpan = document.getElementById('maxFijo');
const maxParcialSpan = document.getElementById('maxParcial');
const maxVacacionistaSpan = document.getElementById('maxVacacionista');
const progressFijoDiv = document.getElementById('progressFijo');
const progressParcialDiv = document.getElementById('progressParcial');
const progressVacacionistaDiv = document.getElementById('progressVacacionista');

// Función para obtener la conexión a la base de datos
async function getConnection() {
    try {
        const connection = await odbc.connect(conexion);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error de conexión:', error);
        mostrarNotificacion('Error de conexión a la base de datos', 'error');
        throw error;
    }
}

// Función para cargar datos del usuario en el header
function cargarInfoUsuario() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (userData) {
        document.getElementById('userName').textContent = userData.NombreCompleto || 'Usuario';
        
        // Determinar rol según el puesto (5 es RRHH)
        let rol = 'Usuario';
        if (userData.Id_Puesto === 5) {
            rol = 'Administrador RRHH';
        } else if (userData.Id_Puesto === 1) {
            rol = 'Gerente';
        } else {
            rol = 'Colaborador';
        }
        
        document.getElementById('userRole').textContent = rol;
        
        // Cargar la imagen del usuario si está disponible
        if (userData.FotoBase64) {
            document.getElementById('userImage').src = userData.FotoBase64;
        }
    }
}

// Función para mostrar notificaciones tipo toast
function mostrarNotificacion(mensaje, tipo = 'info', titulo = null) {
    // Definir títulos según el tipo
    let tituloDefault;
    let icono;
    
    switch (tipo) {
        case 'success':
            tituloDefault = 'Éxito';
            icono = 'check-circle';
            break;
        case 'error':
            tituloDefault = 'Error';
            icono = 'times-circle';
            break;
        case 'warning':
            tituloDefault = 'Advertencia';
            icono = 'exclamation-triangle';
            break;
        case 'info':
        default:
            tituloDefault = 'Información';
            icono = 'info-circle';
            tipo = 'info'; // Asegurar un tipo válido
            break;
    }
    
    // Usar el título proporcionado o el default
    const tituloFinal = titulo || tituloDefault;
    
    // Crear el elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo} animate__animated animate__fadeIn`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icono}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${tituloFinal}</div>
            <div class="toast-message">${mensaje}</div>
        </div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Añadir el toast al contenedor
    const container = document.querySelector('.toast-container');
    container.appendChild(toast);
    
    // Manejar el cierre del toast
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.remove('animate__fadeIn');
        toast.classList.add('animate__fadeOut');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    });
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('animate__fadeIn');
            toast.classList.add('animate__fadeOut');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
}
// Función para cargar departamentos
async function cargarDepartamentos() {
    try {
        const connection = await getConnection();
        
        // Obtener el departamento del usuario desde localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        const idDepartamentoUsuario = userData?.IdSucuDepa;
        
        const query = `
            SELECT
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento,
                departamentos.IdDivision
            FROM
                departamentos
            ORDER BY
                departamentos.NombreDepartamento
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        departamentosData = result;
        
        // Limpiar opciones existentes (mantener solo la opción default)
        while (departamentoSelect.options.length > 1) {
            departamentoSelect.remove(1);
        }
        
        // Agregar las nuevas opciones
        result.forEach(depto => {
            const option = document.createElement('option');
            option.value = depto.IdDepartamento;
            option.textContent = depto.NombreDepartamento;
            // Guardar el IdDivision como un atributo de datos
            option.dataset.idDivision = depto.IdDivision;
            departamentoSelect.appendChild(option);
        });

        // Si el usuario tiene un departamento asignado, seleccionarlo automáticamente y deshabilitar el select
        if (idDepartamentoUsuario) {
            // Seleccionar el departamento del usuario
            departamentoSelect.value = idDepartamentoUsuario;
            
            // Deshabilitar el selector para que no pueda cambiarlo
            departamentoSelect.disabled = true;
            departamentoSelect.classList.add('control-disabled');
            
            // También podemos mostrar un indicador visual
            const departamentoLabel = document.querySelector('label[for="departamento"]');
            if (departamentoLabel) {
                departamentoLabel.innerHTML += ' <i class="fas fa-lock" style="font-size: 0.7rem; color: var(--color-primary);" title="Departamento asignado"></i>';
            }
        }
        
        return result;
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarNotificacion('Error al cargar los departamentos', 'error');
        throw error;
    }
}

// Función para cargar tipos de personal
async function cargarTiposPersonal() {
    try {
        const connection = await getConnection();
        
        const query = `
            SELECT
                TipoPersonal.IdTipo, 
                TipoPersonal.TipoPersonal
            FROM
                TipoPersonal
            ORDER BY 
                TipoPersonal.IdTipo
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        tiposPersonalData = result;
        
        // Limpiar opciones existentes (mantener solo la opción default)
        while (tipoPersonalSelect.options.length > 1) {
            tipoPersonalSelect.remove(1);
        }
        
        // Añadir opción "Todos"
        const todosOption = document.createElement('option');
        todosOption.value = ""; // Valor vacío para indicar "todos"
        todosOption.textContent = "Todos";
        tipoPersonalSelect.appendChild(todosOption);
        
        // Agregar las opciones de la base de datos
        result.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.IdTipo;
            option.textContent = tipo.TipoPersonal;
            tipoPersonalSelect.appendChild(option);
        });
        
        return result;
    } catch (error) {
        console.error('Error al cargar tipos de personal:', error);
        mostrarNotificacion('Error al cargar los tipos de personal', 'error');
        throw error;
    }
}

// Función para verificar si una fecha es domingo
function esFechaDomingo(fecha) {
    const day = new Date(fecha).getDay();
    return day === 0; // 0 = Domingo en JavaScript
}
// Función para verificar si una fecha es día especial para un departamento
async function verificarDiaEspecial(fecha, idDepartamento) {
    try {
        const connection = await getConnection();
        
        // Extraer día y mes de la fecha correctamente, usando UTC para evitar problemas de zona horaria
        let fechaObj;
        
        // Verificar el formato de la fecha y crear el objeto Date adecuado
        if (fecha.includes('T')) {
            // Si ya tiene formato ISO con hora
            fechaObj = new Date(fecha);
        } else {
            // Si es solo fecha (YYYY-MM-DD), agregar hora mediodía para evitar problemas con zonas horarias
            fechaObj = new Date(`${fecha}T12:00:00`);
        }
        
        const dia = fechaObj.getDate(); // Día del mes (1-31)
        const mes = fechaObj.getMonth() + 1; // Mes (1-12)
        
        console.log(`Verificando día especial exacto: ${dia}/${mes} para departamento: ${idDepartamento}`);
        
        // Primero buscar registros específicos para este departamento
        const queryDepartamento = `
            SELECT Dia, Mes, Descripcion, IdDepartamento 
            FROM DiasEspeciales
            WHERE Dia = ? AND Mes = ? AND IdDepartamento = ?
        `;
        
        const resultDepartamento = await connection.query(queryDepartamento, [
            dia.toString(), 
            mes.toString(), 
            idDepartamento
        ]);
        
        // Si encontramos un registro específico para este departamento
        if (resultDepartamento && resultDepartamento.length > 0) {
            console.log("Encontrado día especial específico para este departamento", resultDepartamento[0]);
            await connection.close();
            return {
                esDiaEspecial: true,
                descripcion: resultDepartamento[0].Descripcion,
                esGlobal: false
            };
        }
        
        // Si no encontramos específico, buscamos global (IdDepartamento = 0)
        const queryGlobal = `
            SELECT Dia, Mes, Descripcion, IdDepartamento 
            FROM DiasEspeciales
            WHERE Dia = ? AND Mes = ? AND IdDepartamento = 0
        `;
        
        const resultGlobal = await connection.query(queryGlobal, [
            dia.toString(), 
            mes.toString()
        ]);
        
        await connection.close();
        
        // Si encontramos un día especial global
        if (resultGlobal && resultGlobal.length > 0) {
            console.log("Encontrado día especial global", resultGlobal[0]);
            return {
                esDiaEspecial: true,
                descripcion: resultGlobal[0].Descripcion,
                esGlobal: true // Explícitamente true cuando IdDepartamento = 0
            };
        }
        
        // Si no encontramos ningún día especial
        console.log("No se encontró ningún día especial");
        return {
            esDiaEspecial: false,
            descripcion: '',
            esGlobal: false
        };
        
    } catch (error) {
        console.error('Error al verificar día especial:', error);
        mostrarNotificacion('Error al verificar si es día especial', 'error');
        return {
            esDiaEspecial: false,
            descripcion: '',
            esGlobal: false
        };
    }
}

// Función para determinar el tipo de fecha y el pago aplicable
async function determinarTipoFecha(fecha, idDepartamento) {
    // Verificar si la fecha ya está en formato adecuado
    const fechaNormalizada = fecha.includes('T') ? fecha : `${fecha}T00:00:00`;
    
    // Verificar si es domingo
    const domingo = esFechaDomingo(fechaNormalizada);
    
    // Verificar si es día especial
    const resultadoDiaEspecial = await verificarDiaEspecial(fechaNormalizada, idDepartamento);
    const diaEspecial = resultadoDiaEspecial.esDiaEspecial;
    const descripcionDiaEspecial = resultadoDiaEspecial.descripcion;
    
    // Actualizar variables globales
    esDomingo = domingo;
    esDiaEspecial = diaEspecial;
    
    // Determinar el pago aplicable
    if (diaEspecial) {
        pagoAplicable = 'especial';
        return {
            tipo: 'especial',
            icono: 'calendar-check',
            mensaje: `${descripcionDiaEspecial}`,
            iconoColor: 'var(--color-info)',
            tipoPago: `Pago Día Especial (${descripcionDiaEspecial})`
        };
    } else if (domingo) {
        pagoAplicable = 'dominical';
        return {
            tipo: 'dominical',
            icono: 'calendar-day',
            mensaje: 'Domingo',
            iconoColor: 'var(--color-warning)',
            tipoPago: 'Pago Dominical'
        };
    } else {
        pagoAplicable = null;
        return {
            tipo: 'regular',
            icono: 'calendar-times',
            mensaje: 'Día Regular (No Aplica)',
            iconoColor: 'var(--color-danger)',
            tipoPago: 'No Aplica'
        };
    }
}

// Función para cargar el personal de un departamento
async function cargarPersonalDepartamento(idDepartamento, idTipoPersonal) {
    try {
        const connection = await getConnection();
        
        // Verificar si se ha seleccionado un tipo específico o "Todos"
        const filtrarPorTipo = idTipoPersonal && idTipoPersonal.toString().trim() !== '';
        
        const query = `
            SELECT
                personal.IdPersonal, 
                CONCAT(personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, ''), ', ', personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, '')) AS NombreCompleto,
                personal.IdPuesto,
                Puestos.Nombre AS NombrePuesto,
                Puestos.PagosDominicales,
                Puestos.PagosDiasEspeciales,
                personal.TipoPersonal AS IdTipoPersonal,
                TP.TipoPersonal AS NombreTipoPersonal
            FROM
                personal
                INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                INNER JOIN TipoPersonal TP ON personal.TipoPersonal = TP.IdTipo
            WHERE
                personal.IdSucuDepa = ?
                ${filtrarPorTipo ? 'AND personal.TipoPersonal = ?' : ''}
                AND personal.Estado = 1
            ORDER BY
                personal.PrimerApellido, personal.PrimerNombre
        `;
        
        // Preparar parámetros dependiendo si se filtra por tipo de personal
        const params = filtrarPorTipo ? [idDepartamento, idTipoPersonal] : [idDepartamento];
        
        const result = await connection.query(query, params);
        
        // Guardar datos en variable global
        personalData = result.map(personal => ({
            ...personal,
            PagosDominicales: Number(personal.PagosDominicales),
            PagosDiasEspeciales: Number(personal.PagosDiasEspeciales),
            selected: false
        }));
        
        return personalData;
    } catch (error) {
        console.error('Error al cargar personal:', error);
        mostrarNotificacion('Error al cargar el personal del departamento', 'error');
        return [];
    }
}

// Función auxiliar para reformatear el nombre
function formatearNombreApellido(nombreCompleto) {
    // Suponiendo que el formato actual es "Nombre1 Nombre2 Nombre3 Apellido1 Apellido2"
    const partes = nombreCompleto.split(' ').filter(part => part.trim() !== '');
    
    // Si tiene menos de 2 partes, devolver el nombre original
    if (partes.length < 2) return nombreCompleto;
    
    // Identificar apellidos (asumiendo que al menos hay un nombre y un apellido)
    // Este enfoque es simplificado y puede necesitar ajustes según tu estructura de datos
    let apellidos, nombres;
    
    if (partes.length == 2) {
        // Caso simple: "Nombre Apellido"
        nombres = partes[0];
        apellidos = partes[1];
    } else if (partes.length == 3) {
        // Posibles casos: "Nombre1 Nombre2 Apellido" o "Nombre Apellido1 Apellido2"
        // Asumiremos la segunda opción por ser más común
        nombres = partes[0];
        apellidos = `${partes[1]} ${partes[2]}`;
    } else if (partes.length >= 4) {
        // Para nombres más complejos, asumimos que los últimos dos son apellidos
        nombres = partes.slice(0, partes.length - 2).join(' ');
        apellidos = `${partes[partes.length - 2]} ${partes[partes.length - 1]}`;
    }
    
    return `${apellidos}, ${nombres}`;
}
// Función para actualizar la UI con la información del tipo de fecha
function actualizarInfoTipoFecha(infoTipoFecha) {
    // Actualizar el icono y texto del tipo de fecha
    tipoFechaElement.querySelector('.status-icon i').className = `fas fa-${infoTipoFecha.icono}`;
    tipoFechaElement.querySelector('.status-icon i').style.color = infoTipoFecha.iconoColor;
    tipoFechaElement.querySelector('.status-value').textContent = infoTipoFecha.mensaje;
    
    // Actualizar la información del tipo de pago
    tipoPagoElement.querySelector('.status-value').textContent = infoTipoFecha.tipoPago;
    
    // Establecer estilos según el tipo
    if (infoTipoFecha.tipo === 'regular') {
        tipoPagoElement.querySelector('.status-icon i').className = 'fas fa-times-circle';
        tipoPagoElement.querySelector('.status-icon i').style.color = 'var(--color-danger)';
    } else if (infoTipoFecha.tipo === 'dominical') {
        tipoPagoElement.querySelector('.status-icon i').className = 'fas fa-calendar-day';
        tipoPagoElement.querySelector('.status-icon i').style.color = 'var(--color-warning)';
    } else if (infoTipoFecha.tipo === 'especial') {
        tipoPagoElement.querySelector('.status-icon i').className = 'fas fa-calendar-check';
        tipoPagoElement.querySelector('.status-icon i').style.color = 'var(--color-info)';
    }
}

// Función para renderizar la tabla de personal
function renderizarTablaPersonal(personal, paginar = true) {
    // Limpiar contenido actual
    personalTableBody.innerHTML = '';
    
    // Si no hay datos, mostrar mensaje
    if (!personal || personal.length === 0) {
        personalTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7">
                    <div class="empty-message">
                        <i class="fas fa-user-slash"></i>
                        <p>No se encontraron colaboradores para los filtros seleccionados</p>
                    </div>
                </td>
            </tr>
        `;
        
        // Actualizar información de totales
        totalPersonalElement.querySelector('.status-value').textContent = '0';
        totalPagoElement.querySelector('.status-value').textContent = 'Q 0.00';
        
        // Deshabilitar botones de acción
        generatePlanillaBtn.disabled = true;
        deleteSelectedBtn.disabled = true;
        
        return;
    }
    
    // Calcular paginación
    let personalPaginado = personal;
    
    if (paginar) {
        totalPages = Math.ceil(personal.length / itemsPerPage);
        
        // Actualizar indicadores de paginación
        currentPageSpan.textContent = currentPage;
        totalPagesSpan.textContent = totalPages;
        
        // Habilitar/deshabilitar botones de paginación
        firstPageBtn.disabled = currentPage === 1;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
        lastPageBtn.disabled = currentPage === totalPages;
        
        // Filtrar los datos para la página actual
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        personalPaginado = personal.slice(startIndex, endIndex);
    }
    
    // Calcular totales
    const totalColaboradores = personal.length;
    let totalMonto = 0;
    
    // Renderizar cada fila
    personalPaginado.forEach(persona => {
        const tr = document.createElement('tr');
        
        // Si es colaborador externo, agregar clase especial a la fila
        if (persona.esExterno) {
            tr.classList.add('external-collaborator-row');
        }
        
        // Determinar el pago aplicable para este colaborador
        let montoAplicable = 0;
        let tipoPagoMostrar = 'No aplica';
        
        if (pagoAplicable === 'dominical' && esDomingo) {
            montoAplicable = persona.PagosDominicales;
            tipoPagoMostrar = 'Dominical';
            // Sumar al total general
            totalMonto += montoAplicable;
        } else if (pagoAplicable === 'especial' && esDiaEspecial) {
            montoAplicable = persona.PagosDiasEspeciales;
            tipoPagoMostrar = 'Día Especial';
            // Sumar al total general
            totalMonto += montoAplicable;
        }
        
        // Crear celda de checkbox
        const tdCheck = document.createElement('td');
        tdCheck.innerHTML = `
            <div class="th-content">
                <input type="checkbox" id="check_${persona.IdPersonal}" class="form-check-input personal-check" 
                       ${persona.selected ? 'checked' : ''} data-id="${persona.IdPersonal}">
                <label for="check_${persona.IdPersonal}"></label>
            </div>
        `;
        tr.appendChild(tdCheck);
        
        // Crear celda de ID
        const tdId = document.createElement('td');
        tdId.textContent = persona.IdPersonal;
        tr.appendChild(tdId);
        
        // Crear celda de nombre con indicador para colaboradores externos
        const tdNombre = document.createElement('td');
        let nombreHTML = persona.NombreCompleto;
        
        // Si es un colaborador externo, agregar indicador visual
        if (persona.esExterno) {
            nombreHTML = `
                <div class="external-name">
                    ${persona.NombreCompleto}
                    <span class="external-badge" title="Colaborador externo de ${persona.departamentoOrigen}">
                        <i class="fas fa-exchange-alt"></i>
                    </span>
                </div>
            `;
        }
        
        tdNombre.innerHTML = nombreHTML;
        tr.appendChild(tdNombre);
        
        // Crear celda de puesto
        const tdPuesto = document.createElement('td');
        tdPuesto.textContent = persona.NombrePuesto;
        tr.appendChild(tdPuesto);
        
        // Crear celda de tipo de personal con estilo para los externos
        const tdTipoPersonal = document.createElement('td');
        
        if (persona.esExterno) {
            // Determinar la clase CSS según el tipo de personal
            let typeClass = '';
            if (persona.IdTipoPersonal === 1 || persona.NombreTipoPersonal.toLowerCase().includes('fijo')) {
                typeClass = 'type-fijo';
            } else if (persona.IdTipoPersonal === 2 || persona.NombreTipoPersonal.toLowerCase().includes('parcial')) {
                typeClass = 'type-parcial';
            } else if (persona.IdTipoPersonal === 3 || persona.NombreTipoPersonal.toLowerCase().includes('vacacionista')) {
                typeClass = 'type-vacacionista';
            }
            
            tdTipoPersonal.innerHTML = `
                <span class="personnel-type-tag ${typeClass}">
                    ${persona.NombreTipoPersonal}
                </span>
            `;
        } else {
            tdTipoPersonal.textContent = persona.NombreTipoPersonal;
        }
        
        tr.appendChild(tdTipoPersonal);
        
        // Crear celda de pago aplicable
        const tdPagoAplicable = document.createElement('td');
        
        if (montoAplicable > 0) {
            tdPagoAplicable.innerHTML = `
                <span class="pago-aplicable">${tipoPagoMostrar}: Q ${montoAplicable.toFixed(2)}</span>
            `;
        } else {
            tdPagoAplicable.textContent = 'No aplica para esta fecha';
        }
        
        tr.appendChild(tdPagoAplicable);
        
        // Añadir la fila a la tabla
        personalTableBody.appendChild(tr);
    });
    
    // Actualizar información de totales
    totalPersonalElement.querySelector('.status-value').textContent = totalColaboradores;
    totalPagoElement.querySelector('.status-value').textContent = `Q ${totalMonto.toFixed(2)}`;
    
    // Habilitar/deshabilitar botones según si hay seleccionados
    actualizarBotonesSeleccion();
    
    // Añadir event listeners a los checkboxes
    const checkboxes = document.querySelectorAll('.personal-check');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', manejarSeleccionPersonal);
    });
}

// Función para manejar la selección de personal mediante checkboxes
function manejarSeleccionPersonal(e) {
    const checkbox = e.target;
    const idPersonal = parseInt(checkbox.dataset.id);
    const isChecked = checkbox.checked;
    
    // Actualizar el estado en el array de datos
    personalData = personalData.map(persona => {
        if (persona.IdPersonal === idPersonal) {
            return {...persona, selected: isChecked};
        }
        return persona;
    });
    
    // Actualizar botones de selección
    actualizarBotonesSeleccion();
    
    // Verificar si todos están seleccionados
    actualizarSelectAll();
    
    // Si hay colaboradores externos, actualizar sus contadores
    if (document.getElementById('countFijo')) {
        calcularConteoActualPorTipo();
    }
}

// Función para actualizar el estado del checkbox "Seleccionar todos"
function actualizarSelectAll() {
    const totalItems = personalData.length;
    const selectedItems = personalData.filter(p => p.selected).length;
    
    // Actualizar el estado del checkbox "Seleccionar todos"
    selectAllCheckbox.checked = totalItems > 0 && selectedItems === totalItems;
    selectAllCheckbox.indeterminate = selectedItems > 0 && selectedItems < totalItems;
}

// Función para actualizar el estado de los botones de selección
function actualizarBotonesSeleccion() {
    const haySeleccionados = personalData.some(p => p.selected);
    deleteSelectedBtn.disabled = !haySeleccionados;
    
    // Solo habilitar el botón de generar planilla si hay seleccionados y el pago es aplicable
    generatePlanillaBtn.disabled = !haySeleccionados || (!esDomingo && !esDiaEspecial);
}

// Función para buscar personal por nombre
function buscarPersonal(searchTerm) {
    if (!searchTerm.trim()) {
        // Si no hay término de búsqueda, mostrar todos
        renderizarTablaPersonal(personalData);
        return;
    }
    
    // Filtrar por término de búsqueda (insensible a mayúsculas/minúsculas)
    const filtrado = personalData.filter(persona => 
        persona.NombreCompleto.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Renderizar los resultados filtrados
    renderizarTablaPersonal(filtrado);
}

// Función para aplicar los filtros y cargar personal
async function aplicarFiltros(e) {
    if (e) e.preventDefault();
    
    // Validar que se hayan seleccionado los campos requeridos
    const idDepartamento = departamentoSelect.value;
    const idTipoPersonal = tipoPersonalSelect.value.trim() !== "" ? tipoPersonalSelect.value : null;
    const fecha = fechaInput.value;
    
    if (!idDepartamento || !fecha) {
        mostrarNotificacion('Debe seleccionar departamento y fecha', 'warning');
        return;
    }
    const fechaSeleccionada = new Date(fecha);
    fechaSeleccionada.setHours(0, 0, 0, 0); // Eliminar la parte de tiempo
    
    const fechaActual = new Date();
    fechaActual.setHours(0, 0, 0, 0); // Eliminar la parte de tiempo para comparar solo las fechas
    
    if (fechaSeleccionada < fechaActual) {
        mostrarNotificacion('No es posible generar planillas para fechas pasadas', 'error', 'Fecha no válida');
        
        // Mostrar mensaje en la tabla
        personalTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">
                    <div class="empty-message">
                        <i class="fas fa-calendar-times"></i>
                        <p>No es posible generar planillas para fechas pasadas.<br>Por favor, seleccione la fecha actual o una fecha futura.</p>
                    </div>
                </td>
            </tr>
        `;
        
        // Actualizar información de totales
        totalPersonalElement.querySelector('.status-value').textContent = '0';
        totalPagoElement.querySelector('.status-value').textContent = 'Q 0.00';
        
        // Deshabilitar botones de acción
        generatePlanillaBtn.disabled = true;
        deleteSelectedBtn.disabled = true;
        
        return;
    }
    try {
        // Mostrar estado de carga
        const selectedOption = departamentoSelect.options[departamentoSelect.selectedIndex];
        const idDivision = selectedOption.dataset.idDivision;
        
        // Cargar el logo de la división
        if (idDivision) {
            logoDivisionActual = await obtenerLogoDivision(idDivision);
        } else {
            logoDivisionActual = null;
        }
        mostrarLoadingEnTabla('Verificando planilla existente...');
        
        // 1. Verificar si ya existe una planilla para esta fecha y departamento
        const planillaExistente = await verificarPlanillaExistente(idDepartamento, fecha);
        
        if (planillaExistente.existe) {
            // Mostrar mensaje de error y salir
            personalTableBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="8">
                        <div class="empty-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Ya existe una planilla para la fecha y departamento seleccionados.<br>ID: ${planillaExistente.idPlanilla}</p>
                        </div>
                    </td>
                </tr>
            `;
            
            // Mostrar alerta
            mostrarAlertaPlanillaExistente(planillaExistente);
            
            return;
        }
        
        mostrarLoadingEnTabla('Cargando personal...');
        
        // 2. Determinar el tipo de fecha (domingo, especial, regular)
        const infoTipoFecha = await determinarTipoFecha(fecha, idDepartamento);
        
        // Actualizar la UI con la información del tipo de fecha
        actualizarInfoTipoFecha(infoTipoFecha);
        
        // Si no es domingo ni día especial, mostrar advertencia y salir
        if (infoTipoFecha.tipo === 'regular') {
            mostrarNotificacion(
                'La fecha seleccionada no es domingo ni día especial. No aplica para planilla especial.', 
                'warning',
                'Fecha no aplicable'
            );
            
            // Mostrar mensaje en la tabla
            personalTableBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="8">
                        <div class="empty-message">
                            <i class="fas fa-calendar-times"></i>
                            <p>La fecha seleccionada no es domingo ni día especial.<br>No se puede generar planilla para esta fecha.</p>
                        </div>
                    </td>
                </tr>
            `;
            
            // Actualizar información de totales
            totalPersonalElement.querySelector('.status-value').textContent = '0';
            totalPagoElement.querySelector('.status-value').textContent = 'Q 0.00';
            
            // Deshabilitar botones de acción
            generatePlanillaBtn.disabled = true;
            deleteSelectedBtn.disabled = true;
            
            return;
        }
        
        // 3. Cargar la configuración de límites del departamento
        const limitesDepartamento = await cargarLimitesDepartamento(idDepartamento);
        
        // 4. Cargar el personal del departamento
        const personal = await cargarPersonalDepartamento(idDepartamento, idTipoPersonal);
        
        // 5. Restablecer la página actual a 1
        currentPage = 1;
        
        // 6. Renderizar la tabla con los datos obtenidos
        renderizarTablaPersonal(personal);
        
        // 7. Actualizar el estado de filtros aplicados
        filtersApplied = true;
        
        // 8. Inhabilitar controles de búsqueda para evitar cambios accidentales
        inhabilitarControlesBusqueda(true);
        
        // 9. Mostrar notificación de éxito
        const nombreDepartamento = departamentoSelect.options[departamentoSelect.selectedIndex].text;
        mostrarNotificacion(`Personal cargado para: ${nombreDepartamento}`, 'success');
        
    } catch (error) {
        console.error('Error al aplicar filtros:', error);
        mostrarNotificacion('Error al cargar los datos. Intente nuevamente.', 'error');
        
        // Mostrar mensaje de error en la tabla
        personalTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">
                    <div class="empty-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Ocurrió un error al cargar los datos. Intente nuevamente.</p>
                    </div>
                </td>
            </tr>
        `;
    }
}
// Función para mostrar estado de carga en la tabla
function mostrarLoadingEnTabla(mensaje = 'Cargando...') {
    personalTableBody.innerHTML = `
        <tr class="empty-row">
            <td colspan="8">
                <div class="loading-message">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>${mensaje}</p>
                </div>
            </td>
        </tr>
    `;
}

// Función para limpiar los filtros
function limpiarFiltros() {
    // Verificar si el usuario es administrador (para no tener que hacer otra consulta asíncrona)
    // Intentamos obtener de una variable global que podríamos establecer durante la carga inicial
    const esAdministradorActual = window.esUsuarioAdministrador || false;
    
    // Si el departamento está bloqueado y el usuario no es administrador, no lo reseteamos
    const departamentoEstaBloqueado = departamentoSelect.disabled && !esAdministradorActual;
    
    if (!departamentoEstaBloqueado) {
        departamentoSelect.selectedIndex = 0;
    }
    
    // Restablecer los demás filtros
    tipoPersonalSelect.selectedIndex = 0;
    fechaInput.value = '';
    
    // Limpiar datos y tabla
    personalData = [];
    
    // Mostrar mensaje en la tabla
    personalTableBody.innerHTML = `
        <tr class="empty-row">
            <td colspan="8">
                <div class="empty-message">
                    <i class="fas fa-search"></i>
                    <p>Seleccione los filtros y presione "Buscar" para mostrar el personal</p>
                </div>
            </td>
        </tr>
    `;
    
    // Restablecer información de estado
    tipoFechaElement.querySelector('.status-icon i').className = 'fas fa-question';
    tipoFechaElement.querySelector('.status-value').textContent = 'Por verificar';
    
    tipoPagoElement.querySelector('.status-icon i').className = 'fas fa-dollar-sign';
    tipoPagoElement.querySelector('.status-value').textContent = 'Por determinar';
    
    totalPersonalElement.querySelector('.status-value').textContent = '0';
    totalPagoElement.querySelector('.status-value').textContent = 'Q 0.00';
    
    // Deshabilitar botones de acción
    generatePlanillaBtn.disabled = true;
    deleteSelectedBtn.disabled = true;
    
    // Restablecer estado de filtros
    filtersApplied = false;
    
    // Habilitar los controles de búsqueda, excepto el departamento si está bloqueado
    inhabilitarControlesBusqueda(false, departamentoEstaBloqueado);
    
    // Mostrar notificación
    mostrarNotificacion('Filtros restablecidos', 'info');
}

// Función para seleccionar/deseleccionar todos los elementos
function seleccionarTodos(e) {
    const isChecked = e.target.checked;
    
    // Actualizar todos los checkboxes visibles
    const checkboxes = document.querySelectorAll('.personal-check');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    
    // Actualizar el estado en el array de datos
    personalData = personalData.map(persona => ({
        ...persona,
        selected: isChecked
    }));
    
    // Actualizar botones
    actualizarBotonesSeleccion();
    
    // Si hay colaboradores externos, actualizar sus contadores
    if (document.getElementById('countFijo')) {
        calcularConteoActualPorTipo();
    }
}

// Función para manejar la paginación
function cambiarPagina(nuevaPagina) {
    // Validar que la página sea válida
    if (nuevaPagina < 1 || nuevaPagina > totalPages) {
        return;
    }
    
    // Actualizar la página actual
    currentPage = nuevaPagina;
    
    // Renderizar la tabla con la nueva página
    renderizarTablaPersonal(personalData);
}

// Función para mostrar confirmación de planilla
function mostrarConfirmacionPlanilla() {
    // Verificar si hay personal seleccionado
    const personalSeleccionado = personalData.filter(p => p.selected);
    
    if (personalSeleccionado.length === 0) {
        mostrarNotificacion('Debe seleccionar al menos un colaborador', 'warning');
        return;
    }
    
    // Verificar límites de personal antes de mostrar confirmación
    (async function() {
        const idDepartamento = departamentoSelect.value;
        const limitesDepartamento = await cargarLimitesDepartamento(idDepartamento);
        const excesos = verificarLimitesPersonal(personalSeleccionado, limitesDepartamento);
        
        if (excesos.excedeLimites) {
            // Mostrar alerta de exceso de límites
            Swal.fire({
                icon: 'warning',
                title: 'Límite de Personal Excedido',
                html: `
                    <div class="alerta-limites">
                        <p>Se han excedido los límites de personal establecidos para este departamento:</p>
                        <ul class="lista-excesos">
                            ${excesos.mensajes.map(mensaje => `<li>${mensaje}</li>`).join('')}
                        </ul>
                        <p>Ajuste su selección antes de continuar.</p>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: 'var(--color-primary)'
            });
            return;
        }
        
        // Si no hay excesos, continuar con la confirmación normal
        
        // Calcular totales
        const totalColaboradores = personalSeleccionado.length;
        let totalMonto = 0;
        
        personalSeleccionado.forEach(persona => {
            if (pagoAplicable === 'dominical') {
                totalMonto += persona.PagosDominicales;
            } else if (pagoAplicable === 'especial') {
                totalMonto += persona.PagosDiasEspeciales;
            }
        });
        
        // Obtener información adicional para mostrar en el modal
        const nombreDepartamento = departamentoSelect.options[departamentoSelect.selectedIndex].text;
        const tipoPersonalTexto = tipoPersonalSelect.value ? 
                                tipoPersonalSelect.options[tipoPersonalSelect.selectedIndex].text : 
                                'Todos';
        const fechaSeleccionada = new Date(fechaInput.value + 'T12:00:00');
        document.getElementById('confirmFecha').textContent = fechaSeleccionada.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        // Actualizar información en el modal
        document.getElementById('confirmDepartamento').textContent = nombreDepartamento;
        document.getElementById('confirmTipoPersonal').textContent = tipoPersonalTexto;
        document.getElementById('confirmFecha').textContent = fechaSeleccionada;
        document.getElementById('confirmTipoPago').textContent = pagoAplicable === 'dominical' ? 'Pago Dominical' : 'Pago Día Especial';
        document.getElementById('confirmTotalPersonal').textContent = totalColaboradores;
        document.getElementById('confirmTotalPago').textContent = `Q ${totalMonto.toFixed(2)}`;
        
        // Mostrar el modal
        mostrarModal(confirmModal);
    })();
}

// Función para cargar logo
function cargarLogo() {
    // Intentamos cargar el logo para tenerlo disponible para PDFs
    try {
        const logoImg = document.createElement('img');
        logoImg.src = '../Imagenes/Logo Recursos Humanos new.png';
        logoImg.id = 'logoImage';
        logoImg.style.display = 'none';
        document.body.appendChild(logoImg);
    } catch (error) {
        console.warn('No se pudo precargar el logo:', error);
    }
}

// Función para mostrar y ocultar modales
function mostrarModal(modal) {
    modal.classList.add('show');
}

function ocultarModal(modal) {
    modal.classList.remove('show');
}

// Función generarPlanilla con logging mejorado y consulta simplificada
async function generarPlanilla() {
    // Obtener personal seleccionado
    const personalSeleccionado = personalData.filter(p => p.selected);
    
    if (personalSeleccionado.length === 0) {
        mostrarNotificacion('Debe seleccionar al menos un colaborador', 'warning');
        return;
    }
    
    try {
        // Mostrar modal de proceso
        mostrarModal(processModal);
        document.getElementById('processModalTitle').innerHTML = '<i class="fas fa-cog fa-spin"></i> Generando Planilla';
        document.getElementById('processMessage').textContent = 'Iniciando proceso...';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = '0%';
        
        // Iniciar progreso
        updateProgress(10, 'Verificando datos...');
        
        const idDepartamento = departamentoSelect.value;
        const nombreDepartamento = departamentoSelect.options[departamentoSelect.selectedIndex].text;
        const fecha = fechaInput.value;
        
        // Verificar si es día especial o dominical
        if (!esDiaEspecial && !esDomingo) {
            throw new Error('La fecha seleccionada no es válida para generar planilla especial');
        }
        
        // Verificar nuevamente si ya existe una planilla para esta fecha y departamento
        const planillaExistente = await verificarPlanillaExistente(idDepartamento, fecha);
        
        if (planillaExistente.existe) {
            throw new Error('Ya existe una planilla para la fecha y departamento seleccionados');
        }
        
        // Verificar límites de personal
        const limitesDepartamento = await cargarLimitesDepartamento(idDepartamento);
        const excesos = verificarLimitesPersonal(personalSeleccionado, limitesDepartamento);
        
        if (excesos.excedeLimites) {
            throw new Error('Se han excedido los límites de personal establecidos para este departamento');
        }
        
        // Preparar datos para la planilla
        updateProgress(30, 'Preparando datos...');
        
        const tipoPlanilla = esDiaEspecial ? 'especial' : 'dominical';
        const descripcionLaboral = esDiaEspecial ? 
                                  document.getElementById('tipoFecha').querySelector('.status-value').textContent : 
                                  'Pago Dominical';
        const montoTotal = personalSeleccionado.reduce((total, persona) => {
            return total + (tipoPlanilla === 'dominical' ? persona.PagosDominicales : persona.PagosDiasEspeciales);
        }, 0);
        
        // Preparar datos para la base de datos
        updateProgress(50, 'Guardando planilla...');
        
        // Obtener datos del usuario actual desde localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        const idUsuario = userData?.IdPersonal || 0;
        const nombreUsuario = userData?.NombreCompleto || 'Usuario Sistema';
        
        // Verificar si hay colaboradores externos
        const hayExternos = personalSeleccionado.some(p => p.esExterno);
        const contieneExternos = hayExternos ? "S" : "N"; // "S" o "N" para el campo varchar(1)
        
        // Obtener conexión a la base de datos
        let connection;
        try {
            connection = await getConnection();
            console.log('Conexión a la base de datos establecida correctamente');
        } catch (connectionError) {
            console.error('Error al establecer conexión a la base de datos:', connectionError);
            throw new Error('No se pudo establecer conexión a la base de datos');
        }
        
        // Intentar la inserción de la planilla paso a paso
        let idPlanilla;
        try {
            // 1. Probemos primero con una consulta simplificada con menos campos
            const insertPlanillaQuery = `
                INSERT INTO PlanillasEspeciales (
                    IdUsuario, 
                    NombreUsuario,
                    IdDepartamento, 
                    NombreDepartamento,
                    CantColaboradores,
                    MontoTotalGasto,
                    FechaLaboral, 
                    DescripcionLaboral,
                    ContieneExternos
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const queryParams = [
                idUsuario, 
                nombreUsuario,
                idDepartamento, 
                nombreDepartamento,
                personalSeleccionado.length, 
                montoTotal,
                fecha, // Usar fecha directamente sin formatear
                descripcionLaboral,
                contieneExternos
            ];
            
            // Ejecutar la inserción
            const resultInsert = await connection.query(insertPlanillaQuery, queryParams);
            // 2. Obtener el ID insertado con LAST_INSERT_ID()
            console.log('Intentando obtener ID con LAST_INSERT_ID()');
            const lastIdQuery = `SELECT LAST_INSERT_ID() as ultimoId`;
            const idResult = await connection.query(lastIdQuery);
            console.log('Resultado de LAST_INSERT_ID():', idResult);
            
            if (idResult && idResult.length > 0 && idResult[0].ultimoId) {
                idPlanilla = idResult[0].ultimoId;
                console.log('ID obtenido con LAST_INSERT_ID():', idPlanilla);
            } else {
                // 3. Método alternativo - buscar por departamento y fecha
                console.log('LAST_INSERT_ID() no devolvió resultado, usando método alternativo');
                const busquedaQuery = `
                    SELECT IdPlanillaEspecial 
                    FROM PlanillasEspeciales 
                    WHERE IdDepartamento = ? 
                    AND FechaLaboral = ?
                    ORDER BY IdPlanillaEspecial DESC
                    LIMIT 1
                `;
                
                const busquedaResult = await connection.query(busquedaQuery, [idDepartamento, fecha]);
                console.log('Resultado de búsqueda por departamento y fecha:', busquedaResult);
                
                if (busquedaResult && busquedaResult.length > 0) {
                    idPlanilla = busquedaResult[0].IdPlanillaEspecial;
                    console.log('ID obtenido con método alternativo:', idPlanilla);
                } else {
                    throw new Error('No se pudo obtener el ID de la planilla insertada');
                }
            }
            
        } catch (insertError) {
            console.error('Error específico al insertar planilla:', insertError);
            throw new Error(`Error al insertar planilla: ${insertError.message}`);
        }
        
        // Si llegamos aquí, tenemos un ID de planilla válido
        if (!idPlanilla) {
            throw new Error('No se pudo obtener un ID válido para la planilla');
        }
        
        updateProgress(70, 'Registrando detalles de personal...');
        
        // 4. Insertar detalles de personal uno por uno con manejo de errores individual
        for (let i = 0; i < personalSeleccionado.length; i++) {
            try {
                const persona = personalSeleccionado[i];
                const monto = tipoPlanilla === 'dominical' ? persona.PagosDominicales : persona.PagosDiasEspeciales;
                
                // Determinar si es un colaborador externo y su departamento origen
                const esExterno = persona.esExterno ? 1 : 0; // 1 o 0 para el campo int
                const departamentoOrigen = persona.departamentoOrigen || null;
                
                // Query para insertar el detalle
                const insertDetalleQuery = `
                    INSERT INTO DetallePlanillaEspecial (
                        IdPlanillaEspecial,
                        IdPersonal, 
                        NombreColaborador,
                        Monto,
                        IdPuesto,
                        NombrePuesto,
                        EsColaboradorExterno,
                        DepartamentoOrigen
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                const detalleParams = [
                    idPlanilla, 
                    persona.IdPersonal, 
                    persona.NombreCompleto,
                    monto,
                    persona.IdPuesto || 0,
                    persona.NombrePuesto,
                    esExterno,
                    departamentoOrigen
                ];
                
                console.log(`Insertando detalle para colaborador ${i+1}/${personalSeleccionado.length}:`, {
                    idPersonal: persona.IdPersonal,
                    nombre: persona.NombreCompleto
                });
                
                await connection.query(insertDetalleQuery, detalleParams);
                
                // Actualizar progreso
                const progreso = 70 + Math.floor((i + 1) / personalSeleccionado.length * 20);
                updateProgress(progreso, `Registrando personal (${i + 1} de ${personalSeleccionado.length})...`);
                
            } catch (detalleError) {
                console.error(`Error al insertar detalle para colaborador ${i+1}:`, detalleError);
                // Continuamos con el siguiente colaborador en lugar de abortar
            }
        }
        
        // Cerrar conexión
        try {
            await connection.close();
            console.log('Conexión a la base de datos cerrada correctamente');
        } catch (closeError) {
            console.error('Error al cerrar conexión:', closeError);
        }
        
        // Finalizar el proceso de guardado
        updateProgress(92, 'Planilla guardada con éxito. Generando documento oficial...');
        
        // Generar PDF oficial con el ID de la planilla
        await generarPDFOficial(idPlanilla);
        
        // Resetear la ventana después de completar todo el proceso
        resetearVentana();
        
    } catch (error) {
        console.error('Error al generar planilla:', error);
        
        // Actualizar modal de proceso
        updateProgress(100, `Error al generar planilla: ${error.message}`);
        
        // Esperar un momento antes de cerrar el modal de proceso
        setTimeout(() => {
            ocultarModal(processModal);
            
            // Mostrar mensaje de error
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Ocurrió un error al generar la planilla',
                confirmButtonColor: 'var(--color-primary)'
            });
        }, 1000);
    }
}
async function generarPDFOficial(idPlanilla) {
    try {
        // Mostrar modal de proceso
        mostrarModal(processModal);
        document.getElementById('processModalTitle').innerHTML = '<i class="fas fa-file-pdf"></i> Generando PDF Oficial';
        document.getElementById('processMessage').textContent = 'Preparando documento...';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = '0%';
        
        updateProgress(20, 'Configurando documento PDF...');
        
        // Obtener información para el PDF
        const idDepartamento = departamentoSelect.value;
        const nombreDepartamento = departamentoSelect.options[departamentoSelect.selectedIndex].text;
        
        // Corregir el problema de la fecha y añadir el día de la semana
        const fechaSeleccionada = fechaInput.value; // "YYYY-MM-DD"
        const [anio, mes, dia] = fechaSeleccionada.split('-').map(num => parseInt(num, 10));
        
        // Para obtener el día de la semana, necesitamos crear un objeto Date
        // pero asegurándonos de usar UTC para evitar problemas de zona horaria
        const fechaObj = new Date(`${fechaSeleccionada}T12:00:00`);
        
        // Array con los nombres de los días de la semana en español
        const diasSemana = [
            'domingo', 'lunes', 'martes', 'miércoles', 
            'jueves', 'viernes', 'sábado'
        ];
        
        // Array con los nombres de los meses en español
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        
        // Obtener el día de la semana (0-6, donde 0 es domingo)
        const diaSemana = fechaObj.getDay();
        
        // Crear la fecha formateada con el día de la semana
        const fechaFormateada = `${diasSemana[diaSemana]}, ${dia} de ${meses[mes-1]} de ${anio}`;
        
        // Determinar el título del documento según el tipo de día especial
        let tituloPDF = "PLANILLA ESPECIAL - OFICIAL"; // Título por defecto
        
        // Verificar si es domingo o día especial y ajustar el título
        if (esDomingo) {
            tituloPDF = "PLANILLA DOMINICAL";
            console.log("Estableciendo título: PLANILLA DOMINICAL");
        } else if (esDiaEspecial) {
            // Obtener la información del día especial nuevamente para confirmar si es global o específico
            const resultadoDiaEspecial = await verificarDiaEspecial(fechaSeleccionada, idDepartamento);
            
            console.log('Resultado día especial para título:', JSON.stringify(resultadoDiaEspecial, null, 2));
            
            // Verificación explícita y detallada para depuración
            if (resultadoDiaEspecial.esGlobal === true) {
                tituloPDF = "PLANILLA POR ASUETO";
                console.log("Es un día global (IdDepartamento=0). Estableciendo título: PLANILLA POR ASUETO");
            } else {
                tituloPDF = "PLANILLA POR FERIADO";
                console.log("Es un día específico para este departamento. Estableciendo título: PLANILLA POR FERIADO");
            }
        }
        
        console.log("Título final del PDF:", tituloPDF);
        
        // Determinar tipo de pago
        const tipoPago = pagoAplicable === 'dominical' ? 'Pago Dominical' : 'Pago Día Especial';
        const descripcionDia = document.getElementById('tipoFecha').querySelector('.status-value').textContent;
        
        // Obtener personal seleccionado
        const personalSeleccionado = personalData.filter(p => p.selected);
        
        // Calcular montos totales
        const totalColaboradores = personalSeleccionado.length;
        let totalMonto = 0;
        
        personalSeleccionado.forEach(persona => {
            if (pagoAplicable === 'dominical') {
                totalMonto += persona.PagosDominicales;
            } else if (pagoAplicable === 'especial') {
                totalMonto += persona.PagosDiasEspeciales;
            }
        });

        updateProgress(40, 'Organizando datos...');
        
        // Agrupar personal por tipo de personal y ordenar alfabéticamente
        const personalPorTipo = {};
        
        personalSeleccionado.forEach(persona => {
            const tipoPersonal = persona.NombreTipoPersonal;
            
            if (!personalPorTipo[tipoPersonal]) {
                personalPorTipo[tipoPersonal] = [];
            }
            
            personalPorTipo[tipoPersonal].push(persona);
        });
        
        // Ordenar cada grupo alfabéticamente
        Object.keys(personalPorTipo).forEach(tipo => {
            personalPorTipo[tipo].sort((a, b) => a.NombreCompleto.localeCompare(b.NombreCompleto));
        });
        
        updateProgress(60, 'Creando documento PDF...');
        
        // Crear documento PDF usando jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Mejorar presentación general del PDF
        doc.setProperties({
            title: tituloPDF,
            subject: 'Planilla Especial',
            author: 'Sistema de Recursos Humanos',
            keywords: 'planilla, especial, oficial',
            creator: 'Sistema RH'
        });
        
        // Definir márgenes para mejor uso del espacio
        const margenIzquierdo = 15;
        const margenDerecho = 15;
        const anchoUtil = 210 - margenIzquierdo - margenDerecho; // 210mm es el ancho de una página A4
        
        // Definir posiciones de las columnas de la tabla con mejor distribución
        const colNum = margenIzquierdo + 7; // Centrar la numeración
        const colNombre = margenIzquierdo + 17; // Reducir espacio para inicio de la columna nombre
        const colPuesto = margenIzquierdo + anchoUtil * 0.35; // Reducir columna de nombre (35% en lugar de 40%)
        const colMonto = margenIzquierdo + anchoUtil * 0.60; // Ajustar monto (60% en lugar de 65%)
        const colFirma = margenIzquierdo + anchoUtil * 0.75; // Iniciar firma antes (75% en lugar de 80%)
        
        // Configurar encabezado con más espacio - ahora con número de planilla
        doc.setFontSize(18); 
        doc.setFont('helvetica', 'bold');
        doc.text(tituloPDF, 105, 25, { align: 'center' });
        
        // Dibujar una caja de énfasis para el número de planilla
        doc.setFillColor(230, 230, 250); // Color lavanda claro
        doc.rect(65, 30, 80, 10, 'F');
        doc.setFontSize(12);
        doc.text(`Número de Planilla: ${idPlanilla}`, 105, 37, { align: 'center' });
        
        // Agregar logo con mejor tamaño
        try {
            let logoSrc = null;
            
            if (logoDivisionActual) {
                // Si tenemos un logo de la división, usamos ese
                logoSrc = logoDivisionActual;
                console.log('Usando logo de la división en el PDF');
            } else {
                // Si no, intentamos usar el logo predeterminado
                const logoImg = document.getElementById('logoImage') || document.querySelector('.sidebar-logo');
                if (logoImg) {
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = logoImg.width;
                    canvas.height = logoImg.height;
                    context.drawImage(logoImg, 0, 0, logoImg.width, logoImg.height);
                    logoSrc = canvas.toDataURL('image/png');
                    console.log('Usando logo predeterminado en el PDF');
                }
            }
            
            // Si tenemos algún logo (de división o predeterminado), lo agregamos al PDF
            if (logoSrc) {
                // Crear una imagen temporal para obtener las dimensiones reales
                const tempImg = new Image();
                tempImg.src = logoSrc;
                
                // Esperar a que la imagen cargue
                await new Promise((resolve) => {
                    tempImg.onload = resolve;
                });
                
                // Calcular proporciones para mantener el aspect ratio
                const imgWidth = 30; // Ancho fijo deseado
                const imgHeight = (tempImg.height / tempImg.width) * imgWidth; // Altura proporcional
                
                // Agregar la imagen con las dimensiones corregidas
                doc.addImage(logoSrc, 'PNG', 25, 10, imgWidth, imgHeight);
                console.log('Logo agregado al PDF con proporción correcta', { width: imgWidth, height: imgHeight });
            } else {
                console.warn('No se pudo obtener ningún logo para el PDF');
            }
        } catch (e) {
            console.error('Error al agregar logo al PDF:', e);
        }
        
        // Información del departamento y fecha con mejor espaciado
        doc.setFontSize(14); // Encabezado de sección más grande
        doc.setFont('helvetica', 'bold');
        doc.text('Información de la Planilla:', margenIzquierdo, 50);
        
        doc.setFontSize(12); // Texto de información más grande
        doc.setFont('helvetica', 'normal');
        doc.text(`Departamento/Sucursal: ${nombreDepartamento}`, margenIzquierdo + 5, 60);
        doc.text(`Fecha: ${fechaFormateada}`, margenIzquierdo + 5, 67);
        doc.text(`Tipo de Pago: ${tipoPago}`, margenIzquierdo + 5, 74);
        if (descripcionDia && descripcionDia !== 'Domingo') {
            doc.text(`Descripción: ${descripcionDia}`, margenIzquierdo + 5, 81);
        }
        
        // Línea separadora más gruesa y con color más visible
        doc.setDrawColor(0, 123, 255); // Color azul para la línea
        doc.setLineWidth(0.7);
        doc.line(margenIzquierdo, 85, 210 - margenDerecho, 85);
        
        // Agregar tabla de personal por tipo con más espacio entre filas
        let yPosition = 100;
        let paginaActual = 1;

        updateProgress(80, 'Añadiendo detalles de personal...');
        
        // Función para agregar encabezado a cada página
        const agregarEncabezado = () => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text(`${tituloPDF} #${idPlanilla} - Página ${paginaActual}`, 210 - margenDerecho, 10, { align: 'right' });
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
        };
        
        agregarEncabezado();
        
        // Obtener una lista completa de todos los colaboradores seleccionados y ordenarlos alfabéticamente
        let todosLosColaboradores = [];
        Object.values(personalPorTipo).forEach(personal => {
            todosLosColaboradores = todosLosColaboradores.concat(personal);
        });

        // Ordenar todos los colaboradores alfabéticamente por nombre
        todosLosColaboradores.sort((a, b) => a.NombreCompleto.localeCompare(b.NombreCompleto));

        // Encabezados de la tabla con mejor estilo
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(220, 230, 240); // Color azul muy claro
        doc.rect(margenIzquierdo, yPosition - 6, anchoUtil, 10, 'F');

        // Dibujar bordes de tabla
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.3);

        // Línea horizontal superior
        doc.line(margenIzquierdo, yPosition - 6, margenIzquierdo + anchoUtil, yPosition - 6);

        // Líneas verticales para separar columnas
        doc.line(colNombre - 5, yPosition - 6, colNombre - 5, yPosition + 4);
        doc.line(colPuesto - 5, yPosition - 6, colPuesto - 5, yPosition + 4);
        doc.line(colMonto - 5, yPosition - 6, colMonto - 5, yPosition + 4);
        doc.line(colFirma - 5, yPosition - 6, colFirma - 5, yPosition + 4);

        // Línea horizontal inferior
        doc.line(margenIzquierdo, yPosition + 4, margenIzquierdo + anchoUtil, yPosition + 4);

        // Textos de encabezado
        doc.text('No.', colNum, yPosition, { align: 'center' });
        doc.text('Colaboradores', colNombre, yPosition);
        doc.text('Puesto', colPuesto, yPosition);
        doc.text('Monto', colMonto, yPosition);
        doc.text('Firma', colFirma, yPosition);

        yPosition += 10; // Más espacio después del encabezado

        // Datos de los colaboradores
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        todosLosColaboradores.forEach((persona, index) => {
            const montoAplicable = pagoAplicable === 'dominical' ? 
                                  persona.PagosDominicales : 
                                  persona.PagosDiasEspeciales;
            
            // Verificar si necesitamos una nueva página
            // Ahora necesitamos más espacio para cada fila (15px en lugar de 10px)
            if (yPosition > 270) {
                doc.addPage();
                paginaActual++;
                yPosition = 30;
                agregarEncabezado();
                
                // Repetir encabezados de la tabla en la nueva página
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(220, 230, 240);
                doc.rect(margenIzquierdo, yPosition - 6, anchoUtil, 10, 'F');
                
                // Dibujar bordes de tabla
                doc.setDrawColor(150, 150, 150);
                doc.setLineWidth(0.3);
                doc.line(margenIzquierdo, yPosition - 6, margenIzquierdo + anchoUtil, yPosition - 6);
                doc.line(colNombre - 5, yPosition - 6, colNombre - 5, yPosition + 4);
                doc.line(colPuesto - 5, yPosition - 6, colPuesto - 5, yPosition + 4);
                doc.line(colMonto - 5, yPosition - 6, colMonto - 5, yPosition + 4);
                doc.line(colFirma - 5, yPosition - 6, colFirma - 5, yPosition + 4);
                doc.line(margenIzquierdo, yPosition + 4, margenIzquierdo + anchoUtil, yPosition + 4);
                
                doc.text('No.', colNum, yPosition);
                doc.text('Nombre del Colaborador', colNombre, yPosition);
                doc.text('Puesto', colPuesto, yPosition);
                doc.text('Monto', colMonto, yPosition);
                doc.text('Firma', colFirma, yPosition);
                
                yPosition += 10;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
            }
            
            // Alternar colores de fondo para las filas
            if (index % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                // Aumentamos la altura del rectángulo para acomodar dos líneas de texto
                doc.rect(margenIzquierdo, yPosition - 6, anchoUtil, 15, 'F');
            }
            
            // Dibujar bordes de la celda - adaptados para mayor altura
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            
            // Líneas horizontales
            doc.line(margenIzquierdo, yPosition - 6, margenIzquierdo + anchoUtil, yPosition - 6);
            doc.line(margenIzquierdo, yPosition + 9, margenIzquierdo + anchoUtil, yPosition + 9); // +9 en lugar de +4
            
            // Líneas verticales
            doc.line(margenIzquierdo, yPosition - 6, margenIzquierdo, yPosition + 9);
            doc.line(colNombre - 5, yPosition - 6, colNombre - 5, yPosition + 9);
            doc.line(colPuesto - 5, yPosition - 6, colPuesto - 5, yPosition + 9);
            doc.line(colMonto - 5, yPosition - 6, colMonto - 5, yPosition + 9);
            doc.line(colFirma - 5, yPosition - 6, colFirma - 5, yPosition + 9);
            doc.line(margenIzquierdo + anchoUtil, yPosition - 6, margenIzquierdo + anchoUtil, yPosition + 9);
            
            // Agregar el número secuencial (índice + 1)
            doc.setFont('helvetica', 'bold');
            doc.text((index + 1).toString(), colNum, yPosition + 1, { align: 'center' });
            
            // Dividir el nombre completo en apellidos y nombres
            // Asumiendo formato: "Apellido1 Apellido2, Nombre1 Nombre2"
            let apellidos = '';
            let nombres = '';
            
            if (persona.NombreCompleto.includes(',')) {
                // Si ya está en formato "Apellidos, Nombres"
                const partes = persona.NombreCompleto.split(',');
                apellidos = partes[0].trim();
                nombres = partes.length > 1 ? partes[1].trim() : '';
            } else {
                // Si está en otro formato, intentar dividirlo
                const nombreCompleto = persona.NombreCompleto;
                const palabras = nombreCompleto.split(' ');
                
                if (palabras.length >= 3) {
                    // Asumimos que los dos primeros son apellidos
                    apellidos = palabras.slice(0, 2).join(' ');
                    nombres = palabras.slice(2).join(' ');
                } else if (palabras.length === 2) {
                    // Un apellido y un nombre
                    apellidos = palabras[0];
                    nombres = palabras[1];
                } else {
                    // Solo hay una palabra, la usamos como apellido
                    apellidos = nombreCompleto;
                    nombres = '';
                }
            }
            
            // Acortar si son muy largos
            if (apellidos.length > 35) {
                apellidos = apellidos.substring(0, 32) + '...';
            }
            
            if (nombres.length > 35) {
                nombres = nombres.substring(0, 32) + '...';
            }
            
            // Escribir apellidos en la primera línea
            doc.setFont('helvetica', 'bold');
            doc.text(apellidos, colNombre, yPosition - 1);
            
            // Escribir nombres en la segunda línea
            doc.setFont('helvetica', 'normal');
            doc.text(nombres, colNombre, yPosition + 4);
            
            // Cortar puesto si es muy largo
            let puestoMostrar = persona.NombrePuesto;
            if (puestoMostrar.length > 25) {
                puestoMostrar = puestoMostrar.substring(0, 22) + '...';
            }
            doc.text(puestoMostrar, colPuesto, yPosition + 1); // Centrado verticalmente
            
            // Alinear monto a la derecha
            doc.text(`Q ${montoAplicable.toFixed(2)}`, colMonto + 15, yPosition + 1, { align: 'right' });

            // Aumentamos el incremento de posición Y para cada fila (15px en lugar de 10px)
            yPosition += 15;
        });

        // No mostramos subtotales por tipo, solo el total general
        yPosition += 5;

        // Línea separadora
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.line(margenIzquierdo, yPosition, margenIzquierdo + anchoUtil, yPosition);

        // Mostrar total general
        yPosition += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`Total de Colaboradores: ${totalColaboradores}`, margenIzquierdo + 5, yPosition);
        doc.text(`Total a Pagar: Q ${totalMonto.toFixed(2)}`, colMonto - 25, yPosition);
        
        // Agregar pie de página con información del usuario que genera y sellos oficiales
        const userData = JSON.parse(localStorage.getItem('userData'));
        const nombreUsuario = userData?.NombreCompleto || 'Usuario Sistema';
        
        // Verificar si estamos en la última página, si no, agregar página
        if (yPosition > 230) {
            doc.addPage();
            paginaActual++;
            yPosition = 20;
            agregarEncabezado();
        }
        
        // Espacio para firmas de autorización - AUMENTADO
        yPosition += 20;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        // Firmas de autorización - Aumentamos altura y ancho del espacio para firma
        const anchoFirma = anchoUtil / 3;
        
        // Primera firma (Generado por)
        doc.setDrawColor(100, 100, 100);
        // Línea de firma más ancha (10 unidades más a cada lado)
        doc.line(margenIzquierdo + 5, yPosition + 35, margenIzquierdo + anchoFirma - 5, yPosition + 35);
        doc.text('Generado por:', margenIzquierdo + anchoFirma/2, yPosition + 5, {align: 'center'});
        doc.text(nombreUsuario, margenIzquierdo + anchoFirma/2, yPosition + 45, {align: 'center'});
        
        // Segunda firma (Revisado por)
        // Línea de firma más ancha
        doc.line(margenIzquierdo + anchoFirma + 5, yPosition + 35, margenIzquierdo + anchoFirma*2 - 5, yPosition + 35);
        doc.text('Entregado por:', margenIzquierdo + anchoFirma*1.5, yPosition + 5, {align: 'center'});
        
        // Tercera firma (Autorizado por)
        // Línea de firma más ancha
        doc.line(margenIzquierdo + anchoFirma*2 + 5, yPosition + 35, margenIzquierdo + anchoFirma*3 - 5, yPosition + 35);
        doc.text('Autorizado por:', margenIzquierdo + anchoFirma*2.5, yPosition + 5, {align: 'center'});
        
        // Línea separadora para el pie
        yPosition += 60; // Aumentamos este valor para dar más espacio después de las firmas
        doc.setDrawColor(0, 123, 255);
        doc.setLineWidth(0.7);
        doc.line(margenIzquierdo, yPosition, 210 - margenDerecho, yPosition);
        
        // Información de generación
        yPosition += 10;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(`Documento oficial generado por el Sistema de Recursos Humanos`, margenIzquierdo, yPosition);
        doc.text(`Fecha de generación: ${new Date().toLocaleString()}`, margenIzquierdo, yPosition + 5);
        doc.text(`${tituloPDF} No. ${idPlanilla}`, 210 - margenDerecho, yPosition, {align: 'right'});
        
        updateProgress(100, '¡Documento oficial generado con éxito!');
        
        // Esperar un momento antes de cerrar el modal de proceso y mostrar el PDF
        setTimeout(() => {
            ocultarModal(processModal);
            
            // Abrir PDF en nueva ventana e imprimir automáticamente
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const newWindow = window.open(pdfUrl, '_blank');
            
            // Intentar imprimir automáticamente
            if (newWindow) {
                newWindow.addEventListener('load', function() {
                    newWindow.print();
                });
            }
            
            // Mostrar notificación de éxito
            mostrarNotificacion('Planilla generada con éxito. Se ha creado un documento oficial.', 'success');
            
        }, 1000);
        
        return true;
        
    } catch (error) {
        console.error('Error al generar PDF oficial:', error);
        
        // Actualizar modal de proceso
        updateProgress(100, 'Error al generar documento oficial');
        
        // Mostrar mensaje de error
        setTimeout(() => {
            ocultarModal(processModal);
            
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: `No se pudo generar el documento oficial: ${error.message}`,
                confirmButtonColor: 'var(--color-primary)'
            });
        }, 1000);
        
        return false;
    }
}
// Función para actualizar el progreso en el modal de proceso
function updateProgress(percentage, message) {
    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${percentage}%`;
    document.getElementById('processMessage').textContent = message;
}

// Función para eliminar personal seleccionado de la tabla (solo visual)
function eliminarPersonalSeleccionado() {
    const personalSeleccionado = personalData.filter(p => p.selected);
    
    if (personalSeleccionado.length === 0) {
        mostrarNotificacion('No hay personal seleccionado para eliminar', 'warning');
        return;
    }
    
    Swal.fire({
        icon: 'warning',
        title: 'Confirmar eliminación',
        text: `¿Está seguro de eliminar ${personalSeleccionado.length} colaborador(es) de la lista?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--color-danger)',
        cancelButtonColor: 'var(--color-gray)'
    }).then((result) => {
        if (result.isConfirmed) {
            // Eliminar de la lista (solo visual, no de la base de datos)
            const idsEliminar = personalSeleccionado.map(p => p.IdPersonal);
            personalData = personalData.filter(p => !idsEliminar.includes(p.IdPersonal));
            
            // Verificar si quedaron datos
            if (personalData.length > 0) {
                // Verificar si la página actual sigue siendo válida
                totalPages = Math.ceil(personalData.length / itemsPerPage);
                if (currentPage > totalPages) {
                    currentPage = totalPages;
                }
                
                // Renderizar tabla actualizada
                renderizarTablaPersonal(personalData);
            } else {
                // No quedan datos, mostrar mensaje vacío
                personalTableBody.innerHTML = `
                    <tr class="empty-row">
                        <td colspan="8">
                            <div class="empty-message">
                                <i class="fas fa-user-slash"></i>
                                <p>No se encontraron colaboradores para los filtros seleccionados</p>
                            </div>
                        </td>
                    </tr>
                `;
                
                // Actualizar información de totales
                totalPersonalElement.querySelector('.status-value').textContent = '0';
                totalPagoElement.querySelector('.status-value').textContent = 'Q 0.00';
            }
            
            // Si hay colaboradores externos, actualizar sus contadores
            if (document.getElementById('countFijo')) {
                calcularConteoActualPorTipo();
            }
            
            // Mostrar notificación
            mostrarNotificacion(`Se eliminaron ${personalSeleccionado.length} colaborador(es) de la lista`, 'success');
        }
    });
}

function inhabilitarControlesBusqueda(inhabilitar = true, respetarDepartamento = false) {
    // Inhabilitar/habilitar los controles de filtro, respetando el departamento si es necesario
    if (!respetarDepartamento) {
        departamentoSelect.disabled = inhabilitar;
        departamentoSelect.classList.toggle('control-disabled', inhabilitar);
    }
    
    tipoPersonalSelect.disabled = inhabilitar;
    fechaInput.disabled = inhabilitar;
    
    // Cambiar apariencia visual para indicar estado inhabilitado
    tipoPersonalSelect.classList.toggle('control-disabled', inhabilitar);
    fechaInput.classList.toggle('control-disabled', inhabilitar);
    
    // Cambiar el estado del botón de búsqueda y limpiar
    applyFiltersBtn.disabled = inhabilitar;
    clearFiltersBtn.disabled = false; // El botón limpiar siempre debe estar habilitado
}

// Función para cargar la configuración de límites del departamento seleccionado
async function cargarLimitesDepartamento(idDepartamento) {
    try {
        const connection = await getConnection();
        
        const query = `
            SELECT 
                PlanFijo, 
                PlanParcial, 
                PlanVacacionista 
            FROM 
                departamentos 
            WHERE 
                IdDepartamento = ?
        `;
        
        const result = await connection.query(query, [idDepartamento]);
        await connection.close();
        
        if (result && result.length > 0) {
            return {
                planFijo: result[0].PlanFijo || 0,
                planParcial: result[0].PlanParcial || 0,
                planVacacionista: result[0].PlanVacacionista || 0
            };
        } else {
            console.warn(`No se encontraron límites para el departamento ID: ${idDepartamento}`);
            return {
                planFijo: 0,
                planParcial: 0,
                planVacacionista: 0
            };
        }
    } catch (error) {
        console.error(`Error al cargar límites del departamento:`, error);
        mostrarNotificacion('Error al verificar límites de personal', 'error');
        return {
            planFijo: 0,
            planParcial: 0,
            planVacacionista: 0
        };
    }
}

// Función para verificar si la selección actual excede los límites del departamento
function verificarLimitesPersonal(personalSeleccionado, limitesDepartamento) {
    // Contar personal seleccionado por tipo
    const conteoTipos = {
        fijo: 0,
        parcial: 0,
        vacacionista: 0
    };
    
    // Mapeo de tipos de personal (ajustar según tus datos reales)
    const tipoMap = {
        '1': 'fijo',       // Asumiendo que tipo 1 = fijo
        '2': 'parcial',    // Asumiendo que tipo 2 = parcial
        '3': 'vacacionista' // Asumiendo que tipo 3 = vacacionista
    };
    
    // Contar personal por tipo
    personalSeleccionado.forEach(persona => {
        const tipoId = persona.IdTipoPersonal.toString();
        const tipoKey = tipoMap[tipoId] || 'otro';
        
        if (tipoKey in conteoTipos) {
            conteoTipos[tipoKey]++;
        }
    });
    
    // Verificar excesos
    const excesos = {
        excedeLimites: false,
        mensajes: []
    };
    
    if (limitesDepartamento.planFijo > 0 && conteoTipos.fijo > limitesDepartamento.planFijo) {
        excesos.excedeLimites = true;
        excesos.mensajes.push(`Personal Fijo: ${conteoTipos.fijo} seleccionados (límite: ${limitesDepartamento.planFijo})`);
    }
    
    if (limitesDepartamento.planParcial > 0 && conteoTipos.parcial > limitesDepartamento.planParcial) {
        excesos.excedeLimites = true;
        excesos.mensajes.push(`Personal Parcial: ${conteoTipos.parcial} seleccionados (límite: ${limitesDepartamento.planParcial})`);
    }
    
    if (limitesDepartamento.planVacacionista > 0 && conteoTipos.vacacionista > limitesDepartamento.planVacacionista) {
        excesos.excedeLimites = true;
        excesos.mensajes.push(`Personal Vacacionista: ${conteoTipos.vacacionista} seleccionados (límite: ${limitesDepartamento.planVacacionista})`);
    }
    
    return excesos;
}

// Función para verificar si ya existe una planilla para la fecha y departamento seleccionados
async function verificarPlanillaExistente(idDepartamento, fecha) {
    try {
        const connection = await getConnection();
        
        const query = `
            SELECT 
                IdPlanillaEspecial,
                FechaLaboral,
                DescripcionLaboral
            FROM 
                PlanillasEspeciales 
            WHERE 
                IdDepartamento = ? 
                AND FechaLaboral = ?
            LIMIT 1
        `;
        
        const result = await connection.query(query, [idDepartamento, fecha]);
        await connection.close();
        
        if (result && result.length > 0) {
            return {
                existe: true,
                idPlanilla: result[0].IdPlanillaEspecial,
                fechaLaboral: result[0].FechaLaboral,
                descripcion: result[0].DescripcionLaboral
            };
        } else {
            return {
                existe: false
            };
        }
    } catch (error) {
        console.error(`Error al verificar planilla existente:`, error);
        mostrarNotificacion('Error al verificar si ya existe una planilla', 'error');
        return {
            existe: false,
            error: true,
            mensaje: error.message
        };
    }
}

// Función para mostrar una alerta de planilla existente
function mostrarAlertaPlanillaExistente(infoPlanilla) {
    Swal.fire({
        icon: 'warning',
        title: 'Planilla Duplicada',
        html: `
            <div class="alerta-planilla-existente">
                <p>Ya existe una planilla para la fecha y departamento seleccionados.</p>
                <div class="info-planilla-existente">
                    <p><strong>ID Planilla:</strong> ${infoPlanilla.idPlanilla}</p>
                    <p><strong>Fecha:</strong> ${new Date(infoPlanilla.fechaLaboral).toLocaleDateString()}</p>
                    <p><strong>Descripción:</strong> ${infoPlanilla.descripcion}</p>
                </div>
                <p class="alerta-mensaje">No es posible crear planillas duplicadas para la misma fecha y departamento.</p>
            </div>
        `,
        confirmButtonColor: 'var(--color-primary)',
        confirmButtonText: 'Entendido'
    });
}

// Función para limpiar y resetear la ventana después de guardar
function resetearVentana() {
    // Resetear filtros
    limpiarFiltros();
    
    // Resetear datos 
    personalData = [];
    personalSeleccionado = [];
    
    // Limpiar tabla
    personalTableBody.innerHTML = `
        <tr class="empty-row">
            <td colspan="8">
                <div class="empty-message">
                    <i class="fas fa-search"></i>
                    <p>Seleccione los filtros y presione "Buscar" para mostrar el personal</p>
                </div>
            </td>
        </tr>
    `;
    
    // Resetear checkbox "Seleccionar todos"
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    
    // Deshabilitar botones de acciones
    generatePlanillaBtn.disabled = true;
    deleteSelectedBtn.disabled = true;
    
    // Habilitar controles de búsqueda
    inhabilitarControlesBusqueda(false);
    
    // Mostrar notificación
    mostrarNotificacion('Planilla generada con éxito. Ventana restablecida.', 'success');
}

async function obtenerLogoDivision(idDivision) {
    try {
        const connection = await getConnection();
        
        const query = `
            SELECT
                CASE 
                    WHEN Logos IS NOT NULL THEN CONCAT('data:image/png;base64,', TO_BASE64(Logos))
                    ELSE NULL 
                END AS Logos
            FROM
                divisiones
            WHERE
                IdDivision = ?
        `;
        
        const result = await connection.query(query, [idDivision]);
        await connection.close();
        
        if (result && result.length > 0 && result[0].Logos) {
            // El logo ya está en formato base64 o es una URL?
            return result[0].Logos;
        } else {
            console.warn(`No se encontró logo para la división ID: ${idDivision}`);
            return null;
        }
    } catch (error) {
        console.error('Error al obtener logo de división:', error);
        mostrarNotificacion('Error al obtener el logo de la división', 'error');
        return null;
    }
}

// ================ FUNCIONES PARA COLABORADORES EXTERNOS ================

// Función para inicializar los eventos de colaboradores externos
function initExternalCollaborators() {
    // Configurar evento para el botón "Agregar colaboradores externos"
    if (addExternalBtn) {
        addExternalBtn.addEventListener('click', async () => {
            // Verificar si el usuario tiene permiso (código 111)
            const tienePermiso = await verificarPermiso(111);
            
            if (!tienePermiso) {
                mostrarNotificacion(
                    'No tiene permiso para agregar colaboradores externos. Contacte con su Regional o Auditor.', 
                    'error', 
                    'Acceso Denegado'
                );
                return;
            }
            
            // Continuar con el proceso normal si tiene permiso
            const idDepartamento = departamentoSelect.value;
            if (!idDepartamento) {
                mostrarNotificacion('Debe seleccionar un departamento principal primero', 'warning');
                return;
            }
            
            try {
                // Cargar los límites del departamento
                currentDepartmentLimits = await cargarLimitesDepartamento(idDepartamento);
                
                // Actualizar contadores visuales con los límites
                actualizarContadoresLimites();
                
                // Calcular cuánto personal ya tenemos seleccionado en la planilla principal
                calcularConteoActualPorTipo();
                
                // Cargar departamentos en el selector (excepto el ya seleccionado)
                await cargarDepartamentosExternos(idDepartamento);
                
                // Mostrar el modal
                mostrarModal(externalModal);
                
                // Limpiar tabla y selecciones previas
                limpiarSeleccionExterna();
            } catch (error) {
                console.error('Error al inicializar modal de colaboradores externos:', error);
                mostrarNotificacion('Error al cargar información de colaboradores externos', 'error');
            }
        });
    }
    
    // El resto de la función permanece igual...
    // Configurar evento para el selector de departamento externo
    if (externalDepartamentoSelect) {
        externalDepartamentoSelect.addEventListener('change', async () => {
            const idDepartamentoExterno = externalDepartamentoSelect.value;
            if (idDepartamentoExterno) {
                await cargarPersonalDepartamentoExterno(idDepartamentoExterno);
            } else {
                // Si no hay departamento seleccionado, mostrar mensaje en la tabla
                externalPersonalTableBody.innerHTML = `
                    <tr class="empty-row">
                        <td colspan="5">
                            <div class="empty-message">
                                <i class="fas fa-building"></i>
                                <p>Seleccione un departamento para ver los colaboradores disponibles</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
        });
    }
    
    // Configurar evento para búsqueda de colaboradores externos
    if (searchExternalPersonalInput) {
        searchExternalPersonalInput.addEventListener('input', () => {
            buscarPersonalExterno(searchExternalPersonalInput.value);
        });
    }
    
    // Configurar evento para limpiar búsqueda
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchExternalPersonalInput.value = '';
            buscarPersonalExterno('');
        });
    }
    
    // Configurar evento seleccionar todos los colaboradores externos
    if (selectAllExternalCheckbox) {
        selectAllExternalCheckbox.addEventListener('change', seleccionarTodosExternos);
    }
    
    // Configurar eventos para botones del modal
    if (cancelExternalBtn) {
        cancelExternalBtn.addEventListener('click', () => ocultarModal(externalModal));
    }
    
    if (confirmExternalBtn) {
        confirmExternalBtn.addEventListener('click', agregarColaboradoresExternos);
    }
}
// Función para cargar departamentos en el selector de departamentos externos
async function cargarDepartamentosExternos(idDepartamentoActual) {
    try {
        const connection = await getConnection();
        
        const query = `
            SELECT
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento
            FROM
                departamentos
            WHERE
                departamentos.IdDepartamento != ?
            ORDER BY
                departamentos.NombreDepartamento
        `;
        
        const result = await connection.query(query, [idDepartamentoActual]);
        await connection.close();
        
        // Limpiar opciones existentes
        externalDepartamentoSelect.innerHTML = '<option value="" disabled selected>Seleccionar departamento</option>';
        
        // Agregar las nuevas opciones
        result.forEach(depto => {
            const option = document.createElement('option');
            option.value = depto.IdDepartamento;
            option.textContent = depto.NombreDepartamento;
            externalDepartamentoSelect.appendChild(option);
        });
        
        // Limpiar selecciones previas
        externalPersonalData = [];
        externalPersonalSelected = [];
        
        // Actualizar la tabla para mostrar mensaje de seleccionar departamento
        externalPersonalTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">
                    <div class="empty-message">
                        <i class="fas fa-building"></i>
                        <p>Seleccione un departamento para ver los colaboradores disponibles</p>
                    </div>
                </td>
            </tr>
        `;
        
        return result;
    } catch (error) {
        console.error('Error al cargar departamentos externos:', error);
        mostrarNotificacion('Error al cargar los departamentos disponibles', 'error');
        throw error;
    }
}
// Función para cargar departamentos - modificada para manejar permisos de administrador
async function cargarDepartamentos() {
    try {
        const connection = await getConnection();
        
        // Obtener el departamento del usuario desde localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        const idDepartamentoUsuario = userData?.IdSucuDepa;
        
        // Verificar si el usuario es administrador (tiene código de transacción 100)
        const esAdministrador = await verificarPermiso(100);
        
        const query = `
            SELECT
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento,
                departamentos.IdDivision
            FROM
                departamentos
            ORDER BY
                departamentos.NombreDepartamento
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        departamentosData = result;
        
        // Limpiar opciones existentes (mantener solo la opción default)
        while (departamentoSelect.options.length > 1) {
            departamentoSelect.remove(1);
        }
        
        // Agregar las nuevas opciones
        result.forEach(depto => {
            const option = document.createElement('option');
            option.value = depto.IdDepartamento;
            option.textContent = depto.NombreDepartamento;
            // Guardar el IdDivision como un atributo de datos
            option.dataset.idDivision = depto.IdDivision;
            departamentoSelect.appendChild(option);
        });

        // Si es administrador, permitir seleccionar cualquier departamento
        if (esAdministrador) {
            // Asegurarse de que el selector esté habilitado
            departamentoSelect.disabled = false;
            departamentoSelect.classList.remove('control-disabled');
            
            // Podemos mostrar un indicador visual de privilegio administrativo
            const departamentoLabel = document.querySelector('label[for="departamento"]');
            if (departamentoLabel) {
                departamentoLabel.innerHTML += ' <i class="fas fa-shield-alt" style="font-size: 0.7rem; color: var(--color-info);" title="Acceso administrativo"></i>';
            }
            
            console.log('Usuario con acceso administrativo: Selector de departamento habilitado');
        } 
        // Si no es administrador, bloquear el departamento del usuario
        else if (idDepartamentoUsuario) {
            // Seleccionar el departamento del usuario
            departamentoSelect.value = idDepartamentoUsuario;
            
            // Deshabilitar el selector para que no pueda cambiarlo
            departamentoSelect.disabled = true;
            departamentoSelect.classList.add('control-disabled');
            
            // También podemos mostrar un indicador visual
            const departamentoLabel = document.querySelector('label[for="departamento"]');
            if (departamentoLabel) {
                departamentoLabel.innerHTML += ' <i class="fas fa-lock" style="font-size: 0.7rem; color: var(--color-primary);" title="Departamento asignado"></i>';
            }
            
            console.log(`Departamento del usuario preseleccionado: ${idDepartamentoUsuario}`);
        }
        
        return result;
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarNotificacion('Error al cargar los departamentos', 'error');
        throw error;
    }
}

// Función para cargar el personal de un departamento externo
async function cargarPersonalDepartamentoExterno(idDepartamento) {
    try {
        // Mostrar estado de carga en la tabla
        externalPersonalTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">
                    <div class="loading-message">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Cargando colaboradores...</p>
                    </div>
                </td>
            </tr>
        `;
        
        const connection = await getConnection();
        
        const query = `
            SELECT
                personal.IdPersonal, 
                CONCAT(personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, ''), ', ', personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, '')) AS NombreCompleto,
                personal.IdPuesto,
                Puestos.Nombre AS NombrePuesto,
                Puestos.PagosDominicales,
                Puestos.PagosDiasEspeciales,
                personal.TipoPersonal AS IdTipoPersonal,
                TP.TipoPersonal AS NombreTipoPersonal
            FROM
                personal
                INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                INNER JOIN TipoPersonal TP ON personal.TipoPersonal = TP.IdTipo
            WHERE
                personal.IdSucuDepa = ?
                AND personal.Estado = 1
            ORDER BY
                personal.PrimerApellido, personal.PrimerNombre
        `;
        
        const result = await connection.query(query, [idDepartamento]);
        await connection.close();
        
        console.log(`Se encontraron ${result.length} colaboradores externos en el departamento ${idDepartamento}`);
        
        // Guardar datos en variable global
        externalPersonalData = result.map(persona => ({
            ...persona,
            PagosDominicales: Number(persona.PagosDominicales),
            PagosDiasEspeciales: Number(persona.PagosDiasEspeciales),
            selected: false
        }));
        
        // Renderizar la tabla con los datos obtenidos
        renderizarTablaPersonalExterno(externalPersonalData);
        
        return externalPersonalData;
    } catch (error) {
        console.error('Error al cargar personal externo:', error);
        mostrarNotificacion('Error al cargar el personal del departamento externo', 'error');
        
        // Mostrar mensaje de error en la tabla
        externalPersonalTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">
                    <div class="empty-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Ocurrió un error al cargar los datos. Intente nuevamente.</p>
                    </div>
                </td>
            </tr>
        `;
        
        return [];
    }
}

// Función para renderizar la tabla de personal externo
function renderizarTablaPersonalExterno(personal) {
    // Limpiar contenido actual
    externalPersonalTableBody.innerHTML = '';
    
    // Si no hay datos, mostrar mensaje
    if (!personal || personal.length === 0) {
        externalPersonalTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">
                    <div class="empty-message">
                        <i class="fas fa-user-slash"></i>
                        <p>No se encontraron colaboradores en el departamento seleccionado</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Renderizar cada fila
    personal.forEach(persona => {
        const tr = document.createElement('tr');
        
        // Determinar el pago aplicable para este colaborador
        let montoAplicable = 0;
        let tipoPagoMostrar = 'No aplica';
        
        if (pagoAplicable === 'dominical' && esDomingo) {
            montoAplicable = persona.PagosDominicales;
            tipoPagoMostrar = 'Dominical';
        } else if (pagoAplicable === 'especial' && esDiaEspecial) {
            montoAplicable = persona.PagosDiasEspeciales;
            tipoPagoMostrar = 'Día Especial';
        }
        
        // Crear celda de checkbox
        const tdCheck = document.createElement('td');
        tdCheck.innerHTML = `
            <div class="th-content">
                <input type="checkbox" id="check_ext_${persona.IdPersonal}" 
                       class="form-check-input external-personal-check" 
                       ${persona.selected ? 'checked' : ''} 
                       data-id="${persona.IdPersonal}">
                <label for="check_ext_${persona.IdPersonal}"></label>
            </div>
        `;
        tr.appendChild(tdCheck);
        
        // Crear celda de ID
        const tdId = document.createElement('td');
        tdId.textContent = persona.IdPersonal;
        tr.appendChild(tdId);
        
        // Crear celda de nombre
        const tdNombre = document.createElement('td');
        tdNombre.textContent = persona.NombreCompleto;
        tr.appendChild(tdNombre);
        
        // Crear celda de tipo de personal con estilo
        const tdTipoPersonal = document.createElement('td');
        
        // Determinar la clase CSS según el tipo de personal
        let typeClass = '';
        if (persona.IdTipoPersonal === 1 || persona.NombreTipoPersonal.toLowerCase().includes('fijo')) {
            typeClass = 'type-fijo';
        } else if (persona.IdTipoPersonal === 2 || persona.NombreTipoPersonal.toLowerCase().includes('parcial')) {
            typeClass = 'type-parcial';
        } else if (persona.IdTipoPersonal === 3 || persona.NombreTipoPersonal.toLowerCase().includes('vacacionista')) {
            typeClass = 'type-vacacionista';
        }
        
        tdTipoPersonal.innerHTML = `
            <span class="personnel-type-tag ${typeClass}">
                ${persona.NombreTipoPersonal}
            </span>
        `;
        tr.appendChild(tdTipoPersonal);
        
        // Crear celda de pago aplicable
        const tdPagoAplicable = document.createElement('td');
        
        if (montoAplicable > 0) {
            tdPagoAplicable.innerHTML = `
                <span class="pago-aplicable">${tipoPagoMostrar}: Q ${montoAplicable.toFixed(2)}</span>
            `;
        } else {
            tdPagoAplicable.textContent = 'No aplica para esta fecha';
        }
        
        tr.appendChild(tdPagoAplicable);
        
        // Añadir la fila a la tabla
        externalPersonalTableBody.appendChild(tr);
    });
    
    // Añadir event listeners a los checkboxes
    const checkboxes = document.querySelectorAll('.external-personal-check');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', manejarSeleccionPersonalExterno);
    });
}

// Función para agregar los colaboradores externos seleccionados a la planilla principal
function agregarColaboradoresExternos() {
    // Obtener los colaboradores seleccionados
    const seleccionados = externalPersonalData.filter(p => p.selected);
    
    if (seleccionados.length === 0) {
        mostrarNotificacion('No hay colaboradores seleccionados para agregar', 'warning');
        return;
    }
    
    // Verificar una vez más que no se excedan los límites
    const excesos = verificarLimitesConjuntos();
    
    if (excesos.excedeLimites) {
        // Mostrar alerta de exceso de límites
        Swal.fire({
            icon: 'warning',
            title: 'Límite de Personal Excedido',
            html: `
                <div class="alerta-limites">
                    <p>Se han excedido los límites de personal establecidos para este departamento:</p>
                    <ul class="lista-excesos">
                        ${excesos.mensajes.map(mensaje => `<li>${mensaje}</li>`).join('')}
                    </ul>
                    <p>Ajuste su selección antes de continuar.</p>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: 'var(--color-primary)'
        });
        return;
    }
    
    // Marcar a los colaboradores como externos
    const colaboradoresExternos = seleccionados.map(persona => ({
        ...persona,
        esExterno: true,
        departamentoOrigen: externalDepartamentoSelect.options[externalDepartamentoSelect.selectedIndex].text
    }));
    
    // Agregar los colaboradores externos al array de datos principal
    personalData = [...personalData, ...colaboradoresExternos];
    
    // Renderizar la tabla principal con los nuevos datos
    renderizarTablaPersonal(personalData);
    
    // Actualizar información de totales en la interfaz principal
    actualizarTotales();
    
    // Cerrar el modal
    ocultarModal(externalModal);
    
    // Mostrar notificación de éxito
    mostrarNotificacion(`Se agregaron ${seleccionados.length} colaborador(es) externos a la planilla`, 'success');
}

// Función para verificar límites de personal combinados (principal + externos)
function verificarLimitesConjuntos() {
    // Contar personal seleccionado por tipo (incluyendo principal y externos)
    const conteos = { fijo: 0, parcial: 0, vacacionista: 0 };
    
    // Contar personal principal
    personalData.forEach(persona => {
        if (persona.selected) {
            const tipo = obtenerTipoPersonalNormalizado(persona);
            if (tipo in conteos) {
                conteos[tipo]++;
            }
        }
    });
    
    // Contar personal externo
    externalPersonalData.forEach(persona => {
        if (persona.selected) {
            const tipo = obtenerTipoPersonalNormalizado(persona);
            if (tipo in conteos) {
                conteos[tipo]++;
            }
        }
    });
    
    // Verificar excesos
    const excesos = {
        excedeLimites: false,
        mensajes: []
    };
    
    if (currentDepartmentLimits.planFijo > 0 && conteos.fijo > currentDepartmentLimits.planFijo) {
        excesos.excedeLimites = true;
        excesos.mensajes.push(`Personal Fijo: ${conteos.fijo} seleccionados (límite: ${currentDepartmentLimits.planFijo})`);
    }
    
    if (currentDepartmentLimits.planParcial > 0 && conteos.parcial > currentDepartmentLimits.planParcial) {
        excesos.excedeLimites = true;
        excesos.mensajes.push(`Personal Parcial: ${conteos.parcial} seleccionados (límite: ${currentDepartmentLimits.planParcial})`);
    }
    
    if (currentDepartmentLimits.planVacacionista > 0 && conteos.vacacionista > currentDepartmentLimits.planVacacionista) {
        excesos.excedeLimites = true;
        excesos.mensajes.push(`Personal Vacacionista: ${conteos.vacacionista} seleccionados (límite: ${currentDepartmentLimits.planVacacionista})`);
    }
    
    return excesos;
}
// Función para manejar la selección de personal externo mediante checkboxes
function manejarSeleccionPersonalExterno(e) {
    const checkbox = e.target;
    const idPersonal = parseInt(checkbox.dataset.id);
    const isChecked = checkbox.checked;
    
    // Obtener el colaborador que se está seleccionando/deseleccionando
    const persona = externalPersonalData.find(p => p.IdPersonal === idPersonal);
    
    if (!persona) return;
    
    // Actualizar el estado en el array de datos
    externalPersonalData = externalPersonalData.map(persona => {
        if (persona.IdPersonal === idPersonal) {
            return {...persona, selected: isChecked};
        }
        return persona;
    });
    
    // Si se está seleccionando, verificar si excede los límites
    if (isChecked) {
        // Determinar el tipo de personal (fijo, parcial, vacacionista)
        const tipoPersonal = obtenerTipoPersonalNormalizado(persona);
        
        // Verificar si al agregar este colaborador se excedería el límite
        if (!verificarLimitesParaColaboradorExterno(tipoPersonal)) {
            // Si excede el límite, cancelar la selección
            checkbox.checked = false;
            
            // Actualizar nuevamente el estado
            externalPersonalData = externalPersonalData.map(p => {
                if (p.IdPersonal === idPersonal) {
                    return {...p, selected: false};
                }
                return p;
            });
            
            // Mostrar notificación de error
            mostrarNotificacion(`No se puede seleccionar más personal de tipo ${tipoPersonal}. Se ha alcanzado el límite.`, 'error');
            
            return;
        }
    }
    
    // Actualizar contadores visuales
    actualizarContadoresVisuales();
    
    // Actualizar el contador de seleccionados en el footer
    actualizarContadorSeleccionados();
    
    // Verificar si todos están seleccionados
    actualizarSelectAllExterno();
    
    // Habilitar/deshabilitar botón de confirmar
    const haySeleccionados = externalPersonalData.some(p => p.selected);
    confirmExternalBtn.disabled = !haySeleccionados;
}

// Función para seleccionar/deseleccionar todos los colaboradores externos
function seleccionarTodosExternos(e) {
    const isChecked = e.target.checked;
    
    if (isChecked) {
        // Intentar seleccionar todos, respetando los límites
        seleccionarTodosRespetandoLimites();
    } else {
        // Deseleccionar todos
        externalPersonalData = externalPersonalData.map(persona => ({
            ...persona,
            selected: false
        }));
        
        // Actualizar visualización
        actualizarContadoresVisuales();
        actualizarContadorSeleccionados();
        renderizarTablaPersonalExterno(externalPersonalData);
        
        // Deshabilitar botón de confirmar
        confirmExternalBtn.disabled = true;
    }
}

// Función para seleccionar todos los colaboradores respetando los límites
function seleccionarTodosRespetandoLimites() {
    // Crear copia para no modificar el original durante el proceso
    const dataCopia = [...externalPersonalData];
    
    // Obtener conteos actuales y límites
    const conteoActual = {...currentPersonalCounts};
    
    // Para cada tipo de personal, seleccionar hasta el límite
    ['fijo', 'parcial', 'vacacionista'].forEach(tipo => {
        // Filtrar colaboradores de este tipo que no estén seleccionados
        const colaboradoresTipo = dataCopia
            .filter(p => obtenerTipoPersonalNormalizado(p) === tipo && !p.selected)
            .sort((a, b) => a.NombreCompleto.localeCompare(b.NombreCompleto));
        
        // Determinar cuántos podemos seleccionar
        const limite = obtenerLimitePorTipo(tipo);
        const disponibles = Math.max(0, limite - conteoActual[tipo]);
        
        // Seleccionar hasta el límite disponible
        for (let i = 0; i < colaboradoresTipo.length && i < disponibles; i++) {
            const idPersonal = colaboradoresTipo[i].IdPersonal;
            
            // Actualizar en la copia
            const index = externalPersonalData.findIndex(p => p.IdPersonal === idPersonal);
            if (index !== -1) {
                externalPersonalData[index].selected = true;
                conteoActual[tipo]++;
            }
        }
    });
    
    // Actualizar la interfaz
    renderizarTablaPersonalExterno(externalPersonalData);
    actualizarContadoresVisuales();
    actualizarContadorSeleccionados();
    
    // Verificar estado del checkbox "seleccionar todos"
    const todoSeleccionado = externalPersonalData.every(p => p.selected);
    const algunoSeleccionado = externalPersonalData.some(p => p.selected);
    
    selectAllExternalCheckbox.checked = todoSeleccionado;
    selectAllExternalCheckbox.indeterminate = algunoSeleccionado && !todoSeleccionado;
    
    // Habilitar/deshabilitar botón de confirmar
    confirmExternalBtn.disabled = !algunoSeleccionado;
    
    // Si no se pudieron seleccionar todos, mostrar notificación
    if (algunoSeleccionado && !todoSeleccionado) {
        mostrarNotificacion('No se pudieron seleccionar todos los colaboradores debido a los límites establecidos.', 'warning');
    }
}

// Función para buscar personal externo por nombre
function buscarPersonalExterno(searchTerm) {
    if (!searchTerm.trim()) {
        // Si no hay término de búsqueda, mostrar todos
        renderizarTablaPersonalExterno(externalPersonalData);
        return;
    }
    
    // Filtrar por término de búsqueda (insensible a mayúsculas/minúsculas)
    const filtrado = externalPersonalData.filter(persona => 
        persona.NombreCompleto.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Renderizar los resultados filtrados
    renderizarTablaPersonalExterno(filtrado);
}

// Función para actualizar el estado del checkbox "Seleccionar todos" para externos
function actualizarSelectAllExterno() {
    const totalItems = externalPersonalData.length;
    const selectedItems = externalPersonalData.filter(p => p.selected).length;
    
    // Actualizar el estado del checkbox "Seleccionar todos"
    selectAllExternalCheckbox.checked = totalItems > 0 && selectedItems === totalItems;
    selectAllExternalCheckbox.indeterminate = selectedItems > 0 && selectedItems < totalItems;
}

// Función para actualizar el contador de seleccionados en el footer
function actualizarContadorSeleccionados() {
    const seleccionados = externalPersonalData.filter(p => p.selected).length;
    selectedExternalCountSpan.textContent = `${seleccionados} colaborador(es) seleccionado(s)`;
    
    // Habilitar/deshabilitar botón de confirmar
    confirmExternalBtn.disabled = seleccionados === 0;
}

// Función para limpiar la selección de personal externo
function limpiarSeleccionExterna() {
    // Resetear los datos
    externalPersonalData = [];
    externalPersonalSelected = [];
    
    // Limpiar la tabla
    externalPersonalTableBody.innerHTML = `
        <tr class="empty-row">
            <td colspan="5">
                <div class="empty-message">
                    <i class="fas fa-building"></i>
                    <p>Seleccione un departamento para ver los colaboradores disponibles</p>
                </div>
            </td>
        </tr>
    `;
    
    // Resetear el selector de departamento
    externalDepartamentoSelect.selectedIndex = 0;
    
    // Limpiar la búsqueda
    searchExternalPersonalInput.value = '';
    
    // Resetear checkbox "Seleccionar todos"
    selectAllExternalCheckbox.checked = false;
    selectAllExternalCheckbox.indeterminate = false;
    
    // Resetear contador de seleccionados
    selectedExternalCountSpan.textContent = '0 colaboradores seleccionados';
    
    // Deshabilitar botón de confirmar
    confirmExternalBtn.disabled = true;
}

// Función para calcular el conteo actual de personal por tipo
function calcularConteoActualPorTipo() {
    // Reiniciar conteos
    currentPersonalCounts = { fijo: 0, parcial: 0, vacacionista: 0 };
    
    // Contar el personal ya seleccionado en la planilla principal
    personalData.forEach(persona => {
        if (persona.selected) {
            const tipo = obtenerTipoPersonalNormalizado(persona);
            if (tipo in currentPersonalCounts) {
                currentPersonalCounts[tipo]++;
            }
        }
    });
    
    // Actualizar contadores visuales
    actualizarContadoresVisuales();
}

// Función para normalizar el tipo de personal
function obtenerTipoPersonalNormalizado(persona) {
    // Por ID
    if (persona.IdTipoPersonal === 1) return 'fijo';
    if (persona.IdTipoPersonal === 2) return 'parcial';
    if (persona.IdTipoPersonal === 3) return 'vacacionista';
    
    // Por nombre, como fallback
    const tipoNombre = persona.NombreTipoPersonal.toLowerCase();
    if (tipoNombre.includes('fijo')) return 'fijo';
    if (tipoNombre.includes('parcial')) return 'parcial';
    if (tipoNombre.includes('vacacionista')) return 'vacacionista';
    
    // Si no se puede determinar, asumir fijo como fallback
    console.warn('No se pudo determinar el tipo de personal para:', persona);
    return 'fijo';
}

// Función para obtener el límite por tipo de personal
function obtenerLimitePorTipo(tipo) {
    switch (tipo) {
        case 'fijo': return currentDepartmentLimits.planFijo;
        case 'parcial': return currentDepartmentLimits.planParcial;
        case 'vacacionista': return currentDepartmentLimits.planVacacionista;
        default: return 0;
    }
}

// Función para actualizar los contadores visuales de límites
function actualizarContadoresLimites() {
    // Actualizar los valores máximos
    maxFijoSpan.textContent = currentDepartmentLimits.planFijo;
    maxParcialSpan.textContent = currentDepartmentLimits.planParcial;
    maxVacacionistaSpan.textContent = currentDepartmentLimits.planVacacionista;
}

// Función para actualizar los contadores visuales según la selección actual
function actualizarContadoresVisuales() {
    // Reiniciar conteos
    const conteos = { fijo: 0, parcial: 0, vacacionista: 0 };
    
    // Contar personal ya seleccionado en la planilla principal
    personalData.forEach(persona => {
        if (persona.selected) {
            const tipo = obtenerTipoPersonalNormalizado(persona);
            if (tipo in conteos) {
                conteos[tipo]++;
            }
        }
    });
    
    // Contar personal externo seleccionado
    externalPersonalData.forEach(persona => {
        if (persona.selected) {
            const tipo = obtenerTipoPersonalNormalizado(persona);
            if (tipo in conteos) {
                conteos[tipo]++;
            }
        }
    });
    
    // Actualizar los contadores en la UI
    countFijoSpan.textContent = conteos.fijo;
    countParcialSpan.textContent = conteos.parcial;
    countVacacionistaSpan.textContent = conteos.vacacionista;
    
    // Calcular porcentajes para las barras de progreso
    const pctFijo = currentDepartmentLimits.planFijo > 0 
        ? (conteos.fijo / currentDepartmentLimits.planFijo) * 100 
        : 0;
    
    const pctParcial = currentDepartmentLimits.planParcial > 0 
        ? (conteos.parcial / currentDepartmentLimits.planParcial) * 100 
        : 0;
    
    const pctVacacionista = currentDepartmentLimits.planVacacionista > 0 
        ? (conteos.vacacionista / currentDepartmentLimits.planVacacionista) * 100 
        : 0;
    
    // Actualizar las barras de progreso
    progressFijoDiv.style.width = `${Math.min(pctFijo, 100)}%`;
    progressParcialDiv.style.width = `${Math.min(pctParcial, 100)}%`;
    progressVacacionistaDiv.style.width = `${Math.min(pctVacacionista, 100)}%`;
    
    // Marcar visualmente si se excede algún límite
    const counterFijoElement = document.getElementById('counterFijo');
    const counterParcialElement = document.getElementById('counterParcial');
    const counterVacacionistaElement = document.getElementById('counterVacacionista');
    
    counterFijoElement.classList.toggle('limit-exceeded', 
        currentDepartmentLimits.planFijo > 0 && conteos.fijo > currentDepartmentLimits.planFijo);
    
    counterParcialElement.classList.toggle('limit-exceeded', 
        currentDepartmentLimits.planParcial > 0 && conteos.parcial > currentDepartmentLimits.planParcial);
    
    counterVacacionistaElement.classList.toggle('limit-exceeded', 
        currentDepartmentLimits.planVacacionista > 0 && conteos.vacacionista > currentDepartmentLimits.planVacacionista);
    
    // Actualizar los conteos actuales en la variable global
    currentPersonalCounts = conteos;
}

// Función para verificar si agregar un colaborador externo excedería los límites
function verificarLimitesParaColaboradorExterno(tipo) {
    // Obtener el límite para este tipo
    const limite = obtenerLimitePorTipo(tipo);
    
    // Si no hay límite (0), permitir la selección
    if (limite <= 0) return true;
    
    // Calcular cuántos colaboradores ya hay seleccionados de este tipo
    let conteoActual = currentPersonalCounts[tipo];
    
    // Verificar si agregar uno más excedería el límite
    return conteoActual < limite;
}

// Función para actualizar los totales de personal y pago en la interfaz principal
function actualizarTotales() {
    // Contar total de colaboradores seleccionados
    const totalColaboradores = personalData.filter(p => p.selected).length;
    
    // Calcular monto total
    let totalMonto = 0;
    
    personalData.forEach(persona => {
        if (persona.selected) {
            if (pagoAplicable === 'dominical' && esDomingo) {
                totalMonto += persona.PagosDominicales;
            } else if (pagoAplicable === 'especial' && esDiaEspecial) {
                totalMonto += persona.PagosDiasEspeciales;
            }
        }
    });
    
    // Actualizar información de totales en la interfaz
    totalPersonalElement.querySelector('.status-value').textContent = totalColaboradores;
    totalPagoElement.querySelector('.status-value').textContent = `Q ${totalMonto.toFixed(2)}`;
}
async function verificarPermiso(codigoTransaccion) {
    try {
        // Obtener el ID del usuario actual desde localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        const idUsuario = userData?.IdPersonal || 0;
        
        if (!idUsuario) {
            console.error('No se pudo obtener el ID del usuario');
            return false;
        }
        
        const connection = await getConnection();
        
        const query = `
            SELECT COUNT(*) AS tiene_permiso 
            FROM TransaccionesRRHH 
            WHERE IdPersonal = ? 
            AND Codigo = ? 
            AND Activo = 1
        `;
        
        const result = await connection.query(query, [idUsuario, codigoTransaccion]);
        await connection.close();
        
        // Si hay al menos un registro, el usuario tiene permiso
        return result && result.length > 0 && result[0].tiene_permiso > 0;
        
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos de usuario', 'error');
        return false;
    }
}

// Agregar estilos adicionales para elementos externos
document.addEventListener('DOMContentLoaded', async() => {
    try {
        window.esUsuarioAdministrador = await verificarPermiso(100);
    } catch (error) {
        console.error('Error al verificar permisos de administrador:', error);
        window.esUsuarioAdministrador = false;
    }
    // Agregar CSS para la insignia de colaborador externo
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .external-name {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .external-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background-color: rgba(255, 127, 39, 0.1);
            color: var(--color-primary);
            width: 20px;
            height: 20px;
            border-radius: 50%;
            font-size: 0.7rem;
            cursor: help;
            transition: all var(--transition-speed);
            border: 1px solid rgba(255, 127, 39, 0.3);
        }
        .external-badge:hover {
            transform: scale(1.2);
            background-color: rgba(255, 127, 39, 0.2);
        }
        .external-collaborator-row {
            position: relative;
            border-left: 3px solid var(--color-primary) !important;
        }
        .department-locked {
            background-color: rgba(255, 127, 39, 0.05) !important;
        }
    `;
    document.head.appendChild(styleElement);
    
    // Verificar si el usuario ha iniciado sesión
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.IdPersonal) {
        // Redirigir al login si no hay datos de usuario
        window.location.href = 'Login.html';
        return;
    }
    
    // Inicializar eventos para colaboradores externos
    initExternalCollaborators();
    
    // Event listeners para paginación
    firstPageBtn.addEventListener('click', () => cambiarPagina(1));
    prevPageBtn.addEventListener('click', () => cambiarPagina(currentPage - 1));
    nextPageBtn.addEventListener('click', () => cambiarPagina(currentPage + 1));
    lastPageBtn.addEventListener('click', () => cambiarPagina(totalPages));
    
    // Cargar datos iniciales
    Promise.all([
        cargarDepartamentos(),
        cargarTiposPersonal()
    ]).then(() => {
        mostrarNotificacion('Datos iniciales cargados correctamente', 'success');
        
        // Si el departamento está preseleccionado, aplicar los filtros automáticamente
        if (departamentoSelect.disabled && departamentoSelect.value) {
            // Dar un breve retraso para asegurar que todo está listo
            setTimeout(() => {
                aplicarFiltros();
            }, 500);
        }
    }).catch(error => {
        console.error('Error al cargar datos iniciales:', error);
        mostrarNotificacion('Error al cargar los datos iniciales', 'error');
    });
    
    // Event listeners para filtros
    applyFiltersBtn.addEventListener('click', aplicarFiltros);
    clearFiltersBtn.addEventListener('click', limpiarFiltros);
    refreshFiltersBtn.addEventListener('click', () => {
        // Recargar los filtros sin perder la selección actual
        Promise.all([
            cargarDepartamentos(),
            cargarTiposPersonal()
        ]).then(() => {
            mostrarNotificacion('Filtros actualizados', 'success');
        });
    });
    
    // Event listener para búsqueda
    searchPersonalInput.addEventListener('input', () => {
        buscarPersonal(searchPersonalInput.value);
    });
    
    // Actualizar fecha mínima (no permitir fechas pasadas)
    function actualizarFechaMinima() {
        const hoy = new Date().toISOString().split('T')[0];
        fechaInput.min = hoy; // Esto previene seleccionar fechas anteriores a hoy
    }
    actualizarFechaMinima();

    // Para hacer que la fecha por defecto sea hoy
    fechaInput.value = new Date().toISOString().split('T')[0];
    
    // Event listener para seleccionar todos
    selectAllCheckbox.addEventListener('change', seleccionarTodos);
    
    // Event listeners para botones de acción
    refreshListBtn.addEventListener('click', () => {
        if (filtersApplied) {
            aplicarFiltros();
        } else {
            mostrarNotificacion('Primero debe aplicar los filtros', 'info');
        }
    });
    
    generatePlanillaBtn.addEventListener('click', mostrarConfirmacionPlanilla);
    deleteSelectedBtn.addEventListener('click', eliminarPersonalSeleccionado);
    
    // Event listeners para modales
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            ocultarModal(modal);
        });
    });
    
    // Cerrar modal al hacer click fuera del contenido
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                ocultarModal(modal);
            }
        });
    });
    
    // Event listeners específicos para cada modal
    cancelGenerateBtn.addEventListener('click', () => ocultarModal(confirmModal));
    confirmGenerateBtn.addEventListener('click', () => {
        ocultarModal(confirmModal);
        generarPlanilla();
    });
    
    const previewPdfBtn = document.getElementById('previewPdfBtn');
    if (previewPdfBtn) {
        previewPdfBtn.addEventListener('click', () => {
            ocultarModal(confirmModal);
            generarPreviewPDF();
        });
    }
    
    const previewBox = document.querySelector('.preview-box');
    if (previewBox) {
        previewBox.addEventListener('click', () => {
            ocultarModal(confirmModal);
            generarPreviewPDF();
        });
    }
    
    closeHelpBtn.addEventListener('click', () => ocultarModal(helpModal));
    helpBtn.addEventListener('click', () => mostrarModal(helpModal));
    
    // Cargar logo e información de usuario
    cargarLogo();
    cargarInfoUsuario();
});