import React, { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { Ruler, ChevronDown, ChevronUp, Crosshair, ArrowRight } from 'lucide-react';
import geometryService, { GeometryItem, RobotBasePose } from '../../services/geometryService';

interface DistanceData {
  origen: [number, number, number]; // mm en coordenadas celda
  destinoMesa: [number, number, number]; // mm
  distanciaMesaXy: number; // mm
  distanciaMesa3D: number; // mm
  distanciaBordeFrontal: number; // mm
  objetoSeleccionado?: {
    id: string;
    nombre: string;
    posicion: [number, number, number];
    distanciaXy: number;
    distancia3D: number;
    alcanzable: boolean;
  };
}

const ALCANCE_MAX_IRB140 = 810; // mm

export function useCellDistance() {
  const [basePose, setBasePose] = useState<RobotBasePose>(() => geometryService.obtenerBase());
  const [geometries, setGeometries] = useState<GeometryItem[]>(() => geometryService.obtenerTodas());
  const [selectedId, setSelectedId] = useState<string | 'robot_base' | null>(() => geometryService.getSeleccionado());

  useEffect(() => {
    const uBase = geometryService.suscribirBase(setBasePose);
    const uGeom = geometryService.suscribir(setGeometries);
    const uSel = geometryService.suscribirSeleccion(setSelectedId);
    return () => {
      uBase();
      uGeom();
      uSel();
    };
  }, []);

  const mesa = useMemo(
    () => geometries.find((g) => g.id.includes('mesa') || g.nombre.toLowerCase().includes('mesa')),
    [geometries]
  );

  const selectedItem = useMemo(
    () => (selectedId && selectedId !== 'robot_base' ? geometries.find((g) => g.id === selectedId) : null),
    [geometries, selectedId]
  );

  const data: DistanceData = useMemo(() => {
    const rx = basePose.x;
    const ry = basePose.y;
    const rz = basePose.z;

    const mx = mesa ? mesa.posicion[0] : 650;
    const my = mesa ? mesa.posicion[1] : 0;
    const mz = mesa ? mesa.posicion[2] + mesa.dimensiones[2] : 772;
    const mw = mesa ? mesa.dimensiones[0] : 700;

    const dx = mx - rx;
    const dy = my - ry;
    const dz = mz - rz;

    const dXy = Math.hypot(dx, dy);
    const d3D = Math.hypot(dx, dy, dz);

    const bordeX = mx - mw / 2;
    const distBorde = Math.max(0, bordeX - rx);

    let objSelData: DistanceData['objetoSeleccionado'] = undefined;
    if (selectedItem) {
      const ox = selectedItem.posicion[0];
      const oy = selectedItem.posicion[1];
      const oz = selectedItem.posicion[2] + (selectedItem.dimensiones[2] || 0);

      const odx = ox - rx;
      const ody = oy - ry;
      const odz = oz - rz;

      const odXy = Math.hypot(odx, ody);
      const od3D = Math.hypot(odx, ody, odz);

      objSelData = {
        id: selectedItem.id,
        nombre: selectedItem.nombre,
        posicion: [ox, oy, oz],
        distanciaXy: Math.round(odXy),
        distancia3D: Math.round(od3D),
        alcanzable: odXy <= ALCANCE_MAX_IRB140,
      };
    }

    return {
      origen: [rx, ry, rz],
      destinoMesa: [mx, my, mz],
      distanciaMesaXy: Math.round(dXy),
      distanciaMesa3D: Math.round(d3D),
      distanciaBordeFrontal: Math.round(distBorde),
      objetoSeleccionado: objSelData,
    };
  }, [basePose, mesa, selectedItem]);

  return data;
}

export function CellDistanceDimension3D({ visible = true }: { visible?: boolean }) {
  const [activo, setActivo] = useState(visible);
  const data = useCellDistance();

  useEffect(() => {
    const handler = (e: any) => {
      if (typeof e.detail === 'boolean') setActivo(e.detail);
    };
    window.addEventListener('toggle_dist_dimension', handler);
    return () => window.removeEventListener('toggle_dist_dimension', handler);
  }, []);

  const points = useMemo(() => {
    if (!activo) return null;
    const target = data.objetoSeleccionado?.posicion ?? data.destinoMesa;

    const pStart = new THREE.Vector3(
      0.070 + data.origen[0] / 1000,
      data.origen[2] / 1000,
      -data.origen[1] / 1000
    );

    const pEnd = new THREE.Vector3(
      0.070 + target[0] / 1000,
      target[2] / 1000,
      -target[1] / 1000
    );

    const pMid = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);
    pMid.y += 0.05;

    const geo = new THREE.BufferGeometry().setFromPoints([pStart, pEnd]);
    return { pStart, pEnd, pMid, geo };
  }, [data, visible]);

  if (!visible || !points) return null;

  const distMm = data.objetoSeleccionado ? data.objetoSeleccionado.distanciaXy : data.distanciaMesaXy;
  const label = data.objetoSeleccionado
    ? `${data.objetoSeleccionado.nombre}: ${distMm} mm`
    : `Centro Mesa: ${distMm} mm`;

  return (
    <group>
      <line geometry={points.geo}>
        <lineDashedMaterial
          color="#38bdf8"
          dashSize={0.03}
          gapSize={0.02}
          linewidth={2}
          transparent
          opacity={0.85}
        />
      </line>

      <mesh position={points.pStart}>
        <cylinderGeometry args={[0.015, 0.015, 0.02, 16]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      <mesh position={points.pEnd}>
        <cylinderGeometry args={[0.015, 0.015, 0.02, 16]} />
        <meshBasicMaterial color={data.objetoSeleccionado ? '#f59e0b' : '#38bdf8'} />
      </mesh>

      <Html position={points.pMid} center pointerEvents="none">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-sky-400/60 shadow-lg text-[11px] font-mono text-sky-200 whitespace-nowrap backdrop-blur-md">
          <Ruler className="w-3 h-3 text-sky-400" />
          <span className="font-bold">{label}</span>
        </div>
      </Html>
    </group>
  );
}

export function CellDistanceHUD() {
  const data = useCellDistance();
  const [colapsado, setColapsado] = useState(false);
  const [mostrarRegla3D, setMostrarRegla3D] = useState(true);

  const pctAlcance = Math.min(100, Math.round((data.distanciaMesaXy / ALCANCE_MAX_IRB140) * 100));
  const colorBarra = pctAlcance > 100 ? 'bg-red-500' : pctAlcance > 85 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="absolute bottom-16 right-4 z-20 w-72 rounded-xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-2xl text-xs overflow-hidden transition-all">
      <div
        onClick={() => setColapsado(!colapsado)}
        className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-white tracking-wide">Métrica Robot ⇄ Mesa</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMostrarRegla3D(!mostrarRegla3D);
              window.dispatchEvent(new CustomEvent('toggle_dist_dimension', { detail: !mostrarRegla3D }));
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
              mostrarRegla3D ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40' : 'text-gray-400 hover:text-white'
            }`}
            title="Activar o desactivar cota visual 3D"
          >
            3D
          </button>
          {colapsado ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {!colapsado && (
        <div className="p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-center font-mono">
            <div className="bg-black/40 p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Centro Mesa (XY)</span>
              <span className="text-base font-bold text-sky-300">{data.distanciaMesaXy} mm</span>
            </div>
            <div className="bg-black/40 p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Borde Próximo</span>
              <span className="text-base font-bold text-emerald-300">{data.distanciaBordeFrontal} mm</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Capacidad de Alcance (Máx {ALCANCE_MAX_IRB140} mm):</span>
              <span className="font-mono text-white">{pctAlcance}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full ${colorBarra} transition-all duration-300`} style={{ width: `${pctAlcance}%` }} />
            </div>
          </div>

          {data.objetoSeleccionado ? (
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-200 truncate">{data.objetoSeleccionado.nombre}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    data.objetoSeleccionado.alcanzable
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {data.objetoSeleccionado.alcanzable ? 'Alcanzable' : 'Fuera de rango'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px] text-gray-300">
                <span>Distancia al robot:</span>
                <span className="font-bold text-amber-300">{data.objetoSeleccionado.distanciaXy} mm</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-gray-400 flex items-center gap-1.5 pt-0.5">
              <Crosshair className="w-3 h-3 text-sky-400 shrink-0" />
              <span>Haz clic en cualquier pieza para medir su distancia exacta al robot.</span>
            </div>
          )}

          <div className="text-[10px] text-gray-400/80 border-t border-white/5 pt-2 flex items-center justify-between font-mono">
            <span>Mover pieza: Flechas o W,A,S,D</span>
            <span>Shift: 50mm | Alt: 2mm</span>
          </div>
        </div>
      )}
    </div>
  );
}
