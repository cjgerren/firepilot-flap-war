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
    amount: 299,
  },
  {
    id: 'coins_500',
    label: '500 Coins',
    coins: 500,
    amount: 599,
  },
  {
    id: 'coins_1200',
    label: '1200 Coins',
    coins: 1200,
    amount: 1199,
    tag: 'Popular',
  },
  {
    id: 'coins_2500',
    label: '2500 Coins',
    coins: 2500,
    amount: 1999,
    tag: 'Best Value',
  },
  {
    id: 'coins_5000',
    label: '5000 Coins',
    coins: 5000,
    amount: 3499,
  },
];

export function formatUsdFromCents(amount) {
  return `$${(amount / 100).toFixed(2)}`;
}

export async function buyCoins(pack, userId) {
  try {
    if (!pack || typeof pack !== 'object') {
      throw new Error('Invalid coin pack');
    }

    if (!userId) {
      throw new Error('Missing user id');
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
          coins: pack.coins,
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