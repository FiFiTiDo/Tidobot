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
import {Key} from "../../Utilities/Translator";
import chrono from "chrono-node";

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
            pick: (array: unknown) => {
                if (!Array.isArray(array)) return "Error: pick requires an array of values.";

                const i = Math.floor(Math.random() * (array.length - 1));
                return array[i];
            },
            getText: async (url: unknown) => {
                if (typeof url !== "string") return "Invalid argument, expected a URL.";

                try {
                    return await rp(url);
                } catch (e) {
                    Logger.get().error("Web request error", {cause: e});
                    return "Web request error";
                }
            },
            getJson: async (url: unknown) => {
                if (typeof url !== "string") {
                    return "Invalid argument, expected a URL.";
                }

                try {
                    return await rp({
                        uri: url,
                        json: true
                    });
                } catch (e) {
                    Logger.get().error("Web request error", {cause: e});
                    return "Web request error";
                }
            },
            getHtml: async (url: unknown, selector: unknown) => {
                if (typeof url !== "string" || typeof selector !== "string") {
                    return "Invalid arguments, expected a URL and a CSS selector.";
                }

                try {
                    return await rp(url).then((html: string) => {
                        const $ = cheerio.load(html);
                        return $(selector).text();
                    });
                } catch (e) {
                    Logger.get().error("Web request error", {cause: e});
                    return "Web request error";
                }
            },
            random: (min: number, max = NaN) => {
                if (!min || isNaN(min)) {
                    return "Requires at least one argument.";
                }

                if (isNaN(max)) {
                    max = min;
                    min = 0;
                }

                return Math.floor(Math.random() * (max - min) + min);
            },
            eightBall: () => {
                const responses = [
                    "All signs point to yes...", "Yes!", "My sources say nope.", "You may rely on it.",
                    "Concentrate and ask again...", "Outlook not so good...", "It is decidedly so!",
                    "Better not tell you.", "Very doubtful.", "Yes - Definitely!", "It is certain!",
                    "Most likely.", "Ask again later.", "No!", "Outlook good.", "Don't count on it."
                ];
                return array_rand(responses);
            },
            timeuntil: (timestring: unknown, longFormat = false) => {
                if (typeof timestring !== "string") return "Invalid arguments, expected a timestring.";

                const parsed = chrono.parseDate(timestring, Date.now(), {forwardDate: true});
                const datetime = moment(parsed);
                const dur = moment.duration(datetime.diff(moment()));
                return longFormat ? format_duration(dur) : dur.humanize();
            },
            timesince: (timestring: unknown, longFormat = false) => {
                if (typeof timestring !== "string") return "Invalid arguments, expected a timestring.";

                const parsed = chrono.parseDate(timestring, Date.now(), {forwardDate: false});
                const datetime = moment(parsed);
                const dur = moment.duration(moment().diff(datetime));
                return longFormat ? format_duration(dur) : dur.humanize();
            },
            process: {
                exit: (): string => "You thought you could stop my bot? lmao"
            },
            uptime: () => prettyMilliseconds(Application.getUptime().asMilliseconds()),
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
            Logger.get().error("An error occurred with the expression parser", {cause: e});
            return msg.getResponse().translate(Key("general.failed_to_eval"));
        }
    }
}