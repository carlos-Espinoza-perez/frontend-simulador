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

    },
  });

  useEffect(() => {
    loadRobotsList();
  }, []);

  useEffect(() => {
    if (currentRobotId) {
      loadRobotInfo();
      loadRobotState();
    }
  }, [currentRobotId]);

  useEffect(() => {
    if (!connected) {
      const interval = setInterval(() => {
        loadRobotState();
      }, 2000); // Actualizar cada 2 segundos

      return () => clearInterval(interval);
    }
  }, [connected]);

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

  const handleMoveRobot = async (angulos: number[]) => {
    try {
      setLoading(true);

      if (connected) {
        console.log('[Robot] Moviendo via WebSocket');
        moverRobotWS(angulos);

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

    robots,
    currentRobotId,
    robotInfo,
    estado,
    loading,
    error,
    connected,

    selectRobot: handleSelectRobot,
    moveRobot: handleMoveRobot,
    moveToHome: handleMoveToHome,
    refreshState: loadRobotState,
    clearError: () => setError(null),
  };
}
