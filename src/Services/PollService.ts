import Optional from "../Utilities/Patterns/Optional";
import { Service } from "typedi";
import { Channel } from "../Database/Entities/Channel";
import { EntityStateList } from "../Database/EntityStateLiist";
import { Chatter } from "../Database/Entities/Chatter";

class Poll {
    private _open: boolean;
    private readonly votes: { [key: string]: Chatter[] };
    private userVotes: EntityStateList<Chatter, string>;

    constructor(private readonly options: string[]) {
        this.votes = {};
        this.userVotes = new EntityStateList<Chatter, string>("");

        for (const option of options)
            this.votes[option] = [];
    }

    validateVote(option: string, chatter: Chatter): boolean {
        return this.options.indexOf(option) >= 0 && !this.userVotes.has(chatter);
    }

    addVote(option: string, chatter: Chatter): boolean {
        if (!this.validateVote(option, chatter)) return false;
        this.votes[option].push(chatter);
        this.userVotes.set(chatter, option);
        return true;
    }

    open(): void {
        this._open = true;
    }

    close(): void {
        this._open = false;
    }

    isOpen(): boolean {
        return this._open;
    }

    getOption(index: number): string | null {
        index--;
        return index < 0 || index >= this.options.length ? null : this.options[index];
    }

    getTotalVotes(): number {
        return this.userVotes.size();
    }

    getResults(): { [key: string]: Chatter[] } {
        return this.votes;
    }

    formatResults(): string {
        const votes = this.getResults();
        const total = this.getTotalVotes();
        return Object.keys(votes).map(option => {
            const optionVotes = votes[option].length;
            const percentage = total < 1 ? 0 : (optionVotes / total) * 100;

            return `${option}: ${percentage}% (${optionVotes} votes)`;
        }).join(", ");
    }
}

@Service()
export class PollService {
    private readonly polls: EntityStateList<Channel, Poll>;

    constructor() {
        this.polls = new EntityStateList<Channel, Poll>(null);
    }

    getPoll(channel: Channel): Optional<Poll> {
        const poll = this.polls.get(channel);
        return poll === null ? Optional.empty() : Optional.of(poll);
    }

    getOpenPoll(channel: Channel): Optional<Poll> {
        return this.getPoll(channel).filter(poll => poll.isOpen());
    }

    createPoll(options: string[], channel: Channel): Optional<Poll> {
        if (this.getOpenPoll(channel).present) return Optional.empty();

        const poll = new Poll(options);
        this.polls.set(channel, poll);
        return Optional.of(poll);
    }

    addVote(option: Optional<string>, chatter: Chatter, channel: Channel): Optional<boolean> {
        return this.getOpenPoll(channel).map(poll => option.present ? poll.addVote(option.value, chatter) : null);
    }

    closePoll(channel: Channel): Optional<string> {
        const poll = this.getOpenPoll(channel);
        if (!poll.present) return Optional.empty();
        poll.value.close();
        return Optional.of(poll.value.formatResults());
    }

    getResults(channel: Channel): Optional<string> {
        return this.getPoll(channel).map(poll => poll.formatResults());
    }

    getOption(optionNum: number, channel: Channel): Optional<string> {
        return this.getPoll(channel).map(poll => poll.getOption(optionNum));
    }
}