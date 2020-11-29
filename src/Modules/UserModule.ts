import AbstractModule, {Symbols} from "./AbstractModule";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import Command from "../Systems/Commands/Command";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {StringArg} from "../Systems/Commands/Validation/String";
import {getLogger} from "../Utilities/Logger";
import {Argument, MessageArg, ResponseArg} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import Message from "../Chat/Message";
import { Service } from "typedi";
import PermissionModule, { PermissionArg } from "./PermissionModule";
import { InjectRepository } from "typeorm-typedi-extensions";
import { ChatterPermissionRepoistory } from "../Database/Repositories/ChatterPermissionRepository";
import { Chatter } from "../Database/Entities/Chatter";
import Event from "../Systems/Event/Event";
import { Permission } from "../Database/Entities/Permission";

export const MODULE_INFO = {
    name: "User",
    version: "1.2.1",
    description: "Managing users in your channel including granting/denying permissions"
};

const logger = getLogger(MODULE_INFO.name);

class UserCommand extends Command {
    constructor(
        private readonly confirmationModule: ConfirmationModule,
        @InjectRepository() private readonly chatterPermissionRepository: ChatterPermissionRepoistory
    ) {
        super("user", "<grant|deny|reset>", ["u"]);
    }

    @CommandHandler(/^u(ser)? grant/, "user grant <user> <permission>")
    @CheckPermission(() => PermissionModule.permissions.grantPerm)
    async grant(
        event: Event, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter, 
        @Argument(PermissionArg) permission: Permission, @MessageArg msg: Message
    ): Promise<void> {
        if (!msg.checkPermission(permission)) response.message("permission:error.not-permitted");
        return this.chatterPermissionRepository.updatePermission(chatter, permission, true)
            .then(() => response.message("user:permission.granted", {permission: permission.token, username: chatter.user.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^u(ser)? deny/, "user deny <user> <permission>")
    @CheckPermission(() => PermissionModule.permissions.denyPerm)
    async deny(
        event: Event, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter, 
        @Argument(PermissionArg) permission: Permission, @MessageArg msg: Message
    ): Promise<void> {
        if (!msg.checkPermission(permission)) response.message("permission:error.not-permitted");
        return this.chatterPermissionRepository.updatePermission(chatter, permission, true)
            .then(() => response.message("user:permission.denied", {username: chatter.user.name, permission: permission.token}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^u(ser)? reset (.*)/, "user reset <user> <permission>")
    @CheckPermission(() => PermissionModule.permissions.resetPerm)
    async reset(
        event: Event, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter,
        @Argument(StringArg, "permission") permission: Permission, @MessageArg msg: Message
    ): Promise<void> {
        if (!msg.checkPermission(permission)) response.message("permission:error.not-permitted");
        const [chatterPermission, count] = await this.chatterPermissionRepository.findAndCount({ chatter, permission });
        if (count < 1) return response.message("user:permission.delete.not-found", {username: chatter.user.name, permission: permission.token});
        return this.chatterPermissionRepository.remove(chatterPermission)
            .then(() => response.message("user:permission.delete.specific", {username: chatter.user.name, permission: permission.token}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^u(ser)? reset$/, "user reset <user>")
    @CheckPermission(() => PermissionModule.permissions.resetAllPerms)
    async resetAll(
        event: Event, @ResponseArg response: Response, @MessageArg msg: Message,
        @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        const permissions = await this.chatterPermissionRepository.find({ chatter });
        const confirmMsg = await response.translate("user:permission.delete.confirm", {username: chatter.user.name});
        const confirm = await this.confirmationModule.make(msg, confirmMsg, 30);
        confirm.addListener(ConfirmedEvent, () => this.chatterPermissionRepository.remove(permissions)
            .then(() => response.message("user:permission.delete.all", {username: chatter.user.name}))
            .catch(e => response.genericErrorAndLog(e, logger))
        );
        confirm.run();
    }
}

@Service()
export default class UserModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor(userCommand: UserCommand) {
        super(UserModule);

        this.coreModule = true;
        this.registerCommand(userCommand);
    }
}