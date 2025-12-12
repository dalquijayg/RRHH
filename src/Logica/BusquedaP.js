const { connectionString } = require('../Conexion/Conexion');
const path = require('path');
const fs = require('fs');
const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');

// Variables globales
let departamentos = [];
let tiposPersonal = [];
let estadosPersonal = [];
let departamentoSeleccionado = null;
let colaboradorSeleccionado = null;
let todosLosResultados = [];
let timeoutBusquedaNombre = null;

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarFiltros();
    configurarEventos();

    // Verificar si hay una búsqueda guardada para restaurar
    const busquedaGuardada = localStorage.getItem('busquedaPersonalEstado');
    if (busquedaGuardada) {
        await restaurarBusqueda(JSON.parse(busquedaGuardada));
        localStorage.removeItem('busquedaPersonalEstado'); // Limpiar después de restaurar
    } else {
        // NO cargar datos al iniciar - esperar a que el usuario busque
        mostrarMensajeInicial();
    }
});

// ==================== MENSAJE INICIAL ====================
function mostrarMensajeInicial() {
    const noResults = document.getElementById('noResults');
    const tabla = document.getElementById('tablaPersonal');

    noResults.innerHTML = `
        <i class="fas fa-search" style="font-size: 4rem; color: #FF9800;"></i>
        <h3 style="color: #666;">Utiliza los filtros para buscar colaboradores</h3>
        <p style="font-size: 0.9rem;">Selecciona un departamento o aplica filtros y presiona "Buscar"</p>
    `;
    noResults.style.display = 'flex';
    tabla.style.display = 'none';
    document.getElementById('totalResultados').textContent = '0';
}

// ==================== CARGAR FILTROS ==================== 
async function cargarFiltros() {
    try {
        mostrarLoader(true);
        
        // Cargar departamentos
        const connection = await connectionString();
        const resultDepartamentos = await connection.query(`
            SELECT
                departamentos.IdDepartamento, 
                departamentos.NombreDepartamento
            FROM
                departamentos
            ORDER BY departamentos.NombreDepartamento
        `);
        departamentos = resultDepartamentos;

        // Cargar tipos de personal
        const resultTipos = await connection.query(`
            SELECT
                TipoPersonal.IdTipo, 
                TipoPersonal.TipoPersonal
            FROM
                TipoPersonal
            ORDER BY TipoPersonal.TipoPersonal
        `);
        tiposPersonal = resultTipos;

        // Cargar estados de personal
        const resultEstados = await connection.query(`
            SELECT
                EstadoPersonal.IdEstado, 
                EstadoPersonal.EstadoPersonal
            FROM
                EstadoPersonal
            ORDER BY EstadoPersonal.EstadoPersonal
        `);
        estadosPersonal = resultEstados;

        await connection.close();

        // Llenar los selects
        llenarSelectTipoPersonal();
        llenarSelectEstadoPersonal();

        mostrarLoader(false);
    } catch (error) {
        console.error('Error al cargar filtros:', error);
        mostrarLoader(false);
        await Swal.fire({
            icon: 'error',
            title: 'Error al cargar filtros',
            text: 'No se pudieron cargar los filtros. Por favor, recarga la página.',
            confirmButtonColor: '#FF9800'
        });
    }
}

function llenarSelectTipoPersonal() {
    const select = document.getElementById('tipoPersonal');
    select.innerHTML = '<option value="">Todos los tipos</option>';
    
    tiposPersonal.forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo.IdTipo;
        option.textContent = tipo.TipoPersonal;
        select.appendChild(option);
    });
}

function llenarSelectEstadoPersonal() {
    const select = document.getElementById('estadoPersonal');
    select.innerHTML = '<option value="">Todos los estados</option>';
    
    estadosPersonal.forEach(estado => {
        const option = document.createElement('option');
        option.value = estado.IdEstado;
        option.textContent = estado.EstadoPersonal;
        select.appendChild(option);
    });
}

// ==================== CONFIGURAR EVENTOS ====================
function configurarEventos() {
    const inputNombre = document.getElementById('nombreColaborador');
    const inputDepartamento = document.getElementById('departamento');
    const btnBuscar = document.getElementById('btnBuscar');
    const btnLimpiar = document.getElementById('btnLimpiar');
    const btnRefresh = document.querySelector('.btn-refresh');
    const btnExport = document.querySelector('.btn-export');

    // Búsqueda de nombre mientras escribe (con debounce)
    inputNombre.addEventListener('input', () => {
        clearTimeout(timeoutBusquedaNombre);
        timeoutBusquedaNombre = setTimeout(() => {
            buscarNombresColaboradores();
        }, 300); // 300ms de delay para no sobrecargar
    });

    // Búsqueda de nombre con Enter
    inputNombre.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = inputNombre.value.trim();
            if (query.length >= 2) {
                ocultarResultadosNombres();
                buscarPersonal();
            }
        }
    });

    // Búsqueda de departamento mientras escribe
    inputDepartamento.addEventListener('input', () => {
        buscarDepartamentos();
    });

    // Búsqueda de departamento con Enter
    inputDepartamento.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarDepartamentos();
        }
    });

    // Ocultar resultados al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-wrapper')) {
            ocultarResultadosDepartamentos();
            ocultarResultadosNombres();
        }
    });

    // Eliminar departamento seleccionado
    document.getElementById('departamentoTag').addEventListener('click', (e) => {
        if (e.target.closest('.tag-remove')) {
            removerDepartamentoSeleccionado();
        }
    });

    // Eliminar colaborador seleccionado
    document.getElementById('nombreTag').addEventListener('click', (e) => {
        if (e.target.closest('.tag-remove')) {
            removerColaboradorSeleccionado();
        }
    });

    // Botón buscar
    btnBuscar.addEventListener('click', () => {
        buscarPersonal();
    });

    // Búsqueda con Enter en los selects
    document.getElementById('tipoPersonal').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            buscarPersonal();
        }
    });

    document.getElementById('estadoPersonal').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            buscarPersonal();
        }
    });

    // Botón limpiar
    btnLimpiar.addEventListener('click', limpiarFiltros);

    // Botón refresh
    btnRefresh.addEventListener('click', async () => {
        if (todosLosResultados.length > 0) {
            btnRefresh.querySelector('i').style.animation = 'spin 1s linear';
            await buscarPersonal();
            setTimeout(() => {
                btnRefresh.querySelector('i').style.animation = '';
            }, 1000);
        }
    });

    // Botón exportar
    btnExport.addEventListener('click', exportarExcel);
}

// ==================== AUTOCOMPLETADO NOMBRES ====================
async function buscarNombresColaboradores() {
    const input = document.getElementById('nombreColaborador');
    const query = input.value.trim();

    // Si hay un colaborador seleccionado, no buscar
    if (colaboradorSeleccionado) {
        return;
    }

    if (query.length < 2) {
        ocultarResultadosNombres();
        return;
    }

    try {
        const connection = await connectionString();

        // Búsqueda optimizada en la BD con LIKE
        const queryBD = `
            SELECT
                personal.IdPersonal,
                CONCAT(
                    personal.PrimerNombre, ' ',
                    IFNULL(personal.SegundoNombre, ''), ' ',
                    IFNULL(personal.TercerNombre, ''), ' ',
                    personal.PrimerApellido, ' ',
                    IFNULL(personal.SegundoApellido, '')
                ) AS NombreCompleto
            FROM personal
            WHERE
                CONCAT(
                    personal.PrimerNombre, ' ',
                    IFNULL(personal.SegundoNombre, ''), ' ',
                    IFNULL(personal.TercerNombre, ''), ' ',
                    personal.PrimerApellido, ' ',
                    IFNULL(personal.SegundoApellido, '')
                ) LIKE ?
            ORDER BY personal.PrimerNombre, personal.PrimerApellido
            LIMIT 50
        `;

        const resultados = await connection.query(queryBD, [`%${query}%`]);
        await connection.close();

        mostrarResultadosNombres(resultados);

    } catch (error) {
        console.error('Error al buscar nombres:', error);
        ocultarResultadosNombres();
    }
}

function mostrarResultadosNombres(resultados) {
    const container = document.getElementById('nombreResults');
    container.innerHTML = '';

    if (resultados.length === 0) {
        container.innerHTML = '<div class="autocomplete-item" style="color: #999; cursor: default;">No se encontraron colaboradores</div>';
        container.classList.add('show');
        return;
    }

    resultados.forEach(colaborador => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `
            <span style="font-weight: 500;">${colaborador.NombreCompleto.trim()}</span>
            <span style="font-size: 0.75rem; color: #999; margin-left: 8px;">ID: ${colaborador.IdPersonal}</span>
        `;
        item.dataset.id = colaborador.IdPersonal;
        item.dataset.nombre = colaborador.NombreCompleto.trim();

        item.addEventListener('click', () => {
            seleccionarColaborador(colaborador);
        });

        container.appendChild(item);
    });

    container.classList.add('show');
}

function ocultarResultadosNombres() {
    const container = document.getElementById('nombreResults');
    container.classList.remove('show');
}

function seleccionarColaborador(colaborador) {
    colaboradorSeleccionado = colaborador;

    // Mostrar tag
    const tag = document.getElementById('nombreTag');
    tag.querySelector('.tag-text').textContent = colaborador.NombreCompleto.trim();
    tag.style.display = 'inline-flex';

    // Limpiar y deshabilitar input
    const input = document.getElementById('nombreColaborador');
    input.value = '';
    input.disabled = true;
    input.style.display = 'none';

    ocultarResultadosNombres();

    // Ejecutar búsqueda automáticamente
    buscarPersonal();
}

function removerColaboradorSeleccionado() {
    colaboradorSeleccionado = null;

    // Ocultar tag
    const tag = document.getElementById('nombreTag');
    tag.style.display = 'none';

    // Habilitar input
    const input = document.getElementById('nombreColaborador');
    input.disabled = false;
    input.style.display = 'block';
    input.focus();
}

// ==================== AUTOCOMPLETADO DEPARTAMENTOS ==================== 
function buscarDepartamentos() {
    const input = document.getElementById('departamento');
    const query = input.value.trim().toLowerCase();
    
    if (!query) {
        ocultarResultadosDepartamentos();
        return;
    }

    // Búsqueda inteligente - permite abreviaturas y espacios
    const resultados = departamentos.filter(dept => {
        const nombre = dept.NombreDepartamento.toLowerCase();
        
        // Búsqueda exacta
        if (nombre.includes(query)) return true;
        
        // Búsqueda sin espacios
        const nombreSinEspacios = nombre.replace(/\s+/g, '');
        const querySinEspacios = query.replace(/\s+/g, '');
        if (nombreSinEspacios.includes(querySinEspacios)) return true;
        
        // Búsqueda por iniciales
        const iniciales = nombre.split(' ').map(palabra => palabra[0]).join('');
        if (iniciales.includes(query)) return true;
        
        return false;
    });

    mostrarResultadosDepartamentos(resultados);
}

function mostrarResultadosDepartamentos(resultados) {
    const container = document.getElementById('departamentoResults');
    container.innerHTML = '';

    if (resultados.length === 0) {
        container.innerHTML = '<div class="autocomplete-item" style="color: #999; cursor: default;">No se encontraron departamentos</div>';
        container.classList.add('show');
        return;
    }

    resultados.forEach(dept => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = dept.NombreDepartamento;
        item.dataset.id = dept.IdDepartamento;
        
        item.addEventListener('click', () => {
            seleccionarDepartamento(dept);
        });
        
        container.appendChild(item);
    });

    container.classList.add('show');
}

function ocultarResultadosDepartamentos() {
    const container = document.getElementById('departamentoResults');
    container.classList.remove('show');
}

function seleccionarDepartamento(dept) {
    departamentoSeleccionado = dept;
    
    // Mostrar tag
    const tag = document.getElementById('departamentoTag');
    tag.querySelector('.tag-text').textContent = dept.NombreDepartamento;
    tag.style.display = 'inline-flex';
    
    // Limpiar y deshabilitar input
    const input = document.getElementById('departamento');
    input.value = '';
    input.disabled = true;
    input.style.display = 'none';
    
    ocultarResultadosDepartamentos();
}

function removerDepartamentoSeleccionado() {
    departamentoSeleccionado = null;
    
    // Ocultar tag
    const tag = document.getElementById('departamentoTag');
    tag.style.display = 'none';
    
    // Habilitar input
    const input = document.getElementById('departamento');
    input.disabled = false;
    input.style.display = 'block';
    input.focus();
}

// ==================== BUSCAR PERSONAL ====================
async function buscarPersonal() {
    try {
        mostrarLoader(true);

        const nombreColaborador = document.getElementById('nombreColaborador').value.trim();
        const tipoPersonal = document.getElementById('tipoPersonal').value;
        const estadoPersonal = document.getElementById('estadoPersonal').value;
        const conFoto = document.getElementById('conFoto').checked;

        // Mostrar advertencia si seleccionó "Con foto"
        if (conFoto) {
            const confirmar = await Swal.fire({
                icon: 'warning',
                title: '¿Cargar con fotos?',
                html: '<p>Cargar las fotos puede tardar <b>varios minutos</b> dependiendo de la cantidad de registros.</p><p>¿Deseas continuar?</p>',
                showCancelButton: true,
                confirmButtonColor: '#FF9800',
                cancelButtonColor: '#999',
                confirmButtonText: 'Sí, continuar',
                cancelButtonText: 'Cancelar'
            });

            if (!confirmar.isConfirmed) {
                mostrarLoader(false);
                return;
            }
        }

        // Construir query con filtros opcionales - FOTO CONDICIONAL
        let query = `
            SELECT
                personal.IdPersonal,
                CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) AS NombreCompleto,
                personal.FechaNacimiento,
                personal.Telefono1,
                departamentos.NombreDepartamento,
                Puestos.Nombre AS NombrePuesto,
                personal.InicioLaboral,
                EstadoPersonal.EstadoPersonal,
                TipoPersonal.TipoPersonal,
                ${conFoto ? `CASE
                    WHEN FotosPersonal.Foto IS NOT NULL THEN CONCAT('data:image/jpeg;base64,', TO_BASE64(FotosPersonal.Foto))
                    ELSE NULL
                END` : 'NULL'} AS FotoBase64,
                CONCAT(usuario.PrimerNombre, ' ', IFNULL(usuario.SegundoNombre, ''), ' ', IFNULL(usuario.TercerNombre, ''), ' ', usuario.PrimerApellido, ' ', IFNULL(usuario.SegundoApellido, '')) AS UsuarioRegistro,
                personal.Fechahoraregistro
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
                EstadoPersonal
                ON
                    personal.Estado = EstadoPersonal.IdEstado
                INNER JOIN
                TipoPersonal
                ON
                    personal.TipoPersonal = TipoPersonal.IdTipo
                ${conFoto ? `LEFT JOIN
                FotosPersonal
                ON
                    personal.IdPersonal = FotosPersonal.IdPersonal` : ''}
                LEFT JOIN
                personal AS usuario
                ON
                    personal.IdUsuario = usuario.IdPersonal
            WHERE 1=1
        `;

        const params = [];

        // Filtro por colaborador seleccionado (prioridad máxima)
        if (colaboradorSeleccionado) {
            query += ' AND personal.IdPersonal = ?';
            params.push(colaboradorSeleccionado.IdPersonal);
        }
        // Filtro por nombre si está escribiendo (sin seleccionar)
        else if (nombreColaborador && nombreColaborador.length >= 2) {
            query += ` AND CONCAT(personal.PrimerNombre, ' ', IFNULL(personal.SegundoNombre, ''), ' ', IFNULL(personal.TercerNombre, ''), ' ', personal.PrimerApellido, ' ', IFNULL(personal.SegundoApellido, '')) LIKE ?`;
            params.push(`%${nombreColaborador}%`);
        }

        // Filtro departamento (solo si se seleccionó uno)
        if (departamentoSeleccionado) {
            query += ' AND departamentos.IdDepartamento = ?';
            params.push(departamentoSeleccionado.IdDepartamento);
        }

        // Filtro tipo personal
        if (tipoPersonal) {
            query += ' AND TipoPersonal.IdTipo = ?';
            params.push(tipoPersonal);
        }

        // Filtro estado personal
        if (estadoPersonal) {
            query += ' AND EstadoPersonal.IdEstado = ?';
            params.push(estadoPersonal);
        }

        query += ' ORDER BY personal.PrimerNombre, personal.PrimerApellido LIMIT 5000';

        const connection = await connectionString();
        const resultados = await connection.query(query, params);
        await connection.close();

        todosLosResultados = resultados;
        mostrarResultados(resultados);
        mostrarLoader(false);

    } catch (error) {
        console.error('Error al buscar personal:', error);
        mostrarLoader(false);
        await Swal.fire({
            icon: 'error',
            title: 'Error en la búsqueda',
            text: 'Hubo un problema al buscar el personal. Intenta nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// ==================== MOSTRAR RESULTADOS ====================
function mostrarResultados(resultados) {
    const tbody = document.getElementById('tbodyPersonal');
    const noResults = document.getElementById('noResults');
    const totalResultados = document.getElementById('totalResultados');
    const tabla = document.getElementById('tablaPersonal');

    tbody.innerHTML = '';
    totalResultados.textContent = resultados.length;

    if (resultados.length === 0) {
        noResults.innerHTML = `
            <i class="fas fa-search"></i>
            <h3>No se encontraron resultados</h3>
            <p>Intenta ajustar los filtros de búsqueda</p>
        `;
        noResults.style.display = 'flex';
        tabla.style.display = 'none';
        return;
    }

    noResults.style.display = 'none';
    tabla.style.display = 'table';

    resultados.forEach(persona => {
        const tr = document.createElement('tr');

        // Formatear fechas (corregir el problema de zona horaria)
        const inicioLaboral = persona.InicioLaboral ?
            formatearFecha(persona.InicioLaboral) : 'N/A';

        // Calcular tiempo laborado
        const tiempoLaborado = persona.InicioLaboral ?
            calcularTiempoLaborado(persona.InicioLaboral) : 'N/A';

        // Determinar clase de badge para estado
        const estadoClass = persona.EstadoPersonal.toLowerCase().includes('activo') ?
            'badge-activo' : 'badge-inactivo';

        // Determinar clase de badge para tipo
        const tipoClass = persona.TipoPersonal.toLowerCase().includes('planilla') ?
            'badge-planilla' : 'badge-jornal';

        // Foto del colaborador
        const fotoSrc = persona.FotoBase64 || '../Imagenes/user-default.png';

        tr.innerHTML = `
            <td>${persona.IdPersonal}</td>
            <td>
                <div class="employee-cell">
                    <img src="${fotoSrc}" alt="${persona.NombreCompleto}" class="employee-photo" data-foto-id="${persona.IdPersonal}">
                    <span>${persona.NombreCompleto}</span>
                </div>
            </td>
            <td>${persona.NombreDepartamento}</td>
            <td>${persona.NombrePuesto}</td>
            <td>${inicioLaboral}</td>
            <td>${tiempoLaborado}</td>
            <td><span class="badge ${estadoClass}">${persona.EstadoPersonal}</span></td>
            <td><span class="badge ${tipoClass}">${persona.TipoPersonal}</span></td>
            <td>
                <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn-action btn-edit" onclick="editarColaborador(${persona.IdPersonal})" title="Editar Colaborador">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-personal" onclick="verInfoPersonal(${persona.IdPersonal})" title="Información Personal">
                        <i class="fas fa-user"></i>
                    </button>
                    <button class="btn-action btn-laboral" onclick="verInfoLaboral(${persona.IdPersonal})" title="Información Laboral">
                        <i class="fas fa-briefcase"></i>
                    </button>
                    <button class="btn-action btn-academica" onclick="verInfoAcademica(${persona.IdPersonal})" title="Información Académica">
                        <i class="fas fa-graduation-cap"></i>
                    </button>
                    <button class="btn-action btn-documentacion" onclick="verInfoDocumentacion(${persona.IdPersonal})" title="Documentación">
                        <i class="fas fa-file-alt"></i>
                    </button>
                    <button class="btn-action btn-pma" onclick="verInfoPMA(${persona.IdPersonal})" title="Información PMA">
                        <i class="fas fa-chart-line"></i>
                    </button>
                </div>
            </td>
        `;

        // Agregar evento click a la foto usando addEventListener
        const img = tr.querySelector('.employee-photo');
        img.addEventListener('click', () => {
            mostrarFotoAmpliada(fotoSrc, persona.NombreCompleto);
        });

        tbody.appendChild(tr);
    });
}

// ==================== LIMPIAR FILTROS ====================
function limpiarFiltros() {
    // Limpiar nombre
    removerColaboradorSeleccionado();
    document.getElementById('nombreColaborador').value = '';

    // Limpiar departamento
    removerDepartamentoSeleccionado();
    document.getElementById('departamento').value = '';

    // Limpiar selects
    document.getElementById('tipoPersonal').value = '';
    document.getElementById('estadoPersonal').value = '';

    // Limpiar resultados
    todosLosResultados = [];
    document.getElementById('tbodyPersonal').innerHTML = '';
    document.getElementById('tablaPersonal').style.display = 'none';

    // Limpiar estado guardado en localStorage
    localStorage.removeItem('busquedaPersonalEstado');

    // Mostrar mensaje inicial
    mostrarMensajeInicial();
}

// ==================== INFORMACIÓN PERSONAL ====================
// ==================== EDITAR COLABORADOR ====================
async function editarColaborador(idPersonal) {
    try {
        // Obtener datos del usuario actual de localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));

        if (!userData || !userData.IdPersonal) {
            await Swal.fire({
                icon: 'error',
                title: 'Error de sesión',
                text: 'No se encontraron datos de sesión. Por favor inicie sesión nuevamente.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }

        // Verificar autorización del usuario
        const connection = await connectionString();
        const queryAutorizacion = `
            SELECT TransaccionesRRHH.Codigo
            FROM TransaccionesRRHH
            WHERE TransaccionesRRHH.Activo = 1
            AND TransaccionesRRHH.IdPersonal = ?
            AND TransaccionesRRHH.Codigo = 103
        `;

        const autorizacion = await connection.query(queryAutorizacion, [userData.IdPersonal]);
        await connection.close();

        // Verificar si el usuario tiene el código 103 activo
        if (!autorizacion || autorizacion.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Acceso Denegado',
                text: 'No tienes autorización para editar colaboradores. Contacta al administrador.',
                confirmButtonColor: '#FF9800'
            });
            return;
        }

        // Si está autorizado, guardar el estado de la búsqueda actual
        guardarEstadoBusqueda();

        // Navegar a la ventana de edición con el ID del colaborador
        window.location.href = `Editar.html?id=${idPersonal}`;

    } catch (error) {
        console.error('Error al verificar autorización:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al verificar los permisos. Por favor intenta nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

async function verInfoPersonal(idPersonal) {
    try {
        const persona = todosLosResultados.find(p => p.IdPersonal === idPersonal);

        if (!persona) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se encontró la información del colaborador',
                confirmButtonColor: '#2196F3'
            });
            return;
        }

        // Obtener información personal detallada de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT
                personal.DPI,
                departamentosguatemala.NombreDepartamento,
                municipios.NombreMunicipio,
                estadocivil.EstadoCivil,
                TipoSangre.TipoSangre,
                personal.Hijos,
                personal.Sexo,
                personal.DireccionRecidencia,
                personal.Telefono1,
                personal.Telefono2,
                personal.NombreContactoEmergencia,
                personal.TelefonoContactoEmergencia,
                parentesco.Parentesco
            FROM
                personal
                INNER JOIN
                departamentosguatemala
                ON
                    personal.IdDepartamentoOrigen = departamentosguatemala.IdDepartamentoG
                INNER JOIN
                municipios
                ON
                    personal.IdMunicipioOrigen = municipios.IdMunicipio
                INNER JOIN
                estadocivil
                ON
                    personal.IdEstadoCivil = estadocivil.IdCivil
                INNER JOIN
                TipoSangre
                ON
                    personal.IdTipoSangre = TipoSangre.IdSangre
                INNER JOIN
                parentesco
                ON
                    personal.IdParentesco = parentesco.IdParentesco
            WHERE personal.IdPersonal = ?
        `;

        const resultados = await connection.query(query, [idPersonal]);
        await connection.close();

        if (resultados.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Sin datos',
                text: 'No se encontró información personal para este colaborador',
                confirmButtonColor: '#2196F3'
            });
            return;
        }

        const infoPer = resultados[0];
        const fotoBase64 = persona.FotoBase64 || '../Imagenes/user-default.png';
        const fechaNacimiento = persona.FechaNacimiento ?
            new Date(persona.FechaNacimiento + 'T00:00:00').toLocaleDateString('es-GT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'N/A';
        const edad = persona.FechaNacimiento ? calcularEdad(persona.FechaNacimiento) : null;

        await Swal.fire({
            title: '<i class="fas fa-user"></i> Información Personal',
            html: `
                <div style="text-align: center;">
                    <div id="fotoPersonalContainer" style="width: 120px; height: 120px; border-radius: 50%; overflow: hidden; margin: 0 auto 20px; border: 4px solid #2196F3; box-shadow: 0 4px 10px rgba(0,0,0,0.2); cursor: pointer;">
                        <img src="${fotoBase64}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>

                    <h3 style="color: #2196F3; margin-bottom: 20px; font-size: 1.3rem;">${persona.NombreCompleto}</h3>

                    <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; text-align: left; max-height: 400px; overflow-y: auto;">
                        <!-- Información Básica -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-id-card"></i> DPI</p>
                                <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoPer.DPI || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-venus-mars"></i> Sexo</p>
                                <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoPer.Sexo || 'N/A'}</p>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-birthday-cake"></i> Fecha de Nacimiento</p>
                                <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${fechaNacimiento}${edad ? ` <span style="color: #2196F3;">(${edad} años)</span>` : ''}</p>
                            </div>
                            <div>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-tint"></i> Tipo de Sangre</p>
                                <p style="margin: 5px 0 0 0; font-weight: 600; color: #d32f2f;">${infoPer.TipoSangre || 'N/A'}</p>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-heart"></i> Estado Civil</p>
                                <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoPer.EstadoCivil || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-baby"></i> Hijos</p>
                                <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoPer.Hijos !== null ? infoPer.Hijos : 'N/A'}</p>
                            </div>
                        </div>

                        <!-- Origen -->
                        <div style="margin-bottom: 15px;">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-map-marker-alt"></i> Lugar de Origen</p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoPer.NombreMunicipio}, ${infoPer.NombreDepartamento}</p>
                        </div>

                        <!-- Dirección -->
                        <div style="margin-bottom: 15px;">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-home"></i> Dirección de Residencia</p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoPer.DireccionRecidencia || 'N/A'}</p>
                        </div>

                        <!-- Teléfonos -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-phone"></i> Teléfono 1</p>
                                <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoPer.Telefono1 || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-phone-alt"></i> Teléfono 2</p>
                                <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoPer.Telefono2 || 'N/A'}</p>
                            </div>
                        </div>

                        <!-- Contacto de Emergencia -->
                        <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; border-left: 3px solid #2196F3; margin-top: 15px;">
                            <p style="margin: 0 0 10px 0; color: #1976D2; font-size: 0.9rem; font-weight: 600;">
                                <i class="fas fa-ambulance"></i> Contacto de Emergencia
                            </p>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <p style="margin: 0; color: #555; font-size: 0.8rem;">Nombre</p>
                                    <p style="margin: 3px 0 0 0; font-weight: 600; color: #333; font-size: 0.85rem;">${infoPer.NombreContactoEmergencia || 'N/A'}</p>
                                </div>
                                <div>
                                    <p style="margin: 0; color: #555; font-size: 0.8rem;">Parentesco</p>
                                    <p style="margin: 3px 0 0 0; font-weight: 600; color: #333; font-size: 0.85rem;">${infoPer.Parentesco || 'N/A'}</p>
                                </div>
                            </div>
                            <div style="margin-top: 8px;">
                                <p style="margin: 0; color: #555; font-size: 0.8rem;">Teléfono</p>
                                <p style="margin: 3px 0 0 0; font-weight: 600; color: #d32f2f; font-size: 0.9rem;">${infoPer.TelefonoContactoEmergencia || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            width: '650px',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#2196F3',
            didOpen: () => {
                const fotoContainer = document.getElementById('fotoPersonalContainer');
                if (fotoContainer) {
                    fotoContainer.addEventListener('click', () => {
                        mostrarFotoAmpliada(fotoBase64, persona.NombreCompleto);
                    });
                }
            }
        });

    } catch (error) {
        console.error('Error al ver información personal:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información personal',
            confirmButtonColor: '#2196F3'
        });
    }
}

// ==================== INFORMACIÓN LABORAL ====================
async function verInfoLaboral(idPersonal) {
    try {
        const persona = todosLosResultados.find(p => p.IdPersonal === idPersonal);

        if (!persona) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se encontró la información del colaborador',
                confirmButtonColor: '#FF9800'
            });
            return;
        }

        // Obtener información laboral detallada de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT
                departamentos.NombreDepartamento,
                Regiones.NombreRegion,
                Puestos.Nombre AS NombrePuesto,
                personal.InicioLaboral,
                TipoPersonal.TipoPersonal,
                personal.FechaContrato,
                planillas.Nombre_Planilla,
                personal.FechaPlanilla,
                personal.Fechahoraregistro,
                CONCAT(usuario.PrimerNombre, ' ', IFNULL(usuario.SegundoNombre, ''), ' ', IFNULL(usuario.TercerNombre, ''), ' ', usuario.PrimerApellido, ' ', IFNULL(usuario.SegundoApellido, '')) AS UsuarioRegistro
            FROM
                personal
                INNER JOIN
                departamentos
                ON
                    personal.IdSucuDepa = departamentos.IdDepartamento
                INNER JOIN
                Regiones
                ON
                    departamentos.IdRegion = Regiones.IdRegion
                INNER JOIN
                Puestos
                ON
                    personal.IdPuesto = Puestos.IdPuesto
                INNER JOIN
                TipoPersonal
                ON
                    personal.TipoPersonal = TipoPersonal.IdTipo
                LEFT JOIN
                planillas
                ON
                    personal.IdPlanilla = planillas.IdPlanilla
                LEFT JOIN
                personal AS usuario
                ON
                    personal.IdUsuario = usuario.IdPersonal
            WHERE personal.IdPersonal = ?
        `;

        const resultados = await connection.query(query, [idPersonal]);
        await connection.close();

        if (resultados.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Sin datos',
                text: 'No se encontró información laboral para este colaborador',
                confirmButtonColor: '#FF9800'
            });
            return;
        }

        const infoLab = resultados[0];

        // Formatear fechas
        const inicioLaboral = infoLab.InicioLaboral ?
            new Date(infoLab.InicioLaboral + 'T00:00:00').toLocaleDateString('es-GT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'N/A';

        const tiempoLaborado = infoLab.InicioLaboral ?
            calcularTiempoLaborado(infoLab.InicioLaboral) : 'N/A';

        const fechaContrato = infoLab.FechaContrato ?
            new Date(infoLab.FechaContrato + 'T00:00:00').toLocaleDateString('es-GT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'N/A';

        const fechaPlanilla = infoLab.FechaPlanilla ?
            new Date(infoLab.FechaPlanilla + 'T00:00:00').toLocaleDateString('es-GT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'N/A';

        // Formatear fecha y hora de registro
        const fechaHoraRegistro = infoLab.Fechahoraregistro ?
            formatearFechaHora(infoLab.Fechahoraregistro) : 'N/A';

        // Usuario que registró (puede ser null si no existe)
        const usuarioRegistro = infoLab.UsuarioRegistro ?
            infoLab.UsuarioRegistro.trim() : 'N/A';

        await Swal.fire({
            title: '<i class="fas fa-briefcase"></i> Información Laboral',
            html: `
                <div style="text-align: center;">
                    <h3 style="color: #FF9800; margin-bottom: 20px; font-size: 1.3rem;">${persona.NombreCompleto}</h3>

                    <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; text-align: left; max-height: 400px; overflow-y: auto;">
                        <!-- Ubicación Laboral -->
                        <div style="margin-bottom: 15px;">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-building"></i> Departamento</p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoLab.NombreDepartamento}</p>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-map-marked-alt"></i> Región</p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoLab.NombreRegion}</p>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-user-tie"></i> Puesto</p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${infoLab.NombrePuesto}</p>
                        </div>

                        <!-- Tipo de Personal -->
                        <div style="margin-bottom: 15px;">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-id-badge"></i> Tipo de Personal</p>
                            <p style="margin: 5px 0 0 0;">
                                <span style="background: ${infoLab.TipoPersonal.toLowerCase().includes('planilla') ? '#e3f2fd' : '#fff3e0'};
                                             color: ${infoLab.TipoPersonal.toLowerCase().includes('planilla') ? '#2196F3' : '#FF9800'};
                                             padding: 5px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
                                    ${infoLab.TipoPersonal}
                                </span>
                            </p>
                        </div>

                        <!-- Fechas Importantes -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-calendar-check"></i> Inicio Laboral</p>
                                <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${inicioLaboral}</p>
                            </div>
                            <div>
                                <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-clock"></i> Tiempo Laborado</p>
                                <p style="margin: 5px 0 0 0; font-weight: 600; color: #4CAF50;">${tiempoLaborado}</p>
                            </div>
                        </div>

                        ${infoLab.FechaContrato ? `
                        <div style="margin-bottom: 15px;">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-file-signature"></i> Fecha de Contrato</p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #333;">${fechaContrato}</p>
                        </div>
                        ` : ''}

                        <!-- Información de Planilla (si aplica) -->
                        ${infoLab.Nombre_Planilla ? `
                        <div style="background: #fff3e0; padding: 12px; border-radius: 8px; border-left: 3px solid #FF9800; margin-top: 15px;">
                            <p style="margin: 0 0 10px 0; color: #E65100; font-size: 0.9rem; font-weight: 600;">
                                <i class="fas fa-file-invoice-dollar"></i> Información de Planilla
                            </p>
                            <div style="margin-bottom: 8px;">
                                <p style="margin: 0; color: #555; font-size: 0.8rem;">Nombre de Planilla</p>
                                <p style="margin: 3px 0 0 0; font-weight: 600; color: #333; font-size: 0.85rem;">${infoLab.Nombre_Planilla}</p>
                            </div>
                            ${infoLab.FechaPlanilla ? `
                            <div>
                                <p style="margin: 0; color: #555; font-size: 0.8rem;">Fecha en Planilla</p>
                                <p style="margin: 3px 0 0 0; font-weight: 600; color: #333; font-size: 0.85rem;">${fechaPlanilla}</p>
                            </div>
                            ` : ''}
                        </div>
                        ` : `
                        <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; border-left: 3px solid #999; margin-top: 15px;">
                            <p style="margin: 0; color: #666; font-size: 0.85rem; text-align: center;">
                                <i class="fas fa-info-circle"></i> No asignado a planilla fija
                            </p>
                        </div>
                        `}

                        <!-- Estado -->
                        <div style="margin-top: 15px;">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;"><i class="fas fa-toggle-on"></i> Estado Actual</p>
                            <p style="margin: 5px 0 0 0;">
                                <span style="background: ${persona.EstadoPersonal.toLowerCase().includes('activo') ? '#e8f5e9' : '#ffebee'};
                                             color: ${persona.EstadoPersonal.toLowerCase().includes('activo') ? '#4CAF50' : '#f44336'};
                                             padding: 5px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
                                    ${persona.EstadoPersonal}
                                </span>
                            </p>
                        </div>

                        <!-- Información de Registro -->
                        <div style="background: #e8f5e9; padding: 12px; border-radius: 8px; border-left: 3px solid #4CAF50; margin-top: 15px;">
                            <p style="margin: 0 0 10px 0; color: #2E7D32; font-size: 0.9rem; font-weight: 600;">
                                <i class="fas fa-user-check"></i> Información de Registro
                            </p>
                            <div style="margin-bottom: 8px;">
                                <p style="margin: 0; color: #555; font-size: 0.8rem;">Registrado por</p>
                                <p style="margin: 3px 0 0 0; font-weight: 600; color: #333; font-size: 0.85rem;">${usuarioRegistro}</p>
                            </div>
                            <div>
                                <p style="margin: 0; color: #555; font-size: 0.8rem;">Fecha y Hora de Registro</p>
                                <p style="margin: 3px 0 0 0; font-weight: 600; color: #333; font-size: 0.85rem;">${fechaHoraRegistro}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            width: '600px',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#FF9800'
        });

    } catch (error) {
        console.error('Error al ver información laboral:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información laboral',
            confirmButtonColor: '#FF9800'
        });
    }
}

// ==================== INFORMACIÓN ACADÉMICA ====================
async function verInfoAcademica(idPersonal) {
    try {
        const persona = todosLosResultados.find(p => p.IdPersonal === idPersonal);

        if (!persona) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se encontró la información del colaborador',
                confirmButtonColor: '#9C27B0'
            });
            return;
        }

        // Obtener información académica detallada de la base de datos
        const connection = await connectionString();
        const query = `
            (
                -- ===== PRIMARIA =====
                SELECT
                    'Primaria' AS Nivel,
                    EstadosEducacion.DescripcionEstado AS Estado,
                    GradosAcademicos.GradoAcademico,
                    planestudios.Plan,
                    NULL AS Carrera,
                    NULL AS Universidad,
                    NULL AS Semestre,
                    NULL AS Maestria,
                    semestres.Semestre
                FROM InfoAcademica
                INNER JOIN EstadosEducacion
                    ON InfoAcademica.EstadoPrimaria = EstadosEducacion.IdEstadoEducacion
                LEFT JOIN GradosAcademicos
                    ON InfoAcademica.IdNivelAcademicoPrimaria = GradosAcademicos.IdGrado
                LEFT JOIN planestudios
                    ON InfoAcademica.IdPlanEstudioPrimaria = planestudios.IdPlanEstudio
                LEFT JOIN semestres
                    ON InfoAcademica.IdNivelAcademicoPrimaria = semestres.Id_semestre
                WHERE InfoAcademica.IdPersonal = ?
            )

            UNION ALL

            (
                -- ===== BÁSICO =====
                SELECT
                    'Básico' AS Nivel,
                    EstadosEducacion.DescripcionEstado AS Estado,
                    GradosAcademicos.GradoAcademico,
                    planestudios.Plan,
                    NULL AS Carrera,
                    NULL AS Universidad,
                    NULL AS Semestre,
                    NULL AS Maestria,
                    semestres.Semestre
                FROM InfoAcademica
                INNER JOIN EstadosEducacion
                    ON InfoAcademica.EstadoBasico = EstadosEducacion.IdEstadoEducacion
                LEFT JOIN GradosAcademicos
                    ON InfoAcademica.IdNivelAcademicoBasico = GradosAcademicos.IdGrado
                LEFT JOIN planestudios
                    ON InfoAcademica.IdPlanEstudioBasico = planestudios.IdPlanEstudio
                LEFT JOIN semestres
                    ON InfoAcademica.IdNivelAcademicoBasico = semestres.Id_semestre
                WHERE InfoAcademica.IdPersonal = ?
            )

            UNION ALL

            (
                -- ===== DIVERSIFICADO =====
                SELECT
                    'Diversificado' AS Nivel,
                    EstadosEducacion.DescripcionEstado AS Estado,
                    GradosAcademicos.GradoAcademico,
                    planestudios.Plan,
                    NULL AS Carrera,
                    NULL AS Universidad,
                    NULL AS Semestre,
                    NULL AS Maestria,
                    semestres.Semestre
                FROM InfoAcademica
                INNER JOIN EstadosEducacion
                    ON InfoAcademica.EstadoDiversificado = EstadosEducacion.IdEstadoEducacion
                LEFT JOIN GradosAcademicos
                    ON InfoAcademica.IdCarreraDiversificado = GradosAcademicos.IdGrado
                LEFT JOIN planestudios
                    ON InfoAcademica.IdPlanEstudioDiversificado = planestudios.IdPlanEstudio
                LEFT JOIN semestres
                    ON InfoAcademica.IdNivelAcademicoDiversificado = semestres.Id_semestre
                WHERE InfoAcademica.IdPersonal = ?
            )

            UNION ALL

            (
                -- ===== UNIVERSIDAD =====
                SELECT
                    'Universidad' AS Nivel,
                    EstadosEducacion.DescripcionEstado AS Estado,
                    NULL AS GradoAcademico,
                    planestudios.Plan,
                    CarrerasUniversitarias.NombreCarrera AS Carrera,
                    Universidades.NombreUniversidad AS Universidad,
                    NULL AS Semestre,
                    NULL AS Maestria,
                    semestres.Semestre
                FROM InfoAcademica
                INNER JOIN EstadosEducacion
                    ON InfoAcademica.EstadoUniversidad = EstadosEducacion.IdEstadoEducacion
                LEFT JOIN CarrerasUniversitarias
                    ON InfoAcademica.IdCarreraUniversitaria = CarrerasUniversitarias.IdCarreraUniversitaria
                LEFT JOIN planestudios
                    ON InfoAcademica.IdPlanEstudioUniversitario = planestudios.IdPlanEstudio
                LEFT JOIN Universidades
                    ON InfoAcademica.IdUniversidad = Universidades.IdUniversidad
                LEFT JOIN semestres
                    ON InfoAcademica.IdNivelAcademicoUnivesitario = semestres.Id_semestre
                WHERE InfoAcademica.IdPersonal = ?
            )

            UNION ALL

            (
                -- ===== MAESTRÍA =====
                SELECT
                    'Maestría' AS Nivel,
                    EstadosEducacion.DescripcionEstado AS Estado,
                    NULL AS GradoAcademico,
                    planestudios.Plan,
                    NULL AS Carrera,
                    Universidades.NombreUniversidad AS Universidad,
                    NULL AS Semestre,
                    Maestrias.NombreMaestria AS Maestria,
                    semestres.Semestre
                FROM InfoAcademica
                INNER JOIN EstadosEducacion
                    ON InfoAcademica.EstadoMaestria = EstadosEducacion.IdEstadoEducacion
                LEFT JOIN Maestrias
                    ON InfoAcademica.IdMaestria = Maestrias.IdMaestria
                LEFT JOIN Universidades
                    ON InfoAcademica.IdUniversidadMaestria = Universidades.IdUniversidad
                LEFT JOIN planestudios
                    ON InfoAcademica.IdPlanEstudio = planestudios.IdPlanEstudio
                LEFT JOIN semestres
                    ON InfoAcademica.IdNivelAcademicoMaestria = semestres.Id_semestre
                WHERE InfoAcademica.IdPersonal = ?
            )
        `;

        const resultados = await connection.query(query, [idPersonal, idPersonal, idPersonal, idPersonal, idPersonal]);
        await connection.close();

        if (resultados.length === 0) {
            await Swal.fire({
                icon: 'info',
                title: 'Sin información',
                text: 'No se encontró información académica registrada para este colaborador',
                confirmButtonColor: '#9C27B0'
            });
            return;
        }

        // Configuración de colores e iconos por nivel
        const config = {
            'Primaria': { icono: 'fas fa-child', color: '#e3f2fd', borde: '#2196F3' },
            'Básico': { icono: 'fas fa-book', color: '#f1f8e9', borde: '#8BC34A' },
            'Diversificado': { icono: 'fas fa-user-graduate', color: '#fff3e0', borde: '#FF9800' },
            'Universidad': { icono: 'fas fa-university', color: '#f3e5f5', borde: '#9C27B0' },
            'Maestría': { icono: 'fas fa-medal', color: '#fce4ec', borde: '#E91E63' }
        };

        // Procesar cada nivel educativo
        let educacionBasica = '';
        let educacionSuperior = '';

        resultados.forEach(nivel => {
            const cfg = config[nivel.Nivel];
            if (!cfg) return;

            let html = `
                <div style="background: ${cfg.color}; padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid ${cfg.borde};">
                    <p style="margin: 0 0 8px 0; color: #555; font-size: 0.95rem; font-weight: 600;">
                        <i class="${cfg.icono}"></i> ${nivel.Nivel}
                    </p>
            `;

            // Mostrar GradoAcademico primero (especialmente para Diversificado)
            if (nivel.GradoAcademico && (nivel.Nivel === 'Diversificado' || nivel.Nivel === 'Primaria' || nivel.Nivel === 'Básico')) {
                html += `
                    <div style="margin-bottom: 6px;">
                        <span style="background: ${cfg.borde}; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; color: #fff; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                            ${nivel.GradoAcademico}
                        </span>
                    </div>
                `;
            }

            // Estado (se muestra debajo del grado)
            if (nivel.Estado) {
                html += `
                    <div style="margin-bottom: 6px;">
                        <span style="background: #fff; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; color: #666; font-weight: 500; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            ${nivel.Estado}
                        </span>
                    </div>
                `;
            }

            // Universidad (solo para Universidad y Maestría)
            if (nivel.Universidad) {
                html += `<p style="margin: 4px 0; font-size: 0.8rem; color: #555;"><i class="fas fa-building" style="color: #999; font-size: 0.7rem; margin-right: 5px;"></i><strong>Universidad:</strong> ${nivel.Universidad}</p>`;
            }

            // Carrera (solo para Universidad)
            if (nivel.Carrera) {
                html += `<p style="margin: 4px 0; font-size: 0.8rem; color: #555;"><i class="fas fa-user-graduate" style="color: #999; font-size: 0.7rem; margin-right: 5px;"></i><strong>Carrera:</strong> ${nivel.Carrera}</p>`;
            }

            // Maestría (solo para Maestría)
            if (nivel.Maestria) {
                html += `<p style="margin: 4px 0; font-size: 0.8rem; color: #555;"><i class="fas fa-award" style="color: #999; font-size: 0.7rem; margin-right: 5px;"></i><strong>Maestría:</strong> ${nivel.Maestria}</p>`;
            }

            // Semestre/Trimestre/Grado para todos los niveles
            if (nivel.Semestre) {
                let label = 'Grado';
                if (nivel.Nivel === 'Maestría') {
                    label = 'Trimestre';
                } else if (nivel.Nivel === 'Universidad') {
                    label = 'Semestre';
                } else if (nivel.Nivel === 'Diversificado') {
                    label = 'Grado';
                } else if (nivel.Nivel === 'Básico') {
                    label = 'Grado';
                } else if (nivel.Nivel === 'Primaria') {
                    label = 'Grado';
                }
                html += `<p style="margin: 4px 0; font-size: 0.8rem; color: #555;"><i class="fas fa-graduation-cap" style="color: #999; font-size: 0.7rem; margin-right: 5px;"></i><strong>${label}:</strong> ${nivel.Semestre}</p>`;
            }

            // Plan
            if (nivel.Plan) {
                html += `<p style="margin: 4px 0; font-size: 0.8rem; color: #555;"><i class="fas fa-book-open" style="color: #999; font-size: 0.7rem; margin-right: 5px;"></i><strong>Plan:</strong> ${nivel.Plan}</p>`;
            }

            html += `</div>`;

            // Agrupar por tipo de educación
            if (nivel.Nivel === 'Primaria' || nivel.Nivel === 'Básico' || nivel.Nivel === 'Diversificado') {
                educacionBasica += html;
            } else {
                educacionSuperior += html;
            }
        });

        const hayInformacion = educacionBasica || educacionSuperior;

        await Swal.fire({
            title: '<i class="fas fa-graduation-cap"></i> Información Académica',
            html: `
                <div style="text-align: center;">
                    <h3 style="color: #9C27B0; margin-bottom: 20px; font-size: 1.3rem;">${persona.NombreCompleto}</h3>

                    <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; text-align: left; max-height: 450px; overflow-y: auto;">
                        ${hayInformacion ? `
                            ${educacionBasica ? `
                                <div style="margin-bottom: 20px;">
                                    <p style="margin: 0 0 12px 0; color: #9C27B0; font-weight: 600; font-size: 0.95rem; border-bottom: 2px solid #9C27B0; padding-bottom: 5px;">
                                        <i class="fas fa-school"></i> Educación Básica
                                    </p>
                                    ${educacionBasica}
                                </div>
                            ` : ''}

                            ${educacionSuperior ? `
                                <div>
                                    <p style="margin: 0 0 12px 0; color: #9C27B0; font-weight: 600; font-size: 0.95rem; border-bottom: 2px solid #9C27B0; padding-bottom: 5px;">
                                        <i class="fas fa-university"></i> Educación Superior
                                    </p>
                                    ${educacionSuperior}
                                </div>
                            ` : ''}
                        ` : `
                            <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; border-left: 3px solid #9C27B0; text-align: center;">
                                <i class="fas fa-info-circle" style="font-size: 2rem; color: #9C27B0; margin-bottom: 10px;"></i>
                                <p style="margin: 0; color: #666; font-size: 0.9rem;">
                                    No hay información académica registrada para este colaborador
                                </p>
                            </div>
                        `}
                    </div>
                </div>
            `,
            width: '650px',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#9C27B0'
        });

    } catch (error) {
        console.error('Error al ver información académica:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información académica',
            confirmButtonColor: '#9C27B0'
        });
    }
}

// ==================== INFORMACIÓN PMA ====================
async function verInfoPMA(idPersonal) {
    try {
        const persona = todosLosResultados.find(p => p.IdPersonal === idPersonal);

        if (!persona) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se encontró la información del colaborador',
                confirmButtonColor: '#4CAF50'
            });
            return;
        }

        // Obtener evaluaciones PMA de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT
                ResultadosPMA.FactorV,
                ResultadosPMA.FactorE,
                ResultadosPMA.FactorR,
                ResultadosPMA.FactorN,
                ResultadosPMA.FactorF,
                personal.PrimerNombre,
                personal.SegundoNombre,
                personal.TercerNombre,
                personal.PrimerApellido,
                personal.SegundoApellido,
                ResultadosPMA.FechaEvaluacion AS FechaHoraRegistro
            FROM
                ResultadosPMA
                INNER JOIN
                personal
                ON
                    ResultadosPMA.IdUsuarioEvaluo = personal.IdPersonal
            WHERE
                ResultadosPMA.IdPersonal = ?
            ORDER BY ResultadosPMA.FechaHoraRegistro DESC
        `;

        const resultados = await connection.query(query, [idPersonal]);
        await connection.close();

        // Construir HTML de evaluaciones
        let evaluacionesHTML = '';

        if (resultados.length === 0) {
            evaluacionesHTML = `
                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; border-left: 3px solid #4CAF50; text-align: center;">
                    <i class="fas fa-info-circle" style="font-size: 2rem; color: #4CAF50; margin-bottom: 10px;"></i>
                    <p style="margin: 0; color: #666; font-size: 0.9rem;">
                        No hay evaluaciones PMA registradas para este colaborador
                    </p>
                </div>
            `;
        } else {
            resultados.forEach((evaluacion, index) => {
                const nombreEvaluador = `${evaluacion.PrimerNombre} ${evaluacion.SegundoNombre || ''} ${evaluacion.TercerNombre || ''} ${evaluacion.PrimerApellido} ${evaluacion.SegundoApellido || ''}`.trim().replace(/\s+/g, ' ');

                const fecha = evaluacion.FechaHoraRegistro ?
                    formatearFecha(new Date(evaluacion.FechaHoraRegistro).toISOString().split('T')[0]) : 'N/A';

                evaluacionesHTML += `
                    <div style="background: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 2px solid #4CAF50; box-shadow: 0 2px 8px rgba(76, 175, 80, 0.15);">
                        <!-- Header de la evaluación -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e8f5e9;">
                            <div>
                                <p style="margin: 0; color: #4CAF50; font-weight: 700; font-size: 0.9rem;">
                                    <i class="fas fa-clipboard-check"></i> Evaluación #${resultados.length - index}
                                </p>
                                <p style="margin: 4px 0 0 0; color: #666; font-size: 0.75rem;">
                                    <i class="fas fa-calendar-alt"></i> ${fecha}
                                </p>
                            </div>
                            <div style="text-align: right;">
                                <p style="margin: 0; color: #777; font-size: 0.7rem;">Evaluado por:</p>
                                <p style="margin: 2px 0 0 0; color: #333; font-weight: 600; font-size: 0.8rem;">
                                    <i class="fas fa-user-tie"></i> ${nombreEvaluador}
                                </p>
                            </div>
                        </div>

                        <!-- Factores PMA -->
                        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
                            <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #2196F3;">
                                <p style="margin: 0; color: #1976D2; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Factor V</p>
                                <p style="margin: 5px 0 0 0; color: #0d47a1; font-size: 1.4rem; font-weight: 700;">${evaluacion.FactorV !== null ? evaluacion.FactorV : '-'}</p>
                            </div>
                            <div style="background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #9C27B0;">
                                <p style="margin: 0; color: #7B1FA2; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Factor E</p>
                                <p style="margin: 5px 0 0 0; color: #4a148c; font-size: 1.4rem; font-weight: 700;">${evaluacion.FactorE !== null ? evaluacion.FactorE : '-'}</p>
                            </div>
                            <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #FF9800;">
                                <p style="margin: 0; color: #F57C00; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Factor R</p>
                                <p style="margin: 5px 0 0 0; color: #e65100; font-size: 1.4rem; font-weight: 700;">${evaluacion.FactorR !== null ? evaluacion.FactorR : '-'}</p>
                            </div>
                            <div style="background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%); padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #E91E63;">
                                <p style="margin: 0; color: #C2185B; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Factor N</p>
                                <p style="margin: 5px 0 0 0; color: #880e4f; font-size: 1.4rem; font-weight: 700;">${evaluacion.FactorN !== null ? evaluacion.FactorN : '-'}</p>
                            </div>
                            <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #4CAF50;">
                                <p style="margin: 0; color: #388E3C; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Factor F</p>
                                <p style="margin: 5px 0 0 0; color: #1b5e20; font-size: 1.4rem; font-weight: 700;">${evaluacion.FactorF !== null ? evaluacion.FactorF : '-'}</p>
                            </div>
                        </div>

                        <!-- Promedio -->
                        ${(() => {
                            const suma = (evaluacion.FactorV || 0) + (evaluacion.FactorE || 0) + (evaluacion.FactorR || 0) + (evaluacion.FactorN || 0) + (evaluacion.FactorF || 0);
                            const promedio = (suma / 5).toFixed(2);
                            return `
                                <div style="background: linear-gradient(135deg, #fff9e6 0%, #ffecb3 100%); padding: 12px; border-radius: 8px; margin-top: 12px; border: 2px solid #FFC107; text-align: center;">
                                    <p style="margin: 0; color: #F57F17; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                        <i class="fas fa-calculator"></i> Promedio
                                    </p>
                                    <p style="margin: 5px 0 0 0; color: #E65100; font-size: 1.8rem; font-weight: 700;">${promedio}</p>
                                    <p style="margin: 3px 0 0 0; color: #666; font-size: 0.7rem;">(Suma: ${suma} / 100)</p>
                                </div>
                            `;
                        })()}
                    </div>
                `;
            });
        }

        await Swal.fire({
            title: '<i class="fas fa-chart-line"></i> Evaluaciones PMA',
            html: `
                <div style="text-align: center;">
                    <h3 style="color: #4CAF50; margin-bottom: 20px; font-size: 1.3rem;">${persona.NombreCompleto}</h3>

                    <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; text-align: left; max-height: 500px; overflow-y: auto;">
                        ${resultados.length > 0 ? `
                            <div style="margin-bottom: 15px; text-align: center;">
                                <p style="margin: 0; color: #4CAF50; font-weight: 600; font-size: 0.9rem;">
                                    <i class="fas fa-clipboard-list"></i> Total de evaluaciones: ${resultados.length}
                                </p>
                            </div>
                        ` : ''}
                        ${evaluacionesHTML}
                    </div>
                </div>
            `,
            width: '700px',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#4CAF50'
        });

    } catch (error) {
        console.error('Error al ver información PMA:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información PMA',
            confirmButtonColor: '#4CAF50'
        });
    }
}

// ==================== INFORMACIÓN DOCUMENTACIÓN ====================
async function verInfoDocumentacion(idPersonal) {
    try {
        const persona = todosLosResultados.find(p => p.IdPersonal === idPersonal);

        if (!persona) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se encontró la información del colaborador',
                confirmButtonColor: '#607D8B'
            });
            return;
        }

        // Obtener información de documentación de la base de datos
        const connection = await connectionString();
        const query = `
            SELECT
                tipolicencias.TipoLicencia,
                personal.NIT,
                personal.FechaVencimientoTS,
                personal.FechaVencimientoTM,
                personal.IGSS,
                personal.IRTRA
            FROM
                personal
                LEFT JOIN
                tipolicencias
                ON
                    personal.IdLicencia = tipolicencias.IdLicencia
            WHERE personal.IdPersonal = ?
        `;

        const resultados = await connection.query(query, [idPersonal]);
        await connection.close();

        if (resultados.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Sin datos',
                text: 'No se encontró información de documentación para este colaborador',
                confirmButtonColor: '#607D8B'
            });
            return;
        }

        const infoDoc = resultados[0];

        // Formatear fechas de vencimiento
        const fechaVencimientoTS = infoDoc.FechaVencimientoTS ?
            new Date(infoDoc.FechaVencimientoTS + 'T00:00:00').toLocaleDateString('es-GT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'N/A';

        const fechaVencimientoTM = infoDoc.FechaVencimientoTM ?
            new Date(infoDoc.FechaVencimientoTM + 'T00:00:00').toLocaleDateString('es-GT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'N/A';

        // Calcular si está vencido o próximo a vencer
        const calcularEstadoVencimiento = (fecha) => {
            if (!fecha || fecha === 'N/A') return { estado: 'sin-fecha', texto: 'Sin fecha', color: '#999', icon: 'fa-minus-circle' };

            const fechaVenc = new Date(fecha);
            const hoy = new Date();
            const diferenciaDias = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));

            if (diferenciaDias < 0) {
                return { estado: 'vencido', texto: 'VENCIDO', color: '#f44336', icon: 'fa-times-circle' };
            } else if (diferenciaDias <= 30) {
                return { estado: 'proximo', texto: `Vence en ${diferenciaDias} días`, color: '#FF9800', icon: 'fa-exclamation-triangle' };
            } else {
                return { estado: 'vigente', texto: 'Vigente', color: '#4CAF50', icon: 'fa-check-circle' };
            }
        };

        const estadoTS = calcularEstadoVencimiento(infoDoc.FechaVencimientoTS);
        const estadoTM = calcularEstadoVencimiento(infoDoc.FechaVencimientoTM);

        await Swal.fire({
            title: '<i class="fas fa-file-alt"></i> Documentación',
            html: `
                <div style="text-align: center;">
                    <h3 style="color: #607D8B; margin-bottom: 20px; font-size: 1.3rem;">${persona.NombreCompleto}</h3>

                    <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; text-align: left;">
                        <!-- Tipo de Licencia -->
                        <div style="background: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #607D8B; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;">
                                <i class="fas fa-id-card"></i> Tipo de Licencia
                            </p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #333; font-size: 1.1rem;">
                                ${infoDoc.TipoLicencia || 'N/A'}
                            </p>
                        </div>

                        <!-- NIT -->
                        <div style="background: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #2196F3; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;">
                                <i class="fas fa-file-invoice"></i> NIT
                            </p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #333; font-size: 1.1rem;">
                                ${infoDoc.NIT || 'N/A'}
                            </p>
                        </div>

                        <!-- IGSS -->
                        <div style="background: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #4CAF50; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;">
                                <i class="fas fa-hospital"></i> IGSS
                            </p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #333; font-size: 1.1rem;">
                                ${infoDoc.IGSS || 'N/A'}
                            </p>
                        </div>

                        <!-- IRTRA -->
                        <div style="background: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #9C27B0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <p style="margin: 0; color: #777; font-size: 0.85rem;">
                                <i class="fas fa-building"></i> IRTRA
                            </p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #333; font-size: 1.1rem;">
                                ${infoDoc.IRTRA || 'N/A'}
                            </p>
                        </div>

                        <!-- Tarjeta de Salud -->
                        <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 2px solid #2196F3; box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <p style="margin: 0; color: #1976D2; font-size: 0.9rem; font-weight: 600;">
                                    <i class="fas fa-notes-medical"></i> Tarjeta de Salud
                                </p>
                                <span style="background: ${estadoTS.color}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                                    <i class="fas ${estadoTS.icon}"></i> ${estadoTS.texto}
                                </span>
                            </div>
                            <p style="margin: 0; color: #555; font-size: 0.8rem;">Fecha de Vencimiento</p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #0d47a1; font-size: 1rem;">
                                ${fechaVencimientoTS}
                            </p>
                        </div>

                        <!-- Tarjeta de Manipulación -->
                        <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 15px; border-radius: 8px; border: 2px solid #FF9800; box-shadow: 0 2px 8px rgba(255, 152, 0, 0.2);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <p style="margin: 0; color: #F57C00; font-size: 0.9rem; font-weight: 600;">
                                    <i class="fas fa-hands-wash"></i> Tarjeta de Manipulación
                                </p>
                                <span style="background: ${estadoTM.color}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                                    <i class="fas ${estadoTM.icon}"></i> ${estadoTM.texto}
                                </span>
                            </div>
                            <p style="margin: 0; color: #555; font-size: 0.8rem;">Fecha de Vencimiento</p>
                            <p style="margin: 5px 0 0 0; font-weight: 600; color: #e65100; font-size: 1rem;">
                                ${fechaVencimientoTM}
                            </p>
                        </div>
                    </div>
                </div>
            `,
            width: '600px',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#607D8B'
        });

    } catch (error) {
        console.error('Error al ver información de documentación:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información de documentación',
            confirmButtonColor: '#607D8B'
        });
    }
}

// ==================== EXPORTAR A EXCEL ====================
async function exportarExcel() {
    if (todosLosResultados.length === 0) {
        await Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay datos para exportar',
            confirmButtonColor: '#FF9800'
        });
        return;
    }

    try {
        // Mostrar mensaje de progreso
        Swal.fire({
            title: 'Exportando...',
            html: 'Recopilando información de <b>0</b> de <b>' + todosLosResultados.length + '</b> colaboradores',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const XLSX = require('xlsx');
        const connection = await connectionString();

        // Arrays para almacenar datos de cada hoja
        const datosPersonal = [];
        const datosLaboral = [];
        const datosAcademica = [];
        const datosPMA = [];

        // Encabezados para cada hoja
        datosPersonal.push(['ID', 'Nombre Completo', 'DPI', 'Fecha Nacimiento', 'Edad', 'Sexo', 'Tipo Sangre', 'Estado Civil', 'Hijos', 'Lugar Origen', 'Dirección', 'Teléfono 1', 'Teléfono 2', 'Contacto Emergencia', 'Teléfono Emergencia', 'Parentesco']);
        datosLaboral.push(['ID', 'Nombre Completo', 'Departamento', 'Región', 'Puesto', 'Tipo Personal', 'Inicio Laboral', 'Tiempo Laborado', 'Fecha Contrato', 'Planilla', 'Fecha Planilla', 'Estado']);
        datosAcademica.push(['ID', 'Nombre Completo', 'Nivel', 'Estado', 'Grado/Semestre', 'Plan', 'Carrera', 'Universidad', 'Maestría']);
        datosPMA.push(['ID', 'Nombre Completo', 'Evaluación #', 'Fecha', 'Evaluado Por', 'Factor V', 'Factor E', 'Factor R', 'Factor N', 'Factor F', 'Suma Total', 'Promedio']);

        // Procesar cada colaborador
        for (let i = 0; i < todosLosResultados.length; i++) {
            const persona = todosLosResultados[i];

            // Actualizar progreso
            Swal.update({
                html: 'Recopilando información de <b>' + (i + 1) + '</b> de <b>' + todosLosResultados.length + '</b> colaboradores'
            });

            // ===== HOJA 1: INFORMACIÓN PERSONAL =====
            try {
                const queryPersonal = `
                    SELECT
                        personal.DPI,
                        departamentosguatemala.NombreDepartamento,
                        municipios.NombreMunicipio,
                        estadocivil.EstadoCivil,
                        TipoSangre.TipoSangre,
                        personal.Hijos,
                        personal.Sexo,
                        personal.DireccionRecidencia,
                        personal.Telefono1,
                        personal.Telefono2,
                        personal.NombreContactoEmergencia,
                        personal.TelefonoContactoEmergencia,
                        parentesco.Parentesco
                    FROM personal
                    INNER JOIN departamentosguatemala ON personal.IdDepartamentoOrigen = departamentosguatemala.IdDepartamentoG
                    INNER JOIN municipios ON personal.IdMunicipioOrigen = municipios.IdMunicipio
                    INNER JOIN estadocivil ON personal.IdEstadoCivil = estadocivil.IdCivil
                    INNER JOIN TipoSangre ON personal.IdTipoSangre = TipoSangre.IdSangre
                    INNER JOIN parentesco ON personal.IdParentesco = parentesco.IdParentesco
                    WHERE personal.IdPersonal = ?
                `;

                const infoPer = await connection.query(queryPersonal, [persona.IdPersonal]);

                if (infoPer.length > 0) {
                    const ip = infoPer[0];
                    const fechaNac = persona.FechaNacimiento ? formatearFecha(persona.FechaNacimiento) : 'N/A';
                    const edad = persona.FechaNacimiento ? calcularEdad(persona.FechaNacimiento) : 'N/A';
                    const lugarOrigen = (ip.NombreMunicipio || '') + ', ' + (ip.NombreDepartamento || '');

                    datosPersonal.push([
                        persona.IdPersonal,
                        persona.NombreCompleto,
                        ip.DPI || 'N/A',
                        fechaNac,
                        edad,
                        ip.Sexo || 'N/A',
                        ip.TipoSangre || 'N/A',
                        ip.EstadoCivil || 'N/A',
                        ip.Hijos !== null ? ip.Hijos : 'N/A',
                        lugarOrigen,
                        ip.DireccionRecidencia || 'N/A',
                        ip.Telefono1 || 'N/A',
                        ip.Telefono2 || 'N/A',
                        ip.NombreContactoEmergencia || 'N/A',
                        ip.TelefonoContactoEmergencia || 'N/A',
                        ip.Parentesco || 'N/A'
                    ]);
                }
            } catch (error) {
                console.error('Error al obtener info personal:', error);
            }

            // ===== HOJA 2: INFORMACIÓN LABORAL =====
            try {
                const queryLaboral = `
                    SELECT
                        departamentos.NombreDepartamento,
                        Regiones.NombreRegion,
                        Puestos.Nombre AS NombrePuesto,
                        personal.InicioLaboral,
                        TipoPersonal.TipoPersonal,
                        personal.FechaContrato,
                        planillas.Nombre_Planilla,
                        personal.FechaPlanilla
                    FROM personal
                    INNER JOIN departamentos ON personal.IdSucuDepa = departamentos.IdDepartamento
                    INNER JOIN Regiones ON departamentos.IdRegion = Regiones.IdRegion
                    INNER JOIN Puestos ON personal.IdPuesto = Puestos.IdPuesto
                    INNER JOIN TipoPersonal ON personal.TipoPersonal = TipoPersonal.IdTipo
                    LEFT JOIN planillas ON personal.IdPlanilla = planillas.IdPlanilla
                    WHERE personal.IdPersonal = ?
                `;

                const infoLab = await connection.query(queryLaboral, [persona.IdPersonal]);

                if (infoLab.length > 0) {
                    const il = infoLab[0];
                    const inicioLab = il.InicioLaboral ? formatearFecha(il.InicioLaboral) : 'N/A';
                    const tiempoLab = il.InicioLaboral ? calcularTiempoLaborado(il.InicioLaboral) : 'N/A';
                    const fechaCont = il.FechaContrato ? formatearFecha(il.FechaContrato) : 'N/A';
                    const fechaPlan = il.FechaPlanilla ? formatearFecha(il.FechaPlanilla) : 'N/A';

                    datosLaboral.push([
                        persona.IdPersonal,
                        persona.NombreCompleto,
                        il.NombreDepartamento || 'N/A',
                        il.NombreRegion || 'N/A',
                        il.NombrePuesto || 'N/A',
                        il.TipoPersonal || 'N/A',
                        inicioLab,
                        tiempoLab,
                        fechaCont,
                        il.Nombre_Planilla || 'No asignado',
                        fechaPlan,
                        persona.EstadoPersonal
                    ]);
                }
            } catch (error) {
                console.error('Error al obtener info laboral:', error);
            }

            // ===== INFORMACIÓN ACADÉMICA =====
            try {
                const queryAcademica = `
                    (
                        SELECT 'Primaria' AS Nivel, EstadosEducacion.DescripcionEstado AS Estado,
                            GradosAcademicos.GradoAcademico, planestudios.Plan,
                            NULL AS Carrera, NULL AS Universidad, NULL AS Semestre, NULL AS Maestria
                        FROM InfoAcademica
                        INNER JOIN EstadosEducacion ON InfoAcademica.EstadoPrimaria = EstadosEducacion.IdEstadoEducacion
                        LEFT JOIN GradosAcademicos ON InfoAcademica.IdNivelAcademicoPrimaria = GradosAcademicos.IdGrado
                        LEFT JOIN planestudios ON InfoAcademica.IdPlanEstudioPrimaria = planestudios.IdPlanEstudio
                        WHERE InfoAcademica.IdPersonal = ?
                    )
                    UNION ALL
                    (
                        SELECT 'Básico' AS Nivel, EstadosEducacion.DescripcionEstado AS Estado,
                            GradosAcademicos.GradoAcademico, planestudios.Plan,
                            NULL AS Carrera, NULL AS Universidad, NULL AS Semestre, NULL AS Maestria
                        FROM InfoAcademica
                        INNER JOIN EstadosEducacion ON InfoAcademica.EstadoBasico = EstadosEducacion.IdEstadoEducacion
                        LEFT JOIN GradosAcademicos ON InfoAcademica.IdNivelAcademicoBasico = GradosAcademicos.IdGrado
                        LEFT JOIN planestudios ON InfoAcademica.IdPlanEstudioBasico = planestudios.IdPlanEstudio
                        WHERE InfoAcademica.IdPersonal = ?
                    )
                    UNION ALL
                    (
                        SELECT 'Diversificado' AS Nivel, EstadosEducacion.DescripcionEstado AS Estado,
                            GradosAcademicos.GradoAcademico, planestudios.Plan,
                            NULL AS Carrera, NULL AS Universidad, NULL AS Semestre, NULL AS Maestria
                        FROM InfoAcademica
                        INNER JOIN EstadosEducacion ON InfoAcademica.EstadoDiversificado = EstadosEducacion.IdEstadoEducacion
                        LEFT JOIN GradosAcademicos ON InfoAcademica.IdCarreraDiversificado = GradosAcademicos.IdGrado
                        LEFT JOIN planestudios ON InfoAcademica.IdPlanEstudioDiversificado = planestudios.IdPlanEstudio
                        WHERE InfoAcademica.IdPersonal = ?
                    )
                    UNION ALL
                    (
                        SELECT 'Universidad' AS Nivel, EstadosEducacion.DescripcionEstado AS Estado,
                            semestres.Semestre AS GradoAcademico, planestudios.Plan,
                            CarrerasUniversitarias.NombreCarrera AS Carrera,
                            Universidades.NombreUniversidad AS Universidad,
                            semestres.Semestre, NULL AS Maestria
                        FROM InfoAcademica
                        INNER JOIN EstadosEducacion ON InfoAcademica.EstadoUniversidad = EstadosEducacion.IdEstadoEducacion
                        LEFT JOIN CarrerasUniversitarias ON InfoAcademica.IdCarreraUniversitaria = CarrerasUniversitarias.IdCarreraUniversitaria
                        LEFT JOIN planestudios ON InfoAcademica.IdPlanEstudioUniversitario = planestudios.IdPlanEstudio
                        LEFT JOIN Universidades ON InfoAcademica.IdUniversidad = Universidades.IdUniversidad
                        LEFT JOIN semestres ON InfoAcademica.IdNivelAcademicoUnivesitario = semestres.Id_semestre
                        WHERE InfoAcademica.IdPersonal = ?
                    )
                    UNION ALL
                    (
                        SELECT 'Maestría' AS Nivel, EstadosEducacion.DescripcionEstado AS Estado,
                            semestres.Semestre AS GradoAcademico, planestudios.Plan,
                            NULL AS Carrera, Universidades.NombreUniversidad,
                            semestres.Semestre, Maestrias.NombreMaestria
                        FROM InfoAcademica
                        INNER JOIN EstadosEducacion ON InfoAcademica.EstadoMaestria = EstadosEducacion.IdEstadoEducacion
                        LEFT JOIN Maestrias ON InfoAcademica.IdMaestria = Maestrias.IdMaestria
                        LEFT JOIN Universidades ON InfoAcademica.IdUniversidadMaestria = Universidades.IdUniversidad
                        LEFT JOIN planestudios ON InfoAcademica.IdPlanEstudio = planestudios.IdPlanEstudio
                        LEFT JOIN semestres ON InfoAcademica.IdNivelAcademicoMaestria = semestres.Id_semestre
                        WHERE InfoAcademica.IdPersonal = ?
                    )
                `;

                const infoAcad = await connection.query(queryAcademica, [persona.IdPersonal, persona.IdPersonal, persona.IdPersonal, persona.IdPersonal, persona.IdPersonal]);

                if (infoAcad.length > 0) {
                    infoAcad.forEach(nivel => {
                        datosAcademica.push([
                            persona.IdPersonal,
                            persona.NombreCompleto,
                            nivel.Nivel || 'N/A',
                            nivel.Estado || 'N/A',
                            nivel.GradoAcademico || 'N/A',
                            nivel.Plan || 'N/A',
                            nivel.Carrera || 'N/A',
                            nivel.Universidad || 'N/A',
                            nivel.Maestria || 'N/A'
                        ]);
                    });
                }
            } catch (error) {
                console.error('Error al obtener info académica:', error);
            }

            // ===== HOJA 4: EVALUACIONES PMA =====
            try {
                const queryPMA = `
                    SELECT
                        ResultadosPMA.FactorV, ResultadosPMA.FactorE, ResultadosPMA.FactorR,
                        ResultadosPMA.FactorN, ResultadosPMA.FactorF,
                        personal.PrimerNombre, personal.SegundoNombre, personal.TercerNombre,
                        personal.PrimerApellido, personal.SegundoApellido,
                        ResultadosPMA.FechaEvaluacion AS FechaHoraRegistro
                    FROM ResultadosPMA
                    INNER JOIN personal ON ResultadosPMA.IdUsuarioEvaluo = personal.IdPersonal
                    WHERE ResultadosPMA.IdPersonal = ?
                    ORDER BY ResultadosPMA.FechaHoraRegistro DESC
                `;

                const infoPMA = await connection.query(queryPMA, [persona.IdPersonal]);

                if (infoPMA.length > 0) {
                    infoPMA.forEach((evaluacion, idx) => {
                        const nombreEvaluador = `${evaluacion.PrimerNombre} ${evaluacion.SegundoNombre || ''} ${evaluacion.TercerNombre || ''} ${evaluacion.PrimerApellido} ${evaluacion.SegundoApellido || ''}`.trim().replace(/\s+/g, ' ');
                        const fecha = evaluacion.FechaHoraRegistro ?
                            formatearFecha(new Date(evaluacion.FechaHoraRegistro).toISOString().split('T')[0]) : 'N/A';

                        const suma = (evaluacion.FactorV || 0) + (evaluacion.FactorE || 0) + (evaluacion.FactorR || 0) + (evaluacion.FactorN || 0) + (evaluacion.FactorF || 0);
                        const promedio = (suma / 5).toFixed(2);

                        datosPMA.push([
                            persona.IdPersonal,
                            persona.NombreCompleto,
                            infoPMA.length - idx,
                            fecha,
                            nombreEvaluador,
                            evaluacion.FactorV !== null ? evaluacion.FactorV : '-',
                            evaluacion.FactorE !== null ? evaluacion.FactorE : '-',
                            evaluacion.FactorR !== null ? evaluacion.FactorR : '-',
                            evaluacion.FactorN !== null ? evaluacion.FactorN : '-',
                            evaluacion.FactorF !== null ? evaluacion.FactorF : '-',
                            suma,
                            promedio
                        ]);
                    });
                }
            } catch (error) {
                console.error('Error al obtener info PMA:', error);
            }
        }

        await connection.close();

        // Crear libro de Excel
        const wb = XLSX.utils.book_new();

        // Crear las 4 hojas
        const wsPersonal = XLSX.utils.aoa_to_sheet(datosPersonal);
        const wsLaboral = XLSX.utils.aoa_to_sheet(datosLaboral);
        const wsAcademica = XLSX.utils.aoa_to_sheet(datosAcademica);
        const wsPMA = XLSX.utils.aoa_to_sheet(datosPMA);

        // Agregar hojas al libro
        XLSX.utils.book_append_sheet(wb, wsPersonal, 'Info Personal');
        XLSX.utils.book_append_sheet(wb, wsLaboral, 'Info Laboral');
        XLSX.utils.book_append_sheet(wb, wsAcademica, 'Info Académica');
        XLSX.utils.book_append_sheet(wb, wsPMA, 'Info PMA');

        // Generar nombre de archivo con fecha
        const fecha = new Date().toISOString().split('T')[0];
        const nombreArchivo = `Personal_Completo_${fecha}.xlsx`;

        // Guardar archivo usando IPC de Electron
        const result = await ipcRenderer.invoke('save-excel-dialog', nombreArchivo);

        if (result.canceled) {
            Swal.close();
            return;
        }

        // Escribir el archivo
        XLSX.writeFile(wb, result.filePath);

        await Swal.fire({
            icon: 'success',
            title: '¡Exportado!',
            html: `El archivo se guardó correctamente<br><small>${todosLosResultados.length} colaboradores exportados en 4 hojas</small>`,
            confirmButtonColor: '#4CAF50',
            timer: 3000,
            timerProgressBar: true
        });

    } catch (error) {
        console.error('Error al exportar:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error al exportar',
            text: error.message || 'No se pudo exportar el archivo. Verifica que tengas los permisos necesarios.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// ==================== FUNCIONES AUXILIARES ====================
function formatearFecha(fecha) {
    // Crear fecha sin ajuste de zona horaria
    const date = new Date(fecha + 'T00:00:00');
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

function formatearFechaHora(fechaHora) {
    // Formatear fecha y hora completa
    const date = new Date(fechaHora);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    const horas = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    const segundos = String(date.getSeconds()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${horas}:${minutos}:${segundos}`;
}

function calcularTiempoLaborado(fechaInicio) {
    const inicio = new Date(fechaInicio + 'T00:00:00');
    const hoy = new Date();

    let anios = hoy.getFullYear() - inicio.getFullYear();
    let meses = hoy.getMonth() - inicio.getMonth();
    let dias = hoy.getDate() - inicio.getDate();

    // Ajustar si los días son negativos
    if (dias < 0) {
        meses--;
        const ultimoDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
        dias += ultimoDiaMesAnterior;
    }

    // Ajustar si los meses son negativos
    if (meses < 0) {
        anios--;
        meses += 12;
    }

    // Construir string de resultado
    const partes = [];
    if (anios > 0) partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`);
    if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`);
    if (dias > 0 && anios === 0) partes.push(`${dias} ${dias === 1 ? 'día' : 'días'}`);

    return partes.length > 0 ? partes.join(', ') : '0 días';
}

function calcularEdad(fechaNacimiento) {
    const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
    const hoy = new Date();

    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();

    // Ajustar si aún no ha cumplido años este año
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }

    return edad;
}

// ==================== GUARDAR Y RESTAURAR ESTADO DE BÚSQUEDA ====================
function guardarEstadoBusqueda() {
    try {
        const estado = {
            // Filtros aplicados
            nombreColaborador: document.getElementById('nombreColaborador').value,
            departamento: document.getElementById('departamento').value,
            tipoPersonal: document.getElementById('tipoPersonal').value,
            estadoPersonal: document.getElementById('estadoPersonal').value,
            // Datos seleccionados
            departamentoSeleccionado: departamentoSeleccionado,
            colaboradorSeleccionado: colaboradorSeleccionado,
            // Resultados de la búsqueda
            todosLosResultados: todosLosResultados
        };

        localStorage.setItem('busquedaPersonalEstado', JSON.stringify(estado));
    } catch (error) {
        console.error('Error al guardar estado de búsqueda:', error);
    }
}

async function restaurarBusqueda(estado) {
    try {
        mostrarLoader(true);

        // Restaurar valores de los filtros
        document.getElementById('nombreColaborador').value = estado.nombreColaborador || '';
        document.getElementById('departamento').value = estado.departamento || '';
        document.getElementById('tipoPersonal').value = estado.tipoPersonal || '';
        document.getElementById('estadoPersonal').value = estado.estadoPersonal || '';

        // Restaurar variables globales
        departamentoSeleccionado = estado.departamentoSeleccionado;
        colaboradorSeleccionado = estado.colaboradorSeleccionado;
        todosLosResultados = estado.todosLosResultados || [];

        // Mostrar tags si aplica
        if (estado.departamentoSeleccionado) {
            const departamentoInput = document.getElementById('departamento');
            const departamentoTag = document.getElementById('departamentoTag');
            departamentoInput.style.display = 'none';
            departamentoTag.style.display = 'inline-flex';
            departamentoTag.querySelector('.tag-text').textContent = estado.departamento;
        }

        if (estado.colaboradorSeleccionado) {
            const nombreInput = document.getElementById('nombreColaborador');
            const nombreTag = document.getElementById('nombreTag');
            nombreInput.style.display = 'none';
            nombreTag.style.display = 'inline-flex';
            nombreTag.querySelector('.tag-text').textContent = estado.nombreColaborador;
        }

        // Renderizar los resultados guardados
        if (todosLosResultados.length > 0) {
            renderizarResultados();
        } else {
            mostrarMensajeInicial();
        }

        mostrarLoader(false);
    } catch (error) {
        console.error('Error al restaurar búsqueda:', error);
        mostrarLoader(false);
        mostrarMensajeInicial();
    }
}

function mostrarLoader(mostrar) {
    const loader = document.getElementById('loader');
    if (mostrar) {
        loader.style.display = 'flex';
    } else {
        loader.style.display = 'none';
    }
}

// ==================== MOSTRAR FOTO AMPLIADA ====================
function mostrarFotoAmpliada(fotoSrc, nombreCompleto) {
    Swal.fire({
        title: nombreCompleto,
        imageUrl: fotoSrc,
        imageAlt: nombreCompleto,
        width: '600px',
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#FF9800',
        customClass: {
            image: 'swal-image-zoom'
        },
        showCloseButton: true,
        backdrop: `rgba(0,0,0,0.8)`
    });
}

// Agregar estilos adicionales para el modal de detalle
document.head.insertAdjacentHTML('beforeend', `
    <style>
        .swal-detalle-colaborador {
            font-family: 'Poppins', sans-serif;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Estilos para la celda con foto */
        .employee-cell {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .employee-photo {
            width: 35px;
            height: 35px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #FF9800;
            flex-shrink: 0;
            cursor: pointer;
            transition: all 0.3s;
        }

        .employee-photo:hover {
            transform: scale(1.15);
            box-shadow: 0 4px 12px rgba(255, 152, 0, 0.4);
        }

        /* Estilos para la imagen ampliada en SweetAlert */
        .swal-image-zoom {
            border-radius: 10px;
            max-height: 500px;
            object-fit: contain;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }
    </style>
`);  