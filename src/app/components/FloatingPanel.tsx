import React, { useState, useRef, useEffect } from 'react';
import { Minus, X, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface FloatingPanelProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  initialPosition?: { x: number; y: number };
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  onClose: () => void;
  children: React.ReactNode;
}

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  title,
  icon,
  initialPosition = { x: 40, y: 80 },
  width = 460,
  height = 360,
  minWidth = 320,
  minHeight = 220,
  onClose,
  children,
}) => {
  const { position, isDragging, dragRef, handleMouseDown } = useDraggable({
    initialPosition,
    bounds: 'window',
  });

  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [size, setSize] = useState({ width, height });
  const [isResizing, setIsResizing] = useState(false);

  const resizeStartPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width, height });
  const rafResizeId = useRef<number | null>(null);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { ...size };
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      if (rafResizeId.current !== null) {
        cancelAnimationFrame(rafResizeId.current);
      }

      rafResizeId.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - resizeStartPos.current.x;
        const deltaY = e.clientY - resizeStartPos.current.y;

        const maxW = window.innerWidth - position.x - 16;
        const maxH = window.innerHeight - position.y - 16;

        const nextW = Math.max(minWidth, Math.min(startSize.current.width + deltaX, maxW));
        const nextH = Math.max(minHeight, Math.min(startSize.current.height + deltaY, maxH));

        setSize({ width: nextW, height: nextH });
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (rafResizeId.current !== null) {
        cancelAnimationFrame(rafResizeId.current);
        rafResizeId.current = null;
      }
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafResizeId.current !== null) {
        cancelAnimationFrame(rafResizeId.current);
      }
      document.body.style.userSelect = '';
    };
  }, [isResizing, position.x, position.y, minWidth, minHeight]);

  const activeInteraction = isDragging || isResizing;

  return (
    <>
      {activeInteraction && (
        <div
          className={`fixed inset-0 z-50 ${
            isResizing ? 'cursor-se-resize' : 'cursor-grabbing'
          }`}
        />
      )}

      <div
        ref={dragRef}
        onMouseDown={handleMouseDown}
        style={{
          left: maximized ? 16 : `${position.x}px`,
          top: maximized ? 64 : `${position.y}px`,
          width: maximized ? 'calc(100vw - 32px)' : `${size.width}px`,
          height: minimized ? 'auto' : maximized ? 'calc(100vh - 80px)' : `${size.height}px`,
          zIndex: 50,
        }}
        className={`fixed rounded-xl border border-white/20 bg-[#0b1017]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden ${
          activeInteraction
            ? 'transition-none opacity-95 ring-1 ring-cyan-500/40 select-none'
            : 'transition-[width,height,left,top] duration-150'
        }`}
      >
        <div
          data-drag-handle
          className="h-9 px-3 bg-black/70 border-b border-white/10 flex items-center justify-between text-xs cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <GripHorizontal className="w-3.5 h-3.5 text-gray-500" />
            {icon}
            <span className="font-semibold text-gray-200 tracking-wide text-[11px] truncate max-w-[220px]">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized((v) => !v)}
              title={minimized ? 'Restaurar' : 'Minimizar'}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setMaximized((v) => !v)}
              title={maximized ? 'Restaurar tamaño' : 'Maximizar'}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            >
              {maximized ? (
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={onClose}
              title="Cerrar ventana flotante"
              className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!minimized && (
          <div className="flex-1 w-full relative min-h-0 overflow-hidden bg-[#070b10]">
            {children}

            {!maximized && (
              <div
                onMouseDown={handleResizeStart}
                title="Arrastrar para redimensionar"
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center text-gray-500 hover:text-cyan-400 transition-colors z-20 group"
              >
                <div className="w-2 h-2 border-r-2 border-b-2 border-gray-500 group-hover:border-cyan-400" />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
