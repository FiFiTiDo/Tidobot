import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import { Inject, Service } from "typedi";

@Service()
export default abstract class Filter {
    @Inject()
    protected strikeManager: StrikeManager;

    abstract handleMessage(eventArgs: MessageEventArgs): Promise<boolean>;
}