---
layout: post
title:  "Bypassing Group Policy Proxy Settings using the Windows Registry"
date:   2013-09-12 00:00:00 +0000
categories: blog
image: /assets/images/2013-09-12-bypass-proxy-settings-1.png
---

## Foreword: Irresponsible Disclosure?

I have tried to report this to Microsoft Security Response Center ([@msftsecurity](https://www.twitter.com/msftsecurity)) and received this response:

> Hello,
>
> Thank you for contacting the Microsoft Security Response Center (MSRC). What you’re reporting appears to be a documentation issue rather than a security vulnerability.
> To best resolve this issue, please contact Microsoft Product Support Services at <http://support.microsoft.com/common/international.aspx> or make a report at <http://support.microsoft.com/gp/contactbug/>.
> If you still believe this is a security vulnerability, please let us know.

Following either of the above links points to their support channels, which require a valid support agreement (which I don’t have) or require it to be one of the listed “accepted bug report” programs available through connect. Which I couldn’t find a suitable program to class this under, coming up against a brick wall and given the MSRC response suggesting that this is not a security bug I’ve decided to do a blog post disclosure. This is what follows.

## The What?
This issue stems from the ability as an non-administrator user to circumvent group policy based settings that seem to imply a disablement or prevention for a feature, in particular this was first noticed when examining the proxy settings of a host, originally editable from within the Internet Explorer connections tab.

The policies in question have the following wording:

* “Disable the Connections Page”
    * The above policy infers within its description that no other policies are required to ensure the protection of the connection settings. From experimentation, this appears to be an incorrect assumption.
* “Prevent Changing Proxy Settings”
    * This policy appears to only “grey” the GUI, it does not prevent actual changing of the proxy settings, and fails to set ACLs or harden the settings sufficiently against attack
* “Disable Changing Automatic Configuration Settings”
    * This policy appears to suggest that it blocks the modification of the auto configuration URL and prevents a user from modifying the “Detect Settings Automatically” checkbox. However as per the previous proxy settings policy, it merely affects the appearance of the GUI and does not protect the settings from modification by a non-administrative user.

## The How?

### Setting Up…
Create a local user on your machine, don’t add him to any special groups. In fact you just want a non-administrator, someone you’d not expect to be able to bypass a group policy.
Using ‘gpedit.msc’ as an administrator, navigate to the following root and enable “Disable Changing Automatic Configuration Settings”.

``` Root: User Configuration/Administrative Templates/Windows Components/Internet Settings/ ```

With that setting enabled and a user created. Log out of your administrator account, log back in as the user under test.
Open Internet Explorer and view internet settings, navigate to the connections tab and view the Lan Settings. It should appear as per the screenshot below.
![](/assets/images/2013-09-12-bypass-proxy-settings-1.png)

*Checkbox is populated, Policy is enforced*
You will be unable to change the “Automatically Detect Settings” Tick box.

### …Exploitation
Now fire up regedit (this can also be done via VBA, VBS, BAT, Powershell, WMI, whatever you need to access registry keys).
Alter the registry key/value of:
``` HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings\Connections\DefaultConnectionSettings ```

![](/assets/images/2013-09-12-bypass-proxy-settings-2.png)

*Changing the registry key*

Edit it so that the 09 becomes 01, or rather subtract 8h from the 9th byte of this value.
Now reload up Internet Explorer and view the Lan Settings once again.

![](/assets/images/2013-09-12-bypass-proxy-settings-3.png)

*Checkbox no longer populated*

Voila, Policy is still applied but settings have just been edited by yourself.

## Summary
Okay so the issue in the above example is not a huge one, unless there is a second route out of the network (or one you manufacture one as an authenticated attacker) its of limited use.

However it highlights what could be a possible security issue with other Group Policy Objects. A GPO in my opinion that states it prevents modification or changing of an item should do exactly that, however these policies only appear to disable the GUI interface, the actual sensitive data that should be protected is freely accessible and worse still, editable by a normal non-administrator user.

Granted, a sysadmin is going to apply more than just GPO to his machine and registry keys and registry editing facilities should indeed be acl’d away so only administrative accounts may alter the settings but the documentation on MSDN and within the GPEDIT tool itself suggests that these policies should be sufficient to prevent user modification of the named settings which clearly is not the case.

I intend having a poke about myself to see where else Microsoft deem it sufficient to disable the GUI but still allow write access to the registry keys that actually hold the sensitive data, if any of you (1?) readers of the blog find any, be sure to post it in the comments below.

## Update:
Quick two second google turned up this beauty: <http://msdn.microsoft.com/en-us/library/ms815238.aspx> which lists all the GP objects and the registry keys they affect, looks like I have an exciting time reading through accessenum output ahead of me. HKCU stuff is usually a safe bet (aside from some keys contained in “policies”) for being editable.

## Update #2:
So after a conversation with a colleague of mine I’ve realised that perhaps the severity of this issue may be lost in the abstraction of the above from a client system where I initially encountered it. The above issue will allow you to take over the control of the computers proxy settings at will, what follows is a “what if” scenario explaining the issue in detail.

Bob is in his local museum. They provide a kiosk based system there for viewing a few museum webpages that describe various exhibits, it also allows users to access facebook to “like” and “share” and a few email services for free.

Bob is a clever chap however and despite having no address bar and no normal route out of the Kiosk jail, he sees a “terms and conditions” link which appears to link to c:\kioskfiles\terms.docx

docx?!? So word viewer must be installed? no way would the museum have built the kiosk based upon a corporate build and then locked it down?

Bob clicks the link, Word 2010 fires up and displays the terms and conditions for using the kiosk. Oh, now life gets interesting, Bob is a follower of @scriptmonkey, and remembers his post on macros and code execution so he breaks out the macro editor and runs a few commands, command prompt is no go, due to GPO but oddly regedit is accessible, granted he’s only the lowly kiosk user at the moment so what can he do?

Bob decides he wants to harvest credentials.

Using regedit bob checks the contents of:

``` HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings\ProxyEnable ```

and finds that it is set to zero which means no proxy is involved, okay but what about the contents of the autoconfiguration settings.

He heads over to:

``` HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings\Connections\DefaultConnectionSettings ```

Checks the value and finds the 05 set right where the 09 would be if it was enabled for auto detection. (05 means use autoconfiguration script, but not auto detect)

Now he confirms what the URL is hard set to at:

``` HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings\AutoConfigURL ```

Bob edits the AutoConfigURL to point at C:\doesntexist.txt and tries browsing to a website not explicitly allowed, one that would result in a blank white page normally. Pow! the website pops up.

It appears the kiosk is on the wider network just forced to connect via a proxy first to enforce the site rules.

Perfect, now Bob sets the DefaultConnectionSettings key such that the 05 from before is now set to 01. Meaning that no auto configuration script or automatic detection takes place. He sets the EnableProxy key to 1, to enforce a proxy setting. He then adds his own internet based proxy to the registry key ProxyServer.

Confirming he still has internet access, he closes his open windows and walks away.

Few minutes later Jane comes along. Clicks the facebook “share this exhibit” button, logs in…

### What just happened? (TL:DR)
The ability to modify the proxy settings for current user and bypass group policy protections as a normal non-administrator user is a particular risk to shared user based systems, Demo machines in PC World, kiosks, “sheepdip” machines, etc…

A malicious user is able to compromise the system, redirect traffic (in the case of internet explorer its often the case that other programs follow IE’s settings) to their own proxy server, harvesting credentials, sensitive data/information, etc…

In the example above I used regedit but this is possible using VBA/VBS/Batch/WMIC as well, meaning there is more than one way to skin this particular cat.

The GPO based protections that prevent access via the GUI should also prevent modification of these settings via the registry. In addition the modification of these keys do not appear to be documented anywhere within the above linked table, in fact those listed registry keys only list “policy” based keys, which just confirm whether or not the policy is set in this case instead of providing the enforcement of the particular rule.

So, whats your opinion? Were MSRC right to classify this “not a security vulnerability”?

## Update #3:
It appears a chap has seen this blog post and did some more work on understanding the PAC file contents (array.dll?script if you’re running a TMG) and has now developed a sweet little post exploitation metasploit module to perform DNS spoofing against a compromised host.

<iframe width="560" height="315" src="https://www.youtube.com/embed/YGjIlbBVDqE?si=LuTFyVYaqaZNdWOg" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

<https://github.com/rapid7/metasploit-framework/blob/master/modules/post/windows/manage/ie_proxypac.rb>

Epic stuff.