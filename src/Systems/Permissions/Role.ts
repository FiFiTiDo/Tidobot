export enum Role {
    BANNED, NORMAL, PREMIUM, REGULAR, SUBSCRIBER, VIP, MODERATOR, BROADCASTER, ADMIN, OWNER
}

export function parseRole(text: string): Role {
    switch (text.toLowerCase()) {
        case "banned":
            return Role.BANNED;
        case "normal":
            return Role.NORMAL;
        case "prime":
        case "turbo":
        case "premium":
            return Role.PREMIUM;
        case "reg":
        case "regs":
        case "regular":
        case "regulars":
            return Role.REGULAR;
        case "sub":
        case "subs":
        case "subscriber":
        case "subscribers":
            return Role.SUBSCRIBER;
        case "vip":
            return Role.VIP;
        case "mod":
        case "mods":
        case "moderator":
        case "moderators":
            return Role.MODERATOR;
        case "streamer":
        case "broadcaster":
            return Role.BROADCASTER;
        case "admin":
        case "admins":
            return Role.ADMIN;
        case "owner":
        case "fifitido":
            return Role.OWNER;
        default:
            return null;
    }
}

export function getMaxRole(levels: Role[]): Role {
    if (levels.indexOf(Role.BANNED) !== -1) return Role.BANNED;

    let highest = levels[0];
    for (const level of levels)
        if (level > highest) highest = level;
    return highest;
}