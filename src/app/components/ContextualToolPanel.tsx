import { useState, useEffect } from 'react';
import {
  Sliders,
  Route,
  Layers,
  Wrench,
  Activity,
  Home,
  Play,
  Save,
  Trash2,
  Plus,
  ChevronRight,
  RotateCcw,
  Eye,
  EyeOff,
  Compass,
  Table2,
  Crosshair,
  Camera,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Slider } from './ui/slider';
import { Progress } from './ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import type { SavedPoint } from './PathRecorder';

export type ContextualCategory =
  | 'movimiento'
  | 'trayectoria'
  | 'escena'
  | 'herramientas'
  | 'estado';

interface ContextualToolPanelProps {
  activeCategory: ContextualCategory | null;
  onSelectCategory: (category: ContextualCategory | null) => void;
  jointAngles: number[];
  onJointChange: (index: number, value: number) => void;
  onResetHome: () => void;
  robotType: 'ABB IRB 140' | 'IRB 910SC SCARA';
  onRobotChange: (robot: 'ABB IRB 140' | 'IRB 910SC SCARA') => void;
  currentPosition?: { x: number; y: number; z: number } | null;
  singularityDetected?: boolean;
  singularityAnalysis?: any;
  robotInfo?: any;
  connected: boolean;
  // Controles de escena y trayectoria 3D
  showTrajectory: boolean;
  onTrajectoryToggle: (show: boolean) => void;
  onClearTrajectory: () => void;
  showWorkspace: boolean;
  onWorkspaceToggle: () => void;
  showPivots: boolean;
  onPivotsToggle: (show: boolean) => void;
  customTcpOffset: [number, number, number];
  onTcpOffsetChange: (offset: [number, number, number]) => void;
  // Grabador de trayectoria
  savedPoints: SavedPoint[];
  onSavedPointsChange: (points: SavedPoint[]) => void;
  onExecutePath: (points: SavedPoint[], interpolationSteps?: number, stepDelay?: number) => Promise<void>;
  onExportToRapid: (points: SavedPoint[]) => void;
  onOpenVision?: () => void;
}

const CATEGORIES: Array<{
  id: ContextualCategory;
  label: string;
  shortLabel: string;
  icon: typeof Sliders;
  description: string;
}> = [
  {
    id: 'movimiento',
    label: 'Movimiento y Orientación',
    shortLabel: 'Movimiento',
    icon: Sliders,
    description: 'Jog de ejes, coordenadas cartesianas, velocidad y orientación',
  },
  {
    id: 'trayectoria',
    label: 'Trayectoria',
    shortLabel: 'Trayectoria',
    icon: Route,
    description: 'Grabar, reproducir, pausar, exportar y limpiar puntos',
  },
  {
    id: 'escena',
    label: 'Espacio de Trabajo y Escena',
    shortLabel: 'Escena',
    icon: Layers,
    description: 'Límites, nube de alcance, pivotes, mesa y zonas',
  },
  {
    id: 'herramientas',
    label: 'Herramientas y Cinemática DH',
    shortLabel: 'Cinemática',
    icon: Wrench,
    description: 'TCP, efector final, tabla Denavit-Hartenberg y singularidades',
  },
  {
    id: 'estado',
    label: 'Estado y Telemetría',
    shortLabel: 'Estado',
    icon: Activity,
    description: 'Posición actual, configuración de ejes y conexión',
  },
];

export function ContextualToolPanel({
  activeCategory,
  onSelectCategory,
  jointAngles,
  onJointChange,
  onResetHome,
  robotType,
  onRobotChange,
  currentPosition,
  singularityDetected = false,
  singularityAnalysis,
  robotInfo,
  connected,
  showTrajectory,
  onTrajectoryToggle,
  onClearTrajectory,
  showWorkspace,
  onWorkspaceToggle,
  showPivots,
  onPivotsToggle,
  customTcpOffset,
  onTcpOffsetChange,
  savedPoints,
  onSavedPointsChange,
  onExecutePath,
  onExportToRapid,
  onOpenVision,
}: ContextualToolPanelProps) {
  const [jogStep, setJogStep] = useState<number>(1.0);
  const [pointName, setPointName] = useState('');
  const [isExecutingPath, setIsExecutingPath] = useState(false);
  const [interpolationSteps, setInterpolationSteps] = useState(20);
  const [stepDelay, setStepDelay] = useState(50);
  const [lastValidPosition, setLastValidPosition] = useState<{ x: number; y: number; z: number } | null>(null);

  useEffect(() => {
    if (currentPosition) {
      setLastValidPosition(currentPosition);
    }
  }, [currentPosition]);

  const effectivePosition = currentPosition || lastValidPosition;
  const x = effectivePosition?.x ?? 0;
  const y = effectivePosition?.y ?? 0;
  const z = effectivePosition?.z ?? 0;

  const limits = robotInfo?.limites_articulares || [];
  const isScara = jointAngles.length === 4 || robotInfo?.tipo === 'SCARA';

  const jointsConfig = Array.from({ length: jointAngles.length }).map((_, i) => ({
    name: `J${i + 1}`,
    min: limits[i] ? limits[i][0] : -360,
    max: limits[i] ? limits[i][1] : 360,
    unit: robotInfo?.tipos_articulaciones?.[i] === 'P' ? 'mm' : '°',
  }));

  const qw = Math.cos((jointAngles[0] || 0) / 2) * Math.cos((jointAngles[1] || 0) / 2);
  const qx = Math.sin((jointAngles[0] || 0) / 2) * Math.cos((jointAngles[1] || 0) / 2);
  const qy = Math.cos((jointAngles[0] || 0) / 2) * Math.sin((jointAngles[1] || 0) / 2);
  const qz = Math.sin((jointAngles[0] || 0) / 2) * Math.sin((jointAngles[1] || 0) / 2);

  const dhParameters = isScara
    ? [
        { i: 1, theta: jointAngles[0] ?? 0, d: 200, a: 250, alpha: 0 },
        { i: 2, theta: jointAngles[1] ?? 0, d: 0, a: 200, alpha: 180 },
        { i: 3, theta: jointAngles[2] ?? 0, isPrismatic: true, d: 'Var (d3)', a: 0, alpha: 0 },
        { i: 4, theta: jointAngles[3] ?? 0, d: 0, a: 0, alpha: 0 },
      ]
    : [
        { i: 1, theta: jointAngles[0] ?? 0, d: 352, a: 70, alpha: -90 },
        { i: 2, theta: jointAngles[1] ?? 0, d: 0, a: 360, alpha: 0 },
        { i: 3, theta: jointAngles[2] ?? 0, d: 0, a: 0, alpha: -90 },
        { i: 4, theta: jointAngles[3] ?? 0, d: 380, a: 0, alpha: 90 },
        { i: 5, theta: jointAngles[4] ?? 0, d: 0, a: 0, alpha: -90 },
        { i: 6, theta: jointAngles[5] ?? 0, d: 65, a: 0, alpha: 0 },
      ];

  const handleSavePoint = () => {
    const pos = effectivePosition || { x: 0, y: 0, z: 0 };
    const newPoint: SavedPoint = {
      id: Date.now().toString(),
      name: pointName.trim() || `P${(savedPoints.length + 1) * 10}`,
      joints: [...jointAngles],
      position: { ...pos },
      timestamp: new Date(),
    };
    onSavedPointsChange([...savedPoints, newPoint]);
    setPointName('');
  };

  const handleDeletePoint = (id: string) => {
    onSavedPointsChange(savedPoints.filter((p) => p.id !== id));
  };

  const handleRunRecordedPath = async () => {
    if (savedPoints.length === 0 || isExecutingPath) return;
    setIsExecutingPath(true);
    try {
      await onExecutePath(savedPoints, interpolationSteps, stepDelay);
    } finally {
      setIsExecutingPath(false);
    }
  };

  const handleTcpAxisChange = (axisIdx: 0 | 1 | 2, valMm: number) => {
    const next: [number, number, number] = [...customTcpOffset];
    next[axisIdx] = valMm / 1000;
    onTcpOffsetChange(next);
  };

  const activeCategoryMeta = CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <aside className="fixed right-4 top-1/2 -translate-y-1/2 z-30 flex items-center gap-2.5 select-none pointer-events-none">
      {/* Panel desplegable contextual flotante */}
      {activeCategory && (
        <div className="pointer-events-auto w-[360px] sm:w-[380px] max-h-[calc(100vh-120px)] rounded-2xl bg-[#0b1017]/90 backdrop-blur-xl border border-white/15 flex flex-col shadow-2xl overflow-hidden">
          {/* Cabecera del panel contextual */}
          <div className="px-4 py-3 border-b border-white/10 bg-black/40 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 truncate">
                {activeCategoryMeta?.label}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {activeCategoryMeta?.description}
              </div>
            </div>
            <button
              onClick={() => onSelectCategory(null)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Cerrar panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Contenido del grupo activo */}
          <div className="flex-1 overflow-y-auto p-4 pr-3.5 space-y-5">
            {/* 1. MOVIMIENTO: Jog de ejes, coordenadas cartesianas, velocidad y orientación */}
            {activeCategory === 'movimiento' && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                      Modelo de Robot
                    </label>
                    <button
                      onClick={onResetHome}
                      className="px-2.5 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] flex items-center gap-1.5 transition-colors"
                    >
                      <Home className="w-3 h-3" />
                      <span>Ir a Home</span>
                    </button>
                  </div>
                  <Select value={robotType} onValueChange={onRobotChange}>
                    <SelectTrigger className="w-full h-8 text-xs bg-black/40 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b1017] border-white/10">
                      <SelectItem value="ABB IRB 140" className="text-xs text-white hover:bg-white/10">
                        ABB IRB 140 (6 Ejes)
                      </SelectItem>
                      <SelectItem value="IRB 910SC SCARA" className="text-xs text-white hover:bg-white/10">
                        ABB IRB 910SC (SCARA)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Coordenadas Cartesianas actuales */}
                <div className="bg-black/30 rounded-lg p-3 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      Coordenadas Cartesianas TCP
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">Base mm</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-black/40 px-2.5 py-1.5 rounded border border-white/5">
                      <div className="text-[10px] text-red-400">X</div>
                      <div className="text-xs text-white font-mono font-semibold">{x.toFixed(1)}</div>
                    </div>
                    <div className="bg-black/40 px-2.5 py-1.5 rounded border border-white/5">
                      <div className="text-[10px] text-emerald-400">Y</div>
                      <div className="text-xs text-white font-mono font-semibold">{y.toFixed(1)}</div>
                    </div>
                    <div className="bg-black/40 px-2.5 py-1.5 rounded border border-white/5">
                      <div className="text-[10px] text-blue-400">Z</div>
                      <div className="text-xs text-white font-mono font-semibold">{z.toFixed(1)}</div>
                    </div>
                  </div>
                </div>

                {/* Paso/Velocidad de Jog y Articulaciones */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                      Jog de Ejes
                    </span>
                    <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/10">
                      {[0.5, 1, 5, 15].map((step) => (
                        <button
                          key={step}
                          onClick={() => setJogStep(step)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                            jogStep === step
                              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/40'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {step}°
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {jointsConfig.map((joint, idx) => {
                      const val = jointAngles[idx] ?? 0;
                      return (
                        <div key={joint.name} className="bg-black/30 p-2.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-300 font-mono">
                              {joint.name}
                              <span className="ml-2 text-[10px] text-gray-500 font-normal">
                                [{joint.min}..{joint.max}{joint.unit}]
                              </span>
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  onJointChange(idx, Math.max(joint.min, Number((val - jogStep).toFixed(2))))
                                }
                                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300 text-xs font-mono"
                              >
                                −
                              </button>
                              <span className="min-w-[58px] text-center text-xs text-cyan-300 font-mono bg-black/40 px-2 py-0.5 rounded border border-white/10">
                                {val.toFixed(1)}{joint.unit}
                              </span>
                              <button
                                onClick={() =>
                                  onJointChange(idx, Math.min(joint.max, Number((val + jogStep).toFixed(2))))
                                }
                                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300 text-xs font-mono"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <Slider
                            value={[val]}
                            onValueChange={(v) => onJointChange(idx, v[0])}
                            min={joint.min}
                            max={joint.max}
                            step={0.1}
                            className="w-full"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Orientación del Efector (Cuaterniones + Triedro) */}
                <div className="bg-black/30 rounded-lg p-3 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-cyan-400" />
                      Orientación (Cuaterniones)
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'qw', val: qw },
                      { label: 'qx', val: qx },
                      { label: 'qy', val: qy },
                      { label: 'qz', val: qz },
                    ].map((q) => (
                      <div key={q.label} className="bg-black/40 p-2 rounded border border-white/5 text-center">
                        <div className="text-[10px] text-gray-500">{q.label}</div>
                        <div className="text-xs text-white font-mono">{q.val.toFixed(3)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-black/40 p-2 rounded border border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Triedro TCP</span>
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <div
                        className="relative w-12 h-12"
                        style={{
                          transform: `rotateX(${jointAngles[1] || 0}deg) rotateY(${jointAngles[0] || 0}deg) rotateZ(${jointAngles[2] || 0}deg)`,
                          transformStyle: 'preserve-3d',
                          transition: 'transform 0.25s ease',
                        }}
                      >
                        <div className="absolute w-8 h-0.5 bg-red-500 origin-left" style={{ left: '50%', top: '50%' }} />
                        <div className="absolute w-0.5 h-8 bg-emerald-500 origin-top" style={{ left: '50%', top: 'calc(50% - 32px)' }} />
                        <div className="absolute w-1.5 h-1.5 bg-blue-500 rounded-full" style={{ left: '50%', top: '50%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 2. TRAYECTORIA: Grabar, reproducir, pausar, limpiar y trazo 3D */}
            {activeCategory === 'trayectoria' && (
              <>
                <div className="bg-black/30 rounded-lg p-3 border border-white/10 space-y-2.5">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    Trazo de Trayectoria en Visor 3D
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onTrajectoryToggle(!showTrajectory)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-colors ${
                        showTrajectory
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                          : 'bg-black/40 text-gray-300 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      {showTrajectory ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{showTrajectory ? 'Trazo 3D Activo' : 'Mostrar Trazo 3D'}</span>
                    </button>
                    <button
                      onClick={onClearTrajectory}
                      className="py-2 px-3 rounded-lg text-xs text-gray-300 hover:text-red-300 bg-black/40 hover:bg-red-500/15 border border-white/10 transition-colors"
                      title="Limpiar línea de trayectoria en el visor"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Captura de puntos */}
                <div className="space-y-2.5">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    Grabar Punto Actual
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pointName}
                      onChange={(e) => setPointName(e.target.value)}
                      placeholder={`Nombre (ej. P${(savedPoints.length + 1) * 10})`}
                      className="flex-1 px-2.5 py-1.5 text-xs bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={handleSavePoint}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Guardar</span>
                    </button>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono bg-black/30 px-2.5 py-1.5 rounded border border-white/5">
                    Actual: X={x.toFixed(1)}, Y={y.toFixed(1)}, Z={z.toFixed(1)} mm
                  </div>
                </div>

                {/* Lista de puntos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                      Puntos Guardados ({savedPoints.length})
                    </span>
                    {savedPoints.length > 0 && (
                      <button
                        onClick={() => onSavedPointsChange([])}
                        className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Limpiar todo
                      </button>
                    )}
                  </div>

                  {savedPoints.length === 0 ? (
                    <div className="bg-black/25 border border-dashed border-white/10 rounded-lg p-6 text-center text-xs text-gray-500">
                      Mueve el robot y pulsa «Guardar» para añadir puntos a la secuencia.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {savedPoints.map((pt, idx) => (
                        <div
                          key={pt.id}
                          className="flex items-center gap-2.5 p-2 bg-black/35 rounded-lg border border-white/10"
                        >
                          <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white font-medium truncate">{pt.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono truncate">
                              [{pt.position.x.toFixed(0)}, {pt.position.y.toFixed(0)}, {pt.position.z.toFixed(0)}] mm
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePoint(pt.id)}
                            className="p-1 text-gray-500 hover:text-red-400 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Parámetros de interpolación y reproducción */}
                <div className="bg-black/30 rounded-lg p-3 border border-white/10 space-y-3">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    Interpolación y Ejecución
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">
                        Pasos: <span className="text-white font-mono">{interpolationSteps}</span>
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={interpolationSteps}
                        onChange={(e) => setInterpolationSteps(Number(e.target.value))}
                        className="w-full h-1.5 bg-black/40 rounded appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">
                        Retardo: <span className="text-white font-mono">{stepDelay} ms</span>
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="200"
                        step="10"
                        value={stepDelay}
                        onChange={(e) => setStepDelay(Number(e.target.value))}
                        className="w-full h-1.5 bg-black/40 rounded appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleRunRecordedPath}
                      disabled={savedPoints.length === 0 || isExecutingPath}
                      className="flex-1 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{isExecutingPath ? 'Reproduciendo...' : 'Reproducir'}</span>
                    </button>
                    <button
                      onClick={() => onExportToRapid(savedPoints)}
                      disabled={savedPoints.length === 0}
                      className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-cyan-300 border border-cyan-400/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      title="Generar módulo RAPID y abrir en el editor"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>A RAPID</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 3. ESPACIO DE TRABAJO / ESCENA: Límites, mesa, objetos y zonas */}
            {activeCategory === 'escena' && (
              <>
                <div className="space-y-2.5">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    Capas Visuales del Espacio 3D
                  </div>

                  <button
                    onClick={onWorkspaceToggle}
                    className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition-colors ${
                      showWorkspace
                        ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
                        : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">Nube de Espacio de Trabajo</div>
                      <div className="text-[10px] text-gray-400">
                        Volumen alcanzable del manipulador (Tecla E)
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        showWorkspace ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/5 text-gray-500'
                      }`}
                    >
                      {showWorkspace ? 'VISIBLE' : 'OCULTO'}
                    </span>
                  </button>

                  <button
                    onClick={() => onPivotsToggle(!showPivots)}
                    className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition-colors ${
                      showPivots
                        ? 'bg-lime-500/15 border-lime-400/40 text-lime-300'
                        : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">Pivotes de Eslabones (DH)</div>
                      <div className="text-[10px] text-gray-400">
                        Orígenes de rotación articular en escena (Tecla P)
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        showPivots ? 'bg-lime-500/30 text-lime-200' : 'bg-white/5 text-gray-500'
                      }`}
                    >
                      {showPivots ? 'VISIBLE' : 'OCULTO'}
                    </span>
                  </button>
                </div>

                {/* Especificaciones de alcance y límites */}
                <div className="bg-black/30 rounded-lg p-3 border border-white/10 space-y-2.5">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    Envolvente y Límites Mecánicos
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-black/40 p-2 rounded border border-white/5">
                      <div className="text-[10px] text-gray-500">Alcance Máximo</div>
                      <div className="text-white font-mono font-semibold">
                        {isScara ? '450 mm' : '810 mm'}
                      </div>
                    </div>
                    <div className="bg-black/40 p-2 rounded border border-white/5">
                      <div className="text-[10px] text-gray-500">Grados Libertad</div>
                      <div className="text-white font-mono font-semibold">
                        {jointAngles.length} DOF
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mesa de trabajo y zonas de clasificación */}
                <div className="bg-black/30 rounded-lg p-3 border border-white/10 space-y-2.5">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    Mesa y Zonas de Clasificación
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    La calibración cámara–mesa (ArUco + homografía en milímetros) se gestiona en el módulo de visión.
                  </p>
                  {onOpenVision && (
                    <button
                      onClick={onOpenVision}
                      className="w-full py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-400/30 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Abrir Visión y Calibración (/vision)</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* 4. HERRAMIENTAS Y CINEMÁTICA: TCP, efector final y Denavit-Hartenberg */}
            {activeCategory === 'herramientas' && (
              <>
                {/* TCP y Efector Final */}
                <div className="bg-black/30 rounded-lg p-3 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                      Desfase de Herramienta (TCP Offset)
                    </span>
                    <button
                      onClick={() => onTcpOffsetChange([0, 0, 0])}
                      className="text-[10px] text-gray-400 hover:text-white"
                    >
                      Restablecer
                    </button>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Brida base: <span className="text-white font-mono">tool0 (65 mm en Z6)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['X', 'Y', 'Z'] as const).map((axis, i) => {
                      const valMm = Math.round((customTcpOffset[i] || 0) * 1000);
                      return (
                        <div key={axis} className="bg-black/40 p-2 rounded border border-white/5">
                          <label className="text-[10px] text-gray-500 block mb-1">
                            Δ{axis} (mm)
                          </label>
                          <input
                            type="number"
                            step="5"
                            value={valMm}
                            onChange={(e) =>
                              handleTcpAxisChange(i as 0 | 1 | 2, parseFloat(e.target.value) || 0)
                            }
                            className="w-full bg-black/50 border border-white/10 rounded px-1.5 py-1 text-xs text-white font-mono"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tabla Denavit-Hartenberg */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <Table2 className="w-3.5 h-3.5 text-cyan-400" />
                      Parámetros Denavit-Hartenberg
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          <th className="px-2.5 py-2 text-left text-[10px] text-gray-400 font-mono">i</th>
                          <th className="px-2.5 py-2 text-left text-[10px] text-cyan-400 font-mono">θi (°)</th>
                          <th className="px-2.5 py-2 text-left text-[10px] text-gray-400 font-mono">di (mm)</th>
                          <th className="px-2.5 py-2 text-left text-[10px] text-gray-400 font-mono">ai (mm)</th>
                          <th className="px-2.5 py-2 text-left text-[10px] text-gray-400 font-mono">αi (°)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dhParameters.map((param, index) => {
                          const thetaChanged = Math.abs(param.theta) > 0.1;
                          return (
                            <tr
                              key={param.i}
                              className={`border-b border-white/5 ${
                                index % 2 === 0 ? 'bg-black/20' : 'bg-black/10'
                              }`}
                            >
                              <td className="px-2.5 py-2 text-gray-400 font-mono">{param.i}</td>
                              <td
                                className={`px-2.5 py-2 font-mono ${
                                  thetaChanged ? 'text-cyan-300 bg-cyan-500/10' : 'text-white'
                                }`}
                              >
                                {(param as any).isPrismatic ? '0.0' : param.theta.toFixed(1)}
                              </td>
                              <td className="px-2.5 py-2 text-white font-mono">
                                {(param as any).isPrismatic ? param.theta.toFixed(1) : param.d}
                              </td>
                              <td className="px-2.5 py-2 text-white font-mono">{param.a}</td>
                              <td className="px-2.5 py-2 text-white font-mono">{param.alpha}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Índices del Jacobiano / Singularidades */}
                {singularityAnalysis && (
                  <div className="bg-black/30 rounded-lg p-3 border border-white/10 space-y-2">
                    <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                      Análisis Jacobiano J(q)
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-black/40 p-2 rounded border border-white/5">
                        <div className="text-[10px] text-gray-500">Manipulabilidad (w)</div>
                        <div className="text-white font-mono">
                          {Number(singularityAnalysis.manipulabilidad ?? 0).toFixed(4)}
                        </div>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-white/5">
                        <div className="text-[10px] text-gray-500">Condición (κ)</div>
                        <div className="text-white font-mono">
                          {Number(singularityAnalysis.numero_condicion ?? 1).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 5. ESTADO Y TELEMETRÍA: Posición actual, configuración de ejes y conexión */}
            {activeCategory === 'estado' && (
              <>
                <div className="bg-black/30 rounded-lg p-3 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                      Estado del Enlace
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                        connected
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                      }`}
                    >
                      {connected ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> WebSocket Tiempo Real
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3" /> Fallback REST
                        </>
                      )}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Manipulador activo: <span className="text-white font-semibold">{robotType}</span>
                  </div>
                  {singularityDetected && (
                    <div className="text-xs text-red-300 bg-red-500/15 border border-red-500/30 rounded p-2">
                      ⚠️ Cercanía a singularidad cinemática detectada.
                    </div>
                  )}
                </div>

                {/* Posición TCP */}
                <div className="space-y-2">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    Posición Cartesiana Actual (TCP)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-black/35 p-2.5 rounded-lg border border-white/5">
                      <div className="text-[10px] text-red-400 mb-0.5">X (mm)</div>
                      <div className="text-sm text-white font-mono">{x.toFixed(2)}</div>
                    </div>
                    <div className="bg-black/35 p-2.5 rounded-lg border border-white/5">
                      <div className="text-[10px] text-emerald-400 mb-0.5">Y (mm)</div>
                      <div className="text-sm text-white font-mono">{y.toFixed(2)}</div>
                    </div>
                    <div className="bg-black/35 p-2.5 rounded-lg border border-white/5">
                      <div className="text-[10px] text-blue-400 mb-0.5">Z (mm)</div>
                      <div className="text-sm text-white font-mono">{z.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Configuración y carga de rango de ejes */}
                <div className="space-y-2.5">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    Configuración y Rango de Ejes
                  </div>
                  <div className="space-y-2">
                    {jointsConfig.map((joint, idx) => {
                      const angle = jointAngles[idx] ?? 0;
                      const range = Math.max(joint.max - joint.min, 1);
                      const progress = Math.min(100, Math.max(0, ((angle - joint.min) / range) * 100));
                      const isNearLimit = progress < 10 || progress > 90;

                      return (
                        <div key={joint.name} className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs text-gray-300 font-mono font-semibold">
                              {joint.name}
                            </span>
                            <span
                              className={`text-xs font-mono ${
                                isNearLimit ? 'text-yellow-400 font-semibold' : 'text-white'
                              }`}
                            >
                              {angle.toFixed(1)}{joint.unit}
                            </span>
                          </div>
                          <Progress
                            value={progress}
                            className="h-1.5 bg-white/5"
                            indicatorClassName={isNearLimit ? 'bg-yellow-500' : 'bg-cyan-500'}
                          />
                          <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                            <span>{joint.min}{joint.unit}</span>
                            <span>{joint.max}{joint.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dock vertical flotante centrado con las 5 categorías */}
      <div className="pointer-events-auto p-1.5 rounded-2xl bg-[#0b1017]/85 backdrop-blur-xl border border-white/15 shadow-2xl flex flex-col items-center gap-1.5">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(isSelected ? null : cat.id)}
              title={`${cat.label}: ${cat.description}`}
              className={`relative w-14 py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-medium tracking-tight leading-none truncate max-w-full">
                {cat.shortLabel}
              </span>
              {cat.id === 'trayectoria' && savedPoints.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-black text-[9px] font-bold flex items-center justify-center">
                  {savedPoints.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
