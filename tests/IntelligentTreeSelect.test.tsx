import React from "react";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {IntelligentTreeSelect} from "../src";
import type {BaseOption, FetchParams} from "../src";

interface TestOption extends BaseOption {
  id: string;
  name: string;
  children: string[];
  title?: string;
}

const options: TestOption[] = [
  {id: "root", name: "Root", children: ["child"], title: "Root title"},
  {id: "child", name: "Child", children: []},
];

const commonProps = {
  options,
  valueKey: "id",
  labelKey: "name",
  childrenKey: "children",
  titleKey: "title",
  isMenuOpen: true,
} as const;

describe("IntelligentTreeSelect behavior", () => {
  it("processes a tree and preserves the imperative API", async () => {
    const ref = React.createRef<IntelligentTreeSelect<TestOption>>();
    render(<IntelligentTreeSelect<TestOption> ref={ref} {...commonProps} />);

    await waitFor(() => expect(ref.current?.getOptions()).toHaveLength(2));
    const processed = ref.current!.getOptions();
    expect(processed).not.toBe(ref.current!.getOptions());
    expect(processed[0]).toMatchObject({id: "root", value: "root", depth: 0, parent: null});
    expect(processed[1]).toMatchObject({id: "child", value: "child", depth: 1});
    expect(processed[1].parent).toBe(processed[0]);

    expect(screen.getByText("Root").closest(".result-item")).toHaveAttribute("title", "Root title");
    expect(screen.queryByText("Child")).not.toBeInTheDocument();
    fireEvent.click(document.querySelector(".toggleButton")!);
    expect(await screen.findByText("Child")).toBeInTheDocument();

    act(() => ref.current!.focus());
    expect(screen.getByRole("combobox")).toHaveFocus();
    act(() => ref.current!.blurInput());
    expect(screen.getByRole("combobox")).not.toHaveFocus();

    act(() => ref.current!.resetOptions());
    await waitFor(() => expect(ref.current?.getOptions()).toHaveLength(2));
  });

  it("updates controlled values supplied as raw identifiers", async () => {
    const {rerender} = render(
      <IntelligentTreeSelect<TestOption, false> {...commonProps} value="child" multi={false} />
    );
    await waitFor(() => expect(document.querySelector('input[type="hidden"]')).toHaveValue("child"));

    rerender(<IntelligentTreeSelect<TestOption, false> {...commonProps} value="root" multi={false} />);
    await waitFor(() => expect(document.querySelector('input[type="hidden"]')).toHaveValue("root"));
  });

  it("flattens nested data without mutating the nested input", async () => {
    const nested = [{id: "root", name: "Root", children: [{id: "child", name: "Child", children: []}]}];
    const ref = React.createRef<IntelligentTreeSelect<TestOption>>();
    render(
      <IntelligentTreeSelect<TestOption>
        ref={ref}
        {...commonProps}
        options={nested as unknown as TestOption[]}
        simpleTreeData={false}
      />
    );

    await waitFor(() => expect(ref.current?.getOptions()).toHaveLength(2));
    expect(ref.current!.getOptions()[0].children).toEqual(["child"]);
    expect(nested[0].children[0]).toMatchObject({id: "child"});
  });

  it("keeps uncontrolled selection and callback behavior", async () => {
    const onChange = jest.fn();
    render(
      <IntelligentTreeSelect<TestOption, false>
        {...commonProps}
        multi={false}
        valueIsControlled={false}
        onChange={onChange}
      />
    );

    fireEvent.click((await screen.findByText("Root")).closest(".result-item")!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({id: "root", name: "Root"}));
    await waitFor(() => expect(document.querySelector('input[type="hidden"]')).toHaveValue("root"));
  });

  it("preserves custom matching and flat-list rendering", async () => {
    const matchCheck = jest.fn((search: string, label: string) => label.startsWith(search));
    render(<IntelligentTreeSelect<TestOption> {...commonProps} renderAsTree={false} matchCheck={matchCheck} />);

    expect(await screen.findByText("Child")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), {target: {value: "Ch"}});
    expect(matchCheck).toHaveBeenCalledWith("Ch", "Root");
    expect(screen.queryByText("Root")).not.toBeInTheDocument();
    expect(Array.from(document.querySelectorAll(".result-item"), (item) => item.textContent)).toEqual(["Child"]);
  });

  it("loads options asynchronously with the documented request and cache shape", async () => {
    const fetchOptions = jest.fn(async (_params: FetchParams<TestOption>) => options);
    const ref = React.createRef<IntelligentTreeSelect<TestOption>>();
    window.localStorage.setItem("cached-tree", JSON.stringify({validTo: Date.now() + 60_000, data: []}));
    render(
      <IntelligentTreeSelect<TestOption>
        ref={ref}
        {...commonProps}
        options={[]}
        fetchOptions={fetchOptions}
        fetchLimit={25}
        name="cached-tree"
        optionLifetime="1h5m"
      />
    );

    await waitFor(() =>
      expect(fetchOptions).toHaveBeenCalledWith({
        searchString: "",
        optionID: "",
        limit: 25,
        offset: 0,
        option: undefined,
      })
    );
    await waitFor(() => expect(ref.current?.getOptions()).toHaveLength(2));

    const cached = JSON.parse(window.localStorage.getItem("cached-tree")!);
    expect(cached.data).toHaveLength(2);
    expect(cached.validTo).toBeGreaterThan(Date.now());

    fireEvent.click(document.querySelector(".toggleButton")!);
    await waitFor(() =>
      expect(fetchOptions).toHaveBeenCalledWith(expect.objectContaining({optionID: "root", offset: 0}))
    );
  });

  it("debounces remote searches and forwards input changes", async () => {
    jest.useFakeTimers();
    const fetchOptions = jest.fn(async () => options);
    const onInputChange = jest.fn();
    render(
      <IntelligentTreeSelect<TestOption>
        {...commonProps}
        options={[]}
        fetchOptions={fetchOptions}
        searchDelay={50}
        onInputChange={onInputChange}
      />
    );

    await act(async () => Promise.resolve());
    fetchOptions.mockClear();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, {target: {value: "roo"}});
    expect(onInputChange).toHaveBeenCalledWith("roo");
    expect(fetchOptions).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
    expect(fetchOptions).toHaveBeenCalledWith(expect.objectContaining({searchString: "roo", offset: 0}));
  });
});
