import React, { useState } from 'react';
import {
  Box,
  Camera,
  Code2,
  Cpu,
  Maximize2,
  Minimize2,
  ExternalLink,
  RotateCcw,
  Route,
  Eye,
  Sliders,
  ChevronDown
} from 'lucide-react';
import { SnapLayout } from './SnapLayoutSelector';
import { FloatingPanel } from './FloatingPanel';
import { CanvasViewer } from './CanvasViewer';
import { VisionCalibrationPanel } from './VisionCalibrationPanel';
import { PythonIDEView } from './PythonIDE/PythonIDEView';
import { RobotConnectionPanel } from './PythonIDE/RobotConnectionPanel';

export type WorkspaceModuleId = 'simulador' | 'vision' | 'python-ide' | 'telemetria';

interface DynamicWorkspaceProps {
  layout: SnapLayout;
  onLayoutChange: (layout: SnapLayout) => void;
  activeView: 'simulador' | 'vision' | 'python-ide';
  floatingCamera: boolean;
  onCloseFloatingCamera: () => void;
  onOpenFloatingCamera: () => void;
  floatingJoints: boolean;
  onCloseFloatingJoints: () => void;
  onOpenFloatingJoints: () => void;
  jointAngles: number[];
  robotInfo: any;
  currentPosition?: { x: number; y: number; z: number } | null;
  singularityAnalysis?: any;
  connected: boolean;
  onJointChange: (index: number, value: number) => Promise<void> | void;
  onResetHome: () => Promise<void> | void;
  showTrajectory: boolean;
  onTrajectoryToggle: (show: boolean) => void;
  clearTrajectoryTrigger: number;
  showWorkspace: boolean;
  onWorkspaceToggle: () => void;
  showPivots: boolean;
  onPivotsToggle: (show: boolean) => void;
  customTcpOffset: [number, number, number];
  resetCameraTrigger: number;
}

const MODULE_TITLES: Record<WorkspaceModuleId, { title: string; icon: React.ReactNode }> = {
  simulador: { title: 'Simulador 3D', icon: <Box className="w-3.5 h-3.5 text-cyan-400" /> },
  vision: { title: 'Cámara & OpenCV', icon: <Camera className="w-3.5 h-3.5 text-emerald-400" /> },
  'python-ide': { title: 'IDE', icon: <Code2 className="w-3.5 h-3.5 text-cyan-400" /> },
  telemetria: { title: 'Controlador IRC5 & Pose', icon: <Cpu className="w-3.5 h-3.5 text-yellow-400" /> },
};

export const DynamicWorkspace: React.FC<DynamicWorkspaceProps> = ({
  layout,
  onLayoutChange,
  activeView,
  floatingCamera,
  onCloseFloatingCamera,
  onOpenFloatingCamera,
  floatingJoints,
  onCloseFloatingJoints,
  onOpenFloatingJoints,
  jointAngles,
  robotInfo,
  currentPosition,
  singularityAnalysis,
  connected,
  onJointChange,
  onResetHome,
  showTrajectory,
  onTrajectoryToggle,
  clearTrajectoryTrigger,
  showWorkspace,
  onWorkspaceToggle,
  showPivots,
  onPivotsToggle,
  customTcpOffset,
  resetCameraTrigger,
}) => {
  const [maximizedSlot, setMaximizedSlot] = useState<number | null>(null);
  const [q4Tab, setQ4Tab] = useState<'pose' | 'irc5'>('pose');

  const [slots, setSlots] = useState<WorkspaceModuleId[]>([
    'simulador',
    'vision',
    'python-ide',
    'telemetria',
  ]);

  const changeSlotModule = (slotIndex: number, moduleId: WorkspaceModuleId) => {
    setSlots((prev) => {
      const copy = [...prev];
      copy[slotIndex] = moduleId;
      return copy;
    });
  };

  const toggleMaximizeSlot = (index: number) => {
    setMaximizedSlot((prev) => (prev === index ? null : index));
  };

  const limits = robotInfo?.limites_articulares || [
    [-180, 180],
    [-90, 110],
    [-230, 50],
    [-200, 200],
    [-115, 115],
    [-400, 400],
  ];

  const pos = currentPosition || { x: 0, y: 0, z: 0 };
  const yoshikawa = singularityAnalysis?.indice_yoshikawa ?? 0.052;
  const isSingular = singularityAnalysis?.es_singular ?? false;

  const renderModule = (modId: WorkspaceModuleId, compact: boolean) => {
    switch (modId) {
      case 'simulador':
        return (
          <CanvasViewer
            jointAngles={jointAngles}
            robotInfo={robotInfo}
            showTrajectory={showTrajectory}
            onTrajectoryToggle={onTrajectoryToggle}
            clearTrajectoryTrigger={clearTrajectoryTrigger}
            showWorkspace={showWorkspace}
            onWorkspaceToggle={onWorkspaceToggle}
            showPivots={showPivots}
            onPivotsToggle={onPivotsToggle}
            resetCameraTrigger={resetCameraTrigger}
            customTcpOffset={customTcpOffset}
          />
        );
      case 'vision':
        return <VisionCalibrationPanel isActive={true} compact={compact} />;
      case 'python-ide':
        return <PythonIDEView />;
      case 'telemetria':
        return (
          <div className="flex flex-col h-full bg-[#0a0f16] text-gray-200">
            <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/10 text-xs">
              <div className="flex items-center gap-1 bg-black/50 p-0.5 rounded border border-white/10">
                <button
                  onClick={() => setQ4Tab('pose')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    q4Tab === 'pose'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Articulaciones & Pose
                </button>
                <button
                  onClick={() => setQ4Tab('irc5')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    q4Tab === 'irc5'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Conexión IRC5
                </button>
              </div>

              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px]">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    connected ? 'bg-emerald-400' : 'bg-yellow-400'
                  }`}
                />
                <span className="text-gray-300">{connected ? 'Conectado' : 'REST'}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {q4Tab === 'pose' ? (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-1.5">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      Coordenadas Cartesianas TCP
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-1.5 rounded bg-white/5 border border-white/5 text-center">
                        <span className="text-[10px] text-red-400 block font-mono">X (mm)</span>
                        <span className="text-sm font-bold text-white font-mono">{pos.x.toFixed(1)}</span>
                      </div>
                      <div className="p-1.5 rounded bg-white/5 border border-white/5 text-center">
                        <span className="text-[10px] text-green-400 block font-mono">Y (mm)</span>
                        <span className="text-sm font-bold text-white font-mono">{pos.y.toFixed(1)}</span>
                      </div>
                      <div className="p-1.5 rounded bg-white/5 border border-white/5 text-center">
                        <span className="text-[10px] text-blue-400 block font-mono">Z (mm)</span>
                        <span className="text-sm font-bold text-white font-mono">{pos.z.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                        Ángulos Articulares (q1 - q6)
                      </span>
                      <button
                        onClick={onResetHome}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-cyan-300"
                      >
                        Reset Home
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {jointAngles.slice(0, 6).map((q, idx) => {
                        const min = limits[idx] ? limits[idx][0] : -180;
                        const max = limits[idx] ? limits[idx][1] : 180;
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className="w-7 font-mono font-bold text-gray-400 text-[11px]">
                              J{idx + 1}
                            </span>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step={0.5}
                              value={q}
                              onChange={(e) => onJointChange(idx, parseFloat(e.target.value))}
                              className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                            />
                            <span className="w-12 text-right font-mono text-[11px] text-white">
                              {q.toFixed(1)}°
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Índice Yoshikawa (w)</span>
                      <span className="font-mono text-cyan-300 font-bold">
                        {typeof yoshikawa === 'number' ? yoshikawa.toFixed(4) : yoshikawa}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Estado Cinemático</span>
                      <span
                        className={`font-semibold text-[11px] ${
                          isSingular ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {isSingular ? 'Singularidad detectada' : 'Espacio hábil'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <RobotConnectionPanel />
              )}
            </div>
          </div>
        );
    }
  };

  const renderSlotCard = (slotIndex: number, extraClasses = '') => {
    const modId = slots[slotIndex];
    const isMax = maximizedSlot === slotIndex;

    return (
      <div
        key={slotIndex}
        className={`flex flex-col rounded-xl border border-white/10 bg-[#0a0f16] shadow-xl overflow-hidden transition-all duration-150 ${
          isMax ? 'w-full h-full flex-1 z-30' : maximizedSlot !== null ? 'hidden' : extraClasses
        }`}
      >
        <div
          onDoubleClick={() => toggleMaximizeSlot(slotIndex)}
          className="h-8 px-2.5 bg-black/60 border-b border-white/10 flex items-center justify-between text-xs cursor-default select-none"
        >
          <div className="flex items-center gap-2">
            <select
              value={modId}
              onChange={(e) => changeSlotModule(slotIndex, e.target.value as WorkspaceModuleId)}
              className="bg-transparent text-gray-200 font-semibold text-[11px] border-none outline-none cursor-pointer hover:text-white"
            >
              <option value="simulador" className="bg-[#0b1017] text-white">Simulador 3D</option>
              <option value="vision" className="bg-[#0b1017] text-white">Cámara & OpenCV</option>
              <option value="python-ide" className="bg-[#0b1017] text-white">IDE</option>
              <option value="telemetria" className="bg-[#0b1017] text-white">IRC5 & Pose</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            {modId === 'simulador' && (
              <button
                onClick={onResetHome}
                title="Reset Home"
                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px]"
              >
                Home
              </button>
            )}

            {modId === 'vision' && (
              <button
                onClick={onOpenFloatingCamera}
                title="Desacoplar a ventana flotante"
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            {modId === 'telemetria' && (
              <button
                onClick={onOpenFloatingJoints}
                title="Desacoplar a ventana flotante"
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            <button
              onClick={() => toggleMaximizeSlot(slotIndex)}
              title={isMax ? 'Restaurar cuadrícula' : 'Maximizar'}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            >
              {isMax ? <Minimize2 className="w-3 h-3 text-cyan-400" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <div className="flex-1 w-full relative min-h-0 overflow-hidden">
          {renderModule(modId, layout !== 'single' && !isMax)}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-x-0 top-16 bottom-0 p-2 bg-[#080c12] text-gray-200 select-none overflow-hidden">
      {maximizedSlot !== null ? (
        <div className="w-full h-full relative">
          {renderSlotCard(maximizedSlot, 'w-full h-full')}
        </div>
      ) : (
        <>
          {layout === 'single' && (
            <div className="w-full h-full relative">
              {renderModule(activeView, false)}
            </div>
          )}

          {layout === 'split-h' && (
            <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-2">
              {renderSlotCard(0, 'w-full h-full')}
              {renderSlotCard(1, 'w-full h-full')}
            </div>
          )}

          {layout === 'trio' && (
            <div className="w-full h-full grid grid-cols-1 md:grid-cols-3 gap-2">
              {renderSlotCard(0, 'md:col-span-2 h-full')}
              <div className="flex flex-col gap-2 h-full">
                {renderSlotCard(1, 'flex-1 min-h-0')}
                {renderSlotCard(2, 'flex-1 min-h-0')}
              </div>
            </div>
          )}

          {layout === 'quad' && (
            <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-2">
              {renderSlotCard(0, 'w-full h-full')}
              {renderSlotCard(1, 'w-full h-full')}
              {renderSlotCard(2, 'w-full h-full')}
              {renderSlotCard(3, 'w-full h-full')}
            </div>
          )}
        </>
      )}

      {floatingCamera && (
        <FloatingPanel
          id="floating-camera"
          title="Cámara & Detección OpenCV (PiP)"
          icon={<Camera className="w-3.5 h-3.5 text-emerald-400" />}
          initialPosition={{ x: 30, y: 80 }}
          width={440}
          height={320}
          onClose={onCloseFloatingCamera}
        >
          <VisionCalibrationPanel isActive={true} compact={true} />
        </FloatingPanel>
      )}

      {floatingJoints && (
        <FloatingPanel
          id="floating-joints"
          title="Control Articular Flotante (q1 - q6)"
          icon={<Sliders className="w-3.5 h-3.5 text-yellow-400" />}
          initialPosition={{ x: window.innerWidth - 380, y: 80 }}
          width={360}
          height={340}
          onClose={onCloseFloatingJoints}
        >
          <div className="p-3 space-y-2 h-full overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Articulaciones</span>
              <button
                onClick={onResetHome}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-cyan-300"
              >
                Reset Home
              </button>
            </div>
            {jointAngles.slice(0, 6).map((q, idx) => {
              const min = limits[idx] ? limits[idx][0] : -180;
              const max = limits[idx] ? limits[idx][1] : 180;
              return (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="w-6 font-mono font-bold text-gray-400 text-[10px]">J{idx + 1}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.5}
                    value={q}
                    onChange={(e) => onJointChange(idx, parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                  />
                  <span className="w-10 text-right font-mono text-[10px] text-white">{q.toFixed(1)}°</span>
                </div>
              );
            })}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
};
