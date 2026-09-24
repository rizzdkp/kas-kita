import { Button } from "@/components/ui/button";

type StepActionsProps = {
  onSkip: () => void;
  isLast: boolean;
  busy: boolean;
  nextDisabled?: boolean;
  /** Tombol Lanjut mengirim form ini; tanpa form tombol memanggil onNext. */
  form?: string;
  onNext?: () => void;
};

export function StepActions({ onSkip, isLast, busy, nextDisabled, form, onNext }: StepActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
      <Button variant="ghost" onClick={onSkip} disabled={busy}>
        Lewati
      </Button>
      <Button variant="primary" type={form ? "submit" : "button"} form={form} onClick={onNext} loading={busy} disabled={nextDisabled}>
        {isLast ? "Selesai" : "Lanjut"}
      </Button>
    </div>
  );
}
