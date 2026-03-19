import { useRef, useEffect, useState, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';


interface STLModelProps {
  url: string;
  color?: string;
  scale?: number;
}

function STLModel({ url, color = '#E8E8E8', scale = 1 }: STLModelProps) {
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
      color="#33ff00ff"
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
    }>;
    visualizacion?: {
      escala?: number;
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
  } | null;
  showTrajectory?: boolean;
  onTrajectoryToggle?: (show: boolean) => void;
  onClearTrajectory?: () => void;
}

const DX = 0.247;
const DY = 0.203;

// Pivots ajustados para centrar visualmente cada articulación
const PIVOTS_HOME = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(DX + 0.065, DY, 0),         // J1 - ajustado para centrar base
  new THREE.Vector3(DX + 0.140, DY, 0.352),     // J2 - ajustado para centrar eje
  new THREE.Vector3(DX + 0.140, DY, 0.712),     // J3 - ajustado para centrar eje
  new THREE.Vector3(DX + 0.070, DY, 0.712),     // J4 - original
  new THREE.Vector3(DX + 0.520, DY, 0.712),     // J5 - ajustado +70mm en X
  new THREE.Vector3(DX + 0.515, DY, 0.712)      // J6 - original
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

function Robot({ jointAngles, robotInfo, showTrajectory }: RobotViewerProps) {
  const groupRefs = useRef<(THREE.Group | null)[]>([null, null, null, null, null, null, null]);
  const trajectoryPoints = useRef<THREE.Vector3[]>([]);
  const lastTcpPosition = useRef<THREE.Vector3 | null>(null);

  const scale = robotInfo?.visualizacion?.escala || 0.001;
  const robotFolder = robotInfo?.ruta_stl.split('/').pop();

  const eslabones = robotInfo?.eslabones || robotInfo?.archivos_stl.map((filename, index) => ({
    id: index,
    nombre: `Link ${index}`,
    archivo_stl: filename,
    color: index === 0 ? '#E8E8E8' : '#E8E8E8'
  })) || [];

  // Limpiar trayectoria cuando se solicite
  useEffect(() => {
    if (!showTrajectory && trajectoryPoints.current.length > 0) {
      trajectoryPoints.current = [];
      lastTcpPosition.current = null;
    }
  }, [showTrajectory]);

  useFrame(() => {
    if (!robotInfo || !jointAngles || jointAngles.length < 6) return;

    // Validación de seguridad para que ningún cálculo introduzca 'NaN' a la GPU 
    if (jointAngles.some(ang => ang === null || ang === undefined || isNaN(ang))) return;

    const q_rad = jointAngles.map(deg => (deg * Math.PI) / 180);

    const pivots = PIVOTS_HOME.map(p => p.clone());
    const axes = AXES_HOME.map(a => a.clone());

    groupRefs.current.forEach((ref) => {
      if (ref) {
        ref.position.set(0, 0, 0);
        ref.rotation.set(0, 0, 0);
        ref.quaternion.identity();
      }
    });

    for (let j = 1; j <= 6; j++) {
      let ang = q_rad[j - 1];
      if (Math.abs(ang) < 1e-5) continue;

      const origin = pivots[j];
      const axis = axes[j];

      for (let link_idx = j; link_idx <= 6; link_idx++) {
        const ref = groupRefs.current[link_idx];
        if (!ref) continue;

        const tempPos = ref.position.clone().sub(origin);
        tempPos.applyAxisAngle(axis, ang);
        ref.position.copy(origin).add(tempPos);

        ref.rotateOnWorldAxis(axis, ang);
      }

      for (let p_idx = j + 1; p_idx <= 6; p_idx++) {
        const offset = pivots[p_idx].clone().sub(origin);
        const newOffset = offset.applyAxisAngle(axis, ang);
        pivots[p_idx].copy(origin).add(newOffset);
        axes[p_idx].applyAxisAngle(axis, ang);
      }
    }

    // Calcular posición del TCP (Tool Center Point)
    // El TCP está en el último pivot (J6) + offset del end effector
    const tcpOffset = 0.065; // 65mm del end effector
    const lastPivot = pivots[6];
    const lastAxis = axes[6]; // Eje X del end effector
    const tcpPosition = lastPivot.clone().add(lastAxis.clone().multiplyScalar(tcpOffset));

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
    <group rotation={[-Math.PI / 2, 0, 0]} position={[-0.2439, 0, 0.200]}>
      {eslabones.map((eslabon, index) => (
        <group
          key={eslabon.id}
          ref={(el: THREE.Group | null) => { groupRefs.current[index] = el; }}
        >
          <STLModel
            url={`/models/${robotFolder}/${eslabon.archivo_stl}`}
            color={eslabon.color}
            scale={scale}
          />
        </group>
      ))}

      {/* Línea de trayectoria gestionada aisladamente por un componente que maneja el componente Line */}
      <TrajectoryLine
        showTrajectory={showTrajectory}
        trajectoryPointsRef={trajectoryPoints}
      />
    </group>
  );
}

function WorkspaceCloud({ points }: { points: number[][] }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (points.length > 0) {
      const vertices = new Float32Array(points.length * 3);
      for (let i = 0; i < points.length; i++) {
        vertices[i * 3] = (points[i][0] / 1000) + DX + 0.070;     // mm a m y offset a base
        vertices[i * 3 + 1] = (points[i][1] / 1000) + DY;         // mm a m y offset a base
        vertices[i * 3 + 2] = points[i][2] / 1000;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.computeBoundingSphere();
    }
    return geo;
  }, [points]);

  return (
    <points rotation={[-Math.PI / 2, 0, 0]} position={[-0.2439, 0, 0.200]} geometry={geometry}>
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
  workspacePoints
}: RobotViewerProps & { showWorkspace: boolean; workspacePoints: number[][] }) {
  const gridSize = robotInfo?.workspace?.grid?.tamaño || 10;
  const gridDivision = robotInfo?.workspace?.grid?.division || 0.1;
  const minDistance = robotInfo?.visualizacion?.camara?.min_distancia || 1;
  const maxDistance = robotInfo?.visualizacion?.camara?.max_distancia || 10;
  const [showPivots, setShowPivots] = useState(false);

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

      {showPivots && PIVOTS_HOME.map((pivot, i) => (
        i > 0 && (
          <group key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-0.2439, 0, 0.200]}>
            <mesh position={[pivot.x, pivot.y, pivot.z]}>
              <sphereGeometry args={[0.03, 16, 16]} />
              <meshBasicMaterial color="#00ff00" />
            </mesh>
          </group>
        )
      ))}

      {showWorkspace && workspacePoints.length > 0 && (
        <WorkspaceCloud points={workspacePoints} />
      )}

      <Suspense fallback={null}>
        <Robot
          jointAngles={jointAngles}
          robotInfo={robotInfo}
          showTrajectory={showTrajectory}
          onTrajectoryToggle={onTrajectoryToggle}
          onClearTrajectory={onClearTrajectory}
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

  const fetchWorkspace = async () => {
    if (workspacePoints.length > 0) return;

    setIsLoadingWorkspace(true);
    try {
      const response = await fetch('http://127.0.0.1:5000/api/robot/workspace');
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
        />
      </Canvas>

      {/* Controles de visualización */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
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
      <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-4 py-3 rounded-xl text-[10px] text-gray-300 border border-white/10 shadow-2xl">
        <div className="font-bold text-cyan-400 mb-2 uppercase tracking-widest border-b border-white/10 pb-1">Atajos</div>
        <div className="space-y-1">
          <div className="flex justify-between gap-4"><span>T</span> <span className="text-gray-500">Trayectoria</span></div>
          <div className="flex justify-between gap-4"><span>C</span> <span className="text-gray-500">Limpiar</span></div>
          <div className="flex justify-between gap-4"><span>P</span> <span className="text-gray-500">Pivots</span></div>
        </div>
      </div>
    </div>
  );
}
