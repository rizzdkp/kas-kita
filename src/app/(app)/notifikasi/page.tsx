import { NotificationsPanel } from "@/components/notifications";
import { Card } from "@/components/ui/card";
import { requireViewer } from "@/server/auth/session";

// di layar kecil tombol notifikasi ada di menu akun dan membuka halaman ini
export default async function NotificationsPage() {
  const viewer = await requireViewer();
  return (
    <Card className="mx-auto max-w-2xl">
      <NotificationsPanel inPopover={false} partnerName={viewer.partner?.displayName} />
    </Card>
  );
}
