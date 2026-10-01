// The one ornament under a centred title (docs/design-system.md › Section header): two gold rules fading out from the
// centre, a dot on either side and a diamond whose gold turns slowly — the bar first drawn under "אותיות 26". Every
// heading bar in the app is this component; styles in ui.css › TitleOrnament. Decorative only: hidden from readers.
export default function TitleOrnament({ className = '' }) {
  return <span className={`title-ornament${className ? ` ${className}` : ''}`} aria-hidden="true"><b /><i /><b /></span>;
}
