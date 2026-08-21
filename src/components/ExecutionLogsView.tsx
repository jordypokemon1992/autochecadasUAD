import React, { useState } from 'react';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Terminal, 
  Trash2, 
  Download, 
  Filter, 
  ChevronRight,
  ShieldCheck,
  Search,
  RefreshCw,
  Eye
} from 'lucide-react';
import { ExecutionRecord, ExecutionLogEntry, UserCredential } from '../types';

interface ExecutionLogsViewProps {
  executions: ExecutionRecord[];
  users: UserCredential[];
  onClearHistory: () => Promise<void>;
  onRefreshLogs: () => Promise<void>;
  onTriggerRun: (jobId: string, userId?: string) => void;
  isExecuting: boolean;
}

export const ExecutionLogsView: React.FC<ExecutionLogsViewProps> = ({
  executions,
  users,
  onClearHistory,
  onRefreshLogs,
  onTriggerRun,
  isExecuting,
}) => {
  const [selectedExec, setSelectedExec] = useState<ExecutionRecord | null>(null);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filtered = executions.filter(exec => {
    if (filterUser !== 'all' && exec.userId !== filterUser) return false;
    if (filterStatus !== 'all' && exec.status !== filterStatus) return false;
    if (searchTerm) {
      const matchName = exec.userName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMsg = exec.summaryMessage.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchName && !matchMsg) return false;
    }
    return true;
  });

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(executions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cloudflow_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Bitácora de Auditoría y Registro de Ejecuciones
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800/80 rounded">
              Auditoría Criptográfica
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Historial detallado de todas las ejecuciones desatendidas y manuales. Cada registro almacena los tiempos de respuesta, verificaciones del DOM y confirmaciones del botón de checado.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRefreshLogs}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition-colors"
            title="Recargar bitácora"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={exportToJson}
            disabled={executions.length === 0}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar JSON</span>
          </button>

          <button
            onClick={onClearHistory}
            disabled={executions.length === 0}
            className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-950/80 text-rose-400 border border-rose-900/60 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpiar Historial</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por usuario o mensaje..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
          />
        </div>

        {/* User filter */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">Usuario:</span>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-full md:w-auto px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden focus:border-cyan-500"
          >
            <option value="all">Todos los usuarios ({users.length})</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">Estado:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full md:w-auto px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden focus:border-cyan-500"
          >
            <option value="all">Todos los estados</option>
            <option value="success">Exitoso (Success)</option>
            <option value="failed">Fallido (Failed)</option>
            <option value="running">En ejecución (Running)</option>
          </select>
        </div>
      </div>

      {/* Main Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-sm text-white">
              Registros Almacenados ({filtered.length})
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Haga clic en cualquier fila para inspeccionar los pasos y telemetría
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-300">No hay registros de ejecución que coincidan</p>
            <p className="text-xs text-slate-500 mt-1">Presione 'Probar Ejecución' para disparar el flujo de prueba.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map((exec) => (
              <div
                key={exec.id}
                onClick={() => setSelectedExec(exec)}
                className="p-4 hover:bg-slate-800/40 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start md:items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    exec.status === 'success' ? 'bg-emerald-950 border border-emerald-800 text-emerald-400' : 'bg-rose-950 border border-rose-800 text-rose-400'
                  }`}>
                    {exec.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{exec.userName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {exec.triggerType === 'scheduled_cron' ? 'Cron Programado' : 'Prueba Manual'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">{exec.summaryMessage}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 text-xs text-slate-400 shrink-0">
                  <div className="text-right">
                    <span className="text-slate-300 font-mono text-[11px] block">
                      {new Date(exec.startedAt).toLocaleDateString()} {new Date(exec.startedAt).toLocaleTimeString()}
                    </span>
                    <span className="text-[10px] text-slate-500">{exec.totalDurationMs} ms • {exec.logs.length} pasos</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedExec(exec);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs"
                    title="Ver detalle"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Execution Detail Modal / Drawer */}
      {selectedExec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${
                  selectedExec.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'
                }`} />
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Detalle de Ejecución: {selectedExec.userName}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {selectedExec.id}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedExec(null)}
                className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded text-xs"
              >
                Cerrar
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
              {/* Summary banner */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Estado general:</span>
                  <span className={`font-semibold ${selectedExec.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedExec.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duración total:</span>
                  <span className="text-white font-mono">{selectedExec.totalDurationMs} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Disparador:</span>
                  <span className="text-cyan-300 font-mono">{selectedExec.triggerType}</span>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-slate-300">
                  {selectedExec.summaryMessage}
                </div>
              </div>

              {/* Steps timeline breakdown */}
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider">
                Desglose de Pasos del Script Headless:
              </h4>

              <div className="space-y-2">
                {selectedExec.logs.map((log, index) => (
                  <div key={index} className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 font-bold text-[10px] flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="font-bold text-white font-sans text-xs">{log.stepName}</span>
                      </div>
                      <span className="text-slate-500 text-[10px]">{log.durationMs} ms</span>
                    </div>
                    <p className="text-slate-300 pl-7 text-[11px] font-sans">{log.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
