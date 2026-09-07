import {
  arraysAreEqual,
  getLabel,
  hashCode,
  isURL,
  monotonicAssign,
  optionListsAreEqual,
  sanitizeArray,
} from "../src/components/utils/Utils";

describe("option utilities", () => {
  it("preserves array normalization and identity semantics", () => {
    const values = ["a", "b"];
    expect(sanitizeArray(values)).toBe(values);
    expect(sanitizeArray("a")).toEqual(["a"]);
    expect(sanitizeArray(null)).toEqual([]);
    expect(arraysAreEqual(values, ["a", "b"])).toBe(true);
    expect(arraysAreEqual(values, ["b", "a"])).toBe(false);
  });

  it("compares option lists by configured value keys", () => {
    expect(optionListsAreEqual([{id: 1}], [{id: 1}], "id")).toBe(true);
    expect(optionListsAreEqual([{id: 1}], [{id: 2}], "id")).toBe(false);
    expect(optionListsAreEqual([1], [1], "id")).toBe(true);
  });

  it("retains label, URL, hash, and monotonic merge behavior", () => {
    expect(getLabel({name: "Label"}, "name")).toBe("Label");
    expect(getLabel({name: "Label"}, "name", (option) => option.name.toUpperCase())).toBe("LABEL");
    expect(isURL("https://example.com")).toBe(true);
    expect(isURL("example.com")).toBe(false);
    expect(hashCode("abc")).toBe(hashCode("abc"));
    expect(monotonicAssign({}, {a: 1, b: 2}, {a: undefined, b: 3})).toEqual({a: 1, b: 3});
  });
});
