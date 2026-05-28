import { invoke } from "../lib/invoke";
import { BookOpen, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import type { FineDetail } from "../types";
import { currentYear, yearRange } from "../types";

export default function Fines() {
  const years = yearRange(5);
  const [anoLetivo, setAnoLetivo] = useState(currentYear());
  const [fines, setFines] = useState<FineDetail[]>([]);
  const [resolveModal, setResolveModal] = useState<FineDetail | null>(null);
  const [donatedTitle, setDonatedTitle] = useState("");
  const [donatedAuthor, setDonatedAuthor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    invoke<FineDetail[]>("list_fines", { anoLetivo }).then(setFines).catch(console.error);

  useEffect(() => { load(); }, [anoLetivo]);

  function openResolve(f: FineDetail) {
    setResolveModal(f); setDonatedTitle(""); setDonatedAuthor(""); setError("");
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!donatedTitle.trim()) { setError("Informe o título do livro doado."); return; }
    setLoading(true);
    try {
      await invoke("resolve_fine", {
        fineId: resolveModal!.id,
        donatedBookTitle: donatedTitle.trim(),
        donatedBookAuthor: donatedAuthor.trim(),
      });
      setResolveModal(null);
      load();
    } catch (err) { setError(String(err)); }
    finally { setLoading(false); }
  }

  const pending = fines.filter((f) => f.status === "pending");
  const resolved = fines.filter((f) => f.status === "resolved");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Multas Pedagógicas</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            <span className="text-rose-400 font-semibold">{pending.length}</span> pendente{pending.length !== 1 ? "s" : ""} ·{" "}
            <span className="text-emerald-400 font-semibold">{resolved.length}</span> regularizada{resolved.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Ano Letivo</label>
          <select value={anoLetivo} onChange={(e) => setAnoLetivo(Number(e.target.value))} className="input !w-auto !py-1.5 text-sm">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Explanation card */}
      <div className="glass-sm p-4 flex gap-3">
        <BookOpen className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-400">
          A multa pedagógica é quitada quando o aluno doa um livro ao acervo. Clique em{" "}
          <span className="text-violet-300 font-medium">"Dar Baixa na Multa"</span> para registrar a doação.
          O livro doado entra automaticamente no estoque da biblioteca.
        </p>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Pendentes</h2>
          <div className="glass overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="th">Aluno</th>
                  <th className="th">Série / Turma</th>
                  <th className="th">Livro Emprestado</th>
                  <th className="th">Vencimento</th>
                  <th className="th">Dias em Atraso</th>
                  <th className="th">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((f) => (
                  <tr key={f.id} className="tr">
                    <td className="td">
                      <p className="font-medium text-rose-300">{f.student_name}</p>
                      {f.student_phone && <p className="text-xs text-slate-500">{f.student_phone}</p>}
                    </td>
                    <td className="td text-slate-400">{f.student_grade}° Ano {f.student_class}</td>
                    <td className="td">
                      <p className="text-slate-300">{f.book_title}</p>
                      <p className="text-xs text-slate-500">{f.book_author}</p>
                    </td>
                    <td className="td">
                      <span className="badge-overdue">{f.due_date}</span>
                    </td>
                    <td className="td">
                      <span className="font-bold text-rose-400">{f.days_overdue} dia{f.days_overdue !== 1 ? "s" : ""}</span>
                    </td>
                    <td className="td">
                      <button onClick={() => openResolve(f)} className="btn-warning text-xs py-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Dar Baixa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Regularizadas</h2>
          <div className="glass overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="th">Aluno</th>
                  <th className="th">Série / Turma</th>
                  <th className="th">Livro Emprestado</th>
                  <th className="th">Livro Doado</th>
                  <th className="th">Regularizado em</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((f) => (
                  <tr key={f.id} className="tr opacity-70">
                    <td className="td font-medium text-slate-300">{f.student_name}</td>
                    <td className="td text-slate-400">{f.student_grade}° Ano {f.student_class}</td>
                    <td className="td text-slate-400">{f.book_title}</td>
                    <td className="td">
                      <p className="text-emerald-300">{f.donated_book_title}</p>
                      {f.donated_book_author && <p className="text-xs text-slate-500">{f.donated_book_author}</p>}
                    </td>
                    <td className="td">
                      <span className="badge-active">
                        <CheckCircle className="w-3 h-3" />
                        {f.resolved_at?.slice(0, 10)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fines.length === 0 && (
        <div className="glass p-10 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
          <p className="text-slate-400">Nenhuma multa registrada no ano letivo {anoLetivo}.</p>
        </div>
      )}

      {/* Resolve Modal */}
      <Modal title="Dar Baixa na Multa Pedagógica" isOpen={!!resolveModal} onClose={() => setResolveModal(null)}>
        {resolveModal && (
          <form onSubmit={handleResolve} className="space-y-5">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
              <p className="text-sm font-semibold text-amber-300">{resolveModal.student_name}</p>
              <p className="text-xs text-slate-400">{resolveModal.student_grade}° Ano {resolveModal.student_class} · {resolveModal.student_phone || "Sem telefone"}</p>
              <p className="text-xs text-slate-400 mt-1">Livro: <span className="text-slate-300">{resolveModal.book_title}</span></p>
              <p className="text-xs text-rose-400 mt-1">Atraso: {resolveModal.days_overdue} dia{resolveModal.days_overdue !== 1 ? "s" : ""}</p>
            </div>

            <div>
              <p className="text-sm text-slate-400 mb-3">
                O aluno deve <span className="text-emerald-400 font-medium">doar um livro</span> ao acervo para quitar a multa pedagógica.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="label">Título do Livro Doado *</label>
                  <input className="input" placeholder="Título do livro doado" value={donatedTitle} onChange={(e) => setDonatedTitle(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="label">Autor do Livro Doado (opcional)</label>
                  <input className="input" placeholder="Autor" value={donatedAuthor} onChange={(e) => setDonatedAuthor(e.target.value)} />
                </div>
              </div>
            </div>

            {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>}

            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="btn-success flex-1 justify-center">
                <CheckCircle className="w-4 h-4" /> Confirmar Doação e Quitar Multa
              </button>
              <button type="button" onClick={() => setResolveModal(null)} className="btn-secondary">Cancelar</button>
            </div>

            <p className="text-xs text-slate-500 text-center">O livro doado será adicionado automaticamente ao acervo da biblioteca.</p>
          </form>
        )}
      </Modal>
    </div>
  );
}
