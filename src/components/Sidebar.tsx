import { NavLink } from "react-router-dom";
import {
  BookOpen, Users, BookCopy, AlertTriangle,
  ClipboardList, UserCog, LogOut, Library, LayoutDashboard, Settings,
} from "lucide-react";
import { useAuth } from "../App";

const links = [
  { to: "/", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/students", label: "Alunos", icon: Users },
  { to: "/books", label: "Livros", icon: BookOpen },
  { to: "/comics", label: "HQs", icon: BookOpen },
  { to: "/loans", label: "Empréstimos", icon: BookCopy },
  { to: "/fines", label: "Multas", icon: AlertTriangle },
  { to: "/reports", label: "Relatórios", icon: ClipboardList },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <Library className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-white leading-tight">Biblioteca</p>
          <p className="text-slate-500 text-xs">Ensino Fundamental</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              isActive
                ? "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all bg-gradient-to-r from-violet-600/20 to-indigo-600/10 text-violet-300 border border-violet-500/20"
                : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
        {user?.is_admin && (
          <>
          <NavLink
            to="/users"
            className={({ isActive }) =>
              isActive
                ? "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all bg-gradient-to-r from-violet-600/20 to-indigo-600/10 text-violet-300 border border-violet-500/20"
                : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
            }
          >
            <UserCog className="w-4 h-4 flex-shrink-0" />
            Usuários
          </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                isActive
                  ? "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all bg-gradient-to-r from-violet-600/20 to-indigo-600/10 text-violet-300 border border-violet-500/20"
                  : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
              }
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              Configuracoes
            </NavLink>
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-slate-800 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.is_admin ? "Administrador" : "Bibliotecário"}</p>
          </div>
          <button
            onClick={logout}
            title="Sair"
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
