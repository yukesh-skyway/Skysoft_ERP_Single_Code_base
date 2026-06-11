import React from 'react';
import { toast } from 'sonner@2.0.3';

interface ConfirmationOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'destructive';
}

export const showConfirmationToast = ({
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default'
}: ConfirmationOptions) => {
  toast(
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-gray-900">{title}</p>
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => {
            onCancel?.();
            toast.dismiss();
          }}
          className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={() => {
            onConfirm();
            toast.dismiss();
          }}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            variant === 'destructive'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </div>,
    {
      duration: Infinity,
      closeButton: false,
      className: 'p-4',
    }
  );
};
