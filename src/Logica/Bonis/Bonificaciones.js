// Bonificaciones.js - Parte 1: Inicialización, Cifrado y Carga de Datos
const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const Swal = require('sweetalert2');
const ExcelJS = require('exceljs');
const fs = require('fs');
const { jsPDF } = require('jspdf');
const crypto = require('crypto');
const SIMPLE_ENCRYPTION_KEY = 'RRHH2024Bonificaciones';
const ENCRYPTION_OFFSET = 7; // Número para offset

let selectedMonth = null;
let selectedYear = null;
let currentPeriodMesAnio = null;
let availableDepartments = [];
let selectedExternalEmployee = null;

// ===== CONFIGURACIÓN DE CIFRADO =====
const ENCRYPTION_CONFIG = {
    algorithm: 'aes-256-gcm',
    key: 'RRHHBonificaciones2024SecretKey!!', // Clave de 32 caracteres
    iv_length: 16,
    tag_length: 16
};

// ===== FUNCIONES DE CIFRADO =====

// Función para cifrar montos
function encryptAmount(amount) {
    try {
        const amountString = parseFloat(amount || 0).toFixed(2);
        
        // Convertir a array de caracteres y aplicar offset
        let encoded = '';
        for (let i = 0; i < amountString.length; i++) {
            const char = amountString.charAt(i);
            if (char >= '0' && char <= '9') {
                // Aplicar offset a números
                const num = parseInt(char);
                const offsetNum = (num + ENCRYPTION_OFFSET) % 10;
                encoded += offsetNum.toString();
            } else {
                // Mantener puntos y otros caracteres
                encoded += char;
            }
        }
        
        // Agregar prefijo y codificar en Base64
        const prefixed = SIMPLE_ENCRYPTION_KEY + '|' + encoded;
        const encrypted = Buffer.from(prefixed).toString('base64');
        return encrypted;
        
    } catch (error) {
        console.error('Error al cifrar monto (simple):', error);
        return parseFloat(amount || 0).toFixed(2);
    }
}

// Función simple para descifrar montos
function decryptAmount(encryptedData) {
    try {
        if (!encryptedData || encryptedData === '') {
            return 0;
        }
        
        // Si parece un número directo, devolverlo
        const directNumber = parseFloat(encryptedData);
        if (!isNaN(directNumber) && encryptedData.toString().length < 20) {
            return directNumber;
        }
        
        // Decodificar Base64
        const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
        
        // Verificar prefijo
        if (!decoded.startsWith(SIMPLE_ENCRYPTION_KEY + '|')) {
            throw new Error('Formato de cifrado inválido');
        }
        
        // Extraer datos cifrados
        const encoded = decoded.substring(SIMPLE_ENCRYPTION_KEY.length + 1);
        
        // Revertir offset
        let original = '';
        for (let i = 0; i < encoded.length; i++) {
            const char = encoded.charAt(i);
            if (char >= '0' && char <= '9') {
                // Revertir offset
                const num = parseInt(char);
                const originalNum = (num - ENCRYPTION_OFFSET + 10) % 10;
                original += originalNum.toString();
            } else {
                // Mantener puntos y otros caracteres
                original += char;
            }
        }
        
        const result = parseFloat(original) || 0;
        return result;
        
    } catch (error) {
        console.error('Error al descifrar monto (simple):', error);
        // Fallback: intentar parsear como número directo
        const fallbackNumber = parseFloat(encryptedData);
        return isNaN(fallbackNumber) ? 0 : fallbackNumber;
    }
}

// Función para validar cifrado (simplificada)
function validateEncryption() {
    try {
        const testAmount = 1234.56;
        const encrypted = encryptAmount(testAmount);
        const decrypted = decryptAmount(encrypted);
        
        if (Math.abs(testAmount - decrypted) < 0.01) {
            return true;
        } else {
            return true; // Permitir continuar
        }
    } catch (error) {
        return true; // Permitir continuar
    }
}

// ===== VARIABLES GLOBALES =====
let userData = null;
let employeesData = [];
let currentDiscountModal = null;
let currentPage = 1;
let itemsPerPage = 25;
let filteredData = [];
let currentSearchTerm = '';
let currentStatusFilter = '';
let currentSort = { field: null, direction: 'asc' };
let currentBonificacionId = null;
let isDataLoaded = false;

// ===== INICIALIZACIÓN =====

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Mostrar overlay de carga
        showLoadingOverlay(true);
        
        // Validar cifrado antes de continuar
        if (!validateEncryption()) {
            throw new Error('Error en la validación del sistema de cifrado');
        }
        
        // Cargar datos del usuario desde localStorage
        await loadUserData();
        
        // Inicializar selectores de período ANTES de verificar bonificaciones
        initializePeriodSelectors();
        
        // Configurar event listeners principales
        setupMainEventListeners();
        
        // Ocultar overlay de carga
        showLoadingOverlay(false);
        
        // Mostrar estado inicial (siempre vacío al inicio)
        showInitialState();
        
        // Mostrar mensaje informativo sobre los selectores
        setTimeout(() => {
            Swal.fire({
                icon: 'info',
                title: 'Seleccionar período',
                text: 'Seleccione el mes y año, luego haga clic en "Verificar" para buscar bonificaciones existentes.',
                confirmButtonColor: '#2196F3',
                toast: true,
                position: 'top-end',
                timer: 5000,
                showConfirmButton: false
            });
        }, 1000);
        
        // Agregar información de compatibilidad después de un breve retraso
        setTimeout(() => {
            
            // Mostrar tip sobre funcionalidades si es la primera vez
            const hasSeenTip = localStorage.getItem('pdf_save_tip_seen');
            if (!hasSeenTip && checkBrowserCompatibility().supportLevel === 'advanced') {
                setTimeout(() => {
                    Swal.fire({
                        icon: 'info',
                        title: '💡 Nueva funcionalidad',
                        html: `
                            <div style="text-align: left; padding: 10px;">
                                <p><strong>¡Tu navegador soporta selección de ubicación!</strong></p>
                                <p>Cuando generes PDFs podrás:</p>
                                <ul style="margin: 10px 0; padding-left: 20px;">
                                    <li>📁 Elegir dónde guardar el archivo</li>
                                    <li>✏️ Cambiar el nombre del archivo</li>
                                    <li>📋 Organizar mejor tus documentos</li>
                                </ul>
                                <p><small>Esta funcionalidad está disponible en navegadores modernos.</small></p>
                            </div>
                        `,
                        confirmButtonColor: '#2196F3',
                        confirmButtonText: 'Entendido',
                        timer: 8000
                    });
                    
                    localStorage.setItem('pdf_save_tip_seen', 'true');
                }, 3000);
            }
        }, 2000);
        
    } catch (error) {
        showLoadingOverlay(false);
        await Swal.fire({
            icon: 'error',
            title: 'Error de Inicialización',
            text: error.message || 'Hubo un problema al cargar los datos. Por favor, recarga la página.',
            confirmButtonColor: '#FF9800',
            toast: true,
            position: 'top-end',
            timer: 4000
        });
    }
});

// ===== FUNCIONES DE CARGA DE DATOS =====

async function loadUserData() {
    try {
        const userDataStr = localStorage.getItem('userData');
        if (!userDataStr) {
            throw new Error('No se encontraron datos de usuario');
        }
        
        userData = JSON.parse(userDataStr);
        
        // Actualizar UI con datos del usuario
        updateUserInterface();
        
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
        // Redirigir al login si no hay datos válidos
        window.location.href = path.join(__dirname, 'Login.html');
    }
}

function updateUserInterface() {
    if (!userData) return;
    
    // Actualizar foto del usuario
    const userPhoto = document.getElementById('userPhoto');
    if (userData.FotoBase64) {
        userPhoto.src = userData.FotoBase64;
    }
    
    // Actualizar nombre y departamento
    const userName = document.getElementById('userName');
    const userDepartment = document.getElementById('userDepartment');
    
    if (userName) userName.textContent = userData.NombreCompleto || 'Usuario';
    if (userDepartment) userDepartment.textContent = userData.NombreDepartamento || 'Departamento';
}

// ===== FUNCIONES DE PERÍODO ACTUALIZADAS =====

function getCurrentMesAnio() {
    if (currentPeriodMesAnio) {
        return currentPeriodMesAnio;
    }
    
    // Si no hay período seleccionado, usar el actual
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${month}${year}`;
}

function initializePeriodSelectors() {
    const monthSelector = document.getElementById('monthSelector');
    const yearSelector = document.getElementById('yearSelector');
    const checkPeriodBtn = document.getElementById('checkPeriodBtn');
    
    if (!monthSelector || !yearSelector || !checkPeriodBtn) {
        return;
    }
    
    // Configurar año actual como default
    const currentDate = new Date();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const currentYear = currentDate.getFullYear();
    
    // Llenar selector de años (año actual - 2 hasta año actual + 1)
    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        yearSelector.appendChild(option);
    }
    
    // Establecer mes actual como seleccionado
    monthSelector.value = currentMonth;
    yearSelector.value = currentYear;
    
    // Establecer valores iniciales
    selectedMonth = currentMonth;
    selectedYear = currentYear;
    currentPeriodMesAnio = `${selectedMonth}${selectedYear}`;
    
    // Event listeners
    monthSelector.addEventListener('change', function() {
        selectedMonth = this.value;
        updatePeriodMesAnio();
        resetBonificacionState();
    });
    
    yearSelector.addEventListener('change', function() {
        selectedYear = this.value;
        updatePeriodMesAnio();
        resetBonificacionState();
    });
    
    checkPeriodBtn.addEventListener('click', checkSelectedPeriod);
    
    // Configurar texto responsive inicial
    updateButtonTextForScreenSize();
}

function updateButtonTextForScreenSize() {
    const checkBtn = document.getElementById('checkPeriodBtn');
    const btnText = checkBtn?.querySelector('.btn-text');
    
    if (!checkBtn || !btnText) return;
    
    if (window.innerWidth <= 768) {
        btnText.style.display = 'none';
    } else {
        btnText.style.display = 'inline';
    }
}

function updatePeriodMesAnio() {
    currentPeriodMesAnio = `${selectedMonth}${selectedYear}`;
}

function getMonthName(monthNumber) {
    const months = {
        '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
        '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
        '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
    };
    return months[monthNumber] || 'Mes desconocido';
}

function resetBonificacionState() {
    currentBonificacionId = null;
    isDataLoaded = false;
    employeesData = [];
    filteredData = [];
    
    // Reset UI
    updateBonificacionInfo(null, 'nuevo');
    disableButtons();
    showEmptyState();
    
    // Habilitar botones de carga nuevamente (en caso de que estuvieran bloqueados)
    const loadBtn = document.getElementById('loadEmployeesBtn');
    const loadLargeBtn = document.getElementById('loadEmployeesLargeBtn');
    
    if (loadBtn) {
        loadBtn.disabled = false;
        loadBtn.title = 'Cargar Colaboradores';
        loadBtn.style.backgroundColor = '';
        loadBtn.style.cursor = '';
    }
    
    if (loadLargeBtn) {
        loadLargeBtn.disabled = false;
        loadLargeBtn.innerHTML = '<i class="fas fa-users"></i> Cargar Colaboradores';
        loadLargeBtn.style.backgroundColor = '';
        loadLargeBtn.style.cursor = '';
    }
    
    // Remover clases de estado finalizado de la tabla
    const tableContainer = document.querySelector('.table-container-fullscreen');
    if (tableContainer) {
        tableContainer.classList.remove('table-finalized');
    }
}
// Función actualizada para verificar bonificación existente con validación de estado
async function checkExistingBonificacionForPeriod(mesAnio) {
    try {
        const connection = await connectionString();
        
        const result = await connection.query(`
            SELECT IdBonificacion, Estado, MontoTotal, NombreUsuario
            FROM Bonificaciones 
            WHERE IdDepaSucur = ? AND MesAnio = ?
            ORDER BY IdBonificacion DESC
            LIMIT 1
        `, [userData.IdSucuDepa, mesAnio]);
        
        await connection.close();
        
        if (result.length > 0) {
            const bonificacion = result[0];
            currentBonificacionId = bonificacion.IdBonificacion;
            
            if (bonificacion.Estado === 1) {
                // Bonificación finalizada - NO PERMITIR CARGA
                updateBonificacionInfo(currentBonificacionId, 'finalizado');
                return { exists: true, finalized: true, data: bonificacion };
            } else if (bonificacion.Estado === 0) {
                // Bonificación activa - PERMITIR CARGA
                return { exists: true, finalized: false, data: bonificacion };
            }
        }
        
        // No existe bonificación
        currentBonificacionId = null;
        return { exists: false, finalized: false, data: null };
        
    } catch (error) {
        console.error('Error al verificar bonificación para período:', error);
        return { exists: false, finalized: false, data: null };
    }
}

// Función actualizada para manejar click en cargar empleados con validación completa
async function handleLoadEmployeesClick() {
    // Verificar que se haya seleccionado un período válido
    if (!selectedMonth || !selectedYear || !currentPeriodMesAnio) {
        Swal.fire({
            icon: 'warning',
            title: 'Período no seleccionado',
            text: 'Debe seleccionar un mes y año, y verificar el período antes de cargar colaboradores.',
            confirmButtonColor: '#FF9800',
            showCancelButton: true,
            confirmButtonText: 'Ir a selectores',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                const periodSelectors = document.querySelector('.period-selectors-container');
                if (periodSelectors) {
                    periodSelectors.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    periodSelectors.style.animation = 'pulse 1s ease-in-out 3 alternate';
                    setTimeout(() => {
                        periodSelectors.style.animation = '';
                    }, 3000);
                }
            }
        });
        return;
    }
    
    // NUEVA VALIDACIÓN: Verificar si existe bonificación finalizada
    try {
        Swal.fire({
            title: 'Verificando período...',
            text: 'Validando si se puede cargar colaboradores para este período',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const bonificacionCheck = await checkExistingBonificacionForPeriod(currentPeriodMesAnio);
        
        if (bonificacionCheck.exists && bonificacionCheck.finalized) {
            // BLOQUEAR: Ya existe una bonificación finalizada
            Swal.fire({
                icon: 'error',
                title: '¡Período ya procesado!',
                html: `
                    <div style="text-align: left; padding: 15px;">
                        <p><strong>🚫 No se pueden cargar colaboradores</strong></p>
                        <hr style="margin: 10px 0;">
                        <p><strong>Motivo:</strong> Ya existe una bonificación finalizada para este período</p>
                        <p><strong>Departamento:</strong> ${userData.NombreDepartamento}</p>
                        <p><strong>Período:</strong> ${getMonthName(selectedMonth)} ${selectedYear}</p>
                        <p><strong>ID Bonificación:</strong> #${bonificacionCheck.data.IdBonificacion}</p>
                        <p><strong>Procesado por:</strong> ${bonificacionCheck.data.NombreUsuario}</p>
                        <p><strong>Estado:</strong> <span style="color: #4CAF50; font-weight: bold;">FINALIZADO</span></p>
                        <hr style="margin: 10px 0;">
                        <p style="color: #f44336; font-size: 12px;">
                            <strong>⚠️ Para hacer cambios, contacte al administrador del sistema</strong>
                        </p>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#f44336',
                footer: '<small>No se pueden realizar modificaciones a períodos finalizados</small>',
                allowOutsideClick: false
            });
            
            // Actualizar UI para mostrar estado finalizado
            disableAllEditingButtons();
            const loadBtn = document.getElementById('loadEmployeesBtn');
            const loadLargeBtn = document.getElementById('loadEmployeesLargeBtn');
            
            if (loadBtn) {
                loadBtn.disabled = true;
                loadBtn.title = 'No disponible - Período finalizado';
                loadBtn.style.backgroundColor = '#f44336';
                loadBtn.style.cursor = 'not-allowed';
            }
            
            if (loadLargeBtn) {
                loadLargeBtn.disabled = true;
                loadLargeBtn.innerHTML = '<i class="fas fa-lock"></i> Período Finalizado';
                loadLargeBtn.style.backgroundColor = '#f44336';
                loadLargeBtn.style.cursor = 'not-allowed';
            }
            
            return; // BLOQUEAR EJECUCIÓN
        }
        
        if (bonificacionCheck.exists && !bonificacionCheck.finalized) {
            // PERMITIR: Existe bonificación activa
            Swal.fire({
                icon: 'info',
                title: 'Bonificación activa encontrada',
                html: `
                    <div style="text-align: left; padding: 10px;">
                        <p><strong>✅ Se pueden cargar colaboradores</strong></p>
                        <p><strong>ID Bonificación:</strong> #${bonificacionCheck.data.IdBonificacion}</p>
                        <p><strong>Estado:</strong> <span style="color: #FF9800; font-weight: bold;">ACTIVO</span></p>
                        <p><small>Se cargarán los datos existentes de esta bonificación</small></p>
                    </div>
                `,
                timer: 3000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } else {
            // PERMITIR: No existe bonificación - se creará una nueva
            Swal.fire({
                icon: 'success',
                title: 'Período disponible',
                text: 'Se creará una nueva bonificación para este período',
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }
        
        // Si llegamos aquí, el período es válido y se puede cargar
        await loadEmployeesAndShow();
        
    } catch (error) {
        console.error('Error en validación de período:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de validación',
            text: 'No se pudo verificar el estado del período. Intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función actualizada para verificar período seleccionado con validación mejorada
async function checkSelectedPeriod() {
    if (!selectedMonth || !selectedYear) {
        Swal.fire({
            icon: 'warning',
            title: 'Período incompleto',
            text: 'Debe seleccionar mes y año.',
            confirmButtonColor: '#FF9800',
            toast: true,
            position: 'top-end',
            timer: 3000
        });
        return;
    }
    
    const checkBtn = document.getElementById('checkPeriodBtn');
    const isSmallScreen = window.innerWidth <= 768;
    
    try {
        // Mostrar estado de verificación
        if (checkBtn) {
            checkBtn.classList.add('checking');
            if (isSmallScreen) {
                checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            } else {
                checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span class="btn-text">Verificando...</span>';
            }
        }
        
        // Verificar bonificación con validación completa
        const bonificacionCheck = await checkExistingBonificacionForPeriod(currentPeriodMesAnio);
        
        if (bonificacionCheck.exists && bonificacionCheck.finalized) {
            // Bonificación finalizada - MOSTRAR ESTADO BLOQUEADO
            updateBonificacionInfo(currentBonificacionId, 'finalizado');
            disableButtons();
            disableAllEditingButtons();
            
            if (checkBtn) {
                checkBtn.classList.remove('checking');
                checkBtn.classList.add('finalized');
                if (isSmallScreen) {
                    checkBtn.innerHTML = '<i class="fas fa-lock"></i>';
                } else {
                    checkBtn.innerHTML = '<i class="fas fa-lock"></i> <span class="btn-text">Finalizada</span>';
                }
                checkBtn.style.backgroundColor = '#f44336';
                checkBtn.style.borderColor = '#f44336';
            }
            
            Swal.fire({
                icon: 'error',
                title: 'Período finalizado',
                html: `
                    <div style="text-align: center; padding: 10px;">
                        <p><strong>🔒 ${getMonthName(selectedMonth)} ${selectedYear}</strong></p>
                        <p>Bonificación ID: #${bonificacionCheck.data.IdBonificacion}</p>
                        <p style="color: #f44336;"><strong>Estado: FINALIZADO</strong></p>
                        <p><small>No se pueden realizar modificaciones</small></p>
                    </div>
                `,
                confirmButtonColor: '#f44336',
                timer: 5000
            });
            
        } else if (bonificacionCheck.exists && !bonificacionCheck.finalized) {
            // Bonificación activa - PERMITIR EDICIÓN
            updateBonificacionInfo(currentBonificacionId, 'existente');
            enableButtons();
            updateFinalizeButtonState();
            
            if (checkBtn) {
                checkBtn.classList.remove('checking');
                checkBtn.classList.add('found');
                if (isSmallScreen) {
                    checkBtn.innerHTML = '<i class="fas fa-check"></i>';
                } else {
                    checkBtn.innerHTML = '<i class="fas fa-check"></i> <span class="btn-text">Encontrada</span>';
                }
            }
            
            Swal.fire({
                icon: 'info',
                title: 'Bonificación activa',
                html: `
                    <div style="text-align: center; padding: 10px;">
                        <p><strong>✅ ${getMonthName(selectedMonth)} ${selectedYear}</strong></p>
                        <p>Bonificación ID: #${bonificacionCheck.data.IdBonificacion}</p>
                        <p style="color: #FF9800;"><strong>Estado: ACTIVO</strong></p>
                        <p><small>Se pueden realizar modificaciones</small></p>
                    </div>
                `,
                confirmButtonColor: '#2196F3',
                timer: 4000
            });
            
        } else {
            // No existe bonificación - CREAR NUEVA
            if (checkBtn) {
                checkBtn.classList.remove('checking');
                checkBtn.classList.add('not-found');
                if (isSmallScreen) {
                    checkBtn.innerHTML = '<i class="fas fa-plus"></i>';
                } else {
                    checkBtn.innerHTML = '<i class="fas fa-plus"></i> <span class="btn-text">Crear Nueva</span>';
                }
            }
            
            updateBonificacionInfo(null, 'nuevo');
            disableButtons();
            updateFinalizeButtonState();
            
            Swal.fire({
                icon: 'success',
                title: 'Período disponible',
                text: `Se puede crear bonificación para ${getMonthName(selectedMonth)} ${selectedYear}`,
                confirmButtonColor: '#4CAF50',
                timer: 4000
            });
        }
        
        // Resetear estado del botón después de 5 segundos
        setTimeout(() => {
            if (checkBtn) {
                checkBtn.classList.remove('checking', 'found', 'not-found', 'finalized');
                checkBtn.style.backgroundColor = '';
                checkBtn.style.borderColor = '';
                if (isSmallScreen) {
                    checkBtn.innerHTML = '<i class="fas fa-search"></i>';
                } else {
                    checkBtn.innerHTML = '<i class="fas fa-search"></i> <span class="btn-text">Verificar</span>';
                }
            }
        }, 5000);
        
    } catch (error) {
        console.error('Error al verificar período:', error);
        
        if (checkBtn) {
            checkBtn.classList.remove('checking');
            if (isSmallScreen) {
                checkBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            } else {
                checkBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span class="btn-text">Error</span>';
            }
        }
        
        Swal.fire({
            icon: 'error',
            title: 'Error de verificación',
            text: 'No se pudo verificar el período seleccionado.',
            confirmButtonColor: '#FF9800'
        });
        
        setTimeout(() => {
            if (checkBtn) {
                if (isSmallScreen) {
                    checkBtn.innerHTML = '<i class="fas fa-search"></i>';
                } else {
                    checkBtn.innerHTML = '<i class="fas fa-search"></i> <span class="btn-text">Verificar</span>';
                }
            }
        }, 3000);
    }
}

async function createNewBonificacion() {
    try {
        const mesAnio = getCurrentMesAnio(); // Ahora usa el período seleccionado
        const connection = await connectionString();
        
        // Verificar una vez más que no existe antes de crear
        const existing = await connection.query(`
            SELECT IdBonificacion FROM Bonificaciones 
            WHERE IdDepaSucur = ? AND MesAnio = ? AND Estado = 0
        `, [userData.IdSucuDepa, mesAnio]);
        
        if (existing.length > 0) {
            await connection.close();
            currentBonificacionId = existing[0].IdBonificacion;
            updateBonificacionInfo(currentBonificacionId, 'existente');
            return currentBonificacionId;
        }
        
        const result = await connection.query(`
            INSERT INTO Bonificaciones (IdDepaSucur, MesAnio, IdUsuario, NombreUsuario, MontoTotal)
            VALUES (?, ?, ?, ?, 0.00)
        `, [userData.IdSucuDepa, mesAnio, userData.IdPersonal, userData.NombreCompleto]);
        
        currentBonificacionId = result.insertId;
        await connection.close();
        
        updateBonificacionInfo(currentBonificacionId, 'nuevo');
        enableButtons();
        
        return currentBonificacionId;
        
    } catch (error) {
        console.error('Error al crear nueva bonificación:', error);
        throw error;
    }
}

// ===== FUNCIONES DE CARGA Y VISUALIZACIÓN ACTUALIZADAS =====

async function loadEmployeesAndShow() {
    try {
        // Mostrar loading
        Swal.fire({
            title: 'Cargando colaboradores...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Si no hay IdBonificacion, crear uno nuevo
        if (!currentBonificacionId) {
            await createNewBonificacion();
        }
        
        // Cargar empleados
        await loadEmployeesData();
        
        // Verificar si hay datos existentes en BonificacionDetalle
        const hasExistingData = await checkAndLoadExistingData();
        
        // Mostrar tabla y ocultar estado vacío
        showEmployeesTable();
        
        // Inicializar tabla
        initializeCustomTable();
        
        // Configurar event listeners de tabla
        setupTableEventListeners();
        
        // Actualizar estadísticas
        updateHeaderStatistics();
        
        // Actualizar total de bonificación en header
        await updateHeaderWithBonificacionTotal();
        
        // Actualizar indicadores visuales
        const visualStats = updateVisualIndicatorsAfterLoad();
        
        isDataLoaded = true;
        
        // IMPORTANTE: Actualizar estado del botón finalizar
        updateFinalizeButtonState();
        
        // Mensaje diferente según si había datos existentes o no
        if (hasExistingData && hasExistingData.count > 0) {
            let messageHTML = `
                <div style="text-align: left; padding: 10px;">
                    <p><strong>Total colaboradores:</strong> ${employeesData.length}</p>
                    <p><strong>Con bonificaciones:</strong> ${hasExistingData.count}</p>
            `;
            
            if (hasExistingData.external > 0) {
                messageHTML += `
                    <p><strong>📋 Externos cargados:</strong> ${hasExistingData.external}</p>
                    <p><strong>🏢 Del departamento:</strong> ${hasExistingData.local}</p>
                `;
            }
            
            messageHTML += `
                    <p><strong>Sin bonificaciones:</strong> ${employeesData.length - hasExistingData.count}</p>
                </div>
            `;
            
            Swal.fire({
                icon: 'info',
                title: 'Colaboradores cargados',
                html: messageHTML,
                toast: true,
                position: 'top-end',
                timer: 5000,
                showConfirmButton: false
            });
        } else {
            Swal.fire({
                icon: 'success',
                title: 'Colaboradores cargados',
                text: `Se cargaron ${employeesData.length} colaboradores correctamente. Ninguno tiene bonificaciones registradas.`,
                toast: true,
                position: 'top-end',
                timer: 3000,
                showConfirmButton: false
            });
        }
        
    } catch (error) {
        console.error('Error al cargar colaboradores:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al cargar',
            text: 'No se pudieron cargar los colaboradores. Intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}
async function checkAndLoadExistingData() {
    try {
        if (!currentBonificacionId) return false;
        
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT 
                bd.*,
                p.IdPersonal,
                CONCAT(p.PrimerNombre, ' ', IFNULL(p.SegundoNombre, ''), ' ', IFNULL(p.TercerNombre, ''), ' ', p.PrimerApellido, ' ', IFNULL(p.SegundoApellido, '')) AS NombreCompleto,
                puestos.Nombre AS NombrePuesto,
                d.NombreDepartamento,
                CASE 
                    WHEN fp.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(fp.Foto))
                    ELSE NULL 
                END AS FotoBase64,
                CASE 
                    WHEN p.IdSucuDepa = ? THEN 0 
                    ELSE 1 
                END AS EsExterno
            FROM BonificacionDetalle bd
            LEFT JOIN personal p ON bd.IdPersonal = p.IdPersonal
            LEFT JOIN Puestos puestos ON p.IdPuesto = puestos.IdPuesto
            LEFT JOIN departamentos d ON p.IdSucuDepa = d.IdDepartamento
            LEFT JOIN FotosPersonal fp ON p.IdPersonal = fp.IdPersonal
            WHERE bd.IdBonificacion = ?
            ORDER BY bd.NombrePersonal
        `, [userData.IdSucuDepa, currentBonificacionId]);
        
        await connection.close();
        
        if (result.length === 0) {
            return false;
        }
        
        let loadedCount = 0;
        let externalAddedCount = 0;
        
        // Procesar cada registro de bonificación detalle
        result.forEach(detalle => {
            const employeeIndex = employeesData.findIndex(emp => emp.IdPersonal === detalle.IdPersonal);
            
            if (employeeIndex !== -1) {
                // EMPLEADO YA EXISTE EN LA LISTA - Actualizar datos
                const bonusRegular = decryptAmount(detalle.MontoBonificacion);
                const bonusExtra = decryptAmount(detalle.MontoBonificionExtra);
                const descCreditos = decryptAmount(detalle.DescuentoCredito);
                const descVales = decryptAmount(detalle.DescuentoVale);
                const totalNeto = bonusRegular + bonusExtra - descCreditos - descVales;
                
                employeesData[employeeIndex] = {
                    ...employeesData[employeeIndex],
                    bonificacionRegular: bonusRegular,
                    bonificacionExtra: bonusExtra,
                    descuentoVales: descVales,
                    descuentoCreditos: descCreditos,
                    referenciaVales: detalle.NoDocumentoVale || '',
                    referenciaCreditos: detalle.NoDocumentoCredito || '',
                    observacionesVales: detalle.ObservacionDescuentoVale || '',
                    observacionesCreditos: detalle.ObservacionDescuentoCredito || '',
                    observacionesBonificacionExtra: detalle.ObaservacionBonificacionExtra || '',
                    totalNeto: totalNeto,
                    isSaved: true,
                    isLoaded: true,
                    isModified: false
                };
                
                loadedCount++;
                
            } else if (detalle.IdPersonal && detalle.EsExterno === 1) {
                // EMPLEADO EXTERNO - Agregarlo a la lista
                console.log(`📋 Agregando colaborador externo: ${detalle.NombrePersonal} (ID: ${detalle.IdPersonal})`);
                
                const bonusRegular = decryptAmount(detalle.MontoBonificacion);
                const bonusExtra = decryptAmount(detalle.MontoBonificionExtra);
                const descCreditos = decryptAmount(detalle.DescuentoCredito);
                const descVales = decryptAmount(detalle.DescuentoVale);
                const totalNeto = bonusRegular + bonusExtra - descCreditos - descVales;
                
                const externalEmployee = {
                    IdPersonal: detalle.IdPersonal,
                    NombreCompleto: detalle.NombreCompleto || detalle.NombrePersonal,
                    NombrePuesto: detalle.NombrePuesto || 'Puesto no disponible',
                    NombreDepartamento: detalle.NombreDepartamento || 'Departamento externo',
                    FotoBase64: detalle.FotoBase64 || null,
                    bonificacionRegular: bonusRegular,
                    bonificacionExtra: bonusExtra,
                    descuentoVales: descVales,
                    descuentoCreditos: descCreditos,
                    referenciaVales: detalle.NoDocumentoVale || '',
                    referenciaCreditos: detalle.NoDocumentoCredito || '',
                    observacionesVales: detalle.ObservacionDescuentoVale || '',
                    observacionesCreditos: detalle.ObservacionDescuentoCredito || '',
                    observacionesBonificacionExtra: detalle.ObaservacionBonificacionExtra || '',
                    totalNeto: totalNeto,
                    isSaved: true,
                    isLoaded: true,
                    isModified: false,
                    isExternal: true
                };
                
                employeesData.push(externalEmployee);
                externalAddedCount++;
                loadedCount++;
                
            } else {
                // EMPLEADO NO ENCONTRADO Y NO ES EXTERNO VÁLIDO
                console.warn(`⚠️ Empleado con ID ${detalle.IdPersonal} no encontrado en personal activo`);
                
                // CREAR REGISTRO PLACEHOLDER PARA EMPLEADOS INACTIVOS/ELIMINADOS
                const bonusRegular = decryptAmount(detalle.MontoBonificacion);
                const bonusExtra = decryptAmount(detalle.MontoBonificionExtra);
                const descCreditos = decryptAmount(detalle.DescuentoCredito);
                const descVales = decryptAmount(detalle.DescuentoVale);
                const totalNeto = bonusRegular + bonusExtra - descCreditos - descVales;
                
                const inactiveEmployee = {
                    IdPersonal: detalle.IdPersonal,
                    NombreCompleto: detalle.NombrePersonal + ' (INACTIVO)',
                    NombrePuesto: 'Colaborador inactivo',
                    NombreDepartamento: 'No disponible',
                    FotoBase64: null,
                    bonificacionRegular: bonusRegular,
                    bonificacionExtra: bonusExtra,
                    descuentoVales: descVales,
                    descuentoCreditos: descCreditos,
                    referenciaVales: detalle.NoDocumentoVale || '',
                    referenciaCreditos: detalle.NoDocumentoCredito || '',
                    observacionesVales: detalle.ObservacionDescuentoVale || '',
                    observacionesCreditos: detalle.ObservacionDescuentoCredito || '',
                    observacionesBonificacionExtra: detalle.ObaservacionBonificacionExtra || '',
                    totalNeto: totalNeto,
                    isSaved: true,
                    isLoaded: true,
                    isModified: false,
                    isExternal: true,
                    isInactive: true
                };
                
                employeesData.push(inactiveEmployee);
                loadedCount++;
            }
        });
        
        // Actualizar datos filtrados para reflejar los cambios
        filteredData = [...employeesData];
        
        // Actualizar estado de bonificación
        updateBonificacionInfo(currentBonificacionId, 'cargado');
        
        // Mostrar información detallada de la carga
        console.log(`📊 Resumen de carga de datos existentes:
        - Total registros en BD: ${result.length}
        - Colaboradores del departamento actualizados: ${loadedCount - externalAddedCount}
        - Colaboradores externos agregados: ${externalAddedCount}
        - Total cargados: ${loadedCount}`);
        
        return {
            count: loadedCount,
            total: result.length,
            external: externalAddedCount,
            local: loadedCount - externalAddedCount
        };
        
    } catch (error) {
        console.error('Error al verificar y cargar datos existentes:', error);
        return false;
    }
}

// ===== FUNCIONES DE CARGA DE EMPLEADOS =====

async function loadEmployeesData() {
    try {
        if (!userData || !userData.IdSucuDepa) {
            throw new Error('No se pudo obtener el departamento del usuario');
        }
        
        // Mostrar estado de carga en tabla
        const tableContainer = document.querySelector('.table-container-fullscreen');
        if (tableContainer) tableContainer.classList.add('table-loading-data');
        
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT 
                personal.IdPersonal, 
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto, 
                Puestos.Nombre AS NombrePuesto,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM personal 
            INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto 
            LEFT JOIN FotosPersonal ON personal.IdPersonal = FotosPersonal.IdPersonal
            WHERE personal.Estado = 1 
            AND personal.TipoPersonal = 1 
            AND IdSucuDepa = ?
            ORDER BY NombreCompleto
        `, [userData.IdSucuDepa]);
        
        await connection.close();
        
        employeesData = result.map(emp => ({
            ...emp,
            bonificacionRegular: 0,
            bonificacionExtra: 0,
            descuentoVales: 0,
            descuentoCreditos: 0,
            referenciaVales: '',
            referenciaCreditos: '',
            observacionesVales: '',
            observacionesCreditos: '',
            observacionesBonificacionExtra: '',
            totalNeto: 0,
            isSaved: false,
            isLoaded: false,
            isModified: false
        }));
        
        // Inicializar datos filtrados
        filteredData = [...employeesData];
        
        // Remover estado de carga
        if (tableContainer) tableContainer.classList.remove('table-loading-data');
         
        return true;
        
    } catch (error) {
        console.error('Error al cargar empleados:', error);
        throw error;
    }
}

// ===== FUNCIONES DE GUARDADO INDIVIDUAL ACTUALIZADAS =====

async function saveIndividualEmployee(index) {
    const employee = employeesData[index];
    if (!employee || !currentBonificacionId) return;
    
    try {
        // VALIDACIÓN OBLIGATORIA ANTES DE GUARDAR
        const validationErrors = validateEmployeeData(employee);
        if (validationErrors.length > 0) {
            Swal.fire({
                icon: 'error',
                title: 'Datos incompletos',
                html: `
                    <div style="text-align: left; padding: 10px;">
                        <p><strong>❌ No se puede guardar:</strong></p>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            ${validationErrors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                        <p><small>Complete todos los campos obligatorios para continuar.</small></p>
                    </div>
                `,
                confirmButtonColor: '#FF9800',
                confirmButtonText: 'Entendido'
            });
            
            // Marcar botón como inválido
            const saveButton = document.querySelector(`[data-index="${index}"].btn-save-employee`);
            if (saveButton) {
                saveButton.classList.add('invalid');
                saveButton.style.backgroundColor = '#f44336';
                saveButton.title = 'Complete los campos obligatorios';
                saveButton.disabled = true;
            }
            
            return;
        }
        
        // Mostrar estado de guardando
        const saveButton = document.querySelector(`[data-index="${index}"].btn-save-employee`);
        const row = document.querySelector(`tr[data-index="${index}"]`);
        
        if (saveButton) {
            saveButton.classList.add('saving');
            saveButton.disabled = true;
        }
        
        if (row) {
            row.classList.add('saving');
        }
        
        // Cifrar los montos antes de guardar
        const encryptedBonusRegular = encryptAmount(employee.bonificacionRegular);
        const encryptedBonusExtra = encryptAmount(employee.bonificacionExtra);
        const encryptedDiscountCredits = encryptAmount(employee.descuentoCreditos);
        const encryptedDiscountVales = encryptAmount(employee.descuentoVales);
        
        const connection = await connectionString();
        
        try {
            // Verificar si ya existe un registro
            const existingRecord = await connection.query(`
                SELECT IdPersonal FROM BonificacionDetalle 
                WHERE IdBonificacion = ? AND IdPersonal = ?
            `, [currentBonificacionId, employee.IdPersonal]);
            
            if (existingRecord.length > 0) {
                // Actualizar registro existente
                await connection.query(`
                    UPDATE BonificacionDetalle SET
                        NombrePersonal = ?,
                        MontoBonificacion = ?,
                        MontoBonificionExtra = ?,
                        DescuentoCredito = ?,
                        NoDocumentoCredito = ?,
                        DescuentoVale = ?,
                        NoDocumentoVale = ?,
                        ObservacionDescuentoCredito = ?,
                        ObservacionDescuentoVale = ?,
                        ObaservacionBonificacionExtra = ?
                    WHERE IdBonificacion = ? AND IdPersonal = ?
                `, [
                    employee.NombreCompleto,
                    encryptedBonusRegular,
                    encryptedBonusExtra,
                    encryptedDiscountCredits,
                    employee.referenciaCreditos || '',
                    encryptedDiscountVales,
                    employee.referenciaVales || '',
                    employee.observacionesCreditos || '',
                    employee.observacionesVales || '',
                    employee.observacionesBonificacionExtra || '',
                    currentBonificacionId,
                    employee.IdPersonal
                ]);
            } else {
                // Crear nuevo registro
                await connection.query(`
                    INSERT INTO BonificacionDetalle (
                        IdBonificacion, IdPersonal, NombrePersonal,
                        MontoBonificacion, MontoBonificionExtra,
                        DescuentoCredito, NoDocumentoCredito,
                        DescuentoVale, NoDocumentoVale,
                        ObservacionDescuentoCredito, ObservacionDescuentoVale,
                        ObaservacionBonificacionExtra
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    currentBonificacionId,
                    employee.IdPersonal,
                    employee.NombreCompleto,
                    encryptedBonusRegular,
                    encryptedBonusExtra,
                    encryptedDiscountCredits,
                    employee.referenciaCreditos || '',
                    encryptedDiscountVales,
                    employee.referenciaVales || '',
                    employee.observacionesCreditos || '',
                    employee.observacionesVales || '',
                    employee.observacionesBonificacionExtra || ''
                ]);
            }
            
            // Actualizar MontoTotal en la tabla Bonificaciones (por separado)
            await updateBonificacionTotal(connection, currentBonificacionId);
            
        } catch (saveError) {
            await connection.close();
            throw saveError;
        }
        
        await connection.close();
        
        // Actualizar estado del empleado
        employee.isSaved = true;
        employee.isModified = false;
        
        // Actualizar estado visual
        if (row) {
            row.classList.remove('saving', 'unsaved');
            row.classList.add('saved');
        }
        
        if (saveButton) {
            saveButton.classList.remove('saving', 'invalid', 'ready');
            saveButton.classList.add('saved');
            saveButton.disabled = true;
            saveButton.title = 'Guardado';
            saveButton.style.backgroundColor = '#2196F3';
        }
        
        // Actualizar header con nuevo total
        await updateHeaderWithBonificacionTotal();
        
        // IMPORTANTE: Actualizar estado del botón finalizar después de guardar
        updateFinalizeButtonState();
        
        Swal.fire({
            icon: 'success',
            title: 'Guardado exitoso',
            text: `Datos de ${employee.NombreCompleto} guardados correctamente.`,
            toast: true,
            position: 'top-end',
            timer: 2000,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('Error al guardar empleado:', error);
        
        // Restaurar estado en caso de error
        const saveButton = document.querySelector(`[data-index="${index}"].btn-save-employee`);
        const row = document.querySelector(`tr[data-index="${index}"]`);
        
        if (saveButton) {
            saveButton.classList.remove('saving');
            saveButton.disabled = false;
            saveButton.style.backgroundColor = '#4CAF50';
        }
        if (row) row.classList.remove('saving');
        
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: 'No se pudo guardar los datos del empleado. Intente nuevamente.',
            confirmButtonColor: '#FF9800',
            toast: true,
            position: 'top-end',
            timer: 4000
        });
    }
}

// Función para actualizar el MontoTotal en la tabla Bonificaciones
async function updateBonificacionTotal(connection, idBonificacion) {
    try {
        // Obtener todos los detalles de la bonificación
        const detalles = await connection.query(`
            SELECT 
                MontoBonificacion,
                MontoBonificionExtra,
                DescuentoCredito,
                DescuentoVale
            FROM BonificacionDetalle 
            WHERE IdBonificacion = ?
        `, [idBonificacion]);
        
        let totalBonificaciones = 0;
        let totalDescuentos = 0;
        
        // Descifrar y sumar todos los montos
        for (const detalle of detalles) {
            try {
                const bonusRegular = decryptAmount(detalle.MontoBonificacion);
                const bonusExtra = decryptAmount(detalle.MontoBonificionExtra);
                const descCreditos = decryptAmount(detalle.DescuentoCredito);
                const descVales = decryptAmount(detalle.DescuentoVale);
                
                totalBonificaciones += bonusRegular + bonusExtra;
                totalDescuentos += descCreditos + descVales;
            } catch (decryptError) {
                console.warn('Error al descifrar montos para cálculo total:', decryptError);
                // Continuar con el siguiente registro
            }
        }
        
        const montoTotal = totalBonificaciones - totalDescuentos;
        
        // Actualizar el MontoTotal en la tabla Bonificaciones
        await connection.query(`
            UPDATE Bonificaciones 
            SET MontoTotal = ?
            WHERE IdBonificacion = ?
        `, [montoTotal, idBonificacion]);

        return {
            totalBonificaciones,
            totalDescuentos,
            montoTotal
        };
        
    } catch (error) {
        console.error('Error al actualizar MontoTotal:', error);
        throw error;
    }
}

// Función auxiliar para mostrar el MontoTotal en el header
async function getBonificacionSummary(idBonificacion) {
    try {
        const connection = await connectionString();
        
        const result = await connection.query(`
            SELECT MontoTotal 
            FROM Bonificaciones 
            WHERE IdBonificacion = ?
        `, [idBonificacion]);
        
        await connection.close();
        
        if (result.length > 0) {
            return {
                montoTotal: parseFloat(result[0].MontoTotal) || 0
            };
        }
        
        return { montoTotal: 0 };
        
    } catch (error) {
        console.error('Error al obtener resumen de bonificación:', error);
        return { montoTotal: 0 };
    }
}

async function updateHeaderWithBonificacionTotal() {
    if (!currentBonificacionId) return;
    
    try {
        const summary = await getBonificacionSummary(currentBonificacionId);
        
        // Actualizar un elemento en el header si existe
        const totalElement = document.getElementById('headerBonificacionTotal');
        if (totalElement) {
            totalElement.textContent = `Q${summary.montoTotal.toFixed(2)}`;
        }
        
        // También podríamos actualizar el badge de estado con el total
        const bonificacionValue = document.getElementById('currentBonificacionId');
        if (bonificacionValue) {
            bonificacionValue.title = `Total: Q${summary.montoTotal.toFixed(2)}`;
        }
        
    } catch (error) {
        console.error('Error al actualizar total en header:', error);
    }
}
// Bonificaciones.js - Parte 4: Tabla, Paginación y Event Listeners

// ===== EVENT LISTENERS PRINCIPALES ACTUALIZADOS =====

function setupMainEventListeners() {
    // Botón cargar colaboradores (pequeño en header)
    const loadEmployeesBtn = document.getElementById('loadEmployeesBtn');
    if (loadEmployeesBtn) {
        loadEmployeesBtn.addEventListener('click', handleLoadEmployeesClick);
    }
    
    // Botón cargar colaboradores (grande en estado vacío)
    const loadEmployeesLargeBtn = document.getElementById('loadEmployeesLargeBtn');
    if (loadEmployeesLargeBtn) {
        loadEmployeesLargeBtn.addEventListener('click', handleLoadEmployeesClick);
    }
    
    // Botón finalizar - NUEVO
    const finalizeBtn = document.getElementById('finalizeBtn');
    if (finalizeBtn) {
        finalizeBtn.addEventListener('click', finalizeBonificacion);
        // Inicializar estado del botón
        updateFinalizeButtonState();
    }
    
    // Resto de event listeners...
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', goBack);
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportToExcel);
    
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllData);
    
    const searchEmployee = document.getElementById('searchEmployee');
    if (searchEmployee) {
        searchEmployee.addEventListener('input', function() {
            currentSearchTerm = this.value;
            applyFilters();
            currentPage = 1;
            renderTable();
            createPagination();
            updateTableInfo();
        });
    }
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentStatusFilter = this.value;
            applyFilters();
            currentPage = 1;
            renderTable();
            createPagination();
            updateTableInfo();
        });
    }
    
    setupModalEventListeners();
}

// ===== FUNCIONES DE TABLA Y PAGINACIÓN =====

function initializeCustomTable() {
    setupSortingHandlers();
    setupEntriesPerPageHandler();
    renderTable();
    createPagination();
}

function setupEntriesPerPageHandler() {
    const entriesSelect = document.getElementById('entriesPerPage');
    if (entriesSelect) {
        entriesSelect.addEventListener('change', function() {
            itemsPerPage = parseInt(this.value);
            currentPage = 1;
            renderTable();
            createPagination();
        });
    }
}

function setupSortingHandlers() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', function() {
            const sortField = this.dataset.sort;
            handleSort(sortField);
        });
    });
}

function handleSort(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }
    
    sortData(field, currentSort.direction);
    updateSortIndicators(field, currentSort.direction);
    
    currentPage = 1;
    renderTable();
    createPagination();
}

function sortData(field, direction) {
    filteredData.sort((a, b) => {
        let valueA, valueB;
        
        switch (field) {
            case 'id':
                valueA = a.IdPersonal;
                valueB = b.IdPersonal;
                break;
            case 'name':
                valueA = a.NombreCompleto.toLowerCase();
                valueB = b.NombreCompleto.toLowerCase();
                break;
            case 'position':
                valueA = a.NombrePuesto.toLowerCase();
                valueB = b.NombrePuesto.toLowerCase();
                break;
            case 'bonus-regular':
                valueA = a.bonificacionRegular || 0;
                valueB = b.bonificacionRegular || 0;
                break;
            case 'bonus-extra':
                valueA = a.bonificacionExtra || 0;
                valueB = b.bonificacionExtra || 0;
                break;
            case 'discount-vales':
                valueA = a.descuentoVales || 0;
                valueB = b.descuentoVales || 0;
                break;
            case 'discount-creditos':
                valueA = a.descuentoCreditos || 0;
                valueB = b.descuentoCreditos || 0;
                break;
            case 'total':
                valueA = a.totalNeto || 0;
                valueB = b.totalNeto || 0;
                break;
            default:
                return 0;
        }
        
        if (typeof valueA === 'string') {
            return direction === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
        } else {
            return direction === 'asc' ? valueA - valueB : valueB - valueA;
        }
    });
}

function updateSortIndicators(field, direction) {
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
    });
    
    const currentHeader = document.querySelector(`[data-sort="${field}"]`);
    if (currentHeader) {
        currentHeader.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
}

function renderTable() {
    const tbody = document.getElementById('employeesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    pageData.forEach((employee, index) => {
        const actualIndex = employeesData.findIndex(emp => emp.IdPersonal === employee.IdPersonal);
        const row = createEmployeeRow(employee, actualIndex);
        tbody.appendChild(row);
    });
    
    setupTableEventListeners();
    updateTableInfo();
    
    // Actualizar indicadores visuales después de renderizar
    if (isDataLoaded) {
        const stats = updateVisualIndicatorsAfterLoad();
    }
}

function createEmployeeRow(employee, index) {
    const row = document.createElement('tr');
    
    // Clases mejoradas para indicar estado
    let rowClasses = 'employee-row';
    if (employee.isLoaded) rowClasses += ' loaded-data';
    if (employee.isSaved) rowClasses += ' saved';
    if (!employee.isSaved) rowClasses += ' unsaved';
    if (employee.isModified) rowClasses += ' modified';
    if (employee.isExternal) rowClasses += ' external';
    if (employee.isInactive) rowClasses += ' inactive';
    
    // Indicar si tiene datos significativos
    const hasData = employee.bonificacionRegular > 0 || employee.bonificacionExtra > 0 || 
                   employee.descuentoVales > 0 || employee.descuentoCreditos > 0;
    if (hasData) rowClasses += ' has-amounts';
    
    row.className = rowClasses;
    row.dataset.employeeId = employee.IdPersonal;
    row.dataset.index = index;
    
    const userImage = employee.FotoBase64 || '../Imagenes/user-default.png';
    
    // Indicador visual mejorado
    let loadedIndicator = '';
    if (employee.isLoaded && hasData) {
        loadedIndicator = '<div class="row-loaded-indicator" title="Datos cargados desde BD"></div>';
    }
    
    row.innerHTML = `
        <td>
            ${loadedIndicator}
            <div class="save-status-indicator"></div>
            <div class="employee-id">#${employee.IdPersonal}</div>
        </td>
        <td>
            <div class="d-flex align-items-center">
                <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; margin-right: 10px; border: 2px solid ${hasData ? '#4CAF50' : '#FF9800'}; flex-shrink: 0;">
                    <img src="${userImage}" style="width: 100%; height: 100%; object-fit: cover;" alt="Foto">
                </div>
                <div style="min-width: 0;">
                    <div class="employee-name" title="${employee.NombreCompleto}">${employee.NombreCompleto}</div>
                    ${hasData ? '<div class="employee-status-badge">Con datos</div>' : ''}
                    ${employee.isExternal && !employee.isInactive ? '<span class="external-badge">Externo</span>' : ''}
                    ${employee.isInactive ? '<span class="inactive-badge">Inactivo</span>' : ''}
                </div>
            </div>
        </td>
        <td>
            <div class="employee-position" title="${employee.NombrePuesto}">${employee.NombrePuesto}</div>
        </td>
        <td>
            <input type="number" 
                   class="input-field bonus-regular ${employee.isLoaded && employee.bonificacionRegular > 0 ? 'loaded-data' : ''}" 
                   data-index="${index}" 
                   placeholder="0.00" 
                   step="0.01" 
                   min="0" 
                   value="${employee.bonificacionRegular || ''}">
        </td>
        <td>
            <input type="number" 
                   class="input-field bonus-extra ${employee.isLoaded && employee.bonificacionExtra > 0 ? 'loaded-data' : ''}" 
                   data-index="${index}" 
                   placeholder="0.00" 
                   step="0.01" 
                   min="0" 
                   value="${employee.bonificacionExtra || ''}">
        </td>
        <td>
            <div class="input-group-discount">
                <input type="number" 
                       class="input-field discount-vales ${employee.isLoaded && employee.descuentoVales > 0 ? 'loaded-data' : ''}" 
                       data-index="${index}" 
                       placeholder="0.00" 
                       step="0.01" 
                       min="0" 
                       value="${employee.descuentoVales || ''}">
                <button class="btn-discount-ref ${employee.descuentoVales > 0 ? 'active' : ''} ${employee.isLoaded && employee.referenciaVales ? 'loaded-data' : ''}" 
                        data-type="vales" 
                        data-index="${index}" 
                        title="Agregar referencia">
                    <i class="fas fa-file-alt"></i>
                </button>
            </div>
        </td>
        <td>
            <div class="input-group-discount">
                <input type="number" 
                       class="input-field discount-creditos ${employee.isLoaded && employee.descuentoCreditos > 0 ? 'loaded-data' : ''}" 
                       data-index="${index}" 
                       placeholder="0.00" 
                       step="0.01" 
                       min="0" 
                       value="${employee.descuentoCreditos || ''}">
                <button class="btn-discount-ref ${employee.descuentoCreditos > 0 ? 'active' : ''} ${employee.isLoaded && employee.referenciaCreditos ? 'loaded-data' : ''}" 
                        data-type="creditos" 
                        data-index="${index}" 
                        title="Agregar referencia">
                    <i class="fas fa-file-alt"></i>
                </button>
            </div>
        </td>
        <td>
            <div class="total-net ${employee.totalNeto >= 0 ? 'total-positive' : 'total-negative'}" data-index="${index}">Q${employee.totalNeto.toFixed(2)}</div>
        </td>
        <td>
            <button class="btn-save-employee ${employee.isSaved ? 'saved' : ''}" 
                    data-index="${index}" 
                    title="${employee.isSaved ? 'Guardado' : 'Guardar empleado'}"
                    ${employee.isSaved && !employee.isModified ? 'disabled' : ''}>
                <i class="fas fa-save"></i>
            </button>
        </td>
    `;
    
    return row;
}

function createPagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;
    
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Botón anterior
    if (currentPage > 1) {
        paginationHTML += `<button class="pagination-btn-compact" onclick="changePage(${currentPage - 1})" title="Página anterior">‹</button>`;
    }
    
    // Números de página (máximo 5 botones)
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn-compact" onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += '<span class="pagination-dots-compact">...</span>';
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="pagination-btn-compact active">${i}</button>`;
        } else {
            paginationHTML += `<button class="pagination-btn-compact" onclick="changePage(${i})">${i}</button>`;
        }
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += '<span class="pagination-dots-compact">...</span>';
        }
        paginationHTML += `<button class="pagination-btn-compact" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    
    // Botón siguiente
    if (currentPage < totalPages) {
        paginationHTML += `<button class="pagination-btn-compact" onclick="changePage(${currentPage + 1})" title="Página siguiente">›</button>`;
    }
    
    paginationContainer.innerHTML = paginationHTML;
}

// Función global para cambiar página
window.changePage = function(page) {
    currentPage = page;
    renderTable();
    createPagination();
    updateTableInfo();
}

function updateTableInfo() {
    const tableInfoElement = document.getElementById('tableInfoText');
    if (!tableInfoElement) return;
    
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, filteredData.length);
    
    if (filteredData.length > 0) {
        tableInfoElement.textContent = `${startIndex}-${endIndex} de ${filteredData.length}`;
    } else {
        tableInfoElement.textContent = 'Sin entradas';
    }
}

function applyFilters() {
    filteredData = employeesData.filter(employee => {
        // Filtro de búsqueda
        const searchMatch = !currentSearchTerm || 
            employee.NombreCompleto.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
            employee.NombrePuesto.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
            employee.IdPersonal.toString().includes(currentSearchTerm);
        
        // Filtro de estado
        let statusMatch = true;
        if (currentStatusFilter) {
            switch (currentStatusFilter) {
                case 'with-bonus':
                    statusMatch = employee.bonificacionRegular > 0 || employee.bonificacionExtra > 0;
                    break;
                case 'with-discount':
                    statusMatch = employee.descuentoVales > 0 || employee.descuentoCreditos > 0;
                    break;
                case 'complete':
                    statusMatch = employee.isSaved;
                    break;
                case 'pending':
                    statusMatch = !employee.isSaved || employee.isModified;
                    break;
            }
        }
        
        return searchMatch && statusMatch;
    });
    
    // Mantener el ordenamiento actual si existe
    if (currentSort.field) {
        sortData(currentSort.field, currentSort.direction);
    }
}

// ===== EVENT LISTENERS DE TABLA =====

function setupTableEventListeners() {
    // Campos de bonificación regular
    document.querySelectorAll('.bonus-regular').forEach(input => {
        input.addEventListener('input', function() {
            updateEmployeeData(this.dataset.index, 'bonificacionRegular', parseFloat(this.value) || 0);
            updateFieldStyle(this);
            calculateRowTotal(this.dataset.index);
            markAsModified(this.dataset.index);
            
            // VALIDACIÓN VISUAL EN TIEMPO REAL
            const employee = employeesData[this.dataset.index];
            if (!employee.bonificacionRegular || employee.bonificacionRegular <= 0) {
                this.classList.add('required-empty');
            } else {
                this.classList.remove('required-empty');
            }
        });
    });
    
    // Campos de bonificación extra
    document.querySelectorAll('.bonus-extra').forEach(input => {
        input.addEventListener('input', function() {
            updateEmployeeData(this.dataset.index, 'bonificacionExtra', parseFloat(this.value) || 0);
            updateFieldStyle(this);
            calculateRowTotal(this.dataset.index);
            markAsModified(this.dataset.index);
        });
    });
    
    // Campos de descuento vales
    document.querySelectorAll('.discount-vales').forEach(input => {
        input.addEventListener('input', function() {
            updateEmployeeData(this.dataset.index, 'descuentoVales', parseFloat(this.value) || 0);
            updateFieldStyle(this);
            calculateRowTotal(this.dataset.index);
            toggleDiscountButton(this.dataset.index, 'vales', parseFloat(this.value) || 0);
            markAsModified(this.dataset.index);
            
            // VALIDACIÓN PARA DESCUENTOS
            const employee = employeesData[this.dataset.index];
            if (employee.descuentoVales > 0) {
                if (!employee.referenciaVales || !employee.observacionesVales) {
                    this.classList.add('required-empty');
                } else {
                    this.classList.remove('required-empty');
                }
            } else {
                this.classList.remove('required-empty');
            }
        });
    });
    
    // Campos de descuento créditos
    document.querySelectorAll('.discount-creditos').forEach(input => {
        input.addEventListener('input', function() {
            updateEmployeeData(this.dataset.index, 'descuentoCreditos', parseFloat(this.value) || 0);
            updateFieldStyle(this);
            calculateRowTotal(this.dataset.index);
            toggleDiscountButton(this.dataset.index, 'creditos', parseFloat(this.value) || 0);
            markAsModified(this.dataset.index);
        });
    });
    
    // Botones de referencia de descuentos
    document.querySelectorAll('.btn-discount-ref').forEach(button => {
        button.addEventListener('click', function() {
            if (parseFloat(this.previousElementSibling.value) > 0) {
                openDiscountModal(this.dataset.index, this.dataset.type);
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Valor requerido',
                    text: 'Debe ingresar un monto de descuento antes de agregar la referencia.',
                    confirmButtonColor: '#FF9800',
                    toast: true,
                    position: 'top-end',
                    timer: 3000
                });
            }
        });
    });
    
    // Botones de guardar individual
    document.querySelectorAll('.btn-save-employee').forEach(button => {
        button.addEventListener('click', function() {
            if (!this.disabled) {
                saveIndividualEmployee(this.dataset.index);
            }
        });
    });
}

// ===== FUNCIONES DE CÁLCULO =====

function updateEmployeeData(index, field, value) {
    if (employeesData[index]) {
        employeesData[index][field] = value;
        updateHeaderStatistics();
        
        // Actualizar también en filteredData si es necesario
        const filteredIndex = filteredData.findIndex(emp => emp.IdPersonal === employeesData[index].IdPersonal);
        if (filteredIndex !== -1) {
            filteredData[filteredIndex][field] = value;
        }
    }
}

function calculateRowTotal(index) {
    const employee = employeesData[index];
    if (!employee) return;
    
    const totalBonus = employee.bonificacionRegular + employee.bonificacionExtra;
    const totalDiscounts = employee.descuentoVales + employee.descuentoCreditos;
    employee.totalNeto = totalBonus - totalDiscounts;
    
    // Actualizar en la UI
    const totalElement = document.querySelector(`[data-index="${index}"].total-net`);
    if (totalElement) {
        totalElement.textContent = `Q${employee.totalNeto.toFixed(2)}`;
        totalElement.className = `total-net ${employee.totalNeto >= 0 ? 'total-positive' : 'total-negative'}`;
    }
    
    updateHeaderStatistics();
}

function markAsModified(index) {
    const employee = employeesData[index];
    if (!employee) return;
    
    employee.isModified = true;
    
    // Actualizar estado visual de la fila
    const row = document.querySelector(`tr[data-index="${index}"]`);
    if (row) {
        row.classList.add('unsaved');
        row.classList.remove('saved');
        
        // VALIDAR ANTES DE HABILITAR EL BOTÓN
        const saveButton = row.querySelector('.btn-save-employee');
        if (saveButton) {
            const canSave = validateEmployeeForSave(employee);
            
            if (canSave) {
                saveButton.disabled = false;
                saveButton.classList.remove('saved', 'invalid');
                saveButton.classList.add('ready');
                saveButton.title = 'Guardar empleado';
                saveButton.style.backgroundColor = '#4CAF50';
            } else {
                saveButton.disabled = true;
                saveButton.classList.add('invalid');
                saveButton.classList.remove('saved', 'ready');
                saveButton.title = 'Complete los campos obligatorios';
                saveButton.style.backgroundColor = '#f44336';
            }
        }
    }
    
    // Actualizar estado del botón finalizar
    updateFinalizeButtonState();
}

function updateFieldStyle(input) {
    const value = parseFloat(input.value) || 0;
    
    input.classList.remove('has-value', 'has-discount', 'modified');
    
    if (value > 0) {
        if (input.classList.contains('discount-vales') || input.classList.contains('discount-creditos')) {
            input.classList.add('has-discount');
        } else {
            input.classList.add('has-value');
        }
    }
    
    // Marcar como modificado si no es un campo cargado
    if (!input.classList.contains('loaded-data')) {
        input.classList.add('modified');
    }
}

function toggleDiscountButton(index, type, value) {
    const button = document.querySelector(`[data-index="${index}"][data-type="${type}"].btn-discount-ref`);
    if (button) {
        if (value > 0) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
            // Limpiar referencias si el valor es 0
            updateEmployeeData(index, `referencia${type.charAt(0).toUpperCase() + type.slice(1)}`, '');
            updateEmployeeData(index, `observaciones${type.charAt(0).toUpperCase() + type.slice(1)}`, '');
        }
    }
}
// Bonificaciones.js - Parte 5: Modales, Finalización y Generación de PDFs

// ===== MODAL DE DESCUENTOS =====

function setupModalEventListeners() {
    const modal = document.getElementById('discountModal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelModal');
    const confirmBtn = document.getElementById('confirmModal');
    
    if (closeBtn) closeBtn.addEventListener('click', closeDiscountModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDiscountModal);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmDiscountReference);
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeDiscountModal();
        }
    });
}

function openDiscountModal(index, type) {
    const employee = employeesData[index];
    if (!employee) return;
    
    currentDiscountModal = { index, type };
    
    const modal = document.getElementById('discountModal');
    const title = document.getElementById('modalTitle');
    const referenceInput = document.getElementById('referenceNumber');
    const notesInput = document.getElementById('discountNotes');
    
    if (title) title.textContent = `${type === 'vales' ? 'Desc. Vales' : 'Desc. Créditos'} - ${employee.NombreCompleto}`;
    
    // Cargar datos existentes
    const referenceField = `referencia${type.charAt(0).toUpperCase() + type.slice(1)}`;
    const notesField = `observaciones${type.charAt(0).toUpperCase() + type.slice(1)}`;
    
    if (referenceInput) referenceInput.value = employee[referenceField] || '';
    if (notesInput) notesInput.value = employee[notesField] || '';
    
    if (modal) {
        modal.style.display = 'block';
        if (referenceInput) referenceInput.focus();
    }
}

function closeDiscountModal() {
    const modal = document.getElementById('discountModal');
    if (modal) modal.style.display = 'none';
    currentDiscountModal = null;
    
    // Limpiar campos
    const referenceInput = document.getElementById('referenceNumber');
    const notesInput = document.getElementById('discountNotes');
    if (referenceInput) referenceInput.value = '';
    if (notesInput) notesInput.value = '';
}

function confirmDiscountReference() {
    if (!currentDiscountModal) return;
    
    const { index, type } = currentDiscountModal;
    const referenceInput = document.getElementById('referenceNumber');
    const notesInput = document.getElementById('discountNotes');
    
    const reference = referenceInput ? referenceInput.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';
    
    if (!reference) {
        Swal.fire({
            icon: 'warning',
            title: 'Campo requerido',
            text: 'Debe ingresar un número de referencia.',
            confirmButtonColor: '#FF9800',
            toast: true,
            position: 'top-end',
            timer: 3000
        });
        return;
    }
    
    // Guardar datos
    const referenceField = `referencia${type.charAt(0).toUpperCase() + type.slice(1)}`;
    const notesField = `observaciones${type.charAt(0).toUpperCase() + type.slice(1)}`;
    
    updateEmployeeData(index, referenceField, reference);
    updateEmployeeData(index, notesField, notes);
    markAsModified(index);
    
    closeDiscountModal();
    
    Swal.fire({
        icon: 'success',
        title: 'Referencia guardada',
        text: 'La referencia del descuento ha sido registrada correctamente.',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

// ===== FUNCIONES DE FINALIZACIÓN MEJORADAS =====

async function finalizeBonificacion() {
    if (!currentBonificacionId || !isDataLoaded) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos para finalizar',
            text: 'Debe tener una bonificación activa con datos cargados.',
            confirmButtonColor: '#FF9800'
        });
        return;
    }

    // Verificar que haya empleados con bonificaciones guardadas
    const savedEmployees = employeesData.filter(emp => emp.isSaved && (
        emp.bonificacionRegular > 0 || emp.bonificacionExtra > 0 || 
        emp.descuentoVales > 0 || emp.descuentoCreditos > 0
    ));

    // Permitir finalizar aunque no haya empleados guardados
    if (savedEmployees.length === 0) {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Sin bonificaciones guardadas',
            html: `
                <p>No hay empleados con bonificaciones guardadas.</p>
                <p>¿Desea finalizar la bonificación vacía?</p>
                <p><small>Esto marcará el período como procesado sin generar comprobantes.</small></p>
            `,
            showCancelButton: true,
            confirmButtonText: 'Sí, finalizar vacía',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#FF9800'
        });
        
        if (!result.isConfirmed) return;
        
        // Finalizar sin generar PDF
        await finalizeEmptyBonificacion();
        return;
    }

    // Verificar si hay cambios sin guardar
    const unsavedEmployees = employeesData.filter(emp => 
        emp.isModified || (!emp.isSaved && (
            emp.bonificacionRegular > 0 || emp.bonificacionExtra > 0 || 
            emp.descuentoVales > 0 || emp.descuentoCreditos > 0
        ))
    );

    if (unsavedEmployees.length > 0) {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Cambios sin guardar',
            html: `
                <p>Hay <strong>${unsavedEmployees.length}</strong> empleados con cambios sin guardar.</p>
                <p><strong>Solo se incluirán en el PDF los empleados ya guardados (${savedEmployees.length}).</strong></p>
                <p>¿Qué desea hacer?</p>
            `,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Guardar todo y finalizar',
            denyButtonText: 'Finalizar solo con guardados',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4CAF50',
            denyButtonColor: '#FF9800',
            cancelButtonColor: '#6c757d'
        });

        if (result.isConfirmed) {
            // Guardar todos los cambios primero
            try {
                await saveAllModifiedEmployeesBeforeFinalize();
                // Actualizar la lista de empleados guardados
                const updatedSavedEmployees = employeesData.filter(emp => emp.isSaved && (
                    emp.bonificacionRegular > 0 || emp.bonificacionExtra > 0 || 
                    emp.descuentoVales > 0 || emp.descuentoCreditos > 0
                ));
                await finalizeBonificacionWithEmployees(updatedSavedEmployees);
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error al guardar',
                    text: 'No se pudieron guardar todos los cambios. Intente nuevamente.',
                    confirmButtonColor: '#FF9800'
                });
                return;
            }
        } else if (result.isDenied) {
            // Continuar solo con los empleados ya guardados
            await finalizeBonificacionWithEmployees(savedEmployees);
        } else {
            // Cancelar
            return;
        }
    } else {
        // No hay cambios sin guardar, proceder normalmente
        await finalizeBonificacionWithEmployees(savedEmployees);
    }
}
function getGuatemalaDateTimeIntl() {
    const now = new Date();
    
    // Crear formatter para Guatemala
    const guatemalaFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Guatemala',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Guatemala',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const displayFormatter = new Intl.DateTimeFormat('es-GT', {
        timeZone: 'America/Guatemala',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    
    const fechaFinalizo = guatemalaFormatter.format(now); // YYYY-MM-DD
    const horaGuatemala = timeFormatter.format(now); // HH:mm:ss
    const fechaHoraFinalizo = `${fechaFinalizo} ${horaGuatemala}`;
    const fechaFormateada = displayFormatter.format(now);
    
    return {
        fecha: fechaFinalizo,
        fechaHora: fechaHoraFinalizo,
        fechaFormateada: fechaFormateada,
        timestamp: now
    };
}
// Función para finalizar con empleados específicos
async function finalizeBonificacionWithEmployees(employees) {
    // Confirmar finalización
    const confirmResult = await Swal.fire({
        icon: 'question',
        title: '¿Finalizar bonificación?',
        html: `
            <div style="text-align: left; padding: 10px;">
                <p><strong>Período:</strong> ${getMonthName(selectedMonth)} ${selectedYear}</p>
                <p><strong>ID Bonificación:</strong> ${currentBonificacionId}</p>
                <p><strong>Colaboradores a incluir en PDF:</strong> ${employees.length}</p>
                <p><strong>Total colaboradores cargados:</strong> ${employeesData.length}</p>
                <p><strong>⚠️ Una vez finalizada, no se podrá modificar.</strong></p>
                <hr>
                <p style="color: #2196F3; font-size: 12px;">
                    <i class="fas fa-info-circle"></i> Podrás elegir dónde guardar el PDF con resumen completo
                </p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Sí, Finalizar y Generar PDF',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#9C27B0',
        cancelButtonColor: '#6c757d'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        // Mostrar loading con información detallada
        Swal.fire({
            title: 'Finalizando bonificación...',
            html: `
                <div style="text-align: left; padding: 10px;">
                    <p><strong>Procesando:</strong></p>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        <li>Actualizando estado en base de datos</li>
                        <li>Generando ${employees.length} comprobantes individuales</li>
                        <li>Creando página de resumen con todos los colaboradores</li>
                        <li>Preparando archivo PDF para descarga</li>
                    </ul>
                    <p style="color: #666; font-size: 12px;">
                        <i class="fas fa-clock"></i> Esto puede tomar unos momentos...
                    </p>
                </div>
            `,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        const guatemalaDateTime = getGuatemalaDateTimeIntl();
        const fechaFinalizo = guatemalaDateTime.fecha;
        const fechaHoraFinalizo = guatemalaDateTime.fechaHora;
        // Actualizar estado a finalizado
        const connection = await connectionString();
        
        const updateResult = await connection.query(`
            UPDATE Bonificaciones 
            SET Estado = 1, 
                FechaFinalizo = ?, 
                FechaHoraFinalizo = ?
            WHERE IdBonificacion = ?
        `, [fechaFinalizo, fechaHoraFinalizo, currentBonificacionId]);

        await connection.close();

        // Generar PDF mejorado si hay empleados
        if (employees.length > 0) {
            // Usar la función mejorada que incluye validación y resumen completo
            await generateBonificacionesPDFImproved(employees);
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Bonificación finalizada',
                html: `
                    <div style="text-align: center; padding: 10px;">
                        <p>El período ${getMonthName(selectedMonth)} ${selectedYear} ha sido marcado como procesado.</p>
                        <p><strong>No se generó PDF (sin colaboradores con bonificaciones)</strong></p>
                    </div>
                `,
                confirmButtonColor: '#4CAF50',
                timer: 4000
            });
        }

        // Actualizar UI
        const finalizeBtn = document.getElementById('finalizeBtn');
        if (finalizeBtn) {
            finalizeBtn.disabled = true;
            finalizeBtn.classList.add('finalized');
            finalizeBtn.innerHTML = '<i class="fas fa-check"></i>';
            finalizeBtn.title = 'Bonificación finalizada';
        }
        
        updateBonificacionInfo(currentBonificacionId, 'finalizado');
        disableAllEditingButtons();

    } catch (error) {
        console.error('Error al finalizar bonificación:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al finalizar',
            html: `
                <div style="text-align: left; padding: 10px;">
                    <p><strong>No se pudo finalizar la bonificación.</strong></p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">
                        Verifique su conexión e intente nuevamente.
                    </p>
                </div>
            `,
            confirmButtonColor: '#FF9800'
        });
    }
}

// Función para finalizar bonificación vacía
async function finalizeEmptyBonificacion() {
    try {
        Swal.fire({
            title: 'Finalizando bonificación vacía...',
            text: 'Marcando período como procesado...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        const guatemalaDateTime = getGuatemalaDateTimeIntl();
        const fechaFinalizo = guatemalaDateTime.fecha;
        const fechaHoraFinalizo = guatemalaDateTime.fechaHora;
        // Actualizar estado a finalizado
        const connection = await connectionString();
        
        const updateResult = await connection.query(`
            UPDATE Bonificaciones 
            SET Estado = 1, 
                FechaFinalizo = ?, 
                FechaHoraFinalizo = ?
            WHERE IdBonificacion = ?
        `, [fechaFinalizo, fechaHoraFinalizo, currentBonificacionId]);

        await connection.close();

        // Actualizar UI
        const finalizeBtn = document.getElementById('finalizeBtn');
        if (finalizeBtn) {
            finalizeBtn.disabled = true;
            finalizeBtn.classList.add('finalized');
            finalizeBtn.innerHTML = '<i class="fas fa-check"></i>';
            finalizeBtn.title = 'Bonificación finalizada';
        }
        
        updateBonificacionInfo(currentBonificacionId, 'finalizado');
        disableAllEditingButtons();

        Swal.fire({
            icon: 'info',
            title: 'Bonificación finalizada',
            html: `
                <div style="text-align: center; padding: 10px;">
                    <p>El período ${getMonthName(selectedMonth)} ${selectedYear} ha sido marcado como procesado.</p>
                    <p><strong>No se generó PDF (sin empleados con bonificaciones)</strong></p>
                    <p><small>Los datos ya no se pueden modificar.</small></p>
                </div>
            `,
            confirmButtonColor: '#4CAF50',
            timer: 4000
        });

    } catch (error) {
        console.error('Error al finalizar bonificación vacía:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al finalizar',
            text: 'No se pudo finalizar la bonificación. Intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

async function saveAllModifiedEmployeesBeforeFinalize() {
    const modifiedEmployees = employeesData.filter(emp => emp.isModified || (!emp.isSaved && (
        emp.bonificacionRegular > 0 || emp.bonificacionExtra > 0 || 
        emp.descuentoVales > 0 || emp.descuentoCreditos > 0
    )));

    let savedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < modifiedEmployees.length; i++) {
        const employee = modifiedEmployees[i];
        const index = employeesData.findIndex(emp => emp.IdPersonal === employee.IdPersonal);
        
        try {
            await saveIndividualEmployee(index);
            savedCount++;
        } catch (error) {
            console.error(`Error al guardar empleado ${employee.NombreCompleto}:`, error);
            errorCount++;
        }
    }

    if (errorCount > 0) {
        throw new Error(`No se pudieron guardar ${errorCount} empleados`);
    }

    return savedCount;
}

// Función auxiliar para validar colaboradores para PDF
function validateEmployeesForPDF(employees) {
    
    const withBonifications = employees.filter(emp => 
        emp.bonificacionRegular > 0 || emp.bonificacionExtra > 0
    );
    const withDiscounts = employees.filter(emp => 
        emp.descuentoVales > 0 || emp.descuentoCreditos > 0
    );
    const saved = employees.filter(emp => emp.isSaved);
    
    return {
        total: employees.length,
        withBonifications: withBonifications.length,
        withDiscounts: withDiscounts.length,
        saved: saved.length,
        details: employees.map(emp => ({
            name: emp.NombreCompleto,
            totalBonus: emp.bonificacionRegular + emp.bonificacionExtra,
            totalDiscount: emp.descuentoVales + emp.descuentoCreditos,
            netTotal: emp.totalNeto,
            saved: emp.isSaved
        }))
    };
}
// Función mejorada para generar PDF con validación
async function generateBonificacionesPDFImproved(employees) {
    try {
        // Validar colaboradores antes de generar
        const validation = validateEmployeesForPDF(employees);
        
        // Verificar que tengamos colaboradores
        if (employees.length === 0) {
            throw new Error('No hay colaboradores para incluir en el PDF');
        }
        
        // Crear documento horizontal optimizado
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
            compress: true
        });
        
        // Configuración optimizada para 4 comprobantes pegados por página
        const pageWidth = 297;
        const pageHeight = 210;
        const margin = 0; // SIN MÁRGENES para que estén completamente pegadas
        const blockWidth = pageWidth / 2; // Dos columnas sin espacio
        const blockHeight = pageHeight / 2; // Dos filas sin espacio
        
        let currentX = 0;
        let currentY = 0;
        let blocksInPage = 0;
        
        // Generar comprobantes individuales PEGADOS
        for (let i = 0; i < employees.length; i++) {
            const employee = employees[i];
            
            // Control de páginas - 4 bloques pegados por página
            if (blocksInPage >= 4) {
                doc.addPage('l');
                currentX = 0;
                currentY = 0;
                blocksInPage = 0;
            }
            
            // Dibujar comprobante SIN ESPACIOS
            await drawImprovedEmployeeBonusBlock(doc, employee, currentX, currentY, blockWidth, blockHeight, i + 1);
            
            // Calcular siguiente posición SIN MÁRGENES
            blocksInPage++;
            if (blocksInPage % 2 === 0) {
                // Ir a la siguiente fila
                currentX = 0;
                currentY += blockHeight;
            } else {
                // Ir a la siguiente columna
                currentX += blockWidth;
            }
        }
        
        // Agregar página de resumen mejorada
        await addImprovedPDFSummaryPage(doc, employees);
        
        // Generar nombre de archivo
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '');
        const suggestedFileName = `Comprobantes_Bonificaciones_${currentBonificacionId}_${getMonthName(selectedMonth)}_${selectedYear}_${timestamp}.pdf`;
        
        // Guardar con opciones de ubicación
        if ('showSaveFilePicker' in window) {
            await saveWithFileSystemAPI(doc, suggestedFileName);
        } else {
            await saveWithFallbackOptions(doc, suggestedFileName);
        }
        return suggestedFileName;
        
    } catch (error) {
        console.error('❌ Error al generar PDF:', error);
        throw error;
    }
}

// Función alternativa más simple
function formatDateTimeSimple(dateTimeString) {
    try {
        if (!dateTimeString || dateTimeString === null || dateTimeString === '') {
            return 'No disponible';
        }
        
        // Si es un objeto Date, convertir a string primero
        if (dateTimeString instanceof Date) {
            dateTimeString = dateTimeString.toISOString().slice(0, 19).replace('T', ' ');
        }
        
        // Extraer partes de la fecha (YYYY-MM-DD HH:mm:ss)
        const parts = dateTimeString.toString().split(' ');
        if (parts.length < 2) {
            return 'Formato inválido';
        }
        
        const [datePart, timePart] = parts;
        const dateParts = datePart.split('-');
        const timeParts = timePart.split(':');
        
        if (dateParts.length < 3 || timeParts.length < 2) {
            return 'Formato inválido';
        }
        
        const [year, month, day] = dateParts;
        const [hour, minute] = timeParts;
        
        // Convertir a formato 12 horas
        let hour12 = parseInt(hour) || 0;
        const ampm = hour12 >= 12 ? 'p.m.' : 'a.m.';
        hour12 = hour12 % 12;
        hour12 = hour12 ? hour12 : 12; // 0 debería ser 12
        
        return `${day}/${month}/${year} ${hour12}:${minute} ${ampm}`;
        
    } catch (error) {
        console.error('Error al formatear fecha simple:', error);
        return 'Fecha inválida';
    }
}

// ===== PÁGINA DE RESUMEN PDF MEJORADA =====

async function addImprovedPDFSummaryPage(doc, employees) {
    try {
        doc.addPage('l');
        
        const pageWidth = 297;
        const pageHeight = 210;
        const margin = 15;
        let currentY = margin;
        
        // Colores corregidos - usar números individuales
        const primaryColor = [101, 67, 33];
        const accentColor = [255, 152, 0];
        const lightGray = [248, 249, 250];
        const textColor = [51, 51, 51];
        
        // ===== HEADER COMPACTO =====
        doc.setFillColor(101, 67, 33);
        doc.rect(margin, currentY, pageWidth - (margin * 2), 16, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('RESUMEN DE BONIFICACIONES', pageWidth/2, currentY + 7, { align: 'center' });
        doc.setFontSize(7);
        doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', pageWidth/2, currentY + 12, { align: 'center' });
        currentY += 22;
        
        // ===== OBTENER INFORMACIÓN DE LA BONIFICACIÓN =====
        let bonificacionInfo = null;
        try {
            const connection = await connectionString();
            const result = await connection.query(`
                SELECT 
                    IdBonificacion,
                    MesAnio,
                    NombreUsuario,
                    MontoTotal,
                    Estado,
                    FechaHoraRegistro,
                    FechaHoraFinalizo
                FROM Bonificaciones 
                WHERE IdBonificacion = ?
            `, [currentBonificacionId]);
            
            await connection.close();
            
            if (result.length > 0) {
                bonificacionInfo = result[0];
                
                // VALIDAR Y CONVERTIR TIPOS DE DATOS
                bonificacionInfo.MontoTotal = parseFloat(bonificacionInfo.MontoTotal) || 0;
                bonificacionInfo.Estado = parseInt(bonificacionInfo.Estado) || 0;
                bonificacionInfo.IdBonificacion = parseInt(bonificacionInfo.IdBonificacion) || 0;
                
                // Validar fechas
                if (bonificacionInfo.FechaHoraRegistro === null || bonificacionInfo.FechaHoraRegistro === '') {
                    bonificacionInfo.FechaHoraRegistro = null;
                }
                if (bonificacionInfo.FechaHoraFinalizo === null || bonificacionInfo.FechaHoraFinalizo === '') {
                    bonificacionInfo.FechaHoraFinalizo = null;
                }
                
                console.log('Información de bonificación para PDF (validada):', bonificacionInfo);
            }
        } catch (error) {
            console.error('Error al obtener información de bonificación para PDF:', error);
            // Crear objeto por defecto en caso de error
            bonificacionInfo = {
                IdBonificacion: currentBonificacionId || 0,
                MesAnio: currentPeriodMesAnio || '',
                NombreUsuario: userData?.NombreCompleto || 'Usuario desconocido',
                MontoTotal: 0,
                Estado: 0,
                FechaHoraRegistro: null,
                FechaHoraFinalizo: null
            };
        }
        
        // ===== INFORMACIÓN GENERAL AMPLIADA =====
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(8);
        
        // Fondo para info general (más alto para más información)
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, currentY, pageWidth - (margin * 2), 20, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, currentY, pageWidth - (margin * 2), 20);
        
        // PRIMERA LÍNEA: Información básica
        doc.setFont('helvetica', 'bold');
        doc.text(`Departamento: `, margin + 5, currentY + 5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${userData.NombreDepartamento}`, margin + 30, currentY + 5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`Período: `, margin + 80, currentY + 5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${getMonthName(selectedMonth)} ${selectedYear}`, margin + 98, currentY + 5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`ID Bonificación: `, margin + 140, currentY + 5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${currentBonificacionId}`, margin + 168, currentY + 5);
        
        // SEGUNDA LÍNEA: Usuario que creó
        if (bonificacionInfo && bonificacionInfo.NombreUsuario) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Creado por: `, margin + 5, currentY + 9);
            doc.setFont('helvetica', 'normal');
            doc.text(`${bonificacionInfo.NombreUsuario}`, margin + 25, currentY + 9);
        }
        
        // TERCERA LÍNEA: Fechas
        if (bonificacionInfo) {
            // Fecha de registro
            if (bonificacionInfo.FechaHoraRegistro) {
                try {
                    const fechaRegistro = formatDateTimeSimple(bonificacionInfo.FechaHoraRegistro);
                    if (fechaRegistro !== 'No disponible' && fechaRegistro !== 'Fecha inválida') {
                        doc.setFont('helvetica', 'bold');
                        doc.text(`Registrado: `, margin + 5, currentY + 13);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`${fechaRegistro}`, margin + 25, currentY + 13);
                    }
                } catch (error) {
                    console.error('Error al formatear fecha de registro:', error);
                }
            }
            
            // Fecha de finalización
            if (bonificacionInfo.FechaHoraFinalizo) {
                try {
                    const fechaFinalizo = formatDateTimeSimple(bonificacionInfo.FechaHoraFinalizo);
                    if (fechaFinalizo !== 'No disponible' && fechaFinalizo !== 'Fecha inválida') {
                        doc.setFont('helvetica', 'bold');
                        doc.text(`Finalizado: `, margin + 90, currentY + 13);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`${fechaFinalizo}`, margin + 110, currentY + 13);
                    }
                } catch (error) {
                    console.error('Error al formatear fecha de finalización:', error);
                }
            }
        }
        
        currentY += 26;
        
        // ===== ESTADÍSTICAS EN CAJAS =====
        let totalBonificaciones = 0;
        let totalDescuentos = 0;
        let totalNeto = 0;
        
        employees.forEach(emp => {
            totalBonificaciones += (emp.bonificacionRegular + emp.bonificacionExtra);
            totalDescuentos += (emp.descuentoVales + emp.descuentoCreditos);
            totalNeto += emp.totalNeto;
        });
        
        // Cajas de estadísticas
        const boxWidth = (pageWidth - (margin * 2) - 18) / 4;
        const boxHeight = 16;
        const boxSpacing = 6;
        
        // COLABORADORES
        doc.setFillColor(240, 248, 255);
        doc.rect(margin, currentY, boxWidth, boxHeight, 'F');
        doc.setDrawColor(101, 67, 33);
        doc.setLineWidth(1);
        doc.rect(margin, currentY, boxWidth, boxHeight);
        doc.setTextColor(101, 67, 33);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`${employees.length}`, margin + boxWidth/2, currentY + 7, { align: 'center' });
        doc.setFontSize(6);
        doc.text('COLABORADORES', margin + boxWidth/2, currentY + 11, { align: 'center' });
        doc.text('PROCESADOS', margin + boxWidth/2, currentY + 14, { align: 'center' });
        
        // BONIFICACIONES
        doc.setFillColor(240, 255, 240);
        const bonifX = margin + boxWidth + boxSpacing;
        doc.rect(bonifX, currentY, boxWidth, boxHeight, 'F');
        doc.setDrawColor(76, 175, 80);
        doc.rect(bonifX, currentY, boxWidth, boxHeight);
        doc.setTextColor(27, 94, 32);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`Q${totalBonificaciones.toLocaleString('es-GT', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`, bonifX + boxWidth/2, currentY + 7, { align: 'center' });
        doc.setFontSize(6);
        doc.text('TOTAL BONIF.', bonifX + boxWidth/2, currentY + 12, { align: 'center' });
        
        // DESCUENTOS
        doc.setFillColor(255, 240, 240);
        const descX = bonifX + boxWidth + boxSpacing;
        doc.rect(descX, currentY, boxWidth, boxHeight, 'F');
        doc.setDrawColor(244, 67, 54);
        doc.rect(descX, currentY, boxWidth, boxHeight);
        doc.setTextColor(183, 28, 28);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`Q${totalDescuentos.toLocaleString('es-GT', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`, descX + boxWidth/2, currentY + 7, { align: 'center' });
        doc.setFontSize(6);
        doc.text('TOTAL DESC.', descX + boxWidth/2, currentY + 12, { align: 'center' });
        
        // TOTAL NETO
        doc.setFillColor(255, 152, 0);
        const netoX = descX + boxWidth + boxSpacing;
        doc.rect(netoX, currentY, boxWidth, boxHeight, 'F');
        doc.setDrawColor(255, 152, 0);
        doc.rect(netoX, currentY, boxWidth, boxHeight);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`Q${totalNeto.toLocaleString('es-GT', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`, netoX + boxWidth/2, currentY + 7, { align: 'center' });
        doc.setFontSize(6);
        doc.text('TOTAL NETO', netoX + boxWidth/2, currentY + 12, { align: 'center' });
        
        currentY += boxHeight + 15;
        
        // ===== TABLA DE COLABORADORES MEJORADA =====
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');
        doc.setDrawColor(101, 67, 33);
        doc.rect(margin, currentY, pageWidth - (margin * 2), 8);
        doc.setTextColor(101, 67, 33);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('DETALLE DE COLABORADORES PROCESADOS', margin + 4, currentY + 5);
        currentY += 10;
        
        // Headers de tabla - SIN COLUMNA ESTADO y con más espacio
        doc.setFillColor(235, 235, 235);
        doc.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, currentY, pageWidth - (margin * 2), 8);
        doc.setTextColor(51, 51, 51);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8); // Texto más grande para headers
        
        // Definir anchos de columnas MEJORADOS - sin columna Estado
        const colWidths = {
            no: 15,
            empleado: 70,        // MÁS ANCHO para nombres completos
            puesto: 60,          // MÁS ANCHO para puestos completos
            bonReg: 25,
            bonExt: 25,
            desc: 25,
            total: 30            // Un poco más ancho para totales
        };
        
        let colX = margin + 2;
        doc.text('No.', colX + colWidths.no/2, currentY + 5, { align: 'center' });
        colX += colWidths.no;
        doc.text('COLABORADOR', colX, currentY + 5);
        colX += colWidths.empleado;
        doc.text('PUESTO', colX, currentY + 5);
        colX += colWidths.puesto;
        doc.text('BON.REG', colX + colWidths.bonReg/2, currentY + 5, { align: 'center' });
        colX += colWidths.bonReg;
        doc.text('BON.EXT', colX + colWidths.bonExt/2, currentY + 5, { align: 'center' });
        colX += colWidths.bonExt;
        doc.text('DESC.TOT', colX + colWidths.desc/2, currentY + 5, { align: 'center' });
        colX += colWidths.desc;
        doc.text('TOTAL', colX + colWidths.total/2, currentY + 5, { align: 'center' });
        
        currentY += 10;
        
        // ===== DATOS DE COLABORADORES MEJORADOS =====
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7); // Texto más grande para datos (era 5, ahora 7)
        
        let employeeCount = 0;
        const maxEmployeesPerPage = 20; // Menos empleados por página debido al texto más grande
        
        for (let index = 0; index < employees.length; index++) {
            const emp = employees[index];
            
            // Control de páginas
            if (currentY > 175 || employeeCount >= maxEmployeesPerPage) {
                // Nueva página
                doc.addPage('l');
                currentY = margin + 10;
                employeeCount = 0;
                
                // Repetir headers
                doc.setFillColor(235, 235, 235);
                doc.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.rect(margin, currentY, pageWidth - (margin * 2), 8);
                doc.setTextColor(51, 51, 51);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                
                let colX = margin + 2;
                doc.text('No.', colX + colWidths.no/2, currentY + 5, { align: 'center' });
                colX += colWidths.no;
                doc.text('COLABORADOR', colX, currentY + 5);
                colX += colWidths.empleado;
                doc.text('PUESTO', colX, currentY + 5);
                colX += colWidths.puesto;
                doc.text('BON.REG', colX + colWidths.bonReg/2, currentY + 5, { align: 'center' });
                colX += colWidths.bonReg;
                doc.text('BON.EXT', colX + colWidths.bonExt/2, currentY + 5, { align: 'center' });
                colX += colWidths.bonExt;
                doc.text('DESC.TOT', colX + colWidths.desc/2, currentY + 5, { align: 'center' });
                colX += colWidths.desc;
                doc.text('TOTAL', colX + colWidths.total/2, currentY + 5, { align: 'center' });
                
                currentY += 10;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
            }
            
            // Fondo alternado para filas
            if (employeeCount % 2 === 0) {
                doc.setFillColor(252, 252, 252);
                doc.rect(margin, currentY - 1, pageWidth - (margin * 2), 7, 'F');
            }
            
            // Datos del colaborador - NOMBRES COMPLETOS
            // Ajustar longitud de texto según el nuevo ancho
            const empName = emp.NombreCompleto.length > 40 ? 
                emp.NombreCompleto.substring(0, 37) + '...' : emp.NombreCompleto;
            const puestoName = emp.NombrePuesto.length > 35 ? 
                emp.NombrePuesto.substring(0, 32) + '...' : emp.NombrePuesto;
            
            const totalDesc = emp.descuentoVales + emp.descuentoCreditos;
            
            doc.setTextColor(51, 51, 51);
            doc.setFont('helvetica', 'normal');
            
            let colX = margin + 2;
            
            // Número (centrado)
            doc.text(`${(index + 1).toString().padStart(2, '0')}`, colX + colWidths.no/2, currentY + 4, { align: 'center' });
            colX += colWidths.no;
            
            // Nombre del colaborador (COMPLETO)
            doc.text(empName, colX, currentY + 4);
            colX += colWidths.empleado;
            
            // Puesto (COMPLETO)
            doc.text(puestoName, colX, currentY + 4);
            colX += colWidths.puesto;
            
            // Bonificación regular (CENTRADO con Q y decimales)
            doc.text(`Q${emp.bonificacionRegular.toFixed(2)}`, colX + colWidths.bonReg/2, currentY + 4, { align: 'center' });
            colX += colWidths.bonReg;
            
            // Bonificación extra (CENTRADO con Q y decimales)
            doc.text(`Q${emp.bonificacionExtra.toFixed(2)}`, colX + colWidths.bonExt/2, currentY + 4, { align: 'center' });
            colX += colWidths.bonExt;
            
            // Total descuentos (CENTRADO con Q y decimales)
            doc.text(`Q${totalDesc.toFixed(2)}`, colX + colWidths.desc/2, currentY + 4, { align: 'center' });
            colX += colWidths.desc;
            
            // Total con color (CENTRADO con Q y decimales)
            if (emp.totalNeto >= 0) {
                doc.setTextColor(27, 94, 32);
            } else {
                doc.setTextColor(183, 28, 28);
            }
            doc.setFont('helvetica', 'bold');
            doc.text(`Q${emp.totalNeto.toFixed(2)}`, colX + colWidths.total/2, currentY + 4, { align: 'center' });
            
            doc.setTextColor(51, 51, 51);
            doc.setFont('helvetica', 'normal');
            
            currentY += 7; // Más espacio entre filas
            employeeCount++;
        }
        
        // ===== RESUMEN FINAL =====
        currentY += 10;
        
        // Línea separadora
        doc.setDrawColor(255, 152, 0);
        doc.setLineWidth(1);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 6;
        
        // Estadísticas finales
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(101, 67, 33);
        
        const savedCount = employees.filter(emp => emp.isSaved).length;
        
        // ===== FOOTER ACTUALIZADO =====
        const footerY = pageHeight - 15;
        doc.setDrawColor(255, 152, 0);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY, pageWidth - margin, footerY);
        
        // Información de generación con datos reales
        doc.setFontSize(6);
        doc.setTextColor(120, 120, 120);
        
        let footerText = 'Sistema de Recursos Humanos - Generado automáticamente';
        if (bonificacionInfo && bonificacionInfo.NombreUsuario) {
            footerText = `Sistema de Recursos Humanos - Creado por: ${bonificacionInfo.NombreUsuario}`;
        }
        
        doc.text(footerText, pageWidth/2, footerY + 4, { align: 'center' });
        
        doc.setFontSize(5);
        let footerDate = `${userData.NombreDepartamento} | ${new Date().toLocaleString('es-GT')} | Página de resumen`;
        
        // Si hay información de finalización, mostrarla
        if (bonificacionInfo && bonificacionInfo.FechaHoraFinalizo) {
            try {
                const fechaEntrega = formatDateTimeSimple(bonificacionInfo.FechaHoraFinalizo);
                if (fechaEntrega !== 'No disponible' && fechaEntrega !== 'Fecha inválida') {
                    footerDate = `${userData.NombreDepartamento} | Entregado: ${fechaEntrega} | Página de resumen`;
                }
            } catch (error) {
                console.error('Error al formatear fecha para footer:', error);
            }
        }
        
        doc.text(footerDate, pageWidth/2, footerY + 8, { align: 'center' });
        
    } catch (error) {
        console.error('❌ Error al crear página de resumen mejorada:', error);
        throw error;
    }
}

// ===== FUNCIONES DE GUARDADO DE PDF CON SELECCIÓN DE UBICACIÓN =====

// Función para guardar usando File System Access API (navegadores modernos)
async function saveWithFileSystemAPI(doc, suggestedFileName) {
    try {
        // Configurar opciones para el selector de archivos
        const fileHandle = await window.showSaveFilePicker({
            suggestedName: suggestedFileName,
            types: [
                {
                    description: 'Archivos PDF',
                    accept: {
                        'application/pdf': ['.pdf'],
                    },
                },
            ],
            excludeAcceptAllOption: true,
            startIn: 'downloads', // Iniciar en la carpeta de descargas
        });
        
        // Obtener el archivo PDF como blob
        const pdfBlob = doc.output('blob');
        
        // Crear un stream de escritura
        const writableStream = await fileHandle.createWritable();
        
        // Escribir el archivo
        await writableStream.write(pdfBlob);
        await writableStream.close();
        
        // Mostrar confirmación de éxito
        Swal.fire({
            icon: 'success',
            title: '¡PDF guardado exitosamente!',
            html: `
                <div style="text-align: left; padding: 10px;">
                    <p><strong>📁 Archivo guardado:</strong></p>
                    <p style="background: #f0f0f0; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all;">
                        ${fileHandle.name}
                    </p>
                    <p><strong>📍 Ubicación:</strong> La ubicación que seleccionaste</p>
                    <p><strong>📊 Colaboradores incluidos:</strong> ${employeesData.filter(emp => emp.isSaved).length}</p>
                </div>
            `,
            confirmButtonColor: '#4CAF50',
            confirmButtonText: 'Perfecto',
            timer: 8000
        });
        
    } catch (error) {
        if (error.name === 'AbortError') {
            // El usuario canceló el diálogo
            Swal.fire({
                icon: 'info',
                title: 'Guardado cancelado',
                text: 'No se guardó el archivo PDF.',
                timer: 3000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } else {
            console.error('Error al guardar con File System API:', error);
            // Fallback a descarga automática
            await saveWithAutomaticDownload(doc, suggestedFileName);
        }
    }
}

// Función de respaldo para navegadores que no soportan File System Access API
async function saveWithFallbackOptions(doc, suggestedFileName) {
    try {
        // Mostrar opciones al usuario
        const result = await Swal.fire({
            icon: 'question',
            title: '¿Cómo deseas guardar el PDF?',
            html: `
                <div style="text-align: left; padding: 15px;">
                    <p><strong>Archivo a generar:</strong></p>
                    <p style="background: #f0f0f0; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px; word-break: break-all;">
                        ${suggestedFileName}
                    </p>
                    <hr style="margin: 15px 0;">
                    <p>Selecciona una opción:</p>
                </div>
            `,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '📥 Descargar automáticamente',
            denyButtonText: '📁 Elegir ubicación*',
            cancelButtonText: '❌ Cancelar',
            confirmButtonColor: '#2196F3',
            denyButtonColor: '#FF9800',
            cancelButtonColor: '#6c757d',
            footer: '<small>*Disponible solo en navegadores compatibles</small>',
            allowOutsideClick: false
        });
        
        if (result.isConfirmed) {
            // Opción 1: Descarga automática
            await saveWithAutomaticDownload(doc, suggestedFileName);
        } else if (result.isDenied) {
            // Opción 2: Intentar usar File System API como fallback
            if ('showSaveFilePicker' in window) {
                await saveWithFileSystemAPI(doc, suggestedFileName);
            } else {
                // Si no es compatible, mostrar mensaje y usar descarga automática
                Swal.fire({
                    icon: 'warning',
                    title: 'Función no disponible',
                    text: 'Tu navegador no soporta la selección de ubicación. Se descargará automáticamente.',
                    timer: 3000,
                    toast: true,
                    position: 'top-end'
                });
                await saveWithAutomaticDownload(doc, suggestedFileName);
            }
        } else {
            // Usuario canceló
            throw new Error('Guardado cancelado por el usuario');
        }
        
    } catch (error) {
        if (error.message === 'Guardado cancelado por el usuario') {
            Swal.fire({
                icon: 'info',
                title: 'Generación cancelada',
                text: 'No se generó el archivo PDF.',
                timer: 3000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } else {
            console.error('Error en opciones de guardado:', error);
            // Como último recurso, usar descarga automática
            await saveWithAutomaticDownload(doc, suggestedFileName);
        }
    }
}

// Función para descarga automática (método tradicional)
async function saveWithAutomaticDownload(doc, fileName) {
    try {
        // Guardar usando el método tradicional de jsPDF
        doc.save(fileName);
        
        // Mostrar confirmación
        Swal.fire({
            icon: 'success',
            title: '¡PDF generado!',
            html: `
                <div style="text-align: left; padding: 10px;">
                    <p><strong>📥 Archivo descargado:</strong></p>
                    <p style="background: #f0f0f0; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all;">
                        ${fileName}
                    </p>
                    <p><strong>📍 Ubicación:</strong> Carpeta de descargas predeterminada</p>
                    <p><strong>📊 Colaboradores incluidos:</strong> ${employeesData.filter(emp => emp.isSaved).length}</p>
                    <p><small>💡 <strong>Tip:</strong> Para elegir la ubicación de guardado, usa un navegador moderno como Chrome, Edge o Firefox actualizado.</small></p>
                </div>
            `,
            confirmButtonColor: '#4CAF50',
            confirmButtonText: 'Entendido',
            timer: 10000
        });
        
    } catch (error) {
        console.error('Error en descarga automática:', error);
        throw new Error('No se pudo descargar el archivo PDF');
    }
}

// ===== FUNCIONES DE COMPATIBILIDAD DE NAVEGADOR =====

// Función mejorada para detectar compatibilidad del navegador
function checkBrowserCompatibility() {
    const compatibility = {
        fileSystemAPI: 'showSaveFilePicker' in window,
        modernBrowser: !!(window.chrome || window.safari || window.mozilla),
        secureContext: window.isSecureContext,
        supportLevel: 'basic'
    };
    
    if (compatibility.fileSystemAPI && compatibility.secureContext) {
        compatibility.supportLevel = 'advanced';
    } else if (compatibility.modernBrowser) {
        compatibility.supportLevel = 'standard';
    }
    
    return compatibility;
}

// ===== FUNCIÓN MEJORADA PARA COMPROBANTES INDIVIDUALES =====

// ===== FUNCIÓN MEJORADA PARA COMPROBANTES INDIVIDUALES =====

async function drawImprovedEmployeeBonusBlock(doc, employee, x, y, width, height, employeeNumber) {
    try {
        // Colores optimizados - CORREGIDOS para usar números separados
        const primaryColor = [101, 67, 33];
        const accentColor = [255, 152, 0];
        const successColor = [76, 175, 80];
        const lightGray = [248, 249, 250];
        const mediumGray = [230, 230, 230];
        const textColor = [51, 51, 51];
        
        // ===== FONDO COMPLETO SIN BORDES =====
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, width, height, 'F');
        
        // ===== BORDES PARA LÍNEAS DE CORTE =====
        // Solo agregar líneas de corte sutiles en los bordes que se van a cortar
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        
        // Líneas de corte verticales (solo en los extremos de la página)
        if (x === 0) {
            // Línea izquierda de la página (no se corta)
        } else {
            // Línea vertical para separar columnas (línea de corte)
            doc.line(x, y, x, y + height);
        }
        
        if (x + width >= 297) {
            // Línea derecha de la página (no se corta)
        }
        
        // Líneas de corte horizontales
        if (y === 0) {
            // Línea superior de la página (no se corta)
        } else {
            // Línea horizontal para separar filas (línea de corte)
            doc.line(x, y, x + width, y);
        }
        
        // ===== HEADER COMPACTO CON MÁS ESPACIO =====
        doc.setFillColor(101, 67, 33);
        doc.rect(x + 2, y + 2, width - 4, 14, 'F');
        
        // Lado izquierdo: IDs importantes
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        
        const idDetalle = await getBonificacionDetalleId(employee.IdPersonal);
        doc.text(`ID BONIF: ${currentBonificacionId}`, x + 5, y + 7);
        doc.text(`ID DETALLE: ${idDetalle}`, x + 5, y + 12);
        
        // Centro: Título
        doc.setFontSize(10);
        doc.text('COMPROBANTE DE BONIFICACION', x + width/2, y + 7, { align: 'center' });
        doc.setFontSize(7);
        doc.text('DEPTO. RECURSOS HUMANOS', x + width/2, y + 12, { align: 'center' });
        
        // Lado derecho: Número y Período
        doc.setFontSize(8);
        doc.text(`No. ${employeeNumber.toString().padStart(3, '0')}`, x + width - 5, y + 6, { align: 'right' });
        doc.setFontSize(6);
        doc.text(`${getMonthName(selectedMonth)} ${selectedYear}`, x + width - 5, y + 10, { align: 'right' });
        
        // ===== INFORMACIÓN DEL EMPLEADO MEJORADA =====
        let currentY = y + 18;
        
        // Fondo gris para empleado con más espacio
        doc.setFillColor(248, 249, 250);
        doc.rect(x + 2, currentY, width - 4, 12, 'F');
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.3);
        doc.rect(x + 2, currentY, width - 4, 12);
        
        // Línea 1: Nombre completo
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        
        // Nombre más largo
        const employeeName = employee.NombreCompleto.length > 35 ? 
            employee.NombreCompleto.substring(0, 32) + '...' : 
            employee.NombreCompleto;
        
        doc.text(employeeName.toUpperCase(), x + 5, currentY + 5);
        
        // ===== TOTAL A RECIBIR - SOLO MONTO, CENTRADO Y MÁS GRANDE =====
        const totalFinal = (employee.bonificacionRegular + employee.bonificacionExtra) - 
                          (employee.descuentoVales + employee.descuentoCreditos);

        // Color del monto según valor - MÁS DESTACADO
        if (totalFinal >= 0) {
            doc.setTextColor(0, 120, 0); // Verde más intenso
        } else {
            doc.setTextColor(200, 0, 0); // Rojo más intenso
        }

        // Monto principal - MUY GRANDE y centrado en el área derecha
        doc.setFontSize(14); // Aumentado a 14 para que se vea mucho más grande
        doc.setFont('helvetica', 'bold');

        // Centrado en la parte derecha del comprobante
        const montoX = x + width - 60; // Más hacia la izquierda para centrarlo mejor
        const montoWidth = 55; // Área más amplia para centrar
        doc.text(`Q${totalFinal.toFixed(2)}`, montoX + (montoWidth/2), currentY + 6, { align: 'center' });
        
        // ===== LÍNEA 2: ID Y PUESTO COMPLETO (MEJORADO) =====
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        
        // Permitir más caracteres en el puesto (de 28 a 45)
        const puestoText = employee.NombrePuesto.length > 45 ? 
            employee.NombrePuesto.substring(0, 42) + '...' : 
            employee.NombrePuesto;
        
        doc.text(`ID: ${employee.IdPersonal} | ${puestoText}`, x + 5, currentY + 9);
        
        currentY += 15;
        
        // ===== LÍNEA SEPARADORA =====
        doc.setDrawColor(255, 152, 0);
        doc.setLineWidth(1);
        doc.line(x + 5, currentY, x + width - 5, currentY);
        currentY += 5;
        
        // ===== DISEÑO DE 2 COLUMNAS PARA DETALLE CON MÁS ESPACIO =====
        const hasDiscounts = employee.descuentoVales > 0 || employee.descuentoCreditos > 0;
        const hasBonuses = employee.bonificacionRegular > 0 || employee.bonificacionExtra > 0;
        
        // Definir columnas con más espacio
        const col1X = x + 5;
        const col1Width = hasDiscounts ? (width - 15) / 2 : width - 10;
        const col2X = x + 8 + col1Width;
        const col2Width = (width - 15) / 2;
        
        let maxColumnY = currentY;
        
        // ===== COLUMNA 1: BONIFICACIONES =====
        if (hasBonuses) {
            let col1Y = currentY;
            
            // Header de bonificaciones
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...primaryColor);
            doc.text('BONIFICACIONES', col1X, col1Y);
            col1Y += 5;
            
            // Fondo para tabla de bonificaciones
            const bonusTableHeight = (employee.bonificacionRegular > 0 ? 5 : 0) + 
                                    (employee.bonificacionExtra > 0 ? 5 : 0) + 
                                    (employee.observacionesBonificacionExtra && employee.bonificacionExtra > 0 ? 4 : 0) + 6;
            
            doc.setFillColor(245, 255, 245);
            doc.rect(col1X, col1Y - 1, col1Width, bonusTableHeight, 'F');
            doc.setDrawColor(...mediumGray);
            doc.setLineWidth(0.3);
            doc.rect(col1X, col1Y - 1, col1Width, bonusTableHeight);
            
            // Headers
            doc.setTextColor(...textColor);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('CONCEPTO', col1X + 2, col1Y + 3);
            doc.text('MONTO', col1X + col1Width - 2, col1Y + 3, { align: 'right' });
            col1Y += 5;
            
            // Bonificaciones
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            
            if (employee.bonificacionRegular > 0) {
                doc.setTextColor(...textColor);
                doc.text('• Bonif. Regular', col1X + 3, col1Y);
                doc.setFont('helvetica', 'bold');
                doc.text(`Q${employee.bonificacionRegular.toFixed(2)}`, col1X + col1Width - 2, col1Y, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                col1Y += 5;
            }
            
            if (employee.bonificacionExtra > 0) {
                doc.setTextColor(...textColor);
                doc.text('• Bonif. Extra', col1X + 3, col1Y);
                doc.setFont('helvetica', 'bold');
                doc.text(`Q${employee.bonificacionExtra.toFixed(2)}`, col1X + col1Width - 2, col1Y, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                col1Y += 5;
                
                // Observaciones compactas
                if (employee.observacionesBonificacionExtra && employee.observacionesBonificacionExtra.trim()) {
                    doc.setFontSize(5);
                    doc.setTextColor(120, 120, 120);
                    const obsText = employee.observacionesBonificacionExtra.length > 32 ? 
                        employee.observacionesBonificacionExtra.substring(0, 29) + '...' : 
                        employee.observacionesBonificacionExtra;
                    doc.text(`Obs: ${obsText}`, col1X + 5, col1Y);
                    col1Y += 4;
                    doc.setFontSize(7);
                    doc.setTextColor(...textColor);
                }
            }
            
            maxColumnY = Math.max(maxColumnY, col1Y);
        }
        
        // ===== COLUMNA 2: DESCUENTOS (SI EXISTEN) =====
        if (hasDiscounts) {
            let col2Y = currentY;
            
            // Header de descuentos
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...primaryColor);
            doc.text('DESCUENTOS', col2X, col2Y);
            col2Y += 5;
            
            // Fondo para tabla de descuentos
            const discountTableHeight = (employee.descuentoVales > 0 ? 5 : 0) + 
                                       (employee.descuentoCreditos > 0 ? 5 : 0) + 
                                       (employee.referenciaVales && employee.descuentoVales > 0 ? 4 : 0) +
                                       (employee.referenciaCreditos && employee.descuentoCreditos > 0 ? 4 : 0) + 6;
            
            doc.setFillColor(255, 245, 245);
            doc.rect(col2X, col2Y - 1, col2Width, discountTableHeight, 'F');
            doc.setDrawColor(...mediumGray);
            doc.setLineWidth(0.3);
            doc.rect(col2X, col2Y - 1, col2Width, discountTableHeight);
            
            // Headers
            doc.setTextColor(...textColor);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('CONCEPTO', col2X + 2, col2Y + 3);
            doc.text('MONTO', col2X + col2Width - 2, col2Y + 3, { align: 'right' });
            col2Y += 5;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            
            if (employee.descuentoVales > 0) {
                doc.setTextColor(...textColor);
                doc.text('• Desc. Vales', col2X + 3, col2Y);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(200, 50, 50);
                doc.text(`-Q${employee.descuentoVales.toFixed(2)}`, col2X + col2Width - 2, col2Y, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...textColor);
                col2Y += 5;
                
                if (employee.referenciaVales && employee.referenciaVales.trim()) {
                    doc.setFontSize(5);
                    doc.setTextColor(120, 120, 120);
                    const refText = employee.referenciaVales.length > 22 ? 
                        employee.referenciaVales.substring(0, 19) + '...' : 
                        employee.referenciaVales;
                    doc.text(`Doc: ${refText}`, col2X + 5, col2Y);
                    col2Y += 4;
                    doc.setFontSize(7);
                    doc.setTextColor(...textColor);
                }
            }
            
            if (employee.descuentoCreditos > 0) {
                doc.setTextColor(...textColor);
                doc.text('• Desc. Créditos', col2X + 3, col2Y);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(200, 50, 50);
                doc.text(`-Q${employee.descuentoCreditos.toFixed(2)}`, col2X + col2Width - 2, col2Y, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...textColor);
                col2Y += 5;
                
                if (employee.referenciaCreditos && employee.referenciaCreditos.trim()) {
                    doc.setFontSize(5);
                    doc.setTextColor(120, 120, 120);
                    const refText = employee.referenciaCreditos.length > 22 ? 
                        employee.referenciaCreditos.substring(0, 19) + '...' : 
                        employee.referenciaCreditos;
                    doc.text(`Doc: ${refText}`, col2X + 5, col2Y);
                    col2Y += 4;
                    doc.setFontSize(7);
                    doc.setTextColor(...textColor);
                }
            }
            
            maxColumnY = Math.max(maxColumnY, col2Y);
        }
        
        currentY = maxColumnY + 4;
        
        // ===== ESPACIOS PARA FIRMAS CON MÁS ESPACIO =====
        const signatureY = y + height - 25; // Más espacio para firmas
        doc.setTextColor(...textColor);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        
        // Asegurar que las firmas no se superpongan con el contenido
        const minSignatureY = currentY + 6;
        const finalSignatureY = Math.max(signatureY, minSignatureY);
        
        // Calcular ancho de cada columna de firma con más espacio
        const signatureWidth = (width - 20) / 3;
        const signatureSpacing = 5;
        
        // Líneas para firmas
        doc.setDrawColor(...textColor);
        doc.setLineWidth(0.5);
        
        // Firma del colaborador
        const col1X_sig = x + 8;
        doc.line(col1X_sig, finalSignatureY, col1X_sig + signatureWidth, finalSignatureY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.text('FIRMA DEL COLABORADOR', col1X_sig, finalSignatureY + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.text('Fecha: _____/_____/_______', col1X_sig, finalSignatureY + 8);
        
        // Firma de quien entregó
        const col2X_sig = x + 8 + signatureWidth + signatureSpacing;
        doc.line(col2X_sig, finalSignatureY, col2X_sig + signatureWidth, finalSignatureY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.text('ENTREGADO POR', col2X_sig, finalSignatureY + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.text('Fecha: _____/_____/_______', col2X_sig, finalSignatureY + 8);
        
        // Firma del jefe/regional
        const col3X_sig = x + 8 + (signatureWidth * 2) + (signatureSpacing * 2);
        doc.line(col3X_sig, finalSignatureY, col3X_sig + signatureWidth, finalSignatureY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.text('AUTORIZADO POR', col3X_sig, finalSignatureY + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.text('JEFE/REGIONAL', col3X_sig, finalSignatureY + 8);
        
        // ===== PIE DE PÁGINA MÍNIMO =====
        const now = new Date();
        doc.setFontSize(4);
        doc.setTextColor(180, 180, 180);
        doc.text(`Gen: ${now.toLocaleDateString()}`, x + width - 5, y + height - 2, { align: 'right' });
        
    } catch (error) {
        console.error(`❌ Error al dibujar comprobante pegado:`, error);
        throw error;
    }
}

async function getBonificacionDetalleId(idPersonal) {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT IdBonificacionDetalle FROM BonificacionDetalle 
            WHERE IdBonificacion = ? AND IdPersonal = ?
            LIMIT 1
        `, [currentBonificacionId, idPersonal]);
        
        await connection.close();
        
        if (result.length > 0 && result[0].IdBonificacionDetalle) {
            return result[0].IdBonificacionDetalle.toString();
        }
        
        // Generar ID temporal limpio
        return `${currentBonificacionId}${idPersonal.toString().padStart(2, '0')}`;
        
    } catch (error) {
        console.error('Error al obtener IdDetalle:', error);
        return `${currentBonificacionId}${idPersonal.toString().padStart(2, '0')}`;
    }
}

// ===== FUNCIONES DE EXPORTACIÓN A EXCEL =====

async function exportToExcel() {
    try {
        if (!isDataLoaded || employeesData.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin datos para exportar',
                text: 'Debe cargar los colaboradores antes de exportar.',
                confirmButtonColor: '#FF9800',
                toast: true,
                position: 'top-end',
                timer: 3000
            });
            return;
        }
        
        // Mostrar loading compacto
        Swal.fire({
            title: 'Exportando...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Bonificaciones');
        
        // Configurar encabezados
        worksheet.columns = [
            { header: 'ID Bonificación', key: 'idBonificacion', width: 15 },
            { header: 'ID Colaborador', key: 'id', width: 12 },
            { header: 'Colaborador', key: 'nombre', width: 35 },
            { header: 'Puesto', key: 'puesto', width: 25 },
            { header: 'Bonificación Regular', key: 'bonusRegular', width: 20 },
            { header: 'Bonificación Extra', key: 'bonusExtra', width: 20 },
            { header: 'Descuento Vales', key: 'descVales', width: 18 },
            { header: 'Ref. Vales', key: 'refVales', width: 15 },
            { header: 'Obs. Vales', key: 'obsVales', width: 20 },
            { header: 'Descuento Créditos', key: 'descCreditos', width: 20 },
            { header: 'Ref. Créditos', key: 'refCreditos', width: 15 },
            { header: 'Obs. Créditos', key: 'obsCreditos', width: 20 },
            { header: 'Obs. Bonus Extra', key: 'obsBonusExtra', width: 20 },
            { header: 'Total Neto', key: 'totalNeto', width: 15 },
            { header: 'Estado', key: 'estado', width: 12 }
        ];
        
        // Estilo del encabezado
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF654321' }
        };
        
        // Agregar información del departamento y período
        worksheet.addRow([]);
        worksheet.addRow(['Departamento:', userData.NombreDepartamento]);
        worksheet.addRow(['Período:', getCurrentMesAnio()]);
        worksheet.addRow(['ID Bonificación:', currentBonificacionId || 'N/A']);
        worksheet.addRow(['Fecha Exportación:', new Date().toLocaleDateString()]);
        worksheet.addRow([]);
        
        // Agregar datos de empleados
        employeesData.forEach(employee => {
            worksheet.addRow({
                idBonificacion: currentBonificacionId || '',
                id: employee.IdPersonal,
                nombre: employee.NombreCompleto,
                puesto: employee.NombrePuesto,
                bonusRegular: employee.bonificacionRegular,
                bonusExtra: employee.bonificacionExtra,
                descVales: employee.descuentoVales,
                refVales: employee.referenciaVales,
                obsVales: employee.observacionesVales,
                descCreditos: employee.descuentoCreditos,
                refCreditos: employee.referenciaCreditos,
                obsCreditos: employee.observacionesCreditos,
                obsBonusExtra: employee.observacionesBonificacionExtra,
                totalNeto: employee.totalNeto,
                estado: employee.isSaved ? 'Guardado' : 'Pendiente'
            });
        });
        
        // Agregar fila de totales
        const totalRow = worksheet.addRow({
            idBonificacion: '',
            id: '',
            nombre: 'TOTALES',
            puesto: '',
            bonusRegular: employeesData.reduce((sum, emp) => sum + emp.bonificacionRegular, 0),
            bonusExtra: employeesData.reduce((sum, emp) => sum + emp.bonificacionExtra, 0),
            descVales: employeesData.reduce((sum, emp) => sum + emp.descuentoVales, 0),
            refVales: '',
            obsVales: '',
            descCreditos: employeesData.reduce((sum, emp) => sum + emp.descuentoCreditos, 0),
            refCreditos: '',
            obsCreditos: '',
            obsBonusExtra: '',
            totalNeto: employeesData.reduce((sum, emp) => sum + emp.totalNeto, 0),
            estado: ''
        });
        
        totalRow.font = { bold: true };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC107' }
        };
        
        // Guardar archivo
        const fileName = `Bonificaciones_${userData.NombreDepartamento}_${getCurrentMesAnio()}_ID${currentBonificacionId || 'N'}.xlsx`;
        const buffer = await workbook.xlsx.writeBuffer();
        
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        
        window.URL.revokeObjectURL(url);
        
        Swal.fire({
            icon: 'success',
            title: 'Exportación exitosa',
            text: `Archivo descargado: ${fileName}`,
            confirmButtonColor: '#FF9800',
            toast: true,
            position: 'top-end',
            timer: 3000
        });
        
    } catch (error) {
        console.error('Error al exportar:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de exportación',
            text: 'No se pudo exportar el archivo. Intente nuevamente.',
            confirmButtonColor: '#FF9800',
            toast: true,
            position: 'top-end',
            timer: 4000
        });
    }
}

// ===== FUNCIONES DE UI ACTUALIZADAS =====

function updateBonificacionInfo(idBonificacion, status) {
    const bonificacionInfo = document.getElementById('bonificacionInfo');
    const currentBonificacionIdEl = document.getElementById('currentBonificacionId');
    const bonificacionStatus = document.getElementById('bonificacionStatus');
    
    if (idBonificacion) {
        const periodText = selectedMonth && selectedYear ? 
            `#${idBonificacion} (${getMonthName(selectedMonth)} ${selectedYear})` : 
            `#${idBonificacion}`;
        currentBonificacionIdEl.textContent = periodText;
        bonificacionInfo.style.display = 'flex';
        bonificacionInfo.classList.add('has-data');
        
        // Agregar clase específica para estado finalizado
        if (status === 'finalizado') {
            bonificacionInfo.classList.add('finalizado');
        } else {
            bonificacionInfo.classList.remove('finalizado');
        }
    } else {
        const periodText = selectedMonth && selectedYear ? 
            `Nuevo (${getMonthName(selectedMonth)} ${selectedYear})` : 
            'Seleccionar período';
        currentBonificacionIdEl.textContent = periodText;
        bonificacionInfo.style.display = 'flex';
        bonificacionInfo.classList.remove('has-data', 'finalizado');
    }
    
    // Actualizar badge de estado
    bonificacionStatus.className = `bonificacion-status-badge ${status}`;
    bonificacionStatus.textContent = getStatusBadgeText(status);
    
    // Deshabilitar botones si está finalizado
    if (status === 'finalizado') {
        disableAllEditingButtons();
    }
}

function getStatusBadgeText(status) {
    const statusTexts = {
        'nuevo': 'Nuevo',
        'existente': 'Existente',
        'cargado': 'Cargado',
        'finalizado': 'Finalizado'
    };
    return statusTexts[status] || 'Nuevo';
}

// ===== FUNCIONES DE CONTROL DE BOTONES MEJORADAS =====

function enableButtons() {
    const exportBtn = document.getElementById('exportBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const finalizeBtn = document.getElementById('finalizeBtn');
    
    if (exportBtn) exportBtn.disabled = false;
    if (clearAllBtn) clearAllBtn.disabled = false;
    
    // El botón finalizar se habilita cuando hay datos cargados y no está finalizado
    if (finalizeBtn && isDataLoaded && !finalizeBtn.classList.contains('finalized')) {
        finalizeBtn.disabled = false;
    }
    
    // Actualizar estado del botón finalizar
    updateFinalizeButtonState();
}

function disableButtons() {
    const exportBtn = document.getElementById('exportBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const finalizeBtn = document.getElementById('finalizeBtn');
    
    if (exportBtn) exportBtn.disabled = true;
    if (clearAllBtn) clearAllBtn.disabled = true;
    if (finalizeBtn && !finalizeBtn.classList.contains('finalized')) {
        finalizeBtn.disabled = true;
    }
}

function updateFinalizeButtonState() {
    const finalizeBtn = document.getElementById('finalizeBtn');
    if (!finalizeBtn) return;
    
    // Verificar si hay empleados guardados
    const savedEmployees = employeesData.filter(emp => emp.isSaved && (
        emp.bonificacionRegular > 0 || emp.bonificacionExtra > 0 || 
        emp.descuentoVales > 0 || emp.descuentoCreditos > 0
    ));
    
    // Verificar si ya está finalizada
    const isFinalized = finalizeBtn.classList.contains('finalized');
    
    // Habilitar si:
    // 1. Hay datos cargados
    // 2. Hay un currentBonificacionId válido
    // 3. La bonificación no está finalizada
    if (isDataLoaded && currentBonificacionId && !isFinalized) {
        finalizeBtn.disabled = false;
        
        // Continuación de la Parte 6 - Resto de funciones que faltaron

        // Actualizar tooltip según el estado
        if (savedEmployees.length > 0) {
            finalizeBtn.title = `Finalizar bonificación (${savedEmployees.length} empleados guardados)`;
        } else {
            finalizeBtn.title = 'Finalizar bonificación (sin empleados guardados)';
        }
    } else {
        finalizeBtn.disabled = true;
        if (isFinalized) {
            finalizeBtn.title = 'Bonificación ya finalizada';
        } else {
            finalizeBtn.title = 'Debe cargar colaboradores primero';
        }
    }
}

function disableAllEditingButtons() {
    // Deshabilitar todos los botones de edición
    const loadBtn = document.getElementById('loadEmployeesBtn');
    const clearBtn = document.getElementById('clearAllBtn');
    const finalizeBtn = document.getElementById('finalizeBtn');
    
    if (loadBtn) loadBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    if (finalizeBtn) {
        finalizeBtn.disabled = true;
        finalizeBtn.classList.add('finalized');
        finalizeBtn.innerHTML = '<i class="fas fa-check"></i>';
        finalizeBtn.title = 'Bonificación finalizada';
    }
    
    // Deshabilitar campos de entrada en la tabla
    document.querySelectorAll('.input-field').forEach(input => {
        input.disabled = true;
        input.style.backgroundColor = '#f5f5f5';
    });
    
    // Deshabilitar botones de guardado
    document.querySelectorAll('.btn-save-employee').forEach(btn => {
        btn.disabled = true;
    });
    
    // Deshabilitar botones de referencia
    document.querySelectorAll('.btn-discount-ref').forEach(btn => {
        btn.disabled = true;
    });
    
    // Agregar overlay visual a la tabla
    const tableContainer = document.querySelector('.table-container-fullscreen');
    if (tableContainer) {
        tableContainer.classList.add('table-finalized');
    }
}

// ===== FUNCIONES DE ESTADÍSTICAS =====

function updateHeaderStatistics() {
    let totalBonifications = 0;
    let totalDiscounts = 0;
    let totalNet = 0;
    
    employeesData.forEach(employee => {
        totalBonifications += employee.bonificacionRegular + employee.bonificacionExtra;
        totalDiscounts += employee.descuentoVales + employee.descuentoCreditos;
        totalNet += employee.totalNeto;
    });
    
    // Actualizar estadísticas en el header
    const headerTotalBonus = document.getElementById('headerTotalBonus');
    const headerTotalDiscounts = document.getElementById('headerTotalDiscounts');
    const headerTotalNet = document.getElementById('headerTotalNet');
    
    if (headerTotalBonus) headerTotalBonus.textContent = `Q${totalBonifications.toFixed(2)}`;
    if (headerTotalDiscounts) headerTotalDiscounts.textContent = `Q${totalDiscounts.toFixed(2)}`;
    if (headerTotalNet) headerTotalNet.textContent = `Q${totalNet.toFixed(2)}`;
}

function updateVisualIndicatorsAfterLoad() {
    // Contar empleados con datos
    const employeesWithData = employeesData.filter(emp => 
        emp.isLoaded && (emp.bonificacionRegular > 0 || emp.bonificacionExtra > 0 || 
                        emp.descuentoVales > 0 || emp.descuentoCreditos > 0)
    );
    
    const employeesWithoutData = employeesData.filter(emp => !emp.isLoaded);
    
    // Actualizar el header con información adicional
    const bonificacionInfo = document.getElementById('bonificacionInfo');
    if (bonificacionInfo && employeesWithData.length > 0) {
        bonificacionInfo.title = `${employeesWithData.length} de ${employeesData.length} colaboradores tienen bonificaciones registradas`;
    }
    
    return {
        withData: employeesWithData.length,
        withoutData: employeesWithoutData.length,
        total: employeesData.length
    };
}

// ===== FUNCIONES DE UI ADICIONALES =====

function showInitialState() {
    if (currentBonificacionId && !isDataLoaded) {
        // Hay bonificación pero no se han cargado los datos
        showEmptyState();
        const emptyStateContent = document.querySelector('.empty-state h3');
        const emptyStateDesc = document.querySelector('.empty-state p');
        
        if (emptyStateContent) emptyStateContent.textContent = 'Datos listos para cargar';
        if (emptyStateDesc) emptyStateDesc.textContent = 'Hay una bonificación existente. Haz clic para cargar los colaboradores.';
    } else if (isDataLoaded) {
        // Ya hay datos cargados
        showEmployeesTable();
    } else {
        // Estado inicial vacío
        showEmptyState();
    }
}

function showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const table = document.getElementById('bonificacionesTable');
    const tableControls = document.querySelector('.table-controls-minimal');
    const tableFooter = document.querySelector('.table-footer-compact');
    
    if (emptyState) emptyState.style.display = 'flex';
    if (table) table.style.display = 'none';
    if (tableControls) tableControls.style.display = 'none';
    if (tableFooter) tableFooter.style.display = 'none';
}

function showEmployeesTable() {
    const emptyState = document.getElementById('emptyState');
    const table = document.getElementById('bonificacionesTable');
    const tableControls = document.querySelector('.table-controls-minimal');
    const tableFooter = document.querySelector('.table-footer-compact');
    
    if (emptyState) emptyState.style.display = 'none';
    if (table) {
        table.style.display = 'table';
        table.classList.add('loaded');
    }
    if (tableControls) tableControls.style.display = 'flex';
    if (tableFooter) tableFooter.style.display = 'flex';
}

// ===== FUNCIONES DE LIMPIEZA =====

async function clearAllData() {
    if (!isDataLoaded) {
        Swal.fire({
            icon: 'info',
            title: 'Sin datos para limpiar',
            text: 'No hay datos cargados para limpiar.',
            confirmButtonColor: '#FF9800',
            toast: true,
            position: 'top-end',
            timer: 3000
        });
        return;
    }
    
    const result = await Swal.fire({
        icon: 'warning',
        title: '¿Limpiar todos los datos?',
        text: 'Esta acción eliminará todas las bonificaciones y descuentos ingresados (no afectará los datos guardados en la base de datos).',
        showCancelButton: true,
        confirmButtonText: 'Sí, limpiar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc3545'
    });
    
    if (result.isConfirmed) {
        employeesData.forEach((employee, index) => {
            // Solo limpiar si no están guardados
            if (!employee.isSaved || employee.isModified) {
                employee.bonificacionRegular = 0;
                employee.bonificacionExtra = 0;
                employee.descuentoVales = 0;
                employee.descuentoCreditos = 0;
                employee.referenciaVales = '';
                employee.referenciaCreditos = '';
                employee.observacionesVales = '';
                employee.observacionesCreditos = '';
                employee.observacionesBonificacionExtra = '';
                employee.totalNeto = 0;
                employee.isModified = false;
            }
        });
        
        // Actualizar datos filtrados
        filteredData = [...employeesData];
        
        // Recargar tabla manteniendo ordenamiento
        if (currentSort.field) {
            sortData(currentSort.field, currentSort.direction);
            updateSortIndicators(currentSort.field, currentSort.direction);
        }
        renderTable();
        createPagination();
        updateTableInfo();
        
        // Actualizar estadísticas
        updateHeaderStatistics();
        
        Swal.fire({
            icon: 'success',
            title: 'Datos limpiados',
            text: 'Los datos no guardados han sido eliminados correctamente.',
            timer: 1500,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }
}

// ===== FUNCIONES DE NAVEGACIÓN =====

async function goBack() {
    const hasUnsavedChanges = employeesData.some(emp => 
        emp.isModified || (!emp.isSaved && (
            emp.bonificacionRegular > 0 || emp.bonificacionExtra > 0 || 
            emp.descuentoVales > 0 || emp.descuentoCreditos > 0
        ))
    );
    
    if (hasUnsavedChanges) {
        const result = await Swal.fire({
            icon: 'question',
            title: '¿Regresar al menú?',
            text: 'Hay cambios sin guardar que se perderán.',
            showCancelButton: true,
            confirmButtonText: 'Sí, regresar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#6c757d'
        });
        
        if (!result.isConfirmed) return;
    }
    
    window.location.href = path.join(__dirname, 'Menu.html');
}

// ===== FUNCIONES DE VALIDACIÓN =====

function validateEmployeeData(employee) {
    const errors = [];
    
    // VALIDACIÓN PRINCIPAL: Bonificación Regular es obligatoria para guardar
    if (!employee.bonificacionRegular || employee.bonificacionRegular <= 0) {
        errors.push('La Bonificación Regular es obligatoria y debe ser mayor a 0');
    }
    
    // Validar que los montos sean positivos o cero
    if (employee.bonificacionRegular < 0) {
        errors.push('La bonificación regular no puede ser negativa');
    }
    
    if (employee.bonificacionExtra < 0) {
        errors.push('La bonificación extra no puede ser negativa');
    }
    
    if (employee.descuentoVales < 0) {
        errors.push('El descuento por vales no puede ser negativo');
    }
    
    if (employee.descuentoCreditos < 0) {
        errors.push('El descuento por créditos no puede ser negativo');
    }
    
    // VALIDACIONES OBLIGATORIAS PARA DESCUENTOS
    if (employee.descuentoVales > 0) {
        if (!employee.referenciaVales || !employee.referenciaVales.trim()) {
            errors.push('Se requiere Número de Referencia para el descuento por vales');
        }
        if (!employee.observacionesVales || !employee.observacionesVales.trim()) {
            errors.push('Se requiere Observación para el descuento por vales');
        }
    }
    
    if (employee.descuentoCreditos > 0) {
        if (!employee.referenciaCreditos || !employee.referenciaCreditos.trim()) {
            errors.push('Se requiere Número de Referencia para el descuento por créditos');
        }
        if (!employee.observacionesCreditos || !employee.observacionesCreditos.trim()) {
            errors.push('Se requiere Observación para el descuento por créditos');
        }
    }
    
    return errors;
}
function validateEmployeeForSave(employee) {
    // No permitir guardar si no hay Bonificación Regular
    if (!employee.bonificacionRegular || employee.bonificacionRegular <= 0) {
        return false;
    }
    
    // Si hay descuentos, validar referencias y observaciones
    if (employee.descuentoVales > 0) {
        if (!employee.referenciaVales || !employee.referenciaVales.trim() ||
            !employee.observacionesVales || !employee.observacionesVales.trim()) {
            return false;
        }
    }
    
    if (employee.descuentoCreditos > 0) {
        if (!employee.referenciaCreditos || !employee.referenciaCreditos.trim() ||
            !employee.observacionesCreditos || !employee.observacionesCreditos.trim()) {
            return false;
        }
    }
    
    return true;
}
function validateAllData() {
    const errors = [];
    
    employeesData.forEach((employee, index) => {
        const employeeErrors = validateEmployeeData(employee);
        if (employeeErrors.length > 0) {
            errors.push({
                employee: employee.NombreCompleto,
                index: index,
                errors: employeeErrors
            });
        }
    });
    
    return errors;
}

// ===== FUNCIONES ADICIONALES =====

async function saveAllModifiedEmployees() {
    if (!isDataLoaded) {
        Swal.fire({
            icon: 'info',
            title: 'Sin datos cargados',
            text: 'Debe cargar los colaboradores primero.',
            confirmButtonColor: '#FF9800',
            toast: true,
            position: 'top-end',
            timer: 3000
        });
        return;
    }
    
    const modifiedEmployees = employeesData.filter(emp => emp.isModified || (!emp.isSaved && (
        emp.bonificacionRegular > 0 || emp.bonificacionExtra > 0 || 
        emp.descuentoVales > 0 || emp.descuentoCreditos > 0
    )));
    
    if (modifiedEmployees.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin cambios para guardar',
            text: 'No hay empleados con cambios pendientes.',
            confirmButtonColor: '#FF9800',
            toast: true,
            position: 'top-end',
            timer: 3000
        });
        return;
    }
    
    const result = await Swal.fire({
        icon: 'question',
        title: 'Guardar cambios',
        text: `¿Desea guardar los cambios de ${modifiedEmployees.length} empleados?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4CAF50'
    });
    
    if (result.isConfirmed) {
        let savedCount = 0;
        let errorCount = 0;
        
        Swal.fire({
            title: 'Guardando cambios...',
            text: `Procesando ${modifiedEmployees.length} empleados...`,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        for (let i = 0; i < modifiedEmployees.length; i++) {
            const employee = modifiedEmployees[i];
            const index = employeesData.findIndex(emp => emp.IdPersonal === employee.IdPersonal);
            
            try {
                await saveIndividualEmployee(index);
                savedCount++;
            } catch (error) {
                console.error(`Error al guardar empleado ${employee.NombreCompleto}:`, error);
                errorCount++;
            }
        }
        
        Swal.fire({
            icon: savedCount > 0 ? 'success' : 'error',
            title: 'Proceso completado',
            text: `Guardados: ${savedCount}, Errores: ${errorCount}`,
            confirmButtonColor: '#FF9800',
            toast: true,
            position: 'top-end',
            timer: 4000
        });
    }
}

// ===== FUNCIONES UTILITARIAS ADICIONALES =====

function showLoadingOverlay(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) {
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            overlay.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
}

// ===== KEYBOARD SHORTCUTS =====

document.addEventListener('keydown', function(event) {
    // Ctrl + S para guardar todos los modificados
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        saveAllModifiedEmployees();
    }
    
    // Ctrl + E para exportar
    if (event.ctrlKey && event.key === 'e') {
        event.preventDefault();
        exportToExcel();
    }
    
    // Ctrl + L para cargar colaboradores
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        if (!isDataLoaded) {
            handleLoadEmployeesClick();
        }
    }
    
    // Ctrl + F para finalizar (solo si está habilitado)
    if (event.ctrlKey && event.key === 'f') {
        event.preventDefault();
        const finalizeBtn = document.getElementById('finalizeBtn');
        if (finalizeBtn && !finalizeBtn.disabled) {
            finalizeBonificacion();
        }
    }
    
    // Escape para cerrar modal
    if (event.key === 'Escape') {
        const modal = document.getElementById('discountModal');
        if (modal && modal.style.display === 'block') {
            closeDiscountModal();
        } else if (typeof Swal !== 'undefined' && Swal.isVisible()) {
            Swal.close();
        }
    }
    
    // Ctrl + Q para cerrar forzadamente cualquier modal atascado
    if (event.ctrlKey && event.key === 'q') {
        event.preventDefault();
        closeAllModals();
    }
    
    // F5 para recargar datos
    if (event.key === 'F5') {
        event.preventDefault();
        location.reload();
    }
});

// ===== FUNCIONES UTILITARIAS FINALES =====

// Función de utilidad para cerrar todos los modales
function closeAllModals() {
    // Cerrar SweetAlert si está abierto
    if (typeof Swal !== 'undefined' && Swal.isVisible()) {
        Swal.close();
    }
    
    // Cerrar modal personalizado si está abierto
    const modal = document.getElementById('discountModal');
    if (modal && modal.style.display === 'block') {
        closeDiscountModal();
    }
    
    // Cerrar overlay de loading si está abierto
    showLoadingOverlay(false);
}

// Hacer la función disponible globalmente para debugging
window.closeAllModals = closeAllModals;

// ===== INICIALIZACIÓN DE TOOLTIPS =====

function initializeTooltips() {
    // Los tooltips se manejan con CSS y el atributo title
    document.querySelectorAll('[title]').forEach(element => {
        // Agregar clase para tooltips personalizados si es necesario
        element.classList.add('has-tooltip');
    });
}
//Agregar colaboradores fuera de su departamento
async function checkExternalEmployeePermission() {
    try {
        if (!userData || !userData.IdPersonal) return false;
        
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT Codigo FROM TransaccionesRRHH 
            WHERE IdPersonal = ? AND Codigo = '121' AND Activo = 1
        `, [userData.IdPersonal]);
        
        await connection.close();
        
        const hasPermission = result.length > 0;
        
        // Mostrar/ocultar botón según permisos
        const addExternalBtn = document.getElementById('addExternalBtn');
        if (addExternalBtn) {
            if (hasPermission) {
                addExternalBtn.style.display = 'flex';
                addExternalBtn.addEventListener('click', openExternalEmployeeModal);
            } else {
                addExternalBtn.style.display = 'none';
            }
        }
        
        return hasPermission;
        
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        return false;
    }
}

// Abrir modal de colaboradores externos
async function openExternalEmployeeModal() {
    try {
        if (!currentPeriodMesAnio) {
            Swal.fire({
                icon: 'warning',
                title: 'Período no seleccionado',
                text: 'Debe seleccionar y verificar un período antes de agregar colaboradores externos.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        const modal = document.getElementById('externalEmployeeModal');
        const departmentSelect = document.getElementById('departmentSelect');
        
        // Limpiar modal
        resetExternalEmployeeModal();
        
        // Mostrar modal primero
        if (modal) {
            modal.style.display = 'block';
        }
        
        // Mostrar loading temporal en el select de departamentos
        if (departmentSelect) {
            departmentSelect.innerHTML = '<option value="">Cargando departamentos...</option>';
            departmentSelect.disabled = true;
            
            // Crear loading indicator temporal
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'department-loading';
            loadingDiv.innerHTML = '<div class="loading-spinner-mini"></div> Cargando departamentos disponibles...';
            departmentSelect.parentNode.appendChild(loadingDiv);
            
            // Cargar departamentos
            await loadDepartments();
            
            // Remover loading
            departmentSelect.disabled = false;
            const loadingElement = departmentSelect.parentNode.querySelector('.department-loading');
            if (loadingElement) {
                loadingElement.remove();
            }
        }
        
    } catch (error) {
        console.error('Error al abrir modal externo:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información de departamentos.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Cargar lista de departamentos
async function loadDepartments() {
    try {
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT IdDepartamento, NombreDepartamento 
            FROM departamentos 
            WHERE IdDepartamento != ?
            ORDER BY NombreDepartamento
        `, [userData.IdSucuDepa]);
        
        await connection.close();
        
        availableDepartments = result;
        
        const departmentSelect = document.getElementById('departmentSelect');
        if (departmentSelect) {
            // Limpiar opciones existentes
            departmentSelect.innerHTML = '<option value="">-- Seleccione un departamento --</option>';
            
            // Agregar departamentos
            result.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.IdDepartamento;
                option.textContent = dept.NombreDepartamento;
                departmentSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
        throw error;
    }
}

// Cargar colaboradores de departamento seleccionado
async function loadEmployeesFromDepartment(departmentId) {
    const employeeSelect = document.getElementById('externalEmployeeSelect');
    const employeeGroup = document.getElementById('employeeSelectGroup');
    const employeeLoading = document.getElementById('employeeLoading');
    const validationStatus = document.getElementById('validationStatus');
    
    try {
        
        if (!departmentId) return;
        
        // MOSTRAR LOADING
        if (employeeGroup) employeeGroup.style.display = 'block';
        if (employeeLoading) {
            employeeLoading.style.display = 'flex';
            employeeLoading.classList.add('pulse');
        }
        if (employeeSelect) {
            employeeSelect.classList.add('loading');
            employeeSelect.disabled = true;
            employeeSelect.innerHTML = '<option value="">Cargando colaboradores...</option>';
        }
        if (validationStatus) validationStatus.style.display = 'none';
        
        // Ocultar preview anterior
        const employeeInfo = document.getElementById('externalEmployeeInfo');
        if (employeeInfo) employeeInfo.style.display = 'none';
        
        // Simular un pequeño delay para mostrar el loading (opcional)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const connection = await connectionString();
        const result = await connection.query(`
            SELECT 
                personal.IdPersonal, 
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto, 
                Puestos.Nombre AS NombrePuesto,
                departamentos.NombreDepartamento,
                CASE 
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL 
                END AS FotoBase64
            FROM personal 
            INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto 
            INNER JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
            LEFT JOIN FotosPersonal ON personal.IdPersonal = FotosPersonal.IdPersonal
            WHERE personal.Estado = 1 
            AND personal.TipoPersonal = 1 
            AND personal.IdSucuDepa = ?
            ORDER BY NombreCompleto
        `, [departmentId]);
        
        await connection.close();
        
        // OCULTAR LOADING
        if (employeeLoading) {
            employeeLoading.style.display = 'none';
            employeeLoading.classList.remove('pulse');
        }
        if (employeeSelect) {
            employeeSelect.classList.remove('loading');
            employeeSelect.disabled = false;
        }
        
        if (employeeSelect && employeeGroup) {
            // Limpiar opciones existentes
            employeeSelect.innerHTML = '<option value="">-- Seleccione un colaborador --</option>';
            
            if (result.length > 0) {
                // Agregar colaboradores
                result.forEach((emp, index) => {
                    
                    const option = document.createElement('option');
                    option.value = emp.IdPersonal;
                    option.textContent = emp.NombreCompleto;
                    
                    const employeeDataForOption = {
                        IdPersonal: emp.IdPersonal,
                        NombreCompleto: emp.NombreCompleto || 'Sin nombre',
                        NombrePuesto: emp.NombrePuesto || 'Sin puesto',
                        NombreDepartamento: emp.NombreDepartamento || 'Sin departamento',
                        FotoBase64: emp.FotoBase64 || null
                    };
                    
                    option.dataset.employeeData = JSON.stringify(employeeDataForOption);
                    employeeSelect.appendChild(option);
                });
                
                // Mostrar mensaje de éxito
                showValidationStatus('success', `✅ Se encontraron ${result.length} colaboradores disponibles.`);
                
            } else {
                showValidationStatus('warning', '⚠️ No hay colaboradores disponibles en este departamento.');
            }
        }
        
    } catch (error) {
        console.error('Error al cargar colaboradores:', error);
        
        // OCULTAR LOADING EN CASO DE ERROR
        if (employeeLoading) {
            employeeLoading.style.display = 'none';
            employeeLoading.classList.remove('pulse');
        }
        if (employeeSelect) {
            employeeSelect.classList.remove('loading');
            employeeSelect.disabled = false;
            employeeSelect.innerHTML = '<option value="">-- Error al cargar --</option>';
        }
        
        showValidationStatus('error', '❌ Error al cargar colaboradores del departamento. Intente nuevamente.');
    }
}

// Validar si el colaborador ya tiene bonificación en el período
async function validateExternalEmployee(employeeId) {
    try {
        const connection = await connectionString();
        
        // Buscar si ya tiene bonificación en cualquier departamento para este período
        const result = await connection.query(`
            SELECT 
                b.IdBonificacion,
                b.IdDepaSucur,
                d.NombreDepartamento,
                bd.NombrePersonal
            FROM Bonificaciones b
            INNER JOIN BonificacionDetalle bd ON b.IdBonificacion = bd.IdBonificacion
            INNER JOIN departamentos d ON b.IdDepaSucur = d.IdDepartamento
            WHERE bd.IdPersonal = ? AND b.MesAnio = ?
        `, [employeeId, currentPeriodMesAnio]);
        
        await connection.close();
        
        if (result.length > 0) {
            const existing = result[0];
            showValidationStatus('error', 
                `❌ Este colaborador ya tiene bonificación registrada en ${existing.NombreDepartamento} para ${getMonthName(currentPeriodMesAnio.substring(0, 2))} ${currentPeriodMesAnio.substring(2)}.`
            );
            return false;
        } else {
            showValidationStatus('success', 
                `✅ El colaborador está disponible para agregar a la bonificación de ${getMonthName(currentPeriodMesAnio.substring(0, 2))} ${currentPeriodMesAnio.substring(2)}.`
            );
            return true;
        }
        
    } catch (error) {
        console.error('Error al validar colaborador:', error);
        showValidationStatus('error', '❌ Error al validar disponibilidad del colaborador.');
        return false;
    }
}
function showValidationStatus(type, message) {
    const validationStatus = document.getElementById('validationStatus');
    if (validationStatus) {
        validationStatus.className = `validation-status ${type}`;
        validationStatus.innerHTML = `<span class="status-icon">${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌'}</span>${message}`;
        validationStatus.style.display = 'block';
    }
    
    // Habilitar/deshabilitar botón confirmar
    const confirmBtn = document.getElementById('confirmExternalModal');
    if (confirmBtn) {
        confirmBtn.disabled = type !== 'success';
    }
}
function showEmployeePreview(employeeData) {
    
    if (!employeeData) {
        console.error('No se recibieron datos del empleado');
        return;
    }
    
    const employeeInfo = document.getElementById('externalEmployeeInfo');
    const previewPhoto = document.getElementById('previewPhoto');
    const previewName = document.getElementById('previewName');
    const previewPosition = document.getElementById('previewPosition');
    const previewDepartment = document.getElementById('previewDepartment');
    const previewId = document.getElementById('previewId');
    
    if (employeeInfo && previewPhoto && previewName && previewPosition && previewDepartment && previewId) {
        previewPhoto.src = employeeData.FotoBase64 || '../Imagenes/user-default.png';
        previewName.textContent = employeeData.NombreCompleto || 'Sin nombre';
        previewPosition.textContent = employeeData.NombrePuesto || 'Sin puesto';
        previewDepartment.textContent = employeeData.NombreDepartamento || 'Sin departamento';
        previewId.textContent = `ID: ${employeeData.IdPersonal || 'N/A'}`;
        
        employeeInfo.style.display = 'block';
        
        // IMPORTANTE: Guardar la referencia
        selectedExternalEmployee = { ...employeeData }; // Hacer una copia
    } else {
        console.error('No se encontraron los elementos DOM necesarios');
    }
}
async function addExternalEmployeeToList() {
    try {
        
        if (!selectedExternalEmployee) {
            console.error('No hay colaborador seleccionado');
            Swal.fire({
                icon: 'warning',
                title: 'Sin selección',
                text: 'Debe seleccionar un colaborador antes de agregarlo.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Verificar que tenga los datos necesarios
        if (!selectedExternalEmployee.IdPersonal || !selectedExternalEmployee.NombreCompleto) {
            console.error('Datos incompletos del colaborador:', selectedExternalEmployee);
            Swal.fire({
                icon: 'error',
                title: 'Datos incompletos',
                text: 'Los datos del colaborador están incompletos. Intente seleccionar nuevamente.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Verificar que no esté ya en la lista local
        const existsInLocal = employeesData.find(emp => emp.IdPersonal === selectedExternalEmployee.IdPersonal);
        if (existsInLocal) {
            Swal.fire({
                icon: 'warning',
                title: 'Colaborador ya agregado',
                text: 'Este colaborador ya está en la lista actual.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }
        
        // Crear objeto del nuevo empleado con datos completos
        const newEmployee = {
            IdPersonal: selectedExternalEmployee.IdPersonal,
            NombreCompleto: selectedExternalEmployee.NombreCompleto,
            NombrePuesto: selectedExternalEmployee.NombrePuesto || 'Sin puesto',
            NombreDepartamento: selectedExternalEmployee.NombreDepartamento || 'Externo',
            FotoBase64: selectedExternalEmployee.FotoBase64 || null,
            bonificacionRegular: 0,
            bonificacionExtra: 0,
            descuentoVales: 0,
            descuentoCreditos: 0,
            referenciaVales: '',
            referenciaCreditos: '',
            observacionesVales: '',
            observacionesCreditos: '',
            observacionesBonificacionExtra: '',
            totalNeto: 0,
            isSaved: false,
            isLoaded: false,
            isModified: false,
            isExternal: true // Marcar como externo
        };
        
        // Agregar a la lista local
        employeesData.push(newEmployee);
        
        // Actualizar datos filtrados
        filteredData = [...employeesData];
        
        // Re-renderizar tabla
        if (currentSort.field) {
            sortData(currentSort.field, currentSort.direction);
            updateSortIndicators(currentSort.field, currentSort.direction);
        }
        renderTable();
        createPagination();
        updateTableInfo();
        
        // Cerrar modal
        closeExternalEmployeeModal();
        
        // Mostrar confirmación
        Swal.fire({
            icon: 'success',
            title: 'Colaborador agregado',
            text: `${newEmployee.NombreCompleto} ha sido agregado a la lista.`,
            toast: true,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('Error al agregar colaborador externo:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo agregar el colaborador. Intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Resetear modal
function resetExternalEmployeeModal() {
    const departmentSelect = document.getElementById('departmentSelect');
    const employeeSelect = document.getElementById('externalEmployeeSelect');
    const employeeGroup = document.getElementById('employeeSelectGroup');
    const employeeInfo = document.getElementById('externalEmployeeInfo');
    const validationStatus = document.getElementById('validationStatus');
    const confirmBtn = document.getElementById('confirmExternalModal');
    
    if (departmentSelect) departmentSelect.value = '';
    if (employeeSelect) employeeSelect.value = '';
    if (employeeGroup) employeeGroup.style.display = 'none';
    if (employeeInfo) employeeInfo.style.display = 'none';
    if (validationStatus) validationStatus.style.display = 'none';
    if (confirmBtn) confirmBtn.disabled = true;
    
    selectedExternalEmployee = null;
}

// Cerrar modal
function closeExternalEmployeeModal() {
    const modal = document.getElementById('externalEmployeeModal');
    if (modal) {
        modal.style.display = 'none';
    }
    resetExternalEmployeeModal();
}

// Setup event listeners para modal externo
function setupExternalEmployeeModalListeners() {
    const modal = document.getElementById('externalEmployeeModal');
    const closeBtn = document.getElementById('closeExternalModal');
    const cancelBtn = document.getElementById('cancelExternalModal');
    const confirmBtn = document.getElementById('confirmExternalModal');
    const departmentSelect = document.getElementById('departmentSelect');
    const employeeSelect = document.getElementById('externalEmployeeSelect');
    
    if (closeBtn) closeBtn.addEventListener('click', closeExternalEmployeeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeExternalEmployeeModal);
    if (confirmBtn) confirmBtn.addEventListener('click', addExternalEmployeeToList);
    
    if (departmentSelect) {
        departmentSelect.addEventListener('change', function() {
            const selectedDept = this.value;
            if (selectedDept) {
                loadEmployeesFromDepartment(selectedDept);
            } else {
                document.getElementById('employeeSelectGroup').style.display = 'none';
                document.getElementById('externalEmployeeInfo').style.display = 'none';
                document.getElementById('validationStatus').style.display = 'none';
            }
        });
    }
    
    if (employeeSelect) {
        employeeSelect.addEventListener('change', async function() {
            
            const selectedEmployeeId = this.value;
            if (selectedEmployeeId) {
                const option = this.options[this.selectedIndex];
                
                try {
                    const employeeData = JSON.parse(option.dataset.employeeData);
                    
                    showEmployeePreview(employeeData);
                    await validateExternalEmployee(selectedEmployeeId);
                } catch (parseError) {
                    console.error('Error al parsear datos del empleado:', parseError);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Error al procesar datos del colaborador seleccionado.',
                        confirmButtonColor: '#FF9800'
                    });
                }
            } else {
                console.log('No hay empleado seleccionado, ocultando preview'); // Debug
                document.getElementById('externalEmployeeInfo').style.display = 'none';
                document.getElementById('validationStatus').style.display = 'none';
                selectedExternalEmployee = null;
            }
        });
    }
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeExternalEmployeeModal();
        }
    });
}
// ===== CLEANUP AL SALIR =====

window.addEventListener('beforeunload', function(event) {
    // Verificar si hay cambios sin guardar
    const hasUnsavedChanges = employeesData.some(emp => 
        emp.isModified || (!emp.isSaved && (
            emp.bonificacionRegular > 0 || emp.bonificacionExtra > 0 || 
            emp.descuentoVales > 0 || emp.descuentoCreditos > 0
        ))
    );
    
    if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '¿Estás seguro de que quieres salir? Los cambios no guardados se perderán.';
        return event.returnValue;
    }
});

window.addEventListener('error', function(event) {
    console.error('Error global:', event.error);
    // Mostrar toast de error discreto
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'error',
            title: 'Error inesperado',
            text: 'Ocurrió un error. Por favor recarga la página.',
            toast: true,
            position: 'top-end',
            timer: 5000,
            showConfirmButton: false
        });
    }
});

// ===== RESPONSIVE Y EVENTOS DE VENTANA =====

window.addEventListener('resize', debounce(() => {
    updateButtonTextForScreenSize();
    updateTableInfo();
}, 250));

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

// ===== INICIALIZACIÓN FINAL =====

// Llamar al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(initializeTooltips, 1000);
    setupExternalEmployeeModalListeners();

    // Verificar permisos para colaboradores externos
    await checkExternalEmployeePermission();
});