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
// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Iniciando aplicación...');
    
    try {
        mostrarFechaActual();
        await cargarDepartamentos();
        await cargarTarifasSalarios();
        generarFechasSemanaSanta();
        inicializarEventos();
        inicializarPlanilla(); // ⭐ AGREGAR ESTA LÍNEA
        console.log('Aplicación inicializada correctamente');
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        mostrarError('Error al inicializar la aplicación');
    }
});
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

// Cargar tarifas de salarios del año actual
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

// Cargar departamentos
async function cargarDepartamentos() {
    try {
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
            ORDER BY departamentos.NombreDepartamento
        `);
        await connection.close();
        
        const select = document.getElementById('departamento');
        select.innerHTML = '<option value="">Seleccione departamento...</option>';
        
        result.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.IdDepartamento;
            option.textContent = dept.NombreDepartamento;
            option.dataset.regionId = dept.IdRegion;
            option.dataset.regionName = dept.NombreRegion;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarError('Error al cargar los departamentos');
    }
}

// Inicializar eventos
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

    // ⭐ SELECCIÓN DE DEPARTAMENTO - VERSIÓN ACTUALIZADA CON CARGA DE FERIADOS
    addSafeEventListener('departamento', 'change', async (e) => {
        const selectedOption = e.target.selectedOptions[0];
        const departmentBadge = document.getElementById('departmentBadge');
        const buscarBtn = document.getElementById('buscarColaboradores');
        
        if (selectedOption.value) {
            const regionId = parseInt(selectedOption.dataset.regionId);
            const departamentoId = parseInt(selectedOption.value);
            
            // Actualizar variables globales
            isCapitalino = regionId === 3;
            currentDepartamentoId = departamentoId;
            
            // Mostrar indicador de carga
            departmentBadge.textContent = 'Cargando días especiales...';
            departmentBadge.className = 'department-badge';
            departmentBadge.style.display = 'inline-block';
            buscarBtn.disabled = true;
            
            try {
                // Cargar días especiales del departamento
                await cargarDiasEspeciales(departamentoId);
                
                // Actualizar badge del departamento
                departmentBadge.textContent = isCapitalino ? 
                    `Región Capitalina` : 
                    `Región ${selectedOption.dataset.regionName}`;
                departmentBadge.className = `department-badge ${isCapitalino ? 'capitalino' : 'regional'}`;
                
                buscarBtn.disabled = false;
                
            } catch (error) {
                console.error('Error al configurar departamento:', error);
                departmentBadge.textContent = 'Error al cargar configuración';
                departmentBadge.className = 'department-badge';
            }
        } else {
            departmentBadge.style.display = 'none';
            buscarBtn.disabled = true;
            diasEspeciales = [];
            currentDepartamentoId = null;
        }
        
        limpiarSelecciones();
    });
    
    // Buscar colaboradores y colapsar formulario
    addSafeEventListener('buscarColaboradores', 'click', () => {
        buscarColaboradores();
        colapsarFormularioDepartamento();
    });
    
    // Toggle acordeón departamento
    addSafeEventListener('toggleDepartment', 'click', toggleDepartmentForm);
    
    const departmentHeader = document.getElementById('departmentHeader');
    if (departmentHeader) {
        departmentHeader.addEventListener('click', toggleDepartmentForm);
    }
    
    // Cambiar departamento (expandir formulario)
    addSafeEventListener('changeDepartment', 'click', expandirFormularioDepartamento);
    
    // Búsqueda en tiempo real
    addSafeEventListener('searchCollaborator', 'input', filtrarColaboradores);

    addSafeEventListener('openCalendarFromSummary', 'click', abrirCalendario);
    
    // Modal del calendario
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
    addSafeEventListener('clearShiftsFromModal', 'click', limpiarTurnosActuales);
    
    // Modal de selección de turno
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
    
    // EVENT LISTENERS PARA TURNOS ACTUALES
    addSafeEventListener('clearCurrentShifts', 'click', limpiarTurnosActuales);
    
    // EVENT LISTENERS PARA PLANILLA FINAL
    addSafeEventListener('clearAllPayroll', 'click', limpiarTodaLaPlanilla);
    addSafeEventListener('generateFinalPayroll', 'click', generarPlanillaFinal);
    
    console.log('Event listeners inicializados correctamente');
}
function limpiarTurnosActuales() {
    if (currentShifts.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'No hay turnos',
            text: 'No hay turnos registrados para limpiar.',
            confirmButtonColor: '#1e40af'
        });
        return;
    }
    
    Swal.fire({
        title: '¿Limpiar turnos actuales?',
        text: 'Esta acción eliminará todos los turnos del colaborador actual.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, limpiar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444'
    }).then((result) => {
        if (result.isConfirmed) {
            currentShifts = [];
            actualizarCalendario();
            actualizarResumenModal();
            actualizarResumenTurnosActuales();
            
            Swal.fire({
                icon: 'success',
                title: 'Turnos limpiados',
                text: 'Los turnos han sido eliminados.',
                timer: 1500,
                showConfirmButton: false
            });
        }
    });
}
function generarPlanillaFinal() {
    if (payrollCollaborators.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Planilla vacía',
            text: 'Debe agregar al menos un colaborador a la planilla.',
            confirmButtonColor: '#1e40af'
        });
        return;
    }
    
    const totalPago = payrollCollaborators.reduce((sum, c) => sum + c.totalPago, 0);
    const region = isCapitalino ? 'Capitalina' : 'Regional';
    
    Swal.fire({
        title: 'Planilla Final Generada',
        html: generarResumenPlanillaHTML(),
        icon: 'success',
        confirmButtonText: 'Imprimir/Guardar',
        showCancelButton: true,
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#10b981',
        width: '700px'
    }).then((result) => {
        if (result.isConfirmed) {
            imprimirPlanillaFinal();
        }
    });
}
function imprimirPlanillaFinal() {
    const totalColaboradores = payrollCollaborators.length;
    const totalTurnos = payrollCollaborators.reduce((sum, c) => sum + c.totalTurnos, 0);
    const totalPago = payrollCollaborators.reduce((sum, c) => sum + c.totalPago, 0);
    const region = isCapitalino ? 'Capitalina' : 'Regional';
    
    // Crear contenido de impresión
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Planilla Final de Tiempo Parcial - ${new Date().toLocaleDateString('es-GT')}</title>
            <style>
                body { 
                    font-family: 'Inter', Arial, sans-serif; 
                    margin: 20px; 
                    color: #1f2937; 
                    line-height: 1.5;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 3px solid #1e40af; 
                    padding-bottom: 20px; 
                }
                .header h1 { 
                    color: #1e40af; 
                    margin-bottom: 5px; 
                    font-size: 2rem;
                    font-weight: 700;
                }
                .info-grid { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 15px; 
                    margin-bottom: 25px; 
                }
                .info-item { 
                    background: #f9fafb; 
                    padding: 15px; 
                    border-radius: 8px; 
                    border: 1px solid #e5e7eb; 
                }
                .planilla-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 25px; 
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .planilla-table th, .planilla-table td { 
                    border: 1px solid #d1d5db; 
                    padding: 12px; 
                    text-align: left; 
                }
                .planilla-table th { 
                    background-color: #1e40af; 
                    color: white; 
                    font-weight: 600; 
                }
                .planilla-table tr:nth-child(even) { 
                    background-color: #f9fafb; 
                }
                .total-section {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    padding: 25px;
                    text-align: center;
                    font-size: 1.4rem;
                    font-weight: 700;
                    border-radius: 8px;
                    margin: 25px 0;
                }
                @media print { 
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>PLANILLA FINAL DE TIEMPO PARCIAL</h1>
                <p>Sistema de Recursos Humanos - New Technology</p>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <strong>Región:</strong> ${region}
                </div>
                <div class="info-item">
                    <strong>Fecha de Generación:</strong> ${new Date().toLocaleDateString('es-GT')}
                </div>
                <div class="info-item">
                    <strong>Total Colaboradores:</strong> ${totalColaboradores}
                </div>
                <div class="info-item">
                    <strong>Total Turnos:</strong> ${totalTurnos}
                </div>
            </div>
            
            <table class="planilla-table">
                <thead>
                    <tr>
                        <th>Colaborador</th>
                        <th>ID</th>
                        <th>Puesto</th>
                        <th>T. Mañana</th>
                        <th>T. Mixtos</th>
                        <th>Total Turnos</th>
                        <th>Total a Pagar</th>
                    </tr>
                </thead>
                <tbody>
                    ${payrollCollaborators.map(c => `
                        <tr>
                            <td>${c.nombre}</td>
                            <td>${c.id}</td>
                            <td>${c.puesto}</td>
                            <td style="text-align: center;">${c.turnosMañana}</td>
                            <td style="text-align: center;">${c.turnosMixtos}</td>
                            <td style="text-align: center; font-weight: 600;">${c.totalTurnos}</td>
                            <td style="text-align: right; font-weight: 600; color: #10b981;">Q ${c.totalPago.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="total-section">
                <div>TOTAL GENERAL A PAGAR</div>
                <div style="font-size: 2.5rem; margin-top: 10px;">Q ${totalPago.toFixed(2)}</div>
            </div>
            
            <div style="margin-top: 40px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <p><strong>Planilla generada automáticamente por el Sistema de Recursos Humanos</strong></p>
                <p>© New Technology ${new Date().getFullYear()}</p>
            </div>
            
            <div class="no-print" style="margin-top: 30px; text-align: center;">
                <button onclick="window.print()" style="background: #1e40af; color: white; border: none; padding: 12px 24px; border-radius: 6px; margin-right: 10px; cursor: pointer;">
                    📄 Imprimir Planilla
                </button>
                <button onclick="window.close()" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer;">
                    ✖️ Cerrar
                </button>
            </div>
        </body>
        </html>
    `;
    
    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
}
function generarResumenPlanillaHTML() {
    const totalColaboradores = payrollCollaborators.length;
    const totalTurnos = payrollCollaborators.reduce((sum, c) => sum + c.totalTurnos, 0);
    const totalPago = payrollCollaborators.reduce((sum, c) => sum + c.totalPago, 0);
    const region = isCapitalino ? 'Capitalina' : 'Regional';
    
    return `
        <div style="text-align: left; max-width: 600px; margin: 0 auto;">
            <h4 style="color: #1e40af; margin-bottom: 20px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fas fa-file-invoice-dollar" style="font-size: 1.2rem;"></i>
                Resumen de Planilla General
            </h4>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9rem;">
                    <div><strong>Región:</strong><br>${region}</div>
                    <div><strong>Fecha:</strong><br>${new Date().toLocaleDateString('es-GT')}</div>
                    <div><strong>Total Colaboradores:</strong><br>${totalColaboradores}</div>
                    <div><strong>Total Turnos:</strong><br>${totalTurnos}</div>
                </div>
            </div>
            
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 15px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                    <thead style="background: #f3f4f6; position: sticky; top: 0;">
                        <tr>
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #d1d5db;">Colaborador</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 1px solid #d1d5db;">Turnos</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #d1d5db;">Pago</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payrollCollaborators.map(c => `
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <td style="padding: 8px;">${c.nombre}</td>
                                <td style="padding: 8px; text-align: center;">${c.totalTurnos}</td>
                                <td style="padding: 8px; text-align: right; font-weight: 600; color: #10b981;">Q ${c.totalPago.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 15px;">
                <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Total General a Pagar</div>
                <div style="font-size: 2rem; font-weight: bold;">Q ${totalPago.toFixed(2)}</div>
            </div>
            
            <div style="background: #e0f2fe; padding: 10px; border-radius: 8px; border-left: 4px solid #1e40af;">
                <small style="color: #1e40af; font-weight: 500;">
                    <i class="fas fa-info-circle"></i>
                    Planilla generada el ${new Date().toLocaleDateString('es-GT')} con ${totalColaboradores} colaboradores
                </small>
            </div>
        </div>
    `;
}
function agregarColaboradorAPlanilla() {
    if (!selectedEmployee || currentShifts.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Datos incompletos',
            text: 'Debe tener turnos registrados para agregar a la planilla.',
            confirmButtonColor: '#1e40af'
        });
        return;
    }
    
    // Verificar si el colaborador ya está en la planilla
    const existingIndex = payrollCollaborators.findIndex(c => c.id === selectedEmployee.id);
    
    if (existingIndex !== -1) {
        // Actualizar colaborador existente
        Swal.fire({
            title: 'Colaborador ya existe',
            text: '¿Desea actualizar los turnos de este colaborador?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, actualizar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1e40af'
        }).then((result) => {
            if (result.isConfirmed) {
                actualizarColaboradorEnPlanilla(existingIndex);
            }
        });
    } else {
        // Agregar nuevo colaborador
        agregarNuevoColaboradorAPlanilla();
    }
}
function actualizarColaboradorEnPlanilla(index) {
    payrollCollaborators[index] = {
        ...payrollCollaborators[index],
        shifts: [...currentShifts],
        turnosMañana: currentShifts.filter(s => s.turno === 1).length,
        turnosMixtos: currentShifts.filter(s => s.turno === 2).length,
        totalTurnos: currentShifts.length,
        totalPago: calcularSalarioColaborador(currentShifts),
        fechaActualizado: new Date().toISOString()
    };
    
    // Limpiar selección actual
    currentShifts = [];
    actualizarResumenTurnosActuales();
    
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
    const payrollTotal = document.getElementById('payrollTotal');
    const finalActions = document.getElementById('finalActions');
    const payrollCount = document.getElementById('payrollCount');
    
    // Actualizar contador
    payrollCount.textContent = payrollCollaborators.length;
    
    if (payrollCollaborators.length === 0) {
        // Mostrar estado vacío
        tableBody.innerHTML = '';
        emptyState.style.display = 'flex';
        payrollTotal.style.display = 'none';
        finalActions.style.display = 'none';
    } else {
        // Mostrar tabla con colaboradores
        emptyState.style.display = 'none';
        payrollTotal.style.display = 'block';
        finalActions.style.display = 'flex';
        
        // Generar filas de la tabla
        tableBody.innerHTML = payrollCollaborators.map((colaborador, index) => `
            <tr>
                <td>
                    <div class="collaborator-name-cell">${colaborador.nombre}</div>
                    <div class="collaborator-id-cell">ID: ${colaborador.id}</div>
                </td>
                <td>
                    <span class="shift-count morning">${colaborador.turnosMañana}</span>
                </td>
                <td>
                    <span class="shift-count mixed">${colaborador.turnosMixtos}</span>
                </td>
                <td>
                    <span class="shift-count total">${colaborador.totalTurnos}</span>
                </td>
                <td>
                    <span class="payment-amount">Q ${colaborador.totalPago.toFixed(2)}</span>
                </td>
                <td>
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
                    actualizarResumenTurnosActuales();
                    
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
            confirmButtonColor: '#1e40af'
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
        confirmButtonColor: '#ef4444'
    }).then((result) => {
        if (result.isConfirmed) {
            payrollCollaborators = [];
            actualizarVistaPlanilla();
            
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
function actualizarTotalesGenerales() {
    const totalColaboradores = payrollCollaborators.length;
    const totalTurnos = payrollCollaborators.reduce((sum, c) => sum + c.totalTurnos, 0);
    const totalPago = payrollCollaborators.reduce((sum, c) => sum + c.totalPago, 0);
    
    document.getElementById('totalCollaborators').textContent = totalColaboradores;
    document.getElementById('totalShifts').textContent = totalTurnos;
    document.getElementById('totalAmount').textContent = `Q ${totalPago.toFixed(2)}`;
}
function calcularSalarioColaborador(shifts) {
    const region = isCapitalino ? 'capitalino' : 'regional';
    if (!salaryRates[region] || shifts.length === 0) return 0;
    
    let total = 0;
    const turnosMañana = shifts.filter(s => s.turno === 1).length;
    const turnosMixtos = shifts.filter(s => s.turno === 2).length;
    
    if (turnosMañana > 0 && salaryRates[region][1]) {
        total += turnosMañana * salaryRates[region][1].salarioXturno;
    }
    
    if (turnosMixtos > 0 && salaryRates[region][2]) {
        total += turnosMixtos * salaryRates[region][2].salarioXturno;
    }
    
    return total;
}

function agregarNuevoColaboradorAPlanilla() {
    const colaboradorData = {
        id: selectedEmployee.id,
        nombre: selectedEmployee.nombre,
        puesto: selectedEmployee.puesto,
        shifts: [...currentShifts], // Copia de los turnos
        turnosMañana: currentShifts.filter(s => s.turno === 1).length,
        turnosMixtos: currentShifts.filter(s => s.turno === 2).length,
        totalTurnos: currentShifts.length,
        totalPago: calcularSalarioColaborador(currentShifts),
        fechaAgregado: new Date().toISOString()
    };
    
    payrollCollaborators.push(colaboradorData);
    
    // Limpiar selección actual
    currentShifts = [];
    actualizarResumenTurnosActuales();
    
    // Actualizar vista de planilla
    actualizarVistaPlanilla();
    
    Swal.fire({
        icon: 'success',
        title: 'Colaborador agregado',
        text: `${selectedEmployee.nombre} ha sido agregado a la planilla.`,
        timer: 2000,
        showConfirmButton: false
    });
}
// Colapsar formulario de departamento después de buscar
function colapsarFormularioDepartamento() {
    const selectedOption = document.getElementById('departamento').selectedOptions[0];
    if (!selectedOption.value) return;
    
    const departmentForm = document.getElementById('departmentForm');
    const selectedDepartment = document.getElementById('selectedDepartment');
    const toggleBtn = document.getElementById('toggleDepartment');
    const selectedName = document.getElementById('selectedDepartmentName');
    const selectedBadge = document.getElementById('selectedDepartmentBadge');
    
    // Ocultar formulario
    departmentForm.classList.add('collapsed');
    setTimeout(() => {
        departmentForm.style.display = 'none';
    }, 300);
    
    // Mostrar vista colapsada
    selectedName.textContent = selectedOption.textContent;
    selectedBadge.textContent = isCapitalino ? 'Capitalina' : `Región ${selectedOption.dataset.regionName}`;
    selectedBadge.className = `selected-badge ${isCapitalino ? 'capitalino' : 'regional'}`;
    
    selectedDepartment.style.display = 'flex';
    toggleBtn.style.display = 'block';
    toggleBtn.classList.add('collapsed');
}

// Expandir formulario de departamento
function expandirFormularioDepartamento() {
    const departmentForm = document.getElementById('departmentForm');
    const selectedDepartment = document.getElementById('selectedDepartment');
    const toggleBtn = document.getElementById('toggleDepartment');
    
    // Mostrar formulario
    selectedDepartment.style.display = 'none';
    departmentForm.style.display = 'block';
    departmentForm.classList.remove('collapsed');
    
    toggleBtn.classList.remove('collapsed');
}

// Toggle del acordeón
function toggleDepartmentForm() {
    const departmentForm = document.getElementById('departmentForm');
    const selectedOption = document.getElementById('departamento').selectedOptions[0];
    if (!selectedOption.value) return;
    
    if (departmentForm.style.display === 'none') {
        expandirFormularioDepartamento();
    } else {
        colapsarFormularioDepartamento();
    }
}

// Buscar colaboradores del departamento seleccionado
async function buscarColaboradores() {
    const departamentoId = document.getElementById('departamento').value;
    if (!departamentoId) return;
    
    mostrarCargando('Buscando colaboradores...');
    
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
        `, [departamentoId]);
        
        await connection.close();
        
        Swal.close();
        allCollaborators = result.map(collab => ({
            ...collab,
            nombreCompleto: `${collab.PrimerNombre} ${collab.SegundoNombre || ''} ${collab.TercerNombre || ''} ${collab.PrimerApellido} ${collab.SegundoApellido || ''}`.trim().replace(/\s+/g, ' ')
        }));
        
        mostrarColaboradores(allCollaborators);
        
    } catch (error) {
        console.error('Error al buscar colaboradores:', error);
        Swal.close();
        mostrarError('Error al buscar colaboradores');
    }
}

// Mostrar colaboradores en la interfaz
function mostrarColaboradores(colaboradores) {
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
    
    section.style.display = 'block';
    
    // Limpiar búsqueda
    document.getElementById('searchCollaborator').value = '';
    setTimeout(ajustarAlturaLista, 100);
}

// Filtrar colaboradores en tiempo real
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

// Seleccionar colaborador
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
    
    // Limpiar turnos actuales (CAMBIO: era selectedShifts)
    currentShifts = [];
    
    // Ocultar estado de bienvenida
    document.getElementById('welcomeState').style.display = 'none';
    
    document.getElementById('currentShiftsSection').style.display = 'block';
    
    // Actualizar resumen de turnos actuales
    actualizarResumenTurnosActuales();
}
function actualizarResumenTurnosActuales() {
    const turnosMañana = currentShifts.filter(s => s.turno === 1).length;
    const turnosMixtos = currentShifts.filter(s => s.turno === 2).length;
    const totalTurnos = currentShifts.length;
    
    document.getElementById('currentMorningCount').textContent = turnosMañana;
    document.getElementById('currentMixedCount').textContent = turnosMixtos;
    document.getElementById('currentTotalCount').textContent = totalTurnos;
}

// Limpiar selección de empleado
function limpiarSeleccionEmpleado() {
    // Remover selección visual
    document.querySelectorAll('.collaborator-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Limpiar variables
    selectedEmployee = null;
    currentShifts = []; // CAMBIO: era selectedShifts

    document.getElementById('currentShiftsSection').style.display = 'none';
    
    // Mantener la planilla visible pero mostrar bienvenida si no hay colaboradores
    if (payrollCollaborators.length === 0) {
        document.getElementById('welcomeState').style.display = 'flex';
    }
}

// Limpiar todas las selecciones
function limpiarSelecciones() {
    limpiarSeleccionEmpleado();
    document.getElementById('collaboratorsSection').style.display = 'none';
    document.getElementById('searchCollaborator').value = '';
    allCollaborators = [];
    
    // Restaurar formulario de departamento si está colapsado
    const departmentForm = document.getElementById('departmentForm');
    const selectedDepartment = document.getElementById('selectedDepartment');
    const toggleBtn = document.getElementById('toggleDepartment');
    
    if (departmentForm.style.display === 'none') {
        expandirFormularioDepartamento();
        toggleBtn.style.display = 'none';
    }
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
    actualizarResumenTurnosActuales();
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
            // Verificar si es domingo
            if (esDomingo(dayDate)) {
                dayElement.classList.add('sunday-blocked');
                dayElement.title = 'Los domingos no son días laborables';
                dayElement.addEventListener('click', () => seleccionarFecha(dayDate));
            }
            // ⭐ NUEVA VALIDACIÓN: Verificar si es Semana Santa
            else {
                const diaSemanaSanta = esSemanaSanta(dayDate);
                if (diaSemanaSanta) {
                    dayElement.classList.add('easter-week');
                    dayElement.title = `${diaSemanaSanta.nombre} - Semana Santa`;
                    dayElement.addEventListener('click', () => seleccionarFecha(dayDate));
                }
                // Verificar si es día especial/feriado
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
                        // Día laborable normal - verificar turnos asignados
                        const dateString = formatDate(dayDate);
                        const shift = currentShifts.find(s => s.fecha === dateString);
                        
                        if (shift) {
                            if (shift.turno === 1) {
                                dayElement.classList.add('morning-shift');
                            } else if (shift.turno === 2) {
                                dayElement.classList.add('mixed-shift');
                            }
                        }
                        
                        // Agregar evento de clic para días laborables
                        dayElement.addEventListener('click', () => seleccionarFecha(dayDate));
                    }
                }
            }
        }
        
        grid.appendChild(dayElement);
    }
    
    // Actualizar indicadores de semana
    actualizarIndicadoresSemana();
}
function esDomingo(fecha) {
    const date = new Date(fecha);
    return date.getDay() === 0; // 0 = domingo
}

// Seleccionar fecha en el calendario
function seleccionarFecha(fecha) {
    const dateString = formatDate(fecha);
    
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
                            <strong>🎊 Información:</strong> Este día está designado como feriado/asueto y no es laborable para los colaboradores.
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
        Swal.fire({
            title: '¿Eliminar turno?',
            text: `Esta fecha ya tiene un turno ${existingShift.turno === 1 ? 'de mañana' : 'mixto'} asignado. ¿Desea eliminarlo?`,
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
function actualizarIndicadoresSemana() {
    const calendarDays = document.querySelectorAll('.calendar-day:not(.other-month)');
    
    calendarDays.forEach(dayElement => {
        // Remover indicadores anteriores
        dayElement.classList.remove('week-full', 'week-almost-full');
        
        if (!dayElement.classList.contains('other-month')) {
            const dayNumber = parseInt(dayElement.textContent);
            const fecha = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber);
            const turnosEnSemana = contarTurnosEnSemana(fecha);
            
            // Agregar clases CSS según la cantidad de turnos en la semana
            if (turnosEnSemana >= 4) {
                dayElement.classList.add('week-full');
            } else if (turnosEnSemana === 3) {
                dayElement.classList.add('week-almost-full');
            }
        }
    });
}
// Seleccionar tipo de turno
function seleccionarTipoTurno(tipoTurno) {
    const fecha = window.tempSelectedDate;
    const turno = parseInt(tipoTurno);
    
    currentShifts.push({ // CAMBIO: era selectedShifts
        fecha: fecha,
        turno: turno,
        fechaDisplay: document.getElementById('selectedDate').textContent
    });
    
    actualizarCalendario();
    actualizarResumenModal();
    cerrarModal();
    
    delete window.tempSelectedDate;
}

// Eliminar turno
function eliminarTurno(fecha) {
    currentShifts = currentShifts.filter(s => s.fecha !== fecha); // CAMBIO: era selectedShifts
    actualizarCalendario();
    actualizarResumenModal();
    actualizarResumenTurnosActuales(); // CAMBIO: era actualizarResumenTurnos
}

// Cerrar modal de selección de turno
function cerrarModal() {
    document.getElementById('shiftModal').style.display = 'none';
    delete window.tempSelectedDate;
}

// Actualizar resumen en el modal
function actualizarResumenModal() {
    const turnosMañana = currentShifts.filter(s => s.turno === 1).length; // CAMBIO
    const turnosMixtos = currentShifts.filter(s => s.turno === 2).length; // CAMBIO
    const totalTurnos = currentShifts.length; // CAMBIO
    
    document.getElementById('modalMorningCount').textContent = turnosMañana;
    document.getElementById('modalMixedCount').textContent = turnosMixtos;
    document.getElementById('modalTotalCount').textContent = totalTurnos;
}
// Imprimir planilla
function imprimirPlanilla() {
    const region = isCapitalino ? 'Capitalina' : 'Regional';
    const totalSalario = document.getElementById('totalPayment').textContent;
    
    // Crear contenido de impresión
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Planilla Tiempo Parcial - ${selectedEmployee.nombre}</title>
            <style>
                body { 
                    font-family: 'Inter', Arial, sans-serif; 
                    margin: 20px; 
                    color: #1f2937; 
                    line-height: 1.5;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 3px solid #1e40af; 
                    padding-bottom: 20px; 
                }
                .header h1 { 
                    color: #1e40af; 
                    margin-bottom: 5px; 
                    font-size: 1.8rem;
                    font-weight: 700;
                }
                .header p {
                    color: #6b7280;
                    margin: 5px 0;
                }
                .company-info {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border: 1px solid #e5e7eb;
                }
                .info-grid { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 15px; 
                    margin-bottom: 25px; 
                }
                .info-item { 
                    background: #f9fafb; 
                    padding: 15px; 
                    border-radius: 8px; 
                    border: 1px solid #e5e7eb; 
                }
                .info-item strong { 
                    color: #1e40af; 
                    font-weight: 600;
                    display: block;
                    margin-bottom: 5px;
                }
                .section-title {
                    color: #1e40af;
                    font-size: 1.2rem;
                    font-weight: 600;
                    margin: 25px 0 15px 0;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #e5e7eb;
                }
                .shifts-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 25px; 
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .shifts-table th, .shifts-table td { 
                    border: 1px solid #d1d5db; 
                    padding: 12px; 
                    text-align: left; 
                }
                .shifts-table th { 
                    background-color: #1e40af; 
                    color: white; 
                    font-weight: 600; 
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .shifts-table tr:nth-child(even) { 
                    background-color: #f9fafb; 
                }
                .shifts-table tr:hover {
                    background-color: #f3f4f6;
                }
                .total-section {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    padding: 25px;
                    text-align: center;
                    font-size: 1.4rem;
                    font-weight: 700;
                    border-radius: 8px;
                    margin: 25px 0;
                    box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
                }
                .total-label {
                    font-size: 1rem;
                    opacity: 0.9;
                    margin-bottom: 8px;
                    font-weight: 500;
                }
                .breakdown-section {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border: 1px solid #e5e7eb;
                }
                .breakdown-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #e5e7eb;
                }
                .breakdown-item:last-child {
                    border-bottom: none;
                    font-weight: 600;
                    color: #1e40af;
                }
                .footer { 
                    margin-top: 40px; 
                    text-align: center; 
                    color: #6b7280; 
                    font-size: 0.9rem; 
                    border-top: 1px solid #e5e7eb; 
                    padding-top: 20px; 
                }
                .signature-section {
                    margin-top: 40px;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                }
                .signature-box {
                    text-align: center;
                    padding-top: 30px;
                    border-top: 1px solid #374151;
                }
                @media print { 
                    .no-print { display: none; }
                    body { margin: 15px; }
                    .header { page-break-after: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>PLANILLA DE TIEMPO PARCIAL</h1>
                <p>Sistema de Recursos Humanos</p>
                <p><strong>New Technology ${new Date().getFullYear()}</strong></p>
            </div>
            
            <div class="company-info">
                <strong>Información de la Empresa:</strong> New Technology - Sistema de Gestión de Recursos Humanos
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <strong>Colaborador</strong>
                    ${selectedEmployee.nombre}
                </div>
                <div class="info-item">
                    <strong>ID Personal</strong>
                    ${selectedEmployee.id}
                </div>
                <div class="info-item">
                    <strong>Puesto de Trabajo</strong>
                    ${selectedEmployee.puesto}
                </div>
                <div class="info-item">
                    <strong>Región</strong>
                    ${region}
                </div>
                <div class="info-item">
                    <strong>Período Trabajado</strong>
                    ${obtenerPeriodoTurnos()}
                </div>
                <div class="info-item">
                    <strong>Fecha de Generación</strong>
                    ${new Date().toLocaleDateString('es-GT')}
                </div>
            </div>
            
            <h3 class="section-title">Detalle de Turnos Trabajados</h3>
            <table class="shifts-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Día de la Semana</th>
                        <th>Tipo de Turno</th>
                        <th>Tarifa por Turno</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${generarFilasTurnos()}
                </tbody>
            </table>
            
            <h3 class="section-title">Desglose de Pagos</h3>
            <div class="breakdown-section">
                ${generarDesglosePagos()}
            </div>
            
            <div class="total-section">
                <div class="total-label">TOTAL A PAGAR</div>
                <div>${totalSalario}</div>
            </div>
            
            <div class="signature-section">
                <div class="signature-box">
                    <strong>Firma del Empleado</strong><br>
                    ${selectedEmployee.nombre}
                </div>
                <div class="signature-box">
                    <strong>Firma Recursos Humanos</strong><br>
                    New Technology
                </div>
            </div>
            
            <div class="footer">
                <p><strong>Planilla generada automáticamente por el Sistema de Recursos Humanos</strong></p>
                <p>Este documento es válido únicamente con las firmas correspondientes</p>
                <p>© New Technology ${new Date().getFullYear()} - Todos los derechos reservados</p>
            </div>
            
            <div class="no-print" style="margin-top: 30px; text-align: center;">
                <button onclick="window.print()" style="background: #1e40af; color: white; border: none; padding: 12px 24px; border-radius: 6px; margin-right: 10px; cursor: pointer; font-weight: 600;">
                    📄 Imprimir Planilla
                </button>
                <button onclick="window.close()" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    ✖️ Cerrar Ventana
                </button>
            </div>
        </body>
        </html>
    `;
    
    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
}

// Generar filas de turnos para impresión
function generarFilasTurnos() {
    const region = isCapitalino ? 'capitalino' : 'regional';
    let filas = '';
    
    currentShifts // ⚠️ CAMBIAR selectedShifts por currentShifts
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        .forEach(shift => {
            const fecha = new Date(shift.fecha);
            const diaSemana = fecha.toLocaleDateString('es-GT', { weekday: 'long' });
            const fechaFormateada = shift.fechaDisplay;
            const tipoTurno = shift.turno === 1 ? 'Turno Mañana' : 'Turno Mixto';
            const tarifa = salaryRates[region][shift.turno]?.salarioXturno || 0;
            
            filas += `
                <tr>
                    <td>${fechaFormateada}</td>
                    <td style="text-transform: capitalize;">${diaSemana}</td>
                    <td>
                        <span style="background: ${shift.turno === 1 ? '#fef3c7; color: #92400e' : '#ddd6fe; color: #5b21b6'}; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                            ${shift.turno === 1 ? '☀️' : '🌙'} ${tipoTurno}
                        </span>
                    </td>
                    <td style="font-weight: 600;">Q ${tarifa.toFixed(2)}</td>
                    <td style="font-weight: 600; color: #10b981;">Q ${tarifa.toFixed(2)}</td>
                </tr>
            `;
        });
    
    return filas;
}

// Generar desglose de pagos para impresión
function generarDesglosePagos() {
    const region = isCapitalino ? 'capitalino' : 'regional';
    let desglose = '';
    let total = 0;
    
    const turnosMañana = currentShifts.filter(s => s.turno === 1).length; // ⚠️ CAMBIAR selectedShifts
    const turnosMixtos = currentShifts.filter(s => s.turno === 2).length; // ⚠️ CAMBIAR selectedShifts
    
    if (turnosMañana > 0 && salaryRates[region][1]) {
        const subtotal = turnosMañana * salaryRates[region][1].salarioXturno;
        total += subtotal;
        desglose += `
            <div class="breakdown-item">
                <span>${turnosMañana} Turno(s) de Mañana × Q ${salaryRates[region][1].salarioXturno.toFixed(2)}</span>
                <span>Q ${subtotal.toFixed(2)}</span>
            </div>
        `;
    }
    
    if (turnosMixtos > 0 && salaryRates[region][2]) {
        const subtotal = turnosMixtos * salaryRates[region][2].salarioXturno;
        total += subtotal;
        desglose += `
            <div class="breakdown-item">
                <span>${turnosMixtos} Turno(s) Mixto(s) × Q ${salaryRates[region][2].salarioXturno.toFixed(2)}</span>
                <span>Q ${subtotal.toFixed(2)}</span>
            </div>
        `;
    }
    
    desglose += `
        <div class="breakdown-item">
            <span><strong>TOTAL GENERAL</strong></span>
            <span><strong>Q ${total.toFixed(2)}</strong></span>
        </div>
    `;
    
    return desglose;
}

// Obtener período de turnos
function obtenerPeriodoTurnos() {
    if (currentShifts.length === 0) return 'Sin turnos registrados'; // ⚠️ CAMBIAR selectedShifts
    
    const fechas = currentShifts.map(s => new Date(s.fecha)).sort((a, b) => a - b); // ⚠️ CAMBIAR selectedShifts
    const primera = fechas[0].toLocaleDateString('es-GT');
    const ultima = fechas[fechas.length - 1].toLocaleDateString('es-GT');
    
    return primera === ultima ? primera : `${primera} - ${ultima}`;
}

// Funciones auxiliares
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

function obtenerSemana(fecha) {
    const date = new Date(fecha);
    // Asegurar que sea lunes el primer día de la semana
    const day = date.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const lunes = new Date(date.getFullYear(), date.getMonth(), diff);
    
    const año = lunes.getFullYear();
    const mes = lunes.getMonth() + 1;
    const dia = lunes.getDate();
    
    return `${año}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
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
// Esta parte valida dias especiales y los almacena para aquellas fechas que son asuetos, feriados o especiales

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
// Funcion para Semana Santa
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
// Función global para eliminar turnos (llamada desde HTML)
window.eliminarTurno = eliminarTurno;
window.editarColaborador = editarColaborador; 
window.eliminarColaboradorDePlanilla = eliminarColaboradorDePlanilla;