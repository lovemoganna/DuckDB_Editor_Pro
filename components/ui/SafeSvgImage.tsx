import React, { useEffect, useState } from 'react';

interface SafeSvgImageProps {
  svg: string;
  alt: string;
  className?: string;
}

/**
 * Renders generated SVG in the browser's image context. Unlike injecting SVG
 * markup into the document, image-context SVG cannot execute scripts or bind
 * event handlers into the application DOM.
 */
export const SafeSvgImage: React.FC<SafeSvgImageProps> = ({ svg, alt, className }) => {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!svg) {
      setUrl('');
      return;
    }

    const nextUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [svg]);

  if (!url) return null;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      draggable={false}
      referrerPolicy="no-referrer"
    />
  );
};
