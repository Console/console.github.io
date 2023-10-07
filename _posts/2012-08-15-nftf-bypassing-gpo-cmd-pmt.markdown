---
layout: post
title:  "NFTF: Bypassing Group Policy Denied Command Prompt"
date:   2012-08-15 00:00:00 +0000
categories: blog
image: /assets/images/2012-08-15-nftf-bypassing-gpo-cmd-pmt-1.png
---
This is an old trick but I ended up doing it the other day just for kicks, it will only work on 32bit systems at the moment (edit.exe is a 16bit editor and won’t run on a 64bit OS).

Just to clarify – I had no internet access or access to any toolsets, so had to go with whatever I could find on the box hence the use of edit.exe and not winhex/hxd/hexeditorofyourchoice.

I think I vaguely recall a way to use debug.exe to edit binary files but it involved raw assembler and was more complicated than I could remember off of the top of my head with zero internet access at the time so this will do for now.

Right, so as before we have access to a basic command prompt using the VBS/VBA “Call FTP and ! prefix your commands” method.

But I want a full prompt that works without needing such a workaround.

Copy C:\windows\system32\cmd.exe somewhere (unless you want to possibly break cmd.exe on your test system).

Using the VBS/VBA FTP method, call “Edit”

*Don’t try this with notepad it will change all of the nulls to x20 (space) and destroy the file such that you can no longer run it as an executable*

File -> Tick the “Open Binary” box (This is important), Navigate to C:\windows\system32\cmd.exe and open the file.

![](/assets/images/2012-08-15-nftf-bypassing-gpo-cmd-pmt-1.png)

Scroll down (I’ve tried searching and as there is no way of typing a null char, it won’t work) and you’re looking for the first references to “SoftwarePolicies…” Its the registry key that it is looking at to determine if it should allow you to run or not.

![](/assets/images/2012-08-15-nftf-bypassing-gpo-cmd-pmt-2.png)

Change P O L I C I E S to B O L I C I E S (well whatever you want, keep the length the same though)

Save the file – Run the file – Voila! command prompt with no need to have to go through FTP.exe over and over.