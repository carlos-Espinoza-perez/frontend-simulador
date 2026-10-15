import { RobotViewer3D, RobotViewerProps } from "./RobotViewer3D";

export function CanvasViewer({
  jointAngles = [0, 0, 0, 0, 0, 0],
  robotInfo,
  ...viewerProps
}: RobotViewerProps) {
  return (
    <div className="relative w-full h-full bg-gradient-to-b from-[#0d1218] to-[#080b10] overflow-hidden">
      <RobotViewer3D
        jointAngles={jointAngles}
        robotInfo={robotInfo}
        {...viewerProps}
      />

      {!robotInfo && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 text-yellow-300 text-sm max-w-md text-center z-20">
          <p className="font-bold mb-2">⚠️ Archivos STL no disponibles</p>
          <p className="text-xs">
            Ejecuta el script para copiar los archivos:<br />
            <code className="bg-black/30 px-2 py-1 rounded mt-2 inline-block">
              .\scripts\copy-models-from-backend.ps1
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
