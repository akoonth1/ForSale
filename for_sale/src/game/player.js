

class Player {
    constructor(name) {
        this.name = name;
        this.hand = [];
        this.money = 1000; // Starting money for each player
        this.score = 0; // Score based on the value of cards sold
        this.auctionsWon = 0; // Count of auctions won
        this.propertiesOwned = []; // List of properties owned by the player
        this.bankcrupt = false; // Flag to indicate if the player is bankrupt
        this.active = true; // Flag to indicate if the player is still active in the game
    }
}

export default Player;