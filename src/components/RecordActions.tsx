import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type RecordField = {
  key: string;
  label: string;
  type?: "date" | "number" | "text";
  options?: string[];
};

export function RecordActions({
  title,
  initial,
  fields,
  onSave,
  onDelete,
}: {
  title: string;
  initial: Record<string, string>;
  fields: RecordField[];
  onSave: (values: Record<string, string>) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onSave(values);
      toast.success(`${title} updated.`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete this ${title.toLowerCase()}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await onDelete();
      toast.success(`${title} deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon" title={`Edit ${title}`} aria-label={`Edit ${title}`} onClick={() => { setValues(initial); setOpen(true); }}>
        <Pencil />
      </Button>
      <Button type="button" variant="ghost" size="icon" title={`Delete ${title}`} aria-label={`Delete ${title}`} className="text-destructive" disabled={busy} onClick={() => void remove()}>
        <Trash2 />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {fields.map((field) => (
              <label key={field.key} className="block space-y-1.5 text-sm font-medium">
                {field.label}
                {field.options ? (
                  <select
                    className="field"
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  >
                    {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <Input
                    className="text-sm"
                    type={field.type ?? "text"}
                    inputMode={field.type === "number" ? "numeric" : undefined}
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}