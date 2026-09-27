// A Tanakh reference as the eye reads it: book and chapter at full size, each verse number after its comma a little
// smaller — "דברים ל״ג, א׳–ל״ד, י״ב". Takes an already formatted Hebrew reference (formatTanakhReferences).
export default function TanakhRefText({ text }) {
  const value = String(text || '');
  if (!value) return null;
  return <span className="tanakh-ref">{value.split(/(, [^\s·–,]+)/).map((part, index) => (part.startsWith(', ')
    ? <span key={index}>, <span className="ref-verse">{part.slice(2)}</span></span>
    : part))}</span>;
}
