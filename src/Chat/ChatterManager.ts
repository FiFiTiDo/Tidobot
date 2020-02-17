import Chatter from "./Chatter";
import Channel from "./Channel";

export default class ChatterManager {
    private readonly chatters: { [key: string]: Chatter[] };

    constructor() {
        this.chatters = {};
    }

    has(chatter: Chatter) {
        for (let chatter2 of this.getAll(chatter.getChannel()))
            if (chatter.is(chatter2))
                return true;
        return false;
    }

    add(chatter: Chatter) {
        if (!this.chatters.hasOwnProperty(chatter.getChannel().getId())) this.chatters[chatter.getChannel().getId()] = [];
        if (this.has(chatter)) return;

        this.chatters[chatter.getChannel().getId()].push(chatter);
    }

    remove(chatter: Chatter) {
        let chatters = this.getAll(chatter.getChannel());
        for (let i = 0; i < chatters.length; i++) {
            let chatter2 = chatters[i];
            if (chatter.is(chatter2)) {
                this.chatters[chatter.getChannel().getId()].splice(i, 1);
                return true;
            }
        }
        return false;
    }

    getAll(channel: Channel) {
        return this.chatters.hasOwnProperty(channel.getId()) ? this.chatters[channel.getId()] : [];
    }

    findByName(name: string, channel: Channel) {
        for (let chatter of this.getAll(channel))
            if (chatter.getName().toLowerCase() === name.toLowerCase())
                return chatter;
        return null;
    }
}