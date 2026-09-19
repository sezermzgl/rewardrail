import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActorViews } from "./actor-views";

test("switches actor context and carries that actor's own transaction", async () => {
  const user = userEvent.setup();
  render(<ActorViews />);
  const playerTab = screen.getByRole("tab", { name: "Player" });
  await user.click(playerTab);
  expect(playerTab).toHaveAttribute("aria-selected", "true");

  // Each actor shows the leg of the run that belongs to it, not one shared
  // placeholder hash repeated four times.
  const proof = within(screen.getByRole("tabpanel")).getByRole("link");
  expect(proof).toHaveAttribute(
    "href",
    "https://stellar.expert/explorer/testnet/tx/3759c66a7efe2ea56b8bf82d459f966858a8a7bd60dba63de44fdb319e542fa2",
  );
});

test("offers a way into the console and the player app", () => {
  render(<ActorViews />);
  expect(screen.getByRole("link", { name: /open the live console/i })).toHaveAttribute(
    "href",
    "/demo",
  );
  expect(screen.getByRole("link", { name: /try the player app/i })).toHaveAttribute(
    "href",
    "/play",
  );
});

test("supports keyboard tab navigation", async () => {
  const user = userEvent.setup();
  render(<ActorViews />);
  screen.getByRole("tab", { name: "Advertiser" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Player" })).toHaveFocus();
});

test("shows a controlled escrow return for the operator fraud state", async () => {
  const user = userEvent.setup();
  render(<ActorViews />);
  await user.click(screen.getByRole("tab", { name: "Operator" }));
  expect(
    screen.getByLabelText(/fraudulent reward returning to campaign escrow/i),
  ).toBeInTheDocument();
});
