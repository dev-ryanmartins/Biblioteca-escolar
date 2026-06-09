import { invoke } from "../lib/invoke";
import {
  ArchiveRestore,
  BookOpen,
  CheckCircle,
  FileWarning,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Tags,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "../components/Modal";
import type { Book, BookInput, BookPreview, GenreCount, ImportResult } from "../types";

type CollectionType = "book" | "comic";

interface BookCollectionProps {
  collectionType?: CollectionType;
  title?: string;
  subtitle?: string;
}

const emptyInput = (collectionType: CollectionType): BookInput => ({
  catalog_code: null,
  title: "",
  author: "",
  quantity: 1,
  publisher: null,
  publication_year: null,
  donor_name: null,
  donation_date: null,
  genre: "",
  collection_type: collectionType,
  is_donation: false,
});

const sampleBooksCsv = [
  "Codigo;Titulo;Autor;Qtd;Editora;Ano;Doador;Data Doacao;Genero",
  "LIT-001;O Pequeno Principe;Antoine de Saint-Exupery;3;Agir;1943;;;Classico",
  "HQ-002;Turma da Monica - Lacos;Vitor Cafaggi;2;Panini;2013;;;HQ",
].join("\n");

export function BookCollection({
  collectionType = "book",
  title = "Acervo de Livros",
  subtitle = "Livros, ilustracoes e materiais textuais",
}: BookCollectionProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [trash, setTrash] = useState<Book[]>([]);
  const [genres, setGenres] = useState<GenreCount[]>([]);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [csvModal, setCsvModal] = useState(false);
  const [genreModal, setGenreModal] = useState(false);
  const [trashModal, setTrashModal] = useState(false);
  const [previews, setPreviews] = useState<BookPreview[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [form, setForm] = useState<BookInput>(emptyInput(collectionType));
  const [newGenre, setNewGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    invoke<Book[]>("list_books", {
      search: search || null,
      genre: genreFilter,
      collectionType,
      includeDeleted: false,
    }).then(setBooks).catch(console.error);
    invoke<GenreCount[]>("list_genres", { collectionType }).then(setGenres).catch(console.error);
  }, [search, genreFilter, collectionType]);

  const loadTrash = useCallback(() => {
    invoke<Book[]>("list_books", {
      search: null,
      genre: null,
      collectionType,
      includeDeleted: true,
    }).then((items) => setTrash(items.filter((b) => b.deleted_at))).catch(console.error);
  }, [collectionType]);

  useEffect(() => { load(); }, [load]);

  function setF(k: keyof BookInput, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openAdd() {
    setForm(emptyInput(collectionType));
    setFormError("");
    setAddModal(true);
  }

  function openEdit(b: Book) {
    setForm({
      catalog_code: b.catalog_code,
      title: b.title,
      author: b.author,
      quantity: b.quantity,
      publisher: b.publisher,
      publication_year: b.publication_year,
      donor_name: b.donor_name,
      donation_date: b.donation_date,
      genre: b.genre ?? "",
      collection_type: b.collection_type || collectionType,
      is_donation: b.is_donation,
    });
    setEditBook(b);
    setFormError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim() || !form.author.trim()) {
      setFormError("Titulo e autor sao obrigatorios.");
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, collection_type: collectionType };
      if (editBook) {
        await invoke("update_book", { id: editBook.id, book: payload });
        setEditBook(null);
      } else {
        await invoke("add_book", { book: payload });
        setAddModal(false);
      }
      load();
    } catch (err) {
      setFormError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, itemTitle: string) {
    if (!confirm(`Enviar "${itemTitle}" para a lixeira?`)) return;
    try {
      await invoke("delete_book", { id });
      load();
      loadTrash();
    } catch (err) {
      alert(String(err));
    }
  }

  async function handleRestore(id: number) {
    try {
      await invoke("restore_book", { id });
      load();
      loadTrash();
    } catch (err) {
      alert(String(err));
    }
  }

  async function handlePermanentDelete(id: number, itemTitle: string) {
    if (!confirm(`Apagar definitivamente "${itemTitle}"? Esta acao nao tem volta.`)) return;
    try {
      await invoke("permanently_delete_book", { id });
      loadTrash();
    } catch (err) {
      alert(String(err));
    }
  }

  async function handleDeleteCategory() {
    if (!genreFilter) {
      alert("Selecione uma categoria antes de excluir por categoria.");
      return;
    }
    if (!confirm(`Excluir a categoria "${genreFilter}" e enviar os itens dela para a lixeira?`)) return;
    try {
      const result = await invoke<ImportResult>("delete_books_by_genre", { genre: genreFilter, collectionType });
      const details = result.errors.length ? `\n\n${result.errors.join("\n")}` : "";
      alert(`${result.success_count} item(ns) enviados para a lixeira. Categoria removida.${details}`);
      setGenreFilter(null);
      load();
      loadTrash();
    } catch (err) {
      alert(String(err));
    }
  }

  async function handleDeleteAll() {
    if (!confirm(`Enviar todo este acervo para a lixeira? Voce ainda podera restaurar depois.`)) return;
    try {
      const result = await invoke<ImportResult>("delete_all_books", { collectionType });
      alert(`${result.success_count} item(ns) enviados para a lixeira.`);
      load();
      loadTrash();
    } catch (err) {
      alert(String(err));
    }
  }

  async function handleCreateGenre(e: React.FormEvent) {
    e.preventDefault();
    if (!newGenre.trim()) return;
    setLoading(true);
    try {
      const created = await invoke<GenreCount>("add_genre", { name: newGenre.trim(), collectionType });
      setGenres((gs) => gs.some((g) => g.genre === created.genre) ? gs : [...gs, created].sort((a, b) => a.genre.localeCompare(b.genre)));
      setForm((f) => ({ ...f, genre: created.genre }));
      setNewGenre("");
      setGenreModal(false);
      load();
    } catch (err) {
      alert(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const content = await file.text();
    try {
      const data = await invoke<BookPreview[]>("parse_books_csv", { content });
      setPreviews(data.map((p) => ({ ...p, collection_type: collectionType })));
      setImportResult(null);
    } catch (err) {
      alert(String(err));
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleConfirmImport() {
    setLoading(true);
    try {
      const result = await invoke<ImportResult>("confirm_books_import", {
        books: previews.map((p) => ({
          catalog_code: p.catalog_code,
          title: p.title,
          author: p.author,
          quantity: p.quantity,
          publisher: p.publisher,
          publication_year: p.publication_year,
          donor_name: p.donor_name,
          donation_date: p.donation_date,
          genre: p.genre,
          collection_type: collectionType,
          is_donation: Boolean(p.donor_name || p.donation_date),
        })),
      });
      setImportResult(result);
      setPreviews([]);
      load();
    } catch (err) {
      alert(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadSampleCsv() {
    const blob = new Blob([`\uFEFF${sampleBooksCsv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = collectionType === "comic" ? "exemplo_importacao_hqs.csv" : "exemplo_importacao_livros.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const BookForm = ({ onClose }: { onClose: () => void }) => (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Titulo *</label>
          <input className="input" placeholder="Titulo do item" value={form.title} onChange={(e) => setF("title", e.target.value)} autoFocus />
        </div>
        <div className="col-span-2">
          <label className="label">Autor *</label>
          <input className="input" placeholder="Autor, roteirista ou ilustrador" value={form.author} onChange={(e) => setF("author", e.target.value)} />
        </div>
        <div>
          <label className="label">Codigo de Catalogo</label>
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
          <label className="label">Ano de Publicacao</label>
          <input className="input" type="number" placeholder="ex: 2020" value={form.publication_year ?? ""} onChange={(e) => setF("publication_year", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div className="col-span-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">Categoria</label>
              <select className="input" value={form.genre} onChange={(e) => setF("genre", e.target.value)}>
                <option value="">Selecionar categoria...</option>
                {genres.map(({ genre }) => <option key={genre} value={genre}>{genre}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setGenreModal(true)} className="btn-secondary">
              <Plus className="w-4 h-4" /> Nova
            </button>
          </div>
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_donation} onChange={(e) => setF("is_donation", e.target.checked)} className="w-4 h-4 accent-violet-500" />
            <span className="text-sm text-slate-300">Este item e uma doacao</span>
          </label>
        </div>
        {form.is_donation && (
          <>
            <div>
              <label className="label">Nome do Doador</label>
              <input className="input" placeholder="Nome do doador" value={form.donor_name ?? ""} onChange={(e) => setF("donor_name", e.target.value || null)} />
            </div>
            <div>
              <label className="label">Data da Doacao</label>
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
          <h1 className="page-title">{title}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{books.length} item(ns) no acervo · {subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openAdd} className="btn-secondary"><Plus className="w-4 h-4" /> Adicionar</button>
          <button onClick={() => setGenreModal(true)} className="btn-secondary"><Tags className="w-4 h-4" /> Categoria</button>
          <button onClick={() => { loadTrash(); setTrashModal(true); }} className="btn-secondary"><ArchiveRestore className="w-4 h-4" /> Lixeira</button>
          <button onClick={() => setCsvModal(true)} className="btn-primary"><Upload className="w-4 h-4" /> Importar CSV</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9" placeholder="Buscar titulo, autor, codigo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setGenreFilter(null)} className={genreFilter === null ? "pill-active" : "pill-inactive"}>Todos</button>
          {genres.map(({ genre, count }) => (
            <button key={genre} onClick={() => setGenreFilter(genreFilter === genre ? null : genre)} className={genreFilter === genre ? "pill-active" : "pill-inactive"}>
              {genre} <span className="text-xs opacity-60">{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={handleDeleteCategory} disabled={!genreFilter} className="btn-secondary text-rose-400 disabled:opacity-40">
          <Trash2 className="w-4 h-4" /> Excluir categoria selecionada
        </button>
        <button onClick={handleDeleteAll} className="btn-secondary text-rose-400">
          <Trash2 className="w-4 h-4" /> Enviar acervo para lixeira
        </button>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="th">Titulo / Autor</th>
              <th className="th">Categoria</th>
              <th className="th">Estoque</th>
              <th className="th">Disponivel</th>
              <th className="th">Tipo</th>
              <th className="th">Acoes</th>
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
                  {b.genre && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">{b.genre}</span>}
                </td>
                <td className="td text-slate-300 font-medium">{b.quantity}</td>
                <td className="td">
                  <span className={b.available_quantity > 0 ? "badge-active" : "badge-overdue"}>
                    {b.available_quantity > 0 ? b.available_quantity : "Indisponivel"}
                  </span>
                </td>
                <td className="td">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">
                    {collectionType === "comic" ? "HQ" : "Livro"}
                  </span>
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
                Nenhum item encontrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Adicionar Item" isOpen={addModal} onClose={() => setAddModal(false)} size="lg">
        {BookForm({ onClose: () => setAddModal(false) })}
      </Modal>

      <Modal title={`Editar - ${editBook?.title ?? ""}`} isOpen={!!editBook} onClose={() => setEditBook(null)} size="lg">
        {BookForm({ onClose: () => setEditBook(null) })}
      </Modal>

      <Modal title="Nova Categoria" isOpen={genreModal} onClose={() => setGenreModal(false)}>
        <form onSubmit={handleCreateGenre} className="space-y-4">
          <div>
            <label className="label">Nome da categoria</label>
            <input className="input" placeholder="ex: Cordel, Ilustracoes, Graphic Novel" value={newGenre} onChange={(e) => setNewGenre(e.target.value)} autoFocus />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              <Plus className="w-4 h-4" /> Criar categoria
            </button>
            <button type="button" onClick={() => setGenreModal(false)} className="btn-secondary">Fechar</button>
          </div>
        </form>
      </Modal>

      <Modal title="Lixeira do Acervo" isOpen={trashModal} onClose={() => setTrashModal(false)} size="xl">
        <div className="space-y-3">
          {trash.length === 0 && <p className="text-sm text-slate-500 text-center py-8">A lixeira esta vazia.</p>}
          {trash.map((b) => (
            <div key={b.id} className="glass-sm p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 font-medium text-sm truncate">{b.title}</p>
                <p className="text-slate-500 text-xs">{b.author}{b.genre ? ` · ${b.genre}` : ""}</p>
              </div>
              <button onClick={() => handleRestore(b.id)} className="btn-secondary text-xs">
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar
              </button>
              <button onClick={() => handlePermanentDelete(b.id, b.title)} className="btn-secondary text-xs text-rose-400">
                <Trash2 className="w-3.5 h-3.5" /> Apagar
              </button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal title="Importar Acervo via CSV" isOpen={csvModal} onClose={() => { setCsvModal(false); setPreviews([]); setImportResult(null); }} size="xl">
        <div className="space-y-4">
          {!previews.length && !importResult && (
            <>
              <div className="p-4 rounded-xl bg-slate-700/40 border border-slate-600/40 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300 mb-2">Formato CSV:</p>
                <p><code className="text-violet-300">Codigo;Titulo;Autor;Qtd;Editora;Ano;Doador;Data Doacao;Genero</code></p>
                <p>Use ponto e virgula (;) entre todos os campos para evitar conflito com virgulas no nome do item.</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
              <button onClick={handleDownloadSampleCsv} className="btn-secondary w-full justify-center">Baixar CSV de exemplo</button>
              <button onClick={() => fileRef.current?.click()} disabled={loading} className="btn-primary w-full justify-center">
                <Upload className="w-4 h-4" /> Selecionar CSV
              </button>
            </>
          )}

          {previews.length > 0 && (
            <>
              <p className="text-sm text-slate-400">{previews.length} item(ns) encontrado(s). Revise as categorias antes de importar:</p>
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
                        {genres.map((g) => <option key={g.genre} value={g.genre}>{g.genre}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={handleConfirmImport} disabled={loading} className="btn-primary flex-1 justify-center">
                  <CheckCircle className="w-4 h-4" /> Confirmar Importacao
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

export default function Books() {
  return <BookCollection />;
}
