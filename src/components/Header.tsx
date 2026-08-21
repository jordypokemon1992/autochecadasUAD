import React from 'react';
import { 
  Bot, 
  ShieldCheck, 
  Clock, 
  Users, 
  History, 
  Cloud, 
  Play, 
  Activity,
  Layers,
  Database,
  Github
} from 'lucide-react';
import { SystemHealthStatus } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  health: SystemHealthStatus | null;
  onTriggerQuickRun: () => void;
  isExecuting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  health,
  onTriggerQuickRun,
  isExecuting,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight">
                  CloudFlow <span className="text-cyan-400 font-medium">Orchestrator</span>
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span>
                  Daemon Activo
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Automatización desatendida y programación en la nube
              </p>
            </div>
          </div>

          {/* Quick Stats & Action */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-4 text-xs bg-slate-800/80 px-3.5 py-1.5 rounded-lg border border-slate-700/60">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span><strong className="text-white">{health?.activeUsers || 0}</strong> usuarios</span>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Próxima: <strong className="text-white">08:00 AM</strong></span>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-1.5 text-slate-300">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Éxito: <strong className="text-white">{health?.successRateLast24h || 100}%</strong></span>
              </div>
            </div>

            <button
              id="btn-quick-run"
              onClick={onTriggerQuickRun}
              disabled={isExecuting}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shadow-md transition-all ${
                isExecuting
                  ? 'bg-amber-600 cursor-not-allowed opacity-90'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 shadow-cyan-600/20'
              }`}
            >
              {isExecuting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Ejecutando...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Probar Ejecución</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60">
          <button
            id="tab-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Panel de Control</span>
          </button>

          <button
            id="tab-users"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'users'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Bóveda de Credenciales</span>
          </button>

          <button
            id="tab-schedules"
            onClick={() => setActiveTab('schedules')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'schedules'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Programador & Pasos del Flujo</span>
          </button>

          <button
            id="tab-logs"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'logs'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial y Bitácora</span>
          </button>

          <button
            id="tab-firebase"
            onClick={() => setActiveTab('firebase')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'firebase'
                ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-orange-400" />
            <span>Vinculación Firebase</span>
          </button>

          <button
            id="tab-github-actions"
            onClick={() => setActiveTab('github-actions')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'github-actions'
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Github className="w-3.5 h-3.5 text-indigo-400" />
            <span>GitHub Actions Backend</span>
          </button>

          <button
            id="tab-architecture"
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'architecture'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Arquitectura 3 Componentes & Despliegue</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
