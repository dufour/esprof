var esprof$origObjCreate = Object.create;

var esprof$callbacks = {
    "onMethodEntry" : function (fn, args, loc) {},
    "onMethodExit"  : function (fn, retval, loc) {},
    "onAlloc"       : function (obj, kind, loc) {},
    "onPropRead"    : function (obj, prop, loc) {},
    "onPropWrite"   : function (obj, prop, val, loc) {},
    "beforeCall"    : function (recv, fn, args, loc) {},
    "afterCall"     : function (recv, fn, args, loc) {},
};

function esprof$registerEvents(events) {
    var callbacks = esprof$callbacks;
    for (var p in events) {
        if (callbacks.hasOwnProperty(p)) {
            var callback = events[p];
            if (callback) {
                callbacks[p] = callback;
            }
        }
    }
};

function esprof$onMethodEntry(fn, args, loc) {
    esprof$callbacks.onMethodEntry(fn, args, loc);
}

function esprof$onMethodExit(fn, retval, loc) {
    esprof$callbacks.onMethodExit(fn, retval, loc);
    return retval;
}

function esprof$onObjectAlloc(obj, kind, loc) {
    var replacement = esprof$callbacks.onAlloc(obj, kind, loc);
    if (replacement !== undefined) return replacement;
    return obj;
}

function esprof$onPropRead(obj, prop, loc) {
    esprof$callbacks.onPropRead(obj, prop, loc);
    return obj[prop];
}

function esprof$onPropWrite(obj, prop, value, loc) {
    esprof$callbacks.onPropWrite(obj, prop, value, loc);
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
    esprof$callbacks.beforeCall(self, fn, argArray, loc);
    var retval = fn.apply(self, argArray);
    esprof$callbacks.afterCall(self, fn, argArray, loc);
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
