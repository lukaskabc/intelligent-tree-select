import "@testing-library/jest-dom";
import {cleanup} from "@testing-library/react";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  jest.useRealTimers();
});

Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  value: 100,
});

Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
  configurable: true,
  value: 200,
});
