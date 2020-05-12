import moment from "moment";
import axios from "axios";

export class AccessToken {
    private readonly timestamp;

    constructor(public token: string, private refreshToken: string, private expiresIn: number, private clientId: string, private clientSecret: string) {
        this.timestamp = moment().add(expiresIn - 300, "seconds");
    }

    static async retrieve(clientId: string, clientSecret: string): Promise<AccessToken> {
        return axios.post(`https://id.twitch.tv/oauth2/token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`)
            .then(({data}) => new AccessToken(data.access_token, data.refresh_token, data.expires_in, clientId, clientSecret));
    }

    async validate(): Promise<void> {
        if (this.isExpired()) await this.refresh();
    }

    isExpired(): boolean {
        return moment().isAfter(this.timestamp);
    }

    async refresh(): Promise<void> {
        return axios.post(`https://id.twitch.tv/oauth2/token?grant_type=refresh_token&refresh_token=${this.refreshToken}&client_id=${this.clientId}&client_secret=${this.clientSecret}`)
            .then(({data}) => {
                this.token = data.access_token;
                this.refreshToken = data.refresh_token;
            });
    }
}