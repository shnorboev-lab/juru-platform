import { clsx } from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-offset-2',
        {
          'bg-[#C30017] text-white hover:bg-[#9c0012] focus-visible:ring-[#C30017]': variant === 'primary',
          'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-gray-400': variant === 'secondary',
          'text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400': variant === 'ghost',
          'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500': variant === 'danger',
          'px-3 py-1.5 text-sm gap-1.5': size === 'sm',
          'px-4 py-2 text-sm gap-2':     size === 'md',
          'px-6 py-3 text-base gap-2':   size === 'lg',
          'opacity-60 cursor-not-allowed': disabled || loading,
        },
        className
      )}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
