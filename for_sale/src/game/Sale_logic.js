/**
 * Remove `count` money cards from the front of the money deck.
 * Returns cards sorted lowest->highest (index 0 = lowest value).
 */
export function dealSaleRound(moneyDeck, count) {
	const cards = moneyDeck.splice(0, count)
	return cards.sort((a, b) => a.value - b.value)
}

/**
 * Initialise a sale round.
 */
export function startSaleRound(playerNumbers, moneyCards) {
	return {
		activeSellers: [...playerNumbers],
		pendingPlays: {},
		revealedPlays: [],
		moneyCards: [...moneyCards],
		phase: 'selecting',
		roundResults: [],
	}
}

/**
 * A player selects a property card to sell this round.
 * Returns { state } on success or { error } on failure.
 */
export function processPlayProperty(state, playerNumber, propertyCardId, players) {
	if (state.phase !== 'selecting') return { error: 'Sale round is not accepting plays' }
	if (!state.activeSellers.includes(playerNumber)) return { error: 'Player is not active in this sale round' }
	if (state.pendingPlays[playerNumber]) return { error: 'Player already selected a property this round' }

	const player = players[playerNumber - 1]
	if (!player) return { error: 'Player not found' }

	const cardIndex = player.propertiesOwned.findIndex((card) => card.id === propertyCardId)
	if (cardIndex < 0) return { error: 'Selected property not found in player hand' }

	const [playedCard] = player.propertiesOwned.splice(cardIndex, 1)

	const nextState = {
		...state,
		pendingPlays: {
			...state.pendingPlays,
			[playerNumber]: playedCard,
		},
	}

	const everyonePlayed = nextState.activeSellers.every((n) => nextState.pendingPlays[n])
	if (!everyonePlayed) {
		return { state: nextState }
	}

	return { state: resolveSaleRound(nextState, players) }
}

/**
 * Resolve round by ranking property cards low->high and distributing
 * money cards low->high to match those ranks.
 */
export function resolveSaleRound(state, players) {
	const rankedPlays = state.activeSellers
		.map((playerNumber) => ({
			playerNumber,
			propertyCard: state.pendingPlays[playerNumber],
		}))
		.sort((a, b) => {
			if (a.propertyCard.value === b.propertyCard.value) {
				return a.playerNumber - b.playerNumber
			}
			return a.propertyCard.value - b.propertyCard.value
		})

	const sortedMoneyCards = [...state.moneyCards].sort((a, b) => a.value - b.value)

	const roundResults = rankedPlays.map((play, index) => {
		const moneyCard = sortedMoneyCards[index]
		const player = players[play.playerNumber - 1]

		if (player && moneyCard) {
			player.money += moneyCard.value
		}

		return {
			playerNumber: play.playerNumber,
			propertyCard: play.propertyCard,
			moneyCard,
		}
	})

	return {
		...state,
		phase: 'resolved',
		revealedPlays: rankedPlays,
		roundResults,
	}
}

export default { dealSaleRound, startSaleRound, processPlayProperty, resolveSaleRound }
