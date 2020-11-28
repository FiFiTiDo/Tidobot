import ExpressionParser from "./Parser";
import ExpressionInterpreter from "./Interpreter";
import Message from "../../Chat/Message";
import cheerio from "cheerio";
import moment from "moment";
import {formatDuration} from "../../Utilities/TimeUtils";
import prettyMilliseconds from "pretty-ms";
import Application from "../../Application/Application";
import lexer from "./Lexer";
import Dictionary from "../../Utilities/Structures/Dictionary";
import deepmerge from "deepmerge";
import chrono from "chrono-node";
import {IllegalStateError, OutOfBoundsError, UnknownKeyError} from "./InterpreterErrors";
import System from "../System";
import { Service } from "typedi";
import Axios from "axios";
import { logErrorOnFail, logErrorOnFailAsync, returnError, returnErrorAsync, validateFunction } from "../../Utilities/ValidateFunction";
import _ from "lodash";
import { logError } from "../../Utilities/Logger";
import { randomFloat } from "../../Utilities/RandomUtils";
import { randomInt } from "crypto";

export interface ExpressionContext {
    [key: string]: any;
}

export interface ExpressionContextResolver {
    (msg: Message): ExpressionContext;
}

@Service()
export default class ExpressionSystem extends System {
    private readonly resolvers: ExpressionContextResolver[] = [];
    private parser: ExpressionParser;
    private interpreter: ExpressionInterpreter;

    constructor() {
        super("Expression");
        this.parser = new ExpressionParser();
        this.interpreter = new ExpressionInterpreter();
        this.logger.info("System initialized");
    }

    registerResolver(resolver: ExpressionContextResolver): void {
        this.resolvers.push(resolver);
    }

    async evaluate(expr: string, msg: Message): Promise<string> {
        const objects = [];
        objects.push({
            pick: validateFunction((array: any[]) => _.sample(array), ["array|required"], returnError()),
            getText: validateFunction(async (url: string): Promise<string> => {
                try {
                    return await Axios({ url, responseType: "text" }).then(resp => resp.data);
                } catch (e) {
                    logError(this.logger, e, "Web request error");
                    return await msg.response.translate("expression:error.network");
                }
            }, ["string|required"], returnErrorAsync()),
            getJson: validateFunction(async (url: string): Promise<object> => {
                try {
                    return await Axios({url, responseType: "json"}).then(resp => resp.data);
                } catch (e) {
                    logError(this.logger, e, "Web request error");
                    return await msg.response.translate("expression:error.network");
                }
            }, ["string|required"], logErrorOnFailAsync(this.logger, {})),
            getHtml: validateFunction(async (url: string, selector: string): Promise<string> => {
                try {
                    return await Axios({url, responseType: "document"}).then(resp => {
                        const $ = cheerio.load(resp.data);
                        return $(selector).text();
                    });
                } catch (e) {
                    logError(this.logger, e, "Web request error");
                    return await msg.getResponse().translate("expression:error.network");
                }
            }, ["string|required", "string|required"], returnErrorAsync()),
            random: validateFunction((min?: number, max?: number, integer = false): number => {
                return integer ? randomInt(min, max) : randomFloat(min, max);
            }, ["number", "number", "boolean"], logErrorOnFail(this.logger, -1)),
            timeuntil: validateFunction((timestring: string, longFormat = false): string => {
                const parsed = chrono.parseDate(timestring, Date.now(), {forwardDate: true});
                const datetime = moment(parsed);
                const dur = moment.duration(datetime.diff(moment()));
                return longFormat ? formatDuration(dur) : dur.humanize();
            }, ["string|required", "boolean"], returnError()),
            timesince: validateFunction((timestring: string, longFormat = false): string => {
                const parsed = chrono.parseDate(timestring, Date.now(), {forwardDate: false});
                const datetime = moment(parsed);
                const dur = moment.duration(moment().diff(datetime));
                return longFormat ? formatDuration(dur) : dur.humanize();
            }, ["string|required", "boolean"], returnError()),
            process: {
                exit: async (): Promise<string> => await msg.getResponse().translate("expression:error.shutdown")
            },
            bot: {
                getUptime: (): string => prettyMilliseconds(Application.getUptime().asMilliseconds()),
            },
            urlencode: (input: any) => encodeURIComponent(input)
        });
        objects.push(await msg.getExpressionContext());
        for (const resolver of this.resolvers) objects.push(resolver(msg));

        try {
            const lexingResult = lexer.tokenize(expr);
            this.parser.input = lexingResult.tokens;
            const cst = this.parser.expression();
            return await this.interpreter.visit(cst, new Dictionary(deepmerge.all(objects)));
        } catch (e) {
            if (e instanceof UnknownKeyError) {
                return await msg.getResponse().translate("expression:error.invalid-key", {
                    key: e.key,
                    column: e.token.startColumn
                });
            } else if (e instanceof OutOfBoundsError) {
                return msg.getResponse().translate("expression:error.out-of-bounds", {
                    index: e.index,
                    column: e.token.startColumn
                });
            } else if (e instanceof IllegalStateError) {
                return msg.getResponse().translate("expression:error.illegal-state", {
                    expected: e.expected,
                    given: e.given,
                    column: e.token.startColumn
                });
            }

            this.logger.error("An error occurred with the expression parser");
            this.logger.error("Caused by: " + e.message);
            this.logger.error(e.stack);
            return msg.getResponse().translate("expression:error.generic");
        }
    }
}