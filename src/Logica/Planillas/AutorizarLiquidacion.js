// AutorizarLiquidacion.js - CÓDIGO COMPLETO - PARTE 1
const { connectionString } = require('../Conexion/Conexion');
const Swal = require('sweetalert2');

// Variables globales
let liquidacionesData = [];
let liquidacionesFiltradas = [];
let currentSort = { column: null, direction: 'asc' };
let timeoutBusqueda = null;

// Clase para manejar la tabla de liquidaciones
class LiquidacionesTable {
    constructor() {
        this.table = document.getElementById('tablaLiquidaciones');
        this.tbody = document.getElementById('tablaLiquidacionesBody');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.noResultsMessage = document.getElementById('noResultsMessage');
        this.contadorResultados = document.getElementById('contadorResultados');
        this.searchInput = document.getElementById('buscarLiquidacion');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.cargarLiquidaciones();
    }
    
    setupEventListeners() {
        // Búsqueda en tiempo real
        this.searchInput.addEventListener('input', (e) => {
            this.filtrarLiquidaciones(e.target.value);
        });
        
        // Limpiar búsqueda
        document.getElementById('btnLimpiarBusqueda').addEventListener('click', () => {
            this.searchInput.value = '';
            this.filtrarLiquidaciones('');
        });
        
        // Refrescar datos
        document.getElementById('btnRefrescar').addEventListener('click', () => {
            this.cargarLiquidaciones();
        });
        
        // Ordenamiento por columnas
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.getAttribute('data-column');
                this.ordenarPorColumna(column);
            });
        });
        
        // Modal events
        this.setupModalEvents();
    }
    
    setupModalEvents() {
        const modal = document.getElementById('modalDetalles');
        const overlay = document.getElementById('modalOverlay');
        const closeButtons = document.querySelectorAll('#cerrarModal, #btnCerrarModal');
        
        // Cerrar modal
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.cerrarModal());
        });
        
        // Cerrar modal al hacer clic en overlay
        overlay.addEventListener('click', () => this.cerrarModal());
        
        // Autorizar liquidación
        document.getElementById('btnAutorizar').addEventListener('click', () => {
            this.autorizarLiquidacion();
        });
        
        // Rechazar liquidación
        document.getElementById('btnRechazar').addEventListener('click', () => {
            this.rechazarLiquidacion();
        });
    }
    
    async cargarLiquidaciones() {
        try {
            this.mostrarCarga(true);
            
            const liquidaciones = await this.obtenerLiquidacionesPendientes();
            liquidacionesData = liquidaciones;
            liquidacionesFiltradas = [...liquidaciones];
            
            this.renderizarTabla();
            this.actualizarContador();
            
        } catch (error) {
            console.error('Error al cargar liquidaciones:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Error al cargar datos',
                text: 'No se pudieron cargar las liquidaciones: ' + error.message,
                confirmButtonColor: '#FF9800'
            });
        } finally {
            this.mostrarCarga(false);
        }
    }
    
    async obtenerLiquidacionesPendientes() {
        try {
            const connection = await connectionString();
            
            const result = await connection.query(`
                SELECT
                    Liquidaciones.IdLiquidacion, 
                    Liquidaciones.NombrePersonal, 
                    Liquidaciones.FechaPlanilla, 
                    Liquidaciones.FechaFin,
                    Liquidaciones.DiasIndemnizacion,
                    Liquidaciones.TipoLiquidacion,
                    Liquidaciones.MontoIndemnizacion, 
                    Liquidaciones.MontoAguinaldo, 
                    Liquidaciones.MontoVacaciones, 
                    Liquidaciones.MontoBono14, 
                    Liquidaciones.NombreUsuario, 
                    Liquidaciones.FechaHoraRegistro, 
                    Liquidaciones.Observaciones, 
                    Liquidaciones.NoVale, 
                    Liquidaciones.DescuentoInterno,
                    Liquidaciones.IndemnizacionSiNo,
                    Liquidaciones.IdPersonal
                FROM
                    Liquidaciones
                WHERE
                    Liquidaciones.Estado = 0
                ORDER BY 
                    Liquidaciones.FechaHoraRegistro DESC
            `);
            
            await connection.close();
            
            // Calcular total para cada liquidación
            return result.map(liquidacion => ({
                ...liquidacion,
                Total: this.calcularTotal(liquidacion)
            }));
            
        } catch (error) {
            console.error('Error al obtener liquidaciones:', error);
            throw error;
        }
    }
    
    calcularTotal(liquidacion) {
        const indemnizacion = parseFloat(liquidacion.MontoIndemnizacion) || 0;
        const aguinaldo = parseFloat(liquidacion.MontoAguinaldo) || 0;
        const vacaciones = parseFloat(liquidacion.MontoVacaciones) || 0;
        const bono14 = parseFloat(liquidacion.MontoBono14) || 0;
        // El descuento NO afecta el total, solo se muestra informativamente
        
        return indemnizacion + aguinaldo + vacaciones + bono14;
    }
    
    getTipoLiquidacionTexto(tipo) {
        switch (tipo) {
            case '1': return 'Parcial';
            case '2': return 'Por Despido';
            case '3': return 'Por Renuncia';
            default: return 'No especificado';
        }
    }
    
    getTipoLiquidacionClase(tipo) {
        switch (tipo) {
            case '1': return 'tipo-parcial';
            case '2': return 'tipo-despido';
            case '3': return 'tipo-renuncia';
            default: return 'tipo-indefinido';
        }
    }
    
    filtrarLiquidaciones(termino) {
        if (timeoutBusqueda) {
            clearTimeout(timeoutBusqueda);
        }
        
        timeoutBusqueda = setTimeout(() => {
            if (!termino.trim()) {
                liquidacionesFiltradas = [...liquidacionesData];
            } else {
                const terminoLower = termino.toLowerCase();
                liquidacionesFiltradas = liquidacionesData.filter(liquidacion => {
                    const tipoTexto = this.getTipoLiquidacionTexto(liquidacion.TipoLiquidacion);
                    return (
                        liquidacion.IdLiquidacion.toString().includes(terminoLower) ||
                        liquidacion.NombrePersonal.toLowerCase().includes(terminoLower) ||
                        liquidacion.NombreUsuario.toLowerCase().includes(terminoLower) ||
                        tipoTexto.toLowerCase().includes(terminoLower) ||
                        liquidacion.DiasIndemnizacion.toString().includes(terminoLower) ||
                        this.formatearMoneda(liquidacion.MontoIndemnizacion).toLowerCase().includes(terminoLower) ||
                        this.formatearMoneda(liquidacion.MontoAguinaldo).toLowerCase().includes(terminoLower) ||
                        this.formatearMoneda(liquidacion.MontoVacaciones).toLowerCase().includes(terminoLower) ||
                        this.formatearMoneda(liquidacion.MontoBono14).toLowerCase().includes(terminoLower) ||
                        this.formatearMoneda(liquidacion.Total).toLowerCase().includes(terminoLower) ||
                        (liquidacion.Observaciones && liquidacion.Observaciones.toLowerCase().includes(terminoLower)) ||
                        (liquidacion.NoVale && liquidacion.NoVale.toLowerCase().includes(terminoLower))
                    );
                });
            }
            
            this.renderizarTabla();
            this.actualizarContador();
        }, 300);
    }
    
    ordenarPorColumna(column) {
        // Determinar dirección del ordenamiento
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }
        
        // Aplicar ordenamiento
        liquidacionesFiltradas.sort((a, b) => {
            let valorA = a[column];
            let valorB = b[column];
            
            // Manejar diferentes tipos de datos
            if (column === 'total') {
                valorA = a.Total;
                valorB = b.Total;
            }
            
            // Convertir a números si es monetario o días
            if (['MontoIndemnizacion', 'MontoAguinaldo', 'MontoVacaciones', 'MontoBono14', 'DescuentoInterno', 'total', 'DiasIndemnizacion'].includes(column)) {
                valorA = parseFloat(valorA) || 0;
                valorB = parseFloat(valorB) || 0;
            }
            
            // Convertir fechas
            if (['FechaPlanilla', 'FechaFin', 'FechaHoraRegistro'].includes(column)) {
                valorA = new Date(valorA);
                valorB = new Date(valorB);
            }
            
            // Comparar valores
            if (valorA < valorB) {
                return currentSort.direction === 'asc' ? -1 : 1;
            }
            if (valorA > valorB) {
                return currentSort.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        
        // Actualizar iconos de ordenamiento
        this.actualizarIconosOrdenamiento();
        
        // Re-renderizar tabla
        this.renderizarTabla();
    }
    
    actualizarIconosOrdenamiento() {
        // Limpiar todos los iconos
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            const icon = th.querySelector('.sort-icon');
            if (icon) {
                icon.className = 'fas fa-sort sort-icon';
            }
        });
        
        // Actualizar icono de la columna actual
        if (currentSort.column) {
            const currentTh = document.querySelector(`[data-column="${currentSort.column}"]`);
            if (currentTh) {
                const icon = currentTh.querySelector('.sort-icon');
                if (icon) {
                    currentTh.classList.add(`sort-${currentSort.direction}`);
                    icon.className = `fas fa-sort-${currentSort.direction === 'asc' ? 'up' : 'down'} sort-icon`;
                }
            }
        }
    }
    
    renderizarTabla() {
        if (liquidacionesFiltradas.length === 0) {
            this.mostrarSinResultados(true);
            return;
        }
        
        this.mostrarSinResultados(false);
        
        let html = '';
        liquidacionesFiltradas.forEach(liquidacion => {
            html += this.crearFilaLiquidacion(liquidacion);
        });
        
        this.tbody.innerHTML = html;
        
        // Agregar event listeners a los botones de acción
        this.setupActionButtons();
    }
    // Continuación de la Parte 1...
    
    crearFilaLiquidacion(liquidacion) {
        const fechaIngreso = this.formatearFecha(liquidacion.FechaPlanilla);
        const fechaFin = this.formatearFecha(liquidacion.FechaFin);
        const fechaRegistro = this.formatearFechaHora(liquidacion.FechaHoraRegistro);
        const tipoLiquidacion = this.getTipoLiquidacionTexto(liquidacion.TipoLiquidacion);
        const tipoClase = this.getTipoLiquidacionClase(liquidacion.TipoLiquidacion);
        const diasIndemnizacion = liquidacion.DiasIndemnizacion || 0;
        const indemnizacionTexto = liquidacion.IndemnizacionSiNo === 1 ? 
            this.formatearMoneda(liquidacion.MontoIndemnizacion) : 
            '<span class="text-muted">Sin indemnización</span>';
        
        return `
            <tr data-id="${liquidacion.IdLiquidacion}">
                <td class="font-weight-bold">#${liquidacion.IdLiquidacion}</td>
                <td class="text-truncate" title="${liquidacion.NombrePersonal}">
                    <strong>${liquidacion.NombrePersonal}</strong>
                </td>
                <td>
                    <div class="periodo-container">
                        <div class="fecha-inicio">${fechaIngreso}</div>
                        <div class="fecha-fin">${fechaFin}</div>
                    </div>
                </td>
                <td>
                    <span class="badge badge-tipo ${tipoClase}">${tipoLiquidacion}</span>
                </td>
                <td class="text-center">
                    <span class="dias-badge">${diasIndemnizacion} días</span>
                </td>
                <td class="text-right">
                    <span class="monto ${liquidacion.IndemnizacionSiNo === 1 ? 'positivo' : ''}">${indemnizacionTexto}</span>
                </td>
                <td class="text-right">
                    <span class="monto positivo">${this.formatearMoneda(liquidacion.MontoAguinaldo)}</span>
                </td>
                <td class="text-right">
                    <span class="monto positivo">${this.formatearMoneda(liquidacion.MontoVacaciones)}</span>
                </td>
                <td class="text-right">
                    <span class="monto positivo">${this.formatearMoneda(liquidacion.MontoBono14)}</span>
                </td>
                <td class="text-right">
                    <span class="monto total">${this.formatearMoneda(liquidacion.Total)}</span>
                </td>
                <td class="text-truncate" title="${liquidacion.NombreUsuario}">
                    ${liquidacion.NombreUsuario}
                </td>
                <td>${fechaRegistro}</td>
                <td class="text-center actions-column">
                    <div class="action-buttons">
                        <button type="button" class="btn btn-primary btn-sm btn-action" 
                                onclick="verDetalles(${liquidacion.IdLiquidacion})" 
                                title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-success btn-sm btn-action" 
                                onclick="autorizarDirecto(${liquidacion.IdLiquidacion})" 
                                title="Autorizar">
                            <i class="fas fa-check"></i>
                        </button>
                        <button type="button" class="btn btn-danger btn-sm btn-action" 
                                onclick="rechazarDirecto(${liquidacion.IdLiquidacion})" 
                                title="Rechazar">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    setupActionButtons() {
        // Los event listeners se manejan con funciones globales en onclick
        // Esto es más eficiente para tablas dinámicas
    }
    
    mostrarCarga(mostrar) {
        if (mostrar) {
            this.loadingIndicator.style.display = 'flex';
            this.table.style.display = 'none';
            this.noResultsMessage.style.display = 'none';
        } else {
            this.loadingIndicator.style.display = 'none';
        }
    }
    
    mostrarSinResultados(mostrar) {
        if (mostrar) {
            this.noResultsMessage.style.display = 'flex';
            this.table.style.display = 'none';
        } else {
            this.noResultsMessage.style.display = 'none';
            this.table.style.display = 'table';
        }
    }
    
    actualizarContador() {
        const total = liquidacionesData.length;
        const filtrados = liquidacionesFiltradas.length;
        
        if (total === 0) {
            this.contadorResultados.textContent = 'Sin liquidaciones pendientes';
        } else if (filtrados === total) {
            this.contadorResultados.textContent = `${total} liquidación${total > 1 ? 'es' : ''} pendiente${total > 1 ? 's' : ''}`;
        } else {
            this.contadorResultados.textContent = `${filtrados} de ${total} liquidaciones`;
        }
    }
    
    formatearMoneda(valor) {
        if (!valor || isNaN(valor)) return 'Q 0.00';
        
        const numero = parseFloat(valor);
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: 'GTQ',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numero);
    }
    
    formatearFecha(fecha) {
        if (!fecha) return 'N/A';
        
        try {
            const fechaObj = new Date(fecha);
            return fechaObj.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Fecha inválida';
        }
    }
    
    formatearFechaHora(fechaHora) {
        if (!fechaHora) return 'N/A';
        
        try {
            const fechaObj = new Date(fechaHora);
            return fechaObj.toLocaleString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Fecha inválida';
        }
    }
    
    async mostrarDetalles(idLiquidacion) {
        try {
            const liquidacion = liquidacionesData.find(l => l.IdLiquidacion === idLiquidacion);
            if (!liquidacion) {
                throw new Error('Liquidación no encontrada');
            }
            
            // Obtener información adicional del colaborador
            const infoAdicional = await this.obtenerInfoAdicionalColaborador(liquidacion.IdPersonal);
            
            const modalBody = document.getElementById('modalDetallesBody');
            modalBody.innerHTML = this.crearContenidoModal(liquidacion, infoAdicional);
            
            // Guardar ID actual para las acciones
            this.liquidacionActual = idLiquidacion;
            
            this.abrirModal();
            
        } catch (error) {
            console.error('Error al mostrar detalles:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los detalles: ' + error.message,
                confirmButtonColor: '#FF9800'
            });
        }
    }
    
    async obtenerInfoAdicionalColaborador(idPersonal) {
        try {
            const connection = await connectionString();
            
            const result = await connection.query(`
                SELECT 
                    personal.DPI,
                    departamentos.NombreDepartamento,
                    planillas.Nombre_Planilla,
                    divisiones.Nombre as NombreDivision
                FROM personal
                LEFT JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                LEFT JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
                LEFT JOIN divisiones ON planillas.Division = divisiones.IdDivision
                WHERE personal.IdPersonal = ?
            `, [idPersonal]);
            
            await connection.close();
            
            return result.length > 0 ? result[0] : {};
            
        } catch (error) {
            console.error('Error al obtener información adicional:', error);
            return {};
        }
    }
    
    crearContenidoModal(liquidacion, infoAdicional) {
        const tieneDescuento = liquidacion.DescuentoInterno > 0;
        const tieneObservaciones = liquidacion.Observaciones && liquidacion.Observaciones.trim();
        const sinIndemnizacion = liquidacion.IndemnizacionSiNo === 0;
        const tipoLiquidacion = this.getTipoLiquidacionTexto(liquidacion.TipoLiquidacion);
        const tipoClase = this.getTipoLiquidacionClase(liquidacion.TipoLiquidacion);
        
        return `
            <div class="liquidacion-details">
                <!-- Información del colaborador -->
                <div class="detail-section">
                    <h4><i class="fas fa-user"></i> Información del Colaborador</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Nombre:</label>
                            <span class="font-weight-bold">${liquidacion.NombrePersonal}</span>
                        </div>
                        <div class="detail-item">
                            <label>DPI:</label>
                            <span>${infoAdicional.DPI || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Departamento:</label>
                            <span>${infoAdicional.NombreDepartamento || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>División:</label>
                            <span>${infoAdicional.NombreDivision || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Planilla:</label>
                            <span>${infoAdicional.Nombre_Planilla || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Información del período -->
                <div class="detail-section">
                    <h4><i class="fas fa-calendar-alt"></i> Período de Liquidación</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Tipo de Liquidación:</label>
                            <span class="badge badge-tipo ${tipoClase}">${tipoLiquidacion}</span>
                        </div>
                        <div class="detail-item">
                            <label>Fecha de Ingreso:</label>
                            <span>${this.formatearFecha(liquidacion.FechaPlanilla)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Fecha de Finalización:</label>
                            <span>${this.formatearFecha(liquidacion.FechaFin)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Días de Indemnización:</label>
                            <span class="dias-badge-large">${liquidacion.DiasIndemnizacion || 0} días</span>
                        </div>
                    </div>
                </div>
                
                <!-- Conceptos de liquidación -->
                <div class="detail-section">
                    <h4><i class="fas fa-calculator"></i> Conceptos de Liquidación</h4>
                    <div class="conceptos-grid">
                        <div class="concepto-item ${sinIndemnizacion ? 'concepto-disabled' : ''}">
                            <div class="concepto-label">
                                <i class="fas fa-handshake"></i>
                                Indemnización
                                ${sinIndemnizacion ? '<span class="badge badge-warning">Excluida</span>' : ''}
                            </div>
                            <div class="concepto-valor">
                                ${sinIndemnizacion ? 
                                    '<span class="text-muted">Q 0.00</span>' : 
                                    `<span class="monto positivo">${this.formatearMoneda(liquidacion.MontoIndemnizacion)}</span>`
                                }
                            </div>
                        </div>
                        
                        <div class="concepto-item">
                            <div class="concepto-label">
                                <i class="fas fa-gift"></i>
                                Aguinaldo
                            </div>
                            <div class="concepto-valor">
                                <span class="monto positivo">${this.formatearMoneda(liquidacion.MontoAguinaldo)}</span>
                            </div>
                        </div>
                        
                        <div class="concepto-item">
                            <div class="concepto-label">
                                <i class="fas fa-umbrella-beach"></i>
                                Vacaciones
                            </div>
                            <div class="concepto-valor">
                                <span class="monto positivo">${this.formatearMoneda(liquidacion.MontoVacaciones)}</span>
                            </div>
                        </div>
                        
                        <div class="concepto-item">
                            <div class="concepto-label">
                                <i class="fas fa-calendar-plus"></i>
                                Bono 14
                            </div>
                            <div class="concepto-valor">
                                <span class="monto positivo">${this.formatearMoneda(liquidacion.MontoBono14)}</span>
                            </div>
                        </div>
                        
                        <div class="concepto-item concepto-total">
                            <div class="concepto-label">
                                <i class="fas fa-calculator"></i>
                                <strong>TOTAL A PAGAR</strong>
                            </div>
                            <div class="concepto-valor">
                                <span class="monto total">${this.formatearMoneda(liquidacion.Total)}</span>
                            </div>
                        </div>

                        ${tieneDescuento ? `
                            <div class="concepto-item concepto-descuento-info">
                                <div class="concepto-label">
                                    <i class="fas fa-info-circle"></i>
                                    Descuento Interno (Informativo)
                                    <small>Vale: ${liquidacion.NoVale || 'N/A'} - No afecta el total</small>
                                </div>
                                <div class="concepto-valor">
                                    <span class="monto descuento-info">${this.formatearMoneda(liquidacion.DescuentoInterno)}</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${tieneObservaciones ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-comment-alt"></i> Observaciones</h4>
                        <div class="observaciones-box">
                            ${liquidacion.Observaciones}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Información de registro -->
                <div class="detail-section">
                    <h4><i class="fas fa-info-circle"></i> Información de Registro</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>ID Liquidación:</label>
                            <span class="font-weight-bold">#${liquidacion.IdLiquidacion}</span>
                        </div>
                        <div class="detail-item">
                            <label>Creado por:</label>
                            <span>${liquidacion.NombreUsuario}</span>
                        </div>
                        <div class="detail-item">
                            <label>Fecha de Registro:</label>
                            <span>${this.formatearFechaHora(liquidacion.FechaHoraRegistro)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Estado:</label>
                            <span class="badge badge-pendiente">Pendiente de Autorización</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .liquidacion-details {
                    max-width: 100%;
                }
                
                .detail-section {
                    margin-bottom: 25px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .detail-section:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                }
                
                .detail-section h4 {
                    color: #654321;
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 1.1rem;
                }
                
                .detail-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                }
                
                .detail-item {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                
                .detail-item label {
                    font-weight: 600;
                    color: #666;
                    font-size: 0.9rem;
                }
                
                .conceptos-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .concepto-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border-left: 4px solid #4CAF50;
                }
                
                .concepto-item.concepto-descuento {
                    border-left-color: #FF5252;
                    background: #fff5f5;
                }
                
                .concepto-item.concepto-total {
                    border-left-color: #FF9800;
                    background: linear-gradient(135deg, #fff8e1, #f8f9fa);
                    font-weight: 600;
                }
                
                .concepto-item.concepto-disabled {
                    border-left-color: #999;
                    background: #f5f5f5;
                    opacity: 0.7;
                }
                
                .concepto-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-direction: column;
                    align-items: flex-start;
                }
                
                .concepto-label small {
                    color: #666;
                    font-size: 0.8rem;
                }
                
                .concepto-valor {
                    font-weight: 600;
                }
                
                .observaciones-box {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 4px solid #FF9800;
                    font-style: italic;
                    color: #666;
                }
                
                @media (max-width: 768px) {
                    .detail-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .concepto-item {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 8px;
                    }
                }
            </style>
        `;
    }
    
    abrirModal() {
        const modal = document.getElementById('modalDetalles');
        const overlay = document.getElementById('modalOverlay');
        
        overlay.style.display = 'block';
        modal.style.display = 'block';
        
        setTimeout(() => {
            overlay.classList.add('show');
            modal.classList.add('show');
        }, 10);
    }
    
    cerrarModal() {
        const modal = document.getElementById('modalDetalles');
        const overlay = document.getElementById('modalOverlay');
        
        modal.classList.remove('show');
        overlay.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
            overlay.style.display = 'none';
            this.liquidacionActual = null;
        }, 300);
    }
    
    async autorizarLiquidacion() {
        if (!this.liquidacionActual) return;
        
        const result = await Swal.fire({
            title: '¿Autorizar Liquidación?',
            text: `¿Está seguro de autorizar la liquidación #${this.liquidacionActual}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '<i class="fas fa-check"></i> Sí, Autorizar',
            cancelButtonText: '<i class="fas fa-times"></i> Cancelar'
        });
        
        if (result.isConfirmed) {
            await this.procesarAutorizacion(this.liquidacionActual, 1);
            this.cerrarModal();
        }
    }
    
    async rechazarLiquidacion() {
        if (!this.liquidacionActual) return;
        
        const { value: motivoRechazo } = await Swal.fire({
            title: '¿Rechazar Liquidación?',
            text: `¿Está seguro de rechazar la liquidación #${this.liquidacionActual}?`,
            input: 'textarea',
            inputLabel: 'Motivo del rechazo (opcional)',
            inputPlaceholder: 'Escriba el motivo por el cual rechaza esta liquidación...',
            inputAttributes: {
                'aria-label': 'Motivo del rechazo',
                'maxlength': '500'
            },
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#FF5252',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '<i class="fas fa-times"></i> Sí, Rechazar',
            cancelButtonText: '<i class="fas fa-ban"></i> Cancelar',
            inputValidator: (value) => {
                if (value && value.length > 500) {
                    return 'El motivo no puede exceder 500 caracteres';
                }
            }
        });
        
        if (motivoRechazo !== undefined) {
            await this.procesarAutorizacion(this.liquidacionActual, 2, motivoRechazo);
            this.cerrarModal();
        }
    }
    
    async procesarAutorizacion(idLiquidacion, estado, motivo = null) {
        try {
            // Mostrar indicador de carga
            Swal.fire({
                title: estado === 1 ? 'Autorizando...' : 'Rechazando...',
                html: 'Procesando la liquidación...',
                showConfirmButton: false,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            // Obtener datos del usuario actual
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const idUsuarioAutoriza = userData.IdPersonal || 1;
            const nombreUsuarioAutoriza = userData.NombreCompleto || 'Usuario Sistema';
            
            const connection = await connectionString();
            
            let updateQuery, updateParams;

            if (estado === 1) {
                // Para autorización (Estado = 1)
                updateQuery = `
                    UPDATE Liquidaciones 
                    SET 
                        Estado = ?,
                        IdUsuarioAutoriza = ?,
                        NombreUsuarioAutoriza = ?,
                        FechaAutoriza = CURDATE(),
                        FechaHoraAutoriza = NOW()
                    WHERE IdLiquidacion = ?
                `;
                updateParams = [estado, idUsuarioAutoriza, nombreUsuarioAutoriza, idLiquidacion];
            } else {
                // Para rechazo (Estado = 2)
                updateQuery = `
                    UPDATE Liquidaciones 
                    SET 
                        Estado = ?,
                        IdUsuarioAutoriza = ?,
                        NombreUsuarioAutoriza = ?,
                        FechaAutoriza = CURDATE(),
                        FechaHoraAutoriza = NOW(),
                        MotivoRechazo = ?
                    WHERE IdLiquidacion = ?
                `;
                updateParams = [estado, idUsuarioAutoriza, nombreUsuarioAutoriza, motivo, idLiquidacion];
            }

            const result = await connection.query(updateQuery, updateParams);
            
            await connection.close();
            
            if (result.affectedRows > 0) {
                // Mostrar mensaje de éxito
                await Swal.fire({
                    icon: 'success',
                    title: estado === 1 ? '¡Liquidación Autorizada!' : '¡Liquidación Rechazada!',
                    text: `La liquidación #${idLiquidacion} ha sido ${estado === 1 ? 'autorizada' : 'rechazada'} exitosamente.`,
                    confirmButtonColor: '#FF9800'
                });
                
                // Recargar datos
                await this.cargarLiquidaciones();
            } else {
                throw new Error('No se pudo actualizar la liquidación');
            }
            
        } catch (error) {
            console.error('Error al procesar autorización:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo procesar la liquidación: ' + error.message,
                confirmButtonColor: '#FF9800'
            });
        }
    }
}

// Funciones globales para los botones de acción
let liquidacionesTable;

async function verDetalles(idLiquidacion) {
    await liquidacionesTable.mostrarDetalles(idLiquidacion);
}

async function autorizarDirecto(idLiquidacion) {
    const result = await Swal.fire({
        title: '¿Autorizar Liquidación?',
        text: `¿Está seguro de autorizar la liquidación #${idLiquidacion}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-check"></i> Sí, Autorizar',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar'
    });
    
    if (result.isConfirmed) {
        await liquidacionesTable.procesarAutorizacion(idLiquidacion, 1);
    }
}

async function rechazarDirecto(idLiquidacion) {
    const { value: motivoRechazo } = await Swal.fire({
        title: '¿Rechazar Liquidación?',
        text: `¿Está seguro de rechazar la liquidación #${idLiquidacion}?`,
        input: 'textarea',
        inputLabel: 'Motivo del rechazo (opcional)',
        inputPlaceholder: 'Escriba el motivo por el cual rechaza esta liquidación...',
        inputAttributes: {
            'aria-label': 'Motivo del rechazo',
            'maxlength': '500'
        },
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#FF5252',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-times"></i> Sí, Rechazar',
        cancelButtonText: '<i class="fas fa-ban"></i> Cancelar',
        inputValidator: (value) => {
            if (value && value.length > 500) {
                return 'El motivo no puede exceder 500 caracteres';
            }
        }
    });
    
    if (motivoRechazo !== undefined) {
        await liquidacionesTable.procesarAutorizacion(idLiquidacion, 2, motivoRechazo);
    }
}

// Utilidades adicionales
function formatearMonedaGlobal(valor) {
    if (!valor || isNaN(valor)) return 'Q 0.00';
    
    const numero = parseFloat(valor);
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numero);
}

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

// Función para exportar datos (para futuro uso)
function exportarLiquidaciones() {
    if (liquidacionesFiltradas.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay liquidaciones para exportar',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    // Preparar datos para exportación
    const datosExport = liquidacionesFiltradas.map(liquidacion => ({
        'ID': liquidacion.IdLiquidacion,
        'Colaborador': liquidacion.NombrePersonal,
        'Fecha Ingreso': liquidacionesTable.formatearFecha(liquidacion.FechaPlanilla),
        'Fecha Fin': liquidacionesTable.formatearFecha(liquidacion.FechaFin),
        'Tipo Liquidación': liquidacionesTable.getTipoLiquidacionTexto(liquidacion.TipoLiquidacion),
        'Días Indemnización': liquidacion.DiasIndemnizacion,
        'Indemnización': liquidacion.MontoIndemnizacion,
        'Aguinaldo': liquidacion.MontoAguinaldo,
        'Vacaciones': liquidacion.MontoVacaciones,
        'Bono 14': liquidacion.MontoBono14,
        'Descuento': liquidacion.DescuentoInterno,
        'Total': liquidacion.Total,
        'Creado por': liquidacion.NombreUsuario,
        'Fecha Registro': liquidacionesTable.formatearFechaHora(liquidacion.FechaHoraRegistro)
    }));
    
    // Convertir a CSV
    const csv = convertirACSV(datosExport);
    descargarCSV(csv, 'liquidaciones_pendientes.csv');
}

function convertirACSV(datos) {
    if (datos.length === 0) return '';
    
    const headers = Object.keys(datos[0]);
    const csvContent = [
        headers.join(','),
        ...datos.map(row => headers.map(header => {
            let value = row[header];
            if (typeof value === 'string' && value.includes(',')) {
                value = `"${value}"`;
            }
            return value;
        }).join(','))
    ].join('\n');
    
    return csvContent;
}

function descargarCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Función para imprimir tabla
function imprimirTabla() {
    if (liquidacionesFiltradas.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay liquidaciones para imprimir',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    const fechaActual = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Liquidaciones Pendientes - ${fechaActual}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #654321; margin-bottom: 5px; }
                .header p { color: #666; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.8rem; }
                th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .monto { font-weight: bold; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
                .badge-tipo { padding: 2px 6px; border-radius: 8px; font-size: 0.7rem; }
                .tipo-parcial { background-color: #e3f2fd; color: #1565c0; }
                .tipo-despido { background-color: #ffebee; color: #c62828; }
                .tipo-renuncia { background-color: #e8f5e8; color: #2e7d32; }
                .periodo-container { font-size: 0.75rem; }
                .fecha-fin { color: #666; font-style: italic; }
                .dias-badge { background: #FF9800; color: white; padding: 2px 6px; border-radius: 6px; font-size: 0.7rem; }
                @media print {
                    body { margin: 0; font-size: 0.7rem; }
                    .no-print { display: none; }
                    table { font-size: 0.65rem; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Liquidaciones Pendientes de Autorización</h1>
                <p>Generado el: ${fechaActual}</p>
                <p>Total de registros: ${liquidacionesFiltradas.length}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Colaborador</th>
                        <th>Período</th>
                        <th>Tipo</th>
                        <th>Días</th>
                        <th class="text-right">Indemnización</th>
                        <th class="text-right">Aguinaldo</th>
                        <th class="text-right">Vacaciones</th>
                        <th class="text-right">Bono 14</th>
                        <th class="text-right">Total</th>
                        <th>Creado por</th>
                        <th>Fecha Registro</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    liquidacionesFiltradas.forEach(liquidacion => {
        const tipoTexto = liquidacionesTable.getTipoLiquidacionTexto(liquidacion.TipoLiquidacion);
        const tipoClase = liquidacionesTable.getTipoLiquidacionClase(liquidacion.TipoLiquidacion);
        
        html += `
            <tr>
                <td>#${liquidacion.IdLiquidacion}</td>
                <td>${liquidacion.NombrePersonal}</td>
                <td>
                    <div class="periodo-container">
                        <div>${liquidacionesTable.formatearFecha(liquidacion.FechaPlanilla)}</div>
                        <div class="fecha-fin">→ ${liquidacionesTable.formatearFecha(liquidacion.FechaFin)}</div>
                    </div>
                </td>
                <td><span class="badge-tipo ${tipoClase}">${tipoTexto}</span></td>
                <td class="text-center"><span class="dias-badge">${liquidacion.DiasIndemnizacion || 0}</span></td>
                <td class="text-right monto">${liquidacionesTable.formatearMoneda(liquidacion.MontoIndemnizacion)}</td>
                <td class="text-right monto">${liquidacionesTable.formatearMoneda(liquidacion.MontoAguinaldo)}</td>
                <td class="text-right monto">${liquidacionesTable.formatearMoneda(liquidacion.MontoVacaciones)}</td>
                <td class="text-right monto">${liquidacionesTable.formatearMoneda(liquidacion.MontoBono14)}</td>
                <td class="text-right monto">${liquidacionesTable.formatearMoneda(liquidacion.Total)}</td>
                <td>${liquidacion.NombreUsuario}</td>
                <td>${liquidacionesTable.formatearFechaHora(liquidacion.FechaHoraRegistro)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
            
            <div class="footer">
                <p>Sistema de Recursos Humanos - Autorización de Liquidaciones</p>
                <p>© New Technology ${new Date().getFullYear()}</p>
            </div>
        </body>
        </html>
    `;
    
    const ventanaImpresion = window.open('', '_blank');
    ventanaImpresion.document.write(html);
    ventanaImpresion.document.close();
    
    setTimeout(() => {
        ventanaImpresion.print();
        ventanaImpresion.close();
    }, 500);
}

// Eventos de teclado para acciones rápidas
document.addEventListener('keydown', function(e) {
    // Escape para cerrar modal
    if (e.key === 'Escape') {
        const modal = document.getElementById('modalDetalles');
        if (modal.style.display === 'block') {
            liquidacionesTable.cerrarModal();
        }
    }
    
    // Ctrl+F para enfocar búsqueda
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        document.getElementById('buscarLiquidacion').focus();
    }
    
    // F5 para refrescar (solo si no está en input)
    if (e.key === 'F5' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        liquidacionesTable.cargarLiquidaciones();
    }
});

// Función para manejar errores de conexión
function manejarErrorConexion(error) {
    console.error('Error de conexión:', error);
    
    Swal.fire({
        icon: 'error',
        title: 'Error de Conexión',
        html: `
            <p>No se pudo establecer conexión con el servidor.</p>
            <p><strong>Detalles:</strong> ${error.message}</p>
            <p>Por favor, verifique su conexión a internet e intente nuevamente.</p>
        `,
        confirmButtonColor: '#FF9800',
        confirmButtonText: 'Reintentar'
    }).then((result) => {
        if (result.isConfirmed) {
            liquidacionesTable.cargarLiquidaciones();
        }
    });
}

// Función para validar permisos de usuario
function validarPermisos() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    if (!userData.IdPersonal) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión No Válida',
            text: 'No se detectó una sesión válida. Por favor, inicie sesión nuevamente.',
            confirmButtonColor: '#FF9800',
            allowOutsideClick: false
        }).then(() => {
            // Redirigir al login o página principal
            window.location.href = '../Login/Login.html';
        });
        return false;
    }
    
    return true;
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Validar permisos primero
    if (!validarPermisos()) {
        return;
    }
    
    // Inicializar la tabla de liquidaciones
    liquidacionesTable = new LiquidacionesTable();
    
    // Configurar otros event listeners globales
    
    // Auto-guardar filtros en localStorage
    const searchInput = document.getElementById('buscarLiquidacion');
    searchInput.addEventListener('input', debounce((e) => {
        localStorage.setItem('liquidaciones_filtro', e.target.value);
    }, 1000));
    
    // Restaurar filtro guardado
    const filtroGuardado = localStorage.getItem('liquidaciones_filtro');
    if (filtroGuardado) {
        searchInput.value = filtroGuardado;
        liquidacionesTable.filtrarLiquidaciones(filtroGuardado);
    }
    
    // Configurar tooltips si es necesario
    configurarTooltips();
    
    // Mensaje de bienvenida
    console.log('🚀 Sistema de Autorización de Liquidaciones cargado correctamente');
});

// Función para configurar tooltips
function configurarTooltips() {
    // Implementar tooltips personalizados si es necesario
    document.querySelectorAll('[title]').forEach(element => {
        element.addEventListener('mouseenter', function(e) {
            // Crear tooltip personalizado si es necesario
        });
    });
}

// Función para limpiar datos temporales
function limpiarDatosTemporales() {
    localStorage.removeItem('liquidaciones_filtro');
    liquidacionesData = [];
    liquidacionesFiltradas = [];
    currentSort = { column: null, direction: 'asc' };
}

// Función de limpieza al salir de la página
window.addEventListener('beforeunload', function() {
    // Limpiar timeouts
    if (timeoutBusqueda) {
        clearTimeout(timeoutBusqueda);
    }
});

// Exportar funciones para uso global
window.verDetalles = verDetalles;
window.autorizarDirecto = autorizarDirecto;
window.rechazarDirecto = rechazarDirecto;
window.exportarLiquidaciones = exportarLiquidaciones;
window.imprimirTabla = imprimirTabla;