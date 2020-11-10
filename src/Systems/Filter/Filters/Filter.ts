import StrikeManager from "../StrikeManager";
import { Inject, Service } from "typedi";
import Message from "../../../Chat/Message";

@Service()
export default abstract class Filter {
    @Inject()
    protected strikeManager: StrikeManager;

    abstract handleMessage(message: Message): Promise<boolean>;
}