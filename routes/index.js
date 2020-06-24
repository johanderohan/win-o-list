var https = require('https');
var fs = require('fs');
var glob = require('glob')
var express = require('express');
var router = express.Router();
var cron = require('node-cron');
var request = require('request');
var wget = require('wget-improved');
var moment = require('moment');

const stripHtml = require("string-strip-html");

var FILEID = '';
var CURRENT_PATH = '';
var CURRENT_DATE = '';

/* GET home page. */
router.get('/', function(req, res, next) {
  loadReleases(CURRENT_PATH,function(data){
    var menu = generateMenu();
    res.render('index', { title: 'win-o-list', data: data, menu: menu, selected: CURRENT_DATE });
  });
});

/* GET thread page. */
router.get('/thread/:file', function(req, res, next) {
  if (req.params.file) {
    loadReleases('thread/'+req.params.file,function(data){
      var menu = generateMenu();
      res.render('index', { title: 'win-o-list', data: data, menu: menu, selected: CURRENT_DATE });
    });
  }
});

function savedReleases(next) {

  var files = glob.sync('thread/*.json', {});

  var returned_files = [];
  for (var i = files.length - 1; i >= 0; i--) {
    delete require.cache[require.resolve(__dirname + '/../' + files[i])]
    var json_data = require(__dirname + '/../' + files[i]);
    returned_files.push({time:json_data.posts[0].time, file:files[i], closed: json_data.posts[0].closed});
  }

  return returned_files;

}

function generateMenu(next) {

  var files = glob.sync('thread/*.json', {});

  var returned_files = {};
  var last_year = -1;
  for (var i = files.length - 1; i >= 0; i--) {
    delete require.cache[require.resolve(__dirname + '/../' + files[i])]
    var json_data = require(__dirname + '/../' + files[i]);
    var year = moment.unix(json_data.posts[0].time).format('YYYY');
    var month = moment.unix(json_data.posts[0].time).format('MM');
    if(year != last_year) {
      returned_files[year] = {};
      last_year = year;
    }
    returned_files[year][month] = [];
  }

  for (var i = files.length - 1; i >= 0; i--) {
    var json_data = require(__dirname + '/../' + files[i]);
    var year = moment.unix(json_data.posts[0].time).format('YYYY');
    var month = moment.unix(json_data.posts[0].time).format('MM');
    returned_files[year][month].push({time:json_data.posts[0].time, file:files[i], closed: json_data.posts[0].closed});
  }

  return returned_files;

}

function loadReleases(file_path, next) {

  const FILE_PATH = file_path;

  if (fs.existsSync(FILE_PATH)) {
    delete require.cache[require.resolve(__dirname + '/../' + FILE_PATH)]
    var json_data = require(__dirname + '/../' + FILE_PATH);
    var SAVE_DATA = [];

    CURRENT_DATE = json_data.posts[0].time;

    //for (var i = 0; i < json_data.posts.length; i++) {
    for (var i = json_data.posts.length - 1; i >= 0; i--) {
      var post = json_data.posts[i].com;
      if(post) {
        if(post.includes('quotelink')) {}
        else {
          if(post.includes('https://mega.nz') || post.includes('https://dropapk.to') || post.includes('zippyshare.com') || post.includes('https://www.sendspace.com') || post.includes('https://1fichier.com') || post.includes('https://my.pcloud.com') || post.includes('http://www.mediafire.com')) {
            var releases = [];
            var objetToSave = {};

            post = post.replace(/<wbr>/g, '');
            post = post.replace(/<br><br>/g, '<br>');
            post = post.replace(/<br>/g, '-BREAK-');
            post = stripHtml(post);
            post_split = post.split('-BREAK-');

            for (var j = 0; j < post_split.length; j++) {
              if(post_split[j].length) {
                if(post_split[j].startsWith('http') && !post_split[j].includes('youtube')) {
			               releases[releases.length-1].links.push(post_split[j]);
                } else {
                  releases.push({time:json_data.posts[i].time, title:post_split[j], links: []})
                }
              }
            }

            for (var k = 0; k < releases.length; k++) {
              if(releases[k].links.length) {
                  SAVE_DATA.push(releases[k]);
              }
            }

          }
        }
      }
    }

    //SAVE_DATA
    next(SAVE_DATA);
  } /*else {
    const file = fs.createWriteStream(FILE_PATH);

    const request = https.get('https://a.4cdn.org/co/'+FILE_PATH, function(response) {
      response.pipe(file);
      next({});
    });

  }*/

}

function checkLastThreadDownload() {
  return new Promise(resolve => {
    request({
        url: 'https://a.4cdn.org/co/catalog.json',
        json: true
    }, function (error, response, body) {

        if (!error && response.statusCode === 200) {
            for (var i = 0; i < body.length; i++) {
              for (var j = 0; j < body[i].threads.length; j++) {
                if(body[i].threads[j].semantic_url === 'official-winothread') {
                  resolve(body[i].threads[j].no);
                }
              }
            }
        }
    })
  });
}

async function checkLastThread() {
  var dir = __dirname + '/../thread';

  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }

  const result = await checkLastThreadDownload();
  FILEID = result;
  CURRENT_PATH = 'thread/'+FILEID+'.json';
  console.log('LAST THREAD https://a.4cdn.org/co/thread/'+FILEID+'.json');

  var download = wget.download('https://a.4cdn.org/co/thread/'+FILEID+'.json', CURRENT_PATH, {});

  download.on('end', function(output) {
    console.log('UPDATED https://a.4cdn.org/co/thread/'+FILEID+'.json');
  });

}

checkLastThread();

//cron.schedule('* * * * *', () => {
cron.schedule('0 * * * *', () => {
  const FILE_PATH = 'thread/'+FILEID+'.json';

  var download = wget.download('https://a.4cdn.org/co/thread/'+FILEID+'.json', CURRENT_PATH, {});

  download.on('end', function(output) {
    console.log('UPDATED https://a.4cdn.org/co/thread/'+FILEID+'.json');
    checkLastThread();
  });

  /*const file = fs.createWriteStream('thread/'+FILEID+'.json');

  const request = https.get('https://a.4cdn.org/co/thread/'+FILEID+'.json', function(response) {
    response.pipe(file);
    console.log('UPDATED https://a.4cdn.org/co/thread/'+FILEID+'.json');
    checkLastThread();
  });*/

});

function threadDownload(file_id) {
  return new Promise(resolve => {
    console.log(file_id);
    var download = wget.download('https://a.4cdn.org/co/'+file_id, CURRENT_PATH, {});

    download.on('error', function(output) {
      resolve('NOT EXISTS ' + file_id );
    });

    download.on('end', function(output) {
      resolve('UPDATED ' + file_id );
    });
  });
}

async function updateLastThreads() {
  var archive = savedReleases();

  var max_length = archive.length;
  if(max_length >= 4) max_length = 4;

  for (var i = 0; i < max_length; i++) {
    if(archive[i].closed){}
    else {
      const result = await threadDownload(archive[i].file);
      console.log(result);
    }
  }
}

//cron.schedule('*/10 * * * * *', () => {
cron.schedule('10 0 * * *', () => {

  updateLastThreads();

});

module.exports = router;
