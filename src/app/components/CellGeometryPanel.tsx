import axios from 'axios';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Cylinder,
  Circle,
  Table2,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  Move,
  RotateCw,
  Bot,
  AlertTriangle,
} from 'lucide-react';
import geometryService, {
  GeometryItem,
  GeometryType,
  RobotBasePose,
  ColisionActiva,
} from '../../services/geometryService';

export const CellGeometryPanel: React.FC = () => {
  const [geometries, setGeometries] = useState<GeometryItem[]>(() =>
    geometryService.obtenerTodas()
  );
  const [selectedId, setSelectedId] = useState<string | 'robot_base' | null>(() =>
    geometryService.getSeleccionado()
  );
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'none'>(() =>
    geometryService.getModo()
  );
  const [basePose, setBasePose] = useState<RobotBasePose>(() =>
    geometryService.obtenerBase()
  );
  const [colisiones, setColisiones] = useState<ColisionActiva[]>([]);
  const [showVisionPieces, setShowVisionPieces] = useState<boolean>(() =>
    geometryService.getMostrarPiezasVision()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseFileInputRef = useRef<HTMLInputElement>(null);
  const [cargandoCAD, setCargandoCAD] = useState(false);

  useEffect(() => {
    const unsubGeom = geometryService.suscribir(setGeometries);
    const unsubSel = geometryService.suscribirSeleccion(setSelectedId);
    const unsubModo = geometryService.suscribirModo(setTransformMode);
    const unsubBase = geometryService.suscribirBase(setBasePose);
    const unsubCol = geometryService.suscribirColisiones(setColisiones);
    const unsubVision = geometryService.suscribirVision(setShowVisionPieces);

    return () => {
      unsubGeom();
      unsubSel();
      unsubModo();
      unsubBase();
      unsubCol();
      unsubVision();
    };
  }, []);

  const selectedItem =
    selectedId === 'robot_base' ? null : geometries.find((g) => g.id === selectedId) || null;

  const handleCrearPrimitiva = (tipo: GeometryType) => {
    const configs: Record<GeometryType, Partial<GeometryItem>> = {
      box: {
        nombre: `Caja ${geometries.length + 1}`,
        tipo: 'box',
        posicion: [450, 0, 0],
        rotacion: [0, 0, 0],
        dimensiones: [150, 150, 150],
        color: '#0284c7',
        opacidad: 0.9,
        visible: true,
      },
      cylinder: {
        nombre: `Cilindro ${geometries.length + 1}`,
        tipo: 'cylinder',
        posicion: [400, -150, 0],
        rotacion: [0, 0, 0],
        dimensiones: [50, 120, 0],
        color: '#10b981',
        opacidad: 0.9,
        visible: true,
      },
      sphere: {
        nombre: `Esfera ${geometries.length + 1}`,
        tipo: 'sphere',
        posicion: [400, 150, 0],
        rotacion: [0, 0, 0],
        dimensiones: [60, 0, 0],
        color: '#f59e0b',
        opacidad: 0.9,
        visible: true,
      },
      table: {
        nombre: `Mesa ${geometries.length + 1}`,
        tipo: 'table',
        posicion: [500, 0, 0],
        rotacion: [0, 0, 0],
        dimensiones: [600, 500, 700],
        color: '#334155',
        opacidad: 1,
        visible: true,
      },
      cad_stl: {
        nombre: 'Modelo CAD',
        tipo: 'cad_stl',
        posicion: [400, 0, 0],
        rotacion: [0, 0, 0],
        dimensiones: [100, 100, 100],
        color: '#94a3b8',
        opacidad: 1,
        visible: true,
      },
    };

    geometryService.agregar(configs[tipo] as any);
  };

  const procesarArchivoCAD = async (file: File, esBase: boolean = false) => {
    let buffer: ArrayBuffer;
    const isSat = file.name.toLowerCase().endsWith('.sat');
    const isBaseName = esBase || file.name.toLowerCase().includes('base');

    setCargandoCAD(true);
    try {
      if (isSat) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post('http://127.0.0.1:5000/api/geometria/convertir_sat', formData, {
          responseType: 'arraybuffer',
        });
        buffer = res.data;
      } else {
        buffer = await file.arrayBuffer();
      }

      const loader = new STLLoader();
      const geo = loader.parse(buffer);
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      let dimW = 150, dimD = 150, dimH = 150;
      if (bb) {
        dimW = Math.round(bb.max.x - bb.min.x);
        dimD = Math.round(bb.max.y - bb.min.y);
        dimH = Math.round(bb.max.z - bb.min.z);
      }

      const rot: [number, number, number] = (isSat && isBaseName) ? [90, 0, 0] : [0, 0, 0];
      const nombreLimpio = file.name.replace(/\.[^/.]+$/, '');

      let colorDetectado = esBase ? '#475569' : '#94a3b8';
      const colorAttr = geo.getAttribute('color');
      if (colorAttr && colorAttr.count > 0) {
        const r = Math.min(255, Math.max(0, Math.round(colorAttr.getX(0) * 255)));
        const g = Math.min(255, Math.max(0, Math.round(colorAttr.getY(0) * 255)));
        const b = Math.min(255, Math.max(0, Math.round(colorAttr.getZ(0) * 255)));
        colorDetectado = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      }

      const nueva = geometryService.agregar({
        nombre: esBase ? `Base Pedestal (${nombreLimpio})` : nombreLimpio,
        tipo: 'cad_stl',
        posicion: esBase ? [0, 0, 0] : [650, 0, 0],
        rotacion: rot,
        dimensiones: [dimW, dimD, dimH],
        color: colorDetectado,
        opacidad: 1,
        visible: true,
        stlBuffer: buffer,
        esBaseRobot: esBase,
      });

      if (esBase) {
        geometryService.setEsBaseRobot(nueva.id, true);
      }
    } catch (err: any) {
      alert(`Error procesando archivo CAD: ${err.message || 'Error desconocido'}`);
    } finally {
      setCargandoCAD(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (baseFileInputRef.current) baseFileInputRef.current.value = '';
    }
  };

  const renderIcon = (tipo: GeometryType) => {
    switch (tipo) {
      case 'box':
        return <Box className="w-3.5 h-3.5 text-sky-400" />;
      case 'cylinder':
        return <Cylinder className="w-3.5 h-3.5 text-emerald-400" />;
      case 'sphere':
        return <Circle className="w-3.5 h-3.5 text-amber-400" />;
      case 'table':
        return <Table2 className="w-3.5 h-3.5 text-slate-300" />;
      case 'cad_stl':
        return <Upload className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-3">
      {colisiones.length > 0 && (
        <div className="p-2.5 rounded-lg bg-red-500/20 border border-red-500/50 flex items-start gap-2 text-red-200 text-xs animate-pulse">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-red-100">
              Colisión detectada ({colisiones.length})
            </div>
            <div className="text-[11px] truncate font-mono">
              {colisiones[0].linkNombre} 💥 {colisiones[0].geomNombre}
            </div>
          </div>
        </div>
      )}

      <div className="bg-black/35 rounded-lg p-2 border border-white/10 flex items-center justify-between">
        <span className="text-[11px] text-gray-400 font-medium">Manipulador 3D:</span>
        <div className="flex gap-1">
          <button
            onClick={() => geometryService.setModo(transformMode === 'translate' ? 'none' : 'translate')}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
              transformMode === 'translate'
                ? 'bg-cyan-500/25 border border-cyan-400/50 text-cyan-200'
                : 'bg-black/30 border border-white/5 text-gray-400 hover:text-white'
            }`}
            title={transformMode === 'translate' ? 'Desactivar Mover (clic para desmarcar)' : 'Arrastrar / Trasladar elemento (W)'}
          >
            <Move className="w-3 h-3" />
            <span>Mover</span>
          </button>
          <button
            onClick={() => geometryService.setModo(transformMode === 'rotate' ? 'none' : 'rotate')}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
              transformMode === 'rotate'
                ? 'bg-cyan-500/25 border border-cyan-400/50 text-cyan-200'
                : 'bg-black/30 border border-white/5 text-gray-400 hover:text-white'
            }`}
            title={transformMode === 'rotate' ? 'Desactivar Rotar (clic para desmarcar)' : 'Rotar elemento (E)'}
          >
            <RotateCw className="w-3 h-3" />
            <span>Rotar</span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
          Primitivas de Celda 3D
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => handleCrearPrimitiva('box')}
            className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <Box className="w-3.5 h-3.5 text-sky-400" />
            <span>Caja</span>
          </button>
          <button
            onClick={() => handleCrearPrimitiva('cylinder')}
            className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <Cylinder className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cilindro</span>
          </button>
          <button
            onClick={() => handleCrearPrimitiva('sphere')}
            className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <Circle className="w-3.5 h-3.5 text-amber-400" />
            <span>Esfera</span>
          </button>
          <button
            onClick={() => handleCrearPrimitiva('table')}
            className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <Table2 className="w-3.5 h-3.5 text-slate-300" />
            <span>Mesa</span>
          </button>
          <label className="col-span-2 flex items-center justify-center gap-1.5 p-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/30 text-xs text-purple-300 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>{cargandoCAD ? 'Procesando CAD...' : 'Importar CAD (.stl, .sat)'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".stl,.sat"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) procesarArchivoCAD(f, false);
              }}
              className="hidden"
              disabled={cargandoCAD}
            />
          </label>
        </div>
      </div>

      <div className="bg-black/35 rounded-lg p-2.5 border border-white/10 flex items-center justify-between">
        <div>
          <div className="text-xs text-white font-medium">Proyección Piezas OpenCV 3D</div>
          <div className="text-[10px] text-gray-400">
            Renderizar piezas detectadas sobre la mesa
          </div>
        </div>
        <button
          onClick={() => geometryService.setMostrarPiezasVision(!showVisionPieces)}
          className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
            showVisionPieces
              ? 'bg-emerald-500/25 border border-emerald-400/40 text-emerald-300'
              : 'bg-white/5 border border-white/10 text-gray-400'
          }`}
        >
          {showVisionPieces ? 'ACTIVO' : 'INACTIVO'}
        </button>
      </div>

      <div
        onClick={() => geometryService.seleccionar('robot_base')}
        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors space-y-2.5 ${
          selectedId === 'robot_base'
            ? 'bg-amber-500/15 border-amber-400/50 text-white'
            : 'bg-black/35 border-white/10 text-gray-300 hover:bg-white/5'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-amber-400" />
            <div>
              <span className="font-semibold text-amber-200 block">Base del Manipulador (Pedestal)</span>
              <span className="text-[10px] text-gray-400 font-mono">
                {geometries.find((g) => g.esBaseRobot)?.nombre ?? 'Sin pedestal asignado'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                geometryService.alinearRobotSobreBase();
              }}
              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-medium"
              title="Alinear robot automáticamente sobre la base activa"
            >
              Auto-acoplar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                geometryService.restablecerBase();
              }}
              className="text-[10px] text-gray-400 hover:text-white p-1"
              title="Restablecer base a (0, 0, 0)"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
          <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-[11px] text-amber-300 cursor-pointer transition-colors font-medium">
            <Upload className="w-3 h-3" />
            <span>{cargandoCAD ? 'Convirtiendo...' : 'Asignar Base CAD (.stl, .sat)'}</span>
            <input
              ref={baseFileInputRef}
              type="file"
              accept=".stl,.sat"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) procesarArchivoCAD(f, true);
              }}
              className="hidden"
              disabled={cargandoCAD}
            />
          </label>
        </div>

        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={axis} className="bg-black/40 p-1 rounded border border-white/5">
              <label className="text-[9px] text-gray-500 uppercase block">{axis} (mm)</label>
              <input
                type="number"
                step="10"
                value={basePose[axis]}
                onChange={(e) =>
                  geometryService.actualizarBase({ [axis]: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-black/60 border border-white/10 rounded px-1 py-0.5 text-xs text-white font-mono"
              />
            </div>
          ))}
          <div className="bg-black/40 p-1 rounded border border-white/5">
            <label className="text-[9px] text-gray-500 uppercase block">Rz (°)</label>
            <input
              type="number"
              step="5"
              value={basePose.rz}
              onChange={(e) =>
                geometryService.actualizarBase({ rz: parseFloat(e.target.value) || 0 })
              }
              className="w-full bg-black/60 border border-white/10 rounded px-1 py-0.5 text-xs text-white font-mono"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
          <span>Elementos en Escena ({geometries.length})</span>
          <button
            onClick={() => geometryService.restablecerPorDefecto()}
            className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
            title="Restablecer configuración predeterminada"
          >
            <RotateCcw className="w-3 h-3" />
            Restablecer
          </button>
        </div>

        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
          {geometries.map((item) => {
            const isSelected = item.id === selectedId;
            const isCol = colisiones.some((c) => c.geomId === item.id);
            return (
              <div
                key={item.id}
                onClick={() => geometryService.seleccionar(item.id)}
                className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  isCol
                    ? 'bg-red-500/20 border-red-500/60 text-red-200'
                    : isSelected
                    ? 'bg-cyan-500/15 border-cyan-400/40 text-white'
                    : 'bg-black/30 border-white/5 text-gray-300 hover:bg-white/5'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: isCol ? '#ef4444' : item.color }}
                />
                <span className="shrink-0">{renderIcon(item.tipo)}</span>
                <span className="flex-1 truncate font-medium">{item.nombre}</span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    geometryService.toggleVisibilidad(item.id);
                  }}
                  className="p-1 text-gray-400 hover:text-white"
                  title={item.visible ? 'Ocultar' : 'Mostrar'}
                >
                  {item.visible ? (
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    geometryService.eliminar(item.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-400"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {selectedItem && (
        <div className="bg-black/40 rounded-lg p-2.5 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <input
              type="text"
              value={selectedItem.nombre}
              onChange={(e) =>
                geometryService.actualizar(selectedItem.id, { nombre: e.target.value })
              }
              className="bg-black/50 border border-white/10 rounded px-2 py-0.5 text-xs text-white font-medium focus:border-cyan-400 outline-none flex-1 mr-2"
            />
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
              {selectedItem.tipo}
            </span>
          </div>

          <div>
            <div className="text-[10px] text-gray-400 font-semibold mb-1">
              Posición mundo celda (mm) - [Arrastrable en 3D]
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <div key={axis} className="bg-black/40 p-1.5 rounded border border-white/5">
                  <label className="text-[9px] text-gray-500 block mb-0.5">{axis}</label>
                  <input
                    type="number"
                    step="10"
                    value={selectedItem.posicion[i]}
                    onChange={(e) => {
                      const pos = [...selectedItem.posicion] as [number, number, number];
                      pos[i] = parseFloat(e.target.value) || 0;
                      geometryService.actualizar(selectedItem.id, { posicion: pos });
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded px-1 py-0.5 text-xs text-white font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-gray-400 font-semibold mb-1">
              {selectedItem.tipo === 'cylinder'
                ? 'Radio y Altura (mm)'
                : selectedItem.tipo === 'sphere'
                ? 'Radio (mm)'
                : 'Dimensiones Ancho × Fondo × Alto (mm)'}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {selectedItem.tipo === 'cylinder' ? (
                <>
                  <div className="bg-black/40 p-1.5 rounded border border-white/5">
                    <label className="text-[9px] text-gray-500 block mb-0.5">Radio</label>
                    <input
                      type="number"
                      step="5"
                      value={selectedItem.dimensiones[0]}
                      onChange={(e) => {
                        const dim = [...selectedItem.dimensiones] as [number, number, number];
                        dim[0] = Math.max(1, parseFloat(e.target.value) || 1);
                        geometryService.actualizar(selectedItem.id, { dimensiones: dim });
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded px-1 py-0.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div className="bg-black/40 p-1.5 rounded border border-white/5">
                    <label className="text-[9px] text-gray-500 block mb-0.5">Altura</label>
                    <input
                      type="number"
                      step="10"
                      value={selectedItem.dimensiones[1]}
                      onChange={(e) => {
                        const dim = [...selectedItem.dimensiones] as [number, number, number];
                        dim[1] = Math.max(1, parseFloat(e.target.value) || 1);
                        geometryService.actualizar(selectedItem.id, { dimensiones: dim });
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded px-1 py-0.5 text-xs text-white font-mono"
                    />
                  </div>
                </>
              ) : selectedItem.tipo === 'sphere' ? (
                <div className="bg-black/40 p-1.5 rounded border border-white/5">
                  <label className="text-[9px] text-gray-500 block mb-0.5">Radio</label>
                  <input
                    type="number"
                    step="5"
                    value={selectedItem.dimensiones[0]}
                    onChange={(e) => {
                      const dim = [...selectedItem.dimensiones] as [number, number, number];
                      dim[0] = Math.max(1, parseFloat(e.target.value) || 1);
                      geometryService.actualizar(selectedItem.id, { dimensiones: dim });
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded px-1 py-0.5 text-xs text-white font-mono"
                  />
                </div>
              ) : (
                (['Ancho', 'Fondo', 'Alto'] as const).map((label, i) => (
                  <div key={label} className="bg-black/40 p-1.5 rounded border border-white/5">
                    <label className="text-[9px] text-gray-500 block mb-0.5">{label}</label>
                    <input
                      type="number"
                      step="10"
                      value={selectedItem.dimensiones[i]}
                      onChange={(e) => {
                        const dim = [...selectedItem.dimensiones] as [number, number, number];
                        dim[i] = Math.max(1, parseFloat(e.target.value) || 1);
                        geometryService.actualizar(selectedItem.id, { dimensiones: dim });
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded px-1 py-0.5 text-xs text-white font-mono"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-gray-400 font-semibold mb-1">Rotación (grados)</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Rx', 'Ry', 'Rz'] as const).map((axis, i) => (
                <div key={axis} className="bg-black/40 p-1.5 rounded border border-white/5">
                  <label className="text-[9px] text-gray-500 block mb-0.5">{axis}°</label>
                  <input
                    type="number"
                    step="5"
                    value={selectedItem.rotacion[i]}
                    onChange={(e) => {
                      const rot = [...selectedItem.rotacion] as [number, number, number];
                      rot[i] = parseFloat(e.target.value) || 0;
                      geometryService.actualizar(selectedItem.id, { rotacion: rot });
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded px-1 py-0.5 text-xs text-white font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-gray-400">Color:</label>
              <input
                type="color"
                value={selectedItem.color}
                onChange={(e) =>
                  geometryService.actualizar(selectedItem.id, { color: e.target.value })
                }
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
              />
            </div>

            <div className="flex-1 flex items-center gap-1.5">
              <label className="text-[10px] text-gray-400">Opacidad:</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={selectedItem.opacidad}
                onChange={(e) =>
                  geometryService.actualizar(selectedItem.id, {
                    opacidad: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1 bg-black/50 rounded appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedItem.wireframe || false}
                onChange={(e) =>
                  geometryService.actualizar(selectedItem.id, { wireframe: e.target.checked })
                }
                className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
              />
              <span>Malla</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
export default CellGeometryPanel;
