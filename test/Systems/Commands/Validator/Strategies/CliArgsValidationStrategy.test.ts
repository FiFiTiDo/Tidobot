import sinon from "sinon"
import {CommandEvent} from "../../../../../src/Systems/Commands/CommandEvent";
import Message from "../../../../../src/Chat/Message";
import {string} from "../../../../../src/Systems/Commands/Validation/String";
import {integer} from "../../../../../src/Systems/Commands/Validation/Integer";
import {expect} from "chai";
import {ValidatorStatus} from "../../../../../src/Systems/Commands/Validation/Strategies/ValidationStrategy";
import CliArgsValidationStrategy
    from "../../../../../src/Systems/Commands/Validation/Strategies/CliArgsValidationStrategy";

describe("CliArgsValidationStrategy", function () {
    let message;
    let messageNoPerm;
    let channel;
    let response;

    before(function () {
        channel = {
            getSetting: sinon.stub()
        };

        response = {
            rawMessage: sinon.stub(),
            genericError: sinon.stub(),
            translate: sinon.stub()
        };

        message = {
            getChannel: () => channel,
            getResponse: () => response,
            checkPermission: async () => true
        };

        messageNoPerm = {
            getChannel: () => channel,
            getResponse: () => response,
            checkPermission: async () => false
        };
    });

    describe("#validate", function () {
        it("should validate a simple message", async function () {
            const event = new CommandEvent("!command", ["--title", "hello", "--test", "world", "42"], message as Message);
            const {status} = await event.validate(new CliArgsValidationStrategy({
                usage: "!command --title <arg 1> --test <arg 2> <arg 3>",
                arguments: {
                    title: string({name: "arg 1", required: true}),
                    test: string({name: "arg 2", required: true}),
                    _: integer({name: "arg 3", required: true})
                },
                permission: "blah"
            }));
            expect(status).to.eq(ValidatorStatus.OK);
        });

        it("should fail to validate a simple message", async function () {
            const event = new CommandEvent("!command", ["--title", "hello", "--test", "world"], message as Message);
            const {status} = await event.validate(new CliArgsValidationStrategy({
                usage: "!command <arg 1> <arg 2> <arg 3>",
                arguments: {
                    title: string({name: "arg 1", required: true}),
                    test: string({name: "arg 2", required: true}),
                    _: integer({name: "arg 3", required: true})
                },
                permission: "blah"
            }));
            expect(status).to.eq(ValidatorStatus.INVALID_ARGS);
        });

        it("should fail to validate a message without perm", async function () {
            const event = new CommandEvent("!command", ["hello", "world", "42"], messageNoPerm as Message);
            const {status} = await event.validate(new CliArgsValidationStrategy({
                usage: "!command <arg 1> <arg 2> <arg 3>",
                arguments: {
                    title: string({name: "arg 1", required: true}),
                    test: string({name: "arg 2", required: true}),
                    _: integer({name: "arg 3", required: true})
                },
                permission: "blah"
            }));
            expect(status).to.eq(ValidatorStatus.NOT_PERMITTED);
        });
    });
});