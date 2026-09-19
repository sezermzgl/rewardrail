import { footerLinks } from "@/data/landing";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <a className="brand brand--footer" href="#top">RewardRail</a>
          <p>Programmable settlement for rewarded advertising.</p>
        </div>
        <nav aria-label="Footer navigation">
          {footerLinks.map((link) =>
            link.enabled && link.href ? (
              <a key={link.label} href={link.href}>{link.label}</a>
            ) : (
              <span key={link.label} aria-disabled="true">{link.label} <small>Soon</small></span>
            ),
          )}
        </nav>
        <p className="footer__legal">© 2026 RewardRail · Built for transparent rewards.</p>
      </div>
    </footer>
  );
}
