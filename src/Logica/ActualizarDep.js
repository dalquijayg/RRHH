const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');

// Variables globales para manejo de datos
let departamentosData = [];
let filteredData = [];
let currentPage = 1;
let pageSize = 10;
let sortColumn = '';
let sortDirection = 'asc';
let regiones = []; // Para el formulario
let puestosGenerales = []; // Para el formulario de puestos

// Variables para modal de puestos
let puestosData = [];
let colaboradoresData = [];
let currentDepartamento = null;

// Inicialización cuando se carga el DOM
document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatos();
    await cargarRegiones();
    await cargarPuestosGenerales();
    configurarEventListeners();
    configurarModalPuestos();
    actualizarTabla();
});

// Función para cargar los datos de departamentos
async function cargarDatos() {
    try {
        mostrarLoading(true);
        
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento, 
                Regiones.NombreRegion, 
                departamentos.PlanFijo, 
                departamentos.PlanParcial, 
                departamentos.PlanVacacionista,
                departamentos.IdRegion
            FROM
                departamentos
                INNER JOIN
                Regiones
                ON 
                    departamentos.IdRegion = Regiones.IdRegion
            ORDER BY departamentos.NombreDepartamento ASC
        `);
        
        await connection.close();
        
        departamentosData = result;
        filteredData = [...departamentosData];
        
        actualizarContadores();
        mostrarLoading(false);
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        mostrarLoading(false);
        
        await Swal.fire({
            icon: 'error',
            title: 'Error de Conexión',
            text: 'No se pudieron cargar los datos de departamentos.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para cargar las regiones (para el formulario)
async function cargarRegiones() {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT IdRegion, NombreRegion 
            FROM Regiones 
            ORDER BY NombreRegion ASC
        `);
        await connection.close();
        
        regiones = result;
        
    } catch (error) {
        console.error('Error al cargar regiones:', error);
    }
}

// Función para cargar puestos generales (para el formulario de puestos)
async function cargarPuestosGenerales() {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT Id_Puesto, Nombre 
            FROM PuestosGenerales 
            ORDER BY Nombre ASC
        `);
        await connection.close();
        
        puestosGenerales = result;
        
    } catch (error) {
        console.error('Error al cargar puestos generales:', error);
    }
}

// Configurar todos los event listeners
function configurarEventListeners() {
    // Botones principales
    document.getElementById('btnAgregar').addEventListener('click', () => mostrarFormulario(null));
    document.getElementById('btnRefrescar').addEventListener('click', refrescarDatos);
    document.getElementById('btnFiltros').addEventListener('click', mostrarFiltros);
    
    // Buscador
    document.getElementById('searchInput').addEventListener('input', aplicarFiltros);
    
    // Paginación
    document.getElementById('pageSize').addEventListener('change', cambiarTamanoPagina);
    document.getElementById('btnFirst').addEventListener('click', () => irAPagina(1));
    document.getElementById('btnPrev').addEventListener('click', () => irAPagina(currentPage - 1));
    document.getElementById('btnNext').addEventListener('click', () => irAPagina(currentPage + 1));
    document.getElementById('btnLast').addEventListener('click', () => irAPagina(Math.ceil(filteredData.length / pageSize)));
    
    // Headers ordenables
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => ordenarPor(header.getAttribute('data-sort')));
    });
}

// Configurar event listeners del modal de puestos
function configurarModalPuestos() {
    // Cerrar modal
    document.getElementById('btnCerrarModalPuestos').addEventListener('click', cerrarModalPuestos);
    document.getElementById('btnCerrarPuestos').addEventListener('click', cerrarModalPuestos);
    
    // Clicks fuera del modal
    document.getElementById('modalPuestos').addEventListener('click', (e) => {
        if (e.target.id === 'modalPuestos') {
            cerrarModalPuestos();
        }
    });
    
    // Botones del modal
    document.getElementById('btnAgregarPuesto').addEventListener('click', () => mostrarFormularioPuesto(null));
    document.getElementById('btnRefrescarPuestos').addEventListener('click', refrescarPuestos);
    
    // Buscador de puestos
    document.getElementById('searchPuestos').addEventListener('input', filtrarPuestos);
    
    // Ocultar colaboradores
    document.getElementById('btnOcultarColaboradores').addEventListener('click', () => {
        document.getElementById('colaboradoresSection').style.display = 'none';
    });
}

// Mostrar/ocultar loading
function mostrarLoading(show) {
    const tableBody = document.getElementById('tableBody');
    
    if (show) {
        tableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="7" class="text-center">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        Cargando datos...
                    </div>
                </td>
            </tr>
        `;
    }
}

// Actualizar la tabla con los datos actuales
function actualizarTabla() {
    const tableBody = document.getElementById('tableBody');
    
    if (filteredData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>No se encontraron departamentos</h3>
                        <p>No hay datos que coincidan con los criterios de búsqueda.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Calcular datos para la página actual
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    // Generar filas de la tabla
    tableBody.innerHTML = pageData.map(dept => `
        <tr data-id="${dept.IdDepartamento}">
            <td class="text-center">${dept.IdDepartamento}</td>
            <td><strong>${dept.NombreDepartamento}</strong></td>
            <td>${dept.NombreRegion}</td>
            <td class="text-center">
                <span class="plan-quantity ${(dept.PlanFijo && parseInt(dept.PlanFijo) > 0) ? 'active' : 'inactive'}">
                    ${parseInt(dept.PlanFijo) || 0}
                </span>
            </td>
            <td class="text-center">
                <span class="plan-quantity ${(dept.PlanParcial && parseInt(dept.PlanParcial) > 0) ? 'active' : 'inactive'}">
                    ${parseInt(dept.PlanParcial) || 0}
                </span>
            </td>
            <td class="text-center">
                <span class="plan-quantity ${(dept.PlanVacacionista && parseInt(dept.PlanVacacionista) > 0) ? 'active' : 'inactive'}">
                    ${parseInt(dept.PlanVacacionista) || 0}
                </span>
            </td>
            <td class="text-center">
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="verPuestos(${dept.IdDepartamento})" title="Ver Puestos">
                        <i class="fas fa-briefcase"></i>
                    </button>
                    <button class="btn-action btn-edit" onclick="editarDepartamento(${dept.IdDepartamento})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="eliminarDepartamento(${dept.IdDepartamento})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    actualizarPaginacion();
}

// Aplicar filtros de búsqueda
function aplicarFiltros() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredData = [...departamentosData];
    } else {
        filteredData = departamentosData.filter(dept => 
            dept.NombreDepartamento.toLowerCase().includes(searchTerm) ||
            dept.NombreRegion.toLowerCase().includes(searchTerm) ||
            dept.IdDepartamento.toString().includes(searchTerm)
        );
    }
    
    currentPage = 1;
    actualizarContadores();
    actualizarTabla();
}

// Ordenar datos por columna
function ordenarPor(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    filteredData.sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];
        
        // Manejar diferentes tipos de datos
        if (typeof valueA === 'string') {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
        }
        
        // Para campos numéricos
        if (column === 'PlanFijo' || column === 'PlanParcial' || column === 'PlanVacacionista' || column === 'IdDepartamento') {
            valueA = parseInt(valueA) || 0;
            valueB = parseInt(valueB) || 0;
        }
        
        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Actualizar indicadores visuales
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
    });
    
    const currentHeader = document.querySelector(`[data-sort="${column}"]`);
    currentHeader.classList.add(`sorted-${sortDirection}`);
    
    currentPage = 1;
    actualizarTabla();
}

// Cambiar tamaño de página
function cambiarTamanoPagina() {
    pageSize = parseInt(document.getElementById('pageSize').value);
    currentPage = 1;
    actualizarTabla();
}

// Ir a página específica
function irAPagina(page) {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        actualizarTabla();
    }
}

// Actualizar información de paginación
function actualizarPaginacion() {
    const totalRecords = filteredData.length;
    const totalPages = Math.ceil(totalRecords / pageSize);
    const startRecord = (currentPage - 1) * pageSize + 1;
    const endRecord = Math.min(currentPage * pageSize, totalRecords);
    
    // Actualizar información
    document.getElementById('showingStart').textContent = totalRecords > 0 ? startRecord : 0;
    document.getElementById('showingEnd').textContent = endRecord;
    document.getElementById('totalRecords').textContent = totalRecords;
    
    // Actualizar botones de navegación
    document.getElementById('btnFirst').disabled = currentPage === 1;
    document.getElementById('btnPrev').disabled = currentPage === 1;
    document.getElementById('btnNext').disabled = currentPage === totalPages || totalPages === 0;
    document.getElementById('btnLast').disabled = currentPage === totalPages || totalPages === 0;
    
    // Generar números de página
    generarNumerosPagina(totalPages);
}

// Generar números de página
function generarNumerosPagina(totalPages) {
    const pageNumbers = document.getElementById('pageNumbers');
    pageNumbers.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.addEventListener('click', () => irAPagina(i));
        pageNumbers.appendChild(pageButton);
    }
}

// Actualizar contadores
function actualizarContadores() {
    document.getElementById('recordCount').textContent = departamentosData.length;
}

// Refrescar datos
async function refrescarDatos() {
    await cargarDatos();
    await cargarRegiones();
    await cargarPuestosGenerales();
    
    // Limpiar filtros
    document.getElementById('searchInput').value = '';
    filteredData = [...departamentosData];
    currentPage = 1;
    sortColumn = '';
    sortDirection = 'asc';
    
    // Limpiar indicadores de ordenamiento
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
    });
    
    actualizarTabla();
    
    // Mostrar mensaje de éxito
    Swal.fire({
        icon: 'success',
        title: 'Datos actualizados',
        text: 'Los datos se han refrescado correctamente.',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

// === FUNCIONES DE DEPARTAMENTOS ===

// Mostrar formulario para agregar/editar departamento
async function mostrarFormulario(departamentoData) {
    const isEditing = departamentoData !== null;
    const title = isEditing ? 'Editar Departamento' : 'Agregar Nuevo Departamento';
    
    const regionesOptions = regiones.map(region => 
        `<option value="${region.IdRegion}" ${isEditing && departamentoData && departamentoData.IdRegion == region.IdRegion ? 'selected' : ''}>
            ${region.NombreRegion}
        </option>`
    ).join('');
    
    const { value: formValues } = await Swal.fire({
        title: title,
        html: `
            <div style="text-align: left; max-width: 500px;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #654321;">
                        Nombre del Departamento *
                    </label>
                    <input type="text" id="nombreDepartamento" class="swal2-input" 
                           value="${isEditing && departamentoData ? departamentoData.NombreDepartamento || '' : ''}"
                           placeholder="Ingrese el nombre del departamento"
                           style="width: 100%; margin: 0;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #654321;">
                        Región *
                    </label>
                    <select id="regionSelect" class="swal2-input" style="width: 100%; margin: 0;">
                        <option value="">Seleccione una región</option>
                        ${regionesOptions}
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #654321; margin-bottom: 15px; border-bottom: 2px solid #FF9800; padding-bottom: 5px;">
                        Cantidades Máximas por Plan
                    </h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                        <div style="text-align: center;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #654321;">
                                Plan Fijo
                            </label>
                            <input type="number" id="planFijo" class="swal2-input" 
                                   value="${isEditing && departamentoData ? (parseInt(departamentoData.PlanFijo) || 0) : 0}"
                                   min="0" max="999"
                                   style="width: 100%; margin: 0; text-align: center; font-size: 1.2rem; font-weight: bold;">
                        </div>
                        
                        <div style="text-align: center;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #654321;">
                                Plan Parcial
                            </label>
                            <input type="number" id="planParcial" class="swal2-input" 
                                   value="${isEditing && departamentoData ? (parseInt(departamentoData.PlanParcial) || 0) : 0}"
                                   min="0" max="999"
                                   style="width: 100%; margin: 0; text-align: center; font-size: 1.2rem; font-weight: bold;">
                        </div>
                        
                        <div style="text-align: center;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #654321;">
                                Plan Vacacionista
                            </label>
                            <input type="number" id="planVacacionista" class="swal2-input" 
                                   value="${isEditing && departamentoData ? (parseInt(departamentoData.PlanVacacionista) || 0) : 0}"
                                   min="0" max="999"
                                   style="width: 100%; margin: 0; text-align: center; font-size: 1.2rem; font-weight: bold;">
                        </div>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin-top: 15px;">
                        <p style="margin: 0; color: #1976d2; font-size: 0.85rem; text-align: center;">
                            💡 Ingrese la cantidad máxima permitida para cada tipo de plan
                        </p>
                    </div>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: isEditing ? 'Actualizar' : 'Agregar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#FF9800',
        width: '600px',
        customClass: {
            popup: 'swal2-no-scroll'
        },
        preConfirm: () => {
            const nombre = document.getElementById('nombreDepartamento').value.trim();
            const regionValue = document.getElementById('regionSelect').value;
            
            // Obtener valores de los campos numéricos
            const planFijoValue = document.getElementById('planFijo').value;
            const planParcialValue = document.getElementById('planParcial').value;
            const planVacacionistaValue = document.getElementById('planVacacionista').value;
            
            // Validaciones básicas
            if (!nombre) {
                Swal.showValidationMessage('El nombre del departamento es requerido');
                return false;
            }
            
            if (!regionValue) {
                Swal.showValidationMessage('Debe seleccionar una región');
                return false;
            }
            
            // Convertir valores a números enteros con validación
            const region = parseInt(regionValue);
            const planFijo = planFijoValue === '' ? 0 : parseInt(planFijoValue);
            const planParcial = planParcialValue === '' ? 0 : parseInt(planParcialValue);
            const planVacacionista = planVacacionistaValue === '' ? 0 : parseInt(planVacacionistaValue);
            
            // Validar que sean números válidos
            if (isNaN(region) || isNaN(planFijo) || isNaN(planParcial) || isNaN(planVacacionista)) {
                Swal.showValidationMessage('Todos los valores numéricos deben ser válidos');
                return false;
            }
            
            // Validar rangos
            if (planFijo < 0 || planParcial < 0 || planVacacionista < 0) {
                Swal.showValidationMessage('Las cantidades no pueden ser negativas');
                return false;
            }
            
            if (planFijo > 999 || planParcial > 999 || planVacacionista > 999) {
                Swal.showValidationMessage('Las cantidades no pueden ser mayores a 999');
                return false;
            }
            
            return { 
                nombre, 
                region, 
                planFijo, 
                planParcial, 
                planVacacionista 
            };
        }
    });
    
    if (formValues) {
        if (isEditing && departamentoData) {
            await actualizarDepartamento(departamentoData.IdDepartamento, formValues);
        } else {
            await crearDepartamento(formValues);
        }
    }
}

// Crear nuevo departamento
async function crearDepartamento(data) {
    try {
        // Validar que todos los datos requeridos estén presentes
        if (!data.nombre || !data.region) {
            throw new Error('Faltan datos requeridos: nombre o región');
        }

        const connection = await connectionString();
        
        const result = await connection.query(`
            INSERT INTO departamentos (NombreDepartamento, IdRegion, PlanFijo, PlanParcial, PlanVacacionista)
            VALUES (?, ?, ?, ?, ?)
        `, [
            data.nombre,
            data.region,
            data.planFijo || 0,
            data.planParcial || 0,
            data.planVacacionista || 0
        ]);
        
        await connection.close();
        
        await Swal.fire({
            icon: 'success',
            title: '¡Departamento creado!',
            text: 'El departamento se ha agregado correctamente.',
            confirmButtonColor: '#4CAF50'
        });
        
        await refrescarDatos();
        
    } catch (error) {
        console.error('Error al crear departamento:', error);
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al crear',
            text: error.message || 'No se pudo crear el departamento. Verifique que el nombre no esté duplicado.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Actualizar departamento existente
async function actualizarDepartamento(id, data) {
    try {
        // Validar que todos los datos requeridos estén presentes
        if (!data.nombre || !data.region || !id) {
            throw new Error('Faltan datos requeridos: nombre, región o ID del departamento');
        }

        const connection = await connectionString();
        
        const result = await connection.query(`
            UPDATE departamentos 
            SET NombreDepartamento = ?, IdRegion = ?, PlanFijo = ?, PlanParcial = ?, PlanVacacionista = ?
            WHERE IdDepartamento = ?
        `, [
            data.nombre,
            data.region,
            data.planFijo || 0,
            data.planParcial || 0,
            data.planVacacionista || 0,
            parseInt(id)
        ]);
        
        await connection.close();
        
        await Swal.fire({
            icon: 'success',
            title: '¡Departamento actualizado!',
            text: 'Los cambios se han guardado correctamente.',
            confirmButtonColor: '#4CAF50'
        });
        
        await refrescarDatos();
        
    } catch (error) {
        console.error('Error al actualizar departamento:', error);
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al actualizar',
            text: error.message || 'No se pudo actualizar el departamento.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Editar departamento
async function editarDepartamento(id) {
    const departamento = departamentosData.find(d => d.IdDepartamento == id);
    
    if (departamento) {
        await mostrarFormulario(departamento);
    } else {
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo encontrar el departamento seleccionado.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Eliminar departamento
async function eliminarDepartamento(id) {
    const departamento = departamentosData.find(d => d.IdDepartamento == id);
    
    if (!departamento) return;
    
    const result = await Swal.fire({
        title: '¿Confirmar eliminación?',
        html: `
            <div style="text-align: center;">
                <div style="font-size: 3rem; color: #FF5252; margin-bottom: 15px;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <p style="margin-bottom: 15px;">
                    Está a punto de eliminar el departamento:
                </p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="color: #654321; margin-bottom: 5px;">${departamento.NombreDepartamento}</h4>
                    <p style="color: #777; margin: 0;">Región: ${departamento.NombreRegion}</p>
                </div>
                <div style="background: #ffebee; padding: 12px; border-radius: 8px; border-left: 4px solid #FF5252;">
                    <p style="color: #c62828; margin: 0; font-weight: 500;">
                        ⚠️ Esta acción no se puede deshacer
                    </p>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#FF5252',
        cancelButtonColor: '#6c757d',
        width: '500px'
    });
    
    if (result.isConfirmed) {
        try {
            const connection = await connectionString();
            await connection.query('DELETE FROM departamentos WHERE IdDepartamento = ?', [id]);
            await connection.close();
            
            await Swal.fire({
                icon: 'success',
                title: '¡Departamento eliminado!',
                text: 'El departamento se ha eliminado correctamente.',
                confirmButtonColor: '#4CAF50',
                timer: 2000
            });
            
            await refrescarDatos();
            
        } catch (error) {
            console.error('Error al eliminar departamento:', error);
            
            await Swal.fire({
                icon: 'error',
                title: 'Error al eliminar',
                text: 'No se pudo eliminar el departamento. Puede que tenga registros asociados.',
                confirmButtonColor: '#FF9800'
            });
        }
    }
}

// === FUNCIONES DEL MODAL DE PUESTOS ===

// Ver puestos de un departamento
async function verPuestos(idDepartamento) {
    const departamento = departamentosData.find(d => d.IdDepartamento == idDepartamento);
    
    if (!departamento) {
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo encontrar el departamento seleccionado.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    currentDepartamento = departamento;
    
    // Actualizar información del departamento en el modal
    document.getElementById('modalPuestosTitle').textContent = `Puestos - ${departamento.NombreDepartamento}`;
    document.getElementById('deptNombre').textContent = departamento.NombreDepartamento;
    document.getElementById('deptRegion').textContent = departamento.NombreRegion;
    document.getElementById('deptPlanFijo').textContent = departamento.PlanFijo || 0;
    document.getElementById('deptPlanParcial').textContent = departamento.PlanParcial || 0;
    document.getElementById('deptPlanVacacionista').textContent = departamento.PlanVacacionista || 0;
    
    // Mostrar el modal
    document.getElementById('modalPuestos').style.display = 'flex';
    
    // Cargar puestos
    await cargarPuestos(idDepartamento);
}

// Cargar puestos del departamento
async function cargarPuestos(idDepartamento) {
    try {
        const tableBody = document.getElementById('puestosTableBody');
        tableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="6" class="text-center">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        Cargando puestos...
                    </div>
                </td>
            </tr>
        `;
        
        const connection = await connectionString();
        
        // Cargar puestos del departamento
        const puestosResult = await connection.query(`
            SELECT 
                p.IdPuesto,
                p.Nombre,
                p.PagosDominicales,
                p.PagosDiasEspeciales,
                p.Id_PuestoGeneral,
                pg.Nombre as PuestoGeneral,
                COUNT(per.IdPersonal) as TotalColaboradores
            FROM Puestos p
            LEFT JOIN PuestosGenerales pg ON p.Id_PuestoGeneral = pg.Id_Puesto
            LEFT JOIN personal per ON p.IdPuesto = per.IdPuesto AND per.Estado = 1 AND per.IdSucuDepa = ?
            WHERE p.IdDepartamento = ?
            GROUP BY p.IdPuesto, p.Nombre, p.PagosDominicales, p.PagosDiasEspeciales, p.Id_PuestoGeneral, pg.Nombre
            ORDER BY p.Nombre ASC
        `, [idDepartamento, idDepartamento]);
        
        await connection.close();
        
        puestosData = puestosResult;
        actualizarTablaPuestos();
        
    } catch (error) {
        console.error('Error al cargar puestos:', error);
        
        const tableBody = document.getElementById('puestosTableBody');
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error al cargar puestos</h3>
                        <p>No se pudieron cargar los puestos del departamento.</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Actualizar tabla de puestos
function actualizarTablaPuestos(filteredPuestos = null) {
    const tableBody = document.getElementById('puestosTableBody');
    const dataToShow = filteredPuestos || puestosData;
    
    if (dataToShow.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-briefcase"></i>
                        <h3>No hay puestos</h3>
                        <p>Este departamento no tiene puestos registrados.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = dataToShow.map(puesto => `
        <tr>
            <td class="text-center">${puesto.IdPuesto}</td>
            <td>
                <strong>${puesto.Nombre}</strong>
                <br>
                <small class="text-muted">${puesto.PuestoGeneral || 'Sin categoría'}</small>
            </td>
            <td class="text-center">
                <span class="collaborators-count ${puesto.TotalColaboradores == 0 ? 'zero' : ''}">
                    ${puesto.TotalColaboradores}
                </span>
            </td>
            <td class="text-center">
                <span class="money-display">Q${parseFloat(puesto.PagosDominicales || 0).toFixed(2)}</span>
            </td>
            <td class="text-center">
                <span class="money-display">Q${parseFloat(puesto.PagosDiasEspeciales || 0).toFixed(2)}</span>
            </td>
            <td class="text-center">
                <div class="action-buttons">
                    <button class="btn-action btn-collaborators" onclick="verColaboradores(${puesto.IdPuesto}, '${puesto.Nombre.replace(/'/g, "\\'")}')" title="Ver Colaboradores">
                        <i class="fas fa-users"></i>
                    </button>
                    <button class="btn-action btn-edit" onclick="editarPuesto(${puesto.IdPuesto})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="eliminarPuesto(${puesto.IdPuesto})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Filtrar puestos
function filtrarPuestos() {
    const searchTerm = document.getElementById('searchPuestos').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        actualizarTablaPuestos();
    } else {
        const filteredPuestos = puestosData.filter(puesto => 
            puesto.Nombre.toLowerCase().includes(searchTerm) ||
            puesto.IdPuesto.toString().includes(searchTerm) ||
            (puesto.PuestoGeneral && puesto.PuestoGeneral.toLowerCase().includes(searchTerm))
        );
        actualizarTablaPuestos(filteredPuestos);
    }
}

// Refrescar puestos
async function refrescarPuestos() {
    if (currentDepartamento) {
        await cargarPuestos(currentDepartamento.IdDepartamento);
        
        Swal.fire({
            icon: 'success',
            title: 'Puestos actualizados',
            text: 'Los datos se han refrescado correctamente.',
            timer: 1000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }
}

// Cerrar modal de puestos
function cerrarModalPuestos() {
    document.getElementById('modalPuestos').style.display = 'none';
    document.getElementById('colaboradoresSection').style.display = 'none';
    currentDepartamento = null;
    puestosData = [];
    colaboradoresData = [];
}

// Mostrar formulario para agregar/editar puesto
async function mostrarFormularioPuesto(puestoData = null) {
    const isEditing = puestoData !== null;
    const title = isEditing ? 'Editar Puesto' : 'Agregar Nuevo Puesto';
    
    // Generar opciones de puestos generales
    const puestosGeneralesOptions = puestosGenerales.map(pg => 
        `<option value="${pg.Id_Puesto}" ${isEditing && puestoData && puestoData.Id_PuestoGeneral == pg.Id_Puesto ? 'selected' : ''}>
            ${pg.Nombre}
        </option>`
    ).join('');
    
    const { value: formValues } = await Swal.fire({
        title: title,
        html: `
            <div style="text-align: left; max-width: 500px;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #654321;">
                        Nombre del Puesto *
                    </label>
                    <input type="text" id="nombrePuesto" class="swal2-input" 
                           value="${isEditing ? puestoData.Nombre || '' : ''}"
                           placeholder="Ingrese el nombre del puesto"
                           style="width: 100%; margin: 0;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #654321;">
                        Categoría de Puesto *
                    </label>
                    <select id="puestoGeneral" class="swal2-input" style="width: 100%; margin: 0;">
                        <option value="">Seleccione una categoría</option>
                        ${puestosGeneralesOptions}
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #654321; margin-bottom: 15px; border-bottom: 2px solid #FF9800; padding-bottom: 5px;">
                        Información de Pagos
                    </h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #654321;">
                                Pago Dominical (Q)
                            </label>
                            <input type="number" id="pagoDominical" class="swal2-input money-input" 
                                   value="${isEditing ? (parseFloat(puestoData.PagosDominicales) || 0) : 0}"
                                   min="0" step="0.01"
                                   placeholder="0.00"
                                   style="width: 100%; margin: 0; text-align: right;">
                        </div>
                        
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #654321;">
                                Pago Días Especiales (Q)
                            </label>
                            <input type="number" id="pagoDiasEspeciales" class="swal2-input money-input" 
                                   value="${isEditing ? (parseFloat(puestoData.PagosDiasEspeciales) || 0) : 0}"
                                   min="0" step="0.01"
                                   placeholder="0.00"
                                   style="width: 100%; margin: 0; text-align: right;">
                        </div>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin-top: 15px;">
                        <p style="margin: 0; color: #1976d2; font-size: 0.85rem; text-align: center;">
                            💰 Configure los montos de pago para días especiales
                        </p>
                    </div>
                </div>
                
                ${!isEditing ? `
                <div style="background: #fff3e0; padding: 12px; border-radius: 8px; margin-top: 15px;">
                    <p style="margin: 0; color: #f57c00; font-size: 0.85rem; text-align: center;">
                        📍 Este puesto se creará para el departamento: <strong>${currentDepartamento.NombreDepartamento}</strong>
                    </p>
                </div>
                ` : ''}
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: isEditing ? 'Actualizar' : 'Agregar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#FF9800',
        width: '600px',
        customClass: {
            popup: 'swal2-no-scroll'
        },
        preConfirm: () => {
            const nombre = document.getElementById('nombrePuesto').value.trim();
            const puestoGeneralValue = document.getElementById('puestoGeneral').value;
            const pagoDominicalValue = document.getElementById('pagoDominical').value;
            const pagoDiasEspecialesValue = document.getElementById('pagoDiasEspeciales').value;
            
            if (!nombre) {
                Swal.showValidationMessage('El nombre del puesto es requerido');
                return false;
            }
            
            if (!puestoGeneralValue) {
                Swal.showValidationMessage('Debe seleccionar una categoría de puesto');
                return false;
            }
            
            const puestoGeneral = parseInt(puestoGeneralValue);
            const pagoDominical = parseFloat(pagoDominicalValue) || 0;
            const pagoDiasEspeciales = parseFloat(pagoDiasEspecialesValue) || 0;
            
            if (isNaN(puestoGeneral)) {
                Swal.showValidationMessage('La categoría de puesto debe ser válida');
                return false;
            }
            
            if (pagoDominical < 0 || pagoDiasEspeciales < 0) {
                Swal.showValidationMessage('Los montos no pueden ser negativos');
                return false;
            }
            
            return { 
                nombre, 
                puestoGeneral,
                pagoDominical: pagoDominical.toFixed(2), 
                pagoDiasEspeciales: pagoDiasEspeciales.toFixed(2)
            };
        }
    });
    
    if (formValues) {
        if (isEditing) {
            await actualizarPuesto(puestoData.IdPuesto, formValues);
        } else {
            await crearPuesto(formValues);
        }
    }
}

// Crear nuevo puesto
async function crearPuesto(data) {
    try {
        if (!currentDepartamento) {
            throw new Error('No hay departamento seleccionado');
        }
        
        const connection = await connectionString();
        
        await connection.query(`
            INSERT INTO Puestos (Nombre, PagosDominicales, PagosDiasEspeciales, IdDepartamento, Id_PuestoGeneral)
            VALUES (?, ?, ?, ?, ?)
        `, [
            data.nombre,
            data.pagoDominical,
            data.pagoDiasEspeciales,
            currentDepartamento.IdDepartamento,
            data.puestoGeneral
        ]);
        
        await connection.close();
        
        await Swal.fire({
            icon: 'success',
            title: '¡Puesto creado!',
            text: 'El puesto se ha agregado correctamente.',
            confirmButtonColor: '#4CAF50'
        });
        
        await refrescarPuestos();
        
    } catch (error) {
        console.error('Error al crear puesto:', error);
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al crear',
            text: error.message || 'No se pudo crear el puesto.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Actualizar puesto existente
async function actualizarPuesto(id, data) {
    try {
        const connection = await connectionString();
        
        await connection.query(`
            UPDATE Puestos 
            SET Nombre = ?, PagosDominicales = ?, PagosDiasEspeciales = ?, Id_PuestoGeneral = ?
            WHERE IdPuesto = ?
        `, [
            data.nombre,
            data.pagoDominical,
            data.pagoDiasEspeciales,
            data.puestoGeneral,
            parseInt(id)
        ]);
        
        await connection.close();
        
        await Swal.fire({
            icon: 'success',
            title: '¡Puesto actualizado!',
            text: 'Los cambios se han guardado correctamente.',
            confirmButtonColor: '#4CAF50'
        });
        
        await refrescarPuestos();
        
    } catch (error) {
        console.error('Error al actualizar puesto:', error);
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al actualizar',
            text: 'No se pudo actualizar el puesto.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Editar puesto
async function editarPuesto(id) {
    const puesto = puestosData.find(p => p.IdPuesto == id);
    
    if (puesto) {
        await mostrarFormularioPuesto(puesto);
    } else {
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo encontrar el puesto seleccionado.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Eliminar puesto
async function eliminarPuesto(id) {
    try {
        const puesto = puestosData.find(p => p.IdPuesto == id);
        
        if (!puesto) return;
        
        // Verificar si hay colaboradores asignados
        if (puesto.TotalColaboradores > 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'No se puede eliminar',
                html: `
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; color: #FF9800; margin-bottom: 15px;">
                            <i class="fas fa-users"></i>
                        </div>
                        <p style="margin-bottom: 15px;">
                            El puesto <strong>"${puesto.Nombre}"</strong> tiene <strong>${puesto.TotalColaboradores}</strong> colaborador(es) asignado(s).
                        </p>
                        <div style="background: #fff3e0; padding: 12px; border-radius: 8px; border-left: 4px solid #FF9800;">
                            <p style="color: #f57c00; margin: 0; font-weight: 500;">
                                ⚠️ Debe reasignar o dar de baja a los colaboradores antes de eliminar el puesto
                            </p>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#FF9800',
                width: '500px'
            });
            return;
        }
        
        const result = await Swal.fire({
            title: '¿Confirmar eliminación?',
            html: `
                <div style="text-align: center;">
                    <div style="font-size: 3rem; color: #FF5252; margin-bottom: 15px;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <p style="margin-bottom: 15px;">
                        Está a punto de eliminar el puesto:
                    </p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h4 style="color: #654321; margin-bottom: 5px;">${puesto.Nombre}</h4>
                        <p style="color: #777; margin: 0;">Departamento: ${currentDepartamento.NombreDepartamento}</p>
                    </div>
                    <div style="background: #ffebee; padding: 12px; border-radius: 8px; border-left: 4px solid #FF5252;">
                        <p style="color: #c62828; margin: 0; font-weight: 500;">
                            ⚠️ Esta acción no se puede deshacer
                        </p>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#FF5252',
            cancelButtonColor: '#6c757d',
            width: '500px'
        });
        
        if (result.isConfirmed) {
            const connection = await connectionString();
            await connection.query('DELETE FROM Puestos WHERE IdPuesto = ?', [id]);
            await connection.close();
            
            await Swal.fire({
                icon: 'success',
                title: '¡Puesto eliminado!',
                text: 'El puesto se ha eliminado correctamente.',
                confirmButtonColor: '#4CAF50',
                timer: 2000
            });
            
            await refrescarPuestos();
        }
        
    } catch (error) {
        console.error('Error al eliminar puesto:', error);
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al eliminar',
            text: 'No se pudo eliminar el puesto.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Ver colaboradores de un puesto
async function verColaboradores(idPuesto, nombrePuesto) {
    try {
        if (!currentDepartamento) return;
        
        const connection = await connectionString();
        
        const result = await connection.query(`
            SELECT
                personal.IdPersonal,
                CONCAT_WS(' ', 
                    personal.PrimerNombre, 
                    personal.SegundoNombre, 
                    personal.TercerNombre,
                    personal.PrimerApellido, 
                    personal.SegundoApellido
                ) AS NombreCompleto,
                Puestos.Nombre AS Puesto,
                Puestos.PagosDominicales,
                Puestos.PagosDiasEspeciales
            FROM personal
            INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
            WHERE personal.IdSucuDepa = ? AND personal.IdPuesto = ? AND personal.Estado = 1
            ORDER BY personal.PrimerNombre ASC
        `, [currentDepartamento.IdDepartamento, idPuesto]);
        
        await connection.close();
        
        colaboradoresData = result;
        
        // Mostrar sección de colaboradores
        document.getElementById('puestoSeleccionado').textContent = nombrePuesto;
        document.getElementById('colaboradoresSection').style.display = 'block';
        
        // Actualizar grid de colaboradores
        actualizarGridColaboradores();
        
        // Scroll suave hacia la sección
        document.getElementById('colaboradoresSection').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error al cargar colaboradores:', error);
        
        await Swal.fire({
            icon: 'error',
            title: 'Error al cargar',
            text: 'No se pudieron cargar los colaboradores del puesto.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Actualizar grid de colaboradores
function actualizarGridColaboradores() {
    const grid = document.getElementById('colaboradoresGrid');
    
    if (colaboradoresData.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #777;">
                <i class="fas fa-user-slash" style="font-size: 3rem; margin-bottom: 15px; color: #ddd;"></i>
                <h3>Sin colaboradores</h3>
                <p>Este puesto no tiene colaboradores asignados.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = colaboradoresData.map(colaborador => {
        const iniciales = colaborador.NombreCompleto
            .split(' ')
            .slice(0, 2)
            .map(name => name.charAt(0))
            .join('');
            
        return `
            <div class="colaborador-card">
                <div class="colaborador-header">
                    <div class="colaborador-avatar">
                        ${iniciales}
                    </div>
                    <div class="colaborador-info">
                        <h4>${colaborador.NombreCompleto}</h4>
                        <span class="colaborador-id">ID: ${colaborador.IdPersonal}</span>
                    </div>
                </div>
                <div class="colaborador-details">
                    <div class="detail-item">
                        <span class="detail-label">Pago Dominical</span>
                        <span class="detail-value money">Q${parseFloat(colaborador.PagosDominicales || 0).toFixed(2)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Días Especiales</span>
                        <span class="detail-value money">Q${parseFloat(colaborador.PagosDiasEspeciales || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Mostrar filtros avanzados
async function mostrarFiltros() {
    const regionesOptions = regiones.map(region => 
        `<option value="${region.IdRegion}">${region.NombreRegion}</option>`
    ).join('');
    
    const { value: filtros, isDismissed } = await Swal.fire({
        title: 'Filtros Avanzados',
        html: `
            <div style="text-align: left; max-width: 400px;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Región:</label>
                    <select id="filtroRegion" class="swal2-input" style="width: 100%; margin: 0;">
                        <option value="">Todas las regiones</option>
                        ${regionesOptions}
                    </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 12px; font-weight: 600;">Cantidad mínima por plan:</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="font-size: 0.85rem; margin-bottom: 4px; display: block;">Plan Fijo:</label>
                            <input type="number" id="filtroFijoMin" class="swal2-input" 
                                   placeholder="Min" min="0" 
                                   style="width: 100%; margin: 0; font-size: 0.9rem;">
                        </div>
                        <div>
                            <label style="font-size: 0.85rem; margin-bottom: 4px; display: block;">Plan Parcial:</label>
                            <input type="number" id="filtroParcialMin" class="swal2-input" 
                                   placeholder="Min" min="0"
                                   style="width: 100%; margin: 0; font-size: 0.9rem;">
                        </div>
                    </div>
                    <div style="margin-top: 10px;">
                        <label style="font-size: 0.85rem; margin-bottom: 4px; display: block;">Plan Vacacionista:</label>
                        <input type="number" id="filtroVacacionistaMin" class="swal2-input" 
                               placeholder="Mínimo" min="0"
                               style="width: 100%; margin: 0; font-size: 0.9rem;">
                    </div>
                </div>
                
                <div style="background: #f0f8ff; padding: 12px; border-radius: 6px;">
                    <p style="margin: 0; font-size: 0.8rem; color: #1976d2;">
                        💡 Deje los campos vacíos para no aplicar filtro por cantidad
                    </p>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Aplicar Filtros',
        cancelButtonText: 'Limpiar Filtros',
        confirmButtonColor: '#FF9800',
        width: '500px',
        preConfirm: () => {
            return {
                region: document.getElementById('filtroRegion').value,
                planFijoMin: parseInt(document.getElementById('filtroFijoMin').value) || null,
                planParcialMin: parseInt(document.getElementById('filtroParcialMin').value) || null,
                planVacacionistaMin: parseInt(document.getElementById('filtroVacacionistaMin').value) || null
            };
        }
    });
    
    if (filtros !== undefined) {
        if (isDismissed) {
            // Limpiar filtros
            filteredData = [...departamentosData];
        } else {
            // Aplicar filtros
            aplicarFiltrosAvanzados(filtros);
        }
        
        currentPage = 1;
        actualizarTabla();
    }
}

// Aplicar filtros avanzados
function aplicarFiltrosAvanzados(filtros) {
    filteredData = departamentosData.filter(dept => {
        // Filtro por región
        if (filtros.region && dept.IdRegion.toString() !== filtros.region) {
            return false;
        }
        
        // Filtros por cantidad mínima
        if (filtros.planFijoMin !== null && (parseInt(dept.PlanFijo) || 0) < filtros.planFijoMin) {
            return false;
        }
        
        if (filtros.planParcialMin !== null && (parseInt(dept.PlanParcial) || 0) < filtros.planParcialMin) {
            return false;
        }
        
        if (filtros.planVacacionistaMin !== null && (parseInt(dept.PlanVacacionista) || 0) < filtros.planVacacionistaMin) {
            return false;
        }
        
        return true;
    });
    
    actualizarContadores();
}