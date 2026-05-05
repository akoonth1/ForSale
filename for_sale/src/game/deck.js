
export function generateDeck(size = 30) {
    const deck = [];

    for (let i = 1; i <= size; i++) {
        deck.push({
            id: i,
            name: `Property ${i}`,
            value: i * 1000,
            state: "available",
        });
    }

    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

export default generateDeck;