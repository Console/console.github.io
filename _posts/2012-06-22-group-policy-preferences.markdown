---
layout: post
title:  "Cross-Post: Exploiting Windows 2008 Group Policy Preferences - Expanded"
date:   2012-06-22 00:00:00 +0000
categories: blog
image: /assets/images/2012-06-22-GPP-Expanded-1.png
---
Cross posting some work of a friend of mine that I was helping with, I say “helping” in the lightest form of the word (I had a domain controller ready to test, he didn’t).

Meatballs (over at: http://rewtdance.blogspot.com) has been doing some work attempting to put together a metasploit module to decrypt passwords found within the sysvol folder on win2k8 domains.

However rather than just settle for the disclosed “local users and groups are vulnerable…” he dug a little deeper after realising that datasources and other such things that have user credentials associated with them were also stored in the same manner.

What follows is a snippet from his blog, visit his site for the full article.

> This follows on from the disclosure http://esec-pentest.sogeti.com/exploiting-windows-2008-group-policy-preferences which discussed how Group Policy Preferences can be used to create Local Users on machines and the resulting passwords easily decrypted. (Expect a metasploit post module to gather these details soon…) 
Browsing the MSDN documentation I noticed that there were many other preferences that could be set that, and delving further they also allow a password to be stored. For example Services.xml specifies services to run on end machines, and can specify a specific user and password for that service to run under.

Whilst these preferences may not be used as commonly as local users preferences (to set local administrator passwords), they may lead to current valid domain credentials rather than just local users accounts – for example specifying a domain user to connect to a network share in Drives.xml… (read more)

The finished result when run against my little 2k8 test domain.

![](/assets/images/2012-06-22-GPP-Expanded-1.png)