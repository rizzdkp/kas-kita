import { Box, CoinStack, Disc, Spot, Line, Poly, Shadow, project, rectY, rectZ, type IllustrationProps } from "./iso";

export function EmptyAccounts(props: IllustrationProps) {
  return (
    <Spot {...props} defaultLabel="Dompet dengan kartu">
      <Shadow at={[0, 6, 0]} rx={66} ry={22} />
      <Box at={[-30, -20, 44]} size={[38, 4, 14]} tone="coin" />
      <Box at={[-40, -26, 0]} size={[58, 16, 46]} tone="me" />
      <Poly tone="me" face="r" pts={rectY(-9.8, -40, 18, 24, 46)} />
      <Disc center={[0, -9.4, 30]} r={3.6} plane="y" tone="coin" face="t" />
      <Box at={[2, 16, 0]} size={[46, 28, 3]} tone="steel" />
      <Poly tone="steel" face="r" pts={rectZ(3.1, 2, 48, 21, 26)} />
      <Poly tone="coin" face="t" pts={rectZ(3.1, 8, 18, 31, 38)} />
      <CoinStack at={[-34, 24, 0]} count={3} r={8} />
    </Spot>
  );
}

const RECEIPT_LINES = [
  [6, 26],
  [10, 22],
  [18, 26],
  [26, 20],
] as const;

export function EmptyTransactions(props: IllustrationProps) {
  return (
    <Spot {...props} defaultLabel="Tumpukan struk">
      <Shadow at={[0, 4, 0]} rx={62} ry={22} />
      <Box at={[-38, -34, 0]} size={[40, 4, 72]} tone="paper" edge />
      {[60, 52, 44, 36].map((z, i) => (
        <Line key={z} pts={[[-32, -29.8, z], [i % 2 ? -12 : -6, -29.8, z]]} />
      ))}
      <Line kind="accent-line" pts={[[-32, -29.8, 18], [-4, -29.8, 18]]} />
      <Box at={[-4, -8, 0]} size={[36, 54, 2]} tone="paper" edge />
      <Box at={[0, -6, 2]} size={[36, 54, 2]} tone="paper" edge />
      {RECEIPT_LINES.map(([y, x1], i) => (
        <Line key={i} pts={[[6, y, 4.2], [x1, y, 4.2]]} />
      ))}
      <Line kind="accent-line" pts={[[6, 38, 4.2], [28, 38, 4.2]]} />
      <CoinStack at={[-36, 26, 0]} count={2} r={8} />
    </Spot>
  );
}

const TRAY = { x0: -48, x1: 48, y0: -28, y1: 20 };

export function EmptyBudgets(props: IllustrationProps) {
  const { x0, x1, y0, y1 } = TRAY;
  const w = x1 - x0;
  const d = y1 - y0;
  return (
    <Spot {...props} defaultLabel="Wadah anggaran bersekat berisi koin">
      <Shadow at={[0, -2, 0]} rx={72} ry={26} />
      <Box at={[x0, y0, 0]} size={[w, d, 6]} tone="paper" />
      <Box at={[x0, y0, 6]} size={[w, 3, 24]} tone="paper" />
      <Box at={[x0, y0, 6]} size={[3, d, 24]} tone="paper" />
      <CoinStack at={[-31, -4, 6]} count={2} tone="me" r={8} />
      <Box at={[-17, y0 + 3, 6]} size={[3, d - 6, 18]} tone="paper" />
      <CoinStack at={[0, -4, 6]} count={4} tone="coin" r={8} />
      <Box at={[15, y0 + 3, 6]} size={[3, d - 6, 18]} tone="paper" />
      <CoinStack at={[31, -4, 6]} count={6} tone="partner" r={8} />
      <Box at={[x1 - 3, y0, 6]} size={[3, d, 24]} tone="paper" />
      <Box at={[x0, y1 - 3, 6]} size={[w, 3, 12]} tone="paper" edge />
    </Spot>
  );
}

const BARS = [
  { x: -38, h: 14 },
  { x: -18, h: 24 },
  { x: 2, h: 36 },
  { x: 22, h: 54 },
] as const;

export function EmptyInvestments(props: IllustrationProps) {
  const tip = project([30, 16, 82]);
  return (
    <Spot {...props} defaultLabel="Grafik batang yang naik">
      <Shadow at={[0, 0, -6]} rx={74} ry={26} />
      <Box at={[-46, -24, -6]} size={[90, 52, 6]} tone="ground" />
      {BARS.map((b, i) => (
        <Box key={b.x} at={[b.x, -4, 0]} size={[14, 14, b.h]} tone={i === BARS.length - 1 ? "accent" : "paper"} edge={i !== BARS.length - 1} />
      ))}
      <Line kind="accent-line" pts={[[-34, 16, 30], [-14, 16, 40], [4, 16, 38], [30, 16, 82]]} />
      <polygon points={`${tip[0] + 2},${tip[1] - 3} ${tip[0] - 9},${tip[1] - 2} ${tip[0] - 2},${tip[1] + 8}`} className="accent-l" />
      <CoinStack at={[29, 3, 54]} count={2} r={6} />
    </Spot>
  );
}
