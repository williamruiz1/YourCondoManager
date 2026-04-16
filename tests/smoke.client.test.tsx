/**
 * Client-side smoke test proving React rendering works in the
 * jsdom Vitest environment (AC-7, client portion).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

function HelloWorld() {
  return <div data-testid="hello">Hello YCM</div>;
}

describe("Client: React rendering in jsdom", () => {
  it("renders a React component successfully", () => {
    render(<HelloWorld />);
    expect(screen.getByTestId("hello")).toHaveTextContent("Hello YCM");
  });
});
