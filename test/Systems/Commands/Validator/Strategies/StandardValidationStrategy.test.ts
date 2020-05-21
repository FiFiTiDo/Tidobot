import sinon from "sinon"
import {CommandEvent} from "../../../../../src/Systems/Commands/CommandEvent";
import Message from "../../../../../src/Chat/Message";
import StandardValidationStrategy
    from "../../../../../src/Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {string} from "../../../../../src/Systems/Commands/Validator/String";
import {integer} from "../../../../../src/Systems/Commands/Validator/Integer";
import {expect} from "chai";
import {ValidatorStatus} from "../../../../../src/Systems/Commands/Validator/Strategies/ValidationStrategy";

describe("StandardValidationStrategy", function () {
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
            const event = new CommandEvent("!command", ["hello", "world", "42"], message as Message);
            const {status} = await event.validate(new StandardValidationStrategy({
                usage: "!command <arg 1> <arg 2> <arg 3>",
                arguments: [
                    string({ name: "arg 1", required: true }),
                    string({ name: "arg 2", required: true }),
                    integer({ name: "arg 3", required: true })
                ],
                permission: "blah"
            }));
            expect(status).to.eq(ValidatorStatus.OK);
        });

        it("should fail to validate a simple message", async function () {
            const event = new CommandEvent("!command", ["hello", "world"], message as Message);
            const {status} = await event.validate(new StandardValidationStrategy({
                usage: "!command <arg 1> <arg 2> <arg 3>",
                arguments: [
                    string({ name: "arg 1", required: true }),
                    string({ name: "arg 2", required: true }),
                    integer({ name: "arg 3", required: true })
                ]
            }));
            expect(status).to.eq(ValidatorStatus.INVALID_ARGS);
        });

        it("should fail to validate a message without perm", async function () {
            const event = new CommandEvent("!command", ["hello", "world", "42"], messageNoPerm as Message);
            const {status} = await event.validate(new StandardValidationStrategy({
                usage: "!command <arg 1> <arg 2> <arg 3>",
                arguments: [
                    string({ name: "arg 1", required: true }),
                    string({ name: "arg 2", required: true }),
                    integer({ name: "arg 3", required: true })
                ],
                permission: "blah"
            }));
            expect(status).to.eq(ValidatorStatus.NOT_PERMITTED);
        });
    });
});