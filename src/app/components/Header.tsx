import React from 'react';
import { Circle, Box, Camera, Code2 } from 'lucide-react';
import { SnapLayout, SnapLayoutSelector } from './SnapLayoutSelector';

export type SpaViewMode = 'simulador' | 'vision' | 'python-ide';

interface HeaderProps {
  robotName: string;
  connected?: boolean;
  activeView?: SpaViewMode;
  onViewChange?: (view: SpaViewMode) => void;
  currentLayout: SnapLayout;
  onSelectLayout: (layout: SnapLayout) => void;
  floatingCamera: boolean;
  onToggleFloatingCamera: () => void;
  floatingJoints: boolean;
  onToggleFloatingJoints: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  robotName,
  connected = true,
  activeView = 'simulador',
  onViewChange,
  currentLayout,
  onSelectLayout,
  floatingCamera,
  onToggleFloatingCamera,
  floatingJoints,
  onToggleFloatingJoints,
}) => {
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

      <div className="flex items-center gap-2">
        {onViewChange && (
          <nav className="flex items-center gap-1 p-1 rounded-lg bg-black/40 border border-white/10">
            <a
              href="/"
              onClick={(e) => handleNavClick(e, 'simulador')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                activeView === 'simulador' && currentLayout === 'single'
                  ? 'bg-[#00e5ff] text-black font-semibold shadow-sm shadow-cyan-500/25'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Simulador 3D</span>
            </a>

            <a
              href="/vision"
              onClick={(e) => handleNavClick(e, 'vision')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                activeView === 'vision' && currentLayout === 'single'
                  ? 'bg-[#00e5ff] text-black font-semibold shadow-sm shadow-cyan-500/25'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Visión</span>
            </a>

            <a
              href="/python-ide"
              onClick={(e) => handleNavClick(e, 'python-ide')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                activeView === 'python-ide' && currentLayout === 'single'
                  ? 'bg-[#00e5ff] text-black font-semibold shadow-sm shadow-cyan-500/25'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>IDE</span>
            </a>
          </nav>
        )}

        <SnapLayoutSelector
          currentLayout={currentLayout}
          onSelectLayout={onSelectLayout}
          floatingCamera={floatingCamera}
          onToggleFloatingCamera={onToggleFloatingCamera}
          floatingJoints={floatingJoints}
          onToggleFloatingJoints={onToggleFloatingJoints}
        />
      </div>

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
};
