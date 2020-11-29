import { AxiosPromise } from "axios";
import { ApiCallMethod } from "..";

export interface UserInformation {
    user: {
        id: string;
        name: string;
        realname: string;
        url: string;
        image: string;
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
    };
}

export interface UserInformationParams {
    user?: string;
}

export interface GetInfoMethod {
    (params: UserInformationParams): AxiosPromise<UserInformation>;
}

export function getInfo(call: ApiCallMethod): GetInfoMethod {
    return (params): AxiosPromise<UserInformation> => call<UserInformation>("user.getInfo", params);
}