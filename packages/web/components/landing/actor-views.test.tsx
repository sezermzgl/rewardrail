import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActorViews } from "./actor-views";

test("switches actor context while preserving the transaction", async () => {
  const user = userEvent.setup();
  render(<ActorViews />);
  const playerTab = screen.getByRole("tab", { name: "Player" });
  await user.click(playerTab);
  expect(playerTab).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("8f3a...c921");
});

test("supports keyboard tab navigation", async () => {
  const user = userEvent.setup();
  render(<ActorViews />);
  screen.getByRole("tab", { name: "Advertiser" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Player" })).toHaveFocus();
});
