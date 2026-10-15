import api from './api';

export interface MarcadorDetectado {
  id: number;
  esquinas_px: [number, number][];
  centro_px: [number, number];
}

export type FuenteVision = 'sintetico' | 'camara_fisica';
export type EstadoDeteccionVision =
  | 'completa'
  | 'parcial'
  | 'perdida'
  | 'sin_marcadores'
  | 'error_camara'
  | 'inactiva';

export interface VariacionMarcador {
  std_px: number;
  max_px: number;
  muestras: number;
}

export interface DiagnosticoVision {
  frames_evaluados: number;
  frames_completos: number;
  frames_parciales: number;
  frames_perdidos: number;
  porcentaje_cuatro_marcadores: number;
  porcentaje_reciente_cuatro_marcadores: number;
  tiempo_procesamiento_ms: {
    actual: number;
    promedio: number;
    maximo: number;
  };
  variacion_esquinas_px: {
    std_global_px: number;
    max_desplazamiento_px: number;
    estabilidad: 'estable' | 'moderada' | 'inestable' | 'sin_datos';
    ventana_muestras: number;
    por_marcador: Record<string, VariacionMarcador>;
  };
  candidatos_rechazados: number;
}

export interface ValidacionDistancia {
  puntos_px: [number, number][];
  puntos_mm: [number, number][];
  distancia_px: number;
  distancia_medida_mm: number;
  distancia_real_mm: number;
  error_absoluto_mm: number;
  error_porcentual: number;
  fecha: string;
}

export interface CalibracionHomografia {
  valida: boolean;
  origen: 'manual_4_esquinas' | 'aruco_4_marcadores' | null;
  esquinas_px: [number, number][];
  esquinas_mm: [number, number][];
  dimensiones_mm: {
    ancho: number;
    alto: number;
  };
  lados_px: {
    superior: number;
    derecho: number;
    inferior: number;
    izquierdo: number;
    ancho_medio: number;
    alto_medio: number;
  } | null;
  escala: {
    mm_por_px_x: number;
    mm_por_px_y: number;
    mm_por_px_media: number;
    px_por_mm_media: number;
    relacion_perspectiva_h: number;
    relacion_perspectiva_v: number;
  } | null;
  homografia_px_a_mm: number[][] | null;
  homografia_mm_a_px: number[][] | null;
  error_reproyeccion_px: number | null;
  error_reproyeccion_mm: number | null;
  validacion_distancia: ValidacionDistancia | null;
  resolucion_calibracion?: [number, number];
  es_simulacion?: boolean;
  fecha: string | null;
}

export interface EstadoVision {
  activa: boolean;
  fuente: FuenteVision;
  es_simulacion: boolean;
  apto_calibracion_fisica: boolean;
  motivo_bloqueo_fisico: string;
  indice_camara: number;
  diccionario: string;
  resolucion: [number, number];
  autofocus: boolean;
  marcadores_esperados: number[];
  marcadores_simulados: number[];
  marcadores_detectados: MarcadorDetectado[];
  cantidad_detectados: number;
  ids_detectados: number[];
  ids_faltantes: number[];
  estado_deteccion: EstadoDeteccionVision;
  fps: number;
  error_camara: string | null;
  ultima_actualizacion: string | null;
  diagnostico?: DiagnosticoVision;
  calibracion_homografia?: CalibracionHomografia;
}

export interface ConfiguracionVisionPayload {
  activa?: boolean;
  fuente?: FuenteVision;
  indice_camara?: number;
  diccionario?: string;
  resolucion?: [number, number];
  autofocus?: boolean;
  marcadores_simulados?: number[];
  reset_diagnostico?: boolean;
}

export const getVisionStreamUrl = (cacheBuster?: number): string => {
  const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:5050';
  const suffix = cacheBuster ? `?t=${cacheBuster}` : '';
  return `${baseUrl}/api/vision/stream${suffix}`;
};

export const obtenerEstadoVision = async () => {
  const response = await api.get<{
    success: boolean;
    vision: EstadoVision;
    diccionarios_disponibles: string[];
  }>('/api/vision/estado');
  return response.data;
};

export const configurarVision = async (payload: ConfiguracionVisionPayload) => {
  const response = await api.post<{
    success: boolean;
    vision: EstadoVision;
    error?: string;
  }>('/api/vision/configurar', payload);
  return response.data;
};

export const resetearDiagnosticoVision = async () => {
  const response = await api.post<{
    success: boolean;
    vision: EstadoVision;
  }>('/api/vision/diagnostico/reset');
  return response.data;
};

export const calcularHomografiaVision = async (payload: {
  esquinas_px?: [number, number][];
  usar_aruco?: boolean;
  ancho_mm: number;
  alto_mm: number;
}) => {
  const response = await api.post<{
    success: boolean;
    calibracion: CalibracionHomografia;
    vision: EstadoVision;
    error?: string;
  }>('/api/vision/homografia/calcular', payload);
  return response.data;
};

export const validarDistanciaHomografia = async (payload: {
  puntos_px: [number, number][];
  distancia_real_mm?: number;
}) => {
  const response = await api.post<{
    success: boolean;
    resultado: {
      puntos_px: [number, number][];
      puntos_mm: [number, number][];
      distancia_px?: number;
      distancia_medida_mm?: number;
      validacion?: ValidacionDistancia;
    };
    vision: EstadoVision;
    error?: string;
  }>('/api/vision/homografia/validar', payload);
  return response.data;
};

export const resetearHomografiaVision = async () => {
  const response = await api.post<{
    success: boolean;
    calibracion: CalibracionHomografia;
    vision: EstadoVision;
  }>('/api/vision/homografia/reset');
  return response.data;
};
