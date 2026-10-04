import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { finalizeStatement } from "@/lib/vouchers.functions";
import {
  blobToBase64,
  download,
  fileBase,
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

  const mutation = useMutation({
    mutationFn: async (st: Statement) => {
      const pdf = await statementPdf(st);
      return finalize({
        data: {
          kind: st.kind,
          name: st.name,
          from: st.from,
          to: st.to,
          fileName: `${fileBase(st)}.pdf`,
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
              <DialogTitle className="font-display text-[20px] font-bold">M Sulaim</DialogTitle>
              <div className="font-display text-[14px] font-semibold">{s.title}</div>
            </div>
            <div className="text-[12px] font-semibold">
              {s.kind === "client" ? "Client" : "Partner"}: {s.name}
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

            {confirming ? (
              <div className="frost rounded-2xl p-3 text-[12px] space-y-2">
                <div className="font-semibold">Finalize this statement?</div>
                <div className="text-inkmuted">
                  {s.name} · {s.from ? fmtDate(s.from) : "start"} to {s.to ? fmtDate(s.to) : "today"} ·{" "}
                  {s.rows.length} rows · total {s.grand}. The PDF will be saved to Google Drive and
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
                  onClick={async () => download(await statementPdf(s), `${fileBase(s)}.pdf`)}
                >
                  Download PDF
                </button>
                <button
                  className={`${btn} glass text-brand`}
                  onClick={() => download(statementCsv(s), `${fileBase(s)}.csv`)}
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
