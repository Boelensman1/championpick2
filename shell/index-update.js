// cli.js
// ========
/* vim: set ts=2 sw=2 tw=0 expandtab: */

// load required libraries
import q from 'q';
import request from 'requestretry';
import cheerio from 'cheerio';

// load project files
import cli from './cli';
import models from '../models';

// load config
import {
  riotApiConfig, baseUrlLinks, dataDragonUrls
}
from '../src/config';

// function to call at the end
var cb;

// load url loaders
function makeUrl(type, parameter) {
    // get the complete url
    var url = baseUrlLinks[type];
    switch (type) {
      case 'championgg':
      if (parameter === 'wukong')
        parameter = 'MonkeyKing';
      default:
      parameter = parameter.replace(/\W/g, '');
      url = url.replace('${parameter}', parameter);
      break;
    }
    return url;
  }

// init riot api
import lol from 'lol-js';
var lolClient = lol.client({
  apiKey: riotApiConfig.key,
  cache: null
});

// network retry strategy (retry on everything)
function retry(err, response) {
  // retry the request if we had an error or if the response was not 'OK'
  return err || response.statusCode !== 200;
}

function getPositions(champions) {
  cli.output('updating positions');
  var deferred = q.defer();
  var url = '';
  var positionsData = [];
  var positionsDataById = {};
  var championsProcessed = 0;
  champions.forEach(function(champion) {
    url = makeUrl('championgg', champion.name);

    request({url: url, retryStrategy: retry}, function(err, resp, body) {
      if (err !== null) {
        cli.output('error while downloading ' + url);
      }
      var position, played;
      var $ = cheerio.load(body);
      var positions = $('.champion-profile ul li');

      positionsDataById[champion.getDataValue('id')] = [];

      $(positions).each(function(i, position_div) {
        position = $(position_div).children('a').text().trim();
        played = $(position_div).children('small').first().text().trim();
        played = played.replace('% Role Rate', '');
      // insert the role in the database
      positionsData.push({
        championId: champion.getDataValue('id'),
        position: position,
        played: played
      });
      //insert it into the object that we need later
      positionsDataById[champion.getDataValue('id')].push({
        position: position,
        played: played
      });
    });
      // check if we're at the end of the array
      if (championsProcessed === champions.length - 1) {
        models.position.bulkCreate(positionsData, {returning: true}).then(function() {
          deferred.resolve(positionsDataById);
        });
      }
      else
      {
        championsProcessed += 1;
      }
    });
  });
  return deferred.promise;
}

function getLinks(champions, positionsDataById) {
  cli.output('updating links');
  var deferred = q.defer();

  var linksData = [];
  var championsProcessed = 0;
  var championId, data, name, url;
  champions.forEach(function(champion) {
    // championgg
    positionsDataById[champion.getDataValue('id')].forEach(function(position) {
      championId = champion.getDataValue('id');
      name = 'championgg_' + position.position.toLowerCase();
      url = makeUrl('championgg', champion.getDataValue('name'));
      url = url + '/' + position.position.toLowerCase();

      data = {
        championId: championId,
        name: name,
        url: url
      };
      linksData.push(data);
    });
      // check if we're at the end of the array
      if (championsProcessed === champions.length - 1) {
        models.link.bulkCreate(linksData, {returning: true}).then(function() {
          deferred.resolve(linksData);
        });
      }
      else
      {
        championsProcessed += 1;
      }
    });
  return deferred.promise;
}

function getImages(champions, rawData, dataDragonVersion) {
  cli.output('updating images');
  var deferred = q.defer();

  var iconData = [];
  let championsProcessed = 0;

  const baseUrl = dataDragonUrls.base + dataDragonVersion;
  const iconBaseUrl = baseUrl + dataDragonUrls.championIcon;

  champions.forEach(function(champion) {
    const imageInfo = rawData[champion.getDataValue('simpleName')].image;
    const iconUrl = iconBaseUrl + imageInfo.full;
    const championId = champion.getDataValue('id');

    const data = {
      championId: championId,
      url: iconUrl
    };

    iconData.push(data);
    // check if we're at the end of the array
    if (championsProcessed === champions.length - 1) {
        models.championIcon.bulkCreate(iconData, {returning: true}).then(function() {
          deferred.resolve(iconData);
      });
    }
    else
    {
      championsProcessed += 1;
    }
  });
  return deferred.promise;
}

function capitalizeOnlyFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.toLowerCase().slice(1);
}

function processChampions(rawData, dataDragonVersion) {
  var champions = [];
  Object.keys(rawData.data).forEach(function(championName) {
    var champion = rawData.data[championName];
    champion = {
      riotId: champion.id,
      name: champion.name,
      simpleName: champion.key,
      title: champion.title,
      lore: champion.lore
    };
    champions.push(champion);
  });
  models.champion.bulkCreate(champions, {returning: true}).then(function(champions) {
  // ok, we have the champions, lets add the positions
  models.position.sync({
    force: true
  }).then(function() {
    getPositions(champions).then(function(positionsDataById)
    {
      // ok, positions are done, now lets update the links
      models.link.sync({
        force: true
      }).then(function() {
        getLinks(champions, positionsDataById).then(function()
        {
          cb();
        });
      });
    });
  });

  //also add the images
   models.championIcon.sync({
    force: true
  }).then(function() {
    getImages(champions, rawData.data, dataDragonVersion).then(function(){
      cb();
    });
  });

  });
}

function getChampions(dataDragonVersion)
{
    models.champion.sync({
      force: true
    }).then(function() {
      cli.output('Starting update!');
      riotApiConfig.regions.forEach(function(region) {
        cli.output('Updating ' + region + ' champions');
        lolClient.getChampionsAsync({
          champData: ['image,lore'], // yes, this is correct
          region: region
        }).then(function(rawData) {
          processChampions(rawData, dataDragonVersion);
        });
      });
    });
}

// from http://stackoverflow.com/a/6832721/1090586
// swapped v1 and v2, making it reverse-sort
function versionCompare(v2, v1, options) {
    var lexicographical = options && options.lexicographical,
        zeroExtend = options && options.zeroExtend,
        v1parts = v1.split('.'),
        v2parts = v2.split('.');

    function isValidPart(x) {
        return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    }

    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
        return NaN;
    }

    if (zeroExtend) {
        while (v1parts.length < v2parts.length) v1parts.push("0");
        while (v2parts.length < v1parts.length) v2parts.push("0");
    }

    if (!lexicographical) {
        v1parts = v1parts.map(Number);
        v2parts = v2parts.map(Number);
    }

    for (var i = 0; i < v1parts.length; ++i) {
        if (v2parts.length == i) {
            return 1;
        }

        if (v1parts[i] == v2parts[i]) {
            continue;
        }
        else if (v1parts[i] > v2parts[i]) {
            return 1;
        }
        else {
            return -1;
        }
    }

    if (v1parts.length != v2parts.length) {
        return -1;
    }

    return 0;
}

function checkVersion(remoteVersions) {
  const newestVersion = remoteVersions.sort(versionCompare)[0];
  cli.output('Newest version: ' + newestVersion);
  getChampions(newestVersion);
}


module.exports = {
  do_update: function do_update(subcmd, opts, args, end) {
    // make end function global
    cb = end;

    // check datadragon version
    cli.output('Checking version info');
    lolClient.getVersionsAsync().then(checkVersion);
  },
  help: 'Help message'
};
process.on('uncaughtException', function(err) {
  cli.output((new Date()).toUTCString() + ' uncaughtException:', err.message);
  console.error(err.stack);
  process.exit(1);
});
