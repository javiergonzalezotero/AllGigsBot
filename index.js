'use strict'

var tg = require('telegram-node-bot')('235862604:AAEOyEiEa8PXJnO5jUa766K53yFCK843YgA');
//var redis = require('redis');
var request = require('request');
var fs = require('fs');
var config = require('./config');
var Songkick = require('./songkick-api-extended');
var sk = new Songkick(config.sk_token);

//just to heroku
require('./web');
var logoId;


tg.router.
when(['/start'], 'HelpController').when(['/help'], 'HelpController').
otherwise('OtherwiseController')

tg.controller('HelpController', ($) => {
   $.sendMessage("Just write down the name of your favourite band to see its upcoming concerts. " +
    "To get the list of upcoming concerts near you send your location. \n\n" +
    "Inline mode is also available", {parse_mode : 'Markdown'});
});


tg.controller('OtherwiseController', ($) => {
    var options = {};
    if ($.message.text) {
        options.artist_name = $.message.text;
    } else if ($.message.location) {
        var location = 'geo:' + $.message.location.latitude + ',' + $.message.location.longitude;
        options.location = location;
    }

    options.per_page = 5;

    sk.searchEventsWholeAnswer(options)
    .then(function(response) {
        var nPages = Math.ceil(response.totalEntries / options.per_page);
        sendListConcertsPaginated($,response.results.event, nPages, options);
    })
    .catch(function(error) {
        console.log(error);
    });
});


function prepareList(events){
    var response="*Concerts list:*";
    var delim = "\n";
    events.forEach( (event) => {
        //TODO get the actual date of performace, but it would be too slow, request SongKick to include
        //date field in the performance array included in the event
/*        if(event.type == 'Festival'){
            sk.searchPerformances({artist_id: event.performance[0].artist.id})
            .then(function(performances) {
                performances.forEach((performance) => {
                    if(performance.event.id == event.id){
                        event.displayName = event.displayName + performance.date;
                        console.log(event.displayName);
                        response += delim + event.displayName + "\n" + "[Info + Tickets]("+event.uri+")"; 
                    }
                });
            })
            .catch(function(error) {
                console.log(error);
            });
        }*/
        var city = ". "
        if (event.location.city) {
            city += event.location.city;
        }
        var displayName = event.displayName;
        if (event.type == 'Festival') {
            displayName = "_" + event.displayName + "_";
        }
        response += delim + displayName + city +"\n" + "[Info + Tickets]("+event.uri+")"; 
        delim = "\n\n";
    });
    return response;
}


function sendListConcerts($,events){
    if(!events){
        $.sendMessage("*No concerts found \u{1F615}*", {parse_mode : 'Markdown'}); 
        return;
    }
    //All is good. Print the list
    $.sendMessage(prepareList(events), {parse_mode : 'Markdown', disable_web_page_preview : true});
}

function sendListConcertsPaginated($, events, nPages, options){
    if(!events){
        $.sendMessage("*No concerts found \u{1F615}*", {parse_mode : 'Markdown'}); 
        return;
    }
    var logo = logoId ? logoId : fs.createReadStream('logo.png');
    $.sendPhoto(fs.createReadStream('logo.png'), {}, function(body, err){
        if(err){
            console.log(err);
        }
        sendListConcertsAfterPhoto($,events,nPages, options);
    });
}

function sendListConcertsAfterPhoto($, events, nPages, options){
    if(nPages == 1){
        $.sendMessage(prepareList(events), {parse_mode : 'Markdown', disable_web_page_preview : true});
        return;
    }
    var arrayEvents = events;
    var initialKeyboard = [
    {
        text: '- 1 -',
        callback: ($) => {
            callbackFunc($, 1, options);
        }
    },
    {
        text: '2',
        callback: ($) => {
            callbackFunc($, 2, options);
        }
    }];
    if (nPages > 2) {
        initialKeyboard.push({
            text: '3',
            callback: ($) => {
                callbackFunc($, 3, options);
            }
        });
    }

    var currentPage = 1;
    $.runInlineMenu('sendMessage', prepareList(events), 
        {parse_mode : 'Markdown',
        disable_web_page_preview : true
    }, initialKeyboard, [3]);


    var callbackFunc = function($, page, optionz){
        var btnPressed = page ? page : Number($.data.split(":")[0]);
        var options = this ? this : optionz;
        tg.answerCallbackQuery($.id + ':' + $.data, {});
        if(btnPressed == currentPage){
            return;
        }
        currentPage = btnPressed;
        var messageId = $.message.message_id;

        tg.callbackQueriesCallbacks[$.from.id + ':' + (btnPressed-1) + ":" + messageId] = callbackFunc.bind(options);
        tg.callbackQueriesCallbacks[$.from.id + ':' + btnPressed + ":" + messageId] = callbackFunc.bind(options);
        tg.callbackQueriesCallbacks[$.from.id + ':' + (btnPressed+1) + ":" + messageId] = callbackFunc.bind(options);

        var keyboard = [];
        if (nPages < 3) {
            keyboard.push(
              {text: prepareLabelButton(1, btnPressed), callback_data: "1" + ":" + messageId},
              {text: prepareLabelButton(2, btnPressed), callback_data:"2" + ":" + messageId});
        } else{
            var center = btnPressed;
            if (center == 1) {
                center = 2;
            } else if (center == nPages) {
                center = nPages - 1;
            }
            keyboard.push(
              {text: prepareLabelButton(center - 1, btnPressed), callback_data: (center - 1) + ":" + messageId},
              {text: prepareLabelButton(center, btnPressed), callback_data: center + ":" + messageId},
              {text: prepareLabelButton(center + 1, btnPressed), callback_data: (center + 1) + ":" + messageId});
        }

        options.page = btnPressed;

        if(arrayEvents[(btnPressed - 1) * options.per_page]){
            editMessage($, 
                events.slice((btnPressed - 1) * options.per_page, btnPressed  * options.per_page), keyboard);
        }else{
            sk.searchEvents(options)
            .then(function(events) {
                for (var i = 0; i < events.length; i++) {
                 arrayEvents[(btnPressed - 1) * options.per_page + i] = events[i];   
             }
             editMessage($, events, keyboard);
         })
            .catch(function(error) {
                console.log(error);
            });
        }
    };


    var editMessage = function($, events, keyboard){
        tg.editMessageText(prepareList(events), {
            chat_id: $.message.chat.id, 
            message_id: $.message.message_id,
            parse_mode : 'Markdown',
            disable_web_page_preview : true,
            reply_markup : JSON.stringify({
                inline_keyboard: [keyboard]
            })
        }, function(body, err){
            if(err)
                console.log(err);
        });
    };

    var prepareLabelButton = function(pageNumber, btnPressed){
        if (pageNumber == btnPressed) {
            return '- ' + pageNumber + ' -';
        }
        return '' + pageNumber;
    };

}


//INLINE MODE EVENTS
tg.inlineMode(($) => {
    if($.query){
        sk.searchEvents({
            'artist_name': $.query
        })
        .then(function(events) {
            var results = [];
            if(events){
                events.forEach((event) => {
                    var city = ""
                    if (event.location.city) {
                        city += event.location.city;
                    }
                    results.push({
                        type : "article", 
                        title : event.displayName,
                        input_message_content: {
                            parse_mode: "Markdown",
                            disable_web_page_preview : true,
                            message_text: "*" + event.displayName +
                            "*\n"+ city +"\n" + "[Info + Tickets]("+event.uri+")"
                        },
                        description : city
                    });
                });
            }
            tg.paginatedAnswer($, results, 5);
        })
        .catch(function(error) {
            console.log(error);
        })
    }
})

//INLINE MODE ARTISTS
/*tg.inlineMode(($) => {
    if($.query){
        sk.searchArtists({
            'query': $.query
        })
        .then(function(artists) {
            var results = [];
            if(artists){
                artists.forEach((artist) => {
                    console.log(artist);
                    results.push({
                        type : "article", 
                        title : artist.displayName,
                        input_message_content: {
                            message_text: artist.displayName
                        }
                    })
                });
                tg.paginatedAnswer($, results, 10);
            }
        })
        .catch(function(error) {
            console.log(error);
        })
    }
})*/