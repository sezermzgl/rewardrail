import { actorViews, footerLinks, navItems, routes, valuePillars } from "./landing";

const prohibited = /wallet|seed phrase|private key|\bgas\b|blockchain/i;

test("player-facing content avoids custody jargon", () => {
  const player = actorViews.find((item) => item.id === "player");
  expect(JSON.stringify(player)).not.toMatch(prohibited);
});

test("all navigation destinations exist on this page", () => {
  expect(navItems.every((item) => item.href.startsWith("#"))).toBe(true);
});

/**
 * The footer used to render three of its five entries as disabled text.
 * Nothing on it is a placeholder any more, so every entry must resolve.
 */
test("every footer link has a destination", () => {
  expect(footerLinks.length).toBeGreaterThan(0);
  for (const link of footerLinks) {
    expect(link.href).toMatch(/^(\/|https:\/\/)/);
  }
  expect(footerLinks.some((link) => link.href === routes.console)).toBe(true);
  expect(footerLinks.some((link) => link.href === routes.player)).toBe(true);
});

/**
 * Every figure on the page belongs to the recorded run in
 * docs/04-demo-rehearsal.md, so each proof has to be a real 64-character
 * transaction hash rather than the invented string this content shipped with.
 */
test("the proofs carry real testnet transactions", () => {
  const proofs = [
    ...actorViews.map((actor) => actor.proof),
    ...valuePillars.flatMap((pillar) => (pillar.proof ? [pillar.proof] : [])),
  ];

  expect(proofs.length).toBe(actorViews.length + 3);
  for (const item of proofs) {
    expect(item.url).toMatch(
      /^https:\/\/stellar\.expert\/explorer\/testnet\/tx\/[0-9a-f]{64}$/,
    );
    expect(item.short).toMatch(/^[0-9a-f]{8}…[0-9a-f]{6}$/);
  }
});

/**
 * The run reconciles: 12 in, two actions releasing 4 each, 1.20 clawed back
 * into the budget, 5.20 refunded at close. If a number on the page is edited
 * to look better, this is what catches it.
 */
test("the advertiser figures reconcile with the recorded run", () => {
  const advertiser = actorViews.find((item) => item.id === "advertiser");
  const value = (label: string) =>
    Number(advertiser?.stats.find((stat) => stat.label === label)?.value);

  const locked = value("Locked");
  const released = value("Released");
  const refunded = value("Refunded at close");
  const clawedBack = 1.2;

  expect(locked).toBe(released - clawedBack + refunded);
});
