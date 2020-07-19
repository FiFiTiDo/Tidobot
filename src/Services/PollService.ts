import ChatterEntity, {filterByChannel} from "../Database/Entities/ChatterEntity";
import EntityStateList from "../Database/EntityStateList";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import Optional from "../Utilities/Optional";

class Poll {
    private _open: boolean;
    private readonly votes: { [key: string]: ChatterEntity[] };
    private userVotes: EntityStateList<ChatterEntity, string>;

    constructor(private readonly options: string[], private channel: ChannelEntity) {
        this.votes = {};
        this.userVotes = new EntityStateList<ChatterEntity, string>("");

        for (const option of options)
            this.votes[option] = [];
    }

    validateVote(option: string, chatter: ChatterEntity): boolean {
        return this.options.indexOf(option) >= 0 && !this.userVotes.has(chatter);
    }

    addVote(option: string, chatter: ChatterEntity): boolean {
        if (!this.validateVote(option, chatter)) return false;
        this.votes[option].push(chatter);
        this.userVotes.set(chatter, option);
        return true;
    }

    removeVote(chatter: ChatterEntity): boolean {
        const option = this.userVotes.get(chatter);
        if (!option) return false;
        this.votes[option].splice(this.votes[option].indexOf(chatter), 1);
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
        return this.userVotes.size(filterByChannel(this.channel));
    }

    getResults(): { [key: string]: ChatterEntity[] } {
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

export class PollService {
    private readonly polls: EntityStateList<ChannelEntity, Poll>;

    constructor() {
        this.polls = new EntityStateList<ChannelEntity, Poll>(null);
    }

    getPoll(channel: ChannelEntity): Optional<Poll>  {
        const poll = this.polls.get(channel);
        return poll === null ? Optional.empty() : Optional.of(poll);
    }

    getOpenPoll(channel: ChannelEntity): Optional<Poll> {
        return this.getPoll(channel).filter(poll => poll.isOpen());
    }

    getClosedPoll(channel: ChannelEntity): Optional<Poll> {
        return this.getPoll(channel).filter(poll => !poll.isOpen());
    }

    createPoll(options: string[], channel: ChannelEntity): Optional<Poll> {
        if (this.getOpenPoll(channel).present) return Optional.empty();

        const poll = new Poll(options, channel);
        this.polls.set(channel, poll);
        return Optional.of(poll);
    }

    addVote(option: Optional<string>, chatter: ChatterEntity, channel: ChannelEntity): Optional<boolean> {
        return this.getOpenPoll(channel).map(poll => option.present ? poll.addVote(option.value, chatter) : null);
    }

    closePoll(channel: ChannelEntity): Optional<string> {
        const poll = this.getOpenPoll(channel);
        if (!poll.present) return Optional.empty();
        poll.value.close();
        return Optional.of(poll.value.formatResults());
    }

    getResults(channel: ChannelEntity): Optional<string> {
        return this.getPoll(channel).map(poll => poll.formatResults());
    }

    getOption(optionNum: number, channel: ChannelEntity): Optional<string> {
        return this.getPoll(channel).map(poll => poll.getOption(optionNum));
    }
}