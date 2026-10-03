import { Box, CoinStack, project, Cylinder, Disc, IsoFrame, Line, Poly, Shadow, rectX, rectY, rectZ, type IllustrationProps, type P3 } from "./iso";

// rumah: dinding x -90..20, y -100..-20, tinggi 70; atap pelana dengan bubungan sejajar sumbu x
const H = { x0: -90, x1: 20, y0: -100, y1: -20, h: 70, ridgeY: -60, ridgeZ: 112, eave: 7 };

function House() {
  const { x0, x1, y0, y1, h, ridgeY, ridgeZ, eave } = H;
  const ex0 = x0 - eave;
  const ex1 = x1 + eave;
  const front: P3[] = [
    [ex0, ridgeY, ridgeZ],
    [ex1, ridgeY, ridgeZ],
    [ex1, y1 + eave, h - 6],
    [ex0, y1 + eave, h - 6],
  ];
  return (
    <g>
      <Box at={[x0, y0, 0]} size={[x1 - x0, y1 - y0, h]} tone="paper" />
      <Poly tone="paper" face="r" pts={[[x1, y0, h], [x1, y1, h], [x1, ridgeY, ridgeZ - 4]]} />
      {/* atap belakang hanya terlihat sebagai tepi di atas bubungan */}
      <Poly tone="accent" face="r" pts={[[ex1, ridgeY, ridgeZ], [ex1, y0 - eave, h - 6], [ex1, y0 - eave, h - 10], [ex1, ridgeY, ridgeZ - 4]]} />
      <Poly tone="accent" face="t" pts={front} />
      <Poly tone="accent" face="r" pts={[[ex1, ridgeY, ridgeZ], [ex1, y1 + eave, h - 6], [ex1, y1 + eave, h - 10], [ex1, ridgeY, ridgeZ - 4]]} />
      <Poly tone="accent" face="l" pts={[[ex0, y1 + eave, h - 6], [ex1, y1 + eave, h - 6], [ex1, y1 + eave, h - 10], [ex0, y1 + eave, h - 10]]} />
      {/* cerobong di sisi depan atap */}
      <Box at={[-2, -52, 88]} size={[12, 12, 34]} tone="paper" />
      {/* pintu dan jendela di dinding kiri, jendela bulat di pelana */}
      <Poly tone="accent" face="r" pts={rectY(y1 + 0.2, -46, -26, 0, 38)} />
      <Disc center={[-29.5, y1 + 0.4, 20]} r={1.6} plane="y" tone="coin" face="t" />
      <Poly tone="glass" face="l" pts={rectY(y1 + 0.2, -80, -60, 30, 52)} />
      <Line kind="edge" pts={[[-70, y1 + 0.4, 30], [-70, y1 + 0.4, 52]]} />
      <Poly tone="glass" face="l" pts={rectY(y1 + 0.2, -12, 8, 30, 52)} />
      <Line kind="edge" pts={[[-2, y1 + 0.4, 30], [-2, y1 + 0.4, 52]]} />
      <Poly tone="glass" face="r" pts={rectX(x1 + 0.2, -88, -68, 30, 52)} />
      <Disc center={[x1 + 0.2, ridgeY, 84]} r={7} plane="x" tone="glass" face="r" />
    </g>
  );
}

function Plant() {
  const leaf = project([52, -78, 44]);
  return (
    <g>
      <Shadow at={[52, -78, 0]} rx={20} ry={8} />
      <Cylinder at={[52, -78, 0]} r={9} h={14} tone="steel" />
      <Box at={[50.5, -79.5, 14]} size={[3, 3, 20]} tone="steel" />
      <circle cx={leaf[0]} cy={leaf[1]} r={17} className="accent-l" />
      <circle cx={leaf[0] + 7} cy={leaf[1] + 6} r={11} className="accent-r" />
      <circle cx={leaf[0] - 4} cy={leaf[1] - 6} r={9} className="accent-t" />
    </g>
  );
}

function Safe() {
  const [x, y, w, d, h] = [26, 4, 44, 40, 46];
  return (
    <g>
      <Shadow at={[x + w / 2 + 6, y + d / 2 + 6, 0]} rx={52} ry={22} />
      <Box at={[x, y, 0]} size={[w, d, h]} tone="steel" />
      <Poly tone="steel" face="t" pts={rectY(y + d + 0.2, x + 5, x + w - 5, 5, h - 5)} />
      <Poly tone="steel" face="l" pts={rectY(y + d + 0.4, x + 7, x + w - 7, 7, h - 7)} />
      <Disc center={[x + w / 2, y + d + 0.6, h / 2]} r={8} plane="y" tone="coin" face="l" />
      <Disc center={[x + w / 2, y + d + 0.8, h / 2]} r={4} plane="y" tone="coin" face="r" />
      <Box at={[x + w - 14, y + d, h / 2 - 1.5]} size={[6, 3, 3]} tone="coin" />
    </g>
  );
}

function Card() {
  const [x, y, z, w, d] = [-6, 76, 0, 50, 32];
  return (
    <g>
      <Shadow at={[x + w / 2 + 3, y + d / 2 + 3, 0]} rx={40} ry={14} />
      <Box at={[x, y, z]} size={[w, d, 3]} tone="accent" />
      <Poly tone="accent" face="r" pts={rectZ(3.1, x, x + w, y + 6, y + 12)} />
      <Poly tone="coin" face="t" pts={rectZ(3.1, x + 6, x + 16, y + 18, y + 26)} />
    </g>
  );
}

/** Ilustrasi besar halaman masuk: rumah, brankas, dua tumpukan koin berwarna identitas, kartu, tanaman. */
export function HouseholdHero(props: IllustrationProps) {
  return (
    <IsoFrame {...props} viewBox="-212 -200 424 342" width={424} height={342} defaultLabel="Rumah dengan brankas, dua tumpukan koin, dan kartu">
      <Box at={[-118, -118, -12]} size={[236, 236, 12]} tone="ground" />
      <Poly tone="paper" face="t" pts={rectZ(0.2, -50, -22, -20, 60)} />
      <Shadow at={[-30, -54, 0]} rx={96} ry={30} />
      <House />
      <Plant />
      <Safe />
      <Shadow at={[-50, 44, 0]} rx={28} ry={11} />
      <CoinStack at={[-52, 40, 0]} count={6} tone="me" r={11} />
      <CoinStack at={[-24, 62, 0]} count={4} tone="partner" r={11} />
      <Card />
    </IsoFrame>
  );
}
