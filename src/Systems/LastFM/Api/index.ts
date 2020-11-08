import axios, { AxiosPromise } from "axios";
import { getTrackMethods, Track } from "./track";
import { getUserMethods, User } from "./user";

export interface LastFMApi {
    track: Track;
    user: User;
}

export interface ApiCallMethod {
    <T>(method: string, params: object): AxiosPromise<T>;
}

export function getApi(apiKey: string): LastFMApi {
    const api = axios.create({
        url: "/",
        baseURL: "http://ws.audioscrobbler.com/2.0/",
        params: {
            format: "json",
            api_key: apiKey
        },
        responseType: "json"
    });

    const call = <T>(method: string, params = {}): AxiosPromise<T> => {
        return api({
            params: Object.assign({}, this.axios.defaults.params, {method}, params)
        });
    };

    return {
        track: getTrackMethods(call),
        user: getUserMethods(call)
    };
}