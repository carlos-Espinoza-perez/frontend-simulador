import { useEffect, useCallback, useRef } from 'react';
import websocketService from '../../services/websocketService';
import { EstadoRobot } from '../../services/robotService';

interface WebSocketCallbacks {
  onConexion?: (data: any) => void;
  onActualizacion?: (estado: EstadoRobot) => void;
  onRobotCambiado?: (data: any) => void;
  onEstado?: (estado: EstadoRobot) => void;
  onError?: (error: any) => void;
}

export function useWebSocket(callbacks: WebSocketCallbacks = {}) {
  const {
    onConexion,
    onActualizacion,
    onRobotCambiado,
    onEstado,
    onError,
  } = callbacks;

  const callbacksRef = useRef(callbacks);
  
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {

    websocketService.connect();

    const unsubscribers: (() => void)[] = [];

    if (onConexion) {
      unsubscribers.push(
        websocketService.on('respuesta_conexion', (data: any) => {
          callbacksRef.current.onConexion?.(data);
        })
      );
    }

    if (onActualizacion) {
      unsubscribers.push(
        websocketService.on('actualizacion_robot', (estado: EstadoRobot) => {
          callbacksRef.current.onActualizacion?.(estado);
        })
      );
    }

    if (onRobotCambiado) {
      unsubscribers.push(
        websocketService.on('robot_cambiado', (data: any) => {
          callbacksRef.current.onRobotCambiado?.(data);
        })
      );
    }

    if (onEstado) {
      unsubscribers.push(
        websocketService.on('estado_robot', (estado: EstadoRobot) => {
          callbacksRef.current.onEstado?.(estado);
        })
      );
    }

    if (onError) {
      unsubscribers.push(
        websocketService.on('error', (error: any) => {
          callbacksRef.current.onError?.(error);
        })
      );
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []); // Array vacío = solo se ejecuta UNA VEZ

  const solicitarEstado = useCallback(() => {
    websocketService.solicitarEstado();
  }, []);

  const moverRobot = useCallback((angulos: number[]) => {
    websocketService.moverRobot(angulos);
  }, []);

  const isConnected = useCallback(() => {
    return websocketService.isConnected();
  }, []);

  return {
    solicitarEstado,
    moverRobot,
    isConnected,
  };
}
