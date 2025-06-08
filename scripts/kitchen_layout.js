import { millisToFormattedTime } from "./time_utils.js";

// KitchenLayout contains all the required logic for the Layout Kitchen scene.
export default class KitchenLayout {
    constructor(game) {
        this.game = game;
        this.runtime = game.runtime;
        this.state = game.state;
        this.shopSprites = [];
        this.isMenuOpen = false;

        // flowersButtonsMap contains a map of which flower which shop button
        // reffers to.
        this.flowersButtonsMap = {
            "ManjericaoSagrado": 1,
            "AmoraSilvestre": 2,
            "LirioEncantado": 3,
            "MargaridaApaixonante": 4,
            "LavandaSerenante": 5,
            "CatNip": 6,
        };

        // teaPrices contains the price for each of the teas offerred in the
        // shop menu.
        this.teaPrices = {
            "ManjericaoSagrado": 150,
            "AmoraSilvestre": 500,
            "LirioEncantado": 800,
            "MargaridaApaixonante": 1200,
            "LavandaSerenante": 1600,
            "CatNip": 2000,
        }

        // Utility functions: Converts seconds, minutes, and hours to 
        // milliseconds.
        const seconds = (val) => val * 1000;
        const minutes = (val) => seconds(val * 60); // * 60 seconds -> milli
        const hours = (val) => minutes(val * 60); // * 60 minutes -> milli

        // teaCooldown determines the amount of cooldown required for each tea.
        this.teaCooldown = {
            "ManjericaoSagrado": minutes(15),
            "AmoraSilvestre": minutes(15),
            "LirioEncantado": minutes(30),
            "MargaridaApaixonante": hours(2),
            "LavandaSerenante": hours(12),
            "CatNip": 0,
        }
        
        // teaDuration defines the base duration for each of the teas. Teas with
        // a zeored duration do not apply an effect to the player, so no 
        // duration is required.
        this.teaDuration = {
            "ManjericaoSagrado": seconds(30),
            "AmoraSilvestre": 0,
            "LirioEncantado": 0,
            "MargaridaApaixonante": seconds(30),
            "LavandaSerenante": 0,
            "CatNip": 0,
        }

        // buttonsToFlowersMap is dynamically filled with the contents of 
        // flowersButtonsMap, but inverting its key and values.
        this.buttonsToFlowersMap = {};
        Object
            .keys(this.flowersButtonsMap)
            .forEach(k => this.buttonsToFlowersMap[this.flowersButtonsMap[k]] = k);
    }

    // layoutName returns the name of the layout to be used with this class.
    layoutName() { return "Layout Kitchen" }

    // hasPlant returns whether the player has purchased a plant with a given 
    // name.
    //
    // name - name of the plant to check for. For instance, "ManjericaoSagrado"
    //
    // Returns a boolean indicating whether the plant has already been 
    // purchased.
    hasPlant(name) { return this.state.purchasedPlants.indexOf(name) > -1 }

    // secondTick is called by the Game class every second; this method updates
    // the shopButtons states, and also the cooldown timers for each tea in the 
    // shop.
    //
    // Returns nothing.
    secondTick() {
        this.updateCooldowns();
        this.updateShopButtons();
    }

    // updateCooldowns iterates each shop button, and for buttons containing a 
    // cooldown timer, either shows how long the player has to wait until it can
    // use the tea again, or, if the tea has not been consumed, how long they 
    // will have to wait once the tea is consumed.
    //
    // Returns nothing.
    updateCooldowns() {
        Object.keys(this.flowersButtonsMap)
            .forEach(name => {
                let target = this.runtime.objects[`KitchenShopButton${this.flowersButtonsMap[name]}CooldownLabel`];
                if (!target) { return }
                target = target.getFirstInstance();

                let left;
                if (this.game.buffsCtrl.hasActiveCooldown(name)) {
                    left = this.game.buffsCtrl.cooldowns[name].timeLeft();
                } else {
                    left = millisToFormattedTime(this.teaCooldown[name]);
                }
                target.text = left;
            });
    }

    // prepare is automatically called by the Game class once the Layout is 
    // ready. Here we prepare a few internal variables in order to help us
    // on other methods.
    prepare() {
        this.shopSprites = [
            "KitchenShop",
        ]
        for (let i = 1; i < 7; i++) {
            this.shopSprites.push(
                `KitchenShopButton${i}BaseText`, 
                `KitchenShopButton${i}Bg`, 
                `KitchenShopButton${i}CooldownLabel`
            );
        }

        // Button6 does not have a CooldownLabel
        this.shopSprites.pop();

        this.shopSprites = this.shopSprites.map(i => {
            let obj = this.runtime.objects[i];
            if (!obj) {
                console.warn("KitchenLayout: Object not found:", i)
                return;
            }
            return obj.getFirstInstance();
        });

        this.updateShopButtons();

        this.game.setupPlayerAnimation('dir');
    }

    // tick is called by the Game class on every game tick. As we have no need
    // to perform actions on this method, it is left empty to conform to the
    // "Layout" interface. (See the README for more information on this.)
    tick() {}

    // updateShopButtons updates each of the shop buttons to their 
    // enabled/disabled states based on what the canBuy method returns. An item
    // may not be available for sale for the player does not have the required 
    // plant, does not have the required amount of points, or the item has 
    // already been consumed and is on its cooldown.
    //
    // Returns nothing.
    updateShopButtons() {
        Object.keys(this.flowersButtonsMap).forEach(name => {
            const canBuy = this.canBuy(name);
            const opacity = canBuy ? 1 : 0.5;
            const animationName = canBuy ? "Enabled" : "Disabled";
            this.runtime.objects[`KitchenShopButton${this.flowersButtonsMap[name]}Bg`].getFirstInstance().setAnimation(animationName);
            this.runtime.objects[`KitchenShopButton${this.flowersButtonsMap[name]}BaseText`].getFirstInstance().opacity = opacity;
        });
    }

    // handleKeyboard is called by the Game class. Here we only check for the 
    // Esc key, which closes the shop menu.
    //
    // Returns nothing.
    handleKeyboard() {
        if (this.runtime.keyboard.isKeyDown("Escape")) {
			this.hideShop();
		}
    }

    // onMouseDown is called by the Game class whenever a click is detected on 
    // the game. Here we filter targeted sprites for sprites contained within 
    // the shop, in case the shop is open, and filter out all labels and 
    // backgrounds, as they provide no interaction. Finally, we sort sprites by
    // their Z index, allowing us to pick the topmost clicked item instead of 
    // anything that may be laying underneath it.
    //
    // targetSprites - A list of sprites candidates to receive the click, whose
    //                 bounds are within the click coordinates.
    //
    // Returns nothing.
    onMouseDown(targetSprites) {
        if (this.isMenuOpen) {
			targetSprites = targetSprites.filter((i) => i.layer.name == "ShopView");
		}
        targetSprites = targetSprites.filter((i) => i.objectType.name.indexOf("Label") == -1 && i.objectType.name.indexOf("Bg") == -1);

        targetSprites = targetSprites.sort((a, b) => b.zIndex - a.zIndex);

		if (targetSprites.length == 0) {
            return;
        }

		this.handleClick(targetSprites[0]);
    }

    // didUpdatePoints is called by the Game class whenever the amount of points
    // changes. This method is responsible for updating the HUD counter with the
    // new amount of points available to the player.
    //
    // Returns nothing.
    didUpdatePoints(points) {
        this.runtime.objects.VariablePontos.getFirstInstance().text = "Pontos: " + points.toString();
    }

    // canBuy determines whether a tea can be purchased by the player.
    //
    // plantName - The name of the tea ingredient required for brewing the tea.
    //
    // Returns a boolean indicating whether the player may buy said tea. In 
    // order to be allowed, the player must have purchased the base plant, have
    // the amount of points required to prepare the tea, and also not be within
    // the tea cooldown period.
    canBuy(plantName) {
        return this.hasPlant(plantName)
            && this.game.state.points >= this.teaPrices[plantName]
            && !this.game.buffsCtrl.hasActiveCooldown(plantName);
    }

    // buyTea performs the operation of buying and applying effects for the
    // selected tea. Each tea has a different effect, which can be observed in
    // switch-case below.
    //
    // plantName -  The name of the tea ingredient required for brewing the tea.
    //
    // Returns nothing.
    buyTea(plantName) {
        if (!this.canBuy(plantName)) { return }
        this.game.updatePoints((old) => old - this.teaPrices[plantName]);
        switch (plantName) {
        case "ManjericaoSagrado":
            this.game.buffsCtrl.pushBuff("points_multiplier", 2, this.teaDuration[plantName]);
            break;
        case "AmoraSilvestre":
            this.game.buffsCtrl.extendBuffs(0.2);
            break;
        case "LirioEncantado":
            this.game.buffsCtrl.extendCooldowns(-0.2);
            break;
        case "MargaridaApaixonante":
            this.game.buffsCtrl.pushBuff("points_multiplier", 3, this.teaDuration[plantName]);
            break;
        case "LavandaSerenante":
            this.game.buffsCtrl.resetCooldowns();
            break;
        case "CatNip":
            this.game.state.hadCatNipTea = true;
            this.game.setupPlayerAnimation(this.game.getPlayer().animationName.replace('-gato', ''));
        }

        // Keep this as the last instruction, since otherwise we would also
        // reset the cooldown for LavandaSerenante, which would be bad.
        this.game.buffsCtrl.pushCooldown(plantName, this.teaCooldown[plantName]);
        this.updateShopButtons();
    }

    // handleClick is the last step of the procesing of a user click. It 
    // receives the topmost sprite clicked, which is then checked in the 
    // switch-case below, and handled accordingly.
    //
    // sprite - The topmost sprite the user has clicked.
    //
    // Returns nothing.
    handleClick(sprite) {
        console.log("KitchenLayout: handleClick", sprite);
        let plantName;
        switch (sprite.objectType.name) {
        case "StoveButton":
            this.showShop();
            break;
        case "KitchenShopButton1BaseText": // Manjericão Sagrado
            plantName = this.buttonsToFlowersMap[1];
            this.buyTea(plantName);
            break;
        case "KitchenShopButton2BaseText": // Amora Silvestre
            plantName = this.buttonsToFlowersMap[2];
            this.buyTea(plantName);
            break;
        case "KitchenShopButton3BaseText": // Lírio Encantado
            plantName = this.buttonsToFlowersMap[3];
            this.buyTea(plantName);
            break;
        case "KitchenShopButton4BaseText": // Margarida Apaixonante
            plantName = this.buttonsToFlowersMap[4];
            this.buyTea(plantName);
            break;
        case "KitchenShopButton5BaseText": // Lavanda Serenante
            plantName = this.buttonsToFlowersMap[5];
            this.buyTea(plantName);
            break;
        case "KitchenShopButton6BaseText": // Miausterioso
            plantName = this.buttonsToFlowersMap[6];
            this.buyTea(plantName);
            break;
        }
    }

    // showShop is responsible for showing the shop menu, and making all its
    // sprites visible.
    //
    // Returns nothing.
    showShop() {
		this.isMenuOpen = true;
		this.shopSprites.forEach(i => { i.isVisible = true });
    }

    // hideShop hides all shop sprites.
    //
    // Returns nothing.
    hideShop() {
        console.log("KitchenLayout: hideShop")
        if (!this.isMenuOpen) { return }
		this.isMenuOpen = false;
		this.shopSprites.forEach(i => { i.isVisible = false });
    }
}
