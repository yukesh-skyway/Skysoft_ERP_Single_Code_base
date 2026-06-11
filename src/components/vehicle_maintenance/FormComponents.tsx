import { UseFormRegister, FieldErrors } from 'react-hook-form@7.55.0';
import { Calendar, ChevronDown } from 'lucide-react';
import { DatePicker } from '../../components/ui/date-picker';

interface FormInputProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  register: UseFormRegister<any>;
  rows?: number;
  className?: string;
}

export function FormInput({ label, name, type = 'text', placeholder, required, disabled, error, register, rows, className = '' }: FormInputProps) {
  const isTextarea = type === 'textarea';
  const Component = isTextarea ? 'textarea' : 'input';
  
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={name} className="block text-sm text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Component
        id={name}
        type={isTextarea ? undefined : type}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        {...register(name, { required: required ? `${label} is required` : false })}
        className={`w-full px-4 py-2.5 border rounded-lg transition-all focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
        } ${disabled ? 'bg-gray-50 cursor-not-allowed text-gray-500' : 'bg-white text-gray-900'}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

interface FormSelectProps {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  error?: string;
  register: UseFormRegister<any>;
  className?: string;
  placeholder?: string;
}

export function FormSelect({ label, name, options, required, disabled, error, register, className = '', placeholder }: FormSelectProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={name} className="block text-sm text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          id={name}
          disabled={disabled}
          {...register(name, { required: required ? `${label} is required` : false })}
          className={`w-full px-4 py-2.5 pr-10 border rounded-lg transition-all focus:outline-none focus:ring-2 appearance-none bg-white ${
            error
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
          } ${disabled ? 'bg-gray-50 cursor-not-allowed text-gray-500' : 'bg-white text-gray-900 cursor-pointer'}`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${
          disabled ? 'text-gray-400' : 'text-gray-500'
        }`} />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

interface FormDatePickerProps {
  label: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  register: UseFormRegister<any>;
  className?: string;
  min?: string;
  max?: string;
  placeholder?: string;
}

export function FormDatePicker({ label, name, required, disabled, error, register, className = '', min, max, placeholder }: FormDatePickerProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={name} className="block text-sm text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          <svg 
            className={`w-5 h-5 ${disabled ? 'text-gray-400' : 'text-blue-600'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <input
          id={name}
          type="date"
          disabled={disabled}
          min={min}
          max={max}
          {...register(name, { required: required ? `${label} is required` : false })}
          className={`w-full pl-11 pr-4 py-2.5 border rounded-lg transition-all focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
          } ${disabled ? 'bg-gray-50 cursor-not-allowed text-gray-500' : 'bg-white text-gray-900 cursor-pointer'}`}
          style={{
            colorScheme: 'light',
          }}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

interface FormTimePickerProps {
  label: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  register: UseFormRegister<any>;
  className?: string;
}

export function FormTimePicker({ label, name, required, disabled, error, register, className = '' }: FormTimePickerProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={name} className="block text-sm text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          id={name}
          type="time"
          disabled={disabled}
          {...register(name, { required: required ? `${label} is required` : false })}
          className={`w-full px-4 py-2.5 pr-10 border rounded-lg transition-all focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
          } ${disabled ? 'bg-gray-50 cursor-not-allowed text-gray-500' : 'bg-white text-gray-900 cursor-pointer'}`}
          style={{
            colorScheme: 'light',
          }}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

interface FormDateTimePickerProps {
  label: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  register: UseFormRegister<any>;
  className?: string;
}

export function FormDateTimePicker({ label, name, required, disabled, error, register, className = '' }: FormDateTimePickerProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={name} className="block text-sm text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        type="datetime-local"
        disabled={disabled}
        {...register(name, { required: required ? `${label} is required` : false })}
        className={`w-full px-4 py-2.5 border rounded-lg transition-all focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
        } ${disabled ? 'bg-gray-50 cursor-not-allowed text-gray-500' : 'bg-white text-gray-900 cursor-pointer'}`}
        style={{
          colorScheme: 'light',
        }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

interface FormCheckboxProps {
  label: string;
  name: string;
  disabled?: boolean;
  register: UseFormRegister<any>;
  className?: string;
  description?: string;
}

export function FormCheckbox({ label, name, disabled, register, className = '', description }: FormCheckboxProps) {
  return (
    <div className={`flex items-start ${className}`}>
      <div className="flex items-center h-5">
        <input
          id={name}
          type="checkbox"
          disabled={disabled}
          {...register(name)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="ml-3">
        <label htmlFor={name} className={`text-sm ${disabled ? 'text-gray-500' : 'text-gray-700 cursor-pointer'}`}>
          {label}
        </label>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// New custom date picker component that integrates with react-hook-form
interface FormDatePickerCustomProps {
  label: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function FormDatePickerCustom({ label, name, required, disabled, error, value, onChange, className = '', placeholder }: FormDatePickerCustomProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={name} className="block text-sm text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <DatePicker
        value={value}
        onChange={(date) => {
          if (date) {
            const formatted = date.toISOString().split('T')[0];
            onChange(formatted);
          } else {
            onChange('');
          }
        }}
        placeholder={placeholder || 'yyyy-mm-dd'}
        disabled={disabled}
        className={error ? 'border-red-500' : ''}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}