import { useState, useEffect, useCallback } from 'react';
import {
  getRobotsList,
  selectRobot,
  getRobotInfo,
  getRobotState,
  moveRobot,
  moveToHome,
  Robot,
  RobotInfo,
  EstadoRobot,
} from '../../services/robotService';
import { useWebSocket } from './useWebSocket';

export function useRobotState() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [currentRobotId, setCurrentRobotId] = useState<string>('');
  const [robotInfo, setRobotInfo] = useState<RobotInfo | null>(null);
  const [estado, setEstado] = useState<EstadoRobot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // WebSocket callbacks (opcional - la app funciona sin WebSocket)
  const { solicitarEstado, moverRobot: moverRobotWS } = useWebSocket({
    onConexion: (data) => {
      console.log('WebSocket conectado:', data);
      setConnected(true);
      if (data.estado_actual) {
        setEstado(data.estado_actual);
      }
    },
    onActualizacion: (nuevoEstado) => {
      console.log('Actualización del robot:', nuevoEstado);
      setEstado(nuevoEstado);
    },
    onRobotCambiado: async (data) => {
      console.log('Robot cambiado:', data);
      setCurrentRobotId(data.robot_id);
      await loadRobotInfo();
    },
    onError: (err) => {
      console.warn('Error WebSocket (no crítico):', err);
      // No mostrar error al usuario, la app funciona sin WebSocket
    },
  });

  // Cargar lista de robots al montar
  useEffect(() => {
    loadRobotsList();
  }, []);

  // Cargar información del robot cuando cambia
  useEffect(() => {
    if (currentRobotId) {
      loadRobotInfo();
      loadRobotState();
    }
  }, [currentRobotId]);

  // Polling para actualizar estado si WebSocket no está conectado
  useEffect(() => {
    if (!connected) {
      const interval = setInterval(() => {
        loadRobotState();
      }, 2000); // Actualizar cada 2 segundos

      return () => clearInterval(interval);
    }
  }, [connected]);

  /**
   * Cargar lista de robots disponibles
   */
  const loadRobotsList = async () => {
    try {
      setLoading(true);
      const data = await getRobotsList();
      setRobots(data.robots);
      setCurrentRobotId(data.robot_actual);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar robots');
      console.error('Error cargando robots:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cargar información del robot actual
   */
  const loadRobotInfo = async () => {
    try {
      const data = await getRobotInfo();
      setRobotInfo(data.robot);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar información del robot');
      console.error('Error cargando info:', err);
    }
  };

  /**
   * Cargar estado actual del robot
   */
  const loadRobotState = async () => {
    try {
      const data = await getRobotState();
      setEstado(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar estado del robot');
      console.error('Error cargando estado:', err);
    }
  };

  /**
   * Seleccionar un robot diferente
   */
  const handleSelectRobot = async (robotId: string) => {
    try {
      setLoading(true);
      const data = await selectRobot(robotId);
      setCurrentRobotId(robotId);
      setRobotInfo(data.robot);
      setEstado(data.estado);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al seleccionar robot');
      console.error('Error seleccionando robot:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mover el robot a ángulos específicos
   */
  const handleMoveRobot = async (angulos: number[]) => {
    try {
      setLoading(true);
      
      // Usar WebSocket si está conectado, sino usar API REST
      if (connected) {
        console.log('[Robot] Moviendo via WebSocket');
        moverRobotWS(angulos);
        // El estado se actualizará via evento 'actualizacion_robot'
        setError(null);
      } else {
        console.log('[Robot] Moviendo via API REST');
        const data = await moveRobot(angulos);
        if (data.success) {
          setEstado(data);
          setError(null);
        } else {
          setError('Error al mover el robot');
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al mover robot';
      setError(errorMsg);
      console.error('Error moviendo robot:', err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mover el robot a posición home
   */
  const handleMoveToHome = async () => {
    try {
      setLoading(true);
      const data = await moveToHome();
      setEstado(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al mover a home');
      console.error('Error moviendo a home:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    // Estado
    robots,
    currentRobotId,
    robotInfo,
    estado,
    loading,
    error,
    connected,
    
    // Acciones
    selectRobot: handleSelectRobot,
    moveRobot: handleMoveRobot,
    moveToHome: handleMoveToHome,
    refreshState: loadRobotState,
    clearError: () => setError(null),
  };
}
