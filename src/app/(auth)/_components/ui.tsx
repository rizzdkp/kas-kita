import clsx from "clsx";
import type { ButtonHTMLAttributes, ComponentPropsWithRef, ReactNode } from "react";

// primitif sementara untuk halaman auth; akan diganti komponen dari src/components/ui oleh koordinator
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]";

export function AuthCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section
      aria-labelledby="auth-title"
      className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"
    >
      <h1 id="auth-title" className="text-[28px] leading-9 font-semibold text-[var(--text-primary)]">
        {title}
      </h1>
      {description ? <div className="mt-2 text-base text-[var(--text-secondary)]">{description}</div> : null}
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        focusRing,
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-card)] px-4 text-[15px] leading-5 font-medium",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]",
        variant === "secondary" && "border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-primary)]",
        variant === "ghost" && "text-[var(--text-secondary)] underline-offset-4 hover:underline",
        className,
      )}
      {...props}
    />
  );
}

type FieldProps = ComponentPropsWithRef<"input"> & { label: string; id: string; hint?: string };

export function Field({ label, id, hint, className, ...props }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] leading-5 font-medium text-[var(--text-primary)]">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hintId}
        className={clsx(
          focusRing,
          "min-h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-base text-[var(--text-primary)]",
          "placeholder:text-[var(--text-tertiary)]",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-[var(--text-secondary)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={clsx(focusRing, "size-5 accent-[var(--accent)]")}
      />
      <label htmlFor={id} className="text-base text-[var(--text-primary)]">
        {label}
      </label>
    </div>
  );
}

// wadah tetap ada di DOM supaya pembaca layar mengumumkan pesan yang baru muncul
export function StatusMessage({ message, tone = "error" }: { message: string | null; tone?: "error" | "info" }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={clsx("min-h-5 text-sm", tone === "error" ? "text-[var(--error)]" : "text-[var(--text-secondary)]")}
    >
      {message}
    </p>
  );
}
