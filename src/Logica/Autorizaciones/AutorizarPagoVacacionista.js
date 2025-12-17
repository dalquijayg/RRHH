// AutorizarPagoVacacionista.js
const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const Swal = require('sweetalert2');

// ========== VARIABLES GLOBALES ==========
let userData = {};
let solicitudesData = [];
let filteredData = [];
let tiendasACargo = [];
let currentPage = 1;
const recordsPerPage = 10;

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarSistema();
});

async function inicializarSistema() {
    try {
        // Cargar datos del usuario
        cargarDatosUsuario();
        
        // Mostrar loading
        mostrarLoading(true);
        
        // Cargar tiendas a cargo
        await cargarTiendasACargo();
        
        // Cargar solicitudes
        await cargarSolicitudes();
        
        // Configurar event listeners
        configurarEventListeners();
        
        // Ocultar loading
        mostrarLoading(false);
        
    } catch (error) {
        console.error('Error al inicializar el sistema:', error);
        mostrarLoading(false);
        await mostrarError('Error al inicializar el sistema', error.message);
    }
}

// ========== CARGA DE DATOS DEL USUARIO ==========
function cargarDatosUsuario() {
    try {
        const userDataStr = localStorage.getItem('userData');
        if (userDataStr) {
            userData = JSON.parse(userDataStr);
            
            // Actualizar información en el header
            const userNameElement = document.getElementById('userName');
            const userRoleElement = document.getElementById('userRole');
            const userAvatarElement = document.getElementById('userAvatar');
            
            if (userNameElement) {
                userNameElement.textContent = userData.NombreCompleto || 'Usuario';
            }
            
            if (userRoleElement) {
                userRoleElement.textContent = determinarRol(userData.Id_Puesto);
            }
            
            if (userAvatarElement && userData.FotoBase64) {
                userAvatarElement.src = userData.FotoBase64;
            }
        } else {
            throw new Error('No se encontraron datos del usuario');
        }
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información del usuario. Serás redirigido al login.',
            confirmButtonColor: '#FF9800'
        }).then(() => {
            window.location.href = path.join(__dirname, 'Login.html');
        });
    }
}

function determinarRol(idPuesto) {
    if (idPuesto == 5) {
        return 'Administrador RRHH';
    } else if (idPuesto == 1) {
        return 'Gerente';
    } else {
        return 'Regional';
    }
}

// ========== CARGA DE TIENDAS A CARGO ==========
async function cargarTiendasACargo() {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento
            FROM
                departamentos
            WHERE
                departamentos.IdEncargadoRegional = ?
        `, [userData.IdPersonal]);
        
        await connection.close();
        
        tiendasACargo = result;
        
        // Actualizar estadística de tiendas
        document.getElementById('statStores').textContent = tiendasACargo.length;
        
        // Llenar el filtro de tiendas
        llenarFiltroTiendas();
        
    } catch (error) {
        console.error('Error al cargar tiendas a cargo:', error);
        throw error;
    }
}

function llenarFiltroTiendas() {
    const filterStore = document.getElementById('filterStore');
    
    // Limpiar opciones existentes excepto la primera
    filterStore.innerHTML = '<option value="">Todas las tiendas</option>';
    
    // Agregar las tiendas
    tiendasACargo.forEach(tienda => {
        const option = document.createElement('option');
        option.value = tienda.IdDepartamento;
        option.textContent = tienda.NombreDepartamento;
        filterStore.appendChild(option);
    });
}

// ========== CARGA DE SOLICITUDES ==========
async function cargarSolicitudes() {
    try {
        if (tiendasACargo.length === 0) {
            solicitudesData = [];
            actualizarTabla();
            actualizarEstadisticas();
            return;
        }
        
        const connection = await connectionString();
        
        // Crear array de IDs de departamentos
        const idsDepartamentos = tiendasACargo.map(t => t.IdDepartamento);
        
        // Crear placeholders para la query
        const placeholders = idsDepartamentos.map(() => '?').join(',');
        
        const result = await connection.query(`
            SELECT
                VacacionistaPagoPlanilla.IdPagoPlanillaVacacionista,
                VacacionistaPagoPlanilla.NombreUsuarioGenera,
                VacacionistaPagoPlanilla.PeriodoPago,
                VacacionistaPagoPlanilla.IdDeptoSucursal,
                VacacionistaPagoPlanilla.NombreDeptoSucursal,
                VacacionistaPagoPlanilla.CantidadColaboradores,
                VacacionistaPagoPlanilla.MontoPlanilla,
                VacacionistaPagoPlanilla.FechaHoraRegistro
            FROM
                VacacionistaPagoPlanilla
            WHERE
                VacacionistaPagoPlanilla.Estado = 0 AND
                VacacionistaPagoPlanilla.IdDeptoSucursal IN (${placeholders})
            ORDER BY
                VacacionistaPagoPlanilla.FechaHoraRegistro DESC
        `, idsDepartamentos);
        
        await connection.close();
        
        solicitudesData = result;
        filteredData = [...solicitudesData];
        
        // Actualizar interfaz
        actualizarTabla();
        actualizarEstadisticas();
        
    } catch (error) {
        console.error('Error al cargar solicitudes:', error);
        throw error;
    }
}


// ========== ACTUALIZACIÓN DE TABLA ==========
function actualizarTabla() {
    const tbody = document.getElementById('solicitudesTableBody');

    // Limpiar tabla
    tbody.innerHTML = '';
    
    // Si no hay datos
    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No hay solicitudes pendientes</p>
                        <small>Las solicitudes aparecerán aquí cuando estén disponibles</small>
                    </div>
                </td>
            </tr>
        `;
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calcular paginación
    const totalPages = Math.ceil(filteredData.length / recordsPerPage);
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = Math.min(startIndex + recordsPerPage, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);
    
    // Llenar tabla
    pageData.forEach((solicitud, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${startIndex + index + 1}</td>
            <td><strong>${solicitud.PeriodoPago || 'N/A'}</strong></td>
            <td>${solicitud.NombreDeptoSucursal || 'N/A'}</td>
            <td>${solicitud.NombreUsuarioGenera || 'N/A'}</td>
            <td class="text-center">${solicitud.CantidadColaboradores || 0}</td>
            <td class="text-right"><strong class="text-success">Q ${formatearMoneda(solicitud.MontoPlanilla)}</strong></td>
            <td>${formatearFecha(solicitud.FechaHoraRegistro)}</td>
            <td class="actions-column">
                <div class="action-buttons">
                    <button class="btn-action btn-detail" onclick="verDetalle(${solicitud.IdPagoPlanillaVacacionista})">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    <button class="btn-action btn-authorize" onclick="autorizarSolicitud(${solicitud.IdPagoPlanillaVacacionista})">
                        <i class="fas fa-check"></i> Autorizar
                    </button>
                    <button class="btn-action btn-cancel" onclick="anularSolicitud(${solicitud.IdPagoPlanillaVacacionista})">
                        <i class="fas fa-times"></i> Anular
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Actualizar paginación
    actualizarPaginacion(totalPages, startIndex, endIndex);
}

// ========== PAGINACIÓN ==========
function actualizarPaginacion(totalPages, startIndex, endIndex) {
    const paginationContainer = document.getElementById('paginationContainer');
    
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'flex';
    
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('showingFrom').textContent = startIndex + 1;
    document.getElementById('showingTo').textContent = endIndex;
    document.getElementById('totalRecords').textContent = filteredData.length;
    
    // Habilitar/deshabilitar botones
    document.getElementById('btnFirst').disabled = currentPage === 1;
    document.getElementById('btnPrev').disabled = currentPage === 1;
    document.getElementById('btnNext').disabled = currentPage === totalPages;
    document.getElementById('btnLast').disabled = currentPage === totalPages;
}

function cambiarPagina(direccion) {
    const totalPages = Math.ceil(filteredData.length / recordsPerPage);
    
    switch(direccion) {
        case 'first':
            currentPage = 1;
            break;
        case 'prev':
            if (currentPage > 1) currentPage--;
            break;
        case 'next':
            if (currentPage < totalPages) currentPage++;
            break;
        case 'last':
            currentPage = totalPages;
            break;
    }
    
    actualizarTabla();
}

// ========== ACTUALIZACIÓN DE ESTADÍSTICAS ==========
function actualizarEstadisticas() {
    // Cantidad de solicitudes pendientes
    document.getElementById('statPending').textContent = filteredData.length;
    
    // Monto total
    const montoTotal = filteredData.reduce((sum, s) => sum + (parseFloat(s.MontoPlanilla) || 0), 0);
    document.getElementById('statAmount').textContent = 'Q ' + formatearMoneda(montoTotal);
    
    // Total de colaboradores
    const totalColaboradores = filteredData.reduce((sum, s) => sum + (parseInt(s.CantidadColaboradores) || 0), 0);
    document.getElementById('statEmployees').textContent = totalColaboradores;
    
    // Animar los valores
    animarEstadistica('statPending');
    animarEstadistica('statAmount');
    animarEstadistica('statEmployees');
}

function animarEstadistica(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('updating');
        setTimeout(() => {
            element.classList.remove('updating');
        }, 300);
    }
}

// ========== FILTROS ==========
function aplicarFiltros() {
    const filterStore = document.getElementById('filterStore').value;
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    
    filteredData = solicitudesData.filter(solicitud => {
        // Filtro por tienda
        if (filterStore && solicitud.IdDeptoSucursal != filterStore) {
            return false;
        }
        
        // Filtro por búsqueda
        if (searchInput) {
            const searchFields = [
                solicitud.NombreDeptoSucursal,
                solicitud.PeriodoPago,
                solicitud.NombreUsuarioGenera
            ].map(field => (field || '').toLowerCase());
            
            if (!searchFields.some(field => field.includes(searchInput))) {
                return false;
            }
        }
        
        return true;
    });
    
    // Resetear a la primera página
    currentPage = 1;
    
    // Actualizar tabla y estadísticas
    actualizarTabla();
    actualizarEstadisticas();
}

// ========== ACCIONES DE SOLICITUDES ==========
async function verDetalle(idSolicitud) {
    try {
        mostrarLoading(true);
        
        const solicitud = solicitudesData.find(s => s.IdPagoPlanillaVacacionista === idSolicitud);
        
        if (!solicitud) {
            throw new Error('Solicitud no encontrada');
        }
        
        // Obtener el detalle de los vacacionistas
        const connection = await connectionString();
        const detalle = await connection.query(`
            SELECT
                VacacionistaDetallePagoPlanilla.NombreColaborador,
                VacacionistaDetallePagoPlanilla.CantidadDiasLaborados,
                VacacionistaDetallePagoPlanilla.MontoDia,
                VacacionistaDetallePagoPlanilla.SubTotal
            FROM
                VacacionistaDetallePagoPlanilla
            WHERE
                VacacionistaDetallePagoPlanilla.IdPagoPlanillaVacacionista = ?
            ORDER BY
                VacacionistaDetallePagoPlanilla.NombreColaborador
        `, [idSolicitud]);
        
        await connection.close();
        mostrarLoading(false);
        
        // Crear HTML de la tabla de detalle
        let detalleHTML = `
            <div style="max-height: 400px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead style="position: sticky; top: 0; background: #f5f5f5;">
                        <tr>
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #FF9800;">#</th>
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #FF9800;">Colaborador</th>
                            <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid #FF9800;">Días Laborados</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #FF9800;">Monto por Día</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #FF9800;">SubTotal</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        detalle.forEach((item, index) => {
            detalleHTML += `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 0.75rem;">${index + 1}</td>
                    <td style="padding: 0.75rem;"><strong>${item.NombreColaborador}</strong></td>
                    <td style="padding: 0.75rem; text-align: center;"><strong>${item.CantidadDiasLaborados}</strong></td>
                    <td style="padding: 0.75rem; text-align: right;">Q ${formatearMoneda(item.MontoDia)}</td>
                    <td style="padding: 0.75rem; text-align: right;"><strong style="color: #4CAF50;">Q ${formatearMoneda(item.SubTotal)}</strong></td>
                </tr>
            `;
        });
        
        detalleHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        await Swal.fire({
            title: 'Detalle de Planilla',
            html: `
                <div style="text-align: left; margin-bottom: 1rem;">
                    <div style="background: linear-gradient(135deg, #FF9800, #F57C00); color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">${solicitud.NombreDeptoSucursal}</h3>
                        <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">Período: <strong>${solicitud.PeriodoPago}</strong></p>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
                        <div style="background: #f5f5f5; padding: 0.75rem; border-radius: 6px;">
                            <p style="margin: 0; font-size: 0.75rem; color: #666;">Generado por:</p>
                            <p style="margin: 0; font-weight: 600; color: #654321;">${solicitud.NombreUsuarioGenera}</p>
                        </div>
                        <div style="background: #f5f5f5; padding: 0.75rem; border-radius: 6px;">
                            <p style="margin: 0; font-size: 0.75rem; color: #666;">Fecha:</p>
                            <p style="margin: 0; font-weight: 600; color: #654321;">${formatearFecha(solicitud.FechaHoraRegistro)}</p>
                        </div>
                        <div style="background: #e3f2fd; padding: 0.75rem; border-radius: 6px;">
                            <p style="margin: 0; font-size: 0.75rem; color: #1976d2;">Colaboradores:</p>
                            <p style="margin: 0; font-weight: 700; font-size: 1.2rem; color: #1976d2;">${solicitud.CantidadColaboradores}</p>
                        </div>
                        <div style="background: #e8f5e9; padding: 0.75rem; border-radius: 6px;">
                            <p style="margin: 0; font-size: 0.75rem; color: #388e3c;">Monto Total:</p>
                            <p style="margin: 0; font-weight: 700; font-size: 1.2rem; color: #388e3c;">Q ${formatearMoneda(solicitud.MontoPlanilla)}</p>
                        </div>
                    </div>
                </div>
                ${detalleHTML}
            `,
            width: '900px',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#FF9800',
            showCloseButton: true
        });
        
    } catch (error) {
        mostrarLoading(false);
        console.error('Error al ver detalle:', error);
        await mostrarError('Error al cargar el detalle', error.message);
    }
}

async function autorizarSolicitud(idSolicitud) {
    try {
        const solicitud = solicitudesData.find(s => s.IdPagoPlanillaVacacionista === idSolicitud);
        
        if (!solicitud) {
            throw new Error('Solicitud no encontrada');
        }
        
        const result = await Swal.fire({
            title: '¿Autorizar planilla?',
            html: `
                <div style="text-align: left;">
                    <p style="margin-bottom: 1rem;">Estás por autorizar la siguiente planilla:</p>
                    <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <p style="margin: 0.25rem 0;"><strong>Tienda:</strong> ${solicitud.NombreDeptoSucursal}</p>
                        <p style="margin: 0.25rem 0;"><strong>Período:</strong> ${solicitud.PeriodoPago}</p>
                        <p style="margin: 0.25rem 0;"><strong>Colaboradores:</strong> ${solicitud.CantidadColaboradores}</p>
                        <p style="margin: 0.25rem 0;"><strong>Monto:</strong> <span style="color: #4CAF50; font-weight: 700;">Q ${formatearMoneda(solicitud.MontoPlanilla)}</span></p>
                    </div>
                    <div style="background: #e8f5e9; padding: 0.75rem; border-radius: 6px; border-left: 4px solid #4CAF50;">
                        <p style="margin: 0; font-size: 0.9rem; color: #2e7d32;">
                            <i class="fas fa-info-circle"></i> Una vez autorizada, la planilla será procesada para pago.
                        </p>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-check"></i> Sí, Autorizar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#9E9E9E',
            width: '500px'
        });
        
        if (result.isConfirmed) {
            mostrarLoading(true);

            const connection = await connectionString();
            await connection.query(`
                UPDATE VacacionistaPagoPlanilla
                SET Estado = 1,
                    IdUsuarioAutorizaAnula = ?,
                    NombreUsuarioAutorizaAnula = ?,
                    FechaHoraAutorizo = NOW()
                WHERE IdPagoPlanillaVacacionista = ?
            `, [userData.IdPersonal, userData.NombreCompleto, idSolicitud]);
            
            await connection.close();
            
            // Recargar solicitudes
            await cargarSolicitudes();
            
            mostrarLoading(false);
            
            await Swal.fire({
                icon: 'success',
                title: '¡Planilla Autorizada!',
                html: `
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; color: #4CAF50; margin-bottom: 1rem;">✓</div>
                        <p>La planilla ha sido autorizada exitosamente.</p>
                    </div>
                `,
                confirmButtonColor: '#4CAF50',
                timer: 3000,
                timerProgressBar: true
            });
        }
        
    } catch (error) {
        mostrarLoading(false);
        console.error('Error al autorizar solicitud:', error);
        await mostrarError('Error al autorizar', error.message);
    }
}

async function anularSolicitud(idSolicitud) {
    try {
        const solicitud = solicitudesData.find(s => s.IdPagoPlanillaVacacionista === idSolicitud);
        
        if (!solicitud) {
            throw new Error('Solicitud no encontrada');
        }
        
        const { value: motivo } = await Swal.fire({
            title: '¿Anular planilla?',
            html: `
                <div style="text-align: left;">
                    <p style="margin-bottom: 1rem;">Estás por anular la siguiente planilla:</p>
                    <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <p style="margin: 0.25rem 0;"><strong>Tienda:</strong> ${solicitud.NombreDeptoSucursal}</p>
                        <p style="margin: 0.25rem 0;"><strong>Período:</strong> ${solicitud.PeriodoPago}</p>
                        <p style="margin: 0.25rem 0;"><strong>Monto:</strong> Q ${formatearMoneda(solicitud.MontoPlanilla)}</p>
                    </div>
                    <div style="background: #ffebee; padding: 0.75rem; border-radius: 6px; border-left: 4px solid #F44336; margin-bottom: 1rem;">
                        <p style="margin: 0; font-size: 0.9rem; color: #c62828;">
                            <i class="fas fa-exclamation-triangle"></i> Esta acción no se puede deshacer.
                        </p>
                    </div>
                    <p style="margin-bottom: 0.5rem; font-weight: 500;">Motivo de anulación (máximo 255 caracteres):</p>
                </div>
            `,
            input: 'textarea',
            inputPlaceholder: 'Escribe el motivo de la anulación...',
            inputAttributes: {
                'aria-label': 'Motivo de anulación',
                'maxlength': '255',
                style: 'min-height: 80px;'
            },
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-times"></i> Sí, Anular',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#F44336',
            cancelButtonColor: '#9E9E9E',
            width: '500px',
            inputValidator: (value) => {
                if (!value || value.trim().length < 10) {
                    return 'Debes escribir un motivo de al menos 10 caracteres';
                }
                if (value.trim().length > 255) {
                    return 'El motivo no puede exceder los 255 caracteres';
                }
            }
        });
        
        if (motivo) {
            mostrarLoading(true);

            const connection = await connectionString();
            await connection.query(`
                UPDATE VacacionistaPagoPlanilla
                SET Estado = 4,
                    IdUsuarioAutorizaAnula = ?,
                    NombreUsuarioAutorizaAnula = ?,
                    FechaHoraAutorizo = NOW(),
                    MotivoAnulacion = ?
                WHERE IdPagoPlanillaVacacionista = ?
            `, [userData.IdPersonal, userData.NombreCompleto, motivo, idSolicitud]);
            
            await connection.close();
            
            // Recargar solicitudes
            await cargarSolicitudes();
            
            mostrarLoading(false);
            
            await Swal.fire({
                icon: 'success',
                title: 'Planilla Anulada',
                confirmButtonColor: '#FF9800',
                timer: 3000,
                timerProgressBar: true
            });
        }
        
    } catch (error) {
        mostrarLoading(false);
        console.error('Error al anular solicitud:', error);
        await mostrarError('Error al anular', error.message);
    }
}

// ========== CONFIGURACIÓN DE EVENT LISTENERS ==========
function configurarEventListeners() {
    // Botón de volver
    document.getElementById('btnBack').addEventListener('click', () => {
        window.location.href = path.join(__dirname, 'Menu.html');
    });
    
    // Botón de actualizar
    document.getElementById('btnRefresh').addEventListener('click', async () => {
        mostrarLoading(true);
        await cargarSolicitudes();
        mostrarLoading(false);
        
        Swal.fire({
            icon: 'success',
            title: 'Actualizado',
            text: 'Los datos han sido actualizados',
            timer: 1500,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    });
    
    // Filtros
    document.getElementById('filterStore').addEventListener('change', aplicarFiltros);
    document.getElementById('searchInput').addEventListener('input', aplicarFiltros);
    
    // Paginación
    document.getElementById('btnFirst').addEventListener('click', () => cambiarPagina('first'));
    document.getElementById('btnPrev').addEventListener('click', () => cambiarPagina('prev'));
    document.getElementById('btnNext').addEventListener('click', () => cambiarPagina('next'));
    document.getElementById('btnLast').addEventListener('click', () => cambiarPagina('last'));
}

// ========== FUNCIONES AUXILIARES ==========
function mostrarLoading(mostrar) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = mostrar ? 'flex' : 'none';
    }
}

function formatearMoneda(valor) {
    if (!valor && valor !== 0) return '0.00';
    return parseFloat(valor).toLocaleString('es-GT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    
    const date = new Date(fecha);
    const opciones = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    return date.toLocaleString('es-GT', opciones);
}

async function mostrarError(titulo, mensaje) {
    await Swal.fire({
        icon: 'error',
        title: titulo,
        text: mensaje,
        confirmButtonColor: '#FF9800'
    });
}