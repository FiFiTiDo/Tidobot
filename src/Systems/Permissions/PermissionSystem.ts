import Permission from "./Permission";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import {getMaxRole, Role} from "./Role";
import Logger from "../../Utilities/Logger";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import PermissionEntity from "../../Database/Entities/PermissionEntity";

export default class PermissionSystem {
    private static instance: PermissionSystem = null;

    public static getInstance(): PermissionSystem {
        if (this.instance === null)
            this.instance = new PermissionSystem();

        return this.instance;
    }

    private permissions: Permission[] = [];

    public registerPermission(permission: Permission): void {
        this.permissions.push(permission);
    }

    public findPermission(permStr: string): Permission|null {
        for (const permission of this.permissions)
            if (permission.getPermission() === permStr)
                return permission;
        return null;
    }

    public getAllPermissions(): Permission[] {
        return this.permissions;
    }

    public async getPermissionRole(permission: Permission, channel: ChannelEntity): Promise<Role> {
        try {
            const permissions = await channel.permissions();
            for (const perm of permissions)
                if (perm.permission === permission.getPermission())
                    return Role[perm.role];
            return Role.OWNER;
        } catch (e) {
            Logger.get().error("Unable to find permission in database", {cause: e});
            return Role.OWNER;
        }
    }

    public async check(permission: Permission|string, chatter: ChatterEntity, roles: Role[] = []): Promise<boolean> {
        if (typeof permission === "string") {
            const permStr = permission;
            permission = this.findPermission(permission);
            if (permission === null) {
                Logger.get().error(`Unable to find the permission with the string ${permStr}.`);
                console.trace();
                return false;
            }
        }

        try {
            if (await chatter.hasPermission(permission)) return true;

            const role = await this.getPermissionRole(permission, chatter.getChannel());
            return getMaxRole(roles) >= role;
        } catch (e) {
            Logger.get().error("Unable to check permission", {cause: e});
            console.trace();
        }

        return false;
    }

    public async resetChannelPermissions(channel: ChannelEntity): Promise<void> {
        await PermissionEntity.removeEntries({ channel });
        await PermissionEntity.make({ channel },
            this.permissions.map(permission => ({
                permission: permission.getPermission(), role: permission.getDefaultRole()
            }))
        );
    }
}