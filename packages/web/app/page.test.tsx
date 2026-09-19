import { render, screen } from "@testing-library/react";
import Page from "./page";

test("renders the RewardRail product proposition", () => {
  render(<Page />);
  expect(
    screen.getByRole("heading", { name: /every verified action/i }),
  ).toBeInTheDocument();
});

test("exposes the primary product story and valid anchors", () => {
  render(<Page />);
  expect(
    screen.getByRole("navigation", { name: /primary/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", {
      name: /from completed action to settled payout/i,
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(/\$10–15 payout threshold/i)).toBeInTheDocument();
});

/**
 * The regression this test exists for: every call to action used to scroll to
 * a mock panel further down the same page, so the landing shipped without a
 * single route to the console or the player app. Both are deployed; a visitor
 * who wants the product must be able to reach it.
 */
test("every call to action reaches a surface that runs", () => {
  render(<Page />);

  const toConsole = screen
    .getAllByRole("link", { name: /console/i })
    .filter((link) => link.getAttribute("href") === "/demo");
  expect(toConsole.length).toBeGreaterThanOrEqual(3);

  const toPlayer = screen
    .getAllByRole("link", { name: /player app/i })
    .filter((link) => link.getAttribute("href") === "/play");
  expect(toPlayer.length).toBeGreaterThanOrEqual(3);
});

/**
 * The page claims an audit trail, so the transactions it shows have to be
 * transactions. They were invented strings until the recorded run replaced
 * them; this keeps them resolving somewhere real.
 */
test("the proofs on the page link to Stellar Expert", () => {
  const { container } = render(<Page />);

  const explorerLinks = [...container.querySelectorAll("a[href]")].filter((link) =>
    link.getAttribute("href")?.startsWith("https://stellar.expert/"),
  );
  expect(explorerLinks.length).toBeGreaterThan(0);
  for (const link of explorerLinks) {
    expect(link.getAttribute("href")).toMatch(
      /^https:\/\/stellar\.expert\/explorer\/testnet\/(tx|contract|account)\/[A-Za-z0-9]+$/,
    );
  }
});

test("renders the complete interactive product journey without dead links", () => {
  const { container } = render(<Page />);

  expect(screen.getByRole("heading", { name: /pay the moment value is created/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /make every dollar explain itself/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /stop paying twice for fraud/i })).toBeInTheDocument();
  expect(container.querySelector("#live-demo")).toBeInTheDocument();
  expect(container.querySelector("#security")).toBeInTheDocument();
  expect(screen.getAllByRole("tab")).toHaveLength(4);
  expect(screen.getByRole("heading", { name: /see every dollar move/i })).toBeInTheDocument();
  expect(container.querySelector('a[href=""]')).not.toBeInTheDocument();
  // "Soon" placeholders in the footer were links the page refused to make.
  expect(screen.queryByText(/soon/i)).not.toBeInTheDocument();
});
