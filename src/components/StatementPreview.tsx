import { useEffect, useState } from "react";
import { BUSINESS, MONTHS } from "@/lib/brand";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { finalizeStatement } from "@/lib/vouchers.functions";
import {
  blobToBase64,
  cleanFileName,
  defaultFileName,
  download,
  statementLabel,
  statementCsv,
  statementPdf,
  type Statement,
} from "@/lib/statement";
import { fmtDate } from "@/lib/date-format";

export function StatementPreview({
  statement,
  onClose,
}: {
  statement: Statement | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const finalize = useServerFn(finalizeStatement);
  const [confirming, setConfirming] = useState(false);
  const s = statement;
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [name, setName] = useState("");
  useEffect(() => {
    if (!s) return;
    const d = new Date(s.from || s.to || Date.now());
    const m = Number.isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
    const y = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
    setMonth(m);
    setYear(y);
    setName(defaultFileName(s, m, y));
  }, [s]);
  const file = cleanFileName(name);

  const mutation = useMutation({
    mutationFn: async (st: Statement) => {
      const pdf = await statementPdf(st);
      return finalize({
        data: {
          kind: st.kind,
          name: st.name,
          from: st.from,
          to: st.to,
          fileName: `${file}.pdf`,
          pdfBase64: await blobToBase64(pdf),
          total: st.grand,
          keys: st.keys,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Statement saved to Google Drive and rows archived.", {
        action: { label: "Open", onClick: () => window.open(res.url, "_blank") },
      });
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ["board"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const btn = "px-3 py-1.5 rounded-full text-[11px] font-semibold";

  return (
    <Dialog
      open={!!s}
      onOpenChange={(o) => {
        if (!o && !mutation.isPending) {
          setConfirming(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-[760px] w-[96vw] max-h-[90vh] overflow-y-auto p-5">
        {s && (
          <>
            <div className="text-center space-y-0.5">
              <DialogTitle className="font-display text-[20px] font-bold">{BUSINESS.name}</DialogTitle>
              <div className="text-[11px] text-inkmuted">{BUSINESS.tagline} · {BUSINESS.location}</div>
              <div className="font-display text-[14px] font-semibold">{s.title}</div>
            </div>
            <div className="text-[12px] font-semibold">
              {statementLabel(s)}: {s.name}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border border-frostline/60">
                <thead>
                  <tr className="bg-brand text-primary-foreground">
                    {s.header.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-center whitespace-nowrap font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, i) => (
                    <tr key={i} className="border-t border-frostline/50">
                      {r.map((c, j) => (
                        <td key={j} className="px-2 py-1.5 text-center whitespace-nowrap">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto w-[220px] text-[12px]">
              <div className="font-bold mb-1">Subtotal</div>
              {s.subtotals.map(([p, q]) => (
                <div key={p} className="flex justify-between py-0.5">
                  <span>{p}</span>
                  <span>{q}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold py-1 mt-1 border-t border-ink border-b-[3px] border-b-ink" style={{ borderBottomStyle: "double" }}>
                <span>Grand Total</span>
                <span>{s.grand}</span>
              </div>
            </div>

            <div className="frost rounded-2xl p-3 space-y-2 text-[11px] font-semibold text-inkmuted">
              {s.kind !== "transport" && (
                <div className="flex gap-2 items-center">
                  Month
                  <select
                    className="glass rounded-xl px-2 h-8 text-ink"
                    value={month}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      setMonth(m);
                      setName(defaultFileName(s, m, year));
                    }}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="glass rounded-xl px-2 h-8 w-20 text-ink"
                    value={year}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      setYear(y);
                      setName(defaultFileName(s, month, y));
                    }}
                  />
                </div>
              )}
              <label className="block space-y-1">
                File name
                <input
                  className="glass rounded-xl px-3 h-9 w-full text-[12px] text-ink outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            </div>

            {confirming ? (
              <div className="frost rounded-2xl p-3 text-[12px] space-y-2">
                <div className="font-semibold">Finalize this statement?</div>
                <div className="text-inkmuted">
                  {s.name} · {s.from ? fmtDate(s.from) : "start"} to {s.to ? fmtDate(s.to) : "today"} ·{" "}
                  {s.rows.length} rows · total {s.grand}. Saved as “{file}.pdf”. The PDF will be saved to Google Drive and
                  these rows moved to the archive.
                </div>
                <div className="flex gap-2 justify-end">
                  <button className={`${btn} glass`} disabled={mutation.isPending} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button
                    className={`${btn} bg-brand text-primary-foreground disabled:opacity-60`}
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(s)}
                  >
                    {mutation.isPending ? "Saving…" : "Yes, finalize"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  className={`${btn} glass text-brand`}
                  onClick={async () => download(await statementPdf(s), `${file}.pdf`)}
                >
                  Download PDF
                </button>
                <button
                  className={`${btn} glass text-brand`}
                  onClick={() => download(statementCsv(s), `${file}.csv`)}
                >
                  Download CSV
                </button>
                <button
                  className={`${btn} bg-brand text-primary-foreground`}
                  onClick={() => setConfirming(true)}
                >
                  Finalize & Archive
                </button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
