import React, { useState } from 'react';
import { 
  Github, 
  Database, 
  Workflow, 
  Terminal, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink, 
  Play, 
  CheckCircle2, 
  Clock, 
  Users, 
  Cpu, 
  Download,
  Key,
  Layers,
  Sparkles
} from 'lucide-react';
import { UserCredential } from '../types';

interface GitHubActionsIntegrationViewProps {
  users: UserCredential[];
}

export const GitHubActionsIntegrationView: React.FC<GitHubActionsIntegrationViewProps> = ({ users }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'workflow' | 'worker' | 'secrets' | 'architecture'>('workflow');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const workflowYaml = `name: UAD Automation Runner (Firebase Driven)

on:
  schedule:
    # Se ejecuta cada 15 minutos en horario hábil de Lunes a Viernes
    - cron: '*/15 13-23 * * 1-5'
  workflow_dispatch: # Permite disparar manualmente con un clic en cualquier momento
    inputs:
      target_user_id:
        description: 'Matrícula o ID específico de docente (opcional, deja "all" para todos)'
        required: false
        default: 'all'

jobs:
  execute-attendance:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout del Repositorio
        uses: actions/checkout@v4

      - name: Configurar Node.js 24
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Instalar Dependencias y Playwright Chromium
        run: |
          npm install firebase dotenv playwright
          npx playwright install chromium --with-deps

      - name: Ejecutar Checado Desatendido (Conectado a Firebase)
        env:
          FIREBASE_PROJECT_ID: \${{ secrets.FIREBASE_PROJECT_ID }}
          FIREBASE_API_KEY: \${{ secrets.FIREBASE_API_KEY }}
          FIREBASE_APP_ID: \${{ secrets.FIREBASE_APP_ID }}
          TARGET_USER_INPUT: \${{ github.event.inputs.target_user_id || 'all' }}
        run: node worker-firebase.js

      - name: Subir Evidencias de Captura y Auditoría
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: evidencias-checado-uad-\${{ github.run_id }}
          path: '*.png'
          if-no-files-found: ignore
          retention-days: 14
`;

  const workerFirebaseJs = `/**
 * WORKER AUTÓNOMO DE PLAYWRIGHT PARA CHECADO UAD
 * Alimentado dinámicamente desde Firebase Firestore
 * Diseñado para ejecutarse en GitHub Actions o como microservicio desatendido
 */

const { chromium } = require('playwright');
const { initializeApp, getApps } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc 
} = require('firebase/firestore');
require('dotenv').config();

let dbInstance = null;

function getFirebaseDB() {
  if (dbInstance) return dbInstance;

  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const appId = process.env.FIREBASE_APP_ID;

  const missing = [];
  if (!apiKey) missing.push('FIREBASE_API_KEY');
  if (!projectId) missing.push('FIREBASE_PROJECT_ID');
  if (!appId) missing.push('FIREBASE_APP_ID');

  if (missing.length > 0) {
    console.error("=================================================");
    console.error("❌ ERROR: FALTAN SECRETS EN GITHUB ACTIONS");
    console.error("=================================================");
    console.error("Faltan las siguientes variables de entorno secretas:");
    missing.forEach(m => console.error(\`  - \${m}\`));
    console.error("\\n👉 CÓMO SOLUCIONARLO:");
    console.error("1. Ve a tu repositorio en GitHub > Settings > Secrets and variables > Actions");
    console.error("2. Haz clic en 'New repository secret' y agrega cada una con sus valores de Firebase.");
    console.error("=================================================\\n");
    throw new Error(\`Faltan secrets requeridos en GitHub: \${missing.join(', ')}\`);
  }

  const existing = getApps();
  const app = existing.length > 0 ? existing[0] : initializeApp({
    apiKey,
    projectId,
    appId,
    authDomain: \`\${projectId}.firebaseapp.com\`
  });

  dbInstance = getFirestore(app);
  return dbInstance;
}

const TARGET_PORTAL = "https://portal.uad.mx/";
const DAYS_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function getCDMXTime() {
  const now = new Date();
  const cdmxString = now.toLocaleString("en-US", { timeZone: "America/Mexico_City" });
  const cdmxDate = new Date(cdmxString);
  
  const dayKey = DAYS_MAP[cdmxDate.getDay()];
  const hh = String(cdmxDate.getHours()).padStart(2, '0');
  const mm = String(cdmxDate.getMinutes()).padStart(2, '0');
  const currentTime = \`\${hh}:\${mm}\`;
  
  return { dayKey, currentTime, cdmxDate, fullISO: cdmxDate.toISOString() };
}

async function fetchActiveUsersFromFirebase(db) {
  console.log("[FIREBASE] Obteniendo lista de docentes desde colección 'uad_users'...");
  try {
    const snap = await getDocs(collection(db, 'uad_users'));
    const users = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.active !== false) {
        users.push({ id: d.id, ...data });
      }
    });
    console.log(\`[FIREBASE] ✅ Total de docentes activos obtenidos: \${users.length}\`);
    return users;
  } catch (error) {
    console.error("[FIREBASE ERROR] No se pudo leer la colección 'uad_users':", error.message);
    console.error("👉 Asegúrate de que las Reglas de Firestore en Firebase Console permitan lectura/escritura.");
    throw error;
  }
}

async function executeAttendanceCheck(db, user, timeContext) {
  console.log(\`\\n==================================================\`);
  console.log(\`[EJECUTANDO] Docente: \${user.name || user.username} (\${user.username})\`);
  console.log(\`[HORARIO] Hora CDMX: \${timeContext.currentTime} [Día: \${timeContext.dayKey.toUpperCase()}]\`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();
  let status = 'failed';
  let message = '';
  const startTime = Date.now();

  try {
    // 1. Acceso a URL
    console.log(\`[1/5] Accediendo a \${TARGET_PORTAL}...\`);
    await page.goto(TARGET_PORTAL, { waitUntil: 'networkidle', timeout: 35000 });

    // Descartar comunicado institucional si existe
    try {
      const modal = await page.$("#modal-comunicado.in, #modal-comunicado.show, #modal-comunicado:not([style*='display: none'])");
      if (modal) {
        console.log("[AVISO] Modal institucional detectado. Descartando...");
        await page.click("#modal-comunicado .close, #modal-comunicado button").catch(() => {});
      }
    } catch (e) {
      // ignore
    }

    // 2. Inyectar credenciales con selectores exactos
    console.log(\`[2/5] Ingresando matrícula en #user y contraseña en #pass...\`);
    await page.waitForSelector("#user, input[name='_usuario_']", { timeout: 12000 });
    await page.fill("#user, input[name='_usuario_']", user.username);
    await page.fill("#pass, input[name='_pass_']", user.password || user.passwordEncrypted || "");

    // 3. Enviar login con #boton (icono fa-paw)
    console.log(\`[3/5] Enviando login mediante #boton...\`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 25000 }).catch(() => {}),
      page.click("#boton, button[name='boton'], button:has(.fa-paw), #formulario_inicio button[type='submit']")
    ]);

    // 4. Navegar a menú lateral Horario
    console.log(\`[4/5] Navegando a la sección 'Horario'...\`);
    await page.click("a:has-text('Horario'), .sidebar-menu a[href*='horario'], nav :text('Horario')");
    await page.waitForSelector("table, .table-responsive, :has-text('Horario')", { timeout: 15000 });

    // 5. Localizar y pulsar botón verde 'Checar' (#boton_checar)
    console.log(\`[5/5] Localizando botón verde 'Checar' (#boton_checar)...\`);
    const checarSelector = "#boton_checar, button#boton_checar, button[onclick*='checar'], button:has-text('Checar'), .btn-success.btn-lg";
    await page.waitForSelector(checarSelector, { timeout: 10000 });
    const checkBtn = await page.$(checarSelector);

    if (checkBtn) {
      const isEnabled = await checkBtn.isEnabled();
      if (isEnabled) {
        await checkBtn.click();
        status = 'success';
        message = \`Botón verde 'Checar' presionado exitosamente para \${user.name || user.username}.\`;
        console.log(\`[✓ ÉXITO] \${message}\`);
        await page.waitForTimeout(2000);
      } else {
        status = 'success';
        message = \`El botón 'Checar' no estaba activo en este minuto para \${user.name || user.username}.\`;
        console.log(\`[INFO] \${message}\`);
      }
    } else {
      status = 'failed';
      message = "No se localizó el botón #boton_checar en el DOM.";
      console.log(\`[AVISO] \${message}\`);
    }

    // Captura de pantalla para auditoría
    const screenshotName = \`audit_\${user.username}_\${Date.now()}.png\`;
    await page.screenshot({ path: screenshotName, fullPage: true });
    console.log(\`[EVIDENCIA] Captura guardada: \${screenshotName}\`);

  } catch (error) {
    status = 'failed';
    message = \`Error en automatización: \${error.message}\`;
    console.error(\`[ERROR] \${message}\`);
    try {
      const errShot = \`error_\${user.username}_\${Date.now()}.png\`;
      await page.screenshot({ path: errShot, fullPage: true });
    } catch (_) {}
  } finally {
    await browser.close();
  }

  // Registrar resultado en Firestore
  const durationMs = Date.now() - startTime;
  try {
    const execId = \`exec_\${user.id}_\${Date.now()}\`;
    await setDoc(doc(db, 'uad_executions', execId), {
      id: execId,
      userId: user.id,
      userName: user.name || user.username,
      username: user.username,
      status,
      message,
      durationMs,
      executedAt: new Date().toISOString(),
      timeContext: timeContext.currentTime,
      day: timeContext.dayKey
    });

    await updateDoc(doc(db, 'uad_users', user.id), {
      lastRunAt: new Date().toISOString(),
      lastStatus: status
    });
    console.log("[FIREBASE] Bitácora guardada en Firestore exitosamente.");
  } catch (fbErr) {
    console.error("[FIREBASE ERROR] No se pudo guardar bitácora en Firestore:", fbErr.message);
  }
}

async function main() {
  console.log("=================================================");
  console.log("  ORQUESTADOR UAD (GITHUB ACTIONS + FIREBASE)");
  console.log("=================================================");

  const db = getFirebaseDB();
  const timeContext = getCDMXTime();
  console.log(\`[ZONA HORARIA CDMX] Hora: \${timeContext.currentTime} | Día: \${timeContext.dayKey.toUpperCase()}\`);

  const allUsers = await fetchActiveUsersFromFirebase(db);
  const targetFilter = process.env.TARGET_USER_INPUT || 'all';

  if (allUsers.length === 0) {
    console.log("=================================================");
    console.log("⚠️ AVISO: No hay docentes en la colección 'uad_users'.");
    console.log("Para sincronizar docentes:");
    console.log("1. Abre la aplicación web > pestaña 'Vinculación Firebase'");
    console.log("2. Haz clic en 'Subir Docentes Locales a Firestore'");
    console.log("=================================================");
    return;
  }

  let executedCount = 0;

  for (const user of allUsers) {
    if (targetFilter !== 'all' && user.id !== targetFilter && user.username !== targetFilter) {
      continue;
    }

    const schedule = user.weeklySchedule || {};
    const dayTimes = schedule[timeContext.dayKey] || user.scheduledTimes || [];

    const isManualRun = targetFilter !== 'all';
    const shouldRunNow = isManualRun || dayTimes.some(t => {
      const [th, tm] = t.split(':').map(Number);
      const [ch, cm] = timeContext.currentTime.split(':').map(Number);
      const targetMin = th * 60 + tm;
      const currentMin = ch * 60 + cm;
      return Math.abs(currentMin - targetMin) <= 15;
    });

    if (shouldRunNow) {
      executedCount++;
      await executeAttendanceCheck(db, user, timeContext);
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log(\`[OMITIDO] \${user.name || user.username} (\${user.username}) sin horario a las \${timeContext.currentTime} (Horarios: \${dayTimes.join(', ') || 'Ninguno'}).\`);
    }
  }

  console.log("\\n=================================================");
  console.log(\`  PROCESO COMPLETADO: \${executedCount} docente(s) procesado(s)\`);
  console.log("=================================================");
}

if (require.main === module) {
  main().catch(err => {
    console.error("\\n❌ Error fatal en la ejecución:", err.message);
    process.exit(1);
  });
}
`;

  const packageJsonContent = `{
  "name": "uad-cloud-worker",
  "version": "1.0.0",
  "description": "Worker desatendido para checado UAD alimentado por Firebase",
  "main": "worker-firebase.js",
  "scripts": {
    "start": "node worker-firebase.js"
  },
  "dependencies": {
    "firebase": "^10.8.0",
    "playwright": "^1.42.0",
    "dotenv": "^16.4.5"
  }
}`;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Workflow className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Backend Desatendido con GitHub Actions + Firebase</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                100% Autónomo &amp; Serverless
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Administra todos los docentes desde esta interfaz gráfica; GitHub Actions leerá la lista en tiempo real desde Firebase y ejecutará los checados puntualmente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub.com</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Step by step architecture explanation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">1</span>
              <span>Interfaz Gráfica (Este Panel)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Agregas, editas o das de baja docentes, sus contraseñas encriptadas y sus horarios de Lunes a Domingo. Con 1 clic sincronizas todo a <strong>Firebase Firestore</strong>.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Docentes en bóveda:</span>
            <span className="font-bold text-slate-800">{users.length} activos</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-black">2</span>
              <span>Nube Central (Firebase)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Actúa como el cerebro central no volátil. Contiene la colección <code className="text-orange-700 font-mono text-[11px]">uad_users</code> con las contraseñas e itinerarios y recibe los registros de auditoría.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Colecciones:</span>
            <span className="font-mono text-orange-600 font-semibold">uad_users, uad_executions</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">3</span>
              <span>Ejecutor Headless (GitHub Actions)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Se despierta automáticamente por cron, lee Firebase, abre <strong>Playwright Chromium</strong> en la nube, realiza el checado y adjunta capturas de pantalla de evidencia.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Costo de infraestructura:</span>
            <span className="font-bold text-emerald-600">$0.00 (Plan Gratis GitHub)</span>
          </div>
        </div>
      </div>

      {/* Tabs & Code Generator */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 pt-3 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-l border-r ${
              activeTab === 'workflow'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Github className="w-3.5 h-3.5 text-indigo-400" />
            <span>.github/workflows/checador.yml</span>
          </button>

          <button
            onClick={() => setActiveTab('worker')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-l border-r ${
              activeTab === 'worker'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>worker-firebase.js</span>
          </button>

          <button
            onClick={() => setActiveTab('secrets')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-l border-r ${
              activeTab === 'secrets'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            <span>Configuración de Secrets</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-l border-r ${
              activeTab === 'architecture'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>package.json del Worker</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 bg-slate-900 text-slate-100">
          {activeTab === 'workflow' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-indigo-400" />
                    <span>Flujo Automatizado de GitHub Actions</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Guarda este archivo en tu repositorio dentro de la carpeta <code className="text-cyan-300">.github/workflows/checador.yml</code>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(workflowYaml, 'workflow')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                >
                  {copiedKey === 'workflow' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'workflow' ? 'Copiado al portapapeles' : 'Copiar YAML'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto max-h-96">
                {workflowYaml}
              </pre>
            </div>
          )}

          {activeTab === 'worker' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    <span>Script de Playwright con Conexión a Firebase Firestore</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Guarda este archivo en la raíz de tu repositorio como <code className="text-amber-300">worker-firebase.js</code>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(workerFirebaseJs, 'worker')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                >
                  {copiedKey === 'worker' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'worker' ? 'Copiado' : 'Copiar Script JS'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-amber-200 overflow-x-auto max-h-96">
                {workerFirebaseJs}
              </pre>
            </div>
          )}

          {activeTab === 'secrets' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <span>Variables Secretas Requeridas en GitHub (Repository Secrets)</span>
              </h4>
              <p className="text-xs text-slate-400">
                Ve a tu repositorio de GitHub &gt; <strong>Settings</strong> &gt; <strong>Secrets and variables</strong> &gt; <strong>Actions</strong> &gt; <strong>New repository secret</strong> y agrega las siguientes 3 variables:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400">FIREBASE_PROJECT_ID</span>
                    <button
                      onClick={() => copyToClipboard('FIREBASE_PROJECT_ID', 's1')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedKey === 's1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">El ID de tu proyecto en Firebase (ej. <code>uad-asistencia-prod</code>).</p>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400">FIREBASE_API_KEY</span>
                    <button
                      onClick={() => copyToClipboard('FIREBASE_API_KEY', 's2')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedKey === 's2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">La clave Web API Key de tu aplicación en Firebase Console.</p>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400">FIREBASE_APP_ID</span>
                    <button
                      onClick={() => copyToClipboard('FIREBASE_APP_ID', 's3')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedKey === 's3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">Identificador de tu App Web en Firebase (ej. <code>1:16170...:web:...</code>).</p>
                </div>
              </div>

              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-200 mt-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-100">¡Ya no necesitas hardcodear usuarios ni contraseñas en GitHub!</strong>
                  <p className="text-[11px] text-emerald-300/90 mt-0.5">
                    Como GitHub Actions se conecta dinámicamente a Firestore, cualquier docente nuevo que agregues en este panel web será procesado automáticamente por GitHub en la siguiente ejecución sin necesidad de modificar el código ni los secretos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>package.json para el Repositorio del Worker</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Guarda este archivo en la raíz de tu repositorio como <code className="text-cyan-300">package.json</code>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(packageJsonContent, 'pkg')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                >
                  {copiedKey === 'pkg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'pkg' ? 'Copiado' : 'Copiar package.json'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto">
                {packageJsonContent}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
