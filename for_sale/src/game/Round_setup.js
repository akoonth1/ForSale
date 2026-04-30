

function Round_setup() {
 let roundNumber = 0; // Initialize the round number
 let rooundPhases = ["Auction Phase", "Selling Phase", "End of Round"]; 
        roundNumber++;
        console.log(`Starting Round ${roundNumber}`);
        // Additional logic to set up the round can be added here
    }

    this.getRoundNumber = function() {
        return roundNumber;
    }

}

export default Round_setup;