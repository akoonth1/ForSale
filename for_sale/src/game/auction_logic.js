
function calculateAuctionWinner(bids) {
  if (bids.length === 0) {
    return null; // No bids placed
  }

  let highestBid = bids[0];
  for (let i = 1; i < bids.length; i++) {
    if (bids[i].amount > highestBid.amount) {
      highestBid = bids[i];
    }
  }

  return highestBid;
}

export default calculateAuctionWinner;