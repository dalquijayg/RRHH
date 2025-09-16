const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const { json } = require('stream/consumers');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const Swal = require('sweetalert2');

// Variable global para controlar el estado de actualización
let updateAvailable = false;
let updateDownloaded = false;

// Configurar otplib con parámetros más tolerantes
authenticator.options = {
    step: 30,    // Período de 30 segundos
    window: 2    // Ventana de tolerancia de ±60 segundos
};

async function verificarDPI(dpi) {
    try {
        const connection = await connectionString();
        const result = await connection.query(`SELECT
                                                personal.IdPersonal, 
                                                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto, 
                                                personal.IdSucuDepa, 
                                                departamentos.NombreDepartamento, 
                                                PuestosGenerales.Id_Puesto, 
                                                PuestosGenerales.Nombre,
                                                personal.Secret_2FA,
                                                personal.IngresoSistema,
                                                CASE 
                                                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                                                    ELSE NULL 
                                                END AS FotoBase64
                                            FROM
                                                personal
                                                INNER JOIN
                                                departamentos
                                                ON 
                                                    personal.IdSucuDepa = departamentos.IdDepartamento
                                                INNER JOIN
                                                Puestos
                                                ON 
                                                    personal.IdPuesto = Puestos.IdPuesto
                                                INNER JOIN
                                                PuestosGenerales
                                                ON 
                                                    Puestos.Id_PuestoGeneral = PuestosGenerales.Id_Puesto
                                                LEFT JOIN
                                                FotosPersonal
                                                ON 
                                                    personal.IdPersonal = FotosPersonal.IdPersonal
                                            WHERE
                                                DPI = ?`, [dpi]);
        await connection.close();
        if (result.length > 0) {
            return result[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error de conexión o consulta:', error);
        throw error;
    }
}

// Función para mostrar el modal de actualización obligatoria
function mostrarActualizacionObligatoria() {
    return Swal.fire({
        title: 'Actualización Requerida',
        html: `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 4rem; color: #FF9800; margin-bottom: 20px;">🔄</div>
                <h3 style="color: #654321; margin-bottom: 15px;">Nueva versión disponible</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    Se ha detectado una nueva versión del sistema. Por seguridad y para obtener las últimas características, 
                    debe actualizar antes de continuar.
                </p>
                <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #e65100; font-size: 0.9rem; margin: 0;">
                        <strong>⚠️ El acceso está temporalmente bloqueado hasta completar la actualización</strong>
                    </p>
                </div>
                <div class="update-progress" style="margin: 20px 0;">
                    <div style="background: #e0e0e0; height: 6px; border-radius: 3px; overflow: hidden;">
                        <div id="progressBar" style="background: #FF9800; height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 3px;"></div>
                    </div>
                    <p id="progressText" style="color: #666; font-size: 0.85rem; margin-top: 10px;">Preparando descarga...</p>
                </div>
            </div>
        `,
        icon: null,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        showCancelButton: false,
        width: '500px',
        customClass: {
            popup: 'no-close-popup'
        }
    });
}

// Función para actualizar el progreso de descarga
function actualizarProgreso(progreso, texto) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (progressBar) {
        progressBar.style.width = progreso + '%';
    }
    if (progressText) {
        progressText.textContent = texto;
    }
}

// Función para mostrar que la actualización está lista para instalar
function mostrarActualizacionLista() {
    return Swal.fire({
        title: 'Actualización Lista',
        html: `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 4rem; color: #4CAF50; margin-bottom: 20px;">✅</div>
                <h3 style="color: #654321; margin-bottom: 15px;">Actualización descargada</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    La nueva versión ha sido descargada correctamente. 
                    La aplicación se reiniciará para completar la instalación.
                </p>
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #2e7d32; font-size: 0.9rem; margin: 0;">
                        <strong>🎉 ¡Todo listo! El proceso tomará solo unos segundos</strong>
                    </p>
                </div>
            </div>
        `,
        icon: null,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonText: 'Reiniciar Ahora',
        confirmButtonColor: '#4CAF50',
        showCancelButton: false,
        width: '450px',
        timer: 5000, // Auto-reinicio después de 5 segundos
        timerProgressBar: true
    });
}

async function guardarSecret2FA(id, secret) {
    try {
        const connection = await connectionString();
        await connection.query('UPDATE personal SET Secret_2FA = ? WHERE IdPersonal = ?', [secret, id]);
        await connection.close();
        return true;
    } catch (error) {
        console.error('Error al guardar Secret_2FA:', error);
        return false;
    }
}

// Función mejorada para verificar códigos 2FA con mayor tolerancia
function verificarCodigo2FA(code, secret) {
    try {
        // Verificación principal con ventana de tolerancia
        const isValid = authenticator.verify({
            token: code,
            secret: secret,
            window: 2 // ±60 segundos de tolerancia
        });
        
        if (isValid) {
            console.log('Código verificado exitosamente con método principal');
            return true;
        }

        // Verificación alternativa manual para mayor compatibilidad
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Probar diferentes ventanas de tiempo
        for (let window = -3; window <= 3; window++) {
            const timeStep = Math.floor(currentTime / 30) + window;
            const expectedToken = authenticator.generate(secret, { 
                epoch: timeStep * 30 
            });
            
            if (code === expectedToken) {
                console.log(`Código verificado exitosamente con ventana ${window}`);
                return true;
            }
        }
        
        console.log('Código no válido después de todas las verificaciones');
        return false;
    } catch (error) {
        console.error('Error en verificación 2FA:', error);
        return false;
    }
}

async function mostrarConfiguracion2FA(userData) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(
        userData.NombreCompleto, 
        'Sistema RRHH', 
        secret
    );
    
    const userImage = userData.FotoBase64 || '../Imagenes/user-default.png';
    const horaActual = new Date().toLocaleString('es-GT', {
        timeZone: 'America/Guatemala',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    try {
        const qrCodeUrl = await qrcode.toDataURL(otpauth, {
            width: 200,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        const result = await Swal.fire({
            title: 'Autenticación de Dos Factores',
            html: `
                <div style="text-align: center;">
                    <!-- Usuario compacto -->
                    <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 15px;">
                        <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; border: 2px solid #FF9800; flex-shrink: 0;">
                            <img src="${userImage}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div style="text-align: left;">
                            <h4 style="margin: 0; color: #654321; font-size: 1rem;">${userData.NombreCompleto}</h4>
                            <p style="margin: 0; color: #777; font-size: 0.8rem;">${userData.NombreDepartamento}</p>
                        </div>
                    </div>
                    
                    <!-- Layout en dos columnas -->
                    <div style="display: flex; gap: 20px; align-items: flex-start; justify-content: center; flex-wrap: wrap;">
                        
                        <!-- Columna izquierda: QR y código -->
                        <div style="flex: 1; min-width: 200px; max-width: 250px;">
                            <img src="${qrCodeUrl}" style="width: 100%; max-width: 200px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 10px;">
                            
                            <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin-bottom: 15px;">
                                <p style="margin: 0; font-size: 0.75rem; color: #666; margin-bottom: 4px;">Código manual:</p>
                                <div style="font-family: monospace; font-size: 0.7rem; word-break: break-all; color: #333; line-height: 1.2;">${secret}</div>
                            </div>
                        </div>
                        
                        <!-- Columna derecha: Instrucciones -->
                        <div style="flex: 1; min-width: 200px; max-width: 250px; text-align: left;">
                            <div style="background: #e3f2fd; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                                <h4 style="color: #1976d2; margin: 0 0 8px 0; font-size: 0.9rem;">📱 Pasos:</h4>
                                <ol style="color: #424242; font-size: 0.8rem; margin: 0; padding-left: 16px; line-height: 1.3;">
                                    <li style="margin-bottom: 3px;">Descarga Google Authenticator</li>
                                    <li style="margin-bottom: 3px;">Escanea el código QR</li>
                                    <li style="margin-bottom: 3px;">Ingresa el código de 6 dígitos</li>
                                </ol>
                            </div>
                            
                            <div style="background: #fff3e0; padding: 10px; border-radius: 6px;">
                                <h4 style="color: #f57c00; margin: 0 0 5px 0; font-size: 0.85rem;">⏰ Importante:</h4>
                                <p style="color: #424242; font-size: 0.75rem; margin: 0; line-height: 1.3;">
                                    Hora: <strong>${horaActual}</strong><br>
                                    Sincroniza la hora de tu dispositivo
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Campo de entrada -->
                    <div style="margin-top: 20px;">
                        <p style="color: #424242; font-size: 0.9rem; margin-bottom: 8px;">Código de 6 dígitos:</p>
                    </div>
                </div>
            `,
            input: 'text',
            inputAttributes: {
                autocapitalize: 'off',
                maxlength: 6,
                inputmode: 'numeric',
                pattern: '[0-9]*',
                style: 'text-align: center; letter-spacing: 6px; font-size: 1.3rem; font-weight: bold; border: 2px solid #ddd; border-radius: 8px; padding: 12px; width: 200px;',
                placeholder: '000000'
            },
            showCancelButton: true,
            confirmButtonText: 'Verificar',
            confirmButtonColor: '#FF9800',
            cancelButtonText: 'Cancelar',
            allowOutsideClick: false,
            width: '600px',
            customClass: {
                popup: 'swal2-no-scroll'
            },
            showLoaderOnConfirm: true,
            preConfirm: (code) => {
                if (!/^\d{6}$/.test(code)) {
                    Swal.showValidationMessage('El código debe tener exactamente 6 dígitos numéricos');
                    return false;
                }
                
                const isValid = verificarCodigo2FA(code, secret);
                
                if (isValid) {
                    return guardarSecret2FA(userData.IdPersonal, secret);
                } else {
                    Swal.showValidationMessage('Código incorrecto. Usa el código más reciente de la app.');
                    return false;
                }
            }
        });

        if (result.isConfirmed) {
            if (result.value) {
                await Swal.fire({
                    icon: 'success',
                    title: '¡Configuración exitosa!',
                    html: `
                        <div style="text-align: center;">
                            <div style="font-size: 3rem; margin-bottom: 15px;">🎉</div>
                            <p>La autenticación de dos factores ha sido activada correctamente.</p>
                            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="color: #2e7d32; font-size: 0.9rem; margin: 0;">
                                    <strong>Tu cuenta ahora está más segura.</strong><br>
                                    Necesitarás tu aplicación autenticadora cada vez que ingreses al sistema.
                                </p>
                            </div>
                        </div>
                    `,
                    confirmButtonColor: '#4CAF50',
                    timer: 3000,
                    timerProgressBar: true,
                    width: '450px'
                });
                userData.Secret_2FA = secret;
                return userData;
            } else {
                throw new Error('Error al guardar la configuración en la base de datos');
            }
        } else {
            throw new Error('Configuración cancelada por el usuario');
        }
    } catch (error) {
        console.error('Error en configuración 2FA:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error en la configuración',
            html: `
                <div>
                    <p>${error.message || 'No se pudo completar la configuración de 2FA'}</p>
                    <div style="background: #ffebee; padding: 12px; border-radius: 8px; margin: 15px 0; text-align: left;">
                        <h4 style="color: #c62828; margin-bottom: 8px; font-size: 0.9rem;">💡 Posibles soluciones:</h4>
                        <ul style="color: #424242; font-size: 0.8rem; margin: 0; padding-left: 18px; line-height: 1.4;">
                            <li>Verifica que la hora de tu dispositivo esté correcta</li>
                            <li>Asegúrate de usar el código más reciente</li>
                            <li>Intenta cerrar y abrir la app autenticadora</li>
                            <li>Verifica tu conexión a internet</li>
                        </ul>
                    </div>
                </div>
            `,
            confirmButtonColor: '#FF9800',
            width: '480px'
        });
        throw error;
    }
}

function validarEntrada(event) {
    const input = event.target;
    input.value = input.value.replace(/[^0-9]/g, '');
}

function habilitarBoton() {
    const input = document.getElementById('dpi');
    const boton = document.querySelector('.btn');
    // Bloquear botón si hay actualización disponible
    boton.disabled = input.value.length !== 13 || updateAvailable;
}

function mostrarCargando(mensaje = "Verificando...") {
    return Swal.fire({
        title: mensaje,
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                <div class="spinner" style="border: 5px solid #f3f3f3; border-top: 5px solid #FF9800; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;"></div>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false
    });
}

// Función principal del formulario de login - MODIFICADA
document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Verificar si hay una actualización disponible antes de proceder
    if (updateAvailable && !updateDownloaded) {
        await Swal.fire({
            icon: 'warning',
            title: 'Actualización en progreso',
            text: 'Se está descargando una actualización. Por favor espera a que termine la descarga.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#FF9800'
        });
        return;
    }
    
    if (updateDownloaded) {
        const result = await mostrarActualizacionLista();
        if (result.isConfirmed || result.isDismissed) {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('restart_app');
        }
        return;
    }
    
    const dpi = document.getElementById('dpi').value;
    
    document.querySelector('.login-box').classList.add('submitting');
    const loadingSwal = mostrarCargando('Verificando DPI...');

    try {
        let userData = await verificarDPI(dpi);
        loadingSwal.close();
        document.querySelector('.login-box').classList.remove('submitting');
        
        if (userData) {
            if (userData.IngresoSistema !== 1 && userData.IngresoSistema !== '1') {
                document.querySelector('.login-box').classList.add('error');
                
                await Swal.fire({
                    icon: 'error',
                    title: 'Acceso denegado',
                    text: 'No tienes permisos para ingresar al sistema. Contacta al administrador.',
                    confirmButtonText: 'Aceptar',
                    confirmButtonColor: '#FF9800'
                });
                
                setTimeout(() => {
                    document.querySelector('.login-box').classList.remove('error');
                }, 1000);
                return;
            }
            
            const userImage = userData.FotoBase64 || '../Imagenes/user-default.png';
            document.querySelector('.login-box').classList.add('success');
            
            if (!userData.Secret_2FA) {
                try {
                    userData = await mostrarConfiguracion2FA(userData);
                } catch (error) {
                    console.error('Error en configuración 2FA:', error);
                    document.querySelector('.login-box').classList.remove('success');
                    return;
                }
            }

            // Solicitar código 2FA mejorado
            const result = await Swal.fire({
                title: 'Verificación de Identidad',
                html: `
                    <div style="text-align: center;">
                        <!-- Usuario compacto -->
                        <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 20px;">
                            <div style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden; border: 3px solid #FF9800; flex-shrink: 0;">
                                <img src="${userImage}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                            <div style="text-align: left;">
                                <h3 style="margin: 0; color: #654321; font-size: 1.1rem;">${userData.NombreCompleto}</h3>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;">${userData.NombreDepartamento}</p>
                            </div>
                        </div>
                        
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="margin: 0; color: #1976d2; font-size: 0.95rem;">
                                <strong>🔐 Ingresa el código de tu aplicación autenticadora</strong>
                            </p>
                        </div>
                        
                        <p style="margin-bottom: 15px; color: #424242; font-size: 0.9rem;">Código de 6 dígitos:</p>
                    </div>
                `,
                input: 'text',
                inputAttributes: {
                    autocapitalize: 'off',
                    maxlength: 6,
                    inputmode: 'numeric',
                    pattern: '[0-9]*',
                    style: 'text-align: center; letter-spacing: 6px; font-size: 1.4rem; font-weight: bold; border: 2px solid #ddd; border-radius: 8px; padding: 12px; width: 200px;',
                    placeholder: '000000'
                },
                showCancelButton: true,
                confirmButtonText: 'Verificar',
                confirmButtonColor: '#FF9800',
                cancelButtonText: 'Cancelar',
                showLoaderOnConfirm: true,
                width: '450px', // Ancho más compacto
                customClass: {
                    popup: 'swal2-no-scroll'
                },
                preConfirm: (code) => {
                    if (!/^\d{6}$/.test(code)) {
                        Swal.showValidationMessage('El código debe tener exactamente 6 dígitos numéricos');
                        return false;
                    }
                    
                    const isValid = verificarCodigo2FA(code, userData.Secret_2FA);

                    if (isValid) {
                        localStorage.setItem('userData', JSON.stringify(userData));
                        return true;
                    } else {
                        Swal.showValidationMessage('Código incorrecto. Verifica la hora de tu dispositivo y usa el código más reciente.');
                        return false;
                    }
                }
            });

            if (result.isConfirmed) {
                await Swal.fire({
                    icon: 'success',
                    title: '¡Bienvenido!',
                    html: `
                        <div style="text-align: center; animation: fadeIn 0.5s;">
                            <div style="width: 120px; height: 120px; border-radius: 50%; overflow: hidden; margin: 0 auto 20px; border: 4px solid #FF9800; box-shadow: 0 8px 15px rgba(0,0,0,0.2);">
                                <img src="${userImage}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                            <h3 style="margin-bottom: 5px; color: #654321; font-size: 1.3rem;">${userData.NombreCompleto}</h3>
                            <p style="color: #777;">${userData.NombreDepartamento}</p>
                            <div style="margin-top: 15px;">
                                <span style="display: inline-block; background-color: #FF9800; color: white; padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; animation: fadeInUp 0.8s;">
                                    ${determinarRol(userData.Id_Puesto)}
                                </span>
                            </div>
                        </div>
                    `,
                    timer: 2000,
                    timerProgressBar: true,
                    showConfirmButton: false
                });
                
                window.location.href = path.join(__dirname, 'Menu.html');
            } else {
                document.querySelector('.login-box').classList.remove('success');
            }
        } else {
            document.querySelector('.login-box').classList.add('error');
            
            await Swal.fire({
                icon: 'error',
                title: 'DPI no encontrado',
                text: 'El número de DPI ingresado no existe en la base de datos.',
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#FF9800'
            });
            
            setTimeout(() => {
                document.querySelector('.login-box').classList.remove('error');
            }, 1000);
        }
    } catch (error) {
        loadingSwal.close();
        document.querySelector('.login-box').classList.remove('submitting');
        document.querySelector('.login-box').classList.add('error');
        
        await Swal.fire({
            icon: 'error',
            title: 'Error de Conexión',
            text: 'Hubo un problema al conectar con la base de datos o realizar la consulta.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#FF9800'
        });
        
        setTimeout(() => {
            document.querySelector('.login-box').classList.remove('error');
        }, 1000);
    }
});

function determinarRol(idPuesto) {
    if (idPuesto == 5) {
        return 'Administrador RRHH';
    } else if (idPuesto == 1) {
        return 'Gerente';
    } else {
        return 'Colaborador';
    }
}

document.getElementById('dpi').addEventListener('input', (event) => {
    validarEntrada(event);
    habilitarBoton();
});

document.addEventListener('DOMContentLoaded', () => {
    habilitarBoton();
    
    document.head.insertAdjacentHTML('beforeend', `
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
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
            
            /* Estilos para modales optimizados */
            .swal2-popup.swal2-no-scroll {
                max-height: 90vh !important;
                overflow: hidden !important;
            }

            .swal2-popup.swal2-no-scroll .swal2-content {
                max-height: calc(90vh - 200px) !important;
                overflow-y: auto !important;
                padding: 0 !important;
            }

            /* Estilos para modal sin botón de cerrar */
            .swal2-popup.no-close-popup .swal2-close {
                display: none !important;
            }

            /* Progreso de actualización */
            .update-progress {
                user-select: none;
            }

            @media screen and (max-width: 768px) {
                .swal2-popup {
                    width: 95% !important;
                    max-width: 95% !important;
                    margin: 10px !important;
                }
                
                .swal2-popup.swal2-no-scroll {
                    max-height: 95vh !important;
                }
                
                .swal2-popup.swal2-no-scroll .swal2-content {
                    max-height: calc(95vh - 150px) !important;
                }
            }

            @media screen and (max-width: 480px) {
                .swal2-popup {
                    width: 98% !important;
                    max-width: 98% !important;
                    margin: 5px !important;
                    padding: 15px !important;
                }
                
                .swal2-title {
                    font-size: 1.2rem !important;
                    padding: 0 0 15px 0 !important;
                }
                
                /* Layout vertical en móviles */
                .swal2-content div[style*="display: flex"] {
                    flex-direction: column !important;
                    gap: 15px !important;
                }
                
                .swal2-content div[style*="flex: 1"] {
                    max-width: 100% !important;
                }
            }

            .swal2-input {
                font-family: 'Poppins', sans-serif !important;
            }

            .swal2-content::-webkit-scrollbar {
                width: 6px;
            }

            .swal2-content::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }

            .swal2-content::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 3px;
            }

            .swal2-content::-webkit-scrollbar-thumb:hover {
                background: #a1a1a1;
            }
        </style>
    `);
});

// Event listeners para manejar las notificaciones de actualización desde Electron
document.addEventListener('DOMContentLoaded', () => {
    const { ipcRenderer } = require('electron');
    
    // Manejar notificación de actualización disponible
    ipcRenderer.on('update_available', () => {
        ipcRenderer.removeAllListeners('update_available');
        updateAvailable = true;
        
        // Deshabilitar el botón de login
        habilitarBoton();
        
        // Mostrar modal de actualización obligatoria
        const updateModal = mostrarActualizacionObligatoria();
        
        // Simular progreso de descarga (esto debería venir del proceso principal)
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 95) {
                progress = 95;
                actualizarProgreso(progress, 'Finalizando descarga...');
                clearInterval(progressInterval);
            } else if (progress > 80) {
                actualizarProgreso(progress, 'Casi terminando...');
            } else if (progress > 50) {
                actualizarProgreso(progress, 'Descargando actualización...');
            } else {
                actualizarProgreso(progress, 'Iniciando descarga...');
            }
        }, 800);
    });
    
    // Manejar notificación de actualización descargada
    ipcRenderer.on('update_downloaded', () => {
        ipcRenderer.removeAllListeners('update_downloaded');
        updateDownloaded = true;
        updateAvailable = false; // Ya no está descargando
        
        // Actualizar progreso al 100%
        actualizarProgreso(100, 'Descarga completada');
        
        // Cerrar modal actual y mostrar el de actualización lista
        setTimeout(async () => {
            Swal.close();
            
            const result = await mostrarActualizacionLista();
            if (result.isConfirmed || result.isDismissed) {
                ipcRenderer.send('restart_app');
            }
        }, 1500);
    });
});