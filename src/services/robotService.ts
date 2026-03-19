import api from './api';

// Tipos
export interface Robot {
  id: string;
  nombre: string;
  tipo: string;
  grados_libertad: number;
}

export interface RobotInfo {
  nombre: string;
  tipo: string;
  grados_libertad: number;
  tabla_dh: number[][];
  limites_articulares: [number, number][];
  archivos_stl: string[];
  ruta_stl: string;
  
  // Configuración detallada de eslabones
  eslabones?: Array<{
    id: number;
    nombre: string;
    archivo_stl: string;
    posicion_relativa: [number, number, number];
    rotacion_relativa: [number, number, number];
    eje_rotacion: string;
    color: string;
  }>;
  
  // Configuración opcional de visualización
  visualizacion?: {
    escala?: number;
    unidades?: string;
    posicion_inicial?: [number, number, number];
    rotacion_inicial?: [number, number, number];
    camara?: {
      posicion?: [number, number, number];
      fov?: number;
      min_distancia?: number;
      max_distancia?: number;
    };
  };
  
  // Configuración opcional de workspace
  workspace?: {
    alcance_maximo?: number;
    alcance_minimo?: number;
    altura_maxima?: number;
    altura_minima?: number;
    grid?: {
      tamaño?: number;
      division?: number;
    };
  };
  
  // Configuración opcional de materiales
  materiales?: {
    metalness?: number;
    roughness?: number;
    colores?: {
      base?: string;
      eslabones?: string;
      end_effector?: string;
    };
  };
  
  // Metadatos opcionales
  metadatos?: {
    fabricante?: string;
    modelo?: string;
    año?: number;
    carga_maxima?: number;
    repetibilidad?: number;
    velocidad_maxima?: number[];
  };
}

export interface Posicion {
  x: number;
  y: number;
  z: number;
}

export interface Orientacion {
  euler: {
    roll: number;
    pitch: number;
    yaw: number;
  };
  cuaternion: {
    w: number;
    x: number;
    y: number;
    z: number;
  };
}

export interface EstadoRobot {
  success: boolean;
  angulos: number[];
  posicion: Posicion;
  orientacion: Orientacion;
  transformaciones?: number[][][];
}

// Servicios de la API

/**
 * Verificar estado del servidor
 */
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

/**
 * Obtener lista de robots disponibles
 */
export const getRobotsList = async () => {
  const response = await api.get<{
    success: boolean;
    robots: Robot[];
    robot_actual: string;
  }>('/api/robots/lista');
  return response.data;
};

/**
 * Seleccionar un robot
 */
export const selectRobot = async (robotId: string) => {
  const response = await api.post<{
    success: boolean;
    robot: RobotInfo;
    estado: EstadoRobot;
  }>('/api/robot/seleccionar', { robot_id: robotId });
  return response.data;
};

/**
 * Obtener información del robot actual
 */
export const getRobotInfo = async () => {
  const response = await api.get<{
    success: boolean;
    robot: RobotInfo;
  }>('/api/robot/info');
  return response.data;
};

/**
 * Obtener estado actual del robot
 */
export const getRobotState = async () => {
  const response = await api.get<EstadoRobot>('/api/robot/estado');
  return response.data;
};

/**
 * Mover el robot a ángulos específicos
 */
export const moveRobot = async (angulos: number[]) => {
  const response = await api.post<EstadoRobot>('/api/robot/mover', { angulos });
  return response.data;
};

/**
 * Mover el robot a posición home
 */
export const moveToHome = async () => {
  const response = await api.post<EstadoRobot>('/api/robot/home');
  return response.data;
};

/**
 * Calcular cinemática directa sin mover el robot
 */
export const calculateForwardKinematics = async (angulos: number[]) => {
  const response = await api.post<EstadoRobot>('/api/cinematica/directa', { angulos });
  return response.data;
};
