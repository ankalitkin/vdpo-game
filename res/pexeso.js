//Картинки
var pictures = [];
pictures[0] = "data/1.png";
pictures[1] = "data/2.png";
pictures[2] = "data/3.png";
pictures[3] = "data/4.png";
pictures[4] = "data/5.png";
pictures[5] = "data/6.png";
pictures[6] = "data/7.png";
pictures[7] = "data/8.png";
pictures[8] = "data/9.png";
pictures[9] = "data/10.png";
//Звуки
var sounds = {};
sounds["flip"] = "data/flip.m4a";
sounds["match"] = "data/match.m4a";
sounds["revert"] = "data/revert.m4a";
sounds["win"] = "data/win.m4a";
//Анимация
var ani = "res/hit.gif";

var audios = []; // preloaded sounds, remove it later

var cardsCount = 20;
var cardsAll = cardsCount / 2;
var lastClickTime;
var cardPairs;
var cardTries;
var intervalID;
var time = 0;
var gameRunning = false;
var statAllowed = false; //stat.kalitkin.com 
var backendlessAllowed = true; //backendless.com //!! Не забудь включить статистику!
var statExtended = true; //send game results
var statOnLoad = false;
var statOnUnload = false;

var localData = {}; //Дублирует document.cookie. Нужно, если игра запускается локально.

//Статистика

// array of card images
function preloadAudio() { //Если игра не запакована
	for (var sound in sounds)
		audios.push(new Audio(sounds[sound]));
		//new Audio(sounds[sound]);
}

function playSound(name) {
	var audio = new Audio(sounds[name]);
	audio.play();
}

function clearStat() {
	removeCookie('id');
	removeCookie('clicksTotal');
	removeCookie('timeTotal');
	removeCookie('gamesPlayed');
	removeCookie('gamesEnded');
}

function clearRecord() {
	removeCookie('topTime');
	removeCookie('topScore');
}

function clearAllCookies() {
	clearRecord();
	clearStat();
}

function getCookieInteger(name) {
	var num = Number(getCookie(name));
	if (isNaN(num)) num = 0;
	return num;
}

function incCookie(name, count) {
	var num = getCookieInteger(name);
	if (count) num += count;
	else num++;
	setCookie(name, num, 365);
}

function removeCookie(name) {
	setCookie(name, 0, -1);
	delete localData[name];
}

function setCookie(name, value, days) {
	var expires = "";
	if (days) {
		var date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
		expires = "; expires=" + date.toUTCString();
	}
	document.cookie = name + "=" + value + expires + "; path=/";
	localData[name] = value;
}

function getCookie(name) {
	var cookie = " " + document.cookie;
	var search = " " + name + "=";
	var setStr = localData[name];
	var offset = 0;
	var end = 0;
	if (cookie.length > 0) {
		offset = cookie.indexOf(search);
		if (offset != -1) {
			offset += search.length;
			end = cookie.indexOf(";", offset)
			if (end == -1) {
				end = cookie.length;
			}
			setStr = unescape(cookie.substring(offset, end));
		}
	}
	return (setStr);
}

function getStat(event, extended) {
	var stat = { 'ownerId': getCookie('id'),
	'clicksTotal': getCookieInteger('clicksTotal'),
	'timeTotal': getCookieInteger('timeTotal'),
	'gamesPlayed': getCookieInteger('gamesPlayed'),
	'gamesEnded': getCookieInteger('gamesEnded'),
	'topTime': getCookieInteger('topTime'),
	'topScore': getCookieInteger('topScore') };
	if (event)
		stat['event'] = event;
	if (extended) {
		stat['tries'] = cardTries;
		stat['time'] = time;
	}
	return stat;
}

function initBackendless() {
	var APP_ID = '56BC6906-65B7-9346-FF30-D01BBA863900';
	var API_KEY = 'EC45B157-8741-DB6E-FF73-22CE8B06DF00';
	Backendless.serverURL = 'https://api.backendless.com';
	Backendless.initApp(APP_ID, API_KEY);
}

function saveStatBackendless(sync, event, extended) {
	if (sync)
		Backendless.Data.of("stats").saveSync(getStat(event, extended));
	else
		Backendless.Data.of("stats").save(getStat(event, extended));
}

function saveStat(sync, event, extended) {
	if (statAllowed)
		$.ajax({type: 'POST', url: '//stat.kalitkin.com', async: !sync, data: getStat(event, extended)});
	if (backendlessAllowed)
		saveStatBackendless(sync, event, extended);
}

(function($) {

	// generate the playing field
	var generate = function generate() {
		for (var i = 1; i < cardsCount; i++) {
			$('.card:first-child').clone().appendTo('#game');
		}

	}

	var newGame = function newGame() {
		lastClickTime = null;
		cardPairs = 0;
		cardTries = 0;
		clearTimer();
		clearCounter();

		$('.modal').each(function() {hideModal($(this))});
		$('#newtopscoremsg').addClass('hide');
		$('#oldtopscoremsg').addClass('hide');

		//new deck
		deck = new Array(cardsAll);
		for (var i = 0; i < deck.length; i++)
			deck[i] = i;
		deck = deck.concat(deck);
		deck = shuffle(deck);

		//card position settings
		$('#game').children().each(function() {
			$(this).removeClass('card-flipped').removeClass('card-removed').removeClass('card-dev').addClass('update');

			// captured by clicking on the card - it is rotated
			var actualCard = $(this);
			actualCard.click(function() {
				selectCard(actualCard)
			});
		});
		setTimeout(updateCardPictures, 300);
	};

	var startGame = function startGame() {
		preloadAudio(); //remove it later
		//buttons to start a new game
		$('#new-game').click(newGame);
		$('#renew-game').click(newGame);
		$('#about-open').click(showAbout);
		$('#about-close').click(hideAbout);
		$('#topScoreAbout').dblclick(statDl);
		$('#clearRecordLink').click(clearRecordLink);
		$('#clearStatLink').click(clearStatLink);
		//Только для отладки.
		$('#title').dblclick(rotateAllCardsDev);
		$('#count').dblclick(aniTest);

		$(window).focus(windowFocus);
		$(window).blur(stopTimer);
		$(window).on("load", rescale);
		$(window).on("resize", rescale);
		$(window).on("orientationchange", rescale);
		id = getCookie('id') 
		if(!id)  id = Math.random().toString(16).substring(2);
		setCookie('id', id);
		if (statOnUnload)
			$(window).on('unload', function() {
				saveStat(true, 'unload');
			});
		generate();
		newGame();
		rescale();
		if (backendlessAllowed)
			initBackendless();
		if (statOnLoad)
			saveStat(false, 'load');
	};

	var updateCardPictures = function updateCardPictures() {
		$('.update').each(function() {		
			// get the card image from the smeared packet
			var pattern = deck.pop();
			var picture = pictures[pattern];
			$(this).removeClass('update')
			$(this).find('.back').css('background-image', 'url(' + picture + ')');
			// Save the card icon information to the HTML5 data-pattern element 
			$(this).data('pattern', pattern);
		});
	}
	     // Smash a pack of cards
	var shuffle = function shuffle(o) {
		for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
		return o;
	};     // select a card
	var selectCard = function selectCard(actualCard) {
		startTimer();
		gameRunning = true;
		if (lastClickTime == null) {
			incCookie('gamesPlayed');
		}
		incCookie('clicksTotal');
		incCookie('timeTotal', Math.min(time - lastClickTime, 10));
		lastClickTime = time;

	         // If two cards are swung, no other action is taken
		if ($('.card-flipped').length > 1) {
			return;
		}

		actualCard.addClass('card-flipped');

		if ($('.card-flipped').length == 2) {
			cardTries += 1;
			updateCounter();
			setTimeout(checkPattern, 900);
		}
		playSound('flip');
	};


	     // check whether the swivel cards are the same
	     // increment the pointer to the number of stacked pairs
	var checkPattern = function checkPattern() {
		if (isMatchPattern()) {
			cardPairs += 1;
			playAni();//play animation overlay
			$('.card-flipped').removeClass('card-flipped').off('click').addClass('card-removed');

			             // Find the end of the game - Find and rotate all the double cards
			if (cardPairs == cardsAll) {
				//Game ended
				gameRunning = false;
				incCookie('gamesEnded');
				stopTimer();
				if (newRecord)
					saveStat(false, 'newRecord', statExtended);
				else
					saveStat(false, 'gameEnd', statExtended);

				updateOldTopScore();
				var newRecord = updateTopScore();
				showResults(newRecord);
				playSound('win');
			} else {
				playSound('match');
			}


		} else {
			$('.card-flipped').removeClass('card-flipped');
			playSound('revert');
		}
	};


	     // test the consistency of two swirled cards using the HTML5 attribute of the data-pattern
	var isMatchPattern = function isMatchPattern() {
		var cards = $('.card-flipped');
		var pattern = $(cards[0]).data('pattern'); // pattern of the first rotated card
		var anotherPattern = $(cards[1]).data('pattern'); // pattern of the rotated card
		return (pattern == anotherPattern);
	};

	var updateOldTopScore = function updateOldTopScore() {
		$('#oldtopscore').html(topScoreString() + " (" + getMark(getCookieInteger('topScore', true)) + ") ");
	}

	var topScoreString = function topScoreString() {
		topScore = getCookieInteger('topScore');
		topTime = getCookieInteger('topTime');
		var res = topScore.toString() + ' ';
		var a =  topScore % 20;
		if (topScore > 30) a = topScore % 10;
		switch (a) {
			case 1:
				{
					res += 'попытка';
					break;
				}
			case 2:
			case 3:
			case 4:
				{
					res += 'попытки';
					break;
				}
			default:
				{
					res += 'попыток';
					break;
				}
		};
		res += ' за ' + getTimeString(topTime);
		return res;
        }

	var updateTopScore = function updateTopScore() {
		var topScore = getCookieInteger('topScore');
		var topTime = getCookieInteger('topTime');
		var res = false;
		if (topScore == 0 || cardTries < topScore || (cardTries == topScore && time < topTime)) {
			if (topScore != 0) res = true;
			topScore = cardTries;
			setCookie('topScore', topScore, 365);
			topTime = time;
			setCookie('topTime', topTime, 365);
		}
		return res;
	}

	var getMark = function getMark(cardTries, spaces) {
		var mark = 1;
		var res = "";
		if (cardTries < 36) mark = 2;
		if (cardTries < 31) mark = 3;
		if (cardTries < 26) mark = 4;
		if (cardTries < 21) mark = 5;
		if (cardTries < 16) mark = 6;  //Специально для Паши
		for (i = 0; i < mark; i++) {
			res += "★"; //black star
			if (spaces)
				res += " ";
		}
		for (i = 0; i < 5 - mark; i++) {
			res += "☆"; //white star
			if (spaces)
				res += " ";
		}
		return res.trim();
	}

	var getTimeString = function getTimeString(time) {
		timetext = "";
		minutes = Math.floor(time / 60);
		seconds = time % 60;
		if (minutes < 10) {
			timetext += "0";
			timetext += minutes;
		} else {
			timetext = minutes
		}
		timetext += ":";
		if (seconds < 10)
			timetext += "0";
		timetext += seconds;
		return timetext;
	}

	var sec = function sec() {
		time += 1;
		updateTimer();
	}

	var updateTimer = function updateTimer() {
		timetext = "Время: ";
		timetext += getTimeString(time);
		$('#time').html(timetext);

		//Red flash every 10 seconds
		if (time > 0 && (time % 10) == 0)
			$('#time').removeClass('black').addClass('red');
		setTimeout(function() {
			$('#time').removeClass('red').addClass('black');
		}, 100);
	}

	var updateCounter = function updateCounter() {
		$('#count').html("Попытки: " + cardTries);

		//Red flash every 5 tries
		if (cardTries % 5 == 0) {
			$('#count').removeClass('black').addClass('red');
			setTimeout(function() {
				$('#count').removeClass('red').addClass('black');
			}, 100);
		}

	}
	
	var clearCounter = function clearCounter() {
		$('#count').html("Попытки: 0");
	}

	var startTimer = function startTimer() {
		if (intervalID == undefined) {
			intervalID = setInterval(sec, 1000);
		}
	}

	var stopTimer = function stopTimer() {
		clearInterval(intervalID);
		intervalID = undefined;
	}

	var clearTimer = function clearTimer() {
		clearInterval(intervalID);
		intervalID = undefined;
		time = 0;
		$('#time').html("Время: 00:00");
	}

	var showResults = function showResults(newTopScore) {
		if (newTopScore) {
			$('#newtopscoremsg').removeClass('hide');
			$('#oldtopscoremsg').removeClass('hide');
		}				
		showModal($('#results'));
		$('#timeres').html(getTimeString(time));
		$('#triesres').html(cardTries);
		$('#topscore').html(topScoreString());
		$('#mark').html(getMark(cardTries));
	}

	var showAbout = function showAbout() {
		showModal($('#about'));

		//Статистика скрыта от пользователя
		if (getCookieInteger('showStat') > 0) {
			$('#stat').removeClass('hide');
			$('#clearStatLink').removeClass('hide');
		}
		$('#gamesPlayedAbout').html(getCookieInteger('gamesPlayed'));
		$('#gamesEndedAbout').html(getCookieInteger('gamesEnded'));
		$('#clicksTotalAbout').html(getCookieInteger('clicksTotal'));
		$('#timeTotalAbout').html(getTimeString(getCookieInteger('timeTotal')));

		$('#topScoreAbout').html(topScoreString());
	}

	var statDl = function statDl() {
		window.getSelection().removeAllRanges();
		if (getCookieInteger('showStat') > 0) {
			removeCookie('showStat');
			$('#stat').addClass('hide');
			$('#clearStatLink').addClass('hide');
		} else {
			setCookie('showStat', 1, 365);
			$('#stat').removeClass('hide');
			$('#clearStatLink').removeClass('hide');
		}
	}

	var clearRecordLink = function clearRecordLink() {
		if(confirm("Вы десйтвительно хотите очистить рекорды?"))
		{
			clearRecord();
			showAbout();
		}
	}

	var clearStatLink = function clearStatLink() {
		if(confirm("Вы десйтвительно очистить статистику?"))
		{
			clearStat();
			showAbout();
		}
	}


	var hideAbout = function hideAbout() {	
		hideModal($('#about'));
	}

	var showModal = function showModal(modal) {
		modal.addClass('top').addClass('in');
		stopTimer();
		rescaleModal();
	}

	var hideModal = function hideModal(modal)
	{
		modal.removeClass('in');
		setTimeout(function() {
			modal.removeClass('top');
		}, 150);
		if ($('.in').length == 0 && gameRunning)
			startTimer();
	}

	var windowFocus = function windowFocus() {
		if(gameRunning)
			startTimer();
	}

	var playAni = function playAni() {
		$('.card-flipped').each(function() {
			image = $('<img />').appendTo('#game').addClass('overlay').css({top: $(this).offset().top, left: $(this).offset().left });
			image.attr('src', ani);
		});
			setTimeout(clearAni, 500);
	}

	var flashDev = function flashDev() {
		$('.card-dev').each(function() {
			image = $('<img />').appendTo('#game').addClass('overlay').css({top: $(this).offset().top, left: $(this).offset().left });
			image.attr('src', ani);
		});
			setTimeout(clearAni, 500);
	}


	var clearAni = function clearAni() {
		$('.overlay').remove();
	}

	//Rescale function -- все проблемы из-за вьюпорта! (Теперь нет.)
	//Хьютон, у нас проблемы! Какие? Глобальные, ясен красен!
	var rescale = function rescale() {
		container = $('#container');
		nav_inside = $('#nav_inside');
		nav = $('#nav');
	
		doc_w = document.documentElement.clientWidth;
		doc_h = document.documentElement.clientHeight - (65 * nav.css('zoom'));
	
		if (doc_w < 800) {
			container.css('width', 720);
			nav_inside.css('width', 720);
		} else {
			container.css('width', 900);
			nav_inside.css('width', 900);
		}
		con_w = container.outerWidth();
		con_h = container.outerHeight();
		index_w = doc_w / con_w;
		index_h = doc_h / con_h;
		index = Math.min(index_w, index_h);
		if (index >= 1) {
			container.css('zoom', 1);
			nav.css('zoom', 1);
		} else {
			container.css('zoom', index);
			nav.css('zoom', index);
		}
		rescaleModal();	
	}
	
	var rescaleModal = function rescaleModal() {
		res = $('#results').find('.modal-dialog');
		about = $('#about').find('.modal-dialog');
		doc_w = document.documentElement.clientWidth;
		doc_h = document.documentElement.clientHeight; // - 65 / 2;

		index_m = doc_w / 600;
		if (doc_w < 721) {
			res.css('zoom', index_m);        	
			about.css('zoom', index_m);
			res.css('margin-top', 200);
			about.css('margin-top', 200);
		} else {
			res.css('zoom', 1);	
			about.css('zoom', 1);
			res.css('margin-top', (doc_h - res.outerHeight()) / 2);
			about.css('margin-top', (doc_h - about.outerHeight()) / 2);
		}
	}

	var rotateAllCardsDev = function rotateAllCardsDev() {
		$('#game').find('.card').each( function() {
			if($(this).hasClass('card-dev'))
				$(this).removeClass('card-dev');
			else
				$(this).addClass('card-dev');
		});
		window.getSelection().removeAllRanges();
	}

	var aniTest = function aniTest() {
		window.getSelection().removeAllRanges();
		playAni();
		$('#game').find('.card').each( function() {
			if($(this).hasClass('card-removed'))
				$(this).removeClass('card-removed').removeClass('card-flipped');	
			if($(this).hasClass('card-flipped'))			
				$(this).removeClass('card-flipped').addClass('card-removed');
			if(!$(this).hasClass('card-removed'))
				$(this).addClass('card-flipped');

		});
	}
		
	window.onload = startGame();
}(jQuery));