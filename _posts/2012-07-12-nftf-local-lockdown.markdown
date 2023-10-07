---
layout: post
title:  "NFTF: Local Lockdown - Getting prompts, Fun with macros and Scripting help on airgapped systems"
date:   2012-07-12 00:00:00 +0000
categories: blog
image: /assets/images/2012-07-12-nftf-local-lockdown-4.png
---
## Using VBS to fire up FTP as a local command shell

This is probably a duplicate somewhere but I wanted it noted for my own use anyway – here’s a very handy VBS that does the job nicely for accessing useful commands as a user on a locked down desktop.

In this example I choose to fire up FTP.exe as its well known that local commands can be run within the FTP.exe interface.

```
CreateObject("WScript.Shell").Run "cmd.exe /k ftp"
```
Using the above and the bang character, this will allow you to run commands on the host.

For example: 

```
!cd 
!c:\windows\system32\calc.exe
```

*Odd Behaviour: On XP64 !cd did not appear to persist the path post it’s single command, however on windows 7 and 32bit XP it did so. Pretty noddy stuff but useful to remember.*

## No Macros Allowed?

Myself and a colleague were presented with a “Defect Fixed, macros are completely disabled on the host” statement from a long term pentest engagement, I was new to the project so decided to give it a good kicking.

At first glance, no access to the editor was possible and only trusted signed macros were capable of running. We could be forgiven at this point for even mistakenly “passing” the defect if we hadn’t been so determined.

After a bit of poking and managing to pop open the editor across the office suite, I was convinced I could get it to play ball all the way. My colleague thankfully indulged my inane ramblings about digitally signing and feeling like it’s so close to popping.

3 to 4 hours later and a fair few dead ends, we got macro editing and execution as a trusted signed macro across all the office apps available on the host (aside from outlook, that could probably fall too given more poking but we had proved our point).

What follows is a quick run through of what we did:

### First problem, creating the macro - we need an editor

![](/assets/images/2012-07-12-nftf-local-lockdown-1.png)

If the macro menu is disabled and the buttons on the developer toolbar are greyed out (or even removed from the interface) try the following.

In Word: Right click the toolbar, select “customise quick access toolbar”, select “all commands” and add the buttons labelled “view code” and “design mode”. The view code button will be greyed out until the design mode button is pressed so press the design mode button, hit view code and voila the VB Editor pops open!

In Excel: Right click the sheet tab and select view code – it is also accessible through the same way it was in Word.

In Powerpoint: There should already be a view code option on the ribbon. Failing that activate it as you would in Word above.

### Just sign here, here and here

Our second issue, accessing the security window and then the macro security window using the above toolbar button method (anything with the word macro in was disabled from a UI point of view in the ribbon menus, so you had to load the plain “security” window in order to get the macro security screen to pop). We could see that only signed macros were allowed to run. Nightmare, what can we do now?

Well, coming at this from a lockdown breakout just don’t save the document. Group Policy only applies in terms of macro execution to a saved word document. Writing a macro and executing it instantly is usually not blocked.

However this is a long term pentest engagement and sometimes the ability to save documents and have say your VBA port scanner or VBA based file downloading widget saved for later use on other engagements is a useful thing. We used to just copy paste from text files but that’s frustrating and doesn’t allow you to really go to down with forms and things to prettify your attack “docs” 🙂

So we need to sign our macros. While poking about the office program files folders I noted the following executable: selfcert.exe

![](/assets/images/2012-07-12-nftf-local-lockdown-2.png)

Run it, and it’ll produce a lovely new certificate for you to sign your macros with, now granted it’s self signed but word doesn’t really care too much about that.

![](/assets/images/2012-07-12-nftf-local-lockdown-3.png)

Tools -> Digital Signatures -> Choose Certificate -> Select your cert. Now it’s signed. You may need to reopen the document to get it to run.

This is all fantastic until…

### But wait, mommy told me not to run macros from strangers...

Okay so we’ve got our macro signed, but due to the security settings they’ve hobbled it further and disabled any prompting for self-signed macros, allowing only trusted macros to run. So we need to find a way to explicitly trust our self-signed macro.

![](/assets/images/2012-07-12-nftf-local-lockdown-4.png)

Open the VB Editor as before, Then… Tools -> Digital Signatures -> Choose -> View Certificate -> Details -> Copy To File

Navigate to the saved .cer file (just accept the defaults in the export wizard). Right click the file and select “install certificate”, select the location to install the certificate as “Trusted Publishers”

![](/assets/images/2012-07-12-nftf-local-lockdown-5.png)

With the certificate installed successfully you just added your certificate to the trusted signatures that microsoft office will blindly accept without needing you to click on an “accept the risk” style dialog box.

Before: In our case this dialog was hidden and not shown to users, meaning we had no option of accepting anyway in this manner, so self-signed macros would never run.

![](/assets/images/2012-07-12-nftf-local-lockdown-6.png)

After: No prompt, macro runs and certificate is trusted

![](/assets/images/2012-07-12-nftf-local-lockdown-7.png)

![](/assets/images/2012-07-12-nftf-local-lockdown-8.png)

## So what can I do with these things anyway?

So the little example given at the top of this blog post will fail without the use of cscript/wscript.exe. Which is commonly locked down.

How about doing it in VBA?

```
Sub run_me
    retVal = Shell("c:\windows\system32\cmd.exe /k ftp",1)
End Sub
```
A quick F5 and you’re back running the commands you love.

retVal in the above will contain the PID of the process you just launched so the following will kill the process too.

```
Sub run_me_kill_me
    Dim retVal as String
    retVal = Shell("c:\windows\system32\calc.exe",1)
    killCmd = "c:\windows\system32\cmd.exe /k taskkill /PID " + retVal
    retVal2 = Shell(killCmd,1)
End Sub
```

The ,1 part of the shell call, that’s describing what you want VB to do with the window. If you are doing calls to a script or a command/console based program, you can use vbHide instead and no window will appear on the screen.

Be careful doing this however on systems with cmd.exe disabled by group policy as you’ll find that they never show up and so persist within task manager waiting on an invisible but very real “This command has been disabled by your administrator, press any key to continue” prompt.

## Help! No Web, No Hope? No Way!

So a final tidbit on the end of this blog post. Ever wanted to write some VBS or VBA but not sure of the exact syntax or even the functions you may have access to, you’re in a location with zero access to the internet and someone has helpfully disabled the “help and support” service, denying you any F1 action you may be looking for?

This is a little trick I picked up from previous work. Providing the host you’re playing with has Microsoft Office installed you will have access to all the scripting reference material you could want.

First lets make a new shortcut on the desktop or wherever is convenient for you.

Set the path to

```
"C:\program files (x86)\Microsoft office\office12\clview.exe" "MSE" "Microsoft Scripting Engine"
```

Double click your newly created shortcut and a blank help screen should appear.

Use the search bar to searfch for something “VBS” related for example and then click the “Microsoft scripting engine” (grey text top left) and then “Microsoft Scripting Engine Help”. You’ll have access to the help for VBScript and JScript language references along with information on all the juicy runtime objects you can access using them.

Need VBA help? Once again CLVIEW to the rescue…

Create a shortcut only this time it’s contents will be:

```
"C:\program files (x86)\Microsoft office\office12\clview.exe" "WINWORD" "Microsoft Office Word"
```

This looks like you’re calling for word help but in reality it is the word developer reference manual and in turn will give you the full VBA language reference too.

There are options too for Excel and Powerpoint references in case the word based help is not sufficient for your needs.

**Happy local lockdown testing!**