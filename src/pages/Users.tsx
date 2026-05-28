import { invoke } from "../lib/invoke";
import { Eye, EyeOff, Loader2, Plus, Shield, Trash2, User, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../App";
import Modal from "../components/Modal";
import type { User as UserType } from "../types";

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => invoke<UserType[]>("list_users").then(setUsers).catch(console.error);
  useEffect(() => { load(); }, []);

  function closeModal() {
    setModal(false); setName(""); setPassword(""); setIsAdmin(false);
    setError(""); setSuccess(""); setShowPw(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!name.trim() || !password.trim()) { setError("Preencha todos os campos."); return; }
    setLoading(true);
    try {
      await invoke("create_user", { name: name.trim(), password, isAdmin });
      setSuccess(`Usuário "${name.trim()}" criado com sucesso!`);
      load(); setName(""); setPassword(""); setIsAdmin(false);
    } catch (err) { setError(String(err)); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: number, uname: string) {
    if (!confirm(`Excluir o usuário "${uname}"?`)) return;
    try { await invoke("delete_user", { id }); load(); }
    catch (err) { alert(String(err)); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Usuários do Sistema</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gerenciamento de acessos</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo Usuário
        </button>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="th">Usuário</th>
              <th className="th">Perfil</th>
              <th className="th">Criado em</th>
              <th className="th">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="tr">
                <td className="td">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600/30 to-indigo-600/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">{u.name}</p>
                      {u.id === me?.id && <p className="text-xs text-violet-400">Você</p>}
                    </div>
                  </div>
                </td>
                <td className="td">
                  {u.is_admin ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/25">
                      <Shield className="w-3 h-3" /> Administrador
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-400 bg-slate-500/15 border border-slate-500/25">
                      <UserCog className="w-3 h-3" /> Bibliotecário
                    </span>
                  )}
                </td>
                <td className="td text-slate-500">{u.created_at.slice(0, 10)}</td>
                <td className="td">
                  {u.id !== me?.id && (
                    <button onClick={() => handleDelete(u.id, u.name)} className="btn-ghost text-rose-500 hover:bg-rose-500/10 p-1.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="td text-center text-slate-600 py-10">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Criar Novo Usuário" isOpen={modal} onClose={closeModal}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Nome de Usuário</label>
            <input className="input" placeholder="ex: maria.silva" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Senha</label>
            <div className="relative">
              <input className="input pr-10" type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="w-4 h-4 accent-violet-500 rounded" />
            <span className="text-sm text-slate-300">Perfil de Administrador (pode gerenciar usuários)</span>
          </label>
          {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>}
          {success && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Criar Usuário
            </button>
            <button type="button" onClick={closeModal} className="btn-secondary">Fechar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
