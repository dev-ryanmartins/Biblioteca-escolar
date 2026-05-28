import { invoke } from "../lib/invoke";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title, Tooltip,
} from "chart.js";
import {
  AlertTriangle,
  BookCopy,
  BookOpen,
  ChevronDown, ChevronUp,
  Clock,
  RotateCcw,
  TrendingUp,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import type { DashboardStats, LoanDetail, MonthlyLoanCount } from "../types";
import { currentYear, MONTHS, yearRange } from "../types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

function StatCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="glass p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-slate-400 text-xs font-medium">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const years = yearRange(5);
  const [anoLetivo, setAnoLetivo] = useState(currentYear());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overdue, setOverdue] = useState<LoanDetail[]>([]);
  const [monthly, setMonthly] = useState<MonthlyLoanCount[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    invoke<DashboardStats>("get_dashboard_stats", { anoLetivo }).then(setStats).catch(console.error);
    invoke<LoanDetail[]>("list_overdue_loans").then(setOverdue).catch(console.error);
    invoke<MonthlyLoanCount[]>("get_loans_by_month", { year: anoLetivo }).then(setMonthly).catch(console.error);
  }, [anoLetivo]);

  const monthCounts = MONTHS.map((_, i) => monthly.find((m) => m.month === i + 1)?.count ?? 0);

  const chartData = {
    labels: MONTHS.map((m) => m.slice(0, 3)),
    datasets: [{
      label: "Empréstimos",
      data: monthCounts,
      backgroundColor: "rgba(139,92,246,0.7)",
      borderColor: "rgba(139,92,246,1)",
      borderWidth: 1,
      borderRadius: 6,
    }],
  };

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#64748b", font: { size: 11 } } },
      y: { grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "#64748b", precision: 0 } },
    },
  };

  const visibleOverdue = showAll ? overdue : overdue.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Painel de Controle</h1>
          <p className="text-slate-500 text-sm mt-0.5">Visão geral da biblioteca</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Ano Letivo</label>
          <select
            value={anoLetivo}
            onChange={(e) => setAnoLetivo(Number(e.target.value))}
            className="input !w-auto !py-1.5 text-sm"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Total de Livros" value={stats?.total_books ?? 0} color="bg-gradient-to-br from-violet-600 to-indigo-600" />
        <StatCard icon={BookCopy} label="Empréstimos Ativos" value={stats?.active_loans ?? 0} color="bg-gradient-to-br from-blue-600 to-cyan-600" sub={`${stats?.loans_this_period ?? 0} este mês`} />
        <StatCard icon={AlertTriangle} label="Em Atraso" value={stats?.overdue_loans ?? 0} color="bg-gradient-to-br from-rose-600 to-pink-600" />
        <StatCard icon={Clock} label="Multas Pendentes" value={stats?.pending_fines ?? 0} color="bg-gradient-to-br from-amber-500 to-orange-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Chart */}
        <div className="xl:col-span-3 glass p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-white">Empréstimos por Mês</h2>
              <p className="text-slate-500 text-xs mt-0.5">Ano Letivo {anoLetivo}</p>
            </div>
            <TrendingUp className="w-4 h-4 text-violet-400" />
          </div>
          <div className="h-44">
            <Bar data={chartData} options={chartOpts} />
          </div>
        </div>

        {/* Quick stats */}
        <div className="xl:col-span-2 space-y-4">
          <div className="glass p-5">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">Este Mês</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-300"><BookCopy className="w-4 h-4 text-violet-400" /> Novos Empréstimos</div>
                <span className="font-bold text-white">{stats?.loans_this_period ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-300"><RotateCcw className="w-4 h-4 text-emerald-400" /> Devoluções</div>
                <span className="font-bold text-white">{stats?.returns_this_period ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-300"><Users className="w-4 h-4 text-blue-400" /> Alunos Cadastrados</div>
                <span className="font-bold text-white">{stats?.total_students ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue loans alert */}
      {overdue.length > 0 && (
        <div className="glass border-l-4 border-rose-500 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <h2 className="font-bold text-white text-base">Devoluções em Atraso</h2>
              <span className="badge-overdue">{overdue.length}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Aluno</th>
                  <th className="th">Série / Turma</th>
                  <th className="th">Livro</th>
                  <th className="th">Vencimento</th>
                  <th className="th">Telefone</th>
                </tr>
              </thead>
              <tbody>
                {visibleOverdue.map((l) => (
                  <tr key={l.id} className="tr">
                    <td className="td font-medium text-rose-300">{l.student_name}</td>
                    <td className="td text-slate-400">{l.student_grade}° Ano {l.student_class}</td>
                    <td className="td text-slate-300">{l.book_title}</td>
                    <td className="td">
                      <span className="badge-overdue">{l.due_date}</span>
                    </td>
                    <td className="td text-slate-400">{l.student_phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overdue.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="btn-ghost mt-3 text-xs"
            >
              {showAll ? <><ChevronUp className="w-3 h-3" /> Ver menos</> : <><ChevronDown className="w-3 h-3" /> Ver todos ({overdue.length})</>}
            </button>
          )}
        </div>
      )}

      {overdue.length === 0 && stats && (
        <div className="glass p-5 flex items-center gap-3 text-emerald-400">
          <BookOpen className="w-5 h-5" />
          <span className="text-sm font-medium">Nenhum empréstimo em atraso. Tudo em ordem!</span>
        </div>
      )}
    </div>
  );
}
