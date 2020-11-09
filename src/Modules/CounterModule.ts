import AbstractModule, {Symbols} from "./AbstractModule";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {IntegerArg} from "../Systems/Commands/Validation/Integer";
import {StringArg} from "../Systems/Commands/Validation/String";
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import {getLogger} from "../Utilities/Logger";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import {Argument, ChannelArg, ResponseArg} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {returnErrorAsync, validateFunction} from "../Utilities/ValidateFunction";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Counter } from "../Database/Entities/Counter";
import { CounterRepository } from "../Database/Repositories/CounterRepository";
import { Channel } from "../Database/Entities/Channel";

export const MODULE_INFO = {
    name: "Counter",
    version: "1.2.0",
    description: "Add counters for anything that needs to be counted, add and subtract from them as you wish"
};

const logger = getLogger(MODULE_INFO.name);
const CounterConverter = new EntityArg(CounterRepository, {msgKey: "counter:unknown", optionKey: "counter"});

@Service()
class CounterCommand extends Command {
    constructor(
        @InjectRepository() private readonly counterRepository: CounterRepository
    ) {
        super("counter", "<inc|dec|add|sub|set|create|delete>");
    }

    @CommandHandler(/^counter (?!increment|inc|add|decrement|dec|subtract|sub|set|create|delete|del)/, "counter <counter name>")
    @CheckPermission(() => CounterModule.permissions.checkCounter)
    async retrieveValueHandler(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CounterConverter) counter: Counter
    ): Promise<void> {
        return response.message("counter:value", {counter: counter.name, value: counter.value});
    }

    @CommandHandler(/^counter (increment|inc|add)/, "counter increment <counter name> <amount>", 1)
    @CheckPermission(() => CounterModule.permissions.changeCounter)
    async increment(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CounterConverter) counter: Counter,
        @Argument(new IntegerArg({min: 1}), "amount", false) amount = 1
    ): Promise<void> {
        counter.value += amount;
        return counter.save()
            .then(() => response.message("counter:incremented", {counter: counter.name, amount}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^counter (decrement|dec|subtract|sub)/, "counter decrement <counter name> <amount>", 1)
    @CheckPermission(() => CounterModule.permissions.changeCounter)
    async decrement(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CounterConverter) counter: Counter,
        @Argument(new IntegerArg({min: 1}), "amount", false) amount = 1
    ): Promise<void> {
        counter.value -= amount;
        return counter.save()
            .then(() => response.message("counter:decremented", {counter: counter.name, amount}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("counter set", "counter set <counter name> <amount>", 1)
    @CheckPermission(() => CounterModule.permissions.changeCounter)
    async set(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CounterConverter) counter: Counter,
        @Argument(new IntegerArg({min: 1})) amount: number
    ): Promise<void> {
        counter.value = amount;
        return counter.save()
            .then(() => response.message("counter:set", {counter: counter.name, amount}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("counter create", "counter create <counter name>", 1)
    @CheckPermission(() => CounterModule.permissions.createCounter)
    async create(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(StringArg, "counter name") name: string
    ): Promise<void> {
        if (await this.counterRepository.count({ name, channel }) > 0) return response.message("counter:error.exists");

        return this.counterRepository.create({ name, value: 0 }).save()
            .then(() => response.message("counter:created", {counter: name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^counter (delete|del)/, "counter delete <counter name>", 1)
    @CheckPermission(() => CounterModule.permissions.deleteCounter)
    async delete(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CounterConverter) counter: Counter
    ): Promise<void> {
        return counter.remove()
            .then(() => response.message("counter.deleted", {counter: counter.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

@Service()
export default class CounterModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        checkCounter: new Permission("counter.check", Role.NORMAL),
        changeCounter: new Permission("counter.change", Role.MODERATOR),
        createCounter: new Permission("counter.create", Role.MODERATOR),
        deleteCounter: new Permission("counter.delete", Role.MODERATOR)
    }

    constructor(
        counterCommand: CounterCommand,
        @InjectRepository() private readonly counterRepository: CounterRepository
    ) {
        super(CounterModule);

        this.registerCommand(counterCommand);
        this.registerPermissions(CounterModule.permissions);
        this.registerExpressionContextResolver(this.expressionContextResolver);
    }

    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            counters: {
                get: validateFunction(async (name: string): Promise<object | string> => {
                    const counter = await this.counterRepository.findOne({ name, channel: msg.channel });
                    if (counter === null) return "Could not find counter";
                    return {
                        value: counter.value,
                        add: validateFunction(async (amt: number): Promise<string | number> => {
                            counter.value += amt;
                            await counter.save();
                            return counter.value;
                        }, ["number|required|min:1"], returnErrorAsync()),
                        sub: validateFunction(async (amt: number): Promise<string | number> => {
                            counter.value -= amt;
                            await counter.save();
                            return counter.value;
                        }, ["number|required|min:1"], returnErrorAsync()),
                        set: validateFunction(async (amt: number): Promise<string | number> => {
                            counter.value = amt;
                            await counter.save();
                            return counter.value;
                        }, ["number|required|min:1"], returnErrorAsync())
                    };
                }, ["string|required"], returnErrorAsync())
            }
        };
    }
}