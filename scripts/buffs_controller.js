import { millisToFormattedTime } from "./time_utils.js";

// BuffsController is responsible for maintaining state for all buffs and 
// cooldowns, abstracting intricacies with utility methods.
export default class BuffsController {
    constructor(game) {
        this.game = game;
        this.state = game.state;
        this.cooldowns = this.state.cooldowns;
    }

    // resetCooldowns removes all active cooldowns from the game's state.
    // 
    // Returns nothing.
    resetCooldowns() { this.eachCooldown(k => delete this.state.cooldowns[k]); }

    // hasActiveCooldown returns whether a cooldown with a given name is
    // present in the current game state.
    //
    // name - The cooldown name to lookup.
    //
    // Returns a boolean indicating whether the cooldown is present (active) or
    // not.
    hasActiveCooldown(name) { return !!this.state.cooldowns[name]; }

    // extendCooldowns extends each active cooldown by a provided factor.
    //
    // factor - the factor to extend the cooldown for. For instance, 0.2 extends
    //          each cooldown by +20%.
    //
    // Returns nothing.
    extendCooldowns(factor) { this.eachCooldown((_, c) => c.extend(factor)) };

    // extendBuffs extends each active buff by a provided factor.
    //
    // factor - The factor to extend buffs by. For instance, 0.2 extends each
    //          buff duration by +20%.
    //
    // Returns nothing.
    extendBuffs(factor) { this.state.buffs.forEach(b => b.extend(factor)); }

    // eachBuff invokes a given function with each active buff.
    //
    // fn - a function that receives a single parameter. The function will be 
    //      called N times, where N is the amount of active buffs. Each call
    //      will have a differen buff to be processed by the predicate.
    //
    // Returns nothing.
    eachBuff(fn) { this.state.buffs.forEach(b => fn(b)) }

    // pushCooldown pushes a cooldown to the Cooldowns list, and keeps it
    // active for the amount of time provided in duration. Adding cooldowns with
    // the same name replaces any currently active cooldown with the same name.
    //
    // Returns nothing.
    pushCooldown(name, duration) {
        this.state.cooldowns[name] = new CooldownState(name, duration);
    }

    // pushBuff pushes a buff with a provided name, and optional value, and 
    // duration. A buff without a duration will never expire. The provided value
    // can be of any value, although it is recommended to use serializable, 
    // primitive values in order to aid serializing and deserializing the game
    // state.
    //
    // name     - Name of the buff to be pushed.
    // value    - Arbitrary value of the buff.
    // duration - Optional duration of the buff.
    //
    // For instance, to push a point multiplier buff, use:
    //    pushBuff("points_multiplier", 100, 30000)
    // The call above will create a 100x multiplier for 30 seconds.
    //
    // Returns nothing.
    pushBuff(name, value, duration) {
        if (!duration) {
            duration = 0;
        }
        this.state.buffs.push(new Buff(name, value, duration));
    }

    // eachCooldown iterates over all active cooldowns and invokes the provided
    // function providing two positional arguments: the first argument is the 
    // cooldown name, and the second is an instance of CooldownState 
    // representing the cooldown itself.
    //
    // fn - function to receive each of the cooldowns.
    //
    // Returns nothing.
    eachCooldown(fn) {
        Object
            .keys(this.state.cooldowns)
            .forEach(k => fn(k, this.state.cooldowns[k]));
    }

    // currentPointsMultiplier filters all points multiplier buffs, and returns
    // the effective multiplier for each gained point. For instance, having
    // four multipliers with values 2, 3, 2, and 3 makes this function return 
    // 36 (2 * 3 * 2 * 3).
    //
    // Returns the per-point multiplier based on the amount of points multiplier
    // buffs currently active. If no buffs of this kind are active, returns 1.
    currentPointsMultiplier() {
        return this.state.buffs
            .filter(buff => buff.name == "points_multiplier" && !buff.expired())
            .reduce((acc, buff) => acc * buff.value, 1)
    }

    // largestMultiplierPercent returns the maximum percentage left among all
    // points multiplier buffs. If no points multiplier buff is active, returns
    // zero.
    //
    // Returns the greatest percentil left among all points multipliers, if any.
    // Otherwise, returns zero.
    largestMultiplierPercent() {
        return this.state.buffs
            .filter(buff => buff.name == "points_multiplier" && !buff.expired())
            .map(buff => buff.percentLeft())
            .reduce((v, acc) => Math.max(v, acc), 0)
    }

    debug() {
        if (this.lastDebug && Date.now() - this.lastDebug < 1000) {
            return;
        }
        this.lastDebug = Date.now();
        let cds = Object
            .keys(this.state.cooldowns)
            .map(k => `${k}: ${this.state.cooldowns[k].toString()}`).join(",")
        console.log(`${Date.now()} - multiplier: ${this.currentPointsMultiplier()}, cooldowns: {${cds}}, buffs: [${this.state.buffs.map(i => i.toString())}]`);
    }

    // tick is called by the Game class on every game tick. This method is 
    // responsible for cleaning up cooldowns and buffs as required.
    //
    // Returns nothing.
    tick() {
        this.debug();
        this.eachCooldown((k, v) => {
            if (v.expired()) {
                delete this.state.cooldowns[k];
            }
        });

        this.state.buffs
            .filter(b => b.expired())
            .map(b => this.state.buffs.indexOf(b))
            .sort()
            .reverse()
            .forEach(i => this.state.buffs.splice(i, 1));
    }
}

// CooldownState stores information regarding a single cooldown.
class CooldownState {
    constructor(name, duration) {

        // The name of the cooldown
        this.name = name;
        
        // The date in which it expires.
        this.expiresAt = Date.now() + duration;

        // The duration of the cooldown.
        this.duration = duration;
    }

    // expired returns whether this cooldown has already expired.
    expired() { return this.expiresAt - Date.now() <= 0; }

    // extend extends both `expiresAt` and `duration` by a given factor.
    //
    // factor - a value between 0 and 1 indicating the percentage in which the
    //          value will be extended by.
    //
    // Returns nothing.
    extend(factor) {
        this.expiresAt += this.duration * factor;
        this.duration += this.duration * factor;
    }

    // timeLeft returns the amount of time left before this Cooldown expires
    // in a human-readable format. See millisToFormattedTime in time_utils.js.
    //
    // Returns a string in the format H:MM:SS.
    timeLeft() {
        return millisToFormattedTime(this.expiresAt - Date.now());
    }

    toString() {
        return `{name: ${this.name}, expiresAt: ${this.expiresAt}, expired: ${this.expired()}, timeLeft: ${this.timeLeft()}}`
    }
}

// Buff represents a named buf with an arbitrary value and optional duration.
class Buff {
    constructor(name, value, duration) {
        // The name of the buff
        this.name = name;

        // An arbitrary value for the buff. For instance, for points multiplier
        // buffs, this value is an integer indicating the multiplication factor.
        this.value = value;

        // createdAt represents the timestamp in which this buff has been 
        // created.
        this.createdAt = Date.now();

        // expiresAt represents the timestamp in which this buff expires.
        this.expiresAt = this.createdAt + duration;

        // duration represents the total duration of the buff.
        this.duration = duration;
    }

    // expired returns whether the Buff has expired. In case the buff does not
    // have a duration, this method always returns false.
    expired() { return this.duration != 0 && this.expiresAt <= Date.now(); }

    // extend extends both `expiresAt` and `duration` by a given factor.
    //
    // factor - a value between 0 and 1 indicating the percentage in which the
    //          value will be extended by.
    //
    // Returns nothing.
    extend(factor) {
        this.expiresAt += this.duration * factor;
        this.duration += this.duration * factor;
    }

    // percentLeft returns a number indicating the percentage left for the buff.
    // This value is calculated through a delta of the duration. For buffs with
    // zero duration, this method always returns 100.
    percentLeft() {
        if (this.duration == 0) { return 100; }
        const remaining = this.expiresAt - Date.now();
        return Math.max(0, Math.min(1, remaining / this.duration)) * 100;
    }

    toString() {
        return `{name: ${this.name}, value: ${this.value}, expiresAt: ${this.expiresAt}, createdAt: ${this.createdAt}, expired: ${this.expired()}, percentLeft: ${this.percentLeft()}}`
    }
}
