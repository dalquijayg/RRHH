const { app, BrowserWindow, ipcMain,dialog } = require('electron');
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
        autoUpdater.checkForUpdatesAndNotify();
    });
}
app.on('ready', createWindow);
autoUpdater.on('update-available', (info) => {
    log.info("update available");
    mainWindow.webContents.send('update_available');
});
  
autoUpdater.on('update-downloaded', (info) => {
    log.info("update-downloaded");
    mainWindow.webContents.send('update_downloaded');
});
  
ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});
ipcMain.on('open_adicionales', () => {
    open_Adicionales();
});
function createPersonalNuevoWindow() {
    // Verifica si la ventana ya está abierta
    if (personalNuevoWindow) {
        // Si ya está abierta, simplemente enfócala
        if (personalNuevoWindow.isMinimized()) personalNuevoWindow.restore();
        personalNuevoWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    personalNuevoWindow.on('closed', () => {
        personalNuevoWindow = null;
    });
}
function createBusquedaWindow() {
    // Verifica si la ventana ya está abierta
    if (busquedaWindow) {
        // Si ya está abierta, simplemente enfócala
        if (busquedaWindow.isMinimized()) busquedaWindow.restore();
        busquedaWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    busquedaWindow.on('closed', () => {
        busquedaWindow = null;
    });
}
function createPlanillaDominicalWindow() {
    // Verifica si la ventana ya está abierta
    if (planillaDominicalWindow) {
        // Si ya está abierta, simplemente enfócala
        if (planillaDominicalWindow.isMinimized()) planillaDominicalWindow.restore();
        planillaDominicalWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    planillaDominicalWindow.on('closed', () => {
        planillaDominicalWindow = null;
    });
}
function createActualizarDepartamentoWindow() {
    // Verifica si la ventana ya está abierta
    if (actualizarDepartamentoWindow) {
        // Si ya está abierta, simplemente enfócala
        if (actualizarDepartamentoWindow.isMinimized()) actualizarDepartamentoWindow.restore();
        actualizarDepartamentoWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    actualizarDepartamentoWindow.on('closed', () => {
        actualizarDepartamentoWindow = null;
    });
}
function createPagoNominaWindow() {
    // Verifica si la ventana ya está abierta
    if (pagoNominaWindow) {
        // Si ya está abierta, simplemente enfócala
        if (pagoNominaWindow.isMinimized()) pagoNominaWindow.restore();
        pagoNominaWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    pagoNominaWindow.on('closed', () => {
        pagoNominaWindow = null;
    });
}
function createembargosalarialWindow() {
    // Verifica si la ventana ya está abierta
    if (embargoSalarialWindow) {
        // Si ya está abierta, simplemente enfócala
        if (embargoSalarialWindow.isMinimized()) embargoSalarialWindow.restore();
        embargoSalarialWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    embargoSalarialWindow.on('closed', () => {
        embargoSalarialWindow = null;
    });
}
function createReporteSuspensionesWindow() {
    // Verifica si la ventana ya está abierta
    if (reportesuspensionesWindow) {
        // Si ya está abierta, simplemente enfócala
        if (reportesuspensionesWindow.isMinimized()) reportesuspensionesWindow.restore();
        reportesuspensionesWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    reportesuspensionesWindow.on('closed', () => {
        reportesuspensionesWindow = null;
    });
}
function createReporteDescuentosJudicialesWindow() {
    // Verifica si la ventana ya está abierta
    if (reporteDescJudiciales) {
        // Si ya está abierta, simplemente enfócala
        if (reporteDescJudiciales.isMinimized()) reporteDescJudiciales.restore();
        reporteDescJudiciales.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    reporteDescJudiciales.on('closed', () => {
        reporteDescJudiciales = null;
    });
}
function createReportePlanillaEspecialWindow() {
    // Verifica si la ventana ya está abierta
    if (reportePlanillaEspecialWindow) {
        // Si ya está abierta, simplemente enfócala
        if (reportePlanillaEspecialWindow.isMinimized()) reportePlanillaEspecialWindow.restore();
        reportePlanillaEspecialWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    reportePlanillaEspecialWindow.on('closed', () => {
        reportePlanillaEspecialWindow = null;
    });
}
function createAsignarPermisosWindow() {
    // Verifica si la ventana ya está abierta
    if (AsignarPermisos) {
        // Si ya está abierta, simplemente enfócala
        if (AsignarPermisos.isMinimized()) AsignarPermisos.restore();
        AsignarPermisos.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    AsignarPermisos.on('closed', () => {
        AsignarPermisos = null;
    });
}
function createVacacionesWindow() {
    // Verifica si la ventana ya está abierta
    if (VacacionesWindow) {
        // Si ya está abierta, simplemente enfócala
        if (VacacionesWindow.isMinimized()) VacacionesWindow.restore();
        VacacionesWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    VacacionesWindow.on('closed', () => {
        VacacionesWindow = null;
    });
}
function createPagoVacacionesWindow() {
    // Verifica si la ventana ya está abierta
    if (PagoVacacionesWindow) {
        // Si ya está abierta, simplemente enfócala
        if (PagoVacacionesWindow.isMinimized()) PagoVacacionesWindow.restore();
        PagoVacacionesWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    PagoVacacionesWindow.on('closed', () => {
        PagoVacacionesWindow = null;
    });
}
function createGestionVacacionesWindow() {
    // Verifica si la ventana ya está abierta
    if (GestionarVacacionesWindow) {
        // Si ya está abierta, simplemente enfócala
        if (GestionarVacacionesWindow.isMinimized()) GestionarVacacionesWindow.restore();
        GestionarVacacionesWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    GestionarVacacionesWindow.on('closed', () => {
        GestionarVacacionesWindow = null;
    });
}
function createGestionPagoVacacionesWindow() {
    // Verifica si la ventana ya está abierta
    if (GestionarPagoVacacionesWindow) {
        // Si ya está abierta, simplemente enfócala
        if (GestionarPagoVacacionesWindow.isMinimized()) GestionarPagoVacacionesWindow.restore();
        GestionarPagoVacacionesWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    GestionarPagoVacacionesWindow.on('closed', () => {
        GestionarPagoVacacionesWindow = null;
    });
}
function createEstadoPagosWindow() {
    // Verifica si la ventana ya está abierta
    if (EstadoPagosVacacionesWindow) {
        // Si ya está abierta, simplemente enfócala
        if (EstadoPagosVacacionesWindow.isMinimized()) EstadoPagosVacacionesWindow.restore();
        EstadoPagosVacacionesWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    EstadoPagosVacacionesWindow.on('closed', () => {
        EstadoPagosVacacionesWindow = null;
    });
}
function createPagosBonisWindow() {
    // Verifica si la ventana ya está abierta
    if (PagosBonisWindow) {
        // Si ya está abierta, simplemente enfócala
        if (PagosBonisWindow.isMinimized()) PagosBonisWindow.restore();
        PagosBonisWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    PagosBonisWindow.on('closed', () => {
        PagosBonisWindow = null;
    });
}
function createBajasWindow() {
    // Verifica si la ventana ya está abierta
    if (BajasWindow) {
        // Si ya está abierta, simplemente enfócala
        if (BajasWindow.isMinimized()) BajasWindow.restore();
        BajasWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    BajasWindow.on('closed', () => {
        BajasWindow = null;
    });
}
function createLiquidacionWindow() {
    // Verifica si la ventana ya está abierta
    if (LiquidaciónWindow) {
        // Si ya está abierta, simplemente enfócala
        if (LiquidaciónWindow.isMinimized()) LiquidaciónWindow.restore();
        LiquidaciónWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    LiquidaciónWindow.on('closed', () => {
        LiquidaciónWindow = null;
    });
}
function createReportePlanillaContableWindow() {
    // Verifica si la ventana ya está abierta
    if (ReportePlanillaContableWindow) {
        // Si ya está abierta, simplemente enfócala
        if (ReportePlanillaContableWindow.isMinimized()) ReportePlanillaContableWindow.restore();
        ReportePlanillaContableWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    ReportePlanillaContableWindow.on('closed', () => {
        ReportePlanillaContableWindow = null;
    });
}
function createGestionDocPersonalesWindow() {
    // Verifica si la ventana ya está abierta
    if (GestionDocumentosPersonalesWindow) {
        // Si ya está abierta, simplemente enfócala
        if (GestionDocumentosPersonalesWindow.isMinimized()) GestionDocumentosPersonalesWindow.restore();
        GestionDocumentosPersonalesWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    GestionDocumentosPersonalesWindow.on('closed', () => {
        GestionDocumentosPersonalesWindow = null;
    });
}
function createConsultarDocPersonalesWindow() {
    // Verifica si la ventana ya está abierta
    if (ConsultarArchivosWindow) {
        // Si ya está abierta, simplemente enfócala
        if (ConsultarArchivosWindow.isMinimized()) ConsultarArchivosWindow.restore();
        ConsultarArchivosWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    ConsultarArchivosWindow.on('closed', () => {
        ConsultarArchivosWindow = null;
    });
}
function createPagoPlanillaTiempoParcialWindow() {
    // Verifica si la ventana ya está abierta
    if (PagoPlanillaTiempoParcialWindow) {
        // Si ya está abierta, simplemente enfócala
        if (PagoPlanillaTiempoParcialWindow.isMinimized()) PagoPlanillaTiempoParcialWindow.restore();
        PagoPlanillaTiempoParcialWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    PagoPlanillaTiempoParcialWindow.on('closed', () => {
        PagoPlanillaTiempoParcialWindow = null;
    });
}
function createAutorizacionPagoParcialWindow() {
    // Verifica si la ventana ya está abierta
    if (AutorizarPagoPlanillasWindow) {
        // Si ya está abierta, simplemente enfócala
        if (AutorizarPagoPlanillasWindow.isMinimized()) AutorizarPagoPlanillasWindow.restore();
        AutorizarPagoPlanillasWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    AutorizarPagoPlanillasWindow.on('closed', () => {
        AutorizarPagoPlanillasWindow = null;
    });
}
function createAutorizacionLiquidacionWindow() {
    // Verifica si la ventana ya está abierta
    if (AutorizarLiquidacionesWindow) {
        // Si ya está abierta, simplemente enfócala
        if (AutorizarLiquidacionesWindow.isMinimized()) AutorizarLiquidacionesWindow.restore();
        AutorizarLiquidacionesWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    AutorizarLiquidacionesWindow.on('closed', () => {
        AutorizarLiquidacionesWindow = null;
    });
}
function createReporteDiasDisponiblesVacacionesWindow() {
    // Verifica si la ventana ya está abierta
    if (ReporteDiasDisponiblesVacacionesWindow) {
        // Si ya está abierta, simplemente enfócala
        if (ReporteDiasDisponiblesVacacionesWindow.isMinimized()) ReporteDiasDisponiblesVacacionesWindow.restore();
        ReporteDiasDisponiblesVacacionesWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    ReporteDiasDisponiblesVacacionesWindow.on('closed', () => {
        ReporteDiasDisponiblesVacacionesWindow = null;
    });
}
function createDocumentosWindow() {
    // Verifica si la ventana ya está abierta
    if (DocumentosWindow) {
        // Si ya está abierta, simplemente enfócala
        if (DocumentosWindow.isMinimized()) DocumentosWindow.restore();
        DocumentosWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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
    
    // Elimina la referencia a la ventana cuando se cierre
    DocumentosWindow.on('closed', () => {
        DocumentosWindow = null;
    });
}
function createModificacionesPagosNominaWindow() {
    // Verifica si la ventana ya está abierta
    if (ModificacionesPagosNominaWindow) {
        // Si ya está abierta, simplemente enfócala
        if (ModificacionesPagosNominaWindow.isMinimized()) ModificacionesPagosNominaWindow.restore();
        ModificacionesPagosNominaWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
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

    // Elimina la referencia a la ventana cuando se cierre
    ModificacionesPagosNominaWindow.on('closed', () => {
        ModificacionesPagosNominaWindow = null;
    });
}
function createReportePlanillasParcialesWindow() {
    // Verifica si la ventana ya está abierta
    if (ReportePlanillasParcialesWindow) {
        // Si ya está abierta, simplemente enfócala
        if (ReportePlanillasParcialesWindow.isMinimized()) ReportePlanillasParcialesWindow.restore();
        ReportePlanillasParcialesWindow.focus();
        return;
    }
    
    // Crea una nueva ventana si no existe
    ReportePlanillasParcialesWindow = new BrowserWindow({
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

    ReportePlanillasParcialesWindow.loadURL(`file://${__dirname}/Vistas/ReportePlanillasParciales.html`);

    // Elimina la referencia a la ventana cuando se cierre
    ReportePlanillasParcialesWindow.on('closed', () => {
        ReportePlanillasParcialesWindow = null;
    });
}
// Añade este receptor para abrir la ventana de pago nómina
ipcMain.on('open_pago_nomina', () => {
    createPagoNominaWindow();
});
// Añade este receptor para abrir la ventana de actualizar departamento
ipcMain.on('open_actualizar_departamento', () => {
    createActualizarDepartamentoWindow();
});
// Añade este receptor para abrir la ventana de búsqueda
ipcMain.on('open_personal_busqueda', () => {
    createBusquedaWindow();
});
// Añade este receptor para abrir la ventana de nuevo personal
ipcMain.on('open_personal_nuevo', () => {
    createPersonalNuevoWindow();
});
// Añade este receptor para abrir la ventana de planilla dominical
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
ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(options);
    return {
        canceled: result.canceled,
        filePath: result.canceled ? null : result.filePaths[0]
    };
});