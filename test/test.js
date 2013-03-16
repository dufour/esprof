var vm = require("vm");
var fs = require("fs");
var assert = require("assert");
var esprima = require("esprima");
var escodegen = require('escodegen');
var esprof = require('../lib/main');
var util = require('util');

var runtimeScript = fs.readFileSync("runtime/runtime.js");
var eventCounter = fs.readFileSync("runtime/eventCounter.js");

function instrumentAndExecScript(script) {
    var context = vm.createContext({});
    var instrumentedScript = esprof.instrument(script);

    vm.runInContext(runtimeScript, context, "runtime.js");
    vm.runInContext(eventCounter, context, "eventCounter.js");
    vm.runInContext(instrumentedScript, context);
    return context;
}

function assertCounters(expected, actual) {
    for (var p in actual) {
        if (expected.hasOwnProperty(p)) {
            assert.equal(expected[p], actual[p]);
        }
    }
}

describe('Instrumentation', function() {
    describe('Allocations', function() {
        it('should handle object literals', function() {
            var script = "var x = {};";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].onAlloc);
        });

        it('should handle array literals', function() {
            var script = "var x = [];";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].onAlloc);
        });

        it('should handle simple new Object expressions', function() {
            var script = "var x = new Object();";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].onAlloc);
        });



        it('should handle property accesses in new Object expressions', function() {
            var script = "var x = {f: function () {}}; var y = new x.f();";
            var state = instrumentAndExecScript(script);
            assert.equal(3, state["esprof$counters"].onAlloc);
        });

        it('should handle deeply nested property accesses in new Object expressions', function() {
            var script = "var x = {y: {z: {f: function () {}}}}; var w = new x.y.z.f();";
            var state = instrumentAndExecScript(script);
            assert.equal(5, state["esprof$counters"].onAlloc);
        });

        it('should handle Object.create', function() {
            var script = "var x = Object.create(null);";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].onAlloc);
        });

        it('should handle closures as objects', function() {
            var script = "var x = function () {};";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].onAlloc);
        });
    });

    describe('Calls', function() {
        it('should handle calls to function declarations', function() {
            var script = "function f() {}; f();";
            var state = instrumentAndExecScript(script);
            assertCounters({
                onMethodEntry: 1,
                onMethodExit: 1,
                onBeforeCall: 1,
                onAfterCall: 1
            }, state["esprof$counters"]);
        });

        it('should handle calls to function expressions', function() {
            var script = "var f = function () {}; f();";
            var state = instrumentAndExecScript(script);
            assertCounters({
                onMethodEntry: 1,
                onMethodExit: 1,
                onBeforeCall: 1,
                onAfterCall: 1
            }, state["esprof$counters"]);
        });

        it('should handle calls via simple properties', function() {
            var script = "var x = {f: function () {}}; x.f();";
            var state = instrumentAndExecScript(script);
            assertCounters({
                onMethodEntry: 1,
                onMethodExit: 1,
                onBeforeCall: 1,
                onAfterCall: 1
            }, state["esprof$counters"]);

        });

        it('should handle calls via deeply nested properties', function() {
            var script = "var x = {y: {z: {f: function () {}}}}; x.y.z.f();";
            var state = instrumentAndExecScript(script);
            assertCounters({
                onMethodEntry: 1,
                onMethodExit: 1,
                onBeforeCall: 1,
                onAfterCall: 1
            }, state["esprof$counters"]);
        });
    });

    describe('Property reads', function() {
        // TODO
    });

    describe('Property writes', function() {
        // TODO
    });
});