import Permission from "./Permission";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import {getMaxRole, Role} from "./Role";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import PermissionEntity from "../../Database/Entities/PermissionEntity";
import System from "../System";

export default class PermissionSystem extends System {
    private static instance: PermissionSystem = null;
    private permissions: Permission[] = [];

    public static getInstance(): PermissionSystem {
        if (this.instance === null)
            this.instance = new PermissionSystem();

        return this.instance;
    }

    constructor() {
        super("Permission");

        this.logger.info("System initialized");
    }

    public registerPermission(permission: Permission): void {
        this.permissions.push(permission);
    }

    public findPermission(permStr: string): Permission | null {
        for (const permission of this.permissions)
            if (permission.getPermission() === permStr)
                return permission;
        return null;
    }

    public getAll(): Permission[] {
        return this.permissions;
    }

    public async getPermissionRole(permission: Permission, channel: ChannelEntity): Promise<Role> {
        try {
            const permissions = await channel.permissions();
            for (const perm of permissions)
                if (perm.permission === permission.getPermission())
                    return perm.role;
            return Role.OWNER;
        } catch (e) {
            this.logger.error("Unable to find permission in database");
            this.logger.error("Caused by: " + e.message);
            this.logger.error(e.stack);
            return Role.OWNER;
        }
    }

    public async check(permission: Permission | string, chatter: ChatterEntity, roles: Role[] = []): Promise<boolean> {
        if (typeof permission === "string") {
            const permStr = permission;
            permission = this.findPermission(permission);
            if (permission === null) {
                this.logger.trace(`Unable to find the permission with the string ${permStr}.`);
                return false;
            }
        }

        try {
            if (await chatter.hasPermission(permission)) return true;

            const role = await this.getPermissionRole(permission, chatter.getChannel());
            return getMaxRole(roles) >= role;
        } catch (e) {
            this.logger.error("Unable to check permission");
            this.logger.error("Caused by: " + e.message);
            this.logger.error(e.stack);
        }

        return false;
    }

    public async resetChannelPermissions(channel: ChannelEntity): Promise<void> {
        await PermissionEntity.removeEntries({channel});
        await PermissionEntity.make({channel},
            this.permissions.map(permission => ({
                permission: permission.getPermission(),
                role: Role[permission.getDefaultRole()],
                default_role: Role[permission.getDefaultRole()],
                module_defined: "true"
            }))
        );
    }
}