import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { UsersVaultView } from './components/UsersVaultView';
import { JobsScheduleView } from './components/JobsScheduleView';
import { ExecutionLogsView } from './components/ExecutionLogsView';
import { ArchitectureView } from './components/ArchitectureView';
import { FirebaseSyncView } from './components/FirebaseSyncView';
import { GitHubActionsIntegrationView } from './components/GitHubActionsIntegrationView';
import { LiveRunnerDrawer } from './components/LiveRunnerDrawer';
import { UserCredential, AutomationJob, ExecutionRecord, SystemHealthStatus } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'schedules' | 'logs' | 'architecture' | 'firebase' | 'github-actions'>('dashboard');
  const [users, setUsers] = useState<UserCredential[]>([]);
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);

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

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [usersData, jobsData, execData, healthData] = await Promise.all([
        safeFetchJson<UserCredential[]>('/api/users'),
        safeFetchJson<AutomationJob[]>('/api/jobs'),
        safeFetchJson<ExecutionRecord[]>('/api/executions'),
        safeFetchJson<SystemHealthStatus>('/api/health'),
      ]);

      if (usersData) setUsers(usersData);
      if (jobsData) setJobs(jobsData);
      if (execData) setExecutions(execData);
      if (healthData) setHealth(healthData);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
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
        // Refresh lists
        await fetchData();
      }
    } catch (err) {
      console.error('Error triggering execution:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  // User Actions
  const handleAddUser = async (userData: Partial<UserCredential> & { password?: string }) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error('Error adding user:', err);
    }
  };

  const handleUpdateUser = async (id: string, updates: Partial<UserCredential> & { password?: string }) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error('Error updating user:', err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error('Error deleting user:', err);
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
      if (res.ok) await fetchData();
    } catch (err) {
      console.error('Error updating job:', err);
    }
  };

  // Clear Logs
  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/executions', { method: 'DELETE' });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  };

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
            onNavigateToTab={(tab: string) => setActiveTab(tab as any)}
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
            onRefreshData={fetchData}
          />
        )}

        {activeTab === 'logs' && (
          <ExecutionLogsView
            executions={executions}
            users={users}
            onClearHistory={handleClearHistory}
            onRefreshLogs={fetchData}
            onTriggerRun={handleTriggerRun}
            isExecuting={isExecuting}
          />
        )}

        {activeTab === 'architecture' && <ArchitectureView />}

        {activeTab === 'firebase' && (
          <FirebaseSyncView
            users={users}
            jobs={jobs}
            onRefreshData={fetchData}
          />
        )}

        {activeTab === 'github-actions' && (
          <GitHubActionsIntegrationView
            users={users}
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
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Sistema de Orquestación en Nube v2.4</span>
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
