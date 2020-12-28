export interface WebSocketMessage {
    type: string;
    extra: { [key: string]: any };
}