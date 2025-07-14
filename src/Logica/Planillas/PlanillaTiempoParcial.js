const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');

// Variables globales
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
    tipo: null,
    mes: null,
    anio: null,
    confirmada: false
};
// Inicialización principal - ACTUALIZADA
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Iniciando aplicación...');
    
    try {
        mostrarFechaActual();
        cargarAnios();
        await cargarTarifasSalarios();
        generarFechasSemanaSanta();
        await cargarInformacionDepartamento();
        inicializarEventos();
        inicializarPlanilla(); 
        actualizarVisibilidadAcciones();
        console.log('Aplicación inicializada correctamente');
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        mostrarError('Error al inicializar la aplicación');
    }
});
function cargarAnios() {
    const select = document.getElementById('anioPlanilla');
    const currentYear = new Date().getFullYear();
    
    select.innerHTML = '<option value="">Seleccione año...</option>';
    
    // Cargar desde año anterior hasta 2 años después
    for (let year = currentYear - 1; year <= currentYear + 2; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}

function inicializarPlanilla() {
    // Mostrar siempre la sección de planilla
    document.getElementById('payrollSection').style.display = 'block';
    actualizarVistaPlanilla();
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
    document.getElementById('currentDate').textContent = now.toLocaleDateString('es-GT', options);
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
            <div class="user-info">
                <i class="fas fa-user"></i>
                <span>${userData.NombreCompleto}</span>
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

    addSafeEventListener('tipoQuincena', 'change', validarFormularioPlanilla);
    addSafeEventListener('mesPlanilla', 'change', validarFormularioPlanilla);
    addSafeEventListener('anioPlanilla', 'change', validarFormularioPlanilla);
    addSafeEventListener('confirmarPlanilla', 'click', confirmarSeleccionPlanilla);
    addSafeEventListener('changePlanilla', 'click', cambiarConfiguracionPlanilla);

    addSafeEventListener('searchCollaborator', 'input', filtrarColaboradores);
    
    addSafeEventListener('clearAllPayroll', 'click', limpiarTodaLaPlanilla);
    addSafeEventListener('generateFinalPayroll', 'click', solicitarAutorizacionPlanilla);
    
    addSafeEventListener('closeCalendarModal', 'click', cerrarCalendario);
    
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
    
    // ⭐ EVENTOS DEL MODAL DE SELECCIÓN DE TURNO
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
    
    console.log('Event listeners inicializados correctamente');
}
async function confirmarSeleccionPlanilla() {
    const tipo = document.getElementById('tipoQuincena').value;
    const mes = document.getElementById('mesPlanilla').value;
    const anio = document.getElementById('anioPlanilla').value;
    
    // Validaciones básicas
    if (!tipo || !mes || !anio) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos incompletos',
            text: 'Por favor complete todos los campos antes de continuar.',
            confirmButtonColor: '#1e40af'
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
    
    // Mostrar loading mientras verifica
    const loadingSwal = mostrarCargando('Verificando disponibilidad...');
    
    try {
        // ⭐ VERIFICACIÓN CON ESTADOS REALES
        const planillaExistente = await verificarPlanillaExistente(tipo, mes, anio, currentDepartamentoId);
        
        // Cerrar loading
        Swal.close();
        
        if (planillaExistente) {
            // Si existe, mostrar información detallada con estado real
            const tipoTexto = tipo === 'quincenal' ? 'Quincenal' : 'Fin de Mes';
            const mesNombre = new Date(anio, mes - 1).toLocaleDateString('es-GT', { month: 'long' });
            const fechaRegistro = new Date(planillaExistente.FechaRegistro).toLocaleDateString('es-GT');
            
            // ⭐ OBTENER COLOR Y ESTILO SEGÚN EL ESTADO
            const estadoInfo = obtenerEstiloEstado(planillaExistente.IdEstado, planillaExistente.NombreEstado);
            
            await Swal.fire({
                icon: 'warning',
                title: 'Planilla ya existe',
                html: `
                    <div style="text-align: left; margin: 20px 0;">
                        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
                            <h4 style="color: #92400e; margin-bottom: 15px; text-align: center;">⚠️ Planilla Duplicada Detectada</h4>
                            
                            <div style="margin-bottom: 15px;">
                                <strong style="color: #92400e;">📋 Tipo:</strong> Planilla ${tipoTexto}<br>
                                <strong style="color: #92400e;">📅 Período:</strong> ${mesNombre} ${anio}<br>
                                <strong style="color: #92400e;">💰 Monto:</strong> Q ${parseFloat(planillaExistente.MontoPlanillaParcial).toFixed(2)}<br>
                                <strong style="color: #92400e;">👥 Colaboradores:</strong> ${planillaExistente.CantidadColaboradores}<br>
                                <strong style="color: #92400e;">👤 Creada por:</strong> ${planillaExistente.NombreUsuario}<br>
                                <strong style="color: #92400e;">📆 Fecha registro:</strong> ${fechaRegistro}
                            </div>
                            
                            <div style="text-align: center; padding: 12px; background: ${estadoInfo.fondo}; border-radius: 8px; border: 2px solid ${estadoInfo.borde};">
                                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <span style="font-size: 1.2rem;">${estadoInfo.icono}</span>
                                    <strong style="color: ${estadoInfo.texto}; font-size: 1.1rem;">Estado: ${planillaExistente.NombreEstado}</strong>
                                </div>
                                <div style="font-size: 0.85rem; color: ${estadoInfo.texto}; opacity: 0.8; margin-top: 4px;">
                                    ${estadoInfo.descripcion}
                                </div>
                            </div>
                        </div>

                        <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                            <p style="margin: 0; color: #991b1b;">
                                <strong>🚫 No se puede crear:</strong> Ya existe una planilla ${tipoTexto.toLowerCase()} para ${mesNombre} ${anio} en este departamento.
                            </p>
                        </div>
                        
                        <div style="background: #e0f2fe; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #0891b2;">
                            <p style="margin: 0; color: #0891b2; font-size: 0.9rem;">
                                <strong>💡 Opciones disponibles:</strong><br>
                                • Seleccione un período diferente<br>
                                • Cambie el tipo de planilla<br>
                                • Consulte con el administrador sobre la planilla existente
                            </p>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#1e40af',
                width: '650px'
            });
            
            return; // No continuar si ya existe
        }
        
        // Si no existe, continuar con el proceso normal
        // Guardar configuración
        planillaConfig = {
            tipo: tipo,
            mes: parseInt(mes),
            anio: parseInt(anio),
            confirmada: true
        };
        
        // Actualizar interfaz
        actualizarVistaPlanillaConfirmada();
        mostrarInformacionEnHeader();
        
        // Ocultar toda la sección de configuración
        const payrollTypeSection = document.querySelector('.payroll-type-section');
        setTimeout(() => {
            payrollTypeSection.classList.add('hidden');
        }, 300);
        
        // Cargar colaboradores
        cargarColaboradoresDespuesDeConfirmar();
        
        Swal.fire({
            icon: 'success',
            title: 'Configuración confirmada',
            text: 'Cargando colaboradores del departamento...',
            timer: 2000,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('Error al verificar planilla:', error);
        
        // Cerrar loading en caso de error
        Swal.close();
        
        Swal.fire({
            icon: 'error',
            title: 'Error de verificación',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin-bottom: 10px; color: #991b1b;">
                            <strong>❌ Error técnico:</strong> No se pudo verificar si existe una planilla duplicada.
                        </p>
                        <p style="margin: 0; color: #991b1b; font-size: 0.9rem;">
                            <strong>Detalles:</strong> ${error.message || 'Error de conexión con la base de datos'}
                        </p>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e;">
                            <strong>💡 Sugerencia:</strong> Verifique la conexión a la base de datos y vuelva a intentarlo.
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
async function cargarColaboradoresDespuesDeConfirmar() {
    try {
        // Mostrar loading
        const loadingSwal = mostrarCargando('Cargando colaboradores...');
        
        // Buscar colaboradores
        await buscarColaboradoresAutomatico();
        
        // Cerrar loading
        Swal.close();
        
        // Mostrar notificación de éxito
        setTimeout(() => {
            Swal.fire({
                icon: 'success',
                title: 'Colaboradores cargados',
                text: `Se encontraron ${allCollaborators.length} colaboradores en su departamento.`,
                timer: 2500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }, 500);
        
    } catch (error) {
        console.error('Error al cargar colaboradores:', error);
        Swal.close();
        
        Swal.fire({
            icon: 'error',
            title: 'Error al cargar colaboradores',
            text: 'No se pudieron cargar los colaboradores del departamento.',
            confirmButtonColor: '#1e40af'
        });
    }
}
function cambiarConfiguracionPlanilla() {
    const form = document.getElementById('payrollTypeForm');
    const confirmed = document.getElementById('payrollConfirmed');
    const planillaInfo = document.getElementById('planillaInfo');
    const payrollTypeSection = document.querySelector('.payroll-type-section');
    
    // Mostrar la sección de configuración
    payrollTypeSection.classList.remove('hidden');
    
    // Mostrar formulario, ocultar vista confirmada
    form.style.display = 'block';
    confirmed.style.display = 'none';
    planillaInfo.style.display = 'none';
    
    // Resetear configuración
    planillaConfig.confirmada = false;
    
    // ⭐ NUEVO: Ocultar colaboradores cuando se cambia la configuración
    ocultarColaboradores();
    
    // Limpiar selecciones de colaboradores
    limpiarSelecciones();
}

function cambiarConfiguracionDesdeHeader() {
    const payrollTypeSection = document.querySelector('.payroll-type-section');
    const planillaInfo = document.getElementById('planillaInfo');
    
    // Mostrar la sección de configuración
    payrollTypeSection.classList.remove('hidden');
    
    // Hacer scroll hacia la sección de configuración
    payrollTypeSection.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
    
    // Ocultar la información del header temporalmente
    planillaInfo.style.display = 'none';
    
    // Resetear configuración
    planillaConfig.confirmada = false;
    
    // ⭐ NUEVO: Ocultar colaboradores cuando se cambia la configuración
    ocultarColaboradores();
    
    // Limpiar selecciones
    limpiarSelecciones();
}
function ocultarColaboradores() {
    const collaboratorsSection = document.getElementById('collaboratorsSection');
    
    // Ocultar sección de colaboradores
    collaboratorsSection.style.display = 'none';
    
    // Limpiar datos
    allCollaborators = [];
    
    // Limpiar lista visual
    const collaboratorsList = document.getElementById('collaboratorsList');
    const collaboratorCount = document.getElementById('collaboratorCount');
    
    collaboratorsList.innerHTML = '';
    collaboratorCount.textContent = '0';
    
    // Limpiar búsqueda
    document.getElementById('searchCollaborator').value = '';
    
    console.log('Colaboradores ocultados - esperando confirmación de planilla');
}
function mostrarInformacionEnHeader() {
    const planillaInfo = document.getElementById('planillaInfo');
    const planillaBadge = document.getElementById('planillaBadge');
    
    const tipoTexto = planillaConfig.tipo === 'quincenal' ? 'Quincenal' : 'Fin de Mes';
    const mesNombre = new Date(planillaConfig.anio, planillaConfig.mes - 1).toLocaleDateString('es-GT', { month: 'short' });
    
    planillaBadge.textContent = `${tipoTexto} • ${mesNombre} ${planillaConfig.anio}`;
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
    
    // Actualizar textos
    const tipoTexto = planillaConfig.tipo === 'quincenal' ? 'Planilla Quincenal' : 'Planilla Fin de Mes';
    const mesNombre = new Date(planillaConfig.anio, planillaConfig.mes - 1).toLocaleDateString('es-GT', { month: 'long' });
    
    confirmedType.textContent = tipoTexto;
    confirmedPeriod.textContent = `${mesNombre} ${planillaConfig.anio}`;
}

function validarFormularioPlanilla() {
    const tipo = document.getElementById('tipoQuincena').value;
    const mes = document.getElementById('mesPlanilla').value;
    const anio = document.getElementById('anioPlanilla').value;
    const confirmarBtn = document.getElementById('confirmarPlanilla');
    
    const todosCompletos = tipo && mes && anio;
    confirmarBtn.disabled = !todosCompletos;
    
    if (todosCompletos) {
        confirmarBtn.classList.add('btn-ready');
    } else {
        confirmarBtn.classList.remove('btn-ready');
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
            
            item.addEventListener('click', () => seleccionarColaborador(collab, item));
            list.appendChild(item);
        });
    }
    
    // ⭐ MOSTRAR la sección solo después de confirmar planilla
    section.style.display = 'block';
    
    // Limpiar búsqueda
    document.getElementById('searchCollaborator').value = '';
    setTimeout(ajustarAlturaLista, 100);
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
            
            item.addEventListener('click', () => seleccionarColaborador(collab, item));
            list.appendChild(item);
        });
    }
    setTimeout(ajustarAlturaLista, 100);
}
function seleccionarColaborador(colaborador, itemElement) {
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
                    <p><strong>👤 Colaborador:</strong> ${colaborador.nombreCompleto}</p>
                    <p><strong>💼 Puesto:</strong> ${colaborador.Nombre}</p>
                    <p><strong>📊 Turnos actuales:</strong> ${colaboradorEnPlanilla.totalTurnos}</p>
                    <p><strong>💰 Total a pagar:</strong> Q ${colaboradorEnPlanilla.totalPago.toFixed(2)}</p>
                    <br>
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
        agregarNuevoColaboradorAPlanilla();
        cerrarCalendario();
        
        Swal.fire({
            icon: 'success',
            title: 'Agregado a planilla',
            text: `${selectedEmployee.nombre} ha sido agregado a la planilla con ${currentShifts.length} turno(s).`,
            timer: 2500,
            showConfirmButton: false
        });
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
                const validacionPlanilla = validarFechaPorTipoPlanilla(dayDate);
                if (!validacionPlanilla.valida && validacionPlanilla.motivo !== 'no_configurada') {
                    dayElement.classList.add('planilla-restricted');
                    if (validacionPlanilla.motivo === 'fuera_quincenal') {
                        dayElement.title = `Día ${dayDate.getDate()} - Fuera del período quincenal (1-15)`;
                    } else if (validacionPlanilla.motivo === 'fuera_fin_mes') {
                        dayElement.title = `Día ${dayDate.getDate()} - Fuera del período fin de mes (${validacionPlanilla.rango})`;
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
    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth();
    const anioActual = fechaActual.getFullYear();
    
    const mesFecha = fecha.getMonth();
    const anioFecha = fecha.getFullYear();
    
    if (anioFecha < anioActual) {
        return {
            valida: false,
            motivo: 'anio_pasado',
            mesActual: mesActual,
            anioActual: anioActual,
            mesFecha: mesFecha,
            anioFecha: anioFecha
        };
    } else if (anioFecha > anioActual) {
        return {
            valida: false,
            motivo: 'anio_futuro',
            mesActual: mesActual,
            anioActual: anioActual,
            mesFecha: mesFecha,
            anioFecha: anioFecha
        };
    } else if (mesFecha < mesActual) {
        return {
            valida: false,
            motivo: 'mes_pasado',
            mesActual: mesActual,
            anioActual: anioActual,
            mesFecha: mesFecha,
            anioFecha: anioFecha
        };
    } else if (mesFecha > mesActual) {
        return {
            valida: false,
            motivo: 'mes_futuro',
            mesActual: mesActual,
            anioActual: anioActual,
            mesFecha: mesFecha,
            anioFecha: anioFecha
        };
    }
    
    return { valida: true };
}

function validarFechaPorTipoPlanilla(fecha) {
    if (!planillaConfig.confirmada) {
        return { valida: false, motivo: 'no_configurada' };
    }
    
    const dia = fecha.getDate();
    const ultimoDiaDelMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
    
    if (planillaConfig.tipo === 'quincenal') {
        // Planilla Quincenal: Solo días 1-15
        if (dia >= 1 && dia <= 15) {
            return { valida: true };
        } else {
            return { 
                valida: false, 
                motivo: 'fuera_quincenal',
                rango: '1-15',
                diaSeleccionado: dia
            };
        }
    } else if (planillaConfig.tipo === 'fin_mes') {
        // Planilla Fin de Mes: Solo días 16-último día
        if (dia >= 16 && dia <= ultimoDiaDelMes) {
            return { valida: true };
        } else {
            return { 
                valida: false, 
                motivo: 'fuera_fin_mes',
                rango: `16-${ultimoDiaDelMes}`,
                diaSeleccionado: dia
            };
        }
    }
    
    return { valida: false, motivo: 'tipo_desconocido' };
}

function esDomingo(fecha) {
    const date = new Date(fecha);
    return date.getDay() === 0; // 0 = domingo
}
function seleccionarFecha(fecha) {
    const dateString = formatDate(fecha);
    const validacionPlanilla = validarFechaPorTipoPlanilla(fecha);
    const validacionMesActual = validarMesActual(fecha);
    
    if (!validacionMesActual.valida) {
        mostrarErrorMesActual(fecha, validacionMesActual);
        return;
    }
    
    if (!validacionPlanilla.valida) {
        mostrarErrorTipoPlanilla(fecha, validacionPlanilla);
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

// 3. NUEVA FUNCIÓN: Confirmar turno de 4 horas con subtipo
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
        totalPago: calcularSalarioColaborador(currentShifts), // ⭐ YA INCLUYE REDONDEO
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
                    seleccionarColaborador(colaboradorData, collaboratorItem);
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
function redondearMontoConOpcion(monto, direccion = 'cercano') {
    switch(direccion) {
        case 'arriba':
            return Math.ceil(monto / 0.05) * 0.05;
        case 'abajo':
            return Math.floor(monto / 0.05) * 0.05;
        default: // 'cercano'
            return Math.round(monto / 0.05) * 0.05;
    }
}
function agregarNuevoColaboradorAPlanilla() {
    const colaboradorData = {
        id: selectedEmployee.id,
        nombre: selectedEmployee.nombre,
        puesto: selectedEmployee.puesto,
        shifts: [...currentShifts],
        turnosMañana: currentShifts.filter(s => s.turno === 1).length,
        turnosMixtos: currentShifts.filter(s => s.turno === 2).length,
        turnos4Horas: currentShifts.filter(s => s.turno === 3).length,
        totalTurnos: currentShifts.length,
        totalPago: calcularSalarioColaborador(currentShifts), // ⭐ YA INCLUYE REDONDEO
        fechaAgregado: new Date().toISOString()
    };
    
    payrollCollaborators.push(colaboradorData);
    
    // Limpiar selección actual
    currentShifts = [];
    
    // Actualizar vista de planilla y visibilidad de acciones
    actualizarVistaPlanilla();
    actualizarVisibilidadAcciones();
    
    Swal.fire({
        icon: 'success',
        title: 'Colaborador agregado',
        text: `${selectedEmployee.nombre} ha sido agregado a la planilla.`,
        timer: 2000,
        showConfirmButton: false
    });
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
    const tipoPlanillaTexto = planillaConfig.tipo === 'quincenal' ? 'Planilla Quincenal' : 'Planilla Fin de Mes';
    const mesNombre = new Date(planillaConfig.anio, planillaConfig.mes - 1).toLocaleDateString('es-GT', { month: 'long' });
    
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
                        <div><strong>Período:</strong> ${mesNombre} ${planillaConfig.anio}</div>
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
                        <strong>🏢 Departamento:</strong> ${nombreDepartamento}<br>
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
                IdTipoPago,
                TipoPago,
                Mes,
                Anyo,
                IdUsuario,
                NombreUsuario
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            currentDepartamentoId,
            totalPagoRedondeado, // ⭐ MONTO REDONDEADO
            totalColaboradores.toString(),
            idTipoPago,
            tipoPagoTexto,
            planillaConfig.mes.toString(),
            planillaConfig.anio.toString(),
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
    // Limpiar arrays de datos
    payrollCollaborators = [];
    currentShifts = [];
    selectedEmployee = null;
    
    // Limpiar selecciones visuales
    document.querySelectorAll('.collaborator-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Actualizar vista de planilla
    actualizarVistaPlanilla();
    
    // Mostrar estado de bienvenida
    document.getElementById('welcomeState').style.display = 'flex';
    document.getElementById('payrollSection').style.display = 'block';
    
    // Actualizar visibilidad de acciones
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
async function cargarDiasEspeciales(departamentoId) {
    try {
        const connection = await connectionString();
        
        // Cargar feriados nacionales (IdDepartamento = 0) + feriados del departamento específico
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
        
        // Almacenar días especiales
        diasEspeciales = result.map(dia => ({
            dia: parseInt(dia.Dia),
            mes: parseInt(dia.Mes),
            idDepartamento: parseInt(dia.IdDepartamento),
            descripcion: dia.Descripcion,
            esNacional: dia.IdDepartamento === 0
        }));
        
        console.log(`Días especiales cargados para departamento ${departamentoId}:`, diasEspeciales);
        
        // Actualizar calendario si está abierto
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
    const mes = date.getMonth() + 1; // getMonth() devuelve 0-11, necesitamos 1-12
    
    return diasEspeciales.find(diaEspecial => 
        diaEspecial.dia === dia && diaEspecial.mes === mes
    );
}

// Funciones para Semana Santa
function calcularDomingoPascua(año) {
    // Algoritmo de Gauss para calcular la Pascua
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
    
    // Definir los días de Semana Santa que son feriados en Guatemala
    const diasSemanaSanta = [
        { nombre: 'Domingo de Ramos', diasAntes: 7, bloqueado: false }, // Opcional
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
                    <div style="margin-top: 10px; background: #e0f2fe; padding: 10px; border-radius: 6px;">
                        <p style="margin: 0; color: #0891b2; font-size: 0.9rem;">
                            <strong>💡 Sugerencia:</strong> Use los controles de navegación para ir al mes actual (${mesActualNombre}).
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
                    <div style="margin-top: 10px; background: #e0f2fe; padding: 10px; border-radius: 6px;">
                        <p style="margin: 0; color: #0891b2; font-size: 0.9rem;">
                            <strong>💡 Sugerencia:</strong> Use los controles de navegación para regresar al mes actual (${mesActualNombre}).
                        </p>
                    </div>
                </div>
            `;
            break;
            
        case 'anio_pasado':
            titulo = 'Año anterior no permitido';
            icono = 'error';
            mensaje = `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>📅 Fecha seleccionada:</strong> ${fechaFormateada}</p>
                    <p><strong>📊 Año de la fecha:</strong> ${validacion.anioFecha}</p>
                    <p><strong>📅 Año actual:</strong> ${validacion.anioActual}</p>
                    <br>
                    <div style="background: #fecaca; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin: 0; color: #991b1b;">
                            <strong>🚫 Restricción temporal:</strong> No se pueden asignar turnos en años anteriores. Solo se permite trabajar en el año y mes actual.
                        </p>
                    </div>
                </div>
            `;
            break;
            
        case 'anio_futuro':
            titulo = 'Año futuro no permitido';
            icono = 'info';
            mensaje = `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>📅 Fecha seleccionada:</strong> ${fechaFormateada}</p>
                    <p><strong>📊 Año de la fecha:</strong> ${validacion.anioFecha}</p>
                    <p><strong>📅 Año actual:</strong> ${validacion.anioActual}</p>
                    <br>
                    <div style="background: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <p style="margin: 0; color: #1e40af;">
                            <strong>ℹ️ Restricción temporal:</strong> No se pueden asignar turnos en años futuros. Solo se permite trabajar en el año y mes actual.
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

function mostrarErrorTipoPlanilla(fecha, validacion) {
    const fechaFormateada = formatDateDisplay(fecha);
    const mesNombre = fecha.toLocaleDateString('es-GT', { month: 'long' });
    const anio = fecha.getFullYear();
    
    let titulo, mensaje, colorFondo, colorBorde, colorTexto, icono;
    
    if (validacion.motivo === 'fuera_quincenal') {
        titulo = 'Fuera del período quincenal';
        icono = 'warning';
        colorFondo = '#fef3c7';
        colorBorde = '#f59e0b';
        colorTexto = '#92400e';
        mensaje = `
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>📅 Fecha seleccionada:</strong> ${fechaFormateada}</p>
                <p><strong>📋 Tipo de planilla:</strong> Planilla Quincenal</p>
                <p><strong>📊 Día seleccionado:</strong> ${validacion.diaSeleccionado}</p>
                <br>
                <div style="background: ${colorFondo}; padding: 15px; border-radius: 8px; border-left: 4px solid ${colorBorde};">
                    <p style="margin: 0; color: ${colorTexto};">
                        <strong>⚠️ Restricción de planilla:</strong> La planilla quincenal solo permite seleccionar días del <strong>1 al 15</strong> de ${mesNombre} ${anio}.
                    </p>
                </div>
                <div style="margin-top: 10px; background: #e0f2fe; padding: 10px; border-radius: 6px;">
                    <p style="margin: 0; color: #0891b2; font-size: 0.9rem;">
                        <strong>💡 Sugerencia:</strong> Para trabajar en la segunda quincena, cambie a "Planilla Fin de Mes" en la configuración.
                    </p>
                </div>
            </div>
        `;
    } else if (validacion.motivo === 'fuera_fin_mes') {
        titulo = 'Fuera del período de fin de mes';
        icono = 'warning';
        colorFondo = '#fecaca';
        colorBorde = '#ef4444';
        colorTexto = '#991b1b';
        mensaje = `
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>📅 Fecha seleccionada:</strong> ${fechaFormateada}</p>
                <p><strong>📋 Tipo de planilla:</strong> Planilla Fin de Mes</p>
                <p><strong>📊 Día seleccionado:</strong> ${validacion.diaSeleccionado}</p>
                <br>
                <div style="background: ${colorFondo}; padding: 15px; border-radius: 8px; border-left: 4px solid ${colorBorde};">
                    <p style="margin: 0; color: ${colorTexto};">
                        <strong>🚫 Restricción de planilla:</strong> La planilla de fin de mes solo permite seleccionar días del <strong>${validacion.rango}</strong> de ${mesNombre} ${anio}.
                    </p>
                </div>
                <div style="margin-top: 10px; background: #e0f2fe; padding: 10px; border-radius: 6px;">
                    <p style="margin: 0; color: #0891b2; font-size: 0.9rem;">
                        <strong>💡 Sugerencia:</strong> Para trabajar en la primera quincena, cambie a "Planilla Quincenal" en la configuración.
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

//Valiación de planillas duplicadas
async function verificarPlanillaExistente(tipo, mes, anio, departamentoId) {
    try {
        const connection = await connectionString();
        
        // Determinar IdTipoPago basado en el tipo de planilla
        const idTipoPago = tipo === 'quincenal' ? 1 : 2;
        
        const result = await connection.query(`
            SELECT 
                p.IdPlanillaParcial,
                p.TipoPago,
                p.Mes,
                p.Anyo,
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
                p.IdTipoPago = ? AND 
                p.Mes = ? AND 
                p.Anyo = ?
        `, [departamentoId, idTipoPago, mes.toString(), anio.toString()]);
        
        await connection.close();
        
        return result.length > 0 ? result[0] : null;
        
    } catch (error) {
        console.error('Error al verificar planilla existente:', error);
        throw error;
    }
}
async function cargarEstadosPlanilla() {
    try {
        const connection = await connectionString();
        
        const result = await connection.query(`
            SELECT 
                IdEstadoPagoPlanillaParcial,
                NombreEstado
            FROM PagoPlanillaParcialEstados
            ORDER BY IdEstadoPagoPlanillaParcial
        `);
        
        await connection.close();
        
        return result;
        
    } catch (error) {
        console.error('Error al cargar estados de planilla:', error);
        return [];
    }
}

// Función global para eliminar turnos (llamada desde HTML)
window.eliminarTurno = eliminarTurno;
window.editarColaborador = editarColaborador; 
window.eliminarColaboradorDePlanilla = eliminarColaboradorDePlanilla;
window.cambiarConfiguracionDesdeHeader = cambiarConfiguracionDesdeHeader;