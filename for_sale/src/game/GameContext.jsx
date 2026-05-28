import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import gameSetup from './game_setup'
import { startAuction, dealAuctionRound, processBid, processFold } from './auction_logic'
import { startSaleRound, dealSaleRound, processPlayProperty } from './Sale_logic'
import GameContext from './GameContextValue'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001'
const LOCAL_ROOM_STORAGE_PREFIX = 'for_sale_room_state_v1:'
const DEFAULT_ROOM_ID = '1'

function getLocalRoomStorageKey(roomId) {
  return `${LOCAL_ROOM_STORAGE_PREFIX}${String(roomId || DEFAULT_ROOM_ID)}`
}

function createInitialRoomState(roomId, numberOfPlayers = 3) {
  const game = gameSetup(numberOfPlayers)
  const startPlayer = game.nextAuctionStarter || 1
  const playerNumbers = Array.from({ length: numberOfPlayers }, (_, i) => ((startPlayer - 1 + i) % numberOfPlayers) + 1)
  const deckCopy = [...game.deck]
  const cards = dealAuctionRound(deckCopy, numberOfPlayers)
  const auctionState = startAuction(playerNumbers, cards)
  game.nextAuctionStarter = (startPlayer % numberOfPlayers) + 1

  return {
    ...game,
    deck: deckCopy,
    auctionState,
    saleState: null,
    roomId: String(roomId || DEFAULT_ROOM_ID),
    occupiedPlayerNumbers: [],
    availablePlayerNumbers: playerNumbers,
    connectedPlayers: 1,
  }
}

function readLocalRoomState(roomId) {
  if (typeof window === 'undefined') return null

  try {
    const rawValue = window.localStorage.getItem(getLocalRoomStorageKey(roomId))
    if (!rawValue) return null

    return JSON.parse(rawValue)
  } catch {
    return null
  }
}

function writeLocalRoomState(roomId, nextState) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getLocalRoomStorageKey(roomId), JSON.stringify(nextState))
  } catch {
    // Ignore storage quota / privacy mode failures and keep the in-memory fallback active.
  }
}

function getOrCreateLocalRoomState(roomId, numberOfPlayers = 3) {
  const existingState = readLocalRoomState(roomId)
  if (existingState) return existingState

  const createdState = createInitialRoomState(roomId, numberOfPlayers)
  writeLocalRoomState(roomId, createdState)
  return createdState
}

function persistLocalRoomUpdate(roomId, updater) {
  const currentState = getOrCreateLocalRoomState(roomId)
  const nextState = updater(currentState)
  writeLocalRoomState(roomId, nextState)
  return nextState
}

function clonePlayersForLocalUpdate(players = []) {
  return players.map((player) => ({
    ...player,
    hand: Array.isArray(player.hand) ? [...player.hand] : [],
    propertiesOwned: Array.isArray(player.propertiesOwned) ? [...player.propertiesOwned] : [],
  }))
}

function advanceLocalAfterAuctionResolve(state) {
  const playerCount = state.players.length

  if (state.deck.length < playerCount) {
    const sellerNumbers = Array.from({ length: playerCount }, (_, i) => i + 1)
      .filter((playerNumber) => {
        const player = state.players[playerNumber - 1]
        return Boolean(player?.propertiesOwned?.length)
      })

    if (sellerNumbers.length === 0 || state.moneyDeck.length < sellerNumbers.length) {
      return {
        ...state,
        stage: 'Complete',
        saleState: null,
      }
    }

    const moneyDeck = [...state.moneyDeck]
    const moneyCards = dealSaleRound(moneyDeck, sellerNumbers.length)

    return {
      ...state,
      stage: 'Selling',
      round: 1,
      moneyDeck,
      saleState: startSaleRound(sellerNumbers, moneyCards),
    }
  }

  const deck = [...state.deck]
  const startPlayer = state.nextAuctionStarter || 1
  const playerNumbers = Array.from({ length: playerCount }, (_, i) => ((startPlayer - 1 + i) % playerCount) + 1)
  const cards = dealAuctionRound(deck, playerCount)

  return {
    ...state,
    stage: 'Bidding',
    round: (state.round || 1) + 1,
    deck,
    nextAuctionStarter: (startPlayer % playerCount) + 1,
    auctionState: startAuction(playerNumbers, cards),
  }
}

function advanceLocalAfterSaleResolve(state) {
  if (!state.saleState) {
    return {
      ...state,
      stage: 'Complete',
    }
  }

  const sellerNumbers = state.saleState.activeSellers.filter((playerNumber) => {
    const player = state.players[playerNumber - 1]
    return Boolean(player?.propertiesOwned?.length)
  })

  if (sellerNumbers.length === 0 || state.moneyDeck.length < sellerNumbers.length) {
    return {
      ...state,
      stage: 'Complete',
    }
  }

  const moneyDeck = [...state.moneyDeck]
  const moneyCards = dealSaleRound(moneyDeck, sellerNumbers.length)

  return {
    ...state,
    round: (state.round || 1) + 1,
    moneyDeck,
    saleState: startSaleRound(sellerNumbers, moneyCards),
  }
}

export function GameProvider({ children, numberOfPlayers = 3 }) {
  const localFallbackState = useMemo(() => {
    return getOrCreateLocalRoomState(DEFAULT_ROOM_ID, numberOfPlayers)
  }, [numberOfPlayers])

  const [gameState, setGameState] = useState(localFallbackState)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [currentPlayerNumber, setCurrentPlayerNumber] = useState(null)
  const [isActivePlayer, setIsActivePlayer] = useState(false)
  const [hasJoined, setHasJoined] = useState(false)
  const [canConfigureTable, setCanConfigureTable] = useState(false)
  const [joinFeedback, setJoinFeedback] = useState('')
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      reconnection: true,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnectionStatus('connected')
      setJoinFeedback('')
    })

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected')
    })

    socket.on('game:state', (nextState) => {
      setGameState(nextState)
    })

    socket.on('game:presence', ({ connectedPlayers }) => {
      setGameState((prev) => ({ ...prev, connectedPlayers }))
    })

    socket.on('room:selected', ({ roomId }) => {
      setGameState((prev) => ({ ...prev, roomId: String(roomId || '1') }))
    })

    socket.on('player:assigned', ({ playerNumber, joined, reason }) => {
      if (!joined) {
        return
      }

      setCurrentPlayerNumber(playerNumber)
      setIsActivePlayer(Boolean(playerNumber))
      setHasJoined(true)

      if (reason === 'no_active_slots') {
        setJoinFeedback('Active player slots are full. You joined as a spectator.')
      } else if (reason === 'seat_taken') {
        setJoinFeedback('That seat is already taken. Choose a different player number or join as spectator.')
      } else if (reason === 'room_reset') {
        setJoinFeedback('Room was reset. Choose a seat again to rejoin as an active player.')
      } else {
        setJoinFeedback('')
      }
    })

    socket.on('table:permissions', ({ canConfigureTable: canConfigure }) => {
      setCanConfigureTable(Boolean(canConfigure))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    function handleStorage(event) {
      if (!event.key || !event.key.startsWith(LOCAL_ROOM_STORAGE_PREFIX)) return
      if (socketRef.current?.connected) return

      const currentRoomId = String(gameState.roomId || DEFAULT_ROOM_ID)
      if (event.key !== getLocalRoomStorageKey(currentRoomId)) return
      if (!event.newValue) return

      try {
        const nextState = JSON.parse(event.newValue)
        setGameState(nextState)
      } catch {
        // Ignore malformed storage writes.
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [gameState.roomId])

  const value = useMemo(
    () => ({
      ...gameState,
      connectionStatus,
      currentPlayerNumber,
      isActivePlayer,
      hasJoined,
      canConfigureTable,
      joinFeedback,
      selectRoom(roomId) {
        const nextRoomId = String(roomId || DEFAULT_ROOM_ID)
        const socket = socketRef.current

        if (socket?.connected) {
          socket.emit('game:select_room', { roomId: nextRoomId })
          return
        }

        const nextState = getOrCreateLocalRoomState(nextRoomId, numberOfPlayers)
        setGameState(nextState)
      },
      joinGame({ wantsActivePlayer, numberOfPlayers, desiredPlayerNumber, roomId }) {
        const socket = socketRef.current

        // Immediately move into the game UI, then reconcile with server response.
        setHasJoined(true)

        if (!socket || !socket.connected) {
          const nextRoomId = String(roomId || gameState.roomId || DEFAULT_ROOM_ID)
          const roomState = getOrCreateLocalRoomState(nextRoomId, numberOfPlayers)
          const availableSeats = roomState.availablePlayerNumbers?.length
            ? [...roomState.availablePlayerNumbers]
            : roomState.players.map((_, index) => index + 1)

          const chosenSeat = wantsActivePlayer
            ? (Number.isInteger(Number(desiredPlayerNumber))
              ? Number(desiredPlayerNumber)
              : availableSeats[0] ?? 1)
            : null

          if (wantsActivePlayer && chosenSeat && !availableSeats.includes(chosenSeat)) {
            setJoinFeedback('That seat is already taken. Choose a different player number or join as spectator.')
            return
          }

          setIsActivePlayer(Boolean(wantsActivePlayer))
          setCurrentPlayerNumber(chosenSeat)
          setJoinFeedback('Realtime server unavailable. Running in local debug mode.')

          const nextState = persistLocalRoomUpdate(nextRoomId, (currentState) => {
            const occupiedPlayerNumbers = [...(currentState.occupiedPlayerNumbers ?? [])]
            if (chosenSeat && !occupiedPlayerNumbers.includes(chosenSeat)) {
              occupiedPlayerNumbers.push(chosenSeat)
            }

            occupiedPlayerNumbers.sort((a, b) => a - b)

            const availablePlayerNumbers = currentState.players
              .map((_, index) => index + 1)
              .filter((playerNumber) => !occupiedPlayerNumbers.includes(playerNumber))

            return {
              ...currentState,
              roomId: nextRoomId,
              occupiedPlayerNumbers,
              availablePlayerNumbers,
            }
          })

          setGameState(nextState)
          return
        }

        setJoinFeedback('')
        socketRef.current?.emit('game:join', {
          wantsActivePlayer,
          numberOfPlayers,
          desiredPlayerNumber,
          roomId,
        })
      },
      resetRoom() {
        const socket = socketRef.current

        if (socket?.connected) {
          socket.emit('game:reset_room')
          return
        }

        const nextRoomId = String(gameState.roomId || DEFAULT_ROOM_ID)
        const playerCount = Math.max(3, gameState.players?.length || numberOfPlayers || 3)
        const nextState = createInitialRoomState(nextRoomId, playerCount)

        writeLocalRoomState(nextRoomId, nextState)
        setGameState(nextState)
        setCurrentPlayerNumber(null)
        setIsActivePlayer(false)
        setJoinFeedback('Room reset in local mode. Choose a seat again to rejoin as an active player.')
      },
      placeBid(amount) {
        const socket = socketRef.current

        if (socket?.connected) {
          socket.emit('game:place_bid', { amount })
          return
        }

        if (!currentPlayerNumber) return

        setGameState((prev) => {
          const result = processBid(prev.auctionState, currentPlayerNumber, Number(amount), prev.players)
          if (result.error) return prev

          const nextState = {
            ...prev,
            auctionState: result.state,
          }

          writeLocalRoomState(prev.roomId, nextState)
          return nextState
        })
      },
      fold() {
        const socket = socketRef.current

        if (socket?.connected) {
          socket.emit('game:fold')
          return
        }

        if (!currentPlayerNumber) return

        setGameState((prev) => {
          const players = clonePlayersForLocalUpdate(prev.players)
          const result = processFold(prev.auctionState, currentPlayerNumber, players)
          if (result.error) return prev

          let nextState = {
            ...prev,
            players,
            auctionState: result.state,
          }

          if (nextState.auctionState.phase === 'resolved') {
            nextState = advanceLocalAfterAuctionResolve(nextState)
          }

          writeLocalRoomState(prev.roomId, nextState)

          return nextState
        })
      },
      playProperty(propertyCardId) {
        const socket = socketRef.current

        if (socket?.connected) {
          socket.emit('game:play_property', { propertyCardId })
          return
        }

        if (!currentPlayerNumber) return

        setGameState((prev) => {
          if (prev.stage !== 'Selling' || !prev.saleState) return prev

          const players = clonePlayersForLocalUpdate(prev.players)
          const result = processPlayProperty(prev.saleState, currentPlayerNumber, Number(propertyCardId), players)
          if (result.error) return prev

          let nextState = {
            ...prev,
            players,
            saleState: result.state,
          }

          if (nextState.saleState?.phase === 'resolved') {
            nextState = advanceLocalAfterSaleResolve(nextState)
          }

          writeLocalRoomState(prev.roomId, nextState)

          return nextState
        })
      },
    }),
    [
      gameState,
      connectionStatus,
      currentPlayerNumber,
      isActivePlayer,
      hasJoined,
      canConfigureTable,
      joinFeedback,
      numberOfPlayers,
    ]
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
