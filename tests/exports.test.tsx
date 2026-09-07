import React from "react";
import {render} from "@testing-library/react";
import TreeSelect, {IntelligentTreeSelect, ToggleMinusIcon, TogglePlusIcon, VirtualizedTreeSelect} from "../src";

describe("public exports", () => {
  it("keeps the default and named component exports identical", () => {
    expect(TreeSelect).toBe(IntelligentTreeSelect);
    expect(VirtualizedTreeSelect).toBeDefined();
  });

  it("keeps both toggle icons renderable", () => {
    const {container, rerender} = render(<TogglePlusIcon aria-label="expand" />);
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 24 24");

    rerender(<ToggleMinusIcon aria-label="collapse" />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "16");
  });
});
