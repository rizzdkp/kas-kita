import { NotificationsButton } from "@/components/shell/notifications-button";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";

// SEMENTARA: pratinjau untuk screenshot, dihapus sebelum laporan
export default function Page() {
  return (
    <div className="flex justify-end">
      <NotificationsButton unread={2}>
        <NotificationsPanel partnerName="Nadia" />
      </NotificationsButton>
    </div>
  );
}
