import React, { useEffect, useState } from 'react';
import { photoUrl } from '../services/api';

interface EmployeeAvatarProps {
  nama: string;
  foto?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-[13px]',
  lg: 'h-12 w-12 text-base',
};

export const EmployeeAvatar: React.FC<EmployeeAvatarProps> = ({
  nama,
  foto,
  size = 'md',
}) => {
  const src = photoUrl(foto);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  const initial = (nama || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-[#6fa88c] bg-[#ecf5f1] font-bold text-[#0f4833] select-none ${SIZE_CLASSES[size]}`}
      aria-hidden="true"
    >
      {src && !imgFailed ? (
        <img
          src={src}
          alt={nama}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initial
      )}
    </span>
  );
};
