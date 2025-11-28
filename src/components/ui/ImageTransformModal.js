import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Copy, Settings, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import transformService from '../../services/transforms';

const ImageTransformModal = ({ isOpen, onClose, file }) => {
  const [activeTab, setActiveTab] = useState('presets');
  const [customParams, setCustomParams] = useState({ w: '', h: '', q: 85, format: 'webp' });
  const [selectedPreset, setSelectedPreset] = useState('medium');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Get presets
  const { data: presets } = useQuery({
    queryKey: ['transform-presets'],
    queryFn: () => transformService.getPresets(),
    enabled: isOpen
  });

  const commonPresets = transformService.getCommonPresets();

  // Generate preview when params change
  useEffect(() => {
    if (!isOpen || !file || !transformService.isImage(file.mime_type)) return;

    const generatePreview = async () => {
      setIsGenerating(true);
      try {
        let params;
        if (activeTab === 'presets') {
          params = { preset: selectedPreset };
        } else {
          params = { ...customParams };
          // Remove empty values
          Object.keys(params).forEach(key => {
            if (params[key] === '' || params[key] === null) {
              delete params[key];
            }
          });
        }

        const result = await transformService.getTransformedUrl(file.id, params);
        setPreviewUrl(result.url);
      } catch (error) {
        console.error('Preview generation failed:', error);
      } finally {
        setIsGenerating(false);
      }
    };

    const debounceTimer = setTimeout(generatePreview, 500);
    return () => clearTimeout(debounceTimer);
  }, [isOpen, file, activeTab, selectedPreset, customParams]);

  const handleCopyUrl = async () => {
    if (previewUrl) {
      try {
        await navigator.clipboard.writeText(previewUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        console.error('Copy failed:', error);
      }
    }
  };

  const handleDownload = () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = `${file.original_name}_transformed`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const validateCustomParams = () => {
    return transformService.validateParams(customParams);
  };

  if (!isOpen || !file || !transformService.isImage(file.mime_type)) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <ImageIcon className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Image Transforms
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {file.original_name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row h-full">
            {/* Controls */}
            <div className="lg:w-1/2 p-6 border-r border-gray-200 dark:border-gray-700">
              {/* Tabs */}
              <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('presets')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'presets'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Presets
                </button>
                <button
                  onClick={() => setActiveTab('custom')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'custom'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Settings className="w-4 h-4 inline mr-1" />
                  Custom
                </button>
              </div>

              {/* Presets Tab */}
              {activeTab === 'presets' && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">Choose Preset</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(commonPresets).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedPreset(key)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          selectedPreset === key
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-white">
                          {preset.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {preset.w}×{preset.h} • Q{preset.q} • {preset.format.toUpperCase()}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Tab */}
              {activeTab === 'custom' && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">Custom Parameters</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Width
                      </label>
                      <input
                        type="number"
                        value={customParams.w}
                        onChange={(e) => setCustomParams(prev => ({ ...prev, w: e.target.value }))}
                        placeholder="Auto"
                        min="1"
                        max="2048"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Height
                      </label>
                      <input
                        type="number"
                        value={customParams.h}
                        onChange={(e) => setCustomParams(prev => ({ ...prev, h: e.target.value }))}
                        placeholder="Auto"
                        min="1"
                        max="2048"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Quality: {customParams.q}%
                    </label>
                    <input
                      type="range"
                      value={customParams.q}
                      onChange={(e) => setCustomParams(prev => ({ ...prev, q: parseInt(e.target.value) }))}
                      min="1"
                      max="100"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Format
                    </label>
                    <select
                      value={customParams.format}
                      onChange={(e) => setCustomParams(prev => ({ ...prev, format: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="webp">WebP</option>
                      <option value="jpeg">JPEG</option>
                      <option value="png">PNG</option>
                      <option value="avif">AVIF</option>
                    </select>
                  </div>

                  {/* Validation */}
                  {(() => {
                    const validation = validateCustomParams();
                    if (!validation.isValid) {
                      return (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                          <div className="text-sm text-red-600 dark:text-red-400">
                            {validation.errors.map((error, index) => (
                              <div key={index}>• {error}</div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="lg:w-1/2 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Preview</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleCopyUrl}
                    disabled={!previewUrl || isGenerating}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copySuccess ? 'Copied!' : 'Copy URL'}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={!previewUrl || isGenerating}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <div className="relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
                {isGenerating ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : previewUrl ? (
                  <motion.img
                    key={previewUrl}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    src={previewUrl}
                    alt="Transform preview"
                    className="w-full h-full object-contain"
                    style={{ maxHeight: '400px' }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500">
                    <ImageIcon className="w-12 h-12" />
                  </div>
                )}
              </div>

              {previewUrl && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                  <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
                    {previewUrl}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageTransformModal;