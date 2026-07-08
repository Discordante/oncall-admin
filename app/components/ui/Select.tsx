import { type ReactNode } from "react";
import ReactSelect from "react-select";
import type {
  MultiValue,
  SingleValue,
  ActionMeta,
  GroupBase,
  ClassNamesConfig,
} from "react-select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly chipColor?: string;
  readonly disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Chip color palette — one color per option index
// ---------------------------------------------------------------------------

export const CHIP_COLORS = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

/** Assign a rotating chip color to each option based on its index. */
export function assignChipColors<T extends SelectOption>(options: T[]): T[] {
  return options.map((opt, i) => ({
    ...opt,
    chipColor: CHIP_COLORS[i % CHIP_COLORS.length],
  }));
}

// Base props that don't depend on mode
interface BaseSelectProps {
  /** Label shown above the select. */
  label?: string;
  /** Error message to display. */
  error?: string;
  /** Placeholder text. */
  placeholder?: string;
  /** Whether the field is required (shows asterisk on label). */
  required?: boolean;
  /** Disable the entire control. */
  disabled?: boolean;
  /** Custom render for each option in the menu or in the value. */
  formatOptionLabel?: (option: SelectOption) => ReactNode;
  /** Additional class name for the wrapper. */
  className?: string;
}

// Props for single-select mode
interface SingleSelectProps extends BaseSelectProps {
  mode?: "single";
  options: SelectOption[];
  value?: string;
  onChange?: (value: string, action: ActionMeta<SelectOption>) => void;
}

// Props for multi-select mode
interface MultiSelectProps extends BaseSelectProps {
  mode: "multi";
  options: SelectOption[];
  value?: string[];
  onChange?: (value: string[], action: ActionMeta<SelectOption>) => void;
}

export type SelectProps = SingleSelectProps | MultiSelectProps;

// ---------------------------------------------------------------------------
// Tailwind class names for each react-select part
// ---------------------------------------------------------------------------

/** Maps every react-select slot to Tailwind classes that match regular inputs. */
function buildClassNames(): ClassNamesConfig<SelectOption, boolean, GroupBase<SelectOption>> {
  return {
    control: ({ isFocused }) =>
      `mt-1 block w-full rounded-lg border bg-white px-3 py-1.5 text-sm text-gray-900 ` +
      `placeholder-gray-400 ` +
      `${isFocused ? "border-indigo-500 ring-1 ring-indigo-500" : "border-gray-300"} ` +
      `dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 ` +
      `${isFocused ? "dark:border-indigo-500 dark:ring-1 dark:ring-indigo-500" : "dark:border-gray-600"}`,
    valueContainer: () => "gap-1",
    input: () => "m-0 p-0 text-sm text-gray-900 dark:text-white",
    placeholder: () => "text-sm text-gray-400 dark:text-gray-500",
    singleValue: () => "text-sm text-gray-900 dark:text-white",
    menu: () =>
      "rounded-lg border border-gray-200 bg-white text-sm shadow-lg z-50 " +
      "dark:border-gray-600 dark:bg-gray-800",
    menuList: () => "p-1",
    option: ({ isFocused, isSelected, isDisabled }) =>
      `rounded-md px-3 py-2 text-sm ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ` +
      `${isSelected ? "font-medium" : ""} ` +
      `${isFocused && !isSelected ? "bg-indigo-50 dark:bg-indigo-950" : ""} ` +
      `${isSelected ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-gray-900 dark:text-white"}`,
    multiValue: ({ data }) => {
      const cc = (data as SelectOption).chipColor;
      const base = "rounded-md text-xs font-medium";
      return cc
        ? `${base} ${cc}`
        : `${base} bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300`;
    },
    multiValueLabel: () => "px-1.5 py-0.5",
    multiValueRemove: ({ data }) => {
      const hasColor = !!(data as SelectOption).chipColor;
      return hasColor
        ? "rounded-r-md opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
        : "rounded-r-md text-indigo-500 hover:bg-indigo-200 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900 dark:hover:text-indigo-200";
    },
    indicatorsContainer: () => "gap-0.5",
    clearIndicator: () =>
      "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
    dropdownIndicator: () =>
      "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
    indicatorSeparator: () =>
      "bg-gray-200 dark:bg-gray-600 my-2",
    noOptionsMessage: () =>
      "text-sm text-gray-500 dark:text-gray-400 py-2 px-3",
    loadingMessage: () =>
      "text-sm text-gray-500 dark:text-gray-400 py-2 px-3",
    groupHeading: () =>
      "px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Select(props: SelectProps) {
  const { label, error, required, disabled, className = "" } = props;

  const isMulti = props.mode === "multi";

  // Convert value to react-select format
  const reactValue = isMulti
    ? (props as MultiSelectProps).options.filter((o) =>
        (props as MultiSelectProps).value?.includes(o.value)
      )
    : (props as SingleSelectProps).options.find(
        (o) => o.value === (props as SingleSelectProps).value
      ) ?? null;

  const handleChange = (
    newValue: MultiValue<SelectOption> | SingleValue<SelectOption>,
    actionMeta: ActionMeta<SelectOption>
  ) => {
    if (isMulti) {
      const vals = (newValue as MultiValue<SelectOption>).map((o) => o.value);
      (props as MultiSelectProps).onChange?.(vals, actionMeta);
    } else {
      const val = (newValue as SingleValue<SelectOption>)?.value ?? "";
      (props as SingleSelectProps).onChange?.(val, actionMeta);
    }
  };

  // Wrap custom formatOptionLabel to match react-select's expected signature
  const customFormat = props.formatOptionLabel
    ? (option: SelectOption) => props.formatOptionLabel!(option)
    : undefined;

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <ReactSelect<SelectOption, boolean, GroupBase<SelectOption>>
        isMulti={isMulti}
        options={props.options}
        value={reactValue}
        onChange={handleChange}
        placeholder={props.placeholder ?? "Seleccionar..."}
        isDisabled={disabled}
        isClearable={false}
        isSearchable
        menuPlacement="auto"
        closeMenuOnSelect={!isMulti}
        hideSelectedOptions={false}
        classNames={buildClassNames()}
        formatOptionLabel={customFormat}
        isOptionDisabled={(option) => !!(option as SelectOption).disabled}
        unstyled
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
