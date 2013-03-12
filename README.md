esprof is a simple (i.e. naive) implementation of a source-to-source transformation for profiling JavaScript code.

# Installation

esprof is not (yet) available via npm, so installation is manual :

    $ git clone git@github.com:dufour/esprof.git
    $ cd esprof
    $ npm install

# Instrumenting the code

Code can be instrumented using the `esprof` script located in the `bin` directory :

    $ bin/esprof myprog.js > myprog_instrumented.js

# Running the instrumented code

The instrumented code requires the `runtime.js` library to execute. For example, using d8 :

    $ d8 runtime.js myprog_instrumented.js

# Running the builtin profilers

Two profilers are provided : `tracer.js` and `profiler.js`. To use a profiler, simply load it after `runtime.js`, e.g. :

    $ d8 runtime.js tracer.js myprog_instrumented.js

To produce the profiling output when using `profiler.js`, simply load `profiler_end.js` at the end of the execution, or insert a call to `esprof$dumpProfile();` in the code at a point when output is required.

# Extending esprof

Custom profilers can be written easily by registering callbacks for one or more events:

    esprof$registerCallbacks({
        onMethodEntry : function (fn, args, loc) { ... },
        onMethodExit  : function (fn, retval, loc) { ... },
        onAlloc       : function (obj, kind, loc) { ... }
    });

Supported callbacks are :

* `onMethodEntry(fn, args, loc)`: called when a function starts executing
* `onMethodExit(fn, retval, loc)`: called when a function returns normally
* `onAlloc(obj, kind, loc)`: called when an object is allocated
* `onPropRead(obj, prop, loc)`: called when a property is read from an object
* `onPropWrite(obj, prop, val, loc)`: called when a property is written to an object
* `beforeCall(recv, fn, args, loc)`: called before a function call (on the caller side)
* `afterCall(recv, fn, args, loc)`: called after a function call returns normally (on the caller side)
