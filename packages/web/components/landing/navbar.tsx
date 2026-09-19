import { ArrowUpRight, Menu } from "lucide-react";
import { navItems } from "@/data/landing";
import { ButtonLink } from "@/components/ui/button-link";

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="RewardRail home">
      <span className="brand__mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>RewardRail</span>
    </a>
  );
}

export function Navbar() {
  return (
    <header className="navbar-wrap">
      <nav className="navbar container" aria-label="Primary navigation">
        <Brand />
        <div className="navbar__links">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
        <ButtonLink href="#live-demo" className="navbar__cta">
          View live demo <ArrowUpRight size={16} aria-hidden="true" />
        </ButtonLink>
        <details className="mobile-menu">
          <summary aria-label="Open navigation menu">
            <Menu size={22} aria-hidden="true" />
          </summary>
          <div className="mobile-menu__panel">
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
            <ButtonLink href="#live-demo">View live demo</ButtonLink>
          </div>
        </details>
      </nav>
    </header>
  );
}
