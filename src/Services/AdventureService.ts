import _, { isUndefined } from "lodash";
import moment, { Moment } from "moment";
import { Service } from "typedi";
import Message from "../Chat/Message";
import { Response } from "../Chat/Response";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import { EntityStateList } from "../Database/EntityStateList";
import GameModule from "../Modules/GameModule";
import TimerSystem, { TimeUnit } from "../Systems/Timer/TimerSystem";
import { randomChance } from "../Utilities/RandomUtils";

enum GameState {
    WAITING, IN_GAME, ENDED
}

export enum EnterResult {
    SUCCESSFUL, STARTED, ALREADY_STARTED, TOO_LOW, TOO_HIGH, NOT_ENOUGH, ALREADY_ENTERED, CANNOT_START, COOLDOWN
}

interface Story {
    title: string;
    chapters: string[];
}

interface GameResult {
    survivors: Chatter[];
    caught: Chatter[];
    hero: Chatter;
}

function formatChapter(chapter: string, result: GameResult): string|null {
    let line = chapter;
    if (_.includes(line, "(caught)")) {
        if (result.caught.length > 0) {
            line = line.replace("(caught)", result.caught.map(caught => caught.user.name).join(", "));
        } else {
            return null;
        }
    }

    if (_.includes(line, "(survivors)")) {
        if (result.survivors.length > 0) {
            line = line.replace("(survivors)", result.survivors.map(survivor => survivor.user.name).join(", "));
        } else {
            return null;
        }
    }
    
    if (_.includes(line, "(hero)")) {
        if (result.hero !== null) {
            line = line.replace("(hero)", result.hero.user.name);
        } else {
            return null;
        }
    }
    return line;
}

export class AdventureGame {
    private readonly startTime = moment();
    private readonly entries = new EntityStateList<Chatter, number>(-1);
    private endTime: Moment = null;
    private state = GameState.WAITING;
    private gameTimer: NodeJS.Timer;
    private chapter = 0;

    constructor(
        private readonly channel: Channel, 
        private readonly story: Story,
        private readonly timerSystem: TimerSystem,
        private readonly response: Response
    ) {
        const waitTime = channel.settings.get(GameModule.settings.ADVENTURE_WAIT_TIME);
        timerSystem.startTimeout(this.runStory.bind(this), TimeUnit.Seconds(waitTime));
    }

    async enter(chatter: Chatter, amount: number): Promise<EnterResult> {
        if (this.entries.has(chatter)) return EnterResult.ALREADY_ENTERED;
        if (amount < this.channel.settings.get(GameModule.settings.ADVENTURE_MIN_BET)) return EnterResult.TOO_LOW;
        if (amount > this.channel.settings.get(GameModule.settings.ADVENTURE_MAX_BET)) return EnterResult.TOO_HIGH;
        if (!(await chatter.charge(amount))) return EnterResult.NOT_ENOUGH;

        this.entries.set(chatter, amount);
        return EnterResult.SUCCESSFUL;
    }

    private generateResult(): GameResult {
        const survivors = [];
        const caught = [];

        const survivalChance = this.channel.settings.get(GameModule.settings.ADVENTURE_SURVIVAL_CHANCE);

        for (const chatter of this.entries.entities()) {
            if (randomChance(survivalChance))
                survivors.push(chatter);
            else
                caught.push(chatter);
        }

        return { 
            survivors, caught, hero: survivors.length > 0 ? _.sample(survivors) : null
        };
    }

    runStory(): void {
        if (this.state !== GameState.WAITING) return;

        this.state = GameState.IN_GAME;
        
        this.response.message("adventure:run-story", { count: this.entries.count(), title: this.story.title });

        const result = this.generateResult();
        this.gameTimer = this.timerSystem.startTimer(this.nextChapter.bind(this, result), TimeUnit.Seconds(7));
    }

    hasEnded(): boolean {
        return this.state === GameState.ENDED;
    }

    async nextChapter(result: GameResult): Promise<void> {
        if (this.chapter < this.story.chapters.length) {
            const msg = formatChapter(this.story.chapters[this.chapter], result);
            this.chapter++;
            if (isUndefined(msg) || msg === null)
                await this.nextChapter(result);
            else
                await this.response.rawMessage(msg);
        } else {
            this.endGame(result);
            this.timerSystem.stopTimer(this.gameTimer);
        }
    }

    async endGame(result: GameResult): Promise<void> {
        this.state = GameState.ENDED;
        this.endTime = moment();

        const gainPercent = this.channel.settings.get(GameModule.settings.ADVENTURE_GAIN_PERCENT) / 100;
        for (const survivor of result.survivors) {
            const bet = this.entries.get(survivor);
            const gains = bet * gainPercent;
            const totalPay = bet + gains;

            await survivor.deposit(totalPay);
        }

        if (result.caught.length === 0) {
            // Noone caught
            await this.response.message("adventure:completed.all-survivors");
        } else if (result.survivors.length === 0) {
            // All caught
            await this.response.message("adventure:completed.no-survivors");
        } else {
            // Some caught
            await this.response.message("adventure:completed.some-survivors", { survivors: result.survivors.length, caught: result.caught.length });
        }

        this.timerSystem.startTimeout(() => {
            this.response.message("adventure:cooldown-end");
        }, TimeUnit.Seconds(this.channel.settings.get(GameModule.settings.ADVENTURE_COOLDOWN)));
    }

    shouldEnd(): boolean {
        const length = this.channel.settings.get(GameModule.settings.ADVENTURE_WAIT_TIME);
        const endTime = this.startTime.add(length, "minutes");

        return moment().isAfter(endTime);
    }

    checkCooldown(): boolean {
        const cooldownEnd = this.endTime.add(this.channel.settings.get(GameModule.settings.ADVENTURE_COOLDOWN), "seconds");
        return moment().isAfter(cooldownEnd);
    }
}

@Service()
export class AdventureService {
    private readonly games = new EntityStateList<Channel, AdventureGame>(null);

    constructor(private readonly timerSystem: TimerSystem) {}

    private async getStory(message: Message): Promise<Story> {
        return _.sample(await message.response.getTranslation<Story[]>("adventure:stories"));
    }

    public async enterGame(message: Message, amount: number): Promise<EnterResult> {
        let started = false;
        let game = this.games.get(message.channel);
        if (game !== null && !game.checkCooldown()) return EnterResult.COOLDOWN;
        if (game === null || game.hasEnded()) {
            game = new AdventureGame(message.channel, await this.getStory(message), this.timerSystem, message.response);
            started = true;
        }
        const result = await game.enter(message.chatter, amount);
        return (result === EnterResult.SUCCESSFUL && started) ? EnterResult.STARTED : result;
    }
}