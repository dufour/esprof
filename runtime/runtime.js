var esprof$origObjCreate = Object.create;

var esprof$callbacks = {
    methodEntry     : function (e, fn, args, loc) {},
    methodExit      : function (e, fn, retval, loc) {},
    alloc           : function (e, obj, kind, loc) {},
    propRead        : function (e, obj, prop, loc) {},
    propWrite       : function (e, obj, prop, val, loc) {},
    beforeCall      : function (e, recv, fn, args, loc) {},
    afterCall       : function (e, recv, fn, args, loc) {},
    functionDefined : function (e, fn, loc) {}
};

var esprof = {
    registeredHandlers: {
        methodEntry: [],
        methodExit: [],
        alloc: [],
        propRead: [],
        propWrite: [],
        beforeCall: [],
        afterCall: [],
        functionDefined: []
    },

    /**
     * Registers a callback for a given event
     *
     * @param {String} event The event for which to trigger the callback
     * @param {Function} callback The callback to execute when the specified
                                  event gets triggered
     */
    on : function (event, callback) {
        var eventNames;
        if (event === "all" || event === null) {
            eventNames = Object.getOwnPropertyNames(this.registeredHandlers);
        } else if (typeof event === "string") {
            eventNames = [event];
        } else {
            eventNames = event;
        }

        for (var i = 0; i < eventNames.length; i++) {
            var e = eventNames[i];
            var callbacks = this.registeredHandlers[e];
            if (!(callbacks instanceof Array)) {
                throw "Unknown event: " + String(e);
            }

            callbacks.push(callback);
            if (callbacks.length === 1) {
                esprof$callbacks[e] = callback;
            } else {
                switch (e) {
                    case "methodEntry":
                    case "methodExit":
                    case "alloc":
                    case "propRead":
                        esprof$callbacks[e] = function (e, v1, v2, v3) {
                            for (var i = 0; i < callbacks.length; i++) {
                                callbacks[i](e, v1, v2, v3);
                            }
                        };
                        break;
                    case "propWrite":
                    case "beforeCall":
                    case "afterCall":
                        esprof$callbacks[e] = function (e, v1, v2, v3, v4) {
                            for (var i = 0; i < callbacks.length; i++) {
                                callbacks[i](e, v1, v2, v3, v4);
                            }
                        };
                        break;
                    case "functionDefined":
                        esprof$callbacks[e] = function (e, v1, v2) {
                            for (var i = 0; i < callbacks.length; i++) {
                                callbacks[i](e, v1, v2);
                            }
                        };
                        break;
                }
            }
        }
    },
};

function esprof$registerCallbacks(events) {
    for (var p in events) {
        esprof.on(p, events[p]);
    }
}

function esprof$onMethodEntry(fn, args, loc) {
    esprof$callbacks.methodEntry("methodEntry", fn, args, loc);
}

function esprof$onMethodExit(fn, retval, loc) {
    esprof$callbacks.methodExit("methodExit", fn, retval, loc);
    return retval;
}

function esprof$onObjectAlloc(obj, kind, loc) {
    var replacement = esprof$callbacks.alloc("alloc", obj, kind, loc);
    if (replacement !== undefined) return replacement;
    return obj;
}

function esprof$onPropRead(obj, prop, loc) {
    esprof$callbacks.propRead("propRead", obj, prop, loc);
    return obj[prop];
}

function esprof$onPropWrite(obj, prop, value, loc) {
    esprof$callbacks.propWrite("propWrite", obj, prop, value, loc);
    obj[prop] = value;
    return value;
}

function esprof$onPropOpWrite(obj, prop, lhs, rhs, op, loc) {
    var val;
    switch (op) {
        case "*":
            val = lhs * rhs;
            break;
        case "/":
            val = lhs / rhs;
            break;
        case "+":
            val = lhs + rhs;
            break;
        case "-":
            val = lhs - rhs;
            break;
        case "%":
            val = lhs % rhs;
            break;
        case "<<":
            val = lhs << rhs;
            break;
        case ">>":
            val = lhs >> rhs;
            break;
        case ">>>":
            val = lhs >>> rhs;
            break;
        case "&":
            val = lhs & rhs;
            break;
        case "^":
            val = lhs ^ rhs;
            break;
        case "|":
            val = lhs | rhs;
            break;
        default:
            throw "Unknown operator";
    }
    return esprof$onPropWrite(obj, prop, val, loc);
}

function esprof$onPropUpdate(obj, prop, op, loc) {
    var v = esprof$onPropRead(obj, prop, loc);
    switch (op) {
        case "++x":
            return esprof$onPropWrite(obj, prop, v + 1, loc);
        case "--x":
            return esprof$onPropWrite(obj, prop, v - 1, loc);
        case "x++":
            esprof$onPropWrite(obj, prop, v + 1, loc);
            return v;
        case "x--":
            esprof$onPropWrite(obj, prop, v - 1, loc);
            return v;
    }

    throw "Unknown operator"; // Should never happen
}

function esprof$onCall(self, fn, argArray, loc) {
    esprof$callbacks.beforeCall("beforeCall", self, fn, argArray, loc);
    var retval = fn.apply(self, argArray);
    esprof$callbacks.afterCall("afterCall", self, fn, argArray, loc);
    if (fn === esprof$origObjCreate) {
        retval = esprof$onObjectAlloc(retval, loc);
    }
    return retval;
}

function esprof$onDirectCall(self, fn, argArray, loc) {
    return esprof$onCall(self, fn, argArray, loc);
}

function esprof$onPropCall(obj, prop, argArray, loc) {
    var fn = esprof$onPropRead(obj, prop, loc);
    return esprof$onCall(obj, fn, argArray, loc);
}

function esprof$onFunctionDefined(fn, loc) {
    esprof$callbacks.functionDefined("functionDefined", fn, loc);
    return fn;
}
