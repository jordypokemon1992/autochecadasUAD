# UAD CloudFlow - Sistema de Asistencia Desatendido con Firebase y GitHub Actions

Panel de control web y microservicio en la nube para la gestión y ejecución desatendida del checado de asistencia en `portal.uad.mx`.

## 🏗️ Arquitectura de 3 Capas

1. **Frontend / Panel Web**: Interfaz gráfica para gestionar docentes, contraseñas encriptadas y horarios semanales independientes (Lunes a Domingo).
2. **Nube Central (Firebase Firestore)**: Almacena la colección `uad_users` (docentes y horarios) y recibe `uad_executions` (registros de auditoría en vivo).
3. **Backend Desatendido (GitHub Actions + Playwright)**: Worker programado por cron que corre en la nube de GitHub, consulta Firebase, inicia sesión en `portal.uad.mx` y acciona el botón `#boton_checar`.

---

## 🚀 Puesta en Marcha en tu Repositorio de GitHub

### 1. Configurar los Secrets en GitHub
En tu repositorio de GitHub, ve a **Settings** > **Secrets and variables** > **Actions** > **New repository secret** y añade:

| Nombre del Secret | Descripción |
| :--- | :--- |
| `FIREBASE_PROJECT_ID` | El ID de tu proyecto de Firebase (ej. `mi-proyecto-uad`). |
| `FIREBASE_API_KEY` | La Web API Key de tu proyecto en Firebase Console. |
| `FIREBASE_APP_ID` | El App ID de tu aplicación web en Firebase. |

### 2. Ejecución Automática
- El flujo `.github/workflows/checador.yml` se ejecutará automáticamente de **Lunes a Viernes cada 15 minutos** durante horario laboral.
- Puedes dispararlo manualmente en cualquier momento desde la pestaña **Actions** de GitHub seleccionando **UAD Automation Runner** > **Run workflow**.

---

## 📁 Archivos del Backend en este Repositorio

- `/.github/workflows/checador.yml`: Definición del pipeline de GitHub Actions.
- `/worker-firebase.js`: Script de Playwright Headless que se comunica con Firebase y realiza el checado en `portal.uad.mx`.
- `/server.ts`: Servidor API local y persistencia dual en disco (`/data/vault_users.json`).
- `/src/`: Código fuente de la interfaz gráfica React + Tailwind.
