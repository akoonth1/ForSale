import { useState } from 'react'
import './App.css'
import RedSquare from './RedSquare'
import Card from './Card'
import { useGameContext } from './game/useGameContext.js'

const BID_INCREMENT = 1000

function App() {
  const {
    auctionState = {},
    saleState: rawSaleState = null,
    players = [],
    round = 1,
    stage = 'Auction',
    startingMoney = 0,
    connectionStatus = 'connecting',
    connectedPlayers = 1,
    roomId = '1',
    availablePlayerNumbers = [],
    debugDummyUsers = 0,
    isActivePlayer = false,
    hasJoined = false,
    canConfigureTable = false,
    joinFeedback = '',
    currentPlayerNumber = null,
    joinGame,
    resetRoom,
    selectRoom,
    placeBid,
    fold,
    playProperty,
  } = useGameContext()

  const saleState = rawSaleState ?? {}

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

  const {
    activeSellers = [],
    pendingPlays = {},
    moneyCards = [],
    phase: salePhase = 'selecting',
    roundResults = [],
  } = saleState

  const minNextBid = currentHighBid + BID_INCREMENT
  const [proposedBid, setProposedBid] = useState(minNextBid)

  const currentTurnPlayer = activeBidders[currentTurnIndex] ?? null
  const isMyTurn = isActivePlayer && currentTurnPlayer === currentPlayerNumber
  const iAmFolded = isActivePlayer && currentPlayerNumber !== null && !activeBidders.includes(currentPlayerNumber)
  const currentPlayer = currentPlayerNumber ? players[currentPlayerNumber - 1] : null
  const canPlayProperty =
    stage === 'Selling' &&
    isActivePlayer &&
    currentPlayerNumber !== null &&
    activeSellers.includes(currentPlayerNumber) &&
    !pendingPlays[currentPlayerNumber] &&
    salePhase === 'selecting'
  const selectableProperties = currentPlayer?.propertiesOwned ?? []
  const roundStageLabel = `Round ${round} - ${stage} Stage`
  const playerIdentityLabel = currentPlayerNumber
    ? `You are Player ${currentPlayerNumber}`
    : 'You are Spectator'
  const [wantsActivePlayer, setWantsActivePlayer] = useState(true)
  const [requestedPlayers, setRequestedPlayers] = useState(Math.max(3, players.length || 3))
  const [selectedSeat, setSelectedSeat] = useState('')
  const effectivePlayerCount = canConfigureTable
    ? requestedPlayers
    : Math.max(3, players.length || 3)
  const isRealtimeTableLocked = connectionStatus === 'connected' && !canConfigureTable
  const biddingTurnPrompt = currentTurnPlayer
    ? `Player ${currentTurnPlayer}: increase the bid or fold.`
    : ''
  const showTurnPromptCard =
    stage !== 'Selling' &&
    stage !== 'Complete' &&
    phase === 'bidding' &&
    Boolean(currentTurnPlayer)

  // Keep proposedBid in sync when currentHighBid advances
  const effectiveProposed = Math.max(minNextBid, proposedBid)
  const totalSeats = players.map((_, index) => index + 1)
  const selectableSeats = availablePlayerNumbers.length
    ? availablePlayerNumbers
    : totalSeats
  const occupiedSeats = totalSeats.filter((seatNumber) => !selectableSeats.includes(seatNumber))
  const roomStatusLabel = `Room ${roomId} · ${occupiedSeats.length}/${totalSeats.length} seats taken`
  const selectableRooms = ['1', '2', '3']
  const effectiveSelectedSeat = selectableSeats.includes(Number(selectedSeat))
    ? String(selectedSeat)
    : (selectableSeats[0] ? String(selectableSeats[0]) : '')
  const finalStandings = [...players]
    .map((player, index) => {
      const propertyValue = (player.propertiesOwned ?? []).reduce((sum, property) => sum + (property?.value ?? 0), 0)
      const totalValue = (player.money ?? 0) + propertyValue

      return {
        playerNumber: index + 1,
        player,
        propertyValue,
        totalValue,
      }
    })
    .sort((a, b) => {
      if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue
      return b.player.money - a.player.money
    })

  const topTotal = finalStandings[0]?.totalValue ?? 0
  const winningPlayers = finalStandings.filter((entry) => entry.totalValue === topTotal)
  const winningLabel = winningPlayers.length === 1
    ? `Player ${winningPlayers[0]?.playerNumber} wins!`
    : `Tie between ${winningPlayers.map((entry) => `Player ${entry.playerNumber}`).join(' and ')}`
  const canPlayAgain = connectionStatus !== 'connected' || currentPlayerNumber === 1

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

  function handlePlayProperty(propertyCardId) {
    if (!canPlayProperty) return
    playProperty(propertyCardId)
  }

  function handleJoin(event) {
    event.preventDefault()
    const sanitizedPlayerCount = Math.max(3, Number(effectivePlayerCount) || 3)
    const desiredPlayerNumber = wantsActivePlayer ? Number(effectiveSelectedSeat) : null
    joinGame({
      wantsActivePlayer,
      numberOfPlayers: sanitizedPlayerCount,
      desiredPlayerNumber,
      roomId,
    })
  }

  function handleResetRoom() {
    if (currentPlayerNumber !== 1) return

    const shouldReset = window.confirm('Reset this room and clear all player seats?')
    if (!shouldReset) return

    resetRoom?.()
  }

  function handlePlayAgain() {
    if (!canPlayAgain) return

    const shouldRestart = window.confirm('Start a new game in this room? This will reset player seats.')
    if (!shouldRestart) return

    resetRoom?.()
  }

  if (!hasJoined) {
    return (
      <main className="entry-screen">
        <form className="entry-card" onSubmit={handleJoin}>
          <h1 className="entry-title">Join For Sale</h1>
          <p className="entry-subtitle">Choose your role and table size.</p>

          <p className="room-status-badge">{roomStatusLabel}</p>

          <label className="entry-label" htmlFor="room-select">
            Choose room
          </label>
          <select
            id="room-select"
            className="entry-input"
            value={roomId}
            onChange={(event) => selectRoom?.(event.target.value)}
          >
            {selectableRooms.map((roomNumber) => (
              <option key={roomNumber} value={roomNumber}>
                Room {roomNumber}
              </option>
            ))}
          </select>

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
            disabled={isRealtimeTableLocked}
          />
          {isRealtimeTableLocked && (
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

          {wantsActivePlayer && (
            <>
              <label className="entry-label" htmlFor="seat-select">
                Choose player seat
              </label>
              <select
                id="seat-select"
                className="entry-input"
                value={effectiveSelectedSeat}
                onChange={(event) => setSelectedSeat(event.target.value)}
                disabled={selectableSeats.length === 0}
              >
                {selectableSeats.map((seatNumber) => (
                  <option key={seatNumber} value={seatNumber}>
                    Player {seatNumber}
                  </option>
                ))}
              </select>
              {selectableSeats.length === 0 && (
                <p className="entry-status">All player seats are already chosen. Join as spectator.</p>
              )}
              <p className="entry-status occupied-seat-list">
                Occupied seats: {occupiedSeats.length > 0 ? occupiedSeats.map((seat) => `Player ${seat}`).join(', ') : 'None'}
              </p>
            </>
          )}

          <button
            type="submit"
            className="entry-button"
            disabled={wantsActivePlayer && selectableSeats.length === 0}
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
        {currentPlayerNumber === 1 && (
          <button type="button" className="reset-room-btn" onClick={handleResetRoom}>
            Reset Room
          </button>
        )}
        <p className="game-stage-label">{roundStageLabel}</p>
        <p className="game-stage-presence">Room {roomId}</p>
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

      {showTurnPromptCard && (
        <section className={`turn-prompt-card ${isMyTurn ? 'is-my-turn' : 'is-waiting'}`}>
          <p className="turn-prompt-eyebrow">Auction Turn Prompt</p>
          <h2 className="turn-prompt-title">
            {isMyTurn
              ? 'Your move: increase the bid or fold'
              : `Player ${currentTurnPlayer} must increase the bid or fold`}
          </h2>
          <p className="turn-prompt-body">
            {isMyTurn
              ? `Current high bid is $${currentHighBid.toLocaleString()}. Submit a higher bid or fold to take the lowest property card.`
              : `Waiting for Player ${currentTurnPlayer} to decide.`}
          </p>
        </section>
      )}

      {stage !== 'Selling' && stage !== 'Complete' && (
        <>
          {/* Auction status banner */}
          <div className="bid-controls">
            {phase === 'resolved' ? (
              <p className="bid-label">
                Auction resolved - Player {winner} won {winnerCard?.name} for ${winnerPaid.toLocaleString()}.
                Next round starting soon...
              </p>
            ) : (
              <p className="bid-label">
                Current high bid: ${currentHighBid.toLocaleString()}
                {highBidder ? ` (Player ${highBidder})` : ' - no bids yet'}
                {' · '}
                {biddingTurnPrompt}
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
                  >-</button>
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
                    className="bid-btn submit-bid-btn"
                    onClick={handleRaiseBid}
                    disabled={!isMyTurn}
                  >
                    Submit Bid
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
                {!isMyTurn && (
                  <p className="spectator-note">Waiting for Player {currentTurnPlayer} to increase bid or fold.</p>
                )}
              </>
            )}
            {isActivePlayer && iAmFolded && (
              <p className="spectator-note">You folded this round.</p>
            )}
            {!isActivePlayer && <p className="spectator-note">Spectators cannot place bids.</p>}
          </div>
        </>
      )}

      {stage === 'Selling' && (
        <>
          <div className="bid-controls bid-controls-wide">
            {salePhase === 'resolved' ? (
              <p className="bid-label">Sale resolved. Next sale round starting soon...</p>
            ) : (
              <p className="bid-label">Selling phase: play one property card to compete for money cards.</p>
            )}
          </div>

          {moneyCards.map((moneyCard, i) => (
            <div key={`money-${moneyCard.id}-${i}`} className="property-wrapper">
              <Card
                title={moneyCard.name}
                description={i === 0 ? 'Lowest money payout this round' : `Money card ${i + 1}`}
                price={moneyCard.value}
                category="Money"
                condition="Available"
                seller="Bank"
                datePosted="Just revealed"
              />
            </div>
          ))}

          <div className="bid-controls bid-controls-wide">
            {isActivePlayer && canPlayProperty && (
              <>
                <p className="bid-label">Choose one property card to play:</p>
                <div className="bid-row" style={{ flexWrap: 'wrap' }}>
                  {selectableProperties.map((propertyCard) => (
                    <button
                      key={propertyCard.id}
                      type="button"
                      className="bid-btn"
                      onClick={() => handlePlayProperty(propertyCard.id)}
                    >
                      {propertyCard.name} (${propertyCard.value.toLocaleString()})
                    </button>
                  ))}
                </div>
              </>
            )}
            {isActivePlayer && !canPlayProperty && salePhase === 'selecting' && (
              <p className="spectator-note">
                {pendingPlays[currentPlayerNumber]
                  ? 'You have already selected a property. Waiting for other players.'
                  : 'You are not active in this sale round.'}
              </p>
            )}
            {!isActivePlayer && <p className="spectator-note">Spectators cannot play property cards.</p>}

            {salePhase === 'resolved' && roundResults.length > 0 && (
              <div>
                {roundResults.map((result) => (
                  <p key={`sale-result-${result.playerNumber}`} className="spectator-note">
                    Player {result.playerNumber} played {result.propertyCard?.name} and won {result.moneyCard?.name}
                  </p>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {stage === 'Complete' && (
        <section className="complete-panel">
          <p className="complete-overline">Game Complete</p>
          <h2 className="complete-title">{winningLabel}</h2>
          <p className="complete-subtitle">Final rankings by total value:</p>

          <div className="complete-standings">
            {finalStandings.map((entry) => (
              <p key={`final-standing-${entry.playerNumber}`} className="complete-standing-row">
                #{finalStandings.findIndex((item) => item.playerNumber === entry.playerNumber) + 1} Player {entry.playerNumber}
                {' · '}Total ${entry.totalValue.toLocaleString()}
              </p>
            ))}
          </div>

          <button
            type="button"
            className="play-again-btn"
            onClick={handlePlayAgain}
            disabled={!canPlayAgain}
          >
            Play Again
          </button>

          {!canPlayAgain && (
            <p className="complete-subtitle">Only Player 1 can start the next game for this room.</p>
          )}
        </section>
      )}

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
