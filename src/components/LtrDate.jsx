import { formatGregorianDate } from '../civilDate.mjs';

export default function LtrDate({ value, timeZone = 'UTC', includeDay = true, className = '' }) {
  const text = value instanceof Date ? formatGregorianDate(value, timeZone, includeDay) : formatGregorianDate(value, timeZone, includeDay);
  return <span className={className} dir="ltr" style={{ unicodeBidi: 'isolate', display: 'inline-block' }}>{text}</span>;
}
