import React from 'react';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  Play, 
  ShieldAlert, 
  ExternalLink, 
  ArrowRight,
  Server,
  Zap,
  Lock,
  Globe,
  Sliders,
  Calendar
} from 'lucide-react';
import { UserCredential, AutomationJob, ExecutionRecord, SystemHealthStatus, DayOfWeek } from '../types';

interface DashboardViewProps {
  health: SystemHealthStatus | null;
  users: UserCredential[];
  jobs: AutomationJob[];
  recentExecutions: ExecutionRecord[];
  onTriggerRun: (jobId: string, userId?: string) => void;
  onNavigateToTab: (tab: string) => void;
  isExecuting: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  health,
  users,
  jobs,
  recentExecutions,
  onTriggerRun,
  onNavigateToTab,
  isExecuting,
}) => {
  const primaryJob = jobs[0];
  const activeUsers = users.filter(u => u.active);

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {/* Card 1: Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Usuarios en Bóveda</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-white">{users.length}</span>
              <span className="text-xs text-emerald-400 font-medium">({activeUsers.length} activos)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Sincronizados en vivo con Firebase Firestore</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Cloud Runner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Orquestador Cloud</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-cyan-300">Playwright</span>
              <span className="text-xs text-emerald-400 font-medium">Online</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Headless Chromium Worker desatendido</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
            <Server className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: User Accounts Status & Step Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Registered Accounts with Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-base">Usuarios y Horarios Asignados</h3>
                <p className="text-xs text-slate-400">
                  Cada usuario tiene sus credenciales aisladas y reglas de ejecución independientes.
                </p>
              </div>
              <button
                onClick={() => onNavigateToTab('users')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
              >
                <span>Administrar Bóveda</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-800 mt-3">
              {users.map((user) => {
                const weekly = user.weeklySchedule;
                const daysWithTimes = weekly 
                  ? (Object.keys(weekly) as DayOfWeek[]).filter(d => (weekly[d]?.length || 0) > 0)
                  : (user.activeDays || ['mon', 'tue', 'wed', 'thu', 'fri']);
                const totalWeeklyRuns = weekly
                  ? Object.keys(weekly).reduce((sum, d) => sum + (weekly[d as DayOfWeek]?.length || 0), 0)
                  : (user.scheduledTimes?.length || 1) * daysWithTimes.length;

                return (
                  <div key={user.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold text-sm shrink-0 mt-0.5">
                        {user.name.charAt(0)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm text-white">{user.name}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                            {user.username}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-medium">
                            {totalWeeklyRuns} checadas / sem
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="text-slate-300">{user.roleTag}</span>
                          <span>•</span>
                          <span className="text-slate-400">{user.notes || 'Horarios variables por día'}</span>
                        </div>

                        {/* Daily badges preview */}
                        {weekly && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as DayOfWeek[]).map((d) => {
                              const dayLabels: Record<DayOfWeek, string> = { mon: 'L', tue: 'M', wed: 'X', thu: 'J', fri: 'V', sat: 'S', sun: 'D' };
                              const count = weekly[d]?.length || 0;
                              if (count === 0) return null;
                              return (
                                <span
                                  key={d}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-950 text-[10px] font-mono text-cyan-300 border border-slate-800"
                                  title={`${dayLabels[d]}: ${weekly[d]?.join(', ')}`}
                                >
                                  <span className="font-bold text-slate-400">{dayLabels[d]}:</span>
                                  <span>{count}h</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          user.lastStatus === 'success' 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80' 
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {user.lastStatus === 'success' ? 'Verificado hoy' : 'Pendiente'}
                        </span>
                      </div>

                      <button
                        id={`btn-run-user-${user.id}`}
                        onClick={() => primaryJob && onTriggerRun(primaryJob.id, user.id)}
                        disabled={isExecuting || !user.active}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current text-cyan-400" />
                        <span>Ejecutar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workflow Steps Preview Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-white text-sm">Flujo de Automatización Configurado</h3>
              </div>
              <button
                onClick={() => onNavigateToTab('schedules')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Editar Pasos
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Fase 1: Acceso</span>
                <p className="text-xs font-medium text-slate-200 mt-1">Conexión & Autenticación</p>
                <p className="text-[11px] text-slate-400 mt-1">Carga portal, inyecta credenciales y envía credenciales encriptadas.</p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Fase 2: Verificación</span>
                <p className="text-xs font-medium text-slate-200 mt-1">Inspección de Horario</p>
                <p className="text-[11px] text-slate-400 mt-1">Valida DOM, busca contenedor de Horario y comprueba si el botón está activo.</p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Fase 3: Ejecución</span>
                <p className="text-xs font-medium text-slate-200 mt-1">Registro & Auditoría</p>
                <p className="text-[11px] text-slate-400 mt-1">Efectúa el clic de confirmación, captura evidencia y almacena logs.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Architecture Quick Glance */}
        <div className="space-y-4">
          {/* Architecture Summary Box */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Garantía de Operación 24/7</span>
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              El sistema orquestador opera en segundo plano mediante un worker headless automatizado, garantizando ejecución desatendida y sincronizada en la nube con Firebase.
            </p>

            <div className="space-y-2 mt-4 text-xs">
              <div className="flex items-center gap-2 text-slate-300 bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Base de Datos con credenciales cifradas</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Headless Chromium con emulación de navegador</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Programador en la nube con reintentos automáticos</span>
              </div>
            </div>

            <button
              onClick={() => onNavigateToTab('architecture')}
              className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Ver Diagrama & Scripts de Despliegue</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
