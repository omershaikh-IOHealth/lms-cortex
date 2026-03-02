'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function NewBadge({ description }) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  if (process.env.NEXT_PUBLIC_SHOW_NEW_BADGES !== 'true') return null;

  const handleMouseEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.top + r.height / 2, left: r.right + 8 });
    }
    setHovered(true);
  };

  return (
    <span className="inline-flex items-center ml-1 flex-shrink-0">
      {/* Pulsing pill — inline, never clipped */}
      <span
        ref={ref}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cortex-accent text-white animate-pulse cursor-default select-none"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        NEW
      </span>

      {/* Tooltip — rendered in document.body via portal, always on top */}
      {hovered && description && typeof document !== 'undefined' && createPortal(
        <span
          className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 shadow-lg rounded-lg text-xs leading-snug pointer-events-none"
          style={{
            position:  'fixed',
            top:       `${pos.top}px`,
            left:      `${pos.left}px`,
            transform: 'translateY(-50%)',
            zIndex:    99999,
            width:     '200px',
            padding:   '8px 12px',
          }}
        >
          {description}
        </span>,
        document.body
      )}
    </span>
  );
}
