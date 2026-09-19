import { render, screen } from "@testing-library/react";
import { MoneyFlowScene } from "./money-flow-scene";

test("labels the full transaction without relying on animation", () => {
  render(<MoneyFlowScene />);
  expect(screen.getByLabelText(/campaign settlement flow/i)).toBeInTheDocument();
  expect(screen.getByText("Campaign escrow")).toBeInTheDocument();
  expect(screen.getByText("Player")).toBeInTheDocument();
  expect(screen.getByText("Publisher")).toBeInTheDocument();
  expect(screen.getByText("Platform")).toBeInTheDocument();
  expect(screen.getByText(/8f3a...c921/i)).toBeInTheDocument();
});
