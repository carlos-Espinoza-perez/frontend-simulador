import { Circle } from 'lucide-react';

interface HeaderProps {
  robotName: string;
  connected?: boolean;
}

export function Header({ robotName, connected = true }: HeaderProps) {
  return (
    <header className="relative z-40 flex items-center justify-between px-8 py-4 border-b border-white/10 bg-[#0a0e14]/80 backdrop-blur-md">
      {}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white rounded-full" />
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Digital Twin</div>
            <div className="text-lg text-white font-semibold">{robotName}</div>
          </div>
        </div>
      </div>

      {}
      <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${connected ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
        <Circle className={`w-3 h-3 ${connected ? 'fill-green-500 text-green-500' : 'fill-yellow-500 text-yellow-500'}`} />
        <span className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-yellow-400'}`}>
          {connected ? 'WebSocket Conectado' : 'REST API'}
        </span>
      </div>
    </header>
  );
}
