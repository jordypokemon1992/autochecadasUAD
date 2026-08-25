import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { UsersVaultView } from './components/UsersVaultView';
import { JobsScheduleView } from './components/JobsScheduleView';
import { GeneralSettingsView, SettingsSubTab } from './components/GeneralSettingsView';
import { LiveRunnerDrawer } from './components/LiveRunnerDrawer';
import { LoginView } from './components/LoginView';
import { UserCredential, AutomationJob, ExecutionRecord, SystemHealthStatus } from './types';
import { 
  getSavedFirebaseConfig, 
  initFirebase, 
  subscribeToFirestoreUsers, 
  subscribeToFirestoreExecutions,
  saveUserToFirestore,
  deleteUserFromFirestore
} from './lib/firebase';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    try {
      const savedLocal = localStorage.getItem('cloudflow_auth_session');
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        return parsed.username || null;
      }
      const savedSession = sessionStorage.getItem('cloudflow_auth_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        return parsed.username || null;
      }
    } catch {
      return null;
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'schedules' | 'settings' | 'architecture' | 'firebase' | 'github-actions'>('dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('firebase');
  const [users, setUsers] = useState<UserCredential[]>([]);
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [isFirebaseLive, setIsFirebaseLive] = useState(false);

  // Runner Modal State
  const [isLiveRunnerOpen, setIsLiveRunnerOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentRunnerExecutions, setCurrentRunnerExecutions] = useState<ExecutionRecord[]>([]);

  // Safe JSON fetch helper
  const safeFetchJson = async <T,>(url: string): Promise<T | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return null;
      }
      return await res.json();
    } catch {
      return null;
    }
  };

  // Sync server store in background for health calculations
  const syncServerUsers = async (remoteUsers: UserCredential[]) => {
    try {
      await fetch('/api/users/sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: remoteUsers, mode: 'replace' })
      });
      const healthData = await safeFetchJson<SystemHealthStatus>('/api/health');
      if (healthData) setHealth(healthData);
    } catch (err) {
      console.warn('[SERVER SYNC] Fallback sync to local server skipped:', err);
    }
  };

  // Fetch initial non-user data (jobs, health)
  const fetchAuxData = async () => {
    try {
      const [jobsData, healthData] = await Promise.all([
        safeFetchJson<AutomationJob[]>('/api/jobs'),
        safeFetchJson<SystemHealthStatus>('/api/health'),
      ]);

      if (jobsData) setJobs(jobsData);
      if (healthData) setHealth(healthData);
    } catch (err) {
      console.error('Error fetching auxiliary data:', err);
    }
  };

  // Connect Real-Time Firebase Listener (0 polling, instant updates on add/edit/delete)
  useEffect(() => {
    fetchAuxData();

    const savedConfig = getSavedFirebaseConfig();
    let unsubscribeUsers: (() => void) | null = null;
    let unsubscribeExecs: (() => void) | null = null;

    if (savedConfig && savedConfig.apiKey && savedConfig.projectId) {
      try {
        const { db } = initFirebase(savedConfig);
        setIsFirebaseLive(true);
        console.log('[FIREBASE] Conectado en tiempo real a Firestore (uad_users)');

        unsubscribeUsers = subscribeToFirestoreUsers(
          db,
          (remoteUsers) => {
            console.log(`[FIREBASE REALTIME] Recibidos ${remoteUsers.length} docentes de Firestore`);
            setUsers(remoteUsers);
            // Keep local server in sync for daemon/health metrics
            syncServerUsers(remoteUsers);
          },
          (err) => {
            console.warn('[FIREBASE REALTIME] Error en listener, usando fallback API:', err);
            setIsFirebaseLive(false);
          }
        );

        unsubscribeExecs = subscribeToFirestoreExecutions(
          db,
          (remoteExecs) => {
            if (remoteExecs.length > 0) {
              setExecutions(remoteExecs);
            }
          }
        );
      } catch (err) {
        console.error('[FIREBASE] Error al inicializar listener en tiempo real:', err);
        setIsFirebaseLive(false);
      }
    } else {
      // Fallback only if Firebase is not yet configured
      safeFetchJson<UserCredential[]>('/api/users').then((localUsers) => {
        if (localUsers) setUsers(localUsers);
      });
      safeFetchJson<ExecutionRecord[]>('/api/executions').then((localExecs) => {
        if (localExecs) setExecutions(localExecs);
      });
    }

    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeExecs) unsubscribeExecs();
    };
  }, []);

  // Trigger Execution Runner
  const handleTriggerRun = async (jobId: string, userId?: string) => {
    setIsExecuting(true);
    setIsLiveRunnerOpen(true);
    setCurrentRunnerExecutions([]);

    try {
      const res = await fetch(`/api/jobs/${jobId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, triggerType: 'manual_test' }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentRunnerExecutions(data.executions || []);
        await fetchAuxData();
      }
    } catch (err) {
      console.error('Error triggering execution:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  // User Actions (Writes directly to Firestore if connected, and mirrors to server)
  const handleAddUser = async (userData: Partial<UserCredential> & { password?: string }) => {
    const savedConfig = getSavedFirebaseConfig();
    const cleanPwd = userData.password || 'temp_secret_pwd';
    const userId = userData.id || `usr_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const fullUser: UserCredential = {
      id: userId,
      name: userData.name || '',
      email: userData.email || `${userData.username}@institucion.edu`,
      username: userData.username || '',
      password: cleanPwd,
      passwordEncrypted: cleanPwd,
      roleTag: userData.roleTag || 'Docente Titular',
      notes: userData.notes || '',
      active: userData.active !== undefined ? userData.active : true,
      weeklySchedule: userData.weeklySchedule || { mon: ["08:00"], tue: ["08:00"], wed: ["08:00"], thu: ["08:00"], fri: ["08:00"], sat: [], sun: [] },
      scheduledTimes: userData.scheduledTimes || ["08:00"],
      activeDays: userData.activeDays || ["mon", "tue", "wed", "thu", "fri"],
      createdAt: new Date().toISOString(),
      lastStatus: 'pending'
    };

    if (savedConfig && savedConfig.apiKey && savedConfig.projectId) {
      try {
        const { db } = initFirebase(savedConfig);
        await saveUserToFirestore(db, fullUser);
        console.log(`[FIREBASE] Docente ${fullUser.name} (${fullUser.username}) guardado en Firestore.`);
      } catch (err) {
        console.error('[FIREBASE] Error al guardar docente en Firestore:', err);
      }
    }

    // Mirror to server for local runner
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullUser),
      });
      await fetchAuxData();
    } catch (err) {
      console.error('Error adding user to local server:', err);
    }
  };

  const handleUpdateUser = async (id: string, updates: Partial<UserCredential> & { password?: string }) => {
    const existing = users.find(u => u.id === id);
    const savedConfig = getSavedFirebaseConfig();

    const cleanPwd = updates.password || (existing ? (existing.password || existing.passwordEncrypted) : '');
    const updatedUser: UserCredential = {
      ...(existing || {} as UserCredential),
      ...updates,
      id,
      password: cleanPwd,
      passwordEncrypted: cleanPwd
    };

    if (savedConfig && savedConfig.apiKey && savedConfig.projectId) {
      try {
        const { db } = initFirebase(savedConfig);
        await saveUserToFirestore(db, updatedUser);
        console.log(`[FIREBASE] Docente ${updatedUser.name} actualizado en Firestore.`);
      } catch (err) {
        console.error('[FIREBASE] Error actualizando en Firestore:', err);
      }
    }

    try {
      await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await fetchAuxData();
    } catch (err) {
      console.error('Error updating user in local server:', err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    const savedConfig = getSavedFirebaseConfig();

    if (savedConfig && savedConfig.apiKey && savedConfig.projectId) {
      try {
        const { db } = initFirebase(savedConfig);
        await deleteUserFromFirestore(db, id);
        console.log(`[FIREBASE] Docente con ID ${id} eliminado de Firestore.`);
      } catch (err) {
        console.error('[FIREBASE] Error eliminando en Firestore:', err);
      }
    }

    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      await fetchAuxData();
    } catch (err) {
      console.error('Error deleting user from local server:', err);
    }
  };

  // Job Actions
  const handleUpdateJob = async (updates: Partial<AutomationJob>) => {
    const primaryJob = jobs[0];
    if (!primaryJob) return;

    try {
      const res = await fetch(`/api/jobs/${primaryJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) await fetchAuxData();
    } catch (err) {
      console.error('Error updating job:', err);
    }
  };

  // Clear Logs
  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/executions', { method: 'DELETE' });
      if (res.ok) await fetchAuxData();
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cloudflow_auth_session');
    sessionStorage.removeItem('cloudflow_auth_session');
    setCurrentUser(null);
  };

  // If not logged in, render master login screen
  if (!currentUser) {
    return <LoginView onLoginSuccess={(username) => setCurrentUser(username)} />;
  }

  const primaryJob = jobs[0] || {
    id: 'job_01',
    name: 'Registro Matutino y Checado Diario',
    description: 'Automatización programada',
    targetUrl: 'https://portal.uad.mx/',
    cronExpression: '0 8 * * 1-5',
    targetTime: '08:00',
    activeDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    assignedUserIds: [],
    jitterMinutes: 3,
    retryCount: 3,
    retryDelaySeconds: 15,
    enabled: true,
    steps: []
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab: string) => setActiveTab(tab as any)}
        health={health}
        onTriggerQuickRun={() => handleTriggerRun(primaryJob.id)}
        isExecuting={isExecuting}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Views Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            health={health}
            users={users}
            jobs={jobs}
            recentExecutions={executions}
            onTriggerRun={handleTriggerRun}
            onNavigateToTab={(tab: string) => {
              if (tab === 'architecture' || tab === 'firebase' || tab === 'github-actions') {
                setSettingsSubTab(tab as SettingsSubTab);
                setActiveTab('settings');
              } else {
                setActiveTab(tab as any);
              }
            }}
            isExecuting={isExecuting}
          />
        )}

        {activeTab === 'users' && (
          <UsersVaultView
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onTriggerRun={handleTriggerRun}
            isExecuting={isExecuting}
            onRefreshData={fetchAuxData}
          />
        )}

        {activeTab === 'schedules' && (
          <JobsScheduleView
            job={primaryJob}
            users={users}
            health={health}
            onUpdateJob={handleUpdateJob}
            onTriggerRun={handleTriggerRun}
            isExecuting={isExecuting}
            onRefreshData={fetchAuxData}
          />
        )}

        {(activeTab === 'settings' || activeTab === 'architecture' || activeTab === 'firebase' || activeTab === 'github-actions') && (
          <GeneralSettingsView
            users={users}
            jobs={jobs}
            onRefreshData={fetchAuxData}
            initialSubTab={
              activeTab === 'architecture'
                ? 'architecture'
                : activeTab === 'github-actions'
                ? 'github-actions'
                : activeTab === 'firebase'
                ? 'firebase'
                : settingsSubTab
            }
          />
        )}
      </main>

      {/* Live Runner Visualizer Modal */}
      <LiveRunnerDrawer
        isOpen={isLiveRunnerOpen}
        onClose={() => setIsLiveRunnerOpen(false)}
        currentExecutions={currentRunnerExecutions}
        isExecuting={isExecuting}
      />

      {/* Persistent Footer Status */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isFirebaseLive ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-500'}`} />
            <span>{isFirebaseLive ? 'Bóveda Sincronizada en Tiempo Real (Firebase Firestore)' : 'Sistema de Orquestación en Nube v2.4'}</span>
            <span>•</span>
            <span>Portal: https://portal.uad.mx/</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Headless Browser Engine • Programador Desatendido 24/7 • Cifrado AES-256
          </p>
        </div>
      </footer>
    </div>
  );
}
