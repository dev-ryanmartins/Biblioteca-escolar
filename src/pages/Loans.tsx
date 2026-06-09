import { invoke } from "../lib/invoke";
import {
  AlertTriangle,
  BookCopy,
  CalendarDays,
  CheckCircle,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Modal from "../components/Modal";
import type { Book, LoanDetail, SystemSettings } from "../types";
import { MONTHS, VALID_CLASSES_BY_GRADE, WEEKS, currentYear, yearRange } from "../types";

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DEFAULT_MAX_LOAN_DAYS = 30;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function maxDueDate(maxLoanDays: number): string {
  return addDays(today(), maxLoanDays);
}

function validateDueDate(dateStr: string, maxLoanDays: number): string | null {
  if (!dateStr) return "Escolha a data de devolução.";
  if (dateStr < today()) return "A data de devolução não pode ser anterior a hoje.";
  if (dateStr > maxDueDate(maxLoanDays)) return `A data de devolução não pode passar de ${maxLoanDays} dias.`;
  return null;
}

function StatusBadge({ status, renewed }: { status: string; renewed: number }) {
  if (status === "overdue") return <span className="badge-overdue"><AlertTriangle className="w-3 h-3" /> Em Atraso</span>;
  if (status === "returned") return <span className="badge-returned"><CheckCircle className="w-3 h-3" /> Devolvido</span>;
  if (renewed > 0) return <span className="badge-active"><RefreshCw className="w-3 h-3" /> Renovado</span>;
  return <span className="badge-active">Ativo</span>;
}

export default function Loans() {
  const years = yearRange(5);

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [anoLetivo, setAnoLetivo] = useState(currentYear());
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [weekFilter, setWeekFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [maxLoanDays, setMaxLoanDays] = useState(DEFAULT_MAX_LOAN_DAYS);

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [loans, setLoans] = useState<LoanDetail[]>([]);
  const [books, setBooks] = useState<Book[]>([]);

  // ── New loan form ─────────────────────────────────────────────────────────────
  const [newModal, setNewModal] = useState(false);
  const [nAnoLetivo, setNAnoLetivo] = useState(currentYear());
  const [nName, setNName] = useState("");
  const [nGrade, setNGrade] = useState<number>(1);
  const [nClass, setNClass] = useState("A");
  const [nPhone, setNPhone] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nBookId, setNBookId] = useState<number | "">("");
  const [nBookSearch, setNBookSearch] = useState("");
  const [nDueDate, setNDueDate] = useState(() => addDays(today(), 14));
  const [nLoading, setNLoading] = useState(false);
  const [nError, setNError] = useState("");

  // ── Renew form ────────────────────────────────────────────────────────────────
  const [renewLoan, setRenewLoan] = useState<LoanDetail | null>(null);
  const [renewDate, setRenewDate] = useState("");
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewError, setRenewError] = useState("");

  // ─────────────────────────────────────────────────────────────────────────────

  const loadLoans = useCallback(() => {
    invoke<LoanDetail[]>("list_loans", {
      anoLetivo,
      month: monthFilter,
      week: weekFilter,
      status: statusFilter,
      search: search || null,
    }).then(setLoans).catch(console.error);
  }, [anoLetivo, monthFilter, weekFilter, statusFilter, search]);

  useEffect(() => { loadLoans(); }, [loadLoans]);

  useEffect(() => {
    invoke<SystemSettings>("get_system_settings")
      .then((settings) => setMaxLoanDays(settings.max_loan_days || DEFAULT_MAX_LOAN_DAYS))
      .catch(console.error);
  }, []);

  useEffect(() => {
    invoke<Book[]>("list_books", { search: nBookSearch || null, genre: null, collectionType: null, includeDeleted: false })
      .then(setBooks).catch(console.error);
  }, [nBookSearch]);

  function resetNewForm() {
    setNName(""); setNGrade(1); setNClass("A"); setNPhone(""); setNEmail("");
    setNBookId(""); setNBookSearch(""); setNDueDate(addDays(today(), 14));
    setNAnoLetivo(currentYear()); setNError("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setNError("");
    if (!nName.trim()) { setNError("Nome do aluno é obrigatório."); return; }
    if (nBookId === "") { setNError("Selecione um livro."); return; }
    const dateError = validateDueDate(nDueDate, maxLoanDays);
    if (dateError) { setNError(dateError); return; }
    setNLoading(true);
    try {
      await invoke("create_loan", {
        anoLetivo: nAnoLetivo,
        studentName: nName.trim(),
        studentGrade: nGrade,
        studentClass: nClass,
        studentPhone: nPhone.trim() || null,
        studentEmail: nEmail.trim() || null,
        bookId: nBookId,
        dueDate: nDueDate,
      });
      setNewModal(false); resetNewForm(); loadLoans();
    } catch (err) { setNError(String(err)); }
    finally { setNLoading(false); }
  }

  async function handleReturn(id: number) {
    if (!confirm("Confirmar devolução deste livro?")) return;
    try { await invoke("return_book", { loanId: id }); loadLoans(); }
    catch (err) { alert(String(err)); }
  }

  function openRenew(l: LoanDetail) {
    setRenewLoan(l); setRenewDate(addDays(today(), Math.min(14, maxLoanDays))); setRenewError("");
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    setRenewError("");
    const dateError = validateDueDate(renewDate, maxLoanDays);
    if (dateError) { setRenewError(dateError); return; }
    setRenewLoading(true);
    try {
      await invoke("renew_loan", { loanId: renewLoan!.id, newDueDate: renewDate });
      setRenewLoan(null); loadLoans();
    } catch (err) { setRenewError(String(err)); }
    finally { setRenewLoading(false); }
  }

  const availClasses = VALID_CLASSES_BY_GRADE[nGrade] ?? ["A", "B"];
  const filteredBooks = books.filter((b) =>
    !nBookSearch || b.title.toLowerCase().includes(nBookSearch.toLowerCase()) || b.author.toLowerCase().includes(nBookSearch.toLowerCase())
  ).slice(0, 30);

  const pending = loans.filter((l) => l.status === "overdue").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Empréstimos</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {loans.length} registro{loans.length !== 1 ? "s" : ""}
            {pending > 0 && <span className="text-rose-400 font-semibold"> · {pending} em atraso</span>}
          </p>
        </div>
        <button onClick={() => { resetNewForm(); setNewModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo Empréstimo
        </button>
      </div>

      {/* Year / Status filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Ano Letivo</label>
          <select value={anoLetivo} onChange={(e) => setAnoLetivo(Number(e.target.value))} className="input !w-auto !py-1.5 text-sm">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Status pills */}
        <div className="flex gap-1 flex-wrap">
          {[
            { label: "Todos", val: null },
            { label: "Ativos", val: "active" },
            { label: "Em Atraso", val: "overdue" },
            { label: "Devolvidos", val: "returned" },
          ].map(({ label, val }) => (
            <button
              key={label}
              onClick={() => setStatusFilter(statusFilter === val ? null : val)}
              className={statusFilter === val ? "pill-active" : "pill-inactive"}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Month / Week pills */}
      <div className="space-y-2">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => { setMonthFilter(null); setWeekFilter(null); }} className={monthFilter === null ? "pill-active" : "pill-inactive"}>
            Ano todo
          </button>
          {MONTHS.map((m, i) => (
            <button key={i} onClick={() => { setMonthFilter(monthFilter === i + 1 ? null : i + 1); setWeekFilter(null); }} className={monthFilter === i + 1 ? "pill-active" : "pill-inactive"}>
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
        {monthFilter && (
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setWeekFilter(null)} className={weekFilter === null ? "pill-active" : "pill-inactive"}>Mês todo</button>
            {WEEKS.map((w, i) => (
              <button key={i} onClick={() => setWeekFilter(weekFilter === i + 1 ? null : i + 1)} className={weekFilter === i + 1 ? "pill-active" : "pill-inactive"}>
                {w}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input className="input pl-9" placeholder="Buscar aluno ou livro..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="glass overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="th">Aluno</th>
              <th className="th">Série / Turma</th>
              <th className="th">Livro</th>
              <th className="th">Empréstimo</th>
              <th className="th">Devolução</th>
              <th className="th">Status</th>
              <th className="th">Multa</th>
              <th className="th">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id} className="tr">
                <td className="td">
                  <p className="font-medium text-slate-200">{l.student_name}</p>
                  {l.student_phone && <p className="text-xs text-slate-500">{l.student_phone}</p>}
                </td>
                <td className="td text-slate-400">{l.student_grade}° Ano {l.student_class}</td>
                <td className="td">
                  <p className="text-slate-300">{l.book_title}</p>
                  <p className="text-xs text-slate-500">{l.book_author}</p>
                </td>
                <td className="td text-slate-400">{l.loan_date}</td>
                <td className="td text-slate-400">{l.due_date}</td>
                <td className="td"><StatusBadge status={l.status} renewed={l.renewed} /></td>
                <td className="td">
                  {l.has_fine ? (
                    l.fine_paid
                      ? <span className="badge-active text-xs">Paga</span>
                      : <span className="badge-fine text-xs animate-pulse">Pendente</span>
                  ) : "—"}
                </td>
                <td className="td">
                  <div className="flex gap-1">
                    {l.status !== "returned" && (
                      <>
                        <button onClick={() => openRenew(l)} title="Renovar" className="btn-ghost p-1.5 text-blue-400 hover:bg-blue-500/10">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleReturn(l.id)} title="Registrar devolução" className="btn-ghost p-1.5 text-emerald-400 hover:bg-emerald-500/10">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {loans.length === 0 && (
              <tr><td colSpan={8} className="td text-center text-slate-600 py-12">
                <BookCopy className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Nenhum empréstimo encontrado para os filtros selecionados.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── New Loan Modal ────────────────────────────────────────────────────── */}
      <Modal title="Registrar Novo Empréstimo" isOpen={newModal} onClose={() => { setNewModal(false); resetNewForm(); }} size="lg">
        <form onSubmit={handleCreate} className="space-y-5">
          {/* Ano letivo */}
          <div>
            <label className="label">Ano Letivo</label>
            <select className="input" value={nAnoLetivo} onChange={(e) => setNAnoLetivo(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700/50" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider -mt-2">Dados do Aluno</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nome do Aluno *</label>
              <input className="input" placeholder="Nome completo" value={nName} onChange={(e) => setNName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Série *</label>
              <select className="input" value={nGrade} onChange={(e) => { setNGrade(Number(e.target.value)); setNClass("A"); }}>
                {GRADES.map((g) => <option key={g} value={g}>{g}° Ano</option>)}
              </select>
            </div>
            <div>
              <label className="label">Turma *</label>
              <select className="input" value={nClass} onChange={(e) => setNClass(e.target.value)}>
                {availClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" placeholder="(00) 00000-0000" value={nPhone} onChange={(e) => setNPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" placeholder="aluno@escola.edu.br" value={nEmail} onChange={(e) => setNEmail(e.target.value)} />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700/50" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider -mt-2">Livro</p>

          <div>
            <label className="label">Buscar Livro *</label>
            <input
              className="input mb-2"
              placeholder="Digite o título ou autor..."
              value={nBookSearch}
              onChange={(e) => { setNBookSearch(e.target.value); setNBookId(""); }}
            />
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-700/50 bg-slate-800/80 divide-y divide-slate-700/30">
              {filteredBooks.length === 0 && (
                <p className="text-slate-600 text-xs text-center py-4">Nenhum livro disponível.</p>
              )}
              {filteredBooks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { setNBookId(b.id); setNBookSearch(b.title); }}
                  className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-slate-700/50 ${nBookId === b.id ? "bg-violet-600/20 border-l-2 border-violet-500" : ""}`}
                >
                  <p className="text-sm text-slate-200 font-medium">{b.title}</p>
                  <p className="text-xs text-slate-500">{b.author} · {b.available_quantity > 0 ? <span className="text-emerald-400">{b.available_quantity} disponível{b.available_quantity !== 1 ? "is" : ""}</span> : <span className="text-rose-400">Indisponível</span>}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div className="border-t border-slate-700/50" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider -mt-2">Prazo de Devolução</p>
          <div className="space-y-3">
            <div>
              <label className="label">Data de Devolução *</label>
              <input className="input" type="date" min={today()} max={maxDueDate(maxLoanDays)} value={nDueDate} onChange={(e) => setNDueDate(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">Limite máximo: {maxLoanDays} dias.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNDueDate(addDays(today(), Math.min(7, maxLoanDays)))}
                className="btn-secondary text-xs"
              >
                <CalendarDays className="w-3.5 h-3.5" /> 7 dias
              </button>
              <button
                type="button"
                onClick={() => setNDueDate(addDays(today(), Math.min(14, maxLoanDays)))}
                className="btn-secondary text-xs"
              >
                <CalendarDays className="w-3.5 h-3.5" /> 14 dias
              </button>
              <button
                type="button"
                onClick={() => setNDueDate(addDays(nDueDate, -7))}
                className="btn-secondary text-xs"
              >
                <Minus className="w-3.5 h-3.5" /> Subtrair 1 semana
              </button>
            </div>
          </div>

          {nError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{nError}</div>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={nLoading} className="btn-primary flex-1 justify-center">
              {nLoading ? "Registrando..." : "Registrar Empréstimo"}
            </button>
            <button type="button" onClick={() => { setNewModal(false); resetNewForm(); }} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* ── Renew Modal ────────────────────────────────────────────────────────── */}
      <Modal title="Renovar Empréstimo" isOpen={!!renewLoan} onClose={() => setRenewLoan(null)}>
        {renewLoan && (
          <form onSubmit={handleRenew} className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
              <p className="text-sm font-semibold text-blue-300">{renewLoan.student_name}</p>
              <p className="text-xs text-slate-400">{renewLoan.student_grade}° Ano {renewLoan.student_class}</p>
              <p className="text-xs text-slate-400">Livro: <span className="text-slate-300">{renewLoan.book_title}</span></p>
              <p className="text-xs text-slate-400">Vencimento atual: <span className="text-slate-300">{renewLoan.due_date}</span></p>
              {renewLoan.renewed > 0 && <p className="text-xs text-amber-400">Já renovado {renewLoan.renewed}x</p>}
            </div>
            <div>
              <label className="label">Nova Data de Devolução</label>
              <input className="input" type="date" min={today()} max={maxDueDate(maxLoanDays)} value={renewDate} onChange={(e) => setRenewDate(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">Limite máximo: {maxLoanDays} dias.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRenewDate(addDays(today(), Math.min(7, maxLoanDays)))} className="btn-secondary text-xs">+7 dias</button>
              <button type="button" onClick={() => setRenewDate(addDays(today(), Math.min(14, maxLoanDays)))} className="btn-secondary text-xs">+14 dias</button>
            </div>
            {renewError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{renewError}</div>}
            <div className="flex gap-3">
              <button type="submit" disabled={renewLoading} className="btn-primary flex-1 justify-center">
                <RotateCcw className="w-4 h-4" /> Confirmar Renovação
              </button>
              <button type="button" onClick={() => setRenewLoan(null)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
