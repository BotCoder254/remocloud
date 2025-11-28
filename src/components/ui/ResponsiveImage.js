import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import transformService from '../../services/transforms';

const ResponsiveImage = ({ 
  fileId, 
  alt, 
  className = '', 
  breakpoints = [300, 600, 900, 1200],
  format = 'webp',
  fallbackFormat = 'jpeg',
  sizes = '(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw',
  loading = 'lazy',
  onLoad,
  onError
}) => {
  const [imageError, setImageError] = useState(false);
  const [currentFormat, setCurrentFormat] = useState(format);

  // Get srcset data
  const { data: srcsetData, isLoading } = useQuery({
    queryKey: ['srcset', fileId, breakpoints.join(','), currentFormat],
    queryFn: () => transformService.getSrcSet(fileId, { 
      breakpoints: breakpoints.join(','), 
      format: currentFormat 
    }),
    enabled: !!fileId && !imageError,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000 // 30 minutes
  });

  // Fallback to JPEG if WebP fails
  const handleImageError = (e) => {
    if (currentFormat === format && fallbackFormat !== format) {
      setCurrentFormat(fallbackFormat);
      setImageError(false);
    } else {
      setImageError(true);
      if (onError) onError(e);
    }
  };

  const handleImageLoad = (e) => {
    setImageError(false);
    if (onLoad) onLoad(e);
  };

  if (isLoading) {
    return (
      <div className={`bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (imageError || !srcsetData) {
    return (
      <div className={`bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-sm">Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={srcsetData.entries[0]?.url} // Fallback to smallest image
      srcSet={srcsetData.srcset}
      sizes={sizes}
      alt={alt}
      className={className}
      loading={loading}
      onLoad={handleImageLoad}
      onError={handleImageError}
    />
  );
};

export default ResponsiveImage;