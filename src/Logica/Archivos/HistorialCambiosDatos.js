// HistorialCambiosDatos.js
const { connectionString } = require('../Conexion/Conexion');
const ExcelJS = require('exceljs');
const Swal = require('sweetalert2');

// Variables globales
let todosLosDatos = [];
let datosFiltrados = [];
let sortColumn = null;
let sortDirection = 'asc';
let listaPersonal = [];
let selectedPersonalIndex = -1;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    inicializarEventos();
    configurarFechasFiltro();
    cargarListaPersonal();
});

// Configurar eventos
function inicializarEventos() {
    // Botones de acción
    document.getElementById('btnBuscar').addEventListener('click', buscarDatos);
    document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);
    document.getElementById('btnRefresh').addEventListener('click', () => {
        limpiarFiltros();
        cargarTodosDatos();
    });

    // Enter en campos de búsqueda
    document.getElementById('searchNombre').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarDatos();
    });

    document.getElementById('fechaInicio').addEventListener('change', validarRangoFechas);
    document.getElementById('fechaFin').addEventListener('change', validarRangoFechas);

    // Ordenamiento de columnas
    inicializarOrdenamiento();

    // Autocompletado
    inicializarAutocompletado();
}

// Inicializar autocompletado
function inicializarAutocompletado() {
    const searchInput = document.getElementById('searchNombre');
    const autocompleteList = document.getElementById('autocompleteList');
    const btnClearSearch = document.getElementById('btnClearSearch');

    // Búsqueda mientras escribe
    searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.trim();

        // Mostrar/ocultar botón de limpiar
        if (searchText.length > 0) {
            btnClearSearch.style.display = 'flex';
        } else {
            btnClearSearch.style.display = 'none';
        }

        if (searchText.length < 2) {
            ocultarAutocompletado();
            return;
        }

        mostrarSugerencias(searchText);
    });

    // Botón limpiar búsqueda
    btnClearSearch.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        limpiarBusqueda();
    });

    // Navegación con teclado
    searchInput.addEventListener('keydown', (e) => {
        const items = autocompleteList.querySelectorAll('.autocomplete-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedPersonalIndex = Math.min(selectedPersonalIndex + 1, items.length - 1);
            actualizarSeleccion(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedPersonalIndex = Math.max(selectedPersonalIndex - 1, -1);
            actualizarSeleccion(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedPersonalIndex >= 0 && items[selectedPersonalIndex]) {
                seleccionarPersonal(
                    items[selectedPersonalIndex].dataset.id,
                    items[selectedPersonalIndex].dataset.nombre
                );
            }
        } else if (e.key === 'Escape') {
            ocultarAutocompletado();
        }
    });

    // Cerrar al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            ocultarAutocompletado();
        }
    });
}

// Cargar lista de personal única
async function cargarListaPersonal() {
    try {
        const connection = await connectionString();
        const query = `
            SELECT DISTINCT
                IdPersonal,
                NombrePersonal
            FROM
                CambiosPersonal
            ORDER BY
                NombrePersonal ASC
        `;

        const resultado = await connection.query(query);
        await connection.close();

        // Eliminar duplicados por IdPersonal (en caso de que DISTINCT no funcione correctamente)
        const personalUnico = [];
        const idsVistos = new Set();

        resultado.forEach(persona => {
            if (!idsVistos.has(persona.IdPersonal)) {
                idsVistos.add(persona.IdPersonal);
                personalUnico.push(persona);
            }
        });

        listaPersonal = personalUnico;

    } catch (error) {
        console.error('Error al cargar lista de personal:', error);
    }
}

// Mostrar sugerencias de autocompletado
function mostrarSugerencias(searchText) {
    const autocompleteList = document.getElementById('autocompleteList');

    // Filtrar personal que coincida
    const coincidencias = listaPersonal.filter(persona =>
        busquedaInteligente(persona.NombrePersonal, searchText)
    ).slice(0, 10); // Máximo 10 sugerencias

    // Limpiar lista
    autocompleteList.innerHTML = '';
    selectedPersonalIndex = -1;

    if (coincidencias.length === 0) {
        autocompleteList.innerHTML = `
            <div class="autocomplete-empty">
                <i class="fas fa-user-slash"></i> No se encontraron coincidencias
            </div>
        `;
        autocompleteList.classList.add('show');
        return;
    }

    // Crear items
    coincidencias.forEach((persona, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.dataset.id = persona.IdPersonal;
        item.dataset.nombre = persona.NombrePersonal;
        item.dataset.index = index;

        item.innerHTML = `
            <span class="autocomplete-item-name">${persona.NombrePersonal}</span>
            <span class="autocomplete-item-id">ID: ${persona.IdPersonal}</span>
        `;

        item.addEventListener('click', () => {
            seleccionarPersonal(persona.IdPersonal, persona.NombrePersonal);
        });

        autocompleteList.appendChild(item);
    });

    autocompleteList.classList.add('show');
}

// Actualizar selección visual
function actualizarSeleccion(items) {
    items.forEach((item, index) => {
        if (index === selectedPersonalIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

// Seleccionar personal del autocompletado
function seleccionarPersonal(idPersonal, nombrePersonal) {
    document.getElementById('searchNombre').value = nombrePersonal;
    document.getElementById('selectedPersonalId').value = idPersonal;
    ocultarAutocompletado();

    // Auto-buscar
    buscarDatos();
}

// Ocultar autocompletado
function ocultarAutocompletado() {
    const autocompleteList = document.getElementById('autocompleteList');
    autocompleteList.classList.remove('show');
    autocompleteList.innerHTML = '';
    selectedPersonalIndex = -1;
}

// Limpiar búsqueda de personal
function limpiarBusqueda() {
    document.getElementById('searchNombre').value = '';
    document.getElementById('selectedPersonalId').value = '';
    document.getElementById('btnClearSearch').style.display = 'none';
    ocultarAutocompletado();

    // Si hay datos cargados, limpiarlos
    if (todosLosDatos.length > 0 || datosFiltrados.length > 0) {
        todosLosDatos = [];
        datosFiltrados = [];
        document.getElementById('tableBody').innerHTML = '';
        document.getElementById('noData').style.display = 'flex';
        document.getElementById('resultCount').innerHTML = '<i class="fas fa-list"></i> 0 registros encontrados';
    }

    // Enfocar el input
    document.getElementById('searchNombre').focus();
}

// Inicializar eventos de ordenamiento
function inicializarOrdenamiento() {
    const headers = document.querySelectorAll('.data-table thead th[data-column]');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');
            const type = header.getAttribute('data-type');
            ordenarTabla(column, type, header);
        });
    });
}

// Ordenar tabla
function ordenarTabla(column, type, headerElement) {
    // Determinar dirección
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }

    // Actualizar iconos de todas las columnas
    document.querySelectorAll('.data-table thead th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const sortIcon = th.querySelector('.sort-icon');
        if (sortIcon) {
            sortIcon.className = 'fas fa-sort sort-icon';
        }
    });

    // Actualizar icono de la columna actual
    headerElement.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    const sortIcon = headerElement.querySelector('.sort-icon');
    if (sortIcon) {
        sortIcon.className = sortDirection === 'asc'
            ? 'fas fa-sort-up sort-icon'
            : 'fas fa-sort-down sort-icon';
    }

    // Ordenar datos
    datosFiltrados.sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];

        // Manejar valores nulos o vacíos
        if (!valueA && !valueB) return 0;
        if (!valueA) return sortDirection === 'asc' ? 1 : -1;
        if (!valueB) return sortDirection === 'asc' ? -1 : 1;

        // Comparar según tipo
        if (type === 'number') {
            valueA = parseFloat(valueA) || 0;
            valueB = parseFloat(valueB) || 0;
        } else if (type === 'date') {
            valueA = new Date(valueA).getTime();
            valueB = new Date(valueB).getTime();
        } else {
            // String - normalizar para comparación
            valueA = normalizarTexto(valueA.toString());
            valueB = normalizarTexto(valueB.toString());
        }

        // Comparar
        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Mostrar datos ordenados
    mostrarDatos(datosFiltrados);
}

// Configurar fechas por defecto (último mes)
function configurarFechasFiltro() {
    const hoy = new Date();
    const haceUnMes = new Date();
    haceUnMes.setMonth(haceUnMes.getMonth() - 1);
    
    document.getElementById('fechaFin').valueAsDate = hoy;
    document.getElementById('fechaInicio').valueAsDate = haceUnMes;
}

// Validar rango de fechas
function validarRangoFechas() {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
        Swal.fire({
            icon: 'warning',
            title: 'Rango de fechas inválido',
            text: 'La fecha de inicio no puede ser mayor que la fecha fin',
            confirmButtonColor: '#FF9800'
        });
        document.getElementById('fechaInicio').value = '';
    }
}

// Búsqueda inteligente - normalizar texto
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
        .replace(/\s+/g, ' ') // Normalizar espacios
        .trim();
}

// Búsqueda fuzzy/inteligente mejorada
function busquedaInteligente(textoCompleto, textoBusqueda) {
    const textoNormalizado = normalizarTexto(textoCompleto);
    const busquedaNormalizada = normalizarTexto(textoBusqueda);
    
    // Si está vacío, retorna true
    if (!busquedaNormalizada) return true;
    
    // Búsqueda exacta
    if (textoNormalizado.includes(busquedaNormalizada)) return true;
    
    // Separar por espacios y buscar cada palabra
    const palabrasBusqueda = busquedaNormalizada.split(' ').filter(p => p.length > 0);
    const palabrasTexto = textoNormalizado.split(' ');
    
    // Verificar si todas las palabras de búsqueda coinciden con el inicio de alguna palabra del texto
    const todasCoinciden = palabrasBusqueda.every(palabraBusqueda => {
        return palabrasTexto.some(palabraTexto => 
            palabraTexto.startsWith(palabraBusqueda)
        );
    });
    
    if (todasCoinciden) return true;
    
    // Búsqueda por iniciales (ej: "jp" coincide con "Juan Perez")
    const inicialesTexto = palabrasTexto.map(p => p[0]).join('');
    if (inicialesTexto.includes(busquedaNormalizada.replace(/\s/g, ''))) return true;
    
    // Búsqueda flexible - permitir caracteres faltantes
    let indiceTexto = 0;
    for (let char of busquedaNormalizada) {
        if (char === ' ') continue;
        indiceTexto = textoNormalizado.indexOf(char, indiceTexto);
        if (indiceTexto === -1) return false;
        indiceTexto++;
    }
    
    return true;
}

// Cargar todos los datos
async function cargarTodosDatos() {
    mostrarLoading(true);
    
    try {
        const connection = await connectionString();
        const query = `
            SELECT
                CambiosPersonal.IdPersonal, 
                CambiosPersonal.NombrePersonal, 
                CambiosPersonal.Cambio, 
                CambiosPersonal.ValorAnterior, 
                CambiosPersonal.ValorNuevo, 
                CambiosPersonal.NombreUsuario, 
                CambiosPersonal.FechaHoraCambio, 
                CambiosPersonal.FechaCambio
            FROM
                CambiosPersonal
            ORDER BY
                CambiosPersonal.FechaHoraCambio DESC
        `;
        
        const resultado = await connection.query(query);
        await connection.close();
        
        todosLosDatos = resultado;
        aplicarFiltros();
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        mostrarLoading(false);
        Swal.fire({
            icon: 'error',
            title: 'Error al cargar datos',
            text: 'No se pudieron cargar los registros de cambios. Por favor, intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Buscar datos con filtros
async function buscarDatos() {
    const selectedPersonalId = document.getElementById('selectedPersonalId').value;
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;

    // Si no hay filtros, cargar todo
    if (!selectedPersonalId && !fechaInicio && !fechaFin) {
        await cargarTodosDatos();
        return;
    }

    mostrarLoading(true);

    try {
        const connection = await connectionString();

        // Construir query dinámicamente
        let query = `
            SELECT
                CambiosPersonal.IdPersonal,
                CambiosPersonal.NombrePersonal,
                CambiosPersonal.Cambio,
                CambiosPersonal.ValorAnterior,
                CambiosPersonal.ValorNuevo,
                CambiosPersonal.NombreUsuario,
                CambiosPersonal.FechaHoraCambio,
                CambiosPersonal.FechaCambio
            FROM
                CambiosPersonal
            WHERE 1=1
        `;

        const params = [];

        // Filtro por ID de personal (búsqueda exacta)
        if (selectedPersonalId) {
            query += ` AND CambiosPersonal.IdPersonal = ?`;
            params.push(selectedPersonalId);
        }

        // Filtro por fecha
        if (fechaInicio) {
            query += ` AND CambiosPersonal.FechaCambio >= ?`;
            params.push(fechaInicio);
        }

        if (fechaFin) {
            query += ` AND CambiosPersonal.FechaCambio <= ?`;
            params.push(fechaFin);
        }

        query += ` ORDER BY CambiosPersonal.FechaHoraCambio DESC`;

        const resultado = await connection.query(query, params);
        await connection.close();

        todosLosDatos = resultado;
        datosFiltrados = [...todosLosDatos];

        mostrarDatos(datosFiltrados);

    } catch (error) {
        console.error('Error al buscar datos:', error);
        mostrarLoading(false);
        Swal.fire({
            icon: 'error',
            title: 'Error en la búsqueda',
            text: 'No se pudo completar la búsqueda. Por favor, intente nuevamente.',
            confirmButtonColor: '#FF9800'
        });
    }
}

// Aplicar filtros a los datos cargados
function aplicarFiltros() {
    const searchNombre = document.getElementById('searchNombre').value.trim();
    
    if (!searchNombre) {
        datosFiltrados = [...todosLosDatos];
    } else {
        datosFiltrados = todosLosDatos.filter(registro => 
            busquedaInteligente(registro.NombrePersonal, searchNombre)
        );
    }
    
    mostrarDatos(datosFiltrados);
}

// Mostrar datos en la tabla
function mostrarDatos(datos) {
    mostrarLoading(false);
    
    const tableBody = document.getElementById('tableBody');
    const noData = document.getElementById('noData');
    const resultCount = document.getElementById('resultCount');
    
    // Limpiar tabla
    tableBody.innerHTML = '';
    
    if (datos.length === 0) {
        noData.style.display = 'flex';
        resultCount.innerHTML = '<i class="fas fa-list"></i> 0 registros encontrados';
        return;
    }
    
    noData.style.display = 'none';
    resultCount.innerHTML = `<i class="fas fa-list"></i> ${datos.length} registro${datos.length !== 1 ? 's' : ''} encontrado${datos.length !== 1 ? 's' : ''}`;
    
    // Llenar tabla
    datos.forEach((registro, index) => {
        const row = document.createElement('tr');
        row.classList.add('new-row');
        
        // Formatear fecha y hora
        const fechaHora = formatearFechaHora(registro.FechaHoraCambio);
        
        row.innerHTML = `
            <td>${registro.IdPersonal}</td>
            <td><strong>${registro.NombrePersonal}</strong></td>
            <td><span style="background: #E3F2FD; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem;">${registro.Cambio}</span></td>
            <td>${registro.ValorAnterior || '<em style="color: #999;">Sin valor</em>'}</td>
            <td><strong>${registro.ValorNuevo}</strong></td>
            <td><i class="fas fa-user" style="color: #FF9800; margin-right: 5px;"></i>${registro.NombreUsuario}</td>
            <td><i class="fas fa-clock" style="margin-right: 5px;"></i>${fechaHora}</td>
        `;
        
        tableBody.appendChild(row);
        
        // Remover clase de animación después de ejecutarse
        setTimeout(() => {
            row.classList.remove('new-row');
        }, 1000);
    });
}

// Formatear fecha y hora
function formatearFechaHora(fechaHora) {
    if (!fechaHora) return 'N/A';
    
    const fecha = new Date(fechaHora);
    
    const opciones = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    
    return fecha.toLocaleString('es-GT', opciones);
}

// Limpiar filtros
function limpiarFiltros() {
    document.getElementById('searchNombre').value = '';
    document.getElementById('selectedPersonalId').value = '';
    document.getElementById('fechaInicio').value = '';
    document.getElementById('fechaFin').value = '';

    ocultarAutocompletado();

    todosLosDatos = [];
    datosFiltrados = [];

    document.getElementById('tableBody').innerHTML = '';
    document.getElementById('noData').style.display = 'flex';
    document.getElementById('resultCount').innerHTML = '<i class="fas fa-list"></i> 0 registros encontrados';

}

// Mostrar/ocultar loading
function mostrarLoading(mostrar) {
    const loading = document.getElementById('loading');
    const noData = document.getElementById('noData');
    const tableBody = document.getElementById('tableBody');
    
    if (mostrar) {
        loading.style.display = 'flex';
        noData.style.display = 'none';
        tableBody.innerHTML = '';
    } else {
        loading.style.display = 'none';
    }
}

// Volver al menú
function volverMenu() {
    Swal.fire({
        title: '¿Desea salir?',
        text: 'Regresará al menú principal',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#FF9800',
        cancelButtonColor: '#757575',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = path.join(__dirname, 'Menu.html');
        }
    });
}

// Manejo de errores globales
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
});