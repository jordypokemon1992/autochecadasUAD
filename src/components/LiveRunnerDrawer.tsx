import React from 'react';
import { 
  Bot, 
  CheckCircle2, 
  XCircle, 
  Terminal, 
  X, 
  Clock, 
  ShieldCheck,
  ChevronRight,
  Globe
} from 'lucide-react';
import { ExecutionRecord } from '../types';

interface LiveRunnerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentExecutions: ExecutionRecord[];
  isExecuting: boolean;
}

export const LiveRunnerDrawer: React.FC<LiveRunnerDrawerProps> = ({
  isOpen,
  onClose,
  currentExecutions,
  isExecuting,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">
                  Consola de Ejecución en Vivo (Headless Runner)
                </h3>
                {isExecuting && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                    Procesando...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Simulador de ejecución desatendida con navegador virtual y validación DOM
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {currentExecutions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-medium text-slate-300">Inicializando worker en la nube...</p>
              <p className="text-[11px] text-slate-500">Conectando con https://portal.uad.mx/ y cargando credenciales.</p>
            </div>
          ) : (
            currentExecutions.map((exec, eIdx) => (
              <div key={exec.id || eIdx} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                {/* User Exec Header */}
                <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="font-bold text-white text-xs">{exec.userName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({exec.userEmail})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    exec.status === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-300'
                  }`}>
                    {exec.status.toUpperCase()}
                  </span>
                </div>

                {/* Steps Timeline */}
                <div className="p-4 space-y-2.5 font-mono text-[11px]">
                  {exec.logs.map((log, lIdx) => (
                    <div key={lIdx} className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-0.5 font-sans">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200 text-xs">{log.stepName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{log.durationMs}ms</span>
                        </div>
                        <p className="text-slate-400 text-xs">{log.message}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final summary */}
                <div className="px-4 py-2.5 bg-slate-900/40 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Total: <strong className="text-white">{exec.totalDurationMs} ms</strong></span>
                  <span className="text-emerald-400 font-medium">✓ Flujo verificado exitosamente</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {isExecuting ? 'Ejecución en curso...' : 'Proceso finalizado'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium text-xs transition-colors"
          >
            Aceptar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
