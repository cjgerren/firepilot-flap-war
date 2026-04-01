export const COIN_PACKS = [
  {
    id: 'coins_100',
    label: '100 Coins',
    coins: 100,
    amount: 199,
  },
  {
    id: 'coins_200',
    label: '200 Coins',
    coins: 200,
    amount: 399,
  },
  {
    id: 'coins_500',
    label: '500 Coins',
    coins: 500,
    amount: 999,
  },
  {
    id: 'coins_1200',
    label: '1200 Coins',
    coins: 1200,
    amount: 1999,
    tag: 'Starter Pack',
  },
  {
    id: 'coins_2500',
    label: '2500 Coins',
    coins: 2500,
    amount: 3999,
    tag: 'Popular',
  },
  {
    id: 'coins_3000',
    label: '3000 Coins',
    coins: 3000,
    amount: 5499,
  },
  {
    id: 'coins_4000',
    label: '4000 Coins',
    coins: 4000,
    amount: 7500,
  },
  {
    id: 'coins_5000',
    label: '5000 Coins',
    coins: 5000,
    amount: 8999,
    tag: 'Best Value',
  },
  {
    id: 'coins_10000',
    label: '10000 Coins',
    coins: 10000,
    amount: 12000,
    tag: 'Whale Pack',
  },
];

export const DIAMOND_PACKS = [
  {
    id: 'diamonds_10',
    label: '10 Diamonds',
    diamonds: 10,
    amount: 199,
  },
  {
    id: 'diamonds_25',
    label: '25 Diamonds',
    diamonds: 25,
    amount: 399,
    tag: 'Starter',
  },
  {
    id: 'diamonds_75',
    label: '75 Diamonds',
    diamonds: 75,
    amount: 999,
    tag: 'Popular',
  },
  {
    id: 'diamonds_150',
    label: '150 Diamonds',
    diamonds: 150,
    amount: 1799,
  },
  {
    id: 'diamonds_300',
    label: '300 Diamonds',
    diamonds: 300,
    amount: 2999,
    tag: 'Best Value',
  },
];

export function formatUsdFromCents(amount) {
  return `$${(amount / 100).toFixed(2)}`;
}

async function createCheckout(pack, userId, currencyType) {
  try {
    if (!pack || typeof pack !== 'object') {
      throw new Error(`Invalid ${currencyType} pack`);
    }

    if (!userId) {
      throw new Error('Missing user id');
    }

    const quantity =
      currencyType === 'diamonds'
        ? pack.diamonds
        : pack.coins;

    if (!quantity || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid ${currencyType} quantity`);
    }

    const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/stripe/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: pack.amount,
          currencyType,
          quantity,
          userId,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to create checkout session');
    }

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    throw new Error('No checkout URL returned');
  } catch (err) {
    console.error('Payment error:', err);
    alert(err.message || 'Unable to start checkout right now.');
  }
}

export async function buyCoins(pack, userId) {
  return createCheckout(pack, userId, 'coins');
}

export async function buyDiamonds(pack, userId) {
  return createCheckout(pack, userId, 'diamonds');
}