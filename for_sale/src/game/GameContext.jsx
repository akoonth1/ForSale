import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import gameSetup from './game_setup'
import { startAuction, dealAuctionRound } from './auction_logic'
import GameContext from './GameContextValue'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001'

export function GameProvider({ children, numberOfPlayers = 3 }) {
  const localFallbackState = useMemo(() => {
    const game = gameSetup(numberOfPlayers)
    const playerNumbers = Array.from({ length: numberOfPlayers }, (_, i) => i + 1)
    const deckCopy = [...game.deck]
    const cards = dealAuctionRound(deckCopy, numberOfPlayers)
    const auctionState = startAuction(playerNumbers, cards)
    return {
      ...game,
      deck: deckCopy,
      auctionState,
      connectedPlayers: 1,
    }
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

    socket.on('player:assigned', ({ playerNumber, joined, reason }) => {
      if (!joined) {
        return
      }

      setCurrentPlayerNumber(playerNumber)
      setIsActivePlayer(Boolean(playerNumber))
      setHasJoined(true)

      if (reason === 'no_active_slots') {
        setJoinFeedback('Active player slots are full. You joined as a spectator.')
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

  const value = useMemo(
    () => ({
      ...gameState,
      connectionStatus,
      currentPlayerNumber,
      isActivePlayer,
      hasJoined,
      canConfigureTable,
      joinFeedback,
      joinGame({ wantsActivePlayer, numberOfPlayers }) {
        const socket = socketRef.current

        // Immediately move into the game UI, then reconcile with server response.
        setHasJoined(true)

        if (!socket || !socket.connected) {
          setIsActivePlayer(Boolean(wantsActivePlayer))
          setCurrentPlayerNumber(wantsActivePlayer ? 1 : null)
          setJoinFeedback('Realtime server unavailable. Running in local debug mode.')
          return
        }

        setJoinFeedback('')
        socketRef.current?.emit('game:join', {
          wantsActivePlayer,
          numberOfPlayers,
        })
      },
      placeBid(amount) {
        socketRef.current?.emit('game:place_bid', { amount })
      },
      fold() {
        socketRef.current?.emit('game:fold')
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
    ]
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
