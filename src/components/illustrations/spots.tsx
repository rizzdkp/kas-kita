import { Spot, type IllustrationProps, type SpotSpec } from "./spot";

// aset dipilih berbeda dari aset kepala halaman yang sama supaya satu layar tidak menampilkan gambar kembar
const SPECS = {
  accounts: { main: "bank", accent: "purse", label: "Gedung bank dan dompet koin" },
  transactions: { main: "memo", label: "Kertas catatan dan pensil" },
  budgets: { main: "envelope", accent: "coin", label: "Amplop anggaran dan koin" },
  bills: { main: "alarm-clock", accent: "receipt", label: "Jam weker dan struk tagihan" },
  billsPaid: { main: "check-mark-button", label: "Tanda centang" },
  goals: { main: "triangular-flag", accent: "coin", label: "Bendera tujuan dan koin" },
  goalReached: { main: "trophy", accent: "party-popper", label: "Piala dan konfeti" },
  investments: { main: "seedling", accent: "coin", label: "Tunas tumbuh dan koin" },
  imports: { main: "open-file-folder", accent: "page-facing-up", label: "Map berisi lembar mutasi" },
  notifications: { main: "closed-mailbox-with-lowered-flag", label: "Kotak surat tertutup" },
  offline: { main: "satellite-antenna", label: "Antena tanpa sinyal" },
} satisfies Record<string, SpotSpec>;

export const EmptyAccounts = (props: IllustrationProps) => <Spot spec={SPECS.accounts} {...props} />;
export const EmptyTransactions = (props: IllustrationProps) => <Spot spec={SPECS.transactions} {...props} />;
export const EmptyBudgets = (props: IllustrationProps) => <Spot spec={SPECS.budgets} {...props} />;
export const EmptyBills = (props: IllustrationProps) => <Spot spec={SPECS.bills} {...props} />;
export const AllBillsPaid = (props: IllustrationProps) => <Spot spec={SPECS.billsPaid} {...props} />;
export const EmptyGoals = (props: IllustrationProps) => <Spot spec={SPECS.goals} {...props} />;
export const GoalReached = (props: IllustrationProps) => <Spot spec={SPECS.goalReached} {...props} />;
export const EmptyInvestments = (props: IllustrationProps) => <Spot spec={SPECS.investments} {...props} />;
export const EmptyImports = (props: IllustrationProps) => <Spot spec={SPECS.imports} {...props} />;
export const EmptyNotifications = (props: IllustrationProps) => <Spot spec={SPECS.notifications} {...props} />;
export const Offline = (props: IllustrationProps) => <Spot spec={SPECS.offline} {...props} />;
