import React, { useRef, useEffect } from 'react';
import {
  Terminal,
  Play,
  Square,
  Trash2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  PanelRight,
  PanelBottom,
  X
} from 'lucide-react';
import { ScriptStatus } from '../../../services/pythonIdeService';

export interface ConsoleLogEntry {
  type: 'stdout' | 'stderr' | 'system';
  text: string;
  timestamp: number;
}

interface ConsoleTerminalProps {
  logs: ConsoleLogEntry[];
  status: ScriptStatus;
  selectedFile: string | null;
  dockPosition: 'bottom' | 'right';
  isMaximized: boolean;
  onToggleDock: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  onRunScript: () => void;
  onStopScript: () => void;
  onClearLogs: () => void;
}

export const ConsoleTerminal: React.FC<ConsoleTerminalProps> = ({
  logs,
  status,
  selectedFile,
  dockPosition,
  isMaximized,
  onToggleDock,
  onToggleMaximize,
  onClose,
  onRunScript,
  onStopScript,
  onClearLogs,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.type.toUpperCase()}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0e14] border-t border-white/10 font-mono text-xs select-none">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0b1017] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 truncate">
          <Terminal className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="font-semibold text-gray-200 uppercase text-[11px] tracking-wider truncate">
            Terminal de Ejecución
          </span>
          {status.is_running ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] border border-cyan-400/30 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              PID: {status.pid} ({status.elapsed_seconds}s)
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 text-[10px] flex-shrink-0">
              Inactivo
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {status.is_running ? (
            <button
              onClick={onStopScript}
              className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-300 border border-red-500/40 rounded hover:bg-red-500/30 transition-colors text-[10px]"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Detener</span>
            </button>
          ) : (
            <button
              onClick={onRunScript}
              disabled={!selectedFile || !selectedFile.endsWith('.py')}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded font-semibold text-[10px] transition-all ${
                selectedFile && selectedFile.endsWith('.py')
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-sm shadow-cyan-500/30'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Run</span>
            </button>
          )}

          <div className="w-px h-3 bg-white/10 mx-0.5" />

          <button
            onClick={onToggleDock}
            title={dockPosition === 'bottom' ? 'Acoplar a la derecha' : 'Acoplar abajo'}
            className="p-1 hover:text-white text-gray-400 hover:bg-white/5 rounded transition-colors"
          >
            {dockPosition === 'bottom' ? (
              <PanelRight className="w-3.5 h-3.5" />
            ) : (
              <PanelBottom className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={onToggleMaximize}
            title={isMaximized ? 'Restaurar tamaño' : 'Maximizar consola'}
            className="p-1 hover:text-white text-gray-400 hover:bg-white/5 rounded transition-colors"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleCopyLogs}
            title="Copiar salida de consola"
            className="p-1 hover:text-white text-gray-400 hover:bg-white/5 rounded transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClearLogs}
            title="Limpiar consola"
            className="p-1 hover:text-white text-gray-400 hover:bg-white/5 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            title="Ocultar consola"
            className="p-1 hover:text-red-300 text-gray-400 hover:bg-white/5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1 select-text">
        {logs.length === 0 ? (
          <div className="text-gray-600 italic">
            Presiona 'Run' para iniciar el script Python en un subproceso controlado.
          </div>
        ) : (
          logs.map((log, index) => {
            let textColor = 'text-gray-300';
            if (log.type === 'stderr') textColor = 'text-red-400 font-medium';
            if (log.type === 'system') textColor = 'text-cyan-400/80';

            return (
              <div key={index} className={`leading-relaxed whitespace-pre-wrap break-all ${textColor}`}>
                {log.text}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
