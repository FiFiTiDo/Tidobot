import ExpressionParser from "./Parser";
import ExpressionInterpreter from "./Interpreter";
import Message from "../../Chat/Message";
import rp from "request-promise-native";
import Logger from "../../Utilities/Logger";
import cheerio from "cheerio";
import {array_rand} from "../../Utilities/ArrayUtils";
import moment from "moment";
import {format_duration} from "../../Utilities/functions";
import prettyMilliseconds from "pretty-ms";
import Application from "../../Application/Application";
import lexer from "./Lexer";
import Dictionary from "../../Utilities/Structures/Dictionary";
import deepmerge from "deepmerge";
import chrono from "chrono-node";
import {IllegalStateError, OutOfBoundsError, UnknownKeyError} from "./InterpreterErrors";

export interface ExpressionContext {
    [key: string]: any;
}

export interface ExpressionContextResolver {
    (msg: Message): ExpressionContext;
}

export default class ExpressionSystem {
    private static instance: ExpressionSystem = null;

    static getInstance(): ExpressionSystem {
        if (this.instance == null) {
            this.instance = new ExpressionSystem();
        }

        return this.instance;
    }
    private readonly resolvers: ExpressionContextResolver[] = [];
    private parser: ExpressionParser;
    private interpreter: ExpressionInterpreter;

    constructor() {
        this.parser = new ExpressionParser();
        this.interpreter = new ExpressionInterpreter();
    }

    registerResolver(resolver: ExpressionContextResolver): void {
        this.resolvers.push(resolver);
    }

    async evaluate(expr: string, msg: Message): Promise<string> {
        const objects = [];
        objects.push({
            pick: async (array: unknown): Promise<any> => {
                if (!Array.isArray(array)) return await msg.getResponse().translate("expression:error.argument", {
                    expected: await msg.getResponse().translate("expression:types.array")
                });

                const i = Math.floor(Math.random() * (array.length - 1));
                return array[i];
            },
            getText: async (url: unknown): Promise<string> => {
                if (typeof url !== "string") return await msg.getResponse().translate("expression:error.argument", {
                    expected: await msg.getResponse().translate("expression:types.url")
                });

                try {
                    return await rp(url);
                } catch (e) {
                    Logger.get().error("Web request error", {cause: e});
                    return await msg.getResponse().translate("expression:error.network");
                }
            },
            getJson: async (url: unknown): Promise<string> => {
                if (typeof url !== "string") return await msg.getResponse().translate("expression:error.argument", {
                    expected:await  msg.getResponse().translate("expression:types.url")
                });

                try {
                    return await rp({
                        uri: url,
                        json: true
                    });
                } catch (e) {
                    Logger.get().error("Web request error", {cause: e});
                    return await msg.getResponse().translate("expression:error.network");
                }
            },
            getHtml: async (url: unknown, selector: unknown): Promise<string> => {
                if (typeof url !== "string") return await msg.getResponse().translate("expression:error.argument", {
                    expected: await msg.getResponse().translate("expression:types.url")
                });

                if (typeof selector !== "string") return await msg.getResponse().translate("expression:error.argument", {
                    expected: await msg.getResponse().translate("expression:types.css-selector")
                });

                try {
                    return await rp(url).then((html: string) => {
                        const $ = cheerio.load(html);
                        return $(selector).text();
                    });
                } catch (e) {
                    Logger.get().error("Web request error", {cause: e});
                    return await msg.getResponse().translate("expression:error.network");
                }
            },
            random: async (min: number, max = NaN): Promise<number|string> => {
                if (typeof min !== "number") return await msg.getResponse().translate("expression:error.argument", {
                    expected: await msg.getResponse().translate("expression:types.number")
                }) as string;

                if (isNaN(max)) {
                    max = min;
                    min = 0;
                }

                return Math.floor(Math.random() * (max - min) + min);
            },
            timeuntil: async (timestring: unknown, longFormat = false): Promise<string> => {
                if (typeof timestring !== "string") return await msg.getResponse().translate("expression:error.argument", {
                    expected: await msg.getResponse().translate("expression:types.time")
                });

                const parsed = chrono.parseDate(timestring, Date.now(), {forwardDate: true});
                const datetime = moment(parsed);
                const dur = moment.duration(datetime.diff(moment()));
                return longFormat ? format_duration(dur) : dur.humanize();
            },
            timesince: async (timestring: unknown, longFormat = false): Promise<string> => {
                if (typeof timestring !== "string") return await msg.getResponse().translate("expression:error.argument", {
                    expected: await msg.getResponse().translate("expression:types.time")
                });

                const parsed = chrono.parseDate(timestring, Date.now(), {forwardDate: false});
                const datetime = moment(parsed);
                const dur = moment.duration(moment().diff(datetime));
                return longFormat ? format_duration(dur) : dur.humanize();
            },
            process: {
                exit: async (): Promise<string> => await msg.getResponse().translate("expression:error.shutdown")
            },
            bot: {
                getUptime: () => prettyMilliseconds(Application.getUptime().asMilliseconds()),
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

            Logger.get().error("An error occurred with the expression parser", {cause: e});
            return msg.getResponse().translate("expression:error.generic");
        }
    }
}