import { Service } from "typedi";
import { Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Service as ServiceEntity } from "../Database/Entities/Service";
import Config from "../Systems/Config/Config";
import GeneralConfig from "../Systems/Config/ConfigModels/GeneralConfig";

@Service()
export class ServiceManager {
    private _service: ServiceEntity;

    constructor(
        @InjectRepository()
        private readonly repository: Repository<ServiceEntity>,
        private readonly config: Config
    ) {}

    async initialize(): Promise<void> {
        const general = await this.config.getConfig(GeneralConfig);
        const serviceName = general.service;
        const service = await this.repository.findOne({ name: serviceName });
        if (service === null) throw new Error("Unable to find service: " + serviceName);
        this._service = service;
    }

    get service(): ServiceEntity {
        return this._service;
    }
}