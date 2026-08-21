/**
 * WORKER AUTÓNOMO DE PLAYWRIGHT PARA CHECADO UAD (CommonJS Version)
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
    missing.forEach(m => console.error(`  - ${m}`));
    console.error("\n👉 CÓMO SOLUCIONARLO:");
    console.error("1. Ve a tu repositorio en GitHub > Settings > Secrets and variables > Actions");
    console.error("2. Haz clic en 'New repository secret' y agrega cada una con sus valores de Firebase.");
    console.error("=================================================\n");
    throw new Error(`Faltan secrets requeridos en GitHub: ${missing.join(', ')}`);
  }

  const existing = getApps();
  const app = existing.length > 0 ? existing[0] : initializeApp({
    apiKey,
    projectId,
    appId,
    authDomain: `${projectId}.firebaseapp.com`
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
  const currentTime = `${hh}:${mm}`;
  
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
    console.log(`[FIREBASE] ✅ Total de docentes activos obtenidos: ${users.length}`);
    return users;
  } catch (error) {
    console.error("[FIREBASE ERROR] No se pudo leer la colección 'uad_users':", error.message);
    console.error("👉 Asegúrate de que las Reglas de Firestore en Firebase Console permitan lectura/escritura.");
    throw error;
  }
}

async function executeAttendanceCheck(db, user, timeContext) {
  console.log(`\n==================================================`);
  console.log(`[EJECUTANDO] Docente: ${user.name || user.username} (${user.username})`);
  console.log(`[HORARIO] Hora CDMX: ${timeContext.currentTime} [Día: ${timeContext.dayKey.toUpperCase()}]`);

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
    console.log(`[1/5] Accediendo a ${TARGET_PORTAL}...`);
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
    console.log(`[2/5] Ingresando matrícula en #user y contraseña en #pass...`);
    await page.waitForSelector("#user, input[name='_usuario_']", { timeout: 12000 });
    await page.fill("#user, input[name='_usuario_']", user.username);
    await page.fill("#pass, input[name='_pass_']", user.password || user.passwordEncrypted || "");

    // 3. Enviar login con #boton (icono fa-paw)
    console.log(`[3/5] Enviando login mediante #boton...`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 25000 }).catch(() => {}),
      page.click("#boton, button[name='boton'], button:has(.fa-paw), #formulario_inicio button[type='submit']")
    ]);

    // 4. Navegar a menú lateral Horario
    console.log(`[4/5] Navegando a la sección 'Horario'...`);
    await page.click("a:has-text('Horario'), .sidebar-menu a[href*='horario'], nav :text('Horario')");
    await page.waitForSelector("table, .table-responsive, :has-text('Horario')", { timeout: 15000 });

    // 5. Localizar y pulsar botón verde 'Checar' (#boton_checar)
    console.log(`[5/5] Localizando botón verde 'Checar' (#boton_checar)...`);
    const checarSelector = "#boton_checar, button#boton_checar, button[onclick*='checar'], button:has-text('Checar'), .btn-success.btn-lg";
    await page.waitForSelector(checarSelector, { timeout: 10000 });
    const checkBtn = await page.$(checarSelector);

    if (checkBtn) {
      const isEnabled = await checkBtn.isEnabled();
      if (isEnabled) {
        await checkBtn.click();
        status = 'success';
        message = `Botón verde 'Checar' presionado exitosamente para ${user.name || user.username}.`;
        console.log(`[✓ ÉXITO] ${message}`);
        await page.waitForTimeout(2000);
      } else {
        status = 'success';
        message = `El botón 'Checar' no estaba activo en este minuto para ${user.name || user.username}.`;
        console.log(`[INFO] ${message}`);
      }
    } else {
      status = 'failed';
      message = "No se localizó el botón #boton_checar en el DOM.";
      console.log(`[AVISO] ${message}`);
    }

    // Captura de pantalla para auditoría
    const screenshotName = `audit_${user.username}_${Date.now()}.png`;
    await page.screenshot({ path: screenshotName, fullPage: true });
    console.log(`[EVIDENCIA] Captura guardada: ${screenshotName}`);

  } catch (error) {
    status = 'failed';
    message = `Error en automatización: ${error.message}`;
    console.error(`[ERROR] ${message}`);
    try {
      const errShot = `error_${user.username}_${Date.now()}.png`;
      await page.screenshot({ path: errShot, fullPage: true });
    } catch (_) {}
  } finally {
    await browser.close();
  }

  // Registrar resultado en Firestore
  const durationMs = Date.now() - startTime;
  try {
    const execId = `exec_${user.id}_${Date.now()}`;
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
  console.log(`[ZONA HORARIA CDMX] Hora: ${timeContext.currentTime} | Día: ${timeContext.dayKey.toUpperCase()}`);

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

    // Si el usuario disparó manualmente o si corresponde por horario (ventana ±15 min)
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
      console.log(`[OMITIDO] ${user.name || user.username} (${user.username}) sin horario a las ${timeContext.currentTime} (Horarios: ${dayTimes.join(', ') || 'Ninguno'}).`);
    }
  }

  console.log("\n=================================================");
  console.log(`  PROCESO COMPLETADO: ${executedCount} docente(s) procesado(s)`);
  console.log("=================================================");
}

main().catch(err => {
  console.error("\n❌ Error fatal en la ejecución:", err.message);
  process.exit(1);
});

module.exports = { executeAttendanceCheck, fetchActiveUsersFromFirebase, getFirebaseDB };
