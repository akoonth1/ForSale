import Player from "./player.js";
import generateDeck from "./deck.js";



function gameSetup(numberOfPlayers = 3) {
  // Initialize game state, load assets, set up event listeners, etc.

  const players = [];
  for (let i = 1; i <= numberOfPlayers; i++) {
    players.push(new Player(`Player ${i}`));
  }

  const deck = generateDeck();


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

  players.forEach((player) => {
    player.money = startingMoney;
  });



  
  console.log("Deck:", deck);

  console.log("Game setup complete!");

  return {
    players,
    deck,
    startingMoney,
    round: 1,
    stage: "Auction",
  };
}

export default gameSetup;