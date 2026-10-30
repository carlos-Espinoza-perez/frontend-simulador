import React, { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import geometryService, {
  GeometryItem,
  PiezaOpenCV3D,
  ColisionActiva,
} from '../../services/geometryService';
import websocketService from '../../services/websocketService';

interface CellGeometriesProps {
  geomRefs: React.MutableRefObject<Map<string, THREE.Group>>;
  colisiones: ColisionActiva[];
}

const CAD_CACHE = new Map<string, THREE.BufferGeometry>();

function CadMesh({ item, isColliding }: { item: GeometryItem; isColliding: boolean }) {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(() => {
    if (item.stlUrl && CAD_CACHE.has(item.stlUrl)) {
      return CAD_CACHE.get(item.stlUrl)!;
    }
    return null;
  });

  useEffect(() => {
    const loader = new STLLoader();
    if (item.stlBuffer) {
      try {
        const parsed = loader.parse(item.stlBuffer);
        parsed.scale(0.001, 0.001, 0.001);
        parsed.computeVertexNormals();
        setGeo(parsed);
      } catch {
        setGeo(null);
      }
    } else if (item.stlUrl) {
      if (CAD_CACHE.has(item.stlUrl)) {
        setGeo(CAD_CACHE.get(item.stlUrl)!);
        return;
      }
      loader.load(
        item.stlUrl,
        (loaded) => {
          loaded.scale(0.001, 0.001, 0.001);
          loaded.computeVertexNormals();
          CAD_CACHE.set(item.stlUrl!, loaded);
          setGeo(loaded);
        },
        undefined,
        () => setGeo(null)
      );
    }
  }, [item.stlBuffer, item.stlUrl]);

  if (!geo) {
    return (
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color={isColliding ? '#ef4444' : item.color} wireframe />
      </mesh>
    );
  }

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        color={isColliding ? '#ef4444' : item.color}
        emissive={isColliding ? '#b91c1c' : '#000000'}
        emissiveIntensity={isColliding ? 0.7 : 0}
        metalness={0.4}
        roughness={0.5}
        transparent={item.opacidad < 1}
        opacity={item.opacidad}
        wireframe={item.wireframe}
      />
    </mesh>
  );
}

function TableMesh({ item, isColliding }: { item: GeometryItem; isColliding: boolean }) {
  const [w_mm, d_mm, h_mm] = item.dimensiones;
  const w = w_mm / 1000;
  const d = d_mm / 1000;
  const h = h_mm / 1000;
  const topThick = 0.025;
  const legHeight = Math.max(0.05, h - topThick);
  const legRadius = 0.018;

  const legOffsets = [
    [w / 2 - 0.04, d / 2 - 0.04],
    [-w / 2 + 0.04, d / 2 - 0.04],
    [w / 2 - 0.04, -d / 2 + 0.04],
    [-w / 2 + 0.04, -d / 2 + 0.04],
  ];

  return (
    <group>
      <mesh position={[0, h - topThick / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topThick, d]} />
        <meshStandardMaterial
          color={isColliding ? '#ef4444' : item.color}
          emissive={isColliding ? '#b91c1c' : '#000000'}
          emissiveIntensity={isColliding ? 0.7 : 0}
          roughness={0.4}
          metalness={0.3}
          transparent={item.opacidad < 1}
          opacity={item.opacidad}
          wireframe={item.wireframe}
        />
      </mesh>

      <mesh position={[0, h - topThick - 0.015, 0]}>
        <boxGeometry args={[w - 0.02, 0.03, d - 0.02]} />
        <meshStandardMaterial
          color={isColliding ? '#ef4444' : '#64748b'}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {legOffsets.map(([lx, lz], idx) => (
        <mesh
          key={idx}
          position={[lx, legHeight / 2, lz]}
          castShadow
        >
          <cylinderGeometry args={[legRadius, legRadius, legHeight, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export const CellGeometries: React.FC<CellGeometriesProps> = ({
  geomRefs,
  colisiones,
}) => {
  const [geometries, setGeometries] = useState<GeometryItem[]>(() =>
    geometryService.obtenerTodas()
  );
  const [selectedId, setSelectedId] = useState<string | 'robot_base' | null>(() =>
    geometryService.getSeleccionado()
  );
  const [showVisionPieces, setShowVisionPieces] = useState<boolean>(() =>
    geometryService.getMostrarPiezasVision()
  );
  const [visionPieces, setVisionPieces] = useState<PiezaOpenCV3D[]>([]);
  const [alerta, setAlerta] = useState<any>(null);

  useEffect(() => {
    const unsubGeom = geometryService.suscribir(setGeometries);
    const unsubSel = geometryService.suscribirSeleccion(setSelectedId);
    const unsubVision = geometryService.suscribirVision(setShowVisionPieces);

    const unsubSocket = websocketService.on('vision_procesada', (data: any) => {
      if (data && Array.isArray(data.piezas)) {
        setVisionPieces(data.piezas);
        geometryService.setVisionPieces(data.piezas);
      }
    });

    const unsubAlerta = geometryService.suscribirAlerta(setAlerta);

    return () => {
      unsubGeom();
      unsubSel();
      unsubVision();
      unsubSocket();
      unsubAlerta();
    };
  }, []);

  return (
    <group>
      {geometries
        .filter((g) => g.visible)
        .map((item) => {
          const posX = 0.070 + item.posicion[0] / 1000;
          const posY = item.posicion[2] / 1000;
          const posZ = -item.posicion[1] / 1000;

          const rx = (item.rotacion[0] * Math.PI) / 180;
          const ry = (-item.rotacion[2] * Math.PI) / 180;
          const rz = (item.rotacion[1] * Math.PI) / 180;

          const [dimW, dimD, dimH] = item.dimensiones.map((d) => d / 1000);
          const isSelected = selectedId === item.id;
          const isColliding = colisiones.some((c) => c.geomId === item.id) || (Boolean(alerta?.activa && alerta?.obstaculo === item.nombre));

          return (
            <group
              key={item.id}
              ref={(el) => {
                if (el) geomRefs.current.set(item.id, el);
                else geomRefs.current.delete(item.id);
              }}
              position={[posX, posY, posZ]}
              rotation={[rx, ry, rz]}
              onClick={(e) => {
                e.stopPropagation();
                geometryService.seleccionar(item.id);
              }}
            >
              {item.tipo === 'table' && <TableMesh item={item} isColliding={isColliding} />}

              {item.tipo === 'box' && (
                <mesh position={[0, dimH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[dimW, dimH, dimD]} />
                  <meshStandardMaterial
                    color={isColliding ? '#ef4444' : item.color}
                    emissive={isColliding ? '#b91c1c' : '#000000'}
                    emissiveIntensity={isColliding ? 0.7 : 0}
                    transparent={item.opacidad < 1}
                    opacity={item.opacidad}
                    roughness={0.4}
                    metalness={0.3}
                    wireframe={item.wireframe}
                  />
                </mesh>
              )}

              {item.tipo === 'cylinder' && (
                <mesh position={[0, dimD / 2, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[dimW, dimW, dimD, 32]} />
                  <meshStandardMaterial
                    color={isColliding ? '#ef4444' : item.color}
                    emissive={isColliding ? '#b91c1c' : '#000000'}
                    emissiveIntensity={isColliding ? 0.7 : 0}
                    transparent={item.opacidad < 1}
                    opacity={item.opacidad}
                    roughness={0.4}
                    metalness={0.3}
                    wireframe={item.wireframe}
                  />
                </mesh>
              )}

              {item.tipo === 'sphere' && (
                <mesh position={[0, dimW, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[dimW, 32, 32]} />
                  <meshStandardMaterial
                    color={isColliding ? '#ef4444' : item.color}
                    emissive={isColliding ? '#b91c1c' : '#000000'}
                    emissiveIntensity={isColliding ? 0.7 : 0}
                    transparent={item.opacidad < 1}
                    opacity={item.opacidad}
                    roughness={0.3}
                    metalness={0.4}
                    wireframe={item.wireframe}
                  />
                </mesh>
              )}

              {item.tipo === 'cad_stl' && <CadMesh item={item} isColliding={isColliding} />}

              {isSelected && (
                <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.06, 0.075, 32]} />
                  <meshBasicMaterial color="#38bdf8" />
                </mesh>
              )}
            </group>
          );
        })}

      {showVisionPieces &&
        visionPieces.map((p) => {
          const px = 0.070 + p.posicion_mm[0] / 1000;
          const py = 0.65 + 0.015; // Sobre la mesa de altura 650 mm
          const pz = -p.posicion_mm[1] / 1000;

          return (
            <group key={`vision_piece_${p.id}`} position={[px, py, pz]}>
              <mesh position={[0, 0.015, 0]} castShadow>
                <cylinderGeometry args={[0.025, 0.025, 0.03, 24]} />
                <meshStandardMaterial
                  color="#10b981"
                  emissive="#047857"
                  emissiveIntensity={0.4}
                  roughness={0.3}
                  metalness={0.5}
                />
              </mesh>

              <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.028, 0.033, 32]} />
                <meshBasicMaterial color="#34d399" transparent opacity={0.8} />
              </mesh>

              <Html position={[0, 0.05, 0]} center distanceFactor={1.8}>
                <div className="pointer-events-none select-none px-1.5 py-0.5 rounded bg-black/85 border border-emerald-400/60 shadow-lg text-[10px] font-mono text-emerald-300 whitespace-nowrap">
                  #{p.id} [{p.posicion_mm[0]}, {p.posicion_mm[1]}]
                </div>
              </Html>
            </group>
          );
        })}
    </group>
  );
};
export default CellGeometries;
