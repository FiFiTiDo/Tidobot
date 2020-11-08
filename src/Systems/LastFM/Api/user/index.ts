import { ApiCallMethod } from "..";
import { getInfo, GetInfoMethod } from "../track/getInfo";
import { getFriends, GetFriendsMethod } from "./getFriends";
import { getRecentTracks, GetRecentTracksMethod } from "./getRecentTracks";

export interface User {
    getFriends: GetFriendsMethod;
    getInfo: GetInfoMethod;
    getRecentTracks: GetRecentTracksMethod;
}

export const getUserMethods = (call: ApiCallMethod): User => ({
    getFriends: getFriends(call),
    getInfo: getInfo(call),
    getRecentTracks: getRecentTracks(call)
});