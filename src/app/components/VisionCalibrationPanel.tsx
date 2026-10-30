import { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileCode,
  Image as ImageIcon,
  FolderOpen,
  Play,
  Activity
} from 'lucide-react';
import {
  EstadoVision,
  obtenerEstadoVision,
  capturarImagen,
  getVisionStreamUrl,
  getVisionProcessedUrl,
  iniciarVision,
  detenerVision,
  detectarObjetos
} from '../../services/visionService';
import { websocketService } from '../../services/websocketService';
import pythonIdeService from '../../services/pythonIdeService';

interface VisionCalibrationPanelProps {
  isActive: boolean;
  onClose?: () => void;
  compact?: boolean;
}

export function VisionCalibrationPanel({ isActive, compact = false }: VisionCalibrationPanelProps) {
  const [vision, setVision] = useState<EstadoVision | null>(null);
  const [cargando, setCargando] = useState(false);
  const [ejecutandoDeteccion, setEjecutandoDeteccion] = useState(false);
  const [autoDeteccion, setAutoDeteccion] = useState(false);
  const [intervaloSec, setIntervaloSec] = useState(1.0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState<number>(() => Date.now());
  const [processedKey, setProcessedKey] = useState<number>(() => Date.now());
  const [modoVisualizacion, setModoVisualizacion] = useState<'stream' | 'opencv'>('stream');
  const [ultimaCaptura, setUltimaCaptura] = useState<string | null>(null);

  const cargarEstado = useCallback(async () => {
    try {
      const res = await obtenerEstadoVision();
      if (res.success) {
        setVision(res.vision);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    iniciarVision().catch(() => {});
    cargarEstado();
    const timer = setInterval(cargarEstado, 3000);
    return () => {
      clearInterval(timer);
      detenerVision().catch(() => {});
    };
  }, [isActive, cargarEstado]);

  useEffect(() => {
    const handleVisionProcesada = (data: any) => {
      setProcessedKey(Date.now());
      if (data?.piezas_detectadas !== null && data?.piezas_detectadas !== undefined) {
        setFeedbackMsg(`${data.piezas_detectadas} objetos`);
      } else {
        setFeedbackMsg('Detección lista');
      }
    };

    const cleanup = websocketService.on('vision_procesada', handleVisionProcesada);
    return () => {
      if (cleanup) cleanup();
      else websocketService.off('vision_procesada', handleVisionProcesada);
    };
  }, []);

  useEffect(() => {
    if (!autoDeteccion || !isActive) return;
    setModoVisualizacion('opencv');
    const timer = setInterval(async () => {
      try {
        await detectarObjetos();
      } catch {
      }
    }, intervaloSec * 1000);

    return () => clearInterval(timer);
  }, [autoDeteccion, isActive, intervaloSec]);

  const handleEjecutarDeteccion = async () => {
    setEjecutandoDeteccion(true);
    setErrorMsg(null);
    setFeedbackMsg('Detectando...');
    try {
      await pythonIdeService.runScript('detector.py');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Error al ejecutar detector.py');
    } finally {
      setEjecutandoDeteccion(false);
    }
  };

  const handleCapturar = async () => {
    setCargando(true);
    setErrorMsg(null);
    try {
      const res = await capturarImagen();
      if (res.success) {
        setUltimaCaptura(res.rel_path);
        setFeedbackMsg('Captura guardada');
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Error de captura');
    } finally {
      setCargando(false);
    }
  };

  const streamUrl = getVisionStreamUrl(streamKey);
  const processedUrl = getVisionProcessedUrl(streamKey);
  const resolucion = vision?.resolucion ? `${vision.resolucion[0]}x${vision.resolucion[1]}` : '1280x720';
  const fps = vision?.fps_actual ? vision.fps_actual.toFixed(1) : '30.0';

  return (
    <div className="flex flex-col h-full bg-[#0d131a] text-gray-200 select-none overflow-hidden">
      {!compact && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-cyan-400" />
            <div>
              <h1 className="text-sm font-semibold text-white tracking-wide">Cámara & Procesamiento OpenCV</h1>
              <p className="text-[11px] text-gray-400">Detección de objetos en tiempo real con cámara física</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-300 font-mono text-[11px]">{resolucion} @ {fps} FPS</span>
            </div>

            <a
              href="/python-ide"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30 rounded text-xs font-semibold transition-all"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Abrir en IDE Python</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      <div className={`p-2 ${compact ? 'flex flex-col h-full gap-1.5' : 'grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1'}`}>
        <div className={`${compact ? 'flex-1 flex flex-col min-h-0' : 'lg:col-span-3 flex flex-col gap-3'}`}>
          <div className="flex items-center justify-between bg-black/50 px-2 py-1 rounded-md border border-white/10 text-xs gap-1 shrink-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-center bg-white/5 p-0.5 rounded border border-white/10">
                <button
                  onClick={() => setModoVisualizacion('stream')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    modoVisualizacion === 'stream'
                      ? 'bg-cyan-500/25 text-cyan-300 font-semibold shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Ver flujo directo de la cámara"
                >
                  {compact ? 'En Vivo' : 'Cámara en Vivo'}
                </button>
                <button
                  onClick={() => {
                    setModoVisualizacion('opencv');
                    setProcessedKey(Date.now());
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    modoVisualizacion === 'opencv'
                      ? 'bg-emerald-500/25 text-emerald-300 font-semibold shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Ver fotograma anotado con detecciones OpenCV"
                >
                  {compact ? 'OpenCV' : 'Detecciones OpenCV'}
                </button>
              </div>

              <button
                onClick={handleEjecutarDeteccion}
                disabled={ejecutandoDeteccion}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 flex items-center gap-1 transition-all disabled:opacity-50"
                title="Ejecutar detector.py una vez en el IDE"
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>{compact ? 'Detectar' : (ejecutandoDeteccion ? 'Iniciando...' : 'detector.py')}</span>
              </button>

              <div className="flex items-center bg-white/5 border border-white/10 rounded px-1.5 py-0.5 gap-1">
                <button
                  onClick={() => {
                    const prox = !autoDeteccion;
                    setAutoDeteccion(prox);
                    if (prox) setModoVisualizacion('opencv');
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
                    autoDeteccion
                      ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50 shadow-xs'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="Detección periódica automática"
                >
                  <Activity className={`w-2.5 h-2.5 ${autoDeteccion ? 'animate-pulse text-rose-400' : ''}`} />
                  <span>{autoDeteccion ? 'Auto' : 'Auto'}</span>
                </button>

                <select
                  value={intervaloSec}
                  onChange={(e) => setIntervaloSec(parseFloat(e.target.value))}
                  className="bg-transparent border-0 text-cyan-300 text-[10px] focus:outline-none cursor-pointer pr-0"
                  title="Intervalo de detección"
                >
                  <option value={0.5} className="bg-gray-900 text-gray-200">0.5s</option>
                  <option value={1.0} className="bg-gray-900 text-gray-200">1s</option>
                  <option value={2.0} className="bg-gray-900 text-gray-200">2s</option>
                  <option value={3.0} className="bg-gray-900 text-gray-200">3s</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
                title={`Cámara USB activa (${resolucion})`}
              />
              {!compact && (
                <span className="text-[10px] text-gray-400 font-mono hidden md:inline">
                  {modoVisualizacion === 'stream' ? resolucion : `${intervaloSec}s`}
                </span>
              )}
            </div>
          </div>

          <div className="relative flex-1 bg-black rounded-md border border-white/10 overflow-hidden flex items-center justify-center shadow-lg min-h-[140px]">
            {isActive ? (
              <img
                key={modoVisualizacion}
                src={modoVisualizacion === 'stream' ? getVisionStreamUrl(streamKey) : getVisionProcessedUrl(processedKey)}
                alt={modoVisualizacion === 'stream' ? 'Feed de cámara' : 'Detecciones OpenCV'}
                className="w-full h-full object-contain"
                onError={() => setErrorMsg(modoVisualizacion === 'opencv' ? 'Sin detecciones procesadas aún. Pulsa Detectar o activa Auto.' : 'Error al cargar video.')}
              />
            ) : (
              <div className="text-gray-500 text-xs font-mono">Cámara inactiva</div>
            )}

            {cargando && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-cyan-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Actualizando...</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-1 bg-black/40 border border-white/10 rounded-md text-xs shrink-0 gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={handleCapturar}
                disabled={cargando}
                className="px-2 py-0.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded text-[11px] font-medium flex items-center gap-1 transition-all disabled:opacity-50"
                title="Capturar fotograma actual"
              >
                <Camera className="w-3 h-3" />
                {!compact && <span>Capturar</span>}
              </button>

              <button
                onClick={() => {
                  setStreamKey(Date.now());
                  setProcessedKey(Date.now());
                }}
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/5 transition-colors"
                title="Refrescar visualización"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {feedbackMsg && (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium truncate max-w-[200px]" title={feedbackMsg}>
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{feedbackMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="text-[11px] text-rose-400 flex items-center gap-1 font-medium truncate max-w-[200px]" title={errorMsg}>
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{errorMsg}</span>
              </div>
            )}
          </div>
        </div>

        {!compact && (
          <div className="flex flex-col gap-3">
            <div className="p-3.5 bg-black/30 border border-white/10 rounded-lg space-y-3">
              <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Dispositivo de Captura
              </h2>

              <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <div>
                  <div className="font-semibold">Cámara USB Conectada</div>
                  <div className="text-[11px] text-gray-400">Índice #0 (DirectShow)</div>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-black/30 border border-white/10 rounded-lg space-y-2 text-xs">
              <h3 className="font-semibold text-cyan-400">Detección Continua</h3>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                El script <code className="text-cyan-300">detector.py</code> ejecuta un bucle continuo cada <code className="text-emerald-300">INTERVALO_SEGUNDOS</code>, enviando las coordenadas y cajas delimitadoras en tiempo real a la interfaz.
              </p>
              <div className="p-2 bg-white/5 rounded border border-white/5 text-[11px] font-mono text-gray-300">
                INTERVALO_SEGUNDOS = 1.0<br />
                while True:<br />
                &nbsp;&nbsp;piezas = detectar_piezas(frame)<br />
                &nbsp;&nbsp;publicar_deteccion(anotada)<br />
                &nbsp;&nbsp;time.sleep(intervalo)
              </div>
            </div>

            {ultimaCaptura && (
              <div className="p-3 bg-black/30 border border-white/10 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    Última Captura
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">{ultimaCaptura}</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Archivo guardado en capturas/ para análisis con OpenCV.
                </p>
              </div>
            )}

            <div className="p-3 bg-black/30 border border-white/10 rounded-lg space-y-2 mt-auto">
              <h3 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                Módulos de la Celda
              </h3>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Modifica los umbrales de contornos y áreas en:
              </p>
              <div className="font-mono text-[10px] space-y-1 text-cyan-300 bg-black/50 p-2 rounded border border-white/5">
                <div>• detector.py (intervalo y umbrales)</div>
                <div>• clasificador.py (materiales HSV)</div>
                <div>• main_celda.py (clasificación y robot)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
