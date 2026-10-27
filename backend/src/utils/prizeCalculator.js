/**
 * Calculates prize distribution for Ludoline games.
 * Platform always takes 2% of the total pot.
 *
 * 2 players:  1st 98%, platform 2%
 * 3 players:  1st 75%, 2nd 23%, platform 2%
 * 4 players:  1st 73.5%, 2nd 19.5%, 3rd 7%, platform 2%
 *             (normalized from 75/20/8 to sum=100 with 2% platform)
 */

const PRIZE_RATIOS = {
  2: [0.98, 0],         // index 0 = 1st place, platform always 2%
  3: [0.75, 0.23, 0],
  4: [0.735, 0.195, 0.07, 0]
};

const PLATFORM_FEE = 0.02;

/**
 * @param {number} totalPot   - Total ETB in the pot
 * @param {number} playerCount - Number of players (2, 3, or 4)
 * @returns {{ prizes: number[], platformFee: number }}
 *   prizes[0] = 1st place payout (ETB, floored to 2 decimals)
 *   prizes[1] = 2nd place payout (0 if 2 players)
 *   prizes[2] = 3rd place payout (0 if <4 players)
 *   platformFee = platform's cut
 */
function calculatePrizes(totalPot, playerCount) {
  if (![2, 3, 4].includes(playerCount)) {
    throw new Error('Player count must be 2, 3, or 4');
  }

  const platformFee = Math.floor(totalPot * PLATFORM_FEE * 100) / 100;
  const distributable = totalPot - platformFee;

  const ratios = PRIZE_RATIOS[playerCount];
  // Normalize ratios (excluding platform) to distributable pot
  const ratioSum = ratios.reduce((a, b) => a + b, 0);

  const prizes = ratios.map((ratio) => {
    if (ratio === 0) return 0;
    return Math.floor((ratio / ratioSum) * distributable * 100) / 100;
  });

  // Handle rounding remainder — give it to 1st place
  const distributed = prizes.reduce((a, b) => a + b, 0) + platformFee;
  const remainder = Math.round((totalPot - distributed) * 100) / 100;
  prizes[0] = Math.round((prizes[0] + remainder) * 100) / 100;

  return { prizes, platformFee };
}

/**
 * Returns a human-readable prize breakdown string.
 */
function prizeBreakdownText(totalPot, playerCount) {
  const { prizes, platformFee } = calculatePrizes(totalPot, playerCount);
  const lines = prizes
    .map((p, i) => p > 0 ? `  ${i + 1}${ordinal(i + 1)} place: ${p} ETB` : null)
    .filter(Boolean);
  lines.push(`  Platform fee: ${platformFee} ETB`);
  return lines.join('\n');
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

module.exports = { calculatePrizes, prizeBreakdownText, PLATFORM_FEE };
