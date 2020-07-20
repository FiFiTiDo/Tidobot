import AbstractModule, {Symbols} from "./AbstractModule";
import UserPermissionsEntity from "../Database/Entities/UserPermissionsEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {inject} from "inversify";
import symbols from "../symbols";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {StringArg} from "../Systems/Commands/Validation/String";
import {getLogger} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import {Argument, Channel, MessageArg, ResponseArg} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import Message from "../Chat/Message";

export const MODULE_INFO = {
    name: "User",
    version: "1.1.0",
    description: "Managing users in your channel including granting/denying permissions"
};

const logger = getLogger(MODULE_INFO.name);

class UserCommand extends Command {
    constructor(private readonly userModule: UserModule) {
        super("user", "<grant|deny|reset>", ["u"]);
    }

    @CommandHandler(/^u(ser)? grant/, "user grant <user> <permission>")
    @CheckPermission("permission.grant")
    async grant(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(new ChatterArg()) user: ChatterEntity, @Argument(StringArg) permission: string
    ): Promise<void> {
        return  UserPermissionsEntity.update(user, permission, true, channel)
            .then(() => response.message("user:permission.granted", {permission, username: user.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^u(ser)? deny/, "user deny <user> <permission>")
    @CheckPermission("permission.deny")
    async deny(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(new ChatterArg()) user: ChatterEntity, @Argument(StringArg) permission: string
    ): Promise<void> {
        return  UserPermissionsEntity.update(user, permission, false, channel)
            .then(() => response.message("user:permission.denied", {username: user.name, permission}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^u(ser)? reset/, "user reset <user> [permission>]")
    @CheckPermission("permission.reset")
    async reset(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @MessageArg msg: Message,
        @Argument(new ChatterArg()) user: ChatterEntity,
        @Argument(StringArg, "permission", false) permission: string = null
    ): Promise<void> {
        if (permission !== null) {
            return UserPermissionsEntity.delete(user, permission)
                .then(() => response.message("user:permission.delete.specific", {username: user.name, permission}))
                .catch(e => response.genericErrorAndLog(e, logger));
        } else {
            const confirmMsg = await response.translate("user:permission.delete.confirm", {username: user.name});
            const confirm = await this.userModule.makeConfirmation(msg, confirmMsg, 30);
            confirm.addListener(ConfirmedEvent, () => UserPermissionsEntity.clear(user)
                .then(() => response.message("user:permission.delete.all", {username: user.name}))
                .catch(e => response.genericErrorAndLog(e, logger))
            );
            confirm.run();
        }
    }
}

@HandlesEvents()
export default class UserModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor(@inject(symbols.ConfirmationFactory) public makeConfirmation: ConfirmationFactory) {
        super(UserModule);

        this.coreModule = true;
    }

    @command userCommand = new UserCommand(this);

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await ChatterEntity.createTable({channel});
        await UserPermissionsEntity.createTable({channel});
    }
}