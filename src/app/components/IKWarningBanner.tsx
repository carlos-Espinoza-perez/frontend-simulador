import { AlertTriangle, X, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface IKWarningBannerProps {
  message: string;
  type?: 'error' | 'warning';
  onClose: () => void;
  autoHideDuration?: number;
}

export function IKWarningBanner({ message, type = 'error', onClose, autoHideDuration = 5000 }: IKWarningBannerProps) {
  const [progress, setProgress] = useState(100);

  const isError = type === 'error';
  const colorClass = isError ? 'yellow' : 'orange';
  const bgColor = isError ? 'bg-yellow-500/20' : 'bg-orange-500/20';
  const borderColor = isError ? 'border-yellow-500' : 'border-orange-500';
  const textColor = isError ? 'text-yellow-400' : 'text-orange-400';
  const textColorLight = isError ? 'text-yellow-300' : 'text-orange-300';
  const iconBg = isError ? 'bg-yellow-500' : 'bg-orange-500';
  const progressBg = isError ? 'bg-yellow-500' : 'bg-orange-500';
  const shadowColor = isError ? 'shadow-yellow-500/30' : 'shadow-orange-500/30';

  useEffect(() => {
    if (autoHideDuration > 0) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - (100 / (autoHideDuration / 100));
          if (newProgress <= 0) {
            clearInterval(interval);
            onClose();
            return 0;
          }
          return newProgress;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [autoHideDuration, onClose]);

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
      <div className={`${bgColor} backdrop-blur-xl border-2 ${borderColor} rounded-xl shadow-2xl ${shadowColor} overflow-hidden min-w-[500px]`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 ${iconBg} rounded-full flex items-center justify-center flex-shrink-0`}>
              {isError ? (
                <AlertTriangle className="w-5 h-5 text-white" />
              ) : (
                <AlertCircle className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1">
              <div className={`text-lg font-bold ${textColor} mb-1 uppercase tracking-wider`}>
                {isError ? 'Advertencia de Cinemática Inversa' : 'Advertencia de Singularidad'}
              </div>
              <div className={`text-sm ${textColorLight} font-mono`}>
                {message}
              </div>
            </div>
            <button
              onClick={onClose}
              className={`${textColor} hover:${textColorLight} transition-colors p-1 hover:${bgColor} rounded`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Progress bar */}
        {autoHideDuration > 0 && (
          <div className={`h-1 ${isError ? 'bg-yellow-900/30' : 'bg-orange-900/30'}`}>
            <div
              className={`h-full ${progressBg} transition-all duration-100 ease-linear`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
