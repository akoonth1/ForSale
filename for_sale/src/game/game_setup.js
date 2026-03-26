
import Player from "./player";



 function gameSetup(numberOfPlayers = 3) {
  // Initialize game state, load assets, set up event listeners, etc.

  let players = [];  
  for (let i = 1; i <= numberOfPlayers; i++) {
    players.push(new Player(`Player ${i}`));
  }


   let deck = []; // Initialize the deck of cards (properties for sale)
  
   for (let i = 1; i <= 30; i++) {
    deck.push({
      id: i,
      name: `Property ${i}`,
      value: Math.floor(Math.random() * 1000) + 100, // Random value between 100 and 1100
    });
  }


  console.log("Players:", players);

  let startingMoney = 28000; // Default starting money for each player

  if (numberOfPlayers === 3) {
    startingMoney = 28000;
  } else if (numberOfPlayers === 4) {
    startingMoney = 21000;
  }
  else if (numberOfPlayers === 5) {
    startingMoney = 17000;
  }

    players[0].money = startingMoney;
    players[1].money = startingMoney;
    players[2].money = startingMoney;



  


  console.log("Game setup complete!");
}

export default gameSetup;