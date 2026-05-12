import { clsx } from 'clsx'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          {...props}
          className={clsx(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition',
            'placeholder:text-gray-400 focus:outline-none focus:ring-2',
            error
              ? 'border-red-300 focus:ring-red-400'
              : 'border-gray-300 focus:ring-[#C30017] focus:border-[#C30017]',
            className
          )}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
