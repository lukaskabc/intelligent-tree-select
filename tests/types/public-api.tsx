import React from "react";
import TreeSelect, {IntelligentTreeSelect, VirtualizedTreeSelect} from "../../src";
import type {
  BaseOption,
  FetchOptionsFn,
  FetchParams,
  IntelligentTreeSelectProps,
  OnChangeValue,
  VirtualizedTreeSelectProps,
} from "../../src";

interface CustomOption extends BaseOption {
  key: number;
  text: string;
  childKeys: number[];
}

const options: CustomOption[] = [{key: 1, text: "One", childKeys: []}];
const fetchOptions: FetchOptionsFn<CustomOption> = async (params: FetchParams<CustomOption>) => {
  params.searchString?.toLowerCase();
  return options;
};

const multiChange = (_value: OnChangeValue<CustomOption, true, true>) => undefined;
const singleChange = (_value: CustomOption | null) => undefined;

const props: IntelligentTreeSelectProps<CustomOption> = {
  options,
  fetchOptions,
  valueKey: "key",
  labelKey: "text",
  childrenKey: "childKeys",
  value: [1],
  onChange: multiChange,
  "aria-label": "Typed tree",
  isSearchable: true,
};

const lowLevelProps: VirtualizedTreeSelectProps<CustomOption> = {
  options,
  value: options,
  onChange: (_value: CustomOption[] | null) => undefined,
};

const ref = React.createRef<IntelligentTreeSelect<CustomOption>>();
const defaultUsage = <TreeSelect />;
const typedUsage = <IntelligentTreeSelect<CustomOption> {...props} ref={ref} />;
const singleUsage = (
  <IntelligentTreeSelect<CustomOption, false> options={options} multi={false} onChange={singleChange} />
);
const lowLevelUsage = <VirtualizedTreeSelect<CustomOption> {...lowLevelProps} />;
const lowLevelMultiUsage = <VirtualizedTreeSelect<CustomOption> {...lowLevelProps} multi={true} />;

void defaultUsage;
void typedUsage;
void singleUsage;
void lowLevelUsage;
void lowLevelMultiUsage;
ref.current?.focus();
ref.current?.blurInput();
ref.current?.resetOptions();
ref.current?.getOptions();
