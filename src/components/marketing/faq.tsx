const FAQS: { q: string; a: string }[] = [
  {
    q: "Do my customers need to install an app?",
    a: "No. Guests scan the QR code with their phone camera and the menu opens in the browser. It's built to load quickly even on slow mobile data.",
  },
  {
    q: "How does WhatsApp ordering work?",
    a: "Guests add dishes to a cart and tap “Order on WhatsApp”. WhatsApp opens with a ready-to-send message listing the items, quantities, total and their table number (when they scanned a table QR). You confirm and take payment the way you already do — MenuPage never touches the money.",
  },
  {
    q: "Can I mark dishes as sold out?",
    a: "Yes — one tap in the dashboard and the dish shows as sold out on your menu right away. Turn it back on just as fast.",
  },
  {
    q: "Which currencies are supported?",
    a: "Rupees, dollars, euros, pounds, dirhams, Singapore dollars and more. Prices are formatted the way your guests expect.",
  },
  {
    q: "Is it really free?",
    a: "The Free plan covers one restaurant with up to 50 dishes, QR codes, WhatsApp ordering and 7-day analytics, with no time limit. Pro adds branches, a custom domain, longer analytics and removes the MenuPage badge.",
  },
  {
    q: "Do you track my customers?",
    a: "No cookies and no personal data. We count page views, QR scans and WhatsApp order taps so you can see what's working — that's it.",
  },
  {
    q: "Can I use my own domain?",
    a: "On Pro, yes. Point a domain like menu.yourcafe.com at MenuPage and your page is served there with HTTPS.",
  },
  {
    q: "Will my menu show up on Google?",
    a: "Each page includes proper titles, descriptions, structured data for restaurants and menus, a sitemap and share images, so search engines and chat apps understand it.",
  },
];

export function Faq() {
  return (
    <div className="mx-auto max-w-3xl divide-y rounded-2xl border bg-card">
      {FAQS.map((f) => (
        <details key={f.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
            {f.q}
            <span className="grid size-6 shrink-0 place-items-center rounded-full border text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
