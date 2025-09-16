const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const {autoUpdater} = require('electron-updater')
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
let ReportePlanillasParcialesWindow = null;

// Variable para controlar el estado de actualización
let updateInProgress = false;

if(process.env.NODE_ENV !=='production'){
    require('electron-reload')(__dirname,{
        
    })
}

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
        // Solo verificar actualizaciones si no estamos en desarrollo
        if (process.env.NODE_ENV !== 'development') {
            autoUpdater.checkForUpdatesAndNotify();
        }
    });

    // Prevenir el cierre de la ventana principal durante una actualización
    mainWindow.on('close', (event) => {
        if (updateInProgress) {
            event.preventDefault();
            dialog.showMessageBoxSync(mainWindow, {
                type: 'info',
                title: 'Actualización en progreso',
                message: 'No se puede cerrar la aplicación mientras se está actualizando. Por favor espera a que termine el proceso.',
                buttons: ['Entendido']
            });
        }
    });
}

app.on('ready', createWindow);

// Configurar eventos del auto-updater
autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    log.info("Update available:", info);
    updateInProgress = true;
    
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('update_available', {
            version: info.version,
            releaseNotes: info.releaseNotes,
            releaseDate: info.releaseDate
        });
    }
});

autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available:', info);
});

autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater:', err);
    updateInProgress = false;
    
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('update_error', {
            message: err.message,
            stack: err.stack
        });
    }
});

// Evento de progreso de descarga
autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    log.info(log_message);
    
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('download_progress', {
            percent: Math.round(progressObj.percent),
            transferred: progressObj.transferred,
            total: progressObj.total,
            bytesPerSecond: progressObj.bytesPerSecond
        });
    }
});

autoUpdater.on('update-downloaded', (info) => {
    log.info("Update downloaded:", info);
    updateInProgress = false;
    
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('update_downloaded', {
            version: info.version,
            releaseNotes: info.releaseNotes,
            releaseDate: info.releaseDate
        });
    }
});

// Manejar solicitud de reinicio
ipcMain.on('restart_app', () => {
    log.info("Restarting app for update...");
    autoUpdater.quitAndInstall();
});

// Función helper para mostrar alerta de actualización en progreso
function showUpdateInProgressDialog() {
    dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        title: 'Actualización en progreso',
        message: 'No se pueden abrir nuevas ventanas mientras se actualiza la aplicación. Por favor espera.',
        buttons: ['Entendido']
    });
}

// Función para crear ventana de Personal Nuevo
function createPersonalNuevoWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Vacaciones',
        autoHideMenuBar: true
    });

    VacacionesWindow.loadURL(`file://${__dirname}/Vistas/Vacaciones.html`);
    
    VacacionesWindow.on('closed', () => {
        VacacionesWindow = null;
    });
}

function createPagoVacacionesWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Pago Vacaciones',
        autoHideMenuBar: true
    });

    PagoVacacionesWindow.loadURL(`file://${__dirname}/Vistas/PagoVacaciones.html`);
    
    PagoVacacionesWindow.on('closed', () => {
        PagoVacacionesWindow = null;
    });
}

function createGestionVacacionesWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Gestión Vacaciones',
        autoHideMenuBar: true
    });

    GestionarVacacionesWindow.loadURL(`file://${__dirname}/Vistas/VacacionesAdmin.html`);
    
    GestionarVacacionesWindow.on('closed', () => {
        GestionarVacacionesWindow = null;
    });
}

function createGestionPagoVacacionesWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Gestión Pago Vacaciones',
        autoHideMenuBar: true
    });

    GestionarPagoVacacionesWindow.loadURL(`file://${__dirname}/Vistas/PagoVacacionesAdmin.html`);
    
    GestionarPagoVacacionesWindow.on('closed', () => {
        GestionarPagoVacacionesWindow = null;
    });
}

function createEstadoPagosWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Estado Pagos',
        autoHideMenuBar: true
    });

    EstadoPagosVacacionesWindow.loadURL(`file://${__dirname}/Vistas/GestionPagosVacaciones.html`);
    
    EstadoPagosVacacionesWindow.on('closed', () => {
        EstadoPagosVacacionesWindow = null;
    });
}

function createPagosBonisWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Bonificaciones',
        autoHideMenuBar: true
    });

    PagosBonisWindow.loadURL(`file://${__dirname}/Vistas/Bonificaciones.html`);
    
    PagosBonisWindow.on('closed', () => {
        PagosBonisWindow = null;
    });
}

function createBajasWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Bajas',
        autoHideMenuBar: true
    });

    BajasWindow.loadURL(`file://${__dirname}/Vistas/ReporteBajas.html`);
    
    BajasWindow.on('closed', () => {
        BajasWindow = null;
    });
}

function createLiquidacionWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Liquidación',
        autoHideMenuBar: true
    });

    LiquidaciónWindow.loadURL(`file://${__dirname}/Vistas/PagoLiquidacion.html`);
    
    LiquidaciónWindow.on('closed', () => {
        LiquidaciónWindow = null;
    });
}

function createReportePlanillaContableWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Reporte Planilla Contable',
        autoHideMenuBar: true
    });

    ReportePlanillaContableWindow.loadURL(`file://${__dirname}/Vistas/ReportePlanilla.html`);
    
    ReportePlanillaContableWindow.on('closed', () => {
        ReportePlanillaContableWindow = null;
    });
}

function createGestionDocPersonalesWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Gestión Documentos',
        autoHideMenuBar: true
    });

    GestionDocumentosPersonalesWindow.loadURL(`file://${__dirname}/Vistas/GestionDocumentos.html`);
    
    GestionDocumentosPersonalesWindow.on('closed', () => {
        GestionDocumentosPersonalesWindow = null;
    });
}

function createConsultarDocPersonalesWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Consultar Archivos',
        autoHideMenuBar: true
    });

    ConsultarArchivosWindow.loadURL(`file://${__dirname}/Vistas/ConsultarArchivos.html`);
    
    ConsultarArchivosWindow.on('closed', () => {
        ConsultarArchivosWindow = null;
    });
}

function createPagoPlanillaTiempoParcialWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Pago Planilla Tiempo Parcial',
        autoHideMenuBar: true
    });

    PagoPlanillaTiempoParcialWindow.loadURL(`file://${__dirname}/Vistas/PagoPlanillaTiempoParcial.html`);
    
    PagoPlanillaTiempoParcialWindow.on('closed', () => {
        PagoPlanillaTiempoParcialWindow = null;
    });
}

function createAutorizacionPagoParcialWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Autorizar Pago Parcial',
        autoHideMenuBar: true
    });

    AutorizarPagoPlanillasWindow.loadURL(`file://${__dirname}/Vistas/AutorizarPlanillaParcial.html`);
    
    AutorizarPagoPlanillasWindow.on('closed', () => {
        AutorizarPagoPlanillasWindow = null;
    });
}

function createAutorizacionLiquidacionWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Autorizar Liquidación',
        autoHideMenuBar: true
    });

    AutorizarLiquidacionesWindow.loadURL(`file://${__dirname}/Vistas/AutorizarLiquidacion.html`);
    
    AutorizarLiquidacionesWindow.on('closed', () => {
        AutorizarLiquidacionesWindow = null;
    });
}

function createReporteDiasDisponiblesVacacionesWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Reporte Días Vacaciones',
        autoHideMenuBar: true
    });

    ReporteDiasDisponiblesVacacionesWindow.loadURL(`file://${__dirname}/Vistas/ReporteDiasVacaciones.html`);
    
    ReporteDiasDisponiblesVacacionesWindow.on('closed', () => {
        ReporteDiasDisponiblesVacacionesWindow = null;
    });
}

function createDocumentosWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Documentos',
        autoHideMenuBar: true
    });

    DocumentosWindow.loadURL(`file://${__dirname}/Vistas/Documentacion.html`);
    
    DocumentosWindow.on('closed', () => {
        DocumentosWindow = null;
    });
}

function createModificacionesPagosNominaWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

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
        title: 'Modificaciones Pagos Nómina',
        autoHideMenuBar: true
    });

    ModificacionesPagosNominaWindow.loadURL(`file://${__dirname}/Vistas/ModificarNominas.html`);

    ModificacionesPagosNominaWindow.on('closed', () => {
        ModificacionesPagosNominaWindow = null;
    });
}

function createReportePlanillasParcialesWindow() {
    if (updateInProgress) {
        showUpdateInProgressDialog();
        return;
    }

    if (ReportePlanillasParcialesWindow) {
        if (ReportePlanillasParcialesWindow.isMinimized()) ReportePlanillasParcialesWindow.restore();
        ReportePlanillasParcialesWindow.focus();
        return;
    }
    
    ReportePlanillasParcialesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'LogoRecursos.ico'),
        title: 'Reporte Planillas Parciales',
        autoHideMenuBar: true
    });

    ReportePlanillasParcialesWindow.loadURL(`file://${__dirname}/Vistas/ReportePlanillasParciales.html`);

    ReportePlanillasParcialesWindow.on('closed', () => {
        ReportePlanillasParcialesWindow = null;
    });
}

// IPC Main Event Listeners - Manejar solicitudes de apertura de ventanas

ipcMain.on('open_adicionales', () => {
    // Esta función no está definida en el código original, la omito
    console.log('open_adicionales event received but function not implemented');
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

ipcMain.on('open_Ventana_RPP', () => {
    createReportePlanillasParcialesWindow();
});

// Handler para el diálogo de guardado de archivos
ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(options);
    return {
        canceled: result.canceled,
        filePath: result.canceled ? null : result.filePaths[0]
    };
});