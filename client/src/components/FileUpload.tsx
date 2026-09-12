import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
}

export function FileUpload({ 
  onFileSelect, 
  accept = "image/*,video/*", 
  multiple = false, 
  disabled = false, 
  label = "اختر ملفًا أو اسحبه هنا" 
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0]; // Take only the first file if not multiple
    setFileName(file.name);
    onFileSelect(file);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleDrag = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (event.type === "dragleave") {
      setDragActive(false);
    }
  };

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <div
        className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragActive 
            ? 'border-[var(--brand)] bg-[var(--brand-soft)]' 
            : 'border-[#E3E1D8] bg-[#F9F9F9]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDrop={handleDrop}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onClick={openFileDialog}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleChange}
          className="hidden"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
        />
        
        <div className="mb-3 text-[var(--brand)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
        </div>
        
        <p className="text-sm font-medium text-[#1F2A25] mb-1">
          {fileName ? fileName : label}
        </p>
        
        <p className="text-xs text-[#8A938D] mb-3">
          {fileName ? 'انقر لتغيير الملف' : 'PNG, JPG, GIF, MP4 مدعومة'}
        </p>
        
        <Button 
          type="button" 
          variant="outline" 
          className="h-8 rounded-full text-xs font-extrabold"
          disabled={disabled}
        >
          استعراض الملفات
        </Button>
      </div>
    </div>
  );
}