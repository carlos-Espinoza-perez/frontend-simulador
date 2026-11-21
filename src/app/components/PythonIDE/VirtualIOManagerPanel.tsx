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
  Info,
  Pencil,
  Radio,
  Lock
} from 'lucide-react';
import pythonIdeService, { VirtualSignal, ConnectionStatus } from '../../../services/pythonIdeService';
import websocketService from '../../../services/websocketService';
import { getBrowserClientId } from '../../../services/api';

interface VirtualIOManagerPanelProps {
  onClose?: () => void;
}

export const VirtualIOManagerPanel: React.FC<VirtualIOManagerPanelProps> = ({ onClose }) => {
  const [signals, setSignals] = useState<VirtualSignal[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'DI' | 'DO'>('ALL');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnectionStatus | null>(null);
  const [ioNotice, setIoNotice] = useState<string | null>(null);
  const [ioError, setIoError] = useState<string | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [editingSignal, setEditingSignal] = useState<VirtualSignal | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [showEioModal, setShowEioModal] = useState(false);
  const [eioContent, setEioContent] = useState('');
  const [eioRwVersion, setEioRwVersion] = useState<5 | 6>(5);
  const [eioIncludeMotorOn, setEioIncludeMotorOn] = useState<boolean>(true);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'DI' | 'DO'>('DI');
  const [newValue, setNewValue] = useState<number>(0);
  const [newDesc, setNewDesc] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const isConnected = Boolean(connStatus?.is_connected);
  const isRealController = Boolean(connStatus?.is_connected && !connStatus?.mock_server_running);
  const isPhysical = connStatus?.mode === 'CONNECTED_PHYSICAL';
  const physicalArmed = Boolean(connStatus?.physical_armed);

  const fetchConnStatus = async () => {
    try {
      const s = await pythonIdeService.getConnectionStatus();
      setConnStatus(s);
    } catch {
      // Silencioso en polling
    }
  };

  const fetchSignals = async () => {
    try {
      setLoading(true);
      const list = await pythonIdeService.listVirtualSignals();
      setSignals((prev) => {
        const prevMap = new Map(prev.map((p) => [p.name, p]));
        return list.map((s) => {
          const old = prevMap.get(s.name);
          return old && old.synced !== undefined
            ? {
                ...s,
                synced: old.synced,
                controller_value: s.value,
                controller_error: old.controller_error,
              }
            : s;
        });
      });
    } catch (err: any) {
      console.error('Error cargando senales:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromRobot = async () => {
    setSyncing(true);
    setIoError(null);
    setIoNotice(null);
    try {
      const res = await pythonIdeService.syncVirtualSignals();
      if (Array.isArray(res?.signals)) {
        setSignals(res.signals);
      }
      if (!res?.connected) {
        setIoNotice(res?.message || 'Sin conexión al controlador; mostrando valores locales.');
      } else {
        setIoNotice(
          `Lectura del controlador: ${res.synced_count ?? 0} OK` +
            (res.error_count ? `, ${res.error_count} no configuradas en EIO` : '')
        );
      }
    } catch (err: any) {
      setIoError(err.response?.data?.error || err.message || 'Error leyendo señales del robot');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    fetchConnStatus();
    const timer = setInterval(fetchConnStatus, 3000);
    const cleanup = websocketService.on('virtual_io_updated', (data: any) => {
      if (data?.client_id && data.client_id !== getBrowserClientId()) return;
      if (data && Array.isArray(data.signals)) {
        setSignals((prev) => {
          const prevMap = new Map(prev.map((p) => [p.name, p]));
          return data.signals.map((s: VirtualSignal) => {
            const old = prevMap.get(s.name);
            return old && old.synced !== undefined
              ? { ...s, synced: old.synced, controller_value: old.controller_value, controller_error: old.controller_error }
              : s;
          });
        });
      } else {
        fetchSignals();
      }
    });

    return () => {
      clearInterval(timer);
      cleanup();
    };
  }, []);

  const handleToggleValue = async (signal: VirtualSignal) => {
    setIoError(null);
    setIoNotice(null);
    if (signal.type === 'DI' && isRealController) {
      setIoError(`La entrada "${signal.name}" es de solo lectura en el robot/RobotStudio. Usa "Leer del robot".`);
      return;
    }
    if (signal.type === 'DO' && isConnected && isPhysical && !physicalArmed) {
      setIoError('El canal físico está DESARMADO. Ármalo en Conexión ABB IRC5 para modificar salidas reales.');
      return;
    }

    const nextVal = signal.value === 1 ? 0 : 1;
    try {
      const res = await pythonIdeService.updateVirtualSignal(signal.name, nextVal, true, true);
      const updatedSig: VirtualSignal = res?.signal || { ...signal, value: nextVal };
      setSignals((prev) =>
        prev.map((s) => (s.name === signal.name ? { ...s, ...updatedSig } : s))
      );
      if (res?.applied_to_controller) {
        setIoNotice(`${signal.name} → ${nextVal} aplicado en el controlador.`);
      }
    } catch (err: any) {
      setIoError(err.response?.data?.error || err.message || 'Error al actualizar señal');
    }
  };

  const openEditModal = (sig: VirtualSignal) => {
    setEditError(null);
    setEditingSignal(sig);
    setEditName(sig.name);
    setEditDesc(sig.description || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSignal) return;
    setEditError(null);
    if (!editName.trim()) {
      setEditError('El nombre de la señal es obligatorio');
      return;
    }
    try {
      await pythonIdeService.editVirtualSignal(editingSignal.name, {
        new_name: editName.trim(),
        description: editDesc.trim(),
      });
      setEditingSignal(null);
      await fetchSignals();
      setIoNotice('Señal actualizada.');
    } catch (err: any) {
      setEditError(err.response?.data?.error || err.message || 'Error al editar señal');
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

  const loadEioPreview = async (rw: 5 | 6, includeMotor: boolean) => {
    try {
      const res = await pythonIdeService.exportEioCfg(rw, includeMotor);
      setEioContent(res.content);
    } catch (err: any) {
      setIoError(err.response?.data?.error || err.message || 'Error al exportar EIO.cfg');
    }
  };

  const handleExportEio = async () => {
    await loadEioPreview(eioRwVersion, eioIncludeMotorOn);
    setShowEioModal(true);
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

      <div className="px-2 py-1.5 border-b border-white/10 bg-black/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Radio
            className={`w-3 h-3 flex-shrink-0 ${
              isRealController
                ? 'text-emerald-400'
                : isConnected
                ? 'text-cyan-400'
                : 'text-gray-500'
            }`}
          />
          <span className="text-[10px] truncate text-gray-300">
            {isRealController
              ? isPhysical
                ? `Robot físico (${physicalArmed ? 'Armado' : 'Desarmado'})`
                : 'RobotStudio (TCP)'
              : isConnected
              ? 'Mock (5001)'
              : 'Modo local (sin enlace)'}
          </span>
        </div>
        <button
          onClick={handleSyncFromRobot}
          disabled={syncing || !isConnected}
          title={
            isConnected
              ? 'Consultar entradas (DI) y salidas (DO) reales desde el controlador'
              : 'Conecta al robot o Mock para leer en vivo'
          }
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all flex-shrink-0 ${
            isConnected
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
              : 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed'
          }`}
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Leyendo...' : 'Leer del robot'}</span>
        </button>
      </div>

      {(ioError || ioNotice) && (
        <div
          className={`px-2.5 py-1.5 text-[10px] border-b border-white/10 flex items-center justify-between gap-2 ${
            ioError
              ? 'bg-red-500/10 text-red-300'
              : 'bg-emerald-500/10 text-emerald-300'
          }`}
        >
          <span className="leading-snug">{ioError || ioNotice}</span>
          <button
            onClick={() => {
              setIoError(null);
              setIoNotice(null);
            }}
            className="text-gray-400 hover:text-white flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredSignals.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs italic">
            No hay señales registradas.
          </div>
        ) : (
          filteredSignals.map((sig) => {
            const isDI = sig.type === 'DI';
            const isOn = sig.value === 1;
            const diLocked = isDI && isRealController;

            return (
              <div
                key={sig.name}
                className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/10 hover:border-white/20 transition-all group"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
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
                    {sig.synced === true && (
                      <span
                        title="Valor leído directamente del controlador"
                        className="px-1 py-0 rounded text-[8px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      >
                        En robot
                      </span>
                    )}
                    {sig.synced === false && (
                      <span
                        title={sig.controller_error || 'No configurada en el EIO del robot'}
                        className="px-1 py-0 rounded text-[8px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      >
                        No en EIO
                      </span>
                    )}
                  </div>
                  {sig.description && (
                    <span className="text-[10px] text-gray-500 truncate mt-0.5" title={sig.description}>
                      {sig.description}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleValue(sig)}
                    disabled={diLocked}
                    title={
                      diLocked
                        ? 'DI física: solo lectura desde el controlador (usa "Leer del robot")'
                        : isDI
                        ? `Simular entrada ${isOn ? '0 (Bajo)' : '1 (Alto)'}`
                        : `Asignar salida ${isOn ? '0 (Desactivar)' : '1 (Activar)'}${isRealController ? ' en controlador' : ''}`
                    }
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                      diLocked
                        ? isOn
                          ? 'bg-blue-500/15 text-blue-200 border-blue-500/30 cursor-not-allowed opacity-90'
                          : 'bg-white/5 text-gray-400 border-white/10 cursor-not-allowed opacity-80'
                        : isOn
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {diLocked ? (
                      <Lock className="w-2.5 h-2.5 text-blue-300" />
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isOn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                        }`}
                      />
                    )}
                    <span>{isOn ? '1 (ON)' : '0 (OFF)'}</span>
                  </button>

                  <button
                    onClick={() => openEditModal(sig)}
                    title="Editar nombre o descripción"
                    className="p-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-cyan-300 transition-all rounded hover:bg-white/5"
                  >
                    <Pencil className="w-3 h-3" />
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

      {editingSignal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#121820] border border-white/15 rounded-xl shadow-2xl p-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-semibold text-gray-200 flex items-center gap-1.5 text-[12px]">
                <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                Editar Señal ({editingSignal.type})
              </span>
              <button
                onClick={() => setEditingSignal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="py-3 space-y-2.5">
              {editError && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-[10px]">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Nombre exacto en EIO</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Descripción / Función</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingSignal(null)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded shadow-sm shadow-cyan-500/30"
                >
                  Guardar Cambios
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

            <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400">Formato:</span>
                <button
                  type="button"
                  onClick={() => {
                    setEioRwVersion(5);
                    loadEioPreview(5, eioIncludeMotorOn);
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                    eioRwVersion === 5
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  RobotWare 5 (IRC5 Físico)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEioRwVersion(6);
                    loadEioPreview(6, eioIncludeMotorOn);
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                    eioRwVersion === 6
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  RobotWare 6 (RobotStudio)
                </button>
              </div>

              <label className="flex items-center gap-1.5 text-[10px] text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={eioIncludeMotorOn}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEioIncludeMotorOn(checked);
                    loadEioPreview(eioRwVersion, checked);
                  }}
                  className="rounded accent-cyan-400"
                />
                <span>Incluir señal de motores (`do_motor_on`)</span>
              </label>
            </div>

            <p className="text-[11px] text-gray-400 py-2 leading-relaxed">
              Define la unidad virtual <span className="text-cyan-300">BOARD10</span> para importar en{' '}
              {eioRwVersion === 5 ? 'IRC5 RobotWare 5 (bus Virtual1)' : 'RobotStudio RobotWare 6'} y habilitar estas señales vía TCP.
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
                <span>Descargar EIO.cfg (RW{eioRwVersion})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
