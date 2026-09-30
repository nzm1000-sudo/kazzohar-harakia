// The owner's public contact, shown in "יצירת קשר" (אודות) and used by the accessibility report. One place for both.
export const CONTACT_EMAIL = 'haravbar@gmail.com';
export const CONTACT_PHONE = '058-500-600-4';
export const CONTACT_PHONE_HREF = 'tel:0585006004';
export const CONTACT_LEAD = 'לתגובות, הארות והערות:';
export const mailtoHref = ({ subject, body } = {}) => {
  const query = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join('&');
  return `mailto:${CONTACT_EMAIL}${query ? `?${query}` : ''}`;
};
