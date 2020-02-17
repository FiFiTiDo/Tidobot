# Custom Command Module

#### Table of Contents
1. [Creating a command]()
    1. [In-line expressions](#adding-in-line-expressions)
2. [Deleting a command]()
3. [Editing a command]()
    3. [Condition](#editing-the-condition)
    2. [Trigger](#editing-the-trigger)
    1. [Response](#editing-the-response)
    4. [Price](#editing-the-price)
    5. [Cooldown](#editing-the-cooldown)
    
<br><br>
The custom command module's base command is `!command` but also has aliases for `!cmd` and `!c`.

## Creating a command
Creating a command is very simple:

Usage: `!command add <trigger> <response>`
<br>
Required permission: `command.add`
<br>
Default level: `Moderator`

Example:
```text
FiFiTiDo: !command add !hello Hello, world!
Tidobot: Added command #1
FiFiTiDo: !hello
Tidobot: Hello, world!
```

*Note: If the response starts with a `/` or a `.` it will automatically prepend `>> ` to the beginning
of the response as forcing the bot to execute commands is not allowed.*

Notice how I specified an `!` in the trigger argument, this is necessary as the bot does not automatically
assume you want to use an `!` as the prefix for the command, so if you were to omit it, the bot would behave 
differently.

Example:
```text
FiFiTiDo: !command add goodbye Goodbye, world!
Tidobot: Added command #2
FiFiTiDo: !goodbye
...
FiFiTiDo: goodbye
Tidobot: Goodbye, world!
```

<br>

##### Adding in-line expressions
You can add expressions in your responses that will be evaluated when the command is executed, read
more about expressions [here](./ExpressionModule.md).

To add an expression, you just need to surround the expression with `${` on the left and `}` on the right.

Example:
```text
FiFiTiDo: !command add !roll You rolled a: ${random(1, 6)}
Tidobot: Added command #3
FiFiTiDo: !roll
Tidobot: You rolled a: 5
FiFiTiDo: !roll
Tidobot: You rolled a: 2
```

## Deleting a command
You might have noticed in the examples above that Tidobot responds with `Added command #<number>`, this
number it responds with is the ID number for that specific command as unlike most bots, commands can use
the same trigger. Because of this, the ID number is very important when  you want to edit or delete a
command as the bot needs to know which command you want to delete. You'll be able to check the bot's portal
to find out a command's id in the future.

Usage: `!command delete <command id>`
<br>
Required permission: `command.delete`
<br>
Default level: `Moderator`

Example:
```text
FiFiTiDo: !command remove 3
Tidobot: Deleted command #3
FiFiTiDo: !roll
```

## Editing a command
Similar to deleting a command, it is necessary to know the ID for the command you wish to edit. The general
form for editing different aspects of a command is as follows:

Usage: `!command edit <aspect> <command id> <new value>`
<br>
Required permission: `command.edit`
<br>
Default level: `Moderator`

You can edit:
* [The condition](#editing-the-condition) (What condition needs to be met for this specific command to run)
* [The trigger](#editing-the-trigger) (What triggers the command)
* [The response](#editing-the-response) (How the bot responds to the command)
* [The price](#editing-the-price) (How many points it costs to use the command, See [here](./CurrencyModule.md) to learn about points)
* [The cooldown](#editing-the-cooldown) (How many seconds before the command can be run again)

### Editing the condition
The condition is the entire reason why command triggers don't have to be unique, because you can have
multiple commands with the same trigger but it could be that only one triggers at a time as their
conditions are never going to be true at the same time. This makes it easy to make powerful commands
that prevent you from needing to edit your commands often. 

A good example of this would be an `!ip` command. You could detect a specific phrase in the title that 
determines what server you are playing on and the correct command will be displayed for that server.

```text
FiFiTiDo: !command add !ip I'm not sure if fifi is playing on a server.
Tidobot: Added command #4
FiFiTiDo: !command add !ip Fifi is currently playing singleplayer... no you can't join
Tidobot: Added command #5
FiFiTiDo: !command add !ip Fifi is currently playing on the blah server, ip address: blah.play
Tidobot: Added command #6
FiFiTiDo: !command edit condition 4 @@default
Tidobot: Updated the condition for command #4
FiFiTiDo: !command edit condition 5 "singleplayer" in channel.getTitle()
Tidobot: Updated the condition for command #5
FiFiTiDo: !command edit condition 6 "Blah Server" in channel.getTitle()
Tidobot: Updated the condition for command #6
```

If the title is `Playing a singleplayer adventure map`:

```text
random_user: !ip
Tidobot: Fifi is currently playing singleplayer... no you can't join
```

If the title is `Playing on the Blah Server w/ my friends`:
```text
random_user2: !ip
Tidobot: Fifi is currently playing on the blah server, ip address: blah.play
```

Otherwise:
```text
random_user3: !ip
Tidobot: I'm not sure if fifi is playing on a server.
```

This all might seem a little bit complicated, but just take a look at the [ExpressionModule](./ExpressionModule.md)
documentation to learn more about expressions, how they work, and how to write your own. The one thing that's
different with this command is the `@@default` condition that was used for command #4, this allows the
command to be run if no other commands are run.

### Editing the trigger
The trigger is what causes the command to be run, it's what is at the beginning of the message.
Triggers cannot include any spaces but can include any other character (except it cannot start
with a `/` or a `.` as that can conflict with built-in commands of services like Twitch)

Example:
```text
FiFiTiDo: !command edit trigger 2 !goodbye
Tidobot: Updated the trigger for command #2 to !goodbye
FiFiTiDo: goodbye
...
FiFiTiDo: !goodbye
Tidobot: Goodbye, world!
```

### Editing the response
The response is what the bot responds with when the command is executed.

Example:
```text
FiFiTiDo: !command add !test Justy testing!
Tidobot: Added command #7
FiFiTiDo: Oops!
FiFiTiDo: !command edit response 7 Just testing!
Tidobot: Updated the response the command #7
```

### Editing the price
You can charge users a price of some points (through the bot's currency system which you can read more
about [here](./CurrencyModule.md)) to run the command and won't run unless they have enough points.

Example:
```text
FiFiTiDo: !command edit price 7 10.0
Tidobot: Updated the price for command #7 to 10.0
random_user: !balance
Tidobot: @random_user, Your balance is: 9 points
random_user: !test
```

Now if the user has enough points:
```text
random_user: !balance
Tidobot: @random_user, Your balance is: 10 points
random_user: !test
Tidobot: Just testing!
```

You can allow people to use all commands for free using the `command.free` permission, by default this
permission is granted to all users who are at least `Moderators`.

### Editing the cooldown
A cooldown makes it so that the command cannot be executed less than the specified seconds after the
last time it was executed, this allows you to prevent commands from being spammed too much.

Example:
```text
FiFiTiDo: !command edit cooldown 1 5
Tidobot: Updated the cooldown for command #1 to 5 seconds
random_user3: !hello
Tidobot: Hello, world!
random_user4: !hello
...
```
And 5 seconds later:
```text
random_user4: !hello
Tidobot: Hello, world!
```

You can allow people to be able to ignore all cooldowns for custom commands using the `command.ignore-cooldown`
permission which by default it is granted to all users who are at least `Moderators`.