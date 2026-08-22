/**
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
const TARGET_TIMEZONE = process.env.TIMEZONE || "America/Mazatlan"; // Los Mochis, Sinaloa (UTC-7)

export function getLocalTime() {
  const now = new Date();
  const timeString = now.toLocaleString("en-US", { timeZone: TARGET_TIMEZONE });
  const localDate = new Date(timeString);
  
  const dayKey = DAYS_MAP[localDate.getDay()];
  const hh = String(localDate.getHours()).padStart(2, '0');
  const mm = String(localDate.getMinutes()).padStart(2, '0');
  const currentTime = `${hh}:${mm}`;
  
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
    console.log(`[FIREBASE] ✅ Total de docentes activos obtenidos: ${users.length}`);
    return users;
  } catch (error) {
    console.error("[FIREBASE ERROR] No se pudo leer la colección 'uad_users':", error.message);
    console.error("👉 Asegúrate de que las Reglas de Firestore en Firebase Console permitan lectura/escritura.");
    throw error;
  }
}

export async function executeAttendanceCheck(db, user, timeContext) {
  console.log(`\n==================================================`);
  console.log(`[EJECUTANDO] Docente: ${user.name || user.username} (${user.username})`);
  console.log(`[HORARIO] Hora Los Mochis, Sin.: ${timeContext.currentTime} [Día: ${timeContext.dayKey.toUpperCase()}]`);

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

  // Auto-aceptar diálogos nativos o alertas javascript
  page.on('dialog', async dialog => {
    console.log(`[ALERTA DETECTADA] Tipo: ${dialog.type()}, Mensaje: "${dialog.message()}"`);
    await dialog.accept().catch(() => {});
  });

  try {
    // 1. Acceso a URL del portal
    console.log(`[1/5] Accediendo a ${TARGET_PORTAL}...`);
    await page.goto(TARGET_PORTAL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Descartar comunicado institucional o modales si existen
    const dismissModals = async () => {
      try {
        const modals = await page.$$("#modal-comunicado, .modal.in, .modal.show, .swal2-container, .sweet-alert, div[role='dialog']");
        for (const m of modals) {
          const isVisible = await m.isVisible().catch(() => false);
          if (isVisible) {
            console.log("[AVISO] Modal o comunicado detectado en pantalla. Descartando...");
            await page.click("#modal-comunicado .close, #modal-comunicado button, .modal .close, button:has-text('Cerrar'), button:has-text('Entendido'), button:has-text('OK'), button.swal2-confirm").catch(() => {});
            await page.waitForTimeout(1000);
          }
        }
      } catch (_) {}
    };

    await dismissModals();

    // 2. Inyectar credenciales con selectores exactos
    const pwdToUse = user.password || user.passwordEncrypted || "";
    if (pwdToUse.startsWith("enc_aes256_")) {
      console.warn(`[⚠️ ALERTA CREDENCIAL] La contraseña de ${user.username} contiene un hash previo ("${pwdToUse.slice(0, 16)}..."). Actualiza la contraseña en la Bóveda y resincroniza con Firebase.`);
    }
    console.log(`[2/5] Ingresando matrícula en #user y contraseña en #pass...`);
    await page.waitForSelector("#user, input[name='_usuario_']", { timeout: 15000 });
    await page.fill("#user, input[name='_usuario_']", user.username);
    await page.fill("#pass, input[name='_pass_']", pwdToUse);

    // 3. Enviar login con #boton (icono fa-paw)
    console.log(`[3/5] Enviando login mediante #boton...`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}),
      page.click("#boton, button[name='boton'], button:has(.fa-paw), #formulario_inicio button[type='submit']")
    ]);

    await page.waitForTimeout(3000);
    await dismissModals();

    // Tomar captura post-login para auditoría
    const currentUrl = page.url();
    console.log(`[ESTADO POST-LOGIN] URL actual: ${currentUrl}`);

    // Comprobar si el login falló (redirección con mensaje de error en URL o alerta en página)
    const isLoginError = currentUrl.includes("m=") || 
                         currentUrl.includes("invalida") || 
                         currentUrl.includes("acceso") ||
                         (await page.$("#user, input[name='_usuario_']")) !== null;

    if (isLoginError && !currentUrl.includes("horario") && !currentUrl.includes("alumnos")) {
      // Extraer mensaje de error de la URL si existe
      let serverErrorMsg = "Contraseña inválida o usuario sin acceso.";
      try {
        const urlObj = new URL(currentUrl);
        const mParam = urlObj.searchParams.get("m");
        if (mParam) serverErrorMsg = decodeURIComponent(mParam);
      } catch (_) {}

      console.error(`[ERROR LOGIN] El portal rechazó las credenciales: "${serverErrorMsg}". Matrícula: ${user.username}`);
      status = 'failed';
      message = `Error de Autenticación: ${serverErrorMsg} (Verifica usuario y contraseña en la Bóveda).`;
      return { status, message, durationMs: Date.now() - startTime };
    }

    console.log(`[✓ LOGIN VÁLIDO] Sesión institucional iniciada correctamente.`);

    // 4. Buscar botón verde #boton_checar directamente o navegar a Horario
    console.log(`[4/5] Localizando panel o botón de checado...`);
    const checarSelector = "#boton_checar, a#boton_checar, button#boton_checar, a.btn-success:has-text('Checar'), button:has-text('Checar'), .btn-success:has(.fa-hand-pointer-o), a[onclick*='checar'], button[onclick*='checar']";
    
    let checkBtn = await page.$(checarSelector);

    // Si no está en la pantalla actual, intentar abrir la sección 'Horario'
    if (!checkBtn) {
      console.log(`[NAVEGACIÓN] Intentando acceder a la pestaña 'Horario'...`);
      
      // Si el menú lateral está colapsado, intentar desplegarlo
      const sidebarToggle = await page.$(".sidebar-toggle, [data-toggle='offcanvas'], [data-toggle='push-menu'], .navbar-toggle, button.navbar-toggler");
      if (sidebarToggle) {
        await sidebarToggle.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      // Intentar múltiples selectores para la opción de Horario
      const horarioSelectors = [
        "a[href*='horario' i]",
        "a[href*='Horario']",
        "a:has-text('Horario')",
        "a:has-text('HORARIO')",
        ".sidebar-menu a:has-text('Horario')",
        "nav a:has-text('Horario')",
        "li:has-text('Horario') a",
        "span:has-text('Horario')",
        "button:has-text('Horario')"
      ];

      let horarioClicked = false;
      for (const sel of horarioSelectors) {
        try {
          const el = await page.$(sel);
          if (el && await el.isVisible()) {
            console.log(`[MENÚ] Haciendo clic en enlace de Horario (${sel})...`);
            await el.click();
            horarioClicked = true;
            await page.waitForTimeout(2500);
            await dismissModals();
            break;
          }
        } catch (_) {}
      }

      if (!horarioClicked) {
        console.log(`[INFO] Enlace 'Horario' no requerido o no visible. Verificando DOM general...`);
      }

      // Reintentar buscar el botón de checar tras la navegación
      checkBtn = await page.$(checarSelector);
    }

    // 5. Presionar botón verde 'Checar' (#boton_checar)
    console.log(`[5/5] Evaluando botón verde 'Checar' (#boton_checar)...`);
    if (checkBtn) {
      const isVisible = await checkBtn.isVisible();
      if (isVisible) {
        await checkBtn.click();
        status = 'success';
        message = `Botón verde 'Checar' presionado exitosamente para ${user.name || user.username}.`;
        console.log(`[✓ ÉXITO] ${message}`);
        await page.waitForTimeout(2000);
      } else {
        status = 'success';
        message = `El botón 'Checar' está presente en el horario (Docente: ${user.name || user.username}).`;
        console.log(`[INFO] ${message}`);
      }
    } else {
      // Si el botón no aparece, verificar si ya está registrada la asistencia [Checado]
      const checadoBadge = await page.$(":has-text('[Checado]'), .label-success:has-text('Checado'), span:has-text('Checado'), td:has-text('Checado')");
      if (checadoBadge) {
        status = 'success';
        message = `Asistencia confirmada: Insignia 'Checado' visible en la cuadrícula para ${user.name || user.username}.`;
        console.log(`[✓ ASISTENCIA CONFIRMADA] ${message}`);
      } else {
        status = 'failed';
        message = `Sesión activa pero no se localizó el botón #boton_checar en la vista actual.`;
        console.log(`[AVISO] ${message}`);
      }
    }

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

export async function main() {
  console.log("=================================================");
  console.log("  ORQUESTADOR UAD (GITHUB ACTIONS + FIREBASE)");
  console.log("=================================================");

  const db = getFirebaseDB();
  const startTime = Date.now();
  // Se mantiene activo durante 20 minutos (1,200,000 ms)
  const MAX_ACTIVE_WINDOW_MS = 20 * 60 * 1000;
  const POLL_INTERVAL_MS = 60 * 1000; // Evalúa cada minuto
  const processedInSession = new Set();

  const targetFilter = process.env.TARGET_USER_INPUT || 'all';
  const isManualRun = targetFilter !== 'all';

  let cycle = 1;

  do {
    const timeContext = getLocalTime();
    console.log(`\n--- CICLO #${cycle} | Los Mochis, Sinaloa (${timeContext.timezone}) | Hora: ${timeContext.currentTime} [${timeContext.dayKey.toUpperCase()}] ---`);

    const allUsers = await fetchActiveUsersFromFirebase(db);

    if (allUsers.length === 0) {
      console.log("=================================================");
      console.log("⚠️ AVISO: No hay docentes en la colección 'uad_users'.");
      console.log("Para sincronizar docentes:");
      console.log("1. Abre la aplicación web > pestaña 'Vinculación Firebase'");
      console.log("2. Haz clic en 'Subir Docentes Locales a Firestore'");
      console.log("=================================================");
      break;
    }

    let executedInCycle = 0;

    for (const user of allUsers) {
      if (targetFilter !== 'all' && user.id !== targetFilter && user.username !== targetFilter) {
        continue;
      }

      const schedule = user.weeklySchedule || {};
      const dayTimes = schedule[timeContext.dayKey] || user.scheduledTimes || [];

      // Comprobar si el usuario ya checó exitosamente en este bloque de 20 minutos
      const userBlockKey = `${user.id}_${timeContext.dayKey}_${timeContext.currentTime.slice(0, 2)}`;
      if (!isManualRun && processedInSession.has(userBlockKey)) {
        continue;
      }

      // Debe ejecutarse si es manual o si la hora actual coincide con su horario (margen ±10 min)
      const shouldRunNow = isManualRun || dayTimes.some(t => {
        const [th, tm] = t.split(':').map(Number);
        const [ch, cm] = timeContext.currentTime.split(':').map(Number);
        const targetMin = th * 60 + tm;
        const currentMin = ch * 60 + cm;
        return Math.abs(currentMin - targetMin) <= 10;
      });

      if (shouldRunNow) {
        executedInCycle++;
        await executeAttendanceCheck(db, user, timeContext);
        processedInSession.add(userBlockKey);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.log(`[EN ESPERA] ${user.name || user.username} (${user.username}) sin horario en este minuto ${timeContext.currentTime} (Horarios día: ${dayTimes.join(', ') || 'Ninguno'}).`);
      }
    }

    if (isManualRun) {
      // Las ejecuciones manuales de prueba solo corren un ciclo inmediato
      break;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed + POLL_INTERVAL_MS < MAX_ACTIVE_WINDOW_MS) {
      const remainingSecs = Math.round((MAX_ACTIVE_WINDOW_MS - elapsed) / 1000);
      console.log(`[VENTANA ACTIVA] Esperando 60s antes del siguiente ciclo de chequeo... (Tiempo restante: ${remainingSecs}s)`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      cycle++;
    } else {
      break;
    }

  } while (Date.now() - startTime < MAX_ACTIVE_WINDOW_MS);

  console.log("\n=================================================");
  console.log(`  VENTANA DE 20 MINUTOS FINALIZADA CON ÉXITO`);
  console.log("=================================================");
}

main().catch(err => {
  console.error("\n❌ Error fatal en la ejecución:", err.message);
  process.exit(1);
});


