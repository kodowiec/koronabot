const Discord = require("discord.js");
const client = new Discord.Client();
const cheerio = require('cheerio');
const request = require('request');
var async = require('async');
var Long = require("long");

const dedicatedChannel = "name of dedicated channel for messages";
const discordToken = "YOUR DISCORD TOKEN HERE";

var lastMessageSent = "";
var separateReqPool = { maxSockets: 15 };
var tweets = {},
    apiurls = [],
    N = [];

///////////////////////////  CONFIGURE TWITTER HANDLERS /////////////////////////////////////////////////////
var THandlers = [{
    name: 'Ministerstwo Zdrowia',
    url: "https://nitter.net/MZ_GOV_PL?lang=en",
    keywords: "Liczba zakażonych koronawirusem:",
}];
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

//ADD TWEETS
THandlers.forEach((th, i) => {
    tweets[th.url] = [];
    apiurls.push(th.url);
});

//MONITOR
function monitorTt() {
    async.map(apiurls, function (item, callback) {
        request({ url: item, pool: separateReqPool }, function (error, response, body) {
            try {
                const $ = cheerio.load(body);
                var turl = "https://nitter.net" + response.req.path;
                if (!tweets[turl].length) {
                    //FIRST LOAD
                    for (let i = 0; i < $('div.tweet-content').length; i++) {
                        tweets[turl].push($('div.tweet-content').eq(i).text());
                    }
                } else {
                    //EVERY OTHER TIME
                    for (let i = 0; i < $('div.tweet-content').length; i++) {
                        const s_tweet = $('div.tweet-content').eq(i).text();
                        //CHECK IF TWEET IS NEWS
                        if (tweets[turl].indexOf(s_tweet) === -1) {
                            tweets[turl].push(s_tweet);
                            let th_kw = THandlers.filter((d, i) => d.url === turl)[0].keywords.split(',');
                            let th_name = THandlers.filter((d, i) => d.url === turl)[0].name;
                            th_kw.forEach((kw, j) => {
                                if (kw === '*') {
                                    N.push({
                                        tweet: s_tweet,
                                        name: th_name
                                    });
                                } else {
                                    if (s_tweet.indexOf(kw) != -1) {
                                        N.push({
                                            tweet: s_tweet,
                                            name: th_name
                                        });
                                    }
                                }
                            });
                        }
                    }
                    update();
                }
            } catch (e) {
                console.log('Error =>' + e);
            }
        });
    }, function (err, results) { });
}

const getDefaultChannel = (guild) => {
    // get "original" default channel
    if (guild.channels.has(guild.id))
        return guild.channels.get(guild.id)

    // Check for a "general" channel, which is often default chat
    const generalChannel = guild.channels.find(channel => channel.name === "general");
    if (generalChannel)
        return generalChannel;
    // Now we get into the heavy stuff: first channel in order where the bot can speak
    // hold on to your hats!
    return guild.channels
        .filter(c => c.type === "text" &&
            c.permissionsFor(guild.client.user).has("SEND_MESSAGES") && c.permissionsFor(guild.defaultRole).has(["SEND_MESSAGES", "VIEW_CHANNEL"]))
        .sort((a, b) => a.position - b.position ||
            Long.fromString(a.id).sub(Long.fromString(b.id)).toNumber())
        .first();
}

function getDate() {
    date = new Date();
    cleanDate = date.toLocaleDateString("pl");
    cleanTime = date.toLocaleTimeString("pl");
}

function update() {
    if (N.length) {
        let n = N.shift();
        if (n.tweet != lastMessageSent) {
            lastMessageSent = n.tweet;
            if (n.tweet.includes("Liczba zakażonych koronawirusem")) {
                const regex = /\d+\s\d+\/\d+\s\d+/gm;
                getDate();
                while ((m = regex.exec(n.tweet)) !== null) {
                    if (m.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }
                    m.forEach((match, groupIndex) => {
                        client.user.setActivity(`Z ${match} Ś (${cleanDate})`, { type: 'WATCHING' }).then();
                        var messageText = `Liczba zakażonych koronawirusem: ${match} (wszystkie pozytywne przypadki/w tym osoby zmarłe).`;
                        var guildList = client.guilds.array();
                        guildList.forEach(guild => {
                            try {
                                if (!guild.channels.find("name", dedicatedChannel)) {
                                    const channel = getDefaultChannel(guild);
                                    channel.send(messageText);
                                } else {
                                    guild.channels.find("name", dedicatedChannel).send(messageText);
                                }
                                console.log(`[${cleanDate} ${cleanTime}] Sending info to ${guild.name} (${guild.id}) [${match}]`);
                            }
                            catch (err) {
                                console.log(`[${cleanDate} ${cleanTime}] Could not send message to ${guild.id}`);
                                console.log(err);
                                console.log(`[-]`);
                            }
                        })
                    });
                }
            }
        }
    }
}

//Startup:
client.on("ready", () => {
    getDate();
    console.log(`[${cleanDate} ${cleanTime}] ready`);
    monitorTt();
    client.setInterval(monitorTt, 60000);
});

client.login(discordToken);