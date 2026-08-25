import React from 'react';
import { 
  Bot, 
  ShieldCheck, 
  Clock, 
  Users, 
  Activity,
  Settings,
  LogOut,
  UserCheck
} from 'lucide-react';
import { SystemHealthStatus } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  health: SystemHealthStatus | null;
  onTriggerQuickRun: () => void;
  isExecuting: boolean;
  currentUser?: string | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  health,
  onTriggerQuickRun,
  isExecuting,
  currentUser,
  onLogout,
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
                  Administrador <span className="text-cyan-400 font-medium">Checadas Docentes</span>
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span>
                  Daemon Activo
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Automatización desatendida y control de horarios en la nube
              </p>
            </div>
          </div>

          {/* Quick Stats & Logged In User / Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-4 text-xs bg-slate-800/80 px-3.5 py-1.5 rounded-lg border border-slate-700/60">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span><strong className="text-white">{health?.activeUsers || 0}</strong> usuarios</span>
              </div>
            </div>

            {currentUser && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <div className="flex flex-col">
                    <span className="font-mono font-medium text-slate-200">{currentUser}</span>
                    <span className="text-[10px] text-slate-400 leading-tight">Coord. Área Clínica</span>
                  </div>
                </div>

                {onLogout && (
                  <button
                    id="btn-logout-header"
                    type="button"
                    onClick={onLogout}
                    title="Cerrar Sesión Maestra"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-rose-950/70 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cerrar Sesión</span>
                  </button>
                )}
              </div>
            )}
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
            id="tab-settings"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'settings' || activeTab === 'firebase' || activeTab === 'github-actions' || activeTab === 'architecture'
                ? 'bg-gradient-to-r from-orange-500/15 via-indigo-500/15 to-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span>Configuración General</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
