esprof is a dynamic analysis tool for JavaScript. It transforms a JavaScript program into a semantically equivalent (well, _almost_ equivalent) JavaScript program with hooks inserted to trigger events during the execution. Custom profilers can then be written to take intercept these events.

# Installation

esprof is not (yet) available via npm, so installation is currently manual :

    $ git clone git@github.com:dufour/esprof.git
    $ cd esprof
    $ npm install

# Instrumenting the code

Code can be instrumented using the `esprof` script located in the `bin` directory :

    $ bin/esprof myprog.js > myprog_instrumented.js

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

Supported events &rightarrow; callbacks are :

* `methodEntry` &rightarrow; `(event, fn, args, loc)`: called when a function starts executing
* `methodExit` &rightarrow; `(event, fn, retval, loc)`: called when a function returns normally
* `alloc` &rightarrow; `(event, obj, kind, loc)`: called when an object is allocated
* `propRead` &rightarrow; `(event, obj, prop, loc)`: called when a property is read from an object
* `propWrite` &rightarrow; `(event, obj, prop, val, loc)`: called when a property is written to an object
* `beforeCall` &rightarrow; `(event, recv, fn, args, loc)`: called before a function call (on the caller side)
* `afterCall` &rightarrow; `(event, recv, fn, args, loc)`: called after a function call returns normally (on the caller side)
* `functionDefined` &rightarrow; `(event, fn, loc)`: called when a function is defined (declared or created as a result of a function expression)

# Current limitations

* esprof does not currently handle code that is evaluated dynamically, e.g. through `eval` or the `Function` constructor
* esprof does not detect object creations that happen inside of the JavaScript standard library (e.g. `Array.splice`). However, profilers can intercept calls and inspect return values to achieve this if required.
* Property accesses resulting through `with` statements are not handled.