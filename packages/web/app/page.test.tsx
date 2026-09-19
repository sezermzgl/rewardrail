import { render, screen } from "@testing-library/react";
import Page from "./page";

test("renders the RewardRail product proposition", () => {
  render(<Page />);
  expect(
    screen.getByRole("heading", { name: /every verified action/i }),
  ).toBeInTheDocument();
  expect(
    screen
      .getAllByRole("link", { name: /view live demo/i })
      .every((link) => link.getAttribute("href") === "#live-demo"),
  ).toBe(true);
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
  expect(screen.getAllByRole("link", { name: /view live demo/i })[0]).toHaveAttribute(
    "href",
    "#live-demo",
  );
});
