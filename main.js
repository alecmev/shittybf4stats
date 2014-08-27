var express = require('express')
  , cons = require('consolidate')
  , nedb = require('nedb')
  , fs = require('fs')
  , canvas = require('canvas')
  , imgur = require('imgur')

var app = express()
  , db = new nedb({ filename: 'cache.db', autoload: true })
  , img = new canvas.Image()
  , invalidchars = /[^A-Za-z0-9_\-]/;

db.ensureIndex({ fieldName: 'somefield' }, function(err) {
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

var render = function(query, cb) {
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
        db.insert({ name: query, url: json.data.link });
        cb(json.data.link);
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

app.get('/:q', function(req, res) {
    var query = req.params.q;
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
            res.redirect(303, doc.url);
            return;
        }

        render(query, function(url) {
            console.log('[NEW] ' + query + ': ' + url);
            res.redirect(303, url);
        });
    });
});

app.listen(7237);
