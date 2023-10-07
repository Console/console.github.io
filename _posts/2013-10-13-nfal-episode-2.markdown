---
layout: post
title:  "NFAL - Episode Two : Wyze Thin Clients"
date:   2013-10-13 00:00:00 +0000
categories: blog
---
Why do I get excited whenever I am presented with a thin client, with an RDP or CITRIX or VMWare View session to a backend virtualised desktop?

Because you can almost guarantee the thin client is the easiest local lockdown check you’ll ever do.

There are some caveats to this in that thin clients using some custom *nix firmware can be stupidly hard to do anything with locally at least, however if you see any of the embedded OS style thin clients, well chances are you’re already administrator on that device you just didn’t know it.

Let’s take a common terminal I see knocking about, the Wyse terminal. Its principle defence against you is that of the "restricted account" and its "file based write filter" with that filter turned on, everything you do is only temporary.

Due to the FBWF, doing patching and updates on the OS really is a pain in the arse, add in the normal situation that the devices they are rarely controlled by GPO preferring to be controlled by a local policy instead and you’ve got yourself a tasty burger.

So first, what is this restricted account thing I’m talking about? Well on Wyse both the "user" and the "administrator" accounts are local administrators. The only difference is that the User account Sid is listed within a "restricted profile" registry key. Any accounts not in that have full access to the underlying OS.

So first, get yourself a shell. Pop it via any of the means I’ve discussed previously. Even if you resort to dropping it on a USB and getting it in that way alternatively here is yet another “breaking the jail” method that worked pretty well on an XP Embedded thin client.

As the normal user, open up printers and faxes, using the view menu open the folder bar. Now browse the ram drive based file system to either create or find an “unknown file” you need something that windows doesn’t know how to open.

Double click and you’ve got the open with dialog.

Within this, specify a path to an executable you wish for the file to be run in.
Make this path c:\windows\system32\command.com. (If its windows 7+ pop powershell.exe or powershell_ise.exe instead) Hit okay and apply or whatever you need to confirm your change and get out of the dialog.

What happens next is interesting, command.com will spawn, fail to understand the actual file and then drop you to a command prompt.

It won’t have a system path so every command will have to be fully written out but it will work. I suggest doing:

``` cd c:\windows\system32 ```

Before doing anything else, swiftly followed by as remember every account is local admin on this terminal and the only controls are a write filter and a restricted profile registry key:

``` 
net.exe user /add hacker password123
net.exe localgroup administrators hacker /add
```

Now you need to log off, which is not as awkward as you think given there are no menu options for that on the restricted account and chances are ctrl alt del doesn’t let you either.

``` shutdown.exe -l -t0 ```

Enter this command and hold down the shift key.

You don’t want to restart the machine or the FBWF will reset everything and you don’t want it auto logging in as the user account either which the shift key should help with. When the Wyse terminal finally logs off, login as your hacker user.

Voila, you’re now local admin on the box, with a full desktop and no application controls applied as your Sid is no longer the one listed as a restricted profile. Disable the FBWF, now any change you make will be permanent, install that key logger or bind shell and have fun.