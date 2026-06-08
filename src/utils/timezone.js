// Egypt timezone helpers
const EGYPT_TZ = 'Africa/Cairo';

export function egyptNow() {
  return new Date().toLocaleString('en-US', { timeZone: EGYPT_TZ });
}

export function egyptTimeString(date = new Date(), options = { hour12: false }) {
  const locale = options.locale || 'en-US';
  delete options.locale;
  return new Date(date).toLocaleTimeString(locale, { ...options, timeZone: EGYPT_TZ });
}

export function egyptDateString(date = new Date(), options = {}) {
  const locale = options.locale || 'en-US';
  delete options.locale;
  return new Date(date).toLocaleDateString(locale, { ...options, timeZone: EGYPT_TZ });
}

export function egyptDateTimeString(date = new Date(), options = {}) {
  const locale = options.locale || 'en-US';
  delete options.locale;
  return new Date(date).toLocaleString(locale, { ...options, timeZone: EGYPT_TZ });
}

export function egyptDateTimeToDate(date = new Date()) {
  // Returns a Date object that represents the same wall-clock time in Egypt
  const str = new Date(date).toLocaleString('en-US', { timeZone: EGYPT_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return new Date(str);
}
