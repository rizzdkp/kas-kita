"use client";

import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { Section, Specimen } from "./section";

export function OverlaySection() {
  const { show } = useToast();
  return (
    <Section id="lapisan" title="Lapisan sementara">
      <div className="flex flex-col gap-6 rounded-card border border-border bg-surface p-4 sm:p-(--space-card)">
        <Specimen label="Dialog dan sheet (glass regular di atas scrim)">
          <Dialog>
            <DialogTrigger className={buttonClassName("danger")}>Hapus transaksi</DialogTrigger>
            <DialogContent
              title="Hapus transaksi ini?"
              description="Transaksi masuk ke Baru dihapus dan bisa dipulihkan selama 30 hari."
              footer={
                <>
                  <DialogClose className={buttonClassName("secondary")}>Batal</DialogClose>
                  <DialogClose
                    className={buttonClassName("danger")}
                    onClick={() =>
                      show({ title: "Contoh: transaksi dihapus", action: { label: "Urungkan", onAction: () => undefined } })
                    }
                  >
                    Hapus transaksi
                  </DialogClose>
                </>
              }
            />
          </Dialog>
          <Sheet>
            <SheetTrigger className={buttonClassName("secondary")}>Buka sheet</SheetTrigger>
            <SheetContent title="Contoh sheet" description="Muncul dari tombol pemicunya.">
              <p className="text-body text-primary">Isi sheet. Konten di belakangnya diredupkan scrim solid.</p>
            </SheetContent>
          </Sheet>
        </Specimen>
        <Specimen label="Toast">
          <Button onClick={() => show({ title: "Tersimpan", action: { label: "Urungkan", onAction: () => undefined } })}>
            Tampilkan toast
          </Button>
          <Button
            variant="ghost"
            onClick={() => show({ title: "Tersimpan. Contoh Partner akan melihat perubahan ini di riwayat." })}
          >
            Toast data partner
          </Button>
        </Specimen>
        <Specimen label="Menu, popover, tooltip">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton icon={Ellipsis} label="Aksi transaksi" variant="secondary" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem icon={Pencil}>Ubah</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={Trash2} tone="danger">
                Hapus transaksi
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger className={buttonClassName("ghost")}>Cara menghitung</PopoverTrigger>
            <PopoverContent align="start">
              <p className="text-control text-primary">Contoh isi popover.</p>
            </PopoverContent>
          </Popover>
          <Tooltip content="Contoh tooltip">
            <span tabIndex={0} className="rounded-xs text-small text-secondary underline decoration-dotted">
              Arahkan ke sini
            </span>
          </Tooltip>
        </Specimen>
      </div>
    </Section>
  );
}
