import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

interface SingleSelectDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  showSelectedLabel?: boolean;
}

export function SingleSelectDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  error,
  disabled = false,
  showSelectedLabel = false,
}: SingleSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the button and the portal-rendered menu
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);
  const hasValue = value && value !== '';

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="relative" ref={dropdownRef}>
        {/* Main Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-4 py-2.5 bg-white border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-left flex items-center justify-between transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            error
              ? 'border-red-500 focus:border-red-500'
              : isOpen || hasValue
                ? 'border-blue-500 focus:border-blue-600'
                : 'border-gray-300 focus:border-blue-500'
          } ${!disabled && 'hover:border-blue-400'}`}
        >
          <span className={hasValue ? 'text-gray-900' : 'text-gray-500'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {/* Dropdown Menu - Using Portal */}
        {isOpen && !disabled && typeof window !== 'undefined' && createPortal(
          <div 
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              zIndex: 9999
            }}
            className="bg-white border-2 border-blue-500 rounded-lg shadow-2xl max-h-64 overflow-hidden flex flex-col"
          >
            {/* Header with Clear Button */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
              <span className="text-xs font-medium text-gray-700">{label}</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-gray-600 hover:text-gray-800 font-medium"
              >
                Clear
              </button>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto">
              {options.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {/* Custom Checkbox/Radio Visual */}
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 flex-shrink-0 ${
                    option.value === value
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-white border-gray-300'
                  }`}>
                    {option.value === value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-sm text-gray-900">{option.label}</span>
                </label>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Selected Label (Optional) */}
      {showSelectedLabel && hasValue && selectedOption && !error && (
        <div className="px-4 py-2 bg-green-50 border-2 border-green-200 rounded-xl">
          <div className="flex items-center gap-2 text-green-700">
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">
              Selected: {selectedOption.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}