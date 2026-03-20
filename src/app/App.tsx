import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CanvasViewer } from './components/CanvasViewer';
import { OrientationPanel } from './components/OrientationPanel';
import { TelemetryPanel } from './components/TelemetryPanel';
import { DHParametersPanel } from './components/DHParametersPanel';
import { RapidEditor } from './components/RapidEditor';
import { ControlPanel } from './components/ControlPanel';
import { PathRecorder } from './components/PathRecorder';
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

  const [showOrientation, setShowOrientation] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showDHParameters, setShowDHParameters] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showControl, setShowControl] = useState(false);
  const [showPathRecorder, setShowPathRecorder] = useState(false);
  const [rapidCode, setRapidCode] = useState<string>('');

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
      {}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />

      {}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>{error}</span>
          <button onClick={clearError} className="text-white hover:text-gray-200">✕</button>
        </div>
      )}

      {}
      {loading && (
        <div className="absolute top-16 right-2 z-50">
          <div className="bg-cyan-500/20 backdrop-blur-xl border border-cyan-400/30 rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-cyan-400">Procesando...</span>
          </div>
        </div>
      )}

      {}
      <Header robotName={robotType} connected={connected} />

      {}
      <div
        className="transition-all duration-300"
        style={{
          height: editorExpanded ? '60vh' : '100vh',
        }}
      >
        <CanvasViewer jointAngles={jointAngles} robotInfo={robotInfo} />
      </div>

      {}
      {!editorExpanded && (
        <>
          {showOrientation && (
            <OrientationPanel
              singularityDetected={singularityDetected}
              jointAngles={jointAngles}
              onClose={() => setShowOrientation(false)}
            />
          )}
          {showTelemetry && (
            <TelemetryPanel
              jointAngles={jointAngles}
              currentPosition={estado?.posicion}
              robotInfo={robotInfo}
              onClose={() => setShowTelemetry(false)}
            />
          )}
          {showDHParameters && (
            <DHParametersPanel
              jointAngles={jointAngles}
              onClose={() => setShowDHParameters(false)}
            />
          )}
        </>
      )}

      {}
      {showControl && (
        <ControlPanel
          jointAngles={jointAngles}
          onJointChange={handleJointChange}
          onReset={handleReset}
          robotType={robotType}
          onRobotChange={handleRobotChange}
          onClose={() => setShowControl(false)}
          currentPosition={estado?.posicion}
          singularityAnalysis={singularityAnalysis}
          robotInfo={robotInfo}
        />
      )}

      {}
      {showPathRecorder && (
        <PathRecorder
          currentJoints={jointAngles}
          currentPosition={estado?.posicion || null}
          onExecutePath={handleExecutePath}
          onClose={() => setShowPathRecorder(false)}
          onExportToRapid={handleExportToRapid}
        />
      )}

      {}
      {showEditor && (
        <RapidEditor
          onClose={() => setShowEditor(false)}
          onExpand={(expanded) => {
            setEditorExpanded(expanded);

            if (expanded) {
              setShowOrientation(false);
              setShowTelemetry(false);
              setShowDHParameters(false);
              setShowControl(false);
              setShowPathRecorder(false);
            }
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

      {}
      {singularityDetected && <AlertBanner />}

      {}
      {ikWarning && (
        <IKWarningBanner
          message={ikWarning.message}
          type={ikWarning.type}
          onClose={() => setIkWarning(null)}
          autoHideDuration={ikWarning.type === 'error' ? 8000 : 6000}
        />
      )}

      {}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
        {!showOrientation && (
          <button
            onClick={() => setShowOrientation(true)}
            className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-lg px-3 py-2 text-xs text-cyan-400 hover:bg-white/20 transition-all duration-200 shadow-lg rotate-180"
            style={{ writingMode: 'vertical-rl' }}
          >
            ORIENTACIÓN
          </button>
        )}
        {!showDHParameters && (
          <button
            onClick={() => setShowDHParameters(true)}
            className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-lg px-3 py-2 text-xs text-cyan-400 hover:bg-white/20 transition-all duration-200 shadow-lg rotate-180"
            style={{ writingMode: 'vertical-rl' }}
          >
            DENAVIT-HARTENBERG
          </button>
        )}
      </div>

      {}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
        {!showTelemetry && (
          <button
            onClick={() => setShowTelemetry(true)}
            className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-lg px-3 py-2 text-xs text-cyan-400 hover:bg-white/20 transition-all duration-200 shadow-lg rotate-180"
            style={{ writingMode: 'vertical-rl' }}
          >
            TELEMETRÍA
          </button>
        )}
        {!showControl && (
          <button
            onClick={() => setShowControl(true)}
            className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-lg px-3 py-2 text-xs text-cyan-400 hover:bg-white/20 transition-all duration-200 shadow-lg rotate-180"
            style={{ writingMode: 'vertical-rl' }}
          >
            CONTROL MANUAL
          </button>
        )}
      </div>

      {}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
        {!showEditor && (
          <button
            onClick={() => setShowEditor(true)}
            className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-lg px-4 py-2 text-xs text-cyan-400 hover:bg-white/20 transition-all duration-200 shadow-lg"
          >
            EDITOR RAPID
          </button>
        )}
        {!showPathRecorder && (
          <button
            onClick={() => setShowPathRecorder(true)}
            className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-lg px-4 py-2 text-xs text-green-400 hover:bg-white/20 transition-all duration-200 shadow-lg"
          >
            GRABADOR DE TRAYECTORIA
          </button>
        )}
      </div>
    </div>
  );
}