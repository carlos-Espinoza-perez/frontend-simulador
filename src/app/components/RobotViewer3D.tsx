import { useRef, useEffect, useState, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line, TransformControls, Html } from '@react-three/drei';
import { Maximize2, Minimize2, RotateCcw, Keyboard, Move, RotateCw, AlertTriangle, X, Ruler, Box, Trash2 } from 'lucide-react';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import api from '../../services/api';
import { CellGeometries } from './CellGeometries';
import geometryService, { RobotBasePose, ColisionActiva } from '../../services/geometryService';

interface STLModelProps {
  url: string;
  color?: string;
  scale?: number;
  position?: THREE.Vector3;
  isColliding?: boolean;
}

function STLModel({ url, color = '#E8E8E8', scale = 1, position, isColliding }: STLModelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const loader = new STLLoader();

    loader.load(
      url,
      (geo: THREE.BufferGeometry) => {
        geo.scale(scale, scale, scale);
        setGeometry(geo);
        setError(false);
      },
      undefined,
      (err: unknown) => {
        console.error('[STL] Error cargando:', url, err);
        setError(true);
      }
    );
  }, [url, scale]);

  if (error) {
    return (
      <mesh>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="red" opacity={0.5} transparent />
      </mesh>
    );
  }

  if (!geometry) return null;

  const hasColors = Boolean((geometry as any)?.hasColors || geometry?.getAttribute('color'));

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      castShadow
      receiveShadow
      position={position}
    >
      <meshStandardMaterial
        vertexColors={hasColors && !isColliding}
        color={isColliding ? '#ef4444' : (hasColors ? '#ffffff' : color)}
        emissive={isColliding ? '#b91c1c' : '#000000'}
        emissiveIntensity={isColliding ? 0.7 : 0}
        metalness={0.7}
        roughness={0.3}
        envMapIntensity={1}
      />
    </mesh>
  );
}

function TrajectoryLine({
  showTrajectory,
  trajectoryPointsRef
}: {
  showTrajectory: boolean | undefined;
  trajectoryPointsRef: React.MutableRefObject<THREE.Vector3[]>
}) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);

  useFrame(() => {
    if (!showTrajectory) return;
    const currentLen = trajectoryPointsRef.current.length;

    if (currentLen > 1 && currentLen !== points.length) {
      setPoints([...trajectoryPointsRef.current]);
    }
  });

  useEffect(() => {
    if (!showTrajectory) setPoints([]);
  }, [showTrajectory]);

  if (!showTrajectory || points.length < 2) return null;

  return (
    <Line
      points={points}
      color="#33ff00"
      lineWidth={2}
      transparent
      opacity={0.6}
      frustumCulled={false}
    />
  );
}

export interface RobotViewerProps {
  jointAngles: number[];
  robotInfo?: {
    archivos_stl: string[];
    ruta_stl: string;
    eslabones?: Array<{
      id: number;
      nombre: string;
      archivo_stl: string;
      color: string;
      posicion_local?: [number, number, number];
    }>;
    visualizacion?: {
      escala?: number;
      posicion_inicial?: number[];
      rotacion_inicial?: number[];
      pivots?: number[][];
      axes?: number[][];
      camara?: {
        posicion?: [number, number, number];
        fov?: number;
        min_distancia?: number;
        max_distancia?: number;
      };
    };
    workspace?: {
      grid?: {
        tamaño?: number;
        division?: number;
      };
    };
    nombre?: string;
    tipos_articulaciones?: string[];
  } | null;
  showTrajectory?: boolean;
  onTrajectoryToggle?: (show: boolean) => void;
  onClearTrajectory?: () => void;
  clearTrajectoryTrigger?: number;
  showWorkspace?: boolean;
  onWorkspaceToggle?: () => void;
  showPivots?: boolean;
  onPivotsToggle?: (show: boolean) => void;
  resetCameraTrigger?: number;
  onResetCamera?: () => void;
  isViewerExpanded?: boolean;
  onToggleViewerExpanded?: () => void;
  customPivots?: number[][];
  customPositions?: number[][];
  customTcpOffset?: [number, number, number];
}

const DX = 0.247;
const DY = 0.203;

const PIVOTS_HOME = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(DX + 0.065, DY, 0),         // J1
  new THREE.Vector3(DX + 0.140, DY, 0.352),     // J2
  new THREE.Vector3(DX + 0.140, DY, 0.712),     // J3
  new THREE.Vector3(DX + 0.070, DY, 0.712),     // J4
  new THREE.Vector3(DX + 0.520, DY, 0.712),     // J5
  new THREE.Vector3(DX + 0.515, DY, 0.712)      // J6
];

const AXES_HOME = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(1, 0, 0)
];

interface RobotExtendedProps extends RobotViewerProps {
  basePose: RobotBasePose;
  selectedId: string | 'robot_base' | null;
  transformMode: 'translate' | 'rotate';
  collidingLinks: Set<number>;
  linkRefs?: React.MutableRefObject<(THREE.Group | null)[]>;
  robotBaseRef?: React.MutableRefObject<THREE.Group | null>;
  onContextMenu?: (e: any, id: string | 'robot_base') => void;
  onPointClick?: (point: THREE.Vector3, name: string, object?: THREE.Object3D) => void;
  onSnapHover?: (point: THREE.Vector3, object: THREE.Object3D, name: string) => void;
  onSurfaceClick?: (point: THREE.Vector3, name: string, object?: THREE.Object3D) => void;
  measuringActive?: boolean;
}

function Robot({
  jointAngles,
  robotInfo,
  showTrajectory,
  customPivots,
  customPositions,
  customTcpOffset,
  basePose,
  selectedId,
  collidingLinks,
  linkRefs,
  robotBaseRef,
  onContextMenu,
  onPointClick,
  onSnapHover,
  onSurfaceClick,
  measuringActive,
}: RobotExtendedProps) {
  const localBaseRef = useRef<THREE.Group>(null);
  const isBaseSelected = selectedId === 'robot_base';
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const trajectoryPoints = useRef<THREE.Vector3[]>([]);
  const lastTcpPosition = useRef<THREE.Vector3 | null>(null);

  const scale = robotInfo?.visualizacion?.escala || 0.001;
  const robotFolder = robotInfo?.ruta_stl.split('/').pop();

  const initPos = robotInfo?.visualizacion?.posicion_inicial
    ? [...robotInfo.visualizacion.posicion_inicial] as [number, number, number]
    : [-0.2439, 0, 0.200] as [number, number, number];

  const initRotDeg = robotInfo?.visualizacion?.rotacion_inicial || [-90, 0, 0];
  const initRot = initRotDeg.map(d => (d * Math.PI) / 180) as [number, number, number];

  const eslabones = robotInfo?.eslabones || robotInfo?.archivos_stl?.map((filename, index) => ({
    id: index,
    nombre: `Link ${index}`,
    archivo_stl: filename,
    color: index === 0 ? '#E8E8E8' : '#E8E8E8',
    posicion_local: [0, 0, 0] as [number, number, number]
  })) || [];

  useEffect(() => {
    if (!showTrajectory && trajectoryPoints.current.length > 0) {
      trajectoryPoints.current = [];
      lastTcpPosition.current = null;
    }
  }, [showTrajectory]);

  useFrame(() => {
    if (!robotInfo || !jointAngles || jointAngles.length < 1) return;

    if (jointAngles.some(ang => ang === null || ang === undefined || isNaN(ang))) return;

    const q_rad = jointAngles.map(deg => (deg * Math.PI) / 180);

    let activePivots = customPivots ? customPivots.map(p => new THREE.Vector3(p[0], p[1], p[2])) : null;
    if (!activePivots) {
      activePivots = robotInfo?.visualizacion?.pivots
        ? robotInfo.visualizacion.pivots.map(p => new THREE.Vector3(p[0], p[1], p[2]))
        : PIVOTS_HOME;
    }

    const activeAxes = robotInfo?.visualizacion?.axes
      ? robotInfo.visualizacion.axes.map(a => new THREE.Vector3(a[0], a[1], a[2]))
      : AXES_HOME;

    const pivots = activePivots.map(p => p.clone());
    const axes = activeAxes.map(a => a.clone());

    groupRefs.current.forEach((ref) => {
      if (ref) {
        ref.position.set(0, 0, 0);
        ref.rotation.set(0, 0, 0);
        ref.quaternion.identity();
      }
    });

    const numJoints = jointAngles.length;
    const numLinks = eslabones.length;

    for (let j = 1; j <= numJoints; j++) {
      let isPrismatic = (robotInfo as any)?.tipos_articulaciones?.[j - 1] === 'P';
      let val = isPrismatic ? jointAngles[j - 1] * 0.001 : q_rad[j - 1]; // Convertir a metros si es prismático
      if (Math.abs(val) < 1e-5) continue;

      const origin = pivots[j] || pivots[pivots.length - 1];
      const axis = axes[j] || axes[axes.length - 1];

      for (let link_idx = j; link_idx < numLinks; link_idx++) {
        const ref = groupRefs.current[link_idx];
        if (!ref) continue;

        if (isPrismatic) {
          ref.position.add(axis.clone().multiplyScalar(val));
        } else {
          const tempPos = ref.position.clone().sub(origin);
          tempPos.applyAxisAngle(axis, val);
          ref.position.copy(origin).add(tempPos);
          ref.rotateOnWorldAxis(axis, val);
        }
      }

      for (let p_idx = j + 1; p_idx < pivots.length; p_idx++) {
        if (isPrismatic) {
          pivots[p_idx].add(axis.clone().multiplyScalar(val));
        } else {
          const offset = pivots[p_idx].clone().sub(origin);
          const newOffset = offset.applyAxisAngle(axis, val);
          pivots[p_idx].copy(origin).add(newOffset);
          if (p_idx < axes.length) {
            axes[p_idx].applyAxisAngle(axis, val);
          }
        }
      }
    }

    const lastPivot = pivots[pivots.length - 1] || new THREE.Vector3();
    const lastAxis = axes[axes.length - 1] || new THREE.Vector3(1, 0, 0);
    
    let tcpOffset = 0;
    if (robotInfo?.nombre === 'ABB IRB 140') {
      tcpOffset = 0.065;
    }

    const tcpPosition = lastPivot.clone().add(lastAxis.clone().multiplyScalar(tcpOffset));

    if (customTcpOffset) {
      tcpPosition.add(new THREE.Vector3(customTcpOffset[0], customTcpOffset[1], customTcpOffset[2]));
    }

    if (showTrajectory) {
      if (!lastTcpPosition.current || tcpPosition.distanceTo(lastTcpPosition.current) > 0.001) {

        if (!isNaN(tcpPosition.x) && !isNaN(tcpPosition.y) && !isNaN(tcpPosition.z)) {
          trajectoryPoints.current.push(tcpPosition.clone());
          lastTcpPosition.current = tcpPosition.clone();

          if (trajectoryPoints.current.length > 5000) {
            trajectoryPoints.current.shift();
          }
        }
      }
    }
  });

  return (
    <group rotation={initRot} position={initPos}>
      <group
        ref={(el) => {
          localBaseRef.current = el;
          if (robotBaseRef) robotBaseRef.current = el;
        }}
        position={[basePose.x / 1000, basePose.y / 1000, basePose.z / 1000]}
        rotation={[0, 0, (basePose.rz * Math.PI) / 180]}
        onClick={(e) => {
          e.stopPropagation();
          if (measuringActive && onPointClick) {
            onPointClick(e.point, 'Base Robot');
            return;
          }
          geometryService.seleccionar('robot_base');
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          if (e.nativeEvent) e.nativeEvent.preventDefault();
          if (onContextMenu) onContextMenu(e, 'robot_base');
        }}
      >
        {isBaseSelected && (
          <mesh position={[DX + 0.07, DY, 0.002]}>
            <ringGeometry args={[0.16, 0.18, 32]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} />
          </mesh>
        )}

        {eslabones.map((eslabon, index) => {
          const localPosArray = customPositions?.[index] || eslabon.posicion_local || [0, 0, 0];
          const localPos = new THREE.Vector3(localPosArray[0], localPosArray[1], localPosArray[2]);
          return (
            <group
              key={eslabon.id}
              ref={(el: THREE.Group | null) => {
                groupRefs.current[index] = el;
                if (linkRefs) linkRefs.current[index] = el;
              }}
              onClick={(e) => {
                if (geometryService.recienArrastrado()) return;
                if (measuringActive && onPointClick) {
                  e.stopPropagation();
                  onPointClick(e.point, eslabon.nombre, e.object);
                  return;
                }
                const currentModo = geometryService.getModo();
                const currentSel = geometryService.getSeleccionado();
                if (currentModo === 'translate' && currentSel && currentSel !== 'robot_base' && onSurfaceClick) {
                  e.stopPropagation();
                  onSurfaceClick(e.point, eslabon.nombre, e.object);
                  return;
                }
              }}
              onPointerMove={(e) => {
                const currentModo = geometryService.getModo();
                const currentSel = geometryService.getSeleccionado();
                const isMoving = currentModo === 'translate' && currentSel && currentSel !== 'robot_base';
                if ((measuringActive || isMoving) && onSnapHover) {
                  e.stopPropagation();
                  onSnapHover(e.point, e.object, eslabon.nombre);
                }
              }}
              onContextMenu={(e) => {
                e.stopPropagation();
                if (e.nativeEvent) e.nativeEvent.preventDefault();
                if (onContextMenu) onContextMenu(e, 'robot_base');
              }}
            >
              <STLModel
                url={`/models/${robotFolder}/${eslabon.archivo_stl}`}
                color={eslabon.color}
                scale={scale}
                position={localPos}
                isColliding={collidingLinks.has(index)}
              />
            </group>
          );
        })}

        <TrajectoryLine
          showTrajectory={showTrajectory}
          trajectoryPointsRef={trajectoryPoints}
        />
      </group>
    </group>
  );
}

function WorkspaceCloud({ points, initPos, initRot, isIRB140, basePose }: { points: number[][], initPos: [number, number, number], initRot: [number, number, number], isIRB140: boolean, basePose?: RobotBasePose }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (points.length > 0) {
      const vertices = new Float32Array(points.length * 3);
      for (let i = 0; i < points.length; i++) {
        vertices[i * 3] = (points[i][0] / 1000) + (isIRB140 ? DX + 0.070 : 0);
        vertices[i * 3 + 1] = (points[i][1] / 1000) + (isIRB140 ? DY : 0);
        vertices[i * 3 + 2] = points[i][2] / 1000;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.computeBoundingSphere();
    }
    return geo;
  }, [points, isIRB140]);

  return (
    <group rotation={initRot} position={initPos}>
      <points
        position={basePose ? [basePose.x / 1000, basePose.y / 1000, basePose.z / 1000] : [0, 0, 0]}
        rotation={basePose ? [0, 0, (basePose.rz * Math.PI) / 180] : [0, 0, 0]}
        geometry={geometry}
      >
      <pointsMaterial
        size={0.008}
        color="#00ffff"
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
    </group>
  );
}

const DEFAULT_CAMERA_POS: [number, number, number] = [1.3, 1.0, 1.3];
const DEFAULT_ORBIT_TARGET: [number, number, number] = [DX, 0.42, DY];

function CameraResetEffect({
  resetCameraTrigger,
  cameraPosition,
  controlsRef,
}: {
  resetCameraTrigger?: number;
  cameraPosition: [number, number, number];
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
    if (controlsRef.current) {
      controlsRef.current.target.set(
        DEFAULT_ORBIT_TARGET[0],
        DEFAULT_ORBIT_TARGET[1],
        DEFAULT_ORBIT_TARGET[2]
      );
      controlsRef.current.update();
    }
  }, [resetCameraTrigger, cameraPosition[0], cameraPosition[1], cameraPosition[2], DEFAULT_ORBIT_TARGET[1]]);

  return null;
}

function GizmoManager({
  controlsRef,
}: {
  controlsRef: React.MutableRefObject<any>;
}) {
  const transformRef = useRef<any>(null);
  const proxyRef = useRef<THREE.Group>(null);
  const [selectedId, setSelectedId] = useState<string | 'robot_base' | null>(() =>
    geometryService.getSeleccionado()
  );
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'none'>(() =>
    geometryService.getModo()
  );
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{
    id: string | 'robot_base';
    posicion?: [number, number, number];
    rotacion?: [number, number, number];
    basePose?: RobotBasePose;
  } | null>(null);

  useEffect(() => {
    const unsubSel = geometryService.suscribirSeleccion(setSelectedId);
    const unsubModo = geometryService.suscribirModo(setTransformMode);
    return () => {
      unsubSel();
      unsubModo();
    };
  }, []);

  const syncProxy = () => {
    if (isDraggingRef.current || !proxyRef.current) return;
    const curSel = geometryService.getSeleccionado();
    if (!curSel) {
      if (transformRef.current) transformRef.current.detach();
      return;
    }

    if (curSel === 'robot_base') {
      const base = geometryService.obtenerBase();
      proxyRef.current.position.set(
        0.070 + base.x / 1000,
        base.z / 1000,
        -base.y / 1000
      );
      proxyRef.current.rotation.set(0, (-base.rz * Math.PI) / 180, 0);
    } else {
      const all = geometryService.obtenerTodas();
      const item = all.find((g) => g.id === curSel);
      if (item) {
        proxyRef.current.position.set(
          0.070 + item.posicion[0] / 1000,
          item.posicion[2] / 1000,
          -item.posicion[1] / 1000
        );
        proxyRef.current.rotation.set(
          (item.rotacion[0] * Math.PI) / 180,
          (-item.rotacion[2] * Math.PI) / 180,
          (item.rotacion[1] * Math.PI) / 180
        );
      }
    }

    proxyRef.current.updateMatrixWorld(true);
    if (transformRef.current) {
      transformRef.current.attach(proxyRef.current);
    }
  };

  useEffect(() => {
    syncProxy();
    const unsubG = geometryService.suscribir(syncProxy);
    const unsubB = geometryService.suscribirBase(syncProxy);
    return () => {
      unsubG();
      unsubB();
    };
  }, [selectedId, transformMode]);

  useEffect(() => {
    const tc = transformRef.current;
    if (!tc) return;

    const onDragChange = (e: any) => {
      isDraggingRef.current = e.value;
      if (controlsRef.current) {
        controlsRef.current.enabled = !e.value;
      }
      geometryService.setDragging(e.value);

      const curSel = geometryService.getSeleccionado();
      if (e.value === true) {
        if (curSel === 'robot_base') {
          dragStartRef.current = {
            id: 'robot_base',
            basePose: geometryService.obtenerBase(),
          };
        } else if (curSel) {
          const item = geometryService.obtenerTodas().find((g) => g.id === curSel);
          if (item) {
            dragStartRef.current = {
              id: item.id,
              posicion: [...item.posicion],
              rotacion: [...item.rotacion],
            };
          }
        }
      } else {
        if (dragStartRef.current) {
          if (curSel === 'robot_base' && dragStartRef.current.basePose) {
            const finalBase = geometryService.obtenerBase();
            const initBase = dragStartRef.current.basePose;
            if (
              initBase.x !== finalBase.x ||
              initBase.y !== finalBase.y ||
              initBase.z !== finalBase.z ||
              initBase.rz !== finalBase.rz
            ) {
              geometryService.registrarAccion({
                id: 'robot_base',
                baseAnterior: initBase,
                baseNueva: finalBase,
              });
            }
          } else if (curSel && dragStartRef.current.posicion && dragStartRef.current.rotacion) {
            const item = geometryService.obtenerTodas().find((g) => g.id === curSel);
            if (item) {
              const initPos = dragStartRef.current.posicion;
              const initRot = dragStartRef.current.rotacion;
              if (
                initPos[0] !== item.posicion[0] ||
                initPos[1] !== item.posicion[1] ||
                initPos[2] !== item.posicion[2] ||
                initRot[0] !== item.rotacion[0] ||
                initRot[1] !== item.rotacion[1] ||
                initRot[2] !== item.rotacion[2]
              ) {
                geometryService.registrarAccion({
                  id: item.id,
                  posicionAnterior: initPos,
                  rotacionAnterior: initRot,
                  posicionNueva: [...item.posicion],
                  rotacionNueva: [...item.rotacion],
                });
              }
            }
          }
          dragStartRef.current = null;
        }
      }
    };

    const onObjectChange = () => {
      if (!proxyRef.current) return;
      const curSel = geometryService.getSeleccionado();
      if (!curSel) return;

      const p = proxyRef.current.position;
      const r = proxyRef.current.rotation;

      const posX = Math.round((p.x - 0.070) * 1000);
      const posY = Math.round(-p.z * 1000);
      const posZ = Math.round(p.y * 1000);
      const rotZ = Math.round((-r.y * 180) / Math.PI);

      if (curSel === 'robot_base') {
        geometryService.actualizarBase({
          x: posX,
          y: posY,
          z: posZ,
          rz: rotZ,
        });
      } else {
        geometryService.actualizar(curSel, {
          posicion: [posX, posY, posZ],
          rotacion: [
            Math.round((r.x * 180) / Math.PI),
            Math.round((r.z * 180) / Math.PI),
            rotZ,
          ],
        });
      }
    };

    tc.addEventListener('dragging-changed', onDragChange);
    tc.addEventListener('objectChange', onObjectChange);

    return () => {
      tc.removeEventListener('dragging-changed', onDragChange);
      tc.removeEventListener('objectChange', onObjectChange);
    };
  }, [controlsRef, selectedId, transformMode]);

  useEffect(() => {
    const onWindowPointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        geometryService.setDragging(false);
      }
      if (controlsRef.current && !controlsRef.current.enabled) {
        controlsRef.current.enabled = true;
      }
    };
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('mouseup', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('mouseup', onWindowPointerUp);
    };
  }, [controlsRef]);

  const isEnabled = transformMode !== 'none' && !!selectedId;

  return (
    <>
      <group ref={proxyRef} />
      <TransformControls
        ref={transformRef}
        object={proxyRef}
        mode={transformMode === 'rotate' ? 'rotate' : 'translate'}
        size={0.7}
        enabled={isEnabled}
        visible={isEnabled}
      />
    </>
  );
}

function computeSnapPoint(
  hitPoint: THREE.Vector3,
  object?: THREE.Object3D | null,
  name?: string
): { point: THREE.Vector3; label: string } {
  if (!object || name === 'Plano de Celda' || Math.abs(hitPoint.y) < 0.005) {
    const step = 0.05;
    const sx = 0.070 + Math.round((hitPoint.x - 0.070) / step) * step;
    const sz = Math.round(hitPoint.z / step) * step;
    return {
      point: new THREE.Vector3(sx, 0, sz),
      label: 'Rejilla (50mm)',
    };
  }

  let bbox: THREE.Box3 | null = null;
  let targetObj: THREE.Object3D = object;

  if ((object as THREE.Mesh).isMesh && (object as THREE.Mesh).geometry) {
    const geo = (object as THREE.Mesh).geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    bbox = geo.boundingBox;
  } else {
    object.traverse((child) => {
      if (!bbox && (child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        const geo = (child as THREE.Mesh).geometry;
        if (!geo.boundingBox) geo.computeBoundingBox();
        bbox = geo.boundingBox;
        targetObj = child;
      }
    });
    if (!bbox) {
      bbox = new THREE.Box3().setFromObject(object);
      targetObj = object;
    }
  }

  if (!bbox) {
    return { point: hitPoint.clone(), label: name || 'Punto' };
  }

  const { min, max } = bbox;
  const dx = max.x - min.x;
  const dy = max.y - min.y;
  const dz = max.z - min.z;
  const midX = (min.x + max.x) / 2;
  const midY = (min.y + max.y) / 2;
  const midZ = (min.z + max.z) / 2;

  const candidates: { local: THREE.Vector3; label: string }[] = [];

  for (const cx of [min.x, max.x]) {
    for (const cy of [min.y, max.y]) {
      for (const cz of [min.z, max.z]) {
        candidates.push({ local: new THREE.Vector3(cx, cy, cz), label: 'Esquina' });
      }
    }
  }

  candidates.push({ local: new THREE.Vector3(midX, midY, midZ), label: 'Centro' });
  candidates.push({ local: new THREE.Vector3(midX, max.y, midZ), label: 'Centro Superior' });
  candidates.push({ local: new THREE.Vector3(midX, min.y, midZ), label: 'Centro Inferior' });
  candidates.push({ local: new THREE.Vector3(max.x, midY, midZ), label: 'Centro Lateral' });
  candidates.push({ local: new THREE.Vector3(min.x, midY, midZ), label: 'Centro Lateral' });
  candidates.push({ local: new THREE.Vector3(midX, midY, max.z), label: 'Centro Frontal' });
  candidates.push({ local: new THREE.Vector3(midX, midY, min.z), label: 'Centro Posterior' });

  const fractions = [
    { t: 1 / 3, l: 'Lateral 1/3' },
    { t: 1 / 2, l: 'Punto Medio' },
    { t: 2 / 3, l: 'Lateral 2/3' },
  ];

  for (const cy of [min.y, max.y]) {
    for (const cz of [min.z, max.z]) {
      for (const f of fractions) {
        candidates.push({ local: new THREE.Vector3(min.x + f.t * dx, cy, cz), label: f.l });
      }
    }
  }

  for (const cx of [min.x, max.x]) {
    for (const cy of [min.y, max.y]) {
      for (const f of fractions) {
        candidates.push({ local: new THREE.Vector3(cx, cy, min.z + f.t * dz), label: f.l });
      }
    }
  }

  for (const cx of [min.x, max.x]) {
    for (const cz of [min.z, max.z]) {
      for (const f of fractions) {
        candidates.push({ local: new THREE.Vector3(cx, min.y + f.t * dy, cz), label: f.l });
      }
    }
  }

  for (const fx of [1 / 3, 1 / 2, 2 / 3]) {
    for (const fz of [1 / 3, 1 / 2, 2 / 3]) {
      candidates.push({
        local: new THREE.Vector3(min.x + fx * dx, max.y, min.z + fz * dz),
        label: fx === 0.5 && fz === 0.5 ? 'Centro Superior' : 'Superficie 1/3',
      });
    }
  }

  let bestPt = hitPoint.clone();
  let bestDist = Infinity;
  let bestLabel = 'Punto';

  const matrix = targetObj.matrixWorld;
  for (const c of candidates) {
    const worldPt = c.local.clone().applyMatrix4(matrix);
    const dist = worldPt.distanceTo(hitPoint);
    if (dist < bestDist) {
      bestDist = dist;
      bestPt = worldPt;
      bestLabel = c.label;
    }
  }

  return { point: bestPt, label: bestLabel };
}

function MeasurementVisualizer({
  measureState,
  snapPreview,
}: {
  measureState?: {
    active: boolean;
    pointA: [number, number, number] | null;
    pointB: [number, number, number] | null;
    labelA?: string;
    labelB?: string;
  };
  snapPreview?: { point: THREE.Vector3; label: string } | null;
}) {
  if (!measureState?.active && !snapPreview) return null;

  const pA = measureState.pointA
    ? new THREE.Vector3(
        0.070 + measureState.pointA[0] / 1000,
        measureState.pointA[2] / 1000,
        -measureState.pointA[1] / 1000
      )
    : null;

  const pB = measureState.pointB
    ? new THREE.Vector3(
        0.070 + measureState.pointB[0] / 1000,
        measureState.pointB[2] / 1000,
        -measureState.pointB[1] / 1000
      )
    : null;

  const dx = measureState.pointA && measureState.pointB ? measureState.pointB[0] - measureState.pointA[0] : 0;
  const dy = measureState.pointA && measureState.pointB ? measureState.pointB[1] - measureState.pointA[1] : 0;
  const dz = measureState.pointA && measureState.pointB ? measureState.pointB[2] - measureState.pointA[2] : 0;
  const d3D = Math.hypot(dx, dy, dz);

  const pMid = pA && pB
    ? new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.04, 0))
    : null;

  const lineGeo = useMemo(() => {
    if (!pA || !pB) return null;
    return new THREE.BufferGeometry().setFromPoints([pA, pB]);
  }, [pA?.x, pA?.y, pA?.z, pB?.x, pB?.y, pB?.z]);

  return (
    <group>
      {pA && (
        <mesh position={pA}>
          <sphereGeometry args={[0.015, 16, 16]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.6} />
        </mesh>
      )}

      {pB && (
        <mesh position={pB}>
          <sphereGeometry args={[0.015, 16, 16]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
        </mesh>
      )}

      {lineGeo && pMid && (
        <>
          <line geometry={lineGeo}>
            <lineBasicMaterial color="#38bdf8" linewidth={2} />
          </line>
          <Html position={pMid} center pointerEvents="none">
            <div className="flex flex-col items-center px-2.5 py-1.5 rounded-xl bg-slate-950/95 border border-sky-400/60 shadow-2xl backdrop-blur-md text-[11px] font-mono text-white whitespace-nowrap">
              <div className="flex items-center gap-1.5 font-bold text-sky-300">
                <Ruler className="w-3.5 h-3.5 text-sky-400" />
                <span>{Math.round(d3D)} mm</span>
              </div>
              <div className="text-[9px] text-gray-400 flex gap-2 mt-0.5">
                <span>ΔX: {Math.round(dx)}</span>
                <span>ΔY: {Math.round(dy)}</span>
                <span>ΔZ: {Math.round(dz)}</span>
              </div>
            </div>
          </Html>
        </>
      )}

      {snapPreview && !pB && (
        <group position={snapPreview.point}>
          <mesh>
            <octahedronGeometry args={[0.012, 0]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#38bdf8"
              emissiveIntensity={0.8}
              wireframe
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.016, 0.022, 24]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
          </mesh>
          <Html position={[0, 0.03, 0]} center pointerEvents="none">
            <div className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-sky-400/70 shadow-lg text-[9px] font-mono text-sky-300 whitespace-nowrap">
              ✦ {snapPreview.label}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

function PieceContextMenu({
  state,
  onClose,
  onSetModo,
  transformMode,
  onStartMeasure,
  onEliminar,
}: {
  state: {
    visible: boolean;
    x: number;
    y: number;
    targetId: string | 'robot_base';
    clickPoint?: [number, number, number];
  };
  onClose: () => void;
  onSetModo: (modo: 'translate' | 'rotate' | 'none') => void;
  transformMode: 'translate' | 'rotate' | 'none';
  onStartMeasure: () => void;
  onEliminar: (id: string) => void;
}) {
  if (!state.visible) return null;

  const isBase = state.targetId === 'robot_base';
  const base = isBase ? geometryService.obtenerBase() : null;
  const item = !isBase ? geometryService.obtenerTodas().find((g) => g.id === state.targetId) : null;

  const nombre = isBase ? 'Base Robot' : item?.nombre || 'Pieza';
  const tipo = isBase ? 'BASE' : item?.tipo.toUpperCase() || 'CAD';
  const pos = isBase ? [base!.x, base!.y, base!.z] : item?.posicion || [0, 0, 0];
  const rot = isBase ? [0, 0, base!.rz] : item?.rotacion || [0, 0, 0];
  const dim = item?.dimensiones;

  return (
    <div
      style={{ left: state.x, top: state.y }}
      className="fixed z-50 w-64 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-white/15 shadow-2xl p-3 text-xs select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Box className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-semibold text-white truncate">{nombre}</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-gray-400 font-mono">
            {tipo}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1 font-mono text-[10px] bg-black/40 p-2 rounded-lg border border-white/5 mb-2.5">
        <div className="flex justify-between text-gray-400">
          <span>Pos [X, Y, Z]:</span>
          <span className="text-sky-300">
            {pos[0]}, {pos[1]}, {pos[2]} mm
          </span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Rot [Rx, Ry, Rz]:</span>
          <span className="text-emerald-300">
            {rot[0]}°, {rot[1]}°, {rot[2]}°
          </span>
        </div>
        {dim && (
          <div className="flex justify-between text-gray-400">
            <span>Dim [An, La, Al]:</span>
            <span className="text-amber-300">
              {dim[0]} × {dim[1]} × {dim[2]} mm
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <button
          onClick={() => {
            onSetModo(transformMode === 'translate' ? 'none' : 'translate');
            onClose();
          }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
            transformMode === 'translate'
              ? 'bg-cyan-500/25 border border-cyan-400/40 text-cyan-200'
              : 'hover:bg-white/10 text-gray-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Move className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mover</span>
          </div>
          {transformMode === 'translate' && (
            <span className="text-[9px] text-cyan-300 font-mono">ACTIVO</span>
          )}
        </button>

        <button
          onClick={() => {
            onSetModo(transformMode === 'rotate' ? 'none' : 'rotate');
            onClose();
          }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
            transformMode === 'rotate'
              ? 'bg-cyan-500/25 border border-cyan-400/40 text-cyan-200'
              : 'hover:bg-white/10 text-gray-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Rotar</span>
          </div>
          {transformMode === 'rotate' && (
            <span className="text-[9px] text-cyan-300 font-mono">ACTIVO</span>
          )}
        </button>

        <button
          onClick={onStartMeasure}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
        >
          <Ruler className="w-3.5 h-3.5 text-emerald-400" />
          <span>Medir distancia desde aquí</span>
        </button>

        {!isBase && (
          <button
            onClick={() => {
              if (state.targetId) onEliminar(state.targetId);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar pieza</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Scene({
  jointAngles,
  robotInfo,
  showTrajectory,
  onTrajectoryToggle,
  onClearTrajectory,
  showWorkspace,
  workspacePoints,
  showPivots,
  onPivotsToggle,
  resetCameraTrigger,
  customPivots,
  customPositions,
  customTcpOffset,
  onWorkspaceToggle,
  onContextMenu,
  onPointClick,
  onSnapHover,
  onSurfaceClick,
  snapPreview,
  measureState,
  measuringActive,
  onToggleMeasure,
  onCloseMeasure,
}: RobotViewerProps & {
  showWorkspace: boolean;
  workspacePoints: number[][];
  showPivots: boolean;
  onPivotsToggle?: (show: boolean) => void;
  resetCameraTrigger?: number;
  customPivots: number[][];
  customPositions: number[][];
  customTcpOffset: [number, number, number];
  onWorkspaceToggle?: () => void;
  onContextMenu?: (e: any, id: string | 'robot_base') => void;
  onPointClick?: (point: THREE.Vector3, name: string, object?: THREE.Object3D) => void;
  onSnapHover?: (point: THREE.Vector3, object: THREE.Object3D, name: string) => void;
  onSurfaceClick?: (point: THREE.Vector3, name: string, object?: THREE.Object3D) => void;
  snapPreview?: { point: THREE.Vector3; label: string } | null;
  measureState?: {
    active: boolean;
    pointA: [number, number, number] | null;
    pointB: [number, number, number] | null;
    labelA?: string;
    labelB?: string;
  };
  measuringActive?: boolean;
  onToggleMeasure?: () => void;
  onCloseMeasure?: () => void;
}) {
  const gridSize = robotInfo?.workspace?.grid?.tamaño || 10;
  const gridDivision = robotInfo?.workspace?.grid?.division || 0.1;
  const minDistance = 0.4;
  const maxDistance = robotInfo?.visualizacion?.camara?.max_distancia || 10;
  const cameraPosition = DEFAULT_CAMERA_POS;
  const controlsRef = useRef<any>(null);
  const monacoFocusedRef = useRef(false);

  const linkRefs = useRef<(THREE.Group | null)[]>([]);
  const robotBaseRef = useRef<THREE.Group | null>(null);
  const geomRefs = useRef<Map<string, THREE.Group>>(new Map());
  const [colisiones, setColisiones] = useState<ColisionActiva[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [basePose, setBasePose] = useState<RobotBasePose>(() => geometryService.obtenerBase());
  const [selectedId, setSelectedId] = useState<string | 'robot_base' | null>(() =>
    geometryService.getSeleccionado()
  );
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'none'>(() =>
    geometryService.getModo()
  );

  useEffect(() => {
    const unsubBase = geometryService.suscribirBase(setBasePose);
    const unsubDrag = geometryService.suscribirDrag(setIsDragging);
    const unsubCol = geometryService.suscribirColisiones(setColisiones);
    const unsubSel = geometryService.suscribirSeleccion(setSelectedId);
    const unsubModo = geometryService.suscribirModo(setTransformMode);

    return () => {
      unsubBase();
      unsubDrag();
      unsubCol();
      unsubSel();
      unsubModo();
    };
  }, []);

  const collidingLinks = useMemo(
    () => new Set(colisiones.map((c) => c.linkIndex)),
    [colisiones]
  );

  useFrame(() => {
    if (linkRefs.current.length === 0 || geomRefs.current.size === 0) {
      if (colisiones.length > 0) geometryService.actualizarColisiones([]);
      return;
    }

    const activeCols: ColisionActiva[] = [];
    const geoms = geometryService.obtenerTodas().filter((g) => g.visible);

    const linkBoxes: { index: number; name: string; box: THREE.Box3 }[] = [];
    for (let i = 1; i < linkRefs.current.length; i++) {
      const grp = linkRefs.current[i];
      if (grp) {
        const box = new THREE.Box3().setFromObject(grp);
        box.expandByScalar(-0.008);
        linkBoxes.push({ index: i, name: `Link ${i}`, box });
      }
    }

    geomRefs.current.forEach((el, id) => {
      const item = geoms.find((g) => g.id === id);
      if (!item || item.esBaseRobot) return;
      const geomBox = new THREE.Box3().setFromObject(el);
      geomBox.expandByScalar(-0.008);

      for (const lb of linkBoxes) {
        if (lb.box.intersectsBox(geomBox)) {
          activeCols.push({
            linkIndex: lb.index,
            linkNombre: lb.name,
            geomId: item.id,
            geomNombre: item.nombre,
          });
        }
      }
    });

    geometryService.actualizarColisiones(activeCols);
  });

  useEffect(() => {
    const handler = (e: Event) => { monacoFocusedRef.current = (e as CustomEvent).detail as boolean; };
    window.addEventListener('monacoFocus', handler);
    return () => window.removeEventListener('monacoFocus', handler);
  }, []);

  const initPos = robotInfo?.visualizacion?.posicion_inicial
    ? [...robotInfo.visualizacion.posicion_inicial] as [number, number, number]
    : [-0.2439, 0, 0.200] as [number, number, number];

  const initRotDeg = robotInfo?.visualizacion?.rotacion_inicial || [-90, 0, 0];
  const initRot = initRotDeg.map(d => (d * Math.PI) / 180) as [number, number, number];

  const isIRB140 = robotInfo?.nombre === 'ABB IRB 140';

  const activePivots = customPivots && customPivots.length > 0
    ? customPivots.map(p => new THREE.Vector3(p[0], p[1], p[2]))
    : (robotInfo?.visualizacion?.pivots
      ? robotInfo.visualizacion.pivots.map(p => new THREE.Vector3(p[0], p[1], p[2]))
      : PIVOTS_HOME);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (monacoFocusedRef.current) return;
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          geometryService.rehacer();
        } else {
          geometryService.deshacer();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        geometryService.rehacer();
        return;
      }

      if (selectedId) {
        if (e.key === 'Escape') {
          if (onCloseMeasure) onCloseMeasure();
          geometryService.seleccionar(null);
          return;
        }

        if (transformMode !== 'none') {
          const step = e.shiftKey ? 50 : e.altKey ? 2 : 10;
          const angleStep = e.shiftKey ? 45 : e.altKey ? 5 : 15;

          let dx = 0;
          let dy = 0;
          let dz = 0;
          let drz = 0;

          if (transformMode === 'translate') {
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
              dx = step;
              e.preventDefault();
            } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
              dx = -step;
              e.preventDefault();
            } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
              dy = step;
              e.preventDefault();
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
              dy = -step;
              e.preventDefault();
            } else if (e.key === 'PageUp' || e.key === 'q' || e.key === 'Q') {
              dz = step;
              e.preventDefault();
            } else if (e.key === 'PageDown' || (e.key === 'e' && selectedId)) {
              dz = -step;
              e.preventDefault();
            }
          } else if (transformMode === 'rotate') {
            if (e.key === 'r' || e.key === 'R' || e.key === 'ArrowRight') {
              drz = angleStep;
              e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
              drz = -angleStep;
              e.preventDefault();
            }
          }

          if (dx !== 0 || dy !== 0 || dz !== 0 || drz !== 0) {
            if (selectedId === 'robot_base') {
              const current = geometryService.obtenerBase();
              geometryService.registrarAccion({
                id: 'robot_base',
                baseAnterior: { ...current },
                baseNueva: {
                  x: current.x + dx,
                  y: current.y + dy,
                  z: current.z + dz,
                  rz: current.rz + drz,
                },
              });
              geometryService.actualizarBase({
                x: current.x + dx,
                y: current.y + dy,
                z: current.z + dz,
                rz: current.rz + drz,
              });
            } else {
              const all = geometryService.obtenerTodas();
              const it = all.find((g) => g.id === selectedId);
              if (it) {
                geometryService.registrarAccion({
                  id: selectedId,
                  posicionAnterior: [...it.posicion],
                  rotacionAnterior: [...it.rotacion],
                  posicionNueva: [it.posicion[0] + dx, it.posicion[1] + dy, it.posicion[2] + dz],
                  rotacionNueva: [it.rotacion[0], it.rotacion[1], (it.rotacion[2] + drz) % 360],
                });
                geometryService.actualizar(selectedId, {
                  posicion: [it.posicion[0] + dx, it.posicion[1] + dy, it.posicion[2] + dz],
                  rotacion: [it.rotacion[0], it.rotacion[1], (it.rotacion[2] + drz) % 360],
                });
              }
            }
            return;
          }
        }
      }

      if ((e.key === 'm' || e.key === 'M') && onToggleMeasure) {
        onToggleMeasure();
      }
      if ((e.key === 'p' || e.key === 'P') && onPivotsToggle) {
        onPivotsToggle(!showPivots);
      }
      if ((e.key === 't' || e.key === 'T') && onTrajectoryToggle) {
        onTrajectoryToggle(!showTrajectory);
      }
      if ((e.key === 'c' || e.key === 'C') && onClearTrajectory) {
        onClearTrajectory();
      }
      if ((e.key === 'e' || e.key === 'E') && onWorkspaceToggle) {
        onWorkspaceToggle();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!selectedId || transformMode === 'none' || (!e.altKey && !e.ctrlKey)) return;
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * -5;
      if (e.altKey) {
        if (selectedId === 'robot_base') {
          const b = geometryService.obtenerBase();
          geometryService.actualizarBase({ z: b.z + delta });
        } else {
          const all = geometryService.obtenerTodas();
          const it = all.find((g) => g.id === selectedId);
          if (it) geometryService.actualizar(selectedId, { posicion: [it.posicion[0], it.posicion[1], it.posicion[2] + delta] });
        }
      } else if (e.ctrlKey) {
        if (selectedId === 'robot_base') {
          const b = geometryService.obtenerBase();
          geometryService.actualizarBase({ x: b.x + delta });
        } else {
          const all = geometryService.obtenerTodas();
          const it = all.find((g) => g.id === selectedId);
          if (it) geometryService.actualizar(selectedId, { posicion: [it.posicion[0] + delta, it.posicion[1], it.posicion[2]] });
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [showTrajectory, showPivots, onPivotsToggle, onTrajectoryToggle, onClearTrajectory, onWorkspaceToggle, selectedId, transformMode]);

  return (
    <>
      <CameraResetEffect
        resetCameraTrigger={resetCameraTrigger}
        cameraPosition={cameraPosition}
        controlsRef={controlsRef}
      />
      <ambientLight intensity={0.4} />
      <hemisphereLight args={['#ffffff', '#444444', 0.6]} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-3, 4, -3]} intensity={0.3} />
      <pointLight position={[0, 6, 0]} intensity={0.2} distance={15} decay={2} />

      <Grid
        args={[gridSize, gridSize]}
        cellSize={gridDivision}
        cellThickness={0.5}
        cellColor="#3a3a3a"
        sectionSize={1}
        sectionThickness={1.5}
        sectionColor="#1a5f7a"
        fadeDistance={gridSize * 1.5}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={(e) => {
          if (geometryService.recienArrastrado()) return;
          if (measuringActive && onPointClick) {
            e.stopPropagation();
            onPointClick(e.point, 'Plano de Celda', e.object);
            return;
          }
          const currentModo = geometryService.getModo();
          const currentSel = geometryService.getSeleccionado();
          if (currentModo === 'translate' && currentSel && onSurfaceClick) {
            e.stopPropagation();
            onSurfaceClick(e.point, 'Plano de Celda', e.object);
            return;
          }
        }}
        onPointerMove={(e) => {
          const currentModo = geometryService.getModo();
          const currentSel = geometryService.getSeleccionado();
          const isMoving = currentModo === 'translate' && currentSel;
          if ((measuringActive || isMoving) && onSnapHover) {
            e.stopPropagation();
            onSnapHover(e.point, e.object, 'Plano de Celda');
          }
        }}
      >
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.3} />
      </mesh>

      <axesHelper args={[1.5]} position={[0, 0, 0]} />

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>

      {showPivots && activePivots.map((pivot, i) => (
        i > 0 && (
          <group key={i} rotation={initRot} position={initPos}>
            <mesh position={[pivot.x, pivot.y, pivot.z]}>
              <sphereGeometry args={[0.03, 16, 16]} />
              <meshBasicMaterial color="#00ff00" />
            </mesh>
          </group>
        )
      ))}

      {showWorkspace && workspacePoints.length > 0 && (
        <WorkspaceCloud points={workspacePoints} initPos={initPos} initRot={initRot} isIRB140={isIRB140} basePose={basePose} />
      )}

      <CellGeometries
        geomRefs={geomRefs}
        colisiones={colisiones}
        onContextMenu={onContextMenu}
        onPointClick={onPointClick}
        onSnapHover={onSnapHover}
        onSurfaceClick={onSurfaceClick}
        measuringActive={measuringActive}
      />

      <MeasurementVisualizer measureState={measureState} snapPreview={snapPreview} />

      <Suspense fallback={null}>
        <Robot
          jointAngles={jointAngles}
          robotInfo={robotInfo}
          showTrajectory={showTrajectory}
          onTrajectoryToggle={onTrajectoryToggle}
          onClearTrajectory={onClearTrajectory}
          customPivots={customPivots}
          customPositions={customPositions}
          customTcpOffset={customTcpOffset}
          basePose={basePose}
          selectedId={selectedId}
          transformMode={transformMode}
          collidingLinks={collidingLinks}
          linkRefs={linkRefs}
          robotBaseRef={robotBaseRef}
          onContextMenu={onContextMenu}
          onPointClick={onPointClick}
          onSnapHover={onSnapHover}
          onSurfaceClick={onSurfaceClick}
          measuringActive={measuringActive}
        />
      </Suspense>

      <GizmoManager controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={minDistance}
        maxDistance={maxDistance}
        maxPolarAngle={Math.PI / 2}
        target={DEFAULT_ORBIT_TARGET}
      />
    </>
  );
}

function CollisionOverlay() {
  const [colisiones, setColisiones] = useState<ColisionActiva[]>([]);

  useEffect(() => {
    return geometryService.suscribirColisiones(setColisiones);
  }, []);

  if (colisiones.length === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-red-950/90 border border-red-500/70 shadow-2xl backdrop-blur-md animate-pulse">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <div className="text-xs font-semibold text-red-100">
          ¡Colisión detectada: {colisiones[0].linkNombre} con "{colisiones[0].geomNombre}"!
        </div>
      </div>
    </div>
  );
}

function GizmoQuickToolbar({
  measuringActive,
  onToggleMeasure,
}: {
  measuringActive?: boolean;
  onToggleMeasure?: () => void;
}) {
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'none'>(() => geometryService.getModo());
  const [selectedId, setSelectedId] = useState<string | 'robot_base' | null>(() => geometryService.getSeleccionado());

  useEffect(() => {
    const unsubModo = geometryService.suscribirModo(setTransformMode);
    const unsubSel = geometryService.suscribirSeleccion(setSelectedId);
    return () => {
      unsubModo();
      unsubSel();
    };
  }, []);

  const toggleModo = (modo: 'translate' | 'rotate') => {
    if (transformMode === modo) {
      geometryService.setModo('none');
    } else {
      geometryService.setModo(modo);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-[#0b1017]/85 backdrop-blur-xl border border-white/10 shadow-xl">
      <button
        onClick={() => toggleModo('translate')}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
          transformMode === 'translate'
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
            : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
        }`}
        title={transformMode === 'translate' ? 'Desactivar Mover (clic para desmarcar)' : 'Activar Mover (W)'}
      >
        <Move className="w-3.5 h-3.5" />
        <span>Mover</span>
      </button>
      <button
        onClick={() => toggleModo('rotate')}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
          transformMode === 'rotate'
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
            : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
        }`}
        title={transformMode === 'rotate' ? 'Desactivar Rotar (clic para desmarcar)' : 'Activar Rotar (E)'}
      >
        <RotateCw className="w-3.5 h-3.5" />
        <span>Rotar</span>
      </button>

      {onToggleMeasure && (
        <button
          onClick={onToggleMeasure}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
            measuringActive
              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="Medir distancia entre dos puntos (M)"
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>Medir</span>
        </button>
      )}

      {selectedId && (
        <>
          <div className="w-px h-3.5 bg-white/10" />
          <button
            onClick={() => geometryService.seleccionar(null)}
            className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 flex items-center gap-1"
            title="Deseleccionar (Esc)"
          >
            <X className="w-3 h-3" />
            <span className="truncate max-w-[100px]">
              {selectedId === 'robot_base' ? 'Base Robot' : 'Objeto'}
            </span>
          </button>
        </>
      )}
    </div>
  );
}

export function RobotViewer3D({
  jointAngles,
  robotInfo,
  showTrajectory: externalShowTrajectory,
  onTrajectoryToggle: externalOnTrajectoryToggle,
  clearTrajectoryTrigger,
  showWorkspace: externalShowWorkspace,
  onWorkspaceToggle: externalOnWorkspaceToggle,
  showPivots: externalShowPivots,
  onPivotsToggle: externalOnPivotsToggle,
  resetCameraTrigger: externalResetCameraTrigger,
  onResetCamera: externalOnResetCamera,
  isViewerExpanded = false,
  onToggleViewerExpanded,
  customTcpOffset: externalTcpOffset,
}: RobotViewerProps) {
  const cameraPosition = DEFAULT_CAMERA_POS;
  const cameraFov = 45;
  const [internalShowTrajectory, setInternalShowTrajectory] = useState(false);
  const [internalShowWorkspace, setInternalShowWorkspace] = useState(false);
  const [internalShowPivots, setInternalShowPivots] = useState(false);
  const [internalResetCamera, setInternalResetCamera] = useState(0);
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);
  const [workspacePoints, setWorkspacePoints] = useState<number[][]>([]);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);

  const showTrajectory = externalShowTrajectory ?? internalShowTrajectory;
  const showWorkspace = externalShowWorkspace ?? internalShowWorkspace;
  const showPivots = externalShowPivots ?? internalShowPivots;
  const effectiveResetCameraTrigger = (externalResetCameraTrigger ?? 0) + internalResetCamera;

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [selectedLink, setSelectedLink] = useState(0);
  const [customPivots, setCustomPivots] = useState<number[][]>([]);
  const [customPositions, setCustomPositions] = useState<number[][]>([]);
  const [customTcpOffset, setCustomTcpOffset] = useState<[number, number, number]>([0, 0, 0]);
  const activeTcpOffset = externalTcpOffset ?? customTcpOffset;
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'none'>(() => geometryService.getModo());

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetId: string | 'robot_base';
    clickPoint?: [number, number, number];
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetId: 'robot_base',
  });

  const [measureState, setMeasureState] = useState<{
    active: boolean;
    pointA: [number, number, number] | null;
    pointB: [number, number, number] | null;
    labelA?: string;
    labelB?: string;
  }>({
    active: false,
    pointA: null,
    pointB: null,
  });

  const [snapPreview, setSnapPreview] = useState<{ point: THREE.Vector3; label: string } | null>(null);

  useEffect(() => {
    return geometryService.suscribirModo(setTransformMode);
  }, []);

  useEffect(() => {
    const handleGlobalUndo = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          geometryService.rehacer();
        } else {
          geometryService.deshacer();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        geometryService.rehacer();
      }
    };
    window.addEventListener('keydown', handleGlobalUndo);
    return () => window.removeEventListener('keydown', handleGlobalUndo);
  }, []);

  useEffect(() => {
    const onWindowClick = () => {
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', onWindowClick);
    return () => window.removeEventListener('click', onWindowClick);
  }, [contextMenu.visible]);

  const handleContextMenu = (e: any, targetId: string | 'robot_base') => {
    geometryService.seleccionar(targetId);
    const clientX = e.nativeEvent ? e.nativeEvent.clientX : e.clientX || 200;
    const clientY = e.nativeEvent ? e.nativeEvent.clientY : e.clientY || 200;

    let contactPoint: [number, number, number] | undefined;
    if (e.point) {
      contactPoint = [
        Math.round((e.point.x - 0.070) * 1000),
        Math.round(-e.point.z * 1000),
        Math.round(e.point.y * 1000),
      ];
    }

    setContextMenu({
      visible: true,
      x: Math.min(clientX, window.innerWidth - 270),
      y: Math.min(clientY, window.innerHeight - 340),
      targetId,
      clickPoint: contactPoint,
    });
  };

  const handleSnapHover = (point: THREE.Vector3, object?: THREE.Object3D | null, name?: string) => {
    const isMoving = transformMode === 'translate' && !!geometryService.getSeleccionado();
    if (!measureState.active && !isMoving) {
      if (snapPreview) setSnapPreview(null);
      return;
    }
    const snapped = computeSnapPoint(point, object, name);
    setSnapPreview(snapped);
  };

  const handleSurfaceClick = (point: THREE.Vector3, name: string, object?: THREE.Object3D) => {
    const curSel = geometryService.getSeleccionado();
    if (!curSel || transformMode !== 'translate') return;

    const snapped = computeSnapPoint(point, object, name);
    const p = snapped.point;

    const posX = Math.round((p.x - 0.070) * 1000);
    const posY = Math.round(-p.z * 1000);
    const posZ = Math.round(p.y * 1000);

    if (curSel === 'robot_base') {
      const curBase = geometryService.obtenerBase();
      geometryService.registrarAccion({
        id: 'robot_base',
        baseAnterior: { ...curBase },
        baseNueva: { ...curBase, x: posX, y: posY, z: posZ },
      });
      geometryService.actualizarBase({ x: posX, y: posY, z: posZ });
    } else {
      const all = geometryService.obtenerTodas();
      const it = all.find((g) => g.id === curSel);
      if (it) {
        geometryService.registrarAccion({
          id: it.id,
          posicionAnterior: [...it.posicion],
          rotacionAnterior: [...it.rotacion],
          posicionNueva: [posX, posY, posZ],
          rotacionNueva: [...it.rotacion],
        });
        geometryService.actualizar(it.id, { posicion: [posX, posY, posZ] });
      }
    }
  };

  const handlePointClick = (point: THREE.Vector3, name: string, object?: THREE.Object3D) => {
    const snapped = computeSnapPoint(point, object, name);
    const p = snapped.point;
    const snapLabel = `${name} (${snapped.label})`;

    const coords: [number, number, number] = [
      Math.round((p.x - 0.070) * 1000),
      Math.round(-p.z * 1000),
      Math.round(p.y * 1000),
    ];

    setMeasureState((prev) => {
      if (!prev.pointA || prev.pointB) {
        return {
          active: true,
          pointA: coords,
          pointB: null,
          labelA: snapLabel,
        };
      }
      return {
        ...prev,
        pointB: coords,
        labelB: snapLabel,
      };
    });
  };

  const handleStartMeasureFromContext = () => {
    if (!contextMenu.targetId) return;
    let startPoint: [number, number, number];
    let label = 'Punto';

    if (contextMenu.clickPoint) {
      startPoint = contextMenu.clickPoint;
    } else if (contextMenu.targetId === 'robot_base') {
      const base = geometryService.obtenerBase();
      startPoint = [base.x, base.y, base.z];
      label = 'Base Robot';
    } else {
      const item = geometryService.obtenerTodas().find(g => g.id === contextMenu.targetId);
      if (item) {
        startPoint = [...item.posicion];
        label = item.nombre;
      } else {
        startPoint = [0, 0, 0];
      }
    }

    setMeasureState({
      active: true,
      pointA: startPoint,
      pointB: null,
      labelA: label,
      labelB: undefined,
    });
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    if (robotInfo) {
      setCustomPivots(robotInfo.visualizacion?.pivots ? [...robotInfo.visualizacion.pivots] : []);
      const links = robotInfo.eslabones || robotInfo.archivos_stl.map(() => ({ posicion_local: [0, 0, 0] as [number, number, number] }));
      setCustomPositions(links.map(l => l.posicion_local ? [...l.posicion_local] : [0, 0, 0]));
      setCustomTcpOffset((robotInfo as any).visualizacion?.tcp_offset ? [...(robotInfo as any).visualizacion.tcp_offset] as [number, number, number] : [0, 0, 0]);
      setSelectedLink(0);
      setWorkspacePoints([]);
    }
  }, [robotInfo?.nombre]);

  const updateCustomPivot = (axis: 0 | 1 | 2, val: number) => {
    const newPivots = [...customPivots];
    if (newPivots[selectedLink]) {
      newPivots[selectedLink][axis] = val;
      setCustomPivots(newPivots);
    }
  };

  const updateTcpOffset = (axis: 0 | 1 | 2, val: number) => {
    const newOffset = [...customTcpOffset] as [number, number, number];
    newOffset[axis] = val;
    setCustomTcpOffset(newOffset);
  };

  const updateCustomPosition = (axis: 0 | 1 | 2, val: number) => {
    const newPositions = [...customPositions];
    if (newPositions[selectedLink]) {
      newPositions[selectedLink][axis] = val;
      setCustomPositions(newPositions);
    }
  };

  const currentPivot = customPivots[selectedLink] || [0, 0, 0];
  const currentPos = customPositions[selectedLink] || [0, 0, 0];

  const fetchWorkspace = async () => {
    if (workspacePoints.length > 0 || isLoadingWorkspace) return;

    setIsLoadingWorkspace(true);
    try {
      const robotId = robotInfo?.nombre?.includes('SCARA') ? 'ABB_IRB_910SC' : 'ABB_IRB_140';
      const response = await api.get(`/api/robot/workspace`, { params: { robot_id: robotId } });
      if (response.data?.success) {
        setWorkspacePoints(response.data.points);
      }
    } catch (err) {
      console.error('Error cargando workspace:', err);
    } finally {
      setIsLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    if (showWorkspace && workspacePoints.length === 0) {
      fetchWorkspace();
    }
  }, [showWorkspace]);

  const handleTrajectoryToggle = (show: boolean) => {
    if (externalOnTrajectoryToggle) {
      externalOnTrajectoryToggle(show);
    } else {
      setInternalShowTrajectory(show);
    }
  };

  const handleClearTrajectory = () => {
    handleTrajectoryToggle(false);
    setTimeout(() => handleTrajectoryToggle(true), 40);
  };

  useEffect(() => {
    if (clearTrajectoryTrigger && clearTrajectoryTrigger > 0) {
      handleClearTrajectory();
    }
  }, [clearTrajectoryTrigger]);

  const handleWorkspaceToggle = () => {
    if (externalOnWorkspaceToggle) {
      externalOnWorkspaceToggle();
    } else {
      setInternalShowWorkspace(!showWorkspace);
    }
  };

  const handlePivotsToggle = (show: boolean) => {
    if (externalOnPivotsToggle) {
      externalOnPivotsToggle(show);
    } else {
      setInternalShowPivots(show);
    }
  };

  const handleResetCameraClick = () => {
    setInternalResetCamera(c => c + 1);
    externalOnResetCamera?.();
  };

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{
          position: cameraPosition as [number, number, number],
          fov: cameraFov
        }}
        shadows={{
          enabled: true,
          type: THREE.PCFSoftShadowMap
        }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2
        }}
        style={{ background: 'transparent' }}
      >
        <Scene
          jointAngles={jointAngles}
          robotInfo={robotInfo}
          showTrajectory={showTrajectory}
          onTrajectoryToggle={handleTrajectoryToggle}
          onClearTrajectory={handleClearTrajectory}
          showWorkspace={showWorkspace}
          workspacePoints={workspacePoints}
          showPivots={showPivots}
          onPivotsToggle={handlePivotsToggle}
          resetCameraTrigger={effectiveResetCameraTrigger}
          customPivots={customPivots}
          customPositions={customPositions}
          customTcpOffset={activeTcpOffset}
          onWorkspaceToggle={handleWorkspaceToggle}
          onContextMenu={handleContextMenu}
          onPointClick={handlePointClick}
          onSnapHover={handleSnapHover}
          onSurfaceClick={handleSurfaceClick}
          snapPreview={snapPreview}
          measureState={measureState}
          measuringActive={measureState.active}
          onToggleMeasure={() => {
            setSnapPreview(null);
            setMeasureState(prev => ({ ...prev, active: !prev.active, pointA: null, pointB: null }));
          }}
          onCloseMeasure={() => {
            setSnapPreview(null);
            setMeasureState({ active: false, pointA: null, pointB: null });
          }}
        />
      </Canvas>

      <GizmoQuickToolbar
        measuringActive={measureState.active}
        onToggleMeasure={() => {
          setSnapPreview(null);
          setMeasureState(prev => ({ ...prev, active: !prev.active, pointA: null, pointB: null }));
        }}
      />
      <CollisionOverlay />

      {transformMode === 'translate' && geometryService.getSeleccionado() && !measureState.active && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-cyan-500/40 shadow-2xl text-xs text-white">
          <Move className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
          <span className="font-mono text-[11px]">
            Arrastra las flechas o <span className="text-cyan-300 font-semibold">haz clic en una superficie</span> para colocar la pieza
          </span>
          <button
            onClick={() => geometryService.setModo('none')}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            title="Finalizar mover (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {measureState.active && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-sky-500/40 shadow-2xl text-xs text-white">
          <Ruler className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
          <span className="font-mono text-[11px]">
            {!measureState.pointA
              ? 'Haz clic en el Punto 1 (auto-snap a esquinas, centros y tercios)'
              : !measureState.pointB
              ? `Punto A [${measureState.pointA.join(', ')}] mm. Clic en Punto B`
              : `Distancia: ${Math.round(Math.hypot(measureState.pointB[0] - measureState.pointA[0], measureState.pointB[1] - measureState.pointA[1], measureState.pointB[2] - measureState.pointA[2]))} mm (XY: ${Math.round(Math.hypot(measureState.pointB[0] - measureState.pointA[0], measureState.pointB[1] - measureState.pointA[1]))} mm)`}
          </span>
          {measureState.pointA && (
            <button
              onClick={() => {
                setSnapPreview(null);
                setMeasureState({ active: true, pointA: null, pointB: null });
              }}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-[10px]"
            >
              Reiniciar
            </button>
          )}
          <button
            onClick={() => {
              setSnapPreview(null);
              setMeasureState({ active: false, pointA: null, pointB: null });
            }}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            title="Cerrar (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <PieceContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        onSetModo={(modo) => geometryService.setModo(modo)}
        transformMode={transformMode}
        onStartMeasure={handleStartMeasureFromContext}
        onEliminar={(id) => {
          geometryService.eliminar(id);
          setContextMenu(prev => ({ ...prev, visible: false }));
        }}
      />

      {(showTrajectory || showWorkspace || showPivots || isLoadingWorkspace) && (
        <div className="absolute top-16 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/55 border border-white/10 backdrop-blur-md text-[10px]">
          {showTrajectory && (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Trazo TCP
            </span>
          )}
          {showWorkspace && (
            <span className="flex items-center gap-1 text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {isLoadingWorkspace ? 'Cargando espacio...' : 'Espacio'}
            </span>
          )}
          {showPivots && (
            <span className="flex items-center gap-1 text-lime-300">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
              Pivotes
            </span>
          )}
        </div>
      )}

      {!isCalibrating && (
        <div className="absolute bottom-3 left-3 z-20 flex items-end gap-2 select-none">
          <div className="bg-black/55 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10 flex items-center gap-3 text-[10px] text-gray-400 shadow-lg">
            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Ejes</span>
            <span className="flex items-center gap-1 text-red-400 font-mono">
              <span className="w-2.5 h-0.5 bg-red-500 inline-block" />X
            </span>
            <span className="flex items-center gap-1 text-emerald-400 font-mono">
              <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" />Y
            </span>
            <span className="flex items-center gap-1 text-blue-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />Z
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowShortcutsHint(v => !v)}
              className={`px-2 py-1.5 rounded-lg border backdrop-blur-md text-[10px] flex items-center gap-1 transition-colors shadow-lg ${
                showShortcutsHint
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                  : 'bg-black/55 text-gray-400 hover:text-gray-200 border-white/10'
              }`}
              title="Mostrar/ocultar atajos de teclado"
            >
              <Keyboard className="w-3 h-3" />
              <span>Atajos</span>
            </button>

            {showShortcutsHint && (
              <div className="absolute bottom-9 left-0 bg-[#0d131c]/95 backdrop-blur-md px-3 py-2.5 rounded-lg text-[10px] text-gray-300 border border-white/15 shadow-2xl w-40 space-y-1">
                <div className="font-semibold text-cyan-400 uppercase tracking-wider border-b border-white/10 pb-1 mb-1">
                  Teclado
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">T</kbd>
                  <span className="text-gray-400">Trazo TCP</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">C</kbd>
                  <span className="text-gray-400">Limpiar trazo</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">P</kbd>
                  <span className="text-gray-400">Pivotes DH</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">E</kbd>
                  <span className="text-gray-400">Espacio trabajo</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">M</kbd>
                  <span className="text-gray-400">Medir distancia</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">Clic Der.</kbd>
                  <span className="text-gray-400">Propiedades</span>
                </div>
                <div className="font-semibold text-sky-400 uppercase tracking-wider border-b border-white/10 pb-1 mt-2 mb-1">
                  Mover Pieza
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">Flechas / WASD</kbd>
                  <span className="text-gray-400">X / Y</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">Q / E / AvPág</kbd>
                  <span className="text-gray-400">Altura Z</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">R</kbd>
                  <span className="text-gray-400">Girar Yaw</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">Shift / Alt</kbd>
                  <span className="text-gray-400">Rápido / Fino</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">Ctrl + Z</kbd>
                  <span className="text-gray-400">Deshacer</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="text-white font-mono">Esc</kbd>
                  <span className="text-gray-400">Deseleccionar</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isCalibrating && (
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-2xl text-white w-80 text-sm overflow-y-auto max-h-[90vh]">
          <h2 className="text-lg font-bold text-yellow-400 mb-4 border-b border-white/10 pb-2">Herramienta de Calibración</h2>

          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Eslabón a calibrar (Index)</label>
            <select
              value={selectedLink}
              onChange={(e) => setSelectedLink(Number(e.target.value))}
              className="w-full bg-gray-900 border border-white/20 rounded p-2 text-white"
            >
              {customPositions.map((_, i) => (
                <option key={i} value={i}>
                  {robotInfo?.eslabones?.[i]?.nombre || `Eslabón ${i}`} (Index {i})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white/5 p-3 rounded-lg mb-4">
            <h3 className="font-bold text-cyan-400 mb-3 text-xs uppercase">Posición Local (Desfase de la pieza)</h3>
            <div className="space-y-3">
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <div key={`pos-${axis}`} className="flex items-center gap-3">
                  <span className="w-4 text-gray-400 font-mono">{axis}</span>
                  <input
                    type="range"
                    min="-1" max="1" step="0.005"
                    value={currentPos[i]}
                    onChange={(e) => updateCustomPosition(i as 0 | 1 | 2, parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <input
                    type="number" step="0.005"
                    value={currentPos[i]}
                    onChange={(e) => updateCustomPosition(i as 0 | 1 | 2, parseFloat(e.target.value))}
                    className="w-16 bg-gray-900 p-1 text-xs rounded border border-white/20"
                  />
                </div>
              ))}
            </div>

            <h3 className="font-bold text-green-400 mt-5 mb-3 text-xs uppercase">Posición Global del Pivote (Rotación DH)</h3>
            <div className="space-y-3">
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <div key={`piv-${axis}`} className="flex items-center gap-3">
                  <span className="w-4 text-gray-400 font-mono">{axis}</span>
                  <input
                    type="range"
                    min="-1" max="1" step="0.005"
                    value={currentPivot[i]}
                    onChange={(e) => updateCustomPivot(i as 0 | 1 | 2, parseFloat(e.target.value))}
                    className="flex-1 accent-green-500"
                  />
                  <input
                    type="number" step="0.005"
                    value={currentPivot[i]}
                    onChange={(e) => updateCustomPivot(i as 0 | 1 | 2, parseFloat(e.target.value))}
                    className="w-16 bg-gray-900 p-1 text-xs rounded border border-white/20"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-lg mb-4">
            <h3 className="font-bold text-pink-400 mb-3 text-xs uppercase">Desfase Trayectoria TCP</h3>
            <div className="space-y-3">
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <div key={`tcp-${axis}`} className="flex items-center gap-3">
                  <span className="w-4 text-gray-400 font-mono">{axis}</span>
                  <input
                    type="range"
                    min="-2" max="2" step="0.005"
                    value={customTcpOffset[i]}
                    onChange={(e) => updateTcpOffset(i as 0 | 1 | 2, parseFloat(e.target.value))}
                    className="flex-1 accent-pink-500"
                  />
                  <input
                    type="number" step="0.005"
                    value={customTcpOffset[i]}
                    onChange={(e) => updateTcpOffset(i as 0 | 1 | 2, parseFloat(e.target.value))}
                    className="w-16 bg-gray-900 p-1 text-xs rounded border border-white/20"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-900/80 rounded border border-white/10">
            <div className="text-xs text-gray-400 mb-2">Copia estos valores a `especificaciones_robot.py`:</div>
            <textarea
              readOnly
              className="w-full h-32 bg-black font-mono text-[10px] p-2 text-green-400 rounded outline-none"
              value={JSON.stringify({
                pivots: customPivots.map(p => [+p[0].toFixed(3), +p[1].toFixed(3), +p[2].toFixed(3)]),
                posicion_local_ejemplo: currentPos.map(p => +p.toFixed(3)),
                tcp_offset: customTcpOffset.map(p => +p.toFixed(3))
              }, null, 2)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
