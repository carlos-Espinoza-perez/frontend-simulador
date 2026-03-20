import { Progress } from './ui/progress';
import { X, GripVertical } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface TelemetryPanelProps {
  jointAngles: number[];
  onClose: () => void;
  currentPosition?: { x: number; y: number; z: number } | null;
  robotInfo?: any;
}

export function TelemetryPanel({ jointAngles, onClose, currentPosition, robotInfo }: TelemetryPanelProps) {
  const { position, isDragging, dragRef, handleMouseDown } = useDraggable({
    initialPosition: { x: window.innerWidth - 752, y: 96 },
  });

  const x = currentPosition?.x ?? 0;
  const y = currentPosition?.y ?? 0;
  const z = currentPosition?.z ?? 0;

  const limits = robotInfo?.limites_articulares || [];
  const units = robotInfo?.tipo === 'SCARA' ? ['°', '°', 'mm', '°'] : ['°', '°', '°', '°', '°', '°', '°'];

  const joints = jointAngles.map((angle, index) => {
    const min = limits[index] ? limits[index][0] : -360;
    const max = limits[index] ? limits[index][1] : 360;
    const unit = units[index] || '°';
    return { name: `J${index + 1}`, angle, min, max, unit };
  }).filter((joint) => joint.angle !== undefined);

  return (
    <div
      ref={dragRef}
      onMouseDown={handleMouseDown}
      className={`fixed w-96 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl ${
        isDragging ? 'cursor-grabbing' : ''
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 30,
      }}
    >
      <div
        data-drag-handle
        className="flex items-center justify-between mb-4 p-6 pb-0 cursor-grab active:cursor-grabbing"
      >
        <h3 className="text-sm uppercase tracking-wider text-cyan-400 flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-500" />
          Telemetría de Posición
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-6 pb-6">{}
      <div className="mb-6">
        <div className="text-xs text-gray-500 mb-3 uppercase tracking-wide">TCP Position</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-black/30 p-3 rounded-lg border border-white/5">
            <div className="text-xs text-red-400 mb-1">X (mm)</div>
            <div className="text-base text-white font-mono">{x.toFixed(2)}</div>
          </div>
          <div className="bg-black/30 p-3 rounded-lg border border-white/5">
            <div className="text-xs text-green-400 mb-1">Y (mm)</div>
            <div className="text-base text-white font-mono">{y.toFixed(2)}</div>
          </div>
          <div className="bg-black/30 p-3 rounded-lg border border-white/5">
            <div className="text-xs text-blue-400 mb-1">Z (mm)</div>
            <div className="text-base text-white font-mono">{z.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {}
      <div>
        <div className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Joint States</div>
        <div className="space-y-3">
          {joints.map((joint, index) => {
            const range = joint.max - joint.min;
            const progress = ((joint.angle - joint.min) / range) * 100;
            const isNearLimit = progress < 10 || progress > 90;

            return (
              <div key={joint.name} className="bg-black/30 p-3 rounded-lg border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-400 font-mono">{joint.name}</span>
                  <span className={`text-sm font-mono ${isNearLimit ? 'text-yellow-400' : 'text-white'}`}>
                    {joint.angle.toFixed(1)}{joint.unit}
                  </span>
                </div>
                <Progress 
                  value={progress} 
                  className="h-1.5 bg-white/5"
                  indicatorClassName={isNearLimit ? 'bg-yellow-500' : 'bg-cyan-500'}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>{joint.min}{joint.unit}</span>
                  <span>{joint.max}{joint.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}