import { invoke } from "../lib/invoke";
import { CheckCircle, FileWarning, Plus, Search, Trash2, Upload, Users, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "../components/Modal";
import type { ImportResult, Student } from "../types";
import { VALID_CLASSES_BY_GRADE } from "../types";

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [importModal, setImportModal] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // new student form
  const [newName, setNewName] = useState("");
  const [newGrade, setNewGrade] = useState<number>(1);
  const [newClass, setNewClass] = useState("A");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(() => {
    invoke<Student[]>("list_students", {
      search: search || null,
      grade: gradeFilter,
      class: null,
    }).then(setStudents).catch(console.error);
  }, [search, gradeFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const content = await file.text();
    try {
      const result = await invoke<ImportResult>("import_students_csv", { content });
      setImportResult(result);
      load();
    } catch (err) {
      alert(String(err));
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!newName.trim()) { setFormError("Nome é obrigatório."); return; }
    setLoading(true);
    try {
      await invoke("import_students_csv", {
        content: `Nome,Série,Turma,Telefone,E-mail\n${newName.trim()},${newGrade},${newClass},${newPhone},${newEmail}`,
      });
      load();
      setAddModal(false); setNewName(""); setNewGrade(1); setNewClass("A"); setNewPhone(""); setNewEmail("");
    } catch (err) { setFormError(String(err)); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Excluir o aluno "${name}"?`)) return;
    try { await invoke("delete_student", { id }); load(); }
    catch (err) { alert(String(err)); }
  }

  const availClasses = VALID_CLASSES_BY_GRADE[newGrade] ?? ["A", "B"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Alunos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{students.length} aluno{students.length !== 1 ? "s" : ""} cadastrado{students.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAddModal(true)} className="btn-secondary">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
          <button onClick={() => setImportModal(true)} className="btn-primary">
            <Upload className="w-4 h-4" /> Importar CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9" placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setGradeFilter(null)} className={gradeFilter === null ? "pill-active" : "pill-inactive"}>Todos</button>
          {GRADES.map((g) => (
            <button key={g} onClick={() => setGradeFilter(gradeFilter === g ? null : g)} className={gradeFilter === g ? "pill-active" : "pill-inactive"}>
              {g}° Ano
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="th">Aluno</th>
              <th className="th">Série</th>
              <th className="th">Turma</th>
              <th className="th">Telefone</th>
              <th className="th">E-mail</th>
              <th className="th">Ações</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="tr">
                <td className="td font-medium text-slate-200">{s.name}</td>
                <td className="td text-slate-400">{s.grade}° Ano</td>
                <td className="td">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/20">
                    Turma {s.class}
                  </span>
                </td>
                <td className="td text-slate-400">{s.phone || "—"}</td>
                <td className="td text-slate-400">{s.email || "—"}</td>
                <td className="td">
                  <button onClick={() => handleDelete(s.id, s.name)} className="btn-ghost text-rose-500 hover:bg-rose-500/10 p-1.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={6} className="td text-center text-slate-600 py-12">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Nenhum aluno encontrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CSV import modal */}
      <Modal title="Importar Alunos via CSV" isOpen={importModal} onClose={() => { setImportModal(false); setImportResult(null); }}>
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-700/40 border border-slate-600/40 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300 mb-2">Formato do CSV:</p>
            <p><code className="text-violet-300">Nome, Série, Turma, Telefone (opt), E-mail (opt)</code></p>
            <p>Séries: 1 a 9 | Turmas: A e B (3° Ano aceita A, B ou C)</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={loading} className="btn-primary w-full justify-center">
            <Upload className="w-4 h-4" /> {loading ? "Importando..." : "Selecionar Arquivo CSV"}
          </button>
          {importResult && (
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-emerald-400 font-bold text-lg">{importResult.success_count}</p>
                  <p className="text-emerald-500 text-xs">Importados</p>
                </div>
                <div className="flex-1 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <XCircle className="w-5 h-5 text-rose-400 mx-auto mb-1" />
                  <p className="text-rose-400 font-bold text-lg">{importResult.error_count}</p>
                  <p className="text-rose-500 text-xs">Erros</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="flex gap-2 items-start text-xs text-rose-400">
                      <FileWarning className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Add modal */}
      <Modal title="Adicionar Aluno" isOpen={addModal} onClose={() => setAddModal(false)}>
        <form onSubmit={handleAddStudent} className="space-y-4">
          <div>
            <label className="label">Nome Completo</label>
            <input className="input" placeholder="Nome do aluno" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Série</label>
              <select className="input" value={newGrade} onChange={(e) => { setNewGrade(Number(e.target.value)); setNewClass("A"); }}>
                {GRADES.map((g) => <option key={g} value={g}>{g}° Ano</option>)}
              </select>
            </div>
            <div>
              <label className="label">Turma</label>
              <select className="input" value={newClass} onChange={(e) => setNewClass(e.target.value)}>
                {availClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Telefone (opcional)</label>
            <input className="input" placeholder="(00) 00000-0000" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">E-mail (opcional)</label>
            <input className="input" type="email" placeholder="aluno@escola.edu.br" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          {formError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{formError}</div>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">Salvar</button>
            <button type="button" onClick={() => setAddModal(false)} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
