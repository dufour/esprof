var origObjCreate = Object.create;

function onObjectAlloc(obj) {
    // TODO: instrument
    return obj;
}

function onPropRead(obj, prop) {
    // TODO: instrument
    return obj[prop];
}

function onPropWrite(obj, prop, value) {
    // TODO: instrument
    obj[prop] = value;
    return value;
}

function onPropOpWrite(obj, prop, lhs, rhs, op) {
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
    return onPropWrite(obj, prop, val);
}

function onPropUpdate(obj, prop, op) {
    var v = onPropRead(obj, prop);
    switch (op) {
        case "++x":
            return onPropWrite(obj, prop, v + 1);
        case "--x":
            return onPropWrite(obj, prop, v - 1);
        case "x++":
            onPropWrite(obj, prop, v + 1);
            return v;
        case "x--":
            onPropWrite(obj, prop, v - 1);
            return v;
    }

    throw "Unknown operator"; // Should never happen
}

function onCall(self, fn, argArray) {
    // TODO: instrument
    var retval = fn.apply(self, argArray);
    if (fn === origObjCreate) {
        retval = onObjectAlloc(retval);
    }
    return retval;
}

function onDirectCall(self, fn, argArray) {
    return onCall(self, fn, argArray);
}

function onPropCall(obj, prop, argArray) {
    var fn = onPropRead(obj, prop);
    return onCall(obj, fn, argArray);
}
