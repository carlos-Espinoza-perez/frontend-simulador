import { useState, useRef, useEffect, MouseEvent } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  initialPosition?: Position;
  bounds?: 'parent' | 'window';
}

export function useDraggable(options: UseDraggableOptions = {}) {
  const { initialPosition = { x: 0, y: 0 }, bounds = 'window' } = options;

  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const elementStartPos = useRef<Position>({ x: 0, y: 0 });
  const elementSize = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const rafId = useRef<number | null>(null);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handle]')) return;
    if (target.closest('button, input, select, textarea')) return;

    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    elementStartPos.current = { ...position };

    if (dragRef.current) {
      const rect = dragRef.current.getBoundingClientRect();
      elementSize.current = { width: rect.width, height: rect.height };
    }
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging) return;

      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragStartPos.current.x;
        const deltaY = e.clientY - dragStartPos.current.y;

        let newX = elementStartPos.current.x + deltaX;
        let newY = elementStartPos.current.y + deltaY;

        if (bounds === 'window') {
          const maxX = window.innerWidth - (elementSize.current.width || 300);
          const maxY = window.innerHeight - (elementSize.current.height || 200);
          newX = Math.max(8, Math.min(newX, Math.max(8, maxX)));
          newY = Math.max(56, Math.min(newY, Math.max(56, maxY)));
        }

        setPosition({ x: newX, y: newY });
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
      document.body.style.userSelect = '';
    };
  }, [isDragging, bounds]);

  return {
    position,
    isDragging,
    dragRef,
    handleMouseDown,
    setPosition,
  };
}
