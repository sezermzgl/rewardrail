import { footerLinks } from "@/data/landing";

/**
 * Every link here goes somewhere.
 *
 * Three of them used to render as disabled text with a "Soon" tag — the
 * console, the docs and the repository, all of which existed at the time. A
 * footer that hides the product is a strange thing to ship alongside it.
 */
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <a className="brand brand--footer" href="#top">RewardRail</a>
          <p>Programmable settlement for rewarded advertising.</p>
        </div>
        <nav aria-label="Footer navigation">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <p className="footer__legal">
          © 2026 RewardRail · Stellar testnet · Built for the Rise In × Stellar
          Pro Hackathon
        </p>
      </div>
    </footer>
  );
}
