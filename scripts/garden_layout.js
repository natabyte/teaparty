import NekoFSM from "./neko_fsm.js";

// GardenLayout contains all the required logic for the Layout Garden scene.
export default class GardenLayout {
    constructor(game) {
        this.game = game;
        this.runtime = game.runtime;
        this.state = game.state;

		// shopPriceTable contains all prices for each of the items sold at the
		// shop.
        this.shopPriceTable = {
			"ManjericaoSagrado": 100,
			"AmoraSilvestre": 250,
			"LirioEncantado": 400,
			"MargaridaApaixonante": 600,
			"LavandaSerenante": 800,
			"CatNip": 1600,
		}

        this.gardenShopSprites = [];
    }

	// layoutName returns the name of the layout to be used with this class.
    layoutName() { return "Layout Garden" }

	// prepare is automatically called by the Game class once the Layout is 
    // ready. Here we prepare a few internal variables in order to help us
    // on other methods, lay down sprites that should be visible, and initialize
	// the Neko FSM, in case it should be visible. This last is required in case
	// the player is transitioning from the Kitchen to this layout.
	// 
	// Returns nothing.
    prepare() {
        console.log("GardenLayout: prepare called")
        const allShopsSprites = [
			"Menu",
			"MenuButtonExit",
			"ButtonManjericaoSagrado",
			"ButtonAmoraSilvestre",
			"ButtonLirioEncantado",
			"ButtonMargaridaApaixonante",
			"ButtonLavandaSerenante",
			"ButtonCatNip",
		]
		this.gardenShopSprites = allShopsSprites.map(i => {
			return this.runtime.objects[`GardenShop${i}`].getFirstInstance()
		});
		this.gardenShopSprites.forEach(i => { i.isInteractive = false });
		this.runtime.objects.GardenShop.getFirstInstance().isInteractive = true;
		this.neko = new NekoFSM(this.game);
        if (this.state.hasCatNip) {
            this.neko.appear();
        }
		this.state.purchasedPlants.forEach(plantName => {
			this.runtime.objects[plantName].getAllInstances().forEach(i => { i.isVisible = true })
		})

		this.game.setupPlayerAnimation('baixo');

    }

	// tick is called by the Game class on every game tick. Here we will 
	// dispatch this event to the processBeePaths, responsible for moving the 
	// bees around the apiaries, and also to the Neko FSM, in case it needs to
	// perform any action.
	// 
	// Returns nothing.
    tick() {
        this.processBeePaths();
		this.neko.tick();
    }

    // handleKeyboard is called by the Game class. Here we only check for the 
    // Esc key, which closes the shop menu.
    //
    // Returns nothing.
    handleKeyboard() {
        if (this.runtime.keyboard.isKeyDown("Escape")) {
			this.hideGardenShop();
		}
    }

    // onMouseDown is called by the Game class whenever a click is detected on 
    // the game. Here we filter targeted sprites for sprites contained within 
    // the shop, in case the shop is open, and filter out all labels and 
    // backgrounds, as they provide no interaction. Finally, we sort sprites by
    // their Z index, allowing us to pick the topmost clicked item instead of 
    // anything that may be laying underneath it. In case no hit is detected,
	// we assume the player is idle clicking, and awards a point to them, 
	// respecting any active multiplier.
    //
    // targetSprites - A list of sprites candidates to receive the click, whose
    //                 bounds are within the click coordinates.
    //
    // Returns nothing.
    onMouseDown(targetSprites) {
        if (this.isMenuOpen) {
			targetSprites = targetSprites.filter((i) => i.layer.name == "Shop");
		}

		targetSprites = targetSprites.sort((a, b) => b.zIndex - a.zIndex);

		if (targetSprites.length > 0) {
			if (!this.handleClick(targetSprites[0])) {
				if (!this.isMenuOpen) {
					this.game.updatePoints((currentPoints) => currentPoints + this.game.buffsCtrl.currentPointsMultiplier())
				}
			}
		} else {
			if (!this.isMenuOpen) {
				this.game.updatePoints((currentPoints) => currentPoints + this.game.buffsCtrl.currentPointsMultiplier())
			}
		}
    }

	// didUpdatePoints is called by the Game class whenever the amount of points
    // changes. This method is responsible for updating the HUD counter with the
    // new amount of points available to the player.
    //
    // Returns nothing.
    didUpdatePoints(points) {
        this.runtime.objects.VariablePontos.getFirstInstance().text = "Pontos: " + points.toString();
    }

    // called by onMouseDown, receives the sprite the user clicked.
	//
	// sprite - The topmost sprite the user has clicked.
    //
    // Returns whether the click has been handled by this method. When returning
	// false, onMouseDown will assume no interaction has been performed, and 
	// assume the click as in idle click. See onMouseDown for more information.
	handleClick(sprite) {
		console.log(`Caught click on ${sprite.objectType.name}`)
		switch (sprite.objectType.name) {
			case "GardenShop":
				this.showGardenShop();
				return true;

			case "GardenShopMenuButtonExit":
				console.log("GardenShopMenuButtonExit triggered")
				this.hideGardenShop();
				return true;

			case "GardenShopButtonManjericaoSagrado":
			case "GardenShopButtonAmoraSilvestre":
			case "GardenShopButtonLirioEncantado":
			case "GardenShopButtonMargaridaApaixonante":
			case "GardenShopButtonLavandaSerenante":
			case "GardenShopButtonCatNip":
				if (!this.isMenuOpen) { return false; }
				let plantName = sprite.objectType.name.replace("GardenShopButton", "");
				if (this.state.purchasedPlants.indexOf(plantName) != -1) {
					return true;
				}

				let price = this.shopPriceTable[plantName];
				if (price <= this.state.points) {
					this.game.updatePoints((pts) => pts - price);
					this.runtime.objects[plantName].getAllInstances().forEach(i => { i.isVisible = true })
					if (plantName == "CatNip") {
						this.state.hasCatNip = true;
						this.neko.appear();
					}
					this.state.purchasedPlants.push(plantName);
				}
				return true;
		}
		return false;
	}

	// Shows the Garden Shop screen
	showGardenShop() {
		this.isMenuOpen = true;
		this.gardenShopSprites.forEach(i => {
			i.isVisible = true
			i.isInteractive = true;
		});
	}

	// Hides the Garden Shop screen
	hideGardenShop() {
		if (!this.isMenuOpen) return;

		this.isMenuOpen = false;
		this.gardenShopSprites.forEach(i => {
			i.isVisible = false;
			i.isInteractive = false;
		});
	}

    // Updates the bee animations based on their position.
	processBeePaths() {
		const bees = this.runtime.objects.GardenBee.getAllInstances();
		const beeBreakpoints = [
			// X    Y    X     Y
			[1293, 227, 1171, 102],
			[1479, 229, 1316, 98]
		]

		const beeSpeed = 25;
		const updateBee = (bee, bps) => {
			const state = bee.instVars.State;
			switch (state) {
			case 0:
				bee.x += beeSpeed * this.runtime.dt;
				if (bee.x >= bps[state]) {
					bee.setAnimation("beedown");
					bee.instVars.State = 1;
				}
				break;
			case 1:
				bee.y += beeSpeed * this.runtime.dt;
				if (bee.y >= bps[state]) {
					bee.setAnimation("beeleft");
					bee.instVars.State = 2;
				}
				break;
			case 2:
				bee.x -= beeSpeed * this.runtime.dt;
				if (bee.x <= bps[state]) {
					bee.setAnimation("beeup");
					bee.instVars.State = 3;
				}
				break;
			case 3:
				bee.y -= beeSpeed * this.runtime.dt;
				if (bee.y <= bps[state]) {
					bee.setAnimation("beeright");
					bee.instVars.State = 0;
				}
				break;
			};
		}

		updateBee(bees[0], beeBreakpoints[0]);
		updateBee(bees[1], beeBreakpoints[1]);
	}
}
