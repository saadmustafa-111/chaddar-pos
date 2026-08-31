import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getServerInfo: (): Promise<{ apiUrl: string; webUrl: string } | null> =>
    ipcRenderer.invoke('get-server-info'),

  showError: (title: string, message: string): void => {
    ipcRenderer.send('show-error', title, message);
  },
});
