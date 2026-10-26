import { ean13Stripes } from "@/lib/ean13";

const MODULE = 2; // width of one stripe, in SVG units
const QUIET = 11; // blank margin each side: scanners need it to find the edges
const HEIGHT = 70;

/** An EAN-13 barcode as an SVG. Works in Server and Client Components. */
export function Ean13Barcode({ code }: { code: string }) {
  const stripes = ean13Stripes(code);
  const width = (stripes.length + QUIET * 2) * MODULE;

  // Merge neighbouring black stripes into one rectangle each.
  const bars: { x: number; w: number }[] = [];
  for (let i = 0; i < stripes.length; i++) {
    if (stripes[i] !== "1") continue;
    const last = bars.at(-1);
    if (last && last.x + last.w === i) last.w++;
    else bars.push({ x: i, w: 1 });
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT + 16}`}
      role="img"
      aria-label={`Barcode ${code}`}
      className="h-auto w-full max-w-[240px] bg-white"
    >
      {bars.map((bar) => (
        <rect
          key={bar.x}
          x={(bar.x + QUIET) * MODULE}
          y={4}
          width={bar.w * MODULE}
          height={HEIGHT}
          fill="#000"
        />
      ))}
      <text
        x={width / 2}
        y={HEIGHT + 15}
        textAnchor="middle"
        fontSize="12"
        fontFamily="monospace"
        fill="#000"
        letterSpacing="2"
      >
        {code}
      </text>
    </svg>
  );
}
