import { X, GripVertical } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface OrientationPanelProps {
  singularityDetected: boolean;
  jointAngles: number[];
  onClose: () => void;
}

export function OrientationPanel({ singularityDetected, jointAngles, onClose }: OrientationPanelProps) {
  const { position, isDragging, dragRef, handleMouseDown } = useDraggable({
    initialPosition: { x: 32, y: 96 },
  });

  const qw = Math.cos(jointAngles[0] / 2) * Math.cos(jointAngles[1] / 2);
  const qx = Math.sin(jointAngles[0] / 2) * Math.cos(jointAngles[1] / 2);
  const qy = Math.cos(jointAngles[0] / 2) * Math.sin(jointAngles[1] / 2);
  const qz = Math.sin(jointAngles[0] / 2) * Math.sin(jointAngles[1] / 2);

  return (
    <div
      ref={dragRef}
      onMouseDown={handleMouseDown}
      className={`fixed w-80 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl rounded-xl border ${
        singularityDetected ? 'border-red-500 animate-pulse' : 'border-white/10'
      } shadow-2xl transition-all duration-300 ${isDragging ? 'cursor-grabbing' : ''}`}
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
          Orientación del Efector (Quaternion)
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-6 pb-6">{}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-black/30 p-3 rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">q<sub>w</sub></div>
          <div className="text-lg text-white font-mono">{qw.toFixed(4)}</div>
        </div>
        <div className="bg-black/30 p-3 rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">q<sub>x</sub></div>
          <div className="text-lg text-white font-mono">{qx.toFixed(4)}</div>
        </div>
        <div className="bg-black/30 p-3 rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">q<sub>y</sub></div>
          <div className="text-lg text-white font-mono">{qy.toFixed(4)}</div>
        </div>
        <div className="bg-black/30 p-3 rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">q<sub>z</sub></div>
          <div className="text-lg text-white font-mono">{qz.toFixed(4)}</div>
        </div>
      </div>

      {}
      <div className="bg-black/30 p-4 rounded-lg border border-white/5">
        <div className="text-xs text-gray-500 mb-3">Visualización del Triedro</div>
        <div className="relative w-full h-32 flex items-center justify-center">
          <div 
            className="relative w-24 h-24"
            style={{ 
              transform: `rotateX(${jointAngles[1]}deg) rotateY(${jointAngles[0]}deg) rotateZ(${jointAngles[2]}deg)`,
              transformStyle: 'preserve-3d',
              transition: 'transform 0.3s ease'
            }}
          >
            {}
            <div className="absolute w-16 h-0.5 bg-red-500 origin-left" style={{ left: '50%', top: '50%' }} />
            <div className="absolute text-xs text-red-400" style={{ left: 'calc(50% + 60px)', top: '50%' }}>X</div>
            
            {}
            <div className="absolute w-0.5 h-16 bg-green-500 origin-top" style={{ left: '50%', top: 'calc(50% - 64px)' }} />
            <div className="absolute text-xs text-green-400" style={{ left: '50%', top: 'calc(50% - 70px)' }}>Y</div>
            
            {}
            <div className="absolute w-1 h-1 bg-blue-500 rounded-full" style={{ left: '50%', top: '50%' }} />
            <div className="absolute text-xs text-blue-400" style={{ left: 'calc(50% + 10px)', top: 'calc(50% + 10px)' }}>Z</div>
          </div>
        </div>
      </div>

      {}
      {singularityDetected && (
        <div className="mt-4 bg-red-500/20 border border-red-500 rounded-lg p-3">
          <div className="text-xs text-red-400 font-mono">
            ⚠️ SINGULARIDAD DETECTADA: det(J) &lt; 0.001
          </div>
        </div>
      )}
      </div>
    </div>
  );
}