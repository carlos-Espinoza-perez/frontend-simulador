import { useRef, useEffect, useState, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';


interface STLModelProps {
  url: string;
  color?: string;
  scale?: number;
  position?: THREE.Vector3;
}

function STLModel({ url, color = '#E8E8E8', scale = 1, position }: STLModelProps) {
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

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      castShadow
      receiveShadow
      position={position}
    >
      <meshStandardMaterial
        color={color}
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
    // Actualiza los puntos reactivamente si hay nuevos puntos reales
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

interface RobotViewerProps {
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
  customPivots?: number[][];
  customPositions?: number[][];
  customTcpOffset?: [number, number, number];
}

const DX = 0.247;
const DY = 0.203;

// Pivots ajustados para centrar visualmente cada articulación
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

function Robot({ jointAngles, robotInfo, showTrajectory, customPivots, customPositions, customTcpOffset }: RobotViewerProps) {
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

  // Limpiar trayectoria cuando se solicite
  useEffect(() => {
    if (!showTrajectory && trajectoryPoints.current.length > 0) {
      trajectoryPoints.current = [];
      lastTcpPosition.current = null;
    }
  }, [showTrajectory]);

  useFrame(() => {
    if (!robotInfo || !jointAngles || jointAngles.length < 1) return;

    // Validación de seguridad para que ningún cálculo introduzca 'NaN' a la GPU 
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
    // Calcular posición del TCP
    const lastPivot = pivots[pivots.length - 1] || new THREE.Vector3();
    const lastAxis = axes[axes.length - 1] || new THREE.Vector3(1, 0, 0);
    
    let tcpOffset = 0;
    if (robotInfo?.nombre === 'ABB IRB 140') {
      tcpOffset = 0.065;
    }
    // Se calcula usando los pivotes que se actualizan correctamente con todos los joints
    const tcpPosition = lastPivot.clone().add(lastAxis.clone().multiplyScalar(tcpOffset));
    
    // Si hay un customTcpOffset, lo aplicamos para centrar visualmente.
    // Necesitamos aplicar este desfase rotado junto con el último pivote, 
    // pero como el offset es habitualmente visual (constante local al TCP),
    // lo sumamos según los ejes base o ejes rotados. Para simplificar la calibración, 
    // lo sumamos relativo a los ejes globales para que el usuario pueda alinearlo.
    if (customTcpOffset) {
      tcpPosition.add(new THREE.Vector3(customTcpOffset[0], customTcpOffset[1], customTcpOffset[2]));
    }

    // Agregar punto a la trayectoria de forma segura (sin tocar UI)
    if (showTrajectory) {
      if (!lastTcpPosition.current || tcpPosition.distanceTo(lastTcpPosition.current) > 0.001) {
        // En caso excepcional que la coordenada sea NaN no la guardamos
        if (!isNaN(tcpPosition.x) && !isNaN(tcpPosition.y) && !isNaN(tcpPosition.z)) {
          trajectoryPoints.current.push(tcpPosition.clone());
          lastTcpPosition.current = tcpPosition.clone();

          // Límite de puntos para evitar caída de frames por arreglo infinito
          if (trajectoryPoints.current.length > 5000) {
            trajectoryPoints.current.shift();
          }
        }
      }
    }
  });

  return (
    <group rotation={initRot} position={initPos}>
      {eslabones.map((eslabon, index) => {
        const localPosArray = customPositions?.[index] || eslabon.posicion_local || [0, 0, 0];
        const localPos = new THREE.Vector3(localPosArray[0], localPosArray[1], localPosArray[2]);
        return (
          <group
            key={eslabon.id}
            ref={(el: THREE.Group | null) => { groupRefs.current[index] = el; }}
          >
            <STLModel
              url={`/models/${robotFolder}/${eslabon.archivo_stl}`}
              color={eslabon.color}
              scale={scale}
              position={localPos}
            />
          </group>
        );
      })}

      {/* Línea de trayectoria gestionada aisladamente por un componente que maneja el componente Line */}
      <TrajectoryLine
        showTrajectory={showTrajectory}
        trajectoryPointsRef={trajectoryPoints}
      />
    </group>
  );
}

function WorkspaceCloud({ points, initPos, initRot, isIRB140 }: { points: number[][], initPos: [number, number, number], initRot: [number, number, number], isIRB140: boolean }) {
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
    <points rotation={initRot} position={initPos} geometry={geometry}>
      <pointsMaterial
        size={0.008}
        color="#00ffff"
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
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
  customPivots,
  customPositions,
  customTcpOffset
}: RobotViewerProps & { showWorkspace: boolean; workspacePoints: number[][]; customPivots: number[][]; customPositions: number[][]; customTcpOffset: [number, number, number] }) {
  const gridSize = robotInfo?.workspace?.grid?.tamaño || 10;
  const gridDivision = robotInfo?.workspace?.grid?.division || 0.1;
  const minDistance = robotInfo?.visualizacion?.camara?.min_distancia || 1;
  const maxDistance = robotInfo?.visualizacion?.camara?.max_distancia || 10;
  const [showPivots, setShowPivots] = useState(false);

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
      if (e.key === 'p' || e.key === 'P') {
        setShowPivots(prev => !prev);
      }
      if ((e.key === 't' || e.key === 'T') && onTrajectoryToggle) {
        onTrajectoryToggle(!showTrajectory);
      }
      if ((e.key === 'c' || e.key === 'C') && onClearTrajectory) {
        onClearTrajectory();
      }
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [showTrajectory, onTrajectoryToggle, onClearTrajectory]);

  return (
    <>
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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
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
        <WorkspaceCloud points={workspacePoints} initPos={initPos} initRot={initRot} isIRB140={isIRB140} />
      )}

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
        />
      </Suspense>

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={minDistance}
        maxDistance={maxDistance}
        maxPolarAngle={Math.PI / 2}
        target={[DX, -0, DY]}
      />
    </>
  );
}

export function RobotViewer3D({ jointAngles, robotInfo }: RobotViewerProps) {
  const cameraPosition = robotInfo?.visualizacion?.camara?.posicion || [2, 1.5, 2];
  const cameraFov = robotInfo?.visualizacion?.camara?.fov || 50;
  const [showTrajectory, setShowTrajectory] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [workspacePoints, setWorkspacePoints] = useState<number[][]>([]);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);

  // Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [selectedLink, setSelectedLink] = useState(0);
  const [customPivots, setCustomPivots] = useState<number[][]>([]);
  const [customPositions, setCustomPositions] = useState<number[][]>([]);
  const [customTcpOffset, setCustomTcpOffset] = useState<[number, number, number]>([0, 0, 0]);

  useEffect(() => {
    // Reset defaults whenever robot changes
    if (robotInfo) {
      setCustomPivots(robotInfo.visualizacion?.pivots ? [...robotInfo.visualizacion.pivots] : []);
      const links = robotInfo.eslabones || robotInfo.archivos_stl.map(() => ({ posicion_local: [0, 0, 0] as [number, number, number] }));
      setCustomPositions(links.map(l => l.posicion_local ? [...l.posicion_local] : [0, 0, 0]));
      setCustomTcpOffset((robotInfo as any).visualizacion?.tcp_offset ? [...(robotInfo as any).visualizacion.tcp_offset] as [number, number, number] : [0, 0, 0]);
      setSelectedLink(0);
      setWorkspacePoints([]); // Limpiar la nube de puntos vieja!
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
    if (workspacePoints.length > 0) return;

    setIsLoadingWorkspace(true);
    try {
      const robotId = robotInfo?.nombre?.includes('SCARA') ? 'ABB_IRB_910SC' : 'ABB_IRB_140';
      const response = await fetch(`http://127.0.0.1:5000/api/robot/workspace?robot_id=${robotId}`);
      const data = await response.json();
      if (data.success) {
        setWorkspacePoints(data.points);
      }
    } catch (err) {
      console.error('Error cargando workspace:', err);
    } finally {
      setIsLoadingWorkspace(false);
    }
  };

  const handleTrajectoryToggle = (show: boolean) => {
    setShowTrajectory(show);
  };

  const handleClearTrajectory = () => {
    setShowTrajectory(false);
    setTimeout(() => setShowTrajectory(true), 50);
  };

  const handleWorkspaceToggle = () => {
    if (!showWorkspace && workspacePoints.length === 0) {
      fetchWorkspace();
    }
    setShowWorkspace(!showWorkspace);
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
          customPivots={customPivots}
          customPositions={customPositions}
          customTcpOffset={customTcpOffset}
        />
      </Canvas>

      {/* Controles de visualización */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setIsCalibrating(!isCalibrating)}
          className={`px-4 py-2 rounded-lg font-medium transition-all shadow-lg flex items-center justify-center gap-2 ${isCalibrating
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
            : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300 backdrop-blur-md border border-white/10'
            }`}
        >
          ⚙️ Calibrar
        </button>
        <button
          onClick={() => handleTrajectoryToggle(!showTrajectory)}
          className={`px-4 py-2 rounded-lg font-medium transition-all shadow-lg flex items-center justify-center gap-2 ${showTrajectory
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300 backdrop-blur-md border border-white/10'
            }`}
          title="Tecla: T"
        >
          <div className={`w-2 h-2 rounded-full ${showTrajectory ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
          Trayectoria
        </button>

        <button
          onClick={handleWorkspaceToggle}
          disabled={isLoadingWorkspace}
          className={`px-4 py-2 rounded-lg font-medium transition-all shadow-lg flex items-center justify-center gap-2 ${showWorkspace
            ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
            : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300 backdrop-blur-md border border-white/10'
            }`}
        >
          {isLoadingWorkspace ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <div className={`w-2 h-2 rounded-full ${showWorkspace ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
          )}
          Espacio de Trabajo
        </button>

        {showTrajectory && (
          <button
            onClick={handleClearTrajectory}
            className="px-4 py-2 rounded-lg font-medium bg-red-500/80 hover:bg-red-600 text-white transition-all shadow-lg backdrop-blur-md border border-red-400/20"
            title="Tecla: C"
          >
            Limpiar Trayectoria
          </button>
        )}
      </div>

      {/* Leyenda de teclas */}
      {!isCalibrating && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-4 py-3 rounded-xl text-[10px] text-gray-300 border border-white/10 shadow-2xl">
          <div className="font-bold text-cyan-400 mb-2 uppercase tracking-widest border-b border-white/10 pb-1">Atajos</div>
          <div className="space-y-1">
            <div className="flex justify-between gap-4"><span>T</span> <span className="text-gray-500">Trayectoria</span></div>
            <div className="flex justify-between gap-4"><span>C</span> <span className="text-gray-500">Limpiar</span></div>
            <div className="flex justify-between gap-4"><span>P</span> <span className="text-gray-500">Pivots</span></div>
          </div>
        </div>
      )}

      {/* Panel de Calibración */}
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
