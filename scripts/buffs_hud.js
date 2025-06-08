// BuffsHUD is responsible for orchestrating changes to the HUD that displays
// buffs statuses.
export default class BuffsHUD {
    constructor(game) {
        this.game = game;
        this.runtime = game.runtime;
        this.buffsCtrl = game.buffsCtrl;
        this.ready = false;
    }

    // prepare attempts to obtain all objects required for this class to work. 
    // This is usually called by the Game class after a layout has transitioned,
    // and its components have been laid and are ready to be accssed.
    // This method emits a warning on the console in case one or more objects 
    // are absent from the layout, without impacting the game.
    //
    // Returns nothing.
    prepare() {
        try {
            const objs = this.runtime.objects;
            const allFrames = objs.BuffFrame.getAllInstances();

            this.buffMeowFrame = allFrames.find((fr) => fr.getAllTags().has("2"));
            if (!this.buffMeowFrame) {
                debugger;
                throw new Error("Unable to find BuffFrame with tag 2");
            }
            this.buffMeowIcon = objs.BuffMeow.getFirstInstance();

            this.buffPointsFrame = allFrames.find((fr) => fr.getAllTags().has("1"));
            if (!this.buffPointsFrame) {
                debugger;
                throw new Error("Unable to find BuffFrame with tag 1");
            }

            this.buffPointsIcon = objs.BuffPointsMultiplier.getFirstInstance();
            this.buffPointsLabel = objs.BuffPointsMultiplierLabel.getFirstInstance();
            this.buffPointsBg = objs.BuffPointsMultiplierBg.getFirstInstance();
            this.ready = true;
        } catch (ex) {
            console.warn("BuffsHUD: Failed preparing:", ex);
            this.ready = false;
        }
    }

    // update is called by the Game class to update the state of active buffs,
    // realign them, toggle their visibility, and update their remaining active
    // time, and where appliable, its current multiplier. This function is also
    // responsible for keeping buffs ordered in the HUD, making sure they don't
    // overlap and always follow a predictable order when more than one buff is
    // active.
    //
    // Returns nothing.
    update() {
        if (!this.ready) { return }
        let y = 58;

        if (this.buffsCtrl.currentPointsMultiplier() != 1) {
            this.buffPointsFrame.isVisible = true;
            this.buffPointsIcon.isVisible = true;
            this.buffPointsBg.isVisible = true;
            this.buffPointsLabel.text = `x${this.buffsCtrl.currentPointsMultiplier()}`;
            this.buffPointsLabel.isVisible = true;

            const fullHeight = 64;
            const progress = this.buffsCtrl.largestMultiplierPercent() / 100;
            const currentHeight = fullHeight * progress;
            const offset = (fullHeight - currentHeight) / 2;
            this.buffPointsBg.height = currentHeight;
            this.buffPointsBg.y = 58 + offset;
            y = 146;
		} else {
            this.buffPointsFrame.isVisible = false;
            this.buffPointsIcon.isVisible = false;
            this.buffPointsBg.isVisible = false;
            this.buffPointsLabel.isVisible = false;
		}

        if (this.game.state.hadCatNipTea) {
            this.buffMeowIcon.y = y;
            this.buffMeowFrame.y = y;
            this.buffMeowIcon.isVisible = true;
            this.buffMeowFrame.isVisible = true;
        } else {
            this.buffMeowIcon.isVisible = false;
            this.buffMeowFrame.isVisible = false;
        }
    }
}
