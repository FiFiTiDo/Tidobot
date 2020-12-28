import { noop } from "lodash";
import { Logger } from "log4js";
import { Inject, Service } from "typedi";
import { Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Server } from "ws";
import Adapter from "../Adapters/Adapter";
import { AdapterToken } from "../symbols";
import EventSystem from "../Systems/Event/EventSystem";
import TimerSystem, { TimeUnit } from "../Systems/Timer/TimerSystem";
import { getLogger } from "../Utilities/Logger";
import { ClientHandler } from "./ClientHandler";
import {ChannelRepository} from "../Database/Repositories/ChannelRepository";

@Service()
export class CompanionServer {
    private readonly server: Server;
    private readonly logger: Logger;
    private clients: ClientHandler[];
    private pingTimer: NodeJS.Timer;
    
    constructor(
        eventSystem: EventSystem,
        @InjectRepository() channelRepository: ChannelRepository,
        @Inject(AdapterToken) adapter: Adapter,
        timerSystem: TimerSystem
    ) {
        this.logger = getLogger("CompanionServer");
        this.server = new Server({ port: 3000 });
        this.server.on("connection", ws => {
            const i = this.clients.push(new ClientHandler(ws, channelRepository, adapter, eventSystem)) - 1;

            ws.on("close", () => {
                this.clients.splice(i, 1);
            });
        });
        this.pingTimer = timerSystem.startTimer(() => {
            for (const client of this.clients) {
                if (client.isAlive === false) {
                    client.socket.terminate();
                    continue;
                }

                client.isAlive = false;
                client.socket.ping(noop);
            }
        }, TimeUnit.Seconds(30));
        this.server.on("close", () => timerSystem.stopTimer(this.pingTimer));
        this.logger.info("Websocket server started");
    }
}