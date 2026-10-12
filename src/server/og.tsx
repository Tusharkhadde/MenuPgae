import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

const ACCENTS: Record<string, { bg: string; fg: string; accent: string; muted: string }> = {
  classic: { bg: "#fbf7f0", fg: "#1c1917", accent: "#9a3412", muted: "#78716c" },
  midnight: { bg: "#0f0f12", fg: "#f5f5f4", accent: "#e8b04b", muted: "#a8a29e" },
  fresh: { bg: "#f6fbf6", fg: "#14281a", accent: "#15803d", muted: "#5b6f60" },
  street: { bg: "#fffbeb", fg: "#111111", accent: "#dc2626", muted: "#57534e" },
};

export function menuOgImage(opts: { name: string; subtitle?: string | null; theme?: string; showBrand: boolean }) {
  const c = ACCENTS[opts.theme ?? "classic"] ?? ACCENTS.classic;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: c.bg, padding: 72, color: c.fg }}>
        <div style={{ display: "flex", width: 120, height: 12, borderRadius: 6, background: c.accent }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>{opts.name.slice(0, 60)}</div>
          {opts.subtitle && <div style={{ fontSize: 38, marginTop: 20, color: c.muted, maxWidth: 1000 }}>{opts.subtitle.slice(0, 90)}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30 }}>
          <div style={{ display: "flex", gap: 16, color: c.accent, fontWeight: 600 }}>Menu · Hours · Location · Order on WhatsApp</div>
          {opts.showBrand && <div style={{ display: "flex", color: c.muted }}>MenuPage</div>}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

export function brandOgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "#fdfaf6", padding: 80, color: "#1c1917" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 44, fontWeight: 800 }}>M</div>
          <div style={{ fontSize: 48, fontWeight: 700 }}>MenuPage</div>
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, marginTop: 48, letterSpacing: -2, lineHeight: 1.05, maxWidth: 1000 }}>
          Your menu and website, one QR code away.
        </div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 28, color: "#78716c" }}>QR menus · WhatsApp ordering · Table QR codes · Analytics</div>
      </div>
    ),
    OG_SIZE,
  );
}
