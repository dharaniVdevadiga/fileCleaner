const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');       
const isDev = !app.isPackaged;

let mainWindow;

function guessMime(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  console.log('[main] isDev:', !app.isPackaged);
  console.log('[main] preload:', path.join(__dirname, 'preload.js'));

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173/');
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    await mainWindow.loadFile(indexPath);
  }
}

// Folder picker (existing)
ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths?.[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle('file-to-data-url', async (_evt, filePath) => {
  const buf = await fs.promises.readFile(filePath);
  return `data:${guessMime(filePath)};base64,${buf.toString('base64')}`;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
