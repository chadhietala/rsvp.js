/* jshint node:true, undef:true, unused:true */
var compileModules   = require('broccoli-es6-module-transpiler');
var merge            = require('broccoli-merge-trees');
var closureCompiler  = require('broccoli-closure-compiler');
var es3Recast        = require('broccoli-es3-safe-recast');
var env              = process.env.EMBER_ENV || 'development';
var calculateVersion = require('git-repo-version');
var watchify         = require('broccoli-watchify');
var Funnel           = require('broccoli-funnel');
var concat           = require('broccoli-concat');
var fs               = require('fs');
var path             = require('path');

var bundle = compileModules('lib', {
  inputFiles: ['rsvp.umd.js'],
  output: env === 'test' ? '/test/rsvp.js' : '/rsvp.js',
  formatter: 'bundle'
});

var output = [
  bundle
];

if (env === 'production') {
  var productionBundle = new Funnel(bundle, {
    getDestinationPath: function (relativePath) {
      if (relativePath.match('rsvp')) {
        return relativePath.replace('.js', '.min.js');
      }
      return relativePath;
    }
  });

  var optimized = closureCompiler(productionBundle, {
    compilation_level: 'ADVANCED_OPTIMIZATIONS',
    externs: ['node']
  });

  output.push(concat(optimized, {
    inputFiles: ['rsvp.min.js'],
    outputFile: '/rsvp.min.js',
    separator: '\n',
    header: fs.readFileSync( path.join(process.cwd(), 'config/versionTemplate.txt')).toString()
  }));
}

if (env !== 'development') {
  output = output.map(es3Recast);
}

if (env === 'test') {
  
  var testHarness = new Funnel('test', {
    include: [new RegExp(/index/)],
    destDir: 'test'
  });

  var worker = new Funnel('test/tests', {
    include: [ new RegExp(/worker/)],
    destDir: 'test'
  });

  var mocha = new Funnel('node_modules/mocha', {
    files: ['mocha.css', 'mocha.js'],
    destDir: 'test'
  });

  var json3 = new Funnel('node_modules/json3/lib', {
    files: ['json3.js'],
    destDir: 'test'
  });

  output.push(testHarness, mocha, json3, worker);
}


var tree = watchify('test',{
  browserify: {
    entries: ['./main.js'],
    debug: true
  },
  outputFile: 'test/test-bundle.js',
  cache: true,
  init: function (b) {
    b.external('vertx');
    b.external('../dist/rsvp.js');
  }
});

output.push(tree);

module.exports = merge(output);
