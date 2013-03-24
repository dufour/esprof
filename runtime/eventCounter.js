var esprof$counters = {};

esprof.on("all", function (e) {
    esprof$counters[e] = (esprof$counters[e] || 0) + 1;
});