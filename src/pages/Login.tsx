import { invoke } from "../lib/invoke";
import { Eye, EyeOff, Library, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import type { User } from "../types";

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<boolean>("check_first_run")
      .then(setIsFirstRun)
      .catch(() => setIsFirstRun(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Digite o nome de usuário."); return; }
    if (!password.trim()) { setError("Digite a senha."); return; }
    setLoading(true);
    try {
      if (isFirstRun) {
        const user = await invoke<User>("create_user", { name: name.trim(), password, isAdmin: true });
        setUser(user);
      } else {
        const user = await invoke<User>("login", { name: name.trim(), password });
        setUser(user);
      }
      navigate("/");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-violet-600/8 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/8 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/40 mb-5">
            <Library className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Biblioteca Escolar</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isFirstRun === null ? "Verificando..." : isFirstRun ? "Crie a conta de administrador" : "Faça login para continuar"}
          </p>
        </div>

        <div className="glass p-8">
          {isFirstRun && (
            <div className="mb-5 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <p className="text-violet-300 text-xs font-medium">Primeiro acesso detectado. Crie seu usuário administrador para iniciar o sistema.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Usuário</label>
              <input
                className="input"
                placeholder="Nome de usuário"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label">Senha {isFirstRun && <span className="text-slate-500 normal-case font-normal">(mínimo 4 caracteres)</span>}</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isFirstRun ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isFirstRun === null}
              className="btn-primary w-full justify-center py-3 text-sm"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isFirstRun ? "Criar Conta e Entrar" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Sistema de Gestão de Biblioteca — Ensino Fundamental
        </p>
      </div>
    </div>
  );
}
