import GardenLayout from "./garden_layout.js";
import KitchenLayout from "./kitchen_layout.js";
import BuffsController from "./buffs_controller.js";
import State from "./state.js";
import BuffsHUD from "./buffs_hud.js"

// convertCssPXToLayer attempts to translate a CSS-based point into a point
// inside a layer in the current layout.
// 
// runtime - A reference to the Construct's IRuntime object.
// clientX - The X position of the click, in screen coordinates.
// clientY - The Y position of the click, in screen coordinates.
//
// Return a vector containing [X, Y], translated to the first layer of the
// active layout. The returned value can then be compared with any position
// of any object inside the current layout.
function convertCssPXToLayer(runtime, clientX, clientY) {
	const layer = runtime.layout.getLayer(0);
	return layer.cssPxToLayer(clientX, clientY);
}

const movementSpeed = 200;
const allMovementKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]

// Class Game is the main entrypoint for the game, and contains basic logic for
// handling inputs and other events. This class also is responsible for 
// preparing layouts, and dispatching events to the current active layout, keep
// references to global states such as the main `state`, and the 
// BuffsController.
class Game {
	constructor(runtime) {
		/*
			WARNING!
			Game objects are not laid when this constructor is called.
			To reference objects, use the prepare method.
		*/

		// A reference to the Construct Runtime object.
		this.runtime = runtime;

		// A reference to the main State object (see state.js)
		this.state = new State();

		// Determines the maximum value of points a player can have at any given
		// moment.
		this.maxPoints = 9999;

		// Keeps a reference to the current layout being presented to the 
		// player. Before accessing, it is important to check whether 
		// currentLayoutPrepared is set: this ensures that the layout has been
		// laid, and all objects are ready to be accessed.
		this.currentLayout = null;

		// Indicates whether the `currentLayout` has been correctly initialized,
		// and have all its objects prepared, and ready to be accessed.
		this.currentLayoutPrepared = false;

		// Indicates whether we are in the operation of moving between layouts.
		// When set, it may indicate that a currentLayout is being replaced by
		// another.
		this.movingLayout = false;

		// Keeps a reference to the BuffsController, which is responsible for
		// tracking active buffs and cooldowns. See buffs_controller.js
		this.buffsCtrl = new BuffsController(this);

		// Keeps a reference to the BuffsHUD, which is responsible for handling
		// UI updates when buffs are active by leveraging objects that are 
		// available in all layouts. Fails with a console warning in case it
		// is unable to obtain a handle to required UI elements.
		this.buffsHUD = new BuffsHUD(this);

		// Prepares the secondTick timer. This will invoke the `secondTick`
		// method every second.
		setInterval(() => this.secondTick(), 1000);
	}

	// segueLayout is responsible for handling the segue from a layout to 
	// another. It initializes the layout class, updates internal states, and
	// automatically switches the scene to the layout provided by the layout
	// instance being created.
	//
	// layoutClass - A Class object representing the layout to be transitioned
	//               onto. Must be a class and not an instance!
	//
	// Returns nothing.
	segueLayout(layoutClass) {
		if (this.movingLayout) return;
		this.movingLayout = true;
		this.currentLayoutPrepared = false;
		this.currentLayout = new layoutClass(this);
		this.runtime.goToLayout(this.currentLayout.layoutName());
	}

	// transitionLayout is an internal method responsible for preparing a new
	// layout to become playable. It updates all internal objects such as the
	// `buffsHUD`, invokes the `prepare` method on the new Layout, and updates
	// internal state to indicate that the layout is ready to be used by 
	// handlers and dispatchers.
	//
	// Returns nothing.
	transitionLayout() {
		if (this.currentLayout) {
			// FIXME: For some reason, even inside the afteranylayoutstart 
			// handler, items are not yet available in the runtime instance. 
			// I'll just add a 100ms delay here — which should not be 
			// noticeable, — and call prepare after it; It will prolly discard a 
			// few ticks and allow the engine to get up and running before we 
			// try to access objects again.
			setTimeout(() => {
				// Prevents prepare from being called twice
				if (this.currentLayoutPrepared) { return; }

				console.log("Game: currentLayout", this.currentLayout);
				this.buffsHUD.prepare();
				this.currentLayout.prepare();
				this.currentLayoutPrepared = true;
				this.movingLayout = false;
				this.currentLayout.didUpdatePoints(this.state.points);
				this.buffsHUD.update();
			}, 100);
		}
	}

	// prepare is called once the game has completely booted; it is responsible
	// to attach event handlers, and perform the initial segueLayout to the 
	// GardenLayout, which is the initial screen of the game.
	//
	// Returns nothing.
	prepare() {
		this.runtime.addEventListener("pointerdown", e => this.onMouseDown(e))
		this.runtime.addEventListener("tick", () => this.tick());
		this.segueLayout(GardenLayout);
	}

	// Called every second in the game. Calculates cooldown rates, and updates 
	// them accordingly, dispatching events after updates are applied (if 
	// supported by the currentLayout instance).
	//
	// Returns nothing.
	secondTick() {
		this.buffsHUD.update();
		if (this.currentLayout && this.currentLayoutPrepared && this.currentLayout.secondTick) {
			this.currentLayout.secondTick();
		}
	}

	// Called every tick in the game. Basically dispatches several calls to 
	// other methods responsible for detecting player input, portal colisions, 
	// buffs updates, and also invokes the tick method defined on any *Layout 
	// class that's instantiated on `currentLayout`.
	//
	// Returns nothing.
	tick() {
		this.detectCollision();
		this.handleKeyboard();
		this.buffsCtrl.tick();
		if (this.currentLayout && this.currentLayoutPrepared) {
			this.currentLayout.tick();
		}
	}

	// Updates the player's points by invoking the provided
	// function. The function receives the current amount of
	// points and must return the new amount to be set.
	// This invokes didUpdatePoints on the current layout in order
	// to allow it to update the HUD.
	//
	// Returns nothing.
	updatePoints(changeFn) {
		let localPoints = changeFn ? changeFn(this.state.points) : this.state.points;
		localPoints = Math.min(localPoints, this.maxPoints);
		console.log(`Game: Updating game points from ${this.state.points} to ${localPoints}`)
		this.state.points = localPoints;

		this.currentLayout.didUpdatePoints(this.state.points);
	}

	// Handles the mouseDown event. This method basically filters sprites that 
	// are present in the coordinates reported by the click event, filtering out
	// sprites that cannot be tested for hits (does not implement 
	// containsPoint), are not visible, or has its parent layer set as 
	// non-interactive, along with also preventing `Background` and `Barrier` 
	// sprites from being shown, as those are irrelevant to any click logic.
	// Then, if we have a currentLayoutSet, and the layout has been correctly 
	// initialized, the list of sprites under the clicked point are passed to 
	// the layout's instance's `onMouseDown` method.
	//
	// Returns nothing.
	onMouseDown(e) {
		const sprites = Object.keys(this.runtime.objects)
			.map(i => this.runtime.objects[i].getAllInstances())
			.flat()
			.filter(i => !!i.containsPoint)
			.filter(i => i.isVisible && i.layer.isInteractive)
			.filter(i => i.objectType.name.indexOf("Background") == -1)
			.filter(i => i.objectType.name.indexOf("Barrier") == -1)
		let targetSprites = [];

		let [x, y] = convertCssPXToLayer(this.runtime, e.clientX, e.clientY);

		for (var i = 0; i < sprites.length; i++) {
			if (!sprites[i].containsPoint(x, y)) {
				continue;
			}
			targetSprites.push(sprites[i]);
		}

		if (this.currentLayout && this.currentLayoutPrepared) {
			this.currentLayout.onMouseDown(targetSprites);
		}
	}

	// Updates the player's animation based on a provided direction.
	// 
	// direction - The direction the player will face. Valid options are `cima`,
	//             `baixo`, `esq`, and `dir`. This method automatically updates
	//             the target animation to use the cat alternative in case
	//             the `hadCatNipTea` property of the State class is set.
	//
	// Returns nothing.
	setupPlayerAnimation(direction) {
		if (this.state.hadCatNipTea) {
			direction = `${direction}-gato`
		}
		const player = this.getPlayer();
		if (!this.state.isWalking) {
			this.state.isWalking = true;
			player.animationSpeed = 5;
			player.animationFrame = 0;
			player.animationRepeatToFrame = 0;
		}

		player.setAnimation(direction)
	}

	// Utility method: returns the player instance.
	getPlayer() {
		return this.runtime.objects.Player.getFirstInstance();
	}

	// Detects whether the player is colliding with a portal to either the 
	// kitchen or garden, responding accordingly by invoking the segueLayout 
	// method.
	detectCollision() {
		if (this.movingLayout) return;

		let player = this.getPlayer();
		let kitchenPortal = this.runtime.objects.PortalGardenKitchen.getFirstInstance();
		let gardenPortal = this.runtime.objects.PortalKitchenGarden.getFirstInstance();

		if (kitchenPortal && this.runtime.collisions.testOverlap(player, kitchenPortal)) {
			console.log("Detected collision to Kitchen Portal")
			this.segueLayout(KitchenLayout);
		}

		if (gardenPortal && this.runtime.collisions.testOverlap(player, gardenPortal)) {
			console.log("Detected collision to Garden Portal")
			this.segueLayout(GardenLayout);
		}
	}

	// Checks for keystrokes to update the player position or handle exiting 
	// menus. Every call to this method also calls the `handleKeyboard` method
	// of the currentLayout, if it is present, and currentLayoutPrepared is set.
	//
	// Returns nothing.
	handleKeyboard() {
		let inst = this.getPlayer();

		if (this.runtime.keyboard.isKeyDown("ArrowLeft")) {
			this.setupPlayerAnimation(`esq`);
			inst.x -= movementSpeed * this.runtime.dt;
		}

		if (this.runtime.keyboard.isKeyDown("ArrowRight")) {
			this.setupPlayerAnimation(`dir`);
			inst.x += movementSpeed * this.runtime.dt;
		}

		if (this.runtime.keyboard.isKeyDown("ArrowUp")) {
			this.setupPlayerAnimation(`cima`);
			inst.y -= movementSpeed * this.runtime.dt;

		}

		if (this.runtime.keyboard.isKeyDown("ArrowDown")) {
			this.setupPlayerAnimation(`baixo`);
			inst.y += movementSpeed * this.runtime.dt;
		}

		if (allMovementKeys.filter(i => this.runtime.keyboard.isKeyDown(i)).length == 0) {
			inst.animationSpeed = 0;
			inst.animationFrame = 0;
			this.state.isWalking = false;
		}

		if (this.currentLayout && this.currentLayoutPrepared) {
			this.currentLayout.handleKeyboard();
		}
	}
}

// Global game instance. Used only by runOnStartup.
let game;

// Code to run on the loading screen.
// Note layouts, objects etc. are not yet available.
runOnStartup(async (runtime) => {
	game = new Game(runtime);
	runtime.addEventListener("beforeprojectstart", () => game.prepare());
	runtime.addEventListener("afteranylayoutstart", () => {
		console.log("Game: afteranylayoutstart")
		game.transitionLayout();
	});
});
