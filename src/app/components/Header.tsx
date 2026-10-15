import { Circle, Box, Camera, ExternalLink } from 'lucide-react';

export type SpaViewMode = 'simulador' | 'vision';

interface HeaderProps {
  robotName: string;
  connected?: boolean;
  activeView?: SpaViewMode;
  onViewChange?: (view: SpaViewMode) => void;
}

export function Header({
  robotName,
  connected = true,
  activeView = 'simulador',
  onViewChange,
}: HeaderProps) {
  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetView: SpaViewMode
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onViewChange?.(targetView);
  };

  return (
    <header className="fixed top-3 inset-x-4 z-40 h-11 px-4 flex items-center justify-between rounded-xl border border-white/10 bg-[#0b1017]/85 backdrop-blur-xl shadow-xl select-none">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center shadow-sm shadow-cyan-500/20">
          <div className="w-3 h-3 border-[1.5px] border-white rounded-full" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
            Celda Robótica
          </span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-white font-semibold tracking-tight">{robotName}</span>
        </div>
      </div>

      {onViewChange && (
        <nav className="flex items-center gap-1 p-0.5 rounded-lg bg-black/50 border border-white/10">
          <a
            href="/"
            onClick={(e) => handleNavClick(e, 'simulador')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-150 ${
              activeView === 'simulador'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Simulador 3D</span>
          </a>

          <div className="flex items-center">
            <a
              href="/vision"
              onClick={(e) => handleNavClick(e, 'vision')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-l-md text-[11px] font-medium transition-all duration-150 ${
                activeView === 'vision'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Visión y calibración</span>
            </a>
            <a
              href="/vision"
              target="_blank"
              rel="noreferrer"
              title="Abrir /vision en una pestaña independiente"
              className="px-1.5 py-1 rounded-r-md text-[11px] text-gray-400 hover:text-amber-300 hover:bg-white/10 border border-l-0 border-white/10 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </nav>
      )}

      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-md border ${
          connected
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : 'bg-yellow-500/10 border-yellow-500/20'
        }`}
      >
        <Circle
          className={`w-2 h-2 ${
            connected ? 'fill-emerald-400 text-emerald-400' : 'fill-yellow-400 text-yellow-400'
          }`}
        />
        <span className={`text-[11px] font-medium ${connected ? 'text-emerald-400' : 'text-yellow-400'}`}>
          {connected ? 'Conectado' : 'REST API'}
        </span>
      </div>
    </header>
  );
}
