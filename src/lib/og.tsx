import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

/** Shared 1200×630 social card used by the site and every system page. */
export function ogCard({ eyebrow, title, subtitle, chips = [] }: {
  eyebrow: string;
  title: string;
  subtitle: string;
  chips?: string[];
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #020617 0%, #1e1b4b 100%)",
          color: "#f1f5f9",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 28, color: "#a5b4fc", textTransform: "uppercase", letterSpacing: 4 }}>{eyebrow}</div>
            <div style={{ fontSize: 26, color: "#94a3b8" }}>System Design Explainer</div>
          </div>
          <div style={{ fontSize: 84, fontWeight: 700, marginTop: 20, lineHeight: 1.05 }}>{title}</div>
          <div style={{ fontSize: 36, color: "#cbd5e1", marginTop: 20, lineHeight: 1.3 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {chips.map((chip) => (
              <div
                key={chip}
                style={{
                  display: "flex",
                  fontSize: 24,
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: "2px solid #334155",
                  color: "#e2e8f0",
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    ogSize,
  );
}
