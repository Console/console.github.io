---
layout: post
title:  "NFTF: Alternative Data Streams - Bits and Pieces"
date:   2012-03-28 00:00:00 +0000
categories: blog

---
To those not familiar with the world of NTFS. It offers a feature known as [Alternate Data Streams](http://en.wikipedia.org/wiki/NTFS#Alternate_data_streams_.28ADS.29) which can allow a user to create hidden content attached to a file.

Typically generated using echo or type it normally requires a command prompt to get to generate these files or view the files.

However an alternative method in XP and 2K/2K3 series of operating systems was to add data to the summary properties of a text document created in notepad as it turns out this data was held within an ADS associated with the original text file.

What happens if like me last week you find yourself on a system with a tight group policy forbidding command line access and an execution arbiter that worked from a whitelist of very very few programs?

You get creative.

I know:
```
type hideme.txt > public.txt:hideme.txt
```
will generate an ADS.

I also know that typing
```
notepad c:\path\to\public.txt:hideme.txt
```
will let me edit the contents of hideme.txt which would not ordinarily be accessible by any other means.

Unfortunately opening a file in notepad and throwing ```public.txt:hideme.txt``` as a filename within the save as box will not work as windows dislikes the colon.

But what else runs console commands?

Batch files – nope not in this case, execution arbiter stops batch files running.

What about shortcuts?

Bang on.

* Right click “Create New -> Shortcut”
* Enter in “notepad” without quotes as the target, and complete the wizard with defaults.
* Right click the created shortcut change the target field to show
* ```%windir%\system32\notepad.exe "c:\path\to\public.txt:hideme.txt"```
* Save the changes and double click the shortcut.

Pow! You’re now editing an ADS attached to the public.txt file that you had available earlier, ADS created and without additional tools you’re free to hide data away from an administrators prying eyes on a system that gave you no access to a command prompt, stopped you running Batch files and more…

## What Next

So with that juicy thing done what else could I do? What about exporting sensitive company data? Maybe the customer contact list for a company or medical records or financial details?

Hmm okay so I’m going to have to get it off the system some how, but the company is smart and doesn’t allow the use of USB drives so I can’t use an NTFS formatted USB drive to export data (on non NTFS file systems the ADS is dropped as it’s not supported).

What about CD? Well I did say on non NTFS file systems the ADS disappears. It’s true for CDs ISO9660 and UDF formats don’t support alternate data streams so you’re stuck again.

Except, what if you change the file?

What if you zip it? then burn the zip?

Well sad to say using WINZIP v14+ and the default compressed folders function in windows, I believe you’re out of luck, both tools appeared to just drop the ADS content on the floor.

Using winrar however to create the zip… I’ve shown that it maintains the ADS across filesystems, now my test was using a local FAT32 formatted partition and an NTFS one, I didn’t actually burn it to CD-ROM so it may not be the case but it’s certainly looking promising.

If it is the case, having the ability to covertly export and import information using ADS suddenly becomes a big issue.

I plan on looking into it a bit more as it could have just been a series of flukes that worked for me but it was definitely promising.

My initial thoughts for this are: uuencoded zip file (ASCII friendly so will play nice as ADS content) containing lots of juicy personal information that shouldn’t be leaked. Add to a benign text file expected to leave the building. Winrar zip the lot, burn to CD… get home and do the reverse.

Ba doom boom! You’ve just circumvented the whole lot of data controls put in place to protect a companies data.