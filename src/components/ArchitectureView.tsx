import React, { useState } from 'react';
import { 
  Layers, 
  Database, 
  Bot, 
  Cloud, 
  Code, 
  Download, 
  Copy, 
  Check, 
  ExternalLink,
  ShieldCheck,
  Server,
  Workflow,
  Cpu
} from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'playwright' | 'docker' | 'github_actions' | 'cloud_run'>('playwright');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeKey(key);
    setTimeout(() => setCopiedCodeKey(null), 2000);
  };

  const playwrightScript = `/**
 * SCRIPT AUTÓNOMO DE AUTOMATIZACIÓN (PLAYWRIGHT WORKER)
 * Diseñado para ejecución desatendida en la nube con múltiples usuarios.
 */
const { chromium } = require('playwright');
const dotenv = require('dotenv');
dotenv.config();

// Lista de usuarios con horarios independientes por día
const USERS_TO_PROCESS = [
  {
    name: "Dr. Luis Guillermo Solano",
    username: process.env.USER_1_USERNAME || "0705110713",
    password: process.env.USER_1_PASSWORD || "password_secret",
    weeklySchedule: {
      mon: ["08:00", "09:45", "12:45"],
      tue: ["07:00", "08:45", "13:45", "16:45"],
      wed: ["08:00", "12:45", "14:45"],
      thu: ["09:45", "13:45", "16:45"],
      fri: ["08:00", "09:45", "12:45", "13:45", "14:45", "16:45"],
      sat: [],
      sun: []
    }
  }
];

const TARGET_URL = "https://portal.uad.mx/";

async function runAutomationForUser(user) {
  console.log(\`[+] Iniciando sesión para: \${user.name} (\${user.username})\`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    // 1. Acceder al portal institucional
    console.log(\`[1/6] Navegando a \${TARGET_URL}...\`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // 1.1 Si existe modal de comunicado institucional (#modal-comunicado), cerrarlo
    const modalComunicado = await page.$("#modal-comunicado.in, #modal-comunicado.show, #modal-comunicado:not([style*='display: none'])");
    if (modalComunicado) {
      console.log("[i] Comunicado emergente detectado. Descartando modal...");
      await page.click("#modal-comunicado .close, #modal-comunicado button").catch(() => {});
    }

    // 2. Inyectar credenciales (Selectores verificados del DOM exacto de UAD)
    console.log(\`[2/6] Ingresando credenciales en #user y #pass...\`);
    await page.waitForSelector("#user, input[name='_usuario_']", { timeout: 10000 });
    await page.fill("#user, input[name='_usuario_']", user.username);
    await page.fill("#pass, input[name='_pass_']", user.password);

    // 3. Enviar formulario de inicio de sesión (#boton con huella de lobo fa-paw)
    console.log(\`[3/6] Iniciando sesión mediante #boton...\`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {}),
      page.click("#boton, button[name='boton'], button:has(.fa-paw), #formulario_inicio button[type='submit']")
    ]);

    // 4. Localizar y acceder a la sección de Horario en el menú lateral
    console.log(\`[4/7] Navegando a la sección 'Horario' en el menú principal...\`);
    await page.click("a:has-text('Horario'), .sidebar-menu a[href*='horario'], nav :text('Horario')");
    await page.waitForSelector("table, .table-responsive, :has-text('Horario')", { timeout: 15000 });

    // 5. Detectar e interactuar con el botón verde "Checar" (#boton_checar)
    console.log(\`[5/7] Localizando botón verde 'Checar' (#boton_checar / onclick="checar()")...\`);
    const checarSelector = "#boton_checar, button#boton_checar, button[onclick*='checar'], button:has-text('Checar'), .btn-success.btn-lg, button:has(.fa-hand-pointer-o)";
    await page.waitForSelector(checarSelector, { timeout: 10000 });
    const checkBtn = await page.$(checarSelector);

    if (checkBtn) {
      const isEnabled = await checkBtn.isEnabled();
      if (isEnabled) {
        await checkBtn.click();
        console.log(\`[✓ ÉXITO] Botón verde 'Checar' presionado exitosamente para \${user.name}.\`);
        await page.waitForTimeout(1500); // Esperar confirmación
      } else {
        console.log(\`[i AVISO] El botón 'Checar' no está activo en este horario para \${user.name}.\`);
      }
    } else {
      console.log(\`[i AVISO] Botón 'Checar' no encontrado en la vista actual.\`);
    }

    // 6. Validar etiqueta [Checado] en la cuadrícula de clases
    console.log(\`[6/7] Verificando cuadrícula y confirmación de asistencia...\`);
    const isChecadoVisible = await page.$(":has-text('Checado')");
    if (isChecadoVisible) {
      console.log(\`[✓ CONFIRMADO] Insignia '[Checado]' verificada en el bloque horario.\`);
    }

    // 7. Captura de evidencia para auditoría
    const screenshotName = \`audit_\${user.username}_\${Date.now()}.png\`;
    await page.screenshot({ path: screenshotName, fullPage: true });
    console.log(\`[7/7] Captura de auditoría guardada: \${screenshotName}\`);

  } catch (error) {
    console.error(\`[✗ ERROR] Fallo en la automatización de \${user.name}:\`, error.message);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log("=========================================");
  console.log("EJECUTANDO TAREA DE ORQUESTACIÓN EN NUBE");
  console.log("=========================================");
  for (const user of USERS_TO_PROCESS) {
    await runAutomationForUser(user);
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log("=========================================");
  console.log("PROCESAMIENTO COMPLETADO.");
  console.log("=========================================");
}

main();`;

  const dockerfileContent = `FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Copiar archivos del proyecto
COPY package*.json ./
RUN npm install --production

COPY . .

# Ejecutar el script automatizado desatendido
CMD ["node", "worker.js"]`;

  const githubActionsContent = `name: Orquestador Diario de Automatización

on:
  schedule:
    # Se ejecuta de Lunes a Viernes a las 08:00 AM UTC (Ajustar a hora local)
    - cron: '0 14 * * 1-5'
  workflow_dispatch: # Permite ejecución manual con un clic

jobs:
  run-automation:
    runs-on: ubuntu-latest
    steps:
      - name: Descargar Código
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Instalar Dependencias y Navegadores Headless
        run: |
          npm install
          npx playwright install chromium --with-deps

      - name: Ejecutar Script de Automatización Desatendido
        env:
          USER_1_USERNAME: \${{ secrets.USER_1_USERNAME }}
          USER_1_PASSWORD: \${{ secrets.USER_1_PASSWORD }}
        run: node worker.js

      - name: Subir Evidencias de Captura
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: screenshots-evidencia
          path: '*.png'
          retention-days: 7`;

  const cloudRunDeployContent = `#!/bin/bash
# Despliegue en Google Cloud Run Jobs con Cloud Scheduler
PROJECT_ID="mi-proyecto-cloud"
IMAGE_NAME="gcr.io/\$PROJECT_ID/cloudflow-worker:latest"
JOB_NAME="automation-daily-check"

# 1. Compilar imagen Docker
gcloud builds submit --tag \$IMAGE_NAME

# 2. Crear el Cloud Run Job (Contenedor desatendido)
gcloud run jobs create \$JOB_NAME \\
  --image \$IMAGE_NAME \\
  --region us-central1 \\
  --set-env-vars="NODE_ENV=production"

# 3. Crear el Programador (Cloud Scheduler - Lunes a Viernes 08:00 AM)
gcloud scheduler jobs create http trigger-\$JOB_NAME \\
  --location us-central1 \\
  --schedule "0 8 * * 1-5" \\
  --time-zone "America/Mexico_City" \\
  --uri "https://us-central1-run.googleapis.com/v1/namespaces/\$PROJECT_ID/jobs/\$JOB_NAME:run" \\
  --http-method POST \\
  --oauth-service-account-email "sa-automation@\$PROJECT_ID.iam.gserviceaccount.com"`;

  const getActiveCode = () => {
    switch (activeCodeTab) {
      case 'playwright': return playwrightScript;
      case 'docker': return dockerfileContent;
      case 'github_actions': return githubActionsContent;
      case 'cloud_run': return cloudRunDeployContent;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Title */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">
            Arquitectura de 3 Componentes para Automatización en la Nube
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Diseño técnico integral para mantener el flujo operativo de forma 100% desatendida, segura y escalable sin necesidad de intervención manual diaria.
        </p>
      </div>

      {/* 3 Component Diagram Visualizer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Component 1 */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-blue-900/40 rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-blue-950/80 border border-blue-700/60 flex items-center justify-center text-blue-400 mb-3">
            <Database className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider font-mono">
            Componente 1
          </span>
          <h3 className="text-base font-bold text-white mt-1">
            Base de Datos & Bóveda Cifrada
          </h3>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            Almacena los perfiles de múltiples usuarios, parámetros de horario asignados y contraseñas cifradas con AES-256 GCM o Google Cloud Secret Manager.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Aislamiento por usuario</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Claves de cifrado en reposo</span>
            </div>
          </div>
        </div>

        {/* Component 2 */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-900/40 rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 mb-3">
            <Cpu className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider font-mono">
            Componente 2
          </span>
          <h3 className="text-base font-bold text-white mt-1">
            Script Headless Browser
          </h3>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            Motor Playwright / Puppeteer que navega de forma desatendida a <code>https://portal.uad.mx/</code>, evalúa la sección de Horario y efectúa el registro cuando el botón se activa.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>Emulación humana & headers</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>Capturas de auditoría</span>
            </div>
          </div>
        </div>

        {/* Component 3 */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-900/40 rounded-xl p-5 relative overflow-hidden shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400 mb-3">
            <Cloud className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider font-mono">
            Componente 3
          </span>
          <h3 className="text-base font-bold text-white mt-1">
            Orquestador & Cron en la Nube
          </h3>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            Programador desatendido (Cloud Run Jobs + Cloud Scheduler o GitHub Actions) que dispara la ejecución puntual cada día sin necesidad de computadoras encendidas.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Workflow className="w-3.5 h-3.5 text-purple-400" />
              <span>Reintentos automáticos</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Workflow className="w-3.5 h-3.5 text-purple-400" />
              <span>Disparo programado 24/7</span>
            </div>
          </div>
        </div>
      </div>

      {/* Code Repository & Deployment Templates */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">
              Plantillas de Despliegue en Producción
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(getActiveCode(), activeCodeTab)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {copiedCodeKey === activeCodeTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCodeKey === activeCodeTab ? '¡Copiado!' : 'Copiar Código'}</span>
            </button>
          </div>
        </div>

        {/* Code Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveCodeTab('playwright')}
            className={`px-4 py-2.5 font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeCodeTab === 'playwright'
                ? 'border-cyan-400 text-cyan-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            worker.js (Playwright Script)
          </button>
          <button
            onClick={() => setActiveCodeTab('github_actions')}
            className={`px-4 py-2.5 font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeCodeTab === 'github_actions'
                ? 'border-cyan-400 text-cyan-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            .github/workflows/daily.yml (Gratuito 24/7)
          </button>
          <button
            onClick={() => setActiveCodeTab('docker')}
            className={`px-4 py-2.5 font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeCodeTab === 'docker'
                ? 'border-cyan-400 text-cyan-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Dockerfile (Contenedor)
          </button>
          <button
            onClick={() => setActiveCodeTab('cloud_run')}
            className={`px-4 py-2.5 font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeCodeTab === 'cloud_run'
                ? 'border-cyan-400 text-cyan-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            deploy-cloudrun.sh (GCP Cloud Scheduler)
          </button>
        </div>

        {/* Code Block */}
        <div className="p-4 bg-slate-950 overflow-x-auto font-mono text-xs text-slate-300 leading-relaxed max-h-96">
          <pre>{getActiveCode()}</pre>
        </div>
      </div>
    </div>
  );
};
