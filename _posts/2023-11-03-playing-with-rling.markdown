---
layout: post
title:  "Playing with RLI-NG"
date:   2023-11-03 19:35:00 +0000
categories: blog
image: /assets/images/2023-11-03-playing-with-rling-1.png
---
A while ago I gave a bit of a haphazard [presentation](https://www.youtube.com/watch?v=-mh3-Z6bScc) on the art of password cracking at Steelcon in 2022. Having not needed to crack passwords in anger recently; I had completely forgotten about the quirks of understanding some of the more esoteric tools when it comes to managing your wordlists.

Well it raised it's head again recently in a discord server i'm in and whilst I knew the tool for the job that was being asked, I could not for the life of me understand the outputs I got when trying to come up with the right command for the person to run, so to mitigate this happening again in future I present to you: *How the F... Do I use RLI-NG?!*

### The Premise
> You have become aware of a new wordlist doing the rounds, or have painstakingly curated one of your own, but you're concerned about duplication of effort, as surely every wordlist has the word "password" in it.
>
>You don't want to waste GPU cycles burning time mutating that for the 27 dictionaries I'm running on this job. So you want to only add new words to your collection of wordlists.

To do this, you need RLI-NG (or RLI 1 or 2 from hashcat utils, but RLI-NG is better). RLI-NG will find and remove any duplicates out of lists and output a list of clean words not appearing elsewhere within your set of dictionaries with ease.

To use it:

```powershell
rling.exe new-dict.txt new-words.txt weakpass.txt rockyou.txt breachcompilation.txt
```

* new-dict.txt - being the dictionary you wish to add to your collection.
* new-Words.txt - being the output of words you do not have elsewhere, but contained within the new dictionary.

You can now delete new-dict.txt and import new-words.txt into your list of dictionaries.

### Simple right?

What if you want one wordlist to rule them all? So you could do it manually filtering out dictionaries from other dictionaries using the above command, or you go all in - concatenate everything.

```powershell 
c:\> gc rockyou.txt,weakpass.txt,breachcompilation.txt,new-dict.txt |sc mega-words.txt -encoding utf8
c:\> rli-ng.exe mega-words.txt new-mega-words.txt
# wait a while
```
![](/assets/images/2023-11-03-playing-with-rling-1.png "If one wants a deduplicated list - one must be patient")

*you can also save the file directly back to itself, just big files are a pain to download if it messes up :)*

Boom! You now have a mega wordlist, no duplicate words featured within. Be sure to record what wordlists you've concatenated together though in case you later need to add to it.