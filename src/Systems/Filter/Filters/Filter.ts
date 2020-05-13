import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";

export default abstract class Filter {
    protected constructor(protected strikeManager: StrikeManager) {
    }

    abstract handleMessage(lists: FiltersEntity, eventArgs: MessageEventArgs): Promise<boolean>;
}