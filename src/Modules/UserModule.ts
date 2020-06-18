import AbstractModule, {ModuleInfo, Symbols, Systems} from "./AbstractModule";
import UserPermissionsEntity from "../Database/Entities/UserPermissionsEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {inject} from "inversify";
import symbols from "../symbols";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {chatter as chatterConverter} from "../Systems/Commands/Validator/Chatter";
import {string} from "../Systems/Commands/Validator/String";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import {getLogger} from "../Utilities/Logger";
import {command, Subcommand} from "../Systems/Commands/decorators";

export const MODULE_INFO = {
    name: "User",
    version: "1.0.1",
    description: "Managing users in your channel including granting/denying permissions"
};

const logger = getLogger(MODULE_INFO.name);

class UserCommand extends Command {
    constructor(private readonly userModule: UserModule) {
        super("user", "<grant|deny|reset>", ["u"]);
    }

    @Subcommand("grant")
    async grant({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "user grant <group> <permission>",
            subcommand: "grant",
            arguments: tuple(
                chatterConverter({ name: "user", required: true }),
                string({ name: "permission", required: true})
            ),
            permission: "permission.grant"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user, permission] = args;

        await UserPermissionsEntity.update(user, permission, true, msg.getChannel())
            .then(() => response.message("user:permission.granted", {permission, username: user.name}))
            .catch(e => {
                response.genericError();
                logger.error("Unable to grant permission to user");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            });
    }

    @Subcommand("grant")
    async deny({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "user deny <group> <permission>",
            subcommand: "deny",
            arguments: tuple(
                chatterConverter({ name: "user", required: true }),
                string({ name: "permission", required: true})
            ),
            permission: "permission.deny"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user, permission] = args;

        await UserPermissionsEntity.update(user, permission, false, msg.getChannel())
            .then(() => response.message("user:permission.denied", {username: user.name, permission}))
            .catch(e => {
                response.genericError();
                logger.error("Unable to deny permission for user");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            });
    }

    @Subcommand("reset")
    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "group reset <group> [permission]",
            subcommand: "reset",
            arguments: tuple(
                chatterConverter({ name: "user", required: true }),
                string({ name: "permission", required: false, defaultValue: undefined })
            ),
            permission: "permission.reset"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user, permission] = args;

        if (permission) {
            await UserPermissionsEntity.delete(user, permission)
                .then(() => response.message("user:permission.delete.specific", {username: user.name, permission}))
                .catch(e => {
                    response.genericError();
                    logger.error("Unable to deny permission for user");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
                });
        } else {
            const confirmation = await this.userModule.makeConfirmation(msg, await response.translate("user:permission.delete.confirm", {username: user.name}), 30);
            confirmation.addListener(ConfirmedEvent, () => {
                return UserPermissionsEntity.clear(user)
                    .then(() => response.message("user:permission.delete.all", {username: user.name}))
                    .catch(e => {
                        response.genericError();
                        logger.error("Unable to deny permission for user");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
                    });
            });
            confirmation.run();
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