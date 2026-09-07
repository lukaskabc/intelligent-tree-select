import type React from "react";
import type {FilterOptionOption, GroupBase, Props as ReactSelectProps} from "react-select";

export interface BaseOption {
  [key: string]: any;
}

export type OptionKey = string | number;
export type Multi = boolean;
export type Clearable = boolean;

export type SingleValue<Option, IsClearable extends Clearable> = IsClearable extends true ? Option | null : Option;
export type MultiValue<Option> = readonly Option[];

export type OnChangeValue<Option, IsMulti extends boolean, IsClearable extends Clearable> = IsMulti extends true
  ? MultiValue<Option>
  : SingleValue<Option, IsClearable>;

export interface FetchParams<T extends BaseOption = BaseOption> {
  searchString?: string;
  optionID?: OptionKey;
  limit?: number;
  offset?: number;
  option?: T | null;
}

export type FetchOptionsFn<T extends BaseOption = BaseOption> = (params: FetchParams<T>) => Promise<T[]>;

export interface ScrollMetrics {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}

export interface OptionHeightContext<T extends BaseOption> {
  option: T;
}

export interface TreeSelectOwnProps<
  T extends BaseOption = BaseOption,
  IsMulti extends Multi = true,
  IsClearable extends Clearable = true
> {
  autoFocus?: boolean;
  isMenuOpen?: boolean;
  isDisabled?: boolean;
  childrenKey?: string;
  expanded?: boolean;
  fetchLimit?: number;
  fetchOptions?: FetchOptionsFn<T>;
  id?: string;
  matchCheck?: (search: string, optionLabel: string) => boolean;
  labelKey?: string;
  getOptionLabel?: (option: T) => string;
  getOptionValue?: (option: T) => string | number;
  multi?: IsMulti;
  name?: string;
  onInputChange?: (input: string) => void;
  onScroll?: (metrics: ScrollMetrics) => void;
  optionHeight?: number | ((context: OptionHeightContext<T>) => number);
  options?: T[];
  renderAsTree?: boolean;
  simpleTreeData?: boolean;
  optionLifetime?: string;
  placeholder?: React.ReactNode;
  valueKey?: string;
  optionRenderer?: React.ComponentType<any>;
  valueRenderer?: (children: React.ReactNode, option: T) => React.ReactNode;
  searchDelay?: number;
  hideSelectedOptions?: boolean;
  menuIsFloating?: boolean;
  valueIsControlled?: boolean;
  isClearable?: IsClearable;
  styles?: Record<string, any>;
  classNamePrefix?: string | null;
  className?: string;
  titleKey?: string;
  maxHeight?: number;
  minHeight?: number;
  menuStyle?: React.CSSProperties;
  optionLeftOffset?: number;
  noResultsText?: string;
  loadingText?: string;
  filterOption?: ((option: FilterOptionOption<T>, inputValue: string) => boolean) | null;
}

type InternallyManagedReactSelectProps =
  | "components"
  | "filterOption"
  | "getOptionLabel"
  | "getOptionValue"
  | "isClearable"
  | "isLoading"
  | "isMulti"
  | "menuIsOpen"
  | "onChange"
  | "onInputChange"
  | "options"
  | "styles"
  | "value";

export type CommonTreeSelectProps<
  T extends BaseOption = BaseOption,
  IsMulti extends Multi = true,
  IsClearable extends Clearable = true
> = TreeSelectOwnProps<T, IsMulti, IsClearable> &
  Omit<ReactSelectProps<T, IsMulti, GroupBase<T>>, InternallyManagedReactSelectProps | keyof TreeSelectOwnProps>;

export type TreeSelectValue<T extends BaseOption> = T | T[] | OptionKey | OptionKey[] | null;

export type IntelligentTreeSelectProps<
  T extends BaseOption = BaseOption,
  IsMulti extends boolean = true,
  IsClearable extends boolean = true
> = CommonTreeSelectProps<T, IsMulti, IsClearable> & {
  value?: TreeSelectValue<T>;
  onChange?: (value: OnChangeValue<T, IsMulti, IsClearable>) => void;
};

export interface VirtualizedListProps {
  onScroll?: (metrics: ScrollMetrics) => void;
  [key: string]: any;
}

export type VirtualizedTreeSelectProps<
  T extends BaseOption = BaseOption,
  IsMulti extends boolean = boolean,
  IsClearable extends boolean = true
> = Omit<CommonTreeSelectProps<T, IsMulti, IsClearable>, "valueRenderer"> & {
  onChange?: (value: T[] | null) => void;
  value?: T[];
  listProps?: VirtualizedListProps;
  update?: number;
  onOptionToggle?: (option: T) => void;
  valueRenderer?: React.ComponentType<any>;
  noOptionsMessage?: () => React.ReactNode;
  loadingMessage?: () => React.ReactNode;
};

export type ProcessedOption<T extends BaseOption = BaseOption> = T & {
  value?: unknown;
  depth?: number;
  parent?: ProcessedOption<T> | null;
  path?: OptionKey[];
  expanded?: boolean;
  visible?: boolean;
  fetchingChild?: boolean;
};

export interface FocusedOptionScrollState {
  lastScrolledKey: OptionKey | string | null;
  lastScrolledIndex: number | null;
  suppressScroll: boolean;
}

export interface CachedOptions<T extends BaseOption> {
  validTo: number;
  data: T[];
}

export interface OptionLifetime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}
