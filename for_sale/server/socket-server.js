import { createServer } from 'node:http'
import { Server } from 'socket.io'
import gameSetup from '../src/game/game_setup.js'
import { startAuction, dealAuctionRound, processBid, processFold, BID_INCREMENT } from '../src/game/auction_logic.js'

const PORT = process.env.PORT || 3001
const MIN_PLAYERS = 3
const DEBUG_DUMMY_USER_COUNT = 2

function dealFirstRound(game, numberOfPlayers) {
  const playerNumbers = Array.from({ length: numberOfPlayers }, (_, i) => i + 1)
  const cards = dealAuctionRound(game.deck, numberOfPlayers)
  return startAuction(playerNumbers, cards)
}

function buildSharedState(numberOfPlayers) {
  const game = gameSetup(numberOfPlayers)
  const auctionState = dealFirstRound(game, numberOfPlayers)
  return { game, auctionState }
}

const sharedState = buildSharedState(MIN_PLAYERS)
const playerAssignments = new Map()
let dummyPlayerNumbers = []
let hostSocketId = null

const httpServer = createServer()

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

function getPublicState() {
  return {
    ...sharedState.game,
    auctionState: sharedState.auctionState,
    connectedPlayers: io.engine.clientsCount + dummyPlayerNumbers.length,
    activePlayers:
      [...playerAssignments.values()].filter(Boolean).length +
      dummyPlayerNumbers.length,
    debugDummyUsers: dummyPlayerNumbers.length,
  }
}

function getUsedPlayerNumbers() {
  return new Set([...playerAssignments.values(), ...dummyPlayerNumbers].filter(Boolean))
}

function refreshDummyUsers() {
  const maxPlayers = sharedState.game.players.length
  const realPlayerSlots = Math.max(1, maxPlayers - DEBUG_DUMMY_USER_COUNT)
  const maxDummySlots = Math.max(0, maxPlayers - realPlayerSlots)
  const dummySlots = Math.min(DEBUG_DUMMY_USER_COUNT, maxDummySlots)

  dummyPlayerNumbers = Array.from({ length: dummySlots }, (_, index) => {
    return maxPlayers - index
  })
}

function assignPlayerNumber() {
  const maxPlayers = sharedState.game.players.length
  const usedNumbers = getUsedPlayerNumbers()

  for (let playerNumber = 1; playerNumber <= maxPlayers; playerNumber += 1) {
    if (!usedNumbers.has(playerNumber)) {
      return playerNumber
    }
  }

  return null
}

function resetGame(numberOfPlayers) {
  const nextPlayers = Math.max(MIN_PLAYERS, Number(numberOfPlayers) || MIN_PLAYERS)
  const nextState = buildSharedState(nextPlayers)
  sharedState.game = nextState.game
  sharedState.auctionState = nextState.auctionState
  playerAssignments.clear()
  refreshDummyUsers()
}

/** Start the next auction round after the previous one resolves. */
function advanceAuctionRound() {
  const numberOfPlayers = sharedState.game.players.length
  if (sharedState.game.deck.length < numberOfPlayers) {
    sharedState.game.stage = 'Selling'
    return
  }
  sharedState.game.players.forEach((p) => { p.active = true })
  sharedState.game.round = (sharedState.game.round || 1) + 1
  const playerNumbers = Array.from({ length: numberOfPlayers }, (_, i) => i + 1)
  const cards = dealAuctionRound(sharedState.game.deck, numberOfPlayers)
  sharedState.auctionState = startAuction(playerNumbers, cards)
}

refreshDummyUsers()

function emitTablePermissions() {
  for (const [socketId] of playerAssignments) {
    const socket = io.sockets.sockets.get(socketId)

    if (socket) {
      socket.emit('table:permissions', {
        canConfigureTable: socketId === hostSocketId,
      })
    }
  }
}

io.on('connection', (socket) => {
  if (!hostSocketId) {
    hostSocketId = socket.id
  }

  playerAssignments.set(socket.id, null)
  socket.emit('game:state', getPublicState())
  emitTablePermissions()
  io.emit('game:presence', { connectedPlayers: io.engine.clientsCount })

  socket.on('game:join', (payload) => {
    const wantsActivePlayer = Boolean(payload?.wantsActivePlayer)
    const requestedCount = Number(payload?.numberOfPlayers)
    const hasAssignedActivePlayers = [...playerAssignments.values()].some(Boolean)
    const canConfigureTable = socket.id === hostSocketId

    if (
      canConfigureTable &&
      Number.isInteger(requestedCount) &&
      requestedCount >= MIN_PLAYERS &&
      requestedCount !== sharedState.game.players.length &&
      !hasAssignedActivePlayers
    ) {
      resetGame(requestedCount)
    }

    let playerNumber = null
    let reason = null

    if (wantsActivePlayer) {
      playerNumber = assignPlayerNumber()
      if (!playerNumber) {
        reason = 'no_active_slots'
      }
    }

    playerAssignments.set(socket.id, playerNumber)

    if (playerNumber) {
      const player = sharedState.game.players[playerNumber - 1]
      if (player) {
        player.active = true
      }
    }

    // Entering the game moves the shared table into bidding phase.
    sharedState.game.stage = 'Bidding'

    socket.emit('player:assigned', {
      playerNumber,
      isActivePlayer: Boolean(playerNumber),
      joined: true,
      reason,
    })
    io.emit('game:state', getPublicState())
  })

  socket.on('game:place_bid', (payload) => {
    const playerNumber = playerAssignments.get(socket.id)
    if (!playerNumber) return

    const amount = Number(payload?.amount)
    if (!Number.isFinite(amount)) return

    const result = processBid(sharedState.auctionState, playerNumber, amount, sharedState.game.players)
    if (result.error) {
      socket.emit('game:error', { message: result.error })
      return
    }

    sharedState.auctionState = result.state
    io.emit('game:state', getPublicState())
  })

  socket.on('game:fold', () => {
    const playerNumber = playerAssignments.get(socket.id)
    if (!playerNumber) return

    const result = processFold(sharedState.auctionState, playerNumber, sharedState.game.players)
    if (result.error) {
      socket.emit('game:error', { message: result.error })
      return
    }

    sharedState.auctionState = result.state

    // Auto-advance to the next round once this auction is resolved.
    if (sharedState.auctionState.phase === 'resolved') {
      setTimeout(() => {
        advanceAuctionRound()
        io.emit('game:state', getPublicState())
      }, 3000)
    }

    io.emit('game:state', getPublicState())
  })

  socket.on('disconnect', () => {
    playerAssignments.delete(socket.id)

    if (socket.id === hostSocketId) {
      hostSocketId = playerAssignments.keys().next().value ?? null
    }

    emitTablePermissions()
    io.emit('game:state', getPublicState())
    io.emit('game:presence', { connectedPlayers: io.engine.clientsCount })
  })
})

httpServer.listen(PORT, () => {
  console.log(`Socket server running on http://localhost:${PORT}`)
})