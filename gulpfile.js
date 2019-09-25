const gulp = require('gulp');
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const ts = require('gulp-typescript');
const tsProject = ts.createProject('./tsconfig.json');
const tiny = require('./dist/index');

exports.default = () => {

  tsProject.src().pipe(tsProject()).js
    .pipe(gulp.dest('./dist'))
    .pipe(babel())
    .pipe(uglify())
    .pipe(gulp.dest('./dist'));

  return gulp.watch('./src/**/*.ts', () => tsProject.src().pipe(tsProject()).js
                                                            .pipe(gulp.dest('./dist'))
                                                            .pipe(babel())
                                                            .pipe(uglify())
                                                            .pipe(gulp.dest('./dist')));
}

exports.tiny = () => gulp.src('./test/*')
                      .pipe(tiny({
                        // key: 'tiny key',
                        // key: 'imagemin',
                        // verbose: true,
                        // jsonDest: './src/',
                        // tinyTag: '-ttt'
                      })).pipe(gulp.dest('./test/tinied'));