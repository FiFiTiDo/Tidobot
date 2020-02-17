# Permission Module

#### Table of Contents
1. [Permissions](#permissions)
    1. [Permission Levels](#permission-levels)
    2. [Set permission level](#set-permission-level)
    3. [Resetting permission level](#reset-permission-level)
2. [Users](#users)
    1. [User Permissions](#user-permissions)
    
    
## Permissions
One of the core parts of Tidobot is its permission system which is based around 
permission strings. These permissions are given to a certain Permission level and 
each level above it. The permission levels are described below.

#### Permission Levels
| Level | Description | Accepted Values (case insensitive) |
| --- | --- | --- |
| Banned | Users banned from using the bot | Banned |
| Normal | Every single user | Normal |
| Premium | A user who is a member of a specific service's premium system like Twitch Turbo or Twitch Prime | Turbo, Prime, Premium |
| Regular | A special user level that can be granted to specific users (see [Regulars]()) | Reg, Regs, Regular, Regulars |
| Subscriber | A user that is a subscriber (ex: Twitch Subscribers) | Sub, Subs, Subscriber, Subscribers |
| VIP | A very important person, created specifically for the Twitch VIP feature | VIP |
| Moderator | A user that has been designated to moderate the chat | Mod, Mods, Moderator, Moderators |
| Broadcaster | The owner of the stream/chat | Streamer, Broadcaster |
| Admin | Users designated by the service as administrators | Admin, Admins |
| Owner | The bot owner: Me, FiFiTiDo | Owner, FiFiTiDo |

The permission command is `!permission` but you can also user `!perm` or `!p`.

#### Set permission level
To change the level required to use a permission you need to use the subcommand `set` within the permission command.

Usage: `!permission set <permission> <level>`
<br>
Required permission: `permission.set` 
<br>
Default level: `Moderator`

Example:

```text
FiFiTiDo: !permission set permission.set broadcaster
Tidobot: Set the permission level for permission.set to Broadcaster
```

Listed in the table above are the accepted values for the `<level>` parameter. Any of the items listed under
the accepted values column are acceptable values for this param. This parameter is also case in-sensitive
so `bAnNeD` behaves the same as `banned`.

The command doesn't check if the permission exists which could be useful for when you create a [custom command]()
as you could create your own permission that you can grant to users and groups.

You are only able to set the permission level for permissions that you have permission for which is checked the
same way it is checked when attempting to perform the action the permission was designed for.

<br>

#### Reset permission level
If you ever want to reset a permission level back to the default level you can use the `reset` subcommand
of the permission command.

Usage: `!permission reset perm:<permission>`
<br>
Required permission: `permission.reset`
<br>
Default level: `Moderator`

Example:
```text
FiFiTiDo: !permission reset perm:permission.reset
Tidobot: Reset the permission permission.reset back to it's default value
```

If the permission is not one used by an module (as in it's a custom permission) it will just delete it from
the database as there is no "default value" to look for.

## Users

#### User permissions
You can grant or deny a user from a certain permission making them able or not able to do the action
associated with the permission

| Usage | Required Permission | Default Level |
| --- | --- | --- |
| `!permission grant user:<user> <permission>` | permission.grant | Moderator |
| `!permission deny user:<user> <permission>` | permission.deny | Moderator |
| `!permission reset user:<user> [permission]` | permission.reset | Moderator |

For the reset subcommand, the permission argument is optional when it is supplied it removes the user
permission that was specified. When the argument is omitted it will delete all of the user's special
permission designations.