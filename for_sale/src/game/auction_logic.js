
export const BID_INCREMENT = 1000;

/**
 * Remove `count` cards from the front of the deck (mutates deck in-place).
 * Returns them sorted worst→best (index 0 = lowest value).
 */
export function dealAuctionRound(deck, count) {
  const cards = deck.splice(0, count);
  return cards.sort((a, b) => a.value - b.value);
}

/**
 * Initialise a fresh auction round.
 * @param {number[]} playerNumbers - active player numbers in turn order
 * @param {object[]} cards - sorted worst→best
 */
export function startAuction(playerNumbers, cards) {
  return {
    activeBidders: [...playerNumbers],
    currentTurnIndex: 0,
    currentHighBid: 0,
    highBidder: null,
    playerBids: Object.fromEntries(playerNumbers.map((n) => [n, 0])),
    cards: [...cards],
    foldedResults: [],
    phase: 'bidding',
    winner: null,
    winnerPaid: 0,
    winnerCard: null,
  };
}

/**
 * A player raises the bid. Returns { state } on success or { error } on failure.
 * @param {object} state - current auctionState
 * @param {number} playerNumber
 * @param {number} amount - proposed bid (must be > currentHighBid, multiple of BID_INCREMENT)
 * @param {object[]} players - game players array (to validate funds)
 */
export function processBid(state, playerNumber, amount, players) {
  if (state.phase !== 'bidding') return { error: 'Auction is not in bidding phase' };

  const turnPlayer = state.activeBidders[state.currentTurnIndex];
  if (turnPlayer !== playerNumber) return { error: 'Not your turn' };
  if (amount % BID_INCREMENT !== 0) return { error: 'Bid must be a multiple of 1000' };
  if (amount <= state.currentHighBid) return { error: 'Bid must exceed the current high bid' };

  const player = players[playerNumber - 1];
  if (player && amount > player.money) return { error: 'Insufficient funds' };

  const nextState = {
    ...state,
    playerBids: { ...state.playerBids, [playerNumber]: amount },
    currentHighBid: amount,
    highBidder: playerNumber,
    currentTurnIndex: (state.currentTurnIndex + 1) % state.activeBidders.length,
  };

  return { state: nextState };
}

/**
 * A player folds. They take the worst remaining card and pay half their bid
 * rounded down to the nearest 1000. Mutates `players` money/properties.
 * Returns { state } on success or { error } on failure.
 */
export function processFold(state, playerNumber, players) {
  if (state.phase !== 'bidding') return { error: 'Auction is not in bidding phase' };

  const turnPlayer = state.activeBidders[state.currentTurnIndex];
  if (turnPlayer !== playerNumber) return { error: 'Not your turn' };

  // Can't fold if you are the last bidder — you already won.
  if (state.activeBidders.length === 1) return { error: 'You are the last bidder; you have already won' };

  const remainingBidders = state.activeBidders.filter((n) => n !== playerNumber);
  const remainingCards = [...state.cards];

  // Folder takes worst remaining card
  const takenCard = remainingCards.shift();
  const bid = state.playerBids[playerNumber];
  // Half of bid, rounded down to nearest 1000
  const paid = Math.floor(bid / 2000) * 1000;

  const player = players[playerNumber - 1];
  if (player) {
    player.money -= paid;
    player.propertiesOwned.push(takenCard);
    player.active = false;
  }

  // Advance turn: removing the current index shifts following players left,
  // so % new-length naturally points to the next player in order.
  const nextTurnIndex = state.currentTurnIndex % remainingBidders.length;

  let nextState = {
    ...state,
    activeBidders: remainingBidders,
    cards: remainingCards,
    foldedResults: [
      ...state.foldedResults,
      { playerNumber, card: takenCard, paid },
    ],
    currentTurnIndex: nextTurnIndex,
    phase: 'bidding',
  };

  // If only one bidder remains, resolve immediately.
  if (remainingBidders.length === 1) {
    nextState = resolveAuction(nextState, players);
  }

  return { state: nextState };
}

/**
 * Award the best remaining card to the sole surviving bidder, who pays the
 * current high bid in full. Mutates the winning player. Returns updated state.
 */
export function resolveAuction(state, players) {
  const winner = state.activeBidders[0];
  const bestCard = state.cards[state.cards.length - 1];

  const player = players[winner - 1];
  if (player) {
    player.money -= state.currentHighBid;
    player.propertiesOwned.push(bestCard);
    player.active = false;
  }

  return {
    ...state,
    cards: [],
    phase: 'resolved',
    winner,
    winnerPaid: state.currentHighBid,
    winnerCard: bestCard,
  };
}

export default { startAuction, processBid, processFold, resolveAuction, dealAuctionRound, BID_INCREMENT };
