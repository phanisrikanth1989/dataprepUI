import { useEffect, useRef, useState, useLayoutEffect } from 'react';

function SubMenu({ item, onClose }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);
  const subRef = useRef(null);
  const itemRef = useRef(null);

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  // Position submenu to the right; flip left if it would overflow
  const [subStyle, setSubStyle] = useState({ top: 0, left: '100%' });
  useLayoutEffect(() => {
    if (open && subRef.current && itemRef.current) {
      const subRect = subRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      if (subRect.right > vw - 8) {
        setSubStyle({ top: 0, right: '100%', left: 'auto' });
      } else {
        setSubStyle({ top: 0, left: '100%' });
      }
    }
  }, [open]);

  return (
    <div
      ref={itemRef}
      className="context-menu__submenu-wrapper"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button className="context-menu__item context-menu__item--has-sub">
        {item.icon && <span className="context-menu__icon">{item.icon}</span>}
        <span className="context-menu__label">{item.label}</span>
        <span className="context-menu__arrow">▸</span>
      </button>
      {open && (
        <div className="context-menu context-menu--sub" ref={subRef} style={subStyle}>
          {item.children.map((child, i) =>
            child.separator ? (
              <div key={i} className="context-menu__separator" />
            ) : (
              <button
                key={i}
                className={`context-menu__item ${child.danger ? 'context-menu__item--danger' : ''} ${child.disabled ? 'context-menu__item--disabled' : ''}`}
                onClick={() => {
                  if (!child.disabled) {
                    child.onClick();
                    onClose();
                  }
                }}
                disabled={child.disabled}
              >
                {child.icon && <span className="context-menu__icon">{child.icon}</span>}
                <span className="context-menu__label">{child.label}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: y, left: x });

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = x;
      let top = y;
      if (left + rect.width > vw - 8) left = vw - rect.width - 8;
      if (top + rect.height > vh - 8) top = vh - rect.height - 8;
      if (left < 8) left = 8;
      if (top < 8) top = 8;
      setPos({ top, left });
    }
  }, [x, y]);

  return (
    <div className="context-menu" ref={menuRef} style={pos}>
      {items.map((item, i) =>
        item.separator ? (
          item.label ? (
            <div key={i} className="context-menu__section">
              <span className="context-menu__section-label">{item.label}</span>
            </div>
          ) : (
            <div key={i} className="context-menu__separator" />
          )
        ) : item.children ? (
          <SubMenu key={i} item={item} onClose={onClose} />
        ) : (
          <button
            key={i}
            className={`context-menu__item ${item.danger ? 'context-menu__item--danger' : ''} ${item.disabled ? 'context-menu__item--disabled' : ''}`}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
          >
            {item.icon && <span className="context-menu__icon">{item.icon}</span>}
            <span className="context-menu__label">{item.label}</span>
            {item.shortcut && (
              <span className="context-menu__shortcut">{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  );
}
