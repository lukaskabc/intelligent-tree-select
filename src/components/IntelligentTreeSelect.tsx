import React, {Component} from "react";
import debounce from "lodash.debounce";

import {VirtualizedTreeSelect} from "./VirtualizedTreeSelect";
import PropTypes from "prop-types";
import {isURL, monotonicAssign, sanitizeArray} from "./utils/Utils";
import Constants from "./utils/Constants";
import type {
  BaseOption,
  CachedOptions,
  IntelligentTreeSelectProps,
  OnChangeValue,
  OptionKey,
  OptionLifetime,
  ProcessedOption,
  ScrollMetrics,
  VirtualizedTreeSelectProps,
} from "../types";

type IntelligentDefaultProp =
  | "autoFocus"
  | "childrenKey"
  | "expanded"
  | "fetchLimit"
  | "hideSelectedOptions"
  | "isClearable"
  | "isMenuOpen"
  | "labelKey"
  | "menuIsFloating"
  | "multi"
  | "optionHeight"
  | "optionLifetime"
  | "options"
  | "renderAsTree"
  | "searchDelay"
  | "simpleTreeData"
  | "styles"
  | "titleKey"
  | "valueIsControlled"
  | "valueKey";

type ResolvedIntelligentTreeSelectProps<
  T extends BaseOption,
  IsMulti extends boolean,
  IsClearable extends boolean
> = IntelligentTreeSelectProps<T, IsMulti, IsClearable> &
  Required<Pick<IntelligentTreeSelectProps<T, IsMulti, IsClearable>, IntelligentDefaultProp>>;

interface IntelligentTreeSelectState<T extends BaseOption, IsMulti extends boolean = boolean> {
  expanded: boolean;
  multi: IsMulti;
  options: ProcessedOption<T>[];
  selectedOptions: ProcessedOption<T>[];
  passedValue: Array<T | OptionKey>;
  isLoadingExternally: boolean;
  update: number;
}

interface ValueComponentProps<T extends BaseOption> {
  children: React.ReactNode;
  data: ProcessedOption<T>;
}

interface DebouncedSearch {
  (searchString: string, offset: number): void;
  cancel(): void;
  flush(): void;
}

class IntelligentTreeSelect<
  T extends BaseOption = BaseOption,
  IsMulti extends boolean = true,
  IsClearable extends boolean = true
> extends Component<IntelligentTreeSelectProps<T, IsMulti, IsClearable>, IntelligentTreeSelectState<T, IsMulti>> {
  declare static defaultProps: Pick<
    ResolvedIntelligentTreeSelectProps<BaseOption, boolean, boolean>,
    IntelligentDefaultProp
  >;
  declare static propTypes: Partial<Record<keyof IntelligentTreeSelectProps<BaseOption, boolean, boolean>, unknown>>;

  declare readonly props: Readonly<ResolvedIntelligentTreeSelectProps<T, IsMulti, IsClearable>>;

  declare fetching: false | Promise<void>;
  declare completedNodes: Record<string, boolean>;
  declare toggledNodes: Record<string, boolean>;
  declare searchString: string;
  declare searchPage: number;
  declare totalRequestedRootOptions: number;
  declare select: React.RefObject<VirtualizedTreeSelect<T, IsMulti, IsClearable>>;
  declare debouncedSearch: DebouncedSearch;

  constructor(props: IntelligentTreeSelectProps<T, IsMulti, IsClearable>, context?: unknown) {
    super(props, context);

    this.fetching = false;
    this.completedNodes = {};
    this.toggledNodes = {};
    this.searchString = "";
    this.searchPage = 0;
    this.totalRequestedRootOptions = 0;

    this._valueRenderer = this._valueRenderer.bind(this);
    this._addSelectedOption = this._addSelectedOption.bind(this);
    this._onInputChange = this._onInputChange.bind(this);
    this._onChange = this._onChange.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onOptionToggle = this._onOptionToggle.bind(this);
    this._finalizeSelectedOptions = this._finalizeSelectedOptions.bind(this);

    this.state = {
      expanded: this.props.expanded,
      multi: this.props.multi,
      options: [],
      selectedOptions: [],
      passedValue: (this.props.value || []) as Array<T | OptionKey>,
      isLoadingExternally: false,
      update: 0,
    };
    this.select = React.createRef();
    this.debouncedSearch = debounce(
      (searchString, offset) => this._invokeSearch(searchString, offset),
      props.searchDelay
    );
  }

  componentDidMount() {
    let data: ProcessedOption<T>[] = [];
    if (this.props.name && this.props.fetchOptions) {
      data = this._retrieveCachedData()!;
    }

    if (data.length === 0) {
      data = this.props.options as ProcessedOption<T>[];
    }

    if (!this.props.simpleTreeData) {
      data = this._simplifyData(this.props.options);
    }

    this._addNewOptions(data);
    this._loadOptions();
  }

  _retrieveCachedData(): ProcessedOption<T>[] | undefined {
    let cachedData: string | CachedOptions<ProcessedOption<T>> | null = window.localStorage.getItem(this.props.name!);
    if (cachedData) {
      cachedData = JSON.parse(cachedData) as CachedOptions<ProcessedOption<T>>;
      return cachedData.validTo > Date.now() ? cachedData.data : [];
    }
  }

  _loadOptions() {
    if (this.state.options.length === 0 && this.props.fetchOptions) {
      if (!this.fetching) {
        this._fetchOptions("", "", 0);
      }
    }
  }

  _fetchOptions(
    searchString: string,
    optionId: OptionKey,
    offset: number,
    topOption?: ProcessedOption<T>,
    callback?: (options: ProcessedOption<T>[]) => void
  ): void {
    this.setState({isLoadingExternally: true});
    this.fetching = this._getResponse(searchString, optionId, this.props.fetchLimit, offset, topOption).then(
      (response) => {
        let data;
        if (!this.props.simpleTreeData) {
          data = this._simplifyData(response);
        } else {
          data = response;
        }
        this.fetching = false;
        if (!searchString && !optionId) {
          this.totalRequestedRootOptions = offset + this.props.fetchLimit;
        }
        this._addNewOptions(data);
        this.setState({isLoadingExternally: false});
        if (callback) {
          callback(data);
        }
      }
    );
  }

  // If the values are controlled from the outside, it is needed to map them properly to options which Select knows
  static getDerivedStateFromProps<TOption extends BaseOption>(
    props: ResolvedIntelligentTreeSelectProps<TOption, boolean, boolean>,
    state: IntelligentTreeSelectState<TOption, boolean>
  ): Partial<IntelligentTreeSelectState<TOption, boolean>> | null {
    if (!props.valueIsControlled) {
      return null;
    }

    if (!props.value) {
      return {
        passedValue: [],
        selectedOptions: [],
      };
    }

    const values = sanitizeArray<TOption | OptionKey>(props.value as TOption | OptionKey | Array<TOption | OptionKey>);
    const existingOptions = sanitizeArray<ProcessedOption<TOption>>(state.options);
    const modifiedPassedValue: Array<TOption | OptionKey> = [];
    const modifiedSelectedOptions: ProcessedOption<TOption>[] = [];

    for (const valueElement of values) {
      const key = (valueElement as TOption)[props.valueKey] ?? valueElement;
      const opt =
        existingOptions.find((term) => term[props.valueKey] === key) ||
        (typeof valueElement === "object" && valueElement[props.valueKey] ? valueElement : null);

      if (opt) {
        modifiedSelectedOptions.push(opt);
      } else {
        modifiedPassedValue.push(key);
      }
    }

    return {
      passedValue: !props.multi && modifiedPassedValue.length > 0 ? [modifiedPassedValue[0]] : modifiedPassedValue,
      selectedOptions:
        !props.multi && modifiedSelectedOptions.length > 0 ? [modifiedSelectedOptions[0]] : modifiedSelectedOptions,
    };
  }

  /**
   * Resets the option, forcing the component to reload them from the server/reload them from props.
   */
  resetOptions() {
    this.toggledNodes = {};
    this.totalRequestedRootOptions = 0;
    this.setState({options: []}, () => {
      if (this.select.current) {
        this.select.current.resetOptions();
      }
      if (this.props.fetchOptions) {
        this._loadOptions();
      } else {
        this._addNewOptions(this.props.options);
      }
    });
  }

  /**
   * Focuses the select input.
   */
  focus() {
    if (this.select.current) {
      this.select.current.focus();
    }
  }

  /**
   * Blurs the select input.
   */
  blurInput() {
    if (this.select.current) {
      this.select.current.blurInput();
    }
  }

  /**
   * Gets the current options provided by this component.
   */
  getOptions(): T[] {
    return this.state.options.slice();
  }

  componentDidUpdate(prevProps: IntelligentTreeSelectProps<T, IsMulti, IsClearable>): void {
    if (!this.props.fetchOptions && prevProps.options !== this.props.options) {
      this.setState({options: []}, () => {
        // Reset options from props
        this._addNewOptions(this.props.options);
      });
    }
  }

  _simplifyData(responseData: T[]): ProcessedOption<T>[] {
    let result: ProcessedOption<T>[] = [];
    const {valueKey, childrenKey} = this.props;

    if (!responseData || responseData.length === 0) return result;

    for (let i = 0; i < responseData.length; i++) {
      //deep clone
      let data = JSON.parse(JSON.stringify(responseData[i])) as ProcessedOption<T>;
      result = result.concat(data);
      const childrenArr = sanitizeArray<T>(data[childrenKey]);
      if (childrenArr.length > 0) {
        result = result.concat(this._simplifyData(childrenArr));
        (data as BaseOption)[childrenKey] = childrenArr.map((xdata) => xdata[valueKey]);
      }
    }

    return result;
  }

  _parseOptionLifetime(value: string): OptionLifetime {
    let optionLifetime: OptionLifetime = {
      days: 0,
      hours: 0,
      minutes: 30,
      seconds: 0,
    };
    if (/^(\d+d)?(\d+h)?(\d+m)?(\d+s)?$/.test(value)) {
      let tmp = /^(\d+d)?(\d+h)?(\d+m)?(\d+s)?$/.exec(value)!;
      optionLifetime = {
        days: parseInt(tmp[1], 10),
        hours: parseInt(tmp[2], 10),
        minutes: parseInt(tmp[3], 10),
        seconds: parseInt(tmp[4], 10),
      };
    } else {
      throw new Error("Invalid optionLifetime. Expecting format: e.g. 1d10h5m6s ");
    }
    return optionLifetime;
  }

  _getValidForInSec(optionLifetime: string | OptionLifetime): number {
    optionLifetime = this._parseOptionLifetime(optionLifetime as string);
    let res = 0;
    res += isNaN(optionLifetime.seconds) ? 0 : optionLifetime.seconds;
    res += isNaN(optionLifetime.minutes) ? 0 : optionLifetime.minutes * 60;
    res += isNaN(optionLifetime.hours) ? 0 : optionLifetime.hours * 60 * 60;
    res += isNaN(optionLifetime.days) ? 0 : optionLifetime.days * 60 * 60 * 24;
    return res * 1000;
  }

  _getRootNodesCount(): number {
    let count = 0;
    this.state.options.forEach((option) => {
      if (option.depth === 0) count++;
    });
    return count;
  }

  async _getResponse(
    searchString: string,
    optionID: OptionKey,
    limit: number,
    offset: number,
    option?: ProcessedOption<T>
  ): Promise<T[]> {
    return this.props.fetchOptions
      ? await this.props.fetchOptions({
          searchString,
          optionID,
          limit,
          offset,
          option,
        })
      : [];
  }

  _onInputChange(searchString: string): void {
    if (this.props.fetchOptions) {
      if (searchString) {
        if (!this.fetching) {
          if (searchString !== this.searchString) {
            this.searchPage = 0;
            this.completedNodes = {};
            if (this.state.options.length > 0) {
              this.setState({options: []});
            }
          }
          const offset = 0;

          this.debouncedSearch(searchString, offset);
        } else {
          if (this.select.current) {
            this.select.current.filterValues(searchString);
          }
        }
      } else {
        this.searchPage = 0;
        this.completedNodes = {};
        this.totalRequestedRootOptions = 0;
        if (this.searchString) {
          this.setState({options: []});
        }
        if (!this.fetching) {
          this.debouncedSearch.cancel();
          this.debouncedSearch("", 0);
          this.debouncedSearch.flush();
        } else if (this.select.current) {
          this.select.current.filterValues("");
        }
      }
    }

    this.searchString = searchString;
    if (this.props.onInputChange !== undefined) {
      this.props.onInputChange(searchString);
    }
  }

  _invokeSearch(searchString: string, offset: number): void {
    const isSearch = !!searchString;
    const computedOffset = isSearch ? this.searchPage * this.props.fetchLimit : offset;
    this._fetchOptions(searchString, "", computedOffset, undefined, (data) => {
      if (isSearch) {
        const pageIsFull = Array.isArray(data) && data.length >= this.props.fetchLimit;
        if (pageIsFull) {
          this.searchPage += 1;
        } else {
          this.completedNodes["root"] = true;
        }
      }
      if (this.select.current) {
        this.select.current.filterValues(searchString);
      }
    });
  }

  _onScroll(data: ScrollMetrics): void {
    const {clientHeight, scrollHeight, scrollTop} = data;

    if (!this.state.options.length) return;

    if (scrollHeight - scrollTop <= 2.5 * clientHeight && !this.fetching && this.props.fetchOptions) {
      // this.fetching = true;
      let totalOptionsHeight = 0;
      let topOptionIndex = 0;

      for (topOptionIndex; topOptionIndex < this.state.options.length; topOptionIndex++) {
        const option = this.state.options[topOptionIndex];

        totalOptionsHeight +=
          this.props.optionHeight instanceof Function ? this.props.optionHeight({option}) : this.props.optionHeight;

        if (totalOptionsHeight >= scrollTop) {
          break;
        }
      }

      const topOption = this.state.options[topOptionIndex];
      let topOptionParentValue = topOption.parent ? topOption.parent[this.props.valueKey] : undefined;
      let parentOption = this.state.options.find((option) => option[this.props.valueKey] === topOptionParentValue);
      let offset = parentOption
        ? parentOption[this.props.childrenKey].length
        : this.searchString
        ? this.searchPage * this.props.fetchLimit
        : this.totalRequestedRootOptions;

      if (!this.completedNodes[topOptionParentValue || "root"]) {
        this._fetchOptions(this.searchString || "", topOptionParentValue, offset, topOption, (fetchedData) => {
          if (!topOption.parent && this.searchString) {
            if (Array.isArray(fetchedData) && fetchedData.length >= this.props.fetchLimit) {
              this.searchPage += 1;
            }
          }
          if (fetchedData.length < this.props.fetchLimit) {
            //fetch parent options
            this.completedNodes[topOptionParentValue || "root"] = true;
          }
        });
      }
    }
  }

  _onOptionToggle(option?: ProcessedOption<T>): void {
    if (!option) {
      return;
    }
    if (!option.expanded) {
      let dataCached = this.toggledNodes[option[this.props.valueKey]] || false;

      if (!dataCached) {
        this.setState({isLoadingExternally: true});
        option.fetchingChild = true;
        let data = [];

        this._getResponse(this.searchString || "", option[this.props.valueKey], this.props.fetchLimit, 0, option).then(
          (response) => {
            if (!this.props.simpleTreeData) {
              data = this._simplifyData(response);
            } else {
              data = response;
            }

            if (data.length < this.props.fetchLimit) {
              this.completedNodes[option[this.props.valueKey]] = true;
            }

            this.toggledNodes[option[this.props.valueKey]] = true;

            delete option.fetchingChild;

            if (data.length > 0) {
              this._addNewOptions(data);
            }
            this.setState({isLoadingExternally: false});
          }
        );
      }
    }
    this.forceUpdate();
  }

  _valueRenderer({children, data}: ValueComponentProps<T>): React.ReactNode {
    if (this.props.valueRenderer) {
      // On initial render, there can be empty options
      if (!children) return null;
      return this.props.valueRenderer(children, data);
    }
    const value = data[this.props.valueKey].toString();

    if (isURL(value)) {
      return (
        <a href={value} target="_blank">
          {children}
        </a>
      );
    }
    return children;
  }

  _addNewOptions(newOptions: Array<T | ProcessedOption<T>>): void {
    const {childrenKey, fetchOptions, name, optionLifetime} = this.props;

    let mergedArr: ProcessedOption<T>[];
    if (this.state.options.length === 0) {
      newOptions.forEach((no) => ((no as BaseOption)[childrenKey] = sanitizeArray(no[childrenKey])));
      mergedArr = newOptions as ProcessedOption<T>[];
    } else {
      mergedArr = this._mergeOptionArrays(this.state.options, newOptions);
    }

    if (name && fetchOptions) {
      window.localStorage.setItem(
        name,
        JSON.stringify({
          validTo: Date.now() + this._getValidForInSec(optionLifetime),
          data: mergedArr,
        })
      );
    }

    if (newOptions.length > 0) {
      this._finalizeSelectedOptions(newOptions, mergedArr);
    }

    this.setState({options: mergedArr, update: ++(this.state as IntelligentTreeSelectState<T, IsMulti>).update});
  }

  _mergeOptionArrays(
    originalOptions: ProcessedOption<T>[],
    newOptions: Array<T | ProcessedOption<T>>
  ): ProcessedOption<T>[] {
    const {valueKey, childrenKey} = this.props;
    let options = originalOptions.concat(newOptions);
    let mergedArr: ProcessedOption<T>[] = [];

    //merge options
    while (options.length > 0) {
      let currOption = options.shift()!;

      (currOption as BaseOption)[childrenKey] = sanitizeArray(currOption[childrenKey]);

      const conflicts: ProcessedOption<T>[] = [];
      const optionsToReplace: ProcessedOption<T>[] = [];
      options.forEach((object) => {
        if (object[valueKey] === currOption[valueKey]) {
          (object as BaseOption)[childrenKey] = sanitizeArray(object[childrenKey]);
          conflicts.push(object);
        } else {
          optionsToReplace.push(object);
        }
      });
      mergedArr.push(monotonicAssign({} as ProcessedOption<T>, currOption, ...conflicts.reverse()));
      options = optionsToReplace;
    }
    return mergedArr;
  }

  //Check if new options contain selected value
  _finalizeSelectedOptions(addedOptions: Array<T | ProcessedOption<T>>, parsedOptions: ProcessedOption<T>[]): void {
    const foundOptions: OptionKey[] = [];
    let previouslySelected = sanitizeArray<T | OptionKey>(this.state.passedValue);
    let newSelected = sanitizeArray<ProcessedOption<T>>(this.state.selectedOptions);

    for (const selectedOpt of previouslySelected) {
      const key = (selectedOpt as T)[this.props.valueKey] ?? selectedOpt;
      const option = addedOptions.find((term) => term[this.props.valueKey] === key);
      if (!option) continue;
      foundOptions.push(key);
      const optionParsed = parsedOptions.find((term) => term[this.props.valueKey] === key);

      // prevent duplicates
      if (!newSelected.some((term) => term[this.props.valueKey] === key)) {
        newSelected = this.props.multi ? [...newSelected, optionParsed!] : [optionParsed!];
      }
    }
    this._addSelectedOption(newSelected);

    //remove already found options
    for (const foundOption of foundOptions) {
      previouslySelected = previouslySelected.filter((term) => {
        return term !== foundOption;
      });
    }

    this.setState({passedValue: previouslySelected});
  }

  _onChange(options: ProcessedOption<T> | readonly ProcessedOption<T>[] | null): void {
    let optionsArray = sanitizeArray<ProcessedOption<T>>(options);
    if (!this.props.valueIsControlled) {
      // updating internal state synchronously only when value is not controlled
      this._addSelectedOption(optionsArray);
    }
    if (this.props.onChange) {
      this.props.onChange(options as OnChangeValue<T, IsMulti, IsClearable>);
    }
  }

  _addSelectedOption(selectedOptions: ProcessedOption<T>[]): void {
    this.setState({selectedOptions});
  }

  render() {
    let listProps: {
      onScroll: (metrics: ScrollMetrics) => void;
      ref: React.RefObject<VirtualizedTreeSelect<T, IsMulti, IsClearable>>;
    } = {} as {
      onScroll: (metrics: ScrollMetrics) => void;
      ref: React.RefObject<VirtualizedTreeSelect<T, IsMulti, IsClearable>>;
    };
    listProps.onScroll = this.props.onScroll || this._onScroll;
    listProps.ref = this.select;
    const valueRenderer = this._valueRenderer;
    const propsToPass: Record<string, unknown> = Object.assign({}, this.props);
    delete propsToPass.valueRenderer;
    delete propsToPass.onScroll;
    delete propsToPass.value;
    delete propsToPass.onChange;

    const VirtualizedComponent = VirtualizedTreeSelect as unknown as React.ComponentType<
      VirtualizedTreeSelectProps<T, IsMulti, IsClearable> &
        React.RefAttributes<VirtualizedTreeSelect<T, IsMulti, IsClearable>> & {
          isLoading?: boolean;
          menuIsOpen?: boolean;
        }
    >;

    return (
      <div>
        <VirtualizedComponent
          ref={this.select}
          styles={this.props.styles}
          name="react-virtualized-tree-select"
          onChange={this._onChange}
          value={this.state.selectedOptions}
          valueRenderer={valueRenderer as React.ComponentType<any>}
          {...propsToPass}
          menuIsOpen={this.props.isMenuOpen}
          expanded={this.state.expanded}
          renderAsTree={this.props.renderAsTree}
          multi={this.state.multi}
          isLoading={this.state.isLoadingExternally}
          onInputChange={this._onInputChange}
          options={this.state.options}
          listProps={listProps}
          update={this.state.update}
          onOptionToggle={this._onOptionToggle}
          noOptionsMessage={() => this.props.noResultsText}
          loadingMessage={() => this.props.loadingText}
        />
      </div>
    );
  }
}

IntelligentTreeSelect.propTypes = {
  onChange: PropTypes.func,
  autoFocus: PropTypes.bool,
  isMenuOpen: PropTypes.bool,
  childrenKey: PropTypes.string,
  expanded: PropTypes.bool,
  fetchLimit: PropTypes.number,
  fetchOptions: PropTypes.func,
  matchCheck: PropTypes.func,
  labelKey: PropTypes.string,
  getOptionLabel: PropTypes.func,
  getOptionValue: PropTypes.func,
  multi: PropTypes.bool,
  name: PropTypes.string,
  onInputChange: PropTypes.func,
  optionHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.func]),
  options: PropTypes.array,
  renderAsTree: PropTypes.bool,
  simpleTreeData: PropTypes.bool,
  optionLifetime: PropTypes.string,
  valueKey: PropTypes.string,
  optionRenderer: PropTypes.func,
  valueRenderer: PropTypes.func,
  searchDelay: PropTypes.number,
  hideSelectedOptions: PropTypes.bool,
  menuIsFloating: PropTypes.bool,
  valueIsControlled: PropTypes.bool,
  isClearable: PropTypes.bool,
  styles: PropTypes.object,
  titleKey: PropTypes.string,
};

IntelligentTreeSelect.defaultProps = {
  autoFocus: false,
  childrenKey: Constants.CHILDREN_KEY,
  labelKey: Constants.LABEL_KEY,
  valueKey: Constants.VALUE_KEY,
  expanded: false,
  multi: true,
  options: [],
  renderAsTree: true,
  isMenuOpen: false,
  simpleTreeData: true,
  optionLifetime: "5m",
  fetchLimit: 100,
  optionHeight: 25,
  hideSelectedOptions: false,
  menuIsFloating: true,
  valueIsControlled: true,
  isClearable: true,
  styles: {},
  titleKey: "title",
  searchDelay: 0,
};

export {IntelligentTreeSelect};
