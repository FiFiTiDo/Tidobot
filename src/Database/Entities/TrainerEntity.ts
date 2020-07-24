import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import ChatterEntity from "./ChatterEntity";
import {where} from "../Where";
import PokemonEntity from "./PokemonEntity";
import {OneToMany, OneToOne} from "../Decorators/Relationships";
import ChannelSpecificEntity from "./ChannelSpecificEntity";
import ChannelEntity from "./ChannelEntity";

interface TrainerData {
    trainer: TrainerEntity;
    team: PokemonEntity[];
}

@Id
@Table(({service, channel}) => `${service}_${channel.name}_trainer`)
export default class TrainerEntity extends ChannelSpecificEntity<TrainerEntity> {
    @Column({name: "user_id"})
    public userId: string;
    @Column({datatype: DataTypes.INTEGER})
    public won: number;
    @Column({datatype: DataTypes.INTEGER})
    public lost: number;
    @Column({datatype: DataTypes.INTEGER})
    public draw: number;

    constructor(id: number, params: EntityParameters) {
        super(TrainerEntity, id, params);
    }

    public static async getByChatter(chatter: ChatterEntity): Promise<TrainerEntity> {
        return TrainerEntity.retrieveOrMake({channel: chatter.getChannel()}, where().eq("user_id", chatter.userId), {
            user_id: chatter.userId,
            won: 0,
            lost: 0,
            draw: 0
        });
    }

    public static async* getAllTrainers(channel: ChannelEntity): AsyncIterableIterator<TrainerData> {
        const trainers = await this.getAll({channel});
        for (const trainer of trainers)
            yield {trainer, team: await trainer.team()};
    }

    @OneToOne(ChatterEntity, "user_id", "user_id")
    public async chatter(): Promise<ChatterEntity> {
        return null;
    }

    @OneToMany(PokemonEntity, "id", "trainer_id")
    public async team(): Promise<PokemonEntity[]> {
        return [];
    }
}