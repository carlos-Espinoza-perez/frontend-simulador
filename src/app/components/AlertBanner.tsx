import { AlertTriangle } from 'lucide-react';

export function AlertBanner() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
      <div className="bg-red-500/20 backdrop-blur-xl border-2 border-red-500 rounded-xl p-8 shadow-2xl shadow-red-500/30 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400 mb-2 uppercase tracking-wider">
              ⚠️ SINGULARIDAD DETECTADA
            </div>
            <div className="text-sm text-red-300 font-mono">
              det(J) &lt; 0.001
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
