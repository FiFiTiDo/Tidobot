const gulp = require("gulp");
const ts = require("gulp-typescript");
const mocha = require("gulp-mocha");
const sourcemaps = require("gulp-sourcemaps");

const tsProject = ts.createProject('tsconfig.json');

gulp.task('default', function() {
    let tsResult = tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject());

    return tsResult.js
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '../src' }))
        .pipe(gulp.dest('dist'));
});

gulp.task('test', function(cb) {
    return gulp.src('test/**/*.test.ts', { read: false })
        .pipe(mocha({
            reporter: 'spec',
            require: ['ts-node/register']
        }));
});