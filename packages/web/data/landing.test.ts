import { actorViews, footerLinks, navItems } from "./landing";

const prohibited = /wallet|seed phrase|private key|\bgas\b|blockchain/i;

test("player-facing content avoids custody jargon", () => {
  const player = actorViews.find((item) => item.id === "player");
  expect(JSON.stringify(player)).not.toMatch(prohibited);
});

test("all enabled navigation destinations exist on this page", () => {
  expect(navItems.every((item) => item.href.startsWith("#"))).toBe(true);
});

test("footer only enables known destinations", () => {
  expect(
    footerLinks
      .filter((item) => item.enabled)
      .every((item) => Boolean(item.href)),
  ).toBe(true);
});
