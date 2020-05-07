import request = require("request-promise-native");
import moment from "moment";
import Application from "../../Application/Application";
import Cache from "../../Systems/Cache/Cache";

const cacheLength: {
    length: moment.DurationInputArg1;
    unit: moment.unitOfTime.DurationConstructor;
} = Application.getConfig().getOrDefault("general.cache.api");
const cacheExpiresAfter = moment.duration(cacheLength.length, cacheLength.unit);

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
        community_ids: string[];
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
        community_id?: string;
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

    /** @ignore */
    type values = { [key: string]: any };

    /**
     * Internal use for the private [[Api.makeRequest]] function
     */
    interface RequestOptions {
        method?: string;
        endpoint: string;
        query?: values;
        body?: values;
        headers?: values;
    }

    /**
     * The Api class handling the api requests for the new helix api
     */
    export class Api {
        readonly BASE_URL = "https://api.twitch.tv/helix/";
        private readonly clientId: string;

        /**
         * Api constructor.
         *
         * @param clientId The client id for the api
         */
        constructor(clientId: string) {
            this.clientId = clientId;
        }

        /**
         * Search for all games matching the given parameters
         *
         * @param params The parameters of the request
         *
         * @returns A Promise that resolves to an [[IResponse]]
         */
        async getGames(params: GameParams): Promise<Response<Game>> {
            return JSON.parse(await Cache.getInstance().retrieve("twitch.games." + JSON.stringify(params), cacheExpiresAfter.asSeconds(), async () => {
                return JSON.stringify(await this.makeRequest<Game>({
                    endpoint: "games",
                    query: params as values
                }));
            }));
        }

        /**
         * Search for all streams matching the given parameters
         *
         * @param params The parameters of the request
         *
         * @returns A Promise that resolves to an [[IResponse]]
         */
        async getStreams(params: StreamParams): Promise<Response<Stream>> {
            return JSON.parse(await Cache.getInstance().retrieve("twitch.streams." + JSON.stringify(params), cacheExpiresAfter.asSeconds(), async () => {
                return JSON.stringify(await this.makeRequest<Stream>({
                    endpoint: "streams",
                    query: params as values
                }));
            }));
        }

        /**
         * Search for all users matching the given parameters
         *
         * @param params The parameters of the request
         *
         * @returns A Promise that resolves to an [[IResponse]]
         */
        async getUsers(params: UserParams): Promise<Response<User>> {
            return JSON.parse(await Cache.getInstance().retrieve("twitch.users." + JSON.stringify(params), cacheExpiresAfter.asSeconds(), async () => {
                return JSON.stringify(await this.makeRequest<User>({
                    endpoint: "users",
                    query: params as values
                }));
            }));
        }


        /**
         * Search for all user follows matching the given parameters
         *
         * @param params The parameters of the request
         *
         * @returns A Promise that resolves to an [[IResponse]]
         */
        async getUserFollow(params: UserFollowParams): Promise<Response<UserFollow>> {
            return JSON.parse(await Cache.getInstance().retrieve("twitch.users.follow." + JSON.stringify(params), cacheExpiresAfter.asSeconds(), async () => {
                return JSON.stringify(await this.makeRequest<UserFollow>({
                    endpoint: "users/follows",
                    query: params as values
                }));
            }));
        }

        /**
         * Make a request to the api with the given options
         *
         * @param opts The options for the request
         */
        private makeRequest<T>(opts: RequestOptions): Promise<Response<T>> {
            const method = opts.method ? opts.method : "GET";
            const body = opts.body ? opts.body : undefined;
            const url = this.BASE_URL + opts.endpoint;
            const headers = {
                "Client-ID": this.clientId
            };
            if (opts.headers) Object.assign(headers, opts.headers);
            const qs = opts.query ? opts.query : undefined;
            const json = true;
            const useQuerystring = true;

            return request({method, url, headers, qs, body, useQuerystring, json}).promise();
        }
    }
}

/**
 * @deprecated The version 5 kraken api has been deprecated use [[helix.Api]] when possible
 */
export namespace kraken {
    export type ApiPromise<T> = request.RequestPromise<T>;

    export interface Channel {
        _id: number;
        broadcaster_language: string;
        created_at: string;
        display_name: string;
        followers: number;
        game: string;
        language: string;
        logo: string;
        mature: boolean;
        name: string;
        partner: boolean;
        profile_banner: string | null;
        profile_banner_background_color: string | null;
        status: string;
        updated_at: string;
        url: string;
        video_banner: string | null;
        views: number;
    }

    export interface ChannelUpdateParams {
        status?: string;
        games?: string;
        delay?: number;
        channel_feed_enabled?: boolean;
    }

    export interface StreamData {
        _id: number;
        game: string;
        viewers: number;
        video_height: number;
        average_fps: number;
        delay: number;
        created_at: string;
        is_playlist: boolean;
        preview: {
            small: string;
            medium: string;
            large: string;
            template: string;
        };
        channel: Channel;
    }

    export interface Stream {
        stream: null | StreamData;
    }

    export interface Streams {
        _total: number;
        streams: StreamData[];
    }

    export interface StreamsParams {
        channel?: string;
        game?: string;
        language?: string;
        stream_type?: string;
        limit?: number;
        offset?: number;
    }

    export interface User {
        _id: string;
        bio: string;
        created_at: string;
        display_name: string;
        logo: string;
        name: string;
        type: string;
        updated_at: string;
    }

    export interface Users {
        _total: number;
        users: User[];
    }

    /** @ignore */
    type values = { [key: string]: any };

    /**
     * Internal use for the private [[Api.makeRequest]] function
     */
    interface RequestOptions {
        method?: string;
        endpoint: string;
        query?: values;
        body?: values;
        headers?: values;
    }

    export class Api {
        readonly BASE_URL = "https://api.twitch.tv/kraken/";
        private readonly clientId: string;

        constructor(clientId: string) {
            this.clientId = clientId;
        }

        getChannel(id: string | number): ApiPromise<Channel> {
            return this.makeRequest<Channel>({endpoint: "channels/" + id});
        }

        updateChannel(id: string | number, params: ChannelUpdateParams): ApiPromise<Channel> {
            return this.makeRequest<Channel>({
                method: "PUT",
                endpoint: "channels/" + id,
                body: {channel: params}
            });
        }

        getStreamByUser(id: string | number): ApiPromise<Stream> {
            return this.makeRequest<Stream>({endpoint: "streams/" + id});
        }

        getStreams(opts: StreamsParams): ApiPromise<Streams> {
            return this.makeRequest<Streams>({
                endpoint: "streams/",
                query: opts as values
            });
        }

        getUser(id: string | number): ApiPromise<User> {
            return this.makeRequest<User>({endpoint: "users/" + id});
        }

        getUsers(login: string[]): ApiPromise<Users> {
            return this.makeRequest<Users>({
                endpoint: "users",
                query: {
                    login: login.join(",")
                }
            });
        }

        private makeRequest<T>(opts: RequestOptions): ApiPromise<T> {
            const method = opts.method ? opts.method : "GET";
            const body = opts.body ? opts.body : undefined;
            const url = this.BASE_URL + opts.endpoint;
            const headers = {
                "Accept": "application/vnd.twitchtv.v5+json",
                "Client-Id": this.clientId
            };
            if (opts.headers) Object.assign(headers, opts.headers);
            const qs = opts.query ? opts.query : undefined;
            const json = method == "GET" || typeof body != "string";
            const useQuerystring = true;

            return request({method, url, headers, qs, body, useQuerystring, json});
        }
    }
}