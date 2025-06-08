// State is a POJO that only keeps the game state. Whenever a Save/Load feature
// is added, this class can then be serialized/deserialized to store an retrieve
// the game state!
export default class State {
    constructor() {

		// The amount of points the player has.
        this.points = 0

		// Indicates whether the player is walking
		this.isWalking = false

		// Indicates whether the player has planted CatNip. This enables
		// Neko to appear on the garden screen!
		this.hasCatNip = false

		// Keeps an array of purchased plants. This is used to prevent the 
		// player from buying the same plant multiple times, and also by the
		// kitchen to ensure a tea can be made (which requires the plant to have
		// been purchased)
		this.purchasedPlants = []

		// Keeps a set of active cooldowns. Each value in this dictionary is an
		// instance of CooldownState (see buffs_controller.js)
		this.cooldowns = {}

		// Keeps a list of active buffs. Each item in this array is an instance
		// of Buff (see buffs_controller.js)
		this.buffs = []
    }
}