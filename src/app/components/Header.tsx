import { Circle } from 'lucide-react';

interface HeaderProps {
  robotName: string;
}

export function Header({ robotName }: HeaderProps) {
  return (
    <header className="relative z-50 flex items-center justify-between px-8 py-4 border-b border-white/10 bg-[#0a0e14]/80 backdrop-blur-md">
      {/* Left: Logo and Robot Name */}
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
  
      {/* Right: System Status */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
        <Circle className="w-3 h-3 fill-green-500 text-green-500" />
        <span className="text-sm text-green-400 font-medium">CONECTADO</span>
      </div>
    </header>
  );
}
