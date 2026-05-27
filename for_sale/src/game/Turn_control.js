
function Turn_control(players) {
    this.players = Array.isArray(players) ? players : [];
    this.turn = 0;
    this.player_turn = 0;
    this.round = 1;
    this.phase = 1;
}

Turn_control.prototype.next_turn = function() {
    if (this.players.length === 0) {
        return;
    }

    this.turn++;
    this.player_turn = (this.player_turn + 1) % this.players.length;
    if (this.player_turn === 0) {
        this.round++;
    }       
}

export default Turn_control;