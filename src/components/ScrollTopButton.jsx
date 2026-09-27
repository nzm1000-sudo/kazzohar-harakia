import { useEffect, useState } from 'react';

// A small arrow back to the top, shown once the reader has scrolled well down a long list.
export default function ScrollTopButton({ after = 600, label = 'חזרה לראש העמוד' }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const update = () => setShown(window.scrollY > after);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [after]);
  if (!shown) return null;
  return <button type="button" className="scroll-top-button" aria-label={label} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span aria-hidden="true">↑</span></button>;
}
