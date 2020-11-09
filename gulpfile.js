const gulp = require("gulp");
const ts = require("gulp-typescript");
const mocha = require("gulp-mocha");
const sourcemaps = require("gulp-sourcemaps");
const eslint = require("gulp-eslint");

const tsProject = ts.createProject("tsconfig.json");

gulp.task("build", function() {
    const tsResult = tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject());

    return tsResult.js
        .pipe(sourcemaps.write(".", { includeContent: false, sourceRoot: "../src" }))
        .pipe(gulp.dest("dist"));
});

gulp.task("test", function() {
    return gulp.src("test/**/*.test.ts", { read: false })
        .pipe(mocha({
            reporter: "spec",
            require: ["ts-node/register"]
        }));
});

gulp.task("lint", function () {
    return tsProject.src()
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});