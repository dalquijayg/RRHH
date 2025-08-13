const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');
const { jsPDF } = require('jspdf');

// ===== VARIABLES GLOBALES =====
let currentDate = new Date();
let selectedEmployee = null;
let selectedShifts = [];
let salaryRates = {};
let isCapitalino = false;
let allCollaborators = [];
let payrollCollaborators = []; // Array para almacenar colaboradores en la planilla
let currentShifts = [];
let diasEspeciales = [];
let currentDepartamentoId = null;
let fechasSemanaSanta = [];
let planillaConfig = {
    fechaInicio: null,
    fechaFin: null,
    confirmada: false
};

// ===== INICIALIZACIÓN PRINCIPAL - MEJORADA CON PROGRESO =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Iniciando aplicación con progreso mejorado...');
    
    try {
        mostrarFechaActual();
        await cargarTarifasSalarios();
        generarFechasSemanaSanta();
        await cargarInformacionDepartamento();
        await actualizarVisibilidadBotonPDF();
        inicializarEventos();
        inicializarPlanillaConProgreso(); 
        
        actualizarVisibilidadAcciones();
        const botonPDF = document.getElementById('descargarPDF');
        if (botonPDF) {
            botonPDF.addEventListener('click', generarPDFPlanilla);
        }
        const btnAyuda = document.getElementById('btnAyuda');
        if (btnAyuda) {
            btnAyuda.addEventListener('click', mostrarAyudaSistema);
        }
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        mostrarError('Error al inicializar la aplicación');
    }
});

// ⭐ FUNCIÓN MEJORADA PARA INICIALIZAR CON PROGRESO
function inicializarPlanillaConProgreso() {
    // Ocultar TODOS los elementos hasta que se configure
    ocultarElementosHastaConfigurar();
    configurarFechasMinimas();
    // Aplicar modo configuración al contenedor principal
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        mainContainer.classList.add('config-mode');
        mainContainer.classList.remove('normal-mode');
    }
    
    // Mostrar paso inicial
    actualizarProgresoVisual('config');
    
    // Solo mostrar la sección de configuración
    document.getElementById('payrollSection').style.display = 'none';
    document.getElementById('collaboratorsSection').style.display = 'none';
    document.getElementById('welcomeState').style.display = 'none';
    
    // Mejorar el botón de confirmación
    mejorarBotonConfirmacion();
    
    actualizarVistaPlanilla();
}

// ⭐ FUNCIÓN PARA OCULTAR ELEMENTOS HASTA CONFIGURAR
function ocultarElementosHastaConfigurar() {
    // Ocultar panel izquierdo completo
    const leftPanel = document.querySelector('.left-panel');
    if (leftPanel) {
        leftPanel.style.display = 'none';
    }
    
    // Ocultar panel derecho completo  
    const rightPanel = document.querySelector('.right-panel');
    if (rightPanel) {
        rightPanel.style.display = 'none';
    }
    
    // Cambiar el layout del contenedor principal para que solo muestre la configuración
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        mainContainer.style.gridTemplateColumns = '1fr';
        mainContainer.style.justifyContent = 'center';
        mainContainer.style.alignItems = 'start';
        mainContainer.style.paddingTop = '2rem';
    }
    
    // Asegurar que la sección de configuración esté visible y centrada
    const payrollTypeSection = document.querySelector('.payroll-type-section');
    if (payrollTypeSection) {
        payrollTypeSection.style.display = 'block';
        payrollTypeSection.style.maxWidth = '800px';
        payrollTypeSection.style.margin = '0 auto';
    }
}

// ⭐ FUNCIÓN PARA MOSTRAR ELEMENTOS DESPUÉS DE CONFIGURAR
function mostrarElementosDespuesDeConfigurarConAnimacion() {
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    
    if (leftPanel) {
        leftPanel.style.display = 'flex';
        leftPanel.classList.add('panel-fade-in');
    }
    
    if (rightPanel) {
        rightPanel.style.display = 'flex';
        rightPanel.classList.add('panel-fade-in');
    }
    
    // Restaurar el layout normal del contenedor principal
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        mainContainer.style.gridTemplateColumns = '320px 1fr';
        mainContainer.style.justifyContent = '';
        mainContainer.style.alignItems = '';
        mainContainer.style.paddingTop = '';
    }
}

// ⭐ FUNCIÓN PARA ACTUALIZAR PROGRESO VISUAL
function actualizarProgresoVisual(step) {
    const steps = ['config', 'collaborators', 'shifts', 'generate'];
    const stepElements = steps.map(s => document.getElementById(`step-${s}`));
    const connectors = [
        document.getElementById('connector-1'),
        document.getElementById('connector-2'),
        document.getElementById('connector-3')
    ];
    
    // Encontrar el índice del paso actual
    const currentIndex = steps.indexOf(step);
    
    // Actualizar cada paso
    stepElements.forEach((element, index) => {
        if (!element) return;
        
        // Remover todas las clases
        element.classList.remove('active', 'completed');
        
        if (index < currentIndex) {
            // Pasos completados
            element.classList.add('completed');
        } else if (index === currentIndex) {
            // Paso actual
            element.classList.add('active');
        }
        // Los pasos futuros no tienen clase (estado por defecto)
    });
    
    // Actualizar conectores
    connectors.forEach((connector, index) => {
        if (!connector) return;
        
        // Remover todas las clases
        connector.classList.remove('active', 'completed');
        
        if (index < currentIndex) {
            // Conectores completados
            connector.classList.add('completed');
        } else if (index === currentIndex) {
            // Conector actual
            connector.classList.add('active');
        }
    });
}

// ⭐ FUNCIÓN PARA MEJORAR EL BOTÓN DE CONFIRMACIÓN
function mejorarBotonConfirmacion() {
    const confirmarBtn = document.getElementById('confirmarPlanilla');
    if (confirmarBtn) {
        confirmarBtn.classList.add('btn-confirm-enhanced');
        
        // Agregar event listener para validación en tiempo real
        ['tipoQuincena', 'mesPlanilla', 'anioPlanilla'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('form-control', 'enhanced');
                element.addEventListener('change', validarFormularioConProgreso);
            }
        });
    }
}

// ⭐ VALIDACIÓN MEJORADA CON PROGRESO VISUAL
function validarFormularioConProgreso() {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    const confirmarBtn = document.getElementById('confirmarPlanilla');
    
    const todosCompletos = fechaInicio && fechaFin;
    let esValido = false;
    
    if (todosCompletos) {
        const validacion = validarRangoFechas(fechaInicio, fechaFin);
        esValido = validacion.valido;
        
        if (!validacion.valido) {
            // Mostrar error temporalmente
            mostrarErrorTemporal(validacion.mensaje);
        }
    }
    
    if (confirmarBtn) {
        confirmarBtn.disabled = !esValido;
        
        if (esValido) {
            confirmarBtn.classList.add('ready');
            confirmarBtn.innerHTML = `
                <i class="fas fa-rocket"></i>
                <span>¡Iniciar Planilla!</span>
            `;
        } else {
            confirmarBtn.classList.remove('ready');
            confirmarBtn.innerHTML = `
                <i class="fas fa-cog"></i>
                <span>${todosCompletos ? 'Fechas inválidas' : 'Seleccione fechas'}</span>
            `;
        }
    }
}
function mostrarErrorTemporal(mensaje) {
    const confirmarBtn = document.getElementById('confirmarPlanilla');
    if (confirmarBtn) {
        confirmarBtn.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span style="color: #ef4444;">${mensaje}</span>
        `;
        
        setTimeout(() => {
            validarFormularioConProgreso();
        }, 3000);
    }
}
function configurarFechasMinimas() {
    const fechaInicio = document.getElementById('fechaInicio');
    const fechaFin = document.getElementById('fechaFin');
    if (fechaInicio && fechaFin) {
        fechaInicio.addEventListener('change', () => {
            if (fechaInicio.value) {
                fechaFin.min = fechaInicio.value;
                if (fechaFin.value && fechaFin.value < fechaInicio.value) {
                    fechaFin.value = '';
                }
            }
        });
    }
}

function validarRangoFechas(fechaInicio, fechaFin) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const diferenciaDias = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));
    
    if (inicio >= fin) {
        return {
            valido: false,
            mensaje: 'La fecha de fin debe ser posterior a la fecha de inicio'
        };
    }
    
    if (diferenciaDias > 31) {
        return {
            valido: false,
            mensaje: 'El período no puede ser mayor a 31 días'
        };
    }
    
    if (diferenciaDias < 1) {
        return {
            valido: false,
            mensaje: 'El período debe ser de al menos 1 día'
        };
    }
    
    return { valido: true };
}
function formatearPeriodo(fechaInicio, fechaFin) {
    // ✅ AGREGAR 'T00:00:00' para evitar problemas de zona horaria
    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(fechaFin + 'T00:00:00');
    
    const formatoFecha = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const inicioTexto = inicio.toLocaleDateString('es-GT', formatoFecha);
    const finTexto = fin.toLocaleDateString('es-GT', formatoFecha);
    
    return `${inicioTexto} a ${finTexto}`;
}
// Mostrar fecha actual en el header
function mostrarFechaActual() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
}

async function cargarInformacionDepartamento() {
    try {
        // Obtener datos del usuario logueado
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData) {
            Swal.fire({
                icon: 'error',
                title: 'Sesión expirada',
                text: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.',
                confirmButtonColor: '#1e40af'
            }).then(() => {
                window.location.href = '../Login.html';
            });
            return;
        }

        // Obtener información del departamento del usuario
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento, 
                Regiones.IdRegion, 
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

        if (result.length === 0) {
            throw new Error('No se encontró información del departamento del usuario');
        }

        const departamentoInfo = result[0];
        
        // Configurar variables globales
        currentDepartamentoId = departamentoInfo.IdDepartamento;
        isCapitalino = departamentoInfo.IdRegion === 3;

        // Cargar días especiales del departamento
        await cargarDiasEspeciales(currentDepartamentoId);

        // Mostrar información del departamento en la interfaz
        mostrarInformacionDepartamento(departamentoInfo, userData);

        console.log('Información del departamento cargada:', departamentoInfo);

    } catch (error) {
        console.error('Error al cargar información del departamento:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error de configuración',
            text: 'No se pudo cargar la información del departamento. Contacte al administrador.',
            confirmButtonColor: '#1e40af'
        });
    }
}

function mostrarInformacionDepartamento(departamentoInfo, userData) {
    // Buscar o crear el contenedor central del header
    let headerCenter = document.querySelector('.header-center');
    if (!headerCenter) {
        // Crear el contenedor central si no existe
        headerCenter = document.createElement('div');
        headerCenter.className = 'header-center';
        
        // Insertar en el header-container después del header-brand
        const headerContainer = document.querySelector('.header-container');
        const headerBrand = document.querySelector('.header-brand');
        headerContainer.insertBefore(headerCenter, headerBrand.nextSibling);
    }

    const regionTexto = isCapitalino ? 'Región Capitalina' : `Región ${departamentoInfo.NombreRegion}`;
    const regionClass = isCapitalino ? 'capitalino' : 'regional';

    headerCenter.innerHTML = `
        <div class="department-info-container">
            <div class="department-main-info">
                <i class="fas fa-building" style="color: rgba(255, 255, 255, 0.8); font-size: 1.1rem;"></i>
                <span class="department-name">${departamentoInfo.NombreDepartamento}</span>
                <span class="department-badge-header ${regionClass}">${regionTexto}</span>
            </div>
        </div>
    `;
}

async function cargarTarifasSalarios() {
    try {
        const connection = await connectionString();
        const currentYear = new Date().getFullYear();
        
        const result = await connection.query(`
            SELECT
                SalarioTiempoParcial.EsCapital, 
                SalarioTiempoParcial.SalarioXhora, 
                SalarioTiempoParcial.SalarioXturno, 
                SalarioTiempoParcial.Turno
            FROM
                SalarioTiempoParcial
            WHERE
                SalarioTiempoParcial.Anio = ?
        `, [currentYear]);
        
        await connection.close();
        
        // Organizar tarifas por región y turno
        salaryRates = {};
        result.forEach(rate => {
            const region = rate.EsCapital === 1 ? 'capitalino' : 'regional';
            const turno = rate.Turno;
            
            if (!salaryRates[region]) {
                salaryRates[region] = {};
            }
            
            salaryRates[region][turno] = {
                salarioXhora: parseFloat(rate.SalarioXhora),
                salarioXturno: parseFloat(rate.SalarioXturno)
            };
        });
        
        console.log('Tarifas cargadas:', salaryRates);
    } catch (error) {
        console.error('Error al cargar tarifas de salarios:', error);
        mostrarError('Error al cargar las tarifas de salarios');
    }
}

// ⭐ FUNCIÓN MEJORADA PARA CONFIRMAR CON TRANSICIONES
async function confirmarSeleccionPlanillaConTransiciones() {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    
    // Validaciones básicas
    if (!fechaInicio || !fechaFin) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas incompletas',
            text: 'Por favor seleccione ambas fechas antes de continuar.',
            confirmButtonColor: '#1e40af'
        });
        return;
    }
    
    const validacion = validarRangoFechas(fechaInicio, fechaFin);
    if (!validacion.valido) {
        Swal.fire({
            icon: 'error',
            title: 'Rango de fechas inválido',
            text: validacion.mensaje,
            confirmButtonColor: '#ef4444'
        });
        return;
    }
    
    // Validar que el departamento esté cargado
    if (!currentDepartamentoId) {
        Swal.fire({
            icon: 'error',
            title: 'Error de configuración',
            text: 'No se ha podido cargar la información del departamento. Por favor, recargue la página.',
            confirmButtonColor: '#1e40af'
        });
        return;
    }
    
    // ✅ NUEVA VALIDACIÓN: Verificar planillas pendientes de subir comprobante
    mostrarEstadoCarga('Verificando planillas pendientes...');
    
    try {
        const planillaPendienteComprobante = await verificarPlanillasPendientesComprobante(currentDepartamentoId);
        
        if (planillaPendienteComprobante) {
            ocultarEstadoCarga();
            await mostrarErrorPlanillaPendienteComprobante(planillaPendienteComprobante);
            return;
        }
        
        // Continuar con la verificación de período existente
        mostrarEstadoCarga('Verificando disponibilidad de período...');
        
        const periodoExistente = await verificarPeriodoExistente(fechaInicio, fechaFin, currentDepartamentoId);
        
        if (periodoExistente) {
            ocultarEstadoCarga();
            await mostrarErrorPeriodoDuplicado(periodoExistente, fechaInicio, fechaFin);
            return;
        }
        
        // Si todo está bien, continuar con el proceso normal...
        planillaConfig = {
            fechaInicio: fechaInicio,
            fechaFin: fechaFin,
            confirmada: true
        };
        
        actualizarProgresoVisual('collaborators');
        mostrarEstadoCarga('Configuración confirmada. Cargando colaboradores...');
        
        await transicionAModoNormal();
        actualizarVistaPlanillaConfirmada();
        mostrarInformacionEnHeader();
        
        const payrollTypeSection = document.querySelector('.payroll-type-section');
        if (payrollTypeSection) {
            payrollTypeSection.classList.add('panel-fade-out');
            setTimeout(() => {
                payrollTypeSection.classList.add('hidden');
                payrollTypeSection.style.display = 'none';
            }, 500);
        }
        
        await cargarColaboradoresConProgreso();
        ocultarEstadoCarga();
        
    } catch (error) {
        console.error('Error al verificar restricciones:', error);
        ocultarEstadoCarga();
        
        Swal.fire({
            icon: 'error',
            title: 'Error de verificación',
            text: 'No se pudo verificar las restricciones. Intente nuevamente.',
            confirmButtonColor: '#ef4444'
        });
    }
}
function formatearPeriodoDesdeString(periodoString) {
    try {
        const periodo = parsearPeriodoDesdeBD(periodoString);
        const fechaInicio = new Date(periodo.inicio + 'T00:00:00');
        const fechaFin = new Date(periodo.fin + 'T00:00:00');
        
        const formatoFecha = { day: '2-digit', month: '2-digit', year: 'numeric' };
        const inicioTexto = fechaInicio.toLocaleDateString('es-GT', formatoFecha);
        const finTexto = fechaFin.toLocaleDateString('es-GT', formatoFecha);
        
        return `${inicioTexto} a ${finTexto}`;
    } catch (error) {
        console.error('Error al formatear período:', error);
        return periodoString; // Devolver original si hay error
    }
}
async function mostrarErrorPlanillaPendienteComprobante(planillaPendiente) {
    const periodoTexto = formatearPeriodoDesdeString(planillaPendiente.PeriodoPago);
    
    await Swal.fire({
        icon: 'warning',
        title: 'Comprobante Pendiente de Subir',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%); padding: 20px; border-radius: 12px; border: 2px solid #f59e0b; margin-bottom: 20px; box-shadow: var(--shadow-large);">
                    <h4 style="color: #92400e; margin-bottom: 15px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-file-upload" style="font-size: 1.2rem;"></i>
                        Planilla Requiere Comprobante
                    </h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 15px;">
                        <div><strong style="color: #92400e;">📋 Planilla pendiente:</strong> ${periodoTexto}</div>
                        <div><strong style="color: #92400e;">💰 Monto:</strong> Q ${parseFloat(planillaPendiente.MontoPlanillaParcial).toFixed(2)}</div>
                        <div><strong style="color: #92400e;">👥 Colaboradores:</strong> ${planillaPendiente.CantidadColaboradores}</div>
                        <div><strong style="color: #92400e;">👤 Creada por:</strong> ${planillaPendiente.NombreUsuario}</div>
                    </div>
                    
                    <div style="text-align: center; padding: 15px; background: #fee2e2; border-radius: 8px; border: 2px solid #ef4444;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 5px;">
                            <span style="font-size: 1.3rem;">📎</span>
                            <strong style="color: #991b1b; font-size: 1.1rem;">Estado: Pendiente de Subir Comprobante</strong>
                        </div>
                        <div style="font-size: 0.85rem; color: #991b1b; opacity: 0.9;">
                            Debe subir el comprobante de pago antes de crear una nueva planilla
                        </div>
                    </div>
                </div>

                <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 15px; border-radius: 8px; border: 2px solid #ef4444; margin-bottom: 15px;">
                    <p style="margin: 0; color: #991b1b; text-align: center;">
                        <strong>🚫 No se puede crear una nueva planilla</strong><br>
                        <span style="font-size: 0.9rem;">Primero debe completar el proceso de la planilla anterior</span>
                    </p>
                </div>
                
                <div style="background: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0; color: #1e40af; text-align: center;">
                        <strong>💡 Acción requerida:</strong> Vaya al módulo de gestión de comprobantes para subir el documento pendiente.
                    </p>
                </div>
            </div>
        `,
        confirmButtonText: '📎 Ir a Subir Comprobante',
        showCancelButton: true,
        cancelButtonText: 'Entendido',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#6b7280',
        width: '700px',
        customClass: {
            popup: 'pending-document-modal'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            // Redirigir al módulo de subida de comprobantes
            mostrarModuloSubidaComprobante(planillaPendiente);
        }
    });
}
function mostrarModuloSubidaComprobante(planillaPendiente) {
    const periodoTexto = formatearPeriodoDesdeString(planillaPendiente.PeriodoPago);
    
    Swal.fire({
        title: 'Subir Comprobante de Pago',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0891b2;">
                    <h4 style="color: #0c5460; margin-bottom: 10px;">📋 Información de la Planilla</h4>
                    <div><strong>Período:</strong> ${periodoTexto}</div>
                    <div><strong>Monto:</strong> Q ${parseFloat(planillaPendiente.MontoPlanillaParcial).toFixed(2)}</div>
                    <div><strong>Colaboradores:</strong> ${planillaPendiente.CantidadColaboradores}</div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-weight: 600; color: var(--trust-navy); margin-bottom: 8px;">
                        <i class="fas fa-file-pdf"></i> Seleccionar comprobante de pago (PDF):
                    </label>
                    <input type="file" id="comprobanteFile" accept=".pdf" style="
                        width: 100%; 
                        padding: 10px; 
                        border: 2px dashed #3b82f6; 
                        border-radius: 8px; 
                        background: #f8fafc;
                        cursor: pointer;
                    ">
                    <div style="font-size: 0.8rem; color: #6b7280; margin-top: 5px;">
                        Solo archivos PDF. Tamaño máximo: 10MB
                    </div>
                </div>
                
                <div id="previewComprobante" style="display: none; background: #ecfdf5; padding: 10px; border-radius: 6px; border: 1px solid #22c55e;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-file-pdf" style="color: #dc2626; font-size: 1.5rem;"></i>
                        <div>
                            <div id="fileName" style="font-weight: 600; color: #059669;"></div>
                            <div id="fileSize" style="font-size: 0.8rem; color: #6b7280;"></div>
                        </div>
                    </div>
                </div>
                
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e; font-size: 0.9rem;">
                        <strong>⚠️ Importante:</strong> Asegúrese de que el comprobante corresponde al período y monto mostrados arriba.
                    </p>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '📤 Subir Comprobante',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        width: '600px',
        preConfirm: () => {
            const fileInput = document.getElementById('comprobanteFile');
            const file = fileInput?.files[0];
            
            if (!file) {
                Swal.showValidationMessage('Por favor seleccione un archivo PDF');
                return false;
            }
            
            if (file.type !== 'application/pdf') {
                Swal.showValidationMessage('Solo se permiten archivos PDF');
                return false;
            }
            
            if (file.size > 10 * 1024 * 1024) { // 10MB
                Swal.showValidationMessage('El archivo es demasiado grande (máximo 10MB)');
                return false;
            }
            
            return { file };
        },
        didOpen: () => {
            // Agregar event listener para preview
            const fileInput = document.getElementById('comprobanteFile');
            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    const preview = document.getElementById('previewComprobante');
                    const fileName = document.getElementById('fileName');
                    const fileSize = document.getElementById('fileSize');
                    
                    if (file && preview && fileName && fileSize) {
                        fileName.textContent = file.name;
                        fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
                        preview.style.display = 'block';
                    } else if (preview) {
                        preview.style.display = 'none';
                    }
                });
            }
        }
    }).then(async (result) => {
        if (result.isConfirmed && result.value) {
            await procesarSubidaComprobante(planillaPendiente.IdPlanillaParcial, result.value.file);
        }
    });
}

async function procesarSubidaComprobante(idPlanilla, archivo) {
    try {
        // Mostrar progreso de carga
        Swal.fire({
            title: 'Subiendo comprobante...',
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                    <div class="loading-spinner" style="border: 4px solid #f3f4f6; border-top: 4px solid #10b981; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
                    <p style="color: #10b981; margin: 0;">Procesando archivo...</p>
                    <div style="font-size: 0.8rem; color: #6b7280;">
                        <div>📄 Archivo: ${archivo.name}</div>
                        <div>📦 Tamaño: ${(archivo.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false
        });

        // Obtener datos del usuario
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData) {
            throw new Error('No se encontraron datos del usuario');
        }

        // Convertir archivo a base64
        const archivoBase64 = await convertirArchivoABase64(archivo);

        // Subir a la base de datos
        const connection = await connectionString();
        
        // Verificar que la planilla está en Estado 2
        const verificacion = await connection.query(`
            SELECT Estado FROM PagoPlanillaParcial WHERE IdPlanillaParcial = ?
        `, [idPlanilla]);
        
        if (verificacion.length === 0 || verificacion[0].Estado !== 2) {
            throw new Error('La planilla no está en el estado correcto para subir comprobante');
        }

        // Insertar documento
        await connection.query(`
            INSERT INTO DocumentosPlanillasParciales (
                IdPlanillaParcial,
                NombreArchivo,
                DocumentoPDF,
                IdUsuario,
                NombreUsuario
            ) VALUES (?, ?, ?, ?, ?)
        `, [
            idPlanilla,
            archivo.name,
            archivoBase64,
            userData.IdPersonal,
            userData.NombreCompleto
        ]);

        // Actualizar estado de la planilla a 3 (Documento Cargado)
        await connection.query(`
            UPDATE PagoPlanillaParcial 
            SET 
                Estado = 3
            WHERE IdPlanillaParcial = ?
        `, [idPlanilla]);

        await connection.close();

        // Cerrar loading
        Swal.close();

        // Mostrar éxito
        await Swal.fire({
            icon: 'success',
            title: '¡Comprobante subido exitosamente!',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; border: 2px solid #10b981;">
                        <h4 style="color: #059669; margin-bottom: 15px; text-align: center;">✅ Proceso Completado</h4>
                        
                        <div style="margin-bottom: 10px;"><strong>📄 Archivo:</strong> ${archivo.name}</div>
                        <div style="margin-bottom: 10px;"><strong>📦 Tamaño:</strong> ${(archivo.size / 1024 / 1024).toFixed(2)} MB</div>
                        <div style="margin-bottom: 10px;"><strong>📅 Fecha subida:</strong> ${new Date().toLocaleDateString('es-GT')}</div>
                        <div style="margin-bottom: 10px;"><strong>👤 Subido por:</strong> ${userData.NombreCompleto}</div>
                        <div><strong>🔄 Nuevo estado:</strong> Documento Cargado</div>
                    </div>
                    
                    <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #3b82f6;">
                        <p style="margin: 0; color: #1e40af;">
                            <strong>ℹ️ Ahora puede crear nuevas planillas:</strong> El proceso anterior ha sido completado exitosamente.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Perfecto',
            confirmButtonColor: '#10b981',
            width: '550px'
        });

        console.log(`Comprobante subido exitosamente para planilla ${idPlanilla}`);

    } catch (error) {
        console.error('Error al subir comprobante:', error);
        
        Swal.close();
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al subir comprobante',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin-bottom: 10px; color: #991b1b;">
                            <strong>❌ Error al procesar:</strong> ${error.message}
                        </p>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e;">
                            <strong>💡 Sugerencia:</strong> Verifique que el archivo sea un PDF válido e intente nuevamente.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ef4444',
            width: '500px'
        });
    }
}

function convertirArchivoABase64(archivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
            // Remover el prefijo data:application/pdf;base64,
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        
        reader.onerror = () => {
            reject(new Error('Error al leer el archivo'));
        };
        
        reader.readAsDataURL(archivo);
    });
}
async function verificarPlanillasPendientesComprobante(departamentoId) {
    try {
        const connection = await connectionString();
        
        // Buscar planillas en Estado 2 (Pendiente de subir comprobante)
        const result = await connection.query(`
            SELECT 
                p.IdPlanillaParcial,
                p.PeriodoPago,
                p.MontoPlanillaParcial,
                p.CantidadColaboradores,
                p.NombreUsuario,
                p.FechaRegistro,
                e.NombreEstado
            FROM PagoPlanillaParcial p
            INNER JOIN PagoPlanillaParcialEstados e ON p.Estado = e.IdEstadoPagoPlanillaParcial
            WHERE 
                p.IdDepartamentoSucursal = ? AND 
                p.Estado = 2
            ORDER BY p.FechaRegistro DESC
            LIMIT 1
        `, [departamentoId]);
        
        await connection.close();
        
        return result.length > 0 ? result[0] : null;
        
    } catch (error) {
        console.error('Error al verificar planillas pendientes de comprobante:', error);
        throw error;
    }
}
async function mostrarErrorPeriodoDuplicado(periodoExistente, fechaInicio, fechaFin) {
    const periodoNuevoTexto = formatearPeriodoSeguro(fechaInicio, fechaFin);
    const fechaRegistro = new Date(periodoExistente.FechaRegistro).toLocaleDateString('es-GT');
    
    const estadoInfo = obtenerEstiloEstado(periodoExistente.IdEstado, periodoExistente.NombreEstado);
    
    // ✅ DETERMINAR TIPO DE CONFLICTO
    let tituloConflicto, mensajeConflicto, colorFondo, colorBorde;
    
    if (periodoExistente.tipoConflicto === 'solapamiento') {
        tituloConflicto = 'Conflicto de Fechas Detectado';
        colorFondo = '#fee2e2';
        colorBorde = '#ef4444';
        
        const periodoExistenteTexto = formatearPeriodoSeguro(
            periodoExistente.periodoExistente.inicio, 
            periodoExistente.periodoExistente.fin
        );
        
        const diasConflictoTexto = periodoExistente.diasEnConflicto.length > 5 ? 
            `${periodoExistente.diasEnConflicto.slice(0, 5).join(', ')}... (+${periodoExistente.diasEnConflicto.length - 5} más)` :
            periodoExistente.diasEnConflicto.join(', ');
        
        mensajeConflicto = `
            <div style="background: ${colorFondo}; padding: 15px; border-radius: 8px; border: 2px solid ${colorBorde}; margin-bottom: 15px;">
                <h4 style="color: #991b1b; margin-bottom: 15px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 1.2rem;"></i>
                    ${tituloConflicto}
                </h4>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 15px;">
                    <div><strong style="color: #991b1b;">📅 Período que intenta crear:</strong> ${periodoNuevoTexto}</div>
                    <div><strong style="color: #991b1b;">⚠️ Período existente en conflicto:</strong> ${periodoExistenteTexto}</div>
                    <div><strong style="color: #991b1b;">📊 Días en conflicto:</strong> ${diasConflictoTexto}</div>
                    <div><strong style="color: #991b1b;">👤 Creada por:</strong> ${periodoExistente.NombreUsuario}</div>
                    <div><strong style="color: #991b1b;">📆 Fecha registro:</strong> ${fechaRegistro}</div>
                </div>
                
                <div style="background: #fecaca; padding: 12px; border-radius: 6px; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #991b1b; font-size: 0.9rem;">
                        <strong>🚫 Las fechas se solapan:</strong> No se pueden crear dos planillas que cubran los mismos días laborales.
                    </p>
                </div>
            </div>
        `;
    } else {
        // Conflicto exacto (código original)
        tituloConflicto = 'Período Duplicado Detectado';
        colorFondo = '#fef3c7';
        colorBorde = '#f59e0b';
        
        mensajeConflicto = `
            <div style="background: ${colorFondo}; padding: 20px; border-radius: 12px; border: 2px solid ${colorBorde}; margin-bottom: 20px; box-shadow: var(--shadow-large);">
                <h4 style="color: #92400e; margin-bottom: 15px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 1.2rem;"></i>
                    ${tituloConflicto}
                </h4>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div><strong style="color: #92400e;">📅 Período:</strong> ${periodoNuevoTexto}</div>
                    <div><strong style="color: #92400e;">💰 Monto:</strong> Q ${parseFloat(periodoExistente.MontoPlanillaParcial).toFixed(2)}</div>
                    <div><strong style="color: #92400e;">👥 Colaboradores:</strong> ${periodoExistente.CantidadColaboradores}</div>
                    <div><strong style="color: #92400e;">👤 Creada por:</strong> ${periodoExistente.NombreUsuario}</div>
                    <div style="grid-column: span 2;"><strong style="color: #92400e;">📆 Fecha registro:</strong> ${fechaRegistro}</div>
                </div>
            </div>
        `;
    }
    
    await Swal.fire({
        icon: 'warning',
        title: tituloConflicto,
        html: `
            <div style="text-align: left; margin: 20px 0;">
                ${mensajeConflicto}
                
                <div style="text-align: center; padding: 15px; background: ${estadoInfo.fondo}; border-radius: 8px; border: 2px solid ${estadoInfo.borde};">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 5px;">
                        <span style="font-size: 1.3rem;">${estadoInfo.icono}</span>
                        <strong style="color: ${estadoInfo.texto}; font-size: 1.1rem;">Estado: ${periodoExistente.NombreEstado}</strong>
                    </div>
                    <div style="font-size: 0.85rem; color: ${estadoInfo.texto}; opacity: 0.9;">
                        ${estadoInfo.descripcion}
                    </div>
                </div>

                <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 15px; border-radius: 8px; border: 2px solid #ef4444; margin-top: 15px;">
                    <p style="margin: 0; color: #991b1b; text-align: center;">
                        <strong>🚫 No se puede crear la nueva planilla</strong><br>
                        <span style="font-size: 0.9rem;">Los períodos no pueden tener fechas superpuestas</span>
                    </p>
                </div>
            </div>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#1e40af',
        width: '800px',
        customClass: {
            popup: 'duplicate-planilla-modal'
        }
    });
}
// ⭐ FUNCIÓN PARA TRANSICIÓN SUAVE A MODO NORMAL
async function transicionAModoNormal() {
    const mainContainer = document.querySelector('.main-container');
    
    if (mainContainer) {
        // Agregar clase de transición
        mainContainer.style.transition = 'all 0.6s ease';
        
        // Cambiar a modo normal
        mainContainer.classList.remove('config-mode');
        mainContainer.classList.add('normal-mode');
        
        // Mostrar elementos con animación
        setTimeout(() => {
            mostrarElementosDespuesDeConfigurarConAnimacion();
        }, 300);
    }
}

// ⭐ FUNCIÓN PARA MOSTRAR ESTADO DE CARGA
function mostrarEstadoCarga(mensaje) {
    const configContainer = document.querySelector('.payroll-type-container');
    
    // Crear elemento de carga si no existe
    let loadingElement = document.getElementById('config-loading');
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'config-loading';
        loadingElement.className = 'config-loading';
        loadingElement.innerHTML = `
            <div class="config-spinner"></div>
            <div class="config-loading-text" id="loading-text">${mensaje}</div>
        `;
        
        if (configContainer) {
            configContainer.appendChild(loadingElement);
        }
    } else {
        document.getElementById('loading-text').textContent = mensaje;
        loadingElement.style.display = 'flex';
    }
}

// ⭐ FUNCIÓN PARA OCULTAR ESTADO DE CARGA
function ocultarEstadoCarga() {
    const loadingElement = document.getElementById('config-loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// ⭐ FUNCIÓN PARA MOSTRAR ERROR DE PLANILLA DUPLICADA
async function mostrarErrorPlanillaDuplicada(planillaExistente, tipo, mes, anio) {
    const tipoTexto = tipo === 'quincenal' ? 'Quincenal' : 'Fin de Mes';
    const mesNombre = new Date(anio, mes - 1).toLocaleDateString('es-GT', { month: 'long' });
    const fechaRegistro = new Date(planillaExistente.FechaRegistro).toLocaleDateString('es-GT');
    
    const estadoInfo = obtenerEstiloEstado(planillaExistente.IdEstado, planillaExistente.NombreEstado);
    
    await Swal.fire({
        icon: 'warning',
        title: 'Planilla ya existe',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%); padding: 20px; border-radius: 12px; border: 2px solid #f59e0b; margin-bottom: 20px; box-shadow: var(--shadow-large);">
                    <h4 style="color: #92400e; margin-bottom: 15px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 1.2rem;"></i>
                        Planilla Duplicada Detectada
                    </h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div><strong style="color: #92400e;">📋 Tipo:</strong> Planilla ${tipoTexto}</div>
                        <div><strong style="color: #92400e;">📅 Período:</strong> ${mesNombre} ${anio}</div>
                        <div><strong style="color: #92400e;">💰 Monto:</strong> Q ${parseFloat(planillaExistente.MontoPlanillaParcial).toFixed(2)}</div>
                        <div><strong style="color: #92400e;">👥 Colaboradores:</strong> ${planillaExistente.CantidadColaboradores}</div>
                        <div style="grid-column: span 2;"><strong style="color: #92400e;">👤 Creada por:</strong> ${planillaExistente.NombreUsuario}</div>
                        <div style="grid-column: span 2;"><strong style="color: #92400e;">📆 Fecha registro:</strong> ${fechaRegistro}</div>
                    </div>
                    
                    <div style="text-align: center; padding: 15px; background: ${estadoInfo.fondo}; border-radius: 8px; border: 2px solid ${estadoInfo.borde};">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 5px;">
                            <span style="font-size: 1.3rem;">${estadoInfo.icono}</span>
                            <strong style="color: ${estadoInfo.texto}; font-size: 1.1rem;">Estado: ${planillaExistente.NombreEstado}</strong>
                        </div>
                        <div style="font-size: 0.85rem; color: ${estadoInfo.texto}; opacity: 0.9;">
                            ${estadoInfo.descripcion}
                        </div>
                    </div>
                </div>

                <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 15px; border-radius: 8px; border: 2px solid #ef4444; margin-bottom: 15px;">
                    <p style="margin: 0; color: #991b1b; text-align: center;">
                        <strong>🚫 No se puede crear una nueva planilla</strong><br>
                        <span style="font-size: 0.9rem;">Ya existe una planilla ${tipoTexto.toLowerCase()} para ${mesNombre} ${anio}</span>
                    </p>
                </div>
            </div>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#1e40af',
        width: '700px',
        customClass: {
            popup: 'duplicate-planilla-modal'
        }
    });
}

function obtenerEstiloEstado(idEstado, nombreEstado) {
    // Mapear TUS estados reales a estilos apropiados
    const estilosEstados = {
        0: { // En espera por Autorización
            icono: '⏳',
            fondo: '#fef3c7',
            borde: '#f59e0b',
            texto: '#92400e',
            descripcion: 'Esperando autorización para procesar'
        },
        1: { // Autorizado
            icono: '✅',
            fondo: '#dcfce7',
            borde: '#16a34a',
            texto: '#15803d',
            descripcion: 'Planilla autorizada y lista para procesar'
        },
        2: { // Documento Descargado
            icono: '📥',
            fondo: '#dbeafe',
            borde: '#3b82f6',
            texto: '#1e40af',
            descripcion: 'Documento generado y descargado'
        },
        3: { // Pendiente por Subir Comprobante
            icono: '📎',
            fondo: '#f3e8ff',
            borde: '#8b5cf6',
            texto: '#6b21a8',
            descripcion: 'Esperando subir comprobante de pago'
        },
        4: { // Documento cargado
            icono: '📄',
            fondo: '#e0f2fe',
            borde: '#0891b2',
            texto: '#0c5460',
            descripcion: 'Comprobante de pago cargado'
        },
        5: { // Completado
            icono: '🎉',
            fondo: '#ecfdf5',
            borde: '#10b981',
            texto: '#059669',
            descripcion: 'Proceso completado exitosamente'
        },
        6: { // Anulado
            icono: '🚫',
            fondo: '#fee2e2',
            borde: '#ef4444',
            texto: '#dc2626',
            descripcion: 'Planilla anulada o cancelada'
        }
    };
    
    // Retornar estilo específico o uno por defecto
    return estilosEstados[idEstado] || {
        icono: '📋',
        fondo: '#f3f4f6',
        borde: '#9ca3af',
        texto: '#6b7280',
        descripcion: `Estado: ${nombreEstado}`
    };
}

// ⭐ FUNCIÓN PARA CARGAR COLABORADORES CON PROGRESO
async function cargarColaboradoresConProgreso() {
    try {
        // Actualizar progreso
        actualizarProgresoVisual('collaborators');
        
        // Buscar colaboradores
        await buscarColaboradoresAutomatico();
        
        // Mostrar sección de planilla y estado de bienvenida
        document.getElementById('payrollSection').style.display = 'block';
        document.getElementById('welcomeState').style.display = 'flex';
        
        // Actualizar progreso a siguiente paso
        setTimeout(() => {
            actualizarProgresoVisual('shifts');
        }, 1000);
        
    } catch (error) {
        console.error('Error al cargar colaboradores:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error al cargar colaboradores',
            text: 'No se pudieron cargar los colaboradores del departamento.',
            confirmButtonColor: '#1e40af'
        });
    }
}

async function buscarColaboradoresAutomatico() {
    if (!currentDepartamentoId) {
        throw new Error('No se ha configurado el departamento');
    }
    
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                personal.IdPersonal, 
                personal.PrimerApellido, 
                personal.SegundoApellido, 
                personal.PrimerNombre, 
                personal.SegundoNombre, 
                personal.TercerNombre, 
                Puestos.Nombre
            FROM
                personal
                INNER JOIN
                Puestos
                ON 
                    personal.IdPuesto = Puestos.IdPuesto
            WHERE
                personal.TipoPersonal = 2 AND
                personal.Estado = 1 AND
                personal.IdSucuDepa = ?
            ORDER BY personal.PrimerApellido, personal.PrimerNombre
        `, [currentDepartamentoId]);
        
        await connection.close();
        
        allCollaborators = result.map(collab => ({
            ...collab,
            nombreCompleto: `${collab.PrimerNombre} ${collab.SegundoNombre || ''} ${collab.TercerNombre || ''} ${collab.PrimerApellido} ${collab.SegundoApellido || ''}`.trim().replace(/\s+/g, ' ')
        }));
        
        mostrarColaboradores(allCollaborators);
        
    } catch (error) {
        console.error('Error al buscar colaboradores:', error);
        throw error;
    }
}

function mostrarColaboradores(colaboradores) {
    // ⭐ NUEVA VALIDACIÓN: Solo mostrar si la planilla está confirmada
    if (!planillaConfig.confirmada) {
        console.log('Planilla no confirmada - no se muestran colaboradores');
        return;
    }
    
    const section = document.getElementById('collaboratorsSection');
    const list = document.getElementById('collaboratorsList');
    const count = document.getElementById('collaboratorCount');
    
    list.innerHTML = '';
    count.textContent = colaboradores.length;
    
    if (colaboradores.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>No se encontraron colaboradores de tiempo parcial en este departamento.</p>
            </div>
        `;
    } else {
        colaboradores.forEach(collab => {
            const item = document.createElement('div');
            item.className = 'collaborator-item';
            item.dataset.employeeId = collab.IdPersonal;
            item.innerHTML = `
                <div class="collaborator-name">${collab.nombreCompleto}</div>
                <div class="collaborator-position">${collab.Nombre}</div>
                <div class="collaborator-id">ID: ${collab.IdPersonal}</div>
            `;
            
            item.addEventListener('click', () => seleccionarColaboradorConProgreso(collab, item));
            list.appendChild(item);
        });
    }
    
    // ⭐ MOSTRAR la sección solo después de confirmar planilla
    section.style.display = 'block';
    
    // Limpiar búsqueda
    document.getElementById('searchCollaborator').value = '';
    setTimeout(ajustarAlturaLista, 100);
}

// ⭐ FUNCIÓN MEJORADA PARA SELECCIONAR COLABORADOR CON PROGRESO
function seleccionarColaboradorConProgreso(colaborador, itemElement) {
    // Remover selección anterior
    document.querySelectorAll('.collaborator-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Seleccionar nuevo colaborador
    itemElement.classList.add('selected');
    selectedEmployee = {
        id: colaborador.IdPersonal,
        nombre: colaborador.nombreCompleto,
        puesto: colaborador.Nombre
    };
    
    // ⭐ ACTUALIZAR PROGRESO A "TURNOS"
    actualizarProgresoVisual('shifts');
    
    // Verificar si el colaborador ya está en la planilla
    const colaboradorEnPlanilla = payrollCollaborators.find(c => c.id === colaborador.IdPersonal);
    
    if (colaboradorEnPlanilla) {
        // Cargar sus turnos existentes
        currentShifts = [...colaboradorEnPlanilla.shifts];
        
        Swal.fire({
            icon: 'info',
            title: 'Colaborador encontrado en planilla',
            html: `
                <div style="text-align: left; margin: 15px 0;">
                    <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: var(--spacing-lg); border-radius: var(--radius-xl); border: 2px solid #3b82f6; margin-bottom: var(--spacing-lg);">
                        <h4 style="color: #1e40af; margin-bottom: var(--spacing-md); text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <i class="fas fa-user-check"></i>
                            Colaborador en Planilla
                        </h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem;">
                            <div><strong>👤 Colaborador:</strong> ${colaborador.nombreCompleto}</div>
                            <div><strong>💼 Puesto:</strong> ${colaborador.Nombre}</div>
                            <div><strong>📊 Turnos actuales:</strong> ${colaboradorEnPlanilla.totalTurnos}</div>
                            <div><strong>💰 Total a pagar:</strong> Q ${colaboradorEnPlanilla.totalPago.toFixed(2)}</div>
                        </div>
                    </div>
                    
                    <div style="background: #e0f2fe; padding: 12px; border-radius: 8px; border-left: 4px solid #0891b2;">
                        <p style="margin: 0; color: #0891b2; font-size: 0.9rem;">
                            <strong>ℹ️ Este colaborador ya tiene turnos configurados.</strong> Puedes editarlos o simplemente revisar la información.
                        </p>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '📅 Editar turnos',
            cancelButtonText: '👀 Solo revisar',
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#6b7280',
            width: '500px'
        }).then((result) => {
            if (result.isConfirmed) {
                setTimeout(() => {
                    abrirCalendario();
                }, 200);
            }
        });
    } else {
        // Colaborador nuevo
        currentShifts = [];

        setTimeout(() => {
            abrirCalendario();
        }, 300);
    }
    
    // Ocultar estado de bienvenida
    document.getElementById('welcomeState').style.display = 'none';
    
    // La sección de planilla siempre debe estar visible
    document.getElementById('payrollSection').style.display = 'block';
    
    // Actualizar visibilidad de acciones
    actualizarVisibilidadAcciones();
}

function filtrarColaboradores() {
    const searchTerm = document.getElementById('searchCollaborator').value.toLowerCase();
    const colaboradoresFiltrados = allCollaborators.filter(collab => 
        collab.nombreCompleto.toLowerCase().includes(searchTerm) ||
        collab.Nombre.toLowerCase().includes(searchTerm) ||
        collab.IdPersonal.toString().includes(searchTerm)
    );
    
    const list = document.getElementById('collaboratorsList');
    const count = document.getElementById('collaboratorCount');
    
    list.innerHTML = '';
    count.textContent = colaboradoresFiltrados.length;
    
    if (colaboradoresFiltrados.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No se encontraron colaboradores que coincidan con la búsqueda.</p>
            </div>
        `;
    } else {
        colaboradoresFiltrados.forEach(collab => {
            const item = document.createElement('div');
            item.className = 'collaborator-item';
            item.dataset.employeeId = collab.IdPersonal;
            
            // Verificar si está seleccionado
            if (selectedEmployee && selectedEmployee.id === collab.IdPersonal) {
                item.classList.add('selected');
            }
            
            item.innerHTML = `
                <div class="collaborator-name">${collab.nombreCompleto}</div>
                <div class="collaborator-position">${collab.Nombre}</div>
                <div class="collaborator-id">ID: ${collab.IdPersonal}</div>
            `;
            
            item.addEventListener('click', () => seleccionarColaboradorConProgreso(collab, item));
            list.appendChild(item);
        });
    }
    setTimeout(ajustarAlturaLista, 100);
}

// ⭐ FUNCIÓN MEJORADA PARA CAMBIAR CONFIGURACIÓN CON RESET DE PROGRESO
function cambiarConfiguracionPlanillaConReset() {
    const form = document.getElementById('payrollTypeForm');
    const confirmed = document.getElementById('payrollConfirmed');
    const planillaInfo = document.getElementById('planillaInfo');
    const payrollTypeSection = document.querySelector('.payroll-type-section');
    
    // ⭐ RESETEAR PROGRESO A INICIAL
    actualizarProgresoVisual('config');
    
    // Ocultar elementos nuevamente
    ocultarElementosHastaConfigurar();
    
    // Aplicar modo configuración
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        mainContainer.classList.add('config-mode');
        mainContainer.classList.remove('normal-mode');
    }
    
    // Mostrar la sección de configuración
    payrollTypeSection.classList.remove('hidden', 'panel-fade-out');
    payrollTypeSection.style.display = 'block';
    
    // Mostrar formulario, ocultar vista confirmada
    form.style.display = 'block';
    confirmed.style.display = 'none';
    planillaInfo.style.display = 'none';
    
    // Resetear configuración
    planillaConfig.confirmada = false;
    
    // Limpiar selecciones y datos
    limpiarSelecciones();
    payrollCollaborators = [];
    allCollaborators = [];
    currentShifts = [];
    selectedEmployee = null;
    
    // Mostrar notificación
    Swal.fire({
        icon: 'info',
        title: 'Configuración reiniciada',
        text: 'Puede configurar una nueva planilla.',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

function mostrarInformacionEnHeader() {
    const planillaInfo = document.getElementById('planillaInfo');
    const planillaBadge = document.getElementById('planillaBadge');
    
    // ✅ USAR FUNCIÓN SEGURA
    const periodoTexto = formatearPeriodoSeguro(planillaConfig.fechaInicio, planillaConfig.fechaFin);
    
    planillaBadge.textContent = `Período: ${periodoTexto}`;
    planillaInfo.style.display = 'flex';
}

function actualizarVistaPlanillaConfirmada() {
    const form = document.getElementById('payrollTypeForm');
    const confirmed = document.getElementById('payrollConfirmed');
    const confirmedType = document.getElementById('confirmedType');
    const confirmedPeriod = document.getElementById('confirmedPeriod');
    
    // Ocultar formulario, mostrar vista confirmada
    form.style.display = 'none';
    confirmed.style.display = 'block';
    
    // ✅ USAR FUNCIÓN SEGURA
    confirmedType.textContent = 'Período Configurado';
    confirmedPeriod.textContent = formatearPeriodoSeguro(planillaConfig.fechaInicio, planillaConfig.fechaFin);
}

// Abrir modal del calendario
function abrirCalendario() {
    if (!selectedEmployee) {
        mostrarError('Debe seleccionar un colaborador primero');
        return;
    }
    
    // Actualizar información del empleado en el modal
    document.getElementById('modalEmployeeName').textContent = selectedEmployee.nombre;
    document.getElementById('modalEmployeePosition').textContent = selectedEmployee.puesto;
    
    // Mostrar modal
    document.getElementById('calendarModal').style.display = 'block';
    
    // Actualizar calendario
    actualizarCalendario();
    actualizarResumenModal();
    
    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
}

// Cerrar modal del calendario
function cerrarCalendario() {
    document.getElementById('calendarModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Guardar y cerrar calendario
function guardarYCerrarCalendario() {
    // Verificar que hay turnos para agregar
    if (currentShifts.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin turnos',
            text: 'No hay turnos registrados para agregar a la planilla.',
            confirmButtonColor: '#1e40af'
        });
        return;
    }
    
    // Verificar si el colaborador ya está en la planilla
    const existingIndex = payrollCollaborators.findIndex(c => c.id === selectedEmployee.id);
    
    if (existingIndex !== -1) {
        // Actualizar colaborador existente
        Swal.fire({
            title: 'Colaborador ya existe en planilla',
            text: '¿Desea actualizar los turnos de este colaborador?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, actualizar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1e40af'
        }).then((result) => {
            if (result.isConfirmed) {
                actualizarColaboradorEnPlanilla(existingIndex);
                cerrarCalendario();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Colaborador actualizado',
                    text: `Los turnos de ${selectedEmployee.nombre} han sido actualizados en la planilla.`,
                    timer: 2500,
                    showConfirmButton: false
                });
            }
        });
    } else {
        // Agregar nuevo colaborador directamente
        agregarNuevoColaboradorAPlanillaConProgreso();
        cerrarCalendario();
    }
}

// Actualizar calendario
function actualizarCalendario() {
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    document.getElementById('currentMonth').textContent = 
        `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    
    const grid = document.getElementById('calendarGrid');
    
    // Limpiar días anteriores (mantener headers)
    const existingDays = grid.querySelectorAll('.calendar-day');
    existingDays.forEach(day => day.remove());
    
    // Calcular primer día del mes y días en el mes
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Generar días del calendario
    for (let i = 0; i < 42; i++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + i);
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = dayDate.getDate();
        
        // Marcar días de otros meses
        if (dayDate.getMonth() !== currentDate.getMonth()) {
            dayElement.classList.add('other-month');
        } else {
            // ⭐ VALIDACIÓN 1: Verificar que sea del mes actual
            const validacionMesActual = validarMesActual(dayDate);
            if (!validacionMesActual.valida) {
                dayElement.classList.add('month-restricted');
                const mesActual = new Date();
                if (validacionMesActual.motivo === 'mes_pasado' || validacionMesActual.motivo === 'anio_pasado') {
                    dayElement.title = `Día ${dayDate.getDate()} - Mes/año anterior no permitido`;
                } else {
                    dayElement.title = `Día ${dayDate.getDate()} - Mes/año futuro no permitido`;
                }
                dayElement.addEventListener('click', () => seleccionarFecha(dayDate));
            }
            // ⭐ VALIDACIÓN 2: Verificar restricciones por tipo de planilla
            else {
                const validacionPlanilla = validarFechaPorPeriodoConfiguracion(dayDate);
                if (!validacionPlanilla.valida && validacionPlanilla.motivo !== 'no_configurada') {
                    dayElement.classList.add('planilla-restricted');
                    if (validacionPlanilla.motivo === 'fuera_periodo') {
                        const periodoTexto = formatearPeriodo(validacionPlanilla.fechaInicio, validacionPlanilla.fechaFin);
                        dayElement.title = `Día ${dayDate.getDate()} - Fuera del período configurado (${periodoTexto})`;
                    }
                    dayElement.addEventListener('click', () => seleccionarFecha(dayDate));
                }
                // ⭐ VALIDACIÓN 3: Verificar si es domingo
                else if (esDomingo(dayDate)) {
                    dayElement.classList.add('sunday-blocked');
                    dayElement.title = 'Los domingos no son días laborables';
                    dayElement.addEventListener('click', () => seleccionarFecha(dayDate));
                }
                // ⭐ VALIDACIÓN 4: Verificar si es Semana Santa
                else {
                    const diaSemanaSanta = esSemanaSanta(dayDate);
                    if (diaSemanaSanta) {
                        dayElement.classList.add('easter-week');
                        dayElement.title = `${diaSemanaSanta.nombre} - Semana Santa`;
                        dayElement.addEventListener('click', () => seleccionarFecha(dayDate));
                    }
                    // ⭐ VALIDACIÓN 5: Verificar si es día especial/feriado
                    else {
                        const diaEspecial = esDiaEspecial(dayDate);
                        if (diaEspecial) {
                            if (diaEspecial.esNacional) {
                                dayElement.classList.add('holiday-national');
                            } else {
                                dayElement.classList.add('holiday-departmental');
                            }
                            dayElement.title = `${diaEspecial.descripcion} (${diaEspecial.esNacional ? 'Feriado Nacional' : 'Feriado Departamental'})`;
                            dayElement.addEventListener('click', () => seleccionarFecha(dayDate));
                        } else {
                            // ⭐ VALIDACIÓN 6: Día laborable normal - verificar turnos asignados
                            const dateString = formatDate(dayDate);
                            const shift = currentShifts.find(s => s.fecha === dateString);
                            
                            if (shift) {
                                if (shift.turno === 1) {
                                    dayElement.classList.add('morning-shift');
                                    dayElement.title = 'Turno de Mañana asignado';
                                } else if (shift.turno === 2) {
                                    dayElement.classList.add('mixed-shift');
                                    dayElement.title = 'Turno Mixto asignado';
                                } else if (shift.turno === 3) {
                                    dayElement.classList.add('hours-shift');
                                    const subTipoTexto = shift.subTurno === 1 ? 'Mañana' : 'Mixto';
                                    dayElement.title = `Turno de 4 Horas (${subTipoTexto}) asignado`;
                                }
                            } else {
                                dayElement.title = `Día ${dayDate.getDate()} - Disponible para asignar turno`;
                            }
                            
                            dayElement.addEventListener('click', () => seleccionarFecha(dayDate));
                        }
                    }
                }
            }
        }
        
        grid.appendChild(dayElement);
    }
    
    // Actualizar indicadores de semana
    actualizarIndicadoresSemana();
}

function validarMesActual(fecha) {
    // ✅ ELIMINAR VALIDACIÓN - Permitir cualquier fecha
    return { valida: true };
    
    // ✅ ALTERNATIVA: Solo bloquear fechas muy antiguas (ej: más de 2 años)
    /*
    const fechaLimite = new Date();
    fechaLimite.setFullYear(fechaLimite.getFullYear() - 2);
    
    if (fecha < fechaLimite) {
        return {
            valida: false,
            motivo: 'muy_antigua',
            fechaLimite: fechaLimite
        };
    }
    
    return { valida: true };
    */
}

function validarFechaPorPeriodoConfiguracion(fecha) {
    if (!planillaConfig.confirmada) {
        return { valida: false, motivo: 'no_configurada' };
    }
    
    const fechaSeleccionada = new Date(fecha);
    const fechaInicio = new Date(planillaConfig.fechaInicio);
    const fechaFin = new Date(planillaConfig.fechaFin);
    
    // Verificar si la fecha está dentro del rango configurado
    if (fechaSeleccionada >= fechaInicio && fechaSeleccionada <= fechaFin) {
        return { valida: true };
    } else {
        return { 
            valida: false, 
            motivo: 'fuera_periodo',
            fechaInicio: planillaConfig.fechaInicio,
            fechaFin: planillaConfig.fechaFin
        };
    }
}

function esDomingo(fecha) {
    const date = new Date(fecha);
    return date.getDay() === 0; // 0 = domingo
}

function seleccionarFecha(fecha) {
    const dateString = formatDate(fecha);
    const validacionPlanilla = validarFechaPorPeriodoConfiguracion(fecha);
    const validacionMesActual = validarMesActual(fecha);
    
    if (!validacionMesActual.valida) {
        mostrarErrorMesActual(fecha, validacionMesActual);
        return;
    }
    
    if (!validacionPlanilla.valida) {
        mostrarErrorPeriodo(fecha, validacionPlanilla);
        return;
    }
    
    // Validación 1: Verificar si es domingo
    if (esDomingo(fecha)) {
        Swal.fire({
            icon: 'error',
            title: 'Día no laborable',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>📅 Fecha seleccionada:</strong> ${formatDateDisplay(fecha)}</p>
                    <br>
                    <div style="background: #fecaca; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin: 0; color: #991b1b;">
                            <strong>🚫 Restricción:</strong> Los domingos no son días laborables. Los colaboradores de tiempo parcial solo pueden trabajar de lunes a sábado.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#1e40af',
            width: '500px'
        });
        return;
    }
    
    // ⭐ NUEVA VALIDACIÓN 2: Verificar si es Semana Santa
    const diaSemanaSanta = esSemanaSanta(fecha);
    if (diaSemanaSanta) {
        Swal.fire({
            icon: 'info',
            title: 'Semana Santa',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>📅 Fecha seleccionada:</strong> ${formatDateDisplay(fecha)}</p>
                    <p><strong>✝️ Celebración:</strong> ${diaSemanaSanta.nombre}</p>
                    <p><strong>📍 Tipo:</strong> Semana Santa</p>
                    <br>
                    <div style="background: #f3e8ff; padding: 15px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
                        <p style="margin: 0; color: #6b21a8;">
                            <strong>✝️ Información:</strong> Durante la Semana Santa esta pantalla no esta asignada para generar planilla de pago para colaboradores de tiempo parcial. Este día está designado como feriado religioso nacional.
                        </p>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.85rem; color: #6b7280;">
                        <strong>📖 Nota:</strong> Las fechas de Semana Santa se calculan automáticamente cada año según el calendario litúrgico.
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#1e40af',
            width: '550px'
        });
        return;
    }
    
    // Validación 3: Verificar si es día especial/feriado
    const diaEspecial = esDiaEspecial(fecha);
    if (diaEspecial) {
        const tipoFeriado = diaEspecial.esNacional ? 'Feriado Nacional' : 'Feriado Departamental';
        const colorFondo = diaEspecial.esNacional ? '#dbeafe' : '#ecfdf5';
        const colorBorde = diaEspecial.esNacional ? '#3b82f6' : '#10b981';
        const colorTexto = diaEspecial.esNacional ? '#1e40af' : '#059669';
        
        Swal.fire({
            icon: 'info',
            title: 'Día feriado/asueto',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>📅 Fecha seleccionada:</strong> ${formatDateDisplay(fecha)}</p>
                    <p><strong>🎉 Celebración:</strong> ${diaEspecial.descripcion}</p>
                    <p><strong>📍 Tipo:</strong> ${tipoFeriado}</p>
                    <br>
                    <div style="background: ${colorFondo}; padding: 15px; border-radius: 8px; border-left: 4px solid ${colorBorde};">
                        <p style="margin: 0; color: ${colorTexto};">
                            <strong>🎊 Información:</strong> Este día está designado como feriado/asueto
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#1e40af',
            width: '550px'
        });
        return;
    }
    
    const existingShift = currentShifts.find(s => s.fecha === dateString);
    
    if (existingShift) {
        // Si ya tiene turno, preguntar si desea eliminarlo
        const tipoTurnoTexto = existingShift.turno === 1 ? 'de mañana' : 
                               existingShift.turno === 2 ? 'mixto' : 'de 4 horas';
        
        Swal.fire({
            title: '¿Eliminar turno?',
            text: `Esta fecha ya tiene un turno ${tipoTurnoTexto} asignado. ¿Desea eliminarlo?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ef4444'
        }).then((result) => {
            if (result.isConfirmed) {
                eliminarTurno(dateString);
            }
        });
    } else {
        // Verificar límite de 4 turnos por semana
        const turnosEnSemana = contarTurnosEnSemana(fecha);
        
        if (turnosEnSemana >= 4) {
            const fechasSemana = obtenerFechasSemana(fecha);
            const primerDia = new Date(fechasSemana[0]);
            const ultimoDia = new Date(fechasSemana[6]);
            
            const semanaTexto = `${primerDia.getDate()}/${primerDia.getMonth() + 1} - ${ultimoDia.getDate()}/${ultimoDia.getMonth() + 1}/${ultimoDia.getFullYear()}`;
            
            Swal.fire({
                icon: 'warning',
                title: 'Límite semanal alcanzado',
                html: `
                    <div style="text-align: left; margin: 20px 0;">
                        <p><strong>📅 Semana:</strong> ${semanaTexto}</p>
                        <p><strong>📊 Turnos actuales:</strong> ${turnosEnSemana} de 4 permitidos</p>
                        <br>
                        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                            <p style="margin: 0; color: #92400e;">
                                <strong>⚠️ Restricción:</strong> Los colaboradores de tiempo parcial no pueden trabajar más de 4 días por semana según las políticas laborales.
                            </p>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#1e40af',
                width: '500px'
            });
            return;
        }
        
        // Si pasa todas las validaciones, mostrar modal para seleccionar tipo de turno
        document.getElementById('selectedDate').textContent = formatDateDisplay(fecha);
        document.getElementById('shiftModal').style.display = 'block';
        
        // Guardar fecha temporalmente
        window.tempSelectedDate = dateString;
    }
}
// Seleccionar tipo de turno
function seleccionarTipoTurno(tipoTurno) {
    const fecha = window.tempSelectedDate;
    const turno = parseInt(tipoTurno);
    
    // Si es turno de 4 horas, mostrar submenu para elegir horario
    if (turno === 3) {
        mostrarSubmenuTurno4Horas(fecha);
        return;
    }
    
    // Para turnos normales (1 y 2), continuar como antes
    let tipoNombre = '';
    switch(turno) {
        case 1:
            tipoNombre = 'Turno Mañana';
            break;
        case 2:
            tipoNombre = 'Turno Mixto';
            break;
        default:
            console.error('Tipo de turno no válido:', turno);
            return;
    }
    
    currentShifts.push({
        fecha: fecha,
        turno: turno,
        subTurno: null, // Para turnos normales no hay subtipo
        fechaDisplay: document.getElementById('selectedDate').textContent,
        tipoNombre: tipoNombre
    });
    
    actualizarCalendario();
    actualizarResumenModal();
    cerrarModal();
    
    delete window.tempSelectedDate;
}

function mostrarSubmenuTurno4Horas(fecha) {
    const fechaDisplay = document.getElementById('selectedDate').textContent;
    
    Swal.fire({
        title: 'Turno de 4 Horas',
        html: `
            <div style="text-align: center; margin: 20px 0;">
                <p style="margin-bottom: 20px; color: #6b7280; font-size: 0.9rem;">
                    <i class="fas fa-calendar-day" style="color: #4f46e5;"></i>
                    <strong>${fechaDisplay}</strong>
                </p>
                
                <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0891b2;">
                    <p style="margin: 0; color: #0c5460; font-size: 0.85rem;">
                        <strong>ℹ️ Seleccione el horario base:</strong><br>
                        Esto determinará la tarifa por hora que se aplicará (4 horas × tarifa correspondiente)
                    </p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
                    <button type="button" class="turno-4h-option morning-4h" data-sub-turno="1" style="
                        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                        border: 2px solid #f59e0b;
                        border-radius: 12px;
                        padding: 20px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 10px;
                        min-height: 120px;
                        justify-content: center;
                    ">
                        <div style="
                            width: 50px;
                            height: 50px;
                            background: linear-gradient(135deg, #fbbf24, #f59e0b);
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 1.5rem;
                            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
                        ">
                            ☀️
                        </div>
                        <div style="text-align: center;">
                            <h4 style="margin: 0; color: #92400e; font-size: 1rem; font-weight: 600;">Horario Mañana</h4>
                            <p style="margin: 5px 0 0 0; color: #92400e; font-size: 0.75rem;">4 horas × tarifa mañana</p>
                        </div>
                    </button>
                    
                    <button type="button" class="turno-4h-option mixed-4h" data-sub-turno="2" style="
                        background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);
                        border: 2px solid #8b5cf6;
                        border-radius: 12px;
                        padding: 20px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 10px;
                        min-height: 120px;
                        justify-content: center;
                    ">
                        <div style="
                            width: 50px;
                            height: 50px;
                            background: linear-gradient(135deg, #a78bfa, #8b5cf6);
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 1.5rem;
                            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
                        ">
                            🌙
                        </div>
                        <div style="text-align: center;">
                            <h4 style="margin: 0; color: #5b21b6; font-size: 1rem; font-weight: 600;">Horario Mixto</h4>
                            <p style="margin: 5px 0 0 0; color: #5b21b6; font-size: 0.75rem;">4 horas × tarifa mixta</p>
                        </div>
                    </button>
                </div>
            </div>
        `,
        showCancelButton: true,
        showConfirmButton: false,
        cancelButtonText: '← Regresar',
        cancelButtonColor: '#6b7280',
        width: '500px',
        customClass: {
            popup: 'turno-4h-modal'
        },
        didOpen: () => {
            // Agregar event listeners a los botones del submenu
            document.querySelectorAll('.turno-4h-option').forEach(button => {
                button.addEventListener('click', () => {
                    const subTurno = parseInt(button.dataset.subTurno);
                    confirmarTurno4Horas(fecha, subTurno);
                });
                
                // Efectos hover
                button.addEventListener('mouseenter', () => {
                    button.style.transform = 'translateY(-4px)';
                    button.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
                });
                
                button.addEventListener('mouseleave', () => {
                    button.style.transform = 'translateY(0)';
                    button.style.boxShadow = 'none';
                });
            });
        }
    }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
            // Si cancela, volver al modal principal
            document.getElementById('shiftModal').style.display = 'block';
        }
    });
}

// NUEVA FUNCIÓN: Confirmar turno de 4 horas con subtipo
function confirmarTurno4Horas(fecha, subTurno) {
    const subTipoNombre = subTurno === 1 ? 'Mañana' : 'Mixto';
    const tipoNombre = `Turno 4 Horas (${subTipoNombre})`;
    
    currentShifts.push({
        fecha: fecha,
        turno: 3, // Siempre es tipo 3 para 4 horas
        subTurno: subTurno, // 1 para mañana, 2 para mixto
        fechaDisplay: document.getElementById('selectedDate').textContent,
        tipoNombre: tipoNombre
    });
    
    actualizarCalendario();
    actualizarResumenModal();
    cerrarModal();
    
    // Cerrar el submenu también
    Swal.close();
    
    delete window.tempSelectedDate;
    
    // Mostrar confirmación
    Swal.fire({
        icon: 'success',
        title: 'Turno agregado',
        text: `${tipoNombre} asignado correctamente.`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

// Eliminar turno
function eliminarTurno(fecha) {
    currentShifts = currentShifts.filter(s => s.fecha !== fecha);
    actualizarCalendario();
    actualizarResumenModal();
}

// Cerrar modal de selección de turno
function cerrarModal() {
    document.getElementById('shiftModal').style.display = 'none';
    delete window.tempSelectedDate;
}

// Actualizar resumen en el modal
function actualizarResumenModal() {
    const turnosMañana = currentShifts.filter(s => s.turno === 1).length;
    const turnosMixtos = currentShifts.filter(s => s.turno === 2).length;
    const turnos4Horas = currentShifts.filter(s => s.turno === 3).length;
    const totalTurnos = currentShifts.length;
    
    document.getElementById('modalMorningCount').textContent = turnosMañana;
    document.getElementById('modalMixedCount').textContent = turnosMixtos;
    
    // Actualizar contador de 4 horas si existe el elemento
    const modal4HoursElement = document.getElementById('modal4HoursCount');
    if (modal4HoursElement) {
        modal4HoursElement.textContent = turnos4Horas;
    }
    
    document.getElementById('modalTotalCount').textContent = totalTurnos;
}

// ⭐ FUNCIÓN PARA ACTUALIZAR PROGRESO CUANDO SE AGREGA A PLANILLA
function agregarNuevoColaboradorAPlanillaConProgreso() {
    const colaboradorData = {
        id: selectedEmployee.id,
        nombre: selectedEmployee.nombre,
        puesto: selectedEmployee.puesto,
        shifts: [...currentShifts],
        turnosMañana: currentShifts.filter(s => s.turno === 1).length,
        turnosMixtos: currentShifts.filter(s => s.turno === 2).length,
        turnos4Horas: currentShifts.filter(s => s.turno === 3).length,
        totalTurnos: currentShifts.length,
        totalPago: calcularSalarioColaborador(currentShifts),
        fechaAgregado: new Date().toISOString()
    };
    
    payrollCollaborators.push(colaboradorData);
    
    // ⭐ ACTUALIZAR PROGRESO A "GENERAR" SI HAY COLABORADORES
    if (payrollCollaborators.length > 0) {
        actualizarProgresoVisual('generate');
    }
    
    // Limpiar selección actual
    currentShifts = [];
    
    // Actualizar vista de planilla y visibilidad de acciones
    actualizarVistaPlanilla();
    actualizarVisibilidadAcciones();
}

function actualizarIndicadoresSemana() {
    const calendarDays = document.querySelectorAll('.calendar-day:not(.other-month)');
    
    calendarDays.forEach(dayElement => {
        // Remover todos los indicadores anteriores
        dayElement.classList.remove('week-full', 'week-almost-full', 'can-select');
        
        if (!dayElement.classList.contains('other-month') && 
            !dayElement.classList.contains('sunday-blocked') &&
            !dayElement.classList.contains('holiday-national') &&
            !dayElement.classList.contains('holiday-departmental') &&
            !dayElement.classList.contains('easter-week') &&
            !dayElement.classList.contains('planilla-restricted') &&
            !dayElement.classList.contains('month-restricted')) {
            
            const dayNumber = parseInt(dayElement.textContent);
            const fecha = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber);
            const turnosEnSemana = contarTurnosEnSemana(fecha);
            const dateString = formatDate(fecha);
            const tieneAsignado = currentShifts.find(s => s.fecha === dateString);
            
            // Si ya tiene turno asignado, no cambiar nada
            if (tieneAsignado) {
                return;
            }
            
            // Agregar clases según la cantidad de turnos en la semana
            if (turnosEnSemana >= 4) {
                dayElement.classList.add('week-full');
                dayElement.title = `Semana completa - ${turnosEnSemana}/4 días usados`;
            } else if (turnosEnSemana === 3) {
                dayElement.classList.add('week-almost-full');
                dayElement.title = `Último día disponible - ${turnosEnSemana}/4 días usados`;
            } else {
                dayElement.classList.add('can-select');
                dayElement.title = `Disponible - ${turnosEnSemana}/4 días usados esta semana`;
            }
        }
    });
}

function actualizarVisibilidadAcciones() {
    const payrollActionsContainer = document.getElementById('payrollActionsContainer');
    const hasCollaborators = payrollCollaborators.length > 0;
    const hasCurrentEmployee = selectedEmployee !== null;
    
    // Mostrar contenedor de acciones si hay colaboradores en planilla O empleado actual seleccionado
    if (hasCollaborators || hasCurrentEmployee) {
        payrollActionsContainer.style.display = 'flex';
        
        // Habilitar/deshabilitar botones específicos
        const clearCurrentBtn = document.getElementById('clearCurrentShifts');
        const clearAllBtn = document.getElementById('clearAllPayroll');
        
        if (clearCurrentBtn) {
            clearCurrentBtn.disabled = !hasCurrentEmployee || currentShifts.length === 0;
        }
        
        if (clearAllBtn) {
            clearAllBtn.disabled = !hasCollaborators;
        }
    } else {
        payrollActionsContainer.style.display = 'none';
    }
}

function actualizarColaboradorEnPlanilla(index) {
    payrollCollaborators[index] = {
        ...payrollCollaborators[index],
        shifts: [...currentShifts],
        turnosMañana: currentShifts.filter(s => s.turno === 1).length,
        turnosMixtos: currentShifts.filter(s => s.turno === 2).length,
        turnos4Horas: currentShifts.filter(s => s.turno === 3).length,
        totalTurnos: currentShifts.length,
        totalPago: calcularSalarioColaborador(currentShifts),
        fechaActualizado: new Date().toISOString()
    };
    
    // Limpiar selección actual
    currentShifts = [];
    
    // Actualizar vista de planilla
    actualizarVistaPlanilla();
    
    Swal.fire({
        icon: 'success',
        title: 'Colaborador actualizado',
        text: 'Los turnos han sido actualizados exitosamente.',
        timer: 2000,
        showConfirmButton: false
    });
}

function actualizarVistaPlanilla() {
    const tableBody = document.getElementById('payrollTableBody');
    const emptyState = document.getElementById('emptyPayrollState');
    const payrollActionsContainer = document.getElementById('payrollActionsContainer');
    const payrollCount = document.getElementById('payrollCount');
    
    // Actualizar contador
    payrollCount.textContent = payrollCollaborators.length;
    
    if (payrollCollaborators.length === 0) {
        // Mostrar estado vacío
        tableBody.innerHTML = '';
        emptyState.style.display = 'flex';
        payrollActionsContainer.style.display = 'none';
    } else {
        // Mostrar tabla con colaboradores
        emptyState.style.display = 'none';
        payrollActionsContainer.style.display = 'flex';
        
        // Generar filas de la tabla
        tableBody.innerHTML = payrollCollaborators.map((colaborador, index) => `
            <tr>
                <td>
                    <div class="collaborator-name-cell">${colaborador.nombre}</div>
                    <div class="collaborator-id-cell">ID: ${colaborador.id}</div>
                </td>
                <td style="text-align: center;">
                    <span class="shift-count morning">${colaborador.turnosMañana}</span>
                </td>
                <td style="text-align: center;">
                    <span class="shift-count mixed">${colaborador.turnosMixtos}</span>
                </td>
                <td style="text-align: center;">
                    <span class="shift-count hours">${colaborador.turnos4Horas || 0}</span>
                    ${colaborador.turnos4Horas > 0 ? `
                        <div style="font-size: 0.65rem; color: #6b7280; margin-top: 2px; line-height: 1.2;">
                            ${obtenerDetallesTurnos4Horas(colaborador.shifts)}
                        </div>
                    ` : ''}
                </td>
                <td style="text-align: center;">
                    <span class="shift-count total">${colaborador.totalTurnos}</span>
                </td>
                <td style="text-align: right;">
                    <span class="payment-amount">Q ${colaborador.totalPago.toFixed(2)}</span>
                </td>
                <td style="text-align: center;">
                    <div class="table-actions">
                        <button class="btn-table-action btn-edit" onclick="editarColaborador(${index})" title="Editar turnos">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-table-action btn-remove" onclick="eliminarColaboradorDePlanilla(${index})" title="Eliminar de planilla">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Actualizar totales generales
        actualizarTotalesGenerales();
    }
}

function obtenerDetallesTurnos4Horas(shifts) {
    const turnos4h = shifts.filter(s => s.turno === 3);
    if (turnos4h.length === 0) return '';
    
    const mañana = turnos4h.filter(s => s.subTurno === 1).length;
    const mixto = turnos4h.filter(s => s.subTurno === 2).length;
    
    const detalles = [];
    if (mañana > 0) detalles.push(`${mañana}M`);
    if (mixto > 0) detalles.push(`${mixto}X`);
    
    return detalles.length > 0 ? `(${detalles.join(', ')})` : '';
}

function actualizarTotalesGenerales() {
    const totalColaboradores = payrollCollaborators.length;
    const totalTurnos = payrollCollaborators.reduce((sum, c) => sum + c.totalTurnos, 0);
    
    // ⭐ CALCULAR TOTAL CON REDONDEO
    const totalPago = payrollCollaborators.reduce((sum, c) => sum + c.totalPago, 0);
    const totalPagoRedondeado = redondearMonto(totalPago);
    
    // Calcular desglose de turnos
    const totalTurnosMañana = payrollCollaborators.reduce((sum, c) => sum + c.turnosMañana, 0);
    const totalTurnosMixtos = payrollCollaborators.reduce((sum, c) => sum + c.turnosMixtos, 0);
    const totalTurnos4Horas = payrollCollaborators.reduce((sum, c) => sum + c.turnos4Horas, 0);
    
    // Actualizar elementos básicos
    document.getElementById('totalCollaborators').textContent = totalColaboradores;
    document.getElementById('totalShifts').textContent = totalTurnos;
    document.getElementById('totalAmount').textContent = `Q ${totalPagoRedondeado.toFixed(2)}`;
    
    // Actualizar detalles adicionales si existen los elementos
    const detailsElement = document.getElementById('shiftsBreakdown');
    if (detailsElement) {
        detailsElement.innerHTML = `
            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 4px;">
                ${totalTurnosMañana > 0 ? `${totalTurnosMañana} Mañana` : ''}
                ${totalTurnosMañana > 0 && (totalTurnosMixtos > 0 || totalTurnos4Horas > 0) ? ' • ' : ''}
                ${totalTurnosMixtos > 0 ? `${totalTurnosMixtos} Mixtos` : ''}
                ${totalTurnosMixtos > 0 && totalTurnos4Horas > 0 ? ' • ' : ''}
                ${totalTurnos4Horas > 0 ? `${totalTurnos4Horas} de 4H` : ''}
            </div>
        `;
    }
}

function editarColaborador(index) {
    const colaborador = payrollCollaborators[index];
    
    Swal.fire({
        title: 'Editar colaborador',
        text: `¿Desea cargar los turnos de ${colaborador.nombre} para editarlos?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, editar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1e40af'
    }).then((result) => {
        if (result.isConfirmed) {
            // Buscar y seleccionar el colaborador en la lista
            const collaboratorItem = document.querySelector(`[data-employee-id="${colaborador.id}"]`);
            if (collaboratorItem) {
                // Simular selección del colaborador
                const colaboradorData = allCollaborators.find(c => c.IdPersonal === colaborador.id);
                if (colaboradorData) {
                    seleccionarColaboradorConProgreso(colaboradorData, collaboratorItem);
                    // Cargar los turnos existentes
                    currentShifts = [...colaborador.shifts];
                    
                    Swal.fire({
                        icon: 'info',
                        title: 'Turnos cargados',
                        text: 'Los turnos han sido cargados. Puede editarlos y guardar los cambios.',
                        confirmButtonColor: '#1e40af'
                    });
                }
            }
        }
    });
}

function eliminarColaboradorDePlanilla(index) {
    const colaborador = payrollCollaborators[index];
    
    Swal.fire({
        title: '¿Eliminar colaborador?',
        text: `Se eliminará a ${colaborador.nombre} de la planilla.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444'
    }).then((result) => {
        if (result.isConfirmed) {
            payrollCollaborators.splice(index, 1);
            actualizarVistaPlanilla();
            
            Swal.fire({
                icon: 'success',
                title: 'Colaborador eliminado',
                text: 'El colaborador ha sido eliminado de la planilla.',
                timer: 1500,
                showConfirmButton: false
            });
        }
    });
}

function limpiarTodaLaPlanilla() {
    if (payrollCollaborators.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Planilla vacía',
            text: 'No hay colaboradores en la planilla para limpiar.',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }
    
    Swal.fire({
        title: '¿Limpiar toda la planilla?',
        text: `Se eliminarán todos los ${payrollCollaborators.length} colaboradores de la planilla.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, limpiar todo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f43f5e'
    }).then((result) => {
        if (result.isConfirmed) {
            payrollCollaborators = [];
            actualizarVistaPlanilla();
            actualizarVisibilidadAcciones();
            
            Swal.fire({
                icon: 'success',
                title: 'Planilla limpiada',
                text: 'Todos los colaboradores han sido eliminados.',
                timer: 2000,
                showConfirmButton: false
            });
        }
    });
}

function calcularSalarioColaborador(shifts) {
    const region = isCapitalino ? 'capitalino' : 'regional';
    if (!salaryRates[region] || shifts.length === 0) return 0;
    
    let total = 0;
    
    shifts.forEach(shift => {
        if (shift.turno === 1) {
            // Turno de mañana completo
            if (salaryRates[region][1]) {
                total += salaryRates[region][1].salarioXturno;
            }
        } else if (shift.turno === 2) {
            // Turno mixto completo
            if (salaryRates[region][2]) {
                total += salaryRates[region][2].salarioXturno;
            }
        } else if (shift.turno === 3) {
            // Turno de 4 horas - usar tarifa según subtipo
            const tarifaBase = shift.subTurno === 1 ? 
                salaryRates[region][1]?.salarioXhora : // Tarifa de mañana
                salaryRates[region][2]?.salarioXhora;  // Tarifa mixta
            
            if (tarifaBase) {
                total += tarifaBase * 4; // 4 horas × tarifa correspondiente
            }
        }
    });
    
    // ⭐ APLICAR REDONDEO AL TOTAL
    return redondearMonto(total);
}

function redondearMonto(monto) {
    // Redondear al múltiplo de 0.05 más cercano
    return Math.round(monto / 0.05) * 0.05;
}

function limpiarSelecciones() {
    limpiarSeleccionEmpleado();
    document.getElementById('searchCollaborator').value = '';
}

function limpiarSeleccionEmpleado() {
    // Remover selección visual
    document.querySelectorAll('.collaborator-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Limpiar variables
    selectedEmployee = null;
    currentShifts = [];
    
    // Mantener la planilla visible pero mostrar bienvenida si no hay colaboradores
    if (payrollCollaborators.length === 0) {
        document.getElementById('welcomeState').style.display = 'flex';
    }
    
    // Actualizar visibilidad de acciones
    actualizarVisibilidadAcciones();
}

// ⭐ INICIALIZACIÓN DE EVENT LISTENERS ACTUALIZADA
function inicializarEventos() {
    // Función auxiliar para agregar event listener seguro
    const addSafeEventListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Elemento con ID '${id}' no encontrado`);
        }
    };

    // ⭐ USAR LAS NUEVAS FUNCIONES CON PROGRESO
    addSafeEventListener('tipoQuincena', 'change', validarFormularioConProgreso);
    addSafeEventListener('mesPlanilla', 'change', validarFormularioConProgreso);
    addSafeEventListener('anioPlanilla', 'change', validarFormularioConProgreso);
    addSafeEventListener('confirmarPlanilla', 'click', confirmarSeleccionPlanillaConTransiciones);
    addSafeEventListener('fechaInicio', 'change', validarFormularioConProgreso);
    addSafeEventListener('fechaFin', 'change', validarFormularioConProgreso);

    // Resto de event listeners...
    addSafeEventListener('changePlanilla', 'click', cambiarConfiguracionPlanillaConReset);
    addSafeEventListener('searchCollaborator', 'input', filtrarColaboradores);
    addSafeEventListener('clearAllPayroll', 'click', limpiarTodaLaPlanilla);
    addSafeEventListener('generateFinalPayroll', 'click', solicitarAutorizacionPlanilla);
    addSafeEventListener('closeCalendarModal', 'click', cerrarCalendario);
    
    // Event listeners del calendario y modales...
    const calendarModal = document.getElementById('calendarModal');
    if (calendarModal) {
        calendarModal.addEventListener('click', (e) => {
            if (e.target.id === 'calendarModal') {
                cerrarCalendario();
            }
        });
    }
    
    // Navegación del calendario
    addSafeEventListener('prevMonth', 'click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        actualizarCalendario();
    });
    
    addSafeEventListener('nextMonth', 'click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        actualizarCalendario();
    });
    
    // Botones del modal del calendario
    addSafeEventListener('saveAndCloseCalendar', 'click', guardarYCerrarCalendario);
    addSafeEventListener('clearShiftsFromModal', 'click', () => {
        if (currentShifts.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Sin turnos',
                text: 'No hay turnos para limpiar.',
                confirmButtonColor: '#4f46e5'
            });
            return;
        }
        
        Swal.fire({
            title: '¿Limpiar todos los turnos?',
            text: `Se eliminarán todos los ${currentShifts.length} turnos registrados.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, limpiar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#f43f5e'
        }).then((result) => {
            if (result.isConfirmed) {
                currentShifts = [];
                actualizarCalendario();
                actualizarResumenModal();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Turnos limpiados',
                    text: 'Todos los turnos han sido eliminados.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    });
    
    // Eventos del modal de selección de turno
    addSafeEventListener('closeModal', 'click', cerrarModal);
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('shift-option') || e.target.closest('.shift-option')) {
            const button = e.target.classList.contains('shift-option') ? e.target : e.target.closest('.shift-option');
            seleccionarTipoTurno(button.dataset.shift);
        }
    });
    
    // Cerrar modal de selección de turno
    const shiftModal = document.getElementById('shiftModal');
    if (shiftModal) {
        shiftModal.addEventListener('click', (e) => {
            if (e.target.id === 'shiftModal') {
                cerrarModal();
            }
        });
    }
    configurarFechasMinimas();
    console.log('Event listeners inicializados correctamente');
}

// Función para solicitar autorización y guardar planilla
async function solicitarAutorizacionPlanilla() {
    // Validar que el usuario esté autenticado
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData) {
        Swal.fire({
            icon: 'error',
            title: 'Sesión expirada',
            text: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.',
            confirmButtonColor: '#1e40af'
        }).then(() => {
            // Redirigir al login
            window.location.href = '../Login.html';
        });
        return;
    }

    // Validar que hay colaboradores en la planilla
    if (payrollCollaborators.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Planilla vacía',
            text: 'No hay colaboradores en la planilla para guardar.',
            confirmButtonColor: '#1e40af'
        });
        return;
    }

    // Validar que la configuración de planilla esté completa
    if (!planillaConfig.confirmada) {
        Swal.fire({
            icon: 'error',
            title: 'Configuración incompleta',
            text: 'Debe configurar el tipo de planilla antes de guardar.',
            confirmButtonColor: '#1e40af'
        });
        return;
    }

    // Mostrar resumen antes de guardar
    const totalColaboradores = payrollCollaborators.length;
    const totalTurnos = payrollCollaborators.reduce((sum, c) => sum + c.totalTurnos, 0);
    const totalPago = payrollCollaborators.reduce((sum, c) => sum + c.totalPago, 0);
    const tipoPlanillaTexto = 'Planilla por Período';
    const periodoTexto = formatearPeriodoSeguro(planillaConfig.fechaInicio, planillaConfig.fechaFin);
    
    // Obtener nombre del departamento
    const nombreDepartamento = await obtenerInfoDepartamentoParaResumen();

    const result = await Swal.fire({
        title: '¿Solicitar autorización de planilla?',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #1e40af; margin-bottom: 15px; text-align: center;">📋 Resumen de Planilla</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div><strong>Tipo:</strong> ${tipoPlanillaTexto}</div>
                        <div><strong>Período:</strong> ${periodoTexto}</div>
                        <div><strong>Colaboradores:</strong> ${totalColaboradores}</div>
                        <div><strong>Total turnos:</strong> ${totalTurnos}</div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 15px; padding: 15px; background: #e8f5e8; border-radius: 6px; border: 2px solid #10b981;">
                        <strong style="color: #059669; font-size: 1.2rem;">Total a pagar: Q ${totalPago.toFixed(2)}</strong>
                    </div>
                </div>

                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #2196f3;">
                    <p style="margin: 0; color: #1565c0;">
                        <strong>👤 Usuario:</strong> ${userData.NombreCompleto}<br>
                        <strong>🏢 Sucursal:</strong> ${nombreDepartamento}<br>
                        <strong>📅 Fecha:</strong> ${new Date().toLocaleDateString('es-GT')}
                    </p>
                </div>

                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <p style="margin: 0; color: #856404;">
                        <strong>⚠️ Importante:</strong> Una vez guardada, la planilla será enviada para autorización y no podrá ser modificada.
                    </p>
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '✅ Sí, solicitar autorización',
        cancelButtonText: '❌ Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6c757d',
        width: '600px'
    });

    if (result.isConfirmed) {
        await guardarPlanillaEnBD();
    }
}

// Función principal para guardar la planilla en la base de datos
async function guardarPlanillaEnBD() {
    const loadingSwal = mostrarCargando('Guardando planilla...');
    
    try {
        const connection = await connectionString();
        
        // Obtener información del usuario logueado desde localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData) {
            throw new Error('No se encontraron datos del usuario. Por favor, inicie sesión nuevamente.');
        }
        
        const idUsuario = userData.IdPersonal;
        const nombreUsuario = userData.NombreCompleto;
        
        // === PASO 1: Insertar encabezado de planilla ===
        const totalPago = payrollCollaborators.reduce((sum, c) => sum + c.totalPago, 0);
        const totalPagoRedondeado = redondearMonto(totalPago); // ⭐ REDONDEAR TOTAL GENERAL
        const totalColaboradores = payrollCollaborators.length;
        
        // Determinar IdTipoPago basado en el tipo de planilla
        const idTipoPago = planillaConfig.tipo === 'quincenal' ? 1 : 2;
        const tipoPagoTexto = planillaConfig.tipo === 'quincenal' ? 'Planilla Quincenal' : 'Planilla Fin de Mes';
        
        const insertPlanilla = await connection.query(`
            INSERT INTO PagoPlanillaParcial (
                IdDepartamentoSucursal,
                MontoPlanillaParcial,
                CantidadColaboradores,
                PeriodoPago,
                IdUsuario,
                NombreUsuario
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            currentDepartamentoId,
            totalPagoRedondeado,
            totalColaboradores.toString(),
            formatearPeriodoParaBD(planillaConfig.fechaInicio, planillaConfig.fechaFin),
            idUsuario,
            nombreUsuario
        ]);
        
        const idPlanillaParcial = insertPlanilla.insertId;
        
        // === PASO 2: Insertar detalles de la planilla ===
        const detallesPromises = [];
        
        for (const colaborador of payrollCollaborators) {
            // Insertar cada turno como un registro separado
            for (const shift of colaborador.shifts) {
                // Calcular monto pagado para este turno específico
                const region = isCapitalino ? 'capitalino' : 'regional';
                let montoPagado = 0;
                
                if (shift.turno === 1 && salaryRates[region][1]) {
                    montoPagado = salaryRates[region][1].salarioXturno;
                } else if (shift.turno === 2 && salaryRates[region][2]) {
                    montoPagado = salaryRates[region][2].salarioXturno;
                } else if (shift.turno === 3 && salaryRates[region][1]) {
                    // Turno de 4 horas usa salario por hora * 4
                    const tarifaBase = shift.subTurno === 1 ? 
                        salaryRates[region][1].salarioXhora : 
                        salaryRates[region][2].salarioXhora;
                    montoPagado = tarifaBase * 4;
                }
                
                // ⭐ REDONDEAR MONTO INDIVIDUAL
                montoPagado = redondearMonto(montoPagado);
                
                // Determinar nombre del tipo de turno
                let tipoTurnoTexto = '';
                switch(shift.turno) {
                    case 1:
                        tipoTurnoTexto = 'Turno Mañana';
                        break;
                    case 2:
                        tipoTurnoTexto = 'Turno Mixto';
                        break;
                    case 3:
                        const subTipoTexto = shift.subTurno === 1 ? 'Mañana' : 'Mixto';
                        tipoTurnoTexto = `Turno 4 Horas (${subTipoTexto})`;
                        break;
                }
                
                const detallePromise = connection.query(`
                    INSERT INTO PagoPlanillaParcialDetalle (
                        IdPlanillaParcial,
                        IdPersonal,
                        NombrePersonal,
                        FechaLaborada,
                        IdTipoTurno,
                        TipoTurno,
                        MontoPagado
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    idPlanillaParcial,
                    colaborador.id,
                    colaborador.nombre,
                    shift.fecha,
                    shift.turno,
                    tipoTurnoTexto,
                    montoPagado // ⭐ MONTO REDONDEADO
                ]);
                
                detallesPromises.push(detallePromise);
            }
        }
        
        // Ejecutar todas las inserciones de detalles
        await Promise.all(detallesPromises);
        
        await connection.close();
        
        // Cerrar loading
        Swal.close();
        
        // Mostrar éxito
        await Swal.fire({
            icon: 'success',
            title: '¡Planilla guardada exitosamente!',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border: 2px solid #10b981;">
                        <h4 style="color: #059669; margin-bottom: 15px; text-align: center;">✅ Detalles de la operación</h4>
                        
                        <div style="margin-bottom: 10px;"><strong>📋 ID Planilla:</strong> ${idPlanillaParcial}</div>
                        <div style="margin-bottom: 10px;"><strong>👥 Colaboradores:</strong> ${totalColaboradores}</div>
                        <div style="margin-bottom: 10px;"><strong>📊 Registros detalle:</strong> ${detallesPromises.length}</div>
                        <div style="margin-bottom: 10px;"><strong>💰 Monto total:</strong> Q ${totalPagoRedondeado.toFixed(2)}</div>
                        <div><strong>📅 Fecha:</strong> ${new Date().toLocaleDateString('es-GT')}</div>
                    </div>
                    
                    <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #17a2b8;">
                        <p style="margin: 0; color: #0c5460;">
                            <strong>ℹ️ Información:</strong> La planilla ha sido enviada para autorización. Puede consultar el estado en el módulo de reportes.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#10b981',
            width: '550px'
        });
        
        // Limpiar planilla después de guardar exitosamente
        limpiarTodaLaPlanillaCompleta();
        
    } catch (error) {
        console.error('Error al guardar planilla:', error);
        
        Swal.close();
        
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar planilla',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #f8d7da; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545;">
                        <p style="margin-bottom: 10px; color: #721c24;">
                            <strong>❌ Error técnico:</strong> No se pudo guardar la planilla en la base de datos.
                        </p>
                        <p style="margin: 0; color: #721c24; font-size: 0.9rem;">
                            <strong>Detalles:</strong> ${error.message || 'Error desconocido'}
                        </p>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #ffc107;">
                        <p style="margin: 0; color: #856404;">
                            <strong>💡 Sugerencia:</strong> Verifique la conexión a la base de datos y vuelva a intentarlo.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#dc3545',
            width: '500px'
        });
    }
}

// Función para limpiar completamente la planilla después de guardar
function limpiarTodaLaPlanillaCompleta() {
    console.log('Iniciando reset completo del sistema...');
    
    // ===== PASO 1: LIMPIAR DATOS =====
    payrollCollaborators = [];
    currentShifts = [];
    selectedEmployee = null;
    allCollaborators = [];
    
    // ===== PASO 2: RESETEAR CONFIGURACIÓN DE PLANILLA =====
    planillaConfig = {
        fechaInicio: null,
        fechaFin: null,
        confirmada: false
    };
    
    // ===== PASO 3: RESETEAR FORMULARIO DE CONFIGURACIÓN =====
    const tipoQuincena = document.getElementById('tipoQuincena');
    const mesPlanilla = document.getElementById('mesPlanilla');
    const anioPlanilla = document.getElementById('anioPlanilla');
    const confirmarBtn = document.getElementById('confirmarPlanilla');
    const fechaInicio = document.getElementById('fechaInicio');
    const fechaFin = document.getElementById('fechaFin');

    if (fechaInicio) fechaInicio.value = '';
    if (fechaFin) fechaFin.value = '';
    if (tipoQuincena) tipoQuincena.value = '';
    if (mesPlanilla) mesPlanilla.value = '';
    if (anioPlanilla) anioPlanilla.value = '';
    
    // Resetear estado del botón
    if (confirmarBtn) {
        confirmarBtn.disabled = true;
        confirmarBtn.classList.remove('ready');
        confirmarBtn.innerHTML = `
            <i class="fas fa-cog"></i>
            <span>Complete todos los campos</span>
        `;
    }
    
    // ===== PASO 4: VOLVER AL ESTADO INICIAL DE CONFIGURACIÓN =====
    // Ocultar elementos nuevamente
    ocultarElementosHastaConfigurar();
    
    // Aplicar modo configuración
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        mainContainer.classList.add('config-mode');
        mainContainer.classList.remove('normal-mode');
    }
    
    // ===== PASO 5: MOSTRAR SECCIÓN DE CONFIGURACIÓN =====
    const payrollTypeSection = document.querySelector('.payroll-type-section');
    const form = document.getElementById('payrollTypeForm');
    const confirmed = document.getElementById('payrollConfirmed');
    const planillaInfo = document.getElementById('planillaInfo');
    
    if (payrollTypeSection) {
        payrollTypeSection.classList.remove('hidden', 'panel-fade-out');
        payrollTypeSection.style.display = 'block';
        payrollTypeSection.style.maxWidth = '800px';
        payrollTypeSection.style.margin = '0 auto';
    }
    
    if (form) form.style.display = 'block';
    if (confirmed) confirmed.style.display = 'none';
    if (planillaInfo) planillaInfo.style.display = 'none';
    
    // ===== PASO 6: RESETEAR PROGRESO VISUAL A INICIAL =====
    actualizarProgresoVisual('config');
    
    // ===== PASO 7: LIMPIAR SELECCIONES VISUALES =====
    document.querySelectorAll('.collaborator-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // ===== PASO 8: OCULTAR SECCIONES QUE NO DEBEN ESTAR VISIBLES =====
    const collaboratorsSection = document.getElementById('collaboratorsSection');
    const payrollSection = document.getElementById('payrollSection');
    const welcomeState = document.getElementById('welcomeState');
    
    if (collaboratorsSection) {
        collaboratorsSection.style.display = 'none';
        // Limpiar lista de colaboradores
        const collaboratorsList = document.getElementById('collaboratorsList');
        const collaboratorCount = document.getElementById('collaboratorCount');
        const searchInput = document.getElementById('searchCollaborator');
        
        if (collaboratorsList) collaboratorsList.innerHTML = '';
        if (collaboratorCount) collaboratorCount.textContent = '0';
        if (searchInput) searchInput.value = '';
    }
    
    if (payrollSection) payrollSection.style.display = 'none';
    if (welcomeState) welcomeState.style.display = 'none';
    
    // ===== PASO 9: ACTUALIZAR VISTA DE PLANILLA =====
    actualizarVistaPlanilla();
    actualizarVisibilidadAcciones();
}

// NUEVA FUNCIÓN: Obtener información del departamento para el resumen
async function obtenerInfoDepartamentoParaResumen() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData) return 'Departamento no disponible';

        const connection = await connectionString();
        const result = await connection.query(`
            SELECT NombreDepartamento 
            FROM departamentos 
            WHERE IdDepartamento = ?
        `, [currentDepartamentoId]);
        await connection.close();

        return result[0]?.NombreDepartamento || userData.NombreDepartamento;
    } catch (error) {
        console.error('Error al obtener información del departamento:', error);
        const userData = JSON.parse(localStorage.getItem('userData'));
        return userData?.NombreDepartamento || 'Departamento no disponible';
    }
}

// ===== FUNCIONES AUXILIARES Y VALIDACIONES =====

async function cargarDiasEspeciales(departamentoId) {
    try {
        const connection = await connectionString();
        
        const result = await connection.query(`
            SELECT 
                Dia, 
                Mes, 
                IdDepartamento, 
                Descripcion 
            FROM DiasEspeciales 
            WHERE IdDepartamento = 0 OR IdDepartamento = ?
            ORDER BY Mes, Dia
        `, [departamentoId]);
        
        await connection.close();
        
        diasEspeciales = result.map(dia => ({
            dia: parseInt(dia.Dia),
            mes: parseInt(dia.Mes),
            idDepartamento: parseInt(dia.IdDepartamento),
            descripcion: dia.Descripcion,
            esNacional: dia.IdDepartamento === 0
        }));
        
        console.log(`Días especiales cargados para departamento ${departamentoId}:`, diasEspeciales);
        
        if (document.getElementById('calendarModal').style.display === 'block') {
            actualizarCalendario();
        }
        
    } catch (error) {
        console.error('Error al cargar días especiales:', error);
        diasEspeciales = [];
    }
}

function esDiaEspecial(fecha) {
    const date = new Date(fecha);
    const dia = date.getDate();
    const mes = date.getMonth() + 1;
    
    return diasEspeciales.find(diaEspecial => 
        diaEspecial.dia === dia && diaEspecial.mes === mes
    );
}

function calcularDomingoPascua(año) {
    const a = año % 19;
    const b = Math.floor(año / 100);
    const c = año % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = Math.floor((h + l - 7 * m + 114) / 31);
    const p = (h + l - 7 * m + 114) % 31;
    
    return new Date(año, n - 1, p + 1);
}

function calcularFechasSemanaSanta(año) {
    const domingoPascua = calcularDomingoPascua(año);
    const fechas = [];
    
    const diasSemanaSanta = [
        { nombre: 'Domingo de Ramos', diasAntes: 7, bloqueado: false },
        { nombre: 'Lunes Santo', diasAntes: 6, bloqueado: true },
        { nombre: 'Martes Santo', diasAntes: 5, bloqueado: true },
        { nombre: 'Miércoles Santo', diasAntes: 4, bloqueado: true },
        { nombre: 'Jueves Santo', diasAntes: 3, bloqueado: true },
        { nombre: 'Viernes Santo', diasAntes: 2, bloqueado: true },
        { nombre: 'Sábado de Gloria', diasAntes: 1, bloqueado: true },
        { nombre: 'Domingo de Pascua', diasAntes: 0, bloqueado: false }
    ];
    
    diasSemanaSanta.forEach(dia => {
        if (dia.bloqueado) {
            const fecha = new Date(domingoPascua);
            fecha.setDate(domingoPascua.getDate() - dia.diasAntes);
            
            fechas.push({
                fecha: formatDate(fecha),
                fechaObj: new Date(fecha),
                nombre: dia.nombre,
                esPascua: true
            });
        }
    });
    
    return fechas;
}

function generarFechasSemanaSanta() {
    const añoActual = new Date().getFullYear();
    const añoSiguiente = añoActual + 1;
    
    fechasSemanaSanta = [
        ...calcularFechasSemanaSanta(añoActual),
        ...calcularFechasSemanaSanta(añoSiguiente)
    ];
    
    console.log(`Fechas de Semana Santa cargadas para ${añoActual}-${añoSiguiente}:`, fechasSemanaSanta);
}

function esSemanaSanta(fecha) {
    const dateString = formatDate(fecha);
    return fechasSemanaSanta.find(pascua => pascua.fecha === dateString);
}

function mostrarErrorMesActual(fecha, validacion) {
    const fechaFormateada = formatDateDisplay(fecha);
    const fechaActual = new Date();
    const mesActualNombre = fechaActual.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    const mesFechaNombre = fecha.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    
    let titulo, mensaje, icono;
    
    switch (validacion.motivo) {
        case 'mes_pasado':
            titulo = 'Mes anterior no permitido';
            icono = 'warning';
            mensaje = `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>📅 Fecha seleccionada:</strong> ${fechaFormateada}</p>
                    <p><strong>📊 Mes de la fecha:</strong> ${mesFechaNombre}</p>
                    <p><strong>📅 Mes actual:</strong> ${mesActualNombre}</p>
                    <br>
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e;">
                            <strong>⚠️ Restricción temporal:</strong> No se pueden asignar turnos en meses anteriores. Solo se permite trabajar en el mes actual.
                        </p>
                    </div>
                </div>
            `;
            break;
            
        case 'mes_futuro':
            titulo = 'Mes futuro no permitido';
            icono = 'info';
            mensaje = `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>📅 Fecha seleccionada:</strong> ${fechaFormateada}</p>
                    <p><strong>📊 Mes de la fecha:</strong> ${mesFechaNombre}</p>
                    <p><strong>📅 Mes actual:</strong> ${mesActualNombre}</p>
                    <br>
                    <div style="background: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <p style="margin: 0; color: #1e40af;">
                            <strong>ℹ️ Restricción temporal:</strong> No se pueden asignar turnos en meses futuros. Solo se permite trabajar en el mes actual.
                        </p>
                    </div>
                </div>
            `;
            break;
            
        default:
            titulo = 'Fecha no válida';
            icono = 'error';
            mensaje = `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>📅 Fecha seleccionada:</strong> ${fechaFormateada}</p>
                    <br>
                    <div style="background: #fecaca; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin: 0; color: #991b1b;">
                            <strong>❌ Error:</strong> La fecha seleccionada no es válida. Solo se permite trabajar en el mes actual.
                        </p>
                    </div>
                </div>
            `;
    }
    
    Swal.fire({
        icon: icono,
        title: titulo,
        html: mensaje,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#1e40af',
        width: '600px'
    });
}

function mostrarErrorPeriodo(fecha, validacion) {
    const fechaFormateada = formatDateDisplay(fecha);
    
    let titulo, mensaje, icono;
    
    if (validacion.motivo === 'fuera_periodo') {
        titulo = 'Fuera del período configurado';
        icono = 'warning';
        
        const periodoTexto = formatearPeriodo(validacion.fechaInicio, validacion.fechaFin);
        
        mensaje = `
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>📅 Fecha seleccionada:</strong> ${fechaFormateada}</p>
                <p><strong>📋 Período configurado:</strong> ${periodoTexto}</p>
                <br>
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e;">
                        <strong>⚠️ Restricción de período:</strong> Solo se pueden asignar turnos dentro del período configurado.
                    </p>
                </div>
            </div>
        `;
    } else {
        titulo = 'Error de configuración';
        icono = 'error';
        mensaje = `
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>📅 Fecha seleccionada:</strong> ${fechaFormateada}</p>
                <br>
                <div style="background: #fecaca; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #991b1b;">
                        <strong>❌ Error:</strong> No se puede determinar las restricciones de fecha. Por favor, verifique la configuración de la planilla.
                    </p>
                </div>
            </div>
        `;
    }
    
    Swal.fire({
        icon: icono,
        title: titulo,
        html: mensaje,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#1e40af',
        width: '600px'
    });
}
function formatearPeriodoParaBD(fechaInicio, fechaFin) {
    // Formato: "2025-01-15 a 2025-01-31"
    return `${fechaInicio} a ${fechaFin}`;
}
function parsearPeriodoDesdeBD(periodoBD) {
    // Parsear: "2025-01-15 a 2025-01-31" -> {inicio: "2025-01-15", fin: "2025-01-31"}
    const partes = periodoBD.split(' a ');
    return {
        inicio: partes[0],
        fin: partes[1]
    };
}
//Valiación de planillas duplicadas
async function verificarPeriodoExistente(fechaInicio, fechaFin, departamentoId) {
    try {
        const connection = await connectionString();
        
        // ✅ NUEVA CONSULTA: Obtener TODOS los períodos activos del departamento
        const result = await connection.query(`
            SELECT 
                p.IdPlanillaParcial,
                p.PeriodoPago,
                p.MontoPlanillaParcial,
                p.CantidadColaboradores,
                p.NombreUsuario,
                p.FechaRegistro,
                p.Estado as IdEstado,
                e.NombreEstado
            FROM PagoPlanillaParcial p
            INNER JOIN PagoPlanillaParcialEstados e ON p.Estado = e.IdEstadoPagoPlanillaParcial
            WHERE 
                p.IdDepartamentoSucursal = ? AND
                p.Estado != 6
            ORDER BY p.FechaRegistro DESC
        `, [departamentoId]);
        
        await connection.close();
        
        // Si no hay resultados, no existe conflicto
        if (result.length === 0) {
            return null;
        }
        
        // ✅ NUEVA LÓGICA: Verificar solapamiento con cada período existente
        for (const planillaExistente of result) {
            const periodoExistente = parsearPeriodoDesdeBD(planillaExistente.PeriodoPago);
            
            // Verificar si hay solapamiento
            const haySolapamiento = verificarSolapamientoFechas(
                fechaInicio, fechaFin,
                periodoExistente.inicio, periodoExistente.fin
            );
            
            if (haySolapamiento) {
                // ✅ AGREGAR información del conflicto
                const diasConflicto = obtenerDiasEnConflicto(
                    fechaInicio, fechaFin,
                    periodoExistente.inicio, periodoExistente.fin
                );
                
                return {
                    ...planillaExistente,
                    tipoConflicto: 'solapamiento',
                    periodoExistente: periodoExistente,
                    periodoNuevo: { inicio: fechaInicio, fin: fechaFin },
                    diasEnConflicto: diasConflicto
                };
            }
        }
        
        // Si llegamos aquí, no hay conflictos
        return null;
        
    } catch (error) {
        console.error('Error al verificar período existente:', error);
        throw error;
    }
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatDateDisplay(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('es-GT', options);
}

function obtenerFechasSemana(fecha) {
    const date = new Date(fecha);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const lunes = new Date(date.getFullYear(), date.getMonth(), diff);
    
    const fechasSemana = [];
    for (let i = 0; i < 7; i++) {
        const fechaDia = new Date(lunes);
        fechaDia.setDate(lunes.getDate() + i);
        fechasSemana.push(formatDate(fechaDia));
    }
    
    return fechasSemana;
}

function contarTurnosEnSemana(fecha) {
    const fechasSemana = obtenerFechasSemana(fecha);
    return currentShifts.filter(shift => fechasSemana.includes(shift.fecha)).length;
}

function mostrarCargando(mensaje = "Cargando...") {
    return Swal.fire({
        title: mensaje,
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                <div class="spinner" style="border: 4px solid #f3f4f6; border-top: 4px solid #1e40af; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
                <p style="color: #6b7280; margin: 0;">Por favor espere...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `,
        showConfirmButton: false,
        allowOutsideClick: false
    });
}

function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        confirmButtonColor: '#1e40af'
    });
}

function ajustarAlturaLista() {
    const collaboratorsList = document.getElementById('collaboratorsList');
    const colaboradoresSection = document.getElementById('collaboratorsSection');
    
    if (collaboratorsList && colaboradoresSection.style.display !== 'none') {
        // Forzar recálculo de altura
        collaboratorsList.style.maxHeight = 'none';
        setTimeout(() => {
            collaboratorsList.style.maxHeight = 'calc(100vh - 250px)';
        }, 10);
    }
}
//Funciones para poder generar el PDF
async function verificarPlanillaEstado1() {
    try {
        // Obtener datos del usuario logueado
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData || !currentDepartamentoId) {
            console.log('No hay datos de usuario o departamento');
            return null;
        }

        const connection = await connectionString();
        
        // ✅ BUSCAR solo planillas en Estado 1 (Autorizado), no Estado 2 (Documento Descargado)
        const result = await connection.query(`
            SELECT 
                p.IdPlanillaParcial,
                p.PeriodoPago,
                p.MontoPlanillaParcial,
                p.CantidadColaboradores,
                p.FechaRegistro,
                e.NombreEstado
            FROM PagoPlanillaParcial p
            INNER JOIN PagoPlanillaParcialEstados e ON p.Estado = e.IdEstadoPagoPlanillaParcial
            WHERE 
                p.IdDepartamentoSucursal = ? AND 
                p.Estado = 1
            ORDER BY p.FechaRegistro DESC
            LIMIT 1
        `, [currentDepartamentoId]);
        
        await connection.close();
        
        if (result.length > 0) {
            console.log('Planilla encontrada en Estado 1 (Autorizado):', result[0]);
            return result[0];
        }
        
        return null;
        
    } catch (error) {
        console.error('Error al verificar planilla en Estado 1:', error);
        return null;
    }
}

// ===== FUNCIÓN PARA MOSTRAR/OCULTAR BOTÓN PDF =====
async function actualizarVisibilidadBotonPDF() {
    const botonPDF = document.getElementById('descargarPDF');
    
    if (!botonPDF) {
        console.log('Botón PDF no encontrado');
        return;
    }
    
    try {
        const planillaAutorizada = await verificarPlanillaEstado1();
        
        if (planillaAutorizada) {
            // Mostrar botón PDF y agregar información
            botonPDF.style.display = 'flex';
            botonPDF.disabled = false;
            botonPDF.classList.add('ready');
            
            // Actualizar tooltip con información del período
            const periodo = parsearPeriodoDesdeBDSeguro(planillaAutorizada.PeriodoPago);
            const periodoTexto = formatearPeriodoSeguro(periodo.inicio, periodo.fin);
            
            botonPDF.title = `Descargar PDF - Período ${periodoTexto}`;
            
            // Guardar datos de la planilla para el PDF
            window.planillaParaPDF = planillaAutorizada;
            
            console.log('✅ Botón PDF habilitado para planilla:', planillaAutorizada.IdPlanillaParcial);
            
        } else {
            // Ocultar botón PDF
            botonPDF.style.display = 'none';
            botonPDF.disabled = true;
            botonPDF.classList.remove('ready');
            window.planillaParaPDF = null;
            
            console.log('ℹ️ No hay planillas en Estado 1 (Autorizado) - Botón PDF oculto');
        }
        
    } catch (error) {
        console.error('Error al actualizar visibilidad del botón PDF:', error);
        botonPDF.style.display = 'none';
    }
}

async function generarPDFPlanilla() {
    try {
        // Verificar que existe planilla para PDF
        if (!window.planillaParaPDF) {
            throw new Error('No hay planilla disponible para generar PDF');
        }

        // Mostrar indicador de carga
        Swal.fire({
            title: 'Generando PDF...',
            text: 'Por favor espere mientras se genera el documento',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Obtener datos completos de la planilla
        const datosCompletos = await obtenerDatosCompletosParaPDF(window.planillaParaPDF.IdPlanillaParcial);
        
        if (!datosCompletos || !datosCompletos.colaboradores || datosCompletos.colaboradores.length === 0) {
            throw new Error('No se encontraron datos de colaboradores para la planilla');
        }

        // Generar el PDF
        await crearDocumentoPDF(datosCompletos);

        // ✅ NUEVO: Actualizar estado a "Documento Descargado" (Estado 2)
        await actualizarEstadoDespuesDeDescargarPDF(window.planillaParaPDF.IdPlanillaParcial);

        // Cerrar indicador de carga
        Swal.close();

        // Mostrar confirmación mejorada
        await Swal.fire({
            icon: 'success',
            title: '¡PDF Generado y Descargado!',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; border: 2px solid #10b981;">
                        <h4 style="color: #059669; margin-bottom: 15px; text-align: center;">✅ Proceso Completado</h4>
                        
                        <div style="margin-bottom: 10px;"><strong>📄 Documento:</strong> PDF generado exitosamente</div>
                        <div style="margin-bottom: 10px;"><strong>📥 Descarga:</strong> Archivo guardado en su dispositivo</div>
                        <div style="margin-bottom: 10px;"><strong>📋 Planilla:</strong> ${datosCompletos.planilla.PeriodoPago}</div>
                        <div style="margin-bottom: 10px;"><strong>👥 Colaboradores:</strong> ${datosCompletos.colaboradores.length}</div>
                        <div><strong>🔄 Estado actualizado:</strong> Documento Descargado</div>
                    </div>
                    
                    <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #3b82f6;">
                        <p style="margin: 0; color: #1e40af;">
                            <strong>ℹ️ Siguiente paso:</strong> La planilla ahora está marcada como documento descargado y lista para el siguiente proceso.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Perfecto',
            confirmButtonColor: '#10b981',
            width: '550px'
        });

        // ✅ NUEVO: Actualizar visibilidad del botón PDF (ya no debería estar disponible)
        await actualizarVisibilidadBotonPDF();

    } catch (error) {
        console.error('Error al generar PDF:', error);
        
        Swal.close();
        
        Swal.fire({
            icon: 'error',
            title: 'Error al generar PDF',
            text: error.message || 'No se pudo generar el documento PDF',
            confirmButtonColor: '#ef4444'
        });
    }
}
async function actualizarEstadoDespuesDeDescargarPDF(idPlanilla) {
    try {
        // Obtener datos del usuario logueado
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData) {
            throw new Error('No se encontraron datos del usuario para actualizar el estado');
        }

        const connection = await connectionString();
        
        // Verificar que la planilla está en Estado 1 (Autorizado)
        const verificacion = await connection.query(`
            SELECT IdPlanillaParcial, Estado, PeriodoPago, NombreUsuario 
            FROM PagoPlanillaParcial 
            WHERE IdPlanillaParcial = ? AND Estado = 1
        `, [idPlanilla]);

        if (verificacion.length === 0) {
            throw new Error('La planilla no está en estado autorizado o no existe');
        }

        // Actualizar el estado a 2 (Documento Descargado)
        const updateResult = await connection.query(`
            UPDATE PagoPlanillaParcial 
            SET 
                Estado = 2
            WHERE IdPlanillaParcial = ? AND Estado = 1
        `, [
            idPlanilla
        ]);

        await connection.close();

        if (updateResult.affectedRows === 0) {
            throw new Error('No se pudo actualizar el estado de la planilla');
        }

        console.log(`Estado de planilla ${idPlanilla} actualizado a "Documento Descargado" por ${userData.NombreCompleto}`);

    } catch (error) {
        console.error('Error al actualizar estado después de descarga:', error);
        
        // ⚠️ IMPORTANTE: No lanzar error aquí para no interrumpir el flujo del PDF
        // Solo registrar el error y continuar
        console.warn('El PDF se generó correctamente, pero no se pudo actualizar el estado automáticamente');
        
        // Mostrar notificación no bloqueante
        setTimeout(() => {
            Swal.fire({
                icon: 'warning',
                title: 'Advertencia',
                text: 'El PDF se generó correctamente, pero no se pudo actualizar el estado automáticamente. Contacte al administrador.',
                timer: 5000,
                toast: true,
                position: 'top-end',
                showConfirmButton: false
            });
        }, 2000);
    }
}
async function obtenerDatosCompletosParaPDF(idPlanilla) {
    try {
        const connection = await connectionString();
        const estadoCheck = await connection.query(`
            SELECT Estado FROM PagoPlanillaParcial WHERE IdPlanillaParcial = ?
        `, [idPlanilla]);
        
        if (estadoCheck.length === 0) {
            throw new Error('Planilla no encontrada');
        }
        
        if (estadoCheck[0].Estado !== 1) {
            throw new Error(`La planilla no está en estado autorizado (Estado actual: ${estadoCheck[0].Estado})`);
        }
        // ✅ CONSULTA ACTUALIZADA - Sin TipoPago, Mes, Anyo, IdTipoPago
        const planillaQuery = await connection.query(`
            SELECT 
                p.IdPlanillaParcial,
                p.PeriodoPago,
                p.MontoPlanillaParcial,
                p.CantidadColaboradores,
                p.FechaRegistro,
                p.NombreUsuario,
                p.NombreUsuarioAutoriza,
                d.NombreDepartamento
            FROM PagoPlanillaParcial p
            INNER JOIN departamentos d ON p.IdDepartamentoSucursal = d.IdDepartamento
            WHERE p.IdPlanillaParcial = ?
        `, [idPlanilla]);

        if (planillaQuery.length === 0) {
            throw new Error('Planilla no encontrada');
        }

        const planilla = planillaQuery[0];

        // 2. Obtener detalles de colaboradores (mismo código)
        const colaboradoresQuery = await connection.query(`
            SELECT 
                pd.IdPersonal,
                pd.NombrePersonal,
                pd.FechaLaborada,
                pd.IdTipoTurno,
                pd.TipoTurno,
                pd.MontoPagado
            FROM PagoPlanillaParcialDetalle pd
            WHERE pd.IdPlanillaParcial = ?
            ORDER BY pd.NombrePersonal, pd.FechaLaborada
        `, [idPlanilla]);

        // 3. Procesar colaboradores (mismo código)
        const colaboradoresProcesados = procesarColaboradores(colaboradoresQuery);

        await connection.close();

        return {
            planilla: planilla, // ✅ Ahora incluye PeriodoPago en lugar de TipoPago/Mes/Anyo
            colaboradores: colaboradoresProcesados,
            fechaGeneracion: new Date()
        };

    } catch (error) {
        console.error('Error al obtener datos para PDF:', error);
        throw error;
    }
}
function procesarColaboradores(colaboradoresData) {
    const colaboradoresMap = new Map();

    colaboradoresData.forEach(row => {
        const id = row.IdPersonal;
        
        if (!colaboradoresMap.has(id)) {
            // ===== MANTENER NOMBRE ORIGINAL (sin formatear a "Apellido, Nombre") =====
            const nombreCompleto = row.NombrePersonal;
            
            colaboradoresMap.set(id, {
                id: id,
                nombre: nombreCompleto, // Mantener formato original
                turnos: {
                    manana: { cantidad: 0, fechas: [], monto: 0 },
                    mixto: { cantidad: 0, fechas: [], monto: 0 },
                    cuatroHoras: { cantidad: 0, fechas: [], monto: 0 }
                },
                totalTurnos: 0,
                totalMonto: 0
            });
        }

        const colaborador = colaboradoresMap.get(id);
        const fecha = new Date(row.FechaLaborada).toLocaleDateString('es-GT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        // Clasificar turnos (resto del código igual)
        switch (row.IdTipoTurno) {
            case 1: // Mañana
                colaborador.turnos.manana.cantidad++;
                colaborador.turnos.manana.fechas.push(fecha);
                colaborador.turnos.manana.monto += parseFloat(row.MontoPagado);
                break;
            case 2: // Mixto
                colaborador.turnos.mixto.cantidad++;
                colaborador.turnos.mixto.fechas.push(fecha);
                colaborador.turnos.mixto.monto += parseFloat(row.MontoPagado);
                break;
            case 3: // 4 Horas
                colaborador.turnos.cuatroHoras.cantidad++;
                colaborador.turnos.cuatroHoras.fechas.push(fecha);
                colaborador.turnos.cuatroHoras.monto += parseFloat(row.MontoPagado);
                break;
        }

        colaborador.totalTurnos++;
        colaborador.totalMonto += parseFloat(row.MontoPagado);
    });

    return Array.from(colaboradoresMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
}
function formatearNombreApellidoNombre(nombreCompleto) {
    const partes = nombreCompleto.trim().split(' ');
    
    if (partes.length >= 2) {
        // Asumir que las últimas dos partes son apellidos y las primeras son nombres
        const nombres = partes.slice(0, -2).join(' ');
        const apellidos = partes.slice(-2).join(' ');
        
        if (nombres && apellidos) {
            return `${apellidos}, ${nombres}`;
        } else {
            // Si solo hay 2 partes, asumir que una es nombre y otra apellido
            const nombre = partes[0];
            const apellido = partes[1];
            return `${apellido}, ${nombre}`;
        }
    }
    
    return nombreCompleto; // Retornar como está si no se puede procesar
}
async function crearDocumentoPDF(datos) {
    const { jsPDF } = window.jspdf;
    
    // Crear documento horizontal (landscape)
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let currentY = margin;

    // ===== ENCABEZADO =====
    currentY = dibujarEncabezado(doc, datos, margin, currentY, pageWidth);

    // ===== TABLA DE COLABORADORES =====
    currentY = await dibujarTablaColaboradores(doc, datos.colaboradores, margin, currentY, pageWidth, pageHeight);

    // ===== NUEVA SECCIÓN: FIRMAS =====
    currentY = dibujarSeccionFirmas(doc, datos, margin, currentY, pageWidth);

    // ===== PIE DE PÁGINA =====
    dibujarPiePagina(doc, datos, pageWidth, pageHeight, margin);

    // ===== GUARDAR DOCUMENTO =====
    const nombreArchivo = generarNombreArchivo(datos.planilla);
    doc.save(nombreArchivo);
}
function dibujarEncabezado(doc, datos, margin, currentY, pageWidth) {
    const planilla = datos.planilla;
    
    // ===== HEADER CON FONDO GRIS =====
    doc.setFillColor(55, 65, 81); // Gris oscuro profesional
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    // Título principal en blanco
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANILLA DE TIEMPO PARCIAL', pageWidth / 2, 15, { align: 'center' });
    
    // Restaurar color negro
    doc.setTextColor(0, 0, 0);
    currentY = 35;

    // ===== SECCIÓN DE INFORMACIÓN CON CAJAS GRISES =====
    const boxHeight = 25;
    const col1X = margin;
    const col2X = pageWidth / 2 + 5;
    const boxWidth = (pageWidth / 2) - margin - 5;

    // Caja izquierda
    doc.setFillColor(248, 250, 252); // Gris muy claro
    doc.setLineWidth(0.5);
    doc.rect(col1X, currentY, boxWidth, boxHeight, 'FD');
    
    // Caja derecha  
    doc.rect(col2X, currentY, boxWidth, boxHeight, 'FD');

    // ===== CONTENIDO DE LAS CAJAS =====
    doc.setFontSize(11);
    let textY = currentY + 6;

    // Columna izquierda
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81); // Gris oscuro en lugar de azul
    doc.text('SUCURSAL:', col1X + 3, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(planilla.NombreDepartamento, col1X + 3, textY + 5);

    // ✅ ACTUALIZAR PERÍODO EN LUGAR DE MES/AÑO
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('PERÍODO:', col1X + 3, textY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    // ✅ PARSEAR Y FORMATEAR EL PERÍODO
    const periodo = parsearPeriodoDesdeBDSeguro(planilla.PeriodoPago);
    const periodoTexto = formatearPeriodoSeguro(periodo.inicio, periodo.fin);
    doc.text(periodoTexto.toUpperCase(), col1X + 3, textY + 17);

    // Columna derecha
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('TIPO DE PAGO:', col2X + 3, textY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('PLANILLA POR PERÍODO', col2X + 3, textY + 5); // ✅ TEXTO FIJO

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('TOTAL COLABORADORES:', col2X + 3, textY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(planilla.CantidadColaboradores.toString(), col2X + 3, textY + 17);

    currentY += boxHeight + 8;

    // ===== FECHAS EN UNA LÍNEA =====
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    const fechaRegistro = new Date(planilla.FechaRegistro).toLocaleDateString('es-GT');
    const fechaGeneracion = datos.fechaGeneracion.toLocaleDateString('es-GT');
    
    const fechasText = `Fecha de Registro: ${fechaRegistro}  |  Fecha de Generación: ${fechaGeneracion}`;
    doc.text(fechasText, pageWidth / 2, currentY, { align: 'center' });
    
    currentY += 10;
    
    // Línea separadora
    doc.setLineWidth(0.3);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 5;

    return currentY;
}
async function dibujarTablaColaboradores(doc, colaboradores, margin, currentY, pageWidth, pageHeight) {
    const startY = currentY;
    
    // ===== USAR NUEVA CONFIGURACIÓN DE COLUMNAS =====
    const columns = obtenerConfiguracionColumnas();

    // Dibujar encabezados
    currentY = dibujarEncabezadosTabla(doc, columns, margin, currentY);

    // ===== DIBUJAR FILAS CON CORRELATIVO =====
    for (let i = 0; i < colaboradores.length; i++) {
        const colaborador = colaboradores[i];
        const correlativo = i + 1; // Correlativo empezando en 1
        
        // Verificar si necesitamos nueva página
        if (currentY > pageHeight - 50) {
            doc.addPage();
            currentY = margin;
            currentY = dibujarEncabezadosTabla(doc, columns, margin, currentY);
        }

        currentY = dibujarFilaColaborador(doc, colaborador, columns, margin, currentY, correlativo);
    }

    // Dibujar totales
    currentY = dibujarTotales(doc, colaboradores, columns, margin, currentY, pageWidth);

    return currentY;
}
function dibujarEncabezadosTabla(doc, columns, margin, currentY) {
    const rowHeight = 10;
    let currentX = margin;

    // ===== FONDO GRIS OSCURO PARA HEADER =====
    doc.setFillColor(75, 85, 99); // Gris oscuro profesional (gray-600)
    doc.rect(margin, currentY, columns.reduce((sum, col) => sum + col.width, 0), rowHeight, 'F');

    // ===== TEXTO BLANCO PARA CONTRASTE =====
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    columns.forEach(col => {
        // Centrar texto en cada columna
        const textX = currentX + (col.width / 2);
        doc.text(col.header, textX, currentY + 6.5, { align: 'center' });
        
        // Líneas separadoras verticales
        if (currentX > margin) {
            doc.setLineWidth(0.3);
            doc.setDrawColor(255, 255, 255);
            doc.line(currentX, currentY, currentX, currentY + rowHeight);
        }
        
        currentX += col.width;
    });

    // Borde del encabezado
    doc.setLineWidth(0.5);
    doc.setDrawColor(55, 65, 81); // Gris más oscuro para borde
    doc.rect(margin, currentY, columns.reduce((sum, col) => sum + col.width, 0), rowHeight);

    // Restaurar color de texto
    doc.setTextColor(0, 0, 0);
    
    return currentY + rowHeight;
}
function obtenerConfiguracionColumnas() {
    return [
        { header: 'No.', width: 15 },
        { header: 'Colaborador', width: 45 },      // Reducido más
        { header: 'T. Mañana', width: 18 },        // Reducido ligeramente
        { header: 'T. Mixto', width: 18 },         // Reducido ligeramente
        { header: 'T. 4 Horas', width: 20 },
        { header: 'Total Turnos', width: 22 },     // Reducido ligeramente
        { header: 'Total a Pagar', width: 28 },    // Reducido ligeramente
        { header: 'Fechas Laboradas', width: 45 }, // Reducido ligeramente
        { header: 'Firma', width: 50 }             // MUCHO MÁS ANCHO: de 35 a 50
    ];
}
function dibujarFilaColaborador(doc, colaborador, columns, margin, currentY, correlativo) {
    const rowHeight = 22; // Altura ligeramente aumentada para dos líneas de nombre
    let currentX = margin;

    // ===== FONDO ALTERNADO =====
    const isEven = correlativo % 2 === 0;
    if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, columns.reduce((sum, col) => sum + col.width, 0), rowHeight, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // ===== DATOS DE LAS COLUMNAS =====
    const datos = [
        correlativo.toString(),
        '', // Nombre se dibuja aparte con función especial
        colaborador.turnos.manana.cantidad.toString(),
        colaborador.turnos.mixto.cantidad.toString(),
        colaborador.turnos.cuatroHoras.cantidad.toString(),
        colaborador.totalTurnos.toString(),
        `Q ${colaborador.totalMonto.toFixed(2)}`,
        '', // Fechas (se dibuja aparte)
        '' // Firma (vacía)
    ];

    // ===== DIBUJAR DATOS =====
    columns.forEach((col, index) => {
        const cellY = currentY + 6;
        
        if (index === 0) {
            // Correlativo centrado y en negrita
            doc.setFont('helvetica', 'bold');
            doc.text(datos[index], currentX + (col.width / 2), cellY + 2, { align: 'center' });
            doc.setFont('helvetica', 'normal');
        } else if (index === 1) {
            // ===== NOMBRE EN DOS LÍNEAS =====
            dibujarNombreEnDosLineas(doc, colaborador.nombre, currentX, currentY, col.width);
        } else if (index === 7) {
            // Fechas laboradas
            dibujarFechasLaboradas(doc, colaborador, currentX + 1, currentY + 2, col.width - 2);
        } else if (index === 8) {
            // Firma completamente vacía
        } else if (index >= 2 && index <= 6) {
            // Datos numéricos centrados (ajustado para altura mayor)
            const align = 'center';
            const x = currentX + (col.width / 2);
            doc.text(datos[index], x, cellY + 2, { align: align });
        }
        
        currentX += col.width;
    });

    // ===== BORDES DE LA FILA =====
    currentX = margin;
    columns.forEach(col => {
        doc.setLineWidth(0.1);
        doc.setDrawColor(200, 200, 200);
        doc.rect(currentX, currentY, col.width, rowHeight);
        currentX += col.width;
    });

    return currentY + rowHeight;
}
function dibujarFechasLaboradas(doc, colaborador, x, y, width) {
    doc.setFontSize(7);
    let offsetY = 0;
    const lineHeight = 3.2;

    // ===== ESTILO COMPACTO CON ETIQUETAS EN NEGRITA =====
    const tiposTurno = [
        { 
            tipo: colaborador.turnos.manana, 
            label: 'Mañ:', 
            color: [219, 68, 55]  // Rojo más suave
        },
        { 
            tipo: colaborador.turnos.mixto, 
            label: 'Mix:', 
            color: [66, 133, 244] // Azul más suave
        },
        { 
            tipo: colaborador.turnos.cuatroHoras, 
            label: '4H:', 
            color: [52, 168, 83]  // Verde más suave
        }
    ];

    tiposTurno.forEach(turno => {
        if (turno.tipo.cantidad > 0) {
            // ===== FORMATO: "Mañ: 15/07, 18/07" (más compacto) =====
            
            // ✅ Label del tipo de turno en color y NEGRITA (MÁS PRONUNCIADA)
            doc.setTextColor(...turno.color);
            doc.setFont('helvetica', 'bold'); // Ya estaba en negrita, pero ahora será más visible
            doc.setFontSize(8); // ✅ AUMENTADO de 7 a 8 para mayor visibilidad
            doc.text(turno.label, x + 1, y + offsetY + 2);
            
            // Fechas en color gris oscuro, formato normal pero más legible
            doc.setTextColor(40, 40, 40); // ✅ OSCURECIDO: de (60,60,60) a (40,40,40)
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7); // Mantenemos tamaño original para las fechas
            
            // Formatear fechas más compactas (DD/MM)
            const fechasCompactas = turno.tipo.fechas.map(fecha => {
                // Convertir de "DD/MM/YYYY" a "DD/MM"
                const partes = fecha.split('/');
                return `${partes[0]}/${partes[1]}`;
            });
            
            const fechasTexto = fechasCompactas.join(', ');
            
            // Usar splitTextToSize para manejar texto largo
            const lineas = doc.splitTextToSize(fechasTexto, width - 15);
            doc.text(lineas, x + 12, y + offsetY + 2); // ✅ Ajustado spacing: de x+10 a x+12
            
            offsetY += Math.max(lineas.length * lineHeight, lineHeight);
        }
    });
    
    // Restaurar color de texto
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal'); // ✅ Restaurar fuente normal
    doc.setFontSize(9); // ✅ Restaurar tamaño original
}
function formatearFechasLaboradas(colaborador) {
    let resultado = '';
    
    if (colaborador.turnos.manana.cantidad > 0) {
        resultado += `M: ${colaborador.turnos.manana.fechas.join(', ')}\n`;
    }
    
    if (colaborador.turnos.mixto.cantidad > 0) {
        resultado += `X: ${colaborador.turnos.mixto.fechas.join(', ')}\n`;
    }
    
    if (colaborador.turnos.cuatroHoras.cantidad > 0) {
        resultado += `4H: ${colaborador.turnos.cuatroHoras.fechas.join(', ')}`;
    }
    
    return resultado.trim();
}
function dibujarTotales(doc, colaboradores, columns, margin, currentY, pageWidth) {
    currentY += 8;
    
    // Calcular totales
    const totalColaboradores = colaboradores.length;
    const totalMañana = colaboradores.reduce((sum, c) => sum + c.turnos.manana.cantidad, 0);
    const totalMixto = colaboradores.reduce((sum, c) => sum + c.turnos.mixto.cantidad, 0);
    const total4Horas = colaboradores.reduce((sum, c) => sum + c.turnos.cuatroHoras.cantidad, 0);
    const totalTurnos = colaboradores.reduce((sum, c) => sum + c.totalTurnos, 0);
    const totalGeneral = colaboradores.reduce((sum, c) => sum + c.totalMonto, 0);

    // ===== FONDO GRIS CLARO =====
    const totalRowHeight = 12;
    doc.setFillColor(229, 231, 235);
    doc.rect(margin, currentY, columns.reduce((sum, col) => sum + col.width, 0), totalRowHeight, 'F');

    // ===== TEXTO SIMPLE Y CLARO =====
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);

    let currentX = margin;

    // ===== DATOS SIMPLIFICADOS =====
    columns.forEach((col, index) => {
        let texto = '';
        let align = 'center';
        
        switch(index) {
            case 0: // No.
                texto = ''; // Completamente vacío
                break;
            case 1: // Colaborador
                texto = `TOTALES:`;
                align = 'left';
                break;
            case 2: // T. Mañana
                texto = totalMañana.toString();
                break;
            case 3: // T. Mixto
                texto = totalMixto.toString();
                break;
            case 4: // T. 4 Horas
                texto = total4Horas.toString();
                break;
            case 5: // Total Turnos
                texto = totalTurnos.toString();
                break;
            case 6: // Total a Pagar
                texto = `Q ${totalGeneral.toFixed(2)}`;
                break;
            case 7: // Fechas Laboradas
                texto = ''; // Vacío
                break;
            case 8: // Firma
                texto = ''; // Vacío
                break;
        }
        
        if (texto) {
            const x = align === 'center' ? currentX + (col.width / 2) : currentX + 3;
            doc.text(texto, x, currentY + 7.5, { align: align });
        }
        
        currentX += col.width;
    });

    // ===== BORDE =====
    doc.setLineWidth(1);
    doc.setDrawColor(107, 114, 128);
    doc.rect(margin, currentY, columns.reduce((sum, col) => sum + col.width, 0), totalRowHeight);

    doc.setTextColor(0, 0, 0);
    
    return currentY + totalRowHeight;
}
function dibujarPiePagina(doc, datos, pageWidth, pageHeight, margin) {
    const y = pageHeight - margin - 8;
    
    // Línea separadora
    doc.setLineWidth(0.3);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y - 3, pageWidth - margin, y - 3);
    
    // Texto del pie
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('Generado automáticamente por Sistema de Recursos Humanos', pageWidth / 2, y, { align: 'center' });
    
    // Número de página (si se implementa paginación múltiple)
    doc.setFont('helvetica', 'normal');
    doc.text(`Página 1`, pageWidth - margin, y, { align: 'right' });
}
function generarNombreArchivo(planilla) {
    // ✅ USAR EL PERÍODO EN LUGAR DE TIPO/MES/AÑO
    const periodo = parsearPeriodoDesdeBD(planilla.PeriodoPago);
    const fechaInicio = periodo.inicio.replace(/-/g, ''); // 20250115
    const fechaFin = periodo.fin.replace(/-/g, ''); // 20250131
    const fecha = new Date().toISOString().split('T')[0];
    
    return `Planilla_Periodo_${fechaInicio}_${fechaFin}_${fecha}.pdf`;
}
function separarApellidosYNombres(nombreCompleto) {
    const partes = nombreCompleto.trim().split(' ');
    
    if (partes.length >= 2) {
        // Asumir que las últimas dos partes son apellidos y las primeras son nombres
        if (partes.length >= 4) {
            // Caso: "Juan Carlos Pérez García" 
            const nombres = partes.slice(0, -2).join(' ');      // "Juan Carlos"
            const apellidos = partes.slice(-2).join(' ');      // "Pérez García"
            return {
                apellidos: apellidos,
                nombres: nombres
            };
        } else if (partes.length === 3) {
            // Caso: "Juan Pérez García"
            const nombres = partes[0];                          // "Juan"
            const apellidos = partes.slice(1).join(' ');       // "Pérez García"
            return {
                apellidos: apellidos,
                nombres: nombres
            };
        } else {
            // Caso: "Juan Pérez"
            const nombres = partes[0];                          // "Juan"
            const apellidos = partes[1];                        // "Pérez"
            return {
                apellidos: apellidos,
                nombres: nombres
            };
        }
    }
    
    // Si no se puede separar, devolver todo como apellido
    return {
        apellidos: nombreCompleto,
        nombres: ''
    };
}
function dibujarNombreEnDosLineas(doc, nombreCompleto, x, y, width) {
    const { apellidos, nombres } = separarApellidosYNombres(nombreCompleto);
    
    // ===== LÍNEA 1: APELLIDOS EN NEGRITA =====
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    // Usar splitTextToSize para manejar apellidos largos
    const lineasApellidos = doc.splitTextToSize(apellidos.toUpperCase(), width - 4);
    doc.text(lineasApellidos, x + 2, y + 4);
    
    // ===== LÍNEA 2: NOMBRES EN NORMAL =====
    if (nombres && nombres.trim() !== '') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60); // Gris más suave para nombres
        
        const lineasNombres = doc.splitTextToSize(nombres, width - 4);
        const offsetY = lineasApellidos.length * 3.5; // Espacio entre líneas
        doc.text(lineasNombres, x + 2, y + 4 + offsetY);
    }
    
    // Restaurar configuración
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
}
function dibujarSeccionFirmas(doc, datosCompletos, margin, currentY, pageWidth) {
    const planilla = datosCompletos.planilla;
    
    // Espacio antes de las firmas (AUMENTADO)
    currentY += 20; // Cambiado de 15 a 20
    
    // ===== TÍTULO DE LA SECCIÓN =====
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(55, 65, 81); // Gris oscuro
    doc.text('FIRMAS DE RESPONSABILIDAD', pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;
    
    // Línea decorativa debajo del título
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin + 50, currentY, pageWidth - margin - 50, currentY);
    currentY += 15; // Cambiado de 12 a 15
    
    // ===== CONFIGURACIÓN DE FIRMAS =====
    const firmaWidth = (pageWidth - (margin * 2) - 40) / 3; // Dividir en 3 columnas con espacios
    const firmaHeight = 35; // AUMENTADO de 25 a 35 para más espacio de firma
    const espacioEntreFirmas = 20;
    
    const firmas = [
        {
            titulo: 'ELABORÓ',
            nombre: planilla.NombreUsuario || 'No disponible',
            descripcion: 'Persona que realizó la planilla'
        },
        {
            titulo: 'ENTREGÓ',
            nombre: '', // ✅ ELIMINADO "Pendiente" - ahora está vacío
            descripcion: 'Persona que entregó'
        },
        {
            titulo: 'AUTORIZÓ',
            nombre: planilla.NombreUsuarioAutoriza || '',  // ✅ También eliminado texto por defecto
            descripcion: 'Persona que autorizó'
        }
    ];
    
    // ===== DIBUJAR CAJAS DE FIRMAS =====
    let currentXFirma = margin;
    
    firmas.forEach((firma, index) => {
        // ===== CAJA DE FIRMA =====
        doc.setFillColor(248, 250, 252); // Fondo gris muy claro
        doc.setLineWidth(1);
        doc.setDrawColor(156, 163, 175); // Borde gris medio
        doc.rect(currentXFirma, currentY, firmaWidth, firmaHeight, 'FD');
        
        // ===== TÍTULO DE LA FIRMA =====
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81); // Gris oscuro
        doc.text(firma.titulo, currentXFirma + (firmaWidth / 2), currentY + 6, { align: 'center' });
        
        // ===== NOMBRE DE LA PERSONA (solo si no está vacío) =====
        if (firma.nombre && firma.nombre.trim() !== '') {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0); // Negro
            
            // Usar splitTextToSize para nombres largos
            const nombreLineas = doc.splitTextToSize(firma.nombre, firmaWidth - 6);
            const nombreY = currentY + 12;
            doc.text(nombreLineas, currentXFirma + (firmaWidth / 2), nombreY, { align: 'center' });
        }
        
        // ===== LÍNEA PARA FIRMA (MÁS ABAJO PARA MÁS ESPACIO) =====
        const lineaY = currentY + firmaHeight - 8; // Cambiado de -6 a -8
        doc.setLineWidth(0.5);
        doc.setDrawColor(107, 114, 128);
        doc.line(currentXFirma + 8, lineaY, currentXFirma + firmaWidth - 8, lineaY);
        
        // ===== TEXTO "FIRMA" DEBAJO =====
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(107, 114, 128);
        doc.text('Firma', currentXFirma + (firmaWidth / 2), lineaY + 4, { align: 'center' });
        
        // Mover X para la siguiente caja
        currentXFirma += firmaWidth + espacioEntreFirmas;
    });
    
    currentY += firmaHeight + 10; // Cambiado de +8 a +10
    
    // ===== DESCRIPCIÓN ADICIONAL =====
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    currentXFirma = margin;
    
    firmas.forEach((firma, index) => {
        doc.text(firma.descripcion, currentXFirma + (firmaWidth / 2), currentY, { align: 'center' });
        currentXFirma += firmaWidth + espacioEntreFirmas;
    });
    
    currentY += 10; // Cambiado de +8 a +10
    
    // Restaurar configuración
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    return currentY;
}
// Solapamiento en Rangos de Fecha
function verificarSolapamientoFechas(inicio1, fin1, inicio2, fin2) {
    // Convertir strings a objetos Date para comparación
    const fechaInicio1 = new Date(inicio1);
    const fechaFin1 = new Date(fin1);
    const fechaInicio2 = new Date(inicio2);
    const fechaFin2 = new Date(fin2);

    return (
        (fechaInicio1 <= fechaFin2 && fechaFin1 >= fechaInicio2) ||
        (fechaInicio2 <= fechaFin1 && fechaFin2 >= fechaInicio1)
    );
}
function obtenerDiasEnConflicto(inicio1, fin1, inicio2, fin2) {
    const fechaInicio1 = new Date(inicio1);
    const fechaFin1 = new Date(fin1);
    const fechaInicio2 = new Date(inicio2);
    const fechaFin2 = new Date(fin2);
    
    // Encontrar el rango de solapamiento
    const inicioSolapamiento = new Date(Math.max(fechaInicio1.getTime(), fechaInicio2.getTime()));
    const finSolapamiento = new Date(Math.min(fechaFin1.getTime(), fechaFin2.getTime()));
    
    const diasConflicto = [];
    const fechaActual = new Date(inicioSolapamiento);
    
    while (fechaActual <= finSolapamiento) {
        diasConflicto.push(new Date(fechaActual).toLocaleDateString('es-GT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }));
        fechaActual.setDate(fechaActual.getDate() + 1);
    }
    
    return diasConflicto;
}
function formatearPeriodoSeguro(fechaInicio, fechaFin) {
    // Crear fechas sin problemas de zona horaria
    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(fechaFin + 'T00:00:00');
    
    const formatoFecha = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const inicioTexto = inicio.toLocaleDateString('es-GT', formatoFecha);
    const finTexto = fin.toLocaleDateString('es-GT', formatoFecha);
    
    return `${inicioTexto} a ${finTexto}`;
}
function parsearPeriodoDesdeBDSeguro(periodoBD) {
    // Parsear: "2025-01-15 a 2025-01-31" -> {inicio: "2025-01-15", fin: "2025-01-31"}
    const partes = periodoBD.split(' a ');
    return {
        inicio: partes[0].trim(),
        fin: partes[1].trim()
    };
}
// ===== FUNCIÓN DE AYUDA DEL SISTEMA =====
function mostrarAyudaSistema() {
    Swal.fire({
        title: '📋 Guía del Sistema de Planillas',
        html: `
            <div style="text-align: left; max-height: 70vh; overflow-y: auto; padding: 0 10px;">
                
                <!-- INTRODUCCIÓN -->
                <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
                    <h3 style="color: #1e40af; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-info-circle"></i>
                        ¿Qué es este sistema?
                    </h3>
                    <p style="margin: 0; color: #1e40af; line-height: 1.5;">
                        Sistema para gestionar planillas de pago de <strong>colaboradores de tiempo parcial</strong>. 
                        Permite asignar turnos, calcular pagos automáticamente y generar documentos oficiales.
                    </p>
                </div>

                <!-- PASOS PRINCIPALES -->
                <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
                    <h3 style="color: #15803d; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-list-ol"></i>
                        Pasos para usar el sistema
                    </h3>
                    
                    <div style="display: grid; gap: 12px;">
                        <div style="display: flex; align-items: start; gap: 10px;">
                            <span style="background: #22c55e; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">1</span>
                            <div>
                                <strong style="color: #15803d;">Configurar Planilla:</strong>
                                <span style="color: #374151;">Seleccione las fechas de inicio y fin del período de pago.</span>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: start; gap: 10px;">
                            <span style="background: #22c55e; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">2</span>
                            <div>
                                <strong style="color: #15803d;">Elegir Colaborador:</strong>
                                <span style="color: #374151;">Busque y seleccione un colaborador de la lista.</span>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: start; gap: 10px;">
                            <span style="background: #22c55e; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">3</span>
                            <div>
                                <strong style="color: #15803d;">Asignar Turnos:</strong>
                                <span style="color: #374151;">Use el calendario para asignar turnos en las fechas deseadas.</span>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: start; gap: 10px;">
                            <span style="background: #22c55e; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">4</span>
                            <div>
                                <strong style="color: #15803d;">Generar Planilla:</strong>
                                <span style="color: #374151;">Agregue el colaborador a la planilla y repita con otros colaboradores.</span>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: start; gap: 10px;">
                            <span style="background: #22c55e; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">5</span>
                            <div>
                                <strong style="color: #15803d;">Solicitar Autorización:</strong>
                                <span style="color: #374151;">Una vez completa, solicite autorización para procesar la planilla.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TIPOS DE TURNOS -->
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                    <h3 style="color: #92400e; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-clock"></i>
                        Tipos de Turnos Disponibles
                    </h3>
                    
                    <div style="display: grid; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(251, 146, 60, 0.1); border-radius: 6px;">
                            <span style="font-size: 1.2rem;">☀️</span>
                            <div>
                                <strong style="color: #ea580c;">Turno Mañana:</strong>
                                <span style="color: #92400e;">Jornada matutina completa</span>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(107, 114, 128, 0.1); border-radius: 6px;">
                            <span style="font-size: 1.2rem;">🌙</span>
                            <div>
                                <strong style="color: #374151;">Turno Mixto:</strong>
                                <span style="color: #6b7280;">Jornada tarde-noche</span>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(34, 197, 94, 0.1); border-radius: 6px;">
                            <span style="font-size: 1.2rem;">🕐</span>
                            <div>
                                <strong style="color: #16a34a;">Turno 4 Horas:</strong>
                                <span style="color: #059669;">Jornada parcial (puede ser con tarifa de mañana o mixta)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- VALIDACIONES Y RESTRICCIONES -->
                <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
                    <h3 style="color: #dc2626; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        Validaciones y Restricciones
                    </h3>
                    
                    <div style="display: grid; gap: 8px; font-size: 0.9rem;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #dc2626;">🚫</span>
                            <span style="color: #7f1d1d;"><strong>Domingos:</strong> No se pueden asignar turnos los domingos</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #dc2626;">📅</span>
                            <span style="color: #7f1d1d;"><strong>Límite semanal:</strong> Máximo 4 días laborables por semana</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #dc2626;">🎉</span>
                            <span style="color: #7f1d1d;"><strong>Feriados:</strong> Se respetan feriados nacionales y departamentales</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #dc2626;">✝️</span>
                            <span style="color: #7f1d1d;"><strong>Semana Santa:</strong> Días bloqueados automáticamente</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #dc2626;">📋</span>
                            <span style="color: #7f1d1d;"><strong>Períodos:</strong> No se pueden crear planillas con fechas superpuestas</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #dc2626;">💰</span>
                            <span style="color: #7f1d1d;"><strong>Cálculos:</strong> Los montos se redondean al múltiplo de Q 0.05 más cercano</span>
                        </div>
                    </div>
                </div>

                <!-- FUNCIONES ADICIONALES -->
                <div style="background: #f3e8ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #8b5cf6;">
                    <h3 style="color: #6b21a8; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-tools"></i>
                        Funciones Adicionales
                    </h3>
                    
                    <div style="display: grid; gap: 8px; font-size: 0.9rem;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #8b5cf6;">🔍</span>
                            <span style="color: #581c87;"><strong>Búsqueda:</strong> Filtre colaboradores por nombre, puesto o ID</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #8b5cf6;">✏️</span>
                            <span style="color: #581c87;"><strong>Edición:</strong> Modifique turnos de colaboradores ya agregados</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #8b5cf6;">🗑️</span>
                            <span style="color: #581c87;"><strong>Eliminación:</strong> Quite colaboradores o limpie toda la planilla</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #8b5cf6;">📄</span>
                            <span style="color: #581c87;"><strong>PDF:</strong> Genere documentos una vez autorizada la planilla</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #8b5cf6;">📊</span>
                            <span style="color: #581c87;"><strong>Totales:</strong> Vea resúmenes automáticos de turnos y pagos</span>
                        </div>
                    </div>
                </div>

                <!-- ESTADOS DE PLANILLA -->
                <div style="background: #e0f2fe; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #0891b2;">
                    <h3 style="color: #0c5460; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-list-check"></i>
                        Estados de la Planilla
                    </h3>
                    
                    <div style="display: grid; gap: 6px; font-size: 0.85rem;">
                        <div><strong style="color: #f59e0b;">⏳ En espera:</strong> <span style="color: #0c5460;">Esperando autorización</span></div>
                        <div><strong style="color: #10b981;">✅ Autorizado:</strong> <span style="color: #0c5460;">Aprobada para generar PDF</span></div>
                        <div><strong style="color: #3b82f6;">📥 Documento descargado:</strong> <span style="color: #0c5460;">PDF generado</span></div>
                        <div><strong style="color: #8b5cf6;">📎 Pendiente comprobante:</strong> <span style="color: #0c5460;">Esperando subir comprobante</span></div>
                        <div><strong style="color: #059669;">🎉 Completado:</strong> <span style="color: #0c5460;">Proceso finalizado</span></div>
                    </div>
                </div>

            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: '👍 ¡Entendido!',
        confirmButtonColor: '#10b981',
        width: '800px',
        customClass: {
            popup: 'help-modal',
            htmlContainer: 'help-content'
        }
    });
}
window.seleccionarColaborador = seleccionarColaboradorConProgreso;
window.agregarNuevoColaboradorAPlanilla = agregarNuevoColaboradorAPlanillaConProgreso;
window.cambiarConfiguracionPlanilla = cambiarConfiguracionPlanillaConReset;
window.cambiarConfiguracionDesdeHeader = cambiarConfiguracionPlanillaConReset;
window.confirmarSeleccionPlanilla = confirmarSeleccionPlanillaConTransiciones;
window.refrescarBotonPDF = actualizarVisibilidadBotonPDF;
window.eliminarTurno = eliminarTurno;
window.editarColaborador = editarColaborador; 
window.eliminarColaboradorDePlanilla = eliminarColaboradorDePlanilla;