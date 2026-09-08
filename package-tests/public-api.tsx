import React from "react";
import TreeSelect, {
  IntelligentTreeSelect,
  ToggleMinusIcon,
  TogglePlusIcon,
  VirtualizedTreeSelect,
} from "intelligent-tree-select";
import type {
  BaseOption,
  Clearable,
  CommonTreeSelectProps,
  FetchOptionsFn,
  FetchParams,
  IntelligentTreeSelectProps,
  Multi,
  MultiValue,
  OnChangeValue,
  SingleValue,
  VirtualizedTreeSelectProps,
} from "intelligent-tree-select";

interface PackageOption extends BaseOption {
  id: number;
  label: string;
  children: number[];
}

const options: PackageOption[] = [{id: 1, label: "One", children: []}];
const fetchOptions: FetchOptionsFn<PackageOption> = async ({limit}: FetchParams<PackageOption>) =>
  options.slice(0, limit);
const props: IntelligentTreeSelectProps<PackageOption> = {
  options,
  fetchOptions,
  valueKey: "id",
  value: [1],
  onChange: (_value: OnChangeValue<PackageOption, true, true>) => undefined,
  "aria-label": "Package tree",
};
const commonProps: CommonTreeSelectProps<PackageOption> = {options};
const lowLevelProps: VirtualizedTreeSelectProps<PackageOption> = {options};
const ref = React.createRef<IntelligentTreeSelect<PackageOption>>();

const rendered = (
  <>
    <TreeSelect<PackageOption> {...props} ref={ref} />
    <VirtualizedTreeSelect<PackageOption> {...lowLevelProps} />
    <TogglePlusIcon />
    <ToggleMinusIcon />
  </>
);

const multi: Multi = true;
const clearable: Clearable = true;
const single: SingleValue<PackageOption, true> = null;
const multiple: MultiValue<PackageOption> = options;

void rendered;
void commonProps;
void multi;
void clearable;
void single;
void multiple;
ref.current?.focus();
ref.current?.blurInput();
ref.current?.resetOptions();
ref.current?.getOptions();
