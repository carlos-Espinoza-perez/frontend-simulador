import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  Columns2,
  Square,
  PanelsTopLeft,
  Camera,
  Sliders,
  Check
} from 'lucide-react';

export type SnapLayout = 'single' | 'split-h' | 'trio' | 'quad';

interface SnapLayoutSelectorProps {
  currentLayout: SnapLayout;
  onSelectLayout: (layout: SnapLayout) => void;
  floatingCamera: boolean;
  onToggleFloatingCamera: () => void;
  floatingJoints: boolean;
  onToggleFloatingJoints: () => void;
}

export const SnapLayoutSelector: React.FC<SnapLayoutSelectorProps> = ({
  currentLayout,
  onSelectLayout,
  floatingCamera,
  onToggleFloatingCamera,
  floatingJoints,
  onToggleFloatingJoints,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Acomodar ventanas (Snap Layouts)"
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
          open
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
            : currentLayout !== 'single'
            ? 'bg-white/10 text-white border border-white/20'
            : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
        }`}
      >
        <PanelsTopLeft className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">Acomodar Mosaicos</span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-white/15 bg-[#0b1017]/95 backdrop-blur-2xl p-3 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
              Disposición de Ventanas
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">Snap Assist</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onSelectLayout('single');
                setOpen(false);
              }}
              className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-left ${
                currentLayout === 'single'
                  ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300 shadow-sm shadow-cyan-500/20'
                  : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="w-14 h-9 rounded border border-current flex p-0.5">
                <div className="w-full h-full rounded-xs bg-current opacity-40" />
              </div>
              <span className="text-[10px] font-semibold">1 Panel</span>
            </button>

            <button
              onClick={() => {
                onSelectLayout('split-h');
                setOpen(false);
              }}
              className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-left ${
                currentLayout === 'split-h'
                  ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300 shadow-sm shadow-cyan-500/20'
                  : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="w-14 h-9 rounded border border-current flex gap-0.5 p-0.5">
                <div className="w-1/2 h-full rounded-xs bg-current opacity-40" />
                <div className="w-1/2 h-full rounded-xs bg-current opacity-40" />
              </div>
              <span className="text-[10px] font-semibold">2 Paneles (50/50)</span>
            </button>

            <button
              onClick={() => {
                onSelectLayout('trio');
                setOpen(false);
              }}
              className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-left ${
                currentLayout === 'trio'
                  ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300 shadow-sm shadow-cyan-500/20'
                  : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="w-14 h-9 rounded border border-current flex gap-0.5 p-0.5">
                <div className="w-3/5 h-full rounded-xs bg-current opacity-40" />
                <div className="w-2/5 h-full flex flex-col gap-0.5">
                  <div className="h-1/2 rounded-xs bg-current opacity-40" />
                  <div className="h-1/2 rounded-xs bg-current opacity-40" />
                </div>
              </div>
              <span className="text-[10px] font-semibold">Trío (1 + 2)</span>
            </button>

            <button
              onClick={() => {
                onSelectLayout('quad');
                setOpen(false);
              }}
              className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-left ${
                currentLayout === 'quad'
                  ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300 shadow-sm shadow-cyan-500/20'
                  : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="w-14 h-9 rounded border border-current grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5">
                <div className="rounded-xs bg-current opacity-40" />
                <div className="rounded-xs bg-current opacity-40" />
                <div className="rounded-xs bg-current opacity-40" />
                <div className="rounded-xs bg-current opacity-40" />
              </div>
              <span className="text-[10px] font-semibold">Mosaico 2x2</span>
            </button>
          </div>

          <div className="border-t border-white/10 pt-2 space-y-1.5">
            <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">
              Ventanas Flotantes (PiP)
            </span>

            <button
              onClick={onToggleFloatingCamera}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all ${
                floatingCamera
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <Camera className="w-3.5 h-3.5" />
                <span>Cámara en ventana flotante</span>
              </span>
              {floatingCamera && <Check className="w-3 h-3 text-emerald-400" />}
            </button>

            <button
              onClick={onToggleFloatingJoints}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all ${
                floatingJoints
                  ? 'bg-yellow-500/15 border border-yellow-500/30 text-yellow-300'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5" />
                <span>Control articular flotante</span>
              </span>
              {floatingJoints && <Check className="w-3 h-3 text-yellow-400" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
