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

export type EstadoCalibracion =
  | 'SIN_CALIBRAR'
  | 'CONFIGURACION_INCOMPLETA'
  | 'CALCULANDO'
  | 'CALIBRACION_VIRTUAL_VALIDA'
  | 'CALIBRACION_FISICA_PENDIENTE'
  | 'CALIBRACION_FISICA_VALIDADA'
  | 'CALIBRACION_INVALIDA';

export type ModoCalibracion = 'virtual' | 'fisica';

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

export interface MarcadorPlaca {
  id: number;
  centro_mm: [number, number];
  tamano_mm: number;
  orientacion_deg?: number;
}

export interface ZonaPreparacion {
  id: string;
  nombre: string;
  color: string;
  poligono_mm: [number, number][];
}

export interface GeometriaPlaca {
  id_configuracion: string;
  unidades: string;
  dimensiones_mm: {
    ancho: number;
    alto: number;
  };
  origen_sistema: string;
  direccion_ejes: {
    eje_x: string;
    eje_y: string;
  };
  es_demostracion: boolean;
  marcadores: MarcadorPlaca[];
  zonas_preparacion?: ZonaPreparacion[];
}

export interface CalibracionVirtual {
  schema_version?: string;
  valida: boolean;
  modo: ModoCalibracion;
  estado: EstadoCalibracion;
  apto_para_robot: boolean;
  advertencia_seguridad: string;
  motivos_invalidez: string[];
  id_configuracion?: string;
  unidades?: string;
  origen_sistema?: string;
  direccion_ejes?: {
    eje_x: string;
    eje_y: string;
  };
  dimensiones_mm: {
    ancho: number;
    alto: number;
  };
  es_demostracion?: boolean;
  marcadores?: MarcadorPlaca[];
  marcadores_esperados?: number[];
  resolucion_asociada?: [number, number];
  es_simulacion?: boolean;
  fecha_calculo: string | null;
  homografia_px_a_mm: number[][] | null;
  homografia_mm_a_px: number[][] | null;
  num_correspondencias?: number;
  error_ajuste?: {
    rms_mm: number | null;
    max_mm: number | null;
    rms_px: number | null;
  };
  error_validacion_independiente?: {
    num_puntos_validacion: number;
    rms_mm: number | null;
    max_mm: number | null;
    estado: string;
  };
  escala_estimada?: {
    mm_por_px_x: number;
    mm_por_px_y: number;
    mm_por_px_media: number;
    px_por_mm_media: number;
  };
  zonas_preparacion?: ZonaPreparacion[];
  origen?: string | null;
  esquinas_px?: [number, number][];
  esquinas_mm?: [number, number][];
  lados_px?: {
    superior: number;
    derecho: number;
    inferior: number;
    izquierdo: number;
    ancho_medio: number;
    alto_medio: number;
  } | null;
  escala?: {
    mm_por_px_x: number;
    mm_por_px_y: number;
    mm_por_px_media: number;
    px_por_mm_media: number;
    relacion_perspectiva_h?: number;
    relacion_perspectiva_v?: number;
  } | null;
  error_reproyeccion_px?: number | null;
  error_reproyeccion_mm?: number | null;
  validacion_distancia?: ValidacionDistancia | null;
  fecha?: string | null;
}

export type CalibracionHomografia = CalibracionVirtual;

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
  geometria_placa?: GeometriaPlaca;
  calibracion_virtual?: CalibracionVirtual;
  calibracion_homografia?: CalibracionVirtual;
  modo_calibracion?: ModoCalibracion;
  estado_calibracion?: EstadoCalibracion;
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

export interface PuntoTransformadoMesa {
  punto_px: [number, number];
  punto_mesa_mm: [number, number];
  dentro_area_trabajo: boolean;
  distancia_fuera_mm: number;
  unidades: string;
  es_estimacion_planar: boolean;
}

export interface PuntoTransformadoImagen {
  punto_mesa_mm: [number, number];
  punto_px: [number, number];
  dentro_imagen: boolean;
}

export const getVisionStreamUrl = (cacheBuster?: number): string => {
  const baseUrl = api.defaults.baseURL !== undefined ? api.defaults.baseURL : '';
  const suffix = cacheBuster ? `?t=${cacheBuster}` : '';
  return `${baseUrl}/api/vision/stream${suffix}`;
};

export const getVisionProcessedUrl = (cacheBuster?: number): string => {
  const baseUrl = api.defaults.baseURL !== undefined ? api.defaults.baseURL : '';
  const suffix = cacheBuster ? `?t=${cacheBuster}` : '';
  return `${baseUrl}/api/vision/procesada${suffix}`;
};

export const capturarImagen = async () => {
  const response = await api.post<{
    success: boolean;
    filename: string;
    rel_path: string;
    error?: string;
  }>('/api/vision/capturar');
  return response.data;
};

export const iniciarVision = async () => {
  const response = await api.post<{
    success: boolean;
    vision: EstadoVision;
  }>('/api/vision/iniciar');
  return response.data;
};

export const detenerVision = async () => {
  const response = await api.post<{
    success: boolean;
    vision: EstadoVision;
  }>('/api/vision/detener');
  return response.data;
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

export const obtenerGeometriaPlaca = async () => {
  const response = await api.get<{
    success: boolean;
    geometria: GeometriaPlaca;
    error?: string;
  }>('/api/vision/calibracion/geometria');
  return response.data;
};

export const actualizarGeometriaPlaca = async (payload: GeometriaPlaca) => {
  const response = await api.post<{
    success: boolean;
    geometria: GeometriaPlaca;
    vision: EstadoVision;
    error?: string;
  }>('/api/vision/calibracion/geometria', payload);
  return response.data;
};

export const calcularCalibracionVirtual = async (payload?: {
  usar_aruco?: boolean;
  modo?: ModoCalibracion;
  puntos_validacion_independiente_ids?: number[];
  ancho_mm?: number;
  alto_mm?: number;
  correspondencias_px?: [number, number][];
  correspondencias_mm?: [number, number][];
}) => {
  const response = await api.post<{
    success: boolean;
    calibracion: CalibracionVirtual;
    vision: EstadoVision;
    error?: string;
  }>('/api/vision/calibracion/calcular', payload || {});
  return response.data;
};

export const transformarPxAMesa = async (payload: { u: number; v: number } | { puntos_px: [number, number][] }) => {
  const response = await api.post<{
    success: boolean;
    resultado: PuntoTransformadoMesa | { puntos_transformados: PuntoTransformadoMesa[]; calibracion_modo: string; unidades: string };
    error?: string;
  }>('/api/vision/calibracion/transformar/px-a-mm', payload);
  return response.data;
};

export const transformarMesaAPx = async (payload: { x: number; y: number } | { puntos_mm: [number, number][] }) => {
  const response = await api.post<{
    success: boolean;
    resultado: PuntoTransformadoImagen | { puntos_transformados: PuntoTransformadoImagen[]; calibracion_modo: string };
    error?: string;
  }>('/api/vision/calibracion/transformar/mm-a-px', payload);
  return response.data;
};

export const guardarCalibracionVirtual = async () => {
  const response = await api.post<{
    success: boolean;
    mensaje: string;
    calibracion: CalibracionVirtual;
    geometria: GeometriaPlaca;
    error?: string;
  }>('/api/vision/calibracion/guardar');
  return response.data;
};

export const invalidarCalibracionVirtual = async (motivo?: string) => {
  const response = await api.post<{
    success: boolean;
    calibracion: CalibracionVirtual;
    vision: EstadoVision;
    error?: string;
  }>('/api/vision/calibracion/invalidar', { motivo });
  return response.data;
};

export const resetearCalibracionVirtual = async () => {
  const response = await api.post<{
    success: boolean;
    resultado: { geometria_placa: GeometriaPlaca; calibracion: CalibracionVirtual };
    vision: EstadoVision;
    error?: string;
  }>('/api/vision/calibracion/reset');
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
    calibracion: CalibracionVirtual;
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

export const detectarObjetos = async () => {
  const response = await api.post<{
    success: boolean;
    piezas_detectadas: number;
    piezas: any[];
    error?: string;
  }>('/api/vision/detectar');
  return response.data;
};

export const resetearHomografiaVision = async () => {
  const response = await api.post<{
    success: boolean;
    calibracion: CalibracionVirtual;
    vision: EstadoVision;
  }>('/api/vision/homografia/reset');
  return response.data;
};
