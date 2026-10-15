import { useState, useEffect, useCallback, useRef } from 'react';
import {
  VideoOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Eye,
  RotateCcw,
  Activity,
  Clock,
  Crosshair,
  Layers,
  ArrowLeft,
  Ruler,
  Grid,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  EstadoVision,
  FuenteVision,
  CalibracionHomografia,
  obtenerEstadoVision,
  configurarVision,
  resetearDiagnosticoVision,
  calcularHomografiaVision,
  validarDistanciaHomografia,
  resetearHomografiaVision,
  getVisionStreamUrl,
} from '../../services/visionService';

interface VisionCalibrationPanelProps {
  isActive: boolean;
  onClose: () => void;
}

const ETIQUETAS_ESQUINAS = [
  'P1: Sup-Izq (0, 0)',
  'P2: Sup-Der (Ancho, 0)',
  'P3: Inf-Der (Ancho, Alto)',
  'P4: Inf-Izq (0, Alto)',
];

export function VisionCalibrationPanel({ isActive, onClose }: VisionCalibrationPanelProps) {
  const [vision, setVision] = useState<EstadoVision | null>(null);
  const [diccionarios, setDiccionarios] = useState<string[]>(['DICT_4X4_50']);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState<number>(() => Date.now());

  const [etapaActiva, setEtapaActiva] = useState<'diagnostico' | 'homografia'>('diagnostico');
  const [subTabDiag, setSubTabDiag] = useState<'metricas' | 'esquinas'>('metricas');

  const [esquinasManuales, setEsquinasManuales] = useState<[number, number][]>([]);
  const [anchoMm, setAnchoMm] = useState<number>(220);
  const [altoMm, setAltoMm] = useState<number>(140);
  const [indiceArrastre, setIndiceArrastre] = useState<number | null>(null);

  const [modoCursor, setModoCursor] = useState<'esquinas' | 'validar'>('esquinas');
  const [puntosValidacionPx, setPuntosValidacionPx] = useState<[number, number][]>([]);
  const [puntosValidacionMm, setPuntosValidacionMm] = useState<[number, number][]>([]);
  const [distanciaMedidaMm, setDistanciaMedidaMm] = useState<number | null>(null);
  const [distanciaRealInput, setDistanciaRealInput] = useState<number>(100);

  const svgOverlayRef = useRef<SVGSVGElement | null>(null);
  const inicializadoCalRef = useRef<boolean>(false);

  const sincronizarDesdeCalibracion = useCallback((cal?: CalibracionHomografia) => {
    if (!cal || inicializadoCalRef.current) return;
    if (cal.dimensiones_mm) {
      setAnchoMm(cal.dimensiones_mm.ancho);
      setAltoMm(cal.dimensiones_mm.alto);
    }
    if (cal.esquinas_px && cal.esquinas_px.length === 4) {
      setEsquinasManuales(cal.esquinas_px);
      inicializadoCalRef.current = true;
    }
  }, []);

  const cargarEstado = useCallback(async () => {
    try {
      const res = await obtenerEstadoVision();
      if (res.success) {
        setVision(res.vision);
        sincronizarDesdeCalibracion(res.vision.calibracion_homografia);
        if (res.diccionarios_disponibles?.length) {
          setDiccionarios(res.diccionarios_disponibles);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'No se pudo consultar el estado de visión');
    }
  }, [sincronizarDesdeCalibracion]);

  useEffect(() => {
    if (!isActive) return;
    let cancelado = false;

    const sincronizarAlAbrir = async () => {
      try {
        const res = await obtenerEstadoVision();
        if (cancelado) return;
        if (res.diccionarios_disponibles?.length) {
          setDiccionarios(res.diccionarios_disponibles);
        }
        sincronizarDesdeCalibracion(res.vision.calibracion_homografia);
        if (!res.vision.activa) {
          const activado = await configurarVision({ activa: true });
          if (!cancelado && activado.success) {
            setVision(activado.vision);
            setStreamKey(Date.now());
          }
        } else {
          setVision(res.vision);
        }
      } catch (err: any) {
        if (!cancelado) {
          setErrorMsg(err?.response?.data?.error || 'Error conectando con el módulo de visión');
        }
      }
    };

    sincronizarAlAbrir();
    const timer = setInterval(cargarEstado, 450);

    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, [isActive, cargarEstado, sincronizarDesdeCalibracion]);

  const resW = vision?.resolucion?.[0] || 1280;
  const resH = vision?.resolucion?.[1] || 720;

  const convertirEventoAPixelOriginal = (
    clientX: number,
    clientY: number
  ): [number, number] | null => {
    const svg = svgOverlayRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const u = Math.max(0, Math.min(resW, ((clientX - rect.left) / rect.width) * resW));
    const v = Math.max(0, Math.min(resH, ((clientY - rect.top) / rect.height) * resH));
    return [Math.round(u * 10) / 10, Math.round(v * 10) / 10];
  };

  const handleSvgMouseDown = async (e: React.MouseEvent<SVGSVGElement>) => {
    if (etapaActiva !== 'homografia') return;
    const pt = convertirEventoAPixelOriginal(e.clientX, e.clientY);
    if (!pt) return;

    if (modoCursor === 'esquinas') {
      // Si se hace clic cerca de una esquina ya colocada, iniciar arrastre
      const radioEnganche = Math.max(resW, resH) * 0.022;
      const idxCercano = esquinasManuales.findIndex(
        (p) => Math.hypot(p[0] - pt[0], p[1] - pt[1]) <= radioEnganche
      );
      if (idxCercano !== -1) {
        setIndiceArrastre(idxCercano);
        return;
      }

      if (esquinasManuales.length < 4) {
        setEsquinasManuales((prev) => [...prev, pt]);
      } else {
        // Si ya hay 4, mover la esquina más cercana al clic
        let mejorIdx = 0;
        let mejorDist = Infinity;
        esquinasManuales.forEach((p, idx) => {
          const d = Math.hypot(p[0] - pt[0], p[1] - pt[1]);
          if (d < mejorDist) {
            mejorDist = d;
            mejorIdx = idx;
          }
        });
        setEsquinasManuales((prev) => prev.map((p, i) => (i === mejorIdx ? pt : p)));
        setIndiceArrastre(mejorIdx);
      }
    } else if (modoCursor === 'validar') {
      const nuevos = puntosValidacionPx.length >= 2 ? [pt] : [...puntosValidacionPx, pt];
      setPuntosValidacionPx(nuevos);
      setPuntosValidacionMm([]);
      setDistanciaMedidaMm(null);

      if (vision?.calibracion_homografia?.valida) {
        try {
          const r = await validarDistanciaHomografia({ puntos_px: nuevos });
          if (r.success) {
            setPuntosValidacionMm(r.resultado.puntos_mm);
            if (r.resultado.distancia_medida_mm !== undefined) {
              setDistanciaMedidaMm(r.resultado.distancia_medida_mm);
            }
          }
        } catch (err: any) {
          setErrorMsg(err?.response?.data?.error || 'Error proyectando punto con homografía');
        }
      }
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (indiceArrastre === null) return;
    const pt = convertirEventoAPixelOriginal(e.clientX, e.clientY);
    if (!pt) return;
    setEsquinasManuales((prev) => prev.map((p, i) => (i === indiceArrastre ? pt : p)));
  };

  const handleSvgMouseUp = () => {
    if (indiceArrastre !== null) {
      setIndiceArrastre(null);
    }
  };

  const handleCalcularHomografiaManual = async () => {
    if (esquinasManuales.length !== 4) {
      setErrorMsg('Selecciona primero las 4 esquinas en el video (P1, P2, P3, P4).');
      return;
    }
    setCargando(true);
    setErrorMsg(null);
    try {
      const res = await calcularHomografiaVision({
        esquinas_px: esquinasManuales,
        usar_aruco: false,
        ancho_mm: anchoMm,
        alto_mm: altoMm,
      });
      if (res.success) {
        setVision(res.vision);
        setEsquinasManuales(res.calibracion.esquinas_px);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'No se pudo calcular la homografía');
    } finally {
      setCargando(false);
    }
  };

  const handleAutoTomarDeAruco = async () => {
    setCargando(true);
    setErrorMsg(null);
    try {
      const res = await calcularHomografiaVision({
        usar_aruco: true,
        ancho_mm: anchoMm,
        alto_mm: altoMm,
      });
      if (res.success) {
        setVision(res.vision);
        setEsquinasManuales(res.calibracion.esquinas_px);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.error ||
          'Deben detectarse los 4 marcadores ArUco (0, 1, 2, 3) para auto-tomar las esquinas'
      );
    } finally {
      setCargando(false);
    }
  };

  const handleConfirmarValidacionDistancia = async () => {
    if (puntosValidacionPx.length !== 2) {
      setErrorMsg('Haz clic en 2 puntos sobre el video (A y B) para validar la distancia.');
      return;
    }
    setCargando(true);
    setErrorMsg(null);
    try {
      const res = await validarDistanciaHomografia({
        puntos_px: puntosValidacionPx,
        distancia_real_mm: distanciaRealInput,
      });
      if (res.success) {
        setVision(res.vision);
        setPuntosValidacionMm(res.resultado.puntos_mm);
        if (res.resultado.distancia_medida_mm !== undefined) {
          setDistanciaMedidaMm(res.resultado.distancia_medida_mm);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Error al validar la distancia física');
    } finally {
      setCargando(false);
    }
  };

  const handleLimpiarHomografia = async () => {
    setEsquinasManuales([]);
    setPuntosValidacionPx([]);
    setPuntosValidacionMm([]);
    setDistanciaMedidaMm(null);
    try {
      const res = await resetearHomografiaVision();
      if (res.success) {
        setVision(res.vision);
      }
    } catch {
      // Ignorar error local
    }
  };

  const aplicarConfiguracion = async (cambios: Parameters<typeof configurarVision>[0]) => {
    setCargando(true);
    setErrorMsg(null);
    try {
      const res = await configurarVision(cambios);
      if (res.success) {
        setVision(res.vision);
        if (
          cambios.fuente !== undefined ||
          cambios.indice_camara !== undefined ||
          cambios.resolucion !== undefined ||
          cambios.activa === true
        ) {
          setStreamKey(Date.now());
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Error aplicando configuración de cámara');
    } finally {
      setCargando(false);
    }
  };

  const handleResetDiagnostico = async () => {
    try {
      const res = await resetearDiagnosticoVision();
      if (res.success) {
        setVision(res.vision);
      }
    } catch {
      setErrorMsg('No se pudo reiniciar el diagnóstico');
    }
  };

  const handleCambiarFuente = (valor: string) => {
    if (valor === 'sintetico') {
      aplicarConfiguracion({
        fuente: 'sintetico' as FuenteVision,
        activa: true,
        reset_diagnostico: true,
      });
    } else {
      const idx = parseInt(valor.replace('cam_', ''), 10);
      aplicarConfiguracion({
        fuente: 'camara_fisica' as FuenteVision,
        indice_camara: idx,
        activa: true,
        reset_diagnostico: true,
      });
    }
  };

  const handleToggleMarcadorSimulado = (id: number) => {
    if (!vision) return;
    const actuales = vision.marcadores_simulados || [0, 1, 2, 3];
    const nuevos = actuales.includes(id)
      ? actuales.filter((m) => m !== id)
      : [...actuales, id].sort();
    aplicarConfiguracion({ marcadores_simulados: nuevos });
  };

  const valorSelectorFuente =
    vision?.fuente === 'camara_fisica' ? `cam_${vision.indice_camara}` : 'sintetico';

  const diag = vision?.diagnostico;
  const cal = vision?.calibracion_homografia;
  const estadoDet = vision?.estado_deteccion || 'inactiva';

  const renderBadgeEstadoDeteccion = () => {
    if (estadoDet === 'completa') {
      return (
        <span className="px-3 py-1 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          COMPLETA (4/4)
        </span>
      );
    }
    if (estadoDet === 'parcial') {
      return (
        <span className="px-3 py-1 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          PARCIAL ({vision?.cantidad_detectados ?? 0}/4)
        </span>
      );
    }
    if (estadoDet === 'perdida' || estadoDet === 'sin_marcadores') {
      return (
        <span className="px-3 py-1 rounded-md text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          PERDIDA (0/4)
        </span>
      );
    }
    if (estadoDet === 'error_camara') {
      return (
        <span className="px-3 py-1 rounded-md text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
          ERROR DE CÁMARA
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-md text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
        INACTIVA
      </span>
    );
  };

  const renderBadgeEstabilidad = () => {
    const est = diag?.variacion_esquinas_px.estabilidad || 'sin_datos';
    if (est === 'estable') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Estable (&lt; 0.75 px)
        </span>
      );
    }
    if (est === 'moderada') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Vibración Moderada
        </span>
      );
    }
    if (est === 'inestable') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
          Inestable / En movimiento
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] bg-white/5 text-gray-400 border border-white/10">
        Esperando muestras...
      </span>
    );
  };

  return (
    <div className="relative z-30 h-[calc(100vh-61px)] w-full flex flex-col bg-[#0a0e14]/95 text-white overflow-hidden">
      <div className="px-6 py-2.5 bg-black/40 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>Simulador 3D</span>
          </button>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEtapaActiva('diagnostico')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                etapaActiva === 'diagnostico'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                  : 'bg-white/[0.03] text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              1. Captura y Diagnóstico ArUco
            </button>
            <button
              onClick={() => setEtapaActiva('homografia')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border flex items-center gap-1.5 ${
                etapaActiva === 'homografia'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                  : 'bg-white/[0.03] text-gray-300 border-white/10 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>2. Escala, Homografía (4 Esquinas) y Validación</span>
              {cal?.valida && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              )}
            </button>
            <span className="px-3 py-1.5 rounded-md text-xs text-gray-500 bg-white/[0.02] border border-white/5">
              3. Editor de Zonas en mm (Próxima etapa)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/placa_aruco_4x4_50.png"
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/25 transition-colors"
          >
            Abrir Plantilla Oficial ArUco (IDs 0–3)
          </a>
          {renderBadgeEstadoDeteccion()}
        </div>
      </div>

      {vision?.es_simulacion && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>MODO SINTÉTICO (SIMULACIÓN):</strong> Entorno virtual de prueba. No habilita calibración física ni movimientos reales del ABB IRB 140.
            </span>
          </div>
          <span className="text-[11px] uppercase px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shrink-0">
            Ejecución Física Bloqueada
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-500/20 border-b border-red-500/30 px-6 py-2 text-xs text-red-300 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-300 hover:text-white">
            ✕
          </button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-y-auto">
        <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
          <div className="relative flex-1 min-h-[360px] bg-black/85 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center shadow-inner p-2">
            {isActive && vision?.activa ? (
              <div
                className="relative max-w-full max-h-full"
                style={{ aspectRatio: `${resW} / ${resH}`, width: '100%' }}
              >
                <img
                  key={streamKey}
                  src={getVisionStreamUrl(streamKey)}
                  alt="Stream de visión ArUco"
                  className="w-full h-full block select-none pointer-events-none rounded-lg"
                />

                <svg
                  ref={svgOverlayRef}
                  viewBox={`0 0 ${resW} ${resH}`}
                  onMouseDown={handleSvgMouseDown}
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={handleSvgMouseUp}
                  onMouseLeave={handleSvgMouseUp}
                  className={`absolute inset-0 w-full h-full ${
                    etapaActiva === 'homografia' ? 'cursor-crosshair' : 'pointer-events-none'
                  }`}
                >
                  {esquinasManuales.length >= 2 && (
                    <polygon
                      points={esquinasManuales.map((p) => `${p[0]},${p[1]}`).join(' ')}
                      fill="rgba(6, 182, 212, 0.12)"
                      stroke="#22d3ee"
                      strokeWidth={Math.max(2, resW * 0.0022)}
                      strokeDasharray={esquinasManuales.length === 4 ? 'none' : '8 6'}
                    />
                  )}

                  {esquinasManuales.length === 4 && (
                    <>
                      <line
                        x1={esquinasManuales[0][0]}
                        y1={esquinasManuales[0][1]}
                        x2={esquinasManuales[1][0]}
                        y2={esquinasManuales[1][1]}
                        stroke="#f97316"
                        strokeWidth={Math.max(3, resW * 0.003)}
                      />
                      <line
                        x1={esquinasManuales[0][0]}
                        y1={esquinasManuales[0][1]}
                        x2={esquinasManuales[3][0]}
                        y2={esquinasManuales[3][1]}
                        stroke="#10b981"
                        strokeWidth={Math.max(3, resW * 0.003)}
                      />
                    </>
                  )}

                  {esquinasManuales.map((pt, idx) => {
                    const r = Math.max(8, resW * 0.008);
                    const colores = ['#f97316', '#38bdf8', '#a855f7', '#10b981'];
                    return (
                      <g key={idx}>
                        <circle
                          cx={pt[0]}
                          cy={pt[1]}
                          r={r}
                          fill={colores[idx]}
                          stroke="#0a0e14"
                          strokeWidth={2.5}
                        />
                        <text
                          x={pt[0] + r + 5}
                          y={pt[1] - r}
                          fill="#ffffff"
                          fontSize={Math.max(14, resW * 0.013)}
                          fontWeight="bold"
                          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.95)' }}
                        >
                          P{idx + 1} ({pt[0].toFixed(0)}, {pt[1].toFixed(0)})
                        </text>
                      </g>
                    );
                  })}

                  {puntosValidacionPx.length >= 1 && (
                    <>
                      {puntosValidacionPx.length === 2 && (
                        <line
                          x1={puntosValidacionPx[0][0]}
                          y1={puntosValidacionPx[0][1]}
                          x2={puntosValidacionPx[1][0]}
                          y2={puntosValidacionPx[1][1]}
                          stroke="#facc15"
                          strokeWidth={Math.max(3, resW * 0.0028)}
                          strokeDasharray="6 4"
                        />
                      )}
                      {puntosValidacionPx.map((pt, idx) => {
                        const r = Math.max(7, resW * 0.007);
                        const mm = puntosValidacionMm[idx];
                        return (
                          <g key={`val_${idx}`}>
                            <circle
                              cx={pt[0]}
                              cy={pt[1]}
                              r={r}
                              fill="#facc15"
                              stroke="#000"
                              strokeWidth={2}
                            />
                            <text
                              x={pt[0] + r + 5}
                              y={pt[1] + r}
                              fill="#fde047"
                              fontSize={Math.max(14, resW * 0.013)}
                              fontWeight="bold"
                              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.95)' }}
                            >
                              {idx === 0 ? 'A' : 'B'}
                              {mm ? ` [${mm[0].toFixed(1)}, ${mm[1].toFixed(1)} mm]` : ''}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  )}
                </svg>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <VideoOff className="w-10 h-10" />
                <span className="text-xs">Captura de cámara detenida</span>
              </div>
            )}

            {vision?.activa && (
              <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-md border border-white/15 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs pointer-events-none">
                <span className="text-gray-300 font-medium">
                  {resW}×{resH}
                </span>
                <span className="text-cyan-400 font-semibold">{vision.fps.toFixed(1)} FPS</span>
                <span className="text-emerald-400">
                  {diag?.tiempo_procesamiento_ms.actual.toFixed(1) ?? '0.0'} ms/frame
                </span>
              </div>
            )}

            {etapaActiva === 'homografia' && vision?.activa && (
              <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md border border-amber-400/30 rounded-lg px-3 py-1.5 text-xs text-amber-200 pointer-events-none">
                {modoCursor === 'esquinas' ? (
                  <span>
                    Haz clic en las <strong>4 esquinas</strong> en sentido horario:{' '}
                    <strong>{ETIQUETAS_ESQUINAS[Math.min(3, esquinasManuales.length)]}</strong> (o arrastra para ajustar)
                  </span>
                ) : (
                  <span>
                    Modo validación: Haz clic en <strong>2 puntos (A y B)</strong> dentro del área calibrada para medir su distancia en mm.
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Fuente de Video</label>
              <select
                value={valorSelectorFuente}
                onChange={(e) => handleCambiarFuente(e.target.value)}
                disabled={cargando}
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="cam_0">Cámara USB #0 (C920)</option>
                <option value="cam_1">Cámara USB #1</option>
                <option value="cam_2">Cámara USB #2</option>
                <option value="sintetico">Sintético (Simulación)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Diccionario ArUco</label>
              <select
                value={vision?.diccionario || 'DICT_4X4_50'}
                onChange={(e) =>
                  aplicarConfiguracion({ diccionario: e.target.value, reset_diagnostico: true })
                }
                disabled={cargando}
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                {diccionarios.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Resolución de Captura</label>
              <select
                value={`${resW}x${resH}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  aplicarConfiguracion({ resolucion: [w, h], reset_diagnostico: true });
                }}
                disabled={cargando}
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="1280x720">1280 × 720 (HD)</option>
                <option value="1920x1080">1920 × 1080 (Full HD)</option>
                <option value="640x480">640 × 480 (VGA)</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => aplicarConfiguracion({ activa: !vision?.activa })}
                disabled={cargando}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  vision?.activa
                    ? 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                }`}
              >
                {vision?.activa ? 'Detener' : 'Iniciar'}
              </button>
              <button
                onClick={() => setStreamKey(Date.now())}
                title="Reconectar stream de video"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-gray-300 hover:bg-white/10"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {vision?.es_simulacion && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Simular visibilidad / oclusión de marcadores en mesa virtual:</span>
              </div>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3].map((id) => {
                  const activo = vision.marcadores_simulados?.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => handleToggleMarcadorSimulado(id)}
                      className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                        activo
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                          : 'bg-black/40 border-white/10 text-gray-500 line-through'
                      }`}
                    >
                      ID {id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 flex flex-col gap-3 min-h-0">
          {etapaActiva === 'diagnostico' ? (
            <>
              <div className="flex items-center justify-between bg-black/40 p-1.5 rounded-xl border border-white/10">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSubTabDiag('metricas')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      subTabDiag === 'metricas'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Diagnóstico de Detección</span>
                  </button>
                  <button
                    onClick={() => setSubTabDiag('esquinas')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      subTabDiag === 'esquinas'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Esquinas ArUco ({vision?.cantidad_detectados ?? 0}/4)</span>
                  </button>
                </div>

                <button
                  onClick={handleResetDiagnostico}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-gray-300 transition-colors"
                  title="Reiniciar contadores y varianza para medir con cámara quieta"
                >
                  <RotateCcw className="w-3 h-3 text-cyan-400" />
                  <span>Reiniciar Métricas</span>
                </button>
              </div>

              {subTabDiag === 'metricas' ? (
                <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        1. Tasa de Detección Completa (4/4 Marcadores)
                      </span>
                      <span className="text-xs text-gray-400">
                        {diag?.frames_completos ?? 0} / {diag?.frames_evaluados ?? 0} frames
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-black/40 border border-white/5 rounded-lg p-3">
                        <span className="text-[11px] text-gray-400 block">Acumulado Sesión</span>
                        <span className="text-2xl font-bold text-cyan-400">
                          {(diag?.porcentaje_cuatro_marcadores ?? 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-black/40 border border-white/5 rounded-lg p-3">
                        <span className="text-[11px] text-gray-400 block">Ventana Reciente (60f)</span>
                        <span className="text-2xl font-bold text-emerald-400">
                          {(diag?.porcentaje_reciente_cuatro_marcadores ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden mb-3 border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, diag?.porcentaje_cuatro_marcadores ?? 0)}%`,
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
                        <span className="text-[10px] text-emerald-300/80 block uppercase">
                          Completos (4/4)
                        </span>
                        <span className="font-semibold text-emerald-300">
                          {diag?.frames_completos ?? 0}
                        </span>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2">
                        <span className="text-[10px] text-amber-300/80 block uppercase">
                          Parciales (1–3)
                        </span>
                        <span className="font-semibold text-amber-300">
                          {diag?.frames_parciales ?? 0}
                        </span>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                        <span className="text-[10px] text-red-300/80 block uppercase">
                          Perdidos (0/4)
                        </span>
                        <span className="font-semibold text-red-300">
                          {diag?.frames_perdidos ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                        2. Variación de Esquinas (Cámara Quieta)
                      </span>
                      {renderBadgeEstabilidad()}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-black/40 border border-white/5 rounded-lg p-3">
                        <span className="text-[11px] text-gray-400 block">
                          Desviación Estándar (σ global)
                        </span>
                        <span className="text-lg font-bold text-white">
                          {(diag?.variacion_esquinas_px.std_global_px ?? 0).toFixed(3)}{' '}
                          <span className="text-xs font-normal text-gray-400">px</span>
                        </span>
                      </div>
                      <div className="bg-black/40 border border-white/5 rounded-lg p-3">
                        <span className="text-[11px] text-gray-400 block">
                          Oscilación Pico Máxima (Δ max)
                        </span>
                        <span className="text-lg font-bold text-amber-300">
                          {(diag?.variacion_esquinas_px.max_desplazamiento_px ?? 0).toFixed(3)}{' '}
                          <span className="text-xs font-normal text-gray-400">px</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {[0, 1, 2, 3].map((id) => {
                        const info = diag?.variacion_esquinas_px.por_marcador?.[String(id)];
                        return (
                          <div
                            key={id}
                            className="bg-black/40 border border-white/5 rounded p-2 text-center"
                          >
                            <span className="text-[11px] text-cyan-400 font-semibold block">
                              ID #{id}
                            </span>
                            {info && info.muestras >= 3 ? (
                              <>
                                <span className="text-white block mt-0.5">
                                  σ: {info.std_px.toFixed(2)} px
                                </span>
                                <span className="text-[10px] text-gray-500 block">
                                  máx: {info.max_px.toFixed(2)} px
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] text-gray-500 block mt-1">
                                Sin racha
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        3. Tiempo de Procesamiento y Estado
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Candidatos descartados: {diag?.candidatos_rechazados ?? 0}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-xs mb-3">
                      <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                        <span className="text-[11px] text-gray-400 block">Actual</span>
                        <span className="text-base font-semibold text-emerald-400">
                          {(diag?.tiempo_procesamiento_ms.actual ?? 0).toFixed(2)} ms
                        </span>
                      </div>
                      <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                        <span className="text-[11px] text-gray-400 block">Promedio (45f)</span>
                        <span className="text-base font-semibold text-white">
                          {(diag?.tiempo_procesamiento_ms.promedio ?? 0).toFixed(2)} ms
                        </span>
                      </div>
                      <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                        <span className="text-[11px] text-gray-400 block">Pico Máximo</span>
                        <span className="text-base font-semibold text-amber-300">
                          {(diag?.tiempo_procesamiento_ms.maximo ?? 0).toFixed(2)} ms
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setEtapaActiva('homografia')}
                      className="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-semibold text-amber-300 transition-colors"
                    >
                      Ir a Herramienta de 4 Esquinas, Escala y Homografía →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-wider text-gray-400">
                      Coordenadas de las 4 Esquinas por Marcador (px)
                    </span>
                    <span className="text-[11px] text-gray-500">Orden horario: E0, E1, E2, E3</span>
                  </div>

                  {vision?.marcadores_detectados && vision.marcadores_detectados.length > 0 ? (
                    <div className="space-y-2.5 overflow-y-auto pr-1">
                      {vision.marcadores_detectados.map((m) => (
                        <div
                          key={m.id}
                          className="bg-black/50 border border-white/10 rounded-lg p-3 text-xs"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-cyan-400">Marcador ID #{m.id}</span>
                            <span className="text-[11px] text-gray-400">
                              Centro: ({m.centro_px[0].toFixed(1)}, {m.centro_px[1].toFixed(1)}) px
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-gray-300">
                            {m.esquinas_px.map((esq, idx) => (
                              <div
                                key={idx}
                                className="bg-white/[0.03] px-2.5 py-1 rounded flex justify-between"
                              >
                                <span
                                  className={
                                    idx === 0 ? 'text-amber-400 font-semibold' : 'text-gray-500'
                                  }
                                >
                                  E{idx}:
                                </span>
                                <span>
                                  [{esq[0].toFixed(1)}, {esq[1].toFixed(1)}]
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-gray-500 text-center py-8">
                      No se detectan marcadores ArUco en el fotograma actual.
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
              <div className="flex items-center justify-between bg-black/40 p-1.5 rounded-xl border border-white/10">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setModoCursor('esquinas')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      modoCursor === 'esquinas'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>1. Marcar 4 Esquinas ({esquinasManuales.length}/4)</span>
                  </button>
                  <button
                    onClick={() => setModoCursor('validar')}
                    disabled={!cal?.valida}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      modoCursor === 'validar'
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/40'
                        : 'text-gray-400 hover:text-white disabled:opacity-40'
                    }`}
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>2. Validar Distancia Física</span>
                  </button>
                </div>

                <button
                  onClick={handleLimpiarHomografia}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 text-[11px] text-gray-300 hover:text-red-300 transition-colors"
                  title="Borrar las 4 esquinas y reiniciar homografía"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              </div>

              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-wider text-gray-400">
                    Selección de las 4 Esquinas y Tamaño Físico (mm)
                  </span>
                  <button
                    onClick={handleAutoTomarDeAruco}
                    disabled={cargando}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-[11px] text-cyan-300 transition-colors"
                    title="Tomar automáticamente las 4 esquinas exteriores de los ArUco IDs 0, 1, 2 y 3"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-tomar de 4 ArUco</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Ancho Físico (P1 → P2) [mm]
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={3000}
                      step={1}
                      value={anchoMm}
                      onChange={(e) => setAnchoMm(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Alto Físico (P1 → P4) [mm]
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={3000}
                      step={1}
                      value={altoMm}
                      onChange={(e) => setAltoMm(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 mb-3 text-xs">
                  {[0, 1, 2, 3].map((idx) => {
                    const pt = esquinasManuales[idx];
                    return (
                      <div
                        key={idx}
                        className="bg-black/40 border border-white/5 rounded px-2.5 py-1.5 flex items-center justify-between"
                      >
                        <span className="text-[11px] text-gray-400">
                          {ETIQUETAS_ESQUINAS[idx].split(' ')[0]}
                        </span>
                        {pt ? (
                          <span className="text-cyan-300 font-mono text-[11px]">
                            [{pt[0].toFixed(0)}, {pt[1].toFixed(0)}] px
                          </span>
                        ) : (
                          <span className="text-gray-600 text-[11px]">Haz clic en video</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleCalcularHomografiaManual}
                  disabled={cargando || esquinasManuales.length !== 4}
                  className="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 border border-amber-400/40 text-xs font-semibold text-amber-300 transition-colors"
                >
                  Calcular Escala Aproximada y Matriz de Homografía
                </button>
              </div>

              {cal?.valida && cal.escala && cal.lados_px && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                      Escala Aproximada y Homografía Activa
                    </span>
                    <span className="text-[11px] text-gray-400">
                      RMS ajuste: {cal.error_reproyeccion_px?.toFixed(3)} px
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                      <span className="text-[10px] text-gray-400 block uppercase">Escala Media</span>
                      <span className="text-base font-bold text-cyan-400">
                        {cal.escala.mm_por_px_media.toFixed(3)}
                      </span>
                      <span className="text-[10px] text-gray-500 block">mm / px</span>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                      <span className="text-[10px] text-gray-400 block uppercase">Eje X / Eje Y</span>
                      <span className="text-xs font-semibold text-white block mt-0.5">
                        X: {cal.escala.mm_por_px_x.toFixed(3)}
                      </span>
                      <span className="text-xs font-semibold text-white block">
                        Y: {cal.escala.mm_por_px_y.toFixed(3)}
                      </span>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                      <span className="text-[10px] text-gray-400 block uppercase">Densidad</span>
                      <span className="text-base font-bold text-emerald-400">
                        {cal.escala.px_por_mm_media.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-500 block">px / mm</span>
                    </div>
                  </div>

                  <div className="bg-black/50 border border-white/5 rounded-lg p-2.5 text-[11px]">
                    <div className="text-gray-400 mb-1 flex justify-between">
                      <span>Matriz Homografía H (px → mm):</span>
                      <span className="text-gray-500">
                        Lados: {cal.lados_px.ancho_medio}×{cal.lados_px.alto_medio} px
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-cyan-300 space-y-0.5">
                      {cal.homografia_px_a_mm?.map((fila, rIdx) => (
                        <div key={rIdx} className="grid grid-cols-3 gap-2">
                          {fila.map((val, cIdx) => (
                            <span key={cIdx} className="bg-white/[0.02] px-1.5 py-0.5 rounded">
                              {val.toExponential(3)}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-yellow-300 flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5" />
                    Validación con Distancia Física Conocida
                  </span>
                  <button
                    onClick={() => {
                      setModoCursor('validar');
                      setPuntosValidacionPx([]);
                      setPuntosValidacionMm([]);
                      setDistanciaMedidaMm(null);
                    }}
                    disabled={!cal?.valida}
                    className="text-[11px] px-2 py-0.5 rounded bg-yellow-500/15 border border-yellow-400/30 text-yellow-300 hover:bg-yellow-500/25 disabled:opacity-40"
                  >
                    Marcar Puntos A y B en Video
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-2.5 text-xs">
                  <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                    <span className="text-[11px] text-gray-400 block">
                      Distancia Medida (Homografía)
                    </span>
                    <span className="text-lg font-bold text-yellow-300">
                      {distanciaMedidaMm !== null
                        ? `${distanciaMedidaMm.toFixed(2)} mm`
                        : cal?.validacion_distancia
                        ? `${cal.validacion_distancia.distancia_medida_mm.toFixed(2)} mm`
                        : '—'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Distancia Física Conocida [mm]
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={3000}
                      step={0.5}
                      value={distanciaRealInput}
                      onChange={(e) => setDistanciaRealInput(Math.max(0.1, Number(e.target.value)))}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>

                <button
                  onClick={handleConfirmarValidacionDistancia}
                  disabled={!cal?.valida || puntosValidacionPx.length !== 2 || cargando}
                  className="w-full py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 disabled:opacity-40 border border-yellow-400/40 text-xs font-semibold text-yellow-300 transition-colors"
                >
                  Registrar Comparación contra Distancia Conocida
                </button>

                {cal?.validacion_distancia && (
                  <div className="mt-2.5 bg-black/50 border border-white/10 rounded-lg p-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Medida Visión</span>
                      <span className="font-semibold text-white">
                        {cal.validacion_distancia.distancia_medida_mm.toFixed(2)} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Error Absoluto</span>
                      <span className="font-semibold text-amber-300">
                        ±{cal.validacion_distancia.error_absoluto_mm.toFixed(2)} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Error Relativo</span>
                      <span className="font-semibold text-cyan-300">
                        {cal.validacion_distancia.error_porcentual.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
