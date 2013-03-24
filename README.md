esprof is a dynamic analysis tool for JavaScript. It transforms a JavaScript program into a semantically equivalent (well, _almost_ equivalent) JavaScript program with hooks inserted to trigger events during the execution. Custom profilers can then be written to take intercept these events.

# Installation

esprof is not (yet) available via npm, so installation is currently manual :

    $ git clone git@github.com:dufour/esprof.git
    $ cd esprof
    $ npm install

# Instrumenting the code

Code can be instrumented using the `esprof` script located in the `bin` directory :

    $ bin/esprof myprog.js > myprog_instrumented.js

The previous command will instrument the code to generate all events. More fined grained control can be achieved by specifying a specific profiler to use:

    $ bin/esprof --profiler runtime/tracer.js myprog.js > myprog_instrumented.js

In this case, esprof will infer the events required by the profiler, and instrument the code for this particular set of events. Alternatively, events can be disabled with switches:

    $ bin/esprof --no-functionDefined --no-call myprog.js > myprog_instrumented.js

# Running the instrumented code

The instrumented code requires the `runtime.js` library to execute. This file is located in the `runtime` directory. For example, using d8 :

    $ d8 runtime/runtime.js myprog_instrumented.js

# Running the builtin profilers

Two profilers are provided in the `runtime` directory: `tracer.js` and `profiler.js`. To use a profiler, simply load it after `runtime.js`, e.g. :

    $ d8 runtime/runtime.js runtime/tracer.js myprog_instrumented.js

To produce the profiling output when using `profiler.js`, simply load `profiler_end.js` at the end of the execution, or insert a call to `esprof$dumpProfile();` in the code at a point when output is required.

# Writing profilers using esprof

Custom profilers can be written easily by registering callbacks for one or more events:

    esprof.on("methodEntry", function (event, fn, args, loc) {
        ...
    });

    esprof.on("methodExit", function (event, fn, retval, loc) {
        ...
    });

    esprof.on("alloc", function (event, obj, kind, loc) {
        ...
    });

Supported events (and their associated callback signatures) are :


* `methodEntry` : `(event, fn, args, loc)`

    Called when a function starts executing

* `methodExit` : `(event, fn, retval, loc)`

    Called when a function returns normally

* `alloc` : `(event, obj, kind, loc)`

    Called when an object is allocated

* `propRead` : `(event, obj, prop, loc)`

    Called when a property is read from an object

* `propWrite` : `(event, obj, prop, val, loc)`

    Called when a property is written to an object

* `beforeCall` : `(event, recv, fn, args, loc)`

    Called before a function call (on the caller side)

* `afterCall` : `(event, recv, fn, args, loc)`

    Called after a function call returns normally (on the caller side)

* `functionDefined` : `(event, fn, loc)`

    Called when a function is defined (declared or created as a result of a function expression)

# Current limitations

* esprof does not currently handle code that is evaluated dynamically, e.g. through `eval` or the `Function` constructor
* esprof does not detect object creations that happen inside of the JavaScript standard library (e.g. `Array.splice`). However, profilers can intercept calls and inspect return values to achieve this if required.
* Property accesses resulting through `with` statements are not handled.