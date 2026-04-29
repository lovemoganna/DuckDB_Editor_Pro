/**
 * AnimatedList - Waterfall list animation component
 *
 * Supports:
 * - Staggered entrance (each item delays incrementally)
 * - Reorder animations when items change (search/filter)
 * - Collapse/expand with smooth sub-item animations
 */

import React, { useEffect, useState, useRef } from 'react';

interface AnimatedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  /** ms delay between each item entrance, default 60 */
  staggerDelay?: number;
  /** initial delay before first item starts, default 50 */
  initialDelay?: number;
  className?: string;
  itemClassName?: string;
  /** If true, re-renders animate from current position (no reset on filter change) */
  preserveOrder?: boolean;
}

export function AnimatedList<T>({
  items,
  renderItem,
  keyExtractor,
  staggerDelay = 60,
  initialDelay = 50,
  className = '',
  itemClassName = '',
  preserveOrder = false,
}: AnimatedListProps<T>) {
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const prevKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const prevKeys = preserveOrder
      ? prevKeysRef.current
      : new Set<string>();

    const newKeys = new Set(items.map(keyExtractor));
    const added = [...newKeys].filter(k => !prevKeys.has(k));

    if (added.length === 0) {
      // All existing items visible
      setVisibleItems(newKeys);
      prevKeysRef.current = newKeys;
      return;
    }

    // Reveal items one by one
    added.forEach((key, idx) => {
      setTimeout(() => {
        setVisibleItems(prev => new Set([...prev, key]));
      }, idx * staggerDelay);
    });

    prevKeysRef.current = newKeys;
  }, [items, keyExtractor, staggerDelay, preserveOrder]);

  return (
    <div className={className}>
      {items.map((item, idx) => {
        const key = keyExtractor(item);
        const isVisible = visibleItems.has(key);

        return (
          <div
            key={key}
            className={`transition-all duration-300 ${
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-3'
            } ${itemClassName}`}
          >
            {renderItem(item, idx)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * AnimatedListItem - Single animated list item wrapper
 */
interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  delay?: number;
  className?: string;
  direction?: 'up' | 'left' | 'right' | 'scale';
}

export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  index,
  delay = 60,
  className = '',
  direction = 'up',
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * delay + 50);
    return () => clearTimeout(t);
  }, [index, delay]);

  const dirClass = {
    up:     'translate-y-3',
    left:   '-translate-x-3',
    right:  'translate-x-3',
    scale:  'scale-95',
  }[direction];

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0 translate-x-0 scale-100' : `opacity-0 ${dirClass}`
      } ${className}`}
      style={visible ? { transitionDelay: `${index * delay}ms` } : {}}
    >
      {children}
    </div>
  );
};

export default AnimatedList;
