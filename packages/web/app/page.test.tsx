import { render, screen } from "@testing-library/react";
import Page from "./page";

test("renders the RewardRail product proposition", () => {
  render(<Page />);
  expect(
    screen.getByRole("heading", { name: /every verified action/i }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /view live demo/i })).toHaveAttribute(
    "href",
    "#live-demo",
  );
});
