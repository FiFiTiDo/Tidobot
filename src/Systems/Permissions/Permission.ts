import { PermissionLike } from "../../Utilities/Interfaces/PermissionLike";
import {Role} from "./Role";

export default class Permission implements PermissionLike {
    constructor(public readonly token: string, public readonly defaultRole: Role) {
    }

    getToken(): string {
        return this.token;
    }

    getDefaultRole(): Role {
        return this.defaultRole;
    }
}

export enum PermissionStatus {
    GRANTED, DENIED, NOT_DEFINED
}