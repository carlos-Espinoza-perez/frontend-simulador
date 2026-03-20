import { io, Socket } from 'socket.io-client';
import { EstadoRobot } from './robotService';

const WS_URL = import.meta.env.VITE_API_URL || 'https://simuladorbackend.azurewebsites.net';

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnecting: boolean = false;
  private hasConnected: boolean = false;

  connect() {

    if (this.socket?.connected || this.isConnecting || this.hasConnected) {
      console.log('[WebSocket] Ya conectado o en proceso de conexión');
      return;
    }

    this.isConnecting = true;
    this.hasConnected = true;

    this.socket = io(WS_URL, {
      transports: ['websocket'], // Forzar WebSocket puro, nada de HTTP polling lento
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 3, // Reducir intentos
      timeout: 5000,
      forceNew: true, // Forzar nueva conexión
    });

    this.setupEventListeners();
    console.log('[WebSocket] Conectando...');
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[WebSocket] Desconectado');
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WebSocket] Conectado con ID:', this.socket?.id);
      this.isConnecting = false;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Desconectado:', reason);
      this.isConnecting = false;
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[WebSocket] Error de conexión (continuando sin WebSocket):', error.message);
      this.isConnecting = false;

    });

    this.socket.on('respuesta_conexion', (data) => {
      console.log('[WebSocket] Respuesta conexión:', data);
      this.emit('respuesta_conexion', data);
    });

    this.socket.on('actualizacion_robot', (data: EstadoRobot) => {
      this.emit('actualizacion_robot', data);
    });

    this.socket.on('robot_cambiado', (data) => {
      console.log('[WebSocket] Robot cambiado:', data);
      this.emit('robot_cambiado', data);
    });

    this.socket.on('estado_robot', (data: EstadoRobot) => {
      this.emit('estado_robot', data);
    });

    this.socket.on('error', (data) => {
      console.error('[WebSocket] Error:', data);
      this.emit('error', data);
    });

    this.socket.on('rapid_console', (data) => {
      console.log('[WebSocket] Mensaje de consola RAPID:', data);
      this.emit('rapid_console', data);
    });
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(data));
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.off(event, callback);
    };
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  solicitarEstado() {
    if (this.socket?.connected) {
      this.socket.emit('solicitar_estado');
    }
  }

  moverRobot(angulos: number[]) {
    if (this.socket?.connected) {
      this.socket.emit('mover_robot', { angulos });
    }
  }

  executeRapidStreaming(
    code: string, 
    onPoint: (point: any) => void, 
    onComplete: () => void, 
    onError: (error: string) => void,
    onConsole?: (message: string, type: string) => void
  ) {
    if (!this.socket?.connected) {
      onError('WebSocket no conectado');
      return;
    }

    console.log('[WebSocket] Iniciando ejecución RAPID streaming');

    const cleanup = () => {
      console.log('[WebSocket] Limpiando listeners de ejecución RAPID');
      this.socket?.off('rapid_point', pointListener);
      this.socket?.off('rapid_complete', completeListener);
      this.socket?.off('rapid_error', errorListener);
      this.socket?.off('rapid_console', consoleListener);
    };

    const pointListener = (point: any) => {
      console.log('[WebSocket] Punto recibido:', point);
      onPoint(point);
    };

    const completeListener = (data: any) => {
      console.log('[WebSocket] Ejecución completada:', data);
      cleanup();
      onComplete();
    };

    const errorListener = (error: any) => {
      console.error('[WebSocket] Error en ejecución:', error);
      cleanup();
      onError(error.message || 'Error desconocido');
    };

    const consoleListener = (data: any) => {
      console.log('[WebSocket] Mensaje de consola:', data);
      if (onConsole) {
        onConsole(data.message, data.type || 'info');
      }
    };

    this.socket.on('rapid_point', pointListener);
    this.socket.on('rapid_complete', completeListener);
    this.socket.on('rapid_error', errorListener);
    this.socket.on('rapid_console', consoleListener);

    console.log('[WebSocket] Enviando código RAPID al servidor');
    this.socket.emit('execute_rapid_stream', { code });
  }

  abortRapidExecution() {
    if (this.socket?.connected) {
      console.log('[WebSocket] Solicitando abortar ejecución RAPID de emergencia');
      this.socket.emit('abort_rapid_execution');
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();
export default websocketService;
