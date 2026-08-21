import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRightLeft, 
  RefreshCw, 
  ShieldCheck, 
  Key, 
  Cloud, 
  Save, 
  ExternalLink,
  Copy,
  Check,
  Zap,
  Info
} from 'lucide-react';
import { 
  getSavedFirebaseConfig, 
  saveFirebaseConfig, 
  initFirebase, 
  syncUsersToFirestore, 
  syncJobsToFirestore,
  fetchUsersFromFirestore,
  FirebaseConfigOptions 
} from '../lib/firebase';
import { UserCredential, AutomationJob } from '../types';

interface FirebaseSyncViewProps {
  users: UserCredential[];
  jobs: AutomationJob[];
  onRefreshData: () => Promise<void>;
  onBatchUpdateUsers?: (users: UserCredential[]) => Promise<void>;
}

export const FirebaseSyncView: React.FC<FirebaseSyncViewProps> = ({
  users,
  jobs,
  onRefreshData,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [appId, setAppId] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [status, setStatus] = useState<'not_configured' | 'connected' | 'error' | 'syncing'>('not_configured');
  const [statusMessage, setStatusMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [remoteCount, setRemoteCount] = useState<{ users: number; jobs: number } | null>(null);

  useEffect(() => {
    const saved = getSavedFirebaseConfig();
    if (saved) {
      setApiKey(saved.apiKey || '');
      setProjectId(saved.projectId || '');
      setAppId(saved.appId || '');
      setAuthDomain(saved.authDomain || '');
      
      // Try testing connection
      if (saved.apiKey && saved.projectId) {
        testConnection(saved);
      }
    }
  }, []);

  const testConnection = async (config: FirebaseConfigOptions) => {
    setStatus('syncing');
    setStatusMessage('Comprobando conexión con Firestore...');
    try {
      const { db } = initFirebase(config);
      const remoteUsers = await fetchUsersFromFirestore(db);
      setStatus('connected');
      setStatusMessage(`Conexión exitosa con Firestore en el proyecto "${config.projectId}".`);
      setRemoteCount({ users: remoteUsers.length, jobs: 0 });
    } catch (err: any) {
      console.error('Firebase test connection failed', err);
      setStatus('error');
      setStatusMessage(err.message || 'Error al conectar con Firestore. Revisa las credenciales o reglas de seguridad.');
    }
  };

  const handleSaveAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim() || !appId.trim()) {
      setStatus('error');
      setStatusMessage('Por favor completa API Key, Project ID y App ID.');
      return;
    }

    const config: FirebaseConfigOptions = {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      appId: appId.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`
    };

    saveFirebaseConfig(config);
    await testConnection(config);
  };

  const handlePushToFirebase = async () => {
    const saved = getSavedFirebaseConfig();
    if (!saved) {
      alert('Primero guarda y conecta la configuración de Firebase.');
      return;
    }

    setStatus('syncing');
    setStatusMessage('Sincronizando docentes y horarios hacia Firestore...');
    try {
      const { db } = initFirebase(saved);
      await syncUsersToFirestore(db, users);
      await syncJobsToFirestore(db, jobs);
      setStatus('connected');
      setStatusMessage(`¡Sincronización completada! ${users.length} docentes y ${jobs.length} tareas actualizadas en Firestore.`);
      await testConnection(saved);
    } catch (err: any) {
      console.error('Push failed', err);
      setStatus('error');
      setStatusMessage(`Error al subir a Firestore: ${err.message}`);
    }
  };

  const handlePullFromFirebase = async () => {
    const saved = getSavedFirebaseConfig();
    if (!saved) {
      alert('Primero guarda y conecta la configuración de Firebase.');
      return;
    }

    setStatus('syncing');
    setStatusMessage('Descargando datos desde Firestore...');
    try {
      const { db } = initFirebase(saved);
      const remoteUsers = await fetchUsersFromFirestore(db);
      
      // Save each to local server
      for (const u of remoteUsers) {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(u)
        });
      }

      await onRefreshData();
      setStatus('connected');
      setStatusMessage(`Se sincronizaron ${remoteUsers.length} docentes desde Firestore.`);
    } catch (err: any) {
      console.error('Pull failed', err);
      setStatus('error');
      setStatusMessage(`Error al descargar de Firestore: ${err.message}`);
    }
  };

  const handleDisconnect = () => {
    saveFirebaseConfig(null);
    setApiKey('');
    setProjectId('');
    setAppId('');
    setAuthDomain('');
    setStatus('not_configured');
    setStatusMessage('Desconectado de Firebase. Los datos se mantienen en la persistencia local de disco.');
    setRemoteCount(null);
  };

  const firestoreRulesExample = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /uad_users/{userId} {
      allow read, write: if true; // O restringir con request.auth != null
    }
    match /uad_jobs/{jobId} {
      allow read, write: if true;
    }
    match /uad_executions/{execId} {
      allow read, write: if true;
    }
  }
}`;

  const copyRules = () => {
    navigator.clipboard.writeText(firestoreRulesExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Vinculación de Datos con Firebase Firestore</h2>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                status === 'connected'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : status === 'error'
                  ? 'bg-red-950 text-red-300 border-red-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {status === 'connected' ? '● Conectado a Firestore' : status === 'error' ? '● Error de Conexión' : '○ Sin Vincular'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sincroniza tus docentes, contraseñas encriptadas AES-256 y matrices de horarios directamente con la nube de Google Firebase en tiempo real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <a
            href="https://console.firebase.google.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <span>Consola Firebase</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Grid: Config Form + Sync Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <Key className="w-4 h-4 text-orange-500" />
              <span>Credenciales de Firebase Web SDK</span>
            </h3>

            <form onSubmit={handleSaveAndConnect} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Project ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. uad-asistencia-prod"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">ID del proyecto en Firebase Console</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    API Key (Web API Key) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. AIzaSyB..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Configuración del proyecto &gt; Clave de API web</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    App ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. 1:161704440434:web:9f8a2..."
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Identificador de tu App Web en Firebase</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Auth Domain (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. mi-proyecto.firebaseapp.com"
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Por defecto: tu-project-id.firebaseapp.com</span>
                </div>
              </div>

              {/* Status Banner */}
              {statusMessage && (
                <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  status === 'connected'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : status === 'error'
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}>
                  {status === 'connected' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : status === 'error' ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-spin" />
                  )}
                  <span>{statusMessage}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={status === 'syncing'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar y Probar Conexión</span>
                </button>

                {status === 'connected' && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    <span>Desconectar</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Firestore Security Rules Card */}
          <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Reglas de Seguridad Firestore (`firestore.rules`)</span>
              </h4>
              <button
                type="button"
                onClick={copyRules}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 border border-slate-700"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado' : 'Copiar Reglas'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Asegúrate de pegar estas reglas en la pestaña <strong>Reglas de Firestore</strong> en Firebase Console para permitir lectura y escritura segura:
            </p>
            <pre className="bg-slate-950 p-3 rounded-lg font-mono text-[11px] text-cyan-300 overflow-x-auto border border-slate-800">
              {firestoreRulesExample}
            </pre>
          </div>
        </div>

        {/* Right Column: Sync Actions & Stats (1 col) */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-cyan-600" />
              <span>Acciones de Sincronización</span>
            </h3>

            <p className="text-xs text-slate-600">
              Transfiere tus docentes configurados y horarios entre el almacenamiento local persistente y tu nube Firestore:
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handlePushToFirebase}
                disabled={status !== 'connected'}
                className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  status === 'connected'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-sm cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                <Cloud className="w-4 h-4" />
                <span>Subir Docentes Locales a Firestore ({users.length})</span>
              </button>

              <button
                type="button"
                onClick={handlePullFromFirebase}
                disabled={status !== 'connected'}
                className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  status === 'connected'
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Descargar Docentes desde Firestore</span>
              </button>
            </div>

            {remoteCount && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
                <div className="font-semibold text-slate-800">Estado en la Nube:</div>
                <div>• Colección <code className="text-orange-700">uad_users</code>: <strong>{remoteCount.users}</strong> registros</div>
                <div>• Colección <code className="text-orange-700">uad_jobs</code>: <strong>{jobs.length}</strong> tareas</div>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <Zap className="w-4 h-4 text-amber-600" />
              <span>Persistencia Híbrida 100% Segura</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800/90">
              Tu sistema cuenta con **doble respaldo**:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800/90">
              <li><strong>Disco Local del Servidor</strong>: Los datos se guardan inmediatamente en archivos JSON no volátiles (`data/vault_users.json`).</li>
              <li><strong>Firebase Firestore</strong>: Cuando está conectado, los cambios se replican en la nube para acceso desde múltiples dispositivos o Workers externos.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
