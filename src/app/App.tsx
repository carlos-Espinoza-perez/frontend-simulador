import { useState, useEffect, useRef } from 'react';
import geometryService from '../services/geometryService';
import { FileCode, Route, RotateCcw, Camera, Sliders, Layers } from 'lucide-react';
import { Header, SpaViewMode } from './components/Header';
import { CanvasViewer } from './components/CanvasViewer';
import { RapidEditor } from './components/RapidEditor';
import { SavedPoint } from './components/PathRecorder';
import { ContextualToolPanel, ContextualCategory } from './components/ContextualToolPanel';
import { VisionCalibrationPanel } from './components/VisionCalibrationPanel';
import { PythonIDEView } from './components/PythonIDE/PythonIDEView';
import { DynamicWorkspace } from './components/DynamicWorkspace';
import { SnapLayout } from './components/SnapLayoutSelector';
import { FloatingPanel } from './components/FloatingPanel';
import { AlertBanner } from './components/AlertBanner';
import { IKWarningBanner } from './components/IKWarningBanner';
import { CollisionAlertBanner } from './components/CollisionAlertBanner';
import { useRobotState } from './hooks/useRobotState';
import websocketService from '../services/websocketService';

export default function App() {
  const {
    robots,
    currentRobotId,
    robotInfo,
    estado,
    loading,
    error,
    connected,
    selectRobot,
    moveRobot,
    moveToHome,
    clearError,
  } = useRobotState();

  const [robotType, setRobotType] = useState<'ABB IRB 140' | 'IRB 910SC SCARA'>('ABB IRB 140');
  const [jointAngles, setJointAngles] = useState([0, 0, 0, 0, 0, 0]);
  const [singularityDetected, setSingularityDetected] = useState(false);
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [singularityAnalysis, setSingularityAnalysis] = useState<any>(null);
  const [ikWarning, setIkWarning] = useState<{ message: string; type: 'error' | 'warning' } | null>(null);

  useEffect(() => {
    const cleanup = websocketService.on('rapid_console', (data: any) => {
      if ((data.type === 'error' || data.type === 'warning') && data.message) {
        setIkWarning({ message: data.message, type: data.type });
      }
    });

    return () => {
      cleanup();
    };
  }, []);

  const lastSafeAnglesRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    const unsubCol = geometryService.suscribirColisiones((cols) => {
      if (cols.length > 0) {
        websocketService.abortRapidExecution();
        setJointAngles([...lastSafeAnglesRef.current]);
      }
    });
    return unsubCol;
  }, []);

  useEffect(() => {
    if (estado?.angulos) {
      const pred = geometryService.predecirColision(estado.angulos);
      if (pred.hayColision) {
        websocketService.abortRapidExecution();
        geometryService.dispararAlerta({
          activa: true,
          tipo: 'predictiva',
          titulo: 'PARADA INMEDIATA POR COLISIÓN',
          mensaje: 'Colisión inminente',
          detalle: pred.detalle || `Detenido antes de penetrar ${pred.obstaculo}`,
          obstaculo: pred.obstaculo || 'Obstáculo en celda',
          link: pred.link || 'Manipulador',
          timestamp: Date.now(),
        });
        setJointAngles([...lastSafeAnglesRef.current]);
        return;
      }
      lastSafeAnglesRef.current = [...estado.angulos];
      setJointAngles(estado.angulos);
    }

    const estadoConAnalisis = estado as any;
    if (estadoConAnalisis?.analisis_singularidades) {
      setSingularityAnalysis(estadoConAnalisis.analisis_singularidades);
    }
  }, [estado]);

  useEffect(() => {
    if (robotInfo?.nombre) {
      const backendName = robotInfo.nombre as typeof robotType;
      if (backendName !== robotType && robotType !== 'ABB IRB 140') {

        const robotIdMap: Record<string, string> = {
          'ABB IRB 140': 'ABB_IRB_140',
          'IRB 910SC SCARA': 'ABB_IRB_910SC',
        };
        const correctId = robotIdMap[robotType];
        if (correctId) {
          console.log(`[SYNC] Backend tiene "${backendName}" pero UI tiene "${robotType}". Re-sincronizando...`);
          selectRobot(correctId);
        }
      } else {
        setRobotType(backendName);
      }
    }
  }, [robotInfo]);

  const [activeCategory, setActiveCategory] = useState<ContextualCategory | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showTrajectory, setShowTrajectory] = useState(false);
  const [clearTrajectoryTrigger, setClearTrajectoryTrigger] = useState(0);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [showPivots, setShowPivots] = useState(false);
  const [resetCameraTrigger, setResetCameraTrigger] = useState(0);
  const [customTcpOffset, setCustomTcpOffset] = useState<[number, number, number]>([0, 0, 0]);
  const [savedPoints, setSavedPoints] = useState<SavedPoint[]>([]);

  const [snapLayout, setSnapLayout] = useState<SnapLayout>(() => {
    const p = window.location.pathname.toLowerCase();
    return p.startsWith('/mosaico') || p.startsWith('/quad') || p.startsWith('/split')
      ? 'quad'
      : 'single';
  });
  const [floatingCamera, setFloatingCamera] = useState(false);
  const [floatingJoints, setFloatingJoints] = useState(false);

  const obtenerVistaPorUrl = (): SpaViewMode => {
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/vision') || path.startsWith('/calibracion')) {
      return 'vision';
    }
    if (path.startsWith('/python-ide') || path.startsWith('/ide')) {
      return 'python-ide';
    }
    return 'simulador';
  };

  const [activeView, setActiveView] = useState<SpaViewMode>(obtenerVistaPorUrl);
  const [simuladorVisitado, setSimuladorVisitado] = useState<boolean>(
    () => obtenerVistaPorUrl() === 'simulador' || window.location.pathname.includes('mosaico')
  );
  const [rapidCode, setRapidCode] = useState<string>('');

  const cambiarVista = (nuevaVista: SpaViewMode) => {
    setActiveView(nuevaVista);
    if (nuevaVista === 'simulador') {
      setSimuladorVisitado(true);
    }
    const rutaObjetivo =
      nuevaVista === 'vision'
        ? '/vision'
        : nuevaVista === 'python-ide'
        ? '/python-ide'
        : '/';
    if (window.location.pathname !== rutaObjetivo) {
      window.history.pushState({ view: nuevaVista }, '', rutaObjetivo);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const vista = obtenerVistaPorUrl();
      setActiveView(vista);
      if (vista === 'simulador') {
        setSimuladorVisitado(true);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleJointChange = async (index: number, value: number) => {
    const newAngles = [...jointAngles];
    newAngles[index] = value;
    const pred = geometryService.predecirColision(newAngles);
    if (pred.hayColision) {
      geometryService.dispararAlerta({
        activa: true,
        tipo: 'predictiva',
        titulo: 'MOVIMIENTO BLOQUEADO',
        mensaje: 'Colisión inminente',
        detalle: pred.detalle || `Bloqueado por proximidad a ${pred.obstaculo}`,
        obstaculo: pred.obstaculo || 'Obstáculo',
        link: pred.link || 'Manipulador',
        timestamp: Date.now(),
      });
      return;
    }
    lastSafeAnglesRef.current = [...newAngles];
    setJointAngles(newAngles);

    try {
      await moveRobot(newAngles);
    } catch (err) {
      console.error('Error al mover robot:', err);
      setJointAngles(estado?.angulos || jointAngles);
    }
  };

  const handleReset = async () => {
    try {
      await moveToHome();
    } catch (err) {
      console.error('Error al mover a home:', err);
    }
  };

  const handleRobotChange = async (newRobotType: 'ABB IRB 140' | 'IRB 910SC SCARA') => {

    const robotIdMap: Record<string, string> = {
      'ABB IRB 140': 'ABB_IRB_140',
      'IRB 910SC SCARA': 'ABB_IRB_910SC',
    };

    const robotId = robotIdMap[newRobotType];
    if (robotId) {
      try {
        await selectRobot(robotId);
        setRobotType(newRobotType);
      } catch (err) {
        console.error('Error al cambiar robot:', err);
      }
    }
  };

  const handleExecutePath = async (points: any[], interpolationSteps = 20, stepDelay = 50) => {
    console.log('=== INICIANDO EJECUCIÓN DE TRAYECTORIA ===');
    console.log('Total de puntos:', points.length);
    console.log('Interpolación:', interpolationSteps, 'pasos con', stepDelay, 'ms de delay');

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      console.log(`Ejecutando punto ${i + 1}/${points.length}:`, point.name);
      console.log('Joints:', point.joints);

      try {

        if (i > 0) {
          const prevPoint = points[i - 1];

          console.log(`Interpolando ${interpolationSteps} pasos desde punto ${i} a punto ${i + 1}`);

          for (let step = 1; step <= interpolationSteps; step++) {
            const t = step / interpolationSteps; // Factor de interpolación (0 a 1)

            const interpolatedJoints = prevPoint.joints.map((prevJoint: number, idx: number) => {
              const currentJoint = point.joints[idx];
              return prevJoint + (currentJoint - prevJoint) * t;
            });

            await moveRobot(interpolatedJoints);

            await new Promise(resolve => setTimeout(resolve, stepDelay));
          }
        } else {

          await moveRobot(point.joints);
        }

        console.log(`Punto ${i + 1} ejecutado exitosamente`);

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error ejecutando punto ${i + 1}:`, err);
        throw err;
      }
    }

    console.log('=== TRAYECTORIA COMPLETADA ===');
  };

  const handleExportToRapid = (points: any[]) => {

    let rapidCode = `MODULE Module1\n`;
    rapidCode += `  CONST jointtarget ZERO:=[[0,0,0,0,0,0],[9E+9,9E+9,9E+9,9E+9,9E+9,9E+9]];\n`;

    points.forEach((point, index) => {
      const pointName = `P${(index + 1) * 10}`;
      const pos = point.position;
      rapidCode += `  CONST robtarget ${pointName}:=[[${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)}],[4.14816E-8,6.1133E-9,-1,-2.53589E-16],[0,0,-1,0],[9E+9,9E+9,9E+9,9E+9,9E+9,9E+9]];\n`;
    });

    rapidCode += `\n  PROC main()\n`;
    rapidCode += `    MoveAbsJ ZERO\\NoEOffs, v1000, fine, tool0;\n`;

    points.forEach((point, index) => {
      const pointName = `P${(index + 1) * 10}`;
      const moveType = index === 0 ? 'MoveJ' : 'MoveL';
      rapidCode += `    ${moveType} ${pointName}, v500, fine, tool0;\n`;
    });

    rapidCode += `    MoveAbsJ ZERO\\NoEOffs, v1000, fine, tool0;\n`;
    rapidCode += `  ENDPROC\n`;
    rapidCode += `ENDMODULE`;

    setRapidCode(rapidCode);
    setShowEditor(true);

    console.log('Código RAPID generado:', rapidCode);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0e14] font-mono">
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-xs">
          <span>{error}</span>
          <button onClick={clearError} className="text-white hover:text-gray-200">✕</button>
        </div>
      )}

      {loading && (
        <div className="absolute top-16 left-4 z-50">
          <div className="bg-cyan-500/20 backdrop-blur-xl border border-cyan-400/30 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-lg">
            <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] text-cyan-300">Procesando...</span>
          </div>
        </div>
      )}

      <CollisionAlertBanner />
      <Header
        robotName={robotType}
        connected={connected}
        activeView={activeView}
        onViewChange={(v) => {
          setSnapLayout('single');
          cambiarVista(v);
        }}
        currentLayout={snapLayout}
        onSelectLayout={(l) => {
          setSnapLayout(l);
          if (l !== 'single') {
            setSimuladorVisitado(true);
          }
        }}
        floatingCamera={floatingCamera}
        onToggleFloatingCamera={() => setFloatingCamera((v) => !v)}
        floatingJoints={floatingJoints}
        onToggleFloatingJoints={() => setFloatingJoints((v) => !v)}
      />

      {simuladorVisitado && (
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            activeView !== 'simulador' || snapLayout !== 'single' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="w-full h-full relative">
            <CanvasViewer
              jointAngles={jointAngles}
              robotInfo={robotInfo}
              showTrajectory={showTrajectory}
              onTrajectoryToggle={setShowTrajectory}
              clearTrajectoryTrigger={clearTrajectoryTrigger}
              showWorkspace={showWorkspace}
              onWorkspaceToggle={() => setShowWorkspace((v) => !v)}
              showPivots={showPivots}
              onPivotsToggle={setShowPivots}
              resetCameraTrigger={resetCameraTrigger}
              customTcpOffset={customTcpOffset}
            />

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-[#0b1017]/85 backdrop-blur-xl border border-white/15 shadow-2xl">
              <button
                onClick={() => setShowEditor((v) => !v)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  showEditor
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                    : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Editor rápido</span>
              </button>

              <div className="w-px h-4 bg-white/10" />

              <button
                onClick={() =>
                  setActiveCategory((prev) => (prev === 'trayectoria' ? null : 'trayectoria'))
                }
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeCategory === 'trayectoria'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                    : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                <Route className="w-3.5 h-3.5 text-emerald-400" />
                <span>Grabar trayectoria</span>
                {savedPoints.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-200 text-[10px] font-mono">
                    {savedPoints.length}
                  </span>
                )}
              </button>

              <div className="w-px h-4 bg-white/10" />

              <button
                onClick={() =>
                  setActiveCategory((prev) => (prev === 'escena' ? null : 'escena'))
                }
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeCategory === 'escena'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                    : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Geometría Celda</span>
              </button>
            </div>
          </div>

          {showEditor && (
            <RapidEditor
              onClose={() => {
                setShowEditor(false);
                setEditorExpanded(false);
              }}
              onExpand={(expanded) => {
                setEditorExpanded(expanded);
              }}
              onExecuteMovement={(joints) => {
                const pred = geometryService.predecirColision(joints);
                if (!pred.hayColision) {
                  lastSafeAnglesRef.current = [...joints];
                  setJointAngles(joints);
                } else {
                  websocketService.abortRapidExecution();
                }
              }}
              externalCode={rapidCode}
              robotType={robotType}
            />
          )}

          {singularityDetected && <AlertBanner />}

          {ikWarning && (
            <IKWarningBanner
              message={ikWarning.message}
              type={ikWarning.type}
              onClose={() => setIkWarning(null)}
              autoHideDuration={ikWarning.type === 'error' ? 8000 : 6000}
            />
          )}

          <ContextualToolPanel
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            jointAngles={jointAngles}
            onJointChange={handleJointChange}
            onResetHome={handleReset}
            robotType={robotType}
            onRobotChange={handleRobotChange}
            currentPosition={estado?.posicion}
            singularityDetected={singularityDetected}
            singularityAnalysis={singularityAnalysis}
            robotInfo={robotInfo}
            connected={connected}
            showTrajectory={showTrajectory}
            onTrajectoryToggle={setShowTrajectory}
            onClearTrajectory={() => setClearTrajectoryTrigger((c) => c + 1)}
            showWorkspace={showWorkspace}
            onWorkspaceToggle={() => setShowWorkspace((v) => !v)}
            showPivots={showPivots}
            onPivotsToggle={setShowPivots}
            customTcpOffset={customTcpOffset}
            onTcpOffsetChange={setCustomTcpOffset}
            savedPoints={savedPoints}
            onSavedPointsChange={setSavedPoints}
            onExecutePath={handleExecutePath}
            onExportToRapid={handleExportToRapid}
            onOpenVision={() => cambiarVista('vision')}
          />
        </div>
      )}

      {activeView === 'vision' && snapLayout === 'single' && (
        <div className="absolute inset-x-0 top-16 bottom-0 z-30">
          <VisionCalibrationPanel
            isActive={true}
            onClose={() => cambiarVista('simulador')}
          />
        </div>
      )}

      {activeView === 'python-ide' && snapLayout === 'single' && (
        <div className="absolute inset-x-0 top-16 bottom-0 z-30">
          <PythonIDEView />
        </div>
      )}

      {snapLayout !== 'single' && (
        <DynamicWorkspace
          layout={snapLayout}
          onLayoutChange={setSnapLayout}
          activeView={activeView}
          floatingCamera={floatingCamera}
          onCloseFloatingCamera={() => setFloatingCamera(false)}
          onOpenFloatingCamera={() => setFloatingCamera(true)}
          floatingJoints={floatingJoints}
          onCloseFloatingJoints={() => setFloatingJoints(false)}
          onOpenFloatingJoints={() => setFloatingJoints(true)}
          jointAngles={jointAngles}
          robotInfo={robotInfo}
          currentPosition={estado?.posicion}
          singularityAnalysis={singularityAnalysis}
          connected={connected}
          onJointChange={handleJointChange}
          onResetHome={handleReset}
          showTrajectory={showTrajectory}
          onTrajectoryToggle={setShowTrajectory}
          clearTrajectoryTrigger={clearTrajectoryTrigger}
          showWorkspace={showWorkspace}
          onWorkspaceToggle={() => setShowWorkspace((v) => !v)}
          showPivots={showPivots}
          onPivotsToggle={setShowPivots}
          customTcpOffset={customTcpOffset}
          resetCameraTrigger={resetCameraTrigger}
        />
      )}

      {snapLayout === 'single' && floatingCamera && (
        <FloatingPanel
          id="floating-camera-single"
          title="Cámara & Detección OpenCV (PiP)"
          icon={<Camera className="w-3.5 h-3.5 text-emerald-400" />}
          initialPosition={{ x: 24, y: 72 }}
          width={440}
          height={320}
          onClose={() => setFloatingCamera(false)}
        >
          <VisionCalibrationPanel isActive={true} compact={true} />
        </FloatingPanel>
      )}

      {snapLayout === 'single' && floatingJoints && (
        <FloatingPanel
          id="floating-joints-single"
          title="Control Articular Flotante (q1 - q6)"
          icon={<Sliders className="w-3.5 h-3.5 text-yellow-400" />}
          initialPosition={{ x: window.innerWidth - 380, y: 72 }}
          width={360}
          height={340}
          onClose={() => setFloatingJoints(false)}
        >
          <div className="p-3 space-y-2 h-full overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Articulaciones</span>
              <button
                onClick={handleReset}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-cyan-300"
              >
                Reset Home
              </button>
            </div>
            {jointAngles.slice(0, 6).map((q, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="w-6 font-mono font-bold text-gray-400 text-[10px]">J{idx + 1}</span>
                <input
                  type="range"
                  min={robotInfo?.limites_articulares?.[idx]?.[0] ?? -180}
                  max={robotInfo?.limites_articulares?.[idx]?.[1] ?? 180}
                  step={0.5}
                  value={q}
                  onChange={(e) => handleJointChange(idx, parseFloat(e.target.value))}
                  className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
                <span className="w-10 text-right font-mono text-[10px] text-white">{q.toFixed(1)}°</span>
              </div>
            ))}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}