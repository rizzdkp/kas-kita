"use client";

import { Plus, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Section, Specimen } from "./section";

export function ButtonsSection() {
  return (
    <Section id="tombol" title="Tombol">
      <div className="flex flex-col gap-6 rounded-card border border-border bg-surface p-4 sm:p-(--space-card)">
        <Specimen label="Varian">
          <Button variant="primary" icon={Plus}>
            Tambah akun
          </Button>
          <Button variant="secondary">Batal</Button>
          <Button variant="ghost">Cara menghitung</Button>
          <Button variant="danger" icon={Trash2}>
            Hapus transaksi
          </Button>
        </Specimen>
        <Specimen label="Nonaktif">
          <Button variant="primary" disabled>
            Simpan
          </Button>
          <Button variant="secondary" disabled>
            Batal
          </Button>
          <Button variant="ghost" disabled>
            Cara menghitung
          </Button>
        </Specimen>
        <Specimen label="Memuat">
          <Button variant="primary" loading>
            Simpan
          </Button>
          <Button variant="secondary" loading>
            Tes koneksi
          </Button>
        </Specimen>
        <Specimen label="Tombol ikon">
          <IconButton icon={Settings} label="Pengaturan" />
          <IconButton icon={Settings} label="Pengaturan" variant="secondary" />
          <IconButton icon={Settings} label="Pengaturan" disabled />
        </Specimen>
      </div>
    </Section>
  );
}
