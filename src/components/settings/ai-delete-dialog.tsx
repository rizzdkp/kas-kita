"use client";

import { useState } from "react";
import { deleteAiSettingsAction } from "@/server/actions/ai-settings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSave } from "./use-save";

/** Matikan AI sepenuhnya (SECURITY 5) setelah konfirmasi. */
export function AiDeleteButton({ version, onDeleted }: { version: number; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const { pending, save } = useSave();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Hapus pengaturan AI
      </Button>
      <DialogContent
        title="Hapus pengaturan AI?"
        description="Base URL, API key, dan pilihan model dihapus untuk kalian berdua. Kas Kita berhenti mengirim data ke penyedia AI, dan pencatatan tetap jalan tanpa AI."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              Batal
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                save(() => deleteAiSettingsAction({ version }), {
                  successTitle: "Pengaturan AI dihapus",
                  onSuccess: () => {
                    setOpen(false);
                    onDeleted();
                  },
                })
              }
            >
              Hapus pengaturan AI
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
