var express = require('express')
  , cons = require('consolidate')
  , nedb = require('nedb')
  , fs = require('fs')
  , canvas = require('canvas')
  , imgur = require('imgur');

var app = express()
  , db = new nedb({ filename: 'cache.db', autoload: true })
  , img = new canvas.Image()
  , invalidchars = /[^A-Za-z0-9_\- ]/;

db.ensureIndex({ fieldName: 'name' }, function(err) {
    if (err) {
        throw err;
    }
});

db.ensureIndex({ fieldName: 'timestamp' }, function(err) {
    if (err) {
        throw err;
    }
});

fs.readFile(__dirname + '/background.png', function(err, data) {
    if (err) {
        throw err;
    }

    img.src = data;
});

var generate = function(query, cb) {
    var cnv = new canvas(img.width, img.height)
      , ctx = cnv.getContext('2d');

    ctx.drawImage(img, 0, 0, img.width, img.height);
    ctx.font = 'bold 24px Purista';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    var text = ctx.measureText(query)
      , box = {};

    box.width = text.width + 40;
    box.height = 29;
    box.left = (img.width - box.width) / 2;
    box.top = 23;
    text.left = img.width / 2;
    text.top = box.top;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(box.left, box.top, box.width, box.height);
    ctx.fillStyle = '#F7DA8D';
    ctx.fillText(query, text.left, text.top);

    imgur.uploadBase64(cnv.toDataURL().substring(22)).then(function(json) {
        var doc = { name: query, url: json.data.link, timestamp: Date.now() };
        db.insert(doc);
        cb(doc);
    }).catch(function(err) {
        throw err;
    });
};

app.engine('html', cons.dust);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

app.get('/', function(req, res) {
    res.render('index');
});

app.get('/favicon.png', function(req, res) {
    res.sendFile(__dirname + '/favicon.png');
});

app.get('/main.css', function(req, res) {
    res.sendFile(__dirname + '/main.css');
});

app.get('//', function(req, res) {
    db.count({}, function(err1, count1) {
        if (err1) {
            throw err1;
        }

        db.count({ timestamp: { $gt: Date.now() - 3600000 } }, function(err2, count2) {
            if (err2) {
                throw err2;
            }

            res.send('total signatures: ' + count1 + '<br />' + 'in last hour: ' + count2);
        });
    });
});

app.get('/:q', function(req, res) {
    var query = req.params.q.trim();
    if (query.length < 4) {
        res.send('ERROR: too short, should be at least 4 chars');
        return;
    }

    if (query.length > 16) {
        res.send('ERROR: too long, should be at most 16 chars');
        return;
    }

    var match = query.search(invalidchars);
    if (match > -1) {
        res.send('ERROR: invalid character [' + query[match] + ']');
        return;
    }

    db.findOne({ name: query }, function(err, doc) {
        if (err) {
            throw err;
        }

        if (doc) {
            console.log('      ' + query + ': ' + doc.url);
            res.render('result', doc);
            return;
        }

        generate(query, function(doc) {
            console.log('[NEW] ' + query + ': ' + doc.url);
            res.render('result', doc);
        });
    });
});

app.listen(7237);
