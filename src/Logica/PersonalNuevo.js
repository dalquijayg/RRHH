const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const Swal = require('sweetalert2');
const conexion = 'DSN=recursos2';
const userData = JSON.parse(localStorage.getItem('userData'));
const IdUsuario = userData.IdPersonal;
document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del formulario
    const form = document.getElementById('personalForm');
    const tipoPersonalCheckboxes = document.querySelectorAll('input[name="tipoPersonal"]');
    const allInputs = form.querySelectorAll('input:not([name="tipoPersonal"]), select');
    const photoInput = document.getElementById('photo');
    const photoPreview = document.getElementById('photoPreview');
    const siguienteBtn = document.getElementById('siguienteBtn');

    // Campos condicionales
    const tieneTercerNombreRadios = document.querySelectorAll('input[name="tieneTercerNombre"]');
    const tieneHijosRadios = document.querySelectorAll('input[name="tieneHijos"]');
    const tercerNombreGroup = document.getElementById('tercerNombreGroup');
    const cantidadHijosGroup = document.getElementById('cantidadHijosGroup');
    const tercerNombreInput = document.getElementById('tercerNombre');
    const cantidadHijosInput = document.getElementById('cantidadHijos');

    // Estado inicial del formulario
    let formState = {
        tipoPersonalSelected: false,
        tercerNombreRequired: false,
        cantidadHijosRequired: false
    };

    // Función para establecer la conexión
    async function getConnection() {
        try {
            const connection = await odbc.connect(conexion);
            await connection.query('SET NAMES utf8mb4');
            return connection;
        } catch (error) {
            console.error('Error de conexión:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de conexión',
                text: 'No se pudo conectar a la base de datos'
            });
            throw error;
        }
    }

    // Deshabilitar todos los campos al inicio
    function disableAllFields(disable = true) {
        allInputs.forEach(input => {
            input.disabled = disable;
            if (disable) {
                input.classList.add('disabled');
            } else {
                input.classList.remove('disabled');
            }
        });
        photoInput.disabled = disable;
    }

    // Inicializar el formulario
    disableAllFields(true);

    // Función para cambiar entre pestañas
    function cambiarPestana(pestanaActual, pestanaSiguiente) {
        document.getElementById(pestanaActual).style.display = 'none';
        document.getElementById(pestanaSiguiente).style.display = 'grid';
        
        // Actualizar tabs
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        // Activar la pestaña correspondiente
        switch(pestanaSiguiente) {
            case 'contactoForm':
                tabs[1].classList.add('active');
                break;
            case 'laboralForm':
                tabs[2].classList.add('active');
                break;
            case 'academicoForm':
                tabs[3].classList.add('active');
                break;
            case 'personalForm':
            default:
                tabs[0].classList.add('active');
                break;
        }
    }

    // Función para actualizar la información en el header
    function actualizarInfoHeader() {
        const personalInfoPreview = document.querySelector('.personal-info-preview');
        const headerPhoto = document.getElementById('headerPhoto');
        const headerNombre = document.getElementById('headerNombre');
        const headerDPI = document.getElementById('headerDPI');
        
        // Obtener los valores de los campos
        const primerNombre = document.getElementById('primerNombre').value;
        const segundoNombre = document.getElementById('segundoNombre').value;
        const tercerNombre = document.getElementById('tercerNombre')?.value || '';
        const primerApellido = document.getElementById('primerApellido').value;
        const segundoApellido = document.getElementById('segundoApellido').value;
        const dpi = document.getElementById('dpi').value;
        const photoPreview = document.querySelector('#photoPreview img');
    
        // Construir el nombre completo
        let nombreCompleto = `${primerNombre} ${segundoNombre}`;
        if (tercerNombre) nombreCompleto += ` ${tercerNombre}`;
        nombreCompleto += ` ${primerApellido} ${segundoApellido}`;
    
        // Actualizar los elementos
        if (photoPreview) {
            headerPhoto.src = photoPreview.src;
        }
        headerNombre.textContent = nombreCompleto;
        headerDPI.textContent = `DPI: ${dpi}`;
    
        // Mostrar el contenedor
        personalInfoPreview.classList.remove('hidden');
    }

    // Manejo de tipo de personal
    tipoPersonalCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Deshabilitar otros checkboxes cuando uno está seleccionado
            tipoPersonalCheckboxes.forEach(cb => {
                if (cb !== this) {
                    cb.disabled = this.checked;
                }
            });

            formState.tipoPersonalSelected = Array.from(tipoPersonalCheckboxes)
                .some(cb => cb.checked);

            // Habilitar/deshabilitar campos según selección
            disableAllFields(!formState.tipoPersonalSelected);

            // Si se deselecciona el tipo de personal, limpiar el formulario
            if (!formState.tipoPersonalSelected) {
                form.reset();
                photoPreview.innerHTML = '<span class="photo-placeholder">Click para subir foto</span>';
                tipoPersonalCheckboxes.forEach(cb => cb.disabled = false);
            }

            validateForm();
        });
    });

    // Preview de la foto
    photoInput.addEventListener('change', function(e) {
        if (!formState.tipoPersonalSelected) {
            e.preventDefault();
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Primero debe seleccionar el tipo de personal'
            });
            return;
        }

        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                photoPreview.innerHTML = `<img src="${e.target.result}" alt="Vista previa">`;
            };
            reader.readAsDataURL(file);
        }
    });
    // Inicializar estados de campos condicionales
    function initializeConditionalFields() {
        // Tercer Nombre
        const tieneTercerNombreChecked = document.querySelector('input[name="tieneTercerNombre"]:checked');
        if (tieneTercerNombreChecked) {
            const showTercerNombre = tieneTercerNombreChecked.value === 'si';
            tercerNombreGroup.classList.toggle('hidden', !showTercerNombre);
            tercerNombreInput.required = showTercerNombre;
            formState.tercerNombreRequired = showTercerNombre;
        }

        // Cantidad de Hijos
        const tieneHijosChecked = document.querySelector('input[name="tieneHijos"]:checked');
        if (tieneHijosChecked) {
            const showCantidadHijos = tieneHijosChecked.value === 'si';
            cantidadHijosGroup.classList.toggle('hidden', !showCantidadHijos);
            cantidadHijosInput.required = showCantidadHijos;
            formState.cantidadHijosRequired = showCantidadHijos;
        }
    }

    // Llamar a la inicialización
    initializeConditionalFields();

    // Manejo de tercer nombre
    tieneTercerNombreRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const showTercerNombre = this.value === 'si';
            
            // Mostrar u ocultar el campo
            tercerNombreGroup.classList.toggle('hidden', !showTercerNombre);
            
            // Establecer o remover el requisito
            tercerNombreInput.required = showTercerNombre;
            formState.tercerNombreRequired = showTercerNombre;

            // Limpiar el campo si se oculta
            if (!showTercerNombre) {
                tercerNombreInput.value = '';
                tercerNombreInput.required = false;
            }

            validateForm();
        });
    });

    // Manejo de hijos
    tieneHijosRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const showCantidadHijos = this.value === 'si';
            
            // Mostrar u ocultar el campo
            cantidadHijosGroup.classList.toggle('hidden', !showCantidadHijos);
            
            // Establecer o remover el requisito
            cantidadHijosInput.required = showCantidadHijos;
            formState.cantidadHijosRequired = showCantidadHijos;

            // Limpiar el campo si se oculta
            if (!showCantidadHijos) {
                cantidadHijosInput.value = '';
                cantidadHijosInput.required = false;
            }

            validateForm();
        });
    });

    // Validación del formulario
    function validateForm() {
        const requiredInputs = form.querySelectorAll('input[required]:not(:disabled), select[required]:not(:disabled)');
        let isValid = true;

        // Verificar tipo de personal seleccionado
        if (!formState.tipoPersonalSelected) {
            isValid = false;
        }
        if (!document.getElementById('sexo').value) {
            isValid = false;
        }
        // Verificar campos requeridos básicos
        requiredInputs.forEach(input => {
            if (!input.value) {
                isValid = false;
            }
        });

        // Verificar tercer nombre solo si está visible y requerido
        if (!tercerNombreGroup.classList.contains('hidden') && formState.tercerNombreRequired) {
            if (!tercerNombreInput.value) {
                isValid = false;
            }
        }

        // Verificar cantidad de hijos solo si está visible y requerido
        if (!cantidadHijosGroup.classList.contains('hidden') && formState.cantidadHijosRequired) {
            if (!cantidadHijosInput.value) {
                isValid = false;
            }
        }

        // Verificar DPI
        if (dpiInput.value.length !== 13) {
            isValid = false;
        }

        // Verificar foto
        if (!photoInput.files[0]) {
            isValid = false;
        }

        siguienteBtn.disabled = !isValid;
    }

    // Cargar datos de Departamentos
    async function cargarDepartamentos(selectId = 'departamentoOrigen') {
        const departamentoSelect = document.getElementById(selectId);
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    departamentosguatemala.IdDepartamentoG, 
                    departamentosguatemala.NombreDepartamento
                FROM
                    departamentosguatemala
                ORDER BY
                    departamentosguatemala.NombreDepartamento
            `);
            
            departamentoSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(depto => {
                const option = document.createElement('option');
                option.value = depto.IdDepartamentoG;
                option.textContent = depto.NombreDepartamento;
                departamentoSelect.appendChild(option);
            });
            
            await connection.close();
            return result;
        } catch (error) {
            console.error('Error al cargar departamentos:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los departamentos'
            });
            throw error;
        }
    }
    async function cargarRegiones() {
        const regionSelect = document.getElementById('region');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    Regiones.IdRegion, 
                    Regiones.NombreRegion
                FROM
                    Regiones
                ORDER BY
                    Regiones.NombreRegion
            `);
            
            regionSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(region => {
                const option = document.createElement('option');
                option.value = region.IdRegion;
                option.textContent = region.NombreRegion;
                regionSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar regiones:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar las regiones'
            });
        }
    }
    // Cargar Municipios
    async function cargarMunicipios(idDepartamento, selectId = 'municipioOrigen') {
        const municipioSelect = document.getElementById(selectId);
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    municipios.IdMunicipio, 
                    municipios.NombreMunicipio
                FROM
                    municipios
                WHERE
                    municipios.IdDepartamentoG = ?
                ORDER BY
                    municipios.NombreMunicipio
            `, [idDepartamento]);
            
            municipioSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(muni => {
                const option = document.createElement('option');
                option.value = muni.IdMunicipio;
                option.textContent = muni.NombreMunicipio;
                municipioSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar municipios:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los municipios'
            });
        }
    }

    // Validación y autocompletado de DPI
    const dpiInput = document.getElementById('dpi');
    dpiInput.addEventListener('input', async function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 13);
        
        // Si el DPI tiene 13 dígitos, verificar si ya existe y buscar el municipio
        if (this.value.length === 13) {
            try {
                const connection = await getConnection();
                
                // Verificar si el DPI ya existe en la base de datos
                const dpiExistsResult = await connection.query(`
                    SELECT COUNT(*) as count 
                    FROM personal 
                    WHERE DPI = ?
                `, [this.value]);
                
                if (dpiExistsResult && dpiExistsResult[0] && dpiExistsResult[0].count > 0) {
                    // DPI ya existe, mostrar mensaje y limpiar el campo
                    Swal.fire({
                        icon: 'warning',
                        title: 'DPI Duplicado',
                        text: 'Este DPI ya está registrado en el sistema. No es posible registrar colaboradores duplicados.',
                        confirmButtonText: 'Entendido'
                    }).then(() => {
                        // Limpiar el campo DPI
                        this.value = '';
                        
                        // También podríamos deshabilitar la continuación del formulario
                        document.getElementById('siguienteBtn').disabled = true;
                    });
                    
                    await connection.close();
                    return;
                }
                
                // Si no existe, continuar con la busqueda del municipio (código existente)
                const codigoMunicipio = this.value.slice(-4); // Obtener los últimos 4 dígitos
                
                // Buscar el municipio por código
                const municipioResult = await connection.query(`
                    SELECT 
                        m.IdMunicipio,
                        m.IdDepartamentoG,
                        m.Codigo
                    FROM 
                        municipios m
                    WHERE 
                        m.Codigo = ?
                `, [codigoMunicipio]);
    
                if (municipioResult && municipioResult.length > 0) {
                    const municipioData = municipioResult[0];
                    
                    // Seleccionar el departamento
                    const departamentoSelect = document.getElementById('departamentoOrigen');
                    departamentoSelect.value = municipioData.IdDepartamentoG;
                    
                    // Cargar y seleccionar el municipio
                    await cargarMunicipios(municipioData.IdDepartamentoG);
                    const municipioSelect = document.getElementById('municipioOrigen');
                    municipioSelect.value = municipioData.IdMunicipio;
                }
                
                await connection.close();
            } catch (error) {
                console.error('Error al verificar DPI:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudo verificar el DPI'
                });
            }
        }
        
        validateForm();
    });

    // Agregar validación a todos los campos
    allInputs.forEach(input => {
        input.addEventListener('input', validateForm);
        input.addEventListener('change', validateForm);
    });
    // Cargar Estado Civil
    async function cargarEstadoCivil() {
        const estadoCivilSelect = document.getElementById('estadoCivil');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    estadocivil.IdCivil, 
                    estadocivil.EstadoCivil
                FROM
                    estadocivil
                ORDER BY
                    estadocivil.EstadoCivil
            `);
            
            estadoCivilSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(estado => {
                const option = document.createElement('option');
                option.value = estado.IdCivil;
                option.textContent = estado.EstadoCivil;
                estadoCivilSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar estado civil:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo cargar el estado civil'
            });
        }
    }

    // Cargar Tipo de Sangre
    async function cargarTipoSangre() {
        const tipoSangreSelect = document.getElementById('tipoSangre');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    TipoSangre.IdSangre, 
                    TipoSangre.TipoSangre
                FROM
                    TipoSangre
                ORDER BY
                    TipoSangre.TipoSangre
            `);
            
            tipoSangreSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo.IdSangre;
                option.textContent = tipo.TipoSangre;
                tipoSangreSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar tipos de sangre:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los tipos de sangre'
            });
        }
    }

    // Cargar Parentesco
    async function cargarParentesco() {
        const parentescoSelect = document.getElementById('parentescoEmergencia');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    parentesco.IdParentesco, 
                    parentesco.Parentesco
                FROM
                    parentesco
                ORDER BY
                    parentesco.Parentesco
            `);
            
            parentescoSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(p => {
                const option = document.createElement('option');
                option.value = p.IdParentesco;
                option.textContent = p.Parentesco;
                parentescoSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar parentescos:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los parentescos'
            });
        }
    }

    // Validación del formulario de contacto
    function validateContactForm() {
        const contactForm = document.getElementById('contactoForm');
        const requiredInputs = contactForm.querySelectorAll('input[required], select[required]');
        let isValid = true;

        requiredInputs.forEach(input => {
            if (!input.value) {
                isValid = false;
            }
        });

        // Validación específica para teléfonos
        const telefonos = [
            document.getElementById('telefono1'),
            document.getElementById('telefonoEmergencia')
        ];
        
        telefonos.forEach(tel => {
            if (tel.value.length !== 8) {
                isValid = false;
            }
        });

        // Validación de email
        const emailInput = document.getElementById('correoElectronico');
        if (!emailInput.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            isValid = false;
        }

        document.getElementById('siguienteContactoBtn').disabled = !isValid;
    }

    // Eventos para validación de teléfonos
    const telefonoInputs = document.querySelectorAll('input[type="tel"]');
    telefonoInputs.forEach(input => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 8);
            validateContactForm();
        });
    });

    // Validación de correo electrónico
    document.getElementById('correoElectronico')?.addEventListener('input', validateContactForm);

    // Agregar validación a todos los campos de contacto
    const contactInputs = document.getElementById('contactoForm').querySelectorAll('input, select');
    contactInputs.forEach(input => {
        input.addEventListener('input', validateContactForm);
        input.addEventListener('change', validateContactForm);
    });

    // Event Listeners para eventos de navegación
    // Botón siguiente de datos personales
    document.getElementById('siguienteBtn').addEventListener('click', async function() {
        try {
            // Obtener referencias a los selectores
            const departamentoResidencia = document.getElementById('departamentoResidencia');
            const departamentoOrigen = document.getElementById('departamentoOrigen');
            
            // Cargar los departamentos si no están cargados
            if (departamentoResidencia.options.length <= 1) {
                await cargarDepartamentos('departamentoResidencia');
            }
            
            // Esperar a que se carguen los departamentos
            setTimeout(async () => {
                // Establecer el valor del departamento de residencia
                departamentoResidencia.value = departamentoOrigen.value;
                
                // Cargar y establecer el municipio
                await cargarMunicipios(departamentoOrigen.value, 'municipioResidencia');
                const municipioResidencia = document.getElementById('municipioResidencia');
                const municipioOrigen = document.getElementById('municipioOrigen');
                municipioResidencia.value = municipioOrigen.value;
            }, 100);

            actualizarInfoHeader();
            cambiarPestana('personalForm', 'contactoForm');
            
            // Cargar datos necesarios para el formulario de contacto
            cargarParentesco();
        } catch (error) {
            console.error('Error al cambiar de pestaña:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un error al cargar los datos de residencia'
            });
        }
    });

    // Evento para departamento residencia
    document.getElementById('departamentoResidencia')?.addEventListener('change', function() {
        if (this.value) {
            cargarMunicipios(this.value, 'municipioResidencia');
        } else {
            const municipioSelect = document.getElementById('municipioResidencia');
            municipioSelect.innerHTML = '<option value="">Seleccione...</option>';
        }
        validateContactForm();
    });

    // Botones "Anterior"
    document.getElementById('anteriorBtn').addEventListener('click', function() {
        cambiarPestana('contactoForm', 'personalForm');
    });

    // Inicializar cargas
    cargarDepartamentos();
    cargarEstadoCivil();
    cargarTipoSangre();
    // Cargar Divisiones
    async function cargarDivisiones() {
        const divisionSelect = document.getElementById('division');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    divisiones.IdDivision, 
                    divisiones.Nombre
                FROM
                    divisiones
                ORDER BY
                    divisiones.Nombre
            `);
            
            divisionSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(div => {
                const option = document.createElement('option');
                option.value = div.IdDivision;
                option.textContent = div.Nombre;
                divisionSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar divisiones:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar las divisiones'
            });
        }
    }

    // Cargar sucursales según división
    async function cargarSucursales(idDivision, idRegion) {
        const sucursalSelect = document.getElementById('sucursal');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    departamentos.IdDepartamento, 
                    departamentos.NombreDepartamento
                FROM
                    departamentos
                WHERE
                    departamentos.IdDivision = ? 
                    AND departamentos.IdRegion = ?
                ORDER BY
                    departamentos.NombreDepartamento
            `, [idDivision, idRegion]);
            
            sucursalSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(dep => {
                const option = document.createElement('option');
                option.value = dep.IdDepartamento;
                option.textContent = dep.NombreDepartamento;
                option.dataset.regionId = dep.IdRegion;
                sucursalSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar sucursales:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar las sucursales'
            });
        }
    }

    // Cargar Región
    async function cargarRegion(idRegion) {
        const regionSelect = document.getElementById('region');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    Regiones.IdRegion, 
                    Regiones.NombreRegion
                FROM
                    Regiones
                WHERE
                    Regiones.IdRegion = ?
            `, [idRegion]);
            
            if (result.length > 0) {
                regionSelect.innerHTML = `<option value="${result[0].IdRegion}">${result[0].NombreRegion}</option>`;
            }
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar región:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo cargar la región'
            });
        }
    }

    // Cargar Puestos según Departamento
    async function cargarPuestos(idDepartamento) {
        const puestoSelect = document.getElementById('puesto');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    Puestos.IdPuesto, 
                    Puestos.Nombre
                FROM
                    Puestos
                WHERE
                    Puestos.IdDepartamento = ?
                ORDER BY
                    Puestos.Nombre
            `, [idDepartamento]);
            
            puestoSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(puesto => {
                const option = document.createElement('option');
                option.value = puesto.IdPuesto;
                option.textContent = puesto.Nombre;
                puestoSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar puestos:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los puestos'
            });
        }
    }

    // Validación del formulario laboral
    function validateLaboralForm() {
        const requiredInputs = document.getElementById('laboralForm')
            .querySelectorAll('input[required]:not(:disabled), select[required]:not(:disabled)');
        let isValid = true;

        // Verificar campos requeridos básicos
        requiredInputs.forEach(input => {
            if (!input.value) {
                isValid = false;
            }
        });

        // Obtener valores específicos
        const divisionId = parseInt(document.getElementById('division').value);
        const sucursal = document.getElementById('sucursal').value;
        const puesto = document.getElementById('puesto').value;
        const inicioLaboral = document.getElementById('inicioLaboral').value;
        const tallaChaleco = document.getElementById('talla_chaleco');
        const tallaCalzado = document.getElementById('talla_calzado');

        // Verificar campos principales
        if (!divisionId || !sucursal || !puesto || !inicioLaboral) {
            isValid = false;
        }

        // Validar campos de talla según división seleccionada
        if (divisionId === 1 || divisionId === 2) {
            if (!tallaChaleco.value) {
                isValid = false;
            }
        } else if (divisionId === 3 || divisionId === 4) {
            if (!tallaCalzado.value) {
                isValid = false;
            }
        }

        document.getElementById('siguienteLaboralBtn').disabled = !isValid;
        return isValid;
    }

    // Eventos para la sección laboral
    const divisionSelect = document.getElementById('division');
    const regionSelect = document.getElementById('region');
    const sucursalSelect = document.getElementById('sucursal');
    sucursalSelect.disabled = true;
    // Evento cambio de división
    divisionSelect.addEventListener('change', function() {
        // Lógica existente para sucursales...
        if (!this.value) {
            sucursalSelect.disabled = true;
            sucursalSelect.innerHTML = '<option value="">Seleccione...</option>';
        }
        
        // Obtener referencias a los elementos de tallas
        const tallaChaleco = document.getElementById('tallaChaleco');
        const tallaCalzado = document.getElementById('tallaCalzado');
        const inputChaleco = document.getElementById('talla_chaleco');
        const inputCalzado = document.getElementById('talla_calzado');
        
        // Obtener el ID de la división seleccionada
        const divisionId = parseInt(this.value);
        
        // Mostrar/ocultar campos según división
        if (divisionId === 1 || divisionId === 2) {
            // Para divisiones 1 y 2, mostrar chaleco y ocultar calzado
            tallaChaleco.classList.remove('hidden');
            tallaCalzado.classList.add('hidden');
            inputChaleco.required = true;
            inputCalzado.required = false;
            inputCalzado.value = '';
        } else if (divisionId === 3 || divisionId === 4) {
            // Para divisiones 3 y 4, mostrar calzado y ocultar chaleco
            tallaChaleco.classList.add('hidden');
            tallaCalzado.classList.remove('hidden');
            inputChaleco.required = false;
            inputCalzado.required = true;
            inputChaleco.value = '';
        } else {
            // Si no hay división seleccionada o es otra, ocultar ambos
            tallaChaleco.classList.add('hidden');
            tallaCalzado.classList.add('hidden');
            inputChaleco.required = false;
            inputCalzado.required = false;
            inputChaleco.value = '';
            inputCalzado.value = '';
        }
        
        // Verificar si hay región seleccionada y cargar sucursales si es necesario
        const idRegion = regionSelect.value;
        if (this.value && idRegion) {
            sucursalSelect.disabled = false;
            cargarSucursales(this.value, idRegion);
        }
        
        validateLaboralForm();
    });
    
    // Event listener para cambio de región
    regionSelect.addEventListener('change', function() {
        // Reiniciar sucursal
        sucursalSelect.innerHTML = '<option value="">Seleccione...</option>';
        sucursalSelect.disabled = true;
        
        // Verificar si hay división y región seleccionadas
        const idDivision = divisionSelect.value;
        if (this.value && idDivision) {
            sucursalSelect.disabled = false;
            cargarSucursales(idDivision, this.value);
        }
        
        validateLaboralForm();
    });
    
    // Event listener para cambio de sucursal
    sucursalSelect.addEventListener('change', function() {
        if (this.value) {
            cargarPuestos(this.value);
        }
        validateLaboralForm();
    });

    // Evento para fechas y otros campos laborales
    document.getElementById('inicioLaboral').addEventListener('change', validateLaboralForm);
    document.getElementById('puesto').addEventListener('change', validateLaboralForm);

    // Botón siguiente de información de contacto
    document.getElementById('siguienteContactoBtn').addEventListener('click', async function() {
        try {
            // Inicializar carga de datos laborales
            await cargarDivisiones();
            cargarRegiones();
            
            // Cambiar a la pestaña laboral
            cambiarPestana('contactoForm', 'laboralForm');
            
            // Actualizar tabs
            const tabs = document.querySelectorAll('.tab');
            tabs[2].classList.add('active');
            tabs[2].disabled = false;
        } catch (error) {
            console.error('Error al cambiar a información laboral:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un error al cargar la información laboral'
            });
        }
    });

    document.getElementById('anteriorLaboralBtn').addEventListener('click', function() {
        cambiarPestana('laboralForm', 'contactoForm');
    });
    // Botón siguiente de información laboral que lleva a académica
    document.getElementById('siguienteLaboralBtn').addEventListener('click', async function() {
        try {
            
            // Cambiar a la pestaña académica
            cambiarPestana('laboralForm', 'academicoForm');
            
            // Cargar los datos necesarios
            await Promise.all([
                cargarSemestresPrimaria(),
                cargarSemestresBasico(),
                cargarSemestresDiversificado(),
                cargarPlanesEstudio('planEstudioPrimaria'),
                cargarPlanesEstudio('planEstudioBasico'),
                cargarPlanesEstudio('planEstudioDiversificado'),
                cargarCarrerasDiversificado(),
                cargarCarrerasUniversitarias(),
                cargarSemestresUniversitarios(),
                cargarPlanesEstudio('planEstudioMaestria'),
                cargarMaestrias(),
                cargarPlanesEstudio('planEstudioUniversitario'),
                cargarUniversidades(),
                cargarSemestresMaestria()
            ]);
            
            // Actualizar tabs
            const tabs = document.querySelectorAll('.tab');
            tabs[3].classList.add('active');
            tabs[3].disabled = false;
        } catch (error) {
            console.error('Error al cambiar a información académica:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un error al cargar la información académica'
            });
        }
    });

    // Cargar semestres de primaria
    async function cargarSemestresPrimaria() {
        const semestreSelect = document.getElementById('semestrePrimaria');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    semestres.Id_semestre, 
                    semestres.Semestre
                FROM
                    semestres
                WHERE
                    semestres.Primaria = 1
                ORDER BY
                    semestres.Id_semestre
            `);
            
            semestreSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(sem => {
                const option = document.createElement('option');
                option.value = sem.Id_semestre;
                option.textContent = sem.Semestre;
                semestreSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar semestres de primaria:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los semestres de primaria'
            });
        }
    }

    // Cargar semestres de básico
    async function cargarSemestresBasico() {
        const semestreSelect = document.getElementById('semestreBasico');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    semestres.Id_semestre, 
                    semestres.Semestre
                FROM
                    semestres
                WHERE
                    semestres.Basico = 1
                ORDER BY
                    semestres.Id_semestre
            `);
            
            semestreSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(sem => {
                const option = document.createElement('option');
                option.value = sem.Id_semestre;
                option.textContent = sem.Semestre;
                semestreSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar semestres de básico:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los semestres de básico'
            });
        }
    }

    // Cargar semestres de diversificado
    async function cargarSemestresDiversificado() {
        const semestreSelect = document.getElementById('semestreDiversificado');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    semestres.Id_semestre, 
                    semestres.Semestre
                FROM
                    semestres
                WHERE
                    semestres.Diversificado = 1
                ORDER BY
                    semestres.Id_semestre
            `);
            
            semestreSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(sem => {
                const option = document.createElement('option');
                option.value = sem.Id_semestre;
                option.textContent = sem.Semestre;
                semestreSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar semestres de diversificado:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los semestres de diversificado'
            });
        }
    }

    // Cargar carreras de diversificado
    async function cargarCarrerasDiversificado() {
        const carreraSelect = document.getElementById('carreraDiversificadoSelect');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    GradosAcademicos.IdGrado, 
                    GradosAcademicos.GradoAcademico
                FROM
                    GradosAcademicos
                ORDER BY
                    GradosAcademicos.GradoAcademico
            `);
            
            carreraSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(carrera => {
                const option = document.createElement('option');
                option.value = carrera.IdGrado;
                option.textContent = carrera.GradoAcademico;
                carreraSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar carreras:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar las carreras'
            });
        }
    }

    // Cargar planes de estudio
    async function cargarPlanesEstudio(selectId) {
        const planSelect = document.getElementById(selectId);
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    planestudios.IdPlanEstudio, 
                    planestudios.Plan
                FROM
                    planestudios
                ORDER BY
                    planestudios.Plan
            `);
            
            planSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(plan => {
                const option = document.createElement('option');
                option.value = plan.IdPlanEstudio;
                option.textContent = plan.Plan;
                planSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar planes de estudio:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los planes de estudio'
            });
        }
    }

    // Event listeners para los radio buttons de primaria
    const radiosPrimaria = document.querySelectorAll('input[name="primaria"]');
    radiosPrimaria.forEach(radio => {
        radio.addEventListener('change', function() {
            const semestresDiv = document.getElementById('primariaSemestre');
            const planDiv = document.getElementById('planPrimaria');
            const semestreSelect = document.getElementById('semestrePrimaria');
            const planSelect = document.getElementById('planEstudioPrimaria');
            
            if (this.value === 'cursando') {
                semestresDiv.classList.remove('hidden');
                planDiv.classList.remove('hidden');
                semestreSelect.required = true;
                planSelect.required = true;
                if (!semestreSelect.options.length) {
                    cargarSemestresPrimaria();
                }
                if (!planSelect.options.length) {
                    cargarPlanesEstudio('planEstudioPrimaria');
                }
            } else if (this.value === 'incompleto') {
                semestresDiv.classList.remove('hidden');
                planDiv.classList.add('hidden');
                semestreSelect.required = true;
                planSelect.required = false;
                planSelect.value = '';
                if (!semestreSelect.options.length) {
                    cargarSemestresPrimaria();
                }
            } else {
                semestresDiv.classList.add('hidden');
                planDiv.classList.add('hidden');
                semestreSelect.required = false;
                planSelect.required = false;
                semestreSelect.value = '';
                planSelect.value = '';
            }
            validateAcademicoForm();
        });
    });
    // Event listeners para los radio buttons de básico
    const radiosBasico = document.querySelectorAll('input[name="basico"]');
    radiosBasico.forEach(radio => {
        radio.addEventListener('change', function() {
            const semestresDiv = document.getElementById('basicoSemestre');
            const planDiv = document.getElementById('planBasico');
            const semestreSelect = document.getElementById('semestreBasico');
            const planSelect = document.getElementById('planEstudioBasico');
            
            if (this.value === 'cursando') {
                semestresDiv.classList.remove('hidden');
                planDiv.classList.remove('hidden');
                semestreSelect.required = true;
                planSelect.required = true;
                if (!semestreSelect.options.length) {
                    cargarSemestresBasico();
                }
                if (!planSelect.options.length) {
                    cargarPlanesEstudio('planEstudioBasico');
                }
            } else if (this.value === 'incompleto') {
                semestresDiv.classList.remove('hidden');
                planDiv.classList.add('hidden');
                semestreSelect.required = true;
                planSelect.required = false;
                planSelect.value = '';
                if (!semestreSelect.options.length) {
                    cargarSemestresBasico();
                }
            } else {
                semestresDiv.classList.add('hidden');
                planDiv.classList.add('hidden');
                semestreSelect.required = false;
                planSelect.required = false;
                semestreSelect.value = '';
                planSelect.value = '';
            }
            validateAcademicoForm();
        });
    });

    // Event listeners para los radio buttons de diversificado
    const radiosDiversificado = document.querySelectorAll('input[name="diversificado"]');
    radiosDiversificado.forEach(radio => {
        radio.addEventListener('change', function() {
            const semestresDiv = document.getElementById('diversificadoSemestre');
            const planDiv = document.getElementById('planDiversificado');
            const carreraDiv = document.getElementById('carreraDiversificado');
            const semestreSelect = document.getElementById('semestreDiversificado');
            const planSelect = document.getElementById('planEstudioDiversificado');
            const carreraSelect = document.getElementById('carreraDiversificadoSelect');
            
            // Mostrar carrera siempre que no sea "No cursó"
            if (this.value !== 'nocurso') {
                carreraDiv.classList.remove('hidden');
                carreraSelect.required = true;
                if (!carreraSelect.options.length) {
                    cargarCarrerasDiversificado();
                }
            } else {
                carreraDiv.classList.add('hidden');
                carreraSelect.required = false;
                carreraSelect.value = '';
            }

            if (this.value === 'cursando') {
                semestresDiv.classList.remove('hidden');
                planDiv.classList.remove('hidden');
                semestreSelect.required = true;
                planSelect.required = true;
                if (!semestreSelect.options.length) {
                    cargarSemestresDiversificado();
                }
                if (!planSelect.options.length) {
                    cargarPlanesEstudio('planEstudioDiversificado');
                }
            } else if (this.value === 'incompleto') {
                semestresDiv.classList.remove('hidden');
                planDiv.classList.add('hidden');
                semestreSelect.required = true;
                planSelect.required = false;
                planSelect.value = '';
                if (!semestreSelect.options.length) {
                    cargarSemestresDiversificado();
                }
            } else {
                semestresDiv.classList.add('hidden');
                planDiv.classList.add('hidden');
                semestreSelect.required = false;
                planSelect.required = false;
                semestreSelect.value = '';
                planSelect.value = '';
            }

            // Mostrar sección de universidad solo si diversificado está completado
            const universidadSection = document.getElementById('estudiaUniversidad');
            if (this.value === 'completado') {
                universidadSection.parentElement.classList.remove('hidden');
            } else {
                universidadSection.parentElement.classList.add('hidden');
                universidadSection.checked = false;
                // Ocultar sección completa de universidad
                document.getElementById('universidadSeccion').classList.add('hidden');
            }

            validateAcademicoForm();
        });
    });

    // Cargar carreras universitarias
    async function cargarCarrerasUniversitarias() {
        const carreraSelect = document.getElementById('carreraUniversitaria');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    CarrerasUniversitarias.IdCarreraUniversitaria, 
                    CarrerasUniversitarias.NombreCarrera
                FROM
                    CarrerasUniversitarias
                ORDER BY
                    CarrerasUniversitarias.NombreCarrera
            `);
            
            carreraSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(carrera => {
                const option = document.createElement('option');
                option.value = carrera.IdCarreraUniversitaria;
                option.textContent = carrera.NombreCarrera;
                carreraSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar carreras universitarias:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar las carreras universitarias'
            });
        }
    }

    // Cargar semestres universitarios
    async function cargarSemestresUniversitarios() {
        const semestreSelect = document.getElementById('semestreUniversitario');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    semestres.Id_semestre, 
                    semestres.Semestre
                FROM
                    semestres
                WHERE
                    semestres.Universidad = 1
                ORDER BY
                    semestres.Id_semestre
            `);
            
            semestreSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(sem => {
                const option = document.createElement('option');
                option.value = sem.Id_semestre;
                option.textContent = sem.Semestre;
                semestreSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar semestres universitarios:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los semestres universitarios'
            });
        }
    }
    async function cargarTiposLicencia() {
        const tipoLicenciaSelect = document.getElementById('tipoLicencia');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    tipolicencias.IdLicencia, 
                    tipolicencias.TipoLicencia
                FROM
                    tipolicencias
                ORDER BY
                    tipolicencias.TipoLicencia
            `);
            
            if (result && result.length > 0) {
                tipoLicenciaSelect.innerHTML = '<option value="">Seleccione...</option>';
                result.forEach(tipo => {
                    const option = document.createElement('option');
                    option.value = tipo.IdLicencia;
                    option.textContent = tipo.TipoLicencia;
                    tipoLicenciaSelect.appendChild(option);
                });
            } else {
                console.log('No se encontraron tipos de licencia');
            }
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar tipos de licencia:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los tipos de licencia'
            });
        }
    }
    document.getElementById('tieneRTU').addEventListener('change', function() {
        const nitGroup = document.getElementById('nitGroup');
        const nitInput = document.getElementById('nit');
        
        nitGroup.classList.toggle('hidden', !this.checked);
        nitInput.required = this.checked;
        validateDocumentacionForm();
    });
    function validateDocumentacionForm() {
        let isValid = true;
        
        // Validar NIT si tiene RTU
        if (document.getElementById('tieneRTU').checked) {
            const nit = document.getElementById('nit').value;
            if (!nit || !nit.match(/^[0-9K\-]+$/)) {
                isValid = false;
            }
        }
        
        // Validar tipo de licencia si sabe manejar
        if (document.querySelector('input[name="sabeManejar"]:checked')?.value === 'si') {
            if (!document.getElementById('tipoLicencia').value) {
                isValid = false;
            }
        }
        
        // Validar selección de porte de arma
        if (!document.querySelector('input[name="tienePorteArma"]:checked')) {
            isValid = false;
        }
        
        document.getElementById('siguienteDocumentacionBtn').disabled = !isValid;
        return isValid;
    }
    document.getElementById('siguienteDocumentacionBtn').addEventListener('click', async function() {
        cambiarPestana('documentacionForm', 'pmaForm');
        
        const tabs = document.querySelectorAll('.tab');
        tabs[5].classList.add('active');
        tabs[5].disabled = false;
    });
    document.getElementById('anteriorPMABtn').addEventListener('click', function() {
        cambiarPestana('pmaForm', 'documentacionForm');
    });
    document.getElementById('finalizarBtn').addEventListener('click', async function() {
        try {
            if (!validatePMAForm()) {
                throw new Error('Por favor complete todos los campos del PMA correctamente');
            }
    
            // Mostrar loader
            Swal.fire({
                title: 'Guardando información',
                html: 'Por favor espere...',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
    
            // Guardar todos los datos
            await guardarDatosPersonales();
    
            // Cerrar el loader y mostrar mensaje de éxito
            Swal.fire({
                icon: 'success',
                title: 'Registro Completado',
                text: 'Todos los datos se han guardado correctamente',
                confirmButtonText: 'Aceptar'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Recargar la página completamente
                    location.reload();
                }
            });
    
        } catch (error) {
            // Cerrar el loader en caso de error
            Swal.close();
            
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Hubo un error al guardar los datos'
            });
        }
    });
    // Manejador para licencia de conducir
    document.querySelectorAll('input[name="sabeManejar"]').forEach(radio => {
        radio.addEventListener('change', async function() {
            const tipoLicenciaGroup = document.getElementById('tipoLicenciaGroup');
            const tipoLicenciaSelect = document.getElementById('tipoLicencia');
            
            if (this.value === 'si') {
                tipoLicenciaGroup.classList.remove('hidden');
                tipoLicenciaSelect.required = true;
                try {
                    await cargarTiposLicencia();
                } catch (error) {
                    console.error('Error al cargar tipos de licencia:', error);
                }
            } else {
                tipoLicenciaGroup.classList.add('hidden');
                tipoLicenciaSelect.required = false;
                tipoLicenciaSelect.value = '';
            }
            validateDocumentacionForm();
        });
    });
    // Event listener para checkbox de universidad
    const checkboxUniversidad = document.getElementById('estudiaUniversidad');
    checkboxUniversidad?.addEventListener('change', function() {
        const seccionUniversidad = document.getElementById('universidadSeccion');
        seccionUniversidad.classList.toggle('hidden', !this.checked);
        if (this.checked) {
            // Resetear los campos cuando se muestra la sección
            const radios = document.querySelectorAll('input[name="universidad"]');
            radios.forEach(radio => radio.checked = false);
            document.getElementById('carreraUniversitaria').value = '';
            document.getElementById('universidad').value = '';
            document.getElementById('semestreUniversitario').value = '';
            document.getElementById('planEstudioUniversitario').value = '';
        }
        validateAcademicoForm();
    });
    // Event listeners para los radio buttons de universidad
    const radiosUniversidad = document.querySelectorAll('input[name="universidad"]');
    radiosUniversidad.forEach(radio => {
        radio.addEventListener('change', function() {
            const carreraDiv = document.getElementById('carreraUniversitariaDiv');
            const universidadDiv = document.getElementById('universidadDiv');
            const semestreDiv = document.getElementById('universitarioSemestre');
            const planDiv = document.getElementById('planUniversitario');
            
            // Cargar datos necesarios
            if (!document.getElementById('carreraUniversitaria').options.length) {
                cargarCarrerasUniversitarias();
            }
            if (!document.getElementById('universidad').options.length) {
                cargarUniversidades();
            }

            // Mostrar/ocultar elementos según la selección
            carreraDiv.classList.remove('hidden');
            universidadDiv.classList.remove('hidden');
            
            if (this.value === 'completado') {
                semestreDiv.classList.add('hidden');
                planDiv.classList.add('hidden');
                document.getElementById('semestreUniversitario').required = false;
                document.getElementById('planEstudioUniversitario').required = false;

                // Mostrar opción de maestría
                document.getElementById('maestriaSection').classList.remove('hidden');
            } else if (this.value === 'incompleto') {
                semestreDiv.classList.remove('hidden');
                planDiv.classList.add('hidden');
                document.getElementById('semestreUniversitario').required = true;
                document.getElementById('planEstudioUniversitario').required = false;
                if (!document.getElementById('semestreUniversitario').options.length) {
                    cargarSemestresUniversitarios();
                }
                // Ocultar opción de maestría
                document.getElementById('maestriaSection').classList.add('hidden');
                document.getElementById('estudiaMaestria').checked = false;
                document.getElementById('maestriaSeccion').classList.add('hidden');
            } else if (this.value === 'cursando') {
                semestreDiv.classList.remove('hidden');
                planDiv.classList.remove('hidden');
                document.getElementById('semestreUniversitario').required = true;
                document.getElementById('planEstudioUniversitario').required = true;
                if (!document.getElementById('semestreUniversitario').options.length) {
                    cargarSemestresUniversitarios();
                }
                if (!document.getElementById('planEstudioUniversitario').options.length) {
                    cargarPlanesEstudio('planEstudioUniversitario');
                }
                // Ocultar opción de maestría
                document.getElementById('maestriaSection').classList.add('hidden');
                document.getElementById('estudiaMaestria').checked = false;
                document.getElementById('maestriaSeccion').classList.add('hidden');
            }
            
            validateAcademicoForm();
        });
    });

    // Cargar maestrías
    async function cargarMaestrias() {
        const maestriaSelect = document.getElementById('maestriaCarrera');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    Maestrias.IdMaestria, 
                    Maestrias.NombreMaestria
                FROM
                    Maestrias
                ORDER BY
                    Maestrias.NombreMaestria
            `);
            
            maestriaSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(maestria => {
                const option = document.createElement('option');
                option.value = maestria.IdMaestria;
                option.textContent = maestria.NombreMaestria;
                maestriaSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar maestrías:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar las maestrías'
            });
        }
    }

    // Event listener para checkbox de maestría
    const checkboxMaestria = document.getElementById('estudiaMaestria');
    checkboxMaestria?.addEventListener('change', function() {
        const seccionMaestria = document.getElementById('maestriaSeccion');
        seccionMaestria.classList.toggle('hidden', !this.checked);
        if (this.checked) {
            // Resetear los campos cuando se muestra la sección
            const radios = document.querySelectorAll('input[name="maestria"]');
            radios.forEach(radio => radio.checked = false);
            document.getElementById('maestriaCarrera').value = '';
            document.getElementById('maestriaUniversidad').value = '';
            document.getElementById('semestreMaestria').value = '';
            document.getElementById('planEstudioMaestria').value = '';
        }
        validateAcademicoForm();
    });

    // Event listeners para los radio buttons de maestría
    const radiosMaestria = document.querySelectorAll('input[name="maestria"]');
    radiosMaestria.forEach(radio => {
        radio.addEventListener('change', function() {
            const carreraDiv = document.getElementById('maestriaCarreraDiv');
            const universidadDiv = document.getElementById('maestriaUniversidadDiv');
            const semestreDiv = document.getElementById('maestriaSemestre');
            const planDiv = document.getElementById('planMaestria');
            
            // Cargar datos necesarios
            if (!document.getElementById('maestriaCarrera').options.length) {
                cargarMaestrias();
            }
            if (!document.getElementById('maestriaUniversidad').options.length) {
                cargarUniversidades();
            }

            // Mostrar/ocultar elementos según la selección
            carreraDiv.classList.remove('hidden');
            universidadDiv.classList.remove('hidden');
            
            if (this.value === 'completado') {
                semestreDiv.classList.add('hidden');
                planDiv.classList.add('hidden');
                document.getElementById('semestreMaestria').required = false;
                document.getElementById('planEstudioMaestria').required = false;
            } else if (this.value === 'incompleto') {
                semestreDiv.classList.remove('hidden');
                planDiv.classList.add('hidden');
                document.getElementById('semestreMaestria').required = true;
                document.getElementById('planEstudioMaestria').required = false;
                if (!document.getElementById('semestreMaestria').options.length) {
                    cargarSemestresMaestria();
                }
            } else if (this.value === 'cursando') {
                semestreDiv.classList.remove('hidden');
                planDiv.classList.remove('hidden');
                document.getElementById('semestreMaestria').required = true;
                document.getElementById('planEstudioMaestria').required = true;
                if (!document.getElementById('semestreMaestria').options.length) {
                    cargarSemestresMaestria();
                }
                if (!document.getElementById('planEstudioMaestria').options.length) {
                    cargarPlanesEstudio('planEstudioMaestria');
                }
            }
            
            validateAcademicoForm();
        });
    });

    // Funciones adicionales de navegación académica
    document.getElementById('anteriorAcademicoBtn').addEventListener('click', function() {
        cambiarPestana('academicoForm', 'laboralForm');
    });
    function validateAcademicoForm() {
        let isValid = true;
        
        // Función auxiliar para validar sección básica
        function validateBasicSection(radioName, semesterId, planId) {
            const selectedOption = document.querySelector(`input[name="${radioName}"]:checked`)?.value;
            if (!selectedOption) return false;
            
            if (selectedOption === 'cursando') {
                return document.getElementById(semesterId).value && 
                       document.getElementById(planId).value;
            } else if (selectedOption === 'incompleto') {
                return document.getElementById(semesterId).value;
            }
            
            return true;
        }
    
        // Validar primaria
        isValid = isValid && validateBasicSection('primaria', 'semestrePrimaria', 'planEstudioPrimaria');
    
        // Validar básico
        isValid = isValid && validateBasicSection('basico', 'semestreBasico', 'planEstudioBasico');
    
        // Validar diversificado
        const diversificadoOption = document.querySelector('input[name="diversificado"]:checked')?.value;
        if (!diversificadoOption) {
            isValid = false;
        } else if (diversificadoOption !== 'nocurso') {
            // Validar carrera si no es "no cursó"
            if (!document.getElementById('carreraDiversificadoSelect').value) {
                isValid = false;
            }
            
            // Validar semestre y plan según la opción seleccionada
            if (diversificadoOption === 'cursando') {
                if (!document.getElementById('semestreDiversificado').value ||
                    !document.getElementById('planEstudioDiversificado').value) {
                    isValid = false;
                }
            } else if (diversificadoOption === 'incompleto') {
                if (!document.getElementById('semestreDiversificado').value) {
                    isValid = false;
                }
            }
        }
    
        // Validar universidad si está marcada
        const estudiaUniversidad = document.getElementById('estudiaUniversidad').checked;
        if (estudiaUniversidad) {
            const universidadOption = document.querySelector('input[name="universidad"]:checked')?.value;
            if (!universidadOption) {
                isValid = false;
            } else {
                // Validar campos comunes de universidad
                if (!document.getElementById('carreraUniversitaria').value ||
                    !document.getElementById('universidad').value) {
                    isValid = false;
                }
    
                // Validar campos específicos según la opción
                if (universidadOption === 'cursando') {
                    if (!document.getElementById('semestreUniversitario').value ||
                        !document.getElementById('planEstudioUniversitario').value) {
                        isValid = false;
                    }
                } else if (universidadOption === 'incompleto') {
                    if (!document.getElementById('semestreUniversitario').value) {
                        isValid = false;
                    }
                }
            }
        }
    
        // Validar maestría si está marcada y si universidad está completada
        const estudiaMaestria = document.getElementById('estudiaMaestria').checked;
        if (estudiaMaestria) {
            const maestriaOption = document.querySelector('input[name="maestria"]:checked')?.value;
            if (!maestriaOption) {
                isValid = false;
            } else {
                // Validar campos comunes de maestría
                if (!document.getElementById('maestriaCarrera').value ||
                    !document.getElementById('maestriaUniversidad').value) {
                    isValid = false;
                }
    
                // Validar campos específicos según la opción
                if (maestriaOption === 'cursando') {
                    if (!document.getElementById('semestreMaestria').value ||
                        !document.getElementById('planEstudioMaestria').value) {
                        isValid = false;
                    }
                } else if (maestriaOption === 'incompleto') {
                    if (!document.getElementById('semestreMaestria').value) {
                        isValid = false;
                    }
                }
            }
        }
    
        // Habilitar/deshabilitar botón de siguiente
        document.getElementById('siguienteAcademicoBtn').disabled = !isValid;
        return isValid;
    }
    document.getElementById('siguienteAcademicoBtn').addEventListener('click', async function() {
        try {
            
            // Cambiar a la pestaña de documentación
            cambiarPestana('academicoForm', 'documentacionForm');
            
            // Cargar los tipos de licencia
            await cargarTiposLicencia();
            
            // Actualizar tabs si es necesario
            const tabs = document.querySelectorAll('.tab');
            tabs[4].classList.add('active');
            tabs[4].disabled = false;
        } catch (error) {
            console.error('Error al cambiar a documentación:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un error al cargar la información de documentación'
            });
        }
    });
    
    document.getElementById('anteriorDocumentacionBtn').addEventListener('click', function() {
        cambiarPestana('documentacionForm', 'academicoForm');
    });
    // Cargar semestres de maestría
    async function cargarSemestresMaestria() {
        const semestreSelect = document.getElementById('semestreMaestria');
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    semestres.Id_semestre, 
                    semestres.Semestre
                FROM
                    semestres
                WHERE
                    semestres.Maestria = 1
                ORDER BY
                    semestres.Id_semestre
            `);
            
            semestreSelect.innerHTML = '<option value="">Seleccione...</option>';
            result.forEach(sem => {
                const option = document.createElement('option');
                option.value = sem.Id_semestre;
                option.textContent = sem.Semestre;
                semestreSelect.appendChild(option);
            });
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar semestres de maestría:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los semestres de maestría'
            });
        }
    }
    async function cargarUniversidades() {
        const universidadSelect = document.getElementById('universidad');
        const maestriaUniversidadSelect = document.getElementById('maestriaUniversidad');
        
        try {
            const connection = await getConnection();
            const result = await connection.query(`
                SELECT
                    Universidades.IdUniversidad, 
                    Universidades.NombreUniversidad
                FROM
                    Universidades
                ORDER BY
                    Universidades.NombreUniversidad
            `);
            
            // Preparar el HTML para las opciones
            const optionsHTML = '<option value="">Seleccione...</option>' +
                result.map(univ => `<option value="${univ.IdUniversidad}">${univ.NombreUniversidad}</option>`).join('');
            
            // Actualizar ambos selectores si existen
            if (universidadSelect) {
                universidadSelect.innerHTML = optionsHTML;
            }
            if (maestriaUniversidadSelect) {
                maestriaUniversidadSelect.innerHTML = optionsHTML;
            }
            
            await connection.close();
        } catch (error) {
            console.error('Error al cargar universidades:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar las universidades'
            });
        }
    }
    // Función para calcular el promedio PMA
    function calcularPromedioPMA() {
        const factores = ['V', 'E', 'R', 'N', 'F'];
        let suma = 0;
        let valoresValidos = 0;

        factores.forEach(factor => {
            const valor = parseFloat(document.getElementById(`factor${factor}`).value);
            if (!isNaN(valor)) {
                suma += valor;
                valoresValidos++;
            }
        });

        const promedio = valoresValidos > 0 ? (suma / valoresValidos).toFixed(2) : '';
        document.getElementById('promedioPMA').value = promedio;
    }

    // Validación del formulario PMA
    function validatePMAForm() {
        let isValid = true;
        const fechaPMA = document.getElementById('fechaPMA').value;
        const factores = ['V', 'E', 'R', 'N', 'F'];

        // Validar fecha
        if (!fechaPMA) {
            isValid = false;
        }

        // Validar factores
        factores.forEach(factor => {
            const valor = document.getElementById(`factor${factor}`).value;
            if (!valor || valor < 0 || valor > 100) {
                isValid = false;
            }
        });

        document.getElementById('finalizarBtn').disabled = !isValid;
        return isValid;
    }

    // Event listeners para factores PMA
    ['V', 'E', 'R', 'N', 'F'].forEach(factor => {
        document.getElementById(`factor${factor}`).addEventListener('input', function() {
            // Limitar el valor entre 0 y 100
            if (this.value > 100) this.value = 100;
            if (this.value < 0) this.value = 0;
            
            calcularPromedioPMA();
            validatePMAForm();
        });
    });
    async function guardarDatosPersonales() {
        let connection;
        try {
            connection = await getConnection();
            const tipoPersonalMap = {
                'fijo': '1',
                'parcial': '2',
                'vacacionista': '3'
            };
            const estadoAcademicoMap = {
                'completado': '1',
                'incompleto': '2',
                'cursando': '3',
                'nocurso': '4'
            };
            // Obtener tipo de personal seleccionado y convertirlo al valor numérico correspondiente
            const tipoPersonalCheckbox = Array.from(document.querySelectorAll('input[name="tipoPersonal"]'))
                .find(checkbox => checkbox.checked);
            const tipoPersonal = tipoPersonalCheckbox ? tipoPersonalMap[tipoPersonalCheckbox.value] : null;
    
            if (!tipoPersonal) {
                throw new Error('Debe seleccionar un tipo de personal');
            }
            // Obtener valores de los campos
            const primerNombre = document.getElementById('primerNombre').value;
            const segundoNombre = document.getElementById('segundoNombre').value;
            const tercerNombre = document.getElementById('tercerNombre')?.value || null;
            const primerApellido = document.getElementById('primerApellido').value;
            const segundoApellido = document.getElementById('segundoApellido').value;
            const dpi = document.getElementById('dpi').value;
            const fechaNacimiento = document.getElementById('fechaNacimiento').value;
            const departamentoOrigen = document.getElementById('departamentoOrigen').value;
            const municipioOrigen = document.getElementById('municipioOrigen').value;
            const estadoCivil = document.getElementById('estadoCivil').value;
            const tipoSangre = document.getElementById('tipoSangre').value;
            const sexo = document.getElementById('sexo').value;
            // Obtener cantidad de hijos si tiene
            const tieneHijos = document.querySelector('input[name="tieneHijos"]:checked')?.value === 'si';
            const cantidadHijos = tieneHijos ? document.getElementById('cantidadHijos').value : null;
            const direccionResidencia = document.getElementById('direccionResidencia').value;
            const departamentoResidencia = document.getElementById('departamentoResidencia').value;
            const municipioResidencia = document.getElementById('municipioResidencia').value;
            const telefono1 = document.getElementById('telefono1').value;
            const telefono2 = document.getElementById('telefono2').value || null; // opcional
            const correoElectronico = document.getElementById('correoElectronico').value;
            const nombreContactoEmergencia = document.getElementById('nombreEmergencia').value;
            const telefonoContactoEmergencia = document.getElementById('telefonoEmergencia').value;
            const idParentesco = document.getElementById('parentescoEmergencia').value;
            const idSucursalDepto = document.getElementById('sucursal').value; // Este es el IdDepartamento seleccionado
            const idPuesto = document.getElementById('puesto').value;
            const inicioLaboral = document.getElementById('inicioLaboral').value;
            const divisionId = parseInt(document.getElementById('division').value);
            let tipoUniforme = '0';
            let talla = null;
            
            if (divisionId === 1 || divisionId === 2) {
                tipoUniforme = '1'; // Chaleco
                talla = document.getElementById('talla_chaleco').value;
            } else if (divisionId === 3 || divisionId === 4) {
                tipoUniforme = '2'; // Calzado
                talla = document.getElementById('talla_calzado').value;
            }
            const estadoPrimariaRadio = document.querySelector('input[name="primaria"]:checked');
            const estadoPrimaria = estadoPrimariaRadio ? estadoAcademicoMap[estadoPrimariaRadio.value] : '4';
            const idNivelPrimaria = document.getElementById('semestrePrimaria').value || null;
            const idPlanPrimaria = document.getElementById('planEstudioPrimaria').value || null;

            // Obtener estado de básico
            const estadoBasicoRadio = document.querySelector('input[name="basico"]:checked');
            const estadoBasico = estadoBasicoRadio ? estadoAcademicoMap[estadoBasicoRadio.value] : '4';
            const idNivelBasico = document.getElementById('semestreBasico').value || null;
            const idPlanBasico = document.getElementById('planEstudioBasico').value || null;

            // Obtener estado de diversificado
            const estadoDiversificadoRadio = document.querySelector('input[name="diversificado"]:checked');
            const estadoDiversificado = estadoDiversificadoRadio ? estadoAcademicoMap[estadoDiversificadoRadio.value] : '4';
            const idCarreraDiversificado = document.getElementById('carreraDiversificadoSelect').value || null;
            const idNivelDiversificado = document.getElementById('semestreDiversificado').value || null;
            const idPlanDiversificado = document.getElementById('planEstudioDiversificado').value || null;

            // Variables para universidad
            let estadoUniversidad = null;
            let idCarreraUniversitaria = null;
            let idPlanUniversitario = null;
            let idUniversidad = null;
            let idNivelUniversitario = null;

            // Verificar si estudia universidad
            if (document.getElementById('estudiaUniversidad').checked) {
                const estadoUniversidadRadio = document.querySelector('input[name="universidad"]:checked');
                if (estadoUniversidadRadio) {
                    estadoUniversidad = estadoAcademicoMap[estadoUniversidadRadio.value];
                    idCarreraUniversitaria = document.getElementById('carreraUniversitaria').value || null;
                    idPlanUniversitario = document.getElementById('planEstudioUniversitario').value || null;
                    idUniversidad = document.getElementById('universidad').value || null;
                    idNivelUniversitario = document.getElementById('semestreUniversitario').value || null;
                }
            }

            // Variables para maestría
            let estadoMaestria = null;
            let idMaestria = null;
            let idUniversidadMaestria = null;
            let idPlanEstudioMaestria = null;
            let idNivelMaestria = null;

            // Verificar si estudia maestría
            if (document.getElementById('estudiaMaestria').checked) {
                const estadoMaestriaRadio = document.querySelector('input[name="maestria"]:checked');
                if (estadoMaestriaRadio) {
                    estadoMaestria = estadoAcademicoMap[estadoMaestriaRadio.value];
                    idMaestria = document.getElementById('maestriaCarrera').value || null;
                    idUniversidadMaestria = document.getElementById('maestriaUniversidad').value || null;
                    idPlanEstudioMaestria = document.getElementById('planEstudioMaestria').value || null;
                    idNivelMaestria = document.getElementById('semestreMaestria').value || null;
                }
            }
            const tieneRTU = document.getElementById('tieneRTU').checked;
            const nit = tieneRTU ? document.getElementById('nit').value : null;

            // Obtener datos de licencia
            const sabeManejar = document.querySelector('input[name="sabeManejar"]:checked').value === 'si';
            const idLicencia = sabeManejar ? document.getElementById('tipoLicencia').value : null;

            // Obtener fechas de vencimiento de tarjetas (ahora pueden ser nulas)
            const fechaVencimientoTS = document.getElementById('vencimientoTarjetaSalud').value || null;
            const fechaVencimientoTM = document.getElementById('vencimientoTarjetaManipulacion').value || null;
            const factorV = document.getElementById('factorV').value;
            const factorR = document.getElementById('factorR').value;
            const factorE = document.getElementById('factorE').value;
            const factorN = document.getElementById('factorN').value;
            const factorF = document.getElementById('factorF').value;
            const fechaEvaluacion = document.getElementById('fechaPMA').value;
            // Primero insertar en la tabla personal
            await connection.query(`
                INSERT INTO personal (
                    TipoPersonal,
                    PrimerNombre, 
                    SegundoNombre, 
                    TercerNombre, 
                    PrimerApellido, 
                    SegundoApellido, 
                    DPI,
                    FechaNacimiento,
                    IdDepartamentoOrigen,
                    IdMunicipioOrigen,
                    IdEstadoCivil,
                    IdTipoSangre,
                    Sexo,
                    Hijos,
                    DireccionRecidencia,
                    IdDepartamentoG,
                    IdMunicipioG,
                    Telefono1,
                    Telefono2,
                    CorreoElectronico,
                    NombreContactoEmergencia,
                    TelefonoContactoEmergencia,
                    IdParentesco,
                    IdSucuDepa,
                    IdPuesto,
                    InicioLaboral,
                    TipoUniforme,
                    Talla,
                    NIT,
                    IdLicencia,
                    FechaVencimientoTS,
                    FechaVencimientoTM,
                    IdUsuario
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                tipoPersonal,
                primerNombre, 
                segundoNombre, 
                tercerNombre, 
                primerApellido, 
                segundoApellido, 
                dpi,
                fechaNacimiento,
                departamentoOrigen,    // Ya tenemos el IdDepartamentoG del select
                municipioOrigen,       // Ya tenemos el IdMunicipio del select
                estadoCivil,          // Ya tenemos el IdCivil del select
                tipoSangre,           // Ya tenemos el IdSangre del select
                sexo,
                cantidadHijos,
                direccionResidencia,
                departamentoResidencia,
                municipioResidencia,
                telefono1,
                telefono2,
                correoElectronico,
                nombreContactoEmergencia,
                telefonoContactoEmergencia,
                idParentesco,
                idSucursalDepto,
                idPuesto,
                inicioLaboral,
                tipoUniforme,
                talla,
                nit,
                idLicencia,
                fechaVencimientoTS,
                fechaVencimientoTM,
                IdUsuario
            ]);
    
            // Obtener el ID del registro insertado
            const idResult = await connection.query('SELECT @@IDENTITY AS id');
            const idPersonal = idResult[0].id;
    
            if (!idPersonal) {
                throw new Error('No se pudo obtener el ID después de la inserción');
            }
            await connection.query(`
                INSERT INTO InfoAcademica (
                    IdPersonal,
                    EstadoPrimaria,
                    IdNivelAcademicoPrimaria,
                    IdPlanEstudioPrimaria,
                    EstadoBasico,
                    IdNivelAcademicoBasico,
                    IdPlanEstudioBasico,
                    EstadoDiversificado,
                    IdCarreraDiversificado,
                    IdNivelAcademicoDiversificado,
                    IdPlanEstudioDiversificado,
                    EstadoUniversidad,
                    IdCarreraUniversitaria,
                    IdPlanEstudioUniversitario,
                    IdUniversidad,
                    IdNivelAcademicoUnivesitario,
                    EstadoMaestria,
                    IdMaestria,
                    IdUniversidadMaestria,
                    IdPlanEstudio,
                    IdNivelAcademicoMaestria
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                idPersonal,
                estadoPrimaria,
                idNivelPrimaria,
                idPlanPrimaria,
                estadoBasico,
                idNivelBasico,
                idPlanBasico,
                estadoDiversificado,
                idCarreraDiversificado,
                idNivelDiversificado,
                idPlanDiversificado,
                estadoUniversidad,
                idCarreraUniversitaria,
                idPlanUniversitario,
                idUniversidad,
                idNivelUniversitario,
                estadoMaestria,
                idMaestria,
                idUniversidadMaestria,
                idPlanEstudioMaestria,
                idNivelMaestria
            ]);
            await connection.query(`
                INSERT INTO ResultadosPMA (
                    IdPersonal,
                    FactorV,
                    FactorR,
                    FactorE,
                    FactorN,
                    FactorF,
                    FechaEvaluacion
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                idPersonal,
                factorV,
                factorR,
                factorE,
                factorN,
                factorF,
                fechaEvaluacion
            ]);
            // Guardar la foto
            const photoInput = document.getElementById('photo');
            if (photoInput.files[0]) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = async function(e) {
                        try {
                            // Convertir la imagen a Buffer
                            const photoBuffer = Buffer.from(e.target.result);
                            
                            // Insertar la foto en la tabla FotosPersonal
                            await connection.query(`
                                INSERT INTO FotosPersonal (IdPersonal, Foto)
                                VALUES (?, ?)
                            `, [idPersonal, photoBuffer]);
    
                            await connection.close();
                            resolve(idPersonal);
                        } catch (error) {
                            reject(error);
                        }
                    };
                    reader.onerror = () => reject(new Error('Error al leer el archivo de foto'));
                    reader.readAsArrayBuffer(photoInput.files[0]);
                });
            }
    
            await connection.close();
            return idPersonal;
    
        } catch (error) {
            if (connection) {
                try {
                    await connection.close();
                } catch (closeError) {
                    console.error('Error al cerrar la conexión:', closeError);
                }
            }
            throw new Error(`Error al guardar datos: ${error.message}`);
        }
    }
    // Event listener para fecha PMA
    document.getElementById('fechaPMA').addEventListener('change', validatePMAForm);
    // Event listeners para validación de campos académicos
    document.getElementById('semestrePrimaria')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('semestreBasico')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('semestreDiversificado')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('carreraDiversificadoSelect')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('semestreUniversitario')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('semestreMaestria')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('planEstudioPrimaria')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('planEstudioBasico')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('planEstudioDiversificado')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('planEstudioUniversitario')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('planEstudioMaestria')?.addEventListener('change', validateAcademicoForm);
    document.getElementById('estudiaUniversidad').addEventListener('change', validateAcademicoForm);
    document.getElementById('estudiaMaestria').addEventListener('change', validateAcademicoForm);
    document.getElementById('carreraUniversitaria').addEventListener('change', validateAcademicoForm);
    document.getElementById('universidad').addEventListener('change', validateAcademicoForm);
    document.getElementById('maestriaCarrera').addEventListener('change', validateAcademicoForm);
    document.getElementById('maestriaUniversidad').addEventListener('change', validateAcademicoForm);
    document.getElementById('nit').addEventListener('input', validateDocumentacionForm);
    document.getElementById('tipoLicencia').addEventListener('change', validateDocumentacionForm);
    document.querySelectorAll('input[name="tienePorteArma"]').forEach(radio => {
        radio.addEventListener('change', validateDocumentacionForm);
    });
});