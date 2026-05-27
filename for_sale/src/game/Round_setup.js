function Round_setup() {
    this.roundNumber = 0
    this.roundPhases = ['Auction Phase', 'Selling Phase', 'End of Round']
}

Round_setup.prototype.startNextRound = function () {
    this.roundNumber += 1
    return this.roundNumber
}

Round_setup.prototype.getRoundNumber = function () {
    return this.roundNumber
}

Round_setup.prototype.getRoundPhases = function () {
    return [...this.roundPhases]
}

export default Round_setup