import { AxiosPromise } from "axios";
import { ApiCallMethod } from "..";

export interface FriendsParams {
    user: string;
    recenttracks?: number;
    limit?: number;
    page?: number;
}

export interface Friends {
    friends: {
        user: {
            name: string;
            realname: string;
            image: {
                "#text": string;
                size: string;
            }[];
            url: string;
            id: string;
            country: string;
            age: string;
            gender: string;
            subscriber: string;
            playcount: string;
            playlists: string;
            bootstrap: string;
            registered: {
                "#text": string;
                unixtime: string;
            };
            type: string;
        }[];
        "@attr": {
            page: string;
            perPage: string;
            user: string;
            total: string;
            totalPages: string;
        };
    };
}

export interface GetFriendsMethod {
    (params: FriendsParams): AxiosPromise<Friends>;
}

export function getFriends(call: ApiCallMethod): GetFriendsMethod {
    return (params): AxiosPromise<Friends> => call<Friends>("user.getFriends", params);
}