import './App.css'
import RedSquare from './RedSquare'
import Card from './Card'
import { useGameContext } from './game/GameContext.jsx'

function App() {
  const { deck, round = 1, stage = 'Auction', startingMoney = 0 } = useGameContext()
  const visibleCards = deck.slice(0, 3)
  const roundStageLabel = `Round ${round} - ${stage} Stage`
  const startingFundsLabel = `Starting Funds: $${startingMoney.toLocaleString()}`

  return (
    <>
      <header className="game-stage-bar">
        <p className="game-stage-label">{roundStageLabel}</p>
      </header>
      <RedSquare />
      {visibleCards.map((property) => (
        <Card
          key={property.id}
          title={property.name}
          description={`Current status: ${property.state}`}
          price={property.value}
          category="Property"
          condition="Available"
          seller="Bank"
          datePosted="Just generated"
        />
      ))}


  
      <footer className="starting-funds-bar">
        <p className="starting-funds-label">{startingFundsLabel}</p>
      </footer>
    </>
  )
}

export default App
