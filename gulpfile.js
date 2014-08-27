var gulp = require('gulp')
  , gutil = require('gulp-util')
  , spawn = require('child_process').spawn
  , wait = require('gulp-wait')
  , server = false;

gulp.task('server', function() {
    if (server) {
        server.kill();
    }

    server = spawn('node', ['main.js'], { stdio: 'inherit' });
    server.on('close', function(code) {
        if (8 === code) {
            gutil.log('ERROR: waiting for a fix...');
        }
    });
});

gulp.task('default', ['server'], function() {
    gulp.watch(['main.js', 'src/**/*.js'], ['server']);
});

process.on('exit', function() {
    if (server) {
        server.kill();
    }
});
