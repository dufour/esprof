var vm = require("vm");
var fs = require("fs");
var assert = require("assert");
var esprima = require("esprima");
var escodegen = require('escodegen');
var esprof = require('../lib/main');
var util = require('util');

var runtimeScript = fs.readFileSync("runtime/runtime.js");
var eventCounter = fs.readFileSync("runtime/eventCounter.js");

function instrumentAndExecScript(/* [pre] script [post] */) {
    var pre, script, post;
    if (arguments.length === 1) {
        script = arguments[0];
    } else if (arguments.length === 2) {
        pre = arguments[0];
        script = arguments[1];
    } else if (arguments.length === 3) {
        pre = arguments[0];
        script = arguments[1];
        post = arguments[2];
    } else {
        throw "Can only handle 1 to 3 arguments";
    }

    var context = vm.createContext({});
    var instrumentedScript = esprof.instrument(script);

    vm.runInContext(runtimeScript, context, "runtime.js");
    vm.runInContext(eventCounter, context, "eventCounter.js");
    if (pre) {
        if (pre instanceof Array) {
            pre.forEach(function (script) {
                vm.runInContext(script, context);
            });
        } else {
            vm.runInContext(pre, context);
        }
    }
    vm.runInContext(instrumentedScript, context);
    if (post) {
        if (post instanceof Array) {
            post.forEach(function (script) {
                vm.runInContext(script, context);
            });
        } else {
            vm.runInContext(post, context);
        }
    }
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
            assert.equal(1, state["esprof$counters"].alloc);
        });

        it('should handle array literals', function() {
            var script = "var x = [];";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].alloc);
        });

        it('should handle simple new Object expressions', function() {
            var script = "var x = new Object();";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].alloc);
        });



        it('should handle property accesses in new Object expressions', function() {
            var script = "var x = {f: function () {}}; var y = new x.f();";
            var state = instrumentAndExecScript(script);
            assert.equal(3, state["esprof$counters"].alloc);
        });

        it('should handle deeply nested property accesses in new Object expressions', function() {
            var script = "var x = {y: {z: {f: function () {}}}}; var w = new x.y.z.f();";
            var state = instrumentAndExecScript(script);
            assert.equal(5, state["esprof$counters"].alloc);
        });

        it('should handle Object.create', function() {
            var script = "var x = Object.create(null);";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].alloc);
        });

        it('should handle closures as objects', function() {
            var script = "var x = function () {};";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].alloc);
        });

        it('should handle Function object creation', function() {
            var script = "var foo = new Function('');";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].alloc);
        });

        it.skip('should handle Function object creation without "new"', function() {
            var script = "var foo = Function('');";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].alloc);
        });

        it.skip('should handle object creation from the standard library', function() {
            var script = "var arr = ['a', 'b', 'c']; var slice = arr.slice(2);";
            var state = instrumentAndExecScript(script);
            assert.equal(2, state["esprof$counters"].alloc);
        });
    });

    describe('Calls', function() {
        it('should handle calls to function declarations', function() {
            var script = "var z = 0; function f() {z=1;}; f();";
            var state = instrumentAndExecScript(script);
            assertCounters({
                methodEntry: 1,
                methodExit: 1,
                beforeCall: 1,
                afterCall: 1
            }, state["esprof$counters"]);
            assert.equal(1, state.z);
        });

        it('should handle calls to function expressions', function() {
            var script = "var z = 0; var f = function () {z=1;}; f();";
            var state = instrumentAndExecScript(script);
            assertCounters({
                methodEntry: 1,
                methodExit: 1,
                beforeCall: 1,
                afterCall: 1
            }, state["esprof$counters"]);
            assert.equal(1, state.z);
        });

        it('should handle calls via simple properties', function() {
            var script = "var z = 0; var x = {f: function () {z=1;}}; x.f();";
            var state = instrumentAndExecScript(script);
            assertCounters({
                methodEntry: 1,
                methodExit: 1,
                beforeCall: 1,
                afterCall: 1
            }, state["esprof$counters"]);
            assert.equal(1, state.z);
        });

        it('should handle calls via deeply nested properties', function() {
            var script = "var z = 0; var x = {y: {z: {f: function () {z=1;}}}}; x.y.z.f();";
            var state = instrumentAndExecScript(script);
            assertCounters({
                methodEntry: 1,
                methodExit: 1,
                beforeCall: 1,
                afterCall: 1
            }, state["esprof$counters"]);
            assert.equal(1, state.z);
        });
    });

    describe('Properties', function() {
        it('should handle property reads with dot notation', function() {
            var script = "var x = {p: 42}; var y = x.p;";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].propRead);
            assert.equal(42, state.y);
        });

        it('should handle property reads with [] notation & string literal name', function() {
            var script = "var x = {p: 42}; var y = x['p'];";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].propRead);
            assert.equal(42, state.y);
        });

        it('should handle property reads with [] notation & expression as name', function() {
            var script = "var p = 'p'; var x = {p: 42}; var y = x[p];";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].propRead);
            assert.equal(42, state.y);
        });

        it('should handle property writes with dot notation', function() {
            var script = "var x = {p: 42}; x.p = 'abc'; var y = x.p;";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].propWrite);
            assert.equal('abc', state.y);
        });

        it('should handle property writes with [] notation & string literal name', function() {
            var script = "var x = {p: 42}; x['p'] = 'abc'; var y = x.p;";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].propWrite);
            assert.equal('abc', state.y);
        });

        it('should handle property writes with [] notation & expression as name', function() {
            var script = "var p = 'p'; var x = {p: 42}; x[p] = 'abc'; var y = x.p;";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].propWrite);
            assert.equal('abc', state.y);
        });

        it('should handle += property update', function() {
            var script = "var x = {n: 5}; x.n += 4;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(9, state.x.n);
        });

        it('should handle *= property update', function() {
            var script = "var x = {n: 5}; x.n *= 4;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(20, state.x.n);
        });

        it('should handle /= property update', function() {
            var script = "var x = {n: 5}; x.n /= 4;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(1.25, state.x.n);
        });

        it('should handle -= property update', function() {
            var script = "var x = {n: 5}; x.n -= 4;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(1, state.x.n);
        });

        it('should handle %= property update', function() {
            var script = "var x = {n: 23}; x.n %= 4;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(3, state.x.n);
        });

        it('should handle <<= property update', function() {
            var script = "var x = {n: 23}; x.n <<= 4;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(368, state.x.n);
        });

        it('should handle >>= property update', function() {
            var script = "var x = {n: 368}; x.n >>= 4;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(23, state.x.n);
        });

        it('should handle >>>= property update', function() {
            var script = "var x = {n: -255}; x.n >>>= 20;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(4095, state.x.n);
        });

        it('should handle &= property update', function() {
            var script = "var x = {n: 23}; x.n &= 10;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(2, state.x.n);
        });

        it('should handle |= property update', function() {
            var script = "var x = {n: 23}; x.n |= 10;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(31, state.x.n);
        });

        it('should handle ^= property update', function() {
            var script = "var x = {n: 23}; x.n ^= 10;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 1,
                propWrite: 1
            }, state["esprof$counters"]);
            assert.equal(29, state.x.n);
        });

        it('should handle chained updates', function() {
            var script = "var x = {n: 5}; x.n *= x.n *= x.n *= x.n;";
            var state = instrumentAndExecScript(script);
            assertCounters({
                propRead: 4,
                propWrite: 3
            }, state["esprof$counters"]);
            assert.equal(625, state.x.n);
        });
    });

    describe('Function definitions', function() {
        it('should register function declarations', function() {
            var script = "function foo() {};";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].functionDefined);
        });

        it('should register nested function declarations', function() {
            var script = "function foo() { function bar() {}; }; foo(); var baz = function () { function bif() {}; }; baz(); ";
            var state = instrumentAndExecScript(script);
            assert.equal(4, state["esprof$counters"].functionDefined);
        });

        it('should register nested function expressions', function() {
            var script = "function foo() { var bar = function () {}; }; foo(); var baz = function () { var bif = function () {}; }; baz();";
            var state = instrumentAndExecScript(script);
            assert.equal(4, state["esprof$counters"].functionDefined);
        });

        it('should register function expressions', function() {
            var script = "var foo = function () {};";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].functionDefined);
        });

        it.skip('should register Function object creation', function() {
            var script = "var foo = new Function('');";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].functionDefined);
        });

        it.skip('should register Function object creation without "new"', function() {
            var script = "var foo = Function('');";
            var state = instrumentAndExecScript(script);
            assert.equal(1, state["esprof$counters"].functionDefined);
        });
    });
});


describe('Runtime', function() {
    describe('Events', function() {
        it('should support multiple bindings per event', function () {
            var script = "var allocs = 0; var x = {};";
            var prelude = "esprof.on('alloc', function () {allocs++;});";
            var state = instrumentAndExecScript(prelude, script);

            assert.equal(1, state["esprof$counters"].alloc);
            assert.equal(1, state.allocs);
        });
    });
});