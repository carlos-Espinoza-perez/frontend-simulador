import { useState, useEffect } from 'react';
import { AlertOctagon, ShieldAlert, X, ArrowRight, RotateCcw } from 'lucide-react';
import geometryService, { AlertaColision } from '../../services/geometryService';

export function CollisionAlertBanner() {
  const [alerta, setAlerta] = useState<AlertaColision | null>(null);

  useEffect(() => {
    const desuscribir = geometryService.suscribirAlerta((nuevaAlerta) => {
      setAlerta(nuevaAlerta);
    });
    return desuscribir;
  }, []);

  if (!alerta || !alerta.activa) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto">
      <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/80 bg-slate-950/95 p-5 shadow-[0_0_50px_rgba(239,68,68,0.35)] backdrop-blur-xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-inner">
            <ShieldAlert className="w-7 h-7 animate-bounce" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white">
                  Parada Preventiva
                </span>
                <h3 className="text-base font-bold text-white tracking-wide">
                  {alerta.titulo}
                </h3>
              </div>
              <button
                onClick={() => geometryService.despejarAlerta()}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                title="Cerrar advertencia"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-1 text-sm font-medium text-red-200">
              {alerta.mensaje}
            </p>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="bg-red-950/50 border border-red-500/30 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] uppercase tracking-wider text-red-400/80 font-mono block">Obstáculo</span>
                <span className="text-xs font-semibold text-white truncate block">{alerta.obstaculo}</span>
              </div>
              <div className="bg-red-950/50 border border-red-500/30 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] uppercase tracking-wider text-red-400/80 font-mono block">Componente Robot</span>
                <span className="text-xs font-semibold text-white truncate block">{alerta.link}</span>
              </div>
              <div className="bg-red-950/50 border border-red-500/30 rounded-lg px-2.5 py-1.5 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase tracking-wider text-red-400/80 font-mono block">Margen Seguridad</span>
                <span className="text-xs font-semibold text-emerald-300 block">30 mm (Sin impacto)</span>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-black/40 border border-white/10 font-mono text-xs text-gray-300 leading-relaxed">
              {alerta.detalle}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2.5">
              <button
                onClick={() => geometryService.despejarAlerta()}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition-colors shadow-lg shadow-red-600/30 flex items-center gap-1.5"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Entendido / Despejar Alerta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
