export default class NekoFSM {
    constructor(game) {
        // Reference to the main game instance
        this.game = game;

        // Reference to the game runtime
        this.runtime = this.game.runtime;

        // Reference to the Neko sprite
        this.neko = this.runtime.objects.Neko.getFirstInstance();

        // Stores the last known position of Neko
        this.pos = { x: null, y: null }

        // Invokes didArrive whenever the Pathfinding operation is
        // completed.
        this.neko.behaviors.Pathfinding.addEventListener("arrived", () => this.didArrive());

        // state can be "idle", "moving", "sleeping", "scratching" or "washing"
        this.state = "idle";

        // Indicates whether Neko is present in the scene.
        this.present = false;
    }

    // Shows Neko and immediately makes it move to the player's position.
    //
    // Returns nothing.
    appear() {
        this.present = true;
        this.neko.isVisible = true;
        this.doFollowPlayer();
    }

    // Calculates the path to the Player position, and starts
    // moving along said path.
    //
    // Returns nothing.
    doFollowPlayer() {
        if (!this.present) return;
        this.state = "moving";
        const player = this.game.getPlayer();

        // x position gets 100 extra pixels so Neko does not stay
        // on top of the player.
        this.neko.behaviors.Pathfinding.findPath(player.x + 100, player.y)
            .then(ok => {
			    if (!ok) { 
                    console.error("Neko Pathfinding failed.");
                    return;
			    }
                console.log("Neko: Pathfinding start")
				this.neko.behaviors.Pathfinding.startMoving();
		    })
    }

    // didArrive is called whenever the pathfinding algorithm has completed
    // moving the Neko character to its destination point. It then triggers the
    // `idle` state, and continues to other states as required.
    //
    // Returns nothing.
    didArrive() {
        console.log("Neko: Pathfinding end");
        this.neko.setAnimation("awake");
        console.log("Neko: Idle");
        this.state = "idle";
        this.idleSince = Date.now();
    }

    // updateAnimation is called automatically to perform a given animation, and
    // determine which next animation is to be performed, based on the current
    // NPC status.
    //
    // Returns nothing.
    updateAnimation() {
        if (!this.present) return;
        const idleDelta = Date.now() - this.idleSince;
        switch (this.state) {
            case "moving":
                this.updateMovingAnimation();
                break;
            case "idle":
                if (idleDelta > 1000) {
                    this.scratchOrWash();
                }
                break;
            case "scratching":
                if (idleDelta > 1000) {
                    this.wash();
                }
                break;
            case "washing":
                if (idleDelta > 1000) {
                    this.sleep();
                }
                break;
        }

        const distance = this.distanceToPlayer();
        if (this.state != "moving") {
            if (distance > 300) {
                this.doFollowPlayer();
            }
        }
    }

    // scratchOrWash either switches the NPC to the `scraching` or `washing` 
    // state with a 50% probability. `scratch` automatically transitions to 
    // `washing`, and `washing` automatically transitions to `sleeping`.
    //
    // Returns nothing.
    scratchOrWash() {
        if (Math.random() < 0.5) {
            this.scratch();
            return;
        }

        this.wash();
    }

    // scratch updates the NPC's state to `scratching`. The FSM will then 
    // automatically transition to `washing` after its timeout elapses.
    //
    // Returns nothing.
    scratch() {
        console.log("Neko: scratching");
        this.state = "scratching";
        this.idleSince = Date.now();
        this.neko.setAnimation("scratch");
    }

    // sleep updates the NPC's state to `sleeping`, which is the final state
    // until the player walks past the threshold of the NPC; when this happens,
    // the NPC wakes up and starts following the player again, until it gets 
    // back to the `idle` state.
    //
    // Returns nothing.
    sleep() {
        console.log("Neko: sleeping");
        this.state = "sleeping";
        this.idleSince = Date.now();
        this.neko.setAnimation("sleep");
    }

    // wash updates the NPC's state to `washing`, and automatically transitions
    // to the `sleeping` state as required.
    //
    // Returns nothing.
    wash() {
        console.log("Neko: washing");
        this.state = "washing";
        this.idleSince = Date.now();
        this.neko.setAnimation("wash");
    }

    // Determines to which position Neko is moving towards, and updates
    // its animation accordingly.
    //
    // Returns nothing.
    updateMovingAnimation() {
        if (this.pos.x == null || this.pos.y == null) {
            this.pos.x = this.neko.x;
            this.pos.y = this.neko.y;
            return;
        }

        const dx = this.neko.x - this.pos.x;
        const dy = this.neko.y - this.pos.y;

        this.pos.x = this.neko.x;
        this.pos.y = this.neko.y;

        const angle = Math.atan2(dy, dx);
        const deg = (angle * 180 / Math.PI + 360) % 360;

		let direction = "";
		if (deg >= 337.5 || deg < 22.5) direction = "right";
		else if (deg < 67.5) direction = "downright";
		else if (deg < 112.5) direction = "down";
		else if (deg < 157.5) direction = "downleft";
		else if (deg < 202.5) direction = "left";
		else if (deg < 247.5) direction = "upleft";
		else if (deg < 292.5) direction = "up";
		else direction = "upright";

        if (this.neko.animationName != direction) {
            this.neko.setAnimation(direction);
        }
    }

    // tick is called on every game tick, so we can update the NPC's animation
    // to correctly point it to the path it's following.
    //
    // Returns nothing.
    tick() {
        this.updateAnimation();
    }

    // Calculates the Euclidean distance between Neko and the player.
    //
    // Returns the distance between the NPC and the player.
    distanceToPlayer() {
        const player = this.game.getPlayer();
        const dx = Math.abs(this.neko.x - player.x);
        const dy = Math.abs(this.neko.y - player.y);
        return Math.hypot(dx, dy);
    }
}