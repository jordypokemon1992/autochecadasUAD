import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar, 
  Settings2, 
  Play, 
  CheckCircle2, 
  Sliders, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Sparkles, 
  ArrowDown, 
  Globe, 
  Save, 
  Eye, 
  Layers, 
  MousePointerClick, 
  CheckCheck, 
  Terminal, 
  User, 
  LogOut, 
  Menu, 
  BookOpen, 
  FileText, 
  Lock, 
  HelpCircle, 
  RotateCcw,
  Hourglass,
  Power,
  Zap,
  Radio,
  Timer,
  ChevronRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { AutomationJob, DayOfWeek, WorkflowStep, UserCredential, SystemHealthStatus, UpcomingUserDispatch } from '../types';

interface JobsScheduleViewProps {
  job: AutomationJob;
  users: UserCredential[];
  health: SystemHealthStatus | null;
  onUpdateJob: (updates: Partial<AutomationJob>) => Promise<void>;
  onTriggerRun: (jobId: string, userId?: string) => void;
  isExecuting: boolean;
  onRefreshData?: () => void;
}

const ALL_DAYS: { id: DayOfWeek; label: string; short: string }[] = [
  { id: 'mon', label: 'Lunes', short: 'Lun' },
  { id: 'tue', label: 'Martes', short: 'Mar' },
  { id: 'wed', label: 'Miércoles', short: 'Mié' },
  { id: 'thu', label: 'Jueves', short: 'Jue' },
  { id: 'fri', label: 'Viernes', short: 'Vie' },
  { id: 'sat', label: 'Sábado', short: 'Sáb' },
  { id: 'sun', label: 'Domingo', short: 'Dom' },
];

const DAY_INDEX_MAP: Record<DayOfWeek, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

export const JobsScheduleView: React.FC<JobsScheduleViewProps> = ({
  job,
  users,
  health,
  onUpdateJob,
  onTriggerRun,
  isExecuting,
  onRefreshData,
}) => {
  const [targetUrl, setTargetUrl] = useState(job.targetUrl || 'https://portal.uad.mx/');
  const [jitterMinutes, setJitterMinutes] = useState(job.jitterMinutes ?? 3);
  const [retryCount, setRetryCount] = useState(job.retryCount ?? 3);
  const [steps, setSteps] = useState<WorkflowStep[]>(job.steps || []);
  const [isSaved, setIsSaved] = useState(false);

  // Tab mode for scheduler
  const [schedulerMode, setSchedulerMode] = useState<'upcoming' | 'matrix' | 'steps'>('upcoming');
  const [selectedUserForSimulation, setSelectedUserForSimulation] = useState<string>(users[0]?.id || '');
  const [daemonActive, setDaemonActive] = useState<boolean>(health?.unattendedDaemonEnabled ?? true);
  const [isTogglingDaemon, setIsTogglingDaemon] = useState(false);

  // Live timer tick
  const [nowDate, setNowDate] = useState<Date>(new Date());

  // Portal preview state
  const [showPortalPreview, setShowPortalPreview] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'login' | 'horario'>('login');
  const [selectedPreviewMenu, setSelectedPreviewMenu] = useState<'horario' | 'calificaciones' | 'clases'>('horario');
  const [highlightSelector, setHighlightSelector] = useState<string | null>('button:has(.fa-paw), .btn-login');
  const [isHoveringButton, setIsHoveringButton] = useState(false);

  useEffect(() => {
    if (job) {
      setTargetUrl(job.targetUrl || 'https://portal.uad.mx/');
      setJitterMinutes(job.jitterMinutes ?? 3);
      setRetryCount(job.retryCount ?? 3);
      setSteps(job.steps || []);
    }
  }, [job]);

  useEffect(() => {
    if (health?.unattendedDaemonEnabled !== undefined) {
      setDaemonActive(health.unattendedDaemonEnabled);
    }
  }, [health?.unattendedDaemonEnabled]);

  useEffect(() => {
    if (users.length > 0 && !selectedUserForSimulation) {
      setSelectedUserForSimulation(users[0].id);
    }
  }, [users, selectedUserForSimulation]);

  // Update clock every second for live countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNowDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleDaemon = async () => {
    setIsTogglingDaemon(true);
    try {
      const res = await fetch('/api/scheduler/toggle-daemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !daemonActive }),
      });
      if (res.ok) {
        const data = await res.json();
        setDaemonActive(data.unattendedDaemonEnabled);
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Error toggling daemon:', err);
    } finally {
      setIsTogglingDaemon(false);
    }
  };

  const handleSaveConfig = async () => {
    await onUpdateJob({
      targetUrl,
      jitterMinutes,
      retryCount,
      steps,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const updateStepValue = (index: number, field: keyof WorkflowStep, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const handleRestoreUADDefaults = () => {
    const defaultUADSteps: WorkflowStep[] = [
      {
        id: "step_1",
        name: "Abrir Portal Institucional UAD",
        action: "navigate",
        value: "https://portal.uad.mx/",
        timeoutMs: 15000,
        description: "Navega a https://portal.uad.mx/ con user-agent emulado y espera estado de red listo (networkidle)."
      },
      {
        id: "step_2",
        name: "Ingresar Matrícula / Usuario (#user)",
        action: "input_text",
        targetSelector: "#user, input#user, input[name='_usuario_'], input[placeholder='Usuario'], #txtUsuario, input[type='text']",
        value: "{{USER_CREDENTIAL_USERNAME}}",
        timeoutMs: 8000,
        description: "Inyecta la matrícula específica del docente en <input id='user' name='_usuario_'>."
      },
      {
        id: "step_3",
        name: "Ingresar Contraseña desde Bóveda (#pass)",
        action: "input_password",
        targetSelector: "#pass, input#pass, input[name='_pass_'], input[placeholder='Contraseña'], input[type='password']",
        value: "{{USER_CREDENTIAL_PASSWORD}}",
        timeoutMs: 8000,
        description: "Desencripta de forma segura el secreto AES-256 e inyecta la contraseña en <input id='pass' name='_pass_'>."
      },
      {
        id: "step_4",
        name: "Iniciar Sesión (Botón Huella de Lobo #boton)",
        action: "click_button",
        targetSelector: "#boton, button#boton, button[name='boton'], button:has(.fa-paw), button:has(i.fa-paw), #formulario_inicio button[type='submit']",
        timeoutMs: 10000,
        description: "Hace clic en <button id='boton' name='boton'><i class='fa fa-paw'></i></button> dentro de #formulario_inicio para autenticar."
      },
      {
        id: "step_5",
        name: "Navegar a Menú Lateral 'Horario'",
        action: "click_button",
        targetSelector: "a:has-text('Horario'), .sidebar-menu a[href*='horario'], nav :text('Horario')",
        timeoutMs: 15000,
        description: "Localiza la pestaña 'Horario' en el menú principal lateral y asegura que el panel de horario esté activo."
      },
      {
        id: "step_6",
        name: "Detectar y Presionar Botón 'Checar' (#boton_checar)",
        action: "check_element_condition",
        targetSelector: "#boton_checar, button#boton_checar, button[onclick*='checar'], button:has-text('Checar'), button.btn-success:has-text('Checar'), .btn-success.btn-lg, button:has(.fa-hand-pointer-o), #btnChecar",
        timeoutMs: 12000,
        description: "Comprueba el botón verde <button id='boton_checar' class='btn btn-success btn-lg' onclick='checar()'><i class='fa fa-hand-pointer-o'></i> Checar</button> y ejecuta el clic institucional."
      },
      {
        id: "step_7",
        name: "Verificar Estado '[Checado]' en Tabla y Auditoría",
        action: "screenshot",
        targetSelector: ".badge:has-text('Checado'), :has-text('[Checado]'), tr:has(.btn-success)",
        timeoutMs: 10000,
        description: "Valida la confirmación visual de asistencia con la etiqueta [Checado] y genera la captura criptográfica de auditoría."
      }
    ];
    setSteps(defaultUADSteps);
  };

  // Compute upcoming dispatches dynamically
  const upcomingDispatches: UpcomingUserDispatch[] = React.useMemo(() => {
    const currentDayIdx = nowDate.getDay();
    const currentHours = nowDate.getHours();
    const currentMinutes = nowDate.getMinutes();
    const currentSeconds = nowDate.getSeconds();

    const list: UpcomingUserDispatch[] = [];

    const activeUsersList = users.filter(u => u.active);

    for (const user of activeUsersList) {
      const schedule = user.weeklySchedule || {
        mon: user.scheduledTimes || ['08:00'],
        tue: user.scheduledTimes || ['08:00'],
        wed: user.scheduledTimes || ['08:00'],
        thu: user.scheduledTimes || ['08:00'],
        fri: user.scheduledTimes || ['08:00'],
        sat: [],
        sun: []
      };

      const daysList: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

      for (const d of daysList) {
        const times = schedule[d] || [];
        const dayIdx = DAY_INDEX_MAP[d];

        for (const t of times) {
          const parts = t.split(':').map(Number);
          if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) continue;
          const [h, m] = parts;

          let daysDiff = dayIdx - currentDayIdx;
          if (daysDiff < 0 || (daysDiff === 0 && (h < currentHours || (h === currentHours && m < currentMinutes) || (h === currentHours && m === currentMinutes && currentSeconds > 40)))) {
            daysDiff += 7;
          }

          const targetDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + daysDiff, h, m, 0, 0);
          const secondsRemaining = Math.max(0, Math.floor((targetDate.getTime() - nowDate.getTime()) / 1000));
          const isToday = daysDiff === 0;

          const period = h >= 12 ? 'PM' : 'AM';
          const displayH = h % 12 === 0 ? 12 : h % 12;
          const timeFormatted = `${displayH}:${m < 10 ? '0' + m : m} ${period}`;

          const dayLabelMap: Record<DayOfWeek, string> = {
            mon: 'Lunes',
            tue: 'Martes',
            wed: 'Miércoles',
            thu: 'Jueves',
            fri: 'Viernes',
            sat: 'Sábado',
            sun: 'Domingo'
          };

          list.push({
            userId: user.id,
            userName: user.name,
            userRole: user.roleTag,
            username: user.username,
            day: d,
            dayLabel: dayLabelMap[d],
            time: t,
            timeFormatted,
            estimatedDate: targetDate.toISOString(),
            secondsRemaining,
            isToday
          });
        }
      }
    }

    list.sort((a, b) => a.secondsRemaining - b.secondsRemaining);
    return list;
  }, [users, nowDate]);

  // Calculate total weekly runs across all users
  const totalWeeklyRuns = React.useMemo(() => {
    return users.reduce((acc, u) => {
      if (!u.active) return acc;
      if (u.weeklySchedule) {
        return acc + (Object.keys(u.weeklySchedule) as DayOfWeek[]).reduce((sum, d) => sum + (u.weeklySchedule?.[d]?.length || 0), 0);
      }
      return acc + (u.scheduledTimes?.length || 1) * (u.activeDays?.length || 5);
    }, 0);
  }, [users]);

  // Helper format countdown
  const formatCountdown = (totalSec: number) => {
    if (totalSec <= 0) return '¡Ejecutándose ahora!';
    const days = Math.floor(totalSec / (3600 * 24));
    const hours = Math.floor((totalSec % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const selectedUserObj = users.find(u => u.id === selectedUserForSimulation) || users[0];

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Unattended 24/7 Engine Status & Multi-User Architecture */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
                <Zap className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Programador y Pasos de Flujo Desatendidos
              </h2>
            </div>
            <p className="text-sm text-slate-300">
              Cada flujo se ejecuta <strong>en base a las necesidades y horarios específicos de cada usuario registrado en la bóveda</strong>, 
              garantizando una operación 100% autónoma y desatendida sin depender de un horario general fijo.
            </p>
          </div>

          {/* Unattended Daemon Controller */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleToggleDaemon}
              disabled={isTogglingDaemon}
              className={`px-4 py-2.5 rounded-xl border font-medium text-xs flex items-center gap-2.5 transition-all cursor-pointer shadow-lg ${
                daemonActive
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900 shadow-emerald-950/40'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${daemonActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                  Daemon en Segundo Plano
                </div>
                <div className="font-bold text-white text-xs">
                  {daemonActive ? '24/7 ACTIVO Y DESATENDIDO' : 'PAUSADO MANUALMENTE'}
                </div>
              </div>
              <Power className={`w-4 h-4 ml-1 ${daemonActive ? 'text-emerald-400' : 'text-slate-500'}`} />
            </button>

            <button
              id="btn-save-job-settings"
              onClick={handleSaveConfig}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-md shadow-cyan-950"
            >
              <Save className="w-4 h-4" />
              <span>{isSaved ? '¡Configuración Guardada!' : 'Guardar Parámetros'}</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Usuarios en Bóveda</span>
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {users.filter(u => u.active).length} <span className="text-xs text-slate-500 font-sans font-normal">activos</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Carga Semanal Total</span>
            </div>
            <div className="text-lg font-bold text-emerald-400 font-mono">
              {totalWeeklyRuns} <span className="text-xs text-slate-500 font-sans font-normal">checadas / sem</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 col-span-2 sm:col-span-2">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                <span>Próximo Disparo Desatendido</span>
              </span>
              <span className="text-[11px] font-mono text-amber-300">
                {upcomingDispatches[0] ? formatCountdown(upcomingDispatches[0].secondsRemaining) : '--'}
              </span>
            </div>
            <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
              {upcomingDispatches[0] ? (
                <>
                  <span className="text-amber-400 font-mono font-bold">{upcomingDispatches[0].timeFormatted}</span>
                  <span className="text-slate-400 text-xs">({upcomingDispatches[0].dayLabel})</span>
                  <span>•</span>
                  <span className="text-slate-200 truncate">{upcomingDispatches[0].userName}</span>
                </>
              ) : (
                <span className="text-slate-500 text-xs font-normal">No hay usuarios con horarios activos registrados</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSchedulerMode('upcoming')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              schedulerMode === 'upcoming'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Cola de Disparos Desatendidos ({upcomingDispatches.length})</span>
          </button>

          <button
            onClick={() => setSchedulerMode('matrix')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              schedulerMode === 'matrix'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Horarios por Usuario en Bóveda ({users.length})</span>
          </button>

          <button
            onClick={() => setSchedulerMode('steps')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              schedulerMode === 'steps'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pasos del Flujo Automatizado ({steps.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPortalPreview(!showPortalPreview)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showPortalPreview ? 'Ocultar Simulador Portal' : 'Ver Simulador Portal UAD'}</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: Upcoming Unattended Dispatches Queue */}
      {schedulerMode === 'upcoming' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Cronograma de Disparos Desatendidos en Vivo</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  El orquestador en segundo plano evalúa continuamente el reloj del servidor y ejecuta el flujo para cada usuario en su momento exacto.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] px-2 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800 font-mono">
                  Hora Servidor: {nowDate.toLocaleTimeString()}
                </span>
                {onRefreshData && (
                  <button
                    onClick={onRefreshData}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
                    title="Actualizar estado"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Dispatches List */}
            {upcomingDispatches.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                <p className="text-sm font-medium">No hay checados programados activos</p>
                <p className="text-xs text-slate-500 mt-1">Configura horarios en la Bóveda de Credenciales para los usuarios.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 mt-2">
                {upcomingDispatches.slice(0, 15).map((disp, idx) => (
                  <div 
                    key={`${disp.userId}_${disp.day}_${disp.time}_${idx}`}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-950/40 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-400 shrink-0">
                        {idx + 1}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-white">{disp.userName}</span>
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                            {disp.username}
                          </span>
                          {disp.isToday && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                              HOY
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="text-slate-300 font-medium">{disp.dayLabel}</span>
                          <span>•</span>
                          <span className="text-cyan-300 font-mono font-bold">{disp.timeFormatted}</span>
                          <span>•</span>
                          <span>{disp.userRole}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-mono font-semibold text-amber-300 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                          En {formatCountdown(disp.secondsRemaining)}
                        </span>
                      </div>

                      <button
                        onClick={() => onTriggerRun(job.id, disp.userId)}
                        disabled={isExecuting}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                        title="Probar ejecución desatendida ahora para este usuario"
                      >
                        <Play className="w-3 h-3 fill-current text-cyan-400" />
                        <span className="hidden sm:inline">Probar Ahora</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: Per-User Schedule Breakdown Matrix */}
      {schedulerMode === 'matrix' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>Matriz de Horarios Asignados por Usuario</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cada docente u operario tiene configurados sus horarios de clase específicos. El motor desatendido ejecuta de forma aislada para cada uno.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {users.map((user) => {
                const weekly = user.weeklySchedule;
                const totalRuns = weekly
                  ? (Object.keys(weekly) as DayOfWeek[]).reduce((sum, d) => sum + (weekly[d]?.length || 0), 0)
                  : (user.scheduledTimes?.length || 1) * (user.activeDays?.length || 5);

                return (
                  <div 
                    key={user.id} 
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-400 shrink-0">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white">{user.name}</h4>
                            <span className="text-[11px] font-mono text-slate-400">{user.username}</span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-medium">
                          {totalRuns} / sem
                        </span>
                      </div>

                      {/* Daily Schedule Breakdown */}
                      <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                        {ALL_DAYS.map((day) => {
                          const timesForDay = weekly ? (weekly[day.id] || []) : (user.activeDays?.includes(day.id) ? user.scheduledTimes : []);
                          if (timesForDay.length === 0) return null;
                          const isPaused = (user.pausedDays || []).includes(day.id);

                          return (
                            <div key={day.id} className="flex items-center justify-between text-xs py-0.5">
                              <span className={`font-medium w-20 flex items-center gap-1 ${isPaused ? 'text-rose-400' : 'text-slate-400'}`}>
                                <span>{day.label}:</span>
                                {isPaused && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800">
                                    OFF
                                  </span>
                                )}
                              </span>
                              <div className={`flex flex-wrap gap-1 justify-end flex-1 ${isPaused ? 'opacity-40 grayscale' : ''}`}>
                                {timesForDay.map((t) => (
                                  <span key={t} className={`px-1.5 py-0.2 rounded font-mono text-[11px] ${
                                    isPaused
                                      ? 'bg-slate-950 border border-slate-800 text-slate-500 line-through'
                                      : 'bg-slate-900 border border-slate-700 text-cyan-300'
                                  }`}>
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                        user.lastStatus === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-900 text-slate-400'
                      }`}>
                        {user.lastStatus === 'success' ? 'Verificado hoy' : 'En espera'}
                      </span>

                      <button
                        onClick={() => onTriggerRun(job.id, user.id)}
                        disabled={isExecuting || !user.active}
                        className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ejecutar Flujo</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: Step-by-Step Parameterized Workflow */}
      {schedulerMode === 'steps' && (
        <div className="space-y-6">
          
          {/* User Parameters Simulation Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Inyección Dinámica de Credenciales
                </h4>
                <p className="text-xs text-slate-400">
                  Las variables <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded">{'{{USER_CREDENTIAL_USERNAME}}'}</code> y <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded">{'{{USER_CREDENTIAL_PASSWORD}}'}</code> se resuelven automáticamente para el usuario en turno.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 whitespace-nowrap">Simular con usuario:</label>
              <select
                value={selectedUserForSimulation}
                onChange={(e) => setSelectedUserForSimulation(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden focus:border-cyan-500 font-medium"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Workflow Steps Sequence */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Secuencia Determinística del Flujo UAD (7 Pasos)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  El motor Playwright ejecuta esta secuencia de manera desatendida, navegando, autenticando y presionando el botón 'Checar'.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRestoreUADDefaults}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Restaurar Pasos Oficiales UAD</span>
                </button>
              </div>
            </div>

            {/* Steps Container */}
            <div className="space-y-3">
              {steps.map((step, index) => {
                // Determine simulated value
                let simulatedVal = step.value;
                if (step.value === '{{USER_CREDENTIAL_USERNAME}}') {
                  simulatedVal = selectedUserObj ? selectedUserObj.username : '0705110713';
                } else if (step.value === '{{USER_CREDENTIAL_PASSWORD}}') {
                  simulatedVal = '•••••••••••• (Desencriptada AES-256 en memoria)';
                }

                return (
                  <div
                    key={step.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold text-xs flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{step.name}</span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                              {step.action}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{step.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="text-[11px] font-mono text-slate-400">
                          Timeout: {step.timeoutMs / 1000}s
                        </span>
                      </div>
                    </div>

                    {/* Step Technical Targets & Injected Values */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-900 text-xs">
                      {step.targetSelector && (
                        <div>
                          <span className="text-slate-500 font-medium block mb-0.5">Selector CSS / DOM:</span>
                          <code className="bg-slate-900 text-cyan-300 px-2 py-1 rounded font-mono text-[11px] block truncate border border-slate-800">
                            {step.targetSelector}
                          </code>
                        </div>
                      )}
                      
                      {step.value && (
                        <div>
                          <span className="text-slate-500 font-medium block mb-0.5">Valor / Parámetro Inyectado:</span>
                          <div className="flex items-center gap-2">
                            <code className="bg-slate-900 text-emerald-400 px-2 py-1 rounded font-mono text-[11px] flex-1 truncate border border-slate-800">
                              {simulatedVal}
                            </code>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Global Automation Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Jitter Aleatorio de Disparo</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={jitterMinutes}
                  onChange={(e) => setJitterMinutes(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs"
                />
                <span className="text-xs text-slate-400">± minutos de variación humana</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Evita patrones fijos exactos para emular comportamiento natural en la red.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Reintentos Automáticos</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={retryCount}
                  onChange={(e) => setRetryCount(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs"
                />
                <span className="text-xs text-slate-400">intentos con retardo progresivo</span>
              </div>
              <p className="text-[11px] text-slate-500">
                En caso de intermitencia temporal en el portal institucional UAD.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>URL Objetivo</span>
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs truncate"
              />
              <p className="text-[11px] text-slate-500">
                Punto de entrada institucional UAD.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive UAD Portal Simulated Inspector */}
      {showPortalPreview && (
        <div className="bg-slate-900 border border-cyan-800/80 rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs text-slate-400 font-mono ml-2">Simulador de Navegador Headless • https://portal.uad.mx/</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActivePreviewTab('login')}
                className={`px-2.5 py-1 text-xs rounded font-medium ${activePreviewTab === 'login' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
              >
                1. Login (Huella)
              </button>
              <button
                onClick={() => setActivePreviewTab('horario')}
                className={`px-2.5 py-1 text-xs rounded font-medium ${activePreviewTab === 'horario' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
              >
                2. Horario (Botón Checar)
              </button>
            </div>
          </div>

          <div className="p-6 bg-slate-100 text-slate-900 min-h-[300px] flex items-center justify-center">
            {activePreviewTab === 'login' ? (
              <div className="max-w-md w-full space-y-3">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-red-700 text-white flex items-center justify-center mx-auto text-2xl font-bold shadow-lg shadow-red-900/20">
                    🐾
                  </div>
                  <h3 className="font-bold text-lg text-slate-800">Portal Institucional UAD</h3>
                  <div id="formulario_inicio" className="space-y-3 text-left">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                        input id="user" name="_usuario_"
                      </label>
                      <input
                        type="text"
                        id="user"
                        name="_usuario_"
                        placeholder="Usuario"
                        readOnly
                        value={selectedUserObj ? selectedUserObj.username : '0705110713'}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                        input id="pass" name="_pass_"
                      </label>
                      <input
                        type="password"
                        id="pass"
                        name="_pass_"
                        placeholder="Contraseña"
                        readOnly
                        value="••••••••••••"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      name="boton"
                      id="boton"
                      className="w-full py-2.5 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-lg text-xs shadow flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span className="text-sm">🐾</span>
                      <span>Iniciar Sesión (button#boton)</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] space-y-1.5">
                  <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-cyan-400" />
                    <span>Mapeo DOM 100% Verificado (#formulario_inicio):</span>
                  </div>
                  <div className="text-slate-300 text-[10px] space-y-0.5">
                    <div>• Usuario: <code className="text-cyan-300">#user</code> / <code className="text-cyan-300">[name="_usuario_"]</code></div>
                    <div>• Clave: <code className="text-cyan-300">#pass</code> / <code className="text-cyan-300">[name="_pass_"]</code></div>
                    <div>• Botón: <code className="text-cyan-300">#boton</code> / <code className="text-cyan-300">button[name="boton"]:has(.fa-paw)</code></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-5 rounded-xl shadow-xl max-w-2xl w-full border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Horario y Registro Docente</h3>
                    <p className="text-xs text-slate-500">Docente: {selectedUserObj?.name || 'Dr. Luis Guillermo Solano'}</p>
                  </div>
                  <button
                    type="button"
                    id="boton_checar"
                    className="btn btn-success btn-lg px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-md flex items-center gap-2 animate-pulse cursor-pointer"
                  >
                    <span className="text-sm">👆</span>
                    <span>Checar</span>
                  </button>
                </div>

                <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] space-y-1">
                  <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-emerald-400" />
                    <span>Elemento DOM Detectado en el Portal:</span>
                  </div>
                  <code className="text-emerald-400 block truncate">
                    {'<button class="btn btn-success btn-lg" id="boton_checar" onclick="checar()"><i class="fa fa-hand-pointer-o"></i> Checar</button>'}
                  </code>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>El motor desatendido localiza específicamente <code className="font-mono font-bold bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">#boton_checar</code> y ejecuta el evento <code className="font-mono font-bold bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">onclick="checar()"</code>.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
