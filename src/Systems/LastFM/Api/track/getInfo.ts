import { AxiosPromise } from "axios";
import { ApiCallMethod } from "..";

export interface TrackInformation {
    track: {
        name: string;
        mbid: string;
        url: string;
        duration: string;
        streamable: {
            "#text": string;
            fulltrack: string;
        };
        listeners: string;
        playcount: string;
        artist: {
            name: string;
            mbid: string;
            url: string;
        };
        album: {
            artist: string;
            title: string;
            mbid: string;
            url: string;
            image: {
                "#text": string;
                size: string;
            }[];
            "@attr": {
                position: string;
            };
        };
        userplaycount?: string;
        userloved?: string;
        toptags: {
            tag: {
                name: string;
                url: string;
            }[];
        };
    };
}

export interface TrackInformationParams {
    mbid?: string;
    track?: string;
    artist?: string;
    username?: string;
    autocorrect?: number;
}

export interface GetInfoMethod {
    (params: TrackInformationParams): AxiosPromise<TrackInformation> ;
}

export function getInfo(call: ApiCallMethod): GetInfoMethod {
    return (params): AxiosPromise<TrackInformation> => call<TrackInformation>("track.getInfo", params);
}