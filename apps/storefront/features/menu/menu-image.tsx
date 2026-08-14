import { useState } from "react";

interface MenuImageProps {
  alt: string;
  className: string;
  src: string;
}

export function MenuImage({ alt, className, src }: MenuImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={`${className} food-image--fallback`} role="img" aria-label={alt}>
        <span aria-hidden="true">✦</span>
      </span>
    );
  }

  return <img className={`food-image ${className}`} src={src} alt={alt} onError={() => setFailed(true)} />;
}
