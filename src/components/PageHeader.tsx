import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

const HeaderSlotContext = createContext<HTMLElement | null>(null);

export const HeaderSlotProvider = HeaderSlotContext.Provider;

interface PageHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ children, className }) => {
  const slotEl = useContext(HeaderSlotContext);

  const content = (
    <div
      className={`dg-header-content-enter flex w-full flex-wrap items-center justify-between gap-2.5 ${className || ''}`}
    >
      {children}
    </div>
  );

  if (slotEl) {
    return createPortal(content, slotEl);
  }

  return (
    <div className="dg-sticky-header no-print px-4 pt-3 pb-1 md:px-6">
      <header className="dg-persistent-header rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.045)] md:px-5">
        {content}
      </header>
    </div>
  );
};
