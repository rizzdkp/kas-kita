import { Box, Line, Poly, Shadow, Spot, project, rectY, rectZ, type IllustrationProps } from "./iso";

export function EmptyImports(props: IllustrationProps) {
  return (
    <Spot {...props} defaultLabel="Dokumen mutasi masuk ke akun">
      <Shadow at={[0, 4, 0]} rx={66} ry={22} />
      <Box at={[-46, -34, 0]} size={[42, 4, 74]} tone="paper" edge />
      <Poly tone="accent" face="l" pts={rectY(-29.8, -40, -24, 62, 68)} />
      {[52, 44, 36, 28, 20].map((z, i) => (
        <Line key={z} pts={[[-40, -29.8, z], [i % 2 ? -14 : -10, -29.8, z]]} />
      ))}
      <Box at={[2, 8, 0]} size={[48, 30, 5]} tone="me" />
      <Poly tone="me" face="r" pts={rectZ(5.1, 2, 50, 13, 18)} />
      {/* panah masuk: kepala prisma lalu batang, berdiri di atas kartu akun */}
      <Poly tone="accent" face="t" pts={[[17, 17, 30], [35, 17, 30], [35, 23, 30], [17, 23, 30]]} />
      <Poly tone="accent" face="r" pts={[[35, 17, 30], [35, 23, 30], [26, 23, 15], [26, 17, 15]]} />
      <Poly tone="accent" face="l" pts={[[17, 23, 30], [35, 23, 30], [26, 23, 15]]} />
      <Box at={[23, 17, 30]} size={[6, 6, 22]} tone="accent" />
    </Spot>
  );
}

// lonceng digambar di koordinat layar karena bentuk putar tidak bisa disusun dari balok
const BELL = "M-27 -12C-27 -36 -17 -42 -16 -54C-15 -68 15 -68 16 -54C17 -42 27 -36 27 -12A27 15.6 0 0 1 -27 -12Z";
const BELL_RIGHT = "M0 -64.5C9 -64.5 15.5 -61 16 -54C17 -42 27 -36 27 -12A27 15.6 0 0 1 0 3.6Z";

export function EmptyNotifications(props: IllustrationProps) {
  return (
    <Spot {...props} defaultLabel="Lonceng notifikasi">
      <Shadow at={[0, 0, 0]} rx={48} ry={18} />
      <circle cx={0} cy={8} r={6} className="coin-r" />
      <path d={BELL} className="coin-l" />
      <path d={BELL_RIGHT} className="coin-r" />
      <path d="M-27 -12A27 15.6 0 0 0 27 -12" className="il-edge" />
      <path d="M-9 -58C-14 -50 -17 -40 -19 -26" className="il-edge" strokeWidth={4} />
      <circle cx={0} cy={-67} r={5} className="coin-t" />
      <circle cx={24} cy={-56} r={9} className="accent-l" />
      <circle cx={22} cy={-58} r={4} className="accent-t" />
    </Spot>
  );
}

const CLOUD = [
  { cx: -20, cy: -66, r: 14 },
  { cx: 1, cy: -74, r: 19 },
  { cx: 22, cy: -66, r: 13 },
] as const;

function CloudShape({ dy, className }: { dy: number; className: string }) {
  return (
    <g className={className} transform={`translate(0 ${dy})`}>
      {CLOUD.map((c) => (
        <circle key={c.cx} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
      <rect x={-34} y={-68} width={69} height={15} rx={7.5} />
    </g>
  );
}

export function Offline(props: IllustrationProps) {
  const [sx, sy] = project([-2, 12, 26]);
  return (
    <Spot {...props} defaultLabel="Awan dengan sinyal yang terputus">
      <Shadow at={[0, 6, 0]} rx={60} ry={20} />
      <Box at={[-34, -14, 0]} size={[64, 40, 5]} tone="paper" edge />
      <Box at={[-26, 6, 5]} size={[9, 9, 12]} tone="steel" />
      <Box at={[-12, 6, 5]} size={[9, 9, 22]} tone="steel" />
      <Box at={[4, 2, 5]} size={[28, 9, 9]} tone="steel" />
      <CloudShape dy={5} className="glass-r" />
      <CloudShape dy={0} className="glass-l" />
      <line x1={sx} y1={-44} x2={sx} y2={-32} className="il-ink" strokeDasharray="3 4" />
      <line x1={sx + 6} y1={-24} x2={sx + 6} y2={sy - 6} className="il-ink" strokeDasharray="3 4" />
    </Spot>
  );
}
