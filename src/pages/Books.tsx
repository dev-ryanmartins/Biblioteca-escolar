import { invoke } from "../lib/invoke";
import {
  BookOpen,
  CheckCircle,
  FileWarning,
  Pencil,
  Plus, Search,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "../components/Modal";
import type { Book, BookInput, BookPreview, GenreCount, ImportResult } from "../types";

const GENRES = [
  "Aventura", "Fantasia", "Ficção Científica", "Romance", "Mistério/Terror",
  "História/Biografia", "Humor", "Poesia", "Infantil/Fábula", "Educativo/Ciências", "Clássico", "Geral",
];

const emptyInput = (): BookInput => ({
  catalog_code: null, title: "", author: "", quantity: 1, publisher: null,
  publication_year: null, donor_name: null, donation_date: null, genre: "", is_donation: false,
});

export default function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [genres, setGenres] = useState<GenreCount[]>([]);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [csvModal, setCsvModal] = useState(false);
  const [previews, setPreviews] = useState<BookPreview[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [form, setForm] = useState<BookInput>(emptyInput());
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    invoke<Book[]>("list_books", { search: search || null, genre: genreFilter }).then(setBooks).catch(console.error);
    invoke<GenreCount[]>("list_genres").then(setGenres).catch(console.error);
  }, [search, genreFilter]);

  useEffect(() => { load(); }, [load]);

  function setF(k: keyof BookInput, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  function openAdd() { setForm(emptyInput()); setFormError(""); setAddModal(true); }
  function openEdit(b: Book) {
    setForm({
      catalog_code: b.catalog_code, title: b.title, author: b.author, quantity: b.quantity,
      publisher: b.publisher, publication_year: b.publication_year, donor_name: b.donor_name,
      donation_date: b.donation_date, genre: b.genre ?? "", is_donation: b.is_donation
    });
    setEditBook(b); setFormError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim() || !form.author.trim()) { setFormError("Título e autor são obrigatórios."); return; }
    setLoading(true);
    try {
      if (editBook) {
        await invoke("update_book", { id: editBook.id, book: form });
        setEditBook(null);
      } else {
        await invoke("add_book", { book: form });
        setAddModal(false);
      }
      load();
    } catch (err) { setFormError(String(err)); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: number, title: string) {
    if (!confirm(`Excluir "${title}"?`)) return;
    try { await invoke("delete_book", { id }); load(); }
    catch (err) { alert(String(err)); }
  }

  async function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true);
    const content = await file.text();
    try {
      const data = await invoke<BookPreview[]>("parse_books_csv", { content });
      setPreviews(data.map((p) => ({ ...p })));
      setImportResult(null);
    } catch (err) { alert(String(err)); }
    finally { setLoading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleConfirmImport() {
    setLoading(true);
    try {
      const result = await invoke<ImportResult>("confirm_books_import", { books: previews });
      setImportResult(result); setPreviews([]); load();
    } catch (err) { alert(String(err)); }
    finally { setLoading(false); }
  }

  const BookForm = ({ onClose }: { onClose: () => void }) => (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Título *</label>
          <input className="input" placeholder="Título do livro" value={form.title} onChange={(e) => setF("title", e.target.value)} autoFocus />
        </div>
        <div className="col-span-2">
          <label className="label">Autor *</label>
          <input className="input" placeholder="Autor" value={form.author} onChange={(e) => setF("author", e.target.value)} />
        </div>
        <div>
          <label className="label">Código de Catálogo</label>
          <input className="input" placeholder="ex: LIT-001" value={form.catalog_code ?? ""} onChange={(e) => setF("catalog_code", e.target.value || null)} />
        </div>
        <div>
          <label className="label">Quantidade</label>
          <input className="input" type="number" min={1} value={form.quantity} onChange={(e) => setF("quantity", Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Editora</label>
          <input className="input" placeholder="Editora" value={form.publisher ?? ""} onChange={(e) => setF("publisher", e.target.value || null)} />
        </div>
        <div>
          <label className="label">Ano de Publicação</label>
          <input className="input" type="number" placeholder="ex: 2020" value={form.publication_year ?? ""} onChange={(e) => setF("publication_year", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div className="col-span-2">
          <label className="label">Gênero</label>
          <select className="input" value={form.genre} onChange={(e) => setF("genre", e.target.value)}>
            <option value="">Selecionar gênero...</option>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_donation} onChange={(e) => setF("is_donation", e.target.checked)} className="w-4 h-4 accent-violet-500" />
            <span className="text-sm text-slate-300">Este livro é uma doação</span>
          </label>
        </div>
        {form.is_donation && (
          <>
            <div>
              <label className="label">Nome do Doador</label>
              <input className="input" placeholder="Nome do doador" value={form.donor_name ?? ""} onChange={(e) => setF("donor_name", e.target.value || null)} />
            </div>
            <div>
              <label className="label">Data da Doação</label>
              <input className="input" type="date" value={form.donation_date ?? ""} onChange={(e) => setF("donation_date", e.target.value || null)} />
            </div>
          </>
        )}
      </div>
      {formError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{formError}</div>}
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">Salvar</button>
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Acervo de Livros</h1>
          <p className="text-slate-500 text-sm mt-0.5">{books.length} título{books.length !== 1 ? "s" : ""} no acervo</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAdd} className="btn-secondary"><Plus className="w-4 h-4" /> Adicionar</button>
          <button onClick={() => setCsvModal(true)} className="btn-primary"><Upload className="w-4 h-4" /> Importar CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9" placeholder="Buscar título, autor, código..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setGenreFilter(null)} className={genreFilter === null ? "pill-active" : "pill-inactive"}>Todos</button>
          {genres.map(({ genre }) => (
            <button key={genre} onClick={() => setGenreFilter(genreFilter === genre ? null : genre)} className={genreFilter === genre ? "pill-active" : "pill-inactive"}>
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="th">Título / Autor</th>
              <th className="th">Gênero</th>
              <th className="th">Estoque</th>
              <th className="th">Disponível</th>
              <th className="th">Tipo</th>
              <th className="th">Ações</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id} className="tr">
                <td className="td">
                  <p className="font-medium text-slate-200">{b.title}</p>
                  <p className="text-slate-500 text-xs">{b.author}{b.catalog_code ? ` · ${b.catalog_code}` : ""}</p>
                </td>
                <td className="td">
                  {b.genre && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">{b.genre}</span>
                  )}
                </td>
                <td className="td text-slate-300 font-medium">{b.quantity}</td>
                <td className="td">
                  <span className={b.available_quantity > 0 ? "badge-active" : "badge-overdue"}>
                    {b.available_quantity > 0 ? b.available_quantity : "Indisponível"}
                  </span>
                </td>
                <td className="td">
                  {b.is_donation && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Doação</span>
                  )}
                </td>
                <td className="td">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(b)} className="btn-ghost p-1.5"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(b.id, b.title)} className="btn-ghost text-rose-500 hover:bg-rose-500/10 p-1.5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {books.length === 0 && (
              <tr><td colSpan={6} className="td text-center text-slate-600 py-12">
                <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Nenhum livro encontrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      <Modal title="Adicionar Livro" isOpen={addModal} onClose={() => setAddModal(false)} size="lg">
        <BookForm onClose={() => setAddModal(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal title={`Editar — ${editBook?.title ?? ""}`} isOpen={!!editBook} onClose={() => setEditBook(null)} size="lg">
        <BookForm onClose={() => setEditBook(null)} />
      </Modal>

      {/* CSV Import Modal */}
      <Modal title="Importar Acervo via CSV" isOpen={csvModal} onClose={() => { setCsvModal(false); setPreviews([]); setImportResult(null); }} size="xl">
        <div className="space-y-4">
          {!previews.length && !importResult && (
            <>
              <div className="p-4 rounded-xl bg-slate-700/40 border border-slate-600/40 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300 mb-2">Formato CSV:</p>
                <p><code className="text-violet-300">Código, Título, Autor, Qtd, Editora, Ano, Doador, Data Doação</code></p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
              <button onClick={() => fileRef.current?.click()} disabled={loading} className="btn-primary w-full justify-center">
                <Upload className="w-4 h-4" /> Selecionar CSV
              </button>
            </>
          )}

          {previews.length > 0 && (
            <>
              <p className="text-sm text-slate-400">{previews.length} livro(s) encontrado(s). Revise os gêneros antes de importar:</p>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {previews.map((p, i) => (
                  <div key={i} className="glass-sm p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 font-medium text-sm truncate">{p.title}</p>
                      <p className="text-slate-500 text-xs">{p.author}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Wand2 className="w-3.5 h-3.5 text-violet-400" />
                      <select
                        className="input !py-1 !px-2 text-xs !w-40"
                        value={p.genre}
                        onChange={(e) => setPreviews((ps) => ps.map((x, j) => j === i ? { ...x, genre: e.target.value } : x))}
                      >
                        {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={handleConfirmImport} disabled={loading} className="btn-primary flex-1 justify-center">
                  <CheckCircle className="w-4 h-4" /> Confirmar Importação
                </button>
                <button onClick={() => setPreviews([])} className="btn-secondary">Cancelar</button>
              </div>
            </>
          )}

          {importResult && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  <p className="text-emerald-400 font-bold text-2xl">{importResult.success_count}</p>
                  <p className="text-emerald-500 text-xs">Importados</p>
                </div>
                <div className="flex-1 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <XCircle className="w-6 h-6 text-rose-400 mx-auto mb-1" />
                  <p className="text-rose-400 font-bold text-2xl">{importResult.error_count}</p>
                  <p className="text-rose-500 text-xs">Erros</p>
                </div>
              </div>
              {importResult.errors.map((err, i) => (
                <div key={i} className="flex gap-2 items-start text-xs text-rose-400">
                  <FileWarning className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {err}
                </div>
              ))}
              <button onClick={() => { setCsvModal(false); setImportResult(null); }} className="btn-primary w-full justify-center">Fechar</button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
