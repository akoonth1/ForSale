

class Player {
    constructor(name) {
        this.name = name;
        this.hand = [];
        this.money = 1000; // Starting money for each player
        this.score = 0; // Score based on the value of cards sold
    }
}

export default Player;