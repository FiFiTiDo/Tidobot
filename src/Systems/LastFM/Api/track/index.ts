import { ApiCallMethod } from "..";
import { getInfo, GetInfoMethod } from "./getInfo";

export interface Track {
    getInfo: GetInfoMethod;
}

export const getTrackMethods = (call: ApiCallMethod): Track => ({
    getInfo: getInfo(call)
});