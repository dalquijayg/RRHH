// Importaciones requeridas
const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const Swal = require('sweetalert2');
const fs = require('fs');
const path = require('path');

// Configuración de la conexión
const conexion = 'DSN=recursos2';
const currentUser = JSON.parse(localStorage.getItem('userData'));
let employeeData = null;
let changedFields = {};
let originalValues = {};
let canEdit = false;
let currentTab = 'personal';

// Referencias a elementos DOM
const loadingIndicator = document.getElementById('loadingIndicator');
const tabBtns = document.querySelectorAll('.tab-btn');
const employeeStatus = document.getElementById('employeeStatus');
const btnVolver = document.getElementById('btnVolver');
const btnGuardarTodo = document.getElementById('btnGuardarTodo');
const btnEditPhoto = document.getElementById('btnEditPhoto');
const photoModal = document.getElementById('photoModal');
const confirmModal = document.getElementById('confirmModal');
const sectionEditBtns = document.querySelectorAll('.section-edit-btn');
const employeePhoto = document.getElementById('employeePhoto');
const employeeName = document.getElementById('employeeName');
const employeeDepartment = document.getElementById('employeeDepartment');
const employeeId = document.getElementById('employeeId');

// Funciones de utilidad
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

function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        
        // Verificar si la fecha es válida
        if (isNaN(date.getTime())) {
            return '';
        }
        
        return date.toISOString().split('T')[0]; // Formato YYYY-MM-DD para inputs de tipo date
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return '';
    }
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    // Verificar si ya existe el contenedor de toast
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Crear el toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    
    // Definir iconos según el tipo
    const iconMap = {
        success: 'check-circle',
        error: 'times-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    // Crear contenido del toast
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${iconMap[tipo]}"></i>
        </div>
        <div class="toast-content">${mensaje}</div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Agregar al contenedor
    toastContainer.appendChild(toast);
    
    // Manejar el cierre del toast
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    });
    
    // Auto-cierre después de 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 300);
        }
    }, 5000);
}

// Verificar permisos del usuario para editar
async function verificarPermisoEdicion() {
    try {
        if (!currentUser || !currentUser.IdPersonal) {
            mostrarNotificacion('No se puede verificar los permisos de usuario. Inicie sesión nuevamente.', 'error');
            return false;
        }
        
        const connection = await getConnection();
        const query = `
            SELECT * FROM TransaccionesRRHH 
            WHERE IdPersonal = ? AND Codigo = 103 AND Activo = 1
        `;
        
        const result = await connection.query(query, [currentUser.IdPersonal]);
        await connection.close();
        
        if (result.length > 0) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        mostrarNotificacion('Error al verificar permisos de edición', 'error');
        return false;
    }
}

// Cargar datos del colaborador
async function cargarDatosColaborador(id) {
    try {
        mostrarCargando(true);
        
        const connection = await getConnection();
        
        // Consulta principal para datos del personal
        const query = `
            SELECT 
                personal.*,
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto,
                departamentos.NombreDepartamento,
                PuestosGenerales.Nombre AS NombrePuesto,
                estadocivil.EstadoCivil,
                TipoPersonal.TipoPersonal,
                IFNULL(planillas.Nombre_Planilla, 'Sin Planilla') AS Nombre_Planilla,
                EstadoPersonal.EstadoPersonal,
                deptoOrigen.NombreDepartamento AS DepartamentoOrigen,
                muniOrigen.NombreMunicipio AS MunicipioOrigen,
                deptoResidencia.NombreDepartamento AS DepartamentoResidencia,
                muniResidencia.NombreMunicipio AS MunicipioResidencia,
                parentesco.Parentesco AS ParentescoEmergencia,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM
                personal
                LEFT JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                LEFT JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                LEFT JOIN PuestosGenerales ON Puestos.Id_PuestoGeneral = PuestosGenerales.Id_Puesto
                LEFT JOIN FotosPersonal ON personal.IdPersonal = FotosPersonal.IdPersonal
                LEFT JOIN estadocivil ON personal.IdEstadoCivil = estadocivil.IdCivil
                LEFT JOIN TipoPersonal ON personal.TipoPersonal = TipoPersonal.IdTipo
                LEFT JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
                INNER JOIN EstadoPersonal ON personal.Estado = EstadoPersonal.IdEstado
                LEFT JOIN departamentosguatemala deptoOrigen ON personal.IdDepartamentoOrigen = deptoOrigen.IdDepartamentoG
                LEFT JOIN municipios muniOrigen ON personal.IdMunicipioOrigen = muniOrigen.IdMunicipio
                LEFT JOIN departamentosguatemala deptoResidencia ON personal.IdDepartamentoG = deptoResidencia.IdDepartamentoG
                LEFT JOIN municipios muniResidencia ON personal.IdMunicipioG = muniResidencia.IdMunicipio
                LEFT JOIN parentesco ON personal.IdParentesco = parentesco.IdParentesco
            WHERE
                personal.IdPersonal = ?
        `;
        
        const result = await connection.query(query, [id]);
        
        if (result.length === 0) {
            await connection.close();
            mostrarNotificacion('Empleado no encontrado', 'error');
            window.location.href = 'BusquedaP.html';
            return;
        }
        
        // Guardar datos del empleado
        employeeData = result[0];
        
        // Cargar información académica
        const infoAcademica = await cargarInfoAcademica(id, connection);
        if (infoAcademica) {
            employeeData.infoAcademica = infoAcademica;
        }
        
        await connection.close();
        
        // Mostrar datos en la interfaz
        mostrarDatosColaborador();
        
        // Cargar historial de cambios
        await cargarHistorialCambios(id);
        
        // Cargar selectores
        await Promise.all([
            cargarEstados(),
            cargarEstadosCiviles(),
            cargarDepartamentosGuatemala(),
            cargarTiposPersonal(),
            cargarPlanillas(),
            cargarDepartamentos(),
            cargarEstadosEducativos(),
            cargarPlanesEstudio(),
            cargarParentescos()
        ]);
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error al cargar datos del empleado:', error);
        mostrarNotificacion('Error al cargar información del colaborador', 'error');
        mostrarCargando(false);
    }
}

// Cargar información académica
async function cargarInfoAcademica(idPersonal, connection) {
    try {
        const query = `
            SELECT
                -- Información de Primaria
                InfoAcademica.EstadoPrimaria,
                InfoAcademica.IdPlanEstudioPrimaria,
                InfoAcademica.IdNivelAcademicoPrimaria,
                
                -- Información de Básico
                InfoAcademica.EstadoBasico,
                InfoAcademica.IdPlanEstudioBasico,
                InfoAcademica.IdNivelAcademicoBasico,
                
                -- Información de Diversificado
                InfoAcademica.EstadoDiversificado,
                InfoAcademica.IdPlanEstudioDiversificado,
                InfoAcademica.IdNivelAcademicoDiversificado,
                InfoAcademica.IdCarreraDiversificado,
                
                -- Información de Universidad
                InfoAcademica.EstadoUniversidad,
                InfoAcademica.IdUniversidad,
                InfoAcademica.IdPlanEstudioUniversitario,
                InfoAcademica.IdNivelAcademicoUnivesitario,
                InfoAcademica.IdCarreraUniversitaria,
                
                -- Información de Maestría
                InfoAcademica.EstadoMaestria,
                InfoAcademica.IdUniversidadMaestria,
                InfoAcademica.IdPlanEstudio,
                InfoAcademica.IdNivelAcademicoMaestria,
                InfoAcademica.IdMaestria
            FROM
                InfoAcademica
            WHERE
                InfoAcademica.IdPersonal = ?
        `;
        
        const result = await connection.query(query, [idPersonal]);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        console.error('Error al cargar información académica:', error);
        mostrarNotificacion('Error al cargar información académica', 'error');
        return null;
    }
}

// Mostrar datos del colaborador en la interfaz
function mostrarDatosColaborador() {
    if (!employeeData) return;
    
    // Información de perfil
    employeePhoto.src = employeeData.FotoBase64 || '../Imagenes/user-default.png';
    employeeName.textContent = employeeData.NombreCompleto;
    employeeDepartment.textContent = `${employeeData.NombrePuesto} - ${employeeData.NombreDepartamento}`;
    employeeId.textContent = employeeData.IdPersonal;
    
    // Guardar valores originales para comparación posterior
    guardarValoresOriginales();
    
    // Información Personal
    document.getElementById('primerNombre').value = employeeData.PrimerNombre || '';
    document.getElementById('segundoNombre').value = employeeData.SegundoNombre || '';
    document.getElementById('tercerNombre').value = employeeData.TercerNombre || '';
    document.getElementById('primerApellido').value = employeeData.PrimerApellido || '';
    document.getElementById('segundoApellido').value = employeeData.SegundoApellido || '';
    document.getElementById('dpi').value = employeeData.DPI || '';
    document.getElementById('fechaNacimiento').value = formatDate(employeeData.FechaNacimiento);
    document.getElementById('hijos').value = employeeData.Hijos || 0;
    
    // Ubicación
    document.getElementById('direccionResidencia').value = employeeData.DireccionRecidencia || '';
    
    // Contacto
    document.getElementById('telefono1').value = employeeData.Telefono1 || '';
    document.getElementById('telefono2').value = employeeData.Telefono2 || '';
    document.getElementById('email').value = employeeData.CorreoElectronico || '';
    document.getElementById('nombreContacto').value = employeeData.NombreContactoEmergencia || '';
    document.getElementById('telefonoContacto').value = employeeData.TelefonoContactoEmergencia || '';
    
    // Información Laboral
    document.getElementById('inicioLaboral').value = formatDate(employeeData.InicioLaboral);
    document.getElementById('fechaContrato').value = formatDate(employeeData.FechaContrato);
    document.getElementById('fechaPlanilla').value = formatDate(employeeData.FechaPlanilla);
}

// Guardar valores originales para comparación
// Guardar valores originales para comparación
function guardarValoresOriginales() {
    originalValues = {};
    
    // Información personal
    originalValues.primerNombre = employeeData.PrimerNombre || '';
    originalValues.segundoNombre = employeeData.SegundoNombre || '';
    originalValues.tercerNombre = employeeData.TercerNombre || '';
    originalValues.primerApellido = employeeData.PrimerApellido || '';
    originalValues.segundoApellido = employeeData.SegundoApellido || '';
    originalValues.dpi = employeeData.DPI || '';
    originalValues.fechaNacimiento = employeeData.FechaNacimiento ? formatDate(employeeData.FechaNacimiento) : '';
    originalValues.estadoCivil = employeeData.IdEstadoCivil;
    originalValues.hijos = employeeData.Hijos || 0;
    
    // Ubicación
    originalValues.deptoOrigen = employeeData.IdDepartamentoOrigen;
    originalValues.muniOrigen = employeeData.IdMunicipioOrigen;
    originalValues.direccionResidencia = employeeData.DireccionRecidencia || '';
    originalValues.deptoResidencia = employeeData.IdDepartamentoG;
    originalValues.muniResidencia = employeeData.IdMunicipioG;
    
    // Contacto
    originalValues.telefono1 = employeeData.Telefono1 || '';
    originalValues.telefono2 = employeeData.Telefono2 || '';
    originalValues.email = employeeData.CorreoElectronico || '';
    originalValues.nombreContacto = employeeData.NombreContactoEmergencia || '';
    originalValues.telefonoContacto = employeeData.TelefonoContactoEmergencia || '';
    originalValues.parentesco = employeeData.IdParentesco;
    
    // Información laboral
    originalValues.tipoPersonal = employeeData.TipoPersonal;
    originalValues.planilla = employeeData.IdPlanilla;
    originalValues.departamento = employeeData.IdSucuDepa;
    originalValues.puesto = employeeData.IdPuesto;
    originalValues.inicioLaboral = employeeData.InicioLaboral ? formatDate(employeeData.InicioLaboral) : '';
    originalValues.fechaContrato = employeeData.FechaContrato ? formatDate(employeeData.FechaContrato) : '';
    originalValues.fechaPlanilla = employeeData.FechaPlanilla ? formatDate(employeeData.FechaPlanilla) : '';
    originalValues.estado = employeeData.Estado;
    
    // Guarda también los valores académicos si existen
    if (employeeData.infoAcademica) {
        // Agrega aquí los campos académicos
        originalValues.estadoPrimaria = employeeData.infoAcademica.EstadoPrimaria;
        originalValues.planPrimaria = employeeData.infoAcademica.IdPlanEstudioPrimaria;
        // ... etc para los demás campos académicos
    }
}

// Mostrar/ocultar indicador de carga
function mostrarCargando(mostrar) {
    if (mostrar) {
        loadingIndicator.style.display = 'flex';
    } else {
        loadingIndicator.style.display = 'none';
    }
}
async function cargarHistorialCambios(idPersonal) {
    try {
        const connection = await getConnection();
        const query = `
            SELECT 
                HistorialCambios.IdHistorial,
                HistorialCambios.IdPersonal,
                HistorialCambios.Seccion,
                HistorialCambios.Campo,
                HistorialCambios.ValorAnterior,
                HistorialCambios.ValorNuevo,
                HistorialCambios.FechaCambio,
                HistorialCambios.IdUsuario,
                CONCAT(p.PrimerNombre, ' ', IFNULL(p.PrimerApellido, '')) AS NombreUsuario
            FROM 
                HistorialCambios
                LEFT JOIN personal p ON HistorialCambios.IdUsuario = p.IdPersonal
            WHERE 
                HistorialCambios.IdPersonal = ?
            ORDER BY 
                HistorialCambios.FechaCambio DESC
        `;
        
        const result = await connection.query(query, [idPersonal]);
        await connection.close();
        
        // Mostrar historial en la interfaz
        mostrarHistorialCambios(result);
        
    } catch (error) {
        console.error('Error al cargar historial de cambios:', error);
        mostrarNotificacion('Error al cargar el historial de cambios', 'error');
    }
}

// Mostrar historial de cambios en la interfaz
// Mostrar historial de cambios en la interfaz
function mostrarHistorialCambios(historial) {
    const historialContainer = document.querySelector('.history-timeline');
    
    if (!historialContainer) {
        console.error('No se encontró el contenedor de historial');
        return;
    }
    
    const noHistoryMessage = document.querySelector('.no-history-message');
    
    if (!historial || historial.length === 0) {
        // Si no existe el mensaje de "no hay historial", lo creamos
        if (!noHistoryMessage) {
            const messageElement = document.createElement('div');
            messageElement.className = 'no-history-message';
            messageElement.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <p>No hay registros de cambios para este colaborador</p>
            `;
            historialContainer.appendChild(messageElement);
        } else {
            noHistoryMessage.style.display = 'flex';
        }
        return;
    }
    
    // Si hay historial, ocultamos el mensaje (si existe)
    if (noHistoryMessage) {
        noHistoryMessage.style.display = 'none';
    }
    
    let historialHTML = '';
    
    // Resto de la función...
    // Agrupar cambios por fecha y usuario
    const cambiosPorFecha = {};
    
    historial.forEach(cambio => {
        const fecha = new Date(cambio.FechaCambio).toISOString().split('T')[0];
        const clave = `${fecha}-${cambio.IdUsuario}`;
        
        if (!cambiosPorFecha[clave]) {
            cambiosPorFecha[clave] = {
                fecha: cambio.FechaCambio,
                usuario: cambio.NombreUsuario,
                idUsuario: cambio.IdUsuario,
                cambios: []
            };
        }
        
        cambiosPorFecha[clave].cambios.push(cambio);
    });
    
    // Crear elementos HTML para cada grupo de cambios
    Object.values(cambiosPorFecha).forEach(grupo => {
        const fechaFormateada = new Date(grupo.fecha).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let cambiosHTML = '';
        
        grupo.cambios.forEach(cambio => {
            // Obtener el icono para la sección
            const seccionIcono = obtenerIconoSeccion(cambio.Seccion);
            
            cambiosHTML += `
                <div class="history-change">
                    <span class="history-field">${obtenerNombreCampo(cambio.Campo)}:</span>
                    <span class="history-old">${formatearValorCampo(cambio.Campo, cambio.ValorAnterior)}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span class="history-new">${formatearValorCampo(cambio.Campo, cambio.ValorNuevo)}</span>
                </div>
            `;
        });
        
        historialHTML += `
            <div class="history-item" data-section="${grupo.cambios[0].Seccion}">
                <div class="history-icon">
                    <i class="fas ${obtenerIconoSeccion(grupo.cambios[0].Seccion)}"></i>
                </div>
                <div class="history-content">
                    <div class="history-header">
                        <div class="history-title">${obtenerTituloSeccion(grupo.cambios[0].Seccion)}</div>
                        <div class="history-date">${fechaFormateada}</div>
                    </div>
                    <div class="history-details">
                        ${cambiosHTML}
                    </div>
                    <div class="history-by">
                        Modificado por: ${grupo.usuario || 'Usuario desconocido'}
                    </div>
                </div>
            </div>
        `;
    });
    
    historialContainer.innerHTML = historialHTML;
    
    // Configurar filtro de historial
    configurarFiltroHistorial();
}

// Configurar filtro para el historial
function configurarFiltroHistorial() {
    const filtroHistorial = document.getElementById('historyFilter');
    
    filtroHistorial.addEventListener('change', () => {
        const filtro = filtroHistorial.value;
        const items = document.querySelectorAll('.history-item');
        
        items.forEach(item => {
            if (filtro === 'all' || item.dataset.section === filtro) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

// Obtener icono para cada sección
function obtenerIconoSeccion(seccion) {
    const iconos = {
        'personal': 'fa-user',
        'location': 'fa-map-marker-alt',
        'contact': 'fa-phone-alt',
        'work': 'fa-briefcase',
        'academic': 'fa-graduation-cap',
        'status': 'fa-toggle-on'
    };
    
    return iconos[seccion] || 'fa-history';
}

// Obtener título para cada sección
function obtenerTituloSeccion(seccion) {
    const titulos = {
        'personal': 'Información Personal',
        'location': 'Ubicación',
        'contact': 'Información de Contacto',
        'work': 'Información Laboral',
        'academic': 'Información Académica',
        'status': 'Estado del Colaborador'
    };
    
    return titulos[seccion] || 'Cambios Generales';
}

// Obtener nombre amigable para cada campo
function obtenerNombreCampo(campo) {
    const nombresCampo = {
        'PrimerNombre': 'Primer Nombre',
        'SegundoNombre': 'Segundo Nombre',
        'TercerNombre': 'Tercer Nombre',
        'PrimerApellido': 'Primer Apellido',
        'SegundoApellido': 'Segundo Apellido',
        'DPI': 'DPI',
        'FechaNacimiento': 'Fecha de Nacimiento',
        'IdEstadoCivil': 'Estado Civil',
        'Hijos': 'Número de Hijos',
        'IdDepartamentoOrigen': 'Departamento de Origen',
        'IdMunicipioOrigen': 'Municipio de Origen',
        'DireccionRecidencia': 'Dirección de Residencia',
        'IdDepartamentoG': 'Departamento de Residencia',
        'IdMunicipioG': 'Municipio de Residencia',
        'Telefono1': 'Teléfono Principal',
        'Telefono2': 'Teléfono Secundario',
        'CorreoElectronico': 'Correo Electrónico',
        'NombreContactoEmergencia': 'Contacto de Emergencia',
        'TelefonoContactoEmergencia': 'Teléfono de Emergencia',
        'IdParentesco': 'Parentesco',
        'TipoPersonal': 'Tipo de Personal',
        'IdPlanilla': 'Planilla',
        'IdSucuDepa': 'Departamento',
        'IdPuesto': 'Puesto',
        'InicioLaboral': 'Fecha Inicio Laboral',
        'FechaContrato': 'Fecha de Contrato',
        'FechaPlanilla': 'Fecha de Planilla',
        'Estado': 'Estado',
        // Campos académicos
        'EstadoPrimaria': 'Estado Primaria',
        'IdPlanEstudioPrimaria': 'Plan Primaria',
        'IdNivelAcademicoPrimaria': 'Nivel Primaria',
        'EstadoBasico': 'Estado Básico',
        'IdPlanEstudioBasico': 'Plan Básico',
        'IdNivelAcademicoBasico': 'Nivel Básico',
        'EstadoDiversificado': 'Estado Diversificado',
        'IdPlanEstudioDiversificado': 'Plan Diversificado',
        'IdNivelAcademicoDiversificado': 'Nivel Diversificado',
        'IdCarreraDiversificado': 'Carrera Diversificado',
        'EstadoUniversidad': 'Estado Universidad',
        'IdUniversidad': 'Universidad',
        'IdPlanEstudioUniversitario': 'Plan Universidad',
        'IdNivelAcademicoUnivesitario': 'Nivel Universidad',
        'IdCarreraUniversitaria': 'Carrera Universitaria',
        'EstadoMaestria': 'Estado Maestría',
        'IdUniversidadMaestria': 'Universidad Maestría',
        'IdPlanEstudio': 'Plan Maestría',
        'IdNivelAcademicoMaestria': 'Nivel Maestría',
        'IdMaestria': 'Maestría'
    };
    
    return nombresCampo[campo] || campo;
}

// Formatear valor de campo (convertir IDs a nombres si es necesario)
function formatearValorCampo(campo, valor) {
    if (valor === null || valor === undefined || valor === '') {
        return 'Sin valor';
    }
    
    // Para fechas
    if (campo.includes('Fecha') && valor) {
        try {
            const date = new Date(valor);
            if (isNaN(date.getTime())) {
                return 'Fecha no válida';
            }
            return date.toLocaleDateString('es-ES');
        } catch (e) {
            return 'Fecha no válida';
        }
    }
    
    // Para campos booleanos
    if (typeof valor === 'boolean') {
        return valor ? 'Sí' : 'No';
    }
    
    // Para otros tipos, devolver el valor como string
    return String(valor);
}

// Cargar selectores de datos

// Cargar estados para el empleado (Activo/Inactivo)
async function cargarEstados() {
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdEstado, EstadoPersonal
            FROM EstadoPersonal
            ORDER BY IdEstado
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        let options = '';
        result.forEach(estado => {
            const selected = estado.IdEstado === employeeData.Estado ? 'selected' : '';
            options += `<option value="${estado.IdEstado}" ${selected}>${estado.EstadoPersonal}</option>`;
        });
        
        employeeStatus.innerHTML = options;
        
        // Evento para cambio de estado
        employeeStatus.addEventListener('change', function() {
            const nuevoValor = parseInt(this.value);
            
            if (nuevoValor !== employeeData.Estado) {
                changedFields.Estado = {
                    oldValue: employeeData.Estado,
                    newValue: nuevoValor,
                    section: 'status'
                };
            } else {
                delete changedFields.Estado;
            }
            
            actualizarBotonesGuardar();
        });
        
    } catch (error) {
        console.error('Error al cargar estados:', error);
        mostrarNotificacion('Error al cargar estados del colaborador', 'error');
    }
}

// Cargar estados civiles
async function cargarEstadosCiviles() {
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdCivil, EstadoCivil
            FROM estadocivil
            ORDER BY EstadoCivil
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        let options = '';
        result.forEach(estado => {
            const selected = estado.IdCivil === employeeData.IdEstadoCivil ? 'selected' : '';
            options += `<option value="${estado.IdCivil}" ${selected}>${estado.EstadoCivil}</option>`;
        });
        
        document.getElementById('estadoCivil').innerHTML = options;
        
    } catch (error) {
        console.error('Error al cargar estados civiles:', error);
        mostrarNotificacion('Error al cargar estados civiles', 'error');
    }
}

// Cargar departamentos de Guatemala para origen y residencia
async function cargarDepartamentosGuatemala() {
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdDepartamentoG, NombreDepartamento
            FROM departamentosguatemala
            ORDER BY NombreDepartamento
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        let optionsOrigen = '';
        let optionsResidencia = '';
        
        result.forEach(depto => {
            const selectedOrigen = depto.IdDepartamentoG === employeeData.IdDepartamentoOrigen ? 'selected' : '';
            const selectedResidencia = depto.IdDepartamentoG === employeeData.IdDepartamentoG ? 'selected' : '';
            
            optionsOrigen += `<option value="${depto.IdDepartamentoG}" ${selectedOrigen}>${depto.NombreDepartamento}</option>`;
            optionsResidencia += `<option value="${depto.IdDepartamentoG}" ${selectedResidencia}>${depto.NombreDepartamento}</option>`;
        });
        
        document.getElementById('deptoOrigen').innerHTML = optionsOrigen;
        document.getElementById('deptoResidencia').innerHTML = optionsResidencia;
        
        // Cargar municipios correspondientes
        await Promise.all([
            cargarMunicipiosOrigen(employeeData.IdDepartamentoOrigen),
            cargarMunicipiosResidencia(employeeData.IdDepartamentoG)
        ]);
        
        // Eventos para cambio de departamento
        document.getElementById('deptoOrigen').addEventListener('change', function() {
            cargarMunicipiosOrigen(this.value);
        });
        
        document.getElementById('deptoResidencia').addEventListener('change', function() {
            cargarMunicipiosResidencia(this.value);
        });
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarNotificacion('Error al cargar departamentos de Guatemala', 'error');
    }
}

// Cargar municipios de origen
async function cargarMunicipiosOrigen(idDepartamento) {
    if (!idDepartamento) return;
    
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdMunicipio, NombreMunicipio
            FROM municipios
            WHERE IdDepartamentoG = ?
            ORDER BY NombreMunicipio
        `;
        
        const result = await connection.query(query, [idDepartamento]);
        await connection.close();
        
        let options = '';
        result.forEach(muni => {
            const selected = muni.IdMunicipio === employeeData.IdMunicipioOrigen ? 'selected' : '';
            options += `<option value="${muni.IdMunicipio}" ${selected}>${muni.NombreMunicipio}</option>`;
        });
        
        document.getElementById('muniOrigen').innerHTML = options;
        
    } catch (error) {
        console.error('Error al cargar municipios de origen:', error);
        mostrarNotificacion('Error al cargar municipios', 'error');
    }
}

// Cargar municipios de residencia
async function cargarMunicipiosResidencia(idDepartamento) {
    if (!idDepartamento) return;
    
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdMunicipio, NombreMunicipio
            FROM municipios
            WHERE IdDepartamentoG = ?
            ORDER BY NombreMunicipio
        `;
        
        const result = await connection.query(query, [idDepartamento]);
        await connection.close();
        
        let options = '';
        result.forEach(muni => {
            const selected = muni.IdMunicipio === employeeData.IdMunicipioG ? 'selected' : '';
            options += `<option value="${muni.IdMunicipio}" ${selected}>${muni.NombreMunicipio}</option>`;
        });
        
        document.getElementById('muniResidencia').innerHTML = options;
        
    } catch (error) {
        console.error('Error al cargar municipios de residencia:', error);
        mostrarNotificacion('Error al cargar municipios', 'error');
    }
}
// Cargar tipos de personal
async function cargarTiposPersonal() {
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdTipo, TipoPersonal
            FROM TipoPersonal
            ORDER BY IdTipo
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        let options = '';
        result.forEach(tipo => {
            const selected = tipo.IdTipo === employeeData.TipoPersonal ? 'selected' : '';
            options += `<option value="${tipo.IdTipo}" ${selected}>${tipo.TipoPersonal}</option>`;
        });
        
        document.getElementById('tipoPersonal').innerHTML = options;
        
    } catch (error) {
        console.error('Error al cargar tipos de personal:', error);
        mostrarNotificacion('Error al cargar tipos de personal', 'error');
    }
}

// Cargar planillas
async function cargarPlanillas() {
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdPlanilla, Nombre_Planilla
            FROM planillas
            ORDER BY Nombre_Planilla
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        let options = '';
        result.forEach(planilla => {
            const selected = planilla.IdPlanilla === employeeData.IdPlanilla ? 'selected' : '';
            options += `<option value="${planilla.IdPlanilla}" ${selected}>${planilla.Nombre_Planilla}</option>`;
        });
        
        document.getElementById('planilla').innerHTML = options;
        
    } catch (error) {
        console.error('Error al cargar planillas:', error);
        mostrarNotificacion('Error al cargar planillas', 'error');
    }
}

// Cargar departamentos
async function cargarDepartamentos() {
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdDepartamento, NombreDepartamento
            FROM departamentos
            ORDER BY NombreDepartamento
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        let options = '';
        result.forEach(depto => {
            const selected = depto.IdDepartamento === employeeData.IdSucuDepa ? 'selected' : '';
            options += `<option value="${depto.IdDepartamento}" ${selected}>${depto.NombreDepartamento}</option>`;
        });
        
        document.getElementById('departamento').innerHTML = options;
        
        // Cargar puestos correspondientes al departamento
        await cargarPuestos(employeeData.IdSucuDepa);
        
        // Evento para cambio de departamento
        document.getElementById('departamento').addEventListener('change', function() {
            cargarPuestos(this.value);
        });
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarNotificacion('Error al cargar departamentos', 'error');
    }
}

// Cargar puestos según el departamento
async function cargarPuestos(idDepartamento) {
    if (!idDepartamento) return;
    
    try {
        const connection = await getConnection();
        const query = `
            SELECT p.IdPuesto, pg.Nombre
            FROM Puestos p
            INNER JOIN PuestosGenerales pg ON p.Id_PuestoGeneral = pg.Id_Puesto
            WHERE p.IdDepartamento = ?
            ORDER BY pg.Nombre
        `;
        
        const result = await connection.query(query, [idDepartamento]);
        await connection.close();
        
        let options = '';
        result.forEach(puesto => {
            const selected = puesto.IdPuesto === employeeData.IdPuesto ? 'selected' : '';
            options += `<option value="${puesto.IdPuesto}" ${selected}>${puesto.Nombre}</option>`;
        });
        
        document.getElementById('puesto').innerHTML = options;
        
    } catch (error) {
        console.error('Error al cargar puestos:', error);
        mostrarNotificacion('Error al cargar puestos', 'error');
    }
}

// Cargar estados educativos
async function cargarEstadosEducativos() {
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdEstadoEducacion, DescripcionEstado
            FROM EstadosEducacion
            ORDER BY IdEstadoEducacion
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Crear opciones para cada selector de estado educativo
        const selectores = [
            'estadoPrimaria', 'estadoBasico', 'estadoDiversificado', 
            'estadoUniversidad', 'estadoMaestria'
        ];
        
        const camposEstado = [
            'EstadoPrimaria', 'EstadoBasico', 'EstadoDiversificado', 
            'EstadoUniversidad', 'EstadoMaestria'
        ];
        
        selectores.forEach((selector, index) => {
            let options = '';
            const valorActual = employeeData.infoAcademica ? employeeData.infoAcademica[camposEstado[index]] : null;
            
            result.forEach(estado => {
                const selected = estado.IdEstadoEducacion === valorActual ? 'selected' : '';
                options += `<option value="${estado.IdEstadoEducacion}" ${selected}>${estado.DescripcionEstado}</option>`;
            });
            
            document.getElementById(selector).innerHTML = options;
        });
        
    } catch (error) {
        console.error('Error al cargar estados educativos:', error);
        mostrarNotificacion('Error al cargar estados educativos', 'error');
    }
}

// Cargar planes de estudio
async function cargarPlanesEstudio() {
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdPlanEstudio, Plan
            FROM planestudios
            ORDER BY Plan
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Crear opciones para cada selector de plan de estudio
        const selectores = [
            'planPrimaria', 'planBasico', 'planDiversificado', 
            'planUniversidad', 'planMaestria'
        ];
        
        const camposPlan = [
            'IdPlanEstudioPrimaria', 'IdPlanEstudioBasico', 'IdPlanEstudioDiversificado', 
            'IdPlanEstudioUniversitario', 'IdPlanEstudio'
        ];
        
        selectores.forEach((selector, index) => {
            let options = '<option value="">Seleccione un plan</option>';
            const valorActual = employeeData.infoAcademica ? employeeData.infoAcademica[camposPlan[index]] : null;
            
            result.forEach(plan => {
                const selected = plan.IdPlanEstudio === valorActual ? 'selected' : '';
                options += `<option value="${plan.IdPlanEstudio}" ${selected}>${plan.Plan}</option>`;
            });
            
            document.getElementById(selector).innerHTML = options;
        });
        
    } catch (error) {
        console.error('Error al cargar planes de estudio:', error);
        mostrarNotificacion('Error al cargar planes de estudio', 'error');
    }
}

// Cargar parentescos
async function cargarParentescos() {
    try {
        const connection = await getConnection();
        const query = `
            SELECT IdParentesco, Parentesco
            FROM parentesco
            ORDER BY Parentesco
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        let options = '';
        result.forEach(item => {
            const selected = item.IdParentesco === employeeData.IdParentesco ? 'selected' : '';
            options += `<option value="${item.IdParentesco}" ${selected}>${item.Parentesco}</option>`;
        });
        
        document.getElementById('parentesco').innerHTML = options;
        
    } catch (error) {
        console.error('Error al cargar parentescos:', error);
        mostrarNotificacion('Error al cargar parentescos', 'error');
    }
}

// Habilitar edición para una sección
function habilitarEdicionSeccion(seccion) {
    // Buscar el contenedor de la sección
    const sectionContainer = document.querySelector(`.section-edit-btn[data-section="${seccion}"]`).closest('.form-section');
    
    // Seleccionar todos los inputs, selects y textareas dentro de la sección
    const inputs = sectionContainer.querySelectorAll('input, select, textarea');
    const btn = document.querySelector(`.section-edit-btn[data-section="${seccion}"]`);
    
    // Habilitar cada input
    inputs.forEach(input => {
        input.disabled = false;
        input.dataset.original = input.value;
        
        // Agregar eventos para detectar cambios
        input.addEventListener('change', function() {
            registrarCambio(this);
        });
        
        input.addEventListener('input', function() {
            registrarCambio(this);
        });
    });
    
    // Cambiar texto del botón
    if (btn) {
        btn.innerHTML = '<i class="fas fa-times"></i> Cancelar';
        btn.classList.add('btn-cancelar');
        
        // Cambiar evento para cancelar edición
        btn.onclick = function() {
            cancelarEdicionSeccion(seccion);
        };
    }
}

// Cancelar edición para una sección
function cancelarEdicionSeccion(seccion) {
    // Buscar el contenedor de la sección
    const sectionContainer = document.querySelector(`.section-edit-btn[data-section="${seccion}"]`).closest('.form-section');
    
    // Seleccionar todos los inputs, selects y textareas dentro de la sección
    const inputs = sectionContainer.querySelectorAll('input, select, textarea');
    const btn = document.querySelector(`.section-edit-btn[data-section="${seccion}"]`);
    
    inputs.forEach(input => {
        // Restaurar valor original
        if (input.dataset.original) {
            input.value = input.dataset.original;
        }
        
        input.disabled = true;
        
        // Eliminar cualquier cambio registrado para este campo
        const fieldName = input.id;
        if (changedFields[fieldName]) {
            delete changedFields[fieldName];
        }
    });
    
    // Restaurar botón
    if (btn) {
        btn.innerHTML = '<i class="fas fa-edit"></i> Editar';
        btn.classList.remove('btn-cancelar');
        
        // Restaurar evento para editar
        btn.onclick = function() {
            habilitarEdicionSeccion(seccion);
        };
    }
    
    // Actualizar botones de guardar
    actualizarBotonesGuardar();
}

// Registrar cambio en un campo
function registrarCambio(input) {
    const fieldName = input.id;
    const newValue = input.value;
    const oldValue = originalValues[fieldName]; // Acceder directamente usando el ID del campo
    
    // Si no hay cambio, eliminar del registro
    if (newValue === oldValue || 
        (newValue === '' && (oldValue === null || oldValue === undefined || oldValue === ''))) {
        if (changedFields[fieldName]) {
            delete changedFields[fieldName];
        }
        return;
    }
    
    // Determinar la sección según el campo
    let section = 'personal';
    
    if (fieldName.includes('depto') || fieldName.includes('muni') || fieldName.includes('direccion')) {
        section = 'location';
    } else if (fieldName.includes('telefono') || fieldName.includes('email') || fieldName.includes('contacto') || fieldName.includes('parentesco')) {
        section = 'contact';
    } else if (fieldName.includes('planilla') || fieldName.includes('puesto') || fieldName.includes('inicio') || fieldName.includes('fecha') || fieldName.includes('departamento')) {
        section = 'work';
    } else if (fieldName.includes('primaria') || fieldName.includes('basico') || fieldName.includes('diversificado') || fieldName.includes('universidad') || fieldName.includes('maestria')) {
        section = 'academic';
    }
    
    // Guardar el cambio
    changedFields[fieldName] = {
        oldValue: oldValue,
        newValue: newValue,
        section: section
    };
    
    // Actualizar botones de guardar
    actualizarBotonesGuardar();
}

// Actualizar estado de los botones de guardar
function actualizarBotonesGuardar() {
    const hayCambios = Object.keys(changedFields).length > 0;
    
    // Botón de guardar todo
    btnGuardarTodo.disabled = !hayCambios;
    
    if (hayCambios) {
        btnGuardarTodo.classList.add('btn-save-active');
    } else {
        btnGuardarTodo.classList.remove('btn-save-active');
    }
}

// Mostrar modal de confirmación
function mostrarModalConfirmacion() {
    // Verificar si hay cambios
    if (Object.keys(changedFields).length === 0) {
        mostrarNotificacion('No hay cambios para guardar', 'info');
        return;
    }
    
    // Generar resumen de cambios
    const changesSummary = document.getElementById('changesSummary');
    let summaryHTML = '';
    
    for (const field in changedFields) {
        const change = changedFields[field];
        
        // Mejorar la forma de mostrar los valores antiguos
        const oldValueFormatted = change.oldValue !== null && change.oldValue !== undefined 
            ? formatearValorCampo(field, change.oldValue) 
            : "Sin valor previo";
        
        const newValueFormatted = formatearValorCampo(field, change.newValue);
        
        summaryHTML += `
            <div class="change-item">
                <div class="change-field">${obtenerNombreCampo(field)}</div>
                <div class="change-values">
                    <span class="change-old">${oldValueFormatted}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span class="change-new">${newValueFormatted}</span>
                </div>
            </div>
        `;
    }
    
    changesSummary.innerHTML = summaryHTML;
    
    // Mostrar modal
    confirmModal.classList.add('active');
}

// Guardar cambios
// Guardar cambios
async function guardarCambios() {
    try {
        mostrarCargando(true);
        
        const connection = await getConnection();
        
        // Mapeo entre IDs de campos del formulario y nombres de columnas en BD
        const fieldMapping = {
            'primerNombre': 'PrimerNombre',
            'segundoNombre': 'SegundoNombre',
            'tercerNombre': 'TercerNombre',
            'primerApellido': 'PrimerApellido',
            'segundoApellido': 'SegundoApellido',
            'dpi': 'DPI',
            'fechaNacimiento': 'FechaNacimiento',
            'estadoCivil': 'IdEstadoCivil',
            'hijos': 'Hijos',
            'deptoOrigen': 'IdDepartamentoOrigen',
            'muniOrigen': 'IdMunicipioOrigen',
            'direccionResidencia': 'DireccionRecidencia',
            'deptoResidencia': 'IdDepartamentoG',
            'muniResidencia': 'IdMunicipioG',
            'telefono1': 'Telefono1',
            'telefono2': 'Telefono2',
            'email': 'CorreoElectronico',
            'nombreContacto': 'NombreContactoEmergencia',
            'telefonoContacto': 'TelefonoContactoEmergencia',
            'parentesco': 'IdParentesco',
            'tipoPersonal': 'TipoPersonal',
            'planilla': 'IdPlanilla',
            'departamento': 'IdSucuDepa',
            'puesto': 'IdPuesto',
            'inicioLaboral': 'InicioLaboral',
            'fechaContrato': 'FechaContrato',
            'fechaPlanilla': 'FechaPlanilla',
            'employeeStatus': 'Estado',
            // Campos académicos
            'estadoPrimaria': 'EstadoPrimaria',
            'planPrimaria': 'IdPlanEstudioPrimaria',
            'nivelPrimaria': 'IdNivelAcademicoPrimaria',
            'estadoBasico': 'EstadoBasico',
            'planBasico': 'IdPlanEstudioBasico',
            'nivelBasico': 'IdNivelAcademicoBasico',
            'estadoDiversificado': 'EstadoDiversificado',
            'planDiversificado': 'IdPlanEstudioDiversificado',
            'nivelDiversificado': 'IdNivelAcademicoDiversificado',
            'gradoDiversificado': 'IdCarreraDiversificado',
            'estadoUniversidad': 'EstadoUniversidad',
            'universidad': 'IdUniversidad',
            'planUniversidad': 'IdPlanEstudioUniversitario',
            'nivelUniversidad': 'IdNivelAcademicoUnivesitario',
            'carreraUniversidad': 'IdCarreraUniversitaria',
            'estadoMaestria': 'EstadoMaestria',
            'universidadMaestria': 'IdUniversidadMaestria',
            'planMaestria': 'IdPlanEstudio',
            'trimestreMaestria': 'IdNivelAcademicoMaestria',
            'nombreMaestria': 'IdMaestria'
        };
        
        // SQL para actualizar tabla de personal
        const updateFields = [];
        const updateValues = [];
        
        // SQL para actualizar tabla de información académica
        const updateAcademicFields = [];
        const updateAcademicValues = [];
        
        // Registros para el historial
        const historialRegistros = [];
        
        // Fecha actual para el historial
        const fechaActual = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        // Log de los cambios para depuración
        console.log("Campos cambiados:", changedFields);
        
        // Procesar cada campo cambiado
        for (const fieldName in changedFields) {
            const { oldValue, newValue, section } = changedFields[fieldName];
            
            // Obtener el nombre real de la columna en BD
            const dbFieldName = fieldMapping[fieldName] || fieldName;
            
            console.log(`Procesando campo: ${fieldName} => ${dbFieldName}`);
            
            // Determinar a qué tabla pertenece el campo
            if (dbFieldName.includes('EstadoPrimaria') || 
                dbFieldName.includes('IdPlanEstudio') || 
                dbFieldName.includes('IdNivelAcademico') || 
                dbFieldName.includes('IdCarrera') || 
                dbFieldName.includes('IdUniversidad') || 
                dbFieldName.includes('IdMaestria')) {
                // Campo académico
                updateAcademicFields.push(`${dbFieldName} = ?`);
                
                // Formatear adecuadamente el valor según el tipo
                if (dbFieldName.includes('Fecha')) {
                    // Para fechas
                    updateAcademicValues.push(newValue ? new Date(newValue).toISOString().split('T')[0] : null);
                } else {
                    // Para otros campos
                    updateAcademicValues.push(newValue === '' ? null : newValue);
                }
            } else {
                // Campo de personal
                updateFields.push(`${dbFieldName} = ?`);
                
                // Formatear adecuadamente el valor según el tipo
                if (dbFieldName.includes('Fecha') || dbFieldName === 'InicioLaboral') {
                    // Para fechas
                    updateValues.push(newValue ? new Date(newValue).toISOString().split('T')[0] : null);
                } else {
                    // Para otros campos
                    updateValues.push(newValue === '' ? null : newValue);
                }
            }
            
            // Registrar en historial
            historialRegistros.push({
                IdPersonal: employeeData.IdPersonal,
                Seccion: section,
                Campo: dbFieldName,
                ValorAnterior: oldValue,
                ValorNuevo: newValue,
                FechaCambio: fechaActual,
                IdUsuario: currentUser.IdPersonal
            });
        }
        
        // Actualizar tabla personal si hay campos
        if (updateFields.length > 0) {
            const updateQuery = `
                UPDATE personal 
                SET ${updateFields.join(', ')} 
                WHERE IdPersonal = ?
            `;
            
            updateValues.push(employeeData.IdPersonal);
            
            console.log("Query personal:", updateQuery);
            console.log("Valores:", updateValues);
            
            try {
                await connection.query(updateQuery, updateValues);
                console.log("Actualización de personal exitosa");
            } catch (error) {
                console.error("Error al actualizar personal:", error);
                throw error;
            }
        }
        
        // Actualizar tabla InfoAcademica si hay campos
        if (updateAcademicFields.length > 0) {
            // Verificar si existe un registro para este empleado
            const checkQuery = `
                SELECT COUNT(*) AS count 
                FROM InfoAcademica 
                WHERE IdPersonal = ?
            `;
            
            const checkResult = await connection.query(checkQuery, [employeeData.IdPersonal]);
            const exists = checkResult[0].count > 0;
            
            if (exists) {
                // Actualizar registro existente
                const updateAcademicQuery = `
                    UPDATE InfoAcademica 
                    SET ${updateAcademicFields.join(', ')} 
                    WHERE IdPersonal = ?
                `;
                
                updateAcademicValues.push(employeeData.IdPersonal);
                
                console.log("Query académica:", updateAcademicQuery);
                console.log("Valores académicos:", updateAcademicValues);
                
                try {
                    await connection.query(updateAcademicQuery, updateAcademicValues);
                    console.log("Actualización académica exitosa");
                } catch (error) {
                    console.error("Error al actualizar info académica:", error);
                    throw error;
                }
            } else {
                // Crear nuevo registro
                const academicFields = updateAcademicFields.map(field => field.split(' = ')[0]);
                const placeholders = academicFields.map(() => '?');
                
                const insertAcademicQuery = `
                    INSERT INTO InfoAcademica (IdPersonal, ${academicFields.join(', ')})
                    VALUES (?, ${placeholders.join(', ')})
                `;
                
                const insertValues = [employeeData.IdPersonal, ...updateAcademicValues];
                
                console.log("Query inserción académica:", insertAcademicQuery);
                console.log("Valores inserción:", insertValues);
                
                try {
                    await connection.query(insertAcademicQuery, insertValues);
                    console.log("Inserción académica exitosa");
                } catch (error) {
                    console.error("Error al insertar info académica:", error);
                    throw error;
                }
            }
        }
        
        // Insertar registros en el historial
        if (historialRegistros.length > 0) {
            for (const registro of historialRegistros) {
                const historialQuery = `
                    INSERT INTO HistorialCambios 
                    (IdPersonal, Seccion, Campo, ValorAnterior, ValorNuevo, FechaCambio, IdUsuario)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                
                const historialValues = [
                    registro.IdPersonal,
                    registro.Seccion,
                    registro.Campo,
                    registro.ValorAnterior,
                    registro.ValorNuevo,
                    registro.FechaCambio,
                    registro.IdUsuario
                ];
                
                try {
                    await connection.query(historialQuery, historialValues);
                    console.log("Inserción en historial exitosa");
                } catch (error) {
                    console.error("Error al insertar en historial:", error);
                    // Continuamos incluso si falla un registro del historial
                }
            }
        }
        
        await connection.close();
        
        // Actualizar datos del empleado
        await cargarDatosColaborador(employeeData.IdPersonal);
        
        // Limpiar cambios registrados
        changedFields = {};
        actualizarBotonesGuardar();
        
        mostrarCargando(false);
        mostrarNotificacion('Cambios guardados correctamente', 'success');
        
        // Ocultar modal de confirmación
        confirmModal.classList.remove('active');
        
    } catch (error) {
        console.error('Error al guardar cambios:', error);
        mostrarNotificacion('Error al guardar los cambios: ' + (error.message || 'Revise la consola para más detalles'), 'error');
        mostrarCargando(false);
    }
}
// Actualizar foto del colaborador
async function actualizarFoto(file) {
    try {
        mostrarCargando(true);
        
        // Leer archivo como un ArrayBuffer
        const buffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
        
        // Convertir ArrayBuffer a Buffer para guardar en la base de datos
        const fileBuffer = Buffer.from(buffer);
        
        const connection = await getConnection();
        
        // Verificar si ya existe una foto
        const checkQuery = `
            SELECT COUNT(*) AS count
            FROM FotosPersonal
            WHERE IdPersonal = ?
        `;
        
        const checkResult = await connection.query(checkQuery, [employeeData.IdPersonal]);
        const exists = checkResult[0].count > 0;
        
        if (exists) {
            // Actualizar foto existente
            const updateQuery = `
                UPDATE FotosPersonal
                SET Foto = ?
                WHERE IdPersonal = ?
            `;
            
            await connection.query(updateQuery, [fileBuffer, employeeData.IdPersonal]);
        } else {
            // Insertar nueva foto
            const insertQuery = `
                INSERT INTO FotosPersonal (IdPersonal, Foto)
                VALUES (?, ?)
            `;
            
            await connection.query(insertQuery, [employeeData.IdPersonal, fileBuffer]);
        }
        
        // Registrar cambio en el historial
        const fechaActual = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const historialQuery = `
            INSERT INTO HistorialCambios 
            (IdPersonal, Seccion, Campo, ValorAnterior, ValorNuevo, FechaCambio, IdUsuario)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        await connection.query(historialQuery, [
            employeeData.IdPersonal,
            'personal',
            'Foto',
            'Foto anterior',
            'Foto actualizada',
            fechaActual,
            currentUser.IdPersonal
        ]);
        
        await connection.close();
        
        // Actualizar la interfaz
        await cargarDatosColaborador(employeeData.IdPersonal);
        
        mostrarCargando(false);
        mostrarNotificacion('Foto actualizada correctamente', 'success');
        
        // Ocultar modal
        photoModal.classList.remove('active');
        
    } catch (error) {
        console.error('Error al actualizar foto:', error);
        mostrarNotificacion('Error al actualizar la foto', 'error');
        mostrarCargando(false);
    }
}

// Configurar ventana modal para cambio de foto
function configurarModalFoto() {
    const photoUpload = document.getElementById('photoUpload');
    const currentPhoto = document.getElementById('currentPhoto');
    const photoPreview = document.getElementById('photoPreview');
    const fileName = document.getElementById('fileName');
    const savePhotoBtn = document.getElementById('savePhotoBtn');
    const cancelPhotoBtn = document.getElementById('cancelPhotoBtn');
    const closePhotoModal = document.getElementById('closePhotoModal');
    
    // Mostrar foto actual
    currentPhoto.src = employeePhoto.src;
    
    // Evento para selección de archivo
    photoUpload.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            
            // Verificar tipo de archivo
            if (!file.type.startsWith('image/')) {
                mostrarNotificacion('Por favor seleccione un archivo de imagen válido', 'error');
                this.value = '';
                fileName.textContent = 'No se ha seleccionado ningún archivo';
                photoPreview.style.display = 'none';
                savePhotoBtn.disabled = true;
                return;
            }
            
            // Verificar tamaño (máximo 2MB)
            if (file.size > 2 * 1024 * 1024) {
                mostrarNotificacion('La imagen no debe exceder los 2MB', 'error');
                this.value = '';
                fileName.textContent = 'No se ha seleccionado ningún archivo';
                photoPreview.style.display = 'none';
                savePhotoBtn.disabled = true;
                return;
            }
            
            // Mostrar nombre del archivo
            fileName.textContent = file.name;
            
            // Mostrar vista previa
            const reader = new FileReader();
            reader.onload = function(e) {
                photoPreview.src = e.target.result;
                photoPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
            
            // Habilitar botón de guardar
            savePhotoBtn.disabled = false;
        }
    });
    
    // Guardar foto
    savePhotoBtn.addEventListener('click', function() {
        if (photoUpload.files && photoUpload.files[0]) {
            actualizarFoto(photoUpload.files[0]);
        }
    });
    
    // Cerrar modal
    cancelPhotoBtn.addEventListener('click', function() {
        photoModal.classList.remove('active');
        photoUpload.value = '';
        fileName.textContent = 'No se ha seleccionado ningún archivo';
        photoPreview.style.display = 'none';
        savePhotoBtn.disabled = true;
    });
    
    closePhotoModal.addEventListener('click', function() {
        photoModal.classList.remove('active');
        photoUpload.value = '';
        fileName.textContent = 'No se ha seleccionado ningún archivo';
        photoPreview.style.display = 'none';
        savePhotoBtn.disabled = true;
    });
}

// Configurar navegación entre pestañas
function configurarTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remover clase activa de todas las pestañas
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            
            // Agregar clase activa a la pestaña seleccionada
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(`tab-${tabId}`).classList.add('active');
            
            // Actualizar pestaña actual
            currentTab = tabId;
        });
    });
}

// Configurar eventos de los botones de edición
function configurarBotonesEdicion() {
    // Botones de edición por sección
    sectionEditBtns.forEach(btn => {
        const section = btn.getAttribute('data-section');
        
        // Verificar que todos los inputs dentro de la sección tengan el atributo data-section
        const sectionInputs = btn.closest('.form-section').querySelectorAll('input, select, textarea');
        sectionInputs.forEach(input => {
            input.setAttribute('data-section', section);
        });
        
        // Evento click para habilitar edición
        btn.addEventListener('click', function(e) {
            e.preventDefault(); // Evitar comportamiento predeterminado
            habilitarEdicionSeccion(section);
        });
    });
    
    // Botón de editar foto
    btnEditPhoto.addEventListener('click', function() {
        if (!canEdit) {
            mostrarNotificacion('No tiene permisos para editar', 'error');
            return;
        }
        
        // Configurar y mostrar modal
        configurarModalFoto();
        photoModal.classList.add('active');
    });
    
    // Botón de guardar todo
    btnGuardarTodo.addEventListener('click', function() {
        if (!canEdit) {
            mostrarNotificacion('No tiene permisos para guardar cambios', 'error');
            return;
        }
        
        mostrarModalConfirmacion();
    });
    
    // Botones del modal de confirmación
    document.getElementById('confirmSaveBtn').addEventListener('click', function() {
        guardarCambios();
    });
    
    document.getElementById('cancelConfirmBtn').addEventListener('click', function() {
        confirmModal.classList.remove('active');
    });
    
    document.getElementById('closeConfirmModal').addEventListener('click', function() {
        confirmModal.classList.remove('active');
    });
}

// Configurar evento para volver a la pantalla de búsqueda
function configurarBotonVolver() {
    btnVolver.addEventListener('click', function() {
        // Verificar si hay cambios sin guardar
        if (Object.keys(changedFields).length > 0) {
            Swal.fire({
                title: '¿Desea salir sin guardar?',
                text: 'Hay cambios que no se han guardado. ¿Está seguro que desea salir?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#FF7F27',
                cancelButtonColor: '#6C757D',
                confirmButtonText: 'Sí, salir',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = 'BusquedaP.html';
                }
            });
        } else {
            window.location.href = 'BusquedaP.html';
        }
    });
}

// Configurar eventos cuando se hace clic fuera de los modales
function configurarClicFueraModal() {
    photoModal.addEventListener('click', function(event) {
        if (event.target === photoModal) {
            photoModal.classList.remove('active');
        }
    });
    
    confirmModal.addEventListener('click', function(event) {
        if (event.target === confirmModal) {
            confirmModal.classList.remove('active');
        }
    });
}

// Inicializar la aplicación
async function inicializar() {
    try {
        // Obtener ID del empleado de la URL
        const urlParams = new URLSearchParams(window.location.search);
        const employeeId = urlParams.get('id');
        
        if (!employeeId) {
            mostrarNotificacion('ID de colaborador no especificado', 'error');
            setTimeout(() => {
                window.location.href = 'BusquedaP.html';
            }, 2000);
            return;
        }
        
        // Verificar permisos de edición
        canEdit = await verificarPermisoEdicion();
        
        if (!canEdit) {
            // Si no tiene permisos, mostrar mensaje y deshabilitar botones de edición
            mostrarNotificacion('No tiene permisos para editar. Vista en modo de solo lectura.', 'warning');
            
            sectionEditBtns.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = 0.5;
                btn.style.cursor = 'not-allowed';
            });
            
            btnEditPhoto.disabled = true;
            btnGuardarTodo.disabled = true;
        }
        
        // Cargar datos del colaborador
        await cargarDatosColaborador(employeeId);
        
        // Configurar componentes de la interfaz
        configurarTabs();
        configurarBotonesEdicion();
        configurarBotonVolver();
        configurarClicFueraModal();
        
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        mostrarNotificacion('Error al inicializar la aplicación', 'error');
    }
}

// Iniciar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', inicializar);