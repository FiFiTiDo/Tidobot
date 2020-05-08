import Message from "../../Chat/Message";
import * as tmi from "tmi.js";
import TwitchAdapter from "./TwitchAdapter";
import deepmerge from "deepmerge";
import {helix, kraken} from "./TwitchApi";
import moment from "moment-timezone";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import {ResponseFactory} from "../../Chat/Message";
import {Role} from "../../Systems/Permissions/Role";
import Logger from "../../Utilities/Logger";
import IStream = helix.Stream;
import {ExpressionContext} from "../../Systems/Expressions/ExpressionSystem";

export class TwitchMessage extends Message {
    private api: helix.Api;
    private oldApi: kraken.Api;

    constructor(
        message: string, chatter: ChatterEntity, channel: ChannelEntity, private readonly userstate: tmi.ChatUserstate,
        adapter: TwitchAdapter, responseFactory: ResponseFactory
    ) {
        super(message, chatter, channel, adapter, responseFactory);

        this.api = adapter.api;
        this.oldApi = adapter.oldApi;
    }

    public async getUserRoles(): Promise<Role[]> {
        const levels = await super.getUserRoles();

        if (this.userstate.badges.premium) levels.push(Role.PREMIUM);
        if (this.userstate.badges.turbo) levels.push(Role.PREMIUM);
        if (this.userstate.badges.subscriber) levels.push(Role.SUBSCRIBER);
        if (this.userstate.badges.moderator) levels.push(Role.MODERATOR);
        if (this.userstate.badges.global_mod) levels.push(Role.MODERATOR);
        if (this.userstate.badges.staff) levels.push(Role.ADMIN);
        if (this.userstate.badges.admin) levels.push(Role.ADMIN);
        if (this.userstate.badges.broadcaster) levels.push(Role.BROADCASTER);
        if (this.userstate.username.toLowerCase() === "fifitido") levels.push(Role.OWNER);

        return levels;
    }

    public getUserState(): tmi.ChatUserstate {
        return this.userstate;
    }

    public async getExpressionContext(): Promise<ExpressionContext> {
        const getStreamProperty = async (key: keyof IStream): Promise<string|number|string[]> => {
            try {
                const chanResp = await this.api.getStreams({user_id: this.getChannel().channelId});
                if (chanResp.data.length > 0) {
                    const chanData = chanResp.data[0];

                    return chanData[key];
                } else {
                    return "Channel is not live.";
                }
            } catch (e) {
                Logger.get().error("Twitch API error", {cause: e});
                return "<<An error has occurred with the Twitch API.>>";
            }
        };

        const ctx: ExpressionContext = {
            channel: {
                getTitle: (): Promise<string> => getStreamProperty("title") as Promise<string>,
                getGame: async (): Promise<string> => {
                    try {
                        const chanResp = await this.api.getStreams({user_id: this.getChannel().channelId});
                        if (chanResp.data.length > 0) {
                            const chanData = chanResp.data[0];
                            const gameResp = await this.api.getGames({id: chanData.game_id});
                            const gameData = gameResp.data[0];

                            return gameData.name;
                        } else {
                            return "Channel is not live.";
                        }
                    } catch (e) {
                        Logger.get().error("Twitch API error", {cause: e});
                        return "<<An error has occurred with the Twitch API.>>";
                    }
                },
                getViewerCount: (): Promise<number> => getStreamProperty("viewer_count") as Promise<number>
            },
            sender: {
                getFollowAge: async (format?: string): Promise<string> => {
                    return this.api.getUserFollow({
                        from_id: this.getChatter().userId,
                        to_id: this.getChannel().channelId
                    }).then(async resp => {
                        if (resp.total < 1) return "Sender is not following the channel.";
                        const timezone = await this.getChannel().getSetting<moment.MomentZone>("timezone");
                        return moment.parseZone(resp.data[0].followed_at, timezone.name).format(format ? format : "Y-m-d h:i:s");
                    }).catch(e => {
                        Logger.get().error("Unable to determine follow age", {cause: e});
                        return "Cannot determine follow age.";
                    });
                },
                isFollowing: async(): Promise<boolean> => {
                    return this.api.getUserFollow({
                        from_id: this.getChatter().userId,
                        to_id: this.getChannel().channelId
                    }).then(async resp => resp.total > 0).catch(e => {
                        Logger.get().error("Unable to determine if the user is following", {cause: e});
                        return false;
                    });
                }
            }
        };

        return deepmerge(await super.getExpressionContext(), ctx);
    }
}

export interface TwitchMessageFactory {
    (message: string, chatter: ChatterEntity, channel: ChannelEntity, userstate: tmi.ChatUserstate): TwitchMessage;
}