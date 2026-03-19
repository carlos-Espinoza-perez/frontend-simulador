import { X, GripVertical } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface DHParametersPanelProps {
  jointAngles: number[];
  onClose: () => void;
}

export function DHParametersPanel({ jointAngles, onClose }: DHParametersPanelProps) {
  const { position, isDragging, dragRef, handleMouseDown } = useDraggable({
    initialPosition: { x: 32, y: window.innerHeight - 320 },
  });

  const dhParameters = [
    { i: 1, theta: jointAngles[0], d: 352, a: 70, alpha: -90 },
    { i: 2, theta: jointAngles[1], d: 0, a: 360, alpha: 0 },
    { i: 3, theta: jointAngles[2], d: 0, a: 0, alpha: -90 },
    { i: 4, theta: jointAngles[3], d: 380, a: 0, alpha: 90 },
    { i: 5, theta: jointAngles[4], d: 0, a: 0, alpha: -90 },
    { i: 6, theta: jointAngles[5], d: 65, a: 0, alpha: 0 },
  ];

  return (
    <div
      ref={dragRef}
      onMouseDown={handleMouseDown}
      className={`fixed w-[480px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl ${
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
          Configuración Denavit-Hartenberg
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-6 pb-6">{/* DH Table */}
      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-mono">i</th>
              <th className="px-4 py-2 text-left text-xs text-cyan-400 font-mono">θ<sub>i</sub> (°)</th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-mono">d<sub>i</sub> (mm)</th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-mono">a<sub>i</sub> (mm)</th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-mono">α<sub>i</sub> (°)</th>
            </tr>
          </thead>
          <tbody>
            {dhParameters.map((param, index) => {
              const thetaChanged = Math.abs(param.theta) > 0.1;
              
              return (
                <tr 
                  key={param.i} 
                  className={`border-b border-white/5 ${index % 2 === 0 ? 'bg-black/20' : 'bg-black/10'} hover:bg-white/5 transition-colors`}
                >
                  <td className="px-4 py-3 text-gray-400 font-mono">{param.i}</td>
                  <td className={`px-4 py-3 font-mono transition-all duration-300 ${
                    thetaChanged ? 'text-cyan-400 bg-cyan-500/10' : 'text-white'
                  }`}>
                    {param.theta.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-white font-mono">{param.d}</td>
                  <td className="px-4 py-3 text-white font-mono">{param.a}</td>
                  <td className="px-4 py-3 text-white font-mono">{param.alpha}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Note */}
      <div className="mt-4 text-xs text-gray-500 italic">
        * Los valores de θ<sub>i</sub> se resaltan cuando cambian
      </div>
      </div>
    </div>
  );
}