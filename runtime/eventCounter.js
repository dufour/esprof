var esprof$counters = {
    onMethodEntry : 0,
    onMethodExit  : 0,
    onAlloc       : 0,
    onPropRead    : 0,
    onPropWrite   : 0,
    beforeCall    : 0,
    afterCall     : 0
};

esprof$registerCallbacks({
    onMethodEntry : function (fn, args, loc) { esprof$counters.onMethodEntry++; },
    onMethodExit  : function (fn, retval, loc) { esprof$counters.onMethodExit++; },
    onAlloc       : function (obj, kind, loc) { esprof$counters.onAlloc++; },
    onPropRead    : function (obj, prop, loc) { esprof$counters.onPropRead++; },
    onPropWrite   : function (obj, prop, val, loc) { esprof$counters.onPropWrite++; },
    beforeCall    : function (recv, fn, args, loc) { esprof$counters.beforeCall++; },
    afterCall     : function (recv, fn, args, loc) { esprof$counters.afterCall++; }
});