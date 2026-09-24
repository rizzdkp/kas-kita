"use client";

import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";

type ReceiptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** F-IN-3 AC5: tombol foto struk tetap ada, tapi sebelum model vision dipasang ia mengarahkan ke pengaturan AI. */
export function ReceiptDialog({ open, onOpenChange }: ReceiptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Foto struk butuh model vision"
        description="Struk dibaca oleh model AI yang bisa membaca gambar. Pasang model vision di pengaturan AI, lalu tombol ini langsung membuka kamera. Sementara itu, ketik transaksinya di bar, misalnya kopi 25rb gopay."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Batal</Button>
            </DialogClose>
            <Link href="/pengaturan#ai" onClick={() => onOpenChange(false)} className={buttonClassName("primary")}>
              Buka pengaturan AI
            </Link>
          </>
        }
      />
    </Dialog>
  );
}
