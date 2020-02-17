# Groups Module

#### Table of Contents
1. [Creating groups](#creating-a-group)
2. [Adding users to groups](#adding-a-user-to-a-group)
3. [Removing users from groups](#removing-a-user-from-a-group)
4. [Deleting groups](#deleting-a-group)
5. [Group permissions](#group-permissions)

## Groups
You can group users into groups to make it easier to handle permissions by instead granting permissions
to the group rather than each individual person.

There is a separate command used for group management: `!group` or `!g`
<br><br>

#### Creating a group
Groups are specified by their name so you cannot create a group with the same name as an existing group.

Usage: `!group create <group name>`
<br>
Required permission: `permission.group.create`
<br>
Default level: `Moderator`

Example:
```text
FiFiTiDo: !group create friends
Tidobot: Created the group friends
```

#### Adding a user to a group
Usage: `!group add <group name> <user name>`
<br>
Required permission: `permission.group.add`
<br>
Default level: `Moderator`

Example:
```text
FiFiTiDo: !group add friends Tidobot
Tidobot: Added Tidobot to the group friends
```

#### Removing a user from a group
Usage: `!group remove <group name> <user name>`
<br>
Required permission: `permission.group.remove`
<br>
Default level: `Moderator`

Example:
```text
FiFiTiDo: !group remove enemies Tidobot
Tidobot: Removed Tidobot from the group enemies
```

#### Deleting a group
Usage: `!group delete <group name>`
<br>
Required permission: `permission.group.delete`
<br>
Default level: `Moderator`

Example:
```text
FiFiTiDo: !group delete friends
Tidobot: Deleted the group friends
```

### Group Permissions
This functions similarly to how [User Permissions](#user-permissions) work but instead you are granting/
revoking permissions for groups rather than users.

| Usage | Required Permission | Default Level |
| --- | --- | --- |
| `!permission grant group:<group> <permission>` | permission.grant | Moderator |
| `!permission deny group:<group> <permission>` | permission.deny | Moderator |
| `!permission reset group:<group> [permission]` | permission.reset | Moderator |