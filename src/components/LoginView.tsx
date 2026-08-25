import React, { useState } from 'react';
import { 
  Bot, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (username: string) => void;
}

export const MASTER_CREDENTIALS = {
  username: 'Moch_Coord_AreaClinica',
  password: 'L0b0s2026',
  role: 'Coordinación de Área Clínica'
};

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const trimmedUser = username.trim();
      const trimmedPass = password.trim();

      if (!trimmedUser || !trimmedPass) {
        setError('Por favor completa todos los campos.');
        setIsLoading(false);
        return;
      }

      if (
        trimmedUser === MASTER_CREDENTIALS.username &&
        trimmedPass === MASTER_CREDENTIALS.password
      ) {
        if (rememberMe) {
          localStorage.setItem('cloudflow_auth_session', JSON.stringify({
            username: trimmedUser,
            role: MASTER_CREDENTIALS.role,
            loginTime: new Date().toISOString()
          }));
        } else {
          sessionStorage.setItem('cloudflow_auth_session', JSON.stringify({
            username: trimmedUser,
            role: MASTER_CREDENTIALS.role,
            loginTime: new Date().toISOString()
          }));
        }
        setIsLoading(false);
        onLoginSuccess(trimmedUser);
      } else {
        setIsLoading(false);
        setError('Credenciales incorrectas. Verifica el usuario y la contraseña maestra.');
      }
    }, 400);
  };

  const handleFillDemo = () => {
    setUsername(MASTER_CREDENTIALS.username);
    setPassword(MASTER_CREDENTIALS.password);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden py-12">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand & Title Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-blue-600 shadow-xl shadow-cyan-500/25 border border-cyan-400/30">
            <Bot className="w-9 h-9 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Administrador <span className="text-cyan-400">Checadas Docentes</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Plataforma de Automatización y Checadas Desatendidas
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-cyan-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Acceso Seguro de Administración</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl shadow-black/60 space-y-5">
          <div className="border-b border-slate-800/80 pb-3">
            <h2 className="text-base font-semibold text-white">Inicio de Sesión Maestro</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ingresa tus credenciales autorizadas para acceder a la consola.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="login-username" className="block text-xs font-semibold text-slate-300">
                Usuario Maestro
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej. Moch_Coord_AreaClinica"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-mono"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-mono"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="login-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                />
                <span className="text-xs text-slate-400">Mantener sesión iniciada</span>
              </label>

              <button
                type="button"
                onClick={handleFillDemo}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                title="Autocompletar credenciales maestras"
              >
                <KeyRound className="w-3 h-3" />
                <span>Autocompletar</span>
              </button>
            </div>

            {/* Submit Button */}
            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Master Info Box */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Credenciales Maestras Configuradas:</span>
            </div>
            <div className="font-mono text-[11px] text-slate-300 pl-5 space-y-0.5">
              <p><span className="text-slate-500">Usuario:</span> Moch_Coord_AreaClinica</p>
              <p><span className="text-slate-500">Rol:</span> Coordinación de Área Clínica</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p>© 2026 Administrador Checadas Docentes • UAD Checador Automatizado</p>
          <p className="text-[11px]">Sistema protegido con cifrado y sincronización en la nube</p>
        </div>
      </div>
    </div>
  );
};
