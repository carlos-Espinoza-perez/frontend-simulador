import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Plus,
  Trash2,
  RefreshCw,
  Download,
  FileCode2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  X,
  ToggleLeft,
  ToggleRight,
  Info
} from 'lucide-react';
import pythonIdeService, { VirtualSignal } from '../../../services/pythonIdeService';
import websocketService from '../../../services/websocketService';
import { getBrowserClientId } from '../../../services/api';

interface VirtualIOManagerPanelProps {
  onClose?: () => void;
}

export const VirtualIOManagerPanel: React.FC<VirtualIOManagerPanelProps> = ({ onClose }) => {
  const [signals, setSignals] = useState<VirtualSignal[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'DI' | 'DO'>('ALL');
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEioModal, setShowEioModal] = useState(false);
  const [eioContent, setEioContent] = useState('');

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'DI' | 'DO'>('DI');
  const [newValue, setNewValue] = useState<number>(0);
  const [newDesc, setNewDesc] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      const list = await pythonIdeService.listVirtualSignals();
      setSignals(list);
    } catch (err: any) {
      console.error('Error cargando senales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const cleanup = websocketService.on('virtual_io_updated', (data: any) => {
      if (data?.client_id && data.client_id !== getBrowserClientId()) return;
      if (data && Array.isArray(data.signals)) {
        setSignals(data.signals);
      } else {
        fetchSignals();
      }
    });

    return () => {
      cleanup();
    };
  }, []);

  const handleToggleValue = async (signal: VirtualSignal) => {
    const nextVal = signal.value === 1 ? 0 : 1;
    try {
      await pythonIdeService.updateVirtualSignal(signal.name, nextVal);
      setSignals((prev) =>
        prev.map((s) => (s.name === signal.name ? { ...s, value: nextVal } : s))
      );
    } catch (err: any) {
      alert(`Error al actualizar estado: ${err.message || err}`);
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`¿Eliminar la señal virtual "${name}"?`)) return;
    try {
      await pythonIdeService.deleteVirtualSignal(name);
      setSignals((prev) => prev.filter((s) => s.name !== name));
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message || err}`);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('¿Restablecer señales virtuales predeterminadas de la celda?')) return;
    try {
      const resetList = await pythonIdeService.resetVirtualSignals();
      setSignals(resetList);
    } catch (err: any) {
      alert(`Error al restablecer: ${err.message || err}`);
    }
  };

  const handleCreateSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newName.trim()) {
      setFormError('El nombre de la señal es obligatorio');
      return;
    }

    try {
      await pythonIdeService.createVirtualSignal(newName, newType, newValue, newDesc);
      setShowNewModal(false);
      setNewName('');
      setNewDesc('');
      setNewValue(0);
      await fetchSignals();
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.message || 'Error al crear señal');
    }
  };

  const handleExportEio = async () => {
    try {
      const res = await pythonIdeService.exportEioCfg();
      setEioContent(res.content);
      setShowEioModal(true);
    } catch (err: any) {
      alert(`Error al exportar EIO.cfg: ${err.message || err}`);
    }
  };

  const handleDownloadEioFile = () => {
    const blob = new Blob([eioContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'EIO.cfg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredSignals = signals.filter((s) => {
    if (filterType === 'ALL') return true;
    return s.type === filterType;
  });

  return (
    <div className="flex flex-col h-full bg-[#0b1017] text-gray-300 font-mono text-xs border-r border-white/10 select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/20">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-gray-200 tracking-wider uppercase text-[11px]">
            Gestor E/S Virtuales
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {signals.length} señales
          </span>
          {onClose && (
            <button
              onClick={onClose}
              title="Cerrar panel lateral"
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors text-gray-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-2 border-b border-white/10 bg-black/30 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
              filterType === 'ALL'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterType('DI')}
            className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
              filterType === 'DI'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
            }`}
          >
            DI ({signals.filter((s) => s.type === 'DI').length})
          </button>
          <button
            onClick={() => setFilterType('DO')}
            className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
              filterType === 'DO'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
            }`}
          >
            DO ({signals.filter((s) => s.type === 'DO').length})
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewModal(true)}
            title="Nueva Señal Virtual"
            className="p-1 bg-cyan-500 text-black rounded hover:bg-cyan-400 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fetchSignals}
            title="Recargar señales"
            className="p-1 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredSignals.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs italic">
            No hay señales virtuales registradas.
          </div>
        ) : (
          filteredSignals.map((sig) => {
            const isDI = sig.type === 'DI';
            const isOn = sig.value === 1;

            return (
              <div
                key={sig.name}
                className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/10 hover:border-white/20 transition-all group"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider ${
                        isDI
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {sig.type}
                    </span>
                    <span className="font-semibold text-gray-200 truncate text-[11px]">
                      {sig.name}
                    </span>
                  </div>
                  {sig.description && (
                    <span className="text-[10px] text-gray-500 truncate mt-0.5" title={sig.description}>
                      {sig.description}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleToggleValue(sig)}
                    title={
                      isDI
                        ? `Forzar entrada ${isOn ? '0 (Bajo)' : '1 (Alto)'}`
                        : `Conmutar salida ${isOn ? '0 (Desactivar)' : '1 (Activar)'}`
                    }
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                      isOn
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                      }`}
                    />
                    <span>{isOn ? '1 (ON)' : '0 (OFF)'}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(sig.name)}
                    title="Eliminar señal"
                    className="p-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all rounded hover:bg-white/5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-2 border-t border-white/10 bg-black/30 flex items-center justify-between text-[10px] text-gray-500">
        <button
          onClick={handleExportEio}
          className="flex items-center gap-1 text-cyan-400 hover:underline"
          title="Generar y descargar archivo EIO.cfg para RobotStudio / IRC5"
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>Exportar EIO.cfg</span>
        </button>
        <button
          onClick={handleResetDefaults}
          className="hover:text-amber-400 transition-colors"
          title="Restablecer señales de fábrica"
        >
          Restablecer
        </button>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#121820] border border-white/15 rounded-xl shadow-2xl p-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-semibold text-gray-200 flex items-center gap-1.5 text-[12px]">
                <Plus className="w-4 h-4 text-cyan-400" />
                Nueva Señal Virtual
              </span>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSignal} className="py-3 space-y-2.5">
              {formError && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-[10px]">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Nombre de Señal</label>
                <input
                  type="text"
                  placeholder="ej. di_sensor_linea"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Tipo de Señal</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400 text-xs"
                  >
                    <option value="DI">DI (Digital Input)</option>
                    <option value="DO">DO (Digital Output)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Estado Inicial</label>
                  <select
                    value={newValue}
                    onChange={(e) => setNewValue(parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400 text-xs"
                  >
                    <option value={0}>0 (OFF)</option>
                    <option value={1}>1 (ON)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Descripción / Función</label>
                <input
                  type="text"
                  placeholder="ej. Sensor inductivo de pallet"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded shadow-sm shadow-cyan-500/30"
                >
                  Guardar Señal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-[#121820] border border-white/15 rounded-xl shadow-2xl p-4 font-mono text-xs flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-semibold text-gray-200 flex items-center gap-1.5 text-[12px]">
                <FileCode2 className="w-4 h-4 text-cyan-400" />
                Configuración ABB EIO.cfg Generada
              </span>
              <button
                onClick={() => setShowEioModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-gray-400 py-2 leading-relaxed">
              Este bloque de configuración define el bus virtual <span className="text-cyan-300">BOARD10</span> y mapea
              todas las señales virtuales para que sean importables en ABB RobotStudio o en un controlador IRC5 físico.
            </p>

            <pre className="flex-1 overflow-y-auto p-3 bg-black/60 rounded-lg border border-white/10 text-emerald-400 text-[11px] leading-relaxed whitespace-pre font-mono">
              {eioContent}
            </pre>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10 mt-3">
              <button
                type="button"
                onClick={() => setShowEioModal(false)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-gray-300"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleDownloadEioFile}
                className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded flex items-center gap-1.5 shadow-sm shadow-cyan-500/30"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar EIO.cfg</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
