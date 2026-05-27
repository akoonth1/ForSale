import { createServer } from 'node:http'
import { Server } from 'socket.io'
import gameSetup from '../src/game/game_setup.js'
import { startAuction, dealAuctionRound, processBid, processFold, BID_INCREMENT } from '../src/game/auction_logic.js'
import { startSaleRound, dealSaleRound, processPlayProperty } from '../src/game/Sale_logic.js'

const PORT = process.env.PORT || 3001
const MIN_PLAYERS = 3
const DEBUG_DUMMY_USER_COUNT = 2
const ROOM_IDS = ['1', '2', '3']
const DEFAULT_ROOM_ID = '1'

function dealFirstRound(game, numberOfPlayers) {
  const startPlayer = game.nextAuctionStarter || 1
  const playerNumbers = Array.from({ length: numberOfPlayers }, (_, i) => ((startPlayer - 1 + i) % numberOfPlayers) + 1)
  const cards = dealAuctionRound(game.deck, numberOfPlayers)
  game.nextAuctionStarter = (startPlayer % numberOfPlayers) + 1
  return startAuction(playerNumbers, cards)
}

function buildSharedState(numberOfPlayers) {
  const game = gameSetup(numberOfPlayers)
  const auctionState = dealFirstRound(game, numberOfPlayers)
  return { game, auctionState, saleState: null }
}

function createRoomState() {
  return {
    sharedState: buildSharedState(MIN_PLAYERS),
    playerAssignments: new Map(),
    dummyPlayerNumbers: [],
    hostSocketId: null,
  }
}

const httpServer = createServer()

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

const roomStates = new Map(ROOM_IDS.map((roomId) => [roomId, createRoomState()]))
const socketRoomAssignments = new Map()

function normalizeRoomId(roomId) {
  const normalized = String(roomId ?? DEFAULT_ROOM_ID)
  return ROOM_IDS.includes(normalized) ? normalized : DEFAULT_ROOM_ID
}

function getRoomSocketCount(roomId) {
  return io.sockets.adapter.rooms.get(roomId)?.size ?? 0
}

function getPublicState(roomState, roomId) {
  const occupiedPlayerNumbers = [...getUsedPlayerNumbers(roomState)].sort((a, b) => a - b)
  const availablePlayerNumbers = roomState.sharedState.game.players
    .map((_, index) => index + 1)
    .filter((playerNumber) => !occupiedPlayerNumbers.includes(playerNumber))

  return {
    ...roomState.sharedState.game,
    auctionState: roomState.sharedState.auctionState,
    saleState: roomState.sharedState.saleState,
    occupiedPlayerNumbers,
    availablePlayerNumbers,
    roomId,
    connectedPlayers: getRoomSocketCount(roomId) + roomState.dummyPlayerNumbers.length,
    activePlayers:
      [...roomState.playerAssignments.values()].filter(Boolean).length +
      roomState.dummyPlayerNumbers.length,
    debugDummyUsers: roomState.dummyPlayerNumbers.length,
  }
}

function getUsedPlayerNumbers(roomState, excludeSocketId = null) {
  const assignedNumbers = [...roomState.playerAssignments.entries()]
    .filter(([socketId]) => socketId !== excludeSocketId)
    .map(([, playerNumber]) => playerNumber)

  return new Set([...assignedNumbers, ...roomState.dummyPlayerNumbers].filter(Boolean))
}

function refreshDummyUsers(roomState) {
  const maxPlayers = roomState.sharedState.game.players.length
  const realPlayerSlots = Math.max(1, maxPlayers - DEBUG_DUMMY_USER_COUNT)
  const maxDummySlots = Math.max(0, maxPlayers - realPlayerSlots)
  const dummySlots = Math.min(DEBUG_DUMMY_USER_COUNT, maxDummySlots)

  roomState.dummyPlayerNumbers = Array.from({ length: dummySlots }, (_, index) => {
    return maxPlayers - index
  })
}

function assignPlayerNumber(roomState, preferredPlayerNumber = null, socketId = null) {
  const maxPlayers = roomState.sharedState.game.players.length
  const usedNumbers = getUsedPlayerNumbers(roomState, socketId)

  if (Number.isInteger(preferredPlayerNumber)) {
    if (preferredPlayerNumber >= 1 && preferredPlayerNumber <= maxPlayers && !usedNumbers.has(preferredPlayerNumber)) {
      return preferredPlayerNumber
    }
    return null
  }

  for (let playerNumber = 1; playerNumber <= maxPlayers; playerNumber += 1) {
    if (!usedNumbers.has(playerNumber)) {
      return playerNumber
    }
  }

  return null
}

function resetGame(roomState, numberOfPlayers) {
  const nextPlayers = Math.max(MIN_PLAYERS, Number(numberOfPlayers) || MIN_PLAYERS)
  const nextState = buildSharedState(nextPlayers)
  roomState.sharedState.game = nextState.game
  roomState.sharedState.auctionState = nextState.auctionState
  roomState.sharedState.saleState = nextState.saleState
  roomState.playerAssignments.clear()
  refreshDummyUsers(roomState)
}

/** Start the next auction round after the previous one resolves. */
function advanceAuctionRound(roomState) {
  const numberOfPlayers = roomState.sharedState.game.players.length
  if (roomState.sharedState.game.deck.length < numberOfPlayers) {
    roomState.sharedState.game.stage = 'Selling'
    roomState.sharedState.game.round = 1

    const sellerNumbers = Array.from({ length: numberOfPlayers }, (_, i) => i + 1)
      .filter((playerNumber) => {
        const player = roomState.sharedState.game.players[playerNumber - 1]
        return Boolean(player?.propertiesOwned?.length)
      })

    if (sellerNumbers.length === 0) {
      roomState.sharedState.game.stage = 'Complete'
      roomState.sharedState.saleState = null
      return
    }

    const moneyCards = dealSaleRound(roomState.sharedState.game.moneyDeck, sellerNumbers.length)
    roomState.sharedState.saleState = startSaleRound(sellerNumbers, moneyCards)
    return
  }
  roomState.sharedState.game.players.forEach((p) => { p.active = true })
  roomState.sharedState.game.round = (roomState.sharedState.game.round || 1) + 1
  const startPlayer = roomState.sharedState.game.nextAuctionStarter || 1
  const playerNumbers = Array.from({ length: numberOfPlayers }, (_, i) => ((startPlayer - 1 + i) % numberOfPlayers) + 1)
  const cards = dealAuctionRound(roomState.sharedState.game.deck, numberOfPlayers)
  roomState.sharedState.game.nextAuctionStarter = (startPlayer % numberOfPlayers) + 1
  roomState.sharedState.auctionState = startAuction(playerNumbers, cards)
}

function advanceSaleRound(roomState) {
  if (!roomState.sharedState.saleState) {
    roomState.sharedState.game.stage = 'Complete'
    return
  }

  const sellerNumbers = roomState.sharedState.saleState.activeSellers.filter((playerNumber) => {
    const player = roomState.sharedState.game.players[playerNumber - 1]
    return Boolean(player?.propertiesOwned?.length)
  })

  if (sellerNumbers.length === 0 || roomState.sharedState.game.moneyDeck.length < sellerNumbers.length) {
    roomState.sharedState.game.stage = 'Complete'
    return
  }

  roomState.sharedState.game.round = (roomState.sharedState.game.round || 1) + 1
  const moneyCards = dealSaleRound(roomState.sharedState.game.moneyDeck, sellerNumbers.length)
  roomState.sharedState.saleState = startSaleRound(sellerNumbers, moneyCards)
}

for (const roomState of roomStates.values()) {
  refreshDummyUsers(roomState)
}

function emitTablePermissions(roomState) {
  for (const [socketId] of roomState.playerAssignments) {
    const socket = io.sockets.sockets.get(socketId)

    if (socket) {
      socket.emit('table:permissions', {
        canConfigureTable: socketId === roomState.hostSocketId,
      })
    }
  }
}

function emitGameState(roomId) {
  const roomState = roomStates.get(roomId)
  if (!roomState) return

  io.to(roomId).emit('game:state', getPublicState(roomState, roomId))
}

function emitPresence(roomId) {
  const roomState = roomStates.get(roomId)
  if (!roomState) return

  io.to(roomId).emit('game:presence', {
    connectedPlayers: getRoomSocketCount(roomId) + roomState.dummyPlayerNumbers.length,
  })
}

function moveSocketToRoom(socket, nextRoomIdRaw) {
  const nextRoomId = normalizeRoomId(nextRoomIdRaw)
  const currentRoomId = socketRoomAssignments.get(socket.id)

  if (currentRoomId === nextRoomId) {
    return nextRoomId
  }

  if (currentRoomId) {
    const currentRoomState = roomStates.get(currentRoomId)
    if (currentRoomState) {
      currentRoomState.playerAssignments.delete(socket.id)
      if (currentRoomState.hostSocketId === socket.id) {
        currentRoomState.hostSocketId = currentRoomState.playerAssignments.keys().next().value ?? null
      }
      socket.leave(currentRoomId)
      emitTablePermissions(currentRoomState)
      emitGameState(currentRoomId)
      emitPresence(currentRoomId)
    }
  }

  const nextRoomState = roomStates.get(nextRoomId)
  if (!nextRoomState) {
    return DEFAULT_ROOM_ID
  }

  socket.join(nextRoomId)
  socketRoomAssignments.set(socket.id, nextRoomId)

  if (!nextRoomState.hostSocketId) {
    nextRoomState.hostSocketId = socket.id
  }

  if (!nextRoomState.playerAssignments.has(socket.id)) {
    nextRoomState.playerAssignments.set(socket.id, null)
  }

  emitTablePermissions(nextRoomState)
  emitGameState(nextRoomId)
  emitPresence(nextRoomId)

  return nextRoomId
}

io.on('connection', (socket) => {
  const roomId = DEFAULT_ROOM_ID
  const roomState = roomStates.get(roomId)
  if (!roomState) return

  socket.join(roomId)
  socketRoomAssignments.set(socket.id, roomId)

  if (!roomState.hostSocketId) {
    roomState.hostSocketId = socket.id
  }

  roomState.playerAssignments.set(socket.id, null)
  socket.emit('game:state', getPublicState(roomState, roomId))
  emitTablePermissions(roomState)
  emitPresence(roomId)

  socket.on('game:select_room', (payload) => {
    const targetRoomId = normalizeRoomId(payload?.roomId)
    const activeRoomId = moveSocketToRoom(socket, targetRoomId)
    socket.emit('room:selected', { roomId: activeRoomId })
  })

  socket.on('game:join', (payload) => {
    const targetRoomId = normalizeRoomId(payload?.roomId)
    const activeRoomId = moveSocketToRoom(socket, targetRoomId)
    const activeRoomState = roomStates.get(activeRoomId)
    if (!activeRoomState) return

    const wantsActivePlayer = Boolean(payload?.wantsActivePlayer)
    const requestedCount = Number(payload?.numberOfPlayers)
    const requestedPlayerNumber = Number(payload?.desiredPlayerNumber)
    const hasAssignedActivePlayers = [...activeRoomState.playerAssignments.values()].some(Boolean)
    const canConfigureTable = socket.id === activeRoomState.hostSocketId

    if (
      canConfigureTable &&
      Number.isInteger(requestedCount) &&
      requestedCount >= MIN_PLAYERS &&
      requestedCount !== activeRoomState.sharedState.game.players.length &&
      !hasAssignedActivePlayers
    ) {
      resetGame(activeRoomState, requestedCount)
      activeRoomState.playerAssignments.set(socket.id, null)
    }

    let playerNumber = null
    let reason = null

    if (wantsActivePlayer) {
      const hasPreferredSeat = Number.isInteger(requestedPlayerNumber)
      playerNumber = assignPlayerNumber(
        activeRoomState,
        hasPreferredSeat ? requestedPlayerNumber : null,
        socket.id
      )
      if (!playerNumber) {
        reason = hasPreferredSeat ? 'seat_taken' : 'no_active_slots'
      }
    }

    activeRoomState.playerAssignments.set(socket.id, playerNumber)

    if (playerNumber) {
      const player = activeRoomState.sharedState.game.players[playerNumber - 1]
      if (player) {
        player.active = true
      }
    }

    // Entering the game moves the shared table into bidding phase while auctions are active.
    if (activeRoomState.sharedState.game.stage === 'Auction' || activeRoomState.sharedState.game.stage === 'Bidding') {
      activeRoomState.sharedState.game.stage = 'Bidding'
    }

    socket.emit('player:assigned', {
      playerNumber,
      isActivePlayer: Boolean(playerNumber),
      joined: true,
      reason,
      roomId: activeRoomId,
    })
    emitGameState(activeRoomId)
  })

  socket.on('game:place_bid', (payload) => {
    const activeRoomId = socketRoomAssignments.get(socket.id)
    const activeRoomState = activeRoomId ? roomStates.get(activeRoomId) : null
    if (!activeRoomState || !activeRoomId) return

    const playerNumber = activeRoomState.playerAssignments.get(socket.id)
    if (!playerNumber) return

    const amount = Number(payload?.amount)
    if (!Number.isFinite(amount)) return

    const result = processBid(
      activeRoomState.sharedState.auctionState,
      playerNumber,
      amount,
      activeRoomState.sharedState.game.players
    )
    if (result.error) {
      socket.emit('game:error', { message: result.error })
      return
    }

    activeRoomState.sharedState.auctionState = result.state
    emitGameState(activeRoomId)
  })

  socket.on('game:fold', () => {
    const activeRoomId = socketRoomAssignments.get(socket.id)
    const activeRoomState = activeRoomId ? roomStates.get(activeRoomId) : null
    if (!activeRoomState || !activeRoomId) return

    const playerNumber = activeRoomState.playerAssignments.get(socket.id)
    if (!playerNumber) return

    const result = processFold(
      activeRoomState.sharedState.auctionState,
      playerNumber,
      activeRoomState.sharedState.game.players
    )
    if (result.error) {
      socket.emit('game:error', { message: result.error })
      return
    }

    activeRoomState.sharedState.auctionState = result.state

    // Auto-advance to the next round once this auction is resolved.
    if (activeRoomState.sharedState.auctionState.phase === 'resolved') {
      setTimeout(() => {
        advanceAuctionRound(activeRoomState)
        emitGameState(activeRoomId)
      }, 3000)
    }

    emitGameState(activeRoomId)
  })

  socket.on('game:play_property', (payload) => {
    const activeRoomId = socketRoomAssignments.get(socket.id)
    const activeRoomState = activeRoomId ? roomStates.get(activeRoomId) : null
    if (!activeRoomState || !activeRoomId) return

    const playerNumber = activeRoomState.playerAssignments.get(socket.id)
    if (!playerNumber) return
    if (activeRoomState.sharedState.game.stage !== 'Selling' || !activeRoomState.sharedState.saleState) return

    const propertyCardId = Number(payload?.propertyCardId)
    if (!Number.isFinite(propertyCardId)) return

    const result = processPlayProperty(
      activeRoomState.sharedState.saleState,
      playerNumber,
      propertyCardId,
      activeRoomState.sharedState.game.players
    )
    if (result.error) {
      socket.emit('game:error', { message: result.error })
      return
    }

    activeRoomState.sharedState.saleState = result.state
    emitGameState(activeRoomId)

    if (activeRoomState.sharedState.saleState.phase === 'resolved') {
      setTimeout(() => {
        advanceSaleRound(activeRoomState)
        emitGameState(activeRoomId)
      }, 3000)
    }
  })

  socket.on('disconnect', () => {
    const activeRoomId = socketRoomAssignments.get(socket.id)
    const activeRoomState = activeRoomId ? roomStates.get(activeRoomId) : null

    socketRoomAssignments.delete(socket.id)

    if (!activeRoomState || !activeRoomId) {
      return
    }

    activeRoomState.playerAssignments.delete(socket.id)

    if (socket.id === activeRoomState.hostSocketId) {
      activeRoomState.hostSocketId = activeRoomState.playerAssignments.keys().next().value ?? null
    }

    emitTablePermissions(activeRoomState)
    emitGameState(activeRoomId)
    emitPresence(activeRoomId)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Socket server running on http://localhost:${PORT}`)
})