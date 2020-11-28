/* eslint-disable @typescript-eslint/no-namespace */
import Cache from "../../Systems/Cache/Cache";
import {parseDuration} from "../../Utilities/TimeUtils";
import {AccessToken} from "./ApiAuthentication";
import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from "axios";
import Config from "../../Systems/Config/Config";
import CacheConfig from "../../Systems/Config/ConfigModels/CacheConfig";
import TwitchAdapter from "./TwitchAdapter";
import Container, { Service } from "typedi";
import { Duration } from "moment";
import { logError } from "../../Utilities/Logger";

const CACHE_EXPIRY = async (): Promise<Duration> => {
    const config = await Container.get(Config).getConfig(CacheConfig);
    return parseDuration(config.length);
};

/**
 * The new twitch api
 */
export namespace helix {

    /**
     * All responses from the new helix api will match
     * this interface. Sometimes the total and pagination are
     * omitted from the response but data will always be supplied.
     */
    export interface Response<T> {
        total?: number;
        data: T[];
        pagination?: {
            cursor: string;
        };
    }

    /**
     * The json response for a game request
     */
    export interface Game {
        box_art_url: string;
        id: string;
        name: string;
    }

    /**
     * The parameters for requesting information about a game
     *
     * One of the following params are required
     */
    export interface GameParams {
        id?: string | string[];
        name?: string | string[];
    }

    /**
     * The json response for a stream request
     */
    export interface Stream {
        id: string;
        user_id: string;
        user_name: string;
        game_id: string;
        type: string;
        title: string;
        viewer_count: number;
        started_at: string;
        language: string;
        thumbnail_url: string;
    }

    /**
     * The parameters for requesting information about a stream
     *
     * One or more of the following params are required
     */
    export interface StreamParams {
        after?: string;
        before?: string;
        first?: number;
        game_id?: string | string[];
        language?: string | string[];
        user_id?: string | string[];
        user_login?: string | string[];
    }

    /**
     * The json response for a user request
     */
    export interface User {
        id: string;
        login: string;
        display_name: string;
        type: string;
        broadcaster_type: string;
        description: string;
        profile_image_url: string;
        offline_image_url: string;
        view_count: number;
        email?: string;
    }

    /**
     * The parameters for requesting information about a user
     *
     * One of the following params are required
     */
    export interface UserParams {
        id?: string | string[];
        login?: string | string[];
    }

    /**
     * Data on a user follow, from_* is following to_*
     */
    export interface UserFollow {
        from_id: string;
        from_name: string;
        to_id: string;
        to_name: string;
        followed_at: string;
    }

    /**
     * The parameters for requesting information about a user
     *
     * you can supply either from_id, to_id, or both
     * after: pagination cursor
     * first: How many to return
     * from_id: Find all the users the specified user is following
     * to_id: Find all the users following the specified user
     */
    export interface UserFollowParams {
        after?: string;
        first?: number;
        from_id?: string;
        to_id?: string;
    }

    /**
     * Information about a channel
     */
    export interface ChannelInformation {
        broadcaster_id: string;
        broadcaster_name: string;
        broadcaster_language: string;
        game_id: string;
        game_name: string;
        title: string;
    }

    /**
     * The parameters for requesting information about a channel
     *
     * One of the following params are required
     */
    export interface ChannelParams {
        broadcaster_id: string;
    }

    /**
     * The parameters for modifying information about a channel
     *
     * One of the following params are required
     */
    export interface ChannelUpdateData {
        game_id?: string;
        broadcaster_language?: string;
        title?: string;
    }

    /**
     * The Api class handling the api requests for the new helix api
     */
    @Service()
    export class Api {
        readonly BASE_URL = "https://api.twitch.tv/helix/";
        private accessToken: AccessToken = null;
        private axios: AxiosInstance;
        private clientId: string;
        private clientSecret: string;

        /**
         * Api constructor.
         *
         * @param clientId The client id for the api
         * @param clientSecret The client secret for the api
         */
        constructor(
            private cache: Cache
        ) {
            this.axios = axios.create({
                baseURL: this.BASE_URL
            });
        }

        public setCredentials(clientId: string, clientSecret: string): void {
            this.clientId = clientId;
            this.clientSecret = clientSecret;
        }

        /**
         * Search for all games matching the given parameters
         *
         * @param params The parameters of the request
         *
         * @returns A Promise that resolves to an [[IResponse]]
         */
        async getGames(params: GameParams): Promise<Response<Game>> {
            return this.makeCachedRequest("twitch.games." + JSON.stringify(params), {url: "/games", params});
        }

        /**
         * Search for all streams matching the given parameters
         *
         * @param params The parameters of the request
         *
         * @returns A Promise that resolves to an [[IResponse]]
         */
        async getStreams(params: StreamParams): Promise<Response<Stream>> {
            return this.makeCachedRequest("twitch.streams." + JSON.stringify(params), {url: "/streams", params});
        }

        /**
         * Search for all users matching the given parameters
         *
         * @param params The parameters of the request
         *
         * @returns A Promise that resolves to an [[IResponse]]
         */
        async getUsers(params: UserParams): Promise<Response<User>> {
            return this.makeCachedRequest("twitch.users." + JSON.stringify(params), {url: "/users", params});
        }

        /**
         * Search for all user follows matching the given parameters
         *
         * @param params The parameters of the request
         *
         * @returns A Promise that resolves to an [[IResponse]]
         */
        async getUserFollow(params: UserFollowParams): Promise<Response<UserFollow>> {
            return this.makeCachedRequest("twitch.users.follow." + JSON.stringify(params), {url: "/users/follows", params});
        }

        /**
         * Get the information of the channel matching the given parameters
         *
         * @param params The parameters of the request
         *
         * @returns A Promise that resolves to an [[IResponse]]
         */
        async getChannel(params: ChannelParams): Promise<Response<ChannelInformation>> {
            return this.makeCachedRequest("twitch.channels." + JSON.stringify(params), {url: "/channels", params});
        }

        /**
         * Modify a specified channel's information
         * 
         * @param params The channel to modify
         * @param data The updated information
         * 
         * @returns True if the information was updated successfully
         */
        async modifyChannel(params: ChannelParams, data: ChannelUpdateData): Promise<boolean> {
            const response = await this.makeRequest<ChannelInformation>({url: "/channels", params, data});

            switch (response.status) {
                case 204: return true;
                case 400:
                    TwitchAdapter.LOGGER.warn("Missing query parameter in helix.Api#modifyChannel");
                    return false;
                case 500:
                    TwitchAdapter.LOGGER.error("Failed to update channel due to Twitch Internal Server Error");
                    return false;
                default:
                    TwitchAdapter.LOGGER.error("Modifying channel returned unexpected status code: " + response.status + ", text: " + response.statusText);
                    return false;
            }
        }

        /**
         * Get the access token for API requests
         * Retrieves it if it hasn't been retrieved yet
         * Refreshes if it has been but is expired
         *
         * @returns The AccessToken object
         */
        private async getAccessToken(): Promise<AccessToken> {
            if (this.accessToken === null) { // Has not been retrieved yet
                try {
                    this.accessToken = await AccessToken.retrieve(this.clientId, this.clientSecret);
                } catch (e) {
                    logError(TwitchAdapter.LOGGER, e, "Unable to retrieve the access token", true);
                    process.exit(1);
                }
            }

            try {
                await this.accessToken.validate();
            } catch (e) {
                logError(TwitchAdapter.LOGGER, e, "Unable to validate access token", true);
                process.exit(1);
            }

            return this.accessToken;
        }

        /**
         * Make a request to the api with the given options
         *
         * @param opts The options for the request
         */
        private async makeRequest<T>(opts: AxiosRequestConfig): Promise<AxiosResponse<T>> {
            const accessToken = await this.getAccessToken();

            opts.headers = Object.assign({}, opts.headers || {}, {
                "Client-ID": this.clientId,
                Authorization: `Bearer ${accessToken.token}`
            });
            opts.responseType = "json";

            return this.axios(opts);
        }

        private async makeCachedRequest<T>(key: string, opts: AxiosRequestConfig): Promise<AxiosResponse<T>> {
            return JSON.parse(await this.cache.retrieve(key, (await CACHE_EXPIRY()).asSeconds(), async () => {
                return JSON.stringify(await this.makeRequest(opts).then(resp => resp.data));
            }));
        }
    }
}