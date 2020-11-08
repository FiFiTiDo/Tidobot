import { AxiosPromise } from "axios";
import { ApiCallMethod } from "..";

export interface RecentTrack {
    artist: {
        mbid: string;
        "#text": string;
    };
    album: {
        mbid: string;
        "#text": string;
    };
    image: {
        size: string;
        "#text": string;
    }[];
    streamable: number;
    date: {
        uts: string;
        "#text": string;
    };
    url: string;
    name: string;
    mbid: string;
}

export interface RecentTracks {
    recenttracks: {
        "@attr": {
            page: string;
            perPage: string;
            user: string;
            total: string;
            totalPages: string;
        };
        track: RecentTrack[];
    };
}

export interface RecentTracksParams {
    limit?: number;
    user: string;
    page?: number;
    from?: Date;
    extended?: number;
    to?: Date;
    nowplaying?: boolean;
}

export interface GetRecentTracksMethod {
    (params: RecentTracksParams): AxiosPromise<RecentTracks>;
}

export function getRecentTracks(call: ApiCallMethod): GetRecentTracksMethod {
    return (params): AxiosPromise<RecentTracks> => call<RecentTracks>("user.getRecentTracks", params);
}