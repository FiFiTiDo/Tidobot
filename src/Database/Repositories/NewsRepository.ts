import { Service } from "typedi";
import { EntityRepository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { News } from "../Entities/News";
import { ConvertingRepository } from "./ConvertingRepository";

@Service()
@EntityRepository(News)
export class NewsRepository extends ConvertingRepository<News> {
    static TYPE = "news item"

    async make(content: string, channel: Channel): Promise<News> {
        const newsItem = new News();
        newsItem.content = content;
        newsItem.channel = channel;
        newsItem.itemId = channel.newsIdCounter++;

        await channel.save();
        return this.save(newsItem);
    }

    convert(raw: string, channel: Channel): Promise<News> {
        const intVal = parseInt(raw);
        if (isNaN(intVal)) return null;
        return this.findOne({ itemId: intVal, channel });
    }
}