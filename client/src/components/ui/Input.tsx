import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = !!props.value || !!props.defaultValue;
    const isFloating = isFocused || hasValue;

    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          id={inputId}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          className={cn(
            'peer w-full border-b bg-transparent pb-2 pt-5 text-sm text-neutral-900 outline-none transition-colors duration-200 placeholder:text-transparent',
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-neutral-300 focus:border-neutral-900',
            className,
          )}
          placeholder={label}
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            'pointer-events-none absolute left-0 transition-all duration-200',
            isFloating
              ? 'top-0 text-2xs text-neutral-500'
              : 'top-5 text-sm text-neutral-400',
          )}
        >
          {label}
        </label>
        {error && (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
