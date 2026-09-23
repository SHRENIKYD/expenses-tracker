import { useEffect, useRef, useState } from 'react';

// The width a chart's card gives it, in CSS pixels, kept current as the card
// resizes. Charts draw in that coordinate space — one viewBox unit per pixel —
// so their labels stay the size the stylesheet gives them. Drawn in a fixed box
// and scaled to the card instead, a 10px label came out at 18px on a wide one.
export default function useElementWidth(initial) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
