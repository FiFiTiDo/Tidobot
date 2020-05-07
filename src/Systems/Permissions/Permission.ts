import {Role} from "./Role";

export default class Permission {
    constructor(private permission: string, private defaultRole: Role) {
    }

    getPermission(): string {
        return this.permission;
    }

    getDefaultRole(): Role {
        return this.defaultRole;
    }
}