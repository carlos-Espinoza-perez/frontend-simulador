import { useState } from 'react';
import { Home, ChevronDown, X, GripVertical, Activity } from 'lucide-react';
import { Slider } from './ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useDraggable } from '../hooks/useDraggable';
import { SingularityAnalysis } from './SingularityAnalysis';

interface ControlPanelProps {
  jointAngles: number[];
  onJointChange: (index: number, value: number) => void;
  onReset: () => void;
  robotType: 'ABB IRB 140' | 'UR5' | 'SCARA';
  onRobotChange: (robot: 'ABB IRB 140' | 'UR5' | 'SCARA') => void;
  onClose: () => void;
  currentPosition?: { x: number; y: number; z: number } | null;
  singularityAnalysis?: any;
}

export function ControlPanel({
  jointAngles,
  onJointChange,
  onReset,
  robotType,
  onRobotChange,
  onClose,
  currentPosition,
  singularityAnalysis,
}: ControlPanelProps) {
  const { position, isDragging, dragRef, handleMouseDown } = useDraggable({
    initialPosition: { x: window.innerWidth - 352, y: 80 },
  });

  const [showSingularity, setShowSingularity] = useState(false);

  const joints = [
    { name: 'J1', min: -170, max: 170, color: 'from-red-500 to-red-600' },
    { name: 'J2', min: -65, max: 85, color: 'from-orange-500 to-orange-600' },
    { name: 'J3', min: -52, max: 50, color: 'from-yellow-500 to-yellow-600' },
    { name: 'J4', min: -300, max: 300, color: 'from-green-500 to-green-600' },
    { name: 'J5', min: -120, max: 120, color: 'from-blue-500 to-blue-600' },
    { name: 'J6', min: -400, max: 400, color: 'from-purple-500 to-purple-600' },
  ];

  return (
    <div
      ref={dragRef}
      onMouseDown={handleMouseDown}
      className={`fixed w-80 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden ${
        isDragging ? 'cursor-grabbing' : ''
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 30,
      }}
    >
      {/* Panel Header */}
      <div
        data-drag-handle
        className="bg-black/40 px-6 py-4 border-b border-white/10 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <h3 className="text-sm uppercase tracking-wider text-cyan-400 flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-500" />
          Control Manual
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Body */}
      <div className="p-6 space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto">
        {/* Robot Selection */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">
            Selección de Robot
          </label>
          <Select value={robotType} onValueChange={onRobotChange}>
            <SelectTrigger className="w-full bg-black/30 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0e14] border-white/10">
              <SelectItem value="ABB IRB 140" className="text-white hover:bg-white/10">
                ABB IRB 140
              </SelectItem>
              <SelectItem value="UR5" className="text-white hover:bg-white/10">
                UR5
              </SelectItem>
              <SelectItem value="SCARA" className="text-white hover:bg-white/10">
                SCARA
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Joint Sliders */}
        <div className="space-y-5">
          <div className="text-xs text-gray-400 uppercase tracking-wide">
            Control de Articulaciones
          </div>
          {joints.map((joint, index) => (
            <div key={joint.name} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-mono">{joint.name}</span>
                <span className="text-sm text-white font-mono bg-black/30 px-2 py-1 rounded border border-white/5">
                  {jointAngles[index].toFixed(1)}°
                </span>
              </div>
              <div className="relative">
                <Slider
                  value={[jointAngles[index]]}
                  onValueChange={(value) => onJointChange(index, value[0])}
                  min={joint.min}
                  max={joint.max}
                  step={0.1}
                  className="w-full"
                />
                <div className={`absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r ${joint.color} opacity-20`} />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>{joint.min}°</span>
                <span>{joint.max}°</span>
              </div>
            </div>
          ))}
        </div>

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-cyan-500/20"
        >
          <Home className="w-4 h-4" />
          Reset Home
        </button>

        {/* Botón de análisis de singularidades */}
        <div className="pt-2 border-t border-white/10">
          <button
            onClick={() => setShowSingularity(!showSingularity)}
            className={`w-full py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
              showSingularity
                ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                : 'bg-black/30 hover:bg-black/40 text-gray-300 border border-white/10'
            }`}
          >
            <Activity className="w-4 h-4" />
            {showSingularity ? 'Ocultar' : 'Mostrar'} Análisis de Singularidad
          </button>
        </div>

        {/* Panel de Singularidad */}
        {showSingularity && (
          <div className="pt-2 border-t border-white/10">
            <SingularityAnalysis analisis={singularityAnalysis} />
          </div>
        )}
      </div>
    </div>
  );
}