import { invoke } from "../lib/invoke";
import { isTauriAvailable } from "../lib/invoke";
import { save } from "@tauri-apps/api/dialog";
import { writeTextFile } from "@tauri-apps/api/fs";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BarChart3, ClipboardList, Download, FileText, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { ReportData } from "../types";
import { MONTHS, STATUS_LABEL, WEEKS, currentYear, yearRange } from "../types";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`glass p-4 text-center border-t-2 ${color}`}>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function Reports() {
  const years = yearRange(6);
  const [anoLetivo, setAnoLetivo] = useState(currentYear());
  const [month, setMonth] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<ReportData>("get_report_data", { anoLetivo, month, week });
      setReport(data);
    } catch (err) { alert(String(err)); }
    finally { setLoading(false); }
  }, [anoLetivo, month, week]);

  async function exportCSV() {
    setCsvLoading(true);
    try {
      const csv = await invoke<string>("export_report_csv", { anoLetivo, month, week });
      const filename = `relatorio_${(report?.period_label ?? `ano_${anoLetivo}`).replace(/[^a-zA-Z0-9]/g, "_")}.csv`;

      if (isTauriAvailable()) {
        const filePath = await save({
          defaultPath: filename,
          filters: [{ name: "Planilha CSV", extensions: ["csv"] }],
          title: "Salvar relatório",
        });
        if (!filePath) return;
        await writeTextFile(filePath, csv);
        return;
      }

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(String(err)); }
    finally { setCsvLoading(false); }
  }

  function exportPDF() {
    if (!report) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.width;
    const ph = doc.internal.pageSize.height;

    // ── Dark header band ──────────────────────────────────────────────────────
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pw, 38, "F");

    // Violet accent line
    doc.setFillColor(139, 92, 246);
    doc.rect(0, 38, pw, 1.5, "F");

    // School name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("BIBLIOTECA ESCOLAR — ENSINO FUNDAMENTAL", pw / 2, 13, { align: "center" });

    // Period label
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(report.period_label, pw / 2, 22, { align: "center" });

    // Ano letivo badge
    doc.setFontSize(9);
    doc.setTextColor(167, 139, 250);
    doc.text(`Ano Letivo: ${report.ano_letivo}`, pw / 2, 30, { align: "center" });

    // ── Stats bar below header ────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 40, pw, 14, "F");

    const stats = [
      `Total de Empréstimos: ${report.total_loans}`,
      `Devolvidos: ${report.returned_loans}`,
      `Em Atraso: ${report.overdue_loans}`,
      `Multas Regularizadas: ${report.fines_resolved}`,
    ];
    const sw = pw / stats.length;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    stats.forEach((s, i) => {
      doc.setTextColor(148, 163, 184);
      doc.text(s, sw * i + sw / 2, 49, { align: "center" });
    });

    // ── Table ─────────────────────────────────────────────────────────────────
    autoTable(doc, {
      startY: 58,
      margin: { left: 8, right: 8 },
      head: [["ID", "Série", "Turma", "Aluno", "Telefone", "Livro", "Empréstimo", "Devolução", "Status", "Multa"]],
      body: report.loans.map((l) => [
        String(l.id),
        `${l.student_grade}° Ano`,
        l.student_class,
        l.student_name,
        l.student_phone || "—",
        l.book_title,
        l.loan_date,
        l.due_date,
        STATUS_LABEL[l.status] || l.status,
        l.has_fine ? (l.fine_paid ? "Paga" : "Pendente") : "—",
      ]),
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        lineWidth: 0,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      tableLineWidth: 0,
      // Colour status and fine cells
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index === 8) {
          const val = String(data.cell.raw);
          if (val === "Em Atraso") {
            data.cell.styles.fillColor = [255, 228, 230];
            data.cell.styles.textColor = [159, 18, 57];
            data.cell.styles.fontStyle = "bold";
          } else if (val === "Devolvido") {
            data.cell.styles.fillColor = [209, 250, 229];
            data.cell.styles.textColor = [6, 78, 59];
          } else {
            data.cell.styles.fillColor = [219, 234, 254];
            data.cell.styles.textColor = [30, 64, 175];
          }
        }
        if (data.column.index === 9) {
          const val = String(data.cell.raw);
          if (val === "Pendente") {
            data.cell.styles.fillColor = [255, 237, 213];
            data.cell.styles.textColor = [154, 52, 18];
            data.cell.styles.fontStyle = "bold";
          } else if (val === "Paga") {
            data.cell.styles.fillColor = [209, 250, 229];
            data.cell.styles.textColor = [6, 78, 59];
          }
        }
      },
    });

    // ── Footer on every page (page X of Y + timestamp) ────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(30, 41, 59);
      doc.rect(0, ph - 10, pw, 10, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${i} de ${pageCount}`, pw / 2, ph - 3.5, { align: "center" });
      doc.text(`Exportado em: ${new Date().toLocaleString("pt-BR")}`, 8, ph - 3.5);
      doc.text("Biblioteca Escolar — Sistema de Gestão", pw - 8, ph - 3.5, { align: "right" });
    }

    const filename = `relatorio_${(report.period_label).toLowerCase().replace(/[^a-z0-9]+/gi, "_")}.pdf`;
    doc.save(filename);
  }

  // Chart data
  const chartData = report
    ? {
      labels: ["Devolvidos", "Em Atraso", "Ativos"],
      datasets: [{
        data: [
          report.returned_loans,
          report.overdue_loans,
          report.total_loans - report.returned_loans - report.overdue_loans,
        ],
        backgroundColor: ["rgba(52,211,153,0.8)", "rgba(251,113,133,0.8)", "rgba(139,92,246,0.8)"],
        borderColor: ["rgba(52,211,153,1)", "rgba(251,113,133,1)", "rgba(139,92,246,1)"],
        borderWidth: 1,
      }],
    }
    : null;

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#94a3b8", font: { size: 11 } } },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Relatórios</h1>
        <p className="text-slate-500 text-sm mt-0.5">Gere relatórios filtrados por período e exporte em PDF ou Excel</p>
      </div>

      {/* Filter panel */}
      <div className="glass p-5 space-y-4">
        {/* Year row */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Ano Letivo</label>
            <select value={anoLetivo} onChange={(e) => { setAnoLetivo(Number(e.target.value)); setReport(null); }} className="input !w-auto !py-1.5 text-sm">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={loadReport} disabled={loading} className="btn-primary">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            {loading ? "Carregando..." : "Gerar Relatório"}
          </button>
        </div>

        {/* Month pills */}
        <div>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Mês</p>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => { setMonth(null); setWeek(null); setReport(null); }} className={month === null ? "pill-active" : "pill-inactive"}>
              Ano todo
            </button>
            {MONTHS.map((m, i) => (
              <button
                key={i}
                onClick={() => { setMonth(month === i + 1 ? null : i + 1); setWeek(null); setReport(null); }}
                className={month === i + 1 ? "pill-active" : "pill-inactive"}
              >
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Week pills — visible only when month is selected */}
        {month !== null && (
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Semana</p>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => { setWeek(null); setReport(null); }} className={week === null ? "pill-active" : "pill-inactive"}>
                Mês todo
              </button>
              {WEEKS.map((w, i) => (
                <button
                  key={i}
                  onClick={() => { setWeek(week === i + 1 ? null : i + 1); setReport(null); }}
                  className={week === i + 1 ? "pill-active" : "pill-inactive"}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report output */}
      {report && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total de Empréstimos" value={report.total_loans} color="border-violet-500" />
            <StatCard label="Devolvidos" value={report.returned_loans} color="border-emerald-500" />
            <StatCard label="Em Atraso" value={report.overdue_loans} color="border-rose-500" />
            <StatCard label="Multas Regularizadas" value={report.fines_resolved} color="border-amber-500" />
          </div>

          {/* Chart + exports */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {chartData && report.total_loans > 0 && (
              <div className="glass p-5">
                <p className="text-sm font-semibold text-slate-300 mb-3">Distribuição de Status</p>
                <div className="h-44">
                  <Doughnut data={chartData} options={chartOpts} />
                </div>
              </div>
            )}

            <div className={`${chartData && report.total_loans > 0 ? "xl:col-span-3" : "xl:col-span-4"} glass p-5`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-white">{report.period_label}</p>
                  <p className="text-xs text-slate-500">{report.loans.length} empréstimo{report.loans.length !== 1 ? "s" : ""} no período</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportCSV} disabled={csvLoading || report.total_loans === 0} className="btn-secondary text-xs">
                    <FileText className="w-3.5 h-3.5" />
                    {csvLoading ? "Exportando..." : "Exportar Excel (CSV)"}
                  </button>
                  <button onClick={exportPDF} disabled={report.total_loans === 0} className="btn-primary text-xs">
                    <Download className="w-3.5 h-3.5" /> Exportar PDF
                  </button>
                </div>
              </div>

              {/* Loan table preview */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="th">Aluno</th>
                      <th className="th">Série / Turma</th>
                      <th className="th">Livro</th>
                      <th className="th">Empréstimo</th>
                      <th className="th">Devolução</th>
                      <th className="th">Status</th>
                      <th className="th">Multa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.loans.slice(0, 50).map((l) => (
                      <tr key={l.id} className="tr">
                        <td className="td font-medium text-slate-200">{l.student_name}</td>
                        <td className="td text-slate-400">{l.student_grade}° Ano {l.student_class}</td>
                        <td className="td text-slate-300">{l.book_title}</td>
                        <td className="td text-slate-400">{l.loan_date}</td>
                        <td className="td text-slate-400">{l.due_date}</td>
                        <td className="td">
                          {l.status === "overdue"
                            ? <span className="badge-overdue">Em Atraso</span>
                            : l.status === "returned"
                              ? <span className="badge-returned">Devolvido</span>
                              : <span className="badge-active">Ativo</span>}
                        </td>
                        <td className="td">
                          {l.has_fine
                            ? l.fine_paid
                              ? <span className="badge-active text-xs">Paga</span>
                              : <span className="badge-fine text-xs">Pendente</span>
                            : <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                    {report.loans.length === 0 && (
                      <tr><td colSpan={7} className="td text-center text-slate-600 py-8">
                        <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        Nenhum empréstimo no período selecionado.
                      </td></tr>
                    )}
                  </tbody>
                </table>
                {report.loans.length > 50 && (
                  <p className="text-xs text-slate-600 text-center mt-3">
                    Mostrando 50 de {report.loans.length} registros. Exporte o relatório para ver todos.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="glass p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-500 text-sm">Selecione um período e clique em <span className="text-violet-400 font-medium">Gerar Relatório</span> para visualizar os dados.</p>
        </div>
      )}
    </div>
  );
}
