import { Download } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const EXPORT_ALL_HREF = "/api/export/semua";

export function ExportAllLink() {
  return (
    <a href={EXPORT_ALL_HREF} download className={buttonClassName("secondary", "self-start")}>
      <Icon icon={Download} />
      Ekspor semua data
    </a>
  );
}
