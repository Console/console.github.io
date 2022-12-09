---
layout: post
title:  "Tip of the day: Logical Syntax"
date:   2011-04-04 00:00:00 +0000
categories: blog

---

Just a neat little way of thinking about logical vs syntax errors.
Ever had to hunt high and low for a reason why something is not working as intended? Ever had an if statement that always evaluates as true?
Yes?

So you're probably aware that if the IF statement evaluates as true all the time, there is a fair to almost certain chance you've accidentally used an assignment operator instead of a comparison one. e.g. = vs ==.

In a mountain of code it can be a nightmare to find this and so how do you prevent it from ever being a problem? Let's think backwards.

Instead of:
```bash
IF ( favChocolate == "buttons"){ 
    echo "They like Cadbury Buttons"
}
```

use:
```bash
IF ("buttons" == favChocolate){
    echo "They like Cadbury Buttons"
}
```

### What does this do?
In non-interpreted languages if you accidentally type:
```bash
if ("buttons" = favChocolate){}
```
then a build error will result as you can't possibly assign a variable to a string. Thus eliminating the guess work involved in finding logical errors within your tests.