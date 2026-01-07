const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const Swal = require('sweetalert2');
const fs = require('fs');
const { shell } = require('electron');

// Variables globales
let datosCompletos = [];
let datosFiltrados = [];
let datosDepartamentos = [];
let userData = null;
let tabActual = 'detallado'; // Pestaña activa por defecto
let ordenActual = { column: null, direction: null, tabla: null }; // Control de ordenamiento

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar información del usuario
    cargarInformacionUsuario();
    
    // Cargar departamentos
    await cargarDepartamentos();
    
    // Cargar estados
    await cargarEstados();
    
    // Configurar fecha por defecto (último mes)
    configurarFechasPorDefecto();
    
    // Event Listeners
    configurarEventListeners();
});

// ==================== INFORMACIÓN DEL USUARIO ====================
function cargarInformacionUsuario() {
    try {
        const userDataString = localStorage.getItem('userData');
        if (userDataString) {
            userData = JSON.parse(userDataString);
            
            // Actualizar header
            document.getElementById('userName').textContent = userData.NombreCompleto || 'Usuario';
            document.getElementById('userRole').textContent = determinarRol(userData.Id_Puesto);
            
            if (userData.FotoBase64) {
                document.getElementById('userAvatar').src = userData.FotoBase64;
            }
        } else {
            // Si no hay datos de usuario, redirigir al login
            Swal.fire({
                icon: 'warning',
                title: 'Sesión no encontrada',
                text: 'Por favor, inicia sesión nuevamente.',
                confirmButtonColor: '#FF9800'
            }).then(() => {
                window.location.href = path.join(__dirname, 'Login.html');
            });
        }
    } catch (error) {
        console.error('Error al cargar información del usuario:', error);
    }
}

function determinarRol(idPuesto) {
    if (idPuesto == 5) {
        return 'Administrador RRHH';
    } else if (idPuesto == 1) {
        return 'Gerente';
    } else {
        return 'Colaborador';
    }
}

// ==================== CARGAR DEPARTAMENTOS ====================
async function cargarDepartamentos() {
    try {
        const connection = await connectionString();
        const departamentos = await connection.query(`
            SELECT DISTINCT 
                IdDepartamento, 
                NombreDepartamento 
            FROM departamentos 
            ORDER BY NombreDepartamento
        `);
        await connection.close();
        
        const select = document.getElementById('departamento');
        departamentos.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.IdDepartamento;
            option.textContent = dept.NombreDepartamento;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        mostrarError('No se pudieron cargar los departamentos');
    }
}

// ==================== CARGAR ESTADOS ====================
async function cargarEstados() {
    try {
        const connection = await connectionString();
        const estados = await connection.query(`
            SELECT 
                IdEstadoPagoPlanillaParcial, 
                NombreEstado 
            FROM PagoPlanillaParcialEstados
            ORDER BY IdEstadoPagoPlanillaParcial
        `);
        await connection.close();
        
        const select = document.getElementById('estado');
        estados.forEach(estado => {
            const option = document.createElement('option');
            option.value = estado.IdEstadoPagoPlanillaParcial;
            option.textContent = estado.NombreEstado;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar estados:', error);
        mostrarError('No se pudieron cargar los estados');
    }
}

// ==================== CONFIGURAR FECHAS POR DEFECTO ====================
function configurarFechasPorDefecto() {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    document.getElementById('fechaInicio').value = formatearFechaInput(primerDiaMes);
    document.getElementById('fechaFin').value = formatearFechaInput(ultimoDiaMes);
}

function formatearFechaInput(fecha) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==================== EVENT LISTENERS ====================
function configurarEventListeners() {
    // Pestañas
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', cambiarPestana);
    });

    // Ordenamiento de columnas
    configurarOrdenamiento();

    // Botón buscar
    document.getElementById('btnBuscar').addEventListener('click', buscarPlanillas);

    // Botón limpiar
    document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);

    // Botón exportar
    document.getElementById('btnExportar').addEventListener('click', exportarExcel);

    // Modal
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('btnCerrarModalFooter').addEventListener('click', cerrarModal);
    document.getElementById('btnExportarDetalle').addEventListener('click', exportarDetalleExcel);

    // Click fuera del modal para cerrar
    document.getElementById('modalDetalle').addEventListener('click', (e) => {
        if (e.target.id === 'modalDetalle') {
            cerrarModal();
        }
    });

    // ESC para cerrar modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModal();
        }
    });

    // Enter en los inputs para buscar
    document.querySelectorAll('.filter-input, .filter-select').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                buscarPlanillas();
            }
        });
    });
}

// ==================== CAMBIAR PESTAÑA ====================
function cambiarPestana(event) {
    const tabName = event.currentTarget.getAttribute('data-tab');

    // Actualizar botones de pestañas
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    // Actualizar contenido de pestañas
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Actualizar variable global
    tabActual = tabName;
}

// ==================== CONFIGURAR ORDENAMIENTO ====================
function configurarOrdenamiento() {
    // Event listeners para tabla de reporte detallado
    document.querySelectorAll('#tablaPlanillas .sortable').forEach(th => {
        th.addEventListener('click', function() {
            ordenarTabla(this, 'detallado');
        });
    });

    // Event listeners para tabla de departamentos
    document.querySelectorAll('#tablaDepartamentos .sortable').forEach(th => {
        th.addEventListener('click', function() {
            ordenarTabla(this, 'departamento');
        });
    });
}

// ==================== ORDENAR TABLA ====================
function ordenarTabla(th, tipoTabla) {
    const column = th.getAttribute('data-column');
    const type = th.getAttribute('data-type');

    // Determinar dirección de ordenamiento
    let direction = 'asc';
    if (ordenActual.column === column && ordenActual.tabla === tipoTabla) {
        direction = ordenActual.direction === 'asc' ? 'desc' : 'asc';
    }

    // Actualizar estado de ordenamiento
    ordenActual = { column, direction, tabla: tipoTabla };

    // Remover clases de ordenamiento de todas las columnas
    const tabla = tipoTabla === 'detallado' ? '#tablaPlanillas' : '#tablaDepartamentos';
    document.querySelectorAll(`${tabla} .sortable`).forEach(header => {
        header.classList.remove('asc', 'desc');
    });

    // Agregar clase a la columna actual
    th.classList.add(direction);

    // Ordenar datos
    if (tipoTabla === 'detallado') {
        ordenarDatosDetallado(column, direction, type);
    } else {
        ordenarDatosDepartamento(column, direction, type);
    }
}

// ==================== ORDENAR DATOS DETALLADO ====================
function ordenarDatosDetallado(column, direction, type) {
    datosFiltrados.sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];

        // Manejar valores nulos o vacíos
        if (!valueA && !valueB) return 0;
        if (!valueA) return 1;
        if (!valueB) return -1;

        // Ordenar según el tipo de dato
        if (type === 'number') {
            valueA = parseFloat(valueA) || 0;
            valueB = parseFloat(valueB) || 0;
        } else if (type === 'date') {
            valueA = new Date(valueA).getTime();
            valueB = new Date(valueB).getTime();
        } else {
            valueA = String(valueA).toLowerCase();
            valueB = String(valueB).toLowerCase();
        }

        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Volver a mostrar la tabla con los datos ordenados
    mostrarPlanillas();
}

// ==================== ORDENAR DATOS DEPARTAMENTO ====================
function ordenarDatosDepartamento(column, direction, type) {
    datosDepartamentos.sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];

        // Manejar valores nulos o vacíos
        if (!valueA && !valueB) return 0;
        if (!valueA) return 1;
        if (!valueB) return -1;

        // Ordenar según el tipo de dato
        if (type === 'number') {
            valueA = parseFloat(valueA) || 0;
            valueB = parseFloat(valueB) || 0;
        } else if (type === 'date') {
            valueA = new Date(valueA).getTime();
            valueB = new Date(valueB).getTime();
        } else {
            valueA = String(valueA).toLowerCase();
            valueB = String(valueB).toLowerCase();
        }

        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Volver a mostrar la tabla con los datos ordenados
    mostrarReporteDepartamentos();
}

// ==================== BUSCAR PLANILLAS ====================
async function buscarPlanillas() {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    const departamento = document.getElementById('departamento').value;
    const estado = document.getElementById('estado').value;
    
    // Validaciones
    if (!fechaInicio || !fechaFin) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos requeridos',
            text: 'Debes seleccionar un rango de fechas',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    if (new Date(fechaInicio) > new Date(fechaFin)) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas inválidas',
            text: 'La fecha de inicio no puede ser mayor que la fecha fin',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Mostrar loading
    Swal.fire({
        title: 'Buscando planillas...',
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem;">
                <div class="custom-spinner"></div>
                <p style="color: #666; font-size: 0.9rem; margin: 0;">Por favor espera mientras cargamos los datos</p>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false,
        customClass: {
            popup: 'loading-popup'
        }
    });
    
    try {
        const connection = await connectionString();
        
        // Construir query dinámicamente
        let query = `
            SELECT
                PagoPlanillaParcial.IdPlanillaParcial, 
                departamentos.NombreDepartamento, 
                PagoPlanillaParcial.MontoPlanillaParcial, 
                PagoPlanillaParcial.CantidadColaboradores, 
                PagoPlanillaParcial.PeriodoPago, 
                PagoPlanillaParcial.NombreUsuario, 
                PagoPlanillaParcial.FechaHoraRegistro, 
                PagoPlanillaParcialEstados.NombreEstado,
                PagoPlanillaParcialEstados.IdEstadoPagoPlanillaParcial,
                PagoPlanillaParcial.NombreUsuarioAutoriza, 
                PagoPlanillaParcial.FechaHoraAutorizacion, 
                PagoPlanillaParcial.MotivoRechazo
            FROM
                PagoPlanillaParcial
                INNER JOIN departamentos
                    ON PagoPlanillaParcial.IdDepartamentoSucursal = departamentos.IdDepartamento
                INNER JOIN PagoPlanillaParcialEstados
                    ON PagoPlanillaParcial.Estado = PagoPlanillaParcialEstados.IdEstadoPagoPlanillaParcial
                INNER JOIN PagoPlanillaParcialDetalle
                    ON PagoPlanillaParcial.IdPlanillaParcial = PagoPlanillaParcialDetalle.IdPlanillaParcial
            WHERE
                PagoPlanillaParcialDetalle.FechaLaborada BETWEEN ? AND ?
        `;
        
        const params = [fechaInicio, fechaFin];
        
        if (departamento) {
            query += ` AND PagoPlanillaParcial.IdDepartamentoSucursal = ?`;
            params.push(departamento);
        }
        
        if (estado) {
            query += ` AND PagoPlanillaParcial.Estado = ?`;
            params.push(estado);
        }
        
        query += ` GROUP BY PagoPlanillaParcial.IdPlanillaParcial ORDER BY PagoPlanillaParcial.FechaHoraRegistro DESC`;
        
        const resultado = await connection.query(query, params);
        await connection.close();
        
        Swal.close();
        
        if (resultado.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: 'No se encontraron planillas con los filtros seleccionados',
                confirmButtonColor: '#FF9800'
            });
            
            // Limpiar tabla
            datosCompletos = [];
            datosFiltrados = [];
            mostrarPlanillas();
            return;
        }
        
        // Guardar datos
        datosCompletos = resultado;
        datosFiltrados = resultado;

        // Consultar reporte por departamento
        await buscarReporteDepartamento(fechaInicio, fechaFin, departamento, estado);

        // Mostrar resultados
        mostrarPlanillas();
        mostrarResumen();

        // Habilitar botón de exportar
        document.getElementById('btnExportar').disabled = false;
        
    } catch (error) {
        console.error('Error al buscar planillas:', error);
        Swal.close();
        mostrarError('Error al buscar las planillas');
    }
}

// ==================== BUSCAR REPORTE POR DEPARTAMENTO ====================
async function buscarReporteDepartamento(fechaInicio, fechaFin, departamento, estado) {
    try {
        const connection = await connectionString();

        // Construir query dinámicamente
        let query = `
            SELECT
                PPP.IdDepartamentoSucursal,
                D.NombreDepartamento,
                COUNT(DISTINCT PPP.IdPlanillaParcial) AS CantidadPlanillas,
                SUM(DISTINCT PPP.MontoPlanillaParcial) AS MontoTotalPlanillas,
                SUM(CASE WHEN PPD.IdTipoTurno = 1 THEN 1 ELSE 0 END) AS TurnoManana,
                SUM(CASE WHEN PPD.IdTipoTurno = 2 THEN 1 ELSE 0 END) AS TurnoMixto,
                SUM(CASE WHEN PPD.IdTipoTurno = 3 THEN 1 ELSE 0 END) AS Turno4Horas,
                COUNT(PPD.IdTipoTurno) AS TotalTurnos
            FROM PagoPlanillaParcial PPP
            INNER JOIN departamentos D
                ON PPP.IdDepartamentoSucursal = D.IdDepartamento
            INNER JOIN PagoPlanillaParcialDetalle PPD
                ON PPP.IdPlanillaParcial = PPD.IdPlanillaParcial
            WHERE PPD.FechaLaborada BETWEEN ? AND ?
        `;

        const params = [fechaInicio, fechaFin];

        if (departamento) {
            query += ` AND PPP.IdDepartamentoSucursal = ?`;
            params.push(departamento);
        }

        if (estado) {
            query += ` AND PPP.Estado = ?`;
            params.push(estado);
        }

        query += `
            GROUP BY
                PPP.IdDepartamentoSucursal,
                D.NombreDepartamento
            ORDER BY
                MontoTotalPlanillas DESC
        `;

        const resultado = await connection.query(query, params);
        await connection.close();

        // Guardar datos
        datosDepartamentos = resultado;

        // Mostrar en tabla
        mostrarReporteDepartamentos();

    } catch (error) {
        console.error('Error al buscar reporte por departamento:', error);
        datosDepartamentos = [];
        mostrarReporteDepartamentos();
    }
}

// ==================== MOSTRAR REPORTE POR DEPARTAMENTO ====================
function mostrarReporteDepartamentos() {
    const tbody = document.getElementById('tablaDepartamentosBody');
    const tfoot = document.getElementById('tablaDepartamentosFoot');
    tbody.innerHTML = '';

    if (datosDepartamentos.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="8">
                    <div class="no-data-message">
                        <i class="fas fa-inbox"></i>
                        <p>No hay datos para mostrar</p>
                    </div>
                </td>
            </tr>
        `;

        tfoot.style.display = 'none';
        document.getElementById('recordCountDept').textContent = '0 registros';
        return;
    }

    // Variables para totales
    let totalPlanillas = 0;
    let totalMonto = 0;
    let totalManana = 0;
    let totalMixto = 0;
    let total4H = 0;
    let totalTurnos = 0;

    // Mostrar datos
    datosDepartamentos.forEach(dept => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td style="text-align: center;">${dept.IdDepartamentoSucursal}</td>
            <td>${dept.NombreDepartamento}</td>
            <td style="text-align: center;">${dept.CantidadPlanillas}</td>
            <td style="text-align: right;">${formatearMoneda(dept.MontoTotalPlanillas)}</td>
            <td style="text-align: center;">${dept.TurnoManana}</td>
            <td style="text-align: center;">${dept.TurnoMixto}</td>
            <td style="text-align: center;">${dept.Turno4Horas}</td>
            <td style="text-align: center;">${dept.TotalTurnos}</td>
        `;
        tbody.appendChild(tr);

        // Acumular totales
        totalPlanillas += parseInt(dept.CantidadPlanillas || 0);
        totalMonto += parseFloat(dept.MontoTotalPlanillas || 0);
        totalManana += parseInt(dept.TurnoManana || 0);
        totalMixto += parseInt(dept.TurnoMixto || 0);
        total4H += parseInt(dept.Turno4Horas || 0);
        totalTurnos += parseInt(dept.TotalTurnos || 0);
    });

    // Actualizar pie de tabla con totales
    document.getElementById('totalPlanillasDept').textContent = totalPlanillas;
    document.getElementById('totalMontoDept').textContent = formatearMoneda(totalMonto);
    document.getElementById('totalTurnoManana').textContent = totalManana;
    document.getElementById('totalTurnoMixto').textContent = totalMixto;
    document.getElementById('totalTurno4H').textContent = total4H;
    document.getElementById('totalTurnosTodos').textContent = totalTurnos;

    tfoot.style.display = '';

    // Actualizar contador
    document.getElementById('recordCountDept').textContent = `${datosDepartamentos.length} departamento${datosDepartamentos.length !== 1 ? 's' : ''}`;
}

// ==================== MOSTRAR PLANILLAS EN TABLA ====================
function mostrarPlanillas() {
    const tbody = document.getElementById('tablaPlanillasBody');
    tbody.innerHTML = '';

    if (datosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="11">
                    <div class="no-data-message">
                        <i class="fas fa-inbox"></i>
                        <p>No hay planillas para mostrar</p>
                    </div>
                </td>
            </tr>
        `;

        // Ocultar resumen
        document.getElementById('resultsSummary').style.display = 'none';
        document.getElementById('recordCount').textContent = '0 registros';

        return;
    }

    // Mostrar TODOS los datos (sin paginación)
    datosFiltrados.forEach(planilla => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${planilla.IdPlanillaParcial}</td>
            <td>${planilla.NombreDepartamento}</td>
            <td>${planilla.PeriodoPago || 'N/A'}</td>
            <td style="text-align: center;">${planilla.CantidadColaboradores}</td>
            <td style="text-align: right;">${formatearMoneda(planilla.MontoPlanillaParcial)}</td>
            <td>${obtenerBadgeEstado(planilla.NombreEstado, planilla.IdEstadoPagoPlanillaParcial)}</td>
            <td>${planilla.NombreUsuario || 'N/A'}</td>
            <td>${formatearFechaHora(planilla.FechaHoraRegistro)}</td>
            <td>${planilla.NombreUsuarioAutoriza || 'N/A'}</td>
            <td>${planilla.FechaHoraAutorizacion ? formatearFechaHora(planilla.FechaHoraAutorizacion) : 'N/A'}</td>
            <td>
                <div style="display: flex; gap: 0.3rem; justify-content: center;">
                    <button class="btn-action" onclick="verDetalle(${planilla.IdPlanillaParcial})" title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${planilla.IdEstadoPagoPlanillaParcial == 3 ? `
                        <button class="btn-action btn-action-pdf" onclick="verPDF(${planilla.IdPlanillaParcial})" title="Ver documento PDF">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Actualizar contador
    document.getElementById('recordCount').textContent = `${datosFiltrados.length} registro${datosFiltrados.length !== 1 ? 's' : ''}`;
}
async function verPDF(idPlanilla) {
    try {
        // Mostrar loading
        Swal.fire({
            title: 'Cargando...',
            text: 'Buscando documento PDF',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Consultar documento PDF
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                DocumentosPlanillasParciales.NombreArchivo, 
                DocumentosPlanillasParciales.DocumentoPDF, 
                DocumentosPlanillasParciales.FechaSubida, 
                DocumentosPlanillasParciales.NombreUsuario
            FROM
                DocumentosPlanillasParciales
            WHERE
                DocumentosPlanillasParciales.IdPlanillaParcial = ?
        `, [idPlanilla]);
        await connection.close();
        
        if (result.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Documento no encontrado',
                text: 'No se encontró ningún documento PDF para esta planilla.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        const documento = result[0];
        
        // Cerrar loading
        Swal.close();
        
        // Mostrar opciones al usuario
        const resultado = await Swal.fire({
            title: 'Documento PDF encontrado',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>Nombre del archivo:</strong> ${documento.NombreArchivo}</p>
                    <p><strong>Fecha de subida:</strong> ${formatearFechaHora(documento.FechaSubida)}</p>
                    <p><strong>Subido por:</strong> ${documento.NombreUsuario}</p>
                </div>
            `,
            icon: 'info',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '<i class="fas fa-eye"></i> Ver PDF',
            denyButtonText: '<i class="fas fa-download"></i> Descargar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#448AFF',
            denyButtonColor: '#4CAF50',
            cancelButtonColor: '#6c757d'
        });
        
        if (resultado.isConfirmed) {
            // Ver PDF en nueva ventana
            mostrarPDFEnVentana(documento.DocumentoPDF, documento.NombreArchivo);
        } else if (resultado.isDenied) {
            // Descargar PDF
            descargarPDF(documento.DocumentoPDF, documento.NombreArchivo);
        }
        
    } catch (error) {
        console.error('Error al cargar PDF:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al cargar el documento PDF',
            confirmButtonColor: '#FF9800'
        });
    }
}

function mostrarPDFEnVentana(documentoPDF, nombreArchivo) {
    try {
        // Crear URL del blob
        const byteCharacters = atob(documentoPDF);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Abrir en nueva ventana
        const ventana = window.open(url, '_blank');
        if (!ventana) {
            // Si el popup fue bloqueado, mostrar alternativa
            Swal.fire({
                icon: 'warning',
                title: 'Popup bloqueado',
                text: 'Tu navegador bloqueó la ventana emergente. Haz clic en "Descargar" para obtener el archivo.',
                showCancelButton: true,
                confirmButtonText: 'Descargar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#4CAF50'
            }).then((result) => {
                if (result.isConfirmed) {
                    descargarPDF(documentoPDF, nombreArchivo);
                }
            });
        } else {
            // Limpiar la URL después de un tiempo
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 60000); // 1 minuto
        }
        
    } catch (error) {
        console.error('Error al mostrar PDF:', error);
        mostrarError('Error al mostrar el PDF. Intenta descargarlo.');
    }
}

function descargarPDF(documentoPDF, nombreArchivo) {
    try {
        // Crear URL del blob
        const byteCharacters = atob(documentoPDF);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Crear enlace temporal para descarga
        const link = document.createElement('a');
        link.href = url;
        link.download = nombreArchivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Limpiar la URL
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
        
        Swal.fire({
            icon: 'success',
            title: 'Descarga iniciada',
            text: 'El archivo se está descargando',
            confirmButtonColor: '#4CAF50',
            timer: 2000
        });
        
    } catch (error) {
        console.error('Error al descargar PDF:', error);
        mostrarError('Error al descargar el PDF');
    }
}
// ==================== MOSTRAR RESUMEN ====================
function mostrarResumen() {
    const totalPlanillas = datosFiltrados.length;
    const totalColaboradores = datosFiltrados.reduce((sum, p) => sum + parseInt(p.CantidadColaboradores || 0), 0);
    const montoTotal = datosFiltrados.reduce((sum, p) => sum + parseFloat(p.MontoPlanillaParcial || 0), 0);

    document.getElementById('totalPlanillas').textContent = totalPlanillas;
    document.getElementById('totalColaboradores').textContent = totalColaboradores;
    document.getElementById('montoTotal').textContent = formatearMoneda(montoTotal);

    document.getElementById('resultsSummary').style.display = 'flex';
}


// ==================== VER DETALLE ====================
async function verDetalle(idPlanilla) {
    try {
        // Mostrar loading
        Swal.fire({
            title: 'Cargando detalle...',
            html: '<div class="loading-spinner" style="margin: 20px auto;"></div>',
            showConfirmButton: false,
            allowOutsideClick: false
        });
        
        const connection = await connectionString();
        
        // Obtener información de la planilla
        const planillaInfo = await connection.query(`
            SELECT
                PagoPlanillaParcial.IdPlanillaParcial, 
                departamentos.NombreDepartamento, 
                PagoPlanillaParcial.MontoPlanillaParcial, 
                PagoPlanillaParcial.CantidadColaboradores, 
                PagoPlanillaParcial.PeriodoPago, 
                PagoPlanillaParcial.NombreUsuario, 
                PagoPlanillaParcial.FechaHoraRegistro, 
                PagoPlanillaParcialEstados.NombreEstado,
                PagoPlanillaParcialEstados.IdEstadoPagoPlanillaParcial,
                PagoPlanillaParcial.NombreUsuarioAutoriza, 
                PagoPlanillaParcial.FechaHoraAutorizacion, 
                PagoPlanillaParcial.MotivoRechazo
            FROM
                PagoPlanillaParcial
                INNER JOIN departamentos
                    ON PagoPlanillaParcial.IdDepartamentoSucursal = departamentos.IdDepartamento
                INNER JOIN PagoPlanillaParcialEstados
                    ON PagoPlanillaParcial.Estado = PagoPlanillaParcialEstados.IdEstadoPagoPlanillaParcial
            WHERE
                PagoPlanillaParcial.IdPlanillaParcial = ?
        `, [idPlanilla]);
        
        // Obtener detalle de pagos
        const detalle = await connection.query(`
            SELECT
                NombrePersonal, 
                FechaLaborada, 
                IdTipoTurno, 
                TipoTurno, 
                MontoPagado
            FROM
                PagoPlanillaParcialDetalle
            WHERE
                IdPlanillaParcial = ?
            ORDER BY FechaLaborada DESC, NombrePersonal
        `, [idPlanilla]);
        
        await connection.close();
        Swal.close();
        
        if (planillaInfo.length === 0) {
            mostrarError('No se encontró la planilla');
            return;
        }
        
        const planilla = planillaInfo[0];
        
        // Llenar información del modal
        document.getElementById('modalIdPlanilla').textContent = planilla.IdPlanillaParcial;
        document.getElementById('modalDepartamento').textContent = planilla.NombreDepartamento;
        document.getElementById('modalPeriodo').textContent = planilla.PeriodoPago || 'N/A';
        document.getElementById('modalEstado').textContent = planilla.NombreEstado;
        document.getElementById('modalEstado').className = `estado-badge ${obtenerClaseEstado(planilla.IdEstadoPagoPlanillaParcial)}`;
        document.getElementById('modalColaboradores').textContent = planilla.CantidadColaboradores;
        document.getElementById('modalMontoTotal').textContent = formatearMoneda(planilla.MontoPlanillaParcial);
        document.getElementById('modalUsuarioRegistro').textContent = planilla.NombreUsuario || 'N/A';
        document.getElementById('modalFechaRegistro').textContent = formatearFechaHora(planilla.FechaHoraRegistro);
        
        // Información de autorización
        const autorizacionRow = document.getElementById('autorizacionRow');
        if (planilla.NombreUsuarioAutoriza) {
            document.getElementById('modalUsuarioAutoriza').textContent = planilla.NombreUsuarioAutoriza;
            document.getElementById('modalFechaAutoriza').textContent = formatearFechaHora(planilla.FechaHoraAutorizacion);
            autorizacionRow.style.display = 'flex';
        } else {
            autorizacionRow.style.display = 'none';
        }
        
        // Motivo de rechazo
        const rechazoRow = document.getElementById('rechazoRow');
        if (planilla.MotivoRechazo) {
            document.getElementById('modalMotivoRechazo').textContent = planilla.MotivoRechazo;
            rechazoRow.style.display = 'flex';
        } else {
            rechazoRow.style.display = 'none';
        }
        
        // Llenar tabla de detalle
        const tbody = document.getElementById('tablaDetalleBody');
        tbody.innerHTML = '';
        
        let totalDetalle = 0;
        
        detalle.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.NombrePersonal}</td>
                <td>${formatearFecha(item.FechaLaborada)}</td>
                <td style="text-align: center;">${item.IdTipoTurno}</td>
                <td>${item.TipoTurno}</td>
                <td style="text-align: right;">${formatearMoneda(item.MontoPagado)}</td>
            `;
            tbody.appendChild(tr);
            totalDetalle += parseFloat(item.MontoPagado || 0);
        });
        
        document.getElementById('totalDetalle').textContent = formatearMoneda(totalDetalle);
        
        // Guardar ID de planilla actual para exportar
        document.getElementById('btnExportarDetalle').setAttribute('data-planilla-id', idPlanilla);
        
        // Mostrar modal
        document.getElementById('modalDetalle').classList.add('active');
        
    } catch (error) {
        console.error('Error al cargar detalle:', error);
        Swal.close();
        mostrarError('Error al cargar el detalle de la planilla');
    }
}

// ==================== CERRAR MODAL ====================
function cerrarModal() {
    document.getElementById('modalDetalle').classList.remove('active');
}

// ==================== LIMPIAR FILTROS ====================
function limpiarFiltros() {
    configurarFechasPorDefecto();
    document.getElementById('departamento').value = '';
    document.getElementById('estado').value = '';

    // Limpiar resultados de ambas pestañas
    datosCompletos = [];
    datosFiltrados = [];
    datosDepartamentos = [];

    // Limpiar tabla de reporte detallado
    document.getElementById('tablaPlanillasBody').innerHTML = `
        <tr class="no-data">
            <td colspan="11">
                <div class="no-data-message">
                    <i class="fas fa-search"></i>
                    <p>Utiliza los filtros para buscar planillas</p>
                </div>
            </td>
        </tr>
    `;

    // Limpiar tabla de reporte por departamento
    document.getElementById('tablaDepartamentosBody').innerHTML = `
        <tr class="no-data">
            <td colspan="8">
                <div class="no-data-message">
                    <i class="fas fa-search"></i>
                    <p>Utiliza los filtros para buscar planillas</p>
                </div>
            </td>
        </tr>
    `;
    document.getElementById('tablaDepartamentosFoot').style.display = 'none';

    document.getElementById('resultsSummary').style.display = 'none';
    document.getElementById('recordCount').textContent = '0 registros';
    document.getElementById('recordCountDept').textContent = '0 registros';
    document.getElementById('btnExportar').disabled = true;
}

// ==================== EXPORTAR A EXCEL ====================
async function exportarExcel() {
    // Determinar qué reporte exportar según la pestaña activa
    if (tabActual === 'detallado') {
        await exportarExcelDetallado();
    } else if (tabActual === 'departamento') {
        await exportarExcelDepartamento();
    }
}

// ==================== EXPORTAR REPORTE DETALLADO A EXCEL ====================
async function exportarExcelDetallado() {
    if (datosFiltrados.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay datos para exportar',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    try {
        const ExcelJS = require('exceljs');
        const { dialog } = require('electron').remote;
        
        // Crear libro de trabajo
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Planillas Parciales');
        
        // Configurar columnas
        worksheet.columns = [
            { header: 'ID Planilla', key: 'idPlanilla', width: 15 },
            { header: 'Departamento', key: 'departamento', width: 30 },
            { header: 'Período de Pago', key: 'periodo', width: 20 },
            { header: 'Colaboradores', key: 'colaboradores', width: 15 },
            { header: 'Monto Total', key: 'monto', width: 15 },
            { header: 'Estado', key: 'estado', width: 15 },
            { header: 'Usuario Registro', key: 'usuarioRegistro', width: 25 },
            { header: 'Fecha Registro', key: 'fechaRegistro', width: 20 },
            { header: 'Usuario Autoriza', key: 'usuarioAutoriza', width: 25 },
            { header: 'Fecha Autorización', key: 'fechaAutoriza', width: 20 },
            { header: 'Motivo Rechazo', key: 'motivoRechazo', width: 40 }
        ];
        
        // Estilo del encabezado
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF654321' }
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 25;
        
        // Agregar datos
        datosFiltrados.forEach(planilla => {
            worksheet.addRow({
                idPlanilla: planilla.IdPlanillaParcial,
                departamento: planilla.NombreDepartamento,
                periodo: planilla.PeriodoPago || 'N/A',
                colaboradores: planilla.CantidadColaboradores,
                monto: parseFloat(planilla.MontoPlanillaParcial),
                estado: planilla.NombreEstado,
                usuarioRegistro: planilla.NombreUsuario || 'N/A',
                fechaRegistro: planilla.FechaHoraRegistro,
                usuarioAutoriza: planilla.NombreUsuarioAutoriza || 'N/A',
                fechaAutoriza: planilla.FechaHoraAutorizacion || 'N/A',
                motivoRechazo: planilla.MotivoRechazo || 'N/A'
            });
        });
        
        // Formato de moneda
        worksheet.getColumn('monto').numFmt = 'Q #,##0.00';
        
        // Formato de fechas
        worksheet.getColumn('fechaRegistro').numFmt = 'dd/mm/yyyy hh:mm';
        worksheet.getColumn('fechaAutoriza').numFmt = 'dd/mm/yyyy hh:mm';
        
        // Agregar fila de totales
        const totalRow = worksheet.addRow({
            idPlanilla: '',
            departamento: '',
            periodo: 'TOTALES:',
            colaboradores: datosFiltrados.reduce((sum, p) => sum + parseInt(p.CantidadColaboradores || 0), 0),
            monto: datosFiltrados.reduce((sum, p) => sum + parseFloat(p.MontoPlanillaParcial || 0), 0),
            estado: '',
            usuarioRegistro: '',
            fechaRegistro: '',
            usuarioAutoriza: '',
            fechaAutoriza: '',
            motivoRechazo: ''
        });
        
        totalRow.font = { bold: true };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Bordes
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
        
        // Guardar archivo
        const savePath = dialog.showSaveDialogSync({
            title: 'Guardar reporte',
            defaultPath: `Planillas_Parciales_${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [
                { name: 'Excel', extensions: ['xlsx'] }
            ]
        });
        
        if (savePath) {
            await workbook.xlsx.writeFile(savePath);
            
            Swal.fire({
                icon: 'success',
                title: 'Exportado exitosamente',
                text: 'El archivo se ha guardado correctamente',
                confirmButtonColor: '#4CAF50'
            });
        }
        
    } catch (error) {
        console.error('Error al exportar:', error);
        mostrarError('Error al exportar el archivo');
    }
}

// ==================== EXPORTAR REPORTE POR DEPARTAMENTO A EXCEL ====================
async function exportarExcelDepartamento() {
    if (datosDepartamentos.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay datos para exportar',
            confirmButtonColor: '#FF9800'
        });
        return;
    }

    try {
        const ExcelJS = require('exceljs');
        const { dialog } = require('electron').remote;

        // Crear libro de trabajo
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Resumen por Departamento');

        // Configurar columnas
        worksheet.columns = [
            { header: 'ID Depto', key: 'idDepartamento', width: 12 },
            { header: 'Departamento', key: 'departamento', width: 35 },
            { header: 'Cantidad Planillas', key: 'cantidadPlanillas', width: 18 },
            { header: 'Monto Total', key: 'montoTotal', width: 18 },
            { header: 'Turno Mañana', key: 'turnoManana', width: 15 },
            { header: 'Turno Mixto', key: 'turnoMixto', width: 15 },
            { header: 'Turno 4 Horas', key: 'turno4Horas', width: 15 },
            { header: 'Total Turnos', key: 'totalTurnos', width: 15 }
        ];

        // Estilo del encabezado
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF654321' }
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 25;

        // Variables para totales
        let totalPlanillas = 0;
        let totalMonto = 0;
        let totalManana = 0;
        let totalMixto = 0;
        let total4H = 0;
        let totalTurnos = 0;

        // Agregar datos
        datosDepartamentos.forEach(dept => {
            worksheet.addRow({
                idDepartamento: dept.IdDepartamentoSucursal,
                departamento: dept.NombreDepartamento,
                cantidadPlanillas: parseInt(dept.CantidadPlanillas),
                montoTotal: parseFloat(dept.MontoTotalPlanillas),
                turnoManana: parseInt(dept.TurnoManana),
                turnoMixto: parseInt(dept.TurnoMixto),
                turno4Horas: parseInt(dept.Turno4Horas),
                totalTurnos: parseInt(dept.TotalTurnos)
            });

            // Acumular totales
            totalPlanillas += parseInt(dept.CantidadPlanillas || 0);
            totalMonto += parseFloat(dept.MontoTotalPlanillas || 0);
            totalManana += parseInt(dept.TurnoManana || 0);
            totalMixto += parseInt(dept.TurnoMixto || 0);
            total4H += parseInt(dept.Turno4Horas || 0);
            totalTurnos += parseInt(dept.TotalTurnos || 0);
        });

        // Formato de moneda
        worksheet.getColumn('montoTotal').numFmt = 'Q #,##0.00';

        // Centrar columnas numéricas
        worksheet.getColumn('idDepartamento').alignment = { horizontal: 'center' };
        worksheet.getColumn('cantidadPlanillas').alignment = { horizontal: 'center' };
        worksheet.getColumn('turnoManana').alignment = { horizontal: 'center' };
        worksheet.getColumn('turnoMixto').alignment = { horizontal: 'center' };
        worksheet.getColumn('turno4Horas').alignment = { horizontal: 'center' };
        worksheet.getColumn('totalTurnos').alignment = { horizontal: 'center' };

        // Agregar fila de totales
        const totalRow = worksheet.addRow({
            idDepartamento: '',
            departamento: 'TOTALES:',
            cantidadPlanillas: totalPlanillas,
            montoTotal: totalMonto,
            turnoManana: totalManana,
            turnoMixto: totalMixto,
            turno4Horas: total4H,
            totalTurnos: totalTurnos
        });

        totalRow.font = { bold: true };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Bordes
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Guardar archivo
        const savePath = dialog.showSaveDialogSync({
            title: 'Guardar reporte',
            defaultPath: `Resumen_Departamentos_${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [
                { name: 'Excel', extensions: ['xlsx'] }
            ]
        });

        if (savePath) {
            await workbook.xlsx.writeFile(savePath);

            Swal.fire({
                icon: 'success',
                title: 'Exportado exitosamente',
                text: 'El archivo se ha guardado correctamente',
                confirmButtonColor: '#4CAF50'
            });
        }

    } catch (error) {
        console.error('Error al exportar:', error);
        mostrarError('Error al exportar el archivo');
    }
}

// ==================== EXPORTAR DETALLE A EXCEL ====================
async function exportarDetalleExcel() {
    const idPlanilla = document.getElementById('btnExportarDetalle').getAttribute('data-planilla-id');
    
    if (!idPlanilla) {
        mostrarError('No se pudo identificar la planilla');
        return;
    }
    
    try {
        const ExcelJS = require('exceljs');
        const { dialog } = require('electron').remote;
        
        const connection = await connectionString();
        
        // Obtener detalle
        const detalle = await connection.query(`
            SELECT
                NombrePersonal, 
                FechaLaborada, 
                IdTipoTurno, 
                TipoTurno, 
                MontoPagado
            FROM
                PagoPlanillaParcialDetalle
            WHERE
                IdPlanillaParcial = ?
            ORDER BY FechaLaborada DESC, NombrePersonal
        `, [idPlanilla]);
        
        await connection.close();
        
        if (detalle.length === 0) {
            mostrarError('No hay detalles para exportar');
            return;
        }
        
        // Crear libro de trabajo
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Detalle Planilla ${idPlanilla}`);
        
        // Configurar columnas
        worksheet.columns = [
            { header: 'Colaborador', key: 'colaborador', width: 40 },
            { header: 'Fecha Laborada', key: 'fechaLaborada', width: 15 },
            { header: 'ID Turno', key: 'idTurno', width: 12 },
            { header: 'Tipo de Turno', key: 'tipoTurno', width: 25 },
            { header: 'Monto Pagado', key: 'montoPagado', width: 15 }
        ];
        
        // Estilo del encabezado
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF654321' }
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 25;
        
        // Agregar datos
        let total = 0;
        detalle.forEach(item => {
            worksheet.addRow({
                colaborador: item.NombrePersonal,
                fechaLaborada: item.FechaLaborada,
                idTurno: item.IdTipoTurno,
                tipoTurno: item.TipoTurno,
                montoPagado: parseFloat(item.MontoPagado)
            });
            total += parseFloat(item.MontoPagado || 0);
        });
        
        // Formato de moneda
        worksheet.getColumn('montoPagado').numFmt = 'Q #,##0.00';
        
        // Formato de fechas
        worksheet.getColumn('fechaLaborada').numFmt = 'dd/mm/yyyy';
        
        // Agregar fila de total
        const totalRow = worksheet.addRow({
            colaborador: '',
            fechaLaborada: '',
            idTurno: '',
            tipoTurno: 'TOTAL:',
            montoPagado: total
        });
        
        totalRow.font = { bold: true };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Bordes
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
        
        // Guardar archivo
        const savePath = dialog.showSaveDialogSync({
            title: 'Guardar detalle',
            defaultPath: `Detalle_Planilla_${idPlanilla}_${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [
                { name: 'Excel', extensions: ['xlsx'] }
            ]
        });
        
        if (savePath) {
            await workbook.xlsx.writeFile(savePath);
            
            Swal.fire({
                icon: 'success',
                title: 'Exportado exitosamente',
                text: 'El detalle se ha guardado correctamente',
                confirmButtonColor: '#4CAF50'
            });
        }
        
    } catch (error) {
        console.error('Error al exportar detalle:', error);
        mostrarError('Error al exportar el detalle');
    }
}

// ==================== FUNCIONES DE UTILIDAD ====================
function formatearMoneda(valor) {
    if (!valor || isNaN(valor)) return 'Q 0.00';
    return 'Q ' + parseFloat(valor).toLocaleString('es-GT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

function formatearFechaHora(fecha) {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    const hora = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${minutos}`;
}

function obtenerBadgeEstado(nombreEstado, idEstado) {
    const clase = obtenerClaseEstado(idEstado);
    return `<span class="estado-badge ${clase}">${nombreEstado}</span>`;
}

function obtenerClaseEstado(idEstado) {
    switch(parseInt(idEstado)) {
        case 1: return 'estado-pendiente';
        case 2: return 'estado-aprobado';
        case 3: return 'estado-rechazado';
        case 4: return 'estado-pagado';
        default: return 'estado-pendiente';
    }
}

function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        confirmButtonColor: '#FF9800'
    });
}

// ==================== EXPONER FUNCIONES GLOBALES ====================
// Necesario para el onclick en el HTML
window.verDetalle = verDetalle;
window.verPDF = verPDF;