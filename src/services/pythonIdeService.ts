import api from './api';

export interface WorkspaceFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: number;
}

export interface ScriptStatus {
  is_running: boolean;
  pid: number | null;
  current_script: string | null;
  elapsed_seconds: number;
}

export interface ConnectionStatus {
  success: boolean;
  is_connected: boolean;
  host: string;
  port: number;
  mode: 'SIMULATED' | 'CONNECTED_PHYSICAL' | 'DEVELOPMENT';
  timeout: number;
  latency_ms: number | null;
  last_seen: number | null;
  mock_server_running: boolean;
  physical_armed?: boolean;
  is_lan?: boolean;
  busy?: boolean;
}

export interface TrafficEntry {
  timestamp: string;
  direction: 'IN' | 'OUT';
  payload: any;
  latency_ms?: number;
}

export interface VirtualSignal {
  name: string;
  type: 'DI' | 'DO';
  value: number;
  description: string;
  is_virtual: boolean;
}

export interface ConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  timeout: number;
  mode: 'SIMULATED' | 'CONNECTED_PHYSICAL' | 'DEVELOPMENT';
  description: string;
}

class PythonIdeService {
  async listFiles(): Promise<WorkspaceFile[]> {
    const res = await api.get('/api/ide/files');
    return res.data.files || [];
  }

  async readFile(path: string): Promise<string> {
    const res = await api.post('/api/ide/file/read', { path });
    return res.data.content || '';
  }

  async writeFile(path: string, content: string): Promise<void> {
    await api.post('/api/ide/file/write', { path, content });
  }

  async createFile(path: string, content = ''): Promise<void> {
    await api.post('/api/ide/file/create', { path, content });
  }

  async createDirectory(path: string): Promise<void> {
    await api.post('/api/ide/directory/create', { path });
  }

  async renameItem(old_path: string, new_path: string): Promise<void> {
    await api.post('/api/ide/item/rename', { old_path, new_path });
  }

  async deleteItem(path: string): Promise<void> {
    await api.post('/api/ide/item/delete', { path });
  }

  async runScript(path: string, timeout = 60): Promise<any> {
    const res = await api.post('/api/ide/script/run', { path, timeout });
    return res.data;
  }

  async stopScript(force = false): Promise<any> {
    const res = await api.post('/api/ide/script/stop', { force });
    return res.data;
  }

  async getScriptStatus(): Promise<ScriptStatus> {
    const res = await api.get('/api/ide/script/status');
    return res.data;
  }

  async getScriptLogs(since = 0): Promise<{ logs: any[]; status: ScriptStatus }> {
    const res = await api.get(`/api/ide/script/logs?since=${since}`);
    return res.data;
  }

  async getAutocompleteSuggestions(code: string, line: number, column: number, filename = 'main.py'): Promise<any[]> {
    try {
      const res = await api.post('/api/ide/autocomplete', { code, line, column, filename });
      return res.data.suggestions || [];
    } catch {
      return [];
    }
  }

  async getAiCompletion(prompt: string, suffix = ''): Promise<string | null> {
    try {
      const res = await api.post('/api/ide/ai-complete', { prompt, suffix });
      return res.data.completion || null;
    } catch {
      return null;
    }
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    const res = await api.get('/api/connection/status');
    return res.data;
  }

  async connectRobot(
    host: string,
    port: number,
    timeout: number,
    mode: 'SIMULATED' | 'CONNECTED_PHYSICAL' | 'DEVELOPMENT',
    auto_arm?: boolean
  ): Promise<any> {
    const res = await api.post('/api/connection/connect', {
      host,
      port,
      timeout,
      mode,
      ...(auto_arm !== undefined ? { auto_arm } : {}),
    });
    return res.data;
  }

  async disconnectRobot(): Promise<any> {
    const res = await api.post('/api/connection/disconnect');
    return res.data;
  }

  async pingRobot(): Promise<any> {
    const res = await api.post('/api/connection/ping');
    return res.data;
  }

  async sendCommand(
    cmd: string,
    name?: string,
    value?: any,
    physical_confirmed = false,
    extra?: Record<string, any>
  ): Promise<any> {
    const res = await api.post('/api/connection/command', {
      cmd,
      name,
      value,
      physical_confirmed,
      ...(extra || {}),
    });
    return res.data;
  }

  async armPhysical(armed: boolean): Promise<any> {
    const res = await api.post('/api/connection/arm', { armed });
    return res.data;
  }

  async startMockServer(): Promise<any> {
    const res = await api.post('/api/connection/mock_server/start');
    return res.data;
  }

  async stopMockServer(): Promise<any> {
    const res = await api.post('/api/connection/mock_server/stop');
    return res.data;
  }

  async getTrafficLogs(): Promise<TrafficEntry[]> {
    const res = await api.get('/api/connection/traffic');
    return res.data.logs || [];
  }

  async listVirtualSignals(type?: 'DI' | 'DO'): Promise<VirtualSignal[]> {
    const params = type ? `?type=${type}` : '';
    const res = await api.get(`/api/virtual_io/signals${params}`);
    return res.data.signals || [];
  }

  async createVirtualSignal(
    name: string,
    type: 'DI' | 'DO',
    value = 0,
    description = ''
  ): Promise<VirtualSignal> {
    const res = await api.post('/api/virtual_io/signal/create', {
      name,
      type,
      value,
      description,
    });
    return res.data.signal;
  }

  async updateVirtualSignal(name: string, value: number): Promise<VirtualSignal> {
    const res = await api.post('/api/virtual_io/signal/update', { name, value });
    return res.data.signal;
  }

  async deleteVirtualSignal(name: string): Promise<void> {
    await api.post('/api/virtual_io/signal/delete', { name });
  }

  async resetVirtualSignals(): Promise<VirtualSignal[]> {
    const res = await api.post('/api/virtual_io/reset');
    return res.data.signals || [];
  }

  async exportEioCfg(): Promise<{ content: string; filename: string }> {
    const res = await api.get('/api/virtual_io/export/eio_cfg');
    return res.data;
  }

  async getConnectionProfiles(): Promise<{ profiles: ConnectionProfile[]; active_profile: string }> {
    const res = await api.get('/api/connection/profiles');
    return res.data;
  }

  async saveConnectionProfile(profile: ConnectionProfile): Promise<any> {
    const res = await api.post('/api/connection/profiles/save', { profile });
    return res.data;
  }

  async selectConnectionProfile(profileId: string): Promise<ConnectionProfile> {
    const res = await api.post('/api/connection/profiles/select', { profile_id: profileId });
    return res.data.profile;
  }
}

export const pythonIdeService = new PythonIdeService();
export default pythonIdeService;
