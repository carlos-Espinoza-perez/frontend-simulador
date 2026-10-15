import { useState, useEffect } from 'react';
import { FileCode, Route, RotateCcw } from 'lucide-react';
import { Header, SpaViewMode } from './components/Header';
import { CanvasViewer } from './components/CanvasViewer';
import { RapidEditor } from './components/RapidEditor';
import { SavedPoint } from './components/PathRecorder';
import { ContextualToolPanel, ContextualCategory } from './components/ContextualToolPanel';
import { VisionCalibrationPanel } from './components/VisionCalibrationPanel';
import { AlertBanner } from './components/AlertBanner';
import { IKWarningBanner } from './components/IKWarningBanner';
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

  useEffect(() => {
    if (estado?.angulos) {
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

  const obtenerVistaPorUrl = (): SpaViewMode => {
    const path = window.location.pathname.toLowerCase();
    return path.startsWith('/vision') || path.startsWith('/calibracion')
      ? 'vision'
      : 'simulador';
  };

  const [activeView, setActiveView] = useState<SpaViewMode>(obtenerVistaPorUrl);
  const [simuladorVisitado, setSimuladorVisitado] = useState<boolean>(
    () => obtenerVistaPorUrl() === 'simulador'
  );
  const [rapidCode, setRapidCode] = useState<string>('');

  const cambiarVista = (nuevaVista: SpaViewMode) => {
    setActiveView(nuevaVista);
    if (nuevaVista === 'simulador') {
      setSimuladorVisitado(true);
    }
    const rutaObjetivo = nuevaVista === 'vision' ? '/vision' : '/';
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

      <Header
        robotName={robotType}
        connected={connected}
        activeView={activeView}
        onViewChange={cambiarVista}
      />

      {simuladorVisitado && (
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            activeView === 'vision' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Visor 3D ocupando el 100% de la pantalla */}
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

            {/* Barra inferior flotante */}
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
              onExecuteMovement={async (joints) => {
                try {
                  await moveRobot(joints);
                } catch (err) {
                  console.error('Error ejecutando movimiento:', err);
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

          {/* Dock lateral flotante centrado verticalmente */}
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

      <div
        className={`absolute inset-x-0 top-16 bottom-0 transition-all duration-200 ${
          activeView === 'vision'
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <VisionCalibrationPanel
          isActive={activeView === 'vision'}
          onClose={() => cambiarVista('simulador')}
        />
      </div>
    </div>
  );
}