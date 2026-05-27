
export function generatePropertyDeck(size = 30) {
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

export function generateMoneyDeck(size = 30, min = 0, max = 15000, increment = 1000) {
    const deck = [];
    const values = [];

    for (let value = min; value <= max; value += increment) {
        values.push(value);
    }

    for (let i = 1; i <= size; i++) {
        const value = values[(i - 1) % values.length];
        deck.push({
            id: i,
            name: `$${value.toLocaleString()}`,
            value,
            state: "available",
            type: "money",
        });
    }

    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

export default generatePropertyDeck;