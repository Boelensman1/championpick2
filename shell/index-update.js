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

//load config
import {
  riotApiConfig, dbConnectionConfig, baseUrlLinks
}
from '../src/config';

//load url loaders
function makeUrl(type, parameter) {
    //get the complete url
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

//init riot api
import lol from 'lol-js';
var lolClient = lol.client({
  apiKey: riotApiConfig.key,
  cache: null
});

//network retry strategy (retry on everything)
function retry(err, response) {
  // retry the request if we had an error or if the response was not 'OK'
  return err || response.statusCode !== 200;
}

function getPositions(champions)
{
  cli.output('updating positions');
  var deferred = q.defer();
  var url = '';
  var positionsData = [];
  var positionsDataById = {};
  var championsProcessed = 0;
  champions.forEach(function(champion) {
    url = makeUrl('championgg', champion.name);
    cli.debug(url);

    request({url: url, retryStrategy: retry}, function(err, resp, body) {
      if (err !== null)
      {
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
      //insert the role in the database
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
      //check if we're at the end of the array
      if (championsProcessed === champions.length - 1) {
        cli.debug(positionsData);
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

function getLinks(champions, positionsDataById)
{
  cli.output('updating links');
  var deferred = q.defer();

  var linksData = [];
  var championsProcessed = 0;
  var championId, data, name, url;
  champions.forEach(function(champion) {
    cli.output(champion.getDataValue('name'));
    cli.output(positionsDataById[champion.getDataValue('id')]);
    //championgg
    positionsDataById[champion.getDataValue('id')].forEach(function(position)
    {
      championId = champion.getDataValue('id');
      cli.output(championId);
      name = 'championgg_' + position.position.toLowerCase();
      url = makeUrl('championgg', champion.getDataValue('name'));
      url = url + '/' + position.position.toLowerCase();

      cli.output(url);

      data = {
        championId: championId,
        name: name,
        url: url
      };
      linksData.push(data);
    });
      //check if we're at the end of the array
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

function processChampions(rawData, cb) {
  var champions = [];
  Object.keys(rawData.data).forEach(function(championName) {
    var champion = rawData.data[championName];
    champion = {
      riotId: champion.id,
      name: champion.name,
      title: champion.title,
      lore: champion.lore
    };
    champions.push(champion);
  });
  models.champion.bulkCreate(champions, {returning: true}).then(function(champions) {
          //ok, we have the champions, lets add the positions
          models.position.sync({
            force: true
          }).then(function() {
            getPositions(champions).then(function(positionsDataById)
            {
              //ok, positions are done, now lets update the links
              models.link.sync({
                force: true
              }).then(function() {
                getLinks(champions, positionsDataById).then(function()
                {
                  cb();
                });
              })
            });
          });
        });
}

module.exports = {
  do_update: function do_update(subcmd, opts, args, cb) {
    models.champion.sync({
      force: true
    }).then(function() {
      cli.output('Starting update!');
      riotApiConfig.regions.forEach(function(region) {
        cli.output('Updating ' + region + ' champions');
        lolClient.getChampionsAsync({
          champData: ['lore'],
          region: region
        }).then(function(rawData) {
          processChampions(rawData, cb);
        });
      });
    });
  },
  help: 'Help message'
};
process.on('uncaughtException', function(err) {
  cli.output((new Date()).toUTCString() + ' uncaughtException:', err.message);
  console.error(err.stack);
  process.exit(1);
});
