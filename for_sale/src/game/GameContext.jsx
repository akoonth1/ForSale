import { createContext, useContext, useMemo } from "react";
import gameSetup from "./game_setup";

const GameContext = createContext(null);

export function GameProvider({ children, numberOfPlayers = 3 }) {
  const gameState = useMemo(() => gameSetup(numberOfPlayers), [numberOfPlayers]);

  return <GameContext.Provider value={gameState}>{children}</GameContext.Provider>;
}

export function useGameContext() {
  const context = useContext(GameContext);

  if (!context) {
    throw new Error("useGameContext must be used within a GameProvider");
  }

  return context;
}

export default GameContext;
