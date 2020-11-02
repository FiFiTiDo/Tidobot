import Permission, { PermissionStatus } from "./Permission";
import {getMaxRole, Role} from "./Role";
import System from "../System";
import {logError} from "../../Utilities/Logger";
import { Service } from "typedi";
import { PermissionRepository } from "../../Database/Repositories/PermissionRepository";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Channel } from "../../Database/Entities/Channel";
import { Permission as PermissionEntityNew } from "../../Database/Entities/Permission";  
import { Chatter } from "../../Database/Entities/Chatter";

@Service()
export default class PermissionSystem extends System {
    private permissions: Permission[] = [];


    constructor(
        @InjectRepository()
        private readonly repository: PermissionRepository
    ) {
        super("Permission");

        this.logger.info("System initialized");
    }

    public registerPermission(permission: Permission): void {
        this.permissions.push(permission);
    }

    public findPermission(permStr: string): Permission | null {
        for (const permission of this.permissions)
            if (permission.getToken() === permStr)
                return permission;
        return null;
    }

    public getAll(): Permission[] {
        return this.permissions;
    }

    public getPermissionRole(permission: Permission, channel: Channel): Role {
        try {
            for (const entity of channel.permissions)
                if (entity.token === permission.token)
                    return entity.role;
            return Role.OWNER;
        } catch (e) {
            logError(this.logger, e, "Unable to find permission in database");
            return Role.OWNER;
        }
    }

    public check(permission: Permission | string, chatter: Chatter, roles: Role[] = []): boolean {
        if (typeof permission === "string") {
            const permStr = permission;
            permission = this.findPermission(permission);
            if (permission === null) {
                this.logger.trace(`Unable to find the permission with the string ${permStr}.`);
                return false;
            }
        }

        try {
            if (chatter.checkPermission(permission) === PermissionStatus.GRANTED) return true;

            return getMaxRole(roles) >= this.getPermissionRole(permission, chatter.channel);
        } catch (e) {
            logError(this.logger, e, "Unable to check permission");
        }

        return false;
    }

    public async resetChannelPermissions(channel: Channel): Promise<void> {
        await this.repository.removeByChannel(channel);
        await this.repository.save(this.permissions.map(permission => {
            const entity = new PermissionEntityNew();
            entity.role = permission.getDefaultRole();
            entity.defaultRole = permission.getDefaultRole();
            entity.moduleDefined = true;
            return entity;
        }));
    }
}