import React, { useCallback, useState } from 'react';
import { 
  DocumentIcon, 
  PhotoIcon, 
  XMarkIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';

interface FileUploaderProps {
  onFileSelect: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // en bytes
  accept?: string[];
  multiple?: boolean;
  preview?: boolean;
  className?: string;
}

export const FileUploader = ({
  onFileSelect,
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024, // 5MB por defecto
  accept = ['*'],
  multiple = true,
  preview = true,
  className = '',
}: FileUploaderProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    if (maxSize && file.size > maxSize) {
      setError(`El archivo ${file.name} excede el tamaño máximo permitido`);
      return false;
    }

    if (accept[0] !== '*' && !accept.some(type => file.type.startsWith(type))) {
      setError(`El tipo de archivo ${file.type} no está permitido`);
      return false;
    }

    return true;
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles = Array.from(newFiles)
      .filter(validateFile)
      .slice(0, maxFiles - files.length);

    if (validFiles.length) {
      const updatedFiles = multiple ? [...files, ...validFiles] : validFiles;
      setFiles(updatedFiles);
      onFileSelect(updatedFiles);
      setError(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [files.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onFileSelect(updatedFiles);
  };

  const renderPreview = (file: File, index: number) => {
    const isImage = file.type.startsWith('image/');

    return (
      <div
        key={index}
        className="relative group p-2 border border-gray-200 rounded-lg"
      >
        <button
          onClick={() => removeFile(index)}
          className="absolute top-1 right-1 p-1 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <XMarkIcon className="w-4 h-4 text-gray-500" />
        </button>

        <div className="w-20 h-20 relative">
          {isImage ? (
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded">
              <DocumentIcon className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500 truncate max-w-[80px]">
          {file.name}
        </p>
      </div>
    );
  };

  return (
    <div className={className}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-6
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          transition-colors
        `}
      >
        <input
          type="file"
          onChange={(e) => handleFiles(e.target.files)}
          multiple={multiple}
          accept={accept.join(',')}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="text-center">
          <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4 flex text-sm leading-6 text-gray-600">
            <label className="relative cursor-pointer rounded-md bg-white font-semibold text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 hover:text-blue-500">
              <span>Sube un archivo</span>
            </label>
            <p className="pl-1">o arrastra y suelta</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {accept[0] === '*' ? 'Cualquier tipo de archivo' : `${accept.join(', ')}`}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {preview && files.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-4">
          {files.map((file, index) => renderPreview(file, index))}
        </div>
      )}
    </div>
  );
}; 