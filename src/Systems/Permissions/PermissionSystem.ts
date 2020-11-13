import Permission, { PermissionStatus } from "./Permission";
import {getMaxRole, Role} from "./Role";
import System from "../System";
import {logError} from "../../Utilities/Logger";
import { Service } from "typedi";
import { PermissionRepository } from "../../Database/Repositories/PermissionRepository";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";
import { EventHandler, HandlesEvents } from "../Event/decorators";
import { NewChannelEvent } from "../../Chat/Events/NewChannelEvent";
import Event from "../Event/Event";

@Service()
@HandlesEvents()
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
            return this.repository.create({
                token: permission.token,
                role: permission.getDefaultRole(),
                defaultRole: permission.getDefaultRole(),
                moduleDefined: true
            });
        }));
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel(event: Event): Promise<void> {
        const channel = event.extra.get(NewChannelEvent.EXTRA_CHANNEL);
        await this.resetChannelPermissions(channel);
    }
}