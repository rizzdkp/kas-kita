import { StepActions } from "./step-actions";
import type { StepProps } from "./types";

export function AiStep({ onNext, onSkip, isLast, finishing }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-[65ch] flex-col gap-3">
        <p className="text-body text-primary">
          Pencatatan tetap jalan tanpa AI. Ketik misalnya &ldquo;kopi 25rb gopay&rdquo; di bar bawah dan Kas Kita membacanya sendiri.
        </p>
        <p className="text-body text-secondary">
          Membaca foto struk dengan AI belum tersedia di versi ini. Langkah ini dilewati dulu.
        </p>
      </div>
      <StepActions onSkip={onSkip} onNext={onNext} isLast={isLast} busy={finishing} />
    </div>
  );
}
