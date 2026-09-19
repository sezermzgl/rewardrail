import { nextFlowPhase } from "./flow-model";

test("cycles through the complete settlement story", () => {
  expect(nextFlowPhase("funding")).toBe("verifying");
  expect(nextFlowPhase("verifying")).toBe("splitting");
  expect(nextFlowPhase("splitting")).toBe("settled");
  expect(nextFlowPhase("settled")).toBe("funding");
});
