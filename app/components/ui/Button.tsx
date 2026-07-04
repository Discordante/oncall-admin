import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. @default "primary" */
  variant?: ButtonVariant;
  /** Size preset. @default "md" */
  size?: ButtonSize;
  /** Show a loading spinner and disable the button. */
  loading?: boolean;
  /** Icon or element placed before the label. */
  leftIcon?: ReactNode;
  /** Icon or element placed after the label. */
  rightIcon?: ReactNode;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 active:bg-indigo-700 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 " +
    "dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:active:bg-indigo-600 dark:focus-visible:outline-indigo-500",

  secondary:
    "bg-gray-100 text-gray-700 shadow-xs hover:bg-gray-200 active:bg-gray-300 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 " +
    "dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500 " +
    "dark:focus-visible:outline-gray-500",

  outline:
    "border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 active:bg-gray-100 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 " +
    "dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700 " +
    "dark:focus-visible:outline-gray-500",

  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 " +
    "dark:text-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700 " +
    "dark:focus-visible:outline-gray-500",

  danger:
    "bg-red-600 text-white shadow-xs hover:bg-red-500 active:bg-red-700 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 " +
    "dark:bg-red-700 dark:hover:bg-red-600 dark:active:bg-red-800 dark:focus-visible:outline-red-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

// ---------------------------------------------------------------------------
// Loading spinner
// ---------------------------------------------------------------------------

function Spinner({ size }: { size: ButtonSize }) {
  const dimension = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <svg
      className={`animate-spin ${dimension}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      className = "",
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          // Layout
          "inline-flex items-center justify-center font-medium rounded-lg",
          // Transitions
          "transition-all duration-150 ease-in-out",
          // Cursor
          isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          // Variant + size
          variantStyles[variant],
          sizeStyles[size],
          // Extra classes
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {loading && <Spinner size={size} />}
        {!loading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = "Button";
