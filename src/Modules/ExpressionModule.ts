import AbstractModule from "./AbstractModule";
import Message from "../Chat/Message";
import deepmerge from "deepmerge";
import rp from "request-promise-native";
import Application from "../Application/Application";
import cheerio from "cheerio";
import {__, array_rand, format_duration} from "../Utilities/functions";
import moment from "moment";
import lexer from "../Utilities/Expression/Lexer";
import Dictionary from "../Utilities/Dictionary";
import chrono from "chrono-node";
import ExpressionParser from "../Utilities/Expression/Parser";
import ExpressionInterpreter from "../Utilities/Expression/Interpreter";
import prettyMilliseconds from "pretty-ms";

export type ExpressionContext = { [key: string]: any };
export type ExpressionContextResolver = (msg: Message) => ExpressionContext;

export default class ExpressionModule extends AbstractModule {
    private readonly resolvers: ExpressionContextResolver[];
    private parser: ExpressionParser;
    private interpreter: ExpressionInterpreter;

    constructor() {
        super(ExpressionModule.name);

        this.resolvers = [];
        this.parser = new ExpressionParser();
        this.interpreter = new ExpressionInterpreter();
    }

    registerResolver(resolver: ExpressionContextResolver) {
        this.resolvers.push(resolver);
    }

    async evaluate(expr: string, msg: Message) {
        let objects = [];
        objects.push({
            pick: (array: unknown) => {
                if (!Array.isArray(array)) return "Error: pick requires an array of values.";

                let i = Math.floor(Math.random() * (array.length - 1));
                return array[i];
            },
            getText: async (url: unknown) => {
                if (typeof url !== "string") return "Invalid argument, expected a URL.";

                try {
                    return await rp(url);
                } catch (e) {
                    Application.getLogger().error("Web request error", {cause: e});
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
                    Application.getLogger().error("Web request error", {cause: e});
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
                    Application.getLogger().error("Web request error", {cause: e});
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
                let responses = [
                    'All signs point to yes...', 'Yes!', 'My sources say nope.', 'You may rely on it.',
                    'Concentrate and ask again...', 'Outlook not so good...', 'It is decidedly so!',
                    'Better not tell you.', 'Very doubtful.', 'Yes - Definitely!', 'It is certain!',
                    'Most likely.', 'Ask again later.', 'No!', 'Outlook good.', 'Don\'t count on it.'
                ];
                return array_rand(responses);
            },
            timeuntil: (timestring: unknown, long_format: boolean) => {
                if (typeof timestring !== "string") return "Invalid arguments, expected a timestring.";

                const parsed = chrono.parseDate(timestring, Date.now(), {forwardDate: true});
                const datetime = moment(parsed);
                const dur = moment.duration(datetime.diff(moment()));
                return long_format ? format_duration(dur) : dur.humanize();
            },
            timesince: (timestring: unknown, long_format: boolean) => {
                if (typeof timestring !== "string") return "Invalid arguments, expected a timestring.";

                const parsed = chrono.parseDate(timestring, Date.now(), {forwardDate: false});
                const datetime = moment(parsed);
                const dur = moment.duration(moment().diff(datetime));
                return long_format ? format_duration(dur) : dur.humanize();
            },
            process: {
                exit: () => 'You thought you could stop my bot? lmao'
            },
            uptime: () => prettyMilliseconds(Application.getUptime().asMilliseconds()),
            urlencode: (input: any) => encodeURIComponent(input)
        });
        objects.push(await msg.getExpressionContext());
        for (let resolver of this.resolvers) objects.push(resolver(msg));

        try {
            let lexingResult = lexer.tokenize(expr);
            this.parser.input = lexingResult.tokens;
            let cst = this.parser.expression();
            return await this.interpreter.visit(cst, new Dictionary(deepmerge.all(objects)));
        } catch (e) {
            Application.getLogger().error("An error occurred with the expression parser", {cause: e});
            return __("general.failed_to_eval");
        }
    }
}