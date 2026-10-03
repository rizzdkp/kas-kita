import { Box, CoinStack, Cylinder, Line, Poly, Shadow, Spot, rectY, type IllustrationProps, type P3 } from "./iso";

// kalender berdiri: muka depan di bidang y = FACE, sel 4 kolom x 3 baris
const CAL = { x0: -40, x1: 36, y0: -14, face: -4, h: 76, head: 58 };
const COLS = [-34, -17, 0, 17] as const;
const ROWS = [40, 25, 10] as const;
const CELL = 12;

function cellCheck(x: number, z: number): P3[] {
  const y = CAL.face + 0.4;
  return [
    [x + 2.5, y, z + 6],
    [x + 5, y, z + 3],
    [x + 10, y, z + 9.5],
  ];
}

function Calendar({ checked }: { checked: (col: number, row: number) => boolean }) {
  const { x0, x1, y0, face, h, head } = CAL;
  return (
    <g>
      <Shadow at={[2, 4, 0]} rx={58} ry={20} />
      <Box at={[x0, y0, 0]} size={[x1 - x0, face - y0, head]} tone="paper" />
      <Box at={[x0, y0, head]} size={[x1 - x0, face - y0, h - head]} tone="accent" />
      <Cylinder at={[-22, -9, h]} r={2.6} h={7} tone="steel" />
      <Cylinder at={[18, -9, h]} r={2.6} h={7} tone="steel" />
      {ROWS.map((z, row) =>
        COLS.map((x, col) => (
          <g key={`${row}-${col}`}>
            <Poly tone="paper" face="r" pts={rectY(face + 0.2, x, x + CELL, z, z + CELL - 2)} />
            {checked(col, row) ? <Line kind="check" pts={cellCheck(x, z)} /> : null}
          </g>
        )),
      )}
    </g>
  );
}

export function EmptyBills(props: IllustrationProps) {
  return (
    <Spot {...props} defaultLabel="Kalender tagihan dengan tanda centang">
      <Calendar checked={(col, row) => row === 0 && col < 2} />
      <Poly tone="accent" face="l" pts={rectY(CAL.face + 0.4, COLS[2], COLS[2] + CELL, ROWS[1], ROWS[1] + CELL - 2)} />
      <CoinStack at={[22, 20, 0]} count={3} r={8} />
    </Spot>
  );
}

export function AllBillsPaid(props: IllustrationProps) {
  return (
    <Spot {...props} defaultLabel="Kalender tagihan yang semua tanggalnya sudah dicentang">
      <Calendar checked={() => true} />
      <CoinStack at={[22, 20, 0]} count={2} r={8} />
    </Spot>
  );
}

function FlagOnCoins({ tone, coins }: { tone: "accent" | "positive"; coins: number }) {
  const top = coins * 4;
  return (
    <g>
      <Shadow at={[0, 8, 0]} rx={50} ry={18} />
      <CoinStack at={[-24, 18, 0]} count={2} r={9} tone="partner" />
      <CoinStack at={[0, 0, 0]} count={coins} r={13} />
      <Box at={[-1.2, -1.2, top]} size={[2.4, 2.4, 52]} tone="steel" />
      <Poly
        tone={tone}
        face="l"
        pts={[
          [1.2, 0, top + 50],
          [34, 0, top + 43],
          [1.2, 0, top + 34],
        ]}
      />
      <Poly
        tone={tone}
        face="r"
        pts={[
          [1.2, 0, top + 34],
          [34, 0, top + 43],
          [22, 0, top + 40],
        ]}
      />
      <CoinStack at={[22, 18, 0]} count={1} r={9} tone="me" />
    </g>
  );
}

export function EmptyGoals(props: IllustrationProps) {
  return (
    <Spot {...props} defaultLabel="Bendera di atas tumpukan koin">
      <FlagOnCoins tone="accent" coins={4} />
    </Spot>
  );
}

// konfeti statis: posisi layar, sudut, nada; tidak ada animasi berulang
const CONFETTI = [
  { x: -46, y: -78, a: 24, c: "me-l" },
  { x: -24, y: -92, a: -30, c: "coin-l" },
  { x: 46, y: -86, a: 50, c: "accent-l" },
  { x: 58, y: -60, a: -12, c: "partner-l" },
  { x: -58, y: -50, a: 70, c: "accent-t" },
  { x: 20, y: -98, a: 10, c: "me-t" },
] as const;

export function GoalReached(props: IllustrationProps) {
  return (
    <Spot {...props} defaultLabel="Bendera tercapai di atas tumpukan koin">
      {CONFETTI.map((p) => (
        <rect key={`${p.x}${p.y}`} x={p.x} y={p.y} width={7} height={3.5} rx={1} transform={`rotate(${p.a} ${p.x} ${p.y})`} className={p.c} />
      ))}
      <FlagOnCoins tone="positive" coins={6} />
    </Spot>
  );
}
