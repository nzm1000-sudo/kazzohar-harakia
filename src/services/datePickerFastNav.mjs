import { HDate, months } from '@hebcal/core';

function parseGregorian(day, month, year) {
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const numericYear = Number(year);
  if (!Number.isInteger(numericDay) || !Number.isInteger(numericMonth) || !Number.isInteger(numericYear) || numericYear < 1 || numericYear > 9999 || numericMonth < 1 || numericMonth > 12 || numericDay < 1 || numericDay > 31) {
    throw new RangeError('תאריך לועזי אינו תקין');
  }
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay, 12));
  if (date.getUTCFullYear() !== numericYear || date.getUTCMonth() !== numericMonth - 1 || date.getUTCDate() !== numericDay) {
    throw new RangeError('תאריך לועזי אינו תקין');
  }
  return date;
}

export function monthLabelForPicker(year, month) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat('he-IL', { month: 'long', timeZone: 'UTC' }).format(date);
}

export function buildYearNavigationYears(selectedYear) {
  const year = Number(selectedYear) || new Date().getUTCFullYear();
  return Array.from({ length: 12 }, (_, index) => year - 5 + index);
}

export function clampDayForMonth(day, month, year) {
  const max = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const value = Number(day || 1);
  return Math.min(Math.max(value, 1), max);
}

export function barMitzvahDate(birth) {
  const hd = birth instanceof HDate ? birth : new HDate(birth);
  const year = hd.getFullYear() + 13;
  const leap = ((7 * year + 1) % 19) < 7;
  let month = hd.getMonth();
  if (!leap && month === months.ADAR_II) month = months.ADAR_I;
  const day = Math.min(hd.getDate(), HDate.daysInMonth(month, year));
  const local = new HDate(day, month, year).greg();
  return parseGregorian(local.getDate(), local.getMonth() + 1, local.getFullYear());
}
