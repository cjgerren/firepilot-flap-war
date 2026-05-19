export type CurrencyType = 'coins' | 'diamonds';

type CoinPack = {
  id: string;
  label: string;
  coins: number;
  amount: number;
};

type DiamondPack = {
  id: string;
  label: string;
  diamonds: number;
  amount: number;
};

export const COIN_PACKS: CoinPack[] = [
  { id: 'coins_100', label: '100 Coins', coins: 100, amount: 199 },
  { id: 'coins_200', label: '200 Coins', coins: 200, amount: 399 },
  { id: 'coins_500', label: '500 Coins', coins: 500, amount: 999 },
  { id: 'coins_1200', label: '1200 Coins', coins: 1200, amount: 1999 },
  { id: 'coins_2500', label: '2500 Coins', coins: 2500, amount: 3999 },
  { id: 'coins_3000', label: '3000 Coins', coins: 3000, amount: 5499 },
  { id: 'coins_4000', label: '4000 Coins', coins: 4000, amount: 7500 },
  { id: 'coins_5000', label: '5000 Coins', coins: 5000, amount: 8999 },
  { id: 'coins_10000', label: '10000 Coins', coins: 10000, amount: 12000 },
];

export const DIAMOND_PACKS: DiamondPack[] = [
  { id: 'diamonds_10', label: '10 Diamonds', diamonds: 10, amount: 199 },
  { id: 'diamonds_25', label: '25 Diamonds', diamonds: 25, amount: 399 },
  { id: 'diamonds_75', label: '75 Diamonds', diamonds: 75, amount: 999 },
  { id: 'diamonds_150', label: '150 Diamonds', diamonds: 150, amount: 1799 },
  { id: 'diamonds_300', label: '300 Diamonds', diamonds: 300, amount: 2999 },
];

export function findCurrencyPack(currencyType: CurrencyType, packId: string) {
  const packs = currencyType === 'diamonds' ? DIAMOND_PACKS : COIN_PACKS;
  return packs.find((pack) => pack.id === packId) || null;
}
