const { connectionString } = require('../Conexion/Conexion');
const XLSX = require('xlsx');
const Swal = require('sweetalert2');

// Variables globales
let currentPlanillaData = null;
let currentDetailsData = [];
let currentPage = 1;
const rowsPerPage = 30;
let totalRows = 0;

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

// Función para formatear moneda
function formatearMoneda(valor) {
    if (valor === null || valor === undefined) return 'Q0.00';
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 2
    }).format(valor);
}

// Función para formatear fecha
function formatearFecha(fecha) {
    if (!fecha) return '';
    
    let fechaObj;
    if (fecha instanceof Date) {
        fechaObj = fecha;
    } else if (typeof fecha === 'string') {
        fechaObj = new Date(fecha);
    } else {
        return '';
    }
    
    if (isNaN(fechaObj.getTime())) return '';
    
    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const anio = fechaObj.getFullYear();
    const hora = fechaObj.getHours().toString().padStart(2, '0');
    const minutos = fechaObj.getMinutes().toString().padStart(2, '0');
    
    return `${dia}/${mes}/${anio} ${hora}:${minutos}`;
}

// Función para cargar planillas disponibles
async function cargarPlanillas() {
    try {
        const connection = await connectionString();
        
        const query = `
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
        `;
        
        const planillas = await connection.query(query);
        await connection.close();
        
        const planillaSelect = document.getElementById('planillaSelect');
        
        // Limpiar opciones actuales excepto la primera
        planillaSelect.innerHTML = '<option value="">Seleccione una planilla</option>';
        
        // Agregar opciones de planillas
        planillas.forEach(planilla => {
            const option = document.createElement('option');
            option.value = planilla.IdPlanilla;
            option.textContent = planilla.Nombre_Planilla_Completo;
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

// Función principal para buscar planillas
async function buscarPlanilla() {
    try {
        const planillaId = document.getElementById('planillaSelect').value;
        const tipoQuincena = document.getElementById('tipoQuincenaSelect').value;
        const mes = document.getElementById('mesSelect').value;
        const anio = document.getElementById('anioSelect').value;
        
        // Validar que todos los campos estén seleccionados
        if (!planillaId || !tipoQuincena || !mes || !anio) {
            await Swal.fire({
                icon: 'warning',
                title: 'Campos requeridos',
                text: 'Por favor seleccione todos los campos antes de buscar.'
            });
            return;
        }
        
        // Mostrar loader en el botón
        const buscarBtn = document.getElementById('buscarBtn');
        const originalText = buscarBtn.innerHTML;
        buscarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
        buscarBtn.disabled = true;
        
        // Ocultar secciones anteriores
        document.getElementById('planillaInfoInline').style.display = 'none';
        document.getElementById('detailsSection').style.display = 'none';
        
        // Obtener datos de la planilla
        const planillaData = await obtenerDatosPlanilla(planillaId, tipoQuincena, mes, anio);
        
        if (!planillaData || planillaData.length === 0) {
            await Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: 'No se encontró ninguna planilla con los criterios especificados.'
            });
        } else {
            // Guardar datos globales
            currentPlanillaData = planillaData[0];
            currentDetailsData = planillaData;
            
            // Mostrar información de la planilla
            mostrarInfoPlanilla(currentPlanillaData);
            
            // Mostrar detalles
            mostrarDetallesPlanilla(planillaData);
        }
        
    } catch (error) {
        console.error('Error al buscar planilla:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al buscar la planilla. Por favor intente nuevamente.'
        });
    } finally {
        // Restaurar botón
        const buscarBtn = document.getElementById('buscarBtn');
        buscarBtn.innerHTML = '<i class="fas fa-search"></i> <span class="btn-text">Buscar Planilla</span>';
        buscarBtn.disabled = false;
    }
}

// Función para obtener datos de la planilla desde la base de datos
async function obtenerDatosPlanilla(idPlanilla, idTipoPago, mes, anio) {
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT
                PagoPlanilla.IdPagoPlanilla, 
                PagoPlanilla.NombreUsuario, 
                PagoPlanilla.NombrePlanilla, 
                PagoPlanilla.CantColaboradores, 
                PagoPlanilla.MontoPagado, 
                PagoPlanilla.IdTipoPago, 
                PagoPlanilla.TipoPago, 
                PagoPlanilla.Mes, 
                PagoPlanilla.Anyo, 
                PagoPlanilla.FechaHoraRegistro, 
                PagoPlanilla.Estado,
                PagoPlanillaDetalle.IdPersonal,
                PagoPlanillaDetalle.NombrePersonal, 
                PagoPlanillaDetalle.SalarioQuincenal, 
                PagoPlanillaDetalle.SalarioDiario, 
                PagoPlanillaDetalle.Bonificacion, 
                PagoPlanillaDetalle.PagoIGSS, 
                PagoPlanillaDetalle.DiasLaborados, 
                PagoPlanillaDetalle.MontoPagado AS MontoPagadoDetalle,
                COALESCE((
                    SELECT SUM(djd.Descuento)
                    FROM DescuentosJudicialesDetalle djd
                    INNER JOIN DescuentosJudiciales dj ON djd.IdDescuentoJudicial = dj.IdDescuentoJudicial
                    WHERE dj.IdPersonal = PagoPlanillaDetalle.IdPersonal 
                    AND djd.IdPagoPlanilla = PagoPlanilla.IdPagoPlanilla
                ), 0) AS DescuentoJudicial,
                (
                    SELECT dj.NoDocumento
                    FROM DescuentosJudicialesDetalle djd
                    INNER JOIN DescuentosJudiciales dj ON djd.IdDescuentoJudicial = dj.IdDescuentoJudicial
                    WHERE dj.IdPersonal = PagoPlanillaDetalle.IdPersonal 
                    AND djd.IdPagoPlanilla = PagoPlanilla.IdPagoPlanilla
                    LIMIT 1
                ) AS NoDocumentoJudicial
            FROM
                PagoPlanilla
                INNER JOIN PagoPlanillaDetalle ON PagoPlanilla.IdPagoPlanilla = PagoPlanillaDetalle.IdPagoPlanilla
            WHERE
                PagoPlanilla.Estado = 0 AND
                PagoPlanilla.IdTipoPago = ? AND
                PagoPlanilla.Mes = ? AND
                PagoPlanilla.Anyo = ? AND
                PagoPlanilla.IdPlanilla = ?
            ORDER BY PagoPlanillaDetalle.NombrePersonal ASC
        `;
        
        const resultado = await connection.query(query, [idTipoPago, mes, anio, idPlanilla]);
        await connection.close();
        
        return resultado;
        
    } catch (error) {
        console.error('Error al obtener datos de planilla:', error);
        throw error;
    }
}

// Función para mostrar información general de la planilla
function mostrarInfoPlanilla(planilla) {
    // Actualizar campos de información
    document.getElementById('infoPlanillaId').textContent = planilla.IdPagoPlanilla || '-';
    document.getElementById('infoUsuario').textContent = planilla.NombreUsuario || '-';
    document.getElementById('infoCantColaboradores').textContent = planilla.CantColaboradores || '0';
    document.getElementById('infoMontoTotal').textContent = formatearMoneda(planilla.MontoPagado);
    document.getElementById('infoFechaRegistro').textContent = formatearFecha(planilla.FechaHoraRegistro);
    document.getElementById('infoTipoPago').textContent = planilla.TipoPago || '-';
    
    // Mostrar información inline con animación
    const infoInline = document.getElementById('planillaInfoInline');
    infoInline.style.display = 'block';
    infoInline.classList.add('element-fadeIn');
}

// Función para mostrar detalles de la planilla
function mostrarDetallesPlanilla(detalles) {
    // Resetear paginación
    currentPage = 1;
    totalRows = detalles.length;
    
    // Renderizar tabla
    renderizarTablaDetalles(detalles);
    
    // Mostrar sección con animación
    const detailsSection = document.getElementById('detailsSection');
    detailsSection.style.display = 'block';
    detailsSection.classList.add('element-slideUp');
}

// Función para renderizar la tabla de detalles
function renderizarTablaDetalles(detalles) {
    const tbody = document.getElementById('detailsTableBody');
    
    // Limpiar tabla
    tbody.innerHTML = '';
    
    if (detalles.length === 0) {
        document.getElementById('noDetailsData').style.display = 'block';
        document.getElementById('detailsTable').style.display = 'none';
        actualizarPaginacion(0);
        return;
    }
    
    document.getElementById('noDetailsData').style.display = 'none';
    document.getElementById('detailsTable').style.display = 'table';
    
    // Calcular indices para paginación
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, detalles.length);
    
    // Variables para totales
    let totalBonificacion = 0;
    let totalIGSS = 0;
    let totalDescuentos = 0;
    let totalPagado = 0;
    
    // Crear filas para la página actual
    for (let i = startIndex; i < endIndex; i++) {
        const detalle = detalles[i];
        const rowIndex = i - startIndex;
        const row = document.createElement('tr');
        
        // Determinar clase y tooltip para descuento judicial
        const descuentoJudicial = parseFloat(detalle.DescuentoJudicial || 0);
        let claseDescuento = 'currency';
        let tooltipDescuento = '';
        let contenidoDescuento = formatearMoneda(descuentoJudicial);
        
        if (descuentoJudicial > 0 && detalle.NoDocumentoJudicial) {
            claseDescuento += ' descuento-judicial';
            tooltipDescuento = `data-tooltip="Embargo No. ${detalle.NoDocumentoJudicial}"`;
            contenidoDescuento = `<span class="descuento-aplicado">${formatearMoneda(descuentoJudicial)} ⚖️</span>`;
        } else if (descuentoJudicial === 0) {
            contenidoDescuento = '<span class="sin-descuento">Q0.00</span>';
        }
        
        row.innerHTML = `
            <td>${i + 1}</td>
            <td class="nombre-empleado">${detalle.NombrePersonal}</td>
            <td class="currency">${formatearMoneda(detalle.SalarioQuincenal)}</td>
            <td class="currency">${formatearMoneda(detalle.SalarioDiario)}</td>
            <td class="currency dias-laborados-editable celda-editable" data-empleado-index="${rowIndex}" style="cursor: pointer;" title="Doble click para editar">${detalle.DiasLaborados}</td>
            <td class="currency">${formatearMoneda(detalle.Bonificacion || 0)}</td>
            <td class="currency">${formatearMoneda(detalle.PagoIGSS || 0)}</td>
            <td class="${claseDescuento}" ${tooltipDescuento}>${contenidoDescuento}</td>
            <td class="currency monto-final">${formatearMoneda(detalle.MontoPagadoDetalle)}</td>
        `;
        
        tbody.appendChild(row);
        
        // Acumular totales
        totalBonificacion += parseFloat(detalle.Bonificacion || 0);
        totalIGSS += parseFloat(detalle.PagoIGSS || 0);
        totalDescuentos += descuentoJudicial;
        totalPagado += parseFloat(detalle.MontoPagadoDetalle || 0);
    }
    
    // Actualizar totales en el footer si existe
    const totalBonificacionElement = document.querySelector('.total-bonificacion');
    const totalIGSSElement = document.querySelector('.total-igss');
    const totalDescuentosElement = document.querySelector('.total-descuentos');
    const totalPagadoElement = document.querySelector('.total-pagado');
    
    if (totalBonificacionElement) totalBonificacionElement.textContent = formatearMoneda(totalBonificacion);
    if (totalIGSSElement) totalIGSSElement.textContent = formatearMoneda(totalIGSS);
    if (totalDescuentosElement) totalDescuentosElement.textContent = formatearMoneda(totalDescuentos);
    if (totalPagadoElement) totalPagadoElement.textContent = formatearMoneda(totalPagado);
    
    // Agregar event listeners de edición
    agregarEventListenersEdicion();
    
    setTimeout(() => {
        ajustarScrollTabla();
        
        const tbody = document.querySelector('.details-table tbody');
        if (tbody) {
            tbody.style.display = 'none';
            tbody.offsetHeight;
            tbody.style.display = 'block';
        }
    }, 100);
    
    actualizarPaginacion(detalles.length);
    
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
        tableContainer.style.height = 'calc(100vh - 380px)';
    }
}
function agregarEventListenersEdicion() {
    // Remover event listeners anteriores para evitar duplicados
    document.removeEventListener('dblclick', manejarDobleClickEdicion);
    
    // Agregar event listener global para doble click en días laborados
    document.addEventListener('dblclick', manejarDobleClickEdicion);
}
function manejarDobleClickEdicion(e) {
    if (e.target.classList.contains('dias-laborados-editable')) {
        e.preventDefault();
        e.stopPropagation();
        
        const rowIndex = parseInt(e.target.getAttribute('data-empleado-index'));
        const startIndex = (currentPage - 1) * rowsPerPage;
        const globalIndex = startIndex + rowIndex;
        
        if (currentDetailsData[globalIndex]) {
            hacerEditableDiasLaborados(e.target, currentDetailsData[globalIndex], rowIndex);
        }
    }
}
// Función para actualizar la paginación
function actualizarPaginacion(totalItems) {
    totalRows = totalItems;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    
    // Actualizar información de registros mostrados
    const startIndex = totalItems > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
    const endIndex = Math.min(startIndex + rowsPerPage - 1, totalItems);
    
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `Mostrando ${startIndex}-${endIndex} de ${totalItems} registros`;
    }
    
    // Generar botones de paginación
    const paginationButtons = document.getElementById('paginationButtons');
    if (paginationButtons) {
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
                renderizarTablaDetalles(currentDetailsData);
            });
            
            paginationButtons.appendChild(button);
        }
    }
    
    // Habilitar/deshabilitar botones de anterior/siguiente
    const prevButton = document.querySelector('.pagination-btn[data-page="prev"]');
    const nextButton = document.querySelector('.pagination-btn[data-page="next"]');
    
    if (prevButton && nextButton) {
        prevButton.disabled = currentPage === 1 || totalPages === 0;
        nextButton.disabled = currentPage === totalPages || totalPages === 0;
        
        // Agregar eventos a botones anterior/siguiente
        prevButton.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderizarTablaDetalles(currentDetailsData);
            }
        };
        
        nextButton.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderizarTablaDetalles(currentDetailsData);
            }
        };
    }
}
function ajustarAlturaTabla() {
    const tableContainer = document.querySelector('.table-container');
    const detailsSection = document.querySelector('.details-section');
    const sectionHeader = document.querySelector('.section-header');
    const pagination = document.querySelector('.pagination');
    
    if (tableContainer && detailsSection && sectionHeader && pagination) {
        const headerHeight = sectionHeader.offsetHeight;
        const paginationHeight = pagination.offsetHeight;
        const padding = 30; // padding de la sección
        const availableHeight = detailsSection.offsetHeight - headerHeight - paginationHeight - padding;
        
        tableContainer.style.height = `${Math.max(200, availableHeight)}px`;
    }
}
// Función para editar planilla
async function editarPlanilla() {
    if (!currentPlanillaData) {
        await Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay planilla seleccionada para editar.'
        });
        return;
    }
    
    // Verificar el estado de la planilla
    if (currentPlanillaData.Estado !== 0) {
        await Swal.fire({
            icon: 'info',
            title: 'Planilla no autorizada',
            text: 'Solo se pueden modificar planillas que han sido autorizadas (Estado = 1).'
        });
        return;
    }
    
    // Confirmar edición
    const result = await Swal.fire({
        title: 'Editar Planilla',
        html: `
            <p>¿Está seguro que desea editar la planilla?</p>
            <p><strong>Planilla:</strong> ${currentPlanillaData.NombrePlanilla}</p>
            <p><strong>Período:</strong> ${currentPlanillaData.Mes}/${currentPlanillaData.Anyo}</p>
            <p><strong>Tipo:</strong> ${currentPlanillaData.TipoPago}</p>
            <br>
            <p class="text-warning">⚠️ Esta acción permitirá modificar los datos de la planilla.</p>
        `,
        showCancelButton: true,
        confirmButtonText: 'Sí, editar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#448AFF'
    });
    
    if (result.isConfirmed) {
        // Aquí podrías implementar la lógica de edición
        // Por ejemplo, hacer las celdas de la tabla editables
        await Swal.fire({
            icon: 'info',
            title: 'Funcionalidad en desarrollo',
            text: 'La funcionalidad de edición está en desarrollo. Por ahora puede consultar los datos.'
        });
    }
}

// Sistema de ayuda
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
    
    // Navegación entre secciones de ayuda
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

// Función para agregar eventos solo si el elemento existe
function addEventIfElementExists(id, eventType, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(eventType, handler);
    }
}

// Inicialización del sistema
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
        
        // Llenar años en el filtro
        const anioSelect = document.getElementById('anioSelect');
        const currentYear = new Date().getFullYear();
        
        if (anioSelect) {
            for (let year = 2020; year <= currentYear + 1; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                if (year === currentYear) {
                    option.selected = true;
                }
                anioSelect.appendChild(option);
            }
        }
        
        // Establecer mes actual seleccionado por defecto
        const currentMonth = new Date().getMonth() + 1;
        const mesSelect = document.getElementById('mesSelect');
        if (mesSelect) {
            mesSelect.value = currentMonth;
        }
        
        // Cargar planillas desde la base de datos
        await cargarPlanillas();
        
        // Agregar eventos principales
        addEventIfElementExists('buscarBtn', 'click', buscarPlanilla);
        addEventIfElementExists('editBtn', 'click', editarPlanilla);
        
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
        
        // Inicializar sistema de ayuda
        inicializarSistemaAyuda();
        
        // Agregar eventos de teclado para mejor UX
        document.addEventListener('keydown', function(e) {
            // ESC para cerrar modales
            if (e.key === 'Escape') {
                const helpModal = document.getElementById('helpModal');
                if (helpModal && helpModal.style.display === 'block') {
                    helpModal.style.display = 'none';
                }
            }
            
            // Enter en los selects para buscar
            if (e.key === 'Enter' && e.target.classList.contains('filter-select')) {
                const buscarBtn = document.getElementById('buscarBtn');
                if (buscarBtn && !buscarBtn.disabled) {
                    buscarPlanilla();
                }
            }
        });
        
        // Agregar efectos visuales a las cards de información
        const infoCards = document.querySelectorAll('.info-card');
        infoCards.forEach((card, index) => {
            card.classList.add(`animate-in-${index + 1}`);
        });
        
        // Observer para animaciones al hacer scroll
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);
        
        // Observar elementos que necesitan animación
        const elementsToAnimate = document.querySelectorAll('.fade-in-element');
        elementsToAnimate.forEach(el => observer.observe(el));
        
        console.log('Sistema de Modificar Nóminas inicializado correctamente');
        
    } catch (error) {
        console.error('Error al inicializar la página:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error de Inicialización',
            text: 'Ocurrió un error al cargar la página. Por favor recargue e intente nuevamente.'
        });
    }
});

// Funciones de utilidad adicionales

// Función para validar conexión a base de datos
async function validarConexion() {
    try {
        const connection = await connectionString();
        await connection.close();
        return true;
    } catch (error) {
        console.error('Error de conexión:', error);
        return false;
    }
}

// Función para limpiar formulario
function limpiarFormulario() {
    document.getElementById('planillaSelect').value = '';
    document.getElementById('tipoQuincenaSelect').value = '1';
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    document.getElementById('mesSelect').value = currentMonth;
    document.getElementById('anioSelect').value = currentYear;
    
    // Ocultar secciones
    document.getElementById('planillaInfoInline').style.display = 'none';
    document.getElementById('detailsSection').style.display = 'none';
    
    // Limpiar datos globales
    currentPlanillaData = null;
    currentDetailsData = [];
    currentPage = 1;
}

// Función para mostrar loading en botones
function toggleButtonLoading(buttonId, loading = true) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    if (loading) {
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
        button.disabled = true;
    } else {
        button.innerHTML = button.dataset.originalText || button.innerHTML;
        button.disabled = false;
    }
}

// Función para formatear números sin símbolo de moneda
function formatearNumero(valor) {
    if (valor === null || valor === undefined) return '0.00';
    return parseFloat(valor).toLocaleString('es-GT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Función para capitalizar texto
function capitalizarTexto(texto) {
    if (!texto) return '';
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

// Función para truncar texto
function truncarTexto(texto, longitud = 50) {
    if (!texto) return '';
    if (texto.length <= longitud) return texto;
    return texto.substring(0, longitud) + '...';
}

// Función para validar formato de fecha
function esValidaFecha(fecha) {
    const fechaObj = new Date(fecha);
    return fechaObj instanceof Date && !isNaN(fechaObj);
}

// Función para mostrar notificaciones toast
function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensaje;
    
    // Estilos inline para el toast
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        backgroundColor: tipo === 'success' ? '#4CAF50' : tipo === 'error' ? '#FF5252' : '#448AFF',
        color: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '10000',
        fontSize: '14px',
        fontWeight: '500',
        opacity: '0',
        transform: 'translateX(100%)',
        transition: 'all 0.3s ease'
    });
    
    document.body.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Ocultar toast después de 3 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Función para debounce (evitar múltiples llamadas rápidas)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Función para generar ID único
function generarIdUnico() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Función para detectar cambios en los datos
function detectarCambios(original, actual) {
    const cambios = [];
    
    for (const key in original) {
        if (original[key] !== actual[key]) {
            cambios.push({
                campo: key,
                valorOriginal: original[key],
                valorNuevo: actual[key]
            });
        }
    }
    
    return cambios;
}
function ajustarScrollTabla() {
    const tbody = document.querySelector('.details-table tbody');
    const tableContainer = document.querySelector('.table-container');
    const thead = document.querySelector('.details-table thead');
    
    if (tbody && tableContainer && thead) {
        const containerHeight = tableContainer.offsetHeight;
        const headerHeight = thead.offsetHeight || 40;
        const availableHeight = containerHeight - headerHeight - 10; // 10px de margen
        
        tbody.style.height = `${Math.max(100, availableHeight)}px`;
        tbody.style.maxHeight = `${availableHeight}px`;
    }
}
//Editar
async function obtenerDatosQuincenaAnterior(idPersonal, mes, anio) {
    try {
        const connection = await connectionString();
        
        // Consulta para obtener datos de la quincena anterior (IdTipoPago = 1)
        const query = `
            SELECT 
                ppd.DiasLaborados,
                ppd.SubTotalPagar,
                ppd.MontoPagado,
                ppd.SalarioQuincenal,
                ppd.SalarioDiario,
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
            const datos = resultado[0];
            return {
                diasLaborados: parseInt(datos.DiasLaborados) || 0,
                subTotalPagar: parseFloat(datos.SubTotalPagar) || 0,
                montoPagado: parseFloat(datos.MontoPagado) || 0,
                descuentoJudicial: parseFloat(datos.DescuentoJudicial) || 0,
                salarioQuincenal: parseFloat(datos.SalarioQuincenal) || 0,
                salarioDiario: parseFloat(datos.SalarioDiario) || 0
            };
        }
        
        return {
            diasLaborados: 0,
            subTotalPagar: 0,
            montoPagado: 0,
            descuentoJudicial: 0,
            salarioQuincenal: 0,
            salarioDiario: 0
        };
        
    } catch (error) {
        console.error('Error al obtener datos de quincena anterior:', error);
        return {
            diasLaborados: 0,
            subTotalPagar: 0,
            montoPagado: 0,
            descuentoJudicial: 0,
            salarioQuincenal: 0,
            salarioDiario: 0
        };
    }
}

// Función para recalcular valores basada en la lógica de PagoNomina
async function recalcularValores(empleado, nuevosDiasLaborados) {
    try {
        const tipoQuincena = currentPlanillaData.IdTipoPago;
        const mes = currentPlanillaData.Mes;
        const anio = currentPlanillaData.Anyo;
        
        let nuevaBonificacion = 0;
        let nuevoIGSS = 0;
        let nuevoMontoPagado = 0;
        
        if (tipoQuincena === 1) {
            // LÓGICA PARA QUINCENA NORMAL (1-15)
            const salarioProporcional = (empleado.SalarioDiario * nuevosDiasLaborados);
            nuevoMontoPagado = Math.max(0, salarioProporcional - (empleado.DescuentoJudicial || 0));
            
        } else if (tipoQuincena === 2) {
            // LÓGICA PARA FIN DE MES (16-último día) - CORREGIDA
            
            // 1. Obtener datos de la quincena anterior
            const datosQ1 = await obtenerDatosQuincenaAnterior(empleado.IdPersonal, mes, anio);
            
            // 2. Calcular salario de fin de mes
            const salarioFinMes = empleado.SalarioDiario * nuevosDiasLaborados;
            
            // 3. Sumar SubTotalPagar de quincena anterior + salario fin de mes
            const sumaSubTotales = datosQ1.subTotalPagar + salarioFinMes;
            
            // 4. Calcular IGSS = Suma de SubTotales * 4.83%
            nuevoIGSS = sumaSubTotales * 0.0483;
            
            // 5. CORRECCIÓN AQUÍ: Obtener la bonificación mensual ORIGINAL del empleado
            // NO usar la bonificación ya calculada de la planilla, sino la original del empleado
            const bonificacionMensualOriginal = await obtenerBonificacionOriginalEmpleado(empleado.IdPersonal);
            
            // 6. Calcular Bonificación proporcional basada en TOTAL de días del mes
            const totalDiasAmbasQuincenas = datosQ1.diasLaborados + nuevosDiasLaborados;
            nuevaBonificacion = (bonificacionMensualOriginal / 30) * totalDiasAmbasQuincenas;
            
            // 7. Calcular monto final: Salario + Bonificación - IGSS - Descuento Judicial
            const subTotalPagar = salarioFinMes + nuevaBonificacion - nuevoIGSS;
            nuevoMontoPagado = Math.max(0, subTotalPagar - (empleado.DescuentoJudicial || 0));
        }
        
        return {
            bonificacion: nuevaBonificacion,
            igss: nuevoIGSS,
            montoPagado: nuevoMontoPagado
        };
        
    } catch (error) {
        console.error('Error al recalcular valores:', error);
        return {
            bonificacion: empleado.Bonificacion || 0,
            igss: empleado.PagoIGSS || 0,
            montoPagado: empleado.MontoPagadoDetalle || 0
        };
    }
}
async function obtenerBonificacionOriginalEmpleado(idPersonal) {
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT Bonificacion
            FROM personal
            WHERE IdPersonal = ?
        `;
        
        const resultado = await connection.query(query, [idPersonal]);
        await connection.close();
        
        if (resultado.length > 0) {
            return parseFloat(resultado[0].Bonificacion) || 0;
        }
        
        return 0;
        
    } catch (error) {
        console.error('Error al obtener bonificación original:', error);
        return 0;
    }
}
// Función COMPLETA para hacer editable la celda de días laborados
function hacerEditableDiasLaborados(celda, empleado, rowIndex) {
    // Verificar si ya está en edición para evitar múltiples inputs
    if (celda.classList.contains('editando')) {
        return;
    }

    // Crear input de edición
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '15';
    input.value = empleado.DiasLaborados;
    input.className = 'input-edicion-dias';
    
    // Estilos para el input
    Object.assign(input.style, {
        width: '100%',
        height: '100%',
        border: '2px solid var(--primary)',
        borderRadius: '4px',
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: '600',
        backgroundColor: '#fffbf0',
        color: 'var(--text-dark)',
        outline: 'none',
        padding: '4px'
    });
    
    // Guardar valor original y contenido original
    const valorOriginal = empleado.DiasLaborados;
    const contenidoOriginal = celda.innerHTML;
    
    // Variables de control para evitar múltiples ejecuciones
    let procesamientoEnCurso = false;
    let inputEliminado = false;
    
    // Reemplazar contenido de la celda
    celda.innerHTML = '';
    celda.appendChild(input);
    celda.classList.add('editando');
    
    // Seleccionar todo el texto
    input.select();
    input.focus();
    
    // Función para limpiar y restaurar estado
    const limpiarEstado = () => {
        if (inputEliminado) return;
        
        inputEliminado = true;
        procesamientoEnCurso = false;
        
        // Remover event listeners para evitar conflictos
        input.removeEventListener('keydown', manejarTeclado);
        input.removeEventListener('blur', manejarBlur);
        
        // Restaurar clases
        celda.classList.remove('editando');
    };
    
    // Función para restaurar celda sin cambios
    const restaurarCelda = () => {
        if (procesamientoEnCurso || inputEliminado) return;
        
        try {
            limpiarEstado();
            celda.innerHTML = contenidoOriginal;
        } catch (error) {
            console.warn('Error al restaurar celda:', error);
            celda.innerHTML = valorOriginal;
            celda.classList.remove('editando');
        }
    };
    
    // Función para guardar cambios con actualización en base de datos
    const guardarCambios = async () => {
        if (procesamientoEnCurso || inputEliminado) return;
        
        procesamientoEnCurso = true;
        
        const nuevoValor = parseInt(input.value) || 0;
        
        // Validar rango
        if (nuevoValor < 0 || nuevoValor > 15) {
            procesamientoEnCurso = false;
            await Swal.fire({
                icon: 'warning',
                title: 'Valor inválido',
                text: 'Los días laborados deben estar entre 0 y 15.',
                confirmButtonText: 'Entendido'
            });
            
            if (!inputEliminado) {
                input.focus();
                input.select();
            }
            return;
        }
        
        // Si no hay cambios, restaurar vista normal
        if (nuevoValor === valorOriginal) {
            restaurarCelda();
            return;
        }
        
        try {
            // Mostrar confirmación de cambio con detalles
            const tipoQuincena = currentPlanillaData.IdTipoPago === 1 ? 'Quincenal' : 'Fin de Mes';
            const camposAfectados = currentPlanillaData.IdTipoPago === 1 
                ? ['Días Laborados', 'Monto Pagado']
                : ['Días Laborados', 'Bonificación', 'IGSS', 'Monto Pagado'];
            
            const confirmacion = await Swal.fire({
                title: 'Confirmar modificación',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Colaborador:</strong> ${empleado.NombrePersonal}</p>
                        <p><strong>Tipo de planilla:</strong> ${tipoQuincena}</p>
                        <p><strong>Cambio:</strong> ${valorOriginal} → ${nuevoValor} días laborados</p>
                        <br>
                        <p><strong>Campos que se actualizarán:</strong></p>
                        <ul>
                            ${camposAfectados.map(campo => `<li>${campo}</li>`).join('')}
                        </ul>
                        <br>
                        <p style="color: #e74c3c; font-weight: 600;">
                            ⚠️ Esta acción se guardará en la base de datos y se registrará en el historial de cambios.
                        </p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Sí, actualizar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#FF9800',
                cancelButtonColor: '#6c757d',
                width: 600
            });
            
            if (!confirmacion.isConfirmed) {
                restaurarCelda();
                return;
            }
            
            // Mostrar loading
            limpiarEstado();
            celda.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            
            // Guardar valores originales para historial
            const valoresOriginales = {
                diasLaborados: empleado.DiasLaborados,
                bonificacion: empleado.Bonificacion || 0,
                igss: empleado.PagoIGSS || 0,
                montoPagado: empleado.MontoPagadoDetalle || 0
            };
            
            // Recalcular valores
            const valoresRecalculados = await recalcularValores(empleado, nuevoValor);
            
            const valoresNuevos = {
                diasLaborados: nuevoValor,
                bonificacion: valoresRecalculados.bonificacion,
                igss: valoresRecalculados.igss,
                montoPagado: valoresRecalculados.montoPagado
            };
            
            // Actualizar base de datos
            const resultadoBD = await actualizarBaseDatos(empleado, valoresOriginales, valoresNuevos);
            
            if (resultadoBD.success) {
                // Actualizar datos del empleado en memoria
                empleado.DiasLaborados = nuevoValor;
                empleado.Bonificacion = valoresRecalculados.bonificacion;
                empleado.PagoIGSS = valoresRecalculados.igss;
                empleado.MontoPagadoDetalle = valoresRecalculados.montoPagado;
                
                // Actualizar en el array global
                const globalIndex = (currentPage - 1) * rowsPerPage + rowIndex;
                if (currentDetailsData[globalIndex]) {
                    currentDetailsData[globalIndex] = { ...empleado };
                }
                
                // Re-renderizar la fila completa
                await actualizarFilaTabla(rowIndex, empleado);
                
                // Mostrar mensaje de éxito detallado
                await Swal.fire({
                    icon: 'success',
                    title: 'Cambios guardados exitosamente',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>Colaborador:</strong> ${empleado.NombrePersonal}</p>
                            <br>
                            <p style="color: #27ae60;">✅ Los cambios han sido Actualizados</p>
                        </div>
                    `,
                    confirmButtonText: 'Entendido',
                    timer: 5000,
                    timerProgressBar: true
                });
                
            } else {
                throw new Error('No se pudo actualizar la base de datos');
            }
            
        } catch (error) {
            console.error('Error al guardar cambios:', error);
            
            await Swal.fire({
                icon: 'error',
                title: 'Error al guardar',
                html: `
                    <p>No se pudieron guardar los cambios en la base de datos.</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p>Por favor, intente nuevamente o contacte al administrador.</p>
                `,
                confirmButtonText: 'Entendido'
            });
            
            // En caso de error, restaurar contenido original
            try {
                celda.innerHTML = contenidoOriginal;
                celda.classList.remove('editando');
            } catch (restoreError) {
                console.error('Error al restaurar tras fallo:', restoreError);
                celda.innerHTML = valorOriginal;
                celda.classList.remove('editando');
            }
        }
    };
    
    // Manejador de eventos de teclado
    const manejarTeclado = async (e) => {
        if (procesamientoEnCurso || inputEliminado) return;
        
        e.stopPropagation();
        
        if (e.key === 'Enter') {
            e.preventDefault();
            await guardarCambios();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            restaurarCelda();
        }
    };
    
    // Manejador de blur
    const manejarBlur = async (e) => {
        if (procesamientoEnCurso || inputEliminado) return;
        
        // Pequeño delay para permitir que otros eventos se procesen primero
        setTimeout(async () => {
            if (!procesamientoEnCurso && !inputEliminado) {
                await guardarCambios();
            }
        }, 100);
    };
    
    // Agregar event listeners
    input.addEventListener('keydown', manejarTeclado);
    input.addEventListener('blur', manejarBlur);
    
    // Prevenir que el doble click se propague
    input.addEventListener('dblclick', (e) => {
        e.stopPropagation();
    });
}
async function actualizarFilaTabla(rowIndex, empleado) {
    return new Promise((resolve) => {
        try {
            const tbody = document.getElementById('detailsTableBody');
            const filas = tbody.querySelectorAll('tr');
            
            if (filas[rowIndex]) {
                const fila = filas[rowIndex];
                
                // Determinar clase y tooltip para descuento judicial
                const descuentoJudicial = parseFloat(empleado.DescuentoJudicial || 0);
                let claseDescuento = 'currency';
                let tooltipDescuento = '';
                let contenidoDescuento = formatearMoneda(descuentoJudicial);
                
                if (descuentoJudicial > 0 && empleado.NoDocumentoJudicial) {
                    claseDescuento += ' descuento-judicial';
                    tooltipDescuento = `data-tooltip="Embargo No. ${empleado.NoDocumentoJudicial}"`;
                    contenidoDescuento = `<span class="descuento-aplicado">${formatearMoneda(descuentoJudicial)} ⚖️</span>`;
                } else if (descuentoJudicial === 0) {
                    contenidoDescuento = '<span class="sin-descuento">Q0.00</span>';
                }
                
                // Actualizar contenido de la fila
                fila.innerHTML = `
                    <td>${(currentPage - 1) * rowsPerPage + rowIndex + 1}</td>
                    <td class="nombre-empleado">${empleado.NombrePersonal}</td>
                    <td class="currency">${formatearMoneda(empleado.SalarioQuincenal)}</td>
                    <td class="currency">${formatearMoneda(empleado.SalarioDiario)}</td>
                    <td class="currency dias-laborados-editable" data-empleado-index="${rowIndex}">${empleado.DiasLaborados}</td>
                    <td class="currency">${formatearMoneda(empleado.Bonificacion || 0)}</td>
                    <td class="currency">${formatearMoneda(empleado.PagoIGSS || 0)}</td>
                    <td class="${claseDescuento}" ${tooltipDescuento}>${contenidoDescuento}</td>
                    <td class="currency monto-final">${formatearMoneda(empleado.MontoPagadoDetalle)}</td>
                `;
                
                // Re-agregar event listener para doble click en días laborados
                const celdaDias = fila.querySelector('.dias-laborados-editable');
                if (celdaDias) {
                    celdaDias.addEventListener('dblclick', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        hacerEditableDiasLaborados(this, empleado, rowIndex);
                    });
                    
                    // Agregar indicador visual de que es editable
                    celdaDias.style.cursor = 'pointer';
                    celdaDias.title = 'Doble click para editar';
                    celdaDias.classList.add('celda-editable');
                }
                
                // Resolver la promesa después de un pequeño delay para asegurar que el DOM se actualice
                setTimeout(resolve, 50);
            } else {
                resolve();
            }
        } catch (error) {
            console.error('Error al actualizar fila:', error);
            resolve();
        }
    });
}
async function actualizarBaseDatos(empleado, valoresOriginales, valoresNuevos) {
    try {
        const connection = await connectionString();
        
        // Obtener datos del usuario actual
        const userData = JSON.parse(localStorage.getItem('userData')) || {};
        const idUsuario = userData.IdPersonal || 0;
        const nombreUsuario = userData.NombreCompleto || 'Usuario desconocido';
        
        // Buscar el registro en PagoPlanillaDetalle
        const queryBuscar = `
            SELECT ppd.* 
            FROM PagoPlanillaDetalle ppd
            INNER JOIN PagoPlanilla pp ON ppd.IdPagoPlanilla = pp.IdPagoPlanilla
            WHERE ppd.IdPersonal = ? 
            AND pp.IdPagoPlanilla = ?
        `;
        
        const registroActual = await connection.query(queryBuscar, [
            empleado.IdPersonal, 
            currentPlanillaData.IdPagoPlanilla
        ]);
        
        if (registroActual.length === 0) {
            throw new Error('No se encontró el registro del empleado en la planilla');
        }
        
        const registro = registroActual[0];
        
        // Determinar qué campos actualizar según el tipo de quincena
        let camposActualizar = [];
        let valoresActualizar = [];
        let cambiosHistorial = [];
        
        if (currentPlanillaData.IdTipoPago === 1) {
            // QUINCENA NORMAL - Solo actualizar MontoPagado
            if (registro.MontoPagado !== valoresNuevos.montoPagado) {
                camposActualizar.push('MontoPagado = ?');
                valoresActualizar.push(valoresNuevos.montoPagado);
                
                cambiosHistorial.push({
                    campo: 'MontoPagado',
                    valorAnterior: valoresOriginales.montoPagado,
                    valorNuevo: valoresNuevos.montoPagado
                });
            }
        } else if (currentPlanillaData.IdTipoPago === 2) {
            // FIN DE MES - Actualizar Bonificación, IGSS y MontoPagado
            if (registro.Bonificacion !== valoresNuevos.bonificacion) {
                camposActualizar.push('Bonificacion = ?');
                valoresActualizar.push(valoresNuevos.bonificacion);
                
                cambiosHistorial.push({
                    campo: 'Bonificacion',
                    valorAnterior: valoresOriginales.bonificacion,
                    valorNuevo: valoresNuevos.bonificacion
                });
            }
            
            if (registro.PagoIGSS !== valoresNuevos.igss) {
                camposActualizar.push('PagoIGSS = ?');
                valoresActualizar.push(valoresNuevos.igss);
                
                cambiosHistorial.push({
                    campo: 'PagoIGSS',
                    valorAnterior: valoresOriginales.igss,
                    valorNuevo: valoresNuevos.igss
                });
            }
            
            if (registro.MontoPagado !== valoresNuevos.montoPagado) {
                camposActualizar.push('MontoPagado = ?');
                valoresActualizar.push(valoresNuevos.montoPagado);
                
                cambiosHistorial.push({
                    campo: 'MontoPagado',
                    valorAnterior: valoresOriginales.montoPagado,
                    valorNuevo: valoresNuevos.montoPagado
                });
            }
        }
        
        // Siempre actualizar DiasLaborados
        if (registro.DiasLaborados !== valoresNuevos.diasLaborados) {
            camposActualizar.push('DiasLaborados = ?');
            valoresActualizar.push(valoresNuevos.diasLaborados);
            
            cambiosHistorial.push({
                campo: 'DiasLaborados',
                valorAnterior: valoresOriginales.diasLaborados,
                valorNuevo: valoresNuevos.diasLaborados
            });
        }
        
        // Si hay cambios, actualizar la base de datos
        if (camposActualizar.length > 0) {
            const queryUpdate = `
                UPDATE PagoPlanillaDetalle 
                SET ${camposActualizar.join(', ')}
                WHERE IdPersonal = ? 
                AND IdPagoPlanilla = ?
            `;
            
            valoresActualizar.push(empleado.IdPersonal, currentPlanillaData.IdPagoPlanilla);
            
            await connection.query(queryUpdate, valoresActualizar);
            
            // Registrar cambios en el historial
            for (const cambio of cambiosHistorial) {
                await registrarCambioHistorial(
                    connection,
                    currentPlanillaData.IdPagoPlanilla,
                    empleado.IdPersonal,
                    empleado.NombrePersonal,
                    cambio.campo,
                    cambio.valorAnterior,
                    cambio.valorNuevo,
                    idUsuario,
                    nombreUsuario
                );
            }
        }
        
        await connection.close();
        
        return {
            success: true,
            cambiosRealizados: cambiosHistorial.length,
            campos: cambiosHistorial.map(c => c.campo)
        };
        
    } catch (error) {
        console.error('Error al actualizar base de datos:', error);
        throw error;
    }
}

// Función para registrar cambios en el historial
async function registrarCambioHistorial(connection, idPagoPlanilla, idPersonal, nombrePersonal, campo, valorAnterior, valorNuevo, idUsuario, nombreUsuario) {
    try {
        const queryHistorial = `
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
        
        await connection.query(queryHistorial, [
            idPagoPlanilla,
            idPersonal,
            nombrePersonal,
            campo,
            valorAnterior,
            valorNuevo,
            idUsuario,
            nombreUsuario
        ]);
        
    } catch (error) {
        console.error('Error al registrar historial:', error);
        throw error;
    }
}

// Función actualizada para guardar cambios con confirmación y actualización en BD
const guardarCambios = async () => {
    if (procesamientoEnCurso || inputEliminado) return;
    
    procesamientoEnCurso = true;
    
    const nuevoValor = parseInt(input.value) || 0;
    
    // Validar rango
    if (nuevoValor < 0 || nuevoValor > 15) {
        procesamientoEnCurso = false;
        await Swal.fire({
            icon: 'warning',
            title: 'Valor inválido',
            text: 'Los días laborados deben estar entre 0 y 15.',
            confirmButtonText: 'Entendido'
        });
        
        if (!inputEliminado) {
            input.focus();
            input.select();
        }
        return;
    }
    
    // Si no hay cambios, restaurar vista normal
    if (nuevoValor === valorOriginal) {
        restaurarCelda();
        return;
    }
    
    try {
        // Mostrar confirmación de cambio con detalles
        const tipoQuincena = currentPlanillaData.IdTipoPago === 1 ? 'Quincenal' : 'Fin de Mes';
        const camposAfectados = currentPlanillaData.IdTipoPago === 1 
            ? ['Días Laborados', 'Monto Pagado']
            : ['Días Laborados', 'Bonificación', 'IGSS', 'Monto Pagado'];
        
        const confirmacion = await Swal.fire({
            title: 'Confirmar modificación',
            html: `
                <div style="text-align: left;">
                    <p><strong>Colaborador:</strong> ${empleado.NombrePersonal}</p>
                    <p><strong>Tipo de planilla:</strong> ${tipoQuincena}</p>
                    <p><strong>Cambio:</strong> ${valorOriginal} → ${nuevoValor} días laborados</p>
                    <br>
                    <p><strong>Campos que se actualizarán:</strong></p>
                    <ul>
                        ${camposAfectados.map(campo => `<li>${campo}</li>`).join('')}
                    </ul>
                    <br>
                    <p style="color: #e74c3c; font-weight: 600;">
                        ⚠️ Esta acción se guardará en la base de datos y se registrará en el historial de cambios.
                    </p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Sí, actualizar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#FF9800',
            cancelButtonColor: '#6c757d',
            width: 600
        });
        
        if (!confirmacion.isConfirmed) {
            restaurarCelda();
            return;
        }
        
        // Mostrar loading
        limpiarEstado();
        celda.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        // Guardar valores originales para historial
        const valoresOriginales = {
            diasLaborados: empleado.DiasLaborados,
            bonificacion: empleado.Bonificacion || 0,
            igss: empleado.PagoIGSS || 0,
            montoPagado: empleado.MontoPagadoDetalle || 0
        };
        
        // Recalcular valores
        const valoresRecalculados = await recalcularValores(empleado, nuevoValor);
        
        const valoresNuevos = {
            diasLaborados: nuevoValor,
            bonificacion: valoresRecalculados.bonificacion,
            igss: valoresRecalculados.igss,
            montoPagado: valoresRecalculados.montoPagado
        };
        
        // Actualizar base de datos
        const resultadoBD = await actualizarBaseDatos(empleado, valoresOriginales, valoresNuevos);
        
        if (resultadoBD.success) {
            // Actualizar datos del empleado en memoria
            empleado.DiasLaborados = nuevoValor;
            empleado.Bonificacion = valoresRecalculados.bonificacion;
            empleado.PagoIGSS = valoresRecalculados.igss;
            empleado.MontoPagadoDetalle = valoresRecalculados.montoPagado;
            
            // Actualizar en el array global
            const globalIndex = (currentPage - 1) * rowsPerPage + rowIndex;
            if (currentDetailsData[globalIndex]) {
                currentDetailsData[globalIndex] = { ...empleado };
            }
            
            // Re-renderizar la fila completa
            await actualizarFilaTabla(rowIndex, empleado);
            
            // Mostrar mensaje de éxito detallado
            await Swal.fire({
                icon: 'success',
                title: 'Cambios guardados exitosamente',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Colaborador:</strong> ${empleado.NombrePersonal}</p>
                        <p><strong>Campos actualizados:</strong> ${resultadoBD.campos.join(', ')}</p>
                        <p><strong>Registros en historial:</strong> ${resultadoBD.cambiosRealizados}</p>
                        <br>
                        <p style="color: #27ae60;">✅ Los cambios han sido Actualizados</p>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                timer: 5000,
                timerProgressBar: true
            });
            
        } else {
            throw new Error('No se pudo actualizar la base de datos');
        }
        
    } catch (error) {
        console.error('Error al guardar cambios:', error);
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            html: `
                <p>No se pudieron guardar los cambios en la base de datos.</p>
                <p><strong>Error:</strong> ${error.message}</p>
                <p>Por favor, intente nuevamente o contacte al administrador.</p>
            `,
            confirmButtonText: 'Entendido'
        });
        
        // En caso de error, restaurar contenido original
        try {
            celda.innerHTML = contenidoOriginal;
            celda.classList.remove('editando');
        } catch (restoreError) {
            console.error('Error al restaurar tras fallo:', restoreError);
            celda.innerHTML = valorOriginal;
            celda.classList.remove('editando');
        }
    }
};

// Función auxiliar para mostrar historial de cambios (opcional)
async function mostrarHistorialCambios(idPersonal) {
    try {
        const connection = await connectionString();
        
        const query = `
            SELECT 
                Campo,
                ValorAnterior,
                ValorNuevo,
                NombreUsuario,
                FechaHoraRegistro
            FROM PagoPlanillaHistorialCambios
            WHERE IdPagoPlanilla = ? 
            AND IdPersonal = ?
            ORDER BY FechaHoraRegistro DESC
            LIMIT 10
        `;
        
        const historial = await connection.query(query, [
            currentPlanillaData.IdPagoPlanilla,
            idPersonal
        ]);
        
        await connection.close();
        
        if (historial.length === 0) {
            await Swal.fire({
                icon: 'info',
                title: 'Sin historial',
                text: 'No hay cambios registrados para este empleado en esta planilla.'
            });
            return;
        }
        
        let htmlHistorial = '<div style="text-align: left;"><table style="width: 100%; font-size: 12px;">';
        htmlHistorial += '<tr style="background: #f0f0f0;"><th>Campo</th><th>Antes</th><th>Después</th><th>Usuario</th><th>Fecha</th></tr>';
        
        historial.forEach(cambio => {
            htmlHistorial += `
                <tr>
                    <td><strong>${cambio.Campo}</strong></td>
                    <td>${formatearMoneda(cambio.ValorAnterior)}</td>
                    <td>${formatearMoneda(cambio.ValorNuevo)}</td>
                    <td>${cambio.NombreUsuario}</td>
                    <td>${formatearFecha(cambio.FechaHoraRegistro)}</td>
                </tr>
            `;
        });
        
        htmlHistorial += '</table></div>';
        
        await Swal.fire({
            title: 'Historial de cambios',
            html: htmlHistorial,
            width: 800,
            confirmButtonText: 'Cerrar'
        });
        
    } catch (error) {
        console.error('Error al obtener historial:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo obtener el historial de cambios.'
        });
    }
}
// Manejo de errores globales
window.addEventListener('error', function(e) {
    console.error('Error global:', e.error);
    
    // Solo mostrar error al usuario si es crítico
    if (e.error && e.error.message && e.error.message.includes('connectionString')) {
        mostrarToast('Error de conexión a la base de datos', 'error');
    }
});
window.addEventListener('resize', () => {
    setTimeout(ajustarScrollTabla, 100);
});
// Manejo de promesas rechazadas
window.addEventListener('unhandledrejection', function(e) {
    console.error('Promesa rechazada:', e.reason);
    
    if (e.reason && e.reason.message && e.reason.message.includes('connectionString')) {
        mostrarToast('Error de conexión a la base de datos', 'error');
    }
});

// Exportar funciones principales para uso externo si es necesario
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        buscarPlanilla,
        editarPlanilla,
        formatearMoneda,
        formatearFecha
    };
}
window.addEventListener('resize', ajustarAlturaTabla);