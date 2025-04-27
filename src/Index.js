const { app, BrowserWindow, ipcMain } = require('electron');
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
        icon: path.join(__dirname, 'Logo-Recursos.ico'),
        autoHideMenuBar: true
    });

    mainWindow.maximize();
    mainWindow.loadURL(`file://${__dirname}/Vistas/Login.html`);
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
        icon: path.join(__dirname, 'Logo-Recursos.ico'),
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
        icon: path.join(__dirname, 'Logo-Recursos.ico'),
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
        icon: path.join(__dirname, 'Logo-Recursos.ico'),
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
        icon: path.join(__dirname, 'Logo-Recursos.ico'),
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
        icon: path.join(__dirname, 'Logo-Recursos.ico'),
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
        icon: path.join(__dirname, 'Logo-Recursos.ico'),
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
        icon: path.join(__dirname, 'Logo-Recursos.ico'),
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
        icon: path.join(__dirname, 'Logo-Recursos.ico'),
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
        icon: path.join(__dirname, 'Logo-Recursos.ico'),
        title: 'Reporte',
        autoHideMenuBar: true
    });

    reportePlanillaEspecialWindow.loadURL(`file://${__dirname}/Vistas/ReportePlanillaEspecial.html`);
    
    // Elimina la referencia a la ventana cuando se cierre
    reportePlanillaEspecialWindow.on('closed', () => {
        reportePlanillaEspecialWindow = null;
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