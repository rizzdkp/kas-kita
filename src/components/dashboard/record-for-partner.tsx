"use client";

import { focusQuickAdd } from "@/components/glass/quick-add-bar";
import { Button } from "@/components/ui/button";

/** Aksi state kosong "Partner belum mencatat": fokus ke bar quick-add yang sudah dalam cakupan Partner. */
export function RecordForPartnerButton({ name }: { name: string }) {
  return (
    <Button variant="primary" onClick={() => focusQuickAdd()}>
      Catat untuk {name}
    </Button>
  );
}
