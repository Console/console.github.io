---
layout: post
title:  "My First CTF  - PlaidCTF 2012"
date:   2012-05-04 00:00:00 +0000
categories: blog
---
So it was the same as any other usual Friday, 10pm I’m shattered after a particularly taxing week at work so laying in bed reading a book (the rock and roll lifestyle of a social pariah) when I get a text from a colleague.

> Dude, what are you doing this weekend? I’m just about to take part in a CTF, get online #corelan on freenode

A CTF? To those who don’t possess the knowledge of the internet, a CTF is a “capture the flag” competition. In the world of computer security it means a race against other teams to break a number of challenges for points and what do points mean?…. prizes!

1st, 2nd and 3rd placing teams would get some nice money. I’ll end the anticipation and say that our team ([corelan](http://www.corelan.be)) came somewhere around 140th place out of about 800 teams.

Me and a colleague got involved from Friday night, straight away i’m in over my head. Wait what’s this? an RPG?? wtf? How do I see the? We’re using what to track progress? Who is doing what? How? Eh? Help!!?

About 3 hours later when I realise how I access challenges and give up trying to fix the constant 404 errors on the python client that pCTF had provided for access I finally try getting my teeth into something.

Right, where to start. I select a challenge and instantly realise it’s a binary exploitation task. I’ve only just started reading about the joyous things such as ollydbg and ida pro so I’ve no idea what i’m doing or looking for I quickly move onto something else.

I try out the addition is hard challenge and decide that the clue PHP? in the second argument must mean that it’s something PHP does that’s wrong.

I start googling for PHP Hex and looking through the php.net manual for functions that deal with hexadecimal numbers and find hex2dec as a function… wrong key. I give up after trying a few more things and getting nowhere but i’m adamant that it’s something to do with the way that PHP does hex based stuff surely?

I move onto… Editors

Decipher a keylogger script output and determine:

1. How many shells were spawned
2. How many edits were made to the /etc/sudoers file
3. What the final state of the /etc/sudoers file is
4. What the final state of the computer is

So I grab the text file and instantly realise that i’m missing something, viewing it in notepad all of the control chars are either weird characters or completely ignored so back into ViM it goes.

Ahh more like it.. now I can see all the ctrlA and CtrlB’s made for control of screen and tmux, gets me closer to understanding just how many shells are opened 🙂

I spend the next few hours deciphering the script and break it down into steps.

Just by following the script through in my head and using a piece of A4 paper I draw out what happens and come out with an answer. I give it a go – Nope wrong key.

This continues for many hours, only now I’m having less confidence in my paper based decode I decide to load up a fresh VM (a nice fresh install of debian) and install the necessary editors (again fresh installs so no custom .rc files screwing up things) and walk through the script.

1st Error: ksu -l is not a valid command without some numbers after it. It just doesn’t work, it bombs out and errors.

I’m on IRC so I fire off a question to the creator FrozenCemetary and ask if that’s intentional or just a typo? I get the response that “not all KSU implementations are the same” and assuming that’s a clue to say that his didn’t fail in that manner. I continue with it, assuming it works.

Try the key – No dice.

Okay so carrying on. There is a section involving teco (an obscure ancient editor that emacs was based on) and I am encountering errors trying to run one line of the code, but wikipedia says it’s an output only line anyway, not a write line so i’m not that concerned. Still I double check and realise I’m typing o instead of 0 (zero) ***facepalm*** I correct the problem and the code runs without error. It’s only a read command, no changes.

there’s a section that starts up VIM using visudo and edits the line with a “/usr/bin/vim ,” yeah, including the space and a comma. It’s an invalid line, visudo correctly barfs out but the next key press kills the shell that visudo is in so the write never gets corrected and never gets written. I double check if any editors should be barfing out when writing and frozen comes out with the surprising answer of “None of the editors should barf when saving changes”.

This means I’ve been assuming VIM fails to update the editors line in /etc/sudoers when in fact Frozen has just said it’s a typo and is meant to succeed. I change my answer and try the key.

No good.

Onto the next bit, we’ve got some crazy emacs char moving nonsense involving 46 control characters. It works a bit odd and I end up deleting characters from the line below the editors line, not the editors line. Confused I contact frozen again. “I’m trying this and I think the control characters are moving the cursor too far, when you drew up the challenge, were your arguments seperated with spaces or tabs?”

Frozen: “It should be pretty obvious what’s intended, its a vanilla debian sudoers file and i’m pretty sure it was spaces not tabs”

Ah, so that explains a lot I grab another vanilla debian image, build a VM and have another go… nope definitely tabs once again, but lets just entertain Frozen’s suggestion and convert it to spaces.

Right so typically 4 tabs to a space, lets go with that.

Try it again and now it sort of works except it deletes the 2nd / when I run it.

I try the key once more, nope it fails I try again manually re-adding in the /

Again no dice.

Confused by this now and not having anything else confusing left to look at I download centos 6, centos 5, debian, ubuntu server, backtrack 5r1 and kick off VM’s of all of them, run through it and the same result every time.

A fresh install of emacs treats tabs as tabs, not spaces and all of them end with the same outcome.

Try the key again (maybe I have the input wrong), nope no go.

It’s 5am now so I call it quits on the saturday morning and get some kip.

Saturday noon I’m back up and at it again. Meatballs (my colleague) is online too and looking back at the addition is hard challenge. He gets lucky with a google search “php hex addition” and finds the bugged hex addition function within a particular version of php, does the addition and pow! gets the key.

Meanwhile I get back onto the editors problem and try a few more things and get nowhere. So now I start looking at the stuff I was sure about.

/sbin/poweroff, if you run it in run level 6 without any arguments it’ll reboot the machine, meaning the final state of it will be “on”. However in run level 3 without any arguments it will shutdown the machine, meaning the final state will be off.

Assuming that it could be either; I refresh the installs of all the above and fire up a bash process watcher ```watch ‘ps -ef | grep bash | grep -v grep | wc -l’``` in each of them, and try the script in all.

I come out with 2 answers, 1 with the state on and 1 with the state off. I submit both types of keys – no good.

Frustrated and annoyed at the challenge I give up and move onto a web based challenge that involves a homemade pastebin type app.

At this time I’m chatting in the corelan channel we’re using for the CTF and Chad2k comes online, he appears to be a guru on the web app side, discovers the admin cookie and realises that there is some remote file inclusion up for grabs so starts trying to get simple php echo scripts to work but stalls a bit. In the meantime holding onto his coattails I get my php script doing an ls and print_r works and causes some output.

Doesn’t matter though because by this time Chad is performing SQL injection and extracts all the pastes… at this time we could very well have gotten owned ourselves as it was obvious everyone else had put stuff in the database before us, meaning we were bombarded with XSS everywhere (thank god I was doing this in a VM).

Theres nothing interesting in the pastes in the DB despite the clue suggesting it so the next stage is to get a shell working on the site. Chad once again gets it up and running, an ls of the directory reveals a key.html and inside of it (contained within HTML comments) is the key we need to score.

Blam Corelan reaches 140 points. Only a few hours to go and I decide to have a look at an “easy” binary challenge called “Format”.

I whack it into ida pro and find a password stored in plaintext in .rodata and that gets me past stage one, however the rest just falls on it’s arse, I try stepping around some comparisons to get it past the stage im stuck on but again get nowhere.

With 20 minutes to go I’ve given up really and just start looking through the challenges to see if there is anything I could have a go at and have a chance of doing it. I find 3D, which appears to be a 3D image containing a key that is masked by an object.

Knowing that 3D images are generated normally by a left and right image, I’m guessing that there must be one image that has a clear shot of the obscured key.

Only problem is I don’t know how to see it, so I fire it up in HxD to see the code, maybe it’ll give me a clue.

I see lots of repeated EXIF header declarations and come to the conclusion it’s not just 2 JPG images but a whole stack of images. Again I’ve no idea what the end of a JPG looks like in byte form so I couldn’t use HxD to split out the images.

I vaguely remember seeing Int0x80 demonstrating something called ‘scalpel’ on Hak5 for recovering data from hard drives and I was wondering if I could use it to extract the JPGs for me (a sort of dumb and blind “find me images duh”).

I give it a try but without being sure it was just JPGs I enable all the images stuff within the .cfg.

It finds 15 jpgs and 7 Tiff files. All corrupt, none of the images load.

I try again with just the jpg filter and it finds 15 jpgs, again all corrupt.

Thinking maybe its a common 3D image format I start downloading medical image viewers that are designed to view slices of 3D MRI’s and Xrays.

No good, they all bomb out. I’ve not got any time left and the CTF ends without me contributing in a points manner to the team :sad:

I’m gutted but have learned a hell of a lot over the weekend. Exhausted I call it quits for the night and head to get my beauty sleep.

## Post Event

I learned that on the editors question, I was so close to the answer it was ridiculous. I failed not because I was doing something wrong, but because the challenge was insufficiently deterministic. It was incredibly difficult to predict the conditions in which the challenge was created and as such only 20 teams passed that particular challenge, I think i’m one person who tried the most on it as well (spent pretty much all my time on it including installing the various OSes).

The 3D image… again pure dumb unluckyness meant I chose the wrong tool for the job. I was going along the right lines it was indeed just nested JPG images. If I had used foremost -t jpg filename, it would have extracted 21 jpg’s and I’d have been able to view the key.

Alternatively just loading it up in a modern copy of VLC media player would let you view it too.

Still despite the close failures, I learned so much especially at the hands of the guys in the corelan team and it was incredibly enjoyable. Going to try and keep in contact with the #corelan folk and get involved next time there is one.

Fingers crossed I get to practice my binary exploitation before the next one. Defcon 20 prequals here we come :laughing:

Apologies for not including the code and screenshots I wanted to include in the above post. Just a case of writing this and not having access to them on this laptop.