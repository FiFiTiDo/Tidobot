import axios, {AxiosInstance, AxiosPromise} from "axios";

export default class LastFMApi {
    private readonly axios: AxiosInstance;

    constructor(private apiKey, private secret) {
        this.axios = axios.create({
            url: "/",
            baseURL: "http://ws.audioscrobbler.com/2.0/",
            params: {
                format: "json",
                api_key: apiKey
            },
            responseType: "json"
        });
    }

    get(method: string, params = {}): AxiosPromise {
        return this.axios({
            params: Object.assign({}, this.axios.defaults.params, {method}, params)
        });
    }
}