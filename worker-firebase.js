/**
 * WORKER AUTÓNOMO DE PLAYWRIGHT PARA CHECADO UAD
 * Alimentado dinámicamente desde Firebase Firestore
 * Diseñado para ejecutarse en GitHub Actions o como microservicio desatendido
 */

const { chromium } = require('playwright');
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc 
} = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
  
  return { dayKey, currentTime, cdmxDate };
}

async function fetchActiveUsersFromFirebase() {
  console.log("[FIREBASE] Obteniendo lista de docentes desde colección 'uad_users'...");
  const snap = await getDocs(collection(db, 'uad_users'));
  const users = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.active !== false) {
      users.push({ id: d.id, ...data });
    }
  });
  console.log(`[FIREBASE] Total de docentes activos cargados: ${users.length}`);
  return users;
}

async function executeAttendanceCheck(user, timeContext) {
  console.log(`\n==================================================`);
  console.log(`[EJECUTANDO] Docente: ${user.name} (${user.username})`);
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
    const modal = await page.$("#modal-comunicado.in, #modal-comunicado.show, #modal-comunicado:not([style*='display: none'])");
    if (modal) {
      console.log("[AVISO] Modal institucional detectado. Descartando...");
      await page.click("#modal-comunicado .close, #modal-comunicado button").catch(() => {});
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
        message = `Botón verde 'Checar' presionado exitosamente para ${user.name}.`;
        console.log(`[✓ ÉXITO] ${message}`);
        await page.waitForTimeout(2000);
      } else {
        status = 'success';
        message = `El botón 'Checar' no estaba activo en este minuto para ${user.name}.`;
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
      userName: user.name,
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

  const timeContext = getCDMXTime();
  console.log(`[ZONA HORARIA CDMX] Hora: ${timeContext.currentTime} | Día: ${timeContext.dayKey.toUpperCase()}`);

  const allUsers = await fetchActiveUsersFromFirebase();
  const targetFilter = process.env.TARGET_USER_INPUT || 'all';

  for (const user of allUsers) {
    if (targetFilter !== 'all' && user.id !== targetFilter && user.username !== targetFilter) {
      continue;
    }

    const schedule = user.weeklySchedule || {};
    const dayTimes = schedule[timeContext.dayKey] || user.scheduledTimes || [];

    // Ventana de tolerancia de 15 minutos para cron
    const shouldRunNow = targetFilter !== 'all' || dayTimes.some(t => {
      const [th, tm] = t.split(':').map(Number);
      const [ch, cm] = timeContext.currentTime.split(':').map(Number);
      const targetMin = th * 60 + tm;
      const currentMin = ch * 60 + cm;
      return Math.abs(currentMin - targetMin) <= 15;
    });

    if (shouldRunNow) {
      await executeAttendanceCheck(user, timeContext);
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log(`[OMITIDO] ${user.name} (${user.username}) sin horario a las ${timeContext.currentTime} (${dayTimes.join(', ')}).`);
    }
  }

  console.log("\n=================================================");
  console.log("  PROCESO COMPLETADO EXITOSAMENTE");
  console.log("=================================================");
}

if (require.main === module) {
  main();
}

module.exports = { executeAttendanceCheck, fetchActiveUsersFromFirebase };
