import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Activity,
  Send,
  Server,
  ShieldAlert,
  Clock,
  Radio,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  X
} from 'lucide-react';
import pythonIdeService, {
  ConnectionStatus,
  TrafficEntry,
  ConnectionProfile,
  VirtualSignal
} from '../../../services/pythonIdeService';

interface RobotConnectionPanelProps {
  onStatusChange?: (status: ConnectionStatus) => void;
  onClose?: () => void;
}

export const RobotConnectionPanel: React.FC<RobotConnectionPanelProps> = ({ onStatusChange, onClose }) => {
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(5001);
  const [timeout, setTimeoutVal] = useState(3.0);
  const [mode, setMode] = useState<'SIMULATED' | 'CONNECTED_PHYSICAL' | 'DEVELOPMENT'>('SIMULATED');
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [traffic, setTraffic] = useState<TrafficEntry[]>([]);
  const [showTraffic, setShowTraffic] = useState(false);
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('virtual_local');
  const [connError, setConnError] = useState<string | null>(null);
  const [autoArmOnLan, setAutoArmOnLan] = useState<boolean>(true);
  const [registeredSignals, setRegisteredSignals] = useState<VirtualSignal[]>([]);

  const isLanIp = (h: string) => {
    const clean = (h || '').trim().toLowerCase();
    return Boolean(clean) && !['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(clean);
  };

  const fetchProfiles = async () => {
    try {
      const data = await pythonIdeService.getConnectionProfiles();
      const list: ConnectionProfile[] = data.profiles || [];
      setProfiles(list);
      if (data.active_profile) {
        setSelectedProfileId(data.active_profile);
        const active = list.find((item) => item.id === data.active_profile);
        if (active && !status?.is_connected) {
          setHost(active.host);
          setPort(active.port);
          setTimeoutVal(active.timeout);
          setMode(active.mode);
        }
      }
    } catch (err) {
      console.error('Error al cargar perfiles:', err);
    }
  };

  const [testCmd, setTestCmd] = useState<
    'PING' | 'GET_STATUS' | 'GET_JOINTS' | 'MOVE_PRESET' | 'MOVE_JOINTS' | 'GET_DI' | 'GET_DO' | 'SET_DO' | 'GET_VARIABLE'
  >('PING');
  const [signalName, setSignalName] = useState('di_pieza_presente');
  const [signalValue, setSignalValue] = useState<number>(1);
  const [presetTarget, setPresetTarget] = useState<'HOME' | 'TEST_DELTA_J1' | 'TEST_SAFE_1'>('HOME');
  const [motionJoints, setMotionJoints] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [motionSpeed, setMotionSpeed] = useState<number>(50);
  const [physicalConfirm, setPhysicalConfirm] = useState(false);
  const [cmdResult, setCmdResult] = useState<any>(null);

  const fetchStatus = async () => {
    try {
      const s = await pythonIdeService.getConnectionStatus();
      setStatus(s);
      onStatusChange?.(s);
    } catch (err) {
      console.error('Error al obtener estado de conexion:', err);
    }
  };

  const fetchTraffic = async () => {
    try {
      const logs = await pythonIdeService.getTrafficLogs();
      setTraffic(logs);
    } catch (err) {
      console.error('Error al obtener trafico:', err);
    }
  };

  const handleSelectProfile = async (profId: string) => {
    setSelectedProfileId(profId);
    const p = profiles.find((item) => item.id === profId);
    if (p) {
      setHost(p.host);
      setPort(p.port);
      setTimeoutVal(p.timeout);
      setMode(p.mode);
      try {
        await pythonIdeService.selectConnectionProfile(profId);
      } catch (err) {
        console.error('Error al persistir perfil:', err);
      }
    }
  };

  const fetchRegisteredSignals = async () => {
    try {
      const list = await pythonIdeService.listVirtualSignals();
      setRegisteredSignals(list);
    } catch {
      // Ignorar si aun no responde
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchProfiles();
    fetchRegisteredSignals();
    const interval = setInterval(() => {
      fetchStatus();
      if (showTraffic) {
        fetchTraffic();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [showTraffic]);

  useEffect(() => {
    if (testCmd === 'GET_DI' || testCmd === 'GET_DO' || testCmd === 'SET_DO') {
      fetchRegisteredSignals();
    }
  }, [testCmd]);

  const handleDiagnostics = async () => {
    try {
      const res = await pythonIdeService.getConnectionDiagnostics();
      setCmdResult(res);
      await fetchStatus();
      await fetchTraffic();
    } catch (err: any) {
      setCmdResult({ success: false, error: err.response?.data?.error || err.message || String(err) });
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setConnError(null);
    try {
      const effectiveMode = isLanIp(host) ? 'CONNECTED_PHYSICAL' : mode;
      if (effectiveMode !== mode) {
        setMode(effectiveMode);
      }
      const res = await pythonIdeService.connectRobot(
        host,
        port,
        timeout,
        effectiveMode,
        effectiveMode === 'CONNECTED_PHYSICAL' ? autoArmOnLan : false
      );
      if (!res?.success) {
        setConnError(res?.error || 'No se pudo establecer conexión con el controlador.');
      }
      await fetchStatus();
      await fetchTraffic();
    } catch (err: any) {
      setConnError(err.response?.data?.error || err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setConnError(null);
    try {
      await pythonIdeService.disconnectRobot();
      await fetchStatus();
      await fetchTraffic();
    } catch (err: any) {
      setConnError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePing = async () => {
    try {
      const res = await pythonIdeService.pingRobot();
      setCmdResult(res);
      await fetchStatus();
      await fetchTraffic();
    } catch (err: any) {
      setCmdResult({ success: false, error: err.message || String(err) });
    }
  };

  const handleArmToggle = async () => {
    try {
      const nextArmed = !status?.physical_armed;
      const res = await pythonIdeService.armPhysical(nextArmed);
      await fetchStatus();
    } catch (err: any) {
      alert(`Error al cambiar armado físico: ${err.message || err}`);
    }
  };

  const handleSendCommand = async () => {
    try {
      if ((testCmd === 'SET_DO' || testCmd === 'MOVE_JOINTS' || testCmd === 'MOVE_PRESET') && mode === 'CONNECTED_PHYSICAL') {
        if (!status?.physical_armed) {
          alert('El canal físico debe estar ARMADO antes de enviar órdenes al robot real.');
          return;
        }
        if (!physicalConfirm) {
          alert('Debe activar la confirmación explícita de seguridad para operar en hardware real.');
          return;
        }
      }

      let extra: Record<string, any> = {};
      let nameParam: string | undefined = undefined;

      if (testCmd === 'MOVE_PRESET') {
        extra = { target: presetTarget, speed: motionSpeed };
        nameParam = presetTarget;
      } else if (testCmd === 'MOVE_JOINTS') {
        extra = { joints: motionJoints, speed: motionSpeed };
      } else if (testCmd === 'GET_DI' || testCmd === 'GET_DO' || testCmd === 'GET_VARIABLE') {
        nameParam = signalName;
      } else if (testCmd === 'SET_DO') {
        nameParam = signalName;
      }

      const res = await pythonIdeService.sendCommand(
        testCmd,
        nameParam,
        testCmd === 'SET_DO' ? signalValue : undefined,
        physicalConfirm,
        extra
      );
      setCmdResult(res);
      await fetchStatus();
      await fetchTraffic();
    } catch (err: any) {
      setCmdResult({ success: false, error: err.response?.data?.error || err.message || String(err) });
    }
  };

  const handleToggleMockServer = async () => {
    setLoading(true);
    try {
      if (status?.mock_server_running) {
        await pythonIdeService.stopMockServer();
      } else {
        await pythonIdeService.startMockServer();
      }
      await fetchStatus();
    } catch (err: any) {
      alert(`Error en mock server: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const isConnected = status?.is_connected ?? false;

  return (
    <div className="flex flex-col h-full bg-[#0b1017] text-gray-300 font-mono text-xs border-r border-white/10 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/20 select-none">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-gray-200 tracking-wider uppercase text-[11px]">
            Conexión ABB IRC5
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            {isConnected ? 'Conectado' : 'Desconectado'}
          </div>
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

      <div className="p-3 space-y-3.5">
        <div className="space-y-1 bg-black/30 p-2 rounded border border-white/5">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">
            Perfil de Conexión
          </label>
          <select
            value={selectedProfileId}
            disabled={isConnected}
            onChange={(e) => handleSelectProfile(e.target.value)}
            className="w-full px-2 py-1 bg-black/50 border border-white/10 rounded text-cyan-300 text-[11px] focus:outline-none focus:border-cyan-400"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {profiles.find((p) => p.id === selectedProfileId)?.description && (
            <p className="text-[9px] text-gray-500 pt-0.5">
              {profiles.find((p) => p.id === selectedProfileId)?.description}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            Parámetros de Red
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Controlador IP</label>
              <input
                type="text"
                value={host}
                disabled={isConnected}
                onChange={(e) => {
                  const val = e.target.value;
                  setHost(val);
                  if (isLanIp(val)) {
                    setMode('CONNECTED_PHYSICAL');
                  }
                }}
                className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Puerto TCP</label>
              <input
                type="number"
                value={port}
                disabled={isConnected}
                onChange={(e) => setPort(parseInt(e.target.value) || 5001)}
                className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Timeout (s)</label>
              <input
                type="number"
                step="0.5"
                value={timeout}
                disabled={isConnected}
                onChange={(e) => setTimeoutVal(parseFloat(e.target.value) || 3.0)}
                className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Modo de Operación</label>
              <select
                value={mode}
                disabled={isConnected}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400 text-[11px]"
              >
                <option value="SIMULATED">RobotStudio / Virtual (TCP)</option>
                <option value="CONNECTED_PHYSICAL">IRC5 Físico (Laboratorio)</option>
                <option value="DEVELOPMENT">Desarrollo Libre</option>
              </select>
            </div>
          </div>

          {(mode === 'CONNECTED_PHYSICAL' || isLanIp(host)) && (
            <label className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-500/10 border border-amber-500/25 rounded text-[10px] text-amber-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoArmOnLan}
                disabled={isConnected}
                onChange={(e) => setAutoArmOnLan(e.target.checked)}
                className="rounded border-amber-500/40 accent-amber-400"
              />
              <span>Armar canal físico automáticamente al conectar por LAN</span>
            </label>
          )}

          <div className="flex gap-2 pt-1">
            {isConnected ? (
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded font-semibold hover:bg-red-500/30 transition-all"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>Desconectar</span>
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-cyan-500 text-black font-semibold rounded hover:bg-cyan-400 transition-all shadow-sm shadow-cyan-500/30"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Conectar IRC5</span>
              </button>
            )}

            <button
              onClick={handlePing}
              disabled={!isConnected}
              title="Comprobar latencia PING"
              className={`px-3 py-1.5 rounded border flex items-center gap-1 ${
                isConnected
                  ? 'bg-white/5 border-white/10 text-cyan-400 hover:bg-white/10'
                  : 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Ping</span>
            </button>
          </div>

          {connError && (
            <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-[10px] leading-snug">
              {connError}
            </div>
          )}
        </div>

        <div className="p-2.5 rounded-lg bg-black/30 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-300 font-semibold flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              Servidor Simulado Local (Mock)
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                status?.mock_server_running
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 text-gray-500'
              }`}
            >
              {status?.mock_server_running ? 'Activo (5001)' : 'Apagado'}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 leading-tight">
            Emula las respuestas de RobotWare 5/6 para pruebas sin necesidad de un controlador físico o RobotStudio.
          </p>
          <button
            onClick={handleToggleMockServer}
            disabled={loading}
            className={`w-full py-1 rounded text-[11px] font-semibold border transition-all ${
              status?.mock_server_running
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                : 'bg-white/10 text-gray-300 border-white/15 hover:bg-white/20'
            }`}
          >
            {status?.mock_server_running ? 'Detener Servidor Mock' : 'Iniciar Servidor Mock'}
          </button>
        </div>

        {status && (
          <div className="grid grid-cols-2 gap-2 p-2 bg-black/30 rounded border border-white/5 text-[11px]">
            <div>
              <span className="text-gray-500 block text-[10px]">Latencia RTT:</span>
              <span className="font-semibold text-cyan-300">
                {status.latency_ms !== null ? `${status.latency_ms} ms` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Canal Activo:</span>
              <span className={`font-semibold ${status.is_connected ? 'text-emerald-400' : 'text-amber-300'}`}>
                {status.mock_server_running
                  ? 'MOCK PYTHON (5001)'
                  : status.is_connected
                  ? status.mode === 'CONNECTED_PHYSICAL'
                    ? 'IRC5 FÍSICO (TCP)'
                    : 'ROBOTSTUDIO (TCP)'
                  : 'SIN ENLACE TCP'}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              Control y Pruebas
            </span>
            {mode === 'CONNECTED_PHYSICAL' && (
              <button
                type="button"
                onClick={handleArmToggle}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                  status?.physical_armed
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-white/5 text-gray-400 border-white/10'
                }`}
              >
                {status?.physical_armed ? 'CANAL ARMADO' : 'DESARMADO'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={testCmd}
              onChange={(e) => {
                const nextCmd = e.target.value as any;
                setTestCmd(nextCmd);
                if (nextCmd === 'GET_DI') {
                  const firstDi = registeredSignals.find((s) => s.type === 'DI');
                  if (firstDi && !registeredSignals.some((s) => s.type === 'DI' && s.name === signalName)) {
                    setSignalName(firstDi.name);
                  }
                } else if (nextCmd === 'GET_DO' || nextCmd === 'SET_DO') {
                  const firstDo = registeredSignals.find((s) => s.type === 'DO');
                  if (firstDo && !registeredSignals.some((s) => s.type === 'DO' && s.name === signalName)) {
                    setSignalName(firstDo.name);
                  }
                } else if (nextCmd === 'GET_VARIABLE' && (signalName.startsWith('di_') || signalName.startsWith('do_'))) {
                  setSignalName('speed_override');
                }
              }}
              className="px-2 py-1 bg-black/40 border border-white/10 rounded text-white text-[11px]"
            >
              <option value="PING">PING</option>
              <option value="GET_STATUS">GET_STATUS</option>
              <option value="GET_JOINTS">GET_JOINTS</option>
              <option value="MOVE_PRESET">MOVE_PRESET</option>
              <option value="MOVE_JOINTS">MOVE_JOINTS</option>
              <option value="GET_DI">GET_DI</option>
              <option value="GET_DO">GET_DO</option>
              <option value="SET_DO">SET_DO</option>
              <option value="GET_VARIABLE">GET_VARIABLE</option>
            </select>

            {testCmd === 'MOVE_PRESET' ? (
              <select
                value={presetTarget}
                onChange={(e) => setPresetTarget(e.target.value as any)}
                className="px-2 py-1 bg-black/40 border border-white/10 rounded text-cyan-300 text-[11px]"
              >
                <option value="HOME">HOME [0,0,0,0,0,0]</option>
                <option value="TEST_DELTA_J1">TEST_DELTA_J1 (+10° J1)</option>
                <option value="TEST_SAFE_1">TEST_SAFE_1 (Despegue)</option>
              </select>
            ) : testCmd === 'GET_DI' || testCmd === 'GET_DO' || testCmd === 'SET_DO' || testCmd === 'GET_VARIABLE' ? (
              <>
                <input
                  type="text"
                  list={testCmd === 'GET_VARIABLE' ? 'registered-vars' : 'registered-io-signals'}
                  value={signalName}
                  onChange={(e) => setSignalName(e.target.value)}
                  placeholder="Nombre señal"
                  className="px-2 py-1 bg-black/40 border border-white/10 rounded text-white text-[11px]"
                />
                <datalist id="registered-io-signals">
                  {registeredSignals
                    .filter((s) => (testCmd === 'GET_DI' ? s.type === 'DI' : s.type === 'DO'))
                    .map((s) => (
                      <option key={s.name} value={s.name} />
                    ))}
                </datalist>
                <datalist id="registered-vars">
                  <option value="speed_override" />
                  <option value="cycle_counter" />
                  <option value="current_speed" />
                </datalist>
              </>
            ) : (
              <div className="px-2 py-1 bg-black/20 rounded text-[10px] text-gray-500 flex items-center">
                Comando directo
              </div>
            )}
          </div>

          {(testCmd === 'MOVE_PRESET' || testCmd === 'MOVE_JOINTS') && (
            <div className="p-2 bg-black/40 rounded border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Velocidad segura:</span>
                <span className="text-cyan-300 font-semibold">{motionSpeed} mm/s</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                value={motionSpeed}
                onChange={(e) => setMotionSpeed(parseInt(e.target.value) || 50)}
                className="w-full accent-cyan-400 h-1 bg-white/10 rounded"
              />
            </div>
          )}

          {testCmd === 'MOVE_JOINTS' && (
            <div className="p-2 bg-black/40 rounded border border-white/10 space-y-1">
              <span className="text-[10px] text-gray-400 block font-semibold">Ángulos Articulares (°):</span>
              <div className="grid grid-cols-3 gap-1">
                {motionJoints.map((q, idx) => (
                  <div key={idx} className="flex flex-col">
                    <label className="text-[9px] text-gray-500">J{idx + 1}</label>
                    <input
                      type="number"
                      step="1"
                      value={q}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const copy = [...motionJoints];
                        copy[idx] = val;
                        setMotionJoints(copy);
                      }}
                      className="px-1 py-0.5 bg-black/50 border border-white/10 rounded text-[10px] text-white text-center focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {testCmd === 'SET_DO' && (
            <div className="flex items-center justify-between p-1.5 bg-black/40 rounded border border-white/10">
              <span className="text-[10px] text-gray-400">Valor de Salida:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSignalValue(0)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    signalValue === 0 ? 'bg-red-500 text-white' : 'bg-white/10 text-gray-400'
                  }`}
                >
                  0 (OFF)
                </button>
                <button
                  type="button"
                  onClick={() => setSignalValue(1)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    signalValue === 1 ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-400'
                  }`}
                >
                  1 (ON)
                </button>
              </div>
            </div>
          )}

          {mode === 'CONNECTED_PHYSICAL' && (testCmd === 'SET_DO' || testCmd === 'MOVE_JOINTS' || testCmd === 'MOVE_PRESET') && (
            <label className="flex items-center gap-1.5 p-1.5 bg-red-950/20 border border-red-500/30 rounded text-[10px] text-red-300 cursor-pointer">
              <input
                type="checkbox"
                checked={physicalConfirm}
                onChange={(e) => setPhysicalConfirm(e.target.checked)}
                className="rounded border-red-500/40"
              />
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span>Confirmar acción en robot físico real</span>
            </label>
          )}

          <div className="flex gap-1.5">
            <button
              onClick={handleSendCommand}
              disabled={!isConnected}
              className={`flex-1 py-1.5 rounded font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                isConnected
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              <Send className="w-3 h-3" />
              <span>Enviar Comando ({testCmd})</span>
            </button>

            <button
              type="button"
              onClick={handleDiagnostics}
              title="Consultar /api/connection/diagnostics (enlace, PING, estado, DI/DO y tráfico)"
              className="px-2.5 py-1.5 rounded font-semibold text-[11px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all"
            >
              Diagnóstico
            </button>
          </div>

          {cmdResult && (
            <div className="p-2 bg-black/50 rounded border border-white/10 text-[10px] space-y-1">
              <div className="text-gray-400 font-semibold">Respuesta:</div>
              <pre className="text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(cmdResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 pt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              Tráfico de Red Reciente
            </span>
            <button
              onClick={() => setShowTraffic(!showTraffic)}
              className="text-[10px] text-cyan-400 hover:underline"
            >
              {showTraffic ? 'Ocultar' : 'Ver registros'}
            </button>
          </div>

          {showTraffic && (
            <div className="max-h-40 overflow-y-auto space-y-1 bg-black/40 p-1.5 rounded border border-white/5 text-[10px]">
              {traffic.length === 0 ? (
                <div className="text-gray-600 italic text-center py-2">Sin tráfico registrado</div>
              ) : (
                traffic.slice(-8).reverse().map((t, i) => (
                  <div key={i} className="flex items-center justify-between font-mono py-0.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-1">
                      <span className={t.direction === 'IN' ? 'text-emerald-400' : 'text-blue-400'}>
                        [{t.direction}]
                      </span>
                      <span className="text-gray-400 truncate max-w-[140px]">
                        {JSON.stringify(t.payload)}
                      </span>
                    </div>
                    <span className="text-gray-600 text-[9px]">{t.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
