import { render, screen } from "@testing-library/react";
import { Reveal } from "./reveal";

test("keeps content visible before motion initializes", () => {
  render(<Reveal><p>Always readable</p></Reveal>);
  expect(screen.getByText("Always readable").parentElement).not.toHaveStyle({
    opacity: "0",
  });
});
