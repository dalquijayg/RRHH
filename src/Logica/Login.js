const odbc = require('odbc');
const path = require('path');
const { json } = require('stream/consumers');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const Swal = require('sweetalert2');
const conexion = 'DSN=recursos2'; // Asegúrate de tener configurado el DSN correctamente

async function connectionString() {
    try {
            const connection = await odbc.connect(conexion, {
                // Añadir opciones específicas para manejar datos binarios
                binaryAsString: true,  // Tratar datos binarios como cadenas
                bigint: 'string'       // Manejar números grandes
            });
            
            // Configuración adicional de la conexión
            await connection.query('SET NAMES utf8mb4');
            await connection.query('SET character_set_results = utf8mb4');
            
            return connection;
        } catch (error) {
            console.error('Error de conexión:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de conexión',
                text: 'No se pudo conectar a la base de datos. Por favor intente nuevamente.'
            });
            throw error;
        }
}

async function verificarDPI(dpi) {
    try {
        const connection = await connectionString();
        const result = await connection.query(`SELECT
                                                personal.IdPersonal, 
                                                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto, 
                                                personal.IdSucuDepa, 
                                                departamentos.NombreDepartamento, 
                                                PuestosGenerales.Id_Puesto, 
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

async function guardarSecret2FA(id, secret) {
    try {
        const connection = await odbc.connect(conexion);
        await connection.query('UPDATE personal SET Secret_2FA = ? WHERE IdPersonal = ?', [secret, id]);
        await connection.close();
        return true;
    } catch (error) {
        console.error('Error al guardar Secret_2FA:', error);
        return false;
    }
}

async function mostrarConfiguracion2FA(userData) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(userData.NombreCompleto, 'Sistema RRHH', secret);
    
    // Preparar la imagen del usuario para el modal
    const userImage = userData.FotoBase64 || '../Imagenes/user-default.png';
    
    try {
        const qrCodeUrl = await qrcode.toDataURL(otpauth);
        
        const result = await Swal.fire({
            title: 'Configuración de Autenticación de Dos Factores',
            html: `
                <div style="text-align: center;">
                    <!-- Foto del usuario -->
                    <div style="width: 100px; height: 100px; border-radius: 50%; overflow: hidden; margin: 0 auto 15px; border: 3px solid #FF9800; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                        <img src="${userImage}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <h3 style="margin-bottom: 5px; color: #654321; font-size: 1.2rem;">${userData.NombreCompleto}</h3>
                    <p style="margin-bottom: 20px; color: #777; font-size: 0.9rem;">${userData.NombreDepartamento}</p>
                    <hr style="margin-bottom: 20px; border: none; height: 1px; background: #eee;">
                    
                    <p>Para comenzar a usar la autenticación de dos factores, sigue estos pasos:</p>
                    <ol style="text-align: left;">
                        <li>Descarga una aplicación de autenticación como Google Authenticator o Authy</li>
                        <li>Escanea el siguiente código QR con la aplicación:</li>
                    </ol>
                    <img src="${qrCodeUrl}" style="margin: 20px auto;">
                    <p>O ingresa este código manualmente en tu aplicación:</p>
                    <code style="background: #f0f0f0; padding: 10px; display: block; word-break: break-all;">${secret}</code>
                    <p>Una vez configurado, ingresa el código de 6 dígitos que aparece en tu aplicación:</p>
                </div>
            `,
            input: 'text',
            inputAttributes: {
                autocapitalize: 'off',
                maxlength: 6,
                inputmode: 'numeric',
                pattern: '[0-9]*',
                style: 'text-align: center; letter-spacing: 5px; font-size: 1.2rem;'
            },
            showCancelButton: true,
            confirmButtonText: 'Verificar y Activar',
            confirmButtonColor: '#FF9800',
            cancelButtonText: 'Cancelar',
            allowOutsideClick: false
        });

        if (result.isConfirmed) {
            const code = result.value;
            const isValid = authenticator.verify({
                token: code,
                secret: secret
            });

            if (isValid) {
                const saved = await guardarSecret2FA(userData.IdPersonal, secret);
                if (saved) {
                    await Swal.fire({
                        icon: 'success',
                        title: '¡Configuración exitosa!',
                        text: 'La autenticación de dos factores ha sido activada correctamente.'
                    });
                    userData.Secret_2FA = secret;
                    return userData;
                } else {
                    throw new Error('Error al guardar la configuración');
                }
            } else {
                throw new Error('Código incorrecto');
            }
        } else {
            throw new Error('Configuración cancelada');
        }
    } catch (error) {
        await Swal.fire({
            icon: 'error',
            title: 'Error en la configuración',
            text: error.message || 'No se pudo completar la configuración de 2FA'
        });
        throw error;
    }
}

function validarEntrada(event) {
    const input = event.target;
    input.value = input.value.replace(/[^0-9]/g, ''); // Eliminar cualquier carácter que no sea un número
}

function habilitarBoton() {
    const input = document.getElementById('dpi');
    const boton = document.querySelector('.btn');
    boton.disabled = input.value.length !== 13; // Habilitar el botón solo si hay 13 dígitos
}

// Función para mostrar una animación de carga
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

document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const dpi = document.getElementById('dpi').value;
    
    // Agregar clase "submitting" para efectos visuales
    document.querySelector('.login-box').classList.add('submitting');
    
    // Mostrar animación de carga
    const loadingSwal = mostrarCargando('Verificando DPI...');

    try {
        let userData = await verificarDPI(dpi);
        
        // Cerrar la animación de carga
        loadingSwal.close();
        
        // Quitar clase "submitting"
        document.querySelector('.login-box').classList.remove('submitting');
        
        if (userData) {
            // Verificar si el usuario tiene acceso al sistema
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
            
            // Preparar la imagen del usuario
            const userImage = userData.FotoBase64 || '../Imagenes/user-default.png';
            
            // Agregar clase "success" para efectos visuales
            document.querySelector('.login-box').classList.add('success');
            
            // Si no tiene 2FA configurado, mostrar configuración
            if (!userData.Secret_2FA) {
                try {
                    userData = await mostrarConfiguracion2FA(userData);
                } catch (error) {
                    console.error('Error en configuración 2FA:', error);
                    document.querySelector('.login-box').classList.remove('success');
                    return;
                }
            }

            // Solicitar código 2FA con la imagen del usuario
            const result = await Swal.fire({
                title: 'Verificación de Identidad',
                html: `
                    <div style="text-align: center;">
                        <!-- Foto del usuario -->
                        <div style="width: 100px; height: 100px; border-radius: 50%; overflow: hidden; margin: 0 auto 15px; border: 3px solid #FF9800; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                            <img src="${userImage}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <h3 style="margin-bottom: 5px; color: #654321; font-size: 1.2rem;">${userData.NombreCompleto}</h3>
                        <p style="margin-bottom: 20px; color: #777; font-size: 0.9rem;">${userData.NombreDepartamento}</p>
                        <hr style="margin-bottom: 20px; border: none; height: 1px; background: #eee;">
                        
                        <p style="margin-bottom: 15px;">Ingrese el código de 6 dígitos de su aplicación autenticadora:</p>
                    </div>
                `,
                input: 'text',
                inputAttributes: {
                    autocapitalize: 'off',
                    maxlength: 6,
                    inputmode: 'numeric',
                    pattern: '[0-9]*',
                    style: 'text-align: center; letter-spacing: 5px; font-size: 1.2rem;'
                },
                showCancelButton: true,
                confirmButtonText: 'Verificar',
                confirmButtonColor: '#FF9800',
                cancelButtonText: 'Cancelar',
                showLoaderOnConfirm: true,
                preConfirm: (code) => {
                    if (!/^\d{6}$/.test(code)) {
                        Swal.showValidationMessage('El código debe tener 6 dígitos numéricos');
                        return false;
                    }
                    
                    const isValid = authenticator.verify({
                        token: code,
                        secret: userData.Secret_2FA
                    });

                    if (isValid) {
                        localStorage.setItem('userData', JSON.stringify(userData));
                        return true;
                    } else {
                        Swal.showValidationMessage('Código incorrecto o expirado');
                        return false;
                    }
                }
            });

            if (result.isConfirmed) {
                // Mostrar mensaje de bienvenida con foto antes de redirigir
                await Swal.fire({
                    icon: 'success',
                    title: '¡Bienvenido!',
                    html: `
                        <div style="text-align: center; animation: fadeIn 0.5s;">
                            <!-- Foto del usuario más grande -->
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
        // Cerrar la animación de carga en caso de error
        loadingSwal.close();
        
        // Quitar clase "submitting"
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

document.getElementById('dpi').addEventListener('input', (event) => {
    validarEntrada(event);
    habilitarBoton();
});

// Inicializar el estado del botón al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    habilitarBoton();
    
    // Agregar estilos para animaciones
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
        </style>
    `);
});