import { useState } from 'react'
import './App.css'
import RedSquare from './RedSquare'
import Card from './Card'
import { useGameContext } from './game/useGameContext.js'

const BID_INCREMENT = 1000

function App() {
  const {
    auctionState = {},
    players = [],
    round = 1,
    stage = 'Auction',
    startingMoney = 0,
    connectionStatus = 'connecting',
    connectedPlayers = 1,
    debugDummyUsers = 0,
    isActivePlayer = false,
    hasJoined = false,
    canConfigureTable = false,
    joinFeedback = '',
    currentPlayerNumber = null,
    joinGame,
    placeBid,
    fold,
  } = useGameContext()

  const {
    activeBidders = [],
    currentTurnIndex = 0,
    currentHighBid = 0,
    highBidder = null,
    playerBids = {},
    cards: auctionCards = [],
    foldedResults = [],
    phase = 'bidding',
    winner = null,
    winnerPaid = 0,
    winnerCard = null,
  } = auctionState

  const minNextBid = currentHighBid + BID_INCREMENT
  const [proposedBid, setProposedBid] = useState(minNextBid)

  const currentTurnPlayer = activeBidders[currentTurnIndex] ?? null
  const isMyTurn = isActivePlayer && currentTurnPlayer === currentPlayerNumber
  const iAmFolded = isActivePlayer && currentPlayerNumber !== null && !activeBidders.includes(currentPlayerNumber)
  const roundStageLabel = `Round ${round} - ${stage} Stage`
  const playerIdentityLabel = currentPlayerNumber
    ? `You are Player ${currentPlayerNumber}`
    : 'You are Spectator'
  const [wantsActivePlayer, setWantsActivePlayer] = useState(true)
  const [requestedPlayers, setRequestedPlayers] = useState(Math.max(3, players.length || 3))
  const effectivePlayerCount = canConfigureTable
    ? requestedPlayers
    : Math.max(3, players.length || 3)

  // Keep proposedBid in sync when currentHighBid advances
  const effectiveProposed = Math.max(minNextBid, proposedBid)

  function adjustProposed(delta) {
    if (!isMyTurn) return
    setProposedBid((prev) => {
      const next = Math.max(minNextBid, prev + delta)
      return Math.min(startingMoney, next)
    })
  }

  function handleRaiseBid() {
    if (!isMyTurn) return
    placeBid(effectiveProposed)
  }

  function handleFold() {
    if (!isMyTurn) return
    fold()
  }

  function handleJoin(event) {
    event.preventDefault()
    const sanitizedPlayerCount = Math.max(3, Number(effectivePlayerCount) || 3)
    joinGame({ wantsActivePlayer, numberOfPlayers: sanitizedPlayerCount })
  }

  if (!hasJoined) {
    return (
      <main className="entry-screen">
        <form className="entry-card" onSubmit={handleJoin}>
          <h1 className="entry-title">Join For Sale</h1>
          <p className="entry-subtitle">Choose your role and table size.</p>

          <label className="entry-label" htmlFor="player-count">
            Number of players (minimum 3)
          </label>
          <input
            id="player-count"
            className="entry-input"
            type="number"
            min={3}
            step={1}
            value={effectivePlayerCount}
            onChange={(event) => setRequestedPlayers(event.target.value)}
            disabled={!canConfigureTable}
          />
          {!canConfigureTable && (
            <p className="entry-status">
              Table is locked by host. Current player count: {Math.max(3, players.length || 3)}
            </p>
          )}

          <div className="entry-toggle-row">
            <label className="entry-toggle">
              <input
                type="radio"
                name="role"
                checked={wantsActivePlayer}
                onChange={() => setWantsActivePlayer(true)}
              />
              Active Player
            </label>
            <label className="entry-toggle">
              <input
                type="radio"
                name="role"
                checked={!wantsActivePlayer}
                onChange={() => setWantsActivePlayer(false)}
              />
              Spectator
            </label>
          </div>

          <button
            type="submit"
            className="entry-button"
            disabled={connectionStatus !== 'connected'}
          >
            Enter Game
          </button>

          <p className="entry-status">Connection: {connectionStatus}</p>
          {debugDummyUsers > 0 && (
            <p className="entry-status">Debug bots active: {debugDummyUsers}</p>
          )}
          {joinFeedback && <p className="entry-error">{joinFeedback}</p>}
        </form>
      </main>
    )
  }

  return (
    <>
      <header className="game-stage-bar">
        <p className="game-stage-label">{roundStageLabel}</p>
        <p className="game-stage-presence">
          {connectionStatus} | players online: {connectedPlayers}
        </p>
        {debugDummyUsers > 0 && (
          <p className="game-stage-presence">Debug bots active: {debugDummyUsers}</p>
        )}
        {joinFeedback && <p className="game-stage-presence">{joinFeedback}</p>}
        <p className="game-stage-presence">{playerIdentityLabel}</p>
        {isActivePlayer && (
          <p className="game-stage-presence">
            {iAmFolded ? 'Folded This Round' : isMyTurn ? 'Your Turn' : 'Waiting...'}
          </p>
        )}
      </header>
      <RedSquare />

      {/* Auction status banner */}
      <div className="bid-controls">
        {phase === 'resolved' ? (
          <p className="bid-label">
            Auction resolved — Player {winner} won {winnerCard?.name} for ${winnerPaid.toLocaleString()}.
            Next round starting soon…
          </p>
        ) : (
          <p className="bid-label">
            Current high bid: ${currentHighBid.toLocaleString()}
            {highBidder ? ` (Player ${highBidder})` : ' — no bids yet'}
            {' · '}
            {currentTurnPlayer ? `Player ${currentTurnPlayer}'s turn` : ''}
          </p>
        )}
      </div>

      {/* Cards up for auction */}
      {auctionCards.map((property, i) => (
        <div key={property.id} className="property-wrapper">
          <Card
            title={property.name}
            description={i === 0 ? 'Next to fold takes this' : `Auction card ${i + 1}`}
            price={property.value}
            category="Property"
            condition="Available"
            seller="Bank"
            datePosted="Just generated"
          />
        </div>
      ))}

      {/* Bid / fold controls */}
      <div className="bid-controls">
        {isActivePlayer && !iAmFolded && phase === 'bidding' && (
          <>
            <span className="bid-label">Your Bid (min ${minNextBid.toLocaleString()})</span>
            <div className="bid-row">
              <button
                className="bid-btn"
                onClick={() => adjustProposed(-BID_INCREMENT)}
                disabled={!isMyTurn || effectiveProposed <= minNextBid}
              >−</button>
              <span className="bid-amount">${effectiveProposed.toLocaleString()}</span>
              <button
                className="bid-btn"
                onClick={() => adjustProposed(BID_INCREMENT)}
                disabled={!isMyTurn || effectiveProposed >= startingMoney}
              >+</button>
            </div>
            <div className="bid-row">
              <button
                type="button"
                className="bid-btn"
                onClick={handleRaiseBid}
                disabled={!isMyTurn}
              >
                Raise Bid
              </button>
              <button
                type="button"
                className="give-up-btn"
                onClick={handleFold}
                disabled={!isMyTurn}
              >
                Fold (take worst card, pay ${Math.floor(effectiveProposed / 2000) * 1000 > 0
                  ? `$${(Math.floor(playerBids[currentPlayerNumber] / 2000) * 1000).toLocaleString()}`
                  : '$0'})
              </button>
            </div>
            {!isMyTurn && <p className="spectator-note">Waiting for Player {currentTurnPlayer} to act.</p>}
          </>
        )}
        {isActivePlayer && iAmFolded && (
          <p className="spectator-note">You folded this round.</p>
        )}
        {!isActivePlayer && <p className="spectator-note">Spectators cannot place bids.</p>}
      </div>

      <footer className="player-status-bar">
        {players.map((player, index) => {
          const playerNumber = index + 1
          const isCurrentPlayer = playerNumber === currentPlayerNumber
          const isTurnPlayer = playerNumber === currentTurnPlayer
          const foldResult = foldedResults.find((r) => r.playerNumber === playerNumber)

          return (
            <div
              key={player.name}
              className={`player-status-row ${isCurrentPlayer ? 'is-current-player' : ''}`}
            >
              <span className="player-status-name">
                {player.name}
                {isCurrentPlayer && <span className="player-number-badge">You</span>}
                {isTurnPlayer && phase === 'bidding' && <span className="player-number-badge">Turn</span>}
              </span>
              <span className="player-status-funds">${player.money.toLocaleString()}</span>
              <span className="player-round-status">
                <span
                  className={`player-round-dot ${activeBidders.includes(playerNumber) ? 'is-active' : 'is-inactive'}`}
                  aria-label={activeBidders.includes(playerNumber) ? 'Still bidding' : 'Folded'}
                  title={activeBidders.includes(playerNumber) ? 'Still bidding' : 'Folded'}
                />
                {activeBidders.includes(playerNumber)
                  ? `Bid: $${(playerBids[playerNumber] ?? 0).toLocaleString()}`
                  : foldResult
                    ? `Folded (paid $${foldResult.paid.toLocaleString()})`
                    : winner === playerNumber
                      ? `Won (paid $${winnerPaid.toLocaleString()})`
                      : 'Folded'}
              </span>
              <div className="player-status-properties">
                {player.propertiesOwned.length === 0 ? (
                  <span className="player-no-props">No properties</span>
                ) : (
                  player.propertiesOwned.map((prop) => (
                    <span key={prop.id ?? prop.name} className="player-prop-badge">
                      {prop.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </footer>
    </>
  )
}

export default App
