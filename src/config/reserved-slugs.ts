/** Slugs no restaurant may claim (routes, brand, and abuse-prone words). */
export const RESERVED_SLUGS = new Set([
  "about", "account", "accounts", "admin", "administrator", "api", "app", "apps", "assets", "auth",
  "billing", "blog", "cdn", "checkout", "contact", "dashboard", "demo", "docs", "domain", "domains",
  "download", "email", "faq", "features", "help", "home", "images", "img", "legal", "login", "logout",
  "mail", "manage", "menu", "menupage", "menupages", "new", "news", "onboarding", "official", "pay",
  "payment", "payments", "portal", "pricing", "privacy", "pro", "public", "qr", "r", "register",
  "root", "security", "settings", "signin", "signout", "signup", "sitemap", "static", "status",
  "support", "system", "team", "terms", "test", "uploads", "user", "users", "webhook", "webhooks",
  "www", "_next", "robots", "favicon",
]);
