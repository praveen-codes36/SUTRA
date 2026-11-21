import React, { useId, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

export interface FileDropzoneProps {
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  label,
  hint,
  accept,
  multiple = false,
  onFilesSelected,
  disabled = false,
  className = '',
}) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    onFilesSelected(Array.from(fileList));
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="sr-only"
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-[8px] border border-dashed px-6 py-7 text-center transition-colors ${
          dragging
            ? 'border-[#102D2A] bg-[#E8EFEA]'
            : 'border-[#7B8581] bg-[#F5F2EA]/50 hover:border-[#102D2A]'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <Upload size={22} className="text-[#102D2A]" aria-hidden="true" />
        <label
          htmlFor={inputId}
          className="mt-2 font-display text-[14px] font-semibold text-[#102D2A] cursor-pointer hover:underline"
        >
          {label}
        </label>
        {hint && <p className="mt-1 text-[12px] text-[#5A6560]">{hint}</p>}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded-[4px] border border-[#7B8581] bg-white px-3 py-1.5 text-[13px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer disabled:cursor-not-allowed"
        >
          Choose {multiple ? 'files' : 'file'}
        </button>
      </div>
    </div>
  );
};
