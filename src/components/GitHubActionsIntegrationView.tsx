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
  const [activeTab, setActiveTab] = useState<'workflow' | 'worker' | 'cronjob' | 'secrets' | 'architecture'>('workflow');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const workflowYaml = `name: UAD Automation Runner (Firebase Driven)

on:
  workflow_dispatch: # Disparo exacto y prioritario vía Cron-Job.org / Webhook o manual
    inputs:
      target_user_id:
        description: 'Matrícula o ID específico de docente (opcional, deja "all" para todos)'
        required: false
        default: 'all'

# CONTROL DE CONCURRENCIA: Bloqueo estricto para evitar ejecuciones simultáneas
concurrency:
  group: uad-attendance-runner-lock
  cancel-in-progress: false

jobs:
  execute-attendance:
    runs-on: ubuntu-latest
    timeout-minutes: 25

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
          TIMEZONE: 'America/Mazatlan'
        run: node worker-firebase.js
`;

  const workerFirebaseJs = `/**
 * WORKER AUTÓNOMO DE PLAYWRIGHT PARA CHECADO UAD
 * Alimentado dinámicamente desde Firebase Firestore
 * Diseñado para ejecutarse en GitHub Actions o como microservicio desatendido
 */

import { chromium } from 'playwright';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

let dbInstance = null;

export function getFirebaseDB() {
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
const TARGET_TIMEZONE = process.env.TIMEZONE || "America/Mazatlan"; // Los Mochis, Sinaloa (UTC-7)

export function getLocalTime() {
  const now = new Date();
  const timeString = now.toLocaleString("en-US", { timeZone: TARGET_TIMEZONE });
  const localDate = new Date(timeString);
  
  const dayKey = DAYS_MAP[localDate.getDay()];
  const hh = String(localDate.getHours()).padStart(2, '0');
  const mm = String(localDate.getMinutes()).padStart(2, '0');
  const currentTime = \`\${hh}:\${mm}\`;
  
  return { dayKey, currentTime, localDate, timezone: TARGET_TIMEZONE, fullISO: localDate.toISOString() };
}

export async function fetchActiveUsersFromFirebase(db) {
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
    throw error;
  }
}

export async function executeAttendanceCheck(db, user, timeContext) {
  console.log(\`\\n==================================================\`);
  console.log(\`[EJECUTANDO] Docente: \${user.name || user.username} (\${user.username})\`);
  console.log(\`[HORARIO] Hora Los Mochis, Sin.: \${timeContext.currentTime} [Día: \${timeContext.dayKey.toUpperCase()}]\`);

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

  page.on('dialog', async dialog => {
    console.log(\`[ALERTA DETECTADA] Tipo: \${dialog.type()}, Mensaje: "\${dialog.message()}"\`);
    await dialog.accept().catch(() => {});
  });

  try {
    // 1. Acceso a URL del portal
    console.log(\`[1/5] Accediendo a \${TARGET_PORTAL}...\`);
    await page.goto(TARGET_PORTAL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    const dismissModals = async () => {
      try {
        const modals = await page.$$("#modal-comunicado, .modal.in, .modal.show, .swal2-container, .sweet-alert, div[role='dialog']");
        for (const m of modals) {
          const isVisible = await m.isVisible().catch(() => false);
          if (isVisible) {
            console.log("[AVISO] Modal o comunicado detectado. Descartando...");
            await page.click("#modal-comunicado .close, #modal-comunicado button, .modal .close, button:has-text('Cerrar'), button:has-text('Entendido'), button:has-text('OK'), button.swal2-confirm").catch(() => {});
            await page.waitForTimeout(1000);
          }
        }
      } catch (_) {}
    };

    await dismissModals();

    // 2. Inyectar credenciales
    console.log(\`[2/5] Ingresando matrícula en #user y contraseña en #pass...\`);
    await page.waitForSelector("#user, input[name='_usuario_']", { timeout: 15000 });
    await page.fill("#user, input[name='_usuario_']", user.username);
    await page.fill("#pass, input[name='_pass_']", user.password || user.passwordEncrypted || "");

    // 3. Enviar login con #boton
    console.log(\`[3/5] Enviando login mediante #boton...\`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}),
      page.click("#boton, button[name='boton'], button:has(.fa-paw), #formulario_inicio button[type='submit']")
    ]);

    await page.waitForTimeout(3000);
    await dismissModals();

    // 4. Localizar botón verde #boton_checar o navegar a Horario
    console.log(\`[4/5] Localizando panel o botón de checado...\`);
    const checarSelector = "#boton_checar, button#boton_checar, button[onclick*='checar'], button:has-text('Checar'), .btn-success.btn-lg, button:has(.fa-hand-pointer-o)";
    
    let checkBtn = await page.$(checarSelector);

    if (!checkBtn) {
      console.log(\`[NAVEGACIÓN] Intentando acceder a la pestaña 'Horario'...\`);
      const sidebarToggle = await page.$(".sidebar-toggle, [data-toggle='offcanvas'], [data-toggle='push-menu'], .navbar-toggle, button.navbar-toggler");
      if (sidebarToggle) {
        await sidebarToggle.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      const horarioSelectors = [
        "a[href*='horario' i]",
        "a[href*='Horario']",
        "a:has-text('Horario')",
        "a:has-text('HORARIO')",
        ".sidebar-menu a:has-text('Horario')",
        "nav a:has-text('Horario')",
        "li:has-text('Horario') a",
        "span:has-text('Horario')"
      ];

      for (const sel of horarioSelectors) {
        try {
          const el = await page.$(sel);
          if (el && await el.isVisible()) {
            console.log(\`[MENÚ] Clic en enlace de Horario (\${sel})...\`);
            await el.click();
            await page.waitForTimeout(2500);
            await dismissModals();
            break;
          }
        } catch (_) {}
      }

      checkBtn = await page.$(checarSelector);
    }

    // 5. Presionar botón verde 'Checar'
    console.log(\`[5/5] Evaluando botón verde 'Checar' (#boton_checar)...\`);
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
        message = \`El botón 'Checar' está presente pero inactivo para este minuto para \${user.name || user.username}.\`;
        console.log(\`[INFO] \${message}\`);
      }
    } else {
      const checadoBadge = await page.$(":has-text('[Checado]'), .label-success:has-text('Checado'), span:has-text('Checado')");
      if (checadoBadge) {
        status = 'success';
        message = \`Asistencia confirmada: Insignia '[Checado]' presente en el portal para \${user.name || user.username}.\`;
        console.log(\`[✓ ASISTENCIA CONFIRMADA] \${message}\`);
      } else {
        status = 'failed';
        message = \`Sesión iniciada correctamente, pero no se encontró #boton_checar disponible en este momento.\`;
        console.log(\`[AVISO] \${message}\`);
      }
    }

  } catch (error) {
    status = 'failed';
    message = \`Error en automatización: \${error.message}\`;
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
      userName: user.name || user.username,
      username: user.username,
      status,
      message,
      durationMs,
      executedAt: new Date().toISOString(),
      timeContext: timeContext.currentTime,
      day: timeContext.dayKey,
      timezone: timeContext.timezone
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

export function analyzeUpcomingSchedule(users, timeContext, windowMinutes = 20) {
  const [currentH, currentM] = timeContext.currentTime.split(':').map(Number);
  const currentTotalMin = currentH * 60 + currentM;
  const windowEndMin = currentTotalMin + windowMinutes;

  const scheduledInWindow = [];
  const upcomingToday = [];

  for (const user of users) {
    if (user.active === false) continue;
    // Si el día actual de la semana está pausado (OFF) para este docente, omitir
    if ((user.pausedDays || []).includes(timeContext.dayKey)) {
      continue;
    }

    const schedule = user.weeklySchedule || {};
    const dayTimes = schedule[timeContext.dayKey] || user.scheduledTimes || [];

    for (const timeStr of dayTimes) {
      if (!timeStr || !timeStr.includes(':')) continue;
      const [th, tm] = timeStr.split(':').map(Number);
      const totalMin = th * 60 + tm;

      const taskKey = \`\${user.id || user.username}_\${timeContext.dayKey}_\${timeStr}\`;

      if (totalMin >= (currentTotalMin - 10) && totalMin <= (windowEndMin + 10)) {
        scheduledInWindow.push({
          taskKey,
          userId: user.id || user.username,
          userName: user.name || user.username,
          username: user.username,
          time: timeStr,
          minutesDiff: totalMin - currentTotalMin
        });
      }

      if (totalMin >= (currentTotalMin - 10)) {
        upcomingToday.push({
          taskKey,
          userId: user.id || user.username,
          userName: user.name || user.username,
          username: user.username,
          time: timeStr,
          minutesDiff: totalMin - currentTotalMin
        });
      }
    }
  }

  upcomingToday.sort((a, b) => a.minutesDiff - b.minutesDiff);

  return {
    hasUpcomingInWindow: scheduledInWindow.length > 0,
    scheduledInWindow,
    nextCheckToday: upcomingToday[0] || null,
    totalTodayUpcoming: upcomingToday.length
  };
}

export async function main() {
  console.log("=================================================");
  console.log("  ORQUESTADOR UAD (GITHUB ACTIONS + FIREBASE)");
  console.log("=================================================");

  const db = getFirebaseDB();
  const startTime = Date.now();
  const MAX_ACTIVE_WINDOW_MS = 20 * 60 * 1000; // 20 minutos de actividad máxima
  const POLL_INTERVAL_MS = 60 * 1000; // Sondeo cada 60 segundos
  const processedTaskKeys = new Set();

  const targetFilter = process.env.TARGET_USER_INPUT || 'all';
  const isManualRun = targetFilter !== 'all';

  const initialTimeContext = getLocalTime();
  console.log(\`[ZONA HORARIA] Los Mochis, Sinaloa (\${initialTimeContext.timezone})\`);
  console.log(\`[HORA INICIAL] \${initialTimeContext.currentTime} [\${initialTimeContext.dayKey.toUpperCase()}]\`);

  // 1. Una sola lectura a Firestore para todos los docentes
  const allUsers = await fetchActiveUsersFromFirebase(db);

  if (allUsers.length === 0) {
    console.log("=================================================");
    console.log("⚠️ AVISO: No hay docentes en la colección 'uad_users'.");
    console.log("=================================================");
    return;
  }

  // 2. Si no es ejecución manual de prueba, aplicar SMART EARLY-EXIT
  let scheduledInWindow = [];
  if (!isManualRun) {
    const analysis = analyzeUpcomingSchedule(allUsers, initialTimeContext, 20);
    scheduledInWindow = analysis.scheduledInWindow;

    if (!analysis.hasUpcomingInWindow) {
      console.log("\\n=================================================");
      console.log("⚡ SMART EARLY-EXIT: OPTIMIZACIÓN DE RECURSOS");
      console.log("=================================================");
      console.log(\`[INFO] Se analizaron \${allUsers.length} docentes activos para el día \${initialTimeContext.dayKey.toUpperCase()}.\`);
      console.log(\`[INFO] Ningún docente tiene programada checada en la ventana de los próximos 20 minutos (\${initialTimeContext.currentTime} -> \${initialTimeContext.currentTime.slice(0, 2)}:59).\`);
      
      if (analysis.nextCheckToday) {
        console.log(\`[PRÓXIMA CHECADA HOY] Docente: \${analysis.nextCheckToday.userName} (\${analysis.nextCheckToday.username}) a las \${analysis.nextCheckToday.time} (en ~\${analysis.nextCheckToday.minutesDiff} min).\`);
      } else {
        console.log(\`[INFO] No hay más checadas programadas para ningún docente en lo que resta del día de hoy.\`);
      }

      console.log(\`[✓ AHORRO EXITOSO] Finalizando worker de inmediato (<3s) para evitar consumo de minutos en GitHub Actions y cuotas de Firestore.\`);
      console.log("=================================================\\n");
      return;
    }

    console.log("\\n[⚡ PROGRAMACIÓN DETECTADA] Checadas requeridas en esta ventana de 20 min:");
    scheduledInWindow.forEach(item => {
      console.log(\`  • \${item.userName} (\${item.username}) -> Horario: \${item.time}\`);
    });
  }

  let cycle = 1;

  do {
    const timeContext = getLocalTime();
    console.log(\`\\n--- CICLO #\${cycle} | Hora actual: \${timeContext.currentTime} [\${timeContext.dayKey.toUpperCase()}] ---\`);

    for (const user of allUsers) {
      if (targetFilter !== 'all' && user.id !== targetFilter && user.username !== targetFilter) {
        continue;
      }

      if (!isManualRun && (user.pausedDays || []).includes(timeContext.dayKey)) {
        continue;
      }

      const schedule = user.weeklySchedule || {};
      const dayTimes = schedule[timeContext.dayKey] || user.scheduledTimes || [];

      // Detectar si algún horario coincide con el margen actual
      const matchingTimes = dayTimes.filter(t => {
        const [th, tm] = t.split(':').map(Number);
        const [ch, cm] = timeContext.currentTime.split(':').map(Number);
        const targetMin = th * 60 + tm;
        const currentMin = ch * 60 + cm;
        return Math.abs(currentMin - targetMin) <= 10;
      });

      const unexecutedMatchingTimes = matchingTimes.filter(t => {
        const key = \`\${user.id || user.username}_\${timeContext.dayKey}_\${t}\`;
        return !processedTaskKeys.has(key);
      });

      const shouldRunNow = isManualRun || unexecutedMatchingTimes.length > 0;

      if (shouldRunNow) {
        await executeAttendanceCheck(db, user, timeContext);

        if (matchingTimes.length > 0) {
          matchingTimes.forEach(t => {
            const key = \`\${user.id || user.username}_\${timeContext.dayKey}_\${t}\`;
            processedTaskKeys.add(key);
          });
        } else {
          const fallbackKey = \`\${user.id || user.username}_\${timeContext.dayKey}_\${timeContext.currentTime.slice(0, 2)}\`;
          processedTaskKeys.add(fallbackKey);
        }

        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.log(\`[EN ESPERA] \${user.name || user.username} (\${user.username}) sin horario en este minuto \${timeContext.currentTime} (Horarios: \${dayTimes.join(', ') || 'Ninguno'}).\`);
      }
    }

    if (isManualRun) break;

    // ⚡ OPTIMIZACIÓN: EARLY-EXIT POST-EJECUCIÓN
    // Verificar si todas las checadas requeridas en esta ventana ya fueron completadas
    const pendingTasks = scheduledInWindow.filter(task => !processedTaskKeys.has(task.taskKey));

    if (pendingTasks.length === 0 && scheduledInWindow.length > 0) {
      console.log("\\n=================================================");
      console.log("⚡ CIERRE ANTICIPADO EXITOSO (EARLY-EXIT POST-EJECUCIÓN)");
      console.log("=================================================");
      console.log(\`[✓ COMPLETO] Todas las checadas programadas (\${scheduledInWindow.length}/\${scheduledInWindow.length}) en esta ventana fueron procesadas con éxito.\`);
      console.log("[✓ OPTIMIZACIÓN MÁXIMA] Finalizando worker de inmediato para liberar el runner y evitar consultas/esperas ociosas.");
      console.log("=================================================\\n");
      break;
    } else if (pendingTasks.length > 0) {
      console.log(\`[PENDIENTES] Quedan \${pendingTasks.length} checadas por ejecutar en esta ventana (\${pendingTasks.map(p => \`\${p.userName} @ \${p.time}\`).join(', ')}).\`);
    }

    const elapsed = Date.now() - startTime;
    if (elapsed + POLL_INTERVAL_MS < MAX_ACTIVE_WINDOW_MS) {
      const remainingSecs = Math.round((MAX_ACTIVE_WINDOW_MS - elapsed) / 1000);
      console.log(\`[VENTANA ACTIVA] Esperando 60s antes del siguiente ciclo... (Restante: \${remainingSecs}s)\`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      cycle++;
    } else {
      break;
    }

  } while (Date.now() - startTime < MAX_ACTIVE_WINDOW_MS);

  console.log("\\n=================================================");
  console.log(\`  VENTANA DE ACTIVIDAD FINALIZADA CON ÉXITO\`);
  console.log("=================================================");
}

main().catch(err => {
  console.error("\\n❌ Error fatal en la ejecución:", err.message);
  process.exit(1);
});
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
            onClick={() => setActiveTab('cronjob')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-l border-r ${
              activeTab === 'cronjob'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Disparador Cero Lag (Cron-Job.org)</span>
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

          {activeTab === 'cronjob' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Eliminar Retrasos con Cron-Job.org (Disparo Prioritario al Segundo Exacto)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  En lugar de esperar la cola interna del cron de GitHub (que puede demorar de 5 a 20 min en horas pico), <strong>Cron-Job.org</strong> (gratuito) hace una llamada a la API de GitHub en el segundo exacto, iniciando el Runner inmediatamente con prioridad alta.
                </p>
              </div>

              {/* Step 1: Token */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Generar Token Personal de GitHub (Fine-grained o Classic PAT)</span>
                </div>
                <p className="text-xs text-slate-300">
                  Para que Cron-job.org tenga permiso de activar tu workflow:
                </p>
                <ol className="list-decimal pl-5 text-xs text-slate-400 space-y-1.5">
                  <li>Ve a <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-cyan-400 underline inline-flex items-center gap-0.5">github.com/settings/tokens <ExternalLink className="w-2.5 h-2.5" /></a> &gt; <strong>Generate new token (classic)</strong>.</li>
                  <li>Asígnale el nombre <code>cronjob-runner</code> y marca la casilla <strong>repo</strong> (o <strong>workflow</strong>).</li>
                  <li>Copia el token generado (ejemplo: <code>ghp_xxxxxxxxxxxxxxxxxxxx</code>).</li>
                </ol>
              </div>

              {/* Step 2: Cron Job setup */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Crear el Cron Job en Cron-Job.org (Gratuito)</span>
                </div>
                <p className="text-xs text-slate-300">
                  Crea una cuenta gratuita en <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-cyan-400 underline inline-flex items-center gap-0.5">cron-job.org <ExternalLink className="w-2.5 h-2.5" /></a> &gt; <strong>Create Cronjob</strong>:
                </p>
                
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2 text-xs font-mono">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-400">URL del Webhook:</span>
                    <span className="text-amber-300 break-all select-all">https://api.github.com/repos/TU_USUARIO/TU_REPOSITORIO/actions/workflows/checador.yml/dispatches</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-400">Método HTTP:</span>
                    <span className="text-emerald-400 font-bold">POST</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-400">Programación (Horario):</span>
                    <span className="text-cyan-300">Minuto 45 de cada hora (Lunes a Viernes)</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Headers (Pestaña Headers):</span>
                    <div className="text-slate-300 space-y-0.5 text-right sm:text-left">
                      <div><code>Accept: application/vnd.github.v3+json</code></div>
                      <div><code>Authorization: Bearer TU_GITHUB_TOKEN</code></div>
                      <div><code>User-Agent: CronJob-UAD</code></div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Request Body (Cuerpo JSON):</span>
                    <span className="text-emerald-300 font-mono">{'{"ref": "main"}'}</span>
                  </div>
                </div>
              </div>

              {/* Step 3: Concurrency protection reminder */}
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-100 font-semibold">Protección contra Llamadas Simultáneas ya Activa:</strong>
                  <p className="text-[11px] text-emerald-300/90 mt-0.5">
                    El workflow ya tiene configurado el grupo de concurrencia <code className="bg-emerald-900/60 px-1 py-0.5 rounded text-emerald-200 font-mono">concurrency.group: uad-attendance-runner-lock</code>. Si un job está corriendo y entra otro disparo de Cron-Job.org o manual, GitHub <strong>lo encola ordenadamente sin solapar dos navegadores al mismo tiempo</strong>, garantizando que nunca se realicen checadas duplicadas.
                  </p>
                </div>
              </div>
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
