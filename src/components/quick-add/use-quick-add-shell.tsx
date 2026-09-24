"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { AppShellProps } from "@/components/shell/app-shell";
import { useToast, type ToastOptions } from "@/components/ui/toast";
import type { PartyColors } from "./preview-card";
import { PreviewStack } from "./preview-stack";
import { ReceiptDialog } from "./receipt-dialog";
import type { QuickAddContextData } from "./types";
import { useQuickAdd } from "./use-quick-add";

type ToastApi = ReturnType<typeof useToast>;

// ToastProvider ada di dalam AppShell; jembatan ini dirender di slot supaya pemilik state di luar shell bisa memanggil toast
function ToastBridge({ apiRef }: { apiRef: RefObject<ToastApi | null> }) {
  const api = useToast();
  useEffect(() => {
    apiRef.current = api;
  }, [api, apiRef]);
  return null;
}

type QuickAddShellProps = Pick<
  AppShellProps,
  | "onQuickAddSubmit"
  | "onReceiptClick"
  | "quickAddSlot"
  | "quickAddBusy"
  | "quickAddValue"
  | "onQuickAddValueChange"
  | "onQuickAddEscape"
>;

/** Semua perilaku quick-add F-IN-2 dalam bentuk props AppShell. */
export function useQuickAddShell(ctx: QuickAddContextData, colors: PartyColors): QuickAddShellProps {
  const toastRef = useRef<ToastApi | null>(null);
  const showToast = useCallback((options: ToastOptions) => {
    toastRef.current?.show(options);
  }, []);
  const qa = useQuickAdd(ctx, showToast);
  const [receiptOpen, setReceiptOpen] = useState(false);

  return {
    quickAddValue: qa.text,
    onQuickAddValueChange: qa.setText,
    onQuickAddSubmit: (text, scope) => void qa.submit(text, scope),
    onQuickAddEscape: qa.items ? qa.dismiss : undefined,
    quickAddBusy: qa.busy,
    onReceiptClick: () => setReceiptOpen(true),
    quickAddSlot: (
      <>
        <ToastBridge apiRef={toastRef} />
        <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} />
        {qa.items ? (
          <PreviewStack
            items={qa.items}
            ctx={ctx}
            colors={colors}
            now={qa.now}
            saving={qa.saving}
            error={qa.error}
            onChange={qa.change}
            onRemove={qa.remove}
            onSave={() => void qa.save()}
            onCancel={qa.cancel}
          />
        ) : null}
      </>
    ),
  };
}
