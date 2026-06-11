"use client";

import * as React from "react";
import { format } from "date-fns@4.1.0";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps {
  value?: Date | string;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  [key: string]: any; // Allow any props for Figma compatibility
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  ...rest
}: DatePickerProps) {
  // Filter out Figma inspector props
  const filteredProps = Object.keys(rest).reduce((acc, key) => {
    if (!key.startsWith('_fg')) {
      acc[key] = rest[key];
    }
    return acc;
  }, {} as any);
  
  const [date, setDate] = React.useState<Date | undefined>(
    value ? (typeof value === 'string' ? new Date(value) : value) : undefined
  );
  const [inputValue, setInputValue] = React.useState<string>('');
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (value) {
      const newDate = typeof value === 'string' ? new Date(value) : value;
      setDate(newDate);
      // Format to YYYY-MM-DD for input
      const formatted = typeof value === 'string' 
        ? value.split('T')[0] 
        : format(newDate, "yyyy-MM-dd");
      setInputValue(formatted);
    } else {
      setDate(undefined);
      setInputValue('');
    }
  }, [value]);

  const handleSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      const formatted = format(selectedDate, "yyyy-MM-dd");
      setInputValue(formatted);
    } else {
      setInputValue('');
    }
    onChange(selectedDate);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Validate and parse YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsedDate = new Date(value + 'T00:00:00');
      if (!isNaN(parsedDate.getTime())) {
        setDate(parsedDate);
        onChange(parsedDate);
      }
    } else if (value === '') {
      setDate(undefined);
      onChange(undefined);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDate(undefined);
    setInputValue('');
    onChange(undefined);
  };

  const handleCalendarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "w-full px-4 py-2.5 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm",
              disabled && "opacity-50 cursor-not-allowed bg-gray-50",
              className
            )}
            {...filteredProps}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {inputValue && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            )}
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={handleCalendarClick}
                disabled={disabled}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              >
                <CalendarIcon className="h-4 w-4 text-gray-500" />
              </button>
            </PopoverTrigger>
          </div>
        </div>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            initialFocus
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}