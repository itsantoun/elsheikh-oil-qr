import { useEffect, useState } from 'react';
import { database } from '../Auth/firebase';
import { ref, onValue } from 'firebase/database';

// LBP amount equal to 1 USD. Kept in one place so every page that shows a
// currency conversion (Customers, Water Filling, ...) stays in sync when
// the rate is updated from Settings.
export const DEFAULT_USD_TO_LBP_RATE = 89000;

export const useExchangeRate = () => {
  const [rate, setRate] = useState(DEFAULT_USD_TO_LBP_RATE);

  useEffect(() => {
    const unsub = onValue(ref(database, 'settings/usdToLbpRate'), (snap) => {
      const val = snap.exists() ? Number(snap.val()) : NaN;
      setRate(Number.isFinite(val) && val > 0 ? val : DEFAULT_USD_TO_LBP_RATE);
    });
    return () => unsub();
  }, []);

  return rate;
};

// Converts a { currency, price } pair into the other currency using the
// given USD→LBP rate.
export const convertPrice = (price, currency, rate) => {
  const amount = Number(price) || 0;
  if (currency === 'USD') return amount * rate;
  return amount / rate;
};

export const formatLBP = (amount) =>
  `${Math.round(amount).toLocaleString('en-US')} LBP`;

export const formatUSD = (amount) =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Comma-formatting for editable number fields (exchange rate, prices). The
// underlying state stays a plain digit string — these only affect display.
export const stripCommas = (value) => String(value ?? '').replace(/,/g, '');

export const formatNumberInput = (value) => {
  const raw = stripCommas(value);
  if (raw === '' || raw === '-') return raw;
  const [intPart, decPart] = raw.split('.');
  if (intPart === '' || isNaN(Number(intPart))) return raw;
  const formattedInt = Number(intPart).toLocaleString('en-US');
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
};
