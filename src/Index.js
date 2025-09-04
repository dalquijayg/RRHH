const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

log.transports.file.resolvePathFn = () => path.join('C:/Users/USUARIO/Desktop/Cuadre y Gestion', 'logs/main.log');
log.log("Version de la App " + app.getVersion());

let mainWindow;
let personalNuevoWindow = null;
let busquedaWindow = null;
let planillaDominicalWindow = null;
let actualizarDepartamentoWindow = null;
let pagoNominaWindow = null;
let embargoSalarialWindow = null;
let reportesuspensionesWindow = null;
let reporteDescJudiciales = null;
let reportePlanillaEspecialWindow = null;
let AsignarPermisos = null;
let VacacionesWindow = null;
let PagoVacacionesWindow = null;
let GestionarVacacionesWindow = null;
let GestionarPagoVacacionesWindow = null;
let EstadoPagosVacacionesWindow = null;
let PagosBonisWindow = null;
let BajasWindow = null;
let LiquidaciónWindow = null;
let ReportePlanillaContableWindow = null;
let GestionDocumentosPersonalesWindow = null;
let ConsultarArchivosWindow = null;
let PagoPlanillaTiempoParcialWindow = null;
let AutorizarPagoPlanillasWindow = null;
let AutorizarLiquidacionesWindow = null;
let ReporteDiasDisponiblesVacacionesWindow = null;
let DocumentosWindow = null;
let ModificacionesPagosNominaWindow = null;

// Variables para control de actualizaciones
let updateRequired = false;
let updateCheckInProgress = false;

// Configuración del entorno de desarrollo
if (process.env.NODE_ENV !== 'production') {
    require('electron-reload')(__dirname, {});
}

// Configurar auto-updater con logging mejorado
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

function createWindow() {
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        autoHideMenuBar: true
    });

    mainWindow.maximize();
    mainWindow.loadURL(`file://${__dirname}/Vistas/Login.html`);

    mainWindow.webContents.once('dom-ready', () => {
        // Solo verificar actualizaciones en producción
        if (process.env.NODE_ENV === 'production') {
            log.info('Verificando actualizaciones al iniciar...');
            autoUpdater.checkForUpdatesAndNotify();
        }
    });

    // Configurar eventos del auto-updater
    setupAutoUpdaterEvents();

    // Prevenir cierre durante actualizaciones obligatorias
    mainWindow.on('close', (event) => {
        if (updateRequired || updateCheckInProgress) {
            event.preventDefault();
            log.warn('Intento de cierre bloqueado - actualización en progreso');
            
            dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Actualización en Progreso',
                message: 'No se puede cerrar la aplicación durante una actualización obligatoria.',
                detail: 'Por favor espera a que se complete la actualización e instale automáticamente.',
                buttons: ['Entendido'],
                icon: path.join(__dirname, 'LogoRecursos.ico')
            });
        }
    });
}

function setupAutoUpdaterEvents() {
    // Cuando se encuentre una actualización disponible
    autoUpdater.on('update-available', (info) => {
        log.info('Actualización disponible - Versión:', info.version);
        updateRequired = true;
        updateCheckInProgress = true;
        
        // Deshabilitar el menú de la aplicación para prevenir otras acciones
        mainWindow.setMenuBarVisibility(false);
        
        // Enviar evento al renderer process
        mainWindow.webContents.send('update_available', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes
        });
        
        // Prevenir que se cierre la aplicación durante la actualización
        mainWindow.setClosable(false);
        
        log.info('Login bloqueado - actualización obligatoria iniciada');
    });

    // Cuando no hay actualizaciones disponibles
    autoUpdater.on('update-not-available', (info) => {
        log.info('No hay actualizaciones disponibles - Versión actual:', info.version);
        updateRequired = false;
        updateCheckInProgress = false;
        
        // Habilitar funcionalidades normales
        mainWindow.setClosable(true);
    });

    // Progreso de descarga
    autoUpdater.on('download-progress', (progressObj) => {
        const logMessage = `Descarga en progreso: ${Math.round(progressObj.percent)}% - Velocidad: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s`;
        log.info(logMessage);
        
        // Enviar progreso al renderer para mostrar barra de progreso
        mainWindow.webContents.send('download_progress', {
            percent: Math.round(progressObj.percent),
            transferred: progressObj.transferred,
            total: progressObj.total,
            bytesPerSecond: progressObj.bytesPerSecond
        });
    });

    // Cuando la actualización se ha descargado completamente
    autoUpdater.on('update-downloaded', (info) => {
        log.info('Actualización descargada - Lista para instalar. Versión:', info.version);
        updateCheckInProgress = false;
        
        // Enviar evento al renderer process
        mainWindow.webContents.send('update_downloaded', {
            version: info.version,
            releaseDate: info.releaseDate
        });
        
        log.info('Esperando confirmación del usuario para reiniciar...');
    });

    // Error en actualización
    autoUpdater.on('error', (error) => {
        log.error('Error en auto-updater:', error);
        updateRequired = false;
        updateCheckInProgress = false;
        
        // Habilitar cerrar la aplicación nuevamente
        mainWindow.setClosable(true);
        mainWindow.setMenuBarVisibility(true);
        
        // Enviar error al renderer
        mainWindow.webContents.send('update_error', {
            message: error.message,
            stack: error.stack
        });
        
        log.info('Login desbloqueado debido a error en actualización');
    });

    // Antes de cerrar para actualizar
    autoUpdater.on('before-quit-for-update', () => {
        log.info('Preparando cierre para instalación de actualización...');
        
        // Cerrar todas las ventanas secundarias
        closeAllSecondaryWindows();
    });
}

// Función para cerrar todas las ventanas secundarias antes de actualizar
function closeAllSecondaryWindows() {
    const windows = [
        personalNuevoWindow, busquedaWindow, planillaDominicalWindow,
        actualizarDepartamentoWindow, pagoNominaWindow, embargoSalarialWindow,
        reportesuspensionesWindow, reporteDescJudiciales, reportePlanillaEspecialWindow,
        AsignarPermisos, VacacionesWindow, PagoVacacionesWindow,
        GestionarVacacionesWindow, GestionarPagoVacacionesWindow,
        EstadoPagosVacacionesWindow, PagosBonisWindow, BajasWindow,
        LiquidaciónWindow, ReportePlanillaContableWindow,
        GestionDocumentosPersonalesWindow, ConsultarArchivosWindow,
        PagoPlanillaTiempoParcialWindow, AutorizarPagoPlanillasWindow,
        AutorizarLiquidacionesWindow, ReporteDiasDisponiblesVacacionesWindow,
        DocumentosWindow, ModificacionesPagosNominaWindow
    ];

    windows.forEach(window => {
        if (window && !window.isDestroyed()) {
            try {
                window.close();
            } catch (error) {
                log.error('Error cerrando ventana:', error);
            }
        }
    });
}

// Función auxiliar para verificar si se puede abrir ventanas
function canOpenWindow() {
    if (updateRequired || updateCheckInProgress) {
        dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Funcionalidad Bloqueada',
            message: 'Esta función no está disponible durante una actualización obligatoria.',
            detail: 'Por favor espera a que se complete la actualización.',
            buttons: ['Entendido'],
            icon: path.join(__dirname, 'LogoRecursos.ico')
        });
        return false;
    }
    return true;
}

function createPersonalNuevoWindow() {
    if (!canOpenWindow()) return;
    
    if (personalNuevoWindow) {
        if (personalNuevoWindow.isMinimized()) personalNuevoWindow.restore();
        personalNuevoWindow.focus();
        return;
    }
    
    personalNuevoWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Registro de Personal Nuevo',
        autoHideMenuBar: true
    });

    personalNuevoWindow.loadURL(`file://${__dirname}/Vistas/PersonalNuevo.html`);
    
    personalNuevoWindow.on('closed', () => {
        personalNuevoWindow = null;
    });
}

function createBusquedaWindow() {
    if (!canOpenWindow()) return;
    
    if (busquedaWindow) {
        if (busquedaWindow.isMinimized()) busquedaWindow.restore();
        busquedaWindow.focus();
        return;
    }
    
    busquedaWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Búsqueda de Personal',
        autoHideMenuBar: true
    });

    busquedaWindow.loadURL(`file://${__dirname}/Vistas/BusquedaP.html`);
    
    busquedaWindow.on('closed', () => {
        busquedaWindow = null;
    });
}

function createPlanillaDominicalWindow() {
    if (!canOpenWindow()) return;
    
    if (planillaDominicalWindow) {
        if (planillaDominicalWindow.isMinimized()) planillaDominicalWindow.restore();
        planillaDominicalWindow.focus();
        return;
    }
    
    planillaDominicalWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Planilla Dominical',
        autoHideMenuBar: true
    });

    planillaDominicalWindow.loadURL(`file://${__dirname}/Vistas/PlanillaEspecial.html`);
    
    planillaDominicalWindow.on('closed', () => {
        planillaDominicalWindow = null;
    });
}

function createActualizarDepartamentoWindow() {
    if (!canOpenWindow()) return;
    
    if (actualizarDepartamentoWindow) {
        if (actualizarDepartamentoWindow.isMinimized()) actualizarDepartamentoWindow.restore();
        actualizarDepartamentoWindow.focus();
        return;
    }
    
    actualizarDepartamentoWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Actualizar Departamento',
        autoHideMenuBar: true
    });

    actualizarDepartamentoWindow.loadURL(`file://${__dirname}/Vistas/ActualizarDep.html`);
    
    actualizarDepartamentoWindow.on('closed', () => {
        actualizarDepartamentoWindow = null;
    });
}

function createPagoNominaWindow() {
    if (!canOpenWindow()) return;
    
    if (pagoNominaWindow) {
        if (pagoNominaWindow.isMinimized()) pagoNominaWindow.restore();
        pagoNominaWindow.focus();
        return;
    }
    
    pagoNominaWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Pago Nómina',
        autoHideMenuBar: true
    });

    pagoNominaWindow.loadURL(`file://${__dirname}/Vistas/PagoNomina.html`);
    
    pagoNominaWindow.on('closed', () => {
        pagoNominaWindow = null;
    });
}

function createembargosalarialWindow() {
    if (!canOpenWindow()) return;
    
    if (embargoSalarialWindow) {
        if (embargoSalarialWindow.isMinimized()) embargoSalarialWindow.restore();
        embargoSalarialWindow.focus();
        return;
    }
    
    embargoSalarialWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Embargo Salarial',
        autoHideMenuBar: true
    });

    embargoSalarialWindow.loadURL(`file://${__dirname}/Vistas/IngresoDescuentoJudiciales.html`);
    
    embargoSalarialWindow.on('closed', () => {
        embargoSalarialWindow = null;
    });
}

function createReporteSuspensionesWindow() {
    if (!canOpenWindow()) return;
    
    if (reportesuspensionesWindow) {
        if (reportesuspensionesWindow.isMinimized()) reportesuspensionesWindow.restore();
        reportesuspensionesWindow.focus();
        return;
    }
    
    reportesuspensionesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Reporte',
        autoHideMenuBar: true
    });

    reportesuspensionesWindow.loadURL(`file://${__dirname}/Vistas/ReporteSuspensiones.html`);
    
    reportesuspensionesWindow.on('closed', () => {
        reportesuspensionesWindow = null;
    });
}

function createReporteDescuentosJudicialesWindow() {
    if (!canOpenWindow()) return;
    
    if (reporteDescJudiciales) {
        if (reporteDescJudiciales.isMinimized()) reporteDescJudiciales.restore();
        reporteDescJudiciales.focus();
        return;
    }
    
    reporteDescJudiciales = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Reporte',
        autoHideMenuBar: true
    });

    reporteDescJudiciales.loadURL(`file://${__dirname}/Vistas/ReporteDescuentoJudicial.html`);
    
    reporteDescJudiciales.on('closed', () => {
        reporteDescJudiciales = null;
    });
}

function createReportePlanillaEspecialWindow() {
    if (!canOpenWindow()) return;
    
    if (reportePlanillaEspecialWindow) {
        if (reportePlanillaEspecialWindow.isMinimized()) reportePlanillaEspecialWindow.restore();
        reportePlanillaEspecialWindow.focus();
        return;
    }
    
    reportePlanillaEspecialWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Reporte',
        autoHideMenuBar: true
    });

    reportePlanillaEspecialWindow.loadURL(`file://${__dirname}/Vistas/ReportePlanillaEspecial.html`);
    
    reportePlanillaEspecialWindow.on('closed', () => {
        reportePlanillaEspecialWindow = null;
    });
}

function createAsignarPermisosWindow() {
    if (!canOpenWindow()) return;
    
    if (AsignarPermisos) {
        if (AsignarPermisos.isMinimized()) AsignarPermisos.restore();
        AsignarPermisos.focus();
        return;
    }
    
    AsignarPermisos = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    AsignarPermisos.loadURL(`file://${__dirname}/Vistas/Permisos.html`);
    
    AsignarPermisos.on('closed', () => {
        AsignarPermisos = null;
    });
}

function createVacacionesWindow() {
    if (!canOpenWindow()) return;
    
    if (VacacionesWindow) {
        if (VacacionesWindow.isMinimized()) VacacionesWindow.restore();
        VacacionesWindow.focus();
        return;
    }
    
    VacacionesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    VacacionesWindow.loadURL(`file://${__dirname}/Vistas/Vacaciones.html`);
    
    VacacionesWindow.on('closed', () => {
        VacacionesWindow = null;
    });
}

function createPagoVacacionesWindow() {
    if (!canOpenWindow()) return;
    
    if (PagoVacacionesWindow) {
        if (PagoVacacionesWindow.isMinimized()) PagoVacacionesWindow.restore();
        PagoVacacionesWindow.focus();
        return;
    }
    
    PagoVacacionesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    PagoVacacionesWindow.loadURL(`file://${__dirname}/Vistas/PagoVacaciones.html`);
    
    PagoVacacionesWindow.on('closed', () => {
        PagoVacacionesWindow = null;
    });
}

function createGestionVacacionesWindow() {
    if (!canOpenWindow()) return;
    
    if (GestionarVacacionesWindow) {
        if (GestionarVacacionesWindow.isMinimized()) GestionarVacacionesWindow.restore();
        GestionarVacacionesWindow.focus();
        return;
    }
    
    GestionarVacacionesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    GestionarVacacionesWindow.loadURL(`file://${__dirname}/Vistas/VacacionesAdmin.html`);
    
    GestionarVacacionesWindow.on('closed', () => {
        GestionarVacacionesWindow = null;
    });
}

function createGestionPagoVacacionesWindow() {
    if (!canOpenWindow()) return;
    
    if (GestionarPagoVacacionesWindow) {
        if (GestionarPagoVacacionesWindow.isMinimized()) GestionarPagoVacacionesWindow.restore();
        GestionarPagoVacacionesWindow.focus();
        return;
    }
    
    GestionarPagoVacacionesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    GestionarPagoVacacionesWindow.loadURL(`file://${__dirname}/Vistas/PagoVacacionesAdmin.html`);
    
    GestionarPagoVacacionesWindow.on('closed', () => {
        GestionarPagoVacacionesWindow = null;
    });
}

function createEstadoPagosWindow() {
    if (!canOpenWindow()) return;
    
    if (EstadoPagosVacacionesWindow) {
        if (EstadoPagosVacacionesWindow.isMinimized()) EstadoPagosVacacionesWindow.restore();
        EstadoPagosVacacionesWindow.focus();
        return;
    }
    
    EstadoPagosVacacionesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    EstadoPagosVacacionesWindow.loadURL(`file://${__dirname}/Vistas/GestionPagosVacaciones.html`);
    
    EstadoPagosVacacionesWindow.on('closed', () => {
        EstadoPagosVacacionesWindow = null;
    });
}

function createPagosBonisWindow() {
    if (!canOpenWindow()) return;
    
    if (PagosBonisWindow) {
        if (PagosBonisWindow.isMinimized()) PagosBonisWindow.restore();
        PagosBonisWindow.focus();
        return;
    }
    
    PagosBonisWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    PagosBonisWindow.loadURL(`file://${__dirname}/Vistas/Bonificaciones.html`);
    
    PagosBonisWindow.on('closed', () => {
        PagosBonisWindow = null;
    });
}

function createBajasWindow() {
    if (!canOpenWindow()) return;
    
    if (BajasWindow) {
        if (BajasWindow.isMinimized()) BajasWindow.restore();
        BajasWindow.focus();
        return;
    }
    
    BajasWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    BajasWindow.loadURL(`file://${__dirname}/Vistas/ReporteBajas.html`);
    
    BajasWindow.on('closed', () => {
        BajasWindow = null;
    });
}

function createLiquidacionWindow() {
    if (!canOpenWindow()) return;
    
    if (LiquidaciónWindow) {
        if (LiquidaciónWindow.isMinimized()) LiquidaciónWindow.restore();
        LiquidaciónWindow.focus();
        return;
    }
    
    LiquidaciónWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    LiquidaciónWindow.loadURL(`file://${__dirname}/Vistas/PagoLiquidacion.html`);
    
    LiquidaciónWindow.on('closed', () => {
        LiquidaciónWindow = null;
    });
}

function createReportePlanillaContableWindow() {
    if (!canOpenWindow()) return;
    
    if (ReportePlanillaContableWindow) {
        if (ReportePlanillaContableWindow.isMinimized()) ReportePlanillaContableWindow.restore();
        ReportePlanillaContableWindow.focus();
        return;
    }
    
    ReportePlanillaContableWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    ReportePlanillaContableWindow.loadURL(`file://${__dirname}/Vistas/ReportePlanilla.html`);
    
    ReportePlanillaContableWindow.on('closed', () => {
        ReportePlanillaContableWindow = null;
    });
}

function createGestionDocPersonalesWindow() {
    if (!canOpenWindow()) return;
    
    if (GestionDocumentosPersonalesWindow) {
        if (GestionDocumentosPersonalesWindow.isMinimized()) GestionDocumentosPersonalesWindow.restore();
        GestionDocumentosPersonalesWindow.focus();
        return;
    }
    
    GestionDocumentosPersonalesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    GestionDocumentosPersonalesWindow.loadURL(`file://${__dirname}/Vistas/GestionDocumentos.html`);
    
    GestionDocumentosPersonalesWindow.on('closed', () => {
        GestionDocumentosPersonalesWindow = null;
    });
}

function createConsultarDocPersonalesWindow() {
    if (!canOpenWindow()) return;
    
    if (ConsultarArchivosWindow) {
        if (ConsultarArchivosWindow.isMinimized()) ConsultarArchivosWindow.restore();
        ConsultarArchivosWindow.focus();
        return;
    }
    
    ConsultarArchivosWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    ConsultarArchivosWindow.loadURL(`file://${__dirname}/Vistas/ConsultarArchivos.html`);
    
    ConsultarArchivosWindow.on('closed', () => {
        ConsultarArchivosWindow = null;
    });
}

function createPagoPlanillaTiempoParcialWindow() {
    if (!canOpenWindow()) return;
    
    if (PagoPlanillaTiempoParcialWindow) {
        if (PagoPlanillaTiempoParcialWindow.isMinimized()) PagoPlanillaTiempoParcialWindow.restore();
        PagoPlanillaTiempoParcialWindow.focus();
        return;
    }
    
    PagoPlanillaTiempoParcialWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    PagoPlanillaTiempoParcialWindow.loadURL(`file://${__dirname}/Vistas/PagoPlanillaTiempoParcial.html`);
    
    PagoPlanillaTiempoParcialWindow.on('closed', () => {
        PagoPlanillaTiempoParcialWindow = null;
    });
}

function createAutorizacionPagoParcialWindow() {
    if (!canOpenWindow()) return;
    
    if (AutorizarPagoPlanillasWindow) {
        if (AutorizarPagoPlanillasWindow.isMinimized()) AutorizarPagoPlanillasWindow.restore();
        AutorizarPagoPlanillasWindow.focus();
        return;
    }
    
    AutorizarPagoPlanillasWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    AutorizarPagoPlanillasWindow.loadURL(`file://${__dirname}/Vistas/AutorizarPlanillaParcial.html`);
    
    AutorizarPagoPlanillasWindow.on('closed', () => {
        AutorizarPagoPlanillasWindow = null;
    });
}

function createAutorizacionLiquidacionWindow() {
    if (!canOpenWindow()) return;
    
    if (AutorizarLiquidacionesWindow) {
        if (AutorizarLiquidacionesWindow.isMinimized()) AutorizarLiquidacionesWindow.restore();
        AutorizarLiquidacionesWindow.focus();
        return;
    }
    
    AutorizarLiquidacionesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    AutorizarLiquidacionesWindow.loadURL(`file://${__dirname}/Vistas/AutorizarLiquidacion.html`);
    
    AutorizarLiquidacionesWindow.on('closed', () => {
        AutorizarLiquidacionesWindow = null;
    });
}

function createReporteDiasDisponiblesVacacionesWindow() {
    if (!canOpenWindow()) return;
    
    if (ReporteDiasDisponiblesVacacionesWindow) {
        if (ReporteDiasDisponiblesVacacionesWindow.isMinimized()) ReporteDiasDisponiblesVacacionesWindow.restore();
        ReporteDiasDisponiblesVacacionesWindow.focus();
        return;
    }
    
    ReporteDiasDisponiblesVacacionesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    ReporteDiasDisponiblesVacacionesWindow.loadURL(`file://${__dirname}/Vistas/ReporteDiasVacaciones.html`);
    
    ReporteDiasDisponiblesVacacionesWindow.on('closed', () => {
        ReporteDiasDisponiblesVacacionesWindow = null;
    });
}

function createDocumentosWindow() {
    if (!canOpenWindow()) return;
    
    if (DocumentosWindow) {
        if (DocumentosWindow.isMinimized()) DocumentosWindow.restore();
        DocumentosWindow.focus();
        return;
    }
    
    DocumentosWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    DocumentosWindow.loadURL(`file://${__dirname}/Vistas/Documentacion.html`);
    
    DocumentosWindow.on('closed', () => {
        DocumentosWindow = null;
    });
}

function createModificacionesPagosNominaWindow() {
    if (!canOpenWindow()) return;
    
    if (ModificacionesPagosNominaWindow) {
        if (ModificacionesPagosNominaWindow.isMinimized()) ModificacionesPagosNominaWindow.restore();
        ModificacionesPagosNominaWindow.focus();
        return;
    }
    
    ModificacionesPagosNominaWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Permisos',
        autoHideMenuBar: true
    });

    ModificacionesPagosNominaWindow.loadURL(`file://${__dirname}/Vistas/ModificarNominas.html`);

    ModificacionesPagosNominaWindow.on('closed', () => {
        ModificacionesPagosNominaWindow = null;
    });
}

// Función auxiliar para abrir adicionales (si existe)
function open_Adicionales() {
    if (!canOpenWindow()) return;
    // Implementar según tus necesidades
    log.info('Función open_Adicionales llamada');
}

// Manejadores de IPC para actualizaciones
ipcMain.on('check_for_updates', () => {
    if (process.env.NODE_ENV === 'production' && !updateCheckInProgress) {
        log.info('Verificación de actualizaciones solicitada desde renderer');
        autoUpdater.checkForUpdatesAndNotify();
    } else if (process.env.NODE_ENV !== 'production') {
        log.info('Saltando verificación de actualizaciones - modo desarrollo');
    }
});

ipcMain.on('restart_app', () => {
    log.info('Reinicio solicitado para instalar actualización');
    
    // Cerrar todas las ventanas secundarias
    closeAllSecondaryWindows();
    
    // Pequeño delay para asegurar que las ventanas se cierren
    setTimeout(() => {
        log.info('Iniciando instalación de actualización...');
        autoUpdater.quitAndInstall(false, true);
    }, 1000);
});

// Manejador para obtener información de la versión actual
ipcMain.handle('get_app_version', () => {
    return {
        version: app.getVersion(),
        updateRequired: updateRequired,
        updateInProgress: updateCheckInProgress
    };
});

// Inicializar la aplicación
app.on('ready', createWindow);

// Verificación periódica de actualizaciones (cada 30 minutos en producción)
if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
        if (!updateRequired && !updateCheckInProgress) {
            log.info('Verificación periódica de actualizaciones...');
            autoUpdater.checkForUpdatesAndNotify();
        }
    }, 30 * 60 * 1000); // 30 minutos
}

// Eventos existentes del auto-updater (mantener compatibilidad con código anterior)
autoUpdater.on('update-available', (info) => {
    log.info("update available");
    mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', (info) => {
    log.info("update-downloaded");
    mainWindow.webContents.send('update_downloaded');
});

// Manejadores IPC para abrir ventanas
ipcMain.on('open_adicionales', () => {
    open_Adicionales();
});

ipcMain.on('open_pago_nomina', () => {
    createPagoNominaWindow();
});

ipcMain.on('open_actualizar_departamento', () => {
    createActualizarDepartamentoWindow();
});

ipcMain.on('open_personal_busqueda', () => {
    createBusquedaWindow();
});

ipcMain.on('open_personal_nuevo', () => {
    createPersonalNuevoWindow();
});

ipcMain.on('open_planilla_dominical', () => {
    createPlanillaDominicalWindow();
});

ipcMain.on('open_embargo_Salarial', () => {
    createembargosalarialWindow();
});

ipcMain.on('open_Reporte_Suspensiones', () => {
    createReporteSuspensionesWindow();
});

ipcMain.on('open_Reporte_DescuentosJudiciales', () => {
    createReporteDescuentosJudicialesWindow();
});

ipcMain.on('open_Reporte_PlanillaEspecial', () => {
    createReportePlanillaEspecialWindow();
});

ipcMain.on('open_Ventana_Permisos', () => {
    createAsignarPermisosWindow();
});

ipcMain.on('open_Ventana_Vacaciones', () => {
    createVacacionesWindow();
});

ipcMain.on('open_Ventana_PagoVacaciones', () => {
    createPagoVacacionesWindow();
});

ipcMain.on('open_Ventana_GestionVacaciones', () => {
    createGestionVacacionesWindow();
});

ipcMain.on('open_Ventana_GestionPagoVacaciones', () => {
    createGestionPagoVacacionesWindow();
});

ipcMain.on('open_Ventana_GestionPagosVacaciones', () => {
    createEstadoPagosWindow();
});

ipcMain.on('open_Ventana_Pagosbonis', () => {
    createPagosBonisWindow();
});

ipcMain.on('open_Ventana_Bajas', () => {
    createBajasWindow();
});

ipcMain.on('open_Ventana_PagoLiquidacion', () => {
    createLiquidacionWindow();
});

ipcMain.on('open_Ventana_ReportePlanillaContable', () => {
    createReportePlanillaContableWindow();
});

ipcMain.on('open_Ventana_GestionDocPersonales', () => {
    createGestionDocPersonalesWindow();
});

ipcMain.on('open_Ventana_ConsultarDocPersonales', () => {
    createConsultarDocPersonalesWindow();
});

ipcMain.on('open_Ventana_PagoPlanillaParciales', () => {
    createPagoPlanillaTiempoParcialWindow();
});

ipcMain.on('open_Ventana_AutorizarPagoParciales', () => {
    createAutorizacionPagoParcialWindow();
});

ipcMain.on('open_Ventana_AutorizarLiquidacion', () => {
    createAutorizacionLiquidacionWindow();
});

ipcMain.on('open_Ventana_ReporteDiasDisponiblesVacaciones', () => {
    createReporteDiasDisponiblesVacacionesWindow();
});

ipcMain.on('open_Ventana_Documentos', () => {
    createDocumentosWindow();
});

ipcMain.on('open_Ventana_MPN', () => {
    createModificacionesPagosNominaWindow();
});

// Manejador para diálogos de archivo
ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(options);
    return {
        canceled: result.canceled,
        filePath: result.canceled ? null : result.filePaths[0]
    };
});