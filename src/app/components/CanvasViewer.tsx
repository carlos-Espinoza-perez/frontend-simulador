import { RobotViewer3D } from "./RobotViewer3D";

interface CanvasViewerProps {
  jointAngles?: number[];
  robotInfo?: {
    archivos_stl: string[];
    ruta_stl: string;
  } | null;
}

export function CanvasViewer({ jointAngles = [0, 0, 0, 0, 0, 0], robotInfo }: CanvasViewerProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {}
      <div className="relative w-[80%] h-[80%] bg-gradient-to-b from-[#0f1419] to-[#0a0e14] border border-white/10 rounded-lg overflow-hidden">
        <RobotViewer3D jointAngles={jointAngles} robotInfo={robotInfo} />

        {}
        {!robotInfo && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 text-yellow-300 text-sm max-w-md text-center">
            <p className="font-bold mb-2">⚠️ Archivos STL no disponibles</p>
            <p className="text-xs">
              Ejecuta el script para copiar los archivos:<br/>
              <code className="bg-black/30 px-2 py-1 rounded mt-2 inline-block">
                .\scripts\copy-models-from-backend.ps1
              </code>
            </p>
          </div>
        )}

        {}
        <div className="absolute top-4 left-4 text-xs text-gray-400 space-y-1 bg-black/50 p-2 rounded backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-red-500" />
            <span>X</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-3 bg-green-500" />
            <span>Y</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 bg-blue-500 rounded-full" />
            <span>Z</span>
          </div>
        </div>
      </div>
    </div>
  );
}
