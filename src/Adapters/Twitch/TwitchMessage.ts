import Message from "../../Chat/Message";
import * as tmi from "tmi.js";
import TwitchAdapter from "./TwitchAdapter";
import {helix} from "./TwitchApi";
import moment from "moment-timezone";
import {Role} from "../../Systems/Permissions/Role";
import {ExpressionContext} from "../../Systems/Expressions/ExpressionSystem";
import Stream = helix.Stream;
import ChannelInformation = helix.ChannelInformation;
import { Chatter } from "../../Database/Entities/Chatter";
import { Channel } from "../../Database/Entities/Channel";
import { logError } from "../../Utilities/Logger";
import GeneralModule from "../../Modules/GeneralModule";
import _ from "lodash";

export class TwitchMessage extends Message {
    private api: helix.Api;

    constructor(
        message: string, chatter: Chatter, channel: Channel, private readonly userstate: tmi.ChatUserstate,
        adapter: TwitchAdapter
    ) {
        super(message, chatter, channel, adapter);

        this.api = adapter.api;

        if (userstate.emotes) {
            let stripped = message;
            for (const emote of Object.keys(userstate.emotes))
                stripped = stripped.replace(emote, "");
            this.stripped = stripped;
        }
    }

    public async getUserRoles(): Promise<Role[]> {
        const levels = await super.getUserRoles();

        const badges = this.userstate.badges || {};
        if (badges.premium) levels.push(Role.PREMIUM);
        if (badges.turbo) levels.push(Role.PREMIUM);
        if (badges.subscriber) levels.push(Role.SUBSCRIBER);
        if (badges.moderator) levels.push(Role.MODERATOR);
        if (badges.global_mod) levels.push(Role.MODERATOR);
        if (badges.staff) levels.push(Role.ADMIN);
        if (badges.admin) levels.push(Role.ADMIN);
        if (badges.broadcaster) levels.push(Role.BROADCASTER);
        if (this.userstate.username.toLowerCase() === "fifitido") levels.push(Role.OWNER);

        return levels;
    }

    public getUserState(): tmi.ChatUserstate {
        return this.userstate;
    }

    public async getExpressionContext(): Promise<ExpressionContext> {
        const getChannelProperty = async (key: keyof ChannelInformation): Promise<string> => {
            try {
                const chanResp = await this.api.getChannel({broadcaster_id: this.channel.nativeId});
                return chanResp.data[0][key];
            } catch (e) {
                logError(TwitchAdapter.LOGGER, e, "Twitch API Error");
                return "<<An error has occurred with the Twitch API.>>";
            }
        };

        const getStreamProperty = async (key: keyof Stream, defVal: string|number|string[] = "Channel is not live."): Promise<string | number | string[]> => {
            try {
                const chanResp = await this.api.getStreams({user_id: this.channel.nativeId});
                if (chanResp.data.length > 0) {
                    const chanData = chanResp.data[0];

                    return chanData[key];
                } else {
                    return defVal;
                }
            } catch (e) {
                logError(TwitchAdapter.LOGGER, e, "Twitch API Error");
                return "<<An error has occurred with the Twitch API.>>";
            }
        };

        const ctx: ExpressionContext = {
            channel: {
                getTitle: (): Promise<string> => getChannelProperty("title") as Promise<string>,
                getGame: async (): Promise<string> => getChannelProperty("game_name") as Promise<string>,
                getViewerCount: (): Promise<number> => getStreamProperty("viewer_count") as Promise<number>
            },
            sender: {
                getFollowAge: async (format?: string): Promise<string> => {
                    if (await this.checkRole(Role.BROADCASTER)) return "Sender is the broadcaster";
                    return this.api.getUserFollow({
                        from_id: this.chatter.user.nativeId,
                        to_id: this.channel.nativeId
                    }).then(async resp => {
                        if (resp.total < 1) return "Sender is not following the channel.";
                        const timezone = this.channel.settings.get(GeneralModule.settings.timezone);
                        return moment.parseZone(resp.data[0].followed_at, timezone.name).format(format ? format : "Y-m-d h:i:s");
                    }).catch(e => {
                        logError(TwitchAdapter.LOGGER, e, "Unable to determine follow age");
                        return "Cannot determine follow age.";
                    });
                },
                isFollowing: async (): Promise<boolean> => {
                    if (await this.checkRole(Role.BROADCASTER)) return true;
                    return this.api.getUserFollow({
                        from_id: this.chatter.user.nativeId,
                        to_id: this.channel.nativeId
                    }).then(resp => resp.total > 0).catch(e => {
                        logError(TwitchAdapter.LOGGER, e, "Unable to determine if the user is following");
                        return false;
                    });
                }
            }
        };

        return _.merge(await super.getExpressionContext(), ctx);
    }
}