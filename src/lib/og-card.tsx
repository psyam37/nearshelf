// The designed card that chat apps, email and social sites show when a
// NearShelf link is shared (Open Graph image). Rendered by next/og, which
// supports flexbox and a subset of CSS: every element with several children
// needs display: flex.
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

const CROSS =
  "M217 172Q217 163 226 163L285 163Q294 163 294 172L294 213Q294 217 298 217L339 217Q348 217 348 226L348 285Q348 294 339 294L298 294Q294 294 294 298L294 339Q294 348 285 348L226 348Q217 348 217 339L217 298Q217 294 213 294L172 294Q163 294 163 285L163 226Q163 217 172 217L213 217Q217 217 217 213Z";
const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12392b"/><stop offset="1" stop-color="#1c543f"/></linearGradient></defs><rect width="512" height="512" rx="116" fill="url(#g)" stroke="#52a682" stroke-opacity="0.6" stroke-width="8"/><g fill="none" stroke="#fff" stroke-width="26" stroke-linejoin="round"><rect x="116.5" y="116.5" width="278" height="278" rx="78"/><path d="${CROSS}"/></g></svg>`,
)}`;

type Level = "in" | "low" | "unverified";
const BADGE: Record<Level, { label: string; bg: string; fg: string; dot: string }> = {
  in: { label: "In stock", bg: "#ecfdf5", fg: "#065f46", dot: "#10b981" },
  low: { label: "Low stock", bg: "#fffbeb", fg: "#92400e", dot: "#f59e0b" },
  unverified: { label: "Unverified", bg: "#eff2f1", fg: "#4f5955", dot: "#a6b0ac" },
};

export interface OgCardOptions {
  eyebrow: string;
  title: string;
  accent: string;
  subtitle: string;
  rows: { name: string; meta: string; level: Level }[];
  toast: { title: string; body: string };
}

export function ogCard({ eyebrow, title, accent, subtitle, rows, toast }: OgCardOptions) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "linear-gradient(135deg, #071d16 0%, #12392b 55%, #1c543f 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      {/* Soft green glow */}
      <div
        style={{
          position: "absolute",
          top: -220,
          right: -180,
          width: 760,
          height: 760,
          borderRadius: 760,
          background: "radial-gradient(circle, rgba(82,166,130,0.45) 0%, rgba(82,166,130,0) 70%)",
        }}
      />

      {/* Left: brand and message */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "64px 0 56px 72px",
          width: 600,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img src={LOGO} width={72} height={72} alt="" />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            Near<span style={{ color: "#c9d1ce" }}>Shelf</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 52,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: 3,
            color: "#84c5a6",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 14,
            fontSize: 58,
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: -2,
          }}
        >
          <span>{title}</span>
          <span style={{ color: "#b4dec8" }}>{accent}</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 26,
            lineHeight: 1.35,
            color: "#d9efe2",
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Right: a glimpse of the app */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          top: 92,
          right: 64,
          width: 440,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            borderRadius: 26,
            padding: 22,
            boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
            color: "#0e1d17",
          }}
        >
          {rows.map((row, i) => (
            <div
              key={row.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 4px",
                borderTop: i === 0 ? "none" : "1px solid #e1e6e4",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{row.name}</span>
                <span style={{ fontSize: 16, color: "#5d6a65", marginTop: 4 }}>{row.meta}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: BADGE[row.level].bg,
                  color: BADGE[row.level].fg,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 9,
                    height: 9,
                    borderRadius: 9,
                    background: BADGE[row.level].dot,
                  }}
                />
                {BADGE[row.level].label}
              </div>
            </div>
          ))}
        </div>

        {/* Push notification */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 22,
            marginLeft: -30,
            padding: "16px 20px",
            borderRadius: 22,
            background: "rgba(15,25,21,0.94)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          }}
        >
          <img src={LOGO} width={52} height={52} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#93a39c", letterSpacing: 1 }}>
              NEARSHELF · NOW
            </span>
            <span style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{toast.title}</span>
            <span style={{ fontSize: 17, color: "#d9efe2", marginTop: 2 }}>{toast.body}</span>
          </div>
        </div>
      </div>
    </div>,
    OG_SIZE,
  );
}
