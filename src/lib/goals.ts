// target dengan akun penampung bisa tercapai lewat saldo tanpa ada yang menandainya (F-GOAL-1 AC3)
export function goalReached(achievedAt: Date | null, progress: bigint, targetAmount: bigint): boolean {
  return achievedAt !== null || progressReachedTarget(progress, targetAmount);
}

// progres penuh tetap dihitung tercapai, jadi membatalkan tanda tidak akan memindahkannya ke aktif
export function progressReachedTarget(progress: bigint, targetAmount: bigint): boolean {
  return progress >= targetAmount;
}
