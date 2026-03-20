import { useState, useEffect } from 'react';
import { Save, Play, Trash2, Plus, X, List, GripVertical } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface SavedPoint {
  id: string;
  name: string;
  joints: number[];
  position: { x: number; y: number; z: number };
  timestamp: Date;
}

export type { SavedPoint };

interface PathRecorderProps {
  currentJoints: number[];
  currentPosition: { x: number; y: number; z: number } | null;
  onExecutePath: (points: SavedPoint[], interpolationSteps?: number, stepDelay?: number) => Promise<void>;
  onClose: () => void;
  onExportToRapid?: (points: SavedPoint[]) => void;
}

export function PathRecorder({ currentJoints, currentPosition, onExecutePath, onClose, onExportToRapid }: PathRecorderProps) {
  const [savedPoints, setSavedPoints] = useState<SavedPoint[]>([]);
  const [pointName, setPointName] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastValidPosition, setLastValidPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [interpolationSteps, setInterpolationSteps] = useState(20);
  const [stepDelay, setStepDelay] = useState(50);

  const { position, isDragging, dragRef, handleMouseDown } = useDraggable({
    initialPosition: { x: 20, y: window.innerHeight - 520 },
  });

  useEffect(() => {
    if (currentPosition) {
      setLastValidPosition(currentPosition);
    }
  }, [currentPosition]);

  const effectivePosition = currentPosition || lastValidPosition;

  const handleSavePoint = () => {
    console.log('Intentando guardar punto:', { currentPosition, lastValidPosition, effectivePosition, currentJoints });
    
    if (!effectivePosition) {
      console.warn('No se puede guardar: no hay posición válida disponible');
      alert('No hay posición válida del robot. Espera a que el robot se mueva.');
      return;
    }

    const newPoint: SavedPoint = {
      id: Date.now().toString(),
      name: pointName || `Punto ${savedPoints.length + 1}`,
      joints: [...currentJoints],
      position: { ...effectivePosition },
      timestamp: new Date()
    };

    console.log('Punto guardado:', newPoint);
    setSavedPoints([...savedPoints, newPoint]);
    setPointName('');
  };

  const handleDeletePoint = (id: string) => {
    setSavedPoints(savedPoints.filter(p => p.id !== id));
  };

  const handleExecutePath = async () => {
    if (savedPoints.length === 0) return;
    
    console.log('Ejecutando trayectoria con', savedPoints.length, 'puntos');
    console.log('Interpolación:', interpolationSteps, 'pasos con', stepDelay, 'ms de delay');
    setIsExecuting(true);
    try {
      await onExecutePath(savedPoints, interpolationSteps, stepDelay);
      console.log('Trayectoria ejecutada exitosamente');
    } catch (err) {
      console.error('Error ejecutando trayectoria:', err);
      alert('Error al ejecutar la trayectoria: ' + (err as Error).message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClearAll = () => {
    if (confirm('¿Eliminar todos los puntos guardados?')) {
      setSavedPoints([]);
    }
  };

  const handleExportToRapid = () => {
    if (savedPoints.length === 0) {
      alert('No hay puntos para exportar');
      return;
    }
    
    if (onExportToRapid) {
      onExportToRapid(savedPoints);
    }
  };

  return (
    <div
      ref={dragRef}
      onMouseDown={handleMouseDown}
      className={`fixed w-full max-w-2xl bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden ${
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
        className="bg-black/40 px-6 py-4 border-b border-white/10 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <h3 className="text-sm uppercase tracking-wider text-green-400 flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-500" />
          <List className="w-4 h-4" />
          Grabador de Trayectoria
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {}
        <div className="flex gap-2">
          <input
            type="text"
            value={pointName}
            onChange={(e) => setPointName(e.target.value)}
            placeholder="Nombre del punto (opcional)"
            className="flex-1 px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSavePoint}
            disabled={!effectivePosition}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
            title={!effectivePosition ? 'Esperando posición del robot...' : 'Guardar posición actual'}
          >
            <Save className="w-4 h-4" />
            Guardar
          </button>
        </div>

        {}
        {!effectivePosition && (
          <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-700/30 rounded px-3 py-2">
            ⚠️ Esperando datos del robot... Mueve alguna articulación para actualizar.
          </div>
        )}
        
        {effectivePosition && (
          <div className="text-xs text-green-400 bg-green-900/20 border border-green-700/30 rounded px-3 py-2">
            ✓ Posición actual: X={effectivePosition.x.toFixed(1)}, Y={effectivePosition.y.toFixed(1)}, Z={effectivePosition.z.toFixed(1)}
            {!currentPosition && lastValidPosition && (
              <span className="text-yellow-400"> (usando última posición válida)</span>
            )}
          </div>
        )}

        {}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {savedPoints.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Plus className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay puntos guardados</p>
              <p className="text-sm">Mueve el robot y guarda posiciones</p>
            </div>
          ) : (
            savedPoints.map((point, index) => (
              <div
                key={point.id}
                className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">{point.name}</div>
                  <div className="text-xs text-gray-400">
                    X: {point.position.x.toFixed(1)} | 
                    Y: {point.position.y.toFixed(1)} | 
                    Z: {point.position.z.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">
                    J: [{point.joints.map(j => j.toFixed(1)).join(', ')}]
                  </div>
                </div>

                <button
                  onClick={() => handleDeletePoint(point.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {}
        {savedPoints.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            {}
            <div className="space-y-2">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Configuración de Movimiento</div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Suavidad: {interpolationSteps} pasos
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={interpolationSteps}
                    onChange={(e) => setInterpolationSteps(Number(e.target.value))}
                    className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Rápido</span>
                    <span>Suave</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Velocidad: {stepDelay}ms
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="10"
                    value={stepDelay}
                    onChange={(e) => setStepDelay(Number(e.target.value))}
                    className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Rápido</span>
                    <span>Lento</span>
                  </div>
                </div>
              </div>
            </div>

            {}
            <div className="flex gap-2">
              <button
                onClick={handleExecutePath}
                disabled={isExecuting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4" />
                {isExecuting ? 'Ejecutando...' : `Ejecutar ${savedPoints.length} puntos`}
              </button>
              
              {onExportToRapid && (
                <button
                  onClick={handleExportToRapid}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded-md flex items-center gap-2 transition-colors"
                  title="Exportar puntos al Editor RAPID"
                >
                  <Save className="w-4 h-4" />
                  Exportar RAPID
                </button>
              )}
              
              <button
                onClick={handleClearAll}
                className="border border-white/10 text-gray-300 hover:bg-black/40 py-2 px-4 rounded-md flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Limpiar
              </button>
            </div>
          </div>
        )}

        {}
        <div className="text-xs text-gray-500 pt-2 border-t border-white/10">
          <p>💡 Mueve el robot manualmente y guarda cada posición</p>
          <p>💡 Los puntos se ejecutarán en orden secuencial</p>
        </div>
      </div>
    </div>
  );
}
