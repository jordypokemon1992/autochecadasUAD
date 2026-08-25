import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  Edit3, 
  Play, 
  Check, 
  X, 
  Lock, 
  Eye, 
  EyeOff, 
  Info,
  Calendar,
  Clock,
  Plus,
  Zap,
  Copy,
  CalendarDays,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Sliders,
  HardDrive,
  Database,
  Cloud,
  RefreshCw,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { UserCredential, DayOfWeek, WeeklyDaySchedule } from '../types';
import { 
  getSavedFirebaseConfig, 
  initFirebase, 
  syncUsersToFirestore, 
  fetchUsersFromFirestore 
} from '../lib/firebase';

interface UsersVaultViewProps {
  users: UserCredential[];
  onAddUser: (user: Partial<UserCredential> & { password?: string }) => Promise<void>;
  onUpdateUser: (id: string, updates: Partial<UserCredential> & { password?: string }) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onTriggerRun: (jobId: string, userId: string) => void;
  isExecuting: boolean;
  onRefreshData?: () => Promise<void>;
}

const ALL_DAYS: { id: DayOfWeek; label: string; short: string; full: string }[] = [
  { id: 'mon', label: 'Lun', short: 'L', full: 'Lunes' },
  { id: 'tue', label: 'Mar', short: 'M', full: 'Martes' },
  { id: 'wed', label: 'Mié', short: 'X', full: 'Miércoles' },
  { id: 'thu', label: 'Jue', short: 'J', full: 'Jueves' },
  { id: 'fri', label: 'Vie', short: 'V', full: 'Viernes' },
  { id: 'sat', label: 'Sáb', short: 'S', full: 'Sábado' },
  { id: 'sun', label: 'Dom', short: 'D', full: 'Domingo' },
];

const DEFAULT_WEEKLY_SCHEDULE: WeeklyDaySchedule = {
  mon: ['08:00', '09:45', '12:45'],
  tue: ['07:00', '08:45', '13:45', '16:45'],
  wed: ['08:00', '12:45', '14:45'],
  thu: ['09:45', '13:45', '16:45'],
  fri: ['08:00', '09:45', '12:45', '13:45', '14:45', '16:45'],
  sat: [],
  sun: []
};

export const UsersVaultView: React.FC<UsersVaultViewProps> = ({
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onTriggerRun,
  isExecuting,
  onRefreshData,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [dayFilter, setDayFilter] = useState<'all' | DayOfWeek>('all');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [toggleDayLoadingUser, setToggleDayLoadingUser] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Firebase Push & Pull handlers duplicated in Vault
  const handlePushToFirebase = async () => {
    const saved = getSavedFirebaseConfig();
    if (!saved || !saved.apiKey || !saved.projectId) {
      setSyncStatus('error');
      setSyncMessage('Configuración de Firebase no encontrada. Ve a la pestaña Configuración General (Vinculación Firebase) para conectar tu proyecto.');
      return;
    }

    setSyncStatus('syncing');
    setSyncMessage('Subiendo docentes y horarios locales hacia Firestore...');
    try {
      const { db } = initFirebase(saved);
      await syncUsersToFirestore(db, users);
      setSyncStatus('success');
      setSyncMessage(`¡Sincronización exitosa! ${users.length} docentes subidos a Firestore.`);
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 5000);
    } catch (err: any) {
      console.error('Error al subir a Firestore:', err);
      setSyncStatus('error');
      setSyncMessage(`Error al subir a Firestore: ${err.message || 'Error desconocido'}`);
    }
  };

  const handlePullFromFirebase = async () => {
    const saved = getSavedFirebaseConfig();
    if (!saved || !saved.apiKey || !saved.projectId) {
      setSyncStatus('error');
      setSyncMessage('Configuración de Firebase no encontrada. Ve a la pestaña Configuración General (Vinculación Firebase) para conectar tu proyecto.');
      return;
    }

    setSyncStatus('syncing');
    setSyncMessage('Descargando docentes desde Firestore...');
    try {
      const { db } = initFirebase(saved);
      const remoteUsers = await fetchUsersFromFirestore(db);

      const res = await fetch('/api/users/sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: remoteUsers, mode: 'merge' })
      });

      if (!res.ok) {
        throw new Error('Error al sincronizar en el servidor local.');
      }

      if (onRefreshData) {
        await onRefreshData();
      }

      setSyncStatus('success');
      setSyncMessage(`¡Descarga completada! ${remoteUsers.length} docentes sincronizados desde Firestore.`);
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 5000);
    } catch (err: any) {
      console.error('Error al descargar de Firestore:', err);
      setSyncStatus('error');
      setSyncMessage(`Error al descargar de Firestore: ${err.message || 'Error desconocido'}`);
    }
  };

  // Toggle day active/inactive (ON / OFF) directly from teacher card
  const handleToggleDayForUser = async (user: UserCredential, day: DayOfWeek) => {
    setToggleDayLoadingUser(`${user.id}_${day}`);
    try {
      const paused = user.pausedDays || [];
      const isCurrentlyPaused = paused.includes(day);

      let newPausedDays: DayOfWeek[];
      if (isCurrentlyPaused) {
        // Turn ON -> remove from pausedDays
        newPausedDays = paused.filter(d => d !== day);
      } else {
        // Turn OFF -> add to pausedDays
        newPausedDays = [...paused, day];
      }

      await onUpdateUser(user.id, {
        pausedDays: newPausedDays
      });
    } catch (err) {
      console.error('Error toggling day state:', err);
    } finally {
      setToggleDayLoadingUser(null);
    }
  };

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [formRoleTag, setFormRoleTag] = useState('Docente Titular');
  const [formNotes, setFormNotes] = useState('');
  const [formActive, setFormActive] = useState(true);
  
  // Per-Day Independent Schedule State
  const [formWeeklySchedule, setFormWeeklySchedule] = useState<WeeklyDaySchedule>({ ...DEFAULT_WEEKLY_SCHEDULE });
  const [activeDayTab, setActiveDayTab] = useState<DayOfWeek>('mon');
  const [dayTimeInput, setDayTimeInput] = useState('08:00');
  const [copySuccessMsg, setCopySuccessMsg] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingUserId(null);
    setFormName('');
    setFormEmail('');
    setFormUsername('');
    setFormPassword('');
    setShowModalPassword(false);
    setFormRoleTag('Docente Titular');
    setFormNotes('Horario con horas variables por día');
    setFormActive(true);
    setFormWeeklySchedule({
      mon: ['08:00', '09:45', '12:45'],
      tue: ['07:00', '08:45', '13:45', '16:45'],
      wed: ['08:00', '12:45', '14:45'],
      thu: ['09:45', '13:45', '16:45'],
      fri: ['08:00', '09:45', '12:45', '13:45', '14:45', '16:45'],
      sat: [],
      sun: []
    });
    setActiveDayTab('mon');
    setDayTimeInput('08:00');
    setCopySuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserCredential) => {
    setEditingUserId(user.id);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormUsername(user.username);
    // Populate clean password if it is not a raw hash
    const cleanPwd = user.password || (user.passwordEncrypted && !user.passwordEncrypted.startsWith('enc_aes256_') ? user.passwordEncrypted : '');
    setFormPassword(cleanPwd);
    setShowModalPassword(false);
    setFormRoleTag(user.roleTag);
    setFormNotes(user.notes || '');
    setFormActive(user.active);
    
    // Populate weekly schedule: use user's weeklySchedule if present, or reconstruct from scheduledTimes + activeDays
    if (user.weeklySchedule && Object.keys(user.weeklySchedule).length > 0) {
      const normalized: WeeklyDaySchedule = {
        mon: user.weeklySchedule.mon ? [...user.weeklySchedule.mon].sort() : [],
        tue: user.weeklySchedule.tue ? [...user.weeklySchedule.tue].sort() : [],
        wed: user.weeklySchedule.wed ? [...user.weeklySchedule.wed].sort() : [],
        thu: user.weeklySchedule.thu ? [...user.weeklySchedule.thu].sort() : [],
        fri: user.weeklySchedule.fri ? [...user.weeklySchedule.fri].sort() : [],
        sat: user.weeklySchedule.sat ? [...user.weeklySchedule.sat].sort() : [],
        sun: user.weeklySchedule.sun ? [...user.weeklySchedule.sun].sort() : [],
      };
      setFormWeeklySchedule(normalized);
    } else {
      // Fallback from legacy scheduledTimes
      const fallbackTimes = user.scheduledTimes && user.scheduledTimes.length > 0
        ? user.scheduledTimes
        : ['08:00', '09:45', '12:45', '13:45', '14:45', '16:45'];
      const activeDays = user.activeDays || ['mon', 'tue', 'wed', 'thu', 'fri'];
      
      const reconstructed: WeeklyDaySchedule = {
        mon: activeDays.includes('mon') ? [...fallbackTimes] : [],
        tue: activeDays.includes('tue') ? [...fallbackTimes] : [],
        wed: activeDays.includes('wed') ? [...fallbackTimes] : [],
        thu: activeDays.includes('thu') ? [...fallbackTimes] : [],
        fri: activeDays.includes('fri') ? [...fallbackTimes] : [],
        sat: activeDays.includes('sat') ? [...fallbackTimes] : [],
        sun: activeDays.includes('sun') ? [...fallbackTimes] : [],
      };
      setFormWeeklySchedule(reconstructed);
    }

    setActiveDayTab('mon');
    setDayTimeInput('08:00');
    setCopySuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleAddTimeForCurrentDay = () => {
    if (!dayTimeInput) return;
    const currentTimes = formWeeklySchedule[activeDayTab] || [];
    if (!currentTimes.includes(dayTimeInput)) {
      const updated = [...currentTimes, dayTimeInput].sort();
      setFormWeeklySchedule(prev => ({
        ...prev,
        [activeDayTab]: updated
      }));
    }
  };

  const handleRemoveTimeFromCurrentDay = (timeToRemove: string) => {
    const currentTimes = formWeeklySchedule[activeDayTab] || [];
    setFormWeeklySchedule(prev => ({
      ...prev,
      [activeDayTab]: currentTimes.filter(t => t !== timeToRemove)
    }));
  };

  const handleClearCurrentDay = () => {
    setFormWeeklySchedule(prev => ({
      ...prev,
      [activeDayTab]: []
    }));
  };

  const handleApplyPresetToCurrentDay = (preset: 'uad_full' | 'morning' | 'afternoon' | 'bi_turn') => {
    let times: string[] = [];
    if (preset === 'uad_full') {
      times = ['08:00', '09:45', '12:45', '13:45', '14:45', '16:45'];
    } else if (preset === 'morning') {
      times = ['07:00', '08:00', '09:45', '11:00'];
    } else if (preset === 'afternoon') {
      times = ['12:45', '13:45', '14:45', '16:45', '18:00'];
    } else if (preset === 'bi_turn') {
      times = ['08:00', '14:00'];
    }

    setFormWeeklySchedule(prev => ({
      ...prev,
      [activeDayTab]: times
    }));
  };

  const handleCopyDayToWeekdays = () => {
    const currentTimes = formWeeklySchedule[activeDayTab] || [];
    setFormWeeklySchedule(prev => ({
      ...prev,
      mon: [...currentTimes],
      tue: [...currentTimes],
      wed: [...currentTimes],
      thu: [...currentTimes],
      fri: [...currentTimes]
    }));
    
    setCopySuccessMsg(`Horario de ${ALL_DAYS.find(d => d.id === activeDayTab)?.full} copiado a Lunes - Viernes`);
    setTimeout(() => setCopySuccessMsg(null), 3000);
  };

  const handleCopyDayToSpecific = (targetDay: DayOfWeek) => {
    const currentTimes = formWeeklySchedule[activeDayTab] || [];
    setFormWeeklySchedule(prev => ({
      ...prev,
      [targetDay]: [...currentTimes]
    }));
    
    const sourceLabel = ALL_DAYS.find(d => d.id === activeDayTab)?.full;
    const targetLabel = ALL_DAYS.find(d => d.id === targetDay)?.full;
    setCopySuccessMsg(`Horario copiado de ${sourceLabel} a ${targetLabel}`);
    setTimeout(() => setCopySuccessMsg(null), 3000);
  };

  const calculateTotalWeeklyCheckins = (schedule: Partial<Record<DayOfWeek, string[]>> | undefined) => {
    if (!schedule) return 0;
    return Object.values(schedule).reduce((acc, times) => acc + (times ? times.length : 0), 0);
  };

  const getActiveDaysList = (schedule: Partial<Record<DayOfWeek, string[]>> | undefined): DayOfWeek[] => {
    if (!schedule) return [];
    return (Object.keys(schedule) as DayOfWeek[]).filter(day => (schedule[day]?.length || 0) > 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim()) return;

    // Determine active days based on which days have >= 1 time
    const computedActiveDays = getActiveDaysList(formWeeklySchedule);
    // Determine combined unique times for legacy backward-compatibility
    const allUniqueTimes = Array.from(new Set(Object.values(formWeeklySchedule).flat())).sort();
    const fallbackTimes = allUniqueTimes.length > 0 ? allUniqueTimes : ['08:00'];

    if (editingUserId) {
      await onUpdateUser(editingUserId, {
        name: formName,
        email: formEmail,
        username: formUsername,
        password: formPassword || undefined,
        roleTag: formRoleTag,
        notes: formNotes,
        active: formActive,
        weeklySchedule: formWeeklySchedule,
        scheduledTimes: fallbackTimes,
        activeDays: computedActiveDays,
      });
    } else {
      await onAddUser({
        name: formName,
        email: formEmail || `${formUsername}@institucion.edu`,
        username: formUsername,
        password: formPassword || 'temp_secret_pwd',
        roleTag: formRoleTag,
        notes: formNotes,
        active: formActive,
        weeklySchedule: formWeeklySchedule,
        scheduledTimes: fallbackTimes,
        activeDays: computedActiveDays,
      });
    }

    setIsModalOpen(false);
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [dedupMessage, setDedupMessage] = useState<string | null>(null);

  // Safeguard: Deduplicate users by username (matrícula) and ID in memory to ensure pristine UI
  const uniqueUsers = React.useMemo(() => {
    const map = new Map<string, UserCredential>();
    for (const u of users) {
      const key = (u.username || u.id).trim();
      if (!map.has(key)) {
        map.set(key, u);
      } else {
        const prev = map.get(key)!;
        map.set(key, {
          ...prev,
          ...u,
          id: prev.id || u.id,
          weeklySchedule: u.weeklySchedule || prev.weeklySchedule,
          scheduledTimes: u.scheduledTimes || prev.scheduledTimes,
          activeDays: u.activeDays || prev.activeDays,
        });
      }
    }
    return Array.from(map.values());
  }, [users]);

  const handleDeduplicateVault = async () => {
    setIsDeduplicating(true);
    setDedupMessage(null);
    try {
      const res = await fetch('/api/users/deduplicate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDedupMessage(data.message || 'Bóveda optimizada.');
        setTimeout(() => setDedupMessage(null), 5000);
      }
    } catch (e) {
      console.error('Error deduplicating:', e);
    } finally {
      setIsDeduplicating(false);
    }
  };

  const toggleCardExpansion = (userId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const formatHourDisplay = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${m < 10 ? '0' + m : m} ${period}`;
  };

  // Filter users by selected day if filter active
  const filteredUsers = uniqueUsers.filter(user => {
    if (dayFilter === 'all') return true;
    if (user.weeklySchedule && user.weeklySchedule[dayFilter]) {
      return (user.weeklySchedule[dayFilter]?.length || 0) > 0;
    }
    return user.activeDays?.includes(dayFilter);
  });

  const totalWeeklySystemExecutions = uniqueUsers.reduce((acc, u) => {
    if (!u.active) return acc;
    return acc + calculateTotalWeeklyCheckins(u.weeklySchedule || { mon: u.scheduledTimes, tue: u.scheduledTimes, wed: u.scheduledTimes, thu: u.scheduledTimes, fri: u.scheduledTimes });
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Bóveda de Credenciales & Horarios Independientes por Día
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/80 rounded">
              Horario Diario Variable
            </span>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 rounded flex items-center gap-1">
              <Database className="w-3 h-3 text-emerald-400" />
              <span>Firebase Realtime Cloud Sync</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Sincronización en vivo con Firebase Firestore (<code className="text-cyan-300 font-mono text-[11px]">uad_users</code>). Cualquier cambio de docentes u horarios se refleja en tiempo real sin docentes de prueba.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            id="btn-dedup-vault"
            onClick={handleDeduplicateVault}
            disabled={isDeduplicating}
            title="Eliminar registros duplicados y optimizar almacenamiento"
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isDeduplicating ? 'Optimizando...' : 'Optimizar Bóveda'}</span>
          </button>

          <button
            id="btn-add-user"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Agregar Usuario</span>
          </button>
        </div>
      </div>

      {/* Horizontal Firebase Synchronization Actions Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-white">Acciones de Sincronización</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Transfiere tus docentes configurados y horarios entre el almacenamiento local persistente y tu nube Firestore
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            id="btn-vault-push-firestore"
            type="button"
            onClick={handlePushToFirebase}
            disabled={syncStatus === 'syncing'}
            className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Cloud className="w-4 h-4 shrink-0" />
            <span>Subir Docentes Locales a Firestore ({users.length})</span>
          </button>

          <button
            id="btn-vault-pull-firestore"
            type="button"
            onClick={handlePullFromFirebase}
            disabled={syncStatus === 'syncing'}
            className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span>Descargar Docentes desde Firestore</span>
          </button>
        </div>

        {/* Sync status notification alert */}
        {syncMessage && (
          <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
            syncStatus === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              : syncStatus === 'error'
              ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
              : 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
          }`}>
            {syncStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : syncStatus === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-cyan-400 shrink-0 animate-spin" />
            )}
            <span>{syncMessage}</span>
          </div>
        )}
      </div>

      {/* Dedup feedback alert */}
      {dedupMessage && (
        <div className="bg-emerald-950/80 border border-emerald-800 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{dedupMessage}</span>
        </div>
      )}

      {/* Day Filter Toolbar & Quick Stats */}
      <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mr-1">
            <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
            <span>Filtrar por Día:</span>
          </span>

          <button
            onClick={() => setDayFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              dayFilter === 'all'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
            }`}
          >
            Todos los Días
          </button>

          {ALL_DAYS.map(day => (
            <button
              key={day.id}
              onClick={() => setDayFilter(day.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                dayFilter === day.id
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>{day.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
          <span className="text-slate-300 font-medium">
            <span className="text-cyan-400 font-bold">{users.filter(u => u.active).length}</span> usuarios activos
          </span>
          <span>•</span>
          <span className="text-emerald-400 font-medium">
            <span className="font-bold">{totalWeeklySystemExecutions}</span> checadas semanales programadas
          </span>
        </div>
      </div>

      {/* Users Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-sm text-white">
              Cuentas Registradas ({filteredUsers.length})
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {dayFilter !== 'all' ? `Mostrando usuarios con horario el ${ALL_DAYS.find(d => d.id === dayFilter)?.full}` : 'Horarios independientes asignados'}
          </span>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-sm">No se encontraron usuarios para el filtro seleccionado.</p>
            {dayFilter !== 'all' ? (
              <button
                onClick={() => setDayFilter('all')}
                className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-xs font-medium cursor-pointer"
              >
                Ver todos los usuarios
              </button>
            ) : (
              <button
                onClick={handleOpenAdd}
                className="mt-3 px-3 py-1.5 bg-cyan-600 text-white rounded text-xs font-medium cursor-pointer"
              >
                Agregar el primer usuario
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredUsers.map((user) => {
              const isVisible = showPasswordMap[user.id];
              const isExpanded = expandedCards[user.id] ?? true;
              
              // Normalize schedule
              const schedule: WeeklyDaySchedule = user.weeklySchedule ? {
                mon: user.weeklySchedule.mon || [],
                tue: user.weeklySchedule.tue || [],
                wed: user.weeklySchedule.wed || [],
                thu: user.weeklySchedule.thu || [],
                fri: user.weeklySchedule.fri || [],
                sat: user.weeklySchedule.sat || [],
                sun: user.weeklySchedule.sun || [],
              } : {
                mon: user.activeDays?.includes('mon') ? (user.scheduledTimes || ['08:00']) : [],
                tue: user.activeDays?.includes('tue') ? (user.scheduledTimes || ['08:00']) : [],
                wed: user.activeDays?.includes('wed') ? (user.scheduledTimes || ['08:00']) : [],
                thu: user.activeDays?.includes('thu') ? (user.scheduledTimes || ['08:00']) : [],
                fri: user.activeDays?.includes('fri') ? (user.scheduledTimes || ['08:00']) : [],
                sat: user.activeDays?.includes('sat') ? (user.scheduledTimes || []) : [],
                sun: user.activeDays?.includes('sun') ? (user.scheduledTimes || []) : [],
              };

              const totalUserCheckins = calculateTotalWeeklyCheckins(schedule);
              const activeDays = getActiveDaysList(schedule);

              return (
                <div key={user.id} className="p-5 hover:bg-slate-800/20 transition-colors">
                  <div className="space-y-4">
                    {/* User Identity Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold text-base shrink-0 shadow-inner">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-sm text-white">{user.name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono">
                              Matrícula: {user.username}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700">
                              {user.roleTag}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              user.active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {user.active ? 'ACTIVO' : 'PAUSADO'}
                            </span>
                            {(user.pausedDays || []).length > 0 && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                                {(user.pausedDays || []).length} DÍA(S) EN OFF
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span>{user.email}</span>
                            <span>•</span>
                            <span className="text-cyan-400 font-medium">
                              {totalUserCheckins} checadas configuradas ({activeDays.filter(d => !(user.pausedDays || []).includes(d)).length} días activos hoy)
                            </span>
                            {user.notes && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400">{user.notes}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action Controls */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* Encripted Key Tag */}
                        <div className="hidden lg:flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 font-mono">
                          <Lock className="w-3 h-3 text-cyan-400" />
                          <span>
                            {isVisible ? (user.password || user.passwordEncrypted) : '••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(user.id)}
                            className="text-slate-400 hover:text-slate-200 ml-1 cursor-pointer"
                            title={isVisible ? "Ocultar contraseña" : "Ver contraseña"}
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Instant Run Button */}
                        <button
                          id={`btn-user-run-${user.id}`}
                          onClick={() => onTriggerRun('job_01', user.id)}
                          disabled={isExecuting || !user.active}
                          className="px-2.5 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Probar</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          id={`btn-user-edit-${user.id}`}
                          onClick={() => handleOpenEdit(user)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Configurar horarios por día"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Editar Días</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          id={`btn-user-delete-${user.id}`}
                          onClick={() => onDeleteUser(user.id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-950/80 text-rose-400 border border-slate-700 hover:border-rose-800 rounded-lg text-xs transition-colors cursor-pointer"
                          title="Eliminar de la bóveda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Expand/Collapse Schedule View */}
                        <button
                          onClick={() => toggleCardExpansion(user.id)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg text-xs transition-colors cursor-pointer"
                          title="Alternar vista detallada de días"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Independent Weekly Schedule Breakdown Grid & ON/OFF Controls */}
                    {isExpanded && (
                      <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/90 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs pb-1 border-b border-slate-800/60">
                          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Horarios y Estado por Día de la Semana:</span>
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Haz clic en el botón <strong className="text-slate-300">ON / OFF</strong> de cualquier día para pausar o reactivar checadas
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 pt-1">
                          {ALL_DAYS.map((day) => {
                            const times = schedule[day.id] || [];
                            const hasTimes = times.length > 0;
                            const isPaused = (user.pausedDays || []).includes(day.id);
                            const isFilteredDay = dayFilter === day.id;
                            const isLoading = toggleDayLoadingUser === `${user.id}_${day.id}`;

                            return (
                              <div
                                key={day.id}
                                className={`p-2.5 rounded-lg border transition-all ${
                                  isFilteredDay
                                    ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/40'
                                    : isPaused
                                    ? 'bg-rose-950/20 border-rose-900/40'
                                    : hasTimes
                                    ? 'bg-slate-900/90 border-slate-700/80'
                                    : 'bg-slate-950/40 border-slate-800/40 opacity-60'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`font-bold text-xs ${
                                    isPaused ? 'text-rose-400' : hasTimes ? 'text-white' : 'text-slate-500'
                                  }`}>
                                    {day.full}
                                  </span>

                                  {/* Day ON/OFF Toggle Switch */}
                                  {hasTimes && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleDayForUser(user, day.id)}
                                      disabled={isLoading}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                        isLoading
                                          ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-400 border-slate-700'
                                          : isPaused
                                          ? 'bg-rose-950/90 text-rose-300 border-rose-700 hover:bg-rose-900'
                                          : 'bg-emerald-950/90 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                                      }`}
                                      title={isPaused ? `Activar checadas para ${day.full}` : `Pausar checadas para ${day.full}`}
                                    >
                                      {isLoading ? '...' : isPaused ? 'OFF' : 'ON'}
                                    </button>
                                  )}

                                  {!hasTimes && (
                                    <span className="text-[10px] text-slate-600 font-mono">Sin horas</span>
                                  )}
                                </div>

                                {hasTimes ? (
                                  <div className="space-y-1.5">
                                    <div className={`flex flex-wrap gap-1 ${isPaused ? 'opacity-40 grayscale' : ''}`}>
                                      {times.map((t) => (
                                        <span
                                          key={t}
                                          className={`inline-flex items-center px-1.5 py-0.5 border rounded text-[11px] font-mono font-medium ${
                                            isPaused
                                              ? 'bg-slate-950/80 border-slate-800 text-slate-500 line-through'
                                              : 'bg-slate-950 border-cyan-500/30 text-cyan-200'
                                          }`}
                                          title={formatHourDisplay(t)}
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                    {isPaused && (
                                      <p className="text-[10px] text-rose-400 font-medium">
                                        Pausado este día
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-600 italic">Sin checado</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Best Practices Notice */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">Funcionamiento del Motor de Checado Multi-Día</p>
          <p>
            El cronometro evalúa continuamente el día de la semana actual y los horarios configurados individualmente para cada usuario. Si un usuario tiene 3 horas los lunes y 5 horas los viernes, el bot ejecutará exactamente los turnos correspondientes a cada día en el portal institucional.
          </p>
        </div>
      </div>

      {/* Modal: Add/Edit User with Independent Per-Day Schedule Editor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">
                  {editingUserId ? 'Configurar Credenciales y Horarios por Día' : 'Nuevo Usuario con Horarios Diarios Independientes'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
              {/* Basic Details */}
              <div className="space-y-3">
                <h4 className="font-bold text-cyan-400 text-xs uppercase tracking-wider">
                  1. Identidad y Credenciales de Acceso
                </h4>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nombre Completo del Titular</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: Dr. Luis Guillermo Solano"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Matrícula / Usuario Portal</label>
                    <input
                      type="text"
                      required
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="Ej: 0705110713"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1 flex items-center justify-between">
                      <span>{editingUserId ? 'Contraseña del Portal' : 'Contraseña del Portal'}</span>
                      <span className="text-[10px] text-cyan-400 font-normal">Requerida para el Checador</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showModalPassword ? "text" : "password"}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Contraseña del portal UAD"
                        className="w-full px-3 py-2 pr-9 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowModalPassword(!showModalPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                        title={showModalPassword ? "Ocultar contraseña" : "Ver contraseña"}
                      >
                        {showModalPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="correo@institucion.edu"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Rol / Materia</label>
                    <input
                      type="text"
                      value={formRoleTag}
                      onChange={(e) => setFormRoleTag(e.target.value)}
                      placeholder="Ej: Docente Neurología"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Independent Per-Day Schedule Editor */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-cyan-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>2. Horarios Independientes por Día de la Semana</span>
                    </h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Selecciona cada día para definir individualmente sus horas de checado.
                    </p>
                  </div>

                  <span className="text-xs px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-semibold self-start sm:self-auto">
                    {calculateTotalWeeklyCheckins(formWeeklySchedule)} checados / semana
                  </span>
                </div>

                {/* Day Navigation Tabs */}
                <div className="grid grid-cols-7 gap-1 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                  {ALL_DAYS.map((day) => {
                    const times = formWeeklySchedule[day.id] || [];
                    const isSelected = activeDayTab === day.id;
                    const hasTimes = times.length > 0;

                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => setActiveDayTab(day.id)}
                        className={`py-2 px-1 rounded-md text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                          isSelected
                            ? 'bg-cyan-600 text-white shadow-sm font-bold'
                            : hasTimes
                            ? 'bg-slate-900 text-slate-200 hover:bg-slate-800'
                            : 'bg-transparent text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <span className="text-xs">{day.label}</span>
                        <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                          isSelected 
                            ? 'bg-cyan-700 text-white' 
                            : hasTimes 
                            ? 'bg-slate-800 text-cyan-400 border border-cyan-900/60' 
                            : 'text-slate-600'
                        }`}>
                          {times.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Day Configuration Panel */}
                <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold text-white text-sm">
                        Horario para el día {ALL_DAYS.find(d => d.id === activeDayTab)?.full}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({(formWeeklySchedule[activeDayTab] || []).length} horas configuradas)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyDayToWeekdays}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copiar las horas de este día a Lunes, Martes, Miércoles, Jueves y Viernes"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copiar a Lun-Vie</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleClearCurrentDay}
                        className="px-2 py-1 bg-slate-900 hover:bg-rose-950 text-rose-400 border border-slate-700 rounded text-[11px] transition-colors cursor-pointer"
                        title="Vaciar horas de este día"
                      >
                        Limpiar Día
                      </button>
                    </div>
                  </div>

                  {copySuccessMsg && (
                    <div className="p-2 bg-emerald-950/90 border border-emerald-800 text-emerald-300 text-xs rounded-md flex items-center gap-1.5 animate-in fade-in">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{copySuccessMsg}</span>
                    </div>
                  )}

                  {/* Add Hour to Active Day */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      value={dayTimeInput}
                      onChange={(e) => setDayTimeInput(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddTimeForCurrentDay}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Hora a {ALL_DAYS.find(d => d.id === activeDayTab)?.full}</span>
                    </button>
                  </div>

                  {/* Quick Presets for this Day */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Plantillas para este día:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleApplyPresetToCurrentDay('uad_full')}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        ⚡ UAD 6 Horas (8:00, 9:45, 12:45, 13:45, 14:45, 16:45)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetToCurrentDay('morning')}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-[11px] transition-colors cursor-pointer"
                      >
                        Turno Matutino (7:00, 8:00, 9:45, 11:00)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetToCurrentDay('afternoon')}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-[11px] transition-colors cursor-pointer"
                      >
                        Turno Vespertino (12:45, 13:45, 14:45, 16:45, 18:00)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetToCurrentDay('bi_turn')}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-[11px] transition-colors cursor-pointer"
                      >
                        2 Turnos (8:00, 14:00)
                      </button>
                    </div>
                  </div>

                  {/* Active Hours List for this Day */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-slate-300 font-medium">
                      Horas programadas para el {ALL_DAYS.find(d => d.id === activeDayTab)?.full}:
                    </span>

                    {(formWeeklySchedule[activeDayTab] || []).length === 0 ? (
                      <div className="p-3 bg-slate-900/60 rounded-lg border border-dashed border-slate-800 text-center text-slate-500">
                        <p>No hay checados programados para este día (Día Libre / Inactivo).</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(formWeeklySchedule[activeDayTab] || []).map((t) => (
                          <div
                            key={t}
                            className="flex items-center gap-1.5 bg-slate-900 border border-cyan-500/50 text-cyan-200 px-2.5 py-1 rounded-md text-xs font-mono shadow-xs"
                          >
                            <span className="font-bold">{t}</span>
                            <span className="text-[10px] text-slate-400 font-sans">
                              ({formatHourDisplay(t)})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTimeFromCurrentDay(t)}
                              className="text-slate-400 hover:text-rose-400 p-0.5 rounded ml-0.5 cursor-pointer"
                              title="Eliminar este horario de este día"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* All Days Overview Summary Matrix in Modal */}
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Resumen del Calendario Semanal Completo:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 text-[11px]">
                    {ALL_DAYS.map(d => {
                      const count = (formWeeklySchedule[d.id] || []).length;
                      return (
                        <div key={d.id} className="p-1.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-300 font-medium">{d.short}:</span>
                          <span className={count > 0 ? 'text-cyan-400 font-bold' : 'text-slate-600'}>
                            {count > 0 ? `${count} hrs` : 'Off'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Status and Notes */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Notas y Referencias</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Ej: Docente Medicina / Horario variable Lunes a Jueves"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="userActiveCheck"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-600 bg-slate-950 border-slate-700 focus:ring-cyan-500 cursor-pointer"
                  />
                  <label htmlFor="userActiveCheck" className="text-slate-300 font-medium cursor-pointer">
                    Activar este usuario en el orquestador automático de la nube
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={calculateTotalWeeklyCheckins(formWeeklySchedule) === 0}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Usuario y Horarios Diarios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
