import { invoke } from "../lib/invoke";
import { Save, Shield, UserCog } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { SystemSettings } from "../types";

export default function Settings() {
  const [maxLoanDays, setMaxLoanDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<SystemSettings>("get_system_settings")
      .then((settings) => setMaxLoanDays(settings.max_loan_days))
      .catch((err) => setError(String(err)));
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (maxLoanDays < 1 || maxLoanDays > 30) {
      setError("O prazo máximo precisa ficar entre 1 e 30 dias.");
      return;
    }
    setLoading(true);
    try {
      const settings = await invoke<SystemSettings>("update_system_settings", {
        settings: { max_loan_days: maxLoanDays },
      });
      setMaxLoanDays(settings.max_loan_days);
      setMessage("Configurações salvas com sucesso.");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Configurações</h1>
        <p className="text-slate-500 text-sm mt-0.5">Preferências gerais e perfis de acesso</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        <form onSubmit={handleSave} className="glass p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Empréstimos</h2>
            <p className="text-xs text-slate-500 mt-1">Regra aplicada ao registrar e renovar livros.</p>
          </div>
          <div>
            <label className="label">Prazo máximo de devolução</label>
            <input
              className="input"
              type="number"
              min={1}
              max={30}
              value={maxLoanDays}
              onChange={(e) => setMaxLoanDays(Number(e.target.value))}
            />
            <p className="text-xs text-slate-500 mt-1">Limite permitido: 1 a 30 dias.</p>
          </div>
          {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>}
          {message && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{message}</div>}
          <button type="submit" disabled={loading} className="btn-primary justify-center">
            <Save className="w-4 h-4" /> {loading ? "Salvando..." : "Salvar configurações"}
          </button>
        </form>

        <div className="glass p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Perfis do Sistema</h2>
            <p className="text-xs text-slate-500 mt-1">Resumo das permissões usadas no painel administrativo.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-4">
              <div className="flex items-center gap-2 text-violet-300 text-sm font-semibold">
                <Shield className="w-4 h-4" /> Administrador
              </div>
              <p className="text-xs text-slate-400 mt-3">Gerencia usuários, configurações, acervo, empréstimos, multas e relatórios.</p>
            </div>
            <div className="rounded-lg border border-slate-600/30 bg-slate-800/60 p-4">
              <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold">
                <UserCog className="w-4 h-4" /> Bibliotecário
              </div>
              <p className="text-xs text-slate-400 mt-3">Opera alunos, livros, empréstimos, multas e relatórios sem alterar usuários ou regras gerais.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
