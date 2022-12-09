---
layout: post
title:  "Bash 'while read line' vs Awk Large File Processing"
date:   2010-07-24 00:00:00 +0000
categories: blog

---

Recently I had to fudge some data so that it would be imported into a database after an outage caused our "php" data loader to try and allocate a crazy amount of memory and die fantastically.

Being a fan of automating everything I can I started out down the trail of "okay lets script this". A few moments later I had a simple bash script looking somewhat like:

```bash
#!/bin/sh
filename=$1
while read line; do
#Read each line and grab the necessary fields, create the insert statements.
field1=`echo ${line} | awk {'print $1'}`
field2=`echo ${line} | awk {'print $7'}`

echo "INSERT INTO testtable VALUES ('${field1},UNIX_TIMESTAMP(${field2}));" > data.in
done < ${filename}
#Assume all is good and just feed the file to mysql for processing
mysql -u root testdatabase < data.in
#EOF
```
*Yes the code above is horrific*

A simple script - using my favourite awk statement for breaking text into fields rather than cut.

While work finished at 17:30, it was now 19:00 and my script was still running having been set off at about 10am. A quick wc -l and some dodgy division told me it still had about 56 hours to run. I was processing 2.6 million lines and it wasn't even at the 500k mark just yet.

Anxious as every hour the system was down, the queue of unloaded records was growing. I decided to use the time I was burning waiting for this to finish to try and find a better way of doing the job. Which pointed me to AWK. I was already using snippets of it to extract fields from a string, why not write the entire thing in AWK?

So a few hours of scratching my head later and I came out with the following awk script.
```awk
#!/bin/sh
filename=$1
awk BEGIN{
    # Special characters represented by octal values to prevent any escaping issues.
    q="47" # single quotation mark
    lb="50" # left bracket
    rb="51" # right bracket
    c="54" # comma
    sc="73" # semi-colon
}
{
    print "INSERT INTO testtable VALUES " lb q $1 q c "UNIX_TIMESTAMP(" $7 rb rb sc >> data.in
} ${filename}
mysql -u root testdatabase < data.in
#EOF
```
Not that much of a difference if anything, except when you run it.

* Time for the Bash script to run: >60 Hours.
* Time for the AWK script to run: <90 seconds.

**Lesson learned**:  Never use bash while loops to iterate through large text files.
