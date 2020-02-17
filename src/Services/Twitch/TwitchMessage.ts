import Message from "../../Chat/Message";
import * as tmi from 'tmi.js'
import Chatter from "../../Chat/Chatter";
import {PermissionLevel} from "../../Modules/PermissionModule";
import TwitchAdapter from "./TwitchAdapter";
import Application from "../../Application/Application";
import deepmerge from "deepmerge";
import Channel from "../../Chat/Channel";
import {helix, kraken} from "./TwitchApi";
import {ExpressionContext} from "../../Modules/ExpressionModule";
import moment from "moment-timezone";
import IStream = helix.IStream;

export class TwitchMessage extends Message {
    private readonly userstate: tmi.ChatUserstate;
    private api: helix.Api;
    private oldApi: kraken.Api;

    constructor(message: string, chatter: Chatter, channel: Channel, userstate: tmi.ChatUserstate, adapter: TwitchAdapter) {
        super(message, chatter, channel, adapter);

        this.userstate = userstate;
        this.api = adapter.api;
        this.oldApi = adapter.oldApi;
    }

    public async getUserLevels(): Promise<PermissionLevel[]> {
        let levels = await super.getUserLevels();

        if (this.userstate.badges.premium) levels.push(PermissionLevel.PREMIUM);
        if (this.userstate.badges.turbo) levels.push(PermissionLevel.PREMIUM);
        if (this.userstate.badges.subscriber) levels.push(PermissionLevel.SUBSCRIBER);
        if (this.userstate.badges.moderator) levels.push(PermissionLevel.MODERATOR);
        if (this.userstate.badges.global_mod) levels.push(PermissionLevel.MODERATOR);
        if (this.userstate.badges.staff) levels.push(PermissionLevel.ADMIN);
        if (this.userstate.badges.admin) levels.push(PermissionLevel.ADMIN);
        if (this.userstate.badges.broadcaster) levels.push(PermissionLevel.BROADCASTER);
        if (this.userstate.username.toLowerCase() === "fifitido") levels.push(PermissionLevel.OWNER);

        return levels;
    }

    public getUserState(): tmi.ChatUserstate {
        return this.userstate;
    }

    public async getExpressionContext(): Promise<ExpressionContext> {
        const getStreamProperty = async (key: keyof IStream) => {
            try {
                let chanResp = await this.api.getStreams({user_id: this.getChannel().getId()});
                if (chanResp.data.length > 0) {
                    let chanData = chanResp.data[0];

                    return chanData[key];
                } else {
                    return "Channel is not live."
                }
            } catch (e) {
                Application.getLogger().error("Twitch API error", {cause: e});
                return "<<An error has occurred with the Twitch API.>>";
            }
        };

        let ctx: ExpressionContext = {
            channel: {
                getTitle: async () => getStreamProperty("title"),
                getGame: async () => {
                    try {
                        let chanResp = await this.api.getStreams({user_id: this.getChannel().getId()});
                        if (chanResp.data.length > 0) {
                            let chanData = chanResp.data[0];
                            let gameResp = await this.api.getGames({id: chanData.game_id});
                            let gameData = gameResp.data[0];

                            return gameData.name;
                        } else {
                            return "Channel is not live."
                        }
                    } catch (e) {
                        Application.getLogger().error("Twitch API error", {cause: e});
                        return "<<An error has occurred with the Twitch API.>>";
                    }
                },
                getViewerCount: async () => getStreamProperty("viewer_count")
            },
            sender: {
                getFollowAge: async (format?: string) => {
                    return this.api.getUserFollow({
                        from_id: this.getChatter().getId(),
                        to_id: this.getChannel().getId()
                    }).then(async resp => {
                        let timezone = await this.getChannel().getSettings().get("timezone") as moment.MomentZone;
                        return moment.parseZone(resp.data[0].followed_at, timezone.name).format(format ? format : "Y-m-d h:i:s");
                    }).catch(e => {
                        Application.getLogger().error("Unable to determine follow age", {cause: e});
                        return "Cannot determine follow age."
                    })
                }
            }
        };

        return deepmerge(await super.getExpressionContext(), ctx);
    }
}