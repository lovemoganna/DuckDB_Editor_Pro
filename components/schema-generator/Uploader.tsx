import React, { useState, useRef } from 'react';

interface UploaderProps {
  onDataReady: (data: string, fileName: string) => void;
  isProcessing: boolean;
}

export const Uploader: React.FC<UploaderProps> = ({ onDataReady, isProcessing }) => {
  const [dragOver, setDragOver] = useState(false);
  const [importMode, setImportMode] = useState<'local' | 'url' | 'paste'>('local');
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [uploadContent, setUploadContent] = useState<string>('');

  // Restore missing state from previous edits
  const [url, setUrl] = useState('');
  const [pasteData, setPasteData] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0] as File);
    }
  };

  const parsePreview = (content: string) => {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];

    // Simple CSV parser for preview (comma or pipe)
    const header = lines[0].split(/[,\t|]/).map(h => h.trim().replace(/^"|"$/g, ''));

    return lines.slice(1, 6).map(line => {
      const values = line.split(/[,\t|]/).map(v => v.trim().replace(/^"|"$/g, ''));
      return header.reduce((acc: any, key, i) => {
        acc[key] = values[i] || '';
        return acc;
      }, {});
    });
  };

  const handleFileSelect = (file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv') && !file.name.endsWith('.parquet') && !file.name.endsWith('.json')) {
      alert('Please select a CSV, Parquet or JSON file');
      return;
    }

    setFileSize(file.size);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setUploadContent(content);
      // For large files, this plain text preview might be slow or inaccurate if strictly parquet
      // But for CSV/JSON text it works. For binary we might need different logic.
      try {
        const preview = parsePreview(content);
        setPreviewData(preview);
      } catch (e) {
        setPreviewData([{ error: "Preview unavailable" }]);
      }
    };
    reader.readAsText(file);
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) return;

    try {
      const response = await fetch(url);
      const content = await response.text();
      const fName = url.split('/').pop() || 'remote_data.csv';

      setUploadContent(content);
      setFileName(fName);
      setFileSize(content.length);
      setPreviewData(parsePreview(content));
    } catch (error) {
      alert('Failed to fetch data from URL');
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteData.trim()) return;
    setUploadContent(pasteData);
    setFileName('pasted_data.csv');
    setFileSize(pasteData.length);
    setPreviewData(parsePreview(pasteData));
  };

  const confirmUpload = () => {
    if (uploadContent) {
      onDataReady(uploadContent, fileName);
    }
  };

  const clearFile = () => {
    setPreviewData(null);
    setUploadContent('');
    setFileName('');
    setFileSize(0);
    setUrl('');
    setPasteData('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Mode Selector */}
      <div className="flex justify-center mb-8">
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex gap-1">
          {[
            { id: 'local', label: '本地文件', icon: '💾' },
            { id: 'url', label: '远程URL', icon: '🌐' },
            { id: 'paste', label: '粘贴数据', icon: '📋' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setImportMode(mode.id as any)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${importMode === mode.id
                ? 'bg-black text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <span className="mr-2">{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200">
        {!previewData ? (
          <>
            {importMode === 'local' && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-16 text-center cursor-pointer transition-all duration-300 border-2 border-dashed ${dragOver
                    ? 'bg-blue-50 border-blue-400 scale-[1.02]'
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-gray-400'
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.parquet,.json"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />

                <div className={`text-7xl mb-6 transition-transform duration-300 ${dragOver ? 'scale-110 -rotate-12' : ''}`}>
                  {dragOver ? '📂' : '☁️'}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {dragOver ? 'Drop it here!' : 'Click or Drag to Upload'}
                </h3>
                <p className="text-gray-500 mb-6 text-lg">
                  Support CSV, Parquet, JSON (Max 50MB)
                </p>
                <button className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 transition-transform active:scale-95 shadow-lg shadow-gray-200/50">
                  Select File
                </button>
              </div>
            )}

            {importMode === 'url' && (
              <div className="p-12 text-center bg-gray-50">
                <div className="text-6xl mb-4">🌐</div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Import from URL</h3>
                <div className="flex gap-3 max-w-md mx-auto">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/data.csv"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 bg-white shadow-sm"
                  />
                  <button
                    onClick={handleUrlSubmit}
                    disabled={!url.trim() || isProcessing}
                    className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all font-medium"
                  >
                    Load
                  </button>
                </div>
              </div>
            )}

            {importMode === 'paste' && (
              <div className="p-8 bg-gray-50">
                <textarea
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                  placeholder="Paste CSV data here..."
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 font-mono text-sm text-gray-900 bg-white shadow-inner"
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handlePasteSubmit}
                    disabled={!pasteData.trim() || isProcessing}
                    className="bg-black text-white px-8 py-2 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all font-medium"
                  >
                    Preview Data
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-3xl shadow-sm">
                  📊
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{fileName}</h3>
                  <p className="text-gray-500 text-sm">
                    {(fileSize / 1024).toFixed(1)} KB • {previewData.length} rows preview
                  </p>
                </div>
              </div>
              <button
                onClick={clearFile}
                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
              >
                ✕ Remove
              </button>
            </div>

            {/* Micro Table Preview */}
            <div className="border rounded-xl overflow-hidden mb-8 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium">
                    <tr>
                      {Object.keys(previewData[0] || {}).map(k => (
                        <th key={k} className="px-4 py-3 border-b">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        {Object.values(row).map((v: any, j) => (
                          <td key={j} className="px-4 py-2 text-gray-700 max-w-[200px] truncate">
                            {String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.length > 5 && (
                <div className="bg-gray-50 px-4 py-2 text-center text-xs text-gray-400 border-t">
                  + {previewData.length - 5} more rows...
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <button
                onClick={confirmUpload}
                disabled={isProcessing}
                className="bg-blue-600 text-white px-12 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    ✨ Start AI Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 bg-blue-50 text-blue-600 px-6 py-3 rounded-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
            <span className="font-medium">正在分析数据结构...</span>
          </div>
        </div>
      )}
    </div>
  );
};
