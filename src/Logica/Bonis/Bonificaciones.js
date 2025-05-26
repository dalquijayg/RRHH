const odbc = require('odbc');
const path = require('path');
const Swal = require('sweetalert2');
const ExcelJS = require('exceljs');
const fs = require('fs');

const conexion = 'DSN=recursos2';

// Variables globales
let personalData = [];
let userData = null;
let currentSort = { column: null, direction: 'asc' };
// Función para conectar a la base de datos
async function connectionString() {
    try {
        const connection = await odbc.connect(conexion, {
            binaryAsString: true,
            bigint: 'string'
        });
        
        await connection.query('SET NAMES utf8mb4');
        await connection.query('SET character_set_results = utf8mb4');
        
        return connection;
    } catch (error) {
        console.error('Error de conexión:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar a la base de datos. Por favor intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
        throw error;
    }
}
function inicializarOrdenamiento() {
    const headers = document.querySelectorAll('.personal-table th.sortable');
    
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sortColumn = header.dataset.sort;
            ordenarTabla(sortColumn, header);
        });
    });
}
// Función principal de ordenamiento
function ordenarTabla(column, headerElement) {
    const tbody = document.getElementById('personal-tbody');
    const rows = Array.from(tbody.querySelectorAll('.empleado-row'));
    
    // Determinar dirección del ordenamiento
    let direction = 'asc';
    if (currentSort.column === column && currentSort.direction === 'asc') {
        direction = 'desc';
    }
    
    // Limpiar estilos de headers anteriores
    document.querySelectorAll('.personal-table th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc', 'sort-active');
    });
    
    // Aplicar estilos al header actual
    headerElement.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc', 'sort-active');
    
    // Ordenar las filas
    const sortedRows = rows.sort((a, b) => {
        let valueA, valueB;
        
        switch (column) {
            case 'empleado':
                valueA = a.querySelector('.empleado-nombre').textContent.trim();
                valueB = b.querySelector('.empleado-nombre').textContent.trim();
                return direction === 'asc' 
                    ? valueA.localeCompare(valueB, 'es', { sensitivity: 'base' })
                    : valueB.localeCompare(valueA, 'es', { sensitivity: 'base' });
                    
            case 'puesto':
                valueA = a.querySelector('.empleado-puesto').textContent.trim();
                valueB = b.querySelector('.empleado-puesto').textContent.trim();
                return direction === 'asc' 
                    ? valueA.localeCompare(valueB, 'es', { sensitivity: 'base' })
                    : valueB.localeCompare(valueA, 'es', { sensitivity: 'base' });
                    
            case 'bonificacion':
                valueA = parseFloat(a.querySelector('.input-bonificacion').value) || 0;
                valueB = parseFloat(b.querySelector('.input-bonificacion').value) || 0;
                return direction === 'asc' ? valueA - valueB : valueB - valueA;
                
            case 'credito':
                valueA = parseFloat(a.querySelector('.input-credito').value) || 0;
                valueB = parseFloat(b.querySelector('.input-credito').value) || 0;
                return direction === 'asc' ? valueA - valueB : valueB - valueA;
                
            case 'vale':
                valueA = parseFloat(a.querySelector('.input-vale').value) || 0;
                valueB = parseFloat(b.querySelector('.input-vale').value) || 0;
                return direction === 'asc' ? valueA - valueB : valueB - valueA;
                
            case 'adicional':
                valueA = parseFloat(a.querySelector('.input-adicional').value) || 0;
                valueB = parseFloat(b.querySelector('.input-adicional').value) || 0;
                return direction === 'asc' ? valueA - valueB : valueB - valueA;
                
            case 'total':
                valueA = calcularTotalFila(a);
                valueB = calcularTotalFila(b);
                return direction === 'asc' ? valueA - valueB : valueB - valueA;
                
            default:
                return 0;
        }
    });
    
    // Limpiar tbody y agregar filas ordenadas con animación
    tbody.innerHTML = '';
    
    sortedRows.forEach((row, index) => {
        row.style.animationDelay = `${index * 0.02}s`;
        row.classList.add('sort-animation');
        tbody.appendChild(row);
    });
    
    // Actualizar estado actual de ordenamiento
    currentSort = { column, direction };
    
    // Actualizar totales después del reordenamiento
    setTimeout(() => {
        actualizarTotalesGenerales();
        // Remover clases de animación
        sortedRows.forEach(row => {
            row.classList.remove('sort-animation');
        });
    }, 100);
}
// Función auxiliar para calcular total de una fila
function calcularTotalFila(row) {
    const bonificacion = parseFloat(row.querySelector('.input-bonificacion').value) || 0;
    const credito = parseFloat(row.querySelector('.input-credito').value) || 0;
    const vale = parseFloat(row.querySelector('.input-vale').value) || 0;
    const adicional = parseFloat(row.querySelector('.input-adicional').value) || 0;
    
    return bonificacion - credito - vale + adicional;
}
// Función para buscar/filtrar en la tabla
// Actualizar la función agregarFuncionalidadBusqueda()
function agregarFuncionalidadBusqueda() {
    // Ya no necesitamos crear el contenedor porque está en el HTML
    // Solo agregar los event listeners
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    
    if (searchInput && clearSearch) {
        searchInput.addEventListener('input', (e) => {
            filtrarTabla(e.target.value);
        });
        
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            filtrarTabla('');
        });
        
        // Event listener para Enter
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
        
        // Event listener para Escape
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                filtrarTabla('');
                searchInput.blur();
            }
        });
    }
}

// La función filtrarTabla() permanece igual
function filtrarTabla(searchTerm) {
    const rows = document.querySelectorAll('.empleado-row');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const empleado = row.querySelector('.empleado-nombre').textContent.toLowerCase();
        const puesto = row.querySelector('.empleado-puesto').textContent.toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        
        if (searchTerm === '' || empleado.includes(searchLower) || puesto.includes(searchLower)) {
            row.style.display = '';
            visibleCount++;
            row.classList.remove('filtered-out');
        } else {
            row.style.display = 'none';
            row.classList.add('filtered-out');
        }
    });
    
    // Actualizar contador de empleados visibles
    const totalEmpleados = document.getElementById('total-empleados');
    if (searchTerm === '') {
        totalEmpleados.textContent = `${rows.length} empleados`;
        totalEmpleados.classList.remove('filtered');
    } else {
        totalEmpleados.textContent = `${visibleCount} de ${rows.length} empleados`;
        totalEmpleados.classList.add('filtered');
    }
    
    // Efecto visual en el campo de búsqueda si no hay resultados
    const searchInput = document.getElementById('search-input');
    if (searchTerm !== '' && visibleCount === 0) {
        searchInput.style.borderColor = '#f44336';
        searchInput.style.backgroundColor = '#ffebee';
    } else {
        searchInput.style.borderColor = '#e0e0e0';
        searchInput.style.backgroundColor = '#f9f9f9';
    }
}
// Función para obtener el personal del departamento
async function obtenerPersonalDepartamento(idSucuDepa) {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT 
                personal.IdPersonal, 
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto, 
                Puestos.Nombre AS NombrePuesto
            FROM personal 
            INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto 
            WHERE personal.Estado = 1 
            AND personal.TipoPersonal = 1 
            AND IdSucuDepa = ?
            ORDER BY NombreCompleto
        `, [idSucuDepa]);
        
        await connection.close();
        return result;
    } catch (error) {
        console.error('Error al obtener personal:', error);
        throw error;
    }
}

// Función para guardar bonificaciones en la base de datos
async function guardarBonificaciones(bonificaciones, mes, anio) {
    try {
        const connection = await connectionString();
        
        // Iniciar transacción
        await connection.query('START TRANSACTION');
        
        try {
            for (const bonificacion of bonificaciones) {
                // Verificar si ya existe un registro para este empleado en este mes/año
                const existeRegistro = await connection.query(`
                    SELECT IdBonificacion FROM bonificaciones 
                    WHERE IdPersonal = ? AND Mes = ? AND Anio = ?
                `, [bonificacion.IdPersonal, mes, anio]);
                
                if (existeRegistro.length > 0) {
                    // Actualizar registro existente
                    await connection.query(`
                        UPDATE bonificaciones SET 
                            MontoBonificacion = ?,
                            DescuentoCredito = ?,
                            DescuentoVale = ?,
                            NoDocumento = ?,
                            NoVale = ?,
                            MontoAdicional = ?,
                            ObservacionesAdicional = ?,
                            Total = ?,
                            FechaModificacion = NOW(),
                            UsuarioModificacion = ?
                        WHERE IdBonificacion = ?
                    `, [
                        bonificacion.MontoBonificacion || 0,
                        bonificacion.DescuentoCredito || 0,
                        bonificacion.DescuentoVale || 0,
                        bonificacion.NoDocumento || null,
                        bonificacion.NoVale || null,
                        bonificacion.MontoAdicional || 0,
                        bonificacion.ObservacionesAdicional || null,
                        bonificacion.Total,
                        userData.IdPersonal,
                        existeRegistro[0].IdBonificacion
                    ]);
                } else {
                    // Insertar nuevo registro
                    await connection.query(`
                        INSERT INTO bonificaciones (
                            IdPersonal, Mes, Anio, MontoBonificacion, DescuentoCredito, 
                            DescuentoVale, NoDocumento, NoVale, MontoAdicional, 
                            ObservacionesAdicional, Total, FechaCreacion, UsuarioCreacion
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
                    `, [
                        bonificacion.IdPersonal,
                        mes,
                        anio,
                        bonificacion.MontoBonificacion || 0,
                        bonificacion.DescuentoCredito || 0,
                        bonificacion.DescuentoVale || 0,
                        bonificacion.NoDocumento || null,
                        bonificacion.NoVale || null,
                        bonificacion.MontoAdicional || 0,
                        bonificacion.ObservacionesAdicional || null,
                        bonificacion.Total,
                        userData.IdPersonal
                    ]);
                }
            }
            
            // Confirmar transacción
            await connection.query('COMMIT');
            await connection.close();
            return true;
        } catch (error) {
            // Revertir transacción en caso de error
            await connection.query('ROLLBACK');
            await connection.close();
            throw error;
        }
    } catch (error) {
        console.error('Error al guardar bonificaciones:', error);
        throw error;
    }
}

// Función para cargar bonificaciones existentes
async function cargarBonificacionesExistentes(mes, anio, idSucuDepa) {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT 
                b.IdPersonal,
                b.MontoBonificacion,
                b.DescuentoCredito,
                b.DescuentoVale,
                b.NoDocumento,
                b.NoVale,
                b.MontoAdicional,
                b.ObservacionesAdicional,
                b.Total
            FROM bonificaciones b
            INNER JOIN personal p ON b.IdPersonal = p.IdPersonal
            WHERE b.Mes = ? AND b.Anio = ? AND p.IdSucuDepa = ?
        `, [mes, anio, idSucuDepa]);
        
        await connection.close();
        return result;
    } catch (error) {
        console.error('Error al cargar bonificaciones existentes:', error);
        return [];
    }
}

// Función para inicializar los selectores de año
function inicializarSelectores() {
    const anioSelector = document.getElementById('anio-selector');
    const mesSelector = document.getElementById('mes-selector');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Llenar selector de años (desde 2020 hasta año actual + 1)
    anioSelector.innerHTML = '<option value="">Seleccionar</option>';
    for (let year = 2020; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        anioSelector.appendChild(option);
    }
    
    // Seleccionar mes actual por defecto
    mesSelector.value = currentMonth;
    
    // Habilitar botón si ya hay selecciones
    verificarFiltros();
}

// Función para verificar si los filtros están completos
function verificarFiltros() {
    const mes = document.getElementById('mes-selector').value;
    const anio = document.getElementById('anio-selector').value;
    const botonGenerar = document.getElementById('generar-detalle');
    
    botonGenerar.disabled = !mes || !anio;
}

// Función para mostrar loading
function mostrarLoading(show = true) {
    const loadingSection = document.getElementById('loading-section');
    const personalSection = document.getElementById('personal-section');
    
    if (show) {
        loadingSection.style.display = 'block';
        personalSection.style.display = 'none';
    } else {
        loadingSection.style.display = 'none';
    }
}

// Función para crear una fila de empleado en la tabla
function crearFilaEmpleado(empleado, bonificacionExistente = null) {
    const template = document.getElementById('empleado-row-template');
    const clone = template.content.cloneNode(true);
    
    const row = clone.querySelector('.empleado-row');
    row.setAttribute('data-id', empleado.IdPersonal);
    
    // Llenar información del empleado
    clone.querySelector('.empleado-nombre').textContent = empleado.NombreCompleto;
    clone.querySelector('.empleado-puesto').textContent = empleado.NombrePuesto;
    
    // Si hay bonificación existente, llenar los campos
    if (bonificacionExistente) {
        clone.querySelector('.input-bonificacion').value = bonificacionExistente.MontoBonificacion || '';
        clone.querySelector('.input-credito').value = bonificacionExistente.DescuentoCredito || '';
        clone.querySelector('.input-vale').value = bonificacionExistente.DescuentoVale || '';
        clone.querySelector('.input-documento').value = bonificacionExistente.NoDocumento || '';
        clone.querySelector('.input-no-vale').value = bonificacionExistente.NoVale || '';
        clone.querySelector('.input-adicional').value = bonificacionExistente.MontoAdicional || '';
        clone.querySelector('.input-observaciones').value = bonificacionExistente.ObservacionesAdicional || '';
        
        // Calcular y mostrar total
        actualizarTotalFila(row);
    }
    
    // Agregar event listeners para cálculos automáticos
    const inputs = clone.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            actualizarTotalFila(row);
            actualizarTotalesGenerales();
            validarCamposAdicionales(row);
        });
    });
    
    // Event listener para observaciones
    clone.querySelector('.input-observaciones').addEventListener('input', () => {
        validarCamposAdicionales(row);
    });
    
    return clone;
}

// Función para actualizar el total de una fila
function actualizarTotalFila(row) {
    const bonificacion = parseFloat(row.querySelector('.input-bonificacion').value) || 0;
    const credito = parseFloat(row.querySelector('.input-credito').value) || 0;
    const vale = parseFloat(row.querySelector('.input-vale').value) || 0;
    const adicional = parseFloat(row.querySelector('.input-adicional').value) || 0;
    
    const total = bonificacion - credito - vale + adicional;
    
    const totalElement = row.querySelector('.total-amount');
    totalElement.textContent = `Q${total.toFixed(2)}`;
    
    // Cambiar color según el total
    if (total > 0) {
        totalElement.style.color = '#4CAF50';
    } else if (total < 0) {
        totalElement.style.color = '#f44336';
    } else {
        totalElement.style.color = '#FFC107';
    }
}

// Función para actualizar los totales generales
function actualizarTotalesGenerales() {
    const empleadoRows = document.querySelectorAll('.empleado-row');
    let totalBonificaciones = 0;
    let totalCreditos = 0;
    let totalVales = 0;
    let totalAdicionales = 0;
    let totalFinal = 0;
    
    empleadoRows.forEach(row => {
        const bonificacion = parseFloat(row.querySelector('.input-bonificacion').value) || 0;
        const credito = parseFloat(row.querySelector('.input-credito').value) || 0;
        const vale = parseFloat(row.querySelector('.input-vale').value) || 0;
        const adicional = parseFloat(row.querySelector('.input-adicional').value) || 0;
        
        totalBonificaciones += bonificacion;
        totalCreditos += credito;
        totalVales += vale;
        totalAdicionales += adicional;
        totalFinal += bonificacion - credito - vale + adicional;
    });
    
    // Actualizar elementos de totales
    document.getElementById('total-bonificaciones').innerHTML = `<strong>Q${totalBonificaciones.toFixed(2)}</strong>`;
    document.getElementById('total-creditos').innerHTML = `<strong>Q${totalCreditos.toFixed(2)}</strong>`;
    document.getElementById('total-vales').innerHTML = `<strong>Q${totalVales.toFixed(2)}</strong>`;
    document.getElementById('total-adicionales').innerHTML = `<strong>Q${totalAdicionales.toFixed(2)}</strong>`;
    document.getElementById('total-final').innerHTML = `<strong>Q${totalFinal.toFixed(2)}</strong>`;
    document.getElementById('total-general').textContent = `Total: Q${totalFinal.toFixed(2)}`;
    
    // Habilitar/deshabilitar botones según si hay datos
    const hayDatos = Array.from(empleadoRows).some(row => {
        return parseFloat(row.querySelector('.input-bonificacion').value) || 0 > 0 ||
               parseFloat(row.querySelector('.input-credito').value) || 0 > 0 ||
               parseFloat(row.querySelector('.input-vale').value) || 0 > 0 ||
               parseFloat(row.querySelector('.input-adicional').value) || 0 > 0;
    });
    
    document.getElementById('guardar-bonificaciones').disabled = !hayDatos;
}

// Función para validar campos adicionales
function validarCamposAdicionales(row) {
    const adicional = parseFloat(row.querySelector('.input-adicional').value) || 0;
    const observaciones = row.querySelector('.input-observaciones').value.trim();
    
    if (adicional > 0 && !observaciones) {
        row.querySelector('.input-observaciones').style.borderColor = '#f44336';
        row.querySelector('.input-observaciones').style.backgroundColor = '#ffebee';
    } else if (adicional < 0 && !observaciones) {
        row.querySelector('.input-observaciones').style.borderColor = '#f44336';
        row.querySelector('.input-observaciones').style.backgroundColor = '#ffebee';
    } else {
        row.querySelector('.input-observaciones').style.borderColor = '#e0e0e0';
        row.querySelector('.input-observaciones').style.backgroundColor = '#fff';
    }
}

// Función para generar el detalle del personal
async function generarDetalle() {
    const mes = document.getElementById('mes-selector').value;
    const anio = document.getElementById('anio-selector').value;
    
    if (!mes || !anio) {
        await Swal.fire({
            icon: 'warning',
            title: 'Campos requeridos',
            text: 'Por favor seleccione el mes y año.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    mostrarLoading(true);
    
    try {
        // Obtener personal del departamento del usuario
        personalData = await obtenerPersonalDepartamento(userData.IdSucuDepa);
        
        if (personalData.length === 0) {
            mostrarLoading(false);
            await Swal.fire({
                icon: 'info',
                title: 'Sin personal',
                text: 'No se encontró personal activo en su departamento.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Cargar bonificaciones existentes para este mes/año
        const bonificacionesExistentes = await cargarBonificacionesExistentes(mes, anio, userData.IdSucuDepa);
        
        // Crear un mapa de bonificaciones existentes por IdPersonal
        const bonificacionesMap = {};
        bonificacionesExistentes.forEach(bonificacion => {
            bonificacionesMap[bonificacion.IdPersonal] = bonificacion;
        });
        
        // Mostrar sección de personal
        mostrarLoading(false);
        inicializarOrdenamiento();
        agregarFuncionalidadBusqueda();
        document.getElementById('personal-section').style.display = 'block';
        
        // Actualizar contador de empleados
        document.getElementById('total-empleados').textContent = `${personalData.length} empleados`;
        
        // Limpiar tabla anterior
        const tbody = document.getElementById('personal-tbody');
        tbody.innerHTML = '';
        
        // Crear filas para cada empleado
        personalData.forEach((empleado, index) => {
            const bonificacionExistente = bonificacionesMap[empleado.IdPersonal];
            const fila = crearFilaEmpleado(empleado, bonificacionExistente);
            
            // Agregar animación escalonada
            setTimeout(() => {
                tbody.appendChild(fila);
                actualizarTotalesGenerales();
            }, index * 50);
        });
        
        // Mostrar mensaje de éxito
        await Swal.fire({
            icon: 'success',
            title: 'Personal cargado',
            text: `Se cargaron ${personalData.length} empleados del departamento.`,
            timer: 2000,
            showConfirmButton: false
        });
        
    } catch (error) {
        mostrarLoading(false);
        console.error('Error al generar detalle:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al cargar el personal. Intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para recopilar datos de bonificaciones
function recopilarDatosBonificaciones() {
    const empleadoRows = document.querySelectorAll('.empleado-row');
    const bonificaciones = [];
    let errores = [];
    
    empleadoRows.forEach(row => {
        const idPersonal = row.getAttribute('data-id');
        const bonificacion = parseFloat(row.querySelector('.input-bonificacion').value) || 0;
        const credito = parseFloat(row.querySelector('.input-credito').value) || 0;
        const vale = parseFloat(row.querySelector('.input-vale').value) || 0;
        const adicional = parseFloat(row.querySelector('.input-adicional').value) || 0;
        const observaciones = row.querySelector('.input-observaciones').value.trim();
        const documento = row.querySelector('.input-documento').value.trim();
        const noVale = row.querySelector('.input-no-vale').value.trim();
        
        // Validar que si hay monto adicional (positivo o negativo), debe haber observaciones
        if (adicional !== 0 && !observaciones) {
            const nombreEmpleado = row.querySelector('.empleado-nombre').textContent;
            errores.push(`${nombreEmpleado}: Debe proporcionar observaciones para el monto adicional.`);
        }
        
        // Solo incluir si hay algún valor
        if (bonificacion > 0 || credito > 0 || vale > 0 || adicional !== 0) {
            const total = bonificacion - credito - vale + adicional;
            
            bonificaciones.push({
                IdPersonal: parseInt(idPersonal),
                MontoBonificacion: bonificacion,
                DescuentoCredito: credito,
                DescuentoVale: vale,
                NoDocumento: documento || null,
                NoVale: noVale || null,
                MontoAdicional: adicional,
                ObservacionesAdicional: observaciones || null,
                Total: total
            });
        }
    });
    
    return { bonificaciones, errores };
}

// Función para guardar bonificaciones
async function guardarBonificacionesClick() {
    const mes = document.getElementById('mes-selector').value;
    const anio = document.getElementById('anio-selector').value;
    
    const { bonificaciones, errores } = recopilarDatosBonificaciones();
    
    if (errores.length > 0) {
        await Swal.fire({
            icon: 'error',
            title: 'Errores de validación',
            html: errores.join('<br>'),
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    if (bonificaciones.length === 0) {
        await Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay bonificaciones para guardar.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    const confirmResult = await Swal.fire({
        title: '¿Confirmar guardado?',
        html: `
            <p>Se guardarán bonificaciones para <strong>${bonificaciones.length}</strong> empleados.</p>
            <p><strong>Mes:</strong> ${document.querySelector(`#mes-selector option[value="${mes}"]`).textContent}</p>
            <p><strong>Año:</strong> ${anio}</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#f44336'
    });
    
    if (!confirmResult.isConfirmed) return;
    
    // Mostrar loading
    Swal.fire({
        title: 'Guardando...',
        html: 'Por favor espere mientras se guardan las bonificaciones.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        await guardarBonificaciones(bonificaciones, mes, anio);
        
        await Swal.fire({
            icon: 'success',
            title: '¡Guardado exitoso!',
            text: `Se guardaron las bonificaciones para ${bonificaciones.length} empleados.`,
            confirmButtonColor: '#4CAF50'
        });
        
    } catch (error) {
        console.error('Error al guardar:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: 'Hubo un problema al guardar las bonificaciones. Intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}
// Función para limpiar todos los campos
async function limpiarTodo() {
    const confirmResult = await Swal.fire({
        title: '¿Limpiar todos los campos?',
        text: 'Esta acción eliminará todos los datos ingresados.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, limpiar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f44336',
        cancelButtonColor: '#6c757d'
    });
    
    if (confirmResult.isConfirmed) {
        const empleadoRows = document.querySelectorAll('.empleado-row');
        empleadoRows.forEach(row => {
            row.querySelectorAll('input').forEach(input => {
                input.value = '';
                input.style.borderColor = '#e0e0e0';
                input.style.backgroundColor = '#fff';
            });
            actualizarTotalFila(row);
        });
        
        actualizarTotalesGenerales();
        
        await Swal.fire({
            icon: 'success',
            title: 'Campos limpiados',
            text: 'Todos los campos han sido limpiados.',
            timer: 1500,
            showConfirmButton: false
        });
    }
}

// Función para aplicar filtros rápidos en la tabla
function aplicarFiltroTabla(filtro) {
    const rows = document.querySelectorAll('.empleado-row');
    
    rows.forEach(row => {
        const nombre = row.querySelector('.empleado-nombre').textContent.toLowerCase();
        const puesto = row.querySelector('.empleado-puesto').textContent.toLowerCase();
        
        if (filtro === '' || 
            nombre.includes(filtro.toLowerCase()) || 
            puesto.includes(filtro.toLowerCase())) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Función para validar todos los campos antes de guardar
function validarTodosLosCampos() {
    const empleadoRows = document.querySelectorAll('.empleado-row');
    let errores = [];
    let advertencias = [];
    
    empleadoRows.forEach(row => {
        const nombre = row.querySelector('.empleado-nombre').textContent;
        const bonificacion = parseFloat(row.querySelector('.input-bonificacion').value) || 0;
        const credito = parseFloat(row.querySelector('.input-credito').value) || 0;
        const vale = parseFloat(row.querySelector('.input-vale').value) || 0;
        const adicional = parseFloat(row.querySelector('.input-adicional').value) || 0;
        const observaciones = row.querySelector('.input-observaciones').value.trim();
        const documento = row.querySelector('.input-documento').value.trim();
        const noVale = row.querySelector('.input-no-vale').value.trim();
        
        // Validaciones críticas (errores)
        if (adicional !== 0 && !observaciones) {
            errores.push(`${nombre}: Falta observación para monto adicional`);
        }
        
        if (credito > 0 && !documento) {
            advertencias.push(`${nombre}: Se recomienda especificar número de documento para descuento crédito`);
        }
        
        if (vale > 0 && !noVale) {
            advertencias.push(`${nombre}: Se recomienda especificar número de vale para descuento vale`);
        }
        
        // Validar montos negativos
        if (bonificacion < 0) {
            errores.push(`${nombre}: La bonificación no puede ser negativa`);
        }
        
        if (credito < 0) {
            errores.push(`${nombre}: El descuento crédito no puede ser negativo`);
        }
        
        if (vale < 0) {
            errores.push(`${nombre}: El descuento vale no puede ser negativo`);
        }
    });
    
    return { errores, advertencias };
}

// Función para resaltar campos con errores
function resaltarCamposConErrores() {
    const empleadoRows = document.querySelectorAll('.empleado-row');
    
    empleadoRows.forEach(row => {
        // Resetear estilos
        row.querySelectorAll('input').forEach(input => {
            input.classList.remove('error', 'warning');
        });
        
        const adicional = parseFloat(row.querySelector('.input-adicional').value) || 0;
        const observaciones = row.querySelector('.input-observaciones').value.trim();
        const credito = parseFloat(row.querySelector('.input-credito').value) || 0;
        const vale = parseFloat(row.querySelector('.input-vale').value) || 0;
        const documento = row.querySelector('.input-documento').value.trim();
        const noVale = row.querySelector('.input-no-vale').value.trim();
        
        // Marcar errores
        if (adicional !== 0 && !observaciones) {
            row.querySelector('.input-observaciones').classList.add('error');
        }
        
        // Marcar advertencias
        if (credito > 0 && !documento) {
            row.querySelector('.input-documento').classList.add('warning');
        }
        
        if (vale > 0 && !noVale) {
            row.querySelector('.input-no-vale').classList.add('warning');
        }
    });
}

// Función para mostrar resumen antes de guardar
function mostrarResumenGuardado(bonificaciones) {
    const totalEmpleados = bonificaciones.length;
    const totalBonificaciones = bonificaciones.reduce((sum, b) => sum + b.MontoBonificacion, 0);
    const totalDescuentos = bonificaciones.reduce((sum, b) => sum + b.DescuentoCredito + b.DescuentoVale, 0);
    const totalAdicionales = bonificaciones.reduce((sum, b) => sum + b.MontoAdicional, 0);
    const totalFinal = bonificaciones.reduce((sum, b) => sum + b.Total, 0);
    
    return `
        <div style="text-align: left; font-size: 14px;">
            <h4 style="margin-bottom: 15px; color: #654321;">Resumen de Bonificaciones</h4>
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px; font-weight: 500;">Empleados afectados:</td>
                    <td style="padding: 8px; text-align: right;"><strong>${totalEmpleados}</strong></td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px; font-weight: 500;">Total Bonificaciones:</td>
                    <td style="padding: 8px; text-align: right; color: #4CAF50;"><strong>Q${totalBonificaciones.toFixed(2)}</strong></td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px; font-weight: 500;">Total Descuentos:</td>
                    <td style="padding: 8px; text-align: right; color: #f44336;"><strong>Q${totalDescuentos.toFixed(2)}</strong></td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px; font-weight: 500;">Total Adicionales:</td>
                    <td style="padding: 8px; text-align: right; color: #FF9800;"><strong>Q${totalAdicionales.toFixed(2)}</strong></td>
                </tr>
                <tr style="border-top: 2px solid #654321; background: #f8f9fa;">
                    <td style="padding: 12px; font-weight: bold; font-size: 16px;">TOTAL FINAL:</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 16px; color: #654321;"><strong>Q${totalFinal.toFixed(2)}</strong></td>
                </tr>
            </table>
        </div>
    `;
}

// Función para copiar datos de mes anterior
async function copiarMesAnterior() {
    const mes = parseInt(document.getElementById('mes-selector').value);
    const anio = parseInt(document.getElementById('anio-selector').value);
    
    if (!mes || !anio) {
        await Swal.fire({
            icon: 'warning',
            title: 'Seleccione mes y año',
            text: 'Debe seleccionar el mes y año actual antes de copiar datos.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Calcular mes anterior
    let mesAnterior = mes - 1;
    let anioAnterior = anio;
    
    if (mesAnterior === 0) {
        mesAnterior = 12;
        anioAnterior = anio - 1;
    }
    
    const nombreMesAnterior = [
        '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ][mesAnterior];
    
    const confirmResult = await Swal.fire({
        title: '¿Copiar datos del mes anterior?',
        html: `
            <p>Se copiarán las bonificaciones de:</p>
            <p><strong>${nombreMesAnterior} ${anioAnterior}</strong></p>
            <p><small>Los datos actuales se sobrescribirán</small></p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, copiar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#FF9800'
    });
    
    if (!confirmResult.isConfirmed) return;
    
    try {
        const bonificacionesAnteriores = await cargarBonificacionesExistentes(mesAnterior, anioAnterior, userData.IdSucuDepa);
        
        if (bonificacionesAnteriores.length === 0) {
            await Swal.fire({
                icon: 'info',
                title: 'Sin datos',
                text: `No se encontraron bonificaciones para ${nombreMesAnterior} ${anioAnterior}.`,
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Aplicar datos a la tabla actual
        const empleadoRows = document.querySelectorAll('.empleado-row');
        let datosCargados = 0;
        
        empleadoRows.forEach(row => {
            const idPersonal = parseInt(row.getAttribute('data-id'));
            const bonificacionAnterior = bonificacionesAnteriores.find(b => b.IdPersonal === idPersonal);
            
            if (bonificacionAnterior) {
                row.querySelector('.input-bonificacion').value = bonificacionAnterior.MontoBonificacion || '';
                row.querySelector('.input-credito').value = bonificacionAnterior.DescuentoCredito || '';
                row.querySelector('.input-vale').value = bonificacionAnterior.DescuentoVale || '';
                row.querySelector('.input-documento').value = bonificacionAnterior.NoDocumento || '';
                row.querySelector('.input-no-vale').value = bonificacionAnterior.NoVale || '';
                row.querySelector('.input-adicional').value = bonificacionAnterior.MontoAdicional || '';
                row.querySelector('.input-observaciones').value = bonificacionAnterior.ObservacionesAdicional || '';
                
                actualizarTotalFila(row);
                datosCargados++;
            }
        });
        
        actualizarTotalesGenerales();
        
        await Swal.fire({
            icon: 'success',
            title: '¡Datos copiados!',
            text: `Se copiaron datos de ${datosCargados} empleados desde ${nombreMesAnterior} ${anioAnterior}.`,
            confirmButtonColor: '#4CAF50'
        });
        
    } catch (error) {
        console.error('Error al copiar mes anterior:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al copiar los datos del mes anterior.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    // Obtener datos del usuario del localStorage
    const userDataString = localStorage.getItem('userData');
    if (!userDataString) {
        Swal.fire({
            icon: 'error',
            title: 'Sesión no válida',
            text: 'No se encontraron datos de sesión. Será redirigido al login.',
            confirmButtonColor: '#FF9800'
        }).then(() => {
            window.location.href = path.join(__dirname, 'Login.html');
        });
        return;
    }
    
    userData = JSON.parse(userDataString);
    
    // Inicializar selectores
    inicializarSelectores();
    
    // Event listeners principales
    document.getElementById('mes-selector').addEventListener('change', verificarFiltros);
    document.getElementById('anio-selector').addEventListener('change', verificarFiltros);
    document.getElementById('generar-detalle').addEventListener('click', generarDetalle);
    document.getElementById('guardar-bonificaciones').addEventListener('click', async () => {
        // Validar campos antes de proceder
        resaltarCamposConErrores();
        const { errores, advertencias } = validarTodosLosCampos();
        
        if (errores.length > 0) {
            await Swal.fire({
                icon: 'error',
                title: 'Errores de validación',
                html: '<ul style="text-align: left;">' + errores.map(e => `<li>${e}</li>`).join('') + '</ul>',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        if (advertencias.length > 0) {
            const continuarResult = await Swal.fire({
                icon: 'warning',
                title: 'Advertencias encontradas',
                html: '<ul style="text-align: left;">' + advertencias.map(a => `<li>${a}</li>`).join('') + '</ul>',
                showCancelButton: true,
                confirmButtonText: 'Continuar',
                cancelButtonText: 'Revisar',
                confirmButtonColor: '#FF9800'
            });
            
            if (!continuarResult.isConfirmed) return;
        }
        
        guardarBonificacionesClick();
    });

    document.getElementById('limpiar-todo').addEventListener('click', limpiarTodo);
    
    // Agregar estilos CSS dinámicamente para validaciones
    const style = document.createElement('style');
    style.textContent = `
        .empleado-row {
            animation: fadeInUp 0.3s ease-out;
        }
        
        .empleado-row:nth-child(even) {
            animation-delay: 0.05s;
        }
        
        .empleado-row:nth-child(odd) {
            animation-delay: 0.1s;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .table-input.error,
        .table-input-text.error {
            border-color: #f44336 !important;
            background-color: #ffebee !important;
            animation: shake 0.5s ease-in-out;
        }
        
        .table-input.warning,
        .table-input-text.warning {
            border-color: #FF9800 !important;
            background-color: #fff3e0 !important;
        }
        
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
            20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        
        .total-amount {
            transition: all 0.3s ease;
        }
        
        .empleado-row:hover .total-amount {
            transform: scale(1.1);
            font-weight: bold;
        }
        
        .personal-table tbody tr:hover {
            background-color: #f0f8ff !important;
            transform: scale(1.01);
            transition: all 0.2s ease;
        }
        
        .loading-row {
            opacity: 0;
            animation: fadeIn 0.5s ease-out forwards;
        }
        
        @keyframes fadeIn {
            to {
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Mensaje de bienvenida
    const nombreUsuario = userData.NombreCompleto || 'Usuario';
    const departamento = userData.NombreDepartamento || 'Departamento';
    
    Swal.fire({
        title: `¡Bienvenido, ${nombreUsuario.split(' ')[0]}!`,
        html: `
            <div style="text-align: center;">
                <p>Sistema de Gestión de Bonificaciones</p>
                <p><strong>Departamento:</strong> ${departamento}</p>
                <p style="font-size: 14px; color: #777; margin-top: 15px;">
                    Seleccione el mes y año para comenzar
                </p>
            </div>
        `,
        icon: 'info',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
});

// Función para manejar teclas de acceso rápido
document.addEventListener('keydown', (event) => {
    // Ctrl + S para guardar
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        const guardarBtn = document.getElementById('guardar-bonificaciones');
        if (!guardarBtn.disabled) {
            guardarBtn.click();
        }
    }
    
    // Ctrl + L para limpiar
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        document.getElementById('limpiar-todo').click();
    }
    
    // F5 para generar detalle
    if (event.key === 'F5') {
        event.preventDefault();
        const generarBtn = document.getElementById('generar-detalle');
        if (!generarBtn.disabled) {
            generarBtn.click();
        }
    }
});

// Función para detectar cambios no guardados
let datosModificados = false;

function marcarDatosModificados() {
    datosModificados = true;
    document.title = 'Bonificaciones - Recursos Humanos *';
}

function marcarDatosGuardados() {
    datosModificados = false;
    document.title = 'Bonificaciones - Recursos Humanos';
}

// Advertir al usuario si intenta salir con cambios no guardados
window.addEventListener('beforeunload', (event) => {
    if (datosModificados) {
        event.preventDefault();
        event.returnValue = '¿Está seguro que desea salir? Los cambios no guardados se perderán.';
        return event.returnValue;
    }
});

// Función de utilidad para formatear números
function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 2
    }).format(valor);
}

// Función para auto-guardar (opcional)
let autoGuardadoTimer;

function iniciarAutoGuardado() {
    if (autoGuardadoTimer) {
        clearTimeout(autoGuardadoTimer);
    }
    
    autoGuardadoTimer = setTimeout(() => {
        if (datosModificados) {
            // Aquí podrías implementar un auto-guardado silencioso
            console.log('Auto-guardado activado (opcional)');
        }
    }, 300000); // 5 minutos
}