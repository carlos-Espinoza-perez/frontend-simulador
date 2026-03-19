import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Singularity {
  tipo: string;
  descripcion: string;
  severidad: string;
  articulaciones: number[];
  recomendacion: string;
}

interface SingularityAnalysisProps {
  analisis: {
    estado_general: string;
    singularidades: {
      estado: string;
      determinante: number;
      numero_condicion: number;
      valores_singulares: number[];
      singularidades: Singularity[];
      manipulabilidad: number;
    };
    limites: {
      en_limites: boolean;
      advertencias: any[];
    };
  } | null;
}

export function SingularityAnalysis({ analisis }: SingularityAnalysisProps) {
  if (!analisis) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-400">
            Análisis de Singularidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500">Cargando análisis...</p>
        </CardContent>
      </Card>
    );
  }

  const { estado_general, singularidades, limites } = analisis;

  const getEstadoIcon = () => {
    switch (estado_general) {
      case 'normal':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'advertencia':
      case 'cerca_singular':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'singular':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getEstadoColor = () => {
    switch (estado_general) {
      case 'normal':
        return 'text-green-500';
      case 'advertencia':
      case 'cerca_singular':
        return 'text-yellow-500';
      case 'singular':
      case 'error':
        return 'text-red-500';
      default:
        return 'text-blue-500';
    }
  };

  const getSeveridadColor = (severidad: string) => {
    switch (severidad) {
      case 'alta':
      case 'critica':
        return 'text-red-400 bg-red-900/20';
      case 'media':
      case 'advertencia':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'baja':
        return 'text-blue-400 bg-blue-900/20';
      default:
        return 'text-gray-400 bg-gray-800';
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
          {getEstadoIcon()}
          Análisis de Singularidades
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Estado general */}
        <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
          <span className="text-xs text-gray-400">Estado:</span>
          <span className={`text-xs font-semibold ${getEstadoColor()}`}>
            {estado_general.toUpperCase()}
          </span>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-gray-800 rounded">
            <div className="text-xs text-gray-400">Manipulabilidad</div>
            <div className="text-sm font-mono text-white">
              {singularidades.manipulabilidad.toExponential(2)}
            </div>
          </div>
          <div className="p-2 bg-gray-800 rounded">
            <div className="text-xs text-gray-400">Condición</div>
            <div className="text-sm font-mono text-white">
              {singularidades.numero_condicion.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Singularidades detectadas */}
        {singularidades.singularidades.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-400">Singularidades Detectadas:</div>
            {singularidades.singularidades.map((sing, index) => (
              <div
                key={index}
                className={`p-2 rounded text-xs ${getSeveridadColor(sing.severidad)}`}
              >
                <div className="font-semibold mb-1">{sing.tipo}</div>
                <div className="text-xs opacity-90 mb-1">{sing.descripcion}</div>
                <div className="text-xs opacity-75">
                  Articulaciones: J{sing.articulaciones.map(j => j + 1).join(', J')}
                </div>
                <div className="text-xs opacity-75 mt-1">
                  💡 {sing.recomendacion}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Advertencias de límites */}
        {limites.advertencias.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-400">Advertencias de Límites:</div>
            {limites.advertencias.map((adv, index) => (
              <div
                key={index}
                className={`p-2 rounded text-xs ${getSeveridadColor(adv.severidad)}`}
              >
                <div className="font-semibold">
                  J{adv.articulacion}: {adv.tipo.replace(/_/g, ' ')}
                </div>
                <div className="text-xs opacity-90">
                  Ángulo: {adv.angulo.toFixed(1)}°
                  {adv.margen && ` (margen: ${adv.margen.toFixed(1)}°)`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Todo OK */}
        {singularidades.singularidades.length === 0 && limites.advertencias.length === 0 && (
          <div className="p-3 bg-green-900/20 border border-green-700 rounded text-center">
            <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <div className="text-xs text-green-400">
              Configuración óptima
            </div>
            <div className="text-xs text-green-500/70">
              Sin singularidades detectadas
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
