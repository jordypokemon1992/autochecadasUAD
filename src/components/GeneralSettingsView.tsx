import React, { useState } from 'react';
import { 
  Settings, 
  Database, 
  Github, 
  Layers, 
  Sliders, 
  Sparkles,
  Cloud,
  CheckCircle2,
  Server
} from 'lucide-react';
import { FirebaseSyncView } from './FirebaseSyncView';
import { GitHubActionsIntegrationView } from './GitHubActionsIntegrationView';
import { ArchitectureView } from './ArchitectureView';
import { UserCredential, AutomationJob } from '../types';

export type SettingsSubTab = 'firebase' | 'github-actions' | 'architecture';

interface GeneralSettingsViewProps {
  users: UserCredential[];
  jobs: AutomationJob[];
  onRefreshData?: () => Promise<void>;
  initialSubTab?: SettingsSubTab;
}

export const GeneralSettingsView: React.FC<GeneralSettingsViewProps> = ({
  users,
  jobs,
  onRefreshData,
  initialSubTab = 'firebase',
}) => {
  const [subTab, setSubTab] = useState<SettingsSubTab>(initialSubTab);

  const subTabs = [
    {
      id: 'firebase' as SettingsSubTab,
      label: 'Vinculación Firebase',
      icon: Database,
      badge: 'Firestore & Auth',
      colorClass: 'text-orange-400 border-orange-500/40 bg-orange-950/30'
    },
    {
      id: 'github-actions' as SettingsSubTab,
      label: 'GitHub Actions Backend',
      icon: Github,
      badge: 'Worker Desatendido',
      colorClass: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/30'
    },
    {
      id: 'architecture' as SettingsSubTab,
      label: 'Arquitectura 3 Componentes y Despliegue',
      icon: Layers,
      badge: 'Docker & Cloud Run',
      colorClass: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner for General Settings */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-5 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600/30 to-indigo-600/30 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Configuración General del Sistema</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Infraestructura Cloud
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Administra la vinculación de base de datos Firebase, automatización desatendida en GitHub Actions y arquitectura de despliegue.
              </p>
            </div>
          </div>
        </div>

        {/* Subtabs Selector Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-5 pt-4 border-t border-slate-800/80">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`subtab-${tab.id}`}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isActive
                    ? `${tab.colorClass} shadow-md ring-1 ring-cyan-500/30 font-semibold`
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-slate-900 border border-slate-700' : 'bg-slate-900/60'}`}>
                    <Icon className={`w-4 h-4 ${isActive ? tab.colorClass.split(' ')[0] : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <span className={`block text-xs ${isActive ? 'text-white font-bold' : 'text-slate-300 font-medium'}`}>
                      {tab.label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {tab.badge}
                    </span>
                  </div>
                </div>
                {isActive && (
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${tab.colorClass.split(' ')[0]}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content depending on selected subtab */}
      <div className="transition-all duration-200">
        {subTab === 'firebase' && (
          <FirebaseSyncView
            users={users}
            jobs={jobs}
            onRefreshData={onRefreshData}
          />
        )}

        {subTab === 'github-actions' && (
          <GitHubActionsIntegrationView
            users={users}
          />
        )}

        {subTab === 'architecture' && (
          <ArchitectureView />
        )}
      </div>
    </div>
  );
};
