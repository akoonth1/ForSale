
function Turn_control(players) {
    this.turn = 0;
    this.player_turn = 0;
    this.round = 1;
    this.phase = 1;
}

Turn_control.prototype.next_turn = function() {
    this.turn++;
    this.player_turn = (this.player_turn + 1) % players.length; 
    if (this.player_turn === 0) {
        this.round++;
    }       
}

export default Turn_control;