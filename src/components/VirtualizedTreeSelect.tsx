import React, {Component} from "react";
import Select, {components} from "react-select";
import type {FilterOptionOption, GroupBase, MenuListProps, MenuProps, SelectInstance, StylesConfig} from "react-select";
import PropTypes from "prop-types";
import Option from "./Option";
import Constants from "./utils/Constants";
import {FixedSizeList as List} from "react-window";
import {arraysAreEqual, getLabel, optionListsAreEqual, sanitizeArray} from "./utils/Utils";
import type {
  BaseOption,
  FocusedOptionScrollState,
  OptionKey,
  ProcessedOption,
  VirtualizedListProps,
  VirtualizedTreeSelectProps,
} from "../types";
import type {FixedSizeList as FixedSizeListInstance, FixedSizeListProps, ListChildComponentProps} from "react-window";

type VirtualizedDefaultProp =
  | "childrenKey"
  | "expanded"
  | "hideSelectedOptions"
  | "isMenuOpen"
  | "labelKey"
  | "maxHeight"
  | "menuIsFloating"
  | "minHeight"
  | "multi"
  | "optionHeight"
  | "optionLeftOffset"
  | "options"
  | "renderAsTree"
  | "styles"
  | "valueKey";

type ResolvedVirtualizedTreeSelectProps<
  T extends BaseOption,
  IsMulti extends boolean,
  IsClearable extends boolean
> = VirtualizedTreeSelectProps<T, IsMulti, IsClearable> &
  Required<Pick<VirtualizedTreeSelectProps<T, IsMulti, IsClearable>, VirtualizedDefaultProp>>;

interface VirtualizedTreeSelectState<T extends BaseOption> {
  options: ProcessedOption<T>[];
  initialExpansion: boolean;
}

interface SelectOptionProps<T extends BaseOption> {
  data: ProcessedOption<T>;
  selectOption: (option: ProcessedOption<T>) => void;
}

interface InjectedRuntimeSelectProps<T extends BaseOption> {
  childrenKey: string;
  focusedOptionScrollState: FocusedOptionScrollState;
  focus: () => void;
  listProps?: VirtualizedListProps;
  maxHeight: number;
  menuIsFloating: boolean;
  multi: boolean;
  onOptionHover: (option: ProcessedOption<T>) => void;
  onOptionSelect: (props: SelectOptionProps<T>) => void;
  onOptionToggle: (option: ProcessedOption<T>) => void;
  optionHeight: number | ((context: {option: T}) => number);
  renderAsTree: boolean;
  titleKey?: string;
  valueKey: string;
}

type TreeAwareSelectProps<T extends BaseOption, IsMulti extends boolean> = InjectedRuntimeSelectProps<T> & {
  [key: string]: unknown;
  components: Record<string, React.ComponentType<any> | undefined>;
  filterOption: (option: FilterOptionOption<ProcessedOption<T>>, inputValue: string) => boolean;
  getOptionLabel: (option: ProcessedOption<T>) => string;
  getOptionValue: (option: ProcessedOption<T>) => string | number;
  styles: StylesConfig<ProcessedOption<T>, IsMulti, GroupBase<ProcessedOption<T>>>;
} & React.RefAttributes<SelectInstance<ProcessedOption<T>, IsMulti, GroupBase<ProcessedOption<T>>>>;

const TreeAwareSelect = Select as unknown as <T extends BaseOption, IsMulti extends boolean>(
  props: TreeAwareSelectProps<T, IsMulti>
) => React.ReactElement;

/**
 * Gets stable identifier for a focused option.
 *
 * @private
 */
function getOptionScrollKey<T extends BaseOption>(
  option: ProcessedOption<T> | null | undefined,
  valueKey: string
): OptionKey | string | undefined {
  if (!option) {
    return undefined;
  }
  return option.path?.join(">") || option[valueKey];
}

class VirtualizedTreeSelect<
  T extends BaseOption = BaseOption,
  IsMulti extends boolean = boolean,
  IsClearable extends boolean = true
> extends Component<VirtualizedTreeSelectProps<T, IsMulti, IsClearable>, VirtualizedTreeSelectState<T>> {
  declare static defaultProps: Pick<
    ResolvedVirtualizedTreeSelectProps<BaseOption, boolean, boolean>,
    VirtualizedDefaultProp
  >;
  declare static propTypes: Partial<Record<keyof VirtualizedTreeSelectProps<BaseOption, boolean, boolean>, unknown>>;

  declare readonly props: Readonly<ResolvedVirtualizedTreeSelectProps<T, IsMulti, IsClearable>>;

  declare matchCheck: (searchInput: string, optionLabel: string) => boolean;
  declare data: Record<string, ProcessedOption<T>>;
  declare searchString: string;
  declare focusedOptionScrollState: FocusedOptionScrollState;
  declare pendingSelectedScroll: boolean;
  declare toggledOptions: ProcessedOption<T>[];
  declare select: React.RefObject<SelectInstance<ProcessedOption<T>, IsMulti, GroupBase<ProcessedOption<T>>>>;

  constructor(props: VirtualizedTreeSelectProps<T, IsMulti, IsClearable>, context?: unknown) {
    super(props, context);

    this._processOptions = this._processOptions.bind(this);
    this._expandSelectedValues = this._expandSelectedValues.bind(this);
    this._focusSelectedOption = this._focusSelectedOption.bind(this);
    this._focusOption = this._focusOption.bind(this);
    this.filterOption = this.filterOption.bind(this);
    this._onInputChange = this._onInputChange.bind(this);
    this.filterValues = this.filterValues.bind(this);
    this._onOptionToggle = this._onOptionToggle.bind(this);
    this._findOption = this._findOption.bind(this);
    this._findOptionWithParent = this._findOptionWithParent.bind(this);
    this._onOptionClose = this._onOptionClose.bind(this);
    this._removeChildrenFromToggled = this._removeChildrenFromToggled.bind(this);
    this._onOptionSelect = this._onOptionSelect.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this.focus = this.focus.bind(this);
    this.matchCheck = this.props.matchCheck || this.matchCheckFull;
    this.data = {};
    this.searchString = "";
    /**
     * State used to prevent repeating the same automatic scroll when the list is remounted.
     */
    this.focusedOptionScrollState = {
      lastScrolledKey: null,
      lastScrolledIndex: null,
      suppressScroll: false,
    };
    /**
     * Whether focusing and scrolling to the selected option must be retried after its path finishes loading.
     */
    this.pendingSelectedScroll = false;
    /**
     * List of expanded options
     */
    this.toggledOptions = [];
    this.state = {
      options: [],
      initialExpansion: false,
    };
    this.select = React.createRef();
  }

  componentDidMount() {
    this._processOptions();
    const loadingSelectedPath = this._expandSelectedValues();
    this.setState({}, () => {
      const selectedFocused = this._focusSelectedOption(true);
      this.pendingSelectedScroll = loadingSelectedPath || (this._hasSelectedValue() && !selectedFocused);
    });
  }

  componentDidUpdate(prevProps: VirtualizedTreeSelectProps<T, IsMulti, IsClearable>): void {
    if (!optionListsAreEqual(this.props.value, prevProps.value, this.props.valueKey)) {
      this._processOptions();
      const loadingSelectedPath = this._expandSelectedValues();
      this.setState({}, () => {
        const selectedFocused = this._focusSelectedOption(true);
        this.pendingSelectedScroll = loadingSelectedPath || (this._hasSelectedValue() && !selectedFocused);
      });
    } else if (this.props.update! > prevProps.update!) {
      // capture the currently focused option
      const prevFocused = this.select.current && this.select.current.state.focusedOption;
      // Prevents scrolling while options are re-processed after a new page is loaded
      this.focusedOptionScrollState.suppressScroll = true;
      this._processOptions();
      const loadingSelectedPath = this._expandSelectedValues();

      this.setState({}, () => {
        this.focusedOptionScrollState.suppressScroll = false;
        if (this.pendingSelectedScroll || loadingSelectedPath) {
          const selectedFocused = this._focusSelectedOption(true);
          this.pendingSelectedScroll = loadingSelectedPath || (this._hasSelectedValue() && !selectedFocused);
          return;
        }
        this.pendingSelectedScroll = loadingSelectedPath;
        if (prevFocused) {
          const optionToFocus = this._findOption(this.state.options, prevFocused);
          if (optionToFocus) {
            this._focusOption(optionToFocus);
          }
        }
      });
    }
  }

  /**
   * Focuses the first selected option from {@link #props.value}
   *
   * @param forceScroll whether the {@link #focusedOptionScrollState} should be reset to initiate the scroll
   * @returns {boolean} whether the selected option was focused
   * @private
   */
  _focusSelectedOption(forceScroll = false): boolean {
    if (!this._hasSelectedValue()) {
      return false;
    }

    const targetValue = this.props.value![0];
    const option = this._findOption(this.state.options, targetValue);
    if (option) {
      // Initial load and value change should always scroll to the selected option
      if (forceScroll) {
        this.focusedOptionScrollState.lastScrolledKey = null;
        this.focusedOptionScrollState.lastScrolledIndex = null;
      }
      this._focusOption(option);
      return true;
    }
    return false;
  }

  /**
   * Checks whether selected value is present.
   *
   * @returns {boolean} true when there is any selected option
   * @private
   */
  _hasSelectedValue(): boolean {
    return !!(this.props.value && Array.isArray(this.props.value) && this.props.value.length > 0);
  }

  focus() {
    this.select.current!.focus();
  }

  blurInput() {
    if (this.select.current) {
      this.select.current.blur();
    }
  }

  resetOptions() {
    this.setState({options: []});
  }

  _processOptions(): void {
    this.data = {};
    const keys: OptionKey[] = [];
    this.props.options.forEach((option) => {
      const optionID = option[this.props.valueKey];
      // Value property is needed for correct rendering of selected options
      (option as BaseOption).value = optionID;
      this.data[optionID] = option as ProcessedOption<T>;
      keys.push(optionID);
    });

    let options: ProcessedOption<T>[];

    if (this.props.renderAsTree) {
      // Utilize the fact that set has stable iteration order (~ insertion order)
      const sortedArr = new Set<ProcessedOption<T>>();
      keys.forEach((key) => {
        let option = this.data[key];
        if (!option.parent) {
          this._calculateDepth(key, 0, null, new Set(), sortedArr);
        }
      });

      options = [...sortedArr];

      // Expands the whole tree on the initial render
      if (this.props.expanded && !this.state.initialExpansion && options.length > 0) {
        for (const option of options) {
          this.toggledOptions.push(option);
          option.expanded = true;
        }
        this.setState({initialExpansion: true});
      }
    } else {
      // Flat list processing - just use all options without hierarchy
      options = this.props.options.slice() as ProcessedOption<T>[];
      for (const option of options) {
        option.depth = 0;
        option.parent = null;
        option.expanded = false;
        option.visible = true;
      }
    }

    this.setState({options});
  }

  /**
   * Iterates all selected values
   * and expands all their ancestors.
   *
   * @returns {boolean} whether expanding a selected value's path initiated loading
   * @private
   */
  _expandSelectedValues(): boolean {
    if (!this.props.value || !Array.isArray(this.props.value) || this.props.value.length === 0) {
      return false;
    }

    let loadingSelectedPath = false;
    for (let option of this.props.value) {
      const optionId = (option as ProcessedOption<T>)?.[this.props.valueKey] ?? option;
      let parentOption = this.data[optionId]?.parent;

      while (parentOption) {
        // try to lookup an option already present in toggledOptions
        let existingOption = this._findOption(this.toggledOptions, parentOption);
        // add to toggledOptions if not found
        if (existingOption == null) {
          this.toggledOptions.push(parentOption);
          existingOption = parentOption;
        }

        // Trigger loading children of the expanded option ONLY if closed
        if (!existingOption.expanded) {
          loadingSelectedPath = true;
          this.props.onOptionToggle!(existingOption);
          existingOption.expanded = true;
        }

        // move to the next parent
        parentOption = existingOption.parent;
      }
    }
    return loadingSelectedPath;
  }

  /**
   * Finds the {@code searchedOption} in the given {@code dataset}
   * by matching the {@link #props.valueKey}
   *
   * @param dataset the array to search
   * @param searchedOption the option to lookup
   * @returns {any|null} the found option or null
   * @private
   */
  _findOption(
    dataset: ProcessedOption<T>[] | null | undefined,
    searchedOption: ProcessedOption<T> | T | OptionKey | null | undefined
  ): ProcessedOption<T> | null {
    if (!searchedOption || !dataset) return null;
    const targetKey = (searchedOption as ProcessedOption<T>)[this.props.valueKey] ?? searchedOption;
    let options = dataset.filter((el) => el[this.props.valueKey] === targetKey);
    if (options.length === 0) return null;
    if ((searchedOption as ProcessedOption<T>).path) {
      return (
        options.find((option) => arraysAreEqual(option.path, (searchedOption as ProcessedOption<T>).path)) || options[0]
      );
    }
    return options[0];
  }

  _findOptionWithParent(
    dataset: ProcessedOption<T>[],
    searchedOptionKey: OptionKey,
    parent: ProcessedOption<T>
  ): ProcessedOption<T> | undefined {
    let options = dataset.filter((el) => el[this.props.valueKey] === searchedOptionKey);
    return options.find((el) => el?.parent === parent);
  }

  _calculateDepth(
    key: OptionKey,
    depth: number,
    parent: ProcessedOption<T> | null,
    visited: Set<OptionKey>,
    sortedArr: Set<ProcessedOption<T>>
  ): void {
    let option = this.data[key];
    if (!option || visited.has(key)) {
      return;
    }
    //Checks whether the array of items already contain an option with the same valueKey (ID)
    if (sortedArr.has(option)) {
      //Deep copy of option, needed to distinguish option for multiple subtrees
      option = structuredClone(option);
    }

    sortedArr.add(option);
    visited.add(key);

    //Sets the idempotent properties
    option.depth = depth;
    option.parent = parent;
    option.path = [...visited];
    option.expanded = !!this._findOption(this.toggledOptions, option);

    //It can happen that the option is already loaded in the state
    //If so, set the correct expanded value from the state options
    //It is needed to check its full path to determine whether it is the correct option
    let existingOption = this._findOption(this.state.options, option);
    if (existingOption) {
      option.expanded = existingOption.expanded;
    }

    (option[this.props.childrenKey] as OptionKey[]).forEach((childID: OptionKey) => {
      // Create a new set for each child to avoid modifying the parent's visited set - prevent only loops in one tree branch
      this._calculateDepth(childID, depth + 1, option, new Set(visited), sortedArr);
    });
  }

  filterOption(candidate: FilterOptionOption<ProcessedOption<T>>, inputValue: string): boolean | undefined {
    const option = candidate.data;
    inputValue = inputValue.trim().toLowerCase();

    if (!this.props.renderAsTree) {
      return inputValue.length === 0 || option.visible !== false;
    }

    if (inputValue.length === 0) {
      return !option.parent || option.parent?.expanded;
    } else {
      return option.visible;
    }
  }

  filterValues(searchInput: string): void {
    // when the fetch is delayed, it can cause incorrect filter render, this prevents it from happening
    if (this.select.current!.inputRef!.value !== searchInput) {
      searchInput = this.select.current!.inputRef!.value;
    }

    if (searchInput === "") return;

    const matches = [];
    let firstMatch = true;
    for (let option of this.state.options) {
      if (this.matchCheck(searchInput, getLabel(option, this.props.labelKey, this.props.getOptionLabel))) {
        option.visible = true;
        matches.push(option);
        if (firstMatch) {
          this._focusOption(option);
          firstMatch = false;
        }
      } else {
        option.visible = false;
      }
    }
    for (let match of matches) {
      while (match.parent !== null) {
        match = match.parent!;
        match.expanded = true;
        match.visible = true;
      }
    }
    this.forceUpdate();
  }

  matchCheckFull(searchInput: string, optionLabel: string): boolean {
    return optionLabel.toLowerCase().indexOf(searchInput.toLowerCase()) !== -1;
  }

  _onInputChange(input: string): void {
    // Make the expensive calculation only when input has been really changed
    if (this.searchString === input) {
      return;
    }
    if (input.length !== 0) {
      this.filterValues(input);
    }

    this.searchString = input;
    this.props.onInputChange!(input);
    // Collapses items which were expanded by the search
    if (input.length === 0) {
      for (let option of this.state.options) {
        option.expanded = !!this._findOption(this.toggledOptions, option);
      }
    }
  }

  _removeChildrenFromToggled(option?: ProcessedOption<T>): void {
    if (option === undefined) return;
    for (const subTermId of option[this.props.childrenKey]) {
      const subTerm = this._findOptionWithParent(this.state.options, subTermId, option);
      const toggledItem = this._findOption(this.toggledOptions, subTerm);
      this.toggledOptions = this.toggledOptions.filter((term) => term !== toggledItem);
      this._removeChildrenFromToggled(subTerm);
    }
  }

  _onOptionClose(option?: ProcessedOption<T>): void {
    if (option === undefined) return;
    option.expanded = false;
    this._focusOption(option);
    for (const subTermId of option[this.props.childrenKey]) {
      const subTerm = this._findOptionWithParent(this.state.options, subTermId, option);
      this._onOptionClose(subTerm);
    }
  }

  _onOptionToggle(option: ProcessedOption<T>): void {
    // disables option expansion/collapse when search string is present
    if (this.searchString !== "") {
      return;
    }
    this.props.onOptionToggle!(option);

    if (option.expanded) {
      this._onOptionClose(option);
    } else {
      option.expanded = true;
    }

    // Adds/removes references for toggled items
    if (option.expanded) {
      this.toggledOptions.push(option);
    } else {
      const toggledItem = this._findOption(this.toggledOptions, option);
      this.toggledOptions = this.toggledOptions.filter((el) => el !== toggledItem);
      this._removeChildrenFromToggled(option);
    }

    this._focusOption(option);
  }

  //When selecting an option, we want to ensure that the path to it is expanded
  //Path is saved in toggledOptions
  _onOptionSelect(props: SelectOptionProps<T>): void {
    props.selectOption(props.data);
  }

  //When using custom option, it is needed to set focusedOption manually
  _focusOption(option: ProcessedOption<T>): void {
    if (this.select.current) {
      this.select.current.setState({focusedOption: option});
    }
  }

  _onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === " " && !this.searchString) {
      event.preventDefault();
      const focusedOption = this.select.current && this.select.current.state.focusedOption;

      if (focusedOption) {
        this._onOptionToggle(focusedOption);
      }
    }

    // Preserve any onKeyDown prop passed down from parent components
    if (this.props.onKeyDown) {
      this.props.onKeyDown(event);
    }
  }

  render() {
    const props = this.props;
    const styles = this._prepareStyles();
    const filterOptions = (props.filterOption || this.filterOption) as (
      option: FilterOptionOption<ProcessedOption<T>>,
      inputValue: string
    ) => boolean;
    const optionRenderer = this.props.optionRenderer || Option;
    return (
      <TreeAwareSelect<T, IsMulti>
        ref={this.select}
        {...props}
        styles={styles}
        menuIsOpen={this.props.isMenuOpen ? this.props.isMenuOpen : undefined}
        filterOption={filterOptions}
        onInputChange={this._onInputChange}
        getOptionLabel={(option) => getLabel(option, props.labelKey, props.getOptionLabel)}
        getOptionValue={props.getOptionValue ? props.getOptionValue : (option) => option[props.valueKey]}
        components={{
          Option: optionRenderer,
          Menu: Menu,
          MenuList: MenuList,
          MultiValueLabel: this.props.valueRenderer,
          SingleValue: this.props.valueRenderer,
        }}
        isMulti={props.multi}
        blurInputOnSelect={false}
        options={this.state.options}
        focusedOptionScrollState={this.focusedOptionScrollState}
        onOptionToggle={this._onOptionToggle}
        onOptionSelect={this._onOptionSelect}
        onOptionHover={this._focusOption}
        onKeyDown={this._onKeyDown}
        focus={this.focus}
      />
    );
  }

  _prepareStyles(): StylesConfig<ProcessedOption<T>, IsMulti, GroupBase<ProcessedOption<T>>> {
    return {
      dropdownIndicator: (provided: Record<string, any>, state: any) => ({
        ...provided,
        transform: state.selectProps.menuIsOpen && "rotate(180deg)",
        display: !state.selectProps.isMenuOpen ? "flex" : "none",
      }),
      indicatorSeparator: (provided: Record<string, any>, state: any) => ({
        ...provided,
        display: !state.selectProps.isMenuOpen ? "flex" : "none",
      }),
      multiValue: (base: Record<string, any>) => ({
        ...base,
        backgroundColor: "rgba(0, 126, 255, 0.08)",
        border: "1px solid #c2e0ff",
        paddingLeft: Constants.VALUE_MARGIN_X,
      }),
      multiValueRemove: (base: Record<string, any>) => ({
        ...base,
        color: "#007eff",
        cursor: "pointer",
        borderLeft: "1px solid rgba(0,126,255,.24)",
        "&:hover": {
          backgroundColor: "rgba(0,113,230,.08)",
          color: "#0071e6",
        },
        marginLeft: Constants.VALUE_MARGIN_X,
      }),
      noOptionsMessage: (provided: Record<string, any>) => ({
        ...provided,
        paddingLeft: "16px",
      }),
      menu: (provided: Record<string, any>, state: any) => ({
        ...provided,
        position: state.selectProps.menuIsFloating ? "absolute" : "relative",
      }),
      valueContainer: (provided: Record<string, any>, state: any) => ({
        ...provided,
        display: state.hasValue ? "flex" : "inline-grid",
      }),
      input: (provided: Record<string, any>) => ({
        ...provided,
        input: {
          opacity: "1 !important",
        },
      }),
      ...this.props.styles,
    } as StylesConfig<ProcessedOption<T>, IsMulti, GroupBase<ProcessedOption<T>>>;
  }
}

// Wrapper for MenuList, it doesn't do anything, it is only needed for correct passing of the onScroll prop
type InternalMenuProps = MenuProps<ProcessedOption<BaseOption>, boolean, GroupBase<ProcessedOption<BaseOption>>> & {
  selectProps: MenuProps<ProcessedOption<BaseOption>, boolean, GroupBase<ProcessedOption<BaseOption>>>["selectProps"] &
    InjectedRuntimeSelectProps<BaseOption>;
};

const Menu = (props: InternalMenuProps) => {
  return (
    <components.Menu
      {...props}
      innerProps={{
        ...props.innerProps,
        onScrollCapture: (e: React.UIEvent<HTMLElement>) => {
          props.selectProps.listProps!.onScroll!(e.target as HTMLElement);
        },
      }}
    >
      {props.children}
    </components.Menu>
  );
};

// Component for efficient rendering
type InternalMenuListProps = MenuListProps<
  ProcessedOption<BaseOption>,
  boolean,
  GroupBase<ProcessedOption<BaseOption>>
> & {
  selectProps: MenuListProps<
    ProcessedOption<BaseOption>,
    boolean,
    GroupBase<ProcessedOption<BaseOption>>
  >["selectProps"] &
    InjectedRuntimeSelectProps<BaseOption>;
};

const MenuList = (props: InternalMenuListProps) => {
  const {children} = props;
  const {optionHeight, maxHeight, valueKey, focusedOptionScrollState} = props.selectProps;

  /// React-Window List reference
  const listRef = React.useRef<FixedSizeListInstance>(null);

  // We need to check whether the passed object contains items or loading/empty message
  let values: React.ReactElement[];
  let height: number;
  if (Array.isArray(children)) {
    values = children as React.ReactElement[];
    height = Math.min(maxHeight, (optionHeight as number) * values.length);
  } else {
    values = [
      <components.NoOptionsMessage
        {...(children as React.ReactElement).props}
        children={(children as React.ReactElement).props.children}
      />,
    ];
    height = 40;
  }

  /// Scroll to the currently focused option
  React.useLayoutEffect(() => {
    if (!Array.isArray(children) || !listRef.current || focusedOptionScrollState.suppressScroll) {
      return;
    }

    /// The children element to which we should scroll
    let target = (children as React.ReactElement[]).find((child) => child.props?.isFocused);
    if (!target || !target.props?.data) {
      return;
    }

    const optionData = target.props.data;

    const targetKey = getOptionScrollKey(optionData, valueKey);
    const targetIndex = values.indexOf(target);
    if (targetIndex === -1) {
      return;
    }

    if (
      focusedOptionScrollState.lastScrolledKey === targetKey &&
      focusedOptionScrollState.lastScrolledIndex === targetIndex
    ) {
      // no change, do not scroll
      return;
    }

    try {
      listRef.current.scrollToItem(targetIndex, "center");
      focusedOptionScrollState.lastScrolledKey = targetKey!;
      focusedOptionScrollState.lastScrolledIndex = targetIndex;
    } catch (e) {
      // if scroll fails it doesn't matter much
    }
  });

  return React.createElement(
    List as unknown as React.ForwardRefExoticComponent<
      Omit<FixedSizeListProps, "width" | "children"> & React.RefAttributes<FixedSizeListInstance>
    >,
    {
      ref: listRef,
      height: height,
      itemCount: values.length,
      itemSize: optionHeight as number,
      overscanCount: 30,
    },
    (({index, style}: ListChildComponentProps) => (
      <div style={style}>{values[index]}</div>
    )) as unknown as React.ReactNode
  );
};

VirtualizedTreeSelect.propTypes = {
  autoFocus: PropTypes.bool,
  childrenKey: PropTypes.string,
  expanded: PropTypes.bool,
  filterOption: PropTypes.func,
  matchCheck: PropTypes.func,
  isMenuOpen: PropTypes.bool,
  labelKey: PropTypes.string,
  getOptionLabel: PropTypes.func,
  getOptionValue: PropTypes.func,
  maxHeight: PropTypes.number,
  menuStyle: PropTypes.object,
  minHeight: PropTypes.number,
  multi: PropTypes.bool,
  onInputChange: PropTypes.func.isRequired,
  optionHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.func]),
  optionLeftOffset: PropTypes.number,
  optionRenderer: PropTypes.func,
  options: PropTypes.array,
  renderAsTree: PropTypes.bool,
  valueKey: PropTypes.string,
  hideSelectedOptions: PropTypes.bool,
  menuIsFloating: PropTypes.bool,
  styles: PropTypes.object,
};

VirtualizedTreeSelect.defaultProps = {
  childrenKey: Constants.CHILDREN_KEY,
  labelKey: Constants.LABEL_KEY,
  valueKey: Constants.VALUE_KEY,
  options: [],
  optionHeight: 25,
  optionLeftOffset: 16,
  expanded: false,
  isMenuOpen: false,
  maxHeight: 300,
  minHeight: 0,
  multi: false,
  renderAsTree: true,
  hideSelectedOptions: false,
  menuIsFloating: true,
  styles: {},
};

export {VirtualizedTreeSelect};
