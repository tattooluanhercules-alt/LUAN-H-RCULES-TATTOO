import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FolderSync,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageCircle,
  Music,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unplug,
  Upload,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ResilientImage } from '../components/ResilientImage';
import {
  adminLogin,
  adminLogout,
  changeAdminPassword,
  deleteAppointment,
  deleteGalleryItem,
  deleteMusicTrack,
  disconnectGoogleAccount,
  fetchAdminDashboard,
  fetchAdminSession,
  fetchAppsScriptCode,
  fetchGoogleAuthUrl,
  fetchGoogleStatus,
  initializeGoogleWorkspace,
  reorderStoryChapters,
  syncViaAppsScript,
  testAppsScriptConnection,
  updateAppointmentStatus,
  updateGalleryItem,
  updateMusicTrack,
  updateStoryChapter,
  updateStudioConfig,
  uploadStudioAsset,
  type AdminDashboardPayload,
  type GoogleConnectionStatus,
} from '../services/studioApi';
import type {
  AdminSessionStatus,
  AppointmentStatus,
  GalleryItem,
  StoryChapter,
  TattooCategory,
} from '../types/studio';
import { TATTOO_CATEGORIES } from '../types/studio';

type AdminTab = 'dashboard' | 'fotos' | 'historia' | 'musicas' | 'agendamentos' | 'config';

interface AdminPageProps {
  onNavigate: (path: string) => void;
  onStudioMutated: () => void;
}

export function AdminPage({ onNavigate, onStudioMutated }: AdminPageProps) {
  const [session, setSession] = useState<AdminSessionStatus | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Login form state
  const [username, setUsername] = useState('ADMIN');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // First-access / password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // Google OAuth Server-Side Status
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Dashboard data
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Upload states
  const [uploadCategory, setUploadCategory] = useState<TattooCategory>('Realismo');
  const [uploading, setUploading] = useState(false);

  // Confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const refreshGoogleStatus = useCallback(async () => {
    try {
      const gs = await fetchGoogleStatus();
      setGoogleStatus(gs);
    } catch {
      // Ignore if session not ready
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoadingDash(true);
    try {
      const [data, gs] = await Promise.all([
        fetchAdminDashboard(),
        fetchGoogleStatus().catch(() => null),
      ]);
      setDashboard(data);
      if (gs) setGoogleStatus(gs);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Erro ao carregar painel.');
    } finally {
      setLoadingDash(false);
    }
  }, [showToast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleParam = params.get('google');
    const googleErr = params.get('google_error');
    if (googleParam === 'connected') {
      showToast('ok', 'Conta Google conectada e sincronizada com sucesso.');
      window.history.replaceState({}, '', '/admin');
    } else if (googleErr) {
      showToast('err', `Erro na conexão Google: ${googleErr}`);
      window.history.replaceState({}, '', '/admin');
    }

    fetchAdminSession()
      .then((s) => {
        setSession(s);
        if (s.authenticated && !s.mustChangePassword) {
          loadDashboard();
        }
      })
      .catch(() => {
        setSession({
          authenticated: false,
          username: null,
          mustChangePassword: false,
          csrfToken: '',
          passwordStoredInAppData: false,
        });
      })
      .finally(() => setLoadingSession(false));

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'lh-google-oauth-result') {
        if (event.data.ok) {
          showToast('ok', event.data.message || 'Conta Google conectada com sucesso.');
          loadDashboard();
          onStudioMutated();
        } else {
          showToast('err', event.data.message || 'Não foi possível conectar a conta Google.');
        }
      }
    };

    const onFocus = () => {
      refreshGoogleStatus();
    };

    window.addEventListener('message', onMessage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadDashboard, onStudioMutated, refreshGoogleStatus, showToast]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const s = await adminLogin(username, password);
      setSession(s);
      setPassword('');
      if (!s.mustChangePassword) {
        await loadDashboard();
      } else {
        setCurrentPwd(password);
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Falha na autenticação.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);
    if (newPwd !== confirmPwd) {
      setPwdError('A confirmação da nova senha não coincide.');
      return;
    }
    setPwdSubmitting(true);
    try {
      const res = await changeAdminPassword(currentPwd, newPwd);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              mustChangePassword: res.mustChangePassword,
              passwordStoredInAppData: res.passwordStoredInAppData,
            }
          : prev
      );
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setPwdSuccess(
        res.passwordStoredInAppData
          ? 'Senha atualizada com segurança e salva no Google Drive (appDataFolder).'
          : 'Senha atualizada com segurança.'
      );
      await loadDashboard();
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Erro ao alterar senha.');
    } finally {
      setPwdSubmitting(false);
    }
  };

  const handleConnectGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { authUrl } = await fetchGoogleAuthUrl();
      // Open Google OAuth consent screen in a new tab cleanly (avoids iframe X-Frame-Options block and window.open)
      const link = document.createElement('a');
      link.href = authUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Não foi possível iniciar a autenticação Google.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDisconnectGoogle = () => {
    runConfirmed({
      title: 'Desconectar conta Google',
      description:
        'A sessão Google OAuth será revogada no servidor e o status passará para Desconectado. Seus arquivos no Google Drive e planilhas no Google Sheets não serão apagados.',
      confirmLabel: 'Desconectar',
      destructive: true,
      action: async () => {
        await disconnectGoogleAccount();
        await refreshGoogleStatus();
        showToast('ok', 'Conta Google desconectada com sucesso.');
      },
    });
  };

  const handleSyncOnly = async () => {
    setGoogleLoading(true);
    try {
      await initializeGoogleWorkspace();
      await loadDashboard();
      onStudioMutated();
      showToast('ok', 'Planilha e pastas do Google Drive sincronizadas com sucesso.');
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Falha ao sincronizar.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setSession({
      authenticated: false,
      username: null,
      mustChangePassword: false,
      csrfToken: '',
      passwordStoredInAppData: false,
    });
    setDashboard(null);
    setGoogleStatus(null);
  };

  const runConfirmed = (opts: {
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    action: () => Promise<void>;
  }) => {
    setConfirmState({ open: true, ...opts });
  };

  const executeConfirm = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.action();
      setConfirmState(null);
      await loadDashboard();
      onStudioMutated();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Erro ao executar operação.');
      setConfirmState(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  // Multi-file portfolio upload
  const handlePortfolioUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const googleConnected = Boolean(
      googleStatus?.connected ||
        googleStatus?.appsScript?.configured ||
        dashboard?.workspace.connected
    );
    if (!googleConnected && dashboard?.workspace.mode !== 'server-env') {
      showToast('err', 'Conecte sua conta Google ou configure o Apps Script primeiro para enviar fotos ao Drive.');
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        await uploadStudioAsset({
          target: 'portfolio',
          file,
          category: uploadCategory,
          caption: file.name.replace(/\.[^.]+$/, ''),
        });
      }
      await loadDashboard();
      onStudioMutated();
      showToast('ok', `${files.length} fotografia(s) enviada(s) ao Drive e registradas na planilha.`);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Erro ao enviar fotografia.');
    } finally {
      setUploading(false);
    }
  };

  // Story photo upload (single chapter replacement or batch 12)
  const handleStoryPhotoUpload = async (storyId: string, file: File) => {
    const googleConnected = Boolean(
      googleStatus?.connected ||
        googleStatus?.appsScript?.configured ||
        dashboard?.workspace.connected
    );
    if (!googleConnected && dashboard?.workspace.mode !== 'server-env') {
      showToast('err', 'Conecte sua conta Google ou configure o Apps Script primeiro para enviar fotografias da história.');
      return;
    }
    setUploading(true);
    try {
      await uploadStudioAsset({
        target: 'historia',
        file,
        storyId,
      });
      await loadDashboard();
      onStudioMutated();
      showToast('ok', 'Fotografia da história atualizada no Google Drive e Google Sheets.');
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Erro ao enviar foto da história.');
    } finally {
      setUploading(false);
    }
  };

  // Music upload
  const handleMusicUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const googleConnected = Boolean(
      googleStatus?.connected ||
        googleStatus?.appsScript?.configured ||
        dashboard?.workspace.connected
    );
    if (!googleConnected && dashboard?.workspace.mode !== 'server-env') {
      showToast('err', 'Conecte sua conta Google ou configure o Apps Script para salvar na pasta TRILHA-SONORA.');
      return;
    }
    setUploading(true);
    try {
      await uploadStudioAsset({
        target: 'musica',
        file,
        caption: file.name.replace(/\.[^.]+$/, ''),
      });
      await loadDashboard();
      onStudioMutated();
      showToast('ok', 'Música enviada para TRILHA-SONORA e definida como faixa principal.');
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Erro ao enviar música.');
    } finally {
      setUploading(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <p className="text-sm text-[#A5A5A5]">Verificando sessão administrativa...</p>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!session?.authenticated) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex flex-col justify-center px-5 py-12">
        <div className="max-w-md w-full mx-auto">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#C9A34A] hover:text-[#E2C47A] mb-8 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao site</span>
          </button>

          <div className="bg-[#151515] border border-white/10 rounded-sm p-7 sm:p-9">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="w-5 h-5 text-[#C9A34A]" />
              <p className="text-xs tracking-[0.2em] uppercase text-[#C9A34A]">
                Acesso Restrito
              </p>
            </div>
            <h1 className="font-display text-3xl text-white font-medium mb-2">
              Painel Administrativo
            </h1>
            <p className="text-sm text-[#A5A5A5] mb-7">
              Luan Hércules Tattoo Studio · Autenticação obrigatória.
            </p>

            {loginError && (
              <div className="mb-5 p-3.5 bg-red-950/50 border border-red-500/40 text-red-200 text-sm rounded-sm">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-2">
                  Usuário
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full py-3.5 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] font-semibold text-xs uppercase tracking-[0.14em] rounded-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {loginSubmitting ? 'Autenticando...' : 'Entrar no Painel'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // MANDATORY FIRST-ACCESS PASSWORD CHANGE
  if (session.mustChangePassword) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex flex-col justify-center px-5 py-12">
        <div className="max-w-md w-full mx-auto bg-[#151515] border border-[#C9A34A]/50 rounded-sm p-7 sm:p-9">
          <p className="text-xs tracking-[0.2em] uppercase text-[#C9A34A] mb-2">
            Primeiro Acesso · Segurança
          </p>
          <h1 className="font-display text-3xl text-white font-medium mb-3">
            Altere sua senha inicial
          </h1>
          <p className="text-sm text-[#A5A5A5] leading-relaxed mb-6">
            Por segurança, é obrigatório substituir a senha padrão antes de acessar as ferramentas
            de gerenciamento do estúdio.
          </p>

          {pwdError && (
            <div className="mb-4 p-3.5 bg-red-950/50 border border-red-500/40 text-red-200 text-sm rounded-sm">
              {pwdError}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-2">
                Senha atual
              </label>
              <input
                type="password"
                required
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-2">
                Nova senha (mín. 8 caracteres)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-2">
                Confirmar nova senha
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-3 border border-white/15 text-xs uppercase tracking-[0.12em] text-[#A5A5A5] hover:text-white rounded-sm cursor-pointer"
              >
                Sair
              </button>
              <button
                type="submit"
                disabled={pwdSubmitting}
                className="px-6 py-3 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] text-xs font-semibold uppercase tracking-[0.12em] rounded-sm cursor-pointer disabled:opacity-50"
              >
                {pwdSubmitting ? 'Salvando...' : 'Salvar Nova Senha'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'fotos', label: 'Portfólio', icon: ImageIcon },
    { id: 'historia', label: 'História (12)', icon: Sparkles },
    { id: 'musicas', label: 'Músicas', icon: Music },
    { id: 'agendamentos', label: 'Agendamentos', icon: CalendarClock },
    { id: 'config', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-white pb-20">
      {/* Admin Header */}
      <header className="sticky top-0 z-30 bg-[#080808]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-xs uppercase tracking-[0.12em] text-[#A5A5A5] hover:text-[#E2C47A] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Site Público</span>
            </button>
            <span className="text-white/20" aria-hidden="true">
              |
            </span>
            <h1 className="font-display text-lg sm:text-xl font-semibold tracking-wider text-white truncate">
              LUAN HÉRCULES · ADMIN
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-white/15 hover:border-[#C9A34A] text-xs uppercase tracking-[0.1em] text-[#A5A5A5] hover:text-white rounded-sm transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1320px] mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* Toast Feedback */}
        {toast && (
          <div
            role="status"
            className={`p-4 border rounded-sm text-sm flex items-center justify-between ${
              toast.type === 'ok'
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/50 border-red-500/40 text-red-200'
            }`}
          >
            <span>{toast.text}</span>
          </div>
        )}

        {/* Google Drive & Sheets Connection Strip */}
        <section className="p-5 bg-[#151515] border border-white/10 rounded-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <p className="text-xs tracking-[0.18em] uppercase text-[#C9A34A]">
                Google Drive & Google Planilhas
              </p>
              <span
                className={`text-xs font-medium ${
                  googleStatus?.connected ? 'text-emerald-400' : 'text-[#A5A5A5]'
                }`}
              >
                Status: {googleStatus?.connected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            {googleStatus?.connected ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white">
                <span className="inline-flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  {googleStatus.connectionMethod === 'apps-script'
                    ? 'Conectado (Google Apps Script)'
                    : 'Conectado'}
                </span>
                {googleStatus.email && (
                  <>
                    <span className="text-white/25">·</span>
                    <span className="text-[#A5A5A5]">{googleStatus.email}</span>
                  </>
                )}
                {(googleStatus.sheetUrl || dashboard?.workspace.sheetUrl) && (
                  <>
                    <span className="text-white/25">·</span>
                    <a
                      href={googleStatus.sheetUrl || dashboard?.workspace.sheetUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#E2C47A] hover:underline inline-flex items-center gap-1"
                    >
                      Abrir Planilha <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-[#A5A5A5]">
                  Conecte sua conta Google administrativa para gerenciar a pasta LUAN HÉRCULES TATTOO
                  no Drive e a planilha LUAN HÉRCULES TATTOO — GERENCIAMENTO.
                </p>
                {googleStatus && !googleStatus.configured && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#E2C47A]">
                    <span>
                      Variáveis pendentes no servidor: {googleStatus.missingEnvVars.join(', ')} ·
                      Redirect URI: {googleStatus.redirectUri}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('config')}
                      className="underline hover:text-white cursor-pointer"
                    >
                      Ver diagnóstico ou usar Apps Script em Configurações
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {!googleStatus?.connected ? (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={googleLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] text-xs font-semibold uppercase tracking-[0.12em] rounded-sm cursor-pointer disabled:opacity-50 transition-colors"
              >
                <FolderSync className="w-4 h-4" />
                <span>{googleLoading ? 'Conectando...' : 'Conectar Google'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSyncOnly}
                  disabled={googleLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] text-xs font-semibold uppercase tracking-[0.12em] rounded-sm cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <FolderSync className="w-4 h-4" />
                  <span>{googleLoading ? 'Sincronizando...' : 'Sincronizar Drive & Sheets'}</span>
                </button>
                {googleStatus.connectionMethod === 'oauth' ? (
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    disabled={googleLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/20 hover:border-red-400/60 text-xs font-medium uppercase tracking-[0.1em] text-[#A5A5A5] hover:text-red-300 rounded-sm cursor-pointer transition-colors"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    <span>Desconectar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('config')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/20 hover:border-[#C9A34A] text-xs font-medium uppercase tracking-[0.1em] text-[#A5A5A5] hover:text-white rounded-sm cursor-pointer transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configurar Apps Script</span>
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        {/* Navigation Tabs (Mobile Scrollable) */}
        <nav
          aria-label="Seções administrativas"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/10"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.1em] rounded-sm whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#C9A34A] text-[#080808] font-semibold'
                    : 'bg-[#151515] text-[#A5A5A5] hover:text-white border border-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {loadingDash && !dashboard ? (
          <div className="py-16 text-center text-[#A5A5A5] text-sm">
            Carregando dados do estúdio...
          </div>
        ) : dashboard ? (
          <>
            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="p-6 bg-[#151515] border border-white/10 rounded-sm">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#A5A5A5] mb-2">
                      Fotografias no Portfólio
                    </p>
                    <p className="font-mono-tabular text-3xl text-white font-semibold">
                      {dashboard.stats.totalPhotos}
                    </p>
                    <p className="text-xs text-[#C9A34A] mt-2">
                      {dashboard.stats.publishedPhotos} publicada(s)
                    </p>
                  </div>

                  <div className="p-6 bg-[#151515] border border-white/10 rounded-sm">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#A5A5A5] mb-2">
                      História (12 Originais)
                    </p>
                    <p className="font-mono-tabular text-3xl text-white font-semibold">
                      {dashboard.stats.storyUploadedCount} / 12
                    </p>
                    <p className="text-xs text-[#A5A5A5] mt-2">Enviadas para HISTORIA/</p>
                  </div>

                  <div className="p-6 bg-[#151515] border border-white/10 rounded-sm">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#A5A5A5] mb-2">
                      Trilhas Sonoras
                    </p>
                    <p className="font-mono-tabular text-3xl text-white font-semibold">
                      {dashboard.stats.totalMusic}
                    </p>
                    <p className="text-xs text-[#A5A5A5] mt-2">
                      Player {dashboard.config.playerEnabled ? 'Ativo' : 'Desativado'}
                    </p>
                  </div>

                  <div className="p-6 bg-[#151515] border border-white/10 rounded-sm">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#A5A5A5] mb-2">
                      Solicitações de Agenda
                    </p>
                    <p className="font-mono-tabular text-3xl text-white font-semibold">
                      {dashboard.stats.totalAppointments}
                    </p>
                    <p className="text-xs text-[#E2C47A] mt-2">
                      {dashboard.stats.pendingAppointments} aguardando análise
                    </p>
                  </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('historia')}
                    className="p-4 bg-[#151515] border border-white/10 hover:border-[#C9A34A] text-left rounded-sm transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-white">Enviar 12 Fotos</p>
                    <p className="text-xs text-[#A5A5A5] mt-1">Gerenciar história</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('fotos')}
                    className="p-4 bg-[#151515] border border-white/10 hover:border-[#C9A34A] text-left rounded-sm transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-white">Novo Trabalho</p>
                    <p className="text-xs text-[#A5A5A5] mt-1">Upload no portfólio</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('musicas')}
                    className="p-4 bg-[#151515] border border-white/10 hover:border-[#C9A34A] text-left rounded-sm transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-white">Trilha Sonora</p>
                    <p className="text-xs text-[#A5A5A5] mt-1">Upload de MP3</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('agendamentos')}
                    className="p-4 bg-[#151515] border border-white/10 hover:border-[#C9A34A] text-left rounded-sm transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-white">Agendamentos</p>
                    <p className="text-xs text-[#A5A5A5] mt-1">Revisar pedidos</p>
                  </button>
                </div>

                {/* Recent Audit Logs */}
                <div className="bg-[#151515] border border-white/10 rounded-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-2xl text-white">Últimas Alterações (LOG)</h2>
                    <button
                      type="button"
                      onClick={loadDashboard}
                      className="text-xs text-[#C9A34A] hover:text-[#E2C47A] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                    </button>
                  </div>
                  <div className="divide-y divide-white/10">
                    {dashboard.logs.slice(0, 12).map((log) => (
                      <div
                        key={log.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm"
                      >
                        <div>
                          <span className="text-white font-medium">{log.action}</span>
                          <span className="text-[#A5A5A5] ml-2">{log.details}</span>
                        </div>
                        <span className="font-mono-tabular text-xs text-[#A5A5A5] shrink-0">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PORTFOLIO PHOTOS */}
            {activeTab === 'fotos' && (
              <PortfolioManagerTab
                gallery={dashboard.gallery}
                uploadCategory={uploadCategory}
                uploading={uploading}
                onCategoryChange={setUploadCategory}
                onUploadFiles={handlePortfolioUpload}
                onConfirm={runConfirmed}
                onSuccessToast={(msg) => showToast('ok', msg)}
              />
            )}

            {/* TAB: 12 STORY PHOTOGRAPHS */}
            {activeTab === 'historia' && (
              <StoryManagerTab
                chapters={dashboard.story}
                uploading={uploading}
                onUploadPhoto={handleStoryPhotoUpload}
                onConfirm={runConfirmed}
                onSuccessToast={(msg) => showToast('ok', msg)}
              />
            )}

            {/* TAB: MUSIC */}
            {activeTab === 'musicas' && (
              <MusicManagerTab
                music={dashboard.music}
                playerEnabled={dashboard.config.playerEnabled}
                defaultVolume={dashboard.config.defaultVolume}
                uploading={uploading}
                onUploadMusic={handleMusicUpload}
                onConfirm={runConfirmed}
                onSuccessToast={(msg) => showToast('ok', msg)}
              />
            )}

            {/* TAB: APPOINTMENTS */}
            {activeTab === 'agendamentos' && (
              <AppointmentsManagerTab
                appointments={dashboard.appointments}
                whatsappNumber={dashboard.config.whatsappNumber}
                onConfirm={runConfirmed}
                onSuccessToast={(msg) => showToast('ok', msg)}
              />
            )}

            {/* TAB: SETTINGS & SECURITY */}
            {activeTab === 'config' && (
              <SettingsManagerTab
                config={dashboard.config}
                logs={dashboard.logs}
                googleStatus={googleStatus}
                onRefreshGoogleStatus={refreshGoogleStatus}
                passwordStoredInAppData={session.passwordStoredInAppData}
                onConfirm={runConfirmed}
                onSuccessToast={(msg) => showToast('ok', msg)}
                onErrorToast={(msg) => showToast('err', msg)}
              />
            )}
          </>
        ) : null}
      </main>

      <ConfirmDialog
        open={Boolean(confirmState?.open)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel || 'Confirmar'}
        destructive={confirmState?.destructive}
        loading={confirmBusy}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// SUB-COMPONENTS FOR ADMIN TABS
// -----------------------------------------------------------------------------
type ConfirmFn = (opts: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  action: () => Promise<void>;
}) => void;

function PortfolioManagerTab({
  gallery,
  uploadCategory,
  uploading,
  onCategoryChange,
  onUploadFiles,
  onConfirm,
  onSuccessToast,
}: {
  gallery: GalleryItem[];
  uploadCategory: TattooCategory;
  uploading: boolean;
  onCategoryChange: (c: TattooCategory) => void;
  onUploadFiles: (e: ChangeEvent<HTMLInputElement>) => void;
  onConfirm: ConfirmFn;
  onSuccessToast: (m: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TattooCategory>('Realismo');

  const startEdit = (item: GalleryItem) => {
    setEditingId(item.id);
    setCaption(item.caption);
    setDescription(item.description);
    setCategory(item.category);
  };

  return (
    <div className="space-y-6">
      {/* Multi Upload Box */}
      <div className="p-6 bg-[#151515] border border-white/10 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-white">Upload Múltiplo para Portfólio</h2>
          <p className="text-xs text-[#A5A5A5] mt-1">
            As imagens serão salvas na pasta PORTFOLIO/ do Google Drive e registradas na aba GALERIA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={uploadCategory}
            onChange={(e) => onCategoryChange(e.target.value as TattooCategory)}
            aria-label="Categoria do upload"
            className="px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
          >
            {TATTOO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] text-xs font-semibold uppercase tracking-[0.12em] rounded-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Enviando...' : 'Selecionar Fotografias'}</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={onUploadFiles}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Gallery Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {gallery.map((item, idx) => (
          <div
            key={item.id}
            className="bg-[#151515] border border-white/10 rounded-sm overflow-hidden flex flex-col"
          >
            <div className="aspect-[4/3] bg-[#080808] relative">
              <ResilientImage src={item.url} alt={item.caption || item.fileName} />
            </div>

            <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
              {editingId === item.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Legenda"
                    className="w-full px-3 py-2 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
                  />
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição"
                    className="w-full px-3 py-2 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TattooCategory)}
                    className="w-full px-3 py-2 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
                  >
                    {TATTOO_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onConfirm({
                          title: 'Atualizar trabalho no portfólio',
                          description: `Salvar alterações de legenda, categoria (${category}) e descrição para "${caption}" na planilha Google Sheets?`,
                          confirmLabel: 'Salvar Alterações',
                          action: async () => {
                            await updateGalleryItem(item.id, { caption, description, category });
                            setEditingId(null);
                            onSuccessToast('Trabalho atualizado e sincronizado.');
                          },
                        })
                      }
                      className="px-3.5 py-2 bg-[#C9A34A] text-[#080808] text-xs font-semibold uppercase rounded-sm cursor-pointer"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3.5 py-2 border border-white/15 text-xs text-[#A5A5A5] rounded-sm cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#C9A34A] mb-1">
                      <span>{item.category}</span>
                      <span className="font-mono-tabular text-[#A5A5A5]">#{idx + 1}</span>
                    </div>
                    <h3 className="font-display text-xl text-white font-medium">
                      {item.caption || item.fileName}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-[#A5A5A5] mt-1 line-clamp-2">{item.description}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onConfirm({
                            title: item.published ? 'Despublicar trabalho' : 'Publicar trabalho',
                            description: `Deseja alterar a visibilidade pública de "${item.caption || item.fileName}"?`,
                            confirmLabel: 'Confirmar',
                            action: async () => {
                              await updateGalleryItem(item.id, { published: !item.published });
                              onSuccessToast('Visibilidade atualizada.');
                            },
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#080808] border border-white/15 text-xs text-white/80 hover:border-[#C9A34A] rounded-sm cursor-pointer"
                      >
                        {item.published ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-[#C9A34A]" /> Publicado
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5" /> Oculto
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="px-2.5 py-1.5 bg-[#080808] border border-white/15 text-xs text-white/80 hover:border-[#C9A34A] rounded-sm cursor-pointer"
                      >
                        Editar
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          onConfirm({
                            title: 'Reordenar portfólio',
                            description: `Mover "${item.caption}" para uma posição anterior na exibição?`,
                            confirmLabel: 'Mover',
                            action: async () => {
                              await updateGalleryItem(item.id, { order: Math.max(1, item.order - 2) });
                              onSuccessToast('Ordem atualizada.');
                            },
                          })
                        }
                        aria-label="Mover para cima"
                        className="p-1.5 border border-white/10 text-[#A5A5A5] hover:text-white disabled:opacity-30 rounded-sm cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onConfirm({
                            title: 'Excluir fotografia do portfólio',
                            description: `Esta ação removerá "${item.caption || item.fileName}" do portfólio, da planilha Google Sheets e do Google Drive (se hospedado lá). Deseja continuar?`,
                            confirmLabel: 'Excluir Definitivamente',
                            destructive: true,
                            action: async () => {
                              await deleteGalleryItem(item.id);
                              onSuccessToast('Fotografia excluída.');
                            },
                          })
                        }
                        aria-label="Excluir trabalho"
                        className="p-1.5 border border-red-500/30 text-red-400 hover:bg-red-950/50 rounded-sm cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StoryManagerTab({
  chapters,
  uploading,
  onUploadPhoto,
  onConfirm,
  onSuccessToast,
}: {
  chapters: StoryChapter[];
  uploading: boolean;
  onUploadPhoto: (storyId: string, file: File) => Promise<void>;
  onConfirm: ConfirmFn;
  onSuccessToast: (m: string) => void;
}) {
  const [editing, setEditing] = useState<Record<string, { title: string; text: string }>>({});

  const moveChapter = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return;
    const next = [...chapters];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onConfirm({
      title: 'Reordenar fotografias da história',
      description: 'Atualizar a sequência das 12 fotografias no carrossel e na planilha Google Sheets?',
      confirmLabel: 'Salvar Ordem',
      action: async () => {
        await reorderStoryChapters(next.map((c) => c.id));
        onSuccessToast('Sequência da história reordenada.');
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-[#151515] border border-white/10 rounded-sm">
        <h2 className="font-display text-2xl text-white">
          As 12 Fotografias da História — Traço por Traço
        </h2>
        <p className="text-xs text-[#A5A5A5] mt-1">
          Substitua cada uma das 12 imagens originais preservando a qualidade integral (pasta
          HISTORIA/ no Google Drive), edite legendas e reordene os capítulos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {chapters.map((ch, idx) => {
          const draft = editing[ch.id] || { title: ch.title, text: ch.text };
          const hasChanges = draft.title !== ch.title || draft.text !== ch.text;

          return (
            <div
              key={ch.id}
              className="bg-[#151515] border border-white/10 rounded-sm p-5 grid grid-cols-1 sm:grid-cols-12 gap-5"
            >
              <div className="sm:col-span-5 space-y-2.5">
                <div className="aspect-[4/3] bg-[#080808] border border-white/10 rounded-sm overflow-hidden">
                  <ResilientImage src={ch.photoUrl} alt={ch.title} />
                </div>

                <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#080808] border border-white/15 hover:border-[#C9A34A] text-xs text-white rounded-sm cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-[#C9A34A]" />
                  <span>{uploading ? 'Enviando...' : 'Substituir Foto Original'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) {
                        onConfirm({
                          title: `Substituir fotografia do capítulo ${idx + 1}`,
                          description: `Enviar "${f.name}" para a pasta HISTORIA/ do Google Drive e vincular ao capítulo "${ch.title}"?`,
                          confirmLabel: 'Enviar Fotografia',
                          action: async () => {
                            await onUploadPhoto(ch.id, f);
                          },
                        });
                      }
                    }}
                    className="hidden"
                  />
                </label>

                <div className="flex items-center justify-between text-[11px] text-[#A5A5A5]">
                  <span className="font-mono-tabular">Ordem #{idx + 1}</span>
                  <span>{ch.isOriginalUploaded ? 'Original no Drive' : 'Prévia Inicial'}</span>
                </div>
              </div>

              <div className="sm:col-span-7 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [ch.id]: { ...draft, title: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-sm text-white rounded-sm"
                  />
                  <textarea
                    rows={4}
                    value={draft.text}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [ch.id]: { ...draft, text: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-xs text-[#A5A5A5] rounded-sm resize-y"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveChapter(idx, -1)}
                      aria-label="Mover capítulo para cima"
                      className="p-1.5 border border-white/15 text-[#A5A5A5] hover:text-white disabled:opacity-30 rounded-sm cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === chapters.length - 1}
                      onClick={() => moveChapter(idx, 1)}
                      aria-label="Mover capítulo para baixo"
                      className="p-1.5 border border-white/15 text-[#A5A5A5] hover:text-white disabled:opacity-30 rounded-sm cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onConfirm({
                          title: ch.published ? 'Ocultar capítulo' : 'Publicar capítulo',
                          description: `Alterar visibilidade do capítulo "${ch.title}" no carrossel público?`,
                          confirmLabel: 'Confirmar',
                          action: async () => {
                            await updateStoryChapter(ch.id, { published: !ch.published });
                            onSuccessToast('Visibilidade do capítulo atualizada.');
                          },
                        })
                      }
                      className="px-2.5 py-1.5 border border-white/15 text-xs text-white/80 rounded-sm cursor-pointer"
                    >
                      {ch.published ? 'Publicado' : 'Oculto'}
                    </button>
                  </div>

                  {hasChanges && (
                    <button
                      type="button"
                      onClick={() =>
                        onConfirm({
                          title: 'Salvar texto do capítulo',
                          description: `Atualizar título e narrativa de "${draft.title}" na aba HISTORIA da planilha Google?`,
                          confirmLabel: 'Salvar Texto',
                          action: async () => {
                            await updateStoryChapter(ch.id, {
                              title: draft.title,
                              text: draft.text,
                            });
                            onSuccessToast('Capítulo salvo.');
                          },
                        })
                      }
                      className="px-3.5 py-1.5 bg-[#C9A34A] text-[#080808] text-xs font-semibold uppercase rounded-sm cursor-pointer"
                    >
                      Salvar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MusicManagerTab({
  music,
  playerEnabled,
  defaultVolume,
  uploading,
  onUploadMusic,
  onConfirm,
  onSuccessToast,
}: {
  music: AdminDashboardPayload['music'];
  playerEnabled: boolean;
  defaultVolume: number;
  uploading: boolean;
  onUploadMusic: (e: ChangeEvent<HTMLInputElement>) => void;
  onConfirm: ConfirmFn;
  onSuccessToast: (m: string) => void;
}) {
  const [vol, setVol] = useState(defaultVolume);

  return (
    <div className="space-y-6">
      <div className="p-6 bg-[#151515] border border-white/10 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-white">Trilha Sonora do Site</h2>
          <p className="text-xs text-[#A5A5A5] mt-1">
            Arquivos enviados vão para TRILHA-SONORA/ no Google Drive com streaming HTTP Range.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              onConfirm({
                title: playerEnabled ? 'Desativar trilha sonora' : 'Ativar trilha sonora',
                description: `${playerEnabled ? 'Ocultar' : 'Exibir'} o player de trilha sonora ambiente no site público?`,
                confirmLabel: 'Confirmar',
                action: async () => {
                  await updateStudioConfig({ playerEnabled: !playerEnabled });
                  onSuccessToast('Configuração do player atualizada.');
                },
              })
            }
            className="px-4 py-2.5 border border-white/15 hover:border-[#C9A34A] text-xs uppercase tracking-[0.12em] rounded-sm cursor-pointer"
          >
            Player: {playerEnabled ? 'Ativo' : 'Desativado'}
          </button>

          <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] text-xs font-semibold uppercase tracking-[0.12em] rounded-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Enviando...' : 'Upload MP3 / Áudio'}</span>
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/mp4"
              disabled={uploading}
              onChange={onUploadMusic}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Default Volume */}
      <div className="p-5 bg-[#151515] border border-white/10 rounded-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-xs uppercase tracking-[0.12em] text-[#A5A5A5]">
            Volume Padrão do Player:
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={vol}
            onChange={(e) => setVol(Number(e.target.value))}
            className="w-36 accent-[#C9A34A]"
          />
          <span className="font-mono-tabular text-xs text-[#E2C47A]">
            {Math.round(vol * 100)}%
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            onConfirm({
              title: 'Atualizar volume padrão',
              description: `Definir o volume inicial da trilha sonora para ${Math.round(vol * 100)}%?`,
              confirmLabel: 'Salvar Volume',
              action: async () => {
                await updateStudioConfig({ defaultVolume: vol });
                onSuccessToast('Volume padrão atualizado.');
              },
            })
          }
          className="px-4 py-2 bg-[#080808] border border-white/15 hover:border-[#C9A34A] text-xs uppercase tracking-[0.1em] rounded-sm cursor-pointer"
        >
          Aplicar Volume Padrão
        </button>
      </div>

      {/* Track List */}
      <div className="space-y-4">
        {music.map((track) => (
          <div
            key={track.id}
            className="p-5 bg-[#151515] border border-white/10 rounded-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-[#C9A34A]">
                <span>{track.format}</span>
                <span aria-hidden="true">·</span>
                <span>{track.selected ? 'Música Principal' : 'Secundária'}</span>
              </div>
              <h3 className="font-display text-xl text-white font-medium">{track.name}</h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <audio controls preload="none" src={track.streamUrl} className="h-9 max-w-[240px]" />

              {!track.selected && (
                <button
                  type="button"
                  onClick={() =>
                    onConfirm({
                      title: 'Selecionar música principal',
                      description: `Definir "${track.name}" como a trilha sonora principal tocada aos visitantes?`,
                      confirmLabel: 'Definir Principal',
                      action: async () => {
                        await updateMusicTrack(track.id, { selected: true, active: true });
                        onSuccessToast('Música principal atualizada.');
                      },
                    })
                  }
                  className="px-3.5 py-2 bg-[#C9A34A] text-[#080808] text-xs font-semibold uppercase rounded-sm cursor-pointer"
                >
                  Selecionar Principal
                </button>
              )}

              {track.driveFileId !== 'ambient-fallback' && (
                <button
                  type="button"
                  onClick={() =>
                    onConfirm({
                      title: 'Excluir música',
                      description: `Remover "${track.name}" da lista, da aba MUSICA do Sheets e da pasta TRILHA-SONORA/ no Google Drive?`,
                      confirmLabel: 'Excluir Música',
                      destructive: true,
                      action: async () => {
                        await deleteMusicTrack(track.id);
                        onSuccessToast('Música removida.');
                      },
                    })
                  }
                  className="p-2 border border-red-500/30 text-red-400 hover:bg-red-950/50 rounded-sm cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppointmentsManagerTab({
  appointments,
  whatsappNumber,
  onConfirm,
  onSuccessToast,
}: {
  appointments: AdminDashboardPayload['appointments'];
  whatsappNumber: string;
  onConfirm: ConfirmFn;
  onSuccessToast: (m: string) => void;
}) {
  const statuses: AppointmentStatus[] = [
    'Pendente',
    'Em análise',
    'Atendido',
    'Confirmado',
    'Cancelado',
  ];

  return (
    <div className="space-y-5">
      <div className="p-6 bg-[#151515] border border-white/10 rounded-sm">
        <h2 className="font-display text-2xl text-white">Solicitações de Agendamento</h2>
        <p className="text-xs text-[#A5A5A5] mt-1">
          Acompanhe pedidos recebidos, atualize o status na planilha e inicie contato via WhatsApp.
        </p>
      </div>

      {appointments.length === 0 ? (
        <div className="p-14 text-center bg-[#151515] border border-white/10 rounded-sm">
          <p className="font-display text-2xl text-white mb-2">
            Nenhuma solicitação registrada ainda.
          </p>
          <p className="text-sm text-[#A5A5A5]">
            Os pedidos enviados pelo formulário público aparecerão aqui e na aba AGENDAMENTOS.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => {
            const cleanClientPhone = appt.whatsapp.replace(/\D/g, '');
            const targetPhone = cleanClientPhone.startsWith('55')
              ? cleanClientPhone
              : `55${cleanClientPhone || whatsappNumber}`;
            const waLink = `https://wa.me/${targetPhone}?text=${encodeURIComponent(
              `Olá, ${appt.fullName}! Aqui é o Luan Hércules sobre sua solicitação de tatuagem (${appt.id}).`
            )}`;

            return (
              <div
                key={appt.id}
                className="p-6 bg-[#151515] border border-white/10 rounded-sm space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#C9A34A] mb-1">
                      <span className="font-mono-tabular">{appt.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{appt.serviceType}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#A5A5A5]">
                        {new Date(appt.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <h3 className="font-display text-2xl text-white font-medium">
                      {appt.fullName}
                    </h3>
                    <p className="text-xs text-[#A5A5A5] mt-1">
                      {appt.whatsapp} · {appt.email}
                      {appt.birthDate ? ` · Nasc.: ${appt.birthDate}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={appt.status}
                      onChange={(e) => {
                        const nextStatus = e.target.value as AppointmentStatus;
                        onConfirm({
                          title: 'Alterar status do agendamento',
                          description: `Alterar o status de "${appt.fullName}" (${appt.id}) para "${nextStatus}" na planilha Google Sheets?`,
                          confirmLabel: 'Atualizar Status',
                          action: async () => {
                            await updateAppointmentStatus(appt.id, nextStatus);
                            onSuccessToast(`Status alterado para ${nextStatus}.`);
                          },
                        });
                      }}
                      className="px-3 py-2 bg-[#080808] border border-[#C9A34A]/40 text-xs text-[#E2C47A] rounded-sm"
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] text-xs font-semibold uppercase rounded-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      onClick={() =>
                        onConfirm({
                          title: 'Excluir registro de agendamento',
                          description: `Remover definitivamente os dados de "${appt.fullName}" (${appt.id}) da aplicação e do Google Sheets?`,
                          confirmLabel: 'Excluir Registro',
                          destructive: true,
                          action: async () => {
                            await deleteAppointment(appt.id);
                            onSuccessToast('Agendamento removido.');
                          },
                        })
                      }
                      aria-label="Excluir agendamento"
                      className="p-2 border border-red-500/30 text-red-400 hover:bg-red-950/50 rounded-sm cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#080808] p-4 border border-white/10 rounded-sm">
                  <div>
                    <span className="text-[#A5A5A5] block">Região / Tamanho</span>
                    <span className="text-white">
                      {appt.bodyRegion} · {appt.approximateSize}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#A5A5A5] block">Data / Horário desejado</span>
                    <span className="text-white">
                      {appt.desiredDate} · {appt.desiredTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#A5A5A5] block">Consentimento LGPD</span>
                    <span className="text-emerald-400">Confirmado</span>
                  </div>
                </div>

                <p className="text-sm text-[#A5A5A5] leading-relaxed">{appt.description}</p>

                {appt.referenceImageUrl && (
                  <div className="pt-2">
                    <p className="text-xs text-[#C9A34A] mb-2">Referência enviada pelo cliente:</p>
                    <img
                      src={appt.referenceImageUrl}
                      alt="Referência do cliente"
                      className="w-32 h-32 object-cover border border-white/15 rounded-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsManagerTab({
  config,
  logs,
  googleStatus,
  onRefreshGoogleStatus,
  passwordStoredInAppData,
  onConfirm,
  onSuccessToast,
  onErrorToast,
}: {
  config: AdminDashboardPayload['config'];
  logs: AdminDashboardPayload['logs'];
  googleStatus: GoogleConnectionStatus | null;
  onRefreshGoogleStatus: () => Promise<void>;
  passwordStoredInAppData: boolean;
  onConfirm: ConfirmFn;
  onSuccessToast: (m: string) => void;
  onErrorToast: (m: string) => void;
}) {
  const [form, setForm] = useState(config);
  const [aboutText, setAboutText] = useState(config.aboutParagraphs.join('\n\n'));
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [copiedUriKey, setCopiedUriKey] = useState<string | null>(null);
  const [checkingEnv, setCheckingEnv] = useState(false);
  const [appsScriptCode, setAppsScriptCode] = useState<string | null>(null);
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [appsScriptBusy, setAppsScriptBusy] = useState(false);

  const originCallbackUri =
    typeof window !== 'undefined' ? `${window.location.origin}/api/google/callback` : '';
  const serverRedirectUri = googleStatus?.redirectUri || originCallbackUri;
  const redirectMismatch =
    Boolean(originCallbackUri && serverRedirectUri) && originCallbackUri !== serverRedirectUri;

  const copyUri = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedUriKey(key);
      setTimeout(() => setCopiedUriKey(null), 2000);
    } catch {
      onErrorToast('Não foi possível copiar automaticamente. Selecione e copie o endereço.');
    }
  };

  const handleRecheckEnv = async () => {
    setCheckingEnv(true);
    try {
      await onRefreshGoogleStatus();
      onSuccessToast('Diagnóstico do servidor atualizado.');
    } finally {
      setCheckingEnv(false);
    }
  };

  const handleCopyAppsScript = async () => {
    setAppsScriptBusy(true);
    try {
      const code = appsScriptCode || (await fetchAppsScriptCode()).code;
      setAppsScriptCode(code);
      await navigator.clipboard.writeText(code);
      setCopiedUriKey('apps-script');
      setTimeout(() => setCopiedUriKey(null), 2500);
      onSuccessToast('Código Code.gs copiado! Cole em Extensões -> Apps Script na sua Planilha Google.');
    } catch (err) {
      onErrorToast(err instanceof Error ? err.message : 'Erro ao copiar código Apps Script.');
    } finally {
      setAppsScriptBusy(false);
    }
  };

  const handleToggleAppsScriptCode = async () => {
    if (!appsScriptCode) {
      try {
        const res = await fetchAppsScriptCode();
        setAppsScriptCode(res.code);
      } catch (err) {
        onErrorToast(err instanceof Error ? err.message : 'Erro ao carregar código Apps Script.');
        return;
      }
    }
    setShowScriptCode((prev) => !prev);
  };

  const handleTestAppsScript = async () => {
    setAppsScriptBusy(true);
    try {
      const res = await testAppsScriptConnection();
      await onRefreshGoogleStatus();
      onSuccessToast(
        `Apps Script conectado! Pasta ${res.rootFolderId} e planilha ${res.sheetId} validadas.`
      );
    } catch (err) {
      onErrorToast(err instanceof Error ? err.message : 'Falha ao testar Apps Script.');
    } finally {
      setAppsScriptBusy(false);
    }
  };

  const handleSyncAppsScript = async () => {
    setAppsScriptBusy(true);
    try {
      const res = await syncViaAppsScript();
      await onRefreshGoogleStatus();
      onSuccessToast(`Planilha ${res.sheetId} sincronizada via Google Apps Script.`);
    } catch (err) {
      onErrorToast(err instanceof Error ? err.message : 'Falha ao sincronizar via Apps Script.');
    } finally {
      setAppsScriptBusy(false);
    }
  };

  const handleSaveConfig = (e: FormEvent) => {
    e.preventDefault();
    onConfirm({
      title: 'Salvar configurações do estúdio',
      description:
        'Aplicar alterações de textos, contatos, colunas da galeria e limites no site e na aba CONFIGURACOES da planilha Google?',
      confirmLabel: 'Salvar Configurações',
      action: async () => {
        await updateStudioConfig({
          ...form,
          aboutParagraphs: aboutText
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean),
        });
        onSuccessToast('Configurações salvas e sincronizadas.');
      },
    });
  };

  const handlePwdSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await changeAdminPassword(curPwd, newPwd);
      setCurPwd('');
      setNewPwd('');
      onSuccessToast('Senha administrativa atualizada com sucesso.');
    } catch (err) {
      onErrorToast(err instanceof Error ? err.message : 'Erro ao alterar senha.');
    }
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSaveConfig}
        className="p-6 bg-[#151515] border border-white/10 rounded-sm space-y-5"
      >
        <h2 className="font-display text-2xl text-white">Contatos, Textos e Galeria</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
              Nome do Estúdio
            </label>
            <input
              type="text"
              value={form.studioName}
              onChange={(e) => setForm({ ...form, studioName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
              Instagram URL
            </label>
            <input
              type="url"
              value={form.instagramUrl}
              onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
              WhatsApp (somente dígitos com 55)
            </label>
            <input
              type="text"
              value={form.whatsappNumber}
              onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
              E-mail Oficial
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
              Frase Principal (Home)
            </label>
            <input
              type="text"
              value={form.heroHeadline}
              onChange={(e) => setForm({ ...form, heroHeadline: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
              Subtítulo (Home)
            </label>
            <input
              type="text"
              value={form.heroSubtitle}
              onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
              Colunas do Portfólio (Desktop)
            </label>
            <select
              value={form.galleryColumns}
              onChange={(e) =>
                setForm({ ...form, galleryColumns: Number(e.target.value) === 4 ? 4 : 3 })
              }
              className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
            >
              <option value={3}>3 Colunas</option>
              <option value={4}>4 Colunas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
              Limite de Upload (MB)
            </label>
            <input
              type="number"
              min={5}
              max={100}
              value={form.maxUploadMb}
              onChange={(e) => setForm({ ...form, maxUploadMb: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
            Título Sobre o Tatuador
          </label>
          <input
            type="text"
            value={form.aboutTitle}
            onChange={(e) => setForm({ ...form, aboutTitle: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm mb-4"
          />

          <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
            Textos Sobre o Tatuador (separe parágrafos com linha em branco)
          </label>
          <textarea
            rows={5}
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
            Frase de Encerramento da História
          </label>
          <textarea
            rows={2}
            value={form.storyClosingQuote}
            onChange={(e) => setForm({ ...form, storyClosingQuote: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
          />
        </div>

        <button
          type="submit"
          className="px-6 py-3 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] text-xs font-semibold uppercase tracking-[0.12em] rounded-sm cursor-pointer"
        >
          Salvar Configurações
        </button>
      </form>

      {/* Google OAuth Server Environment Diagnostics (read-only status, secrets remain in server env) */}
      <div className="p-6 bg-[#151515] border border-white/10 rounded-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-[#C9A34A]" />
              <p className="text-xs uppercase tracking-[0.16em] text-[#C9A34A]">
                Ambiente Seguro do Servidor · Google OAuth 2.0
              </p>
            </div>
            <h2 className="font-display text-2xl text-white">
              Variáveis de Ambiente e Redirect URI
            </h2>
            <p className="text-xs text-[#A5A5A5] mt-1 max-w-2xl leading-relaxed">
              Por segurança e compatibilidade com funções serverless na Vercel, segredos como{' '}
              <span className="font-mono-tabular text-white">GOOGLE_CLIENT_SECRET</span> e{' '}
              <span className="font-mono-tabular text-white">SESSION_SECRET</span> são mantidos
              exclusivamente nas variáveis de ambiente do servidor (<strong>Settings → Secrets</strong>{' '}
              no AI Studio e <strong>Settings → Environment Variables</strong> na Vercel), nunca em
              formulários ou armazenamento do navegador.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRecheckEnv}
            disabled={checkingEnv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-white/15 hover:border-[#C9A34A] text-xs uppercase tracking-[0.1em] text-[#E2C47A] rounded-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingEnv ? 'animate-spin' : ''}`} />
            <span>Verificar Servidor</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            { key: 'GOOGLE_CLIENT_ID', required: true },
            { key: 'GOOGLE_CLIENT_SECRET', required: true },
            { key: 'ADMIN_EMAIL', required: true },
            { key: 'SESSION_SECRET', required: false },
            { key: 'GOOGLE_REDIRECT_URI', required: false },
            { key: 'GOOGLE_REFRESH_TOKEN', required: false },
            { key: 'GOOGLE_DRIVE_FOLDER_ID', required: false },
            { key: 'GOOGLE_SHEET_ID', required: false },
          ].map((item) => {
            const ok = Boolean(googleStatus?.envStatus?.[item.key]);
            return (
              <div
                key={item.key}
                className="p-3 bg-[#080808] border border-white/10 rounded-sm flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-mono-tabular text-white truncate">{item.key}</p>
                  <p className="text-[11px] text-[#A5A5A5]">
                    {item.required ? 'Obrigatória' : 'Opcional / Auto'}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-sm shrink-0 ${
                    ok
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      : item.required
                        ? 'bg-amber-950/60 text-[#E2C47A] border border-[#C9A34A]/40'
                        : 'bg-white/5 text-[#A5A5A5] border border-white/10'
                  }`}
                >
                  {ok ? 'Configurada' : 'Pendente'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 pt-1">
          <div className="p-4 bg-[#080808] border border-white/10 rounded-sm space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-1.5">
                Redirect URI ativa no servidor
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-[#151515] border border-white/10 text-xs text-[#E2C47A] font-mono-tabular break-all rounded-sm">
                  {serverRedirectUri}
                </code>
                <button
                  type="button"
                  onClick={() => copyUri('server', serverRedirectUri)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-white/15 hover:border-[#C9A34A] text-xs text-white rounded-sm cursor-pointer shrink-0"
                >
                  {copiedUriKey === 'server' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copiada</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#C9A34A]" />
                      <span>Copiar URI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {redirectMismatch && (
              <div className="pt-2 border-t border-white/10 space-y-2">
                <p className="text-xs text-[#E2C47A]">
                  Atenção: este painel está aberto em{' '}
                  <span className="font-mono-tabular text-white">{originCallbackUri}</span>, mas{' '}
                  <span className="font-mono-tabular text-white">GOOGLE_REDIRECT_URI</span> no
                  servidor aponta para outro domínio. Para testar o login Google neste endereço,
                  adicione esta URI no Google Cloud Console e em{' '}
                  <span className="font-mono-tabular">GOOGLE_REDIRECT_URI</span>:
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-[#151515] border border-[#C9A34A]/30 text-xs text-white font-mono-tabular break-all rounded-sm">
                    {originCallbackUri}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyUri('origin', originCallbackUri)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-[#C9A34A]/40 hover:border-[#C9A34A] text-xs text-[#E2C47A] rounded-sm cursor-pointer shrink-0"
                  >
                    {copiedUriKey === 'origin' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copiada</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar URI Atual</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Google Apps Script (Planilha Google) Bridge Card */}
      <div className="p-6 bg-[#151515] border border-white/10 rounded-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#C9A34A] mb-1">
              Execução Direta na Planilha · Google Apps Script
            </p>
            <h2 className="font-display text-2xl text-white">
              Conexão via Google Apps Script (Code.gs)
            </h2>
            <p className="text-xs text-[#A5A5A5] mt-1 max-w-2xl leading-relaxed">
              Permite executar a criação das pastas <span className="text-white">LUAN HÉRCULES TATTOO</span>,
              das 6 abas e toda a sincronização diretamente dentro da sua Planilha Google via{' '}
              <strong>Extensões → Apps Script</strong>, sem depender de tela de consentimento OAuth.
            </p>
          </div>

          <span
            className={`px-3 py-1 text-xs font-medium rounded-sm border ${
              googleStatus?.appsScript?.connected
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                : googleStatus?.appsScript?.configured
                  ? 'bg-amber-950/60 text-[#E2C47A] border-[#C9A34A]/40'
                  : 'bg-white/5 text-[#A5A5A5] border-white/10'
            }`}
          >
            {googleStatus?.appsScript?.connected
              ? 'Apps Script Conectado'
              : googleStatus?.appsScript?.configured
                ? 'Configurado (Pronto para testar)'
                : 'Aguardando implantação'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { key: 'APPS_SCRIPT_URL', label: 'URL /exec da implantação Web App' },
            { key: 'APPS_SCRIPT_SECRET', label: 'Chave secreta gerada no Apps Script' },
          ].map((item) => {
            const ok = Boolean(googleStatus?.envStatus?.[item.key]);
            return (
              <div
                key={item.key}
                className="p-3 bg-[#080808] border border-white/10 rounded-sm flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-mono-tabular text-white truncate">{item.key}</p>
                  <p className="text-[11px] text-[#A5A5A5]">{item.label}</p>
                </div>
                <span
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-sm shrink-0 ${
                    ok
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-950/60 text-[#E2C47A] border border-[#C9A34A]/40'
                  }`}
                >
                  {ok ? 'Configurada' : 'Pendente'}
                </span>
              </div>
            );
          })}
        </div>

        <ol className="text-xs text-[#A5A5A5] space-y-1.5 list-decimal list-inside bg-[#080808] p-4 border border-white/10 rounded-sm">
          <li>
            Abra a sua Planilha no Google Sheets e clique em{' '}
            <strong className="text-white">Extensões → Apps Script</strong>.
          </li>
          <li>
            Clique em <strong className="text-white">Copiar Code.gs</strong> abaixo, cole no editor
            do Apps Script e salve.
          </li>
          <li>
            Execute a função <span className="font-mono-tabular text-[#E2C47A]">setupStudioWorkspace</span>{' '}
            (ou use o menu <strong className="text-white">LUAN HÉRCULES STUDIO</strong> na planilha)
            para criar as pastas, abas e exibir a chave <span className="font-mono-tabular text-white">APPS_SCRIPT_SECRET</span>.
          </li>
          <li>
            Clique em <strong className="text-white">Implantar → Nova implantação → App da Web</strong>{' '}
            (<em>Executar como: Eu</em> / <em>Quem tem acesso: Qualquer pessoa</em>) e salve a URL{' '}
            <span className="font-mono-tabular text-white">/exec</span> em{' '}
            <span className="font-mono-tabular text-white">APPS_SCRIPT_URL</span> e a chave em{' '}
            <span className="font-mono-tabular text-white">APPS_SCRIPT_SECRET</span> nos Secrets do
            AI Studio / Vercel.
          </li>
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCopyAppsScript}
            disabled={appsScriptBusy}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] text-xs font-semibold uppercase tracking-[0.1em] rounded-sm cursor-pointer disabled:opacity-50"
          >
            {copiedUriKey === 'apps-script' ? (
              <>
                <Check className="w-4 h-4" />
                <span>Code.gs Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar Code.gs</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleAppsScriptCode}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/15 hover:border-[#C9A34A] text-xs uppercase tracking-[0.1em] text-white rounded-sm cursor-pointer"
          >
            <span>{showScriptCode ? 'Ocultar Código' : 'Visualizar Code.gs'}</span>
          </button>

          <button
            type="button"
            onClick={handleTestAppsScript}
            disabled={appsScriptBusy || !googleStatus?.appsScript?.configured}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#C9A34A]/50 hover:border-[#C9A34A] text-xs uppercase tracking-[0.1em] text-[#E2C47A] rounded-sm cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${appsScriptBusy ? 'animate-spin' : ''}`} />
            <span>Testar Conexão Apps Script</span>
          </button>

          <button
            type="button"
            onClick={handleSyncAppsScript}
            disabled={appsScriptBusy || !googleStatus?.appsScript?.configured}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-emerald-500/40 hover:border-emerald-400 text-xs uppercase tracking-[0.1em] text-emerald-300 rounded-sm cursor-pointer disabled:opacity-40"
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>Sincronizar via Apps Script</span>
          </button>
        </div>

        {showScriptCode && appsScriptCode && (
          <pre className="p-4 bg-[#080808] border border-white/10 rounded-sm text-[11px] font-mono-tabular text-[#E2C47A] overflow-x-auto max-h-80">
            <code>{appsScriptCode}</code>
          </pre>
        )}
      </div>

      {/* Password Change */}
      <form
        onSubmit={handlePwdSubmit}
        className="p-6 bg-[#151515] border border-white/10 rounded-sm space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl text-white">Alterar Senha Administrativa</h2>
          <span className="text-xs text-[#A5A5A5]">
            Armazenamento privado Drive (appDataFolder):{' '}
            <strong className="text-[#E2C47A]">
              {passwordStoredInAppData ? 'Sincronizado' : 'Conecte o Google para sincronizar'}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="password"
            required
            value={curPwd}
            onChange={(e) => setCurPwd(e.target.value)}
            placeholder="Senha atual"
            className="px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)"
            className="px-3.5 py-2.5 bg-[#080808] border border-white/15 text-sm text-white rounded-sm"
          />
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 border border-[#C9A34A] text-[#E2C47A] hover:bg-[#C9A34A] hover:text-[#080808] text-xs font-semibold uppercase tracking-[0.12em] rounded-sm transition-colors cursor-pointer"
        >
          Atualizar Senha
        </button>
      </form>

      {/* Full Log */}
      <div className="p-6 bg-[#151515] border border-white/10 rounded-sm">
        <h2 className="font-display text-2xl text-white mb-4">Histórico Completo de Atividades</h2>
        <div className="max-h-72 overflow-y-auto divide-y divide-white/10 text-xs">
          {logs.map((l) => (
            <div key={l.id} className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="text-white font-medium">{l.action}</span>
                <span className="text-[#A5A5A5] ml-2">{l.details}</span>
              </div>
              <span className="font-mono-tabular text-[#A5A5A5] shrink-0">
                {new Date(l.timestamp).toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
