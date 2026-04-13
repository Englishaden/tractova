/**
 * TopoBackground — subtle SVG topographic contour lines
 *
 * On-brand: Tractova derives from Latin "tractus" (surveyed tract of land).
 * Used on Dashboard and Library to give the platform an intelligence / survey feel.
 * Absolutely positioned, pointer-events-none — does not affect layout.
 *
 * Usage: place as first child inside a `relative overflow-hidden` container.
 */
export default function TopoBackground({ opacity = 0.055, color = '#0F6E56' }) {
  // 15 organic paths across a 1440×900 viewBox.
  // Irregular vertical spacing (tight clusters = "steep terrain", wide gaps = "plateau")
  // gives the feel of real USGS elevation data rather than decorative stripes.
  const paths = [
    // ── Tight cluster near top ──────────────────────────────────────────────
    'M0,35 C120,28 240,42 360,33 C480,24 600,38 720,30 C840,22 960,36 1080,28 C1200,20 1320,34 1440,27',
    'M0,62 C130,56 250,68 380,60 C510,52 620,66 750,58 C870,50 1000,64 1120,56 C1240,48 1360,62 1440,55',
    'M0,92 C110,86 240,98 370,90 C500,82 620,96 750,88 C880,80 1000,94 1130,86 C1250,78 1380,92 1440,85',
    // ── Wide gap (plateau) ───────────────────────────────────────────────────
    'M0,148 C140,141 270,155 400,146 C530,137 660,151 790,143 C920,135 1040,149 1170,141 C1290,133 1380,147 1440,140',
    'M0,208 C120,201 250,215 380,206 C510,197 640,211 770,203 C900,195 1020,209 1150,201 C1270,193 1370,207 1440,200',
    // ── Medium cluster ───────────────────────────────────────────────────────
    'M0,262 C130,255 260,269 390,260 C520,251 650,265 780,257 C910,249 1040,263 1160,255 C1290,247 1370,261 1440,254',
    'M0,298 C110,291 240,305 370,296 C500,287 640,301 760,293 C890,285 1020,299 1150,291 C1280,283 1380,297 1440,290',
    'M0,338 C140,331 270,345 400,336 C530,327 660,341 790,333 C920,325 1040,339 1170,331 C1290,323 1380,337 1440,330',
    // ── Wide gap ─────────────────────────────────────────────────────────────
    'M0,412 C120,405 260,419 390,410 C520,401 650,415 780,407 C910,399 1040,413 1160,405 C1290,397 1380,411 1440,404',
    'M0,484 C130,477 260,491 395,482 C525,473 655,487 785,479 C915,471 1045,485 1170,477 C1300,469 1380,483 1440,476',
    // ── Tight cluster ────────────────────────────────────────────────────────
    'M0,558 C110,551 245,565 375,556 C505,547 635,561 765,553 C895,545 1025,559 1155,551 C1280,543 1375,557 1440,550',
    'M0,588 C120,581 255,595 385,586 C515,577 645,591 775,583 C905,575 1035,589 1160,581 C1290,573 1375,587 1440,580',
    'M0,620 C130,613 260,627 390,618 C520,609 650,623 780,615 C910,607 1040,621 1165,613 C1295,605 1375,619 1440,612',
    // ── Final wide pair ──────────────────────────────────────────────────────
    'M0,693 C115,686 245,700 375,691 C505,682 635,696 765,688 C895,680 1025,694 1150,686 C1280,678 1375,692 1440,685',
    'M0,778 C125,771 255,785 385,776 C515,767 645,781 775,773 C905,765 1035,779 1160,771 C1290,763 1380,777 1440,770',
  ]

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <g fill="none" stroke={color} strokeWidth="1" strokeOpacity={opacity}>
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  )
}
