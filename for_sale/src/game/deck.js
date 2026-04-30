
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

    return deck;
}

export default generateDeck;