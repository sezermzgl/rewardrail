import { render, screen } from "@testing-library/react";
import { Reveal } from "./reveal";

test("renders its content", () => {
  render(<Reveal><p>Always readable</p></Reveal>);
  expect(screen.getByText("Always readable")).toBeInTheDocument();
});

/**
 * The reveal starts hidden, and that hidden state is rendered into the HTML.
 * The layout carries a `<noscript>` rule that resets `[data-reveal]`, so the
 * marker has to be on the element or a visitor with scripting off finds a
 * blank page where the product case should be.
 *
 * It was `initial={false}` before, which kept the page safe by never
 * animating: the `whileInView` target had nothing to animate from.
 */
test("marks itself so the no-script fallback can reach it", () => {
  const { container } = render(<Reveal><p>Always readable</p></Reveal>);
  expect(container.querySelector("[data-reveal]")).toBeInTheDocument();
});
