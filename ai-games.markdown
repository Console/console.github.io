---
layout: page
title: AI-Games
permalink: /ai-games/
---
# Game List
Just a bunch of games me and some mates have randomly spawned out of AI BS.
The rules? 10 conditions, each takes turns to define a condition. Throw it into ChatGPT and see what comes out the other side of it.

* [Mally Hunt](https://blog.scriptmonkey.uk/ai-games/MallyV2.html) - complete with scaling game area, and penalty for clicks.
* [Deep Brew Dash](https://blog.scriptmonkey.uk/ai-games/deep_brew_dash.html)
* [Block City Battle](https://blog.scriptmonkey.uk/ai-games/block_city_battle.html)
* [Astrocats Neon](https://blog.scriptmonkey.uk/ai-games/astrocats_neon.html)

# ChittyKitty

* [ChittyKitty](https://blog.scriptmonkey.uk/ai-games/chittykitty/index.html)

Not so much a game, but rather a tool that i'd been wanting to make for a long time. Before COVID kyboshed stuff I regularly used to go away with a group of friends who introduced me to the concept of basically "you've not spent enough, it's your turn".

No pooling money into a central kitty, or tracking "rounds"/splitting bills. One of us would pay the entire bill at any point in time, and we'd square it away later. Each taking it in turns based on how much we've spent already, so that no one person climbed a huge gap ahead. Making it easy to square things away at the end of the trip with each other.

The way this worked was:

* We are going on holiday together.
* One of us would set up a spreadsheet for group spends, each time we spend something as a group we log it in the spreadsheet. Date, Payer, Description, Amount, Currency, who partook.
* We need a taxi to the airport, usually... you'd split it right?
* not here, lets not split. Dave... pay the £75 to get us to the airport.
* We're at the airport, now we need a beer. Anne you've not bought anything yet... buy us a round! £50 spent on beer.
* we all want food. Danny you buy the food. £60 spent on food.
* You get on the plane, the otherside you need a taxi.
    * Dave has spent £75 so far.
    * Danny has spent £60
    * That leaves Anne in the back spending only £50.
* So Anne goes and spends $27 on the taxi to the hotel, but that's not GBP... that's USD, so lets track that too.
... so it continues. The lowest spending person always picking up the bill for the others and someone in the group (usually whilst someone was at the bar waiting for the beers) would update the spreadsheet.

On the flight home and in the airport, we'd all sit down, grab the FX rates on that day and calculate the GBP costs. Then work out how much money needed to change hands to make us all square and even. We'd transfer each other some funds as discovered via bank transfer or whatever and get on with life.

It wasn't too bad and over the years we gradually got templates and formulae all sorted in google sheets to manage it somewhat effectively but it got me thinking this wasn't a particularly hard problem, it was just numbers and tracking costs, and I wished there was a more convenient app on my phone that would work rather than using google sheets on a mobile phone.

ChittyKitty (ShittyKitty rather than Chitty Kitty, the play on words was somewhat deliberate as it was a name invented whilst drinking beers and calculating the settlement figures waiting for a flight home from Antwerp) is that app. It's responsive so it works on laptops, phones, tablets. It works offline as I intended it for those times when you have hotel wifi but no roaming service, and caches FX rates based on historical data, it calculates splits based on participants, and accounts for the differences in currencies, it can use multiple currencies in a single trip, and it can be exported and shared in a granular manner so others can load chittykitty on their phones, and import your data... equally they can export their data and send it to you, and you import it. It comes together seamlessly and doesn't double report figures.

Yes it is vibe coded using ChatGPT, but theres a fair amount of heavy lifting on my part. The only communications it has with the outside world is a call to an API endpoint that pulls all currencies across all days of a trip, and caches it in local (indexedDB) storage.

You will need an API key to make use of this feature, or you can enter the conversion rate yourself at the time or later.

Is it 100% bug free - no. Tread carefully, though if you export a copy of your json you can usually restore the trip from data after deleting it. It does do the divvying up of money correctly though as far as I've tested it.

I'll open-source it (though its a standalone JS based app... so I mean... you have it) on github at somepoint, repo will move from private to public but figured I'd share it on this site first.