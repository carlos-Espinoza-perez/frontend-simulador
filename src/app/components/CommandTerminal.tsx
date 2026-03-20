import { Terminal, X, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { useDraggable } from '../hooks/useDraggable';

export function CommandTerminal({ onClose }: { onClose: () => void }) {
  const { position, isDragging, dragRef, handleMouseDown } = useDraggable({
    initialPosition: { x: window.innerWidth / 2 - 240, y: window.innerHeight - 240 },
  });

  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([
    '> Sistema inicializado',
    '> Cinemática: OK',
    '> Esperando comandos...',
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      setHistory([...history, `> ${command}`]);
      setCommand('');
    }
  };

  return (
    <div
      ref={dragRef}
      onMouseDown={handleMouseDown}
      className={`fixed w-[480px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden ${
        isDragging ? 'cursor-grabbing' : ''
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 30,
      }}
    >
      {}
      <div
        data-drag-handle
        className="bg-black/40 px-4 py-2 border-b border-white/10 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-500" />
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs uppercase tracking-wider text-cyan-400">Consola de Comandos</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {}
      <div className="p-4">
        {}
        <div className="h-24 overflow-y-auto mb-3 space-y-1 text-xs font-mono">
          {history.map((line, index) => (
            <div key={index} className="text-green-400/70">
              {line}
            </div>
          ))}
        </div>

        {}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <span className="text-cyan-400 font-mono text-sm">$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="MoveL [450, 200, 680, 0, 90, 0]"
            className="flex-1 bg-black/30 text-white text-sm font-mono px-3 py-2 rounded border border-white/10 focus:border-cyan-500/50 focus:outline-none placeholder:text-gray-600"
          />
        </form>

        {}
        <div className="mt-3 text-xs text-gray-600">
          <div>Ej: MoveL [x, y, z, rx, ry, rz]</div>
          <div>Ej: MoveJ [j1, j2, j3, j4, j5, j6]</div>
        </div>
      </div>
    </div>
  );
}