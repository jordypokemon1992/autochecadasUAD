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
    # (Ejemplo: de 13:00 UTC a 02:00 UTC = 07:00 AM a 20:00 PM CDMX)
    - cron: '*/15 13-23 * * 1-5'
  workflow_dispatch: # Permite disparar manualmente con un clic en cualquier momento
    inputs:
      target_user_id:
        description: 'ID o matrícula específica (opcional)'
        required: false
        default: 'all'

jobs:
  execute-attendance:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout del Repositorio
        uses: actions/checkout@v4

      - name: Configurar Node.js 18
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'

      - name: Instalar Dependencias y Navegador Playwright
        run: |
          npm install
          npx playwright install chromium --with-deps

      - name: Ejecutar Worker Desatendido (Conectado a Firebase)
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
          retention-days: 14
`;

  const workerFirebaseJs = `/**
 * WORKER DESATENDIDO CONECTADO A FIREBASE FIRESTORE
 * 
 * 1. Se conecta a Firestore (colección 'uad_users').
 * 2. Consulta la hora actual (CDMX) y determina qué docentes deben checar en este bloque.
 * 3. Ejecuta Playwright Headless para cada docente.
 * 4. Guarda la bitácora y estado de éxito/error directamente en Firestore ('uad_executions').
 */

const { chromium } = require('playwright');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET_PORTAL = "https://portal.uad.mx/";

// Días de la semana para mapear
const DAYS_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function getCDMXTime() {
  // Ajuste a Zona Horaria America/Mexico_City
  const now = new Date();
  const cdmxString = now.toLocaleString("en-US", { timeZone: "America/Mexico_City" });
  const cdmxDate = new Date(cdmxString);
  
  const dayKey = DAYS_MAP[cdmxDate.getDay()];
  const hh = String(cdmxDate.getHours()).padStart(2, '0');
  const mm = String(cdmxDate.getMinutes()).padStart(2, '0');
  const currentTime = \`\${hh}:\${mm}\`;
  
  return { dayKey, currentTime, cdmxDate, fullString: cdmxDate.toISOString() };
}

async function fetchActiveUsersFromFirebase() {
  console.log("[FIREBASE] Consultando colección 'uad_users'...");
  const snap = await getDocs(collection(db, 'uad_users'));
  const users = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.active !== false) {
      users.push({ id: docSnap.id, ...data });
    }
  });
  console.log(\`[FIREBASE] \${users.length} usuarios activos obtenidos.\`);
  return users;
}

async function performAttendanceCheck(user, timeContext) {
  console.log(\`\\n--------------------------------------------------\`);
  console.log(\`[INICIO] Procesando docente: \${user.name} (\${user.username})\`);
  console.log(\`[HORARIO] Checado programado a las: \${timeContext.currentTime} [\${timeContext.dayKey}]\`);

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
    // 1. Acceso al portal
    console.log(\`[1/5] Navegando a \${TARGET_PORTAL}...\`);
    await page.goto(TARGET_PORTAL, { waitUntil: 'networkidle', timeout: 35000 });

    // Cerrar modal comunicado si aparece
    const modal = await page.$("#modal-comunicado.in, #modal-comunicado.show, #modal-comunicado:not([style*='display: none'])");
    if (modal) {
      console.log("[AVISO] Modal institucional detectado. Descartando...");
      await page.click("#modal-comunicado .close, #modal-comunicado button").catch(() => {});
    }

    // 2. Inyectar matrícula y contraseña
    console.log(\`[2/5] Ingresando matrícula en #user y contraseña en #pass...\`);
    await page.waitForSelector("#user, input[name='_usuario_']", { timeout: 12000 });
    await page.fill("#user, input[name='_usuario_']", user.username);
    await page.fill("#pass, input[name='_pass_']", user.password || user.passwordEncrypted || "");

    // 3. Click al botón de inicio de sesión con huella (#boton)
    console.log(\`[3/5] Enviando formulario con #boton...\`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 25000 }).catch(() => {}),
      page.click("#boton, button[name='boton'], button:has(.fa-paw), #formulario_inicio button[type='submit']")
    ]);

    // 4. Navegar al menú Horario
    console.log(\`[4/5] Navegando a sección Horario...\`);
    await page.click("a:has-text('Horario'), .sidebar-menu a[href*='horario'], nav :text('Horario')");
    await page.waitForSelector("table, .table-responsive, :has-text('Horario')", { timeout: 15000 });

    // 5. Localizar y pulsar botón verde 'Checar' (#boton_checar)
    console.log(\`[5/5] Comprobando disponibilidad de #boton_checar...\`);
    const checarSelector = "#boton_checar, button#boton_checar, button[onclick*='checar'], button:has-text('Checar'), .btn-success.btn-lg";
    await page.waitForSelector(checarSelector, { timeout: 10000 });
    const checkBtn = await page.$(checarSelector);

    if (checkBtn) {
      const isEnabled = await checkBtn.isEnabled();
      if (isEnabled) {
        await checkBtn.click();
        status = 'success';
        message = \`Botón verde 'Checar' accionado exitosamente para \${user.name}.\`;
        console.log(\`[✓ ÉXITO] \${message}\`);
        await page.waitForTimeout(2000);
      } else {
        status = 'success';
        message = \`El botón 'Checar' no estaba activo en este minuto para \${user.name}.\`;
        console.log(\`[INFO] \${message}\`);
      }
    } else {
      status = 'failed';
      message = "No se localizó el botón #boton_checar en el DOM.";
      console.log(\`[AVISO] \${message}\`);
    }

    // Captura de evidencia
    const screenshotName = \`audit_\${user.username}_\${Date.now()}.png\`;
    await page.screenshot({ path: screenshotName, fullPage: true });
    console.log(\`[EVIDENCIA] Captura guardada: \${screenshotName}\`);

  } catch (error) {
    status = 'failed';
    message = \`Error durante el proceso: \${error.message}\`;
    console.error(\`[ERROR] \${message}\`);
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
      userName: user.name,
      username: user.username,
      status,
      message,
      durationMs,
      executedAt: new Date().toISOString(),
      timeContext: timeContext.currentTime,
      day: timeContext.dayKey
    });

    // Actualizar estado del usuario en Firebase
    await updateDoc(doc(db, 'uad_users', user.id), {
      lastRunAt: new Date().toISOString(),
      lastStatus: status
    });
    console.log("[FIREBASE] Bitácora y estado sincronizados en Firestore.");
  } catch (fbErr) {
    console.error("[FIREBASE ERROR] No se pudo guardar el log en Firestore:", fbErr.message);
  }
}

async function main() {
  console.log("=================================================");
  console.log("  UAD AUTOMATION WORKER (GITHUB ACTIONS + FIREBASE)");
  console.log("=================================================");
  
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("[FATAL] Faltan las variables de entorno de Firebase (FIREBASE_API_KEY, FIREBASE_PROJECT_ID).");
    process.exit(1);
  }

  const timeContext = getCDMXTime();
  console.log(\`[TIME] Hora actual CDMX: \${timeContext.currentTime} (Día: \${timeContext.dayKey.toUpperCase()})\`);

  const allUsers = await fetchActiveUsersFromFirebase();
  const targetFilter = process.env.TARGET_USER_INPUT || 'all';

  for (const user of allUsers) {
    if (targetFilter !== 'all' && user.id !== targetFilter && user.username !== targetFilter) {
      continue;
    }

    const schedule = user.weeklySchedule || {};
    const dayTimes = schedule[timeContext.dayKey] || user.scheduledTimes || [];

    // Comprobar si corresponde ejecutar (con ventana de tolerancia de ±15 min)
    const shouldRunNow = targetFilter !== 'all' || dayTimes.some(t => {
      const [th, tm] = t.split(':').map(Number);
      const [ch, cm] = timeContext.currentTime.split(':').map(Number);
      const targetMin = th * 60 + tm;
      const currentMin = ch * 60 + cm;
      return Math.abs(currentMin - targetMin) <= 15;
    });

    if (shouldRunNow) {
      await performAttendanceCheck(user, timeContext);
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log(\`[SKIP] \${user.name} (\${user.username}) no tiene horario asignado a las \${timeContext.currentTime} (\${dayTimes.join(', ')}).\`);
    }
  }

  console.log("\\n=================================================");
  console.log("  PROCESO DE EJECUCIÓN FINALIZADO");
  console.log("=================================================");
}

main();
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
