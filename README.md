esprof is a simple (i.e. naive) implementation of a source-to-source transformation for profiling JavaScript code.

# Installation

  $ git clone git@github.com:dufour/esprof.git
  $ npm install

# Instrumenting the code

Code can be instrumented using the `esprof` script located in the `bin` directory :

  $ bin/esprof myprog.js > myprog_instrumented.js

# Running the instrumented code

The instrumented code requires the `runtime.js` library to execute. For example, using d8 :

  $ d8 runtime.js myprog_instrumented.js
